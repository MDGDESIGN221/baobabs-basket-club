/* =====================================================================
   MODÈLE : INVITATION
   ---------------------------------------------------------------------
   Le club a l'honneur de vous inviter : cérémonie, remise des
   licences, match de gala, assemblée. Une page aérée, centrée, un
   bandeau clair, l'événement en grand, l'essentiel en cases, la
   réponse attendue. Prévue pour la série : une invitation nominative
   par convive avec {{col.nom}}.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  G.modeles['invitation'] = {
    cle: 'invitation',
    nom: "Invitation",
    famille: "Communication",
    prefixe: "IN",
    resume: "A l'honneur de vous inviter : l'événement en grand, l'essentiel en cases, la réponse attendue.",

    sections: [
      { titre: "L'invitation", ouvert: true, champs: [
        { cle: 'numero',    lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Date", type: 'date', duo: true },
        { cle: 'invite',    lab: "Invité(e)", type: 'texte', aide: "Vide : invitation générale. En série : {{col.nom}}." },
        { cle: 'qualiteInvite', lab: "Sa qualité", type: 'texte' },
        { cle: 'evenement', lab: "Événement", type: 'texte' },
        { cle: 'jour',      lab: "Date", type: 'date', duo: true },
        { cle: 'heure',     lab: "Heure", type: 'texte', duo: true },
        { cle: 'lieuEv',    lab: "Lieu", type: 'texte' },
        { cle: 'programme', lab: "Programme", type: 'zone', aide: "Un point par ligne, avec un tiret." },
        { cle: 'tenue',     lab: "Tenue", type: 'texte', duo: true },
        { cle: 'rsvp',      lab: "Réponse souhaitée avant le", type: 'texte', duo: true },
        { cle: 'contact',   lab: "Contact pour répondre", type: 'texte' }
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
        titre: "Invitation", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar",
        invite: "", qualiteInvite: "", evenement: "", jour: "", heure: "", lieuEv: "",
        programme: "- Accueil des invités\n- Mot du Président\n- Remise des distinctions\n- Cocktail",
        tenue: "", rsvp: "", contact: "",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président",
        avecSignature: true, avecCachet: false,
        styles: { b1: { theme: 'or' } },
        tables: {}
      };
    },

    controles: function (d) {
      var c = [];
      if (!String(d.evenement || '').trim()) c.push({ n: 'erreur', t: 'Quel événement ?' });
      if (!U.dateDe(d.jour)) c.push({ n: 'erreur', t: 'Pas de date' });
      if (!String(d.lieuEv || '').trim()) c.push({ n: 'avert', t: 'Pas de lieu' });
      return c;
    },

    page: [
      { b: 'entete', droite: function (d) { return [(d.lieu || '') + ", le " + U.dateLongue(d.dateActe, false), d.numero ? "Invitation n° " + d.numero : ""]; } },
      { b: 'espace', hauteur: 10 },
      { b: 'bandeau', ton: 'clair', etiquette: function (d) { return d.invite ? "À l'attention de " + d.invite + (d.qualiteInvite ? ", " + d.qualiteInvite : '') : "Invitation"; },
        texte: '@evenement', sous: function (d) { return "Le Président et le bureau de Baobabs Basket Club ont l'honneur de vous inviter"; },
        droite: function (d) { return [U.dateLongue(d.jour, false) || '', d.heure || '']; } },
      { b: 'reperes', cellules: function (d) {
          return [{ label: "Date", valeur: U.dateLongue(d.jour, true) || '' }, { label: "Heure", valeur: '@heure' }, { label: "Lieu", valeur: '@lieuEv' },
                  d.tenue ? { label: "Tenue", valeur: '@tenue' } : { label: "Réponse avant le", valeur: '@rsvp' }];
        } },
      { b: 'texte', etiquette: "Programme", texte: '@programme' },
      { b: 'encadre', si: function (d) { return !!(String(d.rsvp || '').trim() || String(d.contact || '').trim()); }, etiquette: "Votre réponse",
        titre: function (d) { return d.rsvp ? "Merci de confirmer votre présence avant le " + d.rsvp : "Merci de confirmer votre présence"; },
        apres: '@contact' },
      { b: 'signatures', gauche: function (d) { return { lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "Nous serions honorés de votre présence.", reference: '' }; },
        cartes: [{ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite', mention: "Signature" }] }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Grandir ici. Régner partout.", "Invitation" + (d.evenement ? " · " + d.evenement : '')]; },
    fichier: function (d) { return "Invitation" + (d.invite ? " - " + d.invite : '') + (d.evenement ? " - " + String(d.evenement).slice(0, 40) : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
