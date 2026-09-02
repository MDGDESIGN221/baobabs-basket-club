-- =====================================================================
--  Baobabs Basket Club — Correctif : ne publier que les matchs terminés
--  17 août 2026 — à passer APRÈS MIGRATION-phase0-socle.sql
--  Idempotent. Aucune donnée supprimée.
--
--  LE DÉFAUT CONSTATÉ
--  player_season_stats comptait TOUTES les feuilles de match, y compris
--  celles d'un match encore en cours — ou d'un essai de la table de
--  marque. Depuis que le site publie ces chiffres sur la fiche des
--  joueuses, cela donne deux problèmes bien réels :
--
--    1. Pendant un match, le profil public d'une joueuse afficherait
--       ses statistiques de mi-temps comme si c'était sa saison.
--       « 2 points de moyenne » à la 8e minute est une information
--       fausse, et c'est celle que verrait un recruteur de passage.
--
--    2. Un essai de la table de marque — quatre appuis pour vérifier
--       que ça marche — se retrouve publié sur la fiche d'une personne
--       réelle, avec une évaluation négative.
--
--  LA RÈGLE
--  Une statistique devient publique au coup de sifflet final, pas
--  avant. Un match n'est terminé que lorsqu'il porte ses deux scores :
--  c'est exactement ce que fait bbc_terminer_match.
-- =====================================================================

drop view if exists player_season_stats;

create view player_season_stats as
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
-- LA SEULE LIGNE QUI CHANGE : un match sans ses deux scores n'est pas
-- terminé, donc il ne compte pas dans une moyenne de saison.
where m.score_baobabs is not null and m.score_opponent is not null
group by s.player_id, p.name, p.jersey_number;

alter view player_season_stats set (security_invoker = on);


-- =====================================================================
--  MÉNAGE DE L'ESSAI DU 17 AOÛT
--  Quatre appuis de test sur la fiche de Bineta Cissé, et un direct
--  laissé ouvert. À lancer une seule fois, si vous n'avez pas déjà
--  nettoyé à la main.
--
--  Décommentez les trois lignes ci-dessous pour les exécuter.
--  Elles ne touchent QUE le match de test, identifié par le fait qu'il
--  n'a pas de score : un vrai match termine toujours avec le sien.
-- =====================================================================

-- delete from match_events where match_id in (select id from matches where score_baobabs is null);
-- delete from match_stats  where match_id in (select id from matches where score_baobabs is null);
-- update match_live set is_live = false, ended_at = now() where is_live;


-- =====================================================================
--  VÉRIFICATIONS
--    -- doit être vide tant qu'aucun match n'est terminé avec des stats :
--    select * from player_season_stats;
--    -- doit être vide : plus aucun direct en cours
--    select * from match_live where is_live;
-- =====================================================================
