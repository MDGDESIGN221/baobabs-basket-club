/* =====================================================================
   MODÈLE : DEVIS
   ---------------------------------------------------------------------
   Avant la facture, le devis : ce que le club propose, à quel prix,
   valable jusqu'à quand. Même structure que la facture (lignes,
   quantité × prix, sous-total, remise, TVA), mais rien n'est dû tant
   que le client n'a pas signé « Bon pour accord ». Le devis accepté
   devient la facture : on rouvre, on copie les lignes.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  function nb(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[^\d.,-]/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; }
  function sousTotal(d) {
    var t = d && d.tables && d.tables.lignes; if (!t) return 0;
    var col = (t.colonnes || []).filter(function (c) { return c.total; })[0]; if (!col) return 0;
    return G.lignes(d, 'lignes').reduce(function (a, l) {
      var x = (G.blocs && G.blocs.valeurCellule) ? G.blocs.valeurCellule(t, l, col) : nb(l[col.cle]);
      return a + (isNaN(x) ? 0 : x);
    }, 0);
  }
  function recap(d) {
    var ht = sousTotal(d), rem = Math.min(nb(d.remise), ht), base = ht - rem;
    var taux = /18/.test(String(d.tva || '')) ? 0.18 : 0;
    var tva = Math.round(base * taux);
    return { ht: ht, rem: rem, base: base, taux: taux, tva: tva, ttc: base + tva };
  }
  function fcfa(n) { return U.nombre(n) + " FCFA"; }
  function dansTrenteJours() { var t = new Date(); t.setDate(t.getDate() + 30); return t.toISOString().slice(0, 10); }

  G.modeles['devis'] = {
    cle: 'devis',
    nom: "Devis",
    famille: "Finances",
    prefixe: "DV",
    resume: "Ce que le club propose, à quel prix, valable jusqu'à quand ; « Bon pour accord » à signer.",

    sections: [
      { titre: "Le devis", ouvert: true, champs: [
        { cle: 'numero',    lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Date", type: 'date', duo: true },
        { cle: 'validite',  lab: "Valable jusqu'au", type: 'date', duo: true },
        { cle: 'statut',    lab: "Statut", type: 'choix', duo: true, choix: ['Proposé', 'Accepté', 'Refusé', 'Expiré'] },
        { cle: 'objet',     lab: "Objet", type: 'texte' },
        { cle: 'delai',     lab: "Délai de réalisation", type: 'texte', aide: "« sous quinze jours après accord »" }
      ]},
      { titre: "Adressé à", ouvert: true, champs: [
        { cle: 'clientNom',     lab: "Nom ou raison sociale", type: 'texte' },
        { cle: 'clientAdresse', lab: "Adresse", type: 'zone' },
        { cle: 'clientContact', lab: "Contact", type: 'texte', duo: true },
        { cle: 'clientId',      lab: "NINEA ou identifiant", type: 'texte', duo: true }
      ]},
      { titre: "Les lignes", ouvert: true, special: 'table', source: 'lignes' },
      { titre: "Les conditions", ouvert: true, champs: [
        { cle: 'remise',     lab: "Remise (FCFA)", type: 'texte', duo: true },
        { cle: 'tva',        lab: "TVA", type: 'choix', duo: true, choix: ['Non assujetti', 'TVA 18 %'] },
        { cle: 'acompte',    lab: "Acompte à la commande", type: 'texte', duo: true, aide: "« 30 % », « 100 000 FCFA »" },
        { cle: 'moyen',      lab: "Règlement par", type: 'choix', duo: true, choix: ['Virement', 'Wave', 'Orange Money', 'Espèces', 'Chèque'] },
        { cle: 'conditions', lab: "Conditions", type: 'zone' }
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
        titre: "Devis", numero: "", dateActe: U.isoDuJour(), validite: dansTrenteJours(), lieu: "Dakar", statut: "Proposé", objet: "", delai: "",
        clientNom: "", clientAdresse: "", clientContact: "", clientId: "",
        remise: "", tva: "Non assujetti", acompte: "", moyen: "Virement",
        conditions: "Prix valables jusqu'à la date indiquée. La prestation est engagée à réception du devis signé « Bon pour accord » et de l'acompte s'il est prévu. Le solde est facturé à la réalisation.",
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
      if (!String(d.clientNom || '').trim()) c.push({ n: 'erreur', t: 'À qui est-il adressé ?' });
      var n = G.lignes(d, 'lignes').length;
      if (!n) c.push({ n: 'erreur', t: 'Aucune ligne' }); else c.push({ n: 'ok', t: n + ' ligne' + (n > 1 ? 's' : '') + ' · total ' + fcfa(recap(d).ttc) });
      if (!U.dateDe(d.validite)) c.push({ n: 'avert', t: 'Pas de date de validité' });
      return c;
    },

    page: [
      { b: 'entete', droite: function (d) { return [(d.lieu || '') + ", le " + U.dateLongue(d.dateActe, false), d.numero ? "Devis n° " + d.numero : ""]; } },
      { b: 'titre', etiquette: "Finances", pastille: function (d) { return d.statut && d.statut !== 'Proposé' ? d.statut : ''; }, texte: "Devis", sous: '@objet' },
      { b: 'parties', parties: function (d) {
          return [{ label: "Adressé à", nom: '@clientNom', texte: [d.clientAdresse || '', d.clientContact || '', d.clientId ? "NINEA / identifiant : " + d.clientId : ''].filter(Boolean).join("\n\n"), tag: '' },
                  { label: "Proposé par", nom: "Baobabs Basket Club", texte: [d.validite ? "Valable jusqu'au **" + U.dateLongue(d.validite, false) + "**" : '', d.delai ? "Réalisation : " + d.delai : ''].filter(Boolean).join("\n\n"), tag: '' }];
        } },
      { b: 'tableau', source: 'lignes', vide: 6 },
      { b: 'chips', chips: function (d) {
          var r = recap(d), l = [{ label: "Sous-total", valeur: fcfa(r.ht) }];
          if (r.rem) l.push({ label: "Remise", valeur: "- " + fcfa(r.rem) });
          if (r.taux) l.push({ label: "TVA 18 %", valeur: fcfa(r.tva) });
          l.push({ label: r.taux ? "Total TTC" : "Total", valeur: fcfa(r.ttc) });
          if (String(d.acompte || '').trim()) l.push({ label: "Acompte à la commande", valeur: d.acompte });
          return l;
        } },
      { b: 'encadre', etiquette: "Conditions", titre: function (d) { return "Règlement par " + (d.moyen || 'virement'); },
        avant: function (d) { return [d.conditions || '', /18/.test(String(d.tva || '')) ? '' : "Association sportive non assujettie à la TVA."].filter(Boolean).join("\n\n"); } },
      { b: 'signatures', gauche: function (d) { return { lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "Le client signe précédé de la mention « Bon pour accord », avec la date.", reference: d.numero ? "BBC / DV / " + String(d.numero).replace('/', ' / ') : '' }; },
        cartes: function (d) {
          return [{ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite', mention: "Signature et cachet" },
                  { pour: "Le client", nom: String(d.clientNom || '').trim() || "Nom :", qualite: "", mention: "Bon pour accord · Date et signature", signer: false, cacheter: false }];
        } }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280", "Devis" + (d.numero ? " n° " + d.numero : '') + (d.clientNom ? " · " + d.clientNom : '')]; },
    fichier: function (d) { return "Devis" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : '') + (d.clientNom ? " - " + d.clientNom : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
