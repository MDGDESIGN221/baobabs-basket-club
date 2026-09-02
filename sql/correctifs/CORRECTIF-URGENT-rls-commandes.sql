-- =====================================================================
--  Baobabs Basket Club — CORRECTIF DE SÉCURITÉ, À PASSER EN PREMIER
--  Table orders (commandes de la boutique) — 17 août 2026
--
--  CE QUI A ÉTÉ CONSTATÉ, ET VÉRIFIÉ
--  La table orders porte trois politiques héritées, sans restriction de
--  rôle — elles s'appliquent donc à PUBLIC, c'est-à-dire à quiconque
--  possède la clé publique du site, laquelle est écrite en clair dans
--  index.html :
--
--      « auth select orders »   SELECT  qual = true
--      « auth update orders »   UPDATE  qual = true
--      « auth delete orders »   DELETE  qual = true
--
--  Vérifié depuis l'extérieur avec la seule clé publique, sur un filtre
--  volontairement impossible pour ne rien modifier :
--      PATCH  /orders → 204
--      DELETE /orders → 204
--
--  Autrement dit : n'importe qui peut lire toutes les commandes (nom,
--  téléphone, adresse, montant), les modifier, et les SUPPRIMER TOUTES
--  en une requête.
--
--  POURQUOI RIEN N'EST ENCORE ARRIVÉ
--  La table est vide : la boutique n'a pas encore pris de commande.
--  Rien n'a fuité, rien ne peut être perdu aujourd'hui. Mais la
--  première commande enregistrée sera publique et destructible.
--  C'est donc à corriger AVANT d'ouvrir la boutique, pas après.
--
--  CE QUE FAIT CE SCRIPT
--  Il retire les trois politiques permissives et le doublon d'insertion,
--  et laisse en place exactement ce qu'il faut : le site dépose une
--  commande, le client relit les siennes, l'administration gère tout.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. RETRAIT DES POLITIQUES PERMISSIVES
--    Les noms sont repris tels quels de pg_policies.
-- ---------------------------------------------------------------------
drop policy if exists "auth select orders" on orders;
drop policy if exists "auth update orders" on orders;
drop policy if exists "auth delete orders" on orders;

-- Doublon d'insertion : « public insert orders » accepte n'importe quel
-- customer_id, y compris celui d'un autre client. « orders_public_insert »
-- fait le même travail en exigeant que la commande soit anonyme ou
-- rattachée à soi-même. On garde le second.
drop policy if exists "public insert orders" on orders;


-- ---------------------------------------------------------------------
-- 2. CE QUI RESTE, ET QUI SUFFIT
--    On ne recrée que ce qui manque : orders_public_insert et
--    orders_own_read existent déjà et sont corrects.
-- ---------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='orders' and policyname='orders_public_insert') then
    execute 'create policy orders_public_insert on orders for insert
             with check (customer_id is null or customer_id = auth.uid())';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='orders' and policyname='orders_own_read') then
    execute 'create policy orders_own_read on orders for select
             using (customer_id = auth.uid() or is_admin())';
  end if;
end $$;

-- L'administration : on remplace le « tout ou rien » par le rôle.
-- La lecture reste couverte par orders_own_read, qui inclut is_admin().
drop policy if exists orders_admin_all on orders;
create policy orders_admin_modifier on orders
  for update using (bbc_can('boutique','modifier')) with check (bbc_can('boutique','modifier'));
create policy orders_admin_supprimer on orders
  for delete using (bbc_can('boutique','supprimer'));


-- ---------------------------------------------------------------------
-- 3. LES DEUX AUTRES TABLES CLIENT, MAINTENANT QUE JE VOIS LEURS RÈGLES
--    Les politiques « own » sont conservées telles quelles : ce sont
--    elles qui font vivre « Mon espace ». Seules les politiques
--    d'administration passent au rôle.
-- ---------------------------------------------------------------------

-- customers : « customers read own », « customers insert own » et
-- « customers update own » restent intactes.
drop policy if exists customers_admin_read  on customers;
drop policy if exists customers_admin_write on customers;
create policy customers_admin_read on customers
  for select using (user_id = auth.uid() or bbc_can('boutique','voir'));
create policy customers_admin_write on customers
  for update using (bbc_can('boutique','modifier')) with check (bbc_can('boutique','modifier'));

-- reservations : « reservations_own_read » reste intacte.
-- Aucune politique d'insertion publique : les réservations passent par
-- bbc_reserver(), qui est « security definer ». C'était déjà juste.
drop policy if exists reservations_admin_all on reservations;
create policy reservations_admin_modifier on reservations
  for update using (bbc_can('billetterie','modifier')) with check (bbc_can('billetterie','modifier'));
create policy reservations_admin_supprimer on reservations
  for delete using (bbc_can('billetterie','supprimer'));
create policy reservations_admin_creer on reservations
  for insert with check (bbc_can('billetterie','creer'));

-- ticket_offers : la lecture publique filtrée sur is_open est correcte,
-- c'est elle qui alimente la billetterie du site. On n'y touche pas.
drop policy if exists ticket_offers_admin_all on ticket_offers;
create policy ticket_offers_admin_ecriture on ticket_offers
  for all using (bbc_can('billetterie','modifier')) with check (bbc_can('billetterie','modifier'));

-- favorites : « favorites_own_all » est déjà correcte — chacun ne voit
-- que ses propres favoris, et l'administration n'a rien à y faire.


-- =====================================================================
--  VÉRIFICATIONS
--
--  a) LE TROU EST BOUCHÉ — les deux doivent répondre 401 ou 403,
--     plus jamais 204 :
--       curl -s -o /dev/null -w "%{http_code}\n" -X DELETE \
--         "https://lmwbwasupqkvswukieav.supabase.co/rest/v1/orders?id=eq.00000000-0000-0000-0000-000000000000" \
--         -H "apikey: sb_publishable_68RKprorqTmVkzjHrKgdZw_h-AcMXRh"
--
--  b) LE SITE MARCHE TOUJOURS : passez une commande de test depuis la
--     boutique, puis ouvrez « Mon espace » avec un compte client et
--     vérifiez que la commande et les billets s'affichent.
--
--  c) L'ADMINISTRATION MARCHE TOUJOURS : écran Commandes, écran Clients,
--     écran Billetterie.
--
--  d) Plus aucune politique ne doit avoir qual = true :
--       select tablename, policyname, cmd, qual from pg_policies
--        where schemaname='public' and (qual = 'true' or with_check = 'true')
--        order by tablename;
--     Les seules lignes acceptables sont les dépôts publics volontaires
--     (contact_messages, newsletter_subscribers, recruitment_requests),
--     et uniquement en INSERT.
-- =====================================================================
