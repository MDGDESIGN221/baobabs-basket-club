-- =====================================================================
--  LE COFFRE DU GREFFE : POLICES, SIGNATURE ET CACHET
--  --------------------------------------------------------------------
--  « faire de ces polices des composants integrants du greffe, pareil
--    pour la signature et le cachet, comme ca on aura pas a avoir des
--    dependances » (24 septembre 2026).
--
--  Pas dans le code : le depot GitHub et le site sont publics, et un
--  cachet de la presidence telechargeable par tous permet de fabriquer
--  de faux actes. Dans un bucket PRIVE, greffe-coffre :
--
--    polices/<cle>     les neuf polices des actes : lues par tout compte
--                      qui ouvre le Greffe (bbc_greffe_ouvert)
--    signature/<cle>   la police de signature et le cachet : lus par qui
--                      signe seulement (bbc_greffe_signe)
--    ecriture          le proprietaire seul (bbc_est_proprietaire)
--
--  Le proprietaire ouvre le Greffe sur son poste : ce qu'il a monte
--  tout seul. Chaque autre poste admis recoit ce qui lui manque a
--  l'ouverture. Aucune politique pour anon : sans politique, refus.
--
--  A EXECUTER DANS L'EDITEUR SQL DE SUPABASE. Rejouable sans risque.
-- =====================================================================

-- 1. LE BUCKET PRIVE. public = false : c'est tout le sujet.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('greffe-coffre', 'greffe-coffre', false, 3 * 1024 * 1024, null)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = null;

-- 2. LIRE : les polices a qui ouvre le Greffe, la signature a qui signe.
drop policy if exists greffe_coffre_lire on storage.objects;
create policy greffe_coffre_lire on storage.objects
  for select to authenticated
  using (
    bucket_id = 'greffe-coffre'
    and (
         ((storage.foldername(name))[1] = 'polices'   and public.bbc_greffe_ouvert())
      or ((storage.foldername(name))[1] = 'signature' and public.bbc_greffe_signe())
    )
  );

-- 3. ECRIRE, REMPLACER, RETIRER : le proprietaire seul.
drop policy if exists greffe_coffre_deposer on storage.objects;
create policy greffe_coffre_deposer on storage.objects
  for insert to authenticated
  with check (bucket_id = 'greffe-coffre' and public.bbc_est_proprietaire());

drop policy if exists greffe_coffre_remplacer on storage.objects;
create policy greffe_coffre_remplacer on storage.objects
  for update to authenticated
  using      (bucket_id = 'greffe-coffre' and public.bbc_est_proprietaire())
  with check (bucket_id = 'greffe-coffre' and public.bbc_est_proprietaire());

drop policy if exists greffe_coffre_retirer on storage.objects;
create policy greffe_coffre_retirer on storage.objects
  for delete to authenticated
  using (bucket_id = 'greffe-coffre' and public.bbc_est_proprietaire());

-- 4. VERIFICATION : le resultat s'affiche sous l'editeur.
--    attendu : le bucket en public = false, puis quatre politiques
--    greffe_coffre_* (SELECT, INSERT, UPDATE, DELETE), toutes pour
--    authenticated ; aucune pour anon.
select 'bucket' as quoi, id as nom, case when public then 'PUBLIC : ANOMALIE' else 'prive' end as detail
  from storage.buckets where id = 'greffe-coffre'
union all
select 'politique', policyname, cmd || ' pour ' || array_to_string(roles, ',')
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects' and policyname like 'greffe_coffre%'
order by 1, 2;
