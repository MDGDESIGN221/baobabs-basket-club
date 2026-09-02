-- =====================================================================
--  Baobabs Basket Club — CORRECTIF : l'écran Clients renvoie 403
--  20 août 2026
--
--  LE SYMPTÔME
--  Ouvrir « Clients » ne charge rien, quel que soit le compte, même
--  super administrateur. La requête clients_admin répond :
--      403 — permission denied for table users  (code 42501)
--
--  LA CAUSE
--  clients_admin joint auth.users pour récupérer l'e-mail, et la vue est
--  déclarée « security_invoker = on » : les droits appliqués sont donc
--  ceux de l'appelant. Or le rôle « authenticated » n'a aucun droit de
--  lecture sur auth.users — et c'est une bonne chose.
--
--  ⚠ NE SUIVEZ PAS LE CONSEIL DE POSTGRES ⚠
--  Le message d'erreur souffle :
--      GRANT SELECT ON auth.users TO authenticated;
--  Il ne faut surtout pas. auth.users contient encrypted_password, les
--  jetons de récupération et les jetons de confirmation. Ce GRANT les
--  rendrait lisibles, via l'API REST, par n'importe quel compte client
--  connecté depuis index.html. On réglerait un écran d'administration en
--  ouvrant la boîte aux lettres de tout le monde.
--
--  LA SOLUTION RETENUE
--  La vue garde security_invoker (donc le RLS de customers continue de
--  s'appliquer normalement), et l'e-mail passe par une petite fonction
--  « security definer » qui ne sait faire qu'une chose : rendre l'e-mail
--  d'un utilisateur, et seulement à quelqu'un qui a le droit de voir la
--  boutique. Une porte étroite plutôt qu'un mur abattu.
--
--  À exécuter dans Supabase : SQL Editor → New query → Run.
--  Idempotent.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. La porte étroite : un e-mail, et rien d'autre.
--    Le garde bbc_can('boutique','voir') est dans la fonction elle-même :
--    security definer sans contrôle d'accès, c'est un trou.
-- ---------------------------------------------------------------------
create or replace function bbc_email_utilisateur(p_uid uuid)
returns text
language sql
security definer
stable
set search_path = public, auth
as $$
  select case
           when p_uid is null then null
           when bbc_can('boutique','voir') or p_uid = auth.uid()
             then (select u.email from auth.users u where u.id = p_uid)
           else null
         end;
$$;

revoke all on function bbc_email_utilisateur(uuid) from public;
grant execute on function bbc_email_utilisateur(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 2. La vue, sans jointure sur auth.users
--    Mêmes colonnes, même ordre : l'écran d'administration n'a rien à
--    changer.
-- ---------------------------------------------------------------------
drop view if exists clients_admin;

create view clients_admin as
select
  c.user_id as id,
  c.name,
  c.phone,
  c.internal_note,
  c.created_at,
  bbc_email_utilisateur(c.user_id)                                                 as email,
  (select count(*) from orders o where o.customer_id = c.user_id)                   as nb_commandes,
  (select coalesce(sum(o.total),0) from orders o
     where o.customer_id = c.user_id and coalesce(o.status,'') <> 'annulée')        as total_depense,
  (select max(o.created_at) from orders o where o.customer_id = c.user_id)          as derniere_commande,
  (select count(*) from reservations r
     where r.customer_id = c.user_id and r.status = 'reservee')                     as reservations_actives,
  (select count(*) from reservations r where r.customer_id = c.user_id)             as nb_reservations
from customers c;

alter view clients_admin set (security_invoker = on);

grant select on clients_admin to authenticated;


-- ---------------------------------------------------------------------
-- VÉRIFICATION
--   Doit répondre sans erreur. Zéro ligne est un résultat valable :
--   la table customers est vide aujourd'hui.
-- ---------------------------------------------------------------------
select count(*) as nb_clients from clients_admin;


-- =====================================================================
--  À VÉRIFIER ENSUITE, DANS L'ADMIN
--  Ouvrez l'écran « Clients ». Il doit afficher « Aucun client » au lieu
--  de rester muet. Le jour où un compte client sera créé depuis le site,
--  sa ligne apparaîtra avec son e-mail.
--
--  LE MÊME PIÈGE AILLEURS
--  Toute autre vue qui joint auth.users en security_invoker tombera sur
--  le même 403. Pour les recenser :
--
--    select table_name
--      from information_schema.view_table_usage
--     where view_schema = 'public' and table_schema = 'auth';
-- =====================================================================
