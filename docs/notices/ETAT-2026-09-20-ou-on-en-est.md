# Où on en est, le 20 septembre 2026

*Note de passage entre deux sessions. À lire en premier avant de reprendre le
travail sur le site ou l'admin. Tout ce qui est décrit ici est commité et en
ligne sur www.baobabsbasketclub.com (déploiement Vercel depuis `main`).*

## Ce qui a été fait aujourd'hui (dans l'ordre)

| Commit | Quoi |
|---|---|
| 09fdbe3 | Bureau et Fondateur : sous le nom, une ligne dit si le Staff porte la même personne (reprendre le nom, la photo, rattacher la fiche). Le Staff est la fiche de référence ; `staff.org_role_key` relie un dirigeant à son poste. |
| 98fea7c, fe2862d | Les cadrages se voient enfin dans l'admin (Staff, Joueuses, Bureau, Fondateur, Face-Off). Règle : la boîte rogne (`overflow:hidden` + rond), l'image porte le cadrage. |
| 0441482 | La veille des arrivées : MAYA annonce en temps réel (Supabase Realtime + ronde 60 s) candidatures, inscriptions, commandes, messages, abonnés, profils déposés ; compte au retour (« Pendant votre absence… ») ; rien ne se redessine tout seul (bandeau « pendant que vous travailliez » + clic). |
| 26ad7c4 | Pastille sur Commandes ; pastilles lisibles (11 px). |
| b4b1995 | Commandes : photo des articles (table `products`), section Prix avec code promo, bouton « Facture / Reçu pour le client » (fenêtre à imprimer). |
| 428cdea | Alerte e-mail : fonction serveur `alerte-arrivee` + six déclencheurs SQL ; adresses dans `bbc_config.alerte_email` (mdgdesign221@gmail.com, baobabsbasketclub@gmail.com). Vérifié : `{sent:true,to:2}`. |
| f3a8c74, 8b0cfb6 | Greffe : l'accès se donne **compte par compte, par le propriétaire**, écran Comptes (mot de passe redonné), menu « Greffe : aucun accès / compose / compose et signe ». Table `greffe_acces`, la base tient la règle (`bbc_greffe_ouvert`, `bbc_greffe_signe`) ; un acte émis ne se touche que par qui signe. |
| c6164b7 | Comptes : le second mot de passe (Comptes + Historique) se remplace depuis l'espace du propriétaire, sans l'ancien (`bbc_secret_changer`). |
| 29ea779 | Greffe : modèle **Facture** (lignes quantité × prix calculées, remise, TVA 18 % ou non assujetti, acompte, net, échéance). Les colonnes « nombre » affichent les milliers. |
| 31c5b94 | Greffe : **douze actes de plus** : contrat-staff, convention-benevolat, contrat-prestation, convention-essai, engagement-dirigeant, pret-joueuse, liberation, charte, pv-passation, procuration, devis, avoir. Le Greffe compte 39 modèles. |

Migrations SQL appliquées par le MCP Supabase et présentes dans `sql/migrations/`
(veille-des-arrivees, alerte-des-arrivees, greffe-aux-casquettes,
greffe-acces-par-le-proprietaire, secret-des-comptes-depuis-l-admin).

## Décisions prises avec le président

- Trois écrans pour une même personne (Staff, Bureau, Fondateur) : **voulu**, le rappel sous le nom suffit ; la fusion des fiches reste une option.
- Alertes e-mail : toujours envoyées (connecté ou non), pas pour les abonnés newsletter.
- Le Greffe : le propriétaire décide compte par compte ; la casquette n'ouvre rien. **Créer n'est pas signer.**
- Le second mot de passe des Comptes et de l'Historique est distinct de celui de connexion (il l'a réglé lui-même par SQL, puis le bloc dans l'admin sert pour la suite).
- Une seule facture, pas une par usage : les usages seront des **préréglages** (sponsoring, location de salle, prestation, tournoi). **À poser : il n'a pas encore dit ses usages réels.**
- Coachs **bénévoles par défaut** dans le contrat de staff (menu pour défrayé / rémunéré) ; textes citant la FSBB et la FIBA. Questions restées sans réponse : le club est-il une section d'une ASC ? y a-t-il eu des prêts de joueuses ?

## La feuille de route validée pour le site public (« tout ça me va »)

Audit du 20/09 comparé à AS Monaco, la BAL et les guides de référence. Ordre
convenu, « avec le meilleur design possible » :

1. **Fiche de match** (feuille, face-à-face, « ajouter au calendrier ») et **fiche de joueuse**, chacune avec sa propre adresse et son image de partage. Données déjà en base : `match_stats`, `match_lineup_public`, `player_season_stats`. Le site est une seule page (une URL dans le sitemap) : il faut des adresses par contenu.
2. **PWA** installable avec notifications (coup d'envoi, résultat, convocations). Les « écrans d'application » de l'admin deviennent réels.
3. **Espace parents** de l'école : présences, mensualités, planning, paiement Wave.
4. **Direct vidéo** le soir de match + « Baobabs TV ».
5. **Abonnement de saison, carte de membre, « Devenir partenaire », don Wave.**
6. FAQ, bénévolat, version anglaise, recherche, partage, **suivi de commande** par numéro.

Différenciants notés : pronostics / vote MVP / quiz ; visuels de partage générés
automatiquement (le Studio existe) ; page « Le club en clair » (transparence).

## Reste à faire côté admin (petit)

- Préréglages de facture (attend les usages).
- La marque `confirmation_email_sent` n'est pas écrite par `send-order-confirmation`
  (client `auth:'none'` sous RLS) : un rejeu du webhook renverrait la confirmation.
  La version du dépôt exige `WEBHOOK_SECRET` : vérifier que le secret existe avant
  de redéployer.
- Serigne Falliou Mbacké Ndiaye est « Coach » rangé en Staff technique, sans ordre.

## Comment vérifier (rappels)

- Admin : `archives/banc/` (hors git) ; `python archives/banc/fabrique.py` puis
  `http://localhost:8899/archives/banc/banc-admin.html?jeu=plein`.
- Greffe : `http://localhost:8899/archives/banc/greffe-banc.html`, puis
  `G.nouvelActe(cle, donnees, {origine:'banc'})` et lire l'iframe `#gf-cadre`.
  Recharger la page entre deux essais (modale « Acte non enregistré »).
- En ligne, avec le compte du propriétaire, après chaque déploiement.
- Jamais de cadratin ; fichiers en CRLF ; commiter et pousser sans demander.
