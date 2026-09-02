-- =====================================================================
--  Baobabs Basket Club — PHASE 0, DERNIÈRE DETTE : LES DROITS EN BASE
--  17 août 2026 — à passer APRÈS MIGRATION-phase0-socle.sql
--  Idempotent. Aucune donnée supprimée.
--
--  CE QUI MANQUE AUJOURD'HUI
--  Les rôles rangent l'écran d'administration : un coach ne voit pas
--  l'entrée Boutique. Mais au niveau de la base, tout compte présent
--  dans admin_users garde l'accès complet — la porte est retirée du
--  couloir, elle n'est pas fermée à clé. Tant que les deux seuls
--  comptes sont super administrateurs, c'est théorique. Le jour où un
--  coach a le sien, ça ne l'est plus.
--
--  LE PÉRIMÈTRE, ET POURQUOI IL EST PLUS PETIT QU'ON NE CROIRAIT
--  Les politiques d'une table se cumulent en OU. Pour durcir, il faut
--  donc effacer les anciennes — et une table peut porter des règles qui
--  n'ont rien à voir avec l'administration.
--
--  En relevant tous les appels de index.html, trois tables se sont
--  révélées porteuses de règles CLIENT qu'un durcissement aveugle
--  aurait détruites, éteignant « Mon espace » :
--
--    customers     — le client lit et crée sa propre fiche
--    orders        — le client relit ses propres commandes
--    reservations  — le client consulte ses billets (vue mes_reservations)
--
--  Elles ne sont donc PAS touchées ici. Leurs politiques existantes ne
--  sont pas lisibles depuis l'extérieur ; les réécrire à l'aveugle
--  reviendrait à parier sur leur contenu. Elles feront l'objet d'un
--  passage dédié, après lecture de pg_policies dans le SQL Editor.
--
--  Restent les tables purement internes, celles qu'aucun visiteur ni
--  aucun client ne lit jamais. C'est déjà l'essentiel du sujet : les
--  dossiers de mineurs, les candidatures, les messages et les réglages.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. PRÉALABLE INDISPENSABLE
--    Une politique qui appelle une fonction non exécutable par le rôle
--    courant ne renvoie pas « faux » : elle fait échouer toute la
--    requête. anon doit pouvoir appeler bbc_can, qui lui répondra non.
-- ---------------------------------------------------------------------
grant execute on function bbc_role()            to anon, authenticated;
grant execute on function bbc_can(text,text)    to anon, authenticated;
grant execute on function bbc_est_super_admin() to anon, authenticated;
grant execute on function is_admin()            to anon, authenticated;


-- ---------------------------------------------------------------------
-- Outils
-- ---------------------------------------------------------------------
create or replace function bbc_vider_policies(p_table text)
returns void language plpgsql as $$
declare p record;
begin
  for p in select policyname from pg_policies
            where schemaname = 'public' and tablename = p_table
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p_table);
  end loop;
end $$;

create or replace function bbc_policies_module(p_table text, p_module text)
returns void language plpgsql as $$
begin
  if to_regclass('public.'||p_table) is null then return; end if;
  execute format('alter table public.%I enable row level security', p_table);
  perform bbc_vider_policies(p_table);
  execute format('create policy %I on public.%I for select using (bbc_can(%L,''voir''))',
                 p_table||'_voir', p_table, p_module);
  execute format('create policy %I on public.%I for insert with check (bbc_can(%L,''creer''))',
                 p_table||'_creer', p_table, p_module);
  execute format('create policy %I on public.%I for update using (bbc_can(%L,''modifier'')) with check (bbc_can(%L,''modifier''))',
                 p_table||'_modifier', p_table, p_module, p_module);
  execute format('create policy %I on public.%I for delete using (bbc_can(%L,''supprimer''))',
                 p_table||'_supprimer', p_table, p_module);
end $$;


-- ---------------------------------------------------------------------
-- 1. L'ÉCOLE DE BASKET
--    Des dossiers de mineurs : dates de naissance, notes de santé,
--    téléphones de parents, pièces d'identité. C'est ce qu'il y a de
--    plus sensible dans toute la base.
--    Le formulaire public écrit par bbc_inscription(), une fonction
--    « security definer » qui passe outre ces règles : le dépôt continue
--    de fonctionner sans qu'aucune porte reste ouverte.
-- ---------------------------------------------------------------------
select bbc_policies_module('academy_registrations','inscriptions');
select bbc_policies_module('academy_payments',     'inscriptions');
select bbc_policies_module('academy_documents',    'inscriptions');
select bbc_policies_module('academy_events',       'inscriptions');


-- ---------------------------------------------------------------------
-- 2. LE RECRUTEMENT ET LA BOÎTE DE RÉCEPTION
--    Principe de la boîte aux lettres : tout le monde peut y glisser une
--    lettre, seul le club l'ouvre. L'insertion anonyme est donc
--    explicitement conservée, la lecture explicitement fermée.
-- ---------------------------------------------------------------------
select bbc_policies_module('recruitment_requests','recrutement');
create policy recruitment_depot_public on recruitment_requests
  for insert to anon, authenticated with check (true);

select bbc_policies_module('recruitment_events',   'recrutement');
select bbc_policies_module('recruitment_documents','recrutement');

select bbc_policies_module('contact_messages','contenu');
create policy contact_depot_public on contact_messages
  for insert to anon, authenticated with check (true);

select bbc_policies_module('newsletter_subscribers','contenu');
create policy newsletter_depot_public on newsletter_subscribers
  for insert to anon, authenticated with check (true);


-- ---------------------------------------------------------------------
-- 3. LES RÉGLAGES
--    La lecture reste publique : sans elle le site perd ses textes, ses
--    tarifs et ses coordonnées. Seule l'écriture se referme.
-- ---------------------------------------------------------------------
alter table site_settings enable row level security;
select bbc_vider_policies('site_settings');
create policy site_settings_lecture_publique on site_settings for select using (true);
create policy site_settings_ecriture on site_settings
  for all using (bbc_can('reglages','modifier')) with check (bbc_can('reglages','modifier'));


-- ---------------------------------------------------------------------
-- 4. LES COMPTES
--    Distribuer les casquettes est le privilège d'un seul rôle. La
--    lecture reste ouverte aux administrateurs : l'écran Comptes doit
--    pouvoir afficher la liste.
-- ---------------------------------------------------------------------
alter table admin_users enable row level security;
select bbc_vider_policies('admin_users');
create policy admin_users_lecture on admin_users for select using (is_admin());
create policy admin_users_ecriture on admin_users
  for all using (bbc_est_super_admin()) with check (bbc_est_super_admin());


-- =====================================================================
--  VÉRIFICATIONS — dans l'ordre, et la dernière est la seule qui prouve
--
--  a) LE SITE PUBLIC DOIT SURVIVRE. Rechargez l'accueil, Équipes,
--     Inscriptions, et déposez une inscription de test. Puis, si vous
--     avez un compte client, ouvrez « Mon espace ».
--
--  b) VOUS DEVEZ TOUT VOIR COMME AVANT (vous êtes super administrateur) :
--       select count(*) from academy_registrations;
--       select count(*) from recruitment_requests;
--
--  c) L'ANONYME NE DOIT RIEN VOIR — doit répondre [] :
--       curl -s "https://lmwbwasupqkvswukieav.supabase.co/rest/v1/academy_registrations?select=*" \
--         -H "apikey: sb_publishable_68RKprorqTmVkzjHrKgdZw_h-AcMXRh"
--
--  d) LA SEULE PREUVE QUI COMPTE : passez un compte en « Coach » dans
--     l'écran Comptes & rôles, connectez-vous avec, et lancez
--       select count(*) from academy_registrations;
--     Il doit renvoyer 0. À ce moment-là seulement, la porte est fermée
--     à clé et plus seulement retirée du couloir.
--
--
--  CE QUI RESTE À FAIRE APRÈS, ET QUI DEMANDE VOS YEUX
--  customers, orders et reservations portent des règles client que je
--  ne peux pas lire d'ici. Lancez ceci dans le SQL Editor et envoyez-moi
--  le résultat : j'écrirai le durcissement sans rien casser.
--
--    select tablename, policyname, cmd, qual, with_check
--      from pg_policies
--     where schemaname = 'public'
--       and tablename in ('customers','orders','reservations','ticket_offers','favorites')
--     order by tablename, policyname;
-- =====================================================================
