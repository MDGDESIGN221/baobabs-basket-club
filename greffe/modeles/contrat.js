/* =====================================================================
   MODÈLE : CONTRAT D'ENGAGEMENT SPORTIF
   ---------------------------------------------------------------------
   Le club d'un côté, une joueuse (ou un joueur) de l'autre, neuf
   articles, deux signatures. Repris du contrat d'engagement « Joueuse
   Senior » du dossier des actes du club.

   L'identité de la joueuse peut rester vide : chaque champ vide devient
   une ligne en pointillé sur l'exemplaire imprimé, à compléter au stylo
   le jour de la signature. Les montants sont des champs, et les articles
   les reprennent : changer le package ne demande pas de relire le texte.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  function ref(d) {
    return d.numero ? 'BBC / CE / ' + String(d.numero).replace('/', ' / ') : '';
  }
  function fem(d) { return !/joueur$/i.test(String(d.genre || 'Joueuse')); }
  function laJoueuse(d) { return fem(d) ? "la Joueuse" : "le Joueur"; }
  function LaJoueuse(d) { return fem(d) ? "La Joueuse" : "Le Joueur"; }
  function elle(d) { return fem(d) ? "Elle" : "Il"; }
  function e(d) { return fem(d) ? "e" : ""; }
  function v(x, repli) { return String(x || '').trim() || repli; }

  /* ================================================================
     LES ARTICLES, PRÉ-ÉCRITS ET MODIFIABLES
     ================================================================ */
  function articlesParDefaut(d) {
    var J = laJoueuse(d), Jm = LaJoueuse(d), E = elle(d), ee = e(d);
    var duAu = U.duAu(d.du, d.au);
    return [
      { titre: "Objet et durée",
        texte: Jm + " s'engage dans le projet sportif de Baobabs Basket Club pour une durée de **"
             + v(d.duree, "trois (3) ans") + "**" + (duAu ? ", " + duAu : "") + ".\n\n"
             + "Le présent contrat fixe les engagements sportifs et financiers des deux parties." },
      { titre: "Validation de l'engagement",
        texte: "L'engagement définitif est soumis à la réussite des tests sportifs, physiques et médicaux "
             + "ainsi qu'à la validation du staff technique.\n\n"
             + "En cas de tests non concluants, le Club pourra décider de ne pas confirmer l'engagement, "
             + "sans que les indemnités futures prévues au présent contrat soient dues." },
      { titre: "Continuité de l'engagement",
        texte: "Toute modification, réorganisation, partenariat, rattachement ou changement de structure "
             + "sportive du Club n'entraîne ni la résiliation ni la caducité du présent contrat.\n\n"
             + "Le contrat se poursuit jusqu'à son terme avec maintien des droits et obligations des "
             + "parties, y compris lorsque " + J + " est amené" + ee + " à évoluer sous une structure "
             + "partenaire du Club, dans le respect des règlements sportifs applicables." },
      { titre: "Conditions financières",
        texte: "Pour chaque saison sportive, " + J + " pourra bénéficier d'un package financier maximal "
             + "de **" + v(d.package, "1 000 000 FCFA") + "**, réparti comme suit :\n"
             + "- **Championnat :** " + v(d.mensuel, "100 000 FCFA") + " par mois, "
             + v(d.periodePaie, "du 1er janvier au 31 août") + ", soit **" + v(d.plafond, "800 000 FCFA")
             + " maximum** ;\n"
             + "- **Tournoi de montée :** " + v(d.primeTournoi, "100 000 FCFA") + " si l'équipe est "
             + "qualifiée et que " + J + " est convoqué" + ee + " et participe au tournoi ;\n"
             + "- **Montée en D1 :** " + v(d.primeMontee, "100 000 FCFA") + " si l'équipe obtient "
             + "officiellement son accession en Division 1.\n\n"
             + "Les primes liées au tournoi et à la montée sont conditionnelles. Les périodes précédant "
             + "et suivant celle du championnat ne donnent pas droit à l'indemnité mensuelle.\n\n"
             + "Les prises en charge suivantes sont également prévues :\n"
             + "- **Logement :** " + v(d.logement, "selon les modalités convenues entre les parties") + " ;\n"
             + "- **Restauration :** " + v(d.restauration, "selon les modalités convenues entre les parties") + " ;\n"
             + "- **Transport et autres :** " + v(d.transport, "selon les modalités convenues entre les parties") + "." },
      { titre: "Présence et obligations sportives",
        texte: Jm + " rejoint le Club dès " + v(d.moisArrivee, "septembre") + " pour la préparation de la "
             + "saison, sans indemnité mensuelle jusqu'au début de la période de championnat.\n\n"
             + E + " s'engage à participer aux entraînements, matchs, stages et compétitions pour lesquels "
             + (fem(d) ? "elle" : "il") + " est convoqué" + ee + ", à respecter le staff, le règlement "
             + "intérieur et à préserver sa condition physique.\n\n"
             + "Après le championnat et jusqu'à un éventuel tournoi de montée, " + J + " pourra, avec "
             + "l'accord du Club, retourner temporairement dans son pays d'origine"
             + (v(d.paysOrigine, "") ? " (" + d.paysOrigine.trim() + ")" : "") + ". " + E + " devra "
             + "revenir à la date fixée par le Club en cas de convocation." },
      { titre: "Changement de club et transfert",
        texte: "Pendant toute la durée du contrat, " + J + " s'engage à informer immédiatement le Club de "
             + "toute sollicitation ou proposition provenant d'un autre club.\n\n"
             + E + " ne pourra conclure un engagement sportif incompatible avec le présent contrat, ni "
             + "organiser un changement de club, une mutation ou un transfert sans que sa situation "
             + "contractuelle avec Baobabs Basket Club ait été préalablement réglée.\n\n"
             + "Tout départ pendant la durée du contrat devra faire l'objet d'un accord entre " + J
             + " et le Club, conformément aux règlements sportifs applicables.\n\n"
             + "En cas d'intérêt d'un autre club, Baobabs Basket Club se réserve le droit de négocier les "
             + "conditions de libération ou de transfert de " + J + ", dans les limites autorisées par "
             + "les règlements applicables." },
      { titre: "Engagements du Club",
        texte: "Le Club s'engage à assurer à " + J + " l'encadrement sportif nécessaire, les prises en "
             + "charge convenues ainsi que le paiement des indemnités et primes lorsqu'elles deviennent "
             + "effectivement dues.\n\n"
             + "Le Club s'engage également à accompagner " + J + " dans son développement et sa "
             + "progression sportive." },
      { titre: "Résiliation",
        texte: "Le contrat peut être résilié d'un commun accord écrit ou en cas de manquement grave de "
             + "l'une des parties à ses obligations.\n\n"
             + "Sont notamment considérés comme des manquements : les absences répétées et injustifiées, "
             + "l'abandon du Club, le non-respect grave des obligations sportives ou la signature "
             + "irrégulière avec un autre club pendant la durée du présent engagement.\n\n"
             + "Toute résiliation ou libération devra être formalisée par écrit, sous réserve des "
             + "règlements sportifs applicables." },
      { titre: "Dispositions finales",
        texte: "Le présent contrat s'exécute conformément au droit applicable au Sénégal ainsi qu'aux "
             + "règlements de la Fédération Sénégalaise de Basketball (FSBB) et de la FIBA, lorsqu'ils "
             + "sont applicables.\n\n"
             + "Toute modification du présent contrat devra être convenue par écrit entre les parties." }
    ];
  }

  /* ================================================================ */
  G.modeles['contrat'] = {
    cle: 'contrat',
    nom: "Contrat d'engagement sportif",
    famille: "Conventions et contrats",
    prefixe: "CE",
    resume: "Le club et une joueuse : durée, conditions financières, obligations, deux signatures.",

    sections: [
      { titre: "Le contrat", ouvert: true, champs: [
        { cle: 'titre',     lab: "Intitulé", type: 'texte' },
        { cle: 'sousTitre', lab: "Catégorie", type: 'texte', duo: true,
          aide: "« Joueuse Senior », « Joueur U18 »… repris en tête de page." },
        { cle: 'numero',    lab: "Numéro",   type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Fait le",  type: 'date',  duo: true },
        { cle: 'lieu',      lab: "Fait à",   type: 'texte', duo: true },
        { cle: 'duree',     lab: "Durée",    type: 'texte', duo: true },
        { cle: 'exemplaires', lab: "Exemplaires originaux", type: 'choix', duo: true,
          choix: ['deux', 'trois'] },
        { cle: 'du',        lab: "Du",       type: 'date',  duo: true },
        { cle: 'au',        lab: "Au",       type: 'date',  duo: true,
          aide: "Laissez vide pour ne pas écrire de dates dans l'article 1." }
      ]},
      { titre: "La joueuse", ouvert: true, champs: [
        { cle: 'genre',     lab: "Il s'agit de", type: 'choix', choix: ['Joueuse', 'Joueur'] },
        { cle: 'nom',       lab: "Nom et prénom(s)", type: 'texte',
          aide: "Chaque champ laissé vide devient une ligne en pointillé, à remplir au stylo." },
        { cle: 'naissance', lab: "Date de naissance", type: 'date', duo: true },
        { cle: 'lieuNaissance', lab: "Lieu de naissance", type: 'texte', duo: true },
        { cle: 'nationalite', lab: "Nationalité", type: 'texte', duo: true },
        { cle: 'piece',     lab: "Passeport / CNI", type: 'texte', duo: true },
        { cle: 'telephone', lab: "Téléphone", type: 'texte', duo: true },
        { cle: 'paysOrigine', lab: "Pays d'origine", type: 'texte', duo: true,
          aide: "Pour l'article sur le retour temporaire entre deux phases de la saison." },
        { cle: 'moisArrivee', lab: "Rejoint le club dès", type: 'texte' }
      ]},
      { titre: "Les montants", ouvert: false, champs: [
        { cle: 'package',   lab: "Package maximal par saison", type: 'texte' },
        { cle: 'mensuel',   lab: "Indemnité mensuelle", type: 'texte', duo: true },
        { cle: 'plafond',   lab: "Plafond du championnat", type: 'texte', duo: true },
        { cle: 'periodePaie', lab: "Période de versement", type: 'texte' },
        { cle: 'primeTournoi', lab: "Prime du tournoi de montée", type: 'texte', duo: true },
        { cle: 'primeMontee',  lab: "Prime de montée en D1", type: 'texte', duo: true },
        { cle: 'logement',  lab: "Logement", type: 'texte' },
        { cle: 'restauration', lab: "Restauration", type: 'texte' },
        { cle: 'transport', lab: "Transport et autres", type: 'texte' }
      ]},
      { titre: "Les articles", ouvert: false, special: 'articles' },
      { titre: "Les signataires", ouvert: false, champs: [
        { cle: 'signNom',       lab: "Pour le club", type: 'texte', duo: true },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte', duo: true },
        { cle: 'avecSignature', lab: "Apposer la signature du président", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule',
          aide: "La joueuse signe toujours à la main, avec la mention « Lu et approuvé »." }
      ]}
    ],

    defauts: function () {
      return {
        titre: "Contrat d'engagement sportif",
        sousTitre: "Joueuse Senior",
        numero: "",
        dateActe: U.isoDuJour(),
        lieu: "Dakar",
        duree: "trois (3) ans",
        exemplaires: "deux",
        du: "", au: "",
        genre: "Joueuse",
        nom: "", naissance: "", lieuNaissance: "", nationalite: "", piece: "", telephone: "",
        paysOrigine: "",
        moisArrivee: "septembre",
        package: "1 000 000 FCFA",
        mensuel: "100 000 FCFA", plafond: "800 000 FCFA",
        periodePaie: "du 1er janvier au 31 août",
        primeTournoi: "100 000 FCFA", primeMontee: "100 000 FCFA",
        logement: "", restauration: "", transport: "",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président",
        avecSignature: true, avecCachet: true,
        articles: null,
        tables: {}
      };
    },

    articlesParDefaut: articlesParDefaut,

    page: [
      { b: 'entete', drapeau: false,
        devise: function (d) { return "Section Basketball · " + v(d.sousTitre, "Joueuse") + " · Dakar"; },
        droite: function (d) {
          return [d.numero ? "Contrat n° " + d.numero : "Contrat sportif",
                  "Durée : " + v(d.duree, "à convenir") + " · " + v(d.exemplaires, "deux") + " exemplaires originaux"];
        } },

      { b: 'parties', parties: function (d) {
          var f = fem(d);
          /* sans nom, la première ligne devient elle aussi un pointillé */
          var champs = v(d.nom, "") ? [] : [{ label: f ? "Mme / Mlle" : "M.", valeur: "", large: true }];
          champs.push(
            { label: f ? "Née le" : "Né le", valeur: U.dateLongue(d.naissance, false) },
            { label: "À", valeur: d.lieuNaissance },
            { label: "Nationalité", valeur: d.nationalite },
            { label: "Passeport / CNI", valeur: d.piece },
            { label: "Téléphone", valeur: d.telephone, large: true }
          );
          return [
            { label: "Le Club", nom: "Baobabs Basket Club",
              texte: "Représenté par son Président, Monsieur " + v(d.signNom, "Antoine Jean Pierre Ndong") + ".",
              tag: "Ci-après dénommé « le Club »" },
            { label: LaJoueuse(d), nom: v(d.nom, ""), champs: champs,
              tag: "Ci-après dénommé" + e(d) + " « " + laJoueuse(d) + " »" }
          ];
        } },

      { b: 'titre',
        etiquette: function (d) { return "Baobabs Basket Club · " + v(d.sousTitre, "Engagement sportif"); },
        pastille: function (d) { return d.numero ? "N° " + d.numero : ""; },
        texte: function (d) { return d.titre; },
        sous: "Le présent contrat fixe les engagements sportifs et financiers du Club et de la personne "
            + "engagée, ainsi que les conditions de leur collaboration pendant la durée convenue." },

      { b: 'phrase', texte: "Il est convenu ce qui suit :" },

      { b: 'articles', articles: function (d) {
          return (d.articles && d.articles.length) ? d.articles : articlesParDefaut(d);
        } },

      { b: 'signatures',
        gauche: function (d) {
          return {
            lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>",
            note: "En " + U.ech(v(d.exemplaires, "deux")) + " exemplaires originaux. "
                + "Chaque page est paraphée par les deux parties.",
            reference: ref(d)
          };
        },
        cartes: function (d) {
          return [
            { pour: "Pour Baobabs Basket Club", nom: d.signNom, qualite: d.signQualite,
              mention: "Signature et cachet du Président" },
            { pour: LaJoueuse(d), nom: v(d.nom, "Nom et prénom(s) :"), qualite: "",
              mention: "Lu et approuvé · Signature", signer: false, cacheter: false }
          ];
        } }
    ],

    pied: function (d) {
      return ["Baobabs Basket Club · Section Basketball · Dakar, Sénégal",
              v(d.titre, "Contrat d'engagement sportif") + " · " + v(d.sousTitre, "") + (d.nom ? " · " + d.nom : "")];
    },

    fichier: function (d) {
      return "Contrat Engagement Sportif" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : "")
           + (d.nom ? " - " + d.nom : "") + " - BAOBABS BASKET CLUB";
    }
  };

})(window.BaobabsGreffe);
