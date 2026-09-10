-- =====================================================================
--  Baobabs Basket Club — Le tournoi de Nouakchott
--  Le 10 septembre 2026
--
--  A passer UNE FOIS dans Supabase > SQL Editor > New query > Run.
--  Sans danger si vous la repassez : l'article n'est pose qu'une fois,
--  et les reglages ne sont pas ecrases.
-- =====================================================================
--
--  CE QUE CE FICHIER FAIT, EN DEUX TEMPS
--
--    1. Il ecrit l'ARTICLE dans les actualites du site. C'est lui que le
--       bouton « Lire l'actualite » du bloc d'accueil va chercher.
--    2. Il allume le bloc « A LA UNE » de la page d'accueil, avec ses
--       dates, son lieu, son programme et sa date de peremption.
--
--  Tout est modifiable ensuite depuis l'administration, sans SQL :
--  l'article dans « Actualites », le bloc dans « Pages du site >
--  Accueil > A la une ».
--
--  LE BLOC SE RETIRE TOUT SEUL. « ev_fin » porte le dernier jour ou il a
--  un sens — ici le 29 septembre. Passe cette date, le site le masque
--  sans que personne ait a y penser. Un tournoi termine qui reste en
--  tete de la page d'accueil fait douter de tout le reste de la page.
-- ---------------------------------------------------------------------


-- =====================================================================
-- 1. L'ARTICLE
--
--    Le corps est en <p> : l'article de la page Actualites leur donne
--    une lettrine et une colonne de lecture bornee. Un texte livre en
--    un seul bloc perdrait les deux.
--
--    « where not exists » sur le slug : repasser ce fichier ne cree pas
--    un doublon, et n'ecrase pas les corrections que vous auriez faites
--    depuis l'administration.
-- =====================================================================
insert into news (title, slug, excerpt, body, image_url, image_alt, category, author, status, published_at, sort)
select
  'Cap sur Nouakchott : les Baobabs au tournoi Women''s Sport International',
  'cap-sur-nouakchott-tournoi-women-s-sport-international',
  'Du 23 au 29 septembre, le club dakarois porte les couleurs du Sénégal au tournoi international de basketball féminin de Nouakchott, aux côtés de la Mauritanie, de la Gambie, de la Tunisie, du Maroc et du Mali.',

  -- Les paragraphes sont recolles avec « || » plutot que poses cote a
  -- cote : la concatenation implicite de deux litteraux depend d'un
  -- retour a la ligne, et se casse au premier reformatage.
  '<p>Les Baobabs quittent Dakar. Du <b>23 au 29 septembre 2026</b>, l''équipe est attendue à Nouakchott pour le <b>Tournoi Women''s Sport International de basketball féminin</b>, organisé par Women Sport RIM. Six nations y sont engagées : la Mauritanie, la Gambie, la Tunisie, le Maroc, le Mali et le Sénégal. Ce sont les couleurs sénégalaises que le club portera une semaine durant.</p>' ||
  '<p>Tout se joue au <b>terrain de basket de Nouakchott</b>, l''ancienne Maison des Jeunes. Le tournoi avance sous un thème que le club n''a pas eu besoin de s''approprier : <i>« Sport au féminin, vecteur d''espoir et de leadership »</i>. C''est à peu près la phrase qu''on entend sur le terrain des Baobabs depuis le premier jour.</p>' ||
  '<p><b>Le 23 septembre, l''ouverture.</b> Un concert, et un don du sang : l''entrée au terrain se fait contre des kits scolaires. La compétition commence donc par deux gestes qui ne se comptent pas au tableau d''affichage.</p>' ||
  '<p><b>Du 24 au 27 septembre, les matchs, puis la finale.</b> L''entrée au terrain est gratuite pendant toute cette phase. Il n''y a ni billet à réserver, ni guichet : on se présente à l''entrée.</p>' ||
  '<p><b>Le 28 septembre, la soirée de clôture</b> à l''hôtel Sheraton, sur entrée à 2 000 MRU.</p>' ||
  '<p>Pour un club fondé en 2026, une semaine à l''étranger contre cinq autres nations n''est pas une ligne de plus au calendrier. C''est la première fois que les Baobabs mesurent leur travail ailleurs que dans le championnat sénégalais, et devant un public qui ne les connaît pas. Le club partira avec ce qu''il a construit depuis la reprise : un collectif jeune, une défense qui court, et l''habitude de jouer à plusieurs.</p>' ||
  '<p>Le programme complet et les horaires figurent sur l''affiche du tournoi. Pour toute information sur place : <b>+222 36 84 96 31</b>.</p>',

  '/media/img/tournoi-nouakchott-2026.webp',
  'Affiche du Tournoi Women''s Sport International de basketball féminin, Nouakchott, du 23 au 29 septembre 2026',
  -- Les quatre rubriques posees a l'installation sont Match, Club,
  -- Recrutement et Boutique. Une rubrique inventee ici s'afficherait
  -- sans couleur dans l'administration.
  'Match',
  'Baobabs Basket Club',
  'publie',
  '2026-09-10'::date,
  -- « sort » range les actualites sur l'accueil : 0 la met en tete.
  0
where not exists (
  select 1 from news
   where slug = 'cap-sur-nouakchott-tournoi-women-s-sport-international'
      or title = 'Cap sur Nouakchott : les Baobabs au tournoi Women''s Sport International'
);


-- =====================================================================
-- 2. LE BLOC « A LA UNE » DE L'ACCUEIL
--
--    Un reglage par ligne, comme partout ailleurs dans site_settings.
--    « on conflict do nothing » : si vous avez deja retouche un de ces
--    textes dans l'administration, repasser ce fichier ne l'ecrase pas.
--
--    LES NATIONS s'ecrivent sur une ligne, separees par des virgules.
--    L'ETOILE devant un nom designe celle du club : elle seule porte
--    l'or. Un second reglage aurait pu se desynchroniser du premier.
-- =====================================================================
insert into site_settings (key, value) values
  ('ev_show',        'oui'),
  ('ev_fin',         '2026-09-29'),
  ('ev_datetime',    '2026-09-23T09:00'),

  ('ev_kicker',      'À la une · Tournoi international'),
  ('ev_title',       'CAP SUR NOUAKCHOTT'),
  ('ev_text',        'Du 23 au 29 septembre, les Baobabs portent les couleurs du Sénégal au Tournoi Women''s Sport International de basketball féminin. Six nations, une semaine, un terrain : celui de Nouakchott.'),

  ('ev_nations',     'Mauritanie, Gambie, Tunisie, Maroc, Mali, *Sénégal'),
  ('ev_dates',       '23 → 29 septembre 2026'),
  ('ev_place',       'Terrain de basket de Nouakchott'),
  ('ev_org',         'Women Sport RIM'),
  ('ev_theme',       'Sport au féminin, vecteur d''espoir et de leadership'),

  ('ev_p1_jour',     '23 septembre'),
  ('ev_p1_texte',    'Ouverture : concert et don du sang.'),
  ('ev_p1_entree',   'Entrée : kits scolaires'),
  ('ev_p2_jour',     '24 → 27 septembre'),
  ('ev_p2_texte',    'Les matchs, puis la finale.'),
  ('ev_p2_entree',   'Entrée gratuite'),
  ('ev_p3_jour',     '28 septembre'),
  ('ev_p3_texte',    'Soirée de clôture à l''hôtel Sheraton.'),
  ('ev_p3_entree',   '2 000 MRU'),

  ('ev_poster_url',      '/media/img/tournoi-nouakchott-2026-t.webp'),
  ('ev_poster_full_url', '/media/img/tournoi-nouakchott-2026.webp'),
  ('ev_poster_alt',      'Affiche du Tournoi Women''s Sport International de basketball féminin, Nouakchott, du 23 au 29 septembre 2026'),
  ('ev_affiche_label',   'Voir l''affiche'),

  ('ev_cta_label',   'Lire l''actualité'),
  ('ev_cta_nav',     'actualites'),
  ('ev_tel',         '+222 36 84 96 31')
on conflict (key) do nothing;


-- =====================================================================
--  Verification apres execution :
--    select title, slug, status, published_at from news order by published_at desc limit 3;
--    select key, value from site_settings where key like 'ev\_%' order by key;
--
--  Puis sur le site : la page d'accueil doit porter le bloc « A LA UNE »
--  juste sous la carte du direct, et « Lire l'actualite » doit ouvrir
--  l'article.
--
--  POUR RETIRER LE BLOC AVANT LE 29 : administration > Pages du site >
--  Accueil > A la une > « Afficher le bloc » = non. Ou, en SQL :
--    update site_settings set value = 'non' where key = 'ev_show';
-- =====================================================================
