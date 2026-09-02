-- =====================================================================
--  Baobabs Basket Club — DIAGNOSTIC de l'administration, version B
--  20 août 2026
--
--  POURQUOI UNE VERSION B
--  La version A enchaînait 7 requêtes. Le SQL Editor de Supabase
--  n'affiche que le résultat de la DERNIÈRE, et envoie les « raise
--  notice » dans un panneau séparé qu'on ne pense pas à ouvrir. Six
--  blocs sur sept étaient donc invisibles.
--
--  Ici : tout tombe dans UN seul tableau. Sélectionne tout, Run,
--  copie-colle le résultat.
--
--  Ne modifie rien de ton schéma. Crée une table temporaire qui
--  disparaît à la fermeture de la session.
-- =====================================================================

drop table if exists diag_out;
create temp table diag_out (ord int, bloc text, cle text, valeur text);

do $$
declare
  r   record;
  n   int;
  v   boolean;
begin

  -- -------------------------------------------------------------------
  -- 1. LES COMPTES ADMINISTRATEURS ET LEUR RÔLE
  -- -------------------------------------------------------------------
  begin
    n := 0;
    for r in select email, role from admin_users order by email loop
      insert into diag_out values (1, '1. comptes admin', r.email, coalesce(r.role, '>>> ROLE NULL <<<'));
      n := n + 1;
    end loop;
    if n = 0 then
      insert into diag_out values (1, '1. comptes admin', '(aucune ligne)', 'admin_users est VIDE');
    end if;
  exception when others then
    insert into diag_out values (1, '1. comptes admin', 'ERREUR', sqlerrm);
  end;

  -- -------------------------------------------------------------------
  -- 2. LA MATRICE DES DROITS EST-ELLE PEUPLÉE
  --    Vide => MIGRATION-phase0-socle.sql n'a jamais tourné.
  -- -------------------------------------------------------------------
  begin
    n := 0;
    for r in select role, count(*)::int as nb from role_permissions group by role order by role loop
      insert into diag_out values (2, '2. droits par role', r.role, r.nb || ' autorisation(s)');
      n := n + 1;
    end loop;
    if n = 0 then
      insert into diag_out values (2, '2. droits par role', '(aucune ligne)', 'role_permissions est VIDE');
    end if;
  exception when others then
    insert into diag_out values (2, '2. droits par role', 'ERREUR', sqlerrm);
  end;

  -- -------------------------------------------------------------------
  -- 3. LES POLITIQUES RÉELLES SUR LA BILLETTERIE
  --    C'est LE bloc qui tranche.
  -- -------------------------------------------------------------------
  begin
    n := 0;
    for r in select tablename, policyname, cmd, qual, with_check
               from pg_policies
              where schemaname = 'public'
                and tablename in ('ticket_offers','reservations')
              order by tablename, policyname loop
      insert into diag_out values (3, '3. policies billetterie',
        r.tablename || ' / ' || r.policyname || ' [' || r.cmd || ']',
        'LECTURE: ' || coalesce(r.qual, '-') || '  |  ECRITURE: ' || coalesce(r.with_check, '-'));
      n := n + 1;
    end loop;
    if n = 0 then
      insert into diag_out values (3, '3. policies billetterie', '(aucune ligne)',
        'AUCUNE POLITIQUE : si RLS est active, personne n''ecrit, meme admin');
    end if;
  exception when others then
    insert into diag_out values (3, '3. policies billetterie', 'ERREUR', sqlerrm);
  end;

  -- -------------------------------------------------------------------
  -- 3bis. RLS EST-ELLE SEULEMENT ACTIVE SUR CES TABLES
  -- -------------------------------------------------------------------
  begin
    for r in select c.relname, c.relrowsecurity
               from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
              where ns.nspname = 'public'
                and c.relname in ('ticket_offers','reservations') loop
      insert into diag_out values (4, '4. RLS active ?', r.relname,
        case when r.relrowsecurity then 'OUI' else 'NON (table ouverte)' end);
    end loop;
  exception when others then
    insert into diag_out values (4, '4. RLS active ?', 'ERREUR', sqlerrm);
  end;

  -- -------------------------------------------------------------------
  -- 5. LES FONCTIONS DE DROITS EXISTENT-ELLES
  --    Une politique qui appelle une fonction absente ne renvoie pas
  --    « faux » : elle fait echouer toute la requete.
  -- -------------------------------------------------------------------
  begin
    for r in select p.proname,
                    pg_get_function_identity_arguments(p.oid) as args,
                    p.prosecdef
               from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
              where ns.nspname = 'public'
                and p.proname in ('is_admin','bbc_role','bbc_can','bbc_est_super_admin','bbc_reserver')
              order by p.proname loop
      insert into diag_out values (5, '5. fonctions', r.proname || '(' || r.args || ')',
        case when r.prosecdef then 'security definer' else 'ATTENTION: pas security definer' end);
    end loop;
    if not exists (select 1 from diag_out where ord = 5) then
      insert into diag_out values (5, '5. fonctions', '(aucune)', 'ni is_admin ni bbc_can n''existent');
    end if;
  exception when others then
    insert into diag_out values (5, '5. fonctions', 'ERREUR', sqlerrm);
  end;

  -- -------------------------------------------------------------------
  -- 6. LE VRAI TEST, COMPTE PAR COMPTE
  --    Reproduit exactement ce que bbc_can() repondrait a ce compte,
  --    sans avoir besoin de se connecter sous son identite.
  -- -------------------------------------------------------------------
  begin
    for r in select email, role from admin_users order by email loop
      select case
               when r.role = 'super_admin' then true
               else exists (select 1 from role_permissions
                             where role = r.role
                               and module = 'billetterie'
                               and action = 'modifier')
             end into v;
      insert into diag_out values (6, '6. PEUT ECRIRE LA BILLETTERIE',
        r.email || ' (' || coalesce(r.role,'role NULL') || ')',
        case when v then 'OUI' else 'NON  <<< c''est la base qui refuse' end);
    end loop;
  exception when others then
    insert into diag_out values (6, '6. PEUT ECRIRE LA BILLETTERIE', 'ERREUR', sqlerrm);
  end;

  -- -------------------------------------------------------------------
  -- 7. COMBIEN DE LIGNES DANS LES TABLES CONCERNÉES
  -- -------------------------------------------------------------------
  begin
    execute 'select count(*) from ticket_offers' into n;
    insert into diag_out values (7, '7. donnees', 'ticket_offers', n || ' ligne(s)');
    execute 'select count(*) from reservations' into n;
    insert into diag_out values (7, '7. donnees', 'reservations', n || ' ligne(s)');
    execute 'select count(*) from matches' into n;
    insert into diag_out values (7, '7. donnees', 'matches', n || ' ligne(s)');
  exception when others then
    insert into diag_out values (7, '7. donnees', 'ERREUR', sqlerrm);
  end;

end $$;

-- Le seul SELECT du script : c'est lui que l'editeur affichera.
select bloc, cle, valeur from diag_out order by ord, cle;
