-- =====================================================================
--  Baobabs Basket Club — Positionnement d'image des actualités
--  À exécuter UNE FOIS dans Supabase : SQL Editor → New query → Run.
--  Idempotent, sans risque.
--
--  Permet de régler, par actualité, le cadrage de la photo affichée
--  sur le site (recadrée automatiquement en 16/10) :
--   - image_url_x : position horizontale du point focal (0 = gauche, 100 = droite)
--   - image_url_y : position verticale (0 = haut, 100 = bas)
--   - image_url_zoom : zoom en % (100 = normal, 150 = zoom avant)
-- =====================================================================
alter table news add column if not exists image_url_x    int default 50;
alter table news add column if not exists image_url_y    int default 50;
alter table news add column if not exists image_url_zoom int default 100;
