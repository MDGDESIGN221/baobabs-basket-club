-- =====================================================================
--  Baobabs Basket Club — Migration Supabase v6  (Photo candidat recrutement)
--  À exécuter une fois dans Supabase : SQL Editor → New query → Run.
--  Idempotent, sans risque — n'affecte pas les candidatures existantes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Nouvelle colonne sur recruitment_requests pour stocker l'URL
--    publique de la photo du candidat (ou NULL si non fournie)
-- ---------------------------------------------------------------------
alter table recruitment_requests add column if not exists photo_url text;

-- ---------------------------------------------------------------------
-- 2. Bucket Storage public dédié aux photos de candidature
--    - public=true : les photos sont lisibles via URL directe (nécessaire
--      pour les afficher dans l'admin), sans passer par une policy SELECT
--    - file_size_limit : 5 Mo, largement suffisant pour une photo de profil
--    - allowed_mime_types : uniquement des images, pour éviter qu'un
--      formulaire public sans authentification serve à héberger n'importe
--      quel type de fichier
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recruitment-photos',
  'recruitment-photos',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

-- ---------------------------------------------------------------------
-- 3. Policy d'upload : le formulaire public n'a pas de session utilisateur
--    (pas d'auth Supabase), donc on autorise le rôle anon à uniquement
--    INSÉRER dans ce bucket précis — pas de SELECT/UPDATE/DELETE accordé
--    ici, la lecture des photos existantes passe par l'URL publique du
--    bucket (voir point 2), pas par l'API Storage elle-même.
-- ---------------------------------------------------------------------
drop policy if exists "recruitment_photos_public_upload" on storage.objects;
create policy "recruitment_photos_public_upload"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'recruitment-photos');

-- =====================================================================
-- Note de sécurité : comme il n'y a pas d'authentification sur le
-- formulaire public, cette policy autorise techniquement n'importe qui
-- à envoyer un fichier vers ce bucket (pas seulement via le formulaire
-- de recrutement). Les restrictions de type MIME et de taille (point 2)
-- limitent l'abus possible. Si ça devient un problème (spam de fichiers),
-- on pourra resserrer davantage plus tard (ex: passer par une Edge
-- Function qui valide et relaie l'upload, plutôt qu'un accès direct).
-- =====================================================================
