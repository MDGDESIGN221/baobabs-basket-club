/* =====================================================================
   MODÈLE : AUTORISATION PARENTALE
   ---------------------------------------------------------------------
   Le formulaire que le club remet aux parents : je soussigné(e),
   parent de, née le, autorise… Des lignes à compléter au stylo ou au
   clavier, des cases à cocher (déplacements, soins, droit à l'image),
   l'engagement, et une grande boîte pour la signature du parent,
   précédée de « Lu et approuvé ». Le club contresigne. En série, une
   par enfant avec {{col.enfant}}.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  G.modeles['autorisation-parentale'] = {
    cle: 'autorisation-parentale',
    nom: "Autorisation parentale",
    famille: "Familles",
    prefixe: "AP",
    resume: "Je soussigné(e), parent de… ; cases à cocher ; signature du parent.",

    sections: [
      { titre: "L'autorisation", ouvert: true, champs: [
        { cle: 'numero',   lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe', lab: "Date", type: 'date', duo: true },
        { cle: 'objet',    lab: "Objet", type: 'texte', aide: "« la saison 2026-2027 », « le tournoi de Thiès des 3 et 4 mai »" },
        { cle: 'saison',   lab: "Saison", type: 'texte', duo: true },
        { cle: 'equipe',   lab: "Équipe", type: 'texte', duo: true }
      ]},
      { titre: "L'enfant et le parent", ouvert: true, champs: [
        { cle: 'enfant',     lab: "Nom de l'enfant", type: 'texte' },
        { cle: 'naissance',  lab: "Née le", type: 'texte', duo: true },
        { cle: 'categorie',  lab: "Catégorie", type: 'texte', duo: true },
        { cle: 'parent',     lab: "Nom du parent ou tuteur", type: 'texte' },
        { cle: 'lien',       lab: "Lien", type: 'choix', duo: true, choix: ['Père', 'Mère', 'Tuteur', 'Tutrice'] },
        { cle: 'telephone',  lab: "Téléphone", type: 'texte', duo: true },
        { cle: 'adresse',    lab: "Adresse", type: 'texte' },
        { cle: 'urgence',    lab: "Personne à prévenir en urgence", type: 'texte', duo: true },
        { cle: 'telUrgence', lab: "Son téléphone", type: 'texte', duo: true }
      ]},
      { titre: "Ce qui est autorisé", ouvert: true, champs: [
        { cle: 'autParticiper', lab: "Participer aux entraînements et matchs", type: 'bascule' },
        { cle: 'autDeplacer',   lab: "Être transportée par le club ou les parents accompagnateurs", type: 'bascule' },
        { cle: 'autSoins',      lab: "Recevoir les premiers soins et, en urgence, être conduite à l'hôpital", type: 'bascule' },
        { cle: 'autImage',      lab: "Être photographiée ou filmée pour le site et les réseaux du club", type: 'bascule' },
        { cle: 'autSortir',     lab: "Quitter seule le lieu d'entraînement", type: 'bascule' },
        { cle: 'engagement',    lab: "Engagement", type: 'zone' }
      ]},
      { titre: "Le club", ouvert: false, champs: [
        { cle: 'signNom',       lab: "Nom", type: 'texte', duo: true },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte', duo: true },
        { cle: 'avecSignature', lab: "Apposer la signature", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule' }
      ]}
    ],

    defauts: function () {
      var an = new Date().getFullYear();
      return {
        titre: "Autorisation parentale", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar",
        objet: "la saison " + an + "-" + (an + 1), saison: an + "-" + (an + 1), equipe: "",
        enfant: "", naissance: "", categorie: "", parent: "", lien: "Mère", telephone: "", adresse: "", urgence: "", telUrgence: "",
        autParticiper: true, autDeplacer: true, autSoins: true, autImage: false, autSortir: false,
        engagement: "Je m'engage à informer le club de tout problème de santé de mon enfant, à fournir le certificat médical d'aptitude, et à régler la cotisation dans les délais. J'ai pris connaissance du règlement intérieur du club et je l'accepte.",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président",
        avecSignature: true, avecCachet: true,
        tables: {}
      };
    },

    controles: function (d) {
      var c = [];
      if (!String(d.enfant || '').trim()) c.push({ n: 'avert', t: 'Le nom de l\'enfant est vide : une ligne à remplir au stylo' });
      if (!String(d.objet || '').trim()) c.push({ n: 'erreur', t: 'Pour quoi est donnée l\'autorisation ?' });
      return c;
    },

    page: [
      { b: 'entete', droite: function (d) { return [(d.lieu || '') + ", le " + U.dateLongue(d.dateActe, false), d.numero ? "Autorisation n° " + d.numero : (d.saison ? "Saison " + d.saison : '')]; } },
      { b: 'titre', etiquette: "Familles", pastille: '@equipe', texte: "Autorisation parentale", sous: function (d) { return "Pour " + (d.objet || ''); } },
      { b: 'grille', colonnes: 2, champs: [
          { label: "Je soussigné(e)", chemin: 'parent', large: true },
          { label: "Lien avec l'enfant", chemin: 'lien' }, { label: "Téléphone", chemin: 'telephone' },
          { label: "Adresse", chemin: 'adresse', large: true },
          { label: "Parent de", chemin: 'enfant', large: true },
          { label: "Née le", chemin: 'naissance' }, { label: "Catégorie", chemin: 'categorie' },
          { label: "À prévenir en urgence", chemin: 'urgence' }, { label: "Téléphone", chemin: 'telUrgence' } ] },
      { b: 'cases', etiquette: "Autorise mon enfant à", cases: function (d) {
          return [{ texte: "Participer aux entraînements, matchs et tournois organisés par le club", chemin: 'autParticiper' },
                  { texte: "Être transportée par les véhicules du club ou des parents accompagnateurs", chemin: 'autDeplacer' },
                  { texte: "Recevoir les premiers soins et, en cas d'urgence, être conduite dans un établissement de santé", chemin: 'autSoins' },
                  { texte: "Être photographiée ou filmée lors des activités, pour le site et les réseaux du club", chemin: 'autImage' },
                  { texte: "Quitter seule le lieu d'entraînement à la fin de la séance", chemin: 'autSortir' }];
        } },
      { b: 'texte', etiquette: "Engagement", texte: '@engagement' },
      { b: 'signatureLibre', boites: [{ label: "Signature du parent ou tuteur", mention: "Précédée de la mention « Lu et approuvé », avec la date" }] },
      { b: 'signatures', gauche: function (d) { return { lieuDate: "Reçu par le club à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "", reference: d.numero ? "BBC / AP / " + String(d.numero).replace('/', ' / ') : '' }; },
        cartes: [{ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite', mention: "Signature et cachet" }] }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280", "Autorisation parentale" + (d.enfant ? " · " + d.enfant : '')]; },
    fichier: function (d) { return "Autorisation parentale" + (d.enfant ? " - " + d.enfant : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
