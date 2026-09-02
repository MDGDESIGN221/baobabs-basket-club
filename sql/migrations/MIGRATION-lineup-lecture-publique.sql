-- ============================================================
--  LA COMPOSITION DU PROCHAIN MATCH, LISIBLE PAR LE SITE
-- ============================================================
--  À passer dans Supabase → SQL Editor.
--
--  POURQUOI CE FICHIER
--  Le site public affiche désormais le cinq de départ. Il a donc besoin
--  de lire `match_stats`, ce qu'il n'a jamais fait jusqu'ici : rien ne
--  garantit qu'une politique de lecture existe pour lui.
--
--  CE QU'ON N'OUVRE PAS
--  `match_stats` contient les statistiques de chaque joueuse pour chaque
--  match : points, rebonds, passes, fautes, évaluation. Le site n'a
--  besoin que de trois colonnes — quel match, quelle joueuse, titulaire
--  ou non. On expose donc une VUE réduite à ces trois colonnes, plutôt
--  que d'ouvrir la table entière. Une politique est au niveau de la
--  ligne, jamais de la colonne : sans vue, tout passerait.
--
--  Le script est en trois temps : on CONSTATE, on CRÉE, on VÉRIFIE.
--  Rien n'est détruit, et la section D annule tout si besoin.
-- ============================================================


-- ============================================================
--  A · CONSTAT — à lire avant de créer quoi que ce soit
-- ============================================================
--  Une lecture qui renvoie [] ne prouve rien : ça peut être une table
--  vide comme une politique qui refuse tout en silence. Seul
--  pg_policies dit la vérité.

select 'A1 · politiques sur match_stats' as controle,
       coalesce(string_agg(policyname || ' [' || cmd || '] pour ' ||
                           array_to_string(roles, ','), ' | '),
                'AUCUNE POLITIQUE') as detail
from pg_policies
where schemaname = 'public' and tablename = 'match_stats';

select 'A2 · RLS activée sur match_stats' as controle,
       case when relrowsecurity then 'oui' else 'NON — la table est ouverte à tous' end as detail
from pg_class where oid = 'public.match_stats'::regclass;

select 'A3 · lignes de feuille de match' as controle,
       count(*)::text || ' ligne(s), dont ' ||
       count(*) filter (where is_starter) ::text || ' titulaire(s)' as detail
from public.match_stats;

select 'A4 · la vue existe déjà ?' as controle,
       case when exists (select 1 from pg_views
                         where schemaname = 'public' and viewname = 'match_lineup_public')
            then 'oui — la section B ne fera que la remplacer'
            else 'non' end as detail;


-- ============================================================
--  B · LA VUE — trois colonnes, rien de plus
-- ============================================================

create or replace view public.match_lineup_public as
  select match_id, player_id, coalesce(is_starter, false) as is_starter
  from public.match_stats;

-- security_invoker = off (le défaut sur une vue) : la vue lit
-- match_stats avec les droits de son PROPRIÉTAIRE, pas ceux du
-- visiteur. C'est ce qui permet de laisser match_stats fermée tout en
-- publiant ces trois colonnes.
alter view public.match_lineup_public set (security_invoker = off);

-- anon  = le visiteur du site public (clef publishable)
-- authenticated = une personne connectée à l'administration
grant select on public.match_lineup_public to anon, authenticated;


-- ============================================================
--  C · VÉRIFICATION — après la section B
-- ============================================================

select 'C1 · la vue répond' as controle,
       count(*)::text || ' ligne(s) visible(s)' as detail
from public.match_lineup_public;

select 'C2 · droit de lecture accordé' as controle,
       coalesce(string_agg(grantee, ', '), 'AUCUN — le site ne verra rien') as detail
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'match_lineup_public'
  and privilege_type = 'SELECT'
  and grantee in ('anon', 'authenticated');

select 'C3 · match_stats reste fermée' as controle,
       case when exists (
              select 1 from information_schema.role_table_grants
              where table_schema = 'public' and table_name = 'match_stats'
                and privilege_type = 'SELECT' and grantee = 'anon')
            then 'ATTENTION : anon peut lire match_stats en entier'
            else 'oui — seules les trois colonnes de la vue sont publiques' end as detail;

--  Le contrôle qui compte vraiment : la même requête que le site.
--  Remplacez 0 par l'identifiant du prochain match si vous le connaissez.
select 'C4 · ce que le site lira' as controle,
       coalesce(string_agg(player_id::text || (case when is_starter then ' (titulaire)' else '' end), ', '),
                'aucune ligne pour ce match') as detail
from public.match_lineup_public
where match_id = (select id from public.matches
                  where match_date >= current_date
                  order by match_date asc limit 1);


-- ============================================================
--  D · POUR REVENIR EN ARRIÈRE
-- ============================================================
--  Décommentez et exécutez ces deux lignes. Rien d'autre n'aura été
--  touché : match_stats n'est pas modifiée par ce script.
--
-- revoke select on public.match_lineup_public from anon, authenticated;
-- drop view if exists public.match_lineup_public;
