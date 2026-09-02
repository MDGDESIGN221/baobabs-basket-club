-- =====================================================================
--  Baobabs Basket Club — Cadrage des photos de joueuses (players)
--  À exécuter UNE FOIS dans Supabase : SQL Editor → New query → Run.
--  Idempotent, sans risque.
--
--  Réglage par joueuse du cadrage de la photo (cartes effectif + fiche) :
--   - photo_x    : position horizontale (0 = gauche, 100 = droite ; défaut 50)
--   - photo_y    : position verticale (0 = haut, 100 = bas ; défaut 0 = cadré tête)
--   - photo_zoom : zoom en % (100 = normal ; défaut 100)
-- =====================================================================
alter table players add column if not exists photo_x    int default 50;
alter table players add column if not exists photo_y    int default 0;
alter table players add column if not exists photo_zoom int default 100;
