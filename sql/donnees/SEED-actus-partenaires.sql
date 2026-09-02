-- =====================================================================
--  Baobabs Basket Club — Contenu actuel du site : Actualités + Partenaires
--  À exécuter UNE FOIS dans Supabase : SQL Editor → New query → Run.
--  Idempotent : n'insère rien si la table contient déjà des lignes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ACTUALITÉS (news) — les 3 actus affichées sur l'accueil
-- ---------------------------------------------------------------------
insert into news (title, body, image_url, published_at, sort)
select v.title, v.body, v.image_url, v.published_at::date, v.sort
from (values
  ('Les Baobabs renversent le DUC dans le money time',
   'Menés de dix points à l''entame du dernier quart-temps, les Baobabs ont su renverser le DUC grâce à une défense étouffante et un money time maîtrisé. Un premier test référence réussi pour le collectif.',
   'https://res.cloudinary.com/djdkpihuz/image/upload/v1784693521/actu_1_lcccos.png', '2026-07-22', 0),
  ('Khady Sy signe et rejoint l''effectif',
   'La jeune ailière-forte Khady Sy s''engage avec les Baobabs. À seulement 16 ans, elle apporte énergie et impact défensif et vient renforcer la rotation intérieure de l''équipe.',
   '/media/img/Maillot_blanc_Baobabs_dpzaxu.webp', '2026-07-21', 1),
  ('Le centre de formation ouvre ses portes',
   'Le centre de formation des Baobabs accueille ses premières générations de licenciées. Détection, encadrement et double projet sportif et scolaire : le club pose les bases de son avenir.',
   'https://res.cloudinary.com/djdkpihuz/image/upload/v1784693876/Young_female_basketball_players___202607220417_wkdg0f.jpg', '2026-07-12', 2)
) as v(title, body, image_url, published_at, sort)
where not exists (select 1 from news);

-- ---------------------------------------------------------------------
-- PARTENAIRES (partners) — TotalEnergies (principal) + 4 officiels
-- Nécessite d'abord MIGRATION-partners-options.sql (colonnes featured, force_white, hidden, logo_scale)
-- ---------------------------------------------------------------------
insert into partners (name, logo_url, featured, force_white, hidden, logo_scale, sort)
select v.name, v.logo_url, v.featured, v.force_white, v.hidden, v.logo_scale, v.sort
from (values
  ('TotalEnergies', '/media/img/Logo_TotalEnergies___fond_transparent_dtnyof.webp', true,  true, false, 100, 0),
  ('Yas',           '/media/img/Yas_jaune___fond_transparent_faxpwt.webp',      false, true, false, 100, 1),
  ('Eiffage',       '/media/img/Eiffage_2400_01_colour_RGB_iwzuto.webp',        false, true, false, 100, 2),
  ('Ecobank',       '/media/img/ecobank-logo-FR_f9obdg.svg',                   false, true, false, 100, 3),
  ('Auchan',        '/media/img/auchan_nevc5t.webp',                            false, true, false, 100, 4)
) as v(name, logo_url, featured, force_white, hidden, logo_scale, sort)
where not exists (select 1 from partners);

-- =====================================================================
--  Après exécution : Actualités et Partenaires affichent le vrai contenu
--  dans l'espace gestion (éditeur visuel), prêt à éditer / réordonner.
-- =====================================================================
