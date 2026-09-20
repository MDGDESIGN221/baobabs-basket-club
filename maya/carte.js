/* =====================================================================
   LA CARTE DE LA MAISON
   ---------------------------------------------------------------------
   ECRIT PAR UNE MACHINE. Ne pas modifier a la main :
       node outils/fabrique-carte.js
   le refait depuis le depot, et ecrasera toute retouche.

   C'est ce que MAYA sait de la maison SANS rien lire en base : quelles
   tables existent, qui s'en sert, quelles colonnes les ecrans lisent,
   quels ecrans existent et sous quel module de droits, et quel fichier
   fait quoi. Les chiffres, eux, se demandent a la base au moment ou on
   les demande, sous les droits de la session -- jamais d'ici.

   AUCUNE DONNEE DU CLUB ICI. Des noms, des chemins, des tailles. Le
   depot est public ; ce fichier doit pouvoir l'etre.

   Releve du 2026-09-20 : 68 tables,
   52 ecrans, 177 fichiers.
   ===================================================================== */
(function () {
  'use strict';
  var G = window.BaobabsMaya;
  if (!G) { if (window.console) console.warn('[MAYA] carte.js sans noyau'); return; }
  G.carte = {
 "fait": "2026-09-20",
 "tables": [
  {
   "n": "academy_attendance",
   "module": "inscriptions",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "session_id"
   ],
   "perso": []
  },
  {
   "n": "academy_documents",
   "module": "inscriptions",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "url"
   ],
   "perso": []
  },
  {
   "n": "academy_events",
   "module": "inscriptions",
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "academy_payments",
   "module": "inscriptions",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "academy_registrations",
   "module": "inscriptions",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "created_at",
    "medical_recu",
    "status"
   ],
   "perso": []
  },
  {
   "n": "academy_schedule",
   "module": "inscriptions",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "academy_sessions",
   "module": "inscriptions",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "cancelled",
    "category",
    "id",
    "session_date",
    "start_time"
   ],
   "perso": []
  },
  {
   "n": "admin_roles",
   "module": null,
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "id",
    "nom",
    "ordre",
    "resume",
    "systeme"
   ],
   "perso": []
  },
  {
   "n": "admin_users",
   "module": null,
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "email",
    "nom",
    "photo_url",
    "photo_x",
    "photo_y",
    "photo_zoom",
    "role",
    "user_id"
   ],
   "perso": [
    "email"
   ]
  },
  {
   "n": "announcements",
   "module": "contenu",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "articles_admin",
   "module": "contenu",
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "banners",
   "module": "contenu",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "sort"
   ],
   "perso": []
  },
  {
   "n": "caisse_mouvements",
   "module": "caisse",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "candidatures_admin",
   "module": "recrutement",
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "clients_admin",
   "module": "boutique",
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "club_audience_mois",
   "module": "analytics",
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "club_listes",
   "module": "reglages",
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "cle",
    "libelle",
    "liste",
    "ordre",
    "valeur"
   ],
   "perso": []
  },
  {
   "n": "club_recettes_mois",
   "module": "caisse",
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "collecte_campagnes",
   "module": "effectif",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "collecte_suivi",
   "module": "effectif",
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "campagne_id",
    "fiche_etat"
   ],
   "perso": []
  },
  {
   "n": "commandes_admin",
   "module": "boutique",
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "contact_messages",
   "module": "contenu",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html",
    "index.html"
   ],
   "colonnes": [
    "created_at",
    "is_read"
   ],
   "perso": []
  },
  {
   "n": "customers",
   "module": "boutique",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "effectif_admin",
   "module": "effectif",
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "evenements",
   "module": "contenu",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "actif",
    "affiche_pleine_url",
    "affiche_url",
    "dates",
    "debut",
    "fin",
    "id",
    "kicker",
    "lieu",
    "nations",
    "organisateur",
    "titre"
   ],
   "perso": []
  },
  {
   "n": "gallery",
   "module": "contenu",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "inscriptions_admin",
   "module": "inscriptions",
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "category",
    "created_at",
    "fee_monthly_fcfa",
    "full_name",
    "id",
    "inscription_payee",
    "jours_depuis_reception",
    "medical_recu",
    "periodes_payees",
    "status"
   ],
   "perso": []
  },
  {
   "n": "match_center",
   "module": "matchs",
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "id",
    "is_home",
    "issue",
    "match_date",
    "match_time",
    "opponent_name",
    "score_baobabs",
    "score_opponent",
    "statut",
    "venue"
   ],
   "perso": []
  },
  {
   "n": "match_convocations",
   "module": "matchs",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "match_id",
    "player_id",
    "statut"
   ],
   "perso": []
  },
  {
   "n": "match_events",
   "module": "matchs",
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "clock",
    "created_at",
    "id",
    "kind",
    "period",
    "player_id",
    "points",
    "team"
   ],
   "perso": []
  },
  {
   "n": "match_live",
   "module": "matchs",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "is_live",
    "match_id",
    "updated_at"
   ],
   "perso": []
  },
  {
   "n": "match_stats",
   "module": "matchs",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "id",
    "is_captain",
    "is_starter",
    "lineup_sort",
    "match_date",
    "matches",
    "played",
    "player_id",
    "players",
    "score_baobabs",
    "score_opponent",
    "stl"
   ],
   "perso": []
  },
  {
   "n": "matches",
   "module": "matchs",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "competition",
    "id",
    "is_home",
    "match_date",
    "match_time",
    "opponent_logo_url",
    "opponent_name",
    "photo_url",
    "round_label",
    "score_baobabs",
    "score_opponent",
    "stream_url",
    "venue"
   ],
   "perso": []
  },
  {
   "n": "maya_questions",
   "module": null,
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "intention",
    "texte"
   ],
   "perso": []
  },
  {
   "n": "news",
   "module": "contenu",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "category",
    "category_id",
    "image_url",
    "published_at",
    "slug",
    "status",
    "title"
   ],
   "perso": []
  },
  {
   "n": "news_categories",
   "module": "contenu",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "newsletter_abonnes",
   "module": "contenu",
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "newsletter_sends",
   "module": "contenu",
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "newsletter_subscribers",
   "module": "contenu",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html",
    "index.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "orders",
   "module": "boutique",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html",
    "index.html"
   ],
   "colonnes": [
    "created_at",
    "customer_name",
    "id",
    "order_number",
    "paid",
    "prepared_at",
    "status",
    "total"
   ],
   "perso": []
  },
  {
   "n": "org_roles",
   "module": "effectif",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "partners",
   "module": "contenu",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "logo_url"
   ],
   "perso": []
  },
  {
   "n": "personnes",
   "module": "effectif",
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "compte_uid",
    "famille",
    "fiche_etat",
    "fonction",
    "genre",
    "id",
    "nom",
    "numero",
    "statut"
   ],
   "perso": []
  },
  {
   "n": "player_season_stats",
   "module": "effectif",
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "players",
   "module": "effectif",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "bio",
    "birth_date",
    "birth_year",
    "campagne_id",
    "city",
    "compte_uid",
    "fiche_etat",
    "gender",
    "height",
    "id",
    "jersey_number",
    "licence_num",
    "name",
    "photo_source_url",
    "photo_url",
    "photo_x",
    "photo_y",
    "photo_zoom",
    "position",
    "positions",
    "reprise_jeton",
    "scene_mx",
    "scene_my",
    "scene_mzoom",
    "scene_x",
    "scene_y",
    "scene_zoom",
    "soumis_le",
    "status"
   ],
   "perso": [
    "birth_date",
    "birth_year"
   ]
  },
  {
   "n": "players_contacts",
   "module": "effectif",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "email",
    "phone",
    "player_id"
   ],
   "perso": [
    "email",
    "phone"
   ]
  },
  {
   "n": "players_documents",
   "module": "effectif",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "expires_on",
    "kind",
    "player_id",
    "received_on"
   ],
   "perso": []
  },
  {
   "n": "presentation_joueuses",
   "module": "effectif",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "presentation_staff",
   "module": "effectif",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "presentations",
   "module": "matchs",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "products",
   "module": "boutique",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "name",
    "stock",
    "stock_alert",
    "track_stock"
   ],
   "perso": []
  },
  {
   "n": "produits_admin",
   "module": "boutique",
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "etat_stock",
    "id"
   ],
   "perso": []
  },
  {
   "n": "promo_codes",
   "module": "boutique",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "recruitment_documents",
   "module": "recrutement",
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "recruitment_events",
   "module": "recrutement",
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "recruitment_requests",
   "module": "recrutement",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html",
    "index.html"
   ],
   "colonnes": [
    "category",
    "created_at",
    "full_name",
    "id",
    "status"
   ],
   "perso": []
  },
  {
   "n": "reservations",
   "module": "billetterie",
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "id",
    "status",
    "ticket_offers"
   ],
   "perso": []
  },
  {
   "n": "role_permissions",
   "module": null,
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "action",
    "module",
    "role"
   ],
   "perso": []
  },
  {
   "n": "saisons",
   "module": "matchs",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "debut",
    "etat",
    "fin",
    "label",
    "reprise"
   ],
   "perso": []
  },
  {
   "n": "site_settings",
   "module": "reglages",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "staff",
   "module": "effectif",
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "categorie",
    "compte_uid",
    "fiche_etat",
    "id",
    "joined_at",
    "name",
    "org_role_key",
    "phone",
    "photo_url",
    "qualification",
    "role",
    "sort"
   ],
   "perso": [
    "phone"
   ]
  },
  {
   "n": "standings",
   "module": "matchs",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "id"
   ],
   "perso": []
  },
  {
   "n": "studio_projets",
   "module": "reglages",
   "rattachee": true,
   "ecrit": false,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "doc",
    "est_modele",
    "format",
    "id",
    "modifie_le",
    "nom"
   ],
   "perso": []
  },
  {
   "n": "team_attendance",
   "module": "effectif",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "session_id",
    "start_time",
    "statut",
    "team_sessions",
    "updated_at"
   ],
   "perso": []
  },
  {
   "n": "team_schedule",
   "module": "effectif",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [],
   "perso": []
  },
  {
   "n": "team_sessions",
   "module": "effectif",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "id",
    "session_date"
   ],
   "perso": []
  },
  {
   "n": "teams",
   "module": "matchs",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "id",
    "logo_url",
    "name"
   ],
   "perso": []
  },
  {
   "n": "ticket_offers",
   "module": "billetterie",
   "rattachee": true,
   "ecrit": true,
   "ou": [
    "admin-matchs.html"
   ],
   "colonnes": [
    "id",
    "quota",
    "sold"
   ],
   "perso": []
  }
 ],
 "ecrans": [
  {
   "cle": "dashboard",
   "titre": "Tableau de bord",
   "module": null
  },
  {
   "cle": "newsl",
   "titre": "Newsletter",
   "module": "contenu"
  },
  {
   "cle": "promos",
   "titre": "Codes promo",
   "module": "boutique"
  },
  {
   "cle": "saison",
   "titre": "La saison",
   "module": null
  },
  {
   "cle": "entrainements",
   "titre": "Entraînements",
   "module": "effectif"
  },
  {
   "cle": "caisse",
   "titre": "La caisse",
   "module": "caisse"
  },
  {
   "cle": "parcours",
   "titre": "Le match",
   "module": "matchs"
  },
  {
   "cle": "presentations",
   "titre": "Blocs de l’accueil",
   "module": "matchs"
  },
  {
   "cle": "gameday",
   "titre": "Soir de match",
   "module": "matchs"
  },
  {
   "cle": "teams",
   "titre": "Adversaires",
   "module": "matchs"
  },
  {
   "cle": "live",
   "titre": "Diffusion en direct",
   "module": "matchs"
  },
  {
   "cle": "standings",
   "titre": "Classement",
   "module": "matchs"
  },
  {
   "cle": "coherence",
   "titre": "Cohérence site ↔ admin",
   "module": "reglages"
  },
  {
   "cle": "banners",
   "titre": "Bannières & slider",
   "module": "contenu"
  },
  {
   "cle": "announce",
   "titre": "Bandeau d'annonce",
   "module": "contenu"
  },
  {
   "cle": "squad",
   "titre": "Joueuses",
   "module": "effectif"
  },
  {
   "cle": "products",
   "titre": "Produits",
   "module": "boutique"
  },
  {
   "cle": "stock",
   "titre": "Stock",
   "module": "boutique"
  },
  {
   "cle": "articles",
   "titre": "Articles",
   "module": "contenu"
  },
  {
   "cle": "categories",
   "titre": "Catégories",
   "module": "contenu"
  },
  {
   "cle": "evenements",
   "titre": "Événements — à la une",
   "module": "contenu"
  },
  {
   "cle": "galerie",
   "titre": "Galerie",
   "module": "contenu"
  },
  {
   "cle": "media",
   "titre": "Médiathèque",
   "module": "contenu"
  },
  {
   "cle": "calendar",
   "titre": "Calendrier",
   "module": "matchs"
  },
  {
   "cle": "matches2",
   "titre": "Matchs",
   "module": "matchs"
  },
  {
   "cle": "results",
   "titre": "Résultats à saisir",
   "module": "matchs"
  },
  {
   "cle": "orders2",
   "titre": "Commandes",
   "module": "boutique"
  },
  {
   "cle": "clients",
   "titre": "Clients",
   "module": "boutique"
  },
  {
   "cle": "applications",
   "titre": "Candidatures",
   "module": "recrutement"
  },
  {
   "cle": "collecte",
   "titre": "Collecte des membres",
   "module": "effectif"
  },
  {
   "cle": "tickets",
   "titre": "Billetterie",
   "module": "billetterie"
  },
  {
   "cle": "staff",
   "titre": "Staff",
   "module": "effectif"
  },
  {
   "cle": "timeline",
   "titre": "Notre histoire",
   "module": "contenu"
  },
  {
   "cle": "c_home",
   "titre": "Page d'accueil",
   "module": "contenu"
  },
  {
   "cle": "c_club",
   "titre": "Page « Le Club »",
   "module": "contenu"
  },
  {
   "cle": "c_tryouts",
   "titre": "Page Tryouts",
   "module": "contenu"
  },
  {
   "cle": "c_inscriptions",
   "titre": "Pré-saison & inscriptions",
   "module": "contenu"
  },
  {
   "cle": "ecole",
   "titre": "L'école",
   "module": "inscriptions"
  },
  {
   "cle": "inscriptions",
   "titre": "Inscriptions",
   "module": "inscriptions"
  },
  {
   "cle": "c_app",
   "titre": "Appli mobile",
   "module": "contenu"
  },
  {
   "cle": "c_promo",
   "titre": "Newsletter & bandeau CTA",
   "module": "contenu"
  },
  {
   "cle": "c_legal",
   "titre": "Pied de page & mentions",
   "module": "contenu"
  },
  {
   "cle": "reglages",
   "titre": "Réglages du site",
   "module": "reglages"
  },
  {
   "cle": "founder",
   "titre": "Fondateur",
   "module": "effectif"
  },
  {
   "cle": "bureau",
   "titre": "Bureau / organigramme",
   "module": "effectif"
  },
  {
   "cle": "news",
   "titre": "Actualités",
   "module": "contenu"
  },
  {
   "cle": "partners",
   "titre": "Partenaires",
   "module": "contenu"
  },
  {
   "cle": "forms",
   "titre": "Messages",
   "module": "contenu"
  },
  {
   "cle": "home",
   "titre": "Image du hero",
   "module": "contenu"
  },
  {
   "cle": "audit",
   "titre": "Historique",
   "module": "historique"
  },
  {
   "cle": "comptes",
   "titre": "Comptes & rôles",
   "module": "reglages"
  },
  {
   "cle": "analytics",
   "titre": "Analytics du club",
   "module": "analytics"
  }
 ],
 "fichiers": [
  {
   "f": "admin-matchs.html",
   "l": 39057,
   "o": 2893,
   "t": "L'administration du club",
   "d": "Les 52 ecrans de gestion, en un seul fichier : effectif, matchs, billetterie, ecole, boutique, comptes, contenu du site. Le Studio, le Greffe et MAYA vivent dehors."
  },
  {
   "f": "studio/studio.js",
   "l": 16045,
   "o": 760,
   "t": "BAOBABS STUDIO — moteur d'affiches",
   "d": "Un seul global :"
  },
  {
   "f": "index.html",
   "l": 14714,
   "o": 935,
   "t": "Le site public",
   "d": "La page que voient les visiteurs : accueil, club, competitions, billetterie, inscriptions."
  },
  {
   "f": "greffe/greffe.js",
   "l": 7405,
   "o": 434,
   "t": "LE GREFFE : noyau",
   "d": "Fabrique les actes officiels du club."
  },
  {
   "f": "tutoriel/tutoriel.js",
   "l": 4371,
   "o": 206,
   "t": "TUTORIEL DE L'ADMINISTRATION",
   "d": "Un seul global :"
  },
  {
   "f": "propositions/tutoriel-mecaniques.html",
   "l": 3417,
   "o": 173,
   "t": "Palette : celle de l'administration Baobabs, reprise telle quelle.",
   "d": "Parti pris assumé :"
  },
  {
   "f": "maya/carte.js",
   "l": 2555,
   "o": 60,
   "t": "LA CARTE DE LA MAISON",
   "d": "ECRIT PAR UNE MACHINE."
  },
  {
   "f": "maya/dialogue.js",
   "l": 1934,
   "o": 94,
   "t": "MAYA : lui parler",
   "d": "Le panneau, le fil de la conversation, et ce qu'elle repond."
  },
  {
   "f": "studio/studio.css",
   "l": 1857,
   "o": 64,
   "t": "BAOBABS STUDIO — feuille de style",
   "d": "Racine unique :"
  },
  {
   "f": "greffe/blocs.js",
   "l": 1672,
   "o": 101,
   "t": "LE GREFFE : bibliothèque de blocs",
   "d": "POURQUOI CE FICHIER EXISTE La première version écrivait le HTML de l'ordre de mission à la main, avec ses six colonnes cousues dans trois endroits différents :"
  },
  {
   "f": "greffe/greffe.css",
   "l": 1497,
   "o": 86,
   "t": "LE GREFFE : feuille de style",
   "d": "Toutes les règles sont préfixées .gf- et vivent sous #bgreffe."
  },
  {
   "f": "sql/migrations/MIGRATION-TOUT-EN-UN.sql",
   "l": 1263,
   "o": 48,
   "t": "BAOBABS BASKET CLUB",
   "d": "MIGRATION COMPLÈTE — un seul fichier, à exécuter une seule fois 27 juillet 2026 COMMENT FAIRE 1."
  },
  {
   "f": "maya/comprendre.js",
   "l": 1203,
   "o": 61,
   "t": "MAYA : comprendre ce qu'on lui dit",
   "d": "Aucune API, aucun modele de langage, aucun appel sortant."
  },
  {
   "f": "tutoriel/tutoriel.css",
   "l": 1167,
   "o": 60,
   "t": "TUTORIEL DE L'ADMINISTRATION — feuille de style",
   "d": "Racine unique :"
  },
  {
   "f": "joueuse.html",
   "l": 987,
   "o": 48,
   "t": "l'encoche et la barre d'accueil des telephones",
   "d": ""
  },
  {
   "f": "media/index.json",
   "l": 812,
   "o": 21,
   "t": "L'index des medias",
   "d": "La liste des fichiers servis depuis /media, ecrite par un outil."
  },
  {
   "f": "propositions/inscriptions.html",
   "l": 758,
   "o": 49,
   "t": "Jetons repris tels quels de admin-matchs.html : les deux propositions",
   "d": "partagent exactement la même palette."
  },
  {
   "f": "docs/notices/AUDIT-SECURITE-2026-09-17.md",
   "l": 727,
   "o": 34,
   "t": "Audit de sécurité du site et de son administration",
   "d": "17 septembre 2026."
  },
  {
   "f": "sql/migrations/MIGRATION-phase0-socle.sql",
   "l": 602,
   "o": 27,
   "t": "Baobabs Basket Club — PHASE 0 : LE SOCLE",
   "d": "17 août 2026."
  },
  {
   "f": "greffe/modeles/acte-libre.js",
   "l": 574,
   "o": 34,
   "t": "MODÈLE : ACTE LIBRE",
   "d": "Une feuille A4 vierge, et une palette."
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-15-collecte-des-membres.sql",
   "l": 529,
   "o": 25,
   "t": "LA COLLECTE DES MEMBRES DU CLUB",
   "d": "Le club a recrute ses vraies joueuses."
  },
  {
   "f": "maya/maya.js",
   "l": 518,
   "o": 21,
   "t": "MAYA : le noyau",
   "d": "MAYA n'est pas un systeme de plus."
  },
  {
   "f": "sql/correctifs/CORRECTIF-2026-09-17-journal-et-roles.sql",
   "l": 515,
   "o": 23,
   "t": "LE JOURNAL SE FERME, ET LES CASQUETTES DEVIENNENT DES SERRURES",
   "d": "17 septembre 2026."
  },
  {
   "f": "studio/LISEZ-MOI.md",
   "l": 511,
   "o": 22,
   "t": "Baobabs Studio — atelier d'affiches",
   "d": "Trois fichiers, un seul global, aucune étape de compilation."
  },
  {
   "f": "sql/migrations/MIGRATION-inscriptions.sql",
   "l": 464,
   "o": 21,
   "t": "Baobabs Basket Club — Migration : ÉCOLE DE BASKET / INSCRIPTIONS",
   "d": "À exécuter une fois dans Supabase :"
  },
  {
   "f": "sql/correctifs/CORRECTIF-2026-09-17-b-uploads-commandes-promo.sql",
   "l": 419,
   "o": 18,
   "t": "LE RESTE DE L'AUDIT : LES ENVOIS, LES COMMANDES, LES CODES PROMO",
   "d": "17 septembre 2026."
  },
  {
   "f": "tutoriel/banc-essai.html",
   "l": 414,
   "o": 21,
   "t": "Ce fichier n'est PAS livré : il sert à ouvrir le tutoriel hors de",
   "d": "l'administration, sans Supabase et sans connexion."
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-16-la-fiche-recoit-tout.sql",
   "l": 405,
   "o": 21,
   "t": "CE QUI EST ENVOYE ARRIVE JUSQU'A LA FICHE",
   "d": "Un premier profil reel est arrive le 16 septembre 2026."
  },
  {
   "f": "outils/fabrique-carte.js",
   "l": 400,
   "o": 20,
   "t": "LA FABRIQUE DE LA CARTE",
   "d": "node outils/fabrique-carte.js Elle ecrit /maya/carte.js :"
  },
  {
   "f": "sql/migrations/MIGRATION-casquettes.sql",
   "l": 354,
   "o": 15,
   "t": "Baobabs Basket Club — Les casquettes se fabriquent depuis l'admin",
   "d": "7 septembre 2026."
  },
  {
   "f": "cadrage/cadrage.js",
   "l": 353,
   "o": 15,
   "t": "BAOBABS — CADRAGE",
   "d": "Un atelier minuscule :"
  },
  {
   "f": "sql/migrations/MIGRATION-listes.sql",
   "l": 342,
   "o": 18,
   "t": "LES LISTES DU CLUB DEVIENNENT DES DONNEES",
   "d": "Baobabs Basket Club — 7 septembre 2026 A passer UNE FOIS dans Supabase > SQL Editor > New query > Run."
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-18-maya-1-le-lien-qui-manquait.sql",
   "l": 341,
   "o": 17,
   "t": "MAYA · ETAPE 1 : LE LIEN QUI MANQUAIT",
   "d": "18 septembre 2026."
  },
  {
   "f": "greffe/prereglages.js",
   "l": 340,
   "o": 22,
   "t": "LES PRÉRÉGLAGES LIVRÉS AVEC LE GREFFE",
   "d": "Un préréglage = un modèle et ses données, sans numéro :"
  },
  {
   "f": "studio/studio.html",
   "l": 337,
   "o": 26,
   "t": "BAOBABS STUDIO — fragment HTML",
   "d": "Ni <html>, ni <head>, ni <body>, ni <link>, ni <script>."
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-17-fermer-les-fiches.sql",
   "l": 323,
   "o": 16,
   "t": "FERMER LES FICHES DES MEMBRES",
   "d": "17 septembre 2026 CE QUI A ETE MESURE, ET COMMENT Depuis une page vide, sans session, avec la seule cle publique qui est ecrite en clair dans index.html (elle est publique par nature :"
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-15-un-club-un-logo.sql",
   "l": 317,
   "o": 13,
   "t": "UN CLUB, UNE IDENTITE, UN LOGO",
   "d": "MESURE LE 15 SEPTEMBRE 2026, sur le banc, en changeant pour de vrai le logo de HLM Basket Club depuis sa fiche :"
  },
  {
   "f": "greffe/modeles/demande-appui.js",
   "l": 315,
   "o": 15,
   "t": "MODÈLE : DEMANDE D'APPUI",
   "d": "La lettre que le club adresse à un maire, à un élu, à une fondation, à une entreprise, pour faire partir une délégation."
  },
  {
   "f": "tutoriel/banc-cadrage.html",
   "l": 301,
   "o": 14,
   "t": "Banc d'essai : le cadrage",
   "d": "Verifie que le projecteur du tutoriel encadre le bon element."
  },
  {
   "f": "greffe/greffe.html",
   "l": 284,
   "o": 17,
   "t": "LE GREFFE : fragment HTML",
   "d": "Ni <html>, ni <head>, ni <body>, ni <link>, ni <script>."
  },
  {
   "f": "greffe/modeles/ordre-mission.js",
   "l": 282,
   "o": 16,
   "t": "MODÈLE : ORDRE DE MISSION",
   "d": "Plus une ligne de HTML ici."
  },
  {
   "f": "sql/migrations/MIGRATION-phase2c-compte-proprietaire.sql",
   "l": 281,
   "o": 12,
   "t": "Baobabs Basket Club — LE COMPTE DU PROPRIÉTAIRE EST INTOUCHABLE",
   "d": "25 août 2026 — à passer APRÈS MIGRATION-phase0d-rls-par-role.sql Idempotent."
  },
  {
   "f": "docs/briefs/BAOBABS-SHOWREEL-prompt.json",
   "l": 279,
   "o": 15,
   "t": "Brief : le showreel",
   "d": "Les consignes de fabrication d'une video de presentation."
  },
  {
   "f": "propositions/hero.html",
   "l": 277,
   "o": 16,
   "t": "LE HERO REPENSE",
   "d": "Cette page n'est PAS livrée."
  },
  {
   "f": "tutoriel/banc-essai-composition.html",
   "l": 276,
   "o": 14,
   "t": "Ce fichier n'est PAS livré : il sert à ouvrir le composeur de",
   "d": "composition hors de l'administration, sans Supabase et sans connexion — pour juger la planche, essayer le glisser-déposer et lire ce qui PARTIRAIT en base, sans rien écrire nulle part."
  },
  {
   "f": "greffe/modeles/contrat.js",
   "l": 275,
   "o": 16,
   "t": "MODÈLE : CONTRAT D'ENGAGEMENT SPORTIF",
   "d": "Le club d'un côté, une joueuse (ou un joueur) de l'autre, neuf articles, deux signatures."
  },
  {
   "f": "sql/migrations/MIGRATION-billetterie.sql",
   "l": 274,
   "o": 11,
   "t": "Baobabs Basket Club — Migration : BILLETTERIE (lot 2)",
   "d": "À exécuter une fois dans Supabase :"
  },
  {
   "f": "docs/REPRISE-refonte-admin.md",
   "l": 271,
   "o": 12,
   "t": "Reprise — refonte de l'administration et du tutoriel",
   "d": "*État au 2 septembre 2026, fin de session. Écrit pour la session suivante.*"
  },
  {
   "f": "tutoriel/tutoriel.html",
   "l": 270,
   "o": 14,
   "t": "TUTORIEL DE L'ADMINISTRATION — fragment",
   "d": "Chargé à la première ouverture par tutorielCharger(), puis déplacé en enfant direct de <body> :"
  },
  {
   "f": "docs/briefs/BAOBABS-TUTORIEL-ANIMATIONS-brief.md",
   "l": 268,
   "o": 13,
   "t": "Les animations du tutoriel — brief",
   "d": "*Document destiné à être soumis à un autre modèle, pour qu'il propose mieux."
  },
  {
   "f": "greffe/modeles/fiche-fonction.js",
   "l": 266,
   "o": 18,
   "t": "MODÈLE : FICHE DE FONCTION",
   "d": "Attributions, pouvoirs et limites d'un membre du bureau, avec trois visas :"
  },
  {
   "f": "greffe/modeles/convention.js",
   "l": 256,
   "o": 14,
   "t": "MODÈLE : CONVENTION",
   "d": "Deux parties, un objet, des articles, deux signatures."
  },
  {
   "f": "maya/deviner.js",
   "l": 252,
   "o": 12,
   "t": "MAYA — DEVINER CE QU'ON EST EN TRAIN DE TAPER",
   "d": "« Quand on tape, elle devine et propose ce qu'on veut, un peu comme Google."
  },
  {
   "f": "tutoriel/banc-projecteur.html",
   "l": 251,
   "o": 13,
   "t": "Banc d'essai : le projecteur",
   "d": "Verifie la surcouche qui eclaire un element de l'ecran."
  },
  {
   "f": "docs/briefs/BAOBABS-MOTION-brief.json",
   "l": 244,
   "o": 14,
   "t": "Brief : le motion design",
   "d": "Les consignes de fabrication des animations du club."
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-16-chaque-metier-sa-fiche.sql",
   "l": 241,
   "o": 12,
   "t": "CHAQUE METIER A SA FICHE",
   "d": "Le formulaire de collecte ne connaissait que deux branches :"
  },
  {
   "f": "sql/correctifs/CORRECTIF-2026-09-17-d-portes-de-fonctions.sql",
   "l": 240,
   "o": 12,
   "t": "LES PORTES DE FONCTIONS QUE PERSONNE N'AVAIT FERMEES",
   "d": "17 septembre 2026, au soir."
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-15-rubrique-des-articles.sql",
   "l": 235,
   "o": 10,
   "t": "LA RUBRIQUE D'UN ARTICLE SUIT SA CATEGORIE",
   "d": "A jouer APRES MIGRATION-2026-09-15-un-club-un-logo.sql."
  },
  {
   "f": "sql/diagnostics/DIAGNOSTIC-SECURITE-2026-09-17.sql",
   "l": 234,
   "o": 11,
   "t": "DIAGNOSTIC DE SECURITE, 17 septembre 2026",
   "d": "NE MODIFIE RIEN."
  },
  {
   "f": "tutoriel/banc-clic.html",
   "l": 218,
   "o": 9,
   "t": "Banc d'essai : les clics",
   "d": "Verifie que chaque etape pointe une cible qui existe et repond."
  },
  {
   "f": "greffe/modeles/budget.js",
   "l": 217,
   "o": 12,
   "t": "MODÈLE : BUDGET PRÉVISIONNEL",
   "d": "Un seul tableau de lignes, chacune rattachée à un poste ;"
  },
  {
   "f": "docs/briefs/BAOBABS-STUDIO-format-de-livraison.md",
   "l": 216,
   "o": 8,
   "t": "Baobabs Studio — format de livraison attendu",
   "d": "*À remettre à qui produit l'interface. Ce document dit comment livrer les"
  },
  {
   "f": "sql/migrations/MIGRATION-recrutement.sql",
   "l": 216,
   "o": 9,
   "t": "Baobabs Basket Club — Migration : MODULE CANDIDATURES (refonte admin)",
   "d": "À exécuter une fois dans Supabase :"
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-15-une-feuille-vide-n-est-pas-un-match.sql",
   "l": 214,
   "o": 11,
   "t": "UNE FEUILLE VIDE N'EST PAS UN MATCH JOUÉ",
   "d": "Relevé en production le 15 septembre 2026 :"
  },
  {
   "f": "sql/migrations/MIGRATION-inscriptions-2-dossier.sql",
   "l": 204,
   "o": 9,
   "t": "Baobabs Basket Club — ÉCOLE DE BASKET, LOT 2 : LE DOSSIER",
   "d": "17 août 2026 — à passer APRÈS MIGRATION-inscriptions.sql Idempotent."
  },
  {
   "f": "greffe/modeles/rapport-saison.js",
   "l": 202,
   "o": 11,
   "t": "MODÈLE : RAPPORT DE SAISON",
   "d": "Le bilan d'une saison, pour l'assemblée générale ou le bureau :"
  },
  {
   "f": "maya/maya.css",
   "l": 202,
   "o": 10,
   "t": "MAYA : le panneau de dialogue",
   "d": "Il se colle au bord droit plutot que de s'ouvrir au milieu :"
  },
  {
   "f": "sql/migrations/MIGRATION-mon-espace.sql",
   "l": 201,
   "o": 8,
   "t": "Baobabs Basket Club — Migration : LOT 2 (finitions) + LOT 3 (Mon espace)",
   "d": "À exécuter une fois dans Supabase :"
  },
  {
   "f": "sql/diagnostics/AUDIT-HISTORIQUE.sql",
   "l": 196,
   "o": 10,
   "t": "Baobabs Basket Club — Historique des modifications de l'admin",
   "d": "À exécuter UNE FOIS dans Supabase :"
  },
  {
   "f": "sql/migrations/MIGRATION-evenements.sql",
   "l": 194,
   "o": 9,
   "t": "Baobabs Basket Club — Migration : LES ÉVÉNEMENTS",
   "d": "Le 10 septembre 2026 A passer UNE FOIS dans Supabase > SQL Editor > New query > Run."
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-16-trois-familles-de-staff.sql",
   "l": 188,
   "o": 9,
   "t": "TROIS FAMILLES DE STAFF, ET LE BUREAU RELIE A L'ORGANIGRAMME",
   "d": "Quatre liens de collecte existaient :"
  },
  {
   "f": "docs/briefs/BAOBABS-STUDIO-brief.md",
   "l": 184,
   "o": 9,
   "t": "Baobabs Studio — brief projet",
   "d": "*Document destiné à être soumis à un autre modèle pour avis critique."
  },
  {
   "f": "docs/TUTORIEL-ce-que-ca-fait.md",
   "l": 184,
   "o": 8,
   "t": "Ce que fait le tutoriel de l'administration, aujourd'hui",
   "d": "Description factuelle de l'existant, avant d'en discuter l'amélioration."
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-14-saison.sql",
   "l": 184,
   "o": 10,
   "t": "LA SAISON : une ligne par saison, l'etat, le bilan",
   "d": "Rien ne disait « on change d'annee »."
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-16-retrouver-une-image.sql",
   "l": 184,
   "o": 8,
   "t": "RETROUVER UNE IMAGE REMPLACEE PAR ERREUR",
   "d": "Baobabs Basket Club — 16 septembre 2026 LE PROBLEME, DIT PAR CELUI QUI L'A VECU :"
  },
  {
   "f": "sql/migrations/MIGRATION-site-settings.sql",
   "l": 183,
   "o": 5,
   "t": "Baobabs Basket Club — clés de site_settings",
   "d": "Généré depuis index.html et admin-matchs.html — 165 clés."
  },
  {
   "f": "sql/migrations/MIGRATION-phase0d-rls-par-role.sql",
   "l": 176,
   "o": 9,
   "t": "Baobabs Basket Club — PHASE 0, DERNIÈRE DETTE : LES DROITS EN BASE",
   "d": "17 août 2026 — à passer APRÈS MIGRATION-phase0-socle.sql Idempotent."
  },
  {
   "f": "sql/migrations/MIGRATION-lineup-ordre-et-capitaine.sql",
   "l": 172,
   "o": 8,
   "t": "L'ORDRE DE LA PLANCHE, ET LE BRASSARD",
   "d": "À passer dans Supabase → SQL Editor."
  },
  {
   "f": "studio/banc-essai.html",
   "l": 169,
   "o": 8,
   "t": "Ce fichier n'est PAS livré : il sert uniquement à ouvrir le Studio",
   "d": "hors de l'administration pour le tester."
  },
  {
   "f": "docs/briefs/BAOBABS-LINEUP-brief.md",
   "l": 166,
   "o": 7,
   "t": "Le Cinq majeur — brief de design",
   "d": "*Document destiné à un modèle de design, pour qu'il propose une maquette."
  },
  {
   "f": "sql/migrations/MIGRATION-galerie.sql",
   "l": 164,
   "o": 7,
   "t": "LA GALERIE — DES PHOTOS QUI S'AJOUTENT SANS TOUCHER AU CODE",
   "d": "À passer dans Supabase → SQL Editor."
  },
  {
   "f": "sql/diagnostics/DIAGNOSTIC-admin-2026-08-20-b.sql",
   "l": 163,
   "o": 7,
   "t": "Baobabs Basket Club — DIAGNOSTIC de l'administration, version B",
   "d": "20 août 2026 POURQUOI UNE VERSION B La version A enchaînait 7 requêtes."
  },
  {
   "f": "tutoriel/banc.html",
   "l": 161,
   "o": 6,
   "t": "Banc d'essai du tutoriel",
   "d": "Le tutoriel joue seul, hors de l'administration, pour verifier sa voix et son pointage."
  },
  {
   "f": "sql/migrations/MIGRATION-inscriptions-3-depot-pieces.sql",
   "l": 160,
   "o": 7,
   "t": "Baobabs Basket Club — ÉCOLE DE BASKET, LOT 3 : LE DÉPÔT DES PIÈCES",
   "d": "À passer APRÈS MIGRATION-inscriptions-2-dossier.sql Idempotent."
  },
  {
   "f": "sql/migrations/MIGRATION-publications.sql",
   "l": 159,
   "o": 6,
   "t": "Baobabs Basket Club — Migration : PUBLICATIONS",
   "d": "Supabase → SQL Editor → New query → Run."
  },
  {
   "f": "tutoriel/banc-tempo.html",
   "l": 158,
   "o": 8,
   "t": "Banc d'essai : le rythme",
   "d": "Verifie les temps d'attente entre deux etapes."
  },
  {
   "f": "greffe/modeles/courrier.js",
   "l": 157,
   "o": 7,
   "t": "MODÈLE : COURRIER OFFICIEL",
   "d": "Ce fichier existe surtout pour prouver une chose :"
  },
  {
   "f": "sql/migrations/MIGRATION-phase2-analytics.sql",
   "l": 152,
   "o": 7,
   "t": "Baobabs Basket Club — Analytics du club + un correctif",
   "d": "17 août 2026."
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-17-fermer-les-ecritures.sql",
   "l": 151,
   "o": 7,
   "t": "FERMER L'ECRITURE SUR NEUF TABLES GRANDES OUVERTES",
   "d": "17 septembre 2026 CE QUI A ETE MESURE `pg_policies`, sur la vraie base, rend douze tables dont une politique d'ECRITURE n'a aucune condition (`qual` et `with_check` valent `true`) et s'adresse a `public`, `anon` ou `authenticated` :"
  },
  {
   "f": "sql/migrations/MIGRATION-effectif-stock.sql",
   "l": 146,
   "o": 6,
   "t": "Baobabs Basket Club — Migration : EFFECTIF & STOCK",
   "d": "Supabase → SQL Editor → New query → Run."
  },
  {
   "f": "sql/migrations/MIGRATION-bannieres.sql",
   "l": 145,
   "o": 5,
   "t": "Baobabs Basket Club — Migration : BANNIÈRES & SLIDER",
   "d": "Supabase → SQL Editor → New query → Run."
  },
  {
   "f": "cadrage/LISEZ-MOI.md",
   "l": 143,
   "o": 5,
   "t": "Baobabs Cadrage — placer une image dans son cadre",
   "d": "Trois fichiers, un seul global, aucune étape de compilation."
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-19-maya-2-la-memoire.sql",
   "l": 141,
   "o": 6,
   "t": "MAYA · ETAPE 2 : LA MEMOIRE",
   "d": "A coller dans l'editeur SQL de Supabase, d'un seul bloc."
  },
  {
   "f": "sql/migrations/MIGRATION-commandes-clients.sql",
   "l": 141,
   "o": 6,
   "t": "Baobabs Basket Club — Migration : COMMANDES & CLIENTS  (corrigée)",
   "d": "Supabase → SQL Editor → New query → Run."
  },
  {
   "f": "sql/correctifs/CORRECTIF-URGENT-rls-commandes.sql",
   "l": 139,
   "o": 7,
   "t": "Baobabs Basket Club — CORRECTIF DE SÉCURITÉ, À PASSER EN PREMIER",
   "d": "Table orders (commandes de la boutique) — 17 août 2026 CE QUI A ÉTÉ CONSTATÉ, ET VÉRIFIÉ La table orders porte trois politiques héritées, sans restriction de rôle — elles s'appliquent donc à PUBLIC, c'est-à-dire à quiconque possède la clé p"
  },
  {
   "f": "tutoriel/banc-filet.html",
   "l": 139,
   "o": 6,
   "t": "Banc d'essai : le filet",
   "d": "Verifie que le tutoriel n'ecrit jamais dans la base."
  },
  {
   "f": "sql/diagnostics/DIAGNOSTIC-admin-2026-08-20.sql",
   "l": 137,
   "o": 6,
   "t": "Baobabs Basket Club — DIAGNOSTIC de l'administration",
   "d": "20 août 2026 À COLLER DANS SUPABASE :"
  },
  {
   "f": "sql/donnees/SEED-tournoi-nouakchott-2026.sql",
   "l": 134,
   "o": 8,
   "t": "Baobabs Basket Club — Le tournoi de Nouakchott",
   "d": "Le 10 septembre 2026 A passer UNE FOIS dans Supabase > SQL Editor > New query > Run."
  },
  {
   "f": "cadrage/cadrage.css",
   "l": 132,
   "o": 7,
   "t": "BAOBABS — CADRAGE",
   "d": "Tout est sous #bcadrage :"
  },
  {
   "f": "tutoriel/banc-salles.html",
   "l": 129,
   "o": 7,
   "t": "Banc d'essai : les salles",
   "d": "Verifie les noms de salles employes par le tutoriel."
  },
  {
   "f": "sql/correctifs/CORRECTIF-2026-09-17-c-fermer-le-bucket-des-photos.sql",
   "l": 126,
   "o": 6,
   "t": "FERMER LE BUCKET DES PHOTOS AU NAVIGATEUR",
   "d": "17 septembre 2026."
  },
  {
   "f": "greffe/modeles/recu.js",
   "l": 124,
   "o": 7,
   "t": "MODÈLE : REÇU DE PAIEMENT",
   "d": "Une cotisation, une inscription, une vente de maillot :"
  },
  {
   "f": "greffe/modeles/liste-delegation.js",
   "l": 123,
   "o": 8,
   "t": "MODÈLE : LISTE DE LA DÉLÉGATION",
   "d": "Un tournoi, un stage, un déplacement :"
  },
  {
   "f": "greffe/modeles/pv-reunion.js",
   "l": 118,
   "o": 7,
   "t": "MODÈLE : PROCÈS-VERBAL DE RÉUNION",
   "d": "Une réunion du bureau, une assemblée :"
  },
  {
   "f": "cadrage/banc-essai.html",
   "l": 117,
   "o": 5,
   "t": "Page de test autonome. NON livrée en production : elle ne sert qu'à",
   "d": "ouvrir l'atelier sans passer par l'administration ni par Supabase."
  },
  {
   "f": "sql/migrations/MIGRATION-lineup-lecture-publique.sql",
   "l": 116,
   "o": 5,
   "t": "LA COMPOSITION DU PROCHAIN MATCH, LISIBLE PAR LE SITE",
   "d": "À passer dans Supabase → SQL Editor."
  },
  {
   "f": "sql/migrations/MIGRATION-entree-gratuite.sql",
   "l": 115,
   "o": 5,
   "t": "Baobabs Basket Club — Migration : ENTREE GRATUITE",
   "d": "Le 10 septembre 2026 A passer UNE FOIS dans Supabase > SQL Editor > New query > Run."
  },
  {
   "f": "greffe/modeles/fiche-joueuse.js",
   "l": 114,
   "o": 7,
   "t": "MODÈLE : FICHE JOUEUSE",
   "d": "Le dossier d'une joueuse, sur une feuille :"
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-14-parcours-match.sql",
   "l": 114,
   "o": 6,
   "t": "LE MATCH, DE J-7 A J+1 : ce que le parcours a besoin de savoir",
   "d": "L'ecran « Le match » enchaine ce qui existait deja (fiche, cinq, billetterie, direct, resultat, classement) et ce qui manquait :"
  },
  {
   "f": "sql/LISEZ-MOI.md",
   "l": 113,
   "o": 5,
   "t": "SQL — ce qui a façonné la base",
   "d": "52 fichiers, écrits entre le 23 juillet et le 1er septembre 2026. Ils ne"
  },
  {
   "f": "sql/correctifs/CORRECTIF-vue-clients-admin.sql",
   "l": 112,
   "o": 5,
   "t": "Baobabs Basket Club — CORRECTIF : l'écran Clients renvoie 403",
   "d": "20 août 2026 LE SYMPTÔME Ouvrir « Clients » ne charge rien, quel que soit le compte, même super administrateur."
  },
  {
   "f": "greffe/modeles/note-frais.js",
   "l": 111,
   "o": 7,
   "t": "MODÈLE : NOTE DE FRAIS",
   "d": "Un coach a avancé le transport, un dirigeant a payé l'eau du tournoi :"
  },
  {
   "f": "greffe/modeles/demande-subvention.js",
   "l": 108,
   "o": 7,
   "t": "MODÈLE : DEMANDE DE SUBVENTION",
   "d": "À la mairie, à une entreprise, à une fondation :"
  },
  {
   "f": "greffe/modeles/autorisation-parentale.js",
   "l": 107,
   "o": 7,
   "t": "MODÈLE : AUTORISATION PARENTALE",
   "d": "Le formulaire que le club remet aux parents :"
  },
  {
   "f": "greffe/modeles/convocation.js",
   "l": 107,
   "o": 7,
   "t": "MODÈLE : CONVOCATION",
   "d": "Un match, un stage, une assemblée :"
  },
  {
   "f": "sql/migrations/MIGRATION-phase2b-comptes-verrouilles.sql",
   "l": 107,
   "o": 4,
   "t": "Baobabs Basket Club — Verrouiller l'attribution des rôles",
   "d": "17 août 2026."
  },
  {
   "f": "tutoriel/banc-noms.html",
   "l": 104,
   "o": 6,
   "t": "Banc d'essai : les noms",
   "d": "Verifie que le tutoriel ne recopie aucun texte d'ecran."
  },
  {
   "f": "sql/migrations/MIGRATION-comptes-clients.sql",
   "l": 100,
   "o": 5,
   "t": "Baobabs Basket Club — Comptes clients (site public) + rôle admin",
   "d": "À exécuter UNE FOIS dans Supabase :"
  },
  {
   "f": "sql/correctifs/CORRECTIF-2026-09-19-presentations-de-joueuses.sql",
   "l": 98,
   "o": 6,
   "t": "LES PRESENTATIONS DE JOUEUSES",
   "d": "19 septembre 2026 Le Cinq majeur de l'accueil ne sait annoncer qu'une chose :"
  },
  {
   "f": "sql/diagnostics/VERIFIER-compte-proprietaire.sql",
   "l": 97,
   "o": 4,
   "t": "Baobabs — LA SERRURE EST-ELLE BIEN POSÉE ?",
   "d": "À coller dans le SQL Editor de Supabase."
  },
  {
   "f": "docs/FICHE-GOOGLE-a-remplir.md",
   "l": 96,
   "o": 4,
   "t": "La fiche Google du club",
   "d": "Tout ce qu'il faut taper dans Google Business Profile, prêt à copier."
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-15-retirer-un-geste.sql",
   "l": 94,
   "o": 5,
   "t": "RETIRER UN GESTE DU MILIEU DU MATCH",
   "d": "Un soir de match, on ne se trompe pas seulement sur le dernier geste."
  },
  {
   "f": "greffe/modeles/ordre-du-jour.js",
   "l": 93,
   "o": 5,
   "t": "MODÈLE : ORDRE DU JOUR",
   "d": "Ce qu'on envoie avant la réunion :"
  },
  {
   "f": "sql/correctifs/CORRECTIF-2026-09-17-e-voir-les-photos-pour-les-retirer.sql",
   "l": 92,
   "o": 4,
   "t": "LE CLUB DOIT VOIR LES PHOTOS POUR POUVOIR EN RETIRER UNE",
   "d": "17 septembre 2026, au soir."
  },
  {
   "f": "sql/migrations/MIGRATION-session-25-07-2026.sql",
   "l": 91,
   "o": 4,
   "t": "Baobabs Basket Club — Nouvelles clés de site_settings",
   "d": "Session du 25 juillet 2026 Contenu :"
  },
  {
   "f": "sql/migrations/MIGRATION-match-center.sql",
   "l": 90,
   "o": 4,
   "t": "Baobabs Basket Club — Migration : MATCH CENTER  (version corrigée)",
   "d": "À exécuter dans Supabase :"
  },
  {
   "f": "greffe/modeles/invitation.js",
   "l": 89,
   "o": 5,
   "t": "MODÈLE : INVITATION",
   "d": "Le club a l'honneur de vous inviter :"
  },
  {
   "f": "outils/diagnostic-lineup.js",
   "l": 89,
   "o": 4,
   "t": "POURQUOI LA COMPOSITION N'APPARAÎT PAS",
   "d": "À coller dans la console du SITE PUBLIC (pas l'admin)."
  },
  {
   "f": "sql/migrations/MIGRATION-codes-promo.sql",
   "l": 89,
   "o": 4,
   "t": "CODES PROMO — boutique (à exécuter une fois dans Supabase)",
   "d": "Ce que ça pose :"
  },
  {
   "f": "vercel.json",
   "l": 87,
   "o": 4,
   "t": "Le reglage de l'hebergeur",
   "d": "Les en-tetes et les redirections que Vercel applique au site."
  },
  {
   "f": "greffe/modeles/decharge.js",
   "l": 86,
   "o": 6,
   "t": "MODÈLE : DÉCHARGE DE RESPONSABILITÉ",
   "d": "Une sortie, un stage, un prêt de matériel, une joueuse majeure qui s'engage seule :"
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-13-stock-commandes.sql",
   "l": 85,
   "o": 3,
   "t": "COMMANDES <-> STOCK : la liaison qui manquait",
   "d": "Le site enregistre une commande (orders.items :"
  },
  {
   "f": "sql/migrations/MIGRATION-phase1-stats-publiees.sql",
   "l": 85,
   "o": 4,
   "t": "Baobabs Basket Club — Correctif : ne publier que les matchs terminés",
   "d": "17 août 2026 — à passer APRÈS MIGRATION-phase0-socle.sql Idempotent."
  },
  {
   "f": "sql/correctifs/CORRECTIF-rls-candidatures.sql",
   "l": 84,
   "o": 4,
   "t": "Baobabs Basket Club — CORRECTIF DE SÉCURITÉ",
   "d": "Table recruitment_requests (candidatures des Tryouts) 17 août 2026 CE QUI A ÉTÉ CONSTATÉ Une requête faite avec la clé publique du site — celle qui est écrite en clair dans index.html, donc lisible par tout visiteur — renvoie les candidatur"
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-15-qui-sont-les-abonnes.sql",
   "l": 84,
   "o": 4,
   "t": "QUI SONT LES ABONNÉS DE LA LETTRE",
   "d": "L'écran « Newsletter — envoi » affiche « 3 inscrits » et, juste au-dessus du bouton d'envoi, « L'envoi général partira à 3 inscrits »."
  },
  {
   "f": "sql/migrations/MIGRATION-galerie-legendes.sql",
   "l": 84,
   "o": 4,
   "t": "LES LÉGENDES DES DOUZE PHOTOS, REPRISES EN BASE",
   "d": "À passer dans Supabase → SQL Editor, APRÈS MIGRATION-galerie.sql."
  },
  {
   "f": "greffe/modeles/planning.js",
   "l": 81,
   "o": 4,
   "t": "MODÈLE : PLANNING",
   "d": "La semaine du club sur une page :"
  },
  {
   "f": "greffe/modeles/communique.js",
   "l": 80,
   "o": 4,
   "t": "MODÈLE : COMMUNIQUÉ",
   "d": "Une nouvelle que le club rend publique :"
  },
  {
   "f": "greffe/modeles/feuille-presence.js",
   "l": 80,
   "o": 4,
   "t": "MODÈLE : FEUILLE DE PRÉSENCE",
   "d": "Le coach l'imprime en début de mois, la punaise au vestiaire et coche à chaque séance."
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-14-direct-se-rallume.sql",
   "l": 80,
   "o": 4,
   "t": "LE DIRECT SE RALLUME AU PREMIER POINT, MEME APRES UN ESSAI",
   "d": "Trouve le 14 septembre 2026 en repetant le soir de match en vrai :"
  },
  {
   "f": "greffe/modeles/certificat.js",
   "l": 79,
   "o": 4,
   "t": "MODÈLE : CERTIFICAT",
   "d": "Meilleure joueuse du tournoi, bénévole de l'année, participation au stage :"
  },
  {
   "f": "sql/migrations/MIGRATION-studio-projets.sql",
   "l": 75,
   "o": 3,
   "t": "BAOBABS STUDIO — table des projets",
   "d": "À exécuter une fois dans l'éditeur SQL de Supabase."
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-14-joueuse.sql",
   "l": 74,
   "o": 3,
   "t": "LA JOUEUSE : ses documents, ses entrainements",
   "d": "L'ecole avait ses seances et son appel (academy_*), l'equipe n'avait rien :"
  },
  {
   "f": "greffe/modeles/cartes-membre.js",
   "l": 73,
   "o": 4,
   "t": "MODÈLE : CARTES DE MEMBRE",
   "d": "Huit cartes par page, au format carte bancaire, une par ligne du tableau :"
  },
  {
   "f": "sql/correctifs/CORRECTIF-2026-09-19-cinq-majeur-reglage-par-joueuse.sql",
   "l": 71,
   "o": 3,
   "t": "CINQ MAJEUR : LE REGLAGE DE CHAQUE JOUEUSE SUR LA SCENE",
   "d": "19 septembre 2026 Le site mesure chaque silhouette et la pose a la meme hauteur, les pieds sur la meme ligne."
  },
  {
   "f": "sql/migrations/MIGRATION-evenements-2-ordre-et-article.sql",
   "l": 69,
   "o": 3,
   "t": "Baobabs Basket Club — Evenements : l'ordre, et l'article vise",
   "d": "Le 10 septembre 2026 A passer APRES MIGRATION-evenements.sql, dans Supabase."
  },
  {
   "f": "sql/correctifs/CORRECTIF-rls-lecture-argent.sql",
   "l": 68,
   "o": 3,
   "t": "Baobabs Basket Club — Correctif : la LECTURE de l'argent au rôle",
   "d": "17 août 2026 — à passer après CORRECTIF-URGENT-rls-commandes.sql Idempotent."
  },
  {
   "f": "sql/correctifs/CORRECTIF-role-compte-club.sql",
   "l": 67,
   "o": 3,
   "t": "Baobabs Basket Club — CORRECTIF : le compte du club était en lecture seule",
   "d": "20 août 2026 CE QU'ON A TROUVÉ baobabsbasketclub@gmail.com portait le rôle « president »."
  },
  {
   "f": "sql/migrations/MIGRATION-partenaires-reels.sql",
   "l": 64,
   "o": 3,
   "t": "PARTENAIRES RÉELS",
   "d": "Remplace les cinq partenaires fictifs (TotalEnergies, Yas, Eiffage, Ecobank, Auchan) par les deux vrais :"
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-14-ecole-seances.sql",
   "l": 61,
   "o": 3,
   "t": "L'ECOLE DE BASKET, LE MOIS : seances, presences, planning",
   "d": "Les inscriptions savaient qui est inscrit et qui a paye."
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-14-greffe-registre.sql",
   "l": 61,
   "o": 3,
   "t": "LE GREFFE : le registre des actes en base",
   "d": "Jusqu'ici les actes du Greffe vivaient dans IndexedDB, dans UN navigateur :"
  },
  {
   "f": "sql/correctifs/CORRECTIF-logos-adversaires.sql",
   "l": 59,
   "o": 3,
   "t": "CORRECTIF — logos des adversaires restés sur Cloudinary",
   "d": "À exécuter dans Supabase → SQL Editor."
  },
  {
   "f": "sql/migrations/MIGRATION-SUPABASE-v6.sql",
   "l": 57,
   "o": 3,
   "t": "Baobabs Basket Club — Migration Supabase v6  (Photo candidat recrutement)",
   "d": "À exécuter une fois dans Supabase :"
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-14-caisse.sql",
   "l": 53,
   "o": 3,
   "t": "LA CAISSE : recettes, depenses, budget",
   "d": "Les recettes existaient deja, eparpillees :"
  },
  {
   "f": "sql/donnees/SEED-contenu-site.sql",
   "l": 52,
   "o": 6,
   "t": "Baobabs Basket Club — Injection du contenu actuel du site dans la base",
   "d": "À exécuter UNE FOIS dans Supabase :"
  },
  {
   "f": "sql/donnees/SEED-tournoi-dekkil-rapatak-2026.sql",
   "l": 52,
   "o": 3,
   "t": "Baobabs Basket Club — Le tournoi Dekkil Rapatak (Bopp)",
   "d": "Le 10 septembre 2026 A passer UNE FOIS dans Supabase > SQL Editor > New query > Run."
  },
  {
   "f": "sql/donnees/SEED-actus-partenaires.sql",
   "l": 44,
   "o": 3,
   "t": "Baobabs Basket Club — Contenu actuel du site : Actualités + Partenaires",
   "d": "À exécuter UNE FOIS dans Supabase :"
  },
  {
   "f": "sql/migrations/REPARATION-2026-09-16-photo-mareme.sql",
   "l": 43,
   "o": 2,
   "t": "REMISE EN ETAT : LA PHOTO DE MAREME DIAKHATE",
   "d": "Ce n'est pas une migration, c'est une reparation, et elle est de ma faute."
  },
  {
   "f": "greffe/modeles/page-blanche.js",
   "l": 40,
   "o": 1,
   "t": "MODÈLE : PAGE BLANCHE",
   "d": "Une feuille A4 vide, rien d'autre."
  },
  {
   "f": "sql/donnees/CORRECTIF-cadratins-articles.sql",
   "l": 40,
   "o": 2,
   "t": "Baobabs Basket Club — Les cadratins quittent les articles",
   "d": "Le 10 septembre 2026 A passer dans Supabase > SQL Editor > New query > Run."
  },
  {
   "f": "sql/migrations/MIGRATION-timeline.sql",
   "l": 36,
   "o": 2,
   "t": "Baobabs Basket Club — Module « Notre histoire » (timeline)",
   "d": "À exécuter UNE FOIS dans Supabase :"
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-14-adversaires.sql",
   "l": 32,
   "o": 2,
   "t": "LES ADVERSAIRES : une fiche par club, et des droits fermes",
   "d": "La table `teams` ne portait qu'un nom et un logo."
  },
  {
   "f": "sql/migrations/MIGRATION-mixte-candidatures.sql",
   "l": 30,
   "o": 2,
   "t": "Baobabs Basket Club — Club mixte (filles & garçons) + gestion pro des candidatures",
   "d": "À exécuter UNE FOIS dans Supabase :"
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-13-newsletter-doublons.sql",
   "l": 28,
   "o": 1,
   "t": "NEWSLETTER : une adresse, une seule ligne",
   "d": "Le formulaire du site (deux endroits :"
  },
  {
   "f": "maya/mots.js",
   "l": 25,
   "o": 63,
   "t": "MAYA — LE DICTIONNAIRE",
   "d": "FICHIER ENGENDRE."
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-14-cadrage-staff-bureau.sql",
   "l": 24,
   "o": 1,
   "t": "LE CADRAGE A LA SOURIS : staff et bureau",
   "d": "Les joueuses (players.photo_x/y/zoom), les actualites (news.image_url_x/y/zoom) et la galerie (gallery.image_x/y/zoom) portaient deja leurs trois nombres de cadrage."
  },
  {
   "f": "sql/migrations/MIGRATION-newsletter.sql",
   "l": 24,
   "o": 1,
   "t": "NEWSLETTER — journal des envois (à exécuter une fois dans Supabase)",
   "d": "La table garde la trace de chaque envoi :"
  },
  {
   "f": "sql/migrations/MIGRATION-players-name-color.sql",
   "l": 24,
   "o": 1,
   "t": "Baobabs Basket Club — Migration : couleur du nom sur les cartes joueuses",
   "d": "À exécuter une fois dans Supabase :"
  },
  {
   "f": "sql/correctifs/CORRECTIF-2026-09-19-b-presentation-encadrement-en-fin-d-annonce.sql",
   "l": 22,
   "o": 1,
   "t": "L'ENCADREMENT EN FIN D'ANNONCE",
   "d": "19 septembre 2026 « dans les animations de presentation on doit pouvoir ajouter la photo a la fin du chef de delegation, et le nom des deux coachs, et cette option on choisit de l'activer ou pas » Le staff d'une presentation (presentation_s"
  },
  {
   "f": "sql/diagnostics/DIAGNOSTIC.sql",
   "l": 19,
   "o": 1,
   "t": "Baobabs Basket Club — DIAGNOSTIC (une seule requête)",
   "d": "Supabase → SQL Editor → New query → Run."
  },
  {
   "f": "sql/donnees/OPTIONNEL-bouton-billetterie.sql",
   "l": 17,
   "o": 1,
   "t": "Baobabs Basket Club — Optionnel : le bouton de la carte « Prochain match »",
   "d": "pointe encore vers la page Tryouts (valeur enregistrée en base)."
  },
  {
   "f": "sql/migrations/MIGRATION-standings-logo.sql",
   "l": 17,
   "o": 1,
   "t": "Baobabs Basket Club — Migration : logo dans le classement (standings)",
   "d": "À exécuter une fois dans Supabase :"
  },
  {
   "f": "sql/migrations/MIGRATION-2026-09-14-piece-origine.sql",
   "l": 16,
   "o": 1,
   "t": "LE RECADRAGE D'UNE PIECE NE PERD PLUS L'ORIGINAL",
   "d": "Dans Inscriptions, « Recadrer » la photo d'identite d'un enfant fabriquait une image coupee et REMPLACAIT l'adresse de la piece par celle-ci :"
  },
  {
   "f": "sql/migrations/MIGRATION-partners-options.sql",
   "l": 16,
   "o": 1,
   "t": "Baobabs Basket Club — Options partenaires",
   "d": "À exécuter UNE FOIS dans Supabase :"
  },
  {
   "f": "sql/migrations/MIGRATION-news-image-pos.sql",
   "l": 15,
   "o": 1,
   "t": "Baobabs Basket Club — Positionnement d'image des actualités",
   "d": "À exécuter UNE FOIS dans Supabase :"
  },
  {
   "f": "sql/migrations/MIGRATION-players-photo-pos.sql",
   "l": 14,
   "o": 1,
   "t": "Baobabs Basket Club — Cadrage des photos de joueuses (players)",
   "d": "À exécuter UNE FOIS dans Supabase :"
  },
  {
   "f": "sql/migrations/MIGRATION-favoris.sql",
   "l": 12,
   "o": 1,
   "t": "FAVORIS — petit correctif de type (à exécuter une fois dans Supabase)",
   "d": "Pourquoi :"
  }
 ]
};
})();
