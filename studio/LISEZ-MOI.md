# Baobabs Studio — atelier d'affiches

Trois fichiers, un seul global, aucune étape de compilation.

```
studio/
  studio.html      fragment (ni <html>, ni <head>, ni <script>)
  studio.css       feuille de style, tout sous #bstudio
  studio.js        window.BaobabsStudio = {mount, open, close, isOpen}
  banc-essai.html  page de test autonome — NON livrée en production
  LISEZ-MOI.md     ce fichier
```

---

## 1. Comment c'est branché dans l'administration

`admin-matchs.html` ne contient plus l'atelier. Il contient :

- un `<link rel="stylesheet" href="/studio/studio.css">` dans l'en-tête ;
- un conteneur vide `<div id="studio-host"></div>` ;
- une soixantaine de lignes (`studioCharger`, `studioOuvrir`, `studioApi`)
  qui, **au premier clic seulement**, vont chercher le fragment et le
  script, montent le Studio et l'ouvrent.

Rien ne part au chargement de la page. Les 43 autres écrans de
l'administration ne paient pas l'atelier.

**Pourquoi dehors et pas dedans ?** `admin-matchs.html` est une seule
IIFE de 15 000 lignes : deux fonctions de même nom s'y écrasent en
silence, et c'est déjà arrivé en production. Un fichier séparé rend la
collision impossible. Vérifié après l'intégration : aucun nom déclaré
deux fois à la racine de l'IIFE.

---

## 2. Ce dont le Studio a besoin

### Polices

Chargées par l'hôte, déjà présentes dans le lien Google Fonts de
l'administration :

**Anton**, **Bebas Neue**, **Oswald**, **Teko** (affiche condensée) ·
**Archivo**, **Syne**, **Bricolage Grotesque**, **Space Grotesk** (titres) ·
**Playfair Display**, **DM Serif Display** (serif) ·
**Inter**, **Outfit** (texte) · **JetBrains Mono** (chiffres).

Treize familles. Elles sont toutes dans le lien Google Fonts de
`admin-matchs.html` ; en ajouter une au tableau `FONTS` sans l'ajouter
au lien donnerait un rendu en police de repli, silencieusement.

Le Studio attend `document.fonts.load()` avant de mesurer un texte, puis
recalcule toutes les boîtes. Sans cela le premier rendu est fait en
police de repli et les titres débordent.

### Dépendances externes

**Aucune.** Pas de Fabric, pas de Konva, pas de html2canvas. Le rendu et
l'export sont écrits ici, en canvas 2D.

### Table Supabase

`MIGRATION-studio-projets.sql`, à exécuter une fois. Sans elle le Studio
fonctionne, mais le panneau « Projets » reste vide et rien ne se garde
d'une session à l'autre — c'est écrit dans la console au montage.

---

## 3. Le contrat `api`

`mount(root, api)` est appelé une fois. Tout ce qui touche au réseau
passe par `api` : le Studio ne connaît ni Supabase, ni les noms des
tables, et ne fait aucun `fetch`, aucun `localStorage`.

```js
api = {
  data: {
    nextMatch(),   // {opponent, competition, date, time, venue, isHome, opponentLogo, photo} | null
    lastResult(),  // {opponent, scoreUs, scoreThem, date} | null
    matches(),     // [{opponent, competition, date, time, venue, isHome, opponentLogo, photo}]
    players(),     // [{name, number, position, photo}]
    media()        // [{url, name}]
  },
  projects: {      // facultatif — sans lui, les projets ne survivent pas au rechargement
    list(),        // [{id, nom, format, est_modele, doc, modifie_le}]
    save(rec),     // -> l'enregistrement sauvé (avec son id)
    remove(id)
  },
  uploadImage(file),      // File -> Promise<url publique>
  download(blob, nom),
  toast(message, isErr),
  clubLogo,               // string — sert aussi de logo au logiciel
  unsplashKey,            // string — Access Key Unsplash, ou '' pour désactiver
  formatDate(iso),        // '2026-09-19' -> 'SAMEDI 19 SEPTEMBRE'
  today()                 // '2026-09-19'
}
```

Tout renvoie une promesse. **En cas d'échec, renvoyer `null` ou `[]`** :
le Studio retombe sur ses valeurs de maquette et ne plante pas.

---

## 4. Comment c'est fait

### Un document, une fonction de rendu

Le document est une liste de calques ordonnée du bas vers le haut.
`renderDoc(ctx, doc)` est **la seule** fonction qui dessine. L'aperçu
l'appelle après la transformation de vue, l'export après un simple
`ctx.scale()`.

Conséquence : le PNG exporté est exactement ce qui est à l'écran. Il n'y
a pas de second moteur qui pourrait diverger, pas de DOM à
photographier, donc pas d'effet qui disparaît entre l'écran et le
fichier — le piège de `backdrop-filter` et `mix-blend-mode` n'existe
plus ici.

Les positions sont en pixels du format final. Exporter en ×3 redessine à
3240 × 4320 : le texte est net, il n'est pas agrandi.

### Texte enrichi

Un calque texte porte un style de base et une liste de *runs* —
`{t: 'BAO', s: {}}`. Colorer trois lettres découpe le run qui les
contient ; rien d'autre n'est touché. C'est le même modèle qu'InDesign
ou Figma, et il traverse l'enregistrement et l'export sans perte.

La saisie passe par un `<textarea>` invisible (accents, correcteur,
copier-coller, saisie mobile). Le curseur et la sélection sont dessinés
sur la surcouche.

### Objets dynamiques

Deux formes, toutes deux au sens de Photoshop :

- **Cadre photo** : la boîte et le contenu sont indépendants. Remplacer
  l'image ne change ni la forme, ni la position, ni les effets. Le
  recadrage (double-clic, ou bouton *Recadrer*) déplace l'image *dans*
  son cadre, sans jamais la rogner.
- **Liaison de données** : un texte lié à `match.adversaire` ne stocke
  pas la valeur, il stocke le chemin. « Recharger depuis la base » met
  l'affiche à jour sans retoucher un seul texte. Modifier le texte à la
  main rompt la liaison, et le Studio le signale.

Les calques dynamiques portent un éclair vert dans la pile.

### Masque d'écrêtage

`Ctrl+Alt+G`, comme dans Photoshop : le calque est découpé par la
silhouette du calque juste en dessous — y compris celle d'un **texte**,
ce qu'un simple `ctx.clip()` ne sait pas faire. D'où le passage par deux
canevas hors écran : l'un porte le contenu, l'autre sert de pochoir.

---

## 4bis. Ce que la version 3 ajoute

### Écran d'accueil

On n'entre plus directement dans l'atelier. `open()` affiche un accueil :
reprendre un travail (avec sa date et son heure), partir d'un modèle,
ou poser des dimensions — préréglages par catégorie, ou taille libre.
`BaobabsStudio.home()` y ramène depuis l'extérieur.

### Barre de menus

Huit menus — Fichier, Édition, Image, Calque, Texte, Affichage, Fenêtre,
Aide. Ils sont reconstruits à chaque ouverture : les cases cochées et les
entrées grisées reflètent l'état réel du document, jamais un état figé.

### Détourage

Trois outils, un seul mécanisme : le **masque de fusion**, une image
d'alpha rangée avec le calque. Rien n'est retiré de la photo — effacer,
c'est peindre du transparent dans le pochoir, donc tout est réversible.

- **Baguette magique (W)** — remplissage par propagation depuis le point
  cliqué, avec tolérance, mode « toute l'image » et adoucissement du
  bord. Elle travaille sur le calque **tel qu'il s'affiche**, voile et
  teinte compris, pas sur les pixels d'origine.
- **Gomme (E)** et **pinceau (B)** — taille et dureté réglables, Alt
  inverse les deux. Les coups sont interpolés : un geste rapide ne
  laisse pas de trous.
- **Plume (P)** — un tracé fermé sert de masque d'écrêtage vectoriel.

### Données modifiables

Le panneau *Données* laisse choisir le match affiché parmi ceux de la
base, la joueuse, et surtout **ajouter ses propres champs** (un tarif,
un slogan, un nom de partenaire). Ils s'enregistrent avec le projet et
se lient comme n'importe quelle donnée du club.

Les données sont **relues à chaque ouverture** du Studio, pas une seule
fois au chargement de la page : une joueuse ajoutée en base apparaît
sans qu'il faille recharger l'administration.

### Autres

- **Vérification avant publication** — débordement de marges, contraste
  faible, texte minuscule, image sous-définie, cadre vide, liaison
  rompue, image non exportable. Chaque ligne mène au calque fautif.
- **La série** — la même affiche en story, post et carré d'un seul geste.
- **Export** — ×1 à ×4 ou largeur libre, PNG / JPEG / WebP, fond
  transparent, avec le rappel de la taille obtenue en centimètres à
  300 ppp.
- **Taille du document** et **rotation** — la composition suit à
  l'échelle, textes et formes restent nets.
- **Aplatir en image**, **copier / coller le style**, **nuancier des
  couleurs employées**, **historique**, **recadrage de l'affiche**.
- **Photos Unsplash** — recherche intégrée, orientation, pagination.
  Les trois obligations de leur licence sont tenues : images appelées
  chez eux, photographe crédité dans le texte de publication, endpoint
  de téléchargement prévenu.

---

## 5. Raccourcis

| | |
|---|---|
| V A H Z | sélection · points de tracé · main · zoom |
| T P R O L F I | texte · plume · rectangle · ellipse · ligne · cadre photo · pipette |
| Espace | main temporaire |
| Ctrl Z / Ctrl ⇧ Z | annuler / rétablir |
| Ctrl D · Ctrl G · Ctrl A · Ctrl S | dupliquer · grouper · tout sélectionner · enregistrer |
| Ctrl C / V / X | copier · coller · couper |
| Ctrl Alt G | masque d'écrêtage |
| Ctrl ] / [ | monter / descendre (⇧ : premier / arrière-plan) |
| Ctrl 0 / 1 / 2 | ajuster · taille réelle · cadrer la sélection |
| molette | zoomer (⇧ : défiler, Alt : déplacer) |
| 1 … 9 , 0 | opacité 10 % … 100 % |
| ⇧ P | aperçu propre |
| flèches | déplacer de 1 px (⇧ : 10 px) |
| ⇧ pendant un redimensionnement | conserver les proportions |
| Alt pendant un redimensionnement | depuis le centre |
| Alt + glisser | dupliquer en place |
| F2 ou double-clic dans la pile | renommer un calque |
| tirer depuis une règle | poser un repère |

---

## 6. Ce qui est volontairement absent

Dit ici plutôt que laissé passer pour fonctionnel — un bouton mort coûte
plus cher qu'un bouton absent.

- **Opérations booléennes** (union, soustraction, intersection de
  formes). Le masque d'écrêtage couvre le besoin courant d'un club.
- **Texte sur un tracé.**
- **Détourage automatique par intelligence artificielle.** Les modèles
  de segmentation pèsent des dizaines de mégaoctets et se chargent
  depuis un CDN tiers : ni la CSP ni le poids ne le permettent. À la
  place : baguette magique, gomme et pinceau de masque, qui couvrent le
  fond uni et le fond dégradé — l'écrasante majorité des cas.
- **Historique par étape pendant la frappe** : une séance de saisie
  compte pour une seule annulation. Volontaire — annuler lettre à
  lettre est rarement ce qu'on veut.
- **Flou de calque sur les images** : réglé par *Retouche → Flou*, pas
  par *Apparence → Flou du calque* (les deux se cumuleraient).

### Limites connues

- **`ctx.filter`** (luminosité, contraste, saturation, flou) n'existe
  pas sur Safari antérieur à 15. Le Studio le détecte et ignore ces
  réglages plutôt que de mal dessiner ; le reste fonctionne.
- **Images d'un autre domaine** : chargées avec `crossOrigin`, avec
  repli sans CORS si le serveur refuse. Dans ce cas l'image s'affiche
  mais l'export échoue — le Studio prévient dans la fenêtre d'export et
  la pipette le dit aussi. La solution est de téléverser l'image dans la
  médiathèque.
- Le **fond de l'affiche** n'est pas un calque : il est réglé dans le
  panneau de droite quand rien n'est sélectionné. Pour une photo en
  fond, *Styles → Photo plein cadre* crée un vrai calque.
- Le **masque de fusion** est enregistré en PNG dans le projet, à
  1 100 px sur le côté le plus long. Assez fin pour un détourage propre
  à l'écran et en impression courante ; ce n'est pas une découpe au
  cheveu près.
- **Unsplash** exige une clé. Sans elle, le panneau *Photos* explique
  comment l'obtenir au lieu de faire semblant de chercher.

---

## 7. Tester sans l'administration

```
studio/banc-essai.html
```

Page autonome avec de fausses données du club et des images en
data-URI — aucune requête réseau. Elle sert aussi de témoin
d'étanchéité : ses `.btn`, `.card`, `.chip`, `.field` portent les mêmes
noms que ceux de l'administration. Si le Studio les repeint, ça se voit
immédiatement.

Elle a besoin d'un serveur (le fragment est chargé par `fetch`) :

```bash
python -m http.server 8899
```

puis `http://localhost:8899/studio/banc-essai.html`.

---

## 8. Vérifications passées

- Aucun sélecteur CSS ne commence autrement que par `#bstudio`.
- Aucun `@import`, aucun `!important`, aucune `url()` externe.
- Aucun nom déclaré deux fois à la racine de l'IIFE de l'administration.
- Les 66 `data-act` et les 68 entrées de menu ont tous un gestionnaire ;
  aucun bouton muet.
- Détourage vérifié de bout en bout : baguette magique sur une photo,
  52 % de l'image retirée, pixel de contrôle modifié, `Ctrl+Z` le
  restaure à l'identique.
- Garde-fou de fermeture : *Annuler* ne ferme rien, *Ne pas enregistrer*
  ferme, *Enregistrer* enregistre puis ferme.
- Cycle complet enregistrer → accueil → rouvrir : calques, masques et
  champs de données retrouvés.
- Tous les `id` cherchés par le script existent dans le fragment.
- Export ×1, ×2, ×3 : dimensions exactes du format.
- Annuler/rétablir restaure l'état au pixel près.
- Remplacer l'image d'un cadre laisse sa géométrie inchangée.
