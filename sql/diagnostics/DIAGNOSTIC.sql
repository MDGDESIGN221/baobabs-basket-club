-- =====================================================================
--  Baobabs Basket Club — DIAGNOSTIC (une seule requête)
--  Supabase → SQL Editor → New query → Run. Ne modifie RIEN.
--
--  Supabase n'affiche que le résultat de la DERNIÈRE requête : d'où
--  cette version en une seule instruction.
--
--  Copiez-moi le tableau complet.
-- =====================================================================

select
  table_name  as "table",
  string_agg(column_name, ', ' order by ordinal_position) as "colonnes"
from information_schema.columns
where table_schema = 'public'
  and table_name in ('orders','customers','reservations')
group by table_name
order by table_name;
