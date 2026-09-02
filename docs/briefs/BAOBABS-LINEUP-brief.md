# Le Cinq majeur — brief de design

*Document destiné à un modèle de design, pour qu'il propose une maquette.
État au 27 août 2026.*

---

## 1. Ce qu'on demande, en une phrase

Dessiner **le bloc « composition d'avant-match »** de la page d'accueil d'un club
de basket féminin : les cinq titulaires du prochain match, les remplaçantes,
l'encadrement. Une seule maquette, statique, à intégrer ensuite en HTML/CSS.

Ce bloc **existe déjà et fonctionne** (voir §6). Ce qu'on cherche, c'est une
direction visuelle meilleure que celle en place — pas un correctif.

---

## 2. Le club, en trois lignes

**Baobabs Basket Club**, basket **féminin**, Dakar (Sénégal), Championnat National
de Division 2. Effectif réel : **8 joueuses**, 1 membre de staff. Le prochain match
est réel : `Baobabs vs UCAD SC`, samedi 19 septembre 2026, 19 h, Stadium Marius
Ndiaye.

Le public : supporters sénégalais, très majoritairement **sur téléphone**, via des
liens partagés sur WhatsApp et Instagram.

---

## 3. Les données disponibles — ni plus, ni moins

C'est la contrainte la plus dure. **Une maquette qui suppose une donnée absente
n'est pas réalisable.**

### Par joueuse

| Champ | Type | Réalité |
|---|---|---|
| `name` | texte | « Aïda Diop », « Ndèye Guèye » — accents fréquents, 8 à 16 caractères |
| `jersey_number` | entier | 4, 6, 7, 10, 11, 15, 23, 33 — **1 ou 2 chiffres** |
| `position` | texte | exactement 5 valeurs : `Meneuse`, `Arrière`, `Ailière`, `Ailière-forte`, `Pivot` |
| `photo_url` | URL | portrait **détouré sur fond transparent ou uni**, cadrage variable |
| `photo_x`, `photo_y`, `photo_zoom` | nombres | **le cadrage choisi dans l'admin** — à respecter, voir §5 |
| `status` | texte | `active`, `blessee`, `prete`, `partie` |
| `is_captain` | booléen | **une seule** joueuse par match, souvent aucune |
| `lineup_sort` | entier | le rang voulu par le staff, 1→5 pour le cinq |

### Par match

`opponent_name` (« UCAD SC »), `opponent_logo_url` (écusson, souvent carré, fond
variable), `match_date`, `match_time`, `venue` (« Stadium Marius Ndiaye (Dakar) »),
`is_home` (booléen), `competition` (**long** : « Championnat National de Division 2
(Féminin) »), `round_label` (souvent **vide**).

### Ce qui n'existe pas et ne peut pas être inventé

- Pas de statistiques par joueuse fiables avant le match (points, moyenne…).
- Pas de taille, pas de poste secondaire, pas de surnom.
- Pas de photo d'action, pas de photo d'équipe, pas de photo de salle.
- Pas de logo d'adversaire garanti : `opponent_logo_url` peut être vide.
- **Pas de vidéo, pas de son.**

### Ce qui peut manquer un jour de match

Le bloc doit tenir **sans** : brassard de capitaine, écusson adverse, `round_label`,
photo d'une joueuse, banc explicitement saisi (il est alors déduit), encadrement.
Une maquette qui s'écroule sans l'un d'eux n'est pas utilisable.

---

## 4. L'identité du club — non négociable

Ces valeurs sont déjà partout sur le site. **Ne pas proposer une autre palette.**

| Rôle | Valeur |
|---|---|
| Vert profond (fond) | `#0C2A1C` → `#081C13` → `#05100A` |
| Vert terrain | `#0F4030` |
| Or | `#C6A257`, clair `#E4C179` |
| Lime (accent vif) | `#A8D93B` |
| Crème (texte) | `#F3EFE6` |
| Titres / chiffres | **Anton** (grotesque condensée, capitales) |
| Texte courant | **Inter** (400 à 900) |

Le site est **sombre**, en permanence. Il n'y a pas de mode clair.

---

## 5. Les contraintes techniques

| | Réalité |
|---|---|
| Intégration | HTML + CSS écrits à la main dans un fichier statique unique |
| Framework | **aucun** — pas de React, pas de Tailwind, pas de build |
| Librairies | **aucune** pour ce bloc. Pas de GSAP, pas de Swiper |
| Polices | **Anton et Inter seulement** — déjà chargées, n'en ajoutez pas |
| Images | Les portraits sont servis tels quels, avec `object-fit:cover` et le cadrage `photo_x/y/zoom` de l'admin. **On ne peut pas détourer, ni recadrer manuellement, ni retoucher.** |
| Largeur | Le bloc vit dans un conteneur centré, ~1 135 px au maximum |
| Ruptures | 5 colonnes ≥ 980 px, 3 colonnes ≥ 620 px, 2 colonnes en dessous |
| Mouvement | Révélation au défilement, très sobre. `prefers-reduced-motion` respecté |
| Accessibilité | Contraste 4.5:1 sur le texte, focus visible, aucune information portée par la seule couleur |

**Le point qui décide de tout : les huit portraits ne forment pas une série.**
Ils ont été pris à des moments différents, sous des lumières différentes, avec des
fonds différents. Une maquette qui suppose huit photos studio homogènes ne
survivra pas au contact du réel. La version actuelle règle ça en les passant tous
au vert du club (`mix-blend-mode: color`) ; toute autre solution est bienvenue,
mais **il en faut une**.

---

## 6. Ce qui existe aujourd'hui, et ce qu'on lui reproche

Le bloc actuel : un titre « Cinq majeur » en Anton, une ligne de match en capitales
séparée par des barres obliques, **cinq cartes portrait 3/4** en grille, avec le
numéro en gros bas-gauche, le poste en pastille lime en haut, le nom en bandeau
dessous ; puis un encadré « Remplaçantes » listant numéro + nom.

Il fonctionne. Le reproche est qu'il **suit de trop près la référence** dont il
s'inspire (une planche « Starting XV » de rugby) sans apporter d'idée propre au
club. C'est exactement ce qu'on vous demande d'apporter.

*(La version précédente, abandonnée, posait cinq portraits ronds sur un plan de
terrain. Elle a été jugée paresseuse. Ne pas y revenir.)*

---

## 7. Les références envoyées par le club

1. **Bath Rugby — « Schedule »** : une grille de cartes de dates, écussons
   adverses, alternance bleu/blanc pour domicile/extérieur. Ce qui plaît :
   la rigueur de la grille, le contraste, la lisibilité de loin.
2. **Crusaders — « Starting XV »** : 15 portraits rectangulaires en grille 5×3,
   traitement rouge duotone avec grain, numéro et nom sous chaque photo, bloc
   « REPLACEMENTS » en texte au pied. Ce qui plaît : le traitement unique des
   photos, la hiérarchie, l'air d'affiche imprimée.

Le club aime ces deux planches. Il ne veut pas leur copie.

---

## 8. Ce qu'on attend comme livrable

1. **Une maquette** du bloc en desktop (≈1 135 px de large) **et** en téléphone
   (375 px). Image, ou HTML/CSS autonome — les deux conviennent.
2. **Les règles** qui la tiennent : échelle typographique, espacements, traitement
   des photos, comportement des états manquants (§3).
3. **Une phrase par décision** : pourquoi cette disposition plutôt qu'une autre.

Ce qui **ne** sert **pas** : un système de design complet, une charte, des
composants génériques, une bibliothèque d'icônes. Un seul bloc, bien pensé.

---

## 9. Les questions auxquelles la maquette doit répondre

- Comment cinq portraits hétérogènes deviennent-ils **une équipe** à l'œil ?
- Le numéro de maillot : gros et sur la photo, ou petit et dans la légende ?
- Le poste : utile au supporter, ou bruit ? (5 valeurs, en français, longues)
- Que fait la grille quand il n'y a **que 5 cartes** — 5 colonnes serrées, ou
  moins de colonnes et des cartes plus grandes ?
- À 375 px, que voit-on **sans faire défiler** ?
- Les remplaçantes : du texte, ou des visages plus petits ? (elles sont 3, parfois 7)
- Où passe l'écusson de l'adversaire, sachant qu'il peut être absent ?
