-- =====================================================================
--  FERMER LE BUCKET DES PHOTOS AU NAVIGATEUR
--  17 septembre 2026. Idempotent. Aucune donnee supprimee.
--
--  ====================================================================
--   NE PAS COLLER CECI AVANT D'AVOIR DEPLOYE depot-photo.
--
--     npx supabase functions deploy depot-photo --project-ref lmwbwasupqkvswukieav
--
--   C'est la seule precondition de tout l'audit, et c'est pour ca que
--   ce bloc vit dans son propre fichier plutot qu'au milieu des six
--   autres. Ce fichier retire au navigateur le droit d'ecrire dans le
--   bucket des photos. Si la fonction n'est pas encore en place, le
--   formulaire de candidature et celui de la collecte cessent
--   d'accepter une photo -- le reste du formulaire continue de partir,
--   la photo seule echoue, et sans message clair pour la personne.
--
--   POUR VERIFIER QU'ELLE EST BIEN LA, avant de coller : la page
--   Recrutement du site, une candidature de test avec une photo. Si la
--   photo arrive dans l'ecran Candidatures, la fonction repond.
--  ====================================================================
--
--  A PASSER APRES les deux autres correctifs du jour :
--    CORRECTIF-2026-09-17-journal-et-roles.sql
--    CORRECTIF-2026-09-17-b-uploads-commandes-promo.sql
-- =====================================================================


--
--  MIGRATION-SUPABASE-v6.sql posait ceci, et l'assumait en note :
--
--    create policy "recruitment_photos_public_upload"
--      on storage.objects for insert to anon
--      with check (bucket_id = 'recruitment-photos');
--
--    « comme il n'y a pas d'authentification sur le formulaire public,
--      cette policy autorise techniquement n'importe qui a envoyer un
--      fichier vers ce bucket [...] Si ca devient un probleme (spam de
--      fichiers), on pourra resserrer davantage plus tard (ex: passer
--      par une Edge Function qui valide et relaie l'upload, plutot
--      qu'un acces direct). »
--
--  C'est cette suite-la. depot-photo est deployee, joueuse.html et
--  index.html l'appellent : la porte directe ne sert plus a rien, et
--  elle laissait entrer n'importe quel fichier etiquete image.
--
--  LA LECTURE RESTE PUBLIQUE. Le bucket est en public = true, et c'est
--  voulu : l'administration affiche la photo du candidat par son
--  adresse. Ce sont des portraits que la personne envoie pour qu'on les
--  regarde, pas des pieces d'identite -- celles-la vivent dans
--  dossiers-prives, qui est prive.
-- ---------------------------------------------------------------------

-- Le plafond monte a 25 Mo, parce que les deux cotes se contredisaient :
-- joueuse.html annonce 25 Mo depuis qu'on a decide d'envoyer la photo
-- telle quelle, et le bucket refusait au-dela de 5 Mo. Une photo de
-- telephone recent partait pour rien et echouait a l'arrivee, sans
-- message utile. Un seul chiffre desormais, et c'est la fonction qui le
-- fait respecter la premiere.
update storage.buckets
   set public             = true,
       file_size_limit    = 25 * 1024 * 1024,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']
 where id = 'recruitment-photos';

-- LA PORTE DIRECTE SE FERME.
drop policy if exists "recruitment_photos_public_upload" on storage.objects;

-- Et on la remplace par rien : l'ecriture appartient a la cle de
-- service, c'est-a-dire a depot-photo, et a l'administration pour
-- pouvoir remplacer ou retirer une photo depuis l'ecran.
drop policy if exists recruitment_photos_admin_ecriture on storage.objects;
create policy recruitment_photos_admin_ecriture on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recruitment-photos' and public.is_admin());

drop policy if exists recruitment_photos_admin_suppression on storage.objects;
create policy recruitment_photos_admin_suppression on storage.objects
  for delete to authenticated
  using (bucket_id = 'recruitment-photos' and public.is_admin());

-- =====================================================================
--  VERIFICATIONS
-- ---------------------------------------------------------------------
--  a) LE NAVIGATEUR N'ECRIT PLUS DANS LE STOCKAGE, NULLE PART.
--     Doit rendre zero ligne :
--
--       select policyname, cmd, roles::text
--         from pg_policies
--        where schemaname = 'storage' and tablename = 'objects'
--          and roles::text like '%anon%';
--
--  b) LES DEUX FORMULAIRES ACCEPTENT TOUJOURS UNE PHOTO, et c'est la
--     verification qui compte. Elle se fait a la main, depuis un
--     telephone, pas depuis le code :
--       - la page Recrutement du site : remplir, joindre une photo,
--         envoyer. La photo doit apparaitre dans l'administration,
--         ecran Candidatures.
--       - joueuse.html avec un vrai jeton de campagne (?t=...) : meme
--         chose, ecran Effectif.
--     Si la photo echoue alors que le reste passe, c'est que
--     depot-photo n'est pas deployee, ou que index.html et joueuse.html
--     ne sont pas encore en ligne. Rien d'autre n'est a refaire : ces
--     deux pages attendent dans un commit local, voir le rapport.
--
--  c) UN FICHIER QUI N'EST PAS UNE IMAGE NE PASSE PLUS. Renommez un
--     document quelconque en « photo.png » et joignez-le : le
--     formulaire doit refuser. Avant, il entrait -- la liste de types du
--     bucket ne regardait que l'en-tete annonce.
--
--  d) UNE PHOTO DE TELEPHONE RECENT PASSE. Le bucket refusait au-dela
--     de 5 Mo alors que joueuse.html en annonce 25 : une photo entre
--     les deux partait pour rien. Un seul chiffre maintenant.
--
--
--  REVENIR EN ARRIERE
--  Aucune donnee n'est supprimee. Pour rouvrir l'ecriture directe du
--  bucket, le temps d'un depannage, et UNIQUEMENT ca :
--
--    create policy zz_photos_depannage on storage.objects
--      for insert to anon with check (bucket_id = 'recruitment-photos');
--
--  Et pour la retirer ensuite :
--    drop policy zz_photos_depannage on storage.objects;
-- =====================================================================
