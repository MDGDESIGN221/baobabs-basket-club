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
  var H_PAGE = 297 * MM;                 /* hauteur d'une A4 */

  /* AJOUTER UN TYPE D'ACTE : un fichier dans modeles/, son nom ici. */
  var MODELES = ['ordre-mission', 'courrier',
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

  var DB_NOM = 'bbc-greffe', DB_VER = 2, MAG_RES = 'ressources', MAG_ACTES = 'actes';

  function dbOuvrir() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB_NOM, DB_VER);
      r.onupgradeneeded = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains(MAG_RES)) db.createObjectStore(MAG_RES, { keyPath: 'cle' });
        if (!db.objectStoreNames.contains(MAG_ACTES)) db.createObjectStore(MAG_ACTES, { keyPath: 'id' });
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
  var registre = [];
  var cadre = null, cadrePret = false, minuteur = null;
  var zoom = 0.7;
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
    elt.sousTitre.textContent = modeleActif.nom
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

  function nouvelActe(cle) {
    var m = G.modeles[cle];
    if (!m) return;
    modeleActif = m;
    donnees = m.defauts();
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

    hote.innerHTML =
      '<div class="gf-acc-carte"><h2 class="gf-acc-titre">Quel acte voulez-vous établir ?</h2>'
      + htmlModeles + '</div>'
      + '<div class="gf-acc-carte"><h2 class="gf-acc-titre">Le registre</h2>'
      + '<p class="gf-acc-intro">Chaque acte est gardé sous forme de données. '
      + 'Rouvrez-le pour le corriger, le renuméroter ou le réimprimer.</p>'
      + htmlRegistre + '</div>';

    hote.querySelectorAll('[data-modele]').forEach(function (b) {
      b.addEventListener('click', function () { nouvelActe(b.getAttribute('data-modele')); });
    });
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

    (modeleActif.sections || []).forEach(function (s, i) {
      var sect = document.createElement('section');
      sect.className = 'gf-sect' + (s.ouvert ? ' is-ouvert' : '');
      var corps = '';

      if (s.special === 'table')          corps = '<div data-table="' + ech(s.source) + '"></div>';
      else if (s.special === 'articles')  corps = '<div id="gf-zone-articles"></div>';
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

    hote.querySelectorAll('[data-cle]').forEach(function (n) {
      var c = n.getAttribute('data-cle');
      if (n.type === 'checkbox') {
        n.checked = !!donnees[c];
        n.addEventListener('change', function () { donnees[c] = n.checked; salir(); majArticlesSiAuto(); planifier(); });
      } else {
        n.value = donnees[c] == null ? '' : donnees[c];
        n.addEventListener('input', function () { donnees[c] = n.value; salir(); majArticlesSiAuto(); planifier(); });
      }
    });

    hote.querySelectorAll('[data-table]').forEach(function (n) {
      peindreTable(n.getAttribute('data-table'));
    });
    peindreArticles();
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
      var titre = window.prompt("Titre de la nouvelle colonne", "Taille");
      if (titre === null) return;
      titre = String(titre).trim(); if (!titre) return;
      t.colonnes.push({ cle: cleLibre(t, titre), titre: titre, poids: 22, align: 'centre', forme: 'texte' });
      salir(); peindreTable(source); majArticlesSiAuto(); planifier();
      dire('Colonne « ' + titre + ' » ajoutée', 'ok');
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

  /* À l'écran seulement : le pied et le filigrane sont en
     position:fixed pour se répéter à chaque page imprimée. Dans un
     cadre qui défile, « fixed » les colle au hublot. On les repose
     pour l'aperçu, sans toucher à l'impression. */
  var CSS_ECRAN = [
    '@media screen{',
    '  html{ background:#fff;',
    '    background-image:repeating-linear-gradient(to bottom,transparent 0,transparent calc(297mm - 1px),',
    '      #D8DEDA calc(297mm - 1px),#D8DEDA 297mm); }',
    '  body{ padding:11mm 13mm 12mm 13mm; }',
    '  .wm{ position:absolute; }',
    '  .foot{ position:static; margin-top:10mm; }',
    '}'
  ].join('\n');

  function preparerCadre() {
    var doc = cadre.contentDocument;
    doc.open();
    doc.write('<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">'
      + '<style id="gf-polices">' + cssPolices() + '</style>'
      + '<style id="gf-style">' + cssDocument() + '</style>'
      + '<style id="gf-ecran">' + CSS_ECRAN + '</style>'
      + '</head><body></body></html>');
    doc.close();
    cadrePret = true;
  }

  function planifier() {
    clearTimeout(minuteur);
    minuteur = setTimeout(rafraichir, 220);
  }

  function rafraichir() {
    if (!modeleActif || !cadre) return;
    if (!cadrePret) preparerCadre();
    var doc = cadre.contentDocument;
    try {
      doc.body.innerHTML = corpsDocument();
    } catch (e) {
      dire('Le modèle a buté : ' + (e && e.message ? e.message : e), 'erreur');
      return;
    }
    /* Pas de requestAnimationFrame ici. Il ne se déclenche pas dans un
       onglet qui n'est pas rendu : la hauteur du cadre restait vide et
       le compteur de pages muet, sans la moindre erreur en console.
       Lire scrollHeight force le calcul de la mise en page tout seul.
       La seconde passe rattrape l'arrivée des polices, qui change les
       hauteurs de ligne. */
    mesurer(doc);
    clearTimeout(rafraichir._t);
    rafraichir._t = setTimeout(function () { mesurer(doc); }, 140);
  }

  function mesurer(doc) {
    try {
      var h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
      cadre.style.height = (h + 4) + 'px';
      appliquerZoom();
      elt.pages.textContent = compterPages(doc) + ' page(s)';
    } catch (e) { /* le cadre a pu être remplacé entre deux passes */ }
  }

  /* Les sauts forcés (une annexe) découpent le document ; chaque tronçon
     occupe ensuite autant de pages que sa hauteur le demande.

     Tout se mesure en « hauteur de contenu » : origine au premier
     pixel imprimable, marges de page retirées. Un offsetTop ne
     convient pas ici, il se compte depuis .wrap qui est positionné. */
  function compterPages(doc) {
    var hUtile = H_PAGE - (11 + 12) * MM;
    var rBody = doc.body.getBoundingClientRect();
    var zero = rBody.top + 11 * MM;
    var fin = doc.body.scrollHeight - (11 + 12) * MM;

    var coupes = [];
    Array.prototype.forEach.call(doc.querySelectorAll('.wrap > *'), function (n) {
      var st = cadre.contentWindow.getComputedStyle(n);
      if (st.breakBefore === 'page' || st.pageBreakBefore === 'always') {
        coupes.push(n.getBoundingClientRect().top - zero);
      }
    });

    var bornes = [0].concat(coupes.sort(function (a, b) { return a - b; }), [fin]);
    var pages = 0;
    for (var i = 0; i < bornes.length - 1; i++) {
      var h = bornes[i + 1] - bornes[i];
      if (h > 2) pages += Math.max(1, Math.ceil(h / hUtile));
    }
    return Math.max(1, pages);
  }

  /* Le zoom porte sur le cadre, pas sur la feuille : un transform ne
     change pas la place qu'un élément occupe dans la mise en page.
     Mise sur la feuille, la réduction laissait 794 px de large réservés
     pour 556 px affichés, et l'aperçu défilait latéralement pour rien. */
  function appliquerZoom() {
    var w = 210 * MM;
    var h = parseFloat(cadre.style.height) || (w * 1.414);
    cadre.style.transform = 'scale(' + zoom + ')';
    elt.feuille.style.width = Math.round(w * zoom) + 'px';
    elt.feuille.style.height = Math.round(h * zoom) + 'px';
    elt.zoomVal.textContent = Math.round(zoom * 100) + ' %';
  }

  /* =================================================================
     10. SORTIR L'ACTE
     ================================================================= */
  function documentComplet() {
    return '<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
      + '<title>' + ech(donnees.titre || modeleActif.nom)
      + (donnees.numero ? ' n° ' + ech(donnees.numero) : '')
      + ' &middot; Baobabs Basket Club</title>\n'
      + '<style>\n' + cssPolices() + '\n</style>\n'
      + '<style>\n' + cssDocument() + '\n</style>\n'
      + '</head>\n<body>\n' + corpsDocument() + '\n</body>\n</html>\n';
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
    });
  }

  G.mount = function (root, contexte) {
    racine = root; api = contexte || {};
    brancher();
    return chargerMoteur().then(function () {
      return Promise.all([dbTout(MAG_RES), dbTout(MAG_ACTES), chargerBlason()]);
    }).then(function (r) {
      (r[0] || []).forEach(function (o) { res[o.cle] = o.uri; });
      registre = (r[1] || []).sort(function (a, b) { return b.maj - a.maj; });
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
