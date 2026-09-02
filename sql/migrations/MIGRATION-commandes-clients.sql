-- =====================================================================
--  Baobabs Basket Club — Migration : COMMANDES & CLIENTS  (corrigée)
--  Supabase → SQL Editor → New query → Run. Réexécutable sans risque.
--
--  CORRECTIF : la table customers est identifiée par « user_id », pas
--  par « id » — d'où l'erreur « column "id" does not exist ». La vue
--  expose désormais user_id sous le nom « id » pour que l'espace de
--  gestion n'ait qu'une seule convention à connaître.
--
--  Les vues sont supprimées avant recréation : « create or replace view »
--  refuse tout changement d'ordre ou de nom de colonne, et « o.* » suit
--  les colonnes ajoutées juste au-dessus.
-- =====================================================================


-- =====================================================================
-- 1. COLONNES DE PRÉPARATION
--    order_number, payment_method et status_history existent déjà :
--    « if not exists » les laisse intactes.
-- =====================================================================
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
