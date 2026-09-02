-- =====================================================================
--  Baobabs Basket Club — Migration : PUBLICATIONS
--  Supabase → SQL Editor → New query → Run. Réexécutable sans risque.
--
--  Ce que ça pose :
--    1. Colonnes de rédaction sur news (brouillon, chapô, auteur, SEO)
--    2. Adresse lisible (slug), attribuée automatiquement
--    3. Table des catégories
--    4. Vue articles_admin
--
--  Aucune colonne existante n'est modifiée ni supprimée. Les actualités
--  déjà en ligne passent automatiquement en « publié » : rien ne
--  disparaît du site.
-- =====================================================================


-- =====================================================================
-- 1. COLONNES DE RÉDACTION
--    status : 'brouillon' | 'publie' | 'archive'
--    Le brouillon est ce qui manquait le plus : jusqu'ici, enregistrer
--    une actualité la publiait aussitôt.
-- =====================================================================
alter table news
  add column if not exists status          text not null default 'publie',
  add column if not exists slug            text,
  add column if not exists excerpt         text,   -- chapô, repris dans les listes
  add column if not exists category        text,
  add column if not exists author          text,
  add column if not exists image_alt       text,   -- accessibilité et référencement
  add column if not exists seo_title       text,
  add column if not exists seo_description text,
  add column if not exists updated_at      timestamptz;

create index if not exists news_status_idx    on news (status);
create index if not exists news_published_idx on news (published_at desc);


-- =====================================================================
-- 2. ADRESSE LISIBLE
--    « /actus/victoire-contre-saltigues » plutôt qu'un identifiant.
--    Le slug est calculé du titre, sans accents ni ponctuation.
-- =====================================================================
-- unaccent n'est pas toujours activé sur un projet Supabase : on retire les
-- accents à la main plutôt que d'exiger une extension.
-- Définie AVANT bbc_slugify, qui l'appelle : Postgres valide le corps des
-- fonctions SQL dès leur création.
create or replace function unaccent_fallback(src text)
returns text language sql immutable as $$
  select translate(
    coalesce(src,''),
    'àáâãäåçèéêëìíîïñòóôõöùúûüýÿÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ',
    'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY'
  );
$$;

create or replace function bbc_slugify(src text)
returns text language sql immutable as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(lower(unaccent_fallback(coalesce(src,''))), '[^a-z0-9]+', '-', 'g'),
      '-+', '-', 'g'
    )
  );
$$;

create or replace function bbc_news_slug()
returns trigger language plpgsql as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := bbc_slugify(new.title);
    -- Deux articles homonymes ne doivent pas partager la même adresse.
    if exists (select 1 from news where slug = new.slug and id is distinct from new.id) then
      new.slug := new.slug || '-' || substr(md5(random()::text), 1, 4);
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists news_slug on news;
create trigger news_slug
  before insert or update on news
  for each row execute function bbc_news_slug();

-- Rattrapage des actualités déjà publiées.
update news set slug = bbc_slugify(title)
 where slug is null or slug = '';


-- =====================================================================
-- 3. CATÉGORIES
--    Une table plutôt qu'un texte libre : sans elle, « Match » et
--    « match » créent deux rubriques sur le site.
-- =====================================================================
create table if not exists news_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text,
  color      text,          -- pastille de couleur dans l'admin et sur le site
  sort       integer default 0,
  created_at timestamptz not null default now()
);

alter table news_categories enable row level security;

drop policy if exists news_categories_read on news_categories;
create policy news_categories_read on news_categories
  for select using (true);

drop policy if exists news_categories_write on news_categories;
create policy news_categories_write on news_categories
  for all using (is_admin()) with check (is_admin());

-- Quatre rubriques pour démarrer, seulement si la table est vide.
insert into news_categories (name, slug, color, sort)
select * from (values
  ('Match',       'match',       '#C0271B', 1),
  ('Club',        'club',        '#C6A257', 2),
  ('Recrutement', 'recrutement', '#A8D93B', 3),
  ('Boutique',    'boutique',    '#9DB8E8', 4)
) as v(name, slug, color, sort)
where not exists (select 1 from news_categories);


-- =====================================================================
-- 4. VUE ARTICLES
-- =====================================================================
drop view if exists articles_admin;

create view articles_admin as
select
  n.*,
  c.color as category_color,
  length(coalesce(n.body,''))                              as longueur,
  -- 200 mots par minute : l'estimation de lecture affichée sur le site.
  greatest(1, round(array_length(regexp_split_to_array(coalesce(n.body,''), '\s+'), 1) / 200.0)) as minutes_lecture
from news n
left join news_categories c on c.name = n.category;

alter view articles_admin set (security_invoker = on);


-- =====================================================================
--  IMPORTANT — le site public ne doit afficher que les articles publiés.
--  Si votre politique de lecture sur news est « for select using (true) »,
--  les brouillons deviendraient visibles. Cette ligne l'en empêche :
-- =====================================================================
drop policy if exists news_public_read on news;
create policy news_public_read on news
  for select using (status = 'publie' or is_admin());


-- =====================================================================
--  Vérification après exécution :
--    select title, slug, status, category from news order by published_at desc;
--    select name, color from news_categories order by sort;
-- =====================================================================
