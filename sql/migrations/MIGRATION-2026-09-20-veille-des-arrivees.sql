-- =====================================================================
--  LA VEILLE DES ARRIVEES : LES SEPT TABLES PASSENT EN TEMPS REEL
--  --------------------------------------------------------------------
--  « si je m'y trouve et une inscription ou candidature arrive je dois
--    etre prevenu par MAYA » (20 septembre 2026).
--
--  L'admin s'abonne aux insertions (postgres_changes) de ces tables.
--  Supabase ne diffuse que les tables de la publication
--  supabase_realtime ; jusqu'ici seule match_live y etait (le score en
--  direct du site). Les droits de lecture (RLS) restent ceux des
--  tables : un abonne ne recoit que les lignes qu'il pourrait lire.
--
--  Sans cette migration, l'admin ne casse pas : sa ronde de soixante
--  secondes relit les tables et annonce quand meme, avec une minute de
--  retard au plus.
--
--  A EXECUTER DANS L'EDITEUR SQL DE SUPABASE (ou par le MCP).
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array['recruitment_requests','academy_registrations','orders',
                           'contact_messages','newsletter_subscribers','players','staff']
  loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- VERIFICATION
--   select tablename from pg_publication_tables
--    where pubname = 'supabase_realtime' order by 1;
--   -- attendu : les sept tables ci-dessus, plus match_live
