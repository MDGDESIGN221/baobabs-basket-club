-- ============================================================
--  L'ORDRE DE LA PLANCHE, ET LE BRASSARD
-- ============================================================
--  À passer dans Supabase → SQL Editor.
--
--  POURQUOI CE FICHIER
--  La composition savait dire QUI joue. Elle ne savait pas dire dans
--  quel ORDRE l'afficher, ni QUI porte le brassard. Deux informations
--  qu'un logiciel ne peut pas deviner : l'ordre d'une planche est un
--  choix du staff, pas le tri d'une base de données.
--
--  CE QU'ON AJOUTE
--    lineup_sort  — le rang dans la planche. 1 à 5 pour le cinq,
--                   11 et suivants pour le banc. Vide = pas de rang
--                   choisi : le site retombe alors sur l'ordre des
--                   postes (meneuse, arrière, ailière, ailière forte,
--                   pivot) et sur le numéro de maillot pour le banc.
--    is_captain   — le brassard. Une seule joueuse à la fois : c'est
--                   l'administration qui le garantit, la base se
--                   contente de le stocker.
--
--  CE QU'ON N'OUVRE PAS
--  `match_stats` reste fermée au site. On se contente d'ÉLARGIR la vue
--  publique de trois à cinq colonnes — quel match, quelle joueuse,
--  titulaire ou non, son rang, son brassard. Aucune statistique n'y
--  entre. Une politique est au niveau de la ligne, jamais de la
--  colonne : sans vue, tout passerait.
--
--  AVANT OU APRÈS ? Ce script fonctionne dans les deux cas, que
--  MIGRATION-lineup-lecture-publique.sql soit déjà passé ou non : il
--  crée la vue si elle manque, il la remplace si elle est là.
--
--  Le script est en quatre temps : on CONSTATE, on AJOUTE, on PUBLIE,
--  on VÉRIFIE. Rien n'est détruit, et la section E annule tout.
-- ============================================================


-- ============================================================
--  A · CONSTAT — à lire avant d'ajouter quoi que ce soit
-- ============================================================

select 'A1 · les colonnes existent déjà ?' as controle,
       coalesce(string_agg(column_name || ' (' || data_type || ')', ', '),
                'aucune des deux — la section B va les créer') as detail
from information_schema.columns
where table_schema = 'public' and table_name = 'match_stats'
  and column_name in ('lineup_sort', 'is_captain');

select 'A2 · la vue publique existe ?' as controle,
       case when exists (select 1 from pg_views
                         where schemaname = 'public' and viewname = 'match_lineup_public')
            then 'oui — la section C la remplacera par une vue à cinq colonnes'
            else 'non — la section C la créera' end as detail;

select 'A3 · lignes de composition' as controle,
       count(*)::text || ' ligne(s), dont ' ||
       count(*) filter (where is_starter)::text || ' titulaire(s)' as detail
from public.match_stats;


-- ============================================================
--  B · LES DEUX COLONNES
-- ============================================================
--  « if not exists » : le script peut être repassé sans dégât, et il ne
--  touche pas aux compositions déjà saisies. Les lignes existantes
--  reçoivent lineup_sort = null (aucun rang choisi) et is_captain =
--  false — exactement ce qu'elles valaient implicitement jusqu'ici.

alter table public.match_stats
  add column if not exists lineup_sort smallint,
  add column if not exists is_captain  boolean not null default false;

comment on column public.match_stats.lineup_sort is
  'Rang dans la planche de composition : 1-5 le cinq, 11+ le banc. Null = pas de rang choisi.';
comment on column public.match_stats.is_captain is
  'Porte le brassard sur ce match. L''unicité est tenue par l''administration.';


-- ============================================================
--  C · LA VUE — cinq colonnes, pas une de plus
-- ============================================================

create or replace view public.match_lineup_public as
  select match_id,
         player_id,
         coalesce(is_starter, false) as is_starter,
         lineup_sort,
         coalesce(is_captain, false) as is_captain
  from public.match_stats;

-- security_invoker = off (le défaut sur une vue) : la vue lit
-- match_stats avec les droits de son PROPRIÉTAIRE, pas ceux du
-- visiteur. C'est ce qui permet de laisser match_stats fermée tout en
-- publiant ces cinq colonnes.
alter view public.match_lineup_public set (security_invoker = off);

-- anon = le visiteur du site public (clef publishable)
-- authenticated = une personne connectée à l'administration
grant select on public.match_lineup_public to anon, authenticated;


-- ============================================================
--  D · VÉRIFICATION — après les sections B et C
-- ============================================================

select 'D1 · les colonnes sont là' as controle,
       coalesce(string_agg(column_name, ', ' order by column_name),
                'MANQUE — la section B n''a pas abouti') as detail
from information_schema.columns
where table_schema = 'public' and table_name = 'match_stats'
  and column_name in ('lineup_sort', 'is_captain');

select 'D2 · la vue rend cinq colonnes' as controle,
       string_agg(column_name, ', ' order by ordinal_position) as detail
from information_schema.columns
where table_schema = 'public' and table_name = 'match_lineup_public';

select 'D3 · droit de lecture accordé' as controle,
       coalesce(string_agg(grantee, ', '), 'AUCUN — le site ne verra rien') as detail
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'match_lineup_public'
  and privilege_type = 'SELECT'
  and grantee in ('anon', 'authenticated');

select 'D4 · match_stats reste fermée' as controle,
       case when exists (
              select 1 from information_schema.role_table_grants
              where table_schema = 'public' and table_name = 'match_stats'
                and privilege_type = 'SELECT' and grantee = 'anon')
            then 'ATTENTION : anon peut lire match_stats en entier'
            else 'oui — seules les cinq colonnes de la vue sont publiques' end as detail;

--  Le contrôle qui compte vraiment : la même requête que le site, sur
--  le prochain match.
select 'D5 · ce que le site lira' as controle,
       coalesce(string_agg(
                  coalesce(lineup_sort::text, '-') || ' · ' || player_id::text ||
                  case when is_starter then ' (titulaire)' else ' (banc)' end ||
                  case when is_captain then ' (capitaine)' else '' end,
                  ' | ' order by lineup_sort nulls last),
                'aucune ligne pour ce match') as detail
from public.match_lineup_public
where match_id = (select id from public.matches
                  where match_date >= current_date
                  order by match_date asc limit 1);

--  Deux capitaines sur un même match : l'administration l'empêche, mais
--  une saisie directe en SQL, elle, ne l'empêche pas.
select 'D6 · un seul brassard par match' as controle,
       coalesce(string_agg(match_id::text || ' : ' || n::text || ' capitaines', ' | '),
                'oui — aucun match n''en compte deux') as detail
from (select match_id, count(*) as n
      from public.match_stats where is_captain group by match_id having count(*) > 1) x;


-- ============================================================
--  E · POUR REVENIR EN ARRIÈRE
-- ============================================================
--  Décommentez et exécutez. La vue revient à ses trois colonnes
--  d'origine ; les deux colonnes disparaissent avec les rangs et les
--  brassards saisis — le choix des titulaires, lui, n'est pas touché.
--
-- drop view if exists public.match_lineup_public;
-- create or replace view public.match_lineup_public as
--   select match_id, player_id, coalesce(is_starter, false) as is_starter
--   from public.match_stats;
-- alter view public.match_lineup_public set (security_invoker = off);
-- grant select on public.match_lineup_public to anon, authenticated;
-- alter table public.match_stats drop column if exists lineup_sort;
-- alter table public.match_stats drop column if exists is_captain;
