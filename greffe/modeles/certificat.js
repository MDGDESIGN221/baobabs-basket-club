/* =====================================================================
   MODÈLE : CERTIFICAT
   ---------------------------------------------------------------------
   Meilleure joueuse du tournoi, bénévole de l'année, participation au
   stage : un certificat qu'on encadre. Rien de l'en-tête administratif :
   un cadre double or, le blason, un grand titre, le nom en évidence,
   le motif, la date, deux signatures. Une seule page, centrée.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  G.modeles['certificat'] = {
    cle: 'certificat',
    nom: "Certificat",
    famille: "Distinctions",
    prefixe: "CT",
    resume: "Un cadre double, un grand titre, le nom en évidence : à encadrer.",

    sections: [
      { titre: "Le certificat", ouvert: true, champs: [
        { cle: 'numero',    lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Date", type: 'date', duo: true },
        { cle: 'intitule',  lab: "Titre", type: 'texte', aide: "« Certificat », « Diplôme », « Distinction »" },
        { cle: 'sous',      lab: "Sous-titre", type: 'texte', aide: "« de participation », « de mérite », « de bénévolat »" },
        { cle: 'prelude',   lab: "Formule", type: 'texte', aide: "« est décerné à », « est remis à »" },
        { cle: 'nom',       lab: "Nom de la personne", type: 'texte' },
        { cle: 'motif',     lab: "Motif", type: 'zone' },
        { cle: 'lieu',      lab: "Fait à", type: 'texte', duo: true },
        { cle: 'evenement', lab: "À l'occasion de", type: 'texte', duo: true }
      ]},
      { titre: "Les signatures", ouvert: false, champs: [
        { cle: 'signNom',       lab: "Président", type: 'texte', duo: true },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte', duo: true },
        { cle: 'secondNom',     lab: "Second signataire", type: 'texte', duo: true },
        { cle: 'secondQualite', lab: "Sa qualité", type: 'texte', duo: true },
        { cle: 'avecSignature', lab: "Apposer la signature du président", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule' }
      ]}
    ],

    defauts: function () {
      return {
        titre: "Certificat", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar",
        intitule: "Certificat", sous: "de participation", prelude: "est décerné à", nom: "",
        motif: "pour sa participation au stage de perfectionnement organisé par le club, avec l'assiduité, l'engagement et l'esprit d'équipe qui font honneur aux Baobabs.",
        evenement: "",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président", secondNom: "", secondQualite: "Coach",
        avecSignature: true, avecCachet: true,
        tables: {}
      };
    },

    controles: function (d) {
      var c = [];
      if (!String(d.nom || '').trim()) c.push({ n: 'erreur', t: 'À qui est décerné le certificat ?' });
      if (!String(d.motif || '').trim()) c.push({ n: 'avert', t: 'Pas de motif' });
      return c;
    },

    page: [
      { b: 'espace', hauteur: 30 },
      { b: 'diplome', club: "Baobabs Basket Club", titre: '@intitule', sous: '@sous', prelude: '@prelude', nom: '@nom', motif: '@motif',
        date: function (d) { return "Fait à " + (d.lieu || '') + ", le " + U.dateLongue(d.dateActe, true) + (d.evenement ? " · " + d.evenement : '') + (d.numero ? " · n° " + d.numero : ''); },
        signatures: function (d) {
          var s = [{ nom: '@signNom', qualite: '@signQualite' }];
          if (String(d.secondNom || '').trim()) s.push({ nom: '@secondNom', qualite: '@secondQualite', signer: false });
          return s;
        } },
      { b: 'espace', hauteur: 20 }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Grandir ici. Régner partout.", (d.intitule || "Certificat") + (d.nom ? " · " + d.nom : '')]; },
    fichier: function (d) { return (d.intitule || "Certificat") + (d.nom ? " - " + d.nom : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
