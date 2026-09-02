-- =====================================================================
--  Baobabs Basket Club — Migration : LOT 2 (finitions) + LOT 3 (Mon espace)
--  À exécuter une fois dans Supabase : SQL Editor → New query → Run.
--  Idempotent : réexécutable sans risque.
--
--  Prérequis : MIGRATION-billetterie.sql déjà passée.
--
--  Ce que ça pose :
--    1. Expiration automatique des réservations non retirées
--    2. Rattachement des commandes boutique au compte client
--    3. Rattachement par e-mail de l'historique déjà existant
--    4. Vue « Mon espace » : réservations + commandes du client connecté
--    5. Table favorites (lot 4), prête à l'emploi
-- =====================================================================


-- =====================================================================
-- 1. EXPIRATION AUTOMATIQUE
--    Une réservation encore « reservee » après la date du match passe en
--    « expiree ». Les places ne repartent PAS dans le quota (le match est
--    joué), mais les statistiques restent justes.
--    À appeler depuis un cron Supabase (une fois par jour suffit), ou
--    manuellement : select bbc_expirer_reservations();
-- =====================================================================
create or replace function bbc_expirer_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  with expirees as (
    update reservations r
       set status = 'expiree'
      from matches m
     where m.id = r.match_id
       and r.status = 'reservee'
       and m.match_date < current_date
    returning r.id
  )
  select count(*) into v_count from expirees;
  return coalesce(v_count, 0);
end;
$$;

revoke all on function bbc_expirer_reservations() from public;
grant execute on function bbc_expirer_reservations() to authenticated;


-- =====================================================================
-- 2. COMMANDES BOUTIQUE RATTACHÉES AU COMPTE
--    La colonne est facultative : une commande passée sans compte reste
--    parfaitement valable (customer_id vide).
-- =====================================================================
alter table orders
  add column if not exists customer_id uuid references auth.users(id) on delete set null;

create index if not exists orders_customer_idx on orders (customer_id);

-- IMPORTANT : sans cette ligne, les policies ci-dessous sont inertes et
-- « Mes commandes » exposerait toutes les commandes du club à chaque visiteur
-- connecté (nom, téléphone, e-mail, panier, total).
alter table orders enable row level security;

-- Le client voit ses commandes ; l'admin voit tout.
drop policy if exists orders_own_read on orders;
create policy orders_own_read on orders
  for select using (customer_id = auth.uid() or is_admin());

-- La commande reste possible sans compte : c'est le parcours actuel de la
-- boutique. On interdit seulement de déposer une commande au nom d'un autre
-- compte que le sien.
drop policy if exists orders_public_insert on orders;
create policy orders_public_insert on orders
  for insert to anon, authenticated
  with check (customer_id is null or customer_id = auth.uid());

-- L'admin garde la main sur les commandes (statut, suppression).
drop policy if exists orders_admin_all on orders;
create policy orders_admin_all on orders
  for all using (is_admin()) with check (is_admin());


-- =====================================================================
-- 3. RATTACHEMENT DE L'HISTORIQUE
--    À la première connexion, on relie au compte les commandes et les
--    réservations passées avec la même adresse e-mail. Sans écraser ce qui
--    est déjà rattaché à quelqu'un.
-- =====================================================================
create or replace function bbc_rattacher_historique()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_cmd   integer := 0;
  v_resa  integer := 0;
begin
  if v_uid is null then raise exception 'non_connecte'; end if;

  select email into v_email from auth.users where id = v_uid;
  if v_email is null or v_email = '' then
    return json_build_object('commandes', 0, 'reservations', 0);
  end if;

  with maj as (
    update orders set customer_id = v_uid
     where customer_id is null and lower(customer_email) = lower(v_email)
    returning id
  )
  select count(*) into v_cmd from maj;

  with maj2 as (
    update reservations set customer_id = v_uid
     where customer_id is null and lower(buyer_email) = lower(v_email)
    returning id
  )
  select count(*) into v_resa from maj2;

  return json_build_object('commandes', v_cmd, 'reservations', v_resa);
end;
$$;

revoke all on function bbc_rattacher_historique() from public;
grant execute on function bbc_rattacher_historique() to authenticated;


-- =====================================================================
-- 4. VUES « MON ESPACE »
--    Le filtrage par client est assuré par les policies RLS des tables
--    sous-jacentes : chacun ne voit que ses lignes.
-- =====================================================================
create or replace view mes_reservations as
select
  r.id, r.reference, r.quantity, r.total_fcfa, r.status,
  r.created_at, r.checked_in_at,
  o.category,
  m.id            as match_id,
  m.opponent_name,
  m.opponent_logo_url,
  m.match_date,
  m.match_time,
  m.is_home,
  m.venue,
  (m.match_date >= current_date) as a_venir,
  -- annulable jusqu'à la veille du match, et seulement si encore réservée
  (r.status = 'reservee' and m.match_date > current_date) as annulable
from reservations r
join ticket_offers o on o.id = r.offer_id
join matches m       on m.id = r.match_id;

alter view mes_reservations set (security_invoker = on);


-- =====================================================================
-- 5. FAVORIS (lot 4) — table prête, branchement côté site à venir
-- =====================================================================
create table if not exists favorites (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('player','product','match')),
  target_id   uuid not null,
  created_at  timestamptz not null default now()
);

create unique index if not exists favorites_unique
  on favorites (customer_id, kind, target_id);

alter table favorites enable row level security;

drop policy if exists favorites_own_all on favorites;
create policy favorites_own_all on favorites
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());


-- =====================================================================
--  Vérification après exécution :
--    select bbc_expirer_reservations();   -- renvoie le nombre de lignes traitées
--    select * from mes_reservations;      -- vide si vous n'êtes pas un client
--
--  ESPACE GESTION : rien à changer. L'admin interroge Supabase avec le jeton
--  de sa session, donc is_admin() est satisfait et la policy orders_admin_all
--  lui donne la lecture, le changement de statut et la suppression des
--  commandes. Après migration, vérifiez tout de même l'onglet
--  « Formulaires → Commandes » et un changement de statut.
--
--  Cette migration ne touche QUE la table orders. Les formulaires
--  candidatures, newsletter et contact continuent d'insérer en tant que
--  visiteur anonyme : leurs policies existantes n'ont pas besoin de changer.
--
--  Après exécution, VÉRIFIER que la boutique fonctionne toujours :
--  passez DEUX commandes de test : une sans être connecté, une connecté.
--  La seconde doit apparaître dans « Mon espace → Mes commandes ». Si l'une
--  des deux est refusée, c'est que la policy d'insertion n'a pas été créée —
--  relancez la section 2 seule.
-- =====================================================================
