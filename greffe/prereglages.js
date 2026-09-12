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
  var fdm = tableau('fdm_joueuses', "Les joueuses", [
    { cle: 'maillot', titre: "N°", poids: 12, align: 'centre', forme: 'nombre' },
    { cle: 'nom', titre: "Nom et prénom(s)", poids: 46, forme: 'fort' },
    { cle: 'licence', titre: "Licence", poids: 24, forme: 'code' },
    { cle: 'points', titre: "Points", poids: 14, align: 'centre', forme: 'nombre' },
    { cle: 'fautes', titre: "Fautes", poids: 14, align: 'centre', forme: 'nombre' }], 12, false);
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

    libre("Communiqué", [
      entete(),
      titre("Communication du club", "Communiqué", "", "Communiqué"),
      reperes([["Date", aujourdhui], ["De", "Le Président"], ["Diffusion", "Joueuses, staff, parents, partenaires"]]),
      texte("Baobabs Basket Club informe "),
      signatures([{}])
    ]),

    libre("Message aux parents", [
      entete("Bureau de la Section Basketball", "Dakar, le " + aujourdhui, false),
      titre("Aux parents et tuteurs", "Message aux parents", "", "Information"),
      texte("Chers parents,\n\nBaobabs Basket Club vous informe que \n\nNous comptons sur votre soutien et restons à votre disposition pour toute question.", "", ""),
      texte("**Contact du club :** (téléphone) · (courriel)"),
      signatures([{}])
    ]),

    libre("Feuille de match", [
      entete("Section Basketball", "Dakar, le " + aujourdhui, false),
      titre("Compétition", "Feuille de match", "", "Match"),
      reperes([["Date", ""], ["Lieu", ""], ["Adversaire", ""], ["Résultat", ""]]),
      fdm.bloc,
      texte("**Coach :** \n\n**Arbitres :** \n\n**Observations :** "),
      signatures([{ pour: "Le coach", nom: "", qualite: "Coach", mention: "Signature", encre: false },
                  { pour: "Pour Baobabs Basket Club", nom: "Antoine Jean Pierre Ndong", qualite: "Président", mention: "Signature et cachet du Président", encre: true }])
    ], { fdm_joueuses: fdm.table }),

    libre("Demande d'autorisation parentale", [
      entete(),
      titre("Document officiel du club", "Demande d'autorisation parentale", "À retourner au club, signée, avant le déplacement"),
      reperes([["Déplacement", ""], ["Lieu", ""], ["Du", ""], ["Au", ""]]),
      texte("Je soussigné(e), **(nom du parent ou tuteur)**, autorise ma fille **(nom de la joueuse)**, née le (date), à participer au déplacement organisé par Baobabs Basket Club ci-dessus, sous la responsabilité du chef de délégation, et à recevoir tout soin médical d'urgence que son état nécessiterait.\n\n**Téléphone du parent :** \n\n**Personne à prévenir en cas d'urgence :** "),
      signatures([{ pour: "Le parent ou tuteur", nom: "", qualite: "", mention: "Signature, précédée de « Lu et approuvé »", encre: false },
                  { pour: "Pour Baobabs Basket Club", nom: "Antoine Jean Pierre Ndong", qualite: "Président", mention: "Signature et cachet du Président", encre: true }])
    ]),

    libre("Autorisation de déplacement (mineure)", [
      entete(),
      titre("Document officiel du club", "Autorisation de déplacement", ""),
      reperes([["Joueuse", ""], ["Née le", ""], ["Déplacement", ""], ["Dates", ""]]),
      texte("Baobabs Basket Club atteste que la joueuse ci-dessus fait partie de sa délégation pour le déplacement indiqué, et qu'elle voyage sous la responsabilité du chef de délégation, Monsieur **Antoine Jean Pierre Ndong**, Président du club, muni de l'autorisation parentale jointe.\n\nLa présente est délivrée pour servir et valoir ce que de droit auprès des autorités de transport, de frontière et d'accueil."),
      signatures([{}])
    ]),

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

  /* ================================================================
     LES TEXTES PRÉDÉFINIS
     Ce qu'on insère d'un geste dans un texte de la feuille, par la
     commande « / » ou le clic droit : le président, les soussignés,
     les formules, les mentions. Des phrases du club, pas des modèles.
     ================================================================ */
  G.textes = [
    { nom: "Le président (présentation)", groupe: "Personnes",
      texte: "Monsieur **Antoine Jean Pierre Ndong**, Président de Baobabs Basket Club, section basketball de l'ASC Baobab (récépissé n° 8280), Sicap Baobab, Dakar," },
    { nom: "Je soussigné (le président)", groupe: "Personnes",
      texte: "Je soussigné, **Antoine Jean Pierre Ndong**, Président de Baobabs Basket Club, " },
    { nom: "Les soussignés (deux parties)", groupe: "Personnes",
      texte: "Les soussignés,\n\n- **Baobabs Basket Club**, représenté par son Président, Monsieur Antoine Jean Pierre Ndong, d'une part ;\n- **(nom de l'autre partie)**, représenté(e) par (nom et qualité), d'autre part ;\n\nsont convenus de ce qui suit :" },
    { nom: "Le club (présentation)", groupe: "Personnes",
      texte: "**Baobabs Basket Club**, section basketball de l'ASC Baobab, club de basketball féminin de Sicap Baobab (Dakar, Sénégal), récépissé n° 8280," },
    { nom: "Formule de politesse (Madame, Monsieur)", groupe: "Formules",
      texte: "Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées." },
    { nom: "Formule de politesse (autorité)", groupe: "Formules",
      texte: "Nous vous prions d'agréer, Monsieur le Maire, l'expression de notre haute considération." },
    { nom: "Formule de politesse (fédération)", groupe: "Formules",
      texte: "Nous vous prions de croire, Monsieur le Président, à l'assurance de notre considération sportive la plus distinguée." },
    { nom: "Dans l'attente d'une réponse", groupe: "Formules",
      texte: "Dans l'attente de votre réponse, nous restons à votre disposition pour tout complément d'information." },
    { nom: "Remerciements", groupe: "Formules",
      texte: "Nous vous remercions de l'attention que vous voudrez bien porter à la présente et de votre soutien constant au basketball féminin." },
    { nom: "Certification (liste)", groupe: "Mentions",
      texte: "Je certifie exacte et conforme la présente liste, arrêtée à la date ci-dessous." },
    { nom: "Pour servir et valoir ce que de droit", groupe: "Mentions",
      texte: "La présente est délivrée à l'intéressé(e) pour servir et valoir ce que de droit." },
    { nom: "Mention de copie", groupe: "Mentions",
      texte: "**Copie à :** la Fédération Sénégalaise de Basketball ; la Commune de Mermoz-Sacré-Cœur ; l'ASC Baobab." },
    { nom: "Pièces jointes", groupe: "Mentions",
      texte: "**Pièces jointes :** liste de la délégation ; copie de l'invitation ; programme du tournoi." },
    { nom: "Lu et approuvé", groupe: "Mentions",
      texte: "Fait en deux exemplaires originaux, chaque partie reconnaissant avoir reçu le sien. Signature précédée de la mention manuscrite « Lu et approuvé »." },
    { nom: "Autorisation parentale", groupe: "Mentions",
      texte: "Je soussigné(e), **(nom du parent ou tuteur)**, autorise ma fille **(nom de la joueuse)**, née le (date), à participer au déplacement organisé par Baobabs Basket Club à (lieu) du (date) au (date), sous la responsabilité du chef de délégation, et à recevoir tout soin médical d'urgence que son état nécessiterait." },
    { nom: "Droit à l'image", groupe: "Mentions",
      texte: "J'autorise Baobabs Basket Club à photographier et filmer (nom) lors de ses activités, et à utiliser ces images pour la communication du club (site, réseaux, affiches), sans contrepartie et sans limitation de durée. Cette autorisation peut être retirée par écrit." }
  ];

})(window.BaobabsGreffe);
