-- =====================================================================
--  TROIS FAMILLES DE STAFF, ET LE BUREAU RELIE A L'ORGANIGRAMME
--  --------------------------------------------------------------------
--  Quatre liens de collecte existaient : Joueuses, Coachs, Staff,
--  Dirigeants. Mais la fonction de depot ne connaissait que deux
--  destinations : « joueuse » allait dans players, et TOUT LE RESTE
--  dans staff. Un entraineur, un kinesitherapeute et le president
--  tombaient donc dans la meme liste, et rien en base ne disait lequel
--  etait lequel : seulement `role`, du texte libre.
--
--  L'utilisateur l'a vu venir avant moi : « ca va melanger joueuses,
--  staff, etc., et j'ai pas demande ca ».
--
--  UNE COLONNE, PAS UNE REFONTE. La regle qu'on s'etait donnee tient :
--  ajouter un type de membre, c'est une entree de plus dans la
--  description des campagnes, jamais un second composant d'affichage.
--
--    categorie     Encadrement | Staff technique | Bureau.
--                  En toutes lettres et non en code, comme
--                  players.position : ce qui est lu dans l'admin doit
--                  se lire aussi dans la base.
--    org_role_key  le lien vers l'organigramme, pour un dirigeant.
--
--  POURQUOI org_role_key N'EST PAS UNE CLE ETRANGERE : la table
--  org_roles n'a jamais ete creee par une migration du depot (elle est
--  nee dans l'editeur SQL). Rien ne garantit ici que role_key porte une
--  contrainte d'unicite, et une cle etrangere vers une colonne qui n'en
--  a pas ferait echouer toute la migration. L'admin valide le choix
--  contre la liste des fonctions ; la base se contente de la garder.
--
--  A EXECUTER DANS L'EDITEUR SQL DE SUPABASE, pas par « db push ».
-- =====================================================================

alter table public.staff
  add column if not exists categorie    text,
  add column if not exists org_role_key text;

comment on column public.staff.categorie is
  'Encadrement (coachs), Staff technique (kine, preparateur, materiel) '
  'ou Bureau (dirigeants). Rempli par le lien de collecte ; modifiable '
  'a la main dans l''admin. Vide = pas encore classe.';

comment on column public.staff.org_role_key is
  'Pour un membre du bureau : la fonction qu''il occupe dans '
  'org_roles (president, tres, sg...). Une seule personne, deux '
  'usages, pas deux fiches.';

-- La contrainte tolere le vide : les fiches saisies a la main avant
-- aujourd'hui n'ont pas de categorie, et les effacer serait pire que
-- de les laisser a classer.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'staff_categorie_ok') then
    alter table public.staff add constraint staff_categorie_ok
      check (categorie is null or categorie in ('Encadrement', 'Staff technique', 'Bureau'));
  end if;
end $$;


-- ---------------------------------------------------------------------
--  CE QUI EST DEJA ARRIVE SE RANGE TOUT SEUL
--  ---------------------------------------------------------------------
--  Une fiche recue par un lien porte campagne_id : le type de sa
--  campagne dit sa famille, sans avoir a deviner d'apres le texte de
--  `role`. Les fiches saisies a la main n'ont pas de campagne : elles
--  restent vides, et l'admin les montre dans un groupe « A classer »
--  plutot que de leur inventer une famille.
-- ---------------------------------------------------------------------
update public.staff s
   set categorie = case c.type
                     when 'coach'     then 'Encadrement'
                     when 'staff'     then 'Staff technique'
                     when 'dirigeant' then 'Bureau'
                   end
  from public.collecte_campagnes c
 where s.campagne_id = c.id
   and s.categorie is null
   and c.type in ('coach', 'staff', 'dirigeant');


-- ---------------------------------------------------------------------
--  LE DEPOT RANGE CHAQUE ENVOI DANS SA FAMILLE
--  ---------------------------------------------------------------------
--  Seule la branche staff change. Celle des joueuses est reprise mot
--  pour mot : une fonction se remplace en entier, on ne peut pas n'en
--  modifier qu'une moitie.
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
      name, role, categorie, bio, qualification, joined_at,
      photo_source_url, fiche_etat, soumission, soumis_le,
      campagne_id, reprise_jeton, consent_image, consent_le, sort
    ) values (
      v_nom,
      nullif(btrim(coalesce(p_data->>'fonction','')), ''),
      -- La famille vient du LIEN, jamais de ce que la personne a tape :
      -- c'est le president qui decide qui est coach et qui est dirigeant,
      -- en envoyant l'un ou l'autre lien.
      case c.type
        when 'coach'     then 'Encadrement'
        when 'staff'     then 'Staff technique'
        when 'dirigeant' then 'Bureau'
      end,
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
--  VERIFICATIONS
--  ---------------------------------------------------------------------
--    select categorie, count(*) from public.staff group by 1 order by 1;
--    -- attendu : les fiches venues d'un lien sont rangees,
--    --           celles saisies a la main sortent en null (a classer)
--
--    select conname from pg_constraint where conname = 'staff_categorie_ok';
--    -- attendu : une ligne
--
--    select proname, array_to_string(proconfig, ' ')
--      from pg_proc where proname = 'bbc_collecte_deposer';
--    -- attendu : « public, extensions »
--
--  PUIS, POUR DE VRAI : envoyer un profil par le lien « Coachs » et
--  verifier qu'il arrive avec categorie = 'Encadrement'. Une migration
--  qui passe ne prouve pas que le formulaire ecrit bien.
-- ---------------------------------------------------------------------
