-- =====================================================================
--  Baobabs Basket Club — Module « Notre histoire » (timeline)
--  À exécuter UNE FOIS dans Supabase : SQL Editor → New query → Run.
--  Idempotent : relançable sans risque (n'insère pas de doublon).
-- =====================================================================

create table if not exists timeline_events (
  id    uuid primary key default gen_random_uuid(),
  year  text,
  title text,
  body  text,
  sort  int default 0,
  created_at timestamptz default now()
);

alter table timeline_events enable row level security;

-- Lecture publique (le site lit avec la clé publique)
drop policy if exists "timeline read public" on timeline_events;
create policy "timeline read public" on timeline_events for select using (true);

-- Écriture réservée aux utilisateurs connectés (espace gestion)
drop policy if exists "timeline write auth" on timeline_events;
create policy "timeline write auth" on timeline_events for all to authenticated using (true) with check (true);

-- Contenu actuel du site (injecté seulement si la table est vide)
insert into timeline_events (year, title, body, sort)
select v.year, v.title, v.body, v.sort
from (values
  ('2026', 'Naissance du club',   'Un groupe de passionnés fonde les Baobabs à Dakar avec une ambition claire : former localement et viser haut dès la première saison.', 0),
  ('2026', 'Ouverture du centre', 'Le centre de formation ouvre ses portes et lance le recrutement de ses premières générations de licenciées.', 1),
  ('2026', 'Tryouts officiels',   'Détection ouverte à toutes les catégories les 25 et 26 juillet pour constituer les premiers effectifs du club.', 2),
  ('2027', 'Cap national',        'Objectif : disputer la première saison en Championnat D2 et représenter Dakar sur la scène nationale.', 3)
) as v(year, title, body, sort)
where not exists (select 1 from timeline_events);
