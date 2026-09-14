/* =====================================================================
   MODÈLE : RAPPORT DE SAISON
   ---------------------------------------------------------------------
   Le bilan d'une saison, pour l'assemblée générale ou le bureau : ce
   que l'équipe a joué, ce que l'école a réuni, ce que la caisse a vu
   passer, et ce qu'on veut pour la suite. Les chiffres viennent de
   l'admin (« La saison » les calcule et les pose ici) ; on peut les
   corriger à la main, mais on ne les tape jamais de mémoire.

   Quatre parties : le sportif (repères + les meilleures marqueuses),
   l'école, les finances (un tableau de postes), les perspectives. Deux
   signatures : le président et le secrétaire général.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  function v(x, repli) { return String(x == null ? '' : x).trim() || repli; }
  function ref(d) { return d.numero ? 'BBC / RS / ' + String(d.numero).replace('/', ' / ') : ''; }

  G.modeles['rapport-saison'] = {
    cle: 'rapport-saison',
    nom: "Rapport de saison",
    famille: "Gouvernance",
    prefixe: "RS",
    resume: "Le bilan d'une saison : sportif, école, finances, perspectives. Rempli par l'admin.",

    sections: [
      { titre: "La saison", ouvert: true, champs: [
        { cle: 'saison',      lab: "Saison", type: 'texte', duo: true },
        { cle: 'numero',      lab: "Numéro", type: 'texte', duo: true },
        { cle: 'competition', lab: "Compétition", type: 'texte' },
        { cle: 'dateActe',    lab: "Arrêté le", type: 'date', duo: true },
        { cle: 'lieu',        lab: "Fait à", type: 'texte', duo: true },
        { cle: 'presente',    lab: "Présenté à", type: 'texte', aide: "« l'assemblée générale du 12 juillet 2027 », « au bureau »…" },
        { cle: 'intro',       lab: "Introduction", type: 'zone', lignes: 4 }
      ]},
      { titre: "Le sportif", ouvert: true, champs: [
        { cle: 'matchsJoues', lab: "Matchs joués", type: 'texte', duo: true },
        { cle: 'victoires',   lab: "Victoires", type: 'texte', duo: true },
        { cle: 'defaites',    lab: "Défaites", type: 'texte', duo: true },
        { cle: 'ptsPour',     lab: "Points marqués", type: 'texte', duo: true },
        { cle: 'ptsContre',   lab: "Points encaissés", type: 'texte', duo: true },
        { cle: 'effectif',    lab: "Joueuses", type: 'texte', duo: true },
        { cle: 'presence',    lab: "Présence aux entraînements", type: 'texte', duo: true },
        { cle: 'sportifTexte', lab: "Commentaire", type: 'zone', lignes: 5 }
      ]},
      { titre: "Les meilleures marqueuses", ouvert: false, special: 'table', source: 'marqueuses' },
      { titre: "L'école de basket", ouvert: true, champs: [
        { cle: 'ecoleInscrits', lab: "Enfants inscrits", type: 'texte', duo: true },
        { cle: 'ecoleSeances',  lab: "Séances", type: 'texte', duo: true },
        { cle: 'ecolePresence', lab: "Présence", type: 'texte', duo: true },
        { cle: 'ecoleTexte',    lab: "Commentaire", type: 'zone', lignes: 4 }
      ]},
      { titre: "Les finances", ouvert: true, champs: [
        { cle: 'recettes', lab: "Recettes", type: 'texte', duo: true },
        { cle: 'depenses', lab: "Dépenses", type: 'texte', duo: true },
        { cle: 'solde',    lab: "Solde", type: 'texte', duo: true },
        { cle: 'avance',   lab: "Avance du président à rembourser", type: 'texte', duo: true },
        { cle: 'financesTexte', lab: "Commentaire", type: 'zone', lignes: 4 }
      ]},
      { titre: "Le détail des finances", ouvert: false, special: 'table', source: 'finances' },
      { titre: "Les perspectives", ouvert: true, champs: [
        { cle: 'perspectives', lab: "La saison prochaine", type: 'zone', lignes: 6 }
      ]},
      { titre: "Les signatures", ouvert: false, champs: [
        { cle: 'signNom',       lab: "Président", type: 'texte', duo: true },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte', duo: true },
        { cle: 'avecSignature', lab: "Apposer la signature", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule' },
        { cle: 'secondNom',     lab: "Secrétaire général", type: 'texte', duo: true },
        { cle: 'secondQualite', lab: "Qualité", type: 'texte', duo: true }
      ]}
    ],

    defauts: function () {
      var an = new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1;
      var saison = an + "-" + (an + 1);
      return {
        saison: saison, numero: "", competition: "",
        dateActe: U.isoDuJour(), lieu: "Dakar", presente: "à l'assemblée générale",
        intro: "Le présent rapport rend compte de la saison " + saison + " du Baobabs Basket Club : "
             + "les résultats de l'équipe, la vie de l'école de basket, la situation financière du club, "
             + "et les orientations proposées pour la saison à venir.",
        matchsJoues: "", victoires: "", defaites: "", ptsPour: "", ptsContre: "", effectif: "", presence: "",
        sportifTexte: "",
        ecoleInscrits: "", ecoleSeances: "", ecolePresence: "", ecoleTexte: "",
        recettes: "", depenses: "", solde: "", avance: "", financesTexte: "",
        perspectives: "",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président",
        avecSignature: true, avecCachet: true,
        secondNom: "", secondQualite: "Secrétaire général",
        styles: { b1: { theme: 'vert' } },
        tables: {
          marqueuses: {
            titre: "Les meilleures marqueuses", singulier: "joueuse", vide: 0,
            colonnes: [
              { cle: 'nom',     titre: "Joueuse", poids: 46, forme: 'fort' },
              { cle: 'matchs',  titre: "Matchs", poids: 18, forme: 'nombre', align: 'centre' },
              { cle: 'points',  titre: "Points", poids: 18, forme: 'nombre', align: 'droite' },
              { cle: 'moyenne', titre: "Par match", poids: 18, forme: 'nombre', align: 'droite' }
            ],
            lignes: []
          },
          finances: {
            titre: "Le détail des finances", singulier: "ligne", vide: 0,
            colonnes: [
              { cle: 'poste',   titre: "Poste", poids: 60, forme: 'fort' },
              { cle: 'sens',    titre: "Sens", poids: 20, forme: 'pastille', choix: ['Recette', 'Dépense'] },
              { cle: 'montant', titre: "Montant (FCFA)", poids: 24, forme: 'nombre', align: 'droite' }
            ],
            lignes: []
          }
        }
      };
    },

    controles: function (d) {
      var c = [];
      if (!String(d.saison || '').trim()) c.push({ n: 'erreur', t: 'Pas de saison' });
      if (!String(d.matchsJoues || '').trim() && !String(d.ecoleInscrits || '').trim()) c.push({ n: 'avert', t: 'Aucun chiffre : ouvrez « La saison » dans l\'admin et posez le rapport depuis là' });
      if (!String(d.perspectives || '').trim()) c.push({ n: 'avert', t: 'Les perspectives sont vides' });
      return c;
    },

    page: [
      { b: 'entete', devise: "Section Basketball · Rapport de saison · Dakar",
        droite: function (d) { return ["Saison " + v(d.saison, ""), d.numero ? "Rapport n° " + d.numero : "Bureau du Club"]; } },

      { b: 'titre', etiquette: "Rapport de saison", pastille: function (d) { return "Saison " + v(d.saison, ""); },
        texte: function (d) { return "Bilan de la saison " + v(d.saison, ""); },
        sous: function (d) { return v(d.competition, "") + (d.presente ? (d.competition ? " · " : "") + "Présenté " + d.presente : ""); } },

      { b: 'texte', texte: '@intro' },

      { b: 'texte', etiquette: "Le sportif", titre: "L'équipe", texte: '@sportifTexte',
        si: function (d) { return !!String(d.sportifTexte || '').trim(); } },
      { b: 'reperes', cellules: function (d) {
          return [
            { label: "Matchs joués", valeur: d.matchsJoues, sous: v(d.competition, "") },
            { label: "Victoires", valeur: d.victoires, sous: d.defaites ? d.defaites + " défaite" + (Number(d.defaites) > 1 ? "s" : "") : "" },
            { label: "Points marqués", valeur: d.ptsPour, sous: d.ptsContre ? d.ptsContre + " encaissés" : "" },
            { label: "Joueuses", valeur: d.effectif, sous: d.presence ? d.presence + " de présence aux entraînements" : "" }
          ];
        } },
      { b: 'tableau', source: 'marqueuses', vide: 0,
        si: function (d) { return G.lignes(d, 'marqueuses').length > 0; } },

      { b: 'texte', etiquette: "L'école de basket", titre: "Les enfants", texte: '@ecoleTexte',
        si: function (d) { return !!String(d.ecoleTexte || d.ecoleInscrits || '').trim(); } },
      { b: 'reperes', si: function (d) { return !!String(d.ecoleInscrits || d.ecoleSeances || '').trim(); },
        cellules: function (d) {
          return [
            { label: "Enfants inscrits", valeur: d.ecoleInscrits, sous: "" },
            { label: "Séances", valeur: d.ecoleSeances, sous: "" },
            { label: "Présence", valeur: d.ecolePresence, sous: "" }
          ];
        } },

      { b: 'texte', etiquette: "Les finances", titre: "La caisse du club", texte: '@financesTexte',
        si: function (d) { return !!String(d.financesTexte || d.recettes || '').trim(); } },
      { b: 'reperes', si: function (d) { return !!String(d.recettes || d.depenses || '').trim(); },
        cellules: function (d) {
          return [
            { label: "Recettes", valeur: d.recettes, sous: "FCFA" },
            { label: "Dépenses", valeur: d.depenses, sous: "FCFA" },
            { label: "Solde", valeur: d.solde, sous: "FCFA" },
            { label: "Avance du Président", valeur: d.avance, sous: "À rembourser, FCFA" }
          ];
        } },
      { b: 'tableau', source: 'finances', vide: 0,
        si: function (d) { return G.lignes(d, 'finances').length > 0; } },

      { b: 'encadre', etiquette: "Les perspectives", titre: function (d) { return "La saison prochaine"; }, apres: '@perspectives',
        si: function (d) { return !!String(d.perspectives || '').trim(); } },

      { b: 'signatures',
        gauche: function (d) {
          return { lieuDate: "Arrêté à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>",
                   note: "Rapport établi d'après les registres du club (feuilles de match, appels, caisse).",
                   reference: ref(d) };
        },
        cartes: function (d) {
          return [
            { pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite', mention: "Signature et cachet" },
            { pour: "Le secrétaire général", nom: '@secondNom', qualite: '@secondQualite', mention: "Signature", signer: false, cacheter: false }
          ];
        } }
    ],

    pied: function (d) {
      return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280",
              "Rapport de saison " + v(d.saison, "") + (d.numero ? " · n° " + d.numero : "")];
    },
    fichier: function (d) { return "Rapport de saison " + v(d.saison, "") + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
