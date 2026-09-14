-- =====================================================================
--  LA SAISON : une ligne par saison, l'etat, le bilan
--  --------------------------------------------------------------------
--  Rien ne disait « on change d'annee ». La saison etait une regle de
--  calcul repetee dans quatre endroits (l'ecole, la caisse, les
--  entrainements, le site), les categories d'age du site etaient un
--  texte fige d'une saison en retard, les licences n'avaient pas de
--  fin, et les stats « de la saison » additionnaient tout depuis le
--  premier match.
--
--  saisons            une ligne par saison : label « 2026-2027 », du
--                     1er juillet au 30 juin (la saison comptable de la
--                     caisse), la reprise sportive, l'etat, et le bilan
--                     fige a la cloture (jsonb).
--  saison_publique    ce que le site peut savoir : label, dates, etat.
--  bbc_saison_courante()  la saison en cours, ou la regle juillet-juin
--                     quand aucune n'est ouverte : les vues s'en servent.
--  bbc_reinscrire()   un enfant de la saison passee repart avec un
--                     dossier neuf (reference, tarif en vigueur), les
--                     pieces qui restent valables le suivent, l'ancien
--                     dossier est archive. Une seule transaction.
--
--  Droits : tout admin lit ; ouvrir, modifier, cloturer = module
--  « reglages » (president, super_admin). Le site lit la vue.
-- =====================================================================

create table if not exists public.saisons (
  id           uuid primary key default gen_random_uuid(),
  label        text not null unique,
  debut        date not null,
  fin          date not null,
  reprise      date,                       -- premier entrainement, rentree sportive
  etat         text not null default 'preparation' check (etat in ('preparation','en_cours','cloturee')),
  competition  text,
  objectif     text,
  bilan        jsonb,
  ouverte_le   timestamptz,
  cloturee_le  timestamptz,
  created_at   timestamptz not null default now(),
  check (fin > debut)
);
alter table public.saisons enable row level security;
drop policy if exists saisons_voir on public.saisons;
drop policy if exists saisons_creer on public.saisons;
drop policy if exists saisons_modifier on public.saisons;
drop policy if exists saisons_supprimer on public.saisons;
create policy saisons_voir      on public.saisons for select using (is_admin());
create policy saisons_creer     on public.saisons for insert with check (bbc_can('reglages','modifier'));
create policy saisons_modifier  on public.saisons for update using (bbc_can('reglages','modifier')) with check (bbc_can('reglages','modifier'));
create policy saisons_supprimer on public.saisons for delete using (bbc_can('reglages','supprimer'));

-- Le site : label, dates, etat. Jamais le bilan (il porte la caisse).
create or replace view public.saison_publique with (security_invoker = off) as
  select label, debut, fin, reprise, etat, competition from public.saisons;
grant select on public.saison_publique to anon, authenticated;
-- Une vue simple est modifiable, et security_invoker=off la ferait
-- ecrire en tant que proprietaire, sans RLS : lecture seule, en clair.
revoke insert, update, delete, truncate, references, trigger on public.saison_publique from anon, authenticated;

-- La saison en cours ; sinon la regle juillet-juin, comme avant.
create or replace function public.bbc_saison_courante()
returns table (label text, debut date, fin date)
language sql stable security definer set search_path to 'public' as $$
  (select s.label, s.debut, s.fin from saisons s where s.etat = 'en_cours' order by s.debut desc limit 1)
  union all
  (select (x.an)::text || '-' || (x.an + 1)::text, make_date(x.an, 7, 1), make_date(x.an + 1, 6, 30)
     from (select case when extract(month from current_date) >= 7 then extract(year from current_date)::int else extract(year from current_date)::int - 1 end as an) x
    where not exists (select 1 from saisons where etat = 'en_cours'));
$$;
grant execute on function public.bbc_saison_courante() to anon, authenticated;

-- Les stats « de la saison » ne remontent plus au premier match du club.
create or replace view public.player_season_stats with (security_invoker = on) as
  select s.player_id, p.name, p.jersey_number,
    count(*) filter (where s.played) as matchs_joues,
    count(*) filter (where s.is_starter) as titularisations,
    sum(s.minutes) as minutes_total,
    sum(s.pts) as pts_total,
    round(avg(s.pts) filter (where s.played), 1) as pts_moy,
    round(avg(s.reb) filter (where s.played), 1) as reb_moy,
    round(avg(s.ast) filter (where s.played), 1) as ast_moy,
    round(avg(s.eval) filter (where s.played), 1) as eval_moy,
    sum(s.fg2_made + s.fg3_made) as tirs_reussis,
    sum(s.fg2_att + s.fg3_att) as tirs_tentes,
    case when sum(s.fg2_att + s.fg3_att) > 0 then round(100.0 * sum(s.fg2_made + s.fg3_made) / sum(s.fg2_att + s.fg3_att), 1) end as pct_tirs,
    case when sum(s.fg3_att) > 0 then round(100.0 * sum(s.fg3_made) / sum(s.fg3_att), 1) end as pct_3pts,
    case when sum(s.ft_att) > 0 then round(100.0 * sum(s.ft_made) / sum(s.ft_att), 1) end as pct_lf,
    max(m.match_date) as dernier_match
  from match_stats s
  join players p on p.id = s.player_id
  join matches m on m.id = s.match_id
  cross join bbc_saison_courante() sc
  where m.score_baobabs is not null and m.score_opponent is not null
    and m.match_date between sc.debut and sc.fin
  group by s.player_id, p.name, p.jersey_number;

-- Reinscrire un enfant : dossier neuf, pieces valables recopiees,
-- ancien dossier archive. Le tarif est celui en vigueur, gele.
create or replace function public.bbc_reinscrire(p_id uuid, p_category text default null)
returns text
language plpgsql security definer set search_path to 'public' as $$
declare
  r        academy_registrations%rowtype;
  v_ref    text;
  v_tries  int := 0;
  v_frais  integer;
  v_mens   integer;
  v_new    uuid;
  v_qui    text := coalesce(auth.jwt() ->> 'email', 'admin');
begin
  if not bbc_can('inscriptions', 'creer') then raise exception 'non_autorise'; end if;
  select * into r from academy_registrations where id = p_id;
  if not found then raise exception 'dossier_introuvable'; end if;
  if r.status = 'archivee' then raise exception 'dossier_deja_archive'; end if;

  select nullif(regexp_replace(coalesce(value,''), '\D', '', 'g'), '')::integer into v_frais from site_settings where key = 'ins_fee_registration';
  select nullif(regexp_replace(coalesce(value,''), '\D', '', 'g'), '')::integer into v_mens  from site_settings where key = 'ins_fee_monthly';

  loop
    v_tries := v_tries + 1;
    v_ref := bbc_reference_inscription();
    exit when not exists (select 1 from academy_registrations where reference = v_ref);
    if v_tries > 10 then raise exception 'reference_indisponible'; end if;
  end loop;

  insert into academy_registrations (
    reference, child_first_name, child_last_name, birth_date, gender, category,
    school, district, guardian_name, guardian_relation, guardian_phone,
    guardian_phone2, guardian_email, health_notes, experience, photo_url,
    status, fee_registration_fcfa, fee_monthly_fcfa
  ) values (
    v_ref, r.child_first_name, r.child_last_name, r.birth_date, r.gender,
    coalesce(left(nullif(btrim(p_category), ''), 40), r.category),
    r.school, r.district, r.guardian_name, r.guardian_relation, r.guardian_phone,
    r.guardian_phone2, r.guardian_email, r.health_notes, r.experience, r.photo_url,
    'inscrite', coalesce(v_frais, 20000), coalesce(v_mens, 5000)
  ) returning id into v_new;

  -- L'extrait de naissance et la photo ne perissent pas ; un certificat
  -- medical de moins d'un an reste bon. L'autorisation se re-signe.
  insert into academy_documents (registration_id, kind, url, received_on, note, author)
  select v_new, d.kind, d.url, d.received_on, coalesce(d.note, '') || ' (repris du dossier ' || r.reference || ')', v_qui
    from academy_documents d
   where d.registration_id = r.id
     and (d.kind in ('naissance', 'photo')
          or (d.kind = 'medical' and d.received_on is not null and d.received_on >= current_date - interval '1 year'));

  insert into academy_events (registration_id, kind, from_status, to_status, body, author) values
    (v_new, 'creation', null, 'inscrite', 'Réinscription depuis le dossier ' || r.reference || '.', v_qui),
    (r.id, 'statut', r.status, 'archivee', 'Réinscrit(e) pour la nouvelle saison : dossier ' || v_ref || '.', v_qui);
  update academy_registrations set status = 'archivee', updated_at = now() where id = r.id;

  return v_ref;
end;
$$;
grant execute on function public.bbc_reinscrire(uuid, text) to authenticated;

-- La saison en cours, pour partir de la realite : trois matchs joues
-- depuis le 27 juillet 2026, en Division 2 feminine.
insert into public.saisons (label, debut, fin, reprise, etat, competition, ouverte_le)
select '2026-2027', date '2026-07-01', date '2027-06-30', null, 'en_cours',
       (select competition from matches where competition is not null order by match_date desc limit 1), now()
where not exists (select 1 from public.saisons);

-- =====================================================================
--  VU EN PASSANT, REFERME LE MEME JOUR : LES VUES ETAIENT MODIFIABLES
--  --------------------------------------------------------------------
--  Chaque vue du schema recevait, par les privileges par defaut du
--  projet, INSERT / UPDATE / DELETE pour anon et authenticated. Une vue
--  simple (une seule table, pas de jointure) est modifiable par
--  Postgres ; et match_lineup_public, en security_invoker=off, ecrivait
--  alors dans match_stats EN TANT QUE PROPRIETAIRE, sans RLS : avec la
--  seule cle anon, un `delete from match_lineup_public` effacait toutes
--  les feuilles de match. Personne n'ecrit jamais a travers une vue
--  ici : elles passent toutes en lecture seule.
-- =====================================================================
do $$
declare v record;
begin
  for v in select table_name from information_schema.views where table_schema = 'public' loop
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from anon, authenticated', v.table_name);
  end loop;
end $$;
