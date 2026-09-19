-- ============================================================================
-- CINQ MAJEUR : LE REGLAGE DE CHAQUE JOUEUSE SUR LA SCENE
-- 19 septembre 2026
-- ============================================================================
-- Le site mesure chaque silhouette et la pose a la meme hauteur, les pieds
-- sur la meme ligne. Le club veut pouvoir corriger a la main, joueuse par
-- joueuse, depuis l'admin : un peu a gauche, un peu plus haut, un peu plus
-- grande. Trois nombres, sur la joueuse (la photo est la meme d'un match a
-- l'autre) :
--   scene_x     decalage horizontal, en % de la boite (-40 .. 40, 0 = rien)
--   scene_y     decalage vertical,   en % de la boite (-40 .. 40, 0 = rien)
--   scene_zoom  facteur de taille, en %              (60 .. 160, 100 = rien)
--
-- La vue effectif_site liste ses colonnes une a une (une vue « select * »
-- serait figee de toute facon) : on la recree avec les trois nouvelles a la
-- fin -- CREATE OR REPLACE n'accepte que d'en ajouter en queue. Les droits
-- de la vue sont conserves.
-- ============================================================================

alter table public.players
  add column if not exists scene_x    numeric,
  add column if not exists scene_y    numeric,
  add column if not exists scene_zoom numeric;

create or replace view public.effectif_site as
 select id,
    name,
    jersey_number,
    "position",
    positions,
    height,
    weight,
    birth_year,
    gender,
    status,
    photo_url,
    photo_x,
    photo_y,
    photo_zoom,
    name_color,
    bio,
    city,
    stats,
    sort,
    scene_x,
    scene_y,
    scene_zoom
   from players p
  where coalesce(fiche_etat, 'publiee'::text) = 'publiee'::text
    and coalesce(status, 'active'::text) <> 'partie'::text;
