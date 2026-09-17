-- =====================================================================
--  FERMER L'ECRITURE SUR NEUF TABLES GRANDES OUVERTES
--  17 septembre 2026
-- ---------------------------------------------------------------------
--  CE QUI A ETE MESURE
--
--  `pg_policies`, sur la vraie base, rend douze tables dont une
--  politique d'ECRITURE n'a aucune condition (`qual` et `with_check`
--  valent `true`) et s'adresse a `public`, `anon` ou `authenticated` :
--
--    match_results     DELETE par public, INSERT par public
--    org_roles         ALL par public
--    standings         ALL par public
--    gallery           ALL par authenticated
--    timeline_events   ALL par authenticated
--    matches           DELETE, INSERT, UPDATE par authenticated
--    news              DELETE, INSERT, UPDATE par authenticated
--    partners          DELETE, INSERT, UPDATE par authenticated
--    products          DELETE, INSERT, UPDATE par authenticated
--
--    contact_messages        INSERT par anon   <- legitime, formulaire
--    newsletter_subscribers  INSERT par anon   <- legitime, abonnement
--    recruitment_requests    INSERT par anon   <- legitime, candidature
--
--  Trois d'entre elles (match_results, org_roles, standings) acceptent
--  une ecriture de n'importe qui, SANS COMPTE. Les six autres de tout
--  compte `authenticated` -- et il suffit de dix secondes pour s'en
--  creer un depuis le site. Autrement dit : aujourd'hui, un visiteur
--  peut effacer les matchs, les actualites, la boutique, les
--  partenaires, la galerie, la frise et l'organigramme du club.
--
--  ON NE SE FIE PAS AUX NOMS. Sur `gallery`, une politique s'appelle
--  « galerie ecrite par l'administration » et sa condition est `true` :
--  elle dit l'inverse de ce qu'elle fait. Le bloc ci-dessous ferme donc
--  par CONDITION, jamais par nom.
--
--  LA LECTURE N'EST JAMAIS TOUCHEE. Une politique de SELECT, meme
--  large, reste en place : c'est du contenu public, le site en vit. La
--  seule precaution est que retirer une politique « ALL » emporterait
--  la lecture avec elle -- on en repose alors une aussitot.
--
--  A COLLER DANS L'EDITEUR SQL DE SUPABASE.
-- =====================================================================

do $$
declare
  t text;
  r record;
  reste_lecture int;
  cibles text[] := array['gallery','match_results','matches','news','org_roles',
                         'partners','products','standings','timeline_events'];
begin
  foreach t in array cibles loop

    -- 1. UNE SEULE PORTE POUR ECRIRE, ET ELLE DEMANDE is_admin().
    --    Posee en premier : tant que les anciennes sont la, elles
    --    s'additionnent, donc rien ne se ferme avant l'etape 2. On ne
    --    laisse jamais la table sans aucune porte.
    execute format('drop policy if exists %I on public.%I', t || '_admin_ecrit', t);
    execute format('create policy %I on public.%I for all to authenticated
                    using (is_admin()) with check (is_admin())', t || '_admin_ecrit', t);

    -- 2. TOUTES LES PORTES SANS CONDITION QUI FONT AUTRE CHOSE QUE LIRE.
    for r in select policyname from pg_policies
              where schemaname = 'public' and tablename = t
                and policyname <> t || '_admin_ecrit'
                and cmd <> 'SELECT'
                and coalesce(qual, 'true') = 'true'
                and coalesce(with_check, 'true') = 'true'
    loop
      execute format('drop policy %I on public.%I', r.policyname, t);
      raise notice 'retiree  %.%', t, r.policyname;
    end loop;

    -- 3. S'IL NE RESTE PLUS AUCUNE PORTE DE LECTURE, ON EN REPOSE UNE.
    --    Une politique « ALL » couvrait aussi le SELECT : la retirer
    --    rendrait la table muette pour le site.
    select count(*) into reste_lecture from pg_policies
     where schemaname = 'public' and tablename = t
       and cmd in ('SELECT','ALL') and policyname <> t || '_admin_ecrit';
    if reste_lecture = 0 then
      execute format('create policy %I on public.%I for select to anon, authenticated using (true)',
                     t || '_lecture_publique', t);
      raise notice 'lecture publique reposee sur %', t;
    end if;

    -- 4. Et on allume, au cas ou elle serait encore eteinte.
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;


-- =====================================================================
--  VERIFICATIONS
-- ---------------------------------------------------------------------
--  1. Plus aucune porte d'ecriture sans condition, nulle part :
--
--      select tablename, policyname, cmd, roles
--        from pg_policies
--       where schemaname = 'public'
--         and cmd <> 'SELECT'
--         and coalesce(qual,'true') = 'true'
--         and coalesce(with_check,'true') = 'true'
--         and (roles::text like '%public%' or roles::text like '%anon%'
--              or roles::text like '%authenticated%')
--       order by tablename;
--
--     Attendu : SEULEMENT contact_messages, newsletter_subscribers,
--     recruitment_requests et orders -- les quatre formulaires publics.
--     Toute autre ligne est une porte restee ouverte.
--
--  2. Le site lit toujours (sans session, avec la cle publique) :
--
--      .../rest/v1/matches?select=id&limit=1
--      .../rest/v1/news?select=id&limit=1
--      .../rest/v1/products?select=id&limit=1
--      .../rest/v1/partners?select=id&limit=1
--      .../rest/v1/standings?select=id&limit=1
--      .../rest/v1/gallery?select=id&limit=1
--      .../rest/v1/timeline_events?select=id&limit=1
--      .../rest/v1/org_roles?select=id&limit=1
--
--     Attendu : des lignes partout. Une reponse vide veut dire qu'une
--     politique de lecture est tombee -- reposez-la a la main :
--       create policy <table>_lecture_publique on public.<table>
--         for select to anon, authenticated using (true);
--
--  3. Et l'administration ecrit toujours : ouvrez un ecran, modifiez
--     une ligne, enregistrez. Un compte d'administration est dans
--     admin_users, donc is_admin() est vrai.
-- =====================================================================


-- =====================================================================
--  REVENIR EN ARRIERE
-- ---------------------------------------------------------------------
--  Ce fichier ne supprime aucune donnee : il ne touche qu'aux portes.
--  Pour rouvrir une table le temps d'un depannage (et UNIQUEMENT ca) :
--
--      alter table public.<table> disable row level security;
--
--  Ce n'est pas une solution, c'est un frein de secours.
-- =====================================================================
