-- =====================================================================
--  LES ADVERSAIRES : une fiche par club, et des droits fermes
--  --------------------------------------------------------------------
--  La table `teams` ne portait qu'un nom et un logo. La fiche d'un
--  adversaire (ville, ligue, categorie, couleurs, contact, notes) vit
--  ici ; le bilan face-a-face se CALCULE depuis `matches`, il ne se
--  saisit pas.
--
--  VU EN PASSANT : `teams` avait des policies « Public insert / update /
--  delete » a `true` : n'importe qui avec la cle anon du site pouvait
--  effacer tous les adversaires (le meme trou que `matches`, referme le
--  14 septembre). Les droits passent au module « matchs ». Le site ne
--  lit pas cette table (les matchs portent leur propre copie du logo) :
--  aucune lecture publique n'est necessaire, et le contact d'un club ne
--  doit pas sortir.
-- =====================================================================

alter table public.teams
  add column if not exists city          text,
  add column if not exists league        text,
  add column if not exists category      text,
  add column if not exists colors        text,        -- « #C0271B, #FFFFFF »
  add column if not exists contact_name  text,
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists website       text,
  add column if not exists notes         text,
  add column if not exists favorite      boolean not null default false,
  add column if not exists updated_at    timestamptz not null default now();

select bbc_policies_module('teams', 'matchs');
