/* =====================================================================
   MODÈLE : CONVENTION DE BÉNÉVOLAT
   ---------------------------------------------------------------------
   Une personne donne de son temps au club : accueil des familles,
   table de marque, transport, buvette, communication. Ce n'est pas un
   emploi et la convention le dit : pas de salaire, des frais remboursés
   sur justificatifs, une assurance, une fin libre. Sept articles
   courts, deux signatures.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  function v(x, repli) { return String(x || '').trim() || repli; }
  function fem(d) { return /^Madame/i.test(String(d.genre || '')); }
  function leB(d) { return fem(d) ? "la Bénévole" : "le Bénévole"; }
  function LeB(d) { return fem(d) ? "La Bénévole" : "Le Bénévole"; }
  function ee(d) { return fem(d) ? "e" : ""; }

  function articlesParDefaut(d) {
    var B = leB(d), Bm = LeB(d), e = ee(d), duAu = U.duAu(d.du, d.au);
    return [
      { titre: "Objet",
        texte: Bm + " apporte son concours bénévole à Baobabs Basket Club pour les missions décrites à "
             + "l'article 2, dans le respect du projet et des règlements du Club." },
      { titre: "Missions",
        texte: v(d.missions, "- Accueil des familles les jours de match\n- Tenue de la table de marque\n- Aide à la logistique des déplacements") },
      { titre: "Durée et disponibilité",
        texte: "La convention est conclue pour **" + v(d.duree, "la saison sportive") + "**" + (duAu ? ", " + duAu : "") + ". "
             + Bm + " indique sa disponibilité : " + v(d.disponibilite, "à convenir avec le bureau") + ". "
             + "Il" + (fem(d) ? "" : "") + " n'est tenu" + e + " à aucun horaire imposé et prévient le Club quand "
             + (fem(d) ? "elle" : "il") + " ne peut pas venir." },
      { titre: "Absence de rémunération",
        texte: "Le bénévolat est libre et gratuit. " + Bm + " ne perçoit aucune rémunération, sous quelque forme "
             + "que ce soit. La présente convention ne crée aucun lien de subordination ni aucun contrat de travail." },
      { titre: "Frais",
        texte: "Les frais engagés pour le Club, à sa demande (transport, repas en déplacement, petit matériel), "
             + "sont remboursés sur présentation d'une note de frais avec justificatifs"
             + (v(d.plafond, "") ? ", dans la limite de **" + d.plafond.trim() + "** par mois" : "") + "." },
      { titre: "Assurance et sécurité",
        texte: "Le Club assure " + B + " pour les activités qu'il lui confie, dans le cadre de son contrat "
             + "d'assurance responsabilité civile. " + Bm + " respecte les consignes de sécurité et signale "
             + "au bureau tout incident." },
      { titre: "Engagements réciproques",
        texte: Bm + " respecte les personnes, les règlements et la confidentialité de ce qui touche aux joueuses "
             + "et aux familles. Le Club met à disposition le matériel nécessaire, informe " + B + " des "
             + "décisions qui le concernent, et reconnaît son engagement." },
      { titre: "Fin de la convention",
        texte: "Chacune des parties peut mettre fin à la convention à tout moment, en prévenant l'autre par "
             + "écrit avec un délai de courtoisie de " + v(d.preavis, "quinze (15) jours") + ". "
             + Bm + " restitue alors le matériel et les accès qui lui ont été confiés." }
    ];
  }

  G.modeles['convention-benevolat'] = {
    cle: 'convention-benevolat',
    nom: "Convention de bénévolat",
    famille: "Conventions et contrats",
    prefixe: "CB",
    resume: "Une personne donne son temps : missions, pas de salaire, frais remboursés, assurance, fin libre.",

    sections: [
      { titre: "La convention", ouvert: true, champs: [
        { cle: 'numero',    lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Fait le", type: 'date', duo: true },
        { cle: 'lieu',      lab: "Fait à", type: 'texte', duo: true },
        { cle: 'duree',     lab: "Durée", type: 'texte', duo: true },
        { cle: 'du',        lab: "Du", type: 'date', duo: true },
        { cle: 'au',        lab: "Au", type: 'date', duo: true },
        { cle: 'preavis',   lab: "Délai de courtoisie", type: 'texte', duo: true },
        { cle: 'plafond',   lab: "Plafond de frais par mois (FCFA)", type: 'texte', duo: true }
      ]},
      { titre: "Le bénévole", ouvert: true, champs: [
        { cle: 'genre',     lab: "Civilité", type: 'choix', duo: true, choix: ['Monsieur', 'Madame'] },
        { cle: 'nom',       lab: "Nom et prénom(s)", type: 'texte', duo: true },
        { cle: 'naissance', lab: "Date de naissance", type: 'date', duo: true },
        { cle: 'piece',     lab: "Passeport / CNI", type: 'texte', duo: true },
        { cle: 'telephone', lab: "Téléphone", type: 'texte', duo: true },
        { cle: 'email',     lab: "E-mail", type: 'texte', duo: true },
        { cle: 'missions',  lab: "Missions", type: 'zone', aide: "Une par ligne, précédée d'un tiret." },
        { cle: 'disponibilite', lab: "Disponibilité", type: 'texte', aide: "« les samedis de match, deux soirs par semaine »" }
      ]},
      { titre: "Les articles", ouvert: false, special: 'articles' },
      { titre: "Les signataires", ouvert: false, champs: [
        { cle: 'signNom',       lab: "Pour le club", type: 'texte', duo: true },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte', duo: true },
        { cle: 'avecSignature', lab: "Apposer la signature du président", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule' }
      ]}
    ],

    defauts: function () {
      return {
        titre: "Convention de bénévolat", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar",
        duree: "la saison sportive", du: "", au: "", preavis: "quinze (15) jours", plafond: "",
        genre: "Monsieur", nom: "", naissance: "", piece: "", telephone: "", email: "",
        missions: "- Accueil des familles les jours de match\n- Tenue de la table de marque\n- Aide à la logistique des déplacements",
        disponibilite: "",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président",
        avecSignature: true, avecCachet: true, articles: null, tables: {}
      };
    },
    articlesParDefaut: articlesParDefaut,

    controles: function (d) {
      var c = [];
      if (!String(d.nom || '').trim()) c.push({ n: 'avert', t: 'Identité vide : à compléter au stylo, en pointillé' });
      if (!String(d.missions || '').trim()) c.push({ n: 'erreur', t: 'Aucune mission' });
      return c;
    },

    page: [
      { b: 'entete', drapeau: false, devise: "Section Basketball · Bénévolat · Dakar",
        droite: function (d) { return [d.numero ? "Convention n° " + d.numero : "Convention", v(d.duree, "à convenir")]; } },
      { b: 'parties', parties: function (d) {
          var champs = v(d.nom, "") ? [] : [{ label: fem(d) ? "Madame" : "Monsieur", valeur: "", large: true }];
          champs.push({ label: fem(d) ? "Née le" : "Né le", valeur: U.dateLongue(d.naissance, false) }, { label: "Passeport / CNI", valeur: d.piece },
                      { label: "Téléphone", valeur: d.telephone }, { label: "E-mail", valeur: d.email });
          return [{ label: "Le Club", nom: "Baobabs Basket Club", texte: "Représenté par son Président, Monsieur " + v(d.signNom, "Antoine Jean Pierre Ndong") + ".", tag: "Ci-après dénommé « le Club »" },
                  { label: LeB(d), nom: '@nom', champs: champs, tag: "Ci-après dénommé" + ee(d) + " « " + leB(d) + " »" }];
        } },
      { b: 'titre', etiquette: "Baobabs Basket Club · Bénévolat", pastille: function (d) { return d.numero ? "N° " + d.numero : ""; },
        texte: '@titre', sous: "Le bénévolat est libre et gratuit. La présente convention dit ce que chacun apporte, et ce que le Club garantit." },
      { b: 'phrase', texte: "Il est convenu ce qui suit :" },
      { b: 'articles', articles: function (d) { return (d.articles && d.articles.length) ? d.articles : articlesParDefaut(d); } },
      { b: 'signatures',
        gauche: function (d) { return { lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "En deux exemplaires originaux.", reference: d.numero ? 'BBC / CB / ' + String(d.numero).replace('/', ' / ') : '' }; },
        cartes: function (d) {
          return [{ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite', mention: "Signature et cachet du Président" },
                  { pour: LeB(d), nom: v(d.nom, "Nom et prénom(s) :"), qualite: "", mention: "Lu et approuvé · Signature", signer: false, cacheter: false }];
        } }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280", "Convention de bénévolat" + (d.numero ? " n° " + d.numero : '') + (d.nom ? " · " + d.nom : '')]; },
    fichier: function (d) { return "Convention benevolat" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : '') + (d.nom ? " - " + d.nom : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
