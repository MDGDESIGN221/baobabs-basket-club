-- =====================================================================
--  Baobabs Basket Club — Le tournoi Dekkil Rapatak (Bopp)
--  Le 10 septembre 2026
--
--  A passer UNE FOIS dans Supabase > SQL Editor > New query > Run.
--  Sans danger si vous la repassez : l'article n'est pose qu'une fois.
--
--  A passer APRES MIGRATION-evenements.sql, qui porte le bloc d'accueil.
-- =====================================================================
--
--  L'article que le bouton « Lire l'actualite » du bloc va chercher.
--  Le corps est en <p> : la page Actualites leur donne une lettrine et
--  une colonne de lecture bornee a 68 signes.
-- ---------------------------------------------------------------------

insert into news (title, slug, excerpt, body, image_url, image_alt, category, author, status, published_at, sort)
select
  'Dekkil Rapatak : les Baobabs au tournoi de Bopp, du 18 au 20 septembre',
  'dekkil-rapatak-tournoi-de-bopp',
  'Seize équipes, huit filles et huit garçons, deux trophées. Le week-end du 18 au 20 septembre, les Baobabs jouent la première édition du Dekkil Rapatak, au terrain de Bopp.',

  '<p>Trois jours de basket à Bopp. Du <b>18 au 20 septembre 2026</b>, les Baobabs jouent la première édition du <b>Dekkil Rapatak</b>, le tournoi des passionnés de basket, au terrain de Bopp Dakar. Seize équipes sont engagées, huit chez les filles et huit chez les garçons, pour deux trophées.</p>' ||
  '<p>L''objectif que les organisateurs affichent est simple, et il tient en une ligne : occuper les jeunes compétiteurs pendant les vacances. C''est une raison suffisante pour y être. Le club y va avec ses équipes de jeunes autant qu''avec ses cadres.</p>' ||
  '<p><b>Sur le terrain.</b> Le tournoi ne se limite pas aux matchs : un dunk contest et un concours à 3 points sont au programme, avec des joueurs du basket local et international.</p>' ||
  '<p><b>Autour du terrain.</b> Un show rap et hip-hop, animé par PI &amp; JI. Les organisateurs attendent plus de 500 spectateurs sur le week-end.</p>' ||
  '<p>Cinq jours après la fin du tournoi, l''équipe sera à Nouakchott pour le Tournoi Women''s Sport International. Deux compétitions en dix jours, dans le même mois de septembre : la saison commence fort.</p>',

  '/media/img/tournoi-dekkil-rapatak-2026.webp',
  'Affiche de la première édition du tournoi Dekkil Rapatak, terrain de Bopp, Dakar, du 18 au 20 septembre 2026',
  'Match',
  'Baobabs Basket Club',
  'publie',
  '2026-09-10'::date,
  -- 0 le met en tete de l'accueil : c'est le tournoi le plus proche.
  0
where not exists (
  select 1 from news
   where slug = 'dekkil-rapatak-tournoi-de-bopp'
      or title = 'Dekkil Rapatak : les Baobabs au tournoi de Bopp, du 18 au 20 septembre'
);

-- L'article de Nouakchott passe en second sur l'accueil : son tournoi
-- vient apres. Sans effet s'il n'a pas encore ete pose.
update news set sort = 1
 where slug = 'cap-sur-nouakchott-tournoi-women-s-sport-international';


-- =====================================================================
--  Verification apres execution :
--    select title, sort, status, published_at from news order by sort limit 4;
-- =====================================================================
