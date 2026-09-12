/* =====================================================================
   MODÈLE : PLANNING
   ---------------------------------------------------------------------
   La semaine du club sur une page : les créneaux en lignes, les jours
   en colonnes. Le coach le remplit une fois par saison, le punaise au
   vestiaire, l'envoie aux parents. Un bandeau clair, la grille, les
   consignes. Rien qui ressemble à un acte : c'est un tableau d'affichage.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  G.modeles['planning'] = {
    cle: 'planning',
    nom: "Planning",
    famille: "Vie sportive",
    prefixe: "",
    resume: "Les créneaux de la semaine : jours en colonnes, heures en lignes, à afficher.",

    sections: [
      { titre: "Le planning", ouvert: true, champs: [
        { cle: 'intitule',  lab: "Intitulé", type: 'texte', aide: "« Entraînements de la saison 2026-2027 », « Semaine du tournoi »" },
        { cle: 'periode',   lab: "Période", type: 'texte', duo: true },
        { cle: 'lieu',      lab: "Lieu", type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Établi le", type: 'date', duo: true },
        { cle: 'responsable', lab: "Responsable", type: 'texte', duo: true },
        { cle: 'consignes', lab: "Consignes", type: 'zone' }
      ]},
      { titre: "Les créneaux", ouvert: true, special: 'table', source: 'creneaux' }
    ],

    defauts: function () {
      var an = new Date().getFullYear();
      return {
        titre: "Planning", dateActe: U.isoDuJour(), lieu: "Terrain Sicap Baobab", periode: "Saison " + an + "-" + (an + 1),
        intitule: "Entraînements de la semaine", responsable: "",
        consignes: "Arriver dix minutes avant le créneau. En cas de pluie, le coach prévient sur le groupe des parents.",
        avecSignature: false, avecCachet: false,
        tables: {
          creneaux: {
            titre: "", singulier: "créneau", vide: 6,
            colonnes: [
              { cle: 'heure',    titre: "Heure", poids: 16, forme: 'code', align: 'centre' },
              { cle: 'lundi',    titre: "Lundi", poids: 20, align: 'centre' },
              { cle: 'mardi',    titre: "Mardi", poids: 20, align: 'centre' },
              { cle: 'mercredi', titre: "Mercredi", poids: 20, align: 'centre' },
              { cle: 'jeudi',    titre: "Jeudi", poids: 20, align: 'centre' },
              { cle: 'vendredi', titre: "Vendredi", poids: 20, align: 'centre' },
              { cle: 'samedi',   titre: "Samedi", poids: 20, align: 'centre' },
              { cle: 'dimanche', titre: "Dimanche", poids: 20, align: 'centre' }
            ],
            lignes: [
              { heure: "16 h - 17 h 30", lundi: "", mardi: "", mercredi: "École de basket", jeudi: "", vendredi: "", samedi: "École de basket", dimanche: "" },
              { heure: "17 h 30 - 19 h", lundi: "U14", mardi: "", mercredi: "U16", jeudi: "U14", vendredi: "", samedi: "U16", dimanche: "" },
              { heure: "19 h - 21 h", lundi: "", mardi: "Seniors", mercredi: "", jeudi: "Seniors", vendredi: "Seniors", samedi: "", dimanche: "Matchs" }
            ]
          }
        }
      };
    },

    controles: function (d) {
      var c = [];
      if (!G.lignes(d, 'creneaux').length) c.push({ n: 'avert', t: 'La grille est vide : elle s\'imprimera à remplir' });
      return c;
    },

    page: [
      { b: 'bandeau', ton: 'clair', etiquette: '@periode', texte: '@intitule', sous: function (d) { return [d.lieu, d.responsable ? "Responsable : " + d.responsable : ''].filter(Boolean).join(" · "); },
        droite: function (d) { return ["Baobabs Basket Club", "Établi le " + U.dateLongue(d.dateActe, false)]; } },
      { b: 'tableau', source: 'creneaux', vide: 6, numeroter: false },
      { b: 'texte', etiquette: "Consignes", texte: '@consignes' }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Grandir ici. Régner partout.", (d.intitule || "Planning") + (d.periode ? " · " + d.periode : '')]; },
    fichier: function (d) { return "Planning - " + String(d.intitule || 'semaine').slice(0, 40) + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
