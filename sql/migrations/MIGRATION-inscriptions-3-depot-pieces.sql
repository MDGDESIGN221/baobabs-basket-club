-- =====================================================================
--  Baobabs Basket Club — ÉCOLE DE BASKET, LOT 3 : LE DÉPÔT DES PIÈCES
--  À passer APRÈS MIGRATION-inscriptions-2-dossier.sql
--  Idempotent. Aucune donnée supprimée.
--
--  CE QUE ÇA CHANGE, ET POURQUOI ON REVIENT SUR UNE DÉCISION
--
--  Le lot 2 disait : « pas d'envoi depuis le site — des documents
--  d'identité de mineurs n'ont rien à faire dans un espace de stockage
--  ouvert en écriture au public ». Cette phrase reste vraie mot pour
--  mot. Ce qu'elle interdit, c'est UN BUCKET PUBLIC EN ÉCRITURE — pas
--  le dépôt lui-même.
--
--  Les familles, elles, ont un téléphone et pas de scanner : leur
--  demander d'apporter quatre papiers au bureau, c'est un dossier
--  incomplet pendant six semaines, et un certificat médical qui manque
--  le jour où un enfant fait un malaise.
--
--  On garde donc l'interdit et on ajoute la fonction :
--
--    · un bucket PRIVÉ, dossiers-prives. Aucune lecture publique,
--      aucune écriture publique. Le site n'a jamais de jeton dessus.
--    · l'envoi passe par une fonction serveur (depot-piece) qui écrit
--      avec la clé de service, après avoir vérifié QUI dépose.
--    · la vérification est celle qui existe déjà pour le suivi parent :
--      la référence du dossier ET les six derniers chiffres du
--      téléphone du responsable. Sans le couple exact, rien ne passe.
--    · l'admin ne lit plus par une adresse publique mais par une URL
--      signée, valable quelques minutes.
--
--  CE QUE ÇA NE PROTÈGE PAS. Quelqu'un qui connaît la référence ET le
--  téléphone d'une famille peut déposer une pièce à sa place. C'est le
--  même niveau que le suivi parent, et c'est assumé : le risque est
--  qu'un inconnu AJOUTE un document, pas qu'il en LISE un.
-- =====================================================================


-- =====================================================================
-- 1. LE BUCKET PRIVÉ
--    Créé s'il n'existe pas. public = false : c'est tout le sujet.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dossiers-prives', 'dossiers-prives', false,
  8 * 1024 * 1024,                      -- 8 Mo : une photo de téléphone compressée tient largement
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Aucune politique pour anon : sans politique, l'accès est refusé.
-- On l'écrit tout de même en clair, pour que personne n'en ajoute une
-- « pour dépanner » sans lire ce qui suit.
drop policy if exists dossiers_prives_anon_rien on storage.objects;

-- Les administrateurs lisent. L'écriture reste à la clé de service,
-- c'est-à-dire à la fonction serveur, et à elle seule.
drop policy if exists dossiers_prives_admin_lecture on storage.objects;
create policy dossiers_prives_admin_lecture on storage.objects
  for select to authenticated
  using (bucket_id = 'dossiers-prives' and public.is_admin());

drop policy if exists dossiers_prives_admin_ecriture on storage.objects;
create policy dossiers_prives_admin_ecriture on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dossiers-prives' and public.is_admin());

drop policy if exists dossiers_prives_admin_suppression on storage.objects;
create policy dossiers_prives_admin_suppression on storage.objects
  for delete to authenticated
  using (bucket_id = 'dossiers-prives' and public.is_admin());


-- =====================================================================
-- 2. DÉPOSER UNE PIÈCE — vérification et écriture au même endroit
--
--    La fonction serveur téléverse le fichier, puis appelle ceci. Le
--    contrôle du couple référence/téléphone est refait ICI : une
--    fonction serveur peut être appelée directement, on ne lui fait pas
--    confiance sur parole.
--
--    On remplace une pièce du même type au lieu d'en accumuler : une
--    famille qui renvoie un certificat médical corrige le précédent,
--    elle n'en ajoute pas un deuxième. L'index unique du lot 2 l'impose
--    de toute façon.
-- =====================================================================
create or replace function bbc_piece_deposer(
  p_reference text,
  p_phone     text,
  p_kind      text,
  p_url       text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref  text := upper(btrim(coalesce(p_reference,'')));
  v_tel  text := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
  v_kind text := lower(btrim(coalesce(p_kind,'')));
  v_id   uuid;
begin
  if v_kind not in ('photo','naissance','medical','autorisation') then
    raise exception 'piece_inconnue';
  end if;
  if p_url is null or btrim(p_url) = '' then
    raise exception 'fichier_manquant';
  end if;
  if v_ref = '' or length(v_tel) < 6 then
    raise exception 'reference_ou_telephone_manquant';
  end if;

  -- Même règle que bbc_inscription_suivi : les six derniers chiffres,
  -- pour ne pas buter sur l'indicatif pays saisi une fois sur deux.
  select r.id into v_id
    from academy_registrations r
   where upper(r.reference) = v_ref
     and (right(regexp_replace(coalesce(r.guardian_phone,''),  '\D','','g'), 6) = right(v_tel, 6)
       or right(regexp_replace(coalesce(r.guardian_phone2,''), '\D','','g'), 6) = right(v_tel, 6));

  if v_id is null then
    raise exception 'dossier_introuvable';
  end if;

  delete from academy_documents where registration_id = v_id and kind = v_kind;

  insert into academy_documents (registration_id, kind, url, author)
  values (v_id, v_kind, btrim(p_url), 'famille');

  return v_ref;
end;
$$;

revoke all on function bbc_piece_deposer(text,text,text,text) from public;
-- Personne n'appelle ceci depuis le navigateur : seule la fonction
-- serveur le fait, avec la clé de service. On n'accorde donc rien à anon.
grant execute on function bbc_piece_deposer(text,text,text,text) to service_role;


-- =====================================================================
-- 3. CE QUE LE PARENT PEUT SAVOIR AVANT DE DÉPOSER
--    bbc_inscription_suivi existe déjà et rend « pièces manquantes ».
--    Rien à ajouter : le site s'en sert pour ne proposer que ce qui
--    manque, plutôt qu'une liste de quatre cases dont trois sont faites.
-- =====================================================================


-- =====================================================================
--  VÉRIFICATIONS
--    select id, public from storage.buckets where id = 'dossiers-prives';
--      -> public doit valoir false
--    select polname from pg_policies
--     where tablename = 'objects' and polname like 'dossiers_prives%';
--      -> trois politiques, toutes réservées aux administrateurs
--    select proname from pg_proc where proname = 'bbc_piece_deposer';
-- =====================================================================
