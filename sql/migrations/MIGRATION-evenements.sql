-- =====================================================================
--  Baobabs Basket Club — Migration : LES ÉVÉNEMENTS
--  Le 10 septembre 2026
--
--  A passer UNE FOIS dans Supabase > SQL Editor > New query > Run.
--  Sans danger si vous la repassez : rien n'est ecrase.
-- =====================================================================
--
--  POURQUOI UNE TABLE, ET PAS UN SECOND JEU DE REGLAGES
--
--  Le bloc « A la une » de l'accueil est ne pour UN evenement : le
--  tournoi de Nouakchott, avec ses 27 reglages dans site_settings. Le
--  president en a annonce un second le meme jour — le tournoi Dekkil
--  Rapatak, a Bopp, du 18 au 20 septembre. Il y en aura un troisieme.
--
--  Vingt-sept reglages par evenement, c'est vingt-sept champs de plus
--  dans l'administration a chaque tournoi, et du code a relivrer chaque
--  fois. Une table les porte tous sans qu'on rouvre un fichier.
--
--  CE QUE LE SITE EN FAIT. Le plus proche remplit le bloc en grand ;
--  les suivants s'ecrivent en une ligne juste dessous. Ce n'est pas un
--  choix d'esthetique : le bloc mesure 1567 px sur un telephone, soit
--  deux ecrans de defilement. Deux blocs empiles en feraient quatre
--  avant d'atteindre le reste de l'accueil.
--
--  LE REPLI RESTE. Si cette table est absente, vide, ou si la lecture
--  echoue, le site retombe sur les reglages ev_* : rien ne casse.
-- ---------------------------------------------------------------------

create table if not exists evenements (
  id                 uuid primary key default gen_random_uuid(),

  -- Ce qui se lit dans le bloc
  titre              text not null,
  kicker             text,
  texte              text,

  -- L'affiche : la vignette du bloc, et la version pleine ouverte au clic
  affiche_url        text,
  affiche_pleine_url text,
  affiche_alt        text,
  affiche_label      text,

  -- Les faits
  dates              text,   -- « 18 → 20 septembre 2026 », tel qu'affiche
  lieu               text,
  organisateur       text,
  theme              text,
  -- Les nations engagees, separees par des virgules. Une ETOILE devant
  -- la notre : « Mali, *Senegal ». Un second champ se serait
  -- desynchronise du premier.
  nations            text,

  debut              timestamptz,  -- le compte a rebours
  fin                date,         -- dernier jour d'affichage

  -- Le programme : une entree par jour ou par temps fort.
  --   [{"jour":"23 septembre","texte":"Ouverture.","entree":"Gratuite"}]
  -- En JSON plutot qu'en trois colonnes figees : un tournoi a cinq
  -- temps forts ne demandera pas de nouvelle migration.
  programme          jsonb not null default '[]'::jsonb,

  cta_label          text,
  cta_nav            text,   -- la page du site ou mene le bouton
  tel                text,

  actif              boolean not null default false,
  ordre              integer not null default 0,
  created_at         timestamptz not null default now()
);

comment on table evenements is
  'Les evenements mis en avant sur l''accueil. Le plus proche remplit le bloc « A la une » ; les suivants s''ecrivent en une ligne dessous. « fin » est le dernier jour d''affichage : le site les retire tout seul au lendemain.';

create index if not exists evenements_actif_idx on evenements (actif, debut);


-- ---------------------------------------------------------------------
--  LECTURE PUBLIQUE, ECRITURE ADMINISTRATEUR
--
--  Le site public lit ces lignes : elles sont faites pour etre vues. Il
--  n'y a rien de sensible dans une affiche de tournoi.
-- ---------------------------------------------------------------------
alter table evenements enable row level security;

drop policy if exists evenements_lecture on evenements;
create policy evenements_lecture on evenements
  for select using (true);

drop policy if exists evenements_ecriture on evenements;
create policy evenements_ecriture on evenements
  for all using (is_admin()) with check (is_admin());


-- ---------------------------------------------------------------------
--  LES DEUX TOURNOIS DE SEPTEMBRE
--
--  « where not exists » sur le titre : repasser ce fichier ne cree pas
--  de doublon et n'ecrase pas ce que vous auriez corrige dans
--  l'administration.
-- ---------------------------------------------------------------------

-- 1. DEKKIL RAPATAK — le plus proche, il prend donc le bloc en grand.
insert into evenements (
  titre, kicker, texte,
  affiche_url, affiche_pleine_url, affiche_alt, affiche_label,
  dates, lieu, organisateur, theme, nations,
  debut, fin, programme, cta_label, cta_nav, tel, actif, ordre)
select
  'DEKKIL RAPATAK',
  'À la une · Tournoi de Bopp',
  'Le week-end du 18 au 20 septembre, les Baobabs jouent la première édition du Dekkil Rapatak, au terrain de Bopp. Seize équipes, huit filles et huit garçons, deux trophées — et de quoi occuper les jeunes compétiteurs pendant les vacances.',
  '/media/img/tournoi-dekkil-rapatak-2026-t.webp',
  '/media/img/tournoi-dekkil-rapatak-2026.webp',
  'Affiche de la première édition du tournoi Dekkil Rapatak, terrain de Bopp, Dakar, du 18 au 20 septembre 2026',
  'Voir l''affiche',
  '18 → 20 septembre 2026',
  'Terrain de Bopp, Dakar',
  'Dekkil Rapatak',
  'Occuper les jeunes compétiteurs pendant les vacances',
  -- Pas de nations ici : c'est un tournoi de clubs dakarois. Un champ
  -- vide retire la rangee, il ne laisse pas un blanc.
  null,
  '2026-09-18T09:00'::timestamptz,
  '2026-09-20'::date,
  '[{"jour":"16 équipes","texte":"Huit équipes filles, huit équipes garçons.","entree":"2 trophées"},
    {"jour":"Sur le terrain","texte":"Dunk contest et concours à 3 points, avec des joueurs du basket local et international.","entree":"Prix à gagner"},
    {"jour":"Autour du terrain","texte":"Show rap et hip-hop, animé par PI & JI.","entree":"Plus de 500 spectateurs attendus"}]'::jsonb,
  'Lire l''actualité',
  'actualites',
  null,
  true,
  10
where not exists (select 1 from evenements where titre = 'DEKKIL RAPATAK');


-- 2. NOUAKCHOTT — il passe en ligne sous le bloc, puis prend sa place
--    le 21, quand le tournoi de Bopp est termine. Sans un geste.
insert into evenements (
  titre, kicker, texte,
  affiche_url, affiche_pleine_url, affiche_alt, affiche_label,
  dates, lieu, organisateur, theme, nations,
  debut, fin, programme, cta_label, cta_nav, tel, actif, ordre)
select
  'CAP SUR NOUAKCHOTT',
  'À la une · Tournoi international',
  'Du 23 au 29 septembre, les Baobabs portent les couleurs du Sénégal au Tournoi Women''s Sport International de basketball féminin. Six nations, une semaine, un terrain : celui de Nouakchott.',
  '/media/img/tournoi-nouakchott-2026-t.webp',
  '/media/img/tournoi-nouakchott-2026.webp',
  'Affiche du Tournoi Women''s Sport International de basketball féminin, Nouakchott, du 23 au 29 septembre 2026',
  'Voir l''affiche',
  '23 → 29 septembre 2026',
  'Terrain de basket de Nouakchott',
  'Women Sport RIM',
  'Sport au féminin, vecteur d''espoir et de leadership',
  'Mauritanie, Gambie, Tunisie, Maroc, Mali, *Sénégal',
  '2026-09-23T09:00'::timestamptz,
  '2026-09-29'::date,
  '[{"jour":"23 septembre","texte":"Ouverture : concert et don du sang.","entree":"Entrée : kits scolaires"},
    {"jour":"24 → 27 septembre","texte":"Les matchs, puis la finale.","entree":"Entrée gratuite"},
    {"jour":"28 septembre","texte":"Soirée de clôture à l''hôtel Sheraton.","entree":"2 000 MRU"}]'::jsonb,
  'Lire l''actualité',
  'actualites',
  '+222 36 84 96 31',
  true,
  20
where not exists (select 1 from evenements where titre = 'CAP SUR NOUAKCHOTT');


-- ---------------------------------------------------------------------
--  LES REGLAGES ev_* NE SERVENT PLUS QUE DE REPLI
--
--  On les laisse en place : ils repondent si cette table disparait. Mais
--  « ev_show » passe a « non » pour qu'ils ne se battent pas avec elle
--  le jour ou vous videz la table sans y penser.
--
--  Rien n'est supprime : voir SEED-tournoi-nouakchott-2026.sql.
-- ---------------------------------------------------------------------
update site_settings set value = 'non' where key = 'ev_show';


-- =====================================================================
--  Verification apres execution :
--    select titre, dates, actif, fin, jsonb_array_length(programme) as etapes
--      from evenements order by debut;
--
--  Puis sur le site : l'accueil doit porter DEKKIL RAPATAK en grand, et
--  « 23 sept. · CAP SUR NOUAKCHOTT » en une ligne juste dessous.
--
--  POUR RETIRER UN EVENEMENT : administration > Pages du site >
--  Accueil > A la une. Ou, en SQL :
--    update evenements set actif = false where titre = '...';
-- =====================================================================
