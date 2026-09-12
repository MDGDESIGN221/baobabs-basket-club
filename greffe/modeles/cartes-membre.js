/* =====================================================================
   MODÈLE : CARTES DE MEMBRE
   ---------------------------------------------------------------------
   Huit cartes par page, au format carte bancaire, une par ligne du
   tableau : nom, prénom, catégorie, licence, date de naissance. On
   colle la liste de l'équipe, on imprime, on découpe, on plastifie.
   Une case pour la photo. La saison en pied. Rien d'autre sur la page.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  G.modeles['cartes-membre'] = {
    cle: 'cartes-membre',
    nom: "Cartes de membre",
    famille: "Vie sportive",
    prefixe: "",
    resume: "Huit cartes par page, une par ligne de la liste, à découper.",

    sections: [
      { titre: "Les cartes", ouvert: true, champs: [
        { cle: 'saison',   lab: "Saison", type: 'texte', duo: true },
        { cle: 'role',     lab: "Mention", type: 'texte', duo: true, aide: "« Carte de membre », « Licence club », « Staff »" },
        { cle: 'pied',     lab: "Ligne de pied", type: 'texte', aide: "« Valable jusqu'au 30 juin 2027 »" },
        { cle: 'dateActe', lab: "Établies le", type: 'date', duo: true },
        { cle: 'vides',    lab: "Cartes vierges à imprimer en plus", type: 'texte', duo: true, aide: "Un nombre : des cartes sans nom, à remplir au stylo." }
      ]},
      { titre: "Les membres", ouvert: true, special: 'table', source: 'membres' }
    ],

    defauts: function () {
      var an = new Date().getFullYear();
      return {
        titre: "Cartes de membre", dateActe: U.isoDuJour(), lieu: "Dakar",
        saison: an + "-" + (an + 1), role: "Carte de membre", pied: "Valable pour la saison en cours", vides: "",
        avecSignature: false, avecCachet: false,
        tables: {
          membres: {
            titre: "Les membres", singulier: "membre", vide: 0,
            colonnes: [
              { cle: 'prenom',    titre: "Prénom(s)", poids: 30, forme: 'fort' },
              { cle: 'nom',       titre: "Nom", poids: 30, forme: 'fort' },
              { cle: 'categorie', titre: "Catégorie", poids: 20, forme: 'pastille', align: 'centre', choix: ['U12', 'U14', 'U16', 'U18', 'Senior', 'Staff', 'Bureau'] },
              { cle: 'licence',   titre: "N° licence", poids: 24, forme: 'code' },
              { cle: 'naissance', titre: "Née le", poids: 22, forme: 'code', align: 'centre' }
            ],
            lignes: []
          }
        }
      };
    },

    controles: function (d) {
      var c = [];
      var n = G.lignes(d, 'membres').length;
      if (!n && !(parseInt(d.vides, 10) > 0)) c.push({ n: 'erreur', t: 'Aucun membre, aucune carte vierge' });
      else c.push({ n: 'ok', t: n + ' carte' + (n > 1 ? 's' : '') + (parseInt(d.vides, 10) > 0 ? ' + ' + parseInt(d.vides, 10) + ' vierge(s)' : '') });
      return c;
    },

    page: [
      { b: 'cartes', source: 'membres', club: "Baobabs Basket Club", saison: '@saison', role: '@role', pied: '@pied',
        vide: function (d) { return G.lignes(d, 'membres').length + (parseInt(d.vides, 10) || 0); } }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal", "Cartes de membre · saison " + (d.saison || '')]; },
    fichier: function (d) { return "Cartes de membre - saison " + (d.saison || '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
