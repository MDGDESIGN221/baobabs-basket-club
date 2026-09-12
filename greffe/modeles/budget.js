/* =====================================================================
   MODÈLE : BUDGET PRÉVISIONNEL
   ---------------------------------------------------------------------
   Un seul tableau de lignes, chacune rattachée à un poste ; le bloc
   « postes » les regroupe, calcule les sous-totaux et le total. On ne
   tape jamais une somme : elles se refont à chaque frappe, et un poste
   nouveau naît en écrivant son nom sur une ligne.

   Les lignes de départ sont celles du budget 2026-2027 du dossier des
   actes du club, pour partir d'un document vrai. Sur ce document, deux
   sous-totaux étaient faux et se compensaient (« Transport et matchs »
   annonçait 4 275 000 pour des lignes à 3 800 000, « Logement » 5 000 000
   pour 5 475 000) : le total de 16 520 000 était juste par hasard. Ici
   les sous-totaux sont ceux des lignes, toujours, et le total aussi.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  function ref(d) {
    return d.numero ? 'BBC / BP / ' + String(d.numero).replace('/', ' / ') : '';
  }
  function v(x, repli) { return String(x || '').trim() || repli; }

  function ligne(poste, libelle, calcul, montant) {
    return { poste: poste, libelle: libelle, calcul: calcul, montant: montant };
  }

  /* ================================================================ */
  G.modeles['budget'] = {
    cle: 'budget',
    nom: "Budget prévisionnel",
    famille: "Bureau du club",
    prefixe: "BP",
    resume: "Les dépenses d'une saison par poste, sous-totaux et total calculés, avances du président.",

    sections: [
      { titre: "Le budget", ouvert: true, champs: [
        { cle: 'titre',    lab: "Intitulé", type: 'texte' },
        { cle: 'saison',   lab: "Saison",   type: 'texte', duo: true },
        { cle: 'unite',    lab: "Monnaie",  type: 'texte', duo: true },
        { cle: 'numero',   lab: "Numéro",   type: 'texte', duo: true },
        { cle: 'dateActe', lab: "Arrêté le", type: 'date', duo: true },
        { cle: 'lieu',     lab: "Fait à",   type: 'texte' },
        { cle: 'objet',    lab: "Présentation", type: 'zone',
          aide: "Le paragraphe sous le titre." },
        { cle: 'phrase',   lab: "Phrase d'ouverture", type: 'texte' }
      ]},
      { titre: "Les lignes", ouvert: true, special: 'table', source: 'lignes' },
      { titre: "Les avances", ouvert: false, champs: [
        { cle: 'avecAvances',  lab: "Faire figurer la situation des avances", type: 'bascule' },
        { cle: 'avanceMontant', lab: "Montant avancé par le président", type: 'texte', duo: true },
        { cle: 'avanceRembourser', lab: "Montant à rembourser", type: 'texte', duo: true },
        { cle: 'avancesTexte', lab: "Texte", type: 'zone', lignes: 4 }
      ]},
      { titre: "Le visa", ouvert: false, champs: [
        { cle: 'avecVisa',      lab: "Faire viser le budget par le président", type: 'bascule',
          aide: "Un document interne peut s'en passer ; un budget présenté à un partenaire, non." },
        { cle: 'signNom',       lab: "Nom", type: 'texte', duo: true },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte', duo: true },
        { cle: 'avecSignature', lab: "Apposer la signature", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule' }
      ]}
    ],

    defauts: function () {
      var an = new Date().getFullYear();
      var saison = an + "-" + (an + 1);
      return {
        titre: "Budget prévisionnel annuel",
        saison: saison,
        unite: "FCFA",
        numero: "",
        dateActe: U.isoDuJour(),
        lieu: "Dakar",
        objet: "Le présent document détaille les prévisions de dépenses du Club pour la saison " + saison
             + ", réparties par poste, ainsi que la situation des avances effectuées par le Président.",
        phrase: "Répartition des postes budgétaires :",
        avecAvances: true,
        avanceMontant: "2 703 250 FCFA",
        avanceRembourser: "2 703 250 FCFA",
        avancesTexte: "À ce jour, un montant total de **2 703 250 FCFA** a été avancé par le Président sur "
                    + "ses fonds personnels afin de permettre le démarrage des activités du club. Cette "
                    + "avance, comprise dans le présent budget et appuyée par les pièces justificatives "
                    + "correspondantes, constitue une créance du Président sur le club, à rembourser selon "
                    + "les disponibilités financières du club et les modalités approuvées par le bureau.",
        avecVisa: false,
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président",
        avecSignature: true, avecCachet: true,
        tables: {
          lignes: {
            titre: "Les lignes du budget",
            singulier: "ligne",
            colonnes: [
              /* le poste est du texte libre : un nom nouveau sur une ligne
                 crée un groupe nouveau, avec son sous-total */
              { cle: 'poste',   titre: "Poste",   poids: 34, forme: 'texte' },
              { cle: 'libelle', titre: "Libellé", poids: 46, forme: 'fort' },
              { cle: 'calcul',  titre: "Calcul",  poids: 30, forme: 'calc' },
              { cle: 'montant', titre: "Montant", poids: 24, forme: 'nombre', align: 'droite' }
            ],
            lignes: [
              ligne('Encadrement technique sur neuf mois', 'Coach principal', '120 000 × 9', '1 080 000'),
              ligne('Encadrement technique sur neuf mois', 'Coach assistant', '60 000 × 9', '540 000'),
              ligne('Encadrement technique sur neuf mois', 'Coach des petites catégories', '80 000 × 9', '720 000'),
              ligne('Encadrement technique sur neuf mois', 'Assistant des petites catégories', '40 000 × 9', '360 000'),
              ligne('Suivi médical', 'Médecin', '', '250 000'),
              ligne('Suivi médical', 'Réserve pour les frais médicaux', '', '300 000'),
              ligne('Équipements et installation', 'Deux jeux de maillots', '30 × 10 000', '300 000'),
              ligne('Équipements et installation', 'Un jeu de 15 blousons', '15 × 25 000', '375 000'),
              ligne('Équipements et installation', 'Meubles du logement', '', '700 000'),
              ligne('Équipements et installation', 'Matériel sportif de première nécessité', '', '350 000'),
              ligne('Équipements et installation', 'Quatre matelas', '4 × 80 000', '320 000'),
              ligne('Transport et matchs', 'Aide au transport des joueuses', '', '1 000 000'),
              ligne('Transport et matchs', 'Location du car', '20 000 × 20 matchs', '400 000'),
              ligne('Transport et matchs', 'Primes de victoire', '5 000 × 12 joueuses × 20 matchs', '1 200 000'),
              ligne('Transport et matchs', 'Frais de licence', '', '500 000'),
              ligne('Transport et matchs', 'Regroupements', '35 000 × 20 matchs', '700 000'),
              ligne('Logement des joueuses', 'Loyer sur douze mois', '200 000 × 12', '2 400 000'),
              ligne('Logement des joueuses', 'Commission', '', '200 000'),
              ligne('Logement des joueuses', 'Caution', '', '200 000'),
              ligne('Logement des joueuses', 'Avance', '', '200 000'),
              ligne('Charges du logement sur neuf mois', 'Wi-Fi', '15 000 × 9', '135 000'),
              ligne('Charges du logement sur neuf mois', 'Électricité', '35 000 × 9', '315 000'),
              ligne('Charges du logement sur neuf mois', 'Repas', '225 000 × 9', '2 025 000'),
              ligne('Communication, recrutement et sécurité', 'Fonds de sécurité', '', '300 000'),
              ligne('Communication, recrutement et sécurité', 'Vidéaste et création de contenus', '', '750 000'),
              ligne('Communication, recrutement et sécurité', 'Recrutement de trois joueuses', '300 000 × 3', '900 000')
            ]
          }
        }
      };
    },

    controles: function (d) {
      var c = [];
      if (!String(d.saison || '').trim()) c.push({ n: 'erreur', t: 'Pas de saison' });
      var n = G.lignes(d, 'lignes').length;
      if (!n) c.push({ n: 'erreur', t: 'Aucune ligne de budget' });
      var sansMontant = G.lignes(d, 'lignes').filter(function (l) { return !String(l.montant || '').trim(); }).length;
      if (sansMontant) c.push({ n: 'avert', t: sansMontant + ' ligne' + (sansMontant > 1 ? 's' : '') + ' sans montant' });
      return c;
    },

    page: [
      { b: 'entete', drapeau: false, devise: "Section Basketball · Budget · Dakar",
        droite: function (d) {
          return ["Saison " + v(d.saison, ""), "Document interne · Bureau du Club"];
        } },

      { b: 'titre',
        etiquette: function (d) { return v(d.titre, "Budget prévisionnel"); },
        pastille: function (d) { return "Saison " + v(d.saison, ""); },
        texte: '@titre',
        sous: '@objet' },

      { b: 'phrase', texte: '@phrase' },

      { b: 'postes', source: 'lignes', groupe: 'poste', total: 'montant',
        unite: function (d) { return v(d.unite, ""); },
        sansGroupe: "Autres dépenses",
        titreTotal: "Budget prévisionnel total" },

      { b: 'encadre',
        si: function (d) { return !!d.avecAvances; },
        etiquette: "Situation des avances",
        titre: function (d) { return "Avances du Président · Saison " + v(d.saison, ""); },
        apres: '@avancesTexte' },

      { b: 'reperes',
        si: function (d) { return !!d.avecAvances; },
        cellules: function (d) {
          return [
            { label: "Montant avancé par le Président", valeur: d.avanceMontant, sous: "Sur ses fonds personnels" },
            { label: "Montant à rembourser au Président", valeur: d.avanceRembourser, sous: "Selon les disponibilités du club" }
          ];
        } },

      { b: 'signatures',
        si: function (d) { return !!d.avecVisa; },
        gauche: function (d) {
          return {
            lieuDate: "Arrêté à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>",
            note: "Budget prévisionnel présenté au bureau du club.",
            reference: ref(d)
          };
        },
        cartes: function (d) {
          return [{ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite',
                    mention: "Visa du Président" }];
        } }
    ],

    pied: function (d) {
      return ["Baobabs Basket Club · Section Basketball · Dakar, Sénégal",
              v(d.titre, "Budget prévisionnel") + " · Saison " + v(d.saison, "")];
    },

    fichier: function (d) {
      return "Budget Previsionnel " + v(d.saison, "") + " - BAOBABS BASKET CLUB";
    }
  };

})(window.BaobabsGreffe);
