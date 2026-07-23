/* =====================================================================
   Baobabs Basket Club — Animation signature : ballon 3D (Three.js)
   Module autonome, sans dépendance sur le reste du site.

   Prérequis dans la page hôte :
   1. Charger Three.js AVANT ce script (pas en defer, pour garantir
      que THREE existe bien au moment où ce fichier s'exécute) :
        <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
   2. Un <canvas id="bb-ball-canvas"> quelque part dans le <body>,
      stylé en position fixe plein écran, display:none par défaut :
        <canvas id="bb-ball-canvas" style="position:fixed;inset:0;
          width:100vw;height:100vh;z-index:9999;pointer-events:none;
          display:none"></canvas>
   3. Charger ce script APRÈS le canvas et APRÈS Three.js.

   API exposée : window.BBBall
     BBBall.playRoll()                          → ballon qui roule et rebondit à travers l'écran
     BBBall.playDribbleOverCards(selecteurCSS)   → dribble devant/derrière les enfants du conteneur ciblé
     BBBall.stop()                               → arrête l'animation en cours et cache le canvas
     BBBall.diag()                               → { canvasFound, threeLoaded } — utilisé par le badge de debug
   ===================================================================== */
(function(){
  var canvas = document.getElementById('bb-ball-canvas');

  // Le badge de debug (voir index.html) doit pouvoir lire un diagnostic
  // même si le canvas est absent — donc window.BBBall est TOUJOURS défini,
  // avec un diag() minimal, avant tout "return" prématuré.
  window.BBBall = window.BBBall || {};
  window.BBBall.diag = function(){
    return {
      canvasFound: !!document.getElementById('bb-ball-canvas'),
      threeLoaded: typeof THREE !== 'undefined'
    };
  };

  if (!canvas) { console.warn('[BBBall] #bb-ball-canvas introuvable dans la page — animation désactivée.'); return; }

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ready = false, renderer, scene, camera, ball, shadowMesh, ballRadius = 40;
  var rafId = null;

  function init(){
    if (ready) return true;
    if (reduceMotion) { console.info('[BBBall] prefers-reduced-motion actif — animation désactivée.'); return false; }
    if (typeof THREE === 'undefined') { console.warn('[BBBall] THREE indisponible — Three.js a-t-il bien chargé avant ce script ?'); return false; }

    var W = window.innerWidth, H = window.innerHeight;
    renderer = new THREE.WebGLRenderer({canvas: canvas, alpha: true, antialias: true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 2000);
    camera.position.set(0, 0, 700);

    var key = new THREE.DirectionalLight(0xF3EFE6, 1.1); key.position.set(200, 300, 400); scene.add(key);
    var fill = new THREE.DirectionalLight(0xA8D93B, 0.35); fill.position.set(-300, -100, 200); scene.add(fill);
    scene.add(new THREE.AmbientLight(0x0F4030, 0.55));

    var tex = makeBallTexture();
    ball = new THREE.Mesh(
      new THREE.SphereGeometry(ballRadius, 40, 40),
      new THREE.MeshStandardMaterial({map: tex, roughness: 0.55, metalness: 0.08, bumpMap: tex, bumpScale: 1.4})
    );
    scene.add(ball);

    shadowMesh = new THREE.Mesh(
      new THREE.CircleGeometry(ballRadius * 0.9, 28),
      new THREE.MeshBasicMaterial({color: 0x000000, transparent: true, opacity: 0.3})
    );
    shadowMesh.rotation.x = -Math.PI / 2;
    scene.add(shadowMesh);

    window.addEventListener('resize', function(){
      W = window.innerWidth; H = window.innerHeight;
      camera.aspect = W / H; camera.updateProjectionMatrix();
      renderer.setSize(W, H);
    });

    ready = true;
    console.info('[BBBall] initialisé.');
    return true;
  }

  function makeBallTexture(){
    var size = 512;
    var c = document.createElement('canvas'); c.width = size; c.height = size;
    var ctx = c.getContext('2d');
    var grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#D9B877'); grad.addColorStop(0.5, '#C6A257'); grad.addColorStop(1, '#9C7C3D');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#A8D93B'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, size * 0.5); ctx.lineTo(size, size * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size * 0.5, 0); ctx.lineTo(size * 0.5, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size * 0.5, 0); ctx.bezierCurveTo(size * 0.15, size * 0.25, size * 0.15, size * 0.75, size * 0.5, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size * 0.5, 0); ctx.bezierCurveTo(size * 0.85, size * 0.25, size * 0.85, size * 0.75, size * 0.5, size); ctx.stroke();
    ctx.strokeStyle = 'rgba(10,27,13,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(size * 0.5, size * 0.5, size * 0.46, 0, Math.PI * 2); ctx.stroke();
    var t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
  }

  function stop(){
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    canvas.style.display = 'none';
  }

  function toScene(sx, sy){
    var W = window.innerWidth, H = window.innerHeight;
    return {x: (sx - W / 2) * 0.62, y: -(sy - H / 2) * 0.62};
  }

  function playRoll(){
    if (!init()) return;
    stop();
    canvas.style.display = 'block';
    var W = window.innerWidth, H = window.innerHeight;
    var groundY = H * 0.5;
    var dur = 2400;
    var start = performance.now();
    function frame(now){
      var elapsed = now - start;
      var prog = Math.min(elapsed / dur, 1);
      var sx = prog * (W + 200) - 100;
      var bounceHeight = Math.abs(Math.sin((elapsed / 1000) * 4.6 * Math.PI)) * 44 * (1 - prog * 0.3);
      var sy = groundY - bounceHeight;
      var p = toScene(sx, sy);
      ball.position.set(p.x, p.y, 0);
      ball.rotation.z -= 0.22;
      var pShadow = toScene(sx, groundY);
      shadowMesh.position.set(pShadow.x, pShadow.y, -1);
      var squish = 1 - (bounceHeight / 44) * 0.15;
      shadowMesh.scale.set(1 + (1 - squish) * 1.4, 1 + (1 - squish) * 1.4, 1);
      shadowMesh.material.opacity = 0.3 - (bounceHeight / 44) * 0.16;
      renderer.render(scene, camera);
      if (prog < 1) rafId = requestAnimationFrame(frame);
      else stop();
    }
    rafId = requestAnimationFrame(frame);
  }

  function playDribbleOverCards(containerSelector){
    if (!init()) return;
    var container = document.querySelector(containerSelector);
    if (!container) { console.warn('[BBBall] conteneur introuvable :', containerSelector); return; }
    var cards = Array.prototype.slice.call(container.children);
    if (!cards.length) { console.warn('[BBBall] aucun enfant dans le conteneur :', containerSelector); return; }
    stop();
    canvas.style.display = 'block';
    var rects = cards.map(function(el){
      var r = el.getBoundingClientRect();
      return {el: el, cx: r.left + r.width / 2, cy: r.top + r.height * 0.15, w: r.width};
    });
    var W = window.innerWidth;
    var startX = -80, endX = W + 80;
    var dur = 3000;
    var start = performance.now();
    var baseY = rects[0].cy + 40;
    function frame(now){
      var elapsed = now - start;
      var prog = Math.min(elapsed / dur, 1);
      var sx = startX + prog * (endX - startX);
      var bounceHeight = Math.abs(Math.sin((elapsed / 1000) * 6.4 * Math.PI)) * 78;
      var sy = baseY - bounceHeight;
      var depthWave = Math.sin(prog * Math.PI * 4) * 240;
      var p = toScene(sx, sy);
      ball.position.set(p.x, p.y, depthWave);
      ball.rotation.z -= 0.26;
      var pShadow = toScene(sx, baseY);
      shadowMesh.position.set(pShadow.x, pShadow.y, -1);
      var squish = 1 - (bounceHeight / 78) * 0.2;
      shadowMesh.scale.set(1 + (1 - squish) * 1.5, 1 + (1 - squish) * 1.5, 1);
      shadowMesh.material.opacity = 0.28 - (bounceHeight / 78) * 0.14;
      rects.forEach(function(c){
        var dx = Math.abs(sx - c.cx);
        var passingThrough = dx < c.w * 0.6;
        c.el.style.position = 'relative';
        c.el.style.zIndex = (passingThrough && depthWave > 15) ? '600' : '1';
      });
      renderer.render(scene, camera);
      if (prog < 1) rafId = requestAnimationFrame(frame);
      else { stop(); rects.forEach(function(c){ c.el.style.zIndex = ''; }); }
    }
    rafId = requestAnimationFrame(frame);
  }

  window.BBBall.playRoll = playRoll;
  window.BBBall.playDribbleOverCards = playDribbleOverCards;
  window.BBBall.stop = stop;
  window.BBBall._init = init;
})();
