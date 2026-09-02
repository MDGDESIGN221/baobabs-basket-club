-- =====================================================================
--  Baobabs Basket Club — Verrouiller l'attribution des rôles
--  17 août 2026. Idempotent. Aucune donnée supprimée.
--
--  DEMANDE : « Comptes & rôles devrait avoir un mot de passe, et il n'y
--  a que moi qui attribue les rôles. »
--
--  DEUX CHOSES DIFFÉRENTES, ET IL FAUT LES DEUX
--
--    Le mot de passe protège l'ÉCRAN. Il empêche qu'on change un rôle
--    par mégarde, ou depuis une session laissée ouverte sur un
--    téléphone. C'est utile, et c'est tout ce que c'est.
--
--    Il n'empêche RIEN au niveau de la base : la politique
--    admin_users_ecriture autorise tout compte super_admin à écrire, et
--    une requête directe à l'API ne passe par aucun écran. Tant qu'un
--    second compte est super_admin, il peut attribuer des rôles, mot de
--    passe ou pas.
--
--    La vraie serrure, c'est donc l'étape 2 : un seul super_admin.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. LE MOT DE PASSE DE L'ÉCRAN
--    On réutilise le secret déjà en place (admin_audit_secret), haché
--    en bcrypt, jamais en clair nulle part. Un second mot de passe à
--    retenir serait un second mot de passe à oublier.
--
--    La fonction ne dit pas « oui » ou « non » à un mot de passe : elle
--    renvoie la liste des comptes, ou rien. Impossible de s'en servir
--    pour tester des mots de passe sans rien obtenir en retour.
-- ---------------------------------------------------------------------
create or replace function bbc_comptes_deverrouiller(pwd text)
returns table (user_id uuid, email text, role text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  -- Deux conditions, pas une : le bon mot de passe ET un compte
  -- administrateur. Le mot de passe seul ne doit ouvrir la liste des
  -- comptes du club à personne.
  if not is_admin() then return; end if;

  if exists (select 1 from admin_audit_secret
              where id = 1 and pwd_hash = crypt(pwd, pwd_hash)) then
    return query select a.user_id, a.email, a.role from admin_users a order by a.email;
  end if;
  return;
end;
$$;

revoke all on function bbc_comptes_deverrouiller(text) from public;
grant execute on function bbc_comptes_deverrouiller(text) to authenticated;


-- ---------------------------------------------------------------------
-- 2. LA VRAIE SERRURE — UN SEUL SUPER ADMINISTRATEUR
--
--    Le second compte passe en « president » : il garde la lecture de
--    tout et l'approbation du contenu, il perd le droit de distribuer
--    les casquettes. C'est exactement « il n'y a que moi qui attribue
--    les rôles », appliqué par la base et non par un écran.
--
--    ⚠️  VÉRIFIEZ L'ADRESSE CI-DESSOUS AVANT DE LANCER.
--    Celle qui reste super_admin est mdgdesign221@gmail.com. Si ce
--    n'est pas la bonne, corrigez les deux lignes — se tromper ici
--    revient à se retirer soi-même la clé.
-- ---------------------------------------------------------------------
update admin_users
   set role = 'president'
 where lower(email) <> 'mdgdesign221@gmail.com'
   and role = 'super_admin';

-- Garde-fou : si l'adresse ci-dessus était fausse, il ne resterait
-- aucun super administrateur et plus personne ne pourrait en nommer un.
-- On refuse alors la migration entière.
do $$
declare n int;
begin
  select count(*) into n from admin_users where role = 'super_admin';
  if n = 0 then
    raise exception 'Aucun super administrateur ne resterait — migration annulée. Corrigez l''adresse e-mail à l''étape 2.';
  end if;
  raise notice 'Super administrateurs restants : %', n;
end $$;


-- =====================================================================
--  VÉRIFICATIONS
--
--    select email, role from admin_users order by email;
--    -- une seule ligne doit porter super_admin
--
--    -- doit renvoyer la liste des comptes :
--    select * from bbc_comptes_deverrouiller('votre-mot-de-passe');
--    -- doit renvoyer 0 ligne :
--    select * from bbc_comptes_deverrouiller('mauvais');
--
--  POUR CHANGER LE MOT DE PASSE PLUS TARD (il sert aussi à l'écran
--  Historique — le changer change les deux) :
--    update admin_audit_secret
--       set pwd_hash = crypt('nouveau_mot_de_passe', gen_salt('bf'))
--     where id = 1;
-- =====================================================================
