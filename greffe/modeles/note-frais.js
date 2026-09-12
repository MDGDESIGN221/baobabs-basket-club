/* =====================================================================
   MODÈLE : NOTE DE FRAIS
   ---------------------------------------------------------------------
   Un coach a avancé le transport, un dirigeant a payé l'eau du
   tournoi : il demande le remboursement. Qui, pour quoi, une ligne par
   dépense avec son justificatif, le total ; puis la décision (approuvé,
   refusé, montant retenu) et deux signatures. Un document de trésorerie,
   sobre, à cases.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  G.modeles['note-frais'] = {
    cle: 'note-frais',
    nom: "Note de frais",
    famille: "Finances",
    prefixe: "NF",
    resume: "Une dépense par ligne, justificatifs, total, approbation et signatures.",

    sections: [
      { titre: "La note", ouvert: true, champs: [
        { cle: 'numero',    lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Date", type: 'date', duo: true },
        { cle: 'demandeur', lab: "Demandeur", type: 'texte', duo: true },
        { cle: 'fonction',  lab: "Fonction", type: 'texte', duo: true },
        { cle: 'objet',     lab: "Objet des dépenses", type: 'texte', aide: "« Déplacement à Thiès, tournoi U16 des 3 et 4 mai »" },
        { cle: 'periode',   lab: "Période", type: 'texte', duo: true },
        { cle: 'avance',    lab: "Avance déjà perçue (FCFA)", type: 'texte', duo: true }
      ]},
      { titre: "Les dépenses", ouvert: true, special: 'table', source: 'depenses' },
      { titre: "La décision", ouvert: true, champs: [
        { cle: 'decision',   lab: "Décision", type: 'choix', choix: ['En attente', 'Approuvée', 'Approuvée partiellement', 'Refusée'] },
        { cle: 'retenu',     lab: "Montant retenu (FCFA)", type: 'texte', duo: true },
        { cle: 'paiement',   lab: "Remboursée par", type: 'choix', duo: true, choix: ['', 'Espèces', 'Wave', 'Orange Money', 'Virement'] },
        { cle: 'observations', lab: "Observations", type: 'zone' }
      ]},
      { titre: "Les signatures", ouvert: false, champs: [
        { cle: 'signNom',       lab: "Président", type: 'texte', duo: true },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte', duo: true },
        { cle: 'tresorier',     lab: "Trésorier", type: 'texte' },
        { cle: 'avecSignature', lab: "Apposer la signature", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule' }
      ]}
    ],

    defauts: function () {
      return {
        titre: "Note de frais", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar",
        demandeur: "", fonction: "", objet: "", periode: "", avance: "",
        decision: "En attente", retenu: "", paiement: "", observations: "",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président", tresorier: "",
        avecSignature: true, avecCachet: true,
        styles: { b3: { theme: 'neutre' } },
        tables: {
          depenses: {
            titre: "Les dépenses", singulier: "dépense", vide: 8, unite: "FCFA",
            colonnes: [
              { cle: 'date',    titre: "Date", poids: 18, forme: 'code', align: 'centre' },
              { cle: 'libelle', titre: "Dépense", poids: 46, forme: 'fort' },
              { cle: 'nature',  titre: "Nature", poids: 24, forme: 'pastille', align: 'centre', choix: ['Transport', 'Repas', 'Hébergement', 'Matériel', 'Frais médicaux', 'Communication', 'Autre'] },
              { cle: 'justif',  titre: "Justificatif", poids: 22, forme: 'code', align: 'centre' },
              { cle: 'montant', titre: "Montant (FCFA)", poids: 24, forme: 'nombre', align: 'droite', total: true }
            ],
            lignes: []
          }
        }
      };
    },

    controles: function (d) {
      var c = [];
      if (!String(d.demandeur || '').trim()) c.push({ n: 'erreur', t: 'Pas de demandeur' });
      var n = G.lignes(d, 'depenses').length;
      if (!n) c.push({ n: 'erreur', t: 'Aucune dépense' }); else c.push({ n: 'ok', t: n + ' dépense' + (n > 1 ? 's' : '') });
      if (d.decision === 'En attente') c.push({ n: 'avert', t: 'La décision n\'est pas prise' });
      return c;
    },

    page: [
      { b: 'entete', droite: function (d) { return [(d.lieu || '') + ", le " + U.dateLongue(d.dateActe, false), d.numero ? "Note de frais n° " + d.numero : ""]; } },
      { b: 'titre', etiquette: "Trésorerie", pastille: function (d) { return d.decision !== 'En attente' ? d.decision : ''; }, texte: "Note de frais", sous: '@objet' },
      { b: 'reperes', cellules: function (d) {
          return [{ label: "Demandeur", valeur: '@demandeur', sous: d.fonction || '' }, { label: "Période", valeur: '@periode' },
                  { label: "Avance perçue", valeur: d.avance ? U.nombre(d.avance) + " FCFA" : "Aucune" }, { label: "Total demandé", valeur: "{{total.depenses}}" }];
        } },
      { b: 'tableau', source: 'depenses', vide: 8 },
      { b: 'encadre', etiquette: "Décision du bureau", titre: function (d) { return d.decision === 'En attente' ? "En attente de décision" : "Note " + String(d.decision).toLowerCase(); },
        avant: function (d) {
          var t = [];
          if (d.retenu) t.push("Montant retenu : **" + U.nombre(d.retenu) + " FCFA**" + (d.paiement ? ", remboursé par " + d.paiement : "") + ".");
          if (d.observations) t.push(d.observations);
          return t.join("\n\n");
        } },
      { b: 'cases', etiquette: "Vérifications", enLigne: true, cases: [
          { texte: "Justificatifs joints" }, { texte: "Montants vérifiés" }, { texte: "Imputé au budget" }, { texte: "Remboursement effectué" } ] },
      { b: 'signatures', gauche: function (d) { return { lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "", reference: d.numero ? "BBC / NF / " + String(d.numero).replace('/', ' / ') : '' }; },
        cartes: function (d) {
          return [{ pour: "Le demandeur", nom: '@demandeur', qualite: '@fonction', mention: "Signature", signer: false, cacheter: false },
                  { pour: "Le trésorier", nom: '@tresorier', qualite: "Trésorier", mention: "Signature", signer: false, cacheter: false },
                  { pour: "Le président", nom: '@signNom', qualite: '@signQualite', mention: "Signature et cachet" }];
        } }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280", "Note de frais" + (d.numero ? " n° " + d.numero : '') + (d.demandeur ? " · " + d.demandeur : '')]; },
    fichier: function (d) { return "Note de frais" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : '') + (d.demandeur ? " - " + d.demandeur : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
