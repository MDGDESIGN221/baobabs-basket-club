-- =====================================================================
--  REMISE EN ETAT : LA PHOTO DE MAREME DIAKHATE
--  --------------------------------------------------------------------
--  Ce n'est pas une migration, c'est une reparation, et elle est de ma
--  faute. En cherchant pourquoi l'enregistrement d'une fiche echouait,
--  j'ai clique « Enregistrer » sur sa fiche dans l'admin. Le champ
--  « Photo (adresse) » s'y affichait vide -- la fiche chargee dans mon
--  onglet datait d'avant la publication faite ailleurs -- et
--  l'enregistrement a envoye null par-dessus l'adresse reelle.
--
--  Rien n'est perdu : le journal d'audit a garde l'ancienne valeur, et
--  c'est elle qu'on repose ici. L'etat du dossier repasse a « publiee »,
--  qu'il avait avant.
--
--  LE DEFAUT DE FOND EST CORRIGE dans l'admin : un champ vide qui etait
--  DEJA vide a l'affichage n'est plus envoye du tout, donc il ne peut
--  plus ecraser une valeur que personne n'a vue. Effacer une adresse
--  qu'on a sous les yeux reste possible.
--
--  A EXECUTER DANS L'EDITEUR SQL DE SUPABASE.
-- =====================================================================

update public.players set
  photo_url  = 'https://lmwbwasupqkvswukieav.supabase.co/storage/v1/object/public/site-media/joueuses/1789587655458-Mareme_Diakhate.webp',
  fiche_etat = 'publiee'
 where id = '29a5c9a9-0cc1-4960-b577-53509ffd500a'
returning name, photo_url, fiche_etat;

-- Attendu : une ligne, Mareme Diakhate, son adresse de photo, publiee.


-- ---------------------------------------------------------------------
--  AU PASSAGE : Y A-T-IL D'AUTRES FICHES PUBLIEES SANS PHOTO ?
--  ---------------------------------------------------------------------
--  Si le meme accident s'est produit ailleurs, il se voit ici. Le
--  journal d'audit garde chaque ancienne valeur : chercher
--  field_key = 'photo_url' et new_value vide.
-- ---------------------------------------------------------------------
--   select name, fiche_etat, photo_source_url
--     from public.players
--    where fiche_etat = 'publiee' and photo_url is null
--    order by name;
