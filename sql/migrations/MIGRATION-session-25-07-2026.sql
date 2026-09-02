-- =====================================================================
--  Baobabs Basket Club — Nouvelles clés de site_settings
--  Session du 25 juillet 2026
--
--  Contenu : hero d'accueil (split éditorial), Médias et Boutique séparés,
--  teaser vidéo et affiches des Tryouts, libellés des écrans de l'appli.
--
--  À exécuter dans l'éditeur SQL de Supabase.
--  Sans danger : ON CONFLICT DO NOTHING n'insère une clé que si elle n'existe
--  pas déjà — rien de ce qui a été saisi dans l'admin n'est écrasé.
--  Le script est même facultatif : sans lui, le site affiche les textes par
--  défaut inscrits dans index.html, et l'admin les enregistrera au premier
--  clic sur Enregistrer.
--
--  61 clés.
-- =====================================================================

INSERT INTO site_settings (key, value) VALUES
  -- Hero d'accueil — split éditorial
  ('hs_kicker', 'Baobabs Basket Club · Dakar'),
  ('hs_title', 'Le basket
sénégalais'),
  ('hs_accent', 'qui monte'),
  ('hs_text', 'Formation, compétition, communauté. Depuis 2026, les Baobabs construisent à Dakar un club où les joueuses progressent et où le public a sa place.'),
  ('hs_btn1_label', 'Rejoindre le club'),
  ('hs_btn1_url', 'tryouts'),
  ('hs_btn2_label', 'Voir le calendrier'),
  ('hs_btn2_url', 'competitions'),
  ('hs_f1_value', '2026'),
  ('hs_f1_label', 'Fondation'),
  ('hs_f2_value', '27'),
  ('hs_f2_label', 'Licenciées'),
  ('hs_f3_value', 'D2'),
  ('hs_f3_label', 'Championnat'),
  ('hs_live_note', 'Prochain direct sam. 19:00'),
  ('hs_match_label', 'Prochain match'),
  ('hs_ticket_label', 'Billetterie'),
  ('hs_ticket_url', 'tryouts'),
  ('hs_alaune_label', 'À la une'),

  -- Médias — vidéos & photos
  ('md_kicker', 'Vidéos & photos'),
  ('md_title', 'Médias'),
  ('md_more_label', 'Notre chaîne'),
  ('md_tag', 'À revoir'),
  ('md_image_url', '/media/img/Trio_Baobabs___trois_quarts_f5uqkz.webp'),
  ('md_caption', 'Résumé · Baobabs 84–79 ASC Ville de Dakar'),
  ('md_link_url', ''),
  ('md2_image_url', ''),
  ('md2_caption', ''),
  ('md2_link_url', ''),
  ('md3_image_url', ''),
  ('md3_caption', ''),
  ('md3_link_url', ''),

  -- Boutique — en-tête sur l'accueil
  ('shop_kicker', 'Store officiel'),
  ('shop_title', 'Boutique'),
  ('shop_link_label', 'Tout voir'),
  ('shop_cta_label', 'Voir toute la boutique'),

  -- Tryouts — teaser vidéo & affiches
  ('try_video_url', 'https://res.cloudinary.com/djdkpihuz/video/upload/f_auto,q_auto/v1784754196/JOURNEES_DE_DETECTION_hnuoih.mp4'),
  ('try_video_poster', 'https://res.cloudinary.com/djdkpihuz/video/upload/so_0,f_jpg,q_auto/v1784754196/JOURNEES_DE_DETECTION_hnuoih.jpg'),
  ('try_teaser_tag', 'TEASER'),
  ('try_poster1_url', '/media/img/BBC_-_TRYOUTS_2026_SAISON_2026-2027_r3n5np.webp'),
  ('try_poster2_url', '/media/img/BBC_-_TRYOUTS_2026_SAISON_2026-2027_v3_cel80k.webp'),
  ('try_poster_badge', 'Voir'),
  ('try_poster_kicker', 'Ce week-end'),
  ('try_poster_text', 'À partager sans modération.'),

  -- Appli — libellés des écrans dans les téléphones
  ('app_sc_cal_kicker', 'Calendrier'),
  ('app_sc_cal_title', 'Saison 2026'),
  ('app_sc_std_kicker', 'Classement'),
  ('app_sc_std_title', 'D2 · Dakar'),
  ('app_sc_shop_kicker', 'Boutique'),
  ('app_sc_shop_title', 'Store officiel'),
  ('app_sc_tick_kicker', 'Billetterie'),
  ('app_sc_tick_title', 'Ton billet'),
  ('app_sc_tick_btn', 'RÉSERVER'),
  ('app_sc_roster_kicker', 'Effectif'),
  ('app_sc_live', 'EN DIRECT · Q4'),
  ('app_sc_news_kicker', 'Actus'),
  ('app_sc_space_name', 'Fatou N.'),
  ('app_sc_space_kicker', 'Mon espace'),
  ('app_sc_space_r1', 'Mes billets'),
  ('app_sc_space_r2', 'Mes commandes'),
  ('app_sc_space_r3', 'Favoris')
ON CONFLICT (key) DO NOTHING;
