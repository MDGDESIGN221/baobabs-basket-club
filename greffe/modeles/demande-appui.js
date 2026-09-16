/* =====================================================================
   MODÈLE : DEMANDE D'APPUI
   ---------------------------------------------------------------------
   La lettre que le club adresse à un maire, à un élu, à une fondation,
   à une entreprise, pour faire partir une délégation. Ce n'est pas la
   « demande de subvention » : celle-là chiffre un budget poste par
   poste, celle-ci est une lettre, tenue sur UNE page, faite pour être
   lue en trente secondes par quelqu'un qui en reçoit vingt.

   D'où sa forme, prise à la page de communication plutôt qu'au courrier
   administratif : une bande pleine qui dit tout de suite de quoi il
   s'agit, la lettre à gauche, et à droite un panneau or où les chiffres
   du déplacement se lisent sans lire la lettre. C'est le bloc
   « colonnes » qui porte cette mise en page ; il sert ici en premier.

   Rien n'y est décoratif : chaque chiffre se modifie sur la feuille,
   chaque case se coche, et les lignes s'ajoutent depuis le formulaire.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  function ref(d) {
    return d.numero ? 'BBC / DA / ' + String(d.numero).replace('/', ' / ') : '';
  }

  /* « Tournoi international de basketball · Mauritanie, du 23 au 28
     septembre 2026 » : la ligne du bandeau, faite des champs. */
  function mission(d) {
    var quand = U.duAu(d.dateDebut, d.dateFin);
    return [d.evenement || '', [d.lieuEvenement || '', quand].filter(Boolean).join(', ')]
      .filter(Boolean).join(' · ');
  }

  /* Les repères du panneau : TOUTES les lignes du tableau, même vides,
     pour qu'une carte ajoutée depuis le formulaire s'écrive sur la
     feuille au lieu de disparaître. */
  function chiffres(d) {
    var lg = (d.tables && d.tables.chiffres && d.tables.chiffres.lignes) || [];
    return lg.map(function (l, i) {
      return { chemin: 'tables.chiffres.lignes.' + i,
               label: l.label || '', valeur: l.valeur || '', sous: l.sous || '' };
    });
  }

  /* Les cases « ce que nous sollicitons » : l'index est celui de la
     donnée, pas celui de la liste filtrée, sinon une ligne vide au
     milieu ferait cocher la mauvaise case. */
  function besoins(d) {
    var lg = (d.tables && d.tables.besoins && d.tables.besoins.lignes) || [];
    var out = [];
    lg.forEach(function (l, i) {
      if (!String(l.texte || '').trim()) return;
      out.push({ texte: '@tables.besoins.lignes.' + i + '.texte',
                 chemin: 'tables.besoins.lignes.' + i + '.retenu' });
    });
    return out;
  }

  G.modeles['demande-appui'] = {
    cle: 'demande-appui',
    nom: "Demande d'appui",
    famille: "Correspondance",
    prefixe: "DA",
    resume: "Une page : la lettre à gauche, les chiffres du déplacement à droite, la signature et le cachet.",

    /* ---------------------------- formulaire ---------------------------- */
    sections: [
      { titre: "La demande", ouvert: true, champs: [
        { cle: 'numero',   lab: "Numéro",  type: 'texte', duo: true,
          aide: "Laissez vide pour une demande sans numéro." },
        { cle: 'dateActe', lab: "Fait le", type: 'date',  duo: true },
        { cle: 'lieu',     lab: "Fait à",  type: 'texte', duo: true },
        /* VIDE À DESSEIN. Le numéro de récépissé que les autres modèles
           impriment par défaut n'est recoupé par AUCUNE source du club :
           ni le site, ni la base, ni les documents d'origine. Tant qu'il
           n'est pas confirmé, cette lettre ne l'affiche pas. */
        { cle: 'recepisse', lab: "N° de récépissé", type: 'texte', duo: true,
          aide: "Laissez vide tant que le numéro n'est pas confirmé : rien ne s'imprime." }
      ]},
      { titre: "Le destinataire", ouvert: true, champs: [
        { cle: 'destNom',     lab: "Destinataire", type: 'texte',
          aide: "« Monsieur Alioune Tall »" },
        { cle: 'destQualite', lab: "Sa qualité", type: 'texte',
          aide: "« Maire de la commune de Mermoz Sacré Cœur »" },
        { cle: 'destAdresse', lab: "Adresse", type: 'zone',
          aide: "Facultatif. Une ligne par ligne d'adresse." }
      ]},
      { titre: "Le déplacement", ouvert: true, champs: [
        { cle: 'evenement',    lab: "L'événement", type: 'texte',
          aide: "« Tournoi international de basketball »" },
        { cle: 'lieuEvenement', lab: "Où", type: 'texte', duo: true },
        { cle: 'equipe',       lab: "Qui part", type: 'texte', duo: true,
          aide: "« L'équipe féminine »" },
        { cle: 'dateDebut',    lab: "Du", type: 'date', duo: true },
        { cle: 'dateFin',      lab: "Au", type: 'date', duo: true }
      ]},
      { titre: "L'objet", ouvert: true, champs: [
        { cle: 'objet',   lab: "Objet", type: 'texte' },
        { cle: 'chapeau', lab: "Précision", type: 'zone',
          aide: "La ligne sous l'objet, en plus petit." }
      ]},
      { titre: "La lettre", ouvert: true, champs: [
        { cle: 'salutation', lab: "Appel", type: 'texte',
          aide: "« Monsieur le Maire, », « Monsieur le Président, »" },
        { cle: 'corps',      lab: "Texte", type: 'zone',
          aide: "Une ligne vide sépare deux paragraphes. **Deux étoiles** pour le gras." },
        { cle: 'formule',    lab: "Formule de politesse", type: 'zone' }
      ]},
      { titre: "Les chiffres du panneau", ouvert: false, special: 'table', source: 'chiffres' },
      { titre: "Ce que nous sollicitons", ouvert: false, special: 'table', source: 'besoins' },
      { titre: "À propos du club", ouvert: false, champs: [
        { cle: 'aproposTitre', lab: "Titre", type: 'texte' },
        { cle: 'apropos',      lab: "Texte", type: 'zone' }
      ]},
      { titre: "Le signataire", ouvert: false, champs: [
        { cle: 'signNom',       lab: "Nom",     type: 'texte', duo: true },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte', duo: true },
        { cle: 'tel',           lab: "Téléphone", type: 'texte' },
        { cle: 'avecSignature', lab: "Apposer la signature", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet",    type: 'bascule' },
        { cle: 'tonPanneau',    lab: "Couleur du panneau", type: 'choix',
          choix: ['or', 'vert', 'noir', 'clair', 'blanc'] }
      ]}
    ],

    /* ------------------------- valeurs d'arrivée ------------------------- */
    defauts: function () {
      return {
        titre: "Demande d'appui",
        numero: "",
        dateActe: U.isoDuJour(),
        lieu: "Dakar",
        recepisse: "",
        destNom: "", destQualite: "", destAdresse: "",
        evenement: "Tournoi international de basketball",
        lieuEvenement: "Mauritanie",
        equipe: "L'équipe féminine",
        dateDebut: "", dateFin: "",
        objet: "Demande d'appui financier, matériel et logistique",
        chapeau: "",
        salutation: "Monsieur,",
        corps: "Dans le cadre de sa participation à un tournoi international de basketball, "
             + "le Baobabs Basket Club sollicite respectueusement votre accompagnement pour la "
             + "prise en charge de sa délégation."
             + "\n\nCette compétition constitue une étape majeure dans le développement de notre "
             + "jeune équipe féminine. Elle lui permettra de représenter dignement notre quartier "
             + "et, au-delà, de porter les couleurs du Sénégal sur la scène internationale."
             + "\n\nÀ cet effet, nous sollicitons votre appui financier, matériel ou logistique "
             + "afin de contribuer aux frais de transport, d'hébergement, de restauration et "
             + "d'équipement de la délégation."
             + "\n\nConvaincus de votre engagement en faveur de la jeunesse et du développement "
             + "du sport, nous espérons pouvoir compter sur votre précieux soutien pour la "
             + "réussite de cette mission.",
        formule: "Dans l'attente d'une suite favorable, nous vous prions d'agréer, Monsieur, "
               + "l'expression de notre haute considération.",
        aproposTitre: "À propos du club",
        /* Seuls des faits recoupés sur le site du club : Sicap Baobab, la
           devise, l'école de basket. Ni « ASC Baobab », ni le récépissé :
           aucune source du club ne les porte. */
        apropos: "Baobabs Basket Club forme des joueuses et des joueurs du quartier, à Sicap "
               + "Baobab (Dakar), de l'école de basket aux équipes seniors, sous la devise "
               + "« Grandir ici. Régner partout. »",
        signNom: "Antoine Jean Pierre Ndong",
        signQualite: "Président",
        tel: "77 858 74 53",
        avecSignature: true, avecCachet: true,
        tonPanneau: 'or',
        tables: {
          chiffres: {
            titre: "Les chiffres du panneau", singulier: "chiffre", vide: 0,
            colonnes: [
              { cle: 'label',  titre: "Libellé", poids: 34 },
              { cle: 'valeur', titre: "Le chiffre", poids: 34, forme: 'fort' },
              { cle: 'sous',   titre: "Précision", poids: 42 }
            ],
            lignes: [
              { label: "Dates du tournoi", valeur: "", sous: "" },
              { label: "Lieu", valeur: "", sous: "Tournoi international" },
              { label: "La délégation", valeur: "", sous: "Joueuses et encadrement" },
              { label: "Budget du déplacement", valeur: "", sous: "FCFA" }
            ]
          },
          besoins: {
            titre: "Ce que nous sollicitons", singulier: "besoin", vide: 0,
            colonnes: [
              { cle: 'texte',  titre: "Poste", poids: 70, forme: 'fort' },
              { cle: 'retenu', titre: "Coché", poids: 20, align: 'centre',
                forme: 'pastille', choix: ['oui', 'non'] }
            ],
            lignes: [
              { texte: "Transport", retenu: true },
              { texte: "Hébergement", retenu: true },
              { texte: "Restauration", retenu: true },
              { texte: "Équipement", retenu: true }
            ]
          }
        }
      };
    },

    controles: function (d) {
      var c = [];
      if (!String(d.destNom || '').trim()) c.push({ n: 'erreur', t: 'Pas de destinataire' });
      if (!String(d.objet || '').trim()) c.push({ n: 'erreur', t: "Pas d'objet" });
      if (String(d.corps || '').trim().length < 40) c.push({ n: 'avert', t: 'Le corps de la lettre est très court' });
      if (!d.dateDebut && !d.dateFin) c.push({ n: 'avert', t: 'Les dates du déplacement ne sont pas posées' });
      var vides = ((d.tables && d.tables.chiffres && d.tables.chiffres.lignes) || [])
        .filter(function (l) { return !String(l.valeur || '').trim(); }).length;
      if (vides) c.push({ n: 'avert', t: vides + ' chiffre' + (vides > 1 ? 's' : '') + ' du panneau ' + (vides > 1 ? 'restent vides' : 'reste vide') });
      return c;
    },

    /* ------------------------------- la page ------------------------------- */
    page: [
      { b: 'fronton',
        ton: 'vert',
        meta: function (d) {
          return [(d.lieu || '') + ", le " + U.dateLongue(d.dateActe, false),
                  d.numero ? "Demande n° " + d.numero
                           : (d.recepisse ? "Récépissé n° " + U.ech(d.recepisse) : "")];
        },
        etiquette: function (d) { return d.equipe ? U.ech(d.equipe) : "Baobabs Basket Club"; },
        texte: "Demande d'appui",
        sous: mission,
        droite: function (d) {
          var quand = U.duAuCourt(d.dateDebut, d.dateFin);
          return [quand || (d.lieuEvenement || ''), quand ? (d.lieuEvenement || '') : ''];
        } },

      /* Le destinataire et l'objet côte à côte : la lettre se lit en
         diagonale, et la page gagne la hauteur d'un bloc entier. */
      { b: 'colonnes', ton: 'nu', poids: 46, titre: '',
        gauche: [
          { b: 'parties',
            si: function (d) { return !!String(d.destNom || '').trim(); },
            parties: function (d) {
              return [{
                label: "À l'attention de",
                nom: '@destNom',
                texte: [d.destQualite, d.destAdresse].filter(Boolean).join("\n\n"),
                tag: ''
              }];
            } }
        ],
        droite: [
          { b: 'encadre',
            si: function (d) { return !!String(d.objet || '').trim(); },
            etiquette: "Objet",
            titre: '@objet',
            apres: '@chapeau' }
        ] },

      /* Le cœur de la page : la lettre, et le panneau qui la résume. */
      { b: 'colonnes',
        ton: '@tonPanneau',
        poids: 62,
        titre: "Quelques chiffres",
        gauche: [
          { b: 'lettre', salutation: '@salutation', texte: '@corps', formule: '@formule' },
          { b: 'texte',
            si: function (d) { return !!String(d.apropos || '').trim(); },
            etiquette: '@aproposTitre', texte: '@apropos' }
        ],
        droite: [
          { b: 'reperes', pile: true, cellules: chiffres }
        ] },

      /* En pleine largeur, sur une seule ligne : dans le panneau, les
         quatre cases empilées faisaient à elles seules déborder la page. */
      { b: 'cases',
        si: function (d) { return besoins(d).length > 0; },
        etiquette: "Ce que nous sollicitons",
        enLigne: true,
        cases: besoins },

      /* La bande de contact : le téléphone en grand, c'est par là qu'une
         réponse arrive. Les courriers du club n'en portaient aucun. */
      { b: 'reperes',
        ton: 'vert',
        cellules: function (d) {
          return [{ label: "Le club", valeur: "Baobabs Basket Club", sous: "Grandir ici. Régner partout." },
                  { label: "Téléphone", valeur: '@tel', sous: "Le Président" },
                  { label: "Siège", valeur: "Sicap Baobab, Dakar", sous: d.recepisse ? "Récépissé n° " + U.ech(d.recepisse) : "Sénégal" }];
        } },

      { b: 'signatures',
        gauche: function (d) {
          return {
            lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>",
            note: "",
            reference: ref(d)
          };
        },
        cartes: [{ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite',
                   mention: "Signature et cachet du Président" }] }
    ],

    pied: function (d) {
      return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal"
                + (d.recepisse ? " · Récépissé n° " + d.recepisse : "")
                + (d.tel ? " · " + d.tel : ""),
              (d.objet || "Demande d'appui") + (d.destNom ? " · " + d.destNom : "")];
    },

    fichier: function (d) {
      return "Demande d'appui" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : "")
           + (d.destNom ? " - " + d.destNom : "") + " - BAOBABS BASKET CLUB";
    }
  };

})(window.BaobabsGreffe);
