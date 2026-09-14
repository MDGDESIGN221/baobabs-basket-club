-- =====================================================================
--  LA JOUEUSE : ses documents, ses entrainements
--  --------------------------------------------------------------------
--  L'ecole avait ses seances et son appel (academy_*), l'equipe n'avait
--  rien : ni entrainements, ni presences, ni licence, ni certificat.
--  Une joueuse existait par sa fiche et ses matchs, c'est tout.
--
--  players_documents  les pieces d'une joueuse, avec leur echeance :
--                     licence, certificat medical, piece d'identite,
--                     autorisation parentale (mineure), photo, autre.
--                     Une piece qui expire se signale a l'avance.
--  team_sessions      les entrainements de l'equipe (planning hebdo par
--                     team_schedule, seances datees, annulables).
--  team_attendance    l'appel : present, retard, excusee, absente.
--
--  Module de droits « effectif » : le coach voit et ecrit, comme pour
--  les fiches. Les pieces ne sont visibles que de l'administration :
--  players est lisible par le site, ces tables non.
-- =====================================================================

create table if not exists public.players_documents (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players(id) on delete cascade,
  kind        text not null check (kind in ('licence','medical','identite','autorisation','photo','autre')),
  reference   text,            -- numero de licence, par exemple
  url         text,            -- la piece, quand elle est numerisee
  received_on date,
  expires_on  date,            -- certificat medical : un an ; licence : fin de saison
  note        text,
  author      text,
  created_at  timestamptz not null default now()
);
create index if not exists players_documents_player on public.players_documents (player_id);
select bbc_policies_module('players_documents','effectif');

create table if not exists public.team_schedule (
  id         uuid primary key default gen_random_uuid(),
  weekday    smallint not null check (weekday between 1 and 7),
  start_time text not null,
  end_time   text,
  venue      text,
  coach      text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
select bbc_policies_module('team_schedule','effectif');

create table if not exists public.team_sessions (
  id            uuid primary key default gen_random_uuid(),
  session_date  date not null,
  start_time    text,
  end_time      text,
  venue         text,
  coach         text,
  note          text,
  cancelled     boolean not null default false,
  cancel_reason text,
  created_at    timestamptz not null default now()
);
create unique index if not exists team_sessions_unique on public.team_sessions (session_date, coalesce(start_time,''));
select bbc_policies_module('team_sessions','effectif');

create table if not exists public.team_attendance (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.team_sessions(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  statut      text not null default 'present' check (statut in ('present','absent','excuse','retard')),
  note        text,
  updated_at  timestamptz not null default now(),
  unique (session_id, player_id)
);
create index if not exists team_attendance_player on public.team_attendance (player_id);
select bbc_policies_module('team_attendance','effectif');
