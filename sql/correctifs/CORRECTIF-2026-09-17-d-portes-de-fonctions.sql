-- =====================================================================
--  LES PORTES DE FONCTIONS QUE PERSONNE N'AVAIT FERMEES
--  17 septembre 2026, au soir. Idempotent. Aucune donnee supprimee.
--
--  PASSE EN PRODUCTION LE 17 SEPTEMBRE 2026, verifie apres.
--
--  D'OU CA VIENT
--  Les deux premiers correctifs du jour etaient ecrits en lisant le
--  depot. Une fois passes, j'ai interroge `pg_proc` sur la vraie base :
--  trente fonctions etaient appelables par `anon`, c'est-a-dire avec la
--  seule cle publiable ecrite dans index.html, sans aucun compte.
--
--  LA CAUSE EST UN DEFAUT DE POSTGRES, PAS UN OUBLI D'ECRITURE.
--  Postgres accorde EXECUTE a PUBLIC sur toute fonction nouvellement
--  creee. `anon` herite de PUBLIC. Donc toute fonction creee sans
--  « revoke » explicite est appelable par n'importe qui, et rien dans
--  le fichier qui la cree ne le laisse voir.
--
--  ET LE PIEGE DANS LE PIEGE : `revoke ... from anon` NE SUFFIT PAS.
--  Il retire le droit propre a `anon`, pas celui qu'il tient de PUBLIC.
--  Le bloc 5 de CORRECTIF-...-b faisait exactement cette erreur sur
--  bbc_proprietaire_email : apres son passage, has_function_privilege
--  rendait toujours `true`. Il faut revoquer a PUBLIC.
--
--  CE QUI RESTE VOLONTAIREMENT OUVERT A anon, et pourquoi
--    bbc_can, bbc_role, is_admin, bbc_est_proprietaire,
--    bbc_est_super_admin
--        Les politiques RLS les appellent. Une politique qui appelle une
--        fonction non executable par le role courant ne rend pas
--        « faux » : elle fait ECHOUER TOUTE LA REQUETE. Les fermer
--        eteindrait le site public d'un coup. Elles ne rendent d'ailleurs
--        rien a un visiteur : `false`, ou `null`.
--    bbc_inscription, bbc_inscription_suivi, bbc_reserver,
--    bbc_valider_promo, bbc_collecte_*
--        Les formulaires publics. C'est leur raison d'etre.
--    bbc_slugify, unaccent_fallback, bbc_cle, bbc_club_cle,
--    bbc_reference_*, bbc_mvp_match, bbc_saison_courante,
--    _cld_to_local, _fix_ext, bbc_feuille_remplie
--        Des aides de calcul. Elles ne touchent a aucune donnee, ou
--        seulement a ce que le site montre deja.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. bbc_piece_deposer : LA PLUS IMPORTANTE DES SIX
--
--    Sa propre migration l'ecrivait noir sur blanc :
--      « Personne n'appelle ceci depuis le navigateur : seule la
--        fonction serveur le fait, avec la cle de service. On n'accorde
--        donc rien a anon. »
--    La base disait l'inverse. Elle etait appelable sans compte.
--
--    CE QUE CA PERMETTAIT. Elle est `security definer` et ecrit une
--    ligne dans academy_documents avec l'URL qu'on lui donne. Qui
--    connait la reference et le telephone d'une famille pouvait donc
--    inscrire N'IMPORTE QUELLE chaine comme piece du dossier, en
--    sautant tout ce que depot-piece verifie : le format reel des
--    octets, la taille, le plafond par dossier, et le fait que le
--    fichier soit bien dans le bucket prive. Une URL vers l'exterieur
--    passait.
--
--    L'administration ne s'en sert pas : elle insere dans
--    academy_documents directement (sbInsert). Seule depot-piece
--    l'appelle, avec la cle de service.
-- ---------------------------------------------------------------------
revoke execute on function public.bbc_piece_deposer(text,text,text,text) from public;
revoke execute on function public.bbc_piece_deposer(text,text,text,text) from anon;
revoke execute on function public.bbc_piece_deposer(text,text,text,text) from authenticated;
grant  execute on function public.bbc_piece_deposer(text,text,text,text) to service_role;


-- ---------------------------------------------------------------------
-- 2. LES DEUX FONCTIONS DE MAINTENANCE QUI REECRIVENT DES POLITIQUES
--
--    bbc_vider_policies retire TOUTES les politiques d'une table.
--    bbc_ecriture_par_role les repose. Elles ne sont pas `security
--    definer`, donc appelees par anon elles echouent faute d'etre
--    proprietaire des tables -- mais il n'y a aucune raison qu'elles
--    soient atteignables. Le jour ou quelqu'un les passe en definer
--    « pour depanner », la porte devient une autoroute.
--
--    Elles se lancent depuis l'editeur SQL, en proprietaire. Personne
--    d'autre n'en a besoin.
-- ---------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array['bbc_vider_policies(text)',
                           'bbc_ecriture_par_role(text,text)',
                           'bbc_policies_module(text,text)']
  loop
    if to_regprocedure('public.' || f) is not null then
      execute format('revoke execute on function public.%s from public', f);
      execute format('revoke execute on function public.%s from anon', f);
      execute format('revoke execute on function public.%s from authenticated', f);
      raise notice 'fermee : %', f;
    end if;
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 3. CE QUI DEMANDE UNE SESSION, ET RIEN DE PLUS
--
--    bbc_rattacher_historique rattache a un compte les commandes
--    passees avec la meme adresse avant sa creation. Elle leve deja
--    « non_connecte » quand auth.uid() est null : anon n'en tirait
--    rien. On retire quand meme la porte, parce qu'une porte inutile se
--    ferme. index.html l'appelle avec la session du client : le droit
--    de `authenticated` est celui qui compte, et il reste.
--
--    bbc_recalculer_classement reecrit la table du classement. Aucun
--    appelant cote client dans tout le depot ; elle est declenchee par
--    la base et lancee a la main. `authenticated` suffit largement.
-- ---------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array['bbc_rattacher_historique()',
                           'bbc_recalculer_classement()']
  loop
    if to_regprocedure('public.' || f) is not null then
      execute format('revoke execute on function public.%s from public', f);
      execute format('revoke execute on function public.%s from anon', f);
      execute format('grant  execute on function public.%s to authenticated', f);
      raise notice 'reservee aux comptes : %', f;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3 bis. LA TROISIEME PORTE DU JOURNAL, ET CELLE-LA PERSONNE NE L'AVAIT
--        VUE -- MOI NON PLUS, JUSQU'A CE QUE pg_proc LA RENDE
--
--    Le soir du 17 septembre, deux revocations ont ferme le journal :
--      revoke execute on function verify_audit_password(text) from anon;
--      revoke execute on function log_audit_entry(...)        from anon;
--
--    Il y en avait une troisieme. `test_audit_debug(pwd text)`, un reste
--    de mise au point de juillet, est `security definer`, prend le MOT
--    DE PASSE du journal, et rend « TABLE(step text, result boolean) ».
--    Autrement dit : elle dit oui ou non sur un mot de passe, un appel a
--    la fois, sans compte et sans frein. C'est un oracle de force brute
--    sur le secret du journal, et il a survecu aux deux revocations
--    parce qu'il ne porte pas le meme nom.
--
--    LA LECON, et elle vaut plus que le correctif : fermer une fonction
--    par son nom ne ferme pas une porte. On ferme une porte en relevant
--    TOUTES celles qui donnent sur la meme piece. C'est ce que fait la
--    requete du bloc G du diagnostic, et c'est pour ca qu'elle existe.
--
--    Elle n'est pas SUPPRIMEE ici : retirer la fonction de quelqu'un
--    sans qu'il l'ait demande est un geste d'un autre ordre que de
--    fermer sa porte. Elle ne repond plus a un inconnu, c'est ce qui
--    pressait. Pour la retirer pour de bon, quand vous voudrez :
--      drop function public.test_audit_debug(text);
-- ---------------------------------------------------------------------
do $$ begin
  if to_regprocedure('public.test_audit_debug(text)') is not null then
    revoke execute on function public.test_audit_debug(text) from public;
    revoke execute on function public.test_audit_debug(text) from anon;
    revoke execute on function public.test_audit_debug(text) from authenticated;
    raise notice 'test_audit_debug : fermee a tout le monde';
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 4. LE RATTRAPAGE DU BLOC 5 DU FICHIER b
--    Il revoquait a `anon` seulement. Voir l'explication en tete.
-- ---------------------------------------------------------------------
revoke execute on function public.bbc_proprietaire_email() from public;
revoke execute on function public.bbc_proprietaire_email() from anon;
grant  execute on function public.bbc_proprietaire_email() to authenticated;


-- ---------------------------------------------------------------------
-- 5. LA VUE DES RECETTES, TROUVEE DANS LA BASE ET ABSENTE DU DEPOT
--
--    orders_daily_totals rend day, orders_count, total_amount. Elle n'a
--    pas de security_invoker, donc elle traverse le RLS de `orders`, et
--    `anon` pouvait la lire : le chiffre d'affaires du club, jour par
--    jour, avec la cle publique du site.
--
--    Aucun fichier du depot ne la lit -- ni le site, ni
--    l'administration. Elle a du etre creee dans le tableau de bord
--    pour un graphique, puis oubliee.
--
--    ON NE LA SUPPRIME PAS, on la ferme : si un tableau de bord s'en
--    sert quelque part, il suffira de lui rendre son droit.
--      grant select on public.orders_daily_totals to anon;
-- ---------------------------------------------------------------------
do $$ begin
  if to_regclass('public.orders_daily_totals') is not null then
    revoke select on public.orders_daily_totals from public;
    revoke select on public.orders_daily_totals from anon;
    grant  select on public.orders_daily_totals to authenticated;
    raise notice 'orders_daily_totals : fermee aux visiteurs';
  end if;
end $$;


-- =====================================================================
--  VERIFICATIONS
-- ---------------------------------------------------------------------
--  a) LES SIX PORTES SONT FERMEES. Doit rendre zero ligne :
--
--       select p.proname
--         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public'
--          and has_function_privilege('anon', p.oid, 'EXECUTE')
--          and p.proname in ('bbc_piece_deposer','bbc_vider_policies',
--                            'bbc_ecriture_par_role','bbc_policies_module',
--                            'bbc_rattacher_historique','bbc_recalculer_classement',
--                            'test_audit_debug','bbc_proprietaire_email');
--
--  b) ET LA VUE AUSSI. Doit rendre false :
--
--       select has_table_privilege('anon','public.orders_daily_totals','SELECT');
--
--  c) LE DEPOT D'UNE PIECE MARCHE TOUJOURS, et c'est la seule
--     verification qui compte pour le point 1. Elle se fait a la main :
--     ouvrez le suivi d'une inscription sur le site avec une vraie
--     reference et un vrai telephone, envoyez un certificat. Il doit
--     arriver dans l'ecran Inscriptions.
--     La fonction serveur depot-piece utilise la cle de service, et une
--     revocation ne s'applique pas a la cle de service : le chemin de
--     la famille n'est pas touche. Mais on le verifie, parce que c'est
--     le chemin d'une famille.
--
--  d) « MON ESPACE » MARCHE TOUJOURS. Connectez-vous avec un compte
--     client sur le site, ouvrez Mon espace : les commandes passees
--     avant la creation du compte doivent toujours s'y rattacher.
--
--  e) LE SITE PUBLIC LIT TOUJOURS. L'accueil, Equipes, Calendrier,
--     Boutique. Les cinq fonctions laissees ouvertes a anon sont
--     exactement celles dont les politiques RLS ont besoin : si l'une
--     avait ete fermee par erreur, le site serait muet, pas incomplet.
-- =====================================================================
