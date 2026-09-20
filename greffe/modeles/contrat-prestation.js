/* =====================================================================
   MODÈLE : CONTRAT DE PRESTATION
   ---------------------------------------------------------------------
   Le club achète un service : un kiné pour la saison, un photographe
   pour le tournoi, un transporteur pour les déplacements, un animateur
   de stage. Le prestataire (personne ou société), l'objet, le calendrier,
   le prix et comment il se paie, les livrables, les droits sur les
   images, la résiliation. Neuf articles pré-écrits, deux signatures.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  function v(x, repli) { return String(x || '').trim() || repli; }

  function articlesParDefaut(d) {
    var duAu = U.duAu(d.du, d.au);
    return [
      { titre: "Objet",
        texte: "Le Prestataire s'engage à réaliser pour Baobabs Basket Club la prestation suivante : **"
             + v(d.objet, "à préciser") + "**." + (v(d.detail, "") ? "\n\n" + d.detail.trim() : "") },
      { titre: "Durée et calendrier",
        texte: "La prestation est réalisée " + (duAu ? duAu : "aux dates convenues entre les parties") + "."
             + (v(d.lieuPrestation, "") ? " Lieu : " + d.lieuPrestation.trim() + "." : "")
             + "\n\nTout report est convenu par écrit, au moins " + v(d.delaiReport, "48 heures") + " à l'avance." },
      { titre: "Livrables",
        texte: v(d.livrables, "Ce que le Prestataire remet au Club, quand, et sous quelle forme.") },
      { titre: "Prix et paiement",
        texte: "Le prix de la prestation est fixé à **" + v(d.prix, "à convenir") + "**"
             + (v(d.tva, "") && /18/.test(d.tva) ? " hors taxes, TVA 18 % en sus" : ", toutes taxes comprises") + ".\n\n"
             + "Modalités : " + v(d.modalites, "un acompte de 30 % à la signature, le solde à la remise des livrables, sur facture, par virement ou par Wave") + ".\n\n"
             + "Le Prestataire remet une facture pour chaque versement." },
      { titre: "Obligations du Prestataire",
        texte: "Le Prestataire exécute la prestation avec soin, avec son propre matériel et sous sa responsabilité. "
             + "Il respecte les règlements du Club, la sécurité des joueuses, mineures comprises, et la "
             + "confidentialité de ce qu'il apprend au Club. Il déclare être en règle avec ses obligations "
             + "fiscales et sociales." },
      { titre: "Obligations du Club",
        texte: "Le Club donne accès aux lieux, aux personnes et aux informations nécessaires, désigne un "
             + "interlocuteur (" + v(d.interlocuteur, "le Président") + ") et paie le prix aux échéances convenues." },
      { titre: "Images et propriété",
        texte: v(d.droits, "Les images, textes et documents produits pour le Club dans le cadre de la prestation lui sont cédés, pour toute utilisation liée à sa communication, sans limite de durée. Le Prestataire peut les citer dans ses références, sans en faire commerce.") },
      { titre: "Assurance et responsabilité",
        texte: "Chaque partie répond des dommages qu'elle cause. Le Prestataire est assuré pour son activité "
             + "et en justifie à la demande du Club." },
      { titre: "Résiliation et litiges",
        texte: "Le contrat peut être résilié d'un commun accord écrit, ou par l'une des parties en cas de "
             + "manquement grave de l'autre, après mise en demeure restée sans effet pendant huit (8) jours. "
             + "Les prestations déjà réalisées restent dues.\n\n"
             + "Les parties cherchent d'abord un accord amiable. À défaut, le droit sénégalais s'applique et "
             + "les tribunaux de Dakar sont compétents." }
    ];
  }

  G.modeles['contrat-prestation'] = {
    cle: 'contrat-prestation',
    nom: "Contrat de prestation",
    famille: "Conventions et contrats",
    prefixe: "CP",
    resume: "Kiné, photographe, transporteur, animateur : objet, calendrier, prix et paiement, livrables, images.",

    sections: [
      { titre: "Le contrat", ouvert: true, champs: [
        { cle: 'numero',    lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Fait le", type: 'date', duo: true },
        { cle: 'lieu',      lab: "Fait à", type: 'texte', duo: true },
        { cle: 'exemplaires', lab: "Exemplaires originaux", type: 'choix', duo: true, choix: ['deux', 'trois'] },
        { cle: 'objet',     lab: "Objet", type: 'texte', aide: "« Suivi kinésithérapique de l'équipe Senior, saison 2026-2027 »" },
        { cle: 'detail',    lab: "Détail", type: 'zone' },
        { cle: 'du',        lab: "Du", type: 'date', duo: true },
        { cle: 'au',        lab: "Au", type: 'date', duo: true },
        { cle: 'lieuPrestation', lab: "Lieu de la prestation", type: 'texte', duo: true },
        { cle: 'delaiReport', lab: "Délai de report", type: 'texte', duo: true }
      ]},
      { titre: "Le prestataire", ouvert: true, champs: [
        { cle: 'prestataire',  lab: "Nom ou raison sociale", type: 'texte' },
        { cle: 'representant', lab: "Représenté par", type: 'texte', duo: true },
        { cle: 'qualiteRep',   lab: "En qualité de", type: 'texte', duo: true },
        { cle: 'adresse',      lab: "Adresse", type: 'texte' },
        { cle: 'identifiant',  lab: "NINEA / RC", type: 'texte', duo: true },
        { cle: 'telephone',    lab: "Téléphone", type: 'texte', duo: true },
        { cle: 'interlocuteur', lab: "Interlocuteur au club", type: 'texte' }
      ]},
      { titre: "Le prix et les livrables", ouvert: true, champs: [
        { cle: 'prix',      lab: "Prix", type: 'texte', duo: true, aide: "« 450 000 FCFA »" },
        { cle: 'tva',       lab: "TVA", type: 'choix', duo: true, choix: ['Toutes taxes comprises', 'Hors taxes, TVA 18 % en sus'] },
        { cle: 'modalites', lab: "Modalités de paiement", type: 'texte' },
        { cle: 'livrables', lab: "Livrables", type: 'zone', aide: "Ce qui est remis, quand, sous quelle forme." },
        { cle: 'droits',    lab: "Images et propriété", type: 'zone' }
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
        titre: "Contrat de prestation", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar", exemplaires: "deux",
        objet: "", detail: "", du: "", au: "", lieuPrestation: "", delaiReport: "48 heures",
        prestataire: "", representant: "", qualiteRep: "", adresse: "", identifiant: "", telephone: "", interlocuteur: "le Président",
        prix: "", tva: "Toutes taxes comprises",
        modalites: "un acompte de 30 % à la signature, le solde à la remise des livrables, sur facture, par virement ou par Wave",
        livrables: "", droits: "",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président",
        avecSignature: true, avecCachet: true, articles: null, tables: {}
      };
    },
    articlesParDefaut: articlesParDefaut,

    controles: function (d) {
      var c = [];
      if (!String(d.prestataire || '').trim()) c.push({ n: 'erreur', t: 'Qui est le prestataire ?' });
      if (!String(d.objet || '').trim()) c.push({ n: 'erreur', t: 'Pas d\'objet' });
      if (!String(d.prix || '').trim()) c.push({ n: 'erreur', t: 'Pas de prix' });
      if (!String(d.livrables || '').trim()) c.push({ n: 'avert', t: 'Livrables non décrits' });
      return c;
    },

    page: [
      { b: 'entete', drapeau: false, devise: "Section Basketball · Prestation · Dakar",
        droite: function (d) { return [d.numero ? "Contrat n° " + d.numero : "Contrat de prestation", v(d.prix, "")]; } },
      { b: 'parties', parties: function (d) {
          return [{ label: "Le Club", nom: "Baobabs Basket Club", texte: "Représenté par son Président, Monsieur " + v(d.signNom, "Antoine Jean Pierre Ndong") + ".", tag: "Ci-après dénommé « le Club »" },
                  { label: "Le Prestataire", nom: '@prestataire',
                    champs: [{ label: "Représenté par", valeur: d.representant, large: true }, { label: "Qualité", valeur: d.qualiteRep }, { label: "NINEA / RC", valeur: d.identifiant },
                             { label: "Adresse", valeur: d.adresse, large: true }, { label: "Téléphone", valeur: d.telephone }],
                    tag: "Ci-après dénommé « le Prestataire »" }];
        } },
      { b: 'titre', etiquette: "Baobabs Basket Club · Prestation", pastille: function (d) { return d.numero ? "N° " + d.numero : ""; },
        texte: '@titre', sous: '@objet' },
      { b: 'phrase', texte: "Il est convenu ce qui suit :" },
      { b: 'articles', articles: function (d) { return (d.articles && d.articles.length) ? d.articles : articlesParDefaut(d); } },
      { b: 'signatures',
        gauche: function (d) { return { lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "En " + U.ech(v(d.exemplaires, "deux")) + " exemplaires originaux. Chaque page est paraphée par les deux parties.", reference: d.numero ? 'BBC / CP / ' + String(d.numero).replace('/', ' / ') : '' }; },
        cartes: function (d) {
          return [{ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite', mention: "Signature et cachet du Président" },
                  { pour: "Pour le Prestataire", nom: v(d.representant, v(d.prestataire, "Nom :")), qualite: v(d.qualiteRep, ""), mention: "Lu et approuvé · Signature et cachet", signer: false, cacheter: false }];
        } }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280", "Contrat de prestation" + (d.numero ? " n° " + d.numero : '') + (d.prestataire ? " · " + d.prestataire : '')]; },
    fichier: function (d) { return "Contrat prestation" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : '') + (d.prestataire ? " - " + d.prestataire : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
