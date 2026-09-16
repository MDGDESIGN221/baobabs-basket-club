-- =====================================================================
--  CE QUI EST ENVOYE ARRIVE JUSQU'A LA FICHE
--  --------------------------------------------------------------------
--  Un premier profil reel est arrive le 16 septembre 2026. La photo, le
--  telephone et la date de naissance n'apparaissaient nulle part dans la
--  fiche de l'admin. Trois causes distinctes, dont deux ici.
--
--  1) LA VUE effectif_admin ETAIT FIGEE.
--     Elle est ecrite « select p.* from players p ». Postgres resout
--     cette etoile UNE FOIS, a la creation : la liste des colonnes est
--     gravee dans la definition de la vue. Toutes les colonnes ajoutees
--     a players depuis -- birth_date, instagram, fiche_etat,
--     photo_source_url, soumis_le, reprise_jeton, campagne_id... --
--     n'en font pas partie et sont invisibles pour qui lit la vue.
--     L'admin contournait deja le probleme en relisant cinq colonnes
--     directement dans players ; les autres restaient perdues.
--     On la recree, donc, et elle reprend l'etat d'aujourd'hui.
--
--     A RETENIR : toute colonne ajoutee a players demain exigera de
--     rejouer ce bloc. C'est le prix de l'etoile, et il est assume :
--     enumerer cinquante colonnes a la main se serait desynchronise
--     encore plus vite.
--
--  2) LE TELEPHONE N'ETAIT RANGE NULLE PART.
--     Le formulaire le demande a TOUT LE MONDE (« tel »), et la fonction
--     de depot ne l'ecrivait dans aucune colonne : il ne survivait que
--     dans la colonne « soumission » (jsonb), que personne ne lit. La
--     fiche, elle, lit players_contacts.phone -- une table ou la
--     soumission n'a jamais rien ecrit. Desormais elle y ecrit, et le
--     staff recoit sa propre colonne.
--
--  Le troisieme defaut (« Meneuse » absent de la liste des postes de la
--  fiche, donc efface a l'enregistrement) est cote admin, pas ici.
--
--  A EXECUTER DANS L'EDITEUR SQL DE SUPABASE.
--  A PASSER APRES MIGRATION-2026-09-16-trois-familles-de-staff.sql.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1) LA VUE REPREND TOUTES LES COLONNES D'AUJOURD'HUI
--  ---------------------------------------------------------------------
--  Corps repris mot pour mot de MIGRATION-effectif-stock.sql : rien ne
--  change que la liste de colonnes que l'etoile recouvre.
--
--  Si le « drop » echoue en disant qu'un objet depend de la vue, ne pas
--  ajouter « cascade » a l'aveugle : lire ce qui depend d'elle d'abord.
-- ---------------------------------------------------------------------
drop view if exists effectif_admin;

create view effectif_admin as
select
  p.*,
  case when p.birth_year is not null
       then extract(year from current_date)::integer - p.birth_year
       else null end as age,
  (p.stats->>'points')::numeric   as pts,
  (p.stats->>'rebonds')::numeric  as reb,
  (p.stats->>'passes')::numeric   as ast,
  (p.stats->>'matchs')::integer   as matchs_joues
from players p;

alter view effectif_admin set (security_invoker = on);


-- ---------------------------------------------------------------------
--  2) LE STAFF A SON TELEPHONE
--  ---------------------------------------------------------------------
--  Les joueuses ont players_contacts (telephone, e-mail, tuteur). Le
--  staff n'a rien d'equivalent, et lui creer une table entiere pour un
--  seul champ serait disproportionne : une colonne suffit.
-- ---------------------------------------------------------------------
alter table public.staff
  add column if not exists phone text;

comment on column public.staff.phone is
  'Telephone donne au formulaire de collecte. Interne au club : le site '
  'ne l''affiche pas.';


-- ---------------------------------------------------------------------
--  3) LE DEPOT RANGE LE TELEPHONE
--  ---------------------------------------------------------------------
--  Pour une joueuse il va dans players_contacts, qui existe deja et que
--  la fiche lit ; pour le staff, dans sa colonne. La branche joueuse est
--  reprise mot pour mot : une fonction se remplace en entier.
-- ---------------------------------------------------------------------
create or replace function public.bbc_collecte_deposer(p_jeton text, p_data jsonb)
returns table (ok boolean, reprise text, motif text)
language plpgsql security definer set search_path to 'public', 'extensions' as $fn$
declare c collecte_campagnes%rowtype; v_rep text; v_nom text; v_tel text; v_id uuid;
begin
  select * into c from collecte_campagnes where jeton = p_jeton;
  if not found or not c.actif
     or (c.expire_le is not null and c.expire_le < now())
     or (c.max_usages is not null and c.usages >= c.max_usages) then
    return query select false, null::text, 'lien'::text; return;
  end if;
  v_nom := btrim(coalesce(p_data->>'prenom','') || ' ' || coalesce(p_data->>'nom',''));
  if v_nom = '' then
    return query select false, null::text, 'nom'::text; return;
  end if;
  v_rep := encode(gen_random_bytes(24), 'hex');
  v_tel := nullif(btrim(coalesce(p_data->>'tel','')), '');

  if c.type = 'joueuse' then
    insert into players (
      name, city, bio, jersey_number, positions, birth_date, height, weight,
      nationality, strong_hand, previous_club, instagram, gender,
      photo_source_url, fiche_etat, soumission, soumis_le, campagne_id,
      reprise_jeton, consent_image, consent_le, status, sort
    ) values (
      v_nom,
      nullif(btrim(coalesce(p_data->>'ville','')), ''),
      nullif(btrim(coalesce(p_data->>'bio','')), ''),
      nullif(p_data->>'numero','')::int,
      case when jsonb_typeof(p_data->'postes') = 'array'
           then array(select jsonb_array_elements_text(p_data->'postes')) end,
      nullif(p_data->>'naissance','')::date,
      nullif(btrim(coalesce(p_data->>'taille','')), ''),
      nullif(btrim(coalesce(p_data->>'poids','')), ''),
      nullif(btrim(coalesce(p_data->>'nationalite','')), ''),
      nullif(btrim(coalesce(p_data->>'main','')), ''),
      nullif(btrim(coalesce(p_data->>'ancien_club','')), ''),
      nullif(btrim(coalesce(p_data->>'instagram','')), ''),
      coalesce(nullif(p_data->>'genre',''), 'F'),
      nullif(btrim(coalesce(p_data->>'photo','')), ''),
      'recue', p_data, now(), c.id, v_rep,
      coalesce((p_data->>'consent')::boolean, false),
      case when coalesce((p_data->>'consent')::boolean, false) then now() end,
      'active', 999
    ) returning id into v_id;

    if v_tel is not null then
      insert into players_contacts (player_id, phone, updated_at)
      values (v_id, v_tel, now())
      on conflict (player_id) do update
        set phone = excluded.phone, updated_at = now();
    end if;
  else
    insert into staff (
      name, role, categorie, bio, qualification, joined_at, phone,
      photo_source_url, fiche_etat, soumission, soumis_le,
      campagne_id, reprise_jeton, consent_image, consent_le, sort
    ) values (
      v_nom,
      nullif(btrim(coalesce(p_data->>'fonction','')), ''),
      case c.type
        when 'coach'     then 'Encadrement'
        when 'staff'     then 'Staff technique'
        when 'dirigeant' then 'Bureau'
      end,
      nullif(btrim(coalesce(p_data->>'bio','')), ''),
      nullif(btrim(coalesce(p_data->>'qualification','')), ''),
      case when p_data->>'depuis' ~ '^[0-9]{4}$'
           then make_date((p_data->>'depuis')::int, 1, 1) end,
      v_tel,
      nullif(btrim(coalesce(p_data->>'photo','')), ''),
      'recue', p_data, now(), c.id, v_rep,
      coalesce((p_data->>'consent')::boolean, false),
      case when coalesce((p_data->>'consent')::boolean, false) then now() end,
      999
    );
  end if;

  update collecte_campagnes set usages = usages + 1 where id = c.id;
  return query select true, v_rep, null::text;
end $fn$;

grant execute on function public.bbc_collecte_deposer(text, jsonb) to anon, authenticated;


-- ---------------------------------------------------------------------
--  4) LA CORRECTION AUSSI
--  ---------------------------------------------------------------------
--  Sans cela, une joueuse qui rouvre son lien pour corriger son numero
--  effacerait le telephone qu'elle avait donne la premiere fois.
-- ---------------------------------------------------------------------
create or replace function public.bbc_collecte_majour(p_reprise text, p_data jsonb)
returns table (ok boolean, motif text)
language plpgsql security definer set search_path to 'public' as $fn$
declare p players%rowtype; s staff%rowtype; v_nom text; v_tel text;
begin
  v_nom := btrim(coalesce(p_data->>'prenom','') || ' ' || coalesce(p_data->>'nom',''));
  v_tel := nullif(btrim(coalesce(p_data->>'tel','')), '');

  select * into p from players where reprise_jeton = p_reprise;
  if found then
    if p.fiche_etat not in ('recue','a_verifier','a_completer') then
      return query select false, 'verrouille'::text; return;
    end if;
    update players set
      name = coalesce(nullif(v_nom,''), name),
      city = coalesce(nullif(btrim(coalesce(p_data->>'ville','')),''), city),
      bio  = coalesce(nullif(btrim(coalesce(p_data->>'bio','')),''), bio),
      jersey_number = coalesce(nullif(p_data->>'numero','')::int, jersey_number),
      positions = case when jsonb_typeof(p_data->'postes') = 'array'
                       then array(select jsonb_array_elements_text(p_data->'postes'))
                       else positions end,
      birth_date = coalesce(nullif(p_data->>'naissance','')::date, birth_date),
      height = coalesce(nullif(btrim(coalesce(p_data->>'taille','')),''), height),
      weight = coalesce(nullif(btrim(coalesce(p_data->>'poids','')),''), weight),
      nationality = coalesce(nullif(btrim(coalesce(p_data->>'nationalite','')),''), nationality),
      strong_hand = coalesce(nullif(btrim(coalesce(p_data->>'main','')),''), strong_hand),
      previous_club = coalesce(nullif(btrim(coalesce(p_data->>'ancien_club','')),''), previous_club),
      instagram = coalesce(nullif(btrim(coalesce(p_data->>'instagram','')),''), instagram),
      photo_source_url = coalesce(nullif(btrim(coalesce(p_data->>'photo','')),''), photo_source_url),
      soumission = p_data, soumis_le = now(), fiche_etat = 'a_verifier'
    where id = p.id;

    if v_tel is not null then
      insert into players_contacts (player_id, phone, updated_at)
      values (p.id, v_tel, now())
      on conflict (player_id) do update
        set phone = excluded.phone, updated_at = now();
    end if;
    return query select true, null::text; return;
  end if;

  select * into s from staff where reprise_jeton = p_reprise;
  if found then
    if s.fiche_etat not in ('recue','a_verifier','a_completer') then
      return query select false, 'verrouille'::text; return;
    end if;
    update staff set
      name = coalesce(nullif(v_nom,''), name),
      role = coalesce(nullif(btrim(coalesce(p_data->>'fonction','')),''), role),
      bio  = coalesce(nullif(btrim(coalesce(p_data->>'bio','')),''), bio),
      qualification = coalesce(nullif(btrim(coalesce(p_data->>'qualification','')),''), qualification),
      joined_at = case when p_data->>'depuis' ~ '^[0-9]{4}$'
                       then make_date((p_data->>'depuis')::int, 1, 1)
                       else joined_at end,
      phone = coalesce(v_tel, phone),
      photo_source_url = coalesce(nullif(btrim(coalesce(p_data->>'photo','')),''), photo_source_url),
      soumission = p_data, soumis_le = now(), fiche_etat = 'a_verifier'
    where id = s.id;
    return query select true, null::text; return;
  end if;

  return query select false, 'introuvable'::text;
end $fn$;

grant execute on function public.bbc_collecte_majour(text, jsonb) to anon, authenticated;


-- ---------------------------------------------------------------------
--  5) LE TELEPHONE DEJA RECU EST RATTRAPE
--  ---------------------------------------------------------------------
--  Il dormait dans « soumission » depuis le premier envoi. Rien n'est
--  ecrase : on ne remplit que ce qui est vide.
-- ---------------------------------------------------------------------
insert into players_contacts (player_id, phone, updated_at)
select p.id, btrim(p.soumission->>'tel'), now()
  from players p
 where p.soumission ? 'tel'
   and btrim(coalesce(p.soumission->>'tel','')) <> ''
   and not exists (select 1 from players_contacts pc
                    where pc.player_id = p.id
                      and coalesce(btrim(pc.phone), '') <> '')
on conflict (player_id) do update
  set phone = excluded.phone, updated_at = now();

update staff s
   set phone = btrim(s.soumission->>'tel')
 where s.soumission ? 'tel'
   and btrim(coalesce(s.soumission->>'tel','')) <> ''
   and coalesce(btrim(s.phone), '') = '';


-- ---------------------------------------------------------------------
--  VERIFICATIONS
--  ---------------------------------------------------------------------
--    select column_name from information_schema.columns
--     where table_name = 'effectif_admin'
--       and column_name in ('birth_date','instagram','fiche_etat',
--                           'photo_source_url','soumis_le','positions');
--    -- attendu : les six. Avant cette migration, aucune.
--
--    select p.name, pc.phone, p.birth_date, p.photo_source_url
--      from players p left join players_contacts pc on pc.player_id = p.id
--     where p.soumis_le is not null order by p.soumis_le desc limit 5;
--    -- attendu : le profil deja recu a son telephone
--
--  PUIS renvoyer un profil par le lien et rouvrir la fiche : la photo,
--  le telephone et la date de naissance doivent y etre.
-- ---------------------------------------------------------------------
