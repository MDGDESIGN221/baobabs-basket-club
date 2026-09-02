-- =====================================================================
--  Baobabs Basket Club — Migration : EFFECTIF & STOCK
--  Supabase → SQL Editor → New query → Run. Réexécutable sans risque.
--
--  Ce que ça pose :
--    1. Fiches joueuses : statut, arrivée, statistiques, mensurations
--    2. Stock par taille sur les produits, avec seuil d'alerte
--    3. Vue effectif_admin et vue produits_admin
--
--  Aucune colonne existante n'est modifiée ni supprimée. in_stock reste
--  en place et sera tenu à jour automatiquement : le site public
--  continue de fonctionner sans changement.
-- =====================================================================


-- =====================================================================
-- 1. FICHES JOUEUSES
--    status : 'active' | 'blessee' | 'pret' | 'partie'
--    Le statut manquait : une joueuse blessée ou partie restait affichée
--    comme si de rien n'était.
-- =====================================================================
alter table players
  add column if not exists status      text not null default 'active',
  add column if not exists joined_at   date,
  add column if not exists weight      text,
  add column if not exists nationality text,
  add column if not exists instagram   text,
  add column if not exists previous_club text,
  add column if not exists injury_note text,   -- nature et retour prévu
  -- Statistiques de la saison. En JSON : le format évoluera (tirs primés,
  -- minutes, évaluation) sans nouvelle migration à chaque ajout.
  add column if not exists stats jsonb not null default '{}'::jsonb;

create index if not exists players_status_idx on players (status);


-- =====================================================================
-- 2. STOCK PAR TAILLE
--    in_stock (booléen) ne disait pas COMBIEN, ni dans quelle taille.
--    Résultat : un maillot annoncé disponible mais épuisé en L.
--    Forme de stock : {"S":4,"M":0,"L":7,"XL":2}
-- =====================================================================
alter table products
  add column if not exists stock       jsonb not null default '{}'::jsonb,
  add column if not exists stock_alert integer not null default 3,  -- seuil « stock bas »
  add column if not exists sku         text,
  add column if not exists cost_fcfa   integer,   -- prix d'achat, pour la marge
  add column if not exists track_stock boolean not null default false;

create index if not exists products_stock_idx on products (track_stock);


-- =====================================================================
-- 3. SYNCHRONISATION AUTOMATIQUE DE in_stock
--    Le site public lit in_stock. Plutôt que de le modifier à la main en
--    plus des quantités — et de l'oublier — on le déduit du stock.
--    Un produit non suivi garde le in_stock que vous réglez vous-même.
-- =====================================================================
create or replace function bbc_sync_in_stock()
returns trigger language plpgsql as $$
declare total integer;
begin
  if new.track_stock then
    select coalesce(sum((value)::integer), 0)
      into total
      from jsonb_each_text(coalesce(new.stock, '{}'::jsonb));
    new.in_stock := (total > 0);
  end if;
  return new;
end;
$$;

drop trigger if exists products_sync_stock on products;
create trigger products_sync_stock
  before insert or update on products
  for each row execute function bbc_sync_in_stock();


-- =====================================================================
-- 4. VUE EFFECTIF
-- =====================================================================
drop view if exists effectif_admin;

create view effectif_admin as
select
  p.*,
  case when p.birth_year is not null
       then extract(year from current_date)::integer - p.birth_year
       else null end as age,
  (p.stats->>'points')::numeric   as pts,
  (p.stats->>'rebonds')::numeric  as reb,
  (p.stats->>'passes')::numeric   as ast,
  (p.stats->>'matchs')::integer   as matchs_joues
from players p;

alter view effectif_admin set (security_invoker = on);


-- =====================================================================
-- 5. VUE PRODUITS
--    Le total et la taille en rupture sont calculés ici : côté navigateur,
--    il faudrait parcourir le JSON de chaque produit à chaque affichage.
-- =====================================================================
drop view if exists produits_admin;

create view produits_admin as
select
  p.*,
  coalesce(s.total, 0) as stock_total,
  s.ruptures,
  case
    when not p.track_stock              then 'non_suivi'
    when coalesce(s.total, 0) = 0       then 'epuise'
    when coalesce(s.total, 0) <= p.stock_alert then 'bas'
    else 'ok'
  end as etat_stock,
  case when p.price is not null and p.cost_fcfa is not null and p.cost_fcfa > 0
       then p.price - p.cost_fcfa else null end as marge_fcfa
from products p
left join (
  select
    id,
    sum(qty) as total,
    -- Les tailles à zéro, listées pour l'alerte « épuisé en L »
    string_agg(size, ', ' order by size) filter (where qty = 0) as ruptures
  from (
    select p2.id, e.key as size, (e.value)::integer as qty
    from products p2, jsonb_each_text(coalesce(p2.stock, '{}'::jsonb)) e
  ) x
  group by id
) s on s.id = p.id;

alter view produits_admin set (security_invoker = on);


-- =====================================================================
--  Vérification après exécution :
--    select name, status, joined_at, stats from players order by sort;
--    select name, track_stock, stock, stock_total, etat_stock, ruptures
--      from produits_admin order by sort;
--
--  À savoir : le suivi de stock est DÉSACTIVÉ par défaut sur vos produits
--  existants (track_stock = false), donc rien ne change tant que vous ne
--  l'activez pas produit par produit.
-- =====================================================================
