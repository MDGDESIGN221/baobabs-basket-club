/* =====================================================================
   MODÈLE : DÉCHARGE DE RESPONSABILITÉ
   ---------------------------------------------------------------------
   Une sortie, un stage, un prêt de matériel, une joueuse majeure qui
   s'engage seule : le signataire reconnaît les risques et décharge le
   club. Un ton plus grave : bandeau rouge, articles courts, la boîte de
   signature et le club en contreseing. Pas d'en-tête administratif,
   pour qu'on ne le confonde avec rien.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  G.modeles['decharge'] = {
    cle: 'decharge',
    nom: "Décharge de responsabilité",
    famille: "Familles",
    prefixe: "DR",
    resume: "Je reconnais les risques et décharge le club : articles courts, signature.",

    sections: [
      { titre: "La décharge", ouvert: true, champs: [
        { cle: 'numero',    lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Date", type: 'date', duo: true },
        { cle: 'objet',     lab: "Pour", type: 'texte', aide: "« le stage de Saly du 12 au 15 juillet », « le prêt d'un jeu de maillots »" },
        { cle: 'signataire', lab: "Signataire", type: 'texte' },
        { cle: 'qualiteSign', lab: "En qualité de", type: 'choix', duo: true, choix: ['Joueuse majeure', 'Parent ou tuteur', 'Membre', 'Tiers'] },
        { cle: 'pourEnfant', lab: "Pour l'enfant (si parent)", type: 'texte', duo: true },
        { cle: 'piece',     lab: "Pièce d'identité n°", type: 'texte', duo: true },
        { cle: 'telephone', lab: "Téléphone", type: 'texte', duo: true }
      ]},
      { titre: "Les termes", ouvert: true, special: 'articles' },
      { titre: "Le club", ouvert: false, champs: [
        { cle: 'signNom',       lab: "Nom", type: 'texte', duo: true },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte', duo: true },
        { cle: 'avecSignature', lab: "Apposer la signature", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule' }
      ]}
    ],

    defauts: function () {
      return {
        titre: "Décharge de responsabilité", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar",
        objet: "", signataire: "", qualiteSign: "Parent ou tuteur", pourEnfant: "", piece: "", telephone: "",
        articles: [
          { titre: "Connaissance des risques", texte: "Le signataire déclare connaître la nature de l'activité et les risques inhérents à la pratique du basketball, et les accepter en toute connaissance de cause." },
          { titre: "Décharge", texte: "Il décharge Baobabs Basket Club, ses dirigeants, ses coachs et ses bénévoles de toute responsabilité en cas d'accident, de perte ou de dommage survenu en dehors des fautes qui leur seraient directement imputables." },
          { titre: "Assurance et santé", texte: "Il atteste être couvert par une assurance personnelle et ne connaître aucune contre-indication médicale à la pratique. Il s'engage à signaler toute évolution de son état de santé." },
          { titre: "Matériel et lieux", texte: "Il s'engage à respecter les consignes des encadrants, le règlement des lieux et le matériel mis à disposition, qu'il restituera en l'état." }
        ],
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président",
        avecSignature: true, avecCachet: true,
        styles: { b0: { theme: 'rouge' } },
        tables: {}
      };
    },

    controles: function (d) {
      var c = [];
      if (!String(d.objet || '').trim()) c.push({ n: 'erreur', t: 'Pour quoi la décharge est-elle donnée ?' });
      if (!String(d.signataire || '').trim()) c.push({ n: 'avert', t: 'Signataire vide : à remplir au stylo' });
      return c;
    },

    page: [
      { b: 'bandeau', ton: 'noir', etiquette: "À lire avant de signer", texte: "Décharge de responsabilité", sous: function (d) { return d.objet ? "Pour " + d.objet : ""; },
        droite: function (d) { return [U.dateLongue(d.dateActe, false), d.numero ? "N° " + d.numero : "Baobabs Basket Club"]; } },
      { b: 'grille', colonnes: 2, champs: [
          { label: "Je soussigné(e)", chemin: 'signataire', large: true },
          { label: "En qualité de", chemin: 'qualiteSign' }, { label: "Pour l'enfant", chemin: 'pourEnfant' },
          { label: "Pièce d'identité n°", chemin: 'piece' }, { label: "Téléphone", chemin: 'telephone' } ] },
      { b: 'phrase', texte: "Déclare, reconnaît et s'engage :" },
      { b: 'articles', articles: '@articles' },
      { b: 'cases', etiquette: "Le signataire coche", cases: [{ texte: "J'ai lu l'intégralité du présent document" }, { texte: "J'ai reçu une copie" }, { texte: "Je suis majeur(e), ou je signe pour mon enfant mineur" }] },
      { b: 'signatureLibre', boites: [{ label: "Signature du signataire", mention: "Précédée de « Lu et approuvé, bon pour décharge », avec la date" }] },
      { b: 'signatures', gauche: function (d) { return { lieuDate: "Reçu par le club à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "", reference: d.numero ? "BBC / DR / " + String(d.numero).replace('/', ' / ') : '' }; },
        cartes: [{ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite', mention: "Signature et cachet" }] }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280", "Décharge" + (d.signataire ? " · " + d.signataire : '')]; },
    fichier: function (d) { return "Decharge" + (d.signataire ? " - " + d.signataire : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
