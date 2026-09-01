# Les animations du tutoriel — brief

*Document destiné à être soumis à un autre modèle, pour qu'il propose mieux.
État au 1er septembre 2026. Tout ce qui suit est mesuré dans le code, pas estimé.*

Ce brief complète `TUTORIEL-ce-que-ca-fait.md`, qui décrit le tutoriel dans son
ensemble. Ici, on ne parle **que du mouvement**.

---

## 1. Ce qu'on demande, en une phrase

Le tutoriel a un mouvement **soigné, cohérent, et monocorde** : une main voyage,
un cadre se dessine, une onde part, la main recommence. **Le contenu de l'écran,
lui, ne bouge pratiquement jamais.** On cherche des mécaniques qui fassent
**jouer les données réelles de l'administration** — pas de nouveaux effets sur la
surcouche du tutoriel, qui en a déjà bien assez.

La demande, telle qu'elle a été formulée : *« beaucoup plus exceptionnel, et pas
juste du pointage — genre vraiment animer le contenu ».*

---

## 2. Le décor, en cinq lignes

**Baobabs Basket Club**, club de basket **féminin** à Dakar (Sénégal), Championnat
National de Division 2. Site public + une administration web **en production**,
utilisée tous les jours par des bénévoles non techniques : président, directeur
sportif, coachs, une personne aux réseaux. Une seule personne tient le code.

Le tutoriel est une visite guidée intégrée à cette administration : **44 écrans**,
**124 repères**, ≈ 19 min pour un administrateur, ≈ 5 min pour un coach.

---

## 3. Le principe de construction, à connaître avant tout le reste

**Le tutoriel ne contient aucun texte de tutoriel et ne connaît aucun écran en
particulier.** Il lit l'administration à l'exécution : le plan vient du DOM de la
barre latérale, les explications viennent des registres de l'admin
(`SECTION_META`, `SECTION_HELP`), les repères viennent de `TUT_CIBLES`.

C'est ce qui fait qu'un écran ajouté à l'admin entre au tutoriel tout seul, et
qu'un coach reçoit sa version courte sans qu'on ait rien écrit pour lui.

**Ce principe s'applique aussi au mouvement.** Voir §6 : c'est la contrainte qui
décide de tout, et c'est elle qui rend la question intéressante.

---

## 4. L'inventaire du mouvement existant

`tutoriel.js` 3 315 lignes · `tutoriel.css` 991 lignes (52 Ko) · `tutoriel.html`
227 lignes. **19 jeux d'images-clés, 51 déclarations `animation:`, 43
`transition:`.**

### 4.1 Les 19 images-clés CSS

| Nom | Ce qu'il anime | Durée / courbe |
|---|---|---|
| `btEntre` | **l'écran de l'admin** qui arrive : 26 px de course, échelle .972, flou 7 px qui se dissipe | .62 s `cubic-bezier(.18,.86,.26,1)` |
| `btPose` | le halo qui se pose sur la cible | .9 s ease-out |
| `btOndeCadre` | l'onde qui part du halo à la pose | 1.15 s, retard .34 s |
| `btRappel` / `btRappelCadre` | le battement quand **deux étapes de suite** visent le même élément (26 fois dans la visite) | .92 s × 2 / .5 s |
| `btFlot` | la main qui respire quand elle est immobile | 2.6 s infinie |
| `btTape` | la main qui appuie | .42 s `cubic-bezier(.3,1.5,.4,1)` |
| `btOnde` | l'onde sous le doigt à l'appui | .58 s |
| `btClic` | l'anneau de clic qui part du point touché | .62 s |
| `btFil` | les pointillés du fil narrateur → cible, qui défilent | 22 s linéaire infinie |
| `btClavIn` | l'arrivée du clavier fantôme | .3 s |
| `btCarteFond` `btCarteMonte` `btCarteFil` `btCarteOut` | la carte de chapitre : chiffre de fond, titre, filet, sous-titre, en cascade .18 / .3 / .46 s | 3.4 s / .62–.7 s / .42 s |
| `btDit` `btOu` | le texte du narrateur qui monte en se défloutant | .5 s / .42 s |
| `btBalai` | le balai de lumière sur la jauge de progression | .7 s |
| `btBat` | le battement du point « démonstration en cours » | 1.5–1.6 s infinie |

### 4.2 Ce que la main sait faire (JS)

| Fonction | Geste | Réglages mesurés |
|---|---|---|
| `poser()` | la main **voyage** jusqu'à la cible, avec une traînée | 0,9 s ; le cadre se dessine trait par trait (`stroke-dashoffset`, périmètre recalculé à chaque pose) |
| `doigtTape()` | elle **appuie** — purement visuel, **aucun événement émis** | .42 s + onde |
| `parcourirEnumeration()` | 2 à 6 enfants manipulables : elle les **visite un par un** | départ 980 ms, pas `clamp(560…1000, 3800/n)` |
| `balayer()` | une région d'affichage : **trois temps** le long du grand côté | aux 20 %, 52 %, 84 % ; 1050 ms + i × 820 |
| `taper()` | la frappe dans un champ + clavier fantôme dont les touches s'allument | 62 ms par lettre |
| `chiffresAnimer()` | **le seul mouvement du contenu réel** — voir §4.3 | 780 ms, sortie cubique |

Aucune étape ne dure moins de 2,2 s, et aucune ne part avant la fin de son geste
(`plancherGeste`).

### 4.3 Le seul mouvement qui touche à une donnée

`chiffresAnimer()` fait monter les nombres depuis zéro pendant qu'on en parle.
**C'est le précédent à imiter**, parce qu'elle ne connaît aucun écran :

- elle regarde les **feuilles** du DOM sous la cible ;
- elle garde celles dont le texte est **uniquement** un nombre — « 12 matchs »
  n'est pas touché, on ne découpe pas la phrase de quelqu'un d'autre ;
- au-delà de 4 chiffres elle renonce (voir défiler 410 000 FCFA prend le pas sur
  ce qui est dit) ; au-delà de 12 cibles aussi ;
- **elle remet la forme d'origine à la fin**, telle quelle : le compte rend
  « 20000 » là où le site écrivait « 20 000 FCFA ».

Elle marche sur le tableau de bord, sur l'analytique, sur la billetterie — et
elle marchera sur l'écran qui n'existe pas encore.

---

## 5. Le diagnostic, dit franchement

**18 des 19 images-clés animent la surcouche du tutoriel.** Une seule (`btEntre`)
touche à un élément de l'administration, et elle ne fait qu'annoncer un
changement d'écran. Une seule routine JS anime une donnée.

On a donc énormément travaillé **le geste qui désigne**, et rien du tout **la
chose désignée**. Vu de la salle : un contenu figé, devant lequel passe un
curseur très bien élevé.

Le déséquilibre se mesure aussi sur les cibles. Sur les 98 repères mesurés le
26 août (il y en a 124 aujourd'hui) : **8 groupes, 6 pressables, 70 régions
d'affichage.** Autrement dit, **plus de 70 % des repères désignent une zone où il
n'y a rien à presser** — un panneau d'indicateurs, un corps de tableau, une grille
de calendrier. Pour toutes celles-là, le seul geste disponible est le balayage en
trois temps. C'est exactement là que le contenu devrait jouer, et c'est là qu'il
ne fait rien.

---

## 6. La contrainte qui décide de tout

> **Une proposition qui demande d'écrire une animation par écran est refusée
> d'avance.**

Il en faudrait 44, sur un fichier de 16 500 lignes qui bouge chaque semaine, tenu
par une seule personne. Elles se périmeraient en silence — c'est précisément le
défaut que toute l'architecture du tutoriel a été construite pour éviter.

**Ce qu'on cherche, ce sont des règles qui se déduisent de ce que la cible EST**, à
l'exécution. Le modèle existant est `groupeOuPas()` : elle ne sait pas ce qu'est
un menu, elle constate qu'une cible a de deux à six enfants manipulables,
visibles, dont aucun ne remplit à lui seul le conteneur — et elle en conclut
« énumération ». Puis `animerCible()` choisit le geste.

Une bonne proposition ressemble donc à : **« quand la cible ressemble à ceci, on
peut en faire cela »**, avec le critère de reconnaissance écrit noir sur blanc.

---

## 7. La matière première disponible

Ce qu'il y a réellement à animer dans l'administration, mesuré :

- des **listes de lignes** en `div` : `#rs-rows` (résultats), `#mc-rows` (matchs),
  `#teams-list`, `#att-list` — c'est la forme dominante ;
- **4 vrais `<table>`** ;
- des **panneaux d'indicateurs** : `.db-nums` (7 blocs), `#an-kpis` (5) ;
- une **grille de calendrier** (`#cal-cells`), un **podium** (`#st-podium`) ;
- des **grilles de cartes** (`#kc-grid`, `#tk-copygrid`, `#tk-offers-list`) ;
- **181 SVG en ligne** — icônes, podium, logos de clubs ;
- des **formulaires** (les 7 écrans à démonstration) ;
- le **Studio** : un plan de travail réel, avec calques, formats, propriétés,
  monté en mémoire à partir d'un modèle et jamais enregistré.

Une cible peut être **une liste de replis essayés dans l'ordre** — la commande
précise d'abord, l'ancrage stable ensuite. Sur un club qui débute, la liste
désignée est souvent **vide** : c'est le cas normal, pas le cas tordu.

---

## 8. Les contraintes techniques, qui sont sévères

| | Réalité |
|---|---|
| Architecture | HTML statique, **une seule IIFE** de 16 500 lignes pour l'admin |
| Build | **Aucun.** Pas de `package.json`, pas de bundler, pas de npm |
| JS | Vanilla ES5, `var` et `function`. Pas de module |
| Dépendances | `supabase-js`, `jspdf`. **Rien d'autre ne sera installé** |
| CSP | Stricte, pas de CDN. **GSAP, Lottie, anime.js, Motion One sont hors sujet** |
| Rendu | `transform`, `opacity`, `filter` uniquement. Tout le reste ferait recalculer la mise en page d'un DOM de 16 500 lignes à chaque image |
| Public | Dakar : connexions parfois lentes, téléphones parfois modestes |

Et quatre règles qui ont chacune été payées par un bug :

1. **L'admin est en production.** Toute animation qui touche au DOM réel doit être
   **réversible au caractère près** — `chiffresAnimer()` remet le texte d'origine,
   et remet aussi si l'étape est interrompue en cours de route (jeton
   `g !== jeton`).
2. **Un double verrou bloque toute écriture** pendant les démonstrations : les cinq
   fonctions d'accès à la base, **plus `fetch` lui-même** pour tout ce qui n'est
   pas une lecture. Une animation ne doit jamais déclencher d'enregistrement —
   c'est pour ça que `doigtTape()` n'émet aucun événement.
3. **Chaque animation doit être écrite deux fois.** Beaucoup de machines Windows
   ont « animations » désactivé sans que personne l'ait choisi, et ce sont
   exactement celles qu'on branche à un vidéoprojecteur. Il y a donc un bouton
   « animations » qui doit **battre le réglage système** : chaque règle est
   dupliquée sous `#btut.anim` / `html.bt-anim` avec `!important`. C'est laid,
   c'est nécessaire, et ça double le coût de tout ce qu'on ajoute.
4. **Le vidéoprojecteur est un cas d'usage réel.** Le réglage d'origine de
   `btEntre` (10 px, échelle .988) était juste pour quelqu'un assis devant son
   écran, et **n'existait pas** à cinq mètres. Un mouvement qui ne se voit pas au
   fond d'une salle ne compte pas.

---

## 9. Ce qui a déjà été fait, pour ne pas se le faire proposer

- la main qui **appuie** au lieu de flotter (86 % des repères ont un geste) ;
- le **balayage** en trois temps des régions ;
- l'**énumération** des groupes de 2 à 6 ;
- le **rappel** quand deux étapes visent le même élément ;
- le **compte des nombres** depuis zéro ;
- le **fil courbe** narrateur → cible, tracé seulement si les deux sont assez
  éloignés ;
- le **clavier fantôme** dont les touches s'allument ;
- le narrateur qui **se replace tout seul** pour ne pas couvrir ce qu'il désigne ;
- le **cadre qui se dessine** trait par trait, périmètre recalculé ;
- l'**arrivée d'écran** avec course, échelle et flou.

---

## 10. La question

**Qu'est-ce qui ferait bouger le contenu lui-même ?**

Pas un catalogue d'effets. Des mécaniques précises, chacune avec :

1. **son critère de reconnaissance** — « quand la cible est …, mesuré comment » ;
2. **ce qui bouge exactement**, en `transform` / `opacity` / `filter` ;
3. **son minutage**, sachant qu'une étape dure au moins 2,2 s et que la voix parle
   pendant ce temps ;
4. **comment on remet en état** si l'étape est interrompue ;
5. **pourquoi ça apprend quelque chose** — un effet qui fait joli sans rien
   expliquer coûte de l'attention à quelqu'un qui essaie de comprendre son outil.

Les trois endroits où le manque est le plus criant :

- **les 70 % de régions d'affichage**, où il n'y a rien à presser ;
- **les listes vides**, très fréquentes en début de saison — on désigne un cadre
  où il n'y a rien, et on n'a rien à en dire visuellement ;
- **le Studio**, où l'on ouvre un vrai plan de travail avec des calques et où le
  tutoriel se contente de désigner la colonne d'outils.

Le mot d'ordre est **« exceptionnel »**, pas « un peu mieux ». Mais exceptionnel
sous les contraintes du §8 : vanilla, sans dépendance, réversible, et visible à
cinq mètres.

---

## 11. Format de réponse attendu

Pour chaque mécanique proposée :

```
NOM DE LA MÉCANIQUE
Reconnaissance : ce qu'on mesure sur la cible pour décider que ça s'applique
Geste          : ce qui bouge, et avec quelles propriétés CSS
Minutage       : départs, durées, courbes
Remise en état : ce qu'on restaure, et quand
Ce que ça dit  : ce que la personne comprend qu'elle ne comprenait pas avant
Coût           : lignes de JS, lignes de CSS, et si ça demande à toucher l'admin
```

Cinq à huit mécaniques valent mieux que vingt. **Classées par rapport entre ce
qu'elles apprennent et ce qu'elles coûtent.**

Et si une proposition oblige à écrire quelque chose écran par écran, dites-le
franchement : ce n'est pas éliminatoire, mais il faut alors que ça vaille les 44
écrans à tenir à jour.
