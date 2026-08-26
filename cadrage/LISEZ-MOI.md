# Baobabs Cadrage — placer une image dans son cadre

Trois fichiers, un seul global, aucune étape de compilation.

```
cadrage/
  cadrage.css      feuille de style, tout sous #bcadrage
  cadrage.js       window.BaobabsCadrage = {monter, ouvrir, fermer, estOuvert}
  banc-essai.html  page de test autonome — pas un écran du site
  LISEZ-MOI.md     ce fichier
```

---

## 1. Ce que ça fait

Le site rogne certaines images pour les faire entrer dans un cadre :
le hero, les photos du Face-Off, les vignettes Médias, les images
d'attente des vidéos, les affiches des Tryouts. Jusqu'ici, *où* l'image
tombait dans ce cadre était écrit dans le code.

L'atelier ouvre l'image dans un cadre **de la forme exacte de celui du
site**, et laisse la déplacer au doigt, zoomer à la molette. Il rend six
nombres — trois pour l'ordinateur, trois pour le téléphone.

Ce n'est pas le Studio : on ne dessine pas, on ne détoure pas, on
n'exporte rien. On place une image dans une fenêtre, c'est tout.

---

## 2. Comment c'est branché

`admin-matchs.html` contient :

- un `<link rel="stylesheet" href="/cadrage/cadrage.css">` (2 Ko, chargé
  d'emblée) ;
- un conteneur vide `<div id="bcadrage"></div>` ;
- `cadrageCharger()` / `cadrageOuvrir()`, qui vont chercher le script
  **au premier clic sur « Cadrer »** seulement.

Le conteneur est déplacé sous `<body>` avant d'être monté : il vit dans
`#app`, et `#app` passe en `display:none` sur l'écran de connexion. Un
ancêtre masqué annule le `position:fixed` — c'est ce qui avait fait
ouvrir le Studio à 0 × 0, sans la moindre erreur en console.

**Pourquoi un fichier séparé ?** `admin-matchs.html` est une seule IIFE
de 16 000 lignes : deux fonctions de même nom s'y écrasent en silence, et
c'est déjà arrivé en production.

---

## 3. Le contrat

```js
BaobabsCadrage.monter(hote);          // une seule fois

BaobabsCadrage.ouvrir({
  url:     '/media/img/…',            // l'image à cadrer
  titre:   'Image du hero',           // ce qu'on cadre, affiché en tête
  ratioD:  0.97,                      // largeur ÷ hauteur du cadre, ordinateur
  ratioM:  0.79,                      // idem, téléphone
  valeurs: {x, y, zoom, mx, my, mzoom},
  onValider: function(v){ … }         // reçoit les six nombres
});
```

L'atelier ne connaît **ni Supabase, ni les tables, ni les noms de
réglages**. Il reçoit une image et six nombres, il rend six nombres.

Un `mx` vide (ou `null`) veut dire « le téléphone suit l'ordinateur ».
L'onglet Téléphone montre alors les valeurs de l'ordinateur, dans le
cadre du téléphone — c'est précisément là qu'on voit qu'un visage bien
placé en 16/9 sort du cadre en 3/4. Le bouton « Régler le téléphone à
part » détache les trois valeurs, en partant de celles de l'ordinateur.

---

## 4. Où vont les six nombres

Dans `site_settings`, à côté de l'image, avec des suffixes :

```
ps_poster_url          l'image
ps_poster_url_x        \
ps_poster_url_y         >  ordinateur
ps_poster_url_zoom     /
ps_poster_url_mx       \
ps_poster_url_my        >  téléphone (vides = suit l'ordinateur)
ps_poster_url_mzoom    /
```

**Aucune migration SQL** : `site_settings` est une table clef/valeur.

Le tableau `CADRABLES` (dans `admin-matchs.html`) dit quelles images sont
cadrables, la forme de leur cadre, et le cadrage écrit en dur dans la
page pour celles qui en ont un (`y0`). C'est le seul endroit à toucher
pour en ajouter une.

---

## 5. Le rendu, côté site

Le même CSS que les photos de joueuses et les images d'actualités —
s'en écarter aurait donné deux cadrages qui ne tombent pas au même
endroit pour les mêmes chiffres :

```css
object-fit: cover;
object-position: X% Y%;
transform: scale(Z/100);
transform-origin: X% Y%;
```

Deux règles seulement dans `index.html` :

```css
.bb-cadre{ --cc-x:var(--cx,50%); --cc-y:var(--cy,50%); --cc-z:var(--cz,1); }
@media(max-width:768px){
  .bb-cadre{ --cc-x:var(--mcx,var(--cx,50%)); … }
}
```

`bbCadre()` pose les six variables sur l'image et écrit
`object-position: var(--cc-x) var(--cc-y)` **en ligne** (certaines images
portent déjà un `object-position` en dur : une règle de feuille perdrait
contre lui). C'est le `@media` qui décide du contenu des variables : un
téléphone qui pivote suit sans qu'une ligne de JavaScript ne tourne.

**Sans aucun réglage enregistré, `bbCadre()` ne touche à rien.** L'image
garde le cadrage écrit dans la page. Appliquer un 50 % par défaut aurait
recadré le hero le jour de la mise en ligne, sans que personne ne l'ait
demandé.

---

## 6. Le banc d'essai

`/cadrage/banc-essai.html` ouvre l'atelier sans passer par
l'administration ni par Supabase, et affiche le résultat dans deux cadres
qui appliquent exactement le CSS du site. Son `<script>` porte un
anti-cache : sur un banc d'essai, relire la version d'il y a dix minutes
fait chercher des bugs déjà corrigés.
