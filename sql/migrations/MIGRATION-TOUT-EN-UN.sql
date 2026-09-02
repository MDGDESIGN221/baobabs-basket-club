-- =====================================================================
--  BAOBABS BASKET CLUB
--  MIGRATION COMPLÈTE — un seul fichier, à exécuter une seule fois
--  27 juillet 2026
-- =====================================================================
--
--  COMMENT FAIRE
--    1. Supabase → SQL Editor → New query
--    2. Coller TOUT ce fichier
--    3. Run
--
--  C'est tout. Il n'y a rien d'autre à exécuter.
--
--  Ce fichier réunit les huit migrations dans le bon ordre. Il est
--  RÉEXÉCUTABLE : si vous en avez déjà passé une partie, relancez-le
--  entièrement, ce qui existe déjà sera simplement ignoré.
--
--  Il ne supprime aucune donnée et ne modifie aucune colonne existante.
--
--  CE QU'IL AJOUTE, DANS L'ORDRE
--    1. BILLETTERIE — offres de billets par match, réservations
--    2. MON ESPACE — comptes clients, vue de leurs réservations
--    3. RECRUTEMENT — statuts de candidature, documents, journal
--    4. COMMANDES & CLIENTS — fiches clients, historique de statut
--    5. MATCH CENTER — quarts-temps, feuille de match, vue match_center
--    6. EFFECTIF & STOCK — statut des joueuses, stock par taille
--    7. BANNIÈRES — slider de l'accueil, bandeau d'annonce
--    8. E-MAIL & EXPIRATION — confirmation par e-mail, expiration automatique
--
--  APRÈS L'EXÉCUTION
--    Un message vert « Success » signifie que tout s'est bien passé.
--    Rechargez l'admin (Ctrl+Maj+R).
-- =====================================================================



-- #####################################################################
-- ##  ÉTAPE 1 / 8 — BILLETTERIE — offres de billets par match, réservations
-- #####################################################################

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



-- #####################################################################
-- ##  ÉTAPE 2 / 8 — MON ESPACE — comptes clients, vue de leurs réservations
-- #####################################################################

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



-- #####################################################################
-- ##  ÉTAPE 3 / 8 — RECRUTEMENT — statuts de candidature, documents, journal
-- #####################################################################

alter table recruitment_requests
  add column if not exists updated_at    timestamptz,
  add column if not exists assigned_to   text,        -- qui suit le dossier
  add column if not exists interview_at  timestamptz, -- entretien programmé
  add column if not exists decision_note text;        -- motif de la décision

-- Mise à jour automatique de updated_at à chaque modification.
create or replace function bbc_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists recruitment_touch on recruitment_requests;
create trigger recruitment_touch
  before update on recruitment_requests
  for each row execute function bbc_touch_updated_at();


-- =====================================================================
-- 2. NOUVEAU CYCLE DE VIE
--    Ancien : nouvelle · preselection · convoquee · retenue · refusee
--    Nouveau : nouvelle · a_etudier · a_revoir · entretien · en_attente
--              · acceptee · refusee · archivee
--    On reprend les valeurs existantes pour ne perdre aucun dossier.
-- =====================================================================
update recruitment_requests set status = 'a_etudier' where status = 'preselection';
update recruitment_requests set status = 'entretien'  where status = 'convoquee';
update recruitment_requests set status = 'acceptee'   where status = 'retenue';
update recruitment_requests set status = 'refusee'    where status = 'refusee';
update recruitment_requests set status = 'nouvelle'   where status is null or status = '';

-- Filet de sécurité : toute valeur héritée ou saisie à la main qui ne fait
-- pas partie du nouveau cycle est ramenée à « nouvelle ». Sans cette ligne,
-- la contrainte ci-dessous échouerait et annulerait tout le script.
update recruitment_requests set status = 'nouvelle'
 where status not in (
   'nouvelle','a_etudier','a_revoir','entretien','en_attente',
   'acceptee','refusee','archivee'
 );

-- Garde-fou : on refuse une valeur de statut inconnue, pour éviter que
-- l'espace de gestion et la base divergent silencieusement.
alter table recruitment_requests drop constraint if exists recruitment_status_check;
alter table recruitment_requests
  add constraint recruitment_status_check check (status in (
    'nouvelle','a_etudier','a_revoir','entretien','en_attente',
    'acceptee','refusee','archivee'
  ));

alter table recruitment_requests
  alter column status set default 'nouvelle';

create index if not exists recruitment_status_idx on recruitment_requests (status);


-- =====================================================================
-- 3. JOURNAL DU DOSSIER
--    Chaque changement de statut et chaque note laissent une trace.
--    C'est ce qui permet de travailler à plusieurs sur un recrutement.
-- =====================================================================
create table if not exists recruitment_events (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references recruitment_requests(id) on delete cascade,
  kind        text not null check (kind in ('statut','note','entretien','document','creation')),
  from_status text,
  to_status   text,
  body        text,
  author      text,
  created_at  timestamptz not null default now()
);

create index if not exists recruitment_events_request_idx
  on recruitment_events (request_id, created_at desc);

alter table recruitment_events enable row level security;

drop policy if exists recruitment_events_admin_all on recruitment_events;
create policy recruitment_events_admin_all on recruitment_events
  for all using (is_admin()) with check (is_admin());


-- =====================================================================
-- 4. PIÈCES JOINTES
--    CV, certificat médical, licence, vidéos. Les fichiers vivent dans le
--    bucket site-media ; cette table garde l'inventaire et le libellé.
-- =====================================================================
create table if not exists recruitment_documents (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references recruitment_requests(id) on delete cascade,
  label      text not null,
  url        text not null,
  kind       text default 'autre'
             check (kind in ('cv','medical','licence','video','photo','autre')),
  created_at timestamptz not null default now()
);

create index if not exists recruitment_documents_request_idx
  on recruitment_documents (request_id);

alter table recruitment_documents enable row level security;

drop policy if exists recruitment_documents_admin_all on recruitment_documents;
create policy recruitment_documents_admin_all on recruitment_documents
  for all using (is_admin()) with check (is_admin());

-- PAS de policy d'insertion publique ici. Le formulaire de candidature du site
-- n'envoie aucun document pour l'instant : ouvrir l'écriture en anonyme
-- permettrait à n'importe quel visiteur d'attacher un lien arbitraire au
-- dossier d'une vraie candidate, sous une étiquette de confiance (« CV »).
-- Le jour où le formulaire collectera un CV, ce dépôt passera par une fonction
-- security definer qui vérifie le dossier visé — comme bbc_reserver() pour la
-- billetterie — et non par une policy à WITH CHECK (true).
-- La policy admin ci-dessus couvre tous les appelants existants.


-- =====================================================================
-- 5. CHANGER UN STATUT — passe toujours par ici, pour que le journal
--    soit écrit dans la même transaction que le changement.
-- =====================================================================
create or replace function bbc_recrutement_statut(
  p_request_id uuid,
  p_status     text,
  p_note       text default null,
  p_author     text default null
)
returns recruitment_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row  recruitment_requests%rowtype;
  v_from text;
begin
  if not is_admin() then raise exception 'non_autorise'; end if;

  select status into v_from from recruitment_requests where id = p_request_id;
  if not found then raise exception 'candidature_introuvable'; end if;

  update recruitment_requests
     set status = p_status,
         decision_note = coalesce(p_note, decision_note)
   where id = p_request_id
   returning * into v_row;

  insert into recruitment_events (request_id, kind, from_status, to_status, body, author)
  values (p_request_id, 'statut', v_from, p_status, p_note, p_author);

  return v_row;
end;
$$;

revoke all on function bbc_recrutement_statut(uuid, text, text, text) from public;
grant execute on function bbc_recrutement_statut(uuid, text, text, text) to authenticated;


-- =====================================================================
-- 6. VUE DE TRAVAIL — une ligne par candidature, enrichie de ce qui
--    est utile dans la liste sans avoir à ouvrir chaque dossier.
-- =====================================================================
create or replace view candidatures_admin as
select
  r.*,
  trim(coalesce(r.first_name,'') || ' ' || coalesce(r.last_name,'')) as full_name,
  case when r.birth_date is not null
       then extract(year from age(r.birth_date))::int end            as age,
  (select count(*) from recruitment_documents d where d.request_id = r.id) as nb_documents,
  (select count(*) from recruitment_events  e where e.request_id = r.id)   as nb_events,
  (select max(e.created_at) from recruitment_events e where e.request_id = r.id) as last_event_at,
  extract(epoch from (now() - r.created_at)) / 86400                  as jours_depuis_reception
from recruitment_requests r;

alter view candidatures_admin set (security_invoker = on);


-- =====================================================================
--  OPTIONNEL — ALERTE E-MAIL À L'ARRIVÉE D'UNE CANDIDATURE
--  Ne se fait pas en SQL pur. Deux minutes dans l'interface Supabase :
--    Database → Webhooks → Create a new hook
--      Table  : recruitment_requests
--      Events : Insert
--      Type   : HTTP Request (ou Send email via une fonction Edge)
--  Renseignez l'adresse du bureau comme destinataire.
--  Sans ça, un dossier peut dormir plusieurs semaines.
-- =====================================================================


-- =====================================================================
--  Vérification après exécution :
--    select status, count(*) from recruitment_requests group by status;
--    select * from candidatures_admin order by created_at desc limit 5;
-- =====================================================================



-- #####################################################################
-- ##  ÉTAPE 4 / 8 — COMMANDES & CLIENTS — fiches clients, historique de statut
-- #####################################################################

alter table orders
  add column if not exists internal_note text,
  add column if not exists paid          boolean not null default false,
  add column if not exists prepared_at   timestamptz;

create index if not exists orders_status_idx  on orders (status);
create index if not exists orders_created_idx on orders (created_at desc);


-- =====================================================================
-- 2. NUMÉRO DE COMMANDE LISIBLE
--    « CMD-0042 » plutôt qu'un identifiant technique : c'est ce numéro
--    qu'on annonce au client au téléphone.
-- =====================================================================
create sequence if not exists orders_number_seq start 1;

create or replace function bbc_order_number()
returns trigger language plpgsql as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := 'CMD-' || lpad(nextval('orders_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists orders_number on orders;
create trigger orders_number
  before insert on orders
  for each row execute function bbc_order_number();

-- Rattrapage des commandes déjà passées, dans l'ordre chronologique.
do $$
declare rec record;
begin
  for rec in
    select id from orders
     where order_number is null or order_number = ''
     order by created_at asc
  loop
    update orders
       set order_number = 'CMD-' || lpad(nextval('orders_number_seq')::text, 4, '0')
     where id = rec.id;
  end loop;
end $$;


-- =====================================================================
-- 3. ACCÈS ADMINISTRATEUR AUX CLIENTS
--    La table customers existait depuis le lot 1, mais seul le client
--    lui-même pouvait voir sa fiche : l'espace de gestion n'affichait
--    donc aucun client. C'est ce qui manquait.
-- =====================================================================
alter table customers add column if not exists internal_note text;

alter table customers enable row level security;

drop policy if exists customers_admin_read on customers;
create policy customers_admin_read on customers
  for select using (user_id = auth.uid() or is_admin());

drop policy if exists customers_admin_write on customers;
create policy customers_admin_write on customers
  for update using (is_admin()) with check (is_admin());


-- =====================================================================
-- 4. VUE CLIENTS — la fiche à 360°, calculée plutôt que saisie
--    « user_id as id » : l'espace de gestion garde une seule convention.
-- =====================================================================
drop view if exists clients_admin;

create view clients_admin as
select
  c.user_id as id,
  c.name,
  c.phone,
  c.internal_note,
  c.created_at,
  u.email,
  (select count(*) from orders o where o.customer_id = c.user_id)                   as nb_commandes,
  (select coalesce(sum(o.total),0) from orders o
     where o.customer_id = c.user_id and coalesce(o.status,'') <> 'annulée')        as total_depense,
  (select max(o.created_at) from orders o where o.customer_id = c.user_id)          as derniere_commande,
  (select count(*) from reservations r
     where r.customer_id = c.user_id and r.status = 'reservee')                     as reservations_actives,
  (select count(*) from reservations r where r.customer_id = c.user_id)             as nb_reservations
from customers c
left join auth.users u on u.id = c.user_id;

alter view clients_admin set (security_invoker = on);


-- =====================================================================
-- 5. VUE COMMANDES — évite de recalculer côté navigateur
-- =====================================================================
drop view if exists commandes_admin;

create view commandes_admin as
select
  o.*,
  c.name as compte_nom,
  (select count(*) from orders o2
     where o2.customer_id = o.customer_id and o.customer_id is not null) as commandes_du_client,
  extract(epoch from (now() - o.created_at)) / 3600                      as heures_depuis_reception
from orders o
left join customers c on c.user_id = o.customer_id;

alter view commandes_admin set (security_invoker = on);


-- =====================================================================
--  Vérification après exécution :
--    select order_number, status, total from orders order by created_at;
--    select name, email, nb_commandes, total_depense from clients_admin;
--
--  IMPORTANT — testez la boutique juste après :
--    passez une commande sans être connecté, puis une connecté.
--    Les deux doivent aboutir et recevoir un numéro CMD-xxxx.
-- =====================================================================



-- #####################################################################
-- ##  ÉTAPE 5 / 8 — MATCH CENTER — quarts-temps, feuille de match, vue match_center
-- #####################################################################

alter table matches
  add column if not exists quarters jsonb not null default '[]'::jsonb;


-- =====================================================================
-- 2. FEUILLE DE MATCH
-- =====================================================================
alter table matches
  add column if not exists referees    text,     -- arbitres désignés
  add column if not exists attendance  integer,  -- affluence constatée
  add column if not exists round_label text,     -- « Journée 7 », « Quart de finale »
  add column if not exists recap       text;     -- résumé d'après-match

create index if not exists matches_date_idx on matches (match_date);


-- =====================================================================
-- 3. VUE MATCH CENTER
--    Le match, plus l'état de sa billetterie : une seule lecture au lieu
--    de deux requêtes recomposées côté navigateur.
--    « statut » est déduit des données, jamais saisi à la main.
--
--    Le drop est indispensable : voir le correctif en tête de fichier.
-- =====================================================================
drop view if exists match_center;

create view match_center as
select
  m.*,
  coalesce(o.nb_categories,   0)     as nb_categories,
  coalesce(o.places_totales,  0)     as places_totales,
  coalesce(o.places_reservees, 0)    as places_reservees,
  coalesce(o.places_restantes, 0)    as places_restantes,
  coalesce(o.vente_ouverte,   false) as vente_ouverte,
  case
    when m.score_baobabs is not null and m.score_opponent is not null then 'termine'
    when m.match_date < current_date then 'a_saisir'
    when m.match_date = current_date then 'aujourdhui'
    else 'a_venir'
  end as statut,
  case
    when m.score_baobabs is null or m.score_opponent is null then null
    when m.score_baobabs > m.score_opponent then 'V'
    when m.score_baobabs < m.score_opponent then 'D'
    else 'N'
  end as issue
from matches m
left join (
  select
    match_id,
    count(*)                       as nb_categories,
    sum(quota)                     as places_totales,
    sum(sold)                      as places_reservees,
    sum(greatest(quota - sold, 0)) as places_restantes,
    bool_or(is_open)               as vente_ouverte
  from ticket_offers
  group by match_id
) o on o.match_id = m.id;

alter view match_center set (security_invoker = on);


-- =====================================================================
--  Vérification après exécution :
--    select opponent_name, match_date, statut, issue, vente_ouverte
--      from match_center order by match_date desc limit 10;
--
--  Si la vue échoue sur ticket_offers, c'est que
--  MIGRATION-billetterie.sql n'a pas encore été passée.
-- =====================================================================



-- #####################################################################
-- ##  ÉTAPE 6 / 8 — EFFECTIF & STOCK — statut des joueuses, stock par taille
-- #####################################################################

alter table players
  add column if not exists status      text not null default 'active',
  add column if not exists joined_at   date,
  add column if not exists weight      text,
  add column if not exists nationality text,
  add column if not exists instagram   text,
  add column if not exists previous_club text,
  add column if not exists injury_note text,   -- nature et retour prévu
  -- Statistiques de la saison. En JSON : le format évoluera (tirs primés,
  -- minutes, évaluation) sans nouvelle migration à chaque ajout.
  add column if not exists stats jsonb not null default '{}'::jsonb;

create index if not exists players_status_idx on players (status);


-- =====================================================================
-- 2. STOCK PAR TAILLE
--    in_stock (booléen) ne disait pas COMBIEN, ni dans quelle taille.
--    Résultat : un maillot annoncé disponible mais épuisé en L.
--    Forme de stock : {"S":4,"M":0,"L":7,"XL":2}
-- =====================================================================
alter table products
  add column if not exists stock       jsonb not null default '{}'::jsonb,
  add column if not exists stock_alert integer not null default 3,  -- seuil « stock bas »
  add column if not exists sku         text,
  add column if not exists cost_fcfa   integer,   -- prix d'achat, pour la marge
  add column if not exists track_stock boolean not null default false;

create index if not exists products_stock_idx on products (track_stock);


-- =====================================================================
-- 3. SYNCHRONISATION AUTOMATIQUE DE in_stock
--    Le site public lit in_stock. Plutôt que de le modifier à la main en
--    plus des quantités — et de l'oublier — on le déduit du stock.
--    Un produit non suivi garde le in_stock que vous réglez vous-même.
-- =====================================================================
create or replace function bbc_sync_in_stock()
returns trigger language plpgsql as $$
declare total integer;
begin
  if new.track_stock then
    select coalesce(sum((value)::integer), 0)
      into total
      from jsonb_each_text(coalesce(new.stock, '{}'::jsonb));
    new.in_stock := (total > 0);
  end if;
  return new;
end;
$$;

drop trigger if exists products_sync_stock on products;
create trigger products_sync_stock
  before insert or update on products
  for each row execute function bbc_sync_in_stock();


-- =====================================================================
-- 4. VUE EFFECTIF
-- =====================================================================
drop view if exists effectif_admin;

create view effectif_admin as
select
  p.*,
  case when p.birth_year is not null
       then extract(year from current_date)::integer - p.birth_year
       else null end as age,
  (p.stats->>'points')::numeric   as pts,
  (p.stats->>'rebonds')::numeric  as reb,
  (p.stats->>'passes')::numeric   as ast,
  (p.stats->>'matchs')::integer   as matchs_joues
from players p;

alter view effectif_admin set (security_invoker = on);


-- =====================================================================
-- 5. VUE PRODUITS
--    Le total et la taille en rupture sont calculés ici : côté navigateur,
--    il faudrait parcourir le JSON de chaque produit à chaque affichage.
-- =====================================================================
drop view if exists produits_admin;

create view produits_admin as
select
  p.*,
  coalesce(s.total, 0) as stock_total,
  s.ruptures,
  case
    when not p.track_stock              then 'non_suivi'
    when coalesce(s.total, 0) = 0       then 'epuise'
    when coalesce(s.total, 0) <= p.stock_alert then 'bas'
    else 'ok'
  end as etat_stock,
  case when p.price is not null and p.cost_fcfa is not null and p.cost_fcfa > 0
       then p.price - p.cost_fcfa else null end as marge_fcfa
from products p
left join (
  select
    id,
    sum(qty) as total,
    -- Les tailles à zéro, listées pour l'alerte « épuisé en L »
    string_agg(size, ', ' order by size) filter (where qty = 0) as ruptures
  from (
    select p2.id, e.key as size, (e.value)::integer as qty
    from products p2, jsonb_each_text(coalesce(p2.stock, '{}'::jsonb)) e
  ) x
  group by id
) s on s.id = p.id;

alter view produits_admin set (security_invoker = on);


-- =====================================================================
--  Vérification après exécution :
--    select name, status, joined_at, stats from players order by sort;
--    select name, track_stock, stock, stock_total, etat_stock, ruptures
--      from produits_admin order by sort;
--
--  À savoir : le suivi de stock est DÉSACTIVÉ par défaut sur vos produits
--  existants (track_stock = false), donc rien ne change tant que vous ne
--  l'activez pas produit par produit.
-- =====================================================================



-- #####################################################################
-- ##  ÉTAPE 7 / 8 — BANNIÈRES — slider de l'accueil, bandeau d'annonce
-- #####################################################################

create table if not exists banners (
  id          uuid primary key default gen_random_uuid(),
  title       text,
  subtitle    text,
  kicker      text,                       -- la sur-titre en petites capitales
  image_url   text,
  image_alt   text,
  cta_label   text,
  cta_href    text,
  title_color    text,
  subtitle_color text,
  -- Cadrage : la même image ne se recadre pas pareil selon le sujet.
  focus_x     integer default 50,
  focus_y     integer default 50,
  zoom        integer default 100,
  is_active   boolean not null default false,
  starts_at   timestamptz,
  ends_at     timestamptz,
  sort        integer default 0,
  created_at  timestamptz not null default now()
);

alter table banners enable row level security;

drop policy if exists banners_read on banners;
create policy banners_read on banners
  for select using (true);

drop policy if exists banners_write on banners;
create policy banners_write on banners
  for all using (is_admin()) with check (is_admin());

create index if not exists banners_active_idx on banners (is_active, sort);


-- =====================================================================
-- 2. BANDEAU D'ANNONCE
--    Une seule ligne active à la fois : un bandeau qui en annonce deux
--    n'annonce rien. Le déclencheur ci-dessous le garantit.
-- =====================================================================
create table if not exists announcements (
  id         uuid primary key default gen_random_uuid(),
  message    text not null,
  cta_label  text,
  cta_href   text,
  tone       text not null default 'info',   -- 'info' | 'alerte' | 'succes'
  is_active  boolean not null default false,
  starts_at  timestamptz,
  ends_at    timestamptz,
  created_at timestamptz not null default now()
);

alter table announcements enable row level security;

drop policy if exists announcements_read on announcements;
create policy announcements_read on announcements
  for select using (true);

drop policy if exists announcements_write on announcements;
create policy announcements_write on announcements
  for all using (is_admin()) with check (is_admin());

-- Activer une annonce désactive les autres : plutôt que de compter sur
-- l'utilisateur pour le faire, la base s'en charge.
create or replace function bbc_one_announcement()
returns trigger language plpgsql as $$
begin
  if new.is_active then
    update announcements set is_active = false
     where id is distinct from new.id and is_active;
  end if;
  return new;
end;
$$;

drop trigger if exists announcements_single on announcements;
create trigger announcements_single
  after insert or update of is_active on announcements
  for each row when (new.is_active) execute function bbc_one_announcement();


-- =====================================================================
-- 3. VUES PUBLIQUES
--    « en ligne aujourd'hui » est calculé ici : le site n'a pas à
--    comparer des dates, et une bannière programmée s'affiche d'elle-même.
-- =====================================================================
drop view if exists banners_public;

create view banners_public as
select *
from banners
where is_active
  and (starts_at is null or starts_at <= now())
  and (ends_at   is null or ends_at   >= now())
order by sort asc, created_at asc;

alter view banners_public set (security_invoker = on);

drop view if exists announcement_public;

create view announcement_public as
select *
from announcements
where is_active
  and (starts_at is null or starts_at <= now())
  and (ends_at   is null or ends_at   >= now())
order by created_at desc
limit 1;

alter view announcement_public set (security_invoker = on);


-- =====================================================================
--  Vérification après exécution :
--    select title, is_active, starts_at, ends_at, sort from banners order by sort;
--    select * from banners_public;
--    select message, tone from announcement_public;
--
--  Les deux tables démarrent VIDES : le site continue d'afficher l'image
--  du hero telle que vous l'avez réglée, et aucun bandeau n'apparaît.
-- =====================================================================



-- #####################################################################
-- ##  ÉTAPE 8 / 8 — E-MAIL & EXPIRATION — confirmation par e-mail, expiration automatique
-- #####################################################################

alter table reservations
  add column if not exists confirmation_email_sent timestamptz;

-- Délai de retrait optionnel (en heures). NULL = désactivé : une
-- réservation tient jusqu'au match. C'est une décision de politique du
-- club, pas un réglage technique — d'où le défaut prudent.
alter table site_settings
  add column if not exists tk_hold_hours integer;


-- =====================================================================
-- 2. EXPIRATION AUTOMATIQUE
--    Deux règles, distinctes parce qu'elles ne libèrent pas les places
--    de la même façon :
--
--    a) Match passé : une réservation jamais retirée passe « expirée ».
--       Les compteurs de vente ne bougent pas — la vente est finie, les
--       chiffres restent l'histoire vraie de ce match.
--
--    b) Délai de retrait (si tk_hold_hours est renseigné) : une
--       réservation trop ancienne pour un match ENCORE À VENIR expire
--       et ses places repartent dans le quota, comme une annulation.
-- =====================================================================
create or replace function bbc_expirer_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n_past integer := 0;
  n_hold integer := 0;
  v_hold integer;
  r record;
begin
  -- a) Matchs passés : simple bascule de statut.
  update reservations res
     set status = 'expiree'
    from matches m
   where m.id = res.match_id
     and res.status = 'reservee'
     and m.match_date is not null
     and m.match_date < current_date;
  get diagnostics n_past = row_count;

  -- b) Délai de retrait, seulement si le club l'a activé.
  select tk_hold_hours into v_hold from site_settings limit 1;
  if v_hold is not null and v_hold > 0 then
    for r in
      select res.id, res.offer_id, res.quantity
        from reservations res
        join matches m on m.id = res.match_id
       where res.status = 'reservee'
         and res.created_at < now() - make_interval(hours => v_hold)
         and (m.match_date is null or m.match_date >= current_date)
    loop
      update reservations set status = 'expiree' where id = r.id and status = 'reservee';
      -- Les places repartent en vente : c'est tout l'intérêt du délai.
      update ticket_offers set sold = greatest(sold - r.quantity, 0) where id = r.offer_id;
      n_hold := n_hold + 1;
    end loop;
  end if;

  return n_past + n_hold;
end;
$$;

-- Fonction interne : personne n'a à l'appeler depuis le site.
revoke all on function bbc_expirer_reservations() from public;
revoke all on function bbc_expirer_reservations() from anon;
revoke all on function bbc_expirer_reservations() from authenticated;


-- =====================================================================
-- 3. TÂCHE HORAIRE
--    pg_cron exécute l'expiration toutes les heures. Si l'extension
--    n'est pas disponible, la migration N'ÉCHOUE PAS : un avis s'affiche
--    et tout le reste est en place.
-- =====================================================================
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron indisponible sur ce projet : l''expiration automatique n''est pas planifiée.';
    return;
  end;
  begin
    perform cron.unschedule('bbc-expiration-reservations');
  exception when others then null;  -- pas encore planifiée : normal au premier passage
  end;
  perform cron.schedule('bbc-expiration-reservations', '12 * * * *', 'select bbc_expirer_reservations()');
end;
$$;


-- =====================================================================
--  Vérification après exécution :
--    select bbc_expirer_reservations();   -- exécute une passe à la main
--    select jobname, schedule from cron.job;
--
--  Pour activer le délai de retrait (exemple : 72 h) :
--    update site_settings set tk_hold_hours = 72;
--  Pour le désactiver :
--    update site_settings set tk_hold_hours = null;
-- =====================================================================


-- =====================================================================
--  FIN. Rien d'autre à exécuter.
--  L'e-mail de confirmation demande en plus une fonction serveur :
--  suivez NOTICE-EMAIL.txt (10 minutes, une seule fois).
-- =====================================================================
