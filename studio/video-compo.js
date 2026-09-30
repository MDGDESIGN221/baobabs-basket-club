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

   Format des reseaux : 1080 x 1350 (4:5), 30 images par seconde, sans
   son. La video se FABRIQUE image par image dans le navigateur (canvas),
   puis s'encode en MP4 H.264 par WebCodecs et mp4-muxer (jsdelivr, que
   la politique de securite du site accepte). Sans WebCodecs, elle
   s'enregistre en temps reel (MediaRecorder), en MP4 si le navigateur
   sait, en WebM sinon.

   Aucune donnee n'est inventee : tout vient de ce que l'admin a sous la
   main au moment du clic. Une composition future a donc sa video des
   qu'elle est posee.

   Contrat : un seul global, window.BaobabsVideo.
     choisir(bouton, donnees)          -> Promise<'presentation' | 'liste' | null>
     telecharger(donnees, surProgres)  -> Promise<{ nom, type, taille }>
     fabriquer(donnees, surProgres)    -> Promise<{ blob, nom, type }>
     apercu(donnees, T)                -> Promise<{ canvas, total }>
   donnees = {
     style: 'presentation' | 'liste',
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

  var W = 1080, H = 1350, FPS = 30;
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
  function fondPret(){
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, W * .35, H);
    g.addColorStop(0, '#1C6038'); g.addColorStop(.5, '#10412A'); g.addColorStop(1, '#082417');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    var r = x.createRadialGradient(W * .72, H * .12, 0, W * .72, H * .12, W * .9);
    r.addColorStop(0, 'rgba(168,217,59,.16)'); r.addColorStop(1, 'rgba(168,217,59,0)');
    x.fillStyle = r; x.fillRect(0, 0, W, H);
    // la trame du site, tres pale, en biais
    x.save(); x.globalAlpha = .05; x.strokeStyle = CREME; x.lineWidth = 2;
    for (var k = -H; k < W + H; k += 22){ x.beginPath(); x.moveTo(k, 0); x.lineTo(k - H * .4, H); x.stroke(); }
    x.restore();
    // le grain : une image de retransmission n'a jamais un fond lisse
    var bruit = x.getImageData(0, 0, W, H), d = bruit.data;
    for (var i = 0; i < d.length; i += 4){ var v = (Math.random() - .5) * 18; d[i] += v; d[i + 1] += v; d[i + 2] += v; }
    x.putImageData(bruit, 0, 0);
    return c;
  }
  function fond(x, F, T, total){
    var s = 1 + .035 * (T / total);
    x.save(); x.translate(W / 2, H / 2); x.scale(s, s); x.translate(-W / 2, -H / 2);
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

  /* ---------------------------------------------------------- les encodeurs */
  function avcConfig(){
    if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return Promise.resolve(null);
    var codecs = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.640029'];
    var essayer = function(i){
      if (i >= codecs.length) return Promise.resolve(null);
      var cfg = { codec: codecs[i], width: W, height: H, bitrate: 5e6, framerate: FPS, avc: { format: 'avc' } };
      return VideoEncoder.isConfigSupported(cfg).then(function(r){ return r && r.supported ? cfg : essayer(i + 1); }, function(){ return essayer(i + 1); });
    };
    return essayer(0);
  }
  function encoderMp4(c, x, F, M, cfg, surProgres){
    return (window.Mp4Muxer ? Promise.resolve() : charger(MUXER)).then(function(){
      var cible = new Mp4Muxer.ArrayBufferTarget();
      var mux = new Mp4Muxer.Muxer({ target: cible, fastStart: 'in-memory',
        video: { codec: 'avc', width: W, height: H, frameRate: FPS } });
      var erreur = null;
      var enc = new VideoEncoder({
        output: function(chunk, meta){ mux.addVideoChunk(chunk, meta); },
        error: function(e){ erreur = e; }
      });
      enc.configure(cfg);
      var n = Math.ceil(M.total * FPS), f = 0;
      return new Promise(function(res, rej){
        var pas = function(){
          if (erreur) return rej(erreur);
          // on ne laisse pas la file de l'encodeur gonfler : la memoire
          // d'un telephone d'entree de gamme suit
          var lot = 0;
          while (f < n && lot < 6 && enc.encodeQueueSize < 12){
            image_a(x, F, M, f / FPS);
            var vf = new VideoFrame(c, { timestamp: Math.round(f * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
            enc.encode(vf, { keyFrame: f % (FPS * 2) === 0 }); vf.close();
            f++; lot++;
          }
          if (surProgres) surProgres(f / n * .96);
          if (f < n) return cede(pas);
          enc.flush().then(function(){
            mux.finalize();
            if (surProgres) surProgres(1);
            res({ blob: new Blob([cible.buffer], { type: 'video/mp4' }), type: 'video/mp4', ext: 'mp4' });
          }, rej);
        };
        pas();
      });
    });
  }
  function enregistrer(c, x, F, M, surProgres){
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
        image_a(x, F, M, Math.min(T, M.total));
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
      image(LOGO).then(function(i){ A.logo = i; }),
      image(d.adversaire && d.adversaire.logo ? taille(d.adversaire.logo, 400) : '').then(function(i){ A.adv = i; }),
      image(aff ? taille(aff, 900) : '').then(function(i){ A.affiche = i; }),
      image(chef ? taille(chef, 1000) : '').then(function(i){ A.chef = i; A.chefV = i ? visage(i) : null; }),
      Promise.all((d.joueuses || []).map(function(p, k){
        return image(taille(p.photo, d.style === 'presentation' ? 1000 : 900)).then(function(i){ A.photos[k] = i; A.visages[k] = i ? visage(i) : null; });
      }))
    ]).then(function(){ return A; });
  }
  function fabriquer(d, surProgres){
    d = d || {};
    if (!(d.joueuses || []).length) return Promise.reject(new Error('Aucune joueuse dans la composition.'));
    if (surProgres) surProgres(0);
    return preparer(d).then(function(A){
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var x = c.getContext('2d', { alpha: false });
      var F = fondPret(), M = monter(d, A);
      return avcConfig().then(function(cfg){
        return cfg ? encoderMp4(c, x, F, M, cfg, surProgres) : enregistrer(c, x, F, M, surProgres);
      }).then(function(r){
        r.nom = String(d.nomFichier || 'baobabs-composition').replace(/[^a-z0-9._-]+/gi, '-') +
                (d.style === 'presentation' ? '-presentation' : '') + '.' + r.ext;
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
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var x = c.getContext('2d', { alpha: false }), M = monter(d, A);
      image_a(x, fondPret(), M, Math.min(T, M.total));
      return { canvas: c, total: M.total };
    });
  }
  // la duree, sans rien charger : les scenes ne dependent pas des images
  function duree(d, style){
    var c = {}; for (var k in d) c[k] = d[k]; c.style = style;
    return Math.round(monter(c, { photos: [], visages: [] }).total);
  }

  /* ---------------------------------------------------------- le choix */
  // Deux videos : on demande laquelle, sous le bouton, sans fenetre.
  var choixOuvert = null;
  function fermerChoix(){ if (choixOuvert) choixOuvert(null); }
  function choisir(btn, d){
    fermerChoix();
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
        '.bv-choix span{display:block;margin-top:3px;font-size:13px;line-height:1.35;color:rgba(243,239,230,.68)}';
      document.head.appendChild(st);
    }
    var n = (d && d.joueuses || []).length, pages = pagesDe(joueusesDe(d || {})).length;
    var m = document.createElement('div');
    m.className = 'bv-choix'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Quelle vidéo ?');
    m.innerHTML = '<p>Quelle vidéo ?</p>' +
      '<button type="button" data-v="presentation"><b>La présentation</b><span>Joueuse par joueuse, en grand, comme sur le site · environ ' +
        duree(d || {}, 'presentation') + ' s</span></button>' +
      '<button type="button" data-v="liste"><b>La liste</b><span>' + (n > 1 ? 'Les ' + n + ' joueuses ' : 'La joueuse ') +
        (pages > 1 ? 'sur ' + pages + ' pages' : 'sur une page') + ', visages et noms · environ ' + duree(d || {}, 'liste') + ' s</span></button>';
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
      m.querySelectorAll('button[data-v]').forEach(function(b){
        b.addEventListener('click', function(){ fini(b.getAttribute('data-v')); });
      });
      document.addEventListener('mousedown', dehors, true);
      document.addEventListener('keydown', touche, true);
      window.addEventListener('scroll', defile, true);
      choixOuvert = fini;
      var premier = m.querySelector('button'); if (premier) premier.focus();
    });
  }

  window.BaobabsVideo = { choisir: choisir, fabriquer: fabriquer, telecharger: telecharger, apercu: apercu, duree: duree };
})();
