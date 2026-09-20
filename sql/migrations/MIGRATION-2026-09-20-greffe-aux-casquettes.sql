-- =====================================================================
--  LE REGISTRE DU GREFFE S'OUVRE AUX CASQUETTES, ET SIGNER RESTE A PART
--  --------------------------------------------------------------------
--  « tu devras aussi activer le greffe car y'a que moi qui l'ai alors
--    que d'autres en auront besoin pour tirer leurs fiches »
--  (20 septembre 2026).
--
--  L'admin ouvrait deja le Greffe a trois casquettes (16 septembre),
--  mais la base, elle, ne connaissait que le proprietaire : les trois
--  tables du registre etaient sous bbc_est_proprietaire(). Un coach qui
--  composait un acte le gardait dans SON navigateur, le president ne le
--  voyait jamais, et le Greffe disait « registre en base injoignable ».
--
--  CREER N'EST PAS SIGNER, et la base le tient maintenant elle-meme,
--  pas seulement l'ecran : un acte EMIS (etat = 'emis') ne s'ecrit et
--  ne se modifie que par qui signe (proprietaire, administration,
--  presidence). Un coach ou la direction sportive compose, enregistre,
--  et l'acte attend l'encre du president.
--
--  Les deux fonctions ci-dessous sont la liste des casquettes, en un
--  seul endroit cote base. L'admin (GREFFE_CASQUETTES) et le Greffe
--  (DROITS dans greffe.js) portent la meme liste : les trois doivent
--  rester d'accord.
--
--  A EXECUTER DANS L'EDITEUR SQL DE SUPABASE (ou par le MCP).
-- =====================================================================

create or replace function public.bbc_greffe_ouvert()
returns boolean language sql stable security definer set search_path = public as $$
  select bbc_est_proprietaire()
      or bbc_role() in ('super_admin', 'president', 'coach', 'directeur_sportif');
$$;
create or replace function public.bbc_greffe_signe()
returns boolean language sql stable security definer set search_path = public as $$
  select bbc_est_proprietaire() or bbc_role() in ('super_admin', 'president');
$$;
-- Postgres accorde EXECUTE a PUBLIC sur toute fonction nouvelle : on le
-- retire, puis on ne rend qu'aux comptes connectes.
revoke execute on function public.bbc_greffe_ouvert() from public, anon;
revoke execute on function public.bbc_greffe_signe()  from public, anon;
grant  execute on function public.bbc_greffe_ouvert(), public.bbc_greffe_signe() to authenticated;

-- Les dossiers et les pre-reglages : ouverts a toutes les casquettes.
do $$
declare t text;
begin
  foreach t in array array['greffe_dossiers', 'greffe_prereglages'] loop
    execute format('drop policy if exists %I on public.%I', t || '_proprio', t);
    execute format('drop policy if exists %I on public.%I', t || '_casquettes', t);
    execute format('create policy %I on public.%I for all using (bbc_greffe_ouvert()) with check (bbc_greffe_ouvert())',
                   t || '_casquettes', t);
  end loop;
end $$;

-- Les actes : lire pour toutes les casquettes ; ecrire pour toutes,
-- sauf un acte emis, reserve a qui signe.
drop policy if exists greffe_actes_proprio   on public.greffe_actes;
drop policy if exists greffe_actes_lire      on public.greffe_actes;
drop policy if exists greffe_actes_ecrire    on public.greffe_actes;
drop policy if exists greffe_actes_modifier  on public.greffe_actes;
drop policy if exists greffe_actes_supprimer on public.greffe_actes;

create policy greffe_actes_lire on public.greffe_actes
  for select using (bbc_greffe_ouvert());
create policy greffe_actes_ecrire on public.greffe_actes
  for insert with check (bbc_greffe_ouvert() and (bbc_greffe_signe() or coalesce(etat, '') <> 'emis'));
create policy greffe_actes_modifier on public.greffe_actes
  for update using      (bbc_greffe_ouvert() and (bbc_greffe_signe() or coalesce(etat, '') <> 'emis'))
             with check (bbc_greffe_ouvert() and (bbc_greffe_signe() or coalesce(etat, '') <> 'emis'));
create policy greffe_actes_supprimer on public.greffe_actes
  for delete using (bbc_greffe_signe());

-- VERIFICATIONS
--   select tablename, policyname, cmd from pg_policies
--    where tablename like 'greffe%' order by 1, 2;
--   -- attendu : dossiers et prereglages : _casquettes ; actes : lire,
--   --           ecrire, modifier, supprimer ; plus aucun _proprio
--   select has_function_privilege('anon', 'public.bbc_greffe_ouvert()', 'execute');
--   -- attendu : false
