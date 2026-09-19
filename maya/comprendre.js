/* =====================================================================
   MAYA : comprendre ce qu'on lui dit
   ---------------------------------------------------------------------
   Aucune API, aucun modele de langage, aucun appel sortant. Et ce n'est
   pas un pis-aller : c'est ce qui garantit qu'elle N'INVENTE JAMAIS.
   Un moteur a regles ne peut pas halluciner. Dans un club qui gere des
   dossiers de mineures et des actes signes par le president, une
   assistante qui repond « je ne comprends pas » vaut mieux qu'une qui
   comprend tout et se trompe une fois sur vingt.

   POURQUOI CELA PEUT MARCHER ICI : LE VOCABULAIRE EST FINI, ET IL EST
   DEJA EN BASE. Les clubs adverses, les salles, les categories, les
   postes sont des listes. Les joueuses sont dix-sept. Reconnaitre « ASC
   Ville » ou « Marieme » dans une phrase, ce n'est pas deviner, c'est
   CHERCHER DANS UNE LISTE CONNUE -- et cela s'ameliore tout seul quand
   la liste grandit.

   CE QU'ELLE NE FERA PAS : comprendre une tournure jamais prevue. La
   bonne reponse dans ce cas n'est pas d'essayer, c'est de le dire et de
   montrer ce qu'elle sait faire, dans les mots de la personne.

   CE FICHIER NE TOUCHE NI AU DOM NI AU RESEAU. Il prend une phrase et un
   contexte, il rend une intention. C'est ce qui le rend mesurable : le
   banc lui donne soixante phrases et compte.
   ===================================================================== */
(function () {
  'use strict';

  var M = window.BaobabsMaya;
  if (!M) { console.error('[MAYA] comprendre.js charge avant le noyau'); return; }

  /* ==================================================================
     LE TEXTE, MIS A PLAT
     ------------------------------------------------------------------
     Accents, casse, ponctuation : personne ne tape « Où en est-il ? »
     deux fois de la meme facon. La liste des mots vides est celle que la
     recherche globale de l'administration utilise deja depuis des mois ;
     la reprendre, c'est une regle de moins a maintenir a deux endroits.
     ================================================================== */
  var VIDES = ['un','une','le','la','les','des','de','du','au','aux','a','l','d',
               'mon','ma','mes','ce','cet','cette','ces','je','veux','peux','pour',
               'sur','dans','et','ou','est','que','faire','par','avec','sans','plus',
               'tout','toute','toutes','tous','en','y','me','se','ne','pas','son','sa',
               'ses','leur','notre','nos','vos','moi','tu','il','elle','on','nous','vous',
               'stp','svp','maya','please','merci','bien','vraiment','donc','alors'];

  function sansAccent(s) {
    s = String(s == null ? '' : s).toLowerCase();
    return s.normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s;
  }
  function plat(s) {
    return sansAccent(s).replace(/['’]/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function mots(s) {
    return plat(s).split(' ').filter(function (w) { return w && VIDES.indexOf(w) < 0; });
  }


  /* ==================================================================
     LES INTENTIONS
     ------------------------------------------------------------------
     Une intention = ce que la personne veut, pas les mots qu'elle
     emploie. Chaque entree porte des motifs testes sur le texte MIS A
     PLAT, donc « Ou en est-on ? » et « ou en est on » sont la meme
     chose.

     L'ORDRE COMPTE. La premiere qui repond gagne, et les plus precises
     sont donc en haut. « qu'est-ce qui manque a Marieme » doit tomber
     sur « ce qui manque », pas sur « trouver quelqu'un » au pretexte
     qu'un prenom y figure.

     « ecrit » dit si l'intention modifie quelque chose. Celles qui
     ecrivent demandent confirmation, toujours, sans exception possible.
     ================================================================== */
  /* ==================================================================
     LES SUJETS : DE QUOI ON PARLE
     ------------------------------------------------------------------
     Repere independamment de l'intention, et c'est ce qui change tout.
     « combien » tout seul ne veut rien dire ; « combien de joueuses »
     est une question a laquelle elle peut repondre, parce que la donnee
     est la. Et « combien font douze fois sept » ne parle d'aucun sujet
     du club : elle doit le dire, pas inventer.

     C'est aussi ce qui rend le refus utile. Quand elle ne comprend pas
     l'intention mais reconnait le sujet, elle ne propose plus des
     exemples au hasard : elle propose ce qu'elle sait dire SUR CE
     SUJET-LA. Une question mal formulee sur l'effectif ramene donc
     quand meme a l'effectif.
     ================================================================== */
  var SUJETS = [
    { cle: 'effectif',    nom: 'l’effectif',
      motif: /\b(effectif|joueuses?|licenciees?|equipe|groupe|filles)\b/ },
    { cle: 'staff',       nom: 'le staff',
      motif: /\b(staffs?|coachs?|entraineurs?|encadrement|dirigeants?|bureau|president)\b/ },
    { cle: 'matchs',      nom: 'les matchs',
      motif: /\b(matchs?|rencontres?|calendrier|adversaires?|championnat)\b/ },
    { cle: 'convocations',nom: 'les convocations',
      motif: /\b(convoc\w*|reponses?|presente|absente)\b/ },
    { cle: 'ecole',       nom: 'l’école de basket',
      motif: /\b(ecole|academie|inscriptions?|inscrits?|enfants?|eleves?)\b/ },
    { cle: 'boutique',    nom: 'la boutique',
      motif: /\b(boutique|commandes?|produits?|stocks?|articles a vendre)\b/ },
    /* La billetterie, et tout ce qui touche a l'entree d'un match :
       « c'est payant ? », « il reste des places ? », « c'est combien
       l'entree ? » sont la meme question posee trois fois, et aucune
       n'etait comprise. */
    { cle: 'billetterie', nom: 'la billetterie',
      motif: /\b(billets?|billetterie|places?|reservations?|guichet|entrees?|payante?s?|payer l entree|gratuite?s?|tarifs?|prix)\b/ },
    { cle: 'caisse',      nom: 'la caisse',
      motif: /\b(caisse|argent|budget|recettes?|depenses?|tresorerie|cotisations?)\b/ },
    { cle: 'comptes',     nom: 'les comptes',
      motif: /\b(comptes?|acces|casquettes?|roles?|utilisateurs?)\b/ },
    { cle: 'candidatures',nom: 'les candidatures',
      motif: /\b(candidatures?|candidates?|recrutement|essais?)\b/ }
  ];

  /* ELLE APPREND LES SUJETS QU ELLE NE CONNAIT PAS.
     La liste ci-dessus est ecrite a la main parce que ces dix sujets ont
     un vocabulaire riche : on dit « les filles » pour l effectif, « les
     billets » pour la billetterie. Mais l administration compte une
     CINQUANTAINE d ecrans, et il s en ajoute. Les declarer un par un
     ici, c est se condamner a oublier le prochain.

     L hote passe donc ses ecrans dans ctx.sujets : chaque titre devient
     un sujet, avec son ecran et sa table. Un ecran cree demain est donc
     compris des le jour de sa creation, sans une ligne de plus ici.

     LES SUJETS ECRITS A LA MAIN PASSENT EN PREMIER : leur vocabulaire
     est plus large que leur titre, et « les joueuses » doit tomber sur
     l effectif plutot que sur un ecran qui porterait ce mot. */
  /* ON COMPTE LES POINTS, ON NE PREND PLUS LE PREMIER QUI REPOND.
     La premiere version rendait le premier sujet dont un motif matchait,
     dans l'ordre de la liste. « les convocations du match de samedi »
     tombait donc sur les convocations parce qu'elles sont ecrites plus
     haut, et non parce qu'elles pesaient plus lourd dans la phrase.

     Chaque sujet marque un point par mot reconnu. Le plus lourd gagne,
     et l'ordre de la liste ne sert plus qu'a departager les ex aequo --
     ce qui est exactement le role qu'on veut lui laisser.

     Le mot COMPLET vaut deux points, le prefixe un seul : « convocation »
     pese plus pour les convocations que « convoc » glisse dans un autre
     mot. Sans cela, un prefixe court l'emportait sur un mot entier. */
  var SUJET_MOTS = null;
  function motsDesSujets() {
    if (SUJET_MOTS) return SUJET_MOTS;
    SUJET_MOTS = SUJETS.map(function (S) { return motsDuMotif(S.motif); });
    return SUJET_MOTS;
  }

  function sujet(texte, extra) {
    var t = plat(texte);
    var jetons = t.split(' ');
    var listes = motsDesSujets();
    var meilleur = null, points = 0;

    for (var i = 0; i < SUJETS.length; i++) {
      var n = 0;
      listes[i].forEach(function (mot) {
        jetons.forEach(function (j) {
          if (j === mot) n += 2;
          else if (j.length > 3 && (j.indexOf(mot) === 0 || mot.indexOf(j) === 0)) n += 1;
        });
      });
      if (n > points) { points = n; meilleur = SUJETS[i]; }
    }
    if (meilleur) return meilleur;

    // Aucun sujet riche : on retombe sur les ecrans, et la c'est le titre
    // le plus long qui gagne (« Le match » bat « Matchs » sur « le match »).
    var ecran = null, gagnant = '';   // le mot qui a gagne, pas l'objet
    (extra || []).forEach(function (S) {
      /* UN ECRAN REPOND AUSSI AU NOM DE CE QU'IL CONTIENT. « Combien
         d'abonnes » ne trouvait rien : l'ecran s'appelle Newsletter, et
         personne ne dit « combien de newsletter ». L'administration
         fournit ces mots-la avec l'ecran -- ce sont ceux avec lesquels
         elle repondra, donc ceux avec lesquels on doit pouvoir demander. */
      var noms = [S.nom].concat(S.mots || []);
      for (var k = 0; k < noms.length; k++) {
        var nom = plat(noms[k]);
        if (nom.length < 4) continue;   // « Club », « Home » : trop court pour trancher
        if (t.indexOf(nom) < 0) continue;
        if (!ecran || nom.length > gagnant.length) { ecran = S; gagnant = nom; }
      }
    });
    return ecran;
  }

  /* ==================================================================
     PARLER, ET PAS SEULEMENT REPONDRE
     ------------------------------------------------------------------
     « Bonsoir Maya » recevait « Bonjour MDG. » a neuf heures du soir.
     « Tu vas bien ? » recevait « Je ne comprends pas cette demande. »
     Et deux bonjours de suite recevaient exactement la meme phrase.

     TROIS DEFAUTS, ET LE MEME FOND : je listais des FORMULES au lieu de
     reconnaitre des INTENTIONS SOCIALES. Il y a cinquante facons de
     demander a quelqu'un comment il va ; il n'y en a qu'une de le
     vouloir.

     Ce bloc traite donc neuf familles, chacune large, et il les traite
     AVANT tout le reste : une phrase sociale n'est pas une requete de
     base de donnees, et la traiter comme telle est precisement ce qui
     fait qu'une assistante ne semble pas ecouter.
     ================================================================== */
  var SOCIAL = [
    { cle: 'salut',
      motif: /\b(bonjour|bonsoir|bonne nuit|salut|coucou|hello|hey|yo|bjr|slt|cc|wesh|bien ou bien|nanga def)\b/ },

    { cle: 'forme',
      motif: /\b(ca va|ca roule|tu vas bien|vous allez bien|comment vas tu|comment allez vous|comment tu vas|comment ca va|la forme|la peche|tout va bien|quoi de beau)\b/ },

    { cle: 'merci',
      motif: /\b(merci|merci beaucoup|thanks|nickel|parfait|super|genial|excellent|bravo|top|impeccable|c est bien|bien joue)\b/ },

    { cle: 'adieu',
      motif: /\b(au revoir|a bientot|a plus|a demain|a tout a l heure|bonne journee|bonne soiree|bonne nuit|bye|ciao|salut a toi)\b/ },

    { cle: 'accord',
      motif: /^(ok|okay|d accord|daccord|entendu|compris|tres bien|ca marche|ca me va|parfait)\b/ },

    { cle: 'refus',
      motif: /^(non|nan|annule|laisse tomber|laisse|stop|attends|attend|arrete|oublie|rien|pas maintenant|plus tard)\b/ },

    { cle: 'relance',
      motif: /^(continue|ensuite|et apres|apres|vas y|allez|la suite|encore|et puis|poursuis)\b/ },

    { cle: 'reproche',
      motif: /\b(tu comprends rien|tu ne comprends rien|tu es bete|t es bete|tu sers a rien|nul|nulle|ca marche pas|ca ne marche pas|inutile|decevant)\b/ },

    { cle: 'excuse',
      motif: /\b(pardon|desole|desolee|excuse moi|excusez moi|au temps pour moi)\b/ }
  ];

  /* UNE PHRASE SOCIALE EST COURTE, ET C'EST CE QUI LA DISTINGUE.
     « bonjour » est une salutation ; « bonjour, combien de joueuses
     actives avons-nous » est une question qui commence poliment. On ne
     prend donc la voie sociale que si la phrase ne contient rien
     d'autre, ou presque : au-dela de cinq mots pleins, on laisse la
     main aux intentions, qui sauront quoi en faire.

     Deux exceptions, parce qu'elles n'ont jamais de suite utile :
     le reproche et l'excuse, qu'on reconnait a n'importe quelle
     longueur. */
  function social(texte) {
    var t = plat(texte);
    if (!t) return null;
    for (var i = 0; i < SOCIAL.length; i++) {
      var m = t.match(SOCIAL[i].motif);
      if (!m) continue;
      /* Cinq familles se reconnaissent a n'importe quelle longueur.
         Le reproche et l'excuse parce qu'ils n'ont jamais de suite
         utile ; le refus, l'accord et la relance parce que leurs motifs
         sont ancres en debut de phrase et que ce qui suit les precise
         au lieu de les contredire : « non laisse tomber » reste un
         refus, meme avec deux mots derriere. */
      var large = ['reproche', 'excuse', 'refus', 'accord', 'relance']
                    .indexOf(SOCIAL[i].cle) >= 0;
      if (large) return SOCIAL[i].cle;
      /* LA POLITESSE EST UN PREFIXE, PAS LE MESSAGE.
         « bonjour » est une salutation ; « bonjour, combien de joueuses
         actives » est une question qui commence poliment, et y repondre
         « Bonjour. » serait exactement le genre de reponse qui donne
         l'impression de ne pas ecouter.
         On retire donc le marqueur trouve et on regarde ce qui reste :
         s'il reste de la matiere, c'est elle qu'il faut traiter. */
      var reste = mots(t.replace(m[0], ' '));
      if (reste.length <= 1) return SOCIAL[i].cle;
    }
    return null;
  }

  /* ==================================================================
     LES CRITERES : « QUI N'A PAS ENCORE DE LICENCE »
     ------------------------------------------------------------------
     Teste en production : « qui est blessee » cherchait un NOM et
     repondait « je ne trouve personne de ce nom ». « les joueuses sans
     photo » ouvrait l'ecran. « qui n'a pas de licence » n'etait pas
     comprise du tout.

     Trois questions sur quatre que pose un vrai utilisateur sont des
     FILTRES, et c'est ce qui manquait. Les ecrire un par un comme des
     intentions aurait redonne la course sans fin : « sans photo », puis
     « sans numero », puis « sans bio »... On declare donc des CRITERES
     combinables, et la question devient une requete.

     UN CRITERE NE DIT PAS COMMENT CHERCHER, il dit QUOI chercher. La
     traduction en requete vit dans l'administration, avec les tables ;
     ici on ne fait que reconnaitre le francais.
     ================================================================== */
  var CRITERES = [
    { cle: 'sans_photo',   motif: /\b(sans photo|pas de photo|photo manquante|aucune photo|pas encore de photo)\b/ },
    { cle: 'sans_compte',  motif: /\b(sans compte|pas de compte|pas d acces|sans acces|pas encore de compte)\b/ },
    { cle: 'sans_licence', motif: /\b(sans licence|pas de licence|pas licenciee|licence manquante|pas encore de licence)\b/ },
    { cle: 'sans_medical', motif: /\b(sans certificat|pas de certificat|certificat manquant|sans medical|pas de medical|sans visite)\b/ },
    { cle: 'sans_numero',  motif: /\b(sans numero|pas de numero|numero manquant)\b/ },
    { cle: 'blessee',      motif: /\bblessee?s?\b/ },
    { cle: 'active',       motif: /\bactives?\b/ },
    { cle: 'partie',       motif: /\b(partie?s? du club|qui ont quitte|anciennes)\b/ },
    { cle: 'en_pret',      motif: /\ben pret\b/ },
    { cle: 'dossier_attente', motif: /\b(a verifier|a completer|dossier incomplet|dossiers? en attente|pas encore validee?s?)\b/ },
    { cle: 'sans_reponse', motif: /\b(n a pas repondu|sans reponse|pas repondu|n ont pas repondu|qui manquent a l appel)\b/ },
    { cle: 'sans_bio',     motif: /\b(sans bio|pas de bio|sans presentation)\b/ }
  ];

  function criteres(texte) {
    var t = plat(texte), out = [];
    CRITERES.forEach(function (C) { if (C.motif.test(t)) out.push(C.cle); });
    return out;
  }

  var INTENTIONS = [
    /* ON DIT BONJOUR. Repondre « je ne comprends pas cette demande » a
       quelqu'un qui vous salue est froid et bete, et c'est la premiere
       chose que fait n'importe qui en ouvrant une fenetre de dialogue.
       Ce n'est pas de la decoration : la premiere phrase decide si l'on
       en tape une deuxieme. */
    /* Gardee pour l'exemple affiche dans l'aide : la reconnaissance,
       elle, passe desormais par social() plus haut, qui couvre neuf
       familles au lieu de quatre formules. */
    /* SANS MOTIF, ET C'EST VOLONTAIRE. La reconnaissance passe desormais
       par social(), plus haut, qui couvre neuf familles au lieu de
       quatre formules. Laisser les anciens motifs ici les faisait
       gagner sur la vraie demande : « bonjour, combien de joueuses »
       repondait « Bonjour. » et s'arretait la. L'entree reste pour son
       exemple, que l'aide affiche. */
    { cle: 'politesse', ecrit: false, motifs: [], exemple: 'bonjour' },

    { cle: 'aide', ecrit: false,
      motifs: [/\b(aide|help)\b/, /que (sais|peux) tu (faire)?/, /comment (ca|tu) march/,
               /qu est ce que tu sais/, /tes? (commandes|possibilites)/,
               // Elle doit pouvoir dire ce qu'elle connait ET ce qu'elle
               // ne sait pas. Une assistante qui n'annonce que ses
               // reussites oblige a decouvrir ses limites en se cognant.
               /que connais tu/, /qu est ce que tu (connais|comprends)/,
               /tu (sais|peux) quoi/, /tes limites/, /ce que tu ne (sais|peux)/,
               /qui es tu/, /tu sers a quoi/],
      exemple: 'que sais-tu faire' },

    /* « ici » AVANT « manque » : un marqueur d'ecran l'emporte toujours.
       « il manque quoi sur cet ecran » parle de l'ecran, pas d'un
       dossier. Dans l'autre ordre, elle repondait a cote avec aplomb --
       ce qui est pire que de ne pas comprendre. */
    { cle: 'ici', ecrit: false,
      motifs: [/\bici\b/, /\bcet ecran\b/, /\bcette (page|fiche)\b/, /\bsur cette page\b/,
               /\bj en suis ou\b/, /\bou j en suis\b/],
      exemple: 'qu’est-ce qui me concerne ici' },

    { cle: 'manque', ecrit: false,
      motifs: [/\bmanque/, /\bincomplet/, /\bqu il (manque|reste)/, /\bce qui reste\b/,
               /\bdossier (de|d)\b.*\b(complet|incomplet)/, /\breste a (faire|completer)/],
      exemple: 'qu’est-ce qui manque au dossier de Marieme' },

    { cle: 'point', ecrit: false,
      motifs: [/\bpoint\b/, /\bou en (est|sommes|sont)\b/, /\bbilan\b/, /\bresume\b/,
               /\bquoi de neuf\b/, /\bqu est ce qui (m )?attend\b/, /\bqu est ce qui presse\b/,
               /\bmon attention\b/, /\ba traiter\b/, /\burgent/, /\baujourd hui\b/,
               /\bce qui (compte|reclame)\b/, /\bsituation\b/, /\betat du club\b/,
               // Trois tournures que le premier jet ne comprenait pas, et
               // que n'importe qui emploie. Ce sont des racines, pas les
               // phrases du banc recopiees : « priorite », « je dois
               // traiter », « ce qui est prevu ».
               /\bpriorit/, /\bdois (traiter|faire|regarder|voir)\b/, /\bde prevu\b/],
      exemple: 'fais-moi le point' },

    { cle: 'convoquer', ecrit: true,
      motifs: [/\bconvoq/, /\bconvocation/, /\bappeler? les joueuses\b/],
      exemple: 'prepare la convocation du prochain match' },

    /* LES QUATRE QUESTIONS QU'ON POSE A QUELQU'UN QUI CONNAIT LA MAISON.
       Elles exigent toutes un sujet : sans lui, « combien » ou « qui
       sont » ne parlent pas du club, et repondre serait inventer. C'est
       ce garde qui fait que « combien font douze fois sept » reste sans
       reponse, sans qu'on ait eu a prevoir le calcul mental. */
    { cle: 'resultat', ecrit: false, exigeSujet: false,
      motifs: [/\bresultat/, /\bscore\b/, /\bon a (gagne|perdu)\b/,
               /\bdernier match\b/, /\bderniere rencontre\b/],
      exemple: 'quel est le dernier résultat' },

    { cle: 'quand', ecrit: false, exigeSujet: false,
      motifs: [/\bquand\b/, /\bprochain\w* (match|rencontre)\b/, /\bmatch \w* ?a venir\b/,
               /\bon joue\b/, /\bcontre qui\b/, /\ba quelle heure\b/,
               /\bquel match\b/, /\bmatchs? a venir\b/, /\bprochainement\b/],
      exemple: 'c’est quand le prochain match' },

    { cle: 'combien', ecrit: false, exigeSujet: true,
      motifs: [/\bcombien\b/, /\bnombre\b/, /\bcombien de\b/, /\beffectif du club\b/,
               /\bon est combien\b/, /\bquel est l effectif\b/],
      exemple: 'combien de joueuses' },

    { cle: 'liste', ecrit: false, exigeSujet: true,
      motifs: [/\bliste\b/, /\bqui sont\b/, /\bquelles sont\b/, /\bdonne moi les\b/,
               /\benumere\b/, /\blesquelles\b/],
      exemple: 'qui sont les joueuses' },

    { cle: 'qui', ecrit: false,
      motifs: [/\bqui est\b/, /\btrouve /, /\bcherche /, /\bfiche de\b/, /\bprofil de\b/,
               /\bmontre moi (la |le )?(joueuse|coach|profil|fiche)\b/, /\bretrouve /],
      exemple: 'trouve-moi Marieme' },

    { cle: 'aller', ecrit: false,
      motifs: [/\b(ouvre|ouvrir|va|aller|montre|affiche|emmene)\b/, /\becran\b/],
      exemple: 'ouvre la billetterie' }
  ];


  /* ==================================================================
     LES FAUTES DE FRAPPE
     ------------------------------------------------------------------
     « qui est le resident du club » : une lettre de trop, et elle
     cherchait un nom propre introuvable. Personne ne devrait avoir a
     relire ce qu'il tape pour parler a une assistante.

     ON CORRIGE LA PHRASE AVANT DE L'ANALYSER, pas apres. Un seul
     passage, et tout en profite : les intentions, les sujets, les noms,
     les ecrans. Corriger a quatre endroits aurait donne quatre regles a
     tenir, et trois oubliees au premier ajout.

     TROIS GARDE-FOUS, parce qu'une correction fausse est pire qu'une
     faute laissee telle quelle :

       1. ON NE TOUCHE QU'AUX MOTS INCONNUS. Un mot deja dans le lexique
          est juste, meme s'il ressemble a un autre. « match » ne devient
          jamais « marche ».

       2. UNE SEULE CORRESPONDANCE, SINON RIEN. Si deux mots du lexique
          sont a la meme distance, on ne choisit pas : on laisse le mot
          tel quel et l'analyse fera ce qu'elle peut. Deviner entre deux
          candidats, c'est repondre a cote avec assurance.

       3. ELLE LE DIT. Les corrections remontent dans le resultat, et la
          reponse les annonce. Corriger en douce, c'est laisser quelqu'un
          croire qu'elle a compris autre chose que ce qu'il a ecrit.

     LE LEXIQUE SE CONSTRUIT TOUT SEUL, a partir de ce que MAYA connait
     deja : les mots de ses sujets, les titres des ecrans, les noms des
     personnes, les verbes de ses intentions. Un ecran ajoute demain
     apporte son vocabulaire le jour meme, sans une ligne de plus ici.
     ================================================================== */

  /* Distance d'edition, avec abandon des que le seuil est depasse : sur
     un lexique de quelques centaines de mots, comparer jusqu'au bout
     coute cent fois plus cher que de s'arreter a la deuxieme faute. */
  function distance(a, b, max) {
    if (a === b) return 0;
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    var precedente = new Array(lb + 1), courante = new Array(lb + 1), i, j;
    for (j = 0; j <= lb; j++) precedente[j] = j;
    for (i = 1; i <= la; i++) {
      courante[0] = i;
      var mini = courante[0];
      for (j = 1; j <= lb; j++) {
        var cout = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        courante[j] = Math.min(courante[j - 1] + 1, precedente[j] + 1, precedente[j - 1] + cout);
        if (courante[j] < mini) mini = courante[j];
      }
      if (mini > max) return max + 1;
      var t = precedente; precedente = courante; courante = t;
    }
    return precedente[lb];
  }

  /* Le seuil suit la longueur du mot TAPE. Une faute sur cinq lettres,
     deux au-dela de six : « samdi » doit trouver « samedi », et
     « jouese » doit trouver « joueuses », qui est a deux. En dessous de
     quatre lettres on ne corrige pas du tout -- « le », « du », « cinq »
     sont a une lettre de trop de choses. */
  function seuilDe(mot) {
    // CINQ LETTRES AU MINIMUM, et la mesure l'a impose : a quatre, « suis »
    // devenait « sais » et la phrase changeait de sens sans que rien ne le
    // signale. Les mots courts du francais sont trop proches les uns des
    // autres pour qu'on y touche.
    if (mot.length < 5) return 0;
    if (mot.length < 6) return 1;
    return 2;
  }

  /* LES MOTS D'UN MOTIF. Les sujets et les intentions portent leur
     vocabulaire dans des expressions regulieres ; on l'en extrait plutot
     que de le recopier a cote, ou les deux listes divergeraient des la
     premiere retouche. On coupe a la premiere echappee : « convoc\w* »
     donne « convoc », ce qui est exactement le prefixe utile. */
  function motsDuMotif(re) {
    var out = [];
    // ON RETIRE D'ABORD LES ECHAPPEES. La premiere version ne lisait que
    // les groupes a alternatives, et coupait au premier antislash : un
    // motif simple comme « \burgent » n'entrait donc pas au lexique, et
    // « urgent » s'est fait corriger en « argent ». En neutralisant \b,
    // \w, \d et \s d'abord, toute suite de lettres devient un mot, qu'elle
    // vienne d'un groupe ou non.
    String(re.source)
      .replace(/\\[a-zA-Z]/g, ' ')
      .replace(/[a-z][a-z0-9]{3,}/g, function (m) { out.push(m); return ''; });
    return out;
  }

  /* Les jours et les reperes de temps : ils ne sont dans aucun motif a
     alternatives, et « samdi » est la faute la plus courante de toutes. */
  /* Les pronoms qui designent quelqu'un.

     « IL » N'Y EST PAS, et c'est le banc qui l'a impose : « l'entree de
     ce match est-IL payant ? » partait sur la fiche d'une joueuse. En
     francais « il » est le plus souvent impersonnel -- il faut, il y a,
     est-il -- et le gain sur « il joue a quel poste » ne valait pas ce
     detournement.

     « Leur » y est : on dit « leur dossier » d'un groupe qu'on vient de
     lister. */
  var PRONOM_PERS = /\b(elle|lui|son|sa|ses|leur|leurs)\b/;
  var MOTS_TEMPS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche',
                    'demain','hier','aujourd','prochain','prochaine','semaine','matin','soir'];

  /* DES MOTS FRANCAIS COURANTS QU'ON NE CORRIGE JAMAIS.
     Ils ne sont dans aucun motif et ne designent rien du club, donc rien
     ne les protegeait : « quelque » se faisait corriger en « quelle », ce
     qui ne changeait rien au sens mais salissait la correction affichee.
     Une liste courte suffit -- ce sont les mots qu'on emploie autour
     d'une question, pas la langue entiere. */
  var MOTS_SUR = ['quelque','quelques','chose','choses','encore','comme','aussi',
                  'autre','autres','toujours','jamais','peut','veut','doit','sait',
                  'etre','avoir','savoir','voici','voila','depuis','pendant','parce',
                  'pourquoi','comment','maintenant','vite','bientot','deja','trop',
                  'meme','ainsi','sinon','juste','seulement','surtout','plutot'];

  var LEX = { mots: null, empreinte: '' };

  function lexique(ctx) {
    ctx = ctx || {};
    // L'empreinte evite de tout reconstruire a chaque phrase, et de
    // garder un lexique perime quand l'effectif change.
    var emp = (ctx.personnes ? ctx.personnes.length : 0) + ':' +
              (ctx.ecrans ? ctx.ecrans.length : 0) + ':' +
              (ctx.sujets ? ctx.sujets.length : 0) + ':' +
              (ctx.vocabulaire ? ctx.vocabulaire.length : 0);
    if (LEX.mots && LEX.empreinte === emp) return LEX.mots;

    var vus = {};
    function pousse(m) {
      m = plat(m);
      m.split(' ').forEach(function (x) { if (x.length >= 4) vus[x] = 1; });
    }
    SUJETS.forEach(function (S) { motsDuMotif(S.motif).forEach(pousse); pousse(S.nom); });
    INTENTIONS.forEach(function (I) { I.motifs.forEach(function (re) { motsDuMotif(re).forEach(pousse); }); });
    /* ET LES MOTS DE LA CONVERSATION. Sans eux, « bonne journee »
       devenait « donne journee » et l'adieu n'etait plus reconnu : le
       meme piege que « urgent » corrige en « argent », a un autre
       endroit. Tout ce qui sert a reconnaitre doit etre au lexique. */
    SOCIAL.forEach(function (S) { motsDuMotif(S.motif).forEach(pousse); });
    /* ET LES MOTS DES CRITERES. « les joueuses sans numero » devenait
       « sans enumere » -- enumere vient du motif de « liste », numero ne
       venait de nulle part. Troisieme fois que le meme oubli produit la
       meme panne : tout ce qui sert a reconnaitre doit etre au lexique,
       sans exception. */
    CRITERES.forEach(function (C) { motsDuMotif(C.motif).forEach(pousse); });
    MOTS_TEMPS.forEach(pousse);
    (ctx.personnes || []).forEach(function (p) { pousse(p.nom); });
    (ctx.ecrans || []).forEach(function (e) { pousse(e.titre); });
    (ctx.sujets || []).forEach(function (s) { pousse(s.nom); });
    /* ET TOUT LE VOCABULAIRE DU CLUB : les adversaires, les salles, les
       postes, les categories, les tailles. Sans lui, le lexique restait
       le mien ; avec lui, c'est celui du club, et il grandit tout seul
       quand une salle ou un adversaire s'ajoute. */
    (ctx.vocabulaire || []).forEach(pousse);

    LEX.mots = Object.keys(vus);
    LEX.empreinte = emp;
    return LEX.mots;
  }

  function corriger(texte, ctx) {
    var mots_ = plat(texte).split(' ');
    var lex = lexique(ctx);
    var connus = {}; lex.forEach(function (m) { connus[m] = 1; });
    var corrections = [], sortie = [];

    mots_.forEach(function (mot) {
      // Mot connu, mot vide, mot courant, nombre : on n'y touche pas.
      if (!mot || connus[mot] || VIDES.indexOf(mot) >= 0 || MOTS_SUR.indexOf(mot) >= 0 ||
          /^\d+$/.test(mot) || mot.length < 5) {
        sortie.push(mot); return;
      }
      var seuil = seuilDe(mot);
      if (!seuil) { sortie.push(mot); return; }

      var meilleur = null, meilleure = seuil + 1, exaequo = false;
      for (var i = 0; i < lex.length; i++) {
        var d = distance(mot, lex[i], seuil);
        if (d > seuil) continue;
        if (d < meilleure) { meilleure = d; meilleur = lex[i]; exaequo = false; }
        else if (d === meilleure && lex[i] !== meilleur) exaequo = true;
      }
      /* UN MOT N'EST PAS LA FAUTE DE SON PROPRE DEBUT. Le lexique se
         construit a partir des motifs, et un motif comme « convoqu »
         y depose un MORCEAU de mot. « Convoque tout le monde » devenait
         alors « convoq tout le monde », et elle annoncait fierement
         « J'ai lu convoq » -- vu en production. Si le candidat est le
         debut exact de ce qui a ete tape, ce n'est pas une faute de
         frappe : c'est le mot entier, et le lexique qui est incomplet. */
      if (meilleur && mot.indexOf(meilleur) === 0) { sortie.push(mot); return; }
      // Deux candidats a egalite : on ne tranche pas.
      if (meilleur && !exaequo) { sortie.push(meilleur); corrections.push([mot, meilleur]); }
      else sortie.push(mot);
    });

    return { texte: sortie.join(' '), corrections: corrections };
  }

  /* ==================================================================
     LES ENTITES : ON CHERCHE, ON NE DEVINE PAS
     ------------------------------------------------------------------
     Le contexte porte les listes reelles : les personnes lues dans la
     vue personnes, les ecrans de l'administration. Trouver « Marieme »
     dans une phrase, c'est parcourir dix-sept noms et voir lequel y
     figure. Aucune heuristique, aucun « ca ressemble a un prenom ».

     UN NOM PARTIEL SUFFIT, mais s'il correspond a deux personnes on ne
     choisit pas : on rend les deux, et MAYA demandera laquelle. C'est la
     regle du cahier des charges, et c'est aussi la seule honnete.

     LES MOTS DE DEUX LETTRES NE COMPTENT PAS : « Ba » trouverait la
     moitie de l'effectif.
     ================================================================== */
  function personnes(texte, liste) {
    var t = plat(texte), out = [];
    (liste || []).forEach(function (p) {
      var nom = plat(p.nom);
      if (!nom) return;
      if (t.indexOf(nom) >= 0) { out.push({ p: p, poids: 3 }); return; }
      // un seul morceau du nom : prenom seul, ou nom de famille seul
      var bouts = nom.split(' ').filter(function (b) { return b.length > 2; });
      for (var i = 0; i < bouts.length; i++) {
        if (new RegExp('(^| )' + bouts[i] + '( |$)').test(t)) { out.push({ p: p, poids: 1 }); return; }
      }
    });
    out.sort(function (a, b) { return b.poids - a.poids; });
    // Un nom complet reconnu ecarte les correspondances partielles :
    // « Marieme Ndiaye » ne doit pas rendre aussi « Awa Ndiaye ».
    if (out.length && out[0].poids === 3) out = out.filter(function (x) { return x.poids === 3; });
    return out.map(function (x) { return x.p; });
  }

  function ecrans(texte, liste) {
    var t = plat(texte), out = [];
    (liste || []).forEach(function (e) {
      var titre = plat(e.titre);
      if (titre.length > 2 && t.indexOf(titre) >= 0) out.push({ e: e, poids: titre.length });
    });
    out.sort(function (a, b) { return b.poids - a.poids; });
    return out.map(function (x) { return x.e; });
  }

  /* LES DATES. Le francais parle peu et bien : « samedi », « demain »,
     « le 12 ». On ne couvre que ce qui sert reellement ici, et on rend
     une date ISO plutot qu'un objet a interpreter plus loin. */
  var JOURS = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  function iso(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function date(texte, maintenant) {
    var t = plat(texte);
    var base = maintenant ? new Date(maintenant) : new Date();
    base.setHours(0, 0, 0, 0);

    if (/\baujourd hui\b/.test(t)) return iso(base);
    if (/\bdemain\b/.test(t)) { base.setDate(base.getDate() + 1); return iso(base); }
    if (/\bapres demain\b/.test(t)) { base.setDate(base.getDate() + 2); return iso(base); }
    if (/\bhier\b/.test(t)) { base.setDate(base.getDate() - 1); return iso(base); }

    for (var j = 0; j < JOURS.length; j++) {
      if (new RegExp('\\b' + JOURS[j] + '\\b').test(t)) {
        var ecart = (j - base.getDay() + 7) % 7;
        // « samedi » un samedi veut dire le samedi suivant, sauf si l'on
        // a dit « ce samedi ».
        if (ecart === 0 && !/\bce \w+\b/.test(t)) ecart = 7;
        if (/\bprochain\b/.test(t) && ecart < 7) ecart += 7;
        base.setDate(base.getDate() + ecart);
        return iso(base);
      }
    }
    return null;
  }

  /* L'HEURE. « 17h », « 17h30 », « 17 h 30 », « a 17 heures ». */
  function heure(texte) {
    var t = plat(texte);
    var m = t.match(/\b(\d{1,2})\s*(?:h|heures?)\s*(\d{2})?\b/);
    if (!m) return null;
    var h = parseInt(m[1], 10);
    if (h > 23) return null;
    return ('0' + h).slice(-2) + ':' + (m[2] ? m[2] : '00');
  }


  /* ==================================================================
     ANALYSER
     ------------------------------------------------------------------
     Rend TOUJOURS un objet, jamais null : une phrase incomprise est un
     resultat, pas une panne. « intention: null » veut dire « je ne sais
     pas », et MAYA le dira dans ces mots-la.
     ================================================================== */
  function analyser(texte, ctx) {
    ctx = ctx || {};
    // LA CORRECTION PASSE AVANT TOUT. Ce qui suit travaille sur la phrase
    // corrigee ; « texte » garde ce qui a ete tape, pour pouvoir le
    // reafficher tel quel.
    var cor = corriger(texte, ctx);
    var t = cor.texte;
    var res = {
      texte: String(texte == null ? '' : texte),
      plat: t,
      corrections: cor.corrections,
      mots: mots(t),
      intention: null,
      ecrit: false,
      entites: {},
      exemples: []
    };
    if (!t) return res;

    /* DE QUOI ON PARLE, AVANT DE SAVOIR CE QU'ON VEUT. Le sujet sert
       deux fois : il autorise les questions qui l'exigent, et il rend
       utile le refus quand rien ne repond. */
    /* LE SOCIAL EN PREMIER. Une phrase qui salue, remercie, refuse ou
       relance n'est pas une requete : la faire passer par les intentions
       puis par les sujets, c'est ce qui donnait « je ne comprends pas »
       a « tu vas bien ? ». */
    var soc = social(t);
    if (soc) { res.intention = 'politesse'; res.social = soc; return res; }

    /* LES CRITERES AVANT TOUT LE RESTE. « qui est blessee » cherchait un
       nom ; « les joueuses sans photo » ouvrait un ecran. Un critere
       reconnu change la nature de la demande : ce n'est plus une
       recherche ni une navigation, c'est un filtre. */
    var crit = criteres(t);
    if (crit.length) {
      /* SAUF SI QUELQU'UN EST NOMME. « Ce qui reste a completer pour
         Aissatou » contient « a completer », mais ce n'est pas un filtre
         sur l'effectif : c'est une question sur elle, et sa fiche porte
         deja ce qui manque. Filtrer aurait rendu la liste de toutes
         celles dont le dossier attend, en ignorant le nom cite. */
      var qui = personnes(t, ctx.personnes);
      if (qui.length !== 1) {
        res.criteres = crit;
        res.intention = 'filtrer';
        res.sujet = sujet(t, ctx.sujets) || SUJETS[0];   // l'effectif par defaut
        res.entites = {};
        var d0 = date(t, ctx.maintenant); if (d0) res.entites.date = d0;
        return res;
      }
    }

    var suj = sujet(t, ctx.sujets);
    if (suj) res.sujet = suj;

    for (var i = 0; i < INTENTIONS.length; i++) {
      var I = INTENTIONS[i];
      // « combien » sans sujet du club ne parle pas du club : « combien
      // font douze fois sept » doit rester sans reponse, et ce garde
      // suffit -- on n'a pas eu besoin de prevoir le calcul mental.
      if (I.exigeSujet && !suj) continue;
      for (var j = 0; j < I.motifs.length; j++) {
        if (I.motifs[j].test(t)) { res.intention = I.cle; res.ecrit = I.ecrit; break; }
      }
      if (res.intention) break;
    }

    var pers = personnes(t, ctx.personnes);
    if (pers.length === 1) res.entites.personne = pers[0];
    else if (pers.length > 1) res.entites.personnes = pers;

    var ecr = ecrans(t, ctx.ecrans);
    if (ecr.length) res.entites.ecran = ecr[0];

    var d = date(t, ctx.maintenant); if (d) res.entites.date = d;
    var h = heure(t); if (h) res.entites.heure = h;

    /* UNE PHRASE QUI NE CONTIENT QU'UN NOM EST UNE RECHERCHE.
       « Marieme » tout seul n'a pas de verbe, aucun motif ne repond, et
       pourtant l'intention ne fait aucun doute. C'est le cas le plus
       frequent quand on cherche quelqu'un, et le plus penible a taper en
       entier. */
    if (!res.intention && res.entites.personne && res.mots.length <= 3) res.intention = 'qui';

    /* UN NOM DE FAMILLE SEUL AUSSI. « Ndiaye » ne designe pas une
       personne mais trois, et la phrase tombait sur « je ne comprends
       pas » : le cas le plus banal quand on cherche quelqu'un dans un
       club ou les fratries sont nombreuses. Plusieurs reponses possibles
       n'est pas une incomprehension -- c'est une question a poser. */
    if (!res.intention && res.entites.personnes && res.mots.length <= 3) res.intention = 'qui';

    /* ET « ELLE », « SON », « SA ». Apres avoir montre une fiche, on
       enchaine : « elle a quel numero », « et son poste », « ouvre sa
       fiche ». Trois phrases qui ne contiennent aucun nom et qui ne
       parlent que d'elle. On signale le pronom ; c'est le dialogue qui
       sait de QUI on vient de parler, pas la grammaire. */
    if (!res.entites.personne && !res.entites.personnes && PRONOM_PERS.test(t)) {
      res.pronomPersonne = true;
    }

    /* UN NOM D'ECRAN SEUL EST UNE NAVIGATION, meme regle. */
    if (!res.intention && res.entites.ecran && res.mots.length <= 3) res.intention = 'aller';

    /* UN SUJET SEUL EST UNE QUESTION SUR CE SUJET. « les joueuses », « la
       caisse » : pas de verbe, mais aucune ambiguite sur ce qu'on veut
       savoir. On repond par le denombrement, qui est la reponse la plus
       courte et la plus souvent juste. */
    if (!res.intention && suj && res.mots.length <= 2) res.intention = 'combien';

    /* ==================================================================
       LA REGLE QUI CHANGE TOUT : UN SUJET RECONNU VAUT UNE REPONSE.
       ------------------------------------------------------------------
       Le premier jet exigeait qu'une tournure soit prevue, et repondait
       « je ne comprends pas cette demande » a « quel match est a venir ».
       Ajouter un motif par question etait sans fin, et perdu d'avance :
       on ne devine pas comment les gens parlent.

       Donc : si l'on sait DE QUOI on parle, on repond sur ce sujet, meme
       sans avoir compris la tournure. « quel match est a venir », « les
       matchs ca donne quoi », « alors ces matchs » ramenent tous ce
       qu'elle sait des matchs. C'est ce que ferait quelqu'un qui connait
       la maison et qui n'a pas bien entendu la question.

       « Je ne comprends pas » ne sort plus que lorsque RIEN n'est
       reconnu, ni intention ni sujet. Et la, c'est vrai.
       ================================================================== */
    /* NOMMER QUELQU'UN, C'EST PARLER DE LUI. « elle joue a quel poste
       Kine ? » n'a pas de verbe reconnu et tombait sur le sujet
       « effectif », donc sur un comptage. Des lors qu'une personne est
       identifiee et qu'aucune intention plus precise n'a gagne, c'est sa
       fiche qu'on veut -- et la fiche porte le poste, le numero, les
       pieces, le compte : la reponse y est, quelle que soit la question. */
    if ((!res.intention || res.intention === 'sujet') && res.entites.personne) res.intention = 'qui';

    if (!res.intention && suj) res.intention = 'sujet';

    /* COMBIEN DE MOTS LUI SONT ETRANGERS. Une phrase dont tous les mots
       appartiennent au club peut etre une suite de conversation ; une
       phrase pleine de mots qu'elle n'a jamais vus est autre chose.
       « raconte-moi une blague » ne doit pas devenir « on parlait des
       convocations, c'est toujours ca ? » -- ce qu'elle faisait. */
    var lex = {}; lexique(ctx).forEach(function (m) { lex[m] = 1; });
    res.inconnus = res.mots.filter(function (m) { return !lex[m]; }).length;

    if (!res.intention) {
      res.exemples = INTENTIONS.filter(function (I) { return I.cle !== 'aide' && I.cle !== 'politesse'; })
                               .map(function (I) { return I.exemple; });
    }
    return res;
  }


  M.comprendre = {
    analyser: analyser,
    plat: plat,
    mots: mots,
    personnes: personnes,
    ecrans: ecrans,
    date: date,
    heure: heure,
    corriger: corriger,
    social: social,
    criteres: criteres,
    CRITERES: CRITERES,
    distance: distance,
    lexique: lexique,
    INTENTIONS: INTENTIONS
  };
})();
