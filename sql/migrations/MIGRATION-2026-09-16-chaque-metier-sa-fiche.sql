-- =====================================================================
--  CHAQUE METIER A SA FICHE
--  --------------------------------------------------------------------
--  Le formulaire de collecte ne connaissait que deux branches : joueuse,
--  et « tout le reste ». Un entraineur, un kinesitherapeute et un
--  president recevaient donc le meme unique champ « Fonction au club »,
--  dont l'indication melangeait les trois metiers. Quatre liens, deux
--  formulaires.
--
--  Deux colonnes suffisent a les distinguer, et pas huit. La question
--  posee a chacune : est-ce reellement utile au Baobabs Basket Club ?
--
--    qualification  le diplome d'un entraineur, la specialite d'un
--                   kine. Une federation le demande ; un president n'en
--                   a pas, et son formulaire ne la lui demande pas.
--    joined_at      depuis quand cette personne est au club. Le site ne
--                   l'affiche pas, l'admin en a besoin -- c'est ce qui
--                   distingue un membre de l'annee d'un pilier.
--
--  CE QUI N'A PAS ETE AJOUTE, et pourquoi : ni date de naissance ni
--  adresse pour l'encadrement. Le site n'en montre rien et le club n'en
--  a pas l'usage. Un formulaire ne se remplit pas de champs parce
--  qu'ils existent.
--
--  A noter : meme avant cette migration, rien n'etait perdu. La
--  fonction range l'integralite de l'envoi dans la colonne
--  « soumission » (jsonb) -- les champs neufs y etaient deja, faute
--  d'etre ranges dans des colonnes. Le filet a tenu.
--
--  APPLIQUEE EN PRODUCTION LE 16 SEPTEMBRE 2026, et verifiee par un
--  envoi reel depuis le formulaire : role « Entraineur principal »,
--  qualification « Brevet d'Etat 2e degre », joined_at 2019-01-01,
--  fiche_etat « recue », et le coach en attente n'apparait pas sur le
--  site. Les trois campagnes manquantes (Encadrement, Staff technique,
--  Bureau) ont ete ouvertes dans la foulee.
-- =====================================================================

alter table public.staff
  add column if not exists qualification text,
  add column if not exists joined_at     date;

comment on column public.staff.qualification is
  'Diplome d''un entraineur, specialite d''un membre du staff technique. '
  'Vide pour un dirigeant : la fonction suffit.';


-- ---------------------------------------------------------------------
--  LE DEPOT PORTE LES DEUX NOUVELLES COLONNES
--  ---------------------------------------------------------------------
--  Seule la branche staff change ; celle des joueuses est reprise mot
--  pour mot, parce qu'une fonction se remplace en entier.
-- ---------------------------------------------------------------------
create or replace function public.bbc_collecte_deposer(p_jeton text, p_data jsonb)
returns table (ok boolean, reprise text, motif text)
language plpgsql security definer set search_path to 'public', 'extensions' as $fn$
declare c collecte_campagnes%rowtype; v_rep text; v_nom text;
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
    );
  else
    insert into staff (
      name, role, bio, qualification, joined_at,
      photo_source_url, fiche_etat, soumission, soumis_le,
      campagne_id, reprise_jeton, consent_image, consent_le, sort
    ) values (
      v_nom,
      nullif(btrim(coalesce(p_data->>'fonction','')), ''),
      nullif(btrim(coalesce(p_data->>'bio','')), ''),
      nullif(btrim(coalesce(p_data->>'qualification','')), ''),
      -- « depuis » est une annee. On la pose au 1er janvier faute de
      -- mieux, plutot que d'inventer un jour et un mois que personne
      -- n'a donnes.
      case when p_data->>'depuis' ~ '^[0-9]{4}$'
           then make_date((p_data->>'depuis')::int, 1, 1) end,
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
--  LA REPRISE REND AUSSI LES DEUX NOUVEAUX CHAMPS
--  ---------------------------------------------------------------------
--  Sans cela, un entraineur qui rouvre son lien personnel verrait son
--  diplome disparaitre du formulaire -- et, en renvoyant, l'effacerait.
-- ---------------------------------------------------------------------
create or replace function public.bbc_collecte_reprendre(p_reprise text)
returns table (ok boolean, type text, modifiable boolean, donnees jsonb, motif text)
language plpgsql security definer set search_path to 'public' as $fn$
declare p players%rowtype; s staff%rowtype;
begin
  select * into p from players where reprise_jeton = p_reprise;
  if found then
    return query select true, 'joueuse'::text,
      (p.fiche_etat in ('recue','a_verifier','a_completer')),
      jsonb_build_object('nom_complet', p.name, 'ville', p.city, 'bio', p.bio,
        'numero', p.jersey_number, 'postes', to_jsonb(coalesce(p.positions, '{}'::text[])),
        'naissance', p.birth_date, 'taille', p.height, 'poids', p.weight,
        'nationalite', p.nationality, 'main', p.strong_hand,
        'ancien_club', p.previous_club, 'instagram', p.instagram,
        'photo', p.photo_source_url, 'etat', p.fiche_etat), null::text;
    return;
  end if;

  select * into s from staff where reprise_jeton = p_reprise;
  if found then
    return query select true, 'staff'::text,
      (s.fiche_etat in ('recue','a_verifier','a_completer')),
      jsonb_build_object('nom_complet', s.name, 'fonction', s.role,
        'bio', s.bio, 'qualification', s.qualification,
        'depuis', case when s.joined_at is not null
                       then extract(year from s.joined_at)::text end,
        'photo', s.photo_source_url, 'etat', s.fiche_etat), null::text;
    return;
  end if;

  return query select false, null::text, false, null::jsonb, 'introuvable'::text;
end $fn$;

grant execute on function public.bbc_collecte_reprendre(text) to anon, authenticated;


-- ---------------------------------------------------------------------
--  ET LA MISE A JOUR
-- ---------------------------------------------------------------------
create or replace function public.bbc_collecte_majour(p_reprise text, p_data jsonb)
returns table (ok boolean, motif text)
language plpgsql security definer set search_path to 'public' as $fn$
declare p players%rowtype; s staff%rowtype; v_nom text;
begin
  v_nom := btrim(coalesce(p_data->>'prenom','') || ' ' || coalesce(p_data->>'nom',''));

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
      photo_source_url = coalesce(nullif(btrim(coalesce(p_data->>'photo','')),''), photo_source_url),
      soumission = p_data, soumis_le = now(), fiche_etat = 'a_verifier'
    where id = s.id;
    return query select true, null::text; return;
  end if;

  return query select false, 'introuvable'::text;
end $fn$;

grant execute on function public.bbc_collecte_majour(text, jsonb) to anon, authenticated;


-- ---------------------------------------------------------------------
--  VERIFICATIONS
--  ---------------------------------------------------------------------
--    select string_agg(column_name, ' ' order by column_name)
--      from information_schema.columns where table_name = 'staff';
--    -- attendu : qualification et joined_at presents
--
--    select proname, array_to_string(proconfig, ' ')
--      from pg_proc where proname like 'bbc_collecte%' order by 1;
--    -- attendu : bbc_collecte_deposer porte « public, extensions »
-- ---------------------------------------------------------------------
