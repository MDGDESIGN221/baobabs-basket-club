-- =====================================================================
--  Baobabs — LA SERRURE EST-ELLE BIEN POSÉE ?
--  À coller dans le SQL Editor de Supabase. Ne modifie rien, ne lit que.
--
--  ⚠️  CE QUE CETTE REQUÊTE PROUVE, ET CE QU'ELLE NE PROUVE PAS
--
--    Elle prouve que les RÈGLES sont installées : les déclencheurs, les
--    politiques, la bonne adresse protégée.
--
--    Elle ne prouve PAS que la serrure ferme. Dans le SQL Editor,
--    auth.uid() est NULL — c'est l'échappatoire volontaire du script,
--    donc ici tout passe, et c'est normal. La seule preuve du
--    comportement est en bas de ce fichier, et elle demande un second
--    compte.
-- =====================================================================

select
  '1. Déclencheurs' as controle,
  coalesce(string_agg(tgname, ', ' order by tgname), '(aucun)') as trouve,
  case when count(*) = 2 then 'OK'
       else 'MANQUE — relancez MIGRATION-phase2c-compte-proprietaire.sql' end as verdict
from pg_trigger
where tgrelid = 'admin_users'::regclass and not tgisinternal

union all

select
  '2. Politiques',
  coalesce(string_agg(policyname || ' (' || cmd || ')', ', ' order by policyname), '(aucune)'),
  case when count(*) = 4 then 'OK'
       else 'ATTENDU 4 — lecture, creation, modif, suppr' end
from pg_policies
where tablename = 'admin_users'

union all

select
  '3. Adresse protégée',
  bbc_proprietaire_email(),
  case when exists (select 1 from admin_users where lower(email) = bbc_proprietaire_email())
       then 'OK — ce compte existe bien'
       else 'INTROUVABLE — la protection ne protège rien' end

union all

select
  '4. Super administrateurs',
  coalesce(string_agg(email, ', ' order by email), '(aucun)'),
  case when count(*) = 0 then 'AUCUN — plus personne ne peut attribuer de rôle'
       when count(*) = 1 then 'OK — un seul'
       else 'OK — ' || count(*)::text || ', dont un seul est protégé' end
from admin_users
where role = 'super_admin'

union all

select
  '5. Fonctions',
  string_agg(proname, ', ' order by proname),
  case when count(*) = 2 then 'OK' else 'MANQUE' end
from pg_proc
where proname in ('bbc_proprietaire_email', 'bbc_est_proprietaire')

order by 1;


-- =====================================================================
--  LA PREUVE DU COMPORTEMENT — elle ne se fait pas ici
--
--  1. Écran Comptes & rôles : passez temporairement un autre compte en
--     « Administration » (super administrateur).
--  2. Déconnectez-vous. Reconnectez-vous AVEC CE COMPTE-LÀ.
--  3. Ouvrez Comptes & rôles, entrez le mot de passe.
--
--     Attendu : tous les comptes ont leur menu déroulant, SAUF
--     mdgdesign221@gmail.com qui affiche « 🔒 Compte protégé ».
--
--  4. Pour aller plus loin, essayez de contourner l'écran — c'est le
--     scénario contre lequel la serrure a été posée. Depuis la console
--     du navigateur, connecté avec CE second compte :
--
--       await (await fetch(
--         'https://lmwbwasupqkvswukieav.supabase.co/rest/v1/admin_users'
--         + '?email=eq.mdgdesign221@gmail.com',
--         { method:'PATCH',
--           headers:{ 'apikey': SUPABASE_KEY,
--                     'Authorization': 'Bearer ' + (await sb.auth.getSession()).data.session.access_token,
--                     'Content-Type':'application/json',
--                     'Prefer':'return=representation' },
--           body: JSON.stringify({ role:'coach' }) })).text()
--
--     Attendu : [] ou une erreur — jamais la ligne modifiée. Puis
--     revérifiez le rôle dans l'écran : il n'a pas bougé.
--
--  5. Remettez ce second compte à son rôle normal.
-- =====================================================================
