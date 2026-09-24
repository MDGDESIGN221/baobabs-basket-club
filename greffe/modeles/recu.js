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

  /* Le montant tel qu'il a été tapé (« 25 000 ») : U.nombre seul le
     rendait vide, et le reçu affichait « FCFA » sans chiffre. Les lettres
     viennent de U.enLettres, qui écrit « deux cent mille » et non plus
     « deux cents mille ». */
  function somme(x) { return U.nombre(U.montant(x)); }

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
      if (!(U.montant(d.montant) > 0)) c.push({ n: 'erreur', t: 'Pas de montant' });
      if (!String(d.payeur || '').trim()) c.push({ n: 'erreur', t: 'Qui a payé ?' });
      if (!String(d.motif || '').trim()) c.push({ n: 'avert', t: 'Pas de motif' });
      return c;
    },

    page: [
      { b: 'entete', drapeau: false, droite: function (d) { return [(d.lieu || '') + ", le " + U.dateLongue(d.dateActe, false), d.numero ? "Reçu n° " + d.numero : ""]; } },
      { b: 'bandeau', ton: 'or', etiquette: "Reçu de paiement", texte: function (d) { return somme(d.montant) + " FCFA"; },
        sous: function (d) { var l = U.enLettres(d.montant); return l ? "Soit " + l + " francs CFA" : ""; },
        droite: function (d) { return [d.numero ? "N° " + d.numero : "", U.dateLongue(d.dateActe, false)]; } },
      { b: 'parties', parties: function (d) {
          return [{ label: "Reçu de", nom: '@payeur', texte: [d.pourQui ? "Pour le compte de **" + d.pourQui + "**" : "", d.telephone ? "Tél. " + d.telephone : ""].filter(Boolean).join("\n\n"), tag: '' },
                  { label: "Pour", nom: '@motif', texte: '@periode', tag: '' }];
        } },
      { b: 'chips', chips: function (d) {
          return [{ label: "Mode de paiement", valeur: '@mode' }, { label: "Montant", valeur: somme(d.montant) + " FCFA" },
                  { label: "Reste à payer", valeur: d.reste ? somme(d.reste) + " FCFA" : "Néant" }];
        } },
      { b: 'texte', texte: function (d) { return "Le club **" + "Baobabs Basket Club" + "** reconnaît avoir reçu la somme ci-dessus, et en donne quittance. Ce reçu vaut justificatif de paiement." + (d.reste ? " Le solde restant dû est de **" + somme(d.reste) + " FCFA**." : ""); } },
      { b: 'signatures', gauche: function (d) { return { lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "", reference: d.numero ? "BBC / RC / " + String(d.numero).replace('/', ' / ') : '' }; },
        cartes: [{ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite', mention: "Signature et cachet" }] },
      { b: 'talon', si: function (d) { return d.avecTalon !== false; }, etiquette: "Talon à conserver par le club",
        colonnes: function (d) {
          return [{ label: "Reçu n°", valeur: d.numero || '' }, { label: "Date", valeur: U.dateLongue(d.dateActe, false) }, { label: "Reçu de", valeur: d.payeur || '' },
                  { label: "Motif", valeur: d.motif || '' }, { label: "Montant", valeur: somme(d.montant) + " FCFA" }, { label: "Mode", valeur: d.mode || '' }];
        } }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280", "Reçu" + (d.numero ? " n° " + d.numero : '') + (d.payeur ? " · " + d.payeur : '')]; },
    fichier: function (d) { return "Recu" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : '') + (d.payeur ? " - " + d.payeur : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
