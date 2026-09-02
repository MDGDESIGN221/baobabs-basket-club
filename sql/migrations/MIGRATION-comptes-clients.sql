-- =====================================================================
--  Baobabs Basket Club — Comptes clients (site public) + rôle admin
--  À exécuter UNE FOIS dans Supabase : SQL Editor → New query → Run.
--  Idempotent, sans risque (n'affecte pas les comptes admin existants).
--
--  Contexte : admin-matchs.html acceptait jusqu'ici n'importe quel
--  compte Supabase Auth valide (email + mot de passe corrects = accès).
--  Maintenant que index.html permet à n'importe quel visiteur de créer
--  un compte (inscription libre), il faut distinguer "un compte existe"
--  de "ce compte a le droit d'entrer dans l'admin". Ce script ajoute
--  cette distinction sans toucher aux 2 comptes admin actuels.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table des comptes autorisés à entrer dans admin-matchs.html
--    Remplie une fois avec les 2 comptes admin déjà en place. Un compte
--    client qui s'inscrit depuis index.html n'y figure jamais.
-- ---------------------------------------------------------------------
create table if not exists admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz default now()
);

alter table admin_users enable row level security;

-- Aucune policy de lecture/écriture directe : cette table ne se lit
-- que via la fonction is_admin() ci-dessous (SECURITY DEFINER).
drop policy if exists "no direct access" on admin_users;

-- Les 2 comptes admin actuels (mêmes emails que la sécurisation initiale).
insert into admin_users (user_id, email)
select id, email from auth.users
where email in ('baobabsbasketclub@gmail.com', 'mdgdesign221@gmail.com')
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------
-- 2. Fonction is_admin() — vérifie si l'utilisateur CONNECTÉ (auth.uid())
--    figure dans admin_users. Utilisée par admin-matchs.html juste après
--    la connexion, en plus du email+mot de passe déjà vérifié par
--    Supabase Auth lui-même.
-- ---------------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;

grant execute on function is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Table des comptes clients (site public)
--    Un compte client = une ligne dans auth.users (email + mot de passe,
--    créée par sb.auth.signUp depuis index.html) + une ligne ici pour
--    le nom et le téléphone, affichés dans "Mon espace".
-- ---------------------------------------------------------------------
create table if not exists customers (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text,
  phone      text,
  created_at timestamptz default now()
);

alter table customers enable row level security;

-- Un client ne peut lire/modifier que sa propre fiche.
drop policy if exists "customers read own" on customers;
create policy "customers read own" on customers
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "customers update own" on customers;
create policy "customers update own" on customers
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- La création de la fiche se fait juste après signUp, avec la session
-- du nouveau compte déjà active : l'utilisateur ne peut créer que SA
-- propre ligne (user_id = auth.uid()), jamais celle d'un autre.
drop policy if exists "customers insert own" on customers;
create policy "customers insert own" on customers
  for insert to authenticated
  with check (user_id = auth.uid());

-- =====================================================================
--  Après exécution :
--   - Les 2 comptes admin actuels retrouvent l'accès à admin-matchs.html
--     à condition que ce fichier vérifie désormais is_admin() (à faire
--     séparément, côté code — voir livraison associée).
--   - N'importe qui peut s'inscrire comme client depuis index.html sans
--     jamais pouvoir accéder à admin-matchs.html.
--   - Si un 3ᵉ compte admin doit être ajouté un jour, il suffit de
--     l'insérer manuellement dans admin_users (pas d'interface encore).
-- =====================================================================
