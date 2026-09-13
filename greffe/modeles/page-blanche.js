/* =====================================================================
   MODÈLE : PAGE BLANCHE
   ---------------------------------------------------------------------
   Une feuille A4 vide, rien d'autre. Ni en-tête, ni titre, ni
   signature : on pose ce qu'on veut, où l'on veut, depuis la barre
   d'outils (textes, cases, images, cadres, signature, cachet) et la
   palette des blocs (en-tête, titre, tableau, grille, cases…). Même
   palette, mêmes réglages que l'acte libre : c'est l'acte libre sans
   rien dessus.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var base = G.modeles['acte-libre'];
  if (!base) return;

  G.modeles['page-blanche'] = Object.assign({}, base, {
    cle: 'page-blanche',
    nom: "Page blanche",
    famille: "Actes",
    prefixe: "",
    resume: "Une feuille A4 vide : posez ce que vous voulez, où vous voulez.",
    defauts: function () {
      var d = base.defauts();
      d.blocs = [];
      d.titre = "Page blanche";
      d.avecSignature = false; d.avecCachet = false;
      return d;
    },
    controles: function (d) {
      var c = [];
      if (!(d.blocs || []).length && !(d.objets || []).length) c.push({ n: 'avert', t: 'La page est vide' });
      return c;
    },
    pied: function () { return []; },
    fichier: function (d) { return String(d.titre || 'Page blanche').slice(0, 60) + " - BAOBABS BASKET CLUB"; }
  });
})(window.BaobabsGreffe);
