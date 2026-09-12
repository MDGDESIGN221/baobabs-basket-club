/* =====================================================================
   MODÈLE : FEUILLE DE PRÉSENCE
   ---------------------------------------------------------------------
   Le coach l'imprime en début de mois, la punaise au vestiaire et coche
   à chaque séance. Un bandeau vert, l'équipe et la période, une grille :
   une ligne par joueuse, une colonne par séance (les dates en tête, à
   écrire ou à laisser vides), une colonne d'observations. Vingt lignes
   au moins, pour que la grille serve même vide.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  G.modeles['feuille-presence'] = {
    cle: 'feuille-presence',
    nom: "Feuille de présence",
    famille: "Vie sportive",
    prefixe: "",
    resume: "Une grille à cocher au vestiaire : joueuses en lignes, séances en colonnes.",

    sections: [
      { titre: "La feuille", ouvert: true, champs: [
        { cle: 'equipe',   lab: "Équipe", type: 'texte', duo: true, aide: "« U14 filles », « Seniors »" },
        { cle: 'coach',    lab: "Coach", type: 'texte', duo: true },
        { cle: 'periode',  lab: "Période", type: 'texte', duo: true, aide: "« Octobre 2026 »" },
        { cle: 'lieu',     lab: "Lieu d'entraînement", type: 'texte', duo: true },
        { cle: 'dateActe', lab: "Établie le", type: 'date', duo: true },
        { cle: 'horaires', lab: "Horaires", type: 'texte', duo: true },
        { cle: 'consignes', lab: "Consignes", type: 'zone', aide: "Ce qui s'imprime sous la grille : légende, rappels." }
      ]},
      { titre: "Les joueuses", ouvert: true, special: 'table', source: 'joueuses' }
    ],

    defauts: function () {
      return {
        titre: "Feuille de présence",
        equipe: "", coach: "", periode: "", lieu: "", horaires: "", dateActe: U.isoDuJour(),
        consignes: "Cocher P (présente), A (absente), E (excusée), R (retard). Trois absences non excusées : le coach prévient les parents.",
        styles: { b0: { theme: 'vert' } },
        tables: {
          joueuses: {
            titre: "", singulier: "joueuse", vide: 20,
            colonnes: [
              { cle: 'nom',  titre: "Nom et prénom(s)", poids: 46, forme: 'fort' },
              { cle: 'cat',  titre: "Cat.", poids: 14, forme: 'code', align: 'centre' },
              { cle: 's1', titre: "", poids: 12, align: 'centre' }, { cle: 's2', titre: "", poids: 12, align: 'centre' },
              { cle: 's3', titre: "", poids: 12, align: 'centre' }, { cle: 's4', titre: "", poids: 12, align: 'centre' },
              { cle: 's5', titre: "", poids: 12, align: 'centre' }, { cle: 's6', titre: "", poids: 12, align: 'centre' },
              { cle: 's7', titre: "", poids: 12, align: 'centre' }, { cle: 's8', titre: "", poids: 12, align: 'centre' },
              { cle: 'obs', titre: "Observations", poids: 30 }
            ],
            lignes: []
          }
        }
      };
    },

    controles: function (d) {
      var c = [];
      if (!String(d.equipe || '').trim()) c.push({ n: 'erreur', t: 'Quelle équipe ?' });
      if (!String(d.periode || '').trim()) c.push({ n: 'avert', t: 'Pas de période' });
      return c;
    },

    page: [
      { b: 'bandeau', ton: 'vert', etiquette: "Feuille de présence", texte: function (d) { return d.equipe || "Équipe"; },
        sous: function (d) { return [d.periode, d.lieu, d.horaires].filter(Boolean).join(" · "); },
        droite: function (d) { return [d.coach ? "Coach : " + d.coach : "", "Baobabs Basket Club"]; } },
      { b: 'tableau', source: 'joueuses', vide: 20 },
      { b: 'texte', etiquette: "Légende et consignes", texte: '@consignes' },
      { b: 'signatureLibre', boites: [{ label: "Visa du coach", mention: "En fin de période" }, { label: "Visa du bureau", mention: "" }] }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal", "Présences " + (d.equipe || '') + (d.periode ? " · " + d.periode : '')]; },
    fichier: function (d) { return "Presences " + (d.equipe || 'equipe') + (d.periode ? " - " + d.periode : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
