-- =====================================================================
--  Baobabs Basket Club — Migration : ENTREE GRATUITE
--  Le 10 septembre 2026
--
--  A passer UNE FOIS dans Supabase > SQL Editor > New query > Run.
--  Sans danger si vous la repassez : rien n'est ecrase.
-- =====================================================================
--
--  TOUS LES MATCHS NE SE PAIENT PAS.
--
--  Un amical, un tournoi de quartier, une journee portes ouvertes, un
--  match de l'ecole de basket : l'entree est libre, il n'y a pas de
--  guichet, pas de categorie de place, pas de quota. Jusqu'ici
--  l'administration n'avait aucun moyen de le dire. Un match gratuit
--  restait « A configurer » dans la billetterie, et l'alerte du tableau
--  de bord reclamait une vente qui n'existerait jamais.
--
--  Une case a cocher sur le match, et tout le reste en decoule : l'ecran
--  Billetterie cesse de reclamer, l'alerte se tait, et le site annonce
--  « Entree gratuite » a la place des tarifs.
--
--  Par defaut, false : rien ne change pour les matchs deja saisis.
-- ---------------------------------------------------------------------

alter table matches
  add column if not exists free_entry boolean not null default false;

comment on column matches.free_entry is
  'Entree libre : ce match n''a pas de billetterie. Le site annonce « Entree gratuite » et l''administration cesse de reclamer une grille de tarifs.';


-- ---------------------------------------------------------------------
--  LA VUE MATCH_CENTER DOIT ETRE REFAITE
--
--  Elle est ecrite « select m.* » mais Postgres fige la liste des
--  colonnes au moment de la creation : sans ce drop, free_entry
--  n'arriverait jamais jusqu'a l'administration, et la case a cocher
--  paraitrait ne rien enregistrer.
--
--  On la recree a l'identique de MIGRATION-match-center.sql — seule la
--  colonne ajoutee plus haut s'y invite d'elle-meme.
-- ---------------------------------------------------------------------
drop view if exists match_center;

create view match_center as
select
  m.*,
  coalesce(o.nb_categories,   0)     as nb_categories,
  coalesce(o.places_totales,  0)     as places_totales,
  coalesce(o.places_reservees, 0)    as places_reservees,
  coalesce(o.places_restantes, 0)    as places_restantes,
  coalesce(o.vente_ouverte,   false) as vente_ouverte,
  case
    when m.score_baobabs is not null and m.score_opponent is not null then 'termine'
    when m.match_date < current_date then 'a_saisir'
    when m.match_date = current_date then 'aujourdhui'
    else 'a_venir'
  end as statut,
  case
    when m.score_baobabs is null or m.score_opponent is null then null
    when m.score_baobabs > m.score_opponent then 'V'
    when m.score_baobabs < m.score_opponent then 'D'
    else 'N'
  end as issue
from matches m
left join (
  select
    match_id,
    count(*)                       as nb_categories,
    sum(quota)                     as places_totales,
    sum(sold)                      as places_reservees,
    sum(greatest(quota - sold, 0)) as places_restantes,
    bool_or(is_open)               as vente_ouverte
  from ticket_offers
  group by match_id
) o on o.match_id = m.id;

alter view match_center set (security_invoker = on);


-- ---------------------------------------------------------------------
--  LA SALLE DU CLUB ENTRE DANS LA LISTE DES SALLES
--
--  Le Complexe Patrick Semedo est le camp de base : il est ecrit sur la
--  page Billetterie et sur la page Tryouts depuis toujours, mais il
--  manquait a la liste que l'administration propose quand on saisit un
--  match. On le met en tete : c'est le lieu le plus probable.
--
--  Le « do nothing » protege un libelle que vous auriez deja change.
--  Le bloc entier est saute si vous n'avez pas encore passe
--  MIGRATION-listes.sql : rien ne casse, le code garde ses valeurs.
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public.club_listes') is not null then
    insert into club_listes (liste, cle, libelle, valeur, ordre) values
      ('salles', 'complexe-patrick-semedo', 'Complexe Patrick Semedo', null, 5)
    on conflict (liste, cle) do nothing;
  end if;
end
$$;


-- =====================================================================
--  Verification apres execution :
--    select opponent_name, match_date, free_entry from match_center
--     order by match_date desc limit 10;
--    select libelle from club_listes where liste = 'salles' order by ordre limit 3;
--
--  Puis dans l'administration : Billetterie > choisir un match >
--  « Entree gratuite ». La colonne de gauche doit passer de
--  « A configurer » a « Entree gratuite », et le site annoncer
--  l'entree libre a la place des tarifs.
-- =====================================================================
