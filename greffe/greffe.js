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

  function ech(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
  function gras(t) { return t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>'); }

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
      var contenu = gras(ech(m ? m[2] : l));
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

  function salir() { acteSauve = false; majTitreBarre(); }

  function majTitreBarre() {
    if (!elt.sousTitre) return;
    if (!modeleActif) { elt.sousTitre.textContent = 'Actes officiels du club'; return; }
    var nom = (modeleActif.libre && String(donnees.titre || '').trim()) || modeleActif.nom;
    elt.sousTitre.textContent = nom
      + (donnees.numero ? ' n° ' + donnees.numero : '')
      + (acteSauve ? '' : ' · non enregistré');
  }

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

  function enregistrer(silencieux) {
    if (!modeleActif) return Promise.resolve();
    if (!acteId) acteId = identifiant();
    var fiche = {
      id: acteId,
      modele: modeleActif.cle,
      nom: modeleActif.nom,
      numero: donnees.numero || '',
      intitule: donnees.titre || modeleActif.nom,
      date: donnees.dateActe || isoDuJour(),
      maj: Date.now(),
      donnees: JSON.parse(JSON.stringify(donnees))
    };
    return dbPoser(MAG_ACTES, fiche).then(function () {
      acteSauve = true; majTitreBarre();
      registre = registre.filter(function (a) { return a.id !== fiche.id; });
      registre.unshift(fiche);
      if (!silencieux) dire('Acte enregistré', 'ok');
    }).catch(function (e) {
      dire("Enregistrement impossible : " + (e && e.message ? e.message : e), 'erreur');
    });
  }

  function ouvrirActe(fiche) {
    var m = G.modeles[fiche.modele];
    if (!m) { dire("Modèle « " + fiche.modele + " » introuvable.", 'erreur'); return; }
    modeleActif = m;
    donnees = JSON.parse(JSON.stringify(fiche.donnees));
    acteId = fiche.id; acteSauve = true;
    montrer('atelier');
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
    /* le numéro suit le registre : premier libre de l'année en cours */
    if (m.prefixe) {
      var an = String(new Date().getFullYear()).slice(2);
      var pris = registre.filter(function (a) { return a.modele === cle; })
        .map(function (a) { return parseInt(String(a.numero).split('/')[0], 10) || 0; });
      var n = 1; while (pris.indexOf(n) !== -1) n++;
      donnees.numero = deuxChiffres(n) + '/' + an;
    }
    acteId = null; acteSauve = false;
    montrer('atelier');
  }

  function peindreAccueil() {
    var hote = elt.accueil;
    if (!hote) return;

    var familles = {};
    MODELES.forEach(function (k) {
      var m = G.modeles[k];
      if (!m) return;
      (familles[m.famille || 'Actes'] = familles[m.famille || 'Actes'] || []).push(m);
    });

    var htmlModeles = Object.keys(familles).map(function (f) {
      return '<div class="gf-fam"><span class="gf-lab">' + ech(f) + '</span><div class="gf-cartes">'
        + familles[f].map(function (m) {
            return '<button type="button" class="gf-carte" data-modele="' + ech(m.cle) + '">'
              + '<b>' + ech(m.nom) + '</b><span>' + ech(m.resume || '') + '</span></button>';
          }).join('')
        + '</div></div>';
    }).join('');

    var htmlRegistre = registre.length
      ? '<ul class="gf-registre">' + registre.slice(0, 40).map(function (a) {
          return '<li data-acte="' + ech(a.id) + '">'
            + '<button type="button" class="gf-reg-ouvrir">'
            + '<b>' + ech(a.intitule || a.nom) + (a.numero ? ' n° ' + ech(a.numero) : '') + '</b>'
            + '<span>' + ech(a.nom) + ' · ' + ech(dateLongue(a.date, false) || '') + '</span>'
            + '</button>'
            + '<button type="button" class="gf-reg-sup" title="Retirer du registre" aria-label="Retirer">'
            + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
            + '</button></li>';
        }).join('') + '</ul>'
      : '<p class="gf-vide">Aucun acte enregistré pour l\'instant.</p>';

    var pres = tousPrereglages();
    var htmlPre = '<div class="gf-cartes">' + pres.map(function (p, i) {
        var m = G.modeles[p.modele];
        return '<div class="gf-carte gf-carte-pre" data-pre="' + i + '">'
          + '<button type="button" class="gf-carte-ouvrir"><b>' + ech(p.nom) + '</b>'
          + '<span>' + ech(m ? m.nom : p.modele) + (p.livre ? ' · livré avec le Greffe' : ' · le vôtre') + '</span></button>'
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

    hote.innerHTML =
      '<div class="gf-acc-carte"><h2 class="gf-acc-titre">Quel acte voulez-vous établir ?</h2>'
      + htmlModeles + '</div>'
      + '<div class="gf-acc-carte"><h2 class="gf-acc-titre">Les préréglages</h2>'
      + '<p class="gf-acc-intro">Un acte déjà composé : ouvrez-le, il ne reste qu\'à écrire. '
      + 'Depuis l\'atelier, « Préréglage » garde l\'acte en cours sous cette forme.</p>'
      + htmlPre + '</div>'
      + '<div class="gf-acc-carte"><h2 class="gf-acc-titre">Le registre</h2>'
      + '<p class="gf-acc-intro">Chaque acte est gardé sous forme de données. '
      + 'Rouvrez-le pour le corriger, le renuméroter ou le réimprimer.</p>'
      + htmlRegistre + '</div>';

    hote.querySelectorAll('[data-modele]').forEach(function (b) {
      b.addEventListener('click', function () { nouvelActe(b.getAttribute('data-modele')); });
    });
    hote.querySelectorAll('.gf-carte-pre').forEach(function (c) {
      var p = pres[+c.getAttribute('data-pre')];
      c.querySelector('.gf-carte-ouvrir').addEventListener('click', function () {
        if (!G.modeles[p.modele]) { dire('Modèle « ' + p.modele + ' » introuvable.', 'erreur'); return; }
        nouvelActe(p.modele, p);
      });
      var ex = c.querySelector('[data-exporter]');
      if (ex) ex.addEventListener('click', function () { exporterPrereglage(p); });
      var ret = c.querySelector('[data-retirer]');
      if (ret) ret.addEventListener('click', function () {
        dbOter(MAG_PRE, p.id).then(function () {
          prereglages = prereglages.filter(function (q) { return q.id !== p.id; });
          peindreAccueil(); dire('Préréglage retiré', 'ok');
        });
      });
    });
    var depot = $('gf-pre-fichier');
    if (depot) depot.addEventListener('change', function () { deposerPrereglages(depot.files); depot.value = ''; });
    hote.querySelectorAll('.gf-registre li').forEach(function (li) {
      var id = li.getAttribute('data-acte');
      li.querySelector('.gf-reg-ouvrir').addEventListener('click', function () {
        var f = registre.filter(function (a) { return a.id === id; })[0];
        if (f) ouvrirActe(f);
      });
      li.querySelector('.gf-reg-sup').addEventListener('click', function () {
        dbOter(MAG_ACTES, id).then(function () {
          registre = registre.filter(function (a) { return a.id !== id; });
          peindreAccueil(); dire('Acte retiré du registre', 'ok');
        });
      });
    });
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

    var barre = '<div class="gf-tab-barre">'
      + '<span class="gf-tab-compte">' + utiles.length + ' ' + ech(sing) + (utiles.length > 1 ? 's' : '') + '</span>'
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

    hote.querySelector('[data-act="col-plus"]').addEventListener('click', function () {
      demander('Nouvelle colonne', 'Son titre, tel qu\'il s\'imprimera en tête du tableau.', 'Taille').then(function (titre) {
        if (!titre) return;
        t.colonnes.push({ cle: cleLibre(t, titre), titre: titre, poids: 22, align: 'centre', forme: 'texte' });
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
      if (!e) return;
      if (e.type === 'articles' && donnees.blocs.some(function (x) { return x.b === 'articles'; })) {
        dire('Un seul bloc d\'articles par acte.', 'erreur'); return;
      }
      var x = e.neuf();
      if (x._table) { donnees.tables = donnees.tables || {}; donnees.tables[x.source] = x._table; delete x._table; }
      /* un bloc neuf se pose avant les signatures, si elles ferment l'acte */
      var k = donnees.blocs.length;
      if (k && donnees.blocs[k - 1].b === 'signatures' && x.b !== 'signatures' && x.b !== 'saut') k--;
      donnees.blocs.splice(k, 0, x);
      refaire();
      dire('Bloc « ' + e.nom + ' » posé', 'ok');
    });
  }

  /* --------------------------------- DEMANDER ---------------------------------
     Une question, une réponse, sans window.prompt : le navigateur
     d'aperçu ne le connaît pas, et il n'a pas la charte. */
  function demander(titre, aide, defaut) {
    return new Promise(function (res) {
      var voile = document.createElement('div');
      voile.className = 'gf-voile';
      voile.innerHTML =
        '<div class="gf-modale gf-modale-courte" role="dialog" aria-modal="true">'
        + '<header class="gf-modale-top"><h3>' + ech(titre) + '</h3>'
        + '<button type="button" class="gf-ico gf-ico-close" data-non aria-label="Fermer">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></header>'
        + '<div class="gf-modale-corps">' + (aide ? '<p class="gf-modale-aide">' + ech(aide) + '</p>' : '')
        + '<input class="gf-in" type="text" data-reponse></div>'
        + '<footer class="gf-modale-pied"><button type="button" class="gf-btn gf-btn-fant" data-non>Annuler</button>'
        + '<button type="button" class="gf-btn gf-btn-accent" data-oui>Valider</button></footer></div>';
      var input = voile.querySelector('[data-reponse]');
      input.value = defaut || '';
      function fin(v) { voile.remove(); res(v); }
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
  function cssPolices() {
    return BESOINS.filter(function (b) { return !b.image && res[b.cle]; }).map(function (b) {
      return "@font-face{font-family:'" + b.famille + "';src:url(" + res[b.cle] + ");"
           + "font-weight:" + b.graisse + ";font-style:" + (b.italique ? 'italic' : 'normal') + ";}";
    }).join('\n');
  }

  function cssDocument() {
    return G.blocs.css() + (modeleActif && modeleActif.css ? '\n' + modeleActif.css() : '');
  }

  function corpsDocument() {
    return G.blocs.assembler(modeleActif, donnees, { res: res });
  }

  /* À l'écran seulement : le cadre est transparent (la scène de
     l'atelier fournit son fond), et tout ce qui porte data-edit se
     signale sous la souris. Rien de ceci ne part à l'impression ni dans
     le fichier exporté. */
  var CSS_ECRAN = [
    '@media screen{',
    '  html,body{ background:transparent; }',
    '  [data-edit]{ outline:1px dashed transparent; outline-offset:2px; border-radius:2pt;',
    '    transition:outline-color .15s, background-color .15s; cursor:text; }',
    '  [data-edit]:hover{ outline-color:rgba(70,191,29,.75); }',
    '  [data-edit]:focus{ outline:2px solid #46BF1D; background:rgba(70,191,29,.07); }',
    '  .txt[data-edit]{ min-height:1.2em; }',
    '  td[data-edit]:empty::after{ content:"\\00a0"; }',
    '  tr.tr-suite td{ border-bottom-style:dashed; }',
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
    try {
      doc.body.innerHTML = corpsDocument();
      nbPages = G.blocs.paginer(doc);
    } catch (e) {
      dire('Le modèle a buté : ' + (e && e.message ? e.message : e), 'erreur');
      return;
    }
    brancherEdition(doc);
    mesurer(doc);
    if (c) caretRestaurer(doc, c);
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
    } catch (e) { /* le cadre a pu être remplacé entre deux passes */ }
  }

  /* Le zoom porte sur le CADRE, pas sur la feuille : un transform ne
     change pas la place qu'un élément occupe dans la mise en page.
     Mise sur la feuille, la réduction laissait 794 px de large réservés
     pour 556 px affichés, et l'aperçu défilait latéralement pour rien. */
  function appliquerZoom() {
    var w = LARGEUR_CADRE * MM;
    var h = parseFloat(cadre.style.height) || (w * 1.414);
    cadre.style.transform = 'scale(' + zoom + ')';
    elt.feuille.style.width = Math.round(w * zoom) + 'px';
    elt.feuille.style.height = Math.round(h * zoom) + 'px';
    elt.zoomVal.textContent = Math.round(zoom * 100) + ' %';
  }

  /* =================================================================
     9 bis. ÉCRIRE SUR LA FEUILLE
     Tout ce que le moteur a marqué data-edit devient modifiable en
     place. Chaque frappe réécrit la donnée au chemin indiqué, met le
     formulaire d'accord, et la feuille se refait une fois qu'on a fini
     d'écrire, curseur retrouvé. La donnée reste la seule vérité : la
     feuille n'est jamais lue autrement que pour la réécrire.
     ================================================================= */
  var editMinuteur = null;

  function brancherEdition(doc) {
    Array.prototype.forEach.call(doc.querySelectorAll('[data-edit]'), function (el) {
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'false');
    });
    if (doc.body.getAttribute('data-branche')) return;
    doc.body.setAttribute('data-branche', '1');
    doc.body.addEventListener('input', surSaisie);
    doc.body.addEventListener('keydown', surTouche);
    doc.body.addEventListener('paste', surCollage);
    doc.body.addEventListener('focusout', surSortie);
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
      : el.innerText.replace(/\n+$/, '').replace(/\n/g, ' ');
    ecrire(chemin, valeur);
    salir();
    synchroniserFormulaire(chemin);
    clearTimeout(editMinuteur);
    editMinuteur = setTimeout(function () { rafraichir(true); }, 900);
  }

  function surTouche(e) {
    var el = cibleEdit(e);
    if (!el) return;
    if (e.key === 'Escape') { e.preventDefault(); el.blur(); return; }
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
    clearTimeout(editMinuteur);
    /* un court délai : si le clic est parti vers un autre texte de la
       feuille, c'est lui que le curseur doit retrouver après la remise
       au propre */
    editMinuteur = setTimeout(function () { rafraichir(true); }, 120);
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
        if (c.nodeType === 3) { s += c.nodeValue; return; }
        if (c.nodeType !== 1) return;
        if (c.tagName === 'BR') { s += '\n'; return; }
        if (c.tagName === 'B' || c.tagName === 'STRONG') {
          var t = enLigne(c); s += t.trim() ? '**' + t.trim() + '**' : t; return;
        }
        s += enLigne(c);
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
      Array.prototype.forEach.call(clone.querySelectorAll('tr.tr-suite, .pill-vide'), function (n) { n.parentNode.removeChild(n); });
      Array.prototype.forEach.call(clone.querySelectorAll('[data-edit]'), function (n) {
        n.removeAttribute('data-edit'); n.removeAttribute('contenteditable'); n.removeAttribute('spellcheck');
      });
      corps = clone.innerHTML;
    } else {
      corps = corpsDocument();
    }
    return '<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
      + '<title>' + titre + '</title>\n'
      + '<style>\n' + cssPolices() + '\n</style>\n'
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
    dire('Fichier source téléchargé', 'ok');
  }

  function imprimer() {
    if (!cadre || !cadre.contentWindow) return;
    /* Le titre du document devient le nom proposé par Chrome dans la
       boîte « Enregistrer au format PDF ». */
    try { cadre.contentDocument.title = nomFichier(); } catch (e) {}
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
      ecranPol: $('gf-ecran-polices'), ecranAtl: $('gf-ecran-atelier'),
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
    $('gf-accueil-btn').addEventListener('click', function () { montrer('accueil'); });
    $('gf-polices-btn').addEventListener('click', function () { montrer('polices'); });
    $('gf-enregistrer').addEventListener('click', function () { enregistrer(false); });

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

    $('gf-zoom-moins').addEventListener('click', function () { zoom = Math.max(0.25, zoom - 0.1); appliquerZoom(); });
    $('gf-zoom-plus').addEventListener('click', function () { zoom = Math.min(1.5, zoom + 0.1); appliquerZoom(); });
    $('gf-export-html').addEventListener('click', exporterHtml);
    $('gf-prereglage').addEventListener('click', garderPrereglage);
    $('gf-imprimer').addEventListener('click', imprimer);

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

    racine.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!elt.voile.hidden) { fermerColler(); return; }
        fermer(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault(); enregistrer(false);
      }
    });
  }

  function montrer(quoi) {
    elt.ecranAcc.hidden = (quoi !== 'accueil');
    elt.ecranPol.hidden = (quoi !== 'polices');
    elt.ecranAtl.hidden = (quoi !== 'atelier');
    racine.classList.toggle('gf-en-atelier', quoi === 'atelier');

    if (quoi === 'accueil') {
      elt.sousTitre.textContent = 'Actes officiels du club';
      peindreAccueil();
    } else if (quoi === 'polices') {
      elt.sousTitre.textContent = 'Mes ressources';
      peindreListeRessources();
    } else {
      majTitreBarre();
      cadrePret = false;
      peindreFormulaire();
      rafraichir();
    }
  }

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
      montrer(ressourcesCompletes() ? 'accueil' : 'polices');
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
    if (!acteSauve && modeleActif) enregistrer(true);
    ouvert = false;
    racine.classList.remove('is-open');
    racine.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    if (api && typeof api.onClose === 'function') { try { api.onClose(); } catch (e) {} }
  }
  G.close = fermer;
  G.isOpen = function () { return ouvert; };

})();
