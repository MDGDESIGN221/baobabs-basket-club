-- =====================================================================
-- FAVORIS — petit correctif de type (à exécuter une fois dans Supabase)
--
-- Pourquoi : les matchs ont un identifiant numérique (bigint) alors que
-- favorites.target_id était un uuid — impossible d'y épingler un match.
-- La colonne passe en texte, qui accepte les deux familles d'identifiants.
--
-- Réexécutable sans risque : relancer ce script ne change rien de plus.
-- =====================================================================

alter table favorites alter column target_id type text using target_id::text;
