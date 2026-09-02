-- =====================================================================
-- PARTENAIRES RÉELS
-- Remplace les cinq partenaires fictifs (TotalEnergies, Yas, Eiffage,
-- Ecobank, Auchan) par les deux vrais : Man Properties Group et la
-- Commune de Mermoz / Sacré-Cœur.
--
-- À exécuter UNE FOIS dans l'éditeur SQL de Supabase.
-- Les fichiers de logo sont déjà dans le dépôt, servis en statique :
--   /media/img/partenaire-mpg.svg
--   /media/img/partenaire-commune-mermoz-sacre-coeur.webp
-- Rien à téléverser.
-- =====================================================================

begin;

-- 1. On archive avant d'effacer. Si quelqu'un s'aperçoit dans six mois
--    qu'un de ces partenaires était en fait réel, la trace existe.
create table if not exists partners_archive_2026_08 as
  select * from partners;

-- 2. On vide la table. Les faux partenaires servaient de remplissage
--    pendant la conception ; aucun n'a jamais soutenu le club.
delete from partners;

-- 3. Les deux vrais.
--    force_white = true : le site applique brightness(0) invert(1),
--    les deux logos deviennent blancs et se ressemblent enfin.
--    featured = true sur MPG : il occupe deux colonnes de la grille.
insert into partners (name, logo_url, website_url, featured, force_white, logo_scale, hidden, sort)
values
  ('Man Properties Group',
   '/media/img/partenaire-mpg.svg',
   'https://man-properties-group.vercel.app',
   true,  true, 100, false, 1),

  ('Commune de Mermoz / Sacré-Cœur',
   '/media/img/partenaire-commune-mermoz-sacre-coeur.webp',
   null,
   false, true,  88, false, 2);

commit;

-- =====================================================================
-- VÉRIFICATION
-- =====================================================================
-- select name, featured, force_white, logo_scale, sort
--   from partners order by sort;
--
-- Attendu : deux lignes, MPG en premier et marqué featured.
--
-- Le site les lit par « partners?select=*&order=sort.asc ». Le HTML de
-- index.html contient les mêmes deux logos en repli : ils s'affichent
-- si la base ne répond pas. Les deux doivent donc rester d'accord.
--
-- POUR REVENIR EN ARRIÈRE :
--   delete from partners;
--   insert into partners select * from partners_archive_2026_08;
--
-- POUR PASSER LE LOGO DE LA COMMUNE EN JAUNE plutôt qu'en blanc :
--   update partners set force_white = false
--    where name like 'Commune%';
--   puis remplacer le fichier par la version « contours jaune ».
-- =====================================================================
