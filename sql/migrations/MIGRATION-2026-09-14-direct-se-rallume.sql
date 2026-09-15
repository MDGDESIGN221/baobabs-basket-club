-- =====================================================================
--  LE DIRECT SE RALLUME AU PREMIER POINT, MEME APRES UN ESSAI
--  --------------------------------------------------------------------
--  Trouve le 14 septembre 2026 en repetant le soir de match en vrai :
--  bbc_marquer() ne posait is_live = true QU'A LA CREATION de la ligne
--  match_live (insert ... on conflict do nothing). Une ligne deja la
--  avec is_live = false (un essai ferme sans publier, un direct eteint
--  depuis l'ecran Direct, ou simplement le tableau ouvert un autre
--  jour) restait eteinte : les points s'additionnaient, le site
--  n'affichait jamais le direct. Pour UCAD SC, la ligne existait deja
--  depuis le 1er septembre : le soir du 19, rien ne se serait allume.
--
--  Maintenant chaque point rallume le direct tant que le match n'a pas
--  de score officiel (matches.score_*). Apres le coup de sifflet final,
--  un clic egare ne rouvre rien.
-- =====================================================================

create or replace function public.bbc_marquer(p_match_id uuid, p_kind text, p_player_id uuid default null, p_team text default 'bbc', p_period integer default null, p_clock text default null)
returns match_live
language plpgsql security definer set search_path to 'public' as $$
declare
  v_pts   integer := 0;
  v_live  match_live%rowtype;
  v_who   text := coalesce(nullif(auth.jwt() ->> 'email',''), 'table de marque');
  v_fini  boolean;
begin
  if not is_admin() then raise exception 'non_autorise'; end if;

  v_pts := case p_kind when 'panier2' then 2 when 'panier3' then 3 when 'lf' then 1 else 0 end;

  -- La ligne de direct est créée au premier geste : rien à préparer.
  insert into match_live (match_id, is_live, started_at, period)
  values (p_match_id, true, now(), coalesce(p_period, 1))
  on conflict (match_id) do nothing;

  insert into match_events (match_id, player_id, team, kind, points, period, clock, author)
  values (p_match_id, p_player_id, p_team, p_kind, v_pts, p_period, p_clock, v_who);

  -- La feuille de match ne bouge que pour une action des Baobabs
  -- rattachée à une joueuse identifiée.
  if p_team = 'bbc' and p_player_id is not null then
    insert into match_stats (match_id, player_id) values (p_match_id, p_player_id)
    on conflict (match_id, player_id) do nothing;

    update match_stats set
      fg2_made = fg2_made + (case when p_kind = 'panier2' then 1 else 0 end),
      fg2_att  = fg2_att  + (case when p_kind in ('panier2','rate2') then 1 else 0 end),
      fg3_made = fg3_made + (case when p_kind = 'panier3' then 1 else 0 end),
      fg3_att  = fg3_att  + (case when p_kind in ('panier3','rate3') then 1 else 0 end),
      ft_made  = ft_made  + (case when p_kind = 'lf' then 1 else 0 end),
      ft_att   = ft_att   + (case when p_kind in ('lf','rate_lf') then 1 else 0 end),
      reb_off  = reb_off  + (case when p_kind = 'reb_off' then 1 else 0 end),
      reb_def  = reb_def  + (case when p_kind = 'reb_def' then 1 else 0 end),
      ast      = ast      + (case when p_kind = 'passe' then 1 else 0 end),
      stl      = stl      + (case when p_kind = 'interception' then 1 else 0 end),
      blk      = blk      + (case when p_kind = 'contre' then 1 else 0 end),
      tov      = tov      + (case when p_kind = 'perte' then 1 else 0 end),
      pf       = pf       + (case when p_kind = 'faute' then 1 else 0 end)
    where match_id = p_match_id and player_id = p_player_id;
  end if;

  -- Un match qui a son score officiel est fini : on ne le rallume pas.
  select (m.score_baobabs is not null and m.score_opponent is not null) into v_fini
    from matches m where m.id = p_match_id;

  update match_live set
    score_bbc  = score_bbc + (case when p_team = 'bbc' then v_pts else 0 end),
    score_adv  = score_adv + (case when p_team = 'adv' then v_pts else 0 end),
    period     = coalesce(p_period, period),
    is_live    = case when coalesce(v_fini, false) then is_live else true end,
    started_at = coalesce(started_at, now()),
    ended_at   = case when coalesce(v_fini, false) then ended_at else null end,
    updated_at = now()
  where match_id = p_match_id
  returning * into v_live;

  return v_live;
end;
$$;
