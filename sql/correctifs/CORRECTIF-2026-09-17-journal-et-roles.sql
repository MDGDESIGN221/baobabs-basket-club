-- =====================================================================
--  LE JOURNAL SE FERME, ET LES CASQUETTES DEVIENNENT DES SERRURES
--  17 septembre 2026. Idempotent. Aucune donnee supprimee.
--
--  A COLLER DANS L'EDITEUR SQL DE SUPABASE. `supabase db push` ne voit
--  pas les migrations deja passees a la main, et ce depot en compte.
--
--  A PASSER APRES les deux migrations du matin du 17 septembre
--  (fermer-les-ecritures, fermer-les-fiches). Ce fichier suppose que
--  les neuf tables grandes ouvertes sont refermees et que players et
--  staff sont reserves a l'administration.
--
--  DEUX CHOSES, ET LA PREMIERE EST URGENTE.
-- ---------------------------------------------------------------------
--
--  1) LE JOURNAL D'ACTIVITE EST LISIBLE PAR TOUT INTERNET
--
--  L'historique des modifications se lit par verify_audit_password(mot
--  de passe). Cette fonction est accordee a `anon` : elle s'appelle
--  avec la seule cle publique du site, sans compte. Elle ne repose donc
--  que sur le secret du mot de passe.
--
--  Ce mot de passe est ecrit en clair dans sql/diagnostics/
--  AUDIT-HISTORIQUE.sql, et le depot github.com/MDGDESIGN221/
--  baobabs-basket-club est PUBLIC. N'importe qui peut donc lire le
--  journal entier : chaque champ modifie depuis le 24 juillet, avec sa
--  valeur avant et sa valeur apres. Un journal contient des numeros de
--  telephone, des noms d'enfants, des montants.
--
--  Et l'ecriture est ouverte aussi : log_audit_entry est accordee a
--  `anon`, et l'auteur de la ligne est un PARAMETRE. Autrement dit,
--  n'importe qui peut ecrire « telle adresse a supprime la fiche de X »
--  dans l'historique du club. Un journal qu'un inconnu peut ecrire ne
--  prouve rien du tout.
--
--  Ce bloc fait trois choses : il retire les deux fonctions a `anon`,
--  il fait dire a la base QUI ecrit au lieu de croire le navigateur, et
--  il garde exactement les memes signatures pour que l'ecran Historique
--  de l'administration continue de marcher sans une ligne de
--  JavaScript a changer.
--
--
--  2) LES CASQUETTES NE FERMENT RIEN, ELLES RANGENT
--
--  MIGRATION-phase0-socle.sql l'ecrivait deja : « les rôles sont posés
--  et interrogeables, mais les politiques RLS n'ont PAS été réécrites :
--  au niveau de la base, tout compte présent dans admin_users garde
--  l'accès complet ». C'est toujours vrai sur les tables refermees le
--  matin du 17 septembre : elles demandent is_admin(), pas bbc_can().
--
--  Concretement, aujourd'hui : un coach connecte ne VOIT pas l'entree
--  Boutique dans le menu, mais une requete a la main sur products passe
--  sans probleme. La porte est retiree du couloir, elle n'est pas
--  fermee a cle.
--
--  Le bloc 2 la ferme a cle.
--
--  CE QU'IL FAUT SAVOIR AVANT DE L'EXECUTER : il applique la matrice de
--  role_permissions, telle qu'elle est. Donc, le jour ou quelqu'un
--  d'autre que vous aura un compte :
--    le president         lit la boutique mais ne la modifie plus ;
--    le directeur sportif ne touche ni boutique ni billetterie ;
--    le coach             n'ecrit que matchs, effectif et statistiques ;
--    le community manager n'ecrit que le contenu.
--  Ce n'est pas un effet de bord, c'est la matrice ecrite en aout. Si
--  elle ne correspond plus au club, elle se change dans l'ecran
--  « Comptes & rôles » du proprietaire, pas ici.
--
--  TANT QUE LES DEUX SEULS COMPTES SONT super_admin, CE BLOC NE CHANGE
--  RIEN AU QUOTIDIEN : bbc_can() rend toujours vrai pour eux.
-- =====================================================================


-- #####################################################################
-- ##  BLOC 1 : LE JOURNAL
-- #####################################################################

-- ---------------------------------------------------------------------
-- 1.1  L'AUTEUR DEVIENT UN FAIT, PLUS UNE DECLARATION
--      Une colonne de plus : l'identifiant du compte, celui que
--      Postgres lit dans le jeton de session. Personne ne peut
--      l'inventer depuis un navigateur.
-- ---------------------------------------------------------------------
alter table admin_audit_log add column if not exists auteur_uid uuid;

comment on column admin_audit_log.auteur_uid is
  'Le compte qui a fait l''action, lu dans la session par auth.uid(). '
  'user_email reste pour l''affichage et pour l''historique d''avant le '
  '17 septembre 2026, mais c''est cette colonne qui fait foi.';


-- ---------------------------------------------------------------------
-- 1.2  ECRIRE : LA BASE DIT QUI, LE NAVIGATEUR NE DIT PLUS RIEN
--
--      La signature ne change pas : admin-matchs.html envoie toujours
--      ses sept parametres, et p_user_email est simplement ignore.
--      C'etait le seul moyen de fermer la porte sans reecrire l'ecran.
--
--      Un appel par quelqu'un qui n'est pas dans admin_users ne leve
--      pas d'erreur : il n'ecrit rien. Une erreur ici ferait echouer
--      une sauvegarde reelle de l'admin, ce qui serait pire.
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
declare
  v_uid  uuid := auth.uid();
  v_mail text;
begin
  -- Qui parle ? Pas ce que dit le corps de la requete : ce que dit le
  -- jeton. p_user_email est accepte pour ne pas casser l'appelant, et
  -- jete ici meme.
  if v_uid is null then return; end if;

  select a.email into v_mail from admin_users a where a.user_id = v_uid;
  if v_mail is null then return; end if;   -- pas un compte d'administration

  insert into admin_audit_log (
    auteur_uid, user_email, section, table_name, record_id,
    field_key, old_value, new_value
  ) values (
    v_uid, v_mail, p_section, p_table_name, p_record_id,
    p_field_key,
    -- Un journal n'a pas a garder des romans : une valeur de plus de
    -- 4 000 caracteres est tronquee, avec la marque de la troncature.
    case when length(p_old_value) > 4000
         then left(p_old_value, 4000) || ' [tronque]' else p_old_value end,
    case when length(p_new_value) > 4000
         then left(p_new_value, 4000) || ' [tronque]' else p_new_value end
  );
exception when others then
  -- Inchange : la journalisation ne doit jamais empecher une sauvegarde.
  null;
end;
$$;

-- LA PORTE SE FERME. `anon`, c'est la cle publique ecrite dans
-- index.html : elle ne doit plus pouvoir ecrire dans l'historique.
revoke all on function log_audit_entry(text,text,text,text,text,text,text) from public;
revoke all on function log_audit_entry(text,text,text,text,text,text,text) from anon;
grant execute on function log_audit_entry(text,text,text,text,text,text,text) to authenticated;


-- ---------------------------------------------------------------------
-- 1.3  LIRE : LE MOT DE PASSE NE SUFFIT PLUS, IL FAUT AUSSI ETRE ENTRE
--
--      Deux serrures au lieu d'une. Le mot de passe reste, c'est le
--      geste que l'ecran connait, mais il ne s'ouvre plus que depuis un
--      compte d'administration. Un inconnu qui connait le mot de passe,
--      y compris parce qu'il l'a lu dans le depot public, n'obtient
--      plus rien.
--
--      La fonction rend toujours zero ligne en cas de refus, sans dire
--      laquelle des deux serrures a resiste.
-- ---------------------------------------------------------------------
create or replace function verify_audit_password(pwd text)
returns setof admin_audit_log
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  -- Serrure 1 : etre un compte d'administration.
  if not public.is_admin() then return; end if;

  -- Serrure 2 : le mot de passe de consultation.
  if exists (
    select 1 from admin_audit_secret
    where id = 1 and pwd_hash = crypt(pwd, pwd_hash)
  ) then
    return query select * from admin_audit_log order by created_at desc limit 5000;
  end if;
  return;
end;
$$;

revoke all on function verify_audit_password(text) from public;
revoke all on function verify_audit_password(text) from anon;
grant execute on function verify_audit_password(text) to authenticated;


-- ---------------------------------------------------------------------
-- 1.4  CHANGER LE MOT DE PASSE DE CONSULTATION
--
--      OPTIONNEL, ET VOLONTAIREMENT PAS FAIT ICI.
--      Le mot de passe actuel est publie sur GitHub depuis le 24
--      juillet. Les deux serrures du 1.3 suffisent a fermer la porte,
--      donc ce fichier s'execute sans risque tel quel. Mais un secret
--      publie reste un secret perdu : remplacez-le.
--
--      Decommentez les trois lignes suivantes, mettez VOTRE mot de
--      passe a la place, executez-les seules. N'ecrivez pas le nouveau
--      dans un fichier du depot.
-- ---------------------------------------------------------------------
-- update admin_audit_secret
--    set pwd_hash = crypt('a-remplacer-par-le-votre', gen_salt('bf'))
--  where id = 1;


-- #####################################################################
-- ##  BLOC 2 : LES CASQUETTES DEVIENNENT DES SERRURES
-- #####################################################################

-- ---------------------------------------------------------------------
-- 2.1  L'OUTIL, ET LA SEULE CHOSE A LAQUELLE IL FAUT FAIRE ATTENTION
--
--      Le principe est celui de bbc_policies_module (phase0d), avec
--      deux differences qui comptent ici.
--
--      D'ABORD, ON NE TOUCHE QU'A L'ECRITURE. Les tables de ce bloc
--      nourrissent le site public : matchs, actualites, boutique,
--      partenaires, galerie, frise, classement, organigramme. Les
--      fermer en lecture eteindrait l'accueil. Les politiques de SELECT
--      restent donc en place, telles quelles.
--
--      ENSUITE, ON RETIRE LES ANCIENNES PORTES PAR CONDITION, PAS PAR
--      NOM. Sur gallery, une politique s'appelle « galerie ecrite par
--      l'administration » et sa condition valait `true` : elle disait
--      l'inverse de ce qu'elle faisait.
--
--      ATTENTION, ET C'EST LE PIEGE DE CE FICHIER : une politique
--      « for all » couvre AUSSI la lecture. La retirer sur une table
--      dont c'est la seule porte rendrait la table muette. Le filet du
--      point 3 en repose donc une, mais une lecture PUBLIQUE : cet
--      outil ne doit servir qu'aux tables dont le contenu est
--      publiable. players et staff ne passent pas par lui, ils ont
--      leur propre bloc en 2.3.
-- ---------------------------------------------------------------------
create or replace function bbc_ecriture_par_role(p_table text, p_module text)
returns void language plpgsql as $$
declare
  nom  text;
  noms text[];
begin
  if to_regclass('public.' || p_table) is null then
    raise notice 'table absente, ignoree : %', p_table;
    return;
  end if;

  -- 1. On pose les bonnes portes D'ABORD. Les politiques s'additionnent
  --    en OU : tant que les anciennes sont la, rien ne se ferme, et la
  --    table n'est jamais sans porte, pas meme une seconde.
  execute format('drop policy if exists %I on public.%I', p_table || '_r_creer', p_table);
  execute format('create policy %I on public.%I for insert to authenticated with check (bbc_can(%L,''creer''))',
                 p_table || '_r_creer', p_table, p_module);

  execute format('drop policy if exists %I on public.%I', p_table || '_r_modifier', p_table);
  execute format('create policy %I on public.%I for update to authenticated using (bbc_can(%L,''modifier'')) with check (bbc_can(%L,''modifier''))',
                 p_table || '_r_modifier', p_table, p_module, p_module);

  execute format('drop policy if exists %I on public.%I', p_table || '_r_supprimer', p_table);
  execute format('create policy %I on public.%I for delete to authenticated using (bbc_can(%L,''supprimer''))',
                 p_table || '_r_supprimer', p_table, p_module);

  -- 2. On retire les anciennes portes d'ECRITURE, et elles seules.
  --    Releve d'abord, suppression ensuite : parcourir pg_policies tout
  --    en y supprimant des lignes, c'est scier la branche.
  select coalesce(array_agg(policyname), '{}') into noms
    from pg_policies
   where schemaname = 'public' and tablename = p_table
     and cmd <> 'SELECT'
     and policyname not in (p_table || '_r_creer', p_table || '_r_modifier', p_table || '_r_supprimer')
     and coalesce(qual, '') || coalesce(with_check, '') not like '%bbc_can%';

  foreach nom in array noms loop
    execute format('drop policy %I on public.%I', nom, p_table);
    raise notice 'retiree : %.%', p_table, nom;
  end loop;

  -- 3. LE FILET. Si plus aucune porte de lecture ne reste, on en repose
  --    une. On n'arrive ici que si la table n'avait qu'une politique
  --    « for all » ; sur les tables de ce bloc, le contenu est celui du
  --    site, donc une lecture publique est bien ce qu'il faut.
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = p_table
                    and cmd in ('SELECT','ALL')) then
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)',
                   p_table || '_lecture_publique', p_table);
    raise notice 'lecture publique reposee sur %', p_table;
  end if;

  execute format('alter table public.%I enable row level security', p_table);
end $$;


-- ---------------------------------------------------------------------
-- 2.2  LA CARTE : QUELLE TABLE APPARTIENT A QUEL METIER
--      Elle n'est pas devinee : c'est SECTION_MODULE de
--      admin-matchs.html, la carte que l'interface applique deja pour
--      ranger les menus. La base dit desormais la meme chose que
--      l'ecran, ce qui est tout l'objet de ce bloc.
--
--      Les neuf tables ci-dessous sont celles du site public. Leur
--      contenu est deja visible de tous : une lecture publique n'y
--      perd rien.
-- ---------------------------------------------------------------------
do $$
declare
  paires text[][] := array[
    -- LE SPORTIF
    ['matches',          'matchs'],
    ['match_results',    'matchs'],
    ['standings',        'matchs'],
    -- L'ORGANIGRAMME (la page Club l'affiche)
    ['org_roles',        'effectif'],
    -- LE SITE PUBLIC
    ['news',             'contenu'],
    ['partners',         'contenu'],
    ['gallery',          'contenu'],
    ['timeline_events',  'contenu'],
    -- LA BOUTIQUE
    ['products',         'boutique']
  ];
  i int;
begin
  for i in 1 .. array_length(paires, 1) loop
    perform bbc_ecriture_par_role(paires[i][1], paires[i][2]);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 2.3  LES FICHES DES MEMBRES, QUI NE SONT PAS PUBLIQUES
--
--      players et staff ont ete refermees le matin du 17 septembre :
--      seul un compte de admin_users les lit, et le site passe par les
--      vues effectif_site et staff_site, qui ne portent que les
--      colonnes affichables. Cet acquis ne doit pas se perdre ici.
--
--      Elles ne passent donc PAS par bbc_ecriture_par_role : son filet
--      reposerait une lecture publique, et la date de naissance, le
--      numero de licence, la note de blessure, le telephone et le jeton
--      de reprise redeviendraient lisibles par tout le monde. On ecrit
--      les quatre portes a la main, la lecture comprise.
--
--      Les vues effectif_site, staff_site et player_season_stats sont
--      en « security definer » : elles traversent ces politiques, le
--      site continue d'afficher ses joueuses et son encadrement.
-- ---------------------------------------------------------------------
do $$
declare
  t    text;
  nom  text;
  noms text[];
begin
  foreach t in array array['players','staff'] loop
    if to_regclass('public.' || t) is null then continue; end if;

    -- Les bonnes portes d'abord, y compris celle de la LECTURE.
    execute format('drop policy if exists %I on public.%I', t || '_r_voir', t);
    execute format('create policy %I on public.%I for select to authenticated using (bbc_can(''effectif'',''voir''))',
                   t || '_r_voir', t);
    execute format('drop policy if exists %I on public.%I', t || '_r_creer', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (bbc_can(''effectif'',''creer''))',
                   t || '_r_creer', t);
    execute format('drop policy if exists %I on public.%I', t || '_r_modifier', t);
    execute format('create policy %I on public.%I for update to authenticated using (bbc_can(''effectif'',''modifier'')) with check (bbc_can(''effectif'',''modifier''))',
                   t || '_r_modifier', t);
    execute format('drop policy if exists %I on public.%I', t || '_r_supprimer', t);
    execute format('create policy %I on public.%I for delete to authenticated using (bbc_can(''effectif'',''supprimer''))',
                   t || '_r_supprimer', t);

    -- Puis les anciennes, toutes celles qui ne parlent pas de bbc_can.
    -- ON RELEVE LES NOMS D'ABORD, ON SUPPRIME ENSUITE. Parcourir
    -- pg_policies tout en y supprimant des lignes, c'est scier la
    -- branche sur laquelle on est assis : le curseur lit la vue pendant
    -- qu'elle change, et une politique sur deux survit.
    select coalesce(array_agg(policyname), '{}') into noms
      from pg_policies
     where schemaname = 'public' and tablename = t
       and coalesce(qual, '') || coalesce(with_check, '') not like '%bbc_can%';

    foreach nom in array noms loop
      execute format('drop policy %I on public.%I', nom, t);
      raise notice 'retiree : %.%', t, nom;
    end loop;

    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 2.4  LES PIECES DES DOSSIERS DE MINEURS
--
--      Le bucket dossiers-prives contient des actes de naissance, des
--      certificats medicaux et des autorisations parentales d'enfants.
--      Ses trois politiques demandent is_admin() : aujourd'hui, un
--      community manager pourrait les telecharger toutes.
--
--      Elles passent sur le module « inscriptions », celui de l'ecole
--      de basket. Le coach et le community manager n'y ont aucun droit
--      dans la matrice ; le directeur sportif et le president, oui.
--
--      L'ECRITURE DE LA FAMILLE N'EST PAS CONCERNEE. La fonction
--      serveur depot-piece ecrit avec la cle de service, et une
--      politique ne s'applique pas a la cle de service : le certificat
--      envoye depuis un telephone continue d'arriver. La porte
--      d'insertion pour les administrateurs reste, parce que l'ecran
--      Inscriptions sait aussi deposer une piece a la main.
-- ---------------------------------------------------------------------
drop policy if exists dossiers_prives_admin_lecture on storage.objects;
create policy dossiers_prives_admin_lecture on storage.objects
  for select to authenticated
  using (bucket_id = 'dossiers-prives' and public.bbc_can('inscriptions','voir'));

drop policy if exists dossiers_prives_admin_ecriture on storage.objects;
create policy dossiers_prives_admin_ecriture on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dossiers-prives' and public.bbc_can('inscriptions','modifier'));

drop policy if exists dossiers_prives_admin_suppression on storage.objects;
create policy dossiers_prives_admin_suppression on storage.objects
  for delete to authenticated
  using (bucket_id = 'dossiers-prives' and public.bbc_can('inscriptions','supprimer'));


-- ---------------------------------------------------------------------
-- 2.5  LE STOCKAGE DES IMAGES DU SITE
--      site-media porte les affiches, les photos de joueuses, les
--      visuels d'actualite. Il est public en lecture, c'est normal :
--      c'est ce que le site affiche. Ce qui ne doit pas etre normal,
--      c'est d'y ecrire sans etre du club.
--
--      On POSE sans RIEN RETIRER. Le bloc I du diagnostic dira ce qui
--      s'y trouvait deja ; si une porte ouverte a `anon` y dormait,
--      elle se retirera une fois vue, par son nom. Poser un `drop` sur
--      un nom qu'on n'a pas lu, c'est le moyen le plus sur de casser la
--      mediatheque un soir de match.
-- ---------------------------------------------------------------------
do $$ begin
  if exists (select 1 from storage.buckets where id = 'site-media') then
    drop policy if exists site_media_ecriture_club on storage.objects;
    create policy site_media_ecriture_club on storage.objects
      for insert to authenticated
      with check (bucket_id = 'site-media' and public.is_admin());

    drop policy if exists site_media_suppression_club on storage.objects;
    create policy site_media_suppression_club on storage.objects
      for delete to authenticated
      using (bucket_id = 'site-media' and public.is_admin());

    raise notice 'site-media : ecriture et suppression reservees au club';
  else
    raise notice 'site-media absent : rien a faire';
  end if;
end $$;


-- =====================================================================
--  VERIFICATIONS, DANS L'ORDRE
-- ---------------------------------------------------------------------
--  a) LE JOURNAL EST FERME A L'INCONNU. Doit rendre ZERO ligne :
--
--       select p.proname
--         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public'
--          and p.proname in ('log_audit_entry','verify_audit_password')
--          and has_function_privilege('anon', p.oid, 'EXECUTE');
--
--  b) LE JOURNAL MARCHE TOUJOURS DEPUIS L'ADMINISTRATION. Ouvrez un
--     ecran, modifiez une ligne, enregistrez. Puis Historique, le mot
--     de passe, et la modification doit apparaitre en haut, avec votre
--     adresse. La ligne doit aussi porter un auteur_uid :
--
--       select created_at, user_email, auteur_uid, table_name, field_key
--         from admin_audit_log order by created_at desc limit 5;
--
--  c) LE SITE PUBLIC SURVIT. Rechargez l'accueil, Equipes, Calendrier,
--     Boutique, Club. Les onze tables des blocs 2.2 et 2.3 sont
--     exactement celles que ces pages lisent : si l'une s'est refermee
--     en lecture, ca se voit tout de suite. Attention a Equipes en
--     particulier : elle passe par effectif_site, pas par players.
--
--  d) LES FICHES RESTENT FERMEES. Sans session, avec la cle publique,
--     ceci doit rendre zero ligne ou une erreur, jamais des donnees :
--       .../rest/v1/players?select=licence_num,birth_date&limit=1
--       .../rest/v1/staff?select=phone,reprise_jeton&limit=1
--     Et ceci doit rendre les joueuses :
--       .../rest/v1/effectif_site?select=name&limit=3
--
--  e) L'ADMINISTRATION ECRIT TOUJOURS. Creez un match, modifiez une
--     actualite, changez un prix, supprimez une photo de galerie,
--     ouvrez une fiche de joueuse et enregistrez. Vous etes
--     super_admin, donc bbc_can() rend vrai partout.
--
--  f) LA SEULE PREUVE QUI COMPTE, ET ELLE DEMANDE UN VRAI COMPTE :
--     passez un compte d'essai en « Coach » dans Comptes & rôles,
--     connectez-vous avec, et essayez de modifier un produit de la
--     boutique. La base doit refuser. Tant que ce test n'est pas fait,
--     on sait que le SQL est passe, pas que la serrure tient.
--
--
--  REVENIR EN ARRIERE
--  Ce fichier ne supprime aucune donnee. Pour rouvrir l'ecriture d'une
--  table a tout compte d'administration, le temps d'un depannage :
--
--    create policy zz_depannage on public.<table>
--      for all to authenticated using (is_admin()) with check (is_admin());
--
--  Et pour la retirer ensuite :
--    drop policy zz_depannage on public.<table>;
-- =====================================================================
