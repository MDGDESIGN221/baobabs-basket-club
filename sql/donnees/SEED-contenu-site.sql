-- =====================================================================
--  Baobabs Basket Club — Injection du contenu actuel du site dans la base
--  À exécuter UNE FOIS dans Supabase : SQL Editor → New query → Run.
--
--  Pourquoi : aujourd'hui les joueuses et les produits affichés sur le
--  site sont codés en dur dans index.html (contenu de secours). Les tables
--  Supabase "players" et "products" sont vides, donc l'éditeur visuel de
--  l'espace gestion n'a rien à afficher. Ce script recopie ce contenu dans
--  la base pour que tu puisses l'éditer visuellement.
--
--  Sécurité : chaque insertion est protégée par "where not exists" — si la
--  table contient déjà des lignes, RIEN n'est inséré (pas de doublon).
--  Tu peux donc relancer ce script sans risque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EFFECTIF (players)  — les 8 joueuses du site
-- ---------------------------------------------------------------------
insert into players (name, jersey_number, position, height, city, birth_year, photo_url, bio, sort)
select v.name, v.jersey_number, v.position, v.height, v.city, v.birth_year, v.photo_url, v.bio, v.sort
from (values
  ('Aïda Diop',    4,  'Meneuse',       '1,74 m', 'Dakar',       2004, '/media/img/nouvel_num_4_umsjcf.webp',                          'Chef d''orchestre des Baobabs, Aïda dicte le tempo et sait accélérer dans le money time. Une meneuse lucide qui fait briller ses coéquipières.', 0),
  ('Fatou Fall',   7,  'Ailière',       '1,79 m', 'Thiès',       2006, '/media/img/nouvel_num_7_ee3qcx.webp',                           'Ailière athlétique et adroite de loin, Fatou étire les défenses et se projette vite en transition. Un profil moderne, précieux des deux côtés du terrain.', 1),
  ('Awa Ndiaye',   10, 'Pivot',         '1,90 m', 'Dakar',       2008, '/media/img/nouvel_num_10_sztbqj.webp',                          'Jeune intérieure au potentiel immense, Awa domine la raquette au rebond et protège le cercle. La révélation de la formation baobab.', 2),
  ('Mariama Sarr', 23, 'Arrière',       '1,77 m', 'Saint-Louis', 2003, '/media/img/num_23_dliztl.webp',                                'Scoreuse née, Mariama porte l''attaque dans les grands rendez-vous. Un sang-froid rare et un shoot fiable balle en main.', 3),
  ('Khady Sy',     11, 'Ailière-forte', '1,83 m', 'Dakar',       2010, '/media/img/Joueuse_maillot_blanc___fond_transparent_b0fu2e.webp', 'La benjamine de l''effectif, déjà solide au contact. Khady apporte énergie et impact défensif malgré son jeune âge.', 4),
  ('Ndèye Guèye',  15, 'Pivot',         '1,88 m', 'Rufisque',    2009, '/media/img/numero_15_aijnyv.webp',                             'Intérieure travailleuse, Ndèye pose des écrans propres et finit près du cercle. Un vrai relais dans la rotation des grandes.', 5),
  ('Rama Mbaye',   6,  'Meneuse',       '1,70 m', 'Dakar',       2007, '/media/img/numero_6_hkmpa0.webp',                              'Meneuse rapide et joueuse, Rama presse tout terrain et déclenche le jeu de contre. Une gagneuse au caractère bien trempé.', 6),
  ('Bineta Cissé', 33, 'Arrière',       '1,76 m', 'Mbour',       2008, '/media/img/numero_33_kgoopf.webp',                             'Arrière défensive et adroite, Bineta prend les meilleurs shoots adverses et sanctionne à trois points. Un profil fiable et régulier.', 7)
) as v(name, jersey_number, position, height, city, birth_year, photo_url, bio, sort)
where not exists (select 1 from players);

-- ---------------------------------------------------------------------
-- 2. BOUTIQUE (products)  — les 4 produits du site, avec toutes leurs photos
--    images est un tableau JSON (plusieurs photos par produit).
-- ---------------------------------------------------------------------
insert into products (name, price, category, images, sizes, description, in_stock, sort)
select v.name, v.price, v.category, v.images::jsonb, v.sizes, v.description, v.in_stock, v.sort
from (values
  ('Maillot Domicile 2026',  25000, 'Maillots',    '["/media/img/Replace_jersey_with_Baobabs_club_202607220257_uda4kz.webp","/media/img/Replace_jersey_with_Baobabs_club_202607221933_oaaj6k.webp","/media/img/ET_a462kv.webp"]', 'S, M, L, XL', 'Le maillot des Baobabs pour la saison 2026, porté à domicile au Complexe Patrick Semedo. Coupe technique respirante, floqué aux couleurs du club.', true, 0),
  ('Maillot Extérieur 2026', 25000, 'Maillots',    '["/media/img/Replace_jersey_with_Baobabs_2K_202607220253_fmyqm7.webp"]', 'S, M, L, XL', 'Le maillot extérieur des Baobabs, pensé pour les déplacements de la saison 2026. Même exigence technique, teinte inversée.', true, 1),
  ('Maillot Third 2026',     25000, 'Maillots',    '["/media/img/Replace_jersey_with_Baobabs_2K_202607220252_1_y8nrdr.webp","/media/img/Replace_jersey_with_Baobabs_club_202607221931_wypaa3.webp","/media/img/Replace_jersey_with_Baobabs_2K_202607220252_mfbrbt.webp"]', 'S, M, L, XL', 'La troisième tunique des Baobabs, en édition limitée pour la saison 2026. Un maillot pour les grandes occasions.', true, 2),
  ('Casquette officielle',   10000, 'Accessoires', '["/media/img/Replace_logo_on_cap_2K_202607222141_mtizyy.webp","/media/img/Another_pose_of_cap_2K_202607222144_gbyhjs.webp","/media/img/Cap_in_black_2K_202607222143_rdhxvf.webp"]', 'Taille unique', 'La casquette officielle des Baobabs, floquée aux couleurs du club. Taille unique ajustable, pour supporter l''équipe partout.', true, 3)
) as v(name, price, category, images, sizes, description, in_stock, sort)
where not exists (select 1 from products);

-- =====================================================================
--  Après exécution : ouvre l'espace gestion → Effectif et Boutique.
--  Les 8 joueuses et les 4 produits (avec leurs photos) apparaissent
--  dans l'éditeur visuel, prêts à être modifiés, réordonnés ou supprimés.
-- =====================================================================
