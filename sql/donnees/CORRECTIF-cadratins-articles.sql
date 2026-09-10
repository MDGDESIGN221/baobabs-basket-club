-- =====================================================================
--  Baobabs Basket Club — Les cadratins quittent les articles
--  Le 10 septembre 2026
--
--  A passer dans Supabase > SQL Editor > New query > Run.
--  Sans danger si vous le repassez : « replace » ne trouve plus rien.
-- =====================================================================
--
--  L'article de Nouakchott a ete pose en base AVANT que les cadratins
--  n'en soient retires du fichier. Les corriger dans le fichier ne
--  changeait donc plus rien : c'est la base que le site affiche.
--
--  Chaque tiret est remplace par la ponctuation que SA phrase demande,
--  jamais par un trait d'union : deux-points quand il annonce une liste,
--  point quand il separe deux propositions.
-- ---------------------------------------------------------------------

update news
   set body = replace(
                replace(body,
                  'Six nations y sont engagées — la Mauritanie, la Gambie, la Tunisie, le Maroc, le Mali et le Sénégal — et ce sont les couleurs sénégalaises que le club portera une semaine durant.',
                  'Six nations y sont engagées : la Mauritanie, la Gambie, la Tunisie, le Maroc, le Mali et le Sénégal. Ce sont les couleurs sénégalaises que le club portera une semaine durant.'),
                'gratuite pendant toute cette phase — il n''y a ni billet à réserver',
                'gratuite pendant toute cette phase. Il n''y a ni billet à réserver')
 where slug = 'cap-sur-nouakchott-tournoi-women-s-sport-international';


-- ---------------------------------------------------------------------
--  Le filet : s'il reste un cadratin dans un article, cette requete le
--  montre. Elle ne corrige rien, elle previent.
-- ---------------------------------------------------------------------
-- select slug, title from news
--  where body like '%—%' or excerpt like '%—%' or title like '%—%';


-- =====================================================================
--  Verification apres execution : la requete ci-dessus, decommentee,
--  ne doit plus rien renvoyer.
-- =====================================================================
