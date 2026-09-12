/* =====================================================================
   MODÈLE : ORDRE DU JOUR
   ---------------------------------------------------------------------
   Ce qu'on envoie avant la réunion : où, quand, qui, et les points
   numérotés avec leur durée. Le procès-verbal viendra après. Une page,
   un en-tête, une liste de points en tableau (pour en ajouter un en un
   clic), le mot de convocation.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  G.modeles['ordre-du-jour'] = {
    cle: 'ordre-du-jour',
    nom: "Ordre du jour",
    famille: "Gouvernance",
    prefixe: "OJ",
    resume: "Avant la réunion : où, quand, qui, et les points numérotés avec leur durée.",

    sections: [
      { titre: "La réunion", ouvert: true, champs: [
        { cle: 'numero',    lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Établi le", type: 'date', duo: true },
        { cle: 'objet',     lab: "Réunion de", type: 'texte', aide: "« du bureau », « de l'assemblée générale », « des coachs »" },
        { cle: 'jour',      lab: "Date de la réunion", type: 'date', duo: true },
        { cle: 'heure',     lab: "Heure", type: 'texte', duo: true },
        { cle: 'lieuReunion', lab: "Lieu", type: 'texte', duo: true },
        { cle: 'duree',     lab: "Durée prévue", type: 'texte', duo: true },
        { cle: 'convoques', lab: "Sont convoqués", type: 'texte', aide: "« les membres du bureau », « tous les coachs »" },
        { cle: 'mot',       lab: "Mot d'accompagnement", type: 'zone' }
      ]},
      { titre: "Les points", ouvert: true, special: 'table', source: 'points' },
      { titre: "Le signataire", ouvert: false, champs: [
        { cle: 'signNom',       lab: "Nom", type: 'texte', duo: true },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte', duo: true },
        { cle: 'avecSignature', lab: "Apposer la signature", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule' }
      ]}
    ],

    defauts: function () {
      return {
        titre: "Ordre du jour", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar",
        objet: "du bureau", jour: "", heure: "", lieuReunion: "", duree: "", convoques: "les membres du bureau",
        mot: "Merci de préparer les points qui vous concernent et de signaler avant la veille tout point à ajouter.",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président",
        avecSignature: true, avecCachet: false,
        tables: {
          points: {
            titre: "Les points", singulier: "point", vide: 0,
            colonnes: [
              { cle: 'titre', titre: "Point", poids: 40, forme: 'fort' },
              { cle: 'texte', titre: "Précision", poids: 50 },
              { cle: 'qui',   titre: "Rapporteur", poids: 24 },
              { cle: 'duree', titre: "Durée", poids: 14, forme: 'code', align: 'centre' }
            ],
            lignes: [
              { titre: "Approbation du procès-verbal précédent", texte: "", qui: "", duree: "5 min" },
              { titre: "Point sur la saison", texte: "Effectifs, résultats, calendrier", qui: "", duree: "20 min" },
              { titre: "Questions diverses", texte: "", qui: "", duree: "10 min" }
            ]
          }
        }
      };
    },

    controles: function (d) {
      var c = [];
      if (!U.dateDe(d.jour)) c.push({ n: 'erreur', t: 'Pas de date de réunion' });
      if (!G.lignes(d, 'points').length) c.push({ n: 'erreur', t: 'Aucun point à l\'ordre du jour' });
      return c;
    },

    page: [
      { b: 'entete', droite: function (d) { return [(d.lieu || '') + ", le " + U.dateLongue(d.dateActe, false), d.numero ? "Ordre du jour n° " + d.numero : ""]; } },
      { b: 'titre', etiquette: "Ordre du jour", pastille: function (d) { return d.duree || ''; }, texte: function (d) { return "Réunion " + (d.objet || ''); },
        sous: function (d) { return (U.dateLongue(d.jour, true) || "Date à préciser") + (d.heure ? " à " + d.heure : '') + (d.lieuReunion ? " · " + d.lieuReunion : ''); } },
      { b: 'reperes', cellules: function (d) {
          return [{ label: "Date", valeur: U.dateLongue(d.jour, false) || '' }, { label: "Heure", valeur: '@heure' }, { label: "Lieu", valeur: '@lieuReunion' }, { label: "Sont convoqués", valeur: '@convoques' }];
        } },
      { b: 'tableau', source: 'points', vide: 0 },
      { b: 'texte', texte: '@mot' },
      { b: 'signatures', gauche: function (d) { return { lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "", reference: '' }; },
        cartes: [{ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite', mention: "Signature" }] }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal", "Ordre du jour · réunion " + (d.objet || '') + (d.jour ? " · " + U.dateLongue(d.jour, false) : '')]; },
    fichier: function (d) { return "Ordre du jour - reunion " + String(d.objet || '').slice(0, 30) + (d.jour ? " - " + d.jour : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
