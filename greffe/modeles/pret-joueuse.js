/* =====================================================================
   MODÈLE : CONVENTION DE PRÊT D'UNE JOUEUSE
   ---------------------------------------------------------------------
   Deux clubs et une joueuse : l'un la prête, l'autre l'accueille pour
   une période. Baobabs peut être d'un côté comme de l'autre, et le sens
   décide des textes. Qui paie quoi, l'assurance, le retour, ce qui
   arrive si elle se blesse, le respect des règlements de la fédération.
   Trois signatures : les deux clubs et la joueuse.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  function v(x, repli) { return String(x || '').trim() || repli; }
  function fem(d) { return !/joueur$/i.test(String(d.genre || 'Joueuse')); }
  function laJ(d) { return fem(d) ? "la Joueuse" : "le Joueur"; }
  function LaJ(d) { return fem(d) ? "La Joueuse" : "Le Joueur"; }
  function ee(d) { return fem(d) ? "e" : ""; }
  function bbcPrete(d) { return !/accueille/i.test(String(d.sens || '')); }
  function preteur(d) { return bbcPrete(d) ? "Baobabs Basket Club" : v(d.autreClub, "le club partenaire"); }
  function accueil(d) { return bbcPrete(d) ? v(d.autreClub, "le club partenaire") : "Baobabs Basket Club"; }

  function articlesParDefaut(d) {
    var J = laJ(d), Jm = LaJ(d), e = ee(d), duAu = U.duAu(d.du, d.au);
    var P = preteur(d), A = accueil(d);
    return [
      { titre: "Objet",
        texte: "**" + P + "** (le Club prêteur) met " + J + " à la disposition de **" + A + "** (le Club d'accueil) "
             + "pour la période et aux conditions ci-dessous. " + Jm + " reste licencié" + e + " au Club prêteur, sauf "
             + "disposition contraire des règlements de la Fédération Sénégalaise de Basketball." },
      { titre: "Durée",
        texte: "Le prêt court **" + v(d.duree, "jusqu'à la fin de la saison") + "**" + (duAu ? ", " + duAu : "") + ". "
             + "Il prend fin à son terme, sans reconduction tacite. Un retour anticipé est possible d'un commun accord écrit des deux clubs" + (v(d.retourAnticipe, "") ? ", " + d.retourAnticipe.trim() : "") + "." },
      { titre: "Conditions financières",
        texte: v(d.conditions, "Le Club d'accueil prend en charge les frais liés à l'activité de " + J + " pendant le prêt (transport, équipement, licence si nécessaire). Aucune indemnité de prêt n'est due entre les clubs.") },
      { titre: "Encadrement et assurance",
        texte: "Pendant le prêt, " + J + " est encadré" + e + " par le Club d'accueil, qui l'assure pour les activités qu'il organise "
             + "et veille à sa sécurité et à sa santé. Toute blessure est signalée sans délai au Club prêteur." },
      { titre: "Engagements de " + J,
        texte: Jm + " s'engage à respecter les règlements et le staff du Club d'accueil, à participer aux séances et matchs auxquels "
             + (fem(d) ? "elle" : "il") + " est convoqué" + e + ", et à informer les deux clubs de toute sollicitation d'un tiers." },
      { titre: "Retour",
        texte: "Au terme du prêt, " + J + " réintègre le Club prêteur. Le Club d'accueil lui remet un bilan sportif écrit"
             + (v(d.option, "") ? ".\n\n**Option :** " + d.option.trim() : ".") },
      { titre: "Dispositions finales",
        texte: "La convention respecte les règlements de la Fédération Sénégalaise de Basketball et de la FIBA. Toute modification est convenue par écrit entre les trois signataires. Fait en trois exemplaires originaux." }
    ];
  }

  G.modeles['pret-joueuse'] = {
    cle: 'pret-joueuse',
    nom: "Convention de prêt d'une joueuse",
    famille: "Conventions et contrats",
    prefixe: "PJ",
    resume: "Deux clubs et une joueuse : le sens du prêt, la durée, qui paie quoi, l'assurance, le retour.",

    sections: [
      { titre: "Le prêt", ouvert: true, champs: [
        { cle: 'numero',    lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Fait le", type: 'date', duo: true },
        { cle: 'lieu',      lab: "Fait à", type: 'texte', duo: true },
        { cle: 'sens',      lab: "Sens du prêt", type: 'choix', choix: ['Baobabs prête la joueuse', 'Baobabs accueille la joueuse'] },
        { cle: 'autreClub', lab: "L'autre club", type: 'texte', duo: true },
        { cle: 'autreRep',  lab: "Représenté par", type: 'texte', duo: true },
        { cle: 'duree',     lab: "Durée", type: 'texte', duo: true },
        { cle: 'du',        lab: "Du", type: 'date', duo: true },
        { cle: 'au',        lab: "Au", type: 'date', duo: true },
        { cle: 'retourAnticipe', lab: "Retour anticipé", type: 'texte', aide: "« avec un préavis de quinze jours »" },
        { cle: 'conditions', lab: "Conditions financières", type: 'zone' },
        { cle: 'option',    lab: "Option à l'issue du prêt", type: 'texte', aide: "« le Club d'accueil peut proposer un engagement définitif »" }
      ]},
      { titre: "La joueuse", ouvert: true, champs: [
        { cle: 'genre',     lab: "Il s'agit de", type: 'choix', duo: true, choix: ['Joueuse', 'Joueur'] },
        { cle: 'nom',       lab: "Nom et prénom(s)", type: 'texte' },
        { cle: 'naissance', lab: "Date de naissance", type: 'date', duo: true },
        { cle: 'licence',   lab: "N° de licence", type: 'texte', duo: true },
        { cle: 'poste',     lab: "Poste", type: 'texte', duo: true },
        { cle: 'telephone', lab: "Téléphone", type: 'texte', duo: true }
      ]},
      { titre: "Les articles", ouvert: false, special: 'articles' },
      { titre: "Les signataires", ouvert: false, champs: [
        { cle: 'signNom',       lab: "Pour Baobabs", type: 'texte', duo: true },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte', duo: true },
        { cle: 'avecSignature', lab: "Apposer la signature du président", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule' }
      ]}
    ],

    defauts: function () {
      return {
        titre: "Convention de prêt", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar",
        sens: "Baobabs prête la joueuse", autreClub: "", autreRep: "", duree: "jusqu'à la fin de la saison", du: "", au: "", retourAnticipe: "", conditions: "", option: "",
        genre: "Joueuse", nom: "", naissance: "", licence: "", poste: "", telephone: "",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président",
        avecSignature: true, avecCachet: true, articles: null, tables: {}
      };
    },
    articlesParDefaut: articlesParDefaut,

    controles: function (d) {
      var c = [];
      if (!String(d.autreClub || '').trim()) c.push({ n: 'erreur', t: 'Quel est l\'autre club ?' });
      if (!String(d.nom || '').trim()) c.push({ n: 'erreur', t: 'Quelle joueuse ?' });
      if (!U.dateDe(d.du) || !U.dateDe(d.au)) c.push({ n: 'avert', t: 'Dates du prêt non renseignées' });
      return c;
    },

    page: [
      { b: 'entete', drapeau: false, devise: "Section Basketball · Prêt · Dakar",
        droite: function (d) { return [d.numero ? "Convention n° " + d.numero : "Convention de prêt", v(d.duree, "")]; } },
      { b: 'parties', parties: function (d) {
          var bbc = { label: bbcPrete(d) ? "Le Club prêteur" : "Le Club d'accueil", nom: "Baobabs Basket Club", texte: "Représenté par son Président, Monsieur " + v(d.signNom, "Antoine Jean Pierre Ndong") + ".", tag: "" };
          var autre = { label: bbcPrete(d) ? "Le Club d'accueil" : "Le Club prêteur", nom: '@autreClub', texte: v(d.autreRep, "") ? "Représenté par " + d.autreRep.trim() + "." : "", tag: "" };
          return bbcPrete(d) ? [bbc, autre] : [autre, bbc];
        } },
      { b: 'reperes', cellules: function (d) {
          return [{ label: LaJ(d), valeur: v(d.nom, "") }, { label: fem(d) ? "Née le" : "Né le", valeur: U.dateLongue(d.naissance, false) },
                  { label: "Licence", valeur: v(d.licence, "") }, { label: "Poste", valeur: v(d.poste, "") }];
        } },
      { b: 'titre', etiquette: "Baobabs Basket Club · Prêt", pastille: function (d) { return d.numero ? "N° " + d.numero : ""; },
        texte: '@titre', sous: function (d) { return preteur(d) + " prête " + laJ(d) + " à " + accueil(d) + "."; } },
      { b: 'phrase', texte: "Il est convenu ce qui suit :" },
      { b: 'articles', articles: function (d) { return (d.articles && d.articles.length) ? d.articles : articlesParDefaut(d); } },
      { b: 'signatures',
        gauche: function (d) { return { lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "En trois exemplaires originaux.", reference: d.numero ? 'BBC / PJ / ' + String(d.numero).replace('/', ' / ') : '' }; },
        cartes: function (d) {
          return [{ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite', mention: "Signature et cachet du Président" },
                  { pour: "Pour " + v(d.autreClub, "l'autre club"), nom: v(d.autreRep, "Nom :"), qualite: "", mention: "Signature et cachet", signer: false, cacheter: false },
                  { pour: LaJ(d), nom: v(d.nom, "Nom et prénom(s) :"), qualite: "", mention: "Lu et approuvé · Signature", signer: false, cacheter: false }];
        } }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280", "Convention de prêt" + (d.numero ? " n° " + d.numero : '') + (d.nom ? " · " + d.nom : '')]; },
    fichier: function (d) { return "Convention pret" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : '') + (d.nom ? " - " + d.nom : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
