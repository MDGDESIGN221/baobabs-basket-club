-- =====================================================================
--  Baobabs Basket Club — Migration : logo dans le classement (standings)
--  À exécuter une fois dans Supabase : SQL Editor → New query → Run.
--  Idempotent, sans risque — n'affecte pas les lignes existantes.
-- =====================================================================

-- Nouvelle colonne : URL publique du logo de l'équipe (ou NULL).
-- Alimentée depuis l'espace gestion (onglet « Éditeur visuel » du Classement)
-- soit par upload dans le bucket site-media, soit par lien collé.
alter table standings add column if not exists logo_url text;

-- =====================================================================
-- Note : le bucket public « site-media » sert déjà pour les autres
-- images du site (effectif, partenaires…). Aucune policy supplémentaire
-- n'est nécessaire ici : on réutilise l'infrastructure d'upload existante.
-- =====================================================================
