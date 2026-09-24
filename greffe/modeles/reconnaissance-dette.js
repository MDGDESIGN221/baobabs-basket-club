/* =====================================================================
   MODÈLE : RECONNAISSANCE DE DETTE
   ---------------------------------------------------------------------
   Le club emprunte : la salle où il joue, un partenaire, un membre
   avance une somme pour boucler un déplacement. Le débiteur reconnaît
   l'avoir reçue à titre de prêt, dit à quoi elle sert, et s'engage à la
   rendre avant une date. La somme s'écrit UNE fois, en chiffres : les
   lettres, l'encadré et la mention « bon pour » en sortent, la feuille
   ne peut donc pas porter deux montants différents. Le débiteur signe
   (l'encre et le cachet du président), le créancier signe à côté, au
   stylo ; le lieu et la date peuvent rester en blanc jusque-là.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;
  var NB = ' ';
  var BLANC = "……………………………";

  /* « du Complexe », « de la Société », « de l'Association », « de
     Monsieur … » : la forme dépend du nom, elle se choisit une fois. */
  var ARTICLES = ["du … / au …", "de la … / à la …", "de l'… / à l'…", "de … / à …"];
  var FORMES = [["du ", "au "], ["de la ", "à la "], ["de l'", "à l'"], ["de ", "à "]];

  function v(x, repli) { return String(x || '').trim() || repli; }
  function fem(d) { return /^Madame/i.test(String(d.genre || '')); }
  function forme(d) { var i = ARTICLES.indexOf(d.creancierArticle); return FORMES[i < 0 ? 0 : i]; }
  function montantDe(d) { return Math.round(U.montant(d.montant)); }
  function chiffres(d) {
    var n = montantDe(d);
    return (n > 0 ? U.nombre(n).replace(/ /g, NB) : "………………") + NB + "FCFA";
  }
  /* les lettres tapées à la main l'emportent, sans « francs CFA » en double */
  function lettres(d) {
    var l = v(d.montantLettres, "").replace(/\s*(francs?\s*CFA|F\s*CFA|FCFA)\s*\.?$/i, '');
    return l || U.enLettres(montantDe(d));
  }
  function somme(d) {
    var l = lettres(d);
    return (l ? l.charAt(0).toUpperCase() + l.slice(1) : BLANC) + " francs CFA (" + chiffres(d) + ").";
  }
  /* « 1er octobre », pas « 1 octobre » */
  function dateL(iso, avecJour) {
    return U.dateLongue(iso, avecJour).replace(/(^|\s)1 (?=\D)/, function (m, avant) { return avant + '1er '; });
  }
  function duMois(iso) {
    var m = U.dateLongue(iso, false).replace(/^\d+\s+/, '');
    return (/^[aeiouyàâéèêîôû]/i.test(m) ? "d'" : "de ") + m;
  }
  function lieuDate(d) {
    if (d.lieuDateEnBlanc) {
      var x = U.dateDe(d.dateActe) || new Date();
      return 'Fait à <span class="a-remplir long"></span>, le <span class="a-remplir"></span> / '
        + '<span class="a-remplir"></span> / ' + x.getFullYear() + '.';
    }
    return "Fait à " + U.ech(d.lieu) + ", le <b>" + dateL(d.dateActe, true) + "</b>.";
  }

  G.modeles['reconnaissance-dette'] = {
    cle: 'reconnaissance-dette',
    nom: "Reconnaissance de dette",
    famille: "Finances",
    prefixe: "RD",
    resume: "Une somme reçue à titre de prêt, en chiffres et en lettres, et la date où elle sera rendue ; le débiteur et le créancier signent.",

    sections: [
      { titre: "La somme", ouvert: true, champs: [
        { cle: 'numero',   lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe', lab: "Établie le", type: 'date', duo: true },
        { cle: 'montant',  lab: "Montant (FCFA)", type: 'texte', duo: true, aide: "En chiffres : 200 000" },
        { cle: 'montantLettres', lab: "En toutes lettres", type: 'texte', duo: true, aide: "Vide : écrit d'après le montant." },
        { cle: 'objet',    lab: "Remise afin de", type: 'zone', aide: "« compléter les frais liés à la tournée internationale de Baobabs Basket Club »" }
      ]},
      { titre: "Le remboursement", ouvert: true, champs: [
        { cle: 'echeance', lab: "Au plus tard le", type: 'date', duo: true },
        { cle: 'auCoursDuMois', lab: "Écrire « au cours du mois de … »", type: 'bascule' }
      ]},
      { titre: "Le débiteur", ouvert: true, champs: [
        { cle: 'genre',      lab: "Civilité", type: 'choix', duo: true, choix: ['Monsieur', 'Madame'] },
        { cle: 'signNom',    lab: "Nom et prénom(s)", type: 'texte', duo: true },
        { cle: 'pourCompte', lab: "Agissant pour le compte de", type: 'texte', aide: "Vide : le débiteur s'engage en son nom propre." },
        { cle: 'avecSignature', lab: "Apposer la signature", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule' }
      ]},
      { titre: "Le créancier", ouvert: true, champs: [
        { cle: 'creancier', lab: "Qui prête", type: 'texte', duo: true, aide: "« Complexe Patrick Semedo », « Monsieur Moussa Diop »" },
        { cle: 'creancierArticle', lab: "Se dit", type: 'choix', duo: true, choix: ARTICLES },
        { cle: 'creancierSignataire', lab: "Nom et qualité de qui signe pour lui", type: 'texte', aide: "Vide : une ligne en pointillé, à remplir au stylo." }
      ]},
      { titre: "Lieu et date de signature", ouvert: false, champs: [
        { cle: 'lieu', lab: "Fait à", type: 'texte', duo: true },
        { cle: 'lieuDateEnBlanc', lab: "Laisser le lieu et la date en blanc, à écrire au stylo", type: 'bascule' }
      ]}
    ],

    defauts: function () {
      return {
        titre: "Reconnaissance de dette", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar", lieuDateEnBlanc: false,
        montant: "", montantLettres: "", objet: "",
        echeance: "", auCoursDuMois: true,
        genre: "Monsieur", signNom: "Antoine Jean Pierre Ndong", pourCompte: "Baobabs Basket Club",
        creancier: "", creancierArticle: ARTICLES[0], creancierSignataire: "",
        avecSignature: true, avecCachet: true, tables: {}
      };
    },

    controles: function (d) {
      var c = [];
      var ech = U.dateDe(d.echeance), le = U.dateDe(d.dateActe);
      if (!(montantDe(d) > 0)) c.push({ n: 'erreur', t: 'Pas de montant' });
      if (!v(d.creancier, "")) c.push({ n: 'erreur', t: 'Qui prête ? (le créancier)' });
      if (!v(d.signNom, "")) c.push({ n: 'erreur', t: 'Qui emprunte ? (le débiteur)' });
      if (!ech) c.push({ n: 'avert', t: 'Pas de date de remboursement' });
      else if (le && ech < le) c.push({ n: 'avert', t: 'Le remboursement tombe avant la date de l\'acte' });
      if (!v(d.objet, "")) c.push({ n: 'avert', t: 'À quoi sert la somme ?' });
      var tape = v(d.montantLettres, "");
      function nu(s) { return String(s).toLowerCase().replace(/francs?\s*cfa|fcfa/g, '').replace(/[^a-zà-ÿ]/g, ''); }
      if (tape && montantDe(d) > 0 && nu(tape) !== nu(U.enLettres(montantDe(d)))) {
        c.push({ n: 'erreur', t: 'Les lettres ne disent pas le même montant que les chiffres' });
      }
      if (d.lieuDateEnBlanc) c.push({ n: 'avert', t: 'Lieu et date en blanc : à écrire au stylo le jour de la signature' });
      return c;
    },

    page: [
      { b: 'entete', drapeau: false, droite: function (d) {
          var l = [d.numero ? "Reconnaissance de dette n° " + d.numero : "Reconnaissance de dette"];
          if (!d.lieuDateEnBlanc) l.push((d.lieu || '') + ", le " + dateL(d.dateActe, false));
          return l;
        } },
      { b: 'titre', etiquette: "Baobabs Basket Club · Finances",
        pastille: function (d) { return U.dateDe(d.echeance) ? "Échéance " + dateL(d.echeance, false) : ""; },
        texte: "Reconnaissance de dette" },
      { b: 'texte', texte: function (d) {
          return "Je soussigné" + (fem(d) ? "e" : "") + ", **" + v(d.signNom, BLANC) + "**, "
            + (v(d.pourCompte, "") ? "agissant pour le compte de **" + d.pourCompte.trim() + "**, " : "")
            + "reconnais avoir reçu à titre de prêt " + forme(d)[0] + "**" + v(d.creancier, BLANC) + "** la somme de" + NB + ":";
        } },
      { b: 'encadre', titre: function (d) { return somme(d); } },
      { b: 'texte', texte: function (d) {
          var o = v(d.objet, BLANC).replace(/^afin de\s+/i, '').replace(/[\s.]+$/, '');
          return "Cette somme m'a été remise afin de " + o + ".";
        } },
      { b: 'texte', texte: function (d) {
          var quand = "";
          if (U.dateDe(d.echeance)) {
            quand = (d.auCoursDuMois !== false ? " au cours du mois " + duMois(d.echeance) + ", et" : "")
              + " au plus tard le **" + dateL(d.echeance, false) + "**";
          }
          return "Par la présente, je reconnais devoir cette somme de **" + chiffres(d) + "** " + forme(d)[1]
            + v(d.creancier, BLANC) + " et m'engage à la rembourser intégralement" + quand + ".";
        } },
      { b: 'texte', texte: "La présente reconnaissance de dette est établie afin de constater formellement mon engagement de remboursement." },
      { b: 'signatures', lieuDessus: true,
        gauche: function (d) { return { lieuDate: lieuDate(d), note: "", reference: "" }; },
        cartes: function (d) {
          return [{ pour: fem(d) ? "La débitrice" : "Le débiteur", nom: '@signNom',
                    qualite: v(d.pourCompte, "") ? "Pour le compte de " + d.pourCompte.trim() : "",
                    avant: "**Mention manuscrite" + NB + ":**\n\n«" + NB + "Lu et approuvé, bon pour reconnaissance de dette de "
                         + (lettres(d) || BLANC) + " francs CFA (" + chiffres(d) + ")." + NB + "»",
                    mention: d.avecCachet !== false ? "Signature et cachet" : "Signature" },
                  { pour: "Le créancier", nom: '@creancier', qualite: "",
                    champs: [{ label: "Nom et qualité", valeur: '@creancierSignataire', large: true }],
                    mention: "Signature", signer: false, cacheter: false }];
        } }
    ],

    /* Une page, peu de texte, et deux mains qui signent : le corps se lit
       plus grand que dans un contrat de dix articles, et les cartes
       laissent la place d'une signature et d'un tampon au stylo. */
    css: function () {
      return [
        ".bloc + .bloc{ margin-top:9pt; }",
        ".hero h1{ font-size:21pt; }",
        ".bloc:has(> .hero) + .bloc{ margin-top:13pt; }",
        ".libre p{ font-size:9.2pt; line-height:1.55; max-width:none; }",
        ".encadre{ padding:10pt 14pt 10pt 16pt; }",
        ".encadre h2{ font-size:15.5pt; margin-bottom:0; }",
        ".closing{ margin-top:6pt; }",
        ".place{ font-size:9.2pt; }",
        ".sign-name{ font-size:10pt; }",
        ".sign-role{ font-size:8pt; }",
        ".sign-avant p{ font-size:8.4pt; }",
        ".sign-plein .party-champ{ font-size:8.4pt; }",
        ".sign-plein .ink-zone{ min-height:38mm; }"
      ].join('\n');
    },

    pied: function (d) {
      return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal",
              "Reconnaissance de dette" + (d.numero ? " n° " + d.numero : '') + (d.creancier ? " · " + d.creancier : '')];
    },
    fichier: function (d) {
      return "Reconnaissance de dette" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : '')
        + (d.creancier ? " - " + d.creancier : '') + " - BAOBABS BASKET CLUB";
    }
  };
})(window.BaobabsGreffe);
