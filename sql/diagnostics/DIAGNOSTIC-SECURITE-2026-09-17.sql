-- =====================================================================
--  DIAGNOSTIC DE SECURITE, 17 septembre 2026
--  NE MODIFIE RIEN. Lit, et rend compte.
--
--  POURQUOI CE FICHIER EXISTE
--  L'audit du 17 septembre a ete fait en lisant le depot. Or le depot
--  n'est pas la base : plusieurs politiques posees a la main dans
--  l'editeur SQL n'y figurent nulle part, et la migration du matin en a
--  decouvert huit sur players et staff qu'aucun grep n'aurait vues.
--  Une lecture depuis le site ne prouve rien non plus : une reponse
--  vide peut vouloir dire « table protegee » comme « table vide ».
--
--  Seul pg_policies fait foi. Les onze requetes ci-dessous sont les
--  onze questions auxquelles je n'ai pas pu repondre depuis le depot.
--
--  MODE D'EMPLOI
--  Supabase, SQL Editor, New query. Coller le tout, executer, et lire
--  les resultats bloc par bloc. Le resultat attendu est ecrit au-dessus
--  de chaque requete. Toute ligne inattendue est une porte a fermer.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. LES PORTES D'ECRITURE SANS CONDITION
--     Attendu : contact_messages, newsletter_subscribers,
--     recruitment_requests et orders, et RIEN D'AUTRE. Ce sont les
--     quatre formulaires publics. Toute autre ligne veut dire qu'un
--     inconnu peut ecrire dans cette table.
-- ---------------------------------------------------------------------
select 'A. ecriture sans condition' as bloc,
       tablename, policyname, cmd, roles::text
  from pg_policies
 where schemaname = 'public'
   and cmd <> 'SELECT'
   and coalesce(qual, 'true') = 'true'
   and coalesce(with_check, 'true') = 'true'
   and (roles::text like '%public%' or roles::text like '%anon%'
        or roles::text like '%authenticated%')
 order by tablename, policyname;


-- ---------------------------------------------------------------------
--  2. LES TABLES SANS SECURITE AU NIVEAU DES LIGNES
--     Une table dont rls_actif vaut false n'a AUCUNE protection : les
--     politiques qu'elle porte sont inertes, et la cle publique lit et
--     ecrit tout. Attendu : aucune ligne.
-- ---------------------------------------------------------------------
select 'B. RLS eteint' as bloc,
       c.relname as tablename,
       c.relrowsecurity as rls_actif,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname) as nb_politiques
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
   and c.relrowsecurity = false
 order by c.relname;


-- ---------------------------------------------------------------------
--  3. LES TABLES AVEC RLS MAIS SANS AUCUNE POLITIQUE
--     Celles-la sont fermees a double tour, y compris pour
--     l'administration. Si un ecran de l'admin ne charge jamais, la
--     reponse est souvent ici. Ce n'est pas un trou de securite, c'est
--     une panne.
-- ---------------------------------------------------------------------
select 'C. RLS sans politique' as bloc, c.relname as tablename
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
   and c.relrowsecurity = true
   and not exists (select 1 from pg_policies p
                    where p.schemaname = 'public' and p.tablename = c.relname)
 order by c.relname;


-- ---------------------------------------------------------------------
--  4. QUI DECIDE, TABLE PAR TABLE
--     La colonne serrure dit ce sur quoi repose la protection :
--       role      la politique appelle bbc_can() : le role compte
--       admin     la politique appelle is_admin() : TOUT compte de
--                 admin_users passe, coach comme community manager
--       proprio   reservee au compte propriétaire
--       soi       le client ne voit que sa propre ligne
--       ouvert    aucune condition
--     Tout ce qui est « admin » sur une table d'argent, de dossiers ou
--     de reglages est une separation des roles qui n'existe qu'a
--     l'ecran, pas en base.
-- ---------------------------------------------------------------------
select 'D. serrure par table' as bloc,
       tablename, policyname, cmd,
       case
         when coalesce(qual,'') || coalesce(with_check,'') like '%bbc_can%'            then 'role'
         when coalesce(qual,'') || coalesce(with_check,'') like '%bbc_est_proprietaire%' then 'proprio'
         when coalesce(qual,'') || coalesce(with_check,'') like '%bbc_est_super_admin%'  then 'super'
         when coalesce(qual,'') || coalesce(with_check,'') like '%is_admin%'           then 'admin'
         when coalesce(qual,'') || coalesce(with_check,'') like '%auth.uid%'            then 'soi'
         when coalesce(qual,'true') = 'true' and coalesce(with_check,'true') = 'true'  then 'ouvert'
         else 'autre'
       end as serrure
  from pg_policies
 where schemaname = 'public'
 order by serrure, tablename, cmd;


-- ---------------------------------------------------------------------
--  5. LES VUES QUI TRAVERSENT LA SECURITE
--     Une vue sans security_invoker s'execute avec les droits de son
--     proprietaire : elle IGNORE le RLS des tables qu'elle lit. C'est
--     voulu pour effectif_site, staff_site, saison_publique,
--     match_lineup_public et player_season_stats : ce sont les vues du
--     site public, et elles nomment leurs colonnes une par une.
--     Toute AUTRE vue dans cette liste qui porte un « select * » sur
--     une table de dossiers, de clients ou de commandes est une fuite.
-- ---------------------------------------------------------------------
select 'E. vues en definer' as bloc,
       c.relname as vue,
       coalesce((select o from unnest(c.reloptions) o
                  where o like 'security_invoker%'), 'NON DEFINI (= definer)') as reglage,
       has_table_privilege('anon', 'public.' || quote_ident(c.relname), 'SELECT') as lisible_par_anon
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'v'
   and coalesce(array_to_string(c.reloptions, ','), '') not like '%security_invoker=on%'
 order by lisible_par_anon desc, c.relname;


-- ---------------------------------------------------------------------
--  6. CE QUE LA CLE PUBLIQUE PEUT LIRE ET ECRIRE
--     Les droits de table (grant) sont une couche AVANT le RLS. Une
--     table sans RLS et avec un grant a anon est lisible par tout le
--     monde, quelles que soient ses politiques.
--     Attendu en ecriture pour anon : les quatre formulaires publics.
-- ---------------------------------------------------------------------
select 'F. grants a anon' as bloc,
       table_name, string_agg(privilege_type, ', ' order by privilege_type) as droits
  from information_schema.role_table_grants
 where grantee = 'anon' and table_schema = 'public'
   and privilege_type in ('INSERT','UPDATE','DELETE')
 group by table_name
 order by table_name;


-- ---------------------------------------------------------------------
--  7. LES FONCTIONS APPELABLES SANS COMPTE
--     Chacune est une porte ouverte sur l'API, atteignable avec la
--     seule cle publique du site. Relire cette liste une par une et se
--     demander : « si quelqu'un l'appelle mille fois par seconde avec
--     n'importe quels arguments, que se passe-t-il ? »
--     verify_audit_password et log_audit_entry ne doivent PLUS y
--     figurer apres le correctif du 17 septembre.
-- ---------------------------------------------------------------------
select 'G. fonctions ouvertes a anon' as bloc,
       p.proname,
       pg_get_function_identity_arguments(p.oid) as arguments,
       case when p.prosecdef then 'security definer' else 'invoker' end as mode
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and has_function_privilege('anon', p.oid, 'EXECUTE')
 order by p.proname;


-- ---------------------------------------------------------------------
--  8. LES ESPACES DE STOCKAGE
--     public = true veut dire : tout fichier qui y entre est lisible
--     par son adresse, sans compte, pour toujours.
--     Attendu : dossiers-prives en false. site-media et
--     recruitment-photos en true, avec une limite de taille ET une
--     liste de types. Une limite nulle veut dire « aucune limite ».
-- ---------------------------------------------------------------------
select 'H. buckets' as bloc,
       id, public, file_size_limit, allowed_mime_types
  from storage.buckets
 order by id;


-- ---------------------------------------------------------------------
--  9. QUI ECRIT DANS LE STOCKAGE
--     Attendu : une seule porte pour anon, sur recruitment-photos, en
--     INSERT. Toute porte anon sur site-media ou dossiers-prives est
--     grave : la premiere sert les images du site, la seconde contient
--     les pieces d'identite de mineurs.
-- ---------------------------------------------------------------------
select 'I. politiques de stockage' as bloc,
       policyname, cmd, roles::text, qual, with_check
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
 order by policyname;


-- ---------------------------------------------------------------------
-- 10. LES COMPTES ET LEURS CASQUETTES
--     Le rappel utile avant de durcir : combien de personnes, et sous
--     quelle casquette. Tant que tout le monde est super_admin, le
--     durcissement par role ne change rien au quotidien ; le jour ou un
--     coach a son compte, il change tout.
-- ---------------------------------------------------------------------
select 'J. comptes' as bloc,
       a.email, a.nom, a.role,
       (select count(*) from role_permissions rp where rp.role = a.role) as nb_droits
  from admin_users a
 order by a.role, a.email;


-- ---------------------------------------------------------------------
-- 11. LE JOURNAL D'ACTIVITE, TEL QU'IL EST
--     nb_entrees dit si le journal sert vraiment. emails_distincts dit
--     s'il distingue les personnes. La derniere colonne est la seule
--     qui compte apres le correctif : le journal doit etre alimente par
--     la session, pas par ce que le navigateur declare.
-- ---------------------------------------------------------------------
select 'K. journal' as bloc,
       count(*)                                   as nb_entrees,
       count(distinct user_email)                 as emails_distincts,
       min(created_at)                            as premiere,
       max(created_at)                            as derniere,
       count(*) filter (where user_email is null) as sans_auteur
  from admin_audit_log;


-- =====================================================================
--  APRES AVOIR LU LES ONZE BLOCS
--
--  Les blocs A, B, F, I sont les seuls qui peuvent contenir une
--  urgence : une porte ouverte a un inconnu. Le bloc D dit ce qui est
--  garde par un role et ce qui est garde seulement par « est-ce un
--  compte d'administration ». Le bloc E dit quelles vues traversent
--  tout. Les autres sont du contexte.
--
--  Renvoyer les blocs A, B, D, E, F, G, H et I permet d'ecrire le
--  durcissement restant sans rien deviner.
-- =====================================================================
