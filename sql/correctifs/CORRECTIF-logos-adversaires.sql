-- =====================================================================
--  CORRECTIF — logos des adversaires restés sur Cloudinary
--  À exécuter dans Supabase → SQL Editor.
-- =====================================================================
--
--  LE PROBLÈME
--  La migration Cloudinary a rapatrié toutes les tables sauf `teams` :
--  ses 13 logos pointent encore vers res.cloudinary.com. En local ils
--  s'affichent, mais en production la CSP du site (vercel.json) ne liste
--  pas Cloudinary dans `img-src` — le navigateur les bloque. D'où des
--  logos invisibles côté site ET côté admin.
--
--  LA CORRECTION
--  Réécrire chaque URL vers le fichier local équivalent. Les 13 .webp
--  existent déjà dans media/img/ — vérifié un par un.
--
--  Exemple :
--    https://res.cloudinary.com/djdkpihuz/image/upload/v1784767146/ABC_ACADEMY_vkzixu.jpg
--    →  /media/img/ABC_ACADEMY_vkzixu.webp
--
--  Sans risque : ne touche que les lignes encore sur Cloudinary, et peut
--  être relancé sans effet si elles sont déjà corrigées.
-- =====================================================================


-- 1) AVANT — ce qui va changer. Lancez d'abord ceci seul.
SELECT name AS club,
       logo_url AS avant,
       '/media/img/' ||
         regexp_replace(regexp_replace(logo_url, '^.*/', ''), '\.[A-Za-z0-9]+$', '')
         || '.webp' AS apres
FROM teams
WHERE logo_url LIKE '%res.cloudinary.com%'
ORDER BY name;


-- 2) LA CORRECTION. Lancez-la seulement si la liste ci-dessus vous convient.
UPDATE teams
SET logo_url = '/media/img/' ||
      regexp_replace(regexp_replace(logo_url, '^.*/', ''), '\.[A-Za-z0-9]+$', '')
      || '.webp'
WHERE logo_url LIKE '%res.cloudinary.com%';


-- 3) APRÈS — doit renvoyer 0 ligne.
SELECT count(*) AS logos_encore_sur_cloudinary
FROM teams
WHERE logo_url LIKE '%res.cloudinary.com%';


-- 4) CONTRÔLE GÉNÉRAL — aucune autre table ne doit plus pointer vers
--    Cloudinary. Doit renvoyer 0 partout.
SELECT 'teams'      AS "table", count(*) FROM teams      WHERE logo_url          LIKE '%cloudinary%'
UNION ALL SELECT 'players',      count(*) FROM players    WHERE photo_url         LIKE '%cloudinary%'
UNION ALL SELECT 'partners',     count(*) FROM partners   WHERE logo_url          LIKE '%cloudinary%'
UNION ALL SELECT 'matches',      count(*) FROM matches    WHERE opponent_logo_url LIKE '%cloudinary%'
UNION ALL SELECT 'news',         count(*) FROM news       WHERE image_url         LIKE '%cloudinary%'
UNION ALL SELECT 'site_settings',count(*) FROM site_settings WHERE value          LIKE '%cloudinary%';
