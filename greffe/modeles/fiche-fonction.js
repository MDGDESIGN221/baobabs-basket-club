/* =====================================================================
   MODÈLE : FICHE DE FONCTION
   ---------------------------------------------------------------------
   Attributions, pouvoirs et limites d'un membre du bureau, avec trois
   visas : le Président de l'ASC, le Président de la Section, et le
   titulaire qui signe « lu et approuvé ». Reprises des deux fiches du
   dossier des actes du club (Secrétaire Général, Trésorière).

   La fonction choisie décide des textes de départ. Tant qu'on ne les a
   pas retouchés, ils suivent la fonction ; dès qu'on en modifie un, ils
   restent tels quels. Une fonction qui n'a pas encore ses textes reçoit
   un canevas à compléter.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  var FONCTIONS = ['Secrétaire Général', 'Trésorière', 'Trésorier', 'Vice-président', 'Vice-présidente',
                   'Responsable technique', 'Responsable de la communication', 'Chargé du matériel',
                   'Responsable de l\'école de basket', 'Autre fonction'];

  function ref(d) {
    return d.numero ? 'BBC / FF / ' + String(d.numero).replace('/', ' / ') : '';
  }
  function fem(d) { return /^elle$/i.test(String(d.genre || '')); }
  function fonction(d) {
    var f = String(d.fonction || '').trim();
    if (!f || /^autre/i.test(f)) f = String(d.fonctionLibre || '').trim() || "Membre du bureau";
    return f;
  }
  /* « Le Secrétaire Général », « La Trésorière », « L'Adjoint » */
  function leTitulaire(d) {
    var f = fonction(d);
    if (/^[aeiouéèêh]/i.test(f)) return "L'" + f;
    return (fem(d) ? "La " : "Le ") + f;
  }
  function pron(d) { return fem(d) ? "Elle" : "Il"; }
  function e(d) { return fem(d) ? "e" : ""; }

  /* ================================================================
     LES TEXTES DE DÉPART, PAR FONCTION
     ================================================================ */
  function objetParDefaut(d) {
    var f = fonction(d), T = leTitulaire(d);
    if (/secr[ée]taire/i.test(f))
      return T + " est le principal responsable administratif du club. " + pron(d) + " assure la "
           + "continuité du fonctionnement administratif, la bonne circulation de l'information et le "
           + "suivi des décisions et orientations du Président de la Section.";
    if (/tr[ée]sori/i.test(f))
      return T + " est responsable de la gestion financière du club. " + pron(d) + " veille à la bonne "
           + "utilisation des ressources, à la transparence des opérations financières et au respect du "
           + "budget voté par le bureau.";
    return T + " est membre du bureau de la Section Basketball. La présente fiche définit ses "
         + "attributions, ses pouvoirs et leurs limites, sous l'autorité du Président de la Section.";
  }

  function articlesParDefaut(d) {
    var f = fonction(d), P = pron(d), p = P.toLowerCase(), T = leTitulaire(d), ee = e(d);

    if (/secr[ée]taire/i.test(f)) return [
      { titre: "Ses responsabilités",
        texte: "- " + P + " prépare, avec le Président de la Section, les réunions et les ordres du jour.\n"
             + "- " + P + " rédige ou supervise la rédaction des procès-verbaux.\n"
             + "- " + P + " conserve les statuts, règlements, conventions, contrats, courriers et documents officiels.\n"
             + "- " + P + " suit les démarches administratives auprès de la fédération, de l'ASC, de la mairie et des autres institutions.\n"
             + "- " + P + " tient à jour la liste des membres du bureau, du staff, des joueuses et des partenaires.\n"
             + "- " + P + " transmet les convocations, décisions et informations administratives aux personnes concernées.\n"
             + "- " + P + " assure le suivi administratif de l'exécution des décisions et instructions du Président de la Section.\n"
             + "- " + P + " prépare les courriers officiels qui doivent ensuite être validés ou signés par le Président de la Section.\n"
             + "- " + P + " veille au classement, à l'archivage et à la bonne conservation des documents administratifs du club.\n"
             + "- " + P + " peut remplacer le Président de la Section dans la conduite administrative d'une réunion lorsque celui-ci lui en donne l'autorisation." },
      { titre: "Ses pouvoirs",
        texte: "- " + P + " peut demander aux responsables les informations nécessaires à la préparation et au suivi des dossiers administratifs.\n"
             + "- " + P + " peut relancer les membres et responsables concernant les tâches ou démarches qui leur ont été confiées.\n"
             + "- " + P + " peut transmettre et assurer le suivi des décisions et instructions validées par le Président de la Section.\n"
             + "- " + P + " peut organiser les archives et mettre en place une méthode de classement des documents administratifs.\n"
             + "- " + P + " peut représenter administrativement le club ou signer certains documents courants lorsqu'" + p + " dispose d'une délégation ou d'une autorisation du Président de la Section à cet effet.\n"
             + "- " + P + " peut signaler au Président de la Section toute difficulté, irrégularité ou retard constaté dans le traitement d'un dossier administratif." },
      { titre: "Ses limites",
        texte: "- " + T + " ne peut pas prendre seul" + ee + " une décision sportive, financière ou disciplinaire importante.\n"
             + "- " + P + " ne peut pas signer un contrat ou engager officiellement le club sans autorisation du Président de la Section.\n"
             + "- " + P + " ne peut pas donner d'ordres techniques aux entraîneurs ou aux joueuses, sauf lorsqu'" + p + " transmet une décision ou une instruction officielle.\n"
             + "- " + P + " ne remplace pas automatiquement le Président de la Section dans l'ensemble de ses fonctions.\n"
             + "- " + P + " ne peut pas modifier, suspendre ou retenir de sa propre initiative une décision ou une instruction régulièrement donnée par le Président de la Section. Toute difficulté dans son exécution doit être portée à la connaissance du Président de la Section.\n"
             + "> " + P + " exerce ses fonctions dans un objectif de régularité administrative, de traçabilité, de continuité et de bonne circulation de l'information au sein du club." },
      { titre: "Rapport administratif de fin d'exercice",
        texte: "À la fin de chaque exercice, " + T.toLowerCase() + " prépare un rapport "
             + "administratif sincère et fidèle retraçant les principales activités, démarches, "
             + "correspondances, décisions et dossiers administratifs suivis au cours de la période." }
    ];

    if (/tr[ée]sori/i.test(f)) return [
      { titre: "Ses responsabilités",
        texte: "- " + P + " tient à jour la comptabilité du club.\n"
             + "- " + P + " enregistre toutes les recettes et toutes les dépenses.\n"
             + "- " + P + " conserve les justificatifs de chaque opération financière (factures, reçus, contrats, bordereaux).\n"
             + "- " + P + " prépare le budget prévisionnel avec le Président de la Section et le bureau.\n"
             + "- " + P + " suit l'exécution du budget et alerte le Président de la Section en cas de dépassement ou de difficulté financière.\n"
             + "- " + P + " prépare un état financier régulier à présenter au Président de la Section.\n"
             + "- " + P + " veille au paiement et à l'exécution des dépenses ordonnées par le Président de la Section (salaires, fournisseurs, transports, achats de matériel, prestations).\n"
             + "- " + P + " suit les cotisations, inscriptions, subventions, dons, sponsoring et autres sources de revenus.\n"
             + "- " + P + " participe à la recherche de financements en collaboration avec le Président de la Section lorsque cela est nécessaire.\n"
             + "- " + P + " prépare les documents financiers demandés par les partenaires, les autorités ou les organismes de contrôle." },
      { titre: "Ses pouvoirs",
        texte: "- " + P + " peut demander toutes les pièces justificatives nécessaires à la bonne tenue de la comptabilité, avant ou après l'exécution d'une dépense, selon la nature de l'opération.\n"
             + "- " + P + " peut signaler au Président de la Section toute dépense présentant une irrégularité manifeste, une insuffisance de fonds ou nécessitant une clarification avant son exécution.\n"
             + "- " + P + " ne peut toutefois pas refuser, suspendre ou retarder une dépense régulièrement ordonnée par le Président de la Section pour une simple divergence d'appréciation ou d'opportunité.\n"
             + "- " + P + " peut proposer des mesures pour améliorer la gestion financière du club.\n"
             + "- " + P + " peut présenter des recommandations pour réduire les dépenses ou optimiser les recettes.\n"
             + "- " + P + " peut demander des explications à tout responsable ayant engagé une dépense." },
      { titre: "Ses limites",
        texte: "- " + T + " ne peut pas décider seul" + ee + " d'une dépense importante non prévue au budget.\n"
             + "- " + P + " ne peut pas engager financièrement le club sans l'autorisation du Président de la Section.\n"
             + "- " + P + " ne peut pas modifier seul" + ee + " le budget voté par le bureau.\n"
             + "- " + P + " ne peut pas utiliser les fonds du club à des fins personnelles, même temporairement.\n"
             + "- " + P + " ne peut pas signer seul" + ee + " un contrat financier important sans validation du Président de la Section, conformément aux règles du club.\n"
             + "- " + P + " ne dispose pas d'un pouvoir de veto sur les dépenses régulièrement ordonnées par le Président de la Section. Son rôle de contrôle s'exerce dans un objectif de régularité, de traçabilité et de transparence de la gestion financière du club.\n"
             + "> Toute réserve ou observation formulée concernant une dépense ordonnée par le Président de la Section ne peut avoir pour effet d'en bloquer durablement l'exécution dès lors que celle-ci est en concordance avec le budget voté par le bureau, que les fonds sont disponibles et qu'aucune irrégularité manifeste n'est constatée." },
      { titre: "Rapport financier de fin d'exercice",
        texte: "À la fin de chaque exercice, " + T.toLowerCase() + " établit un rapport financier sincère et "
             + "fidèle retraçant l'ensemble des recettes et des dépenses du club ainsi que leur justification.\n\n"
             + "Ce rapport assure une information claire et transparente sur l'utilisation des ressources du "
             + "club et permet au Président de la Section d'assumer pleinement la responsabilité morale "
             + "attachée aux décisions de gestion prises sous son autorité." }
    ];

    /* toute autre fonction : un canevas, à compléter depuis l'écran */
    return [
      { titre: "Ses responsabilités",
        texte: "- " + P + " est chargé" + ee + " de …\n"
             + "- " + P + " prépare et suit …\n"
             + "- " + P + " rend compte au Président de la Section de …" },
      { titre: "Ses pouvoirs",
        texte: "- " + P + " peut demander aux responsables les informations nécessaires à sa mission.\n"
             + "- " + P + " peut proposer au Président de la Section toute mesure utile dans son domaine." },
      { titre: "Ses limites",
        texte: "- " + T + " ne peut pas engager officiellement le club sans autorisation du Président de la Section.\n"
             + "- " + P + " ne peut pas prendre seul" + ee + " une décision sportive, financière ou disciplinaire importante.\n"
             + "- " + P + " ne peut pas modifier, suspendre ou retenir une décision régulièrement donnée par le Président de la Section." },
      { titre: "Rapport de fin d'exercice",
        texte: "À la fin de chaque exercice, " + T.toLowerCase() + " présente au Président de la Section un "
             + "rapport sincère et fidèle des activités menées dans le cadre de sa fonction." }
    ];
  }

  /* ================================================================ */
  G.modeles['fiche-fonction'] = {
    cle: 'fiche-fonction',
    nom: "Fiche de fonction",
    famille: "Bureau du club",
    prefixe: "FF",
    resume: "Attributions, pouvoirs et limites d'un membre du bureau, avec trois visas.",

    sections: [
      { titre: "La fonction", ouvert: true, champs: [
        { cle: 'fonction', lab: "Fonction", type: 'choix', choix: FONCTIONS,
          aide: "Le Secrétaire Général et la Trésorière ont leurs textes prêts ; les autres reçoivent un canevas." },
        { cle: 'fonctionLibre', lab: "Si autre fonction, laquelle", type: 'texte' },
        { cle: 'genre',    lab: "On en parle avec", type: 'choix', choix: ['Il', 'Elle'], duo: true,
          aide: "« Elle » pour une trésorière, une vice-présidente." },
        { cle: 'nom',      lab: "Nom du titulaire", type: 'texte', duo: true,
          aide: "Facultatif : la fiche peut rester attachée à la fonction, pas à la personne." },
        { cle: 'objet',    lab: "En quelques mots", type: 'zone',
          aide: "Vide, le texte suit la fonction. Écrivez pour le remplacer." }
      ]},
      { titre: "La fiche", ouvert: false, champs: [
        { cle: 'titre',    lab: "Intitulé", type: 'texte' },
        { cle: 'numero',   lab: "Numéro",   type: 'texte', duo: true },
        { cle: 'dateActe', lab: "Fait le",  type: 'date',  duo: true },
        { cle: 'lieu',     lab: "Fait à",   type: 'texte', duo: true },
        { cle: 'exemplaires', lab: "Exemplaires originaux", type: 'choix', duo: true,
          choix: ['trois', 'deux', 'quatre'] }
      ]},
      { titre: "Les articles", ouvert: false, special: 'articles' },
      { titre: "Les visas", ouvert: false, champs: [
        { cle: 'v1Nom',     lab: "Président de l'ASC", type: 'texte', duo: true },
        { cle: 'v1Qualite', lab: "Structure", type: 'texte', duo: true },
        { cle: 'signNom',   lab: "Président de la Section", type: 'texte', duo: true },
        { cle: 'signQualite', lab: "Structure", type: 'texte', duo: true },
        { cle: 'avecSignature', lab: "Apposer la signature du président", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule',
          aide: "Les deux autres visas se donnent à la main." }
      ]}
    ],

    defauts: function () {
      return {
        titre: "Fiche d'attributions et de responsabilités",
        numero: "",
        dateActe: U.isoDuJour(),
        lieu: "Dakar",
        exemplaires: "trois",
        fonction: "Secrétaire Général", fonctionLibre: "", genre: "Il",
        nom: "", objet: "",
        v1Nom: "", v1Qualite: "ASC Baobab",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Baobabs Basket Club",
        avecSignature: true, avecCachet: true,
        articles: null,
        tables: {}
      };
    },

    articlesParDefaut: articlesParDefaut,

    page: [
      { b: 'entete', drapeau: false, devise: "ASC Baobab · Section Basketball · Dakar",
        droite: function (d) {
          return [leTitulaire(d) + " · Bureau de la Section Basket",
                  "Document interne · " + String(d.exemplaires || "trois") + " exemplaires originaux"];
        } },

      { b: 'titre',
        etiquette: "Objet",
        pastille: function (d) { return d.numero ? "Fiche n° " + d.numero : "Fiche de fonction"; },
        texte: function (d) { return String(d.titre || '') + " · " + leTitulaire(d); },
        sous: function (d) { return String(d.objet || '').trim() || objetParDefaut(d); } },

      { b: 'phrase', texte: "Il est défini ce qui suit :" },

      { b: 'articles', articles: function (d) {
          return (d.articles && d.articles.length) ? d.articles : articlesParDefaut(d);
        } },

      { b: 'signatures',
        gauche: function (d) {
          return {
            lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>",
            note: "En " + U.ech(String(d.exemplaires || "trois")) + " exemplaires originaux : "
                + "l'ASC, la Section, le titulaire.",
            reference: ref(d)
          };
        },
        cartes: function (d) {
          return [
            { pour: "Président de l'ASC", nom: String(d.v1Nom || '').trim() || "Le Président de l'ASC",
              qualite: d.v1Qualite, mention: "Visa / Approbation", signer: false, cacheter: false },
            { pour: "Président de la Section Basket", nom: '@signNom', qualite: '@signQualite',
              mention: "Signature et cachet" },
            { pour: fonction(d), nom: String(d.nom || '').trim() || leTitulaire(d),
              qualite: "Baobabs Basket Club", mention: "Lu et approuvé · Signature",
              signer: false, cacheter: false }
          ];
        } }
    ],

    pied: function (d) {
      return ["Baobabs Basket Club · ASC Baobab, Section Basketball · Sicap Baobab, Dakar, Sénégal",
              String(d.titre || '') + " · " + leTitulaire(d)];
    },

    fichier: function (d) {
      return "Fiche Attributions " + fonction(d) + " - BAOBABS BASKET CLUB";
    }
  };

})(window.BaobabsGreffe);
