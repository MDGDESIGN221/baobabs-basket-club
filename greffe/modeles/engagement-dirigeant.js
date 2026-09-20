/* =====================================================================
   MODÈLE : ACTE D'ENGAGEMENT D'UN MEMBRE DU BUREAU
   ---------------------------------------------------------------------
   Quelqu'un prend une fonction au bureau : trésorier, secrétaire,
   responsable de l'école. Il accepte la fonction, prend connaissance
   des statuts et du règlement, s'engage sur la loyauté, la
   confidentialité, la bonne gestion et la passation le jour où il part.
   La fiche de fonction (autre acte) dit ce qu'il peut ; celui-ci dit
   qu'il s'engage. Le membre signe « lu et approuvé », le président
   contresigne.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  function v(x, repli) { return String(x || '').trim() || repli; }
  function fem(d) { return /^Madame/i.test(String(d.genre || '')); }
  function leM(d) { return fem(d) ? "la Membre" : "le Membre"; }
  function LeM(d) { return fem(d) ? "La Membre" : "Le Membre"; }
  function ee(d) { return fem(d) ? "e" : ""; }

  function articlesParDefaut(d) {
    var M = leM(d), Mm = LeM(d), e = ee(d), duAu = U.duAu(d.du, d.au);
    return [
      { titre: "Acceptation de la fonction",
        texte: Mm + " accepte la fonction de **" + v(d.fonction, "membre du bureau") + "** de Baobabs Basket Club"
             + (v(d.organe, "") ? ", au sein de " + d.organe.trim() : "") + ", "
             + (v(d.designation, "") ? "à laquelle " + (fem(d) ? "elle" : "il") + " a été désigné" + e + " par " + d.designation.trim() : "sur désignation du bureau") + ".\n\n"
             + "Le mandat court pour **" + v(d.duree, "la durée du mandat du bureau") + "**" + (duAu ? ", " + duAu : "") + "." },
      { titre: "Statuts, règlement et fiche de fonction",
        texte: Mm + " déclare avoir reçu et lu les statuts, le règlement intérieur et la fiche de sa fonction, "
             + "qui décrit ses attributions, ses pouvoirs et leurs limites. " + (fem(d) ? "Elle" : "Il") + " s'engage à les respecter." },
      { titre: "Devoirs",
        texte: Mm + " s'engage à :\n"
             + "- exercer sa fonction avec assiduité, loyauté et dans l'intérêt du Club ;\n"
             + "- garder confidentielles les informations du Club, des joueuses et des familles ;\n"
             + "- déclarer au bureau tout conflit d'intérêts, et s'abstenir de la décision concernée ;\n"
             + "- n'engager le Club, financièrement ou par écrit, que dans les limites de sa fonction ;\n"
             + "- rendre compte au bureau et tenir à jour les documents dont " + (fem(d) ? "elle" : "il") + " a la charge." },
      { titre: "Bénévolat et frais",
        texte: "La fonction est bénévole. Les frais engagés pour le Club sont remboursés sur justificatifs, "
             + "par note de frais, selon les règles du bureau." },
      { titre: "Fin du mandat",
        texte: "Le mandat prend fin à son terme, par démission notifiée par écrit avec un préavis de "
             + v(d.preavis, "un (1) mois") + ", ou par révocation décidée par l'organe qui a désigné " + M + ", "
             + "après que " + (fem(d) ? "celle-ci" : "celui-ci") + " a été entendu" + e + "." },
      { titre: "Passation",
        texte: "À la fin de son mandat, " + M + " remet à son successeur ou au président, dans les "
             + v(d.delaiPassation, "quinze (15) jours") + ", les documents, fonds, matériel et accès dont "
             + (fem(d) ? "elle" : "il") + " a la charge, et signe avec lui un procès-verbal de passation." }
    ];
  }

  G.modeles['engagement-dirigeant'] = {
    cle: 'engagement-dirigeant',
    nom: "Acte d'engagement d'un membre du bureau",
    famille: "Gouvernance",
    prefixe: "ED",
    resume: "Une fonction acceptée : statuts, devoirs, conflits d'intérêts, fin du mandat, passation.",

    sections: [
      { titre: "L'engagement", ouvert: true, champs: [
        { cle: 'numero',    lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Fait le", type: 'date', duo: true },
        { cle: 'lieu',      lab: "Fait à", type: 'texte', duo: true },
        { cle: 'organe',    lab: "Au sein de", type: 'texte', duo: true, aide: "« le bureau », « la section basketball de l'ASC » " },
        { cle: 'designation', lab: "Désigné par", type: 'texte', aide: "« l'assemblée générale du 14 septembre 2026 », « le bureau »" },
        { cle: 'duree',     lab: "Durée du mandat", type: 'texte', duo: true },
        { cle: 'du',        lab: "Du", type: 'date', duo: true },
        { cle: 'au',        lab: "Au", type: 'date', duo: true },
        { cle: 'preavis',   lab: "Préavis de démission", type: 'texte', duo: true },
        { cle: 'delaiPassation', lab: "Passation sous", type: 'texte', duo: true }
      ]},
      { titre: "Le membre", ouvert: true, champs: [
        { cle: 'genre',     lab: "Civilité", type: 'choix', duo: true, choix: ['Monsieur', 'Madame'] },
        { cle: 'fonction',  lab: "Fonction", type: 'choix', duo: true, choix: ['Président', 'Vice-Président', 'Secrétaire Général', 'Secrétaire Général Adjoint', 'Trésorier', 'Trésorier Adjoint', 'Directeur Sportif', 'Responsable Académie', 'Responsable Académie Adjoint', 'Pôle Médical', 'Logistique', 'Communication', 'Partenariats', "Membre du conseil d'administration"] },
        { cle: 'nom',       lab: "Nom et prénom(s)", type: 'texte' },
        { cle: 'naissance', lab: "Date de naissance", type: 'date', duo: true },
        { cle: 'piece',     lab: "Passeport / CNI", type: 'texte', duo: true },
        { cle: 'telephone', lab: "Téléphone", type: 'texte', duo: true },
        { cle: 'email',     lab: "E-mail", type: 'texte', duo: true }
      ]},
      { titre: "Les articles", ouvert: false, special: 'articles' },
      { titre: "Les signataires", ouvert: false, champs: [
        { cle: 'signNom',       lab: "Pour le club", type: 'texte', duo: true },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte', duo: true },
        { cle: 'avecSignature', lab: "Apposer la signature du président", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule' }
      ]}
    ],

    defauts: function () {
      return {
        titre: "Acte d'engagement", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar",
        organe: "le bureau", designation: "", duree: "la durée du mandat du bureau", du: "", au: "", preavis: "un (1) mois", delaiPassation: "quinze (15) jours",
        genre: "Monsieur", fonction: "Trésorier", nom: "", naissance: "", piece: "", telephone: "", email: "",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président",
        avecSignature: true, avecCachet: true, articles: null, tables: {}
      };
    },
    articlesParDefaut: articlesParDefaut,

    controles: function (d) {
      var c = [];
      if (!String(d.nom || '').trim()) c.push({ n: 'avert', t: 'Identité vide : à compléter au stylo, en pointillé' });
      if (!String(d.designation || '').trim()) c.push({ n: 'avert', t: 'Qui l\'a désigné ? (assemblée, bureau)' });
      return c;
    },

    page: [
      { b: 'entete', drapeau: false, devise: function (d) { return "Section Basketball · " + v(d.fonction, "Bureau") + " · Dakar"; },
        droite: function (d) { return [d.numero ? "Acte n° " + d.numero : "Acte d'engagement", v(d.duree, "")]; } },
      { b: 'parties', parties: function (d) {
          var champs = v(d.nom, "") ? [] : [{ label: fem(d) ? "Madame" : "Monsieur", valeur: "", large: true }];
          champs.push({ label: fem(d) ? "Née le" : "Né le", valeur: U.dateLongue(d.naissance, false) }, { label: "Passeport / CNI", valeur: d.piece },
                      { label: "Téléphone", valeur: d.telephone }, { label: "E-mail", valeur: d.email });
          return [{ label: "Le Club", nom: "Baobabs Basket Club", texte: "Représenté par son Président, Monsieur " + v(d.signNom, "Antoine Jean Pierre Ndong") + ".", tag: "Ci-après dénommé « le Club »" },
                  { label: LeM(d) + " du bureau", nom: '@nom', champs: champs, tag: "Ci-après dénommé" + ee(d) + " « " + leM(d) + " »" }];
        } },
      { b: 'titre', etiquette: "Baobabs Basket Club · Gouvernance", pastille: function (d) { return d.numero ? "N° " + d.numero : ""; },
        texte: function (d) { return "Acte d'engagement · " + v(d.fonction, "membre du bureau"); },
        sous: "Prendre une fonction au bureau, c'est accepter des devoirs. Le présent acte les écrit, pour que chacun sache ce qu'il a signé." },
      { b: 'phrase', texte: "Il est convenu ce qui suit :" },
      { b: 'articles', articles: function (d) { return (d.articles && d.articles.length) ? d.articles : articlesParDefaut(d); } },
      { b: 'signatures',
        gauche: function (d) { return { lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "En deux exemplaires originaux.", reference: d.numero ? 'BBC / ED / ' + String(d.numero).replace('/', ' / ') : '' }; },
        cartes: function (d) {
          return [{ pour: LeM(d) + " du bureau", nom: v(d.nom, "Nom et prénom(s) :"), qualite: v(d.fonction, ""), mention: "Lu et approuvé · Signature", signer: false, cacheter: false },
                  { pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite', mention: "Signature et cachet du Président" }];
        } }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280", "Acte d'engagement" + (d.numero ? " n° " + d.numero : '') + (d.nom ? " · " + d.nom : '')]; },
    fichier: function (d) { return "Engagement bureau" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : '') + (d.nom ? " - " + d.nom : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
