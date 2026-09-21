/* =====================================================================
   /og/match/<id> et /og/joueuse/<id> : L'IMAGE QUE MONTRE WHATSAPP
   ---------------------------------------------------------------------
   Jusqu'ici, un lien de match partage sur WhatsApp affichait la banniere
   du club -- la meme pour les trois matchs de la saison. Cette fonction
   dessine l'image du match : les deux blasons, le score, la competition,
   la date. Et celle d'une joueuse : son portrait detoure sur le creme,
   son numero, son poste.

   COMMENT. satori compose un SVG a partir d'un arbre d'objets (pas de
   JSX : le projet n'a aucune etape de compilation, et n'en aura pas pour
   ca), resvg rend ce SVG en PNG, sharp decode les images du club --
   toutes en WebP, que ni satori ni resvg ne savent lire.

   CE QUI EST EN CACHE. Une image se recalcule en une seconde environ.
   Le reseau de Vercel la garde une heure, et la sert pendant qu'elle se
   refait : un score corrige apparait donc vite, sans que chaque partage
   coute une generation.

   LES WEBASSEMBLY. satori ouvre harfbuzz (le trace des lettres) et yoga
   (la mise en page) par « __dirname + le nom du fichier », motif que le
   traceur de Vercel ne reconnait pas : sans le bloc « functions » de
   vercel.json, la fonction se charge puis rend ENOENT sur hb.wasm des le
   premier caractere. Ce commentaire est ici et non dans vercel.json :
   Vercel valide ce fichier au schema et refuse TOUTE cle inconnue -- une
   cle « _lisez_moi » y a fait echouer trois deploiements d'affilee, avec
   pour seul message « Configuration error ».

   La police est lue sur le site lui-meme, comme api/partage.js lit
   index.html : rien a configurer, et le CDN la garde.
   ===================================================================== */
'use strict';

/* LES DEPENDANCES SE CHARGENT DANS LE HANDLER, PAS EN TETE DE FICHIER.
   Un require qui echoue au chargement du module rend FUNCTION_
   INVOCATION_FAILED : Vercel repond 500 avant d'entrer dans le code,
   et aucun try/catch ne peut le rattraper. Or og:image designe cette
   adresse : une dependance absente casserait alors TOUS les partages.
   Ici, elle fait seulement retomber sur la banniere du club. */
var satori = null, Resvg = null, sharp = null, chargement = null;
function charger(){
  if (chargement) return chargement;
  chargement = { ok: true, modules: {} };
  /* Les deux WebAssembly, nommes ici pour qu'ils apparaissent dans
     /og/etat : c'est ainsi qu'on voit, depuis le dehors, s'ils sont bien
     entres dans le paquet de la fonction. Ce qui les y fait entrer, c'est
     le bloc « functions » de vercel.json -- includeFiles porte bien sur
     node_modules, contrairement a ce que j'ai d'abord cru. */
  try { chargement.modules.hb = require.resolve('harfbuzzjs/hb.wasm'); } catch (e){ chargement.modules.hb = 'introuvable : ' + (e && e.message); }
  try { chargement.modules.yoga = require.resolve('satori/yoga.wasm'); } catch (e){ chargement.modules.yoga = 'introuvable : ' + (e && e.message); }
  try {
    var s = require('satori');
    satori = s && s.default ? s.default : s;
    chargement.modules.satori = typeof satori;
  } catch (e){ chargement.ok = false; chargement.modules.satori = 'ECHEC : ' + (e && e.message); }
  try {
    Resvg = require('@resvg/resvg-js').Resvg;
    chargement.modules.resvg = typeof Resvg;
  } catch (e){ chargement.ok = false; chargement.modules.resvg = 'ECHEC : ' + (e && e.message); }
  try {
    sharp = require('sharp');
    chargement.modules.sharp = typeof sharp;
  } catch (e){ chargement.ok = false; chargement.modules.sharp = 'ECHEC : ' + (e && e.message); }
  return chargement;
}

var SB_URL = 'https://lmwbwasupqkvswukieav.supabase.co';
var SB_KEY = 'sb_publishable_68RKprorqTmVkzjHrKgdZw_h-AcMXRh';
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

var NUIT = '#06110B', CREME = '#F3EFE6', VERT = '#A8D93B', OR = '#C6A257';
var GRIS = '#93A099', ENCRE = '#0B1A10', FOND_CLAIR = '#F2EEE4', VERT_SOMBRE = '#3F7D19';
var PALETTE = ['#c0392b', '#2457c5', '#15803d', '#d97706', '#7c3aed', '#0891b2', '#be185d', '#b45309'];

/* ------------------------------------------------------------------ */
function el(type, style, children){ return { type: type, props: { style: style, children: children } }; }
function texte(t, style){ return el('div', Object.assign({ display: 'flex' }, style), String(t == null ? '' : t)); }

function couleurDe(nom){
  var h = 0, s = String(nom || '?');
  for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function initiales(nom){
  return String(nom || '?').split(/\s+/).map(function(w){ return w[0] || ''; }).join('').slice(0, 3).toUpperCase();
}
function sb(q){
  return fetch(SB_URL + '/rest/v1/' + q, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
    .then(function(r){ if (!r.ok) throw new Error('supabase ' + r.status); return r.json(); });
}
function origine(req){
  var hote = req.headers['x-forwarded-host'] || req.headers.host || 'www.baobabsbasketclub.com';
  var proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  return proto + '://' + hote;
}

/* Les images du club sont toutes en WebP : sharp les rend en PNG, seul
   format que resvg sache poser dans le SVG. Une image qui ne se charge
   pas ne fait pas echouer l'affiche : on rend null, et l'appelant met
   les initiales a la place. */
function imagePng(url, largeur, hauteur, couvrir){
  if (!url) return Promise.resolve(null);
  return fetch(url).then(function(r){
    if (!r.ok) throw new Error('image ' + r.status);
    return r.arrayBuffer();
  }).then(function(buf){
    var s = sharp(Buffer.from(buf)).resize(largeur, hauteur, {
      fit: couvrir ? 'cover' : 'contain',
      position: couvrir ? 'top' : 'centre',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    });
    return s.png().toBuffer();
  }).then(function(png){
    return 'data:image/png;base64,' + png.toString('base64');
  }).catch(function(){ return null; });
}

function police(req){
  return fetch(origine(req) + '/media/fonts/ArchivoBlack-Regular.ttf')
    .then(function(r){ if (!r.ok) throw new Error('police ' + r.status); return r.arrayBuffer(); })
    .then(function(b){ return Buffer.from(b); });
}

function dateLongue(d){
  if (!d) return '';
  var dt = new Date(String(d).slice(0, 10) + 'T12:00:00Z');
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
function heure(t){ return t ? String(t).slice(0, 5).replace(':', 'h').replace(/h00$/, 'h') : ''; }
function majuscule(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
/* la base porte « 1,81 m » pour l'une et « 1.77 » pour l'autre : la
   meme regle que le site, sinon l'affiche annonce « 1,70 » tout court */
function taille(v){
  var s = String(v == null ? '' : v).trim();
  if (!s) return '';
  if (/[a-z]/i.test(s)) return s.replace('.', ',');
  var x = parseFloat(s.replace(',', '.'));
  if (isNaN(x)) return s;
  if (x > 100) x = x / 100;
  return x.toFixed(2).replace('.', ',') + ' m';
}
function ville(v){ return String(v == null ? '' : v).trim().replace(/\s*,\s*/g, ', '); }

/* ======================= L'AFFICHE D'UN MATCH ======================= */
function blason(nom, logo, gagnant){
  var corps = logo
    ? el('img', { width: 150, height: 150, borderRadius: 75 }, undefined, logo)
    : texte(initiales(nom), {
        width: 150, height: 150, borderRadius: 75, background: couleurDe(nom),
        alignItems: 'center', justifyContent: 'center', fontSize: 48, color: '#fff'
      });
  if (logo) corps = { type: 'img', props: { src: logo, width: 150, height: 150, style: { borderRadius: 75, objectFit: 'contain' } } };
  return el('div', {
    display: 'flex', flexDirection: 'column', alignItems: 'center', width: 300, flexShrink: 0,
  }, [
    el('div', {
      display: 'flex', width: 196, height: 196, borderRadius: 98, background: '#0c1913',
      border: '3px solid ' + (gagnant ? VERT : 'rgba(243,239,230,.14)'),
      alignItems: 'center', justifyContent: 'center',
    }, [corps]),
    el('div', {
      display: 'flex', width: 300, height: 66, marginTop: 22, fontSize: 26, color: gagnant ? CREME : '#B9C2BB',
      lineHeight: 1.2, alignItems: 'flex-start', justifyContent: 'center', textAlign: 'center',
    }, nom),
  ]);
}

function afficheMatch(m, logoBbc, logoAdv){
  var joue = m.score_baobabs != null && m.score_opponent != null;
  var adv = m.opponent_name || 'Adversaire';
  var gagne = joue && m.score_baobabs > m.score_opponent;
  var nul = joue && m.score_baobabs === m.score_opponent;
  var gauche = m.is_home
    ? { nom: 'Baobabs Basket Club', logo: logoBbc, score: m.score_baobabs, gagnant: gagne }
    : { nom: adv, logo: logoAdv, score: m.score_opponent, gagnant: joue && !gagne && !nul };
  var droite = m.is_home
    ? { nom: adv, logo: logoAdv, score: m.score_opponent, gagnant: joue && !gagne && !nul }
    : { nom: 'Baobabs Basket Club', logo: logoBbc, score: m.score_baobabs, gagnant: gagne };

  var etat = joue ? (gagne ? 'VICTOIRE' : (nul ? 'MATCH NUL' : 'DÉFAITE')) : (m.match_date ? 'À VENIR' : 'DATE À VENIR');
  var fondEtat = joue ? (gagne ? VERT : (nul ? OR : 'rgba(224,101,92,.9)')) : OR;
  var encreEtat = joue && !gagne && !nul ? CREME : '#0A1B0D';

  var centre = joue
    ? el('div', { display: 'flex', alignItems: 'center', fontSize: 168, letterSpacing: -7 }, [
        texte(gauche.score, { color: gauche.gagnant ? VERT : CREME }),
        texte(':', { color: 'rgba(243,239,230,.26)', margin: '0 30px', fontSize: 92 }),
        texte(droite.score, { color: droite.gagnant ? VERT : CREME })
      ])
    : el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center' }, [
        texte(m.match_date ? String(m.match_date).slice(8, 10) + '.' + String(m.match_date).slice(5, 7) : 'VS', { fontSize: 118, color: OR, letterSpacing: -4 }),
        texte(heure(m.match_time) || 'Heure à venir', { fontSize: 26, color: GRIS, marginTop: 10 })
      ]);

  var bas = [majuscule(dateLongue(m.match_date)), m.venue].filter(Boolean).join(' · ');

  return el('div', {
    display: 'flex', flexDirection: 'column', width: 1200, height: 630, background: NUIT,
    padding: '52px 60px 44px', justifyContent: 'space-between', borderBottom: '12px solid ' + VERT,
  }, [
    el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }, [
      texte(String(m.competition || 'Match').toUpperCase() + (m.round_label ? '  ·  ' + String(m.round_label).toUpperCase() : ''), {
        fontSize: 20, letterSpacing: 3, color: VERT, maxWidth: 820,
      }),
      texte(etat, { fontSize: 19, letterSpacing: 3, color: encreEtat, background: fondEtat, padding: '9px 20px', borderRadius: 999 })
    ]),
    /* flexGrow : le centre prend la place qui reste et s'y centre, au
       lieu de laisser un vide sous les noms des clubs */
    el('div', { display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'space-between', width: '100%' }, [
      blason(gauche.nom, gauche.logo, gauche.gagnant),
      centre,
      blason(droite.nom, droite.logo, droite.gagnant)
    ]),
    el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', fontSize: 22 }, [
      texte(bas, { color: GRIS, maxWidth: 830 }),
      texte('baobabsbasketclub.com', { color: OR })
    ])
  ]);
}

/* ====================== L'AFFICHE D'UNE JOUEUSE ====================== */
function afficheJoueuse(p, portrait, logoBbc){
  /* le poste est deja dans la pastille juste au-dessus : le repeter ici
     faisait « ARRIERE » puis « Arriere · 1,70 · Dakar » */
  var mesures = [taille(p.height), ville(p.city)].filter(Boolean).join('  ·  ');
  return el('div', {
    display: 'flex', width: 1200, height: 630, background: FOND_CLAIR,
    borderBottom: '12px solid ' + VERT, position: 'relative',
  }, [
    /* le numero, en geant, derriere elle */
    texte('#' + (p.jersey_number != null ? p.jersey_number : ''), {
      position: 'absolute', top: -68, right: 18, fontSize: 300, color: 'rgba(11,26,16,.055)', letterSpacing: -14,
    }),
    /* le fondu du bas : les photos de l'effectif sont coupees a
       mi-cuisses dans le fichier meme. Une bande du meme creme, en
       degrade, evite que l'affiche montre une tranche nette. */
    portrait
      ? el('div', { display: 'flex', width: 430, height: 630, position: 'relative' }, [
          { type: 'img', props: { src: portrait, width: 430, height: 630, style: { objectFit: 'contain', objectPosition: 'bottom' } } },
          el('div', { position: 'absolute', left: 0, right: 0, bottom: 0, height: 92, background: 'linear-gradient(to bottom, rgba(242,238,228,0), ' + FOND_CLAIR + ')' }, '')
        ])
      : el('div', { display: 'flex', width: 430, height: 630, alignItems: 'center', justifyContent: 'center', fontSize: 150, color: 'rgba(11,26,16,.12)' }, String(p.jersey_number != null ? p.jersey_number : '')),
    el('div', {
      display: 'flex', flexDirection: 'column', justifyContent: 'center', flexGrow: 1,
      padding: '0 62px 0 30px',
    }, [
      texte(String(p.position || 'Joueuse').toUpperCase(), {
        fontSize: 19, letterSpacing: 3, color: '#0A1B0D', background: VERT,
        padding: '9px 19px', borderRadius: 999, marginBottom: 26, alignSelf: 'flex-start',
      }),
      el('div', { display: 'flex', alignItems: 'flex-start' }, [
        texte('#' + (p.jersey_number != null ? p.jersey_number : ''), { fontSize: 62, color: VERT_SOMBRE, letterSpacing: -3, marginRight: 18, lineHeight: 1.04 }),
        texte(String(p.name || '').toUpperCase(), { fontSize: 62, color: ENCRE, letterSpacing: -3, maxWidth: 560, lineHeight: 1.04 })
      ]),
      texte(mesures, { fontSize: 24, color: '#5C6B5E', marginTop: 26, letterSpacing: 1 }),
      el('div', { display: 'flex', alignItems: 'center', marginTop: 44 }, [
        logoBbc ? { type: 'img', props: { src: logoBbc, width: 54, height: 54, style: { borderRadius: 27, marginRight: 16 } } } : texte('', {}),
        texte('BAOBABS BASKET CLUB · DAKAR', { fontSize: 19, letterSpacing: 3, color: '#5C6B5E' })
      ])
    ])
  ]);
}

/* ------------------------------------------------------------------ */
function rendre(noeud, ttf){
  return satori(noeud, {
    width: 1200, height: 630,
    fonts: [{ name: 'Archivo Black', data: ttf, weight: 400, style: 'normal' }]
  }).then(function(svg){
    return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  });
}

module.exports = function(req, res){
  var etat = charger();
  var type = String(req.query.type || ''), id = String(req.query.id || '');
  /* faute de pouvoir lire les journaux de Vercel d'ici : ce que la
     fonction a reussi a charger, en clair */
  if (type === 'etat'){
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ ok: etat.ok, modules: etat.modules, node: process.version }, null, 1));
    return;
  }
  if (!etat.ok){
    try { console.error('[og] dependances : ' + JSON.stringify(etat.modules)); } catch (x) {}
    res.statusCode = 302;
    res.setHeader('Location', '/og-banner.png');
    res.end();
    return;
  }
  if ((type !== 'match' && type !== 'joueuse') || !UUID.test(id)){
    res.statusCode = 302;
    res.setHeader('Location', '/og-banner.png');
    res.end();
    return;
  }
  var base = origine(req);
  var lecture = type === 'match'
    ? sb('matches?select=id,opponent_name,opponent_logo_url,match_date,match_time,venue,competition,round_label,is_home,score_baobabs,score_opponent&id=eq.' + id)
    : sb('effectif_site?select=id,name,jersey_number,position,photo_url,height,city&id=eq.' + id);

  Promise.all([lecture, police(req)]).then(function(r){
    var ligne = (r[0] || [])[0], ttf = r[1];
    if (!ligne) throw new Error('introuvable');
    var absolue = function(u){ return !u ? null : (/^https?:\/\//i.test(u) ? u : (u.charAt(0) === '/' ? base + u : null)); };
    if (type === 'match'){
      return Promise.all([
        imagePng(base + '/media/img/BBC_-_COLORED_LOGO_jjcrux.webp', 300, 300, false),
        imagePng(absolue(ligne.opponent_logo_url), 300, 300, false)
      ]).then(function(im){ return rendre(afficheMatch(ligne, im[0], im[1]), ttf); });
    }
    return Promise.all([
      imagePng(absolue(ligne.photo_url), 860, 1260, false),
      imagePng(base + '/media/img/BBC_-_COLORED_LOGO_jjcrux.webp', 160, 160, false)
    ]).then(function(im){ return rendre(afficheJoueuse(ligne, im[0], im[1]), ttf); });
  }).then(function(png){
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
    res.end(png);
  }).catch(function(e){
    /* la cause part aussi dans un en-tete : les journaux de Vercel ne se
       lisent pas d ici, et une affiche qui retombe sur la banniere ne dit
       rien de ce qui lui a manque. Message seul, jamais la pile. */
    try { res.setHeader('X-Bbc-Og', String((e && e.message) || e).slice(0, 120).replace(/[^ -~]/g, ' ')); } catch (x) {}
    /* une affiche qui ne se dessine pas ne doit pas casser le partage :
       la banniere du club prend le relais. La cause reste lisible dans
       les journaux de la fonction -- sans elle, un echec est muet. */
    try { console.error('[og] ' + type + ' ' + id + ' : ' + (e && e.stack ? e.stack : e)); } catch (x) {}
    res.statusCode = 302;
    res.setHeader('Location', '/og-banner.png');
    res.end();
  });
};
