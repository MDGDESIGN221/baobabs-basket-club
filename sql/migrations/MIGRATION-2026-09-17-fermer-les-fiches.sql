-- =====================================================================
--  FERMER LES FICHES DES MEMBRES
--  17 septembre 2026
-- ---------------------------------------------------------------------
--  CE QUI A ETE MESURE, ET COMMENT
--
--  Depuis une page vide, sans session, avec la seule cle publique qui
--  est ecrite en clair dans index.html (elle est publique par nature :
--  c'est elle qui sert a afficher les matchs et la boutique) :
--
--      GET /rest/v1/staff?select=*&limit=1        -> 200, la ligne entiere
--      GET /rest/v1/collecte_suivi?select=*       -> 200, avec reprise_jeton
--
--  `players` et `staff` n'ont pas de securite au niveau des lignes. Un
--  visiteur anonyme lit donc TOUTES leurs colonnes, dont :
--
--      players : birth_date, nationality, licence_num, injury_note,
--                consent_image, soumission (le formulaire depose tel
--                quel), photo_source_url, reprise_jeton
--      staff   : phone, soumission, photo_source_url, reprise_jeton
--
--  `reprise_jeton` est la clef personnelle qui ouvre le formulaire de
--  collecte d'un membre. bbc_collecte_reprendre(jeton) et
--  bbc_collecte_majour(jeton, ...) sont accordees a `anon` -- c'est
--  voulu, la joueuse n'a pas de compte. Mais elles ne tiennent que
--  parce que le jeton est cense etre secret. Il ne l'est pas : il se lit
--  a cote du nom. Qui lit la liste peut donc lire ET reecrire la fiche
--  de n'importe quelle joueuse et de n'importe quel membre du staff.
--
--  Ce que ce fichier ne pretend pas : il ne dit rien des autres tables.
--  Une lecture qui rend « [] » ne prouve rien du tout (table vide, ou
--  policy qui filtre : de l'exterieur, c'est identique). La liste des
--  tables reellement protegees se lit dans pg_policies, pas ici --
--  voir la requete de verification a la fin.
-- ---------------------------------------------------------------------
--  LE PRINCIPE
--
--  Une fiche de membre est un dossier, pas une page publique. Le site
--  n'a jamais eu besoin de la fiche entiere : il affiche un nom, un
--  numero, un poste, une photo, deux lignes de biographie. Tout le
--  reste -- la date de naissance, le numero de licence, la note de
--  blessure, le telephone, le formulaire depose -- n'appartient qu'au
--  club.
--
--  On separe donc les deux :
--      la TABLE devient reservee a l'administration ;
--      deux VUES portent ce que le site montre, et rien d'autre.
--
--  Les vues sont en `security definer` (le defaut) : elles traversent
--  la securite des tables, exactement pour ca. Elles ne peuvent rendre
--  que les colonnes qui y sont ecrites, une par une -- pas d'etoile,
--  pour qu'une colonne ajoutee demain a `players` ne devienne pas
--  publique par accident.
--
--  A COLLER DANS L'EDITEUR SQL DE SUPABASE (`supabase db push` ne voit
--  pas les migrations deja passees a la main : ce depot en compte).
--
--  PASSEE EN PRODUCTION le 17 septembre 2026, en trois temps, chacun
--  verifie de l'exterieur avant le suivant :
--    1) les deux vues + player_season_stats  -> le site lit toujours ;
--    2) pg_policies                          -> huit portes ouvertes
--                                               decouvertes (voir 2) ;
--    3) les politiques et RLS                -> le trou se referme.
--  Apres : staff.reprise_jeton, players.birth_date, licence_num et
--  collecte_suivi rendent 0 ligne a un visiteur anonyme, et le site
--  affiche toujours ses 16 joueuses et son encadrement.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1) CE QUE LE SITE A LE DROIT DE MONTRER
-- ---------------------------------------------------------------------
--  Les colonnes sont celles qu'index.html lit deja pour dessiner la
--  page Equipes et la page Club. Rien de plus.
-- ---------------------------------------------------------------------
create or replace view public.effectif_site as
  select p.id, p.name, p.jersey_number, p.position, p.positions,
         p.height, p.weight, p.birth_year, p.gender, p.status,
         p.photo_url, p.photo_x, p.photo_y, p.photo_zoom,
         p.name_color, p.bio, p.city, p.stats, p.sort
    from public.players p
   where coalesce(p.fiche_etat, 'publiee') = 'publiee'
     and coalesce(p.status, 'active') <> 'partie';

comment on view public.effectif_site is
  'L''effectif tel que le site le montre : ni date de naissance, ni licence, '
  'ni note de blessure, ni jeton de reprise. Colonnes nommees une a une, pour '
  'qu''une colonne ajoutee a players ne devienne pas publique toute seule.';

create or replace view public.staff_site as
  select s.id, s.name, s.role, s.categorie, s.org_role_key,
         s.photo_url, s.photo_url_x, s.photo_url_y, s.photo_url_zoom,
         s.bio, s.qualification, s.sort
    from public.staff s
   where coalesce(s.fiche_etat, 'publiee') = 'publiee';

comment on view public.staff_site is
  'L''encadrement tel que le site le montre. Le telephone et le jeton de '
  'reprise n''en font pas partie.';

grant select on public.effectif_site to anon, authenticated;
grant select on public.staff_site    to anon, authenticated;


-- ---------------------------------------------------------------------
--  2) LES TABLES SE REFERMENT
-- ---------------------------------------------------------------------
--  Apres ces lignes, seul un compte inscrit dans `admin_users` lit ou
--  ecrit `players` et `staff`. Un compte client cree depuis le site --
--  un supporter -- est `authenticated` comme l'administration : c'est
--  is_admin() qui fait la difference, et rien d'autre.
--
--  Les fonctions de collecte (bbc_collecte_reprendre, _deposer,
--  _majour) sont en `security definer` : elles continuent de marcher
--  pour la joueuse qui remplit son formulaire, sans compte. Elles ne
--  rendent une fiche que contre son jeton -- qui, lui, redevient
--  illisible de l'exterieur.
-- ---------------------------------------------------------------------
--  HUIT POLITIQUES DORMAIENT DEJA SUR CES DEUX TABLES.
--  Elles ne figurent nulle part dans ce depot : elles ont ete posees a
--  la main, et `pg_policies` est le seul endroit qui les connaisse. Sans
--  RLS, elles ne servaient a rien. Les allumer telles quelles aurait ete
--  PIRE que de ne rien faire :
--
--    public read players  {public}        SELECT   qual = true
--    auth insert players  {authenticated} INSERT   check = true
--    auth update players  {authenticated} UPDATE   qual  = true
--    auth delete players  {authenticated} DELETE   qual  = true
--    ... et les quatre memes sur staff.
--
--  « authenticated », c'est AUSSI le supporter qui vient de creer son
--  compte sur le site. La table aurait donc eu l'air protegee, et tout
--  compte client aurait pu supprimer l'effectif entier.
--
--  Les politiques s'ADDITIONNENT : il ne suffit pas d'en ajouter une
--  bonne, il faut retirer les mauvaises. D'ou l'ordre ci-dessous, qui
--  n'ouvre la table a personne, pas meme une seconde :
--    1. poser les bonnes (inertes, RLS encore eteint) ;
--    2. retirer les huit anciennes (inertes aussi) ;
--    3. allumer -- il ne reste alors que la bonne.
-- ---------------------------------------------------------------------
drop policy if exists players_admin_tout on public.players;
create policy players_admin_tout on public.players
  for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists staff_admin_tout on public.staff;
create policy staff_admin_tout on public.staff
  for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "public read players" on public.players;
drop policy if exists "auth insert players" on public.players;
drop policy if exists "auth update players" on public.players;
drop policy if exists "auth delete players" on public.players;
drop policy if exists "public read staff"   on public.staff;
drop policy if exists "auth insert staff"   on public.staff;
drop policy if exists "auth update staff"   on public.staff;
drop policy if exists "auth delete staff"   on public.staff;

alter table public.players enable row level security;
alter table public.staff   enable row level security;


-- ---------------------------------------------------------------------
--  2 bis) LA VUE QUI SERAIT MORTE AVEC ELLES
-- ---------------------------------------------------------------------
--  `player_season_stats` est en `security_invoker = on` et fait
--  `join players`. Elle lit donc avec les droits de CELUI QUI INTERROGE :
--  des que players se ferme, un visiteur anonyme en tire zero ligne, et
--  les statistiques disparaissent des fiches de joueuses du site -- sans
--  erreur, sans message, juste des cases vides.
--
--  Elle passe donc en `security_invoker = off`, comme
--  `match_lineup_public` l'est deja. Ce qu'elle expose etait public de
--  toute facon : un nom, un numero de maillot, et des moyennes de match.
--  Rien des colonnes qu'on vient de fermer.
-- ---------------------------------------------------------------------
alter view public.player_season_stats set (security_invoker = off);

--  Les trois autres vues qui lisent players ou staff restent en
--  `security_invoker = on`, et se referment donc avec les tables. C'est
--  voulu : `effectif_admin`, `numeros_en_double` et `collecte_suivi` ne
--  servent qu'a l'administration.


-- ---------------------------------------------------------------------
--  3) LA VUE DE SUIVI NE PORTE PLUS LE JETON
-- ---------------------------------------------------------------------
--  `collecte_suivi` est en `security_invoker = on` : elle se refermera
--  d'elle-meme avec les tables. On lui retire quand meme le jeton, pour
--  qu'un futur `grant` distrait ne le rouvre pas.
--
--  L'administration ne perd rien : elle ne lit de cette vue que
--  `campagne_id` et `fiche_etat` (un seul appel, dans l'ecran Collecte),
--  et le lien de reprise, elle le fabrique depuis `players` -- ou le
--  jeton lui reste accessible, la securite posee ci-dessus etant au
--  niveau des LIGNES, pas des colonnes.
--
--  ATTENTION : `create or replace view` ne sait qu'AJOUTER des colonnes
--  a la fin. Retirer `reprise_jeton` exige de supprimer la vue d'abord.
--  Sans `cascade`, volontairement : si quelque chose en depend, on veut
--  l'apprendre par une erreur, pas le casser en silence.
-- ---------------------------------------------------------------------
drop view if exists public.collecte_suivi;

create view public.collecte_suivi with (security_invoker = on) as
  select 'joueuse'::text as type, p.id, p.name, p.fiche_etat, p.status,
         p.jersey_number, p.campagne_id, p.soumis_le,
         p.photo_source_url, p.photo_url,
         case when p.photo_url is not null and p.photo_url <> '' then 'finale'
              when p.photo_source_url is not null and p.photo_source_url <> '' then 'a_traiter'
              else 'aucune' end as photo_etat,
         array_remove(array[
           case when coalesce(btrim(p.name),'') = '' then 'nom' end,
           case when p.jersey_number is null then 'numero' end,
           case when p.positions is null or array_length(p.positions,1) = 0 then 'poste' end,
           case when coalesce(btrim(p.photo_url),'') = '' then 'photo finale' end
         ], null) as manque
    from public.players p
  union all
  select 'staff'::text, s.id, s.name, s.fiche_etat, null::text,
         null::int, s.campagne_id, s.soumis_le,
         s.photo_source_url, s.photo_url,
         case when s.photo_url is not null and s.photo_url <> '' then 'finale'
              when s.photo_source_url is not null and s.photo_source_url <> '' then 'a_traiter'
              else 'aucune' end,
         array_remove(array[
           case when coalesce(btrim(s.name),'') = '' then 'nom' end,
           case when coalesce(btrim(s.role),'') = '' then 'fonction' end,
           case when coalesce(btrim(s.photo_url),'') = '' then 'photo finale' end
         ], null)
    from public.staff s;

revoke select on public.collecte_suivi from anon;
grant  select on public.collecte_suivi to authenticated;


-- ---------------------------------------------------------------------
--  4) CE QU'ON NE FAIT PAS, ET POURQUOI
-- ---------------------------------------------------------------------
--  Une premiere version ajoutait une fonction `bbc_collecte_liens()`
--  pour que l'administration recupere les jetons sans lire la table.
--  Elle a ete retiree : elle ne servait a rien. L'ecran Collecte lit
--  `players.reprise_jeton` directement, et continuera de le faire --
--  la securite posee au point 2 filtre les LIGNES selon is_admin(), pas
--  les colonnes. Un compte d'administration voit donc tout, un compte
--  client ne voit rien, et aucune fonction n'est necessaire entre les
--  deux. Une fonction de plus, c'est une porte de plus a surveiller.
--
--  On ne revoque pas non plus la colonne `reprise_jeton` : un
--  `revoke select (colonne)` ferait echouer tout `select=*` de
--  l'administration, qui en fait partout.
-- ---------------------------------------------------------------------


-- =====================================================================
--  VERIFICATIONS  (a lancer dans le meme editeur, apres)
-- ---------------------------------------------------------------------
--  1. Les deux tables sont bien fermees, et par quelle politique :
--
--      select tablename, policyname, roles, cmd, qual
--        from pg_policies
--       where schemaname = 'public' and tablename in ('players','staff')
--       order by tablename, policyname;
--
--     Attendu : une ligne par table, cmd = ALL, qual contenant is_admin().
--     Toute AUTRE politique sur ces tables ouvre une seconde porte --
--     les politiques s'additionnent, elles ne se remplacent pas.
--
--  2. Rien ne reste sans securite parmi les tables qui portent des
--     donnees de personnes :
--
--      select c.relname,
--             case when c.relrowsecurity then 'RLS active' else 'OUVERTE' end as etat,
--             (select count(*) from pg_policies p
--               where p.schemaname='public' and p.tablename=c.relname) as politiques
--        from pg_class c join pg_namespace n on n.oid = c.relnamespace
--       where n.nspname='public' and c.relkind='r'
--       order by c.relrowsecurity, c.relname;
--
--     Une table « OUVERTE » est lisible par n'importe quel visiteur muni
--     de la cle publique. C'est cette liste-la qui dit la verite, pas le
--     contenu de ce depot : plusieurs migrations sont passees a la main
--     et n'y figurent pas.
--
--  3. Du dehors, sans session (remplacez <CLE> par la cle publique) :
--
--      curl -s "https://lmwbwasupqkvswukieav.supabase.co/rest/v1/staff?select=reprise_jeton&limit=1" \
--           -H "apikey: <CLE>" -H "Authorization: Bearer <CLE>"
--
--     Attendu : []  (et non une ligne). Attention : [] seul ne prouve
--     rien si la table est vide -- c'est le point 1 qui fait foi.
--
--  4. Le site, non connecte, doit continuer d'afficher l'effectif :
--
--      curl -s ".../rest/v1/effectif_site?select=name,jersey_number&limit=3" ...
--
--     Attendu : les joueuses publiees.
--
--  5. Et ses statistiques, qui passent par une autre vue :
--
--      curl -s ".../rest/v1/player_season_stats?select=name,pts_moy&limit=3" ...
--
--     Attendu : des lignes. Si c'est vide, le `security_invoker = off`
--     du point 2 bis n'est pas passe.
-- =====================================================================


-- =====================================================================
--  REVENIR EN ARRIERE  (si quelque chose disparait du site)
-- ---------------------------------------------------------------------
--  Une seule chose a defaire : la fermeture des deux tables. Les vues
--  ajoutees ne genent personne, et le site sait vivre avec comme sans.
--  A garder sous la main pendant les premieres minutes.
--
--      alter table public.players disable row level security;
--      alter table public.staff   disable row level security;
--
--  Cela remet l'ouverture d'avant, trou compris. Ce n'est pas une
--  solution : c'est un frein de secours.
-- =====================================================================
