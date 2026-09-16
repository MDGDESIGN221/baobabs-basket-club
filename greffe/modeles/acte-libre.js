/* =====================================================================
   MODÈLE : ACTE LIBRE
   ---------------------------------------------------------------------
   Une feuille A4 vierge, et une palette. L'acte est la LISTE DE SES
   BLOCS, dans l'ordre : en-tête, titre, texte, encadré, cases de
   repères, tableau, parties, articles, signatures, image, espace, saut
   de page. On les ajoute, on les déplace, on les retire depuis
   l'écran ; leurs textes s'écrivent directement sur la feuille.

   C'est aussi le socle des PRÉRÉGLAGES : un préréglage n'est rien
   d'autre qu'une liste de blocs enregistrée avec ses tableaux. Ceux
   du club sont dans prereglages.js ; les siens se gardent dans le
   navigateur, s'exportent et se déposent en fichier .json.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  var compteur = 0;
  function id(prefixe) { return prefixe + (++compteur) + '_' + Math.random().toString(36).slice(2, 6); }

  /* ================================================================
     LA PALETTE : ce qu'on peut poser sur la feuille
     Chaque entrée sait créer son instance (neuf), déclarer ses
     réglages hors texte, et se rendre (bloc), les textes en '@chemin'
     pour qu'ils s'écrivent sur la feuille.
     ================================================================ */
  var PALETTE = [
    { type: 'entete', nom: "En-tête du club", famille: "Structure",
      resume: "Blason, nom, devise, drapeau et deux lignes à droite.",
      neuf: function () {
        return { b: 'entete', nom: "BAOBABS BASKET CLUB", devise: "Grandir ici. Régner partout.",
                 ligne1: "Récépissé n° 8280", ligne2: "Dakar, le " + U.dateLongue(U.isoDuJour(), false), drapeau: true };
      },
      reglages: [{ cle: 'drapeau', lab: "Drapeau du Sénégal", type: 'bascule' }],
      bloc: function (x, ch) {
        return { b: 'entete', nom: '@' + ch + 'nom', devise: '@' + ch + 'devise',
                 droite: ['@' + ch + 'ligne1', '@' + ch + 'ligne2'], drapeau: '@' + ch + 'drapeau' };
      } },

    { type: 'titre', nom: "Titre", famille: "Structure",
      resume: "Une étiquette, une pastille, le grand titre et sa phrase.",
      neuf: function () {
        return { b: 'titre', etiquette: "Document officiel du club", pastille: "", texte: "Titre de l'acte",
                 sous: "" };
      },
      reglages: [],
      bloc: function (x, ch) {
        return { b: 'titre', etiquette: '@' + ch + 'etiquette', pastille: '@' + ch + 'pastille',
                 texte: '@' + ch + 'texte', sous: '@' + ch + 'sous' };
      } },

    { type: 'texte', nom: "Texte", famille: "Texte",
      resume: "Des paragraphes, des puces (- ), des notes (> ), du **gras**.",
      neuf: function () {
        return { b: 'texte', etiquette: "", titre: "", texte: "Écrivez ici. Une ligne vide sépare deux paragraphes." };
      },
      reglages: [],
      bloc: function (x, ch) {
        return { b: 'texte', etiquette: '@' + ch + 'etiquette', titre: '@' + ch + 'titre', texte: '@' + ch + 'texte' };
      } },

    { type: 'encadre', nom: "Encadré", famille: "Texte",
      resume: "Un fond, un filet d'or, une étiquette, un titre et un texte.",
      neuf: function () { return { b: 'encadre', etiquette: "Objet", titre: "", texte: "" }; },
      reglages: [],
      bloc: function (x, ch) {
        return { b: 'encadre', etiquette: '@' + ch + 'etiquette', titre: '@' + ch + 'titre', apres: '@' + ch + 'texte' };
      } },

    { type: 'phrase', nom: "Phrase de liaison", famille: "Texte",
      resume: "« Il est convenu ce qui suit : », en gras, avant des articles.",
      neuf: function () { return { b: 'phrase', texte: "Il est convenu ce qui suit :" }; },
      reglages: [],
      bloc: function (x, ch) { return { b: 'phrase', texte: '@' + ch + 'texte' }; } },

    { type: 'articles', nom: "Articles numérotés", famille: "Texte",
      resume: "01, 02, 03… un titre et un texte chacun. Un seul bloc par acte.",
      neuf: function () { return { b: 'articles' }; },
      reglages: [],
      bloc: function () {
        return { b: 'articles', articles: function (d) {
          return (d.articles && d.articles.length) ? d.articles : articlesParDefaut(d);
        } };
      } },

    { type: 'reperes', nom: "Cases de repères", famille: "Cases",
      resume: "Une rangée de cases : étiquette, valeur, précision.",
      neuf: function () {
        return { b: 'reperes', nb: 4, cellules: [
          { label: "Date", valeur: U.dateLongue(U.isoDuJour(), false), sous: "" },
          { label: "Lieu", valeur: "Dakar", sous: "" },
          { label: "Objet", valeur: "", sous: "" },
          { label: "Référence", valeur: "", sous: "" }] };
      },
      reglages: [{ cle: 'nb', lab: "Nombre de cases", type: 'choix', choix: ['2', '3', '4', '5'] }],
      bloc: function (x, ch) {
        return { b: 'reperes', cellules: function () {
          var n = Math.max(1, Math.min(6, parseInt(x.nb, 10) || 4)), out = [];
          for (var j = 0; j < n; j++) {
            var c = (x.cellules && x.cellules[j]) || {};
            out.push({ label: c.label, valeur: c.valeur, sous: c.sous, chemin: ch + 'cellules.' + j });
          }
          return out;
        } };
      } },

    { type: 'chips', nom: "Pastilles de chiffres", famille: "Cases",
      resume: "Des petites cases côte à côte : « Total 15 », « Joueuses 12 ».",
      neuf: function () {
        return { b: 'chips', nb: 3, chips: [{ label: "Total", valeur: "" }, { label: "", valeur: "" }, { label: "", valeur: "" }] };
      },
      reglages: [{ cle: 'nb', lab: "Nombre de pastilles", type: 'choix', choix: ['1', '2', '3', '4', '5', '6'] }],
      bloc: function (x, ch) {
        return { b: 'chips', chips: function () {
          var n = Math.max(1, Math.min(8, parseInt(x.nb, 10) || 3)), out = [];
          for (var j = 0; j < n; j++) {
            var c = (x.chips && x.chips[j]) || {};
            out.push({ label: c.label, valeur: c.valeur, chemin: ch + 'chips.' + j });
          }
          return out;
        } };
      } },

    { type: 'parties', nom: "Deux parties", famille: "Structure",
      resume: "« Entre les soussignés » et « Et » : deux colonnes, nom, représentant, mention.",
      neuf: function () {
        return { b: 'parties', parties: [
          { label: "Entre les soussignés", nom: "", texte: "Représentée par", tag: "Ci-après dénommée « »" },
          { label: "Et", nom: "Baobabs Basket Club", texte: "Représenté par son Président, Monsieur Antoine Jean Pierre Ndong.", tag: "Ci-après dénommé « le Club »" }] };
      },
      reglages: [],
      bloc: function (x, ch) {
        return { b: 'parties', parties: [0, 1].map(function (j) {
          var p = ch + 'parties.' + j + '.';
          return { label: '@' + p + 'label', nom: '@' + p + 'nom', texte: '@' + p + 'texte', tag: '@' + p + 'tag' };
        }) };
      } },

    { type: 'signatures', nom: "Signatures", famille: "Structure",
      resume: "Lieu et date, une note, et une à trois cartes de signature.",
      neuf: function () {
        return { b: 'signatures', nb: '1',
          lieuDate: "Fait à Dakar, le " + U.dateLongue(U.isoDuJour(), true), note: "", reference: "",
          cartes: [
            { pour: "Pour Baobabs Basket Club", nom: "Antoine Jean Pierre Ndong", qualite: "Président", mention: "Signature et cachet du Président", encre: true },
            { pour: "Pour la seconde partie", nom: "", qualite: "", mention: "Signature et cachet", encre: false },
            { pour: "Le titulaire", nom: "", qualite: "", mention: "Lu et approuvé · Signature", encre: false }] };
      },
      reglages: [{ cle: 'nb', lab: "Signataires", type: 'choix', choix: ['1', '2', '3'] }],
      bloc: function (x, ch) {
        var n = Math.max(1, Math.min(3, parseInt(x.nb, 10) || 1)), cartes = [];
        for (var j = 0; j < n; j++) {
          var p = ch + 'cartes.' + j + '.', c = (x.cartes && x.cartes[j]) || {};
          cartes.push({ pour: '@' + p + 'pour', nom: '@' + p + 'nom', qualite: '@' + p + 'qualite',
                        mention: '@' + p + 'mention', signer: c.encre !== false, cacheter: c.encre !== false });
        }
        return { b: 'signatures',
                 gauche: { lieuDate: '@' + ch + 'lieuDate', note: '@' + ch + 'note', reference: '@' + ch + 'reference' },
                 cartes: cartes };
      } },


    { type: 'bandeau', nom: "Bandeau", famille: "Structure",
      resume: "Une bande pleine (vert, or, noir, clair) et un grand mot : convocation, communiqué.",
      neuf: function () { return { b: 'bandeau', ton: 'vert', etiquette: "Le club", texte: "Grand titre", sous: "", droite1: "", droite2: "" }; },
      reglages: [{ cle: 'ton', lab: "Couleur", type: 'choix', choix: ['vert', 'or', 'noir', 'clair'] }],
      bloc: function (x, ch) {
        return { b: 'bandeau', ton: '@' + ch + 'ton', etiquette: '@' + ch + 'etiquette', texte: '@' + ch + 'texte', sous: '@' + ch + 'sous',
                 droite: ['@' + ch + 'droite1', '@' + ch + 'droite2'] };
      } },

    { type: 'fronton', nom: "Fronton", famille: "Structure",
      resume: "L'en-tête et le grand titre en un seul bloc plein, blason en grand sur un disque cerclé d'or.",
      neuf: function () {
        return { b: 'fronton', ton: 'vert', drapeau: true,
                 nom: "BAOBABS BASKET CLUB", devise: "Grandir ici. Régner partout.",
                 meta1: "Dakar, le " + U.dateLongue(U.isoDuJour(), false), meta2: "Récépissé n° 8280",
                 etiquette: "Le club", texte: "Grand titre", sous: "",
                 droite1: "", droite2: "" };
      },
      reglages: [
        { cle: 'ton', lab: "Couleur", type: 'choix', choix: ['vert', 'noir', 'or'] },
        { cle: 'drapeau', lab: "Drapeau du Sénégal", type: 'bascule' }],
      bloc: function (x, ch) {
        return { b: 'fronton', ton: '@' + ch + 'ton', drapeau: '@' + ch + 'drapeau',
                 nom: '@' + ch + 'nom', devise: '@' + ch + 'devise',
                 meta: ['@' + ch + 'meta1', '@' + ch + 'meta2'],
                 etiquette: '@' + ch + 'etiquette', texte: '@' + ch + 'texte', sous: '@' + ch + 'sous',
                 droite: ['@' + ch + 'droite1', '@' + ch + 'droite2'] };
      } },

    { type: 'colonnes', nom: "Deux colonnes", famille: "Structure",
      resume: "Le texte à gauche, un panneau de chiffres à droite : la page d'un projet, d'une demande d'appui.",
      neuf: function () {
        return { b: 'colonnes', ton: 'or', poids: '62', titre: "Quelques chiffres", nb: 3,
                 texte: "Le texte de la colonne de gauche.",
                 cellules: [{ label: "Dates", valeur: "", sous: "" },
                            { label: "Lieu", valeur: "", sous: "" },
                            { label: "Délégation", valeur: "", sous: "" },
                            { label: "", valeur: "", sous: "" },
                            { label: "", valeur: "", sous: "" }] };
      },
      reglages: [
        { cle: 'ton', lab: "Couleur du panneau", type: 'choix', choix: ['or', 'vert', 'noir', 'clair', 'blanc'] },
        { cle: 'poids', lab: "Largeur du texte", type: 'choix', choix: ['70', '62', '55', '45'], duo: true },
        { cle: 'nb', lab: "Chiffres", type: 'choix', choix: ['1', '2', '3', '4', '5'], duo: true }],
      bloc: function (x, ch) {
        var n = Math.max(1, Math.min(5, parseInt(x.nb, 10) || 3)), cells = [];
        for (var j = 0; j < n; j++) {
          var c = (x.cellules && x.cellules[j]) || {};
          cells.push({ chemin: ch + 'cellules.' + j, label: c.label || '', valeur: c.valeur || '', sous: c.sous || '' });
        }
        return { b: 'colonnes', ton: '@' + ch + 'ton', poids: x.poids, titre: '@' + ch + 'titre',
                 gauche: [{ b: 'texte', texte: '@' + ch + 'texte' }],
                 droite: [{ b: 'reperes', pile: true, cellules: cells }] };
      } },

    { type: 'grille', nom: "Lignes à compléter", famille: "Cases",
      resume: "« Nom : ……… », « Né le : ……… » : des lignes pointillées, au clavier ou au stylo.",
      neuf: function () {
        return { b: 'grille', nb: 4, colonnes: 2, champs: [
          { label: "Nom", valeur: "" }, { label: "Prénom(s)", valeur: "" }, { label: "Né(e) le", valeur: "" }, { label: "Téléphone", valeur: "" }] };
      },
      reglages: [
        { cle: 'nb', lab: "Nombre de lignes", type: 'choix', choix: ['1', '2', '3', '4', '5', '6', '8', '10'] },
        { cle: 'colonnes', lab: "Colonnes", type: 'choix', choix: ['1', '2', '3'], duo: true }],
      bloc: function (x, ch) {
        return { b: 'grille', colonnes: '@' + ch + 'colonnes', champs: function () {
          var n = Math.max(1, Math.min(12, parseInt(x.nb, 10) || 4)), out = [];
          for (var j = 0; j < n; j++) {
            var c = (x.champs && x.champs[j]) || {};
            out.push({ label: c.label == null ? 'Libellé' : c.label, chemin: ch + 'champs.' + j + '.valeur', labelChemin: ch + 'champs.' + j + '.label', large: !!c.large });
          }
          return out;
        } };
      } },

    { type: 'cases', nom: "Cases à cocher", famille: "Cases",
      resume: "Des cases qui se cochent d'un clic sur la feuille, ou au stylo sur le papier.",
      neuf: function () {
        return { b: 'cases', nb: 3, enLigne: false, etiquette: "", cases: [
          { texte: "Première case", cochee: false }, { texte: "Deuxième case", cochee: false }, { texte: "Troisième case", cochee: false }] };
      },
      reglages: [
        { cle: 'nb', lab: "Nombre de cases", type: 'choix', choix: ['1', '2', '3', '4', '5', '6', '8'] },
        { cle: 'enLigne', lab: "Côte à côte", type: 'bascule', duo: true }],
      bloc: function (x, ch) {
        return { b: 'cases', enLigne: '@' + ch + 'enLigne', etiquette: '@' + ch + 'etiquette', cases: function () {
          var n = Math.max(1, Math.min(12, parseInt(x.nb, 10) || 3)), out = [];
          for (var j = 0; j < n; j++) {
            var c = (x.cases && x.cases[j]) || {};
            out.push({ texte: '@' + ch + 'cases.' + j + '.texte', chemin: ch + 'cases.' + j + '.cochee' });
          }
          return out;
        } };
      } },

    { type: 'signatureLibre', nom: "Boîte de signature vide", famille: "Structure",
      resume: "Un cadre vide pour un parent, un tiers : « Lu et approuvé », date, signature.",
      neuf: function () { return { b: 'signatureLibre', nb: 1, boites: [{ label: "Signature", mention: "Précédée de « Lu et approuvé »" }, { label: "Signature", mention: "" }] }; },
      reglages: [{ cle: 'nb', lab: "Nombre de boîtes", type: 'choix', choix: ['1', '2', '3'] }],
      bloc: function (x, ch) {
        return { b: 'signatureLibre', boites: function () {
          var n = Math.max(1, Math.min(3, parseInt(x.nb, 10) || 1)), out = [];
          for (var j = 0; j < n; j++) out.push({ label: '@' + ch + 'boites.' + j + '.label', mention: '@' + ch + 'boites.' + j + '.mention' });
          return out;
        } };
      } },

    { type: 'diplome', nom: "Cadre de certificat", famille: "Structure",
      resume: "Un cadre double or, le blason, un grand titre, le nom en évidence, deux signatures.",
      neuf: function () {
        return { b: 'diplome', titre: "Certificat", sous: "de participation", prelude: "est décerné à", nom: "", motif: "pour sa participation.",
                 date: "Fait à Dakar, le " + U.dateLongue(U.isoDuJour(), true), sign1: "Antoine Jean Pierre Ndong", qual1: "Président", sign2: "", qual2: "" };
      },
      reglages: [],
      bloc: function (x, ch) {
        return { b: 'diplome', titre: '@' + ch + 'titre', sous: '@' + ch + 'sous', prelude: '@' + ch + 'prelude', nom: '@' + ch + 'nom', motif: '@' + ch + 'motif', date: '@' + ch + 'date',
                 signatures: function () {
                   var s = [{ nom: '@' + ch + 'sign1', qualite: '@' + ch + 'qual1' }];
                   if (String(x.sign2 || '').trim()) s.push({ nom: '@' + ch + 'sign2', qualite: '@' + ch + 'qual2', signer: false });
                   return s;
                 } };
      } },

    { type: 'talon', nom: "Talon à détacher", famille: "Éléments",
      resume: "Une ligne de coupe et des cases : ce que le club garde d'un reçu, d'un bon.",
      neuf: function () { return { b: 'talon', nb: 4, etiquette: "Talon à conserver par le club", colonnes: [{ label: "N°", valeur: "" }, { label: "Date", valeur: "" }, { label: "Nom", valeur: "" }, { label: "Montant", valeur: "" }] }; },
      reglages: [{ cle: 'nb', lab: "Nombre de cases", type: 'choix', choix: ['2', '3', '4', '5', '6'] }],
      bloc: function (x, ch) {
        return { b: 'talon', etiquette: '@' + ch + 'etiquette', colonnes: function () {
          var n = Math.max(1, Math.min(6, parseInt(x.nb, 10) || 4)), out = [];
          for (var j = 0; j < n; j++) out.push({ label: '@' + ch + 'colonnes.' + j + '.label', valeur: '@' + ch + 'colonnes.' + j + '.valeur' });
          return out;
        } };
      } },

    { type: 'image', nom: "Image", famille: "Éléments",
      resume: "Une photo, un plan, un logo : déposée dans l'acte, largeur au choix.",
      neuf: function () { return { b: 'image', src: "", largeur: 60, calage: 'gauche', legende: "" }; },
      reglages: [
        { cle: 'src', lab: "Fichier image", type: 'image' },
        { cle: 'largeur', lab: "Largeur (mm)", type: 'texte', duo: true },
        { cle: 'calage', lab: "Calage", type: 'choix', choix: ['gauche', 'centre', 'droite'], duo: true }],
      bloc: function (x, ch) {
        return { b: 'image', src: '@' + ch + 'src', largeur: '@' + ch + 'largeur', calage: '@' + ch + 'calage',
                 legende: '@' + ch + 'legende' };
      } },

    { type: 'espace', nom: "Espace", famille: "Éléments",
      resume: "Un blanc d'une hauteur choisie, pour aérer.",
      neuf: function () { return { b: 'espace', hauteur: 12 }; },
      reglages: [{ cle: 'hauteur', lab: "Hauteur (points)", type: 'texte' }],
      bloc: function (x, ch) { return { b: 'espace', hauteur: '@' + ch + 'hauteur' }; } },

    { type: 'saut', nom: "Saut de page", famille: "Éléments",
      resume: "Ce qui suit commence sur une feuille neuve.",
      neuf: function () { return { b: 'saut' }; },
      reglages: [],
      bloc: function () { return { b: 'saut' }; } }
  ];

  /* ---- les tableaux préréglés : chacun ses colonnes, sa forme ---- */
  var TABLEAUX = [
    { type: 'tableau', nom: "Tableau : liste de personnes", famille: "Tableaux",
      resume: "Nom, qualité en pastille, pièce d'identité, téléphone.",
      colonnes: [
        { cle: 'nom', titre: "Nom et prénom(s)", poids: 50, forme: 'fort' },
        { cle: 'qualite', titre: "Qualité", poids: 30, forme: 'pastille', choix: ['Joueuse', 'Joueur', 'Coach', 'Dirigeant', 'Parent', 'Invité'] },
        { cle: 'piece', titre: "Passeport / CNI", poids: 34, forme: 'code' },
        { cle: 'telephone', titre: "Téléphone", poids: 28, forme: 'code' }] },
    { type: 'tableau', nom: "Tableau : émargement", famille: "Tableaux",
      resume: "Nom, qualité, présence, et une colonne vide pour signer.",
      colonnes: [
        { cle: 'nom', titre: "Nom et prénom(s)", poids: 46, forme: 'fort' },
        { cle: 'qualite', titre: "Qualité", poids: 26 },
        { cle: 'present', titre: "Présent(e)", poids: 18, align: 'centre', forme: 'pastille', choix: ['Oui', 'Non', 'Excusé(e)'] },
        { cle: 'signature', titre: "Signature", poids: 34 }],
      vide: 10, haut: true },
    { type: 'tableau', nom: "Tableau : devis ou dépenses", famille: "Tableaux",
      resume: "Libellé, quantité, prix unitaire, montant additionné.",
      colonnes: [
        { cle: 'libelle', titre: "Libellé", poids: 52, forme: 'fort' },
        { cle: 'quantite', titre: "Quantité", poids: 16, align: 'centre', forme: 'nombre' },
        { cle: 'pu', titre: "Prix unitaire", poids: 24, align: 'droite' },
        { cle: 'montant', titre: "Montant", poids: 26, align: 'droite', forme: 'nombre', total: true }] },
    { type: 'tableau', nom: "Tableau : classement", famille: "Tableaux",
      resume: "Équipe, joués, gagnés, perdus, points.",
      colonnes: [
        { cle: 'equipe', titre: "Équipe", poids: 54, forme: 'fort' },
        { cle: 'j', titre: "J", poids: 12, align: 'centre', forme: 'nombre' },
        { cle: 'g', titre: "G", poids: 12, align: 'centre', forme: 'nombre' },
        { cle: 'p', titre: "P", poids: 12, align: 'centre', forme: 'nombre' },
        { cle: 'pts', titre: "Pts", poids: 14, align: 'centre', forme: 'nombre' }] },
    { type: 'tableau', nom: "Tableau : programme", famille: "Tableaux",
      resume: "Heure, activité, lieu, responsable.",
      colonnes: [
        { cle: 'heure', titre: "Heure", poids: 16, align: 'centre', forme: 'code' },
        { cle: 'activite', titre: "Activité", poids: 50, forme: 'fort' },
        { cle: 'lieu', titre: "Lieu", poids: 30 },
        { cle: 'responsable', titre: "Responsable", poids: 30 }],
      numeroter: false },
    { type: 'tableau', nom: "Tableau : trois colonnes", famille: "Tableaux",
      resume: "Une grille nue, à renommer et à compléter.",
      colonnes: [
        { cle: 'col1', titre: "Colonne 1", poids: 40, forme: 'fort' },
        { cle: 'col2', titre: "Colonne 2", poids: 30 },
        { cle: 'col3', titre: "Colonne 3", poids: 30 }] }
  ];
  TABLEAUX.forEach(function (T) {
    var gabarit = T;
    T.neuf = function () {
      var source = id('t');
      return { b: 'tableau', source: source, titre: "", numeroter: gabarit.numeroter !== false, vide: gabarit.vide || 6,
               _table: { titre: gabarit.nom.replace(/^Tableau : (.)/, function (m, c) { return c.toUpperCase(); }), singulier: 'ligne',
                         colonnes: JSON.parse(JSON.stringify(gabarit.colonnes)), lignes: [] } };
    };
    T.reglages = [
      { cle: 'numeroter', lab: "Numéroter les lignes", type: 'bascule' },
      { cle: 'vide', lab: "Lignes vides quand la liste est vide", type: 'texte' }];
    T.bloc = function (x, ch) {
      return { b: 'tableau', source: x.source, titre: '@' + ch + 'titre',
               numeroter: x.numeroter !== false, vide: parseInt(x.vide, 10) || 0,
               tonPastille: function () { return 'ton-doux'; } };
    };
  });

  var CATALOGUE = PALETTE.concat(TABLEAUX);
  var PAR_TYPE = {};
  CATALOGUE.forEach(function (e) { PAR_TYPE[e.type] = PAR_TYPE[e.type] || e; });
  var PRETS = [
    /* ---- prêts à poser : des blocs déjà remplis avec ce que le club sait ---- */
    { type: 'entete', nom: "En-tête du club", famille: "Prêts à poser",
      resume: "Le blason, le nom, la devise, le drapeau, le récépissé et la date : en haut de la feuille.",
      neuf: function () {
        var C = G.club || {};
        return { b: 'entete', nom: (C.nom || "Baobabs Basket Club").toUpperCase(), devise: C.devise || "Grandir ici. Régner partout.",
                 ligne1: "Récépissé n° " + (C.recepisse || "8280"), ligne2: (C.ville || "Dakar") + ", le " + U.dateLongue(U.isoDuJour(), false), drapeau: true };
      },
      reglages: [{ cle: 'drapeau', lab: "Drapeau du Sénégal", type: 'bascule' }],
      bloc: function (x, ch) {
        return { b: 'entete', nom: '@' + ch + 'nom', devise: '@' + ch + 'devise',
                 droite: ['@' + ch + 'ligne1', '@' + ch + 'ligne2'], drapeau: '@' + ch + 'drapeau' };
      } },
    { type: 'signatures', nom: "Signature du président", famille: "Prêts à poser",
      resume: "« Fait à Dakar, le… », la carte du président avec son encre et le cachet.",
      neuf: function () {
        var C = G.club || {};
        return { b: 'signatures', nb: 1, lieuDate: "Fait à " + (C.ville || "Dakar") + ", le **" + U.dateLongue(U.isoDuJour(), true) + "**", note: "", reference: "",
                 cartes: [{ pour: "Pour " + (C.nom || "Baobabs Basket Club"), nom: C.president || "Antoine Jean Pierre Ndong", qualite: C.qualitePresident || "Président", mention: "Signature et cachet du Président", encre: true }] };
      },
      reglages: [{ cle: 'nb', lab: "Signataires", type: 'choix', choix: ['1', '2', '3'] }],
      bloc: function (x, ch) { return PAR_TYPE.signatures.bloc(x, ch); } },
    { type: 'signatures', nom: "Président et un second signataire", famille: "Prêts à poser",
      resume: "Deux cartes : le président avec l'encre, et une carte vierge pour l'autre partie.",
      neuf: function () {
        var C = G.club || {};
        return { b: 'signatures', nb: 2, lieuDate: "Fait à " + (C.ville || "Dakar") + ", le **" + U.dateLongue(U.isoDuJour(), true) + "**, en deux exemplaires", note: "", reference: "",
                 cartes: [{ pour: "Pour " + (C.nom || "Baobabs Basket Club"), nom: C.president || "Antoine Jean Pierre Ndong", qualite: C.qualitePresident || "Président", mention: "Signature et cachet du Président", encre: true },
                          { pour: "Pour la seconde partie", nom: "", qualite: "", mention: "Lu et approuvé · Signature", encre: false }] };
      },
      reglages: [{ cle: 'nb', lab: "Signataires", type: 'choix', choix: ['1', '2', '3'] }],
      bloc: function (x, ch) { return PAR_TYPE.signatures.bloc(x, ch); } },
    { type: 'tableau', nom: "Le staff", famille: "Prêts à poser",
      resume: "Nom, fonction, téléphone, e-mail : le bureau et les coachs, à compléter ou à coller.",
      neuf: function () {
        return { b: 'tableau', source: id('t'), titre: "", numeroter: true, vide: 6,
                 _table: { titre: "Le staff", singulier: "membre",
                           colonnes: [{ cle: 'nom', titre: "Nom et prénom(s)", poids: 44, forme: 'fort' },
                                      { cle: 'fonction', titre: "Fonction", poids: 30, forme: 'pastille', choix: ['Président', 'Vice-président', 'Secrétaire', 'Trésorier', 'Coach', 'Coach assistant', 'Médecin', 'Bénévole'] },
                                      { cle: 'telephone', titre: "Téléphone", poids: 26, forme: 'code' },
                                      { cle: 'email', titre: "E-mail", poids: 34, forme: 'code' }],
                           lignes: [{ nom: (G.club && G.club.president) || "Antoine Jean Pierre Ndong", fonction: "Président", telephone: (G.club && G.club.telephone) || "", email: (G.club && G.club.email) || "" }] } };
      },
      reglages: [{ cle: 'numeroter', lab: "Numéroter les lignes", type: 'bascule' }, { cle: 'vide', lab: "Lignes vides quand la liste est vide", type: 'texte' }],
      bloc: function (x, ch) { return PAR_TYPE.tableau.bloc(x, ch); } },
    { type: 'tableau', nom: "L'équipe (joueuses)", famille: "Prêts à poser",
      resume: "Nom, catégorie, poste, numéro de maillot, licence : la liste de l'équipe, à coller depuis l'admin.",
      neuf: function () {
        return { b: 'tableau', source: id('t'), titre: "", numeroter: true, vide: 12,
                 _table: { titre: "L'équipe", singulier: "joueuse",
                           colonnes: [{ cle: 'nom', titre: "Nom et prénom(s)", poids: 46, forme: 'fort' },
                                      { cle: 'categorie', titre: "Catégorie", poids: 20, forme: 'pastille', align: 'centre', choix: ['U12', 'U14', 'U16', 'U18', 'Senior'] },
                                      { cle: 'poste', titre: "Poste", poids: 22, align: 'centre' },
                                      { cle: 'maillot', titre: "N°", poids: 12, forme: 'nombre', align: 'centre' },
                                      { cle: 'licence', titre: "Licence", poids: 24, forme: 'code' }],
                           lignes: [] } };
      },
      reglages: [{ cle: 'numeroter', lab: "Numéroter les lignes", type: 'bascule' }, { cle: 'vide', lab: "Lignes vides quand la liste est vide", type: 'texte' }],
      bloc: function (x, ch) { return PAR_TYPE.tableau.bloc(x, ch); } },
    { type: 'grille', nom: "Les parents", famille: "Prêts à poser",
      resume: "Parent ou tuteur, lien, téléphone, adresse, personne à prévenir : des lignes à compléter.",
      neuf: function () {
        return { b: 'grille', nb: 6, colonnes: 2, champs: [
          { label: "Parent ou tuteur", valeur: "" }, { label: "Lien avec l'enfant", valeur: "" },
          { label: "Téléphone", valeur: "" }, { label: "E-mail", valeur: "" },
          { label: "Adresse", valeur: "", large: true }, { label: "À prévenir en urgence", valeur: "" }] };
      },
      reglages: [{ cle: 'nb', lab: "Nombre de lignes", type: 'choix', choix: ['1', '2', '3', '4', '5', '6', '8', '10'] }, { cle: 'colonnes', lab: "Colonnes", type: 'choix', choix: ['1', '2', '3'], duo: true }],
      bloc: function (x, ch) { return PAR_TYPE.grille.bloc(x, ch); } },
    { type: 'texte', nom: "Coordonnées du club", famille: "Prêts à poser",
      resume: "Nom, adresse, récépissé, téléphone, e-mail, site : un bloc de contact.",
      neuf: function () {
        var C = G.club || {};
        var l = [(C.nom || "Baobabs Basket Club"), C.adresse || "Sicap Baobab, Dakar, Sénégal", "Récépissé n° " + (C.recepisse || "8280"), C.telephone ? "Tél. " + C.telephone : "", C.email || "", C.site || "baobabsbasketclub.com"].filter(Boolean);
        return { b: 'texte', etiquette: "Le club", titre: "", texte: l.join("\n") };
      },
      reglages: [],
      bloc: function (x, ch) { return PAR_TYPE.texte.bloc(x, ch); } },
    { type: 'texte', nom: "Le président (présentation)", famille: "Prêts à poser",
      resume: "« Monsieur …, Président de …, agissant au nom et pour le compte du club » : la phrase qui ouvre un acte.",
      neuf: function () {
        var C = G.club || {};
        return { b: 'texte', etiquette: "", titre: "", texte: "Monsieur **" + (C.president || "Antoine Jean Pierre Ndong") + "**, " + (C.qualitePresident || "Président") + " de " + (C.nom || "Baobabs Basket Club") + ", agissant au nom et pour le compte du club, " };
      },
      reglages: [],
      bloc: function (x, ch) { return PAR_TYPE.texte.bloc(x, ch); } },
    { type: 'cases', nom: "Cachet et signature à apposer", famille: "Prêts à poser",
      resume: "Une liste à cocher : signé, cacheté, daté, copie remise.",
      neuf: function () { return { b: 'cases', nb: 4, enLigne: true, etiquette: "Avant de remettre l'acte", cases: [{ texte: "Signé", cochee: false }, { texte: "Cacheté", cochee: false }, { texte: "Daté", cochee: false }, { texte: "Copie remise", cochee: false }] }; },
      reglages: [{ cle: 'nb', lab: "Nombre de cases", type: 'choix', choix: ['1', '2', '3', '4', '5', '6', '8'] }, { cle: 'enLigne', lab: "Côte à côte", type: 'bascule', duo: true }],
      bloc: function (x, ch) { return PAR_TYPE.cases.bloc(x, ch); } },
  ];
  CATALOGUE = CATALOGUE.concat(PRETS);

  function entree(x) {
    /* un tableau instancié retrouve le gabarit par son type ; ses
       colonnes sont les siennes, pas celles du gabarit */
    return PAR_TYPE[x.b];
  }

  function articlesParDefaut() {
    return [
      { titre: "Objet", texte: "Le présent acte a pour objet " },
      { titre: "Dispositions", texte: "" },
      { titre: "Portée", texte: "Le présent acte est délivré pour servir et valoir ce que de droit." }
    ];
  }

  /* ================================================================ */
  G.modeles['acte-libre'] = {
    cle: 'acte-libre',
    nom: "Acte libre",
    famille: "Actes",
    prefixe: "AL",
    resume: "Une feuille vierge et une palette de blocs : composez, puis écrivez sur la page.",
    catalogue: CATALOGUE,
    libre: true,

    /* le formulaire : la palette, puis une section par tableau posé */
    sections: function (d) {
      var s = [{ titre: "Les blocs", ouvert: true, special: 'blocs' }];
      (d.blocs || []).forEach(function (x) {
        if (x.b === 'tableau' && x.source) {
          var t = d.tables && d.tables[x.source];
          s.push({ titre: (t && t.titre) || "Tableau", ouvert: false, special: 'table', source: x.source });
        }
      });
      if ((d.blocs || []).some(function (x) { return x.b === 'articles'; })) {
        s.push({ titre: "Les articles", ouvert: false, special: 'articles' });
      }
      s.push({ titre: "L'acte", ouvert: false, champs: [
        { cle: 'titre',    lab: "Intitulé (registre et nom du fichier)", type: 'texte' },
        { cle: 'numero',   lab: "Numéro",  type: 'texte', duo: true },
        { cle: 'dateActe', lab: "Fait le", type: 'date',  duo: true },
        { cle: 'avecSignature', lab: "Apposer la signature du président", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule' }
      ]});
      return s;
    },

    defauts: function () {
      var blocs = [PAR_TYPE.entete.neuf(), PAR_TYPE.titre.neuf(), PAR_TYPE.texte.neuf(), PAR_TYPE.signatures.neuf()];
      return {
        titre: "Acte libre", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar",
        avecSignature: true, avecCachet: true,
        blocs: blocs, articles: null, tables: {}
      };
    },

    articlesParDefaut: articlesParDefaut,

    controles: function (d) {
      var c = [];
      if (!(d.blocs || []).length) c.push({ n: 'erreur', t: 'La feuille est vide' });
      if (!(d.blocs || []).some(function (x) { return x.b === 'signatures'; })) c.push({ n: 'avert', t: 'Aucun bloc de signatures' });
      if (!(d.blocs || []).some(function (x) { return x.b === 'entete'; })) c.push({ n: 'avert', t: 'Pas d\'en-tête du club' });
      return c;
    },

    /* la page est la liste des blocs, rendue à chaque fois */
    page: function (d) {
      return (d.blocs || []).map(function (x, i) {
        var e = entree(x);
        return e ? e.bloc(x, 'blocs.' + i + '.') : null;
      }).filter(Boolean);
    },

    pied: function (d) {
      return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280",
              String(d.titre || 'Acte') + (d.numero ? " n° " + d.numero : "")];
    },

    fichier: function (d) {
      return String(d.titre || 'Acte').slice(0, 60) + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : "")
           + " - BAOBABS BASKET CLUB";
    }
  };

})(window.BaobabsGreffe);
