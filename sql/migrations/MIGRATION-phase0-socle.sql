-- =====================================================================
--  Baobabs Basket Club — PHASE 0 : LE SOCLE
--  17 août 2026. Idempotent. Aucune donnée supprimée.
--
--  Deux chantiers presque invisibles à l'écran, dont tout le reste dépend :
--
--    A. LA FEUILLE DE MATCH — la ligne qui relie une joueuse à un match.
--       Sans elle : pas d'évolution, pas de moyenne, pas de MVP, pas de
--       tendance, pas de résumé automatique. Aujourd'hui les statistiques
--       vivent dans players.stats, un bloc de texte saisi une fois par
--       saison : on ne peut rien en calculer.
--
--    B. LES RÔLES — is_admin() répond oui ou non. Une validation entre
--       deux personnes qui sont la même personne n'est pas un circuit.
--
--  Et le bonus qui tombe naturellement une fois A posé :
--
--    C. LE DIRECT POINT PAR POINT — la table de marque écrit un panier,
--       le site l'affiche dans la seconde. Le même geste alimente la
--       feuille de match : on marque une fois, on obtient le score en
--       direct ET la ligne statistique de la joueuse.
-- =====================================================================


-- #####################################################################
-- ##  A. LA FEUILLE DE MATCH
-- #####################################################################

-- ---------------------------------------------------------------------
-- A1. Le déroulé du match, action par action.
--     C'est la source : tout le reste s'en déduit. On garde chaque geste
--     plutôt qu'un total, parce qu'un total ne répond pas à « quand ? »,
--     « à quel quart-temps la joueuse s'est-elle éteinte ? ».
-- ---------------------------------------------------------------------
create table if not exists match_events (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references matches(id) on delete cascade,
  player_id  uuid references players(id) on delete set null,  -- null = action collective ou adverse
  team       text not null default 'bbc' check (team in ('bbc','adv')),
  kind       text not null check (kind in (
               'panier2','panier3','lf',                    -- réussis
               'rate2','rate3','rate_lf',                   -- manqués
               'reb_off','reb_def','passe','interception',
               'contre','perte','faute',
               'entree','sortie','temps_mort','fin_periode'
             )),
  points     integer not null default 0 check (points between 0 and 3),
  period     integer check (period between 1 and 8),          -- 5+ = prolongations
  clock      text,                                            -- « 07:24 » si la table le note
  author     text,
  created_at timestamptz not null default now()
);

create index if not exists match_events_match_idx  on match_events (match_id, created_at);
create index if not exists match_events_player_idx on match_events (player_id);

alter table match_events enable row level security;

-- Lecture publique : le déroulé alimente le direct sur le site.
drop policy if exists match_events_read on match_events;
create policy match_events_read on match_events for select using (true);

drop policy if exists match_events_write on match_events;
create policy match_events_write on match_events
  for all using (is_admin()) with check (is_admin());


-- ---------------------------------------------------------------------
-- A2. La feuille de match : une ligne par joueuse et par match.
--     Les totaux qui se déduisent ne se saisissent pas — points,
--     rebonds et évaluation sont calculés par la base. Personne ne peut
--     enregistrer une joueuse à 12 points avec 2 paniers à 2 points.
-- ---------------------------------------------------------------------
create table if not exists match_stats (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references matches(id) on delete cascade,
  player_id   uuid not null references players(id) on delete cascade,

  is_starter  boolean not null default false,
  played      boolean not null default true,
  dnp_reason  text,                                   -- « blessée », « non convoquée »
  minutes     integer not null default 0 check (minutes >= 0),

  fg2_made integer not null default 0 check (fg2_made >= 0),
  fg2_att  integer not null default 0 check (fg2_att  >= 0),
  fg3_made integer not null default 0 check (fg3_made >= 0),
  fg3_att  integer not null default 0 check (fg3_att  >= 0),
  ft_made  integer not null default 0 check (ft_made  >= 0),
  ft_att   integer not null default 0 check (ft_att   >= 0),

  reb_off  integer not null default 0 check (reb_off >= 0),
  reb_def  integer not null default 0 check (reb_def >= 0),
  ast      integer not null default 0 check (ast >= 0),
  stl      integer not null default 0 check (stl >= 0),
  blk      integer not null default 0 check (blk >= 0),
  tov      integer not null default 0 check (tov >= 0),
  pf       integer not null default 0 check (pf  >= 0),

  pts integer generated always as (ft_made + 2*fg2_made + 3*fg3_made) stored,
  reb integer generated always as (reb_off + reb_def) stored,
  -- Évaluation FIBA, sans les fautes provoquées que la table ne note pas.
  eval integer generated always as (
        (ft_made + 2*fg2_made + 3*fg3_made) + (reb_off + reb_def) + ast + stl + blk
      - (fg2_att - fg2_made) - (fg3_att - fg3_made) - (ft_att - ft_made) - tov - pf
  ) stored,

  updated_at timestamptz not null default now(),
  unique (match_id, player_id)
);

create index if not exists match_stats_match_idx  on match_stats (match_id);
create index if not exists match_stats_player_idx on match_stats (player_id);

-- Un tir réussi est forcément tenté : sinon les pourcentages mentent.
alter table match_stats drop constraint if exists match_stats_tirs_coherents;
alter table match_stats add constraint match_stats_tirs_coherents check (
  fg2_made <= fg2_att and fg3_made <= fg3_att and ft_made <= ft_att
);

alter table match_stats enable row level security;

drop policy if exists match_stats_read on match_stats;
create policy match_stats_read on match_stats for select using (true);

drop policy if exists match_stats_write on match_stats;
create policy match_stats_write on match_stats
  for all using (is_admin()) with check (is_admin());

create or replace function bbc_touch_stats()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists match_stats_touch on match_stats;
create trigger match_stats_touch before update on match_stats
  for each row execute function bbc_touch_stats();


-- #####################################################################
-- ##  C. LE DIRECT
-- #####################################################################

-- ---------------------------------------------------------------------
-- C1. L'état du match en cours. Une ligne par match, lisible par tous.
--     Volontairement séparée de matches.score_baobabs : celui-ci reste
--     le score OFFICIEL, publié au coup de sifflet final. Le direct est
--     un brouillon qui bouge — mélanger les deux ferait apparaître un
--     score provisoire comme un résultat définitif sur le site.
-- ---------------------------------------------------------------------
create table if not exists match_live (
  match_id   uuid primary key references matches(id) on delete cascade,
  score_bbc  integer not null default 0 check (score_bbc >= 0),
  score_adv  integer not null default 0 check (score_adv >= 0),
  period     integer not null default 1 check (period between 1 and 8),
  is_live    boolean not null default false,
  started_at timestamptz,
  ended_at   timestamptz,
  updated_at timestamptz not null default now()
);

alter table match_live enable row level security;

drop policy if exists match_live_read on match_live;
create policy match_live_read on match_live for select using (true);

drop policy if exists match_live_write on match_live;
create policy match_live_write on match_live
  for all using (is_admin()) with check (is_admin());

-- Le site doit être prévenu à chaque panier sans redemander. C'est ce
-- qu'apporte la publication temps réel : Supabase pousse la ligne
-- modifiée vers les navigateurs abonnés.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'match_live'
  ) then
    execute 'alter publication supabase_realtime add table public.match_live';
  end if;
exception when others then
  raise notice 'Publication temps réel non modifiée : %', sqlerrm;
end $$;


-- ---------------------------------------------------------------------
-- C2. Marquer. LE geste central de la soirée.
--     Un seul appel écrit les trois choses à la fois, dans la même
--     transaction : le déroulé, la feuille de match, le tableau
--     d'affichage. Si l'un échoue, aucun n'est écrit — on ne peut pas
--     se retrouver avec un score qui avance et une statistique perdue.
-- ---------------------------------------------------------------------
create or replace function bbc_marquer(
  p_match_id  uuid,
  p_kind      text,
  p_player_id uuid    default null,
  p_team      text    default 'bbc',
  p_period    integer default null,
  p_clock     text    default null
)
returns match_live
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pts   integer := 0;
  v_live  match_live%rowtype;
  v_who   text := coalesce(nullif(auth.jwt() ->> 'email',''), 'table de marque');
begin
  if not is_admin() then raise exception 'non_autorise'; end if;

  v_pts := case p_kind when 'panier2' then 2 when 'panier3' then 3 when 'lf' then 1 else 0 end;

  -- La ligne de direct est créée au premier geste : rien à préparer.
  insert into match_live (match_id, is_live, started_at, period)
  values (p_match_id, true, now(), coalesce(p_period, 1))
  on conflict (match_id) do nothing;

  insert into match_events (match_id, player_id, team, kind, points, period, clock, author)
  values (p_match_id, p_player_id, p_team, p_kind, v_pts, p_period, p_clock, v_who);

  -- La feuille de match ne bouge que pour une action des Baobabs
  -- rattachée à une joueuse identifiée.
  if p_team = 'bbc' and p_player_id is not null then
    insert into match_stats (match_id, player_id) values (p_match_id, p_player_id)
    on conflict (match_id, player_id) do nothing;

    update match_stats set
      fg2_made = fg2_made + (case when p_kind = 'panier2' then 1 else 0 end),
      fg2_att  = fg2_att  + (case when p_kind in ('panier2','rate2') then 1 else 0 end),
      fg3_made = fg3_made + (case when p_kind = 'panier3' then 1 else 0 end),
      fg3_att  = fg3_att  + (case when p_kind in ('panier3','rate3') then 1 else 0 end),
      ft_made  = ft_made  + (case when p_kind = 'lf' then 1 else 0 end),
      ft_att   = ft_att   + (case when p_kind in ('lf','rate_lf') then 1 else 0 end),
      reb_off  = reb_off  + (case when p_kind = 'reb_off' then 1 else 0 end),
      reb_def  = reb_def  + (case when p_kind = 'reb_def' then 1 else 0 end),
      ast      = ast      + (case when p_kind = 'passe' then 1 else 0 end),
      stl      = stl      + (case when p_kind = 'interception' then 1 else 0 end),
      blk      = blk      + (case when p_kind = 'contre' then 1 else 0 end),
      tov      = tov      + (case when p_kind = 'perte' then 1 else 0 end),
      pf       = pf       + (case when p_kind = 'faute' then 1 else 0 end)
    where match_id = p_match_id and player_id = p_player_id;
  end if;

  update match_live set
    score_bbc  = score_bbc + (case when p_team = 'bbc' then v_pts else 0 end),
    score_adv  = score_adv + (case when p_team = 'adv' then v_pts else 0 end),
    period     = coalesce(p_period, period),
    updated_at = now()
  where match_id = p_match_id
  returning * into v_live;

  return v_live;
end;
$$;

grant execute on function bbc_marquer(uuid,text,uuid,text,integer,text) to authenticated;


-- ---------------------------------------------------------------------
-- C3. Annuler le dernier geste. Une table de marque se trompe : sans
--     retour arrière, on corrige à la main dans deux endroits et on en
--     oublie toujours un.
-- ---------------------------------------------------------------------
create or replace function bbc_annuler_dernier(p_match_id uuid)
returns match_live
language plpgsql
security definer
set search_path = public
as $$
declare
  e      match_events%rowtype;
  v_live match_live%rowtype;
begin
  if not is_admin() then raise exception 'non_autorise'; end if;

  select * into e from match_events
   where match_id = p_match_id and kind not in ('fin_periode','temps_mort')
   order by created_at desc limit 1;
  if not found then raise exception 'rien_a_annuler'; end if;

  if e.team = 'bbc' and e.player_id is not null then
    update match_stats set
      fg2_made = greatest(fg2_made - (case when e.kind = 'panier2' then 1 else 0 end), 0),
      fg2_att  = greatest(fg2_att  - (case when e.kind in ('panier2','rate2') then 1 else 0 end), 0),
      fg3_made = greatest(fg3_made - (case when e.kind = 'panier3' then 1 else 0 end), 0),
      fg3_att  = greatest(fg3_att  - (case when e.kind in ('panier3','rate3') then 1 else 0 end), 0),
      ft_made  = greatest(ft_made  - (case when e.kind = 'lf' then 1 else 0 end), 0),
      ft_att   = greatest(ft_att   - (case when e.kind in ('lf','rate_lf') then 1 else 0 end), 0),
      reb_off  = greatest(reb_off  - (case when e.kind = 'reb_off' then 1 else 0 end), 0),
      reb_def  = greatest(reb_def  - (case when e.kind = 'reb_def' then 1 else 0 end), 0),
      ast      = greatest(ast      - (case when e.kind = 'passe' then 1 else 0 end), 0),
      stl      = greatest(stl      - (case when e.kind = 'interception' then 1 else 0 end), 0),
      blk      = greatest(blk      - (case when e.kind = 'contre' then 1 else 0 end), 0),
      tov      = greatest(tov      - (case when e.kind = 'perte' then 1 else 0 end), 0),
      pf       = greatest(pf       - (case when e.kind = 'faute' then 1 else 0 end), 0)
    where match_id = e.match_id and player_id = e.player_id;
  end if;

  update match_live set
    score_bbc  = greatest(score_bbc - (case when e.team = 'bbc' then e.points else 0 end), 0),
    score_adv  = greatest(score_adv - (case when e.team = 'adv' then e.points else 0 end), 0),
    updated_at = now()
  where match_id = p_match_id
  returning * into v_live;

  delete from match_events where id = e.id;
  return v_live;
end;
$$;

grant execute on function bbc_annuler_dernier(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- C4. Coup de sifflet final : le direct devient le score officiel.
--     C'est le seul moment où le brouillon est recopié dans matches.
-- ---------------------------------------------------------------------
create or replace function bbc_terminer_match(p_match_id uuid)
returns matches
language plpgsql
security definer
set search_path = public
as $$
declare v_live match_live%rowtype; v_m matches%rowtype;
begin
  if not is_admin() then raise exception 'non_autorise'; end if;

  select * into v_live from match_live where match_id = p_match_id;
  if not found then raise exception 'aucun_direct'; end if;

  update match_live set is_live = false, ended_at = now(), updated_at = now()
   where match_id = p_match_id;

  -- score_baobabs est le score DES Baobabs, à domicile comme en
  -- déplacement : c'est l'affichage du site qui inverse les côtés, pas
  -- la donnée.
  update matches
     set score_baobabs  = v_live.score_bbc,
         score_opponent = v_live.score_adv
   where id = p_match_id
  returning * into v_m;

  -- Pas d'appel au classement ici : le déclencheur posé sur matches s'en
  -- charge déjà. L'appeler aussi le ferait tourner deux fois.
  return v_m;
end;
$$;

grant execute on function bbc_terminer_match(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- C5. Le classement des Baobabs, recalculé depuis les matchs joués.
--
--     LIMITE ASSUMÉE : le club n'enregistre que SES matchs. Les
--     résultats des autres clubs entre eux ne sont nulle part. On ne
--     peut donc pas calculer tout le championnat — seulement la ligne
--     des Baobabs, qui est justement celle qu'on oublie de tenir à jour.
--     Les autres lignes restent saisies à la main dans l'écran
--     Classement, et ce script n'y touche jamais.
--
--     Barème FIBA : 2 points par victoire, 1 par défaite jouée.
-- ---------------------------------------------------------------------
create or replace function bbc_recalculer_classement()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_j int; v_v int; v_d int; v_pts int; v_pp int; v_pc int;
begin
  select count(*),
         count(*) filter (where score_baobabs > score_opponent),
         count(*) filter (where score_baobabs < score_opponent),
         coalesce(sum(score_baobabs),0), coalesce(sum(score_opponent),0)
    into v_j, v_v, v_d, v_pp, v_pc
    from matches
   where score_baobabs is not null and score_opponent is not null;

  v_pts := v_v * 2 + v_d;

  update standings
     set played = v_j, wins = v_v, losses = v_d, points = v_pts
   where team_name ilike '%baobabs%';

  if not found then
    insert into standings (team_name, played, wins, losses, points)
    values ('Baobabs Basket Club', v_j, v_v, v_d, v_pts);
  end if;
end;
$$;

grant execute on function bbc_recalculer_classement() to authenticated;

-- Un score corrigé à la main dans la fiche du match doit aussi
-- rafraîchir le classement : sinon les deux écrans se contredisent.
create or replace function bbc_matches_apres_score()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.score_baobabs is distinct from old.score_baobabs
     or new.score_opponent is distinct from old.score_opponent then
    perform bbc_recalculer_classement();
  end if;
  return new;
end;
$$;

drop trigger if exists matches_apres_score on matches;
create trigger matches_apres_score after update on matches
  for each row execute function bbc_matches_apres_score();


-- ---------------------------------------------------------------------
-- C6. Les agrégats d'une joueuse sur la saison — calculés, jamais saisis.
--     C'est ce qui remplace players.stats à terme.
-- ---------------------------------------------------------------------
create or replace view player_season_stats as
select
  s.player_id,
  p.name,
  p.jersey_number,
  count(*) filter (where s.played)                        as matchs_joues,
  count(*) filter (where s.is_starter)                    as titularisations,
  sum(s.minutes)                                          as minutes_total,
  sum(s.pts)                                              as pts_total,
  round(avg(s.pts)  filter (where s.played), 1)           as pts_moy,
  round(avg(s.reb)  filter (where s.played), 1)           as reb_moy,
  round(avg(s.ast)  filter (where s.played), 1)           as ast_moy,
  round(avg(s.eval) filter (where s.played), 1)           as eval_moy,
  sum(s.fg2_made + s.fg3_made)                            as tirs_reussis,
  sum(s.fg2_att  + s.fg3_att)                             as tirs_tentes,
  case when sum(s.fg2_att + s.fg3_att) > 0
       then round(100.0 * sum(s.fg2_made + s.fg3_made) / sum(s.fg2_att + s.fg3_att), 1) end as pct_tirs,
  case when sum(s.fg3_att) > 0
       then round(100.0 * sum(s.fg3_made) / sum(s.fg3_att), 1) end                          as pct_3pts,
  case when sum(s.ft_att) > 0
       then round(100.0 * sum(s.ft_made) / sum(s.ft_att), 1) end                            as pct_lf,
  max(m.match_date)                                       as dernier_match
from match_stats s
join players p on p.id = s.player_id
join matches m on m.id = s.match_id
group by s.player_id, p.name, p.jersey_number;

alter view player_season_stats set (security_invoker = on);


-- ---------------------------------------------------------------------
-- C7. Le MVP d'un match : proposé, jamais imposé.
--     La meilleure évaluation, à condition qu'elle se détache — un écart
--     d'un point d'évaluation ne désigne pas une joueuse du match.
-- ---------------------------------------------------------------------
create or replace function bbc_mvp_match(p_match_id uuid)
returns table (player_id uuid, name text, pts integer, reb integer, ast integer, eval integer, ecart integer)
language sql stable
as $$
  with classees as (
    select s.player_id, p.name, s.pts, s.reb, s.ast, s.eval,
           row_number() over (order by s.eval desc) as rang,
           s.eval - lead(s.eval) over (order by s.eval desc) as ecart
      from match_stats s join players p on p.id = s.player_id
     where s.match_id = p_match_id and s.played
  )
  select player_id, name, pts, reb, ast, eval, coalesce(ecart, 0)
    from classees where rang = 1 and coalesce(ecart, 0) >= 2;
$$;


-- #####################################################################
-- ##  B. LES RÔLES
-- #####################################################################

-- ---------------------------------------------------------------------
-- B1. Un rôle par compte. Les comptes existants deviennent super_admin :
--     personne ne perd l'accès en passant ce script.
-- ---------------------------------------------------------------------
alter table admin_users add column if not exists role text;
update admin_users set role = 'super_admin' where role is null;

alter table admin_users drop constraint if exists admin_users_role_check;
alter table admin_users
  add constraint admin_users_role_check check (role in (
    'super_admin','president','directeur_sportif','coach','community_manager'
  ));
alter table admin_users alter column role set default 'super_admin';
alter table admin_users alter column role set not null;

-- ---------------------------------------------------------------------
-- B2. La matrice des droits. Une ligne = ce rôle peut faire cette action
--     sur ce module. Une table plutôt qu'un long CASE : on lit les
--     droits d'un coup d'œil, et on les change sans redéployer.
-- ---------------------------------------------------------------------
create table if not exists role_permissions (
  role   text not null,
  module text not null,
  action text not null check (action in ('voir','creer','modifier','supprimer','publier','approuver','exporter')),
  primary key (role, module, action)
);

-- Les fonctions d'abord : une politique qui appelle une fonction encore
-- inexistante fait échouer tout le script.
create or replace function bbc_est_super_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from admin_users where user_id = auth.uid() and role = 'super_admin');
$$;

create or replace function bbc_role()
returns text language sql security definer stable set search_path = public as $$
  select role from admin_users where user_id = auth.uid();
$$;

alter table role_permissions enable row level security;
drop policy if exists role_permissions_read on role_permissions;
create policy role_permissions_read on role_permissions for select using (is_admin());
drop policy if exists role_permissions_write on role_permissions;
create policy role_permissions_write on role_permissions
  for all using (bbc_est_super_admin()) with check (bbc_est_super_admin());

create or replace function bbc_can(p_module text, p_action text)
returns boolean language sql security definer stable set search_path = public as $$
  select case
    when bbc_role() = 'super_admin' then true
    else exists (
      select 1 from role_permissions
       where role = bbc_role() and module = p_module and action = p_action
    )
  end;
$$;

grant execute on function bbc_role(), bbc_est_super_admin(), bbc_can(text,text) to authenticated;

-- ---------------------------------------------------------------------
-- B3. Les droits par défaut. Volontairement peu de rôles : cinq, dont
--     trois seront réellement utilisés. Un rôle créé pour une personne
--     qui n'existe pas produit des écrans que personne n'ouvre.
-- ---------------------------------------------------------------------
delete from role_permissions where role <> 'super_admin';

-- Le président voit tout et approuve, mais ne saisit pas au quotidien.
insert into role_permissions (role, module, action)
select 'president', m, a
  from unnest(array['matchs','effectif','stats','billetterie','boutique','contenu',
                    'inscriptions','recrutement','reglages','historique']) m,
       unnest(array['voir','exporter']) a
on conflict do nothing;
insert into role_permissions (role, module, action) values
  ('president','contenu','approuver'), ('president','contenu','publier'),
  ('president','reglages','modifier'), ('president','inscriptions','modifier')
on conflict do nothing;

-- Le directeur sportif : tout le sportif, plus le recrutement et l'école.
insert into role_permissions (role, module, action)
select 'directeur_sportif', m, a
  from unnest(array['matchs','effectif','stats','recrutement','inscriptions']) m,
       unnest(array['voir','creer','modifier','supprimer','exporter']) a
on conflict do nothing;
insert into role_permissions (role, module, action) values
  ('directeur_sportif','contenu','voir'), ('directeur_sportif','billetterie','voir'),
  ('directeur_sportif','contenu','approuver')
on conflict do nothing;

-- Le coach : son effectif et ses matchs. Il saisit la feuille de match,
-- il ne touche ni à l'argent ni au site.
insert into role_permissions (role, module, action) values
  ('coach','matchs','voir'),   ('coach','matchs','modifier'),
  ('coach','effectif','voir'), ('coach','effectif','modifier'),
  ('coach','stats','voir'),    ('coach','stats','creer'), ('coach','stats','modifier'),
  ('coach','recrutement','voir')
on conflict do nothing;

-- Le community manager : le contenu public, et de quoi le nourrir.
insert into role_permissions (role, module, action)
select 'community_manager', 'contenu', a
  from unnest(array['voir','creer','modifier','supprimer','publier','exporter']) a
on conflict do nothing;
insert into role_permissions (role, module, action) values
  ('community_manager','matchs','voir'), ('community_manager','effectif','voir'),
  ('community_manager','stats','voir'),  ('community_manager','billetterie','voir')
on conflict do nothing;


-- =====================================================================
--  CE QUE CE SCRIPT NE FAIT PAS ENCORE — à dire clairement
--
--  Les rôles sont posés et interrogeables (bbc_can), mais les politiques
--  RLS des ~30 tables existantes n'ont PAS été réécrites : au niveau de
--  la base, tout compte présent dans admin_users garde l'accès complet.
--  Le filtrage par rôle s'applique d'abord dans l'écran d'administration
--  — c'est ce qui change la vie au quotidien. Le durcissement table par
--  table viendra ensuite, module par module, en commençant par l'argent
--  et les réglages. Le faire d'un bloc ici, c'était risquer de couper
--  l'accès du club un soir de match.
--
--  VÉRIFICATIONS
--    select email, role from admin_users;
--    select role, count(*) from role_permissions group by role order by role;
--    select bbc_role(), bbc_can('matchs','modifier');
--    select * from player_season_stats order by pts_moy desc nulls last;
--    select bbc_recalculer_classement();
--    select team_name, played, wins, losses, points from standings;
-- =====================================================================
