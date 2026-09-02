-- =====================================================================
--  Baobabs Basket Club — Migration : ÉCOLE DE BASKET / INSCRIPTIONS
--  À exécuter une fois dans Supabase : SQL Editor → New query → Run.
--  Idempotent : réexécutable sans risque, aucune donnée supprimée.
--
--  Prérequis (déjà livrés) : la fonction is_admin() de
--  MIGRATION-comptes-clients.sql et la table site_settings.
--
--  Ce que ça pose :
--    1. Le dossier d'inscription d'un enfant (academy_registrations)
--    2. Le suivi de l'argent — frais d'inscription et mensualités
--       (academy_payments), une ligne par versement encaissé
--    3. Le journal du dossier (academy_events), écrit par la base
--       elle-même : ni l'admin ni le site ne peuvent l'oublier
--    4. bbc_inscription() — le SEUL chemin d'écriture ouvert au public
--    5. La vue de travail inscriptions_admin (âge, reste à payer…)
--    6. Les réglages du site : tarifs, catégories, dates, vidéo
--
--  POURQUOI UNE TABLE SÉPARÉE DES CANDIDATURES
--  Une candidature de joueuse (recruitment_requests) et l'inscription
--  d'un enfant à l'école de basket ne se ressemblent que de loin : ici
--  on parle d'un parent responsable, d'un tarif, de mensualités à
--  encaisser tous les mois. Mélanger les deux aurait donné un écran où
--  la moitié des champs est vide une fois sur deux.
-- =====================================================================


-- =====================================================================
-- 1. LE DOSSIER D'INSCRIPTION
--    Les montants sont recopiés dans le dossier au moment de
--    l'inscription (fee_registration_fcfa / fee_monthly_fcfa) plutôt
--    que lus dans les réglages à l'affichage : si le club augmente son
--    tarif en janvier, les enfants inscrits en septembre gardent le
--    prix auquel ils se sont engagés. Un tarif est une promesse faite
--    à une date — la base doit s'en souvenir.
-- =====================================================================
create table if not exists academy_registrations (
  id                     uuid primary key default gen_random_uuid(),
  reference              text unique not null,

  -- L'enfant
  child_first_name       text not null,
  child_last_name        text not null,
  birth_date             date,
  gender                 text,
  category               text,               -- U9, U11, U13… libellé libre
  school                 text,               -- établissement scolaire
  district               text,               -- quartier / ville

  -- Le responsable légal — c'est lui qu'on appelle, pas l'enfant
  guardian_name          text not null,
  guardian_relation      text,               -- Mère, Père, Tuteur…
  guardian_phone         text not null,
  guardian_phone2        text,
  guardian_email         text,

  -- Le reste du dossier
  health_notes           text,
  experience             text,
  message                text,
  photo_url              text,

  -- Suivi interne
  status                 text not null default 'nouvelle',
  fee_registration_fcfa  integer not null default 20000,
  fee_monthly_fcfa       integer not null default 5000,
  assigned_to            text,
  decision_note          text,
  admin_notes            text,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz
);

-- Le cycle de vie d'une inscription. « essai » existe parce qu'un club
-- fait presque toujours essayer une séance avant d'encaisser quoi que
-- ce soit ; sans ce statut, l'enfant reste « nouvelle » pendant trois
-- semaines et personne ne sait où il en est.
alter table academy_registrations drop constraint if exists academy_status_check;
update academy_registrations set status = 'nouvelle'
 where status is null or status not in (
   'nouvelle','contactee','essai','inscrite','en_pause','refusee','archivee'
 );
alter table academy_registrations
  add constraint academy_status_check check (status in (
    'nouvelle','contactee','essai','inscrite','en_pause','refusee','archivee'
  ));

alter table academy_registrations drop constraint if exists academy_gender_check;
alter table academy_registrations
  add constraint academy_gender_check check (gender is null or gender in ('F','M'));

create index if not exists academy_status_idx   on academy_registrations (status);
create index if not exists academy_created_idx  on academy_registrations (created_at desc);
create index if not exists academy_category_idx on academy_registrations (category);
create index if not exists academy_phone_idx    on academy_registrations (guardian_phone);

alter table academy_registrations enable row level security;

-- Aucune lecture publique : un dossier contient la date de naissance
-- d'un mineur, le téléphone de ses parents et des notes de santé. Rien
-- de tout cela ne sort de l'admin.
drop policy if exists academy_registrations_admin on academy_registrations;
create policy academy_registrations_admin on academy_registrations
  for all using (is_admin()) with check (is_admin());


-- =====================================================================
-- 2. LES VERSEMENTS
--    Une ligne = un encaissement réel. On ne stocke jamais « a payé
--    3 mois » dans le dossier : on stocke les trois versements, et le
--    « 3 » se recalcule. C'est la seule façon de répondre plus tard à
--    « quel mois manque-t-il ? » sans deviner.
-- =====================================================================
create table if not exists academy_payments (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null references academy_registrations(id) on delete cascade,
  kind            text not null check (kind in ('inscription','mensualite','autre')),
  period          text,                      -- 'AAAA-MM' pour une mensualité
  amount_fcfa     integer not null check (amount_fcfa >= 0),
  method          text not null default 'especes'
                  check (method in ('especes','wave','orange_money','free_money','virement','autre')),
  paid_on         date not null default current_date,
  note            text,
  author          text,
  created_at      timestamptz not null default now()
);

create index if not exists academy_payments_reg_idx
  on academy_payments (registration_id, paid_on desc);

-- Garde-fou contre le double encaissement : un mois donné ne peut être
-- enregistré qu'une fois par enfant, et les frais d'inscription qu'une
-- seule fois tout court. Deux personnes au bureau, deux reçus, une même
-- somme saisie deux fois : c'est ici que ça s'arrête.
create unique index if not exists academy_payments_mois_uidx
  on academy_payments (registration_id, period) where kind = 'mensualite';
create unique index if not exists academy_payments_inscription_uidx
  on academy_payments (registration_id) where kind = 'inscription';

-- Une mensualité sans mois n'est pas exploitable : on l'exige.
alter table academy_payments drop constraint if exists academy_payments_periode_check;
alter table academy_payments
  add constraint academy_payments_periode_check
  check (kind <> 'mensualite' or (period is not null and period ~ '^\d{4}-\d{2}$'));

alter table academy_payments enable row level security;

drop policy if exists academy_payments_admin on academy_payments;
create policy academy_payments_admin on academy_payments
  for all using (is_admin()) with check (is_admin());


-- =====================================================================
-- 3. LE JOURNAL DU DOSSIER
--    Écrit par des déclencheurs, pas par l'interface. Une trace qu'un
--    écran peut oublier d'écrire n'est pas une trace : c'est un espoir.
-- =====================================================================
create table if not exists academy_events (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null references academy_registrations(id) on delete cascade,
  kind            text not null check (kind in ('statut','note','paiement','creation')),
  from_status     text,
  to_status       text,
  body            text,
  author          text,
  created_at      timestamptz not null default now()
);

create index if not exists academy_events_reg_idx
  on academy_events (registration_id, created_at desc);

alter table academy_events enable row level security;

drop policy if exists academy_events_admin on academy_events;
create policy academy_events_admin on academy_events
  for all using (is_admin()) with check (is_admin());


-- Qui agit : l'e-mail du compte connecté, ou « site » quand le geste
-- vient du formulaire public (aucune session).
create or replace function bbc_academy_acteur()
returns text language sql stable as $$
  select coalesce(nullif(auth.jwt() ->> 'email', ''), 'site');
$$;

create or replace function bbc_academy_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists academy_touch on academy_registrations;
create trigger academy_touch
  before update on academy_registrations
  for each row execute function bbc_academy_touch();

-- Changement de statut → une ligne au journal, dans la même
-- transaction que le changement lui-même.
create or replace function bbc_academy_log_statut()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into academy_events (registration_id, kind, from_status, to_status, body, author)
    values (new.id, 'statut', old.status, new.status, new.decision_note, bbc_academy_acteur());
  end if;
  return new;
end;
$$;

drop trigger if exists academy_log_statut on academy_registrations;
create trigger academy_log_statut
  after update on academy_registrations
  for each row execute function bbc_academy_log_statut();

-- Encaissement → une ligne au journal, en toutes lettres.
create or replace function bbc_academy_log_paiement()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_txt text;
begin
  v_txt := case new.kind
             when 'inscription' then 'Frais d''inscription'
             when 'mensualite'  then 'Mensualité ' || coalesce(new.period, '')
             else 'Versement'
           end
        || ' — ' || new.amount_fcfa || ' FCFA (' || new.method || ')';
  insert into academy_events (registration_id, kind, body, author)
  values (new.registration_id, 'paiement', v_txt,
          coalesce(new.author, bbc_academy_acteur()));
  return new;
end;
$$;

drop trigger if exists academy_log_paiement on academy_payments;
create trigger academy_log_paiement
  after insert on academy_payments
  for each row execute function bbc_academy_log_paiement();


-- =====================================================================
-- 4. LE SEUL CHEMIN D'ÉCRITURE OUVERT AU PUBLIC
--    Pas de policy d'INSERT en anonyme : le formulaire du site appelle
--    cette fonction, qui décide seule de ce qui entre en base. Le
--    visiteur ne choisit ni son statut, ni son tarif, ni sa référence.
--    Elle ne renvoie que la référence — jamais la ligne complète, qui
--    contiendrait les coordonnées telles qu'enregistrées.
-- =====================================================================
create or replace function bbc_reference_inscription()
returns text language sql as $$
  -- 5 caractères sans I/O/0/1 : une référence se lit au téléphone.
  select 'INS-' || string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
           floor(random() * 32 + 1)::int, 1), '')
  from generate_series(1, 5);
$$;

create or replace function bbc_inscription(
  p_child_first       text,
  p_child_last        text,
  p_birth_date        date    default null,
  p_gender            text    default null,
  p_category          text    default null,
  p_school            text    default null,
  p_district          text    default null,
  p_guardian_name     text    default null,
  p_guardian_relation text    default null,
  p_guardian_phone    text    default null,
  p_guardian_phone2   text    default null,
  p_guardian_email    text    default null,
  p_health            text    default null,
  p_experience        text    default null,
  p_message           text    default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref      text;
  v_tries    int := 0;
  v_id       uuid;
  v_ouvert   text;
  v_frais    integer;
  v_mens     integer;
  v_first    text := nullif(btrim(p_child_first), '');
  v_last     text := nullif(btrim(p_child_last), '');
  v_gname    text := nullif(btrim(p_guardian_name), '');
  v_gphone   text := nullif(btrim(p_guardian_phone), '');
  v_double   text;
begin
  -- Le club peut fermer les inscriptions depuis l'admin. Sans ce test,
  -- fermer le formulaire côté site n'empêcherait rien : il suffirait
  -- d'appeler la fonction directement.
  select value into v_ouvert from site_settings where key = 'ins_open';
  if coalesce(v_ouvert, 'oui') = 'non' then
    raise exception 'inscriptions_fermees';
  end if;

  if v_first is null or v_last is null then raise exception 'nom_enfant_requis'; end if;
  if v_gname is null then raise exception 'responsable_requis'; end if;
  if v_gphone is null then raise exception 'telephone_requis'; end if;
  if p_gender is not null and p_gender not in ('F','M') then
    raise exception 'sexe_invalide';
  end if;

  -- Anti double-clic : la même inscription renvoyée deux fois en moins
  -- de dix minutes rend la première référence au lieu de créer un
  -- doublon que quelqu'un devra trier à la main.
  select reference into v_double
    from academy_registrations
   where guardian_phone = v_gphone
     and lower(child_first_name) = lower(v_first)
     and lower(child_last_name)  = lower(v_last)
     and created_at > now() - interval '10 minutes'
   limit 1;
  if v_double is not null then return v_double; end if;

  -- Le tarif en vigueur au moment de l'inscription, gelé dans le dossier.
  select nullif(regexp_replace(coalesce(value,''), '\D', '', 'g'), '')::integer
    into v_frais from site_settings where key = 'ins_fee_registration';
  select nullif(regexp_replace(coalesce(value,''), '\D', '', 'g'), '')::integer
    into v_mens  from site_settings where key = 'ins_fee_monthly';

  loop
    v_tries := v_tries + 1;
    v_ref := bbc_reference_inscription();
    exit when not exists (select 1 from academy_registrations where reference = v_ref);
    if v_tries > 10 then raise exception 'reference_indisponible'; end if;
  end loop;

  insert into academy_registrations (
    reference, child_first_name, child_last_name, birth_date, gender, category,
    school, district, guardian_name, guardian_relation, guardian_phone,
    guardian_phone2, guardian_email, health_notes, experience, message,
    fee_registration_fcfa, fee_monthly_fcfa
  ) values (
    v_ref,
    left(v_first, 60), left(v_last, 60), p_birth_date, p_gender,
    left(nullif(btrim(p_category), ''), 40),
    left(nullif(btrim(p_school), ''), 120),
    left(nullif(btrim(p_district), ''), 120),
    left(v_gname, 120),
    left(nullif(btrim(p_guardian_relation), ''), 40),
    left(v_gphone, 40),
    left(nullif(btrim(p_guardian_phone2), ''), 40),
    left(nullif(btrim(p_guardian_email), ''), 160),
    left(nullif(btrim(p_health), ''), 2000),
    left(nullif(btrim(p_experience), ''), 200),
    left(nullif(btrim(p_message), ''), 2000),
    coalesce(v_frais, 20000), coalesce(v_mens, 5000)
  ) returning id into v_id;

  insert into academy_events (registration_id, kind, to_status, body, author)
  values (v_id, 'creation', 'nouvelle', 'Inscription reçue depuis le site.', 'site');

  return v_ref;
end;
$$;

revoke all on function bbc_inscription(text,text,date,text,text,text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function bbc_inscription(text,text,date,text,text,text,text,text,text,text,text,text,text,text,text) to anon, authenticated;


-- =====================================================================
-- 5. LA VUE DE TRAVAIL
--    Ce qu'on veut voir dans la liste sans ouvrir chaque dossier :
--    l'âge, ce qui a été encaissé, ce qui manque.
-- =====================================================================
create or replace view inscriptions_admin as
select
  r.*,
  btrim(coalesce(r.child_first_name,'') || ' ' || coalesce(r.child_last_name,''))     as full_name,
  case when r.birth_date is not null
       then extract(year from age(r.birth_date))::int end                             as age,
  coalesce((select sum(p.amount_fcfa) from academy_payments p
             where p.registration_id = r.id), 0)                                      as total_paye,
  exists (select 1 from academy_payments p
           where p.registration_id = r.id and p.kind = 'inscription')                 as inscription_payee,
  (select count(*) from academy_payments p
    where p.registration_id = r.id and p.kind = 'mensualite')                         as mois_payes,
  (select max(p.paid_on) from academy_payments p
    where p.registration_id = r.id)                                                   as dernier_paiement,
  (select string_agg(p.period, ',' order by p.period) from academy_payments p
    where p.registration_id = r.id and p.kind = 'mensualite')                         as periodes_payees,
  (select count(*) from academy_events e where e.registration_id = r.id)              as nb_events,
  (extract(epoch from (now() - r.created_at)) / 86400)::int                           as jours_depuis_reception
from academy_registrations r;

alter view inscriptions_admin set (security_invoker = on);


-- =====================================================================
-- 6. LES RÉGLAGES AFFICHÉS SUR LE SITE
--    ON CONFLICT DO NOTHING : ce script ne réécrit jamais une valeur
--    déjà saisie dans l'admin. L'admin gagne, toujours.
-- =====================================================================
insert into site_settings (key, value) values
  -- Bloc « Pré-saison » de l'accueil
  ('ps_show',          'oui'),
  ('ps_kicker',        'Reprise · Seniors féminines'),
  ('ps_title',         'PRÉ-SAISON 2026–2027'),
  ('ps_text',          'Le travail commence ici. Reprise de la pré-saison pour les seniors féminines des Baobabs — présence de toutes les joueuses attendue.'),
  ('ps_team',          'Seniors féminines'),
  ('ps_date',          'Samedi 5 septembre 2026'),
  ('ps_time',          '18h00'),
  ('ps_place',         'Terrain de basket Sicap Baobabs, Dakar'),
  ('ps_datetime',      '2026-09-05T18:00'),
  ('ps_video_url',     '/media/video/presaison-2026-2027.mp4'),
  ('ps_poster_url',    '/media/video/presaison-2026-2027-poster.webp'),
  ('ps_maps_url',      ''),
  ('ps_cta_label',     'Inscriptions école de basket'),

  -- Page « Inscriptions » — école de basket / petites catégories
  ('ins_open',            'oui'),
  ('ins_closed_note',     'Les inscriptions de la saison sont closes. Laissez-nous vos coordonnées : nous vous rappellerons à la prochaine ouverture.'),
  ('ins_kicker',          'École de basket · Saison 2026–2027'),
  ('ins_title_a',         'INSCRIP'),
  ('ins_title_b',         'TIONS'),
  ('ins_text',            'Les petites catégories des Baobabs ouvrent leurs portes. Entraînements encadrés, licence officielle et compétition : votre enfant apprend le basket dans un vrai club.'),
  ('ins_fee_registration','20000'),
  ('ins_fee_monthly',     '5000'),
  ('ins_fee_reg_label',   'Frais d''inscription'),
  ('ins_fee_reg_note',    'Une seule fois, à l''inscription. Comprend la licence et l''assurance de la saison.'),
  ('ins_fee_mon_label',   'Mensualité'),
  ('ins_fee_mon_note',    'Chaque mois, du début à la fin de la saison sportive.'),
  ('ins_categories',      'U9 | Nés en 2018 et après
U11 | Nés en 2016 et 2017
U13 | Nés en 2014 et 2015
U15 | Nés en 2012 et 2013
U17 | Nés en 2010 et 2011'),
  ('ins_included',        'Licence et assurance de la saison
Encadrement par des entraîneurs diplômés
Participation aux championnats de sa catégorie
Tenue d''entraînement aux couleurs du club'),
  ('ins_place',           'Terrain de basket Sicap Baobabs, Dakar'),
  ('ins_days',            'Mercredi et samedi'),
  ('ins_time',            '16h00 – 18h00'),
  ('ins_start',           'Samedi 5 septembre 2026'),
  ('ins_contact',         '+221 77 858 74 53'),
  ('ins_payment_note',    'Le règlement se fait sur place, au bureau du club — espèces, Wave ou Orange Money. Aucun paiement n''est demandé en ligne.'),
  ('ins_form_intro',      'Remplissez la fiche ci-dessous. Le club vous rappelle sous 48 h pour fixer la première séance. Les champs marqués * sont obligatoires.'),
  ('ins_success_title',   'Inscription enregistrée !'),
  ('ins_success_text',    'Gardez votre référence : elle vous sera demandée au bureau du club. Nous vous rappelons très vite.')
on conflict (key) do nothing;


-- =====================================================================
--  APRÈS EXÉCUTION — ce qu'il reste à faire à la main
--
--  ALERTE E-MAIL À CHAQUE INSCRIPTION (deux minutes, recommandé) :
--    Database → Webhooks → Create a new hook
--      Table  : academy_registrations
--      Events : Insert
--    Sans ça, une inscription peut attendre plusieurs jours.
--
--  VÉRIFICATIONS :
--    select count(*) from academy_registrations;
--    select * from inscriptions_admin order by created_at desc limit 5;
--    select key, value from site_settings where key like 'ins\_%' or key like 'ps\_%';
-- =====================================================================
