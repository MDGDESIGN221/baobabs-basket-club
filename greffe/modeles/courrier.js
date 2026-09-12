/* =====================================================================
   MODÈLE : COURRIER OFFICIEL
   ---------------------------------------------------------------------
   Ce fichier existe surtout pour prouver une chose : un acte de forme
   entièrement différente ne demande PAS une ligne de HTML, ni une ligne
   de CSS. Pas de tableau, pas d'articles, un destinataire et un corps
   de lettre, et pourtant la même charte, le même pied de page, la même
   encre du président.

   Repris du courrier de confirmation adressé à Woman Sport Rim le
   13 août 2026, qui est dans le dossier des actes du club.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  function ref(d) {
    return d.numero ? 'BBC / CO / ' + String(d.numero).replace('/', ' / ') : '';
  }

  G.modeles['courrier'] = {
    cle: 'courrier',
    nom: "Courrier officiel",
    famille: "Correspondance",
    prefixe: "CO",
    resume: "Une lettre au nom du club, avec destinataire, objet et signature.",

    /* ---------------------------- formulaire ---------------------------- */
    sections: [
      { titre: "Le courrier", ouvert: true, champs: [
        { cle: 'numero',   lab: "Numéro",  type: 'texte', duo: true,
          aide: "Laissez vide pour un courrier sans numéro." },
        { cle: 'dateActe', lab: "Fait le", type: 'date',  duo: true },
        { cle: 'lieu',     lab: "Fait à",  type: 'texte' }
      ]},
      { titre: "Le destinataire", ouvert: true, champs: [
        { cle: 'destNom',    lab: "Destinataire", type: 'texte' },
        { cle: 'destLigne',  lab: "À l'attention de", type: 'texte' },
        { cle: 'destAdresse', lab: "Adresse", type: 'zone',
          aide: "Facultatif. Une ligne par ligne d'adresse." }
      ]},
      { titre: "L'objet", ouvert: true, champs: [
        { cle: 'objet',  lab: "Objet",     type: 'texte' },
        { cle: 'chapeau', lab: "Précision", type: 'zone',
          aide: "La ligne sous l'objet, en plus petit." }
      ]},
      { titre: "Le corps de la lettre", ouvert: true, champs: [
        { cle: 'salutation', lab: "Appel", type: 'texte' },
        { cle: 'corps',      lab: "Texte", type: 'zone',
          aide: "Une ligne vide sépare deux paragraphes. **Deux étoiles** pour le gras." },
        { cle: 'formule',    lab: "Formule de politesse", type: 'zone' }
      ]},
      { titre: "Le signataire", ouvert: false, champs: [
        { cle: 'signNom',       lab: "Nom",     type: 'texte' },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte' },
        { cle: 'avecSignature', lab: "Apposer la signature", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet",    type: 'bascule' },
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
        titre: "Courrier officiel",
        numero: "",
        dateActe: U.isoDuJour(),
        lieu: "Dakar",
        destNom: "", destLigne: "", destAdresse: "",
        objet: "",
        chapeau: "",
        salutation: "Madame, Monsieur,",
        corps: "Par la présente, Baobabs Basket Club a l'honneur de ",
        formule: "Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.",
        signNom: "Antoine Jean Pierre Ndong",
        signQualite: "Président",
        avecSignature: true, avecCachet: true,
        avecSecond: false, secondPour: "Pour la seconde partie", secondNom: "", secondQualite: "", secondMention: "Signature",
        tables: {}
      };
    },

    controles: function (d) {
      var c = [];
      if (!String(d.destNom || '').trim()) c.push({ n: 'erreur', t: 'Pas de destinataire' });
      if (!String(d.objet || '').trim()) c.push({ n: 'erreur', t: 'Pas d\'objet' });
      if (String(d.corps || '').trim().length < 40) c.push({ n: 'avert', t: 'Le corps de la lettre est très court' });
      return c;
    },

    /* ------------------------------- la page ------------------------------- */
    page: [
      { b: 'entete', droite: function (d) {
          return [(d.lieu || '') + ", le " + U.dateLongue(d.dateActe, false),
                  d.numero ? "Courrier n° " + d.numero : "Récépissé n° 8280"];
        } },

      { b: 'parties',
        si: function (d) { return !!String(d.destNom || '').trim(); },
        parties: function (d) {
          return [{
            label: "Destinataire",
            nom: '@destNom',
            texte: [d.destLigne, d.destAdresse].filter(Boolean).join("\n\n"),
            tag: ''
          }];
        } },

      { b: 'encadre',
        si: function (d) { return !!String(d.objet || '').trim(); },
        etiquette: "Objet",
        titre: '@objet',
        apres: '@chapeau' },

      { b: 'lettre',
        salutation: '@salutation',
        texte: '@corps',
        formule: '@formule' },

      { b: 'signatures',
        gauche: function (d) {
          return {
            lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>",
            note: "",
            reference: ref(d)
          };
        },
        cartes: function (d) {
          var cartes = [{ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite',
                          mention: "Signature et cachet du Président" }];
          if (d.avecSecond) cartes.push({ pour: '@secondPour', nom: '@secondNom', qualite: '@secondQualite',
                                          mention: '@secondMention', signer: false, cacheter: false });
          return cartes;
        } }
    ],

    pied: function (d) {
      return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280",
              (d.objet || "Courrier officiel") + (d.destNom ? " · " + d.destNom : "")];
    },

    fichier: function (d) {
      var o = String(d.objet || 'Courrier').slice(0, 60);
      return "Courrier" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : "")
           + " - " + o + " - BAOBABS BASKET CLUB";
    }
  };

})(window.BaobabsGreffe);
