-- =====================================================================
--  Baobabs Basket Club — Evenements : l'ordre, et l'article vise
--  Le 10 septembre 2026
--
--  A passer APRES MIGRATION-evenements.sql, dans Supabase.
--  Sans danger si vous la repassez.
-- =====================================================================
--
--  DEUX MANQUES, TROUVES A L'USAGE.
--
--  1. L'ORDRE ETAIT CHRONOLOGIQUE. Le site prenait le tournoi le plus
--     proche pour le grand bloc. Or ce n'est pas la date qui decide de
--     ce qu'on met en avant : Nouakchott est un tournoi international a
--     six nations, il passe devant celui de Bopp meme s'il vient apres.
--     La colonne « ordre » existait deja mais arrivait en second dans le
--     tri ; c'est elle qui commande maintenant, et la date ne sert plus
--     qu'a departager deux evenements de meme rang.
--
--  2. LE BOUTON MENAIT A LA LISTE. « Lire l'actualite » ouvrait la page
--     Actualites, au visiteur de retrouver le bon article. La colonne
--     « article_slug » le mene directement au bon.
-- ---------------------------------------------------------------------

alter table evenements
  add column if not exists article_slug text;

comment on column evenements.article_slug is
  'L''adresse lisible de l''article a ouvrir (news.slug). Vide : le bouton mene a la liste des actualites.';


-- ---------------------------------------------------------------------
--  L'ordre voulu : Nouakchott en grand, Bopp en dessous.
--  Plus le nombre est petit, plus l'evenement passe en avant.
-- ---------------------------------------------------------------------
update evenements set ordre = 10,
       article_slug = 'cap-sur-nouakchott-tournoi-women-s-sport-international'
 where titre = 'CAP SUR NOUAKCHOTT';

update evenements set ordre = 20,
       article_slug = 'dekkil-rapatak-tournoi-de-bopp'
 where titre = 'DEKKIL RAPATAK';


-- =====================================================================
--  Verification apres execution :
--    select ordre, titre, article_slug from evenements order by ordre;
--
--  Puis sur le site : l'accueil doit porter CAP SUR NOUAKCHOTT en grand,
--  et DEKKIL RAPATAK en une ligne dessous, avec sa miniature. Les deux
--  boutons doivent ouvrir directement leur article.
--
--  POUR CHANGER CE QUI PASSE EN TETE : donnez-lui le plus petit
--  « ordre ». En SQL :
--    update evenements set ordre = 5 where titre = '...';
-- =====================================================================
