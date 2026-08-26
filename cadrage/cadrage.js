/* ============================================================================
   BAOBABS — CADRAGE
   ----------------------------------------------------------------------------
   Un atelier minuscule : une image, un cadre à la forme exacte de celui du
   site, et le doigt pour placer l'image dedans. Rien d'autre.

   Pourquoi un fichier séparé, comme le Studio : `admin-matchs.html` est une
   seule IIFE de 15 000 lignes où deux fonctions de même nom s'écrasent en
   silence. Un fichier à part rend la collision impossible.

   Ce que l'atelier NE fait pas, volontairement : il ne connaît ni Supabase,
   ni les tables, ni les noms de réglages. Il reçoit une image et six nombres,
   il rend six nombres. Tout le reste est l'affaire de l'hôte.

   Le modèle de rendu est celui déjà employé pour les photos de joueuses et
   les images d'actualités — même trois valeurs, même CSS :

       object-fit: cover;
       object-position: X% Y%;
       transform: scale(Z/100);
       transform-origin: X% Y%;

   S'en écarter aurait donné deux cadrages qui ne tombent pas au même endroit
   pour les mêmes chiffres.
   ========================================================================= */
(function(){
  'use strict';

  var racine = null;      // l'élément #bcadrage
  var etat = null;        // la session d'édition en cours
  var poseeSur = null;    // l'élément qui avait le focus avant l'ouverture

  var DEFAUT = { x:50, y:50, zoom:100 };

  // --------------------------------------------------------------------
  // Outils
  // --------------------------------------------------------------------
  function nb(v, repli){
    var n = parseFloat(v);
    return (v === null || v === '' || v === undefined || isNaN(n)) ? repli : n;
  }
  function borne(v, min, max){ return v < min ? min : (v > max ? max : v); }
  function $(sel){ return racine.querySelector(sel); }

  // Le téléphone n'a de valeurs propres que si quelqu'un les a posées : un
  // champ vide veut dire « fais comme l'ordinateur », pas « centre l'image ».
  function mobileRegle(v){
    return v && (v.mx !== null && v.mx !== '' && v.mx !== undefined);
  }

  // --------------------------------------------------------------------
  // Le montage — une seule fois
  // --------------------------------------------------------------------
  function monter(hote){
    if (racine) return racine;
    racine = hote;
    racine.innerHTML =
      '<div class="bc-panneau" role="dialog" aria-modal="true" aria-labelledby="bc-titre">' +
        '<div class="bc-tete">' +
          '<h2 class="bc-titre" id="bc-titre">Cadrage</h2>' +
          '<div class="bc-ecrans" role="tablist">' +
            '<button type="button" class="bc-ecran is-on" data-ecran="d" role="tab" aria-selected="true">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>' +
              'Ordinateur</button>' +
            '<button type="button" class="bc-ecran" data-ecran="m" role="tab" aria-selected="false">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>' +
              'Téléphone</button>' +
          '</div>' +
          '<button type="button" class="bc-fermer" aria-label="Fermer">&times;</button>' +
        '</div>' +

        '<div class="bc-scene">' +
          '<div class="bc-suit" hidden>' +
            '<span>Sur téléphone, l\'image est cadrée <b>comme sur ordinateur</b>. Le cadre n\'a pourtant pas la même forme.</span>' +
            '<button type="button" data-detacher>Régler le téléphone à part</button>' +
          '</div>' +
          '<div class="bc-cadre"><img alt=""><div class="bc-tiers" aria-hidden="true"><span></span><span></span><span></span><span></span></div></div>' +
          '<p class="bc-aide">Faites glisser l\'image pour la placer. La molette zoome.</p>' +
        '</div>' +

        '<div class="bc-pied">' +
          '<div class="bc-zoom">' +
            '<label for="bc-zoom">Zoom</label>' +
            '<input type="range" id="bc-zoom" min="100" max="250" step="1" value="100">' +
            '<span class="bc-val">100 %</span>' +
          '</div>' +
          '<button type="button" class="bc-btn" data-recentrer>Recentrer</button>' +
          '<button type="button" class="bc-btn" data-annuler>Annuler</button>' +
          '<button type="button" class="bc-btn bc-btn--fort" data-valider>Enregistrer le cadrage</button>' +
        '</div>' +
      '</div>';

    brancher();
    return racine;
  }

  // --------------------------------------------------------------------
  // Ouverture
  // --------------------------------------------------------------------
  // opts = {
  //   url,                 l'image à cadrer
  //   titre,               ce qu'on est en train de cadrer
  //   ratioD, ratioM,      largeur/hauteur du cadre sur le site (ordi, tél.)
  //   valeurs,             {x,y,zoom,mx,my,mzoom} — mobile vide = suit l'ordi
  //   onValider(valeurs)
  // }
  function ouvrir(opts){
    if (!racine) return;
    opts = opts || {};
    if (!opts.url){ return; }

    poseeSur = document.activeElement;

    etat = {
      url: opts.url,
      ratioD: nb(opts.ratioD, 1.6),
      ratioM: nb(opts.ratioM, nb(opts.ratioD, 1.6)),
      vue: 'd',
      onValider: typeof opts.onValider === 'function' ? opts.onValider : null,
      nw: 0, nh: 0,
      v: {
        x:    nb((opts.valeurs||{}).x, DEFAUT.x),
        y:    nb((opts.valeurs||{}).y, DEFAUT.y),
        zoom: nb((opts.valeurs||{}).zoom, DEFAUT.zoom),
        mx:    mobileRegle(opts.valeurs) ? nb(opts.valeurs.mx, DEFAUT.x) : null,
        my:    mobileRegle(opts.valeurs) ? nb(opts.valeurs.my, DEFAUT.y) : null,
        mzoom: mobileRegle(opts.valeurs) ? nb(opts.valeurs.mzoom, DEFAUT.zoom) : null
      }
    };

    $('.bc-titre').textContent = opts.titre ? ('Cadrage — ' + opts.titre) : 'Cadrage';
    var img = $('.bc-cadre img');
    img.onload = function(){
      // Une grande image met un instant à arriver ; on peut avoir refermé
      // l'atelier entre-temps. Sans ce garde-fou, l'atelier lève une erreur
      // dans la console d'un utilisateur qui a simplement été rapide.
      if (!etat) return;
      etat.nw = img.naturalWidth || 0;
      etat.nh = img.naturalHeight || 0;
    };
    img.src = opts.url;

    choisirEcran('d');
    racine.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    $('[data-valider]').focus();
  }

  function fermer(){
    if (!racine) return;
    racine.classList.remove('is-open');
    document.body.style.overflow = '';
    etat = null;
    if (poseeSur && poseeSur.focus) poseeSur.focus();
    poseeSur = null;
  }

  // --------------------------------------------------------------------
  // La vue courante
  // --------------------------------------------------------------------
  // Sur l'onglet Téléphone tant qu'il « suit l'ordinateur », on montre les
  // valeurs de l'ordinateur — mais dans le cadre du téléphone. C'est
  // précisément là qu'on voit qu'un visage bien placé en 16/9 sort du cadre
  // en 3/4.
  function courant(){
    if (etat.vue === 'm' && mobileRegle(etat.v)) return { x:etat.v.mx, y:etat.v.my, zoom:etat.v.mzoom };
    return { x:etat.v.x, y:etat.v.y, zoom:etat.v.zoom };
  }
  function poser(x, y, z){
    if (etat.vue === 'm' && mobileRegle(etat.v)){
      etat.v.mx = x; etat.v.my = y; etat.v.mzoom = z;
    } else {
      etat.v.x = x; etat.v.y = y; etat.v.zoom = z;
    }
  }
  function modifiable(){ return etat.vue === 'd' || mobileRegle(etat.v); }

  function choisirEcran(vue){
    etat.vue = vue;
    racine.querySelectorAll('.bc-ecran').forEach(function(b){
      var on = b.getAttribute('data-ecran') === vue;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var suit = $('.bc-suit');
    suit.hidden = !(vue === 'm' && !mobileRegle(etat.v));
    peindre();
  }

  // --------------------------------------------------------------------
  // Peinture
  // --------------------------------------------------------------------
  function peindre(){
    if (!etat) return;
    var c = courant();
    var cadre = $('.bc-cadre'), img = cadre.querySelector('img');
    var ratio = etat.vue === 'm' ? etat.ratioM : etat.ratioD;

    // Le cadre garde la forme du site ; sa taille à l'écran n'a aucune
    // importance, les valeurs sont des pourcentages.
    var largeurMax = etat.vue === 'm' ? 320 : 560, hauteurMax = 340;
    var l = largeurMax, h = l / ratio;
    if (h > hauteurMax){ h = hauteurMax; l = h * ratio; }
    cadre.style.width  = Math.round(l) + 'px';
    cadre.style.height = Math.round(h) + 'px';

    img.style.objectPosition  = c.x + '% ' + c.y + '%';
    img.style.transform       = 'scale(' + (c.zoom / 100) + ')';
    img.style.transformOrigin = c.x + '% ' + c.y + '%';
    img.style.opacity = modifiable() ? '1' : '.72';

    var z = $('#bc-zoom');
    z.value = c.zoom;
    z.disabled = !modifiable();
    $('.bc-val').textContent = Math.round(c.zoom) + ' %';
    $('[data-recentrer]').disabled = !modifiable();
    cadre.style.cursor = modifiable() ? 'grab' : 'not-allowed';
    $('.bc-aide').textContent = modifiable()
      ? 'Faites glisser l\'image pour la placer. La molette zoome.'
      : 'Réglage hérité de l\'ordinateur — détachez-le pour le modifier ici.';
  }

  // --------------------------------------------------------------------
  // Le déplacement
  // --------------------------------------------------------------------
  // Combien de pourcent vaut un pixel de glissement ? Il faut le débordement
  // réel de l'image dans son cadre, qui dépend de la forme de l'image, de
  // celle du cadre et du zoom. Sans ce calcul, l'image suivrait le doigt
  // trois fois trop vite sur une photo panoramique et pas du tout sur une
  // photo carrée.
  function debordement(){
    var cadre = $('.bc-cadre');
    var fw = cadre.clientWidth, fh = cadre.clientHeight;
    var nw = etat.nw || fw, nh = etat.nh || fh;
    var couvre = Math.max(fw / nw, fh / nh);
    var cw = nw * couvre, ch = nh * couvre;
    var z = courant().zoom / 100;
    return { x: Math.max(0, cw - fw / z), y: Math.max(0, ch - fh / z), z: z };
  }

  function glisser(dxEcran, dyEcran){
    var d = debordement();
    var c = courant();
    var nx = c.x, ny = c.y;
    if (d.x > 0.5) nx = borne(c.x - (dxEcran / d.z) / d.x * 100, 0, 100);
    if (d.y > 0.5) ny = borne(c.y - (dyEcran / d.z) / d.y * 100, 0, 100);
    poser(Math.round(nx * 10) / 10, Math.round(ny * 10) / 10, c.zoom);
    peindre();
  }

  // --------------------------------------------------------------------
  // Branchements
  // --------------------------------------------------------------------
  function brancher(){
    racine.querySelectorAll('.bc-ecran').forEach(function(b){
      b.addEventListener('click', function(){ if (etat) choisirEcran(b.getAttribute('data-ecran')); });
    });

    $('[data-detacher]').addEventListener('click', function(){
      if (!etat) return;
      // On part de ce que montre l'ordinateur : détacher n'est pas remettre
      // à zéro, c'est cesser de suivre.
      etat.v.mx = etat.v.x; etat.v.my = etat.v.y; etat.v.mzoom = etat.v.zoom;
      choisirEcran('m');
    });

    $('#bc-zoom').addEventListener('input', function(){
      if (!etat || !modifiable()) return;
      var c = courant();
      poser(c.x, c.y, nb(this.value, 100));
      peindre();
    });

    $('[data-recentrer]').addEventListener('click', function(){
      if (!etat || !modifiable()) return;
      poser(DEFAUT.x, DEFAUT.y, DEFAUT.zoom);
      peindre();
    });

    $('[data-annuler]').addEventListener('click', fermer);
    $('.bc-fermer').addEventListener('click', fermer);

    $('[data-valider]').addEventListener('click', function(){
      if (!etat) return;
      var sortie = {
        x: etat.v.x, y: etat.v.y, zoom: etat.v.zoom,
        mx: etat.v.mx, my: etat.v.my, mzoom: etat.v.mzoom
      };
      var cb = etat.onValider;
      fermer();
      if (cb) cb(sortie);
    });

    // Fermer en cliquant à côté du panneau, jamais dedans.
    racine.addEventListener('mousedown', function(e){ if (e.target === racine) fermer(); });

    document.addEventListener('keydown', function(e){
      if (!racine.classList.contains('is-open')) return;
      if (e.key === 'Escape'){ e.preventDefault(); fermer(); }
    });

    // ---- glisser au doigt comme à la souris ----
    var cadre = $('.bc-cadre');
    var actif = false, px = 0, py = 0;

    cadre.addEventListener('pointerdown', function(e){
      if (!etat || !modifiable()) return;
      actif = true; px = e.clientX; py = e.clientY;
      cadre.classList.add('is-drag');
      // La capture n'est pas indispensable au geste, seulement au confort
      // quand le doigt sort du cadre. Un navigateur qui la refuse ne doit
      // pas faire échouer le déplacement.
      try { cadre.setPointerCapture(e.pointerId); } catch(err){}
    });
    cadre.addEventListener('pointermove', function(e){
      if (!actif) return;
      var dx = e.clientX - px, dy = e.clientY - py;
      px = e.clientX; py = e.clientY;
      glisser(dx, dy);
    });
    function relacher(e){
      if (!actif) return;
      actif = false;
      cadre.classList.remove('is-drag');
      try { cadre.releasePointerCapture(e.pointerId); } catch(err){}
    }
    cadre.addEventListener('pointerup', relacher);
    cadre.addEventListener('pointercancel', relacher);

    cadre.addEventListener('wheel', function(e){
      if (!etat || !modifiable()) return;
      e.preventDefault();
      var c = courant();
      poser(c.x, c.y, borne(c.zoom + (e.deltaY > 0 ? -4 : 4), 100, 250));
      peindre();
    }, { passive:false });
  }

  window.BaobabsCadrage = {
    monter: monter,
    ouvrir: ouvrir,
    fermer: fermer,
    estOuvert: function(){ return !!(racine && racine.classList.contains('is-open')); }
  };
})();
