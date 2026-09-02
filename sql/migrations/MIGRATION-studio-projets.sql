-- =====================================================================
-- BAOBABS STUDIO — table des projets
-- =====================================================================
-- À exécuter une fois dans l'éditeur SQL de Supabase.
--
-- Sans cette table, le Studio fonctionne quand même : il le dit dans la
-- console et le panneau « Projets » reste vide. Rien ne casse — mais
-- rien ne se garde non plus d'une session à l'autre.
--
-- Un projet, c'est le document complet : la liste des calques, leurs
-- styles, leurs liaisons aux données. Le rouvrir, c'est reprendre le
-- travail, pas repartir d'une image aplatie.
-- =====================================================================

create table if not exists public.studio_projets (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null default 'Sans titre',
  format      text,
  est_modele  boolean not null default false,
  doc         jsonb not null,
  cree_le     timestamptz not null default now(),
  modifie_le  timestamptz not null default now(),
  cree_par    uuid default auth.uid()
);

comment on table  public.studio_projets is 'Affiches composées dans Baobabs Studio. `doc` contient tous les calques.';
comment on column public.studio_projets.est_modele is 'true = modèle réutilisable ; l''ouvrir crée une copie au lieu de l''écraser.';
comment on column public.studio_projets.doc is 'Document JSON du Studio : format, fond, palette, repères, calques.';

create index if not exists studio_projets_modifie_idx
  on public.studio_projets (modifie_le desc);
create index if not exists studio_projets_modele_idx
  on public.studio_projets (est_modele) where est_modele;

-- ---------------------------------------------------------------------
-- Sécurité : réservé à l'administration.
-- is_admin() existe déjà (MIGRATION-phase0-socle.sql). Aucune lecture
-- anonyme : une affiche en préparation n'a pas à être publique.
-- ---------------------------------------------------------------------
alter table public.studio_projets enable row level security;

drop policy if exists studio_projets_admin on public.studio_projets;
create policy studio_projets_admin on public.studio_projets
  for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- `modifie_le` est envoyé par le client, mais on ne lui fait pas
-- confiance : un déclencheur le repose à chaque écriture.
-- ---------------------------------------------------------------------
create or replace function public.studio_projets_touch()
returns trigger language plpgsql as $$
begin
  new.modifie_le := now();
  if tg_op = 'UPDATE' then
    new.cree_le := old.cree_le;
    new.cree_par := old.cree_par;
  end if;
  return new;
end $$;

drop trigger if exists studio_projets_touch_trg on public.studio_projets;
create trigger studio_projets_touch_trg
  before insert or update on public.studio_projets
  for each row execute function public.studio_projets_touch();

-- ---------------------------------------------------------------------
-- Vérification
-- ---------------------------------------------------------------------
-- select id, nom, format, est_modele, modifie_le
--   from public.studio_projets order by modifie_le desc;
--
-- Les politiques en place :
-- select polname, polcmd from pg_policy
--   where polrelid = 'public.studio_projets'::regclass;
