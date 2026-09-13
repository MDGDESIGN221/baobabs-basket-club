-- =====================================================================
--  L'ECOLE DE BASKET, LE MOIS : seances, presences, planning
--  --------------------------------------------------------------------
--  Les inscriptions savaient qui est inscrit et qui a paye. Elles ne
--  savaient pas QUAND l'ecole s'entraine ni QUI est venu : pas de seance,
--  pas de presence, donc pas de « absent trois fois de suite », pas de
--  taux de presence, rien a dire aux parents.
--
--  academy_schedule   : le planning de la semaine (mardi 17h U11...).
--  academy_sessions   : une seance datee, creee a la main ou generee
--                       depuis le planning ; annulable avec un motif.
--  academy_attendance : l'appel, une ligne par enfant et par seance.
--
--  Meme module RLS que les inscriptions : ceux qui voient les dossiers
--  voient les presences, et personne d'autre.
-- =====================================================================

create table if not exists public.academy_schedule (
  id         uuid primary key default gen_random_uuid(),
  category   text,                         -- null = tous les groupes
  weekday    smallint not null check (weekday between 1 and 7),   -- 1 = lundi
  start_time text not null,                -- « 17:00 »
  end_time   text,
  venue      text,
  coach      text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
select bbc_policies_module('academy_schedule','inscriptions');

create table if not exists public.academy_sessions (
  id            uuid primary key default gen_random_uuid(),
  session_date  date not null,
  start_time    text,
  end_time      text,
  category      text,                      -- null = tous les groupes
  venue         text,
  coach         text,
  note          text,
  cancelled     boolean not null default false,
  cancel_reason text,
  created_at    timestamptz not null default now()
);
create unique index if not exists academy_sessions_unique
  on public.academy_sessions (session_date, coalesce(start_time,''), coalesce(category,''));
create index if not exists academy_sessions_date on public.academy_sessions (session_date);
select bbc_policies_module('academy_sessions','inscriptions');

create table if not exists public.academy_attendance (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.academy_sessions(id) on delete cascade,
  registration_id uuid not null references public.academy_registrations(id) on delete cascade,
  statut          text not null default 'present'
                  check (statut in ('present','absent','excuse','retard')),
  note            text,
  updated_at      timestamptz not null default now(),
  unique (session_id, registration_id)
);
create index if not exists academy_attendance_reg on public.academy_attendance (registration_id);
select bbc_policies_module('academy_attendance','inscriptions');
