-- =====================================================================
--  Baobabs Basket Club — Historique des modifications de l'admin
--  À exécuter UNE FOIS dans Supabase : SQL Editor → New query → Run.
--  Idempotent, sans risque (n'affecte aucune table existante).
--
--  Ce script crée :
--   1. La table admin_audit_log (qui / quand / où / quel champ / avant / après)
--   2. L'extension pgcrypto (hash du mot de passe, jamais stocké en clair)
--   3. Une fonction verify_audit_password(pwd) qui compare le hash et,
--      si correct, renvoie l'historique — c'est la SEULE façon de lire
--      la table depuis le site (RLS bloque toute lecture directe)
--   4. Une fonction log_audit_entry(...) appelée à chaque sauvegarde
--      dans l'admin, pour écrire une ligne d'historique
--
--  CORRECTIF (24 juillet 2026) : sur Supabase, pgcrypto est installée
--  par défaut dans le schéma "extensions", pas "public". Les fonctions
--  ci-dessous déclarent donc `set search_path = public, extensions`
--  (et non `public` seul comme dans une version antérieure de ce
--  fichier) pour que crypt() reste visible. Sans "extensions" dans le
--  search_path, verify_audit_password() se crée sans erreur mais
--  échoue silencieusement à chaque appel avec :
--    ERROR: function crypt(text, text) does not exist
--  ce qui, côté site, ressemble à un mot de passe refusé alors que le
--  vrai souci est ce search_path trop restrictif. Si vous repartez
--  d'une ancienne copie de ce script, vérifiez bien que les deux
--  "set search_path" plus bas incluent "extensions".
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Extension pgcrypto (bcrypt) — déjà présente sur Supabase en général,
--    cette ligne ne fait rien si c'est déjà le cas. Sur Supabase, elle
--    s'installe dans le schéma "extensions" (voir CORRECTIF ci-dessus).
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 2. Table de l'historique
-- ---------------------------------------------------------------------
create table if not exists admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),   -- horodatage serveur, fiable
  user_email  text,                        -- qui : email du compte connecté
  section     text,                        -- où : "Actualités", "Match #12"...
  table_name  text,                        -- nom technique de la table touchée
  record_id   text,                        -- id de la ligne modifiée (si connu)
  field_key   text,                        -- quel champ précisément
  old_value   text,                        -- valeur avant
  new_value   text                         -- valeur après
);

create index if not exists admin_audit_log_created_at_idx on admin_audit_log (created_at desc);

alter table admin_audit_log enable row level security;

-- Aucune policy de lecture/écriture directe : personne ne peut lire ou
-- écrire cette table via l'API REST normale, seulement via les 2
-- fonctions ci-dessous (SECURITY DEFINER = elles s'exécutent avec les
-- droits du propriétaire de la fonction, pas de l'appelant).
drop policy if exists "no direct access" on admin_audit_log;

-- ---------------------------------------------------------------------
-- 3. Mot de passe de consultation — changez cette valeur avant d'exécuter
--    le script, puis cette ligne peut être supprimée du fichier si vous
--    voulez : le mot de passe reste de toute façon caché dans la table
--    ci-dessous, jamais en clair ni dans le SQL réexécutable ni dans
--    admin-matchs.html.
-- ---------------------------------------------------------------------
create table if not exists admin_audit_secret (
  id         int primary key default 1,
  pwd_hash   text not null,
  constraint single_row check (id = 1)
);

alter table admin_audit_secret enable row level security;
drop policy if exists "no direct access" on admin_audit_secret;

insert into admin_audit_secret (id, pwd_hash)
values (1, crypt('thefirstandtheonlyone', gen_salt('bf')))
on conflict (id) do update set pwd_hash = excluded.pwd_hash;

-- Pour changer le mot de passe plus tard, relancez juste :
--   update admin_audit_secret set pwd_hash = crypt('nouveau_mot_de_passe', gen_salt('bf')) where id = 1;

-- ---------------------------------------------------------------------
-- 4. Fonction de vérification + lecture de l'historique
--    Renvoie les lignes seulement si le mot de passe est correct,
--    sinon un tableau vide (aucune indication de "bon" ou "mauvais"
--    mot de passe n'est donnée à part le résultat vide/plein).
-- ---------------------------------------------------------------------
create or replace function verify_audit_password(pwd text)
returns setof admin_audit_log
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if exists (
    select 1 from admin_audit_secret
    where id = 1 and pwd_hash = crypt(pwd, pwd_hash)
  ) then
    return query select * from admin_audit_log order by created_at desc;
  end if;
  return;
end;
$$;

-- Autoriser l'appel RPC depuis le site (authentifié ou anonyme,
-- puisque c'est le mot de passe qui protège, pas la session) :
grant execute on function verify_audit_password(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Fonction d'écriture d'une entrée d'historique
--    Appelée par admin-matchs.html à chaque sauvegarde. Ne renvoie rien
--    d'utile, ne doit jamais faire échouer la sauvegarde réelle si
--    quelque chose se passe mal ici (voir le "exception" ci-dessous).
-- ---------------------------------------------------------------------
create or replace function log_audit_entry(
  p_user_email text,
  p_section    text,
  p_table_name text,
  p_record_id  text,
  p_field_key  text,
  p_old_value  text,
  p_new_value  text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into admin_audit_log (user_email, section, table_name, record_id, field_key, old_value, new_value)
  values (p_user_email, p_section, p_table_name, p_record_id, p_field_key, p_old_value, p_new_value);
exception when others then
  -- On avale toute erreur ici : la journalisation ne doit jamais empêcher
  -- une sauvegarde réelle de l'admin de fonctionner.
  null;
end;
$$;

grant execute on function log_audit_entry(text, text, text, text, text, text, text) to anon, authenticated;

-- =====================================================================
--  Après exécution : rien ne change visuellement dans l'admin tant que
--  admin-matchs.html n'est pas remplacé par la version instrumentée.
--  Une fois les deux en place, chaque sauvegarde écrit dans
--  admin_audit_log, et le nouveau bloc "Historique" en bas de l'admin
--  peut afficher la liste après saisie du mot de passe.
--
--  Statut confirmé le 24 juillet 2026 : script exécuté, search_path
--  corrigé, journalisation en écriture et en lecture toutes deux
--  vérifiées fonctionnelles en conditions réelles (sauvegarde faite
--  depuis l'admin, puis lue depuis la section Historique avec le mot
--  de passe ci-dessus).
-- =====================================================================
