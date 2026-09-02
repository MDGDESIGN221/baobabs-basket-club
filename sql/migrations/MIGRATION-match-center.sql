-- =====================================================================
--  Baobabs Basket Club — Migration : MATCH CENTER  (version corrigée)
--  À exécuter dans Supabase : SQL Editor → New query → Run.
--  Idempotent : réexécutable sans risque.
--
--  CORRECTIF : la vue match_center existait déjà d'une exécution
--  précédente. « create or replace view » exige de garder exactement les
--  mêmes colonnes dans le même ordre ; comme la migration ajoute des
--  colonnes à matches et que la vue fait « m.* », l'ordre changeait et
--  Postgres refusait. On supprime donc la vue avant de la recréer.
-- =====================================================================


-- =====================================================================
-- 1. SCORES PAR QUART-TEMPS
--    En JSON plutôt qu'en huit colonnes : une prolongation ne demandera
--    pas de nouvelle migration.
--    Forme : [{"b":18,"o":15},{"b":22,"o":19},…]
-- =====================================================================
alter table matches
  add column if not exists quarters jsonb not null default '[]'::jsonb;


-- =====================================================================
-- 2. FEUILLE DE MATCH
-- =====================================================================
alter table matches
  add column if not exists referees    text,     -- arbitres désignés
  add column if not exists attendance  integer,  -- affluence constatée
  add column if not exists round_label text,     -- « Journée 7 », « Quart de finale »
  add column if not exists recap       text;     -- résumé d'après-match

create index if not exists matches_date_idx on matches (match_date);


-- =====================================================================
-- 3. VUE MATCH CENTER
--    Le match, plus l'état de sa billetterie : une seule lecture au lieu
--    de deux requêtes recomposées côté navigateur.
--    « statut » est déduit des données, jamais saisi à la main.
--
--    Le drop est indispensable : voir le correctif en tête de fichier.
-- =====================================================================
drop view if exists match_center;

create view match_center as
select
  m.*,
  coalesce(o.nb_categories,   0)     as nb_categories,
  coalesce(o.places_totales,  0)     as places_totales,
  coalesce(o.places_reservees, 0)    as places_reservees,
  coalesce(o.places_restantes, 0)    as places_restantes,
  coalesce(o.vente_ouverte,   false) as vente_ouverte,
  case
    when m.score_baobabs is not null and m.score_opponent is not null then 'termine'
    when m.match_date < current_date then 'a_saisir'
    when m.match_date = current_date then 'aujourdhui'
    else 'a_venir'
  end as statut,
  case
    when m.score_baobabs is null or m.score_opponent is null then null
    when m.score_baobabs > m.score_opponent then 'V'
    when m.score_baobabs < m.score_opponent then 'D'
    else 'N'
  end as issue
from matches m
left join (
  select
    match_id,
    count(*)                       as nb_categories,
    sum(quota)                     as places_totales,
    sum(sold)                      as places_reservees,
    sum(greatest(quota - sold, 0)) as places_restantes,
    bool_or(is_open)               as vente_ouverte
  from ticket_offers
  group by match_id
) o on o.match_id = m.id;

alter view match_center set (security_invoker = on);


-- =====================================================================
--  Vérification après exécution :
--    select opponent_name, match_date, statut, issue, vente_ouverte
--      from match_center order by match_date desc limit 10;
--
--  Si la vue échoue sur ticket_offers, c'est que
--  MIGRATION-billetterie.sql n'a pas encore été passée.
-- =====================================================================
