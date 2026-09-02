-- =====================================================================
--  Baobabs Basket Club — Migration : BANNIÈRES & SLIDER
--  Supabase → SQL Editor → New query → Run. Réexécutable sans risque.
--
--  Ce que ça pose :
--    1. Table banners — les slides du hero de l'accueil
--    2. Table announcements — le bandeau d'annonce en haut du site
--    3. Vue banners_public — uniquement ce qui est en ligne aujourd'hui
--
--  L'image du hero reste réglable dans « Image du hero » : si aucune
--  bannière n'est active, le site retombe sur elle. Rien ne casse.
-- =====================================================================


-- =====================================================================
-- 1. BANNIÈRES DU HERO
--    Le hero était UNE image fixe. Avec plusieurs slides, on peut mettre
--    en avant le prochain match, une actualité et la boutique sans
--    réécrire la page à chaque fois.
--
--    starts_at / ends_at : une bannière peut être programmée. C'est ce qui
--    évite d'avoir à se lever le matin du match pour la publier.
-- =====================================================================
create table if not exists banners (
  id          uuid primary key default gen_random_uuid(),
  title       text,
  subtitle    text,
  kicker      text,                       -- la sur-titre en petites capitales
  image_url   text,
  image_alt   text,
  cta_label   text,
  cta_href    text,
  title_color    text,
  subtitle_color text,
  -- Cadrage : la même image ne se recadre pas pareil selon le sujet.
  focus_x     integer default 50,
  focus_y     integer default 50,
  zoom        integer default 100,
  is_active   boolean not null default false,
  starts_at   timestamptz,
  ends_at     timestamptz,
  sort        integer default 0,
  created_at  timestamptz not null default now()
);

alter table banners enable row level security;

drop policy if exists banners_read on banners;
create policy banners_read on banners
  for select using (true);

drop policy if exists banners_write on banners;
create policy banners_write on banners
  for all using (is_admin()) with check (is_admin());

create index if not exists banners_active_idx on banners (is_active, sort);


-- =====================================================================
-- 2. BANDEAU D'ANNONCE
--    Une seule ligne active à la fois : un bandeau qui en annonce deux
--    n'annonce rien. Le déclencheur ci-dessous le garantit.
-- =====================================================================
create table if not exists announcements (
  id         uuid primary key default gen_random_uuid(),
  message    text not null,
  cta_label  text,
  cta_href   text,
  tone       text not null default 'info',   -- 'info' | 'alerte' | 'succes'
  is_active  boolean not null default false,
  starts_at  timestamptz,
  ends_at    timestamptz,
  created_at timestamptz not null default now()
);

alter table announcements enable row level security;

drop policy if exists announcements_read on announcements;
create policy announcements_read on announcements
  for select using (true);

drop policy if exists announcements_write on announcements;
create policy announcements_write on announcements
  for all using (is_admin()) with check (is_admin());

-- Activer une annonce désactive les autres : plutôt que de compter sur
-- l'utilisateur pour le faire, la base s'en charge.
create or replace function bbc_one_announcement()
returns trigger language plpgsql as $$
begin
  if new.is_active then
    update announcements set is_active = false
     where id is distinct from new.id and is_active;
  end if;
  return new;
end;
$$;

drop trigger if exists announcements_single on announcements;
create trigger announcements_single
  after insert or update of is_active on announcements
  for each row when (new.is_active) execute function bbc_one_announcement();


-- =====================================================================
-- 3. VUES PUBLIQUES
--    « en ligne aujourd'hui » est calculé ici : le site n'a pas à
--    comparer des dates, et une bannière programmée s'affiche d'elle-même.
-- =====================================================================
drop view if exists banners_public;

create view banners_public as
select *
from banners
where is_active
  and (starts_at is null or starts_at <= now())
  and (ends_at   is null or ends_at   >= now())
order by sort asc, created_at asc;

alter view banners_public set (security_invoker = on);

drop view if exists announcement_public;

create view announcement_public as
select *
from announcements
where is_active
  and (starts_at is null or starts_at <= now())
  and (ends_at   is null or ends_at   >= now())
order by created_at desc
limit 1;

alter view announcement_public set (security_invoker = on);


-- =====================================================================
--  Vérification après exécution :
--    select title, is_active, starts_at, ends_at, sort from banners order by sort;
--    select * from banners_public;
--    select message, tone from announcement_public;
--
--  Les deux tables démarrent VIDES : le site continue d'afficher l'image
--  du hero telle que vous l'avez réglée, et aucun bandeau n'apparaît.
-- =====================================================================
