-- =====================================================================
--  Baobabs Basket Club — Correctif : la LECTURE de l'argent au rôle
--  17 août 2026 — à passer après CORRECTIF-URGENT-rls-commandes.sql
--  Idempotent. Aucune donnée supprimée.
--
--  CE QUI MANQUAIT DANS MON CORRECTIF PRÉCÉDENT
--  J'ai remplacé les politiques d'écriture de orders et reservations par
--  des règles au rôle, mais j'ai laissé leur LECTURE reposer sur deux
--  politiques préexistantes :
--
--      orders_own_read        (customer_id = auth.uid() OR is_admin())
--      reservations_own_read  (customer_id = auth.uid() OR is_admin())
--
--  is_admin() répond oui à TOUT compte de admin_users, quel que soit son
--  rôle. Un coach ne voit donc pas l'entrée Commandes dans le menu, mais
--  peut lire toutes les commandes et toutes les réservations en
--  interrogeant l'API avec son propre compte. La porte du couloir est
--  fermée, celle de derrière ne l'est pas.
--
--  On garde évidemment la moitié client de la règle : chacun continue de
--  relire ses propres commandes et ses propres billets dans « Mon
--  espace ». C'est seulement le « OR is_admin() » qui devient un
--  « OR bbc_can(...) ».
-- =====================================================================

drop policy if exists orders_own_read on orders;
create policy orders_own_read on orders
  for select using (customer_id = auth.uid() or bbc_can('boutique','voir'));

drop policy if exists reservations_own_read on reservations;
create policy reservations_own_read on reservations
  for select using (customer_id = auth.uid() or bbc_can('billetterie','voir'));

-- Les catégories de billets fermées ne regardent que la billetterie.
-- La lecture publique reste filtrée sur is_open : c'est elle qui
-- alimente la page du site, elle ne change pas.
drop policy if exists ticket_offers_public_read on ticket_offers;
create policy ticket_offers_public_read on ticket_offers
  for select using (is_open or bbc_can('billetterie','voir'));


-- =====================================================================
--  LE TEST QUI PROUVE — et il n'y en a pas d'autre
--
--  Aucune sonde anonyme ne peut valider ceci : avec RLS, Postgres filtre
--  en silence, il ne refuse pas bruyamment. Un refus de politique et une
--  requête qui ne ramène rien se ressemblent exactement vues de
--  l'extérieur.
--
--  La seule preuve est un vrai compte du rôle concerné :
--
--    1. Écran Comptes & rôles → passez un compte en « Coach ».
--    2. Connectez-vous avec ce compte.
--    3. Dans la console du navigateur, sur le site :
--
--       fetch('https://lmwbwasupqkvswukieav.supabase.co/rest/v1/orders?select=id',
--         { headers: { apikey:'sb_publishable_68RKprorqTmVkzjHrKgdZw_h-AcMXRh',
--                      Authorization:'Bearer ' + JSON.parse(
--                        localStorage.getItem('bbc-admin-auth')).access_token } })
--         .then(r=>r.json()).then(console.log)
--
--    Doit renvoyer []. Avec un compte super administrateur, la même
--    requête doit renvoyer les commandes.
--
--    Si le coach voit les commandes, c'est que la politique n'a pas
--    pris — et aucune autre vérification ne vous l'aurait appris.
-- =====================================================================
