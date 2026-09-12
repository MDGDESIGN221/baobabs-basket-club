/* =====================================================================
   MODÈLE : CONVOCATION
   ---------------------------------------------------------------------
   Un match, un stage, une assemblée : le club convoque. Un bandeau
   noir avec le grand mot, l'essentiel en cases (quoi, quand, où,
   rendez-vous), les consignes, la liste des convoquées, ce qu'il faut
   apporter à cocher. Prévue pour la série : une convocation par
   joueuse avec {{col.nom}}, ou une seule avec la liste.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  G.modeles['convocation'] = {
    cle: 'convocation',
    nom: "Convocation",
    famille: "Vie sportive",
    prefixe: "CV",
    resume: "Quoi, quand, où, rendez-vous ; les convoquées ; ce qu'il faut apporter.",

    sections: [
      { titre: "L'événement", ouvert: true, champs: [
        { cle: 'numero',    lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Établie le", type: 'date', duo: true },
        { cle: 'nature',    lab: "Nature", type: 'choix', duo: true, choix: ['Match', 'Tournoi', 'Entraînement', 'Stage', 'Assemblée générale', 'Réunion', 'Cérémonie'] },
        { cle: 'equipe',    lab: "Équipe ou public", type: 'texte', duo: true },
        { cle: 'evenement', lab: "Intitulé", type: 'texte', aide: "« Match de championnat contre DUC », « Assemblée générale ordinaire »" },
        { cle: 'jour',      lab: "Date de l'événement", type: 'date', duo: true },
        { cle: 'heure',     lab: "Heure", type: 'texte', duo: true },
        { cle: 'lieuEv',    lab: "Lieu", type: 'texte', duo: true },
        { cle: 'rdv',       lab: "Rendez-vous", type: 'texte', duo: true, aide: "« 14 h 30 au club »" },
        { cle: 'adversaire', lab: "Adversaire (match)", type: 'texte', duo: true },
        { cle: 'tenue',     lab: "Tenue", type: 'texte', duo: true }
      ]},
      { titre: "Le message", ouvert: true, champs: [
        { cle: 'destinataire', lab: "Adressée à", type: 'texte', aide: "Vide : la liste ci-dessous. En série : {{col.nom}}." },
        { cle: 'corps',        lab: "Texte", type: 'zone' },
        { cle: 'consignes',    lab: "Consignes", type: 'zone', aide: "Un point par ligne, avec un tiret." }
      ]},
      { titre: "Les convoquées", ouvert: true, special: 'table', source: 'convoquees' },
      { titre: "Le signataire", ouvert: false, champs: [
        { cle: 'signNom',       lab: "Nom", type: 'texte', duo: true },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte', duo: true },
        { cle: 'avecSignature', lab: "Apposer la signature", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule' }
      ]}
    ],

    defauts: function () {
      return {
        titre: "Convocation", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar",
        nature: "Match", equipe: "", evenement: "", jour: "", heure: "", lieuEv: "", rdv: "", adversaire: "", tenue: "Tenue du club, chaussures de salle",
        destinataire: "",
        corps: "Vous êtes convoquée pour l'événement ci-dessous. La présence est obligatoire ; en cas d'empêchement, prévenez le coach au plus tôt.",
        consignes: "- Arriver au rendez-vous à l'heure indiquée\n- Licence et pièce d'identité sur soi\n- Bouteille d'eau et collation",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président",
        avecSignature: true, avecCachet: true,
        tables: {
          convoquees: {
            titre: "Les convoquées", singulier: "convoquée", vide: 0,
            colonnes: [
              { cle: 'nom',   titre: "Nom et prénom(s)", poids: 46, forme: 'fort' },
              { cle: 'cat',   titre: "Catégorie", poids: 20, forme: 'pastille', align: 'centre', choix: ['U12', 'U14', 'U16', 'U18', 'Senior'] },
              { cle: 'poste', titre: "Poste", poids: 22, align: 'centre' },
              { cle: 'maillot', titre: "N°", poids: 12, forme: 'nombre', align: 'centre' },
              { cle: 'presence', titre: "Présence", poids: 22, align: 'centre' }
            ],
            lignes: []
          }
        }
      };
    },

    controles: function (d) {
      var c = [];
      if (!String(d.evenement || '').trim()) c.push({ n: 'erreur', t: 'Pas d\'intitulé' });
      if (!U.dateDe(d.jour)) c.push({ n: 'erreur', t: 'Pas de date d\'événement' });
      if (!String(d.lieuEv || '').trim()) c.push({ n: 'avert', t: 'Pas de lieu' });
      if (!String(d.destinataire || '').trim() && !G.lignes(d, 'convoquees').length) c.push({ n: 'avert', t: 'Ni destinataire ni liste de convoquées' });
      return c;
    },

    page: [
      { b: 'entete', droite: function (d) { return [(d.lieu || '') + ", le " + U.dateLongue(d.dateActe, false), d.numero ? "Convocation n° " + d.numero : ""]; } },
      { b: 'bandeau', ton: 'noir', etiquette: function (d) { return d.nature || 'Convocation'; }, texte: "Convocation",
        sous: '@evenement', droite: function (d) { return [U.dateLongue(d.jour, false) || "Date à préciser", d.heure ? d.heure + (d.lieuEv ? " · " + d.lieuEv : '') : (d.lieuEv || '')]; } },
      { b: 'reperes', cellules: function (d) {
          return [{ label: "Quand", valeur: U.dateLongue(d.jour, true) || '', sous: d.heure || '' }, { label: "Où", valeur: '@lieuEv' },
                  { label: "Rendez-vous", valeur: '@rdv' }, d.adversaire ? { label: "Adversaire", valeur: '@adversaire' } : { label: "Tenue", valeur: '@tenue' }];
        } },
      { b: 'parties', si: function (d) { return !!String(d.destinataire || '').trim(); },
        parties: function (d) { return [{ label: "Adressée à", nom: '@destinataire', texte: d.equipe ? d.equipe : '', tag: '' }]; } },
      { b: 'texte', texte: '@corps' },
      { b: 'tableau', source: 'convoquees', si: function (d) { return G.lignes(d, 'convoquees').length > 0; } },
      { b: 'texte', etiquette: "Consignes", texte: '@consignes' },
      { b: 'cases', etiquette: "À apporter", enLigne: true, cases: [{ texte: "Licence" }, { texte: "Pièce d'identité" }, { texte: "Tenue complète" }, { texte: "Bouteille d'eau" }, { texte: "Autorisation parentale" }] },
      { b: 'signatures', gauche: function (d) { return { lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "", reference: d.numero ? "BBC / CV / " + String(d.numero).replace('/', ' / ') : '' }; },
        cartes: [{ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite', mention: "Signature et cachet" }] }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280", "Convocation" + (d.evenement ? " · " + d.evenement : '')]; },
    fichier: function (d) { return "Convocation" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : '') + (d.destinataire ? " - " + d.destinataire : (d.equipe ? " - " + d.equipe : '')) + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
