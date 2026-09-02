-- =====================================================================
--  Baobabs Basket Club — Migration : couleur du nom sur les cartes joueuses
--  À exécuter une fois dans Supabase : SQL Editor → New query → Run.
--  Idempotent, sans risque — n'affecte pas les fiches existantes.
-- =====================================================================

-- Nouvelle colonne : couleur du nom/poste affichés sur la carte (ou NULL).
-- Si NULL, le site garde la couleur par défaut (#F3EFE6, blanc cassé),
-- exactement le rendu actuel — aucune fiche existante n'est donc affectée
-- tant qu'on ne choisit pas explicitement une couleur dans l'éditeur visuel.
--
-- Utilité : certaines photos de joueuses ont un fond clair en bas de
-- l'image, là où le nom est affiché en surimpression. Le nom en blanc y
-- devient difficile à lire ; ce champ permet de choisir une couleur plus
-- sombre (ou toute autre) pour cette fiche précisément, sans changer les
-- autres cartes.
alter table players add column if not exists name_color text;

-- =====================================================================
-- Note : réutilise le même bucket "site-media" et la même infrastructure
-- d'upload/édition que le reste de l'effectif. Aucune policy
-- supplémentaire nécessaire.
-- =====================================================================
