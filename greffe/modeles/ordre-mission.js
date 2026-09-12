/* =====================================================================
   MODÈLE : ORDRE DE MISSION
   ---------------------------------------------------------------------
   Plus une ligne de HTML ici. Le modèle DÉCLARE : ses champs, ses
   tableaux, ses textes, et la liste des blocs qui composent la page.
   Le rendu appartient à blocs.js, et il est le même pour tous les actes.

   POUR AJOUTER UNE COLONNE « TAILLE » AU TABLEAU : une ligne dans
   tables.membres.colonnes. Rien d'autre. Le formulaire, l'en-tête, les
   largeurs et le PDF suivent tout seuls. Et depuis l'écran, c'est un
   bouton : les colonnes sont enregistrées avec l'acte.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  /* ------------------------------------------------------------------ */
  function ref(d) {
    return 'BBC / ODM / ' + String(d.numero || '').replace('/', ' / ');
  }
  function lieuMission(d) {
    return [d.destVille, d.destPays].filter(Boolean).join(', en ');
  }
  function estStaff(v) { return !/joueu/i.test(String(v || '')); }
  /* en gras si renseigné, sinon un rappel entre parenthèses : jamais **** */
  function fort(v, repli) { return v ? "**" + v + "**" : repli; }

  /* ================================================================
     LES ARTICLES, PRÉ-ÉCRITS ET MODIFIABLES
     ================================================================ */
  function articlesParDefaut(d) {
    var c = U.compter(G.lignes(d, 'membres'));
    var periodeT = U.duAu(d.tournoiDu, d.tournoiAu);
    return [
      { titre: "Objet de la mission",
        texte: "La mission a pour objet la participation de l'équipe senior féminine de "
             + "Baobabs Basket Club au tournoi international de basketball organisé à "
             + lieuMission(d) + (periodeT ? ", " + periodeT : "") + ". Elle couvre l'ensemble "
             + "des activités sportives, protocolaires et administratives liées à cette compétition." },
      { titre: "Composition de la délégation",
        texte: (c.total
                 ? "La délégation est composée de **" + U.lettres(c.total) + " (" + c.total
                   + ") membres** : " + U.enonce(c) + ".\n\n"
                 : "La composition de la délégation figure en annexe.\n\n")
             + "La liste nominative complète figure en **Annexe I**, qui fait partie intégrante "
             + "du présent ordre de mission." },
      { titre: "Durée et déplacement",
        texte: "L'arrivée de la délégation à " + (d.destVille || "destination") + " est prévue le "
             + fort(U.dateLongue(d.arrivee, true), "(date d'arrivée)") + " et son retour le "
             + fort(U.dateLongue(d.retour, true), "(date de retour)") + ".\n\n"
             + "Le présent ordre de mission couvre en conséquence la période "
             + fort(U.duAu(d.arrivee, d.retour) ? U.duAu(d.arrivee, d.retour) + " inclus" : "", "(période à préciser)")
             + ", jour d'arrivée et jour de retour compris." },
      { titre: "Chef de délégation",
        texte: "Monsieur **" + (d.signNom || "") + "**, Président de Baobabs Basket Club, "
             + "est désigné chef de délégation.\n\n"
             + "Il est chargé de la représentation officielle du club, de la coordination "
             + "administrative et sportive du déplacement, de l'accomplissement des formalités "
             + "de voyage et d'accréditation ainsi que du respect du programme et de la discipline "
             + "générale de la délégation. Il est l'interlocuteur du club auprès de l'organisation "
             + "du tournoi et des autorités compétentes." },
      { titre: "Obligations des membres de la délégation",
        texte: "Chaque membre de la délégation est tenu de respecter les directives du chef de "
             + "délégation, les décisions du staff technique, le règlement intérieur de Baobabs "
             + "Basket Club, le règlement du tournoi ainsi que les lois et règlements en vigueur "
             + "dans le pays d'accueil." },
      { titre: "Portée du présent ordre de mission",
        texte: "Le présent ordre de mission est établi pour permettre l'accomplissement de toutes "
             + "les formalités relatives au voyage, à l'accueil, à l'hébergement, à la participation "
             + "au tournoi et au retour de la délégation. Il est délivré pour servir et valoir ce "
             + "que de droit." }
    ];
  }

  /* ================================================================ */
  G.modeles['ordre-mission'] = {
    cle: 'ordre-mission',
    nom: "Ordre de mission",
    famille: "Actes",
    prefixe: "ODM",
    resume: "Mandate une délégation pour un déplacement officiel, avec sa liste en annexe.",

    /* ---------------------------- formulaire ---------------------------- */
    sections: [
      { titre: "L'acte", ouvert: true, champs: [
        { cle: 'titre',    lab: "Intitulé", type: 'texte' },
        { cle: 'numero',   lab: "Numéro",   type: 'texte', duo: true },
        { cle: 'dateActe', lab: "Fait le",  type: 'date',  duo: true },
        { cle: 'lieu',     lab: "Fait à",   type: 'texte' },
        { cle: 'objet',    lab: "Objet",    type: 'zone',
          aide: "La phrase qui suit le grand titre." }
      ]},
      { titre: "La mission", ouvert: true, champs: [
        { cle: 'destVille',    lab: "Ville",        type: 'texte', duo: true },
        { cle: 'destPays',     lab: "Pays",         type: 'texte', duo: true },
        { cle: 'organisateur', lab: "Organisateur", type: 'texte' },
        { cle: 'tournoiDu',    lab: "Tournoi, du",  type: 'date', duo: true },
        { cle: 'tournoiAu',    lab: "au",           type: 'date', duo: true },
        { cle: 'arrivee',      lab: "Arrivée",      type: 'date', duo: true },
        { cle: 'retour',       lab: "Retour",       type: 'date', duo: true,
          aide: "La période couverte va de l'arrivée au retour, inclus." }
      ]},
      { titre: "La délégation", ouvert: true, special: 'table', source: 'membres' },
      { titre: "Les articles",  ouvert: false, special: 'articles' },
      { titre: "Le signataire", ouvert: false, champs: [
        { cle: 'signNom',       lab: "Nom",     type: 'texte' },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte' },
        { cle: 'avecSignature', lab: "Apposer la signature", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet",    type: 'bascule',
          aide: "Décochez les deux pour un exemplaire vierge, à signer à la main." },
        { cle: 'avecAnnexe',    lab: "Joindre l'annexe de la délégation", type: 'bascule' },
        { cle: 'avecSecond',    lab: "Une seconde carte de signature, à remplir à la main", type: 'bascule',
          aide: "Un autre signataire que le président : la carte s'imprime vierge, sans encre ni cachet." },
        { cle: 'secondPour',    lab: "Sa carte : pour qui", type: 'texte', duo: true },
        { cle: 'secondNom',     lab: "Nom", type: 'texte', duo: true },
        { cle: 'secondQualite', lab: "Qualité", type: 'texte', duo: true },
        { cle: 'secondMention', lab: "Mention sous la carte", type: 'texte', duo: true }
      ]}
    ],

    /* ------------------------- valeurs d'arrivée ------------------------- */
    defauts: function () {
      return {
        titre: "Ordre de mission",
        numero: "01/" + String(new Date().getFullYear()).slice(2),
        dateActe: U.isoDuJour(),
        lieu: "Dakar",
        objet: "Participation au tournoi international de basketball",
        destVille: "", destPays: "", organisateur: "",
        tournoiDu: "", tournoiAu: "", arrivee: "", retour: "",
        signNom: "Antoine Jean Pierre Ndong",
        signQualite: "Président",
        avecSignature: true, avecCachet: true, avecAnnexe: true,
        avecSecond: false, secondPour: "Pour la seconde partie", secondNom: "", secondQualite: "", secondMention: "Signature",
        articles: null,
        tables: {
          membres: {
            titre: "La délégation",
            singulier: "membre",
            vide: 12,
            colonnes: [
              { cle: 'nom',       titre: "Nom et prénom(s)",      poids: 49, forme: 'fort' },
              { cle: 'qualite',   titre: "Qualité",               poids: 39, forme: 'pastille',
                choix: ['Joueuse', 'Joueur', 'Coach', 'Chef de délégation', 'Accompagnateur', 'Arbitre', 'Médecin'] },
              { cle: 'piece',     titre: "Passeport / CNI / NIN", poids: 37, forme: 'code' },
              { cle: 'naissance', titre: "Date de naissance",     poids: 30, align: 'centre' },
              { cle: 'maillot',   titre: "N° maillot",            poids: 20, align: 'centre', forme: 'nombre' }
            ],
            lignes: []
          }
        }
      };
    },

    articlesParDefaut: articlesParDefaut,

    /* ce que le contrôle avant émission vérifie en plus du tronc commun */
    controles: function (d) {
      var c = [];
      if (!String(d.destVille || '').trim()) c.push({ n: 'erreur', t: 'Pas de ville de destination' });
      if (!String(d.destPays || '').trim()) c.push({ n: 'avert', t: 'Pas de pays de destination' });
      if (!U.dateDe(d.arrivee) || !U.dateDe(d.retour)) c.push({ n: 'erreur', t: 'Dates d\'arrivée et de retour à renseigner' });
      else if (U.dateDe(d.retour) < U.dateDe(d.arrivee)) c.push({ n: 'erreur', t: 'Le retour précède l\'arrivée' });
      if (!U.dateDe(d.tournoiDu) || !U.dateDe(d.tournoiAu)) c.push({ n: 'avert', t: 'Dates du tournoi non renseignées' });
      if (!String(d.organisateur || '').trim()) c.push({ n: 'avert', t: 'Organisateur non renseigné' });
      var n = G.lignes(d, 'membres').length;
      if (n) c.push({ n: 'ok', t: n + ' membre' + (n > 1 ? 's' : '') + ' dans la délégation' });
      return c;
    },

    /* ------------------------------- la page ------------------------------- */
    page: [
      { b: 'entete', droite: function (d) {
          return ["Récépissé n° 8280", (d.lieu || '') + ", le " + U.dateLongue(d.dateActe, true)];
        } },

      { b: 'titre',
        etiquette: "Document officiel du club",
        pastille: function (d) { return d.numero ? "N° " + d.numero : ""; },
        texte: '@titre',
        sous: function (d) {
          return (d.objet || '') + (lieuMission(d) ? " à " + lieuMission(d) : "");
        } },

      { b: 'reperes', cellules: function (d) {
          var c = U.compter(G.lignes(d, 'membres'));
          return [
            { label: "Destination",     valeur: d.destVille, sous: d.destPays },
            { label: "Tournoi",         valeur: U.duAuCourt(d.tournoiDu, d.tournoiAu), sous: d.organisateur },
            { label: "Période couverte", valeur: U.duAuCourt(d.arrivee, d.retour), sous: "Arrivée et retour compris" },
            { label: "Délégation",      valeur: c.total ? c.total + " membre" + (c.total > 1 ? "s" : "") : "", sous: U.enonceCourt(c) }
          ];
        } },

      { b: 'encadre',
        avant: "Le Président de Baobabs Basket Club, agissant au nom et pour le compte du club,",
        verbe: "mandate officiellement",
        apres: function (d) {
          var c = U.compter(G.lignes(d, 'membres'));
          return "les " + (c.total ? "**" + U.lettres(c.total) + " (" + c.total + ") membres**" : "**membres**")
            + " dont les noms figurent "
            + (d.avecAnnexe ? "en **Annexe I** du présent ordre de mission" : "ci-dessous")
            + ", à l'effet de représenter Baobabs Basket Club au tournoi international de basketball "
            + "organisé à " + (lieuMission(d) || "(lieu à préciser)") + ", " + fort(U.duAu(d.tournoiDu, d.tournoiAu), "(dates à préciser)") + ".";
        } },

      { b: 'articles', articles: function (d) {
          return (d.articles && d.articles.length) ? d.articles : articlesParDefaut(d);
        } },

      { b: 'signatures',
        gauche: function (d) {
          return {
            lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>",
            note: (d.avecAnnexe && G.lignes(d, 'membres').length)
              ? "Le présent ordre de mission est accompagné de son <b>Annexe I</b>, liste complète "
                + "de la délégation, revêtue de la même signature et du même cachet."
              : "",
            reference: ref(d)
          };
        },
        cartes: function (d) {
          var cartes = [{ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite',
                          mention: "Signature et cachet du Président" }];
          if (d.avecSecond) cartes.push({ pour: '@secondPour', nom: '@secondNom', qualite: '@secondQualite',
                                          mention: '@secondMention', signer: false, cacheter: false });
          return cartes;
        } },

      /* L'annexe se montre dès l'ouverture, grille vide comprise : la page 2
         existe avant la première ligne, on voit ce qu'on va remplir. */
      { b: 'annexe',
        si: function (d) { return !!d.avecAnnexe; },
        titre: "Annexe I · Liste complète de la délégation",
        sous: function (d) { return (d.titre || '') + " n° " + (d.numero || '') + " · Baobabs Basket Club"; },
        meta: function (d) {
          return [ [d.destVille, U.duAuCourt(d.arrivee, d.retour)].filter(Boolean).join(" · "),
                   d.organisateur ? "Tournoi international · " + d.organisateur : "Tournoi international" ];
        },
        contenu: [
          { b: 'chips', chips: function (d) {
              var c = U.compter(G.lignes(d, 'membres'));
              return [
                { label: "Total",              valeur: c.total ? c.total + " membre" + (c.total > 1 ? "s" : "") : "" },
                { label: "Joueuses",           valeur: c.joueuses || "" },
                { label: "Coachs",             valeur: c.coachs || "" },
                { label: "Chef de délégation", valeur: c.chefs || "" }
              ];
            } },
          { b: 'tableau', source: 'membres', vide: 12,
            enAvant: function (l) { return estStaff(l.qualite); },
            tonPastille: function (v) { return estStaff(v) ? 'ton-plein' : 'ton-doux'; } },
          { b: 'certification',
            texte: function (d) {
              var c = U.compter(G.lignes(d, 'membres'));
              return "Je soussigné **" + (d.signNom || '') + "**, Président de Baobabs Basket Club, "
                + "certifie exacte et conforme la présente liste des "
                + (c.total ? U.lettres(c.total) + " (" + c.total + ") " : "")
                + "membres composant la délégation du club au tournoi international"
                + (d.destVille ? " de " + d.destVille : "") + ".\n\n"
                + "Fait à " + (d.lieu || '') + ", le **" + U.dateLongue(d.dateActe, true) + "**.";
            },
            reference: function (d) { return ref(d) + " · Annexe I"; },
            cartes: function (d) {
              return [{ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite',
                        mention: "Signature et cachet du Président" }];
            } }
        ] }
    ],

    pied: function (d) {
      return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280",
              (d.titre || '') + " n° " + (d.numero || '') + (d.destVille ? " · " + d.destVille : "")];
    },

    fichier: function (d) {
      return "Ordre de Mission N" + String(d.numero || '').replace(/\//g, '-') + " - BAOBABS BASKET CLUB";
    }
  };

})(window.BaobabsGreffe);
