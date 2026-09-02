-- =====================================================================
--  Baobabs Basket Club — Migration : MODULE CANDIDATURES (refonte admin)
--  À exécuter une fois dans Supabase : SQL Editor → New query → Run.
--  Idempotent : réexécutable sans risque.
--
--  Ce que ça pose :
--    1. Le nouveau cycle de vie des candidatures (8 statuts)
--    2. Reprise des anciens statuts vers les nouveaux
--    3. Journal du dossier — qui a changé quoi, quand
--    4. Pièces jointes (CV, certificat médical, vidéos…)
--    5. Colonnes de suivi : responsable, date d'entretien, mise à jour
--
--  Les colonnes status, rating et admin_notes existent déjà : on ne les
--  recrée pas, on les complète.
-- =====================================================================


-- =====================================================================
-- 1. COLONNES DE SUIVI
-- =====================================================================
alter table recruitment_requests
  add column if not exists updated_at    timestamptz,
  add column if not exists assigned_to   text,        -- qui suit le dossier
  add column if not exists interview_at  timestamptz, -- entretien programmé
  add column if not exists decision_note text;        -- motif de la décision

-- Mise à jour automatique de updated_at à chaque modification.
create or replace function bbc_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists recruitment_touch on recruitment_requests;
create trigger recruitment_touch
  before update on recruitment_requests
  for each row execute function bbc_touch_updated_at();


-- =====================================================================
-- 2. NOUVEAU CYCLE DE VIE
--    Ancien : nouvelle · preselection · convoquee · retenue · refusee
--    Nouveau : nouvelle · a_etudier · a_revoir · entretien · en_attente
--              · acceptee · refusee · archivee
--    On reprend les valeurs existantes pour ne perdre aucun dossier.
-- =====================================================================
update recruitment_requests set status = 'a_etudier' where status = 'preselection';
update recruitment_requests set status = 'entretien'  where status = 'convoquee';
update recruitment_requests set status = 'acceptee'   where status = 'retenue';
update recruitment_requests set status = 'refusee'    where status = 'refusee';
update recruitment_requests set status = 'nouvelle'   where status is null or status = '';

-- Filet de sécurité : toute valeur héritée ou saisie à la main qui ne fait
-- pas partie du nouveau cycle est ramenée à « nouvelle ». Sans cette ligne,
-- la contrainte ci-dessous échouerait et annulerait tout le script.
update recruitment_requests set status = 'nouvelle'
 where status not in (
   'nouvelle','a_etudier','a_revoir','entretien','en_attente',
   'acceptee','refusee','archivee'
 );

-- Garde-fou : on refuse une valeur de statut inconnue, pour éviter que
-- l'espace de gestion et la base divergent silencieusement.
alter table recruitment_requests drop constraint if exists recruitment_status_check;
alter table recruitment_requests
  add constraint recruitment_status_check check (status in (
    'nouvelle','a_etudier','a_revoir','entretien','en_attente',
    'acceptee','refusee','archivee'
  ));

alter table recruitment_requests
  alter column status set default 'nouvelle';

create index if not exists recruitment_status_idx on recruitment_requests (status);


-- =====================================================================
-- 3. JOURNAL DU DOSSIER
--    Chaque changement de statut et chaque note laissent une trace.
--    C'est ce qui permet de travailler à plusieurs sur un recrutement.
-- =====================================================================
create table if not exists recruitment_events (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references recruitment_requests(id) on delete cascade,
  kind        text not null check (kind in ('statut','note','entretien','document','creation')),
  from_status text,
  to_status   text,
  body        text,
  author      text,
  created_at  timestamptz not null default now()
);

create index if not exists recruitment_events_request_idx
  on recruitment_events (request_id, created_at desc);

alter table recruitment_events enable row level security;

drop policy if exists recruitment_events_admin_all on recruitment_events;
create policy recruitment_events_admin_all on recruitment_events
  for all using (is_admin()) with check (is_admin());


-- =====================================================================
-- 4. PIÈCES JOINTES
--    CV, certificat médical, licence, vidéos. Les fichiers vivent dans le
--    bucket site-media ; cette table garde l'inventaire et le libellé.
-- =====================================================================
create table if not exists recruitment_documents (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references recruitment_requests(id) on delete cascade,
  label      text not null,
  url        text not null,
  kind       text default 'autre'
             check (kind in ('cv','medical','licence','video','photo','autre')),
  created_at timestamptz not null default now()
);

create index if not exists recruitment_documents_request_idx
  on recruitment_documents (request_id);

alter table recruitment_documents enable row level security;

drop policy if exists recruitment_documents_admin_all on recruitment_documents;
create policy recruitment_documents_admin_all on recruitment_documents
  for all using (is_admin()) with check (is_admin());

-- PAS de policy d'insertion publique ici. Le formulaire de candidature du site
-- n'envoie aucun document pour l'instant : ouvrir l'écriture en anonyme
-- permettrait à n'importe quel visiteur d'attacher un lien arbitraire au
-- dossier d'une vraie candidate, sous une étiquette de confiance (« CV »).
-- Le jour où le formulaire collectera un CV, ce dépôt passera par une fonction
-- security definer qui vérifie le dossier visé — comme bbc_reserver() pour la
-- billetterie — et non par une policy à WITH CHECK (true).
-- La policy admin ci-dessus couvre tous les appelants existants.


-- =====================================================================
-- 5. CHANGER UN STATUT — passe toujours par ici, pour que le journal
--    soit écrit dans la même transaction que le changement.
-- =====================================================================
create or replace function bbc_recrutement_statut(
  p_request_id uuid,
  p_status     text,
  p_note       text default null,
  p_author     text default null
)
returns recruitment_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row  recruitment_requests%rowtype;
  v_from text;
begin
  if not is_admin() then raise exception 'non_autorise'; end if;

  select status into v_from from recruitment_requests where id = p_request_id;
  if not found then raise exception 'candidature_introuvable'; end if;

  update recruitment_requests
     set status = p_status,
         decision_note = coalesce(p_note, decision_note)
   where id = p_request_id
   returning * into v_row;

  insert into recruitment_events (request_id, kind, from_status, to_status, body, author)
  values (p_request_id, 'statut', v_from, p_status, p_note, p_author);

  return v_row;
end;
$$;

revoke all on function bbc_recrutement_statut(uuid, text, text, text) from public;
grant execute on function bbc_recrutement_statut(uuid, text, text, text) to authenticated;


-- =====================================================================
-- 6. VUE DE TRAVAIL — une ligne par candidature, enrichie de ce qui
--    est utile dans la liste sans avoir à ouvrir chaque dossier.
-- =====================================================================
create or replace view candidatures_admin as
select
  r.*,
  trim(coalesce(r.first_name,'') || ' ' || coalesce(r.last_name,'')) as full_name,
  case when r.birth_date is not null
       then extract(year from age(r.birth_date))::int end            as age,
  (select count(*) from recruitment_documents d where d.request_id = r.id) as nb_documents,
  (select count(*) from recruitment_events  e where e.request_id = r.id)   as nb_events,
  (select max(e.created_at) from recruitment_events e where e.request_id = r.id) as last_event_at,
  extract(epoch from (now() - r.created_at)) / 86400                  as jours_depuis_reception
from recruitment_requests r;

alter view candidatures_admin set (security_invoker = on);


-- =====================================================================
--  OPTIONNEL — ALERTE E-MAIL À L'ARRIVÉE D'UNE CANDIDATURE
--  Ne se fait pas en SQL pur. Deux minutes dans l'interface Supabase :
--    Database → Webhooks → Create a new hook
--      Table  : recruitment_requests
--      Events : Insert
--      Type   : HTTP Request (ou Send email via une fonction Edge)
--  Renseignez l'adresse du bureau comme destinataire.
--  Sans ça, un dossier peut dormir plusieurs semaines.
-- =====================================================================


-- =====================================================================
--  Vérification après exécution :
--    select status, count(*) from recruitment_requests group by status;
--    select * from candidatures_admin order by created_at desc limit 5;
-- =====================================================================
