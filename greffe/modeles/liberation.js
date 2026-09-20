/* =====================================================================
   MODÈLE : LETTRE DE LIBÉRATION
   ---------------------------------------------------------------------
   Une joueuse quitte le club. Le club atteste qu'elle est libre de tout
   engagement envers lui, dit depuis quand et pourquoi, et qu'aucune
   somme n'est due de part ni d'autre. C'est le papier que le club
   suivant et la fédération demandent. Une page, courte, sans article :
   une attestation, la signature du président.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  function v(x, repli) { return String(x || '').trim() || repli; }
  function fem(d) { return !/joueur$/i.test(String(d.genre || 'Joueuse')); }
  function ee(d) { return fem(d) ? "e" : ""; }

  G.modeles['liberation'] = {
    cle: 'liberation',
    nom: "Lettre de libération",
    famille: "Conventions et contrats",
    prefixe: "LB",
    resume: "Une joueuse quitte le club : libre de tout engagement, depuis quand, rien n'est dû.",

    sections: [
      { titre: "La libération", ouvert: true, champs: [
        { cle: 'numero',    lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Fait le", type: 'date', duo: true },
        { cle: 'lieu',      lab: "Fait à", type: 'texte', duo: true },
        { cle: 'effet',     lab: "Libre à compter du", type: 'date', duo: true },
        { cle: 'motif',     lab: "Motif", type: 'choix', choix: ["Fin de l'engagement", "Commun accord", "Demande de la joueuse", "Décision du club"] },
        { cle: 'destinataire', lab: "À l'attention de", type: 'texte', aide: "Le club de destination ou la fédération, si vous voulez l'écrire." },
        { cle: 'situation', lab: "Situation financière", type: 'choix', choix: ["Aucune somme n'est due de part ni d'autre", "Le club a réglé ce qu'il devait", "Un solde reste à régler (précisez ci-dessous)"] },
        { cle: 'precision', lab: "Précision", type: 'zone' }
      ]},
      { titre: "La joueuse", ouvert: true, champs: [
        { cle: 'genre',     lab: "Il s'agit de", type: 'choix', duo: true, choix: ['Joueuse', 'Joueur'] },
        { cle: 'nom',       lab: "Nom et prénom(s)", type: 'texte' },
        { cle: 'naissance', lab: "Date de naissance", type: 'date', duo: true },
        { cle: 'licence',   lab: "N° de licence", type: 'texte', duo: true },
        { cle: 'arrivee',   lab: "Au club depuis", type: 'texte', duo: true, aide: "« septembre 2025 »" },
        { cle: 'categorie', lab: "Catégorie", type: 'texte', duo: true }
      ]},
      { titre: "Le signataire", ouvert: false, champs: [
        { cle: 'signNom',       lab: "Nom", type: 'texte', duo: true },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte', duo: true },
        { cle: 'avecSignature', lab: "Apposer la signature", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule' }
      ]}
    ],

    defauts: function () {
      return {
        titre: "Lettre de libération", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar", effet: U.isoDuJour(),
        motif: "Commun accord", destinataire: "", situation: "Aucune somme n'est due de part ni d'autre", precision: "",
        genre: "Joueuse", nom: "", naissance: "", licence: "", arrivee: "", categorie: "",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président",
        avecSignature: true, avecCachet: true, tables: {}
      };
    },

    controles: function (d) {
      var c = [];
      if (!String(d.nom || '').trim()) c.push({ n: 'erreur', t: 'Quelle joueuse ?' });
      if (!U.dateDe(d.effet)) c.push({ n: 'erreur', t: 'Libre à compter de quand ?' });
      if (/solde/i.test(String(d.situation || '')) && !String(d.precision || '').trim()) c.push({ n: 'avert', t: 'Un solde reste : précisez-le' });
      return c;
    },

    page: [
      { b: 'entete', droite: function (d) { return [(d.lieu || '') + ", le " + U.dateLongue(d.dateActe, false), d.numero ? "Lettre n° " + d.numero : ""]; } },
      { b: 'titre', etiquette: "Attestation", pastille: function (d) { return v(d.motif, ""); }, texte: "Lettre de libération",
        sous: function (d) { return v(d.destinataire, "") ? "À l'attention de " + d.destinataire.trim() : "Pour servir et valoir ce que de droit"; } },
      { b: 'reperes', cellules: function (d) {
          return [{ label: fem(d) ? "Joueuse" : "Joueur", valeur: v(d.nom, "") }, { label: fem(d) ? "Née le" : "Né le", valeur: U.dateLongue(d.naissance, false) },
                  { label: "Licence", valeur: v(d.licence, "") }, { label: "Libre à compter du", valeur: U.dateLongue(d.effet, false) }];
        } },
      { b: 'texte', texte: function (d) {
          var e = ee(d);
          return "Je soussigné, **" + v(d.signNom, "Antoine Jean Pierre Ndong") + "**, " + v(d.signQualite, "Président") + " de Baobabs Basket Club, "
               + "atteste que **" + v(d.nom, "……………………………") + "**" + (v(d.categorie, "") ? ", " + (fem(d) ? "joueuse" : "joueur") + " de la catégorie " + d.categorie.trim() : "")
               + (v(d.arrivee, "") ? ", membre du Club depuis " + d.arrivee.trim() : "") + ", est **libre de tout engagement** envers Baobabs Basket Club "
               + "à compter du **" + U.dateLongue(d.effet, false) + "**, " + ({ "Fin de l'engagement": "au terme de son engagement", "Commun accord": "d'un commun accord",
                 "Demande de la joueuse": "à sa demande", "Décision du club": "par décision du Club" }[d.motif] || "d'un commun accord") + ".\n\n"
               + (fem(d) ? "Elle" : "Il") + " peut s'engager librement auprès de tout autre club, dans le respect des règlements de la Fédération Sénégalaise de Basketball.\n\n"
               + "**" + v(d.situation, "Aucune somme n'est due de part ni d'autre") + ".**" + (v(d.precision, "") ? "\n\n" + d.precision.trim() : "")
               + "\n\nLe Club la remercie pour son engagement et lui souhaite de réussir la suite de son parcours.";
        } },
      { b: 'signatures', gauche: function (d) { return { lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "", reference: d.numero ? 'BBC / LB / ' + String(d.numero).replace('/', ' / ') : '' }; },
        cartes: [{ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite', mention: "Signature et cachet" }] }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280", "Lettre de libération" + (d.numero ? " n° " + d.numero : '') + (d.nom ? " · " + d.nom : '')]; },
    fichier: function (d) { return "Liberation" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : '') + (d.nom ? " - " + d.nom : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
