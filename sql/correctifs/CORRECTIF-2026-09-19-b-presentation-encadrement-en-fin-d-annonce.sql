-- ============================================================================
-- L'ENCADREMENT EN FIN D'ANNONCE
-- 19 septembre 2026
-- ============================================================================
-- « dans les animations de presentation on doit pouvoir ajouter la photo
--   a la fin du chef de delegation, et le nom des deux coachs, et cette
--   option on choisit de l'activer ou pas »
--
-- Le staff d'une presentation (presentation_staff) ne servait qu'a la liste
-- officielle du Greffe. Un drapeau par presentation le fait aussi monter sur
-- la scene de l'accueil, en dernier acte, apres le groupe : la personne qui
-- porte la fonction « chef de delegation » (a defaut la premiere de la liste)
-- en photo, comme une joueuse, et les autres nommees avec leur fonction.
-- Rien ne change pour les presentations existantes : le drapeau est faux.
-- ============================================================================

alter table public.presentations
  add column if not exists staff_acte boolean not null default false;

comment on column public.presentations.staff_acte is
  'Vrai : l''encadrement (presentation_staff) est annonce en fin de scene sur l''accueil.';
