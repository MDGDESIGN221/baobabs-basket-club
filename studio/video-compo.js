/* =====================================================================
   BAOBABS VIDEO : LA COMPOSITION, EN VIDEO A TELECHARGER (30/09/2026)
   ---------------------------------------------------------------------
   « dans l'admin pouvoir avoir la composition en video a telecharger,
     pour chaque composition future aussi ».

   DEUX VIDEOS, au choix au moment du clic (choisir) :

   - LA PRESENTATION : la scene de l'accueil, mise en vertical. Le
     generique, l'affiche (le match ou l'evenement), puis une joueuse
     par acte, en grand (son poste, sa taille, son age), puis le groupe,
     le banc, l'encadrement. Les memes actes que sur le site, dans le
     meme ordre, avec le volet en escalier entre deux actes.
     « on devrait avoir, en plus, la video de la presentation des
     joueuses sur le site ».

   - LA LISTE : le « Starting Lineup » des Celtics que le club a donne en
     reference (video Pinterest de 12 s). Une carte titre, puis les
     visages en bandes a gauche et la liste encadree d'un filet a droite.
     Cinq joueuses par page au plus : a six, « on voit pas bien les
     joueuses ». Les bandes sont eclairees et cadrees jusqu'aux epaules.

   - L'AFFICHE DU MATCH (08/11/2026) : seulement l'annonce, Baobabs
     contre l'adversaire, la date, l'heure, le terrain, domicile ou
     exterieur. « ca doit etre different des autres videos qui ont la
     meme transition et tout » : une autre grammaire, voir plus bas.

   LE FORMAT se choisit au moment du clic : publication 4:5 (1080 x
   1350), story ou statut 9:16 (1080 x 1920), et carre 1:1 pour
   l'affiche. La presentation et la liste sont dessinees en 4:5 : en
   story, elles se posent au milieu, sur le meme fond prolonge (le haut
   et le bas d'une story sont couverts par l'interface du reseau).
   L'affiche se dessine a toutes les tailles, et se telecharge aussi en
   image fixe (PNG) : sa derniere image est une affiche complete.

   Le reste du temps : 30 images par seconde, sans
   son. La video se FABRIQUE image par image dans le navigateur (canvas),
   puis s'encode en MP4 H.264 par WebCodecs et mp4-muxer (jsdelivr, que
   la politique de securite du site accepte). Sans WebCodecs, elle
   s'enregistre en temps reel (MediaRecorder), en MP4 si le navigateur
   sait, en WebM sinon.

   Aucune donnee n'est inventee : tout vient de ce que l'admin a sous la
   main au moment du clic. Une composition future a donc sa video des
   qu'elle est posee.

   Contrat : un seul global, window.BaobabsVideo.
     choisir(bouton, donnees)          -> Promise<{ style, format, sortie } | null>
     telecharger(donnees, surProgres)  -> Promise<{ nom, type, taille }>
     fabriquer(donnees, surProgres)    -> Promise<{ blob, nom, type }>
     apercu(donnees, T)                -> Promise<{ canvas, total }>
   donnees = {
     style: 'presentation' | 'liste' | 'affiche',
     format: '4x5' | '9x16' | '1x1',  // 1x1 : l'affiche seulement
     sortie: 'mp4' | 'png',           // png : l'affiche seulement
     // l'affiche ne lit que match et adversaire :
     //   match: { dom, date:'2026-11-15', heure:'19:00', lieu, competition, journee }
     genre: 'cinq' | 'selection',
     titre: 'Cinq majeur',            // le titre du generique
     sur:   'Baobabs Basket Club',    // la ligne au-dessus
     contre: '5 titulaires',          // la ligne sous le titre (presentation)
     infos: ['Baobabs vs X', 'Sam. 4 oct. · 19 h', 'Salle'],  // 3 lignes au plus (liste)
     adversaire: { nom, logo } | null,
     match: { dom, quand, lieu, competition } | null,          // l'affiche du match
     evenement: { titre, kicker, dates, lieu, nations[], affiche } | null,
     joueuses: [{ nom, no, photo, cap, role, poste, taille, age }],
     banc: [{ nom, no }],
     staff: { chef: { nom, fonction, photo }, autres: [{ nom, fonction }] } | null,
     groupeTitre: 'Le groupe', groupeSur: 'Tournoi international',
     nomFichier: 'baobabs-cinq-majeur-2026-10-04'
   }
   ===================================================================== */
(function(){
  'use strict';
  if (window.BaobabsVideo) return;

  // W x H : la planche ou se dessinent la presentation et la liste
  var W = 1080, H = 1350, FPS = 30;
  // les formats de sortie ; compo : la presentation et la liste y vont
  var FORMATS = {
    '4x5':  { w: 1080, h: 1350, lib: 'Publication', ratio: '4:5',  compo: true,  suffixe: '' },
    '9x16': { w: 1080, h: 1920, lib: 'Story',       ratio: '9:16', compo: true,  suffixe: '-story' },
    '1x1':  { w: 1080, h: 1080, lib: 'Carré',       ratio: '1:1',  compo: false, suffixe: '-carre' }
  };
  function formatDe(d){
    var f = FORMATS[d && d.format] || FORMATS['4x5'];
    return d && d.style !== 'affiche' && !f.compo ? FORMATS['4x5'] : f;
  }
  var VERT = '#A8D93B', VERT_PALE = '#E3F5B4', CREME = '#F3EFE6', GRIS = 'rgba(243,239,230,.62)';
  var NUIT = '#06190F';
  var LOGO = '/media/img/BBC_-_COLORED_LOGO_jjcrux.webp';
  var POLICES = 'https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800;900&family=Archivo:wght@500;600;700;800&display=swap';
  var MUXER = 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.1/build/mp4-muxer.js';
  var TITRE = '"Big Shoulders Display", Impact, sans-serif';
  var TEXTE = 'Archivo, system-ui, sans-serif';

  /* ---------------------------------------------------------- outils */
  function borne(x){ return x < 0 ? 0 : x > 1 ? 1 : x; }
  function sortie(x){ x = borne(x); return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); }        // expo : attaque franche, pose douce
  function quart(x){ x = borne(x); return x < .5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2; }
  function cube(x){ x = borne(x); return 1 - Math.pow(1 - x, 3); }
  function phase(t, debut, duree){ return borne((t - debut) / duree); }
  function espace(x, px){ if ('letterSpacing' in x) x.letterSpacing = px + 'px'; }

  function charger(src){
    return new Promise(function(res, rej){
      var s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = res; s.onerror = function(){ rej(new Error('script ' + src)); };
      document.head.appendChild(s);
    });
  }
  var policesPretes = null;
  function polices(){
    if (policesPretes) return policesPretes;
    policesPretes = new Promise(function(res){
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = POLICES;
      l.onload = res; l.onerror = res; document.head.appendChild(l);
    }).then(function(){
      return Promise.all(['900 100px "Big Shoulders Display"', '800 100px "Big Shoulders Display"',
        '800 40px Archivo', '700 40px Archivo', '600 40px Archivo', '500 40px Archivo']
        .map(function(f){ return document.fonts.load(f).catch(function(){}); }));
    });
    return policesPretes;
  }
  // une feuille de polices de plus (celle de l'affiche), chargee une fois
  var feuilles = {};
  function policesEn(url, faces){
    if (!url) return Promise.resolve();
    if (!feuilles[url]) feuilles[url] = new Promise(function(res){
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = url;
      l.onload = res; l.onerror = res; document.head.appendChild(l);
    }).then(function(){
      return Promise.all((faces || []).map(function(f){ return document.fonts.load(f).catch(function(){}); }));
    });
    return feuilles[url];
  }
  // une photo de la base, servie a la bonne taille (le rendu Supabase)
  function taille(u, w){
    u = String(u || '').trim(); if (!u) return '';
    if (/\/storage\/v1\/object\/public\//.test(u))
      return u.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') +
             (u.indexOf('?') >= 0 ? '&' : '?') + 'width=' + w + '&resize=contain&quality=85';
    return u;
  }
  // crossOrigin : une image sans CORS « salirait » le canvas, et le
  // navigateur refuserait d'en tirer une video.
  // decode() ne rend jamais la main tant que l'onglet est cache (mesure le
  // 30/09) : on ne l'attend pas plus d'une seconde, l'image est chargee.
  function image(u){
    return new Promise(function(res){
      if (!u) return res(null);
      var i = new Image(); i.crossOrigin = 'anonymous'; i.decoding = 'async';
      i.onload = function(){
        var fait = false, fin = function(){ if (!fait){ fait = true; res(i); } };
        setTimeout(fin, 1000);
        (i.decode ? i.decode() : Promise.resolve()).then(fin, fin);
      };
      i.onerror = function(){ res(null); };
      i.src = u;
    });
  }
  // rendre la main entre deux lots d'images. Onglet cache, setTimeout est
  // bride a une fois par seconde (puis par minute) : un message ne l'est pas.
  var canal = null, enAttente = [];
  function cede(fn){
    if (!document.hidden || typeof MessageChannel === 'undefined') return setTimeout(fn, 0);
    if (!canal){
      canal = new MessageChannel();
      canal.port1.onmessage = function(){ var f = enAttente.shift(); if (f) f(); };
    }
    enAttente.push(fn); canal.port2.postMessage(0);
  }
  /* OU EST LE VISAGE. Les photos de l'effectif sont detourees : on lit la
     silhouette dans le canal alpha (le haut de la tete, et le centre des
     pixels pleins dans le haut de la silhouette). Une photo opaque n'a
     pas de silhouette : on le dit (opaque), elle se pose dans un cadre. */
  function visage(img){
    var w = 120, h = Math.max(1, Math.round(img.naturalHeight / img.naturalWidth * w));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h);
    var d; try { d = x.getImageData(0, 0, w, h).data; } catch(e){ return { cx:.5, top:.02, haut:.96, opaque:true }; }
    var top = -1, bas = -1, i, j;
    for (j = 0; j < h; j++) for (i = 0; i < w; i++) if (d[(j * w + i) * 4 + 3] > 60){ if (top < 0) top = j; bas = j; }
    if (top < 0) return { cx:.5, top:.02, haut:.96, opaque:true };
    var hs = Math.max(1, bas - top), bande = Math.max(2, Math.round(hs * .12)), sx = 0, n = 0;
    for (j = top; j < Math.min(h, top + bande); j++) for (i = 0; i < w; i++) if (d[(j * w + i) * 4 + 3] > 60){ sx += i; n++; }
    var opaque = top === 0 && bas === h - 1 && d[3] > 60 && d[(w - 1) * 4 + 3] > 60;
    if (opaque) return { cx:.5, top:.02, haut:.96, opaque:true };
    return { cx: n ? sx / n / w : .5, top: top / h, haut: hs / h };
  }
  function nomDe(n){
    var t = String(n || '').trim().split(/\s+/);
    if (t.length < 2) return { pre:'', fam:(t[0] || '').toUpperCase() };
    return { pre: t.slice(0, -1).join(' '), fam: t[t.length - 1].toUpperCase() };
  }
  function arrondi(x, a, b, l, h, r){
    x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + l, b, a + l, b + h, r); x.arcTo(a + l, b + h, a, b + h, r);
    x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + l, b, r); x.closePath();
  }
  // une taille de police qui tient dans une largeur
  function ajuster(x, txt, police, max, larg){
    x.font = police.replace('{t}', max); var m = x.measureText(txt).width;
    return m <= larg ? max : Math.max(10, Math.floor(max * larg / m));
  }
  /* LES LETTRES MONTENT DANS LEUR LIGNE. Chaque lettre part sous la
     ligne et remonte ; la ligne la coupe au ras (clip) : c'est la fente,
     le meme geste que sur le site. */
  function montant(x, txt, gx, by, police, t, depart, ecart, remplir, alignement){
    if (!txt) return 0;
    x.font = police; x.textBaseline = 'alphabetic';
    var larg = x.measureText(txt).width, taillePx = parseFloat(police.match(/(\d+(?:\.\d+)?)px/)[1]);
    var dx = alignement === 'centre' ? gx - larg / 2 : gx;
    x.save();
    x.beginPath(); x.rect(dx - 20, by - taillePx * 1.05, larg + 40, taillePx * 1.32); x.clip();
    x.fillStyle = typeof remplir === 'function' ? remplir(dx, larg, by, taillePx) : remplir;
    var cur = dx;
    for (var k = 0; k < txt.length; k++){
      var ch = txt.charAt(k), w = x.measureText(ch).width;
      var e = sortie(phase(t, depart + k * ecart, .7));
      if (e > 0) x.fillText(ch, cur, by + (1 - e) * taillePx * 1.15);
      cur += w;
    }
    x.restore();
    return larg;
  }
  /* UN BUSTE DANS UN CADRE. `part` : la part de la silhouette qui entre
     dans le cadre, de la tete vers le bas ; `marge` : l'air laisse
     au-dessus de la tete (le haut de la tete a 8 % du bord : les
     cheveux et les bandeaux ne sont plus coupes). Une source qui deborde
     de l'image est rognee par le navigateur, proportionnellement. */
  function buste(x, im, v, bx, by, bw, bh, part, marge){
    var iw = im.naturalWidth, ih = im.naturalHeight;
    var cH = Math.max(20, v.haut * ih * part), cW = cH * bw / bh;
    if (cW > iw * .92){ cW = iw * .92; cH = cW * bh / bw; }
    var sx = Math.min(Math.max(0, v.cx * iw - cW / 2), iw - cW), sy = v.top * ih - cH * marge;
    x.drawImage(im, sx, sy, cW, cH, bx, by, bw, bh);
  }
  // un nombre qui se compte : « 1,78 m » passe par 0,00 m, 0,45 m...
  function compte(txt, e){
    var m = /^(\d+(?:[.,]\d+)?)(.*)$/.exec(String(txt || ''));
    if (!m) return String(txt || '');
    var dec = (m[1].split(/[.,]/)[1] || '').length;
    return (parseFloat(m[1].replace(',', '.')) * e).toFixed(dec).replace('.', ',') + m[2];
  }

  /* ---------------------------------------------------------- le fond */
  // w x h : la taille de sortie (la planche 4:5 se pose dessus en story)
  function fondPret(w, h){
    w = w || W; h = h || H;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, w * .35, h);
    g.addColorStop(0, '#1C6038'); g.addColorStop(.5, '#10412A'); g.addColorStop(1, '#082417');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    var r = x.createRadialGradient(w * .72, h * .12, 0, w * .72, h * .12, w * .9);
    r.addColorStop(0, 'rgba(168,217,59,.16)'); r.addColorStop(1, 'rgba(168,217,59,0)');
    x.fillStyle = r; x.fillRect(0, 0, w, h);
    // la trame du site, tres pale, en biais
    x.save(); x.globalAlpha = .05; x.strokeStyle = CREME; x.lineWidth = 2;
    for (var k = -h; k < w + h; k += 22){ x.beginPath(); x.moveTo(k, 0); x.lineTo(k - h * .4, h); x.stroke(); }
    x.restore();
    // le grain : une image de retransmission n'a jamais un fond lisse
    var bruit = x.getImageData(0, 0, w, h), d = bruit.data;
    for (var i = 0; i < d.length; i += 4){ var v = (Math.random() - .5) * 18; d[i] += v; d[i + 1] += v; d[i + 2] += v; }
    x.putImageData(bruit, 0, 0);
    return c;
  }
  // sans F, la planche reste transparente : le fond est pose dessous, a
  // la taille de sortie (la story), et clearRect respecte le volet (clip)
  function fond(x, F, T, total, w, h){
    w = w || W; h = h || H;
    if (!F){ x.clearRect(0, 0, w, h); return; }
    var s = 1 + .035 * (T / total);
    x.save(); x.translate(w / 2, h / 2); x.scale(s, s); x.translate(-w / 2, -h / 2);
    x.drawImage(F, 0, 0); x.restore();
  }

  /* =================================================================
     LA LISTE
     ================================================================= */
  function sceneTitre(d, A){
    return { duree: 2.8, dessiner: function(x, t){
      var e = sortie(phase(t, 0, .65));
      var cw = 900, ch = 1060, cx0 = (W - cw) / 2, cy0 = 130;
      x.save(); x.globalAlpha = e;
      x.translate(W / 2, cy0 + ch / 2); x.scale(.95 + .05 * e, .95 + .05 * e); x.translate(-W / 2, -(cy0 + ch / 2));
      arrondi(x, cx0, cy0, cw, ch, 44); x.fillStyle = 'rgba(5,24,15,.9)'; x.fill();
      x.strokeStyle = 'rgba(243,239,230,.07)'; x.lineWidth = 2; x.stroke();
      x.restore();
      // le blason
      if (A.logo){
        var eb = sortie(phase(t, .15, .7)), tb = 170 * (.7 + .3 * eb);
        x.save(); x.globalAlpha = eb; x.drawImage(A.logo, W / 2 - tb / 2, cy0 + 90 + (170 - tb) / 2, tb, tb); x.restore();
      }
      // la ligne du dessus
      x.save(); x.globalAlpha = sortie(phase(t, .3, .6)); x.fillStyle = VERT; x.textAlign = 'center';
      x.font = '700 30px ' + TEXTE; espace(x, 6);
      x.fillText(String(d.sur || 'Baobabs Basket Club').toUpperCase(), W / 2, cy0 + 330); x.restore();
      espace(x, 0);
      // le titre, sur deux lignes : la premiere dans le degrade du vert, la seconde en creme
      var mots = String(d.titre || 'Cinq majeur').toUpperCase().split(/\s+/);
      var l1 = mots.length > 1 ? mots[0] : '', l2 = mots.length > 1 ? mots.slice(1).join(' ') : mots[0];
      var tt = Math.min(ajuster(x, l1, '900 {t}px ' + TITRE, 224, 760), ajuster(x, l2, '900 {t}px ' + TITRE, 224, 760));
      var y1 = cy0 + 330 + tt * .98, y2 = y1 + tt * .9;
      var degrade = function(gx, larg){ var g = x.createLinearGradient(gx, 0, gx + larg, 0); g.addColorStop(0, VERT); g.addColorStop(1, VERT_PALE); return g; };
      if (l1) montant(x, l1, W / 2, y1, '900 ' + tt + 'px ' + TITRE, t, .35, .035, degrade, 'centre');
      montant(x, l2, W / 2, l1 ? y2 : y1, '900 ' + tt + 'px ' + TITRE, t, .48, .035, CREME, 'centre');
      // les infos : l'adversaire, la date, la salle (ou l'evenement)
      var yi = (l1 ? y2 : y1) + 84;
      (d.infos || []).slice(0, 3).forEach(function(l, k){
        var ei = sortie(phase(t, .8 + k * .09, .6));
        x.save(); x.globalAlpha = ei; x.textAlign = 'center';
        x.fillStyle = k === 0 ? CREME : GRIS; x.font = (k === 0 ? '800 40px ' : '600 32px ') + TEXTE;
        x.fillText(String(l), W / 2, yi + k * 50 + (1 - ei) * 16); x.restore();
      });
    } };
  }
  function scenePage(d, A, lignes, n0, nTot){
    var N = lignes.length;
    var haut0 = 200, bas0 = 1230, hr = (bas0 - haut0) / N, g = 12;
    var px = 50, pw = 480, lx = 550, lw = 480;
    return { duree: 3.6 + N * .2, dessiner: function(x, t){
      // l'en-tete : le blason, et ce qu'on annonce
      var eh = sortie(phase(t, .1, .6));
      x.save(); x.globalAlpha = eh;
      if (A.logo) x.drawImage(A.logo, 50, 64, 96, 96);
      x.fillStyle = VERT; x.font = '700 26px ' + TEXTE; espace(x, 5);
      x.fillText(String(d.sur || 'Baobabs Basket Club').toUpperCase(), 170, 98);
      espace(x, 0);
      x.fillStyle = CREME; x.font = '900 64px ' + TITRE;
      x.fillText(String(d.titre || '').toUpperCase() + (nTot > 1 ? '  ' + (n0 + 1) + '/' + nTot : ''), 170, 156);
      if (d.adversaire && A.adv){ x.drawImage(A.adv, W - 50 - 84, 70, 84, 84); }
      x.restore();
      // le cadre de la liste
      var ec = sortie(phase(t, .2, .8));
      x.save(); x.globalAlpha = ec; x.strokeStyle = VERT; x.lineWidth = 3;
      x.strokeRect(lx, haut0, lw, bas0 - haut0);
      x.restore();
      lignes.forEach(function(p, r){
        var y0 = haut0 + r * hr, dep = .25 + r * .09, bh = hr - g, by = y0 + g / 2;
        // LA BANDE DU VISAGE : un vert eclaire, et une lumiere derriere la
        // tete. Sur le vert presque noir d'avant, les visages s'y perdaient.
        var ef = sortie(phase(t, dep, .9));
        x.save();
        x.beginPath(); x.rect(px, by, pw, bh); x.clip();
        x.globalAlpha = borne(ef * 1.8);
        var gb = x.createLinearGradient(0, by, 0, by + bh);
        gb.addColorStop(0, '#236640'); gb.addColorStop(1, '#0D2F1D');
        x.fillStyle = gb; x.fillRect(px, by, pw, bh);
        var lum = x.createRadialGradient(px + pw / 2, by + bh * .42, 0, px + pw / 2, by + bh * .42, bh * 1.05);
        lum.addColorStop(0, 'rgba(227,245,180,.34)'); lum.addColorStop(1, 'rgba(227,245,180,0)');
        x.fillStyle = lum; x.fillRect(px, by, pw, bh);
        var im = A.photos[p.__k];
        if (im){
          var zoom = 1.08 - .08 * ef + .03 * phase(t, 1.2, 3.5);
          x.globalAlpha = borne(ef * 1.6);
          x.translate(px + pw / 2 + (1 - ef) * 60, by + bh / 2); x.scale(zoom, zoom);
          // jusqu'aux epaules : la tete fait les deux tiers de la bande
          buste(x, im, A.visages[p.__k], -pw / 2, -bh / 2, pw, bh, .30, .08);
        }
        x.restore();
        // LA RANGEE DE LA LISTE
        if (r > 0){ x.save(); x.globalAlpha = ec * .5; x.strokeStyle = VERT; x.lineWidth = 2;
          x.beginPath(); x.moveTo(lx, y0); x.lineTo(lx + lw, y0); x.stroke(); x.restore(); }
        var cy = y0 + hr / 2, rr = Math.min(42, hr * .19), ecr = sortie(phase(t, dep + .1, .5));
        if (p.no !== '' && p.no != null){
          x.save(); x.globalAlpha = ecr; x.translate(lx + 28 + rr, cy); x.scale(.55 + .45 * ecr, .55 + .45 * ecr);
          x.beginPath(); x.arc(0, 0, rr, 0, Math.PI * 2); x.strokeStyle = VERT; x.lineWidth = 3; x.stroke();
          x.fillStyle = CREME; x.textAlign = 'center'; x.textBaseline = 'middle';
          x.font = '800 ' + Math.round(rr * .95) + 'px ' + TEXTE; x.fillText(String(p.no), 0, 2); x.restore();
        }
        var tx = lx + 28 + rr * 2 + 22, larg = lx + lw - tx - 22;
        var nm = nomDe(p.nom);
        var tp = Math.min(34, Math.round(hr * .16)), tf = ajuster(x, nm.fam, '900 {t}px ' + TITRE, Math.min(96, Math.round(hr * .4)), larg);
        montant(x, nm.pre, tx, cy - tf * .32, '600 ' + ajuster(x, nm.pre, '600 {t}px ' + TEXTE, tp, larg) + 'px ' + TEXTE, t, dep + .12, .015, VERT);
        var lf = montant(x, nm.fam, tx, cy + tf * .62, '900 ' + tf + 'px ' + TITRE, t, dep + .18, .022, CREME);
        if (p.cap){
          var ek = sortie(phase(t, dep + .5, .5));
          x.save(); x.globalAlpha = ek; x.fillStyle = VERT;
          var kx = Math.min(tx + (lf || 0) + 14, lx + lw - 44);
          x.fillRect(kx, cy + tf * .62 - tf * .55, 34, 34);
          x.fillStyle = '#0A2215'; x.font = '800 22px ' + TEXTE; x.textAlign = 'center'; x.textBaseline = 'middle';
          x.fillText('C', kx + 17, cy + tf * .62 - tf * .55 + 18); x.restore();
        }
      });
      // le pied : ce que la carte titre disait, en une ligne
      var ep = sortie(phase(t, .6, .6));
      x.save(); x.globalAlpha = ep; x.fillStyle = GRIS; x.font = '600 28px ' + TEXTE;
      x.fillText((d.infos || []).slice(0, 2).join('  ·  '), 50, 1296); x.restore();
    } };
  }
  function sceneFin(d, A){
    return { duree: 2.4, dessiner: function(x, t){
      var eb = sortie(phase(t, .1, .8)), tb = 300 * (.8 + .2 * eb);
      if (A.logo){ x.save(); x.globalAlpha = eb; x.drawImage(A.logo, W / 2 - tb / 2, 380 + (300 - tb) / 2, tb, tb); x.restore(); }
      montant(x, 'BAOBABS', W / 2, 850, '900 150px ' + TITRE, t, .3, .03, CREME, 'centre');
      montant(x, 'BASKET CLUB', W / 2, 960, '900 96px ' + TITRE, t, .42, .025, VERT, 'centre');
      var ei = sortie(phase(t, .8, .6));
      x.save(); x.globalAlpha = ei; x.fillStyle = GRIS; x.textAlign = 'center'; x.font = '600 32px ' + TEXTE;
      x.fillText((d.infos || []).slice(0, 2).join('  ·  '), W / 2, 1060); x.restore();
    } };
  }

  /* =================================================================
     LA PRESENTATION : les actes du site, en vertical
     ================================================================= */
  // la bande du haut, identique d'un acte a l'autre : le volet la
  // recouvre par elle-meme, elle ne bouge donc pas entre deux joueuses
  function bandeau(x, d, A, droite){
    if (A.logo) x.drawImage(A.logo, 50, 44, 76, 76);
    x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    x.fillStyle = VERT; x.font = '700 21px ' + TEXTE; espace(x, 5);
    x.fillText(String(d.sur || 'Baobabs Basket Club').toUpperCase(), 146, 74); espace(x, 0);
    x.fillStyle = CREME; x.font = '900 40px ' + TITRE;
    x.fillText(String(d.titre || '').toUpperCase(), 146, 114);
    if (droite){
      x.textAlign = 'right';
      x.fillStyle = GRIS; x.font = '700 30px ' + TITRE; x.fillText(' / ' + droite[1], W - 50, 108);
      var l = x.measureText(' / ' + droite[1]).width;
      x.fillStyle = CREME; x.font = '900 52px ' + TITRE; x.fillText(droite[0], W - 50 - l, 108);
      x.textAlign = 'left';
    }
  }
  // la barre en segments : un par acte, celui en cours se remplit
  function segments(x, s, t){
    if (!s.nb) return;
    var x0 = 50, larg = W - 100, ecart = 8, l = (larg - ecart * (s.nb - 1)) / s.nb, y = 1300;
    for (var k = 0; k < s.nb; k++){
      var gx = x0 + k * (l + ecart);
      x.fillStyle = k < s.idx ? 'rgba(243,239,230,.55)' : 'rgba(243,239,230,.14)';
      x.fillRect(gx, y, l, 5);
      if (k === s.idx){ x.fillStyle = VERT; x.fillRect(gx, y, l * borne(t / s.duree), 5); }
    }
  }
  // la joueuse (ou le chef de delegation) : en pied, la tete en haut du
  // cadre ; une photo non detouree se pose dans un cadre arrondi
  function personne(x, im, v, t){
    if (!im) return;
    var ep = sortie(phase(t, .08, 1.0));
    var z = 1.05 - .05 * ep + .025 * phase(t, 1, 2.4);
    x.save(); x.globalAlpha = borne(ep * 1.4);
    x.translate(W / 2, 700 + (1 - ep) * 90); x.scale(z, z); x.translate(-W / 2, -700);
    var iw = im.naturalWidth, ih = im.naturalHeight;
    if (v.opaque){
      var cw = 720, ch = 860, cx0 = (W - cw) / 2, cy0 = 150;
      arrondi(x, cx0, cy0, cw, ch, 30); x.save(); x.clip();
      var s = Math.max(cw / iw, ch / ih);
      x.drawImage(im, cx0 + (cw - iw * s) / 2, cy0 + Math.min(0, (ch - ih * s) * .2), iw * s, ih * s);
      x.restore();
      arrondi(x, cx0, cy0, cw, ch, 30); x.strokeStyle = 'rgba(168,217,59,.5)'; x.lineWidth = 3; x.stroke();
    } else {
      // la silhouette fait 1 180 px : la tete tient environ 230 px
      var sc = 1180 / (v.haut * ih);
      x.drawImage(im, W / 2 - v.cx * iw * sc, 150 - v.top * ih * sc, iw * sc, ih * sc);
    }
    x.restore();
  }
  function voile(x){
    var g = x.createLinearGradient(0, 640, 0, 990);
    g.addColorStop(0, 'rgba(6,25,15,0)'); g.addColorStop(.72, 'rgba(6,25,15,.9)'); g.addColorStop(1, 'rgba(6,25,15,.97)');
    x.fillStyle = g; x.fillRect(0, 640, W, H - 640);
  }
  // le role, le numero dans son cercle, le prenom, le NOM
  function identite(x, t, role, no, nom, cap){
    var er = phase(t, .42, .45);
    x.save(); x.strokeStyle = VERT; x.lineWidth = 3;
    x.beginPath(); x.moveTo(50, 924); x.lineTo(50 + 52 * quart(er), 924); x.stroke();
    x.globalAlpha = sortie(phase(t, .52, .5)); x.fillStyle = VERT; x.font = '700 24px ' + TEXTE; espace(x, 5);
    x.fillText(String(role || '').toUpperCase(), 118, 933); espace(x, 0);
    x.restore();
    var x0 = 50;
    if (no){
      var ec = phase(t, .55, .65), cx = 50 + 52, cy = 1040;
      x.save(); x.strokeStyle = VERT; x.lineWidth = 4;
      x.beginPath(); x.arc(cx, cy, 52, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * quart(ec)); x.stroke();
      x.globalAlpha = sortie(phase(t, .8, .5)); x.fillStyle = CREME; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = '800 ' + (no.length > 2 ? 38 : 50) + 'px ' + TEXTE; x.fillText(no, cx, cy + 3);
      x.restore();
      x0 = 50 + 104 + 30;
    }
    var nm = nomDe(nom), larg = W - 50 - x0;
    var tp = ajuster(x, nm.pre, '700 {t}px ' + TEXTE, 42, larg);
    var tf = ajuster(x, nm.fam, '900 {t}px ' + TITRE, 132, larg - (cap ? 60 : 0));
    // le prenom au-dessus, le NOM dessous : a 1 004 / 1 110, le haut du
    // NOM mordait sur le bas du prenom
    montant(x, nm.pre, x0, 984, '700 ' + tp + 'px ' + TEXTE, t, .62, .022, VERT);
    var lf = montant(x, nm.fam, x0, 1116, '900 ' + tf + 'px ' + TITRE, t, .72, .03, CREME);
    if (cap){
      var ek = sortie(phase(t, 1.1, .5));
      x.save(); x.globalAlpha = ek; x.fillStyle = VERT;
      x.fillRect(x0 + lf + 16, 1116 - tf * .66, 44, 44);
      x.fillStyle = '#0A2215'; x.font = '800 28px ' + TEXTE; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('C', x0 + lf + 38, 1116 - tf * .66 + 23); x.restore();
    }
  }
  function sceneJoueuse(d, A, p, k, n){
    return { duree: 3.3, dessiner: function(x, t){
      var im = A.photos[p.__k], v = A.visages[p.__k];
      var no = (p.no === '' || p.no == null) ? '' : String(p.no);
      // la lumiere derriere la joueuse
      x.save(); x.globalAlpha = sortie(phase(t, .1, 1.2));
      var r = x.createRadialGradient(W / 2, 480, 0, W / 2, 480, 580);
      r.addColorStop(0, 'rgba(168,217,59,.26)'); r.addColorStop(.55, 'rgba(168,217,59,.06)'); r.addColorStop(1, 'rgba(168,217,59,0)');
      x.fillStyle = r; x.fillRect(0, 0, W, H); x.restore();
      // le numero geant, en filet, qui glisse derriere elle
      if (no){
        var en = sortie(phase(t, .2, 1.1));
        x.save(); x.globalAlpha = en; x.font = '900 720px ' + TITRE; x.textAlign = 'center';
        x.lineWidth = 3; x.strokeStyle = 'rgba(168,217,59,.24)';
        x.strokeText(no, W / 2 - (1 - en) * 160, 860); x.restore();
      }
      personne(x, im, v, t);
      voile(x);
      bandeau(x, d, A, [String(k + 1).padStart(2, '0'), String(n).padStart(2, '0')]);
      identite(x, t, p.role || (p.cap ? 'Capitaine' : d.genre === 'cinq' ? 'Titulaire' : 'Sélectionnée'), no, p.nom, p.cap);
      // LES FAITS : une case chacun, les nombres se comptent
      var faits = [];
      if (p.poste) faits.push(['Poste', String(p.poste), true]);
      if (p.taille){ var tl = String(p.taille).trim().replace(/\s*m\s*$/i, ''); if (tl) faits.push(['Taille', tl + ' m']); }
      // une date de naissance mal saisie donne 0 ou moins : on n'ecrit rien
      if (Number(p.age) > 0) faits.push(['Âge', Number(p.age) + ' ans']);
      if (faits.length){
        var y = 1150, hb = 112, lb = (W - 100) / faits.length;
        var eb = sortie(phase(t, .95, .6));
        x.save(); x.globalAlpha = eb; x.strokeStyle = 'rgba(168,217,59,.55)'; x.lineWidth = 2;
        x.strokeRect(50, y, W - 100, hb);
        for (var s = 1; s < faits.length; s++){ x.beginPath(); x.moveTo(50 + s * lb, y + 16); x.lineTo(50 + s * lb, y + hb - 16); x.stroke(); }
        x.restore();
        faits.forEach(function(f, q){
          var ef = sortie(phase(t, 1.05 + q * .12, .55)), gx = 50 + q * lb + 26;
          x.save(); x.globalAlpha = ef;
          x.fillStyle = GRIS; x.font = '700 18px ' + TEXTE; espace(x, 3);
          x.fillText(f[0].toUpperCase(), gx, y + 40 + (1 - ef) * 10); espace(x, 0);
          var val = f[2] ? f[1].toUpperCase() : compte(f[1], cube(phase(t, 1.1 + q * .12, .8)));
          x.fillStyle = f[2] ? VERT : CREME;
          x.font = '800 ' + ajuster(x, f[2] ? f[1].toUpperCase() : f[1], '800 {t}px ' + TITRE, 54, lb - 52) + 'px ' + TITRE;
          x.fillText(val, gx, y + 94 + (1 - ef) * 14);
          x.restore();
        });
      }
      segments(x, this, t);
    } };
  }
  // LE GENERIQUE : le blason dans son anneau, le titre, un trait, une ligne
  function sceneGenerique(d, A){
    return { duree: 2.9, dessiner: function(x, t){
      var e = sortie(phase(t, 0, .7)), cw = 940, ch = 680, cx0 = (W - cw) / 2, cy0 = 330;
      x.save(); x.globalAlpha = e;
      x.translate(W / 2, cy0 + ch / 2); x.scale(.95 + .05 * e, .95 + .05 * e); x.translate(-W / 2, -(cy0 + ch / 2));
      arrondi(x, cx0, cy0, cw, ch, 36); x.fillStyle = 'rgba(5,24,15,.88)'; x.fill();
      x.strokeStyle = 'rgba(243,239,230,.07)'; x.lineWidth = 2; x.stroke();
      x.restore();
      var cy = cy0 + 150, ea = phase(t, .15, .8);
      x.save(); x.strokeStyle = VERT; x.lineWidth = 4;
      x.beginPath(); x.arc(W / 2, cy, 100, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * quart(ea)); x.stroke(); x.restore();
      if (A.logo){
        var eb = sortie(phase(t, .3, .7)), tb = 168 * (.75 + .25 * eb);
        x.save(); x.globalAlpha = eb; x.drawImage(A.logo, W / 2 - tb / 2, cy - tb / 2, tb, tb); x.restore();
      }
      x.save(); x.globalAlpha = sortie(phase(t, .4, .6)); x.fillStyle = VERT; x.textAlign = 'center';
      x.font = '700 26px ' + TEXTE; espace(x, 6);
      x.fillText(String(d.sur || 'Baobabs Basket Club').toUpperCase(), W / 2, cy0 + 322); espace(x, 0); x.restore();
      var titre = String(d.titre || '').toUpperCase(), tt = ajuster(x, titre, '900 {t}px ' + TITRE, 176, 840);
      montant(x, titre, W / 2, cy0 + 322 + tt * .95, '900 ' + tt + 'px ' + TITRE, t, .45, .035, CREME, 'centre');
      var yt = cy0 + 322 + tt * .95 + 52, et = quart(phase(t, .9, .6));
      x.save(); x.strokeStyle = VERT; x.lineWidth = 3;
      x.beginPath(); x.moveTo(W / 2 - 200 * et, yt); x.lineTo(W / 2 + 200 * et, yt); x.stroke(); x.restore();
      if (d.contre){
        var ec = sortie(phase(t, 1.05, .6));
        x.save(); x.globalAlpha = ec; x.fillStyle = VERT; x.textAlign = 'center';
        x.font = '600 ' + ajuster(x, d.contre, '600 {t}px ' + TEXTE, 34, 820) + 'px ' + TEXTE;
        x.fillText(d.contre, W / 2, yt + 66 + (1 - ec) * 12); x.restore();
      }
      segments(x, this, t);
    } };
  }
  // L'AFFICHE DU MATCH : les deux blasons entrent par les cotes
  function sceneDuel(d, A){
    return { duree: 3.2, dessiner: function(x, t){
      var m = d.match || {}, adv = d.adversaire || {};
      x.save(); x.globalAlpha = sortie(phase(t, .2, .6)); x.fillStyle = VERT; x.textAlign = 'center';
      x.font = '700 26px ' + TEXTE; espace(x, 6);
      x.fillText(String(m.competition || 'Prochain match').toUpperCase(), W / 2, 330); espace(x, 0); x.restore();
      var e = sortie(phase(t, .25, .95)), tb = 290, cy = 560;
      var ecusson = function(im, nom, cx){
        x.save();
        x.beginPath(); x.arc(cx, cy, tb / 2 + 14, 0, Math.PI * 2); x.fillStyle = 'rgba(5,24,15,.75)'; x.fill();
        x.strokeStyle = 'rgba(168,217,59,.5)'; x.lineWidth = 3; x.stroke();
        if (im){
          var s = Math.min(tb / im.naturalWidth, tb / im.naturalHeight);
          x.beginPath(); x.arc(cx, cy, tb / 2, 0, Math.PI * 2); x.clip();
          x.drawImage(im, cx - im.naturalWidth * s / 2, cy - im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s);
        } else {
          x.fillStyle = CREME; x.font = '900 150px ' + TITRE; x.textAlign = 'center'; x.textBaseline = 'middle';
          x.fillText(String(nom || '?').trim().charAt(0).toUpperCase(), cx, cy + 8);
        }
        x.restore();
      };
      x.save(); x.globalAlpha = borne(e * 1.5);
      ecusson(A.logo, 'Baobabs', 270 - (1 - e) * 420);
      ecusson(A.adv, adv.nom, W - 270 + (1 - e) * 420);
      x.restore();
      var ev = sortie(phase(t, .75, .5));
      x.save(); x.globalAlpha = ev; x.translate(W / 2, cy); x.scale(.6 + .4 * ev, .6 + .4 * ev);
      x.fillStyle = VERT; x.font = '900 104px ' + TITRE; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(m.dom === false ? 'CHEZ' : 'VS', 0, 6); x.restore();
      montant(x, 'BAOBABS', 270, 800, '900 ' + ajuster(x, 'BAOBABS', '900 {t}px ' + TITRE, 64, 400) + 'px ' + TITRE, t, .85, .025, CREME, 'centre');
      var na = String(adv.nom || 'Adversaire').toUpperCase();
      montant(x, na, W - 270, 800, '900 ' + ajuster(x, na, '900 {t}px ' + TITRE, 64, 420) + 'px ' + TITRE, t, .9, .025, CREME, 'centre');
      [m.quand, m.lieu].filter(Boolean).forEach(function(l, k){
        var el = sortie(phase(t, 1.15 + k * .1, .6));
        x.save(); x.globalAlpha = el; x.textAlign = 'center'; x.fillStyle = k ? GRIS : CREME;
        x.font = (k ? '600 32px ' : '700 38px ') + TEXTE;
        x.fillText(String(l), W / 2, 930 + k * 56 + (1 - el) * 14); x.restore();
      });
      segments(x, this, t);
    } };
  }
  // L'AFFICHE D'UN EVENEMENT : l'affiche, le titre, les nations
  function sceneEvenement(d, A){
    return { duree: 3.5, dessiner: function(x, t){
      var ev = d.evenement || {}, im = A.affiche, y = 250;
      if (im){
        var ea = sortie(phase(t, .15, .9));
        var s = Math.min(560 / im.naturalHeight, 620 / im.naturalWidth), aw = im.naturalWidth * s, ah = im.naturalHeight * s;
        x.save(); x.globalAlpha = borne(ea * 1.4);
        x.translate(W / 2, 170 + ah / 2 + (1 - ea) * 70); x.rotate((1 - ea) * -.05);
        x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 50; x.shadowOffsetY = 20;
        arrondi(x, -aw / 2, -ah / 2, aw, ah, 16); x.fillStyle = NUIT; x.fill(); x.shadowColor = 'transparent';
        x.clip(); x.drawImage(im, -aw / 2, -ah / 2, aw, ah);
        x.restore();
        y = 170 + ah + 90;
      } else y = 480;
      x.save(); x.globalAlpha = sortie(phase(t, .45, .5)); x.fillStyle = VERT; x.textAlign = 'center';
      x.font = '700 26px ' + TEXTE; espace(x, 6);
      x.fillText(String(ev.kicker || 'Tournoi').toUpperCase(), W / 2, y); espace(x, 0); x.restore();
      var tt = String(ev.titre || '').toUpperCase(), ft = ajuster(x, tt, '900 {t}px ' + TITRE, 118, 960);
      montant(x, tt, W / 2, y + ft * .95, '900 ' + ft + 'px ' + TITRE, t, .55, .03, CREME, 'centre');
      var yq = y + ft * .95 + 60, q = [ev.dates, ev.lieu].filter(Boolean).join('  ·  ');
      if (q){
        var eq = sortie(phase(t, .9, .5));
        x.save(); x.globalAlpha = eq; x.fillStyle = CREME; x.textAlign = 'center';
        x.font = '600 ' + ajuster(x, q, '600 {t}px ' + TEXTE, 32, 960) + 'px ' + TEXTE;
        x.fillText(q, W / 2, yq); x.restore();
      }
      // les nations, en pastilles : la notre en plein
      var ns = (ev.nations || []).map(function(n){ return String(n).trim(); }).filter(Boolean);
      if (ns.length){
        x.font = '700 22px ' + TEXTE; espace(x, 2);
        var rangs = [[]], lr = 0, max = 980;
        ns.forEach(function(n){
          var lib = n.replace(/^\*/, '').toUpperCase(), w = x.measureText(lib).width + 44;
          if (lr + w > max && rangs[rangs.length - 1].length){ rangs.push([]); lr = 0; }
          rangs[rangs.length - 1].push({ lib: lib, w: w, nous: n.charAt(0) === '*' }); lr += w + 12;
        });
        var k = 0;
        rangs.forEach(function(rg, ri){
          var tot = rg.reduce(function(a, c){ return a + c.w; }, 0) + 12 * (rg.length - 1), gx = (W - tot) / 2, gy = yq + 44 + ri * 66;
          rg.forEach(function(c){
            var ec = sortie(phase(t, 1.05 + k * .07, .45)); k++;
            x.save(); x.globalAlpha = ec;
            arrondi(x, gx, gy + (1 - ec) * 12, c.w, 50, 6);
            if (c.nous){ x.fillStyle = VERT; x.fill(); } else { x.strokeStyle = 'rgba(243,239,230,.35)'; x.lineWidth = 2; x.stroke(); }
            x.fillStyle = c.nous ? '#0A2215' : CREME; x.textBaseline = 'middle';
            x.fillText(c.lib, gx + 22, gy + 26 + (1 - ec) * 12);
            x.restore(); gx += c.w + 12;
          });
        });
        espace(x, 0);
      }
      segments(x, this, t);
    } };
  }
  // LE GROUPE : toutes les joueuses d'un coup, en bandes
  function sceneGroupe(d, A, js){
    var n = js.length, rangs = n <= 6 ? 1 : 2, cols = Math.ceil(n / rangs);
    var zone = W - 80, ecart = 12, sw = (zone - (cols - 1) * ecart) / cols;
    var hNom = 58, hRang = rangs === 1 ? Math.min(820, sw * 3.4 + hNom) : 440;
    var sh = hRang - hNom - (rangs === 2 ? 14 : 0), y0 = rangs === 1 ? 380 + (820 - hRang) / 2 : 380;
    // deux GAYE dans le meme groupe : l'initiale du prenom les separe
    var fams = js.map(function(p){ return nomDe(p.nom); }), vus = {};
    fams.forEach(function(f){ vus[f.fam] = (vus[f.fam] || 0) + 1; });
    var etiq = fams.map(function(f){ return vus[f.fam] > 1 && f.pre ? f.pre.charAt(0).toUpperCase() + '. ' + f.fam : f.fam; });
    return { duree: 4.2, dessiner: function(x, t){
      x.save(); x.globalAlpha = sortie(phase(t, .2, .6)); x.fillStyle = VERT; x.textAlign = 'center';
      x.font = '700 26px ' + TEXTE; espace(x, 6);
      x.fillText(String(d.groupeSur || d.titre || '').toUpperCase(), W / 2, 190); espace(x, 0); x.restore();
      var tt = String(d.groupeTitre || (d.genre === 'cinq' ? 'Le cinq' : 'Le groupe')).toUpperCase();
      montant(x, tt, W / 2, 320, '900 ' + ajuster(x, tt, '900 {t}px ' + TITRE, 140, 960) + 'px ' + TITRE, t, .3, .035, CREME, 'centre');
      js.forEach(function(p, k){
        var r = rangs === 2 && k >= cols ? 1 : 0, c = r ? k - cols : k;
        var dansRang = r ? n - cols : Math.min(n, cols);
        var gx0 = (W - (dansRang * sw + (dansRang - 1) * ecart)) / 2;
        var gx = gx0 + c * (sw + ecart), gy = y0 + r * hRang;
        var e = sortie(phase(t, .45 + k * .06, .8));
        // la bande se leve depuis le bas
        x.save();
        x.beginPath(); x.rect(gx, gy + sh * (1 - e), sw, sh * e); x.clip();
        var gb = x.createLinearGradient(0, gy, 0, gy + sh);
        gb.addColorStop(0, '#236640'); gb.addColorStop(1, '#0D2F1D');
        x.fillStyle = gb; x.fillRect(gx, gy, sw, sh);
        var im = A.photos[p.__k];
        if (im) buste(x, im, A.visages[p.__k], gx, gy + (1 - e) * 40, sw, sh, rangs === 1 ? .9 : .62, .05);
        x.restore();
        var en = sortie(phase(t, .75 + k * .06, .45));
        x.save(); x.globalAlpha = en;
        if (p.no !== '' && p.no != null){
          var rr = Math.min(24, sw * .16);
          x.beginPath(); x.arc(gx + rr + 8, gy + sh - rr - 8, rr, 0, Math.PI * 2); x.fillStyle = 'rgba(6,25,15,.85)'; x.fill();
          x.strokeStyle = VERT; x.lineWidth = 2; x.stroke();
          x.fillStyle = CREME; x.font = '800 ' + Math.round(rr * .95) + 'px ' + TEXTE; x.textAlign = 'center'; x.textBaseline = 'middle';
          x.fillText(String(p.no), gx + rr + 8, gy + sh - rr - 6);
        }
        var fam = etiq[k];
        x.fillStyle = CREME; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
        x.font = '800 ' + ajuster(x, fam, '800 {t}px ' + TITRE, 30, sw - 6) + 'px ' + TITRE;
        x.fillText(fam, gx + sw / 2, gy + sh + 38);
        x.restore();
      });
      segments(x, this, t);
    } };
  }
  // LE BANC : les noms, avec leur numero. Le bloc se centre dans
  // l'image : a quatre noms poses sous le titre, la moitie basse etait vide.
  function sceneBanc(d, A, banc){
    var deux = banc.length > 8, parCol = deux ? Math.ceil(banc.length / 2) : banc.length;
    var pas = deux ? 86 : 100, tNo = deux ? 56 : 70, tNom = deux ? 38 : 48, lNom = deux ? 330 : 640;
    // du haut de la ligne du dessus (220) au pied du dernier nom
    var haut = 500 + (parCol - 1) * pas + 14 - 220, dy = Math.max(0, (1280 - haut) / 2 - 220);
    return { duree: 3.2, dessiner: function(x, t){
      x.save(); x.globalAlpha = sortie(phase(t, .2, .6)); x.fillStyle = VERT; x.textAlign = 'center';
      x.font = '700 26px ' + TEXTE; espace(x, 6);
      x.fillText('ELLES ENTRENT AUSSI', W / 2, 250 + dy); espace(x, 0); x.restore();
      montant(x, 'LE BANC', W / 2, 390 + dy, '900 150px ' + TITRE, t, .3, .035, CREME, 'centre');
      // une seule colonne : centree sur le nom le plus long
      var gx1 = 250;
      if (!deux){
        var lg = 0;
        banc.forEach(function(p){
          var nm = String(p.nom || ''); x.font = '700 ' + ajuster(x, nm, '700 {t}px ' + TEXTE, tNom, lNom) + 'px ' + TEXTE;
          lg = Math.max(lg, x.measureText(nm).width);
        });
        gx1 = Math.round((W - (100 + lg)) / 2) - 16;
      }
      banc.forEach(function(p, k){
        var col = deux && k >= parCol ? 1 : 0, r = col ? k - parCol : k;
        var gx = deux ? (col ? 580 : 90) : gx1, gy = 500 + dy + r * pas;
        var e = sortie(phase(t, .5 + k * .07, .5)), nm = String(p.nom || '');
        x.save(); x.globalAlpha = e; x.translate((1 - e) * -30, 0);
        x.fillStyle = VERT; x.font = '900 ' + tNo + 'px ' + TITRE; x.textAlign = 'right';
        x.fillText(p.no === '' || p.no == null ? '·' : String(p.no), gx + 80, gy);
        x.fillStyle = CREME; x.textAlign = 'left';
        x.font = '700 ' + ajuster(x, nm, '700 {t}px ' + TEXTE, tNom, lNom) + 'px ' + TEXTE;
        x.fillText(nm, gx + 106, gy - 8);
        x.restore();
      });
      segments(x, this, t);
    } };
  }
  // L'ENCADREMENT : le chef de delegation en grand, les autres en liste
  function sceneStaff(d, A){
    return { duree: 3.6, dessiner: function(x, t){
      var s = d.staff || {}, ch = s.chef || {}, au = (s.autres || []).slice(0, 3);
      x.save(); x.globalAlpha = sortie(phase(t, .1, 1.2));
      var r = x.createRadialGradient(W / 2, 480, 0, W / 2, 480, 580);
      r.addColorStop(0, 'rgba(168,217,59,.22)'); r.addColorStop(1, 'rgba(168,217,59,0)');
      x.fillStyle = r; x.fillRect(0, 0, W, H); x.restore();
      personne(x, A.chef, A.chefV, t);
      voile(x);
      bandeau(x, d, A, null);
      identite(x, t, ch.fonction || 'Encadrement', '', ch.nom, false);
      au.forEach(function(a, k){
        var e = sortie(phase(t, 1.0 + k * .12, .5)), y = 1146 + k * 66;
        if (y > 1250) return;
        x.save(); x.globalAlpha = e;
        x.strokeStyle = 'rgba(168,217,59,.5)'; x.lineWidth = 2; x.strokeRect(50, y, W - 100, 56);
        x.fillStyle = GRIS; x.font = '700 18px ' + TEXTE; espace(x, 3);
        x.fillText(String(a.fonction || 'Staff').toUpperCase(), 74, y + 35); espace(x, 0);
        x.fillStyle = CREME; x.textAlign = 'right'; x.font = '700 28px ' + TEXTE;
        x.fillText(String(a.nom || ''), W - 74, y + 38);
        x.restore();
      });
      segments(x, this, t);
    } };
  }

  /* ---------------------------------------------------------- le volet */
  var BANDES = 6, LARGEUR_BARRE = .26, VOLET = .62, ECART = .055;
  var TRANS = VOLET + (BANDES - 1) * ECART;
  function volet(x, t, dessinerSortant, dessinerEntrant){
    dessinerSortant();
    var bh = H / BANDES;
    for (var b = 0; b < BANDES; b++){
      var e = quart(phase(t, b * ECART, VOLET));
      var gauche = (1 - e * (1 + LARGEUR_BARRE)) * W;   // bord gauche de la barre
      var bord = gauche + LARGEUR_BARRE * W;             // on decouvre a droite de la barre
      if (bord < W){
        x.save(); x.beginPath(); x.rect(Math.max(0, bord), b * bh, W - Math.max(0, bord), bh + 1); x.clip();
        dessinerEntrant(); x.restore();
      }
      if (gauche < W && gauche + LARGEUR_BARRE * W > 0){
        x.fillStyle = VERT; x.fillRect(gauche, b * bh, LARGEUR_BARRE * W, bh + 1);
      }
    }
  }

  /* ---------------------------------------------------------- le montage */
  function joueusesDe(d){
    return (d.joueuses || []).map(function(p, k){ var c = {}; for (var q in p) c[q] = p[q]; c.__k = k; return c; });
  }
  function pagesDe(js){
    var pages = [], parPage = js.length <= 5 ? js.length : Math.ceil(js.length / Math.ceil(js.length / 5));
    for (var i = 0; i < js.length; i += parPage) pages.push(js.slice(i, i + parPage));
    return pages;
  }
  function monter(d, A){
    var js = joueusesDe(d), sc;
    if (d.style === 'presentation'){
      sc = [sceneGenerique(d, A)];
      if (d.match) sc.push(sceneDuel(d, A));
      if (d.evenement && d.evenement.titre) sc.push(sceneEvenement(d, A));
      js.forEach(function(p, k){ sc.push(sceneJoueuse(d, A, p, k, js.length)); });
      if (js.length > 1) sc.push(sceneGroupe(d, A, js));
      if ((d.banc || []).length) sc.push(sceneBanc(d, A, d.banc));
      if (d.staff && d.staff.chef) sc.push(sceneStaff(d, A));
      // la barre en segments compte les actes, comme sur le site
      sc.forEach(function(s, k){ s.idx = k; s.nb = sc.length; });
    } else {
      var pages = pagesDe(js);
      sc = [sceneTitre(d, A)];
      pages.forEach(function(pg, k){ sc.push(scenePage(d, A, pg, k, pages.length)); });
    }
    sc.push(sceneFin(d, A));
    var debut = [], T = 0;
    sc.forEach(function(s){ debut.push(T); T += s.duree; });
    return { scenes: sc, debuts: debut, total: T + .4 };
  }
  function image_a(x, F, M, T){
    x.clearRect(0, 0, W, H);
    var dessiner = function(k){ return function(){ fond(x, F, T, M.total); M.scenes[k].dessiner(x, T - M.debuts[k]); }; };
    var k = 0;
    while (k + 1 < M.scenes.length && T >= M.debuts[k + 1]) k++;
    // pendant les TRANS premieres secondes d'une scene, le volet la decouvre sur la precedente
    if (k > 0 && T - M.debuts[k] < TRANS) volet(x, T - M.debuts[k], dessiner(k - 1), dessiner(k));
    else dessiner(k)();
  }

  /* =================================================================
     L'AFFICHE DU MATCH (08/11/2026)
     -----------------------------------------------------------------
     « celles de match, juste les infos : Baobabs vs adversaire, la date
       et l'heure, le terrain, a domicile ou a l'exterieur, mais ca doit
       etre different des autres videos qui ont la meme transition ».

     Une autre grammaire que la composition, point par point :
     - pas de fond vert qui zoome : des aplats francs, le vert vif, le
       papier, l'encre, qui changent a chaque scene ;
     - pas de volet en escalier : une LAME en biais traverse l'image,
       la scene suivante est deja derriere elle ;
     - pas de lettres qui montent une a une : une ligne sort d'une
       fente d'un seul bloc, la date et l'heure tournent comme un
       tableau a palettes, le domicile se frappe d'un tampon ;
     - un choc : les deux clubs se rencontrent sur une couture en biais,
       la feuille tremble, le VS est frappe dessus.
     Quatre scenes : le titre qui defile, le choc, le tableau, l'affiche.
     La derniere image est une affiche complete : c'est elle que donne
     la sortie Image (PNG).

     Tout se pose en proportion de (w, h) : la meme affiche en 4:5, en
     story 9:16 et en carre. Rien n'y est invente : une heure ou un
     terrain absents ne font pas de rangee.
     ================================================================= */
  var PAPIER = '#F1ECE1', ENCRE = '#0A1C12', FORET = '#17502F', LAME = .6;
  /* LES POLICES DE L'AFFICHE : « pour la police d'ecriture on peut avoir
     mieux » (08/11). Elles sont a part de celles de la composition, et
     passent toutes par fT() : en changer tient en une ligne. gras / mi :
     le titre plein et le titre un cran plus leger (une police qui n'a
     qu'une graisse les met egales, sinon le navigateur fabrique un faux
     gras). */
  var POLICES_AFF = {
    anton:  { titre: '"Anton", Impact, sans-serif', gras: '400', mi: '400', texte: '"Archivo", system-ui, sans-serif',
              url: 'https://fonts.googleapis.com/css2?family=Anton&display=swap', faces: ['400 100px Anton'] },
    barlow: { titre: '"Barlow Condensed", Impact, sans-serif', gras: 'italic 800', mi: 'italic 700', texte: '"Barlow", system-ui, sans-serif',
              url: 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@1,700;1,800&family=Barlow:wght@500;600;700;800&display=swap',
              faces: ['italic 800 100px "Barlow Condensed"', 'italic 700 100px "Barlow Condensed"', '800 40px Barlow', '700 40px Barlow', '600 40px Barlow'] },
    saira:  { titre: '"Saira Extra Condensed", Impact, sans-serif', gras: '900', mi: '800', texte: '"Archivo", system-ui, sans-serif',
              url: 'https://fonts.googleapis.com/css2?family=Saira+Extra+Condensed:wght@800;900&display=swap',
              faces: ['900 100px "Saira Extra Condensed"', '800 100px "Saira Extra Condensed"'] },
    big:    { titre: TITRE, gras: '900', mi: '800', texte: TEXTE, url: '', faces: [] }
  };
  var POLICE_AFF = 'barlow', AFF = POLICES_AFF[POLICE_AFF];
  function policeAff(d){ AFF = POLICES_AFF[d && d.policeAffiche] || POLICES_AFF[POLICE_AFF]; return AFF; }
  function fT(px, mi){ return (mi ? AFF.mi : AFF.gras) + ' ' + px + 'px ' + AFF.titre; }
  function deux(n){ return (n < 10 ? '0' : '') + n; }
  // un hasard qui redonne le meme tirage pour la meme image : l'apercu
  // et la video montrent la meme chose a la meme seconde
  function hasard(a, b){ var s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); }
  function affU(w, h){ return Math.min(w / 1080, h / 1350); }
  // la ou vit le texte : une story est couverte en haut (le nom du
  // compte) et en bas (le champ de reponse)
  function affZone(w, h){ return h / w > 1.6 ? { y0: h * .15, y1: h * .80 } : { y0: h * .08, y1: h * .93 }; }
  function neutre(x){ x.globalAlpha = 1; x.textAlign = 'left'; x.textBaseline = 'alphabetic'; espace(x, 0); }

  function affLire(d){
    // venue d'un menu de composition, la competition du match porte un
    // repli (« Prochain match ») : l'annonce lit la valeur brute
    var m = d.match || {}, adv = d.adversaire || {}, brut = m.annonce || m;
    var iso = String(m.date || '').slice(0, 10);
    var dt = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T12:00:00') : null;
    if (dt && isNaN(dt.getTime())) dt = null;
    var n = new Date(), auj = n.getFullYear() + '-' + deux(n.getMonth() + 1) + '-' + deux(n.getDate());
    var jour = dt ? dt.toLocaleDateString('fr-FR', { weekday: 'long' }).toUpperCase() : '';
    var mois = dt ? dt.toLocaleDateString('fr-FR', { month: 'long' }).toUpperCase() : '';
    var num = dt ? (dt.getDate() === 1 ? '1ER' : String(dt.getDate())) : '';
    var hm = /^(\d{1,2}):(\d{2})/.exec(String(m.heure || '').trim());
    return {
      titre: !dt || iso > auj ? 'PROCHAIN MATCH' : iso === auj ? 'JOUR DE MATCH' : 'LE MATCH',
      jour: jour, num: num, mois: mois,
      date: dt ? jour + ' ' + num + ' ' + mois : '',
      dateCourte: dt ? (dt.toLocaleDateString('fr-FR', { weekday: 'short' }) + ' ' + num + ' ' + dt.toLocaleDateString('fr-FR', { month: 'short' })).toUpperCase() : '',
      heure: hm ? Number(hm[1]) + 'H' + hm[2] : '',
      lieu: String(m.lieu || '').trim().toUpperCase(),
      dom: m.dom !== false,
      ou: m.dom !== false ? 'À DOMICILE' : 'À L’EXTÉRIEUR',
      comp: [brut.competition, brut.journee].map(function(s){ return String(s || '').trim(); }).filter(Boolean).join(' · ').toUpperCase(),
      adv: String(adv.nom || '').trim().toUpperCase() || 'ADVERSAIRE'
    };
  }



  // une ligne qui sort d'une fente, d'un seul bloc
  function fente(x, txt, gx, by, taille, police, t, debut, duree, couleur, align){
    if (!txt) return 0;
    x.save(); x.font = police; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    var l = x.measureText(txt).width, dx = align === 'centre' ? gx - l / 2 : align === 'droite' ? gx - l : gx;
    var e = sortie(phase(t, debut, duree));
    if (e > 0){
      x.beginPath(); x.rect(dx - taille, by - taille * 1.05, l + taille * 2, taille * 1.3); x.clip();
      x.fillStyle = couleur; x.fillText(txt, dx, by + (1 - e) * taille * 1.25);
    }
    x.restore();
    return l;
  }
  // LE TABLEAU A PALETTES : chaque signe bat des lettres au hasard,
  // chaque battement ecrase la palette, puis il se fige sur le bon
  var SIGNES = 'ABCDEFGHIJKLMNOPRSTUVZ0123456789';
  function palettes(x, txt, gx, by, taille, police, t, debut, couleur){
    if (!txt) return 0;
    x.save(); x.font = police; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillStyle = couleur;
    var ls = [], l = 0, k;
    for (k = 0; k < txt.length; k++){ ls.push(x.measureText(txt.charAt(k)).width); l += ls[k]; }
    var cur = gx, mi = taille * .36;
    for (k = 0; k < txt.length; k++){
      var ch = txt.charAt(k), p = (t - debut - k * .04) / .45;
      if (p >= 0 && ch !== ' '){
        var vu = ch, sy = 1;
        if (p < 1){
          var nb = p * 8, pas = Math.floor(nb);
          vu = SIGNES.charAt(Math.floor(hasard(k + 1, pas + 1) * SIGNES.length));
          sy = .2 + .8 * Math.abs(Math.cos((nb - pas) * Math.PI));
        }
        x.save(); x.translate(cur + ls[k] / 2, by - mi); x.scale(1, sy); x.fillText(vu, 0, mi); x.restore();
      }
      cur += ls[k];
    }
    x.restore();
    return l;
  }
  // un nom trop long passe sur deux lignes plutot que de fondre
  function enLignes(x, txt, police, max, larg){
    txt = String(txt || ''); var mots = txt.split(/\s+/).filter(Boolean);
    var t1 = ajuster(x, txt, police, max, larg), mieux = { t: t1, l: [txt] };
    if (t1 >= max * .72 || mots.length < 2) return mieux;
    for (var k = 1; k < mots.length; k++){
      var a = mots.slice(0, k).join(' '), b = mots.slice(k).join(' ');
      var t = Math.min(ajuster(x, a, police, max, larg), ajuster(x, b, police, max, larg));
      if (t > mieux.t) mieux = { t: t, l: [a, b] };
    }
    return mieux;
  }
  /* « l'autre logo ne remplit pas bien son cercle » (08/11) : un logo en
     JPG a son propre fond (blanc, le plus souvent), et pose a 68 % du
     disque il faisait un carre blanc au milieu du rond. fondLogo() lit
     les quatre coins : transparents, le logo est detoure ; pleins, on en
     tire la couleur du fond. */
  function fondLogo(im){
    if (!im || !im.naturalWidth) return null;
    try {
      var c = document.createElement('canvas'); c.width = 16; c.height = 16;
      var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, 16, 16);
      var d = x.getImageData(0, 0, 16, 16).data, r = 0, g = 0, b = 0;
      var coins = [0, 15, 240, 255];
      for (var i = 0; i < 4; i++){
        var p = coins[i] * 4; if (d[p + 3] < 200) return null;
        r += d[p]; g += d[p + 1]; b += d[p + 2];
      }
      return 'rgb(' + Math.round(r / 4) + ',' + Math.round(g / 4) + ',' + Math.round(b / 4) + ')';
    } catch(e){ return null; }
  }
  // un blason sur sa pastille ; sans logo, l'initiale. fondImg : la
  // couleur du fond d'un logo plein (fondLogo) : le logo remplit alors
  // tout le disque, un filet de la pastille autour ; detoure, il occupe
  // 84 % du disque.
  function ecu(x, im, nom, cx, cy, D, disque, fondImg){
    if (D <= 1) return;
    x.save();
    x.beginPath(); x.arc(cx, cy, D / 2, 0, Math.PI * 2); x.fillStyle = disque; x.fill();
    if (im && im.naturalWidth){
      var iw = im.naturalWidth, ih = im.naturalHeight, s;
      if (fondImg){
        x.beginPath(); x.arc(cx, cy, D / 2 - Math.max(2, D * .035), 0, Math.PI * 2); x.fillStyle = fondImg; x.fill(); x.clip();
        s = Math.min(D / iw, D / ih) * .97;
      } else s = Math.min(D * .84 / iw, D * .84 / ih);
      x.drawImage(im, cx - iw * s / 2, cy - ih * s / 2, iw * s, ih * s);
    } else {
      x.fillStyle = ENCRE; x.font = fT(Math.round(D * .5)); x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(String(nom || '?').trim().charAt(0).toUpperCase(), cx, cy + D * .03);
    }
    x.restore();
  }
  /* LES JOUEUSES EN FOND : « sous un voile, en les faisant apparaitre de
     peu, pas trop visibles ». Detourees, passees en gris une fois pour
     toutes, a la hauteur de l'image ; chaque scene les pose tres pales,
     et chacune derive a sa propre profondeur (une sur deux plus loin,
     plus petite, plus lente). Une photo non detouree ferait un
     rectangle gris : elle n'y va pas. */
  function fantomesPrets(A, h){
    var out = [];
    (A.photos || []).forEach(function(im, k){
      var v = A.visages && A.visages[k];
      if (!im || !v || v.opaque || out.length >= 7) return;
      var sc = h * .95 / (v.haut * im.naturalHeight);
      var cw = Math.max(1, Math.round(im.naturalWidth * sc)), ch = Math.max(1, Math.round(im.naturalHeight * sc));
      var c = document.createElement('canvas'); c.width = cw; c.height = ch;
      var x = c.getContext('2d'); x.filter = 'grayscale(1) contrast(1.15)'; x.drawImage(im, 0, 0, cw, ch);
      out.push({ c: c, top: v.top * ch, cx: v.cx * cw });
    });
    return out;
  }
  /* « les joueuses a opacite reduite, si on les superpose, c'est un peu
     bizarre » (08/11) : chacune etait pale pour son compte, et la ou
     deux se croisaient on voyait l'une a travers l'autre, une double
     exposition. Elles se posent maintenant OPAQUES sur un calque, comme
     une photo d'equipe (le second rang d'abord, le premier le cache) ;
     le calque prend la couleur de la scene, s'efface vers le bas, et
     c'est LUI qui passe sous le voile, d'un seul tenant. */
  var calque = null;
  // o : alpha, y (le haut des tetes du second rang), debut, sens de la
  // derive, teinte (la couleur de la scene, melangee au gris)
  function fantomes(x, A, w, h, t, o){
    var F = A.fantomes; if (!F || !F.length) return;
    var ea = sortie(phase(t, o.debut || 0, .9)); if (ea <= 0) return;
    if (!calque || calque.width !== w || calque.height !== h){ calque = document.createElement('canvas'); calque.width = w; calque.height = h; }
    var c = calque.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, w, h);
    // premier rang : les paires (0, 2, 4...) ; second rang : entre elles
    var devant = [], derriere = [], k;
    for (k = 0; k < F.length; k++) (k % 2 ? derriere : devant).push(F[k]);
    var poser = function(rang, loin){
      rang.forEach(function(f, i){
        var q = loin ? (i + 1) / (rang.length + 1) : (i + .5) / rang.length;
        var prof = loin ? .84 : 1, j = F.indexOf(f);
        var e = sortie(phase(t, (o.debut || 0) + j * .07, 1));
        // la derive suit l'horloge de toute la video : elle ne repart pas
        // de zero a chaque scene
        var cx = w * q + (o.sens || 1) * TG * w * (loin ? .006 : .014);
        var top = o.y + (loin ? 0 : h * .09) + (1 - e) * h * .06;
        c.drawImage(f.c, cx - f.cx * prof, top - f.top * prof, f.c.width * prof, f.c.height * prof);
      });
    };
    poser(derriere, true); poser(devant, false);
    // la couleur de la scene, sur les seules joueuses
    if (o.teinte){ c.globalCompositeOperation = 'source-atop'; c.globalAlpha = .55; c.fillStyle = o.teinte; c.fillRect(0, 0, w, h); c.globalAlpha = 1; }
    // le bas s'efface : pas de coupure nette au bord des photos
    c.globalCompositeOperation = 'destination-out';
    var g = c.createLinearGradient(0, h * .5, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'source-over';
    // un lent zoom qui respire, comme une camera qui ne s'arrete jamais
    var z = 1.02 + .004 * TG;
    x.save(); x.globalAlpha = o.alpha * ea;
    x.translate(w / 2, h * .4); x.scale(z, z); x.translate(-w / 2, -h * .4);
    x.drawImage(calque, 0, 0); x.restore();
  }

  // L'ETIQUETTE du domicile : un aplat qui s'ouvre de gauche a droite,
  // le texte sort de sa fente. « du professionnalisme et pas de trucs
  // IA » (08/11) : plus de tampon penche qui rebondit. gx : bord gauche.
  function tampon(x, txt, gx, cy, u, t, debut, plein){
    var e = quart(phase(t, debut, .45)); if (e <= 0) return;
    var taille = Math.round(72 * u);
    x.save(); x.font = fT(taille); espace(x, 2 * u);
    var l = x.measureText(txt).width, bw = l + 64 * u, bh = taille * 1.25;
    x.fillStyle = plein ? VERT : ENCRE; x.fillRect(gx, cy - bh / 2, bw * e, bh);
    x.restore();
    espace(x, 2 * u);
    fente(x, txt, gx + 32 * u, cy + taille * .36, taille, fT(taille), t, debut + .15, .5, plein ? ENCRE : PAPIER);
    espace(x, 0);
  }

  // 1. LE TITRE QUI DEFILE : des rangees geantes, en sens contraires, sur
  //    le vert vif ; le blason tombe au milieu dans un disque d'encre
  function affOuverture(I, A, w, h){
    var u = affU(w, h), fs = Math.round(Math.max(h / 4.3, 250 * u)), pas = fs * .82;
    var rangs = Math.ceil(h / pas) + 1, R = Math.min(w, h) * .21;
    var y0 = h / 2 - (rangs - 1) * pas / 2 + fs * .36;
    return { duree: 2.7, dessiner: function(x, t){
      neutre(x);
      x.fillStyle = VERT; x.fillRect(0, 0, w, h);
      fantomes(x, A, w, h, t, { alpha: .2, y: h * .06, debut: 0, sens: -1, teinte: ENCRE });
      fondAnime(x, w, h, false);
      x.save(); x.font = fT(fs);
      var mot = I.titre + ' · ', mw = x.measureText(mot).width;
      for (var r = 0; r < rangs; r++){
        // chaque rangee arrive lancee, penchee par la vitesse, puis se
        // redresse en ralentissant jusqu'a la derive
        var sens = r % 2 ? 1 : -1, ent = sortie(phase(t, r * .05, 1.2));
        var dec = sens * (t * w * .14 - (1 - ent) * w * 1.4) + r * mw * .37;
        var gx = ((dec % mw) + mw) % mw - mw, by = y0 + r * pas, pen = sens * .16 * (1 - ent);
        x.globalAlpha = borne(ent * 1.6) * (r % 2 ? 1 : .9);
        x.save(); x.translate(0, by); x.transform(1, 0, -pen, 1, 0, 0);
        for (var q = gx; q < w + fs; q += mw){
          if (r % 2){ x.lineWidth = Math.max(2, 3 * u); x.strokeStyle = ENCRE; x.strokeText(mot, q, 0); }
          else { x.fillStyle = ENCRE; x.fillText(mot, q, 0); }
        }
        x.restore();
      }
      x.restore();
      var cx = w / 2, cy = h / 2, ed = sortie(phase(t, .3, .6));
      if (ed > 0){
        x.beginPath(); x.arc(cx, cy, R * ed, 0, Math.PI * 2); x.fillStyle = ENCRE; x.fill();
        if (A.logo){ var tb = R * 1.3 * sortie(phase(t, .42, .6)); if (tb > 1) x.drawImage(A.logo, cx - tb / 2, cy - tb / 2, tb, tb); }
      }
      // la competition, sur une bande d'encre qui s'ouvre du centre
      if (I.comp){
        var et = quart(phase(t, .85, .45));
        if (et > 0){
          x.save(); espace(x, 4 * u);
          var tc = ajuster(x, I.comp, '700 {t}px ' + AFF.texte, Math.round(26 * u), w - 200 * u);
          x.font = '700 ' + tc + 'px ' + AFF.texte;
          var bw = x.measureText(I.comp).width + 60 * u, bh = tc + 34 * u, by2 = cy + R + 44 * u;
          x.beginPath(); x.rect(cx - bw * et / 2, by2, bw * et, bh); x.fillStyle = ENCRE; x.fill(); x.clip();
          x.fillStyle = PAPIER; x.textAlign = 'center'; x.textBaseline = 'middle';
          x.fillText(I.comp, cx + 2 * u, by2 + bh / 2 + u);
          x.restore();
        }
      }
    } };
  }

  // 2. LE CHOC : deux aplats en biais se rencontrent, la feuille tremble,
  //    le VS est frappe sur la couture
  function affDuel(I, A, w, h){
    var u = affU(w, h), S = Math.round(Math.min(w, h) * .28 * (h / w > 1.6 ? 1.1 : 1));
    var yG = h * .575, yD = h * .425, ys = function(X){ return yG + (yD - yG) * X / w; };
    var cxA = w * .27, cyA = h * .27, cxB = w * .73, cyB = h * .73, RV = Math.round(92 * u), CHOC = .5;
    return { duree: 3.8, dessiner: function(x, t){
      neutre(x);
      var e = sortie(phase(t, 0, CHOC)), off = (1 - e) * h * .75, m = 80 * u;
      // la camera avance doucement, sans a-coup
      var zoom = 1 + .03 * phase(t, CHOC, 3.3);
      x.fillStyle = PAPIER; x.fillRect(0, 0, w, h);
      x.save();
      x.translate(w / 2, h / 2); x.scale(zoom, zoom); x.translate(-w / 2, -h / 2);
      // le haut : les Baobabs, sur le vert de foret, et l'equipe derriere
      // le blason, sous le voile
      x.save(); x.translate(0, -off);
      x.beginPath(); x.moveTo(-m, -m - h); x.lineTo(w + m, -m - h); x.lineTo(w + m, ys(w + m)); x.lineTo(-m, ys(-m)); x.closePath();
      x.fillStyle = FORET; x.fill(); x.clip();
      fantomes(x, A, w, h, t, { alpha: .16, y: h * .02, debut: .1, sens: 1, teinte: PAPIER });
      fondAnime(x, w, h, true);
      ecu(x, A.logo, 'B', cxA, cyA, S, PAPIER, A.logoFond);
      x.restore();
      // le bas : l'adversaire, sur l'encre
      x.save(); x.translate(0, off);
      x.beginPath(); x.moveTo(-m, ys(-m)); x.lineTo(w + m, ys(w + m)); x.lineTo(w + m, 2 * h + m); x.lineTo(-m, 2 * h + m); x.closePath();
      x.fillStyle = ENCRE; x.fill(); x.clip();
      fondAnime(x, w, h, true);
      ecu(x, A.adv, I.adv, cxB, cyB, S, PAPIER, A.advFond);
      x.restore();
      // la couture s'allume du centre vers les bords
      var es = quart(phase(t, CHOC, .35));
      if (es > 0){
        var hw = (w / 2 + m) * es, e2 = 9 * u;
        x.save(); x.beginPath(); x.rect(w / 2 - hw, -m, hw * 2, h + 2 * m); x.clip();
        x.beginPath(); x.moveTo(-m, ys(-m) - e2); x.lineTo(w + m, ys(w + m) - e2); x.lineTo(w + m, ys(w + m) + e2); x.lineTo(-m, ys(-m) + e2); x.closePath();
        x.fillStyle = VERT; x.fill(); x.restore();
      }
      // les noms sortent de derriere leur blason
      var en = sortie(phase(t, CHOC + .25, .6));
      if (en > 0){
        var gx = cxA + S * .6, lg = w - gx - 56 * u;
        var tA = ajuster(x, 'BAOBABS', fT('{t}'), Math.round(150 * u), lg);
        x.save(); x.beginPath(); x.rect(cxA + S / 2 + 2, 0, w, h); x.clip();
        x.font = fT(tA); x.fillStyle = PAPIER;
        var lA = x.measureText('BAOBABS').width, dA = (1 - en) * (lA + S * .2);
        x.fillText('BAOBABS', gx - dA, cyA + tA * .22);
        espace(x, 5 * u); x.font = '700 ' + Math.round(24 * u) + 'px ' + AFF.texte; x.fillStyle = VERT;
        x.fillText('BASKET CLUB', gx + 4 * u - dA, cyA + tA * .22 + 48 * u);
        x.restore();
        var gxB = cxB - S * .6, lgB = gxB - 56 * u;
        var L = enLignes(x, I.adv, fT('{t}'), Math.round(140 * u), lgB);
        var pasL = L.t * .9, yB = cyB - (L.l.length - 1) * pasL / 2 + L.t * .3;
        x.save(); x.beginPath(); x.rect(0, 0, cxB - S / 2 - 2, h); x.clip();
        x.font = fT(L.t); x.fillStyle = PAPIER; x.textAlign = 'right';
        var lB = Math.max.apply(null, L.l.map(function(s){ return x.measureText(s).width; })), dB = (1 - en) * (lB + S * .2);
        L.l.forEach(function(s, k){ x.fillText(s, gxB + dB, yB + k * pasL); });
        x.restore();
      }
      // le VS tombe et frappe la couture a l'instant du choc
      var ev = sortie(phase(t, CHOC - .1, .5));
      if (ev > 0){
        var sv = .6 + .4 * ev;
        x.save(); x.translate(w / 2, h / 2); x.scale(sv, sv); x.globalAlpha = borne(ev * 2);
        x.beginPath(); x.arc(0, 0, RV, 0, Math.PI * 2); x.fillStyle = VERT; x.fill();
        x.lineWidth = 5 * u; x.strokeStyle = ENCRE; x.stroke();
        x.fillStyle = ENCRE; x.font = fT(Math.round(RV * 1.05)); x.textAlign = 'center'; x.textBaseline = 'alphabetic';
        x.fillText('VS', 0, RV * .38);
        x.restore();
      }
      x.restore();
    } };
  }

  // 3. LE TABLEAU : la date et l'heure en palettes, le terrain, puis le
  //    tampon du domicile ou de l'exterieur
  function affTableau(I, A, w, h){
    var u = affU(w, h), Z = affZone(w, h), mx = Math.round(76 * u), larg = w - 2 * mx;
    var rang = [];
    if (I.date) rang.push({ lib: 'Date', val: I.date, palettes: true });
    if (I.heure) rang.push({ lib: 'Heure', val: I.heure, palettes: true, bloc: true });
    if (I.lieu) rang.push({ lib: 'Terrain', val: I.lieu });
    var hK = 84 * u, hR = 240 * u, hT = 210 * u, haut = Z.y1 - Z.y0;
    if (hK + rang.length * hR + hT > haut) hR = (haut - hK - hT) / Math.max(1, rang.length);
    var y0 = Z.y0 + Math.max(0, (haut - hK - rang.length * hR - hT) / 2);
    var tT = .35 + rang.length * .3 + .4;
    var vmax = Math.round((hR - 90 * u) / .8);
    return { duree: 4.4, dessiner: function(x, t){
      neutre(x);
      x.fillStyle = PAPIER; x.fillRect(0, 0, w, h);
      fantomes(x, A, w, h, t, { alpha: .1, y: h * .18, debut: .05, sens: 1, teinte: FORET });
      fondAnime(x, w, h, false);
      x.save();
      // qui joue, souligne d'un trait vert
      var kick = 'BAOBABS  VS  ' + I.adv;
      espace(x, 3 * u);
      var tk = ajuster(x, kick, '800 {t}px ' + AFF.texte, Math.round(30 * u), larg), yk = y0 + tk;
      var lk = fente(x, kick, mx, yk, tk, '800 ' + tk + 'px ' + AFF.texte, t, .1, .5, ENCRE);
      espace(x, 0);
      x.fillStyle = VERT; x.fillRect(mx, yk + 16 * u, Math.min(lk, larg) * quart(phase(t, .2, .5)), 9 * u);
      rang.forEach(function(r, k){
        var top = y0 + hK + k * hR, d0 = .35 + k * .3, base = top + hR - 34 * u;
        x.fillStyle = ENCRE; x.fillRect(mx, top, larg * quart(phase(t, d0 - .1, .5)), Math.max(2, 3 * u));
        espace(x, 5 * u);
        var tl = Math.round(22 * u);
        fente(x, r.lib.toUpperCase(), mx, top + 50 * u, tl, '700 ' + tl + 'px ' + AFF.texte, t, d0, .45, 'rgba(10,28,18,.55)');
        espace(x, 0);
        if (r.bloc){
          // l'heure sur un bloc vert, coupe en deux comme une horloge a palettes
          var th = Math.round(Math.min(150 * u, vmax));
          x.font = fT(th);
          var bw = x.measureText(r.val).width + 56 * u, bTop = base - th * .72 - 18 * u, bH = th * .72 + 36 * u;
          var eB = quart(phase(t, d0 + .05, .4));
          x.fillStyle = VERT; x.fillRect(mx, bTop, bw * eB, bH);
          palettes(x, r.val, mx + 28 * u, base, th, fT(th), t, d0 + .2, ENCRE);
          if (eB >= 1){ x.fillStyle = 'rgba(10,28,18,.32)'; x.fillRect(mx, bTop + bH / 2 - 1.5 * u, bw, 3 * u); }
        } else if (r.palettes){
          var td = ajuster(x, r.val, fT('{t}'), Math.round(Math.min(130 * u, vmax)), larg);
          palettes(x, r.val, mx, base, td, fT(td), t, d0 + .12, ENCRE);
        } else {
          var L = enLignes(x, r.val, fT('{t}'), Math.round(Math.min(110 * u, vmax)), larg);
          if (L.l.length > 1) L.t = Math.min(L.t, Math.round((hR - 96 * u) / 1.62));
          L.l.forEach(function(s, q){
            fente(x, s, mx, base - (L.l.length - 1 - q) * L.t * .9, L.t, fT(L.t), t, d0 + .12 + q * .08, .55, ENCRE);
          });
        }
      });
      tampon(x, I.ou, mx, y0 + hK + rang.length * hR + hT / 2, u, t, tT, I.dom);
      x.restore();
    } };
  }

  // 4. L'AFFICHE. « avoir les deux logos au milieu a la fin », puis
  //    « l'affiche de match n'est pas tres ambitieuse » (08/11). Une vraie
  //    affiche de jour de match : la date en chiffre geant au fond, deux
  //    joueuses en couleur devant, qui sortent de derriere un panneau
  //    d'encre ; les deux logos a cheval sur le bord du panneau, au
  //    milieu ; dessous, une grille nette : date, heure, terrain. C'est
  //    l'image qui reste a la fin, et celle que donne la sortie Image.
  function herosPrets(A, hs){
    var out = [];
    (A.photos || []).forEach(function(im, k){
      var v = A.visages && A.visages[k];
      if (!im || !v || v.opaque || out.length >= 2) return;
      var sc = hs / (v.haut * im.naturalHeight);
      var cw = Math.max(1, Math.round(im.naturalWidth * sc)), ch = Math.max(1, Math.round(im.naturalHeight * sc));
      var c = document.createElement('canvas'); c.width = cw; c.height = ch;
      c.getContext('2d').drawImage(im, 0, 0, cw, ch);
      out.push({ c: c, top: v.top * ch, cx: v.cx * cw });
    });
    return out;
  }
  function affFinale(I, A, w, h){
    var u = affU(w, h), Z = affZone(w, h), mx = Math.round(70 * u), larg = w - 2 * mx;
    // le bord haut du panneau : juste ce qu'il faut au-dessous pour les logos,
    // les noms, la grille et le domicile (410 unites)
    var haut = Z.y1 - Z.y0, yP = Math.max(Z.y0 + haut * .5, Z.y1 - 410 * u), pente = 34 * u;
    // les tetes un peu basses : le haut du chiffre geant se lit au-dessus
    var yTete = Z.y0 + 62 * u + (yP - Z.y0) * .2, hs = (yP - yTete) * 1.5;
    var HE = herosPrets(A, hs);
    var D = Math.round(Math.min(214 * u, w * .21)), ecart = Math.round(96 * u);
    var cxA = w / 2 - D / 2 - ecart / 2, cxB = w / 2 + D / 2 + ecart / 2;
    var tK = Math.round(22 * u);
    return { duree: 4.4, dessiner: function(x, t){
      neutre(x);
      // le fond : l'encre, un grand pan de vert de foret en biais, la trame
      x.fillStyle = ENCRE; x.fillRect(0, 0, w, h);
      x.save(); x.fillStyle = FORET;
      x.beginPath(); x.moveTo(w * .38, 0); x.lineTo(w, 0); x.lineTo(w, yP); x.lineTo(w * .02, yP); x.closePath(); x.fill();
      x.restore();
      fondAnime(x, w, h, true);
      // l'en-tete : ce qu'on annonce a gauche, la competition a droite
      espace(x, 6 * u);
      fente(x, I.titre, mx, Z.y0 + tK * .8, tK, '800 ' + tK + 'px ' + AFF.texte, t, .1, .5, VERT);
      espace(x, 2 * u);
      if (I.comp){
        var tc = ajuster(x, I.comp, '600 {t}px ' + AFF.texte, Math.round(19 * u), larg * .55);
        fente(x, I.comp, w - mx, Z.y0 + tK * .8, tc, '600 ' + tc + 'px ' + AFF.texte, t, .18, .5, 'rgba(241,236,225,.7)', 'droite');
      }
      espace(x, 0);
      x.fillStyle = 'rgba(241,236,225,.25)'; x.fillRect(mx, Z.y0 + tK + 16 * u, larg * quart(phase(t, .05, .8)), Math.max(1, 1.5 * u));
      // LE CHIFFRE DU JOUR, geant, en vert plein : il derive tres
      // lentement, les joueuses passent devant
      if (I.num){
        var hMax = (yP - (Z.y0 + tK + 40 * u)) * 1.02;
        var tg = ajuster(x, I.num, fT('{t}'), Math.round(hMax / .7), w * .9);
        var eg = sortie(phase(t, 0, .9)), byg = Z.y0 + tK + 40 * u + tg * .7 + (1 - eg) * tg * .3;
        x.save();
        x.beginPath(); x.rect(0, Z.y0 + tK + 30 * u, w, yP - Z.y0); x.clip();
        x.font = fT(tg); x.textAlign = 'center'; x.textBaseline = 'alphabetic';
        x.globalAlpha = eg; x.fillStyle = VERT;
        x.fillText(I.num, w / 2 - t * 5 * u, byg);
        x.restore();
      }
      // LES DEUX JOUEUSES, en couleur, sortent de derriere le panneau
      HE.forEach(function(f, k){
        var e = sortie(phase(t, .2 + k * .12, .9));
        var cx = HE.length === 1 ? w / 2 : (k ? w * .7 : w * .3);
        var z = 1 + .012 * t;
        var top = yTete + (1 - e) * h * .35;
        x.save();
        x.beginPath(); x.rect(0, 0, w, yP + pente + 2); x.clip();
        x.translate(cx, top); x.scale(z, z);
        x.drawImage(f.c, -f.cx, -f.top);
        x.restore();
      });
      // LE PANNEAU : il monte du bas, bord superieur en biais, filet vert
      var ep = sortie(phase(t, 0, .6)), dy = (1 - ep) * (h - yP + pente);
      x.save(); x.translate(0, dy);
      x.beginPath(); x.moveTo(-2, yP + pente); x.lineTo(w + 2, yP - pente); x.lineTo(w + 2, h + 2); x.lineTo(-2, h + 2); x.closePath();
      x.fillStyle = '#07150D'; x.fill();
      x.beginPath(); x.moveTo(-2, yP + pente); x.lineTo(w + 2, yP - pente);
      x.strokeStyle = VERT; x.lineWidth = Math.max(2, 3 * u); x.stroke();
      x.restore();
      // LES DEUX LOGOS, au milieu, a cheval sur le bord du panneau
      var eA = sortie(phase(t, .45, .55)), eB = sortie(phase(t, .52, .55));
      if (eA > 0){ x.save(); x.globalAlpha = borne(eA * 1.5); ecu(x, A.logo, 'B', cxA, yP, D * (.75 + .25 * eA), PAPIER, A.logoFond); x.restore(); }
      if (eB > 0){ x.save(); x.globalAlpha = borne(eB * 1.5); ecu(x, A.adv, I.adv, cxB, yP, D * (.75 + .25 * eB), PAPIER, A.advFond); x.restore(); }
      var tv = Math.round(64 * u);
      fente(x, 'VS', w / 2, yP + tv * .36, tv, fT(tv), t, .62, .4, VERT, 'centre');
      // les deux noms, sur une ligne
      var y = yP + D / 2 + 34 * u;
      var noms = 'BAOBABS  VS  ' + I.adv, tn = ajuster(x, noms, fT('{t}'), Math.round(58 * u), larg);
      x.font = fT(tn);
      var l1 = x.measureText('BAOBABS  ').width, l2 = x.measureText('VS  ').width, l3 = x.measureText(I.adv).width;
      var g0 = w / 2 - (l1 + l2 + l3) / 2, yN = y + tn * .72;
      fente(x, 'BAOBABS', g0, yN, tn, fT(tn), t, .7, .5, PAPIER);
      fente(x, 'VS', g0 + l1, yN, tn, fT(tn), t, .75, .5, VERT);
      fente(x, I.adv, g0 + l1 + l2, yN, tn, fT(tn), t, .8, .5, PAPIER);
      y = yN + 30 * u;
      // LA GRILLE : date, heure, terrain, separes par des filets
      var cols = [];
      if (I.date) cols.push({ lib: 'DATE', val: I.dateCourte, coul: PAPIER, p: .32 });
      if (I.heure) cols.push({ lib: 'HEURE', val: I.heure, coul: VERT, p: .22 });
      if (I.lieu) cols.push({ lib: 'TERRAIN', val: I.lieu, coul: PAPIER, p: .46, lignes: true });
      var somme = cols.reduce(function(a, c){ return a + c.p; }, 0) || 1, hG = Math.round(118 * u);
      var eg2 = quart(phase(t, .85, .6));
      x.fillStyle = 'rgba(241,236,225,.22)';
      x.fillRect(mx, y, larg * eg2, Math.max(1, 1.5 * u)); x.fillRect(mx, y + hG, larg * eg2, Math.max(1, 1.5 * u));
      var gx = mx;
      cols.forEach(function(c, k){
        var lc = larg * c.p / somme;
        if (k > 0){ x.fillStyle = 'rgba(241,236,225,.22)'; x.fillRect(gx, y + 18 * u, Math.max(1, 1.5 * u), (hG - 36 * u) * eg2); }
        var px0 = gx + (k ? 22 * u : 0), lu = lc - (k ? 22 * u : 0) - 14 * u;
        espace(x, 4 * u);
        var tl = Math.round(15 * u);
        fente(x, c.lib, px0, y + 34 * u, tl, '700 ' + tl + 'px ' + AFF.texte, t, .95 + k * .08, .45, 'rgba(241,236,225,.55)');
        espace(x, 0);
        if (c.lignes){
          var L = enLignes(x, c.val, fT('{t}', 1), Math.round(40 * u), lu);
          var tt = L.l.length > 1 ? Math.min(L.t, Math.round((hG - 56 * u) / 1.62)) : L.t;
          L.l.forEach(function(s, q){
            fente(x, s, px0, y + hG - 20 * u - (L.l.length - 1 - q) * tt * .92, tt, fT(tt, 1), t, 1.02 + k * .08 + q * .05, .5, c.coul);
          });
        } else {
          var tv2 = ajuster(x, c.val, fT('{t}'), Math.round(56 * u), lu);
          fente(x, c.val, px0, y + hG - 22 * u, tv2, fT(tv2), t, 1.02 + k * .08, .5, c.coul);
        }
        gx += lc;
      });
      y += hG + 28 * u;
      // le domicile, et le club
      x.save(); espace(x, 4 * u);
      var tO = Math.round(19 * u), hO = Math.round(44 * u); x.font = '800 ' + tO + 'px ' + AFF.texte;
      var lo = x.measureText(I.ou).width + 40 * u, eo = quart(phase(t, 1.2, .45));
      x.fillStyle = I.dom ? VERT : 'rgba(0,0,0,0)';
      if (I.dom) x.fillRect(mx, y, lo * eo, hO);
      else { x.strokeStyle = VERT; x.lineWidth = Math.max(1.5, 2 * u); x.strokeRect(mx, y, lo * eo, hO); }
      x.restore();
      espace(x, 4 * u);
      fente(x, I.ou, mx + 20 * u, y + hO / 2 + tO * .36, tO, '800 ' + tO + 'px ' + AFF.texte, t, 1.3, .4, I.dom ? ENCRE : VERT);
      var tp = Math.round(15 * u);
      fente(x, 'BAOBABS BASKET CLUB', w - mx, y + hO / 2 + tp * .36, tp, '700 ' + tp + 'px ' + AFF.texte, t, 1.35, .4, 'rgba(241,236,225,.5)', 'droite');
      espace(x, 0);
    } };
  }

  // LA LAME : une coupe en biais traverse l'image de gauche a droite ;
  // derriere elle, la scene suivante est deja la, et se pose en reculant
  function lame(x, t, w, h, sortant, entrant){
    var e = quart(phase(t, 0, LAME)), pente = h * .3, bw = w * .22;
    var a = e * (w + pente + bw), tr = a - bw;     // l'attaque et la fuite, en haut
    sortant();
    if (tr > -1){
      x.save();
      x.beginPath(); x.moveTo(-1, -1); x.lineTo(tr, -1); x.lineTo(tr - pente, h + 1); x.lineTo(-1, h + 1); x.closePath(); x.clip();
      var z = 1.07 - .07 * sortie(e);
      x.translate(w / 2, h / 2); x.scale(z, z); x.translate(-w / 2, -h / 2);
      entrant();
      x.restore();
    }
    x.save();
    x.beginPath(); x.moveTo(tr, -1); x.lineTo(a, -1); x.lineTo(a - pente, h + 1); x.lineTo(tr - pente, h + 1); x.closePath();
    x.fillStyle = VERT; x.fill();
    var f = bw * .12;
    x.beginPath(); x.moveTo(a - f, -1); x.lineTo(a, -1); x.lineTo(a - pente, h + 1); x.lineTo(a - f - pente, h + 1); x.closePath();
    x.fillStyle = ENCRE; x.fill();
    x.restore();
  }
  function monterAffiche(d, A, w, h){
    var I = affLire(d);
    var sc = [affOuverture(I, A, w, h), affDuel(I, A, w, h), affTableau(I, A, w, h), affFinale(I, A, w, h)];
    var debut = [], T = 0;
    sc.forEach(function(s){ debut.push(T); T += s.duree; });
    return { scenes: sc, debuts: debut, total: T, w: w, h: h };
  }
  function image_affiche(x, M, T, grain){
    TG = T;
    var k = 0;
    while (k + 1 < M.scenes.length && T >= M.debuts[k + 1]) k++;
    var dessiner = function(j){ return function(){ M.scenes[j].dessiner(x, T - M.debuts[j]); }; };
    if (k > 0 && T - M.debuts[k] < LAME) lame(x, T - M.debuts[k], M.w, M.h, dessiner(k - 1), dessiner(k));
    else dessiner(k)();
    // le grain de pellicule bouge a chaque image
    if (grain){
      var n = Math.round(T * FPS);
      x.drawImage(grain, -Math.floor(hasard(n, 7) * 48), -Math.floor(hasard(n, 13) * 48));
    }
  }
  /* L'ARRIERE-PLAN ANIME : « faut un arriere-plan comme une video
     animee », puis « du professionnalisme et pas de trucs IA » (08/11).
     Ni lueurs, ni faisceaux, ni particules : la trame en biais du site,
     qui glisse lentement sur l'horloge de TOUTE la video (TG), d'une
     scene a l'autre sans repartir de zero. Avec les joueuses sous leur
     voile et leur lente avancee de camera, c'est le film qui tourne
     derriere. sombre : filets clairs ; sinon filets d'encre. */
  var TG = 0;
  function fondAnime(x, w, h, sombre){
    var u = affU(w, h), pas = 26 * u, dec = (TG * 22 * u) % pas;
    x.save();
    x.strokeStyle = sombre ? 'rgba(241,236,225,.05)' : 'rgba(10,28,18,.06)'; x.lineWidth = Math.max(1, 2 * u);
    x.beginPath();
    for (var k = -h + dec; k < w + h; k += pas){ x.moveTo(k, 0); x.lineTo(k - h * .4, h); }
    x.stroke();
    x.restore();
  }
  // le grain, un peu plus grand que l'image : il se decale a chaque image
  function grainPret(w, h){
    w += 48; h += 48;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d'), im = x.createImageData(w, h), d = im.data;
    for (var i = 0; i < d.length; i += 4){ var v = Math.random() < .5 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = Math.random() * 14; }
    x.putImageData(im, 0, 0);
    return c;
  }

  /* ---------------------------------------------------------- le chantier */
  // ce qui se dessine, a quelle taille, et comment
  function chantier(d, A){
    var f = formatDe(d), w = f.w, h = f.h;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d', { alpha: false }), M, dessiner;
    if (d.style === 'affiche'){
      A.fantomes = fantomesPrets(A, h);
      A.logoFond = fondLogo(A.logo); A.advFond = fondLogo(A.adv);
      policeAff(d);
      M = monterAffiche(d, A, w, h);
      var G = grainPret(w, h);
      dessiner = function(T){ image_affiche(x, M, T, G); };
    } else if (w === W && h === H){
      M = monter(d, A);
      var F = fondPret(W, H);
      dessiner = function(T){ image_a(x, F, M, T); };
    } else {
      // la planche 4:5 au milieu, sur le meme fond prolonge a la taille
      // de sortie : la planche reste transparente, le fond passe dessous
      M = monter(d, A);
      var F2 = fondPret(w, h), p = document.createElement('canvas'); p.width = W; p.height = H;
      var xp = p.getContext('2d'), ox = Math.round((w - W) / 2), oy = Math.round((h - H) / 2);
      dessiner = function(T){
        image_a(xp, null, M, T);
        fond(x, F2, T, M.total, w, h);
        x.drawImage(p, ox, oy);
      };
    }
    return { c: c, w: w, h: h, total: M.total, dessiner: dessiner, format: f };
  }

  /* ---------------------------------------------------------- les encodeurs */
  function avcConfig(w, h){
    if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return Promise.resolve(null);
    // 1080 x 1920 tient tout juste dans le niveau 4.0 ; 4.2 en secours
    var codecs = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.640029', 'avc1.64002a', 'avc1.4d002a'];
    var debit = Math.round(5e6 * w * h / (W * H));
    var essayer = function(i){
      if (i >= codecs.length) return Promise.resolve(null);
      var cfg = { codec: codecs[i], width: w, height: h, bitrate: debit, framerate: FPS, avc: { format: 'avc' } };
      return VideoEncoder.isConfigSupported(cfg).then(function(r){ return r && r.supported ? cfg : essayer(i + 1); }, function(){ return essayer(i + 1); });
    };
    return essayer(0);
  }
  /* « pas de metadonnees sur les videos » (08/11) : le fichier ne dit ni
     quand il a ete fabrique, ni avec quoi. Les dates des boites mvhd,
     tkhd et mdhd passent a zero ; le nom du gestionnaire (hdlr, ou
     mp4-muxer ecrit le sien) est efface ; une boite udta ou meta devient
     une boite free, que les lecteurs sautent. Les tailles ne bougent pas. */
  function sansMeta(buf){
    var v = new DataView(buf), o8 = new Uint8Array(buf);
    var type = function(o){ return String.fromCharCode(o8[o + 4], o8[o + 5], o8[o + 6], o8[o + 7]); };
    var conteneurs = { moov: 1, trak: 1, mdia: 1, minf: 1, stbl: 1, dinf: 1, edts: 1, mvex: 1 };
    var parcourir = function(debut, fin){
      var o = debut;
      while (o + 8 <= fin){
        var taille = v.getUint32(o), t = type(o), entete = 8, i;
        if (taille === 1){ taille = Number(v.getBigUint64(o + 8)); entete = 16; }
        else if (taille === 0) taille = fin - o;
        if (taille < 8 || o + taille > fin) break;
        var c = o + entete;
        if (conteneurs[t]) parcourir(c, o + taille);
        else if (t === 'mvhd' || t === 'tkhd' || t === 'mdhd'){
          var n = o8[c] === 1 ? 16 : 8;
          for (i = 0; i < n; i++) o8[c + 4 + i] = 0;
        } else if (t === 'hdlr'){
          for (i = c + 24; i < o + taille; i++) o8[i] = 0;
        } else if (t === 'udta' || t === 'meta'){
          o8[o + 4] = 102; o8[o + 5] = 114; o8[o + 6] = 101; o8[o + 7] = 101;
          for (i = c; i < o + taille; i++) o8[i] = 0;
        }
        o += taille;
      }
    };
    parcourir(0, buf.byteLength);
    return buf;
  }
  function encoderMp4(J, cfg, surProgres){
    return (window.Mp4Muxer ? Promise.resolve() : charger(MUXER)).then(function(){
      var cible = new Mp4Muxer.ArrayBufferTarget();
      var mux = new Mp4Muxer.Muxer({ target: cible, fastStart: 'in-memory',
        video: { codec: 'avc', width: J.w, height: J.h, frameRate: FPS } });
      var erreur = null;
      var enc = new VideoEncoder({
        output: function(chunk, meta){ mux.addVideoChunk(chunk, meta); },
        error: function(e){ erreur = e; }
      });
      enc.configure(cfg);
      var n = Math.ceil(J.total * FPS), f = 0;
      return new Promise(function(res, rej){
        var pas = function(){
          if (erreur) return rej(erreur);
          // on ne laisse pas la file de l'encodeur gonfler : la memoire
          // d'un telephone d'entree de gamme suit
          var lot = 0;
          while (f < n && lot < 6 && enc.encodeQueueSize < 12){
            J.dessiner(f / FPS);
            var vf = new VideoFrame(J.c, { timestamp: Math.round(f * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
            enc.encode(vf, { keyFrame: f % (FPS * 2) === 0 }); vf.close();
            f++; lot++;
          }
          if (surProgres) surProgres(f / n * .96);
          if (f < n) return cede(pas);
          enc.flush().then(function(){
            mux.finalize();
            if (surProgres) surProgres(1);
            res({ blob: new Blob([sansMeta(cible.buffer)], { type: 'video/mp4' }), type: 'video/mp4', ext: 'mp4' });
          }, rej);
        };
        pas();
      });
    });
  }
  function enregistrer(J, surProgres){
    var c = J.c, M = { total: J.total };
    if (!c.captureStream || typeof MediaRecorder === 'undefined') return Promise.reject(new Error('Ce navigateur ne sait pas fabriquer de video.'));
    var types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    var type = types.filter(function(t){ return MediaRecorder.isTypeSupported(t); })[0] || '';
    var flux = c.captureStream(FPS), rec = new MediaRecorder(flux, type ? { mimeType: type, videoBitsPerSecond: 5e6 } : {});
    var morceaux = [];
    rec.ondataavailable = function(e){ if (e.data && e.data.size) morceaux.push(e.data); };
    return new Promise(function(res){
      rec.onstop = function(){
        var t = rec.mimeType || type || 'video/webm';
        res({ blob: new Blob(morceaux, { type: t }), type: t, ext: /mp4/.test(t) ? 'mp4' : 'webm' });
      };
      rec.start(250);
      var t0 = performance.now();
      var boucle = function(){
        var T = (performance.now() - t0) / 1000;
        J.dessiner(Math.min(T, M.total));
        if (surProgres) surProgres(Math.min(.99, T / M.total));
        if (T < M.total) requestAnimationFrame(boucle); else rec.stop();
      };
      requestAnimationFrame(boucle);
    });
  }

  /* ---------------------------------------------------------- l'entree */
  function preparer(d){
    var A = { logo: null, adv: null, affiche: null, chef: null, chefV: null, photos: [], visages: [] };
    var chef = d.style === 'presentation' && d.staff && d.staff.chef ? d.staff.chef.photo : '';
    var aff = d.style === 'presentation' && d.evenement ? d.evenement.affiche : '';
    return Promise.all([
      polices(),
      d.style === 'affiche' ? policesEn(policeAff(d).url, AFF.faces) : null,
      image(LOGO).then(function(i){ A.logo = i; }),
      image(d.adversaire && d.adversaire.logo ? taille(d.adversaire.logo, 400) : '').then(function(i){ A.adv = i; }),
      image(aff ? taille(aff, 900) : '').then(function(i){ A.affiche = i; }),
      image(chef ? taille(chef, 1000) : '').then(function(i){ A.chef = i; A.chefV = i ? visage(i) : null; }),
      Promise.all((d.joueuses || []).map(function(p, k){
        return image(taille(p.photo, d.style === 'presentation' ? 1000 : 900)).then(function(i){ A.photos[k] = i; A.visages[k] = i ? visage(i) : null; });
      }))
    ]).then(function(){ return A; });
  }
  // l'affiche en image fixe : sa derniere image, complete
  function enImage(J){
    J.dessiner(Math.max(0, J.total - .05));
    return new Promise(function(res, rej){
      J.c.toBlob(function(b){ b ? res({ blob: b, type: 'image/png', ext: 'png' }) : rej(new Error('l’image n’a pas pu être tirée')); }, 'image/png');
    });
  }
  function fabriquer(d, surProgres){
    d = d || {};
    var affiche = d.style === 'affiche';
    if (!affiche && !(d.joueuses || []).length) return Promise.reject(new Error('Aucune joueuse dans la composition.'));
    if (surProgres) surProgres(0);
    return preparer(d).then(function(A){
      var J = chantier(d, A);
      return (affiche && d.sortie === 'png' ? enImage(J) : avcConfig(J.w, J.h).then(function(cfg){
        return cfg ? encoderMp4(J, cfg, surProgres) : enregistrer(J, surProgres);
      })).then(function(r){
        r.nom = String((affiche && d.nomAffiche) || d.nomFichier || (affiche ? 'baobabs-affiche' : 'baobabs-composition')).replace(/[^a-z0-9._-]+/gi, '-') +
                (d.style === 'presentation' ? '-presentation' : '') + J.format.suffixe + '.' + r.ext;
        return r;
      });
    });
  }
  function telecharger(d, surProgres){
    return fabriquer(d, surProgres).then(function(r){
      var u = URL.createObjectURL(r.blob), a = document.createElement('a');
      a.href = u; a.download = r.nom; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(u); }, 60000);
      return { nom: r.nom, type: r.type, taille: r.blob.size };
    });
  }
  // une image fixe a un instant donne : pour verifier la composition sans encoder
  function apercu(d, T){
    return preparer(d).then(function(A){
      var J = chantier(d, A);
      J.dessiner(Math.min(T, J.total));
      return { canvas: J.c, total: J.total };
    });
  }
  // la duree, sans rien charger : les scenes ne dependent pas des images
  function duree(d, style){
    var c = {}; for (var k in d) c[k] = d[k]; if (style) c.style = style;
    if (c.style === 'affiche'){ policeAff(c); return Math.round(monterAffiche(c, {}, 1080, 1350).total); }
    return Math.round(monter(c, { photos: [], visages: [] }).total);
  }

  /* ---------------------------------------------------------- le choix */
  // On demande, sous le bouton et sans fenetre : le format d'abord (il
  // reste choisi d'une fois sur l'autre), puis la video ou l'image.
  var choixOuvert = null, CLE_FORMAT = 'bbc-video-format';
  function fermerChoix(){ if (choixOuvert) choixOuvert(null); }
  function formatRetenu(affiche){
    var f = null; try { f = localStorage.getItem(CLE_FORMAT); } catch(e){}
    return FORMATS[f] && (affiche || FORMATS[f].compo) ? f : '4x5';
  }
  function choisir(btn, d){
    fermerChoix();
    d = d || {};
    var affiche = d.style === 'affiche', fmt = formatRetenu(affiche);
    if (!document.getElementById('bv-choix-style')){
      var st = document.createElement('style'); st.id = 'bv-choix-style';
      st.textContent =
        '.bv-choix{position:fixed;z-index:100000;width:340px;max-width:calc(100vw - 32px);padding:10px;border-radius:14px;' +
          'background:#0D2016;border:1px solid rgba(168,217,59,.35);box-shadow:0 18px 50px rgba(0,0,0,.55);color:#F3EFE6;font:inherit}' +
        '.bv-choix p{margin:4px 8px 8px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#A8D93B}' +
        '.bv-choix button{display:block;width:100%;text-align:left;margin:0 0 4px;padding:12px 14px;border-radius:10px;cursor:pointer;' +
          'background:transparent;border:1px solid transparent;color:inherit;font:inherit}' +
        '.bv-choix button:hover,.bv-choix button:focus-visible{background:rgba(168,217,59,.1);border-color:rgba(168,217,59,.45);outline:none}' +
        '.bv-choix b{display:block;font-size:15px;font-weight:700}' +
        '.bv-choix span{display:block;margin-top:3px;font-size:13px;line-height:1.35;color:rgba(243,239,230,.68)}' +
        // les formats : trois pastilles, chacune avec la forme de l'image
        '.bv-choix .bv-formats{display:flex;gap:6px;margin:0 0 10px}' +
        '.bv-choix .bv-f{flex:1 1 0;display:flex;flex-direction:column;align-items:center;gap:7px;width:auto;margin:0;padding:10px 4px 9px;' +
          'text-align:center;border:1px solid rgba(243,239,230,.14)}' +
        '.bv-choix .bv-f i{display:block;border:2px solid currentColor;border-radius:3px;opacity:.8}' +
        '.bv-choix .bv-f b{font-size:13px}' +
        '.bv-choix .bv-f span{margin:0;font-size:11px}' +
        '.bv-choix .bv-f[aria-pressed="true"]{background:rgba(168,217,59,.16);border-color:#A8D93B;color:#A8D93B}' +
        '.bv-choix .bv-f[aria-pressed="true"] span{color:#A8D93B}';
      document.head.appendChild(st);
    }
    var n = (d.joueuses || []).length, pages = pagesDe(joueusesDe(d)).length;
    var pastille = function(k){
      var f = FORMATS[k], hh = 26, ww = Math.round(hh * f.w / f.h);
      return '<button type="button" class="bv-f" data-f="' + k + '" aria-pressed="' + (k === fmt) + '" title="' + f.w + ' × ' + f.h + '">' +
        '<i style="width:' + ww + 'px;height:' + hh + 'px"></i><b>' + f.lib + '</b><span>' + f.ratio + '</span></button>';
    };
    var m = document.createElement('div');
    m.className = 'bv-choix'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', affiche ? 'L’affiche du match' : 'Quelle vidéo ?');
    m.innerHTML = '<p>Format</p><div class="bv-formats">' +
        Object.keys(FORMATS).filter(function(k){ return affiche || FORMATS[k].compo; }).map(pastille).join('') + '</div>' +
      (affiche
        ? '<p>Télécharger</p>' +
          '<button type="button" data-v="affiche" data-s="mp4"><b>La vidéo</b><span>MP4 · environ ' + duree(d, 'affiche') +
            ' s · l’adversaire, la date, l’heure, le terrain, domicile ou extérieur</span></button>' +
          '<button type="button" data-v="affiche" data-s="png"><b>L’affiche seule</b><span>Image PNG : la dernière image de la vidéo</span></button>'
        : '<p>Quelle vidéo ?</p>' +
          '<button type="button" data-v="presentation"><b>La présentation</b><span>Joueuse par joueuse, en grand, comme sur le site · environ ' +
            duree(d, 'presentation') + ' s</span></button>' +
          '<button type="button" data-v="liste"><b>La liste</b><span>' + (n > 1 ? 'Les ' + n + ' joueuses ' : 'La joueuse ') +
            (pages > 1 ? 'sur ' + pages + ' pages' : 'sur une page') + ', visages et noms · environ ' + duree(d, 'liste') + ' s</span></button>' +
          // « j'ai pas vu celle du match seul » : on la cherchait ici, a
          // cote des deux autres. Seulement quand le match a une date.
          (d.match && d.match.date
            ? '<p>Le match seul</p>' +
              '<button type="button" data-v="affiche" data-s="mp4"><b>L’annonce du match</b><span>Sans la composition : l’adversaire, la date, l’heure, le terrain, domicile ou extérieur · environ ' +
                duree(d, 'affiche') + ' s</span></button>' +
              '<button type="button" data-v="affiche" data-s="png"><b>L’affiche du match</b><span>La même annonce en image PNG</span></button>'
            : ''));
    document.body.appendChild(m);
    var r = btn ? btn.getBoundingClientRect() : { left: 16, right: 16, top: 16, bottom: 16 };
    var h = m.offsetHeight, lg = m.offsetWidth;
    var top = r.bottom + 8 + h > window.innerHeight - 8 ? Math.max(8, r.top - 8 - h) : r.bottom + 8;
    m.style.top = top + 'px';
    m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - lg - 8)) + 'px';
    return new Promise(function(res){
      var fini = function(v){
        choixOuvert = null;
        document.removeEventListener('mousedown', dehors, true);
        document.removeEventListener('keydown', touche, true);
        window.removeEventListener('scroll', defile, true);
        m.remove(); res(v);
      };
      var dehors = function(e){ if (!m.contains(e.target) && e.target !== btn) fini(null); };
      var touche = function(e){ if (e.key === 'Escape'){ e.preventDefault(); fini(null); if (btn) btn.focus(); } };
      var defile = function(e){ if (!m.contains(e.target)) fini(null); };
      m.querySelectorAll('button[data-f]').forEach(function(b){
        b.addEventListener('click', function(){
          fmt = b.getAttribute('data-f');
          try { localStorage.setItem(CLE_FORMAT, fmt); } catch(e){}
          m.querySelectorAll('button[data-f]').forEach(function(o){ o.setAttribute('aria-pressed', String(o === b)); });
        });
      });
      m.querySelectorAll('button[data-v]').forEach(function(b){
        b.addEventListener('click', function(){
          fini({ style: b.getAttribute('data-v'), format: fmt, sortie: b.getAttribute('data-s') || 'mp4' });
        });
      });
      document.addEventListener('mousedown', dehors, true);
      document.addEventListener('keydown', touche, true);
      window.addEventListener('scroll', defile, true);
      choixOuvert = fini;
      var premier = m.querySelector('button[data-v]'); if (premier) premier.focus();
    });
  }

  window.BaobabsVideo = { choisir: choisir, fabriquer: fabriquer, telecharger: telecharger, apercu: apercu, duree: duree };
})();
