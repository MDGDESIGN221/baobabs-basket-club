/* =====================================================================
   MODÈLE : LISTE DE LA DÉLÉGATION
   ---------------------------------------------------------------------
   Un tournoi, un stage, un déplacement : qui part. La liste officielle
   des joueuses sélectionnées avec leurs caractéristiques (poste,
   maillot, taille, naissance), puis le staff qui les accompagne et sa
   fonction sur place. Un bandeau, l'essentiel en cases, les deux
   tableaux, la mention qui engage, la signature. Le numéro de licence
   n'y est plus : « tu peux enlever le bloc licence ».

   Pré-rempli depuis l'écran Présentations de l'administration ; les
   numéros de maillot sont ceux des fiches, pas ceux d'une liste tapée
   à la main.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  G.modeles['liste-delegation'] = {
    cle: 'liste-delegation',
    nom: "Liste de la délégation",
    famille: "Vie sportive",
    prefixe: "LD",
    resume: "Les joueuses sélectionnées et le staff qui part, avec leurs caractéristiques.",

    sections: [
      { titre: "L'événement", ouvert: true, champs: [
        { cle: 'numero',       lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe',     lab: "Établie le", type: 'date', duo: true },
        { cle: 'nature',       lab: "Nature", type: 'choix', duo: true, choix: ['Tournoi', 'Match', 'Stage', 'Déplacement', 'Liste'] },
        { cle: 'equipe',       lab: "Équipe", type: 'texte', duo: true },
        { cle: 'intitule',     lab: "Intitulé", type: 'texte', aide: "« Tournoi Women's Sport International », « Stage de préparation »" },
        { cle: 'organisateur', lab: "Organisateur", type: 'texte', duo: true },
        { cle: 'dates',        lab: "Dates (telles qu'affichées)", type: 'texte', duo: true, aide: "« 23 au 29 septembre 2026 »" },
        { cle: 'jour',         lab: "Premier jour", type: 'date', duo: true },
        { cle: 'fin',          lab: "Dernier jour", type: 'date', duo: true },
        { cle: 'lieuEv',       lab: "Lieu", type: 'texte' }
      ]},
      { titre: "Les joueuses", ouvert: true, special: 'table', source: 'joueuses' },
      { titre: "Le staff", ouvert: true, special: 'table', source: 'staff' },
      { titre: "La mention", ouvert: true, champs: [
        { cle: 'mention',  lab: "Mention", type: 'zone', aide: "La phrase qui engage le club, sous les tableaux." },
        { cle: 'remarque', lab: "Remarque", type: 'zone', aide: "Facultatif : consignes de voyage, documents à emporter." }
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
        titre: "Liste de la délégation", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar",
        nature: "Tournoi", equipe: "Équipe première", intitule: "", organisateur: "", dates: "", jour: "", fin: "", lieuEv: "",
        mention: "Les joueuses ci-dessus sont sélectionnées pour représenter Baobabs Basket Club.",
        remarque: "",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président",
        avecSignature: true, avecCachet: true,
        tables: {
          joueuses: {
            titre: "Les joueuses sélectionnées", singulier: "joueuse", vide: 0, aere: true,
            colonnes: [
              { cle: 'photo',     titre: "", poids: 10, forme: 'photo', align: 'centre' },
              { cle: 'nom',       titre: "Nom et prénom(s)", poids: 40, forme: 'fort' },
              { cle: 'poste',     titre: "Poste", poids: 20 },
              { cle: 'maillot',   titre: "Maillot", poids: 12, forme: 'pastille', align: 'centre' },
              { cle: 'taille',    titre: "Taille", poids: 12, align: 'centre' },
              { cle: 'naissance', titre: "Naissance", poids: 16, align: 'centre' }
            ],
            lignes: []
          },
          staff: {
            titre: "Le staff qui accompagne", singulier: "membre du staff", vide: 0, aere: true,
            colonnes: [
              { cle: 'photo',    titre: "", poids: 9, forme: 'photo', align: 'centre' },
              { cle: 'nom',      titre: "Nom et prénom(s)", poids: 38, forme: 'fort' },
              { cle: 'fonction', titre: "Fonction sur place", poids: 33 },
              { cle: 'tel',      titre: "Téléphone", poids: 20, forme: 'code', align: 'centre' }
            ],
            lignes: []
          }
        }
      };
    },

    controles: function (d) {
      var c = [];
      if (!String(d.intitule || '').trim()) c.push({ n: 'erreur', t: 'Pas d\'intitulé' });
      if (!G.lignes(d, 'joueuses').length) c.push({ n: 'erreur', t: 'Aucune joueuse dans la liste' });
      if (!String(d.lieuEv || '').trim()) c.push({ n: 'avert', t: 'Pas de lieu' });
      if (!String(d.dates || '').trim() && !U.dateDe(d.jour)) c.push({ n: 'avert', t: 'Pas de dates' });
      if (!G.lignes(d, 'staff').length) c.push({ n: 'avert', t: 'Aucun membre du staff : personne n\'accompagne ?' });
      return c;
    },

    page: [
      { b: 'entete', droite: function (d) { return [(d.lieu || '') + ", le " + U.dateLongue(d.dateActe, false), d.numero ? "Liste n° " + d.numero : ""]; } },
      { b: 'bandeau', ton: 'noir', etiquette: function (d) { return d.nature || 'Délégation'; }, texte: "Liste de la délégation",
        sous: '@intitule', droite: function (d) { return [d.dates || U.dateLongue(d.jour, false) || "Dates à préciser", d.lieuEv || '']; } },
      { b: 'reperes', cellules: function (d) {
          var nj = G.lignes(d, 'joueuses').length, ns = G.lignes(d, 'staff').length;
          return [{ label: "Joueuses", valeur: nj ? String(nj) : '0', sous: d.equipe || '' },
                  { label: "Staff", valeur: ns ? String(ns) : '0', sous: ns ? "accompagnent" : '' },
                  { label: "Quand", valeur: d.dates || U.dateLongue(d.jour, true) || '', sous: d.fin && d.jour ? "jusqu'au " + U.dateLongue(d.fin, false) : '' },
                  { label: "Où", valeur: '@lieuEv', sous: d.organisateur ? "org. " + d.organisateur : '' }];
        } },
      { b: 'tableau', source: 'joueuses', tonPastille: function () { return 'ton-plein'; } },
      { b: 'tableau', source: 'staff', si: function (d) { return G.lignes(d, 'staff').length > 0; } },
      { b: 'texte', etiquette: "Mention", texte: '@mention' },
      { b: 'texte', etiquette: "Remarque", texte: '@remarque', si: function (d) { return !!String(d.remarque || '').trim(); } },
      { b: 'signatures', gauche: function (d) { return { lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "", reference: d.numero ? "BBC / LD / " + String(d.numero).replace('/', ' / ') : '' }; },
        cartes: [{ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite', mention: "Signature et cachet" }] }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280", "Liste de la délégation" + (d.intitule ? " · " + d.intitule : '')]; },
    fichier: function (d) { return "Liste de la delegation" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : '') + (d.intitule ? " - " + d.intitule : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
