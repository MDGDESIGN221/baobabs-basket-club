# SQL — ce qui a façonné la base

52 fichiers, écrits entre le 23 juillet et le 1er septembre 2026. Ils ne
sont pas joués par un outil : on les ouvre, on les colle dans le **SQL
Editor** de Supabase, on exécute. Rien ici ne s'applique tout seul.

```
sql/
  migrations/   38   crée ou modifie des tables, des vues, des politiques
  correctifs/    6   répare quelque chose de cassé en production
  diagnostics/   5   ne modifie rien — lit et rend compte
  donnees/       3   remplit des lignes (contenu de départ, options)
```

---

## Ce que ce dossier ne dit pas

**Aucun fichier ne porte la trace de son exécution.** Les dates ci-dessous
sont celles du disque : elles disent quand le fichier a été *écrit*, pas
s'il a été *joué*, ni sur quelle base. Pour savoir ce que la base contient
vraiment, il faut la lire — `sql/diagnostics/` est là pour ça.

En cas de doute sur une politique RLS, ne pas conclure depuis le site :
seul `pg_policies` fait foi.

---

## Ordre d'écriture

Les noms ne portent pas de numéro. Sur une base neuve, c'est cet ordre-là
qu'il faut suivre — plusieurs migrations tardives supposent que les
premières sont passées (`phase0-socle` avant `phase0d-rls-par-role`,
`inscriptions` avant `inscriptions-2-dossier` avant `inscriptions-3-depot-pieces`).

| Date | Fichier | Dossier |
|---|---|---|
| 2026-07-23 | MIGRATION-SUPABASE-v6 | migrations |
| 2026-07-23 | MIGRATION-standings-logo | migrations |
| 2026-07-24 | AUDIT-HISTORIQUE | diagnostics |
| 2026-07-24 | MIGRATION-mixte-candidatures | migrations |
| 2026-07-24 | MIGRATION-news-image-pos | migrations |
| 2026-07-24 | MIGRATION-partners-options | migrations |
| 2026-07-24 | MIGRATION-players-name-color | migrations |
| 2026-07-24 | MIGRATION-players-photo-pos | migrations |
| 2026-07-24 | MIGRATION-timeline | migrations |
| 2026-07-25 | MIGRATION-comptes-clients | migrations |
| 2026-07-25 | MIGRATION-site-settings | migrations |
| 2026-07-27 | MIGRATION-TOUT-EN-UN | migrations |
| 2026-07-27 | MIGRATION-bannieres | migrations |
| 2026-07-27 | MIGRATION-billetterie | migrations |
| 2026-07-27 | MIGRATION-codes-promo | migrations |
| 2026-07-27 | MIGRATION-commandes-clients | migrations |
| 2026-07-27 | MIGRATION-effectif-stock | migrations |
| 2026-07-27 | MIGRATION-favoris | migrations |
| 2026-07-27 | MIGRATION-match-center | migrations |
| 2026-07-27 | MIGRATION-mon-espace | migrations |
| 2026-07-27 | MIGRATION-newsletter | migrations |
| 2026-07-27 | MIGRATION-publications | migrations |
| 2026-07-27 | MIGRATION-recrutement | migrations |
| 2026-07-27 | DIAGNOSTIC | diagnostics |
| 2026-07-27 | OPTIONNEL-bouton-billetterie | donnees |
| 2026-08-06 | MIGRATION-session-25-07-2026 | migrations |
| 2026-08-06 | SEED-actus-partenaires | donnees |
| 2026-08-06 | SEED-contenu-site | donnees |
| 2026-08-08 | CORRECTIF-logos-adversaires | correctifs |
| 2026-08-17 | MIGRATION-inscriptions | migrations |
| 2026-08-17 | MIGRATION-inscriptions-2-dossier | migrations |
| 2026-08-17 | MIGRATION-phase0-socle | migrations |
| 2026-08-17 | MIGRATION-phase1-stats-publiees | migrations |
| 2026-08-17 | CORRECTIF-rls-candidatures | correctifs |
| 2026-08-17 | MIGRATION-phase0d-rls-par-role | migrations |
| 2026-08-17 | CORRECTIF-URGENT-rls-commandes | correctifs |
| 2026-08-17 | CORRECTIF-rls-lecture-argent | correctifs |
| 2026-08-17 | MIGRATION-phase2-analytics | migrations |
| 2026-08-17 | MIGRATION-phase2b-comptes-verrouilles | migrations |
| 2026-08-20 | DIAGNOSTIC-admin-2026-08-20 | diagnostics |
| 2026-08-20 | DIAGNOSTIC-admin-2026-08-20-b | diagnostics |
| 2026-08-20 | CORRECTIF-role-compte-club | correctifs |
| 2026-08-20 | CORRECTIF-vue-clients-admin | correctifs |
| 2026-08-22 | MIGRATION-studio-projets | migrations |
| 2026-08-23 | MIGRATION-partenaires-reels | migrations |
| 2026-08-25 | MIGRATION-phase2c-compte-proprietaire | migrations |
| 2026-08-25 | VERIFIER-compte-proprietaire | diagnostics |
| 2026-08-27 | MIGRATION-galerie | migrations |
| 2026-08-27 | MIGRATION-galerie-legendes | migrations |
| 2026-08-27 | MIGRATION-lineup-lecture-publique | migrations |
| 2026-08-27 | MIGRATION-lineup-ordre-et-capitaine | migrations |
| 2026-09-01 | MIGRATION-inscriptions-3-depot-pieces | migrations |

---

## Deux pièges

**`MIGRATION-TOUT-EN-UN.sql`** (49 Ko) reprend l'essentiel des migrations
de juillet dans un seul fichier. C'est un raccourci pour repartir de zéro,
pas une migration de plus : sur une base déjà en service, il fait doublon
avec les fichiers qu'il recopie.

**`docs/notices/NOTICE-EMAIL.txt` cite `MIGRATION-email-expiration.sql`,
qui n'existe pas.** Le fichier n'est nulle part dans le dépôt. La notice
propose de relancer le TOUT-EN-UN à la place — c'est la seule voie qui
reste aujourd'hui.

---

## Les archives

`archives/migration-cloudinary/` garde trois SQL de plus, liés au
déménagement des images hors de Cloudinary (août 2026). L'un s'appelle
`DEJA-APPLIQUE-ne-pas-relancer_...` : le nom dit tout. Ces fichiers sont
hors de git, ils ne vivent que sur ce disque.
