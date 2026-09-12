/* =====================================================================
   LE GREFFE : noyau
   ---------------------------------------------------------------------
   Fabrique les actes officiels du club. Le PDF sort par l'impression de
   Chrome, le fichier source par un téléchargement. Rien ne part sur un
   serveur : pas de fonction, pas d'API, pas un franc.

   QUATRE COUCHES, ET CHACUNE IGNORE LA SUIVANTE :
     greffe.js          le noyau  : écrans, formulaire, aperçu, registre
     blocs.js           les blocs : en-tête, articles, tableaux, signature
     modeles/*.js       les actes : une DÉCLARATION, jamais du HTML
     IndexedDB          le poste  : polices, cachet, actes enregistrés

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

  /* AJOUTER UN TYPE D'ACTE : un fichier dans modeles/, son nom ici. */
  var MODELES = ['ordre-mission', 'acte-libre', 'courrier',
                 'convention', 'contrat', 'fiche-fonction', 'budget'];

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
    var p = String(nom || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '';
    if (p.length === 1) return p[0];
    return p[0].charAt(0).toUpperCase() + '. ' + p[p.length - 1];
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
  var TEINTES = /^(or|vert|rouge|gris|grand|petit|maj)$/;
  function gras(t) {
    return t
      .replace(/\{\{(or|vert|rouge|gris|grand|petit|maj)\|([^}]+)\}\}/g, '<span class="s-$1">$2</span>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
      .replace(/__([^_\n]+)__/g, '<u>$1</u>')
      .replace(/==([^=\n]+)==/g, '<mark>$1</mark>')
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<i>$2</i>');
  }

  function paragraphes(texte) {
    var out = [], genre = null, run = [];
    function vider() {
      if (!run.length) return;
      if (genre === 'liste') out.push('<ul>' + run.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul>');
      else if (genre === 'note') out.push('<div class="note"><p>' + run.join(' ') + '</p></div>');
      else out.push('<p>' + run.join(' ') + '</p>');
      run = []; genre = null;
    }
    String(texte || '').split(/\r?\n/).forEach(function (ligne) {
      var l = ligne.trim();
      if (!l) { vider(); return; }
      var m = /^([-•*]|>)\s+(.*)$/.exec(l);
      var g = m ? (m[1] === '>' ? 'note' : 'liste') : 'para';
      var brut = m ? m[2] : ligne.replace(/^\s+/, '');
      if (/ $/.test(ligne) && !/ $/.test(brut)) brut += ' ';
      var contenu = gras(ech(brut));
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
      paragraphes: paragraphes, fait: fait, normaliser: normaliser
    }
  };
  window.BaobabsGreffe = G;

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

  var DB_NOM = 'bbc-greffe', DB_VER = 3, MAG_RES = 'ressources', MAG_ACTES = 'actes', MAG_PRE = 'prereglages';

  function dbOuvrir() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB_NOM, DB_VER);
      r.onupgradeneeded = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains(MAG_RES)) db.createObjectStore(MAG_RES, { keyPath: 'cle' });
        if (!db.objectStoreNames.contains(MAG_ACTES)) db.createObjectStore(MAG_ACTES, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(MAG_PRE)) db.createObjectStore(MAG_PRE, { keyPath: 'id' });
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

  function dbPoser(magasin, obj) {
    return dbOuvrir().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(magasin, 'readwrite');
        tx.objectStore(magasin).put(obj);
        tx.oncomplete = function () { res(); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }

  function dbOter(magasin, cle) {
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
  function alleger(uri, cote) {
    return new Promise(function (res) {
      var img = new Image();
      img.onload = function () {
        try {
          if (Math.max(img.width, img.height) <= cote) return res(uri);
          var c = document.createElement('canvas');
          var k = cote / Math.max(img.width, img.height);
          c.width = Math.round(img.width * k);
          c.height = Math.round(img.height * k);
          var x = c.getContext('2d');
          x.imageSmoothingEnabled = true;
          x.imageSmoothingQuality = 'high';
          x.drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/png'));
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
  /* le cycle de vie : etat, version, versions emises, journal */
  var acteEtat = 'brouillon', acteVersion = 1, acteVersions = [], acteJournal = [], acteEmisLe = null, acteMotif = '';
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

  function salir() { acteSauve = false; majTitreBarre(); histoNoter(); autoEnregistrer(); }

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
      intitule: donnees.titre || modeleActif.nom,
      date: donnees.dateActe || isoDuJour(),
      maj: Date.now(),
      etat: acteEtat, version: acteVersion, versions: acteVersions,
      journal: acteJournal, emisLe: acteEmisLe, motif: acteMotif,
      donnees: JSON.parse(JSON.stringify(donnees))
    };
  }

  function enregistrer(silencieux) {
    if (!modeleActif) return Promise.resolve();
    if (!acteId) { acteId = identifiant(); if (!acteJournal.length) journaliser('Créé'); }
    var fiche = ficheCourante();
    return dbPoser(MAG_ACTES, fiche).then(function () {
      acteSauve = true; majTitreBarre();
      registre = registre.filter(function (a) { return a.id !== fiche.id; });
      registre.unshift(fiche);
      noterReprise();
      if (!silencieux) dire('Enregistré', 'ok');
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
    controle = null; panneau = 'donnees'; modeLecture = false; objetSel = null; blocSel = null;
  }

  function ouvrirActe(fiche, version) {
    var m = G.modeles[fiche.modele];
    if (!m) { dire("Modèle « " + fiche.modele + " » introuvable.", 'erreur'); return; }
    modeleActif = m;
    chargerFiche(fiche);
    /* une ancienne version se relit telle qu'elle a été émise */
    var v = version ? (acteVersions.filter(function (x) { return x.v === version; })[0]) : null;
    donnees = JSON.parse(JSON.stringify(v ? v.donnees : fiche.donnees));
    if (v) { acteEtat = v.etat === 'emise' ? 'emis' : 'remplace'; acteVersion = v.v; modeLecture = true; }
    acteId = fiche.id; acteSauve = true;
    montrer('atelier');
    histoDepart();
    noterReprise();
  }

  function nouvelActe(cle, prereglage) {
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
    /* le numéro suit le registre : premier libre de l'année en cours,
       tous états confondus : un numéro annulé reste pris */
    if (m.prefixe) {
      var an = String(new Date().getFullYear()).slice(2);
      var pris = registre.filter(function (a) { return a.modele === cle && String(a.numero || '').slice(-2) === an; })
        .map(function (a) { return parseInt(String(a.numero).split('/')[0], 10) || 0; });
      var n = 1; while (pris.indexOf(n) !== -1) n++;
      donnees.numero = deuxChiffres(n) + '/' + an;
    }
    acteId = null; acteSauve = false;
    acteEtat = 'brouillon'; acteVersion = 1; acteVersions = []; acteJournal = []; acteEmisLe = null; acteMotif = '';
    controle = null; panneau = 'donnees'; modeLecture = false; objetSel = null; blocSel = null;
    journaliser('Créé' + (prereglage ? ' depuis le préréglage « ' + prereglage.nom + ' »' : ''));
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
    }
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
        acteEtat = 'emis'; acteEmisLe = maintenant; controle = null; panneau = 'donnees';
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
      acteVersion++; acteEtat = 'brouillon'; acteEmisLe = null; controle = null; panneau = 'donnees'; modeLecture = false;
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
      + '<h4 class="gf-modale-h4">Journal</h4><div class="gf-journal">' + journal + '</div>',
      [{ lab: 'Fermer', accent: false }]).then(function () {});
    Array.prototype.forEach.call(racine.querySelectorAll('.gf-voile [data-version]'), function (b) {
      b.addEventListener('click', function () {
        var v = +b.getAttribute('data-version');
        racine.querySelector('.gf-voile').remove();
        ouvrirActe(f, v);
      });
    });
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
      + '<span class="gf-al-txt"><b>' + ech(a.intitule || a.nom) + '</b><span>' + ech(a.nom) + ' · ' + ech(dateLongue(a.date, false) || '') + '</span></span>'
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
              image: '<div class="gm-img"></div>', espace: '<div class="gm-esp"></div>', saut: '<div class="gm-sep"></div>', annexe: '<div class="gm-sep"></div>' };
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

  /* ---- l'accueil : que voulez-vous faire ? ---- */
  function peindreAccueil() {
    var hote = elt.accueil;
    if (!hote) return;
    var brouillons = registre.filter(function (a) { return (a.etat || 'brouillon') === 'brouillon'; });
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
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Nouvel acte <kbd>Ctrl+N</kbd></button>'
      + (brouillons.length ? '<button type="button" class="gf-btn gf-btn-fant gf-btn-grand" id="gf-acc-brouillon">Reprendre un brouillon <span class="gf-compte">' + brouillons.length + '</span></button>' : '')
      + '</div></div>'
      + (recents.length
          ? '<div class="gf-acc-carte"><h2 class="gf-acc-titre gf-acc-titre-sm">Récents</h2><div class="gf-actes-liste">' + recents.map(ligneActe).join('') + '</div>'
            + '<button type="button" class="gf-lien" id="gf-acc-registre">Ouvrir le registre · ' + registre.length + ' acte' + (registre.length > 1 ? 's' : '')
            + (brouillons.length ? ' · ' + brouillons.length + ' brouillon' + (brouillons.length > 1 ? 's' : '') : '')
            + (emis.length ? ' · ' + emis.length + ' émis' : '') + '</button></div>'
          : '')
      + '<div class="gf-acc-carte"><h2 class="gf-acc-titre gf-acc-titre-sm">Préréglages</h2>'
      + '<p class="gf-acc-intro">Un acte déjà composé : ouvrez-le, il ne reste qu\'à écrire.</p>'
      + '<div class="gf-cartes gf-cartes-mini">' + pres.map(function (p, i) {
          return '<button type="button" class="gf-carte gf-carte-mini" data-pre="' + i + '">' + apercuPrereglage(p) + '<b>' + ech(p.nom) + '</b></button>';
        }).join('') + '</div><button type="button" class="gf-lien" id="gf-acc-tous-pre">Tous les préréglages…</button></div>'
      + '<p class="gf-acc-pied"><button type="button" class="gf-lien" data-espace="parametres">Paramètres</button> · '
      + '<button type="button" class="gf-lien" id="gf-acc-sauver">Sauvegarder le Greffe</button></p>';

    $('gf-acc-nouveau').addEventListener('click', function () { ouvrirNouveau(); });
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
      if (!m) return;
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
      + '<div class="gf-onglets"><button type="button" class="gf-onglet is-actif" data-onglet="modeles">Modèles</button>'
      + '<button type="button" class="gf-onglet" data-onglet="prereglages">Préréglages</button></div>'
      + '<button type="button" class="gf-ico gf-ico-close" data-x aria-label="Fermer">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></header>'
      + '<div class="gf-modale-corps"><div data-page="modeles">' + htmlModeles + '</div>'
      + '<div data-page="prereglages" hidden><p class="gf-modale-aide">Depuis l\'atelier, « Préréglage » garde l\'acte en cours sous cette forme ; un fichier .json le fait voyager d\'un poste à l\'autre.</p>' + htmlPre + '</div></div>'
      + '</div>';
    racine.appendChild(voile);
    function fermer() { if (voile.parentNode) voile.remove(); }
    voile.querySelector('[data-x]').addEventListener('click', fermer);
    voile.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fermer(); } });
    voile.querySelectorAll('.gf-onglet').forEach(function (o) {
      o.addEventListener('click', function () {
        voile.querySelectorAll('.gf-onglet').forEach(function (x) { x.classList.toggle('is-actif', x === o); });
        voile.querySelectorAll('[data-page]').forEach(function (p) { p.hidden = p.getAttribute('data-page') !== o.getAttribute('data-onglet'); });
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
  var registreFiltre = 'tous', registreRecherche = '';
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
      if (!q) return true;
      /* la recherche va jusque dans la donnée : un nom de joueuse, une ville */
      var corps = normal(a.intitule) + ' ' + normal(a.nom) + ' ' + normal(a.numero) + ' ' + normal(a.date) + ' ' + normal(JSON.stringify(a.donnees || {}));
      return q.split(/\s+/).every(function (mot) { return corps.indexOf(mot) !== -1; });
    });
    var compte = {};
    registre.forEach(function (a) { var e = a.etat || 'brouillon'; compte[e] = (compte[e] || 0) + 1; });
    var filtres = [['tous', 'Tous'], ['brouillon', 'Brouillons'], ['emis', 'Émis'], ['remplace', 'Remplacés'], ['annule', 'Annulés'], ['archive', 'Archivés']];

    hote.innerHTML =
      '<div class="gf-acc-carte">'
      + '<div class="gf-reg-tete"><h2 class="gf-acc-titre">Le registre</h2>'
      + '<input class="gf-in gf-reg-recherche" id="gf-reg-recherche" type="search" placeholder="Rechercher : un numéro, un nom, une ville, un objet…" value="' + ech(registreRecherche) + '"></div>'
      + '<div class="gf-puces gf-reg-filtres">' + filtres.map(function (f) {
          var n = f[0] === 'tous' ? registre.filter(function (a) { return (a.etat || 'brouillon') !== 'archive'; }).length : (compte[f[0]] || 0);
          return '<button type="button" class="gf-puce' + (registreFiltre === f[0] ? ' is-actif' : '') + '" data-filtre="' + f[0] + '">' + f[1] + ' <span class="gf-compte">' + n + '</span></button>';
        }).join('') + '</div>'
      + (liste.length
          ? '<div class="gf-reg-table">' + liste.map(function (a) {
              var e = a.etat || 'brouillon';
              return '<div class="gf-reg-ligne">' + ligneActe(a)
                + '<div class="gf-reg-actions">'
                + '<button type="button" class="gf-mini" data-histo="' + ech(a.id) + '">Historique</button>'
                + '<button type="button" class="gf-mini" data-fenetre="' + ech(a.id) + '" title="Ouvrir cet acte dans une nouvelle fenêtre">Nouvelle fenêtre</button>'
                + (e === 'emis' ? '<button type="button" class="gf-mini" data-version="' + ech(a.id) + '">Nouvelle version</button>' : '')
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
    brancherLignesActes(hote);
    function fiche(id) { return registre.filter(function (a) { return a.id === id; })[0]; }
    function avecFiche(attr, fn) {
      hote.querySelectorAll('[' + attr + ']').forEach(function (b) {
        b.addEventListener('click', function () { var f = fiche(b.getAttribute(attr)); if (f) fn(f); });
      });
    }
    avecFiche('data-histo', function (f) { historiqueActe(f); });
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
  function peindreParametres() {
    peindreListeRessources();
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
        { lab: 'Nouvel acte…', rac: 'Ctrl+N', act: function () { ouvrirNouveau(); } },
        { lab: 'Ouvrir le registre', rac: 'Ctrl+O', act: function () { montrer('registre'); } },
        { lab: 'Ouvrir dans une nouvelle fenêtre', rac: 'Ctrl+Maj+N', act: function () { nouvelleFenetre(); } },
        { sep: true },
        { lab: 'Enregistrer', rac: 'Ctrl+S', off: !enAtelier, act: function () { enregistrer(false); } },
        { lab: 'Garder comme préréglage…', off: !enAtelier, act: garderPrereglage },
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
        { lab: 'Textes d\'origine du modèle', off: !enAtelier || lect, act: textesOrigine }
      ]},
      { nom: 'Acte', items: [
        { lab: 'Informations…', off: !enAtelier, act: informationsActe },
        { lab: 'Historique…', off: !enAtelier, act: function () { historiqueActe(); } },
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
        { lab: 'Flèche', off: !enAtelier || lect, act: function () { poserObjet('fleche'); } },
        { sep: true }
      ].concat(libre && !lect && modeleActif.catalogue
          ? modeleActif.catalogue.map(function (e) { return { lab: 'Bloc : ' + e.nom, act: function () { poserBloc(e); } }; })
          : [{ lab: 'Les blocs se posent dans un acte libre', off: true }]) },
      { nom: 'Affichage', items: [
        { lab: 'Zoom avant', rac: 'Ctrl+Plus', off: !enAtelier, act: function () { zoom = Math.min(1.5, zoom + 0.1); appliquerZoom(); } },
        { lab: 'Zoom arrière', rac: 'Ctrl+Moins', off: !enAtelier, act: function () { zoom = Math.max(0.25, zoom - 0.1); appliquerZoom(); } },
        { lab: 'Taille réelle', rac: 'Ctrl+0', off: !enAtelier, act: function () { zoomer(1); } },
        { lab: 'Ajuster à la largeur', off: !enAtelier, act: function () { zoomer('largeur'); } },
        { lab: 'Page entière', off: !enAtelier, act: function () { zoomer('page'); } },
        { sep: true },
        { lab: (racine.classList.contains('gf-sans-panneau') ? 'Montrer' : 'Masquer') + ' le panneau', rac: 'Ctrl+Maj+P', off: !enAtelier, act: basculerPanneau },
        { lab: (modeLecture ? 'Quitter le' : 'Passer en') + ' mode lecture', rac: 'Ctrl+Maj+R', off: !enAtelier, act: basculerLecture }
      ]},
      { nom: 'Aide', items: [
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
    var nom = (modeleActif.libre && String(donnees.titre || '').trim()) || modeleActif.nom;
    $('gf-ae-type').textContent = nom;
    $('gf-ae-num').textContent = donnees.numero ? donnees.numero : '';
    var badge = $('gf-ae-badge');
    var x = ETATS[acteEtat] || ETATS.brouillon;
    badge.className = 'gf-ae-badge gf-badge gf-badge-' + x.cls;
    badge.textContent = x.lab.toUpperCase() + (acteVersion > 1 || acteEtat !== 'brouillon' ? ' · V' + acteVersion : '')
      + (modeLecture && acteEtat === 'brouillon' ? ' · LECTURE' : '');
    if (elt.sousTitre) elt.sousTitre.textContent = nom + (donnees.numero ? ' n° ' + donnees.numero : '');
    majActions();
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
    if (!acteSauve && acteEtat === 'brouillon') enregistrer(true);
    oublierReprise();
    modeleActif = null; donnees = {}; acteId = null; acteSauve = true; controle = null; modeLecture = false;
    montrer('accueil');
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
      ['Document', [['Ctrl+N', 'Nouvel acte'], ['Ctrl+O', 'Ouvrir le registre'], ['Ctrl+Maj+N', 'Nouvelle fenêtre'], ['Ctrl+S', 'Enregistrer'], ['Ctrl+P', 'Imprimer en PDF'], ['Ctrl+Maj+S', 'Sauvegarder le Greffe']]],
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
      saisie = '<textarea class="gf-ta" id="' + id + '" data-cle="' + c.cle + '" rows="'
             + (c.lignes || 2) + '"></textarea>';
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
    if (panneau === 'bloc' && !lectureSeule()) {
      if (tete) { tete.hidden = false; tete.innerHTML = '<span class="gf-lab">Bloc sélectionné</span>'; }
      peindreBloc();
      return;
    }
    if (panneau === 'objet' && !lectureSeule()) {
      if (tete) { tete.hidden = false; tete.innerHTML = '<span class="gf-lab">Objet posé sur la page</span>'; }
      peindreObjet();
      return;
    }
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
    /* un bloc neuf se pose avant les signatures, si elles ferment l'acte */
    var k = donnees.blocs.length;
    if (k && donnees.blocs[k - 1].b === 'signatures' && x.b !== 'signatures' && x.b !== 'saut') k--;
    donnees.blocs.splice(k, 0, x);
    salir(); peindreFormulaire(); planifier();
    dire('Bloc « ' + e.nom + ' » posé', 'ok');
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
    'Date':                 { poids: 20, forme: 'code', align: 'centre' }
  };

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
        + '<input class="gf-in" data-ch="titre" value="' + ech(a.titre) + '" placeholder="Titre de l\'article">'
        + '<button type="button" class="gf-rang-sup" title="Retirer" aria-label="Retirer">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
        + '</button></div>'
        + '<textarea class="gf-ta" data-ch="texte" rows="4">' + ech(a.texte) + '</textarea>'
        + '</div>';
    }).join('');

    hote.innerHTML = barre + liste
      + '<p class="gf-aide">Une ligne vide sépare deux paragraphes. Entourez un passage de '
      + '<b>**deux étoiles**</b> pour le mettre en gras.</p>';

    function figer() {
      if (!donnees.articles) donnees.articles = articlesAuto().map(function (a) {
        return { titre: a.titre, texte: a.texte };
      });
    }

    hote.querySelectorAll('.gf-art').forEach(function (d) {
      var i = +d.getAttribute('data-i');
      d.querySelectorAll('[data-ch]').forEach(function (n) {
        n.addEventListener('input', function () {
          figer(); donnees.articles[i][n.getAttribute('data-ch')] = n.value; salir(); planifier();
        });
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
    return G.blocs.assembler(modeleActif, donnees, { res: res, brouillon: acteEtat === 'brouillon' });
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
    '  .objet{ cursor:move; }',
    '  .objet.is-sel{ outline:2px solid #46BF1D; outline-offset:2px; }',
    '  .objet-poignee{ position:absolute; right:-6px; bottom:-6px; width:12px; height:12px; border-radius:99px;',
    '    background:#46BF1D; border:2px solid #fff; cursor:nwse-resize; box-shadow:0 1px 4px rgba(0,0,0,.4); }',
    '  .objet-rotation{ position:absolute; left:50%; top:-22px; width:14px; height:14px; margin-left:-7px; border-radius:99px;',
    '    background:#fff; border:2px solid #46BF1D; cursor:grab; box-shadow:0 1px 4px rgba(0,0,0,.4); }',
    '  .objet-rotation::after{ content:""; position:absolute; left:50%; top:12px; width:2px; height:8px; margin-left:-1px; background:#46BF1D; }',
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
    } catch (e) { /* le cadre a pu être remplacé entre deux passes */ }
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
    doc.body.addEventListener('focusin', function (e) { majBarreBloc(cibleEdit(e)); });
    doc.body.addEventListener('contextmenu', surClicDroit);
    doc.body.addEventListener('mousedown', function (e) { sourisEnfoncee = true; cacher('slash'); cacher('menu'); surSourisObjet(e); });
    doc.addEventListener('mousemove', surSourisBouge);
    doc.addEventListener('mouseup', surSourisLache);
    /* hors d'un texte, les raccourcis valent aussi sur la feuille (Ctrl+V d'un objet, Ctrl+S, Ctrl+P...) */
    doc.addEventListener('keydown', function (e) { if (!surToucheObjet(e) && (e.ctrlKey || e.metaKey) && !cibleEdit(e)) raccourci(e); });
    doc.body.addEventListener('mouseup', function () { sourisEnfoncee = false; });
    doc.addEventListener('mouseleave', function () { sourisEnfoncee = false; });
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

  function surSaisie(e) {
    var el = cibleEdit(e);
    if (!el) return;
    var chemin = el.getAttribute('data-edit');
    var valeur = el.classList.contains('txt')
      ? depuisDom(el)
      : el.innerText.replace(/\n+$/, '').replace(/\n/g, ' ').replace(/\u00a0/g, ' ');
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
    if (e.ctrlKey || e.metaKey) { raccourci(e); return; }
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
    if (n && n.type !== 'checkbox') n.value = donnees[p[0]] == null ? '' : donnees[p[0]];
    majTitreBarre();
  }

  /* La feuille redevient du texte : un paragraphe par bloc, « - » devant
     chaque puce, « > » devant une note, **gras** autour du gras. C'est
     exactement la grammaire que paragraphes() lit. */
  function depuisDom(el) {
    function enLigne(n) {
      var s = '';
      Array.prototype.forEach.call(n.childNodes, function (c) {
        if (c.nodeType === 3) { s += c.nodeValue.replace(/\u00a0/g, ' '); return; }
        if (c.nodeType !== 1) return;
        if (c.tagName === 'BR') { s += '\n'; return; }
        var t = enLigne(c), tag = c.tagName;
        if (!t.trim()) { s += t; return; }
        var st = c.style || {};
        var fond = st.backgroundColor || (tag === 'MARK' ? 'mark' : '');
        var couleur = st.color || (tag === 'FONT' && c.getAttribute('color')) || '';
        var taille = st.fontSize || (tag === 'FONT' && c.getAttribute('size')) || '';
        var cls = c.className || '';
        /* dans l'ordre inverse du décor : couleur / taille autour, puis marque, souligné, italique, gras */
        if (tag === 'B' || tag === 'STRONG' || st.fontWeight === 'bold' || +st.fontWeight >= 600) t = '**' + t.trim() + '**';
        if (tag === 'I' || tag === 'EM' || st.fontStyle === 'italic') t = '*' + t.trim() + '*';
        if (tag === 'U' || /underline/.test(st.textDecoration || st.textDecorationLine || '')) t = '__' + t.trim() + '__';
        if (fond) t = '==' + t.trim() + '==';
        var teinte = (cls.match(/\bs-(or|vert|rouge|gris)\b/) || [])[1] || teinteDe(couleur);
        if (teinte) t = '{{' + teinte + '|' + t.trim() + '}}';
        var dim = (cls.match(/\bs-(grand|petit)\b/) || [])[1] || tailleDe(taille);
        if (dim) t = '{{' + dim + '|' + t.trim() + '}}';
        if (/\bs-maj\b/.test(cls)) t = '{{maj|' + t.trim() + '}}';
        s += t;
      });
      return s;
    }
    var out = [];
    Array.prototype.forEach.call(el.childNodes, function (n) {
      if (n.nodeType === 3) { if (n.nodeValue.trim()) out.push(n.nodeValue.trim()); return; }
      if (n.nodeType !== 1) return;
      if (n.tagName === 'UL' || n.tagName === 'OL') {
        out.push(Array.prototype.map.call(n.children, function (li) {
          return '- ' + enLigne(li).replace(/\s+/g, ' ').trim();
        }).join('\n'));
      } else if (n.classList.contains('note')) {
        out.push('> ' + enLigne(n).replace(/\s+/g, ' ').trim());
      } else {
        var t = enLigne(n).replace(/\n+$/, '');
        if (t.trim()) out.push(t);
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
    var n = parseFloat(t);
    if (/^\d+$/.test(String(t))) return n >= 4 ? 'grand' : (n <= 2 ? 'petit' : '');   /* <font size> */
    if (/em|%/.test(String(t))) return n > 1.1 ? 'grand' : (n < 0.95 ? 'petit' : '');
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
      return { chemin: el.getAttribute('data-edit'), rang: avant.toString().length };
    } catch (e) { return null; }
  }

  function caretRestaurer(doc, c) {
    var el = doc.querySelector('[data-edit="' + c.chemin + '"]');
    if (!el) return;
    el.focus();
    var walker = doc.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */, null);
    var n, reste = c.rang, dernier = null;
    while ((n = walker.nextNode())) {
      dernier = n;
      if (reste <= n.nodeValue.length) { poserCaret(doc, n, reste); return; }
      reste -= n.nodeValue.length;
    }
    if (dernier) poserCaret(doc, dernier, dernier.nodeValue.length);
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
      if (modeleActif && !acteSauve && acteEtat === 'brouillon') enregistrer(true);
    }, 4000);
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
      greffe: 'sauvegarde', version: 1, date: new Date().toISOString(),
      actes: registre, prereglages: prereglages
    };
    var b = new Blob([JSON.stringify(contenu)], { type: 'application/json;charset=utf-8' });
    var u = URL.createObjectURL(b), a = document.createElement('a');
    a.href = u; a.download = 'BAOBABS_GREFFE_' + isoDuJour() + '.greffe.json';
    document.body.appendChild(a); a.click(); a.remove();
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
  function commandeTexte(cmd, arg) {
    var doc = cadre.contentDocument, win = cadre.contentWindow;
    if (!doc) return;
    win.focus();
    try { doc.execCommand('styleWithCSS', false, true); } catch (e) {}
    if (cmd === 'bold' || cmd === 'italic' || cmd === 'underline') doc.execCommand(cmd);
    else if (cmd === 'surligner') doc.execCommand('hiliteColor', false, '#FFF0B3');
    else if (cmd === 'teinte') doc.execCommand('foreColor', false, arg);
    else if (cmd === 'grand') doc.execCommand('fontSize', false, '5');
    else if (cmd === 'petit') doc.execCommand('fontSize', false, '2');
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
    if (cmd === 'reglages') { panneau = 'bloc'; blocSel = bi; peindreFormulaire(); return; }
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
    if (panneau === 'bloc') peindreFormulaire();
  }

  /* le panneau quand un bloc est sélectionné : taille, alignement, thème,
     et pour un acte libre les réglages propres au bloc */
  var blocSel = null;
  function peindreBloc() {
    var hote = elt.formDefile, bi = blocSel;
    if (!bi) { panneau = 'donnees'; peindreFormulaire(); return; }
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
      + '<p class="gf-acc-intro">' + ech(nomDuBloc(bi)) + '</p>'
      + '<span class="gf-lab">Taille</span>' + choix('taille', [[85, 'Petit'], [100, 'Normal'], [112, 'Grand'], [125, 'Très grand']], st.taille || 100)
      + '<span class="gf-lab" style="margin-top:12px">Alignement</span>' + choix('align', [['gauche', 'Gauche'], ['centre', 'Centre'], ['droite', 'Droite']], st.align || 'gauche')
      + '<span class="gf-lab" style="margin-top:12px">Couleur</span>' + choix('theme', [['', 'Charte'], ['vert', 'Vert'], ['rouge', 'Rouge'], ['neutre', 'Neutre'], ['plein', 'Bandeau plein']], st.theme || '')
      + '<span class="gf-lab" style="margin-top:12px">Police</span>' + choix('police', [['', 'Charte'], ['gilroy', 'Gilroy'], ['inter', 'Inter'], ['organetto', 'Organetto'], ['paraphe', 'Manuscrite']], st.police || '')
      + (reglages ? '<span class="gf-lab" style="margin-top:12px">Réglages du bloc</span>' + reglages : '')
      + '<div class="gf-controle-actions" style="margin-top:16px"><button type="button" class="gf-btn gf-btn-fant" id="gf-bloc-retour">Retour aux données</button></div>'
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
      else { n.value = v == null ? '' : v; n.addEventListener('input', function () { ecrire(c, n.value); salir(); planifier(); }); }
    });
    hote.querySelectorAll('[data-image]').forEach(function (n) {
      n.addEventListener('change', function () {
        var f = n.files && n.files[0]; if (!f) return;
        lireFichier(f).then(function (uri) { return alleger(uri, 1600); }).then(function (uri) { ecrire(n.getAttribute('data-image'), uri); salir(); planifier(); });
      });
    });
    $('gf-bloc-retour').addEventListener('click', function () { panneau = 'donnees'; blocSel = null; peindreFormulaire(); });
  }

  /* ---- « / » et le clic droit : les textes prédéfinis ---- */
  function listeTextes(filtre) {
    var q = String(filtre || '').toLowerCase();
    return (G.textes || []).filter(function (t) { return !q || t.nom.toLowerCase().indexOf(q) !== -1 || (t.groupe || '').toLowerCase().indexOf(q) !== -1; });
  }
  function ouvrirSlash(el, filtre) {
    var doc = cadre.contentDocument;
    var sel = doc.getSelection();
    if (!sel || !sel.rangeCount) return;
    slashEl = el;
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
  function insererTexte(texte, filtre) {
    var doc = cadre.contentDocument;
    cadre.contentWindow.focus();
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
    fleche:     { nom: 'Flèche',     w: 40, h: 10 }
  };

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
                            x: 120, y: 200, w: T.w, h: T.h, rotation: 0, opacite: 100, texte: T.texte || '', couleur: 'or',
                            verrou: !!T.verrou }, extra || {});
    donnees.objets.push(o);
    salir(); rafraichir();
    objetSel = o.id; panneau = 'objet'; peindreFormulaire();
    setTimeout(function () { marquerSelection(); }, 50);
    dire(T.nom + ' posé' + (type === 'annotation' ? 'e' : '') + ' sur la page ' + page + (o.verrou ? ' · verrouillé' : ''), 'ok');
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
      var couleurs = { or: '#C1A462', vert: '#0F432B', rouge: '#B4231F', gris: '#8C948F', noir: '#15201A', bleu: '#152E72' };
      var c = couleurs[o.couleur] || couleurs.or;
      if (o.type === 'cachet') {
        el.style.backgroundImage = res.cachet ? 'url(' + res.cachet + ')' : '';
      } else if (o.type === 'signature') {
        var nom = o.texte || donnees.signNom || 'Antoine Jean Pierre Ndong';
        el.innerHTML = '<div class="sig-ink" style="position:static;width:100%;transform:none"><div class="sig-name">' + ech(initialeNom(nom)) + '</div>'
          + '<div class="sig-paraphe">' + G.blocs.PARAPHE + '</div></div>';
      } else if (o.type === 'image') {
        el.innerHTML = o.src ? '<img src="' + o.src + '" alt="">' : '<div class="fig-vide" style="width:100%;height:100%"></div>';
      } else if (o.type === 'annotation') {
        el.style.borderColor = c; el.style.color = c;
        el.innerHTML = '<div class="objet-txt">' + U_paragraphes(o.texte || '') + '</div>';
      } else if (o.type === 'cadre') {
        el.style.borderColor = c;
        if (o.fond) el.style.background = c + '18';
      } else if (o.type === 'fleche') {
        el.innerHTML = '<svg viewBox="0 0 100 20" preserveAspectRatio="none" style="width:100%;height:100%;display:block;overflow:visible">'
          + '<line x1="2" y1="10" x2="86" y2="10" stroke="' + c + '" stroke-width="2.2" vector-effect="non-scaling-stroke"/>'
          + '<polygon points="84,3 98,10 84,17" fill="' + c + '"/></svg>';
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
    var el = doc.querySelector('[data-objet="' + objetSel + '"]');
    var o = objetDe(objetSel);
    if (!el || !o) { objetSel = null; majNoteObjet(null); return; }
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
    note.textContent = (TYPES_OBJET[o.type] || {}).nom + ' · page ' + o.page + ' · ' + Math.round(o.w) + ' × ' + Math.round(o.h) + ' mm' + (o.rotation ? ' · ' + o.rotation + '°' : '')
      + (o.verrou ? ' · verrouillé' : ' · glissez pour déplacer, la poignée pour redimensionner, Suppr pour retirer');
  }
  function selectionnerObjet(id) {
    objetSel = id;
    marquerSelection();
    if (id) { panneau = 'objet'; peindreFormulaire(); }
    else if (panneau === 'objet') { panneau = 'donnees'; peindreFormulaire(); }
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
      if (objetSel && !(e.target.closest && e.target.closest('[data-edit]'))) selectionnerObjet(null);
      return;
    }
    e.preventDefault();
    var id = poignee ? poignee.getAttribute('data-poignee') : (rotation ? rotation.getAttribute('data-rotation') : el.getAttribute('data-objet'));
    var o = objetDe(id);
    if (!o) return;
    if (objetSel !== id) selectionnerObjet(id);
    if (o.verrou) return;
    var rc = (el || rotation.closest('.objet')).getBoundingClientRect();
    glisse = { id: id, poignee: !!poignee, rotation: !!rotation, x0: e.clientX, y0: e.clientY, ox: o.x, oy: o.y, ow: o.w, oh: o.h,
               cx: rc.left + rc.width / 2, cy: rc.top + rc.height / 2 };
  }
  function surSourisBouge(e) {
    if (!glisse) return;
    var o = objetDe(glisse.id), doc = cadre.contentDocument;
    var el = doc.querySelector('[data-objet="' + glisse.id + '"]');
    if (!o || !el) { glisse = null; return; }
    var dx = (e.clientX - glisse.x0) / MM, dy = (e.clientY - glisse.y0) / MM;
    if (glisse.rotation) {
      /* l'angle entre le centre de l'objet et la souris ; la poignée est en haut */
      var a = Math.atan2(e.clientY - glisse.cy, e.clientX - glisse.cx) * 180 / Math.PI + 90;
      if (e.shiftKey) a = Math.round(a / 15) * 15;
      o.rotation = Math.round(((a + 180) % 360 + 360) % 360 - 180);
      el.style.transform = o.rotation ? 'rotate(' + o.rotation + 'deg)' : '';
      majNoteObjet(o);
      return;
    }
    if (glisse.poignee) {
      var w = Math.max(5, glisse.ow + dx), h = Math.max(3, glisse.oh + dy);
      if (o.ratio || o.type === 'cachet') { h = w / (o.ratio || 1); }
      o.w = Math.round(w * 10) / 10; o.h = Math.round(h * 10) / 10;
      el.style.width = o.w + 'mm'; el.style.height = o.h + 'mm';
    } else {
      o.x = Math.round((glisse.ox + dx) * 10) / 10; o.y = Math.round((glisse.oy + dy) * 10) / 10;
      el.style.left = o.x + 'mm'; el.style.top = o.y + 'mm';
    }
    majNoteObjet(o);
  }
  function surSourisLache() {
    if (!glisse) return;
    glisse = null;
    salir();
    if (panneau === 'objet') peindreFormulaire();
  }
  function surToucheObjet(e) {
    if (!objetSel || lectureSeule()) return false;
    var doc = cadre.contentDocument;
    if (doc.activeElement && doc.activeElement.closest && doc.activeElement.closest('[data-edit]')) return false;
    var o = objetDe(objetSel);
    if (!o) return false;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); retirerObjet(objetSel); return true; }
    if (e.key === 'Escape') { e.preventDefault(); selectionnerObjet(null); return true; }
    var pas = e.shiftKey ? 5 : 1, bouge = true;
    if (o.verrou) return false;
    if (e.key === 'ArrowLeft') o.x -= pas; else if (e.key === 'ArrowRight') o.x += pas;
    else if (e.key === 'ArrowUp') o.y -= pas; else if (e.key === 'ArrowDown') o.y += pas;
    else bouge = false;
    if (!bouge) return false;
    e.preventDefault();
    var el = doc.querySelector('[data-objet="' + o.id + '"]');
    if (el) { el.style.left = o.x + 'mm'; el.style.top = o.y + 'mm'; }
    salir(); majNoteObjet(o);
    return true;
  }
  function retirerObjet(id) {
    var o = objetDe(id);
    donnees.objets = (donnees.objets || []).filter(function (x) { return x.id !== id; });
    if (o && o.type === 'cachet' && !donnees.objets.some(function (x) { return x.type === 'cachet'; })) delete donnees.cachetDetache;
    if (o && o.type === 'signature' && !donnees.objets.some(function (x) { return x.type === 'signature'; })) delete donnees.signatureDetachee;
    if (objetSel === id) objetSel = null;
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
  function peindreObjet() {
    var hote = elt.formDefile, o = objetDe(objetSel);
    if (!o) { panneau = 'donnees'; peindreFormulaire(); return; }
    var T = TYPES_OBJET[o.type] || { nom: o.type };
    function nombre(cle, lab, min, max, pas) {
      return '<div class="gf-champ"><label class="gf-lab">' + lab + '</label><input class="gf-in" type="number" data-o="' + cle + '" value="' + (o[cle] == null ? '' : o[cle]) + '" min="' + min + '" max="' + max + '" step="' + (pas || 1) + '"></div>';
    }
    var couleurs = [['or', 'Or'], ['vert', 'Vert'], ['rouge', 'Rouge'], ['gris', 'Gris'], ['noir', 'Noir'], ['bleu', 'Bleu encre']];
    hote.innerHTML =
      '<div class="gf-controle">'
      + '<p class="gf-acc-intro">' + ech(T.nom) + (T.sensible ? ' · <span class="gf-badge gf-badge-annule">élément sensible</span>' : '') + '</p>'
      + '<div class="gf-duo"><div>' + nombre('x', 'Depuis la gauche (mm)', 0, 210, 0.5) + '</div><div>' + nombre('y', 'Depuis le haut (mm)', 0, 297, 0.5) + '</div></div>'
      + '<div class="gf-duo"><div>' + nombre('w', 'Largeur (mm)', 3, 210, 0.5) + '</div><div>' + nombre('h', 'Hauteur (mm)', 2, 297, 0.5) + '</div></div>'
      + '<div class="gf-duo"><div>' + nombre('rotation', 'Rotation (°)', -180, 180, 1) + '</div><div>' + nombre('opacite', 'Opacité (%)', 5, 100, 5) + '</div></div>'
      + '<div class="gf-champ"><label class="gf-lab">Page</label><input class="gf-in" type="number" data-o="page" value="' + o.page + '" min="1" max="' + nbPages + '"></div>'
      + (o.type === 'annotation' || o.type === 'signature' ? '<div class="gf-champ"><label class="gf-lab">' + (o.type === 'signature' ? 'Nom signé' : 'Texte') + '</label><textarea class="gf-ta" data-o="texte" rows="3">' + ech(o.texte || '') + '</textarea></div>' : '')
      + (o.type === 'annotation' || o.type === 'cadre' || o.type === 'fleche'
          ? '<span class="gf-lab">Couleur</span><div class="gf-puces">' + couleurs.map(function (c) {
              return '<button type="button" class="gf-puce' + ((o.couleur || 'or') === c[0] ? ' is-actif' : '') + '" data-oc="' + c[0] + '">' + c[1] + '</button>';
            }).join('') + '</div>' : '')
      + (o.type === 'cadre' ? '<div class="gf-champ"><label class="gf-bascule"><input type="checkbox" data-ob="fond"' + (o.fond ? ' checked' : '') + '><span class="gf-bascule-piste"></span><span class="gf-bascule-txt">Fond teinté</span></label></div>' : '')
      + '<div class="gf-champ"><label class="gf-bascule"><input type="checkbox" data-ob="verrou"' + (o.verrou ? ' checked' : '') + '><span class="gf-bascule-piste"></span><span class="gf-bascule-txt">Verrouillé : ne se déplace pas à la souris</span></label></div>'
      + '<div class="gf-controle-actions" style="margin-top:14px;justify-content:flex-start;flex-wrap:wrap">'
      + '<button type="button" class="gf-mini" data-oa="dupliquer">Dupliquer</button>'
      + '<button type="button" class="gf-mini" data-oa="devant">Devant</button>'
      + '<button type="button" class="gf-mini" data-oa="derriere">Derrière</button>'
      + '<button type="button" class="gf-mini gf-mini-danger" data-oa="retirer">Retirer</button>'
      + '</div>'
      + '<div class="gf-controle-actions" style="margin-top:14px"><button type="button" class="gf-btn gf-btn-fant" id="gf-objet-retour">Retour aux données</button></div>'
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
    hote.querySelectorAll('[data-oa]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-oa'), list = donnees.objets, i = list.indexOf(o);
        if (a === 'retirer') { retirerObjet(o.id); return; }
        if (a === 'dupliquer') {
          var c = JSON.parse(JSON.stringify(o)); c.id = 'o' + Date.now().toString(36); c.x += 6; c.y += 6; c.verrou = false;
          list.splice(i + 1, 0, c); objetSel = c.id;
        } else if (a === 'devant' && i < list.length - 1) { list.splice(i, 1); list.push(o); }
        else if (a === 'derriere' && i > 0) { list.splice(i, 1); list.unshift(o); }
        salir(); rafraichir(); peindreFormulaire(); setTimeout(marquerSelection, 40);
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
    if (objetSel && objetDe(objetSel)) contenu = { genre: 'objet', objet: JSON.parse(JSON.stringify(objetDe(objetSel))) };
    else if (blocCourant && modeleActif.libre && /^b\d+$/.test(blocCourant)) {
      var x = (donnees.blocs || [])[+blocCourant.slice(1)];
      if (x) contenu = { genre: 'bloc', bloc: JSON.parse(JSON.stringify(x)), table: x.source && donnees.tables ? JSON.parse(JSON.stringify(donnees.tables[x.source] || null)) : null };
    }
    if (!contenu) return false;
    try { localStorage.setItem(CLE_PRESSE, JSON.stringify(contenu)); } catch (e) {}
    dire((contenu.genre === 'objet' ? (TYPES_OBJET[contenu.objet.type] || {}).nom : 'Bloc') + ' copié', 'ok');
    return true;
  }
  function collerElement() {
    if (lectureSeule()) return false;
    var doc = cadre && cadrePret ? cadre.contentDocument : null;
    if (doc && doc.activeElement && doc.activeElement.closest && doc.activeElement.closest('[data-edit]')) return false;  /* dans un texte : coller du texte */
    var contenu = null;
    try { contenu = JSON.parse(localStorage.getItem(CLE_PRESSE) || 'null'); } catch (e) {}
    if (!contenu) return false;
    if (contenu.genre === 'objet') {
      var o = contenu.objet; o.id = 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); o.x += 6; o.y += 6; o.verrou = false;
      if (o.type === 'cachet' && !res.cachet) { dire('Le cachet n\'est pas déposé sur ce poste.', 'erreur'); return true; }
      donnees.objets = donnees.objets || []; donnees.objets.push(o);
      salir(); rafraichir(); objetSel = o.id; panneau = 'objet'; peindreFormulaire(); setTimeout(marquerSelection, 50);
      dire('Objet collé', 'ok'); return true;
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
    cadre.contentWindow.focus();
    cadre.contentWindow.print();
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

    racine.addEventListener('keydown', raccourci);
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
      fermer(); return;
    }
    if (!ctrl) return;
    var enAtelier = !!modeleActif && espace === 'atelier';
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
      if (!zoomChoisi) { zoom = zoomLargeur(); }
      rafraichir();
    }
    majTitreBarre();
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
      .then(function (uri) { res.blason = uri; })
      .catch(function () { /* sans blason, l'acte sort quand même */ });
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
    return p.then(function () {
      return Promise.all(MODELES.filter(function (m) { return !G.modeles[m]; }).map(function (m) {
        return charger('/greffe/modeles/' + m + '.js', function () { return !!G.modeles[m]; });
      }));
    }).then(function () {
      /* les préréglages livrés avec le Greffe, après les modèles qu'ils citent */
      return G.prereglages ? null : charger('/greffe/prereglages.js', function () { return !!G.prereglages; });
    });
  }

  G.mount = function (root, contexte) {
    racine = root; api = contexte || {};
    brancher();
    return chargerMoteur().then(function () {
      return Promise.all([dbTout(MAG_RES), dbTout(MAG_ACTES), chargerBlason(), dbTout(MAG_PRE)]);
    }).then(function (r) {
      (r[0] || []).forEach(function (o) { res[o.cle] = o.uri; });
      registre = (r[1] || []).sort(function (a, b) { return b.maj - a.maj; });
      prereglages = (r[3] || []).sort(function (a, b) { return b.maj - a.maj; });
      var demande = api && api.acte ? String(api.acte) : null;
      var rep = demande ? { acte: demande } : lireReprise();
      var fiche = rep && rep.acte !== 'accueil' ? registre.filter(function (a) { return a.id === rep.acte; })[0] : null;
      if (fiche && ressourcesCompletes()) { ouvrirActe(fiche); dire('Reprise : ' + (fiche.intitule || fiche.nom) + (fiche.numero ? ' n° ' + fiche.numero : ''), 'ok'); }
      else montrer(ressourcesCompletes() ? 'accueil' : 'polices');
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
    if (!elt.ecranAtl.hidden) rafraichir();
  };

  function fermer() {
    if (!racine) return;
    if (!acteSauve && modeleActif && acteEtat === 'brouillon') enregistrer(true);
    oublierReprise();
    ouvert = false;
    racine.classList.remove('is-open');
    racine.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    if (api && typeof api.onClose === 'function') { try { api.onClose(); } catch (e) {} }
  }
  G.close = fermer;
  G.isOpen = function () { return ouvert; };

})();
