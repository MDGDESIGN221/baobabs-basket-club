# Tutoriel d'une administration web — demande d'avis critique

Tu es consulté sur une fonctionnalité déjà construite, qui **ne satisfait pas**
son commanditaire. On te demande de dire ce qui a été mal compris, ce qui
manque, et comment ça devrait réellement se passer. Sois direct : le but n'est
pas de valider l'existant, c'est de le corriger.

---

## 1. Le contexte

**Baobabs Basket Club**, club de basket à Dakar. Site public + une
administration web d'un seul fichier (`admin-matchs.html`, ~15 000 lignes,
vanilla JS, une seule IIFE, base Supabase/PostgREST). Pas de framework, pas de
build. L'admin est **en production** : le club s'en sert tous les jours.

**43 écrans** dans l'administration, rangés en 10 groupes dans une barre
latérale (Pilotage, Match day, L'effectif, École de basket, Boutique, Pages du
site, Contenus & médias, Messages, Réglages…).

**5 rôles**, chacun ne voit que certains écrans :

| Rôle | Écrans visibles |
|---|---|
| Administration (super admin) | 43 |
| Présidence | 42 |
| Direction sportive | 33 |
| Coach | 13 |
| Communication | 31 |

Le filtrage est déjà en place : une fonction masque les entrées de menu
interdites au rôle connecté.

### Le déclencheur

Le président du club voulait **réunir les membres pour leur faire un tutoriel
du site**. Le créateur du site (le commanditaire) a trouvé ça long et
fatigant, et répétable à l'infini à chaque nouvelle personne. Il a demandé :

> « J'aimerais intégrer un espace tutoriel de l'administration qui va
> expliquer tout comme une vidéo de présentation, en décrivant vraiment tout,
> en plus des rôles. »

---

## 2. Ce qui existait déjà, et qui a orienté la solution

Chaque écran de l'admin porte déjà une bulle « Comment ça marche ? » écrite à
la main par le créateur. Au total : **43 écrans, 131 conseils, 2 284 mots**,
soit environ **15 minutes lues à voix haute**.

Autrement dit, le contenu du tutoriel existait déjà — enfermé dans 43 bulles
que personne n'ouvre spontanément.

---

## 3. Ce qui a été construit

Trois fichiers séparés (`/tutoriel/tutoriel.html|css|js`), chargés au premier
clic, exposant un seul global. L'admin lui fournit une API.

### Principe central : le tutoriel ne contient aucun texte

Il lit tout chez l'hôte :

- **le plan des chapitres** ← la barre latérale telle qu'affichée (donc déjà
  filtrée par rôle) ;
- **le titre des écrans** ← la table des métadonnées d'écran ;
- **les explications** ← les 131 conseils des bulles d'aide ;
- **les cibles du pointeur** ← une table `TUT_CIBLES`, un sélecteur CSS par
  conseil, alignée par index ;
- **les gestes de démonstration** ← une table `TUT_DEMOS`.

Conséquences : un écran ajouté entre tout seul dans le tutoriel, corriger une
bulle corrige le tutoriel, et le filtrage par rôle est gratuit. Le coach
obtient un tutoriel de 13 écrans / 5 min ; le super admin, 43 écrans / 19 min.

### Ce que ça fait aujourd'hui

1. **Un sommaire** plein écran : chapitres (= groupes du menu), durée estimée,
   progression sauvegardée, bouton « Tout me montrer », reprise là où on
   s'était arrêté. Accessible par une entrée « Tutoriel » en tête de menu, un
   bouton « Aide » en en-tête, et automatiquement à la première connexion.

2. **Une visite qui se joue seule** : elle navigue d'écran en écran sur la
   vraie administration, une barre basse narre pendant que l'admin reste
   visible et cliquable au-dessus. Commandes : précédent / pause / suivant.

3. **Une narration vocale** optionnelle (`speechSynthesis` du navigateur, voix
   française, aucun fichier, fonctionne hors ligne).

4. **Un pointeur** : une main dorée se déplace jusqu'au vrai champ / bouton
   dont parle la phrase, un halo l'entoure. Règle tenue : pas de cible fiable
   → pas de main (plutôt que de désigner approximativement).

5. **Une démonstration** sur 2 écrans : les champs se remplissent lettre par
   lettre, les listes déroulantes changent, sous les yeux. Un verrou à deux
   étages rend l'écriture **impossible** pendant la démonstration (les 5
   fonctions d'écriture sont remplacées par un refus, et `fetch` bloque toute
   méthode non-GET vers la base). Les valeurs d'origine sont photographiées et
   restaurées.

6. **Un chapitre « Les rôles et les accès »** en tête : qui fait quoi, qui ne
   peut pas quoi, un tableau croisé rôles × écrans à trois états (modifie /
   consulte seulement / n'a pas l'écran).

---

## 4. Le problème — le commanditaire n'est pas satisfait

Verbatim, après essai :

> « Ça reste mid car ça ne renvoie pas directement quand j'appuie sur un tuto.
> Par exemple si je me trouve dans Joueuses et que je veux voir les rôles,
> seule la voix se lance mais je dois aller manuellement à l'écran. »

### Le bug identifié

Le chapitre « Les rôles et les accès » a été construit comme un chapitre
**spécial, sans écran attaché** : ses étapes ne portent pas de clé d'écran,
donc la fonction de navigation n'est jamais appelée. Résultat : il raconte les
rôles pendant que l'utilisateur regarde l'écran des joueuses. Les autres
chapitres, eux, naviguent correctement.

### Le problème de fond, probablement plus large

Il y a eu **deux erreurs d'interprétation successives** de la demande
initiale :

1. D'abord, « comme une vidéo » a été compris comme « une visite narrée ». Le
   commanditaire a répondu : *« je ne comprends pas, c'est ce que tu vois et
   rien ne se passe à l'écran, ce n'est pas à ça que j'ai pensé »*.
2. Ensuite on lui a proposé trois formes (pointeur / démonstration jouée /
   vraies vidéos) et il a choisi les deux premières. Elles ont été
   construites. Il trouve toujours le résultat « mid ».

Ce qui suggère que le vrai besoin n'a **toujours pas été nommé correctement**.

---

## 5. Contraintes non négociables

- **Site en production.** Rien ne doit pouvoir être enregistré, publié ou
  supprimé par le tutoriel. Aucune écriture, jamais.
- **Pas de framework, pas de build.** Vanilla JS, ES5-ish, un seul fichier
  d'admin de 15 000 lignes qu'on ne veut pas déstabiliser.
- **Le contenu ne doit pas être dupliqué.** Toute solution qui recopie les
  explications ailleurs sera fausse au premier changement d'écran.
- **Le filtrage par rôle doit être préservé.** Un coach ne doit jamais voir de
  tutoriel sur la boutique.
- **Pas de fichier vidéo hébergé** (poids, et ça devient faux au premier
  changement d'interface). Sauf si tu démontres que c'est la seule réponse.
- Utilisateurs : bénévoles d'un club, pas des informaticiens. Beaucoup sur
  téléphone.

---

## 6. Ce qu'on te demande

1. **Qu'est-ce qui a été mal compris ?** En lisant la demande initiale et les
   deux réactions du commanditaire, quel est le besoin réel qui n'a pas été
   nommé ? Ne sois pas diplomate.

2. **À quoi n'a-t-on pas pensé ?** Liste ce qui manque et qu'on n'a pas
   envisagé — dans l'ergonomie, le déclenchement, le découpage, la
   progression, l'entrée en matière, la sortie, la mémorisation, la mesure de
   ce qui a été compris, l'accès depuis le contexte où l'on se trouve, etc.

3. **Comment les choses devraient-elles se passer ?** Décris le parcours
   idéal, scène par scène : la personne se connecte pour la première fois, que
   voit-elle exactement ? Elle est bloquée sur un écran précis, que fait-elle ?
   Elle a cinq minutes entre deux entraînements, que lui propose-t-on ? Le
   président veut savoir qui a accès à quoi, quel est son chemin ?

4. **Propose une conception complète et argumentée**, pas seulement des
   correctifs. Si l'architecture actuelle (lire le contenu chez l'hôte,
   chapitres = groupes de menu, visite auto-jouée) est une mauvaise base,
   dis-le et propose autre chose.

5. **Sois précis sur les cas limites** : que se passe-t-il si on clique dans
   l'admin pendant la visite ? Si un écran est vide (club sans joueuse
   enregistrée) ? Si la personne quitte au milieu ? Si elle a déjà tout vu ?
   Si son rôle change ? Si elle est sur un téléphone en 3G au bord d'un
   terrain ?

Réponds en français.
