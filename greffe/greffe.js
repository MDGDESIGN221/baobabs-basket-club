/* =====================================================================
   LE GREFFE : noyau
   ---------------------------------------------------------------------
   Fabrique les actes officiels du club. Le PDF sort par l'impression de
   Chrome, le fichier source par un téléchargement. Depuis le 13 septembre
   2026, le REGISTRE (actes, dossiers, pré-réglages) est aussi en base, dans
   trois tables réservées au propriétaire : un cache vidé ou un autre
   ordinateur ne le perdent plus. Les polices et le cachet, eux, ne partent
   toujours pas (voir « LE MIROIR EN BASE »).

   QUATRE COUCHES, ET CHACUNE IGNORE LA SUIVANTE :
     greffe.js          le noyau  : écrans, formulaire, aperçu, registre
     blocs.js           les blocs : en-tête, articles, tableaux, signature
     modeles/*.js       les actes : une DÉCLARATION, jamais du HTML
     IndexedDB          le poste  : polices, cachet, actes enregistrés
     greffe_*           la base   : le registre, miroir du poste

   Ajouter un type d'acte = un fichier dans modeles/ et son nom dans
   MODELES. Ajouter une colonne à un tableau = un clic, et elle est
   enregistrée avec l'acte.

   TROIS RÈGLES QUI ONT COÛTÉ CHER AILLEURS, ET QUI TIENNENT ICI :

   1. AUCUN CADRATIN. Ni long ni court, nulle part : ni dans le code, ni dans un
      texte par défaut, ni dans un libellé. C'est la signature d'un
      texte écrit par une machine, et ces actes sont signés par le
      président. Le point médian « · » sépare, la virgule respire.

   2. LES RESSOURCES NE MONTENT PAS SUR LE SITE. Les dix polices et le
      cachet de la présidence restent dans ce navigateur. Servir le
      cachet depuis /media, c'est le donner à qui connaît l'URL, et avec
      lui le pouvoir de fabriquer un faux.

   3. UN SEUL GLOBAL : window.BaobabsGreffe. admin-matchs.html fait déjà
      26 000 lignes dans une IIFE où deux fonctions de même nom
      s'écrasent en silence. Le Greffe vit dehors.
   ===================================================================== */
(function () {
  'use strict';

  if (window.BaobabsGreffe) return;

  var MM = 96 / 25.4;                    /* 1 mm en pixels CSS */

  /* ===================================================================
     QUI PEUT QUOI
     -------------------------------------------------------------------
     Le Greffe n'était ouvert qu'au compte propriétaire. Il s'ouvre
     maintenant à trois casquettes, et CRÉER n'est pas SIGNER.

     C'est toute la difficulté : le Greffe appose la signature et le
     cachet du président. Si un coach pouvait émettre, n'importe quel
     compte coach engagerait le club sous la signature du président.
     Donc un coach COMPOSE, et l'acte attend. Le président l'ouvre, le
     lit, et c'est son geste à lui qui pose l'encre.

     D'où deux droits distincts :
       familles  ce qu'on peut créer  (null = tout)
       signer    le droit d'émettre, donc d'apposer la signature

     Et une conséquence voulue : le président SIGNE des familles qu'il ne
     crée pas. Il ne compose pas une convocation, mais c'est sa signature
     qui la valide -- refuser de la lui laisser émettre bloquerait le
     travail du coach pour rien.
     =================================================================== */
  var DROITS_TOUT = { familles: null, signer: true, nom: 'Administration' };
  var DROITS = {
    super_admin: DROITS_TOUT,
    president: {
      familles: ['Correspondance', 'Conventions et contrats', 'Gouvernance', 'Actes',
                 'Bureau du club', 'Structure', 'Communication'],
      signer: true, nom: 'Présidence'
    },
    coach: {
      familles: ['Vie sportive', 'Familles', 'Distinctions'],
      signer: false, nom: 'Coach'
    }
  };
  var droits = DROITS_TOUT;

  /* AJOUTER UN TYPE D'ACTE : un fichier dans modeles/, son nom ici. */
  var MODELES = ['ordre-mission', 'acte-libre', 'page-blanche', 'courrier',
                 'convention', 'contrat', 'fiche-fonction', 'budget',
                 'pv-reunion', 'ordre-du-jour', 'rapport-saison', 'recu', 'note-frais', 'demande-subvention', 'demande-appui',
                 'convocation', 'feuille-presence', 'planning', 'fiche-joueuse', 'cartes-membre',
                 'autorisation-parentale', 'decharge', 'certificat', 'communique', 'invitation',
                 'liste-delegation'];

  /* =================================================================
     1. LES PETITS OUTILS, PARTAGÉS AVEC LES BLOCS ET LES MODÈLES
     ================================================================= */
  var MOIS = ['janvier','février','mars','avril','mai','juin','juillet',
              'août','septembre','octobre','novembre','décembre'];
  var MOIS_C = ['janv.','févr.','mars','avr.','mai','juin','juil.',
                'août','sept.','oct.','nov.','déc.'];
  var JOURS = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  var UNITES = ['zéro','un','deux','trois','quatre','cinq','six','sept','huit','neuf','dix',
                'onze','douze','treize','quatorze','quinze','seize','dix-sept','dix-huit','dix-neuf'];
  var DIZAINES = ['','','vingt','trente','quarante','cinquante','soixante'];

  /* Un espace en fin de texte devient une espace insécable : HTML l'aurait
     avalé, et le mot suivant serait venu se coller au précédent quand la
     feuille se refait pendant la frappe. */
  function ech(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/ $/, '\u00a0');
  }

  /* "YYYY-MM-DD" -> Date locale. On construit à la main : passer la
     chaîne à new Date() la lit en UTC et décale d'un jour à Dakar. */
  function dateDe(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d.getTime()) ? null : d;
  }

  function isoDuJour() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function dateLongue(iso, avecJour) {
    var d = dateDe(iso);
    if (!d) return '';
    var s = d.getDate() + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear();
    return avecJour ? JOURS[d.getDay()] + ' ' + s : s;
  }

  /* "du 23 au 28 septembre 2026", et les cas où les bornes changent
     de mois ou d'année. */
  function duAu(a, b) {
    var x = dateDe(a), y = dateDe(b);
    if (!x && !y) return '';
    if (!y) return 'le ' + dateLongue(a, false);
    if (!x) return "jusqu'au " + dateLongue(b, false);
    if (x.getFullYear() !== y.getFullYear())
      return 'du ' + dateLongue(a, false) + ' au ' + dateLongue(b, false);
    if (x.getMonth() !== y.getMonth())
      return 'du ' + x.getDate() + ' ' + MOIS[x.getMonth()]
           + ' au ' + y.getDate() + ' ' + MOIS[y.getMonth()] + ' ' + y.getFullYear();
    return 'du ' + x.getDate() + ' au ' + y.getDate() + ' '
         + MOIS[x.getMonth()] + ' ' + x.getFullYear();
  }

  /* "23 → 28 sept. 2026" pour le bandeau de repères. La flèche n'est
     pas un tiret : elle est autorisée. */
  function duAuCourt(a, b) {
    var x = dateDe(a), y = dateDe(b);
    if (!x && !y) return '';
    if (!y) return x.getDate() + ' ' + MOIS_C[x.getMonth()] + ' ' + x.getFullYear();
    if (!x) return y.getDate() + ' ' + MOIS_C[y.getMonth()] + ' ' + y.getFullYear();
    if (x.getFullYear() !== y.getFullYear())
      return x.getDate() + ' ' + MOIS_C[x.getMonth()] + ' ' + x.getFullYear()
           + ' → ' + y.getDate() + ' ' + MOIS_C[y.getMonth()] + ' ' + y.getFullYear();
    if (x.getMonth() !== y.getMonth())
      return x.getDate() + ' ' + MOIS_C[x.getMonth()]
           + ' → ' + y.getDate() + ' ' + MOIS_C[y.getMonth()] + ' ' + y.getFullYear();
    return x.getDate() + ' → ' + y.getDate() + ' '
         + MOIS_C[x.getMonth()] + ' ' + x.getFullYear();
  }

  function lettres(n) {
    n = Math.max(0, Math.floor(n || 0));
    if (n < 20) return UNITES[n];
    if (n < 70) {
      var d = Math.floor(n / 10), u = n % 10;
      if (u === 0) return DIZAINES[d];
      if (u === 1) return DIZAINES[d] + ' et un';
      return DIZAINES[d] + '-' + UNITES[u];
    }
    if (n < 80) { var r = n - 60; return r === 11 ? 'soixante et onze' : 'soixante-' + UNITES[r]; }
    if (n === 80) return 'quatre-vingts';
    if (n < 100) return 'quatre-vingt-' + UNITES[n - 80];
    return String(n);
  }

  /* Un nombre à la française : espace fine entre les milliers, deux
     décimales seulement si elles existent. Sert aux totaux de tableau
     (un budget prévisionnel, par exemple). */
  function nombre(n) {
    if (n == null || isNaN(n)) return '';
    var neg = n < 0; n = Math.abs(n);
    var ent = Math.floor(n), dec = Math.round((n - ent) * 100);
    var s = String(ent).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    if (dec) s += ',' + (dec < 10 ? '0' + dec : dec);
    return (neg ? '-' : '') + s;
  }

  function deuxChiffres(n) { return (n < 10 ? '0' : '') + n; }

  function compter(membres) {
    var c = { total: 0, joueuses: 0, coachs: 0, chefs: 0, autres: 0 };
    (membres || []).forEach(function (m) {
      if (!m || !String(m.nom || '').trim()) return;
      c.total++;
      var q = String(m.qualite || '').toLowerCase();
      if (/joueu/.test(q)) c.joueuses++;
      else if (/coach|entra/.test(q)) c.coachs++;
      else if (/chef/.test(q)) c.chefs++;
      else c.autres++;
    });
    return c;
  }

  function enonce(c) {
    var p = [];
    if (c.joueuses) p.push(lettres(c.joueuses) + ' (' + c.joueuses + ') joueuse' + (c.joueuses > 1 ? 's' : ''));
    if (c.coachs)   p.push(lettres(c.coachs) + ' (' + c.coachs + ') coach' + (c.coachs > 1 ? 's' : ''));
    if (c.chefs)    p.push(lettres(c.chefs) + ' (' + c.chefs + ') chef de délégation');
    if (c.autres)   p.push(lettres(c.autres) + ' (' + c.autres + ') accompagnateur' + (c.autres > 1 ? 's' : ''));
    if (!p.length) return '';
    if (p.length === 1) return p[0];
    return p.slice(0, -1).join(', ') + ' et ' + p[p.length - 1];
  }

  function enonceCourt(c) {
    var p = [];
    if (c.joueuses) p.push(c.joueuses + ' joueuse' + (c.joueuses > 1 ? 's' : ''));
    if (c.coachs)   p.push(c.coachs + ' coach' + (c.coachs > 1 ? 's' : ''));
    if (c.chefs)    p.push(c.chefs + ' chef');
    if (c.autres)   p.push(c.autres + ' accompagnateur' + (c.autres > 1 ? 's' : ''));
    return p.join(', ');
  }

  /* "Antoine Jean Pierre Ndong" -> "A. Ndong" */
  function initialeNom(nom) {
    var p = sansMarques(nom || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '';
    if (p.length === 1) return p[0];
    return p[0].charAt(0).toUpperCase() + '. ' + p[p.length - 1];
  }

  /* =================================================================
     1 bis. L'IDENTITÉ DU CLUB ET LES VARIABLES
     Le nom, le président, l'adresse, le récépissé vivent en un seul
     endroit (Paramètres). Les modèles ont leurs textes par défaut ; si
     l'identité change, la feuille suit. Dans n'importe quel texte,
     {{club.nom}}, {{club.president}}, {{acte.numero}}, {{acte.date}},
     {{aujourdhui}}, {{total.<tableau>}} et {{col.<colonne>}} (série) se
     remplacent à l'affichage et restent des variables dans la donnée.
     ================================================================= */
  var CLUB_DEFAUT = {
    nom: 'Baobabs Basket Club', sigle: 'BBC', devise: 'Grandir ici. Régner partout.',
    president: 'Antoine Jean Pierre Ndong', qualitePresident: 'Président',
    adresse: 'Sicap Baobab, Dakar, Sénégal', ville: 'Dakar', recepisse: '8280',
    telephone: '', email: '', site: 'baobabsbasketclub.com', pays: 'République du Sénégal'
  };
  var CLUB_CHAMPS = [
    ['nom', 'Nom du club'], ['sigle', 'Sigle'], ['devise', 'Devise'],
    ['president', 'Président (nom complet)'], ['qualitePresident', 'Qualité du signataire'],
    ['adresse', 'Adresse'], ['ville', 'Ville (« Fait à »)'], ['recepisse', 'Récépissé n°'],
    ['telephone', 'Téléphone'], ['email', 'E-mail'], ['site', 'Site'], ['pays', 'Pays (en-tête)']
  ];
  var VAR_RE = /\{\{(club|acte|aujourdhui|total|col)(?:\.([A-Za-z0-9_.\-]+))?\}\}/g;
  var VARIABLES = [
    ['{{club.nom}}', 'Nom du club'], ['{{club.president}}', 'Président'], ['{{club.qualitePresident}}', 'Qualité du président'],
    ['{{club.adresse}}', 'Adresse du club'], ['{{club.ville}}', 'Ville'], ['{{club.recepisse}}', 'Récépissé'],
    ['{{club.telephone}}', 'Téléphone'], ['{{club.email}}', 'E-mail'], ['{{club.site}}', 'Site'],
    ['{{acte.numero}}', 'Numéro de l\'acte'], ['{{acte.date}}', 'Date de l\'acte (en toutes lettres)'],
    ['{{acte.titre}}', 'Intitulé de l\'acte'], ['{{acte.dossier}}', 'Dossier de l\'acte'], ['{{aujourdhui}}', 'Date du jour'],
    ['{{total.<tableau>}}', 'Total d\'un tableau'], ['{{col.<colonne>}}', 'Colonne d\'une série']
  ];
  function valeurVariable(racineV, chemin) {
    var C = G.club || CLUB_DEFAUT;
    if (racineV === 'club') return chemin ? (C[chemin] == null ? '' : C[chemin]) : C.nom;
    if (racineV === 'aujourdhui') return dateLongue(isoDuJour(), false);
    if (racineV === 'acte') {
      var d = donnees || {};
      if (chemin === 'numero') return d.numero || '';
      if (chemin === 'date') return dateLongue(d.dateActe, false) || '';
      if (chemin === 'titre') return d.titre || (modeleActif ? modeleActif.nom : '');
      if (chemin === 'lieu') return d.lieu || C.ville || '';
      if (chemin === 'version') return String(acteVersion || 1);
      if (chemin === 'dossier') { var dsr = dossierDe(acteDossier); return dsr ? dsr.nom : ''; }
      return '';
    }
    if (racineV === 'col') return (donnees && donnees.serie && chemin in donnees.serie) ? donnees.serie[chemin] : '';
    if (racineV === 'total') {
      var p = String(chemin || '').split('.'), source = p[0], cle = p[1];
      var t = donnees && donnees.tables && donnees.tables[source];
      if (!t) return '';
      var cols = (t.colonnes || []).filter(function (c) { return cle ? c.cle === cle : c.total; });
      if (!cols.length) return '';
      var somme = 0;
      G.lignes(donnees, source).forEach(function (l) {
        cols.forEach(function (c) { var n = G.blocs.valeurCellule ? G.blocs.valeurCellule(t, l, c) : parseFloat(String(l[c.cle] || '').replace(/[^\d.,-]/g, '').replace(',', '.')); if (!isNaN(n)) somme += n; });
      });
      return nombre(somme) + (t.unite ? ' ' + t.unite : '');
    }
    return '';
  }
  /* le texte est déjà échappé et décoré : les variables deviennent des
     pastilles non modifiables, qui se relisent telles quelles */
  function variables(html) {
    return html.replace(VAR_RE, function (m, r, ch) {
      var v = valeurVariable(r, ch);
      var nom = r + (ch ? '.' + ch : '');
      return '<span class="s-var' + (v === '' ? ' s-var-vide' : '') + '" data-var="' + ech(nom) + '" contenteditable="false" title="' + ech(nom) + '">' + (v === '' ? ech('{{' + nom + '}}') : ech(String(v))) + '</span>';
    });
  }
  /* Les modèles écrivent l'identité par défaut ; si le club en a changé,
     la feuille suit sans que les modèles y touchent. */
  function identiteAppliquee(html) {
    var C = G.club || CLUB_DEFAUT, D = CLUB_DEFAUT;
    function rempl(de, vers) { if (de && vers && de !== vers) html = html.split(ech(de)).join(ech(vers)); }
    rempl('Récépissé n° ' + D.recepisse, 'Récépissé n° ' + (C.recepisse || D.recepisse));
    rempl(D.nom.toUpperCase(), (C.nom || D.nom).toUpperCase());
    rempl(D.nom, C.nom || D.nom);
    rempl(D.president, C.president || D.president);
    rempl(initialeNom(D.president), initialeNom(C.president || D.president));
    rempl(D.adresse, C.adresse || D.adresse);
    rempl(D.devise, C.devise || D.devise);
    rempl(D.pays, C.pays || D.pays);
    return html;
  }

  /* Mise en paragraphes, avec **gras**. On échappe d'abord, on
     décore ensuite : l'inverse laisserait passer du HTML.

     Trois formes de ligne, et rien d'autre à apprendre :
       texte          un paragraphe (les lignes qui se suivent se joignent)
       - texte        un point d'une liste (une fiche de fonction en est faite)
       > texte        une note en retrait, en plus petit
     Une ligne vide sépare deux paragraphes. */
  /* Les variations dans une ligne, dans l'ordre où l'on doit les lire :
       **gras**   *italique*   __souligné__   ==surligné==
       {{or|texte}} {{vert|…}} {{rouge|…}} {{gris|…}} {{grand|…}} {{petit|…}} {{maj|…}}
     Le texte est déjà échappé quand il arrive ici. */
  var TEINTES = /^(or|vert|rouge|gris|grand|petit|maj|fin|droit)$/;
  function gras(t) {
    /* les teintes et tailles s'emboîtent ({{or|{{grand|…}}}}) : on résout
       la plus intérieure d'abord, jusqu'à ce qu'il n'en reste plus */
    for (var n = 0; n < 6 && /\{\{(or|vert|rouge|gris|grand|petit|maj|fin|droit)\|[^{}]+\}\}/.test(t); n++) {
      t = t.replace(/\{\{(or|vert|rouge|gris|grand|petit|maj|fin|droit)\|([^{}]+)\}\}/g, '<span class="s-$1">$2</span>');
    }
    return t
      .replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>')
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/__([^_\n]+)__/g, '<u>$1</u>')
      .replace(/==([^=\n]+)==/g, '<mark>$1</mark>')
      .replace(/(^|[^*])\*(\S(?:[^*\n]*?\S)?)\*(?!\*)/g, '$1<i>$2</i>');
  }

  /* La même chose sur une seule ligne : un titre, un libellé, un nom
     peuvent porter du gras, une teinte, une taille. */
  function enLigne(texte) { return variables(gras(ech(String(texte == null ? '' : texte)))); }
  /* Le texte nu, sans ses marques : pour une initiale, un nom de fichier,
     un intitulé de registre. */
  function sansMarques(texte) {
    var t = String(texte == null ? '' : texte);
    for (var n = 0; n < 6 && /\{\{(?:or|vert|rouge|gris|grand|petit|maj|fin|droit)\|[^{}]+\}\}/.test(t); n++) {
      t = t.replace(/\{\{(?:or|vert|rouge|gris|grand|petit|maj|fin|droit)\|([^{}]+)\}\}/g, '$1');
    }
    return t
      .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
      .replace(/\*\*(.+?)\*\*/g, '$1').replace(/__([^_\n]+)__/g, '$1').replace(/==([^=\n]+)==/g, '$1')
      .replace(/(^|[^*])\*(\S(?:[^*\n]*?\S)?)\*(?!\*)/g, '$1$2');
  }

  function paragraphes(texte) {
    var out = [], genre = null, run = [];
    function vider() {
      if (!run.length) return;
      if (genre === 'liste') out.push('<ul>' + run.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul>');
      else if (genre === 'note') out.push('<div class="note"><p>' + run.join(' ') + '</p></div>');
      /* deux lignes qui se suivent sans ligne vide : un retour à la ligne
         dans le même paragraphe (Maj+Entrée sur la feuille, Entrée dans le
         formulaire), pas un espace */
      else out.push('<p>' + run.join('<br>') + '</p>');
      run = []; genre = null;
    }
    String(texte || '').split(/\r?\n/).forEach(function (ligne) {
      var l = ligne.trim();
      if (!l) { vider(); return; }
      var m = /^([-•*]|>)\s+(.*)$/.exec(l);
      var g = m ? (m[1] === '>' ? 'note' : 'liste') : 'para';
      var brut = m ? m[2] : ligne.replace(/^\s+/, '');
      if (/ $/.test(ligne) && !/ $/.test(brut)) brut += ' ';
      var contenu = variables(gras(ech(brut)));
      if (genre && genre !== g) vider();
      genre = g; run.push(contenu);
    });
    vider();
    return out.join('');
  }

  function fait(label, valeur, sous) {
    if (!String(valeur || '').trim()) return '';
    return '<div class="fact"><span class="label">' + ech(label) + '</span>'
         + '<b>' + ech(valeur) + '</b>'
         + (sous ? '<em>' + ech(sous) + '</em>' : '') + '</div>';
  }

  /* "Gilroy-ExtraBold.ttf" -> "gilroyextrabold" */
  function normaliser(nom) {
    var s = String(nom || '').replace(/\.[a-z0-9]+$/i, '').toLowerCase();
    if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return s.replace(/[^a-z0-9]/g, '');
  }

  /* =================================================================
     2. LE MODULE
     ================================================================= */
  var G = {
    modeles: {},
    util: {
      ech: ech, dateDe: dateDe, isoDuJour: isoDuJour, dateLongue: dateLongue,
      duAu: duAu, duAuCourt: duAuCourt, lettres: lettres, nombre: nombre,
      deuxChiffres: deuxChiffres, compter: compter, enonce: enonce,
      enonceCourt: enonceCourt, initialeNom: initialeNom,
      paragraphes: paragraphes, enLigne: enLigne, sansMarques: sansMarques, fait: fait, normaliser: normaliser
    }
  };
  window.BaobabsGreffe = G;

  /* LES TROIS QUESTIONS DE DROIT. Elles vivent ICI, et pas la-haut avec
     la table DROITS, pour une raison qui a coute une soiree : G n'existe
     qu'a cette ligne. Les poser plus tot, a cote de leur explication,
     paraissait plus lisible -- et jetait « Cannot set properties of
     undefined » au premier clic, donc plus de Greffe du tout. Le banc
     n'avait rien vu : il fournissait G lui-meme au bloc extrait. */
  /* Le modele est-il ouvert a cette casquette ? */
  G.peutCreer = function (cle) {
    var m = G.modeles[cle];
    if (!m) return false;
    if (!droits || !droits.familles) return true;
    return droits.familles.indexOf(m.famille || 'Actes') >= 0;
  };
  /* Le droit d'apposer la signature et le cachet du president. */
  G.peutSigner = function () { return !droits || droits.signer !== false; };
  G.casquette  = function () { return (droits && droits.nom) || ''; };

  /* Les lignes utiles d'un tableau : celles qui portent au moins une
     valeur. Un modèle ne doit jamais compter les lignes vides que
     l'écran laisse traîner au bout d'une saisie. */
  G.lignes = function (d, source) {
    var t = d && d.tables && d.tables[source];
    if (!t || !t.lignes) return [];
    return t.lignes.filter(function (l) {
      return Object.keys(l).some(function (k) { return String(l[k] == null ? '' : l[k]).trim(); });
    });
  };

  G.colonnes = function (d, source) {
    var t = d && d.tables && d.tables[source];
    return (t && t.colonnes) ? t.colonnes : [];
  };

  /* =================================================================
     3. LE POSTE : polices, cachet, et le registre des actes
     ================================================================= */
  var BESOINS = [
    { cle: 'organetto', groupe: 'Polices', nom: 'Organetto ExpUltraBold', jeton: 'organetto',
      famille: 'Organetto', graisse: 800, italique: false },
    { cle: 'gilroy800', groupe: 'Polices', nom: 'Gilroy ExtraBold', jeton: 'gilroyextrabold',
      famille: 'Gilroy', graisse: 800, italique: false },
    { cle: 'gilroy700', groupe: 'Polices', nom: 'Gilroy Bold', jeton: 'gilroybold',
      famille: 'Gilroy', graisse: 700, italique: false },
    { cle: 'gilroy600', groupe: 'Polices', nom: 'Gilroy SemiBold', jeton: 'gilroysemibold',
      famille: 'Gilroy', graisse: 600, italique: false },
    { cle: 'gilroy500', groupe: 'Polices', nom: 'Gilroy Medium', jeton: 'gilroymedium',
      famille: 'Gilroy', graisse: 500, italique: false },
    { cle: 'inter400',  groupe: 'Polices', nom: 'Inter Regular', jeton: 'interregular',
      famille: 'InterDoc', graisse: 400, italique: false },
    { cle: 'inter400i', groupe: 'Polices', nom: 'Inter Italic', jeton: 'interitalic',
      famille: 'InterDoc', graisse: 400, italique: true },
    { cle: 'inter500',  groupe: 'Polices', nom: 'Inter Medium', jeton: 'intermedium',
      famille: 'InterDoc', graisse: 500, italique: false },
    { cle: 'inter600',  groupe: 'Polices', nom: 'Inter SemiBold', jeton: 'intersemibold',
      famille: 'InterDoc', graisse: 600, italique: false },
    { cle: 'paraphe',   groupe: 'Polices', nom: 'Holligate Signature', jeton: 'holligate',
      famille: 'Paraphe', graisse: 400, italique: false },
    { cle: 'cachet',    groupe: 'Cachet',  nom: 'Cachet de la présidence', jeton: null, image: true }
  ];

  var DB_NOM = 'bbc-greffe', DB_VER = 5, MAG_RES = 'ressources', MAG_ACTES = 'actes', MAG_PRE = 'prereglages', MAG_REG = 'reglages', MAG_DOS = 'dossiers';

  function dbOuvrir() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB_NOM, DB_VER);
      r.onupgradeneeded = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains(MAG_RES)) db.createObjectStore(MAG_RES, { keyPath: 'cle' });
        if (!db.objectStoreNames.contains(MAG_ACTES)) db.createObjectStore(MAG_ACTES, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(MAG_PRE)) db.createObjectStore(MAG_PRE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(MAG_REG)) db.createObjectStore(MAG_REG, { keyPath: 'cle' });
        if (!db.objectStoreNames.contains(MAG_DOS)) db.createObjectStore(MAG_DOS, { keyPath: 'id' });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }

  function dbTout(magasin) {
    return dbOuvrir().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(magasin, 'readonly').objectStore(magasin).getAll();
        t.onsuccess = function () { res(t.result || []); };
        t.onerror = function () { rej(t.error); };
      });
    }).catch(function () { return []; });
  }

  function dbPoserLocal(magasin, obj) {
    return dbOuvrir().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(magasin, 'readwrite');
        tx.objectStore(magasin).put(obj);
        tx.oncomplete = function () { res(); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }

  function dbOterLocal(magasin, cle) {
    return dbOuvrir().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(magasin, 'readwrite');
        tx.objectStore(magasin)['delete'](cle);
        tx.oncomplete = function () { res(); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }

  function dbVider(magasin) {
    return dbOuvrir().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(magasin, 'readwrite');
        tx.objectStore(magasin).clear();
        tx.oncomplete = function () { res(); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }

  /* =================================================================
     LE MIROIR EN BASE : le registre survit au navigateur
     -----------------------------------------------------------------
     IndexedDB reste le poste de travail (il marche hors ligne, il est
     instantane). Mais un cache vide ou un autre ordinateur, et le
     registre du club n'existait plus. Chaque ecriture d'acte, de
     dossier ou de pre-reglage part donc aussi en base (greffe_actes,
     greffe_dossiers, greffe_prereglages, reservees au proprietaire), et
     l'ouverture ramene ce que ce poste n'a pas : le plus recent (maj)
     l'emporte. Une suppression est une pierre tombale (fiche.supprime)
     et non un effacement : sinon l'autre poste, qui a encore la copie,
     la remonterait. Les polices et le cachet ne montent jamais.
     L'hote fournit api.base = { tout, poser, oter } ; sans lui, rien ne
     change et le Greffe reste local, comme avant.
     ================================================================= */
  var MIROIR = {};
  MIROIR[MAG_ACTES] = 'greffe_actes'; MIROIR[MAG_DOS] = 'greffe_dossiers'; MIROIR[MAG_PRE] = 'greffe_prereglages';
  var baseEtat = { hors: false, synchro: null };
  function baseDispo() { return !!(api && api.base && typeof api.base.tout === 'function'); }
  function ligneMiroir(magasin, obj) {
    var l = { id: obj.id, fiche: obj, maj: obj.maj || Date.now() };
    if (magasin === MAG_ACTES) {
      l.modele = obj.modele || null; l.numero = obj.numero || null; l.etat = obj.etat || null;
      l.intitule = obj.intitule || obj.nom || null; l.dossier = obj.dossier || null;
    }
    return l;
  }
  function miroirPoser(magasin, obj) {
    if (!baseDispo() || !MIROIR[magasin] || !obj || !obj.id) return Promise.resolve();
    return Promise.resolve(api.base.poser(MIROIR[magasin], ligneMiroir(magasin, obj)))
      .then(function () { if (baseEtat.hors) { baseEtat.hors = false; dire('Registre en base : de nouveau joignable', 'ok'); } },
            function (e) { if (!baseEtat.hors) dire('Registre en base injoignable : l\'acte reste sur ce poste', 'erreur'); baseEtat.hors = true; console.warn('[Greffe] miroir', e); });
  }
  function miroirOter(magasin, id) {
    if (!baseDispo() || !MIROIR[magasin] || !id) return Promise.resolve();
    return miroirPoser(magasin, { id: id, supprime: true, maj: Date.now() });
  }
  function synchroniser() {
    if (!baseDispo()) return Promise.resolve();
    return Promise.all(Object.keys(MIROIR).map(function (mag) {
      return Promise.resolve(api.base.tout(MIROIR[mag])).then(function (lignes) {
        return dbTout(mag).then(function (locaux) {
          var parId = {}; locaux.forEach(function (o) { parId[o.id] = o; });
          var p = Promise.resolve();
          (lignes || []).forEach(function (l) {
            var o = l && l.fiche; if (!o || !o.id) return;
            var loc = parId[o.id]; delete parId[o.id];
            if (o.supprime) { if (loc) p = p.then(function () { return dbOterLocal(mag, o.id); }); return; }
            if (!loc || (o.maj || 0) > (loc.maj || 0)) p = p.then(function () { return dbPoserLocal(mag, o); });
            else if ((loc.maj || 0) > (o.maj || 0)) p = p.then(function () { return miroirPoser(mag, loc); });
          });
          /* ce qui n'existe que sur ce poste monte */
          Object.keys(parId).forEach(function (id) { p = p.then(function () { return miroirPoser(mag, parId[id]); }); });
          return p;
        });
      }).catch(function (e) { baseEtat.hors = true; console.warn('[Greffe] synchro', e); });
    })).then(function () { baseEtat.synchro = Date.now(); });
  }
  function dbPoser(magasin, obj) {
    return dbPoserLocal(magasin, obj).then(function () { return miroirPoser(magasin, obj); });
  }
  function dbOter(magasin, cle) {
    return dbOterLocal(magasin, cle).then(function () { return miroirOter(magasin, cle); });
  }

  function lireFichier(f) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
      r.readAsDataURL(f);
    });
  }

  /* Le cachet sort de Photoshop en 2 200 px : 1,1 Mo une fois encodé,
     dans CHAQUE acte exporté. À 25 mm sur le papier, 620 px font déjà
     630 points par pouce, le double de ce qu'une imprimerie demande.
     On réduit donc une fois, au dépôt. */
  /* Une image entre dans l'acte, donc dans le registre et dans chaque
     sauvegarde : on la borne en pixels ET en poids. Un PNG (cachet, logo
     à fond transparent) reste PNG ; une photo (JPEG) reste JPEG, et si
     elle pèse encore trop, on la réduit d'un cran. */
  function alleger(uri, cote, poidsMax) {
    poidsMax = poidsMax || 1500000;
    return new Promise(function (res) {
      var img = new Image();
      img.onload = function () {
        try {
          var png = /^data:image\/png/i.test(uri);
          if (Math.max(img.width, img.height) <= cote && uri.length <= poidsMax) return res(uri);
          function rendre(bord, q) {
            var c = document.createElement('canvas');
            var k = Math.min(1, bord / Math.max(img.width, img.height));
            c.width = Math.max(1, Math.round(img.width * k));
            c.height = Math.max(1, Math.round(img.height * k));
            var x = c.getContext('2d');
            x.imageSmoothingEnabled = true;
            x.imageSmoothingQuality = 'high';
            x.drawImage(img, 0, 0, c.width, c.height);
            return png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', q);
          }
          var sortie = rendre(cote, 0.85), bord = cote, q = 0.85;
          /* encore trop lourd : un cran de moins, jusqu'à 800 px */
          while (sortie.length > poidsMax && bord > 800) { bord = Math.round(bord * 0.75); q = Math.max(0.7, q - 0.05); sortie = rendre(bord, q); }
          res(sortie);
        } catch (e) { res(uri); }
      };
      img.onerror = function () { res(uri); };
      img.src = uri;
    });
  }

  /* =================================================================
     4. ÉTAT INTERNE
     ================================================================= */
  var racine = null, api = null, ouvert = false;
  var res = {};                 /* cle -> dataURI */
  var modeleActif = null;
  var donnees = {};
  var acteId = null, acteSauve = true;
  /* La référence : la fiche telle qu'elle était à l'ouverture ou au dernier
     Enregistrer voulu (Ctrl+S, menu, émission…). L'enregistrement
     automatique ne la touche pas : c'est ce qui permet, en quittant, de
     choisir entre garder ce qu'on a fait et revenir à la référence. */
  var acteReference = null;
  /* le cycle de vie : etat, version, versions emises, journal */
  var acteEtat = 'brouillon', acteVersion = 1, acteVersions = [], acteJournal = [], acteEmisLe = null, acteMotif = '';
  /* l'etat de la fiche elle-meme, quand on relit une ancienne version :
     la frise sait ainsi s'il existe un brouillon apres la derniere emission */
  var acteFicheEtat = 'brouillon', acteFicheVersion = 1;
  /* Les dossiers : une affaire, une personne, une saison. Un acte est
     dans un dossier au plus ; le dossier ne contient rien d'autre que
     ce lien, les actes restent au registre quand on le retire. */
  var dossiers = [], acteDossier = null;
  /* Deux fenêtres du Greffe (Alt+Maj+N) partagent la même base : quand
     l'une enregistre, l'autre relit son registre ; si c'est l'acte qu'elle
     a ouvert, elle prévient plutôt que d'écraser sans le dire. */
  var canal = null, derniereSauvegarde = 0, stockagePersistant = null;
  try { canal = new BroadcastChannel('bbc-greffe'); } catch (e) { canal = null; }
  function ecouterCanal() {
    if (!canal) return;
    canal.onmessage = function (ev) {
      var m = ev.data || {};
      if (m.quoi !== 'acte' && m.quoi !== 'dossiers') return;
      Promise.all([dbTout(MAG_ACTES), dbTout(MAG_DOS)]).then(function (r) {
        var mien = modeleActif && acteId ? registre.filter(function (a) { return a.id === acteId; })[0] : null;
        registre = (r[0] || []).sort(function (a, b) { return (b.maj || 0) - (a.maj || 0); });
        dossiers = (r[1] || []).sort(function (a, b) { return (b.maj || 0) - (a.maj || 0); });
        if (m.quoi === 'acte' && modeleActif && m.id === acteId && acteEtat === 'brouillon') {
          var autre = registre.filter(function (a) { return a.id === acteId; })[0];
          if (autre && (!mien || (autre.maj || 0) > (mien.maj || 0))) {
            if (!acteTouche || acteSauve) {
              /* rien de mien en attente : je prends la version de l'autre fenêtre */
              donnees = JSON.parse(JSON.stringify(autre.donnees)); chargerFiche(autre); acteReference = JSON.stringify(autre); acteTouche = false; acteSauve = true;
              cadrePret = false; rafraichir(); peindreFormulaire(); majTitreBarre();
              dire('Cet acte vient d\'être modifié dans une autre fenêtre : la feuille est à jour', 'ok');
            } else dire('Attention : cet acte vient d\'être enregistré dans une autre fenêtre. Ce que vous enregistrerez ici l\'écrasera.', 'erreur');
          }
        }
        if (espace === 'registre') peindreRegistre(); else if (espace === 'accueil') peindreAccueil();
      });
    };
  }
  var controle = null, panneau = 'donnees', modeLecture = false, espace = 'accueil';
  var registre = [], prereglages = [];
  var cadre = null, cadrePret = false, minuteur = null;
  var zoom = 0.7, nbPages = 1;
  /* 210 mm de feuille et 5 mm de part et d'autre pour son ombre */
  var LARGEUR_CADRE = 220;
  var elt = {};

  function $(id) { return racine ? racine.querySelector('#' + id) : null; }

  function dire(txt, genre) {
    if (!elt.etat) return;
    elt.etat.textContent = txt || '';
    elt.etat.className = 'gf-etat' + (genre ? ' is-' + genre : '');
    if (txt && genre === 'ok') {
      clearTimeout(dire._t);
      dire._t = setTimeout(function () { dire(''); }, 3200);
    }
  }

  var acteTouche = false;
  function salir() { if (lectureSeule()) return; acteSauve = false; acteTouche = true; majTitreBarre(); histoNoter(); autoEnregistrer(); }

  /* =================================================================
     5. L'ÉCRAN DES RESSOURCES
     ================================================================= */
  function ressourcesCompletes() {
    return BESOINS.every(function (b) { return !!res[b.cle]; });
  }

  function poids(uri) {
    var b64 = String(uri).split(',')[1] || '';
    var o = Math.round(b64.length * 0.75 / 1024);
    return o > 1024 ? (o / 1024).toFixed(1) + ' Mo' : o + ' Ko';
  }

  function peindreListeRessources() {
    var ul = elt.polListe;
    if (!ul) return;
    ul.innerHTML = '';
    var groupe = '';
    BESOINS.forEach(function (b) {
      if (b.groupe !== groupe) {
        groupe = b.groupe;
        var t = document.createElement('li');
        t.className = 'gf-pol-groupe';
        t.innerHTML = '<span class="gf-lab" style="margin:0">' + ech(groupe) + '</span>';
        ul.appendChild(t);
      }
      var li = document.createElement('li');
      var ok = !!res[b.cle];
      li.className = ok ? 'is-ok' : '';
      li.innerHTML =
        '<span class="gf-pol-pastille">' + (ok ? '✓' : '') + '</span>' +
        '<span class="gf-pol-nom">' + ech(b.nom) + '</span>' +
        '<span class="gf-pol-poids">' + (ok ? poids(res[b.cle]) : 'manquant') + '</span>';
      ul.appendChild(li);
    });
    if (elt.polSuite) elt.polSuite.disabled = !ressourcesCompletes();
  }

  function accepterFichiers(liste) {
    var fichiers = Array.prototype.slice.call(liste || []);
    if (!fichiers.length) return;

    var restants = BESOINS.filter(function (b) { return !res[b.cle]; });
    var poses = 0, ignores = [];

    fichiers.reduce(function (p, f) {
      return p.then(function () {
        var n = normaliser(f.name);
        var cible = null;

        if (/^image\//.test(f.type) || /\.(png|jpe?g|webp)$/i.test(f.name)) {
          cible = BESOINS.filter(function (b) { return b.image; })[0];
        } else {
          for (var i = 0; i < restants.length; i++) {
            var b = restants[i];
            if (b.jeton && n.indexOf(b.jeton) !== -1) { cible = b; break; }
          }
        }
        if (!cible) { ignores.push(f.name); return; }

        return lireFichier(f)
          .then(function (uri) { return cible.image ? alleger(uri, 620) : uri; })
          .then(function (uri) {
            res[cible.cle] = uri;
            restants = restants.filter(function (b) { return b.cle !== cible.cle; });
            poses++;
            return dbPoser(MAG_RES, { cle: cible.cle, nom: f.name, uri: uri });
          });
      });
    }, Promise.resolve()).then(function () {
      peindreListeRessources();
      if (poses && !ignores.length) dire(poses + ' fichier' + (poses > 1 ? 's' : '') + ' reconnu' + (poses > 1 ? 's' : ''), 'ok');
      else if (poses) dire(poses + ' reconnu(s), ' + ignores.length + ' ignoré(s)', 'ok');
      else dire('Aucun fichier reconnu. Vérifiez les noms.', 'erreur');
    }).catch(function (e) {
      dire('Enregistrement impossible : ' + (e && e.message ? e.message : e), 'erreur');
    });
  }

  /* =================================================================
     6. LE REGISTRE DES ACTES
     Un acte n'est pas enregistré comme du HTML mais comme ses DONNÉES :
     quatre kilo-octets au lieu de sept cents. La base ne grossit pas,
     et le jour où un gabarit s'améliore, tous les actes déjà émis se
     réimpriment avec la nouvelle mise en page.
     ================================================================= */
  function identifiant() {
    return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* =================================================================
     6 bis. LE CYCLE DE VIE DE L'ACTE
     Brouillon, émis, remplacé, annulé, archivé : l'état est écrit en
     toutes lettres, et le bouton principal dit la prochaine chose à
     faire. Un acte émis ne se modifie plus en silence : on en crée une
     nouvelle version, l'ancienne reste au registre avec son empreinte.
     Un numéro attribué ne se réattribue jamais, même annulé.
     ================================================================= */
  var ETATS = {
    brouillon: { lab: 'Brouillon', cls: 'brouillon' },
    emis:      { lab: 'Émis',      cls: 'emis' },
    remplace:  { lab: 'Remplacé',  cls: 'remplace' },
    annule:    { lab: 'Annulé',    cls: 'annule' },
    archive:   { lab: 'Archivé',   cls: 'archive' }
  };
  function etatLabel(e) { return (ETATS[e] || ETATS.brouillon).lab; }

  function lectureSeule() { return !!modeleActif && (acteEtat !== 'brouillon' || modeLecture); }

  function journaliser(quoi) {
    acteJournal.push({ t: Date.now(), quoi: quoi });
    if (acteJournal.length > 400) acteJournal.shift();
  }

  /* SHA-256 du contenu au moment de l'émission : non pas une signature,
     une empreinte, pour savoir plus tard si l'acte a bougé. */
  function empreinte(obj) {
    var s = JSON.stringify(obj);
    if (!(window.crypto && crypto.subtle && window.TextEncoder)) return Promise.resolve('');
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    }).catch(function () { return ''; });
  }

  function ficheCourante() {
    return {
      id: acteId,
      modele: modeleActif.cle,
      nom: modeleActif.nom,
      numero: donnees.numero || '',
      intitule: sansMarques(donnees.nomActe || donnees.titre || modeleActif.nom),
      date: donnees.dateActe || isoDuJour(),
      maj: Date.now(),
      etat: acteEtat, version: acteVersion, versions: acteVersions,
      journal: acteJournal, emisLe: acteEmisLe, motif: acteMotif, dossier: acteDossier || null,
      donnees: JSON.parse(JSON.stringify(donnees))
    };
  }

  function enregistrer(silencieux, automatique) {
    if (!modeleActif) return Promise.resolve();
    if (!acteId) { acteId = identifiant(); if (!acteJournal.length) journaliser('Créé'); }
    /* une autre fenêtre a pu prendre le même numéro entre-temps : on relit la
       base, et si le numéro est à un autre acte, celui-ci avance au suivant */
    var premiere = !registre.some(function (a) { return a.id === acteId; }), collision = null;
    var avant = (modeleActif.prefixe && donnees.numero && acteEtat === 'brouillon' && (premiere || !automatique)) ? dbTout(MAG_ACTES).then(function (tous) {
      tous.forEach(function (a) { if (!registre.some(function (r) { return r.id === a.id; })) registre.push(a); });
      var pris = tous.filter(function (a) { return a.id !== acteId && a.modele === modeleActif.cle && a.numero === donnees.numero; })[0];
      if (pris) {
        var ancien = donnees.numero; collision = ancien;
        donnees.numero = prochainNumero(modeleActif.cle);
        journaliser('Numéro ' + ancien + ' déjà pris par « ' + (pris.intitule || pris.nom) + ' » : devient ' + donnees.numero);
        peindreFormulaire(); rafraichir(); majTitreBarre();
      }
    }).catch(function () {}) : Promise.resolve();
    /* pendant la relecture de la base, l'acte a pu être fermé ou remplacé
       par un autre : on n'écrit alors rien, surtout pas sous une autre identité */
    var idVise = acteId, modeleVise = modeleActif;
    return avant.then(function () {
    if (acteId !== idVise || modeleActif !== modeleVise || !acteId) return;
    var fiche = ficheCourante();
    return dbPoser(MAG_ACTES, fiche).then(function () {
      if (canal) { try { canal.postMessage({ quoi: 'acte', id: fiche.id, maj: fiche.maj }); } catch (e) {} }
      acteSauve = true; majTitreBarre();
      if (!automatique) acteReference = JSON.stringify(fiche);
      ongletRenommer();
      registre = registre.filter(function (a) { return a.id !== fiche.id; });
      registre.unshift(fiche);
      noterReprise();
      if (collision) dire('Enregistré sous le numéro ' + donnees.numero + ' : le ' + collision + ' venait d\'être pris dans une autre fenêtre', 'erreur');
      else if (!silencieux) dire('Enregistré', 'ok');
    });
    }).catch(function (e) {
      dire("Enregistrement impossible : " + (e && e.message ? e.message : e), 'erreur');
    });
  }

  function chargerFiche(fiche) {
    acteEtat = fiche.etat || 'brouillon';
    acteVersion = fiche.version || 1;
    acteVersions = fiche.versions || [];
    acteJournal = fiche.journal || [];
    acteEmisLe = fiche.emisLe || null;
    acteMotif = fiche.motif || '';
    acteDossier = fiche.dossier || null;
    controle = null; panneau = 'donnees'; modeLecture = false; objetSel = null; blocSel = null;
  }

  function ouvrirActe(fiche, version) {
    /* déjà ouvert dans un onglet : on y retourne */
    if (!version && fiche.id !== acteId && ongletDe(fiche.id) && ongletDe(fiche.id).etat) { activerOnglet(fiche.id); return; }
    /* un autre acte est ouvert : il garde son onglet, celui-ci en prend un neuf */
    if (modeleActif && fiche.id !== acteId) {
      var cour = ongletDe(ongletCourant);
      if (acteTouche && !acteSauve && acteEtat === 'brouillon') enregistrer(true, true);
      if (cour) { cour.etat = etatCourant(); cour.nom = nomOnglet(); }
      modeleActif = null;
    }
    var m = G.modeles[fiche.modele];
    if (!m) { dire("Modèle « " + fiche.modele + " » introuvable.", 'erreur'); return; }
    modeleActif = m;
    chargerFiche(fiche);
    /* une ancienne version se relit telle qu'elle a été émise */
    var v = version ? (acteVersions.filter(function (x) { return x.v === version; })[0]) : null;
    acteFicheEtat = acteEtat; acteFicheVersion = acteVersion;
    donnees = JSON.parse(JSON.stringify(v ? v.donnees : fiche.donnees));
    if (v) { acteEtat = v.etat === 'emise' ? 'emis' : 'remplace'; acteVersion = v.v; modeLecture = true; }
    acteId = fiche.id; acteSauve = true; acteTouche = false;
    acteReference = JSON.stringify(fiche);
    ongletPourActeCourant();
    montrer('atelier');
    histoDepart();
    noterReprise();
  }

  function nouvelActe(cle, prereglage) {
    if (modeleActif) {
      var cour = ongletDe(ongletCourant);
      if (acteTouche && !acteSauve && acteEtat === 'brouillon') enregistrer(true, true);
      if (cour) { cour.etat = etatCourant(); cour.nom = nomOnglet(); }
      modeleActif = null;
    }
    var m = G.modeles[cle];
    if (!m) return;
    modeleActif = m;
    donnees = m.defauts();
    if (prereglage && prereglage.donnees) {
      /* le préréglage apporte tout sauf ce qui date l'acte */
      var p = JSON.parse(JSON.stringify(prereglage.donnees));
      delete p.numero; delete p.dateActe;
      Object.keys(p).forEach(function (k) { donnees[k] = p[k]; });
    }
    donnees.tables = donnees.tables || {};
    if (G.club && donnees.signNom === CLUB_DEFAUT.president && G.club.president) donnees.signNom = G.club.president;
    if (G.club && donnees.lieu === CLUB_DEFAUT.ville && G.club.ville) donnees.lieu = G.club.ville;
    /* le numéro suit le registre : premier libre de l'année en cours,
       tous états confondus : un numéro annulé reste pris */
    if (m.prefixe) {
      var an = String(new Date().getFullYear()).slice(2);
      var pris = registre.filter(function (a) { return a.modele === cle && String(a.numero || '').slice(-2) === an; })
        .map(function (a) { return parseInt(String(a.numero).split('/')[0], 10) || 0; });
      var n = 1; while (pris.indexOf(n) !== -1) n++;
      donnees.numero = deuxChiffres(n) + '/' + an;
    }
    acteId = null; acteSauve = false; acteReference = null; acteTouche = false;
    acteEtat = 'brouillon'; acteVersion = 1; acteVersions = []; acteJournal = []; acteEmisLe = null; acteMotif = '';
    acteFicheEtat = 'brouillon'; acteFicheVersion = 1;
    acteDossier = (prereglage && prereglage.dossier) || (registreDossier !== 'tous' && registreDossier !== 'aucun' && dossierDe(registreDossier) ? registreDossier : null);
    controle = null; panneau = 'donnees'; modeLecture = false; objetSel = null; objetsSel = []; blocSel = null;
    journaliser('Créé' + (prereglage ? ' depuis le préréglage « ' + prereglage.nom + ' »' : ''));
    ongletPourActeCourant();
    montrer('atelier');
    histoDepart();
  }

  /* ---- le contrôle avant émission ----
     Une liste de constats, erreurs et avertissements. Les modèles
     peuvent y ajouter les leurs (modele.controles). */
  function verifierActe() {
    var c = [];
    function erreur(t) { c.push({ n: 'erreur', t: t }); }
    function avert(t) { c.push({ n: 'avert', t: t }); }
    function ok(t) { c.push({ n: 'ok', t: t }); }

    if (modeleActif.prefixe) { if (String(donnees.numero || '').trim()) ok('Numéro : ' + donnees.numero); else erreur('Pas de numéro'); }
    if (dateDe(donnees.dateActe)) ok('Daté du ' + dateLongue(donnees.dateActe, false)); else erreur('Pas de date');
    if (String(donnees.titre || '').trim()) ok('Intitulé : ' + String(donnees.titre).slice(0, 60)); else erreur('Pas d\'intitulé');

    var doc = cadre && cadrePret ? cadre.contentDocument : null;
    if (doc) {
      var pages = doc.querySelectorAll('.page');
      ok(pages.length + ' page' + (pages.length > 1 ? 's' : ''));
      if (pages.length > 6) avert('Plus de six pages : est-ce voulu ?');
      Array.prototype.forEach.call(doc.querySelectorAll('.page .corps > *, .page .corps .txt > *'), function (el) {
        var c = el.closest('.corps'); if (c && el.offsetHeight > c.clientHeight + 1) erreur('Un élément est plus haut qu\'une page entière (' + (el.textContent || '').trim().slice(0, 40) + '…) : il ne peut pas se couper, réduisez-le.');
      });
      var deborde = 0;
      Array.prototype.forEach.call(pages, function (p, i) {
        var corps = p.querySelector('.corps');
        if (corps && corps.scrollHeight > corps.clientHeight + 2) { deborde++; erreur('Un texte dépasse la page ' + (i + 1)); }
      });
      if (!deborde) ok('Aucun texte hors page');
      var vides = Array.prototype.filter.call(doc.querySelectorAll('[data-edit]'), function (e) {
        return !e.closest('tr') && !e.textContent.trim() && !/^fixes\./.test(e.getAttribute('data-edit'));
      }).length;
      if (vides) avert(vides + ' zone' + (vides > 1 ? 's' : '') + ' de texte vide' + (vides > 1 ? 's' : '') + ' sur la feuille');
      /* les variables qui n'ont rien trouvé : {{club.telephone}} sans téléphone, {{col.x}} hors série */
      var varsVides = doc.querySelectorAll('.s-var-vide');
      if (varsVides.length) avert(varsVides.length + ' variable' + (varsVides.length > 1 ? 's' : '') + ' sans valeur : '
        + Array.prototype.slice.call(varsVides, 0, 4).map(function (v) { return '{{' + v.getAttribute('data-var') + '}}'; }).join(', ') + ' (Paramètres, ou la série)');
      /* les images encore vides */
      var figs = doc.querySelectorAll('.fig-vide');
      if (figs.length) avert(figs.length + ' image' + (figs.length > 1 ? 's' : '') + ' sans fichier : un cadre gris s\'imprimera');
      /* une colonne calculée qui ne calcule pas */
      if (doc.querySelector('td[data-calc] .ton-alerte')) erreur('Une colonne calculée a une formule illisible');
    }
    /* les objets posés hors de la page (ou presque) */
    var hors = (donnees.objets || []).filter(function (o) {
      return o.x + o.w < 2 || o.y + o.h < 2 || o.x > 208 || o.y > 295 || (o.page || 1) > nbPages;
    });
    if (hors.length) avert(hors.length + ' objet' + (hors.length > 1 ? 's' : '') + ' hors de la page : ' + hors.map(function (o) { return (TYPES_OBJET[o.type] || {}).nom || o.type; }).join(', '));
    else if ((donnees.objets || []).length) ok((donnees.objets || []).length + ' objet' + (donnees.objets.length > 1 ? 's' : '') + ' posé' + (donnees.objets.length > 1 ? 's' : '') + ' sur la page');
    var chevauche = (donnees.objets || []).filter(function (o) { return !o.verrou && (o.type === 'cachet' || o.type === 'signature') && (o.x + o.w > 199 || o.y + o.h > 287); });
    if (chevauche.length) avert('Un cachet ou une signature touche la marge : vérifiez à l\'impression');
    Object.keys(donnees.tables || {}).forEach(function (k) {
      var t = donnees.tables[k];
      var n = G.lignes(donnees, k).length;
      if (!n && t.vide) ok('Tableau « ' + (t.titre || k) + ' » : grille de ' + t.vide + ' lignes à remplir à la main');
      else if (!n) avert('Le tableau « ' + (t.titre || k) + ' » est vide : sa grille s\'imprimera vide');
      else ok('Tableau « ' + (t.titre || k) + ' » : ' + n + ' ligne' + (n > 1 ? 's' : ''));
    });
    if (donnees.avecSignature !== false && 'signNom' in donnees) {
      if (String(donnees.signNom || '').trim()) ok('Signataire : ' + donnees.signNom); else erreur('Pas de signataire');
    }
    if (donnees.avecSignature !== false && !res.paraphe) avert('Police de signature non déposée : la signature ne s\'imprimera pas');
    if (donnees.avecCachet !== false && !res.cachet) avert('Cachet non déposé : il ne s\'imprimera pas');
    if (typeof modeleActif.controles === 'function') {
      (modeleActif.controles(donnees) || []).forEach(function (x) {
        if (x && x.t) c.push({ n: x.n === 'erreur' ? 'erreur' : (x.n === 'ok' ? 'ok' : 'avert'), t: x.t });
      });
    }
    var erreurs = c.filter(function (x) { return x.n === 'erreur'; }).length;
    var averts = c.filter(function (x) { return x.n === 'avert'; }).length;
    controle = { lignes: c, erreurs: erreurs, averts: averts, t: Date.now() };
    return controle;
  }

  function peindreControle() {
    var hote = elt.formDefile;
    if (!controle) verifierActe();
    var c = controle;
    var ico = { ok: '✓', avert: '⚠', erreur: '✕' };
    hote.innerHTML =
      '<div class="gf-controle">'
      + '<div class="gf-controle-liste">' + c.lignes.map(function (l) {
          return '<div class="gf-ctl gf-ctl-' + l.n + '"><span class="gf-ctl-ico">' + ico[l.n] + '</span><span>' + ech(l.t) + '</span></div>';
        }).join('') + '</div>'
      + '<div class="gf-controle-bilan ' + (c.erreurs ? 'is-ko' : (c.averts ? 'is-avert' : 'is-ok')) + '">'
      + (c.erreurs
          ? c.erreurs + ' erreur' + (c.erreurs > 1 ? 's' : '') + ' : émission impossible'
          : (c.averts ? c.averts + ' avertissement' + (c.averts > 1 ? 's' : '') + ' : émission possible' : 'Tout est prêt'))
      + '</div>'
      + '<div class="gf-controle-actions">'
      + '<button type="button" class="gf-btn gf-btn-fant" id="gf-ctl-retour">Retour aux données</button>'
      + (c.erreurs ? '' : '<button type="button" class="gf-btn gf-btn-accent" id="gf-ctl-emettre">Émettre l\'acte</button>')
      + '</div></div>';
    $('gf-ctl-retour').addEventListener('click', function () { panneau = 'donnees'; peindreFormulaire(); majTitreBarre(); });
    var em = $('gf-ctl-emettre');
    if (em) em.addEventListener('click', emettreActe);
  }

  function verifier() {
    if (!modeleActif) return;
    if (lectureSeule()) { dire('Cet acte est ' + etatLabel(acteEtat).toLowerCase() + '.', 'ok'); return; }
    rafraichir();
    verifierActe();
    panneau = 'controle';
    peindreFormulaire();
    majTitreBarre();
  }

  function emettreActe() {
    if (!modeleActif || lectureSeule()) return;
    /* ÉMETTRE, C'EST SIGNER. Un coach compose et enregistre ; il n'engage
       pas le club. Le refus dit quoi faire ensuite : l'acte est là, il
       attend le président, et il ne se perd pas. */
    if (!G.peutSigner()) {
      dire('Cet acte est enregistré. Émettre appose la signature et le cachet '
         + 'du Président : c’est à lui de le faire depuis son propre accès.', 'info');
      return;
    }
    rafraichir();
    var c = verifierActe();
    if (c.erreurs) { panneau = 'controle'; peindreFormulaire(); majTitreBarre(); return; }
    var nom = (modeleActif.libre && String(donnees.titre || '').trim()) || modeleActif.nom;
    var lignes = c.lignes.filter(function (l) { return l.n !== 'erreur'; }).slice(0, 8).map(function (l) {
      return '<div class="gf-ctl gf-ctl-' + l.n + '"><span class="gf-ctl-ico">' + (l.n === 'ok' ? '✓' : '⚠') + '</span><span>' + ech(l.t) + '</span></div>';
    }).join('');
    confirmer('Émettre cet acte ?',
      '<p class="gf-modale-aide"><b>' + ech(nom) + (donnees.numero ? ' · ' + ech(donnees.numero) : '') + '</b> · version ' + acteVersion + '</p>'
      + '<div class="gf-controle-liste">' + lignes + '</div>'
      + '<p class="gf-modale-aide">Une fois émis, cet acte ne se modifie plus : il se réimprime tel quel, ou reçoit une nouvelle version. Cette version reste au registre avec son empreinte.</p>',
      'Émettre V' + acteVersion).then(function (oui) {
      if (!oui) return;
      return empreinte(donnees).then(function (h) {
        var maintenant = Date.now();
        acteVersions.forEach(function (v) { if (v.etat === 'emise') v.etat = 'remplacee'; });
        acteVersions.push({ v: acteVersion, etat: 'emise', emisLe: maintenant, empreinte: h,
                            donnees: JSON.parse(JSON.stringify(donnees)) });
        acteEtat = 'emis'; acteEmisLe = maintenant; controle = null; panneau = 'donnees'; acteFicheEtat = 'emis'; acteFicheVersion = acteVersion;
        journaliser('Émis V' + acteVersion + (h ? ' · empreinte ' + h.slice(0, 12) + '…' : ''));
        return enregistrer(true).then(function () {
          peindreFormulaire(); rafraichir(); majTitreBarre();
          dire('Acte émis · V' + acteVersion, 'ok');
        });
      });
    });
  }

  function nouvelleVersion() {
    if (!modeleActif || acteEtat !== 'emis') return;
    confirmer('Créer une nouvelle version ?',
      '<p class="gf-modale-aide">La version ' + acteVersion + ' émise reste au registre telle quelle. '
      + 'Vous travaillez sur la version ' + (acteVersion + 1) + ', qui la remplacera une fois émise.</p>',
      'Créer V' + (acteVersion + 1)).then(function (oui) {
      if (!oui) return;
      acteVersion++; acteEtat = 'brouillon'; acteEmisLe = null; controle = null; panneau = 'donnees'; modeLecture = false; acteFicheEtat = 'brouillon'; acteFicheVersion = acteVersion;
      journaliser('Nouvelle version V' + acteVersion);
      salir();
      return enregistrer(true).then(function () { peindreFormulaire(); rafraichir(); majTitreBarre(); histoDepart(); });
    });
  }

  function annulerActe() {
    if (!modeleActif || acteEtat === 'annule') return;
    demander('Annuler cet acte', 'Le motif, pour le registre. Le numéro ' + (donnees.numero || '') + ' reste pris : il ne sera jamais réattribué.', 'Erreur de rédaction')
      .then(function (motif) {
        if (motif == null) return;
        acteEtat = 'annule'; acteMotif = motif; controle = null; panneau = 'donnees';
        journaliser('Annulé' + (motif ? ' : ' + motif : ''));
        return enregistrer(true).then(function () { peindreFormulaire(); rafraichir(); majTitreBarre(); dire('Acte annulé', 'ok'); });
      });
  }

  function archiverActe() {
    if (!modeleActif || acteEtat !== 'emis') return;
    acteEtat = 'archive'; journaliser('Archivé');
    enregistrer(true).then(function () { peindreFormulaire(); rafraichir(); majTitreBarre(); dire('Acte archivé', 'ok'); });
  }
  function desarchiverActe() {
    if (!modeleActif || acteEtat !== 'archive') return;
    acteEtat = 'emis'; journaliser('Sorti des archives');
    enregistrer(true).then(function () { peindreFormulaire(); rafraichir(); majTitreBarre(); dire('Acte de retour au registre', 'ok'); });
  }

  function dateHeure(t) {
    var d = new Date(t), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function historiqueActe(fiche) {
    var f = fiche || (modeleActif ? ficheCourante() : null);
    if (!f) return;
    var versions = (f.versions || []).slice().reverse().map(function (v) {
      return '<div class="gf-ctl gf-ctl-' + (v.etat === 'emise' ? 'ok' : 'avert') + '"><span class="gf-ctl-ico">V' + v.v + '</span>'
        + '<span>' + (v.etat === 'emise' ? 'Émise' : 'Remplacée') + ' le ' + ech(dateHeure(v.emisLe))
        + (v.empreinte ? ' · <code>' + ech(v.empreinte.slice(0, 16)) + '…</code>' : '') + '</span>'
        + '<button type="button" class="gf-mini" data-version="' + v.v + '">Ouvrir</button></div>';
    }).join('') || '<p class="gf-vide">Aucune version émise.</p>';
    var journal = (f.journal || []).slice().reverse().map(function (j) {
      return '<div class="gf-journal-ligne"><span class="gf-journal-t">' + ech(dateHeure(j.t)) + '</span><span>' + ech(j.quoi) + '</span></div>';
    }).join('') || '<p class="gf-vide">Rien encore.</p>';
    modale('Historique · ' + ech(f.intitule || f.nom) + (f.numero ? ' n° ' + ech(f.numero) : ''),
      '<h4 class="gf-modale-h4">Versions</h4><div class="gf-controle-liste">' + versions + '</div>'
      + ((f.versions || []).length ? '<p style="margin:8px 0 0"><button type="button" class="gf-mini" data-comparer>Comparer deux versions…</button></p>' : '')
      + '<h4 class="gf-modale-h4">Journal</h4><div class="gf-journal">' + journal + '</div>',
      [{ lab: 'Fermer', accent: false }]).then(function () {});
    Array.prototype.forEach.call(racine.querySelectorAll('.gf-voile [data-version]'), function (b) {
      b.addEventListener('click', function () {
        var v = +b.getAttribute('data-version');
        racine.querySelector('.gf-voile').remove();
        ouvrirActe(f, v);
      });
    });
    var bc = racine.querySelector('.gf-voile [data-comparer]');
    if (bc) bc.addEventListener('click', function () { bc.closest('.gf-voile').remove(); comparerVersions(fiche || null); });
  }

  /* ---------------------------- COMPARER DEUX VERSIONS ----------------------------
     Les données de deux versions (ou la version en cours) mises à plat,
     champ par champ ; ce qui a changé s'affiche mot à mot, retiré en rouge,
     ajouté en vert. Les images ne se comparent pas, on dit seulement si
     elles ont changé. */
  function aplatir(d, prefixe, out) {
    out = out || {};
    if (d == null) return out;
    if (typeof d !== 'object') { out[prefixe] = String(d); return out; }
    Object.keys(d).sort().forEach(function (k) {
      var v = d[k], ch = prefixe ? prefixe + '.' + k : k;
      if (typeof v === 'string' && /^data:/.test(v)) { out[ch] = '[image ' + Math.round(v.length / 1024) + ' Ko · ' + v.length + ']'; return; }
      if (v && typeof v === 'object') aplatir(v, ch, out);
      else if (v !== '' && v != null) out[ch] = typeof v === 'boolean' ? (v ? 'oui' : 'non') : String(v);
    });
    return out;
  }
  function libelleChemin(chemin, m) {
    var p = chemin.split('.'), noms = [];
    function lab(cle) {
      var r = null;
      (m && m.sections || []).forEach(function (s) { (s.champs || []).forEach(function (c) { if (c.cle === cle && !r) r = c.lab; }); });
      return r;
    }
    if (p[0] === 'tables') { noms.push('Tableau « ' + ((donnees.tables && donnees.tables[p[1]] && donnees.tables[p[1]].titre) || p[1]) + ' »'); if (p[2] === 'lignes') noms.push('ligne ' + (+p[3] + 1)); if (p[2] === 'colonnes') noms.push('colonne ' + (+p[3] + 1)); noms.push(p.slice(4).join(' · ') || p.slice(2).join(' · ')); }
    else if (p[0] === 'blocs') { noms.push('Bloc ' + (+p[1] + 1)); noms.push(p.slice(2).join(' · ')); }
    else if (p[0] === 'fixes') { noms.push('Sur la feuille'); noms.push(p.slice(1).join(' · ')); }
    else if (p[0] === 'objets') { noms.push('Objet posé ' + (+p[1] + 1)); noms.push(p.slice(2).join(' · ')); }
    else if (p[0] === 'articles') { noms.push('Article ' + (+p[1] + 1)); noms.push(p.slice(2).join(' · ')); }
    else { noms.push(lab(p[0]) || p[0]); if (p.length > 1) noms.push(p.slice(1).join(' · ')); }
    return noms.filter(Boolean).join(' · ');
  }
  function diffMots(a, b) {
    var A = a.split(/(\s+)/).filter(function (x) { return x !== ''; }), B = b.split(/(\s+)/).filter(function (x) { return x !== ''; });
    if (A.length * B.length > 4000000) return '<del>' + ech(a) + '</del> <ins>' + ech(b) + '</ins>';
    var n = A.length, m = B.length, L = new Uint16Array((n + 1) * (m + 1)), W = m + 1;
    for (var i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--) L[i * W + j] = A[i] === B[j] ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
    var out = [], x = 0, y = 0;
    function pousser(genre, s) { if (out.length && out[out.length - 1].g === genre) out[out.length - 1].s += s; else out.push({ g: genre, s: s }); }
    while (x < n && y < m) {
      if (A[x] === B[y]) { pousser('=', A[x]); x++; y++; }
      else if (L[(x + 1) * W + y] >= L[x * W + y + 1]) { pousser('-', A[x]); x++; }
      else { pousser('+', B[y]); y++; }
    }
    while (x < n) { pousser('-', A[x++]); }
    while (y < m) { pousser('+', B[y++]); }
    return out.map(function (o) { var s = ech(o.s); if (!o.s.trim()) return s; return o.g === '-' ? '<del>' + s + '</del>' : (o.g === '+' ? '<ins>' + s + '</ins>' : s); }).join('');
  }
  function comparerVersions(fiche, choixA, choixB) {
    var f = fiche || (modeleActif ? ficheCourante() : null);
    if (!f) return;
    var m = G.modeles[f.modele] || modeleActif;
    var choix = (f.versions || []).map(function (v) { return { id: 'v' + v.v, lab: 'V' + v.v + ' · ' + (v.etat === 'emise' ? 'émise' : 'remplacée') + ' le ' + dateHeure(v.emisLe), d: v.donnees }; });
    /* un acte émis est sa dernière version : la « version en cours » n'a de sens qu'en brouillon */
    if (f.id === acteId && modeleActif) { if (acteEtat === 'brouillon') choix.push({ id: 'courante', lab: 'Version en cours (brouillon V' + acteVersion + ')', d: donnees }); }
    else if ((f.etat || 'brouillon') === 'brouillon') choix.push({ id: 'courante', lab: 'Brouillon en cours (V' + (f.version || 1) + ')', d: f.donnees });
    if (choix.length < 2) { dire('Rien à comparer : cet acte n\'a pas encore de version émise.', 'erreur'); return; }
    var idA = choixA || choix[choix.length - 2].id, idB = choixB || choix[choix.length - 1].id;
    function de(id) { return choix.filter(function (c) { return c.id === id; })[0] || choix[0]; }
    var A = aplatir(de(idA).d, ''), B = aplatir(de(idB).d, '');
    var chemins = Object.keys(A).concat(Object.keys(B)).filter(function (c, i, arr) { return arr.indexOf(c) === i; }).sort();
    var lignes = [], nb = { plus: 0, moins: 0, change: 0 };
    chemins.forEach(function (c) {
      var a = A[c], b = B[c];
      if (a === b) return;
      var genre = a == null ? 'plus' : (b == null ? 'moins' : 'change');
      nb[genre]++;
      var corps = genre === 'plus' ? '<ins>' + ech(b) + '</ins>' : (genre === 'moins' ? '<del>' + ech(a) + '</del>' : (/^\[image/.test(a) || /^\[image/.test(b) ? '<del>' + ech(a) + '</del> → <ins>' + ech(b) + '</ins>' : diffMots(a, b)));
      lignes.push('<div class="gf-diff gf-diff-' + genre + '"><div class="gf-diff-ou">' + ech(libelleChemin(c, m)) + '<small>' + ech(c) + '</small></div><div class="gf-diff-txt">' + corps + '</div></div>');
    });
    var opts = function (sel) { return choix.map(function (c) { return '<option value="' + c.id + '"' + (c.id === sel ? ' selected' : '') + '>' + ech(c.lab) + '</option>'; }).join(''); };
    var resume = lignes.length ? (nb.change ? nb.change + ' modifié' + (nb.change > 1 ? 's' : '') : '') + (nb.plus ? (nb.change ? ', ' : '') + nb.plus + ' ajouté' + (nb.plus > 1 ? 's' : '') : '') + (nb.moins ? (nb.change || nb.plus ? ', ' : '') + nb.moins + ' retiré' + (nb.moins > 1 ? 's' : '') : '') : 'Aucune différence';
    modale('Comparer · ' + ech(f.intitule || f.nom) + (f.numero ? ' n° ' + ech(f.numero) : ''),
      '<div class="gf-grille2"><label class="gf-champ"><span>Avant</span><select class="gf-sel" data-cmp-a>' + opts(idA) + '</select></label>'
      + '<label class="gf-champ"><span>Après</span><select class="gf-sel" data-cmp-b>' + opts(idB) + '</select></label></div>'
      + '<p class="gf-modale-aide">' + ech(resume) + '. <del>Retiré</del>, <ins>ajouté</ins>, mot à mot ; les images se signalent sans se montrer.</p>'
      + '<div class="gf-diff-liste">' + (lignes.join('') || '<p class="gf-vide">Les deux versions ont exactement les mêmes données.</p>') + '</div>',
      [{ lab: 'Fermer' }]);
    var vs = racine.querySelectorAll('.gf-voile'), v = vs[vs.length - 1]; if (!v) return;
    v.querySelector('.gf-modale').classList.add('gf-modale-large');
    ['a', 'b'].forEach(function (k) { v.querySelector('[data-cmp-' + k + ']').addEventListener('change', function () {
      var na = v.querySelector('[data-cmp-a]').value, nb2 = v.querySelector('[data-cmp-b]').value; v.remove(); comparerVersions(fiche, na, nb2);
    }); });
  }

  function informationsActe() {
    if (!modeleActif) return;
    var f = ficheCourante();
    var derniere = acteVersions.length ? acteVersions[acteVersions.length - 1] : null;
    modale('Informations sur l\'acte',
      '<div class="gf-infos">'
      + '<div><span class="gf-lab">Acte</span><b>' + ech(f.intitule) + '</b></div>'
      + '<div><span class="gf-lab">Modèle</span><b>' + ech(modeleActif.nom) + '</b></div>'
      + '<div><span class="gf-lab">Numéro</span><b>' + ech(f.numero || 'aucun') + '</b></div>'
      + '<div><span class="gf-lab">Dossier</span><b>' + ech(nomDossier(acteDossier) || 'aucun') + '</b></div>'
      + '<div><span class="gf-lab">État</span><b>' + ech(etatLabel(acteEtat)) + ' · version ' + acteVersion + '</b></div>'
      + '<div><span class="gf-lab">Daté du</span><b>' + ech(dateLongue(f.date, true)) + '</b></div>'
      + (acteEmisLe ? '<div><span class="gf-lab">Émis le</span><b>' + ech(dateHeure(acteEmisLe)) + '</b></div>' : '')
      + (derniere && derniere.empreinte ? '<div><span class="gf-lab">Empreinte SHA-256 de la V' + derniere.v + '</span><code>' + ech(derniere.empreinte) + '</code></div>' : '')
      + (acteMotif ? '<div><span class="gf-lab">Motif d\'annulation</span><b>' + ech(acteMotif) + '</b></div>' : '')
      + '<div><span class="gf-lab">Identifiant</span><code>' + ech(acteId || 'pas encore enregistré') + '</code></div>'
      + '</div>'
      + '<p class="gf-modale-aide">L\'empreinte dit si le contenu a bougé depuis l\'émission ; ce n\'est pas une signature électronique.</p>',
      [{ lab: 'Fermer' }]);
  }

  /* ---- les boîtes de dialogue ----
     confirmer() rend vrai ou faux ; modale() affiche et attend qu'on
     ferme. Toutes dans la charte, aucune de window.* */
  function modale(titre, html, boutons) {
    return new Promise(function (res) {
      var voile = document.createElement('div');
      voile.className = 'gf-voile';
      voile.innerHTML =
        '<div class="gf-modale" role="dialog" aria-modal="true">'
        + '<header class="gf-modale-top"><h3>' + titre + '</h3>'
        + '<button type="button" class="gf-ico gf-ico-close" data-x aria-label="Fermer">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></header>'
        + '<div class="gf-modale-corps">' + html + '</div>'
        + '<footer class="gf-modale-pied">' + (boutons || [{ lab: 'Fermer' }]).map(function (b, i) {
            return '<button type="button" class="gf-btn ' + (b.accent ? 'gf-btn-accent' : 'gf-btn-fant') + '" data-b="' + i + '">' + ech(b.lab) + '</button>';
          }).join('') + '</footer></div>';
      function fin(v) { if (voile.parentNode) voile.remove(); res(v); }
      voile.querySelector('[data-x]').addEventListener('click', function () { fin(null); });
      Array.prototype.forEach.call(voile.querySelectorAll('[data-b]'), function (b) {
        b.addEventListener('click', function () { fin((boutons || [])[+b.getAttribute('data-b')]); });
      });
      voile.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fin(null); } });
      racine.appendChild(voile);
      var premier = voile.querySelector('.gf-btn-accent') || voile.querySelector('[data-b]');
      if (premier) premier.focus();
    });
  }
  function confirmer(titre, html, oui) {
    return modale(titre, html, [{ lab: 'Retour', accent: false }, { lab: oui || 'Confirmer', accent: true, oui: true }])
      .then(function (b) { return !!(b && b.oui); });
  }

  /* =================================================================
     6 ter. LES ESPACES : ACCUEIL, REGISTRE, PARAMÈTRES, ET LE CHOIX D'UN ACTE
     ================================================================= */
  function badgeEtat(e, version) {
    var x = ETATS[e] || ETATS.brouillon;
    return '<span class="gf-badge gf-badge-' + x.cls + '">' + ech(x.lab.toUpperCase()) + (version > 1 || e === 'emis' ? ' · V' + (version || 1) : '') + '</span>';
  }
  function ligneActe(a) {
    return '<button type="button" class="gf-acte-ligne" data-acte="' + ech(a.id) + '">'
      + '<span class="gf-al-num">' + ech(a.numero || '·') + '</span>'
      + '<span class="gf-al-txt"><b>' + ech(a.intitule || a.nom) + '</b><span>' + ech(a.nom) + ' · ' + ech(dateLongue(a.date, false) || '') + (a.dossier && dossierDe(a.dossier) ? ' · <i class="gf-al-dos">' + ech(nomDossier(a.dossier)) + '</i>' : '') + '</span></span>'
      + badgeEtat(a.etat || 'brouillon', a.version) + '</button>';
  }
  function brancherLignesActes(hote) {
    hote.querySelectorAll('.gf-acte-ligne').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = registre.filter(function (a) { return a.id === b.getAttribute('data-acte'); })[0];
        if (f) ouvrirActe(f);
      });
    });
  }

  /* ---- l'aperçu schématique d'un acte : une mini-feuille faite de barres ----
     Pas un rendu (il faudrait les polices et 700 Ko) : la forme, pour
     reconnaître d'un coup d'œil un procès-verbal d'une attestation. */
  function typesDeBlocs(m, donnees) {
    try {
      var d = donnees || m.defauts();
      var page = G.blocs.val(m.page, d, {}) || [];
      var out = [];
      page.forEach(function (b) {
        if (!b || !b.b) return;
        if (b.si && !G.blocs.val(b.si, d, {})) return;
        out.push(b.b);
        if (b.b === 'annexe') (b.contenu || []).forEach(function (c) { if (c && c.b) out.push(c.b); });
      });
      return out;
    } catch (e) { return []; }
  }
  function apercuSchema(types) {
    var g = { entete: '<div class="gm-entete"><i></i><b></b></div>', titre: '<div class="gm-titre"></div>',
              texte: '<div class="gm-txt"><i></i><i></i><i></i></div>', lettre: '<div class="gm-txt"><i></i><i></i><i></i><i></i></div>',
              encadre: '<div class="gm-txt gm-enc"><i></i><i></i></div>', phrase: '<div class="gm-txt"><i style="width:40%"></i></div>',
              reperes: '<div class="gm-cases"><i></i><i></i><i></i><i></i></div>', chips: '<div class="gm-cases"><i></i><i></i><i></i></div>',
              parties: '<div class="gm-parties"><i></i><i></i></div>', articles: '<div class="gm-arts"><i></i><i></i><i></i></div>',
              postes: '<div class="gm-table"><b></b><i></i><i></i><i></i></div>', tableau: '<div class="gm-table"><b></b><i></i><i></i><i></i></div>',
              signatures: '<div class="gm-sign"><i></i></div>', certification: '<div class="gm-sign"><i></i></div>',
              image: '<div class="gm-img"></div>', espace: '<div class="gm-esp"></div>', saut: '<div class="gm-sep"></div>', annexe: '<div class="gm-sep"></div>',
              bandeau: '<div class="gm-titre gm-bande"></div>', grille: '<div class="gm-cases"><i></i><i></i><i></i><i></i><i></i><i></i></div>',
              cases: '<div class="gm-txt"><i style="width:55%"></i><i style="width:45%"></i><i style="width:60%"></i></div>', signatureLibre: '<div class="gm-sign"><i></i><i></i></div>',
              diplome: '<div class="gm-diplome"><b></b><i></i></div>', cartes: '<div class="gm-cartes"><i></i><i></i><i></i><i></i></div>',
              talon: '<div class="gm-sep"></div>', ordreDuJour: '<div class="gm-arts"><i></i><i></i><i></i></div>',
              colonnes: '<div class="gm-cols"><span><i></i><i></i><i></i><i></i></span><b></b></div>',
              fronton: '<div class="gm-fronton"><u></u><span><i></i><i></i></span></div>' };
    return '<div class="gf-schema"><div class="gf-schema-page">' + (types || []).slice(0, 9).map(function (t) { return g[t] || ''; }).join('') + '</div></div>';
  }
  function apercuModele(m) { return apercuSchema(typesDeBlocs(m)); }
  function apercuPrereglage(p) {
    var m = G.modeles[p.modele];
    if (!m) return apercuSchema([]);
    var d = m.defauts();
    Object.keys(p.donnees || {}).forEach(function (k) { d[k] = p.donnees[k]; });
    return apercuSchema(typesDeBlocs(m, d));
  }

  /* =================================================================
     LES VRAIES MINIATURES
     Le schéma de barres grises disait la STRUCTURE d'un acte, pas son
     allure : avec vingt-cinq modèles et autant de préréglages, deux
     cartes voisines se ressemblaient. Ici, la miniature est la feuille
     elle-même, rendue en petit dans son propre cadre.

     Deux tailles, deux coûts :
     - la vignette de carte n'emporte PAS les polices (à 92 px, personne
       ne distingue Organetto d'une sans-serif, et dix @font-face en
       base64 par carte coûteraient une fortune) ;
     - l'aperçu au survol, LUI, les emporte : c'est là qu'on lit.
     Une carte ne fabrique son cadre qu'en arrivant à l'écran.
     ================================================================= */
  var MINI_L = 794;                       /* 210 mm en pixels CSS */
  var MINI_H = Math.round(MINI_L * 297 / 210);

  function donneesApercu(m, p) {
    var d = m.defauts();
    if (p) Object.keys(p.donnees || {}).forEach(function (k) { d[k] = p.donnees[k]; });
    return d;
  }

  function htmlApercu(m, d, avecPolices) {
    var css = (avecPolices ? cssPolices() + '\n' : '') + G.blocs.css()
            + (m.css ? '\n' + m.css() : '')
            + '\nhtml,body{background:#fff;margin:0}.pages{display:block!important;padding:0!important;gap:0!important}'
            + '.page{box-shadow:none!important;border-radius:0!important;margin:0!important}';
    return '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><style>' + css
         + '</style></head><body class="pagine">'
         + G.blocs.assembler(m, d, { res: res, brouillon: false }) + '</body></html>';
  }

  /* On met en pages pour de vrai, puis on ne garde que la première :
     une miniature doit montrer ce qui sort de l'imprimante, pas un
     empilement de blocs qui déborde. La mesure passe par setTimeout et
     non requestAnimationFrame, qui ne se déclenche pas dans un onglet
     que personne ne regarde. */
  function poserApercu(hote, m, d, largeur, avecPolices) {
    if (!hote || !m || hote.getAttribute('data-pose') === '1') return;
    hote.setAttribute('data-pose', '1');
    var cadreMini = document.createElement('iframe');
    cadreMini.className = 'gf-vue-cadre';
    cadreMini.setAttribute('aria-hidden', 'true');
    cadreMini.setAttribute('tabindex', '-1');
    cadreMini.style.width = MINI_L + 'px';
    cadreMini.style.height = MINI_H + 'px';
    cadreMini.style.transform = 'scale(' + (largeur / MINI_L) + ')';
    hote.appendChild(cadreMini);
    try {
      var doc = cadreMini.contentDocument;
      doc.open(); doc.write(htmlApercu(m, d, avecPolices)); doc.close();
      setTimeout(function () {
        try {
          G.blocs.paginer(doc);
          var pages = doc.querySelectorAll('.page');
          for (var i = pages.length - 1; i > 0; i--) pages[i].remove();
          hote.classList.add('gf-vue-prete');
        } catch (e) { hote.classList.add('gf-vue-prete'); }
      }, 0);
    } catch (e) { hote.removeAttribute('data-pose'); }
  }

  /* « Sénégal Bi Nu Bokk » devient « senegal bi nu bokk ». normaliser()
     ne convient pas ici : elle colle tout, et « bi nu » ne trouverait
     plus rien. On cherche mot à mot, tous les mots devant être présents. */
  function cleRecherche(s) {
    s = String(s == null ? '' : s).toLowerCase();
    if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return s.replace(/[^a-z0-9]+/g, ' ').trim();
  }

  /* ---- l'accueil : que voulez-vous faire ? ---- */
  /* Le registre vit dans CE navigateur : sans sauvegarde, un profil vidé
     ou un autre poste ne le connaît pas. L'accueil le rappelle quand il faut. */
  function rappelSauvegarde() {
    if (registre.length < 3) return '';
    var jours = derniereSauvegarde ? Math.floor((Date.now() - derniereSauvegarde) / 86400000) : null;
    var recents = registre.filter(function (a) { return (a.maj || 0) > (derniereSauvegarde || 0); }).length;
    if (jours !== null && jours < 14 && recents < 10) return '';
    var texte = jours === null ? 'Le registre n\'a jamais été sauvegardé' : ('Dernière sauvegarde il y a ' + jours + ' jour' + (jours > 1 ? 's' : ''));
    texte += ' · ' + (recents ? recents + ' acte' + (recents > 1 ? 's' : '') + ' modifié' + (recents > 1 ? 's' : '') + ' depuis' : 'rien de nouveau depuis') + '. Le registre vit dans ce navigateur : un profil vidé ou un autre ordinateur ne le connaît pas.';
    return '<div class="gf-acc-carte gf-acc-rappel"><b>Sauvegarde</b><span>' + ech(texte) + '</span><button type="button" class="gf-btn gf-btn-accent" id="gf-acc-sauver-2">Sauvegarder maintenant</button></div>';
  }
  function peindreAccueil() {
    var hote = elt.accueil;
    if (!hote) return;
    var brouillons = registre.filter(function (a) { return (a.etat || 'brouillon') === 'brouillon'; });
    var dossiersRecents = dossiers.slice().sort(function (a, b) { return (b.maj || 0) - (a.maj || 0); }).slice(0, 6);
    var emis = registre.filter(function (a) { return a.etat === 'emis'; });
    var recents = registre.slice(0, 6);
    var pres = tousPrereglages().slice(0, 6);
    var h = new Date().getHours();
    var salut = h < 18 ? 'Bonjour' : 'Bonsoir';

    hote.innerHTML =
      '<div class="gf-acc-carte gf-acc-hero">'
      + '<h2 class="gf-acc-titre">' + salut + '.</h2>'
      + '<p class="gf-acc-intro">Que voulez-vous faire ?</p>'
      + '<div class="gf-acc-actions">'
      + '<button type="button" class="gf-btn gf-btn-accent gf-btn-grand" id="gf-acc-nouveau">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Nouvel acte <kbd>Alt+N</kbd></button>'
      + (brouillons.length ? '<button type="button" class="gf-btn gf-btn-fant gf-btn-grand" id="gf-acc-brouillon">Reprendre un brouillon <span class="gf-compte">' + brouillons.length + '</span></button>' : '')
      + '</div></div>'
      + (recents.length
          ? '<div class="gf-acc-carte"><h2 class="gf-acc-titre gf-acc-titre-sm">Récents</h2><div class="gf-actes-liste">' + recents.map(ligneActe).join('') + '</div>'
            + '<button type="button" class="gf-lien" id="gf-acc-registre">Ouvrir le registre · ' + registre.length + ' acte' + (registre.length > 1 ? 's' : '')
            + (brouillons.length ? ' · ' + brouillons.length + ' brouillon' + (brouillons.length > 1 ? 's' : '') : '')
            + (emis.length ? ' · ' + emis.length + ' émis' : '') + '</button></div>'
          : '')
      + (dossiersRecents.length
          ? '<div class="gf-acc-carte"><h2 class="gf-acc-titre gf-acc-titre-sm">Dossiers</h2><div class="gf-puces">' + dossiersRecents.map(function (d) {
              return '<button type="button" class="gf-puce" data-acc-dossier="' + ech(d.id) + '">' + ech(d.nom) + ' <span class="gf-compte">' + actesDuDossier(d.id).length + '</span></button>';
            }).join('') + '</div></div>' : '')
      + '<div class="gf-acc-carte"><h2 class="gf-acc-titre gf-acc-titre-sm">Préréglages</h2>'
      + '<p class="gf-acc-intro">Un acte déjà composé : ouvrez-le, il ne reste qu\'à écrire.</p>'
      + '<div class="gf-cartes gf-cartes-mini">' + pres.map(function (p, i) {
          return '<button type="button" class="gf-carte gf-carte-mini" data-pre="' + i + '">' + apercuPrereglage(p) + '<b>' + ech(p.nom) + '</b></button>';
        }).join('') + '</div><button type="button" class="gf-lien" id="gf-acc-tous-pre">Tous les préréglages…</button></div>'
      + rappelSauvegarde()
      + '<p class="gf-acc-pied"><button type="button" class="gf-lien" data-espace="parametres">Paramètres</button> · '
      + '<button type="button" class="gf-lien" id="gf-acc-sauver">Sauvegarder le Greffe</button></p>';

    $('gf-acc-nouveau').addEventListener('click', function () { ouvrirNouveau(); });
    var s2 = $('gf-acc-sauver-2'); if (s2) s2.addEventListener('click', sauvegarderGreffe);
    elt.accueil.querySelectorAll('[data-acc-dossier]').forEach(function (x) { x.addEventListener('click', function () { registreDossier = x.getAttribute('data-acc-dossier'); montrer('registre'); }); });
    var b = $('gf-acc-brouillon');
    if (b) b.addEventListener('click', function () { montrer('registre', 'brouillon'); });
    var r = $('gf-acc-registre');
    if (r) r.addEventListener('click', function () { montrer('registre'); });
    hote.querySelectorAll('[data-pre]').forEach(function (x) {
      x.addEventListener('click', function () { var p = pres[+x.getAttribute('data-pre')]; nouvelActe(p.modele, p); });
    });
    $('gf-acc-tous-pre').addEventListener('click', function () { ouvrirNouveau('prereglages'); });
    hote.querySelectorAll('[data-espace]').forEach(function (x) {
      x.addEventListener('click', function () { montrer(x.getAttribute('data-espace')); });
    });
    $('gf-acc-sauver').addEventListener('click', sauvegarderGreffe);
    brancherLignesActes(hote);
  }

  /* ---- le choix d'un acte nouveau : modèles et préréglages ---- */
  function ouvrirNouveau(onglet) {
    var familles = {};
    MODELES.forEach(function (k) {
      var m = G.modeles[k];
      /* Une casquette ne voit QUE ce qu'elle peut creer. Griser les
         autres donnerait une liste de portes fermees ; les retirer dit
         la meme chose sans le reproche. */
      if (!m || !G.peutCreer(k)) return;
      (familles[m.famille || 'Actes'] = familles[m.famille || 'Actes'] || []).push(m);
    });
    var htmlModeles = Object.keys(familles).map(function (f) {
      return '<div class="gf-fam"><span class="gf-lab">' + ech(f) + '</span><div class="gf-cartes">'
        + familles[f].map(function (m) {
            return '<button type="button" class="gf-carte gf-carte-apercu" data-modele="' + ech(m.cle) + '">' + apercuModele(m)
              + '<span class="gf-carte-txt"><b>' + ech(m.nom) + '</b><span>' + ech(m.resume || '') + '</span></span></button>';
          }).join('') + '</div></div>';
    }).join('');
    var pres = tousPrereglages();
    var htmlPre = '<div class="gf-cartes">' + pres.map(function (p, i) {
        var m = G.modeles[p.modele];
        return '<div class="gf-carte gf-carte-pre" data-pre="' + i + '">'
          + '<button type="button" class="gf-carte-ouvrir gf-carte-apercu">' + apercuPrereglage(p) + '<span class="gf-carte-txt"><b>' + ech(p.nom) + '</b>'
          + '<span>' + ech(m ? m.nom : p.modele) + (p.livre ? ' · livré avec le Greffe' : ' · le vôtre') + '</span></span></button>'
          + (p.livre ? '' : '<span class="gf-carte-actions">'
              + '<button type="button" class="gf-ico" data-exporter title="Exporter en fichier .json" aria-label="Exporter">'
              + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M6 9l6-6 6 6M4 21h16"/></svg></button>'
              + '<button type="button" class="gf-ico" data-retirer title="Retirer ce préréglage" aria-label="Retirer">'
              + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></span>')
          + '</div>';
      }).join('') + '</div>'
      + '<div class="gf-depot-pre"><label class="gf-mini" for="gf-pre-fichier">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9M6 15l6 6 6-6M4 3h16"/></svg>'
      + 'Déposer un préréglage (.json)</label><input type="file" id="gf-pre-fichier" accept=".json,application/json" multiple hidden></div>';

    var voile = document.createElement('div');
    voile.className = 'gf-voile';
    voile.innerHTML =
      '<div class="gf-modale gf-modale-large" role="dialog" aria-modal="true">'
      + '<header class="gf-modale-top"><h3>Quel acte voulez-vous établir ?</h3>'
      + '<div class="gf-chercher"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'
      + '<input type="search" id="gf-nouveau-q" autocomplete="off" spellcheck="false"'
      + ' placeholder="Chercher : maire, tournoi, reçu, convocation…" aria-label="Chercher un acte"></div>'
      + '<div class="gf-onglets"><button type="button" class="gf-onglet is-actif" data-onglet="modeles">Modèles</button>'
      + '<button type="button" class="gf-onglet" data-onglet="prereglages">Préréglages</button></div>'
      + '<button type="button" class="gf-ico gf-ico-close" data-x aria-label="Fermer">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></header>'
      + '<p class="gf-rien" hidden>Rien ne correspond. Essayez un mot du nom de l\'acte, ou du destinataire.</p>'
      + '<div class="gf-modale-corps"><div data-page="modeles">' + htmlModeles + '</div>'
      + '<div data-page="prereglages" hidden><p class="gf-modale-aide">Depuis l\'atelier, « Préréglage » garde l\'acte en cours sous cette forme ; un fichier .json le fait voyager d\'un poste à l\'autre.</p>' + htmlPre + '</div></div>'
      + '</div>';
    racine.appendChild(voile);

    /* ---- les cartes, leur acte et leur texte cherchable ---- */
    var cartes = [];
    voile.querySelectorAll('.gf-carte').forEach(function (c) {
      var m, d, mots;
      if (c.hasAttribute('data-modele')) {
        m = G.modeles[c.getAttribute('data-modele')];
        if (!m) return;
        d = donneesApercu(m, null);
        mots = [m.nom, m.resume, m.famille, m.cle];
      } else {
        var p = pres[+c.getAttribute('data-pre')];
        m = p && G.modeles[p.modele];
        if (!m) return;
        d = donneesApercu(m, p);
        /* un préréglage se cherche aussi par son destinataire et son
           objet : « maire », « Mermoz », « tournoi » doivent le trouver */
        mots = [p.nom, m.nom, m.famille, d.destNom, d.destQualite, d.objet, d.titre, d.evenement, d.lieuEvenement];
      }
      c.setAttribute('data-q', cleRecherche(mots.join(' ')));
      cartes.push({ el: c, m: m, d: d, hote: c.querySelector('.gf-schema') });
    });

    /* ---- la vignette, fabriquée à l'arrivée à l'écran ---- */
    function poserVignette(c) {
      if (c && c.hote) poserApercu(c.hote, c.m, c.d, c.hote.clientWidth || 90, false);
    }
    var guetteur = null;
    if (window.IntersectionObserver) {
      guetteur = new IntersectionObserver(function (entrees) {
        entrees.forEach(function (e) {
          if (!e.isIntersecting) return;
          guetteur.unobserve(e.target);
          poserVignette(cartes.filter(function (x) { return x.hote === e.target; })[0]);
        });
      }, { root: voile.querySelector('.gf-modale-corps'), rootMargin: '220px' });
      cartes.forEach(function (c) { if (c.hote) guetteur.observe(c.hote); });
    } else {
      cartes.forEach(poserVignette);
    }
    /* Une carte de l'onglet caché n'est jamais « à l'écran » : le guetteur
       ne la voit pas, et une recherche qui la révèle la laissait avec son
       schéma de barres. On rattrape après chaque filtrage. */
    function rattraperVignettes() {
      var n = 0;
      cartes.forEach(function (c) {
        if (n >= 24 || c.el.hidden || !c.hote || c.hote.getAttribute('data-pose') === '1') return;
        if (!c.hote.clientWidth) return;
        poserVignette(c); n++;
      });
    }

    /* ---- l'aperçu en grand, au survol : UN seul cadre pour toutes ---- */
    var grande = document.createElement('div');
    grande.className = 'gf-vue-grande';
    grande.hidden = true;
    voile.appendChild(grande);
    var minuteurVue = null, carteVue = null;
    function cacherGrande() {
      clearTimeout(minuteurVue); carteVue = null;
      grande.hidden = true; grande.innerHTML = '';
    }
    function montrerGrande(c) {
      if (carteVue === c.el) return;
      carteVue = c.el;
      grande.innerHTML = '';
      grande.hidden = false;
      var boite = document.createElement('div');
      boite.className = 'gf-vue-boite';
      grande.appendChild(boite);
      var L = 330;
      boite.style.width = L + 'px';
      boite.style.height = Math.round(L * 297 / 210) + 'px';
      poserApercu(boite, c.m, c.d, L, true);
      var r = c.el.getBoundingClientRect(), rv = voile.getBoundingClientRect();
      var x = r.right + 12, H = Math.round(L * 297 / 210);
      if (x + L + 12 > rv.right) x = r.left - L - 12;
      if (x < rv.left + 8) x = Math.max(rv.left + 8, Math.min(r.left, rv.right - L - 8));
      grande.style.left = Math.round(x) + 'px';
      grande.style.top = Math.round(Math.max(rv.top + 8, Math.min(r.top, rv.bottom - H - 8))) + 'px';
    }
    cartes.forEach(function (c) {
      var ouvrir = c.el.querySelector('.gf-carte-ouvrir') || c.el;
      function entrer() { clearTimeout(minuteurVue); minuteurVue = setTimeout(function () { montrerGrande(c); }, 260); }
      c.el.addEventListener('mouseenter', entrer);
      ouvrir.addEventListener('focus', entrer);
      c.el.addEventListener('mouseleave', cacherGrande);
      ouvrir.addEventListener('blur', cacherGrande);
    });

    function fermer() { cacherGrande(); if (guetteur) guetteur.disconnect(); if (voile.parentNode) voile.remove(); }
    voile.querySelector('[data-x]').addEventListener('click', fermer);

    /* ---- la recherche ---- */
    var champ = voile.querySelector('#gf-nouveau-q');
    var rien = voile.querySelector('.gf-rien');
    var onglets = voile.querySelector('.gf-onglets');
    function filtrer() {
      var q = cleRecherche(champ.value);
      var mots = q ? q.split(' ') : [];
      voile.classList.toggle('gf-en-recherche', !!mots.length);
      var vus = 0;
      cartes.forEach(function (c) {
        var texte = c.el.getAttribute('data-q') || '';
        var ok = mots.every(function (w) { return texte.indexOf(w) >= 0; });
        c.el.hidden = !ok;
        if (ok) vus++;
      });
      /* une famille dont toutes les cartes sont masquées disparaît aussi,
         sinon la liste garde des titres qui ne mènent à rien */
      voile.querySelectorAll('.gf-fam').forEach(function (f) {
        f.hidden = !!mots.length && !f.querySelector('.gf-carte:not([hidden])');
      });
      /* en recherche, les deux onglets s'affichent d'un coup : c'est ce
         qu'on veut quand on cherche « maire » sans savoir où il est */
      voile.querySelectorAll('[data-page]').forEach(function (p) {
        p.hidden = mots.length ? !p.querySelector('.gf-carte:not([hidden])')
          : p.getAttribute('data-page') !== (voile.querySelector('.gf-onglet.is-actif') || {}).getAttribute('data-onglet');
      });
      if (onglets) onglets.hidden = !!mots.length;
      rien.hidden = !(mots.length && !vus);
      cacherGrande();
      setTimeout(rattraperVignettes, 0);
    }
    champ.addEventListener('input', filtrer);
    setTimeout(function () { try { champ.focus(); } catch (e) {} }, 60);

    voile.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      e.preventDefault(); e.stopPropagation();
      /* Échap efface d'abord la recherche : on ne perd pas la modale
         parce qu'on voulait juste repartir de la liste entière */
      if (champ.value) { champ.value = ''; filtrer(); champ.focus(); return; }
      fermer();
    });
    voile.querySelectorAll('.gf-onglet').forEach(function (o) {
      o.addEventListener('click', function () {
        voile.querySelectorAll('.gf-onglet').forEach(function (x) { x.classList.toggle('is-actif', x === o); });
        voile.querySelectorAll('[data-page]').forEach(function (p) { p.hidden = p.getAttribute('data-page') !== o.getAttribute('data-onglet'); });
        setTimeout(rattraperVignettes, 0);
      });
    });
    if (onglet === 'prereglages') voile.querySelector('[data-onglet="prereglages"]').click();
    voile.querySelectorAll('[data-modele]').forEach(function (b) {
      b.addEventListener('click', function () { fermer(); nouvelActe(b.getAttribute('data-modele')); });
    });
    voile.querySelectorAll('.gf-carte-pre').forEach(function (c) {
      var p = pres[+c.getAttribute('data-pre')];
      c.querySelector('.gf-carte-ouvrir').addEventListener('click', function () {
        if (!G.modeles[p.modele]) { dire('Modèle « ' + p.modele + ' » introuvable.', 'erreur'); return; }
        fermer(); nouvelActe(p.modele, p);
      });
      var ex = c.querySelector('[data-exporter]');
      if (ex) ex.addEventListener('click', function () { exporterPrereglage(p); });
      var ret = c.querySelector('[data-retirer]');
      if (ret) ret.addEventListener('click', function () {
        dbOter(MAG_PRE, p.id).then(function () {
          prereglages = prereglages.filter(function (q) { return q.id !== p.id; });
          fermer(); ouvrirNouveau('prereglages'); dire('Préréglage retiré', 'ok');
        });
      });
    });
    var depot = voile.querySelector('#gf-pre-fichier');
    if (depot) depot.addEventListener('change', function () {
      deposerPrereglages(depot.files); depot.value = '';
      setTimeout(function () { fermer(); ouvrirNouveau('prereglages'); }, 600);
    });
    var premier = voile.querySelector('[data-modele]');
    if (premier) premier.focus();
  }

  /* ---- le registre : chercher, filtrer, ouvrir ---- */
  var registreFiltre = 'tous', registreRecherche = '', registreDossier = 'tous', registreCoches = [];
  function dossierDe(id) { return id ? dossiers.filter(function (d) { return d.id === id; })[0] || null : null; }
  function nomDossier(id) { var d = dossierDe(id); return d ? d.nom : ''; }
  function actesDuDossier(id) { return registre.filter(function (a) { return (a.dossier || null) === id; }); }
  function poserDossier(d) { d.maj = Date.now(); return dbPoser(MAG_DOS, d).then(function () { dossiers = dossiers.filter(function (x) { return x.id !== d.id; }); dossiers.unshift(d); if (canal) { try { canal.postMessage({ quoi: 'dossiers' }); } catch (e) {} } }); }
  function creerDossier(nom, note) {
    nom = String(nom || '').trim(); if (!nom) return Promise.resolve(null);
    var deja = dossiers.filter(function (d) { return d.nom.toLowerCase() === nom.toLowerCase(); })[0];
    if (deja) return Promise.resolve(deja);
    var d = { id: identifiant(), nom: nom, note: String(note || ''), maj: Date.now() };
    return poserDossier(d).then(function () { return d; });
  }
  /* ranger des actes dans un dossier (null : les sortir) ; l'acte ouvert suit s'il en fait partie */
  function rangerActes(fiches, idDossier) {
    var p = Promise.resolve(), nom = nomDossier(idDossier);
    fiches.forEach(function (f) {
      if ((f.dossier || null) === (idDossier || null)) return;
      f.dossier = idDossier || null; f.maj = Date.now();
      (f.journal = f.journal || []).push({ t: Date.now(), quoi: idDossier ? 'Rangé dans le dossier « ' + nom + ' »' : 'Sorti de son dossier' });
      if (f.id === acteId) { acteDossier = f.dossier; acteJournal = f.journal; }
      p = p.then(function () { return dbPoser(MAG_ACTES, f); });
    });
    if (idDossier) { var d = dossierDe(idDossier); if (d) p = p.then(function () { return poserDossier(d); }); }
    return p;
  }
  /* la boîte : choisir un dossier, en créer un, ou sortir l'acte */
  function choisirDossier(fiches, titre) {
    return new Promise(function (res) {
      var courant = fiches.length === 1 ? (fiches[0].dossier || null) : null;
      var liste = dossiers.slice().sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); });
      var voile = document.createElement('div');
      voile.className = 'gf-voile';
      voile.innerHTML = '<div class="gf-modale gf-modale-courte" role="dialog" aria-modal="true">'
        + '<header class="gf-modale-top"><h3>' + ech(titre || 'Ranger dans un dossier') + '</h3><button type="button" class="gf-ico gf-ico-close" data-x aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></header>'
        + '<div class="gf-modale-corps"><p class="gf-modale-aide">' + (fiches.length > 1 ? fiches.length + ' actes' : '<b>' + ech(fiches[0].intitule || fiches[0].nom) + (fiches[0].numero ? ' · ' + ech(fiches[0].numero) : '') + '</b>') + ' · un acte est dans un dossier au plus.</p>'
        + '<div class="gf-dos-liste">'
        + '<label class="gf-dos-choix"><input type="radio" name="gf-dos" value=""' + (courant ? '' : ' checked') + '><span>Sans dossier</span></label>'
        + liste.map(function (d) { return '<label class="gf-dos-choix"><input type="radio" name="gf-dos" value="' + ech(d.id) + '"' + (d.id === courant ? ' checked' : '') + '><span>' + ech(d.nom) + '</span><small>' + actesDuDossier(d.id).length + '</small></label>'; }).join('')
        + '</div>'
        + '<label class="gf-champ" style="margin-top:12px"><span>Ou un nouveau dossier</span><input class="gf-in" type="text" data-neuf placeholder="Saison 2026-2027, Tournoi de Thiès, Dossier Awa Diop…"></label></div>'
        + '<footer class="gf-modale-pied"><button type="button" class="gf-btn gf-btn-fant" data-x>Annuler</button><button type="button" class="gf-btn gf-btn-accent" data-oui>Ranger</button></footer></div>';
      function fin(v) { if (voile.parentNode) voile.remove(); res(v); }
      voile.querySelectorAll('[data-x]').forEach(function (b) { b.addEventListener('click', function () { fin(null); }); });
      voile.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fin(null); } if (e.key === 'Enter' && e.target === neuf) { e.preventDefault(); valider(); } });
      var neuf = voile.querySelector('[data-neuf]');
      function valider() {
        var nomNeuf = neuf.value.trim();
        var choix = voile.querySelector('input[name="gf-dos"]:checked');
        var p = nomNeuf ? creerDossier(nomNeuf) : Promise.resolve(choix && choix.value ? dossierDe(choix.value) : null);
        p.then(function (d) { return rangerActes(fiches, d ? d.id : null).then(function () { fin(d || { id: null }); }); });
      }
      voile.querySelector('[data-oui]').addEventListener('click', valider);
      racine.appendChild(voile);
      (liste.length ? voile.querySelector('input[name="gf-dos"]:checked') || neuf : neuf).focus();
    });
  }
  function rangerActeCourant() {
    if (!modeleActif) return;
    var f = acteId ? registre.filter(function (a) { return a.id === acteId; })[0] : null;
    /* un acte jamais enregistré : on l'enregistre d'abord, il faut une fiche au registre */
    var p = f ? Promise.resolve(f) : enregistrer(true).then(function () { return registre.filter(function (a) { return a.id === acteId; })[0]; });
    p.then(function (fiche) {
      if (!fiche) return;
      return choisirDossier([fiche], 'Ranger cet acte').then(function (d) {
        if (!d) return;
        majTitreBarre(); if (typeof peindreProps === 'function') peindreProps();
        dire(d.id ? 'Rangé dans « ' + d.nom + ' »' : 'Sorti de son dossier', 'ok');
      });
    });
  }
  function renommerDossier(d) {
    demander('Renommer le dossier', 'Le nom que verront le registre et les actes ({{acte.dossier}}).', d.nom).then(function (nom) {
      if (!nom || nom === d.nom) return;
      d.nom = nom; poserDossier(d).then(function () { peindreRegistre(); dire('Dossier renommé', 'ok'); });
    });
  }
  function noterDossier(d) {
    demander('Note du dossier', 'Ce qu\'il faut savoir en l\'ouvrant : l\'affaire, la personne, la période.', d.note || '').then(function (note) {
      if (note == null) return;
      d.note = note; poserDossier(d).then(function () { peindreRegistre(); });
    });
  }
  function supprimerDossier(d) {
    var n = actesDuDossier(d.id).length;
    confirmer('Supprimer ce dossier ?', '<p class="gf-modale-aide"><b>' + ech(d.nom) + '</b> disparaît ; ' + (n ? 'ses ' + n + ' acte' + (n > 1 ? 's' : '') + ' restent au registre, sans dossier.' : 'il est vide.') + '</p>', 'Supprimer').then(function (oui) {
      if (!oui) return;
      rangerActes(actesDuDossier(d.id), null).then(function () { return dbOter(MAG_DOS, d.id); }).then(function () {
        dossiers = dossiers.filter(function (x) { return x.id !== d.id; });
        if (registreDossier === d.id) registreDossier = 'tous';
        peindreRegistre(); dire('Dossier supprimé', 'ok');
      });
    });
  }
  function peindreRegistre() {
    var hote = elt.registre;
    if (!hote) return;
    var q = registreRecherche.trim().toLowerCase();
    var normal = function (s) { return String(s || '').toLowerCase(); };
    var liste = registre.filter(function (a) {
      var e = a.etat || 'brouillon';
      if (registreFiltre === 'archive') { if (e !== 'archive') return false; }
      else if (e === 'archive') return false;
      else if (registreFiltre !== 'tous' && e !== registreFiltre) return false;
      if (registreDossier === 'aucun') { if (a.dossier && dossierDe(a.dossier)) return false; }
      else if (registreDossier !== 'tous' && (a.dossier || null) !== registreDossier) return false;
      if (!q) return true;
      /* la recherche va jusque dans la donnée : un nom de joueuse, une ville */
      var corps = normal(a.intitule) + ' ' + normal(a.nom) + ' ' + normal(a.numero) + ' ' + normal(a.date) + ' ' + normal(JSON.stringify(a.donnees || {}));
      return q.split(/\s+/).every(function (mot) { return corps.indexOf(mot) !== -1; });
    });
    var compte = {};
    registre.forEach(function (a) { var e = a.etat || 'brouillon'; compte[e] = (compte[e] || 0) + 1; });
    var filtres = [['tous', 'Tous'], ['brouillon', 'Brouillons'], ['emis', 'Émis'], ['remplace', 'Remplacés'], ['annule', 'Annulés'], ['archive', 'Archivés']];
    registreCoches = registreCoches.filter(function (id) { return registre.some(function (a) { return a.id === id; }); });
    var dosCourant = dossierDe(registreDossier);
    var sansDossier = registre.filter(function (a) { return !a.dossier || !dossierDe(a.dossier); }).length;
    var dosTries = dossiers.slice().sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); });
    var htmlDossiers = '<div class="gf-puces gf-reg-dossiers"><span class="gf-lab">Dossiers</span>'
      + '<button type="button" class="gf-puce' + (registreDossier === 'tous' ? ' is-actif' : '') + '" data-dossier="tous">Tous</button>'
      + '<button type="button" class="gf-puce' + (registreDossier === 'aucun' ? ' is-actif' : '') + '" data-dossier="aucun">Sans dossier <span class="gf-compte">' + sansDossier + '</span></button>'
      + dosTries.map(function (d) { return '<button type="button" class="gf-puce' + (registreDossier === d.id ? ' is-actif' : '') + '" data-dossier="' + ech(d.id) + '">' + ech(d.nom) + ' <span class="gf-compte">' + actesDuDossier(d.id).length + '</span></button>'; }).join('')
      + '<button type="button" class="gf-puce gf-puce-plus" data-dossier-neuf title="Nouveau dossier">+ Dossier</button></div>'
      + (dosCourant ? '<div class="gf-dos-tete"><div class="gf-dos-nom"><b>' + ech(dosCourant.nom) + '</b>' + (dosCourant.note ? '<span>' + ech(dosCourant.note) + '</span>' : '<span class="gf-dos-vide">Sans note</span>') + '</div>'
        + '<div class="gf-dos-actions"><button type="button" class="gf-mini" data-dos-nouvel>Nouvel acte ici</button><button type="button" class="gf-mini" data-dos-imprimer' + (actesDuDossier(dosCourant.id).length ? '' : ' disabled') + '>Tout imprimer en un PDF</button><button type="button" class="gf-mini" data-dos-renommer>Renommer</button><button type="button" class="gf-mini" data-dos-note>Note</button><button type="button" class="gf-mini gf-mini-danger" data-dos-supprimer>Supprimer le dossier</button></div></div>' : '');
    var htmlCoches = registreCoches.length ? '<div class="gf-reg-coches"><b>' + registreCoches.length + ' acte' + (registreCoches.length > 1 ? 's' : '') + ' coché' + (registreCoches.length > 1 ? 's' : '') + '</b>'
      + '<button type="button" class="gf-mini" data-coches-ranger>Ranger dans un dossier</button><button type="button" class="gf-mini" data-coches-imprimer>Imprimer ensemble</button><button type="button" class="gf-mini" data-coches-rien>Tout décocher</button></div>' : '';

    hote.innerHTML =
      '<div class="gf-acc-carte">'
      + '<div class="gf-reg-tete"><h2 class="gf-acc-titre">Le registre</h2>'
      + '<input class="gf-in gf-reg-recherche" id="gf-reg-recherche" type="search" placeholder="Rechercher : un numéro, un nom, une ville, un objet…" value="' + ech(registreRecherche) + '"></div>'
      + '<div class="gf-puces gf-reg-filtres">' + filtres.map(function (f) {
          var n = f[0] === 'tous' ? registre.filter(function (a) { return (a.etat || 'brouillon') !== 'archive'; }).length : (compte[f[0]] || 0);
          return '<button type="button" class="gf-puce' + (registreFiltre === f[0] ? ' is-actif' : '') + '" data-filtre="' + f[0] + '">' + f[1] + ' <span class="gf-compte">' + n + '</span></button>';
        }).join('') + '</div>'
      + htmlDossiers + htmlCoches
      + (liste.length
          ? '<div class="gf-reg-table">' + liste.map(function (a) {
              var e = a.etat || 'brouillon';
              return '<div class="gf-reg-ligne' + (registreCoches.indexOf(a.id) !== -1 ? ' is-coche' : '') + '"><div class="gf-reg-rang"><input type="checkbox" class="gf-reg-coche" data-coche="' + ech(a.id) + '"' + (registreCoches.indexOf(a.id) !== -1 ? ' checked' : '') + ' title="Cocher pour agir sur plusieurs actes">' + ligneActe(a) + '</div>'
                + '<div class="gf-reg-actions">'
                + '<button type="button" class="gf-mini" data-ranger="' + ech(a.id) + '">' + (a.dossier && dossierDe(a.dossier) ? 'Dossier : ' + ech(nomDossier(a.dossier)) : 'Ranger dans un dossier') + '</button>'
                + '<button type="button" class="gf-mini" data-histo="' + ech(a.id) + '">Historique</button>'
                + '<button type="button" class="gf-mini" data-fenetre="' + ech(a.id) + '" title="Ouvrir cet acte dans une nouvelle fenêtre">Nouvelle fenêtre</button>'
                + (e === 'emis' ? '<button type="button" class="gf-mini" data-version="' + ech(a.id) + '">Nouvelle version</button>' : '')
                + ((a.versions || []).length && a.version > 1 ? '<button type="button" class="gf-mini" data-comparer-acte="' + ech(a.id) + '">Comparer les versions</button>' : '')
                + (e === 'emis' ? '<button type="button" class="gf-mini" data-archiver="' + ech(a.id) + '">Archiver</button>' : '')
                + (e === 'archive' ? '<button type="button" class="gf-mini" data-desarchiver="' + ech(a.id) + '">Sortir des archives</button>' : '')
                + (e === 'brouillon' || e === 'emis' ? '<button type="button" class="gf-mini" data-annuler="' + ech(a.id) + '">Annuler l\'acte</button>' : '')
                + (e === 'brouillon' ? '<button type="button" class="gf-mini gf-mini-danger" data-retirer="' + ech(a.id) + '">Retirer</button>' : '')
                + '</div></div>';
            }).join('') + '</div>'
          : '<p class="gf-vide">' + (q ? 'Rien ne correspond à « ' + ech(registreRecherche) + ' ».' : 'Aucun acte ici.') + '</p>')
      + '</div>';

    var rech = $('gf-reg-recherche');
    rech.addEventListener('input', function () { registreRecherche = rech.value; peindreRegistre(); var r2 = $('gf-reg-recherche'); r2.focus(); r2.setSelectionRange(r2.value.length, r2.value.length); });
    hote.querySelectorAll('[data-filtre]').forEach(function (b) {
      b.addEventListener('click', function () { registreFiltre = b.getAttribute('data-filtre'); peindreRegistre(); });
    });
    hote.querySelectorAll('[data-dossier]').forEach(function (b) {
      b.addEventListener('click', function () { registreDossier = b.getAttribute('data-dossier'); peindreRegistre(); });
    });
    var bNeuf = hote.querySelector('[data-dossier-neuf]');
    if (bNeuf) bNeuf.addEventListener('click', function () {
      demander('Nouveau dossier', 'Une affaire, une personne, une saison : les actes s\'y rangent depuis leur ligne ou en les cochant.', '').then(function (nom) {
        if (!nom) return; creerDossier(nom).then(function (d) { registreDossier = d.id; peindreRegistre(); dire('Dossier « ' + d.nom + ' » créé', 'ok'); });
      });
    });
    if (dosCourant) {
      hote.querySelector('[data-dos-nouvel]').addEventListener('click', function () { ouvrirNouveau(); });
      hote.querySelector('[data-dos-imprimer]').addEventListener('click', function () { imprimerSerie(actesDuDossier(dosCourant.id).map(function (a) { return a.id; })); });
      hote.querySelector('[data-dos-renommer]').addEventListener('click', function () { renommerDossier(dosCourant); });
      hote.querySelector('[data-dos-note]').addEventListener('click', function () { noterDossier(dosCourant); });
      hote.querySelector('[data-dos-supprimer]').addEventListener('click', function () { supprimerDossier(dosCourant); });
    }
    hote.querySelectorAll('[data-coche]').forEach(function (c) {
      c.addEventListener('change', function () {
        var id = c.getAttribute('data-coche');
        registreCoches = registreCoches.filter(function (x) { return x !== id; }); if (c.checked) registreCoches.push(id);
        peindreRegistre();
      });
    });
    var bCR = hote.querySelector('[data-coches-ranger]');
    if (bCR) bCR.addEventListener('click', function () {
      var fs = registreCoches.map(fiche).filter(Boolean);
      choisirDossier(fs, 'Ranger ' + fs.length + ' actes').then(function (d) { if (!d) return; registreCoches = []; peindreRegistre(); dire(d.id ? fs.length + ' actes rangés dans « ' + d.nom + ' »' : fs.length + ' actes sortis de leur dossier', 'ok'); });
    });
    var bCI = hote.querySelector('[data-coches-imprimer]');
    if (bCI) bCI.addEventListener('click', function () { imprimerSerie(registreCoches.slice()); });
    var bCN = hote.querySelector('[data-coches-rien]');
    if (bCN) bCN.addEventListener('click', function () { registreCoches = []; peindreRegistre(); });
    brancherLignesActes(hote);
    function fiche(id) { return registre.filter(function (a) { return a.id === id; })[0]; }
    function avecFiche(attr, fn) {
      hote.querySelectorAll('[' + attr + ']').forEach(function (b) {
        b.addEventListener('click', function () { var f = fiche(b.getAttribute(attr)); if (f) fn(f); });
      });
    }
    avecFiche('data-histo', function (f) { historiqueActe(f); });
    avecFiche('data-comparer-acte', function (f) { comparerVersions(f); });
    avecFiche('data-ranger', function (f) { choisirDossier([f], 'Ranger cet acte').then(function (d) { if (!d) return; peindreRegistre(); dire(d.id ? 'Rangé dans « ' + d.nom + ' »' : 'Sorti de son dossier', 'ok'); }); });
    avecFiche('data-retirer-onglet', function (f) { fermerOnglet(f.id); });
    avecFiche('data-fenetre', function (f) { nouvelleFenetre(f.id); });
    avecFiche('data-version', function (f) { ouvrirActe(f); setTimeout(nouvelleVersion, 400); });
    avecFiche('data-archiver', function (f) { f.etat = 'archive'; (f.journal = f.journal || []).push({ t: Date.now(), quoi: 'Archivé' }); f.maj = Date.now(); dbPoser(MAG_ACTES, f).then(peindreRegistre); });
    avecFiche('data-desarchiver', function (f) { f.etat = 'emis'; (f.journal = f.journal || []).push({ t: Date.now(), quoi: 'Sorti des archives' }); f.maj = Date.now(); dbPoser(MAG_ACTES, f).then(peindreRegistre); });
    avecFiche('data-annuler', function (f) {
      demander('Annuler cet acte', 'Le motif, pour le registre. Le numéro ' + (f.numero || '') + ' reste pris.', 'Erreur de rédaction').then(function (motif) {
        if (motif == null) return;
        f.etat = 'annule'; f.motif = motif; (f.journal = f.journal || []).push({ t: Date.now(), quoi: 'Annulé' + (motif ? ' : ' + motif : '') }); f.maj = Date.now();
        dbPoser(MAG_ACTES, f).then(function () { peindreRegistre(); dire('Acte annulé', 'ok'); });
      });
    });
    avecFiche('data-retirer', function (f) {
      confirmer('Retirer ce brouillon ?', '<p class="gf-modale-aide"><b>' + ech(f.intitule || f.nom) + (f.numero ? ' · ' + ech(f.numero) : '') + '</b> sera retiré du registre. Son numéro reste pris.</p>', 'Retirer').then(function (oui) {
        if (!oui) return;
        dbOter(MAG_ACTES, f.id).then(function () {
          registre = registre.filter(function (a) { return a.id !== f.id; });
          peindreRegistre(); dire('Brouillon retiré', 'ok');
        });
      });
    });
  }

  /* ---- les paramètres : la carte de sauvegarde ---- */
  function peindreIdentite() {
    var hote = $('gf-param-club');
    if (!hote) return;
    var C = G.club || CLUB_DEFAUT;
    hote.innerHTML =
      '<h2 class="gf-pol-titre">L\'identité du club</h2>'
      + '<p class="gf-pol-intro">Ce que les actes disent du club : le nom, le président qui signe, l\'adresse, le récépissé. Changez-les ici, tous les modèles suivent. '
      + 'Dans un texte, tapez <code>{{club.president}}</code>, <code>{{acte.numero}}</code>, <code>{{aujourdhui}}</code> ou <code>{{total.membres}}</code> : la feuille écrit la valeur, la donnée garde la variable.</p>'
      + '<div class="gf-grille2">' + CLUB_CHAMPS.map(function (c) {
          return '<label class="gf-champ"><span>' + ech(c[1]) + '</span><input class="gf-in" type="text" data-club="' + c[0] + '" value="' + ech(C[c[0]] || '') + '"></label>';
        }).join('') + '</div>'
      + '<div class="gf-pol-pied"><button type="button" class="gf-btn gf-btn-accent" id="gf-club-garder">Enregistrer l\'identité</button>'
      + '<button type="button" class="gf-btn gf-btn-fant" id="gf-club-defaut">Revenir aux valeurs d\'origine</button></div>';
    $('gf-club-garder').addEventListener('click', function () {
      var v = {};
      hote.querySelectorAll('[data-club]').forEach(function (i) { v[i.getAttribute('data-club')] = i.value.trim(); });
      G.club = Object.assign({}, CLUB_DEFAUT, v);
      dbPoser(MAG_REG, { cle: 'club', valeur: G.club }).then(function () {
        dire('Identité du club enregistrée', 'ok');
        if (modeleActif) { cadrePret = false; }
      }).catch(function (e) { dire('Enregistrement impossible : ' + (e && e.message ? e.message : e), 'erreur'); });
    });
    $('gf-club-defaut').addEventListener('click', function () {
      G.club = Object.assign({}, CLUB_DEFAUT);
      dbOter(MAG_REG, 'club').then(function () { peindreIdentite(); dire('Identité d\'origine', 'ok'); if (modeleActif) cadrePret = false; });
    });
  }

  function peindreParametres() {
    peindreListeRessources();
    peindreIdentite();
    var hote = $('gf-param-sauvegarde');
    if (!hote) return;
    hote.innerHTML =
      '<h2 class="gf-pol-titre">La sauvegarde</h2>'
      + '<p class="gf-pol-intro">Le registre vit dans ce navigateur : un profil réinitialisé, un disque perdu, un poste changé, et tout s\'en va. '
      + 'Un fichier de sauvegarde le met à l\'abri et le fait passer d\'un poste à l\'autre. Il ne contient jamais le cachet ni les polices : ils se redéposent.</p>'
      + '<div class="gf-sauvegarde"><button type="button" class="gf-btn gf-btn-accent" id="gf-sauver">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M6 9l6-6 6 6M4 21h16"/></svg>'
      + 'Sauvegarder le Greffe <kbd>Ctrl+Maj+S</kbd></button>'
      + '<label class="gf-btn gf-btn-fant" for="gf-restaurer">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9M6 15l6 6 6-6M4 3h16"/></svg>'
      + 'Restaurer une sauvegarde</label><input type="file" id="gf-restaurer" accept=".json,.greffe,application/json" hidden>'
      + '<p class="gf-aide">' + registre.length + ' acte' + (registre.length > 1 ? 's' : '') + ' et ' + prereglages.length + ' préréglage' + (prereglages.length > 1 ? 's' : '') + ' sur ce poste.</p></div>';
    $('gf-sauver').addEventListener('click', sauvegarderGreffe);
    var rest = $('gf-restaurer');
    rest.addEventListener('change', function () { restaurerGreffe(rest.files && rest.files[0]); rest.value = ''; });
  }

  /* =================================================================
     6 quater. LA BARRE DE MENUS, L'ÉTAT DE L'ACTE, LE BOUTON PRINCIPAL
     ================================================================= */
  function menus() {
    var libre = !!(modeleActif && modeleActif.libre);
    var lect = lectureSeule();
    var enAtelier = !!modeleActif && espace === 'atelier';
    return [
      { nom: 'Fichier', items: [
        { lab: 'Nouvel acte…', rac: 'Alt+N', act: function () { ouvrirNouveau(); } },
        { lab: 'Ouvrir le registre', rac: 'Ctrl+O', act: function () { montrer('registre'); } },
        { lab: 'Ouvrir dans une nouvelle fenêtre', rac: 'Alt+Maj+N', act: function () { nouvelleFenetre(); } },
        { sep: true },
        { lab: 'Enregistrer', rac: 'Ctrl+S', off: !enAtelier, act: function () { enregistrer(false); } },
        { lab: 'Renommer l\'acte…', rac: 'F2', off: !enAtelier || lect, act: renommerActe },
        { lab: 'Garder comme préréglage…', off: !enAtelier, act: garderPrereglage },
        { lab: 'Série depuis une liste…', off: !enAtelier || lect, act: ouvrirSerie },
        { lab: 'Fichier source (sans cachet)', off: !enAtelier, act: exporterHtml },
        { lab: 'Imprimer en PDF', rac: 'Ctrl+P', off: !enAtelier, act: imprimer },
        { sep: true },
        { lab: 'Sauvegarder le Greffe', rac: 'Ctrl+Maj+S', act: sauvegarderGreffe },
        { lab: 'Restaurer une sauvegarde…', act: function () { montrer('parametres'); } },
        { sep: true },
        { lab: 'Fermer l\'acte', off: !enAtelier, act: function () { fermerActe(); } }
      ]},
      { nom: 'Édition', items: [
        { lab: 'Annuler', rac: 'Ctrl+Z', off: !enAtelier || histoI <= 0, act: annuler },
        { lab: 'Rétablir', rac: 'Ctrl+Y', off: !enAtelier || histoI >= histo.length - 1, act: retablir },
        { sep: true },
        { lab: 'Copier l\'objet ou le bloc', rac: 'Ctrl+C', off: !enAtelier || !(objetSel || blocCourant), act: copierElement },
        { lab: 'Coller', rac: 'Ctrl+V', off: !enAtelier || lect, act: collerElement },
        { sep: true },
        { lab: 'Tous les objets de la page', rac: 'Ctrl+A', off: !enAtelier || lect, act: selectionnerTout },
        { lab: 'Aligner et répartir…', off: !enAtelier || lect || objetsSel.length < 2, act: function () { propsOnglet = 'proprietes'; ouvrirProps(true); peindreProps(); } },
        { sep: true },
        { lab: 'Textes d\'origine du modèle', off: !enAtelier || lect, act: textesOrigine }
      ]},
      { nom: 'Acte', items: [
        { lab: 'Informations…', off: !enAtelier, act: informationsActe },
        { lab: 'Historique…', off: !enAtelier, act: function () { historiqueActe(); } },
        { lab: 'Comparer deux versions…', off: !enAtelier || !acteVersions.length, act: function () { comparerVersions(); } },
        { lab: (acteDossier && dossierDe(acteDossier) ? 'Dossier : ' + nomDossier(acteDossier) + '…' : 'Ranger dans un dossier…'), off: !enAtelier, act: rangerActeCourant },
        { sep: true },
        { lab: 'Vérifier', rac: 'Ctrl+Entrée', off: !enAtelier || lect, act: verifier },
        { lab: 'Émettre…', rac: 'Ctrl+Maj+E', off: !enAtelier || lect, act: emettreActe },
        { lab: 'Nouvelle version…', off: !enAtelier || acteEtat !== 'emis', act: nouvelleVersion },
        { sep: true },
        { lab: 'Archiver', off: !enAtelier || acteEtat !== 'emis', act: archiverActe },
        { lab: 'Sortir des archives', off: !enAtelier || acteEtat !== 'archive', act: desarchiverActe },
        { lab: 'Annuler l\'acte…', off: !enAtelier || acteEtat === 'annule', act: annulerActe }
      ]},
      { nom: 'Insertion', items: [
        { lab: 'Signature posée', off: !enAtelier || lect, act: function () { poserObjet('signature'); } },
        { lab: 'Cachet posé', off: !enAtelier || lect, act: function () { poserObjet('cachet'); } },
        { lab: 'Image…', off: !enAtelier || lect, act: poserImageObjet },
        { lab: 'Annotation', off: !enAtelier || lect, act: function () { poserObjet('annotation'); } },
        { lab: 'Cadre', off: !enAtelier || lect, act: function () { poserObjet('cadre'); } },
        { lab: 'Rond', off: !enAtelier || lect, act: function () { poserObjet('ellipse'); } },
        { lab: 'Trait', off: !enAtelier || lect, act: function () { poserObjet('ligne'); } },
        { lab: 'Flèche', off: !enAtelier || lect, act: function () { poserObjet('fleche'); } },
        { lab: 'Surligneur', off: !enAtelier || lect, act: function () { poserObjet('surligneur'); } },
        { lab: 'Case à cocher', off: !enAtelier || lect, act: function () { poserObjet('case'); } },
        { lab: 'Variable…', off: !enAtelier || lect, act: insererVariable },
        { sep: true }
      ].concat(libre && !lect && modeleActif.catalogue
          ? modeleActif.catalogue.map(function (e) { return { lab: 'Bloc : ' + e.nom, act: function () { poserBloc(e); } }; })
          : [{ lab: 'Les blocs se posent dans un acte libre', off: true }]) },
      { nom: 'Fenêtre', items: [
        { lab: 'Nouvel onglet : nouvel acte…', rac: 'Alt+N', act: function () { ouvrirNouveau(); } },
        { lab: 'Ouvrir cet acte dans une nouvelle fenêtre du navigateur', rac: 'Alt+Maj+N', off: !modeleActif, act: function () { nouvelleFenetre(); } },
        { lab: 'Ouvrir le Greffe dans une nouvelle fenêtre du navigateur', act: function () { nouvelleFenetre('accueil'); } },
        { sep: true }
      ].concat(onglets.map(function (o, i) {
        return { lab: (o.id === ongletCourant ? '● ' : '') + o.nom, rac: i < 9 ? 'Alt+' + (i + 1) : '', act: function () { activerOnglet(o.id); } };
      })).concat([{ sep: true },
        { lab: 'Fermer cet onglet', rac: 'Alt+W', off: !modeleActif, act: function () { fermerActe(); } },
        { lab: 'Fermer les autres onglets', off: onglets.length < 2, act: function () { fermerOnglets(true); } },
        { lab: 'Fermer tous les onglets', off: !onglets.length, act: function () { fermerOnglets(false); } }]) },
      { nom: 'Affichage', items: [
        { lab: 'Zoom avant', rac: 'Ctrl+Plus', off: !enAtelier, act: function () { zoom = Math.min(1.5, zoom + 0.1); appliquerZoom(); } },
        { lab: 'Zoom arrière', rac: 'Ctrl+Moins', off: !enAtelier, act: function () { zoom = Math.max(0.25, zoom - 0.1); appliquerZoom(); } },
        { lab: 'Taille réelle', rac: 'Ctrl+0', off: !enAtelier, act: function () { zoomer(1); } },
        { lab: 'Ajuster à la largeur', off: !enAtelier, act: function () { zoomer('largeur'); } },
        { lab: 'Page entière', off: !enAtelier, act: function () { zoomer('page'); } },
        { sep: true },
        { lab: (racine.classList.contains('gf-sans-panneau') ? 'Montrer' : 'Masquer') + ' le panneau', rac: 'Ctrl+Maj+P', off: !enAtelier, act: basculerPanneau },
        { lab: (apercuReplie ? 'Rouvrir' : 'Replier') + ' l\'aperçu', off: !enAtelier, act: basculerApercu },
        { lab: (propsOuvert() ? 'Fermer' : 'Rouvrir') + ' le panneau de droite', off: !enAtelier, act: basculerProps },
        { lab: (outilMain ? 'Quitter l\'outil' : 'Outil') + ' main (glisser la feuille)', rac: 'H · Espace tenue', off: !enAtelier, act: function () { mainActiver(!outilMain); } },
        { lab: (outilZoom ? 'Quitter la' : 'Outil') + ' loupe', rac: 'Z', off: !enAtelier, act: function () { zoomActiver(!outilZoom); } },
        { lab: (railPlie ? 'Ouvrir' : 'Replier') + ' la barre d\'outils', off: !enAtelier, act: function () { railPlie = !railPlie; try { localStorage.setItem(CLE_RAIL, railPlie ? '1' : '0'); } catch (e) {} peindreRail(); remesurer(); } },
        { lab: 'À quoi sert chaque outil…', act: aideOutils },
        { sep: true },
        { lab: (filigraneVisible() ? 'Retirer' : 'Remettre') + ' le filigrane BROUILLON', off: !enAtelier || acteEtat !== 'brouillon', act: basculerFiligrane },
        { lab: (vignettesVoulues() ? 'Masquer' : 'Montrer') + ' les vignettes des pages', off: !enAtelier, act: basculerVignettes },
        { lab: (modeLecture ? 'Quitter le' : 'Passer en') + ' mode lecture', rac: 'Ctrl+Maj+R', off: !enAtelier, act: basculerLecture }
      ]},
      { nom: 'Aide', items: [
        { lab: 'Palette de commandes…', rac: 'Ctrl+K', act: palette },
        { lab: 'Raccourcis…', act: aideRaccourcis },
        { lab: 'Guide rapide…', act: aideGuide },
        { lab: 'À propos du Greffe…', act: aideAPropos }
      ]}
    ];
  }

  function peindreMenus() {
    var hote = $('gf-menus');
    if (!hote) return;
    hote.innerHTML = menus().map(function (m, i) {
      return '<button type="button" class="gf-menu-btn" data-menu="' + i + '" aria-haspopup="true">' + ech(m.nom) + '</button>';
    }).join('');
    hote.querySelectorAll('.gf-menu-btn').forEach(function (b) {
      b.addEventListener('click', function () { ouvrirMenu(+b.getAttribute('data-menu'), b); });
      b.addEventListener('mouseenter', function () { if (menuOuvert != null && menuOuvert !== +b.getAttribute('data-menu')) ouvrirMenu(+b.getAttribute('data-menu'), b); });
    });
  }
  var menuOuvert = null;
  function fermerMenus() {
    menuOuvert = null;
    racine.querySelectorAll('.gf-menu-liste').forEach(function (l) { l.remove(); });
    racine.querySelectorAll('.gf-menu-btn.is-ouvert').forEach(function (b) { b.classList.remove('is-ouvert'); });
  }
  function ouvrirMenu(i, bouton) {
    var dejaOuvert = menuOuvert === i;
    fermerMenus();
    if (dejaOuvert) return;
    menuOuvert = i;
    bouton.classList.add('is-ouvert');
    var m = menus()[i];
    var liste = document.createElement('div');
    liste.className = 'gf-menu-liste';
    liste.setAttribute('role', 'menu');
    liste.innerHTML = m.items.map(function (it, j) {
      if (it.sep) return '<div class="gf-menu-sep"></div>';
      return '<button type="button" class="gf-menu-item" role="menuitem" data-item="' + j + '"' + (it.off ? ' disabled' : '') + '>'
        + '<span>' + ech(it.lab) + '</span>' + (it.rac ? '<kbd>' + ech(it.rac) + '</kbd>' : '') + '</button>';
    }).join('');
    var r = bouton.getBoundingClientRect(), rr = racine.getBoundingClientRect();
    liste.style.left = (r.left - rr.left) + 'px';
    liste.style.top = (r.bottom - rr.top) + 'px';
    racine.appendChild(liste);
    liste.querySelectorAll('.gf-menu-item').forEach(function (b) {
      b.addEventListener('click', function () {
        var it = m.items[+b.getAttribute('data-item')];
        fermerMenus();
        if (it && it.act) it.act();
      });
    });
  }

  /* l'état de l'acte, en clair, et le bouton principal qui va avec */
  function majTitreBarre() {
    var comp = $('gf-acte-etat');
    if (!comp) return;
    var enAtelier = !!modeleActif && espace === 'atelier';
    comp.hidden = !enAtelier;
    var nav = $('gf-nav-atelier');
    if (nav) nav.hidden = !modeleActif;
    if (!enAtelier) { if (elt.sousTitre) elt.sousTitre.textContent = ''; return; }
    var nom = String(donnees.nomActe || '').trim() || (modeleActif.libre && String(donnees.titre || '').trim()) || modeleActif.nom;
    $('gf-ae-type').textContent = nom;
    $('gf-ae-num').textContent = donnees.numero ? donnees.numero : '';
    var badge = $('gf-ae-badge');
    var x = ETATS[acteEtat] || ETATS.brouillon;
    badge.className = 'gf-ae-badge gf-badge gf-badge-' + x.cls;
    badge.textContent = x.lab.toUpperCase() + (acteVersion > 1 || acteEtat !== 'brouillon' ? ' · V' + acteVersion : '')
      + (modeLecture && acteEtat === 'brouillon' ? ' · LECTURE' : '');
    if (elt.sousTitre) elt.sousTitre.textContent = nom + (donnees.numero ? ' n° ' + donnees.numero : '');
    majActions();
    peindreFrise();
    montrerVignettes();
    if (typeof majOutils === 'function') majOutils();
    var oc = ongletDe(ongletCourant); if (oc && oc.nom !== nomOnglet()) { oc.nom = nomOnglet(); peindreOnglets(); } else peindreOnglets();
  }

  /* LA FRISE DES VERSIONS. Le brouillon, puis chaque version emise, dans
     l'ordre ; celle qu'on regarde est en clair. Un clic sur une version
     l'ouvre en lecture, comme l'onglet Historique le permettait deja. */
  function peindreFrise() {
    var hote = $('gf-frise'); if (!hote) return;
    var enAtelier = !!modeleActif && espace === 'atelier';
    hote.hidden = !enAtelier;
    if (!enAtelier) return;
    var pts = [], surUneVersion = acteEtat !== 'brouillon';
    /* les versions dans l'ordre, puis le brouillon : c'est toujours le
       dernier etat, celui qui vient apres la derniere emission */
    acteVersions.slice().sort(function (a, b) { return a.v - b.v; }).forEach(function (v) {
      var cour = surUneVersion && v.v === acteVersion;
      if (pts.length) pts.push('<span class="gf-frise-trait"></span>');
      pts.push('<button type="button" class="gf-frise-pt ' + (v.etat === 'emise' ? 'est-emise' : 'est-remplacee') + (cour ? ' est-cour' : '') + '" data-frise="' + v.v + '"><i></i><b>V' + v.v + '</b><span>' + (v.etat === 'emise' ? 'émise' : 'remplacée') + ' le ' + ech(dateHeure(v.emisLe)) + '</span></button>');
    });
    /* le brouillon : celui qu'on ecrit, ou celui qui attend derriere la
       version qu'on relit ; rien si la fiche est emise sans suite */
    var brouillonExiste = !surUneVersion || acteFicheEtat === 'brouillon';
    if (brouillonExiste) {
      var vb = !surUneVersion ? acteVersion : acteFicheVersion;
      if (pts.length) pts.push('<span class="gf-frise-trait"></span>');
      pts.push('<button type="button" class="gf-frise-pt' + (!surUneVersion ? ' est-cour' : '') + '" data-frise="brouillon"><i></i><b>Brouillon' + (vb > 1 ? ' V' + vb : '') + '</b><span>' + (!surUneVersion ? (acteSauve ? 'enregistré' : 'en cours') : 'reprendre') + '</span></button>');
    }
    var fin = surUneVersion ? 'Vous regardez la version ' + acteVersion + (acteEtat === 'emis' ? ', celle qui fait foi' : ', remplacée depuis') : (acteVersions.length ? 'Une nouvelle version repart de la dernière émise' : 'Émettre fige une V1 et lui donne un numéro');
    hote.innerHTML = pts.join('') + '<span class="gf-frise-fin">' + fin + '</span>';
    Array.prototype.forEach.call(hote.querySelectorAll('[data-frise]'), function (b) {
      b.addEventListener('click', function () {
        var quoi = b.getAttribute('data-frise');
        /* la fiche du registre, pas l'etat relu : c'est elle qui porte
           le brouillon qui attend derriere la version affichee */
        var f = (typeof registre !== 'undefined' && registre.filter(function (a) { return a.id === acteId; })[0]) || ficheCourante();
        if (!f) return;
        if (quoi === 'brouillon') { if (acteEtat !== 'brouillon') ouvrirActe(f); return; }
        ouvrirActe(f, +quoi);
      });
    });
  }

  function majActions() {
    var hote = $('gf-actions'), note = $('gf-note');
    if (!hote) return;
    var lect = lectureSeule();
    var etatTexte;
    if (acteEtat === 'brouillon') etatTexte = acteSauve ? '✓ Enregistré' : (acteId ? '● Modifié · enregistrement automatique' : '● Nouveau · pas encore enregistré');
    else if (acteEtat === 'emis') etatTexte = 'Émis le ' + dateHeure(acteEmisLe || Date.now()) + ' · pour le modifier, créez une nouvelle version';
    else if (acteEtat === 'remplace') etatTexte = 'Version remplacée : elle se relit et se réimprime, elle ne se modifie plus';
    else if (acteEtat === 'annule') etatTexte = 'Acte annulé' + (acteMotif ? ' : ' + acteMotif : '');
    else etatTexte = 'Acte archivé';
    if (modeLecture && acteEtat === 'brouillon') etatTexte = 'Mode lecture : la feuille telle qu\'elle sortira · Ctrl+Maj+R pour revenir';
    note.textContent = etatTexte + ' · ' + nbPages + ' page' + (nbPages > 1 ? 's' : '');

    var b = [];
    function bouton(lab, cls, fn, rac) {
      b.push({ lab: lab, cls: cls, fn: fn, rac: rac });
    }
    if (acteEtat === 'brouillon' && !modeLecture) {
      if (panneau === 'controle' && controle && !controle.erreurs) bouton('Émettre l\'acte', 'gf-btn-accent', emettreActe, 'Ctrl+Maj+E');
      else bouton('Vérifier l\'acte', 'gf-btn-accent', verifier, 'Ctrl+Entrée');
      bouton('Enregistrer', 'gf-btn-fant', function () { enregistrer(false); }, 'Ctrl+S');
      bouton('Imprimer', 'gf-btn-fant', imprimer, 'Ctrl+P');
    } else if (acteEtat === 'emis') {
      bouton('Imprimer en PDF', 'gf-btn-accent', imprimer, 'Ctrl+P');
      bouton('Nouvelle version', 'gf-btn-fant', nouvelleVersion);
    } else if (modeLecture && acteEtat === 'brouillon') {
      bouton('Modifier', 'gf-btn-accent', basculerLecture, 'Ctrl+Maj+R');
      bouton('Imprimer', 'gf-btn-fant', imprimer, 'Ctrl+P');
    } else {
      bouton('Imprimer', 'gf-btn-fant', imprimer, 'Ctrl+P');
      if (acteEtat === 'archive') bouton('Sortir des archives', 'gf-btn-fant', desarchiverActe);
    }
    hote.innerHTML = b.map(function (x, i) {
      return '<button type="button" class="gf-btn ' + x.cls + '" data-a="' + i + '"' + (x.rac ? ' title="' + ech(x.rac) + '"' : '') + '>' + ech(x.lab) + '</button>';
    }).join('');
    hote.querySelectorAll('[data-a]').forEach(function (x) { x.addEventListener('click', b[+x.getAttribute('data-a')].fn); });
  }

  /* Une deuxième fenêtre : le même admin, le Greffe ouvert sur l'acte
     voulu (?greffe=<id>). Le presse-papiers passe de l'une à l'autre. */
  function nouvelleFenetre(id) {
    var cible = id || (acteId && acteEtat ? acteId : 'accueil');
    if (modeleActif && !acteSauve && acteEtat === 'brouillon') enregistrer(true);
    var url = location.pathname + '?greffe=' + encodeURIComponent(cible);
    var w = window.open(url, '_blank');
    if (!w) dire('Le navigateur a bloqué la nouvelle fenêtre : autorisez les fenêtres surgissantes pour ce site.', 'erreur');
    else dire('Nouvelle fenêtre ouverte' + (cible !== 'accueil' ? ' sur cet acte' : ''), 'ok');
  }

  function fermerActe() {
    if (!modeleActif) return;
    avantDeQuitter(function () {
      oublierReprise();
      var ferme = ongletCourant;
      modeleActif = null; donnees = {}; acteId = null; acteSauve = true; acteReference = null; acteTouche = false; controle = null; modeLecture = false;
      fermerOnglet(ferme);
      var reste = onglets[onglets.length - 1];
      if (reste && reste.etat) { activerOnglet(reste.id); return; }
      montrer('accueil');
    });
  }

  /* renommer : le nom que porte l'acte au registre, dans la barre et dans la
     reprise. Le titre imprimé, lui, se change sur la feuille ; un acte libre
     n'a que celui-là. */
  function renommerActe() {
    if (!modeleActif || lectureSeule()) return;
    if (modeleActif.libre && !donnees.nomActe) {
      demander('Renommer l\'acte', 'Le titre de l\'acte, tel qu\'il s\'imprime et se lit au registre.', donnees.titre || '').then(function (v) {
        if (v == null) return;
        donnees.titre = v; salir(); peindreFormulaire(); rafraichir(); majTitreBarre();
      });
      return;
    }
    demander('Renommer l\'acte', 'Le nom sous lequel le registre le range. Vide : le nom du modèle. Le titre imprimé ne change pas.', donnees.nomActe || '').then(function (v) {
      if (v == null) return;
      donnees.nomActe = v; salir(); majTitreBarre();
      dire(v ? 'Acte renommé « ' + v + ' »' : 'L\'acte reprend le nom du modèle', 'ok');
    });
  }

  function basculerPanneau() {
    racine.classList.toggle('gf-sans-panneau');
    setTimeout(function () { if (cadre && cadrePret) mesurer(cadre.contentDocument); }, 50);
  }
  function basculerLecture() {
    modeLecture = !modeLecture;
    if (modeLecture) panneau = 'donnees';
    peindreFormulaire(); rafraichir(); majTitreBarre();
  }

  /* ---- l'aide ---- */
  function aideRaccourcis() {
    var groupes = [
      ['Document', [['Alt+N', 'Nouvel acte'], ['Ctrl+O', 'Ouvrir le registre'], ['Alt+1 … 9', 'Passer à l\'onglet'], ['Alt+W', 'Fermer l\'onglet'], ['Alt+Maj+N', 'Nouvelle fenêtre du navigateur'], ['Ctrl+K', 'Palette de commandes'], ['Ctrl+S', 'Enregistrer'], ['F2', 'Renommer l\'acte'], ['Ctrl+P', 'Imprimer en PDF'], ['Ctrl+Maj+S', 'Sauvegarder le Greffe']]],
      ['Objets et blocs', [['Ctrl+C', 'Copier l\'objet ou le bloc'], ['Ctrl+V', 'Coller'], ['Suppr', 'Retirer l\'objet'], ['Flèches', 'Déplacer l\'objet d\'un mm (Maj : 5)'], ['Alt+Haut / Bas', 'Monter, descendre le bloc']]],
      ['Édition', [['Ctrl+Z', 'Annuler'], ['Ctrl+Y', 'Rétablir'], ['Entrée', 'Valider un champ d\'une ligne'], ['Échap', 'Quitter le texte, fermer une boîte']]],
      ['Acte', [['Ctrl+Entrée', 'Vérifier, puis émettre'], ['Ctrl+Maj+E', 'Émettre'], ['Ctrl+Maj+R', 'Mode lecture'], ['Ctrl+Maj+P', 'Masquer ou montrer le panneau']]],
      ['Affichage', [['Ctrl+Plus', 'Zoom avant'], ['Ctrl+Moins', 'Zoom arrière'], ['Ctrl+0', 'Taille réelle']]]
    ];
    modale('Raccourcis du Greffe', groupes.map(function (g) {
      return '<h4 class="gf-modale-h4">' + g[0] + '</h4><div class="gf-raccourcis">' + g[1].map(function (r) {
        return '<div><kbd>' + ech(r[0]) + '</kbd><span>' + ech(r[1]) + '</span></div>';
      }).join('') + '</div>';
    }).join(''), [{ lab: 'Fermer' }]);
  }
  function aideGuide() {
    modale('Le Greffe en huit gestes',
      '<ol class="gf-guide">'
      + '<li><b>Nouvel acte</b> : choisissez un modèle, ou un préréglage déjà composé.</li>'
      + '<li>Le <b>panneau</b> à gauche porte les données de l\'acte ; la <b>feuille</b> à droite se met à jour à chaque frappe.</li>'
      + '<li>Cliquez sur un texte de la feuille pour l\'<b>écrire sur place</b>. Une liste reçue par message se <b>colle</b> d\'un coup dans un tableau.</li>'
      + '<li>L\'acte s\'<b>enregistre</b> de lui-même ; Ctrl+Z revient en arrière.</li>'
      + '<li><b>Vérifier</b> : le panneau dit ce qui manque et ce qui dépasse.</li>'
      + '<li><b>Émettre</b> : la version est figée au registre, avec son empreinte. Pour changer quelque chose, une <b>nouvelle version</b>.</li>'
      + '<li><b>Imprimer en PDF</b> : la feuille, exactement.</li>'
      + '<li>De temps en temps, <b>Sauvegarder le Greffe</b> dans un fichier, à mettre à l\'abri.</li>'
      + '</ol>', [{ lab: 'Compris' }]);
  }
  function aideAPropos() {
    modale('À propos du Greffe',
      '<p class="gf-modale-aide">Le Greffe établit les actes officiels de Baobabs Basket Club et en tient le registre, sur ce poste, sans serveur. '
      + 'Il prépare, met en page, suit et archive des documents ; l\'image d\'une signature ou d\'un cachet qu\'il appose n\'est pas une signature électronique certifiée. '
      + 'La valeur d\'un document dépend de son destinataire et de la réglementation qui s\'y applique.</p>'
      + '<p class="gf-modale-aide">' + registre.length + ' acte' + (registre.length > 1 ? 's' : '') + ' au registre · ' + (G.prereglages || []).length + ' préréglages livrés · ' + MODELES.length + ' modèles.</p>',
      [{ lab: 'Fermer' }]);
  }

  /* =================================================================
     7. LE FORMULAIRE
     ================================================================= */
  /* Un champ riche du formulaire : la même grammaire que la feuille, dans
     les deux sens. On y voit ce qu'on écrit, jamais une marque. */
  function peindreChampRiche(n, v) {
    var t = v == null ? '' : String(v);
    n.innerHTML = n.getAttribute('data-riche') === 'zone' ? paragraphes(t) : enLigne(t);
  }
  function lireChampRiche(n) {
    return n.getAttribute('data-riche') === 'zone' ? depuisDom(n) : depuisDomLigne(n);
  }
  function brancherChampRiche(n, chemin, apres) {
    peindreChampRiche(n, G.blocs.lire(donnees, chemin));
    n.addEventListener('input', function () {
      ecrire(chemin, lireChampRiche(n)); salir(); if (apres) apres(); planifier();
      if (chemin === 'titre' || chemin === 'nomActe') majTitreBarre();
    });
    n.addEventListener('paste', function (e) {
      e.preventDefault();
      var t = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, t);
    });
    n.addEventListener('keydown', function (e) {
      if (n.getAttribute('data-riche') === 'ligne' && e.key === 'Enter') { e.preventDefault(); n.blur(); return; }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && /^[biu]$/.test(e.key.toLowerCase())) {
        e.preventDefault(); document.execCommand('styleWithCSS', false, true);
        document.execCommand({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]);
      }
    });
    /* la feuille refaite rend le champ propre (marques relues, variables posées) */
    n.addEventListener('blur', function () { peindreChampRiche(n, G.blocs.lire(donnees, chemin)); });
  }
  function champHtml(c) {
    var id = 'gf-c-' + c.cle;
    if (c.type === 'bascule') {
      return '<label class="gf-bascule"><input type="checkbox" id="' + id + '" data-cle="' + c.cle + '">'
           + '<span class="gf-bascule-piste"></span>'
           + '<span class="gf-bascule-txt">' + ech(c.lab) + '</span></label>'
           + (c.aide ? '<p class="gf-aide">' + ech(c.aide) + '</p>' : '');
    }
    var saisie;
    if (c.type === 'image') {
      /* un fichier image, lu en base64 et allégé, comme le cachet */
      return '<label class="gf-lab" for="' + id + '">' + ech(c.lab) + '</label>'
           + '<input class="gf-in" type="file" accept="image/*" id="' + id + '" data-image="' + c.cle + '">'
           + (c.aide ? '<p class="gf-aide">' + ech(c.aide) + '</p>' : '');
    }
    if (c.type === 'zone') {
      /* un texte riche se montre tel qu'il s'imprime (gras, puces, variables),
         jamais avec ses marques : le champ est une petite feuille */
      saisie = '<div class="gf-ta gf-riche" id="' + id + '" data-cle="' + c.cle + '" data-riche="zone" contenteditable="true" spellcheck="false" data-vide="' + ech(c.lab) + '"></div>';
    } else if (c.type === 'texte') {
      saisie = '<div class="gf-in gf-riche gf-riche-ligne" id="' + id + '" data-cle="' + c.cle + '" data-riche="ligne" contenteditable="true" spellcheck="false"></div>';
    } else if (c.type === 'choix') {
      /* une liste fermée : la fonction d'une fiche, le genre d'un contrat */
      saisie = '<select class="gf-sel" id="' + id + '" data-cle="' + c.cle + '">'
             + (c.choix || []).map(function (o) { return '<option>' + ech(o) + '</option>'; }).join('')
             + '</select>';
    } else {
      saisie = '<input class="gf-in" type="' + (c.type === 'date' ? 'date' : 'text')
             + '" id="' + id + '" data-cle="' + c.cle + '">';
    }
    return '<label class="gf-lab" for="' + id + '">' + ech(c.lab) + '</label>' + saisie
         + (c.aide ? '<p class="gf-aide">' + ech(c.aide) + '</p>' : '');
  }

  function peindreFormulaire() {
    var hote = elt.formDefile;
    hote.innerHTML = '';
    if (!modeleActif) return;
    var tete = elt.formTete;
    if (panneau === 'controle' && !lectureSeule()) {
      if (tete) { tete.hidden = false; tete.innerHTML = '<span class="gf-lab">Contrôle avant émission</span>'; }
      peindreControle();
      return;
    }
    if (panneau === 'bloc' || panneau === 'objet') panneau = 'donnees';
    peindreProps();
    if (tete) {
      var lect = lectureSeule();
      tete.hidden = !lect;
      if (lect) {
        tete.innerHTML = '<span class="gf-lab">' + (modeLecture && acteEtat === 'brouillon' ? 'Mode lecture' : ech(etatLabel(acteEtat))) + '</span>'
          + '<p>' + (acteEtat === 'emis' ? 'Émis le ' + ech(dateHeure(acteEmisLe || Date.now())) + '. Cet acte ne se modifie plus : pour le changer, créez une nouvelle version.'
                   : acteEtat === 'brouillon' ? 'La feuille telle qu\'elle sortira. Cliquez sur Modifier pour reprendre la main.'
                   : 'Cette version se relit et se réimprime ; elle ne se modifie plus.') + '</p>'
          + (acteEtat === 'emis' ? '<button type="button" class="gf-btn gf-btn-fant" id="gf-tete-version">Nouvelle version</button>' : '')
          + (modeLecture && acteEtat === 'brouillon' ? '<button type="button" class="gf-btn gf-btn-accent" id="gf-tete-modifier">Modifier</button>' : '');
        var bv = $('gf-tete-version'); if (bv) bv.addEventListener('click', nouvelleVersion);
        var bm = $('gf-tete-modifier'); if (bm) bm.addEventListener('click', basculerLecture);
      }
    }

    (G.blocs.val(modeleActif.sections, donnees, {}) || []).forEach(function (s, i) {
      var sect = document.createElement('section');
      sect.className = 'gf-sect' + (s.ouvert ? ' is-ouvert' : '');
      var corps = '';

      if (s.special === 'table')          corps = '<div data-table="' + ech(s.source) + '"></div>';
      else if (s.special === 'articles')  corps = '<div id="gf-zone-articles"></div>';
      else if (s.special === 'blocs')     corps = '<div id="gf-zone-blocs"></div>';
      else {
        var enAttente = null;
        (s.champs || []).forEach(function (c) {
          if (c.duo) {
            if (enAttente) { corps += '<div class="gf-duo"><div>' + enAttente + '</div><div>' + champHtml(c) + '</div></div>'; enAttente = null; }
            else enAttente = champHtml(c);
          } else {
            if (enAttente) { corps += '<div class="gf-champ">' + enAttente + '</div>'; enAttente = null; }
            corps += '<div class="gf-champ">' + champHtml(c) + '</div>';
          }
        });
        if (enAttente) corps += '<div class="gf-champ">' + enAttente + '</div>';
      }

      sect.innerHTML =
        '<button type="button" class="gf-sect-tete">'
        + '<span class="gf-sect-num">' + deuxChiffres(i + 1) + '</span>'
        + '<span class="gf-sect-titre">' + ech(s.titre) + '</span>'
        + '<svg class="gf-sect-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'
        + '</button><div class="gf-sect-corps">' + corps + '</div>';

      sect.querySelector('.gf-sect-tete').addEventListener('click', function () {
        sect.classList.toggle('is-ouvert');
      });
      hote.appendChild(sect);
    });

    /* un champ lit et écrit à son chemin : « titre » comme « blocs.3.largeur » */
    hote.querySelectorAll('[data-cle]').forEach(function (n) {
      var c = n.getAttribute('data-cle');
      var v = G.blocs.lire(donnees, c);
      if (n.type === 'checkbox') {
        n.checked = !!v;
        n.addEventListener('change', function () { ecrire(c, n.checked); salir(); majArticlesSiAuto(); planifier(); });
      } else if (n.hasAttribute('data-riche')) {
        brancherChampRiche(n, c, function () { majArticlesSiAuto(); });
      } else {
        n.value = v == null ? '' : v;
        n.addEventListener('input', function () { ecrire(c, n.value); salir(); majArticlesSiAuto(); planifier(); });
      }
    });
    hote.querySelectorAll('[data-image]').forEach(function (n) {
      n.addEventListener('change', function () {
        var f = n.files && n.files[0];
        if (!f) return;
        lireFichier(f).then(function (uri) { return alleger(uri, 1600); }).then(function (uri) {
          ecrire(n.getAttribute('data-image'), uri); salir(); planifier();
          dire('Image déposée dans l\'acte', 'ok');
        }).catch(function () { dire('Image illisible', 'erreur'); });
      });
    });

    hote.querySelectorAll('[data-table]').forEach(function (n) {
      peindreTable(n.getAttribute('data-table'));
    });
    peindreArticles();
    peindreBlocs();
    /* en lecture seule, le panneau se regarde et ne se touche pas */
    if (lectureSeule()) {
      hote.querySelectorAll('input, textarea, select, button').forEach(function (n) { n.disabled = true; });
      hote.classList.add('is-fige');
    } else hote.classList.remove('is-fige');
  }

  /* ------------------- LES TABLEAUX, COLONNES COMPRISES -------------------
     Le tableau ne connaît aucune colonne à l'avance : il lit celles que
     l'acte transporte. En ajouter une, la renommer, la déplacer ou la
     retirer se fait ici, et l'acte s'en souvient. */
  function table(source) {
    donnees.tables = donnees.tables || {};
    donnees.tables[source] = donnees.tables[source] || { colonnes: [], lignes: [] };
    var t = donnees.tables[source];
    t.colonnes = t.colonnes || [];
    t.lignes = t.lignes || [];
    return t;
  }

  function cleLibre(t, base) {
    var c = normaliser(base) || 'col';
    var n = c, i = 2;
    while (t.colonnes.some(function (x) { return x.cle === n; })) n = c + i++;
    return n;
  }

  function peindreTable(source) {
    var hote = elt.formDefile.querySelector('[data-table="' + source + '"]');
    if (!hote) return;
    var t = table(source);
    var utiles = G.lignes(donnees, source);
    var sing = t.singulier || 'ligne';

    var minimum = t.vide != null ? t.vide : '';
    var barre = '<div class="gf-tab-barre">'
      + '<span class="gf-tab-compte">' + utiles.length + ' ' + ech(sing) + (utiles.length > 1 ? 's' : '') + '</span>'
      + '<label class="gf-tab-min" title="La grille s\'imprime avec au moins ce nombre de lignes, remplies ou non : pour la compléter à la main">'
      + 'lignes imprimées, au moins <input class="gf-in gf-in-min" type="number" min="0" max="60" data-act="minimum" value="' + ech(minimum) + '" placeholder="auto"></label>'
      + '<button type="button" class="gf-mini" data-act="coller">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
      + '<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2"/></svg>'
      + 'Coller</button>'
      + '<button type="button" class="gf-mini" data-act="ajouter">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
      + 'Ajouter</button></div>';

    /* les colonnes, modifiables */
    var cols = '<div class="gf-cols"><div class="gf-cols-tete">'
      + '<span class="gf-lab" style="margin:0">Colonnes du tableau</span>'
      + '<button type="button" class="gf-mini" data-act="col-plus">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
      + 'Colonne</button></div><div class="gf-cols-liste">'
      + t.colonnes.map(function (c, i) {
          return '<div class="gf-col" data-ci="' + i + '">'
            + '<button type="button" class="gf-col-mv" data-mv="-1" title="Vers la gauche" aria-label="Vers la gauche"'
            + (i === 0 ? ' disabled' : '') + '>'
            + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg></button>'
            + '<input class="gf-col-nom" value="' + ech(c.titre || '') + '" aria-label="Titre de la colonne">'
            + '<button type="button" class="gf-col-fx' + (c.formule ? ' is-actif' : '') + '" title="' + (c.formule ? 'Formule : ' + ech(c.formule) : 'Calculer cette colonne à partir des autres (quantité × prix…)') + '" aria-label="Formule">ƒ</button>'
            + '<button type="button" class="gf-col-mv" data-mv="1" title="Vers la droite" aria-label="Vers la droite"'
            + (i === t.colonnes.length - 1 ? ' disabled' : '') + '>'
            + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m10 6 6 6-6 6"/></svg></button>'
            + '<button type="button" class="gf-col-sup" title="Retirer la colonne" aria-label="Retirer">'
            + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>'
            + '</div>';
        }).join('')
      + '</div></div>';

    /* les lignes, dessinées d'après les colonnes */
    var rangs = t.lignes.map(function (l, i) {
      var champs = t.colonnes.map(function (c, j) {
        var v = l[c.cle] == null ? '' : l[c.cle];
        var large = (j === 0) ? ' gf-large' : '';
        if (c.choix && c.choix.length) {
          var opts = c.choix.map(function (o) {
            return '<option' + (o === v ? ' selected' : '') + '>' + ech(o) + '</option>';
          }).join('');
          if (v && c.choix.indexOf(v) === -1) opts = '<option selected>' + ech(v) + '</option>' + opts;
          return '<select class="gf-sel' + large + '" data-ch="' + ech(c.cle) + '">' + opts + '</select>';
        }
        return '<input class="gf-in' + large + '" data-ch="' + ech(c.cle) + '" placeholder="'
          + ech(c.titre || '') + '" value="' + ech(v) + '">';
      }).join('');
      return '<div class="gf-rang" data-i="' + i + '">'
        + '<div class="gf-rang-tete"><span class="gf-rang-num">' + deuxChiffres(i + 1) + '</span>'
        + '<span class="gf-rang-resume">' + ech(l[(t.colonnes[0] || {}).cle] || 'Nouvelle ligne') + '</span>'
        + '<button type="button" class="gf-rang-sup" title="Retirer" aria-label="Retirer">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
        + '</button></div><div class="gf-rang-grille">' + champs + '</div></div>';
    }).join('');

    hote.innerHTML = barre + cols + '<div class="gf-rangs">' + rangs + '</div>';

    /* --- écoute --- */
    hote.querySelector('[data-act="ajouter"]').addEventListener('click', function () {
      var l = {}; t.colonnes.forEach(function (c) { l[c.cle] = c.defaut || ''; });
      t.lignes.push(l); salir(); peindreTable(source); majArticlesSiAuto(); planifier();
    });
    hote.querySelector('[data-act="coller"]').addEventListener('click', function () { ouvrirColler(source); });
    hote.querySelector('[data-act="minimum"]').addEventListener('change', function () {
      var v = this.value === '' ? null : Math.max(0, Math.min(60, parseInt(this.value, 10) || 0));
      if (v == null) delete t.vide; else t.vide = v;
      salir(); planifier();
    });

    hote.querySelector('[data-act="col-plus"]').addEventListener('click', function () {
      demander('Nouvelle colonne', 'Son titre, tel qu\'il s\'imprimera en tête du tableau. Choisissez dans la liste ou écrivez le vôtre.', 'Taille',
               Object.keys(COLONNES_PRETES)).then(function (titre) {
        if (!titre) return;
        var prete = COLONNES_PRETES[titre] || COLONNES_PRETES[Object.keys(COLONNES_PRETES).filter(function (k) { return k.toLowerCase() === titre.toLowerCase(); })[0]] || {};
        t.colonnes.push(Object.assign({ cle: cleLibre(t, titre), titre: titre, poids: 22, align: 'centre', forme: 'texte' }, prete));
        salir(); peindreTable(source); majArticlesSiAuto(); planifier();
        dire('Colonne « ' + titre + ' » ajoutée', 'ok');
      });
    });

    hote.querySelectorAll('.gf-col').forEach(function (d) {
      var i = +d.getAttribute('data-ci');
      d.querySelector('.gf-col-nom').addEventListener('input', function () {
        t.colonnes[i].titre = this.value; salir(); planifier();
      });
      d.querySelector('.gf-col-fx').addEventListener('click', function () {
        var c = t.colonnes[i];
        var cles = t.colonnes.filter(function (x) { return x !== c; }).map(function (x) { return x.cle + ' (' + (x.titre || x.cle) + ')'; }).join(', ');
        demander('Formule de la colonne « ' + (c.titre || c.cle) + ' »',
                 'Les autres colonnes s\'appellent : ' + cles + '. Écrivez par exemple quantite * prix, ou montant * 0,18. Vide : la colonne redevient libre.',
                 c.formule || '', t.colonnes.filter(function (x) { return x !== c; }).map(function (x) { return x.cle; })).then(function (f) {
          if (f == null) return;
          f = f.trim();
          if (f) {
            var essai = { cle: c.cle, formule: f };
            if (!G.blocs.formuleValide(t, essai)) { dire('Formule illisible : ' + f, 'erreur'); return; }
            c.formule = f; if (c.forme === 'texte') c.forme = 'nombre'; if (c.align === 'gauche') c.align = 'droite';
            if (c.total == null) c.total = true;
            dire('Colonne « ' + (c.titre || c.cle) + ' » calculée : ' + f, 'ok');
          } else { delete c.formule; }
          salir(); peindreTable(source); planifier();
        });
      });
      d.querySelectorAll('.gf-col-mv').forEach(function (b) {
        b.addEventListener('click', function () {
          var j = i + (+b.getAttribute('data-mv'));
          if (j < 0 || j >= t.colonnes.length) return;
          var tmp = t.colonnes[i]; t.colonnes[i] = t.colonnes[j]; t.colonnes[j] = tmp;
          salir(); peindreTable(source); planifier();
        });
      });
      d.querySelector('.gf-col-sup').addEventListener('click', function () {
        if (t.colonnes.length <= 1) { dire('Un tableau garde au moins une colonne.', 'erreur'); return; }
        var c = t.colonnes[i];
        t.colonnes.splice(i, 1);
        t.lignes.forEach(function (l) { delete l[c.cle]; });
        salir(); peindreTable(source); majArticlesSiAuto(); planifier();
      });
    });

    hote.querySelectorAll('.gf-rang').forEach(function (r) {
      var i = +r.getAttribute('data-i');
      r.querySelectorAll('[data-ch]').forEach(function (n) {
        var ev = n.tagName === 'SELECT' ? 'change' : 'input';
        n.addEventListener(ev, function () {
          t.lignes[i][n.getAttribute('data-ch')] = n.value;
          salir(); majArticlesSiAuto(); planifier();
          var res1 = r.querySelector('.gf-rang-resume');
          if (res1) res1.textContent = t.lignes[i][(t.colonnes[0] || {}).cle] || 'Nouvelle ligne';
        });
      });
      r.querySelector('.gf-rang-sup').addEventListener('click', function () {
        t.lignes.splice(i, 1); salir(); peindreTable(source); majArticlesSiAuto(); planifier();
      });
    });
  }

  /* ------------------------- LES BLOCS D'UN ACTE LIBRE -------------------------
     La liste des blocs posés, dans l'ordre de la feuille, avec pour chacun
     ses réglages hors texte (le texte s'écrit sur la feuille). Et la
     palette pour en poser un nouveau. Le catalogue vient du modèle. */
  function peindreBlocs() {
    var hote = $('gf-zone-blocs');
    if (!hote || !modeleActif || !modeleActif.catalogue) return;
    var cat = modeleActif.catalogue;
    var parType = {};
    cat.forEach(function (e) { parType[e.type] = parType[e.type] || e; });
    donnees.blocs = donnees.blocs || [];

    var familles = {};
    cat.forEach(function (e) { (familles[e.famille] = familles[e.famille] || []).push(e); });
    var options = Object.keys(familles).map(function (f) {
      return '<optgroup label="' + ech(f) + '">' + familles[f].map(function (e) {
        return '<option value="' + ech(e.nom) + '">' + ech(e.nom) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');

    var liste = donnees.blocs.map(function (x, i) {
      var e = parType[x.b];
      var nom = e ? e.nom : x.b;
      if (x.b === 'tableau' && donnees.tables && donnees.tables[x.source] && donnees.tables[x.source].titre) {
        nom = 'Tableau : ' + donnees.tables[x.source].titre;
      }
      var reglages = (e && e.reglages || []).map(function (c) {
        var champ = Object.assign({}, c, { cle: 'blocs.' + i + '.' + c.cle });
        return '<div class="gf-champ">' + champHtml(champ) + '</div>';
      }).join('');
      if (x.b === 'tableau') {
        reglages += '<p class="gf-aide">Les colonnes et les lignes de ce tableau ont leur propre section, plus bas.</p>';
      }
      return '<div class="gf-bloc-item" data-i="' + i + '">'
        + '<div class="gf-bloc-tete">'
        + '<span class="gf-rang-num">' + deuxChiffres(i + 1) + '</span>'
        + '<span class="gf-bloc-nom">' + ech(nom) + '</span>'
        + '<button type="button" class="gf-col-mv" data-mv="-1" title="Monter" aria-label="Monter"' + (i === 0 ? ' disabled' : '') + '>'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 6-6 6 6"/></svg></button>'
        + '<button type="button" class="gf-col-mv" data-mv="1" title="Descendre" aria-label="Descendre"' + (i === donnees.blocs.length - 1 ? ' disabled' : '') + '>'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 10 6 6 6-6"/></svg></button>'
        + (reglages ? '<button type="button" class="gf-col-mv gf-bloc-plier" title="Réglages" aria-label="Réglages">'
            + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button>' : '')
        + '<button type="button" class="gf-rang-sup" title="Retirer ce bloc" aria-label="Retirer">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>'
        + '</div>'
        + (reglages ? '<div class="gf-bloc-reglages" hidden>' + reglages + '</div>' : '')
        + '</div>';
    }).join('');

    hote.innerHTML =
      '<div class="gf-tab-barre"><span class="gf-tab-compte">' + donnees.blocs.length + ' bloc'
      + (donnees.blocs.length > 1 ? 's' : '') + ' sur la feuille</span></div>'
      + '<div class="gf-blocs-liste">' + (liste || '<p class="gf-vide">Feuille vide. Posez un premier bloc.</p>') + '</div>'
      + '<div class="gf-palette"><select class="gf-sel" id="gf-palette-choix">' + options + '</select>'
      + '<button type="button" class="gf-mini gf-mini-accent" id="gf-palette-plus">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
      + 'Poser</button></div>'
      + '<p class="gf-aide">Le texte de chaque bloc s\'écrit directement sur la feuille. Ici : l\'ordre, les réglages, et la palette.</p>';

    function refaire() { salir(); peindreFormulaire(); planifier(); }

    hote.querySelectorAll('.gf-bloc-item').forEach(function (d) {
      var i = +d.getAttribute('data-i');
      d.querySelectorAll('.gf-col-mv[data-mv]').forEach(function (b) {
        b.addEventListener('click', function () {
          var j = i + (+b.getAttribute('data-mv'));
          if (j < 0 || j >= donnees.blocs.length) return;
          var tmp = donnees.blocs[i]; donnees.blocs[i] = donnees.blocs[j]; donnees.blocs[j] = tmp;
          refaire();
        });
      });
      var plier = d.querySelector('.gf-bloc-plier');
      if (plier) plier.addEventListener('click', function () {
        var z = d.querySelector('.gf-bloc-reglages'); z.hidden = !z.hidden;
      });
      d.querySelector('.gf-rang-sup').addEventListener('click', function () {
        var x = donnees.blocs[i];
        donnees.blocs.splice(i, 1);
        if (x.b === 'tableau' && x.source && donnees.tables) delete donnees.tables[x.source];
        refaire();
      });
    });

    $('gf-palette-plus').addEventListener('click', function () {
      var nom = $('gf-palette-choix').value;
      var e = cat.filter(function (c) { return c.nom === nom; })[0];
      if (e) poserBloc(e);
    });
  }

  /* Poser un bloc du catalogue dans l'acte libre en cours : depuis la
     palette du panneau, le menu Insertion, ou plus tard la commande /. */
  function poserBloc(e) {
    if (!modeleActif || !modeleActif.libre || lectureSeule()) return;
    donnees.blocs = donnees.blocs || [];
    if (e.type === 'articles' && donnees.blocs.some(function (x) { return x.b === 'articles'; })) {
      dire('Un seul bloc d\'articles par acte.', 'erreur'); return;
    }
    var x = e.neuf();
    if (x._table) { donnees.tables = donnees.tables || {}; donnees.tables[x.source] = x._table; delete x._table; }
    /* Un bloc sait où aller : un en-tête en haut de la feuille, des
       signatures en bas, tout le reste juste après le bloc où l'on est,
       sinon avant les signatures qui ferment l'acte, sinon à la fin. */
    var blocs = donnees.blocs, k, ou;
    if (x.b === 'entete' || x.b === 'bandeau' && !blocs.length) { k = 0; ou = 'en haut de la feuille'; }
    else if (x.b === 'signatures' || x.b === 'signatureLibre' || x.b === 'talon') { k = blocs.length; ou = 'à la fin'; }
    else if (blocCourant && /^b\d+$/.test(blocCourant) && +blocCourant.slice(1) < blocs.length) { k = +blocCourant.slice(1) + 1; ou = 'après « ' + nomDuBloc(blocCourant) + ' »'; }
    else { k = blocs.length; if (k && blocs[k - 1].b === 'signatures' && x.b !== 'saut') k--; ou = k === blocs.length ? 'à la fin' : 'avant les signatures'; }
    if (x.b === 'entete' && blocs.some(function (y) { return y.b === 'entete'; })) { dire('La feuille a déjà un en-tête : modifiez-le sur place.', 'erreur'); return; }
    blocs.splice(k, 0, x);
    salir(); peindreFormulaire(); planifier();
    blocSel = 'b' + k;
    dire('Bloc « ' + e.nom + ' » posé ' + ou + ' · Alt+Haut / Alt+Bas pour le déplacer', 'ok');
  }

  /* Les colonnes qu'un club ajoute le plus souvent, avec leur forme : on les
     propose dans la boîte « Nouvelle colonne », mais tout titre reste libre. */
  var COLONNES_PRETES = {
    'Téléphone':            { poids: 28, forme: 'code', align: 'gauche' },
    'Parent ou tuteur':     { poids: 40, forme: 'texte', align: 'gauche' },
    'Téléphone du parent':  { poids: 28, forme: 'code', align: 'gauche' },
    'Adresse':              { poids: 44, forme: 'texte', align: 'gauche' },
    'Courriel':             { poids: 36, forme: 'code', align: 'gauche' },
    'Taille':               { poids: 16, forme: 'nombre', align: 'centre' },
    'Poste':                { poids: 22, forme: 'pastille', align: 'centre', choix: ['Meneuse', 'Arrière', 'Ailière', 'Ailière forte', 'Pivot'] },
    'Licence':              { poids: 26, forme: 'code', align: 'gauche' },
    'Catégorie':            { poids: 22, forme: 'pastille', align: 'centre', choix: ['U12', 'U14', 'U16', 'U18', 'Senior'] },
    'Signature':            { poids: 34, forme: 'texte', align: 'gauche' },
    'Présent(e)':           { poids: 18, forme: 'pastille', align: 'centre', choix: ['Oui', 'Non', 'Excusé(e)'] },
    'Observations':         { poids: 34, forme: 'texte', align: 'gauche' },
    'Montant':              { poids: 24, forme: 'nombre', align: 'droite', total: true },
    'Quantité':             { poids: 16, forme: 'nombre', align: 'centre' },
    'Prix unitaire':        { poids: 22, forme: 'nombre', align: 'droite' },
    'Total (quantité × prix)': { poids: 24, forme: 'nombre', align: 'droite', total: true, formule: 'quantite * prixunitaire' },
    'TVA 18 %':             { poids: 20, forme: 'nombre', align: 'droite', total: true, formule: 'montant * 0.18' },
    'Date':                 { poids: 20, forme: 'code', align: 'centre' }
  };

  /* ---------------------------------- PALETTE ----------------------------------
     Ctrl+K : une ligne, on tape, on choisit. Toutes les commandes des
     menus, les modèles, les préréglages, les blocs à poser et les actes
     du registre : la même chose que les menus, sans la souris. */
  function sansAccents(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function entreesPalette(plume) {
    var out = [];
    /* la plume est dans un texte de la feuille : les textes du club et les variables s'y posent */
    if (plume) {
      listeTextes('').forEach(function (t) {
        out.push({ g: 'Insérer dans le texte', lab: t.nom, sous: t.groupe || '', act: function () {
          var doc = cadre.contentDocument;
          cadre.contentWindow.focus();
          try { var s = doc.getSelection(); s.removeAllRanges(); s.addRange(plume); } catch (x) {}
          doc.execCommand('insertText', false, t.texte);
        } });
      });
    }
    menus().forEach(function (m) {
      m.items.forEach(function (it) {
        if (it.sep || it.off || !it.act) return;
        if (/^Bloc : /.test(it.lab)) return;   /* les blocs ont leur propre groupe */
        out.push({ g: m.nom, lab: it.lab.replace(/…$/, ''), rac: it.rac || '', act: it.act });
      });
    });
    MODELES.forEach(function (k) {
      var m = G.modeles[k]; if (!m) return;
      out.push({ g: 'Nouvel acte', lab: m.nom, sous: m.resume || m.famille || '', act: function () { nouvelActe(k); } });
    });
    tousPrereglages().forEach(function (p) {
      if (!G.modeles[p.modele]) return;
      out.push({ g: 'Préréglage', lab: p.nom, sous: (G.modeles[p.modele] || {}).nom || '', act: function () { nouvelActe(p.modele, p); } });
    });
    if (modeleActif && modeleActif.libre && !lectureSeule() && modeleActif.catalogue) {
      modeleActif.catalogue.forEach(function (e) { out.push({ g: 'Poser un bloc', lab: e.nom, sous: e.aide || '', act: function () { poserBloc(e); } }); });
    }
    dossiers.forEach(function (d) {
      out.push({ g: 'Dossier', lab: d.nom, sous: actesDuDossier(d.id).length + ' acte' + (actesDuDossier(d.id).length > 1 ? 's' : '') + (d.note ? ' · ' + d.note : ''), act: function () { registreDossier = d.id; montrer('registre'); } });
    });
    registre.slice().sort(function (a, b) { return (b.maj || 0) - (a.maj || 0); }).forEach(function (a) {
      out.push({ g: 'Registre', lab: (a.numero ? a.numero + ' · ' : '') + (a.intitule || a.nom), sous: a.nom + ' · ' + (dateLongue(a.date, false) || '') + ' · ' + (a.etat || 'brouillon'),
                 act: function () { ouvrirActe(a); } });
    });
    return out;
  }
  var paletteOuverte = null;
  function palette() {
    if (paletteOuverte) { paletteOuverte.remove(); paletteOuverte = null; return; }
    fermerMenus();
    var plume = null;
    try {
      var dP = cadre && cadrePret ? cadre.contentDocument : null, sP = dP && dP.getSelection();
      if (sP && sP.rangeCount) { var nP = sP.anchorNode.nodeType === 3 ? sP.anchorNode.parentNode : sP.anchorNode; if (nP && nP.closest && nP.closest('[data-edit]') && !lectureSeule()) plume = sP.getRangeAt(0).cloneRange(); }
    } catch (x) {}
    var entrees = entreesPalette(plume), vues = [], sel = 0;
    var voile = document.createElement('div');
    voile.className = 'gf-voile gf-voile-cmd';
    voile.innerHTML = '<div class="gf-cmd" role="dialog" aria-modal="true" aria-label="Palette de commandes">'
      + '<input class="gf-cmd-in" type="text" placeholder="Tapez une commande, un modèle, un bloc, un acte du registre…" spellcheck="false">'
      + '<div class="gf-cmd-liste" role="listbox"></div>'
      + '<div class="gf-cmd-pied"><span><kbd>↑</kbd><kbd>↓</kbd> choisir</span><span><kbd>Entrée</kbd> faire</span><span><kbd>Échap</kbd> fermer</span><span>' + entrees.length + ' entrées</span></div></div>';
    var input = voile.querySelector('.gf-cmd-in'), liste = voile.querySelector('.gf-cmd-liste');
    function fermerP() { if (voile.parentNode) voile.remove(); paletteOuverte = null; }
    function faire(i) { var e = vues[i]; if (!e) return; fermerP(); try { e.act(); } catch (x) { dire(String(x && x.message || x), 'erreur'); } }
    function filtrer() {
      var q = sansAccents(input.value.trim()), mots = q ? q.split(/\s+/) : [];
      vues = entrees.filter(function (e) {
        if (!mots.length) return true;
        var t = sansAccents(e.g + ' ' + e.lab + ' ' + (e.sous || ''));
        return mots.every(function (m) { return t.indexOf(m) !== -1; });
      });
      if (!mots.length) vues = vues.slice(0, 40); else vues = vues.slice(0, 60);
      sel = 0; peindreP();
    }
    function peindreP() {
      if (!vues.length) { liste.innerHTML = '<div class="gf-cmd-vide">Rien ne correspond.</div>'; return; }
      var g = null;
      liste.innerHTML = vues.map(function (e, i) {
        var h = '';
        if (e.g !== g) { g = e.g; h += '<div class="gf-cmd-groupe">' + ech(g) + '</div>'; }
        return h + '<button type="button" class="gf-cmd-item' + (i === sel ? ' is-sel' : '') + '" role="option" data-i="' + i + '"><span class="gf-cmd-lab">' + ech(e.lab) + (e.sous ? '<small>' + ech(e.sous) + '</small>' : '') + '</span>' + (e.rac ? '<kbd>' + ech(e.rac) + '</kbd>' : '') + '</button>';
      }).join('');
      var s = liste.querySelector('.is-sel'); if (s && s.scrollIntoView) s.scrollIntoView({ block: 'nearest' });
    }
    input.addEventListener('input', filtrer);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(vues.length - 1, sel + 1); peindreP(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); peindreP(); }
      else if (e.key === 'Enter') { e.preventDefault(); faire(sel); }
      else if (e.key === 'Escape') { e.preventDefault(); fermerP(); }
      e.stopPropagation();
    });
    liste.addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (b) faire(+b.getAttribute('data-i')); });
    liste.addEventListener('mousemove', function (e) { var b = e.target.closest('[data-i]'); if (b && +b.getAttribute('data-i') !== sel) { sel = +b.getAttribute('data-i'); liste.querySelectorAll('.gf-cmd-item').forEach(function (x) { x.classList.toggle('is-sel', +x.getAttribute('data-i') === sel); }); } });
    voile.addEventListener('mousedown', function (e) { if (e.target === voile) fermerP(); });
    racine.appendChild(voile);
    paletteOuverte = voile;
    filtrer(); input.focus();
  }

  /* --------------------------------- DEMANDER ---------------------------------
     Une question, une réponse, sans window.prompt : le navigateur
     d'aperçu ne le connaît pas, et il n'a pas la charte. */
  function demander(titre, aide, defaut, suggestions) {
    return new Promise(function (res) {
      var liste = (suggestions && suggestions.length)
        ? '<datalist id="gf-suggestions">' + suggestions.map(function (s) { return '<option value="' + ech(s) + '">'; }).join('') + '</datalist>' : '';
      var voile = document.createElement('div');
      voile.className = 'gf-voile';
      voile.innerHTML =
        '<div class="gf-modale gf-modale-courte" role="dialog" aria-modal="true">'
        + '<header class="gf-modale-top"><h3>' + ech(titre) + '</h3>'
        + '<button type="button" class="gf-ico gf-ico-close" data-non aria-label="Fermer">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></header>'
        + '<div class="gf-modale-corps">' + (aide ? '<p class="gf-modale-aide">' + ech(aide) + '</p>' : '')
        + '<input class="gf-in" type="text" data-reponse' + (liste ? ' list="gf-suggestions"' : '') + '>' + liste
        + (liste ? '<div class="gf-puces" style="margin-top:8px">' + suggestions.slice(0, 8).map(function (s) {
            return '<button type="button" class="gf-puce" data-sug="' + ech(s) + '">' + ech(s) + '</button>';
          }).join('') + '</div>' : '')
        + '</div>'
        + '<footer class="gf-modale-pied"><button type="button" class="gf-btn gf-btn-fant" data-non>Annuler</button>'
        + '<button type="button" class="gf-btn gf-btn-accent" data-oui>Valider</button></footer></div>';
      var input = voile.querySelector('[data-reponse]');
      input.value = defaut || '';
      function fin(v) { voile.remove(); res(v); }
      voile.querySelectorAll('[data-sug]').forEach(function (b) { b.addEventListener('click', function () { fin(b.getAttribute('data-sug')); }); });
      voile.querySelectorAll('[data-non]').forEach(function (b) { b.addEventListener('click', function () { fin(null); }); });
      voile.querySelector('[data-oui]').addEventListener('click', function () { fin(input.value.trim()); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); fin(input.value.trim()); }
        if (e.key === 'Escape') { e.preventDefault(); fin(null); }
      });
      racine.appendChild(voile);
      input.focus(); input.select();
    });
  }

  /* -------------------------------- PRÉRÉGLAGES --------------------------------
     Un préréglage est un acte sans son numéro : un modèle et ses données.
     Ceux du club sont livrés (G.prereglages), les siens vivent dans le
     navigateur, et un fichier .json les fait voyager d'un poste à l'autre. */
  function tousPrereglages() {
    return (G.prereglages || []).map(function (p) { return Object.assign({ livre: true }, p); }).concat(prereglages);
  }

  function garderPrereglage() {
    if (!modeleActif) return;
    demander("Garder comme préréglage", "Le nom sous lequel il apparaîtra dans l'accueil.", donnees.titre || modeleActif.nom)
      .then(function (nom) {
        if (!nom) return;
        var d = JSON.parse(JSON.stringify(donnees));
        delete d.numero;
        var p = { id: identifiant(), nom: nom, modele: modeleActif.cle, donnees: d, maj: Date.now() };
        return dbPoser(MAG_PRE, p).then(function () {
          prereglages = prereglages.filter(function (q) { return q.id !== p.id; });
          prereglages.unshift(p);
          dire('Préréglage « ' + nom + ' » gardé', 'ok');
        });
      });
  }

  function exporterPrereglage(p) {
    var b = new Blob([JSON.stringify({ greffe: 'prereglage', nom: p.nom, modele: p.modele, donnees: p.donnees }, null, 2)],
                     { type: 'application/json;charset=utf-8' });
    var u = URL.createObjectURL(b), a = document.createElement('a');
    a.href = u; a.download = 'Prereglage - ' + String(p.nom).replace(/[\\/:*?"<>|]/g, '-') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  }

  function deposerPrereglages(fichiers) {
    Array.prototype.slice.call(fichiers || []).reduce(function (p, f) {
      return p.then(function () {
        return f.text().then(function (txt) {
          var o = JSON.parse(txt);
          if (!o || o.greffe !== 'prereglage' || !o.modele || !o.donnees) throw new Error(f.name + ' : pas un préréglage du Greffe');
          if (!G.modeles[o.modele]) throw new Error(f.name + ' : modèle « ' + o.modele + ' » inconnu ici');
          var q = { id: identifiant(), nom: o.nom || f.name.replace(/\.json$/i, ''), modele: o.modele, donnees: o.donnees, maj: Date.now() };
          return dbPoser(MAG_PRE, q).then(function () { prereglages.unshift(q); });
        });
      });
    }, Promise.resolve()).then(function () {
      peindreAccueil(); dire('Préréglage déposé', 'ok');
    }).catch(function (e) { dire(e && e.message ? e.message : String(e), 'erreur'); });
  }

  /* ----------------------------- les articles ----------------------------- */
  function articlesAuto() {
    return modeleActif.articlesParDefaut ? modeleActif.articlesParDefaut(donnees) : [];
  }

  /* Tant que rien n'a été modifié à la main, les articles suivent les
     données. Dès qu'il en modifie un, on cesse de les réécrire sous
     ses doigts : donnees.articles n'est plus null. */
  function majArticlesSiAuto() {
    if (donnees.articles) return;
    peindreArticles();
  }

  function peindreArticles() {
    var hote = $('gf-zone-articles');
    if (!hote || !modeleActif.articlesParDefaut) return;
    var auto = !donnees.articles;
    var arts = auto ? articlesAuto() : donnees.articles;

    var barre = '<div class="gf-tab-barre">'
      + '<span class="gf-tab-compte">' + arts.length + ' article' + (arts.length > 1 ? 's' : '')
      + (auto ? ' · rédigés depuis les données' : ' · modifiés à la main') + '</span>'
      + (auto ? '' : '<button type="button" class="gf-mini" id="gf-art-reinit">Textes d\'origine</button>')
      + '<button type="button" class="gf-mini" id="gf-art-plus">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
      + 'Ajouter</button></div>';

    var liste = arts.map(function (a, i) {
      return '<div class="gf-art" data-i="' + i + '">'
        + '<div class="gf-art-tete"><span class="gf-art-num">' + deuxChiffres(i + 1) + '</span>'
        + '<div class="gf-in gf-riche gf-riche-ligne" data-ch="titre" data-riche="ligne" contenteditable="true" spellcheck="false" data-vide="Titre de l\'article">' + enLigne(a.titre || '') + '</div>'
        + '<button type="button" class="gf-rang-sup" title="Retirer" aria-label="Retirer">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
        + '</button></div>'
        + '<div class="gf-ta gf-riche" data-ch="texte" data-riche="zone" contenteditable="true" spellcheck="false" data-vide="Texte de l\'article">' + paragraphes(a.texte || '') + '</div>'
        + '</div>';
    }).join('');

    hote.innerHTML = barre + liste
      + '<p class="gf-aide">Entrée : un nouveau paragraphe ; Maj+Entrée : à la ligne ; Ctrl+B, I, U : gras, italique, souligné. Les articles s\'écrivent aussi sur la feuille.</p>';

    function figer() {
      if (!donnees.articles) donnees.articles = articlesAuto().map(function (a) {
        return { titre: a.titre, texte: a.texte };
      });
    }

    hote.querySelectorAll('.gf-art').forEach(function (d) {
      var i = +d.getAttribute('data-i');
      d.querySelectorAll('[data-ch]').forEach(function (n) {
        n.addEventListener('input', function () {
          figer(); donnees.articles[i][n.getAttribute('data-ch')] = n.hasAttribute('data-riche') ? lireChampRiche(n) : n.value; salir(); planifier();
        });
        if (n.hasAttribute('data-riche')) {
          n.addEventListener('paste', function (e) { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); });
          n.addEventListener('keydown', function (e) {
            if (n.getAttribute('data-riche') === 'ligne' && e.key === 'Enter') { e.preventDefault(); n.blur(); return; }
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && /^[biu]$/.test(e.key.toLowerCase())) { e.preventDefault(); document.execCommand('styleWithCSS', false, true); document.execCommand({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]); }
          });
          n.addEventListener('blur', function () { var a2 = (donnees.articles || articlesAuto())[i]; if (a2) peindreChampRiche(n, a2[n.getAttribute('data-ch')]); });
        }
      });
      d.querySelector('.gf-rang-sup').addEventListener('click', function () {
        figer(); donnees.articles.splice(i, 1); salir(); peindreArticles(); planifier();
      });
    });

    $('gf-art-plus').addEventListener('click', function () {
      figer(); donnees.articles.push({ titre: 'Nouvel article', texte: '' });
      salir(); peindreArticles(); planifier();
    });
    var raz = $('gf-art-reinit');
    if (raz) raz.addEventListener('click', function () {
      donnees.articles = null; salir(); peindreArticles(); planifier();
    });
  }

  /* =================================================================
     8. COLLER UNE LISTE : l'analyseur, sans réseau
     Les étiquettes reconnues sont celles des colonnes du tableau, plus
     une poignée de synonymes courants. Une colonne ajoutée devient donc
     reconnaissable au collage, sans rien coder.
     ================================================================= */
  var SYNONYMES = {
    nom:       /^(nom\s*(et\s*pr[ée]noms?\(?s?\)?)?|pr[ée]noms?\s*et\s*nom)$/i,
    qualite:   /^(qualit[ée]|fonction|poste|r[ôo]le)$/i,
    piece:     /^(passeport|cni|nin|passeport\s*\/\s*cni\s*\/\s*nin|pi[èe]ce|num[ée]ro\s*de\s*pi[èe]ce|identit[ée])$/i,
    naissance: /^(date\s*de\s*naissance|naissance|n[ée]\(?e?\)?\s*le)$/i,
    maillot:   /^(num[ée]ro\s*de\s*maillot|n[°o]?\s*maillot|maillot|dossard)$/i
  };
  var VIDES = /^(non\s*renseign[ée]e?|aucun[e]?|n[ée]ant|sans|n\/?a|[-–—·.]+)$/i;

  function nettoyerValeur(v) {
    v = String(v || '').trim().replace(/\s+/g, ' ');
    return VIDES.test(v) ? '' : v;
  }

  /* Une étiquette lue dans le texte collé, vers une clé de colonne. */
  function cleDepuisEtiquette(etiq, cols) {
    var brut = String(etiq || '').trim();
    var n = normaliser(brut);
    for (var i = 0; i < cols.length; i++) {
      if (normaliser(cols[i].titre) === n || cols[i].cle === n) return cols[i].cle;
    }
    for (var j = 0; j < cols.length; j++) {
      var re = SYNONYMES[cols[j].cle];
      if (re && re.test(brut)) return cols[j].cle;
    }
    return null;
  }

  function ligneVide(cols) {
    var l = {}; cols.forEach(function (c) { l[c.cle] = ''; }); return l;
  }
  function ligneUtile(l, cols) {
    var p = (cols[0] || {}).cle;
    return l && String(l[p] || '').trim().length > 1;
  }

  /* Forme 1 : des blocs étiquetés « Nom et prénom(s) : X ». */
  function lireEtiquete(texte, cols) {
    var out = [], cur = null, premiere = (cols[0] || {}).cle;
    texte.split(/\r?\n/).forEach(function (ligne) {
      var l = ligne.trim();
      if (!l) return;
      var i = l.indexOf(':');
      if (i === -1) return;
      var cle = cleDepuisEtiquette(l.slice(0, i), cols);
      if (!cle) return;
      var val = nettoyerValeur(l.slice(i + 1));
      if (cle === premiere) { if (ligneUtile(cur, cols)) out.push(cur); cur = ligneVide(cols); }
      if (!cur) cur = ligneVide(cols);
      cur[cle] = val;
    });
    if (ligneUtile(cur, cols)) out.push(cur);
    return out;
  }

  /* Une ligne d'en-tête ne se reconnaît pas à sa première cellule :
     « N° » ne se laisse pas attraper par un \b, « ° » n'étant pas un
     caractère de mot, et l'en-tête passait pour une personne. On compte
     donc les intitulés de colonne présents sur la ligne. */
  function estEntete(ligne, cols) {
    var t = normaliser(ligne);
    var n = 0;
    cols.forEach(function (c) {
      var k = normaliser(c.titre);
      if (k && k.length > 2 && t.indexOf(k) !== -1) n++;
    });
    return n >= 2;
  }

  /* Forme 2 : un tableau copié, colonnes séparées par tabulation ou
     par deux espaces et plus. */
  function lireTableau(texte, cols) {
    var out = [];
    texte.split(/\r?\n/).forEach(function (ligne) {
      var l = ligne.replace(/\s+$/, '');
      if (!l.trim()) return;
      if (estEntete(l, cols)) return;
      var cells = l.split(/\t+|\s{2,}/).map(function (x) { return x.trim(); })
        .filter(function (x) { return x !== ''; });
      if (cells.length < 2) return;
      if (/^\d{1,3}$/.test(cells[0]) && cells.length > cols.length) cells.shift();
      var m = ligneVide(cols);
      cols.forEach(function (c, i) { m[c.cle] = nettoyerValeur(cells[i] || ''); });
      if (ligneUtile(m, cols)) out.push(m);
    });
    return out;
  }

  function analyser(texte, source) {
    var cols = G.colonnes(donnees, source);
    if (!cols.length) return [];
    var a = lireEtiquete(texte, cols);
    return a.length ? a : lireTableau(texte, cols);
  }

  var collerSource = null;
  function ouvrirColler(source) {
    collerSource = source;
    elt.voile.hidden = false;
    elt.collerTexte.value = '';
    elt.collerBilan.textContent = '';
    elt.collerBilan.className = 'gf-modale-bilan';
    elt.collerOk.disabled = true;
    elt.collerTexte.focus();
  }
  function fermerColler() { elt.voile.hidden = true; }

  /* =================================================================
     9. L'APERÇU
     ================================================================= */
  function cssPolices(sansParaphe) {
    return BESOINS.filter(function (b) { return !b.image && res[b.cle] && !(sansParaphe && b.cle === 'paraphe'); }).map(function (b) {
      return "@font-face{font-family:'" + b.famille + "';src:url(" + res[b.cle] + ");"
           + "font-weight:" + b.graisse + ";font-style:" + (b.italique ? 'italic' : 'normal') + ";}";
    }).join('\n');
  }

  function cssDocument() {
    return G.blocs.css() + (modeleActif && modeleActif.css ? '\n' + modeleActif.css() : '');
  }

  function corpsDocument() {
    /* SANS ENCRE POUR QUI NE SIGNE PAS. On ne touche pas aux donnees de
       l'acte -- avecSignature reste ce qu'il est -- on retire seulement
       le cachet des ressources du rendu. Le president rouvrira le meme
       acte et l'encre y sera, sans qu'il ait rien a recocher. */
    var ressources = G.peutSigner() ? res : Object.assign({}, res, { cachet: null });
    return identiteAppliquee(G.blocs.assembler(modeleActif, donnees,
      { res: ressources, brouillon: filigraneVisible(), sansEncre: !G.peutSigner() }));
  }

  /* À l'écran seulement : le cadre est transparent (la scène de
     l'atelier fournit son fond), et tout ce qui porte data-edit se
     signale sous la souris. Rien de ceci ne part à l'impression ni dans
     le fichier exporté. */
  var CSS_ECRAN = [
    '@media screen{',
    '  html,body{ background:transparent; }',
    '  [data-edit]{ outline:1px dashed transparent; outline-offset:2px; border-radius:2pt; cursor:text; }',
    '  [data-edit]:hover{ outline-color:rgba(70,191,29,.75); }',
    '  [data-edit]:focus{ outline:2px solid #46BF1D; background:rgba(70,191,29,.07); }',
    '  .txt[data-edit]{ min-height:1.2em; }',
    '  td[data-edit]:empty::after{ content:"\\00a0"; }',
    '  tr.tr-suite td{ border-bottom-style:dashed; }',
    '  body.lecture [data-edit]{ outline:none; cursor:default; }',
    /* LA LIAISON, VUE DE LA FEUILLE
       « si on touche a un element on doit aussi voir ca dans le bloc
         concerne ». Un bloc survole dit son nom et se souligne ; le bloc
       qu'on touche reste allume ; le bloc choisi porte un plein contour.
       Rien de tout ceci n'existe a l'impression : c'est du @media screen. */
    '  .bloc{ position:relative; }',
    '  body:not(.lecture) .bloc::after{ content:attr(data-nom); position:absolute; right:0; top:0; z-index:6;',
    '    font-family:Inter,Arial,sans-serif; font-size:5.2pt; font-weight:700; line-height:1; letter-spacing:.13em;',
    '    text-transform:uppercase; color:#0A1B0D; background:#46BF1D; border-radius:0 2pt 0 2pt;',
    '    padding:2.2pt 4pt; opacity:0; pointer-events:none; white-space:nowrap; }',
    '  body:not(.lecture) .bloc:hover::after, body:not(.lecture) .bloc.est-choisi::after{ opacity:1; }',
    '  body:not(.lecture) .bloc:hover{ outline:1px dashed rgba(70,191,29,.45); outline-offset:3px; border-radius:2pt; }',
    '  body:not(.lecture) .bloc.est-lie{ outline:1.5px solid rgba(70,191,29,.5); outline-offset:3px; border-radius:2pt; }',
    '  body:not(.lecture) .bloc.est-survole{ outline:1.5px dashed #46BF1D; outline-offset:3px; border-radius:2pt; background:rgba(70,191,29,.05); }',
    '  body:not(.lecture) .bloc.est-choisi{ outline:2px solid #46BF1D; outline-offset:3px; border-radius:2pt; background:rgba(70,191,29,.06); }',
    '  .est-lie-champ{ box-shadow:0 0 0 2pt rgba(70,191,29,.22); border-radius:2pt; }',
    '  body.depose::after{ content:"Lachez l\'image ici"; position:fixed; inset:0; z-index:99; display:flex;',
    '    align-items:center; justify-content:center; font-family:Inter,Arial,sans-serif; font-size:11pt; font-weight:700;',
    '    color:#0A1B0D; background:rgba(70,191,29,.25); border:3px dashed #46BF1D; pointer-events:none; }',
    '  .objet{ cursor:move; }',
    '  .objet.is-sel{ outline:2px solid #46BF1D; outline-offset:2px; }',
    '  .objet-poignee{ position:absolute; right:-6px; bottom:-6px; width:12px; height:12px; border-radius:99px;',
    '    background:#46BF1D; border:2px solid #fff; cursor:nwse-resize; box-shadow:0 1px 4px rgba(0,0,0,.4); }',
    '  .objet-rotation{ position:absolute; left:50%; top:-22px; width:14px; height:14px; margin-left:-7px; border-radius:99px;',
    '    background:#fff; border:2px solid #46BF1D; cursor:grab; box-shadow:0 1px 4px rgba(0,0,0,.4); }',
    '  .objet-rotation::after{ content:""; position:absolute; left:50%; top:12px; width:2px; height:8px; margin-left:-1px; background:#46BF1D; }',
    '  .s-var{ background:rgba(70,191,29,.12); border-radius:2pt; box-shadow:0 0 0 1px rgba(70,191,29,.25); }',
    '  .s-var-vide{ background:rgba(224,72,63,.12); box-shadow:0 0 0 1px rgba(224,72,63,.35); }',
    '  body.grille .page{ background-image:linear-gradient(to right, rgba(15,67,43,.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,67,43,.12) 1px, transparent 1px); background-size:5mm 5mm; background-position:13mm 11mm; }',
    '  .objet-cadre-sel{ position:absolute; z-index:45; pointer-events:none; border:1px dashed #46BF1D; background:rgba(70,191,29,.08); }',
    '  body.sel-cadre, body.sel-cadre *{ user-select:none; -webkit-user-select:none; }',
    '  .objet-guide{ position:absolute; z-index:40; pointer-events:none; }',
    '  .objet-guide-v{ top:0; bottom:0; width:0; border-left:1px dashed #E0483F; }',
    '  .objet-guide-h{ left:0; right:0; height:0; border-top:1px dashed #E0483F; }',
    '  body.lecture .objet{ cursor:default; }',
    '  body.lecture tr.tr-suite{ display:none; }',
    '}'
  ].join('\n');

  function preparerCadre() {
    var doc = cadre.contentDocument;
    doc.open();
    doc.write('<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">'
      + '<style id="gf-polices">' + cssPolices() + '</style>'
      + '<style id="gf-style">' + cssDocument() + '</style>'
      + '<style id="gf-ecran">' + CSS_ECRAN + '</style>'
      + '</head><body class="pagine"></body></html>');
    doc.close();
    cadrePret = true;
  }

  function planifier() {
    clearTimeout(minuteur);
    minuteur = setTimeout(rafraichir, 220);
  }

  /* Rendre, mettre en pages, brancher l'écriture directe, mesurer.
     Avec « caret » à vrai, on retrouve ensuite le curseur là où il
     était : c'est ce qui permet de refaire la feuille sous les doigts
     de celui qui la modifie sans lui couper la parole. */
  function rafraichir(caret) {
    if (!modeleActif || !cadre) return;
    if (!cadrePret) preparerCadre();
    var doc = cadre.contentDocument;
    var c = caret === true ? caretSauver(doc) : null;
    feuilleSale = false;
    try {
      doc.body.innerHTML = corpsDocument();
      /* modifiable AVANT la mise en pages : un texte vide rendu modifiable
         prend la hauteur d'une ligne, et la page qui semblait tenir déborde */
      brancherEdition(doc);
      nbPages = G.blocs.paginer(doc);
      poserObjets(doc);
    } catch (e) {
      dire('Le modèle a buté : ' + (e && e.message ? e.message : e), 'erreur');
      return;
    }
    brancherEdition(doc);
    mesurer(doc);
    if (c) caretRestaurer(doc, c);
    cacher('texte');
    majBarreBloc(c ? doc.activeElement : null);
    marquerSelection();
    nommerBlocs(doc);
    marquerLiaison(false);
    appliquerGrille();
    /* Les polices arrivent parfois après la première mise en page : les
       hauteurs de ligne changent, les coupures aussi. Une seconde passe
       quand elles sont là, et seulement s'il en manquait. Pas de
       requestAnimationFrame : il ne se déclenche pas dans un onglet qui
       n'est pas rendu, et le compteur restait muet. */
    if (doc.fonts && doc.fonts.status === 'loading') {
      doc.fonts.ready.then(function () { rafraichir(caret === true); });
    }
  }

  function mesurer(doc) {
    try {
      var pages = doc.querySelector('.pages');
      var h = pages ? pages.getBoundingClientRect().height : doc.body.scrollHeight;
      cadre.style.height = Math.ceil(h + 2) + 'px';
      appliquerZoom();
      elt.pages.textContent = nbPages + ' page' + (nbPages > 1 ? 's' : '');
      majActions();
      planifierVignettes();
    } catch (e) { /* le cadre a pu être remplacé entre deux passes */ }
  }

  /* LES VIGNETTES DES PAGES. Un second cadre recoit une copie de la
     feuille rendue, reduite : chaque page y est un bouton qui amene la
     scene dessus, et la page qu'on regarde est soulignee. La copie se
     refait apres chaque mesure, avec un delai : taper ne doit pas
     redessiner deux feuilles a chaque lettre. Se montre et se cache par
     le menu Affichage ; le choix est garde. */
  var vigMinuteur = null, vigPret = false, vigEchelle = 0.155;
  var CLE_VIGNETTES = 'greffe-vignettes';
  function vignettesVoulues() { try { return localStorage.getItem(CLE_VIGNETTES) !== 'non'; } catch (e) { return true; } }
  function basculerVignettes() {
    var v = !vignettesVoulues();
    try { localStorage.setItem(CLE_VIGNETTES, v ? 'oui' : 'non'); } catch (e) {}
    montrerVignettes();
  }
  function montrerVignettes() {
    var hote = $('gf-vignettes'); if (!hote) return;
    var voulues = vignettesVoulues() && !!modeleActif && espace === 'atelier';
    hote.hidden = !voulues;
    if (voulues) planifierVignettes(0);
  }
  function planifierVignettes(delai) {
    clearTimeout(vigMinuteur);
    vigMinuteur = setTimeout(peindreVignettes, delai == null ? 600 : delai);
  }
  function peindreVignettes() {
    var hote = $('gf-vignettes'), vig = $('gf-vig-cadre');
    if (!hote || hote.hidden || !vig || !cadre || !cadrePret) return;
    var doc = cadre.contentDocument, vdoc;
    try { vdoc = vig.contentDocument; } catch (e) { return; }
    if (!vdoc) return;
    if (!vigPret) {
      vdoc.open();
      vdoc.write('<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">'
        + '<style id="gf-polices">' + cssPolices() + '</style>'
        + '<style id="gf-style">' + cssDocument() + '</style>'
        + '<style>html,body{margin:0;background:transparent;overflow:hidden}'
        + ' .pages{transform:scale(' + vigEchelle + ');transform-origin:top left;width:210mm}'
        + ' .page{cursor:pointer;outline:0 solid transparent;transition:outline-color .15s}'
        + ' .page.vig-cour{outline:14px solid rgba(70,191,29,.55)}'
        + ' .page *{pointer-events:none}'
        + ' [contenteditable]{-webkit-user-modify:read-only}</style>'
        + '</head><body class="pagine"></body></html>');
      vdoc.close();
      vigPret = true;
      vdoc.addEventListener('click', function (e) {
        var p = e.target.closest ? e.target.closest('.page') : null; if (!p) return;
        var toutes = Array.prototype.slice.call(vdoc.querySelectorAll('.page'));
        allerPage(toutes.indexOf(p) + 1);
      });
    }
    var src = doc.querySelector('.pages');
    if (!src) return;
    var copie = src.cloneNode(true);
    /* rien d'interactif dans une vignette */
    Array.prototype.forEach.call(copie.querySelectorAll('[contenteditable]'), function (n) { n.removeAttribute('contenteditable'); });
    Array.prototype.forEach.call(copie.querySelectorAll('.objet-poignee, .objet-rotation, .objet-cadre-sel, .objet-guide'), function (n) { n.parentNode && n.parentNode.removeChild(n); });
    vdoc.body.innerHTML = '';
    vdoc.body.appendChild(copie);
    try {
      /* le rectangle est deja reduit par la transformation : pas de
         seconde echelle */
      var h = copie.getBoundingClientRect().height;
      vig.style.height = Math.ceil(h + 8) + 'px';
    } catch (e) {}
    soulignerVignette();
  }
  function soulignerVignette() {
    var vig = $('gf-vig-cadre'); if (!vig || !vigPret) return;
    var vdoc; try { vdoc = vig.contentDocument; } catch (e) { return; }
    if (!vdoc) return;
    var n = pageVisible();
    Array.prototype.forEach.call(vdoc.querySelectorAll('.page'), function (p, i) { p.classList.toggle('vig-cour', i + 1 === n); });
  }

  /* Le zoom porte sur le CADRE, pas sur la feuille : un transform ne
     change pas la place qu'un élément occupe dans la mise en page.
     Mise sur la feuille, la réduction laissait 794 px de large réservés
     pour 556 px affichés, et l'aperçu défilait latéralement pour rien. */
  function zoomLargeur() {
    /* la feuille prend la largeur de la scène, marges comprises */
    var dispo = elt.scene.clientWidth - 44;
    return Math.max(0.25, Math.min(2, dispo / (LARGEUR_CADRE * MM)));
  }
  function zoomPage() {
    var dispo = elt.scene.clientHeight - 44;
    return Math.max(0.25, Math.min(2, dispo / ((297 + 12) * MM)));
  }
  function zoomer(v) {
    zoomChoisi = true;
    zoom = v === 'largeur' ? zoomLargeur() : (v === 'page' ? zoomPage() : Math.max(0.25, Math.min(2, +v)));
    appliquerZoom();
  }
  function pageVisible() {
    /* la page qui occupe le milieu de la scène */
    var doc = cadre && cadrePret ? cadre.contentDocument : null;
    if (!doc) return 1;
    var pages = doc.querySelectorAll('.page'), milieu = elt.scene.scrollTop + elt.scene.clientHeight / 2;
    var cadreTop = cadre.getBoundingClientRect().top - elt.scene.getBoundingClientRect().top + elt.scene.scrollTop;
    for (var i = 0; i < pages.length; i++) {
      var r = pages[i].getBoundingClientRect();
      var bas = cadreTop + (r.top + r.height) * zoom;
      if (milieu <= bas) return i + 1;
    }
    return pages.length || 1;
  }
  function allerPage(n) {
    var doc = cadre && cadrePret ? cadre.contentDocument : null;
    if (!doc) return;
    var pages = doc.querySelectorAll('.page');
    n = Math.max(1, Math.min(pages.length, n));
    var p = pages[n - 1];
    if (!p) return;
    var cadreTop = cadre.getBoundingClientRect().top - elt.scene.getBoundingClientRect().top + elt.scene.scrollTop;
    elt.scene.scrollTop = cadreTop + p.getBoundingClientRect().top * zoom - 12;
    majPointeurPage();
  }
  function majPointeurPage() {
    var p = $('gf-page-cour');
    if (p) p.textContent = pageVisible() + ' / ' + nbPages;
    soulignerVignette();
  }

  function appliquerZoom() {
    var w = LARGEUR_CADRE * MM;
    var h = parseFloat(cadre.style.height) || (w * 1.414);
    cadre.style.transform = 'scale(' + zoom + ')';
    elt.feuille.style.width = Math.round(w * zoom) + 'px';
    elt.feuille.style.height = Math.round(h * zoom) + 'px';
    elt.zoomVal.textContent = Math.round(zoom * 100) + ' %';
    var sel = $('gf-zoom-choix');
    if (sel) sel.value = '';
    majPointeurPage();
  }

  /* =================================================================
     9 bis. ÉCRIRE SUR LA FEUILLE
     Tout ce que le moteur a marqué data-edit devient modifiable en
     place. Chaque frappe réécrit la donnée au chemin indiqué, met le
     formulaire d'accord, et la feuille se refait une fois qu'on a fini
     d'écrire, curseur retrouvé. La donnée reste la seule vérité : la
     feuille n'est jamais lue autrement que pour la réécrire.
     ================================================================= */
  var editMinuteur = null, feuilleSale = false, sourisEnfoncee = false;

  /* Refaire la feuille depuis la donnée, mais pas sous une sélection en
     cours ni sous un bouton de souris enfoncé : on attend que le geste
     soit fini, sinon la sélection s'annule sous les doigts. */
  function refaireQuandCalme() {
    clearTimeout(editMinuteur);
    editMinuteur = setTimeout(function () {
      var doc = cadre && cadrePret ? cadre.contentDocument : null;
      var sel = doc ? doc.getSelection() : null;
      if (sourisEnfoncee || (sel && sel.rangeCount && !sel.isCollapsed && sel.toString())) { refaireQuandCalme(); return; }
      /* Entrée vient d'ouvrir un paragraphe vide et le curseur y est : la
         donnée ne connaît pas les paragraphes vides, la feuille refaite le
         ferait disparaître sous les doigts. On attend qu'on y écrive, ou
         qu'on le quitte. */
      if (sel && sel.rangeCount && sel.isCollapsed && doc.activeElement && doc.activeElement.closest && doc.activeElement.closest('[data-edit]')) {
        var an = sel.anchorNode, bloc = an && (an.nodeType === 3 ? an.parentNode : an);
        var para = bloc && bloc.closest ? bloc.closest('p, li, div.note') : null;
        if (para && !para.textContent.replace(/\u00a0/g, ' ').trim() && doc.activeElement.contains(para)) { refaireQuandCalme(); return; }
      }
      if (!feuilleSale) return;
      feuilleSale = false;
      rafraichir(true);
    }, 700);
  }

  function brancherEdition(doc) {
    var lect = lectureSeule();
    doc.body.classList.toggle('lecture', lect);
    Array.prototype.forEach.call(doc.querySelectorAll('[data-edit]'), function (el) {
      if (lect) { el.removeAttribute('contenteditable'); return; }
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'false');
    });
    if (doc.body.getAttribute('data-branche')) return;
    doc.body.setAttribute('data-branche', '1');
    doc.body.addEventListener('input', surSaisie);
    doc.body.addEventListener('keydown', surTouche);
    doc.body.addEventListener('paste', surCollage);
    doc.body.addEventListener('focusout', surSortie);
    doc.body.addEventListener('focusin', function (e) { majBarreBloc(cibleEdit(e)); lierDepuisFeuille(e.target, false); });
    /* deux clics sur un bloc, hors d'un texte : ses reglages s'ouvrent */
    doc.body.addEventListener('dblclick', function (e) {
      var t = e.target;
      if (!t || !t.closest || t.closest('[data-edit]') || t.closest('.objet')) return;
      var b = t.closest('.bloc[data-bloc]');
      if (!b || lectureSeule()) return;
      e.preventDefault();
      commandeBloc('reglages', b.getAttribute('data-bloc'));
      lieBloc = b.getAttribute('data-bloc'); marquerLiaison(true);
    });
    doc.body.addEventListener('contextmenu', surClicDroit);
    /* une case à cocher se coche d'un clic, sur la feuille : dans la donnée */
    doc.body.addEventListener('click', function (e) {
      if (lectureSeule()) return;
      var cb = e.target.closest ? e.target.closest('.case[data-case]') : null;
      if (cb && !(e.target.closest && e.target.closest('[data-edit]:focus'))) {
        var chemin = cb.getAttribute('data-case');
        ecrire(chemin, !G.blocs.lire(donnees, chemin)); cb.classList.toggle('cochee');
        salir(); synchroniserFormulaire(chemin); feuilleSale = true; refaireQuandCalme();
        return;
      }
      var ph = e.target.closest ? e.target.closest('[data-photo]') : null;
      if (ph) {
        var cheminPhoto = ph.getAttribute('data-photo');
        var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
        inp.addEventListener('change', function () {
          var f = inp.files && inp.files[0]; if (!f) return;
          lireFichier(f).then(function (uri) { return alleger(uri, 480); }).then(function (uri) { ecrire(cheminPhoto, uri); salir(); planifier(); dire('Photo posée', 'ok'); });
        });
        inp.click();
        return;
      }
      var oc = e.target.closest ? e.target.closest('.objet-case') : null;
      if (oc && !glisseADeplace) {
        var o = objetDe(oc.getAttribute('data-objet'));
        if (o && !o.verrou) { o.coche = !o.coche; oc.classList.toggle('cochee', !!o.coche); salir(); if (panneau === 'objet') peindreFormulaire(); }
      }
    });
    brancherDeposeImage(doc);
    doc.body.addEventListener('mousedown', function (e) {
      sourisEnfoncee = true; cacher('slash'); cacher('menu'); surSourisObjet(e);
      lierDepuisFeuille(e.target, e.button === 0);
    });
    doc.addEventListener('mousemove', surSourisBouge);
    doc.addEventListener('mouseup', surSourisLache);
    /* hors d'un texte, les raccourcis valent aussi sur la feuille (Ctrl+V d'un objet, Ctrl+S, Ctrl+P...) */
    doc.addEventListener('keydown', function (e) { if (!surToucheObjet(e) && (e.ctrlKey || e.metaKey || e.altKey || e.key === 'F2') && !cibleEdit(e)) raccourci(e); });
    doc.addEventListener('mouseup', function () { sourisEnfoncee = false; });
    doc.addEventListener('mouseleave', function () { sourisEnfoncee = false; });
    doc.defaultView.addEventListener('blur', function () { sourisEnfoncee = false; });
    doc.addEventListener('selectionchange', function () {
      clearTimeout(majBarreTexte._t); majBarreTexte._t = setTimeout(majBarreTexte, 120);
    });
    if (!elt.scene.getAttribute('data-branche')) {
      elt.scene.setAttribute('data-branche', '1');
      elt.scene.addEventListener('scroll', function () {
        cacher('slash'); cacher('menu');
        clearTimeout(majBarreTexte._s); majBarreTexte._s = setTimeout(function () {
          majBarreTexte(); var d = cadre.contentDocument; majBarreBloc(d && d.activeElement);
        }, 80);
      });
      elt.scene.addEventListener('mousedown', function (e) { if (!e.target.closest('.gf-flot')) cacher('menu'); });
    }
  }

  function cibleEdit(e) {
    var t = e.target;
    if (t && t.nodeType !== 1) t = t.parentNode;
    return (t && t.closest) ? t.closest('[data-edit]') : null;
  }

  /* =================================================================
     LA LIAISON : CE QU'ON TOUCHE S'ALLUME DES DEUX COTES
     « si on touche aussi a un element on doit aussi voir ca dans le
       bloc concerne »
     La feuille et le panneau de gauche disaient la meme chose sans
     jamais se montrer du doigt. Trois chemins, un seul surlignage :
      - toucher un texte ou un bloc de la feuille allume sa ligne dans
        le panneau, ouvre la section qui la contient et l'amene a
        l'ecran ;
      - survoler une ligne du panneau allume le bloc sur la feuille ;
      - un clic hors d'un texte CHOISIT le bloc : ses reglages
        s'ouvrent a droite, et sa barre apparait. C'est par la qu'on
        modifie enfin les parties deja posees d'un prereglage.
     On ouvre une section, on n'en referme jamais.
     ================================================================= */
  var lieBloc = null, lieChemin = null;
  function docFeuille() { return cadre && cadrePret ? cadre.contentDocument : null; }
  function pourSel(v) { return String(v == null ? '' : v).replace(/["\\]/g, '\\$&'); }
  /* chaque bloc de la feuille porte son nom : c'est lui qui s'affiche au
     survol, et c'est le meme mot que dans le panneau */
  function nommerBlocs(doc) {
    if (!doc) return;
    Array.prototype.forEach.call(doc.querySelectorAll('.bloc[data-bloc]'), function (b) {
      b.setAttribute('data-nom', nomDuBloc(b.getAttribute('data-bloc')));
    });
  }
  function marquerLiaison(amener) {
    var doc = docFeuille();
    if (doc) {
      Array.prototype.forEach.call(doc.querySelectorAll('.bloc.est-lie'), function (b) { b.classList.remove('est-lie'); });
      Array.prototype.forEach.call(doc.querySelectorAll('.bloc.est-choisi'), function (b) { b.classList.remove('est-choisi'); });
      Array.prototype.forEach.call(doc.querySelectorAll('.est-lie-champ'), function (b) { b.classList.remove('est-lie-champ'); });
      if (lieBloc) {
        var b = doc.querySelector('.bloc[data-bloc="' + pourSel(lieBloc) + '"]');
        if (b) b.classList.add(blocSel === lieBloc ? 'est-choisi' : 'est-lie');
      }
      if (blocSel && blocSel !== lieBloc) {
        var bs = doc.querySelector('.bloc[data-bloc="' + pourSel(blocSel) + '"]');
        if (bs) bs.classList.add('est-choisi');
      }
      if (lieChemin) {
        var c = doc.querySelector('[data-edit="' + pourSel(lieChemin) + '"]');
        if (c) c.classList.add('est-lie-champ');
      }
    }
    var hote = elt && elt.formDefile;
    if (!hote) return;
    Array.prototype.forEach.call(hote.querySelectorAll('.is-lie'), function (x) { x.classList.remove('is-lie'); });
    var vise = null;
    if (lieBloc && modeleActif && modeleActif.libre && /^b\d+$/.test(lieBloc)) {
      vise = hote.querySelector('.gf-bloc-item[data-i="' + (+lieBloc.slice(1)) + '"]');
    }
    if (!vise && lieChemin) {
      var n = hote.querySelector('[data-cle="' + pourSel(lieChemin) + '"]');
      vise = n ? (n.closest('.gf-champ') || n) : null;
    }
    if (!vise && lieChemin && /^tables\./.test(lieChemin)) {
      vise = hote.querySelector('[data-table="' + pourSel(lieChemin.split('.')[1]) + '"]');
    }
    if (!vise) return;
    vise.classList.add('is-lie');
    var sect = vise.closest('.gf-sect');
    if (sect && !sect.classList.contains('is-ouvert')) sect.classList.add('is-ouvert');
    if (!amener) return;
    clearTimeout(marquerLiaison._t);
    marquerLiaison._t = setTimeout(function () {
      if (!vise.isConnected) return;
      try { vise.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { try { vise.scrollIntoView(); } catch (e2) {} }
    }, 80);
  }
  /* depuis la feuille : qu'est-ce qu'on vient de toucher ? */
  function lierDepuisFeuille(cible, choisir) {
    if (!cible || !cible.closest) { return; }
    if (cible.nodeType !== 1) cible = cible.parentNode;
    if (!cible || !cible.closest) return;
    var bloc = cible.closest('.bloc[data-bloc]');
    var edit = cible.closest('[data-edit]');
    lieBloc = bloc ? bloc.getAttribute('data-bloc') : null;
    lieChemin = edit ? edit.getAttribute('data-edit') : null;
    /* hors d'un texte et hors d'un objet : le bloc se CHOISIT */
    if (choisir && lieBloc && !edit && !cible.closest('.objet') && !lectureSeule()) {
      blocSel = lieBloc;
      propsOnglet = 'proprietes';
      ouvrirProps(false);
      peindreProps(); majOutils();
      majBarreBloc(bloc.querySelector('[data-edit]') || bloc);
    } else if (edit && blocSel) {
      blocSel = null;
      if (propsOnglet === 'proprietes') peindreProps();
    }
    marquerLiaison(true);
  }
  /* depuis le panneau : la ligne survolee allume son bloc sur la feuille */
  function survolerBloc(bi) {
    var doc = docFeuille(); if (!doc) return;
    Array.prototype.forEach.call(doc.querySelectorAll('.bloc.est-survole'), function (b) { b.classList.remove('est-survole'); });
    if (!bi) return;
    var b = doc.querySelector('.bloc[data-bloc="' + pourSel(bi) + '"]');
    if (b) b.classList.add('est-survole');
  }
  function amenerBlocAEcran(bi) {
    var doc = docFeuille(), sc = elt && elt.scene;
    if (!doc || !sc) return;
    var b = doc.querySelector('.bloc[data-bloc="' + pourSel(bi) + '"]');
    if (!b) return;
    var r = b.getBoundingClientRect(), rs = sc.getBoundingClientRect();
    if (r.top >= rs.top + 6 && r.bottom <= rs.bottom - 6) return;
    sc.scrollTop += (r.top - rs.top) - Math.min(120, sc.clientHeight / 3);
  }
  /* le panneau de gauche, cable une fois pour toutes : il se repeint
     souvent, la delegation survit a chaque repeinte */
  function brancherLiaisonPanneau() {
    var hote = elt && elt.formDefile;
    if (!hote || hote.getAttribute('data-liaison')) return;
    hote.setAttribute('data-liaison', '1');
    hote.addEventListener('mouseover', function (e) {
      var it = e.target.closest ? e.target.closest('.gf-bloc-item[data-i]') : null;
      survolerBloc(it ? 'b' + it.getAttribute('data-i') : null);
      var ch = e.target.closest ? e.target.closest('[data-cle]') : null;
      var doc = docFeuille();
      if (doc) {
        Array.prototype.forEach.call(doc.querySelectorAll('.est-lie-champ'), function (x) { x.classList.remove('est-lie-champ'); });
        if (ch) {
          var c = doc.querySelector('[data-edit="' + pourSel(ch.getAttribute('data-cle')) + '"]');
          if (c) c.classList.add('est-lie-champ');
        } else if (lieChemin) {
          var c2 = doc.querySelector('[data-edit="' + pourSel(lieChemin) + '"]');
          if (c2) c2.classList.add('est-lie-champ');
        }
      }
    });
    hote.addEventListener('mouseleave', function () { survolerBloc(null); });
    hote.addEventListener('click', function (e) {
      var nom = e.target.closest ? e.target.closest('.gf-bloc-nom, .gf-rang-num') : null;
      if (!nom) return;
      var it = nom.closest('.gf-bloc-item[data-i]');
      if (!it) return;
      var bi = 'b' + it.getAttribute('data-i');
      lieBloc = bi; lieChemin = null; blocSel = bi;
      propsOnglet = 'proprietes';
      ouvrirProps(true);
      peindreProps(); majOutils(); marquerLiaison(false); amenerBlocAEcran(bi);
      dire('Bloc « ' + nomDuBloc(bi) + ' » choisi · ses réglages sont à droite', 'ok');
    });
    hote.addEventListener('focusin', function (e) {
      var ch = e.target.closest ? e.target.closest('[data-cle]') : null;
      if (!ch) return;
      var doc = docFeuille(); if (!doc) return;
      var c = doc.querySelector('[data-edit="' + pourSel(ch.getAttribute('data-cle')) + '"]');
      if (!c) return;
      Array.prototype.forEach.call(doc.querySelectorAll('.est-lie-champ'), function (x) { x.classList.remove('est-lie-champ'); });
      c.classList.add('est-lie-champ');
      var b = c.closest('.bloc[data-bloc]');
      if (b) amenerBlocAEcran(b.getAttribute('data-bloc'));
    });
  }

  function surSaisie(e) {
    var el = cibleEdit(e);
    if (!el) return;
    var chemin = el.getAttribute('data-edit');
    var valeur = el.classList.contains('txt')
      ? depuisDomMorceaux(el.ownerDocument, chemin)
      : depuisDomLigne(el);
    ecrire(chemin, valeur);
    salir();
    synchroniserFormulaire(chemin);
    feuilleSale = true;
    refaireQuandCalme();
  }

  function surTouche(e) {
    var el = cibleEdit(e);
    if (!el) return;
    surSlash(e, el);
    if (e.key === 'Escape') { if (flot.slash && !flot.slash.hidden) return; e.preventDefault(); el.blur(); return; }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && /^[biu]$/.test(e.key.toLowerCase())) {
      e.preventDefault(); commandeTexte({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]); return;
    }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && blocCourant && modeleActif.libre) {
      e.preventDefault(); commandeBloc(e.key === 'ArrowUp' ? 'monter' : 'descendre', blocCourant); return;
    }
    if (e.ctrlKey || e.metaKey || (e.altKey && /^([1-9]|[nw])$/i.test(e.key))) { raccourci(e); return; }
    /* un champ d'une ligne : Entrée valide, elle n'ouvre pas de ligne */
    if (e.key === 'Enter' && !el.classList.contains('txt')) { e.preventDefault(); el.blur(); }
  }

  /* Coller ne fait entrer que du texte : la mise en forme d'un mail ou
     d'un Word n'a rien à faire dans un acte. */
  function surCollage(e) {
    var el = cibleEdit(e);
    if (!el) return;
    e.preventDefault();
    var t = (e.clipboardData || window.clipboardData).getData('text/plain');
    cadre.contentDocument.execCommand('insertText', false, t);
  }

  function surSortie(e) {
    if (!cibleEdit(e)) return;
    /* rien à refaire si rien n'a changé : la sélection qu'on est en train
       de prendre ailleurs sur la feuille reste intacte */
    if (feuilleSale) refaireQuandCalme();
  }

  /* « titre », « articles.2.texte », « tables.membres.lignes.4.nom » :
     le chemin dit où écrire. Deux cas demandent une préparation : des
     articles encore automatiques deviennent des articles à la main, et
     une ligne de tableau qui n'existe pas encore est créée, avec celles
     qui la précèdent. */
  function ecrire(chemin, valeur) {
    /* un acte émis, ou en lecture, ne s'écrit pas, même par un champ atteint au clavier */
    if (lectureSeule()) return;
    var p = chemin.split('.');
    if (p[0] === 'articles' && !donnees.articles) {
      donnees.articles = articlesAuto().map(function (a) { return { titre: a.titre, texte: a.texte }; });
    }
    if (p[0] === 'tables' && p[2] === 'lignes') {
      var t = table(p[1]), i = +p[3];
      while (t.lignes.length <= i) {
        var l = {}; t.colonnes.forEach(function (c) { l[c.cle] = ''; }); t.lignes.push(l);
      }
    }
    var o = donnees;
    for (var k = 0; k < p.length - 1; k++) {
      if (o[p[k]] == null) o[p[k]] = /^\d+$/.test(p[k + 1]) ? [] : {};
      o = o[p[k]];
    }
    o[p[p.length - 1]] = valeur;
    /* dans un acte libre, le grand titre de la feuille nomme aussi l'acte
       au registre et dans le nom du fichier */
    if (modeleActif && modeleActif.libre && /^blocs\.\d+\.texte$/.test(chemin)) {
      var bloc = donnees.blocs[+p[1]];
      if (bloc && bloc.b === 'titre') { donnees.titre = valeur; majTitreBarre(); }
    }
  }

  function synchroniserFormulaire(chemin) {
    var p = chemin.split('.');
    clearTimeout(synchroniserFormulaire._t);
    if (p[0] === 'tables') {
      synchroniserFormulaire._t = setTimeout(function () { peindreTable(p[1]); }, 400);
      return;
    }
    if (p[0] === 'articles') {
      synchroniserFormulaire._t = setTimeout(peindreArticles, 400);
      return;
    }
    var n = elt.formDefile.querySelector('[data-cle="' + p[0] + '"]');
    if (n && n.type === 'checkbox') n.checked = !!donnees[p[0]];
    else if (n && n.hasAttribute('data-riche')) { if (document.activeElement !== n) peindreChampRiche(n, donnees[p[0]]); }
    else if (n) n.value = donnees[p[0]] == null ? '' : donnees[p[0]];
    majTitreBarre();
  }

  /* La feuille redevient du texte : un paragraphe par bloc, « - » devant
     chaque puce, « > » devant une note, **gras** autour du gras. C'est
     exactement la grammaire que paragraphes() lit. */
  /* Un champ d'une ligne : le texte, ses marques (gras, teinte…), et
     l'espace qu'on vient de taper au bout, qui attend le mot suivant. */
  function depuisDomLigne(el) {
    return enLigneDom(el).replace(/\n+$/, '').replace(/\n/g, ' ').replace(/\u00a0/g, ' ');
  }
  /* Relire une ligne de la feuille : on marche le DOM avec le style
     hérité (gras, italique, souligné, surligné, teinte, taille), un
     enfant qui dit « font-weight: normal » ou « background: transparent »
     ANNULE ce que son parent posait : c'est ainsi que le navigateur
     retire un gras ou un surlignage, et c'est ce qui ne se relisait pas.
     Les morceaux voisins de même style se recollent ; les espaces
     restent hors des marques. */
  function styleHerite(el, herite) {
    var s = { b: herite.b, i: herite.i, u: herite.u, m: herite.m, teinte: herite.teinte, dim: herite.dim, maj: herite.maj };
    var st = el.style || {}, tag = el.tagName, cls = el.className || '';
    if (tag === 'B' || tag === 'STRONG') { s.b = true; s.fin = false; }
    if (/\bs-fin\b/.test(cls)) { s.b = false; s.fin = true; }
    if (st.fontWeight) { var fw = String(st.fontWeight).toLowerCase(); s.b = fw === 'bold' || fw === 'bolder' || (+fw >= 600); s.fin = !s.b; }
    if (tag === 'I' || tag === 'EM') { s.i = true; s.droit = false; }
    if (/\bs-droit\b/.test(cls)) { s.i = false; s.droit = true; }
    if (st.fontStyle) { s.i = /italic|oblique/.test(st.fontStyle); s.droit = !s.i; }
    if (tag === 'U') s.u = true;
    var td = st.textDecorationLine || st.textDecoration || '';
    if (td) s.u = /underline/.test(td);
    if (tag === 'MARK') s.m = true;
    if (st.backgroundColor) s.m = !/transparent|rgba\(0,\s*0,\s*0,\s*0\)|initial|inherit|unset|^$/.test(st.backgroundColor);
    var clsTeinte = (cls.match(/\bs-(or|vert|rouge|gris)\b/) || [])[1];
    var couleur = st.color || (tag === 'FONT' && el.getAttribute('color')) || '';
    if (clsTeinte) s.teinte = clsTeinte; else if (couleur) s.teinte = teinteDe(couleur) || '';
    var clsDim = (cls.match(/\bs-(grand|petit)\b/) || [])[1];
    var taille = st.fontSize || (tag === 'FONT' && el.getAttribute('size')) || '';
    if (clsDim) s.dim = clsDim; else if (taille) s.dim = tailleDe(taille) || '';
    if (/\bs-maj\b/.test(cls)) s.maj = true;
    return s;
  }
  function cleStyle(s) { return [s.b ? 1 : 0, s.i ? 1 : 0, s.u ? 1 : 0, s.m ? 1 : 0, s.teinte || '', s.dim || '', s.maj ? 1 : 0, s.fin ? 1 : 0, s.droit ? 1 : 0].join('|'); }
  /* ce que la feuille de style donne déjà au texte relu : un titre est
     gras par lui-même ; le mettre en gras n'ajoute rien, le mettre en
     maigre demande une marque ({{fin|…}}), sinon la feuille refaite le
     rend gras « comme avant » */
  var baseGras = false, baseItal = false;
  function decorer(t, s) {
    if (!t.trim()) return t;
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(t), av = m[1], ap = m[3];
    t = m[2];
    if (s.b && !baseGras) t = '**' + t + '**';
    if (s.fin && baseGras) t = '{{fin|' + t + '}}';
    if (s.i && !baseItal) t = '*' + t + '*';
    if (s.droit && baseItal) t = '{{droit|' + t + '}}';
    if (s.u) t = '__' + t + '__';
    if (s.m) t = '==' + t + '==';
    if (s.teinte) t = '{{' + s.teinte + '|' + t + '}}';
    if (s.dim) t = '{{' + s.dim + '|' + t + '}}';
    if (s.maj) t = '{{maj|' + t + '}}';
    return av + t + ap;
  }
  function enLigneDom(racine) {
    var runs = [];
    try {
      var cs = racine.ownerDocument.defaultView.getComputedStyle(racine);
      baseGras = cs.fontWeight === 'bold' || (+cs.fontWeight >= 600);
      baseItal = /italic|oblique/.test(cs.fontStyle);
    } catch (e) { baseGras = false; baseItal = false; }
    function marcher(n, st) {
      Array.prototype.forEach.call(n.childNodes, function (c) {
        if (c.nodeType === 3) { if (c.nodeValue) runs.push({ t: c.nodeValue.replace(/\u00a0/g, ' '), s: st }); return; }
        if (c.nodeType !== 1) return;
        if (c.tagName === 'BR') { runs.push({ br: true }); return; }
        if (c.hasAttribute && c.hasAttribute('data-var')) { runs.push({ v: c.getAttribute('data-var') }); return; }
        marcher(c, styleHerite(c, st));
      });
    }
    marcher(racine, {});
    var out = '', i = 0;
    while (i < runs.length) {
      var r = runs[i];
      if (r.br) { out += '\n'; i++; continue; }
      if (r.v) { out += '{{' + r.v + '}}'; i++; continue; }
      var k = cleStyle(r.s), txt = r.t;
      while (i + 1 < runs.length && runs[i + 1].t != null && cleStyle(runs[i + 1].s) === k) { i++; txt += runs[i].t; }
      out += decorer(txt, r.s);
      i++;
    }
    return out;
  }
  /* Le paginateur peut couper un texte sur deux pages : deux éléments
     portent alors le même chemin. La donnée, elle, est une : on relit
     les morceaux dans l'ordre. */
  function morceauxDe(doc, chemin) {
    return Array.prototype.slice.call(doc.querySelectorAll('[data-edit="' + chemin + '"]'));
  }
  function depuisDomMorceaux(doc, chemin) {
    /* un morceau qui commence par la suite d'un paragraphe coupé se recolle au précédent, sans saut */
    return morceauxDe(doc, chemin).map(function (m) {
      var t = depuisDom(m), prem = m.firstElementChild;
      return (t !== '' && prem && prem.hasAttribute('data-suite')) ? '\u0001' + t : t;
    }).filter(function (t) { return t !== ''; }).join('\n\n').replace(/\n\n\u0001/g, '').replace(/\u0001/g, '');
  }
  function depuisDom(el) {
    var out = [];
    Array.prototype.forEach.call(el.childNodes, function (n) {
      if (n.nodeType === 3) { if (n.nodeValue.trim()) out.push(n.nodeValue.trim()); return; }
      if (n.nodeType !== 1) return;
      if (n.tagName === 'UL' || n.tagName === 'OL') {
        out.push(Array.prototype.map.call(n.children, function (li) {
          return '- ' + enLigneDom(li).replace(/\s+/g, ' ').trim();
        }).join('\n'));
      } else if (n.classList.contains('note')) {
        out.push('> ' + enLigneDom(n).replace(/\s+/g, ' ').trim());
      } else {
        var t = enLigneDom(n).replace(/\n+$/, '');
        if (t.trim()) { if (n.hasAttribute('data-suite') && out.length) out[out.length - 1] += t; else out.push(t); }
      }
    });
    return out.join('\n\n');
  }

  /* Une couleur posée par le navigateur (rgb(...) ou #hex) vers l'une des
     teintes de la charte ; rien si elle n'en est pas. */
  function teinteDe(c) {
    if (!c) return '';
    var m = String(c).match(/(\d+)\D+(\d+)\D+(\d+)/), h = String(c).match(/^#([0-9a-f]{6})$/i);
    var r, g, b;
    if (h) { r = parseInt(h[1].slice(0, 2), 16); g = parseInt(h[1].slice(2, 4), 16); b = parseInt(h[1].slice(4, 6), 16); }
    else if (m) { r = +m[1]; g = +m[2]; b = +m[3]; }
    else return '';
    var proches = { or: [193, 164, 98], vert: [15, 67, 43], rouge: [180, 35, 31], gris: [140, 148, 143] };
    var meilleur = '', dist = 1e9;
    Object.keys(proches).forEach(function (k) {
      var p = proches[k], dd = (p[0] - r) * (p[0] - r) + (p[1] - g) * (p[1] - g) + (p[2] - b) * (p[2] - b);
      if (dd < dist) { dist = dd; meilleur = k; }
    });
    return dist < 2500 ? meilleur : '';
  }
  function tailleDe(t) {
    if (!t) return '';
    var s = String(t).trim().toLowerCase(), n = parseFloat(s);
    if (/^\d+$/.test(s)) return n >= 4 ? 'grand' : (n <= 2 ? 'petit' : '');   /* <font size> */
    /* execCommand('fontSize') avec styleWithCSS écrit un mot-clé : x-large, small… */
    if (/^(x+-)?large(r)?$/.test(s)) return 'grand';
    if (/^(x+-)?small(er)?$/.test(s)) return 'petit';
    if (/em|%/.test(s)) return n > 1.1 ? 'grand' : (n < 0.95 ? 'petit' : '');
    if (/px$/.test(s)) return n >= 15 ? 'grand' : (n <= 10 ? 'petit' : '');
    if (/pt$/.test(s)) return n >= 11 ? 'grand' : (n <= 7 ? 'petit' : '');
    return '';
  }

  /* Le curseur se retient comme un chemin et un rang de caractère : la
     feuille refaite depuis la donnée a la même forme, on l'y remet. */
  function caretSauver(doc) {
    try {
      var sel = doc.getSelection();
      if (!sel || !sel.rangeCount) return null;
      var r = sel.getRangeAt(0);
      var el = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentNode;
      el = el && el.closest ? el.closest('[data-edit]') : null;
      if (!el) return null;
      var avant = r.cloneRange();
      avant.selectNodeContents(el);
      avant.setEnd(r.startContainer, r.startOffset);
      var rang = avant.toString().length, chemin = el.getAttribute('data-edit');
      /* les morceaux qui précèdent celui-ci comptent aussi */
      var morceaux = morceauxDe(doc, chemin);
      for (var i = 0; i < morceaux.length && morceaux[i] !== el; i++) rang += morceaux[i].textContent.length;
      return { chemin: chemin, rang: rang };
    } catch (e) { return null; }
  }

  function caretRestaurer(doc, c) {
    var morceaux = morceauxDe(doc, c.chemin);
    if (!morceaux.length) return;
    var reste = c.rang, dernier = null, elDernier = null;
    for (var i = 0; i < morceaux.length; i++) {
      var el = morceaux[i];
      var walker = doc.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */, null), n;
      while ((n = walker.nextNode())) {
        dernier = n; elDernier = el;
        if (reste <= n.nodeValue.length) { el.focus(); poserCaret(doc, n, reste); caretVisible(doc); return; }
        reste -= n.nodeValue.length;
      }
    }
    var cible = elDernier || morceaux[morceaux.length - 1];
    cible.focus();
    if (dernier) poserCaret(doc, dernier, dernier.nodeValue.length);
    caretVisible(doc);
  }
  /* le curseur, remis sur une autre page après une coupure, doit se voir */
  function caretVisible(doc) {
    try {
      var sel = doc.getSelection();
      if (!sel || !sel.rangeCount) return;
      var r = sel.getRangeAt(0).getBoundingClientRect();
      if (!r || (!r.height && !r.width)) return;
      var p = enScene(r), sc = elt.scene;
      var haut = sc.scrollTop, bas = haut + sc.clientHeight;
      if (p.y < haut + 40) sc.scrollTop = Math.max(0, p.y - 80);
      else if (p.y + p.h > bas - 40) sc.scrollTop = p.y + p.h - sc.clientHeight + 80;
    } catch (e) {}
  }

  function poserCaret(doc, noeud, rang) {
    var r = doc.createRange();
    r.setStart(noeud, rang); r.collapse(true);
    var s = doc.getSelection();
    s.removeAllRanges(); s.addRange(r);
  }

  /* =================================================================
     9 ter. ANNULER, RÉTABLIR, ET NE RIEN PERDRE
     Une pile d'états de la donnée, pas du DOM : chaque geste (frappe sur
     la feuille, champ du formulaire, bloc posé) laisse un état, les
     frappes rapprochées n'en laissent qu'un. Ctrl+Z revient, Ctrl+Y
     avance, et la feuille comme le formulaire se refont depuis l'état.
     ================================================================= */
  var histo = [], histoI = -1, histoMinuteur = null;

  function histoDepart() {
    histo = [JSON.stringify(donnees)]; histoI = 0;
    histoBoutons();
  }
  function histoNoter() {
    clearTimeout(histoMinuteur);
    histoMinuteur = setTimeout(function () {
      var s = JSON.stringify(donnees);
      if (histo[histoI] === s) return;
      histo = histo.slice(0, histoI + 1);
      histo.push(s);
      if (histo.length > 80) histo.shift();
      histoI = histo.length - 1;
      histoBoutons();
    }, 500);
  }
  function histoAller(i) {
    if (i < 0 || i >= histo.length) return;
    clearTimeout(histoMinuteur);
    histoI = i;
    donnees = JSON.parse(histo[i]);
    acteSauve = false; majTitreBarre();
    peindreFormulaire();
    rafraichir();
    histoBoutons();
  }
  function annuler() { histoAller(histoI - 1); }
  function retablir() { histoAller(histoI + 1); }
  function histoBoutons() {
    var a = $('gf-annuler'), r = $('gf-retablir');
    if (a) a.disabled = histoI <= 0;
    if (r) r.disabled = histoI >= histo.length - 1;
  }

  /* L'enregistrement automatique : un acte déjà au registre s'y remet
     tout seul, 20 s après le dernier geste. Un acte neuf attend son
     premier enregistrement (Ctrl+S, impression, ou fermeture). */
  var autoMinuteur = null;
  function autoEnregistrer() {
    clearTimeout(autoMinuteur);
    autoMinuteur = setTimeout(function () {
      if (modeleActif && !acteSauve && acteTouche && acteEtat === 'brouillon') enregistrer(true, true);
    }, 4000);
  }

  /* ---- avant de quitter : ce qui n'a pas été voulu se choisit ---- */
  function changementsNonValides() {
    if (!modeleActif || acteEtat !== 'brouillon' || modeLecture) return false;
    var f = ficheCourante(); delete f.maj;
    /* un acte neuf : rien a demander tant qu'on n'y a rien ecrit */
    if (acteReference == null) return acteTouche;
    var r = JSON.parse(acteReference); delete r.maj;
    return JSON.stringify(f) !== JSON.stringify(r);
  }
  /* revenir à la référence : l'acte reprend sa dernière forme voulue ;
     un acte jamais enregistré de la main disparaît du registre */
  function revenirALaReference() {
    clearTimeout(autoMinuteur);
    if (acteReference == null) {
      if (!acteId) return Promise.resolve();
      var id = acteId;
      registre = registre.filter(function (a) { return a.id !== id; });
      return dbOter(MAG_ACTES, id).catch(function () {});
    }
    var fiche = JSON.parse(acteReference);
    registre = registre.filter(function (a) { return a.id !== fiche.id; });
    registre.unshift(fiche);
    return dbPoser(MAG_ACTES, fiche).catch(function () {});
  }
  function avantDeQuitter(suite) {
    if (!changementsNonValides()) { suite(); return; }
    var nom = (modeleActif.libre && String(donnees.titre || '').trim()) || String(donnees.nomActe || '').trim() || modeleActif.nom;
    modale('Acte non enregistré',
      '<p class="gf-modale-aide"><b>' + ech(nom) + (donnees.numero ? ' n° ' + ech(donnees.numero) : '') + '</b> a été modifié depuis son dernier enregistrement. Que faire de ces modifications ?</p>',
      [{ lab: 'Rester', rester: true }, { lab: 'Quitter sans enregistrer', abandon: true }, { lab: 'Enregistrer et quitter', accent: true, garder: true }]
    ).then(function (b) {
      if (!b || b.rester) return;
      if (b.garder) enregistrer(true).then(suite);
      else revenirALaReference().then(suite);
    });
  }

  /* La reprise : où l'on en était, pour rouvrir au même endroit après un
     rafraîchissement de la page. Effacée quand on quitte le Greffe soi-même. */
  var CLE_REPRISE = 'bbc-greffe-reprise';
  function noterReprise() {
    try {
      if (acteId) localStorage.setItem(CLE_REPRISE, JSON.stringify({ acte: acteId, t: Date.now() }));
    } catch (e) {}
  }
  function oublierReprise() { try { localStorage.removeItem(CLE_REPRISE); } catch (e) {} }
  function lireReprise() {
    try {
      var r = JSON.parse(localStorage.getItem(CLE_REPRISE) || 'null');
      return (r && r.acte && Date.now() - (r.t || 0) < 36e5 * 12) ? r : null;
    } catch (e) { return null; }
  }
  G.aReprendre = function () { return !!lireReprise(); };

  /* Revenir aux textes tels que le modèle les écrit : les surcharges
     faites sur la feuille s'effacent, les articles redeviennent
     automatiques. La donnée (noms, dates, lignes) reste. */
  function textesOrigine() {
    var n = Object.keys(donnees.fixes || {}).length + (donnees.articles ? 1 : 0);
    if (!n) { dire('Rien n\'a été réécrit sur cet acte.', 'ok'); return; }
    donnees.fixes = {}; donnees.articles = null;
    salir(); peindreFormulaire(); planifier();
    dire('Textes d\'origine rétablis', 'ok');
  }

  /* =================================================================
     9 quater. SAUVEGARDER LE GREFFE, LE RESTAURER
     IndexedDB est un rangement commode, pas une archive : un profil
     Chrome réinitialisé, un disque perdu, un poste changé, et tout
     s'en va. D'où un fichier : registre, actes, préréglages. Jamais le
     cachet ni les polices : ils se redéposent, ils ne voyagent pas.
     ================================================================= */
  function sauvegarderGreffe() {
    var contenu = {
      greffe: 'sauvegarde', version: 3, date: new Date().toISOString(),
      actes: registre, prereglages: prereglages, dossiers: dossiers, club: G.club
    };
    var b = new Blob([JSON.stringify(contenu)], { type: 'application/json;charset=utf-8' });
    var u = URL.createObjectURL(b), a = document.createElement('a');
    a.href = u; a.download = 'BAOBABS_GREFFE_' + isoDuJour() + '.greffe.json';
    document.body.appendChild(a); a.click(); a.remove();
    derniereSauvegarde = Date.now();
    dbPoser(MAG_REG, { cle: 'sauvegarde', valeur: derniereSauvegarde }).then(function () { if (espace === 'accueil') peindreAccueil(); });
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
    dire('Sauvegarde téléchargée : ' + registre.length + ' acte' + (registre.length > 1 ? 's' : '')
       + ', ' + prereglages.length + ' préréglage' + (prereglages.length > 1 ? 's' : ''), 'ok');
  }

  function restaurerGreffe(fichier) {
    if (!fichier) return;
    fichier.text().then(function (txt) {
      var o = JSON.parse(txt);
      if (!o || o.greffe !== 'sauvegarde' || !o.actes) throw new Error('Ce fichier n\'est pas une sauvegarde du Greffe.');
      var nA = 0, nP = 0;
      var p = Promise.resolve();
      (o.actes || []).forEach(function (f) {
        if (!f || !f.id) return;
        var local = registre.filter(function (a) { return a.id === f.id; })[0];
        if (local && (local.maj || 0) >= (f.maj || 0)) return;   /* le plus récent gagne */
        p = p.then(function () { return dbPoser(MAG_ACTES, f); }).then(function () {
          registre = registre.filter(function (a) { return a.id !== f.id; }); registre.push(f); nA++;
        });
      });
      (o.prereglages || []).forEach(function (q) {
        if (!q || !q.id) return;
        var local = prereglages.filter(function (a) { return a.id === q.id; })[0];
        if (local && (local.maj || 0) >= (q.maj || 0)) return;
        p = p.then(function () { return dbPoser(MAG_PRE, q); }).then(function () {
          prereglages = prereglages.filter(function (a) { return a.id !== q.id; }); prereglages.push(q); nP++;
        });
      });
      (o.dossiers || []).forEach(function (d) {
        if (!d || !d.id) return;
        var local = dossierDe(d.id);
        if (local && (local.maj || 0) >= (d.maj || 0)) return;
        p = p.then(function () { return dbPoser(MAG_DOS, d); }).then(function () { dossiers = dossiers.filter(function (x) { return x.id !== d.id; }); dossiers.push(d); });
      });
      if (o.club && typeof o.club === 'object') {
        p = p.then(function () { G.club = Object.assign({}, CLUB_DEFAUT, o.club); return dbPoser(MAG_REG, { cle: 'club', valeur: G.club }); });
      }
      return p.then(function () {
        registre.sort(function (a, b) { return (b.maj || 0) - (a.maj || 0); });
        prereglages.sort(function (a, b) { return (b.maj || 0) - (a.maj || 0); });
        peindreAccueil();
        dire('Restauré : ' + nA + ' acte' + (nA > 1 ? 's' : '') + ', ' + nP + ' préréglage' + (nP > 1 ? 's' : '')
           + (nA + nP ? '' : ' (rien de plus récent que ce poste)'), 'ok');
      });
    }).catch(function (e) { dire(e && e.message ? e.message : String(e), 'erreur'); });
  }

  /* =================================================================
     9 quinquies. LES BARRES CONTEXTUELLES
     Rien de permanent : une barre de texte quand des mots sont
     sélectionnés, une barre de bloc quand on écrit dans un bloc, la
     commande « / » et le clic droit pour poser un texte prédéfini.
     Elles vivent dans la scène, au-dessus du cadre, et se placent
     depuis les coordonnées de la feuille corrigées du zoom.
     ================================================================= */
  var flot = { texte: null, bloc: null, slash: null, menu: null };
  var blocCourant = null;     /* l'index (b3) du bloc où l'on écrit */
  var slashEl = null;         /* la zone où « / » a été tapé */

  function enScene(rect) {
    /* un rectangle du document de la feuille -> coordonnées de .gf-scene */
    var c = cadre.getBoundingClientRect(), s = elt.scene.getBoundingClientRect();
    return {
      x: c.left + rect.left * zoom - s.left + elt.scene.scrollLeft,
      y: c.top + rect.top * zoom - s.top + elt.scene.scrollTop,
      w: rect.width * zoom, h: rect.height * zoom
    };
  }
  function boite(cle, classe) {
    if (flot[cle]) return flot[cle];
    var b = document.createElement('div');
    b.className = 'gf-flot ' + classe;
    b.hidden = true;
    /* un clic sur la barre ne doit pas faire perdre la sélection de la feuille */
    b.addEventListener('mousedown', function (e) { if (e.target.tagName !== 'INPUT') e.preventDefault(); });
    elt.scene.appendChild(b);
    flot[cle] = b;
    return b;
  }
  function cacher(cle) { if (flot[cle]) flot[cle].hidden = true; }
  function cacherTout() { Object.keys(flot).forEach(cacher); }

  /* ---- la barre de texte : gras, italique, souligné, surligné, teinte, taille ---- */
  var TEINTES_BARRE = [['or', '#C1A462'], ['vert', '#0F432B'], ['rouge', '#B4231F'], ['gris', '#8C948F']];
  function barreTexte() {
    var b = boite('texte', 'gf-flot-texte');
    if (b.innerHTML) return b;
    b.innerHTML =
      '<button type="button" data-cmd="bold" title="Gras (Ctrl+B)"><b>B</b></button>'
      + '<button type="button" data-cmd="italic" title="Italique (Ctrl+I)"><i>I</i></button>'
      + '<button type="button" data-cmd="underline" title="Souligné (Ctrl+U)"><u>U</u></button>'
      + '<button type="button" data-cmd="surligner" title="Surligner"><mark>ab</mark></button>'
      + '<span class="gf-flot-sep"></span>'
      + TEINTES_BARRE.map(function (t) {
          return '<button type="button" class="gf-flot-teinte" data-teinte="' + t[1] + '" title="' + t[0] + '" style="--t:' + t[1] + '"></button>';
        }).join('')
      + '<span class="gf-flot-sep"></span>'
      + '<button type="button" data-cmd="grand" title="Plus grand">A<sup>+</sup></button>'
      + '<button type="button" data-cmd="petit" title="Plus petit">A<sup>−</sup></button>'
      + '<span class="gf-flot-sep"></span>'
      + '<button type="button" data-cmd="effacer" title="Effacer le style">✕</button>';
    b.querySelectorAll('[data-cmd]').forEach(function (x) {
      x.addEventListener('click', function () { commandeTexte(x.getAttribute('data-cmd')); });
    });
    b.querySelectorAll('[data-teinte]').forEach(function (x) {
      x.addEventListener('click', function () { commandeTexte('teinte', x.getAttribute('data-teinte')); });
    });
    return b;
  }
  /* envelopper la sélection d'un style neutre : ce que le navigateur ne
     sait pas défaire (une taille, une teinte posées par une classe) */
  function envelopperSelection(doc, style) {
    var sel = doc.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return;
    var r = sel.getRangeAt(0), tmp = doc.createElement('div');
    tmp.appendChild(r.cloneContents());
    doc.execCommand('insertHTML', false, '<span style="' + style + '">' + tmp.innerHTML + '</span>');
  }
  function commandeTexte(cmd, arg) {
    var doc = cadre.contentDocument, win = cadre.contentWindow;
    if (!doc) return;
    win.focus();
    try { doc.execCommand('styleWithCSS', false, true); } catch (e) {}
    /* ce que porte déjà la sélection : le second clic retire */
    function dejaSous(regle) {
      try {
        var sel = doc.getSelection(); if (!sel || !sel.rangeCount) return false;
        var n = sel.getRangeAt(0).commonAncestorContainer; if (n.nodeType === 3) n = n.parentNode;
        var el = n && n.closest ? n.closest('[data-edit]') : null;
        for (var x = n; x && x !== el; x = x.parentNode) { if (regle(x)) return true; }
      } catch (e) {}
      return false;
    }
    if (cmd === 'bold' || cmd === 'italic' || cmd === 'underline') doc.execCommand(cmd);
    else if (cmd === 'surligner') {
      var surligne = dejaSous(function (x) { return x.tagName === 'MARK' || (x.style && x.style.backgroundColor && !/transparent/.test(x.style.backgroundColor)); });
      doc.execCommand('hiliteColor', false, surligne ? 'transparent' : '#FFF0B3');
    }
    else if (cmd === 'teinte') {
      var meme = dejaSous(function (x) { return (x.style && x.style.color && teinteDe(x.style.color) === teinteDe(arg)) || /\bs-(or|vert|rouge|gris)\b/.test(x.className || ''); });
      if (meme) envelopperSelection(doc, 'color:inherit'); else doc.execCommand('foreColor', false, arg);
    }
    else if (cmd === 'grand') {
      /* le navigateur ne sait pas « retirer » une taille posée par une classe :
         on enveloppe la sélection d'une taille neutre, que la relecture efface */
      var grand = dejaSous(function (x) { return /\bs-grand\b/.test(x.className || '') || (x.style && tailleDe(x.style.fontSize) === 'grand'); });
      if (grand) envelopperSelection(doc, 'font-size:1em'); else doc.execCommand('fontSize', false, '5');
    }
    else if (cmd === 'petit') {
      var petit = dejaSous(function (x) { return /\bs-petit\b/.test(x.className || '') || (x.style && tailleDe(x.style.fontSize) === 'petit'); });
      if (petit) envelopperSelection(doc, 'font-size:1em'); else doc.execCommand('fontSize', false, '2');
    }
    else if (cmd === 'effacer') doc.execCommand('removeFormat');
    /* execCommand a déclenché « input » : la donnée est déjà réécrite */
    majBarreTexte();
  }
  function majBarreTexte() {
    var doc = cadre && cadrePret ? cadre.contentDocument : null;
    if (!doc || lectureSeule()) { cacher('texte'); return; }
    var sel = doc.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) { cacher('texte'); return; }
    var r = sel.getRangeAt(0);
    var n = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentNode;
    var el = n && n.closest ? n.closest('[data-edit]') : null;
    if (!el || !r.toString().trim()) { cacher('texte'); return; }
    var b = barreTexte();
    var p = enScene(r.getBoundingClientRect());
    b.hidden = false;
    b.style.left = Math.max(4, p.x + p.w / 2 - b.offsetWidth / 2) + 'px';
    b.style.top = Math.max(4, p.y - b.offsetHeight - 8) + 'px';
    ['bold', 'italic', 'underline'].forEach(function (c) {
      var x = b.querySelector('[data-cmd="' + c + '"]');
      var actif = false; try { actif = doc.queryCommandState(c); } catch (e) {}
      x.classList.toggle('is-actif', !!actif);
    });
  }

  /* ---- la barre de bloc : monter, descendre, dupliquer, retirer, réglages ---- */
  function barreBloc() {
    var b = boite('bloc', 'gf-flot-bloc');
    return b;
  }
  function majBarreBloc(el) {
    var doc = cadre && cadrePret ? cadre.contentDocument : null;
    if (!doc || lectureSeule() || !el) { cacher('bloc'); blocCourant = null; return; }
    var bloc = el.closest('.bloc[data-bloc]');
    if (!bloc) { cacher('bloc'); blocCourant = null; return; }
    var bi = bloc.getAttribute('data-bloc');
    blocCourant = bi;
    if (!objetSel && !blocSel && propsOnglet === 'proprietes') { clearTimeout(peindreProps._t); peindreProps._t = setTimeout(peindreProps, 120); }
    var libre = !!(modeleActif && modeleActif.libre && /^b\d+$/.test(bi));
    var i = libre ? +bi.slice(1) : -1;
    var nb = libre ? (donnees.blocs || []).length : 0;
    var b = barreBloc();
    var nom = nomDuBloc(bi);
    b.innerHTML =
      '<span class="gf-flot-nom">' + ech(nom) + '</span>'
      + (libre ? '<button type="button" data-b="monter" title="Monter (Alt+Haut)"' + (i <= 0 ? ' disabled' : '') + '>↑</button>'
              + '<button type="button" data-b="descendre" title="Descendre (Alt+Bas)"' + (i >= nb - 1 ? ' disabled' : '') + '>↓</button>'
              + '<button type="button" data-b="dupliquer" title="Dupliquer">⧉</button>'
              + '<button type="button" data-b="retirer" title="Retirer ce bloc">✕</button>' : '')
      + '<button type="button" data-b="reglages" title="Réglages du bloc : taille, alignement, couleur">⋯</button>';
    b.querySelectorAll('[data-b]').forEach(function (x) {
      x.addEventListener('click', function () { commandeBloc(x.getAttribute('data-b'), bi); });
    });
    var p = enScene(bloc.getBoundingClientRect());
    b.hidden = false;
    b.style.left = Math.max(4, p.x + p.w - b.offsetWidth) + 'px';
    b.style.top = Math.max(4, p.y - b.offsetHeight - 4) + 'px';
  }
  function nomDuBloc(bi) {
    if (!modeleActif) return 'Bloc';
    if (modeleActif.libre && /^b\d+$/.test(bi)) {
      var x = (donnees.blocs || [])[+bi.slice(1)];
      var e = x && modeleActif.catalogue ? modeleActif.catalogue.filter(function (c) { return c.type === x.b; })[0] : null;
      return e ? e.nom : (x ? x.b : 'Bloc');
    }
    var page = G.blocs.val(modeleActif.page, donnees, {}) || [];
    var m = /^b(\d+)/.exec(bi);
    var cfg = m ? page[+m[1]] : null;
    var noms = { entete: 'En-tête', titre: 'Titre', reperes: 'Cases de repères', encadre: 'Encadré', parties: 'Parties', phrase: 'Phrase',
                 articles: 'Articles', lettre: 'Lettre', signatures: 'Signatures', annexe: 'Annexe', tableau: 'Tableau', postes: 'Postes',
                 chips: 'Pastilles', certification: 'Certification', texte: 'Texte', image: 'Image', espace: 'Espace' };
    return cfg ? (noms[cfg.b] || cfg.b) : 'Bloc';
  }
  function commandeBloc(cmd, bi) {
    if (cmd === 'reglages') { blocSel = bi; propsOnglet = 'proprietes'; ouvrirProps(true); peindreProps(); majOutils(); return; }
    if (!modeleActif.libre) return;
    var i = +bi.slice(1), blocs = donnees.blocs || [];
    if (cmd === 'monter' && i > 0) { var t = blocs[i - 1]; blocs[i - 1] = blocs[i]; blocs[i] = t; deplacerStyle(bi, 'b' + (i - 1)); }
    else if (cmd === 'descendre' && i < blocs.length - 1) { var u = blocs[i + 1]; blocs[i + 1] = blocs[i]; blocs[i] = u; deplacerStyle(bi, 'b' + (i + 1)); }
    else if (cmd === 'dupliquer') {
      var copie = JSON.parse(JSON.stringify(blocs[i]));
      if (copie.b === 'tableau' && copie.source) {
        var src = 't' + Date.now().toString(36);
        donnees.tables[src] = JSON.parse(JSON.stringify(donnees.tables[copie.source] || { colonnes: [], lignes: [] }));
        copie.source = src;
      }
      if (copie.b === 'articles') { dire('Un seul bloc d\'articles par acte.', 'erreur'); return; }
      blocs.splice(i + 1, 0, copie);
    }
    else if (cmd === 'retirer') {
      var x = blocs[i];
      blocs.splice(i, 1);
      if (x.b === 'tableau' && x.source && donnees.tables) delete donnees.tables[x.source];
      delete (donnees.styles || {})[bi];
    }
    cacher('bloc'); blocCourant = null;
    salir(); peindreFormulaire(); rafraichir();
  }
  function deplacerStyle(a, b) {
    var s = donnees.styles || {};
    var sa = s[a], sb = s[b];
    if (sa) s[b] = sa; else delete s[b];
    if (sb) s[a] = sb; else delete s[a];
    donnees.styles = s;
  }
  function styleBloc(bi, cle, valeur) {
    donnees.styles = donnees.styles || {};
    var s = donnees.styles[bi] || {};
    if (valeur == null || valeur === '' || valeur === 'gauche' && cle === 'align' || valeur === 100 && cle === 'taille') delete s[cle];
    else s[cle] = valeur;
    if (Object.keys(s).length) donnees.styles[bi] = s; else delete donnees.styles[bi];
    salir(); rafraichir(true);
    if (blocSel) peindreProps();
  }

  /* le panneau quand un bloc est sélectionné : taille, alignement, thème,
     et pour un acte libre les réglages propres au bloc */
  var blocSel = null;
  function peindreBloc(hote) {
    hote = hote || $('gf-props-corps') || elt.formDefile;
    var bi = blocSel;
    if (!bi) { peindreProps(); return; }
    var st = (donnees.styles || {})[bi] || {};
    var libre = !!(modeleActif.libre && /^b\d+$/.test(bi));
    var x = libre ? (donnees.blocs || [])[+bi.slice(1)] : null;
    var e = x && modeleActif.catalogue ? modeleActif.catalogue.filter(function (c) { return c.type === x.b; })[0] : null;
    function choix(cle, options, courant) {
      return '<div class="gf-puces">' + options.map(function (o) {
        return '<button type="button" class="gf-puce' + (String(courant) === String(o[0]) ? ' is-actif' : '') + '" data-st="' + cle + '" data-v="' + o[0] + '">' + o[1] + '</button>';
      }).join('') + '</div>';
    }
    var reglages = (e && e.reglages || []).map(function (c) {
      var champ = Object.assign({}, c, { cle: 'blocs.' + (+bi.slice(1)) + '.' + c.cle });
      return '<div class="gf-champ">' + champHtml(champ) + '</div>';
    }).join('');
    hote.innerHTML =
      '<div class="gf-controle">'
      + '<p class="gf-acc-intro"><b>' + ech(nomDuBloc(bi)) + '</b><br>'
      + (libre
          ? 'Son texte s\'écrit sur la feuille. Ici : sa taille, son alignement, sa couleur, sa police, et ses propres réglages.'
          : 'Cet acte suit un modèle fixe : le bloc ne se retire pas, mais sa taille, son alignement, sa couleur et sa police se règlent ici, et son texte s\'écrit sur la feuille.')
      + '</p>'
      + '<span class="gf-lab">Taille</span>' + choix('taille', [[85, 'Petit'], [100, 'Normal'], [112, 'Grand'], [125, 'Très grand']], st.taille || 100)
      + '<span class="gf-lab" style="margin-top:12px">Alignement</span>' + choix('align', [['gauche', 'Gauche'], ['centre', 'Centre'], ['droite', 'Droite']], st.align || 'gauche')
      + '<span class="gf-lab" style="margin-top:12px">Couleur</span>' + choix('theme', [['', 'Charte'], ['vert', 'Vert'], ['rouge', 'Rouge'], ['neutre', 'Neutre'], ['plein', 'Bandeau plein']], st.theme || '')
      + '<span class="gf-lab" style="margin-top:12px">Police</span>' + choix('police', [['', 'Charte'], ['gilroy', 'Gilroy'], ['inter', 'Inter'], ['organetto', 'Organetto'], ['paraphe', 'Manuscrite']], st.police || '')
      + (reglages ? '<span class="gf-lab" style="margin-top:12px">Réglages du bloc</span>' + reglages : '')
      + '<div class="gf-controle-actions" style="margin-top:16px"><button type="button" class="gf-btn gf-btn-fant" id="gf-bloc-retour">Fermer les réglages</button></div>'
      + '</div>';
    hote.querySelectorAll('[data-st]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-v'); if (/^\d+$/.test(v)) v = +v;
        styleBloc(bi, b.getAttribute('data-st'), v);
      });
    });
    hote.querySelectorAll('[data-cle]').forEach(function (n) {
      var c = n.getAttribute('data-cle');
      var v = G.blocs.lire(donnees, c);
      if (n.type === 'checkbox') { n.checked = !!v; n.addEventListener('change', function () { ecrire(c, n.checked); salir(); planifier(); }); }
      else if (n.hasAttribute('data-riche')) { brancherChampRiche(n, c, null); }
      else { n.value = v == null ? '' : v; n.addEventListener('input', function () { ecrire(c, n.value); salir(); planifier(); }); }
    });
    hote.querySelectorAll('[data-image]').forEach(function (n) {
      n.addEventListener('change', function () {
        var f = n.files && n.files[0]; if (!f) return;
        lireFichier(f).then(function (uri) { return alleger(uri, 1600); }).then(function (uri) { ecrire(n.getAttribute('data-image'), uri); salir(); planifier(); });
      });
    });
    $('gf-bloc-retour').addEventListener('click', function () { blocSel = null; peindreProps(); marquerLiaison(false); });
  }

  /* ---- « / » et le clic droit : les textes prédéfinis ---- */
  function listeTextes(filtre) {
    var q = String(filtre || '').toLowerCase();
    var vars = VARIABLES.filter(function (v) { return v[0].indexOf('<') === -1; }).map(function (v) { return { nom: v[1] + ' ' + v[0], groupe: 'Variables', texte: v[0] }; });
    Object.keys((donnees && donnees.tables) || {}).forEach(function (k) {
      var t = donnees.tables[k];
      if ((t.colonnes || []).some(function (c) { return c.total; })) vars.push({ nom: 'Total du tableau « ' + (t.titre || k) + ' » {{total.' + k + '}}', groupe: 'Variables', texte: '{{total.' + k + '}}' });
    });
    Object.keys((donnees && donnees.serie) || {}).forEach(function (k) {
      vars.push({ nom: 'Série : ' + k + ' {{col.' + k + '}}', groupe: 'Variables', texte: '{{col.' + k + '}}' });
    });
    return (G.textes || []).concat(vars).filter(function (t) { return !q || t.nom.toLowerCase().indexOf(q) !== -1 || (t.groupe || '').toLowerCase().indexOf(q) !== -1; });
  }
  function insererVariable() {
    var doc = cadre && cadrePret ? cadre.contentDocument : null;
    if (!doc) return;
    var noms = listeTextes('variables').map(function (t) { return t.texte; });
    demander('Insérer une variable', "Elle s'écrit avec sa valeur sur la feuille, et reste une variable dans la donnée. Cliquez d'abord dans le texte où la poser.", '', noms).then(function (v) {
      if (!v) return;
      var sel = doc.getSelection();
      var el = sel && sel.rangeCount ? (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode) : null;
      el = el && el.closest ? el.closest('[data-edit]') : null;
      if (!el) { dire("Cliquez d'abord dans un texte de la feuille, puis insérez la variable.", 'erreur'); return; }
      cadre.contentWindow.focus();
      doc.execCommand('insertText', false, v);
    });
  }
  function ouvrirSlash(el, filtre) {
    var doc = cadre.contentDocument;
    var sel = doc.getSelection();
    if (!sel || !sel.rangeCount) return;
    slashEl = el;
    try { slashRange = sel.getRangeAt(0).cloneRange(); } catch (e) { slashRange = null; }
    var b = boite('slash', 'gf-flot-slash');
    var items = listeTextes(filtre);
    b.innerHTML = '<div class="gf-slash-tete">Insérer un texte' + (filtre ? ' · ' + ech(filtre) : '') + '</div>'
      + (items.length ? items.map(function (t, i) {
          return '<button type="button" data-t="' + i + '"><b>' + ech(t.nom) + '</b><span>' + ech(t.groupe || '') + '</span></button>';
        }).join('') : '<p class="gf-vide">Rien de ce nom.</p>');
    b.querySelectorAll('[data-t]').forEach(function (x) {
      x.addEventListener('click', function () { insererTexte(items[+x.getAttribute('data-t')].texte, filtre); });
    });
    var p = enScene(sel.getRangeAt(0).getBoundingClientRect());
    b.hidden = false;
    b.style.left = Math.max(4, Math.min(p.x, elt.scene.clientWidth - 300)) + 'px';
    b.style.top = (p.y + p.h + 6) + 'px';
  }
  var slashRange = null, menuRange = null;
  function insererTexte(texte, filtre) {
    var doc = cadre.contentDocument;
    cadre.contentWindow.focus();
    if (slashRange) {
      try { var s0 = doc.getSelection(); s0.removeAllRanges(); s0.addRange(slashRange); } catch (e) {}
      slashRange = null;
    }
    /* retirer le « / » et ce qui a été tapé après, puis poser le texte */
    var n = 1 + (filtre ? filtre.length : 0);
    for (var k = 0; k < n; k++) doc.execCommand('delete');
    doc.execCommand('insertText', false, texte);
    cacher('slash'); slashEl = null;
  }
  function surSlash(e, el) {
    /* appelé au keydown dans une zone modifiable : « / » en début de ligne ouvre la liste */
    if (e.key === '/' && el.classList.contains('txt')) {
      var doc = cadre.contentDocument, sel = doc.getSelection();
      if (!sel || !sel.rangeCount || !sel.isCollapsed) return;
      var r = sel.getRangeAt(0);
      var avant = r.startContainer.nodeType === 3 ? r.startContainer.nodeValue.slice(0, r.startOffset) : '';
      if (avant.trim()) return;                     /* pas en milieu de phrase */
      setTimeout(function () { ouvrirSlash(el, ''); }, 0);
      return;
    }
    if (flot.slash && !flot.slash.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); cacher('slash'); slashEl = null; return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        var premier = flot.slash.querySelector('[data-t]'); if (premier) premier.click();
        return;
      }
      if (e.key === 'Backspace' || e.key.length === 1) {
        setTimeout(function () {
          var doc = cadre.contentDocument, sel = doc.getSelection();
          if (!sel || !sel.rangeCount) return;
          var r = sel.getRangeAt(0);
          var avant = r.startContainer.nodeType === 3 ? r.startContainer.nodeValue.slice(0, r.startOffset) : '';
          var m = /\/([^\/]*)$/.exec(avant);
          if (!m) { cacher('slash'); slashEl = null; return; }
          ouvrirSlash(el, m[1]);
        }, 0);
      }
    }
  }
  function surClicDroit(e) {
    var el = cibleEdit(e);
    if (!el || lectureSeule()) return;
    e.preventDefault();
    var doc = cadre.contentDocument, sel = doc.getSelection();
    /* le texte se posera sous le clic droit, pas là où le curseur traînait */
    try {
      var sous = doc.caretRangeFromPoint ? doc.caretRangeFromPoint(e.clientX, e.clientY) : null;
      if (sous && el.contains(sous.startContainer) && (!sel.rangeCount || sel.isCollapsed)) { sel.removeAllRanges(); sel.addRange(sous); }
      menuRange = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    } catch (err) { menuRange = null; }
    var b = boite('menu', 'gf-flot-slash');
    var textes = listeTextes('');
    var groupes = {};
    textes.forEach(function (t) { (groupes[t.groupe || 'Textes'] = groupes[t.groupe || 'Textes'] || []).push(t); });
    b.innerHTML = '<div class="gf-slash-tete">Insérer un texte prédéfini</div>'
      + Object.keys(groupes).map(function (g) {
          return '<div class="gf-slash-groupe">' + ech(g) + '</div>' + groupes[g].map(function (t) {
            return '<button type="button" data-t="' + textes.indexOf(t) + '"><b>' + ech(t.nom) + '</b></button>';
          }).join('');
        }).join('');
    b.querySelectorAll('[data-t]').forEach(function (x) {
      x.addEventListener('click', function () {
        cadre.contentWindow.focus();
        if (menuRange) { try { var s1 = doc.getSelection(); s1.removeAllRanges(); s1.addRange(menuRange); } catch (err) {} menuRange = null; }
        doc.execCommand('insertText', false, textes[+x.getAttribute('data-t')].texte);
        cacher('menu');
      });
    });
    var s = elt.scene.getBoundingClientRect(), c = cadre.getBoundingClientRect();
    b.hidden = false;
    b.style.left = Math.max(4, Math.min(c.left + e.clientX * zoom - s.left + elt.scene.scrollLeft, elt.scene.clientWidth - 300)) + 'px';
    b.style.top = (c.top + e.clientY * zoom - s.top + elt.scene.scrollTop) + 'px';
  }

  /* =================================================================
     9 sexies. LES OBJETS POSÉS SUR LA PAGE
     Le troisième niveau, au-dessus du document et de ses blocs : une
     signature, un cachet, une image, une annotation, un cadre, une
     flèche, posés à un endroit d'une page, en millimètres depuis son
     coin haut gauche. Ils se déplacent à la souris, se redimensionnent
     par leur poignée, se règlent dans le panneau, et s'enregistrent
     avec l'acte (donnees.objets). Le cachet naît verrouillé : un
     élément sensible ne se déplace pas par mégarde.
     ================================================================= */
  var objetSel = null, glisse = null;
  var TYPES_OBJET = {
    signature:  { nom: 'Signature',  w: 48, h: 22, sensible: true },
    cachet:     { nom: 'Cachet',     w: 26, h: 26, sensible: true, verrou: true },
    image:      { nom: 'Image',      w: 50, h: 35 },
    annotation: { nom: 'Annotation', w: 60, h: 14, texte: 'Annotation' },
    cadre:      { nom: 'Cadre',      w: 60, h: 30 },
    ellipse:    { nom: 'Rond',       w: 42, h: 28 },
    ligne:      { nom: 'Trait',      w: 60, h: 4 },
    fleche:     { nom: 'Flèche',     w: 40, h: 10 },
    /* le surligneur naît translucide : un feutre ne cache pas le texte */
    surligneur: { nom: 'Surligneur', w: 55, h: 6, couleur: 'jaune', op: 38 },
    case:       { nom: 'Case à cocher', w: 45, h: 6, texte: 'À cocher' }
  };
  /* les teintes des objets, en un seul endroit : la feuille et le
     panneau lisent la même table */
  var TEINTES_OBJET = { or: '#C1A462', vert: '#0F432B', rouge: '#B4231F', gris: '#8C948F',
                        noir: '#15201A', bleu: '#152E72', jaune: '#F2D64B' };

  function poserObjet(type, extra) {
    if (!modeleActif || lectureSeule()) return;
    var T = TYPES_OBJET[type];
    if (!T) return;
    if (type === 'cachet' && !res.cachet) { dire('Déposez d\'abord le cachet dans les paramètres.', 'erreur'); return; }
    if (type === 'signature' && !res.paraphe) { dire('Déposez d\'abord la police de signature dans les paramètres.', 'erreur'); return; }
    donnees.objets = donnees.objets || [];
    var page = 1;
    try {
      var doc = cadre.contentDocument, act = doc.activeElement;
      var p = act && act.closest ? act.closest('.page') : null;
      if (p) page = Array.prototype.indexOf.call(doc.querySelectorAll('.page'), p) + 1;
    } catch (e) {}
    var o = Object.assign({ id: 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type: type, page: page,
                            x: 120, y: 200, w: T.w, h: T.h, rotation: 0, opacite: (T.op == null ? 100 : T.op),
                            texte: T.texte || '', couleur: T.couleur || 'or',
                            verrou: !!T.verrou }, extra || {});
    donnees.objets.push(o);
    salir(); rafraichir();
    objetSel = o.id; objetsSel = [o.id]; panneau = 'objet'; peindreFormulaire();
    setTimeout(function () { marquerSelection(); }, 50);
    dire(T.nom + ' posé' + (type === 'annotation' ? 'e' : '') + ' sur la page ' + page + (o.verrou ? ' · verrouillé' : ''), 'ok');
  }
  /* =================================================================
     UNE IMAGE POSEE SE MODIFIE
     « on peut pas incruster des images ni les modifier »
     On pouvait en poser une, et plus rien apres : ni la remplacer, ni
     la recadrer, ni la border. Voici ce qui manquait, dans le panneau
     de droite, plus deux chemins pour l'incruster sans passer par la
     barre d'outils : glisser le fichier sur la feuille, ou coller une
     image du presse-papiers.
     ================================================================= */
  function panneauImage(o) {
    var ajust = o.ajust || 'contenir';
    var teinte = o.teinte || 'couleur';
    function puces(cle, options, courant) {
      return '<div class="gf-puces">' + options.map(function (x) {
        return '<button type="button" class="gf-puce' + (String(courant) === String(x[0]) ? ' is-actif' : '') + '" data-oi="' + cle + '" data-oiv="' + x[0] + '">' + x[1] + '</button>';
      }).join('') + '</div>';
    }
    return '<div class="gf-props-titre">L\'image</div>'
      + '<div class="gf-controle-actions" style="justify-content:flex-start;flex-wrap:wrap;margin-bottom:10px">'
      + '<button type="button" class="gf-mini" data-img="remplacer">Remplacer l\'image…</button>'
      + '<button type="button" class="gf-mini" data-img="proportions">Proportions d\'origine</button>'
      + '<button type="button" class="gf-mini" data-img="retourner">Retourner</button>'
      + '</div>'
      + '<span class="gf-lab">Ajustement</span>'
      + puces('ajust', [['contenir', 'Entière'], ['remplir', 'Remplir le cadre'], ['etirer', 'Étirer']], ajust)
      + (ajust === 'remplir'
          ? '<span class="gf-lab" style="margin-top:12px">Cadrage dans le cadre</span>'
            + '<div class="gf-duo"><div>' + '<div class="gf-champ"><label class="gf-lab">Horizontal (%)</label><input class="gf-in" type="number" data-o="cadX" value="' + (o.cadX == null ? 50 : o.cadX) + '" min="0" max="100" step="5"></div></div>'
            + '<div><div class="gf-champ"><label class="gf-lab">Vertical (%)</label><input class="gf-in" type="number" data-o="cadY" value="' + (o.cadY == null ? 50 : o.cadY) + '" min="0" max="100" step="5"></div></div></div>'
          : '')
      + '<span class="gf-lab" style="margin-top:12px">Nuance</span>'
      + puces('teinte', [['couleur', 'Couleur'], ['nb', 'Noir et blanc'], ['sepia', 'Sépia'], ['contraste', 'Contrasté'], ['pale', 'Pâle']], teinte)
      + '<div class="gf-duo" style="margin-top:8px">'
      + '<div><div class="gf-champ"><label class="gf-lab">Coins arrondis (pt)</label><input class="gf-in" type="number" data-o="coins" value="' + (o.coins || 0) + '" min="0" max="40" step="1"></div></div>'
      + '<div><div class="gf-champ"><label class="gf-lab">Bord (pt)</label><input class="gf-in" type="number" data-o="bord" value="' + (o.bord || 0) + '" min="0" max="6" step="0.2"></div></div></div>'
      + '<div class="gf-champ"><label class="gf-bascule"><input type="checkbox" data-ob="ombre"' + (o.ombre ? ' checked' : '') + '><span class="gf-bascule-piste"></span><span class="gf-bascule-txt">Ombre portée</span></label></div>';
  }
  function brancherPanneauImage(hote, o) {
    hote.querySelectorAll('[data-oi]').forEach(function (b) {
      b.addEventListener('click', function () {
        reglerObjet(o.id, b.getAttribute('data-oi'), b.getAttribute('data-oiv'));
        peindreObjet();
      });
    });
    hote.querySelectorAll('[data-img]').forEach(function (b) {
      b.addEventListener('click', function () {
        var quoi = b.getAttribute('data-img');
        if (quoi === 'retourner') { reglerObjet(o.id, 'retourne', !o.retourne); peindreObjet(); return; }
        if (quoi === 'proportions') {
          if (!o.ratio) { dire('Les proportions d\'origine de cette image ne sont pas connues.', 'erreur'); return; }
          reglerObjet(o.id, 'h', Math.round(o.w / o.ratio * 10) / 10);
          peindreObjet(); dire('Proportions rétablies', 'ok'); return;
        }
        choisirImage(function (uri, img) {
          reglerObjet(o.id, 'src', uri);
          if (img) reglerObjet(o.id, 'ratio', img.width / img.height);
          peindreObjet(); dire('Image remplacée', 'ok');
        });
      });
    });
  }
  /* choisir un fichier image, l'alleger, en connaitre les proportions */
  function choisirImage(fin) {
    var input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.hidden = true;
    document.body.appendChild(input);
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      input.remove();
      if (f) lireImage(f, fin);
    });
    input.click();
  }
  function lireImage(f, fin) {
    lireFichier(f).then(function (uri) { return alleger(uri, 1600); }).then(function (uri) {
      var img = new Image();
      img.onload = function () { fin(uri, img); };
      img.onerror = function () { fin(uri, null); };
      img.src = uri;
    }).catch(function () { dire('Image illisible', 'erreur'); });
  }
  /* une image glissee sur la feuille se pose la ou on la lache */
  function brancherDeposeImage(doc) {
    if (doc.body.getAttribute('data-depose')) return;
    doc.body.setAttribute('data-depose', '1');
    doc.body.addEventListener('dragover', function (e) {
      if (lectureSeule()) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
      doc.body.classList.add('depose');
    });
    doc.body.addEventListener('dragleave', function () { doc.body.classList.remove('depose'); });
    doc.body.addEventListener('drop', function (e) {
      doc.body.classList.remove('depose');
      if (lectureSeule()) return;
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f || !/^image\//.test(f.type)) return;
      e.preventDefault();
      var ou = ouSurLaPage(doc, e.clientX, e.clientY);
      lireImage(f, function (uri, img) {
        var L = 55, H = img ? Math.round(L * img.height / img.width * 10) / 10 : 38;
        poserObjet('image', { src: uri, w: L, h: H, ratio: img ? img.width / img.height : null,
                              page: ou.page, x: Math.max(0, ou.x - L / 2), y: Math.max(0, ou.y - H / 2) });
        dire('Image posée sur la page ' + ou.page, 'ok');
      });
    });
  }
  /* de quel point de quelle page vient ce clic, en millimetres */
  function ouSurLaPage(doc, cx, cy) {
    var pages = doc.querySelectorAll('.page');
    for (var i = 0; i < pages.length; i++) {
      var r = pages[i].getBoundingClientRect();
      if (cy >= r.top && cy <= r.bottom) {
        return { page: i + 1, x: Math.round((cx - r.left) / r.width * 210), y: Math.round((cy - r.top) / r.height * 297) };
      }
    }
    return { page: 1, x: 105, y: 148 };
  }

  function poserImageObjet() {
    var input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.hidden = true;
    document.body.appendChild(input);
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      input.remove();
      if (!f) return;
      lireFichier(f).then(function (uri) { return alleger(uri, 1600); }).then(function (uri) {
        var img = new Image();
        img.onload = function () {
          var w = 50, h = Math.round(w * img.height / img.width * 10) / 10;
          poserObjet('image', { src: uri, w: w, h: h, ratio: img.width / img.height });
        };
        img.onerror = function () { poserObjet('image', { src: uri }); };
        img.src = uri;
      }).catch(function () { dire('Image illisible', 'erreur'); });
    });
    input.click();
  }

  function objetDe(id) { return (donnees.objets || []).filter(function (o) { return o.id === id; })[0] || null; }

  /* le rendu : appelé après la mise en pages, sur le document de la feuille */
  function poserObjets(doc) {
    var objets = donnees.objets || [];
    var pages = doc.querySelectorAll('.page');
    if (!pages.length) return;
    objets.forEach(function (o) {
      var page = pages[Math.min(Math.max(1, o.page || 1), pages.length) - 1];
      var el = doc.createElement('div');
      el.className = 'objet objet-' + o.type + (TYPES_OBJET[o.type] && TYPES_OBJET[o.type].sensible ? ' objet-sensible' : '');
      el.setAttribute('data-objet', o.id);
      el.style.left = o.x + 'mm'; el.style.top = o.y + 'mm';
      el.style.width = o.w + 'mm'; el.style.height = o.h + 'mm';
      el.style.opacity = (o.opacite == null ? 100 : o.opacite) / 100;
      if (o.rotation) el.style.transform = 'rotate(' + o.rotation + 'deg)';
      var c = TEINTES_OBJET[o.couleur] || TEINTES_OBJET.or;
      if (o.type === 'cachet') {
        el.style.backgroundImage = res.cachet ? 'url(' + res.cachet + ')' : '';
      } else if (o.type === 'signature') {
        var nom = o.texte || donnees.signNom || 'Antoine Jean Pierre Ndong';
        el.innerHTML = '<div class="sig-ink" style="position:static;width:100%;transform:none"><div class="sig-name">' + ech(initialeNom(nom)) + '</div>'
          + '<div class="sig-paraphe">' + G.blocs.PARAPHE + '</div></div>';
      } else if (o.type === 'image') {
        /* UNE IMAGE POSEE SE MODIFIE : « ni incruster des images ni les
           modifier ». L'ajustement, le cadrage, les coins, le bord et la
           nuance vivent dans la donnee de l'objet ; la feuille les lit. */
        if (o.ajust) el.classList.add('ajust-' + o.ajust);
        if (o.teinte && o.teinte !== 'couleur') el.classList.add('teinte-' + o.teinte);
        if (o.coins) el.style.borderRadius = o.coins + 'pt';
        if (o.bord) { el.style.border = o.bord + 'pt solid ' + c; }
        if (o.ombre) el.style.boxShadow = '0 1.5pt 5pt rgba(0,0,0,.28)';
        el.style.overflow = 'hidden';
        var pos = (o.cadX == null ? 50 : o.cadX) + '% ' + (o.cadY == null ? 50 : o.cadY) + '%';
        el.innerHTML = o.src
          ? '<img src="' + o.src + '" alt="" style="object-position:' + pos + (o.retourne ? ';transform:scaleX(-1)' : '') + '">'
          : '<div class="fig-vide" style="width:100%;height:100%"></div>';
      } else if (o.type === 'annotation') {
        el.style.borderColor = c; el.style.color = c;
        el.innerHTML = '<div class="objet-txt">' + U_paragraphes(o.texte || '') + '</div>';
      } else if (o.type === 'cadre') {
        el.style.borderColor = c;
        if (o.fond) el.style.background = c + '18';
      } else if (o.type === 'case') {
        if (o.coche) el.classList.add('cochee');
        el.innerHTML = '<i></i><span>' + ech(o.texte || '') + '</span>';
      } else if (o.type === 'fleche') {
        el.innerHTML = '<svg viewBox="0 0 100 20" preserveAspectRatio="none" style="width:100%;height:100%;display:block;overflow:visible">'
          + '<line x1="2" y1="10" x2="86" y2="10" stroke="' + c + '" stroke-width="' + (o.trait || 2.2) + '" vector-effect="non-scaling-stroke"'
          + (o.pointille ? ' stroke-dasharray="7 5"' : '') + '/>'
          + '<polygon points="84,3 98,10 84,17" fill="' + c + '"/></svg>';
      } else if (o.type === 'ellipse') {
        el.style.borderColor = c;
        el.style.borderWidth = (o.trait || 1.2) + 'pt';
        if (o.pointille) el.style.borderStyle = 'dashed';
        if (o.fond) el.style.background = c + '22';
      } else if (o.type === 'ligne') {
        el.innerHTML = '<svg viewBox="0 0 100 10" preserveAspectRatio="none" style="width:100%;height:100%;display:block;overflow:visible">'
          + '<line x1="0" y1="5" x2="100" y2="5" stroke="' + c + '" stroke-width="' + (o.trait || 1.4) + '" vector-effect="non-scaling-stroke"'
          + (o.pointille ? ' stroke-dasharray="7 5"' : '') + '/></svg>';
      } else if (o.type === 'surligneur') {
        el.style.background = c;
      }
      page.appendChild(el);
    });
  }
  function U_paragraphes(t) { return paragraphes(t); }

  /* la sélection : un contour et une poignée, à l'écran seulement */
  function marquerSelection() {
    var doc = cadre && cadrePret ? cadre.contentDocument : null;
    if (!doc) return;
    Array.prototype.forEach.call(doc.querySelectorAll('.objet.is-sel'), function (e) { e.classList.remove('is-sel'); });
    Array.prototype.forEach.call(doc.querySelectorAll('.objet-poignee'), function (e) { e.remove(); });
    if (!objetSel) { majNoteObjet(null); return; }
    objetsSel = objetsSel.filter(objetDe);
    objetsSel.forEach(function (id) { var x = doc.querySelector('[data-objet="' + id + '"]'); if (x) x.classList.add('is-sel'); });
    var el = doc.querySelector('[data-objet="' + objetSel + '"]');
    var o = objetDe(objetSel);
    if (!el || !o) { objetSel = null; objetsSel = []; majNoteObjet(null); return; }
    el.classList.add('is-sel');
    if (!o.verrou && !lectureSeule()) {
      var p = doc.createElement('div'); p.className = 'objet-poignee'; p.setAttribute('data-poignee', o.id);
      el.appendChild(p);
      var r = doc.createElement('div'); r.className = 'objet-rotation'; r.setAttribute('data-rotation', o.id); r.title = 'Tourner';
      el.appendChild(r);
    }
    majNoteObjet(o);
  }
  function majNoteObjet(o) {
    var note = $('gf-note');
    if (!note) return;
    if (!o) { majActions(); return; }
    if (objetsSel.length > 1) { note.textContent = objetsSel.length + ' objets sélectionnés · glissez ou flèches pour les déplacer ensemble, Suppr pour les retirer, panneau de droite pour les aligner'; return; }
    note.textContent = (TYPES_OBJET[o.type] || {}).nom + ' · page ' + o.page + ' · ' + Math.round(o.w) + ' × ' + Math.round(o.h) + ' mm' + (o.rotation ? ' · ' + o.rotation + '°' : '')
      + (o.verrou ? ' · verrouillé' : ' · glissez pour déplacer (Alt : sans aimant), la poignée pour redimensionner, Suppr pour retirer');
  }
  /* Plusieurs objets à la fois : Maj ou Ctrl + clic ajoute ou retire ; un
     cadre tracé sur une zone vide de la page prend ce qu'il touche ;
     Ctrl+A prend tout. Ils se déplacent, s'alignent, se retirent et se
     copient ensemble ; l'objet principal (le dernier pris) porte les
     poignées et guide l'aimant. */
  var objetsSel = [];
  function selectionnerObjet(id, ajouter) {
    if (!id) { objetSel = null; objetsSel = []; }
    else if (ajouter) {
      var i = objetsSel.indexOf(id);
      if (i === -1) objetsSel.push(id); else objetsSel.splice(i, 1);
      objetSel = objetsSel.length ? objetsSel[objetsSel.length - 1] : null;
    } else { objetSel = id; objetsSel = [id]; }
    marquerSelection();
    if (objetSel) { propsOnglet = 'proprietes'; ouvrirProps(false); }
    peindreProps(); majOutils();
  }
  function selectionnerTout() {
    /* la page de l'objet pris, sinon la page visible ; si elle est vide, tout l'acte */
    var tous = donnees.objets || [], oSel = objetDe(objetSel);
    var page = oSel ? (oSel.page || 1) : pageVisible();
    var ids = tous.filter(function (o) { return (o.page || 1) === page; }).map(function (o) { return o.id; });
    if (!ids.length) ids = tous.map(function (o) { return o.id; });
    if (!ids.length) { dire('Aucun objet posé sur la feuille.', 'erreur'); return; }
    objetsSel = ids; objetSel = ids[ids.length - 1];
    marquerSelection(); peindreProps(); majOutils();
    dire(ids.length + ' objet' + (ids.length > 1 ? 's' : '') + ' sélectionné' + (ids.length > 1 ? 's' : ''), 'ok');
  }
  function objetsSelectionnes() { return objetsSel.map(objetDe).filter(Boolean); }

  /* ---- les guides : les marges, le milieu de la page, les bords des autres
     objets. À moins de 1,8 mm, l'objet s'y colle et une ligne le dit ;
     Alt enfoncé laisse la main libre. ---- */
  var GUIDE_TOL = 1.8;
  var PAGE_GUIDES = { v: [13, 105, 197], h: [11, 148.5, 285] };
  function guidesPour(o) {
    var v = PAGE_GUIDES.v.slice(), h = PAGE_GUIDES.h.slice();
    (donnees.objets || []).forEach(function (a) {
      if (a.id === o.id || a.page !== o.page) return;
      v.push(a.x, a.x + a.w / 2, a.x + a.w);
      h.push(a.y, a.y + a.h / 2, a.y + a.h);
    });
    return { v: v, h: h };
  }
  function aimanter(o, mode) {
    var g = guidesPour(o), res = { v: null, h: null };
    function meilleur(lignes, bords) {
      var best = null;
      lignes.forEach(function (l) {
        bords.forEach(function (b) {
          var d = l - b;
          if (Math.abs(d) <= GUIDE_TOL && (!best || Math.abs(d) < Math.abs(best.d))) best = { d: d, ligne: l };
        });
      });
      return best;
    }
    var bx = mode === 'taille' ? [o.x + o.w] : [o.x, o.x + o.w / 2, o.x + o.w];
    var by = mode === 'taille' ? [o.y + o.h] : [o.y, o.y + o.h / 2, o.y + o.h];
    var mx = meilleur(g.v, bx), my = meilleur(g.h, by);
    if (mx) { if (mode === 'taille') o.w += mx.d; else o.x += mx.d; res.v = mx.ligne; }
    if (my) { if (mode === 'taille') o.h += my.d; else o.y += my.d; res.h = my.ligne; }
    return res;
  }
  function montrerGuides(page, res) {
    effacerGuides();
    if (!page) return;
    var d = page.ownerDocument;
    if (res.v != null) { var v = d.createElement('div'); v.className = 'objet-guide objet-guide-v'; v.style.left = res.v + 'mm'; page.appendChild(v); }
    if (res.h != null) { var h = d.createElement('div'); h.className = 'objet-guide objet-guide-h'; h.style.top = res.h + 'mm'; page.appendChild(h); }
  }
  function effacerGuides() {
    var doc = cadre && cadrePret ? cadre.contentDocument : null;
    if (!doc) return;
    Array.prototype.forEach.call(doc.querySelectorAll('.objet-guide'), function (e) { e.remove(); });
  }

  /* la souris : sélection, glissement, poignée */
  function surSourisObjet(e) {
    if (lectureSeule()) return;
    var poignee = e.target.closest ? e.target.closest('.objet-poignee') : null;
    var rotation = e.target.closest ? e.target.closest('.objet-rotation') : null;
    var el = e.target.closest ? e.target.closest('.objet') : null;
    /* le cachet ou l'encre d'une carte : on le détache, il devient un objet à la même place */
    var encre = !el && e.target.closest ? e.target.closest('.sign-card .sig-cachet, .sign-card .sig-ink') : null;
    if (encre) {
      e.preventDefault();
      var doc = cadre.contentDocument, page = encre.closest('.page');
      var rp = page.getBoundingClientRect(), re = encre.getBoundingClientRect();
      var type = encre.classList.contains('sig-cachet') ? 'cachet' : 'signature';
      var num = Array.prototype.indexOf.call(doc.querySelectorAll('.page'), page) + 1;
      donnees[type === 'cachet' ? 'cachetDetache' : 'signatureDetachee'] = true;
      poserObjet(type, { page: num, x: Math.round((re.left - rp.left) / MM * 10) / 10, y: Math.round((re.top - rp.top) / MM * 10) / 10,
                         w: Math.round(re.width / MM * 10) / 10, h: Math.round(re.height / MM * 10) / 10, verrou: false });
      dire((type === 'cachet' ? 'Cachet' : 'Signature') + ' détaché' + (type === 'cachet' ? '' : 'e') + ' de la carte : déplacez-le, ou retirez-le pour le rendre à la carte', 'ok');
      return;
    }
    if (!el && !poignee) {
      var dansTexte = !!(e.target.closest && e.target.closest('[data-edit], [contenteditable="true"]'));
      var page = e.target.closest ? e.target.closest('.page') : null;
      /* du vide : la page, son corps, l'enveloppe d'un bloc, le pied, le filigrane, un espace */
      var surDuVide = !!page && (e.target === page || /^(corps|bloc|espace|wm|foot|pages)$/.test(e.target.className || '') || !!(e.target.closest && e.target.closest('footer.foot, .wm, .espace')));
      if (surDuVide && !lectureSeule() && e.button === 0) {
        /* sur du vide : un cadre de sélection */
        var rp = page.getBoundingClientRect();
        cadreSel = { page: page, num: Array.prototype.indexOf.call(cadre.contentDocument.querySelectorAll('.page'), page) + 1,
                     x0: (e.clientX - rp.left) / MM, y0: (e.clientY - rp.top) / MM, el: null, ajouter: e.shiftKey || e.ctrlKey || e.metaKey };
        return;
      }
      if (objetSel && !dansTexte) selectionnerObjet(null);
      return;
    }
    e.preventDefault();
    var id = poignee ? poignee.getAttribute('data-poignee') : (rotation ? rotation.getAttribute('data-rotation') : el.getAttribute('data-objet'));
    var o = objetDe(id);
    if (!o) return;
    if (e.shiftKey || e.ctrlKey || e.metaKey) { selectionnerObjet(id, true); return; }
    if (objetsSel.indexOf(id) === -1) selectionnerObjet(id);
    else if (objetSel !== id) { objetSel = id; marquerSelection(); peindreProps(); }
    if (o.verrou) return;
    var rc = (el || rotation.closest('.objet')).getBoundingClientRect();
    glisseADeplace = false;
    glisse = { id: id, poignee: !!poignee, rotation: !!rotation, x0: e.clientX, y0: e.clientY, ox: o.x, oy: o.y, ow: o.w, oh: o.h,
               cx: rc.left + rc.width / 2, cy: rc.top + rc.height / 2,
               groupe: (!poignee && !rotation && objetsSel.length > 1) ? objetsSelectionnes().filter(function (x) { return !x.verrou; }).map(function (x) { return { o: x, ox: x.x, oy: x.y }; }) : null };
  }
  var cadreSel = null;
  function surSourisBouge(e) {
    if (cadreSel) {
      var rp = cadreSel.page.getBoundingClientRect();
      var x1 = (e.clientX - rp.left) / MM, y1 = (e.clientY - rp.top) / MM;
      var x = Math.min(cadreSel.x0, x1), y = Math.min(cadreSel.y0, y1), w = Math.abs(x1 - cadreSel.x0), h = Math.abs(y1 - cadreSel.y0);
      if (!cadreSel.el && (w > 1.5 || h > 1.5)) {
        var dc = cadre.contentDocument;
        cadreSel.el = dc.createElement('div'); cadreSel.el.className = 'objet-cadre-sel'; cadreSel.page.appendChild(cadreSel.el);
        dc.body.classList.add('sel-cadre');
        try { if (dc.activeElement && dc.activeElement.blur) dc.activeElement.blur(); dc.getSelection().removeAllRanges(); } catch (x) {}
      }
      if (cadreSel.el) { cadreSel.el.style.left = x + 'mm'; cadreSel.el.style.top = y + 'mm'; cadreSel.el.style.width = w + 'mm'; cadreSel.el.style.height = h + 'mm'; }
      cadreSel.rect = { x: x, y: y, w: w, h: h };
      return;
    }
    if (!glisse) return;
    var o = objetDe(glisse.id), doc = cadre.contentDocument;
    var el = doc.querySelector('[data-objet="' + glisse.id + '"]');
    if (!o || !el) { glisse = null; return; }
    var dx = (e.clientX - glisse.x0) / MM, dy = (e.clientY - glisse.y0) / MM;
    glisseADeplace = Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3;
    if (glisse.rotation) {
      /* l'angle entre le centre de l'objet et la souris ; la poignée est en haut */
      var a = Math.atan2(e.clientY - glisse.cy, e.clientX - glisse.cx) * 180 / Math.PI + 90;
      if (e.shiftKey) a = Math.round(a / 15) * 15;
      else if (!e.altKey) {
        /* près d'un quart de tour, l'objet s'y pose : droit, couché, retourné */
        var q = Math.round(a / 90) * 90;
        if (Math.abs(a - q) <= 4) a = q;
      }
      o.rotation = Math.round(((a + 180) % 360 + 360) % 360 - 180);
      el.style.transform = o.rotation ? 'rotate(' + o.rotation + 'deg)' : '';
      majNoteObjet(o);
      return;
    }
    if (glisse.poignee) {
      var w = Math.max(5, glisse.ow + dx), h = Math.max(3, glisse.oh + dy);
      var lie = !!(o.ratio || o.type === 'cachet');
      if (lie) { h = w / (o.ratio || 1); }
      o.w = w; o.h = h;
      var gt = (e.altKey || !aimantActif) ? { v: null, h: null } : aimanter(o, 'taille');
      if (lie) { o.h = o.w / (o.ratio || 1); gt.h = null; }
      o.w = Math.round(Math.max(5, o.w) * 10) / 10; o.h = Math.round(Math.max(3, o.h) * 10) / 10;
      el.style.width = o.w + 'mm'; el.style.height = o.h + 'mm';
      montrerGuides(el.closest('.page'), gt);
    } else {
      o.x = glisse.ox + dx; o.y = glisse.oy + dy;
      var gd = (e.altKey || !aimantActif) ? { v: null, h: null } : aimanter(o, 'deplacer');
      o.x = Math.round(o.x * 10) / 10; o.y = Math.round(o.y * 10) / 10;
      el.style.left = o.x + 'mm'; el.style.top = o.y + 'mm';
      if (glisse.groupe) {
        /* les autres suivent du même déplacement, aimant compris */
        var ddx = o.x - glisse.ox, ddy = o.y - glisse.oy;
        glisse.groupe.forEach(function (g) {
          if (g.o === o) return;
          g.o.x = Math.round((g.ox + ddx) * 10) / 10; g.o.y = Math.round((g.oy + ddy) * 10) / 10;
          var ge = doc.querySelector('[data-objet="' + g.o.id + '"]'); if (ge) { ge.style.left = g.o.x + 'mm'; ge.style.top = g.o.y + 'mm'; }
        });
      }
      montrerGuides(el.closest('.page'), gd);
    }
    majNoteObjet(o);
  }
  var glisseADeplace = false;
  function surSourisLache() {
    if (cadreSel) {
      var c = cadreSel; cadreSel = null;
      if (c.el) c.el.remove();
      cadre.contentDocument.body.classList.remove('sel-cadre');
      if (c.rect && (c.rect.w > 1.5 || c.rect.h > 1.5)) {
        var pris = (donnees.objets || []).filter(function (o) {
          return (o.page || 1) === c.num && o.x < c.rect.x + c.rect.w && o.x + o.w > c.rect.x && o.y < c.rect.y + c.rect.h && o.y + o.h > c.rect.y;
        }).map(function (o) { return o.id; });
        if (c.ajouter) pris.forEach(function (id) { if (objetsSel.indexOf(id) === -1) objetsSel.push(id); });
        else objetsSel = pris;
        objetSel = objetsSel.length ? objetsSel[objetsSel.length - 1] : null;
        marquerSelection(); peindreProps(); majOutils();
        if (pris.length) dire(pris.length + ' objet' + (pris.length > 1 ? 's' : '') + ' pris', 'ok');
      } else if (objetSel && !c.ajouter) selectionnerObjet(null);
      return;
    }
    if (!glisse) return;
    glisse = null;
    effacerGuides();
    salir();
    if (panneau === 'objet') peindreFormulaire();
  }
  function surToucheObjet(e) {
    if (!objetSel || lectureSeule()) return false;
    var doc = cadre.contentDocument;
    if (doc.activeElement && doc.activeElement.closest && doc.activeElement.closest('[data-edit]')) return false;
    var o = objetDe(objetSel);
    if (!o) return false;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); retirerObjets(objetsSel.slice()); return true; }
    if (e.key === 'Escape') { e.preventDefault(); selectionnerObjet(null); return true; }
    var pas = e.shiftKey ? 5 : 1, ddx = 0, ddy = 0;
    if (e.key === 'ArrowLeft') ddx = -pas; else if (e.key === 'ArrowRight') ddx = pas;
    else if (e.key === 'ArrowUp') ddy = -pas; else if (e.key === 'ArrowDown') ddy = pas;
    else return false;
    e.preventDefault();
    objetsSelectionnes().forEach(function (x) {
      if (x.verrou) return;
      x.x = Math.round((x.x + ddx) * 10) / 10; x.y = Math.round((x.y + ddy) * 10) / 10;
      var el = doc.querySelector('[data-objet="' + x.id + '"]');
      if (el) { el.style.left = x.x + 'mm'; el.style.top = x.y + 'mm'; }
    });
    salir(); majNoteObjet(o);
    return true;
  }
  function retirerObjets(ids) {
    if (!ids.length) return;
    if (ids.length === 1) { retirerObjet(ids[0]); return; }
    ids.forEach(function (id) {
      var o = objetDe(id);
      donnees.objets = (donnees.objets || []).filter(function (x) { return x.id !== id; });
      if (o && o.type === 'cachet' && !donnees.objets.some(function (x) { return x.type === 'cachet'; })) delete donnees.cachetDetache;
      if (o && o.type === 'signature' && !donnees.objets.some(function (x) { return x.type === 'signature'; })) delete donnees.signatureDetachee;
    });
    objetSel = null; objetsSel = [];
    salir(); rafraichir(); peindreProps(); majOutils();
    dire(ids.length + ' objets retirés', 'ok');
  }
  /* aligner et répartir les objets sélectionnés, sur l'objet principal */
  function alignerObjets(mode) {
    var os = objetsSelectionnes().filter(function (x) { return !x.verrou; });
    if (os.length < 2) return;
    var p = objetDe(objetSel) || os[0];
    if (mode === 'gauche') os.forEach(function (x) { x.x = p.x; });
    else if (mode === 'droite') os.forEach(function (x) { x.x = p.x + p.w - x.w; });
    else if (mode === 'centre') os.forEach(function (x) { x.x = p.x + p.w / 2 - x.w / 2; });
    else if (mode === 'haut') os.forEach(function (x) { x.y = p.y; });
    else if (mode === 'bas') os.forEach(function (x) { x.y = p.y + p.h - x.h; });
    else if (mode === 'milieu') os.forEach(function (x) { x.y = p.y + p.h / 2 - x.h / 2; });
    else if (mode === 'largeur') os.forEach(function (x) { x.w = p.w; if (x.ratio || x.type === 'cachet') x.h = x.w / (x.ratio || 1); });
    else if (mode === 'hauteur') os.forEach(function (x) { x.h = p.h; });
    else if (mode === 'horizontal' || mode === 'vertical') {
      var h = mode === 'horizontal';
      os.sort(function (a, b) { return h ? a.x - b.x : a.y - b.y; });
      var premier = os[0], dernier = os[os.length - 1];
      var total = h ? (dernier.x + dernier.w - premier.x) : (dernier.y + dernier.h - premier.y);
      var occupe = os.reduce(function (s, x) { return s + (h ? x.w : x.h); }, 0);
      var ecart = (total - occupe) / (os.length - 1), cur = h ? premier.x : premier.y;
      os.forEach(function (x) { if (h) x.x = cur, cur += x.w + ecart; else x.y = cur, cur += x.h + ecart; });
    }
    os.forEach(function (x) { x.x = Math.round(x.x * 10) / 10; x.y = Math.round(x.y * 10) / 10; x.w = Math.round(x.w * 10) / 10; x.h = Math.round(x.h * 10) / 10; });
    salir(); rafraichir(); setTimeout(function () { marquerSelection(); peindreProps(); }, 40);
  }
  function retirerObjet(id) {
    var o = objetDe(id);
    donnees.objets = (donnees.objets || []).filter(function (x) { return x.id !== id; });
    if (o && o.type === 'cachet' && !donnees.objets.some(function (x) { return x.type === 'cachet'; })) delete donnees.cachetDetache;
    if (o && o.type === 'signature' && !donnees.objets.some(function (x) { return x.type === 'signature'; })) delete donnees.signatureDetachee;
    if (objetSel === id) objetSel = null;
    objetsSel = objetsSel.filter(function (x) { return x !== id; });
    panneau = 'donnees';
    salir(); peindreFormulaire(); rafraichir();
    dire('Objet retiré', 'ok');
  }
  function reglerObjet(id, cle, valeur) {
    var o = objetDe(id);
    if (!o) return;
    o[cle] = valeur;
    salir(); rafraichir();
    setTimeout(marquerSelection, 40);
  }

  /* le panneau : position, taille, rotation, opacité, texte, couleur, verrou */
  function peindreGroupe(hote) {
    var os = objetsSelectionnes();
    function b(mode, lab, titre) { return '<button type="button" data-al="' + mode + '" title="' + titre + '">' + lab + '</button>'; }
    hote.innerHTML = '<div class="gf-controle"><p class="gf-acc-intro">' + os.length + ' objets sélectionnés</p>'
      + '<p class="gf-props-vide">Ils se déplacent ensemble (souris, flèches). L\'alignement se fait sur l\'objet principal, le dernier pris : ' + ech((TYPES_OBJET[(objetDe(objetSel) || {}).type] || {}).nom || '') + '.</p>'
      + '<div class="gf-props-titre">Aligner</div><div class="gf-typo">' + b('gauche', '⇤', 'Bords gauches') + b('centre', '↔', 'Centres') + b('droite', '⇥', 'Bords droits') + b('haut', '⤒', 'Bords hauts') + b('milieu', '↕', 'Milieux') + b('bas', '⤓', 'Bords bas') + '</div>'
      + '<div class="gf-props-titre">Répartir, égaliser</div><div class="gf-typo">' + b('horizontal', 'Répartir ↔', 'Même espace entre eux, de gauche à droite') + b('vertical', 'Répartir ↕', 'Même espace entre eux, de haut en bas') + b('largeur', 'Même largeur', 'La largeur du principal') + b('hauteur', 'Même hauteur', 'La hauteur du principal') + '</div>'
      + '<div class="gf-controle-actions" style="margin-top:14px;justify-content:flex-start;flex-wrap:wrap">'
      + '<button type="button" class="gf-mini" data-ga="copier">Copier</button><button type="button" class="gf-mini" data-ga="verrou">Verrouiller</button><button type="button" class="gf-mini" data-ga="liberer">Déverrouiller</button>'
      + '<button type="button" class="gf-mini gf-mini-danger" data-ga="retirer">Retirer</button></div>'
      + '<div class="gf-controle-actions" style="margin-top:14px"><button type="button" class="gf-btn gf-btn-fant" data-ga="rien">Désélectionner</button></div></div>';
    hote.querySelectorAll('[data-al]').forEach(function (x) { x.addEventListener('click', function () { alignerObjets(x.getAttribute('data-al')); }); });
    hote.querySelectorAll('[data-ga]').forEach(function (x) {
      x.addEventListener('click', function () {
        var a = x.getAttribute('data-ga');
        if (a === 'retirer') retirerObjets(objetsSel.slice());
        else if (a === 'copier') copierElement();
        else if (a === 'verrou' || a === 'liberer') { objetsSelectionnes().forEach(function (o) { o.verrou = a === 'verrou'; }); salir(); rafraichir(); setTimeout(function () { marquerSelection(); peindreProps(); }, 40); }
        else selectionnerObjet(null);
      });
    });
  }
  function peindreObjet(hote) {
    hote = hote || $('gf-props-corps') || elt.formDefile;
    if (objetsSel.length > 1) { peindreGroupe(hote); return; }
    var o = objetDe(objetSel);
    if (!o) { objetSel = null; peindreProps(); return; }
    var T = TYPES_OBJET[o.type] || { nom: o.type };
    function nombre(cle, lab, min, max, pas) {
      return '<div class="gf-champ"><label class="gf-lab">' + lab + '</label><input class="gf-in" type="number" data-o="' + cle + '" value="' + (o[cle] == null ? '' : o[cle]) + '" min="' + min + '" max="' + max + '" step="' + (pas || 1) + '"></div>';
    }
    var couleurs = [['or', 'Or'], ['vert', 'Vert'], ['rouge', 'Rouge'], ['gris', 'Gris'], ['noir', 'Noir'], ['bleu', 'Bleu encre'], ['jaune', 'Jaune']];
    var TEINTABLES = ['annotation', 'cadre', 'fleche', 'ellipse', 'ligne', 'surligneur', 'image'];
    var TRAITABLES = ['cadre', 'ellipse', 'ligne', 'fleche'];
    hote.innerHTML =
      '<div class="gf-controle">'
      + '<p class="gf-acc-intro">' + ech(T.nom) + (T.sensible ? ' · <span class="gf-badge gf-badge-annule">élément sensible</span>' : '') + '</p>'
      + '<div class="gf-duo"><div>' + nombre('x', 'Depuis la gauche (mm)', 0, 210, 0.5) + '</div><div>' + nombre('y', 'Depuis le haut (mm)', 0, 297, 0.5) + '</div></div>'
      + '<div class="gf-duo"><div>' + nombre('w', 'Largeur (mm)', 3, 210, 0.5) + '</div><div>' + nombre('h', 'Hauteur (mm)', 2, 297, 0.5) + '</div></div>'
      + '<div class="gf-duo"><div>' + nombre('rotation', 'Rotation (°)', -180, 180, 1) + '</div><div>' + nombre('opacite', 'Opacité (%)', 5, 100, 5) + '</div></div>'
      + '<div class="gf-champ"><label class="gf-lab">Page</label><input class="gf-in" type="number" data-o="page" value="' + o.page + '" min="1" max="' + nbPages + '"></div>'
      + (o.type === 'annotation' || o.type === 'signature' || o.type === 'case' ? '<div class="gf-champ"><label class="gf-lab">' + (o.type === 'signature' ? 'Nom signé' : (o.type === 'case' ? 'Libellé' : 'Texte')) + '</label><textarea class="gf-ta" data-o="texte" rows="' + (o.type === 'case' ? 2 : 3) + '">' + ech(o.texte || '') + '</textarea></div>' : '')
      + (o.type === 'case' ? '<div class="gf-champ"><label class="gf-bascule"><input type="checkbox" data-ob="coche"' + (o.coche ? ' checked' : '') + '><span class="gf-bascule-piste"></span><span class="gf-bascule-txt">Cochée</span></label></div>' : '')
      + (TEINTABLES.indexOf(o.type) >= 0
          ? '<span class="gf-lab">Couleur</span><div class="gf-puces">' + couleurs.map(function (c) {
              return '<button type="button" class="gf-puce' + ((o.couleur || 'or') === c[0] ? ' is-actif' : '') + '" data-oc="' + c[0] + '">' + c[1] + '</button>';
            }).join('') + '</div>' : '')
      + (TRAITABLES.indexOf(o.type) >= 0
          ? '<div class="gf-duo"><div>' + nombre('trait', 'Épaisseur du trait (pt)', 0.3, 8, 0.1) + '</div>'
            + '<div><label class="gf-lab">Style</label><div class="gf-puces">'
            + '<button type="button" class="gf-puce' + (o.pointille ? '' : ' is-actif') + '" data-opl="0">Plein</button>'
            + '<button type="button" class="gf-puce' + (o.pointille ? ' is-actif' : '') + '" data-opl="1">Pointillé</button></div></div></div>' : '')
      + (o.type === 'cadre' || o.type === 'ellipse' ? '<div class="gf-champ"><label class="gf-bascule"><input type="checkbox" data-ob="fond"' + (o.fond ? ' checked' : '') + '><span class="gf-bascule-piste"></span><span class="gf-bascule-txt">Fond teinté</span></label></div>' : '')
      + (o.type === 'image' ? panneauImage(o) : '')
      + '<div class="gf-champ"><label class="gf-bascule"><input type="checkbox" data-ob="verrou"' + (o.verrou ? ' checked' : '') + '><span class="gf-bascule-piste"></span><span class="gf-bascule-txt">Verrouillé : ne se déplace pas à la souris</span></label></div>'
      + '<div class="gf-controle-actions" style="margin-top:14px;justify-content:flex-start;flex-wrap:wrap">'
      + '<button type="button" class="gf-mini" data-oa="dupliquer">Dupliquer</button>'
      + '<button type="button" class="gf-mini" data-oa="devant">Devant</button>'
      + '<button type="button" class="gf-mini" data-oa="derriere">Derrière</button>'
      + '<button type="button" class="gf-mini gf-mini-danger" data-oa="retirer">Retirer</button>'
      + '</div>'
      + '<div class="gf-controle-actions" style="margin-top:14px"><button type="button" class="gf-btn gf-btn-fant" id="gf-objet-retour">Désélectionner</button></div>'
      + '</div>';
    hote.querySelectorAll('[data-o]').forEach(function (n) {
      n.addEventListener('change', function () {
        var v = n.type === 'number' ? parseFloat(n.value) : n.value;
        if (n.type === 'number' && isNaN(v)) return;
        reglerObjet(o.id, n.getAttribute('data-o'), v);
      });
    });
    hote.querySelectorAll('[data-ob]').forEach(function (n) {
      n.addEventListener('change', function () { reglerObjet(o.id, n.getAttribute('data-ob'), n.checked); });
    });
    hote.querySelectorAll('[data-oc]').forEach(function (b) {
      b.addEventListener('click', function () { reglerObjet(o.id, 'couleur', b.getAttribute('data-oc')); peindreObjet(); });
    });
    hote.querySelectorAll('[data-opl]').forEach(function (b) {
      b.addEventListener('click', function () { reglerObjet(o.id, 'pointille', b.getAttribute('data-opl') === '1'); peindreObjet(); });
    });
    brancherPanneauImage(hote, o);
    hote.querySelectorAll('[data-oa]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-oa'), list = donnees.objets, i = list.indexOf(o);
        if (a === 'retirer') { retirerObjet(o.id); return; }
        if (a === 'dupliquer') {
          var c = JSON.parse(JSON.stringify(o)); c.id = 'o' + Date.now().toString(36); c.x += 6; c.y += 6; c.verrou = false;
          list.splice(i + 1, 0, c); objetSel = c.id; objetsSel = [c.id];
        } else if (a === 'devant' && i < list.length - 1) { list.splice(i, 1); list.push(o); }
        else if (a === 'derriere' && i > 0) { list.splice(i, 1); list.unshift(o); }
        salir(); rafraichir(); peindreProps(); setTimeout(marquerSelection, 40);
      });
    });
    $('gf-objet-retour').addEventListener('click', function () { selectionnerObjet(null); });
  }

  /* =================================================================
     9 septies. LE PRESSE-PAPIERS DU GREFFE
     Ctrl+C sur un objet posé ou sur le bloc où l'on écrit (sans texte
     sélectionné) le copie ; Ctrl+V le recolle, dans cet acte ou dans un
     autre, dans cette fenêtre ou dans une autre : il passe par le
     localStorage. Le texte sélectionné, lui, se copie comme partout.
     ================================================================= */
  var CLE_PRESSE = 'bbc-greffe-presse-papiers';
  function copierElement() {
    var doc = cadre && cadrePret ? cadre.contentDocument : null;
    if (!doc) return false;
    var sel = doc.getSelection();
    if (sel && sel.rangeCount && !sel.isCollapsed && sel.toString()) return false;   /* du texte : le navigateur s'en charge */
    var contenu = null;
    if (objetsSel.length > 1) contenu = { genre: 'objets', objets: JSON.parse(JSON.stringify(objetsSelectionnes())) };
    else if (objetSel && objetDe(objetSel)) contenu = { genre: 'objet', objet: JSON.parse(JSON.stringify(objetDe(objetSel))) };
    else if (blocCourant && modeleActif.libre && /^b\d+$/.test(blocCourant)) {
      var x = (donnees.blocs || [])[+blocCourant.slice(1)];
      if (x) contenu = { genre: 'bloc', bloc: JSON.parse(JSON.stringify(x)), table: x.source && donnees.tables ? JSON.parse(JSON.stringify(donnees.tables[x.source] || null)) : null };
    }
    if (!contenu) return false;
    try { localStorage.setItem(CLE_PRESSE, JSON.stringify(contenu)); } catch (e) {}
    dire((contenu.genre === 'objet' ? (TYPES_OBJET[contenu.objet.type] || {}).nom : (contenu.genre === 'objets' ? contenu.objets.length + ' objets' : 'Bloc')) + ' copié' + (contenu.genre === 'objets' ? 's' : ''), 'ok');
    return true;
  }
  function collerElement() {
    if (lectureSeule()) return false;
    var doc = cadre && cadrePret ? cadre.contentDocument : null;
    if (doc && doc.activeElement && doc.activeElement.closest && doc.activeElement.closest('[data-edit]')) return false;  /* dans un texte : coller du texte */
    /* une image dans le presse-papiers se pose comme objet */
    if (navigator.clipboard && navigator.clipboard.read) {
      navigator.clipboard.read().then(function (items) {
        for (var i = 0; i < items.length; i++) {
          var t = items[i].types.filter(function (x) { return /^image\//.test(x); })[0];
          if (!t) continue;
          items[i].getType(t).then(function (b) {
            lireImage(b, function (uri, img) {
              var L = 55, H = img ? Math.round(L * img.height / img.width * 10) / 10 : 38;
              poserObjet('image', { src: uri, w: L, h: H, ratio: img ? img.width / img.height : null });
              dire('Image collée', 'ok');
            });
          });
          return;
        }
      }).catch(function () {});
    }
    var contenu = null;
    try { contenu = JSON.parse(localStorage.getItem(CLE_PRESSE) || 'null'); } catch (e) {}
    if (!contenu) return false;
    if (contenu.genre === 'objet') {
      var o = contenu.objet; o.id = 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); o.x += 6; o.y += 6; o.verrou = false;
      if (o.type === 'cachet' && !res.cachet) { dire('Le cachet n\'est pas déposé sur ce poste.', 'erreur'); return true; }
      donnees.objets = donnees.objets || []; donnees.objets.push(o);
      salir(); rafraichir(); objetSel = o.id; objetsSel = [o.id]; panneau = 'objet'; peindreFormulaire(); setTimeout(marquerSelection, 50);
      dire('Objet collé', 'ok'); return true;
    }
    if (contenu.genre === 'objets') {
      donnees.objets = donnees.objets || []; objetsSel = [];
      contenu.objets.forEach(function (o) {
        if (o.type === 'cachet' && !res.cachet) return;
        o.id = 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); o.x += 6; o.y += 6; o.verrou = false;
        donnees.objets.push(o); objetsSel.push(o.id);
      });
      objetSel = objetsSel[objetsSel.length - 1] || null;
      salir(); rafraichir(); setTimeout(function () { marquerSelection(); peindreProps(); }, 50);
      dire(objetsSel.length + ' objets collés', 'ok'); return true;
    }
    if (contenu.genre === 'bloc') {
      if (!modeleActif.libre) { dire('Un bloc se colle dans un acte libre.', 'erreur'); return true; }
      var b = contenu.bloc;
      if (b.b === 'articles' && (donnees.blocs || []).some(function (y) { return y.b === 'articles'; })) { dire('Un seul bloc d\'articles par acte.', 'erreur'); return true; }
      if (b.source) { var src = 't' + Date.now().toString(36); donnees.tables = donnees.tables || {}; donnees.tables[src] = contenu.table || { colonnes: [], lignes: [] }; b.source = src; }
      donnees.blocs = donnees.blocs || [];
      var i = blocCourant && /^b\d+$/.test(blocCourant) ? +blocCourant.slice(1) + 1 : donnees.blocs.length;
      donnees.blocs.splice(i, 0, b);
      salir(); peindreFormulaire(); rafraichir();
      dire('Bloc collé', 'ok'); return true;
    }
    return false;
  }

  /* =================================================================
     10. SORTIR L'ACTE
     Le fichier exporté est la feuille telle qu'on la voit, pages
     comprises, moins ce qui n'appartient qu'à l'écran.
     ================================================================= */
  function documentComplet() {
    var titre = ech(donnees.titre || modeleActif.nom)
      + (donnees.numero ? ' n° ' + ech(donnees.numero) : '') + ' &middot; Baobabs Basket Club';
    var corps;
    if (cadre && cadrePret && cadre.contentDocument.querySelector('.pages')) {
      var clone = cadre.contentDocument.body.cloneNode(true);
      /* Le fichier source est un fichier de travail : il ne porte ni le
         cachet ni la signature, qui ne vont que sur le PDF imprimé ici.
         Sinon ce fichier serait une copie du cachet, bonne à recopier. */
      Array.prototype.forEach.call(clone.querySelectorAll('tr.tr-suite, .pill-vide, .sig-ink, .sig-cachet, .wm-brouillon, .objet-sensible, .objet-poignee, .objet-rotation'), function (n) { n.parentNode.removeChild(n); });
      Array.prototype.forEach.call(clone.querySelectorAll('.objet.is-sel'), function (n) { n.classList.remove('is-sel'); });
      Array.prototype.forEach.call(clone.querySelectorAll('[data-edit]'), function (n) {
        n.removeAttribute('data-edit'); n.removeAttribute('contenteditable'); n.removeAttribute('spellcheck');
      });
      corps = clone.innerHTML;
    } else {
      corps = corpsDocument();
    }
    return '<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
      + '<title>' + titre + '</title>\n'
      + '<style>\n' + cssPolices(true) + '\n</style>\n'
      + '<style>\n' + cssDocument() + '\n</style>\n'
      + '</head>\n<body class="pagine">\n' + corps + '\n</body>\n</html>\n';
  }

  function nomFichier() {
    var n = modeleActif.fichier ? modeleActif.fichier(donnees) : modeleActif.nom;
    return String(n).replace(/[\\/:*?"<>|]/g, '-');
  }

  function exporterHtml() {
    var b = new Blob([documentComplet()], { type: 'text/html;charset=utf-8' });
    var u = URL.createObjectURL(b);
    var a = document.createElement('a');
    a.href = u; a.download = nomFichier() + '.html';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
    journaliser('Fichier source exporté');
    dire('Fichier source téléchargé, sans signature ni cachet', 'ok');
  }

  function imprimer() {
    if (!cadre || !cadre.contentWindow) return;
    /* Le titre du document devient le nom proposé par Chrome dans la
       boîte « Enregistrer au format PDF ». */
    try { cadre.contentDocument.title = nomFichier(); } catch (e) {}
    journaliser('Imprimé' + (acteEtat === 'brouillon' ? ' (brouillon)' : ' V' + acteVersion));
    enregistrer(true);
    var w = cadre.contentWindow, d = cadre.contentDocument;
    /* les polices posées en data: se chargent vite, mais pas toujours avant la boîte d'impression */
    var pret = d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve();
    Promise.race([pret, new Promise(function (r) { setTimeout(r, 1500); })]).then(function () { w.focus(); w.print(); });
  }




  /* =================================================================
     6 sexies. LES ONGLETS : PLUSIEURS ACTES OUVERTS À LA FOIS
     Chaque acte ouvert garde son état (donnée, historique, référence,
     zoom) dans un onglet ; on passe de l'un à l'autre d'un clic, sans
     rien fermer, et le presse-papiers passe de l'un à l'autre. Ouvrir
     un acte déjà ouvert ramène à son onglet. Fermer un onglet demande
     s'il reste des changements non voulus ; quitter l'onglet en cours
     pour un autre enregistre ce qui a été touché.
     ================================================================= */
  var onglets = [], ongletCourant = null;
  function etatCourant() {
    return { modeleActif: modeleActif, donnees: donnees, acteEtat: acteEtat, acteVersion: acteVersion, acteVersions: acteVersions,
             acteJournal: acteJournal, acteEmisLe: acteEmisLe, acteMotif: acteMotif, acteDossier: acteDossier, acteId: acteId, acteSauve: acteSauve,
             acteReference: acteReference, acteTouche: acteTouche, modeLecture: modeLecture, histo: histo, histoI: histoI, zoom: zoom };
  }
  function restaurerEtat(s) {
    modeleActif = s.modeleActif; donnees = s.donnees; acteEtat = s.acteEtat; acteVersion = s.acteVersion; acteVersions = s.acteVersions;
    acteJournal = s.acteJournal; acteEmisLe = s.acteEmisLe; acteMotif = s.acteMotif; acteDossier = s.acteDossier || null; acteId = s.acteId; acteSauve = s.acteSauve;
    acteReference = s.acteReference; acteTouche = s.acteTouche; modeLecture = s.modeLecture; histo = s.histo; histoI = s.histoI; zoom = s.zoom || zoom;
    controle = null; panneau = 'donnees'; objetSel = null; objetsSel = []; blocSel = null; blocCourant = null; cadrePret = false;
  }
  function nomOnglet() {
    if (!modeleActif) return '';
    return (String(donnees.nomActe || '').trim() || (modeleActif.libre && String(donnees.titre || '').trim()) || modeleActif.nom) + (donnees.numero ? ' ' + donnees.numero : '');
  }
  function ongletDe(id) { return onglets.filter(function (o) { return o.id === id; })[0]; }
  /* l'acte qui vient d'être ouvert ou créé prend son onglet (ou le retrouve) */
  function ongletPourActeCourant() {
    var cle = acteId || ('neuf-' + Date.now().toString(36));
    var o = ongletDe(cle);
    if (!o) { o = { id: cle, nom: nomOnglet() }; onglets.push(o); }
    o.nom = nomOnglet();
    ongletCourant = o.id;
    peindreOnglets();
  }
  function ongletRenommer() {
    var o = ongletDe(ongletCourant);
    if (o) { if (acteId && o.id !== acteId) o.id = acteId, ongletCourant = acteId; o.nom = nomOnglet(); peindreOnglets(); }
  }
  function activerOnglet(id) {
    if (id === ongletCourant || !ongletDe(id)) return;
    var cour = ongletDe(ongletCourant);
    if (cour && modeleActif) {
      /* ce qui a été touché s'enregistre avant de changer d'onglet */
      if (acteTouche && !acteSauve && acteEtat === 'brouillon') enregistrer(true, true);
      cour.etat = etatCourant(); cour.nom = nomOnglet();
    }
    var cible = ongletDe(id);
    if (!cible.etat) return;
    restaurerEtat(cible.etat);
    ongletCourant = id;
    montrer('atelier');
    histoBoutons();
    peindreOnglets();
    majTitreBarre();
    noterReprise();
  }
  /* Fermer les autres (ou tous) : les onglets non touchés partent tout de
     suite ; ceux qui portent des changements non enregistrés restent, et on
     le dit, plutôt que de poser dix questions d'affilée. */
  function fermerOnglets(autres) {
    var gardes = [];
    onglets.slice().forEach(function (o) {
      if (autres && o.id === ongletCourant) return;
      var touche = o.id === ongletCourant ? (acteTouche && !acteSauve && acteEtat === 'brouillon') : !!(o.etat && o.etat.acteTouche && !o.etat.acteSauve && o.etat.acteEtat === 'brouillon');
      if (touche) { gardes.push(o.nom); return; }
      if (o.id === ongletCourant) {
        oublierReprise(); modeleActif = null; donnees = {}; acteId = null; acteSauve = true; acteReference = null; acteTouche = false; controle = null; modeLecture = false;
        onglets = onglets.filter(function (x) { return x.id !== o.id; }); ongletCourant = null;
      } else onglets = onglets.filter(function (x) { return x.id !== o.id; });
    });
    if (!modeleActif) {
      if (onglets.length) activerOnglet(onglets[0].id); else montrer('accueil');
    }
    peindreOnglets(); majTitreBarre();
    dire(gardes.length ? gardes.length + ' onglet' + (gardes.length > 1 ? 's' : '') + ' gardé' + (gardes.length > 1 ? 's' : '') + ' (modifications non enregistrées) : ' + gardes.join(', ') : 'Onglets fermés', gardes.length ? 'erreur' : 'ok');
  }
  function fermerOnglet(id) {
    onglets = onglets.filter(function (o) { return o.id !== id; });
    if (ongletCourant === id) ongletCourant = null;
    peindreOnglets();
  }
  function peindreOnglets() {
    var hote = $('gf-onglets');
    if (!hote) return;
    hote.hidden = !onglets.length || espace !== 'atelier';
    hote.innerHTML = onglets.map(function (o) {
      var actif = o.id === ongletCourant;
      var touche = actif ? (acteTouche && !acteSauve) : !!(o.etat && o.etat.acteTouche && !o.etat.acteSauve);
      return '<div class="gf-onglet' + (actif ? ' is-actif' : '') + '" data-onglet="' + ech(o.id) + '" role="tab" aria-selected="' + actif + '">'
        + '<span class="gf-onglet-nom">' + ech(o.nom || 'Acte') + '</span>' + (touche ? '<i class="gf-onglet-pt" title="Modifié"></i>' : '')
        + '<button type="button" class="gf-onglet-x" data-onglet-x="' + ech(o.id) + '" title="Fermer cet onglet" aria-label="Fermer">×</button></div>';
    }).join('') + '<button type="button" class="gf-onglet-plus" id="gf-onglet-plus" title="Nouvel acte dans un nouvel onglet (Alt+N)">+</button>';
    hote.querySelectorAll('[data-onglet]').forEach(function (b) {
      b.addEventListener('click', function (e) { if (e.target.closest('[data-onglet-x]')) return; activerOnglet(b.getAttribute('data-onglet')); });
    });
    hote.querySelectorAll('[data-onglet-x]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-onglet-x');
        if (id === ongletCourant) { fermerActe(); return; }
        var o = ongletDe(id);
        if (o && o.etat && o.etat.acteTouche && !o.etat.acteSauve) { activerOnglet(id); fermerActe(); return; }
        fermerOnglet(id);
      });
    });
    var plus = $('gf-onglet-plus'); if (plus) plus.addEventListener('click', function () { ouvrirNouveau(); });
  }

  /* =================================================================
     6 quinquies. LA BARRE D'OUTILS ET LE PANNEAU DE PROPRIÉTÉS
     Ce que demandait l'espace de travail : à gauche de la feuille, les
     outils qui posent ; à droite, ce que demande la sélection (l'objet,
     le bloc, le texte), les calques, les variables, l'historique. Rien
     de décoratif : chaque bouton fait quelque chose.
     ================================================================= */
  var propsOnglet = 'proprietes', grilleVisible = false, aimantActif = true;
  var outilZoom = false;

  /* =================================================================
     LE PANNEAU DE DROITE SE FERME, ET RESTE FERME
     « le panneau des propriétés doit pouvoir être fermé comme l'aperçu
       car ça gêne trop, même pour le zoom qu'il vient cacher »
     Mesure : sous 1500 px le panneau se pose en absolu depuis le haut
     de l'atelier, c'est-a-dire SUR la barre de l'apercu. Le moins du
     zoom (x=1147), le plus (x=1225) et la liste (x=1260) renvoyaient
     tous « gf-props-onglet ». Deux reponses : la feuille de style le
     fait commencer SOUS la barre, et il se ferme pour de bon. Ferme a
     la main, il ne se rouvre plus tout seul quand on choisit un objet :
     seul un geste qui demande des reglages (le bouton ⋯ d'un bloc, un
     onglet, l'outil, la languette) le rappelle.
     ================================================================= */
  var CLE_PROPS = 'greffe-props-ouvert';
  var propsVoulu = true;
  function propsLire() {
    try { var v = localStorage.getItem(CLE_PROPS); if (v !== null) propsVoulu = (v === '1'); } catch (e) {}
  }
  function propsOuvert() {
    var p = $('gf-props');
    return !!(p && p.offsetParent !== null);
  }
  function ouvrirProps(force) {
    if (!force && !propsVoulu) return false;
    if (force) { propsVoulu = true; try { localStorage.setItem(CLE_PROPS, '1'); } catch (e) {} }
    racine.classList.remove('gf-sans-props');
    racine.classList.add('gf-avec-props');
    majOutils();
    return true;
  }
  function fermerProps() {
    propsVoulu = false;
    try { localStorage.setItem(CLE_PROPS, '0'); } catch (e) {}
    racine.classList.add('gf-sans-props');
    racine.classList.remove('gf-avec-props');
    majOutils(); remesurer();
  }
  function basculerProps() {
    if (propsOuvert()) { fermerProps(); dire('Panneau de droite fermé · la languette du bord le rouvre', 'ok'); }
    else ouvrirProps(true);
  }

  /* ================================================================
     LES FENETRES SE REGLENT A LA MAIN
     « le redimensionnement des fenetres est absent, l'apercu ne peut
       pas se fermer, pas d'outil main »
     Deux poignees qu'on tire (le panneau, les proprietes), memorisees
     d'une fois sur l'autre ; l'apercu se replie sur une languette et
     se rouvre ; l'outil main fait glisser la feuille, ou la barre
     d'espace tenue le temps de la tenir.
     ================================================================ */
  var CLE_LARGEURS = 'greffe-largeurs';
  var outilMain = false, mainTemp = false, apercuReplie = false;
  function largeursLues() { try { return JSON.parse(localStorage.getItem(CLE_LARGEURS) || '{}') || {}; } catch (e) { return {}; } }
  function largeurPoser(quoi, px) {
    if (px == null) racine.style.removeProperty('--gf-' + quoi + '-l'); else racine.style.setProperty('--gf-' + quoi + '-l', px + 'px');
    var l = largeursLues(); if (px == null) delete l[quoi]; else l[quoi] = px;
    try { localStorage.setItem(CLE_LARGEURS, JSON.stringify(l)); } catch (e) {}
  }
  function remesurer() { setTimeout(function () { if (cadre && cadrePret) mesurer(cadre.contentDocument); }, 50); }
  function brancherPoignees() {
    var l = largeursLues();
    ['form', 'props'].forEach(function (q) { if (l[q]) racine.style.setProperty('--gf-' + q + '-l', l[q] + 'px'); });
    racine.querySelectorAll('[data-poignee]').forEach(function (p) {
      var quoi = p.getAttribute('data-poignee');
      var min = quoi === 'form' ? 280 : 220, max = quoi === 'form' ? 760 : 560, sens = quoi === 'form' ? 1 : -1;
      p.addEventListener('mousedown', function (e) {
        var cible = quoi === 'form' ? $('gf-form') : $('gf-props');
        if (e.button !== 0 || !cible) return;
        e.preventDefault();
        var x0 = e.clientX, l0 = cible.getBoundingClientRect().width;
        racine.classList.add('gf-redim');
        var bouge = function (ev) {
          var px = Math.round(Math.min(max, Math.max(min, l0 + (ev.clientX - x0) * sens)));
          racine.style.setProperty('--gf-' + quoi + '-l', px + 'px');
        };
        var fin = function () {
          document.removeEventListener('mousemove', bouge); document.removeEventListener('mouseup', fin);
          racine.classList.remove('gf-redim');
          largeurPoser(quoi, Math.round(cible.getBoundingClientRect().width)); remesurer();
        };
        document.addEventListener('mousemove', bouge); document.addEventListener('mouseup', fin);
      });
      p.addEventListener('dblclick', function () { largeurPoser(quoi, null); remesurer(); });
    });
  }
  /* Replier l'apercu ne doit jamais enfermer : sous 1500 px, le panneau
     de proprietes se pose en absolu sur le bord droit, exactement sur la
     languette qui rouvre. On le retire en meme temps, et on dit par ou
     revenir : « par erreur j'ai ferme l'apparition, je peux plus
     l'ouvrir » ne doit plus pouvoir arriver. */
  function basculerApercu() {
    apercuReplie = !apercuReplie;
    racine.classList.toggle('gf-sans-apercu', apercuReplie);
    if (apercuReplie) {
      racine.classList.remove('gf-avec-props');
      racine.classList.add('gf-sans-props');
      if (outilMain) mainActiver(false);
      if (outilZoom) zoomActiver(false);
      dire('Aperçu replié · la languette à droite le rouvre', 'ok');
    } else if (propsVoulu) {
      racine.classList.remove('gf-sans-props');
      racine.classList.add('gf-avec-props');
    }
    majOutils(); remesurer();
  }
  function mainActiver(on) {
    outilMain = !!on;
    if (outilMain) zoomActiver(false, true);
    var sc = $('gf-scene'); if (sc) sc.classList.toggle('gf-main', outilMain);
    majOutils();
  }
  /* LA LOUPE : le troisieme outil de navigation, a cote de la main.
     Un clic grossit autour du point clique, Alt+clic recule, deux clics
     reviennent a la largeur de la feuille. */
  function zoomActiver(on, sansMaj) {
    outilZoom = !!on;
    if (outilZoom && outilMain) { outilMain = false; var s0 = $('gf-scene'); if (s0) s0.classList.remove('gf-main'); }
    var sc = $('gf-scene'); if (sc) sc.classList.toggle('gf-zoomeur', outilZoom);
    if (!sansMaj) majOutils();
  }
  function zoomAutour(e, sens) {
    var sc = $('gf-scene'); if (!sc) return;
    var r = sc.getBoundingClientRect();
    var px = sc.scrollLeft + (e.clientX - r.left), py = sc.scrollTop + (e.clientY - r.top);
    var avant = zoom;
    zoomChoisi = true;
    zoom = Math.max(0.25, Math.min(2, sens > 0 ? zoom * 1.25 : zoom / 1.25));
    appliquerZoom();
    var k = zoom / avant;
    sc.scrollLeft = px * k - (e.clientX - r.left);
    sc.scrollTop = py * k - (e.clientY - r.top);
  }
  function brancherMain() {
    var sc = $('gf-scene'); if (!sc) return;
    sc.addEventListener('mousedown', function (e) {
      if (outilZoom && e.button === 0) { e.preventDefault(); zoomAutour(e, e.altKey ? -1 : 1); return; }
      if (!outilMain || e.button !== 0) return;
      e.preventDefault();
      var x0 = e.clientX, y0 = e.clientY, sx = sc.scrollLeft, sy = sc.scrollTop;
      sc.classList.add('gf-main-tire');
      var bouge = function (ev) { sc.scrollLeft = sx - (ev.clientX - x0); sc.scrollTop = sy - (ev.clientY - y0); };
      var fin = function () { document.removeEventListener('mousemove', bouge); document.removeEventListener('mouseup', fin); sc.classList.remove('gf-main-tire'); };
      document.addEventListener('mousemove', bouge); document.addEventListener('mouseup', fin);
    });
    /* la barre d'espace tenue : la main le temps de la tenir, comme
       dans un logiciel de dessin ; H la prend pour de bon */
    document.addEventListener('keydown', function (e) {
      if (!ouvert || espace !== 'atelier' || !modeleActif) return;
      var t = e.target; if (t && t.closest && t.closest('input, textarea, select, button, [contenteditable="true"]')) return;
      if (e.code === 'Space' && !e.repeat && !mainTemp && !outilMain) { e.preventDefault(); mainTemp = true; mainActiver(true); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var k = e.key.toLowerCase();
      if (k === 'h') { e.preventDefault(); mainActiver(!outilMain); }
      else if (k === 'z') { e.preventDefault(); zoomActiver(!outilZoom); }
      else if (k === 'v') { e.preventDefault(); outil('selection'); }
    });
    document.addEventListener('keyup', function (e) { if (e.code === 'Space' && mainTemp) { mainTemp = false; mainActiver(false); } });
    sc.addEventListener('dblclick', function (e) { if (outilZoom) { e.preventDefault(); zoomer('largeur'); } });
  }

  /* =================================================================
     LES BULLES : LE ROLE DE CHAQUE OUTIL, ECRIT EN TOUTES LETTRES
     « pas assez d'icones pour nous y retrouver, manque les bulles de
       dialogue, explique le role des outils »
     Le title du navigateur sort au bout d'une seconde, en gris systeme,
     sur une ligne, et il ne sort jamais au clavier. Ici : un nom, une
     phrase qui dit a quoi sert la chose, le raccourci. 240 ms a la
     souris, tout de suite au clavier. Un seul branchement sur la
     racine : tout ce qui porte data-bulle en herite, meme ce qui est
     dessine plus tard.
     ================================================================= */
  var bulle = null, bulleMinuteur = null, bulleCible = null;
  function bulleCacher() {
    clearTimeout(bulleMinuteur); bulleCible = null;
    if (bulle) { bulle.hidden = true; bulle.innerHTML = ''; }
  }
  function bulleMontrer(el) {
    if (!el || !el.getAttribute) return;
    var titre = el.getAttribute('data-bulle');
    if (!titre) return;
    if (el.disabled && !el.getAttribute('data-bulle-off')) { /* une bulle sur un bouton eteint dit pourquoi */ }
    if (!bulle || !bulle.parentNode) {
      bulle = document.createElement('div');
      bulle.className = 'gf-bulle';
      bulle.setAttribute('role', 'tooltip');
      bulle.hidden = true;
      racine.appendChild(bulle);
    }
    bulleCible = el;
    var role = el.getAttribute('data-bulle-off') && el.disabled
      ? el.getAttribute('data-bulle-off') : (el.getAttribute('data-bulle-role') || '');
    var rac = el.getAttribute('data-bulle-rac') || '';
    bulle.innerHTML = '<span class="gf-bulle-fleche"></span>'
      + '<span class="gf-bulle-tete"><b>' + ech(titre) + '</b>'
      + (rac ? '<kbd>' + ech(rac) + '</kbd>' : '') + '</span>'
      + (role ? '<span class="gf-bulle-role">' + ech(role) + '</span>' : '');
    bulle.hidden = false;
    bulle.style.left = '-9999px'; bulle.style.top = '0px';
    var r = el.getBoundingClientRect();
    var bw = bulle.offsetWidth, bh = bulle.offsetHeight, m = 10;
    var W = window.innerWidth, H = window.innerHeight, x, y, cote;
    if (r.right + m + bw <= W - 6) { x = r.right + m; cote = 'droite'; }
    else if (r.left - m - bw >= 6) { x = r.left - m - bw; cote = 'gauche'; }
    else {
      x = Math.min(Math.max(6, r.left + r.width / 2 - bw / 2), W - bw - 6);
      cote = (r.bottom + m + bh <= H - 6) ? 'bas' : 'haut';
    }
    if (cote === 'droite' || cote === 'gauche') y = Math.min(Math.max(6, r.top + r.height / 2 - bh / 2), H - bh - 6);
    else y = (cote === 'bas') ? r.bottom + m : r.top - m - bh;
    bulle.style.left = Math.round(x) + 'px';
    bulle.style.top = Math.round(y) + 'px';
    bulle.setAttribute('data-cote', cote);
    var f = bulle.querySelector('.gf-bulle-fleche');
    if (cote === 'droite' || cote === 'gauche') f.style.top = Math.round(Math.min(Math.max(9, r.top + r.height / 2 - y - 5), bh - 18)) + 'px';
    else f.style.left = Math.round(Math.min(Math.max(11, r.left + r.width / 2 - x - 5), bw - 20)) + 'px';
  }
  function brancherBulles() {
    if (racine.getAttribute('data-bulles')) return;
    racine.setAttribute('data-bulles', '1');
    racine.addEventListener('mouseover', function (e) {
      var c = e.target && e.target.closest ? e.target.closest('[data-bulle]') : null;
      if (c === bulleCible) return;
      bulleCacher();
      if (!c) return;
      var cible = c;
      bulleMinuteur = setTimeout(function () { bulleMontrer(cible); }, 240);
    });
    racine.addEventListener('mouseleave', bulleCacher);
    racine.addEventListener('focusin', function (e) {
      var c = e.target && e.target.closest ? e.target.closest('[data-bulle]') : null;
      if (c) bulleMontrer(c); else bulleCacher();
    });
    racine.addEventListener('focusout', bulleCacher);
    racine.addEventListener('mousedown', bulleCacher, true);
    racine.addEventListener('scroll', bulleCacher, true);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') bulleCacher(); }, true);
  }

  /* =================================================================
     LE REGISTRE DES OUTILS
     Un seul endroit dit ce qui existe, a quoi ca sert, et ce que ca
     dessine. Le rail est peint depuis lui : un outil ne peut plus etre
     dessine sans etre cable, ni cable sans etre dessine.
     ================================================================= */
  function gfSvg(d, epaisseur) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (epaisseur || 1.9)
      + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }
  var OUTILS = [
    { g: 'Se déplacer' },
    { o: 'selection', nom: 'Sélection', rac: 'Échap',
      role: "Prendre, déplacer et régler ce qui est posé sur la feuille. C'est l'outil de repos : Échap y ramène toujours.",
      ico: '<path d="M4 3l7 17 2.5-7 7-2.5z"/>' },
    { o: 'main', nom: 'Main', rac: 'H',
      role: "Faire glisser la feuille sans rien déplacer dessus. La barre d'espace tenue fait la même chose le temps qu'on la tient.",
      ico: '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 0 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>' },
    { o: 'zoom', nom: 'Loupe', rac: 'Z',
      role: "Cliquer sur la feuille pour grossir à cet endroit, Alt et clic pour reculer, deux clics pour revenir à la largeur.",
      ico: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6M8.2 11h5.6M11 8.2v5.6"/>' },

    { g: 'Poser sur la feuille' },
    { o: 'annotation', nom: 'Texte', pose: true,
      role: "Un texte libre posé où l'on veut, par-dessus l'acte. Il flotte : il ne rentre pas dans la mise en pages.",
      ico: '<path d="M5 6h14M12 6v13M9 19h6"/>' },
    { o: 'case', nom: 'Case à cocher', pose: true,
      role: "Une case et son libellé. Elle se coche d'un clic, directement sur la feuille.",
      ico: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 3 3 5-6"/>' },
    { o: 'image', nom: 'Image', pose: true,
      role: "Choisir une image et la poser. Une fois posée, elle se remplace, se recadre, se borde et se met en noir et blanc dans le panneau de droite. Une image glissée sur la feuille se pose aussi.",
      ico: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m21 16-5-5-8 8"/>' },
    { o: 'cadre', nom: 'Cadre', pose: true,
      role: "Un rectangle : encadrer un passage, réserver une zone, poser un fond teinté.",
      ico: '<rect x="4" y="5" width="16" height="14" rx="2"/>' },
    { o: 'ellipse', nom: 'Rond', pose: true,
      role: "Un ovale ou un cercle : entourer un mot, marquer un endroit de la feuille.",
      ico: '<ellipse cx="12" cy="12" rx="9" ry="6.6"/>' },
    { o: 'ligne', nom: 'Trait', pose: true,
      role: "Un trait droit, plein ou pointillé : souligner, barrer, séparer deux parties.",
      ico: '<path d="M4 18.5 20 5.5"/>' },
    { o: 'fleche', nom: 'Flèche', pose: true,
      role: "Un trait fléché, pour montrer quelque chose sur la feuille.",
      ico: '<path d="M4 12h14M13 6l6 6-6 6"/>' },
    { o: 'surligneur', nom: 'Surligneur', pose: true,
      role: "Un aplat translucide posé par-dessus le texte, comme un feutre. Il s'imprime.",
      ico: '<path d="M15 3.5 20.5 9 11 18.5H6.5L4 21v-3l2.5-2.5z"/><path d="M12.5 6 18 11.5"/>' },

    { g: 'Signer' },
    { o: 'signature', nom: 'Signature', pose: true,
      role: "La signature manuscrite du signataire, posée à l'endroit voulu. Elle ne part pas dans le fichier source.",
      ico: '<path d="M3 17c3-6 5-6 6 0s3 6 5 0 3-4 7 0"/><path d="M3 21h18"/>' },
    { o: 'cachet', nom: 'Cachet', pose: true,
      role: "Le cachet de la présidence. Il naît verrouillé : un élément sensible ne se déplace pas par mégarde.",
      ico: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>' },

    { g: 'Composer l\'acte' },
    { o: 'variable', nom: 'Variable', pose: true,
      role: "Insérer une valeur du club (nom, président, date, numéro) là où est le curseur. Elle s'écrit en clair et reste une variable.",
      ico: '<path d="M8 4c-2 0-3 1-3 3v3c0 1-1 2-2 2 1 0 2 1 2 2v3c0 2 1 3 3 3M16 4c2 0 3 1 3 3v3c0 1 1 2 2 2-1 0-2 1-2 2v3c0 2-1 3-3 3"/>' },
    { o: 'bloc', nom: 'Bloc', pose: true,
      role: "Ajouter une partie entière : en-tête, titre, tableau, articles, signatures. Réservé aux actes libres et aux préréglages.",
      offRole: "Cet acte suit un modèle fixe : ses parties sont écrites par le modèle. Les objets (texte, image, cadre) se posent quand même.",
      ico: '<rect x="4" y="4" width="16" height="6" rx="1.5"/><rect x="4" y="14" width="16" height="6" rx="1.5"/>' },

    { g: 'Repères' },
    { o: 'grille', nom: 'Grille de 5 mm', bascule: true,
      role: "Un quadrillage de 5 mm sur la page, à l'écran seulement. Il ne s'imprime jamais.",
      ico: '<path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>' },
    { o: 'aimant', nom: 'Aimant', bascule: true,
      role: "Ce qu'on déplace se colle aux marges, au milieu de la page et aux bords des autres objets. Alt tenu passe outre.",
      ico: '<path d="M6 3v8a6 6 0 0 0 12 0V3"/><path d="M6 3h4v8H6zM14 3h4v8h-4z"/>' },
    { o: 'filigrane', nom: 'Filigrane BROUILLON', bascule: true,
      role: "Le mot BROUILLON écrit en travers de chaque page tant que l'acte n'est pas émis. Ici on l'enlève, et on le remet.",
      offRole: "Cet acte n'est plus un brouillon : il n'y a plus de filigrane à retirer.",
      ico: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m7.5 15.5 9-9"/>' },

    { g: 'Panneaux' },
    { o: 'proprietes', nom: 'Panneau de droite', bascule: true,
      role: "Ce que demande ce qui est choisi : l'objet, le bloc, le texte. Et les calques, les variables, l'historique.",
      ico: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>' },
    { o: 'apercu', nom: 'Aperçu de la feuille', bascule: true,
      role: "Replier la feuille pour donner toute la place au panneau de gauche, ou la rouvrir. Repliée, une languette la rappelle.",
      ico: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>' },
    { o: 'aide-outils', nom: 'À quoi sert chaque outil',
      role: "La liste des outils, ce que chacun fait, et son raccourci.",
      ico: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.2 2.4c-.6.2-1 .8-1 1.4v.6"/><path d="M11.9 17.2h.02"/>' }
  ];

  var railPlie = false, CLE_RAIL = 'greffe-rail-plie';
  function railLire() {
    var v = null;
    try { v = localStorage.getItem(CLE_RAIL); } catch (e) {}
    /* Jamais regle : ouvert si l'ecran est assez large pour les noms,
       replie sinon. On ne vole pas la feuille sur un petit ecran. */
    railPlie = (v === null) ? (window.innerWidth < 1280) : (v === '1');
  }
  function peindreRail() {
    var rail = $('gf-rail');
    if (!rail) return;
    rail.classList.toggle('est-pliee', railPlie);
    var h = '<div class="gf-rail-tete"><b>Outils</b>'
      + '<button type="button" class="gf-rail-plier" data-rail="plier"'
      + ' data-bulle="' + (railPlie ? 'Ouvrir la barre d\'outils' : 'Replier la barre d\'outils') + '"'
      + ' data-bulle-role="' + (railPlie ? 'Écrire le nom de chaque outil à côté de son icône.' : 'Ne garder que les icônes, et rendre la largeur à la feuille.') + '"'
      + ' aria-label="' + (railPlie ? 'Ouvrir' : 'Replier') + ' la barre d\'outils">'
      + gfSvg(railPlie ? '<path d="m9 6 6 6-6 6"/>' : '<path d="m15 6-6 6 6 6"/>') + '</button></div>';
    OUTILS.forEach(function (o) {
      if (o.g) { h += '<div class="gf-rail-groupe">' + ech(o.g) + '</div>'; return; }
      h += '<button type="button" class="gf-outil" data-outil="' + ech(o.o) + '"'
        + ' data-bulle="' + ech(o.nom) + '" data-bulle-role="' + ech(o.role) + '"'
        + (o.offRole ? ' data-bulle-off="' + ech(o.offRole) + '"' : '')
        + (o.rac ? ' data-bulle-rac="' + ech(o.rac) + '"' : '')
        + ' aria-label="' + ech(o.nom) + '">'
        + gfSvg(o.ico)
        + '<span class="gf-outil-nom">' + ech(o.nom) + '</span>'
        + (o.bascule ? '<span class="gf-outil-temoin"></span>'
                     : (o.rac ? '<span class="gf-outil-rac">' + ech(o.rac) + '</span>' : ''))
        + '</button>';
    });
    rail.innerHTML = h;
    rail.querySelectorAll('[data-outil]').forEach(function (b) {
      b.addEventListener('mousedown', function (e) { e.preventDefault(); });   /* la sélection de la feuille reste */
      b.addEventListener('click', function () { outil(b.getAttribute('data-outil')); });
    });
    var pl = rail.querySelector('[data-rail="plier"]');
    if (pl) pl.addEventListener('click', function () {
      railPlie = !railPlie;
      try { localStorage.setItem(CLE_RAIL, railPlie ? '1' : '0'); } catch (e) {}
      bulleCacher(); peindreRail(); remesurer();
    });
    majOutils();
  }
  /* la liste des outils, en clair : ce que chacun fait, son raccourci */
  function aideOutils() {
    var h = '<p class="gf-modale-aide">La barre est à gauche de la feuille. Le chevron, en haut, l\'ouvre pour écrire les noms, ou la replie sur ses icônes. Passer la souris sur un outil en dit le rôle.</p>';
    var groupe = '';
    OUTILS.forEach(function (o) {
      if (o.g) { groupe = o.g; h += '<h4 class="gf-modale-h4">' + ech(o.g) + '</h4><div class="gf-aide-outils">'; return; }
      h += '<div class="gf-aide-outil"><span class="gf-aide-ico">' + gfSvg(o.ico) + '</span>'
        + '<span class="gf-aide-txt"><b>' + ech(o.nom) + (o.rac ? ' <kbd>' + ech(o.rac) + '</kbd>' : '') + '</b>'
        + '<span>' + ech(o.role) + '</span></span></div>';
    });
    h += '</div>';
    modale('À quoi sert chaque outil', h, [{ lab: 'Fermer' }]);
  }

  function brancherOutils() {
    var rail = $('gf-rail');
    if (!rail) return;
    brancherBulles();
    /* hors du rail : la languette de l'apercu, sa croix, le bouton du
       filigrane de la barre. Le rail, lui, cable au moment ou il peint. */
    racine.querySelectorAll('[data-outil]').forEach(function (b) {
      if (b.closest('#gf-rail')) return;
      b.addEventListener('mousedown', function (e) { e.preventDefault(); });   /* la sélection de la feuille reste */
      b.addEventListener('click', function () { outil(b.getAttribute('data-outil')); });
    });
    var vx = racine.querySelector('[data-vignettes="fermer"]');
    if (vx) vx.addEventListener('click', basculerVignettes);
    railLire(); propsLire(); peindreRail();
    if (!propsVoulu) { racine.classList.add('gf-sans-props'); racine.classList.remove('gf-avec-props'); }
    brancherLiaisonPanneau();
    brancherPoignees(); brancherMain();
    var props = $('gf-props');
    if (props) {
      props.querySelectorAll('[data-props]').forEach(function (o) {
        o.addEventListener('click', function () { propsOnglet = o.getAttribute('data-props'); peindreProps(); });
      });
      props.addEventListener('mousedown', function (e) {
        var t = e.target;
        if (t.closest && t.closest('button') && !t.closest('input, textarea, select')) e.preventDefault();
      });
    }
  }
  function outil(nom) {
    if (nom === 'apercu') { basculerApercu(); return; }
    if (nom === 'aide-outils') { aideOutils(); return; }
    if (nom === 'proprietes') { basculerProps(); return; }
    if (!modeleActif) { dire('Ouvrez d\'abord un acte.', 'erreur'); return; }
    if (nom === 'main') { mainActiver(!outilMain); return; }
    if (nom === 'zoom') { zoomActiver(!outilZoom); return; }
    if (nom === 'filigrane') { basculerFiligrane(); return; }
    if (nom === 'selection') { mainActiver(false); zoomActiver(false); selectionnerObjet(null); majOutils(); return; }
    if (nom === 'grille') { grilleVisible = !grilleVisible; appliquerGrille(); majOutils(); return; }
    if (nom === 'aimant') { aimantActif = !aimantActif; majOutils(); dire(aimantActif ? 'Aimant activé' : 'Aimant désactivé', 'ok'); return; }
    if (lectureSeule()) { dire('Cet acte ne se modifie plus.', 'erreur'); return; }
    if (nom === 'image') { poserImageObjet(); return; }
    if (nom === 'variable') { insererVariable(); return; }
    if (nom === 'bloc') {
      if (!modeleActif.libre) { dire('Les blocs se posent dans un acte libre. Ici, les objets (texte, case, image, cadre) se posent partout.', 'erreur'); return; }
      choisirBloc(); return;
    }
    if (TYPES_OBJET[nom]) { poserObjet(nom); return; }
  }
  /* LE FILIGRANE « BROUILLON » SE RETIRE
     « on doit pouvoir facilement enlever le watermark Brouillon »
     Il etait pose par l'etat de l'acte, sans aucun interrupteur. La
     reponse tient dans la donnee de l'acte : elle se sauve, se rouvre
     et s'exporte avec lui. Deux boutons pour la meme bascule, la barre
     d'outils et la barre de l'apercu, plus le menu Affichage. */
  function filigraneVisible() {
    return acteEtat === 'brouillon' && !!donnees && donnees.filigrane !== false;
  }
  function basculerFiligrane() {
    if (!modeleActif) { dire('Ouvrez d\'abord un acte.', 'erreur'); return; }
    if (acteEtat !== 'brouillon') { dire('Cet acte n\'est plus un brouillon : il n\'a pas de filigrane.', 'ok'); return; }
    if (donnees.filigrane === false) delete donnees.filigrane; else donnees.filigrane = false;
    salir(); rafraichir(); majOutils();
    dire(donnees.filigrane === false ? 'Filigrane BROUILLON retiré de la feuille' : 'Filigrane BROUILLON remis', 'ok');
  }

  function majOutils() {
    var rail = $('gf-rail');
    if (!rail) return;
    var props = $('gf-props');
    var propsVu = !!(props && props.offsetParent !== null);
    var fili = filigraneVisible();
    rail.querySelectorAll('[data-outil]').forEach(function (b) {
      var n = b.getAttribute('data-outil');
      if (n === 'selection') b.classList.toggle('is-actif', !objetSel && !outilMain && !outilZoom);
      else if (n === 'main') b.classList.toggle('is-actif', outilMain);
      else if (n === 'zoom') b.classList.toggle('is-actif', outilZoom);
      else if (n === 'apercu') b.classList.toggle('is-actif', !apercuReplie);
      else if (n === 'grille') b.classList.toggle('is-actif', grilleVisible);
      else if (n === 'aimant') b.classList.toggle('is-actif', aimantActif);
      else if (n === 'filigrane') { b.classList.toggle('is-actif', fili); b.disabled = !modeleActif || acteEtat !== 'brouillon'; }
      else if (n === 'proprietes') b.classList.toggle('is-actif', propsVu);
      else if (n === 'bloc') b.disabled = !modeleActif || !modeleActif.libre;
      else if (n !== 'aide-outils') b.disabled = !modeleActif;
    });
    var lan = racine.querySelector('.gf-props-languette');
    if (lan) lan.hidden = propsOuvert() || apercuReplie || espace !== 'atelier';
    var bf = $('gf-filigrane');
    if (bf) {
      bf.classList.toggle('is-actif', fili);
      bf.disabled = !modeleActif || acteEtat !== 'brouillon';
      bf.hidden = !modeleActif || acteEtat !== 'brouillon';
    }
  }
  function appliquerGrille() {
    var doc = cadre && cadrePret ? cadre.contentDocument : null;
    if (doc) doc.body.classList.toggle('grille', grilleVisible);
  }
  /* la palette d'un acte libre, en boîte : un clic pose le bloc */
  function choisirBloc() {
    var cat = modeleActif.catalogue || [];
    var familles = {};
    cat.forEach(function (e) { (familles[e.famille || 'Blocs'] = familles[e.famille || 'Blocs'] || []).push(e); });
    var html = Object.keys(familles).map(function (f) {
      return '<div class="gf-fam"><span class="gf-lab">' + ech(f) + '</span><div class="gf-cartes gf-cartes-mini">' + familles[f].map(function (e) {
        return '<button type="button" class="gf-carte gf-carte-mini" data-bloc="' + ech(e.type) + '" data-bloc-i="' + cat.indexOf(e) + '" title="' + ech(e.resume || '') + '"><b>' + ech(e.nom) + '</b></button>';
      }).join('') + '</div></div>';
    }).join('');
    modale('Poser un bloc', html, [{ lab: 'Fermer' }]);
    var voile = racine.querySelector('.gf-voile:last-child');
    if (!voile) return;
    voile.querySelectorAll('[data-bloc]').forEach(function (b) {
      b.addEventListener('click', function () {
        var e = cat[+b.getAttribute('data-bloc-i')];
        voile.remove();
        if (e) poserBloc(e);
      });
    });
  }

  function peindreProps() {
    var hote = $('gf-props-corps');
    if (!hote) return;
    majOutils();
    racine.querySelectorAll('[data-props]').forEach(function (o) { o.classList.toggle('is-actif', o.getAttribute('data-props') === propsOnglet); });
    hote.innerHTML = '';
    if (!modeleActif) { hote.innerHTML = '<p class="gf-props-vide">Ouvrez un acte.</p>'; return; }
    if (propsOnglet === 'calques') return peindreCalques(hote);
    if (propsOnglet === 'variables') return peindreVariables(hote);
    if (propsOnglet === 'historique') return peindreHistoriqueProps(hote);
    /* propriétés : l'objet, sinon le bloc, sinon le texte et la page */
    if (objetSel && objetDe(objetSel) && !lectureSeule()) { peindreObjet(hote); return; }
    if (blocSel && !lectureSeule()) { peindreBloc(hote); return; }
    var doc = cadre && cadrePret ? cadre.contentDocument : null;
    var sel = doc ? doc.getSelection() : null;
    var dansTexte = !!(sel && sel.rangeCount && sel.anchorNode && (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode).closest && (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode).closest('[data-edit]'));
    var lect = lectureSeule();
    var teintes = [['Or', '#C1A462'], ['Vert', '#0F432B'], ['Rouge', '#B4231F'], ['Gris', '#8C948F']];
    var h = '';
    if (!lect) {
      h += '<div class="gf-props-titre">Texte</div>'
        + '<p class="gf-props-vide" style="margin-bottom:8px">' + (dansTexte ? 'Sélectionnez des mots sur la feuille, puis :' : 'Cliquez dans un texte de la feuille, sélectionnez des mots, puis :') + '</p>'
        + '<div class="gf-typo">'
        + '<button type="button" data-tx="bold" title="Gras (Ctrl+B)"><b>B</b></button>'
        + '<button type="button" data-tx="italic" title="Italique (Ctrl+I)"><i>I</i></button>'
        + '<button type="button" data-tx="underline" title="Souligné (Ctrl+U)"><u>U</u></button>'
        + '<button type="button" data-tx="surligner" title="Surligner">ab</button>'
        + teintes.map(function (t) { return '<button type="button" class="gf-flot-teinte" data-teinte="' + t[1] + '" title="' + t[0] + '" style="--t:' + t[1] + '"></button>'; }).join('')
        + '<button type="button" data-tx="grand" title="Plus grand">A+</button>'
        + '<button type="button" data-tx="petit" title="Plus petit">A-</button>'
        + '<button type="button" data-tx="effacer" title="Retirer la mise en forme">✕</button>'
        + '</div>';
      if (blocCourant) {
        h += '<div class="gf-props-titre">Bloc</div><p class="gf-props-vide">' + ech(nomDuBloc(blocCourant)) + '</p>'
          + '<div class="gf-typo" style="margin-top:6px"><button type="button" class="gf-long" data-bloc-reglages>Réglages du bloc : taille, alignement, couleur, police</button></div>';
      }
    }
    h += '<div class="gf-props-titre">La page</div>'
      + '<div class="gf-var"><span>Acte</span><code>' + ech((donnees.nomActe || donnees.titre || modeleActif.nom)) + '</code></div>'
      + '<div class="gf-var"><span>Dossier</span><code>' + ech(nomDossier(acteDossier) || 'aucun') + '</code><button type="button" class="gf-mini" data-ranger-courant>' + (acteDossier && dossierDe(acteDossier) ? 'Changer' : 'Ranger') + '</button></div>'
      + '<div class="gf-var"><span>Numéro</span><code>' + ech(donnees.numero || 'sans') + '</code></div>'
      + '<div class="gf-var"><span>Pages</span><code>' + nbPages + '</code></div>'
      + '<div class="gf-var"><span>Objets posés</span><code>' + (donnees.objets || []).length + '</code></div>'
      + '<div class="gf-var"><span>Grille 5 mm</span><button type="button" class="gf-mini" data-outil2="grille">' + (grilleVisible ? 'Masquer' : 'Montrer') + '</button></div>'
      + '<div class="gf-var"><span>Aimant</span><button type="button" class="gf-mini" data-outil2="aimant">' + (aimantActif ? 'Désactiver' : 'Activer') + '</button></div>';
    hote.innerHTML = h;
    hote.querySelectorAll('[data-tx]').forEach(function (b) { b.addEventListener('click', function () { commandeTexte(b.getAttribute('data-tx')); }); });
    hote.querySelectorAll('[data-teinte]').forEach(function (b) { b.addEventListener('click', function () { commandeTexte('teinte', b.getAttribute('data-teinte')); }); });
    hote.querySelectorAll('[data-outil2]').forEach(function (b) { b.addEventListener('click', function () { outil(b.getAttribute('data-outil2')); peindreProps(); }); });
    var br = hote.querySelector('[data-bloc-reglages]');
    if (br) br.addEventListener('click', function () { commandeBloc('reglages', blocCourant); });
    var bd = hote.querySelector('[data-ranger-courant]');
    if (bd) bd.addEventListener('click', rangerActeCourant);
  }
  function peindreCalques(hote) {
    var objets = donnees.objets || [];
    if (!objets.length) { hote.innerHTML = '<p class="gf-props-vide">Aucun objet posé. La barre d\'outils, à gauche de la feuille, en pose : texte, case, image, cadre, flèche, signature, cachet.</p>'; return; }
    hote.innerHTML = '<div class="gf-props-titre">Objets posés, du dessus au dessous</div>' + objets.slice().reverse().map(function (o) {
      var T = TYPES_OBJET[o.type] || { nom: o.type };
      return '<div class="gf-calque' + (objetSel === o.id ? ' is-actif' : '') + '" data-calque="' + ech(o.id) + '">'
        + '<b>' + ech(T.nom + (o.texte ? ' · ' + String(o.texte).slice(0, 24) : '')) + '</b><span>p. ' + (o.page || 1) + '</span>'
        + '<button type="button" class="gf-ico" data-calque-verrou="' + ech(o.id) + '" title="' + (o.verrou ? 'Déverrouiller' : 'Verrouiller') + '">' + (o.verrou ? '🔒' : '🔓') + '</button>'
        + '<button type="button" class="gf-ico" data-calque-retirer="' + ech(o.id) + '" title="Retirer">✕</button></div>';
    }).join('');
    hote.querySelectorAll('[data-calque]').forEach(function (c) {
      c.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        var o = objetDe(c.getAttribute('data-calque'));
        if (o && o.page) allerPage(o.page);
        selectionnerObjet(c.getAttribute('data-calque'));
      });
    });
    hote.querySelectorAll('[data-calque-verrou]').forEach(function (b) {
      b.addEventListener('click', function () { var o = objetDe(b.getAttribute('data-calque-verrou')); if (o) { o.verrou = !o.verrou; salir(); rafraichir(); peindreProps(); } });
    });
    hote.querySelectorAll('[data-calque-retirer]').forEach(function (b) {
      b.addEventListener('click', function () { retirerObjet(b.getAttribute('data-calque-retirer')); peindreProps(); });
    });
  }
  function peindreVariables(hote) {
    var lignes = listeTextes('variables');
    hote.innerHTML = '<p class="gf-props-vide">Cliquez dans un texte de la feuille, puis « Insérer » : la variable s\'écrit avec sa valeur et reste une variable. Les valeurs du club se règlent dans Paramètres.</p>'
      + '<div class="gf-props-titre">Variables</div>'
      + lignes.map(function (v) {
          var val = v.texte.replace(VAR_RE, function (m, r, ch) { return valeurVariable(r, ch); });
          return '<div class="gf-var"><code>' + ech(v.texte) + '</code><span>' + ech(String(val).slice(0, 26)) + '</span><button type="button" class="gf-mini" data-var-ins="' + ech(v.texte) + '">Insérer</button></div>';
        }).join('')
      + '<div class="gf-typo" style="margin-top:12px"><button type="button" data-espace2="parametres">Identité du club…</button></div>';
    hote.querySelectorAll('[data-var-ins]').forEach(function (b) {
      b.addEventListener('click', function () {
        var doc = cadre && cadrePret ? cadre.contentDocument : null;
        if (!doc) return;
        var sel = doc.getSelection();
        var el = sel && sel.rangeCount ? (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode) : null;
        el = el && el.closest ? el.closest('[data-edit]') : null;
        if (!el || lectureSeule()) { try { navigator.clipboard.writeText(b.getAttribute('data-var-ins')); } catch (e) {} dire(b.getAttribute('data-var-ins') + ' copié : cliquez dans un texte de la feuille et collez.', 'ok'); return; }
        cadre.contentWindow.focus();
        doc.execCommand('insertText', false, b.getAttribute('data-var-ins'));
      });
    });
    var pe = hote.querySelector('[data-espace2]'); if (pe) pe.addEventListener('click', function () { montrer('parametres'); });
  }
  function peindreHistoriqueProps(hote) {
    var versions = acteVersions.slice().reverse().map(function (v) {
      return '<div class="gf-var"><code>V' + v.v + '</code><span>' + (v.etat === 'emise' ? 'Émise' : 'Remplacée') + ' le ' + ech(dateHeure(v.emisLe)) + '</span><button type="button" class="gf-mini" data-ouvrir-version="' + v.v + '">Ouvrir</button></div>';
    }).join('') || '<p class="gf-props-vide">Aucune version émise.</p>';
    var journal = acteJournal.slice().reverse().slice(0, 40).map(function (j) {
      return '<div class="gf-var"><span style="flex:0 0 auto">' + ech(dateHeure(j.t)) + '</span><span style="color:var(--gf-texte)">' + ech(j.quoi) + '</span></div>';
    }).join('') || '<p class="gf-props-vide">Rien encore.</p>';
    hote.innerHTML = '<div class="gf-props-titre">Versions</div>' + versions + '<div class="gf-props-titre">Journal</div>' + journal;
    hote.querySelectorAll('[data-ouvrir-version]').forEach(function (b) {
      b.addEventListener('click', function () { var f = ficheCourante(); ouvrirActe(f, +b.getAttribute('data-ouvrir-version')); });
    });
  }

  /* =================================================================
     10 bis. LA SÉRIE : UN ACTE PAR LIGNE D'UNE LISTE
     Une convocation par joueuse, une autorisation par mineure, une
     attestation par membre : l'acte ouvert sert de modèle, ses textes
     portent {{col.nom}}, {{col.categorie}}… ; on colle la liste (depuis
     Excel, Google Sheets, ou l'admin), et le Greffe fabrique un acte
     par ligne, numéroté à la suite, chacun gardant sa ligne : la donnée
     reste une donnée, la variable une variable. Puis tout s'imprime
     d'un coup, dans un seul PDF.
     ================================================================= */
  function cleSerie(titre) {
    var s = String(titre || '').toLowerCase();
    if (s.normalize) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return s.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'col';
  }
  function lireListe(texte) {
    var lignes = String(texte || '').replace(/\r/g, '').split('\n').filter(function (l) { return l.trim(); });
    if (!lignes.length) return { colonnes: [], lignes: [] };
    var sep = lignes[0].indexOf('\t') !== -1 ? '\t' : (lignes[0].split(';').length > lignes[0].split(',').length ? ';' : ',');
    function champs(l) {
      if (sep === '\t') return l.split('\t');
      var out = [], cur = '', q = false;
      for (var i = 0; i < l.length; i++) {
        var ch = l[i];
        if (ch === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
        else if (ch === sep && !q) { out.push(cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur);
      return out;
    }
    var tetes = champs(lignes[0]).map(function (t) { return t.trim(); });
    var cles = tetes.map(cleSerie);
    var rows = lignes.slice(1).map(function (l) {
      var v = champs(l), o = {};
      cles.forEach(function (c, i) { o[c] = (v[i] == null ? '' : String(v[i])).trim(); });
      return o;
    }).filter(function (o) { return Object.keys(o).some(function (k) { return o[k]; }); });
    return { colonnes: tetes.map(function (t, i) { return { titre: t, cle: cles[i] }; }), lignes: rows };
  }
  function prochainNumero(cle, pris) {
    var m = G.modeles[cle];
    if (!m || !m.prefixe) return '';
    var an = String(new Date().getFullYear()).slice(2);
    var occupes = registre.filter(function (a) { return a.modele === cle && String(a.numero || '').slice(-2) === an; })
      .map(function (a) { return parseInt(String(a.numero).split('/')[0], 10) || 0; }).concat(pris || []);
    var n = 1; while (occupes.indexOf(n) !== -1) n++;
    return deuxChiffres(n) + '/' + an;
  }
  function ouvrirSerie() {
    if (!modeleActif || lectureSeule()) return;
    var recu = null;
    try { recu = JSON.parse(localStorage.getItem('bbc-greffe-serie') || 'null'); } catch (e) {}
    var voile = document.createElement('div');
    voile.className = 'gf-voile';
    voile.innerHTML =
      '<div class="gf-modale gf-modale-large" role="dialog" aria-modal="true">'
      + '<header class="gf-modale-top"><h3>Une série d\'actes depuis une liste</h3>'
      + '<button type="button" class="gf-ico gf-ico-close" data-x aria-label="Fermer">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></header>'
      + '<div class="gf-modale-corps">'
      + '<p class="gf-modale-aide">L\'acte ouvert sert de modèle. Dans ses textes, écrivez <code>{{col.nom}}</code>, <code>{{col.categorie}}</code>… (les noms viennent de la première ligne de la liste). '
      + 'Puis collez la liste : depuis Excel ou Google Sheets, sélectionnez les cellules, en-têtes compris, et Ctrl+C.</p>'
      + (recu && recu.lignes && recu.lignes.length ? '<div class="gf-serie-recu"><b>' + ech(recu.titre || 'Liste reçue de l\'administration') + '</b> · ' + recu.lignes.length + ' ligne' + (recu.lignes.length > 1 ? 's' : '')
          + ' <button type="button" class="gf-mini" data-recu>Utiliser cette liste</button></div>' : '')
      + '<textarea class="gf-in gf-serie-texte" data-liste rows="7" placeholder="Nom&#9;Catégorie&#9;Parent&#10;Awa Diop&#9;U14&#9;Mme Fall&#10;…"></textarea>'
      + '<label class="gf-mini" style="display:inline-flex;margin-top:8px" for="gf-serie-fichier">Ou déposer un fichier .csv / .txt</label><input type="file" id="gf-serie-fichier" accept=".csv,.tsv,.txt,text/csv,text/plain" hidden>'
      + '<div class="gf-serie-apercu" data-apercu></div>'
      + '<div class="gf-grille2" style="margin-top:10px">'
      + '<label class="gf-champ"><span>Nom de chaque acte au registre</span><input class="gf-in" type="text" data-nom placeholder="{{col.nom}}"></label>'
      + '<label class="gf-champ"><span>Après la création</span><select class="gf-sel" data-apres><option value="registre">Ouvrir le registre</option><option value="imprimer">Tout imprimer en un PDF</option><option value="rester">Rester sur le modèle</option></select></label>'
      + '<label class="gf-champ"><span>Dossier de la série (vide : aucun)</span><input class="gf-in" type="text" data-dossier-serie list="gf-dossiers-liste" value="' + ech(recu && recu.titre ? recu.titre : (acteDossier ? nomDossier(acteDossier) : '')) + '" placeholder="Convocations U15 septembre"><datalist id="gf-dossiers-liste">' + dossiers.map(function (d) { return '<option value="' + ech(d.nom) + '">'; }).join('') + '</datalist></label>'
      + '</div></div>'
      + '<footer class="gf-modale-pied"><button type="button" class="gf-btn gf-btn-fant" data-x>Annuler</button>'
      + '<button type="button" class="gf-btn gf-btn-accent" data-creer disabled>Créer les actes</button></footer></div>';
    racine.appendChild(voile);
    var zone = voile.querySelector('[data-liste]'), apercu = voile.querySelector('[data-apercu]'), creer = voile.querySelector('[data-creer]'), nomIn = voile.querySelector('[data-nom]');
    var liste = { colonnes: [], lignes: [] };
    function fermer() { if (voile.parentNode) voile.remove(); }
    function montrerListe() {
      if (!liste.lignes.length) { apercu.innerHTML = ''; creer.disabled = true; creer.textContent = 'Créer les actes'; return; }
      apercu.innerHTML = '<p class="gf-aide">' + liste.lignes.length + ' ligne' + (liste.lignes.length > 1 ? 's' : '') + ' · les variables : '
        + liste.colonnes.map(function (c) { return '<button type="button" class="gf-puce" data-var="{{col.' + ech(c.cle) + '}}" title="Copier">{{col.' + ech(c.cle) + '}}</button>'; }).join(' ') + '</p>'
        + '<div class="gf-serie-table"><table><thead><tr>' + liste.colonnes.map(function (c) { return '<th>' + ech(c.titre) + '</th>'; }).join('') + '</tr></thead><tbody>'
        + liste.lignes.slice(0, 5).map(function (l) { return '<tr>' + liste.colonnes.map(function (c) { return '<td>' + ech(l[c.cle]) + '</td>'; }).join('') + '</tr>'; }).join('')
        + (liste.lignes.length > 5 ? '<tr><td colspan="' + liste.colonnes.length + '">… et ' + (liste.lignes.length - 5) + ' de plus</td></tr>' : '') + '</tbody></table></div>';
      apercu.querySelectorAll('[data-var]').forEach(function (b) {
        b.addEventListener('click', function () { try { navigator.clipboard.writeText(b.getAttribute('data-var')); } catch (e) {} dire(b.getAttribute('data-var') + ' copié : collez-le dans le texte de l\'acte', 'ok'); });
      });
      if (!nomIn.value && liste.colonnes.length) nomIn.value = '{{col.' + liste.colonnes[0].cle + '}}';
      creer.disabled = false; creer.textContent = 'Créer ' + liste.lignes.length + ' acte' + (liste.lignes.length > 1 ? 's' : '');
    }
    zone.addEventListener('input', function () { liste = lireListe(zone.value); montrerListe(); });
    voile.querySelector('#gf-serie-fichier').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      f.text().then(function (t) { zone.value = t; liste = lireListe(t); montrerListe(); });
    });
    var br = voile.querySelector('[data-recu]');
    if (br) br.addEventListener('click', function () {
      liste = { colonnes: (recu.colonnes || []).map(function (c) { return typeof c === 'string' ? { titre: c, cle: cleSerie(c) } : c; }), lignes: recu.lignes };
      if (!liste.colonnes.length && liste.lignes.length) liste.colonnes = Object.keys(liste.lignes[0]).map(function (k) { return { titre: k, cle: cleSerie(k) }; });
      liste.lignes = liste.lignes.map(function (l) { var o = {}; Object.keys(l).forEach(function (k) { o[cleSerie(k)] = String(l[k] == null ? '' : l[k]); }); return o; });
      zone.value = ''; montrerListe();
    });
    voile.querySelectorAll('[data-x]').forEach(function (b) { b.addEventListener('click', fermer); });
    voile.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fermer(); } });
    creer.addEventListener('click', function () {
      if (!liste.lignes.length) return;
      creer.disabled = true; creer.textContent = 'Création…';
      var apres = voile.querySelector('[data-apres]').value;
      var gabaritNom = nomIn.value.trim() || ('{{col.' + liste.colonnes[0].cle + '}}');
      var nomDos = voile.querySelector('[data-dossier-serie]').value.trim();
      var pris = [], ids = [], p = nomDos ? creerDossier(nomDos) : Promise.resolve(null), idDos = null;
      p = p.then(function (d) { idDos = d ? d.id : null; if (d) return poserDossier(d); });
      liste.lignes.forEach(function (l, i) {
        var d = JSON.parse(JSON.stringify(donnees));
        d.serie = l;
        delete d.numero;
        var numero = prochainNumero(modeleActif.cle, pris);
        if (numero) { d.numero = numero; pris.push(parseInt(numero.split('/')[0], 10)); }
        d.nomActe = gabaritNom.replace(/\{\{col\.([A-Za-z0-9_\-]+)\}\}/g, function (m, k) { return l[k] == null ? '' : l[k]; }).trim() || (modeleActif.nom + ' ' + (i + 1));
        var fiche = {
          id: identifiant(), modele: modeleActif.cle, nom: modeleActif.nom, numero: d.numero || '',
          intitule: sansMarques(d.nomActe || d.titre || modeleActif.nom), date: d.dateActe || isoDuJour(), maj: Date.now() + i,
          etat: 'brouillon', version: 1, versions: [], journal: [{ t: Date.now(), quoi: 'Créé en série (' + (i + 1) + '/' + liste.lignes.length + ')' }],
          emisLe: null, motif: '', donnees: d
        };
        p = p.then(function () { fiche.dossier = idDos; });
        ids.push(fiche.id);
        p = p.then(function () { return dbPoser(MAG_ACTES, fiche); }).then(function () { registre.unshift(fiche); });
      });
      p.then(function () {
        fermer();
        /* le modele, s'il n'est pas encore au registre, portait un numero
           que la serie vient de prendre : il passe au suivant */
        if (modeleActif.prefixe && donnees.numero && pris.indexOf(parseInt(String(donnees.numero).split('/')[0], 10)) !== -1) {
          donnees.numero = prochainNumero(modeleActif.cle, pris); salir(); peindreFormulaire(); rafraichir(); majTitreBarre();
        }
        try { localStorage.removeItem('bbc-greffe-serie'); } catch (e) {}
        dire(ids.length + ' acte' + (ids.length > 1 ? 's' : '') + ' créé' + (ids.length > 1 ? 's' : '') + ' en série', 'ok');
        if (apres === 'imprimer') imprimerSerie(ids);
        else if (apres === 'registre') { if (idDos) registreDossier = idDos; montrer('registre'); }
      }).catch(function (e) { creer.disabled = false; creer.textContent = 'Créer les actes'; dire('La série a buté : ' + (e && e.message ? e.message : e), 'erreur'); });
    });
    zone.focus();
  }

  /* Tous les actes d'une série (ou d'une sélection) dans un seul PDF :
     chacun est rendu et mis en pages dans un cadre à part, les pages
     s'enchaînent, puis Chrome imprime. */
  function imprimerSerie(ids) {
    var fiches = ids.map(function (id) { return registre.filter(function (a) { return a.id === id; })[0]; }).filter(Boolean);
    if (!fiches.length) return;
    var sauve = { modeleActif: modeleActif, donnees: donnees, acteEtat: acteEtat, acteVersion: acteVersion };
    var f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + Math.ceil(LARGEUR_CADRE * MM) + 'px;height:1200px;border:0;';
    document.body.appendChild(f);
    var doc = f.contentDocument;
    doc.open();
    doc.write('<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>' + ech('Série · ' + fiches.length + ' actes') + '</title>'
      + '<style>' + cssPolices() + '</style><style>' + cssDocument() + '</style></head><body class="pagine"></body></html>');
    doc.close();
    var pages = [];
    try {
      fiches.forEach(function (fi) {
        modeleActif = G.modeles[fi.modele]; donnees = fi.donnees; acteEtat = fi.etat || 'brouillon'; acteVersion = fi.version || 1;
        doc.body.innerHTML = corpsDocument();
        G.blocs.paginer(doc);
        poserObjets(doc);
        Array.prototype.forEach.call(doc.querySelectorAll('.objet-sensible-ecran, .objet-poignee, .objet-rotation'), function (n) { n.remove(); });
        pages.push(doc.body.innerHTML);
      });
    } catch (e) { dire('La série n\'a pas pu être mise en pages : ' + (e && e.message ? e.message : e), 'erreur'); }
    modeleActif = sauve.modeleActif; donnees = sauve.donnees; acteEtat = sauve.acteEtat; acteVersion = sauve.acteVersion;
    doc.body.innerHTML = pages.join('');
    var lancer = function () {
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { dire('Impression impossible : ' + (e && e.message ? e.message : e), 'erreur'); }
      setTimeout(function () { if (f.parentNode) f.remove(); }, 60000);
    };
    if (doc.fonts && doc.fonts.status === 'loading') doc.fonts.ready.then(lancer); else setTimeout(lancer, 300);
  }

  /* =================================================================
     11. MONTAGE
     ================================================================= */
  function brancher() {
    elt = {
      etat: $('gf-etat'), sousTitre: $('gf-sous-titre'),
      ecranAcc: $('gf-ecran-accueil'), accueil: $('gf-accueil'),
      ecranReg: $('gf-ecran-registre'), registre: $('gf-registre'),
      ecranPol: $('gf-ecran-polices'), ecranAtl: $('gf-ecran-atelier'),
      formTete: $('gf-form-tete'),
      polListe: $('gf-pol-liste'), polSuite: $('gf-pol-suite'), polOublier: $('gf-pol-oublier'),
      depot: $('gf-depot'), depotInput: $('gf-depot-input'),
      formDefile: $('gf-form-defile'),
      scene: $('gf-scene'), feuille: $('gf-feuille'), pages: $('gf-pages'),
      zoomVal: $('gf-zoom-val'),
      voile: $('gf-voile-coller'), collerTexte: $('gf-coller-texte'),
      collerBilan: $('gf-coller-bilan'), collerOk: $('gf-coller-ok')
    };
    cadre = $('gf-cadre');

    $('gf-close').addEventListener('click', fermer);
    racine.querySelectorAll('.gf-nav-btn').forEach(function (b) {
      b.addEventListener('click', function () { montrer(b.getAttribute('data-espace')); });
    });
    /* un clic hors des menus les referme */
    racine.addEventListener('mousedown', function (e) {
      if (menuOuvert != null && !e.target.closest('.gf-menu-liste') && !e.target.closest('.gf-menu-btn')) fermerMenus();
    });

    elt.depot.addEventListener('click', function () { elt.depotInput.click(); });
    elt.depot.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elt.depotInput.click(); }
    });
    elt.depotInput.addEventListener('change', function () {
      accepterFichiers(elt.depotInput.files); elt.depotInput.value = '';
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      elt.depot.addEventListener(ev, function (e) { e.preventDefault(); elt.depot.classList.add('is-survol'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      elt.depot.addEventListener(ev, function (e) { e.preventDefault(); elt.depot.classList.remove('is-survol'); });
    });
    elt.depot.addEventListener('drop', function (e) {
      accepterFichiers(e.dataTransfer && e.dataTransfer.files);
    });
    elt.polOublier.addEventListener('click', function () {
      dbVider(MAG_RES).then(function () { res = {}; peindreListeRessources(); dire('Ressources retirées', 'ok'); });
    });
    elt.polSuite.addEventListener('click', function () {
      montrer(modeleActif ? 'atelier' : 'accueil');
    });

    $('gf-zoom-moins').addEventListener('click', function () { zoomer(zoom - 0.1); });
    $('gf-zoom-plus').addEventListener('click', function () { zoomer(zoom + 0.1); });
    $('gf-zoom-choix').addEventListener('change', function () { if (this.value) zoomer(this.value); });
    $('gf-page-prec').addEventListener('click', function () { allerPage(pageVisible() - 1); });
    $('gf-page-suiv').addEventListener('click', function () { allerPage(pageVisible() + 1); });
    /* Ctrl + molette : le zoom, pas celui du navigateur */
    elt.scene.addEventListener('wheel', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault(); zoomer(zoom + (e.deltaY < 0 ? 0.1 : -0.1));
    }, { passive: false });
    elt.scene.addEventListener('scroll', function () { clearTimeout(majPointeurPage._t); majPointeurPage._t = setTimeout(majPointeurPage, 60); });
    $('gf-annuler').addEventListener('click', annuler);
    $('gf-retablir').addEventListener('click', retablir);

    racine.querySelectorAll('[data-fermer-modale]').forEach(function (b) {
      b.addEventListener('click', fermerColler);
    });
    elt.collerTexte.addEventListener('input', function () {
      var n = analyser(elt.collerTexte.value, collerSource).length;
      elt.collerOk.disabled = !n;
      elt.collerBilan.textContent = n
        ? n + ' ligne' + (n > 1 ? 's' : '') + ' reconnue' + (n > 1 ? 's' : '') + '.'
        : (elt.collerTexte.value.trim() ? "Rien de reconnaissable pour l'instant." : '');
      elt.collerBilan.className = 'gf-modale-bilan' + (n ? ' is-ok' : '');
    });
    elt.collerOk.addEventListener('click', function () {
      var l = analyser(elt.collerTexte.value, collerSource);
      if (!l.length) return;
      table(collerSource).lignes = l;
      fermerColler(); salir(); peindreTable(collerSource); majArticlesSiAuto(); planifier();
      dire(l.length + ' lignes reprises', 'ok');
    });

    /* sur le document entier : un clic sur une zone sans focus laisse le
       focus au corps de la page, et la racine n'entendrait plus rien */
    document.addEventListener('keydown', function (e) { if (ouvert) raccourci(e); });
  }

  /* Les raccourcis, les memes dans l'admin et dans la feuille. */
  function raccourci(e) {
    if (espace === 'atelier' && objetSel && surToucheObjet(e)) return;
    var ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (e.key === 'Escape') {
      if (menuOuvert != null) { fermerMenus(); return; }
      if (elt.voile && !elt.voile.hidden) { fermerColler(); return; }
      if (racine.querySelector('.gf-voile:not([hidden])')) return;   /* la boite ouverte s'en charge */
      if (espace === 'atelier' && document.activeElement && document.activeElement !== document.body) { document.activeElement.blur(); return; }
      /* un acte ouvert : Échap lâche la main et la sélection, il ne ferme pas le Greffe */
      if (modeleActif) { if (outilMain) mainActiver(false); if (objetSel) selectionnerObjet(null); return; }
      fermer(); return;
    }
    if (ctrl && k === 'k') { e.preventDefault(); palette(); return; }
    if (e.key === 'F2' && modeleActif && espace === 'atelier') { e.preventDefault(); renommerActe(); return; }
    /* AltGr (Ctrl+Alt sur un clavier français : @, €, ~…) n'est jamais un raccourci */
    if (ctrl && e.altKey) return;
    /* Chrome garde Ctrl+N, Ctrl+Maj+N, Ctrl+T, Ctrl+W et Ctrl+1..9 pour ses propres
       onglets et fenêtres, une page ne les reçoit pas : ici c'est Alt. */
    if (e.altKey && !ctrl && /^[1-9]$/.test(e.key) && onglets[+e.key - 1]) { e.preventDefault(); activerOnglet(onglets[+e.key - 1].id); return; }
    if (e.altKey && !ctrl && k === 'w' && modeleActif) { e.preventDefault(); fermerActe(); return; }
    if (e.altKey && !ctrl && k === 'n') { e.preventDefault(); if (e.shiftKey) nouvelleFenetre(); else ouvrirNouveau(); return; }
    if (!ctrl) return;
    var enAtelier = !!modeleActif && espace === 'atelier';
    if (enAtelier && k === 'a' && !e.shiftKey) { var dA = cadre && cadrePret ? cadre.contentDocument : null; if (!(dA && dA.activeElement && dA.activeElement.closest && dA.activeElement.closest('[data-edit]')) && !(document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) || (document.activeElement && document.activeElement.isContentEditable))) { e.preventDefault(); selectionnerTout(); return; } }
    if (enAtelier && k === 'c' && copierElement()) { e.preventDefault(); return; }
    if (enAtelier && k === 'v' && collerElement()) { e.preventDefault(); return; }
    if (k === 'n' && e.shiftKey) { e.preventDefault(); nouvelleFenetre(); }
    else if (k === 'n') { e.preventDefault(); ouvrirNouveau(); }
    else if (k === 'o') { e.preventDefault(); montrer('registre'); }
    else if (k === 's' && e.shiftKey) { e.preventDefault(); sauvegarderGreffe(); }
    else if (k === 's') { e.preventDefault(); if (enAtelier) enregistrer(false); }
    else if (k === 'p' && e.shiftKey) { e.preventDefault(); if (enAtelier) basculerPanneau(); }
    else if (k === 'p') { e.preventDefault(); if (enAtelier) imprimer(); }
    else if (k === 'z' && !e.shiftKey) { e.preventDefault(); if (enAtelier) annuler(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); if (enAtelier) retablir(); }
    else if (k === 'e' && e.shiftKey) { e.preventDefault(); if (enAtelier) emettreActe(); }
    else if (k === 'r' && e.shiftKey) { e.preventDefault(); if (enAtelier) basculerLecture(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (enAtelier) { if (panneau === 'controle' && controle && !controle.erreurs) emettreActe(); else verifier(); } }
    else if (k === '+' || k === '=') { e.preventDefault(); if (enAtelier) { zoom = Math.min(1.5, zoom + 0.1); appliquerZoom(); } }
    else if (k === '-') { e.preventDefault(); if (enAtelier) { zoom = Math.max(0.25, zoom - 0.1); appliquerZoom(); } }
    else if (k === '0') { e.preventDefault(); if (enAtelier) { zoom = 1; appliquerZoom(); } }
  }

  function montrer(quoi, filtre) {
    if (quoi === 'polices') quoi = 'parametres';
    if (quoi === 'atelier' && !modeleActif) quoi = 'accueil';
    espace = quoi;
    fermerMenus();
    elt.ecranAcc.hidden = (quoi !== 'accueil');
    elt.ecranReg.hidden = (quoi !== 'registre');
    elt.ecranPol.hidden = (quoi !== 'parametres');
    elt.ecranAtl.hidden = (quoi !== 'atelier');
    racine.classList.toggle('gf-en-atelier', quoi === 'atelier');
    racine.querySelectorAll('.gf-nav-btn').forEach(function (b) { b.classList.toggle('is-actif', b.getAttribute('data-espace') === quoi); });
    var menus = $('gf-menus');
    if (menus) { menus.hidden = (quoi !== 'atelier'); if (quoi === 'atelier') peindreMenus(); }

    if (quoi === 'accueil') {
      peindreAccueil();
    } else if (quoi === 'registre') {
      if (filtre) registreFiltre = filtre;
      peindreRegistre();
      var r = $('gf-reg-recherche'); if (r) r.focus();
    } else if (quoi === 'parametres') {
      peindreParametres();
    } else {
      cadrePret = false;
      peindreFormulaire();
      if (!zoomChoisi && elt.scene.clientWidth > 0) { zoom = zoomLargeur(); }
      rafraichir();
    }
    majTitreBarre();
    peindreOnglets();
  }
  var zoomChoisi = false;

  /* Le blason est public : il est déjà sur le site. On le lit une fois
     et on le garde en base64, pour que le fichier source exporté
     s'ouvre aussi sur un poste qui n'a pas le site sous la main. */
  function chargerBlason() {
    if (res.blason) return Promise.resolve();
    return fetch('/media/img/BBC_-_COLORED_LOGO_jjcrux.webp', { cache: 'force-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(function (b) { return lireFichier(b); })
      .then(function (uri) { res.blason = uri; res.blasonEchec = false; })
      .catch(function (e) {
        /* L'acte sort quand même, mais SANS logo. Le dire : sinon un
           courrier part sans blason et personne ne s'en aperçoit avant
           le destinataire. Le fronton, lui, retire son disque plutôt
           que d'imprimer un rond vide. */
        res.blasonEchec = true;
        if (window.console) console.warn('[Greffe] blason introuvable (' + e
          + ') : les actes sortiront sans logo.');
      });
  }

  function charger(src, test) {
    return new Promise(function (ok, ko) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { test() ? ok() : ko(new Error(src + ' muet')); };
      s.onerror = function () { ko(new Error(src + ' introuvable')); };
      document.head.appendChild(s);
    });
  }

  function chargerMoteur() {
    var p = G.blocs ? Promise.resolve()
      : charger('/greffe/blocs.js', function () { return !!G.blocs; });
    function modele(m) { return G.modeles[m] ? Promise.resolve() : charger('/greffe/modeles/' + m + '.js', function () { return !!G.modeles[m]; }); }
    return p.then(function () {
      /* l'acte libre d'abord : la page blanche se construit sur lui */
      return modele('acte-libre');
    }).then(function () {
      return Promise.all(MODELES.filter(function (m) { return m !== 'acte-libre'; }).map(modele));
    }).then(function () {
      /* les préréglages livrés avec le Greffe, après les modèles qu'ils citent */
      return G.prereglages ? null : charger('/greffe/prereglages.js', function () { return !!G.prereglages; });
    });
  }

  G.mount = function (root, contexte) {
    /* la barre d'outils et le panneau de propriétés, une fois pour toutes */
    setTimeout(brancherOutils, 0);
    /* Le Greffe est réservé au propriétaire du site : l'admin le dit au
       montage, après avoir comparé la session à bbc_proprietaire_email().
       Sans ce mot, rien ne se monte, même si un bouton a fui. */
    if (!contexte || (contexte.proprietaire !== true && !DROITS[contexte.role]))
      return Promise.reject(new Error('Le Greffe n’est pas ouvert à cette casquette'));
    racine = root; api = contexte || {};
    droits = contexte.proprietaire === true ? DROITS_TOUT : DROITS[contexte.role];
    brancher();
    /* le registre en base d'abord : ce poste recoit ce qu'il n'a pas,
       et seulement ensuite on lit le poste */
    return chargerMoteur().then(synchroniser).then(function () {
      return Promise.all([dbTout(MAG_RES), dbTout(MAG_ACTES), chargerBlason(), dbTout(MAG_PRE), dbTout(MAG_REG), dbTout(MAG_DOS)]);
    }).then(function (r) {
      dossiers = (r[5] || []).sort(function (a, b) { return (b.maj || 0) - (a.maj || 0); });
      var regSauve = (r[4] || []).filter(function (x) { return x.cle === 'sauvegarde'; })[0];
      derniereSauvegarde = regSauve && regSauve.valeur ? +regSauve.valeur : 0;
      ecouterCanal();
      /* le navigateur peut vider IndexedDB sous pression : on demande qu'il ne le fasse pas */
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then(function (ok) { stockagePersistant = ok; }); } catch (e) {}
      (r[0] || []).forEach(function (o) { res[o.cle] = o.uri; });
      var regClub = (r[4] || []).filter(function (x) { return x.cle === 'club'; })[0];
      G.club = Object.assign({}, CLUB_DEFAUT, regClub && regClub.valeur ? regClub.valeur : {});
      registre = (r[1] || []).sort(function (a, b) { return b.maj - a.maj; });
      prereglages = (r[3] || []).sort(function (a, b) { return b.maj - a.maj; });
      var demande = api && api.acte ? String(api.acte) : null;
      var rep = demande ? { acte: demande } : lireReprise();
      var fiche = rep && rep.acte !== 'accueil' ? registre.filter(function (a) { return a.id === rep.acte; })[0] : null;
      if (fiche && ressourcesCompletes()) { ouvrirActe(fiche); dire('Reprise : ' + (fiche.intitule || fiche.nom) + (fiche.numero ? ' n° ' + fiche.numero : ''), 'ok'); }
      else montrer(ressourcesCompletes() ? 'accueil' : 'polices');
      if (baseDispo() && baseEtat.hors) dire('Registre en base injoignable : les actes restent sur ce poste pour l\'instant', 'erreur');
      /* l'onglet qui se ferme ou se rafraîchit : l'acte part au registre avant */
      window.addEventListener('pagehide', function () { if (modeleActif && !acteSauve && acteEtat === 'brouillon') enregistrer(true); });
    }).catch(function (e) {
      dire('Démarrage impossible : ' + (e && e.message ? e.message : e), 'erreur');
      throw e;
    });
  };

  G.open = function () {
    if (!racine) return;
    ouvert = true;
    racine.classList.add('is-open');
    racine.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    /* le zoom « largeur » calcule pendant que le Greffe etait cache valait
       25 % (scene sans largeur) : on le refait ici, la scene visible */
    if (!zoomChoisi && modeleActif && elt.scene.clientWidth > 0) zoom = zoomLargeur();
    if (!elt.ecranAtl.hidden) rafraichir();
  };
  window.addEventListener('resize', function () {
    if (!ouvert || zoomChoisi || !modeleActif || elt.ecranAtl.hidden || elt.scene.clientWidth <= 0) return;
    zoom = zoomLargeur(); appliquerZoom();
  });

  function fermer() {
    if (!racine) return;
    avantDeQuitter(function () {
      oublierReprise();
      ouvert = false;
      racine.classList.remove('is-open');
      racine.setAttribute('aria-hidden', 'true');
      document.documentElement.style.overflow = '';
      if (api && typeof api.onClose === 'function') { try { api.onClose(); } catch (e) {} }
    });
  }
  /* l'onglet qu'on ferme : le navigateur pose sa propre question */
  window.addEventListener('beforeunload', function (e) {
    if (ouvert && changementsNonValides()) { e.preventDefault(); e.returnValue = ''; }
  });
  G.close = fermer;
  G.isOpen = function () { return ouvert; };
  /* UN ACTE PRE-REMPLI DEPUIS L'ADMINISTRATION. Une convocation depuis
     « Le match » arrive avec ses convoquées, un reçu depuis « L'école »
     avec le montant et la famille : les données viennent de la base, pas
     du clavier. `apport` porte les clés du modèle ; `apport.tables.<nom>`
     ne porte que des lignes, les colonnes restent celles du modèle. */
  G.nouvelActe = function (cle, apport, options) {
    if (!racine || !G.modeles[cle]) return false;
    var tables = apport && apport.tables, reste = {};
    Object.keys(apport || {}).forEach(function (k) { if (k !== 'tables') reste[k] = apport[k]; });
    var pre = { nom: (options && options.origine) || "l'administration", donnees: reste };
    if (options && options.dossier) pre.dossier = options.dossier;
    /* ouvert d'abord : la question « acte non enregistré ? » se pose
       dans le Greffe, et un Greffe fermé la poserait dans le vide */
    if (!ouvert) G.open();
    avantDeQuitter(function () {
      nouvelActe(cle, pre);
      if (tables) Object.keys(tables).forEach(function (t) {
        if (!donnees.tables[t]) return;
        var l = Array.isArray(tables[t]) ? tables[t] : (tables[t].lignes || []);
        donnees.tables[t].lignes = JSON.parse(JSON.stringify(l));
      });
      acteTouche = true;
      peindreFormulaire(); rafraichir(); majTitreBarre();
    });
    return true;
  };
  /* pour le banc d'essai : ce que la boîte « acte non enregistré » compare */
  G.diagnostic = function () { var f = modeleActif ? ficheCourante() : null; if (f) delete f.maj; var r = acteReference ? JSON.parse(acteReference) : null; if (r) delete r.maj; return { courante: f ? JSON.stringify(f) : null, reference: r ? JSON.stringify(r) : null, change: changementsNonValides(), derniereSauvegarde: derniereSauvegarde, stockagePersistant: stockagePersistant }; };

})();
