-- =====================================================================
--  Baobabs Basket Club — Analytics du club + un correctif
--  17 août 2026. Idempotent. Aucune donnée supprimée.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. CORRECTIF — bbc_annuler_dernier laissait une coquille vide
--
--    Annuler tous les gestes d'une joueuse décrémentait bien ses
--    compteurs, mais laissait sa ligne dans match_stats avec des zéros
--    partout. Inoffensif tant que le match n'est pas terminé — mais le
--    jour où le score est saisi, elle compte comme « un match joué à
--    0 point » et tire ses moyennes vers le bas. C'est exactement ce qui
--    attend Bineta Cissé sur le match contre UCAD SC.
--
--    Une ligne entièrement à zéro, sans minutes et sans titularisation,
--    ne veut pas dire « elle a joué sans rien faire » : elle veut dire
--    « elle n'aurait jamais dû être là ». On la retire.
-- ---------------------------------------------------------------------
create or replace function bbc_annuler_dernier(p_match_id uuid)
returns match_live
language plpgsql
security definer
set search_path = public
as $$
declare
  e      match_events%rowtype;
  v_live match_live%rowtype;
begin
  if not is_admin() then raise exception 'non_autorise'; end if;

  select * into e from match_events
   where match_id = p_match_id and kind not in ('fin_periode','temps_mort')
   order by created_at desc limit 1;
  if not found then raise exception 'rien_a_annuler'; end if;

  if e.team = 'bbc' and e.player_id is not null then
    update match_stats set
      fg2_made = greatest(fg2_made - (case when e.kind = 'panier2' then 1 else 0 end), 0),
      fg2_att  = greatest(fg2_att  - (case when e.kind in ('panier2','rate2') then 1 else 0 end), 0),
      fg3_made = greatest(fg3_made - (case when e.kind = 'panier3' then 1 else 0 end), 0),
      fg3_att  = greatest(fg3_att  - (case when e.kind in ('panier3','rate3') then 1 else 0 end), 0),
      ft_made  = greatest(ft_made  - (case when e.kind = 'lf' then 1 else 0 end), 0),
      ft_att   = greatest(ft_att   - (case when e.kind in ('lf','rate_lf') then 1 else 0 end), 0),
      reb_off  = greatest(reb_off  - (case when e.kind = 'reb_off' then 1 else 0 end), 0),
      reb_def  = greatest(reb_def  - (case when e.kind = 'reb_def' then 1 else 0 end), 0),
      ast      = greatest(ast      - (case when e.kind = 'passe' then 1 else 0 end), 0),
      stl      = greatest(stl      - (case when e.kind = 'interception' then 1 else 0 end), 0),
      blk      = greatest(blk      - (case when e.kind = 'contre' then 1 else 0 end), 0),
      tov      = greatest(tov      - (case when e.kind = 'perte' then 1 else 0 end), 0),
      pf       = greatest(pf       - (case when e.kind = 'faute' then 1 else 0 end), 0)
    where match_id = e.match_id and player_id = e.player_id;

    -- La coquille vide s'en va avec le dernier geste annulé.
    delete from match_stats
     where match_id = e.match_id and player_id = e.player_id
       and minutes = 0 and not is_starter
       and fg2_att = 0 and fg3_att = 0 and ft_att = 0
       and reb_off = 0 and reb_def = 0 and ast = 0
       and stl = 0 and blk = 0 and tov = 0 and pf = 0;
  end if;

  update match_live set
    score_bbc  = greatest(score_bbc - (case when e.team = 'bbc' then e.points else 0 end), 0),
    score_adv  = greatest(score_adv - (case when e.team = 'adv' then e.points else 0 end), 0),
    updated_at = now()
  where match_id = p_match_id
  returning * into v_live;

  delete from match_events where id = e.id;
  return v_live;
end;
$$;

-- Ménage de la coquille déjà présente sur le match contre UCAD SC.
delete from match_stats
 where minutes = 0 and not is_starter
   and fg2_att = 0 and fg3_att = 0 and ft_att = 0
   and reb_off = 0 and reb_def = 0 and ast = 0
   and stl = 0 and blk = 0 and tov = 0 and pf = 0
   and not exists (select 1 from match_events e
                    where e.match_id = match_stats.match_id
                      and e.player_id = match_stats.player_id);


-- ---------------------------------------------------------------------
-- 2. LE MODULE ANALYTICS
--    L'argent du club se regarde depuis la présidence et la direction
--    sportive. Le coach n'a rien à y faire, le community manager non
--    plus — leur en donner la clé serait leur confier une information
--    qu'ils n'ont pas à porter.
-- ---------------------------------------------------------------------
insert into role_permissions (role, module, action) values
  ('president','analytics','voir'),         ('president','analytics','exporter'),
  ('directeur_sportif','analytics','voir'), ('directeur_sportif','analytics','exporter')
on conflict do nothing;


-- ---------------------------------------------------------------------
-- 3. LES RECETTES, MOIS PAR MOIS
--    Trois sources d'argent, une seule lecture. La boutique compte au
--    jour de la commande, l'école au jour de l'encaissement réel : une
--    mensualité de septembre payée en novembre est une recette de
--    novembre, sinon la trésorerie du club raconterait une histoire
--    qu'elle n'a pas vécue.
-- ---------------------------------------------------------------------
create or replace view club_recettes_mois as
select mois, source, sum(montant)::bigint as montant
from (
  select to_char(o.created_at,'YYYY-MM') as mois, 'Boutique'::text as source,
         coalesce(o.total,0) as montant
    from orders o
   where coalesce(lower(o.status),'') not in ('annulee','annulée','annule')
  union all
  select to_char(p.paid_on,'YYYY-MM'), 'École de basket', p.amount_fcfa
    from academy_payments p
) t
group by mois, source;

alter view club_recettes_mois set (security_invoker = on);


-- ---------------------------------------------------------------------
-- 4. L'AUDIENCE QUE LE CLUB POSSÈDE
--    Volontairement pas le trafic du site : Vercel et Plausible le font
--    mieux. Ici, seulement ce dont le club est propriétaire et qu'il
--    peut recontacter — une adresse e-mail vaut mille pages vues.
-- ---------------------------------------------------------------------
create or replace view club_audience_mois as
select mois, source, count(*)::bigint as nb
from (
  select to_char(created_at,'YYYY-MM') as mois, 'Newsletter'::text as source from newsletter_subscribers
  union all
  select to_char(created_at,'YYYY-MM'), 'Comptes clients' from customers
  union all
  select to_char(created_at,'YYYY-MM'), 'Inscriptions école' from academy_registrations
) t
group by mois, source;

alter view club_audience_mois set (security_invoker = on);


-- =====================================================================
--  VÉRIFICATIONS
--    select * from club_recettes_mois order by mois desc, source;
--    select * from club_audience_mois order by mois desc, source;
--    -- doit être vide : plus aucune coquille sans geste associé
--    select * from match_stats where minutes = 0 and not is_starter
--      and fg2_att = 0 and fg3_att = 0 and ft_att = 0;
-- =====================================================================
