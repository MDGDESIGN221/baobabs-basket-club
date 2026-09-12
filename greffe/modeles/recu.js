/* =====================================================================
   MODÈLE : REÇU DE PAIEMENT
   ---------------------------------------------------------------------
   Une cotisation, une inscription, une vente de maillot : le club
   remet un reçu. Un bandeau or, le montant en chiffres et en lettres,
   qui a payé, pourquoi, comment ; la signature du président ; et un
   talon à détacher, que le club garde. Court, et différent de tout le
   reste : rien d'un courrier.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  function enLettres(n) {
    n = Math.round(parseFloat(String(n == null ? '' : n).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0);
    if (!n) return '';
    var unites = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    var dizaines = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
    function centaine(x) {
      var s = '';
      var c = Math.floor(x / 100), r = x % 100;
      if (c) s += (c > 1 ? unites[c] + ' ' : '') + 'cent' + (c > 1 && !r ? 's' : '');
      if (r) {
        if (s) s += ' ';
        if (r < 20) s += unites[r];
        else {
          var dz = Math.floor(r / 10), u = r % 10;
          if (dz === 7 || dz === 9) { u += 10; }
          s += dizaines[dz];
          if (dz === 8 && !u) s += 's';
          if (u === 1 && dz !== 8 && dz !== 9) s += ' et un';
          else if (u === 11 && dz === 7) s += ' et onze';
          else if (u) s += '-' + unites[u];
        }
      }
      return s;
    }
    var parts = [], millions = Math.floor(n / 1000000), milliers = Math.floor((n % 1000000) / 1000), reste = n % 1000;
    if (millions) parts.push((millions > 1 ? centaine(millions) + ' ' : 'un ') + 'million' + (millions > 1 ? 's' : ''));
    if (milliers) parts.push((milliers > 1 ? centaine(milliers) + ' ' : '') + 'mille');
    if (reste) parts.push(centaine(reste));
    return parts.join(' ');
  }

  G.modeles['recu'] = {
    cle: 'recu',
    nom: "Reçu de paiement",
    famille: "Finances",
    prefixe: "RC",
    resume: "Un montant, en chiffres et en lettres, qui a payé et pourquoi ; talon à détacher.",

    sections: [
      { titre: "Le reçu", ouvert: true, champs: [
        { cle: 'numero',   lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe', lab: "Date", type: 'date', duo: true },
        { cle: 'montant',  lab: "Montant (FCFA)", type: 'texte', duo: true, aide: "En chiffres : 25 000" },
        { cle: 'mode',     lab: "Mode de paiement", type: 'choix', duo: true, choix: ['Espèces', 'Wave', 'Orange Money', 'Virement', 'Chèque'] },
        { cle: 'motif',    lab: "Motif", type: 'texte', aide: "« Cotisation saison 2026-2027 », « Inscription école de basket »…" },
        { cle: 'periode',  lab: "Période ou détail", type: 'texte' }
      ]},
      { titre: "Reçu de", ouvert: true, champs: [
        { cle: 'payeur',    lab: "Nom du payeur", type: 'texte' },
        { cle: 'pourQui',   lab: "Pour le compte de", type: 'texte', aide: "L'enfant, la joueuse, si ce n'est pas le payeur." },
        { cle: 'telephone', lab: "Téléphone", type: 'texte', duo: true },
        { cle: 'reste',     lab: "Reste à payer (FCFA)", type: 'texte', duo: true }
      ]},
      { titre: "Le signataire", ouvert: false, champs: [
        { cle: 'signNom',       lab: "Nom", type: 'texte', duo: true },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte', duo: true },
        { cle: 'avecSignature', lab: "Apposer la signature", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule' },
        { cle: 'avecTalon',     lab: "Imprimer le talon à détacher", type: 'bascule' }
      ]}
    ],

    defauts: function () {
      return {
        titre: "Reçu de paiement", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar",
        montant: "", mode: "Espèces", motif: "Cotisation de la saison", periode: "",
        payeur: "", pourQui: "", telephone: "", reste: "",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président",
        avecSignature: true, avecCachet: true, avecTalon: true,
        tables: {}
      };
    },

    controles: function (d) {
      var c = [];
      if (!(parseFloat(String(d.montant || '').replace(/[^\d.,-]/g, '')) > 0)) c.push({ n: 'erreur', t: 'Pas de montant' });
      if (!String(d.payeur || '').trim()) c.push({ n: 'erreur', t: 'Qui a payé ?' });
      if (!String(d.motif || '').trim()) c.push({ n: 'avert', t: 'Pas de motif' });
      return c;
    },

    page: [
      { b: 'entete', drapeau: false, droite: function (d) { return [(d.lieu || '') + ", le " + U.dateLongue(d.dateActe, false), d.numero ? "Reçu n° " + d.numero : ""]; } },
      { b: 'bandeau', ton: 'or', etiquette: "Reçu de paiement", texte: function (d) { return U.nombre(d.montant) + " FCFA"; },
        sous: function (d) { var l = enLettres(d.montant); return l ? "Soit " + l + " francs CFA" : ""; },
        droite: function (d) { return [d.numero ? "N° " + d.numero : "", U.dateLongue(d.dateActe, false)]; } },
      { b: 'parties', parties: function (d) {
          return [{ label: "Reçu de", nom: '@payeur', texte: [d.pourQui ? "Pour le compte de **" + d.pourQui + "**" : "", d.telephone ? "Tél. " + d.telephone : ""].filter(Boolean).join("\n\n"), tag: '' },
                  { label: "Pour", nom: '@motif', texte: '@periode', tag: '' }];
        } },
      { b: 'chips', chips: function (d) {
          return [{ label: "Mode de paiement", valeur: '@mode' }, { label: "Montant", valeur: U.nombre(d.montant) + " FCFA" },
                  { label: "Reste à payer", valeur: d.reste ? U.nombre(d.reste) + " FCFA" : "Néant" }];
        } },
      { b: 'texte', texte: function (d) { return "Le club **" + "Baobabs Basket Club" + "** reconnaît avoir reçu la somme ci-dessus, et en donne quittance. Ce reçu vaut justificatif de paiement." + (d.reste ? " Le solde restant dû est de **" + U.nombre(d.reste) + " FCFA**." : ""); } },
      { b: 'signatures', gauche: function (d) { return { lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "", reference: d.numero ? "BBC / RC / " + String(d.numero).replace('/', ' / ') : '' }; },
        cartes: [{ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite', mention: "Signature et cachet" }] },
      { b: 'talon', si: function (d) { return d.avecTalon !== false; }, etiquette: "Talon à conserver par le club",
        colonnes: function (d) {
          return [{ label: "Reçu n°", valeur: d.numero || '' }, { label: "Date", valeur: U.dateLongue(d.dateActe, false) }, { label: "Reçu de", valeur: d.payeur || '' },
                  { label: "Motif", valeur: d.motif || '' }, { label: "Montant", valeur: U.nombre(d.montant) + " FCFA" }, { label: "Mode", valeur: d.mode || '' }];
        } }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280", "Reçu" + (d.numero ? " n° " + d.numero : '') + (d.payeur ? " · " + d.payeur : '')]; },
    fichier: function (d) { return "Recu" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : '') + (d.payeur ? " - " + d.payeur : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
