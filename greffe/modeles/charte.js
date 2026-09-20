/* =====================================================================
   MODÈLE : CHARTE DE LA JOUEUSE
   ---------------------------------------------------------------------
   Ce qu'on attend d'une joueuse du club, écrit une fois et signé à
   l'inscription : assiduité, respect, tenue, santé, image, sanctions.
   Pas un contrat, un engagement moral, avec le parent si elle est
   mineure. Sept articles courts, modifiables ; la joueuse signe « lu et
   approuvé », le président contresigne.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  function v(x, repli) { return String(x || '').trim() || repli; }
  function fem(d) { return !/joueur$/i.test(String(d.genre || 'Joueuse')); }
  function mineure(d) { return /^Oui/i.test(String(d.mineure || '')); }

  function articlesParDefaut(d) {
    var je = fem(d) ? "Je m'engage, en tant que joueuse," : "Je m'engage, en tant que joueur,";
    return [
      { titre: "Assiduité",
        texte: je + " à être présent" + (fem(d) ? "e" : "") + " et à l'heure aux entraînements, aux matchs et aux stages auxquels je suis convoqué" + (fem(d) ? "e" : "") + ", "
             + "et à prévenir le coach au plus tôt de toute absence." },
      { titre: "Respect",
        texte: "À respecter mes coéquipières, le staff, les adversaires, les arbitres, les familles et les bénévoles, sur le terrain comme en dehors. "
             + "Aucune violence, aucune insulte, aucune discrimination." },
      { titre: "Tenue et matériel",
        texte: "À porter la tenue du Club lors des matchs et des déplacements, à prendre soin du matériel et des installations, et à restituer ce qui m'est prêté." },
      { titre: "Santé",
        texte: "À fournir un certificat médical à jour, à signaler toute blessure ou douleur au staff, à suivre les consignes de récupération, "
             + "et à ne prendre aucun produit interdit." },
      { titre: "Image et réseaux",
        texte: "À défendre l'image du Club dans mes propos et sur les réseaux sociaux, à ne rien publier qui nuise à une coéquipière, au staff ou au Club, "
             + "et à demander avant de publier des images prises dans le cadre du Club." },
      { titre: "Engagement sportif",
        texte: "À donner le meilleur de moi-même, à accepter les choix du coach, à jouer pour l'équipe, et à représenter Baobabs Basket Club avec fierté." },
      { titre: "Sanctions",
        texte: "Un manquement à la présente charte peut entraîner, selon sa gravité : un rappel par le coach, un entretien avec le bureau, "
             + "une mise à l'écart temporaire, ou l'exclusion du Club. La joueuse est toujours entendue avant une sanction." }
    ];
  }

  G.modeles['charte'] = {
    cle: 'charte',
    nom: "Charte de la joueuse",
    famille: "Vie sportive",
    prefixe: "CH",
    resume: "Ce que le club attend, signé à l'inscription : assiduité, respect, tenue, santé, image, sanctions.",

    sections: [
      { titre: "La charte", ouvert: true, champs: [
        { cle: 'numero',    lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Signée le", type: 'date', duo: true },
        { cle: 'lieu',      lab: "À", type: 'texte', duo: true },
        { cle: 'saison',    lab: "Saison", type: 'texte', duo: true }
      ]},
      { titre: "La joueuse", ouvert: true, champs: [
        { cle: 'genre',     lab: "Il s'agit de", type: 'choix', duo: true, choix: ['Joueuse', 'Joueur'] },
        { cle: 'mineure',   lab: "Mineure ?", type: 'choix', duo: true, choix: ['Non', 'Oui'] },
        { cle: 'nom',       lab: "Nom et prénom(s)", type: 'texte' },
        { cle: 'naissance', lab: "Date de naissance", type: 'date', duo: true },
        { cle: 'categorie', lab: "Catégorie", type: 'texte', duo: true },
        { cle: 'tuteur',    lab: "Parent ou tuteur (si mineure)", type: 'texte' }
      ]},
      { titre: "Les articles", ouvert: false, special: 'articles' },
      { titre: "Le signataire", ouvert: false, champs: [
        { cle: 'signNom',       lab: "Pour le club", type: 'texte', duo: true },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte', duo: true },
        { cle: 'avecSignature', lab: "Apposer la signature du président", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule' }
      ]}
    ],

    defauts: function () {
      var an = new Date().getFullYear();
      return {
        titre: "Charte de la joueuse", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar", saison: an + "-" + (an + 1),
        genre: "Joueuse", mineure: "Non", nom: "", naissance: "", categorie: "", tuteur: "",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président",
        avecSignature: true, avecCachet: true, articles: null, tables: {}
      };
    },
    articlesParDefaut: articlesParDefaut,

    controles: function (d) {
      var c = [];
      if (!String(d.nom || '').trim()) c.push({ n: 'avert', t: 'Nom vide : à compléter au stylo, en pointillé' });
      if (mineure(d) && !String(d.tuteur || '').trim()) c.push({ n: 'avert', t: 'Mineure : le parent ou tuteur signe aussi' });
      return c;
    },

    page: [
      { b: 'entete', drapeau: false, devise: function (d) { return "Section Basketball · Saison " + v(d.saison, "") + " · Dakar"; },
        droite: function (d) { return [d.numero ? "Charte n° " + d.numero : "Charte", v(d.categorie, "")]; } },
      { b: 'titre', etiquette: "Baobabs Basket Club · Vie sportive", pastille: function (d) { return v(d.saison, ""); },
        texte: function (d) { return fem(d) ? "Charte de la joueuse" : "Charte du joueur"; },
        sous: "Porter le maillot des Baobabs engage. Cette charte dit à quoi, en sept points, pour que chacune sache ce qu'elle signe." },
      { b: 'reperes', cellules: function (d) {
          var c = [{ label: fem(d) ? "Joueuse" : "Joueur", valeur: v(d.nom, "") }, { label: fem(d) ? "Née le" : "Né le", valeur: U.dateLongue(d.naissance, false) }, { label: "Catégorie", valeur: v(d.categorie, "") }];
          if (mineure(d)) c.push({ label: "Parent ou tuteur", valeur: v(d.tuteur, "") });
          return c;
        } },
      { b: 'phrase', texte: function (d) { return (fem(d) ? "Je soussignée, joueuse" : "Je soussigné, joueur") + " de Baobabs Basket Club, m'engage à respecter les points suivants :"; } },
      { b: 'articles', articles: function (d) { return (d.articles && d.articles.length) ? d.articles : articlesParDefaut(d); } },
      { b: 'signatures',
        gauche: function (d) { return { lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "", reference: d.numero ? 'BBC / CH / ' + String(d.numero).replace('/', ' / ') : '' }; },
        cartes: function (d) {
          var cartes = [{ pour: fem(d) ? "La joueuse" : "Le joueur", nom: v(d.nom, "Nom et prénom(s) :"), qualite: "", mention: "Lu et approuvé · Signature", signer: false, cacheter: false }];
          if (mineure(d)) cartes.push({ pour: "Le parent ou tuteur", nom: v(d.tuteur, "Nom :"), qualite: "", mention: "Lu et approuvé · Signature", signer: false, cacheter: false });
          cartes.push({ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite', mention: "Signature et cachet" });
          return cartes;
        } }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280", "Charte" + (d.numero ? " n° " + d.numero : '') + (d.nom ? " · " + d.nom : '')]; },
    fichier: function (d) { return "Charte" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : '') + (d.nom ? " - " + d.nom : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
