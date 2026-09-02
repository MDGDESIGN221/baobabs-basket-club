-- =====================================================================
--  Baobabs Basket Club — DIAGNOSTIC de l'administration
--  20 août 2026
--
--  À COLLER DANS SUPABASE : SQL Editor → New query → Run.
--  Ne modifie RIEN. Que des lectures.
--
--  Objectif : savoir pourquoi « créer une catégorie de billet » échoue.
--  Vu de l'extérieur, un refus RLS et une requête qui ne ramène rien se
--  ressemblent exactement. Seul pg_policies tranche.
--
--  Renvoie 7 tableaux. Copie-les-moi tels quels.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. QUI EST ADMINISTRATEUR, ET SOUS QUEL RÔLE
--    Si role est vide ou différent de super_admin, tout le reste suit.
-- ---------------------------------------------------------------------
select '1. comptes admin' as bloc, email, role, user_id
  from admin_users
 order by email;


-- ---------------------------------------------------------------------
-- 2. LA MATRICE DES DROITS EST-ELLE PEUPLÉE
--    Vide = MIGRATION-phase0-socle.sql n'a jamais tourné.
-- ---------------------------------------------------------------------
select '2. droits par rôle' as bloc, role, count(*) as nb_autorisations
  from role_permissions
 group by role
 order by role;


-- ---------------------------------------------------------------------
-- 3. LES POLITIQUES RÉELLES SUR LA BILLETTERIE
--    C'est LE tableau qui compte. « qual » = condition de lecture,
--    « with_check » = condition d'écriture.
-- ---------------------------------------------------------------------
select '3. policies billetterie' as bloc,
       tablename, policyname, cmd, qual, with_check
  from pg_policies
 where schemaname = 'public'
   and tablename in ('ticket_offers','reservations')
 order by tablename, policyname;


-- ---------------------------------------------------------------------
-- 4. LES FONCTIONS DE DROITS EXISTENT-ELLES
--    Une politique qui appelle une fonction absente ne renvoie pas
--    « faux » : elle fait échouer toute la requête.
-- ---------------------------------------------------------------------
select '4. fonctions' as bloc, p.proname as fonction,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('is_admin','bbc_role','bbc_can','bbc_est_super_admin',
                     'bbc_reserver','bbc_retirer_reservation','bbc_annuler_reservation')
 order by p.proname;


-- ---------------------------------------------------------------------
-- 5. QUI PEUT EXÉCUTER CES FONCTIONS
--    anon doit pouvoir appeler bbc_can, même pour s'entendre dire non.
-- ---------------------------------------------------------------------
select '5. droits execute' as bloc,
       routine_name, grantee, privilege_type
  from information_schema.routine_privileges
 where routine_schema = 'public'
   and routine_name in ('is_admin','bbc_role','bbc_can')
 order by routine_name, grantee;


-- ---------------------------------------------------------------------
-- 6. CE QUE RÉPONDENT LES FONCTIONS POUR *TOI*, ICI ET MAINTENANT
--    Attention : dans le SQL Editor tu es « postgres », pas ton compte
--    admin. auth.uid() sera donc NULL et ces réponses seront « faux ».
--    C'est normal — le tableau 7 fait le vrai test.
-- ---------------------------------------------------------------------
select '6. contexte SQL Editor' as bloc,
       current_user                       as role_postgres,
       auth.uid()                         as auth_uid,
       is_admin()                         as is_admin,
       bbc_role()                         as bbc_role,
       bbc_can('billetterie','modifier')  as peut_modifier_billetterie;


-- ---------------------------------------------------------------------
-- 7. LE VRAI TEST : SE METTRE À LA PLACE DE TON COMPTE ADMIN
--    Remplace l'adresse ci-dessous par la tienne si besoin, puis lis
--    « peut_ecrire_billetterie ». C'est la réponse cherchée.
-- ---------------------------------------------------------------------
do $$
declare
  v_email text := 'baobabsbasketclub@gmail.com';   -- <== adapte si besoin
  v_uid   uuid;
  v_role  text;
  v_can   boolean;
begin
  select user_id, role into v_uid, v_role
    from admin_users where email = v_email;

  if v_uid is null then
    raise notice '7. ÉCHEC : aucun compte admin_users avec l''email %', v_email;
    return;
  end if;

  select case
           when v_role = 'super_admin' then true
           else exists (select 1 from role_permissions
                         where role = v_role
                           and module = 'billetterie'
                           and action = 'modifier')
         end
    into v_can;

  raise notice '7. compte=% | user_id=% | role=% | peut_ecrire_billetterie=%',
               v_email, v_uid, v_role, v_can;
end $$;


-- =====================================================================
--  CE QUE LE RÉSULTAT VEUT DIRE
--
--  Tableau 3 vide                -> RLS active sans aucune politique :
--                                   personne n'écrit, même admin.
--  Tableau 3 avec bbc_can(...)   -> les correctifs du 17 août sont passés.
--  Tableau 3 avec is_admin()     -> seul MIGRATION-billetterie.sql est passé.
--  Tableau 2 vide                -> phase0-socle jamais exécutée : bbc_can
--                                   renvoie faux pour tout rôle non super_admin.
--  Notice 7 = false              -> c'est bien la base qui refuse l'écriture.
--  Notice 7 = true               -> la base autorise : le blocage est côté
--                                   navigateur, on le trouvera au clic.
-- =====================================================================
