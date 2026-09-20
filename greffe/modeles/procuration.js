/* =====================================================================
   MODÈLE : PROCURATION
   ---------------------------------------------------------------------
   Le président ne peut pas être partout : quelqu'un représente le club
   à la fédération, à la banque, à la mairie, à une réunion de ligue.
   Qui mandate, qui est mandaté, pour quoi, avec quels pouvoirs et
   quelles limites, jusqu'à quand. Le président signe, le mandataire
   accepte.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  function v(x, repli) { return String(x || '').trim() || repli; }
  function fem(d) { return /^Madame/i.test(String(d.genre || '')); }

  G.modeles['procuration'] = {
    cle: 'procuration',
    nom: "Procuration",
    famille: "Gouvernance",
    prefixe: "PR",
    resume: "Quelqu'un représente le club : auprès de qui, pour quoi, avec quels pouvoirs, jusqu'à quand.",

    sections: [
      { titre: "La procuration", ouvert: true, champs: [
        { cle: 'numero',    lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Fait le", type: 'date', duo: true },
        { cle: 'lieu',      lab: "Fait à", type: 'texte', duo: true },
        { cle: 'aupres',    lab: "Auprès de", type: 'texte', aide: "« la Fédération Sénégalaise de Basketball », « la banque CBAO », « la Commune de … »" },
        { cle: 'objet',     lab: "Pour", type: 'zone', aide: "Ce que le mandataire va faire : représenter le club à l'assemblée de la ligue du 3 octobre, retirer les licences…" },
        { cle: 'pouvoirs',  lab: "Pouvoirs donnés", type: 'zone', aide: "Un par ligne, précédé d'un tiret." },
        { cle: 'limites',   lab: "Ce que le mandataire ne peut pas faire", type: 'zone' },
        { cle: 'validite',  lab: "Valable", type: 'choix', choix: ["pour l'acte décrit, une seule fois", "jusqu'à la date ci-dessous", "jusqu'à révocation écrite"] },
        { cle: 'jusquau',   lab: "Jusqu'au", type: 'date', duo: true }
      ]},
      { titre: "Le mandataire", ouvert: true, champs: [
        { cle: 'genre',     lab: "Civilité", type: 'choix', duo: true, choix: ['Monsieur', 'Madame'] },
        { cle: 'nom',       lab: "Nom et prénom(s)", type: 'texte', duo: true },
        { cle: 'fonction',  lab: "Fonction au club", type: 'texte', duo: true },
        { cle: 'naissance', lab: "Date de naissance", type: 'date', duo: true },
        { cle: 'piece',     lab: "Passeport / CNI", type: 'texte', duo: true },
        { cle: 'telephone', lab: "Téléphone", type: 'texte', duo: true }
      ]},
      { titre: "Le mandant", ouvert: false, champs: [
        { cle: 'signNom',       lab: "Nom", type: 'texte', duo: true },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte', duo: true },
        { cle: 'signPiece',     lab: "Passeport / CNI du mandant", type: 'texte' },
        { cle: 'avecSignature', lab: "Apposer la signature", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule' }
      ]}
    ],

    defauts: function () {
      return {
        titre: "Procuration", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar",
        aupres: "", objet: "", pouvoirs: "- Représenter le club et prendre la parole en son nom\n- Signer la feuille de présence et les documents de séance\n- Retirer les documents destinés au club",
        limites: "Le mandataire ne peut ni engager financièrement le club, ni signer un contrat ou une convention en son nom, ni voter une modification des statuts.",
        validite: "pour l'acte décrit, une seule fois", jusquau: "",
        genre: "Monsieur", nom: "", fonction: "", naissance: "", piece: "", telephone: "",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président", signPiece: "",
        avecSignature: true, avecCachet: true, tables: {}
      };
    },

    controles: function (d) {
      var c = [];
      if (!String(d.nom || '').trim()) c.push({ n: 'erreur', t: 'Qui est mandaté ?' });
      if (!String(d.objet || '').trim()) c.push({ n: 'erreur', t: 'Pour quoi faire ?' });
      if (/date ci-dessous/.test(String(d.validite || '')) && !U.dateDe(d.jusquau)) c.push({ n: 'erreur', t: 'Valable jusqu\'à quelle date ?' });
      if (!String(d.limites || '').trim()) c.push({ n: 'avert', t: 'Aucune limite écrite : le mandataire pourrait tout' });
      return c;
    },

    page: [
      { b: 'entete', droite: function (d) { return [(d.lieu || '') + ", le " + U.dateLongue(d.dateActe, false), d.numero ? "Procuration n° " + d.numero : ""]; } },
      { b: 'titre', etiquette: "Gouvernance", pastille: function (d) { return /une seule fois/.test(String(d.validite || '')) ? "Ponctuelle" : "Durable"; }, texte: "Procuration",
        sous: function (d) { return v(d.aupres, "") ? "Auprès de " + d.aupres.trim() : ""; } },
      { b: 'texte', texte: function (d) {
          var f = fem(d);
          return "Je soussigné, **" + v(d.signNom, "Antoine Jean Pierre Ndong") + "**, " + v(d.signQualite, "Président") + " de Baobabs Basket Club"
               + (v(d.signPiece, "") ? " (" + d.signPiece.trim() + ")" : "") + ", agissant au nom et pour le compte du Club,\n\n"
               + "**donne procuration à " + (f ? "Madame" : "Monsieur") + " " + v(d.nom, "……………………………") + "**"
               + (v(d.fonction, "") ? ", " + d.fonction.trim() + " du Club" : "")
               + (U.dateDe(d.naissance) ? ", né" + (f ? "e" : "") + " le " + U.dateLongue(d.naissance, false) : "")
               + (v(d.piece, "") ? ", " + d.piece.trim() : "") + ",\n\n"
               + "pour " + (v(d.aupres, "") ? "représenter le Club auprès de **" + d.aupres.trim() + "** et " : "") + v(d.objet, "……………………………") + ".";
        } },
      { b: 'encadre', etiquette: "Pouvoirs donnés", titre: "", avant: '@pouvoirs' },
      { b: 'encadre', si: function (d) { return !!v(d.limites, ""); }, etiquette: "Limites", titre: "", avant: '@limites' },
      { b: 'texte', texte: function (d) {
          var val = String(d.validite || '');
          var q = /date ci-dessous/.test(val) ? "jusqu'au **" + U.dateLongue(d.jusquau, false) + "**" : (/révocation/.test(val) ? "jusqu'à révocation écrite" : "pour l'acte décrit ci-dessus, une seule fois");
          return "La présente procuration est valable " + q + ". Le mandataire rend compte au Club de ce qu'il a fait en son nom. Le Club peut la révoquer à tout moment par écrit.";
        } },
      { b: 'signatures',
        gauche: function (d) { return { lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "Signature du mandant précédée de la mention « Bon pour pouvoir », celle du mandataire de « Bon pour acceptation ».", reference: d.numero ? 'BBC / PR / ' + String(d.numero).replace('/', ' / ') : '' }; },
        cartes: function (d) {
          return [{ pour: "Le mandant, pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite', mention: "Bon pour pouvoir · Signature et cachet" },
                  { pour: "Le mandataire", nom: v(d.nom, "Nom et prénom(s) :"), qualite: v(d.fonction, ""), mention: "Bon pour acceptation · Signature", signer: false, cacheter: false }];
        } }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280", "Procuration" + (d.numero ? " n° " + d.numero : '') + (d.nom ? " · " + d.nom : '')]; },
    fichier: function (d) { return "Procuration" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : '') + (d.nom ? " - " + d.nom : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
