# Ce que fait le tutoriel de l'administration, aujourd'hui

Description factuelle de l'existant, avant d'en discuter l'amélioration.
Tout ce qui suit est mesuré dans le code ou au banc d'essai, pas estimé.

---

## 1. Le décor

**Baobabs Basket Club**, club de basket à Dakar. Site public + une administration
web **en production**, utilisée tous les jours par des bénévoles : le président,
un directeur sportif, des coachs, une personne aux réseaux.

- `admin-matchs.html` — **16 500 lignes**, vanilla JS, une seule IIFE, base
  Supabase/PostgREST. **Pas de framework, pas de build**, déployé tel quel.
- **43 écrans**, rangés en 10 groupes dans une barre latérale.
- **5 rôles** : `super_admin`, `president`, `directeur_sportif`, `coach`,
  `community_manager`. Chaque rôle ne voit que ses écrans — un coach en a 13.
- Un **Studio** à part (11 600 lignes) : un éditeur graphique qui compose les
  affiches du club. Calques, formats, modèles, export, publication.

Le tutoriel vit dans trois fichiers séparés (`tutoriel.js` ~2 450 lignes,
`tutoriel.css` 780, `tutoriel.html` 195), chargés au premier clic.

---

## 2. Le principe de construction

**Le tutoriel ne contient aucun texte de tutoriel.** Il lit l'administration à
l'exécution : le plan des chapitres vient du DOM de la barre latérale, les
titres et les explications viennent des registres de l'admin (`SECTION_META`,
`SECTION_HELP`), les repères à désigner viennent de `TUT_CIBLES`.

Trois conséquences :
- le **filtrage par rôle est gratuit** — l'admin a déjà masqué les entrées
  interdites, donc un coach reçoit sa version courte sans qu'on ait rien écrit
  pour lui ;
- un écran ajouté à l'admin **entre au tutoriel tout seul** ;
- corriger une bulle d'aide corrige le tutoriel.

---

## 3. Le déroulé

L'ordre suit une journée, pas le code :

1. **Arriver et se connecter**
2. **Le bandeau du haut** — les commandes présentes partout
3. **Les rôles et les accès**
4. **Les écrans**, groupe par groupe (Pilotage, Match day, L'effectif, Boutique,
   Réglages…)
5. **Le Studio** — composer une affiche
6. **À vous** — deux exercices

Un sommaire présente les chapitres en cartes, chacune avec sa durée annoncée.
Un bouton « Tout me montrer » enchaîne l'ensemble. Durées annoncées :
**≈ 19 min pour un super_admin, ≈ 5 min pour un coach.**

La progression est retenue (localStorage) : on reprend où on s'est arrêté.

---

## 4. Ce qui se passe à l'écran, étape par étape

Chaque étape suit la même mécanique :

- **Le narrateur** — une boîte de dialogue affiche le texte, avec un anneau de
  progression et le compteur « étape N sur M ». Il **se replace tout seul** pour
  ne jamais couvrir ce qu'il désigne.
- **La voix** lit le texte (Web Speech API). Le texte est retraité pour elle :
  les flèches, barres obliques et symboles sont dits en toutes lettres, les URL
  deviennent « l'adresse affichée à l'écran », « Baobabs » est mis au singulier
  parce que les moteurs français prononcent le S final.
- **L'écran arrive** au lieu d'apparaître — un léger recul, puis la mise au point.
- **Le halo** entoure la cible ; son contour se **dessine trait par trait**.
- **Un fil courbe** relie le narrateur à ce qu'il désigne, quand les deux sont
  assez éloignés.
- **Le pointeur** — une flèche dessinée — **voyage** jusqu'à la cible (0,9 s,
  avec une traînée), puis **agit** (voir §5).

Aucune étape ne dure moins de 2,2 s, et aucune ne part avant la fin de son geste.

---

## 5. Ce que fait le pointeur — le point important

Le geste **se déduit de ce que la cible est**, à l'exécution. Rien n'est déclaré
étape par étape : sur 98 repères vers un fichier qui bouge, une liste écrite à la
main se périmerait en silence.

| la cible est… | la main |
|---|---|
| un groupe de 2 à 6 entrées | les visite **une par une** et appuie sur chacune |
| une liste de plus de 6 | en **échantillonne trois** |
| un bouton, un lien, un onglet | **appuie** |
| une région d'affichage | la **balaie** en trois temps le long de son grand côté |

Mesuré sur le vrai `admin-matchs.html`, 98 repères : **8 groupes, 6 pressables,
70 régions, 14 non mesurables hors ligne** — soit **86 % des repères avec un
geste**.

L'appui est **purement visuel** : aucun événement n'est émis, rien n'est
déclenché dans l'administration. C'est ce qui permet de l'appliquer partout.

---

## 6. Ce qui est manipulé pour de vrai

- **L'écran de connexion** est réellement affiché, mais **rendu inerte** : on
  voit les champs, on ne peut ni s'authentifier ni se déconnecter. Le champ mot
  de passe n'est jamais rempli.
- **7 écrans ont une démonstration** : le tutoriel remplit des champs, choisit
  dans des listes, clique — puis **remet tout comme c'était**. Un **double
  verrou** bloque toute écriture pendant ce temps : les cinq fonctions d'accès à
  la base, plus `fetch` lui-même pour tout ce qui n'est pas une lecture.
  Vocabulaire des gestes : `saisir`, `choisir`, `cliquer`, `montrer`.
- **Un clavier fantôme** s'affiche pendant une saisie, ses touches s'allument au
  rythme des lettres.
- **Le Studio ouvre un vrai plan de travail** : un document monté en mémoire à
  partir d'un modèle, `project.id` nul, jamais enregistré. On visite la colonne
  d'outils, les calques, les propriétés, le zoom. **Enregistrer, Exporter et
  Publier sont désignés, jamais cliqués.**
- **Un bac à sable** en fin de parcours : deux exercices sur des données qui
  n'existent que pour la personne — faire glisser une candidature d'une colonne
  à l'autre, créer une catégorie de billet. Rien n'est enregistré.

---

## 7. Le reste

- **Un panneau d'aide contextuel** ouvert depuis l'en-tête : il part de l'écran
  où l'on se trouve, donne ses conseils, et répond à « qui a accès à cet écran »
  en lisant les **vraies permissions** en base.
- **Un export PDF** du tableau des rôles.
- **Un interrupteur d'animations** visible : « mouvement réduit » activé dans le
  système rendait tout plat sans que personne comprenne pourquoi.
- **Un diagnostic** (`BaobabsTutoriel.diagnostic()`) qui signale les repères
  devenus introuvables — indispensable, l'admin bouge.

---

## 8. Ce qu'on sait de ses faiblesses

Dit franchement, pour éviter qu'on nous les répète :

1. **C'est une visite guidée.** 43 écrans montrés, **7 manipulés**, 2 exercices
   tout à la fin. Quelqu'un qui regarde 19 minutes reste un spectateur.
2. **Rien n'est jamais demandé à la personne** avant la toute fin.
3. **Aucune mémoire de ce qui est acquis** — on enregistre les écrans *vus*.
4. **Le rôle filtre les écrans, pas l'apprentissage.** Un coach qui vient saisir
   une feuille de match reçoit la même mécanique qu'un administrateur.
5. **Il ne s'invite jamais** : il faut savoir qu'il existe et cliquer dessus.
6. **La voix impose son rythme** et sonne synthétique.
7. **Le téléphone n'a jamais été le sujet.** Tout est pensé sur écran large.

---

## 9. Les contraintes, pour que les propositions soient utilisables

- **Vanilla JS, aucune dépendance à installer.** Pas de React, pas de build.
- **Aucune écriture en base pendant le tutoriel** — sauf éventuellement une table
  dédiée à la progression, à créer.
- **L'admin est en production**, et il y a **une seule personne** pour la tenir.
- **Le tutoriel ne recopie aucun texte de l'admin** : c'est ce qui le maintient à
  jour tout seul. Une proposition qui obligerait à dupliquer du contenu doit être
  très rentable pour valoir le coup.
- Public **francophone**, à Dakar. Connexions parfois lentes, téléphones parfois
  modestes.

---

## 10. La question

On veut **améliorer le tutoriel sur l'administration entière**, pas seulement sur
un écran ou deux.

Sachant précisément ce qu'il fait déjà — et en particulier que le pointeur agit
maintenant sur 86 % des repères — **qu'est-ce qui manque pour qu'il forme
réellement quelqu'un ?**

Pas de généralités d'onboarding. Des mécaniques précises, applicables dans les
contraintes du §9, et qui tiennent compte du fait que la partie éditoriale (les
textes, les tâches) est le vrai goulot : c'est ce qui ne s'automatise pas.
