-- =====================================================================
--  BAOBABS TV : LES VIDEOS DU CLUB, RANGEES
--  --------------------------------------------------------------------
--  Point 4 de la feuille de route du 20 septembre. Le direct du soir de
--  match existe deja. Ce qui manquait, c'est l'endroit ou vivent les
--  videos APRES : le resume d'une journee, une rentree, un match revu.
--
--  CE QUI A DICTE LA FORME. Releve en base le 21 septembre : le club n'a
--  PAS de chaine YouTube -- yt_channel_id et social_youtube sont vides.
--  Il a deux fichiers dans /media/video. Une « TV » batie sur YouTube
--  aurait donc ete une vitrine vide le jour de sa mise en ligne.
--  La colonne « source » accepte les deux : un chemin de fichier servi
--  par le site, ou un lien YouTube / Facebook. Le site regarde la forme
--  et choisit son lecteur. Le jour ou le club ouvre une chaine, rien
--  n'est a refaire.
--
--  UNE VIDEO PEUT ETRE ATTACHEE A UN MATCH (match_id) : la fiche du
--  match affiche alors « Revoir le match ». Sans match, elle vit
--  seulement dans la TV.
--
--  A EXECUTER DANS L'EDITEUR SQL DE SUPABASE. Idempotent.
-- =====================================================================

create table if not exists public.videos (
  id          uuid primary key default gen_random_uuid(),
  titre       text not null,
  chapo       text,
  source      text not null,          /* /media/video/x.mp4 OU un lien */
  poster_url  text,
  categorie   text default 'club',    /* club, match, ecole, detection, coulisses */
  match_id    uuid references public.matches(id) on delete set null,
  duree_s     integer,
  publie      boolean not null default true,
  a_la_une    boolean not null default false,
  publie_le   date default current_date,
  ordre       integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists videos_ordre  on public.videos(publie, ordre, publie_le desc);
create index if not exists videos_match  on public.videos(match_id) where match_id is not null;

comment on column public.videos.source is
  'Un chemin servi par le site (/media/video/x.mp4) ou un lien YouTube '
  'ou Facebook. Le site deduit le lecteur de la forme.';
comment on column public.videos.a_la_une is
  'La video mise en avant dans le grand lecteur. S''il y en a plusieurs, '
  'la plus recente gagne ; s''il n''y en a aucune, la premiere de la liste.';

alter table public.videos enable row level security;

-- Le site lit avec la cle publique : il ne voit QUE ce qui est publie.
drop policy if exists "videos read public" on public.videos;
create policy "videos read public" on public.videos
  for select to anon using (publie = true);

-- L'admin voit tout, brouillons compris, et ecrit.
drop policy if exists "videos read auth" on public.videos;
create policy "videos read auth" on public.videos
  for select to authenticated using (true);

drop policy if exists "videos write auth" on public.videos;
create policy "videos write auth" on public.videos
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
--  LES DEUX VIDEOS QUE LE CLUB A DEJA.
--  Elles restent en place la ou elles sont (la pre-saison et la journee
--  de detection ont chacune leur bloc) : on les REFERENCE ici, on ne les
--  deplace pas. Injectees seulement si la table est vide, pour qu'une
--  relance de ce fichier n'en fasse pas des doublons.
-- ---------------------------------------------------------------------
insert into public.videos (titre, chapo, source, poster_url, categorie, duree_s, a_la_une, publie_le, ordre)
select v.titre, v.chapo, v.source, v.poster, v.cat, v.duree, v.une, v.le, v.ordre
from (values
  ('Pre-saison 2026-2027',
   'Le travail commence ici. Reprise pour les seniors feminines.',
   '/media/video/presaison-2026-2027.mp4',
   '/media/video/presaison-2026-2027-poster.webp',
   'club', 17, true, date '2026-09-05', 0),
  ('La journee de detection',
   'Deux jours, un terrain, et tous ceux qui sont venus tenter leur chance.',
   '/media/video/detection-2026-07.mp4',
   '/media/video/detection-2026-07-poster.webp',
   'detection', 38, false, date '2026-07-26', 1)
) as v(titre, chapo, source, poster, cat, duree, une, le, ordre)
where not exists (select 1 from public.videos);
