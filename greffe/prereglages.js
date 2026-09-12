/* =====================================================================
   LES PRÉRÉGLAGES LIVRÉS AVEC LE GREFFE
   ---------------------------------------------------------------------
   Un préréglage = un modèle et ses données, sans numéro : l'acte
   s'ouvre déjà composé, il ne reste qu'à écrire sur la feuille. Ceux-ci
   sont des actes libres (une liste de blocs et leurs tableaux) pour les
   besoins courants d'un bureau de club. Les siens se gardent depuis
   l'atelier (« Préréglage ») et se déposent en fichier .json.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;
  var aujourdhui = U.dateLongue(U.isoDuJour(), false);
  var aujourdhuiJour = U.dateLongue(U.isoDuJour(), true);

  function entete(ligne1, ligne2, drapeau) {
    return { b: 'entete', nom: "BAOBABS BASKET CLUB", devise: "Grandir ici. Régner partout.",
             ligne1: ligne1 || "Récépissé n° 8280", ligne2: ligne2 || "Dakar, le " + aujourdhui,
             drapeau: drapeau !== false };
  }
  function titre(etiquette, texte, sous, pastille) {
    return { b: 'titre', etiquette: etiquette, pastille: pastille || "", texte: texte, sous: sous || "" };
  }
  function reperes(cases) {
    return { b: 'reperes', nb: String(cases.length), cellules: cases.map(function (c) {
      return { label: c[0], valeur: c[1] || "", sous: c[2] || "" };
    }) };
  }
  function texte(t, etiquette, titreTexte) {
    return { b: 'texte', etiquette: etiquette || "", titre: titreTexte || "", texte: t };
  }
  function encadre(etiquette, t, corps) {
    return { b: 'encadre', etiquette: etiquette, titre: t || "", texte: corps || "" };
  }
  function phrase(t) { return { b: 'phrase', texte: t }; }
  function saut() { return { b: 'saut' }; }
  function signatures(cartes, note) {
    var base = [
      { pour: "Pour Baobabs Basket Club", nom: "Antoine Jean Pierre Ndong", qualite: "Président", mention: "Signature et cachet du Président", encre: true },
      { pour: "", nom: "", qualite: "", mention: "Signature", encre: false },
      { pour: "", nom: "", qualite: "", mention: "Signature", encre: false }];
    (cartes || []).forEach(function (c, i) { Object.keys(c).forEach(function (k) { base[i][k] = c[k]; }); });
    return { b: 'signatures', nb: String((cartes || [null]).length || 1),
             lieuDate: "Fait à Dakar, le " + aujourdhuiJour, note: note || "", reference: "", cartes: base };
  }
  function tableau(source, titreTable, colonnes, vide, numeroter) {
    return {
      bloc: { b: 'tableau', source: source, titre: "", numeroter: numeroter !== false, vide: vide || 6 },
      table: { titre: titreTable, singulier: 'ligne', colonnes: colonnes, lignes: [] }
    };
  }
  var PERSONNES = [
    { cle: 'nom', titre: "Nom et prénom(s)", poids: 50, forme: 'fort' },
    { cle: 'qualite', titre: "Qualité", poids: 30, forme: 'pastille', choix: ['Joueuse', 'Joueur', 'Coach', 'Dirigeant', 'Parent', 'Invité'] },
    { cle: 'telephone', titre: "Téléphone", poids: 28, forme: 'code' },
    { cle: 'observations', titre: "Observations", poids: 34 }];
  var EMARGEMENT = [
    { cle: 'nom', titre: "Nom et prénom(s)", poids: 46, forme: 'fort' },
    { cle: 'qualite', titre: "Qualité", poids: 26 },
    { cle: 'present', titre: "Présent(e)", poids: 18, align: 'centre', forme: 'pastille', choix: ['Oui', 'Non', 'Excusé(e)'] },
    { cle: 'signature', titre: "Signature", poids: 34 }];

  function libre(nom, blocs, tables, intitule) {
    return { nom: nom, modele: 'acte-libre',
             donnees: { titre: intitule || nom, lieu: "Dakar", avecSignature: true, avecCachet: true,
                        blocs: blocs, articles: null, tables: tables || {} } };
  }

  var pv = tableau('pv_presents', "Les présents", EMARGEMENT, 8);
  var conv = tableau('conv_personnes', "Les personnes convoquées", PERSONNES, 6);
  var emg = tableau('emg_liste', "Les émargements", EMARGEMENT, 16);
  var inv = tableau('inv_materiel', "Le matériel", [
    { cle: 'designation', titre: "Désignation", poids: 44, forme: 'fort' },
    { cle: 'quantite', titre: "Quantité", poids: 16, align: 'centre', forme: 'nombre' },
    { cle: 'etat', titre: "État", poids: 22, align: 'centre', forme: 'pastille', choix: ['Bon', 'Usé', 'À remplacer', 'Manquant'] },
    { cle: 'lieu', titre: "Rangement", poids: 24 },
    { cle: 'observations', titre: "Observations", poids: 30 }], 10);
  var dep = tableau('dep_lignes', "Les dépenses", [
    { cle: 'date', titre: "Date", poids: 18, align: 'centre', forme: 'code' },
    { cle: 'libelle', titre: "Libellé", poids: 50, forme: 'fort' },
    { cle: 'piece', titre: "Justificatif", poids: 26 },
    { cle: 'montant', titre: "Montant (FCFA)", poids: 26, align: 'droite', forme: 'nombre', total: true }], 8);

  G.prereglages = [
    libre("Attestation", [
      entete(),
      titre("Document officiel du club", "Attestation", ""),
      texte("Je soussigné, **Antoine Jean Pierre Ndong**, Président de Baobabs Basket Club, atteste que "
          + "\n\nEn foi de quoi, la présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit."),
      signatures([{}])
    ]),

    libre("Procès-verbal de réunion", [
      entete("Bureau de la Section Basketball", "Dakar, le " + aujourdhui, false),
      titre("Bureau du club", "Procès-verbal de réunion", "Réunion du bureau de Baobabs Basket Club"),
      reperes([["Date", aujourdhui], ["Lieu", "Sicap Baobab, Dakar"], ["Heure", ""], ["Président de séance", "Antoine Jean Pierre Ndong"]]),
      pv.bloc,
      phrase("Ordre du jour et décisions :"),
      { b: 'articles' },
      signatures([{ pour: "Le Président", nom: "Antoine Jean Pierre Ndong", qualite: "Président" },
                  { pour: "Le Secrétaire Général", nom: "", qualite: "Secrétaire Général", mention: "Signature", encre: false }],
                 "La séance est levée. Le présent procès-verbal est signé par le Président et le Secrétaire Général.")
    ], { pv_presents: pv.table }),

    libre("Note de service", [
      entete("Bureau de la Section Basketball", "Dakar, le " + aujourdhui, false),
      titre("Interne", "Note de service", "", "Note"),
      reperes([["Date", aujourdhui], ["De", "Le Président"], ["À", "Tout le staff"], ["Objet", ""]]),
      texte("La présente note "),
      signatures([{}])
    ]),

    libre("Décision du Président", [
      entete(),
      titre("Document officiel du club", "Décision", ""),
      encadre("Objet", "", ""),
      phrase("Le Président de Baobabs Basket Club décide :"),
      { b: 'articles' },
      signatures([{}], "La présente décision prend effet à sa signature.")
    ]),

    libre("Convocation", [
      entete(),
      titre("Document officiel du club", "Convocation", ""),
      reperes([["Date", ""], ["Heure", ""], ["Lieu", "Sicap Baobab, Dakar"], ["Objet", ""]]),
      texte("Les personnes dont les noms suivent sont convoquées à "
          + "\n\nLa présence de chacun est obligatoire ; toute absence doit être justifiée auprès du Président."),
      conv.bloc,
      signatures([{}])
    ], { conv_personnes: conv.table }),

    libre("Liste d'émargement", [
      entete("Bureau de la Section Basketball", "Dakar, le " + aujourdhui, false),
      titre("Bureau du club", "Liste d'émargement", ""),
      reperes([["Date", aujourdhui], ["Lieu", "Sicap Baobab, Dakar"], ["Objet", ""]]),
      emg.bloc,
      signatures([{}])
    ], { emg_liste: emg.table }),

    libre("Inventaire du matériel", [
      entete("Bureau de la Section Basketball", "Dakar, le " + aujourdhui, false),
      titre("Bureau du club", "Inventaire du matériel", "État du matériel sportif et administratif du club"),
      reperes([["Date", aujourdhui], ["Lieu", "Sicap Baobab, Dakar"], ["Responsable", ""]]),
      inv.bloc,
      texte("Le présent inventaire a été dressé contradictoirement et certifié exact par les soussignés."),
      signatures([{ pour: "Le responsable du matériel", nom: "", qualite: "", mention: "Signature", encre: false },
                  { pour: "Pour Baobabs Basket Club", nom: "Antoine Jean Pierre Ndong", qualite: "Président", mention: "Signature et cachet du Président", encre: true }])
    ], { inv_materiel: inv.table }),

    libre("État des dépenses", [
      entete("Bureau de la Section Basketball", "Dakar, le " + aujourdhui, false),
      titre("Bureau du club", "État des dépenses", "Dépenses engagées et justifiées sur la période"),
      reperes([["Période", ""], ["Établi par", "La Trésorière"], ["Arrêté le", aujourdhui]]),
      dep.bloc,
      texte("Arrêté le présent état à la somme totale figurant au pied du tableau, pièces justificatives jointes."),
      signatures([{ pour: "La Trésorière", nom: "", qualite: "Trésorière", mention: "Signature", encre: false },
                  { pour: "Pour Baobabs Basket Club", nom: "Antoine Jean Pierre Ndong", qualite: "Président", mention: "Visa du Président", encre: true }])
    ], { dep_lignes: dep.table })
  ];

})(window.BaobabsGreffe);
