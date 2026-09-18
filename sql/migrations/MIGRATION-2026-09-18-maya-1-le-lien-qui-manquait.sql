-- =====================================================================
--  MAYA · ETAPE 1 : LE LIEN QUI MANQUAIT
--  18 septembre 2026. Idempotent. Aucune donnee supprimee.
--
--  A EXECUTER DANS L'EDITEUR SQL DE SUPABASE (SQL Editor > New query >
--  Run), et NON par « supabase db push » : des migrations vivent deja en
--  base sans etre dans le depot, et un push les ecraserait.
--
--  ---------------------------------------------------------------------
--  CE QUE CE FICHIER FAIT, ET RIEN D'AUTRE
--
--  Il pose les trois pieces sans lesquelles MAYA ne peut repondre a des
--  questions que personne ne peut poser aujourd'hui :
--
--    1. compte_uid  sur players et sur staff. Un profil metier et un
--                   compte utilisateur ne se connaissaient pas. « Ce
--                   profil valide a-t-il un compte ? », « ce compte
--                   correspond-il a quelqu'un ? » n'avaient pas de
--                   reponse, dans aucune table.
--
--    2. la vue personnes, qui lit les joueuses ET le staff d'un seul
--                   geste, sans fondre les deux tables.
--
--    3. maya_suivi, la memoire de ce qui a ete montre, lu, traite ou
--                   ecarte. Aujourd'hui tout vit dans la page et meurt
--                   au rechargement : deux administrateurs ne voient
--                   donc pas le meme etat, et une suggestion ecartee
--                   revient a la visite suivante.
--
--  AUCUN ECRAN NE CHANGE. Rien de ce fichier n'est encore lu par
--  l'administration : on le pose d'abord, on s'y branche ensuite. Le
--  lancer aujourd'hui et ne rien faire d'autre pendant une semaine ne
--  produit aucune difference visible, et c'est voulu.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. LE LIEN ENTRE UNE PERSONNE ET SON COMPTE
--
--  UN IDENTIFIANT, PAS UNE ADRESSE. admin_users et customers designent
--  deja un compte par auth.users(id) ; une adresse change, un
--  identifiant non. Relier par l'e-mail aurait aussi voulu dire qu'une
--  personne qui change d'adresse perd son historique en silence.
--
--  LE PROFIL POINTE LE COMPTE, ET JAMAIS L'INVERSE. Deux colonnes qui
--  se repondent seraient deux verites a tenir synchrones ; on sait deja
--  ce que cela coute ici (l'adresse du proprietaire vit a deux endroits
--  et doit etre changee aux deux).
--
--  « on delete set null » ET RIEN D'AUTRE. Supprimer un compte ne doit
--  jamais effacer une joueuse, ses feuilles de match ni sa saison. Le
--  lien se vide, la personne reste. C'est la regle « desactiver n'est
--  pas supprimer », ecrite dans la contrainte plutot que dans une note.
--
--  UNICITE PAR TABLE, JAMAIS GLOBALE. Deux joueuses ne partagent pas un
--  compte, d'ou l'index unique. Mais une meme personne peut etre joueuse
--  ET membre du staff (staff.player_id existe pour cela) : son compte
--  se retrouve alors legitimement sur une ligne de chaque table, et une
--  unicite globale l'aurait interdit.
-- ---------------------------------------------------------------------
alter table public.players
  add column if not exists compte_uid uuid references auth.users(id) on delete set null;

alter table public.staff
  add column if not exists compte_uid uuid references auth.users(id) on delete set null;

create unique index if not exists players_compte_uid
  on public.players(compte_uid) where compte_uid is not null;

create unique index if not exists staff_compte_uid
  on public.staff(compte_uid) where compte_uid is not null;

comment on column public.players.compte_uid is
  'Le compte utilisateur de cette joueuse, s''il existe. Vide ne veut '
  'pas dire « pas de compte possible » : cela veut dire « compte a '
  'creer », et c''est exactement ce que MAYA signale.';

comment on column public.staff.compte_uid is
  'Le compte utilisateur de ce membre du staff, s''il existe. Meme '
  'regle que players.compte_uid.';


-- ---------------------------------------------------------------------
--  2. LA VUE personnes
--
--  POURQUOI UNE VUE, ET PAS UNE TABLE. La question a ete tranchee le
--  15 septembre, et la reponse tient toujours : fondre joueuses et staff
--  dans une table « personnes » obligerait a reecrire tout ce qui pointe
--  vers players.id (feuilles de match, convocations, pieces, contacts,
--  presences, statistiques, le Studio, le site public). Ce que MAYA a
--  besoin de faire, c'est de LIRE les personnes d'un seul geste. Une vue
--  le donne sans toucher a une seule cle etrangere.
--
--  LES COLONNES SONT NOMMEES UNE PAR UNE, et c'est delibere.
--  effectif_admin etait ecrite « select p.* » : Postgres a grave la
--  liste des colonnes a la creation, et tout ce qui a ete ajoute a
--  players depuis est reste invisible pendant des mois. Une etoile ici
--  aurait refait exactement la meme panne.
--
--  Cette vue reste donc VOLONTAIREMENT COURTE : elle repond a « qui
--  existe, dans quel etat, avec ou sans compte », et rien de plus. Ce
--  qui est propre a une joueuse se lit dans players ; ce qui est propre
--  au staff se lit dans staff. Une vue qui aurait tout voulu porter se
--  serait perimee au premier champ ajoute.
--
--  security_invoker = on : LE POINT LE PLUS IMPORTANT DE CE FICHIER.
--  Les droits appliques sont ceux de qui lit, donc le RLS de players et
--  de staff continue de jouer. MAYA n'a aucun privilege propre : elle
--  voit ce que voit la personne connectee, ni plus ni moins. Sans cette
--  option, la vue s'executerait avec les droits de son proprietaire et
--  traverserait la securite de toute l'administration.
--
--  AUCUNE JOINTURE VERS auth.users. Une vue en security_invoker qui
--  joint auth.users repond 403 a tout le monde, et le message d'erreur
--  de Postgres souffle alors un GRANT qui exposerait les mots de passe.
--  L'identifiant du compte suffit ici : savoir QU'UN compte existe n'est
--  pas savoir QUI il est. Le reste passe par la porte etroite du point 4.
--
--  LE NUMERO SORT EN TEXTE, ET C'EST VOULU. La table players n'a ete
--  creee par aucune migration du depot : elle est nee dans l'editeur
--  SQL, et le type exact de jersey_number ne se lit donc nulle part ici.
--  Un union all exige que les deux moities s'accordent colonne par
--  colonne ; parier sur « integer » aurait fait echouer tout le fichier
--  sur un « UNION types integer and text cannot be matched ». Le cast en
--  texte tient dans les deux cas, et ne perd rien : un numero de maillot
--  est une etiquette, pas une quantite. Rien ne se calcule dessus.
--
--  ET « sort » N'Y EST PAS DU TOUT, pour la meme raison portee plus
--  loin : son type ne se lit pas davantage dans le depot, et l'ordre
--  d'affichage d'une liste ne sert a rien a MAYA. Une colonne dont on
--  n'est pas sur et dont on n'a pas besoin n'a rien a faire dans une
--  vue qui se veut courte.
-- ---------------------------------------------------------------------
drop view if exists public.personnes;

create view public.personnes with (security_invoker = on) as
  select
    'joueuse'::text            as genre,
    p.id                       as id,
    p.name                     as nom,
    p.photo_url                as photo_url,
    p.fiche_etat               as fiche_etat,
    p.status                   as statut,
    p.position                 as fonction,
    p.jersey_number::text      as numero,
    null::text                 as famille,
    p.compte_uid               as compte_uid,
    p.soumis_le                as soumis_le,
    null::uuid                 as lie_a
  from public.players p
  union all
  select
    'staff'::text,
    s.id,
    s.name,
    s.photo_url,
    s.fiche_etat,
    null::text,
    s.role,
    null::text,
    s.categorie,
    s.compte_uid,
    s.soumis_le,
    s.player_id
  from public.staff s;

comment on view public.personnes is
  'Les joueuses et le staff, lus d''un seul geste. Vue etroite et '
  'security_invoker : elle ne montre que ce que la personne connectee a '
  'le droit de voir. « statut » n''existe que pour une joueuse '
  '(disponibilite sportive) ; « famille » et « lie_a » n''existent que '
  'pour le staff.';

--  LE DROIT DE LIRE N'EST PAS LE DROIT D'Y VOIR QUELQUE CHOSE. Une vue
--  neuve n'appartient a personne d'autre que son createur : sans ce
--  grant, PostgREST repond 403 a tout le monde, y compris au
--  proprietaire. Il ouvre la PORTE ; ce qui passe dedans reste decide
--  par le RLS de players et de staff, grace a security_invoker. Et
--  volontairement pas « anon » : le site public a deja ses propres vues
--  (effectif_site, staff_site), qui ne montrent que les fiches publiees.
grant select on public.personnes to authenticated;


-- ---------------------------------------------------------------------
--  3. maya_suivi : CE QUI A DEJA ETE DIT
--
--  ELLE NE GARDE PAS LE CONTENU D'UNE SUGGESTION, SEULEMENT SON SORT.
--  Le texte se recalcule a chaque fois a partir de la donnee vivante ;
--  le stocker donnerait une memoire qui se perime, et MAYA repeterait un
--  jour quelque chose qui n'est plus vrai. Ici on ne retient que : ce
--  fait, sur cette cible, cette personne l'a vu, traite, ou ecarte.
--
--  « cible » N'EST JAMAIS NULL. Un fait qui ne porte sur rien de precis
--  (« aucune saison n'est ouverte ») a pour cible la chaine vide. En
--  laissant NULL, la cle primaire n'aurait pas joue : dans Postgres, un
--  NULL n'est egal a aucun autre NULL, et la meme ligne serait revenue
--  autant de fois qu'on l'aurait ecrite.
--
--  « jusqu_au » EST LA POUR « plus tard », PAS POUR « jamais ». Ecarter
--  une suggestion la met en sommeil ; elle revient apres la date, et
--  elle revient aussi si la donnee change assez pour que le fait cesse
--  d'etre vrai puis le redevienne. Une suggestion qu'on peut eteindre
--  definitivement finit par cacher un vrai probleme.
--
--  ELLE EST STRICTEMENT PERSONNELLE. Pas bbc_policies_module ici : ce
--  n'est pas une donnee du club, c'est le carnet de chacun. Personne ne
--  lit celui d'un autre, pas meme le proprietaire.
-- ---------------------------------------------------------------------
create table if not exists public.maya_suivi (
  fait     text not null,
  cible    text not null default '',
  qui      uuid not null references auth.users(id) on delete cascade,
  etat     text not null default 'vu' check (etat in ('vu','traite','ecarte')),
  jusqu_au timestamptz,
  maj      timestamptz not null default now(),
  primary key (fait, cible, qui)
);

create index if not exists maya_suivi_qui on public.maya_suivi(qui, maj desc);

comment on table public.maya_suivi is
  'Le carnet personnel de MAYA : ce que cette personne a vu, traite ou '
  'ecarte. Jamais le contenu d''une suggestion, seulement son sort.';

alter table public.maya_suivi enable row level security;

drop policy if exists maya_suivi_le_sien on public.maya_suivi;
create policy maya_suivi_le_sien on public.maya_suivi
  for all to authenticated
  using (qui = auth.uid())
  with check (qui = auth.uid());

--  Supabase accorde d'office ces droits aux tables creees dans public ;
--  on les ecrit quand meme. Un grant en trop ne coute rien, un grant
--  manquant casse l'ecran entier -- et cette table sera lue a chaque
--  ouverture de l'administration.
grant select, insert, update, delete on public.maya_suivi to authenticated;


-- ---------------------------------------------------------------------
--  4. LA PORTE ETROITE VERS LE COMPTE
--
--  auth.users NE S'OUVRE PAS. Elle contient les empreintes de mots de
--  passe et les jetons de recuperation. Le 20 aout, un ecran a repondu
--  403 parce qu'une vue la joignait, et Postgres a lui-meme conseille le
--  GRANT qui aurait rendu tout cela lisible par n'importe quel compte
--  client connecte depuis le site. On ne suit pas ce conseil.
--
--  Cette fonction ne sait faire qu'une chose : rendre l'adresse, la date
--  de creation et la derniere connexion d'UN compte, a quelqu'un qui a
--  deja le droit de voir les comptes. Une porte etroite plutot qu'un mur
--  abattu.
--
--  LE GARDE EST DANS LA FONCTION. « security definer » sans controle
--  d'acces est un trou : la fonction s'executerait avec les droits de
--  son proprietaire pour n'importe qui. Le raise explicite plutot qu'un
--  resultat vide : zero ligne ne dit pas si le compte n'existe pas ou si
--  l'on n'avait pas le droit de demander, et on a deja perdu du temps
--  sur cette ambiguite ailleurs.
--
--  LE REVOKE N'EST PAS UNE PRECAUTION DE STYLE. Postgres accorde
--  EXECUTE a PUBLIC sur toute fonction nouvellement creee. Sans la ligne
--  ci-dessous, celle-ci serait appelable par un visiteur anonyme, et le
--  garde interne serait la seule chose entre lui et l'adresse.
-- ---------------------------------------------------------------------
create or replace function public.bbc_compte_apercu(p_uid uuid)
returns table (email text, cree_le timestamptz, derniere_connexion timestamptz)
language plpgsql security definer stable set search_path = public as
$fn$
begin
  if not (bbc_est_proprietaire() or bbc_can('reglages','voir')) then
    raise exception 'Reserve aux comptes qui ont acces aux reglages.'
      using errcode = '42501';
  end if;
  return query
    select u.email::text, u.created_at, u.last_sign_in_at
      from auth.users u
     where u.id = p_uid;
end
$fn$;

revoke all on function public.bbc_compte_apercu(uuid) from public;
revoke all on function public.bbc_compte_apercu(uuid) from anon;
grant execute on function public.bbc_compte_apercu(uuid) to authenticated;

comment on function public.bbc_compte_apercu(uuid) is
  'L''adresse, la creation et la derniere connexion d''UN compte. '
  'Reservee a qui voit les reglages. auth.users ne s''ouvre pas.';


-- =====================================================================
--  VERIFICATION
--  Le resultat de ce bloc doit montrer quatre lignes « pose ». Il ne
--  modifie rien et peut se rejouer.
-- =====================================================================
select 'colonnes de lien' as piece,
       (select count(*) from information_schema.columns
         where table_schema = 'public'
           and table_name in ('players','staff')
           and column_name = 'compte_uid')::text || ' / 2' as etat,
       case when (select count(*) from information_schema.columns
                   where table_schema = 'public'
                     and table_name in ('players','staff')
                     and column_name = 'compte_uid') = 2
            then 'pose' else 'MANQUE' end as verdict
union all
select 'vue personnes',
       coalesce((select array_to_string(c.reloptions, ',')
                   from pg_class c
                   join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'public' and c.relname = 'personnes'), 'absente')
       || case when to_regclass('public.personnes') is null then ' + absente'
               when has_table_privilege('authenticated', 'public.personnes', 'select')
               then ' + lisible' else ' + NON LISIBLE' end,
       case when to_regclass('public.personnes') is null then 'MANQUE'
            when not has_table_privilege('authenticated', 'public.personnes', 'select') then 'MANQUE'
            when not exists (select 1 from pg_class c
                               join pg_namespace n on n.oid = c.relnamespace
                              where n.nspname = 'public' and c.relname = 'personnes'
                                and array_to_string(c.reloptions, ',') like '%security_invoker=on%')
                 then 'MANQUE'
            else 'pose' end
union all
select 'table maya_suivi',
       case when exists (select 1 from pg_policies
                          where schemaname = 'public' and tablename = 'maya_suivi')
            then 'RLS active' else 'sans policy' end,
       case when to_regclass('public.maya_suivi') is not null
             and exists (select 1 from pg_policies
                          where schemaname = 'public' and tablename = 'maya_suivi')
            then 'pose' else 'MANQUE' end
union all
select 'fonction bbc_compte_apercu',
       case when to_regprocedure('public.bbc_compte_apercu(uuid)') is null then 'absente'
            when has_function_privilege('anon', 'public.bbc_compte_apercu(uuid)', 'execute')
            then 'OUVERTE A ANON' else 'fermee a anon' end,
       case when to_regprocedure('public.bbc_compte_apercu(uuid)') is null then 'MANQUE'
            when has_function_privilege('anon', 'public.bbc_compte_apercu(uuid)', 'execute')
                 then 'MANQUE'
            else 'pose' end;
