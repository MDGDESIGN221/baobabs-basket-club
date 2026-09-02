-- =====================================================================
--  Baobabs Basket Club — CORRECTIF : le compte du club était en lecture seule
--  20 août 2026
--
--  CE QU'ON A TROUVÉ
--  baobabsbasketclub@gmail.com portait le rôle « president ». Or
--  MIGRATION-phase0-socle.sql n'accorde au président que « voir » et
--  « exporter » sur les dix modules — ses seuls droits d'écriture sont
--  contenu:approuver, contenu:publier, reglages:modifier et
--  inscriptions:modifier.
--
--  Depuis CORRECTIF-URGENT-rls-commandes.sql, la politique
--  ticket_offers_admin_ecriture exige bbc_can('billetterie','modifier').
--  Le compte du club ne l'avait pas : toute création de catégorie de
--  billet était refusée par la base. Idem pour la boutique, l'effectif,
--  les matchs et les articles.
--
--  POURQUOI super_admin PLUTÔT QU'UN PRÉSIDENT ENRICHI
--  Le modèle de rôles a été écrit pour le jour où un coach ou un
--  community manager aura son propre compte. Le compte du club n'est
--  pas un président au sens de ce modèle : c'est celui qui fait tourner
--  la maison au quotidien. Lui donner le rôle qui décrit ce qu'il fait
--  vraiment vaut mieux que gonfler « president » jusqu'à ce que le mot
--  ne veuille plus rien dire.
--
--  À exécuter dans Supabase : SQL Editor → New query → Run.
--  Idempotent. Aucune donnée supprimée.
-- =====================================================================

update admin_users
   set role = 'super_admin'
 where email = 'baobabsbasketclub@gmail.com';


-- ---------------------------------------------------------------------
--  VÉRIFICATION — les deux comptes doivent ressortir en super_admin,
--  et « peut_ecrire_billetterie » à true pour les deux.
-- ---------------------------------------------------------------------
select a.email,
       a.role,
       case
         when a.role = 'super_admin' then true
         else exists (select 1 from role_permissions
                       where role = a.role
                         and module = 'billetterie'
                         and action = 'modifier')
       end as peut_ecrire_billetterie
  from admin_users a
 order by a.email;


-- =====================================================================
--  APRÈS AVOIR PASSÉ CE SCRIPT
--
--  Le changement de rôle est lu par bbc_role() à chaque requête, mais
--  l'écran d'administration ne charge le rôle qu'à la connexion. Il
--  faut donc SE DÉCONNECTER ET SE RECONNECTER pour que la barre
--  latérale et les droits d'écriture suivent.
--
--  UNE INCOHÉRENCE LAISSÉE EN PLACE, VOLONTAIREMENT
--  ticket_offers_admin_ecriture est « for all » et exige « modifier »
--  pour créer et pour supprimer, alors que reservations distingue
--  proprement creer / modifier / supprimer. Ça ne gêne personne tant
--  que les comptes sont super_admin ; le jour où un rôle intermédiaire
--  gérera la billetterie, il faudra aligner les deux tables.
-- =====================================================================
