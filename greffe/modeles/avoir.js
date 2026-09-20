/* =====================================================================
   MODÈLE : AVOIR
   ---------------------------------------------------------------------
   Une facture émise ne se corrige pas : elle est au registre avec son
   numéro. Quand elle est fausse, annulée ou trop élevée, le club émet
   un avoir, qui la référence et dit le montant rendu au client, à
   déduire de sa prochaine facture ou à rembourser. Lignes en positif,
   le document dit lui-même qu'il s'agit d'une somme due AU client.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  function nb(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[^\d.,-]/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; }
  function total(d) {
    var t = d && d.tables && d.tables.lignes; if (!t) return 0;
    var col = (t.colonnes || []).filter(function (c) { return c.total; })[0]; if (!col) return 0;
    return G.lignes(d, 'lignes').reduce(function (a, l) {
      var x = (G.blocs && G.blocs.valeurCellule) ? G.blocs.valeurCellule(t, l, col) : nb(l[col.cle]);
      return a + (isNaN(x) ? 0 : x);
    }, 0);
  }
  function recap(d) {
    var ht = total(d), taux = /18/.test(String(d.tva || '')) ? 0.18 : 0, tva = Math.round(ht * taux);
    return { ht: ht, taux: taux, tva: tva, ttc: ht + tva };
  }
  function fcfa(n) { return U.nombre(n) + " FCFA"; }

  G.modeles['avoir'] = {
    cle: 'avoir',
    nom: "Avoir",
    famille: "Finances",
    prefixe: "AV",
    resume: "Une facture annulée ou réduite : la référence, le motif, la somme rendue, déduite ou remboursée.",

    sections: [
      { titre: "L'avoir", ouvert: true, champs: [
        { cle: 'numero',    lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Date", type: 'date', duo: true },
        { cle: 'factureNumero', lab: "Facture d'origine n°", type: 'texte', duo: true },
        { cle: 'factureDate',   lab: "Du", type: 'date', duo: true },
        { cle: 'motif',     lab: "Motif", type: 'choix', choix: ['Annulation de la facture', 'Erreur de facturation', 'Prestation non réalisée', 'Remise commerciale', 'Retour de marchandise', 'Autre'] },
        { cle: 'detail',    lab: "Précision", type: 'zone' },
        { cle: 'sort',      lab: "La somme est", type: 'choix', choix: ['à déduire de la prochaine facture', 'remboursée au client'] },
        { cle: 'moyen',     lab: "Remboursée par", type: 'choix', duo: true, choix: ['', 'Virement', 'Wave', 'Orange Money', 'Espèces', 'Chèque'] },
        { cle: 'tva',       lab: "TVA", type: 'choix', duo: true, choix: ['Non assujetti', 'TVA 18 %'] }
      ]},
      { titre: "Au bénéfice de", ouvert: true, champs: [
        { cle: 'clientNom',     lab: "Nom ou raison sociale", type: 'texte' },
        { cle: 'clientAdresse', lab: "Adresse", type: 'zone' },
        { cle: 'clientContact', lab: "Contact", type: 'texte', duo: true },
        { cle: 'clientId',      lab: "NINEA ou identifiant", type: 'texte', duo: true }
      ]},
      { titre: "Les lignes", ouvert: true, special: 'table', source: 'lignes' },
      { titre: "Le signataire", ouvert: false, champs: [
        { cle: 'signNom',       lab: "Nom", type: 'texte', duo: true },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte', duo: true },
        { cle: 'avecSignature', lab: "Apposer la signature", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule' }
      ]}
    ],

    defauts: function () {
      return {
        titre: "Avoir", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar", factureNumero: "", factureDate: "",
        motif: "Erreur de facturation", detail: "", sort: "à déduire de la prochaine facture", moyen: "", tva: "Non assujetti",
        clientNom: "", clientAdresse: "", clientContact: "", clientId: "",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président",
        avecSignature: true, avecCachet: true,
        tables: {
          lignes: {
            titre: "Détail", singulier: "ligne", vide: 4, unite: "FCFA",
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
      if (!String(d.clientNom || '').trim()) c.push({ n: 'erreur', t: 'Au bénéfice de qui ?' });
      if (!String(d.factureNumero || '').trim()) c.push({ n: 'erreur', t: 'Quelle facture d\'origine ?' });
      var n = G.lignes(d, 'lignes').length;
      if (!n) c.push({ n: 'erreur', t: 'Aucune ligne' }); else c.push({ n: 'ok', t: 'Avoir de ' + fcfa(recap(d).ttc) });
      if (/rembours/.test(String(d.sort || '')) && !String(d.moyen || '').trim()) c.push({ n: 'avert', t: 'Remboursée par quel moyen ?' });
      return c;
    },

    page: [
      { b: 'entete', droite: function (d) { return [(d.lieu || '') + ", le " + U.dateLongue(d.dateActe, false), d.numero ? "Avoir n° " + d.numero : ""]; } },
      { b: 'titre', etiquette: "Finances", pastille: '@motif', texte: "Avoir",
        sous: function (d) { return "Sur la facture n° " + (d.factureNumero || '…') + (U.dateDe(d.factureDate) ? " du " + U.dateLongue(d.factureDate, false) : ''); } },
      { b: 'parties', parties: function (d) {
          return [{ label: "Au bénéfice de", nom: '@clientNom', texte: [d.clientAdresse || '', d.clientContact || '', d.clientId ? "NINEA / identifiant : " + d.clientId : ''].filter(Boolean).join("\n\n"), tag: '' },
                  { label: "Émis par", nom: "Baobabs Basket Club", texte: [d.motif ? "Motif : **" + d.motif + "**" : '', d.detail || ''].filter(Boolean).join("\n\n"), tag: '' }];
        } },
      { b: 'tableau', source: 'lignes', vide: 4 },
      { b: 'chips', chips: function (d) {
          var r = recap(d), l = [];
          if (r.taux) { l.push({ label: "Montant HT", valeur: fcfa(r.ht) }); l.push({ label: "TVA 18 %", valeur: fcfa(r.tva) }); }
          l.push({ label: r.taux ? "Avoir TTC" : "Montant de l'avoir", valeur: fcfa(r.ttc) });
          return l;
        } },
      { b: 'texte', texte: function (d) {
          var r = recap(d);
          return "Baobabs Basket Club reconnaît devoir à **" + (String(d.clientNom || '').trim() || '……………………………') + "** la somme de **" + fcfa(r.ttc) + "**, "
               + (/rembours/.test(String(d.sort || '')) ? "remboursée" + (d.moyen ? " par " + d.moyen : "") + "." : "à déduire de sa prochaine facture.")
               + (/18/.test(String(d.tva || '')) ? "" : " Association sportive non assujettie à la TVA.");
        } },
      { b: 'signatures', gauche: function (d) { return { lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "", reference: d.numero ? "BBC / AV / " + String(d.numero).replace('/', ' / ') : '' }; },
        cartes: [{ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite', mention: "Signature et cachet" }] }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280", "Avoir" + (d.numero ? " n° " + d.numero : '') + (d.clientNom ? " · " + d.clientNom : '')]; },
    fichier: function (d) { return "Avoir" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : '') + (d.clientNom ? " - " + d.clientNom : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
