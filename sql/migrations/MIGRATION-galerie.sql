-- ============================================================
--  LA GALERIE — DES PHOTOS QUI S'AJOUTENT SANS TOUCHER AU CODE
-- ============================================================
--  À passer dans Supabase → SQL Editor.
--
--  POURQUOI CE FICHIER
--  Les douze photos de la journée de détection sont aujourd'hui
--  ÉCRITES DANS LE CODE du site : `detection-2026-01` à `-12`,
--  numérotées à la main. Ajouter la treizième demande de rouvrir
--  index.html. Ce n'est pas une galerie, c'est une liste en dur.
--
--  À côté, la section « Vidéos & photos » de l'accueil tient trois
--  emplacements remplis un par un dans les réglages — dont deux sont
--  vides depuis toujours. Deux blocs d'images sur la même page, et
--  aucun des deux administrable.
--
--  CE QUE CETTE TABLE CHANGE : une ligne = une photo. On en ajoute
--  une, on la classe, on la retire, depuis l'administration. Le site
--  suit tout seul.
--
--  RIEN N'EST PERDU : la section C recopie les douze photos et le
--  film existants dans la table. Le site les affichera exactement
--  comme avant — à ceci près qu'ils deviendront modifiables.
--
--  Le script est en cinq temps : on CONSTATE, on CRÉE, on REPREND
--  l'existant, on OUVRE la lecture, on VÉRIFIE. La section F annule.
-- ============================================================


-- ============================================================
--  A · CONSTAT
-- ============================================================

select 'A1 · la table existe déjà ?' as controle,
       case when exists (select 1 from information_schema.tables
                         where table_schema = 'public' and table_name = 'gallery')
            then 'oui — la section B ne fera rien, la C ne doublera pas'
            else 'non — tout est à créer' end as detail;


-- ============================================================
--  B · LA TABLE
-- ============================================================
--  Une ligne peut porter une PHOTO ou un FILM : la journée de
--  détection a les deux, et les séparer en deux tables obligerait à
--  les recoller à l'affichage.
--
--  Le cadrage suit la même convention que partout ailleurs sur le
--  site — trois nombres, x, y et zoom. Une photo mal cadrée se règle
--  donc dans l'administration, pas dans un logiciel de retouche.

create table if not exists public.gallery (
  id          uuid primary key default gen_random_uuid(),

  album       text not null default 'Le club',   -- « Journée de détection », « Match du 12 juillet »…
  caption     text,                              -- légende, facultative
  taken_on    date,                              -- la date de la prise de vue

  image_url   text not null,                     -- la photo, ou l'affiche du film
  image_x     smallint not null default 50 check (image_x between 0 and 100),
  image_y     smallint not null default 50 check (image_y between 0 and 100),
  image_zoom  smallint not null default 100 check (image_zoom between 100 and 300),

  -- Renseigné seulement pour un film. Le site met alors un bouton de
  -- lecture sur la vignette au lieu d'ouvrir la photo en grand.
  video_url   text,

  sort        integer not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists gallery_album_idx on public.gallery (album, sort);


-- ============================================================
--  C · ON REPREND L'EXISTANT
-- ============================================================
--  Les douze photos et le film, tels qu'ils sont servis aujourd'hui.
--  « where not exists » : repasser le script ne les doublera pas.

insert into public.gallery (album, image_url, video_url, sort, taken_on)
select 'Journée de détection', v.img, v.vid, v.ord, date '2026-07-12'
from (values
  ('/media/img/detection-2026-01.webp', null::text,  1),
  ('/media/img/detection-2026-02.webp', null,        2),
  ('/media/img/detection-2026-03.webp', null,        3),
  ('/media/img/detection-2026-04.webp', null,        4),
  ('/media/img/detection-2026-05.webp', null,        5),
  ('/media/img/detection-2026-06.webp', null,        6),
  ('/media/img/detection-2026-07.webp', null,        7),
  ('/media/img/detection-2026-08.webp', null,        8),
  ('/media/img/detection-2026-09.webp', null,        9),
  ('/media/img/detection-2026-10.webp', null,       10),
  ('/media/img/detection-2026-11.webp', null,       11),
  ('/media/img/detection-2026-12.webp', null,       12),
  ('/media/video/detection-2026-07-poster.webp',
   '/media/video/detection-2026-07.mp4',             0)
) as v(img, vid, ord)
where not exists (select 1 from public.gallery g where g.image_url = v.img);


-- ============================================================
--  D · QUI PEUT LIRE, QUI PEUT ÉCRIRE
-- ============================================================
--  Le visiteur ne voit que ce qui est publié. L'administration écrit.
--  Une politique est au niveau de la LIGNE : « published » suffit donc
--  à garder une photo au chaud sans la montrer.

alter table public.gallery enable row level security;

drop policy if exists "galerie lisible par tous" on public.gallery;
create policy "galerie lisible par tous"
  on public.gallery for select
  to anon, authenticated
  using (published = true);

drop policy if exists "galerie ecrite par l administration" on public.gallery;
create policy "galerie ecrite par l administration"
  on public.gallery for all
  to authenticated
  using (true) with check (true);

grant select on public.gallery to anon;
grant select, insert, update, delete on public.gallery to authenticated;


-- ============================================================
--  E · VÉRIFICATION
-- ============================================================

select 'E1 · ce que contient la galerie' as controle,
       count(*)::text || ' ligne(s), dont ' ||
       count(*) filter (where video_url is not null)::text || ' film(s)' as detail
from public.gallery;

select 'E2 · les albums' as controle,
       string_agg(album || ' (' || n::text || ')', ' | ' order by album) as detail
from (select album, count(*) as n from public.gallery group by album) x;

select 'E3 · le visiteur peut lire' as controle,
       coalesce(string_agg(grantee, ', '), 'AUCUN — le site ne verra rien') as detail
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'gallery'
  and privilege_type = 'SELECT' and grantee in ('anon', 'authenticated');

select 'E4 · RLS active' as controle,
       case when relrowsecurity then 'oui' else 'NON — la table est ouverte à tous' end as detail
from pg_class where oid = 'public.gallery'::regclass;

--  Le contrôle qui compte : la même requête que le site.
select 'E5 · ce que le site lira' as controle,
       coalesce(string_agg(coalesce(caption, image_url), ' | ' order by sort), 'rien') as detail
from public.gallery where published = true;


-- ============================================================
--  F · POUR REVENIR EN ARRIÈRE
-- ============================================================
--  Décommentez. Le site retombera sur sa liste écrite en dur : il
--  fonctionne avant comme après.
--
-- drop table if exists public.gallery;
