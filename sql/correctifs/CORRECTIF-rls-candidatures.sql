-- =====================================================================
--  Baobabs Basket Club — CORRECTIF DE SÉCURITÉ
--  Table recruitment_requests (candidatures des Tryouts)
--  17 août 2026
--
--  CE QUI A ÉTÉ CONSTATÉ
--  Une requête faite avec la clé publique du site — celle qui est écrite
--  en clair dans index.html, donc lisible par tout visiteur — renvoie les
--  candidatures complètes :
--      prénom, nom, date de naissance, téléphone, e-mail,
--      health_notes (antécédents médicaux),
--      admin_notes et decision_note (vos notes internes).
--
--  Autrement dit : n'importe qui sachant lire le code source du site peut
--  télécharger la liste des candidates avec leurs coordonnées et leurs
--  informations de santé. Plusieurs sont mineures.
--
--  Les autres tables ont été sondées de la même façon et sont saines :
--  academy_registrations, academy_payments, contact_messages,
--  newsletter_subscribers, customers, orders → 0 ligne en anonyme.
--
--  CE QUE FAIT CE SCRIPT
--  Il ferme la LECTURE au public tout en gardant l'ÉCRITURE ouverte :
--  le formulaire de candidature du site doit continuer de fonctionner.
--  C'est exactement la même asymétrie que pour une boîte aux lettres —
--  tout le monde peut y glisser une lettre, seul le club l'ouvre.
--
--  Idempotent. Aucune donnée n'est supprimée.
-- =====================================================================

alter table recruitment_requests enable row level security;

-- On ne connaît pas le nom des politiques en place (elles ont pu être
-- créées à la main dans l'interface Supabase) : on les retire toutes,
-- puis on repose les deux seules qui doivent exister.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
     where schemaname = 'public' and tablename = 'recruitment_requests'
  loop
    execute format('drop policy if exists %I on public.recruitment_requests', p.policyname);
  end loop;
end $$;

-- 1. DÉPÔT PUBLIC — le formulaire du site, et rien d'autre.
--    INSERT seul : pas de SELECT, donc impossible de relire ce qu'on
--    vient d'écrire ni ce qu'ont écrit les autres. index.html envoie
--    déjà l'en-tête « Prefer: return=minimal », il n'attend aucune
--    réponse : le formulaire continue de fonctionner tel quel.
create policy recruitment_depot_public on recruitment_requests
  for insert to anon, authenticated
  with check (true);

-- 2. LECTURE ET GESTION — réservées aux comptes de admin_users.
create policy recruitment_admin_all on recruitment_requests
  for all
  using (is_admin())
  with check (is_admin());


-- =====================================================================
--  VÉRIFICATION APRÈS EXÉCUTION
--
--  a) Dans le SQL Editor (vous êtes admin, vous devez voir vos lignes) :
--       select count(*) from recruitment_requests;
--
--  b) Depuis un terminal, en anonyme — doit renvoyer [] :
--       curl -s "https://lmwbwasupqkvswukieav.supabase.co/rest/v1/recruitment_requests?select=*" \
--         -H "apikey: sb_publishable_68RKprorqTmVkzjHrKgdZw_h-AcMXRh"
--
--  c) Rouvrez l'écran Candidatures de l'admin : les dossiers doivent
--     toujours s'afficher, et le formulaire Tryouts du site doit
--     toujours accepter une candidature.
--
--  À FAIRE ENSUITE, HORS SQL
--  Les données ont été exposées pendant une période inconnue. Il n'y a
--  pas de journal d'accès sur la clé publique : impossible de savoir si
--  quelqu'un les a récupérées. Deux candidatures seulement sont
--  concernées à ce jour — le volume rend la situation gérable, mais la
--  décision d'en informer les personnes vous appartient.
-- =====================================================================
