-- =====================================================================
--  Baobabs Basket Club — Les casquettes se fabriquent depuis l'admin
--  7 septembre 2026. Idempotent. Aucune donnée supprimée.
--
--  DEMANDE : « si j'ai envie d'ajouter d'autres casquettes, je voudrais
--  un espace dans l'admin où moi seul crée les comptes, attribue les
--  rôles, et choisis les écrans que chacun aura — sans passer par
--  Supabase, et sans dépendre de quelqu'un dans six mois. »
--
--  CE QUE CETTE MIGRATION APPORTE, ET CE QU'ELLE N'APPORTE PAS
--
--    Elle apporte : une table des casquettes (donc on peut en inventer
--    de nouvelles sans toucher au code), et deux fonctions pour donner
--    ou retirer l'accès à l'administration à une adresse.
--
--    Elle n'apporte PAS la création du compte lui-même. Créer un
--    utilisateur dans auth.users demande la clé de service du projet.
--    Cette clé ne doit jamais se trouver dans une page web : qui la lit
--    prend le contrôle du projet entier. Le compte se crée donc dans
--    Supabase (Authentication › Add user, trente secondes), et tout le
--    reste — la casquette, les écrans, le retrait — se fait ensuite
--    depuis l'administration.
--
--    Le mot de passe, lui, n'est jamais lisible : Supabase n'en garde
--    qu'une empreinte. Aucune fonction ici ne prétend le contraire.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. LES CASQUETTES DEVIENNENT DES DONNÉES
--
--    Elles vivaient dans le JavaScript (ROLE_NOMS, ROLE_RESUME) : en
--    inventer une demandait de rouvrir le fichier de l'administration.
--    Une table, et la même casquette porte son nom partout — à l'écran,
--    dans le PDF des rôles, et dans le menu de chaque personne.
--
--    « systeme » marque les casquettes qu'on ne peut pas supprimer :
--    super_admin en est une, sans quoi on pourrait se retirer la clé.
-- ---------------------------------------------------------------------
create table if not exists admin_roles (
  id      text primary key,
  nom     text not null,
  resume  text,
  ordre   int  not null default 100,
  systeme boolean not null default false
);

-- Les cinq casquettes existantes, reprises telles quelles. On ne touche
-- pas à celles qui sont déjà là : un « on conflict do nothing » laisse
-- intacts les libellés que vous auriez déjà modifiés.
insert into admin_roles (id, nom, resume, ordre, systeme) values
  ('super_admin', 'Administration', 'Tout, sans exception, y compris distribuer les rôles. La casquette de la personne qui répond du site.', 10, true),
  ('president', 'Présidence', 'Voit tout le club et approuve. Publie le contenu, touche aux réglages et aux inscriptions — mais ne fait pas la saisie du quotidien.', 20, false),
  ('directeur_sportif', 'Direction sportive', 'Le sportif de bout en bout : matchs, effectif, statistiques, recrutement et école de basket. Ni la boutique, ni la billetterie, ni les comptes.', 30, false),
  ('coach', 'Coach', 'Ses matchs et son effectif, feuille de match comprise. Ne touche ni à l''argent, ni au site public, ni aux comptes.', 40, false),
  ('community_manager', 'Communication', 'Le site public : actualités, médias, bannières, partenaires. Voit les matchs et l''effectif pour pouvoir les raconter.', 50, false)
on conflict (id) do nothing;

alter table admin_roles enable row level security;

-- Tout administrateur LIT les casquettes : sans cela, personne ne
-- pourrait afficher le nom de sa propre casquette.
drop policy if exists admin_roles_lecture on admin_roles;
create policy admin_roles_lecture on admin_roles
  for select using (is_admin());

-- Seul le propriétaire du site en crée, en renomme, en supprime. Pas
-- « un super administrateur » : le propriétaire, celui dont l'adresse
-- est écrite dans bbc_proprietaire_email(). C'est la demande, mot pour
-- mot : « cet espace existe que sur mon compte ».
drop policy if exists admin_roles_ecriture on admin_roles;
create policy admin_roles_ecriture on admin_roles
  for all using (bbc_est_proprietaire()) with check (bbc_est_proprietaire());


-- ---------------------------------------------------------------------
-- 1 bis. LE NOM DE LA PERSONNE
--
--    admin_users ne gardait qu'une adresse et un rôle. Une liste de six
--    adresses ne dit à personne qui est qui, et l'écran d'accueil ne
--    pouvait dire que « Bonjour » — jamais « Bonjour Fatou ».
--
--    Les noms vivaient dans le JavaScript (CP_NOMS) : en ajouter un
--    demandait de rouvrir le fichier. Ils vivent ici désormais, et le
--    propriétaire les saisit en même temps qu'il donne l'accès.
-- ---------------------------------------------------------------------
alter table admin_users add column if not exists nom text;


-- ---------------------------------------------------------------------
-- 2. DONNER L'ACCÈS À UNE ADRESSE
--
--    admin_users veut un user_id, c'est-à-dire l'identifiant interne du
--    compte dans auth.users. Une page web ne peut pas le chercher : la
--    table auth.users n'est pas exposée à l'API, et il ne faut surtout
--    pas l'exposer — elle contient les empreintes des mots de passe.
--
--    Cette fonction fait la recherche CÔTÉ SERVEUR et ne renvoie que
--    l'adresse et la casquette. Le mot de passe ne sort jamais, même
--    haché, même à celui qui appelle.
--
--    Elle refuse clairement quand l'adresse n'a pas encore de compte :
--    « créez d'abord le compte » est une phrase qu'on peut suivre,
--    « null value violates not-null constraint » ne l'est pas.
-- ---------------------------------------------------------------------
create or replace function bbc_compte_rattacher(p_email text, p_role text, p_nom text default null)
returns table (user_id uuid, email text, role text, nom text)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_uid uuid;
  v_mail text := lower(trim(p_email));
begin
  if not bbc_est_proprietaire() then
    raise exception 'Seul le compte propriétaire du site peut donner accès à l''administration.';
  end if;

  if v_mail = '' or v_mail is null then
    raise exception 'Indiquez l''adresse e-mail du compte.';
  end if;

  if not exists (select 1 from admin_roles r where r.id = p_role) then
    raise exception 'Casquette inconnue : %', p_role;
  end if;

  select u.id into v_uid from auth.users u where lower(u.email) = v_mail limit 1;

  if v_uid is null then
    raise exception 'Aucun compte Supabase pour %. Créez-le d''abord dans Authentication, puis revenez ici.', v_mail;
  end if;

  insert into admin_users (user_id, email, role, nom)
  values (v_uid, v_mail, p_role, nullif(trim(coalesce(p_nom,'')), ''))
  on conflict (user_id) do update
     set email = excluded.email,
         role  = excluded.role,
         -- un nom vide ne doit pas EFFACER celui qui est déjà là : on
         -- rattache parfois une adresse une seconde fois juste pour
         -- changer sa casquette.
         nom   = coalesce(excluded.nom, admin_users.nom);

  return query
    select a.user_id, a.email, a.role, a.nom from admin_users a where a.user_id = v_uid;
end;
$$;

revoke all on function bbc_compte_rattacher(text, text, text) from public;
grant execute on function bbc_compte_rattacher(text, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 2 bis. RENOMMER QUELQU'UN, SANS TOUCHER À SA CASQUETTE
-- ---------------------------------------------------------------------
create or replace function bbc_compte_nommer(p_email text, p_nom text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not bbc_est_proprietaire() then
    raise exception 'Seul le compte propriétaire du site peut renommer un compte.';
  end if;
  update admin_users set nom = nullif(trim(coalesce(p_nom,'')), '')
   where lower(email) = lower(trim(p_email));
  return p_nom;
end;
$$;

revoke all on function bbc_compte_nommer(text, text) from public;
grant execute on function bbc_compte_nommer(text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 3. RETIRER L'ACCÈS
--
--    On retire la LIGNE d'administration, pas le compte : la personne
--    peut encore se connecter au site comme n'importe quel visiteur,
--    elle ne voit simplement plus l'administration. Supprimer un compte
--    d'authentification est un geste d'un autre ordre, il reste dans
--    Supabase.
--
--    Le propriétaire ne peut pas se retirer lui-même. Ce n'est pas de
--    la prudence excessive : l'administration n'aurait alors plus aucun
--    propriétaire, et personne ne pourrait en désigner un.
-- ---------------------------------------------------------------------
create or replace function bbc_compte_retirer(p_email text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_mail text := lower(trim(p_email));
begin
  if not bbc_est_proprietaire() then
    raise exception 'Seul le compte propriétaire du site peut retirer un accès.';
  end if;
  if v_mail = lower(bbc_proprietaire_email()) then
    raise exception 'Le compte propriétaire ne peut pas se retirer lui-même.';
  end if;
  delete from admin_users where lower(email) = v_mail;
  return v_mail;
end;
$$;

revoke all on function bbc_compte_retirer(text) from public;
grant execute on function bbc_compte_retirer(text) to authenticated;


-- ---------------------------------------------------------------------
-- 4. SUPPRIMER UNE CASQUETTE
--
--    Refusée dans deux cas, et la raison est dite : une casquette du
--    système, ou une casquette que quelqu'un porte encore. Supprimer
--    sous les pieds de quelqu'un le renverrait à un menu vide sans
--    qu'il comprenne pourquoi.
-- ---------------------------------------------------------------------
create or replace function bbc_casquette_supprimer(p_id text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare n int;
begin
  if not bbc_est_proprietaire() then
    raise exception 'Seul le compte propriétaire du site peut supprimer une casquette.';
  end if;
  if exists (select 1 from admin_roles where id = p_id and systeme) then
    raise exception 'Cette casquette fait partie du système et ne peut pas être supprimée.';
  end if;
  select count(*) into n from admin_users where role = p_id;
  if n > 0 then
    raise exception 'Impossible : % compte(s) portent encore cette casquette. Changez-les d''abord.', n;
  end if;
  delete from role_permissions where role = p_id;
  delete from admin_roles where id = p_id;
  return p_id;
end;
$$;

revoke all on function bbc_casquette_supprimer(text) from public;
grant execute on function bbc_casquette_supprimer(text) to authenticated;


-- ---------------------------------------------------------------------
-- 5. LES ÉCRANS D'UNE CASQUETTE, EN UN SEUL GESTE
--
--    Le tableau de l'écran envoie, pour une casquette et un module, la
--    liste complète des autorisations. On efface puis on réinsère :
--    deux ordres au lieu de sept comparaisons, et surtout un état final
--    qui ne dépend pas de ce qu'il y avait avant.
--
--    role_permissions est déjà ouverte en écriture aux super
--    administrateurs (voir MIGRATION-phase0-socle.sql) ; cette fonction
--    resserre sur le propriétaire, pour que l'écran des casquettes ait
--    la même serrure que le reste.
-- ---------------------------------------------------------------------
create or replace function bbc_permissions_poser(p_role text, p_module text, p_actions text[])
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare a text; n int := 0;
begin
  if not bbc_est_proprietaire() then
    raise exception 'Seul le compte propriétaire du site peut changer les autorisations.';
  end if;
  if p_role = 'super_admin' then
    raise exception 'La casquette Administration ouvre tout par construction : elle ne se règle pas.';
  end if;
  if not exists (select 1 from admin_roles r where r.id = p_role) then
    raise exception 'Casquette inconnue : %', p_role;
  end if;

  delete from role_permissions where role = p_role and module = p_module;
  foreach a in array coalesce(p_actions, array[]::text[]) loop
    insert into role_permissions (role, module, action)
    values (p_role, p_module, a)
    on conflict do nothing;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function bbc_permissions_poser(text, text, text[]) from public;
grant execute on function bbc_permissions_poser(text, text, text[]) to authenticated;


-- =====================================================================
--  VÉRIFICATION — à lancer après, pour voir que tout est en place.
--
--    select id, nom, systeme from admin_roles order by ordre;
--    select role, module, count(*) from role_permissions group by 1,2 order by 1,2;
--
--  ET LE JOUR OÙ VOUS AJOUTEZ QUELQU'UN :
--
--    1. Supabase › Authentication › Users › Add user
--       e-mail + mot de passe, et cochez « Auto Confirm User ».
--    2. L'administration › Comptes & rôles › Ajouter un compte
--       la même adresse, la casquette voulue. C'est tout.
-- =====================================================================
