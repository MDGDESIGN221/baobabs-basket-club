-- =====================================================================
--  LE GREFFE : le registre des actes en base
--  --------------------------------------------------------------------
--  Jusqu'ici les actes du Greffe vivaient dans IndexedDB, dans UN
--  navigateur : un cache vide, un autre ordinateur, et le registre du
--  club n'existait plus. Trois tables miroir, reservees au proprietaire
--  du site (la seule personne qui signe et appose le cachet) :
--    greffe_actes        un acte par ligne, la fiche entiere en jsonb
--    greffe_dossiers     les dossiers qui rangent les actes
--    greffe_prereglages  les pre-reglages de mise en page
--  Le Greffe garde IndexedDB comme cache de travail (il marche hors
--  ligne) et pousse chaque ecriture ici ; a l'ouverture il ramene ce
--  qu'il n'a pas, le plus recent (maj) l'emportant.
--
--  Les polices et le cachet ne montent PAS : regle 2 du Greffe, le cachet
--  reste dans le navigateur du president.
-- =====================================================================

create or replace function public.bbc_est_proprietaire()
returns boolean language sql stable set search_path = public as $$
  select coalesce(lower(auth.jwt() ->> 'email') = lower(bbc_proprietaire_email()), false);
$$;
grant execute on function public.bbc_est_proprietaire() to anon, authenticated;

create table if not exists public.greffe_actes (
  id         text primary key,
  modele     text,
  numero     text,
  etat       text,
  intitule   text,
  dossier    text,
  fiche      jsonb not null,
  maj        bigint not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists greffe_actes_maj on public.greffe_actes (maj desc);

create table if not exists public.greffe_dossiers (
  id         text primary key,
  fiche      jsonb not null,
  maj        bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.greffe_prereglages (
  id         text primary key,
  fiche      jsonb not null,
  maj        bigint not null default 0,
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['greffe_actes','greffe_dossiers','greffe_prereglages'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_proprio', t);
    execute format('create policy %I on public.%I for all using (bbc_est_proprietaire()) with check (bbc_est_proprietaire())', t || '_proprio', t);
  end loop;
end $$;
