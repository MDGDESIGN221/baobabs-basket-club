/* =====================================================================
   /i/<largeur>/media/... : LES FICHIERS DU SITE, A LA BONNE TAILLE
   ---------------------------------------------------------------------
   Les photos de joueuses vivent sur Supabase, qui sait les redimensionner
   (voir bbCloud). Les fichiers de /media/ -- affiches, photos de hero,
   logos -- sont servis en statique par Vercel, qui ne sait pas. Ils
   partaient donc en pleine resolution : 1600 x 1282 pour une image de
   fond, soit huit megaoctets de memoire vive sur un telephone qui
   l'affiche en 375 pixels de large.

   Cette fonction les redimensionne une fois, et le reseau de Vercel
   garde le resultat un an : une image donnee n'est calculee qu'une seule
   fois par taille, pour tout le monde.

   CE QU'ELLE REFUSE, ET POURQUOI. Elle ne sert QUE des chemins de /media/
   du site lui-meme, et seulement six largeurs connues. Sans ces deux
   verrous, elle deviendrait un proxy ouvert -- n'importe qui pourrait
   lui faire telecharger n'importe quoi, a nos frais -- et une machine a
   fabriquer des milliers de variantes d'une meme image.

   QUOI QU'IL ARRIVE, L'IMAGE ARRIVE. Une erreur renvoie vers le fichier
   d'origine : le visiteur voit l'image, plus lourde, plutot qu'un carre
   vide.
   ===================================================================== */
'use strict';

var LARGEURS = [200, 320, 480, 640, 800, 1200, 1600];

var sharp = null, chargement = null;
function charger(){
  if (chargement) return chargement;
  chargement = { ok: true };
  try { sharp = require('sharp'); }
  catch (e){ chargement.ok = false; chargement.erreur = String(e && e.message); }
  return chargement;
}

function origine(req){
  var hote = req.headers['x-forwarded-host'] || req.headers.host || 'www.baobabsbasketclub.com';
  var proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  return proto + '://' + hote;
}

module.exports = function(req, res){
  var chemin = String(req.query.u || '');
  var demande = parseInt(req.query.w, 10) || 800;
  /* on arrondit a la largeur connue immediatement superieure : une image
     n'existe qu'en six tailles, jamais en mille */
  var largeur = LARGEURS.filter(function(l){ return l >= demande; })[0] || LARGEURS[LARGEURS.length - 1];

  if (chemin.charAt(0) !== '/') chemin = '/' + chemin;
  var versOriginal = function(){
    res.statusCode = 302;
    res.setHeader('Location', chemin);
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.end();
  };

  /* Deux verrous : chez nous, et sous /media/. Rien d'autre ne passe. */
  if (!/^\/media\/[A-Za-z0-9._\/-]+\.(webp|png|jpe?g)$/i.test(chemin) || chemin.indexOf('..') !== -1){
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('chemin refuse');
    return;
  }

  var etat = charger();
  if (!etat.ok) return versOriginal();

  fetch(origine(req) + chemin).then(function(r){
    if (!r.ok) throw new Error('fichier ' + r.status);
    return r.arrayBuffer();
  }).then(function(buf){
    return sharp(Buffer.from(buf))
      .resize({ width: largeur, withoutEnlargement: true })
      .webp({ quality: 74 })
      .toBuffer();
  }).then(function(webp){
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/webp');
    /* un an : le nom du fichier porte son contenu, une image remplacee
       porte un autre nom */
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    res.end(webp);
  }).catch(function(e){
    try { console.error('[img] ' + chemin + ' : ' + (e && e.message)); } catch (x) {}
    versOriginal();
  });
};
