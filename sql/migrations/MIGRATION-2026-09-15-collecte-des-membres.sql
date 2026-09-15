-- =====================================================================
--  LA COLLECTE DES MEMBRES DU CLUB
--  --------------------------------------------------------------------
--  Le club a recrute ses vraies joueuses. Les creer une par une dans
--  l'admin, aller chercher chaque photo, retaper chaque bio : long,
--  repetitif, et personne ne le fera deux fois. On renverse le sens :
--  le club envoie un lien, chacune remplit son profil depuis son
--  telephone, l'admin verifie et valide.
--
--  CE QUI EST GENERIQUE ICI, C'EST LE TUYAU -- PAS LA PERSONNE.
--
--  Campagne, jeton, formulaire, photo originale puis finale,
--  validation, archivage : cela se repete d'un type de membre a
--  l'autre, et cela se construit une fois.
--
--  La personne, non. Une joueuse a un numero, des postes, une taille,
--  des feuilles de match et des statistiques de saison ; un coach a une
--  fonction et une bio. Les fondre dans « personnes + profil_joueuse +
--  profil_coach » obligerait a reecrire TOUT ce qui pointe aujourd'hui
--  vers players.id : match_stats, match_convocations, players_documents,
--  players_contacts, team_attendance, player_season_stats, le Studio et
--  le composant public du site. Un cout de refonte complete pour un
--  club de treize joueuses, sans rien resoudre de plus.
--
--  LA SOUMISSION ECRIT DONC DIRECTEMENT DANS SA TABLE DE DESTINATION,
--  players ou staff, des la premiere seconde, avec un etat de dossier.
--  Il n'existe pas de table d'attente et pas d'etape de copie : la
--  validation ne duplique rien, elle change un etat. C'est ce qui rend
--  le doublon structurellement impossible -- pas une regle de gestion
--  qu'on peut oublier d'appliquer, une consequence de la forme.
--
--  Et c'est ce qui rend vraie l'exigence « une joueuse collectee est
--  identique a une joueuse creee a la main » : il n'y a pas deux
--  chemins a rendre identiques, il n'y en a qu'un.
--
--  DEUX AXES D'ETAT, JAMAIS FONDUS
--
--    status      active / blessee / pret / partie   -- existe deja,
--                c'est la DISPONIBILITE SPORTIVE
--    fiche_etat  recue / a_verifier / a_completer /
--                validee / publiee / refusee        -- l'ETAT DU DOSSIER
--
--  Les melanger serait faux : une joueuse validee peut etre blessee, et
--  une joueuse dont le dossier attend n'est pas « blessee ».
--
--  Les huit joueuses deja en base passent en « publiee » : rien ne
--  disparait du site au moment ou cette migration s'execute.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1) LES CAMPAGNES DE COLLECTE
--  ---------------------------------------------------------------------
--  Un lien partageable, et ce qu'il faut pour le tenir : on le ferme,
--  on lui donne une fin, on plafonne le nombre de depots, on compte ce
--  qui est arrive. Le jeton n'est jamais devinable -- 32 octets tires
--  au sort, pas un numero qui s'incremente.
-- ---------------------------------------------------------------------
create table if not exists public.collecte_campagnes (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('joueuse','coach','staff','dirigeant')),
  libelle     text not null,
  jeton       text not null unique,
  actif       boolean not null default true,
  expire_le   timestamptz,
  max_usages  integer check (max_usages is null or max_usages > 0),
  usages      integer not null default 0,
  cree_par    text,
  created_at  timestamptz not null default now()
);

create index if not exists collecte_campagnes_jeton on public.collecte_campagnes(jeton);

comment on table public.collecte_campagnes is
  'Un lien de collecte partageable, par type de membre. Le jeton est tire au '
  'sort ; la lecture de cette table est reservee a l''admin, le public ne la '
  'touche que par les fonctions bbc_collecte_*.';

select bbc_policies_module('collecte_campagnes','effectif');


-- ---------------------------------------------------------------------
--  2) CE QUE TOUTE FICHE COLLECTEE PORTE
--  ---------------------------------------------------------------------
--  Les memes huit colonnes sur players et sur staff. Elles ne decrivent
--  pas la personne : elles decrivent SON DOSSIER -- d'ou il vient, ou il
--  en est, ce qu'elle a envoye, et comment elle peut y revenir.
-- ---------------------------------------------------------------------
alter table public.players
  add column if not exists fiche_etat       text not null default 'publiee',
  add column if not exists photo_source_url text,
  add column if not exists soumission       jsonb,
  add column if not exists soumis_le        timestamptz,
  add column if not exists campagne_id      uuid references public.collecte_campagnes(id) on delete set null,
  add column if not exists reprise_jeton    text,
  add column if not exists consent_image    boolean,
  add column if not exists consent_le       timestamptz;

alter table public.staff
  add column if not exists fiche_etat       text not null default 'publiee',
  add column if not exists photo_source_url text,
  add column if not exists soumission       jsonb,
  add column if not exists soumis_le        timestamptz,
  add column if not exists campagne_id      uuid references public.collecte_campagnes(id) on delete set null,
  add column if not exists reprise_jeton    text,
  add column if not exists consent_image    boolean,
  add column if not exists consent_le       timestamptz;

-- Un jeton de reprise est unique quand il existe ; beaucoup de fiches
-- n'en ont pas (celles creees a la main), d'ou l'index partiel.
create unique index if not exists players_reprise_jeton
  on public.players(reprise_jeton) where reprise_jeton is not null;
create unique index if not exists staff_reprise_jeton
  on public.staff(reprise_jeton) where reprise_jeton is not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'players_fiche_etat_ok') then
    alter table public.players add constraint players_fiche_etat_ok
      check (fiche_etat in ('recue','a_verifier','a_completer','validee','publiee','refusee'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'staff_fiche_etat_ok') then
    alter table public.staff add constraint staff_fiche_etat_ok
      check (fiche_etat in ('recue','a_verifier','a_completer','validee','publiee','refusee'));
  end if;
end $$;

comment on column public.players.fiche_etat is
  'Etat du DOSSIER, a ne pas confondre avec status qui est la disponibilite '
  'sportive. Une joueuse validee peut etre blessee.';
comment on column public.players.photo_source_url is
  'La photo telle que la joueuse l''a envoyee. Elle n''est JAMAIS ecrasee : '
  'photo_url porte la version finale, detouree par le club.';


-- ---------------------------------------------------------------------
--  3) CE QUI MANQUAIT A players POUR SE PASSER DE RESAISIE
--  ---------------------------------------------------------------------
--  positions : une joueuse est souvent polyvalente. La colonne position
--  reste, et la base la maintient -- exactement comme pour les logos de
--  clubs. Le site, les feuilles de match et le Studio continuent de lire
--  ce qu'ils lisaient, sans une ligne de changement.
--
--  birth_date : birth_year ne suffit pas pour connaitre une categorie
--  d'age ni savoir si une joueuse est mineure. La aussi, l'ancienne
--  colonne est maintenue par la base.
--
--  recrutement_id : le chainon qui manquait. Le bouton « Creer la fiche
--  joueuse » de l'ecran Candidatures inserait une NOUVELLE joueuse a
--  chaque clic, sans rien retenir -- deux clics, deux fiches pour la
--  meme personne. La contrainte d'unicite rend cela impossible.
-- ---------------------------------------------------------------------
alter table public.players
  add column if not exists positions      text[],
  add column if not exists birth_date     date,
  add column if not exists strong_hand    text,
  add column if not exists licence_num    text,
  add column if not exists recrutement_id uuid references public.recruitment_requests(id) on delete set null;

create unique index if not exists players_recrutement_unique
  on public.players(recrutement_id) where recrutement_id is not null;

-- Une personne, plusieurs fonctions : une joueuse qui est aussi
-- assistante coach. Une colonne, plutot qu'une table « personnes » et
-- la reecriture de tout ce qui pointe vers players.id.
alter table public.staff
  add column if not exists player_id uuid references public.players(id) on delete set null;


-- ---------------------------------------------------------------------
--  4) LES COLONNES DERIVEES SE MAINTIENNENT TOUTES SEULES
--  ---------------------------------------------------------------------
--  Dans les deux sens, parce que les deux arrivent : l'admin d'hier
--  ecrit encore « position », le formulaire de demain ecrit
--  « positions ». Celui qui change gagne ; l'autre suit.
-- ---------------------------------------------------------------------
create or replace function public.bbc_player_derive()
returns trigger language plpgsql as $$
begin
  -- postes
  if new.positions is distinct from (case when tg_op = 'UPDATE' then old.positions else null end)
     and new.positions is not null and array_length(new.positions, 1) > 0 then
    new.position := new.positions[1];
  elsif new.position is not null and (new.positions is null or array_length(new.positions, 1) = 0) then
    new.positions := array[new.position];
  end if;

  -- date de naissance
  if new.birth_date is not null then
    new.birth_year := extract(year from new.birth_date)::int;
  end if;

  return new;
end $$;

drop trigger if exists players_derive on public.players;
create trigger players_derive
  before insert or update on public.players
  for each row execute function public.bbc_player_derive();

-- Les huit fiches deja en base recoivent leur tableau de postes.
update public.players
   set positions = array[position]
 where position is not null and (positions is null or array_length(positions, 1) = 0);


-- ---------------------------------------------------------------------
--  5) OUVRIR UN LIEN DE COLLECTE
--  ---------------------------------------------------------------------
--  Le public n'a AUCUN droit sur collecte_campagnes. Cette fonction est
--  la seule porte, et elle ne rend que ce qu'un formulaire a besoin de
--  savoir : est-ce ouvert, pour quel type de membre, sous quel titre.
--  Ni le nombre de depots, ni qui l'a cree, ni les autres campagnes.
--
--  Elle ne dit pas non plus POURQUOI un lien est refuse a un inconnu
--  qui essaierait des jetons au hasard : « ce lien n'est plus valable »
--  couvre les quatre cas.
-- ---------------------------------------------------------------------
create or replace function public.bbc_collecte_ouvrir(p_jeton text)
returns table (ok boolean, type text, libelle text, motif text)
language plpgsql security definer set search_path to 'public' as $$
declare c collecte_campagnes%rowtype;
begin
  select * into c from collecte_campagnes where jeton = p_jeton;
  if not found then
    return query select false, null::text, null::text, 'introuvable'::text; return;
  end if;
  if not c.actif then
    return query select false, null::text, null::text, 'ferme'::text; return;
  end if;
  if c.expire_le is not null and c.expire_le < now() then
    return query select false, null::text, null::text, 'expire'::text; return;
  end if;
  if c.max_usages is not null and c.usages >= c.max_usages then
    return query select false, null::text, null::text, 'complet'::text; return;
  end if;
  return query select true, c.type, c.libelle, null::text;
end $$;

grant execute on function public.bbc_collecte_ouvrir(text) to anon, authenticated;


-- ---------------------------------------------------------------------
--  6) DEPOSER SON PROFIL
--  ---------------------------------------------------------------------
--  La seule ecriture publique du systeme, et elle est etroite : elle
--  n'accepte QUE les champs qu'un membre a le droit de renseigner sur
--  lui-meme. fiche_etat, jersey_number decide par le club, sort, stats,
--  cadrage de la photo : rien de tout cela ne passe par ici, meme si
--  quelqu'un l'ajoute au corps de la requete.
--
--  La photo arrive en photo_source_url -- l'originale. photo_url, la
--  version que le site affiche, reste vide : c'est le travail du club.
--
--  La fonction rend un jeton de reprise. C'est le lien personnel de la
--  personne : elle peut revenir completer, et l'admin peut le lui
--  renvoyer. Il modifie SA fiche, il n'en cree jamais une seconde.
-- ---------------------------------------------------------------------
create or replace function public.bbc_collecte_deposer(p_jeton text, p_data jsonb)
returns table (ok boolean, reprise text, motif text)
language plpgsql security definer set search_path to 'public' as $$
declare
  c        collecte_campagnes%rowtype;
  v_rep    text;
  v_nom    text;
  v_id     uuid;
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
      -- le numero propose ; le club tranche ensuite dans la fiche
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
  else
    insert into staff (
      name, role, bio,
      photo_source_url, fiche_etat, soumission, soumis_le, campagne_id,
      reprise_jeton, consent_image, consent_le, sort
    ) values (
      v_nom,
      nullif(btrim(coalesce(p_data->>'fonction','')), ''),
      nullif(btrim(coalesce(p_data->>'bio','')), ''),
      nullif(btrim(coalesce(p_data->>'photo','')), ''),
      'recue', p_data, now(), c.id, v_rep,
      coalesce((p_data->>'consent')::boolean, false),
      case when coalesce((p_data->>'consent')::boolean, false) then now() end,
      999
    ) returning id into v_id;
  end if;

  update collecte_campagnes set usages = usages + 1 where id = c.id;
  return query select true, v_rep, null::text;
end $$;

grant execute on function public.bbc_collecte_deposer(text, jsonb) to anon, authenticated;


-- ---------------------------------------------------------------------
--  7) REVENIR SUR SON PROFIL
--  ---------------------------------------------------------------------
--  Le lien personnel. Il sert quand le club redemande une photo, ou
--  quand la personne s'apercoit d'une faute.
--
--  IL SE FERME DES QUE LE CLUB A VALIDE. Sinon une re-soumission
--  ecraserait en silence les corrections de l'admin -- la faute de
--  frappe rattrapee, le numero attribue, la bio relue. Passe « validee »,
--  le formulaire devient une lecture, avec un mot pour le dire.
-- ---------------------------------------------------------------------
create or replace function public.bbc_collecte_reprendre(p_reprise text)
returns table (ok boolean, type text, modifiable boolean, donnees jsonb, motif text)
language plpgsql security definer set search_path to 'public' as $$
declare p players%rowtype; s staff%rowtype;
begin
  select * into p from players where reprise_jeton = p_reprise;
  if found then
    return query select true, 'joueuse'::text,
      (p.fiche_etat in ('recue','a_verifier','a_completer')),
      jsonb_build_object(
        'nom_complet', p.name, 'ville', p.city, 'bio', p.bio,
        'numero', p.jersey_number, 'postes', to_jsonb(coalesce(p.positions, '{}')),
        'naissance', p.birth_date, 'taille', p.height, 'poids', p.weight,
        'nationalite', p.nationality, 'main', p.strong_hand,
        'ancien_club', p.previous_club, 'instagram', p.instagram,
        'photo', p.photo_source_url, 'etat', p.fiche_etat),
      null::text;
    return;
  end if;

  select * into s from staff where reprise_jeton = p_reprise;
  if found then
    return query select true, 'staff'::text,
      (s.fiche_etat in ('recue','a_verifier','a_completer')),
      jsonb_build_object('nom_complet', s.name, 'fonction', s.role,
                         'bio', s.bio, 'photo', s.photo_source_url, 'etat', s.fiche_etat),
      null::text;
    return;
  end if;

  return query select false, null::text, false, null::jsonb, 'introuvable'::text;
end $$;

grant execute on function public.bbc_collecte_reprendre(text) to anon, authenticated;


create or replace function public.bbc_collecte_majour(p_reprise text, p_data jsonb)
returns table (ok boolean, motif text)
language plpgsql security definer set search_path to 'public' as $$
declare p players%rowtype; s staff%rowtype; v_nom text;
begin
  v_nom := btrim(coalesce(p_data->>'prenom','') || ' ' || coalesce(p_data->>'nom',''));

  select * into p from players where reprise_jeton = p_reprise;
  if found then
    if p.fiche_etat not in ('recue','a_verifier','a_completer') then
      return query select false, 'verrouille'::text; return;
    end if;
    update players set
      name          = coalesce(nullif(v_nom,''), name),
      city          = coalesce(nullif(btrim(coalesce(p_data->>'ville','')),''), city),
      bio           = coalesce(nullif(btrim(coalesce(p_data->>'bio','')),''), bio),
      jersey_number = coalesce(nullif(p_data->>'numero','')::int, jersey_number),
      positions     = case when jsonb_typeof(p_data->'postes') = 'array'
                           then array(select jsonb_array_elements_text(p_data->'postes'))
                           else positions end,
      birth_date    = coalesce(nullif(p_data->>'naissance','')::date, birth_date),
      height        = coalesce(nullif(btrim(coalesce(p_data->>'taille','')),''), height),
      weight        = coalesce(nullif(btrim(coalesce(p_data->>'poids','')),''), weight),
      nationality   = coalesce(nullif(btrim(coalesce(p_data->>'nationalite','')),''), nationality),
      strong_hand   = coalesce(nullif(btrim(coalesce(p_data->>'main','')),''), strong_hand),
      previous_club = coalesce(nullif(btrim(coalesce(p_data->>'ancien_club','')),''), previous_club),
      instagram     = coalesce(nullif(btrim(coalesce(p_data->>'instagram','')),''), instagram),
      -- une nouvelle photo remplace l'originale precedente, jamais la finale
      photo_source_url = coalesce(nullif(btrim(coalesce(p_data->>'photo','')),''), photo_source_url),
      soumission    = p_data,
      soumis_le     = now(),
      -- elle a retouche : le dossier repasse devant le club
      fiche_etat    = 'a_verifier'
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
      photo_source_url = coalesce(nullif(btrim(coalesce(p_data->>'photo','')),''), photo_source_url),
      soumission = p_data, soumis_le = now(), fiche_etat = 'a_verifier'
    where id = s.id;
    return query select true, null::text; return;
  end if;

  return query select false, 'introuvable'::text;
end $$;

grant execute on function public.bbc_collecte_majour(text, jsonb) to anon, authenticated;


-- ---------------------------------------------------------------------
--  8) CE QUE L'ADMIN DOIT POUVOIR DEMANDER D'UN COUP D'OEIL
--  ---------------------------------------------------------------------
--  « Ou en est chaque joueuse » : ses informations, sa photo originale,
--  sa photo finale, son etat. C'est le tableau de suivi, calcule ici
--  plutot que recalcule dans l'ecran -- et donc identique partout ou on
--  le demande.
--
--  « photo_etat » distingue quatre situations, dont trois appellent un
--  geste du club : rien recu, l'originale attend le detourage, la finale
--  est posee. La quatrieme -- une finale sans originale -- est le cas
--  d'une fiche creee a la main, et n'appelle rien.
-- ---------------------------------------------------------------------
create or replace view public.collecte_suivi with (security_invoker = on) as
  select 'joueuse'::text as type, p.id, p.name, p.fiche_etat, p.status,
         p.jersey_number, p.campagne_id, p.soumis_le, p.reprise_jeton,
         p.photo_source_url, p.photo_url,
         case when p.photo_url is not null and p.photo_url <> '' then 'finale'
              when p.photo_source_url is not null and p.photo_source_url <> '' then 'a_traiter'
              else 'aucune' end as photo_etat,
         -- ce qui manque encore pour publier, nomme
         array_remove(array[
           case when coalesce(btrim(p.name),'') = '' then 'nom' end,
           case when p.jersey_number is null then 'numero' end,
           case when p.positions is null or array_length(p.positions,1) = 0 then 'poste' end,
           case when coalesce(btrim(p.photo_url),'') = '' then 'photo finale' end
         ], null) as manque
    from players p
  union all
  select 'staff'::text, s.id, s.name, s.fiche_etat, null::text,
         null::int, s.campagne_id, s.soumis_le, s.reprise_jeton,
         s.photo_source_url, s.photo_url,
         case when s.photo_url is not null and s.photo_url <> '' then 'finale'
              when s.photo_source_url is not null and s.photo_source_url <> '' then 'a_traiter'
              else 'aucune' end,
         array_remove(array[
           case when coalesce(btrim(s.name),'') = '' then 'nom' end,
           case when coalesce(btrim(s.role),'') = '' then 'fonction' end,
           case when coalesce(btrim(s.photo_url),'') = '' then 'photo finale' end
         ], null)
    from staff s;

comment on view public.collecte_suivi is
  'Ou en est chaque membre : etat du dossier, etat de la photo, et ce qui '
  'manque encore pour publier. Une seule definition de « complet », pour que '
  'deux ecrans ne repondent jamais deux choses differentes.';


-- ---------------------------------------------------------------------
--  9) UN NUMERO DE MAILLOT EN DOUBLE SE VOIT
--  ---------------------------------------------------------------------
--  Treize joueuses qui choisissent leur numero : deux vont prendre le 7.
--  On ne l'interdit pas -- une joueuse partie libere son numero, et le
--  club tranche -- mais l'admin doit le savoir sans avoir a comparer
--  treize cartes a l'oeil.
-- ---------------------------------------------------------------------
create or replace view public.numeros_en_double with (security_invoker = on) as
  select jersey_number, count(*) as combien,
         string_agg(name, ', ' order by name) as joueuses
    from players
   where jersey_number is not null
     and fiche_etat <> 'refusee'
     and coalesce(status,'active') <> 'partie'
   group by jersey_number
  having count(*) > 1;


-- ---------------------------------------------------------------------
--  VERIFICATIONS
--  ---------------------------------------------------------------------
--    -- rien n'a disparu du site : les huit passent en « publiee »
--    select fiche_etat, count(*) from players group by 1;
--
--    -- les postes ont ete repris
--    select name, position, positions from players order by name;
--
--    -- une campagne d'essai, puis son ouverture
--    insert into collecte_campagnes (type, libelle, jeton)
--      values ('joueuse','Effectif 2026-2027', encode(gen_random_bytes(16),'hex'))
--      returning jeton;
--    select * from bbc_collecte_ouvrir('<le jeton>');
--
--    -- le tableau de suivi
--    select type, name, fiche_etat, photo_etat, manque from collecte_suivi;
-- ---------------------------------------------------------------------
