-- =====================================================================
--  Baobabs Basket Club — Migration : BILLETTERIE (lot 2)
--  À exécuter une fois dans Supabase : SQL Editor → New query → Run.
--  Idempotent : réexécutable sans risque, n'affecte aucune donnée existante.
--
--  Ce que ça crée :
--    1. ticket_offers  — les catégories de billets d'un match (tarif + quota)
--    2. reservations   — les réservations des clients (paiement sur place)
--    3. Une garde anti-surbooking côté base (fonction bbc_reserver)
--    4. Les policies RLS : public en lecture, client sur ses réservations,
--       admin sur tout (via la fonction is_admin() déjà en place)
--
--  Prérequis déjà livrés (lot 1) : tables customers, admin_users, is_admin().
-- =====================================================================


-- =====================================================================
-- 1. OFFRES DE BILLETS — une ligne par catégorie et par match
-- =====================================================================
create table if not exists ticket_offers (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references matches(id) on delete cascade,
  category    text   not null,                    -- « Tribune », « VIP », « Scolaire »…
  price_fcfa  integer not null default 0 check (price_fcfa >= 0),
  quota       integer not null default 0 check (quota >= 0),
  sold        integer not null default 0 check (sold >= 0),
  is_open     boolean not null default false,     -- la vente est-elle ouverte ?
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Une seule offre par catégorie et par match (évite les doublons de saisie).
create unique index if not exists ticket_offers_match_category_uk
  on ticket_offers (match_id, lower(category));

create index if not exists ticket_offers_match_idx on ticket_offers (match_id);

-- Places restantes : calculé, jamais saisi.
-- (colonne générée pour que le site puisse la lire directement)
alter table ticket_offers
  add column if not exists remaining integer
  generated always as (greatest(quota - sold, 0)) stored;


-- =====================================================================
-- 2. RÉSERVATIONS — paiement sur place, donc pas de transaction en ligne
-- =====================================================================
create table if not exists reservations (
  id           uuid primary key default gen_random_uuid(),
  reference    text not null unique,              -- ex. « BBC-7K4M2 », à présenter au guichet
  customer_id  uuid references auth.users(id) on delete set null,
  match_id     uuid not null references matches(id) on delete cascade,
  offer_id     uuid   not null references ticket_offers(id) on delete restrict,
  quantity     integer not null check (quantity between 1 and 10),
  unit_price   integer not null default 0,        -- tarif figé au moment de la réservation
  total_fcfa   integer not null default 0,
  status       text not null default 'reservee'
               check (status in ('reservee','retiree','annulee','expiree')),
  buyer_name   text,
  buyer_phone  text,
  buyer_email  text,
  note         text,
  created_at   timestamptz not null default now(),
  checked_in_at timestamptz,                      -- rempli au guichet le jour du match
  cancelled_at  timestamptz
);

create index if not exists reservations_match_idx    on reservations (match_id);
create index if not exists reservations_customer_idx on reservations (customer_id);
create index if not exists reservations_status_idx   on reservations (status);


-- =====================================================================
-- 3. GARDE ANTI-SURBOOKING
--    Toute réservation passe par cette fonction : elle verrouille la ligne
--    d'offre le temps de vérifier le quota, puis incrémente « sold ».
--    Deux clics simultanés ne peuvent donc pas dépasser la jauge.
-- =====================================================================
create or replace function bbc_reference_billet()
returns text
language sql
as $$
  -- 5 caractères sans I/O/0/1 pour éviter les confusions à l'oral.
  select 'BBC-' || string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
           floor(random() * 32 + 1)::int, 1), '')
  from generate_series(1, 5);
$$;

create or replace function bbc_reserver(
  p_offer_id uuid,
  p_quantity integer,
  p_name     text default null,
  p_phone    text default null,
  p_email    text default null
)
returns reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer  ticket_offers%rowtype;
  v_ref    text;
  v_row    reservations%rowtype;
  v_tries  int := 0;
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 10 then
    raise exception 'quantite_invalide';
  end if;

  -- Verrou sur l'offre : les réservations concurrentes attendent leur tour.
  select * into v_offer from ticket_offers where id = p_offer_id for update;
  if not found then
    raise exception 'offre_introuvable';
  end if;
  if not v_offer.is_open then
    raise exception 'vente_fermee';
  end if;
  if v_offer.sold + p_quantity > v_offer.quota then
    raise exception 'places_insuffisantes';
  end if;

  -- Référence unique (on retente en cas de collision, très improbable).
  loop
    v_tries := v_tries + 1;
    v_ref := bbc_reference_billet();
    exit when not exists (select 1 from reservations where reference = v_ref);
    if v_tries > 10 then raise exception 'reference_indisponible'; end if;
  end loop;

  update ticket_offers set sold = sold + p_quantity where id = p_offer_id;

  insert into reservations (
    reference, customer_id, match_id, offer_id, quantity,
    unit_price, total_fcfa, buyer_name, buyer_phone, buyer_email
  ) values (
    v_ref, auth.uid(), v_offer.match_id, v_offer.id, p_quantity,
    v_offer.price_fcfa, v_offer.price_fcfa * p_quantity, p_name, p_phone, p_email
  ) returning * into v_row;

  return v_row;
end;
$$;

-- Annulation : le client peut annuler sa propre réservation jusqu'à la veille
-- du match ; l'admin peut annuler n'importe laquelle, sans limite de date.
-- Dans les deux cas les places repartent dans le quota.
create or replace function bbc_annuler_reservation(p_reservation_id uuid)
returns reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row   reservations%rowtype;
  v_date  date;
  v_admin boolean := is_admin();
begin
  select * into v_row from reservations where id = p_reservation_id for update;
  if not found then raise exception 'reservation_introuvable'; end if;

  if not v_admin and (v_row.customer_id is null or v_row.customer_id <> auth.uid()) then
    raise exception 'non_autorise';
  end if;

  if v_row.status <> 'reservee' then
    raise exception 'deja_traitee';
  end if;

  select match_date into v_date from matches where id = v_row.match_id;
  if not v_admin and v_date is not null and v_date <= current_date then
    raise exception 'trop_tard';
  end if;

  update ticket_offers
     set sold = greatest(sold - v_row.quantity, 0)
   where id = v_row.offer_id;

  update reservations
     set status = 'annulee', cancelled_at = now()
   where id = p_reservation_id
   returning * into v_row;

  return v_row;
end;
$$;

-- Retrait au guichet le jour du match (admin uniquement).
create or replace function bbc_retirer_reservation(p_reservation_id uuid)
returns reservations
language plpgsql
security definer
set search_path = public
as $$
declare v_row reservations%rowtype;
begin
  if not is_admin() then raise exception 'non_autorise'; end if;
  update reservations
     set status = 'retiree', checked_in_at = now()
   where id = p_reservation_id and status = 'reservee'
   returning * into v_row;
  if not found then raise exception 'reservation_introuvable_ou_deja_traitee'; end if;
  return v_row;
end;
$$;


-- =====================================================================
-- 4. SÉCURITÉ (RLS)
-- =====================================================================
alter table ticket_offers enable row level security;
alter table reservations  enable row level security;

-- --- Offres : tout le monde voit les ventes ouvertes, l'admin gère tout ---
drop policy if exists ticket_offers_public_read on ticket_offers;
create policy ticket_offers_public_read on ticket_offers
  for select using (is_open or is_admin());

drop policy if exists ticket_offers_admin_all on ticket_offers;
create policy ticket_offers_admin_all on ticket_offers
  for all using (is_admin()) with check (is_admin());

-- --- Réservations : chacun les siennes, l'admin toutes ---
drop policy if exists reservations_own_read on reservations;
create policy reservations_own_read on reservations
  for select using (customer_id = auth.uid() or is_admin());

drop policy if exists reservations_admin_all on reservations;
create policy reservations_admin_all on reservations
  for all using (is_admin()) with check (is_admin());

-- Aucune policy d'INSERT côté client : on ne réserve QUE par bbc_reserver(),
-- seul chemin qui vérifie le quota. Idem pour l'annulation.
revoke all on function bbc_reserver(uuid, integer, text, text, text) from public;
grant execute on function bbc_reserver(uuid, integer, text, text, text) to anon, authenticated;

revoke all on function bbc_annuler_reservation(uuid) from public;
grant execute on function bbc_annuler_reservation(uuid) to authenticated;

revoke all on function bbc_retirer_reservation(uuid) from public;
grant execute on function bbc_retirer_reservation(uuid) to authenticated;


-- =====================================================================
-- 5. VUE DE TRAVAIL POUR L'ESPACE GESTION
--    Une ligne par match avec le total réservé — évite de recalculer
--    côté navigateur dans l'onglet Billetterie.
-- =====================================================================
create or replace view billetterie_par_match as
select
  m.id                       as match_id,
  m.opponent_name,
  m.match_date,
  m.match_time,
  m.is_home,
  m.venue,
  coalesce(sum(o.quota), 0)  as places_totales,
  coalesce(sum(o.sold), 0)   as places_reservees,
  coalesce(sum(greatest(o.quota - o.sold, 0)), 0) as places_restantes,
  bool_or(o.is_open)         as vente_ouverte,
  count(o.id)                as nb_categories
from matches m
left join ticket_offers o on o.match_id = m.id
group by m.id;


-- =====================================================================
--  Vérification rapide après exécution :
--    select * from billetterie_par_match order by match_date;
--  Rien ne change sur le site public tant qu'aucune offre n'est créée
--  et ouverte depuis l'espace gestion.
-- =====================================================================
