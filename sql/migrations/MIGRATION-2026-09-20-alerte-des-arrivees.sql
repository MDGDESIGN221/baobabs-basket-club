-- =====================================================================
--  L'ALERTE DES ARRIVEES : UN E-MAIL AU CLUB, MEME ADMIN FERMEE
--  --------------------------------------------------------------------
--  « y'a moyen d'etre averti par mail quand je ne suis pas connecte sur
--    l'admin pour me prevenir des nouvelles ? » (20 septembre 2026)
--
--  Ce qui existait : alerte-inscription, deployee le 26 aout dans son
--  ancienne version, sans aucun declencheur qui l'appelle (le webhook
--  devait etre pose dans le tableau de bord, il ne l'a jamais ete : les
--  inscriptions du 18 septembre ont alerte_envoyee_le a null). Seule la
--  confirmation de commande AU CLIENT a son webhook.
--
--  Ce qu'on pose : un declencheur SQL par table, dans la base, avec le
--  meme mecanisme que le webhook des commandes (supabase_functions.
--  http_request), vers UNE fonction generique, alerte-arrivee. Les
--  en-tetes (jeton du role service) sont COPIES du declencheur existant
--  au moment de l'execution : ils ne sont ecrits nulle part dans le
--  depot, qui est public.
--
--  Deux tables de service, lisibles par le role service seulement :
--    bbc_config         cle / valeur ; la cle alerte_email porte la ou
--                       les adresses (virgules). Posee a la main, pas
--                       ici : le depot est public.
--    alertes_envoyees   une ligne par alerte partie : une arrivee ne
--                       declenche qu'un e-mail, meme si le declencheur
--                       est rejoue.
--
--  A EXECUTER DANS L'EDITEUR SQL DE SUPABASE (ou par le MCP), APRES le
--  deploiement de la fonction alerte-arrivee.
-- =====================================================================

create table if not exists public.bbc_config (
  cle    text primary key,
  valeur text,
  maj    timestamptz not null default now()
);
comment on table public.bbc_config is
  'Reglages lus par les fonctions serveur (role service). Pas de politique '
  'RLS : ni anon ni authenticated n''y lisent rien.';
alter table public.bbc_config enable row level security;
revoke all on public.bbc_config from anon, authenticated;

create table if not exists public.alertes_envoyees (
  table_name text not null,
  ligne_id   uuid not null,
  envoye_le  timestamptz not null default now(),
  primary key (table_name, ligne_id)
);
comment on table public.alertes_envoyees is
  'Une ligne par alerte e-mail partie (alerte-arrivee). La fonction s''y '
  'inscrit avant d''envoyer : une cle deja prise, et elle se tait.';
alter table public.alertes_envoyees enable row level security;
revoke all on public.alertes_envoyees from anon, authenticated;

-- ---------------------------------------------------------------------
--  LES DECLENCHEURS
--  Les joueuses et le staff ne partent que pour un profil DEPOSE par un
--  lien de collecte (fiche_etat = 'recue') : une fiche saisie a la main
--  dans l'admin n'a pas a etre annoncee a celui qui la saisit.
-- ---------------------------------------------------------------------
do $$
declare
  entetes text;
  url     text := 'https://lmwbwasupqkvswukieav.supabase.co/functions/v1/alerte-arrivee';
  t       text;
  cond    text;
begin
  -- les en-tetes du webhook existant : le troisieme argument du declencheur
  select (string_to_array(encode(t.tgargs, 'escape'), E'\\000'))[3]
    into entetes
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where c.relname = 'orders' and t.tgname = 'order-confirmation-webhook';
  if entetes is null or entetes !~ 'Authorization' then
    raise exception 'en-tetes du webhook des commandes introuvables : rien n''est pose';
  end if;

  foreach t in array array['recruitment_requests','academy_registrations','orders',
                           'contact_messages','players','staff']
  loop
    cond := case when t in ('players','staff') then ' when (new.fiche_etat = ''recue'')' else '' end;
    execute format('drop trigger if exists bbc_alerte_arrivee on public.%I', t);
    execute format(
      'create trigger bbc_alerte_arrivee after insert on public.%I for each row%s '
      'execute function supabase_functions.http_request(%L, %L, %L, %L, %L)',
      t, cond, url, 'POST', entetes, '{}', '5000');
  end loop;
end $$;

-- VERIFICATIONS
--   select event_object_table, trigger_name from information_schema.triggers
--    where trigger_name = 'bbc_alerte_arrivee' order by 1;
--   -- attendu : six lignes
--
--   insert into public.bbc_config (cle, valeur) values ('alerte_email', 'adresse1, adresse2')
--   on conflict (cle) do update set valeur = excluded.valeur, maj = now();
--   -- a faire a la main, puis : deposer un message de contact d'essai,
--   -- verifier alertes_envoyees et la boite, supprimer l'essai.
