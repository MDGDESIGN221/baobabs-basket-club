-- =====================================================================
--  LES LISTES DU CLUB DEVIENNENT DES DONNEES
--  Baobabs Basket Club — 7 septembre 2026
--
--  A passer UNE FOIS dans Supabase > SQL Editor > New query > Run.
--  Sans danger si vous la repassez : rien n'est ecrase.
-- =====================================================================
--
--  Neuf listes vivaient dans le JavaScript de l'administration : les
--  clubs adverses et leurs logos, les salles, les tarifs de billetterie,
--  les pieces exigees a l'inscription, les moyens de paiement, les
--  postes du bureau, les tailles de la boutique, les postes des
--  joueuses, les couleurs de mise en forme.
--
--  Ajouter un club au championnat, une salle, un tarif de saison
--  demandait donc de rouvrir le fichier de l'administration. C'est le
--  meme probleme que les casquettes, et la meme reponse : une table,
--  des fonctions verrouillees sur le compte proprietaire, un ecran qui
--  n'existe que chez lui.
--
--  LE CODE GARDE SES VALEURS PAR DEFAUT. Cette table ne fait que les
--  REMPLACER quand elle repond. Si elle est vide, absente, ou si la
--  lecture echoue, l'administration retombe sur ce qu'elle a toujours
--  connu : rien ne casse, jamais.
-- ---------------------------------------------------------------------

create table if not exists club_listes (
  liste   text not null,
  cle     text not null,
  libelle text not null,
  valeur  text,
  ordre   int  not null default 100,
  primary key (liste, cle)
);

comment on table club_listes is
  'Les listes modifiables du club. « valeur » porte le second champ quand la liste en a un : le logo pour un club, le prix pour un tarif, l''explication pour une piece du dossier.';

-- ---------------------------------------------------------------------
--  LES VALEURS D'AUJOURD'HUI, REPRISES TELLES QUELLES
--
--  Extraites du code, pas retapees : le premier jour, rien ne change a
--  l'ecran. « on conflict do nothing » laisse intact ce que vous auriez
--  deja modifie si vous repassez la migration.
-- ---------------------------------------------------------------------
insert into club_listes (liste, cle, libelle, valeur, ordre) values
  ('clubs', 'as-douanes', 'AS Douanes', '/media/img/AS_Douanes_Basket_logo_kidrco.webp', 10),
  ('clubs', 'as-bopp-basket-club', 'AS Bopp Basket Club', '/media/img/AS_Bopp_Basket_Club_co7ang.webp', 20),
  ('clubs', 'us-ouakam', 'US Ouakam', '/media/img/US_Ouakam_logo_transparent_background_iwgzjo.webp', 30),
  ('clubs', 'pikine-basket-club', 'Pikine Basket Club', '/media/img/Pikine_Basket_Club_kpffsq.webp', 40),
  ('clubs', 'ebod', 'EBOD', '/media/img/EBOD_nvumaw.webp', 50),
  ('clubs', 'castors', 'Castors', '/media/img/CASTORS_qc1kom.webp', 60),
  ('clubs', 'abc-academy-dakar', 'ABC Academy Dakar', '/media/img/ABC_ACADEMY_DAKAR_sibshu.webp', 70),
  ('clubs', 'abc-academy', 'ABC Academy', '/media/img/ABC_ACADEMY_vkzixu.webp', 80),
  ('clubs', 'asc-karack', 'ASC Karack', '/media/img/ASC_KARACK_sxoqxa.webp', 90),
  ('clubs', 'sicap-basket-club', 'Sicap Basket Club', '/media/img/sicap_basket_club_mx0mgk.webp', 100),
  ('clubs', 'camberene-basket-club', 'Camberène Basket Club', '/media/img/camberene_basket_club_pvxejs.webp', 110),
  ('clubs', 'avenir-fass', 'Avenir Fass', '/media/img/avenir_fass_ixihsv.webp', 120),
  ('clubs', 'hlm-basket-club', 'HLM Basket Club', '/media/img/HLM_Basket_CLUB_y52tol.webp', 130),
  ('clubs', 'gorom-2', 'Gorom 2', '/media/img/GOROM2_dbjrpa.webp', 140),
  ('clubs', 'rs-yoff', 'RS Yoff', '/media/img/RS_YOFF_h9zabx.webp', 150),
  ('clubs', 'dream-act-academy', 'Dream Act Academy', '/media/img/DREAM_ACT_ACADEMY_ujaszc.webp', 160),
  ('clubs', 'jaon', 'JAON', '/media/img/JAON_ubftiv.webp', 170),
  ('clubs', 'jaxaay-basket-club', 'Jaxaay Basket Club', '/media/img/jaxaay_Basket_Club_qinjjz.webp', 180),
  ('clubs', 'gnbc', 'GNBC', '/media/img/GNBC_h9r42r.webp', 190),
  ('clubs', 'lac-rose-basket-club', 'Lac Rose Basket Club', '/media/img/Lac_Rose_Basket_Club_ipiqfq.webp', 200),
  ('clubs', 'jymmy-basket-club', 'Jymmy Basket Club', '/media/img/JYMMY_BASKET_CLUB_mx0lwe.webp', 210),
  ('clubs', 'asc-saltigue', 'ASC Saltigué', '/media/img/Asc_Saltigue_oytbad.webp', 220),
  ('clubs', 'afso', 'AFSO', '/media/img/AFSO_i062hn.webp', 230),
  ('clubs', 'bargny-basket-club', 'Bargny Basket Club', '/media/img/Bargny_Basket_CLUB_eatpyz.webp', 240),
  ('clubs', 'mermoz-bc', 'Mermoz BC', '/media/img/mermoz_basket_club_hnkh10.webp', 250),
  ('clubs', 'hbc', 'HBC', '/media/img/HLM_BASKET_CLUB_yqgifn.webp', 260),
  ('clubs', 'asc-diamaguene', 'ASC Diamaguène', '', 270),
  ('clubs', '16-basket', '16 Basket', '/media/img/16basket_club_vwsz0q.webp', 280),
  ('clubs', 'aeefg', 'AEEFG', '', 290),
  ('clubs', 'tengueth-bc', 'Tengueth BC', '', 300),
  ('clubs', 'rbb', 'RBB', '', 310),
  ('clubs', 'ucad-sc', 'UCAD SC', '/media/img/UCAD_SC_ypdtup.webp', 320),
  ('clubs', 'sup-deco-uso', 'Sup Déco USO', '/media/img/supdeco_basket_club_okzl9p.webp', 330),
  ('clubs', 'dream-star-elite', 'Dream Star Elite', '/media/img/dse_dream_stars_elite_hk3gci.webp', 340),
  ('clubs', 'hann-bel-air', 'Hann Bel Air', '/media/img/HANN_BEL_AIR_vbqpzp.webp', 350),
  ('clubs', 'jaraaf', 'Jaraaf', '/media/img/Jaraaf_Basket_p6zve4.webp', 360),
  ('clubs', 'olympique-ngor', 'Olympique Ngor', '/media/img/olympique_de_ngor_n32bla.webp', 370),
  ('clubs', 'cfamd', 'CFAMD', '/media/img/CFAMD_kzplgd.webp', 380),
  ('clubs', 'us-goree', 'US Gorée', '/media/img/us_goree_nuajp1.webp', 390),
  ('clubs', 'police', 'Police', '/media/img/As_Police_Basketball_cqqs9z.webp', 400),
  ('clubs', 'fabrica', 'Fabrica', '/media/img/fabrica_ldut5k.webp', 410),
  ('clubs', 'dbaloc', 'DBALOC', '/media/img/DBALOC_qsdy7l.webp', 420),
  ('clubs', 'sebi-bc', 'Sebi BC', '/media/img/sebi_basket_club_r2ugcg.webp', 430),
  ('clubs', 'cbac', 'CBAC', '', 440),
  ('clubs', 'rufisque-bc', 'Rufisque BC', '', 450),
  ('clubs', 'sangalkam', 'Sangalkam', '/media/img/sangalkam_basketb_club_noj7c1.webp', 460),
  ('clubs', 'cbc', 'CBC', '', 470),
  ('clubs', 'clacs', 'CLACS', '', 480),
  ('clubs', 'diisso-bc', 'Diisso BC', '/media/img/Disso_Basket_Club_ekzihv.webp', 490),
  ('clubs', 'avenir-thiaroye', 'Avenir Thiaroye', '', 500),
  ('clubs', 'gbc', 'GBC', '', 510),
  ('clubs', 'malika', 'Malika', '/media/img/Malika_Basket_Academy_m16adb.webp', 520),
  ('salles', 'complexe-patrick-semedo', 'Complexe Patrick Semedo', null, 5),
  ('salles', 'stadium-marius-ndiaye', 'Stadium Marius Ndiaye', null, 10),
  ('salles', 'dakar-arena', 'Dakar Arena', null, 20),
  ('salles', 'stade-demba-diop', 'Stade Demba Diop', null, 30),
  ('salles', 'stade-iba-mar-diop', 'Stade Iba Mar Diop', null, 40),
  ('salles', 'stade-leopold-sedar-senghor', 'Stade Léopold Sédar Senghor', null, 50),
  ('salles', 'terrain-de-basket-du-lycee-kennedy', 'Terrain de basket du Lycée Kennedy', null, 60),
  ('salles', 'terrain-de-basket-du-lycee-maurice-delafosse', 'Terrain de basket du Lycée Maurice Delafosse', null, 70),
  ('salles', 'terrain-de-basket-de-la-piscine-olympique', 'Terrain de basket de la Piscine Olympique', null, 80),
  ('salles', 'terrain-de-basket-de-ouakam', 'Terrain de basket de Ouakam', null, 90),
  ('salles', 'terrain-de-basket-de-dieuppeul', 'Terrain de basket de Dieuppeul', null, 100),
  ('salles', 'terrain-de-basket-de-liberte-6', 'Terrain de basket de Liberté 6', null, 110),
  ('salles', 'terrain-de-basket-de-mermoz', 'Terrain de basket de Mermoz', null, 120),
  ('salles', 'terrain-de-basket-de-sicap-karack', 'Terrain de basket de Sicap Karack', null, 130),
  ('salles', 'terrain-de-basket-de-sud-foire', 'Terrain de basket de Sud Foire', null, 140),
  ('salles', 'terrain-de-basket-de-hlm-grand-yoff', 'Terrain de basket de HLM Grand Yoff', null, 150),
  ('salles', 'terrain-de-basket-de-ngor', 'Terrain de basket de Ngor', null, 160),
  ('salles', 'terrain-de-basket-des-almadies', 'Terrain de basket des Almadies', null, 170),
  ('salles', 'terrain-de-basket-de-ouagou-niayes', 'Terrain de basket de Ouagou Niayes', null, 180),
  ('salles', 'terrain-de-basket-des-maristes', 'Terrain de basket des Maristes', null, 190),
  ('salles', 'terrain-de-basket-de-yoff', 'Terrain de basket de Yoff', null, 200),
  ('salles', 'terrain-de-basket-de-thiaroye-azur', 'Terrain de basket de Thiaroye Azur', null, 210),
  ('salles', 'terrain-de-basket-monument-b', 'Terrain de basket Monument B', null, 220),
  ('salles', 'terrain-de-basket-jaon', 'Terrain de basket JAON', null, 230),
  ('salles', 'terrain-de-basket-gba', 'Terrain de basket GBA', null, 240),
  ('salles', 'terrain-de-basket-de-la-residence-de-la-paix-mixta', 'Terrain de basket de la Résidence de la Paix / Mixta', null, 250),
  ('salles', 'terrain-de-basket-de-corniche-ouest', 'Terrain de basket de Corniche Ouest', null, 260),
  ('salles', 'terrain-de-basket-de-l-olympique-club', 'Terrain de basket de l’Olympique Club', null, 270),
  ('salles', 'terrain-de-basket-de-rond-point-maristes', 'Terrain de basket de Rond-Point Maristes', null, 280),
  ('salles', 'terrain-de-basket-de-diofior', 'Terrain de basket de Diofior', null, 290),
  ('salles', 'terrain-de-basket-de-joal-fadiouth', 'Terrain de basket de Joal-Fadiouth', null, 300),
  ('salles', 'terrain-de-basket-de-pire', 'Terrain de basket de Pire', null, 310),
  ('salles', 'terrain-de-basket-de-taiba-ndiaye', 'Terrain de basket de Taïba Ndiaye', null, 320),
  ('salles', 'terrain-de-basket-de-kebemer', 'Terrain de basket de Kébémer', null, 330),
  ('salles', 'terrain-de-basket-de-diourbel', 'Terrain de basket de Diourbel', null, 340),
  ('salles', 'salle-iam-gba-guediawaye', 'Salle IAM GBA (Guédiawaye)', null, 350),
  ('salles', 'salle-flying-star-dakar', 'Salle Flying Star (Dakar)', null, 360),
  ('salles', 'salle-ucad-dakar', 'Salle UCAD (Dakar)', null, 370),
  ('salles', 'salle-us-ept-thies', 'Salle US EPT (Thiès)', null, 380),
  ('salles', 'salle-de-thies', 'Salle de Thiès', null, 390),
  ('salles', 'salle-de-mbour', 'Salle de Mbour', null, 400),
  ('salles', 'salle-de-louga', 'Salle de Louga', null, 410),
  ('salles', 'salle-de-l-universite-gaston-berger-ugb-saint-louis', 'Salle de l''Université Gaston Berger – UGB (Saint-Louis)', null, 420),
  ('salles', 'salle-de-ziguinchor-sports', 'Salle de Ziguinchor Sports', null, 430),
  ('tarifs', 'entree-standard', 'Entrée standard', '1000', 10),
  ('tarifs', 'tribune-officielle', 'Tribune officielle', '2000', 20),
  ('tarifs', 'virages', 'Virages', '3000', 30),
  ('tarifs', 'tribune', 'Tribune', '5000', 40),
  ('tarifs', 'annexes', 'Annexes', '10000', 50),
  ('tarifs', 'loge', 'Loge', '30000', 60),
  ('tarifs', 'courtside', 'Courtside', '50000', 70),
  ('pieces', 'photo', 'Photo d''identité', 'Pour la licence et la fiche de l''enfant.', 10),
  ('pieces', 'naissance', 'Extrait de naissance', 'Justifie la catégorie d''âge.', 20),
  ('pieces', 'medical', 'Certificat médical', 'Aptitude à la pratique. Sans lui, l''enfant ne joue pas.', 30),
  ('pieces', 'autorisation', 'Autorisation parentale', 'Signée par le responsable légal.', 40),
  ('paiement', 'especes', 'Espèces', null, 10),
  ('paiement', 'wave', 'Wave', null, 20),
  ('paiement', 'orange_money', 'Orange Money', null, 30),
  ('paiement', 'free_money', 'Free Money', null, 40),
  ('paiement', 'virement', 'Virement', null, 50),
  ('paiement', 'autre', 'Autre', null, 60),
  ('bureau', 'president', 'Président', null, 10),
  ('bureau', 'vp', 'Vice-Président', null, 20),
  ('bureau', 'sg', 'Secrétaire Général', null, 30),
  ('bureau', 'sg_adj', 'Secrétaire Général Adjoint', null, 40),
  ('bureau', 'tres', 'Trésorière', null, 50),
  ('bureau', 'tres_adj', 'Trésorier Adjoint', null, 60),
  ('bureau', 'ds', 'Directeur Sportif', null, 70),
  ('bureau', 'acad', 'Responsable Académie', null, 80),
  ('bureau', 'acad_adj', 'Responsable Académie Adjoint', null, 90),
  ('bureau', 'medical', 'Pôle Médical', null, 100),
  ('bureau', 'logistique', 'Logistique', null, 110),
  ('bureau', 'comm', 'Communication', null, 120),
  ('bureau', 'partenariats', 'Partenariats', null, 130),
  ('bureau', 'conseil', 'Conseil d''administration', null, 140),
  ('tailles', 'XS', 'XS', null, 10),
  ('tailles', 'S', 'S', null, 20),
  ('tailles', 'M', 'M', null, 30),
  ('tailles', 'L', 'L', null, 40),
  ('tailles', 'XL', 'XL', null, 50),
  ('tailles', 'XXL', 'XXL', null, 60),
  ('postes', 'meneur-meneuse', 'Meneur / Meneuse', null, 10),
  ('postes', 'arriere', 'Arrière', null, 20),
  ('postes', 'ailier-ailiere', 'Ailier / Ailière', null, 30),
  ('postes', 'ailier-fort-ailiere-forte', 'Ailier fort / Ailière forte', null, 40),
  ('postes', 'pivot', 'Pivot', null, 50),
  ('couleurs', '#F3EFE6', 'Ivoire', null, 10),
  ('couleurs', '#C6A257', 'Or', null, 20),
  ('couleurs', '#A8D93B', 'Vert', null, 30),
  ('couleurs', '#C7CFC8', 'Gris clair', null, 40),
  ('couleurs', '#93A099', 'Gris', null, 50)
on conflict (liste, cle) do nothing;

alter table club_listes enable row level security;

-- Tout le monde LIT : ces listes servent aussi au site public (les
-- postes du bureau, par exemple). Rien de sensible n'y figure.
drop policy if exists club_listes_lecture on club_listes;
create policy club_listes_lecture on club_listes
  for select using (true);

-- Seul le proprietaire du site ecrit. Pas « un super administrateur » :
-- le proprietaire, celui dont l'adresse est ecrite dans
-- bbc_proprietaire_email().
drop policy if exists club_listes_ecriture on club_listes;
create policy club_listes_ecriture on club_listes
  for all using (bbc_est_proprietaire()) with check (bbc_est_proprietaire());


-- ---------------------------------------------------------------------
--  POSER UNE ENTREE (creation ou modification)
-- ---------------------------------------------------------------------
create or replace function bbc_liste_poser(
  p_liste text, p_cle text, p_libelle text,
  p_valeur text default null, p_ordre int default null)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_ordre int;
begin
  if not bbc_est_proprietaire() then
    raise exception 'Seul le compte proprietaire du site peut modifier les listes.';
  end if;
  if coalesce(trim(p_liste), '') = '' or coalesce(trim(p_cle), '') = '' then
    raise exception 'Une entree a besoin d''une liste et d''une cle.';
  end if;
  if coalesce(trim(p_libelle), '') = '' then
    raise exception 'Une entree a besoin d''un nom.';
  end if;

  -- Sans ordre donne, la nouvelle entree se range a la fin.
  v_ordre := p_ordre;
  if v_ordre is null then
    select coalesce(max(ordre), 0) + 10 into v_ordre from club_listes where liste = p_liste;
  end if;

  insert into club_listes (liste, cle, libelle, valeur, ordre)
  values (p_liste, p_cle, trim(p_libelle), nullif(trim(coalesce(p_valeur, '')), ''), v_ordre)
  on conflict (liste, cle) do update
    set libelle = excluded.libelle,
        valeur  = excluded.valeur,
        ordre   = excluded.ordre;
  return p_cle;
end;
$$;

revoke all on function bbc_liste_poser(text, text, text, text, int) from public;
grant execute on function bbc_liste_poser(text, text, text, text, int) to authenticated;


-- ---------------------------------------------------------------------
--  RETIRER UNE ENTREE
--
--  QUATRE LISTES PORTENT DES CLES QUE D'AUTRES TABLES CITENT. Retirer
--  un moyen de paiement encore inscrit sur des recus, une piece deja
--  recue, un poste occupe, une taille en stock : les enregistrements
--  resteraient, mais plus rien ne saurait dire ce qu'ils veulent dire.
--  On refuse, et on dit pourquoi -- comme pour une casquette que
--  quelqu'un porte encore.
-- ---------------------------------------------------------------------
create or replace function bbc_liste_retirer(p_liste text, p_cle text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare n int;
begin
  if not bbc_est_proprietaire() then
    raise exception 'Seul le compte proprietaire du site peut modifier les listes.';
  end if;

  if p_liste = 'paiement' then
    select count(*) into n from academy_payments where method = p_cle;
    if n > 0 then
      raise exception 'Impossible : % paiement(s) ont ete encaisses par ce moyen. Il doit rester lisible sur les recus.', n;
    end if;
  elsif p_liste = 'pieces' then
    select count(*) into n from academy_documents where kind = p_cle;
    if n > 0 then
      raise exception 'Impossible : % piece(s) de ce type ont deja ete recues.', n;
    end if;
  elsif p_liste = 'bureau' then
    select count(*) into n from org_roles where role_key = p_cle;
    if n > 0 then
      raise exception 'Impossible : ce poste est occupe. Videz-le d''abord dans l''ecran du bureau.';
    end if;
  elsif p_liste = 'tailles' then
    select count(*) into n from products where jsonb_exists(stock, p_cle);
    if n > 0 then
      raise exception 'Impossible : % produit(s) ont encore un stock dans cette taille.', n;
    end if;
  end if;

  delete from club_listes where liste = p_liste and cle = p_cle;
  return p_cle;
end;
$$;

revoke all on function bbc_liste_retirer(text, text) from public;
grant execute on function bbc_liste_retirer(text, text) to authenticated;


-- ---------------------------------------------------------------------
--  REMETTRE UNE LISTE DANS L'ORDRE
--
--  L'ecran envoie les cles dans l'ordre voulu ; on renumerote. Un etat
--  final qui ne depend pas de ce qu'il y avait avant.
-- ---------------------------------------------------------------------
create or replace function bbc_liste_ordonner(p_liste text, p_cles text[])
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare i int;
begin
  if not bbc_est_proprietaire() then
    raise exception 'Seul le compte proprietaire du site peut modifier les listes.';
  end if;
  for i in 1 .. coalesce(array_length(p_cles, 1), 0) loop
    update club_listes set ordre = i * 10
     where liste = p_liste and cle = p_cles[i];
  end loop;
  return coalesce(array_length(p_cles, 1), 0);
end;
$$;

revoke all on function bbc_liste_ordonner(text, text[]) from public;
grant execute on function bbc_liste_ordonner(text, text[]) to authenticated;


-- ---------------------------------------------------------------------
--  VERIFICATION
--
--  select liste, count(*) from club_listes group by liste order by liste;
--
--  Neuf lignes doivent apparaitre :
--    bureau 14, clubs 52, couleurs 5, paiement 6, pieces 4,
--    postes 5, salles 43, tailles 6, tarifs 7
-- =====================================================================
