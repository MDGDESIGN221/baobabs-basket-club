/* =====================================================================
   MODÈLE : FACTURE
   ---------------------------------------------------------------------
   Le club réclame de l'argent : un sponsoring, la location de la salle
   à un autre club, une prestation, une participation à un tournoi. Le
   reçu dit « j'ai reçu », la facture dit « vous me devez ». Qui est
   facturé, une ligne par prestation avec quantité et prix unitaire (le
   montant se calcule), le sous-total, une remise, la TVA si le club y
   est assujetti, un acompte déjà versé, et le net à payer ; l'échéance,
   le moyen de règlement et les coordonnées ; la signature du président.
   « il me faut des factures pour plusieurs usages » (20 septembre 2026).

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  function nb(v) {
    var n = parseFloat(String(v == null ? '' : v).replace(/[^\d.,-]/g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }
  /* Le sous-total : la colonne marquée « total » du tableau, calculée
     comme la feuille la calcule (quantité × prix, ou montant écrit). */
  function sousTotal(d) {
    var t = d && d.tables && d.tables.lignes; if (!t) return 0;
    var col = (t.colonnes || []).filter(function (c) { return c.total; })[0]; if (!col) return 0;
    return G.lignes(d, 'lignes').reduce(function (a, l) {
      var v = (G.blocs && G.blocs.valeurCellule) ? G.blocs.valeurCellule(t, l, col) : nb(l[col.cle]);
      return a + (isNaN(v) ? 0 : v);
    }, 0);
  }
  function recap(d) {
    var ht = sousTotal(d), rem = Math.min(nb(d.remise), ht), base = ht - rem;
    var taux = /18/.test(String(d.tva || '')) ? 0.18 : 0;
    var tva = Math.round(base * taux), ttc = base + tva, ac = Math.min(nb(d.acompte), ttc);
    return { ht: ht, rem: rem, base: base, taux: taux, tva: tva, ttc: ttc, ac: ac, net: ttc - ac };
  }
  function fcfa(n) { return U.nombre(n) + " FCFA"; }
  function dansTrenteJours() {
    var t = new Date(); t.setDate(t.getDate() + 30);
    return t.toISOString().slice(0, 10);
  }

  G.modeles['facture'] = {
    cle: 'facture',
    nom: "Facture",
    famille: "Finances",
    prefixe: "FA",
    resume: "Ce que le club réclame : lignes, sous-total, remise, TVA, acompte, net à payer, échéance.",

    sections: [
      { titre: "La facture", ouvert: true, champs: [
        { cle: 'numero',    lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Date", type: 'date', duo: true },
        { cle: 'echeance',  lab: "À régler avant le", type: 'date', duo: true },
        { cle: 'statut',    lab: "Statut", type: 'choix', duo: true, choix: ['À régler', 'Acquittée', 'Annulée'] },
        { cle: 'objet',     lab: "Objet", type: 'texte', aide: "« Sponsoring saison 2026-2027 », « Location de la salle, 12 octobre »…" },
        { cle: 'reference', lab: "Référence", type: 'texte', aide: "Convention, contrat ou bon de commande du client, s'il y en a un." }
      ]},
      { titre: "Facturé à", ouvert: true, champs: [
        { cle: 'clientNom',     lab: "Nom ou raison sociale", type: 'texte' },
        { cle: 'clientAdresse', lab: "Adresse", type: 'zone' },
        { cle: 'clientContact', lab: "Contact", type: 'texte', duo: true, aide: "Téléphone ou e-mail" },
        { cle: 'clientId',      lab: "NINEA ou identifiant", type: 'texte', duo: true }
      ]},
      { titre: "Les lignes", ouvert: true, special: 'table', source: 'lignes' },
      { titre: "Le règlement", ouvert: true, champs: [
        { cle: 'remise',      lab: "Remise (FCFA)", type: 'texte', duo: true },
        { cle: 'tva',         lab: "TVA", type: 'choix', duo: true, choix: ['Non assujetti', 'TVA 18 %'] },
        { cle: 'acompte',     lab: "Acompte déjà versé (FCFA)", type: 'texte', duo: true },
        { cle: 'moyen',       lab: "Règlement par", type: 'choix', duo: true, choix: ['Virement', 'Wave', 'Orange Money', 'Espèces', 'Chèque'] },
        { cle: 'coordonnees', lab: "Coordonnées de paiement", type: 'zone', aide: "RIB, numéro Wave ou Orange Money : ce que le client doit savoir pour payer." },
        { cle: 'conditions',  lab: "Conditions", type: 'zone' }
      ]},
      { titre: "Le signataire", ouvert: false, champs: [
        { cle: 'signNom',       lab: "Nom", type: 'texte', duo: true },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte', duo: true },
        { cle: 'avecSignature', lab: "Apposer la signature", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule' }
      ]}
    ],

    defauts: function () {
      return {
        titre: "Facture", numero: "", dateActe: U.isoDuJour(), echeance: dansTrenteJours(), lieu: "Dakar",
        statut: "À régler", objet: "", reference: "",
        clientNom: "", clientAdresse: "", clientContact: "", clientId: "",
        remise: "", tva: "Non assujetti", acompte: "", moyen: "Virement", coordonnees: "",
        conditions: "Payable à réception, au plus tard à la date d'échéance. Toute réclamation se fait par écrit dans les huit jours.",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président",
        avecSignature: true, avecCachet: true,
        tables: {
          lignes: {
            titre: "Détail", singulier: "ligne", vide: 6, unite: "FCFA",
            colonnes: [
              { cle: 'designation', titre: "Désignation", poids: 46, forme: 'fort' },
              { cle: 'quantite',    titre: "Qté", poids: 10, forme: 'nombre', align: 'centre' },
              { cle: 'prix',        titre: "Prix unitaire (FCFA)", poids: 22, forme: 'nombre', align: 'droite' },
              { cle: 'montant',     titre: "Montant (FCFA)", poids: 22, forme: 'nombre', align: 'droite', total: true, formule: 'quantite * prix' }
            ],
            lignes: []
          }
        }
      };
    },

    controles: function (d) {
      var c = [];
      if (!String(d.clientNom || '').trim()) c.push({ n: 'erreur', t: 'À qui est-elle adressée ?' });
      var n = G.lignes(d, 'lignes').length;
      if (!n) c.push({ n: 'erreur', t: 'Aucune ligne' }); else c.push({ n: 'ok', t: n + ' ligne' + (n > 1 ? 's' : '') + ' · net à payer ' + fcfa(recap(d).net) });
      if (!String(d.objet || '').trim()) c.push({ n: 'avert', t: 'Pas d\'objet' });
      if (d.echeance && d.dateActe && d.echeance < d.dateActe) c.push({ n: 'avert', t: 'L\'échéance précède la date' });
      if (!String(d.coordonnees || '').trim()) c.push({ n: 'avert', t: 'Comment payer ? Les coordonnées manquent' });
      return c;
    },

    page: [
      { b: 'entete', droite: function (d) { return [(d.lieu || '') + ", le " + U.dateLongue(d.dateActe, false), d.numero ? "Facture n° " + d.numero : ""]; } },
      { b: 'titre', etiquette: "Finances", pastille: function (d) { return d.statut && d.statut !== 'À régler' ? d.statut : ''; }, texte: "Facture", sous: '@objet' },
      { b: 'parties', parties: function (d) {
          return [{ label: "Facturé à", nom: '@clientNom',
                    texte: [d.clientAdresse || '', d.clientContact || '', d.clientId ? "NINEA / identifiant : " + d.clientId : ''].filter(Boolean).join("\n\n"), tag: '' },
                  { label: "Émise par", nom: "Baobabs Basket Club",
                    texte: [d.reference ? "Référence : **" + d.reference + "**" : '', d.echeance ? "À régler avant le **" + U.dateLongue(d.echeance, false) + "**" : ''].filter(Boolean).join("\n\n"), tag: '' }];
        } },
      { b: 'tableau', source: 'lignes', vide: 6 },
      { b: 'chips', chips: function (d) {
          var r = recap(d), l = [{ label: "Sous-total", valeur: fcfa(r.ht) }];
          if (r.rem) l.push({ label: "Remise", valeur: "- " + fcfa(r.rem) });
          if (r.taux) l.push({ label: "TVA 18 %", valeur: fcfa(r.tva) });
          if (r.ac) l.push({ label: "Acompte versé", valeur: "- " + fcfa(r.ac) });
          l.push({ label: r.taux ? "Net à payer TTC" : "Net à payer", valeur: fcfa(r.net) });
          return l;
        } },
      { b: 'encadre', etiquette: "Règlement", titre: function (d) { return d.statut === 'Acquittée' ? "Facture acquittée" : (d.statut === 'Annulée' ? "Facture annulée" : "Règlement par " + (d.moyen || 'virement')); },
        avant: function (d) {
          var t = [];
          if (d.statut !== 'Acquittée' && d.statut !== 'Annulée') {
            if (d.coordonnees) t.push(d.coordonnees);
            if (d.echeance) t.push("Échéance : **" + U.dateLongue(d.echeance, false) + "**.");
          }
          if (!/18/.test(String(d.tva || ''))) t.push("Association sportive non assujettie à la TVA.");
          if (d.conditions) t.push(d.conditions);
          return t.join("\n\n");
        } },
      { b: 'signatures', gauche: function (d) { return { lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "", reference: d.numero ? "BBC / FA / " + String(d.numero).replace('/', ' / ') : '' }; },
        cartes: [{ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite', mention: "Signature et cachet" }] }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280", "Facture" + (d.numero ? " n° " + d.numero : '') + (d.clientNom ? " · " + d.clientNom : '')]; },
    fichier: function (d) { return "Facture" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : '') + (d.clientNom ? " - " + d.clientNom : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
