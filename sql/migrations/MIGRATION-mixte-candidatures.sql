-- =====================================================================
--  Baobabs Basket Club — Club mixte (filles & garçons) + gestion pro des candidatures
--  À exécuter UNE FOIS dans Supabase : SQL Editor → New query → Run.
--  Idempotent, sans risque (n'affecte pas les lignes existantes).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CANDIDATURES (recruitment_requests)
-- ---------------------------------------------------------------------
--   gender      : 'F' (fille) ou 'M' (garçon)
--   status      : workflow de traitement (voir valeurs ci-dessous)
--   rating      : note interne 0 à 5 (étoiles) attribuée par le club
--   admin_notes : notes privées du club (non visibles sur le site)
alter table recruitment_requests add column if not exists gender      text;
alter table recruitment_requests add column if not exists status      text default 'nouvelle';
alter table recruitment_requests add column if not exists rating      int  default 0;
alter table recruitment_requests add column if not exists admin_notes text;

-- Statuts possibles (texte libre, gérés depuis l'admin) :
--   nouvelle · preselection · convoquee · retenue · refusee
-- Les anciennes candidatures sans statut sont traitées comme « nouvelle ».

-- ---------------------------------------------------------------------
-- 2. EFFECTIF (players) — le club devient mixte
-- ---------------------------------------------------------------------
--   gender : 'F' (par défaut, l'effectif actuel est féminin) ou 'M'
alter table players add column if not exists gender text default 'F';

-- Les 8 joueuses déjà en base restent en 'F' automatiquement (valeur par défaut).
