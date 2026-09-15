-- =====================================================================
--  RETIRER UN GESTE DU MILIEU DU MATCH
--  --------------------------------------------------------------------
--  Un soir de match, on ne se trompe pas seulement sur le dernier
--  geste. On attribue un panier a la mauvaise joueuse, on s'en apercoit
--  trois actions plus tard, et bbc_annuler_dernier() ne sert plus a
--  rien : elle ne sait defaire que le dernier.
--
--  Jusqu'ici, la seule issue etait de corriger la feuille a la main
--  apres coup -- c'est-a-dire d'ecrire une seconde verite a cote de
--  celle que la table de marque avait enregistree.
--
--  CETTE FONCTION DEFAIT EXACTEMENT CE QUE bbc_marquer A FAIT, dans
--  l'ordre inverse : la ligne de feuille de match, le score du direct,
--  puis l'evenement lui-meme. Rien de plus. Elle ne touche ni a la
--  periode, ni a is_live, ni a started_at : retirer un geste n'est pas
--  un evenement de match.
--
--  ELLE NE DESCEND JAMAIS SOUS ZERO. Un compteur negatif dans une
--  feuille de match est pire qu'un compteur faux : il ne peut venir que
--  d'un bug, et il faut alors savoir lequel. `greatest(..., 0)` garde
--  la feuille lisible ; si l'ecart se creuse, c'est ailleurs qu'il faut
--  chercher.
-- =====================================================================

create or replace function public.bbc_retirer_geste(p_event_id uuid)
returns match_live
language plpgsql security definer set search_path to 'public' as $$
declare
  e      match_events%rowtype;
  v_live match_live%rowtype;
begin
  if not is_admin() then raise exception 'non_autorise'; end if;

  select * into e from match_events where id = p_event_id;
  if not found then raise exception 'geste_introuvable'; end if;

  -- 1) La feuille de match, si le geste y avait ecrit quelque chose.
  --    Meme condition qu'a l'ajout : une action des Baobabs rattachee a
  --    une joueuse identifiee.
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
  end if;

  -- 2) Le score du direct, du cote qui l'avait marque.
  update match_live set
    score_bbc  = greatest(score_bbc - (case when e.team = 'bbc' then coalesce(e.points, 0) else 0 end), 0),
    score_adv  = greatest(score_adv - (case when e.team = 'adv' then coalesce(e.points, 0) else 0 end), 0),
    updated_at = now()
  where match_id = e.match_id
  returning * into v_live;

  -- 3) Le geste lui-meme. En dernier : si l'une des deux etapes
  --    precedentes echoue, la transaction est annulee et le geste est
  --    toujours la -- on peut reessayer.
  delete from match_events where id = p_event_id;

  return v_live;
end;
$$;

grant execute on function public.bbc_retirer_geste(uuid) to authenticated;


-- =====================================================================
--  CONTROLE
--  Apres avoir retire un geste depuis l'ecran Soir de match, ces deux
--  requetes doivent concorder : le score du direct doit valoir la somme
--  des points encore inscrits au deroule.
-- =====================================================================
select m.opponent_name,
       l.score_bbc as direct_bbc,
       coalesce(sum(e.points) filter (where e.team = 'bbc'), 0) as deroule_bbc,
       l.score_adv as direct_adv,
       coalesce(sum(e.points) filter (where e.team = 'adv'), 0) as deroule_adv
  from match_live l
  join matches m on m.id = l.match_id
  left join match_events e on e.match_id = l.match_id
 group by m.opponent_name, l.score_bbc, l.score_adv;
