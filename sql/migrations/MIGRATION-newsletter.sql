-- =====================================================================
-- NEWSLETTER — journal des envois (à exécuter une fois dans Supabase)
--
-- La table garde la trace de chaque envoi : sujet, message, nombre de
-- destinataires, réussites et échecs. Seuls les administrateurs la
-- voient. Réexécutable sans risque.
-- =====================================================================

create table if not exists newsletter_sends (
  id         uuid primary key default gen_random_uuid(),
  subject    text not null,
  body       text not null,
  recipients integer not null default 0,
  sent       integer not null default 0,
  failed     integer not null default 0,
  created_at timestamptz not null default now()
);

alter table newsletter_sends enable row level security;

drop policy if exists newsletter_sends_admin on newsletter_sends;
create policy newsletter_sends_admin on newsletter_sends
  for all using (is_admin()) with check (is_admin());
