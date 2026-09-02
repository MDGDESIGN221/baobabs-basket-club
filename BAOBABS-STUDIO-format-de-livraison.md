# Baobabs Studio — format de livraison attendu

*À remettre à qui produit l'interface. Ce document dit comment livrer les
fichiers pour qu'ils s'intègrent sans être réécrits.*

---

## Pourquoi ce document

Une première version a été livrée en trois fichiers autonomes
(`index.html`, `styles.css`, `app.js`). Elle fonctionnait parfaitement
**seule**, et a cassé l'administration à l'intégration. Quatre causes,
toutes évitables à la source :

| Ce qui a cassé | Pourquoi |
|---|---|
| Variables, marges et polices de l'admin écrasées | `:root`, `* { margin:0 }`, `html,body { overflow:hidden }`, `button`, `input`, `svg` sont des sélecteurs globaux |
| Mauvais éléments attrapés par le JS | `.btn`, `.field`, `.chip`, `.select`, `.avatar`, `.tab`, `.card`, `.toggle` existent **déjà** dans l'admin |
| L'atelier s'empilait dans la page au lieu de la recouvrir | La maquette tirait sa hauteur de `html,body` ; une fois scopée elle n'héritait plus de rien |
| Le code partait avant que son DOM existe | Il s'exécutait au chargement, pas à l'ouverture |

Le socle d'accueil : **un seul fichier HTML de ~15 000 lignes, tout le JS
dans une seule IIFE, aucune étape de compilation, ni npm ni bundler.**

---

## 1. Trois fichiers, et un seul point d'entrée

```
studio.css     — feuille de style, entièrement scopée
studio.html    — fragment HTML, pas un document
studio.js      — un seul global : window.BaobabsStudio
```

Plus un `LISEZ-MOI.md` court : polices requises, ce qui est volontairement
non implémenté, et les dépendances éventuelles.

---

## 2. `studio.css`

**Racine unique : `#bstudio`.** Chaque sélecteur en découle.

```css
/* ✅ */  #bstudio { --bs-accent:#7DFF4F; --bs-bg:#0E0E10; }
/* ✅ */  #bstudio .bs-btn { ... }
/* ✅ */  #bstudio *, #bstudio *::before { box-sizing:border-box }

/* ❌ */  :root { --accent:#7DFF4F }
/* ❌ */  * { margin:0 }
/* ❌ */  html, body { overflow:hidden }
/* ❌ */  button { border:none }
/* ❌ */  .btn { ... }
```

**Préfixe de classe `bs-` sur tout.** `bs-topbar`, `bs-rail`, `bs-panel`,
`bs-canvas`, `bs-layer-row`… Le scope CSS suffit pour le style, mais le
préfixe protège aussi le JS : sans lui, un `querySelector('.btn')` mal
scopé attrape un bouton de l'admin.

**La racine porte elle-même son comportement de surcouche.** C'est le
piège le plus coûteux de la dernière fois :

```css
#bstudio { position:fixed; inset:0; z-index:400; display:none; }
#bstudio.is-open { display:block; }
#bstudio .bs-app { height:100%; display:flex; flex-direction:column; }
```

**Interdits :** `@import`, `url()` vers un domaine externe (data: URI
accepté), `!important` sauf justification écrite.

---

## 3. `studio.html`

Un **fragment**, pas un document. Ni `<html>`, ni `<head>`, ni `<body>`,
ni `<link>`, ni `<script>`.

```html
<div id="bstudio" role="dialog" aria-modal="true" aria-label="Baobabs Studio">
  <div class="bs-app">
    ...
  </div>
</div>
```

Doit contenir **un bouton de fermeture** `id="bs-close"` — une page
autonome n'en a pas besoin, une surcouche si.

Les polices nécessaires sont **listées dans le LISEZ-MOI**, pas
chargées par un `<link>` : je les ajoute au lien Google Fonts existant.
Aujourd'hui le socle charge déjà Archivo, Inter, Anton, Space Grotesk.

---

## 4. `studio.js` — le contrat de montage

**Aucune exécution automatique.** Pas d'IIFE qui démarre seule.
**Un seul global**, exactement :

```js
window.BaobabsStudio = {
  mount(root, api),   // appelé une fois, à la première ouverture
  open(),             // ajoute .is-open
  close(),            // retire .is-open
  isOpen()            // -> bool
};
```

Règles :

- Toute recherche DOM passe par `root.querySelector` / `root.querySelectorAll`.
  **Jamais `document.querySelector` sur une classe.** (`document` reste
  permis pour `keydown`, `mousemove`, `mouseup`.)
- **Aucun `fetch`, aucun accès à Supabase, aucun `localStorage`.** Toutes
  les données et tous les envois passent par `api`.
- JavaScript simple : pas de `import`/`export`, pas de JSX, pas de
  TypeScript, pas de dépendance npm. ES6 est accepté (le navigateur est
  moderne), les modules non.
- Si une dépendance externe est indispensable, la **déclarer** dans le
  LISEZ-MOI plutôt que de la charger : seuls `cdnjs`, `jsdelivr` et
  `unpkg` passent la CSP du site.

---

## 5. `api` — ce que je fournis au montage

Tout renvoie une promesse. **En cas d'échec je renvoie un tableau vide ou
`null` : le Studio ne doit jamais planter sur une donnée absente**, il
doit retomber sur ses valeurs de maquette.

```js
api = {
  data: {
    nextMatch(),     // {opponent, competition, date, time, venue, isHome, opponentLogo} | null
    lastResult(),    // {opponent, scoreUs, scoreThem, date} | null
    players(),       // [{name, number, position, photo}]
    ticketOffers(),  // [{category, price, isOpen}]
    media()          // [{url, name}]  ← médiathèque + images des fiches
  },

  uploadImage(file),        // File -> Promise<url public>
  renderToPng(el, w, h),    // élément DOM -> Promise<Blob>   (je gère la conversion)
  download(blob, filename), // déclenche le téléchargement

  toast(message, isError),  // le bandeau de l'admin, pas le vôtre
  clubLogo,                 // string, URL du logo
  formatDate(iso),          // '2026-09-19' -> 'SAM. 19 SEPT.'
  today()                   // '2026-09-19'
};
```

`renderToPng` est de mon côté volontairement : la conversion DOM → image
dépend de la CSP et d'une bibliothèque que je dois maîtriser.

---

## 6. Une contrainte de conception à connaître avant de dessiner

L'affiche est du **DOM**, donc l'export doit la reconstruire en image.
La conversion **ne rend pas** :

- `backdrop-filter`
- `mix-blend-mode`
- certains `filter`
- les masques CSS

Conséquence concrète : un grain posé en `mix-blend-mode: overlay`
**disparaîtra du PNG exporté** alors qu'il est visible à l'écran.

À faire à la place : grain en PNG data-URI à opacité simple, ombres en
`box-shadow`, dégradés en `linear-gradient`. Autrement dit, **l'identité
visuelle de l'affiche ne doit reposer sur aucun de ces quatre effets.**
Ils peuvent servir de bonus, jamais de fondation.

---

## 7. Ce qui doit vraiment agir

La dernière livraison affichait un bandeau « Export en cours… » sans
exporter, et « Annulé » sans rien annuler. Chaque contrôle visible doit
produire un effet réel, ou ne pas être livré.

| Contrôle | Effet attendu |
|---|---|
| Calques ▲▼ / glisser | Réordonne réellement la pile, l'affiche change |
| Œil / cadenas | Masque / verrouille pour de vrai |
| Annuler / Rétablir | Restaure l'état précédent, y compris l'ordre des calques |
| Export | Produit un PNG à la résolution du format |
| Publier | Envoie dans la médiathèque via `api.uploadImage` |
| Barre d'outils (Texte, Image, Logo, Forme, Ligne, Icônes) | Insère l'élément |
| Dupliquer / Supprimer | Sur l'élément sélectionné |
| Recherche, pastilles, onglets | Filtrent la grille |
| Palettes | Repeignent fond, accent et texte |
| Modèles | Changent la composition, pas seulement deux textes |
| Formats | Changent les dimensions de l'affiche |
| Zoom / Ajuster | Agissent sur la scène |

Si quelque chose n'est pas branché, **le dire dans le LISEZ-MOI** plutôt
que de le laisser passer pour fonctionnel. Un bouton mort coûte plus cher
qu'un bouton absent : on croit que ça marche, on s'en sert, et on perd
son travail.

---

## 8. Comment je vérifierai

1. Scope CSS : aucun sélecteur ne doit commencer autrement que par
   `#bstudio` (hors commentaires et at-rules).
2. Collisions : aucun nom déclaré deux fois au niveau racine.
3. L'admin après montage : polices, marges, défilement et barre latérale
   inchangés, zéro erreur console sur les 43 écrans.
4. La surcouche couvre bien la fenêtre à l'ouverture.
5. Chaque contrôle du tableau ci-dessus, cliqué une fois.
