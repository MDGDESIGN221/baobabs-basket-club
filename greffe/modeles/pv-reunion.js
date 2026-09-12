/* =====================================================================
   MODÈLE : PROCÈS-VERBAL DE RÉUNION
   ---------------------------------------------------------------------
   Une réunion du bureau, une assemblée : qui était là, ce qui a été
   dit, ce qui a été décidé. Les présents dans un tableau (une ligne par
   personne, collée depuis un message), l'ordre du jour en points, les
   décisions numérotées comme des articles, deux signatures : le
   président de séance et le secrétaire.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  G.modeles['pv-reunion'] = {
    cle: 'pv-reunion',
    nom: "Procès-verbal de réunion",
    famille: "Gouvernance",
    prefixe: "PV",
    resume: "Présents, ordre du jour, décisions numérotées, deux signatures.",

    sections: [
      { titre: "La réunion", ouvert: true, champs: [
        { cle: 'numero',    lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Date de la réunion", type: 'date', duo: true },
        { cle: 'objet',     lab: "Réunion de", type: 'texte', aide: "« du bureau », « de l'assemblée générale », « du comité sportif »…" },
        { cle: 'lieu',      lab: "Lieu", type: 'texte', duo: true },
        { cle: 'heures',    lab: "Heures", type: 'texte', duo: true, aide: "« de 18 h à 20 h 15 »" },
        { cle: 'preside',   lab: "Présidée par", type: 'texte', duo: true },
        { cle: 'secretaire', lab: "Secrétaire de séance", type: 'texte', duo: true }
      ]},
      { titre: "Les présents", ouvert: true, special: 'table', source: 'presents' },
      { titre: "L'ordre du jour et les échanges", ouvert: true, champs: [
        { cle: 'ordreDuJour', lab: "Ordre du jour", type: 'zone', aide: "Un point par ligne, précédé d'un tiret." },
        { cle: 'echanges',    lab: "Résumé des échanges", type: 'zone' }
      ]},
      { titre: "Les décisions", ouvert: true, special: 'articles' },
      { titre: "La clôture", ouvert: false, champs: [
        { cle: 'cloture',       lab: "Clôture", type: 'zone' },
        { cle: 'signNom',       lab: "Président de séance", type: 'texte', duo: true },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte', duo: true },
        { cle: 'avecSignature', lab: "Apposer la signature", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule' }
      ]}
    ],

    defauts: function () {
      return {
        titre: "Procès-verbal de réunion",
        numero: "", dateActe: U.isoDuJour(), lieu: "Dakar", heures: "",
        objet: "du bureau", preside: "Antoine Jean Pierre Ndong", secretaire: "",
        ordreDuJour: "- Approbation du procès-verbal précédent\n- Point sur la saison en cours\n- Questions diverses",
        echanges: "",
        articles: [
          { titre: "Approbation du procès-verbal précédent", texte: "Le procès-verbal de la réunion précédente est approuvé à l'unanimité des présents." },
          { titre: "", texte: "" }
        ],
        cloture: "L'ordre du jour étant épuisé, la séance est levée. Le présent procès-verbal est établi pour servir et valoir ce que de droit.",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président",
        avecSignature: true, avecCachet: true,
        styles: { b1: { theme: 'vert' } },
        tables: {
          presents: {
            titre: "Les présents", singulier: "présent", vide: 8,
            colonnes: [
              { cle: 'nom',      titre: "Nom et prénom(s)", poids: 46, forme: 'fort' },
              { cle: 'qualite',  titre: "Qualité", poids: 34, forme: 'pastille', choix: ['Président', 'Vice-président', 'Secrétaire', 'Trésorier', 'Coach', 'Membre', 'Parent', 'Invité'] },
              { cle: 'presence', titre: "Présence", poids: 22, forme: 'pastille', align: 'centre', choix: ['Présent', 'Excusé', 'Absent', 'Représenté'] },
              { cle: 'emargement', titre: "Émargement", poids: 30, forme: 'texte' }
            ],
            lignes: []
          }
        }
      };
    },

    controles: function (d) {
      var c = [];
      if (!String(d.objet || '').trim()) c.push({ n: 'erreur', t: 'De quelle réunion s\'agit-il ?' });
      var n = G.lignes(d, 'presents').length;
      if (!n) c.push({ n: 'avert', t: 'Aucun présent : la feuille des présents s\'imprimera vierge' });
      else c.push({ n: 'ok', t: n + ' présent' + (n > 1 ? 's' : '') });
      var dec = (d.articles || []).filter(function (a) { return String(a.titre || a.texte || '').trim(); }).length;
      if (!dec) c.push({ n: 'avert', t: 'Aucune décision' });
      return c;
    },

    page: [
      { b: 'entete', droite: function (d) {
          return [(d.lieu || '') + ", le " + U.dateLongue(d.dateActe, false), d.numero ? "PV n° " + d.numero : ""];
        } },
      { b: 'titre', etiquette: "Procès-verbal", pastille: function (d) { return d.heures ? d.heures : ''; },
        texte: function (d) { return "Réunion " + (d.objet || ''); },
        sous: function (d) { return "Tenue le " + U.dateLongue(d.dateActe, true) + (d.lieu ? " à " + d.lieu : '') + (d.preside ? ", sous la présidence de " + d.preside : '') + (d.secretaire ? ". Secrétaire de séance : " + d.secretaire : '') + "."; } },
      { b: 'tableau', source: 'presents', vide: 8 },
      { b: 'texte', etiquette: "Ordre du jour", texte: '@ordreDuJour' },
      { b: 'texte', si: function (d) { return !!String(d.echanges || '').trim(); }, etiquette: "Les échanges", texte: '@echanges' },
      { b: 'phrase', texte: "Après en avoir délibéré, la réunion décide :" },
      { b: 'articles', articles: '@articles' },
      { b: 'texte', texte: '@cloture' },
      { b: 'signatures',
        gauche: function (d) { return { lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "", reference: d.numero ? "BBC / PV / " + String(d.numero).replace('/', ' / ') : '' }; },
        cartes: function (d) {
          return [
            { pour: "Le président de séance", nom: '@signNom', qualite: '@signQualite', mention: "Signature et cachet" },
            { pour: "Le secrétaire de séance", nom: '@secretaire', qualite: "Secrétaire", mention: "Signature", signer: false, cacheter: false }
          ];
        } }
    ],

    pied: function (d) {
      return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280", "Procès-verbal" + (d.numero ? " n° " + d.numero : '') + " · réunion " + (d.objet || '')];
    },
    fichier: function (d) { return "PV" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : '') + " - Reunion " + String(d.objet || '').slice(0, 40) + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
