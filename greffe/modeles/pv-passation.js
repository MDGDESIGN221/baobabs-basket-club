/* =====================================================================
   MODÈLE : PROCÈS-VERBAL DE PASSATION
   ---------------------------------------------------------------------
   Le document du relais. Celui qui part et celui qui arrive, la
   fonction, la date ; l'inventaire de ce qui est remis (registre,
   cachet, clés, matériel, comptes, accès numériques), la caisse arrêtée
   au jour J, les réserves de l'un ou de l'autre, et trois signatures :
   le sortant, l'entrant, un témoin. Sans lui, le relais se fait de
   mémoire et personne ne sait plus, six mois après, qui avait quoi.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  function v(x, repli) { return String(x || '').trim() || repli; }

  G.modeles['pv-passation'] = {
    cle: 'pv-passation',
    nom: "Procès-verbal de passation",
    famille: "Gouvernance",
    prefixe: "PP",
    resume: "Le relais d'une fonction : le sortant, l'entrant, l'inventaire remis, la caisse arrêtée, trois signatures.",

    sections: [
      { titre: "La passation", ouvert: true, champs: [
        { cle: 'numero',    lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Date", type: 'date', duo: true },
        { cle: 'lieu',      lab: "Lieu", type: 'texte', duo: true },
        { cle: 'fonction',  lab: "Fonction transmise", type: 'texte', duo: true, aide: "« Présidence », « Trésorerie », « Secrétariat général »" },
        { cle: 'motif',     lab: "Motif", type: 'choix', choix: ['Fin de mandat', 'Démission', 'Élection d\'un nouveau bureau', 'Réorganisation', 'Autre'] },
        { cle: 'temoin',    lab: "Témoin", type: 'texte', duo: true, aide: "Le président de l'ASC, un membre du bureau…" },
        { cle: 'temoinQualite', lab: "Qualité du témoin", type: 'texte', duo: true }
      ]},
      { titre: "Le sortant et l'entrant", ouvert: true, champs: [
        { cle: 'sortant',        lab: "Sortant", type: 'texte', duo: true },
        { cle: 'sortantDepuis',  lab: "En fonction depuis", type: 'texte', duo: true },
        { cle: 'entrant',        lab: "Entrant", type: 'texte', duo: true },
        { cle: 'entrantDesigne', lab: "Désigné par", type: 'texte', duo: true, aide: "« l'assemblée générale du 14 septembre 2026 »" }
      ]},
      { titre: "L'inventaire remis", ouvert: true, special: 'table', source: 'inventaire' },
      { titre: "La caisse", ouvert: true, champs: [
        { cle: 'dateArrete',   lab: "Arrêtée au", type: 'date', duo: true },
        { cle: 'soldeCaisse',  lab: "Solde en caisse (FCFA)", type: 'texte', duo: true },
        { cle: 'soldeBanque',  lab: "Solde en banque (FCFA)", type: 'texte', duo: true },
        { cle: 'soldeMobile',  lab: "Solde Wave / Orange Money (FCFA)", type: 'texte', duo: true },
        { cle: 'creances',     lab: "À encaisser", type: 'texte', aide: "« 3 cotisations de septembre, 45 000 FCFA »" },
        { cle: 'dettes',       lab: "À payer", type: 'texte', aide: "« facture du transporteur, 80 000 FCFA »" },
        { cle: 'acces',        lab: "Accès numériques remis", type: 'zone', aide: "Les comptes (admin du site, banque en ligne, réseaux). JAMAIS les mots de passe : ils se transmettent de vive voix et se changent le jour même." },
        { cle: 'reserves',     lab: "Réserves et observations", type: 'zone' }
      ]},
      { titre: "Les signataires", ouvert: false, champs: [
        { cle: 'avecSignature', lab: "Apposer la signature du président", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule' },
        { cle: 'presidentSigne', lab: "Le président signe en tant que", type: 'choix', choix: ['Sortant', 'Entrant', 'Témoin', 'Aucun des trois'] },
        { cle: 'signNom',       lab: "Président", type: 'texte', duo: true },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte', duo: true }
      ]}
    ],

    defauts: function () {
      return {
        titre: "Procès-verbal de passation", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar",
        fonction: "Présidence", motif: "Fin de mandat", temoin: "", temoinQualite: "",
        sortant: "", sortantDepuis: "", entrant: "", entrantDesigne: "",
        dateArrete: U.isoDuJour(), soldeCaisse: "", soldeBanque: "", soldeMobile: "", creances: "", dettes: "",
        acces: "- Administration du site (compte à créer pour l'entrant, celui du sortant retiré)\n- Boîte e-mail du club\n- Banque en ligne\n- Pages et comptes du club sur les réseaux",
        reserves: "",
        avecSignature: true, avecCachet: true, presidentSigne: "Sortant",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président",
        styles: { b1: { theme: 'vert' } },
        tables: {
          inventaire: {
            titre: "L'inventaire remis", singulier: "élément", vide: 10,
            colonnes: [
              { cle: 'element',   titre: "Élément", poids: 40, forme: 'fort' },
              { cle: 'detail',    titre: "Détail / état", poids: 30, forme: 'texte' },
              { cle: 'quantite',  titre: "Qté", poids: 10, forme: 'nombre', align: 'centre' },
              { cle: 'remis',     titre: "Remis", poids: 14, forme: 'pastille', align: 'centre', choix: ['Oui', 'Non', 'Partiel'] },
              { cle: 'observation', titre: "Observation", poids: 26, forme: 'texte' }
            ],
            lignes: [
              { element: "Registre des actes et archives", detail: "", quantite: "", remis: "", observation: "" },
              { element: "Cachet du club", detail: "", quantite: "1", remis: "", observation: "" },
              { element: "Statuts, règlement intérieur, récépissé", detail: "originaux", quantite: "", remis: "", observation: "" },
              { element: "Clés (local, armoire)", detail: "", quantite: "", remis: "", observation: "" },
              { element: "Matériel sportif (ballons, chasubles, tenues)", detail: "", quantite: "", remis: "", observation: "" },
              { element: "Chéquier, carte bancaire", detail: "", quantite: "", remis: "", observation: "" },
              { element: "Pièces comptables de la saison", detail: "", quantite: "", remis: "", observation: "" },
              { element: "Licences et dossiers des joueuses", detail: "", quantite: "", remis: "", observation: "" }
            ]
          }
        }
      };
    },

    controles: function (d) {
      var c = [];
      if (!String(d.sortant || '').trim() || !String(d.entrant || '').trim()) c.push({ n: 'erreur', t: 'Qui remet, à qui ?' });
      var n = G.lignes(d, 'inventaire').length;
      if (!n) c.push({ n: 'avert', t: 'Inventaire vide' }); else c.push({ n: 'ok', t: n + ' élément' + (n > 1 ? 's' : '') + ' à l\'inventaire' });
      var manque = G.lignes(d, 'inventaire').filter(function (l) { return !String(l.remis || '').trim(); }).length;
      if (manque) c.push({ n: 'avert', t: manque + ' ligne' + (manque > 1 ? 's' : '') + ' sans « Remis » renseigné' });
      if (!String(d.soldeCaisse || '').trim() && !String(d.soldeBanque || '').trim()) c.push({ n: 'avert', t: 'Aucun solde de caisse' });
      if (/mot de passe|mdp|password/i.test(String(d.acces || ''))) c.push({ n: 'erreur', t: 'Un mot de passe semble écrit dans les accès : retirez-le' });
      return c;
    },

    page: [
      { b: 'entete', droite: function (d) { return [(d.lieu || '') + ", le " + U.dateLongue(d.dateActe, false), d.numero ? "PV n° " + d.numero : ""]; } },
      { b: 'titre', etiquette: "Gouvernance", pastille: '@motif', texte: function (d) { return "Passation · " + v(d.fonction, ""); },
        sous: function (d) { return "Établi le " + U.dateLongue(d.dateActe, true) + (d.lieu ? " à " + d.lieu : "") + (v(d.temoin, "") ? ", en présence de " + d.temoin.trim() + (v(d.temoinQualite, "") ? " (" + d.temoinQualite.trim() + ")" : "") : "") + "."; } },
      { b: 'parties', parties: function (d) {
          return [{ label: "Le sortant", nom: '@sortant', texte: v(d.sortantDepuis, "") ? "En fonction depuis " + d.sortantDepuis.trim() + "." : "", tag: v(d.fonction, "") },
                  { label: "L'entrant", nom: '@entrant', texte: v(d.entrantDesigne, "") ? "Désigné par " + d.entrantDesigne.trim() + "." : "", tag: v(d.fonction, "") }];
        } },
      { b: 'phrase', texte: function (d) { return "Le sortant remet à l'entrant, qui reconnaît les avoir reçus, les éléments suivants :"; } },
      { b: 'tableau', source: 'inventaire', vide: 10 },
      { b: 'chips', chips: function (d) {
          var l = [{ label: "Caisse arrêtée au", valeur: U.dateLongue(d.dateArrete, false) }];
          if (v(d.soldeCaisse, "")) l.push({ label: "En caisse", valeur: U.nombre(d.soldeCaisse) + " FCFA" });
          if (v(d.soldeBanque, "")) l.push({ label: "En banque", valeur: U.nombre(d.soldeBanque) + " FCFA" });
          if (v(d.soldeMobile, "")) l.push({ label: "Wave / Orange Money", valeur: U.nombre(d.soldeMobile) + " FCFA" });
          return l;
        } },
      { b: 'texte', si: function (d) { return !!(v(d.creances, "") || v(d.dettes, "")); }, etiquette: "Ce qui reste à encaisser et à payer",
        texte: function (d) { return [v(d.creances, "") ? "**À encaisser :** " + d.creances.trim() : "", v(d.dettes, "") ? "**À payer :** " + d.dettes.trim() : ""].filter(Boolean).join("\n\n"); } },
      { b: 'texte', etiquette: "Accès numériques", texte: function (d) { return v(d.acces, "") + "\n\nLes mots de passe ne figurent pas sur ce procès-verbal : ils sont transmis de vive voix et changés par l'entrant le jour même."; } },
      { b: 'encadre', si: function (d) { return !!v(d.reserves, ""); }, etiquette: "Réserves et observations", titre: "", avant: '@reserves' },
      { b: 'texte', texte: "Les signataires reconnaissent que la présente passation a été faite contradictoirement. Le présent procès-verbal est établi en trois exemplaires, un pour chaque signataire, et versé au registre du Club." },
      { b: 'signatures',
        gauche: function (d) { return { lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "En trois exemplaires originaux.", reference: d.numero ? 'BBC / PP / ' + String(d.numero).replace('/', ' / ') : '' }; },
        cartes: function (d) {
          function carte(pour, nom, qualite, role) {
            var moi = String(d.presidentSigne || '') === role;
            return { pour: pour, nom: moi ? '@signNom' : (nom || "Nom :"), qualite: moi ? '@signQualite' : (qualite || ""), mention: moi ? "Signature et cachet" : "Signature", signer: moi, cacheter: moi };
          }
          return [carte("Le sortant", v(d.sortant, ""), v(d.fonction, ""), 'Sortant'),
                  carte("L'entrant", v(d.entrant, ""), v(d.fonction, ""), 'Entrant'),
                  carte("Le témoin", v(d.temoin, ""), v(d.temoinQualite, ""), 'Témoin')];
        } }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280", "Passation" + (d.numero ? " n° " + d.numero : '') + (d.fonction ? " · " + d.fonction : '')]; },
    fichier: function (d) { return "PV passation" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : '') + (d.fonction ? " - " + d.fonction : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
