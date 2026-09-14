-- =====================================================================
--  LA CAISSE : recettes, depenses, budget
--  --------------------------------------------------------------------
--  Les recettes existaient deja, eparpillees : les mensualites de l'ecole
--  (academy_payments), les commandes encaissees (orders.paid), les billets
--  retires (reservations.checked_in_at). Elles restent ou elles sont : la
--  caisse les LIT, elle ne les recopie pas. Ce qui manquait :
--    caisse_mouvements  les recettes hors ecran (sponsor, subvention, don,
--                       buvette, avance du president) et TOUTES les depenses
--    caisse_budget      le previsionnel de la saison, par poste
--  Un module de droits a part, « caisse » : le president voit et ecrit,
--  le directeur sportif voit. Les autres casquettes n'y entrent pas.
-- =====================================================================

create table if not exists public.caisse_mouvements (
  id           uuid primary key default gen_random_uuid(),
  date         date not null default current_date,
  sens         text not null check (sens in ('recette','depense')),
  categorie    text not null,
  montant_fcfa integer not null check (montant_fcfa > 0),
  libelle      text,
  tiers        text,          -- qui a paye, ou a qui on a paye
  moyen        text,          -- especes, wave, orange_money, free_money, virement, cheque, autre
  piece_url    text,          -- justificatif (photo du recu, facture)
  note         text,
  auteur       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists caisse_mouvements_date on public.caisse_mouvements (date);
select bbc_policies_module('caisse_mouvements','caisse');

create table if not exists public.caisse_budget (
  id           uuid primary key default gen_random_uuid(),
  saison       text not null,             -- « 2026-2027 »
  sens         text not null check (sens in ('recette','depense')),
  categorie    text not null,
  montant_fcfa integer not null default 0,
  note         text,
  updated_at   timestamptz not null default now(),
  unique (saison, sens, categorie)
);
select bbc_policies_module('caisse_budget','caisse');

-- Les droits : le president tient la caisse, le directeur sportif la voit.
insert into public.role_permissions (role, module, action)
select r.role, 'caisse', a.action
  from (values ('president')) r(role), (values ('voir'),('creer'),('modifier'),('supprimer'),('exporter')) a(action)
 where not exists (select 1 from public.role_permissions p where p.role = r.role and p.module = 'caisse' and p.action = a.action);
insert into public.role_permissions (role, module, action)
select 'directeur_sportif', 'caisse', 'voir'
 where not exists (select 1 from public.role_permissions p where p.role = 'directeur_sportif' and p.module = 'caisse' and p.action = 'voir');
