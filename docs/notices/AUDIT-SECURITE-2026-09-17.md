# Audit de sécurité du site et de son administration

17 septembre 2026.

---

## Ce que cet audit a lu, et ce qu'il n'a pas pu lire

J'ai lu le dépôt : les 2,7 Mo de `admin-matchs.html`, les 874 Ko de
`index.html`, `joueuse.html`, le Studio, le Greffe, les six fonctions
serveur, les 82 fichiers SQL, la configuration Vercel et l'historique
git complet.

**Je n'ai pas lu la base.** C'est la limite de ce rapport et il faut la
dire tout de suite, parce qu'elle change la façon de le lire. Le dépôt
n'est pas la base : plusieurs politiques ont été posées à la main dans
l'éditeur SQL et ne figurent nulle part ici. La migration de ce matin en
a découvert huit, sur `players` et `staff`, qu'aucune recherche dans les
fichiers n'aurait montrées. Une lecture depuis le site ne prouve rien
non plus : une réponse vide peut vouloir dire « table protégée » comme
« table vide ».

Seul `pg_policies` fait foi. J'ai donc écrit onze requêtes qui posent
les onze questions auxquelles je n'ai pas pu répondre :

> `sql/diagnostics/DIAGNOSTIC-SECURITE-2026-09-17.sql`

Elles ne modifient rien. Chaque bloc porte le résultat attendu au-dessus.
**C'est le premier geste à faire**, avant tout correctif : il dira si la
liste ci-dessous est complète ou s'il y a autre chose.

---

## 1. Ce qui est déjà sécurisé

Il faut le dire avant le reste, parce que c'est l'essentiel du travail et
que la liste des trous qui suit donnerait sinon une idée fausse.

**La porte de l'administration tient.** `admin-matchs.html` ne se
contente pas d'un mot de passe correct : après `signInWithPassword`, elle
demande `is_admin()` à la base et déconnecte le compte si la réponse est
non. C'était nécessaire depuis que `index.html` permet à n'importe qui de
créer un compte, et c'est fait. Trois détails de plus, et ils comptent :
la session de l'admin a sa propre clé de stockage (`bbc-admin-auth`), donc
un compte client ouvert dans un autre onglet ne l'écrase pas ; deux
heures sans activité referment la porte ; et le contrôle `is_admin()` est
refait au retour sur la page, avant même d'afficher quoi que ce soit.

**Aucun secret n'est dans le site, ni dans le dépôt, ni dans
l'historique git.** J'ai cherché les formes connues de clés Supabase,
Resend, Anthropic, Google, et les fichiers `.env` dans l'intégralité des
commits. Rien. Les clés vivent dans les secrets de fonction Supabase ; la
seule clé présente dans les pages est la clé publiable, qui est publique
par nature. Les traces de l'outil Supabase (`supabase/.temp/`, dont l'une
porte un jeton) sont bien exclues de git.

**Les en-têtes de sécurité sont complets.** `vercel.json` pose une
politique de contenu stricte avec `default-src 'self'`, `object-src
'none'`, `base-uri 'self'`, plus `nosniff`, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy` et `X-Permitted-Cross-Domain-Policies`.
L'admin, le Studio, le Greffe, le cadrage et le tutoriel sont en
`noindex, nofollow`, et l'admin en `no-store`.

**Les attaques par injection de script sont traitées.** J'ai passé les
452 endroits où le code écrit du HTML (107 dans `index.html`, 345 dans
l'admin) au crible de deux recherches : l'une cherchait un champ venant
d'une saisie publique sans fonction d'échappement, l'autre toute
propriété d'objet interpolée sans échappement. La première a rendu onze
résultats, tous faux : c'est une variable de style CSS qui s'appelle
`note`. La seconde a rendu dix-huit résultats, tous structurels
(`.map()`, `.length`, `.sort()`). Les fonctions `esc()`, `escHtml()` et
`bbTkEsc()` sont utilisées partout où ça compte. **Aucun chemin où une
saisie publique arriverait non échappée dans une page n'a été trouvé**,
et c'était le risque principal : une candidate qui met du code dans son
nom, et le code s'exécute quand vous ouvrez l'écran, avec votre session.

**L'injection SQL n'est pas un sujet ici**, et ce n'est pas de la chance.
Le site ne construit jamais de SQL : il parle à PostgREST, qui compose
des requêtes paramétrées, et aux fonctions `bbc_*`, dont les arguments
sont typés. Les fonctions qui font du SQL dynamique (`bbc_policies_module`,
`bbc_vider_policies`) utilisent `format()` avec `%I` et `%L`, qui
échappent, et ne prennent pas d'argument venant d'un visiteur.

**Les attaques par requête forgée (CSRF) ne s'appliquent pas.** La
session Supabase voyage dans un en-tête `Authorization`, pas dans un
cookie. Un site tiers ne peut pas le poser à votre place.

**Les documents des mineurs sont dans un espace privé.** Le bucket
`dossiers-prives` est en `public = false`, avec une limite de 8 Mo et une
liste de types. Le navigateur n'a aucun jeton dessus : la famille envoie
le fichier à la fonction serveur `depot-piece`, qui vérifie le couple
référence + téléphone, écrit avec la clé de service, puis appelle
`bbc_piece_deposer`, qui **refait la même vérification** au lieu de
croire la fonction sur parole. L'administration lit par une URL signée de
dix minutes, pas par une adresse publique. C'est la bonne architecture,
et c'est rare de la voir faite.

**Les jetons personnels sont solides.** `reprise_jeton` vaut
`encode(gen_random_bytes(24), 'hex')` : 192 bits, tirés d'un générateur
cryptographique. Il n'y a rien à deviner là.

**Les formulaires publics n'écrivent pas directement.** `bbc_inscription()`
décide seule de ce qui entre en base, et le commentaire le dit bien : « le
visiteur ne choisit ni son statut, ni son tarif, ni sa référence ».
`bbc_collecte_deposer()` n'accepte que les champs qu'un membre a le droit
de renseigner sur lui-même : ajouter `fiche_etat` ou `jersey_number` au
corps de la requête ne sert à rien.

**Les gestes du propriétaire sont vérifiés côté serveur.** Distribuer une
casquette, renommer un compte, retirer un accès, supprimer un rôle,
changer les autorisations : les six fonctions commencent toutes par
`if not bbc_est_proprietaire() then raise exception`. Et `auth.users`
n'est jamais exposée à l'API : `bbc_compte_rattacher` la lit côté
serveur et ne rend que l'adresse et la casquette.

**Le journal existe et il est branché au bon endroit.** Les quatre
fonctions d'écriture de l'admin (`sbInsert`, `sbUpdate`, `sbDelete`,
`sbUpsert`) appellent toutes le journal, et `sbUpdate` relit la ligne
AVANT de la modifier pour pouvoir écrire la valeur d'avant. C'est la
bonne façon : brancher au centre plutôt qu'à 175 endroits.

**Et les deux migrations de ce matin ont fermé beaucoup.** Neuf tables
qui acceptaient une écriture de n'importe qui, et les fiches des membres
qui laissaient lire `licence_num`, `birth_date`, `phone` et surtout
`reprise_jeton` à un visiteur anonyme. C'était le plus gros trou du site
et il est bouché.

---

## 2. Les failles trouvées

### URGENT 1. Le journal d'activité est lisible par tout internet

C'est la faille la plus grave, elle est exploitable aujourd'hui, et elle
ne demande aucune compétence.

L'historique se lit par `verify_audit_password(mot de passe)`. Cette
fonction est accordée à `anon` :

```sql
grant execute on function verify_audit_password(text) to anon, authenticated;
```

Elle s'appelle donc avec la seule clé publiable du site, sans compte. Elle
ne repose que sur le secret du mot de passe. Or ce mot de passe est écrit
en clair dans `sql/diagnostics/AUDIT-HISTORIQUE.sql` :

```sql
values (1, crypt('thefirstandtheonlyone', gen_salt('bf')))
```

Et le dépôt `github.com/MDGDESIGN221/baobabs-basket-club` est **public**.
Je l'ai vérifié : `"visibility": "PUBLIC"`.

Donc : n'importe qui lit le fichier sur GitHub, prend la clé publiable
dans `index.html`, et lit l'historique entier du club. Chaque champ
modifié depuis le 24 juillet, avec sa valeur avant et sa valeur après.
Un journal contient des noms d'enfants, des numéros de téléphone, des
montants, des notes internes.

### URGENT 2. Le journal est falsifiable, et par n'importe qui

Même fonction jumelle, même grant :

```sql
grant execute on function log_audit_entry(...) to anon, authenticated;
```

Et l'auteur de la ligne est le **premier paramètre** :
`p_user_email text`. La base ne regarde pas qui appelle, elle recopie ce
qu'on lui donne.

Un inconnu peut donc écrire dans l'historique du club « telle adresse a
supprimé la fiche de telle joueuse, le 17 septembre à 15 h 30 ». Il peut
aussi le remplir de dix mille lignes.

Vous demandez, au point 6 de votre liste, un journal qui dise quel
administrateur a fait quoi. Il existe, mais dans son état actuel il ne
prouve rien : un journal qu'un tiers peut écrire n'est pas une preuve,
c'est une suggestion.

### URGENT 3. L'e-mail de commande peut être dicté de l'extérieur

`send-order-confirmation` est appelée par un webhook, donc sans session.
Elle se protège par un secret d'en-tête, ce qui est la bonne méthode.
Mais elle avait deux défauts.

Le premier : quand le secret n'est pas configuré, elle **accepte tout**.

```ts
} else {
  console.warn("WEBHOOK_SECRET non configuré — la fonction accepte toute requête.");
}
```

Personne ne lit les journaux d'une fonction qui marche. Une serrure qui
s'ouvre quand elle est absente n'est pas une serrure.

Le second, plus profond : le contenu de l'e-mail venait **entièrement du
corps de la requête**.

```ts
const order = payload.record ?? payload;
```

Le nom, l'adresse destinataire, les articles, le total : tout était
dicté par l'appelant. Qui a le secret pouvait donc faire partir
n'importe quel texte vers n'importe quelle adresse, sous la signature du
club, depuis son domaine vérifié chez Resend. C'est-à-dire un outil
d'hameçonnage prêt à l'emploi.

Ce qui rend ce défaut évitable : `alerte-inscription`, écrite plus tard,
relit déjà la base pour cette raison exacte, et l'explique en
commentaire. La leçon était apprise, elle n'avait pas été appliquée en
arrière.

### URGENT 4. Les casquettes rangent l'écran, elles ne ferment pas la base

`MIGRATION-phase0-socle.sql` l'écrit noir sur blanc : « les rôles sont
posés et interrogeables, mais les politiques RLS n'ont PAS été
réécrites ». Et le code de l'admin le répète : « ceci range l'admin selon
le métier de chacun, ça n'enferme pas encore ».

C'est toujours vrai, y compris sur les tables refermées ce matin. La
migration `fermer-les-ecritures` a posé partout :

```sql
create policy <table>_admin_ecrit on public.<table>
  for all to authenticated using (is_admin()) with check (is_admin())
```

`is_admin()` veut dire « figure dans `admin_users` ». Pas « a le droit ».
Donc, le jour où un coach a son compte : il ne voit pas l'entrée Boutique
dans le menu, mais une requête à la main sur `products` passe. Il peut
modifier les prix, supprimer des actualités, effacer la galerie.

C'est exactement votre point 1, dernière ligne : « toutes les
vérifications de droits doivent être faites côté serveur, pas uniquement
dans l'interface ». Aujourd'hui, elles sont dans l'interface.

Le cas le plus sensible : le bucket `dossiers-prives`. Ses trois
politiques demandent `is_admin()`. Un community manager peut donc
télécharger les actes de naissance et les certificats médicaux de tous
les enfants de l'école de basket.

### IMPORTANT 5. Le contenu des fichiers envoyés n'est jamais vérifié

Vous le demandez explicitement : « vérifier réellement le contenu des
fichiers et pas seulement l'extension ». Aucun des trois chemins
d'envoi ne le faisait.

La liste de types d'un bucket Supabase (`allowed_mime_types`) vérifie
l'en-tête `Content-Type` **annoncé par l'appelant**, pas les octets. Et
les trois chemins recopient le type déclaré par le navigateur :

- `joueuse.html` teste `/^image\//` sur `f.type`, une valeur que le
  navigateur donne et qu'un appel direct choisit ;
- `uploadFile()` dans l'admin envoie `f.type || 'application/octet-stream'`
  tel quel, et `compresserImage()` **laisse passer SVG et GIF sans les
  toucher** (c'est écrit, et c'est un choix raisonné pour le poids) ;
- `depot-piece` acceptait `mime` du corps de la requête et le reposait
  sur le fichier.

Conséquence : un fichier quelconque, étiqueté `image/png`, entre dans les
buckets. Comme Supabase le ressert avec le type annoncé, un navigateur ne
l'exécutera pas comme du HTML, donc **ce n'est pas une exécution de code
à distance**. Mais c'est un hébergement de fichier arbitraire sur un
domaine du club, et un SVG ouvert directement exécute ses scripts sur le
domaine `supabase.co`.

### IMPORTANT 6. Le bucket des photos de candidature est ouvert en écriture, sans limite de nombre

```sql
create policy "recruitment_photos_public_upload"
  on storage.objects for insert to anon
  with check (bucket_id = 'recruitment-photos');
```

Le fichier le dit lui-même : « cette policy autorise techniquement
n'importe qui à envoyer un fichier vers ce bucket ». C'est assumé, et le
choix se défend : le formulaire de candidature n'a pas de compte.

Ce qui ne se défend pas, c'est qu'il n'y ait **aucun plafond de nombre**.
Cinq mégaoctets par fichier, mais autant de fichiers qu'on veut, avec un
chemin neuf à chaque fois (`Date.now()`). Un script remplit le quota de
stockage du projet en quelques minutes, et la facture avec.

### IMPORTANT 7. L'aide à la rédaction était ouverte à tout compte

`aide-redaction` appelle l'API Anthropic, qui est facturée, et se
protégeait par `auth: "required"`. Cela vérifie qu'il y a **une** session
valide, pas qu'elle appartient au club. Or n'importe quel visiteur se
crée un compte en dix secondes depuis `index.html` pour la boutique : il
était `authenticated` comme le président.

### IMPORTANT 8. Pas de second facteur, et pas de frein sur les tentatives de connexion

Il n'y a aucun MFA/2FA sur les comptes d'administration, et aucun frein
applicatif sur les tentatives répétées. Supabase Auth en pose un par
défaut côté plateforme, mais il est réglable et n'a jamais été vérifié
ici : je ne peux pas le lire depuis le dépôt.

Pour un club dont l'administration donne accès aux dossiers de mineurs,
deux comptes protégés par un simple mot de passe, c'est le point faible
qui reste quand tout le reste est fermé.

### IMPORTANT 9. L'alerte d'inscription peut être déclenchée par n'importe qui

`alerte-inscription` est en `verify_jwt = false`, sans secret d'en-tête,
sans frein. Elle accepte `{ registration_id }` en appel direct « pour
pouvoir tester depuis le tableau de bord ».

Elle relit bien la base (donc on ne peut pas lui faire dire n'importe
quoi, c'est bien vu), mais qui connaît un identifiant d'inscription peut
la déclencher en boucle : la boîte du club se remplit, et le quota
Resend s'épuise, ce qui coupe aussi les e-mails de commande et la
newsletter.

### IMPORTANT 10. Une commande peut être créée avec le prix qu'on veut

```sql
create policy orders_public_insert on orders for insert
  with check (customer_id is null or customer_id = auth.uid())
```

La politique vérifie à qui la commande est rattachée. Elle ne vérifie ni
le total, ni les articles, ni les prix. Un visiteur peut insérer une
commande avec `total: 0`, ou dix mille commandes fictives.

Le règlement se faisant sur place, en FCFA, **ce n'est pas un vol
d'argent**. C'est un écran de commandes noyé, un stock faussé et des
statistiques de recettes fausses.

### IMPORTANT 11. Deux bibliothèques chargées depuis un CDN, sans empreinte

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js">
```

La première n'est pas figée sur une version (`@2` prend la dernière 2.x)
et aucune des deux ne porte d'attribut `integrity`. La politique de
contenu autorise ces domaines et `'unsafe-inline'`.

Donc : si jsdelivr est compromis, ou si une version 2.x publiée un jour
contient du code hostile, ce code s'exécute **dans la page de
l'administration**, là où vit la session qui ouvre tout. C'est votre
point 8, « les failles connues des librairies », et c'est le seul risque
de chaîne d'approvisionnement du site.

### IMPORTANT 12. Les sauvegardes ne sont documentées nulle part

Rien dans le dépôt ne parle de sauvegarde de la base ni des fichiers.
Supabase sauvegarde quotidiennement selon le forfait, et la restauration
à un instant donné (PITR) est une option payante. Deux choses à savoir,
et la seconde est celle qu'on oublie :

1. une sauvegarde qu'on n'a jamais restaurée n'est pas une sauvegarde
   prouvée ;
2. **les sauvegardes de base de données ne couvrent pas le stockage.**
   Les photos de `site-media` et les documents de `dossiers-prives` n'en
   font pas partie. Une suppression accidentelle de bucket est
   définitive.

### IMPORTANT 13. Deux plafonds de taille qui se contredisent

`joueuse.html` accepte jusqu'à 25 Mo (`MAX_OCTETS`) et envoie la photo
telle quelle, sans redimensionner : c'est une décision écrite et
raisonnée, le club veut l'original. Mais le bucket
`recruitment-photos` refuse au-delà de 5 Mo.

Une photo de téléphone entre 5 et 25 Mo passe donc le contrôle, part, et
échoue à l'arrivée sur un `throw new Error('photo')`. Ce n'est pas une
faille, c'est une panne, mais elle touche exactement les gens qu'on veut
servir : ceux qui ont un téléphone récent.

### AMÉLIORATION 14. Les codes promo se devinent

`bbc_valider_promo` est accordée à `anon` et distingue ses refus :
« Code inconnu », « Ce code n'est plus actif », « Ce code a expiré ». La
différence entre le premier et les autres dit si le code existe. Sans
frein, on énumère les codes du club.

### AMÉLIORATION 15. Aucune protection anti-robot sur les formulaires publics

Pas de captcha, ni Turnstile, ni hCaptcha, nulle part. Les quatre
formulaires publics (contact, newsletter, candidature, inscription)
peuvent être remplis par un script.

### AMÉLIORATION 16. Trois petites fuites, et une entrée morte

- `confirmation-reservation` rendait `{ sent: true, to: <adresse du
  client> }` à un appelant sans compte : qui connaît un identifiant de
  réservation lisait l'adresse e-mail de l'acheteur.
- `bbc_proprietaire_email()` est accordée à `anon` : votre adresse se lit
  par l'API. Elle est de toute façon en clair dans le dépôt public.
- La politique de contenu autorise `https://api.web3forms.com` en
  `connect-src` et en `form-action`. Ce service n'est utilisé nulle part :
  c'est une porte ouverte sur rien.
- `refonte-admin.html` est servi publiquement. C'est une maquette sans
  Supabase, donc sans risque direct, mais elle montre la structure de
  l'administration.

### Hors sécurité, mais relevé au passage

`confirmation-reservation` n'est déployée sous aucun slug : `index.html`
le dit en commentaire, mesuré, 404. Les réservations s'enregistrent,
l'e-mail de confirmation ne part pas.

---

## 3. Les corrections, et lesquelles sont déjà écrites

### Déjà fait dans ce commit

| Faille | Correction |
|---|---|
| URGENT 1 et 2 | `sql/correctifs/CORRECTIF-2026-09-17-journal-et-roles.sql`, bloc 1 |
| URGENT 4 | même fichier, bloc 2 |
| URGENT 3 | `send-order-confirmation` : refus si le secret manque, et la commande est relue en base au lieu d'être crue |
| IMPORTANT 5 (fonction serveur) | `depot-piece` : les octets doivent dire le même format que l'annonce |
| IMPORTANT 6 (plafond) | `depot-piece` : douze pièces par dossier au maximum |
| IMPORTANT 7 | `aide-redaction` : `is_admin()` exigé, pas seulement une session |
| AMÉLIORATION 16 | `confirmation-reservation` ne rend plus l'adresse ; l'entrée web3forms est retirée de la politique de contenu |

### À faire, dans cet ordre

**1. Lancer le diagnostic.** `DIAGNOSTIC-SECURITE-2026-09-17.sql` dans
l'éditeur SQL. Lire les blocs A, B, F et I en premier : ce sont les seuls
qui peuvent contenir une urgence que je n'ai pas vue. Le bloc D dira,
table par table, ce qui est gardé par un rôle et ce qui n'est gardé que
par « est-ce un compte d'administration ».

**2. Passer le correctif SQL.** `CORRECTIF-2026-09-17-journal-et-roles.sql`.
Il est idempotent et ne supprime aucune donnée. Les six vérifications
sont à la fin du fichier. La sixième est la seule qui prouve quelque
chose : créer un compte d'essai, le passer en Coach, se connecter avec,
et essayer de modifier un produit. La base doit refuser.

**3. Changer le mot de passe de l'historique.** Le bloc 1.4 du correctif
porte la ligne, commentée. Le mot de passe actuel est publié sur GitHub
depuis le 24 juillet : les deux serrures du correctif suffisent à fermer
la porte, mais un secret publié reste un secret perdu. Ne pas écrire le
nouveau dans un fichier du dépôt.

**4. Vérifier que `WEBHOOK_SECRET` existe AVANT de redéployer
`send-order-confirmation`.** C'est important dans cet ordre : la fonction
refuse maintenant tout appel quand le secret manque. Si le secret n'est
pas là, les e-mails de commande s'arrêtent net. Supabase, Edge Functions,
Secrets. Le webhook de la table `orders` doit porter l'en-tête
`x-webhook-secret` avec la même valeur.

**5. Redéployer les trois fonctions modifiées.**

```bash
npx supabase functions deploy send-order-confirmation --project-ref lmwbwasupqkvswukieav
```

```bash
npx supabase functions deploy aide-redaction --project-ref lmwbwasupqkvswukieav
```

```bash
npx supabase functions deploy depot-piece --project-ref lmwbwasupqkvswukieav
```

Jamais par « Deploy a new function » du tableau de bord : le slug y est
tiré au sort et l'admin ne les trouverait plus. Après le déploiement de
`depot-piece`, envoyer une vraie photo depuis un vrai téléphone : le
contrôle des octets est le genre de chose qu'aucune relecture ne valide.

**6. Allumer le second facteur sur les comptes d'administration.**
Supabase, Authentication, Multi-Factor Authentication. Puis dans
`admin-matchs.html`, au moment de la connexion, traiter la réponse
`mfa_required`. C'est le seul point de cette liste qui demande de
toucher à l'écran de connexion, donc à faire posément, avec un compte
d'essai d'abord.

**7. Vérifier les freins de Supabase Auth.** Authentication, Rate Limits.
Le réglage par défaut est généreux. Pour deux comptes qui se connectent
quelques fois par jour, on peut descendre très bas sans gêner personne.

**8. Faire passer les photos de candidature par une fonction serveur.**
C'est ce que le fichier de la migration proposait lui-même comme suite :
« passer par une Edge Function qui valide et relaie l'upload, plutôt
qu'un accès direct ». `depot-piece` est maintenant le modèle à recopier :
elle vérifie les octets, plafonne le nombre, et le navigateur n'a aucun
jeton sur le stockage. Cela ferme la faille 6 et la partie publique de
la 5, et permet au passage d'aligner le plafond de `joueuse.html` sur
celui du bucket (faille 13).

**9. Figer les deux bibliothèques et poser leur empreinte.** Remplacer
`@supabase/supabase-js@2` par une version exacte, et ajouter
`integrity="sha384-..."` avec `crossorigin="anonymous"` sur les deux
balises. Les empreintes se lisent sur jsdelivr et cdnjs. À tester
immédiatement après : si l'empreinte est fausse, le script ne charge pas
du tout, et l'administration ne s'ouvre plus. Donc à faire un jour sans
match.

**10. Vérifier les sauvegardes, et en faire une soi-même.** Supabase,
Database, Backups : voir la fréquence et la rétention du forfait actuel,
et décider si PITR vaut son prix. Puis, une fois, restaurer une
sauvegarde sur un projet d'essai : c'est le seul moyen de savoir qu'elle
marche. Et pour le stockage, qui n'est jamais couvert, une copie locale
des deux buckets à intervalle régulier.

**11. Rendre les refus de code promo identiques.** Un seul message,
« Ce code n'est pas utilisable », pour les cinq cas de refus. On perd un
peu de confort et on gagne de ne plus pouvoir énumérer les codes.

**12. Poser un secret sur `alerte-inscription`.** Le même schéma que
`send-order-confirmation` : un secret de fonction, et l'en-tête
correspondant dans la définition du webhook. **Attention à l'ordre** :
poser le secret dans le tableau de bord ET l'en-tête dans le webhook
AVANT de déployer la version qui l'exige, sinon le club cesse d'être
prévenu des nouvelles inscriptions sans que rien ne le signale.

**13. Un captcha sur les quatre formulaires publics.** Turnstile de
Cloudflare est gratuit et invisible dans la plupart des cas. À faire en
dernier : c'est le point qui touche le plus de monde pour le risque le
plus faible.

---

## 4. Les priorités, en une page

### Urgent, aujourd'hui

1. Lancer le diagnostic SQL.
2. Passer le correctif SQL (journal fermé, casquettes devenues serrures).
3. Changer le mot de passe de l'historique.
4. Vérifier `WEBHOOK_SECRET`, puis redéployer les trois fonctions.

Ces quatre gestes ferment les quatre failles urgentes. Le premier et le
quatrième prennent dix minutes chacun ; le deuxième demande de passer les
six vérifications du fichier, donc une demi-heure sérieuse.

### Important, dans les semaines qui viennent

5. Second facteur sur les comptes d'administration.
6. Freins de connexion vérifiés dans Supabase.
7. Photos de candidature par une fonction serveur.
8. Bibliothèques figées avec leur empreinte.
9. Sauvegardes vérifiées, et le stockage sauvegardé à part.
10. Secret sur `alerte-inscription`.
11. Les commandes : au minimum une alerte quand un total ne correspond
    pas aux articles.

### Amélioration, quand il y a du temps

12. Refus de code promo uniformes.
13. Captcha sur les formulaires publics.
14. Retirer `refonte-admin.html` du site.

---

## 5. Ce qui restera vrai après tout ça

Votre objectif est bien posé : « même si quelqu'un découvre le
fonctionnement du site ou les endpoints, il ne puisse rien faire sans les
bonnes autorisations ». Après les quatre gestes urgents, ce sera le cas
pour les écritures et pour les dossiers.

Trois choses resteront, et il vaut mieux les savoir que les découvrir.

**Une inscription se dépose sans compte, et c'est voulu.** Les quatre
formulaires publics acceptent une écriture anonyme. C'est le principe de
la boîte aux lettres : tout le monde peut y glisser une lettre, seul le
club l'ouvre. On peut ajouter un captcha, on ne peut pas fermer la boîte.

**Qui connaît la référence ET le téléphone d'une famille peut déposer une
pièce à sa place.** C'est écrit dans `depot-piece`, assumé, et c'est le
bon compromis : le risque est qu'un inconnu AJOUTE un document, pas qu'il
en LISE un. La référence fait cinq caractères sur un alphabet de 32 et le
téléphone six chiffres : trente-quatre mille milliards de combinaisons.
Ce n'est pas devinable.

**Et surtout : un correctif passé n'est pas un correctif prouvé.** C'est
la leçon des deux migrations de ce matin, qui ont trouvé onze politiques
dont huit ne figuraient nulle part. Un `select` qui rend `[]` ne prouve
rien. Seul `pg_policies`, et un vrai compte avec une vraie casquette qui
essaie vraiment d'ouvrir une porte, prouvent quelque chose.

La sixième vérification du correctif est celle-là. C'est la seule qui
compte.
