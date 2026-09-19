-- =====================================================================
--  MAYA · ETAPE 2 : LA MEMOIRE
--  A coller dans l'editeur SQL de Supabase, d'un seul bloc.
--  Le 19 septembre 2026.
-- ---------------------------------------------------------------------
--  LA QUESTION POSEE : « a-t-elle une memoire ? »
--
--  Reponse honnete avant cette migration : dans la conversation, oui --
--  elle retient le dernier sujet, la derniere personne, ce qu'elle
--  attend de vous. Entre deux ouvertures de l'administration, presque
--  rien : maya_suivi ne retient que le SORT des faits qu'elle a montres
--  (vu, traite, ecarte), pas ce qu'on lui a demande.
--
--  Elle ne se souvenait donc jamais de VOUS. Chaque matin, la meme
--  inconnue polie.
--
--  CETTE TABLE EST SON CARNET. Une ligne par question posee : ce qui a
--  ete tape, ce qu'elle en a compris, et si elle a compris. Deux usages,
--  tous les deux visibles des le premier jour :
--
--    1. CE QUE VOUS DEMANDEZ SOUVENT REMONTE. La liste qui s'ouvre sous
--       le champ commence par vos questions a vous, pas par les miennes.
--       C'est la difference entre un outil et un outil qui vous connait.
--
--    2. CE QU'ELLE N'A PAS COMPRIS DEVIENT UNE LISTE DE TRAVAIL. Ses
--       limites cessent d'etre un mur qu'on decouvre en s'y cognant :
--       elles deviennent quelque chose qu'on lit, et qu'on corrige.
--
--  CE QU'ELLE N'ECRIRA JAMAIS ICI
--  ------------------------------
--  Une question qui touche aux coordonnees de quelqu'un n'est PAS
--  enregistree. « Le telephone de Marieme est le 77... » tape par
--  megarde dans le champ serait alors garde en base pour toujours. MAYA
--  refuse deja de repondre a ces questions-la ; elle refuse aussi de
--  s'en souvenir. Le garde est dans le code (MOTS_PRIVES), pas ici :
--  une base ne peut pas deviner ce qu'une phrase contient.
--
--  ET CHACUN N'A QUE SON CARNET. Le RLS est le meme que pour
--  maya_suivi : qui = auth.uid(), pour lire comme pour ecrire. Personne
--  ne lit les questions d'un autre, pas meme le proprietaire. Le jour ou
--  l'on voudra une vue d'ensemble des questions incomprises, ce sera une
--  decision a prendre, et une migration de plus -- pas un effet de bord
--  de celle-ci.
-- =====================================================================

create table if not exists public.maya_questions (
  id        bigserial primary key,
  qui       uuid not null references auth.users(id) on delete cascade,
  texte     text not null,
  intention text,
  sujet     text,
  comprise  boolean not null default false,
  quand     timestamptz not null default now()
);

--  Les deux lectures reelles : « mes questions les plus posees » et
--  « mes dernieres questions ». Un index pour les deux.
create index if not exists maya_questions_qui
  on public.maya_questions(qui, quand desc);

comment on table public.maya_questions is
  'Le carnet de MAYA : ce que cette personne lui a demande, ce qu''elle '
  'en a compris. Jamais les questions qui touchent aux coordonnees de '
  'quelqu''un -- le garde est dans le code, pas ici.';

alter table public.maya_questions enable row level security;

drop policy if exists maya_questions_le_sien on public.maya_questions;
create policy maya_questions_le_sien on public.maya_questions
  for all to authenticated
  using (qui = auth.uid())
  with check (qui = auth.uid());

--  Supabase accorde d'office ces droits aux tables creees dans public ;
--  on les ecrit quand meme. Un grant en trop ne coute rien, un grant
--  manquant casse le panneau entier.
grant select, insert, delete on public.maya_questions to authenticated;

-- ---------------------------------------------------------------------
--  UN CARNET NE GONFLE PAS INDEFINIMENT
--
--  Deux cents lignes par personne suffisent largement : au-dela, ce sont
--  des questions d'il y a des mois, qui ne disent plus rien de ce qu'on
--  demande aujourd'hui. Le declencheur taille au fil de l'eau plutot que
--  d'attendre une tache planifiee qui n'existe pas ici.
--
--  IL NE TAILLE QUE LE CARNET DE CELUI QUI ECRIT : un declencheur qui
--  balaierait toute la table ferait un travail proportionnel au nombre
--  de comptes a chaque question posee.
-- ---------------------------------------------------------------------
create or replace function public.maya_questions_tailler()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.maya_questions
   where qui = new.qui
     and id not in (
       select id from public.maya_questions
        where qui = new.qui
        order by quand desc
        limit 200
     );
  return null;
end;
$$;

revoke all on function public.maya_questions_tailler() from public;
revoke all on function public.maya_questions_tailler() from anon;

drop trigger if exists maya_questions_tailler_t on public.maya_questions;
create trigger maya_questions_tailler_t
  after insert on public.maya_questions
  for each row execute function public.maya_questions_tailler();

-- ---------------------------------------------------------------------
--  VERIFICATION : quatre lignes, quatre « pose ».
-- ---------------------------------------------------------------------
select 'table maya_questions' as quoi,
       case when to_regclass('public.maya_questions') is not null
            then 'pose' else 'MANQUE' end as etat
union all
select 'RLS active',
       case when (select relrowsecurity from pg_class
                   where oid = 'public.maya_questions'::regclass)
            then 'pose' else 'MANQUE' end
union all
select 'politique du proprietaire',
       case when exists (select 1 from pg_policies
                          where schemaname = 'public'
                            and tablename = 'maya_questions'
                            and policyname = 'maya_questions_le_sien')
            then 'pose' else 'MANQUE' end
union all
select 'declencheur de taille',
       case when exists (select 1 from pg_trigger
                          where tgname = 'maya_questions_tailler_t')
            then 'pose' else 'MANQUE' end;
