/* =====================================================================
   BAOBABS VIDEO : LA COMPOSITION, EN VIDEO A TELECHARGER (30/09/2026)
   ---------------------------------------------------------------------
   « dans l'admin pouvoir avoir la composition en video a telecharger,
     pour chaque composition future aussi ».

   Le style est celui que le club a donne en reference : le « Starting
   Lineup » des Celtics (video Pinterest de 12 s, 720 x 900). Une carte
   titre sombre sur un vert texture, puis un volet en escalier de barres
   vertes, puis les joueuses : les visages en bandes a gauche, une liste
   encadree d'un filet a droite (numero dans un cercle, prenom, NOM), et
   une carte de fin.

   Format des reseaux : 1080 x 1350 (4:5), 30 images par seconde, sans
   son. La video se FABRIQUE image par image dans le navigateur (canvas),
   puis s'encode en MP4 H.264 par WebCodecs et mp4-muxer (jsdelivr, que
   la politique de securite du site accepte). Sans WebCodecs, elle
   s'enregistre en temps reel (MediaRecorder), en MP4 si le navigateur
   sait, en WebM sinon.

   Aucune donnee n'est inventee : tout vient de la composition posee
   dans l'admin, au moment du clic. Une composition future a donc sa
   video des qu'elle est posee.

   Contrat : un seul global, window.BaobabsVideo.
     telecharger(donnees, surProgres) -> Promise<{ nom, type }>
     fabriquer(donnees, surProgres)   -> Promise<{ blob, nom, type }>
   donnees = {
     genre: 'cinq' | 'selection',
     titre: 'Cinq majeur',            // le titre de la carte
     sur:   'Baobabs Basket Club',    // la ligne au-dessus
     infos: ['Baobabs vs X', 'Sam. 4 oct. · 19 h', 'Salle'],  // sous le titre, 3 lignes au plus
     adversaire: { nom, logo } | null,
     joueuses: [{ nom, no, photo, cap }],
     nomFichier: 'baobabs-cinq-majeur-2026-10-04'
   }
   ===================================================================== */
(function(){
  'use strict';
  if (window.BaobabsVideo) return;

  var W = 1080, H = 1350, FPS = 30;
  var VERT = '#A8D93B', VERT_PALE = '#E3F5B4', CREME = '#F3EFE6', GRIS = 'rgba(243,239,230,.62)';
  var LOGO = '/media/img/BBC_-_COLORED_LOGO_jjcrux.webp';
  var POLICES = 'https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800;900&family=Archivo:wght@500;600;700;800&display=swap';
  var MUXER = 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.1/build/mp4-muxer.js';
  var TITRE = '"Big Shoulders Display", Impact, sans-serif';
  var TEXTE = 'Archivo, system-ui, sans-serif';

  /* ---------------------------------------------------------- outils */
  function borne(x){ return x < 0 ? 0 : x > 1 ? 1 : x; }
  function sortie(x){ x = borne(x); return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); }        // expo : attaque franche, pose douce
  function quart(x){ x = borne(x); return x < .5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2; }
  function phase(t, debut, duree){ return borne((t - debut) / duree); }

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
  // navigateur refuserait d'en tirer une video
  function image(u){
    return new Promise(function(res){
      if (!u) return res(null);
      var i = new Image(); i.crossOrigin = 'anonymous'; i.decoding = 'async';
      i.onload = function(){ (i.decode ? i.decode() : Promise.resolve()).then(function(){ res(i); }, function(){ res(i); }); };
      i.onerror = function(){ res(null); };
      i.src = u;
    });
  }
  /* OU EST LE VISAGE. Les photos de l'effectif sont detourees : on lit la
     silhouette dans le canal alpha (le haut de la tete, et le centre des
     pixels pleins dans le haut de la silhouette). Une photo opaque n'a
     pas de silhouette : on retombe sur le haut de l'image. */
  function visage(img){
    var w = 120, h = Math.max(1, Math.round(img.naturalHeight / img.naturalWidth * w));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h);
    var d; try { d = x.getImageData(0, 0, w, h).data; } catch(e){ return { cx:.5, top:.02, haut:.96 }; }
    var top = -1, bas = -1, i, j;
    for (j = 0; j < h; j++) for (i = 0; i < w; i++) if (d[(j * w + i) * 4 + 3] > 60){ if (top < 0) top = j; bas = j; }
    if (top < 0) return { cx:.5, top:.02, haut:.96 };
    var hs = Math.max(1, bas - top), bande = Math.max(2, Math.round(hs * .12)), sx = 0, n = 0;
    for (j = top; j < Math.min(h, top + bande); j++) for (i = 0; i < w; i++) if (d[(j * w + i) * 4 + 3] > 60){ sx += i; n++; }
    var opaque = top === 0 && bas === h - 1 && d[3] > 60 && d[(w - 1) * 4 + 3] > 60;
    if (opaque) return { cx:.5, top:.02, haut:.96 };
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
    if (!txt) return;
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

  /* ---------------------------------------------------------- les scenes */
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
      x.font = '700 30px ' + TEXTE; if ('letterSpacing' in x) x.letterSpacing = '6px';
      x.fillText(String(d.sur || 'Baobabs Basket Club').toUpperCase(), W / 2, cy0 + 330); x.restore();
      if ('letterSpacing' in x) x.letterSpacing = '0px';
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
    var haut0 = 200, bas0 = 1220, hr = (bas0 - haut0) / N, g = 10;
    var px = 60, pw = 400, lx = 500, lw = 520;
    return { duree: 3.6 + N * .18, dessiner: function(x, t){
      // l'en-tete : le blason, et ce qu'on annonce
      var eh = sortie(phase(t, .1, .6));
      x.save(); x.globalAlpha = eh;
      if (A.logo) x.drawImage(A.logo, 60, 64, 96, 96);
      x.fillStyle = VERT; x.font = '700 26px ' + TEXTE; if ('letterSpacing' in x) x.letterSpacing = '5px';
      x.fillText(String(d.sur || 'Baobabs Basket Club').toUpperCase(), 180, 98);
      if ('letterSpacing' in x) x.letterSpacing = '0px';
      x.fillStyle = CREME; x.font = '900 64px ' + TITRE;
      x.fillText(String(d.titre || '').toUpperCase() + (nTot > 1 ? '  ' + (n0 + 1) + '/' + nTot : ''), 180, 156);
      if (d.adversaire && A.adv){ x.drawImage(A.adv, W - 60 - 84, 70, 84, 84); }
      x.restore();
      // le cadre de la liste
      var ec = sortie(phase(t, .2, .8));
      x.save(); x.globalAlpha = ec; x.strokeStyle = VERT; x.lineWidth = 3;
      x.strokeRect(lx, haut0, lw, bas0 - haut0);
      x.restore();
      lignes.forEach(function(p, r){
        var y0 = haut0 + r * hr, dep = .25 + r * .08;
        // LA BANDE DU VISAGE
        var ef = sortie(phase(t, dep, .9));
        x.save();
        x.beginPath(); x.rect(px, y0 + g / 2, pw, hr - g); x.clip();
        x.fillStyle = '#0A2215'; x.fillRect(px, y0, pw, hr);
        var im = A.photos[p.__k];
        if (im){
          var v = A.visages[p.__k], iw = im.naturalWidth, ih = im.naturalHeight;
          var cH = Math.max(40, v.haut * ih * .24), cW = cH * pw / (hr - g);
          if (cW > iw){ cW = iw; cH = cW * (hr - g) / pw; }
          // le haut de la tete a 10 % du bord : les cheveux et les bandeaux ne sont plus coupes
          var cxI = v.cx * iw, cyI = v.top * ih - cH * .1 + cH / 2;
          var sx = Math.min(Math.max(0, cxI - cW / 2), iw - cW), sy = Math.min(cyI - cH / 2, ih - cH);
          var zoom = 1.08 - .08 * ef + .03 * phase(t, 1.2, 3.5);
          x.globalAlpha = borne(ef * 1.6);
          x.translate(px + pw / 2 + (1 - ef) * 60, y0 + hr / 2); x.scale(zoom, zoom);
          x.drawImage(im, sx, sy, cW, cH, -pw / 2, -(hr - g) / 2, pw, hr - g);
        }
        x.restore();
        // LA RANGEE DE LA LISTE
        if (r > 0){ x.save(); x.globalAlpha = ec * .5; x.strokeStyle = VERT; x.lineWidth = 2;
          x.beginPath(); x.moveTo(lx, y0); x.lineTo(lx + lw, y0); x.stroke(); x.restore(); }
        var cy = y0 + hr / 2, rr = Math.min(38, hr * .2), ecr = sortie(phase(t, dep + .1, .5));
        if (p.no !== '' && p.no != null){
          x.save(); x.globalAlpha = ecr; x.translate(lx + 30 + rr, cy); x.scale(.55 + .45 * ecr, .55 + .45 * ecr);
          x.beginPath(); x.arc(0, 0, rr, 0, Math.PI * 2); x.strokeStyle = VERT; x.lineWidth = 3; x.stroke();
          x.fillStyle = CREME; x.textAlign = 'center'; x.textBaseline = 'middle';
          x.font = '800 ' + Math.round(rr * .95) + 'px ' + TEXTE; x.fillText(String(p.no), 0, 2); x.restore();
        }
        var tx = lx + 30 + rr * 2 + 24, larg = lx + lw - tx - 24;
        var nm = nomDe(p.nom);
        var tp = Math.min(34, Math.round(hr * .17)), tf = ajuster(x, nm.fam, '900 {t}px ' + TITRE, Math.round(hr * .42), larg);
        montant(x, nm.pre, tx, cy - tf * .32, '600 ' + tp + 'px ' + TEXTE, t, dep + .12, .015, VERT);
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
      x.fillText((d.infos || []).slice(0, 2).join('  ·  '), 60, 1290); x.restore();
    } };
  }
  function sceneFin(d, A){
    return { duree: 2.2, dessiner: function(x, t){
      var eb = sortie(phase(t, .1, .8)), tb = 300 * (.8 + .2 * eb);
      if (A.logo){ x.save(); x.globalAlpha = eb; x.drawImage(A.logo, W / 2 - tb / 2, 380 + (300 - tb) / 2, tb, tb); x.restore(); }
      montant(x, 'BAOBABS', W / 2, 850, '900 150px ' + TITRE, t, .3, .03, CREME, 'centre');
      montant(x, 'BASKET CLUB', W / 2, 960, '900 96px ' + TITRE, t, .42, .025, VERT, 'centre');
      var ei = sortie(phase(t, .8, .6));
      x.save(); x.globalAlpha = ei; x.fillStyle = GRIS; x.textAlign = 'center'; x.font = '600 32px ' + TEXTE;
      x.fillText((d.infos || []).slice(0, 2).join('  ·  '), W / 2, 1060); x.restore();
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
  function monter(d, A){
    var js = (d.joueuses || []).map(function(p, k){ var c = {}; for (var q in p) c[q] = p[q]; c.__k = k; return c; });
    var pages = [], parPage = js.length <= 6 ? js.length : Math.ceil(js.length / Math.ceil(js.length / 6));
    for (var i = 0; i < js.length; i += parPage) pages.push(js.slice(i, i + parPage));
    var sc = [sceneTitre(d, A)];
    pages.forEach(function(pg, k){ sc.push(scenePage(d, A, pg, k, pages.length)); });
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
          if (f < n) return setTimeout(pas, 0);
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
  function fabriquer(d, surProgres){
    d = d || {};
    if (!(d.joueuses || []).length) return Promise.reject(new Error('Aucune joueuse dans la composition.'));
    if (surProgres) surProgres(0);
    var A = { logo: null, adv: null, photos: [], visages: [] };
    return Promise.all([
      polices(),
      image(LOGO).then(function(i){ A.logo = i; }),
      image(d.adversaire && d.adversaire.logo ? taille(d.adversaire.logo, 300) : '').then(function(i){ A.adv = i; }),
      Promise.all((d.joueuses || []).map(function(p, k){
        return image(taille(p.photo, 900)).then(function(i){ A.photos[k] = i; A.visages[k] = i ? visage(i) : null; });
      }))
    ]).then(function(){
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var x = c.getContext('2d', { alpha: false });
      var F = fondPret(), M = monter(d, A);
      return avcConfig().then(function(cfg){
        return cfg ? encoderMp4(c, x, F, M, cfg, surProgres) : enregistrer(c, x, F, M, surProgres);
      }).then(function(r){
        r.nom = String(d.nomFichier || 'baobabs-composition').replace(/[^a-z0-9._-]+/gi, '-') + '.' + r.ext;
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
    return fabriquerApercu(d, T);
  }
  function fabriquerApercu(d, T){
    var A = { logo: null, adv: null, photos: [], visages: [] };
    return Promise.all([
      polices(),
      image(LOGO).then(function(i){ A.logo = i; }),
      image(d.adversaire && d.adversaire.logo ? taille(d.adversaire.logo, 300) : '').then(function(i){ A.adv = i; }),
      Promise.all((d.joueuses || []).map(function(p, k){
        return image(taille(p.photo, 900)).then(function(i){ A.photos[k] = i; A.visages[k] = i ? visage(i) : null; });
      }))
    ]).then(function(){
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var x = c.getContext('2d', { alpha: false }), M = monter(d, A);
      image_a(x, fondPret(), M, Math.min(T, M.total));
      return { canvas: c, total: M.total };
    });
  }

  window.BaobabsVideo = { fabriquer: fabriquer, telecharger: telecharger, apercu: apercu };
})();
