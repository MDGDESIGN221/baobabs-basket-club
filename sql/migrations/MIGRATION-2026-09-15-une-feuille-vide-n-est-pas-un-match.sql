-- =====================================================================
--  UNE FEUILLE VIDE N'EST PAS UN MATCH JOUÉ
--  --------------------------------------------------------------------
--  Relevé en production le 15 septembre 2026 :
--
--      27 juil.  ASC Saltigué      99–85   feuille : 0 ligne
--      13 sept.  HLM Basket Club   77–69   feuille : 0 ligne
--      16 sept.  AFSO              aucun   feuille : 8 lignes,
--                                          8 « a joué », 0 minute, 0 point
--
--  Les huit lignes du 16 septembre sont une COMPOSITION : un cinq de
--  départ posé avant la rencontre, plus trois remplaçantes. Personne
--  n'a joué. Pourtant chaque ligne porte played = true.
--
--  Elle le porte parce que la colonne est ainsi faite :
--
--      played boolean not null default true
--
--  et parce qu'AUCUNE des trois écritures qui créent une ligne ne la
--  nomme : le geste marqué à la table de marque (bbc_marquer), le cinq
--  de départ (gdMarquerTitulaires) et l'éditeur de feuille. La valeur
--  tombe donc au défaut. « played » ne dit pas « elle a joué », il dit
--  « une ligne existe ».
--
--  Rien ne se voit aujourd'hui, parce que la vue écarte les matchs sans
--  score et que le match du 16 n'en a pas encore. MAIS LE JOUR OÙ
--  QUELQU'UN TAPE CE SCORE -- le geste le plus naturel qui soit -- les
--  huit joueuses reçoivent d'un coup :
--
--      matchs_joues = 1     pts_moy = 0.0     reb_moy = 0.0
--
--  sur leur fiche, ET SUR LE SITE PUBLIC, qui affiche « Saison en
--  cours · 1 match — 0 Pts/match ». Sans un mot, et sans retour en
--  arrière possible autrement qu'à la main.
--
--  On ne touche pas aux données : une composition est une information
--  légitime, elle doit rester. C'est la LECTURE qui doit être juste.
--  Une ligne de feuille compte comme un match joué quand le club a dit
--  qu'elle avait joué ET que la ligne porte quelque chose -- une
--  minute, un tir, un rebond, une faute. Une ligne entièrement à zéro
--  est une ligne que personne n'a remplie.
--
--  Au passage, deux incohérences de la même vue disparaissent :
--
--    . pts_total et minutes_total sommaient TOUTES les lignes pendant
--      que pts_moy n'en moyennait qu'une partie. Le total et la moyenne
--      ne parlaient donc pas du même ensemble.
--
--    . dernier_match donnait la date du dernier match où une ligne
--      existait, composition comprise -- pas celle du dernier match
--      joué.
--
--  À exécuter dans l'éditeur SQL de Supabase. Sans effet de bord :
--  aucune ligne n'est écrite, aucune colonne n'est ajoutée.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1) UNE SEULE DÉFINITION DE « ELLE A JOUÉ »
--  ---------------------------------------------------------------------
--  Écrite une fois, ici. Les trois endroits qui en avaient besoin la
--  recopiaient chacun à sa façon, ou ne la posaient pas du tout.
--
--  Les colonnes « made » figurent à côté des « att » alors qu'un panier
--  réussi incrémente toujours la tentative : une feuille corrigée à la
--  main pourrait porter l'un sans l'autre, et il vaut mieux compter un
--  match de trop que d'en effacer un vrai.
-- ---------------------------------------------------------------------
create or replace function public.bbc_feuille_remplie(s match_stats)
returns boolean
language sql
immutable
as $$
  select s.played and (
       s.minutes  > 0
    or s.fg2_made > 0 or s.fg2_att > 0
    or s.fg3_made > 0 or s.fg3_att > 0
    or s.ft_made  > 0 or s.ft_att  > 0
    or s.reb_off  > 0 or s.reb_def > 0
    or s.ast > 0 or s.stl > 0 or s.blk > 0 or s.tov > 0 or s.pf > 0
  );
$$;

comment on function public.bbc_feuille_remplie(match_stats) is
  'Une ligne de feuille de match compte-t-elle comme un match joué ? '
  'Le club a dit qu''elle a joué, et la ligne porte quelque chose. '
  'Une ligne entièrement à zéro est une composition, pas un match.';

grant execute on function public.bbc_feuille_remplie(match_stats) to anon, authenticated;


-- ---------------------------------------------------------------------
--  2) LA VUE DE SAISON APPLIQUE CETTE DÉFINITION PARTOUT
--  ---------------------------------------------------------------------
--  Les dix-sept colonnes gardent leur nom, leur ordre et leur type :
--  « create or replace view » ne sait qu'AJOUTER des colonnes à la fin.
--  stl_moy est donc la dix-huitième.
--
--  stl_moy arrive ici parce que l'admin la calculait de son côté, dans
--  une seconde requête, sur toutes les lignes « played » de toutes les
--  saisons -- pendant que les cinq autres moyennes venaient d'ici et de
--  la saison en cours. Six chiffres côte à côte dont un seul ne parlait
--  pas de la même chose.
-- ---------------------------------------------------------------------
create or replace view public.player_season_stats with (security_invoker = on) as
  select s.player_id, p.name, p.jersey_number,
    count(*) filter (where bbc_feuille_remplie(s)) as matchs_joues,
    count(*) filter (where s.is_starter and bbc_feuille_remplie(s)) as titularisations,
    sum(s.minutes) filter (where bbc_feuille_remplie(s)) as minutes_total,
    sum(s.pts) filter (where bbc_feuille_remplie(s)) as pts_total,
    round(avg(s.pts) filter (where bbc_feuille_remplie(s)), 1) as pts_moy,
    round(avg(s.reb) filter (where bbc_feuille_remplie(s)), 1) as reb_moy,
    round(avg(s.ast) filter (where bbc_feuille_remplie(s)), 1) as ast_moy,
    round(avg(s.eval) filter (where bbc_feuille_remplie(s)), 1) as eval_moy,
    sum(s.fg2_made + s.fg3_made) filter (where bbc_feuille_remplie(s)) as tirs_reussis,
    sum(s.fg2_att + s.fg3_att) filter (where bbc_feuille_remplie(s)) as tirs_tentes,
    case when sum(s.fg2_att + s.fg3_att) filter (where bbc_feuille_remplie(s)) > 0
         then round(100.0 * sum(s.fg2_made + s.fg3_made) filter (where bbc_feuille_remplie(s))
                          / sum(s.fg2_att + s.fg3_att) filter (where bbc_feuille_remplie(s)), 1) end as pct_tirs,
    case when sum(s.fg3_att) filter (where bbc_feuille_remplie(s)) > 0
         then round(100.0 * sum(s.fg3_made) filter (where bbc_feuille_remplie(s))
                          / sum(s.fg3_att) filter (where bbc_feuille_remplie(s)), 1) end as pct_3pts,
    case when sum(s.ft_att) filter (where bbc_feuille_remplie(s)) > 0
         then round(100.0 * sum(s.ft_made) filter (where bbc_feuille_remplie(s))
                          / sum(s.ft_att) filter (where bbc_feuille_remplie(s)), 1) end as pct_lf,
    max(m.match_date) filter (where bbc_feuille_remplie(s)) as dernier_match,
    round(avg(s.stl) filter (where bbc_feuille_remplie(s)), 1) as stl_moy
  from match_stats s
  join players p on p.id = s.player_id
  join matches m on m.id = s.match_id
  cross join bbc_saison_courante() sc
  where m.score_baobabs is not null and m.score_opponent is not null
    and m.match_date between sc.debut and sc.fin
  group by s.player_id, p.name, p.jersey_number;


-- ---------------------------------------------------------------------
--  3) CE QUE L'ADMIN DOIT POUVOIR DEMANDER
--  ---------------------------------------------------------------------
--  L'écart entre un score et sa feuille de match ne se voyait nulle
--  part. Il se lit d'une requête, et l'admin peut désormais le poser
--  sur l'écran des matchs comme sur celui de la cohérence.
--
--  Trois états, et un seul demande un geste :
--
--    « complète »   le match a un score et une feuille remplie
--    « a_remplir »  le match a un score, la feuille est vide ou
--                   n'existe pas -- les statistiques de ce match sont
--                   perdues pour la saison tant que personne n'y touche
--    « a_scorer »   la feuille est remplie, le score manque -- rien ne
--                   remonte, ni au classement ni aux moyennes
--
--  Les matchs à venir ne sont pas un état : ils ne figurent pas.
-- ---------------------------------------------------------------------
create or replace view public.matchs_feuille_etat with (security_invoker = on) as
  select m.id as match_id,
         m.match_date,
         m.opponent_name,
         m.is_home,
         m.score_baobabs,
         m.score_opponent,
         count(s.id) as lignes,
         count(s.id) filter (where bbc_feuille_remplie(s)) as lignes_remplies,
         coalesce(sum(s.pts) filter (where bbc_feuille_remplie(s)), 0) as points_feuille,
         case
           when m.score_baobabs is not null and m.score_opponent is not null
                and count(s.id) filter (where bbc_feuille_remplie(s)) > 0 then 'complete'
           when m.score_baobabs is not null and m.score_opponent is not null then 'a_remplir'
           -- Le reste : la feuille porte quelque chose et le score manque,
           -- OU un seul des deux scores est saisi. Dans les deux cas le
           -- match ne remonte nulle part, et c'est le score qu'il faut.
           else 'a_scorer'
         end as etat
    from matches m
    left join match_stats s on s.match_id = m.id
   group by m.id, m.match_date, m.opponent_name, m.is_home,
            m.score_baobabs, m.score_opponent
  having m.score_baobabs is not null
      or m.score_opponent is not null
      or count(s.id) filter (where bbc_feuille_remplie(s)) > 0;

comment on view public.matchs_feuille_etat is
  'Un match joué, son score et sa feuille de match : les trois se tiennent '
  'ou l''un manque. « a_remplir » = score sans feuille, les statistiques du '
  'match sont perdues pour la saison. « a_scorer » = feuille sans score, '
  'rien ne remonte.';


-- ---------------------------------------------------------------------
--  VÉRIFICATIONS
--  ---------------------------------------------------------------------
--  1. La composition du 16 septembre ne compte pour personne, même si
--     son score est saisi :
--
--       select count(*) filter (where bbc_feuille_remplie(s)) as remplies,
--              count(*) as lignes
--         from match_stats s
--         join matches m on m.id = s.match_id
--        where m.opponent_name = 'AFSO';
--       -- attendu : remplies = 0, lignes = 8
--
--  2. Les dix-huit colonnes de la vue de saison :
--
--       select count(*) from information_schema.columns
--        where table_name = 'player_season_stats';
--       -- attendu : 18
--
--  3. Ce que l'admin doit montrer :
--
--       select match_date, opponent_name, etat, lignes, lignes_remplies
--         from matchs_feuille_etat order by match_date;
--       -- attendu : les deux matchs à score en « a_remplir »,
--       --           AFSO absent (composition vide, pas de score)
-- ---------------------------------------------------------------------
