-- ============================================================
--  LES LÉGENDES DES DOUZE PHOTOS, REPRISES EN BASE
-- ============================================================
--  À passer dans Supabase → SQL Editor, APRÈS MIGRATION-galerie.sql.
--
--  POURQUOI CE FICHIER
--  La reprise des douze photos a bien copié les images, mais pas leurs
--  légendes : elles étaient écrites dans le code du site, et mon
--  premier script ne les a pas emportées. C'est une omission de ma
--  part, pas un choix.
--
--  LE SITE N'ATTEND PAS CE FICHIER POUR AFFICHER LES LÉGENDES : il
--  garde celles qui sont livrées avec lui tant que la base se tait.
--  Mais tant qu'elles n'y sont pas, vous ne pouvez pas les MODIFIER
--  depuis l'administration — elles ne lui appartiennent pas encore.
--  C'est ce que ce fichier corrige.
--
--  Rien n'est créé ni détruit : douze mises à jour, et seulement sur
--  les lignes dont la légende est encore vide. Repasser le script
--  n'écrasera donc jamais un texte que vous auriez retouché.
-- ============================================================


-- ============================================================
--  A · CONSTAT
-- ============================================================

select 'A1 · légendes manquantes' as controle,
       count(*) filter (where caption is null or caption = '')::text ||
       ' vide(s) sur ' || count(*)::text || ' ligne(s)' as detail
from public.gallery;


-- ============================================================
--  B · LES DOUZE LÉGENDES
-- ============================================================
--  « where coalesce(caption,'') = '' » : on ne touche qu'aux vides.

update public.gallery g set caption = v.txt
from (values
  ('detection-2026-01.webp', 'Le panier du terrain des Baobabs, un matin de juillet.'),
  ('detection-2026-02.webp', 'Le coach accueille les joueuses avant le premier atelier.'),
  ('detection-2026-03.webp', 'Montée au panier pendant les ateliers du samedi.'),
  ('detection-2026-04.webp', 'Consignes avant la mise en place des exercices.'),
  ('detection-2026-05.webp', 'Conduite de balle sur le rond central.'),
  ('detection-2026-06.webp', 'Duel au rebond pendant les oppositions.'),
  ('detection-2026-07.webp', 'Un contre un, sous le regard du groupe.'),
  ('detection-2026-08.webp', 'Sur le bord du terrain, entre deux ateliers.'),
  ('detection-2026-09.webp', 'Opposition en maillots orange, dimanche matin.'),
  ('detection-2026-10.webp', 'Le jeu se met en place sur toute la largeur.'),
  ('detection-2026-11.webp', 'Le ballon en l''air, tout le monde suit.'),
  ('detection-2026-12.webp', 'Fin de session : le terrain est encore plein.')
) as v(fichier, txt)
where g.image_url = '/media/img/' || v.fichier
  and coalesce(g.caption, '') = '';

--  Le film, lui, mérite aussi sa ligne.
update public.gallery
   set caption = 'Le résumé filmé de la journée de détection.'
 where video_url is not null and coalesce(caption, '') = '';


-- ============================================================
--  C · VÉRIFICATION
-- ============================================================

select 'C1 · légendes restantes à écrire' as controle,
       count(*) filter (where coalesce(caption,'') = '')::text || ' sur ' ||
       count(*)::text as detail
from public.gallery;

select 'C2 · ce que le site lira' as controle,
       string_agg(coalesce(caption, '(sans légende)'), ' | ' order by sort) as detail
from public.gallery where published = true;


-- ============================================================
--  D · POUR REVENIR EN ARRIÈRE
-- ============================================================
--  Les légendes redeviennent vides ; le site retombera sur celles qui
--  sont livrées avec lui, et rien ne changera à l'écran.
--
-- update public.gallery set caption = null;
