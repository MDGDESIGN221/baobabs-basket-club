/* =====================================================================
   MODÈLE : COMMUNIQUÉ
   ---------------------------------------------------------------------
   Une nouvelle que le club rend publique : résultat, recrutement,
   partenariat, hommage. Un bandeau vert plein, « Pour diffusion
   immédiate », un titre qui accroche, un chapeau en gras, le texte, et
   le contact presse en cases. Pas de signature manuscrite : c'est un
   texte public, pas un acte.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  G.modeles['communique'] = {
    cle: 'communique',
    nom: "Communiqué",
    famille: "Communication",
    prefixe: "CP",
    resume: "Pour diffusion immédiate : un titre, un chapeau, le texte, le contact presse.",

    sections: [
      { titre: "Le communiqué", ouvert: true, champs: [
        { cle: 'numero',    lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Date", type: 'date', duo: true },
        { cle: 'mention',   lab: "Mention", type: 'choix', choix: ['Pour diffusion immédiate', 'Sous embargo', 'Communiqué interne'] },
        { cle: 'accroche',  lab: "Titre", type: 'texte' },
        { cle: 'chapeau',   lab: "Chapeau", type: 'zone', aide: "Trois lignes qui disent tout : qui, quoi, quand." },
        { cle: 'corps',     lab: "Texte", type: 'zone' },
        { cle: 'citation',  lab: "Citation", type: 'zone', aide: "Une phrase du président ou du coach, entre guillemets." },
        { cle: 'citeQui',   lab: "Qui parle", type: 'texte' }
      ]},
      { titre: "Le contact presse", ouvert: false, champs: [
        { cle: 'contactNom', lab: "Nom", type: 'texte', duo: true },
        { cle: 'contactTel', lab: "Téléphone", type: 'texte', duo: true },
        { cle: 'contactMail', lab: "E-mail", type: 'texte', duo: true },
        { cle: 'contactSite', lab: "Site", type: 'texte', duo: true },
        { cle: 'apropos',    lab: "À propos du club", type: 'zone' }
      ]}
    ],

    defauts: function () {
      return {
        titre: "Communiqué", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar",
        mention: "Pour diffusion immédiate", accroche: "", chapeau: "", corps: "", citation: "", citeQui: "Antoine Jean Pierre Ndong, Président",
        contactNom: "", contactTel: "", contactMail: "", contactSite: "baobabsbasketclub.com",
        apropos: "Baobabs Basket Club est la section basketball de l'ASC Baobab, à Dakar. Le club forme des joueuses et des joueurs de l'école de basket aux équipes seniors, avec une ambition : grandir ici, régner partout.",
        avecSignature: false, avecCachet: false,
        tables: {}
      };
    },

    controles: function (d) {
      var c = [];
      if (!String(d.accroche || '').trim()) c.push({ n: 'erreur', t: 'Pas de titre' });
      if (!String(d.chapeau || '').trim()) c.push({ n: 'avert', t: 'Pas de chapeau' });
      if (!String(d.corps || '').trim()) c.push({ n: 'erreur', t: 'Pas de texte' });
      if (!String(d.contactNom || '').trim()) c.push({ n: 'avert', t: 'Pas de contact presse' });
      return c;
    },

    page: [
      { b: 'bandeau', ton: 'vert', etiquette: '@mention', texte: "Communiqué", sous: function (d) { return "Baobabs Basket Club · " + (d.lieu || '') + ", le " + U.dateLongue(d.dateActe, false); },
        droite: function (d) { return [d.numero ? "N° " + d.numero : "", "Presse"]; } },
      { b: 'titre', texte: '@accroche', sous: '@chapeau' },
      { b: 'texte', texte: '@corps' },
      { b: 'encadre', si: function (d) { return !!String(d.citation || '').trim(); }, etiquette: "Citation", titre: '@citation', apres: '@citeQui' },
      { b: 'chips', chips: function (d) {
          return [{ label: "Contact presse", valeur: '@contactNom' }, { label: "Téléphone", valeur: '@contactTel' },
                  { label: "E-mail", valeur: '@contactMail' }, { label: "Site", valeur: '@contactSite' }];
        } },
      { b: 'texte', etiquette: "À propos", texte: '@apropos' }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · baobabsbasketclub.com", "Communiqué" + (d.numero ? " n° " + d.numero : '') + " · " + (d.mention || '')]; },
    fichier: function (d) { return "Communique" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : '') + " - " + String(d.accroche || '').slice(0, 50) + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
