-- =====================================================================
--  UN CLUB, UNE IDENTITE, UN LOGO
--  --------------------------------------------------------------------
--  MESURE LE 15 SEPTEMBRE 2026, sur le banc, en changeant pour de vrai
--  le logo de HLM Basket Club depuis sa fiche :
--
--    teams.logo_url .............. mis a jour
--    matches (4 rencontres) ...... 2 mises a jour, 2 restees sur
--                                  l'ancien logo
--    standings ................... JAMAIS touchee
--
--  Les deux matchs oublies s'appelaient « HLM BASKET CLUB » et
--  « HLM  Basket Club » (double espace). La propagation qui existait
--  filtrait sur `opponent_name=eq.<nom>` : egalite stricte, sensible a
--  la casse et aux espaces. Le classement, lui, n'etait propage nulle
--  part : c'est pourtant LUI que le site public affiche dans son tableau
--  de championnat. L'ancien logo y serait reste pour toujours.
--
--  LA CAUSE
--  Un club vivait en quatre exemplaires independants : sa fiche
--  (`teams`), une copie figee dans chaque match (`matches`), une autre
--  dans chaque ligne de classement (`standings`), et une liste de 50
--  clubs ecrite en dur dans le JavaScript. Le lien entre eux se faisait
--  par le nom, en toutes lettres : une majuscule de trop et le club
--  devenait un autre club.
--
--  LE PRINCIPE POSE ICI
--  Le club est l'entite. Son identite est `teams.id`, son logo est
--  `teams.logo_url`. Tout le reste porte une COPIE TENUE PAR LA BASE,
--  jamais une copie tenue a la main.
--
--  POURQUOI GARDER LES COPIES plutot que faire une jointure : le site
--  public ne lit pas `teams` et ne doit pas la lire (elle porte les
--  contacts et les notes internes des clubs adverses). Il lit
--  `matches.opponent_logo_url` et `standings.logo_url`. Ces colonnes
--  restent donc en place, et le site n'a pas une ligne a changer :
--  ce sont les declencheurs ci-dessous qui les tiennent a jour.
--
--  CE QUI NE SE PERD PAS. Supprimer un club met le lien a null et
--  laisse aux matchs leur nom et leur logo : l'historique reste lisible
--  meme quand l'adversaire disparait de la liste. C'est exactement ce
--  que promet deja le message de suppression.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) LA CLE D'UN CLUB
--    Deux noms qui ne different que par la casse ou par des espaces
--    designent le meme club. C'est la seule normalisation faite : on
--    ne touche ni aux accents ni a la ponctuation, pour ne pas
--    confondre deux clubs qui se ressemblent vraiment.
-- ---------------------------------------------------------------------
create or replace function public.bbc_club_cle(p text)
returns text language sql immutable as $$
  select nullif(lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g')), '')
$$;


-- ---------------------------------------------------------------------
-- 2) AVANT DE RIEN CHANGER : les doublons de la table des clubs.
--    Si deux fiches portent le meme nom a la casse pres, le lien se
--    fera sur l'une des deux au hasard. Cette requete doit rendre
--    zero ligne. Si elle en rend, fusionnez les fiches d'abord.
-- ---------------------------------------------------------------------
select bbc_club_cle(name) as cle, count(*) as fiches, string_agg(name, ' | ') as noms
  from public.teams
 group by bbc_club_cle(name)
having count(*) > 1;


-- ---------------------------------------------------------------------
-- 3) LE LIEN
-- ---------------------------------------------------------------------
alter table public.matches
  add column if not exists opponent_team_id uuid references public.teams(id) on delete set null;

alter table public.standings
  add column if not exists team_id uuid references public.teams(id) on delete set null;

create index if not exists matches_opponent_team_id_idx on public.matches(opponent_team_id);
create index if not exists standings_team_id_idx        on public.standings(team_id);


-- ---------------------------------------------------------------------
-- 4) RATTACHER L'EXISTANT
-- ---------------------------------------------------------------------
update public.matches m
   set opponent_team_id = t.id
  from public.teams t
 where m.opponent_team_id is null
   and bbc_club_cle(m.opponent_name) = bbc_club_cle(t.name);

update public.standings s
   set team_id = t.id
  from public.teams t
 where s.team_id is null
   and bbc_club_cle(s.team_name) = bbc_club_cle(t.name);


-- ---------------------------------------------------------------------
-- 5) SAUVER LES LOGOS AVANT DE LES ALIGNER
--    Un club dont la fiche n'a pas de logo, mais dont les matchs en
--    portent un, recupere ce logo. Sans ce passage, l'alignement de
--    l'etape 6 effacerait des logos au lieu d'en poser.
-- ---------------------------------------------------------------------
update public.teams t
   set logo_url = x.logo
  from (select opponent_team_id as id, min(opponent_logo_url) as logo
          from public.matches
         where opponent_team_id is not null
           and coalesce(opponent_logo_url, '') <> ''
         group by opponent_team_id) x
 where t.id = x.id
   and coalesce(t.logo_url, '') = '';

update public.teams t
   set logo_url = x.logo
  from (select team_id as id, min(logo_url) as logo
          from public.standings
         where team_id is not null
           and coalesce(logo_url, '') <> ''
         group by team_id) x
 where t.id = x.id
   and coalesce(t.logo_url, '') = '';


-- ---------------------------------------------------------------------
-- 6) ALIGNER LES COPIES SUR LA FICHE
--    Le nom aussi : c'est lui qui fait qu'un club devient deux. Apres
--    ce passage, « HLM BASKET CLUB » et « HLM  Basket Club » s'ecrivent
--    comme leur fiche, et le face-a-face les compte enfin ensemble.
--    Le logo n'est ecrase que si la fiche en porte un.
-- ---------------------------------------------------------------------
update public.matches m
   set opponent_name     = t.name,
       opponent_logo_url = case when coalesce(t.logo_url, '') <> '' then t.logo_url else m.opponent_logo_url end
  from public.teams t
 where m.opponent_team_id = t.id
   and (m.opponent_name is distinct from t.name
        or (coalesce(t.logo_url, '') <> '' and m.opponent_logo_url is distinct from t.logo_url));

update public.standings s
   set team_name = t.name,
       logo_url  = case when coalesce(t.logo_url, '') <> '' then t.logo_url else s.logo_url end
  from public.teams t
 where s.team_id = t.id
   and (s.team_name is distinct from t.name
        or (coalesce(t.logo_url, '') <> '' and s.logo_url is distinct from t.logo_url));


-- ---------------------------------------------------------------------
-- 7) LE MATCH SUIT SON CLUB
--    A l'ecriture d'un match : si le lien manque, on le retrouve par le
--    nom ; s'il est la, la fiche fait foi. L'administration n'a plus
--    besoin de recopier quoi que ce soit, et une ecriture faite depuis
--    ailleurs (le Studio, un import) est ramenee dans le rang.
-- ---------------------------------------------------------------------
create or replace function public.bbc_match_suit_son_club()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_nom text; v_logo text;
begin
  if new.opponent_team_id is null and new.opponent_name is not null then
    select id into new.opponent_team_id
      from teams
     where bbc_club_cle(name) = bbc_club_cle(new.opponent_name)
     limit 1;
  end if;

  if new.opponent_team_id is not null then
    select name, logo_url into v_nom, v_logo from teams where id = new.opponent_team_id;
    if found then
      new.opponent_name := v_nom;
      -- Tant que la fiche n'a pas de logo, on garde celui qui arrive :
      -- mieux vaut un ecusson d'origine inconnue que pas d'ecusson.
      if coalesce(v_logo, '') <> '' then new.opponent_logo_url := v_logo; end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists matches_suit_son_club on public.matches;
create trigger matches_suit_son_club
  before insert or update of opponent_team_id, opponent_name, opponent_logo_url on public.matches
  for each row execute function public.bbc_match_suit_son_club();


-- ---------------------------------------------------------------------
-- 8) LA LIGNE DE CLASSEMENT SUIT SON CLUB
--    Meme regle. Les clubs du championnat que les Baobabs n'ont jamais
--    rencontres n'ont pas de fiche : leur ligne reste tenue a la main,
--    ce qui est normal, et rien ne la touche.
-- ---------------------------------------------------------------------
create or replace function public.bbc_classement_suit_son_club()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_nom text; v_logo text;
begin
  if new.team_id is null and new.team_name is not null then
    select id into new.team_id
      from teams
     where bbc_club_cle(name) = bbc_club_cle(new.team_name)
     limit 1;
  end if;

  if new.team_id is not null then
    select name, logo_url into v_nom, v_logo from teams where id = new.team_id;
    if found then
      new.team_name := v_nom;
      if coalesce(v_logo, '') <> '' then new.logo_url := v_logo; end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists standings_suit_son_club on public.standings;
create trigger standings_suit_son_club
  before insert or update of team_id, team_name, logo_url on public.standings
  for each row execute function public.bbc_classement_suit_son_club();


-- ---------------------------------------------------------------------
-- 9) LA FICHE DESCEND SUR TOUT CE QUI EN DEPEND
--    C'est le declencheur qui repond au probleme signale : changer le
--    logo d'un club depuis sa fiche le change PARTOUT, en une ecriture,
--    sans que l'administration ait a penser a le repercuter.
-- ---------------------------------------------------------------------
create or replace function public.bbc_club_descend()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name
     or new.logo_url is distinct from old.logo_url then

    update matches
       set opponent_name     = new.name,
           opponent_logo_url = case when coalesce(new.logo_url, '') <> '' then new.logo_url else opponent_logo_url end
     where opponent_team_id = new.id;

    update standings
       set team_name = new.name,
           logo_url  = case when coalesce(new.logo_url, '') <> '' then new.logo_url else logo_url end
     where team_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists teams_descend on public.teams;
create trigger teams_descend
  after update of name, logo_url on public.teams
  for each row execute function public.bbc_club_descend();


-- ---------------------------------------------------------------------
-- 10) UN CLUB CREE APRES COUP ADOPTE SON HISTORIQUE
--     On joue souvent contre un club avant de lui faire une fiche. Le
--     jour ou la fiche arrive, elle ramasse les matchs et la ligne de
--     classement qui portaient deja ce nom.
-- ---------------------------------------------------------------------
create or replace function public.bbc_club_adopte()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update matches set opponent_team_id = new.id
   where opponent_team_id is null
     and bbc_club_cle(opponent_name) = bbc_club_cle(new.name);

  update standings set team_id = new.id
   where team_id is null
     and bbc_club_cle(team_name) = bbc_club_cle(new.name);

  return new;
end;
$$;

drop trigger if exists teams_adopte on public.teams;
create trigger teams_adopte
  after insert on public.teams
  for each row execute function public.bbc_club_adopte();


grant execute on function public.bbc_club_cle(text) to anon, authenticated;


-- =====================================================================
--  CONTROLE. Les trois requetes doivent rendre zero ligne.
-- =====================================================================

-- a) un match rattache a un club, mais qui n'affiche pas son logo
select m.id, m.opponent_name, m.opponent_logo_url, t.name, t.logo_url
  from matches m join teams t on t.id = m.opponent_team_id
 where coalesce(t.logo_url, '') <> ''
   and m.opponent_logo_url is distinct from t.logo_url;

-- b) une ligne de classement rattachee, mais qui n'affiche pas son logo
select s.id, s.team_name, s.logo_url, t.name, t.logo_url
  from standings s join teams t on t.id = s.team_id
 where coalesce(t.logo_url, '') <> ''
   and s.logo_url is distinct from t.logo_url;

-- c) un match dont l'adversaire porte le nom d'un club existant sans
--    lui etre rattache
select m.id, m.opponent_name
  from matches m
 where m.opponent_team_id is null
   and exists (select 1 from teams t where bbc_club_cle(t.name) = bbc_club_cle(m.opponent_name));


-- =====================================================================
--  CE QUI RESTE A LA MAIN, ET POURQUOI
--  Un match joue contre un club qui n'a pas de fiche garde son nom et
--  son logo tapes a la main : rien ne se perd, mais rien ne se propage
--  non plus. L'administration le signale desormais dans l'ecran
--  Adversaires, avec le bouton qui cree la fiche manquante en un clic.
-- =====================================================================
