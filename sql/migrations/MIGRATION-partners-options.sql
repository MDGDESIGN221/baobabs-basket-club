-- =====================================================================
--  Baobabs Basket Club — Options partenaires
--  À exécuter UNE FOIS dans Supabase : SQL Editor → New query → Run.
--  Idempotent, sans risque (n'affecte pas les lignes existantes).
--
--  Ajoute au partenaire :
--   - force_white : forcer le logo en blanc quelle que soit sa couleur (défaut true)
--   - logo_scale  : taille du logo en % (défaut 100 ; 60 = plus petit, 140 = plus grand)
--   - featured    : partenaire principal, mis en avant (défaut false)
--   - hidden      : masqué sur le site public (défaut false)
-- =====================================================================
alter table partners add column if not exists force_white boolean default true;
alter table partners add column if not exists logo_scale  int     default 100;
alter table partners add column if not exists featured    boolean default false;
alter table partners add column if not exists hidden      boolean default false;
