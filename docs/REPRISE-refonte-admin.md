# Reprise — refonte de l'administration et du tutoriel

*État au 2 septembre 2026, fin de session. Écrit pour la session suivante.*
*Tout ce qui suit est mesuré dans le navigateur, pas estimé.*

---

## 0. L'échéance

**Une présentation est prévue vendredi 4 septembre.** C'est ce qui doit guider
l'ordre des travaux : ce qui casserait *pendant* la démonstration passe avant ce
qui la rendrait plus jolie.

---

## 1. Ce qui a été fait — 26 commits, `8c40418..5cb3a61`

### La refonte visuelle, écran par écran

L'administration tournait sur deux socles : `.ds-*` (moderne, posé fin août sur
Inscriptions, Candidatures, Matchs, Calendrier, Résultats, Tableau de bord) et
`.cd-*` / `.mod-*` / `.card` (l'ancien). **Tous les écrans qui restaient sur
l'ancien sont passés au premier.**

| Commit | Écran |
|---|---|
| `6ece807` | Messages |
| `f60ee15` | Commandes |
| `adb67db` | Le bandeau du haut |
| `576cf42` | Coque plein écran, icônes de la recherche, Classement |
| `e3c069f` | Adversaires |
| `b340496` | Billetterie |
| `2e535f4` | Clients |
| `8959442` | L'éditeur visuel (socle de 5 écrans) |
| `c5ebb15` | Produits, Stock, Codes promo |
| `35294cf` | Articles, Catégories |
| `b72651c` | Galerie, Médiathèque |
| `0c16c91` | Joueuses, Bureau, cartes de Staff et Notre histoire |
| `1bba8ef` | Soir de match, Direct, Analytics, Comptes, Cohérence, Historique |

Les trois règles appliquées, héritées du socle `.ds-` :

1. **Un seul accent.** L'or dit où porter la main. Un statut s'écrit, il ne se
   peint pas. Seul ce qui *coûte au club* garde une teinte — argent non
   encaissé, dossier laissé en attente, pièce manquante.
2. **Le trait plutôt que la boîte.** Rayons ramenés à 6 / 8 / 12, jamais 14 ni 16.
3. **Le chiffre est le sujet.** Libellé au-dessus, chiffre en Archivo tabulaire.

**Deux exceptions assumées**, à ne pas « corriger » :
- **Le Studio** reste vert. Il annonce qu'on change de logiciel.
- **Soir de match** garde son vert / rouge (`063fa85`). C'est une console de
  chronomètre : marche / arrêt y est la langue universelle. J'avais tout passé à
  l'or, l'auteur l'a repris — à raison.

### Le tutoriel, réaligné sur l'admin refaite

| Commit | Objet |
|---|---|
| `51a4605` | 9 cibles mortes (`.cd-row` n'a plus aucun producteur) |
| `edf671d` `e2289cd` `7f9b656` | Les conseils, en 3 lots |
| `2b4b696` | Le chapitre du bandeau, qui visitait la barre en zigzag |
| `55abe53` | La démonstration d'Adversaires, qui se jouait dans le vide |
| `9fa46f1` | 10 écrans avaient perdu le doigt qui montre |
| `5cb3a61` | 7 écrans à sous-menu, jamais ouverts |

---

## 2. Ce qui reste — par ordre de risque

### a) Les écritures — **aucune n'a été testée**

C'est le seul trou dont l'échec serait **visible pendant la présentation**.

Pas un « Enregistrer », pas un « Publier », pas un changement de statut. Toutes
les écritures ont été interceptées pendant les essais. On ne sait donc pas si
enregistrer une fiche joueuse ou encaisser une mensualité fonctionne encore.

**Le propriétaire a choisi la méthode** : créer un enregistrement jetable par
écran, vérifier qu'il s'écrit *et se relit*, puis le supprimer. Rien d'existant
n'est modifié.

```
Adversaires   créer « ZZ Test »   vérifier   supprimer
Codes promo   créer « ZZTEST »    vérifier   supprimer
Articles      brouillon jetable   vérifier   supprimer
Joueuses      fiche jetable       vérifier   supprimer
```

### b) L'animation du tutoriel

Demande de l'auteur, formulée deux fois : *« de la vraie animation, pas de la 3D,
genre comme zoomé… pour pas rendre le tuto ennuyeux »*.

**Lire d'abord `docs/briefs/BAOBABS-TUTORIEL-ANIMATIONS-brief.md`** (1ᵉʳ sept.) :
il pose exactement ce problème et le documente mieux que ce paragraphe.

État mesuré : le tutoriel a **17 keyframes** (pose, onde, fil, frappe, clic,
cartes…) et un projecteur qui cadre la cible en or en éteignant le reste. Ce qui
manque : **la cible ne grandit pas**. C'est l'effet de capture d'écran attendu.

Piste la moins risquée : agrandir le **cadre du projecteur** et la cible
(`transform: scale(1.03)`), pas la page. Mettre `#app` à l'échelle casserait
`position: sticky`, `position: fixed` et le pointage.

### c) Cinq écrans non observés

Les bascules de sous-vue de `standings`, `staff`, `timeline`, `news`, `partners`
sont **inférées, pas vues** — elles sont plus loin dans la visite que les 80
étapes parcourues. Même mécanisme, mêmes cibles vérifiées.

---

## 3. Les pièges — à lire avant de toucher au tutoriel

### Les deux tables sont positionnelles

`TUT_CIBLES[écran][i]` va avec `SECTION_HELP[écran][i]`. **Ajouter un conseil sans
ajouter une cible décale tout.** Le tutoriel s'en protège — il renonce alors aux
cibles de l'écran entier et le dit en `console.warn` — mais il *parle sans rien
montrer*, et personne ne lit la console. Ça s'est produit sur **10 écrans**.

Le contrôle, livré dans le dépôt, à relancer après toute retouche :

```
python outils/audit-tutoriel.py     # doit dire « 0 ecran decale »
```

Il compare les longueurs des deux tables en marchant caractère par caractère —
les cibles imbriquent des listes et les conseils contiennent des apostrophes
échappées, ce qui met en défaut toute expression régulière un peu courte. Il
signale aussi un fichier passé en LF. Code de sortie non nul s'il trouve un
décalage, pour le brancher sur un contrôle automatique si besoin.

### Un geste part 520 ms après l'affichage de l'étape

Si l'on pilote le tutoriel au script en avançant plus vite que ça, **on tue la
démonstration avant qu'elle ne commence** — et on conclut à tort qu'elle est
cassée. J'ai failli committer « ça ne marche pas » sur cette base.
**Rythme minimum pour observer un geste : 1 300 ms par étape.**

### « Comprendre cet écran » ne joue pas les démonstrations

`visiteEcran(cle, avecGestes)` filtre les gestes quand `avecGestes` est faux.
Pour voir une démonstration, il faut **la visite complète** (`#bt-tout`).

### Un identifiant sur `.cd-sec-b` est détruit

`accWire` vide ce conteneur pour ranger son contenu dans le repli qu'il
fabrique : l'`id` part avec. C'est ce qui faisait afficher « Chargement… » pour
toujours dans la fiche client. **Poser l'id sur un enfant**, jamais sur
`.cd-sec-b`.

### Écrire en CRLF, toujours

`admin-matchs.html` et `tutoriel/tutoriel.js` sont en CRLF de bout en bout. Un
script qui rend du LF produit un diff de 20 000 lignes pour 3 vraies. Contrôle
après chaque passage :

```python
s.count("\n") - s.count("\r\n")   # doit valoir 0
s.count("\r") - s.count("\r\n")   # doit valoir 0
```

### Le shell mange les échappements

Passer du JavaScript contenant `\'` à travers un heredoc `bash` a cassé un bloc
deux fois dans la session. **Écrire les scripts Python dans un fichier**, ne pas
les passer en heredoc quand ils contiennent des apostrophes échappées. Et
`node --check` sur les deux blocs `<script>` après *chaque* modification.

---

## 4. La méthode de vérification qui marche

Le site tourne en local : `python -m http.server` (voir `.claude/launch.json`,
ports 8899 et 8901). L'administration demande une vraie session Supabase.

**Sans session**, on peut détourner `fetch` pour rendre des lignes fabriquées et
refuser toute écriture — c'est ainsi qu'ont été vérifiés la plupart des écrans :

```js
const vrai = window.fetch;
window.fetch = function (url, opt) {
  const m = (opt && opt.method) || 'GET';
  if (m !== 'GET') return Promise.resolve(new Response('[]', {status: 200}));
  if (String(url).indexOf('/rest/v1/ma_table') >= 0)
    return Promise.resolve(new Response(JSON.stringify(faux), {status: 200}));
  return vrai.apply(this, arguments);
};
```

**Les trois audits** à relancer après toute retouche de l'admin ou du tutoriel :

1. **Cibles** — parcourir `TUT_CIBLES`, ouvrir chaque écran, vérifier que chaque
   sélecteur résout. Dernier relevé : **182 testées, 7 sans élément**, toutes
   conditionnelles (pas de match sans score, pas de client, pas de bannière…),
   chacune avec son repli.
2. **Démonstrations** — même chose sur `TUT_DEMOS`. Dernier relevé : **31
   gestes, 1 sans élément**, faux positif (la démo ouvre elle-même le dossier).
3. **Visite complète** — `#bt-tout`, puis avancer sur `#bt-suiv`. Dernier
   relevé : **326 étapes, 0 erreur, 0 avertissement**, fin propre.

---

## 5. Où vivent les choses

```
admin-matchs.html          toute l'administration : 1 <style>, 1 IIFE de ~14 000 lignes
                           SECTION_META  titre + description de chaque écran
                           SECTION_HELP  les 162 conseils des bulles « Comment ça marche ? »
                           TUT_CIBLES    ce que le tutoriel désigne, par écran
                           TUT_DEMOS     les démonstrations, par écran
                           TUT_JEUX      les lignes d'exemple (une seule table : recruitment_requests)
tutoriel/tutoriel.js       le moteur — ne contient AUCUN texte de tutoriel
tutoriel/tutoriel.css      991 lignes, 17 keyframes
tutoriel/banc*.html        dix bancs d'essai
docs/TUTORIEL-ce-que-ca-fait.md          le tutoriel dans son ensemble
docs/briefs/BAOBABS-TUTORIEL-ANIMATIONS-brief.md   le mouvement, et ce qui lui manque
```

**Le principe à ne jamais casser** : le tutoriel ne contient aucun texte et ne
connaît aucun écran en particulier. Il lit l'admin à l'exécution — le plan vient
du DOM de la barre latérale, les titres de `SECTION_META`, les explications de
`SECTION_HELP`. Corriger une bulle corrige le tutoriel. Ajouter un écran l'y fait
entrer sans toucher au moteur.

---

## 6. Une réserve laissée ouverte

**« Commandes » existe deux fois** : comme onglet dans Messages, et comme écran à
part entière juste en dessous dans le même groupe du menu. Les deux ont été
refaits ; la question de retirer l'onglet n'a pas été tranchée par l'auteur.
