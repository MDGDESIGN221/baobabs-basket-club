-- =====================================================================
--  LE GREFFE : C'EST LE PROPRIETAIRE QUI DONNE L'ACCES, COMPTE PAR COMPTE
--  --------------------------------------------------------------------
--  « je voudrais aussi sur mon compte pouvoir donner acces a qui je
--    veux au greffe » (20 septembre 2026).
--
--  Le matin meme, l'acces suivait la casquette (admin, presidence,
--  coach, direction sportive). Mais une casquette se distribue par tout
--  super administrateur, alors que le Greffe engage la signature du
--  president : la porte doit se donner a la main, par le proprietaire,
--  et par personne d'autre.
--
--    greffe_acces   une ligne par compte admis : composer ou signer.
--                   Lisible par tout admin (l'ecran Comptes l'affiche),
--                   ecrite par le proprietaire seul.
--
--  Le proprietaire est toujours dedans, et signe toujours. Les deux
--  fonctions que les politiques du registre lisent (bbc_greffe_ouvert,
--  bbc_greffe_signe) cessent de regarder le role : elles regardent
--  cette table. Aucune ligne au depart : le proprietaire donne les
--  acces depuis l'ecran Comptes.
--
--  A EXECUTER DANS L'EDITEUR SQL DE SUPABASE (ou par le MCP).
-- =====================================================================

create table if not exists public.greffe_acces (
  user_id   uuid primary key references public.admin_users (user_id) on delete cascade,
  niveau    text not null check (niveau in ('composer', 'signer')),
  donne_par text,
  donne_le  timestamptz not null default now()
);
comment on table public.greffe_acces is
  'Qui peut ouvrir le Greffe, et si sa main pose la signature. Ecrit par '
  'le proprietaire seul, depuis l''ecran Comptes.';

alter table public.greffe_acces enable row level security;
drop policy if exists greffe_acces_lire    on public.greffe_acces;
drop policy if exists greffe_acces_proprio on public.greffe_acces;
create policy greffe_acces_lire on public.greffe_acces
  for select using (is_admin());
create policy greffe_acces_proprio on public.greffe_acces
  for all using (bbc_est_proprietaire()) with check (bbc_est_proprietaire());

create or replace function public.bbc_greffe_ouvert()
returns boolean language sql stable security definer set search_path = public as $$
  select bbc_est_proprietaire()
      or exists (select 1 from greffe_acces where user_id = auth.uid());
$$;
create or replace function public.bbc_greffe_signe()
returns boolean language sql stable security definer set search_path = public as $$
  select bbc_est_proprietaire()
      or exists (select 1 from greffe_acces where user_id = auth.uid() and niveau = 'signer');
$$;
revoke execute on function public.bbc_greffe_ouvert() from public, anon;
revoke execute on function public.bbc_greffe_signe()  from public, anon;
grant  execute on function public.bbc_greffe_ouvert(), public.bbc_greffe_signe() to authenticated;

-- VERIFICATIONS
--   select policyname, cmd from pg_policies where tablename = 'greffe_acces';
--   -- attendu : greffe_acces_lire (SELECT), greffe_acces_proprio (ALL)
--   select * from public.greffe_acces;
--   -- attendu au depart : aucune ligne ; le proprietaire donne les acces
--   -- depuis l'ecran Comptes, et chaque ligne apparait ici.
