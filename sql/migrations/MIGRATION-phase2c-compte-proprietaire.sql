-- =====================================================================
--  Baobabs Basket Club — LE COMPTE DU PROPRIÉTAIRE EST INTOUCHABLE
--  25 août 2026 — à passer APRÈS MIGRATION-phase0d-rls-par-role.sql
--  Idempotent. Aucune donnée supprimée.
--
--  DEMANDE
--    « J'aimerais que personne ne puisse changer mon rôle. Seul moi je
--      peux changer mon rôle et celui des autres ; les autres peuvent
--      changer ceux de tout le monde sauf le mien. »
--
--  POURQUOI LE MOT DE PASSE NE SUFFISAIT PAS
--    MIGRATION-phase2b a mis un mot de passe sur l'ÉCRAN Comptes, et
--    laissé un seul super administrateur. Deux limites :
--
--      1. Un mot de passe d'écran ne protège qu'un écran. Une requête
--         PATCH envoyée directement à l'API PostgREST ne passe par
--         aucun écran, ne voit aucun mot de passe, et la politique
--         admin_users_ecriture l'accepte dès lors qu'on est super_admin.
--
--      2. « Un seul super administrateur » est une situation, pas une
--         règle. Le jour où un deuxième est nommé — et il en faudra un,
--         le président a demandé deux comptes de plus — la protection
--         disparaît sans que personne ne s'en aperçoive.
--
--    Ce script remplace la situation par une règle, écrite dans la
--    base : la ligne du propriétaire n'est modifiable QUE par lui.
--    Peu importe le rôle de l'autre, peu importe l'écran, peu importe
--    qu'il passe par l'API à la main.
--
--  CE QUE ÇA CHANGE, EN UNE PHRASE
--    Tout super administrateur continue de distribuer les casquettes de
--    tout le monde. Une seule ligne lui est fermée : celle du
--    propriétaire du site.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. GARDE-FOU D'ABORD — on vérifie l'adresse AVANT de poser quoi que
--    ce soit. Protéger une adresse mal orthographiée, c'est ne rien
--    protéger du tout tout en croyant l'être : le pire des deux mondes.
--
--    ATTENTION. Si ce script s'arrête ici, lancez d'abord :
--        select email from admin_users order by email;
--    et recopiez l'adresse EXACTE aux deux endroits ci-dessous
--    (point 0 et point 1).
-- ---------------------------------------------------------------------
do $garde$
declare cible text := 'mdgdesign221@gmail.com';
begin
  if not exists (select 1 from admin_users where lower(email) = cible) then
    raise exception
      'Aucun compte « % » dans admin_users — rien ne serait protégé. Migration annulée.', cible;
  end if;
end
$garde$;


-- ---------------------------------------------------------------------
-- 1. QUI EST LE PROPRIÉTAIRE
--    Une fonction plutôt qu'une adresse recopiée à cinq endroits : le
--    jour où elle change, il n'y a qu'une ligne à toucher, et aucun
--    risque d'en oublier une qui laisserait un trou.
-- ---------------------------------------------------------------------
create or replace function bbc_proprietaire_email()
returns text language sql immutable set search_path = public as
$fn$
  select 'mdgdesign221@gmail.com'::text;
$fn$;

-- « Est-ce que la personne connectée EST le propriétaire ? »
-- security definer : la fonction doit pouvoir lire admin_users même
-- quand les politiques de la table diraient non.
create or replace function bbc_est_proprietaire()
returns boolean language sql stable security definer set search_path = public as
$fn$
  select exists (
    select 1 from admin_users
     where user_id = auth.uid()
       and lower(email) = bbc_proprietaire_email()
  );
$fn$;

grant execute on function bbc_proprietaire_email() to anon, authenticated;
grant execute on function bbc_est_proprietaire()   to anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. LA SERRURE — un déclencheur, pas seulement une politique
--
--    Pourquoi les deux (le point 3 ajoute aussi les politiques) :
--    une politique RLS qui refuse ne renvoie pas d'erreur, elle
--    renvoie « 0 ligne modifiée ». PostgREST répond alors 204, et
--    l'écran annonce fièrement « Rôle enregistré » alors que rien n'a
--    bougé. Le déclencheur, lui, lève une vraie erreur avec une vraie
--    phrase, que l'écran peut afficher.
--
--    L'ÉCHAPPATOIRE, ET POURQUOI ELLE EST VOULUE
--    Dans le SQL Editor de Supabase, auth.uid() est NULL : il n'y a pas
--    de session connectée. Le déclencheur laisse passer ce cas. Sans
--    ça, une adresse changée un jour vous enfermerait dehors sans
--    aucun moyen de rentrer. Ce n'est pas un trou : quiconque atteint
--    le SQL Editor ou la clé service_role a déjà les pleins pouvoirs
--    sur toute la base — aucune règle écrite dans la base ne peut s'y
--    opposer, ici ou ailleurs.
-- ---------------------------------------------------------------------
create or replace function bbc_admin_users_proteger()
returns trigger
language plpgsql
security definer
set search_path = public
as
$trg$
declare
  proprio text := bbc_proprietaire_email();
  sortie  admin_users%rowtype;
begin
  -- Un déclencheur BEFORE doit rendre la ligne qu'il laisse passer :
  -- OLD pour une suppression, NEW dans tous les autres cas. Écrit en
  -- toutes lettres plutôt qu'en coalesce(new, old) : sur un type
  -- composite, ce raccourci se comporte différemment selon les
  -- versions de Postgres, et une suppression silencieusement annulée
  -- serait le genre de bug qu'on ne découvre que six mois plus tard.
  if tg_op = 'DELETE' then sortie := old; else sortie := new; end if;

  -- Échappatoire SQL Editor / service_role (voir ci-dessus).
  if auth.uid() is null then
    return sortie;
  end if;

  -- Le propriétaire fait ce qu'il veut de sa propre ligne.
  if bbc_est_proprietaire() then
    return sortie;
  end if;

  -- a) Toucher à la ligne du propriétaire : non. Ni son rôle, ni son
  --    adresse, ni son identifiant, ni sa suppression.
  if tg_op in ('UPDATE','DELETE') and lower(coalesce(old.email,'')) = proprio then
    raise exception
      'Ce compte est celui du propriétaire du site : seul son titulaire peut le modifier.'
      using errcode = '42501';
  end if;

  -- b) S'attribuer l'adresse du propriétaire, ou créer une seconde
  --    ligne à son nom : non plus. Sans ce point, on contournait le
  --    point (a) en fabriquant un deuxième « propriétaire ».
  if tg_op in ('INSERT','UPDATE') and lower(coalesce(new.email,'')) = proprio then
    raise exception
      'Cette adresse est réservée au propriétaire du site.'
      using errcode = '42501';
  end if;

  return sortie;
end
$trg$;

drop trigger if exists bbc_admin_users_proteger on admin_users;
create trigger bbc_admin_users_proteger
  before insert or update or delete on admin_users
  for each row execute function bbc_admin_users_proteger();


-- ---------------------------------------------------------------------
-- 3. LA MÊME RÈGLE, EN POLITIQUES — ceinture et bretelles
--
--    Si un futur script laisse tomber le déclencheur, les politiques
--    tiennent encore. « for all » ne permettant pas de distinguer la
--    ligne visée d'une ligne écrite, on éclate en trois politiques.
-- ---------------------------------------------------------------------
drop policy if exists admin_users_ecriture on admin_users;
drop policy if exists admin_users_creation on admin_users;
drop policy if exists admin_users_modif    on admin_users;
drop policy if exists admin_users_suppr    on admin_users;

-- La lecture ne bouge pas : tout administrateur voit qui porte quelle
-- casquette. C'est ce qui permet au président d'avoir sa réponse sans
-- demander la permission à personne.
drop policy if exists admin_users_lecture on admin_users;
create policy admin_users_lecture on admin_users
  for select using (is_admin());

create policy admin_users_creation on admin_users
  for insert with check (
    bbc_est_super_admin()
    and (lower(email) <> bbc_proprietaire_email() or bbc_est_proprietaire())
  );

create policy admin_users_modif on admin_users
  for update
  using (
    bbc_est_super_admin()
    and (lower(email) <> bbc_proprietaire_email() or bbc_est_proprietaire())
  )
  with check (
    bbc_est_super_admin()
    and (lower(email) <> bbc_proprietaire_email() or bbc_est_proprietaire())
  );

create policy admin_users_suppr on admin_users
  for delete using (
    bbc_est_super_admin()
    and (lower(email) <> bbc_proprietaire_email() or bbc_est_proprietaire())
  );


-- ---------------------------------------------------------------------
-- 4. IL DOIT TOUJOURS RESTER UN SUPER ADMINISTRATEUR
--
--    Le seul scénario qui casse tout : le propriétaire se retire à
--    lui-même le rôle de super administrateur. Il perd le droit de
--    nommer qui que ce soit — et personne d'autre ne peut le lui
--    rendre, puisque sa ligne leur est fermée. Le club se retrouve
--    sans personne pour distribuer les casquettes.
--
--    Ce contrôle regarde l'état FINAL de la table, après la commande.
--    Il ne dit pas « non » à la légère : il ne se déclenche que si la
--    table se retrouverait à zéro super administrateur.
-- ---------------------------------------------------------------------
create or replace function bbc_admin_users_invariant()
returns trigger
language plpgsql
security definer
set search_path = public
as
$inv$
declare n int;
begin
  select count(*) into n from admin_users where role = 'super_admin';
  if n = 0 then
    raise exception
      'Cette opération ne laisserait aucun super administrateur : plus personne ne pourrait attribuer de rôle. Refusée.'
      using errcode = '23514';
  end if;
  return null;
end
$inv$;

drop trigger if exists bbc_admin_users_invariant on admin_users;
create trigger bbc_admin_users_invariant
  after insert or update or delete on admin_users
  for each statement execute function bbc_admin_users_invariant();


-- =====================================================================
--  VÉRIFICATIONS
--
--  a) La règle est posée :
--       select tgname from pg_trigger
--        where tgrelid = 'admin_users'::regclass and not tgisinternal;
--       -- doit lister bbc_admin_users_proteger et bbc_admin_users_invariant
--
--       select policyname, cmd from pg_policies
--        where tablename = 'admin_users' order by cmd;
--       -- doit lister lecture / creation / modif / suppr
--
--  b) L'adresse protégée est la bonne :
--       select bbc_proprietaire_email();
--
--  c) LA SEULE PREUVE QUI COMPTE — et elle ne se fait pas ici.
--     Depuis le SQL Editor, auth.uid() est NULL : tout passe, c'est
--     normal, c'est l'échappatoire du point 2. Il faut donc essayer
--     depuis un VRAI compte.
--
--     Nommez temporairement un second compte super administrateur
--     (écran Comptes & rôles), connectez-vous avec CE compte, et
--     essayez de changer le rôle de mdgdesign221@gmail.com.
--     L'écran doit refuser en toutes lettres. Puis remettez ce compte
--     à son rôle normal.
--
--  POUR TRANSMETTRE LE SITE UN JOUR (ou corriger une adresse)
--    Depuis le SQL Editor uniquement, et en pensant à mettre à jour la
--    constante CP_PROPRIETAIRE dans admin-matchs.html :
--      create or replace function bbc_proprietaire_email()
--      returns text language sql immutable set search_path = public as
--      $x$ select 'nouvelle-adresse@exemple.com'::text; $x$;
--
--  POUR DÉSACTIVER MOMENTANÉMENT (dépannage, SQL Editor uniquement)
--    alter table admin_users disable trigger bbc_admin_users_proteger;
--    ...
--    alter table admin_users enable  trigger bbc_admin_users_proteger;
-- =====================================================================
