-- =====================================================================
--  Baobabs Basket Club — Optionnel : le bouton de la carte « Prochain match »
--  pointe encore vers la page Tryouts (valeur enregistrée en base).
--  Ce script le fait pointer vers la nouvelle page Billetterie.
--
--  Équivalent sans SQL : espace gestion → Pages du site → Accueil →
--  « Hero d'accueil » → champ « Carte match · destination du bouton » →
--  remplacer « tryouts » par « billetterie » → Enregistrer.
-- =====================================================================

update site_settings set value = 'billetterie'
 where key = 'hs_ticket_url' and value = 'tryouts';

-- Si un lien de footer intitulé « Billetterie » pointe aussi vers tryouts :
--   update site_settings set value='billetterie'
--    where key like 'fc%_l%_url' and value='tryouts';
