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
    { cle: 'billetterie', nom: 'la billetterie',
      motif: /\b(billets?|billetterie|places?|reservations?|guichet)\b/ },
    { cle: 'caisse',      nom: 'la caisse',
      motif: /\b(caisse|argent|budget|recettes?|depenses?|tresorerie|cotisations?)\b/ },
    { cle: 'comptes',     nom: 'les comptes',
      motif: /\b(comptes?|acces|casquettes?|roles?|utilisateurs?)\b/ },
    { cle: 'candidatures',nom: 'les candidatures',
      motif: /\b(candidatures?|candidates?|recrutement|essais?)\b/ }
  ];

  function sujet(texte) {
    var t = plat(texte);
    for (var i = 0; i < SUJETS.length; i++) if (SUJETS[i].motif.test(t)) return SUJETS[i];
    return null;
  }

  var INTENTIONS = [
    /* ON DIT BONJOUR. Repondre « je ne comprends pas cette demande » a
       quelqu'un qui vous salue est froid et bete, et c'est la premiere
       chose que fait n'importe qui en ouvrant une fenetre de dialogue.
       Ce n'est pas de la decoration : la premiere phrase decide si l'on
       en tape une deuxieme. */
    { cle: 'politesse', ecrit: false,
      motifs: [/^(bonjour|bonsoir|salut|coucou|hello|hey|yo|bjr|slt)\b/,
               /^(ca va|comment vas tu|comment ca va)\b/,
               /^(merci|merci beaucoup|nickel|parfait|super|ok merci)\b/,
               /^(au revoir|a bientot|bonne journee|bonne soiree|bye)\b/],
      exemple: 'bonjour' },

    { cle: 'aide', ecrit: false,
      motifs: [/\b(aide|help)\b/, /que (sais|peux) tu (faire)?/, /comment (ca|tu) march/,
               /qu est ce que tu sais/, /tes? (commandes|possibilites)/],
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
    var t = plat(texte);
    var res = {
      texte: String(texte == null ? '' : texte),
      plat: t,
      mots: mots(texte),
      intention: null,
      ecrit: false,
      entites: {},
      exemples: []
    };
    if (!t) return res;

    /* DE QUOI ON PARLE, AVANT DE SAVOIR CE QU'ON VEUT. Le sujet sert
       deux fois : il autorise les questions qui l'exigent, et il rend
       utile le refus quand rien ne repond. */
    var suj = sujet(texte);
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

    var pers = personnes(texte, ctx.personnes);
    if (pers.length === 1) res.entites.personne = pers[0];
    else if (pers.length > 1) res.entites.personnes = pers;

    var ecr = ecrans(texte, ctx.ecrans);
    if (ecr.length) res.entites.ecran = ecr[0];

    var d = date(texte, ctx.maintenant); if (d) res.entites.date = d;
    var h = heure(texte); if (h) res.entites.heure = h;

    /* UNE PHRASE QUI NE CONTIENT QU'UN NOM EST UNE RECHERCHE.
       « Marieme » tout seul n'a pas de verbe, aucun motif ne repond, et
       pourtant l'intention ne fait aucun doute. C'est le cas le plus
       frequent quand on cherche quelqu'un, et le plus penible a taper en
       entier. */
    if (!res.intention && res.entites.personne && res.mots.length <= 3) res.intention = 'qui';

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
    if (!res.intention && suj) res.intention = 'sujet';

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
    INTENTIONS: INTENTIONS
  };
})();
