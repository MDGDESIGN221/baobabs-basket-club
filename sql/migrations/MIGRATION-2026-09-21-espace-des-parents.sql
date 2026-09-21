-- =====================================================================
--  L'ESPACE DES PARENTS : CE QU'UNE FAMILLE PEUT VOIR DE SON DOSSIER
--  --------------------------------------------------------------------
--  Point 3 de la feuille de route du 20 septembre. Une famille inscrit
--  son enfant a l'ecole, paie une inscription puis des mensualites, et
--  n'a aujourd'hui aucun moyen de savoir ou elle en est : elle appelle
--  le club, ou elle attend.
--
--  COMMENT ELLE ENTRE. Par un lien personnel, envoye par le club sur
--  WhatsApp -- le meme mecanisme que les formulaires de collecte des
--  joueuses, qui fonctionne deja : un jeton de 48 caracteres tires au
--  hasard, une colonne, un index unique. Pas de compte a creer, pas de
--  mot de passe a retenir. Ce lien vaut comme une cle : qui l'a, entre.
--  Il se revoque en effacant la colonne, et se reemet en la regenerant.
--
--  CE QUE LA FONCTION REND, ET CE QU'ELLE TAIT. Elle rend l'enfant, le
--  tarif gele du dossier, les paiements, et le compte des mensualites de
--  la saison. Elle ne rend NI les notes de sante, NI les notes internes,
--  NI le telephone, NI quoi que ce soit d'un autre dossier. Une famille
--  voit son dossier, et rien d'autre.
--
--  LA SAISON VA DE SEPTEMBRE A JUIN : dix mensualites. Cette regle ne
--  figure nulle part dans le schema, elle est ici.
--
--  POSTGRES ACCORDE « EXECUTE » A PUBLIC SUR TOUTE FONCTION NEUVE : elle
--  est donc revoquee puis accordee a anon et authenticated, nommement.
--
--  A EXECUTER DANS L'EDITEUR SQL DE SUPABASE. Idempotent.
-- =====================================================================

alter table public.academy_registrations
  add column if not exists parent_jeton text,
  add column if not exists parent_jeton_le timestamptz;

create unique index if not exists academy_registrations_parent_jeton
  on public.academy_registrations(parent_jeton) where parent_jeton is not null;

comment on column public.academy_registrations.parent_jeton is
  'Le lien personnel de la famille. L''effacer revoque l''acces ; le '
  'regenerer en emet un neuf. Il ne designe rien d''autre que ce dossier.';

-- ---------------------------------------------------------------------
--  UN JETON POUR CHAQUE DOSSIER QUI N'EN A PAS ENCORE.
--  gen_random_bytes vient de pgcrypto : si l'editeur refuse, exécuter
--  d'abord  create extension if not exists pgcrypto with schema extensions;
-- ---------------------------------------------------------------------
--  LES STATUTS, RELEVES EN BASE ET DANS L'ADMIN (admin-matchs.html, IN_ST) :
--    nouvelle, contactee, essai, inscrite, en_pause, refusee, archivee
--  On EXCLUT les deux statuts clos au lieu d'enumerer les actifs. Une
--  liste blanche a deja echoue ici : ecrite avec 'essai, inscrite,
--  en_pause', elle a rendu ZERO lien sur six dossiers, tous 'nouvelle'.
--  Une liste d'exclusion survit a un statut ajoute plus tard.
update public.academy_registrations
   set parent_jeton = encode(gen_random_bytes(24), 'hex'),
       parent_jeton_le = now()
 where parent_jeton is null
   and status not in ('refusee', 'archivee');

-- ---------------------------------------------------------------------
--  CE QUE LA FAMILLE VOIT.
--  Un seul appel rend tout : l'enfant, le tarif, les paiements, et le
--  mois par mois de la saison. Le calcul vit ici et non dans la page :
--  le site ne doit pas pouvoir se tromper de regle.
-- ---------------------------------------------------------------------
create or replace function public.bbc_parent_espace(p_jeton text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d           academy_registrations%rowtype;
  v_debut     date;
  v_mois      date;
  v_fin       date;
  v_cle       text;
  v_paye      integer;
  v_mois_json jsonb := '[]'::jsonb;
  v_du        integer := 0;
  v_ins_paye  integer := 0;
  v_ins_du    integer := 0;
  v_regle     integer := 0;
begin
  if p_jeton is null or length(p_jeton) < 20 then
    return jsonb_build_object('ok', false, 'motif', 'lien invalide');
  end if;

  select * into d from academy_registrations where parent_jeton = p_jeton;
  if not found then
    return jsonb_build_object('ok', false, 'motif', 'lien inconnu');
  end if;
  if d.status in ('refusee', 'archivee') then
    return jsonb_build_object('ok', false, 'motif', 'dossier clos');
  end if;

  /* LA SAISON. Elle ouvre en septembre et ferme en juin : dix mois. Un
     dossier ouvert en cours de saison ne doit rien pour les mois d'avant
     son inscription -- on part donc du plus tardif des deux. */
  v_debut := greatest(
    date_trunc('month', d.created_at)::date,
    (case when extract(month from current_date) >= 9
          then make_date(extract(year from current_date)::int, 9, 1)
          else make_date(extract(year from current_date)::int - 1, 9, 1) end)
  );
  v_fin := least(date_trunc('month', current_date)::date,
                 (case when extract(month from v_debut) >= 9
                       then make_date(extract(year from v_debut)::int + 1, 6, 1)
                       else make_date(extract(year from v_debut)::int, 6, 1) end));

  v_mois := v_debut;
  while v_mois <= v_fin loop
    v_cle := to_char(v_mois, 'YYYY-MM');
    select coalesce(sum(amount_fcfa), 0) into v_paye
      from academy_payments
     where registration_id = d.id and kind = 'mensualite' and period = v_cle;

    v_mois_json := v_mois_json || jsonb_build_object(
      'periode', v_cle,
      'du', d.fee_monthly_fcfa,
      'paye', v_paye,
      'solde', greatest(d.fee_monthly_fcfa - v_paye, 0)
    );
    v_du    := v_du + greatest(d.fee_monthly_fcfa - v_paye, 0);
    v_regle := v_regle + least(v_paye, d.fee_monthly_fcfa);
    v_mois := v_mois + interval '1 month';
  end loop;

  /* L'INSCRIPTION ENTRE DANS LE TOTAL. Sans cette part, une famille qui
     a verse 5 000 F sur 20 000 lisait « reste 2 000 F » -- le montant
     des seules mensualites -- alors qu'elle en devait 17 000. */
  select coalesce(sum(amount_fcfa), 0) into v_ins_paye
    from academy_payments where registration_id = d.id and kind = 'inscription';
  v_ins_du := greatest(d.fee_registration_fcfa - v_ins_paye, 0);

  return jsonb_build_object(
    'ok', true,
    'enfant', jsonb_build_object(
      'prenom', d.child_first_name,
      'nom', d.child_last_name,
      'categorie', d.category,
      'reference', d.reference,
      'statut', d.status
    ),
    'responsable', d.guardian_name,
    'tarifs', jsonb_build_object(
      'mensualite', d.fee_monthly_fcfa,
      'inscription', d.fee_registration_fcfa
    ),
    'inscription', jsonb_build_object(
      'reglee', v_ins_du = 0,
      'paye', v_ins_paye,
      'solde', v_ins_du,
      'le', (select max(paid_on) from academy_payments
              where registration_id = d.id and kind = 'inscription')
    ),
    'mois', v_mois_json,
    'total_du', v_du + v_ins_du,          /* mensualites ET inscription */
    'total_du_mensualites', v_du,
    'total_regle', v_regle + v_ins_paye,
    'paiements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'quoi', kind, 'periode', period, 'montant', amount_fcfa,
               'moyen', method, 'le', paid_on
             ) order by paid_on desc, created_at desc)
        from academy_payments where registration_id = d.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.bbc_parent_espace(text) from public;
grant  execute on function public.bbc_parent_espace(text) to anon, authenticated;

-- =====================================================================
--  LES LIENS A ENVOYER AUX FAMILLES
--  --------------------------------------------------------------------
--  A executer apres la migration : cette requete rend, pour chaque
--  dossier actif, le nom de l'enfant, le responsable, son telephone et
--  le lien a lui envoyer sur WhatsApp.
--
--    select child_first_name || ' ' || child_last_name as enfant,
--           guardian_name   as responsable,
--           guardian_phone  as telephone,
--           'https://www.baobabsbasketclub.com/parent/' || parent_jeton as lien
--      from public.academy_registrations
--     where parent_jeton is not null
--       and status not in ('refusee','archivee')
--     order by child_last_name;
--
--  POUR REVOQUER UN LIEN (une famille qui l'aurait partage) :
--    update public.academy_registrations
--       set parent_jeton = encode(gen_random_bytes(24),'hex'),
--           parent_jeton_le = now()
--     where reference = 'BBC-XXXX';
-- =====================================================================
