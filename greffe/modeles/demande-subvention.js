/* =====================================================================
   MODÈLE : DEMANDE DE SUBVENTION
   ---------------------------------------------------------------------
   À la mairie, à une entreprise, à une fondation : le club expose son
   projet et chiffre ce qu'il demande. Une lettre, puis le projet en
   cases, le budget en tableau (poste, montant, part demandée), ce que
   le partenaire y gagne, et la signature. Le montant demandé se lit en
   tête : c'est la première chose qu'on cherche.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  G.modeles['demande-subvention'] = {
    cle: 'demande-subvention',
    nom: "Demande de subvention",
    famille: "Correspondance",
    prefixe: "DS",
    resume: "Le projet, le budget par poste, la part demandée, ce que le partenaire y gagne.",

    sections: [
      { titre: "La demande", ouvert: true, champs: [
        { cle: 'numero',    lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Date", type: 'date', duo: true },
        { cle: 'destNom',   lab: "Destinataire", type: 'texte' },
        { cle: 'destLigne', lab: "À l'attention de", type: 'texte' },
        { cle: 'projet',    lab: "Le projet", type: 'texte', aide: "« Équipement de l'école de basket », « Tournoi des Baobabs 2027 »" },
        { cle: 'montantDemande', lab: "Montant demandé (FCFA)", type: 'texte', duo: true },
        { cle: 'coutTotal', lab: "Coût total du projet (FCFA)", type: 'texte', duo: true },
        { cle: 'periode',   lab: "Période", type: 'texte', duo: true },
        { cle: 'beneficiaires', lab: "Bénéficiaires", type: 'texte', duo: true }
      ]},
      { titre: "La lettre", ouvert: true, champs: [
        { cle: 'salutation', lab: "Appel", type: 'texte' },
        { cle: 'corps',      lab: "Texte", type: 'zone' },
        { cle: 'contreparties', lab: "Ce que le partenaire y gagne", type: 'zone', aide: "Un point par ligne, avec un tiret." },
        { cle: 'formule',    lab: "Formule de politesse", type: 'zone' }
      ]},
      { titre: "Le budget du projet", ouvert: true, special: 'table', source: 'budget' },
      { titre: "Le signataire", ouvert: false, champs: [
        { cle: 'signNom',       lab: "Nom", type: 'texte', duo: true },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte', duo: true },
        { cle: 'avecSignature', lab: "Apposer la signature", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule' }
      ]}
    ],

    defauts: function () {
      return {
        titre: "Demande de subvention", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar",
        destNom: "", destLigne: "", projet: "", montantDemande: "", coutTotal: "", periode: "", beneficiaires: "",
        salutation: "Madame, Monsieur,",
        corps: "Baobabs Basket Club, section basketball de l'ASC Baobab, forme chaque saison des joueuses et des joueurs de six à vingt ans, de l'école de basket aux équipes seniors.\n\nNous sollicitons votre soutien pour le projet présenté ci-dessous, dont le budget est détaillé page suivante.",
        contreparties: "- Votre logo sur les maillots et les supports du club\n- Une visibilité sur le site et les réseaux du club\n- Une invitation aux événements de la saison",
        formule: "Nous restons à votre disposition pour vous présenter le projet, et vous prions d'agréer, Madame, Monsieur, l'expression de notre considération distinguée.",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président",
        avecSignature: true, avecCachet: true,
        tables: {
          budget: {
            titre: "Le budget du projet", singulier: "poste", vide: 6, unite: "FCFA",
            colonnes: [
              { cle: 'poste',    titre: "Poste de dépense", poids: 50, forme: 'fort' },
              { cle: 'detail',   titre: "Détail", poids: 40 },
              { cle: 'montant',  titre: "Coût (FCFA)", poids: 24, forme: 'nombre', align: 'droite', total: true },
              { cle: 'demande',  titre: "Part demandée (FCFA)", poids: 26, forme: 'nombre', align: 'droite', total: true }
            ],
            lignes: []
          }
        }
      };
    },

    controles: function (d) {
      var c = [];
      if (!String(d.destNom || '').trim()) c.push({ n: 'erreur', t: 'Pas de destinataire' });
      if (!String(d.projet || '').trim()) c.push({ n: 'erreur', t: 'Quel projet ?' });
      if (!(parseFloat(String(d.montantDemande || '').replace(/[^\d.,-]/g, '')) > 0)) c.push({ n: 'erreur', t: 'Pas de montant demandé' });
      if (!G.lignes(d, 'budget').length) c.push({ n: 'avert', t: 'Le budget du projet est vide' });
      return c;
    },

    page: [
      { b: 'entete', droite: function (d) { return [(d.lieu || '') + ", le " + U.dateLongue(d.dateActe, false), d.numero ? "Demande n° " + d.numero : "Récépissé n° 8280"]; } },
      { b: 'parties', si: function (d) { return !!String(d.destNom || '').trim(); },
        parties: function (d) { return [{ label: "Destinataire", nom: '@destNom', texte: d.destLigne || '', tag: '' }]; } },
      { b: 'titre', etiquette: "Demande de subvention", pastille: function (d) { return d.montantDemande ? U.nombre(d.montantDemande) + " FCFA demandés" : ''; }, texte: '@projet',
        sous: function (d) { return [d.periode ? "Période : " + d.periode : '', d.beneficiaires ? "Bénéficiaires : " + d.beneficiaires : ''].filter(Boolean).join(" · "); } },
      { b: 'lettre', salutation: '@salutation', texte: '@corps', formule: '' },
      { b: 'reperes', cellules: function (d) {
          return [{ label: "Coût total", valeur: d.coutTotal ? U.nombre(d.coutTotal) + " FCFA" : "{{total.budget}}" },
                  { label: "Montant demandé", valeur: d.montantDemande ? U.nombre(d.montantDemande) + " FCFA" : '' },
                  { label: "Part du club et des familles", valeur: (d.coutTotal && d.montantDemande) ? U.nombre(U.nombre(d.coutTotal).replace(/\s/g, '') - U.nombre(d.montantDemande).replace(/\s/g, '')) + " FCFA" : '' },
                  { label: "Période", valeur: '@periode' }];
        } },
      { b: 'tableau', source: 'budget', vide: 6 },
      { b: 'texte', etiquette: "Ce que votre soutien vous apporte", texte: '@contreparties' },
      { b: 'texte', texte: '@formule' },
      { b: 'signatures', gauche: function (d) { return { lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "", reference: d.numero ? "BBC / DS / " + String(d.numero).replace('/', ' / ') : '' }; },
        cartes: [{ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite', mention: "Signature et cachet du Président" }] }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280", "Demande de subvention" + (d.projet ? " · " + d.projet : '')]; },
    fichier: function (d) { return "Demande de subvention" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : '') + (d.destNom ? " - " + d.destNom : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
