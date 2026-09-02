# Baobabs Studio — brief projet

*Document destiné à être soumis à un autre modèle pour avis critique.
État au 21 août 2026.*

---

## 1. Le contexte, sans enjoliver

**Baobabs Basket Club** est un club de basket féminin à Dakar (Sénégal), qui joue en
Championnat National de Division 2. Effectif d'environ 8 joueuses, 1 membre de staff,
5 partenaires. Le club a un site public et un espace d'administration.

**Qui utilise l'outil :** une à deux personnes non techniques. Pas une équipe design.
La personne qui gère le club au quotidien a dit textuellement :
*« à moi tout seul je ne peux pas sortir des idées de dingue sur chaque section »*.
C'est la contrainte centrale : **l'outil doit proposer, pas attendre qu'on invente.**

**Le besoin :** produire les visuels du club — affiche du prochain match, résultat,
ouverture de billetterie, présentation d'une joueuse — pour Instagram, Facebook,
WhatsApp et le site. Aujourd'hui ces visuels sont faits à la main dans un outil
externe, et il faut recopier chaque fois l'adversaire, la date, la salle, les tarifs.

---

## 2. La contrainte technique, qui est sévère

Ce point est décisif pour juger toute proposition.

| | Réalité |
|---|---|
| Architecture | **Deux fichiers HTML statiques.** Pas de React, pas de Vue, pas de Tailwind |
| Build | **Aucun.** Pas de `package.json`, pas de bundler, pas de npm |
| Taille | `admin-matchs.html` : ~15 700 lignes, ~1,4 Mo, **une seule IIFE** |
| JS | Vanilla ES5, `var` et `function`, aucun module |
| Dépendances | `supabase-js` et `jspdf`. C'est tout |
| Données | Supabase (PostgreSQL + REST + RLS), appelé directement depuis le navigateur |
| Hébergement | Vercel, fichiers statiques |
| CSP | Stricte. `connect-src` limité à `self` + Supabase + `api.web3forms.com` |

**Conséquences directes :**

- Impossible d'installer une bibliothèque via `npx`. Toute suggestion du type
  « utilisez Fabric.js / Konva / shadcn / Magic UI » suppose un socle qui n'existe pas.
- Une banque d'images externe (Unsplash, Pexels) nécessiterait **de modifier la CSP**
  dans `vercel.json` et, pour la plupart, une clé d'API qui serait exposée en clair
  dans le HTML public.
- Le fichier étant une seule portée, **deux fonctions de même nom s'écrasent en
  silence**. C'est arrivé en production : un écran entier était mort sans la moindre
  erreur en console. Toute contribution doit être vérifiée sur ce point.

---

## 3. Ce qui existe aujourd'hui

Le Studio est une surcouche plein écran de l'administration, atteignable par un
bouton de la barre du haut — délibérément **pas** un écran de gestion parmi les 43.

### Architecture retenue

**Modèle en blocs.** Un modèle ne dessine pas : il produit une liste de blocs.
Chaque bloc est `{id, type, texte, style, x, y, largeur, alignement, couleur, échelle}`.
Les positions et tailles sont des **fractions de la largeur**, jamais des pixels.

**Rendu en canvas 2D**, pas en SVG. Raison : le canvas utilise les polices déjà
chargées par la page, donc l'aperçu à l'écran et le PNG exporté sont le même dessin.
Un SVG converti en image perd ses polices et l'export cesse de ressembler à l'aperçu.

**Poignées HTML superposées.** Le canvas ne reçoit aucun événement : une couche de
`<div>` positionnés à l'échelle de l'aperçu capte les clics et le glisser. Cette
couche n'est jamais exportée.

**Une seule fonction de rendu** (`stRendreSur(ctx, W, H)`) sert l'aperçu et l'export.
Les tailles étant des fractions, exporter en ×3 redessine à la vraie résolution —
le texte reste net, il n'est pas agrandi.

### Fonctionnalités livrées

- **4 modèles** : affiche de match, résultat, billetterie ouverte, fiche joueuse.
  Chacun se pré-remplit avec les **vraies données** tirées de Supabase.
- **5 formats** : story 1080×1920, post 1080×1350, carré 1080×1080,
  bannière 1600×900, aperçu de lien 1200×630.
- **Mises en page interchangeables** par modèle (2 à 3 par modèle).
- **10 rôles typographiques** : assommoir, assommoir vide (contour), titre,
  sous-titre, sur-titre, paragraphe, pastille, carte, chiffre géant, mention.
  Chaque rôle porte sa police, graisse, interlettrage et casse.
- **5 ambiances** de couleur.
- **Image de fond** : sélecteur de vignettes (bucket Supabase + images référencées
  dans les fiches joueuses / matchs / articles), champ d'adresse, téléversement.
  Réglages : cadrage horizontal et vertical, zoom, voile d'assombrissement.
- **Formes** : rectangle, cercle, filet — remplissage plein, dégradé ou contour.
- **Outils d'ajout** : titre, texte, forme.
- **Glisser-déposer** des blocs, sélection, duplication, suppression.
- **Zoom** avant / arrière / ajuster.
- **Raccourcis** : flèches (Maj = ×10), Suppr, Ctrl+D, `+`, `−`, `0`, Échap.
- **Export PNG** en ×1, ×2 HD, ×3 Ultra (jusqu'à 3240×5760), ou envoi direct
  dans la médiathèque du club.
- Aperçu **ordinateur / téléphone**.

### Polices

Le site utilise **Anton** (display condensé), **Space Grotesk** et **Inter**.
L'administration utilise Archivo et Inter. Le Studio charge les polices du *site*
pour que les affiches portent la typographie de la marque, et attend
`document.fonts.load()` avant le premier dessin — sinon le canvas écrit en police
de repli.

---

## 4. Ce qui manque, reconnu

- **Pas de sauvegarde de brouillon.** On compose, on exporte, on perd tout.
- **Pas de banque d'images externe** (Unsplash, Pexels) — voir la contrainte CSP.
- **Pas de redimensionnement au coin**, seulement un curseur de largeur et d'échelle.
- **Pas de calques** : l'ordre des blocs est celui du modèle, non modifiable.
- **Pas de repères d'alignement** ni de magnétisme pendant le glisser.
- **Pas de rotation.**
- **Pas de multi-sélection.**
- **Pas de logos d'équipes** posés automatiquement dans les modèles de match
  (ils existent en base, ils ne sont pas encore des blocs).
- **Pas de séries** : impossible de générer les 5 affiches d'un mois d'un coup.
- **Pas d'historique d'annulation propre au Studio** (l'admin en a un, pas le Studio).

---

## 5. La direction artistique visée

Les références fournies par le client sont des visuels sportifs et tech contemporains :
affiches de match de clubs européens, posts d'agences, dashboards SaaS.
Traits communs relevés :

- Typographie display **très grande et condensée**, souvent en capitales,
  qui occupe 30 à 50 % de la hauteur
- Texte en **contour** mélangé au texte plein dans le même titre
- **Pastilles arrondies** et cartes empilées type bento
- Une **couleur d'accent unique et saturée** sur fond très sombre
- Photo détourée ou traitée en bichromie, occupant la moitié du cadre
- Alignements francs, marges généreuses, peu d'éléments

Le retour du client sur la première version était : *« l'interface est basique et
les polices franchement je n'aime pas, ça n'a pas de caractère »*.

---

## 6. Les questions posées

1. **L'architecture en blocs est-elle la bonne**, ou faut-il aller vers un modèle
   de calques plus classique — et à quel coût, sachant qu'il n'y a pas de build ?

2. **Canvas contre SVG** : le choix du canvas se justifie par la fidélité des
   polices à l'export. Y a-t-il un argument sérieux en faveur du SVG qui
   résisterait à cette contrainte ?

3. **Quelles fonctionnalités manquantes changeraient réellement le résultat**
   pour un club amateur d'une à deux personnes — par opposition à celles qui
   flattent la démonstration sans servir l'usage ?

4. **Comment obtenir du « caractère » typographique** avec Anton, Space Grotesk
   et Inter, sans ajouter de polices payantes ? Quels rôles, quelles combinaisons,
   quels rapports d'échelle ?

5. **La banque d'images externe vaut-elle la modification de la CSP ?**
   Argument contre : un club de basket devrait afficher ses propres joueuses,
   pas des photos de stock. Argument pour : les fonds abstraits et textures.

6. **Quel est le plus court chemin** entre l'état actuel et un outil dont une
   personne non designer sort une affiche publiable en moins de trois minutes ?

7. **Qu'est-ce qui, dans cette liste, est une fausse bonne idée ?**

---

## 7. Ce qu'on ne veut pas comme réponse

- Des suggestions qui supposent React, un bundler ou `npx`.
- Une liste de bibliothèques à installer.
- « Refaites tout en Next.js » — l'administration fonctionne, elle vient d'être
  auditée écran par écran et corrigée ; une réécriture réintroduirait des bugs
  qui ont demandé une journée à trouver.
- Des fonctionnalités de designer professionnel (courbes de Bézier, masques,
  modes de fusion) : l'utilisateur n'est pas designer et ne le deviendra pas.

Ce qu'on veut : **un avis motivé sur les priorités**, et les angles morts.
