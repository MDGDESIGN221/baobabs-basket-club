-- ============================================================================
-- LES PRESENTATIONS DE JOUEUSES
-- 19 septembre 2026
-- ============================================================================
-- Le Cinq majeur de l'accueil ne sait annoncer qu'une chose : les cinq d'un
-- match, lus dans la composition (match_stats). Le president vient d'envoyer
-- la liste des douze selectionnees pour le tournoi de Nouakchott : ce n'est
-- ni un match ni un cinq, et rien ne pouvait le montrer.
--
-- Une PRESENTATION est une liste ordonnee de joueuses (et du staff qui les
-- accompagne) avec un titre, rattachee ou non a un evenement :
--   selection    les selectionnees pour un tournoi, un stage, un deplacement
--   libre        n'importe quelle liste titree (recrues, capitaines, U18...)
-- Le Cinq majeur reste ce qu'il est : il n'est pas copie ici, il se lit
-- toujours dans la composition du match. L'accueil montre l'un ou l'autre
-- selon site_settings.lineup_mode :
--   auto | match | off        (comme avant)
--   presentation              + lineup_presentation_id
-- Le staff est la pour la liste officielle (le Greffe) : la delegation qui
-- part, joueuses ET encadrement.
-- ============================================================================

create table if not exists public.presentations (
  id            uuid primary key default gen_random_uuid(),
  titre         text not null,                     -- « La sélection »
  kicker        text,                              -- « Women's Sport International »
  sous_titre    text,                              -- « 12 joueuses pour Nouakchott »
  type          text not null default 'selection', -- selection | libre
  evenement_id  uuid references public.evenements(id) on delete set null,
  actif         boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.presentation_joueuses (
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  player_id       uuid not null references public.players(id) on delete cascade,
  sort            integer,
  is_captain      boolean not null default false,
  primary key (presentation_id, player_id)
);

create table if not exists public.presentation_staff (
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  staff_id        uuid not null references public.staff(id) on delete cascade,
  sort            integer,
  fonction        text,                            -- ce qu'il ou elle fait sur ce deplacement
  primary key (presentation_id, staff_id)
);

-- Memes droits que les evenements : tout le monde lit, l'admin ecrit.
alter table public.presentations          enable row level security;
alter table public.presentation_joueuses  enable row level security;
alter table public.presentation_staff     enable row level security;

drop policy if exists presentations_lecture  on public.presentations;
drop policy if exists presentations_ecriture on public.presentations;
create policy presentations_lecture  on public.presentations for select using (true);
create policy presentations_ecriture on public.presentations for all using (is_admin()) with check (is_admin());

drop policy if exists presentation_joueuses_lecture  on public.presentation_joueuses;
drop policy if exists presentation_joueuses_ecriture on public.presentation_joueuses;
create policy presentation_joueuses_lecture  on public.presentation_joueuses for select using (true);
create policy presentation_joueuses_ecriture on public.presentation_joueuses for all using (is_admin()) with check (is_admin());

drop policy if exists presentation_staff_lecture  on public.presentation_staff;
drop policy if exists presentation_staff_ecriture on public.presentation_staff;
create policy presentation_staff_lecture  on public.presentation_staff for select using (true);
create policy presentation_staff_ecriture on public.presentation_staff for all using (is_admin()) with check (is_admin());

grant select on public.presentations, public.presentation_joueuses, public.presentation_staff to anon, authenticated;
grant insert, update, delete on public.presentations, public.presentation_joueuses, public.presentation_staff to authenticated;

-- ----------------------------------------------------------------------------
-- LA SELECTION DE NOUAKCHOTT, telle que le president l'a envoyee le
-- 19/09/2026 (douze noms). Onze ont une fiche sur le site ; « Coumba
-- Ndiaye » n'en a pas, elle n'est donc pas ici : on ne cree pas une joueuse
-- depuis un correctif. Les numeros de maillot sont ceux du site, pas ceux
-- de la liste (plusieurs ont change recemment).
-- ----------------------------------------------------------------------------
insert into public.presentations (id, titre, kicker, sous_titre, type, evenement_id)
values ('7a1e6a6e-0f3e-4c5a-9b1e-2026092312aa', 'La sélection', 'Women''s Sport International · Nouakchott',
        '12 joueuses pour représenter le club', 'selection', '1eba88ae-5be5-4463-ab88-afc85160bda9')
on conflict (id) do nothing;

insert into public.presentation_joueuses (presentation_id, player_id, sort, is_captain) values
  ('7a1e6a6e-0f3e-4c5a-9b1e-2026092312aa', '066e9600-6b66-47fa-8d1a-7e2471e429d5',  1, false), -- Bassine Mbaye
  ('7a1e6a6e-0f3e-4c5a-9b1e-2026092312aa', '4a01bac5-5d04-4c52-ab71-75033fa716a2',  3, false), -- Mame Diarra Ndong
  ('7a1e6a6e-0f3e-4c5a-9b1e-2026092312aa', '943c5339-8b98-4392-a897-a4c7e38b04db',  4, false), -- Astou Faye
  ('7a1e6a6e-0f3e-4c5a-9b1e-2026092312aa', '763b734d-c091-4893-869d-3266be489eae',  5, false), -- Ndeye Siga Sarr
  ('7a1e6a6e-0f3e-4c5a-9b1e-2026092312aa', '7b2ce688-152b-43a2-9095-dd72e89f76c0',  6, false), -- Bernadette Béatrice Dioh
  ('7a1e6a6e-0f3e-4c5a-9b1e-2026092312aa', '29a5c9a9-0cc1-4960-b577-53509ffd500a',  7, false), -- Mareme Diakhate
  ('7a1e6a6e-0f3e-4c5a-9b1e-2026092312aa', '07c5978d-da93-49a0-832e-c04a6439e0ff',  8, false), -- Seynabou Gaye
  ('7a1e6a6e-0f3e-4c5a-9b1e-2026092312aa', '82479e76-1c3e-4e0c-8dd2-36c47244e1e4',  9, false), -- Anta Gaye
  ('7a1e6a6e-0f3e-4c5a-9b1e-2026092312aa', '3ef83b91-8d8e-462e-9448-4543a11a973f', 10, false), -- Fatou Thiam
  ('7a1e6a6e-0f3e-4c5a-9b1e-2026092312aa', '9156d94d-63e3-4aa1-8c25-6ba0020b8c4e', 11, false), -- Kine Gueye
  ('7a1e6a6e-0f3e-4c5a-9b1e-2026092312aa', '36529691-629d-408a-8442-0d614211770a', 12, false)  -- Mamy Boukinda
on conflict do nothing;
