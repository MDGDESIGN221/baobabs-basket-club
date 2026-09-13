-- =====================================================================
--  LE MATCH, DE J-7 A J+1 : ce que le parcours a besoin de savoir
--  --------------------------------------------------------------------
--  L'ecran « Le match » enchaine ce qui existait deja (fiche, cinq,
--  billetterie, direct, resultat, classement) et ce qui manquait :
--  la convocation, le lien entre un match et son affiche, son article,
--  ses photos. Rien de tout cela n'avait de place en base.
--
--  1. matches : le rendez-vous d'avant-match (heure, lieu, consignes).
--  2. match_convocations : qui est convoquee, qui a confirme, qui manque.
--  3. players_contacts : le telephone d'une joueuse, HORS de players.
--     players est lisible par tout le monde (le site affiche l'effectif) ;
--     un numero de telephone n'a rien a faire dans une table publique.
--  4. news.match_id, gallery.match_id : l'article et les photos d'un match
--     se retrouvent sans deviner sur un titre.
--  5. Le Studio inscrit doc->>'matchId' dans studio_projets : aucune
--     colonne a ajouter, un index sur l'expression suffit.
--  6. Deux trous de securite vus en passant : matches acceptait
--     insertion, modification et suppression ANONYMES (policies
--     « Public ... matches » a true) ; news avait une lecture publique
--     sans filtre qui rendait les brouillons visibles de tous.
-- =====================================================================

-- 1. Le rendez-vous d'avant-match
alter table public.matches
  add column if not exists rdv_heure text,
  add column if not exists rdv_lieu  text,
  add column if not exists consignes text;

-- 2. Les convocations
create table if not exists public.match_convocations (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  statut     text not null default 'convoquee'
             check (statut in ('convoquee','confirmee','absente','blessee')),
  note       text,
  updated_at timestamptz not null default now(),
  unique (match_id, player_id)
);
create index if not exists match_convocations_match on public.match_convocations (match_id);
select bbc_policies_module('match_convocations','matchs');

-- 3. Les coordonnees d'une joueuse, reservees a l'administration
create table if not exists public.players_contacts (
  player_id      uuid primary key references public.players(id) on delete cascade,
  phone          text,
  email          text,
  guardian_name  text,
  guardian_phone text,
  updated_at     timestamptz not null default now()
);
select bbc_policies_module('players_contacts','effectif');

-- 4. L'article et les photos d'un match
alter table public.news    add column if not exists match_id uuid references public.matches(id) on delete set null;
alter table public.gallery add column if not exists match_id uuid references public.matches(id) on delete set null;
create index if not exists news_match    on public.news (match_id);
create index if not exists gallery_match on public.gallery (match_id);

-- 5. L'affiche d'un match (le Studio ecrit doc.matchId)
create index if not exists studio_projets_match on public.studio_projets ((doc->>'matchId'));

-- 6. Les deux trous
drop policy if exists "Public delete matches" on public.matches;
drop policy if exists "Public insert matches" on public.matches;
drop policy if exists "Public update matches" on public.matches;
drop policy if exists "public read news" on public.news;   -- reste news_public_read : publie, ou administrateur

-- 7. Les vues de l'admin apprennent les nouvelles colonnes (ajoutees en
--    fin de liste : create or replace view l'exige).
create or replace view public.articles_admin as
 SELECT n.id, n.title, n.body, n.image_url, n.published_at, n.sort, n.created_at,
    n.image_url_x, n.image_url_y, n.image_url_zoom, n.status, n.slug, n.excerpt,
    n.category, n.author, n.image_alt, n.seo_title, n.seo_description, n.updated_at,
    c.color AS category_color,
    length(COALESCE(n.body, ''::text)) AS longueur,
    GREATEST(1::numeric, round(array_length(regexp_split_to_array(COALESCE(n.body, ''::text), '\s+'::text), 1)::numeric / 200.0)) AS minutes_lecture,
    n.match_id
   FROM news n
     LEFT JOIN news_categories c ON c.name = n.category;

create or replace view public.match_center as
 SELECT m.id, m.opponent_name, m.opponent_logo_url, m.match_date, m.match_time, m.venue, m.is_home,
    m.competition, m.score_baobabs, m.score_opponent, m.created_at, m.photo_url, m.stream_url,
    m.notes, m.quarters, m.recap, m.referees, m.attendance, m.round_label, m.free_entry,
    COALESCE(o.nb_categories, 0::bigint) AS nb_categories,
    COALESCE(o.places_totales, 0::bigint) AS places_totales,
    COALESCE(o.places_reservees, 0::bigint) AS places_reservees,
    COALESCE(o.places_restantes, 0::bigint) AS places_restantes,
    COALESCE(o.vente_ouverte, false) AS vente_ouverte,
        CASE
            WHEN m.score_baobabs IS NOT NULL AND m.score_opponent IS NOT NULL THEN 'termine'::text
            WHEN m.match_date < CURRENT_DATE THEN 'a_saisir'::text
            WHEN m.match_date = CURRENT_DATE THEN 'aujourdhui'::text
            ELSE 'a_venir'::text
        END AS statut,
        CASE
            WHEN m.score_baobabs IS NULL OR m.score_opponent IS NULL THEN NULL::text
            WHEN m.score_baobabs > m.score_opponent THEN 'V'::text
            WHEN m.score_baobabs < m.score_opponent THEN 'D'::text
            ELSE 'N'::text
        END AS issue,
    m.rdv_heure, m.rdv_lieu, m.consignes
   FROM matches m
     LEFT JOIN ( SELECT ticket_offers.match_id,
            count(*) AS nb_categories,
            sum(ticket_offers.quota) AS places_totales,
            sum(ticket_offers.sold) AS places_reservees,
            sum(GREATEST(ticket_offers.quota - ticket_offers.sold, 0)) AS places_restantes,
            bool_or(ticket_offers.is_open) AS vente_ouverte
           FROM ticket_offers
          GROUP BY ticket_offers.match_id) o ON o.match_id = m.id;
