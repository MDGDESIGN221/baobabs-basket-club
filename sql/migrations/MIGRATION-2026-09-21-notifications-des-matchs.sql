-- =====================================================================
--  LES NOTIFICATIONS DE MATCH : QUI LES RECOIT
--  --------------------------------------------------------------------
--  Depuis le 21 septembre 2026, le site s'installe sur l'ecran d'accueil
--  (manifest.webmanifest, sw.js). La section « L'appli des Baobabs »
--  promet depuis des mois « notifications de match en temps reel » :
--  voici ou vivent les gens qui les acceptent.
--
--  CE QU'UN ABONNEMENT CONTIENT. Rien qui designe une personne : une
--  adresse de livraison fabriquee par Google, Apple ou Mozilla, et deux
--  cles qui servent a chiffrer le message pour ce navigateur-la. Ni nom,
--  ni e-mail, ni compte. Un abonnement ne se relie a personne, et c'est
--  voulu : le club n'a pas besoin de savoir QUI est derriere.
--
--  LA TABLE EST FERMEE. Aucune politique pour anon ni authenticated :
--  personne ne lit la liste des abonnes depuis le dehors. On s'y inscrit
--  par une fonction, pas par un INSERT -- sinon n'importe qui pourrait
--  la remplir, ou la lire en la devinant. La fonction d'envoi, elle,
--  travaille avec le role service.
--
--  POSTGRES ACCORDE « EXECUTE » A PUBLIC SUR TOUTE FONCTION NEUVE. Les
--  deux fonctions d'ici sont donc revoquees a PUBLIC puis accordees a
--  anon et authenticated, nommement. Sans ces trois lignes, elles
--  seraient ouvertes plus largement qu'on ne le croit.
--
--  A EXECUTER DANS L'EDITEUR SQL DE SUPABASE. Idempotent : on peut la
--  rejouer sans rien perdre.
-- =====================================================================

create table if not exists public.push_abonnes (
  id            uuid primary key default gen_random_uuid(),
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  sujets        text[] not null default '{matchs}',
  agent         text,
  cree_le       timestamptz not null default now(),
  vu_le         timestamptz not null default now(),
  envois        integer not null default 0,
  echecs        integer not null default 0
);

comment on table public.push_abonnes is
  'Les navigateurs qui acceptent les notifications du club. Un abonnement '
  'ne designe personne : une adresse de livraison et deux cles de '
  'chiffrement, rien de plus. Table fermee : on s''y inscrit par '
  'bbc_push_abonner(), la fonction d''envoi lit avec le role service.';

comment on column public.push_abonnes.echecs is
  'Un service de notification finit par refuser une adresse morte (410). '
  'Au-dela de quelques refus, la ligne se retire : sans cela la liste '
  'enfle de telephones qui n''existent plus.';

alter table public.push_abonnes enable row level security;

create index if not exists push_abonnes_sujets_idx on public.push_abonnes using gin (sujets);

-- ---------------------------------------------------------------------
--  S'ABONNER. La validation refuse tout ce qui n'est pas une adresse de
--  service de notification : sans elle, la fonction accepterait
--  n'importe quelle URL et la table deviendrait un carnet d'adresses.
-- ---------------------------------------------------------------------
create or replace function public.bbc_push_abonner(
  p_endpoint text,
  p_p256dh   text,
  p_auth     text,
  p_agent    text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_endpoint is null or p_endpoint !~ '^https://[a-z0-9.-]+\.[a-z]{2,}/' then
    raise exception 'adresse de notification invalide';
  end if;
  if length(p_endpoint) > 1000 or length(coalesce(p_p256dh, '')) not between 10 and 300
     or length(coalesce(p_auth, '')) not between 5 and 300 then
    raise exception 'abonnement mal forme';
  end if;

  insert into public.push_abonnes (endpoint, p256dh, auth, agent)
  values (p_endpoint, p_p256dh, p_auth, left(coalesce(p_agent, ''), 300))
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh,
        auth   = excluded.auth,
        agent  = excluded.agent,
        vu_le  = now(),
        echecs = 0;
end;
$$;

-- ---------------------------------------------------------------------
--  SE DESABONNER. Le navigateur connait son adresse : elle suffit.
-- ---------------------------------------------------------------------
create or replace function public.bbc_push_desabonner(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_abonnes where endpoint = p_endpoint;
$$;

revoke execute on function public.bbc_push_abonner(text, text, text, text) from public;
revoke execute on function public.bbc_push_desabonner(text) from public;
grant  execute on function public.bbc_push_abonner(text, text, text, text) to anon, authenticated;
grant  execute on function public.bbc_push_desabonner(text) to anon, authenticated;

-- ---------------------------------------------------------------------
--  CE QUI EST DEJA PARTI. Une notification ne se repete pas : si un
--  declencheur est rejoue, ou si le club corrige un score deux fois, le
--  telephone ne doit pas sonner deux fois pour la meme chose.
-- ---------------------------------------------------------------------
create table if not exists public.push_envois (
  id        uuid primary key default gen_random_uuid(),
  motif     text not null,
  cible     text,
  parti_le  timestamptz not null default now(),
  touches   integer not null default 0,
  unique (motif, cible)
);

comment on table public.push_envois is
  'Une ligne par notification partie. La contrainte (motif, cible) est ce '
  'qui empeche un telephone de sonner deux fois pour le meme match.';

alter table public.push_envois enable row level security;

-- =====================================================================
--  APRES CETTE MIGRATION
--  --------------------------------------------------------------------
--  1. Poser dans Vercel (Settings > Environment Variables) :
--       BBC_VAPID_PRIVEE   la cle privee (archives/secrets/, hors depot)
--       BBC_NOTIF_SECRET   un mot de passe long, qui protege l'envoi
--       SUPABASE_SERVICE_KEY  le jeton du role service
--  2. Verifier que l'abonnement fonctionne : sur le site, section
--     « L'appli des Baobabs », bouton « Recevoir les notifications ».
--     Puis, dans l'editeur SQL :
--       select count(*), max(cree_le) from public.push_abonnes;
-- =====================================================================
