-- =====================================================================
--  Baobabs Basket Club — ÉCOLE DE BASKET, LOT 2 : LE DOSSIER
--  17 août 2026 — à passer APRÈS MIGRATION-inscriptions.sql
--  Idempotent. Aucune donnée supprimée.
--
--  CE QUE ÇA AJOUTE
--    1. Les pièces du dossier (academy_documents)
--    2. La notion de « dossier complet », calculée et non saisie
--    3. Le suivi côté parent : bbc_inscription_suivi(référence, téléphone)
--
--  POURQUOI LES PIÈCES
--  Une licence FSBB demande un extrait de naissance, un certificat
--  médical, une photo d'identité et une autorisation parentale. Le
--  certificat médical n'est pas de la paperasse : s'il manque et qu'un
--  enfant fait un malaise à l'entraînement, c'est le club qui répond.
--  Le rendre visible dans la fiche, c'est la seule façon de ne pas
--  s'en apercevoir le jour où c'est trop tard.
--
--  POURQUOI PAS D'ENVOI DEPUIS LE SITE
--  Les pièces se déposent depuis l'admin, jamais depuis le formulaire
--  public. Deux raisons : les familles arrivent au bureau avec des
--  papiers, pas des scans ; et surtout des documents d'identité de
--  mineurs n'ont rien à faire dans un espace de stockage ouvert en
--  écriture au public.
-- =====================================================================


-- =====================================================================
-- 1. LES PIÈCES
-- =====================================================================
create table if not exists academy_documents (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null references academy_registrations(id) on delete cascade,
  kind            text not null check (kind in ('photo','naissance','medical','autorisation','autre')),
  url             text,
  received_on     date not null default current_date,
  note            text,
  author          text,
  created_at      timestamptz not null default now()
);

create index if not exists academy_documents_reg_idx on academy_documents (registration_id);

-- Une pièce officielle ne se dépose qu'une fois. « autre » échappe à la
-- règle : c'est la case fourre-tout, elle doit accepter plusieurs lignes.
create unique index if not exists academy_documents_kind_uidx
  on academy_documents (registration_id, kind) where kind <> 'autre';

alter table academy_documents enable row level security;

drop policy if exists academy_documents_admin on academy_documents;
create policy academy_documents_admin on academy_documents
  for all using (is_admin()) with check (is_admin());

-- Toute pièce reçue laisse une trace, comme les paiements.
create or replace function bbc_academy_log_piece()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_nom text;
begin
  v_nom := case new.kind
             when 'photo'        then 'Photo d''identité'
             when 'naissance'    then 'Extrait de naissance'
             when 'medical'      then 'Certificat médical'
             when 'autorisation' then 'Autorisation parentale'
             else 'Pièce complémentaire'
           end;
  insert into academy_events (registration_id, kind, body, author)
  values (new.registration_id, 'note', 'Pièce reçue — ' || v_nom,
          coalesce(new.author, bbc_academy_acteur()));
  return new;
end;
$$;

drop trigger if exists academy_log_piece on academy_documents;
create trigger academy_log_piece
  after insert on academy_documents
  for each row execute function bbc_academy_log_piece();


-- =====================================================================
-- 2. LA VUE, REFAITE
--    On la supprime pour la recréer : « create or replace » garde
--    l'ancienne expansion de r.* et ignorerait toute colonne ajoutée
--    depuis à la table.
-- =====================================================================
drop view if exists inscriptions_admin;

create view inscriptions_admin as
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
  (extract(epoch from (now() - r.created_at)) / 86400)::int                           as jours_depuis_reception,

  -- Les pièces : la liste de ce qui est là, et ce qui manque encore.
  (select string_agg(d.kind, ',' order by d.kind) from academy_documents d
    where d.registration_id = r.id)                                                   as pieces_recues,
  (select count(*) from academy_documents d
    where d.registration_id = r.id and d.kind <> 'autre')                             as nb_pieces,
  -- Un dossier est complet quand les quatre pièces obligatoires sont là.
  -- Calculé, jamais saisi : une case « complet » cochée à la main finit
  -- toujours par mentir.
  (select count(*) from academy_documents d
    where d.registration_id = r.id
      and d.kind in ('photo','naissance','medical','autorisation')) = 4               as dossier_complet,
  exists (select 1 from academy_documents d
           where d.registration_id = r.id and d.kind = 'medical')                     as medical_recu
from academy_registrations r;

alter view inscriptions_admin set (security_invoker = on);


-- =====================================================================
-- 3. LE SUIVI CÔTÉ PARENT
--    Le parent entre sa référence ET son numéro. Les deux, sinon une
--    référence devinée suffirait à lire le dossier d'un enfant.
--    La comparaison porte sur les chiffres seuls : « 77 858 74 53 »,
--    « +221778587453 » et « 00221 77 858 74 53 » sont le même numéro
--    pour tout le monde sauf pour une comparaison de texte.
--    Ne renvoie que le strict nécessaire : jamais l'adresse, jamais les
--    notes de santé, jamais les notes internes.
-- =====================================================================
create or replace function bbc_inscription_suivi(p_reference text, p_phone text)
returns table (
  reference        text,
  prenom           text,
  statut           text,
  categorie        text,
  frais_payes      boolean,
  mois_payes       integer,
  dossier_complet  boolean,
  pieces_manquantes text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref   text := upper(btrim(coalesce(p_reference,'')));
  v_tel   text := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
  v_id    uuid;
begin
  if v_ref = '' or length(v_tel) < 6 then
    raise exception 'reference_ou_telephone_manquant';
  end if;

  -- Les 6 derniers chiffres suffisent et évitent les faux négatifs dus
  -- à l'indicatif pays, saisi une fois sur deux.
  select r.id into v_id
    from academy_registrations r
   where upper(r.reference) = v_ref
     and (right(regexp_replace(coalesce(r.guardian_phone,''),  '\D','','g'), 6) = right(v_tel, 6)
       or right(regexp_replace(coalesce(r.guardian_phone2,''), '\D','','g'), 6) = right(v_tel, 6));

  if v_id is null then
    raise exception 'dossier_introuvable';
  end if;

  return query
  select
    r.reference,
    r.child_first_name,
    r.status,
    r.category,
    exists (select 1 from academy_payments p where p.registration_id = r.id and p.kind='inscription'),
    (select count(*)::int from academy_payments p where p.registration_id = r.id and p.kind='mensualite'),
    (select count(*) from academy_documents d
      where d.registration_id = r.id
        and d.kind in ('photo','naissance','medical','autorisation')) = 4,
    (select coalesce(string_agg(m.nom, ', ' order by m.rang), '')
       from (values ('photo','Photo d''identité',1),
                    ('naissance','Extrait de naissance',2),
                    ('medical','Certificat médical',3),
                    ('autorisation','Autorisation parentale',4)) as m(k,nom,rang)
      where not exists (select 1 from academy_documents d
                         where d.registration_id = r.id and d.kind = m.k))
  from academy_registrations r
  where r.id = v_id;
end;
$$;

revoke all on function bbc_inscription_suivi(text,text) from public;
grant execute on function bbc_inscription_suivi(text,text) to anon, authenticated;


-- =====================================================================
--  VÉRIFICATIONS
--    select * from inscriptions_admin order by created_at desc limit 3;
--    -- doit lever « dossier_introuvable », pas une erreur de fonction :
--    select * from bbc_inscription_suivi('INS-XXXXX','770000000');
-- =====================================================================
