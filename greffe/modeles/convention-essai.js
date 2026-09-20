/* =====================================================================
   MODÈLE : CONVENTION D'ESSAI D'UNE RECRUE
   ---------------------------------------------------------------------
   Une joueuse repérée aux tryouts vient s'entraîner avec l'équipe
   pendant quelques semaines avant qu'on décide. Ce papier dit ce que
   l'essai est, et surtout ce qu'il n'est pas : pas un engagement, pas
   d'indemnité, une durée, un certificat médical, l'autorisation des
   parents si elle est mineure, et ce qui se passe à la fin (contrat,
   prolongation, ou fin sans suite). Le coach compose, le président signe.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  function v(x, repli) { return String(x || '').trim() || repli; }
  function fem(d) { return !/joueur$/i.test(String(d.genre || 'Joueuse')); }
  function laR(d) { return fem(d) ? "la Recrue" : "le Recru"; }
  function LaR(d) { return fem(d) ? "La Recrue" : "Le Recru"; }
  function ee(d) { return fem(d) ? "e" : ""; }
  function mineure(d) { return /^Oui/i.test(String(d.mineure || '')); }

  function articlesParDefaut(d) {
    var R = laR(d), Rm = LaR(d), e = ee(d), duAu = U.duAu(d.du, d.au);
    var a = [
      { titre: "Objet",
        texte: "Baobabs Basket Club accueille " + R + " à l'essai au sein de " + v(d.equipe, "l'équipe Senior") + ", "
             + "afin d'apprécier son niveau, son état d'esprit et son intégration dans le groupe.\n\n"
             + "**L'essai n'est pas un engagement.** Il ne crée aucun droit à un contrat, à une licence ou à une indemnité." },
      { titre: "Durée",
        texte: "L'essai dure **" + v(d.duree, "quatre (4) semaines") + "**" + (duAu ? ", " + duAu : "") + ". "
             + "Il peut être écourté à tout moment par le Club ou par " + R + ", sans motif ni indemnité, par simple information écrite." },
      { titre: "Conditions",
        texte: Rm + " fournit avant la première séance un **certificat médical** de non contre-indication à la pratique du basketball"
             + (mineure(d) ? " et l'**autorisation écrite de ses parents ou tuteurs** (acte « Autorisation parentale » du Club)" : "") + ".\n\n"
             + "Le Club prête " + v(d.fourni, "la tenue d'entraînement et le matériel") + ", à restituer à la fin de l'essai. "
             + "Aucune indemnité n'est due pendant l'essai" + (v(d.priseEnCharge, "") ? ", à l'exception de : " + d.priseEnCharge.trim() : "") + "." },
      { titre: "Engagements de " + R,
        texte: Rm + " participe aux séances, matchs amicaux et réunions auxquels " + (fem(d) ? "elle" : "il") + " est convoqué" + e + ", "
             + "respecte le staff, les joueuses et le règlement intérieur, et informe le Club de toute blessure ou indisponibilité." },
      { titre: "Engagements du Club",
        texte: "Le Club encadre " + R + " comme les autres joueuses, l'assure pour les séances organisées par lui, "
             + "et lui rend compte de l'évaluation à la fin de l'essai." },
      { titre: "Issue de l'essai",
        texte: "Au terme de l'essai, le Club se prononce par écrit dans les " + v(d.delaiDecision, "sept (7) jours") + " :\n"
             + "- **engagement** : un contrat d'engagement sportif est proposé à " + R + " ;\n"
             + "- **prolongation** : l'essai est prolongé une seule fois, d'une durée convenue ;\n"
             + "- **fin sans suite** : l'essai s'arrête, sans que rien ne soit dû de part ni d'autre." },
      { titre: "Image et confidentialité",
        texte: "Les images prises pendant l'essai restent internes au Club, sauf accord écrit de " + R
             + (mineure(d) ? " et de ses parents" : "") + ". Les échanges avec le staff restent confidentiels." }
    ];
    return a;
  }

  G.modeles['convention-essai'] = {
    cle: 'convention-essai',
    nom: "Convention d'essai d'une recrue",
    famille: "Vie sportive",
    prefixe: "ES",
    resume: "Une recrue à l'essai : durée, certificat médical, parents si mineure, pas d'engagement, l'issue.",

    sections: [
      { titre: "L'essai", ouvert: true, champs: [
        { cle: 'numero',    lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Fait le", type: 'date', duo: true },
        { cle: 'lieu',      lab: "Fait à", type: 'texte', duo: true },
        { cle: 'equipe',    lab: "Équipe", type: 'texte', duo: true },
        { cle: 'duree',     lab: "Durée", type: 'texte', duo: true },
        { cle: 'delaiDecision', lab: "Décision sous", type: 'texte', duo: true },
        { cle: 'du',        lab: "Du", type: 'date', duo: true },
        { cle: 'au',        lab: "Au", type: 'date', duo: true },
        { cle: 'fourni',    lab: "Le club prête", type: 'texte' },
        { cle: 'priseEnCharge', lab: "Prise en charge éventuelle", type: 'texte', aide: "« le transport les jours de match »" }
      ]},
      { titre: "La recrue", ouvert: true, champs: [
        { cle: 'genre',     lab: "Il s'agit de", type: 'choix', duo: true, choix: ['Joueuse', 'Joueur'] },
        { cle: 'mineure',   lab: "Mineure ?", type: 'choix', duo: true, choix: ['Non', 'Oui'] },
        { cle: 'nom',       lab: "Nom et prénom(s)", type: 'texte' },
        { cle: 'naissance', lab: "Date de naissance", type: 'date', duo: true },
        { cle: 'categorie', lab: "Catégorie", type: 'texte', duo: true },
        { cle: 'poste',     lab: "Poste", type: 'texte', duo: true },
        { cle: 'clubOrigine', lab: "Club d'origine", type: 'texte', duo: true },
        { cle: 'telephone', lab: "Téléphone", type: 'texte', duo: true },
        { cle: 'tuteur',    lab: "Parent ou tuteur (si mineure)", type: 'texte', duo: true },
        { cle: 'coach',     lab: "Coach référent", type: 'texte' }
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
        titre: "Convention d'essai", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar",
        equipe: "l'équipe Senior", duree: "quatre (4) semaines", delaiDecision: "sept (7) jours", du: "", au: "",
        fourni: "la tenue d'entraînement et le matériel", priseEnCharge: "",
        genre: "Joueuse", mineure: "Non", nom: "", naissance: "", categorie: "", poste: "", clubOrigine: "", telephone: "", tuteur: "", coach: "",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président",
        avecSignature: true, avecCachet: true, articles: null, tables: {}
      };
    },
    articlesParDefaut: articlesParDefaut,

    controles: function (d) {
      var c = [];
      if (!String(d.nom || '').trim()) c.push({ n: 'avert', t: 'Identité vide : à compléter au stylo, en pointillé' });
      if (!U.dateDe(d.du) || !U.dateDe(d.au)) c.push({ n: 'avert', t: 'Dates de l\'essai non renseignées' });
      if (mineure(d) && !String(d.tuteur || '').trim()) c.push({ n: 'erreur', t: 'Mineure : le parent ou tuteur manque' });
      return c;
    },

    page: [
      { b: 'entete', drapeau: false, devise: "Section Basketball · Recrutement · Dakar",
        droite: function (d) { return [d.numero ? "Essai n° " + d.numero : "Convention d'essai", v(d.duree, "")]; } },
      { b: 'parties', parties: function (d) {
          var champs = v(d.nom, "") ? [] : [{ label: fem(d) ? "Mme / Mlle" : "M.", valeur: "", large: true }];
          champs.push({ label: fem(d) ? "Née le" : "Né le", valeur: U.dateLongue(d.naissance, false) }, { label: "Catégorie", valeur: d.categorie },
                      { label: "Poste", valeur: d.poste }, { label: "Club d'origine", valeur: d.clubOrigine },
                      { label: "Téléphone", valeur: d.telephone });
          if (mineure(d)) champs.push({ label: "Parent ou tuteur", valeur: d.tuteur, large: true });
          return [{ label: "Le Club", nom: "Baobabs Basket Club", texte: "Représenté par son Président, Monsieur " + v(d.signNom, "Antoine Jean Pierre Ndong") + (v(d.coach, "") ? ". Coach référent : " + d.coach.trim() : "") + ".", tag: "Ci-après dénommé « le Club »" },
                  { label: LaR(d), nom: '@nom', champs: champs, tag: "Ci-après dénommé" + ee(d) + " « " + laR(d) + " »" }];
        } },
      { b: 'titre', etiquette: "Baobabs Basket Club · Recrutement", pastille: function (d) { return d.numero ? "N° " + d.numero : ""; },
        texte: '@titre', sous: "L'essai permet au Club et à la recrue de se choisir. Il n'engage ni l'un ni l'autre au-delà de sa durée." },
      { b: 'phrase', texte: "Il est convenu ce qui suit :" },
      { b: 'articles', articles: function (d) { return (d.articles && d.articles.length) ? d.articles : articlesParDefaut(d); } },
      { b: 'signatures',
        gauche: function (d) { return { lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "En deux exemplaires originaux.", reference: d.numero ? 'BBC / ES / ' + String(d.numero).replace('/', ' / ') : '' }; },
        cartes: function (d) {
          var cartes = [{ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite', mention: "Signature et cachet du Président" },
                        { pour: LaR(d), nom: v(d.nom, "Nom et prénom(s) :"), qualite: "", mention: "Lu et approuvé · Signature", signer: false, cacheter: false }];
          if (mineure(d)) cartes.push({ pour: "Le parent ou tuteur", nom: v(d.tuteur, "Nom :"), qualite: "", mention: "Lu et approuvé · Signature", signer: false, cacheter: false });
          return cartes;
        } }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280", "Convention d'essai" + (d.numero ? " n° " + d.numero : '') + (d.nom ? " · " + d.nom : '')]; },
    fichier: function (d) { return "Convention essai" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : '') + (d.nom ? " - " + d.nom : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
