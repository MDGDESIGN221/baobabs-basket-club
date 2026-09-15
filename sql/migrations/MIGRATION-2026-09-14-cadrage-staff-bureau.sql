-- =====================================================================
--  LE CADRAGE A LA SOURIS : staff et bureau
--  --------------------------------------------------------------------
--  Les joueuses (players.photo_x/y/zoom), les actualites
--  (news.image_url_x/y/zoom) et la galerie (gallery.image_x/y/zoom)
--  portaient deja leurs trois nombres de cadrage. Le staff et les
--  titulaires du bureau, non : leur photo etait centree d'office et
--  coupait les visages. Trois colonnes, memes noms que les actualites
--  (le champ + _x, _y, _zoom), ce qui permet a l'atelier generique des
--  collections de les prendre en charge sans code a part.
--  Sans valeur, le site continue de centrer : rien ne change tant que
--  personne n'a cadre.
-- =====================================================================

alter table public.staff
  add column if not exists photo_url_x    integer,
  add column if not exists photo_url_y    integer,
  add column if not exists photo_url_zoom integer;

alter table public.org_roles
  add column if not exists photo_url_x    integer,
  add column if not exists photo_url_y    integer,
  add column if not exists photo_url_zoom integer;
