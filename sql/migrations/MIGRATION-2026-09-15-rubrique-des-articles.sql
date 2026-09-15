-- =====================================================================
--  LA RUBRIQUE D'UN ARTICLE SUIT SA CATEGORIE
--  --------------------------------------------------------------------
--  A jouer APRES MIGRATION-2026-09-15-un-club-un-logo.sql.
--
--  MESURE LE 15 SEPTEMBRE 2026, en renommant « Match » en « Match day »
--  depuis l'ecran Categories :
--
--    news_categories ....... renommee
--    news (2 articles) ..... gardent category = 'Match'
--
--  La vue `articles_admin` rapproche les deux par le TEXTE :
--      left join news_categories c on c.name = n.category
--  Apres le renommage, ces deux articles ne rejoignent plus rien : ils
--  perdent leur couleur dans l'admin, et le site affiche une rubrique
--  « Match » qui n'existe plus dans la liste des categories. Personne
--  n'est averti : l'ecran Categories dit juste « 0 article » la ou il
--  en disait deux.
--
--  C'est le meme defaut que les logos des clubs, sur une autre entite.
--  On le repare de la meme facon : un LIEN, et des declencheurs qui
--  tiennent la copie.
--
--  CE QUI NE CHANGE PAS. `news.category` reste le texte que lit le site
--  public, et une categorie supprimee laisse a ses articles le nom
--  qu'ils portaient : un article garde sa rubrique meme quand le club
--  reorganise ses rubriques.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) UNE CLE, POUR TOUTES LES ENTITES NOMMEES
--    bbc_club_cle existait deja pour les clubs. La regle est la meme
--    partout : la casse et les espaces ne font pas deux choses
--    differentes. On lui donne son nom general, et l'ancienne l'appelle,
--    pour ne rien casser de la migration precedente.
-- ---------------------------------------------------------------------
create or replace function public.bbc_cle(p text)
returns text language sql immutable as $$
  select nullif(lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g')), '')
$$;

create or replace function public.bbc_club_cle(p text)
returns text language sql immutable as $$
  select public.bbc_cle(p)
$$;

grant execute on function public.bbc_cle(text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 2) AVANT DE RIEN CHANGER : les categories en double.
--    Doit rendre zero ligne.
-- ---------------------------------------------------------------------
select bbc_cle(name) as cle, count(*) as fiches, string_agg(name, ' | ') as noms
  from public.news_categories
 group by bbc_cle(name)
having count(*) > 1;


-- ---------------------------------------------------------------------
-- 3) LE LIEN, ET LE RATTACHEMENT DE L'EXISTANT
-- ---------------------------------------------------------------------
alter table public.news
  add column if not exists category_id uuid references public.news_categories(id) on delete set null;

create index if not exists news_category_id_idx on public.news(category_id);

update public.news n
   set category_id = c.id
  from public.news_categories c
 where n.category_id is null
   and bbc_cle(n.category) = bbc_cle(c.name);

-- Les orthographes convergent : « match » et « Match » etaient deux
-- rubriques sur le site.
update public.news n
   set category = c.name
  from public.news_categories c
 where n.category_id = c.id
   and n.category is distinct from c.name;


-- ---------------------------------------------------------------------
-- 4) L'ARTICLE SUIT SA RUBRIQUE
-- ---------------------------------------------------------------------
create or replace function public.bbc_article_suit_sa_rubrique()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_nom text;
begin
  if new.category_id is null and new.category is not null then
    select id into new.category_id
      from news_categories
     where bbc_cle(name) = bbc_cle(new.category)
     limit 1;
  end if;

  if new.category_id is not null then
    select name into v_nom from news_categories where id = new.category_id;
    if found then new.category := v_nom; end if;
  end if;

  return new;
end;
$$;

drop trigger if exists news_suit_sa_rubrique on public.news;
create trigger news_suit_sa_rubrique
  before insert or update of category_id, category on public.news
  for each row execute function public.bbc_article_suit_sa_rubrique();


-- ---------------------------------------------------------------------
-- 5) LA RUBRIQUE RENOMMEE DESCEND SUR SES ARTICLES
-- ---------------------------------------------------------------------
create or replace function public.bbc_rubrique_descend()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name then
    update news set category = new.name where category_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists news_categories_descend on public.news_categories;
create trigger news_categories_descend
  after update of name on public.news_categories
  for each row execute function public.bbc_rubrique_descend();


-- ---------------------------------------------------------------------
-- 6) UNE RUBRIQUE CREEE APRES COUP ADOPTE SES ARTICLES
-- ---------------------------------------------------------------------
create or replace function public.bbc_rubrique_adopte()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update news set category_id = new.id
   where category_id is null
     and bbc_cle(category) = bbc_cle(new.name);
  return new;
end;
$$;

drop trigger if exists news_categories_adopte on public.news_categories;
create trigger news_categories_adopte
  after insert on public.news_categories
  for each row execute function public.bbc_rubrique_adopte();


-- ---------------------------------------------------------------------
-- 7) LA VUE REJOINT PAR LE LIEN, PAS PAR LE TEXTE
--    Le repli par le nom reste : un article ecrit avant la migration et
--    jamais reenregistre garde sa couleur.
-- ---------------------------------------------------------------------
create or replace view public.articles_admin as
 SELECT n.id, n.title, n.body, n.image_url, n.published_at, n.sort, n.created_at,
    n.image_url_x, n.image_url_y, n.image_url_zoom, n.status, n.slug, n.excerpt,
    n.category, n.category_id, n.author, n.image_alt, n.seo_title, n.seo_description, n.updated_at,
    c.color AS category_color,
    length(COALESCE(n.body, ''::text)) AS longueur,
    GREATEST(1::numeric, round(array_length(regexp_split_to_array(COALESCE(n.body, ''::text), '\s+'::text), 1)::numeric / 200.0)) AS minutes_lecture,
    n.match_id
   FROM news n
     LEFT JOIN news_categories c
            ON c.id = n.category_id
            OR (n.category_id IS NULL AND bbc_cle(c.name) = bbc_cle(n.category));

alter view public.articles_admin set (security_invoker = on);


-- ---------------------------------------------------------------------
-- 8) LE LIEN VERS LE CLUB, VISIBLE DEPUIS LA VUE DES MATCHS
--    match_center est la vue que lisent plusieurs ecrans. Sans cette
--    colonne, un ecran qui passe par elle ne peut pas savoir a quelle
--    fiche de club un match est rattache.
-- ---------------------------------------------------------------------
create or replace view public.match_center as
 SELECT m.id, m.opponent_name, m.opponent_logo_url, m.opponent_team_id,
    m.match_date, m.match_time, m.venue, m.is_home,
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


-- =====================================================================
--  CONTROLE. Les deux requetes doivent rendre zero ligne.
-- =====================================================================

-- a) un article rattache a une rubrique, mais qui n'en porte pas le nom
select n.id, n.title, n.category, c.name
  from news n join news_categories c on c.id = n.category_id
 where n.category is distinct from c.name;

-- b) un article dont la rubrique existe, sans lui etre rattache
select n.id, n.title, n.category
  from news n
 where n.category_id is null
   and n.category is not null
   and exists (select 1 from news_categories c where bbc_cle(c.name) = bbc_cle(n.category));
