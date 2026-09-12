/* =====================================================================
   MODÈLE : CONVENTION
   ---------------------------------------------------------------------
   Deux parties, un objet, des articles, deux signatures. Reprise de la
   convention de partenariat et de mise à disposition du terrain Patrice
   Semedo signée avec la Commune de Mermoz-Sacré-Cœur, qui est dans le
   dossier des actes du club : ses huit articles sont les textes de
   départ, à garder, à corriger ou à remplacer depuis l'écran.

   La seconde partie est le club par défaut, mais rien ne l'impose : les
   deux parties se renseignent librement, et les articles parlent d'elles
   par leur nom court (« la Commune », « le Club »).

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  function ref(d) {
    return d.numero ? 'BBC / CV / ' + String(d.numero).replace('/', ' / ') : '';
  }
  function court(v, repli) { return String(v || '').trim() || repli; }
  /* « de » + « le Club » = « du Club » ; « de » + « la Commune » reste tel quel */
  function de(x) {
    if (/^le\s/i.test(x)) return "du " + x.slice(3);
    if (/^les\s/i.test(x)) return "des " + x.slice(4);
    return "de " + x;
  }

  /* ================================================================
     LES ARTICLES, PRÉ-ÉCRITS ET MODIFIABLES
     ================================================================ */
  function articlesParDefaut(d) {
    var A = court(d.p1Court, "la Commune"), B = court(d.p2Court, "le Club");
    var Am = A.charAt(0).toUpperCase() + A.slice(1);
    var Bm = B.charAt(0).toUpperCase() + B.slice(1);
    var lieu = court(d.lieuObjet, "du terrain de basketball de Sicap Baobab, dit Terrain Patrice Semedo");
    return [
      { titre: "Objet",
        texte: "La présente convention a pour objet de définir le partenariat entre " + A + " et " + B
             + " ainsi que les conditions de mise à disposition " + lieu + ".\n\n"
             + "Ce partenariat vise à favoriser le développement du basketball, la formation et "
             + "l'encadrement de la jeunesse, notamment à travers la création et le développement "
             + "d'une école de basket, des équipes de jeunes et seniors et l'organisation d'activités "
             + "sportives, éducatives et sociales." },
      { titre: "Mise à disposition",
        texte: Am + " met le terrain à la disposition " + de(B) + " sans contrepartie financière, "
             + "afin de lui permettre d'y développer ses activités sportives.\n\n"
             + "Le terrain demeure un équipement communal et conserve sa vocation d'intérêt collectif." },
      { titre: "Priorité d'utilisation",
        texte: Bm + " bénéficie d'une priorité d'utilisation du terrain pour ses entraînements, matchs "
             + "officiels, rencontres amicales, tournois, stages, détections et autres activités "
             + "sportives programmées.\n\n"
             + "Les jours et horaires d'utilisation sont définis d'un commun accord entre " + A + " et "
             + B + " selon un planning pouvant être actualisé en fonction des besoins de chaque saison "
             + "sportive.\n\n"
             + "Les matchs officiels et compétitions " + de(B) + " bénéficient d'une priorité, sous "
             + "réserve d'une information préalable " + de(A) + ".\n\n"
             + "En dehors des créneaux attribués, le terrain demeure disponible pour les autres usages "
             + "autorisés par " + A + "." },
      { titre: "Développement du basketball",
        texte: Bm + " s'engage à développer durablement la pratique du basketball, notamment à travers :\n"
             + "- son école de basket ;\n"
             + "- la formation et l'encadrement des jeunes ;\n"
             + "- ses équipes féminines et masculines ;\n"
             + "- la participation aux compétitions ;\n"
             + "- l'organisation de stages, détections, tournois et événements sportifs.\n\n"
             + Bm + " veille également au respect, à la propreté et à la bonne utilisation des installations." },
      { titre: "Partenaires, sponsors et communication",
        texte: "Afin d'accompagner le développement de ses activités, " + B + " pourra rechercher et "
             + "conclure des partenariats et contrats de sponsoring dans le respect de la réglementation "
             + "applicable.\n\n"
             + "Il pourra installer autour du terrain des supports de visibilité, notamment des panneaux "
             + "partenaires de 2 m × 1 m, bâches, banderoles et autres supports de communication.\n\n"
             + "Les recettes issues des partenariats directement conclus par " + B + " sont destinées au "
             + "financement de ses activités.\n\n"
             + "Toute installation permanente ou modification de l'infrastructure sera réalisée en "
             + "concertation avec " + A + ".\n\n"
             + Bm + " pourra également réaliser sur le terrain des photos, vidéos, interviews, reportages "
             + "et autres contenus destinés à sa communication et à celle de ses partenaires." },
      { titre: "Engagements et valorisation",
        texte: "En contrepartie de la mise à disposition du terrain, " + B + " s'engage à respecter et "
             + "préserver les installations, à maintenir les lieux propres après ses activités et à "
             + "contribuer, dans la mesure de ses moyens, à leur entretien courant.\n\n"
             + Bm + " contribuera par ses activités au développement du basketball, à l'encadrement de "
             + "la jeunesse et au rayonnement sportif " + de(A) + ".\n\n"
             + Am + " sera reconnue comme partenaire institutionnel du projet et pourra bénéficier d'une "
             + "visibilité lors des principales activités et communications " + de(B) + "." },
      { titre: "Durée et coordination",
        texte: "La présente convention est conclue pour une durée de **" + court(d.duree, "trois (3) ans")
             + "**, renouvelable d'un commun accord.\n\n"
             + "Les parties privilégient la concertation concernant les créneaux, matchs, événements, "
             + "équipements, travaux et opérations de communication.\n\n"
             + "En cas d'indisponibilité exceptionnelle du terrain, " + A + " en informe " + B + " dans la "
             + "mesure du possible, en tenant compte notamment des matchs officiels déjà programmés." },
      { titre: "Résiliation et règlement des difficultés",
        texte: "En cas de difficulté dans l'exécution de la présente convention, les parties privilégient "
             + "une solution amiable.\n\n"
             + "En cas de manquement important de l'une des parties à ses engagements, la convention "
             + "pourra être résiliée après notification et échange entre les parties, sauf situation "
             + "nécessitant une intervention immédiate.\n\n"
             + "Toute modification importante de la présente convention fera l'objet d'un accord écrit "
             + "entre les parties." }
    ];
  }

  /* ================================================================ */
  G.modeles['convention'] = {
    cle: 'convention',
    nom: "Convention",
    famille: "Conventions et contrats",
    prefixe: "CV",
    resume: "Un accord entre le club et un partenaire : parties, articles, deux signatures.",

    sections: [
      { titre: "La convention", ouvert: true, champs: [
        { cle: 'titre',     lab: "Intitulé", type: 'zone',
          aide: "Le grand titre. Il peut tenir sur deux lignes." },
        { cle: 'numero',    lab: "Numéro",   type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Fait le",  type: 'date',  duo: true },
        { cle: 'lieu',      lab: "Fait à",   type: 'texte', duo: true },
        { cle: 'exemplaires', lab: "Exemplaires originaux", type: 'choix', duo: true,
          choix: ['deux', 'trois', 'quatre'] },
        { cle: 'objet',     lab: "Objet",    type: 'zone',
          aide: "La phrase sous le titre : de quoi il s'agit, en une ou deux lignes." },
        { cle: 'lieuObjet', lab: "Ce qui est mis à disposition", type: 'texte',
          aide: "Repris dans le premier article. Laissez tel quel si la convention ne porte pas sur un lieu." },
        { cle: 'duree',     lab: "Durée",    type: 'texte', duo: true },
        { cle: 'sousTitre', lab: "Rappel en tête de page", type: 'texte', duo: true,
          aide: "La ligne en haut à droite, sous le drapeau." }
      ]},
      { titre: "Première partie", ouvert: true, champs: [
        { cle: 'p1Label', lab: "Amorce",  type: 'texte', duo: true },
        { cle: 'p1Court', lab: "Nom court", type: 'texte', duo: true,
          aide: "Comme les articles la nomment : « la Commune », « le Partenaire »." },
        { cle: 'p1Nom',   lab: "Dénomination", type: 'texte' },
        { cle: 'p1Repr',  lab: "Représentée par", type: 'zone' },
        { cle: 'p1Tag',   lab: "Mention", type: 'texte' }
      ]},
      { titre: "Seconde partie", ouvert: false, champs: [
        { cle: 'p2Label', lab: "Amorce",  type: 'texte', duo: true },
        { cle: 'p2Court', lab: "Nom court", type: 'texte', duo: true },
        { cle: 'p2Nom',   lab: "Dénomination", type: 'texte' },
        { cle: 'p2Repr',  lab: "Représentée par", type: 'zone' },
        { cle: 'p2Tag',   lab: "Mention", type: 'texte' }
      ]},
      { titre: "Les articles", ouvert: false, special: 'articles' },
      { titre: "Les signataires", ouvert: false, champs: [
        { cle: 's1Nom',     lab: "Pour la première partie", type: 'texte', duo: true },
        { cle: 's1Qualite', lab: "Sa qualité", type: 'texte', duo: true },
        { cle: 's2Nom',     lab: "Pour la seconde partie", type: 'texte', duo: true },
        { cle: 's2Qualite', lab: "Sa qualité", type: 'texte', duo: true },
        { cle: 'avecSignature', lab: "Apposer la signature du président", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule',
          aide: "L'autre partie signe toujours à la main : sa carte reste vierge." }
      ]}
    ],

    defauts: function () {
      return {
        titre: "Convention de partenariat et de mise à disposition du terrain de basketball",
        numero: "",
        dateActe: U.isoDuJour(),
        lieu: "Dakar",
        exemplaires: "deux",
        objet: "Partenariat entre la Commune de Mermoz-Sacré-Cœur et le Club, et mise à disposition du "
             + "terrain de basketball de Sicap Baobab, dit Terrain Patrice Semedo, au profit du Club.",
        lieuObjet: "du terrain de basketball de Sicap Baobab, dit Terrain Patrice Semedo",
        duree: "trois (3) ans",
        sousTitre: "Terrain Patrice Semedo · Sicap Baobab, Dakar",
        p1Label: "Entre les soussignés", p1Court: "la Commune",
        p1Nom: "Commune de Mermoz-Sacré-Cœur",
        p1Repr: "Représentée par Monsieur Alioune Tall, agissant en qualité de Maire de la Commune "
              + "de Mermoz-Sacré-Cœur.",
        p1Tag: "Ci-après dénommée « la Commune »",
        p2Label: "Et", p2Court: "le Club",
        p2Nom: "ASC Baobab, Section Basketball · Baobabs Basket Club",
        p2Repr: "Représentée par son Président, Monsieur Antoine Jean Pierre Ndong.",
        p2Tag: "Ci-après dénommée « le Club »",
        s1Nom: "Monsieur Alioune Tall", s1Qualite: "Maire",
        s2Nom: "Antoine Jean Pierre Ndong", s2Qualite: "Président",
        avecSignature: true, avecCachet: true,
        articles: null,
        tables: {}
      };
    },

    articlesParDefaut: articlesParDefaut,

    page: [
      { b: 'entete', drapeau: false, devise: "ASC Baobab · Section Basketball · Dakar",
        droite: function (d) {
          return [d.sousTitre || "Convention",
                  "Durée : " + court(d.duree, "à convenir") + " · " + court(d.exemplaires, "deux")
                  + " exemplaires originaux"];
        } },

      { b: 'parties', parties: function (d) {
          return [
            { label: '@p1Label', nom: '@p1Nom', texte: '@p1Repr', tag: '@p1Tag' },
            { label: '@p2Label', nom: '@p2Nom', texte: '@p2Repr', tag: '@p2Tag' }
          ];
        } },

      { b: 'titre',
        etiquette: "Objet",
        pastille: function (d) { return d.numero ? "Convention n° " + d.numero : "Convention"; },
        texte: '@titre',
        sous: '@objet' },

      { b: 'phrase', texte: "Il est convenu ce qui suit :" },

      { b: 'articles', articles: function (d) {
          return (d.articles && d.articles.length) ? d.articles : articlesParDefaut(d);
        } },

      { b: 'signatures',
        gauche: function (d) {
          return {
            lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>",
            note: "En " + U.ech(court(d.exemplaires, "deux")) + " exemplaires originaux, un pour chaque partie.",
            reference: ref(d)
          };
        },
        cartes: function (d) {
          return [
            { pour: "Pour " + court(d.p1Nom, "la première partie"), nom: '@s1Nom', qualite: '@s1Qualite',
              mention: "Signature et cachet", signer: false, cacheter: false },
            { pour: "Pour " + court(d.p2Nom, "Baobabs Basket Club"), nom: '@s2Nom', qualite: '@s2Qualite',
              mention: "Signature et cachet du Président" }
          ];
        } }
    ],

    pied: function (d) {
      return ["Baobabs Basket Club · ASC Baobab, Section Basketball · Sicap Baobab, Dakar, Sénégal",
              "Convention" + (d.numero ? " n° " + d.numero : "") + (d.sousTitre ? " · " + d.sousTitre : "")];
    },

    fichier: function (d) {
      return "Convention" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : "")
           + " - " + String(d.sousTitre || d.p1Nom || '').slice(0, 50) + " - BAOBABS BASKET CLUB";
    }
  };

})(window.BaobabsGreffe);
