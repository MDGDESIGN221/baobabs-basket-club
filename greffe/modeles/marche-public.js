/* =====================================================================
   MODÈLE : CONTRAT DE MARCHÉ PUBLIC
   ---------------------------------------------------------------------
   Pas un acte du club : le contrat qu'une autorité contractante (un
   projet de l'État, un ministère) passe avec un fournisseur après une
   demande de renseignements et de prix (DRP). Il garde l'allure des
   pièces administratives : Times, un en-tête en trois colonnes (la
   République, le ministère, le bailleur), une page de garde, des
   clauses numérotées, deux signatures côte à côte. Ni blason, ni
   filigrane du club, ni pied de page, ni l'encre et le cachet du
   président : avecSignature et avecCachet restent à faux.

   VIERGE PAR CONSTRUCTION. Chaque valeur est une donnée ; vide, elle
   s'imprime en pointillé, à écrire sur la feuille ou au stylo. Ce qui
   est propre à un projet (son nom, ses logos, son bailleur) ne vit pas
   ici, le dépôt étant public : c'est l'acte qui le porte, en base,
   rangé dans son dossier, et « Repartir de celui-ci » en tire un neuf.

   Sous les signatures, la page reste blanche : les cachets et la
   mention d'enregistrement s'apposent sur l'exemplaire signé, par
   ceux qui les détiennent. Le Greffe ne les dessine pas.

   Les blocs de ce contrat sont déclarés ici, dans B.rendus : ils ne
   servent qu'à lui, et blocs.js reste la feuille commune aux actes du
   club.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util, B = G.blocs;
  var NB = ' ';

  function v(x) { return String(x == null ? '' : x).trim(); }

  /* Une valeur de l'acte, modifiable sur la feuille. Vide, elle devient
     un pointillé : court, moyen, long, ou « fin » (jusqu'au bout de la
     ligne, dans une ligne en flex). */
  function champ(d, cle, largeur, classe) {
    var t = v(d[cle]);
    return '<span class="mp-v' + (t ? '' : ' mp-blanc mp-' + (largeur || 'moyen')) + (classe ? ' ' + classe : '')
      + '" data-edit="' + cle + '">' + U.enLigne(t) + '</span>';
  }
  /* Un libellé du modèle (« NINEA : », « Pour le Fournisseur ») : il
     s'écrit aussi sur la feuille, dans les surcharges fixes du bloc. */
  function lib(d, ctx, cle, texte, classe, tag) {
    return B.ligne(tag || 'span', classe || 'mp-k', B.slot({ t: texte }, 't', d, ctx, '', cle));
  }

  /* ---- les montants ----
     Le HT se tape ; tant qu'on ne les écrit pas, le reste s'en déduit :
     TTC = HT + 18 %, part du bailleur = HT, part de l'État = TTC - HT.
     Un montant écrit l'emporte toujours (marché exonéré, part partagée). */
  function n(x) { return Math.round(U.montant(x)); }
  function chiffres(x) { return U.nombre(x).replace(/ /g, NB); }
  function montants(d) {
    var ht = n(d.montantHT), ttc = n(d.montantTTC) || (ht ? Math.round(ht * 1.18) : 0);
    return { ht: ht, ttc: ttc, bailleur: n(d.partBailleur) || ht, etat: n(d.partEtat) || (ht && ttc > ht ? ttc - ht : 0) };
  }
  function somme(d, cle, calcul) {
    var tape = v(d[cle]);
    if (tape) return '<span class="mp-v" data-edit="' + cle + '">' + U.enLigne(n(tape) ? chiffres(n(tape)) : tape) + '</span>';
    if (calcul) return '<span class="mp-v mp-calc" data-edit="' + cle + '" title="Calculé : écrire un montant pour le remplacer">' + chiffres(calcul) + '</span>';
    return '<span class="mp-v mp-blanc mp-court" data-edit="' + cle + '"></span>';
  }

  /* Un logo : un clic dépose une image (data-photo). Sans image, un cadre
     dit où il ira, à l'écran seulement : la feuille imprimée reste nue. */
  function logo(d, cle, classe, nom) {
    var src = v(d[cle]);
    return '<span class="mp-logo ' + classe + (src ? '' : ' mp-logo-vide') + '" data-photo="' + cle + '" title="Cliquer pour '
      + (src ? 'changer' : 'déposer') + ' ' + nom + '">'
      + (src ? '<img src="' + U.ech(src) + '" alt="">' : '<i>' + U.ech(nom.charAt(0).toUpperCase() + nom.slice(1)) + '</i>') + '</span>';
  }

  var PUCES = [
    ['delai', "Délai d'exécution"], ['dateSouscription', "Date de souscription"],
    ['dateApprobation', "Date d'approbation"], ['dateNotification', "Date de notification"],
    ['financement', "Financement"], ['referenceProjet', "Référence"], ['accordPret', "Accord de prêt"]];
  var IDENTITE = [['ninea', "NINEA"], ['rc', "RC"], ['compte', "Numéro Compte Bancaire"], ['banque', "Banque"]];

  /* ==================================================================
     LES BLOCS DU CONTRAT
     ================================================================== */

  /* L'en-tête : trois colonnes séparées d'un filet, comme sur les pièces
     de l'administration. */
  B.rendus.mpEntete = function (cfg, d, ctx) {
    return '<header class="mp-tete">'
      + '<div class="mp-col">'
      +   (d.drapeau === false ? '' : '<span class="mp-drapeau">' + B.DRAPEAU + '</span>')
      +   champ(d, 'pays', 'moyen', 'mp-pays') + champ(d, 'devise', 'moyen', 'mp-devise')
      + '</div>'
      + '<div class="mp-col">'
      +   champ(d, 'ministere', 'long', 'mp-min') + '<i class="mp-filet"></i>'
      +   champ(d, 'structure', 'long', 'mp-struct') + champ(d, 'unite', 'moyen', 'mp-unite')
      + '</div>'
      + '<div class="mp-col">'
      +   champ(d, 'bailleur', 'moyen', 'mp-bail') + logo(d, 'logoBailleur', 'mp-logo-bail', 'le logo du bailleur')
      + '</div>'
      + '</header>';
  };

  /* La page de garde, d'un seul tenant : elle ne se coupe jamais. */
  B.rendus.mpGarde = function (cfg, d, ctx) {
    var m = montants(d);
    var identite = IDENTITE.map(function (c) {
      return '<div class="mp-l">' + lib(d, ctx, c[0], c[1] + NB + ':') + champ(d, c[0], 'fin') + '</div>';
    }).join('');
    var puces = PUCES.map(function (c) {
      return '<div class="mp-l mp-puce">' + lib(d, ctx, c[0], c[1] + NB + ':') + champ(d, c[0], 'fin') + '</div>';
    }).join('');
    return '<section class="mp-garde avoid">'
      + champ(d, 'projet', 'long', 'mp-projet')
      + logo(d, 'logoProjet', 'mp-logo-projet', 'le logo du projet')
      + '<div class="mp-cadre">' + lib(d, ctx, 'intro', "Contrat relatif à", 'mp-k-cadre') + ' '
      +   champ(d, 'objet', 'long') + ' ' + champ(d, 'pourCompte', 'long') + '</div>'
      + '<div class="mp-ref">' + lib(d, ctx, 'ref', "DRP N°", 'mp-k-ref') + NB + champ(d, 'reference', 'moyen') + '</div>'
      + '<div class="mp-parties">'
      +   lib(d, ctx, 'entre', "Entre", 'mp-entre', 'div')
      +   '<div class="mp-partie">' + champ(d, 'autorite', 'long', 'mp-plein') + '</div>'
      +   lib(d, ctx, 'et', "Et", 'mp-entre', 'div')
      +   '<div class="mp-partie">' + champ(d, 'fournisseur', 'long', 'mp-plein') + '</div>'
      +   '<div class="mp-partie">' + lib(d, ctx, 'tel', "Tél" + NB + ":") + ' ' + champ(d, 'telephone', 'moyen')
      +     '<span class="mp-sep"></span>' + lib(d, ctx, 'email', "Email" + NB + ":") + ' ' + champ(d, 'email', 'long') + '</div>'
      + '</div>'
      + '<div class="mp-bloc-l">' + identite + '</div>'
      + '<div class="mp-bloc-l mp-montants">'
      +   '<div class="mp-l-flot">' + lib(d, ctx, 'montant1', "Montant du contrat" + NB + ":", 'mp-k-s') + ' '
      +     somme(d, 'montantHT', 0) + lib(d, ctx, 'ht1', NB + "F CFA HTVA soit" + NB, 'mp-unite-m') + somme(d, 'montantTTC', m.ttc)
      +     lib(d, ctx, 'ttc1', NB + "F CFA TTC", 'mp-unite-m') + '</div>'
      +   '<div class="mp-l-flot">' + lib(d, ctx, 'montant2', "Montant du contrat" + NB + ":", 'mp-k-s') + ' '
      +     somme(d, 'montantTTC', m.ttc) + lib(d, ctx, 'ttc2', NB + "F CFA TTC", 'mp-fort') + '</div>'
      +   '<div class="mp-carre">' + champ(d, 'partBailleurLib', 'court', 'mp-fort') + lib(d, ctx, 'deux1', NB + ":" + NB, 'mp-fort')
      +     somme(d, 'partBailleur', m.bailleur) + lib(d, ctx, 'ht2', NB + "F CFA HTVA", 'mp-fort') + '</div>'
      +   '<div class="mp-carre">' + champ(d, 'partEtatLib', 'court', 'mp-fort') + lib(d, ctx, 'deux2', NB + ":" + NB, 'mp-fort')
      +     somme(d, 'partEtat', m.etat) + lib(d, ctx, 'taxes', NB + "F CFA/Taxes", 'mp-fort') + '</div>'
      + '</div>'
      + '<div class="mp-bloc-l mp-puces">' + puces + '</div>'
      + '<div class="mp-mois">' + champ(d, 'moisAnnee', 'moyen') + '</div>'
      + '</section>';
  };

  /* Les clauses : « 6. » dans la marge, le texte justifié en retrait.
     .arts et .art sont les noms que la mise en pages sait couper, une
     clause à la fois ; leur allure du club est défaite dans css(). */
  B.rendus.mpClauses = function (cfg, d, ctx) {
    var arts = (d.articles && d.articles.length) ? d.articles : articlesParDefaut(d);
    var depart = parseInt(d.debutClauses, 10);
    if (!(depart >= 1)) depart = 1;
    return '<section class="arts mp-clauses">' + arts.map(function (a, i) {
      var ch = 'articles.' + i + '.';
      return '<article class="art avoid mp-clause"><span class="mp-num">' + (depart + i) + '.</span><div class="mp-corps">'
        + (v(a.titre) ? '<div class="mp-titre-clause" data-edit="' + ch + 'titre">' + U.enLigne(a.titre) + '</div>' : '')
        + '<div class="txt" data-edit="' + ch + 'texte">' + U.paragraphes(a.texte || '') + '</div>'
        + '</div></article>';
    }).join('') + '</section>';
  };

  B.rendus.mpFormule = function (cfg, d, ctx) {
    return '<p class="mp-formule" data-edit="formule">' + U.enLigne(d.formule || '') + '</p>';
  };

  /* Deux signatures côte à côte, chacune centrée sur sa colonne : la
     partie, la place de la signature et du cachet, le nom, la qualité. */
  B.rendus.mpSignatures = function (cfg, d, ctx) {
    function colonne(pour, nom, qualite) {
      return '<div class="mp-signe">' + champ(d, pour, 'moyen', 'mp-pour')
        + '<div class="mp-encre"></div>'
        + champ(d, nom, 'long', 'mp-nom') + champ(d, qualite, 'moyen', 'mp-qualite') + '</div>';
    }
    return '<section class="mp-signes avoid">'
      + colonne('pourAutorite', 'signAutoriteNom', 'signAutoriteQualite')
      + colonne('pourFournisseur', 'signFournisseurNom', 'signFournisseurQualite')
      + '</section>';
  };

  function articlesParDefaut() {
    return [
      { titre: "", texte: "Les frais d'enregistrement et de timbre sont à la charge du Fournisseur conformément à la réglementation en vigueur." },
      { titre: "", texte: "Tout différend qui ne pourrait être réglé à l'amiable, sera soumis au Comité de Règlement des Différends de l'Autorité de Régulation de la Commande Publique (ARCOP). À défaut, le litige sera soumis au Tribunal régional de Dakar compétent en la matière." }
    ];
  }

  G.modeles['marche-public'] = {
    cle: 'marche-public',
    nom: "Contrat de marché public",
    famille: "Marchés publics",
    prefixe: "MP",
    resume: "Le contrat d'une autorité contractante avec son fournisseur : page de garde, clauses numérotées, deux signatures. Vierge, à l'allure administrative.",

    sections: [
      { titre: "L'en-tête", ouvert: false, champs: [
        { cle: 'pays',      lab: "Pays", type: 'texte', duo: true },
        { cle: 'devise',    lab: "Devise", type: 'texte', duo: true },
        { cle: 'drapeau',   lab: "Le drapeau au-dessus du pays", type: 'bascule' },
        { cle: 'ministere', lab: "Ministère de tutelle", type: 'texte' },
        { cle: 'structure', lab: "Structure", type: 'texte', duo: true },
        { cle: 'unite',     lab: "Service", type: 'texte', duo: true, aide: "« Unité de gestion du projet »" },
        { cle: 'bailleur',  lab: "Bailleur (en toutes lettres)", type: 'texte' },
        { cle: 'logoBailleur', lab: "Logo du bailleur", type: 'image', aide: "Il se dépose aussi d'un clic sur la feuille." }
      ]},
      { titre: "La page de garde", ouvert: true, champs: [
        { cle: 'projet',     lab: "Projet", type: 'texte', aide: "Le titre au-dessus du logo." },
        { cle: 'logoProjet', lab: "Logo du projet", type: 'image' },
        { cle: 'objet',      lab: "Contrat relatif à", type: 'texte', aide: "« l'acquisition de matériel audiovisuel »" },
        { cle: 'pourCompte', lab: "Pour le compte de", type: 'texte', aide: "La fin de la phrase encadrée, avec son point." },
        { cle: 'reference',  lab: "N° de la DRP", type: 'texte', duo: true },
        { cle: 'moisAnnee',  lab: "Mois et année", type: 'texte', duo: true, aide: "En bas à droite : « Octobre 2026 »" }
      ]},
      { titre: "Les parties", ouvert: true, champs: [
        { cle: 'autorite',    lab: "L'autorité contractante", type: 'texte' },
        { cle: 'fournisseur', lab: "Le fournisseur, son adresse", type: 'texte' },
        { cle: 'telephone',   lab: "Téléphone", type: 'texte', duo: true },
        { cle: 'email',       lab: "Email", type: 'texte', duo: true },
        { cle: 'ninea',       lab: "NINEA", type: 'texte', duo: true },
        { cle: 'rc',          lab: "RC", type: 'texte', duo: true },
        { cle: 'compte',      lab: "Numéro de compte bancaire", type: 'texte', duo: true },
        { cle: 'banque',      lab: "Banque", type: 'texte', duo: true }
      ]},
      { titre: "Les montants", ouvert: false, champs: [
        { cle: 'montantHT',  lab: "Montant HTVA (F CFA)", type: 'texte', duo: true },
        { cle: 'montantTTC', lab: "Montant TTC (F CFA)", type: 'texte', duo: true, aide: "Vide : HT + 18 %." },
        { cle: 'partBailleurLib', lab: "Première part : qui", type: 'texte', duo: true, aide: "« BOAD »" },
        { cle: 'partBailleur',    lab: "Montant HTVA", type: 'texte', duo: true, aide: "Vide : le HT." },
        { cle: 'partEtatLib',     lab: "Seconde part : qui", type: 'texte', duo: true },
        { cle: 'partEtat',        lab: "Montant des taxes", type: 'texte', duo: true, aide: "Vide : TTC - HT." }
      ]},
      { titre: "Les conditions", ouvert: false, champs: [
        { cle: 'delai',            lab: "Délai d'exécution", type: 'texte', aide: "« Quinze (15) jours »" },
        { cle: 'dateSouscription', lab: "Date de souscription", type: 'texte', duo: true },
        { cle: 'dateApprobation',  lab: "Date d'approbation", type: 'texte', duo: true },
        { cle: 'dateNotification', lab: "Date de notification", type: 'texte', duo: true },
        { cle: 'accordPret',       lab: "Accord de prêt", type: 'texte', duo: true },
        { cle: 'financement',      lab: "Financement", type: 'texte' },
        { cle: 'referenceProjet',  lab: "Référence", type: 'texte' }
      ]},
      { titre: "Les clauses", ouvert: false, special: 'articles' },
      { titre: "La fin du contrat", ouvert: false, champs: [
        { cle: 'debutClauses', lab: "Numéro de la première clause", type: 'texte', duo: true, aide: "6 si les clauses 1 à 5 sont sur d'autres pages." },
        { cle: 'formule',      lab: "La phrase avant les signatures", type: 'zone' }
      ]},
      { titre: "Les signataires", ouvert: false, champs: [
        { cle: 'pourAutorite',        lab: "Première colonne", type: 'texte' },
        { cle: 'signAutoriteNom',     lab: "Nom", type: 'texte', duo: true },
        { cle: 'signAutoriteQualite', lab: "Qualité", type: 'texte', duo: true },
        { cle: 'pourFournisseur',        lab: "Seconde colonne", type: 'texte' },
        { cle: 'signFournisseurNom',     lab: "Nom", type: 'texte', duo: true },
        { cle: 'signFournisseurQualite', lab: "Qualité", type: 'texte', duo: true }
      ]}
    ],

    defauts: function () {
      return {
        titre: "Contrat de marché public", numero: "", dateActe: U.isoDuJour(),
        pays: "République du Sénégal", devise: "Un Peuple - Un But - Une Foi", drapeau: true,
        ministere: "", structure: "", unite: "", bailleur: "", logoBailleur: "",
        projet: "", logoProjet: "", objet: "", pourCompte: "", reference: "", moisAnnee: "",
        autorite: "", fournisseur: "", telephone: "", email: "", ninea: "", rc: "", compte: "", banque: "",
        montantHT: "", montantTTC: "", partBailleurLib: "", partBailleur: "", partEtatLib: "État", partEtat: "",
        delai: "", dateSouscription: "", dateApprobation: "", dateNotification: "",
        financement: "", referenceProjet: "", accordPret: "",
        articles: null, debutClauses: "1",
        formule: "LES PARTIES au contrat ont signé le marché en conformité avec les lois de leurs pays respectifs, les jours et années mentionnées ci-dessous",
        pourAutorite: "Pour l'Autorité contractante", signAutoriteNom: "", signAutoriteQualite: "",
        pourFournisseur: "Pour le Fournisseur", signFournisseurNom: "", signFournisseurQualite: "",
        avecSignature: false, avecCachet: false, tables: {}
      };
    },
    articlesParDefaut: articlesParDefaut,

    /* Un modèle vierge ne bloque rien : il signale ce qui reste à écrire. */
    controles: function (d) {
      var c = [], m = montants(d);
      if (!v(d.fournisseur)) c.push({ n: 'avert', t: 'Le fournisseur n\'est pas renseigné' });
      if (!m.ht) c.push({ n: 'avert', t: 'Pas de montant HTVA' });
      if (n(d.montantHT) && n(d.montantTTC) && Math.abs(n(d.montantTTC) - Math.round(n(d.montantHT) * 1.18)) > 1) {
        c.push({ n: 'avert', t: 'Le TTC ne fait pas HT + 18 % : marché exonéré ?' });
      }
      var depart = parseInt(d.debutClauses, 10);
      if (depart > 1) c.push({ n: 'avert', t: 'Les clauses commencent à ' + depart + ' : les clauses 1 à ' + (depart - 1) + ' manquent' });
      return c;
    },

    page: [
      { b: 'mpEntete', nom: "En-tête administratif" },
      { b: 'mpGarde', nom: "Page de garde" },
      { b: 'saut' },
      { b: 'mpClauses', nom: "Clauses" },
      { b: 'mpFormule', nom: "Formule finale" },
      { b: 'mpSignatures', nom: "Signatures" }
    ],

    /* L'allure administrative : elle défait ce que la feuille du club pose
       sur tous les actes (marges, Inter, blason en filigrane, articles
       numérotés en vert), sans toucher à blocs.js. */
    css: function () {
      return [
        ".page{ padding:14mm 19mm 14mm 21mm; }",
        ".page .corps{ height:calc(297mm - 14mm - 14mm - 1mm); }",
        ".wm .wm-blason{ display:none; }",
        "body{ font-family:'Times New Roman',Times,'Liberation Serif',serif; font-size:11pt; line-height:1.28; color:#111; }",
        "strong,b{ color:#111; font-weight:700; }",
        ".bloc + .bloc{ margin-top:0; }",
        ".mp-v{ min-height:1em; }",
        /* les blancs : un pointillé, à écrire sur la feuille ou au stylo */
        ".mp-blanc{ display:inline-block; vertical-align:baseline; height:1.02em; border-bottom:.8pt dotted #444; }",
        ".mp-court{ min-width:26mm; } .mp-moyen{ min-width:44mm; } .mp-long{ min-width:78mm; }",
        ".mp-fin{ flex:1 1 auto; min-width:30mm; }",
        "@media screen{ .mp-calc{ background:rgba(193,164,98,.16); border-radius:1.5pt; } }",
        /* ---- l'en-tête ---- */
        ".mp-tete{ display:grid; grid-template-columns:29fr 44fr 27fr; align-items:stretch; text-align:center;",
        "  text-transform:uppercase; line-height:1.22; color:#111; }",
        ".mp-col{ display:flex; flex-direction:column; align-items:center; padding:0 2.6mm; min-height:19mm; }",
        ".mp-col + .mp-col{ border-left:.7pt solid #222; }",
        ".mp-col .mp-blanc{ min-width:30mm; }",
        /* Maj+Entrée sur la feuille coupe la ligne où on veut : « MINISTÈRE DES
           TÉLÉCOMMUNICATIONS », puis « ET DU NUMÉRIQUE » */
        ".mp-col .mp-v{ white-space:pre-line; }",
        ".mp-drapeau{ display:block; width:10.5mm; margin-bottom:1.3mm; }",
        ".mp-drapeau svg{ display:block; width:100%; height:auto; }",
        ".mp-pays{ font-weight:700; font-size:7.1pt; letter-spacing:.02em; }",
        ".mp-devise{ font-size:5.6pt; margin-top:.7mm; letter-spacing:.02em; }",
        ".mp-min{ font-weight:700; font-size:6.8pt; letter-spacing:.015em; }",
        ".mp-filet{ display:block; width:58%; margin:1.3mm auto 1.1mm; border-top:.6pt solid #222; }",
        ".mp-struct{ font-weight:700; font-size:6.5pt; letter-spacing:.015em; }",
        ".mp-unite{ font-size:5.1pt; margin-top:.5mm; letter-spacing:.03em; }",
        ".mp-bail{ font-size:6.1pt; letter-spacing:.015em; }",
        /* ---- les logos ---- */
        ".mp-logo{ display:flex; align-items:center; justify-content:center; cursor:pointer; }",
        ".mp-logo img{ display:block; max-width:100%; max-height:100%; object-fit:contain; }",
        ".mp-logo-bail{ height:12.5mm; width:26mm; margin-top:1.4mm; }",
        ".mp-logo-projet{ height:24mm; width:66mm; margin:3.2mm auto 0; }",
        ".mp-logo-vide{ border:1px dashed #b9bdb9; border-radius:2pt; color:#9aa09b; }",
        ".mp-logo-vide i{ font-style:normal; font-family:Arial,sans-serif; font-size:6pt; letter-spacing:.06em; text-transform:none; }",
        "@media print{ .mp-logo-vide{ border-color:transparent; } .mp-logo-vide i{ display:none; } }",
        /* ---- la page de garde ---- */
        ".mp-garde{ padding:0 1mm; }",
        ".mp-projet{ display:block; text-align:center; font-weight:700; font-size:12pt; margin-top:7mm; }",
        ".mp-projet.mp-blanc{ display:block; width:110mm; margin-left:auto; margin-right:auto; }",
        ".mp-cadre{ width:152mm; margin:6mm auto 0; padding:3.4mm 6mm 3.8mm; border:1.3pt solid #111; border-radius:3.2mm;",
        "  box-shadow:1.3mm 1.3mm 0 #8f8f8f; text-align:center; font-weight:700; font-size:13.5pt; line-height:1.32; }",
        ".mp-ref{ text-align:center; font-size:12pt; margin-top:5.5mm; letter-spacing:.01em; }",
        ".mp-parties{ margin-top:6mm; font-weight:700; }",
        ".mp-entre{ font-weight:700; margin-top:3.4mm; }",
        ".mp-entre:first-child{ margin-top:0; }",
        ".mp-partie{ margin-top:2.6mm; line-height:1.36; }",
        ".mp-partie .mp-k{ font-weight:700; }",
        ".mp-plein.mp-blanc{ display:block; width:100%; }",
        ".mp-sep{ display:inline-block; width:9mm; }",
        ".mp-bloc-l{ margin-top:6.5mm; }",
        ".mp-l{ display:flex; align-items:baseline; gap:1.6mm; font-weight:700; margin-top:1.1mm; }",
        ".mp-l:first-child{ margin-top:0; }",
        ".mp-l .mp-k{ flex:0 0 auto; }",
        ".mp-l-flot{ margin-top:1.4mm; } .mp-l-flot:first-child{ margin-top:0; }",
        ".mp-k-s{ font-weight:700; text-decoration:underline; text-underline-offset:1.5pt; }",
        ".mp-fort{ font-weight:700; }",
        ".mp-l-flot:nth-child(2) .mp-v{ font-weight:700; }",
        ".mp-carre{ position:relative; margin:1.3mm 0 0 22mm; padding-left:6mm; }",
        ".mp-carre::before{ content:''; position:absolute; left:0; top:.42em; width:1.7mm; height:1.7mm; background:#111; }",
        ".mp-carre .mp-v{ font-weight:700; }",
        ".mp-puce{ position:relative; padding-left:7mm; margin-left:4mm; }",
        ".mp-puce::before{ content:''; position:absolute; left:0; top:.45em; width:1.6mm; height:1.6mm; border-radius:50%; background:#111; }",
        ".mp-mois{ text-align:right; font-weight:700; font-style:italic; margin-top:7mm; }",
        /* ---- les clauses : l'allure du club défaite ---- */
        ".arts.mp-clauses{ border-top:0; }",
        ".art.mp-clause{ display:flex; padding:0; border-bottom:0; }",
        ".art.mp-clause + .art.mp-clause{ margin-top:4.2mm; }",
        ".mp-num{ flex:0 0 13mm; padding-left:4mm; }",
        ".mp-corps{ flex:1; text-align:justify; }",
        ".mp-corps p{ max-width:none; margin-bottom:2.2mm; }",
        ".mp-titre-clause{ font-weight:700; margin-bottom:1mm; }",
        ".mp-formule{ margin-top:7mm; line-height:1.32; }",
        /* ---- les signatures ---- */
        ".mp-signes{ display:flex; justify-content:space-between; gap:12mm; margin-top:7.5mm; }",
        ".mp-signe{ display:flex; flex-direction:column; align-items:center; text-align:center; width:76mm; }",
        ".mp-signe:last-child{ width:68mm; }",
        ".mp-pour{ font-weight:700; text-decoration:underline; text-underline-offset:1.5pt; }",
        ".mp-encre{ height:36mm; }",
        ".mp-nom{ font-weight:700; }",
        ".mp-signe .mp-long{ min-width:62mm; }",
        ".mp-qualite{ margin-top:.6mm; }"
      ].join('\n');
    },

    pied: function () { return []; },
    fichier: function (d) {
      return ("Contrat de marché" + (v(d.reference) ? " " + v(d.reference) : "") + (v(d.fournisseur) ? " - " + U.sansMarques(d.fournisseur) : ""))
        .replace(/[\\/:*?"<>|]/g, '-').slice(0, 90);
    }
  };
})(window.BaobabsGreffe);
