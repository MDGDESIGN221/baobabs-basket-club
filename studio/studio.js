/* =====================================================================
   BAOBABS STUDIO — moteur d'affiches
   ---------------------------------------------------------------------
   Un seul global : window.BaobabsStudio = {mount, open, close, isOpen}.
   Aucune exécution automatique, aucun fetch, aucun localStorage : tout
   passe par l'objet `api` fourni au montage.

   PRINCIPE DE BASE
   Le document est une liste de calques ordonnée du bas vers le haut.
   Une seule fonction dessine : renderDoc(ctx, doc). L'aperçu l'appelle
   avec la transformation de vue, l'export l'appelle à l'échelle du
   format. Le PNG est donc exactement ce qui est à l'écran — il n'y a
   pas de second moteur de rendu qui pourrait diverger.

   Les positions sont en unités du document (= pixels du format final).
   ===================================================================== */
window.BaobabsStudio = (function () {
  'use strict';

  /* ===================================================================
     1. CONSTANTES
     =================================================================== */

  var FORMATS = [
    /* 3:4 est le rapport de la maquette d'origine : c'est le format par
       défaut, celui dans lequel les modèles ont été dessinés. */
    { id: 'affiche', label: 'Affiche 3:4 · 1080 × 1440', w: 1080, h: 1440 },
    { id: 'story',   label: 'Story · 1080 × 1920',      w: 1080, h: 1920 },
    { id: 'post',    label: 'Post portrait · 1080 × 1350', w: 1080, h: 1350 },
    { id: 'carre',   label: 'Carré · 1080 × 1080',      w: 1080, h: 1080 },
    { id: 'paysage', label: 'Paysage · 1600 × 900',     w: 1600, h: 900  },
    { id: 'lien',    label: 'Aperçu de lien · 1200 × 630', w: 1200, h: 630 },
    { id: 'a4',      label: 'Affiche A4 · 2480 × 3508',  w: 2480, h: 3508 },
    { id: 'a3',      label: 'Affiche A3 · 3508 × 4961',  w: 3508, h: 4961 }
  ];

  /* Les cinq familles déjà chargées par l'administration. Rien d'autre
     n'est disponible : ajouter une police ici sans l'ajouter au lien
     Google Fonts de l'hôte donnerait un rendu en police de repli. */
  var FONTS = [
    { id: 'Anton',         label: 'Anton — assommoir',   weights: [400], stack: "'Anton', 'Archivo', sans-serif" },
    { id: 'Archivo',       label: 'Archivo — titres',    weights: [400, 500, 600, 700, 800, 900], stack: "'Archivo', system-ui, sans-serif" },
    { id: 'Space Grotesk', label: 'Space Grotesk',        weights: [400, 500, 600, 700], stack: "'Space Grotesk', system-ui, sans-serif" },
    { id: 'Inter',         label: 'Inter — texte',        weights: [400, 500, 600, 700, 800, 900], stack: "'Inter', system-ui, sans-serif" },
    { id: 'JetBrains Mono',label: 'JetBrains Mono — chiffres', weights: [400, 500, 600], stack: "'JetBrains Mono', ui-monospace, monospace" }
  ];

  /* Rôles typographiques : ce qui donne du caractère sans demander à
     l'utilisateur de choisir une police, une graisse et un interlettrage. */
  var ROLES = [
    { id: 'assommoir', label: 'Assommoir',      font: 'Anton',   weight: 400, size: .118, tracking: -.012, lh: .88, upper: true },
    { id: 'contour',   label: 'Assommoir vide', font: 'Anton',   weight: 400, size: .118, tracking: -.012, lh: .88, upper: true, hollow: true },
    { id: 'titre',     label: 'Titre',          font: 'Archivo', weight: 800, size: .062, tracking: -.02, lh: 1.02, upper: false },
    { id: 'soustitre', label: 'Sous-titre',     font: 'Archivo', weight: 600, size: .036, tracking: -.005, lh: 1.2, upper: false },
    { id: 'surtitre',  label: 'Sur-titre',      font: 'Space Grotesk', weight: 700, size: .019, tracking: .16, lh: 1.3, upper: true },
    { id: 'para',      label: 'Paragraphe',     font: 'Inter',   weight: 400, size: .021, tracking: 0, lh: 1.5, upper: false },
    { id: 'pastille',  label: 'Pastille',       font: 'Archivo', weight: 700, size: .019, tracking: .05, lh: 1.2, upper: true },
    { id: 'chiffre',   label: 'Chiffre géant',  font: 'Anton',   weight: 400, size: .21,  tracking: -.02, lh: .84, upper: false },
    { id: 'donnee',    label: 'Donnée',         font: 'JetBrains Mono', weight: 600, size: .026, tracking: .02, lh: 1.3, upper: true },
    { id: 'mention',   label: 'Mention',        font: 'Inter',   weight: 500, size: .014, tracking: .06, lh: 1.4, upper: true }
  ];

  var PALETTES = [
    { id: 'nuit',    label: 'Nuit verte',   bg: '#0E0E10', accent: '#7DFF4F', fg: '#FFFFFF', fg2: '#A9A9B2' },
    { id: 'sable',   label: 'Sable',        bg: '#F4EFE6', accent: '#C6A257', fg: '#16150F', fg2: '#615C4E' },
    { id: 'brique',  label: 'Brique',       bg: '#160B0A', accent: '#FF5C3D', fg: '#FFF3EF', fg2: '#B99089' },
    { id: 'ocean',   label: 'Océan',        bg: '#061620', accent: '#3DD6FF', fg: '#EAF8FF', fg2: '#8FB2C0' },
    { id: 'or',      label: 'Or sur noir',  bg: '#0A0A0A', accent: '#C6A257', fg: '#F5F1E6', fg2: '#9A9384' },
    { id: 'craie',   label: 'Craie',        bg: '#FFFFFF', accent: '#111111', fg: '#111111', fg2: '#6B6B6B' }
  ];

  var BLENDS = [
    { id: 'source-over', label: 'Normal' },
    { id: 'multiply',    label: 'Produit' },
    { id: 'screen',      label: 'Superposition' },
    { id: 'overlay',     label: 'Incrustation' },
    { id: 'darken',      label: 'Obscurcir' },
    { id: 'lighten',     label: 'Éclaircir' },
    { id: 'color-dodge', label: 'Densité couleur −' },
    { id: 'hard-light',  label: 'Lumière crue' },
    { id: 'soft-light',  label: 'Lumière tamisée' },
    { id: 'difference',  label: 'Différence' },
    { id: 'hue',         label: 'Teinte' },
    { id: 'saturation',  label: 'Saturation' },
    { id: 'color',       label: 'Couleur' },
    { id: 'luminosity',  label: 'Luminosité' }
  ];

  /* Emplacements d'objet dynamique : un cadre porte un rôle, et le rôle
     sait où aller chercher son image dans les données du club. */
  var SLOTS = [
    { id: 'libre',      label: 'Image libre' },
    { id: 'logoClub',   label: 'Logo du club' },
    { id: 'logoAdv',    label: 'Logo de l adversaire' },
    { id: 'photoJoueuse', label: 'Photo de joueuse' },
    { id: 'photoMatch', label: 'Photo du match' }
  ];

  /* Champs liables sur un texte. `path` est résolu contre l'objet
     `data` chargé depuis l'administration. */
  var BINDINGS = [
    { id: 'match.adversaire',  label: 'Adversaire',            path: 'match.adversaire' },
    { id: 'match.competition', label: 'Compétition',           path: 'match.competition' },
    { id: 'match.date',        label: 'Date du match',         path: 'match.date' },
    { id: 'match.heure',       label: 'Heure',                 path: 'match.heure' },
    { id: 'match.lieu',        label: 'Salle',                 path: 'match.lieu' },
    { id: 'match.lieuType',    label: 'Domicile / extérieur',  path: 'match.lieuType' },
    { id: 'match.jours',       label: 'Compte à rebours (J−)', path: 'match.jours' },
    { id: 'match.affiche',     label: 'Baobabs vs Adversaire', path: 'match.affiche' },
    { id: 'resultat.score',    label: 'Dernier score',         path: 'resultat.score' },
    { id: 'resultat.adversaire', label: 'Dernier adversaire',  path: 'resultat.adversaire' },
    { id: 'resultat.issue',    label: 'Victoire / défaite',    path: 'resultat.issue' },
    { id: 'joueuse.nom',       label: 'Nom de joueuse',        path: 'joueuse.nom' },
    { id: 'joueuse.numero',    label: 'Numéro de maillot',     path: 'joueuse.numero' },
    { id: 'joueuse.poste',     label: 'Poste',                 path: 'joueuse.poste' },
    { id: 'club.nom',          label: 'Nom du club',           path: 'club.nom' },
    { id: 'club.site',         label: 'Adresse du site',       path: 'club.site' },
    { id: 'club.reseau',       label: 'Réseau social',         path: 'club.reseau' }
  ];

  var SHAPE_KINDS = [
    { id: 'rect',     label: 'Rectangle' },
    { id: 'ellipse',  label: 'Ellipse' },
    { id: 'line',     label: 'Ligne' },
    { id: 'triangle', label: 'Triangle' },
    { id: 'polygon',  label: 'Polygone' },
    { id: 'star',     label: 'Étoile' },
    { id: 'arrow',    label: 'Flèche' },
    { id: 'chevron',  label: 'Chevron' }
  ];

  /* Icônes : des tracés SVG rendus par Path2D. Elles deviennent de
     vrais calques — on peut les colorer, les tourner, les écrêter,
     exactement comme une forme. Repère 24 × 24. */
  var ICONS_LIB = [
    { id: 'ballon', label: 'Ballon', d: 'M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19ZM3 8.5c4 .6 8 .2 11.5-2M21 8.5c-4 .6-8 .2-11.5-2M3 15.5c4-.6 8-.2 11.5 2M21 15.5c-4-.6-8-.2-11.5 2M12 2.5v19' },
    { id: 'panier', label: 'Panier', d: 'M4 3.5h16v6H4zM6 9.5v3a6 6 0 0 0 12 0v-3M9 12.5l1.5 5M15 12.5l-1.5 5M10.5 17.5h3v3h-3z' },
    { id: 'sifflet', label: 'Sifflet', d: 'M13 8.5a5.5 5.5 0 1 0 0 8h6.5a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2ZM8 10.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM13 8.5 9 3.5' },
    { id: 'trophee', label: 'Trophée', d: 'M7 3.5h10v5a5 5 0 0 1-10 0ZM7 5.5H4v1a3.5 3.5 0 0 0 3 3.4M17 5.5h3v1a3.5 3.5 0 0 1-3 3.4M12 13.5v4M8.5 20.5h7' },
    { id: 'calendrier', label: 'Date', d: 'M4 5.5h16v15H4zM4 10.5h16M8.5 2.5v5M15.5 2.5v5' },
    { id: 'lieu', label: 'Lieu', d: 'M12 2.5c-3.6 0-6.5 2.9-6.5 6.5 0 5 6.5 12.5 6.5 12.5S18.5 14 18.5 9c0-3.6-2.9-6.5-6.5-6.5ZM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z' },
    { id: 'horloge', label: 'Heure', d: 'M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19ZM12 6.5v6l4 2' },
    { id: 'billet', label: 'Billet', d: 'M3 8.5a2 2 0 0 0 0 7v3h18v-3a2 2 0 0 1 0-7v-3H3ZM9 5.5v13' },
    { id: 'eclair', label: 'Éclair', d: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z' },
    { id: 'etoile', label: 'Étoile', d: 'm12 2.5 2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17.6l-5.9 3.1 1.3-6.6-4.9-4.6 6.6-.8Z' },
    { id: 'coeur', label: 'Cœur', d: 'M12 20.5S3.5 15 3.5 8.9A4.9 4.9 0 0 1 12 5.6a4.9 4.9 0 0 1 8.5 3.3c0 6.1-8.5 11.6-8.5 11.6Z' },
    { id: 'megaphone', label: 'Annonce', d: 'M3 10v4a2 2 0 0 0 2 2h2l9 5V3L7 8H5a2 2 0 0 0-2 2ZM7 16v5M19 8.5a4 4 0 0 1 0 7' },
    { id: 'fleche', label: 'Flèche', d: 'M3 12h17M14 5.5 20.5 12 14 18.5' },
    { id: 'chrono', label: 'Chrono', d: 'M12 4.5a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM12 8.5v4l2.5 2M9 2.5h6M18.5 6 20 4.5' },
    { id: 'maillot', label: 'Maillot', d: 'M8.5 2.5 4 5v5h3v11.5h10V10h3V5l-4.5-2.5a3.5 3.5 0 0 1-7 0Z' },
    { id: 'instagram', label: 'Instagram', d: 'M7 2.5h10a4.5 4.5 0 0 1 4.5 4.5v10a4.5 4.5 0 0 1-4.5 4.5H7A4.5 4.5 0 0 1 2.5 17V7A4.5 4.5 0 0 1 7 2.5ZM12 7.8a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4ZM17.6 6.4h.01' },
    { id: 'facebook', label: 'Facebook', d: 'M14.5 8.5V6.8c0-.9.3-1.3 1.3-1.3h1.7V2.6h-2.7c-3 0-4.3 1.4-4.3 4v1.9H8.5v3h2V21.5h4v-10h2.7l.4-3Z' },
    { id: 'whatsapp', label: 'WhatsApp', d: 'M3 21.5 4.4 17A9 9 0 1 1 8 20.4ZM8.5 8c-.3 0-.7.1-1 .5-.4.4-1 1-1 2.4s1 2.8 1.2 3c.2.2 2 3.2 5 4.4 2.5 1 3 .8 3.5.7.6 0 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4l-1-.5-1.6-.8c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.6.1a7.4 7.4 0 0 1-3.6-3.2c-.1-.3 0-.4.1-.5l.5-.6.3-.6c0-.2 0-.4-.1-.5l-.8-2c-.2-.5-.4-.4-.6-.4Z' }
  ];

  var MASKS = [
    { id: 'rect',     label: 'Rectangle' },
    { id: 'ellipse',  label: 'Cercle' },
    { id: 'squircle', label: 'Coins doux' },
    { id: 'hexagon',  label: 'Hexagone' },
    { id: 'arch',     label: 'Arche' }
  ];

  var ZOOMS = [0.05, 0.08, 0.12, 0.17, 0.25, 0.33, 0.5, 0.66, 1, 1.5, 2, 3, 4, 6, 8];

  /* ===================================================================
     2. PETITS UTILITAIRES
     =================================================================== */

  var _seq = 0;
  function uid(p) { _seq++; return (p || 'l') + '_' + Date.now().toString(36).slice(-4) + _seq.toString(36); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function deg2rad(d) { return d * Math.PI / 180; }
  function fmtNum(n, dec) {
    var f = Math.pow(10, dec == null ? 1 : dec);
    return String(Math.round(n * f) / f);
  }

  function hexToRgb(h) {
    h = String(h || '').trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 0, g: 0, b: 0 };
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  function rgbToHex(r, g, b) {
    function p(v) { return ('0' + clamp(Math.round(v), 0, 255).toString(16)).slice(-2); }
    return '#' + p(r) + p(g) + p(b);
  }
  /* Une couleur du document est toujours un couple {hex, a}. Le canvas
     veut une chaîne : c'est cette fonction, et elle seule, qui convertit. */
  function css(col) {
    if (!col) return 'rgba(0,0,0,0)';
    if (typeof col === 'string') return col;
    var c = hexToRgb(col.hex);
    var a = col.a == null ? 1 : col.a;
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }
  function color(hex, a) { return { hex: hex, a: a == null ? 1 : a }; }

  function lum(hex) {
    var c = hexToRgb(hex);
    return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
  }

  function fontStack(id) {
    for (var i = 0; i < FONTS.length; i++) if (FONTS[i].id === id) return FONTS[i].stack;
    return FONTS[1].stack;
  }
  function roleById(id) {
    for (var i = 0; i < ROLES.length; i++) if (ROLES[i].id === id) return ROLES[i];
    return ROLES[2];
  }
  function formatById(id) {
    for (var i = 0; i < FORMATS.length; i++) if (FORMATS[i].id === id) return FORMATS[i];
    return FORMATS[0];
  }

  /* ===================================================================
     3. MODÈLE DE DOCUMENT
     =================================================================== */

  function newDoc(formatId, palId) {
    var f = formatById(formatId || 'story');
    var p = PALETTES[0];
    for (var i = 0; i < PALETTES.length; i++) if (PALETTES[i].id === palId) p = PALETTES[i];
    return {
      v: 1,
      id: uid('doc'),
      name: 'Sans titre',
      format: f.id,
      w: f.w,
      h: f.h,
      bg: { type: 'solid', color: color(p.bg, 1), from: color(p.bg, 1), to: color('#000000', 1), angle: 90 },
      palette: { id: p.id, bg: p.bg, accent: p.accent, fg: p.fg, fg2: p.fg2 },
      safe: 0.055,
      rules: [],          /* repères posés à la main : {axis:'x'|'y', v} */
      layers: [],
      updated: null
    };
  }

  /* Style de texte par défaut, dérivé d'un rôle et de la largeur du doc. */
  function textStyleFromRole(roleId, d, colHex) {
    var r = roleById(roleId);
    return {
      role: r.id,
      font: r.font,
      size: Math.round(r.size * d.w),
      weight: r.weight,
      italic: false,
      tracking: r.tracking,     /* en em */
      lh: r.lh,
      align: 'left',
      valign: 'top',
      transform: r.upper ? 'upper' : 'none',
      color: color(colHex || d.palette.fg, 1),
      hollow: !!r.hollow,
      strokeW: r.hollow ? Math.max(1, Math.round(d.w * 0.0022)) : 0,
      underline: false
    };
  }

  function newLayer(type, props) {
    var l = {
      id: uid(),
      type: type,
      name: '',
      visible: true,
      locked: false,
      opacity: 1,
      blend: 'source-over',
      blur: 0,
      clip: false,          /* écrêté par le calque juste en dessous */
      x: 0, y: 0, w: 100, h: 100,
      rot: 0,
      flipH: false, flipV: false,
      shadow: null
    };
    for (var k in props) if (Object.prototype.hasOwnProperty.call(props, k)) l[k] = props[k];
    if (!l.name) l.name = defaultName(l);
    return l;
  }

  function defaultName(l) {
    if (l.type === 'text') return (plainText(l).split('\n')[0] || 'Texte').slice(0, 26) || 'Texte';
    if (l.type === 'image') return 'Image';
    if (l.type === 'frame') return l.slot && l.slot !== 'libre' ? slotLabel(l.slot) : 'Cadre photo';
    if (l.type === 'shape') {
      for (var i = 0; i < SHAPE_KINDS.length; i++) if (SHAPE_KINDS[i].id === l.shape) return SHAPE_KINDS[i].label;
      return 'Forme';
    }
    if (l.type === 'path') return 'Tracé';
    if (l.type === 'icon') {
      for (var k = 0; k < ICONS_LIB.length; k++) if (ICONS_LIB[k].d === l.d) return ICONS_LIB[k].label;
      return 'Icône';
    }
    if (l.type === 'group') return 'Groupe';
    return 'Calque';
  }
  function slotLabel(id) {
    for (var i = 0; i < SLOTS.length; i++) if (SLOTS[i].id === id) return SLOTS[i].label;
    return 'Cadre photo';
  }
  function bindLabel(id) {
    for (var i = 0; i < BINDINGS.length; i++) if (BINDINGS[i].id === id) return BINDINGS[i].label;
    return id;
  }

  /* ---- fabriques ---- */

  function makeText(d, roleId, txt, opts) {
    opts = opts || {};
    var ts = textStyleFromRole(roleId, d, opts.colHex);
    if (opts.style) for (var k in opts.style) ts[k] = opts.style[k];
    var l = newLayer('text', {
      ts: ts,
      runs: [{ t: txt == null ? 'Votre texte' : txt, s: {} }],
      wrap: opts.wrap !== false,
      autoH: true,
      bind: opts.bind || null,
      bindBroken: false,
      x: opts.x != null ? opts.x : Math.round(d.w * 0.08),
      y: opts.y != null ? opts.y : Math.round(d.h * 0.1),
      w: opts.w != null ? opts.w : Math.round(d.w * 0.84),
      h: 10
    });
    l.name = opts.name || defaultName(l);
    return l;
  }

  function makeShape(d, kind, opts) {
    opts = opts || {};
    return newLayer('shape', {
      shape: kind || 'rect',
      fill: opts.fill || { type: 'solid', color: color(d.palette.accent, 1), from: color(d.palette.accent, 1), to: color(d.palette.bg, 1), angle: 90 },
      stroke: opts.stroke || { color: color(d.palette.fg, 1), w: 0, dash: 0 },
      radius: opts.radius != null ? opts.radius : 0,
      sides: opts.sides || 6,
      points: opts.points || 5,
      inner: opts.inner || 0.46,
      x: opts.x != null ? opts.x : Math.round(d.w * 0.12),
      y: opts.y != null ? opts.y : Math.round(d.h * 0.4),
      w: opts.w != null ? opts.w : Math.round(d.w * 0.3),
      h: opts.h != null ? opts.h : Math.round(d.w * 0.3)
    });
  }

  /* Cadre photo = objet dynamique. C'est un calque image dont la boîte
     et le contenu sont indépendants : remplacer l'image ne change ni la
     forme, ni la position, ni les effets — exactement le comportement
     d'un objet dynamique dans Photoshop. Un cadre sans source n'est pas
     vide au sens « raté » : c'est un emplacement, et il se voit. */
  function makeFrame(d, opts) {
    opts = opts || {};
    return newLayer('image', {
      src: opts.src || '',
      natW: 0, natH: 0,
      slot: opts.slot || 'libre',
      fit: opts.fit || 'cover',
      ox: 0.5, oy: 0.5, zoom: 1,
      mask: opts.mask || 'rect',
      radius: opts.radius != null ? opts.radius : 0,
      stroke: { color: color(d.palette.accent, 1), w: 0 },
      fx: { bright: 0, contrast: 0, sat: 0, gray: 0, blur: 0, tint: color(d.palette.accent, 1), tintAmt: 0, veil: 0 },
      x: opts.x != null ? opts.x : Math.round(d.w * 0.1),
      y: opts.y != null ? opts.y : Math.round(d.h * 0.3),
      w: opts.w != null ? opts.w : Math.round(d.w * 0.5),
      h: opts.h != null ? opts.h : Math.round(d.w * 0.5)
    });
  }

  function makePath(d, nodes, opts) {
    opts = opts || {};
    return newLayer('path', {
      nodes: nodes || [],
      closed: !!opts.closed,
      fill: opts.fill || { type: 'none', color: color(d.palette.accent, 1), from: color(d.palette.accent, 1), to: color(d.palette.bg, 1), angle: 90 },
      stroke: opts.stroke || { color: color(d.palette.accent, 1), w: Math.max(2, Math.round(d.w * 0.005)), dash: 0 },
      cap: 'round',
      x: opts.x || 0, y: opts.y || 0, w: opts.w || 100, h: opts.h || 100
    });
  }

  /* ===================================================================
     4. TEXTE ENRICHI — les « runs »
     ---------------------------------------------------------------
     Un calque texte porte un style de base (ts) et une liste de runs.
     Chaque run est {t: '...', s: {surcharges}}. Colorer trois lettres
     revient à découper le run qui les contient — c'est exactement ce
     que fait applyRunStyle(). Aucune autre partie du texte n'est
     touchée, et l'export lit les mêmes runs que l'aperçu.
     =================================================================== */

  function plainText(l) {
    var s = '', r = l.runs || [];
    for (var i = 0; i < r.length; i++) s += r[i].t;
    return s;
  }
  function textLen(l) { return plainText(l).length; }

  function styleAt(l, run) {
    var st = {}, k;
    for (k in l.ts) st[k] = l.ts[k];
    if (run && run.s) for (k in run.s) st[k] = run.s[k];
    return st;
  }

  /* Style effectif du caractère d'indice i (pour la barre de propriétés). */
  function styleOfChar(l, i) {
    var pos = 0, r = l.runs || [];
    for (var k = 0; k < r.length; k++) {
      var n = r[k].t.length;
      if (i < pos + n || (k === r.length - 1 && i <= pos + n)) return styleAt(l, r[k]);
      pos += n;
    }
    return styleAt(l, null);
  }

  function sameStyle(a, b) {
    a = a || {}; b = b || {};
    var ka = Object.keys(a), kb = Object.keys(b), i;
    if (ka.length !== kb.length) return false;
    for (i = 0; i < ka.length; i++) {
      var k = ka[i], va = a[k], vb = b[k];
      if (vb === undefined) return false;
      if (va && typeof va === 'object') { if (!vb || va.hex !== vb.hex || va.a !== vb.a) return false; }
      else if (va !== vb) return false;
    }
    return true;
  }

  function normalizeRuns(runs) {
    var out = [];
    for (var i = 0; i < runs.length; i++) {
      if (!runs[i].t) continue;
      var last = out[out.length - 1];
      if (last && sameStyle(last.s, runs[i].s)) last.t += runs[i].t;
      else out.push({ t: runs[i].t, s: clone(runs[i].s || {}) });
    }
    if (!out.length) out.push({ t: '', s: {} });
    return out;
  }

  /* Découpe la liste de runs aux positions données (ordre croissant). */
  function splitRunsAt(runs, cuts) {
    var out = [], pos = 0;
    for (var i = 0; i < runs.length; i++) {
      var r = runs[i], start = pos, end = pos + r.t.length, marks = [0];
      for (var c = 0; c < cuts.length; c++) {
        var p = cuts[c];
        if (p > start && p < end) marks.push(p - start);
      }
      marks.push(r.t.length);
      marks.sort(function (a, b) { return a - b; });
      for (var m = 0; m < marks.length - 1; m++) {
        if (marks[m] === marks[m + 1]) continue;
        out.push({ t: r.t.slice(marks[m], marks[m + 1]), s: clone(r.s || {}) });
      }
      pos = end;
    }
    return out.length ? out : [{ t: '', s: {} }];
  }

  /* Applique une surcharge de style aux caractères [a, b).
     C'est LA fonction qui permet « changer la couleur d'une lettre
     dans un mot sans que ça affecte le reste ». */
  function applyRunStyle(l, a, b, patch) {
    a = clamp(Math.min(a, b), 0, textLen(l));
    b = clamp(Math.max(a, b), 0, textLen(l));
    if (a === b) return false;
    var runs = splitRunsAt(l.runs, [a, b]), pos = 0;
    for (var i = 0; i < runs.length; i++) {
      var n = runs[i].t.length;
      if (pos >= a && pos + n <= b) {
        for (var k in patch) {
          if (patch[k] === null) delete runs[i].s[k];
          else runs[i].s[k] = clone(patch[k]);
        }
      }
      pos += n;
    }
    l.runs = normalizeRuns(runs);
    return true;
  }

  /* Remplace [a,b) par `str`, qui hérite du style du caractère en a. */
  function spliceText(l, a, b, str) {
    var total = textLen(l);
    a = clamp(Math.min(a, b), 0, total);
    b = clamp(Math.max(a, b), 0, total);
    var runs = splitRunsAt(l.runs, [a, b]);
    var out = [], pos = 0, inserted = false;
    var carry = null;
    for (var i = 0; i < runs.length; i++) {
      var n = runs[i].t.length, s = pos, e = pos + n;
      if (e <= a) { out.push(runs[i]); if (e === a) carry = runs[i].s; }
      else if (s >= b) {
        if (!inserted) { if (str) out.push({ t: str, s: clone(carry || runs[i].s || {}) }); inserted = true; }
        out.push(runs[i]);
      } else {
        if (!carry) carry = runs[i].s;
      }
      pos = e;
    }
    if (!inserted && str) out.push({ t: str, s: clone(carry || (l.runs[l.runs.length - 1] || {}).s || {}) });
    l.runs = normalizeRuns(out);
    return a + str.length;
  }

  function setPlainText(l, str) {
    var s = (l.runs && l.runs[0] && l.runs[0].s) || {};
    l.runs = [{ t: String(str == null ? '' : str), s: clone(s) }];
  }

  function transformed(str, mode) {
    if (mode === 'upper') return str.toUpperCase();
    if (mode === 'lower') return str.toLowerCase();
    if (mode === 'title') return str.replace(/\S+/g, function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); });
    return str;
  }

  /* ===================================================================
     5. MESURE ET MISE EN PAGE DU TEXTE
     ---------------------------------------------------------------
     Le contexte de mesure est séparé du contexte d'affichage : mesurer
     ne doit jamais dépendre de l'état de dessin en cours.
     =================================================================== */

  var _mcv = null, _mctx = null;
  function mctx() {
    if (!_mctx) { _mcv = document.createElement('canvas'); _mcv.width = _mcv.height = 8; _mctx = _mcv.getContext('2d'); }
    return _mctx;
  }

  function fontCss(st) {
    return (st.italic ? 'italic ' : '') + (st.weight || 400) + ' ' + Math.max(1, st.size) + 'px ' + fontStack(st.font);
  }

  var _metCache = {};
  function fontMetrics(st) {
    var key = fontCss(st);
    if (_metCache[key]) return _metCache[key];
    var c = mctx();
    c.font = key;
    var m = c.measureText('HÀgpQ');
    var asc = m.fontBoundingBoxAscent || m.actualBoundingBoxAscent || st.size * 0.8;
    var desc = m.fontBoundingBoxDescent || m.actualBoundingBoxDescent || st.size * 0.22;
    var r = { asc: asc, desc: desc };
    _metCache[key] = r;
    return r;
  }

  function trackPx(st) { return (st.tracking || 0) * st.size; }

  /* Largeur d'une chaîne dans un style, et éventuellement la position
     de chaque caractère (nécessaire pour placer le curseur d'édition). */
  function measureRun(txt, st, wantChars) {
    var c = mctx();
    c.font = fontCss(st);
    var tk = trackPx(st), w, chars = null, i;
    if (!tk) {
      w = c.measureText(txt).width;
      if (wantChars) {
        chars = new Array(txt.length + 1);
        chars[0] = 0;
        for (i = 1; i <= txt.length; i++) chars[i] = c.measureText(txt.slice(0, i)).width;
      }
    } else {
      w = 0;
      if (wantChars) { chars = new Array(txt.length + 1); chars[0] = 0; }
      for (i = 0; i < txt.length; i++) {
        w += c.measureText(txt[i]).width + tk;
        if (wantChars) chars[i + 1] = w;
      }
    }
    return { w: w, chars: chars };
  }

  /* Découpe les runs en jetons (mot / espace / retour à la ligne) en
     appliquant la casse du style — la casse est visuelle, elle ne
     modifie pas le texte enregistré. */
  function tokenize(l) {
    var out = [], runs = l.runs || [], pos = 0;
    for (var i = 0; i < runs.length; i++) {
      var st = styleAt(l, runs[i]);
      var raw = runs[i].t;
      var re = /(\n)|([^\S\n]+)|([^\s]+)/g, m;
      while ((m = re.exec(raw))) {
        var t = m[0];
        out.push({
          t: transformed(t, st.transform),
          raw: t,
          st: st,
          kind: m[1] ? 'break' : (m[2] ? 'space' : 'word'),
          i0: pos + m.index
        });
      }
      pos += raw.length;
    }
    if (!out.length) out.push({ t: '', raw: '', st: styleAt(l, runs[0]), kind: 'word', i0: 0 });
    return out;
  }

  /* Mise en page complète : lignes → éléments → caractères. Retourne
     aussi la hauteur totale, qui pilote la boîte du calque.

     Deux pièges évités ici, tous deux invisibles jusqu'à l'édition :

     1. Les espaces de fin de ligne sont CONSERVÉS dans la ligne. Les
        supprimer ferait disparaître des caractères de la mise en page,
        et le curseur d'édition se décalerait d'autant.
     2. On note si une ligne s'est terminée par un vrai « \n » (hard)
        ou par un simple renvoi automatique. Seul le premier consomme
        un caractère — sans cette distinction, cliquer dans un
        paragraphe replié place le curseur au mauvais endroit. */
  function layoutText(l, wantChars) {
    var maxW = l.wrap === false ? Infinity : Math.max(1, l.w);
    var toks = tokenize(l), lines = [], hards = [], cur = [], curW = 0, trailW = 0, i;

    function push(hard) { lines.push(cur); hards.push(!!hard); cur = []; curW = 0; trailW = 0; }

    for (i = 0; i < toks.length; i++) {
      var tk = toks[i];
      if (tk.kind === 'break') { push(true); continue; }
      var mw = measureRun(tk.t, tk.st, false).w;
      if (tk.kind === 'space') { cur.push({ tok: tk, w: mw }); curW += mw; trailW += mw; continue; }
      if (curW + mw > maxW && cur.length) push(false);
      if (mw > maxW && maxW !== Infinity) {
        var buf = '', bufW = 0, off = 0;
        for (var c = 0; c < tk.t.length; c++) {
          var cw = measureRun(tk.t[c], tk.st, false).w;
          if (bufW + cw > maxW && buf) {
            cur.push({ tok: { t: buf, raw: buf, st: tk.st, kind: 'word', i0: tk.i0 + off }, w: bufW });
            off += buf.length;
            push(false); buf = ''; bufW = 0;
          }
          buf += tk.t[c]; bufW += cw;
        }
        if (buf) { cur.push({ tok: { t: buf, raw: buf, st: tk.st, kind: 'word', i0: tk.i0 + off }, w: bufW }); curW += bufW; trailW = 0; }
        continue;
      }
      cur.push({ tok: tk, w: mw });
      curW += mw;
      trailW = 0;
    }
    push(false);

    /* fusion des jetons voisins de même style, puis métriques */
    var out = [], totalH = 0, maxLineW = 0;
    for (i = 0; i < lines.length; i++) {
      var items = [], lw = 0, asc = 0, desc = 0, lh = 0, j, tail = 0;
      for (j = 0; j < lines[i].length; j++) {
        var t = lines[i][j].tok, last = items[items.length - 1];
        if (last && last.st === t.st) { last.t += t.t; last.w += lines[i][j].w; }
        else items.push({ t: t.t, st: t.st, w: lines[i][j].w, i0: t.i0, x: 0 });
        tail = t.kind === 'space' ? tail + lines[i][j].w : 0;
      }
      if (!items.length) {
        items.push({ t: '', st: styleAt(l, l.runs[0]), w: 0, i0: 0, x: 0 });
      }
      for (j = 0; j < items.length; j++) {
        var m = fontMetrics(items[j].st);
        asc = Math.max(asc, m.asc);
        desc = Math.max(desc, m.desc);
        lh = Math.max(lh, items[j].st.size * (items[j].st.lh || 1.2));
        items[j].x = lw;
        lw += items[j].w;
        if (wantChars) items[j].chars = measureRun(items[j].t, items[j].st, true).chars;
      }
      var vis = Math.max(0, lw - tail);      /* largeur visible : sans les espaces de fin */
      maxLineW = Math.max(maxLineW, vis);
      out.push({
        items: items, w: vis, wFull: lw, h: lh, asc: asc, desc: desc,
        y: totalH, base: (lh - (asc + desc)) / 2 + asc, hard: hards[i]
      });
      totalH += lh;
    }
    return { lines: out, w: maxLineW, h: totalH };
  }

  /* Boîte réelle du calque texte : la hauteur suit toujours le contenu,
     la largeur suit le contenu quand le retour à la ligne est coupé. */
  function syncTextBox(l) {
    var lay = layoutText(l, false);
    l.h = Math.max(1, Math.round(lay.h));
    if (l.wrap === false) l.w = Math.max(1, Math.round(lay.w));
    return lay;
  }

  /* ===================================================================
     6. CACHE D'IMAGES
     =================================================================== */

  var imgCache = {};
  function getImage(src) {
    if (!src) return null;
    var e = imgCache[src];
    if (e) return e;
    e = { img: null, ok: false, failed: false, tainted: false, promise: null };
    imgCache[src] = e;
    e.promise = new Promise(function (res) {
      function attempt(useCors) {
        var im = new Image();
        if (useCors) im.crossOrigin = 'anonymous';
        im.onload = function () {
          e.img = im; e.ok = true; e.tainted = !useCors && isCrossOrigin(src);
          res(e);
        };
        im.onerror = function () {
          if (useCors) attempt(false);          /* second essai sans CORS : l'image
                                                   s'affichera, mais l'export sera bloqué */
          else { e.failed = true; res(e); }
        };
        im.src = src;
      }
      attempt(isCrossOrigin(src));
    });
    return e;
  }
  function isCrossOrigin(src) {
    if (/^(data:|blob:)/i.test(src)) return false;
    try { return new URL(src, location.href).origin !== location.origin; } catch (e) { return false; }
  }
  function imagesReady() {
    var ps = [];
    for (var k in imgCache) if (imgCache[k].promise) ps.push(imgCache[k].promise);
    return Promise.all(ps);
  }

  /* ===================================================================
     7. CHEMINS DE FORMES
     =================================================================== */

  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath();
    if (!r) { ctx.rect(x, y, w, h); return; }
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function maskPath(ctx, kind, w, h, radius) {
    var i, a;
    switch (kind) {
      case 'ellipse':
        ctx.beginPath();
        ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        break;
      case 'squircle':
        roundRectPath(ctx, 0, 0, w, h, Math.min(w, h) * 0.28);
        break;
      case 'hexagon':
        ctx.beginPath();
        for (i = 0; i < 6; i++) {
          a = Math.PI / 180 * (60 * i - 90);
          var px = w / 2 + Math.cos(a) * w / 2, py = h / 2 + Math.sin(a) * h / 2;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath();
        break;
      case 'arch':
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(0, w / 2);
        ctx.arc(w / 2, w / 2, w / 2, Math.PI, 0);
        ctx.lineTo(w, h);
        ctx.closePath();
        break;
      default:
        roundRectPath(ctx, 0, 0, w, h, radius || 0);
    }
  }

  function shapePath(ctx, l) {
    var w = l.w, h = l.h, i, a, px, py;
    switch (l.shape) {
      case 'ellipse':
        ctx.beginPath();
        ctx.ellipse(w / 2, h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
        break;
      case 'line':
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        break;
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(w / 2, 0); ctx.lineTo(w, h); ctx.lineTo(0, h);
        ctx.closePath();
        break;
      case 'polygon':
        ctx.beginPath();
        for (i = 0; i < l.sides; i++) {
          a = Math.PI * 2 * i / l.sides - Math.PI / 2;
          px = w / 2 + Math.cos(a) * w / 2; py = h / 2 + Math.sin(a) * h / 2;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath();
        break;
      case 'star':
        ctx.beginPath();
        var n = l.points * 2;
        for (i = 0; i < n; i++) {
          var rr = i % 2 ? l.inner : 1;
          a = Math.PI * i / l.points - Math.PI / 2;
          px = w / 2 + Math.cos(a) * w / 2 * rr; py = h / 2 + Math.sin(a) * h / 2 * rr;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath();
        break;
      case 'arrow':
        ctx.beginPath();
        var sh = h * 0.34, hd = Math.min(w * 0.42, h * 0.5);
        ctx.moveTo(0, h / 2 - sh / 2);
        ctx.lineTo(w - hd, h / 2 - sh / 2);
        ctx.lineTo(w - hd, 0);
        ctx.lineTo(w, h / 2);
        ctx.lineTo(w - hd, h);
        ctx.lineTo(w - hd, h / 2 + sh / 2);
        ctx.lineTo(0, h / 2 + sh / 2);
        ctx.closePath();
        break;
      case 'chevron':
        ctx.beginPath();
        var cw = w * 0.34;
        ctx.moveTo(0, 0); ctx.lineTo(cw, 0); ctx.lineTo(w, h / 2);
        ctx.lineTo(cw, h); ctx.lineTo(0, h); ctx.lineTo(w - cw, h / 2);
        ctx.closePath();
        break;
      default:
        roundRectPath(ctx, 0, 0, w, h, l.radius || 0);
    }
  }

  /* Tracé de la plume : les nœuds sont normalisés 0..1 dans la boîte,
     ce qui rend le redimensionnement gratuit. */
  function pathPath(ctx, l) {
    var n = l.nodes || [], w = l.w, h = l.h;
    if (!n.length) { ctx.beginPath(); return; }
    function P(i) { return { x: n[i].x * w, y: n[i].y * h }; }
    function H2(i) { return { x: (n[i].h2x != null ? n[i].h2x : n[i].x) * w, y: (n[i].h2y != null ? n[i].h2y : n[i].y) * h }; }
    function H1(i) { return { x: (n[i].h1x != null ? n[i].h1x : n[i].x) * w, y: (n[i].h1y != null ? n[i].h1y : n[i].y) * h }; }
    ctx.beginPath();
    var p0 = P(0);
    ctx.moveTo(p0.x, p0.y);
    for (var i = 1; i < n.length; i++) {
      var a = H2(i - 1), b = H1(i), p = P(i);
      ctx.bezierCurveTo(a.x, a.y, b.x, b.y, p.x, p.y);
    }
    if (l.closed && n.length > 1) {
      var a2 = H2(n.length - 1), b2 = H1(0);
      ctx.bezierCurveTo(a2.x, a2.y, b2.x, b2.y, p0.x, p0.y);
      ctx.closePath();
    }
  }

  function paintStyle(ctx, paint, w, h) {
    if (!paint || paint.type === 'none') return null;
    if (paint.type === 'linear') {
      var a = deg2rad(paint.angle || 90);
      var cx = w / 2, cy = h / 2, r = (Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))) / 2;
      var g = ctx.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      g.addColorStop(0, css(paint.from));
      g.addColorStop(1, css(paint.to));
      return g;
    }
    if (paint.type === 'radial') {
      var g2 = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 2);
      g2.addColorStop(0, css(paint.from));
      g2.addColorStop(1, css(paint.to));
      return g2;
    }
    return css(paint.color);
  }

  /* ===================================================================
     8. RENDU
     ---------------------------------------------------------------
     renderDoc est la seule fonction de dessin. L'aperçu l'appelle après
     avoir posé la transformation de vue ; l'export l'appelle après un
     simple ctx.scale(). C'est ce qui garantit que le PNG ressemble à
     l'écran : il n'y a pas deux dessins, il y en a un.
     =================================================================== */

  var HAS_FILTER = (function () {
    try { var c = document.createElement('canvas').getContext('2d'); return typeof c.filter === 'string'; }
    catch (e) { return false; }
  })();

  function renderDoc(ctx, d, opts) {
    opts = opts || {};
    ctx.save();
    /* fond */
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (d.bg && d.bg.type !== 'none') {
      ctx.fillStyle = paintStyle(ctx, d.bg, d.w, d.h) || css(d.bg.color);
      ctx.fillRect(0, 0, d.w, d.h);
    }
    drawStack(ctx, d.layers, d, opts, 1);
    ctx.restore();
  }

  /* Parcourt une pile en tenant compte des masques d'écrêtage.
     Comme dans Photoshop, un calque marqué `clip` est découpé par le
     calque situé juste en dessous — et si ce dernier est masqué, ses
     écrêtés disparaissent avec lui. */
  function drawStack(ctx, list, d, opts, alpha) {
    for (var i = 0; i < list.length; i++) {
      var base = list[i];
      var j = i + 1;
      while (j < list.length && list[j].clip) j++;
      if (j > i + 1) {
        if (base.visible) drawClipped(ctx, base, list.slice(i + 1, j), d, opts, alpha);
        i = j - 1;
        continue;
      }
      drawLayer(ctx, base, d, opts, alpha);
    }
  }

  /* Le découpage se fait sur la silhouette réelle du calque de base —
     y compris celle d'un texte, ce qu'aucun ctx.clip() ne sait faire.
     D'où le passage par deux calques hors écran : l'un porte le
     contenu, l'autre sert de pochoir. */
  function drawClipped(ctx, base, kids, d, opts, alpha) {
    drawLayer(ctx, base, d, opts, alpha);
    var vis = [], i;
    for (i = 0; i < kids.length; i++) if (kids[i].visible) vis.push(kids[i]);
    if (!vis.length) return;

    var bb = bboxOf([base]);
    if (bb.w < 1 || bb.h < 1) return;

    var s = 1;
    if (ctx.getTransform) {
      var m = ctx.getTransform();
      s = Math.hypot(m.a, m.b) || 1;
    }
    s = clamp(s, 0.05, 4);
    var cw = Math.ceil(bb.w * s), ch = Math.ceil(bb.h * s);
    if (cw < 1 || ch < 1 || cw * ch > 36e6) {          /* garde-fou mémoire */
      for (i = 0; i < vis.length; i++) drawLayer(ctx, vis[i], d, opts, alpha);
      return;
    }

    var oc = document.createElement('canvas'); oc.width = cw; oc.height = ch;
    var oct = oc.getContext('2d');
    oct.setTransform(s, 0, 0, s, -bb.x * s, -bb.y * s);
    for (i = 0; i < vis.length; i++) drawLayer(oct, vis[i], d, opts, 1);

    var mc = document.createElement('canvas'); mc.width = cw; mc.height = ch;
    var mct = mc.getContext('2d');
    mct.setTransform(s, 0, 0, s, -bb.x * s, -bb.y * s);
    drawLayer(mct, base, d, opts, 1);

    oct.setTransform(1, 0, 0, 1, 0, 0);
    oct.globalCompositeOperation = 'destination-in';
    oct.drawImage(mc, 0, 0);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(oc, bb.x, bb.y, bb.w, bb.h);
    ctx.restore();
  }

  function drawLayer(ctx, l, d, opts, parentAlpha) {
    if (!l.visible) return;
    if (opts.skipId && opts.skipId === l.id) return;
    var alpha = clamp((l.opacity == null ? 1 : l.opacity) * (parentAlpha == null ? 1 : parentAlpha), 0, 1);

    /* Un groupe n'a pas de repère propre : ses enfants sont rangés en
       coordonnées du document. Sa boîte n'est qu'un cadre de sélection,
       recalculé à chaque modification. On évite ainsi toute une classe
       de bugs de transformations imbriquées. */
    if (l.type === 'group') {
      drawStack(ctx, l.children || [], d, opts, alpha);
      return;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = l.blend || 'source-over';
    /* flou de calque : disponible sur tout type, pas seulement les images */
    if (l.blur > 0 && HAS_FILTER) ctx.filter = 'blur(' + l.blur + 'px)';

    /* repère local : origine au coin haut-gauche, rotation au centre */
    ctx.translate(l.x + l.w / 2, l.y + l.h / 2);
    if (l.rot) ctx.rotate(deg2rad(l.rot));
    ctx.scale(l.flipH ? -1 : 1, l.flipV ? -1 : 1);
    ctx.translate(-l.w / 2, -l.h / 2);

    if (l.shadow && l.shadow.on) {
      ctx.shadowColor = css(l.shadow.color);
      ctx.shadowBlur = l.shadow.blur || 0;
      ctx.shadowOffsetX = l.shadow.x || 0;
      ctx.shadowOffsetY = l.shadow.y || 0;
    }

    switch (l.type) {
      case 'text':  drawText(ctx, l, opts); break;
      case 'image':
      case 'frame': drawImageLayer(ctx, l, d, opts); break;
      case 'shape': drawShape(ctx, l); break;
      case 'path':  drawPathLayer(ctx, l); break;
      case 'icon':  drawIcon(ctx, l); break;
    }
    ctx.restore();
  }

  /* ---------- icônes ---------- */
  var _p2dCache = {};
  function iconPath(d) {
    if (!_p2dCache[d]) {
      try { _p2dCache[d] = new Path2D(d); } catch (e) { _p2dCache[d] = null; }
    }
    return _p2dCache[d];
  }
  function drawIcon(ctx, l) {
    var p = iconPath(l.d);
    if (!p) return;
    var vb = l.vb || 24;
    var sx = l.w / vb, sy = l.h / vb;
    ctx.save();
    ctx.scale(sx, sy);
    if (l.fill && l.fill.type !== 'none') {
      ctx.fillStyle = paintStyle(ctx, l.fill, vb, vb) || css(l.fill.color);
      ctx.fill(p);
    }
    if (l.stroke && l.stroke.w > 0) {
      ctx.strokeStyle = css(l.stroke.color);
      ctx.lineWidth = l.stroke.w / ((sx + sy) / 2);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke(p);
    }
    ctx.restore();
  }

  /* ---------- texte ---------- */
  function drawText(ctx, l, opts) {
    var lay = layoutText(l, false);
    var oy = 0;
    if (l.ts.valign === 'middle') oy = (l.h - lay.h) / 2;
    else if (l.ts.valign === 'bottom') oy = l.h - lay.h;

    for (var i = 0; i < lay.lines.length; i++) {
      var ln = lay.lines[i];
      var lx = 0;
      if (l.ts.align === 'center') lx = (l.w - ln.w) / 2;
      else if (l.ts.align === 'right') lx = l.w - ln.w;
      var by = oy + ln.y + ln.base;

      for (var j = 0; j < ln.items.length; j++) {
        var it = ln.items[j], st = it.st;
        if (!it.t) continue;
        ctx.font = fontCss(st);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.lineJoin = 'round';
        var x = lx + it.x, tk = trackPx(st);

        if (st.hollow) {
          ctx.strokeStyle = css(st.color);
          ctx.lineWidth = Math.max(0.5, st.strokeW || 1);
          drawRunText(ctx, it.t, x, by, tk, true);
        } else {
          ctx.fillStyle = css(st.color);
          drawRunText(ctx, it.t, x, by, tk, false);
          if (st.strokeW > 0) {
            ctx.strokeStyle = css(st.strokeColor || color('#000000', 1));
            ctx.lineWidth = st.strokeW;
            drawRunText(ctx, it.t, x, by, tk, true);
          }
        }
        if (st.underline) {
          var uy = by + st.size * 0.13;
          ctx.strokeStyle = css(st.color);
          ctx.lineWidth = Math.max(1, st.size * 0.055);
          ctx.beginPath();
          ctx.moveTo(x, uy); ctx.lineTo(x + it.w - (tk || 0), uy);
          ctx.stroke();
        }
      }
    }
  }

  /* Quand l'interlettrage est nul on écrit la chaîne d'un coup, ce qui
     conserve le crénage de la police. Sinon on avance caractère par
     caractère, exactement comme la mesure. */
  function drawRunText(ctx, txt, x, y, tk, stroke) {
    if (!tk) { stroke ? ctx.strokeText(txt, x, y) : ctx.fillText(txt, x, y); return; }
    var cx = x;
    for (var i = 0; i < txt.length; i++) {
      stroke ? ctx.strokeText(txt[i], cx, y) : ctx.fillText(txt[i], cx, y);
      cx += ctx.measureText(txt[i]).width + tk;
    }
  }

  /* ---------- image / cadre (objet dynamique) ---------- */
  function drawImageLayer(ctx, l, d, opts) {
    var w = l.w, h = l.h;
    ctx.save();
    maskPath(ctx, l.mask || 'rect', w, h, l.radius || 0);
    ctx.clip();

    var e = l.src ? getImage(l.src) : null;
    if (e && e.ok) {
      var iw = e.img.naturalWidth || e.img.width, ih = e.img.naturalHeight || e.img.height;
      var r = fitRect(iw, ih, w, h, l.fit || 'cover', l.zoom || 1, l.ox == null ? .5 : l.ox, l.oy == null ? .5 : l.oy);
      var prevFilter = HAS_FILTER ? ctx.filter : null;
      if (HAS_FILTER) {
        var fcss = filterCss(l.fx);
        /* le flou de calque posé plus haut ne doit pas être effacé */
        if (prevFilter && prevFilter !== 'none') fcss = (fcss === 'none' ? '' : fcss + ' ') + prevFilter;
        ctx.filter = fcss || 'none';
      }
      try { ctx.drawImage(e.img, r.x, r.y, r.w, r.h); } catch (err) { /* image indisponible */ }
      if (HAS_FILTER) ctx.filter = prevFilter || 'none';

      if (l.fx && l.fx.tintAmt > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.globalAlpha = l.fx.tintAmt;
        ctx.fillStyle = css(l.fx.tint);
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
      if (l.fx && l.fx.veil > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(0,0,0,' + l.fx.veil + ')';
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
    } else if (!opts.forExport) {
      /* état vide : un vrai emplacement, pas un carré gris muet */
      drawEmptyFrame(ctx, l, w, h);
    }
    ctx.restore();

    if (l.stroke && l.stroke.w > 0) {
      ctx.save();
      maskPath(ctx, l.mask || 'rect', w, h, l.radius || 0);
      ctx.strokeStyle = css(l.stroke.color);
      ctx.lineWidth = l.stroke.w;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawEmptyFrame(ctx, l, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(125,255,79,0.05)';
    ctx.fillRect(0, 0, w, h);
    maskPath(ctx, l.mask || 'rect', w, h, l.radius || 0);
    ctx.strokeStyle = 'rgba(125,255,79,0.55)';
    ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.006);
    ctx.setLineDash([Math.max(4, w * 0.02), Math.max(3, w * 0.014)]);
    ctx.stroke();
    ctx.setLineDash([]);

    var s = Math.min(w, h) * 0.16, cx = w / 2, cy = h / 2 - s * 0.15;
    ctx.strokeStyle = 'rgba(125,255,79,0.8)';
    ctx.lineWidth = Math.max(1.4, s * 0.07);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.rect(cx - s / 2, cy - s * 0.4, s, s * 0.8);
    ctx.moveTo(cx - s * 0.42, cy + s * 0.24);
    ctx.lineTo(cx - s * 0.12, cy - s * 0.1);
    ctx.lineTo(cx + s * 0.08, cy + s * 0.08);
    ctx.lineTo(cx + s * 0.26, cy - s * 0.06);
    ctx.lineTo(cx + s * 0.42, cy + s * 0.24);
    ctx.stroke();

    var lab = l.slot && l.slot !== 'libre' ? slotLabel(l.slot) : 'Cadre photo';
    var fs = Math.max(9, Math.min(w, h) * 0.075);
    ctx.fillStyle = 'rgba(125,255,79,0.9)';
    ctx.font = '650 ' + fs + "px 'Archivo', system-ui, sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(lab, cx, cy + s * 0.5);
    ctx.restore();
  }

  function filterCss(fx) {
    if (!fx) return 'none';
    var f = [];
    if (fx.bright) f.push('brightness(' + (1 + fx.bright / 100) + ')');
    if (fx.contrast) f.push('contrast(' + (1 + fx.contrast / 100) + ')');
    if (fx.sat) f.push('saturate(' + (1 + fx.sat / 100) + ')');
    if (fx.gray) f.push('grayscale(' + (fx.gray / 100) + ')');
    if (fx.blur) f.push('blur(' + fx.blur + 'px)');
    return f.length ? f.join(' ') : 'none';
  }

  /* Cadrage non destructif : l'image garde ses proportions, seuls le
     décalage et le zoom bougent — c'est le contenu d'un objet
     dynamique, pas un recadrage définitif. */
  function fitRect(iw, ih, w, h, fit, zoom, ox, oy) {
    if (!iw || !ih) return { x: 0, y: 0, w: w, h: h };
    var s;
    if (fit === 'fill') return { x: 0, y: 0, w: w, h: h };
    if (fit === 'contain') s = Math.min(w / iw, h / ih);
    else s = Math.max(w / iw, h / ih);
    s *= (zoom || 1);
    var dw = iw * s, dh = ih * s;
    return { x: (w - dw) * ox, y: (h - dh) * oy, w: dw, h: dh };
  }

  /* ---------- formes ---------- */
  function drawShape(ctx, l) {
    shapePath(ctx, l);
    if (l.shape !== 'line') {
      var fs = paintStyle(ctx, l.fill, l.w, l.h);
      if (fs) { ctx.fillStyle = fs; ctx.fill(); }
    }
    if (l.stroke && l.stroke.w > 0) {
      ctx.strokeStyle = css(l.stroke.color);
      ctx.lineWidth = l.stroke.w;
      ctx.lineCap = l.shape === 'line' ? (l.cap || 'round') : 'butt';
      ctx.setLineDash(l.stroke.dash ? [l.stroke.dash, l.stroke.dash * 0.8] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (l.shape === 'line') {
      ctx.strokeStyle = css(l.stroke ? l.stroke.color : color('#fff', 1));
      ctx.lineWidth = Math.max(1, l.h);
      ctx.stroke();
    }
  }

  /* ---------- tracé plume ---------- */
  function drawPathLayer(ctx, l) {
    if (!l.nodes || l.nodes.length < 2) return;
    pathPath(ctx, l);
    var fs = paintStyle(ctx, l.fill, l.w, l.h);
    if (fs && l.closed) { ctx.fillStyle = fs; ctx.fill(); }
    if (l.stroke && l.stroke.w > 0) {
      ctx.strokeStyle = css(l.stroke.color);
      ctx.lineWidth = l.stroke.w;
      ctx.lineCap = l.cap || 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash(l.stroke.dash ? [l.stroke.dash, l.stroke.dash * 0.8] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /* ===================================================================
     9. GÉOMÉTRIE ET DÉTECTION DE CLIC
     =================================================================== */

  function layerCenter(l) { return { x: l.x + l.w / 2, y: l.y + l.h / 2 }; }

  /* point du document -> repère local du calque */
  function toLocal(l, px, py) {
    var c = layerCenter(l);
    var dx = px - c.x, dy = py - c.y;
    if (l.rot) {
      var a = -deg2rad(l.rot), cs = Math.cos(a), sn = Math.sin(a);
      var nx = dx * cs - dy * sn, ny = dx * sn + dy * cs;
      dx = nx; dy = ny;
    }
    if (l.flipH) dx = -dx;
    if (l.flipV) dy = -dy;
    return { x: dx + l.w / 2, y: dy + l.h / 2 };
  }
  /* repère local -> point du document */
  function toDoc(l, lx, ly) {
    var dx = lx - l.w / 2, dy = ly - l.h / 2;
    if (l.flipH) dx = -dx;
    if (l.flipV) dy = -dy;
    if (l.rot) {
      var a = deg2rad(l.rot), cs = Math.cos(a), sn = Math.sin(a);
      var nx = dx * cs - dy * sn, ny = dx * sn + dy * cs;
      dx = nx; dy = ny;
    }
    var c = layerCenter(l);
    return { x: dx + c.x, y: dy + c.y };
  }

  /* Les quatre coins d'un calque, en coordonnées du document. */
  function corners(l) {
    return [toDoc(l, 0, 0), toDoc(l, l.w, 0), toDoc(l, l.w, l.h), toDoc(l, 0, l.h)];
  }
  function bboxOf(list) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (var i = 0; i < list.length; i++) {
      var cs = corners(list[i]);
      for (var j = 0; j < 4; j++) {
        x0 = Math.min(x0, cs[j].x); y0 = Math.min(y0, cs[j].y);
        x1 = Math.max(x1, cs[j].x); y1 = Math.max(y1, cs[j].y);
      }
    }
    if (!isFinite(x0)) return { x: 0, y: 0, w: 0, h: 0 };
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  var _hitCv = null, _hitCtx = null;
  function hitCtx() {
    if (!_hitCtx) { _hitCv = document.createElement('canvas'); _hitCv.width = _hitCv.height = 1; _hitCtx = _hitCv.getContext('2d'); }
    return _hitCtx;
  }

  /* Un calque est-il touché par un point du document ? Les formes et
     les tracés sont testés sur leur silhouette réelle, pas sur leur
     boîte : cliquer dans le trou d'un anneau ne le sélectionne pas. */
  function hitLayer(l, px, py, tol) {
    if (!l.visible || l.locked) return false;
    tol = tol || 0;
    if (l.type === 'group') {
      for (var i = (l.children || []).length - 1; i >= 0; i--) {
        if (hitLayer(l.children[i], px, py, tol)) return true;
      }
      return false;
    }
    var p = toLocal(l, px, py);
    if (l.type === 'icon') {
      var pp = iconPath(l.d), vb = l.vb || 24;
      if (!pp) return inBox(p, l, tol);
      var hc = hitCtx();
      hc.setTransform(1, 0, 0, 1, 0, 0);
      var qx = p.x / (l.w / vb), qy = p.y / (l.h / vb);
      if (l.fill && l.fill.type !== 'none' && hc.isPointInPath(pp, qx, qy)) return true;
      hc.lineWidth = Math.max(((l.stroke && l.stroke.w) || 2) / (l.w / vb), 3);
      if (hc.isPointInStroke && hc.isPointInStroke(pp, qx, qy)) return true;
      return false;
    }
    if (l.type === 'shape' || l.type === 'path') {
      var ctx = hitCtx();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (l.type === 'shape') shapePath(ctx, l); else pathPath(ctx, l);
      var filled = (l.type === 'shape' && l.shape !== 'line' && l.fill && l.fill.type !== 'none') || (l.type === 'path' && l.closed && l.fill && l.fill.type !== 'none');
      if (filled && ctx.isPointInPath(p.x, p.y)) return true;
      var lw = Math.max((l.stroke && l.stroke.w) || 0, l.type === 'shape' && l.shape === 'line' ? l.h : 0);
      ctx.lineWidth = Math.max(lw, tol * 2, 6);
      if (ctx.isPointInStroke && ctx.isPointInStroke(p.x, p.y)) return true;
      return false;
    }
    return inBox(p, l, tol);
  }
  function inBox(p, l, tol) {
    tol = tol || 0;
    return p.x >= -tol && p.y >= -tol && p.x <= l.w + tol && p.y <= l.h + tol;
  }

  /* La boîte d'un groupe n'est jamais saisie à la main : elle enveloppe
     ses enfants et se recalcule après chaque déplacement. */
  function reflowGroup(g) {
    if (g.type !== 'group') return;
    for (var i = 0; i < (g.children || []).length; i++) reflowGroup(g.children[i]);
    var b = bboxOf(g.children || []);
    g.x = b.x; g.y = b.y; g.w = b.w; g.h = b.h; g.rot = 0;
  }

  /* Parcours à plat de la pile, groupes compris. */
  function walk(list, fn, parent) {
    for (var i = 0; i < list.length; i++) {
      fn(list[i], list, i, parent || null);
      if (list[i].type === 'group') walk(list[i].children || [], fn, list[i]);
    }
  }
  function findLayer(list, id) {
    var found = null;
    walk(list, function (l) { if (l.id === id) found = l; });
    return found;
  }
  /* Renvoie {arr, idx, parent} pour pouvoir retirer/insérer au bon endroit. */
  function locate(list, id) {
    var r = null;
    walk(list, function (l, arr, i, parent) { if (l.id === id) r = { layer: l, arr: arr, idx: i, parent: parent }; });
    return r;
  }

  /* ===================================================================
     10. ÉTAT DE L'APPLICATION
     =================================================================== */

  var api = null, root = null, mounted = false, opened = false;
  var els = {};
  var doc = null;
  var view = { zoom: 1, px: 0, py: 0 };
  var sel = [];                 /* ids sélectionnés */
  var tool = 'select';
  var toolBeforeSpace = null;
  var edit = null;              /* {id, a, b, prefAlign} — édition de texte */
  var pathDraft = null;         /* tracé plume en cours */
  var contentEdit = null;       /* id du cadre dont on recadre le contenu */
  var drag = null;              /* manipulation en cours */
  var marquee = null;
  var guides = [];
  var flags = { grid: false, snap: true, safe: true };
  var preview = false;          /* aperçu propre : plus aucun repère à l'écran */
  var dragRuleActive = false;
  var data = {};                /* données du club */
  var medias = [];
  var project = { id: null, savedAt: null, isTemplate: false };
  var dirty = false;
  var dpr = 1;
  var lastPointer = { x: 0, y: 0 };
  var caretOn = true, caretTimer = null;
  var autosaveTimer = null;

  /* ===================================================================
     11. VUE : document <-> écran
     =================================================================== */

  function d2s(x, y) { return { x: x * view.zoom + view.px, y: y * view.zoom + view.py }; }
  function s2d(x, y) { return { x: (x - view.px) / view.zoom, y: (y - view.py) / view.zoom }; }

  function sceneSize() {
    var r = els.scene.getBoundingClientRect();
    return { w: Math.max(1, r.width), h: Math.max(1, r.height), rect: r };
  }

  function fitView(pad) {
    var s = sceneSize();
    pad = pad == null ? 56 : pad;
    var z = Math.min((s.w - pad) / doc.w, (s.h - pad) / doc.h);
    view.zoom = clamp(z, 0.02, 8);
    view.px = (s.w - doc.w * view.zoom) / 2;
    view.py = (s.h - doc.h * view.zoom) / 2;
    updateZoomLabel();
    requestDraw();
  }

  function setZoom(z, cx, cy) {
    var s = sceneSize();
    if (cx == null) { cx = s.w / 2; cy = s.h / 2; }
    var before = s2d(cx, cy);
    view.zoom = clamp(z, 0.02, 16);
    view.px = cx - before.x * view.zoom;
    view.py = cy - before.y * view.zoom;
    updateZoomLabel();
    requestDraw();
  }
  /* Ctrl+2 : cadrer sur la sélection, comme dans Figma. */
  function zoomToSelection() {
    var ls = selectedLayers();
    if (!ls.length) { fitView(); return; }
    var b = bboxOf(ls), s = sceneSize(), pad = 90;
    var z = Math.min((s.w - pad) / Math.max(1, b.w), (s.h - pad) / Math.max(1, b.h));
    view.zoom = clamp(z, 0.02, 16);
    view.px = s.w / 2 - (b.x + b.w / 2) * view.zoom;
    view.py = s.h / 2 - (b.y + b.h / 2) * view.zoom;
    updateZoomLabel();
    requestDraw();
  }

  function zoomStep(dir, cx, cy) {
    var z = view.zoom, i, target = z;
    if (dir > 0) { for (i = 0; i < ZOOMS.length; i++) if (ZOOMS[i] > z + 1e-4) { target = ZOOMS[i]; break; } }
    else { for (i = ZOOMS.length - 1; i >= 0; i--) if (ZOOMS[i] < z - 1e-4) { target = ZOOMS[i]; break; } }
    setZoom(target, cx, cy);
  }
  function updateZoomLabel() {
    if (els.zoomVal) els.zoomVal.textContent = Math.round(view.zoom * 100) + ' %';
  }

  /* ===================================================================
     12. BOUCLE DE DESSIN
     =================================================================== */

  var rafPending = false;
  function requestDraw() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () { rafPending = false; draw(); });
  }

  function sizeCanvases() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var s = sceneSize();
    [els.canvas, els.overlay].forEach(function (c) {
      var w = Math.round(s.w * dpr), h = Math.round(s.h * dpr);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    });
    sizeRulers(s);
  }
  function sizeRulers(s) {
    var rh = els.rulerH, rv = els.rulerV;
    if (rh) { var w = Math.round(s.w * dpr); if (rh.width !== w) rh.width = w; if (rh.height !== Math.round(20 * dpr)) rh.height = Math.round(20 * dpr); }
    if (rv) { var h = Math.round(s.h * dpr); if (rv.height !== h) rv.height = h; if (rv.width !== Math.round(20 * dpr)) rv.width = Math.round(20 * dpr); }
  }

  function draw() {
    if (!opened || !doc) return;
    sizeCanvases();
    var s = sceneSize();
    var ctx = els.canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, s.w, s.h);

    ctx.save();
    ctx.translate(view.px, view.py);
    ctx.scale(view.zoom, view.zoom);

    /* ombre du plan de travail */
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = 34 / view.zoom;
    ctx.shadowOffsetY = 10 / view.zoom;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, doc.w, doc.h);
    ctx.restore();

    ctx.beginPath();
    ctx.rect(0, 0, doc.w, doc.h);
    ctx.clip();
    renderDoc(ctx, doc, {});
    ctx.restore();

    drawOverlay(s);
    drawRulers(s);
    renderFloat();
  }

  /* ---------- surcouche : tout ce qui n'est pas l'affiche ---------- */
  function drawOverlay(s) {
    var g = els.overlay.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, s.w, s.h);

    /* en aperçu, on ne dessine plus rien : ni poignées, ni repères, ni
       marges — c'est l'affiche seule, telle qu'elle sera publiée */
    if (preview) return;

    var o = d2s(0, 0), z = view.zoom;

    /* grille */
    if (flags.grid) {
      var step = doc.w / 12 * z;
      if (step > 6) {
        g.save();
        g.strokeStyle = 'rgba(255,255,255,.07)';
        g.lineWidth = 1;
        g.beginPath();
        for (var gx = 0; gx <= doc.w + .5; gx += doc.w / 12) {
          var p = d2s(gx, 0); g.moveTo(Math.round(p.x) + .5, o.y); g.lineTo(Math.round(p.x) + .5, o.y + doc.h * z);
        }
        for (var gy = 0; gy <= doc.h + .5; gy += doc.w / 12) {
          var q = d2s(0, gy); g.moveTo(o.x, Math.round(q.y) + .5); g.lineTo(o.x + doc.w * z, Math.round(q.y) + .5);
        }
        g.stroke();
        g.restore();
      }
    }

    /* marges de sécurité */
    if (flags.safe) {
      var m = doc.safe * doc.w;
      g.save();
      g.strokeStyle = 'rgba(125,255,79,.28)';
      g.setLineDash([5, 4]);
      g.lineWidth = 1;
      var a = d2s(m, m), b = d2s(doc.w - m, doc.h - m);
      g.strokeRect(Math.round(a.x) + .5, Math.round(a.y) + .5, Math.round(b.x - a.x), Math.round(b.y - a.y));
      g.restore();
    }

    /* bord du document */
    g.save();
    g.strokeStyle = 'rgba(255,255,255,.16)';
    g.lineWidth = 1;
    g.strokeRect(Math.round(o.x) + .5, Math.round(o.y) + .5, Math.round(doc.w * z), Math.round(doc.h * z));
    g.restore();

    /* repères posés à la main (tirés depuis les règles) */
    if (flags.safe && doc.rules && doc.rules.length) {
      g.save();
      g.lineWidth = 1;
      for (var ri = 0; ri < doc.rules.length; ri++) {
        var ru = doc.rules[ri];
        g.strokeStyle = (dragRule && dragRule.i === ri) ? '#FF4DD8' : 'rgba(77,163,255,.85)';
        g.beginPath();
        if (ru.axis === 'x') { var rx = Math.round(d2s(ru.v, 0).x) + .5; g.moveTo(rx, 0); g.lineTo(rx, s.h); }
        else { var ry = Math.round(d2s(0, ru.v).y) + .5; g.moveTo(0, ry); g.lineTo(s.w, ry); }
        g.stroke();
      }
      g.restore();
    }

    /* repères d'alignement actifs */
    if (guides.length) {
      g.save();
      g.strokeStyle = '#FF4DD8';
      g.lineWidth = 1;
      g.beginPath();
      for (var i = 0; i < guides.length; i++) {
        var gd = guides[i];
        if (gd.axis === 'x') { var px = Math.round(d2s(gd.v, 0).x) + .5; g.moveTo(px, o.y - 20); g.lineTo(px, o.y + doc.h * z + 20); }
        else { var py = Math.round(d2s(0, gd.v).y) + .5; g.moveTo(o.x - 20, py); g.lineTo(o.x + doc.w * z + 20, py); }
      }
      g.stroke();
      g.restore();
    }

    /* tracé plume en cours */
    if (pathDraft) drawDraftPath(g);

    /* sélection */
    var selLayers = selectedLayers();
    if (edit && selLayers.length === 1) drawTextEditing(g, selLayers[0]);
    else if (contentEdit) drawContentEdit(g, findLayer(doc.layers, contentEdit));
    else if (selLayers.length) drawSelection(g, selLayers);

    /* points de tracé si outil sélection directe */
    if (tool === 'node' && selLayers.length === 1 && selLayers[0].type === 'path') drawNodes(g, selLayers[0]);

    /* forme en cours de tracé à la souris */
    if (drag && drag.kind === 'create' && drag.moved) {
      var a0 = d2s(Math.min(drag.x0, drag.x1), Math.min(drag.y0, drag.y1));
      var b0 = d2s(Math.max(drag.x0, drag.x1), Math.max(drag.y0, drag.y1));
      g.save();
      g.strokeStyle = '#7DFF4F';
      g.setLineDash([5, 4]);
      g.lineWidth = 1.3;
      if (drag.tool === 'line') {
        var p1 = d2s(drag.x0, drag.y0), p2 = d2s(drag.x1, drag.y1);
        g.setLineDash([]);
        g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke();
      } else {
        g.fillStyle = 'rgba(125,255,79,.07)';
        g.fillRect(a0.x, a0.y, b0.x - a0.x, b0.y - a0.y);
        g.strokeRect(Math.round(a0.x) + .5, Math.round(a0.y) + .5, Math.round(b0.x - a0.x), Math.round(b0.y - a0.y));
      }
      g.setLineDash([]);
      g.restore();
    }

    /* rectangle de sélection */
    if (marquee) {
      g.save();
      g.strokeStyle = '#7DFF4F';
      g.fillStyle = 'rgba(125,255,79,.09)';
      g.lineWidth = 1;
      var x = Math.min(marquee.x0, marquee.x1), y = Math.min(marquee.y0, marquee.y1);
      var w = Math.abs(marquee.x1 - marquee.x0), h = Math.abs(marquee.y1 - marquee.y0);
      g.fillRect(x, y, w, h);
      g.strokeRect(Math.round(x) + .5, Math.round(y) + .5, Math.round(w), Math.round(h));
      g.restore();
    }
  }

  var HS = 4.5;   /* demi-taille d'une poignée, en pixels écran */

  function handlePoints(l) {
    /* poignées en coordonnées écran, dans l'ordre nw n ne e se s sw w */
    var pts = [
      { k: 'nw', p: toDoc(l, 0, 0) }, { k: 'n', p: toDoc(l, l.w / 2, 0) },
      { k: 'ne', p: toDoc(l, l.w, 0) }, { k: 'e', p: toDoc(l, l.w, l.h / 2) },
      { k: 'se', p: toDoc(l, l.w, l.h) }, { k: 's', p: toDoc(l, l.w / 2, l.h) },
      { k: 'sw', p: toDoc(l, 0, l.h) }, { k: 'w', p: toDoc(l, 0, l.h / 2) }
    ];
    return pts.map(function (h) { var s = d2s(h.p.x, h.p.y); return { k: h.k, x: s.x, y: s.y }; });
  }

  function drawSelection(g, list) {
    g.save();
    if (list.length === 1) {
      var l = list[0];
      var c = corners(l).map(function (p) { return d2s(p.x, p.y); });
      g.strokeStyle = '#7DFF4F';
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(c[0].x, c[0].y);
      for (var i = 1; i < 4; i++) g.lineTo(c[i].x, c[i].y);
      g.closePath();
      g.stroke();

      if (!l.locked) {
        var hs = handlePoints(l);
        var skip = (l.type === 'shape' && l.shape === 'line') ? { n: 1, s: 1, nw: 1, ne: 1, se: 1, sw: 1 } : {};
        for (var j = 0; j < hs.length; j++) {
          if (skip[hs[j].k]) continue;
          g.fillStyle = '#0B0B0D';
          g.strokeStyle = '#7DFF4F';
          g.lineWidth = 1.4;
          g.beginPath();
          g.rect(hs[j].x - HS, hs[j].y - HS, HS * 2, HS * 2);
          g.fill(); g.stroke();
        }
        /* bouton de rotation au-dessus */
        var rp = rotHandle(l);
        g.beginPath();
        g.moveTo((hs[0].x + hs[2].x) / 2, (hs[0].y + hs[2].y) / 2);
        g.lineTo(rp.x, rp.y);
        g.strokeStyle = 'rgba(125,255,79,.55)';
        g.lineWidth = 1;
        g.stroke();
        g.beginPath();
        g.arc(rp.x, rp.y, 5.5, 0, Math.PI * 2);
        g.fillStyle = '#0B0B0D'; g.strokeStyle = '#7DFF4F'; g.lineWidth = 1.4;
        g.fill(); g.stroke();
      }
      if (l.locked) {
        g.setLineDash([4, 3]);
        g.strokeStyle = '#FFB84D';
        g.beginPath();
        g.moveTo(c[0].x, c[0].y);
        for (var k = 1; k < 4; k++) g.lineTo(c[k].x, c[k].y);
        g.closePath();
        g.stroke();
        g.setLineDash([]);
      }
      drawSizeTag(g, l);
    } else {
      var b = bboxOf(list);
      var p0 = d2s(b.x, b.y), p1 = d2s(b.x + b.w, b.y + b.h);
      g.strokeStyle = '#7DFF4F';
      g.lineWidth = 1.4;
      g.strokeRect(Math.round(p0.x) + .5, Math.round(p0.y) + .5, Math.round(p1.x - p0.x), Math.round(p1.y - p0.y));
      for (var m = 0; m < list.length; m++) {
        var cc = corners(list[m]).map(function (p) { return d2s(p.x, p.y); });
        g.strokeStyle = 'rgba(125,255,79,.35)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(cc[0].x, cc[0].y);
        for (var n = 1; n < 4; n++) g.lineTo(cc[n].x, cc[n].y);
        g.closePath(); g.stroke();
      }
      var hs2 = [
        { k: 'nw', x: p0.x, y: p0.y }, { k: 'ne', x: p1.x, y: p0.y },
        { k: 'se', x: p1.x, y: p1.y }, { k: 'sw', x: p0.x, y: p1.y }
      ];
      for (var q = 0; q < hs2.length; q++) {
        g.fillStyle = '#0B0B0D'; g.strokeStyle = '#7DFF4F'; g.lineWidth = 1.4;
        g.beginPath(); g.rect(hs2[q].x - HS, hs2[q].y - HS, HS * 2, HS * 2);
        g.fill(); g.stroke();
      }
    }
    g.restore();
  }

  function rotHandle(l) {
    var top = toDoc(l, l.w / 2, 0), c = layerCenter(l);
    var s = d2s(top.x, top.y), sc = d2s(c.x, c.y);
    var dx = s.x - sc.x, dy = s.y - sc.y, len = Math.hypot(dx, dy) || 1;
    return { x: s.x + dx / len * 22, y: s.y + dy / len * 22 };
  }

  function drawSizeTag(g, l) {
    var b = bboxOf([l]);
    var p = d2s(b.x, b.y + b.h);
    var txt = Math.round(l.w) + ' × ' + Math.round(l.h) + (l.rot ? '  ' + fmtNum(l.rot, 1) + '°' : '');
    g.font = "500 10.5px 'JetBrains Mono', monospace";
    var w = g.measureText(txt).width + 12;
    g.fillStyle = 'rgba(125,255,79,.92)';
    roundRectPath(g, p.x, p.y + 8, w, 17, 4);
    g.fill();
    g.fillStyle = '#08130A';
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(txt, p.x + 6, p.y + 17);
  }

  /* ---------- édition de texte : sélection et curseur ---------- */
  function drawTextEditing(g, l) {
    var lay = layoutText(l, true);
    var oy = 0;
    if (l.ts.valign === 'middle') oy = (l.h - lay.h) / 2;
    else if (l.ts.valign === 'bottom') oy = l.h - lay.h;

    var a = Math.min(edit.a, edit.b), b = Math.max(edit.a, edit.b);

    g.save();
    /* cadre de la boîte de texte */
    var cs = corners(l).map(function (p) { return d2s(p.x, p.y); });
    g.strokeStyle = 'rgba(125,255,79,.75)';
    g.setLineDash([4, 3]);
    g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(cs[0].x, cs[0].y);
    for (var i = 1; i < 4; i++) g.lineTo(cs[i].x, cs[i].y);
    g.closePath(); g.stroke();
    g.setLineDash([]);

    /* surlignage de la sélection */
    if (a !== b) {
      g.fillStyle = 'rgba(125,255,79,.28)';
      eachCharBox(l, lay, oy, function (idx, x0, x1, y0, y1) {
        if (idx < a || idx >= b) return;
        var q0 = d2s(toDoc(l, x0, y0).x, toDoc(l, x0, y0).y);
        var q1 = d2s(toDoc(l, x1, y1).x, toDoc(l, x1, y1).y);
        g.fillRect(q0.x, q0.y, q1.x - q0.x, q1.y - q0.y);
      });
    }

    /* curseur */
    if (a === b && caretOn) {
      var c = caretPos(l, lay, oy, edit.a);
      var s0 = toDoc(l, c.x, c.y0), s1 = toDoc(l, c.x, c.y1);
      var p0 = d2s(s0.x, s0.y), p1 = d2s(s1.x, s1.y);
      g.strokeStyle = '#FFFFFF';
      g.lineWidth = Math.max(1.2, 1.6);
      g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke();
    }
    g.restore();
  }

  /* Parcourt chaque caractère mis en page, en coordonnées locales. */
  function eachCharBox(l, lay, oy, fn) {
    var idx = 0;
    for (var i = 0; i < lay.lines.length; i++) {
      var ln = lay.lines[i], lx = 0;
      if (l.ts.align === 'center') lx = (l.w - ln.w) / 2;
      else if (l.ts.align === 'right') lx = l.w - ln.w;
      var y0 = oy + ln.y, y1 = y0 + ln.h;
      for (var j = 0; j < ln.items.length; j++) {
        var it = ln.items[j], ch = it.chars || measureRun(it.t, it.st, true).chars;
        for (var k = 0; k < it.t.length; k++) {
          fn(idx, lx + it.x + ch[k], lx + it.x + ch[k + 1], y0, y1, i, it.st);
          idx++;
        }
      }
      /* seul un vrai « \n » consomme un caractère ; un renvoi
         automatique n'en consomme aucun */
      if (ln.hard) idx++;
    }
  }

  /* Position du curseur pour l'indice de caractère donné. */
  function caretPos(l, lay, oy, index) {
    var found = null, last = null;
    eachCharBox(l, lay, oy, function (idx, x0, x1, y0, y1) {
      if (idx === index && !found) found = { x: x0, y0: y0, y1: y1 };
      last = { x: x1, y0: y0, y1: y1 };
    });
    if (found) return found;
    if (last) return last;
    var ln = lay.lines[0] || { y: 0, h: l.ts.size * (l.ts.lh || 1.2), w: 0 };
    var lx = l.ts.align === 'center' ? l.w / 2 : (l.ts.align === 'right' ? l.w : 0);
    return { x: lx, y0: oy + ln.y, y1: oy + ln.y + ln.h };
  }

  /* Indice de caractère le plus proche d'un point local. */
  function indexAtPoint(l, lx, ly) {
    var lay = layoutText(l, true), oy = 0;
    if (l.ts.valign === 'middle') oy = (l.h - lay.h) / 2;
    else if (l.ts.valign === 'bottom') oy = l.h - lay.h;
    var best = 0, bestD = Infinity, total = 0;
    eachCharBox(l, lay, oy, function (idx, x0, x1, y0, y1) {
      total = Math.max(total, idx + 1);
      var inRow = ly >= y0 && ly <= y1;
      var mid = (x0 + x1) / 2;
      var d = Math.abs(lx - mid) + (inRow ? 0 : Math.abs(ly - (y0 + y1) / 2) * 12);
      if (d < bestD) { bestD = d; best = lx > mid ? idx + 1 : idx; }
    });
    return clamp(best, 0, textLen(l));
  }

  /* ---------- recadrage de contenu (objet dynamique) ---------- */
  function drawContentEdit(g, l) {
    if (!l) return;
    g.save();
    var cs = corners(l).map(function (p) { return d2s(p.x, p.y); });
    g.strokeStyle = '#4DA3FF';
    g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(cs[0].x, cs[0].y);
    for (var i = 1; i < 4; i++) g.lineTo(cs[i].x, cs[i].y);
    g.closePath(); g.stroke();

    var e = l.src ? getImage(l.src) : null;
    if (e && e.ok) {
      var iw = e.img.naturalWidth, ih = e.img.naturalHeight;
      var r = fitRect(iw, ih, l.w, l.h, l.fit, l.zoom, l.ox, l.oy);
      var a = d2s(toDoc(l, r.x, r.y).x, toDoc(l, r.x, r.y).y);
      var b = d2s(toDoc(l, r.x + r.w, r.y + r.h).x, toDoc(l, r.x + r.w, r.y + r.h).y);
      g.setLineDash([5, 4]);
      g.strokeStyle = 'rgba(77,163,255,.7)';
      g.lineWidth = 1;
      g.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      g.setLineDash([]);
    }
    var tag = 'Recadrage — glissez l image, molette pour zoomer, Échap pour sortir';
    g.font = "500 10.5px 'Archivo', system-ui, sans-serif";
    var w = g.measureText(tag).width + 14;
    var p = d2s(l.x, l.y);
    g.fillStyle = 'rgba(77,163,255,.95)';
    roundRectPath(g, p.x, p.y - 24, w, 18, 4);
    g.fill();
    g.fillStyle = '#04121F';
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(tag, p.x + 7, p.y - 15);
    g.restore();
  }

  /* ---------- points de tracé ---------- */
  function drawNodes(g, l) {
    var n = l.nodes || [];
    g.save();
    for (var i = 0; i < n.length; i++) {
      var p = nodeScreen(l, n[i].x, n[i].y);
      /* poignées de courbure */
      ['h1', 'h2'].forEach(function (h) {
        var hx = n[i][h + 'x'], hy = n[i][h + 'y'];
        if (hx == null || (hx === n[i].x && hy === n[i].y)) return;
        var q = nodeScreen(l, hx, hy);
        g.strokeStyle = 'rgba(77,163,255,.75)';
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke();
        g.beginPath(); g.arc(q.x, q.y, 3.4, 0, Math.PI * 2);
        g.fillStyle = '#4DA3FF'; g.fill();
      });
      g.beginPath();
      g.rect(p.x - 4, p.y - 4, 8, 8);
      g.fillStyle = (drag && drag.kind === 'node' && drag.ni === i) ? '#7DFF4F' : '#0B0B0D';
      g.strokeStyle = '#7DFF4F'; g.lineWidth = 1.4;
      g.fill(); g.stroke();
    }
    g.restore();
  }
  function nodeScreen(l, nx, ny) {
    var d = toDoc(l, nx * l.w, ny * l.h);
    return d2s(d.x, d.y);
  }

  function drawDraftPath(g) {
    var n = pathDraft.nodes;
    if (!n.length) return;
    g.save();
    g.strokeStyle = '#7DFF4F';
    g.lineWidth = 1.6;
    g.beginPath();
    var p0 = d2s(n[0].x, n[0].y);
    g.moveTo(p0.x, p0.y);
    for (var i = 1; i < n.length; i++) {
      var a = d2s(n[i - 1].h2x != null ? n[i - 1].h2x : n[i - 1].x, n[i - 1].h2y != null ? n[i - 1].h2y : n[i - 1].y);
      var b = d2s(n[i].h1x != null ? n[i].h1x : n[i].x, n[i].h1y != null ? n[i].h1y : n[i].y);
      var p = d2s(n[i].x, n[i].y);
      g.bezierCurveTo(a.x, a.y, b.x, b.y, p.x, p.y);
    }
    /* segment en cours vers le pointeur */
    if (pathDraft.cursor) {
      var lastN = n[n.length - 1];
      var la = d2s(lastN.h2x != null ? lastN.h2x : lastN.x, lastN.h2y != null ? lastN.h2y : lastN.y);
      var lc = d2s(pathDraft.cursor.x, pathDraft.cursor.y);
      g.bezierCurveTo(la.x, la.y, lc.x, lc.y, lc.x, lc.y);
    }
    g.stroke();

    for (var k = 0; k < n.length; k++) {
      var q = d2s(n[k].x, n[k].y);
      g.beginPath(); g.rect(q.x - 4, q.y - 4, 8, 8);
      g.fillStyle = k === 0 ? '#7DFF4F' : '#0B0B0D';
      g.strokeStyle = '#7DFF4F'; g.lineWidth = 1.4;
      g.fill(); g.stroke();
      if (n[k].h2x != null && (n[k].h2x !== n[k].x || n[k].h2y !== n[k].y)) {
        var hq = d2s(n[k].h2x, n[k].h2y);
        g.strokeStyle = 'rgba(77,163,255,.7)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(hq.x, hq.y); g.stroke();
        g.beginPath(); g.arc(hq.x, hq.y, 3.2, 0, Math.PI * 2); g.fillStyle = '#4DA3FF'; g.fill();
      }
    }
    g.restore();
  }

  /* ---------- règles ---------- */
  function drawRulers(s) {
    if (!els.rulerH || !els.rulerV) return;
    var stepDoc = niceStep(100 / view.zoom);
    var gh = els.rulerH.getContext('2d');
    gh.setTransform(dpr, 0, 0, dpr, 0, 0);
    gh.clearRect(0, 0, s.w, 20);
    gh.fillStyle = '#6E6E77';
    gh.font = "400 8.5px 'JetBrains Mono', monospace";
    gh.textBaseline = 'top';
    gh.strokeStyle = 'rgba(255,255,255,.16)';
    gh.lineWidth = 1;
    gh.beginPath();
    var start = Math.floor(s2d(0, 0).x / stepDoc) * stepDoc;
    for (var x = start; ; x += stepDoc) {
      var px = d2s(x, 0).x;
      if (px > s.w + 40) break;
      if (px >= -40) {
        gh.moveTo(Math.round(px) + .5, 13); gh.lineTo(Math.round(px) + .5, 20);
        gh.fillText(String(Math.round(x)), Math.round(px) + 3, 3);
      }
    }
    gh.stroke();

    var gv = els.rulerV.getContext('2d');
    gv.setTransform(dpr, 0, 0, dpr, 0, 0);
    gv.clearRect(0, 0, 20, s.h);
    gv.fillStyle = '#6E6E77';
    gv.font = "400 8.5px 'JetBrains Mono', monospace";
    gv.strokeStyle = 'rgba(255,255,255,.16)';
    gv.lineWidth = 1;
    gv.beginPath();
    var starty = Math.floor(s2d(0, 0).y / stepDoc) * stepDoc;
    for (var y = starty; ; y += stepDoc) {
      var py = d2s(0, y).y;
      if (py > s.h + 40) break;
      if (py >= -40) {
        gv.moveTo(13, Math.round(py) + .5); gv.lineTo(20, Math.round(py) + .5);
        gv.save();
        gv.translate(9, Math.round(py) + 3);
        gv.rotate(-Math.PI / 2);
        gv.textAlign = 'right'; gv.textBaseline = 'top';
        gv.fillText(String(Math.round(y)), 0, 0);
        gv.restore();
      }
    }
    gv.stroke();
  }
  function niceStep(target) {
    var pows = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000];
    for (var i = 0; i < pows.length; i++) if (pows[i] >= target) return pows[i];
    return 10000;
  }

  /* ===================================================================
     13. SÉLECTION
     =================================================================== */

  function selectedLayers() {
    var out = [];
    for (var i = 0; i < sel.length; i++) {
      var l = findLayer(doc.layers, sel[i]);
      if (l) out.push(l);
    }
    return out;
  }
  function selOne() { var s = selectedLayers(); return s.length === 1 ? s[0] : null; }

  function select(ids, additive) {
    ids = ids || [];
    if (!Array.isArray(ids)) ids = [ids];
    if (additive) {
      for (var i = 0; i < ids.length; i++) {
        var k = sel.indexOf(ids[i]);
        if (k >= 0) sel.splice(k, 1); else sel.push(ids[i]);
      }
    } else sel = ids.slice();
    if (edit && sel.indexOf(edit.id) < 0) exitTextEdit();
    if (contentEdit && sel.indexOf(contentEdit) < 0) contentEdit = null;
    renderProps();
    renderLayers();
    requestDraw();
  }

  /* Calque le plus haut sous le point. Les groupes répondent comme un
     bloc ; un double-clic descend dedans (voir onDblClick). */
  function topLayerAt(px, py, tol) {
    for (var i = doc.layers.length - 1; i >= 0; i--) {
      var l = doc.layers[i];
      if (!l.visible || l.locked) continue;
      if (hitLayer(l, px, py, tol || 0)) return l;
    }
    return null;
  }
  function childAt(g, px, py, tol) {
    for (var i = (g.children || []).length - 1; i >= 0; i--) {
      var c = g.children[i];
      if (!c.visible || c.locked) continue;
      if (c.type === 'group') { var d = childAt(c, px, py, tol); if (d) return d; }
      else if (hitLayer(c, px, py, tol || 0)) return c;
    }
    return null;
  }

  /* ===================================================================
     14. HISTORIQUE
     ---------------------------------------------------------------
     Instantanés JSON du document entier. Simple, et surtout : rien ne
     peut être annulé « à moitié ». Les champs commençant par _ sont des
     caches de rendu, ils ne sont jamais enregistrés.
     =================================================================== */

  var hist = { undo: [], redo: [], pre: null };

  function serialize(d) {
    return JSON.stringify(d, function (k, v) { return k.charAt(0) === '_' ? undefined : v; });
  }
  function beginChange() { if (hist.pre === null) hist.pre = serialize(doc); }
  function endChange() {
    if (hist.pre === null) return;
    var now = serialize(doc);
    if (now !== hist.pre) {
      hist.undo.push(hist.pre);
      if (hist.undo.length > 80) hist.undo.shift();
      hist.redo.length = 0;
      markDirty(true);
    }
    hist.pre = null;
    syncHistButtons();
  }
  function change(fn) { beginChange(); fn(); endChange(); refreshAll(); }

  function restore(json) {
    var keep = sel.slice();
    doc = JSON.parse(json);
    sel = keep.filter(function (id) { return !!findLayer(doc.layers, id); });
    exitTextEdit(true);
    contentEdit = null;
    syncFormatSelect();
    if (els.projName) els.projName.value = doc.name || 'Sans titre';
    refreshAll();
  }
  function undo() {
    if (!hist.undo.length) { toast('Rien à annuler'); return; }
    hist.redo.push(serialize(doc));
    restore(hist.undo.pop());
    markDirty(true);
    syncHistButtons();
    toast('Annulé');
  }
  function redo() {
    if (!hist.redo.length) { toast('Rien à rétablir'); return; }
    hist.undo.push(serialize(doc));
    restore(hist.redo.pop());
    markDirty(true);
    syncHistButtons();
    toast('Rétabli');
  }
  function syncHistButtons() {
    if (els.undo) els.undo.disabled = !hist.undo.length;
    if (els.redo) els.redo.disabled = !hist.redo.length;
  }

  function markDirty(v) {
    dirty = v !== false;
    if (els.dirtyDot) els.dirtyDot.classList.toggle('is-dirty', dirty);
    if (dirty && els.saveInfo && project.id) els.saveInfo.textContent = 'Modifié';
  }

  function refreshAll() {
    renderLayers();
    renderProps();
    renderFloat();
    requestDraw();
  }

  /* ---------- barre flottante au-dessus de la sélection ----------
     Reprise de la maquette : les gestes les plus fréquents à portée du
     pointeur, sans traverser l'écran jusqu'au panneau de droite. */
  function renderFloat() {
    if (!els.float) return;
    var ls = selectedLayers();
    if (!ls.length || edit || contentEdit || preview || drag) {
      els.float.classList.remove('is-on');
      return;
    }
    var l = ls[0];
    var b = bboxOf(ls);
    var p = d2s(b.x + b.w / 2, b.y);
    var s = sceneSize();
    var top = p.y - 12;
    if (top < 46) top = d2s(0, b.y + b.h).y + 52;      /* pas de place au-dessus : on passe dessous */
    els.float.style.left = clamp(p.x, 90, s.w - 90) + 'px';
    els.float.style.top = clamp(top, 40, s.h - 8) + 'px';

    var B = function (act, title, svg, cls) {
      return '<button type="button" data-fact="' + act + '" title="' + esc(title) + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + svg + '</button>';
    };
    var S = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
    var h = '';
    if (ls.length === 1 && l.type === 'text') {
      h += B('edit', 'Modifier le texte (Entrée)', '<svg width="14" height="14" viewBox="0 0 24 24" ' + S + '><path d="M4 5h16M12 5v14M8.5 19h7"/></svg>');
    }
    if (ls.length === 1 && (l.type === 'image' || l.type === 'frame')) {
      h += B('crop', 'Recadrer l image', '<svg width="14" height="14" viewBox="0 0 24 24" ' + S + '><path d="M6 2v16h16M2 6h16v16"/></svg>');
      h += B('swap', 'Remplacer l image', '<svg width="14" height="14" viewBox="0 0 24 24" ' + S + '><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m4 17 5-5.5 3.5 3.5L16 11l4 5.5"/></svg>');
    }
    if (ls.length === 1 && l.type === 'path') {
      h += B('nodes', 'Modifier les points (A)', '<svg width="14" height="14" viewBox="0 0 24 24" ' + S + '><path d="M3 21c0-8 5-13 13-13"/><rect x="2" y="19" width="4" height="4"/></svg>');
    }
    h += B('center', 'Centrer dans l affiche', '<svg width="14" height="14" viewBox="0 0 24 24" ' + S + '><path d="M12 3v18M3 12h18"/><rect x="8.5" y="8.5" width="7" height="7"/></svg>');
    h += B('front', 'Premier plan', '<svg width="14" height="14" viewBox="0 0 24 24" ' + S + '><rect x="3" y="3" width="12" height="12" rx="2"/><path d="M9 21h10a2 2 0 0 0 2-2V9"/></svg>');
    h += B('clip', l.clip ? 'Retirer le masque' : 'Masquer par le calque du dessous', '<svg width="14" height="14" viewBox="0 0 24 24" ' + S + '><circle cx="9" cy="9" r="6"/><path d="M13 13h8v8h-8z"/></svg>');
    h += '<span class="bs-float-sep"></span>';
    h += B('dup', 'Dupliquer (Ctrl+D)', '<svg width="14" height="14" viewBox="0 0 24 24" ' + S + '><rect x="3.5" y="3.5" width="12" height="12" rx="2"/><path d="M8 20.5h10a2.5 2.5 0 0 0 2.5-2.5V8"/></svg>');
    h += B('del', 'Supprimer (Suppr)', '<svg width="14" height="14" viewBox="0 0 24 24" ' + S + '><path d="M4 6.5h16M9 6.5V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5v2M17.5 6.5V19a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V6.5"/></svg>', 'bs-f-danger');

    els.float.innerHTML = h;
    els.float.classList.add('is-on');
    $$('button', els.float).forEach(function (b2) {
      b2.addEventListener('click', function (ev) {
        ev.stopPropagation();
        floatAction(b2.getAttribute('data-fact'));
      });
    });
  }

  function floatAction(a) {
    var l = selOne();
    if (a === 'edit' && l) return enterTextEdit(l, 0, textLen(l));
    if (a === 'crop' && l) { if (l.src) { contentEdit = l.id; renderFloat(); requestDraw(); } else openPanel('images'); return; }
    if (a === 'swap' && l) { pendingFrame = l.id; els.file.click(); return; }
    if (a === 'nodes') return setTool('node');
    if (a === 'front' && l) return sendTo(l.id, 'front');
    if (a === 'clip' && l) return change(function () { l.clip = !l.clip; });
    runAction(a, { getAttribute: function () { return null; } });
  }

  /* ===================================================================
     15. MUTATIONS DE CALQUES
     =================================================================== */

  function addLayer(l, atTop) {
    change(function () {
      if (atTop === false) doc.layers.unshift(l); else doc.layers.push(l);
      sel = [l.id];
    });
    return l;
  }

  function removeSelected() {
    if (!sel.length) return;
    var n = sel.length;
    change(function () {
      for (var i = 0; i < sel.length; i++) {
        var loc = locate(doc.layers, sel[i]);
        if (loc) loc.arr.splice(loc.idx, 1);
      }
      sel = [];
      pruneGroups();
    });
    toast(n > 1 ? n + ' calques supprimés' : 'Calque supprimé');
  }

  /* Un groupe vide, ou à un seul enfant, n'a plus de raison d'être. */
  function pruneGroups() {
    function pass(arr) {
      for (var i = arr.length - 1; i >= 0; i--) {
        var l = arr[i];
        if (l.type !== 'group') continue;
        pass(l.children);
        if (!l.children.length) arr.splice(i, 1);
        else if (l.children.length === 1) arr.splice(i, 1, l.children[0]);
        else reflowGroup(l);
      }
    }
    pass(doc.layers);
  }

  function duplicateSelected() {
    if (!sel.length) return;
    var copies = [];
    change(function () {
      var off = Math.round(doc.w * 0.022);
      for (var i = 0; i < sel.length; i++) {
        var loc = locate(doc.layers, sel[i]);
        if (!loc) continue;
        var c = reid(clone(loc.layer));
        shiftLayer(c, off, off);
        c.name = loc.layer.name;
        loc.arr.splice(loc.idx + 1, 0, c);
        copies.push(c.id);
      }
      sel = copies;
    });
    toast(copies.length > 1 ? copies.length + ' calques dupliqués' : 'Calque dupliqué');
  }
  function reid(l) {
    l.id = uid();
    if (l.type === 'group') for (var i = 0; i < l.children.length; i++) reid(l.children[i]);
    return l;
  }
  function shiftLayer(l, dx, dy) {
    l.x += dx; l.y += dy;
    if (l.type === 'group') for (var i = 0; i < l.children.length; i++) shiftLayer(l.children[i], dx, dy);
  }
  function scaleLayer(l, sx, sy, ox, oy) {
    l.x = ox + (l.x - ox) * sx;
    l.y = oy + (l.y - oy) * sy;
    l.w *= sx; l.h *= sy;
    if (l.type === 'text') {
      var k = Math.min(sx, sy);
      l.ts.size = Math.max(1, l.ts.size * k);
      if (l.ts.strokeW) l.ts.strokeW *= k;
      scaleRunSizes(l, k);
    }
    if (l.stroke && l.stroke.w) l.stroke.w *= Math.min(sx, sy);
    if (l.radius) l.radius *= Math.min(sx, sy);
    if (l.type === 'group') for (var i = 0; i < l.children.length; i++) scaleLayer(l.children[i], sx, sy, ox, oy);
  }
  function scaleRunSizes(l, k) {
    for (var i = 0; i < l.runs.length; i++) {
      if (l.runs[i].s && l.runs[i].s.size) l.runs[i].s.size = Math.max(1, l.runs[i].s.size * k);
      if (l.runs[i].s && l.runs[i].s.strokeW) l.runs[i].s.strokeW *= k;
    }
  }

  function groupSelected() {
    var ls = selectedLayers();
    if (ls.length === 1 && ls[0].type === 'group') { ungroup(ls[0]); return; }
    if (ls.length < 2) { toast('Sélectionnez au moins deux calques'); return; }
    change(function () {
      var ordered = [];
      walk(doc.layers, function (l, arr, i, parent) { if (sel.indexOf(l.id) >= 0 && !parent) ordered.push(l); });
      if (ordered.length < 2) { toast('Groupez des calques du même niveau'); return; }
      var lastIdx = 0;
      for (var i = 0; i < ordered.length; i++) lastIdx = Math.max(lastIdx, doc.layers.indexOf(ordered[i]));
      for (var j = 0; j < ordered.length; j++) {
        var k = doc.layers.indexOf(ordered[j]);
        if (k >= 0) doc.layers.splice(k, 1);
      }
      var g = newLayer('group', { children: ordered, name: 'Groupe' });
      reflowGroup(g);
      doc.layers.splice(Math.min(lastIdx - ordered.length + 1, doc.layers.length), 0, g);
      sel = [g.id];
    });
    toast('Calques groupés');
  }
  function ungroup(g) {
    change(function () {
      var loc = locate(doc.layers, g.id);
      if (!loc) return;
      var kids = g.children.slice();
      loc.arr.splice.apply(loc.arr, [loc.idx, 1].concat(kids));
      sel = kids.map(function (k) { return k.id; });
    });
    toast('Groupe dissous');
  }

  function moveLayerOrder(id, dir) {
    change(function () {
      var loc = locate(doc.layers, id);
      if (!loc) return;
      var ni = loc.idx + dir;
      if (ni < 0 || ni >= loc.arr.length) return;
      var it = loc.arr.splice(loc.idx, 1)[0];
      loc.arr.splice(ni, 0, it);
    });
  }
  function sendTo(id, where) {
    change(function () {
      var loc = locate(doc.layers, id);
      if (!loc) return;
      var it = loc.arr.splice(loc.idx, 1)[0];
      if (where === 'front') loc.arr.push(it); else loc.arr.unshift(it);
    });
  }

  /* ===================================================================
     16. MAGNÉTISME ET REPÈRES
     =================================================================== */

  function snapTargets(excludeIds) {
    var xs = [0, doc.w / 2, doc.w], ys = [0, doc.h / 2, doc.h];
    if (flags.safe) {
      var m = doc.safe * doc.w;
      xs.push(m, doc.w - m); ys.push(m, doc.h - m);
      for (var r = 0; r < (doc.rules || []).length; r++) {
        (doc.rules[r].axis === 'x' ? xs : ys).push(doc.rules[r].v);
      }
    }
    for (var i = 0; i < doc.layers.length; i++) {
      var l = doc.layers[i];
      if (!l.visible || excludeIds.indexOf(l.id) >= 0) continue;
      var b = bboxOf([l]);
      xs.push(b.x, b.x + b.w / 2, b.x + b.w);
      ys.push(b.y, b.y + b.h / 2, b.y + b.h);
    }
    return { xs: xs, ys: ys };
  }

  /* Renvoie la correction {dx, dy} à appliquer et remplit `guides`. */
  function snapBox(box, excludeIds) {
    guides = [];
    if (!flags.snap) return { dx: 0, dy: 0 };
    var T = 7 / view.zoom;
    var t = snapTargets(excludeIds);
    var mx = [box.x, box.x + box.w / 2, box.x + box.w];
    var my = [box.y, box.y + box.h / 2, box.y + box.h];
    var bestX = null, bestY = null, i, j, d;
    for (i = 0; i < mx.length; i++) for (j = 0; j < t.xs.length; j++) {
      d = t.xs[j] - mx[i];
      if (Math.abs(d) <= T && (!bestX || Math.abs(d) < Math.abs(bestX.d))) bestX = { d: d, v: t.xs[j] };
    }
    for (i = 0; i < my.length; i++) for (j = 0; j < t.ys.length; j++) {
      d = t.ys[j] - my[i];
      if (Math.abs(d) <= T && (!bestY || Math.abs(d) < Math.abs(bestY.d))) bestY = { d: d, v: t.ys[j] };
    }
    if (bestX) guides.push({ axis: 'x', v: bestX.v });
    if (bestY) guides.push({ axis: 'y', v: bestY.v });
    return { dx: bestX ? bestX.d : 0, dy: bestY ? bestY.d : 0 };
  }

  /* ===================================================================
     17. INTERACTION SUR LA SCÈNE
     =================================================================== */

  function scenePoint(e) {
    var r = els.scene.getBoundingClientRect();
    return { sx: e.clientX - r.left, sy: e.clientY - r.top };
  }

  /* ---------- repères tirés des règles ----------
     Le geste attendu partout : on tire depuis la règle, on lâche sur
     l'affiche. Ramener le repère sur la règle le supprime. */
  var dragRule = null;

  function startRuleDrag(e, axis) {
    if (e.button !== 0) return;
    e.preventDefault();
    if (!doc.rules) doc.rules = [];
    beginChange();
    var p = scenePoint(e), dp = s2d(p.sx, p.sy);
    doc.rules.push({ axis: axis, v: Math.round(axis === 'x' ? dp.x : dp.y) });
    dragRule = { i: doc.rules.length - 1, axis: axis };
    document.addEventListener('pointermove', moveRule);
    document.addEventListener('pointerup', endRule);
    requestDraw();
  }
  function grabRule(pt) {
    if (!flags.safe || !doc.rules) return false;
    for (var i = 0; i < doc.rules.length; i++) {
      var ru = doc.rules[i];
      var d = ru.axis === 'x' ? Math.abs(d2s(ru.v, 0).x - pt.sx) : Math.abs(d2s(0, ru.v).y - pt.sy);
      if (d <= 4) {
        beginChange();
        dragRule = { i: i, axis: ru.axis };
        document.addEventListener('pointermove', moveRule);
        document.addEventListener('pointerup', endRule);
        return true;
      }
    }
    return false;
  }
  function moveRule(e) {
    if (!dragRule) return;
    var p = scenePoint(e), dp = s2d(p.sx, p.sy);
    var ru = doc.rules[dragRule.i];
    if (!ru) return;
    ru.v = Math.round(dragRule.axis === 'x' ? dp.x : dp.y);
    dragRule.out = (p.sx < 0 || p.sy < 0);
    setCursor(dragRule.axis === 'x' ? 'ew' : 'ns');
    requestDraw();
  }
  function endRule() {
    document.removeEventListener('pointermove', moveRule);
    document.removeEventListener('pointerup', endRule);
    if (!dragRule) return;
    var ru = doc.rules[dragRule.i];
    var lim = dragRule.axis === 'x' ? doc.w : doc.h;
    if (ru && (dragRule.out || ru.v < -24 || ru.v > lim + 24)) doc.rules.splice(dragRule.i, 1);
    dragRule = null;
    setCursor(null);
    endChange();
    requestDraw();
  }

  function handleAt(l, sx, sy) {
    if (l.locked) return null;
    var rp = rotHandle(l);
    if (Math.hypot(sx - rp.x, sy - rp.y) <= 9) return 'rot';
    var hs = handlePoints(l);
    var skip = (l.type === 'shape' && l.shape === 'line') ? { n: 1, s: 1, nw: 1, ne: 1, se: 1, sw: 1 } : {};
    for (var i = 0; i < hs.length; i++) {
      if (skip[hs[i].k]) continue;
      if (Math.abs(sx - hs[i].x) <= HS + 3 && Math.abs(sy - hs[i].y) <= HS + 3) return hs[i].k;
    }
    return null;
  }
  function multiHandleAt(box, sx, sy) {
    var p0 = d2s(box.x, box.y), p1 = d2s(box.x + box.w, box.y + box.h);
    var pts = { nw: [p0.x, p0.y], ne: [p1.x, p0.y], se: [p1.x, p1.y], sw: [p0.x, p1.y] };
    for (var k in pts) if (Math.abs(sx - pts[k][0]) <= HS + 3 && Math.abs(sy - pts[k][1]) <= HS + 3) return k;
    return null;
  }

  /* setPointerCapture lève une exception si le pointeur n'est plus
     actif — souris relâchée hors de la fenêtre, événement synthétique.
     On ne laisse pas ça interrompre le geste en cours. */
  function capture(e) {
    try { els.scene.setPointerCapture(e.pointerId); } catch (err) {}
  }

  function onPointerDown(e) {
    if (!doc) return;
    var pt = scenePoint(e), p = s2d(pt.sx, pt.sy);
    lastPointer = pt;
    var additive = e.shiftKey;

    /* --- déplacement de la vue --- */
    if (e.button === 1 || tool === 'hand' || toolBeforeSpace) {
      drag = { kind: 'pan', sx: pt.sx, sy: pt.sy, px: view.px, py: view.py };
      setCursor('hand-down');
      capture(e);
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;

    /* --- zoom --- */
    if (tool === 'zoom') { zoomStep(e.altKey ? -1 : 1, pt.sx, pt.sy); return; }

    /* --- pipette --- */
    if (tool === 'eyedrop') { pickColor(pt.sx, pt.sy); return; }

    /* --- recadrage de contenu --- */
    if (contentEdit) {
      var cl = findLayer(doc.layers, contentEdit);
      if (cl && hitLayer(cl, p.x, p.y, 0)) {
        beginChange();
        drag = { kind: 'content', id: cl.id, sx: pt.sx, sy: pt.sy, ox: cl.ox, oy: cl.oy };
        capture(e);
        return;
      }
      contentEdit = null;
      requestDraw();
    }

    /* --- plume --- */
    if (tool === 'pen') { penDown(p, e); capture(e); return; }

    /* --- points de tracé --- */
    if (tool === 'node') {
      var pl = selOne();
      if (pl && pl.type === 'path' && nodeDown(pl, pt, p, e)) { capture(e); return; }
    }

    /* --- édition de texte en cours --- */
    if (edit) {
      var tl = findLayer(doc.layers, edit.id);
      if (tl) {
        var h = handleAt(tl, pt.sx, pt.sy);
        if (h) { startResize(tl, h, pt, e); capture(e); return; }
        if (hitLayer(tl, p.x, p.y, 4)) {
          var loc = toLocal(tl, p.x, p.y);
          var idx = indexAtPoint(tl, loc.x, loc.y);
          if (e.detail >= 3) { edit.a = 0; edit.b = textLen(tl); }
          else if (e.detail === 2) { var wr = wordRange(tl, idx); edit.a = wr[0]; edit.b = wr[1]; }
          else { edit.a = edit.b = idx; drag = { kind: 'textsel', id: tl.id, anchor: idx }; capture(e); }
          restartCaret(); renderProps(); requestDraw();
          return;
        }
        exitTextEdit();
      }
    }

    /* --- outils de création --- */
    if (tool === 'text' || tool === 'rect' || tool === 'ellipse' || tool === 'line' || tool === 'frame') {
      beginChange();
      drag = { kind: 'create', tool: tool, x0: p.x, y0: p.y, x1: p.x, y1: p.y, moved: false };
      capture(e);
      return;
    }

    /* --- outil sélection --- */
    if (tool === 'select' && grabRule(pt)) return;

    var cur = selectedLayers();
    if (cur.length === 1) {
      var hk = handleAt(cur[0], pt.sx, pt.sy);
      if (hk === 'rot') { startRotate(cur[0], pt); capture(e); return; }
      if (hk) { startResize(cur[0], hk, pt, e); capture(e); return; }
    } else if (cur.length > 1) {
      var mb = bboxOf(cur);
      var mh = multiHandleAt(mb, pt.sx, pt.sy);
      if (mh) { startMultiResize(cur, mb, mh, pt); capture(e); return; }
    }

    var hitL = topLayerAt(p.x, p.y, 3 / view.zoom);
    if (hitL) {
      if (additive) select([hitL.id], true);
      else if (sel.indexOf(hitL.id) < 0) select([hitL.id]);
      var ls = selectedLayers().filter(function (l) { return !l.locked; });
      if (ls.length) {
        beginChange();
        drag = {
          kind: 'move', sx: pt.sx, sy: pt.sy, moved: false,
          alt: e.altKey,
          items: ls.map(function (l) { return { id: l.id, x: l.x, y: l.y }; }),
          box: bboxOf(ls)
        };
        setCursor('move');
        capture(e);
      }
      return;
    }

    if (!additive) select([]);
    drag = { kind: 'marquee' };
    marquee = { x0: pt.sx, y0: pt.sy, x1: pt.sx, y1: pt.sy, additive: additive };
    capture(e);
  }

  function onPointerMove(e) {
    if (!doc) return;
    var pt = scenePoint(e), p = s2d(pt.sx, pt.sy);
    lastPointer = pt;
    updateStatusPos(p);

    if (pathDraft && !drag) { pathDraft.cursor = snapPen(p, e); requestDraw(); }

    if (!drag) { hoverCursor(pt, p); return; }

    switch (drag.kind) {
      case 'pan':
        view.px = drag.px + (pt.sx - drag.sx);
        view.py = drag.py + (pt.sy - drag.sy);
        requestDraw();
        break;

      case 'move': {
        var dx = (pt.sx - drag.sx) / view.zoom, dy = (pt.sy - drag.sy) / view.zoom;
        if (!drag.moved && Math.hypot(pt.sx - drag.sx, pt.sy - drag.sy) < 3) return;
        if (!drag.moved && drag.alt) duplicateForAltDrag(drag);
        drag.moved = true;
        if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        var box = { x: drag.box.x + dx, y: drag.box.y + dy, w: drag.box.w, h: drag.box.h };
        var s = snapBox(box, drag.items.map(function (i) { return i.id; }));
        for (var i = 0; i < drag.items.length; i++) {
          var l = findLayer(doc.layers, drag.items[i].id);
          if (!l) continue;
          var nx = Math.round(drag.items[i].x + dx + s.dx), ny = Math.round(drag.items[i].y + dy + s.dy);
          shiftLayer(l, nx - l.x, ny - l.y);
        }
        requestDraw();
        break;
      }

      case 'resize': doResize(pt, e); break;
      case 'multiresize': doMultiResize(pt, e); break;

      case 'rotate': {
        var l2 = findLayer(doc.layers, drag.id);
        if (!l2) return;
        var c = d2s(drag.cx, drag.cy);
        var a = Math.atan2(pt.sy - c.y, pt.sx - c.x) * 180 / Math.PI;
        var nr = drag.rot0 + (a - drag.a0);
        if (e.shiftKey) nr = Math.round(nr / 15) * 15;
        l2.rot = ((nr % 360) + 360) % 360;
        if (l2.rot > 180) l2.rot -= 360;
        requestDraw();
        break;
      }

      case 'content': {
        var f = findLayer(doc.layers, drag.id);
        if (!f || !f.src) return;
        var e2 = getImage(f.src);
        if (!e2 || !e2.ok) return;
        var r = fitRect(e2.img.naturalWidth, e2.img.naturalHeight, f.w, f.h, f.fit, f.zoom, .5, .5);
        var spanX = Math.max(1, r.w - f.w), spanY = Math.max(1, r.h - f.h);
        f.ox = clamp(drag.ox - (pt.sx - drag.sx) / view.zoom / spanX, 0, 1);
        f.oy = clamp(drag.oy - (pt.sy - drag.sy) / view.zoom / spanY, 0, 1);
        requestDraw();
        break;
      }

      case 'textsel': {
        var tl = findLayer(doc.layers, drag.id);
        if (!tl) return;
        var loc = toLocal(tl, p.x, p.y);
        edit.a = drag.anchor;
        edit.b = indexAtPoint(tl, loc.x, loc.y);
        renderProps();
        requestDraw();
        break;
      }

      case 'node': doNodeDrag(pt, p, e); break;

      /* plume : glisser après le clic sort les poignées de courbure */
      case 'penhandle':
        if (pathDraft) penHandleMove(snapPen(p, e));
        break;

      case 'create':
        drag.x1 = p.x; drag.y1 = p.y;
        if (Math.hypot(drag.x1 - drag.x0, drag.y1 - drag.y0) > 4 / view.zoom) drag.moved = true;
        if (e.shiftKey && drag.tool !== 'line') {
          var w = drag.x1 - drag.x0, h = drag.y1 - drag.y0;
          var m2 = Math.max(Math.abs(w), Math.abs(h));
          drag.x1 = drag.x0 + Math.sign(w || 1) * m2;
          drag.y1 = drag.y0 + Math.sign(h || 1) * m2;
        }
        drawCreatePreview();
        break;

      case 'marquee':
        marquee.x1 = pt.sx; marquee.y1 = pt.sy;
        requestDraw();
        break;
    }
  }

  function onPointerUp(e) {
    if (!drag) return;
    var pt = scenePoint(e), p = s2d(pt.sx, pt.sy);
    var kind = drag.kind;

    if (kind === 'create') {
      if (drag.moved) finishCreate(drag);
      else finishCreateClick(drag);
    } else if (kind === 'marquee') {
      applyMarquee();
      marquee = null;
    }

    /* le tracé à la plume reste ouvert entre deux clics : on ne clôt
       pas l'instantané tant que le tracé n'est pas validé */
    if (kind === 'move' || kind === 'resize' || kind === 'multiresize' || kind === 'rotate' ||
        kind === 'content' || kind === 'node' || kind === 'create') {
      endChange();
    }
    guides = [];
    drag = null;
    if (kind !== 'penhandle') setCursor(null);
    renderProps();
    renderLayers();
    requestDraw();
    try { els.scene.releasePointerCapture(e.pointerId); } catch (err) {}
  }

  function duplicateForAltDrag(dg) {
    var newItems = [];
    for (var i = 0; i < dg.items.length; i++) {
      var loc = locate(doc.layers, dg.items[i].id);
      if (!loc) continue;
      var c = reid(clone(loc.layer));
      loc.arr.splice(loc.idx, 0, c);           /* la copie reste en place, l'originale suit la souris */
      newItems.push({ id: dg.items[i].id, x: dg.items[i].x, y: dg.items[i].y });
    }
    dg.items = newItems;
  }

  function applyMarquee() {
    var x0 = Math.min(marquee.x0, marquee.x1), y0 = Math.min(marquee.y0, marquee.y1);
    var x1 = Math.max(marquee.x0, marquee.x1), y1 = Math.max(marquee.y0, marquee.y1);
    if (x1 - x0 < 3 && y1 - y0 < 3) return;
    var a = s2d(x0, y0), b = s2d(x1, y1);
    var hits = [];
    for (var i = 0; i < doc.layers.length; i++) {
      var l = doc.layers[i];
      if (!l.visible || l.locked) continue;
      var bb = bboxOf([l]);
      if (bb.x < b.x && bb.x + bb.w > a.x && bb.y < b.y && bb.y + bb.h > a.y) hits.push(l.id);
    }
    select(hits, marquee.additive);
  }

  function hoverCursor(pt, p) {
    if (tool === 'hand') return setCursor('hand');
    if (tool === 'zoom') return setCursor('zoom-in');
    if (tool === 'text') return setCursor('text');
    if (tool === 'pen' || tool === 'rect' || tool === 'ellipse' || tool === 'line' || tool === 'frame') return setCursor('cross');
    if (tool === 'eyedrop') return setCursor('copy');
    if (contentEdit) return setCursor('move');
    var cur = selectedLayers();
    if (cur.length === 1) {
      var h = handleAt(cur[0], pt.sx, pt.sy);
      if (h === 'rot') return setCursor('rotate');
      if (h) return setCursor(resizeCursor(h, cur[0].rot || 0));
    } else if (cur.length > 1) {
      var mh = multiHandleAt(bboxOf(cur), pt.sx, pt.sy);
      if (mh) return setCursor(resizeCursor(mh, 0));
    }
    if (topLayerAt(p.x, p.y, 3 / view.zoom)) return setCursor('move');
    setCursor('select');
  }
  function resizeCursor(k, rot) {
    var base = { n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315 }[k] || 0;
    var a = ((base + rot) % 360 + 360) % 360;
    if (a < 22.5 || a >= 337.5 || (a >= 157.5 && a < 202.5)) return 'ns';
    if ((a >= 22.5 && a < 67.5) || (a >= 202.5 && a < 247.5)) return 'nesw';
    if ((a >= 67.5 && a < 112.5) || (a >= 247.5 && a < 292.5)) return 'ew';
    return 'nwse';
  }
  function setCursor(c) { els.scene.setAttribute('data-cur', c || 'select'); }

  function updateStatusPos(p) {
    if (els.statusPos) els.statusPos.textContent = Math.round(p.x) + ' , ' + Math.round(p.y);
  }

  /* ===================================================================
     18. REDIMENSIONNEMENT ET ROTATION
     ---------------------------------------------------------------
     Le calcul se fait dans le repère tourné du calque : le point opposé
     à la poignée reste fixe, exactement comme dans un outil de dessin
     classique. Sans cela, redimensionner un objet tourné le fait
     « glisser », ce qui est le bug le plus visible d'un éditeur amateur.
     =================================================================== */

  function handleSigns(k) {
    return {
      sx: /e$/.test(k) ? 1 : (/w$/.test(k) ? -1 : 0),
      sy: /^n/.test(k) ? -1 : (/^s/.test(k) ? 1 : 0)
    };
  }

  function startResize(l, k, pt, e) {
    beginChange();
    var s = handleSigns(k);
    var ax = s.sx > 0 ? 0 : (s.sx < 0 ? 1 : 0.5);
    var ay = s.sy > 0 ? 0 : (s.sy < 0 ? 1 : 0.5);
    var l0 = { x: l.x, y: l.y, w: l.w, h: l.h, rot: l.rot || 0 };
    var anchor = toDoc(l, l.w * ax, l.h * ay);
    drag = {
      kind: 'resize', id: l.id, k: k, s: s, ax: ax, ay: ay,
      l0: l0, anchor: anchor,
      ts0: l.type === 'text' ? clone(l.ts) : null,
      runs0: l.type === 'text' ? clone(l.runs) : null,
      children0: l.type === 'group' ? clone(l.children) : null,
      centerAnchor: toDoc(l, l.w / 2, l.h / 2)
    };
    setCursor(resizeCursor(k, l0.rot));
  }

  function doResize(pt, e) {
    var l = findLayer(doc.layers, drag.id);
    if (!l) return;
    var l0 = drag.l0, s = drag.s;
    var p = s2d(pt.sx, pt.sy);
    var fromCenter = e.altKey;
    var anchor = fromCenter ? drag.centerAnchor : drag.anchor;

    /* vecteur ancre -> pointeur, ramené dans le repère non tourné */
    var vx = p.x - anchor.x, vy = p.y - anchor.y;
    if (l0.rot) {
      var a = -deg2rad(l0.rot), cs = Math.cos(a), sn = Math.sin(a);
      var nx = vx * cs - vy * sn, ny = vx * sn + vy * cs;
      vx = nx; vy = ny;
    }

    var nw = l0.w, nh = l0.h;
    if (s.sx) nw = Math.max(2, (fromCenter ? 2 : 1) * vx * s.sx);
    if (s.sy) nh = Math.max(2, (fromCenter ? 2 : 1) * vy * s.sy);

    var isText = l.type === 'text';
    var corner = s.sx && s.sy;

    /* proportions conservées : Maj partout, et d'office sur les images
       et les coins de texte (agrandir une photo en la déformant est
       presque toujours une erreur) */
    var keepRatio = e.shiftKey || (corner && (l.type === 'image' || l.type === 'frame')) || (corner && isText);
    if (keepRatio && s.sx && s.sy) {
      var r = l0.w / Math.max(1, l0.h);
      if (Math.abs(nw / r) > Math.abs(nh)) nh = nw / r; else nw = nh * r;
    }

    if (isText) {
      if (corner) {
        var k = nw / Math.max(1, l0.w);
        l.ts = clone(drag.ts0);
        l.runs = clone(drag.runs0);
        l.ts.size = Math.max(2, drag.ts0.size * k);
        if (drag.ts0.strokeW) l.ts.strokeW = drag.ts0.strokeW * k;
        scaleRunSizes(l, k);
        l.w = nw;
      } else if (s.sx) {
        l.wrap = true;
        l.w = nw;
      } else {
        l.autoH = false;
        l.h = nh;
      }
      var lay = layoutText(l, false);
      if (l.autoH !== false) l.h = Math.max(1, lay.h);
      nh = l.h; nw = l.w;
    } else if (l.type === 'group') {
      l.children = clone(drag.children0);
      var sx = nw / Math.max(1, l0.w), sy = nh / Math.max(1, l0.h);
      for (var i = 0; i < l.children.length; i++) scaleLayer(l.children[i], sx, sy, l0.x, l0.y);
      l.w = nw; l.h = nh;
    } else {
      l.w = nw; l.h = nh;
    }

    /* replacement : l'ancre ne bouge pas */
    var ax = fromCenter ? 0.5 : drag.ax, ay = fromCenter ? 0.5 : drag.ay;
    var offx = nw * (0.5 - ax), offy = nh * (0.5 - ay);
    if (l0.rot) {
      var a2 = deg2rad(l0.rot), cs2 = Math.cos(a2), sn2 = Math.sin(a2);
      var ox = offx * cs2 - offy * sn2, oy = offx * sn2 + offy * cs2;
      offx = ox; offy = oy;
    }
    var cx = anchor.x + offx, cy = anchor.y + offy;
    var newX = cx - nw / 2, newY = cy - nh / 2;

    if (l.type === 'group') {
      var d1 = newX - l.x, d2 = newY - l.y;
      for (var j = 0; j < l.children.length; j++) shiftLayer(l.children[j], d1, d2);
      reflowGroup(l);
    } else {
      l.x = newX; l.y = newY;
    }

    /* magnétisme sur la poignée déplacée */
    if (flags.snap && !l0.rot) {
      var box = bboxOf([l]);
      var sn3 = snapBox(box, [l.id]);
      var tolX = drag.s.sx, tolY = drag.s.sy;
      if (sn3.dx && tolX) {
        if (tolX > 0) l.w = Math.max(2, l.w + sn3.dx); else { l.x += sn3.dx; l.w = Math.max(2, l.w - sn3.dx); }
      }
      if (sn3.dy && tolY) {
        if (tolY > 0) l.h = Math.max(2, l.h + sn3.dy); else { l.y += sn3.dy; l.h = Math.max(2, l.h - sn3.dy); }
      }
    } else guides = [];

    requestDraw();
  }

  function startMultiResize(list, box, k, pt) {
    beginChange();
    drag = {
      kind: 'multiresize', k: k, box: box,
      snap0: list.map(function (l) { return { id: l.id, l: clone(l) }; })
    };
    setCursor(resizeCursor(k, 0));
  }
  function doMultiResize(pt, e) {
    var p = s2d(pt.sx, pt.sy), b = drag.box, s = handleSigns(drag.k);
    var ax = s.sx > 0 ? b.x : b.x + b.w;
    var ay = s.sy > 0 ? b.y : b.y + b.h;
    var nw = Math.max(4, Math.abs(p.x - ax)), nh = Math.max(4, Math.abs(p.y - ay));
    var r = b.w / Math.max(1, b.h);
    if (!e.altKey) { if (nw / r > nh) nh = nw / r; else nw = nh * r; }   /* proportions par défaut */
    var sx = nw / Math.max(1, b.w), sy = nh / Math.max(1, b.h);
    for (var i = 0; i < drag.snap0.length; i++) {
      var loc = locate(doc.layers, drag.snap0[i].id);
      if (!loc) continue;
      var fresh = clone(drag.snap0[i].l);
      scaleLayer(fresh, sx, sy, ax, ay);
      loc.arr[loc.idx] = fresh;
    }
    requestDraw();
  }

  function startRotate(l, pt) {
    beginChange();
    var c = layerCenter(l), sc = d2s(c.x, c.y);
    drag = {
      kind: 'rotate', id: l.id, cx: c.x, cy: c.y,
      a0: Math.atan2(pt.sy - sc.y, pt.sx - sc.x) * 180 / Math.PI,
      rot0: l.rot || 0
    };
    setCursor('rotate');
  }

  /* ===================================================================
     19. OUTILS DE CRÉATION
     =================================================================== */

  function drawCreatePreview() { requestDraw(); }

  function createBox(dg) {
    return {
      x: Math.min(dg.x0, dg.x1), y: Math.min(dg.y0, dg.y1),
      w: Math.abs(dg.x1 - dg.x0), h: Math.abs(dg.y1 - dg.y0)
    };
  }

  function finishCreate(dg) {
    var b = createBox(dg), l = null;
    if (dg.tool === 'line') {
      /* Une ligne est une boîte tournée : longueur = largeur, angle =
         rotation. La rotation se faisant autour du centre, on centre la
         boîte sur le milieu du geste — sinon le trait ne part pas du
         point cliqué. */
      var len = Math.max(2, Math.hypot(dg.x1 - dg.x0, dg.y1 - dg.y0));
      var ang = Math.atan2(dg.y1 - dg.y0, dg.x1 - dg.x0) * 180 / Math.PI;
      var th = Math.max(2, Math.round(doc.w * 0.005));
      var mid = { x: (dg.x0 + dg.x1) / 2, y: (dg.y0 + dg.y1) / 2 };
      l = makeShape(doc, 'line', { x: mid.x - len / 2, y: mid.y - th / 2, w: len, h: th });
      l.stroke = { color: color(doc.palette.accent, 1), w: th, dash: 0 };
      l.fill = { type: 'none' };
      l.rot = ang;
    } else if (dg.tool === 'rect' || dg.tool === 'ellipse') {
      l = makeShape(doc, dg.tool === 'rect' ? 'rect' : 'ellipse', { x: b.x, y: b.y, w: b.w, h: b.h });
    } else if (dg.tool === 'frame') {
      l = makeFrame(doc, { x: b.x, y: b.y, w: b.w, h: b.h });
    } else if (dg.tool === 'text') {
      l = makeText(doc, 'titre', 'Votre texte', { x: b.x, y: b.y, w: Math.max(40, b.w), wrap: true });
      syncTextBox(l);
    }
    if (!l) return;
    doc.layers.push(l);
    sel = [l.id];
    if (dg.tool === 'text') enterTextEdit(l, 0, textLen(l));
    setTool('select');
  }

  function finishCreateClick(dg) {
    var l = null, W = doc.w;
    if (dg.tool === 'text') {
      l = makeText(doc, 'titre', 'Votre texte', { x: dg.x0, y: dg.y0, wrap: false });
      syncTextBox(l);
    } else if (dg.tool === 'rect') {
      l = makeShape(doc, 'rect', { x: dg.x0 - W * .15, y: dg.y0 - W * .09, w: W * .3, h: W * .18 });
    } else if (dg.tool === 'ellipse') {
      l = makeShape(doc, 'ellipse', { x: dg.x0 - W * .12, y: dg.y0 - W * .12, w: W * .24, h: W * .24 });
    } else if (dg.tool === 'frame') {
      l = makeFrame(doc, { x: dg.x0 - W * .2, y: dg.y0 - W * .2, w: W * .4, h: W * .4 });
    } else if (dg.tool === 'line') {
      var th = Math.max(2, Math.round(W * 0.005));
      l = makeShape(doc, 'line', { x: dg.x0 - W * .18, y: dg.y0 - th / 2, w: W * .36, h: th });
      l.stroke = { color: color(doc.palette.accent, 1), w: th, dash: 0 };
      l.fill = { type: 'none' };
    }
    if (!l) return;
    doc.layers.push(l);
    sel = [l.id];
    if (dg.tool === 'text') enterTextEdit(l, 0, textLen(l));
    setTool('select');
  }

  /* ===================================================================
     20. PLUME
     =================================================================== */

  function snapPen(p, e) {
    if (!e || !e.shiftKey || !pathDraft || !pathDraft.nodes.length) return p;
    var last = pathDraft.nodes[pathDraft.nodes.length - 1];
    var dx = p.x - last.x, dy = p.y - last.y;
    var a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    var len = Math.hypot(dx, dy);
    return { x: last.x + Math.cos(a) * len, y: last.y + Math.sin(a) * len };
  }

  function penDown(p, e) {
    p = snapPen(p, e);
    if (!pathDraft) {
      pathDraft = { nodes: [], closed: false, cursor: null };
      beginChange();
    }
    var n = pathDraft.nodes;
    if (n.length > 2) {
      var s0 = d2s(n[0].x, n[0].y), sp = d2s(p.x, p.y);
      if (Math.hypot(s0.x - sp.x, s0.y - sp.y) <= 9) { commitPath(true); return; }
    }
    var node = { x: p.x, y: p.y, h1x: p.x, h1y: p.y, h2x: p.x, h2y: p.y };
    n.push(node);
    drag = { kind: 'penhandle', ni: n.length - 1, x0: p.x, y0: p.y };
    requestDraw();
  }

  function penHandleMove(p) {
    var n = pathDraft.nodes[drag.ni];
    n.h2x = p.x; n.h2y = p.y;
    n.h1x = n.x - (p.x - n.x);      /* poignée miroir : nœud lisse */
    n.h1y = n.y - (p.y - n.y);
    requestDraw();
  }

  function commitPath(closed) {
    if (!pathDraft || pathDraft.nodes.length < 2) { pathDraft = null; hist.pre = null; requestDraw(); return; }
    var n = pathDraft.nodes;
    var xs = [], ys = [], i;
    for (i = 0; i < n.length; i++) {
      xs.push(n[i].x, n[i].h1x, n[i].h2x);
      ys.push(n[i].y, n[i].h1y, n[i].h2y);
    }
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
    var nodes = n.map(function (k) {
      return {
        x: (k.x - x0) / w, y: (k.y - y0) / h,
        h1x: (k.h1x - x0) / w, h1y: (k.h1y - y0) / h,
        h2x: (k.h2x - x0) / w, h2y: (k.h2y - y0) / h
      };
    });
    var l = makePath(doc, nodes, { closed: !!closed, x: x0, y: y0, w: w, h: h });
    if (closed) l.fill = { type: 'solid', color: color(doc.palette.accent, 1), from: color(doc.palette.accent, 1), to: color(doc.palette.bg, 1), angle: 90 };
    doc.layers.push(l);
    sel = [l.id];
    pathDraft = null;
    endChange();
    setTool('select');
    refreshAll();
    toast('Tracé créé — outil A pour en modifier les points');
  }

  /* ===================================================================
     21. POINTS DE TRACÉ (sélection directe)
     =================================================================== */

  function nodeDown(l, pt, p, e) {
    var n = l.nodes || [], i;
    for (i = 0; i < n.length; i++) {
      var hs = ['h1', 'h2'];
      for (var k = 0; k < 2; k++) {
        var hx = n[i][hs[k] + 'x'], hy = n[i][hs[k] + 'y'];
        if (hx == null) continue;
        var q = nodeScreen(l, hx, hy);
        if (Math.hypot(q.x - pt.sx, q.y - pt.sy) <= 7) {
          beginChange();
          drag = { kind: 'node', id: l.id, ni: i, handle: hs[k] };
          return true;
        }
      }
    }
    for (i = 0; i < n.length; i++) {
      var s = nodeScreen(l, n[i].x, n[i].y);
      if (Math.hypot(s.x - pt.sx, s.y - pt.sy) <= 7) {
        if (e.altKey) {
          if (n.length <= 2) { toast('Un tracé garde au moins deux points'); return true; }
          change(function () { n.splice(i, 1); normalizePathBox(l); });
          return true;
        }
        beginChange();
        drag = { kind: 'node', id: l.id, ni: i, handle: null };
        return true;
      }
    }
    /* clic sur le tracé : on insère un point */
    if (hitLayer(l, p.x, p.y, 6 / view.zoom)) {
      var t = nearestOnPath(l, p);
      if (t) {
        change(function () { insertNodeAt(l, t.seg, t.t); });
        return true;
      }
    }
    return false;
  }

  function doNodeDrag(pt, p, e) {
    var l = findLayer(doc.layers, drag.id);
    if (!l) return;
    var loc = toLocal(l, p.x, p.y);
    var nx = loc.x / Math.max(1, l.w), ny = loc.y / Math.max(1, l.h);
    var n = l.nodes[drag.ni];
    if (drag.handle) {
      n[drag.handle + 'x'] = nx;
      n[drag.handle + 'y'] = ny;
      if (!e.altKey) {                       /* poignée opposée en miroir */
        var other = drag.handle === 'h1' ? 'h2' : 'h1';
        n[other + 'x'] = n.x - (nx - n.x);
        n[other + 'y'] = n.y - (ny - n.y);
      }
    } else {
      var dx = nx - n.x, dy = ny - n.y;
      n.x = nx; n.y = ny;
      n.h1x += dx; n.h1y += dy;
      n.h2x += dx; n.h2y += dy;
    }
    requestDraw();
  }

  /* Les nœuds étant normalisés, supprimer ou déplacer un point peut
     laisser la boîte trop grande : on la resserre sur le contenu. */
  function normalizePathBox(l) {
    var n = l.nodes, xs = [], ys = [], i;
    for (i = 0; i < n.length; i++) { xs.push(n[i].x, n[i].h1x, n[i].h2x); ys.push(n[i].y, n[i].h1y, n[i].h2y); }
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var sw = Math.max(1e-4, x1 - x0), sh = Math.max(1e-4, y1 - y0);
    for (i = 0; i < n.length; i++) {
      n[i].x = (n[i].x - x0) / sw; n[i].y = (n[i].y - y0) / sh;
      n[i].h1x = (n[i].h1x - x0) / sw; n[i].h1y = (n[i].h1y - y0) / sh;
      n[i].h2x = (n[i].h2x - x0) / sw; n[i].h2y = (n[i].h2y - y0) / sh;
    }
    var nx0 = l.x + x0 * l.w, ny0 = l.y + y0 * l.h;
    l.w = l.w * sw; l.h = l.h * sh; l.x = nx0; l.y = ny0;
  }

  function bez(p0, p1, p2, p3, t) {
    var mt = 1 - t;
    return {
      x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
      y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y
    };
  }
  function nearestOnPath(l, p) {
    var n = l.nodes, best = null, loc = toLocal(l, p.x, p.y);
    var q = { x: loc.x / Math.max(1, l.w), y: loc.y / Math.max(1, l.h) };
    var segs = n.length - 1 + (l.closed ? 1 : 0);
    for (var s = 0; s < segs; s++) {
      var a = n[s], b = n[(s + 1) % n.length];
      for (var i = 0; i <= 16; i++) {
        var t = i / 16;
        var pt = bez({ x: a.x, y: a.y }, { x: a.h2x, y: a.h2y }, { x: b.h1x, y: b.h1y }, { x: b.x, y: b.y }, t);
        var d = Math.hypot(pt.x - q.x, pt.y - q.y);
        if (!best || d < best.d) best = { d: d, seg: s, t: t };
      }
    }
    return best && best.d < 0.06 ? best : null;
  }
  function insertNodeAt(l, seg, t) {
    var n = l.nodes, a = n[seg], b = n[(seg + 1) % n.length];
    var p = bez({ x: a.x, y: a.y }, { x: a.h2x, y: a.h2y }, { x: b.h1x, y: b.h1y }, { x: b.x, y: b.y }, t);
    var d = 0.06;
    var before = bez({ x: a.x, y: a.y }, { x: a.h2x, y: a.h2y }, { x: b.h1x, y: b.h1y }, { x: b.x, y: b.y }, Math.max(0, t - d));
    var after = bez({ x: a.x, y: a.y }, { x: a.h2x, y: a.h2y }, { x: b.h1x, y: b.h1y }, { x: b.x, y: b.y }, Math.min(1, t + d));
    n.splice(seg + 1, 0, {
      x: p.x, y: p.y,
      h1x: p.x + (before.x - p.x) * 1.6, h1y: p.y + (before.y - p.y) * 1.6,
      h2x: p.x + (after.x - p.x) * 1.6, h2y: p.y + (after.y - p.y) * 1.6
    });
  }

  /* ===================================================================
     22. ÉDITION DE TEXTE
     ---------------------------------------------------------------
     Le clavier est capté par un <textarea> invisible : c'est ce qui
     rend la saisie compatible avec les claviers accentués, les
     correcteurs et le copier-coller. Le curseur et la sélection, eux,
     sont dessinés sur la surcouche.
     =================================================================== */

  function enterTextEdit(l, a, b) {
    if (!l || l.type !== 'text' || l.locked) return;
    edit = { id: l.id, a: a == null ? 0 : a, b: b == null ? (a == null ? textLen(l) : a) : b };
    sel = [l.id];
    beginChange();
    els.ime.value = '';
    els.ime.style.left = '0px';
    els.ime.style.top = '0px';
    setTimeout(function () { try { els.ime.focus({ preventScroll: true }); } catch (e) { els.ime.focus(); } }, 0);
    restartCaret();
    renderProps();
    renderLayers();
    requestDraw();
  }

  function exitTextEdit(silent) {
    if (!edit) return;
    var l = findLayer(doc.layers, edit.id);
    if (l) {
      if (!plainText(l).length) {
        var loc = locate(doc.layers, l.id);
        if (loc) { loc.arr.splice(loc.idx, 1); sel = []; }
      } else {
        syncTextBox(l);
        if (l.name === 'Texte' || !l.name) l.name = defaultName(l);
      }
    }
    edit = null;
    stopCaret();
    if (!silent) endChange();
    else hist.pre = null;
    try { els.ime.blur(); } catch (e) {}
    refreshAll();
  }

  function restartCaret() {
    caretOn = true;
    stopCaret();
    caretTimer = setInterval(function () { caretOn = !caretOn; requestDraw(); }, 530);
  }
  function stopCaret() { if (caretTimer) { clearInterval(caretTimer); caretTimer = null; } }

  function editLayer() { return edit ? findLayer(doc.layers, edit.id) : null; }
  function selRange() {
    if (!edit) return null;
    return { a: Math.min(edit.a, edit.b), b: Math.max(edit.a, edit.b) };
  }

  function insertText(str) {
    var l = editLayer();
    if (!l) return;
    beginChange();
    var r = selRange();
    var pos = spliceText(l, r.a, r.b, str);
    edit.a = edit.b = pos;
    syncTextBox(l);
    restartCaret();
    renderProps(); renderLayers(); requestDraw();
  }

  function deleteRange(dir) {
    var l = editLayer();
    if (!l) return;
    beginChange();
    var r = selRange();
    if (r.a !== r.b) { spliceText(l, r.a, r.b, ''); edit.a = edit.b = r.a; }
    else if (dir < 0 && r.a > 0) { spliceText(l, r.a - 1, r.a, ''); edit.a = edit.b = r.a - 1; }
    else if (dir > 0 && r.a < textLen(l)) { spliceText(l, r.a, r.a + 1, ''); edit.a = edit.b = r.a; }
    syncTextBox(l);
    restartCaret();
    renderProps(); renderLayers(); requestDraw();
  }

  function wordRange(l, i) {
    var t = plainText(l), a = i, b = i;
    var isW = function (c) { return c && /[^\s]/.test(c); };
    while (a > 0 && isW(t[a - 1])) a--;
    while (b < t.length && isW(t[b])) b++;
    return [a, b];
  }

  /* Déplacement du curseur, ligne à ligne compris. */
  function moveCaret(dx, dy, extend) {
    var l = editLayer();
    if (!l) return;
    var total = textLen(l);
    if (dy) {
      var lay = layoutText(l, true), oy = 0;
      if (l.ts.valign === 'middle') oy = (l.h - lay.h) / 2;
      else if (l.ts.valign === 'bottom') oy = l.h - lay.h;
      var cur = caretPos(l, lay, oy, edit.b);
      var targetY = (cur.y0 + cur.y1) / 2 + dy * Math.max(4, cur.y1 - cur.y0);
      var idx = indexAtPoint(l, cur.x, targetY);
      edit.b = idx;
    } else {
      edit.b = clamp(edit.b + dx, 0, total);
    }
    if (!extend) edit.a = edit.b;
    restartCaret();
    renderProps();
    requestDraw();
  }
  function caretHome(end, extend) {
    var l = editLayer();
    if (!l) return;
    var lay = layoutText(l, true), oy = 0;
    if (l.ts.valign === 'middle') oy = (l.h - lay.h) / 2;
    else if (l.ts.valign === 'bottom') oy = l.h - lay.h;
    var cur = caretPos(l, lay, oy, edit.b);
    edit.b = indexAtPoint(l, end ? 1e6 : -1e6, (cur.y0 + cur.y1) / 2);
    if (!extend) edit.a = edit.b;
    restartCaret(); requestDraw();
  }

  /* ===================================================================
     23. PIPETTE
     =================================================================== */

  function pickColor(sx, sy) {
    var ctx = els.canvas.getContext('2d', { willReadFrequently: true });
    var hex;
    try {
      var d = ctx.getImageData(Math.round(sx * dpr), Math.round(sy * dpr), 1, 1).data;
      hex = rgbToHex(d[0], d[1], d[2]);
    } catch (e) {
      toast('Pipette bloquée : une image distante empêche la lecture du canevas', true);
      return;
    }
    applyPickedColor(hex);
  }

  function applyPickedColor(hex) {
    var l = selOne();
    if (edit && l && l.type === 'text') {
      var r = selRange();
      if (r.a !== r.b) {
        change(function () { applyRunStyle(l, r.a, r.b, { color: color(hex, 1) }); });
        toast('Couleur ' + hex + ' appliquée à la sélection');
        setTool('select');
        return;
      }
    }
    if (!l) {
      change(function () { doc.palette.accent = hex; });
      toast('Couleur d accent : ' + hex);
      setTool('select');
      return;
    }
    change(function () {
      if (l.type === 'text') l.ts.color = color(hex, l.ts.color ? l.ts.color.a : 1);
      else if (l.type === 'shape' || l.type === 'path') {
        if (l.fill && l.fill.type === 'solid') l.fill.color = color(hex, l.fill.color ? l.fill.color.a : 1);
        else if (l.stroke) l.stroke.color = color(hex, 1);
      } else if (l.stroke) l.stroke.color = color(hex, 1);
    });
    toast('Couleur ' + hex + ' appliquée');
    setTool('select');
  }

  /* ===================================================================
     24. OUTILS DE FORMULAIRE
     ---------------------------------------------------------------
     Les champs sont déclaratifs : chacun porte le chemin de la
     propriété qu'il pilote (data-p="ts.size"). Un seul jeu de gestion-
     naires les branche tous. C'est ce qui évite les boutons morts : un
     champ affiché est un champ branché, il n'y a pas de troisième cas.
     =================================================================== */

  function $(sel, ctx) { return (ctx || root).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || root).querySelectorAll(sel)); }

  function getPath(o, p) {
    var ps = p.split('.');
    for (var i = 0; i < ps.length; i++) { if (o == null) return undefined; o = o[ps[i]]; }
    return o;
  }
  function setPath(o, p, v) {
    var ps = p.split('.');
    for (var i = 0; i < ps.length - 1; i++) { if (o[ps[i]] == null) o[ps[i]] = {}; o = o[ps[i]]; }
    o[ps[ps.length - 1]] = v;
  }

  function targetsFor(scope) {
    if (scope === 'doc') return [doc];
    if (scope === 'flags') return [flags];
    return selectedLayers();
  }

  /* Effets de bord après écriture d'une propriété. */
  function afterSet(o, path) {
    if (o && o.type === 'text') {
      if (/^ts\./.test(path) || path === 'wrap') syncTextBox(o);
      if (path === 'ts.size' || path === 'ts.font') delete o._lay;
    }
    if (o && o.type === 'group') reflowGroup(o);
  }

  /* Trois chemins ne sont pas de simples écritures : changer de format
     remet la composition à l'échelle, changer de rôle typographique
     réécrit six propriétés d'un coup, et les réglages d'affichage
     doivent rafraîchir leur bouton dans la barre d'état. */
  function applyProp(path, value, scope) {
    if (scope === 'doc' && path === 'format') { scaleDocToFormat(value); return; }
    if (scope === 'flags') {
      flags[path] = value;
      var m = { grid: els.tglGrid, snap: els.tglSnap, safe: els.tglSafe };
      if (m[path]) m[path].classList.toggle('is-on', !!value);
      requestDraw();
      return;
    }
    if (path === 'role') { applyRole(value); return; }
    if (path === 'bind') { applyBind(value); return; }
    var objs = targetsFor(scope);
    for (var i = 0; i < objs.length; i++) { setPath(objs[i], path, value); afterSet(objs[i], path); }
  }

  function applyRole(id) {
    var l = selOne();
    if (!l || l.type !== 'text' || !id) return;
    var r = roleById(id);
    var patch = {
      role: r.id, font: r.font, weight: r.weight,
      size: Math.round(r.size * doc.w), tracking: r.tracking, lh: r.lh,
      transform: r.upper ? 'upper' : 'none', hollow: !!r.hollow,
      strokeW: r.hollow ? Math.max(1, Math.round(doc.w * 0.0022)) : 0
    };
    for (var k in patch) applyTextProp(k, patch[k]);
  }

  function applyBind(id) {
    var l = selOne();
    if (!l || l.type !== 'text') return;
    if (!id) { l.bind = null; l.bindBroken = false; return; }
    l.bind = id;
    l.bindBroken = false;
    var v = resolveBinding(id);
    if (v !== '' && v != null) setPlainText(l, String(v));
    l.name = bindLabel(id);
    syncTextBox(l);
  }

  /* Applique un style de texte : à la sélection de lettres si elle
     existe, sinon à tout le calque (en nettoyant les surcharges pour
     que « tout le calque » veuille bien dire tout le calque). */
  function applyTextProp(key, value) {
    var l = selOne();
    if (!l || l.type !== 'text') return;
    var r = edit ? selRange() : null;
    if (r && r.a !== r.b) {
      var patch = {}; patch[key] = value;
      applyRunStyle(l, r.a, r.b, patch);
    } else {
      l.ts[key] = value;
      for (var i = 0; i < l.runs.length; i++) if (l.runs[i].s) delete l.runs[i].s[key];
      l.runs = normalizeRuns(l.runs);
    }
    delete l._lay;
    syncTextBox(l);
  }

  /* Style affiché dans le panneau : celui du curseur si on édite. */
  function activeTextStyle(l) {
    if (edit && edit.id === l.id) {
      var r = selRange();
      return styleOfChar(l, r.a === r.b ? Math.max(0, r.a - 1) : r.a);
    }
    return l.ts;
  }

  var wiring = false;
  function wireFields(ctx) {
    if (wiring) return;
    wiring = true;

    /* --- champs numériques --- */
    $$('[data-p][type=number], [data-p].bs-in-num', ctx).forEach(function (el) {
      var path = el.getAttribute('data-p'), scope = el.getAttribute('data-scope') || 'layer';
      var live = el.getAttribute('data-live') !== 'no';
      el.addEventListener('focus', beginChange);
      el.addEventListener('input', function () {
        if (!live) return;
        beginChange();
        applyProp(path, num(el.value, 0) * (parseFloat(el.getAttribute('data-mul')) || 1), scope);
        requestDraw(); renderLayers();
      });
      el.addEventListener('change', function () {
        beginChange();
        applyProp(path, num(el.value, 0) * (parseFloat(el.getAttribute('data-mul')) || 1), scope);
        endChange(); refreshAll();
      });
      /* glisser horizontalement sur le libellé du champ modifie la valeur */
      var box = el.closest('.bs-step');
      if (box) {
        var unit = box.querySelector('.bs-step-u');
        if (unit) {
          unit.classList.add('bs-step-drag');
          unit.addEventListener('pointerdown', function (ev) {
            ev.preventDefault();
            var x0 = ev.clientX, v0 = num(el.value, 0), step = parseFloat(el.step) || 1;
            beginChange();
            unit.setPointerCapture(ev.pointerId);
            function mv(e2) {
              var v = v0 + Math.round((e2.clientX - x0) / 3) * step;
              el.value = fmtNum(v, 2);
              applyProp(path, num(el.value, 0) * (parseFloat(el.getAttribute('data-mul')) || 1), scope);
              requestDraw();
            }
            function up(e2) {
              unit.removeEventListener('pointermove', mv);
              unit.removeEventListener('pointerup', up);
              endChange(); refreshAll();
            }
            unit.addEventListener('pointermove', mv);
            unit.addEventListener('pointerup', up);
          });
        }
      }
    });

    /* --- curseurs --- */
    $$('[data-p][type=range]', ctx).forEach(function (el) {
      var path = el.getAttribute('data-p'), scope = el.getAttribute('data-scope') || 'layer';
      var mul = parseFloat(el.getAttribute('data-mul')) || 1;
      el.addEventListener('pointerdown', beginChange);
      el.addEventListener('input', function () {
        beginChange();
        applyProp(path, num(el.value, 0) * mul, scope);
        var out = el.parentNode.querySelector('.bs-step input');
        if (out) out.value = fmtNum(num(el.value, 0), 2);
        requestDraw();
      });
      el.addEventListener('change', function () { endChange(); refreshAll(); });
    });

    /* --- listes déroulantes --- */
    $$('select[data-p]', ctx).forEach(function (el) {
      var path = el.getAttribute('data-p'), scope = el.getAttribute('data-scope') || 'layer';
      var kind = el.getAttribute('data-kind');
      el.addEventListener('change', function () {
        var v = el.value;
        if (kind === 'num') v = num(v, 0);
        change(function () {
          if (el.getAttribute('data-text') === 'yes') applyTextProp(path.replace(/^ts\./, ''), v);
          else applyProp(path, v, scope);
        });
      });
    });

    /* --- interrupteurs --- */
    $$('[data-tgl]', ctx).forEach(function (el) {
      var path = el.getAttribute('data-tgl'), scope = el.getAttribute('data-scope') || 'layer';
      el.addEventListener('click', function () {
        var on = !el.classList.contains('is-on');
        change(function () {
          if (el.getAttribute('data-text') === 'yes') applyTextProp(path.replace(/^ts\./, ''), on);
          else applyProp(path, on, scope);
        });
      });
    });

    /* --- segments --- */
    $$('[data-seg] button', ctx).forEach(function (el) {
      el.addEventListener('click', function () {
        var wrap = el.closest('[data-seg]');
        var path = wrap.getAttribute('data-seg'), scope = wrap.getAttribute('data-scope') || 'layer';
        var v = el.getAttribute('data-v');
        if (wrap.getAttribute('data-kind') === 'num') v = num(v, 0);
        change(function () {
          if (wrap.getAttribute('data-text') === 'yes') applyTextProp(path.replace(/^ts\./, ''), v);
          else applyProp(path, v, scope);
        });
      });
    });

    /* --- couleurs --- */
    $$('[data-col]', ctx).forEach(function (wrap) {
      var path = wrap.getAttribute('data-col'), scope = wrap.getAttribute('data-scope') || 'layer';
      var isText = wrap.getAttribute('data-text') === 'yes';
      var sw = wrap.querySelector('.bs-sw');
      var hexIn = wrap.querySelector('input[type=text]');
      var alphaIn = wrap.querySelector('.bs-color-alpha input');
      var picker = wrap.querySelector('input[type=color]');

      function push(hex, a, live) {
        var v = color(hex, a);
        if (!live) beginChange();
        if (isText) applyTextProp(path.replace(/^ts\./, ''), v);
        else applyProp(path, v, scope);
        sw.querySelector('i').style.background = css(v);
        requestDraw();
      }
      if (sw && picker) {
        sw.addEventListener('click', function () { picker.click(); });
        picker.addEventListener('input', function () {
          beginChange();
          push(picker.value, alphaIn ? num(alphaIn.value, 100) / 100 : 1, true);
        });
        picker.addEventListener('change', function () { endChange(); refreshAll(); });
      }
      if (hexIn) hexIn.addEventListener('change', function () {
        var v = hexIn.value.trim();
        if (!/^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v)) { renderProps(); return; }
        if (v.charAt(0) !== '#') v = '#' + v;
        change(function () { push(v, alphaIn ? num(alphaIn.value, 100) / 100 : 1, true); });
      });
      if (alphaIn) {
        alphaIn.addEventListener('input', function () {
          beginChange();
          push(hexIn ? (hexIn.value.charAt(0) === '#' ? hexIn.value : '#' + hexIn.value) : '#ffffff', clamp(num(alphaIn.value, 100), 0, 100) / 100, true);
        });
        alphaIn.addEventListener('change', function () { endChange(); refreshAll(); });
      }
    });

    /* --- nuanciers de la palette --- */
    $$('[data-swatch]', ctx).forEach(function (el) {
      el.addEventListener('click', function () {
        var wrap = el.closest('[data-sw-target]');
        var path = wrap.getAttribute('data-sw-target');
        var scope = wrap.getAttribute('data-scope') || 'layer';
        var isText = wrap.getAttribute('data-text') === 'yes';
        var hex = el.getAttribute('data-swatch');
        change(function () {
          var v = color(hex, 1);
          if (isText) applyTextProp(path.replace(/^ts\./, ''), v);
          else applyProp(path, v, scope);
        });
      });
    });

    /* --- actions nommées ---
       Un champ de saisie porteur d'un data-act réagit à la frappe, pas
       au clic : sans cette distinction, les champs de recherche des
       panneaux ne filtraient rien. */
    $$('[data-act]', ctx).forEach(function (el) {
      var fire = function (ev) { runAction(el.getAttribute('data-act'), el, ev); };
      var tag = el.tagName;
      if (tag === 'INPUT') el.addEventListener('input', fire);
      else if (tag === 'TEXTAREA') el.addEventListener('change', fire);
      else el.addEventListener('click', fire);
    });

    wiring = false;
  }

  /* ===================================================================
     25. FRAGMENTS DE FORMULAIRE
     =================================================================== */

  function fStep(label, path, value, opts) {
    opts = opts || {};
    return '<div class="bs-f"><label>' + esc(label) + '</label>' +
      '<div class="bs-step"><input type="number" class="bs-in-num" data-p="' + path + '"' +
      (opts.scope ? ' data-scope="' + opts.scope + '"' : '') +
      (opts.mul ? ' data-mul="' + opts.mul + '"' : '') +
      ' step="' + (opts.step || 1) + '"' +
      (opts.min != null ? ' min="' + opts.min + '"' : '') +
      (opts.max != null ? ' max="' + opts.max + '"' : '') +
      ' value="' + esc(fmtNum(value, opts.dec == null ? 2 : opts.dec)) + '">' +
      '<span class="bs-step-u">' + esc(opts.unit || '') + '</span></div></div>';
  }

  function fRange(label, path, value, min, max, step, opts) {
    opts = opts || {};
    return '<div class="bs-f"><label>' + esc(label) + '</label><div class="bs-range-row">' +
      '<input type="range" class="bs-range" data-p="' + path + '"' +
      (opts.scope ? ' data-scope="' + opts.scope + '"' : '') +
      (opts.mul ? ' data-mul="' + opts.mul + '"' : '') +
      ' min="' + min + '" max="' + max + '" step="' + step + '" value="' + esc(fmtNum(value, 3)) + '">' +
      '<div class="bs-step"><input type="number" class="bs-in-num" data-p="' + path + '"' +
      (opts.scope ? ' data-scope="' + opts.scope + '"' : '') +
      (opts.mul ? ' data-mul="' + opts.mul + '"' : '') +
      ' step="' + step + '" value="' + esc(fmtNum(value, 3)) + '">' +
      '<span class="bs-step-u">' + esc(opts.unit || '') + '</span></div></div></div>';
  }

  function fSelect(label, path, value, list, opts) {
    opts = opts || {};
    var o = '';
    for (var i = 0; i < list.length; i++) {
      o += '<option value="' + esc(list[i].id) + '"' + (String(list[i].id) === String(value) ? ' selected' : '') + '>' + esc(list[i].label) + '</option>';
    }
    return '<div class="bs-f"><label>' + esc(label) + '</label>' +
      '<select class="bs-sel" data-p="' + path + '"' +
      (opts.scope ? ' data-scope="' + opts.scope + '"' : '') +
      (opts.text ? ' data-text="yes"' : '') +
      (opts.kind ? ' data-kind="' + opts.kind + '"' : '') + '>' + o + '</select></div>';
  }

  function fSeg(label, path, value, list, opts) {
    opts = opts || {};
    var b = '';
    for (var i = 0; i < list.length; i++) {
      b += '<button type="button" data-v="' + esc(list[i].id) + '"' +
        (String(list[i].id) === String(value) ? ' class="is-on"' : '') +
        (list[i].title ? ' title="' + esc(list[i].title) + '"' : '') + '>' + (list[i].html || esc(list[i].label)) + '</button>';
    }
    return '<div class="bs-f"><label>' + esc(label) + '</label>' +
      '<div class="bs-seg" data-seg="' + path + '"' +
      (opts.scope ? ' data-scope="' + opts.scope + '"' : '') +
      (opts.text ? ' data-text="yes"' : '') +
      (opts.kind ? ' data-kind="' + opts.kind + '"' : '') + '>' + b + '</div></div>';
  }

  function fToggle(label, path, on, opts) {
    opts = opts || {};
    return '<div class="bs-f"><div class="bs-tgl-row"><span>' + esc(label) + '</span>' +
      '<button type="button" class="bs-tgl' + (on ? ' is-on' : '') + '" data-tgl="' + path + '"' +
      (opts.scope ? ' data-scope="' + opts.scope + '"' : '') +
      (opts.text ? ' data-text="yes"' : '') + '><i></i></button></div></div>';
  }

  function fColor(label, path, col, opts) {
    opts = opts || {};
    col = col || color('#ffffff', 1);
    var pal = doc ? doc.palette : { bg: '#000', accent: '#7DFF4F', fg: '#fff', fg2: '#999' };
    var sw = '';
    if (opts.swatches !== false) {
      var list = [pal.accent, pal.fg, pal.fg2, pal.bg, '#FFFFFF', '#000000'];
      sw = '<div class="bs-swatches" style="margin-top:6px">';
      for (var i = 0; i < list.length; i++) {
        sw += '<button type="button" data-swatch="' + list[i] + '" style="background:' + list[i] + '" title="' + list[i] + '"></button>';
      }
      sw += '</div>';
    }
    return '<div class="bs-f" data-col="' + path + '" data-sw-target="' + path + '"' +
      (opts.scope ? ' data-scope="' + opts.scope + '"' : '') +
      (opts.text ? ' data-text="yes"' : '') + '>' +
      '<label>' + esc(label) + '</label>' +
      '<div class="bs-color">' +
      '<button type="button" class="bs-sw"><i style="background:' + css(col) + '"></i></button>' +
      '<input type="color" class="bs-hidden-color" value="' + esc(col.hex || '#ffffff') + '">' +
      '<input type="text" value="' + esc((col.hex || '#ffffff').toUpperCase()) + '" spellcheck="false">' +
      '<div class="bs-step bs-color-alpha"><input type="number" class="bs-in-num" min="0" max="100" step="1" value="' + Math.round((col.a == null ? 1 : col.a) * 100) + '"><span class="bs-step-u">%</span></div>' +
      '</div>' + sw + '</div>';
  }

  function fGroup(title, body, action) {
    return '<div class="bs-pgroup"><div class="bs-pgroup-t"><span>' + esc(title) + '</span>' + (action || '') + '</div>' + body + '</div>';
  }

  var ICONS = {
    text: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 5h16M12 5v14M8.5 19h7"/></svg>',
    image: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m4 17 5-5.5 3.5 3.5L16 11l4 5.5"/></svg>',
    shape: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/></svg>',
    path: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 21c0-8 5-13 13-13"/><path d="m14.5 5.5 4-2.5 2.5 4-2.5 4-4-5.5Z"/></svg>',
    group: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 8V4h4M17 4h4v4M21 16v4h-4M7 20H3v-4"/></svg>',
    doc: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    lock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>',
    unlock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 7.7-1.5"/></svg>',
    eye: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/></svg>',
    eyeOff: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l16 16"/><path d="M9.5 6.1A9.6 9.6 0 0 1 12 5.8c6 0 9.5 6.2 9.5 6.2a17 17 0 0 1-3.2 3.9M6.4 8.1A17 17 0 0 0 2.5 12S6 18.2 12 18.2a9.4 9.4 0 0 0 3.3-.6"/></svg>',
    dyn: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/></svg>',
    caret: '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>'
  };

  var ALIGN_ICONS = {
    left: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 6h16M4 12h9M4 18h13"/></svg>',
    center: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 6h16M7.5 12h9M5.5 18h13"/></svg>',
    right: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 6h16M11 12h9M7 18h13"/></svg>'
  };

  /* ===================================================================
     26. PANNEAU DE PROPRIÉTÉS
     =================================================================== */

  function renderProps() {
    if (!els.props || !doc) return;
    var ls = selectedLayers();
    var html;
    if (!ls.length) html = propsDoc();
    else if (ls.length > 1) html = propsMulti(ls);
    else html = propsLayer(ls[0]);
    els.props.innerHTML = html;
    wireFields(els.props);
    updateStatusDims();
    /* la barre flottante suit la sélection sans attendre le prochain
       rendu : sélectionner et la voir apparaître doivent être le même
       instant */
    renderFloat();
  }

  function updateStatusDims() {
    if (!els.statusDims) return;
    var l = selOne();
    els.statusDims.textContent = l
      ? Math.round(l.w) + ' × ' + Math.round(l.h) + ' px'
      : doc.w + ' × ' + doc.h + ' px';
  }

  function head(icon, title, sub) {
    return '<div class="bs-phead"><div class="bs-phead-ico">' + icon + '</div>' +
      '<div class="bs-phead-txt"><b>' + esc(title) + '</b><small>' + esc(sub || '') + '</small></div></div>';
  }

  /* ---------- rien de sélectionné : le document ---------- */
  function propsDoc() {
    var f = formatById(doc.format);
    var h = head(ICONS.doc, 'Affiche', f.label);

    h += fGroup('Format', fSelect('Dimensions', 'format', doc.format, FORMATS.map(function (x) {
      return { id: x.id, label: x.label };
    }), { scope: 'doc' }) +
      '<div class="bs-frow">' +
      fStep('Largeur', 'w', doc.w, { scope: 'doc', unit: 'px', dec: 0 }) +
      fStep('Hauteur', 'h', doc.h, { scope: 'doc', unit: 'px', dec: 0 }) +
      '</div>' +
      fRange('Marges de sécurité', 'safe', doc.safe * 100, 0, 15, 0.5, { scope: 'doc', unit: '%', mul: 0.01 }));

    var bgKind = doc.bg.type;
    h += fGroup('Fond',
      fSeg('Type', 'bg.type', bgKind, [
        { id: 'solid', label: 'Uni' }, { id: 'linear', label: 'Dégradé' },
        { id: 'radial', label: 'Radial' }, { id: 'none', label: 'Aucun' }
      ], { scope: 'doc' }) +
      (bgKind === 'solid' ? fColor('Couleur', 'bg.color', doc.bg.color, { scope: 'doc' }) : '') +
      (bgKind === 'linear' || bgKind === 'radial'
        ? fColor('Début', 'bg.from', doc.bg.from, { scope: 'doc' }) +
          fColor('Fin', 'bg.to', doc.bg.to, { scope: 'doc' }) +
          (bgKind === 'linear' ? fStep('Angle', 'bg.angle', doc.bg.angle, { scope: 'doc', unit: '°', dec: 0 }) : '')
        : ''));

    var sw = '';
    for (var i = 0; i < PALETTES.length; i++) {
      var p = PALETTES[i];
      sw += '<button type="button" class="bs-item" data-act="palette" data-id="' + p.id + '" style="gap:7px">' +
        '<span style="display:flex;gap:3px;flex:none">' +
        '<i style="width:14px;height:22px;border-radius:3px;background:' + p.bg + ';border:1px solid rgba(255,255,255,.15)"></i>' +
        '<i style="width:14px;height:22px;border-radius:3px;background:' + p.accent + '"></i>' +
        '<i style="width:14px;height:22px;border-radius:3px;background:' + p.fg + '"></i>' +
        '</span><span class="bs-item-txt"><b>' + esc(p.label) + '</b></span></button>';
    }
    h += fGroup('Ambiance', '<div style="display:flex;flex-direction:column;gap:5px">' + sw + '</div>');

    h += fGroup('Repères',
      fToggle('Grille', 'grid', flags.grid, { scope: 'flags' }) +
      fToggle('Magnétisme', 'snap', flags.snap, { scope: 'flags' }) +
      fToggle('Marges et repères', 'safe', flags.safe, { scope: 'flags' }) +
      '<div class="bs-note" style="margin:9px 0 0">Tirez depuis les règles, en haut et à gauche, pour poser un repère. Ramenez-le sur la règle pour l enlever.</div>' +
      '<button type="button" class="bs-btn bs-btn-ghost bs-btn-sm bs-btn-block" style="margin-top:8px" data-act="clearRules">Effacer les repères' +
      ((doc.rules && doc.rules.length) ? ' (' + doc.rules.length + ')' : '') + '</button>');

    h += '<div class="bs-pgroup"><div class="bs-empty" style="padding:6px 0">' +
      'Sélectionnez un calque pour le modifier, ou double-cliquez sur l affiche.</div></div>';
    return h;
  }

  function propsMulti(ls) {
    var b = bboxOf(ls);
    var h = head(ICONS.group, ls.length + ' calques', Math.round(b.w) + ' × ' + Math.round(b.h) + ' px');
    h += fGroup('Alignement', alignButtons());
    h += fGroup('Actions',
      '<div style="display:flex;flex-direction:column;gap:5px">' +
      '<button type="button" class="bs-btn bs-btn-ghost bs-btn-sm bs-btn-block" data-act="group">Grouper les calques</button>' +
      '<button type="button" class="bs-btn bs-btn-ghost bs-btn-sm bs-btn-block" data-act="dup">Dupliquer</button>' +
      '<button type="button" class="bs-btn bs-btn-ghost bs-btn-sm bs-btn-block" data-act="del">Supprimer</button>' +
      '</div>');
    return h;
  }

  function alignButtons() {
    var mk = function (act, title, svg) {
      return '<button type="button" data-act="align" data-align="' + act + '" title="' + esc(title) + '" ' +
        'style="flex:1;height:26px;display:flex;align-items:center;justify-content:center;border-radius:5px;color:var(--bs-fg-2)">' + svg + '</button>';
    };
    var S = 'stroke="currentColor" stroke-width="1.8" stroke-linecap="round"';
    return '<div style="display:flex;gap:3px;margin-bottom:7px">' +
      mk('left', 'Aligner à gauche', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" ' + S + '><path d="M4 3v18M8 8h9M8 16h5"/></svg>') +
      mk('hcenter', 'Centrer horizontalement', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" ' + S + '><path d="M12 3v18M7 8h10M9 16h6"/></svg>') +
      mk('right', 'Aligner à droite', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" ' + S + '><path d="M20 3v18M7 8h9M12 16h4"/></svg>') +
      '</div><div style="display:flex;gap:3px">' +
      mk('top', 'Aligner en haut', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" ' + S + '><path d="M3 4h18M8 8v9M16 8v5"/></svg>') +
      mk('vcenter', 'Centrer verticalement', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" ' + S + '><path d="M3 12h18M8 7v10M16 9v6"/></svg>') +
      mk('bottom', 'Aligner en bas', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" ' + S + '><path d="M3 20h18M8 7v9M16 11v5"/></svg>') +
      mk('dh', 'Répartir horizontalement', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" ' + S + '><path d="M4 3v18M20 3v18M12 7v10"/></svg>') +
      mk('dv', 'Répartir verticalement', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" ' + S + '><path d="M3 4h18M3 20h18M7 12h10"/></svg>') +
      '</div>';
  }

  /* ---------- calque unique ---------- */
  function propsLayer(l) {
    var sub = Math.round(l.w) + ' × ' + Math.round(l.h) + ' px';
    var icon = ICONS[l.type] || ICONS.shape;
    var h = head(icon, l.name || defaultName(l), sub);

    /* place & transformation, commun à tout */
    h += fGroup('Position et taille',
      '<div class="bs-frow">' + fStep('X', 'x', l.x, { unit: 'px', dec: 0 }) + fStep('Y', 'y', l.y, { unit: 'px', dec: 0 }) + '</div>' +
      '<div class="bs-frow">' + fStep('L', 'w', l.w, { unit: 'px', dec: 0, min: 1 }) + fStep('H', 'h', l.h, { unit: 'px', dec: 0, min: 1 }) + '</div>' +
      '<div class="bs-frow">' + fStep('Rotation', 'rot', l.rot || 0, { unit: '°', dec: 1 }) +
      '<div class="bs-f"><label>Miroir</label><div style="display:flex;gap:4px">' +
      '<button type="button" class="bs-btn bs-btn-ghost bs-btn-sm" style="flex:1;justify-content:center" data-act="flipH" title="Miroir horizontal">↔</button>' +
      '<button type="button" class="bs-btn bs-btn-ghost bs-btn-sm" style="flex:1;justify-content:center" data-act="flipV" title="Miroir vertical">↕</button>' +
      '</div></div></div>' +
      alignButtons(),
      '<button type="button" data-act="center" title="Centrer dans l affiche">Centrer</button>');

    if (l.type === 'text') h += propsText(l);
    else if (l.type === 'image' || l.type === 'frame') h += propsImage(l);
    else if (l.type === 'icon') h += propsIcon(l);
    else if (l.type === 'shape') h += propsShape(l);
    else if (l.type === 'path') h += propsPath(l);
    else if (l.type === 'group') h += propsGroup(l);

    /* apparence, commun */
    h += fGroup('Apparence',
      fRange('Opacité', 'opacity', (l.opacity == null ? 1 : l.opacity) * 100, 0, 100, 1, { unit: '%', mul: 0.01 }) +
      fSelect('Fusion', 'blend', l.blend || 'source-over', BLENDS) +
      fRange('Flou du calque', 'blur', l.blur || 0, 0, 60, 0.5, { unit: 'px' }) +
      fToggle('Masquer par le calque du dessous', 'clip', !!l.clip) +
      (l.clip
        ? '<div class="bs-bind" style="margin:-2px 0 9px">' + ICONS.dyn +
          '<span>Ce calque est découpé par la silhouette de celui juste en dessous.</span></div>'
        : '') +
      fToggle('Ombre portée', 'shadow.on', !!(l.shadow && l.shadow.on)) +
      (l.shadow && l.shadow.on
        ? '<div class="bs-frow">' + fStep('Décalage X', 'shadow.x', l.shadow.x || 0, { unit: 'px', dec: 0 }) +
          fStep('Décalage Y', 'shadow.y', l.shadow.y || 0, { unit: 'px', dec: 0 }) + '</div>' +
          fStep('Flou', 'shadow.blur', l.shadow.blur || 0, { unit: 'px', dec: 0, min: 0 }) +
          fColor('Couleur de l ombre', 'shadow.color', l.shadow.color || color('#000000', .5))
        : ''));

    h += fGroup('Calque',
      '<div class="bs-frow">' +
      '<button type="button" class="bs-btn bs-btn-ghost bs-btn-sm" style="justify-content:center" data-act="toggleVis">' + (l.visible ? 'Masquer' : 'Afficher') + '</button>' +
      '<button type="button" class="bs-btn bs-btn-ghost bs-btn-sm" style="justify-content:center" data-act="toggleLock">' + (l.locked ? 'Déverrouiller' : 'Verrouiller') + '</button>' +
      '</div>' +
      '<div class="bs-frow">' +
      '<button type="button" class="bs-btn bs-btn-ghost bs-btn-sm" style="justify-content:center" data-act="dup">Dupliquer</button>' +
      '<button type="button" class="bs-btn bs-btn-ghost bs-btn-sm" style="justify-content:center" data-act="del">Supprimer</button>' +
      '</div>');
    return h;
  }

  /* ---------- texte ---------- */
  function propsText(l) {
    var st = activeTextStyle(l);
    var r = edit ? selRange() : null;
    var hasSel = !!(r && r.a !== r.b);
    var f = null;
    for (var i = 0; i < FONTS.length; i++) if (FONTS[i].id === st.font) f = FONTS[i];
    f = f || FONTS[1];

    var scopeNote = hasSel
      ? '<div class="bs-bind" style="margin-bottom:10px"><b>' + (r.b - r.a) + ' caractère' + (r.b - r.a > 1 ? 's' : '') + '</b>' +
        ' sélectionné' + (r.b - r.a > 1 ? 's' : '') + ' — les réglages ci-dessous ne touchent que cette partie.' +
        '<button type="button" data-act="selAll" title="Tout sélectionner">tout</button></div>'
      : (edit
        ? '<div class="bs-note" style="margin:0 0 10px">Sélectionnez des lettres avec la souris pour ne colorer qu elles.</div>'
        : '<div class="bs-note" style="margin:0 0 10px">Double-cliquez le texte sur l affiche pour l éditer lettre par lettre.</div>');

    var roles = ROLES.map(function (x) { return { id: x.id, label: x.label }; });
    var weights = f.weights.map(function (w) { return { id: w, label: weightLabel(w) }; });

    var h = fGroup('Texte',
      scopeNote +
      (!edit ? '<div class="bs-f"><label>Contenu</label><textarea class="bs-in" data-act="setText" rows="3">' + esc(plainText(l)) + '</textarea></div>' : '') +
      fSelect('Rôle typographique', 'role', st.role || '', roles.concat([{ id: '', label: '— personnalisé —' }])) +
      fSelect('Police', 'ts.font', st.font, FONTS.map(function (x) { return { id: x.id, label: x.label }; }), { text: true }) +
      '<div class="bs-frow">' +
      fSelect('Graisse', 'ts.weight', st.weight, weights, { text: true, kind: 'num' }) +
      fStep('Taille', 'ts.size', st.size, { unit: 'px', dec: 0, min: 1, step: 1 }) +
      '</div>' +
      '<div class="bs-frow">' +
      fStep('Interlettrage', 'ts.tracking', st.tracking, { unit: 'em', dec: 3, step: 0.005 }) +
      fStep('Interligne', 'ts.lh', st.lh, { dec: 2, step: 0.02, min: 0.4 }) +
      '</div>' +
      fSeg('Casse', 'ts.transform', st.transform, [
        { id: 'none', label: 'Aa' }, { id: 'upper', label: 'AA' },
        { id: 'lower', label: 'aa' }, { id: 'title', label: 'Aa Bb' }
      ], { text: true }) +
      fSeg('Alignement', 'ts.align', st.align, [
        { id: 'left', label: '', html: ALIGN_ICONS.left, title: 'À gauche' },
        { id: 'center', label: '', html: ALIGN_ICONS.center, title: 'Centré' },
        { id: 'right', label: '', html: ALIGN_ICONS.right, title: 'À droite' }
      ]) +
      fSeg('Vertical', 'ts.valign', st.valign, [
        { id: 'top', label: 'Haut' }, { id: 'middle', label: 'Milieu' }, { id: 'bottom', label: 'Bas' }
      ]) +
      fToggle('Retour à la ligne', 'wrap', l.wrap !== false)
    );

    h += fGroup(hasSel ? 'Couleur de la sélection' : 'Couleur',
      fColor('Remplissage', 'ts.color', st.color, { text: true }) +
      fToggle('Texte en contour', 'ts.hollow', !!st.hollow, { text: true }) +
      (st.hollow || st.strokeW
        ? fStep('Épaisseur du trait', 'ts.strokeW', st.strokeW || 1, { unit: 'px', dec: 1, min: 0, step: .5 }) +
          (!st.hollow ? fColor('Couleur du trait', 'ts.strokeColor', st.strokeColor || color('#000000', 1), { text: true }) : '')
        : '') +
      fToggle('Souligné', 'ts.underline', !!st.underline, { text: true }));

    /* liaison de données — l'objet dynamique côté texte */
    var bnd = l.bind
      ? '<div class="bs-bind' + (l.bindBroken ? ' is-broken' : '') + '">' +
        ICONS.dyn + '<span>' + (l.bindBroken ? 'Liaison rompue — ' : 'Lié à ') + '<b>' + esc(bindLabel(l.bind)) + '</b></span>' +
        '<button type="button" data-act="unbind" title="Détacher">✕</button></div>' +
        '<button type="button" class="bs-btn bs-btn-ghost bs-btn-sm bs-btn-block" style="margin-top:8px" data-act="refreshBind">Recharger la valeur</button>'
      : fSelect('Lier à une donnée', 'bind', '', [{ id: '', label: '— aucun —' }].concat(BINDINGS.map(function (b) {
          return { id: b.id, label: b.label };
        })));
    h += fGroup('Objet dynamique', bnd);
    return h;
  }
  function weightLabel(w) {
    return ({ 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' })[w] || String(w);
  }

  /* ---------- image / cadre ---------- */
  function propsImage(l) {
    var e = l.src ? getImage(l.src) : null;
    var h = fGroup('Contenu',
      (l.src
        ? '<div class="bs-item" style="margin-bottom:9px;cursor:default">' +
          '<span class="bs-lyr-ico" style="width:34px;height:34px"><img src="' + esc(l.src) + '" alt=""></span>' +
          '<span class="bs-item-txt"><b>' + esc(fileName(l.src)) + '</b><small>' + (e && e.ok ? e.img.naturalWidth + ' × ' + e.img.naturalHeight : 'chargement…') + '</small></span>' +
          '</div>'
        : '<div class="bs-note" style="margin:0 0 9px"><b>Emplacement vide.</b> Choisissez une image : le cadre garde sa forme, sa position et ses effets.</div>') +
      '<div class="bs-frow">' +
      '<button type="button" class="bs-btn bs-btn-ghost bs-btn-sm" style="justify-content:center" data-act="pickImage">' + (l.src ? 'Remplacer' : 'Choisir') + '</button>' +
      '<button type="button" class="bs-btn bs-btn-ghost bs-btn-sm" style="justify-content:center" data-act="uploadImage">Téléverser</button>' +
      '</div>' +
      (l.src ? '<div class="bs-frow" style="margin-top:8px">' +
        '<button type="button" class="bs-btn bs-btn-ghost bs-btn-sm" style="justify-content:center" data-act="cropImage">Recadrer</button>' +
        '<button type="button" class="bs-btn bs-btn-ghost bs-btn-sm" style="justify-content:center" data-act="clearImage">Vider</button>' +
        '</div>' : ''));

    h += fGroup('Objet dynamique',
      fSelect('Emplacement', 'slot', l.slot || 'libre', SLOTS) +
      (l.slot && l.slot !== 'libre'
        ? '<div class="bs-bind" style="margin-top:8px">' + ICONS.dyn +
          '<span>Se remplit tout seul depuis <b>' + esc(slotLabel(l.slot)) + '</b></span></div>' +
          '<button type="button" class="bs-btn bs-btn-ghost bs-btn-sm bs-btn-block" style="margin-top:8px" data-act="refreshSlot">Recharger l image</button>'
        : ''));

    h += fGroup('Cadrage',
      fSeg('Ajustement', 'fit', l.fit || 'cover', [
        { id: 'cover', label: 'Remplir' }, { id: 'contain', label: 'Contenir' }, { id: 'fill', label: 'Étirer' }
      ]) +
      fRange('Zoom', 'zoom', l.zoom || 1, 0.2, 4, 0.01, { unit: '×' }) +
      '<div class="bs-frow">' +
      fRange('Décalage H', 'ox', l.ox == null ? .5 : l.ox, 0, 1, 0.005) +
      fRange('Décalage V', 'oy', l.oy == null ? .5 : l.oy, 0, 1, 0.005) +
      '</div>');

    h += fGroup('Forme',
      fSelect('Masque', 'mask', l.mask || 'rect', MASKS) +
      (l.mask === 'rect' || !l.mask ? fStep('Coins arrondis', 'radius', l.radius || 0, { unit: 'px', dec: 0, min: 0 }) : '') +
      fStep('Contour', 'stroke.w', (l.stroke && l.stroke.w) || 0, { unit: 'px', dec: 0, min: 0 }) +
      ((l.stroke && l.stroke.w) ? fColor('Couleur du contour', 'stroke.color', l.stroke.color) : ''));

    var fx = l.fx || {};
    h += fGroup('Retouche',
      fRange('Luminosité', 'fx.bright', fx.bright || 0, -80, 80, 1, { unit: '%' }) +
      fRange('Contraste', 'fx.contrast', fx.contrast || 0, -80, 120, 1, { unit: '%' }) +
      fRange('Saturation', 'fx.sat', fx.sat || 0, -100, 120, 1, { unit: '%' }) +
      fRange('Noir et blanc', 'fx.gray', fx.gray || 0, 0, 100, 1, { unit: '%' }) +
      fRange('Flou', 'fx.blur', fx.blur || 0, 0, 40, 0.5, { unit: 'px' }) +
      fRange('Voile sombre', 'fx.veil', (fx.veil || 0) * 100, 0, 90, 1, { unit: '%', mul: 0.01 }) +
      fRange('Teinte', 'fx.tintAmt', (fx.tintAmt || 0) * 100, 0, 100, 1, { unit: '%', mul: 0.01 }) +
      ((fx.tintAmt || 0) > 0 ? fColor('Couleur de teinte', 'fx.tint', fx.tint || color(doc.palette.accent, 1)) : ''));
    return h;
  }
  function fileName(u) {
    var s = String(u).split('?')[0].split('/').pop();
    try { s = decodeURIComponent(s); } catch (e) {}
    return s.length > 30 ? s.slice(0, 27) + '…' : s;
  }

  /* ---------- icône ---------- */
  function propsIcon(l) {
    var grid = '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:5px">';
    ICONS_LIB.forEach(function (ic) {
      grid += '<button type="button" data-act="swapIcon" data-icon="' + esc(ic.id) + '" title="' + esc(ic.label) + '"' +
        ' style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:6px;border:1px solid ' +
        (ic.d === l.d ? 'var(--bs-accent)' : 'var(--bs-line)') + ';background:var(--bs-input)">' +
        '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="' + (ic.d === l.d ? '#7DFF4F' : 'currentColor') +
        '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="' + esc(ic.d) + '"/></svg></button>';
    });
    grid += '</div>';

    return fGroup('Icône', grid) +
      fGroup('Trait',
        fStep('Épaisseur', 'stroke.w', (l.stroke && l.stroke.w) || 0, { unit: 'px', dec: 1, min: 0, step: .5 }) +
        fColor('Couleur du trait', 'stroke.color', l.stroke.color)) +
      fGroup('Remplissage',
        fSeg('Type', 'fill.type', l.fill.type, [
          { id: 'none', label: 'Aucun' }, { id: 'solid', label: 'Uni' }, { id: 'linear', label: 'Dégradé' }
        ]) +
        (l.fill.type === 'solid' ? fColor('Couleur', 'fill.color', l.fill.color) : '') +
        (l.fill.type === 'linear' ? fColor('Début', 'fill.from', l.fill.from) + fColor('Fin', 'fill.to', l.fill.to) : ''));
  }

  /* ---------- forme ---------- */
  function propsShape(l) {
    var h = fGroup('Forme',
      fSelect('Type', 'shape', l.shape, SHAPE_KINDS) +
      (l.shape === 'rect' ? fStep('Coins arrondis', 'radius', l.radius || 0, { unit: 'px', dec: 0, min: 0 }) : '') +
      (l.shape === 'polygon' ? fStep('Côtés', 'sides', l.sides || 6, { dec: 0, min: 3, max: 24 }) : '') +
      (l.shape === 'star'
        ? fStep('Branches', 'points', l.points || 5, { dec: 0, min: 3, max: 20 }) +
          fRange('Creux', 'inner', l.inner || .46, 0.1, 0.9, 0.01)
        : ''));

    if (l.shape !== 'line') {
      h += fGroup('Remplissage',
        fSeg('Type', 'fill.type', l.fill.type, [
          { id: 'solid', label: 'Uni' }, { id: 'linear', label: 'Dégradé' },
          { id: 'radial', label: 'Radial' }, { id: 'none', label: 'Aucun' }
        ]) +
        (l.fill.type === 'solid' ? fColor('Couleur', 'fill.color', l.fill.color) : '') +
        (l.fill.type === 'linear' || l.fill.type === 'radial'
          ? fColor('Début', 'fill.from', l.fill.from) + fColor('Fin', 'fill.to', l.fill.to) +
            (l.fill.type === 'linear' ? fStep('Angle', 'fill.angle', l.fill.angle || 90, { unit: '°', dec: 0 }) : '')
          : ''));
    }

    h += fGroup(l.shape === 'line' ? 'Trait' : 'Contour',
      fStep('Épaisseur', 'stroke.w', (l.stroke && l.stroke.w) || 0, { unit: 'px', dec: 1, min: 0, step: .5 }) +
      ((l.stroke && l.stroke.w) ? fColor('Couleur', 'stroke.color', l.stroke.color) +
        fStep('Pointillés', 'stroke.dash', l.stroke.dash || 0, { unit: 'px', dec: 0, min: 0 }) : ''));
    return h;
  }

  /* ---------- tracé ---------- */
  function propsPath(l) {
    var h = fGroup('Tracé',
      '<div class="bs-note" style="margin:0 0 9px">' + (l.nodes || []).length + ' points. ' +
      'Outil <b>A</b> pour les déplacer, Alt+clic pour en retirer un, clic sur le trait pour en ajouter.</div>' +
      '<button type="button" class="bs-btn bs-btn-ghost bs-btn-sm bs-btn-block" data-act="nodeTool">Modifier les points</button>' +
      '<div style="height:8px"></div>' +
      fToggle('Tracé fermé', 'closed', !!l.closed));

    h += fGroup('Remplissage',
      fSeg('Type', 'fill.type', l.fill.type, [
        { id: 'none', label: 'Aucun' }, { id: 'solid', label: 'Uni' }, { id: 'linear', label: 'Dégradé' }
      ]) +
      (l.fill.type === 'solid' ? fColor('Couleur', 'fill.color', l.fill.color) : '') +
      (l.fill.type === 'linear' ? fColor('Début', 'fill.from', l.fill.from) + fColor('Fin', 'fill.to', l.fill.to) +
        fStep('Angle', 'fill.angle', l.fill.angle || 90, { unit: '°', dec: 0 }) : ''));

    h += fGroup('Trait',
      fStep('Épaisseur', 'stroke.w', (l.stroke && l.stroke.w) || 0, { unit: 'px', dec: 1, min: 0, step: .5 }) +
      fColor('Couleur', 'stroke.color', l.stroke.color) +
      fStep('Pointillés', 'stroke.dash', l.stroke.dash || 0, { unit: 'px', dec: 0, min: 0 }) +
      fSeg('Extrémités', 'cap', l.cap || 'round', [
        { id: 'butt', label: 'Nette' }, { id: 'round', label: 'Ronde' }, { id: 'square', label: 'Carrée' }
      ]));
    return h;
  }

  /* ---------- groupe ---------- */
  function propsGroup(l) {
    return fGroup('Groupe',
      '<div class="bs-note" style="margin:0 0 9px">' + l.children.length + ' calques. ' +
      'Double-cliquez sur l affiche pour entrer dans le groupe et sélectionner un élément.</div>' +
      '<button type="button" class="bs-btn bs-btn-ghost bs-btn-sm bs-btn-block" data-act="group">Dissoudre le groupe</button>');
  }

  /* ===================================================================
     27. PILE DES CALQUES
     =================================================================== */

  var collapsed = {};

  function renderLayers() {
    if (!els.layerList || !doc) return;
    var html = '';
    /* du haut de la pile vers le bas, comme dans tout éditeur */
    html = rowsFor(doc.layers, 0);
    els.layerList.innerHTML = html || '<div class="bs-empty" style="padding:18px 12px">Aucun calque.<br>Utilisez la barre d outils pour en ajouter.</div>';
    wireLayerRows();
    if (els.lyrGroup) {
      var one = selOne();
      els.lyrGroup.title = (one && one.type === 'group') ? 'Dissoudre le groupe (Ctrl+Maj+G)' : 'Grouper (Ctrl+G)';
    }
  }

  function rowsFor(arr, depth) {
    var html = '';
    for (var i = arr.length - 1; i >= 0; i--) {
      var l = arr[i];
      html += layerRow(l, depth);
      if (l.type === 'group' && !collapsed[l.id]) html += rowsFor(l.children || [], depth + 1);
    }
    return html;
  }

  function layerRow(l, depth) {
    var isSel = sel.indexOf(l.id) >= 0;
    var dyn = (l.bind || (l.slot && l.slot !== 'libre'));
    var thumb = '';
    if ((l.type === 'image' || l.type === 'frame') && l.src) thumb = '<img src="' + esc(l.src) + '" alt="">';
    else if (l.type === 'shape') thumb = '<span style="width:11px;height:11px;border-radius:' + (l.shape === 'ellipse' ? '50%' : '2px') + ';background:' + esc(css((l.fill && l.fill.color) || color('#888', 1))) + '"></span>';
    else if (l.type === 'text') thumb = ICONS.text;
    else if (l.type === 'path') thumb = ICONS.path;
    else if (l.type === 'group') thumb = ICONS.group;
    else thumb = ICONS.image;

    return '<div class="bs-lyr' + (isSel ? ' is-sel' : '') + (l.visible ? '' : ' is-hidden') + (l.clip ? ' is-clipped' : '') + '"' +
      ' data-id="' + l.id + '" draggable="true" role="treeitem" tabindex="0"' +
      ' title="' + esc(l.clip ? 'Écrêté par le calque du dessous' : (l.name || defaultName(l))) + '"' +
      ' style="margin-left:' + (depth * 12 + (l.clip ? 10 : 0)) + 'px">' +
      (l.clip ? '<span class="bs-lyr-clip" aria-hidden="true">⌐</span>' : '') +
      (l.type === 'group'
        ? '<span class="bs-lyr-tw' + (collapsed[l.id] ? '' : ' is-open') + '" data-tw="' + l.id + '">' + ICONS.caret + '</span>'
        : '<span class="bs-lyr-tw"></span>') +
      '<span class="bs-lyr-ico">' + thumb + '</span>' +
      '<span class="bs-lyr-name" data-name="' + l.id + '">' + esc(l.name || defaultName(l)) + '</span>' +
      (dyn ? '<span class="bs-lyr-dyn" title="Objet dynamique">' + ICONS.dyn + '</span>' : '') +
      '<button type="button" class="bs-lyr-btn' + (l.locked ? ' is-on' : '') + '" data-lock="' + l.id + '" title="' + (l.locked ? 'Déverrouiller' : 'Verrouiller') + '">' + (l.locked ? ICONS.lock : ICONS.unlock) + '</button>' +
      '<button type="button" class="bs-lyr-btn' + (l.visible ? '' : ' is-on') + '" data-vis="' + l.id + '" title="' + (l.visible ? 'Masquer' : 'Afficher') + '">' + (l.visible ? ICONS.eye : ICONS.eyeOff) + '</button>' +
      '</div>';
  }

  function wireLayerRows() {
    var rows = $$('.bs-lyr', els.layerList);
    rows.forEach(function (row) {
      var id = row.getAttribute('data-id');

      row.addEventListener('click', function (e) {
        if (e.target.closest('[data-vis]') || e.target.closest('[data-lock]') || e.target.closest('[data-tw]')) return;
        select([id], e.shiftKey || e.metaKey || e.ctrlKey);
      });
      row.addEventListener('dblclick', function (e) {
        if (e.target.closest('[data-vis]') || e.target.closest('[data-lock]')) return;
        startRename(row, id);
      });
      row.addEventListener('keydown', function (e) {
        if (e.key === 'F2' || e.key === 'Enter') { e.preventDefault(); startRename(row, id); }
      });

      var tw = row.querySelector('[data-tw]');
      if (tw) tw.addEventListener('click', function (e) {
        e.stopPropagation();
        collapsed[id] = !collapsed[id];
        renderLayers();
      });

      var vb = row.querySelector('[data-vis]');
      if (vb) vb.addEventListener('click', function (e) {
        e.stopPropagation();
        change(function () { var l = findLayer(doc.layers, id); if (l) l.visible = !l.visible; });
      });
      var lb = row.querySelector('[data-lock]');
      if (lb) lb.addEventListener('click', function (e) {
        e.stopPropagation();
        change(function () {
          var l = findLayer(doc.layers, id);
          if (!l) return;
          l.locked = !l.locked;
          if (l.locked) { var k = sel.indexOf(id); if (k >= 0) sel.splice(k, 1); }
        });
      });

      /* glisser-déposer pour réordonner */
      row.addEventListener('dragstart', function (e) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
        row.classList.add('is-drag');
      });
      row.addEventListener('dragend', function () {
        row.classList.remove('is-drag');
        rows.forEach(function (r) { r.classList.remove('is-over-top', 'is-over-bot', 'is-over-in'); });
      });
      row.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        var r = row.getBoundingClientRect(), rel = (e.clientY - r.top) / r.height;
        var l = findLayer(doc.layers, id);
        row.classList.remove('is-over-top', 'is-over-bot', 'is-over-in');
        if (l && l.type === 'group' && rel > 0.3 && rel < 0.7) row.classList.add('is-over-in');
        else row.classList.add(rel < 0.5 ? 'is-over-top' : 'is-over-bot');
      });
      row.addEventListener('dragleave', function () {
        row.classList.remove('is-over-top', 'is-over-bot', 'is-over-in');
      });
      row.addEventListener('drop', function (e) {
        e.preventDefault();
        var src = e.dataTransfer.getData('text/plain');
        var mode = row.classList.contains('is-over-in') ? 'in' : (row.classList.contains('is-over-top') ? 'above' : 'below');
        row.classList.remove('is-over-top', 'is-over-bot', 'is-over-in');
        dropLayer(src, id, mode);
      });
    });
  }

  function startRename(row, id) {
    var span = row.querySelector('[data-name]');
    if (!span) return;
    var l = findLayer(doc.layers, id);
    if (!l) return;
    var cur = l.name || defaultName(l);
    span.innerHTML = '<input type="text" value="' + esc(cur) + '" spellcheck="false">';
    var inp = span.querySelector('input');
    inp.focus(); inp.select();
    var done = false;
    function finish(save) {
      if (done) return;
      done = true;
      var v = inp.value.trim();
      if (save && v && v !== cur) change(function () { l.name = v.slice(0, 60); });
      else renderLayers();
    }
    inp.addEventListener('blur', function () { finish(true); });
    inp.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
  }

  /* Déplace un calque dans la pile — au-dessus, en dessous, ou dans un
     groupe. C'est le même chemin que les boutons ▲▼, donc le même
     résultat : la pile change vraiment, et l'affiche avec. */
  function dropLayer(srcId, dstId, mode) {
    if (srcId === dstId) return;
    change(function () {
      var s = locate(doc.layers, srcId), d = locate(doc.layers, dstId);
      if (!s || !d) return;
      /* interdit de déposer un groupe dans lui-même */
      if (s.layer.type === 'group' && findLayer([s.layer], dstId)) { toast('Impossible : un groupe ne peut pas se contenir'); return; }
      var moved = s.arr.splice(s.idx, 1)[0];
      d = locate(doc.layers, dstId);
      if (!d) { doc.layers.push(moved); return; }
      if (mode === 'in' && d.layer.type === 'group') d.layer.children.push(moved);
      else d.arr.splice(mode === 'above' ? d.idx + 1 : d.idx, 0, moved);
      pruneGroups();
      walk(doc.layers, function (l) { if (l.type === 'group') reflowGroup(l); });
    });
  }

  /* ===================================================================
     28. MODÈLES
     ---------------------------------------------------------------
     Un modèle ne dessine pas une image : il produit des calques, tous
     modifiables, la plupart déjà liés aux données du club. Changer de
     modèle change donc la composition entière, pas deux lignes de texte.
     =================================================================== */

  function T(d) { return d.w; }   /* raccourci : toutes les mesures sont relatives à la largeur */

  function bandeau(d, y, txt, opts) {
    opts = opts || {};
    var W = T(d), pad = W * 0.055;
    var h = Math.round(W * (opts.h || 0.058));
    var r = makeShape(d, 'rect', { x: pad, y: y, w: W - pad * 2, h: h, radius: h / 2 });
    r.fill = { type: 'solid', color: color(opts.bg || d.palette.accent, 1) };
    r.stroke = { color: color(d.palette.fg, 1), w: 0, dash: 0 };
    r.name = opts.name || 'Bandeau';
    var t = makeText(d, 'pastille', txt, {
      x: pad, y: y + h * 0.29, w: W - pad * 2,
      colHex: opts.fg || d.palette.bg, bind: opts.bind || null
    });
    t.ts.align = 'center';
    t.ts.size = Math.round(W * 0.026);
    t.name = opts.name ? opts.name + ' — texte' : 'Texte du bandeau';
    syncTextBox(t);
    return [r, t];
  }

  var TEMPLATES = [
    /* ---------------- MATCH DAY ----------------
       « Duel » reprend trait pour trait la maquette d'origine
       (halo, arc de terrain, deux découpes de joueuses, pastille VS,
       ligne des équipes, carte date/lieu, pied de page). Les mesures
       sont exprimées en fractions de la maquette 460 × 613, ce qui la
       transpose telle quelle dans les sept formats. */
    {
      id: 'md-duel-maquette', cat: 'Match Day', label: 'Duel — maquette', pal: 'nuit',
      build: function (d) {
        var W = d.w, H = d.h, out = [];
        var fx = function (px) { return px / 460 * W; };
        var fy = function (py) { return py / 613 * H; };
        var A = d.palette.accent, FG = d.palette.fg, BG = d.palette.bg;

        /* halo vert en haut, comme le radial-gradient de la maquette */
        var halo = makeShape(d, 'ellipse', { x: fx(23), y: fy(-123), w: fx(414), h: fy(337) });
        halo.fill = { type: 'radial', color: color(A, 1), from: color(A, .30), to: color(A, 0), angle: 90 };
        halo.stroke = { color: color(A, 0), w: 0, dash: 0 };
        halo.name = 'Halo';
        out.push(halo);

        /* arc du terrain */
        var arc = makeShape(d, 'ellipse', { x: fx(60), y: fy(285), w: fx(340), h: fy(340) });
        arc.fill = { type: 'none' };
        arc.stroke = { color: color(FG, .09), w: Math.max(1, fx(2)), dash: 0 };
        arc.name = 'Arc du terrain';
        out.push(arc);

        /* les deux joueuses — cadres dynamiques */
        var pl = makeFrame(d, { x: fx(94), y: fy(235), w: fx(130), h: fy(220), slot: 'photoJoueuse' });
        pl.name = 'Joueuse — domicile';
        pl.fx.gray = 100; pl.fx.contrast = 12;
        out.push(pl);

        var pr = makeFrame(d, { x: fx(236), y: fy(235), w: fx(130), h: fy(220), slot: 'photoMatch' });
        pr.name = 'Joueuse — adversaire';
        pr.fx.gray = 100; pr.fx.tint = color(A, 1); pr.fx.tintAmt = .34;
        out.push(pr);

        /* pastille VS */
        var vsb = makeShape(d, 'ellipse', { x: fx(206), y: fy(321), w: fx(48), h: fx(48) });
        vsb.fill = { type: 'solid', color: color(BG, .88) };
        vsb.stroke = { color: color(A, 1), w: Math.max(1, fx(1.5)), dash: 0 };
        vsb.name = 'Pastille VS';
        out.push(vsb);

        var vst = makeText(d, 'pastille', 'VS', { x: fx(206), y: fy(321) + fx(48) * .30, w: fx(48), colHex: FG });
        vst.ts.align = 'center'; vst.ts.size = fx(15); vst.ts.tracking = 0;
        vst.name = 'VS'; syncTextBox(vst);
        out.push(vst);

        /* sur-titre */
        var kick = makeText(d, 'surtitre', 'MATCH OFFICIEL · LIGUE NATIONALE', {
          x: 0, y: fy(22), w: W, colHex: A, bind: 'match.competition'
        });
        kick.ts.align = 'center'; kick.ts.size = fx(10.5); kick.ts.tracking = .14;
        kick.name = 'Compétition'; syncTextBox(kick);
        out.push(kick);

        /* titre — trois runs : le « vs » porte sa propre couleur, son
           propre corps et son italique, sans toucher au reste du mot */
        var titre = makeText(d, 'titre', 'BAOBABS', { x: 0, y: fy(104), w: W });
        titre.ts.font = 'Space Grotesk';
        titre.ts.weight = 700;
        titre.ts.size = fx(52);
        titre.ts.lh = 0.94;
        titre.ts.tracking = -0.02;
        titre.ts.align = 'center';
        titre.ts.transform = 'none';
        titre.ts.color = color(FG, 1);
        titre.runs = [
          { t: 'BAOBABS\n', s: {} },
          { t: 'vs ', s: { color: color(A, 1), italic: true, weight: 500, size: Math.round(fx(52) * .55) } },
          { t: 'DUC', s: {} }
        ];
        titre.shadow = { on: true, x: 0, y: fy(8), blur: fy(30), color: color('#000000', .5) };
        titre.name = 'Titre — Baobabs vs DUC';
        syncTextBox(titre);
        out.push(titre);

        /* ligne des équipes */
        var crestH = makeShape(d, 'ellipse', { x: fx(26), y: fy(463), w: fx(40), h: fx(40) });
        crestH.fill = { type: 'solid', color: color(A, .16) };
        crestH.stroke = { color: color(A, .4), w: Math.max(1, fx(1.5)), dash: 0 };
        crestH.name = 'Blason domicile';
        out.push(crestH);

        var logoH = makeFrame(d, { x: fx(32), y: fy(469), w: fx(28), h: fx(28), slot: 'logoClub', mask: 'ellipse' });
        logoH.fit = 'contain'; logoH.name = 'Logo Baobabs';
        out.push(logoH);

        var nomH = makeText(d, 'soustitre', 'Baobabs BC', { x: fx(75), y: fy(475), w: fx(150), colHex: FG });
        nomH.ts.size = fx(13); nomH.ts.font = 'Archivo'; nomH.ts.weight = 600;
        nomH.name = 'Nom domicile'; syncTextBox(nomH);
        out.push(nomH);

        var sep = makeText(d, 'mention', 'DOMICILE', { x: 0, y: fy(478), w: W, colHex: d.palette.fg2, bind: 'match.lieuType' });
        sep.ts.align = 'center'; sep.ts.size = fx(9.5); sep.ts.tracking = .08;
        sep.name = 'Domicile / extérieur'; syncTextBox(sep);
        out.push(sep);

        var crestA = makeShape(d, 'ellipse', { x: fx(394), y: fy(463), w: fx(40), h: fx(40) });
        crestA.fill = { type: 'solid', color: color(FG, .05) };
        crestA.stroke = { color: color(FG, .16), w: Math.max(1, fx(1.5)), dash: 0 };
        crestA.name = 'Blason adversaire';
        out.push(crestA);

        var logoA = makeFrame(d, { x: fx(400), y: fy(469), w: fx(28), h: fx(28), slot: 'logoAdv', mask: 'ellipse' });
        logoA.fit = 'contain'; logoA.name = 'Logo adversaire';
        out.push(logoA);

        var nomA = makeText(d, 'soustitre', 'DUC Dakar', { x: fx(235), y: fy(475), w: fx(150), colHex: FG, bind: 'match.adversaire' });
        nomA.ts.size = fx(13); nomA.ts.font = 'Archivo'; nomA.ts.weight = 600; nomA.ts.align = 'right';
        nomA.name = 'Nom adversaire'; syncTextBox(nomA);
        out.push(nomA);

        /* carte date / lieu */
        var card = makeShape(d, 'rect', { x: fx(22), y: fy(521), w: fx(416), h: fy(53), radius: fx(10) });
        card.fill = { type: 'solid', color: color(FG, .04) };
        card.stroke = { color: color(FG, .12), w: Math.max(1, fx(1)), dash: 0 };
        card.name = 'Carte date et lieu';
        out.push(card);

        var lab1 = makeText(d, 'mention', 'DATE', { x: fx(40), y: fy(535), w: fx(180), colHex: A });
        lab1.ts.size = fx(9.5); lab1.ts.tracking = .07; lab1.name = 'Libellé date'; syncTextBox(lab1);
        out.push(lab1);
        var val1 = makeText(d, 'soustitre', 'Sam. 12 sept — 19h30', { x: fx(40), y: fy(548), w: fx(180), colHex: FG, bind: 'match.date' });
        val1.ts.size = fx(12.5); val1.ts.font = 'Inter'; val1.ts.weight = 600; val1.ts.transform = 'none';
        val1.name = 'Date'; syncTextBox(val1);
        out.push(val1);

        var div = makeShape(d, 'rect', { x: fx(230), y: fy(532), w: Math.max(1, fx(1)), h: fy(30) });
        div.fill = { type: 'solid', color: color(FG, .16) };
        div.stroke = { color: color(FG, 0), w: 0, dash: 0 };
        div.name = 'Séparateur';
        out.push(div);

        var lab2 = makeText(d, 'mention', 'LIEU', { x: fx(248), y: fy(535), w: fx(180), colHex: A });
        lab2.ts.size = fx(9.5); lab2.ts.tracking = .07; lab2.name = 'Libellé lieu'; syncTextBox(lab2);
        out.push(lab2);
        var val2 = makeText(d, 'soustitre', 'Stadium Marius Ndiaye', { x: fx(248), y: fy(548), w: fx(180), colHex: FG, bind: 'match.lieu' });
        val2.ts.size = fx(12.5); val2.ts.font = 'Inter'; val2.ts.weight = 600; val2.ts.transform = 'none';
        val2.name = 'Salle'; syncTextBox(val2);
        out.push(val2);

        /* pied de page */
        var foot = makeText(d, 'mention', 'BAOBABSBASKETCLUB.COM   ·   @BAOBABSBC', {
          x: 0, y: fy(590), w: W, colHex: d.palette.fg2
        });
        foot.ts.align = 'center'; foot.ts.size = fx(10.5); foot.ts.tracking = .02;
        foot.runs = [
          { t: 'BAOBABSBASKETCLUB.COM   ', s: {} },
          { t: '·', s: { color: color(A, 1) } },
          { t: '   @BAOBABSBC', s: {} }
        ];
        foot.name = 'Pied de page'; syncTextBox(foot);
        out.push(foot);

        return out;
      }
    },
    {
      id: 'md-choc', cat: 'Match Day', label: 'Coup d envoi', pal: 'nuit',
      build: function (d) {
        var W = T(d), H = d.h, pad = W * 0.07, out = [];
        var photo = makeFrame(d, { x: 0, y: H * 0.30, w: W, h: H * 0.46, slot: 'photoMatch' });
        photo.fx.veil = 0.34; photo.fx.gray = 40; photo.name = 'Photo de fond';
        out.push(photo);

        var bar = makeShape(d, 'rect', { x: 0, y: H * 0.30, w: W * 0.055, h: H * 0.46 });
        bar.fill = { type: 'solid', color: color(d.palette.accent, 1) };
        bar.name = 'Barre d accent';
        out.push(bar);

        var kick = makeText(d, 'surtitre', 'CHAMPIONNAT NATIONAL D2', { x: pad, y: H * 0.115, w: W - pad * 2, colHex: d.palette.accent, bind: 'match.competition' });
        kick.name = 'Compétition'; syncTextBox(kick); out.push(kick);

        var titre = makeText(d, 'assommoir', 'BAOBABS', { x: pad, y: H * 0.145, w: W - pad * 2 });
        titre.ts.size = Math.round(W * 0.175); titre.name = 'BAOBABS'; syncTextBox(titre); out.push(titre);

        var vs = makeText(d, 'assommoir', 'vs ADVERSAIRE', { x: pad, y: H * 0.145 + Math.round(W * 0.175) * 0.88, w: W - pad * 2, bind: 'match.affiche' });
        vs.ts.size = Math.round(W * 0.105);
        vs.ts.color = color(d.palette.accent, 1);
        vs.ts.hollow = true; vs.ts.strokeW = Math.max(2, Math.round(W * 0.0035));
        vs.name = 'vs Adversaire';
        setPlainText(vs, 'VS ADVERSAIRE');
        syncTextBox(vs); out.push(vs);

        out = out.concat(bandeau(d, H * 0.795, 'SAMEDI 00 — 19H00', { bind: 'match.date', name: 'Date' }));
        var lieu = makeText(d, 'donnee', 'STADIUM MARIUS NDIAYE', { x: pad, y: H * 0.878, w: W - pad * 2, colHex: d.palette.fg2, bind: 'match.lieu' });
        lieu.ts.align = 'center'; lieu.ts.size = Math.round(W * 0.022);
        lieu.name = 'Salle'; syncTextBox(lieu); out.push(lieu);

        var site = makeText(d, 'mention', 'BAOBABSBASKETCLUB.COM', { x: pad, y: H * 0.935, w: W - pad * 2, colHex: d.palette.fg2, bind: 'club.site' });
        site.ts.align = 'center'; site.name = 'Site'; syncTextBox(site); out.push(site);
        return out;
      }
    },
    {
      id: 'md-duel', cat: 'Match Day', label: 'Face à face', pal: 'nuit',
      build: function (d) {
        var W = T(d), H = d.h, pad = W * 0.07, out = [];
        var g = makeShape(d, 'rect', { x: 0, y: 0, w: W, h: H });
        g.fill = { type: 'linear', from: color(d.palette.bg, 1), to: color(d.palette.accent, 0.28), angle: 120 };
        g.name = 'Dégradé de fond';
        out.push(g);

        var kick = makeText(d, 'surtitre', 'MATCH OFFICIEL', { x: pad, y: H * 0.09, w: W - pad * 2, colHex: d.palette.accent, bind: 'match.competition' });
        kick.ts.align = 'center'; kick.name = 'Compétition'; syncTextBox(kick); out.push(kick);

        var lc = makeFrame(d, { x: W * 0.09, y: H * 0.20, w: W * 0.34, h: W * 0.34, slot: 'logoClub', mask: 'ellipse' });
        lc.fit = 'contain'; lc.name = 'Logo Baobabs'; out.push(lc);
        var la = makeFrame(d, { x: W * 0.57, y: H * 0.20, w: W * 0.34, h: W * 0.34, slot: 'logoAdv', mask: 'ellipse' });
        la.fit = 'contain'; la.name = 'Logo adversaire'; out.push(la);

        var vs = makeText(d, 'assommoir', 'VS', { x: W * 0.35, y: H * 0.20 + W * 0.10, w: W * 0.30 });
        vs.ts.size = Math.round(W * 0.13); vs.ts.align = 'center';
        vs.ts.color = color(d.palette.accent, 1); vs.name = 'VS'; syncTextBox(vs); out.push(vs);

        var n1 = makeText(d, 'titre', 'BAOBABS BC', { x: W * 0.05, y: H * 0.20 + W * 0.37, w: W * 0.42, colHex: d.palette.fg });
        n1.ts.align = 'center'; n1.ts.size = Math.round(W * 0.045); n1.name = 'Nom Baobabs'; syncTextBox(n1); out.push(n1);
        var n2 = makeText(d, 'titre', 'ADVERSAIRE', { x: W * 0.53, y: H * 0.20 + W * 0.37, w: W * 0.42, colHex: d.palette.fg, bind: 'match.adversaire' });
        n2.ts.align = 'center'; n2.ts.size = Math.round(W * 0.045); n2.name = 'Nom adversaire'; syncTextBox(n2); out.push(n2);

        var big = makeText(d, 'assommoir', 'SAMEDI 00', { x: pad, y: H * 0.66, w: W - pad * 2, bind: 'match.date' });
        big.ts.size = Math.round(W * 0.12); big.ts.align = 'center'; big.name = 'Date'; syncTextBox(big); out.push(big);

        out = out.concat(bandeau(d, H * 0.80, 'STADIUM MARIUS NDIAYE', { bind: 'match.lieu', name: 'Salle', bg: d.palette.accent }));
        var h = makeText(d, 'donnee', '19H00', { x: pad, y: H * 0.885, w: W - pad * 2, colHex: d.palette.accent, bind: 'match.heure' });
        h.ts.align = 'center'; h.ts.size = Math.round(W * 0.05); h.name = 'Heure'; syncTextBox(h); out.push(h);
        return out;
      }
    },
    {
      id: 'md-compte', cat: 'Match Day', label: 'Compte à rebours', pal: 'brique',
      build: function (d) {
        var W = T(d), H = d.h, pad = W * 0.07, out = [];
        var photo = makeFrame(d, { x: 0, y: 0, w: W, h: H, slot: 'photoJoueuse' });
        photo.fx.veil = 0.55; photo.fx.gray = 65; photo.name = 'Photo plein cadre';
        out.push(photo);

        var jm = makeText(d, 'chiffre', 'J-3', { x: pad, y: H * 0.28, w: W - pad * 2, bind: 'match.jours' });
        jm.ts.size = Math.round(W * 0.38); jm.ts.align = 'center';
        jm.ts.color = color(d.palette.accent, 1); jm.name = 'Compte à rebours'; syncTextBox(jm); out.push(jm);

        var av = makeText(d, 'surtitre', 'AVANT LE PROCHAIN MATCH', { x: pad, y: H * 0.24, w: W - pad * 2, colHex: d.palette.fg });
        av.ts.align = 'center'; av.name = 'Sur-titre'; syncTextBox(av); out.push(av);

        var adv = makeText(d, 'assommoir', 'BAOBABS VS ADVERSAIRE', { x: pad, y: H * 0.60, w: W - pad * 2, bind: 'match.affiche' });
        adv.ts.size = Math.round(W * 0.085); adv.ts.align = 'center'; adv.name = 'Affiche'; syncTextBox(adv); out.push(adv);

        out = out.concat(bandeau(d, H * 0.78, 'SAMEDI 00 — 19H00', { bind: 'match.date', name: 'Date' }));
        return out;
      }
    },

    /* ---------------- RÉSULTAT ---------------- */
    {
      id: 'res-score', cat: 'Résultat', label: 'Score final', pal: 'nuit',
      build: function (d) {
        var W = T(d), H = d.h, pad = W * 0.07, out = [];
        var kick = makeText(d, 'surtitre', 'RÉSULTAT', { x: pad, y: H * 0.10, w: W - pad * 2, colHex: d.palette.accent });
        kick.ts.align = 'center'; kick.name = 'Sur-titre'; syncTextBox(kick); out.push(kick);

        var iss = makeText(d, 'assommoir', 'VICTOIRE', { x: pad, y: H * 0.145, w: W - pad * 2, bind: 'resultat.issue' });
        iss.ts.size = Math.round(W * 0.15); iss.ts.align = 'center'; iss.name = 'Victoire / défaite'; syncTextBox(iss); out.push(iss);

        var card = makeShape(d, 'rect', { x: pad, y: H * 0.33, w: W - pad * 2, h: H * 0.28, radius: W * 0.045 });
        card.fill = { type: 'solid', color: color(d.palette.accent, 1) };
        card.name = 'Carte du score'; out.push(card);

        var score = makeText(d, 'chiffre', '00 – 00', { x: pad, y: H * 0.365, w: W - pad * 2, colHex: d.palette.bg, bind: 'resultat.score' });
        score.ts.size = Math.round(W * 0.20); score.ts.align = 'center'; score.name = 'Score'; syncTextBox(score); out.push(score);

        var vs2 = makeText(d, 'pastille', 'BAOBABS — ADVERSAIRE', { x: pad, y: H * 0.545, w: W - pad * 2, colHex: d.palette.bg, bind: 'resultat.adversaire' });
        vs2.ts.align = 'center'; vs2.name = 'Équipes'; syncTextBox(vs2); out.push(vs2);

        var photo = makeFrame(d, { x: pad, y: H * 0.66, w: W - pad * 2, h: H * 0.22, slot: 'photoMatch', radius: W * 0.04 });
        photo.name = 'Photo du match'; out.push(photo);

        var site = makeText(d, 'mention', 'BAOBABSBASKETCLUB.COM', { x: pad, y: H * 0.915, w: W - pad * 2, colHex: d.palette.fg2, bind: 'club.site' });
        site.ts.align = 'center'; site.name = 'Site'; syncTextBox(site); out.push(site);
        return out;
      }
    },

    /* ---------------- BILLETTERIE ---------------- */
    {
      id: 'bil-ouvert', cat: 'Billetterie', label: 'Billetterie ouverte', pal: 'or',
      build: function (d) {
        var W = T(d), H = d.h, pad = W * 0.08, out = [];
        var photo = makeFrame(d, { x: 0, y: H * 0.42, w: W, h: H * 0.58, slot: 'photoMatch' });
        photo.fx.veil = 0.42; photo.name = 'Photo'; out.push(photo);

        var t1 = makeText(d, 'assommoir', 'PRENEZ', { x: pad, y: H * 0.10, w: W - pad * 2 });
        t1.ts.size = Math.round(W * 0.19); t1.name = 'PRENEZ'; syncTextBox(t1); out.push(t1);
        var t2 = makeText(d, 'assommoir', 'VOTRE PLACE', { x: pad, y: H * 0.10 + Math.round(W * 0.19) * 0.86, w: W - pad * 2 });
        t2.ts.size = Math.round(W * 0.115);
        t2.ts.color = color(d.palette.accent, 1);
        t2.name = 'VOTRE PLACE'; syncTextBox(t2); out.push(t2);

        var sub = makeText(d, 'para', 'Billetterie ouverte pour le prochain match à domicile. Réservez en ligne, retirez à l entrée.', { x: pad, y: H * 0.30, w: W * 0.72, colHex: d.palette.fg2 });
        sub.name = 'Explication'; syncTextBox(sub); out.push(sub);

        out = out.concat(bandeau(d, H * 0.86, 'BAOBABSBASKETCLUB.COM/BILLETTERIE', { bind: 'club.site', name: 'Adresse' }));
        return out;
      }
    },

    /* ---------------- JOUEUSE ---------------- */
    {
      id: 'jou-fiche', cat: 'Joueuse', label: 'Fiche joueuse', pal: 'nuit',
      build: function (d) {
        var W = T(d), H = d.h, pad = W * 0.07, out = [];
        var num = makeText(d, 'chiffre', '00', { x: -W * 0.02, y: H * 0.06, w: W, bind: 'joueuse.numero' });
        num.ts.size = Math.round(W * 0.52);
        num.ts.color = color(d.palette.accent, 0.16);
        num.name = 'Numéro en filigrane'; syncTextBox(num); out.push(num);

        var photo = makeFrame(d, { x: W * 0.10, y: H * 0.16, w: W * 0.80, h: H * 0.50, slot: 'photoJoueuse', mask: 'arch' });
        photo.name = 'Photo de la joueuse'; out.push(photo);

        var nom = makeText(d, 'assommoir', 'PRÉNOM NOM', { x: pad, y: H * 0.70, w: W - pad * 2, bind: 'joueuse.nom' });
        nom.ts.size = Math.round(W * 0.115); nom.ts.align = 'center'; nom.name = 'Nom'; syncTextBox(nom); out.push(nom);

        var poste = makeText(d, 'surtitre', 'MENEUSE', { x: pad, y: H * 0.79, w: W - pad * 2, colHex: d.palette.accent, bind: 'joueuse.poste' });
        poste.ts.align = 'center'; poste.name = 'Poste'; syncTextBox(poste); out.push(poste);

        out = out.concat(bandeau(d, H * 0.86, 'EFFECTIF 2026', { name: 'Saison' }));
        return out;
      }
    },
    {
      id: 'jou-mvp', cat: 'Joueuse', label: 'MVP du match', pal: 'or',
      build: function (d) {
        var W = T(d), H = d.h, pad = W * 0.07, out = [];
        var photo = makeFrame(d, { x: 0, y: 0, w: W, h: H, slot: 'photoJoueuse' });
        photo.fx.veil = 0.40; photo.name = 'Photo plein cadre'; out.push(photo);

        var mvp = makeText(d, 'assommoir', 'MVP', { x: pad, y: H * 0.09, w: W - pad * 2 });
        mvp.ts.size = Math.round(W * 0.30);
        mvp.ts.hollow = true; mvp.ts.strokeW = Math.max(2, Math.round(W * 0.005));
        mvp.ts.color = color(d.palette.accent, 1);
        mvp.ts.align = 'center'; mvp.name = 'MVP'; syncTextBox(mvp); out.push(mvp);

        var nom = makeText(d, 'assommoir', 'PRÉNOM NOM', { x: pad, y: H * 0.66, w: W - pad * 2, bind: 'joueuse.nom' });
        nom.ts.size = Math.round(W * 0.11); nom.ts.align = 'center'; nom.name = 'Nom'; syncTextBox(nom); out.push(nom);

        var stat = makeText(d, 'donnee', 'JOUEUSE DU MATCH', { x: pad, y: H * 0.76, w: W - pad * 2, colHex: d.palette.accent });
        stat.ts.align = 'center'; stat.name = 'Mention'; syncTextBox(stat); out.push(stat);
        out = out.concat(bandeau(d, H * 0.85, 'BAOBABS VS ADVERSAIRE', { bind: 'match.affiche', name: 'Affiche' }));
        return out;
      }
    },

    /* ---------------- CLUB ---------------- */
    {
      id: 'ann-simple', cat: 'Club', label: 'Annonce', pal: 'craie',
      build: function (d) {
        var W = T(d), H = d.h, pad = W * 0.09, out = [];
        var bar = makeShape(d, 'rect', { x: 0, y: 0, w: W, h: H * 0.018 });
        bar.fill = { type: 'solid', color: color('#111111', 1) }; bar.name = 'Filet'; out.push(bar);

        var kick = makeText(d, 'surtitre', 'INFORMATION CLUB', { x: pad, y: H * 0.10, w: W - pad * 2, colHex: '#6B6B6B' });
        kick.name = 'Sur-titre'; syncTextBox(kick); out.push(kick);

        var t = makeText(d, 'assommoir', 'TITRE DE L ANNONCE', { x: pad, y: H * 0.145, w: W - pad * 2, colHex: '#111111' });
        t.ts.size = Math.round(W * 0.115); t.name = 'Titre'; syncTextBox(t); out.push(t);

        var p = makeText(d, 'para', 'Écrivez ici le détail de l annonce : ce qui change, à partir de quand, et ce que doivent faire les personnes concernées.', { x: pad, y: H * 0.44, w: W - pad * 2, colHex: '#3A3A3A' });
        p.ts.size = Math.round(W * 0.026); p.name = 'Corps du texte'; syncTextBox(p); out.push(p);

        var logo = makeFrame(d, { x: pad, y: H * 0.80, w: W * 0.20, h: W * 0.20, slot: 'logoClub' });
        logo.fit = 'contain'; logo.name = 'Logo'; out.push(logo);

        var site = makeText(d, 'mention', 'BAOBABSBASKETCLUB.COM', { x: pad, y: H * 0.93, w: W - pad * 2, colHex: '#6B6B6B', bind: 'club.site' });
        site.name = 'Site'; syncTextBox(site); out.push(site);
        return out;
      }
    },
    {
      id: 'rec-appel', cat: 'Club', label: 'Recrutement', pal: 'ocean',
      build: function (d) {
        var W = T(d), H = d.h, pad = W * 0.07, out = [];
        var photo = makeFrame(d, { x: 0, y: H * 0.34, w: W, h: H * 0.66, slot: 'photoJoueuse' });
        photo.fx.veil = 0.30; photo.name = 'Photo'; out.push(photo);

        var t1 = makeText(d, 'assommoir', 'REJOINS', { x: pad, y: H * 0.09, w: W - pad * 2 });
        t1.ts.size = Math.round(W * 0.155); t1.name = 'REJOINS'; syncTextBox(t1); out.push(t1);
        var t2 = makeText(d, 'assommoir', 'LES BAOBABS', { x: pad, y: H * 0.09 + Math.round(W * 0.155) * 0.86, w: W - pad * 2 });
        t2.ts.size = Math.round(W * 0.115);
        t2.ts.color = color(d.palette.accent, 1); t2.name = 'LES BAOBABS'; syncTextBox(t2); out.push(t2);

        var p = makeText(d, 'para', 'Détections ouvertes. Viens essayer, on te dit tout sur place.', { x: pad, y: H * 0.265, w: W * 0.78, colHex: d.palette.fg2 });
        p.name = 'Accroche'; syncTextBox(p); out.push(p);

        out = out.concat(bandeau(d, H * 0.87, 'CANDIDATE EN LIGNE — BAOBABSBASKETCLUB.COM', { name: 'Appel à l action' }));
        return out;
      }
    },
    {
      id: 'vierge', cat: 'Club', label: 'Page vierge', pal: 'nuit',
      build: function (d) {
        var W = T(d), H = d.h, out = [];
        var t = makeText(d, 'assommoir', 'VOTRE TITRE', { x: W * 0.07, y: H * 0.10, w: W * 0.86 });
        t.ts.size = Math.round(W * 0.14); syncTextBox(t); out.push(t);
        return out;
      }
    }
  ];

  function templateById(id) {
    for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].id === id) return TEMPLATES[i];
    return null;
  }

  var lastTpl = null;
  function applyTemplate(id, keepFormat) {
    var t = templateById(id);
    if (!t) return;
    lastTpl = id;
    change(function () {
      var f = keepFormat === false ? 'affiche' : doc.format;
      var nd = newDoc(f, t.pal);
      nd.name = doc.name;
      doc.bg = nd.bg;
      doc.palette = nd.palette;
      doc.layers = t.build(doc) || [];
      sel = [];
    });
    applyBindings();
    fitView();
    toast('Modèle « ' + t.label +' » appliqué');
  }

  /* Vignette d un modèle : on le construit dans un document temporaire
     et on le rend en petit. La vignette est donc toujours à jour — il
     n y a pas d image de catalogue à maintenir. */
  function templateThumb(t, cvs) {
    var td = newDoc('affiche', t.pal);
    td.layers = t.build(td) || [];
    var W = cvs.width, H = cvs.height;
    var ctx = cvs.getContext('2d');
    var s = Math.min(W / td.w, H / td.h);
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.translate((W - td.w * s) / 2, (H - td.h * s) / 2);
    ctx.scale(s, s);
    ctx.beginPath(); ctx.rect(0, 0, td.w, td.h); ctx.clip();
    try { renderDoc(ctx, td, { forExport: false }); } catch (e) {}
    ctx.restore();
  }

  /* ===================================================================
     29. PANNEAUX DE GAUCHE
     =================================================================== */

  var panelName = 'modeles';
  var panelFilter = { tpl: 'Tous', q: '' };
  var favoris = [];

  function openPanel(name) {
    panelName = name;
    $$('.bs-rail-i', root).forEach(function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-panel') === name);
    });
    renderPanel();
  }

  function renderPanel() {
    if (!els.panelBody) return;
    var f = {
      modeles: panelTemplates, images: panelImages, elements: panelElements,
      texte: panelTexte, donnees: panelDonnees, styles: panelStyles, projets: panelProjets
    }[panelName] || panelTemplates;
    els.panelBody.innerHTML = f();
    wireFields(els.panelBody);
    if (panelName === 'modeles') paintTemplateThumbs();
    /* Le panneau est reconstruit à chaque frappe : sans ceci, le champ
       de recherche perdrait le focus dès la première lettre. */
    if (refocusSearch) {
      var s = els.panelBody.querySelector('.bs-search input');
      if (s) { s.focus(); try { s.setSelectionRange(s.value.length, s.value.length); } catch (e) {} }
      refocusSearch = false;
    }
  }
  var refocusSearch = false;

  function ph(title, sub) {
    return '<div class="bs-ph"><h2>' + esc(title) + '</h2>' + (sub ? '<span class="bs-ph-sub">' + esc(sub) + '</span>' : '') + '</div>';
  }
  function searchBox(value, act) {
    return '<div class="bs-search">' +
      '<svg width="14" height="14" viewBox="0 0 15 15" fill="none"><circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.4"/><path d="M9.8 9.8L13 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' +
      '<input type="text" placeholder="Rechercher…" value="' + esc(value || '') + '" data-act="' + act + '"></div>';
  }

  /* ---------- modèles ---------- */
  function panelTemplates() {
    var cats = ['Tous', 'Favoris'];
    TEMPLATES.forEach(function (t) { if (cats.indexOf(t.cat) < 0) cats.push(t.cat); });
    var chips = '<div class="bs-chips">';
    cats.forEach(function (c) {
      chips += '<button type="button" class="bs-chip' + (panelFilter.tpl === c ? ' is-on' : '') + '" data-act="tplCat" data-cat="' + esc(c) + '">' + esc(c) +
        (c === 'Favoris' && favoris.length ? ' ' + favoris.length : '') + '</button>';
    });
    chips += '</div>';

    var q = panelFilter.q.toLowerCase();
    var list = TEMPLATES.filter(function (t) {
      if (panelFilter.tpl === 'Favoris') { if (favoris.indexOf(t.id) < 0) return false; }
      else if (panelFilter.tpl !== 'Tous' && t.cat !== panelFilter.tpl) return false;
      if (q && (t.label + ' ' + t.cat).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });

    var grid = '<div class="bs-grid">';
    list.forEach(function (t) {
      var fav = favoris.indexOf(t.id) >= 0;
      grid += '<div class="bs-card' + (t.id === lastTpl ? ' is-on' : '') + '" style="position:relative">' +
        '<button type="button" style="display:block;width:100%;text-align:left" data-act="applyTpl" data-id="' + t.id + '" title="' + esc(t.label) + '">' +
        '<span class="bs-card-thumb"><canvas width="220" height="293" data-thumb="' + t.id + '"></canvas>' +
        '<span class="bs-card-badge">' + esc(t.cat) + '</span></span>' +
        '<span class="bs-card-meta"><b>' + esc(t.label) + '</b></span></button>' +
        '<button type="button" class="bs-fav' + (fav ? ' is-on' : '') + '" data-act="toggleFav" data-id="' + t.id + '"' +
        ' title="' + (fav ? 'Retirer des favoris' : 'Mettre en favori') + '">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="' + (fav ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">' +
        '<path d="m12 3 2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.2 6.4 20.3l1.2-6.3L3 9.6l6.3-.8Z"/></svg></button>' +
        '</div>';
    });
    grid += '</div>';
    if (!list.length) grid = '<div class="bs-empty"><b>Aucun modèle</b>' +
      (panelFilter.tpl === 'Favoris' ? 'Cliquez l étoile sur un modèle pour le retrouver ici.' : 'Essayez un autre mot.') + '</div>';

    return ph('Modèles', list.length + ' modèle' + (list.length > 1 ? 's' : '')) +
      searchBox(panelFilter.q, 'tplSearch') + chips + grid +
      '<div class="bs-note">Un modèle remplace la composition entière. Tous ses calques restent modifiables, et ceux marqués <b>dynamiques</b> se remplissent avec les vraies données du club.</div>';
  }

  function paintTemplateThumbs() {
    $$('[data-thumb]', els.panelBody).forEach(function (cv) {
      var t = templateById(cv.getAttribute('data-thumb'));
      if (t) { try { templateThumb(t, cv); } catch (e) {} }
    });
  }

  /* ---------- images ---------- */
  function panelImages() {
    var q = panelFilter.q.toLowerCase();
    var list = medias.filter(function (m) { return !q || (m.nom || '').toLowerCase().indexOf(q) >= 0; });
    var grid = '<div class="bs-grid bs-grid-3">';
    list.forEach(function (m) {
      grid += '<button type="button" class="bs-card" data-act="useImage" data-url="' + esc(m.url) + '" title="' + esc(m.nom || '') + '">' +
        '<span class="bs-card-thumb bs-sq"><img src="' + esc(m.url) + '" alt="" loading="lazy"></span></button>';
    });
    grid += '</div>';
    if (!list.length) grid = '<div class="bs-empty"><b>Aucune image</b>Téléversez-en une, ou déposez un fichier sur l affiche.</div>';

    return ph('Images', list.length ? list.length + ' images' : '') +
      searchBox(panelFilter.q, 'imgSearch') +
      '<div class="bs-list">' +
      '<button type="button" class="bs-btn bs-btn-accent bs-btn-sm bs-btn-block" data-act="uploadImage">Téléverser une image</button>' +
      '</div>' +
      '<div class="bs-sec-lab">Médiathèque du club</div>' + grid +
      '<div class="bs-note">Cliquer sur une image la place dans le <b>cadre sélectionné</b>. Sans sélection, elle est ajoutée comme nouveau calque.</div>';
  }

  /* ---------- éléments ---------- */
  function panelElements() {
    var h = ph('Éléments');
    var grid = '<div class="bs-grid bs-grid-3">';
    SHAPE_KINDS.forEach(function (s) {
      grid += '<button type="button" class="bs-card" data-act="addShape" data-shape="' + s.id + '" title="' + esc(s.label) + '">' +
        '<span class="bs-card-thumb bs-sq" style="display:flex;align-items:center;justify-content:center">' + shapeIcon(s.id) + '</span></button>';
    });
    grid += '</div>';
    h += '<div class="bs-sec-lab">Formes</div>' + grid;

    h += '<div class="bs-sec-lab">Blocs prêts</div><div class="bs-list">' +
      '<button type="button" class="bs-item" data-act="addBlock" data-block="bandeau"><span class="bs-item-txt"><b>Bandeau arrondi</b><small>Fond d accent + texte centré</small></span></button>' +
      '<button type="button" class="bs-item" data-act="addBlock" data-block="carteScore"><span class="bs-item-txt"><b>Carte de score</b><small>Chiffres géants sur fond plein</small></span></button>' +
      '<button type="button" class="bs-item" data-act="addBlock" data-block="duoLogos"><span class="bs-item-txt"><b>Duo de logos</b><small>Deux cadres ronds + VS</small></span></button>' +
      '<button type="button" class="bs-item" data-act="addBlock" data-block="infoDouble"><span class="bs-item-txt"><b>Date et lieu</b><small>Deux données côte à côte</small></span></button>' +
      '<button type="button" class="bs-item" data-act="addBlock" data-block="cadrePhoto"><span class="bs-item-txt"><b>Cadre photo</b><small>Emplacement vide à remplir</small></span></button>' +
      '</div>';

    var ico = '<div class="bs-grid bs-grid-3">';
    ICONS_LIB.forEach(function (ic) {
      ico += '<button type="button" class="bs-card" data-act="addIcon" data-icon="' + esc(ic.id) + '" title="' + esc(ic.label) + '">' +
        '<span class="bs-card-thumb bs-sq" style="display:flex;align-items:center;justify-content:center">' +
        '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#7DFF4F" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="' + esc(ic.d) + '"/></svg>' +
        '</span></button>';
    });
    ico += '</div>';
    h += '<div class="bs-sec-lab">Icônes <span>' + ICONS_LIB.length + '</span></div>' + ico;

    h += '<div class="bs-sec-lab">Outil</div><div class="bs-list">' +
      '<button type="button" class="bs-item" data-act="tool" data-tool="pen"><span class="bs-item-txt"><b>Plume</b><small>Tracer une courbe libre — touche P</small></span></button>' +
      '</div>';
    return h;
  }

  function makeIcon(d, id) {
    var ic = null;
    for (var i = 0; i < ICONS_LIB.length; i++) if (ICONS_LIB[i].id === id) ic = ICONS_LIB[i];
    if (!ic) return null;
    var s = Math.round(d.w * 0.16);
    var l = newLayer('icon', {
      d: ic.d, vb: 24,
      fill: { type: 'none', color: color(d.palette.accent, 1), from: color(d.palette.accent, 1), to: color(d.palette.bg, 1), angle: 90 },
      stroke: { color: color(d.palette.accent, 1), w: Math.max(1.5, d.w * 0.006), dash: 0 },
      x: Math.round((d.w - s) / 2), y: Math.round(d.h * 0.42), w: s, h: s
    });
    l.name = ic.label;
    return l;
  }
  function shapeIcon(id) {
    var S = 'fill="none" stroke="#7DFF4F" stroke-width="1.7"';
    var m = {
      rect: '<rect x="4" y="7" width="24" height="18" rx="3" ' + S + '/>',
      ellipse: '<ellipse cx="16" cy="16" rx="12" ry="10" ' + S + '/>',
      line: '<path d="M4 24 28 8" ' + S + ' stroke-linecap="round"/>',
      triangle: '<path d="M16 5 28 26H4Z" ' + S + ' stroke-linejoin="round"/>',
      polygon: '<path d="M16 4 27 11v10l-11 7-11-7V11Z" ' + S + ' stroke-linejoin="round"/>',
      star: '<path d="m16 4 3.6 7.6 8.4 1-6 6 1.4 8.4-7.4-4-7.4 4 1.4-8.4-6-6 8.4-1Z" ' + S + ' stroke-linejoin="round"/>',
      arrow: '<path d="M4 16h17m0-6 7 6-7 6" ' + S + ' stroke-linecap="round" stroke-linejoin="round"/>',
      chevron: '<path d="M6 5h8l10 11-10 11H6l10-11Z" ' + S + ' stroke-linejoin="round"/>'
    };
    return '<svg width="32" height="32" viewBox="0 0 32 32">' + (m[id] || m.rect) + '</svg>';
  }

  /* ---------- texte ---------- */
  function panelTexte() {
    var h = ph('Texte', 'Rôles typographiques');
    h += '<div class="bs-list">';
    ROLES.forEach(function (r) {
      var prev = r.hollow ? 'Contour' : (r.id === 'chiffre' ? '00' : 'Baobabs');
      var sz = Math.min(26, Math.max(11, r.size * 260));
      h += '<button type="button" class="bs-item" data-act="addText" data-role="' + r.id + '">' +
        '<span class="bs-item-txt">' +
        '<b style="font-family:' + fontStack(r.font).replace(/"/g, '&quot;') + ';font-weight:' + r.weight +
        ';font-size:' + sz + 'px;letter-spacing:' + (r.tracking) + 'em;' +
        (r.upper ? 'text-transform:uppercase;' : '') +
        (r.hollow ? '-webkit-text-stroke:1px var(--bs-accent);color:transparent;' : '') +
        'line-height:1.15">' + esc(prev) + '</b>' +
        '<small>' + esc(r.label) + ' · ' + esc(r.font) + '</small></span></button>';
    });
    h += '</div>';
    h += '<div class="bs-note">Chaque rôle porte sa police, sa graisse, son interlettrage et sa casse. Vous pouvez ensuite tout modifier, y compris <b>une seule lettre</b> : double-cliquez le texte, sélectionnez la lettre, changez sa couleur.</div>';
    return h;
  }

  /* ---------- données ---------- */
  function panelDonnees() {
    var h = ph('Données du club', 'Objets dynamiques');
    h += '<div class="bs-list"><button type="button" class="bs-btn bs-btn-ghost bs-btn-sm bs-btn-block" data-act="reloadData">Recharger depuis la base</button></div>';
    var groups = {};
    BINDINGS.forEach(function (b) {
      var g = b.id.split('.')[0];
      (groups[g] = groups[g] || []).push(b);
    });
    var titles = { match: 'Prochain match', resultat: 'Dernier résultat', joueuse: 'Joueuse', club: 'Club' };
    for (var g in groups) {
      h += '<div class="bs-sec-lab">' + esc(titles[g] || g) + '</div><div class="bs-list">';
      groups[g].forEach(function (b) {
        var v = resolveBinding(b.id);
        h += '<button type="button" class="bs-item" data-act="addBound" data-bind="' + esc(b.id) + '">' +
          '<span class="bs-lyr-dyn" style="flex:none">' + ICONS.dyn + '</span>' +
          '<span class="bs-item-txt"><b>' + esc(b.label) + '</b><small>' + esc(v == null || v === '' ? '— non renseigné —' : String(v)) + '</small></span></button>';
      });
      h += '</div>';
    }
    if (data.joueuses && data.joueuses.length) {
      h += '<div class="bs-sec-lab">Choisir la joueuse <span>' + data.joueuses.length + '</span></div><div class="bs-list">';
      data.joueuses.forEach(function (j, i) {
        h += '<button type="button" class="bs-item' + (data.joueuseIdx === i ? ' is-on' : '') + '" data-act="pickJoueuse" data-i="' + i + '">' +
          (j.photo ? '<span class="bs-lyr-ico" style="width:26px;height:26px"><img src="' + esc(j.photo) + '" alt=""></span>' : '<span class="bs-lyr-ico" style="width:26px;height:26px"></span>') +
          '<span class="bs-item-txt"><b>' + esc(j.nom) + '</b><small>' + esc([j.numero != null ? '#' + j.numero : '', j.poste].filter(Boolean).join(' · ')) + '</small></span></button>';
      });
      h += '</div>';
    }
    h += '<div class="bs-note">Cliquer sur une donnée insère un texte <b>lié</b> : il se met à jour tout seul quand la base change. Modifier son contenu à la main rompt la liaison, et le Studio vous le signale.</div>';
    return h;
  }

  /* ---------- styles ---------- */
  function panelStyles() {
    var h = ph('Styles', 'Ambiances');
    h += '<div class="bs-list">';
    PALETTES.forEach(function (p) {
      h += '<button type="button" class="bs-item' + (doc.palette.id === p.id ? ' is-on' : '') + '" data-act="palette" data-id="' + p.id + '">' +
        '<span style="display:flex;gap:3px;flex:none">' +
        '<i style="width:16px;height:26px;border-radius:3px;background:' + p.bg + ';border:1px solid rgba(255,255,255,.15)"></i>' +
        '<i style="width:16px;height:26px;border-radius:3px;background:' + p.accent + '"></i>' +
        '<i style="width:16px;height:26px;border-radius:3px;background:' + p.fg + '"></i>' +
        '</span><span class="bs-item-txt"><b>' + esc(p.label) + '</b><small>' + esc(p.bg + ' · ' + p.accent) + '</small></span></button>';
    });
    h += '</div>';

    h += '<div class="bs-sec-lab">Fond de l affiche</div><div class="bs-list">' +
      '<button type="button" class="bs-item" data-act="bgPreset" data-k="uni"><span class="bs-item-txt"><b>Aplat uni</b><small>La couleur de fond de l ambiance</small></span></button>' +
      '<button type="button" class="bs-item" data-act="bgPreset" data-k="degrade"><span class="bs-item-txt"><b>Dégradé diagonal</b><small>Fond vers accent</small></span></button>' +
      '<button type="button" class="bs-item" data-act="bgPreset" data-k="halo"><span class="bs-item-txt"><b>Halo central</b><small>Dégradé radial</small></span></button>' +
      '<button type="button" class="bs-item" data-act="bgPreset" data-k="photo"><span class="bs-item-txt"><b>Photo plein cadre</b><small>Cadre dynamique en fond</small></span></button>' +
      '</div>';

    h += '<div class="bs-sec-lab">Effets sur la sélection</div><div class="bs-list">' +
      '<button type="button" class="bs-item" data-act="fxPreset" data-k="ombre"><span class="bs-item-txt"><b>Ombre portée douce</b></span></button>' +
      '<button type="button" class="bs-item" data-act="fxPreset" data-k="contour"><span class="bs-item-txt"><b>Texte en contour</b></span></button>' +
      '<button type="button" class="bs-item" data-act="fxPreset" data-k="bichro"><span class="bs-item-txt"><b>Photo en bichromie</b><small>Noir et blanc + teinte d accent</small></span></button>' +
      '<button type="button" class="bs-item" data-act="fxPreset" data-k="reset"><span class="bs-item-txt"><b>Retirer les effets</b></span></button>' +
      '</div>';
    return h;
  }

  /* ---------- projets ---------- */
  var projectList = [];
  function panelProjets() {
    var h = ph('Mes projets', projectList.length ? projectList.length + ' enregistrés' : '');
    h += '<div class="bs-list">' +
      '<button type="button" class="bs-btn bs-btn-accent bs-btn-sm bs-btn-block" data-act="saveProject">Enregistrer ce projet</button>' +
      '<button type="button" class="bs-btn bs-btn-ghost bs-btn-sm bs-btn-block" data-act="saveAsProject">Enregistrer une copie</button>' +
      '<button type="button" class="bs-btn bs-btn-ghost bs-btn-sm bs-btn-block" data-act="newProject">Nouveau projet vierge</button>' +
      '</div>';

    var mine = projectList.filter(function (p) { return !p.est_modele; });
    var tpl = projectList.filter(function (p) { return p.est_modele; });

    h += '<div class="bs-sec-lab">Projets <span>' + mine.length + '</span></div>';
    h += mine.length ? projRows(mine) : '<div class="bs-empty">Rien d enregistré pour l instant.</div>';

    h += '<div class="bs-sec-lab">Mes modèles <span>' + tpl.length + '</span></div>';
    h += tpl.length
      ? projRows(tpl)
      : '<div class="bs-empty">Enregistrez une affiche comme modèle pour la réutiliser à chaque match.</div>';

    h += '<div class="bs-note">Un projet garde <b>tous ses calques modifiables</b>. Le rouvrir, c est reprendre là où vous en étiez, pas repartir d une image.</div>';
    return h;
  }
  function projRows(list) {
    var h = '<div class="bs-list">';
    list.forEach(function (p) {
      h += '<div class="bs-item' + (project.id === p.id ? ' is-on' : '') + '">' +
        '<button type="button" class="bs-item-txt" style="text-align:left;background:none" data-act="openProject" data-id="' + esc(p.id) + '">' +
        '<b>' + esc(p.nom || 'Sans titre') + '</b><small>' + esc(projSub(p)) + '</small></button>' +
        '<span class="bs-item-acts">' +
        '<button type="button" class="bs-ico bs-ico-xs" data-act="dupProject" data-id="' + esc(p.id) + '" title="Dupliquer">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3.5" y="3.5" width="12" height="12" rx="2"/><path d="M8 20.5h10a2.5 2.5 0 0 0 2.5-2.5V8"/></svg></button>' +
        '<button type="button" class="bs-ico bs-ico-xs bs-ico-danger" data-act="delProject" data-id="' + esc(p.id) + '" title="Supprimer">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6.5h16M9 6.5V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5v2M17.5 6.5V19a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V6.5"/></svg></button>' +
        '</span></div>';
    });
    return h + '</div>';
  }
  function projSub(p) {
    var f = formatById((p.doc && p.doc.format) || 'affiche');
    var n = (p.doc && p.doc.layers) ? countLayers(p.doc.layers) : 0;
    var dt = p.modifie_le ? new Date(p.modifie_le) : null;
    return [f.label.split(' · ')[0], n + ' calques', dt ? dt.toLocaleDateString('fr-FR') : ''].filter(Boolean).join(' · ');
  }
  function countLayers(arr) {
    var n = 0;
    walk(arr, function () { n++; });
    return n;
  }

  /* ===================================================================
     30. DONNÉES DU CLUB ET LIAISONS
     ---------------------------------------------------------------
     `data` est le seul point de vérité. Un calque lié ne stocke pas la
     valeur : il stocke le chemin. Recharger la base met donc l affiche
     à jour sans qu il faille retoucher un seul texte.
     =================================================================== */

  function loadData() {
    if (!api || !api.data) return Promise.resolve();
    var D = api.data;
    return Promise.all([
      safe(D.nextMatch), safe(D.lastResult), safe(D.players), safe(D.media)
    ]).then(function (r) {
      var m = r[0] || {}, res = r[1] || {}, pl = r[2] || [], md = r[3] || [];
      data.match = {
        adversaire: m.opponent || '',
        competition: m.competition || '',
        date: m.date ? fmtDate(m.date) : '',
        heure: m.time ? String(m.time).slice(0, 5).replace(':', 'H') : '',
        lieu: m.venue || '',
        lieuType: m.isHome === false ? 'EXTÉRIEUR' : 'DOMICILE',
        jours: m.date ? 'J−' + Math.max(0, daysTo(m.date)) : '',
        affiche: 'BAOBABS ' + (m.isHome === false ? '@' : 'VS') + ' ' + (m.opponent || 'ADVERSAIRE'),
        logoAdv: m.opponentLogo || '',
        photo: m.photo || ''
      };
      data.resultat = {
        score: (res.scoreUs != null ? res.scoreUs + ' – ' + res.scoreThem : ''),
        adversaire: 'BAOBABS — ' + (res.opponent || ''),
        issue: res.scoreUs == null ? '' : (res.scoreUs > res.scoreThem ? 'VICTOIRE' : (res.scoreUs < res.scoreThem ? 'DÉFAITE' : 'MATCH NUL'))
      };
      data.joueuses = (pl || []).map(function (p) {
        return { nom: p.name || '', numero: p.number, poste: p.position || '', photo: p.photo || '' };
      });
      if (data.joueuseIdx == null) data.joueuseIdx = 0;
      syncJoueuse();
      data.club = {
        nom: 'BAOBABS BASKET CLUB',
        site: 'BAOBABSBASKETCLUB.COM',
        reseau: '@BAOBABSBC',
        logo: (api.clubLogo || '')
      };
      medias = (md || []).filter(function (x) { return x && x.url; })
        .map(function (x) { return { url: x.url, nom: x.name || fileName(x.url) }; });
      /* les photos de joueuses et les logos alimentent aussi la médiathèque */
      data.joueuses.forEach(function (j) { if (j.photo) medias.push({ url: j.photo, nom: j.nom }); });
      if (data.match.logoAdv) medias.push({ url: data.match.logoAdv, nom: 'Logo ' + data.match.adversaire });
      if (data.club.logo) medias.unshift({ url: data.club.logo, nom: 'Logo Baobabs' });
      medias = dedupe(medias);
    }).catch(function () { /* le Studio garde ses valeurs de maquette */ });
  }
  function safe(fn) {
    try { var p = fn && fn(); return (p && p.then) ? p.catch(function () { return null; }) : Promise.resolve(p); }
    catch (e) { return Promise.resolve(null); }
  }
  function dedupe(list) {
    var seen = {}, out = [];
    for (var i = 0; i < list.length; i++) {
      if (seen[list[i].url]) continue;
      seen[list[i].url] = 1; out.push(list[i]);
    }
    return out;
  }
  function fmtDate(iso) {
    if (api && api.formatDate) { try { return api.formatDate(iso); } catch (e) {} }
    try {
      return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
    } catch (e) { return String(iso); }
  }
  function daysTo(iso) {
    var t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((new Date(iso + 'T00:00:00') - t) / 86400000);
  }
  function syncJoueuse() {
    var j = (data.joueuses || [])[data.joueuseIdx || 0];
    data.joueuse = j
      ? { nom: (j.nom || '').toUpperCase(), numero: j.numero == null ? '' : String(j.numero), poste: (j.poste || '').toUpperCase(), photo: j.photo || '' }
      : { nom: '', numero: '', poste: '', photo: '' };
  }

  function resolveBinding(id) {
    var v = getPath(data, id);
    return v == null ? '' : v;
  }
  function slotSource(slot) {
    if (slot === 'logoClub') return (data.club && data.club.logo) || '';
    if (slot === 'logoAdv') return (data.match && data.match.logoAdv) || '';
    if (slot === 'photoJoueuse') return (data.joueuse && data.joueuse.photo) || '';
    if (slot === 'photoMatch') return (data.match && data.match.photo) || (medias[1] && medias[1].url) || '';
    return '';
  }

  /* Remplit tous les calques liés. Un texte dont la valeur est vide
     garde son texte de maquette : une affiche ne doit jamais afficher
     un blanc parce qu un champ manque en base. */
  function applyBindings(force) {
    var touched = 0;
    walk(doc.layers, function (l) {
      if (l.type === 'text' && l.bind) {
        var v = resolveBinding(l.bind);
        if (v !== '' && v != null) {
          setPlainText(l, String(v));
          l.bindBroken = false;
          syncTextBox(l);
          if (!l._named) l.name = bindLabel(l.bind);
          touched++;
        }
      }
      if ((l.type === 'image' || l.type === 'frame') && l.slot && l.slot !== 'libre') {
        var s = slotSource(l.slot);
        if (s && (force || !l.src || l._fromSlot)) { l.src = s; l._fromSlot = true; getImage(s); touched++; }
      }
    });
    imagesReady().then(function () { requestDraw(); });
    refreshAll();
    return touched;
  }

  /* ===================================================================
     31. BLOCS PRÊTS À POSER
     =================================================================== */

  function buildBlock(kind) {
    var d = doc, W = d.w, H = d.h, pad = W * 0.07, y = H * 0.42, out = [];
    if (kind === 'bandeau') out = bandeau(d, y, 'SAMEDI 00 — 19H00', { bind: 'match.date', name: 'Bandeau' });
    else if (kind === 'carteScore') {
      var card = makeShape(d, 'rect', { x: pad, y: y, w: W - pad * 2, h: H * 0.22, radius: W * 0.045 });
      card.fill = { type: 'solid', color: color(d.palette.accent, 1) };
      card.name = 'Carte de score';
      var sc = makeText(d, 'chiffre', '00 – 00', { x: pad, y: y + H * 0.03, w: W - pad * 2, colHex: d.palette.bg, bind: 'resultat.score' });
      sc.ts.size = Math.round(W * 0.17); sc.ts.align = 'center'; sc.name = 'Score'; syncTextBox(sc);
      out = [card, sc];
    } else if (kind === 'duoLogos') {
      var a = makeFrame(d, { x: W * 0.10, y: y, w: W * 0.30, h: W * 0.30, slot: 'logoClub', mask: 'ellipse' });
      a.fit = 'contain'; a.name = 'Logo Baobabs';
      var b = makeFrame(d, { x: W * 0.60, y: y, w: W * 0.30, h: W * 0.30, slot: 'logoAdv', mask: 'ellipse' });
      b.fit = 'contain'; b.name = 'Logo adversaire';
      var vs = makeText(d, 'assommoir', 'VS', { x: W * 0.38, y: y + W * 0.09, w: W * 0.24, colHex: d.palette.accent });
      vs.ts.size = Math.round(W * 0.10); vs.ts.align = 'center'; vs.name = 'VS'; syncTextBox(vs);
      out = [a, b, vs];
    } else if (kind === 'infoDouble') {
      var l1 = makeText(d, 'mention', 'DATE', { x: pad, y: y, w: (W - pad * 2) / 2 - 10, colHex: d.palette.fg2 });
      l1.name = 'Libellé date'; syncTextBox(l1);
      var v1 = makeText(d, 'donnee', 'SAMEDI 00', { x: pad, y: y + W * 0.035, w: (W - pad * 2) / 2 - 10, bind: 'match.date' });
      v1.name = 'Date'; syncTextBox(v1);
      var l2 = makeText(d, 'mention', 'LIEU', { x: W / 2 + 5, y: y, w: (W - pad * 2) / 2 - 10, colHex: d.palette.fg2 });
      l2.name = 'Libellé lieu'; syncTextBox(l2);
      var v2 = makeText(d, 'donnee', 'STADIUM MARIUS NDIAYE', { x: W / 2 + 5, y: y + W * 0.035, w: (W - pad * 2) / 2 - 10, bind: 'match.lieu' });
      v2.name = 'Salle'; syncTextBox(v2);
      out = [l1, v1, l2, v2];
    } else if (kind === 'cadrePhoto') {
      out = [makeFrame(d, { x: W * 0.15, y: y, w: W * 0.7, h: W * 0.7 })];
    }
    return out;
  }

  /* ===================================================================
     32. ACTIONS NOMMÉES
     ---------------------------------------------------------------
     Tout bouton visible porte un data-act et passe par ici. Si un nom
     n existe pas, on le dit à voix haute plutôt que de ne rien faire :
     un bouton muet coûte plus cher qu un bouton absent.
     =================================================================== */

  function runAction(name, el, ev) {
    var l = selOne();
    switch (name) {

      /* --- modèles --- */
      case 'tplCat': panelFilter.tpl = el.getAttribute('data-cat'); renderPanel(); return;
      case 'tplSearch': panelFilter.q = el.value; refocusSearch = true; renderPanel(); return;
      case 'applyTpl': applyTemplate(el.getAttribute('data-id')); return;

      /* --- images --- */
      case 'imgSearch': panelFilter.q = el.value; refocusSearch = true; renderPanel(); return;
      case 'useImage': placeImage(el.getAttribute('data-url')); return;
      case 'uploadImage': pendingFrame = l && (l.type === 'image' || l.type === 'frame') ? l.id : null; els.file.click(); return;
      case 'pickImage': openPanel('images'); toast('Choisissez une image dans le panneau'); return;
      case 'clearImage':
        if (!l) return;
        change(function () { l.src = ''; l._fromSlot = false; });
        return;
      case 'cropImage':
        if (!l || !l.src) return;
        contentEdit = l.id; requestDraw();
        toast('Glissez l image dans son cadre — molette pour zoomer, Échap pour sortir');
        return;
      case 'refreshSlot':
        if (!l) return;
        change(function () { var s = slotSource(l.slot); if (s) { l.src = s; l._fromSlot = true; getImage(s); } });
        imagesReady().then(requestDraw);
        toast('Image rechargée');
        return;

      /* --- éléments --- */
      case 'addShape': insertLayers([makeShape(doc, el.getAttribute('data-shape'), centeredBox(0.34, 0.34))]); return;
      case 'addIcon': { var ic = makeIcon(doc, el.getAttribute('data-icon')); if (ic) insertLayers([ic]); return; }
      case 'swapIcon': {
        if (!l || l.type !== 'icon') return;
        var want = el.getAttribute('data-icon'), found = null;
        for (var q = 0; q < ICONS_LIB.length; q++) if (ICONS_LIB[q].id === want) found = ICONS_LIB[q];
        if (!found) return;
        change(function () { l.d = found.d; l.name = found.label; });
        return;
      }
      case 'clearRules':
        if (!doc.rules || !doc.rules.length) { toast('Aucun repère à effacer'); return; }
        change(function () { doc.rules = []; });
        toast('Repères effacés');
        return;
      case 'toggleFav': {
        var tid = el.getAttribute('data-id');
        var k = favoris.indexOf(tid);
        if (k >= 0) favoris.splice(k, 1); else favoris.push(tid);
        renderPanel();
        return;
      }
      case 'addBlock': insertLayers(buildBlock(el.getAttribute('data-block'))); return;
      case 'tool': setTool(el.getAttribute('data-tool')); return;
      case 'nodeTool': setTool('node'); return;

      /* --- texte --- */
      case 'addText': {
        var t = makeText(doc, el.getAttribute('data-role'), roleSample(el.getAttribute('data-role')), centeredBox(0.8, null));
        syncTextBox(t);
        t.y = Math.round(doc.h / 2 - t.h / 2);
        insertLayers([t]);
        return;
      }
      case 'setText':
        if (!l || l.type !== 'text') return;
        change(function () { setPlainText(l, el.value); l.bindBroken = !!l.bind; syncTextBox(l); });
        return;
      case 'selAll':
        if (l && edit) { edit.a = 0; edit.b = textLen(l); renderProps(); requestDraw(); }
        return;

      /* --- données --- */
      case 'reloadData':
        toast('Rechargement…');
        loadData().then(function () {
          var n = applyBindings(true);
          renderPanel();
          toast(n ? n + ' élément(s) mis à jour' : 'Données rechargées');
        });
        return;
      case 'addBound': {
        var bid = el.getAttribute('data-bind');
        var v = resolveBinding(bid);
        var role = /numero|score|jours/.test(bid) ? 'chiffre' : (/affiche|issue|nom$/.test(bid) ? 'assommoir' : 'donnee');
        var tb = makeText(doc, role, String(v || bindLabel(bid).toUpperCase()), centeredBox(0.86, null));
        tb.bind = bid;
        tb.name = bindLabel(bid);
        tb.ts.align = 'center';
        syncTextBox(tb);
        tb.y = Math.round(doc.h / 2 - tb.h / 2);
        insertLayers([tb]);
        return;
      }
      case 'pickJoueuse':
        data.joueuseIdx = num(el.getAttribute('data-i'), 0);
        syncJoueuse();
        change(function () { applyBindings(true); });
        renderPanel();
        return;
      case 'unbind':
        if (!l) return;
        change(function () { l.bind = null; l.bindBroken = false; });
        toast('Liaison retirée — le texte est désormais libre');
        return;
      case 'refreshBind':
        if (!l) return;
        change(function () {
          var v = resolveBinding(l.bind);
          if (v === '' || v == null) { toast('Cette donnée est vide en base', true); return; }
          setPlainText(l, String(v)); l.bindBroken = false; syncTextBox(l);
        });
        return;

      /* --- styles --- */
      case 'palette': applyPalette(el.getAttribute('data-id')); return;
      case 'bgPreset': bgPreset(el.getAttribute('data-k')); return;
      case 'fxPreset': fxPreset(el.getAttribute('data-k')); return;

      /* --- calque --- */
      case 'dup': duplicateSelected(); return;
      case 'del': removeSelected(); return;
      case 'group': groupSelected(); return;
      case 'center':
        if (!sel.length) return;
        change(function () {
          var ls = selectedLayers(), b = bboxOf(ls);
          var dx = (doc.w - b.w) / 2 - b.x, dy = (doc.h - b.h) / 2 - b.y;
          ls.forEach(function (x) { shiftLayer(x, Math.round(dx), Math.round(dy)); });
        });
        return;
      case 'align': doAlign(el.getAttribute('data-align')); return;
      case 'flipH': if (l) change(function () { l.flipH = !l.flipH; }); return;
      case 'flipV': if (l) change(function () { l.flipV = !l.flipV; }); return;
      case 'toggleVis': if (l) change(function () { l.visible = !l.visible; }); return;
      case 'toggleLock': if (l) change(function () { l.locked = !l.locked; }); return;

      /* --- projets --- */
      case 'saveProject': saveProject(false); return;
      case 'saveAsProject': saveProject(true); return;
      case 'newProject': newProject(); return;
      case 'openProject': openProject(el.getAttribute('data-id')); return;
      case 'dupProject': dupProject(el.getAttribute('data-id')); return;
      case 'delProject': delProject(el.getAttribute('data-id')); return;
    }
    if (runAction2(name, el, ev)) return;
    toast('Action « ' + name + ' » non reconnue', true);
  }

  function roleSample(id) {
    return ({
      assommoir: 'BAOBABS', contour: 'BAOBABS', titre: 'Un titre net',
      soustitre: 'Un sous-titre', surtitre: 'CHAMPIONNAT D2',
      para: 'Écrivez ici le texte de votre affiche.',
      pastille: 'BILLETTERIE', chiffre: '00', donnee: 'SAMEDI 19H00', mention: 'BAOBABSBASKETCLUB.COM'
    })[id] || 'Votre texte';
  }

  function centeredBox(fw, fh) {
    var w = Math.round(doc.w * fw);
    var h = fh ? Math.round(doc.w * fh) : null;
    return {
      x: Math.round((doc.w - w) / 2),
      y: h ? Math.round((doc.h - h) / 2) : Math.round(doc.h * 0.42),
      w: w, h: h || 10
    };
  }

  function insertLayers(list) {
    if (!list || !list.length) return;
    change(function () {
      for (var i = 0; i < list.length; i++) doc.layers.push(list[i]);
      sel = list.map(function (x) { return x.id; });
    });
    imagesReady().then(requestDraw);
  }

  var pendingFrame = null;
  function placeImage(url) {
    if (!url) return;
    var l = selOne();
    getImage(url);
    if (l && (l.type === 'image' || l.type === 'frame')) {
      change(function () { l.src = url; l._fromSlot = false; l.zoom = 1; l.ox = .5; l.oy = .5; });
      imagesReady().then(requestDraw);
      toast('Image placée dans le cadre');
      return;
    }
    var e = getImage(url);
    e.promise.then(function () {
      var iw = e.ok ? e.img.naturalWidth : 1, ih = e.ok ? e.img.naturalHeight : 1;
      var maxW = doc.w * 0.7, s = Math.min(maxW / iw, (doc.h * 0.6) / ih, 1.4);
      var w = Math.round(iw * s), h = Math.round(ih * s);
      var f = makeFrame(doc, { src: url, x: Math.round((doc.w - w) / 2), y: Math.round((doc.h - h) / 2), w: w, h: h });
      f.name = fileName(url);
      insertLayers([f]);
      toast('Image ajoutée');
    });
  }

  function applyPalette(id) {
    var p = null;
    for (var i = 0; i < PALETTES.length; i++) if (PALETTES[i].id === id) p = PALETTES[i];
    if (!p) return;
    var old = clone(doc.palette);
    change(function () {
      doc.palette = { id: p.id, bg: p.bg, accent: p.accent, fg: p.fg, fg2: p.fg2 };
      if (doc.bg.type === 'solid') doc.bg.color = color(p.bg, doc.bg.color.a);
      if (doc.bg.type === 'linear' || doc.bg.type === 'radial') {
        doc.bg.from = color(p.bg, 1); doc.bg.to = color(p.accent, .3);
      }
      /* on remplace les couleurs qui venaient de l ancienne ambiance,
         et seulement celles-là : une couleur choisie à la main reste */
      var map = {};
      map[old.bg.toLowerCase()] = p.bg;
      map[old.accent.toLowerCase()] = p.accent;
      map[old.fg.toLowerCase()] = p.fg;
      map[old.fg2.toLowerCase()] = p.fg2;
      walk(doc.layers, function (l) { repaint(l, map); });
    });
    toast('Ambiance « ' + p.label + ' »');
  }
  function repaint(l, map) {
    function fix(c) {
      if (!c || !c.hex) return c;
      var v = map[c.hex.toLowerCase()];
      if (v) c.hex = v;
      return c;
    }
    if (l.type === 'text') {
      fix(l.ts.color); fix(l.ts.strokeColor);
      for (var i = 0; i < l.runs.length; i++) if (l.runs[i].s) { fix(l.runs[i].s.color); fix(l.runs[i].s.strokeColor); }
    }
    if (l.fill) { fix(l.fill.color); fix(l.fill.from); fix(l.fill.to); }
    if (l.stroke) fix(l.stroke.color);
    if (l.fx) fix(l.fx.tint);
    if (l.shadow) fix(l.shadow.color);
  }

  function bgPreset(k) {
    change(function () {
      var p = doc.palette;
      if (k === 'uni') doc.bg = { type: 'solid', color: color(p.bg, 1), from: color(p.bg, 1), to: color(p.accent, .3), angle: 120 };
      else if (k === 'degrade') doc.bg = { type: 'linear', color: color(p.bg, 1), from: color(p.bg, 1), to: color(p.accent, .35), angle: 120 };
      else if (k === 'halo') doc.bg = { type: 'radial', color: color(p.bg, 1), from: color(p.accent, .3), to: color(p.bg, 1), angle: 90 };
      else if (k === 'photo') {
        var f = makeFrame(doc, { x: 0, y: 0, w: doc.w, h: doc.h, slot: 'photoMatch' });
        f.fx.veil = 0.4; f.name = 'Photo de fond';
        var s = slotSource('photoMatch');
        if (s) { f.src = s; f._fromSlot = true; getImage(s); }
        doc.layers.unshift(f);
        sel = [f.id];
      }
    });
    if (k === 'photo') imagesReady().then(requestDraw);
  }

  function fxPreset(k) {
    var ls = selectedLayers();
    if (!ls.length) { toast('Sélectionnez d abord un calque', true); return; }
    change(function () {
      ls.forEach(function (l) {
        if (k === 'ombre') l.shadow = { on: true, x: 0, y: Math.round(doc.w * 0.012), blur: Math.round(doc.w * 0.03), color: color('#000000', .5) };
        else if (k === 'contour' && l.type === 'text') { l.ts.hollow = true; l.ts.strokeW = Math.max(2, Math.round(doc.w * 0.0035)); }
        else if (k === 'bichro' && (l.type === 'image' || l.type === 'frame')) {
          l.fx = l.fx || {};
          l.fx.gray = 100; l.fx.contrast = 18;
          l.fx.tint = color(doc.palette.accent, 1); l.fx.tintAmt = 0.42;
        } else if (k === 'reset') {
          l.shadow = null;
          if (l.type === 'text') { l.ts.hollow = false; l.ts.strokeW = 0; }
          if (l.fx) l.fx = { bright: 0, contrast: 0, sat: 0, gray: 0, blur: 0, tint: color(doc.palette.accent, 1), tintAmt: 0, veil: 0 };
        }
      });
    });
    toast('Effet appliqué');
  }

  function doAlign(mode) {
    var ls = selectedLayers();
    if (!ls.length) return;
    change(function () {
      var ref = ls.length > 1 ? bboxOf(ls) : { x: 0, y: 0, w: doc.w, h: doc.h };
      var sorted, i, gap, cur;
      if (mode === 'dh' || mode === 'dv') {
        if (ls.length < 3) { toast('Il faut au moins trois calques pour répartir', true); return; }
        sorted = ls.slice().sort(function (a, b) {
          return mode === 'dh' ? bboxOf([a]).x - bboxOf([b]).x : bboxOf([a]).y - bboxOf([b]).y;
        });
        var first = bboxOf([sorted[0]]), last = bboxOf([sorted[sorted.length - 1]]);
        var total = 0;
        for (i = 1; i < sorted.length - 1; i++) total += mode === 'dh' ? bboxOf([sorted[i]]).w : bboxOf([sorted[i]]).h;
        var span = mode === 'dh' ? (last.x - (first.x + first.w)) : (last.y - (first.y + first.h));
        gap = (span - total) / (sorted.length - 1);
        cur = mode === 'dh' ? first.x + first.w + gap : first.y + first.h + gap;
        for (i = 1; i < sorted.length - 1; i++) {
          var bb = bboxOf([sorted[i]]);
          if (mode === 'dh') { shiftLayer(sorted[i], Math.round(cur - bb.x), 0); cur += bb.w + gap; }
          else { shiftLayer(sorted[i], 0, Math.round(cur - bb.y)); cur += bb.h + gap; }
        }
        return;
      }
      ls.forEach(function (l) {
        var b = bboxOf([l]), dx = 0, dy = 0;
        if (mode === 'left') dx = ref.x - b.x;
        else if (mode === 'right') dx = (ref.x + ref.w) - (b.x + b.w);
        else if (mode === 'hcenter') dx = (ref.x + ref.w / 2) - (b.x + b.w / 2);
        else if (mode === 'top') dy = ref.y - b.y;
        else if (mode === 'bottom') dy = (ref.y + ref.h) - (b.y + b.h);
        else if (mode === 'vcenter') dy = (ref.y + ref.h / 2) - (b.y + b.h / 2);
        shiftLayer(l, Math.round(dx), Math.round(dy));
      });
    });
  }

  /* ===================================================================
     33. CHANGEMENT DE FORMAT
     ---------------------------------------------------------------
     On ne se contente pas de changer les bornes : on remet la
     composition à l échelle, sinon changer de format vide l affiche
     de la moitié de son contenu.
     =================================================================== */

  function setFormat(id) {
    var f = formatById(id);
    if (!f) return;
    if (doc.w === f.w && doc.h === f.h) { change(function () { doc.format = f.id; }); return; }
    change(function () { scaleDocToFormat(id); });
    fitView();
    toast('Format ' + f.label);
  }

  /* Mise à l'échelle de toute la composition. Sans elle, passer d'une
     story à un carré rejette la moitié des calques hors du cadre. */
  function scaleDocToFormat(id) {
    var f = formatById(id);
    if (!f || (doc.w === f.w && doc.h === f.h)) { doc.format = f.id; return; }
    var s = Math.min(f.w / doc.w, f.h / doc.h);
    var offX = (f.w - doc.w * s) / 2, offY = (f.h - doc.h * s) / 2;
    for (var i = 0; i < doc.layers.length; i++) {
      scaleLayer(doc.layers[i], s, s, 0, 0);
      shiftLayer(doc.layers[i], offX, offY);
    }
    walk(doc.layers, function (l) { if (l.type === 'group') reflowGroup(l); });
    doc.format = f.id; doc.w = f.w; doc.h = f.h;
    if (els.format) els.format.value = f.id;
  }

  function syncFormatSelect() {
    if (!els.format) return;
    els.format.innerHTML = FORMATS.map(function (f) {
      return '<option value="' + f.id + '"' + (f.id === doc.format ? ' selected' : '') + '>' + esc(f.label) + '</option>';
    }).join('');
  }

  /* ===================================================================
     34. EXPORT
     ---------------------------------------------------------------
     Le même renderDoc que l aperçu, mais sur un canevas à la taille
     réelle du format. Il n y a rien à « convertir » : pas de DOM à
     photographier, donc pas d effet qui disparaît entre l écran et le
     fichier.
     =================================================================== */

  function renderToCanvas(scale) {
    var cv = document.createElement('canvas');
    cv.width = Math.round(doc.w * scale);
    cv.height = Math.round(doc.h * scale);
    var ctx = cv.getContext('2d');
    ctx.scale(scale, scale);
    renderDoc(ctx, doc, { forExport: true });
    return cv;
  }

  function anyTainted() {
    for (var k in imgCache) if (imgCache[k].tainted) return true;
    return false;
  }

  function exportBlob(scale, type, quality) {
    return imagesReady().then(function () {
      var cv = renderToCanvas(scale);
      return new Promise(function (res, rej) {
        try {
          cv.toBlob(function (b) { b ? res(b) : rej(new Error('blob')); }, type || 'image/png', quality);
        } catch (e) { rej(e); }
      });
    });
  }

  function openExport() {
    var f = formatById(doc.format);
    var rows = [1, 2, 3].map(function (s) {
      return '<button type="button" class="bs-item" data-act="doExport" data-s="' + s + '">' +
        '<span class="bs-item-txt"><b>' + (s === 1 ? 'Taille réelle' : (s === 2 ? 'Haute définition ×2' : 'Très haute définition ×3')) + '</b>' +
        '<small>' + (doc.w * s) + ' × ' + (doc.h * s) + ' px · PNG</small></span></button>';
    }).join('');
    modal('Exporter l affiche',
      '<div class="bs-list" style="padding:0">' + rows +
      '<button type="button" class="bs-item" data-act="doExportJpg" data-s="2">' +
      '<span class="bs-item-txt"><b>JPEG allégé ×2</b><small>' + (doc.w * 2) + ' × ' + (doc.h * 2) + ' px · fichier plus léger</small></span></button>' +
      '<button type="button" class="bs-item" data-act="doExportJson">' +
      '<span class="bs-item-txt"><b>Fichier de projet (.json)</b><small>Pour ré-ouvrir l affiche plus tard, calques compris</small></span></button>' +
      '</div>' +
      (anyTainted()
        ? '<div class="bs-note" style="margin:12px 0 0;background:rgba(255,184,77,.08);border-color:rgba(255,184,77,.28)"><b>Attention.</b> Une image ne s est pas chargée avec les autorisations nécessaires : l export risque d échouer. Téléversez-la dans la médiathèque pour régler le problème.</div>'
        : ''),
      '<button type="button" class="bs-btn bs-btn-ghost" data-act="closeModal">Fermer</button>');
  }

  function doExport(scale, type) {
    closeModal();
    toast('Préparation de l image…');
    var ext = type === 'image/jpeg' ? 'jpg' : 'png';
    exportBlob(scale, type || 'image/png', type === 'image/jpeg' ? 0.92 : undefined).then(function (blob) {
      var name = slug(doc.name || 'affiche') + '-' + doc.format + '-' + today() + '.' + ext;
      if (api && api.download) api.download(blob, name);
      else downloadBlob(blob, name);
      toast('Exporté en ' + Math.round(doc.w * scale) + ' × ' + Math.round(doc.h * scale), false, true);
    }).catch(function () {
      toast('Export impossible — une image distante bloque la copie du canevas', true);
    });
  }
  function downloadBlob(blob, name) {
    var u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 5000);
  }
  function exportJson() {
    closeModal();
    var blob = new Blob([serialize(doc)], { type: 'application/json' });
    downloadBlob(blob, slug(doc.name || 'affiche') + '.baobabs.json');
    toast('Projet exporté', false, true);
  }
  function slug(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'affiche';
  }
  function today() {
    if (api && api.today) { try { return api.today(); } catch (e) {} }
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function publish() {
    if (!api || !api.uploadImage) { toast('L envoi n est pas disponible ici', true); return; }
    toast('Envoi dans la médiathèque…');
    exportBlob(2, 'image/png').then(function (blob) {
      var name = slug(doc.name || 'affiche') + '-' + today() + '.png';
      var file = new File([blob], name, { type: 'image/png' });
      return api.uploadImage(file);
    }).then(function (url) {
      if (!url) throw new Error('upload');
      medias.unshift({ url: url, nom: doc.name || 'Affiche' });
      if (panelName === 'images') renderPanel();
      toast('Affiche envoyée dans la médiathèque', false, true);
    }).catch(function () { toast('Envoi impossible', true); });
  }

  /* ===================================================================
     35. PROJETS
     =================================================================== */

  var memProjects = [];      /* repli si l hôte ne fournit pas de stockage */
  var hasStore = false;

  function store() { return (api && api.projects) ? api.projects : null; }

  function loadProjects() {
    var s = store();
    hasStore = !!s;
    if (!s) { projectList = memProjects; return Promise.resolve(); }
    return Promise.resolve(s.list()).then(function (r) {
      projectList = (r || []).map(function (p) {
        if (typeof p.doc === 'string') { try { p.doc = JSON.parse(p.doc); } catch (e) { p.doc = null; } }
        return p;
      }).filter(function (p) { return p.doc; });
    }).catch(function () { projectList = []; });
  }

  function saveProject(asCopy) {
    doc.name = (els.projName.value || 'Sans titre').trim().slice(0, 80);
    doc.updated = new Date().toISOString();
    var rec = {
      id: asCopy ? null : project.id,
      nom: doc.name,
      format: doc.format,
      est_modele: project.isTemplate,
      doc: JSON.parse(serialize(doc)),
      modifie_le: doc.updated
    };
    var s = store();
    var p;
    if (s) p = Promise.resolve(s.save(rec));
    else {
      rec.id = rec.id || uid('p');
      var i = memProjects.findIndex(function (x) { return x.id === rec.id; });
      if (i >= 0) memProjects[i] = rec; else memProjects.unshift(rec);
      p = Promise.resolve(rec);
    }
    return p.then(function (saved) {
      project.id = (saved && saved.id) || rec.id;
      project.savedAt = new Date();
      markDirty(false);
      els.saveInfo.textContent = 'Enregistré à ' + project.savedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      return loadProjects();
    }).then(function () {
      if (panelName === 'projets') renderPanel();
      toast(asCopy ? 'Copie enregistrée' : 'Projet enregistré', false, true);
    }).catch(function () { toast('Enregistrement impossible', true); });
  }

  function openProject(id) {
    var p = null;
    for (var i = 0; i < projectList.length; i++) if (String(projectList[i].id) === String(id)) p = projectList[i];
    if (!p || !p.doc) { toast('Projet introuvable', true); return; }
    confirmIfDirty(function () {
      doc = clone(p.doc);
      project.id = p.est_modele ? null : p.id;      /* ouvrir un modèle crée un nouveau projet */
      project.isTemplate = false;
      if (p.est_modele) doc.name = doc.name + ' — copie';
      sel = []; hist.undo.length = 0; hist.redo.length = 0; hist.pre = null;
      els.projName.value = doc.name || 'Sans titre';
      syncFormatSelect();
      prewarmImages();
      applyBindings();
      fitView();
      markDirty(false);
      els.saveInfo.textContent = p.est_modele ? 'Copie d un modèle' : 'Ouvert';
      renderPanel();
      toast('« ' + (p.nom || 'Projet') + ' » ouvert');
    });
  }

  function dupProject(id) {
    var p = null;
    for (var i = 0; i < projectList.length; i++) if (String(projectList[i].id) === String(id)) p = projectList[i];
    if (!p) return;
    var rec = { id: null, nom: (p.nom || 'Projet') + ' — copie', format: p.format, est_modele: p.est_modele, doc: clone(p.doc), modifie_le: new Date().toISOString() };
    var s = store();
    var pr = s ? Promise.resolve(s.save(rec)) : (function () { rec.id = uid('p'); memProjects.unshift(rec); return Promise.resolve(rec); })();
    pr.then(loadProjects).then(function () { renderPanel(); toast('Projet dupliqué', false, true); })
      .catch(function () { toast('Duplication impossible', true); });
  }

  function delProject(id) {
    var p = null;
    for (var i = 0; i < projectList.length; i++) if (String(projectList[i].id) === String(id)) p = projectList[i];
    if (!p) return;
    modal('Supprimer « ' + (p.nom || 'Projet') + ' » ?',
      '<p style="font-size:12.5px;color:var(--bs-fg-2);line-height:1.6">Cette affiche et tous ses calques seront perdus. Les images de la médiathèque ne sont pas touchées.</p>',
      '<button type="button" class="bs-btn bs-btn-ghost" data-act="closeModal">Annuler</button>' +
      '<button type="button" class="bs-btn bs-btn-accent" data-act="delProjectOk" data-id="' + esc(id) + '">Supprimer</button>');
  }
  function delProjectConfirmed(id) {
    closeModal();
    var s = store();
    var pr = s ? Promise.resolve(s.remove(id)) : (function () {
      memProjects = memProjects.filter(function (x) { return String(x.id) !== String(id); });
      return Promise.resolve();
    })();
    pr.then(loadProjects).then(function () {
      if (String(project.id) === String(id)) { project.id = null; markDirty(true); }
      renderPanel();
      toast('Projet supprimé');
    }).catch(function () { toast('Suppression impossible', true); });
  }

  function newProject() {
    confirmIfDirty(function () {
      doc = newDoc('affiche', 'nuit');
      applyTemplateInto(doc, 'md-duel-maquette');
      project.id = null; project.isTemplate = false;
      sel = []; hist.undo.length = 0; hist.redo.length = 0; hist.pre = null;
      els.projName.value = doc.name;
      syncFormatSelect();
      applyBindings();
      fitView();
      markDirty(false);
      els.saveInfo.textContent = 'Jamais enregistré';
      renderPanel();
      toast('Nouveau projet');
    });
  }
  function applyTemplateInto(d, id) {
    var t = templateById(id);
    if (!t) return;
    var nd = newDoc(d.format, t.pal);
    d.bg = nd.bg; d.palette = nd.palette;
    d.layers = t.build(d) || [];
  }

  function confirmIfDirty(fn) {
    if (!dirty) { fn(); return; }
    modal('Modifications non enregistrées',
      '<p style="font-size:12.5px;color:var(--bs-fg-2);line-height:1.6">Ce projet a changé depuis le dernier enregistrement. Que faire ?</p>',
      '<button type="button" class="bs-btn bs-btn-ghost" data-act="closeModal">Annuler</button>' +
      '<button type="button" class="bs-btn bs-btn-ghost" data-act="discardGo">Continuer sans enregistrer</button>' +
      '<button type="button" class="bs-btn bs-btn-accent" data-act="saveThenGo">Enregistrer puis continuer</button>');
    pendingNav = fn;
  }
  var pendingNav = null;

  function prewarmImages() {
    walk(doc.layers, function (l) { if ((l.type === 'image' || l.type === 'frame') && l.src) getImage(l.src); });
    imagesReady().then(requestDraw);
  }

  /* ===================================================================
     36. MODALE, BANDEAU, MENU CONTEXTUEL
     =================================================================== */

  function modal(title, body, footer) {
    els.modalCard.innerHTML =
      '<div class="bs-mh"><b>' + esc(title) + '</b>' +
      '<button type="button" class="bs-ico" data-act="closeModal" aria-label="Fermer">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>' +
      '<div class="bs-mb">' + body + '</div>' +
      (footer ? '<div class="bs-mf">' + footer + '</div>' : '');
    els.modal.classList.add('is-on');
    els.modal.setAttribute('aria-hidden', 'false');
    wireFields(els.modalCard);
  }
  function closeModal() {
    els.modal.classList.remove('is-on');
    els.modal.setAttribute('aria-hidden', 'true');
    els.modalCard.innerHTML = '';
    pendingNav = null;
  }

  var toastT = null;
  function toast(msg, isErr, isOk) {
    if (api && api.toast && isErr) { try { api.toast(msg, true); } catch (e) {} }
    els.toast.textContent = msg;
    els.toast.className = 'bs-toast is-on' + (isErr ? ' is-err' : (isOk ? ' is-ok' : ''));
    clearTimeout(toastT);
    toastT = setTimeout(function () { els.toast.classList.remove('is-on'); }, isErr ? 4200 : 2200);
  }

  function contextMenu(x, y) {
    var l = selOne(), n = sel.length;
    var it = function (act, label, kbd, danger) {
      return '<button type="button" data-act="' + act + '"' + (danger ? ' class="bs-ctx-danger"' : '') + '>' +
        esc(label) + (kbd ? '<kbd>' + esc(kbd) + '</kbd>' : '') + '</button>';
    };
    var h = '';
    if (n) {
      h += it('dup', 'Dupliquer', 'Ctrl D');
      h += it('ctxFront', 'Mettre au premier plan', 'Ctrl ⇧ ]');
      h += it('ctxUp', 'Monter', 'Ctrl ]');
      h += it('ctxDown', 'Descendre', 'Ctrl [');
      h += it('ctxBack', 'Mettre à l arrière-plan', 'Ctrl ⇧ [');
      h += '<hr>';
      if (l && l.type === 'text') h += it('ctxEdit', 'Modifier le texte', 'Entrée');
      if (l && (l.type === 'image' || l.type === 'frame') && l.src) h += it('cropImage', 'Recadrer l image');
      if (l && l.type === 'path') h += it('nodeTool', 'Modifier les points', 'A');
      h += it('group', (l && l.type === 'group') ? 'Dissoudre le groupe' : 'Grouper', 'Ctrl G');
      h += it('toggleLock', (l && l.locked) ? 'Déverrouiller' : 'Verrouiller');
      h += it('toggleVis', (l && !l.visible) ? 'Afficher' : 'Masquer');
      h += '<hr>';
      h += it('del', 'Supprimer', 'Suppr', true);
    } else {
      h += it('ctxPaste', 'Coller', 'Ctrl V');
      h += it('ctxSelAll', 'Tout sélectionner', 'Ctrl A');
      h += '<hr>';
      h += it('zoomFit', 'Ajuster à l écran', 'Ctrl 0');
    }
    els.ctx.innerHTML = h;
    els.ctx.classList.add('is-on');
    var r = els.ctx.getBoundingClientRect();
    els.ctx.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px';
    els.ctx.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
    $$('button', els.ctx).forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-act');
        closeCtx();
        ctxAction(a);
      });
    });
  }
  function closeCtx() { els.ctx.classList.remove('is-on'); }
  function ctxAction(a) {
    var l = selOne();
    if (a === 'ctxFront' && l) return sendTo(l.id, 'front');
    if (a === 'ctxBack' && l) return sendTo(l.id, 'back');
    if (a === 'ctxUp' && l) return moveLayerOrder(l.id, 1);
    if (a === 'ctxDown' && l) return moveLayerOrder(l.id, -1);
    if (a === 'ctxEdit' && l) return enterTextEdit(l, 0, textLen(l));
    if (a === 'ctxPaste') return pasteLayers();
    if (a === 'ctxSelAll') return selectAll();
    if (a === 'zoomFit') return fitView();
    runAction(a, { getAttribute: function () { return null; } });
  }

  /* ===================================================================
     37. PRESSE-PAPIERS DE CALQUES
     =================================================================== */

  var clipboard = null;
  function copyLayers(cut) {
    var ls = selectedLayers();
    if (!ls.length) return;
    clipboard = ls.map(function (l) { return clone(l); });
    if (cut) removeSelected();
    else toast(ls.length + ' calque(s) copié(s)');
  }
  function pasteLayers() {
    if (!clipboard || !clipboard.length) { toast('Rien à coller'); return; }
    var ids = [];
    change(function () {
      var off = Math.round(doc.w * 0.03);
      clipboard.forEach(function (c) {
        var n = reid(clone(c));
        shiftLayer(n, off, off);
        doc.layers.push(n);
        ids.push(n.id);
      });
      sel = ids;
    });
    prewarmImages();
    toast(ids.length + ' calque(s) collé(s)');
  }
  function selectAll() {
    select(doc.layers.filter(function (l) { return l.visible && !l.locked; }).map(function (l) { return l.id; }));
  }

  /* ===================================================================
     38. OUTILS
     =================================================================== */

  function setTool(t) {
    if (pathDraft && t !== 'pen') commitPath(false);
    tool = t;
    $$('.bs-tool', root).forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-tool') === t); });
    if (t !== 'select' && t !== 'node' && edit) exitTextEdit();
    if (t !== 'select') contentEdit = null;
    setCursor(t === 'hand' ? 'hand' : (t === 'text' ? 'text' : (t === 'zoom' ? 'zoom-in' : (t === 'select' || t === 'node' ? 'select' : 'cross'))));
    requestDraw();
  }

  /* ===================================================================
     39. CLAVIER
     =================================================================== */

  function onKeyDown(e) {
    if (!opened) return;
    var t = e.target;
    var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) && t !== els.ime;
    var mod = e.ctrlKey || e.metaKey;

    if (els.modal.classList.contains('is-on')) {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
      return;
    }
    if (typing) {
      if (e.key === 'Escape') t.blur();
      return;
    }

    /* --- édition de texte : le clavier lui appartient --- */
    if (edit) {
      if (e.key === 'Escape') { e.preventDefault(); exitTextEdit(); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); moveCaret(-1, 0, e.shiftKey); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); moveCaret(1, 0, e.shiftKey); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); moveCaret(0, -1, e.shiftKey); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); moveCaret(0, 1, e.shiftKey); return; }
      if (e.key === 'Home') { e.preventDefault(); caretHome(false, e.shiftKey); return; }
      if (e.key === 'End') { e.preventDefault(); caretHome(true, e.shiftKey); return; }
      if (e.key === 'Backspace') { e.preventDefault(); deleteRange(-1); return; }
      if (e.key === 'Delete') { e.preventDefault(); deleteRange(1); return; }
      if (e.key === 'Enter') { e.preventDefault(); insertText('\n'); return; }
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        var el = editLayer();
        if (el) { edit.a = 0; edit.b = textLen(el); renderProps(); requestDraw(); }
        return;
      }
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); exitTextEdit(); e.shiftKey ? redo() : undo(); return; }
      if (mod) return;                      /* copier/coller géré par le textarea */
      return;
    }

    /* --- espace = main temporaire --- */
    if (e.code === 'Space' && !toolBeforeSpace) {
      e.preventDefault();
      toolBeforeSpace = tool;
      setCursor('hand');
      return;
    }

    if (mod) {
      var k = e.key.toLowerCase();
      /* Ctrl+Alt+G : masque d'écrêtage, comme dans Photoshop */
      if (e.altKey && k === 'g') {
        e.preventDefault();
        var cl = selectedLayers();
        if (!cl.length) return;
        change(function () { var on = !cl[0].clip; cl.forEach(function (x) { x.clip = on; }); });
        toast(cl[0].clip ? 'Écrêté par le calque du dessous' : 'Masque d écrêtage retiré');
        return;
      }
      if (k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (k === 'y') { e.preventDefault(); redo(); return; }
      if (k === 'd') { e.preventDefault(); duplicateSelected(); return; }
      if (k === 'g') { e.preventDefault(); groupSelected(); return; }
      if (k === 'a') { e.preventDefault(); selectAll(); return; }
      if (k === 's') { e.preventDefault(); saveProject(false); return; }
      if (k === 'c') { e.preventDefault(); copyLayers(false); return; }
      if (k === 'x') { e.preventDefault(); copyLayers(true); return; }
      if (k === 'v') { e.preventDefault(); pasteLayers(); return; }
      if (k === 'e') { e.preventDefault(); openExport(); return; }
      if (e.key === ']') { e.preventDefault(); var a = selOne(); if (a) e.shiftKey ? sendTo(a.id, 'front') : moveLayerOrder(a.id, 1); return; }
      if (e.key === '[') { e.preventDefault(); var b = selOne(); if (b) e.shiftKey ? sendTo(b.id, 'back') : moveLayerOrder(b.id, -1); return; }
      if (e.key === '0') { e.preventDefault(); fitView(); return; }
      if (e.key === '1') { e.preventDefault(); setZoom(1); return; }
      if (e.key === '2') { e.preventDefault(); zoomToSelection(); return; }
      if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomStep(1); return; }
      if (e.key === '-') { e.preventDefault(); zoomStep(-1); return; }
      if (e.key === "'") { e.preventDefault(); toggleFlag('grid'); return; }
      return;
    }

    /* opacité au clavier, réflexe Photoshop : 5 = 50 %, 0 = 100 % */
    if (/^[0-9]$/.test(e.key) && sel.length && !e.altKey) {
      e.preventDefault();
      var v = e.key === '0' ? 1 : parseInt(e.key, 10) / 10;
      var ls2 = selectedLayers();
      change(function () { ls2.forEach(function (x) { x.opacity = v; }); });
      toast('Opacité ' + Math.round(v * 100) + ' %');
      return;
    }
    if (e.key === 'P') { e.preventDefault(); togglePreview(); return; }

    /* --- outils --- */
    var tools = { v: 'select', a: 'node', h: 'hand', z: 'zoom', t: 'text', p: 'pen', r: 'rect', o: 'ellipse', l: 'line', f: 'frame', i: 'eyedrop' };
    if (tools[e.key.toLowerCase()] && !e.altKey && !e.shiftKey) { e.preventDefault(); setTool(tools[e.key.toLowerCase()]); return; }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (pathDraft) { commitPath(false); return; }
      if (contentEdit) { contentEdit = null; requestDraw(); return; }
      if (els.ctx.classList.contains('is-on')) { closeCtx(); return; }
      if (sel.length) { select([]); return; }
      close();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (pathDraft) { commitPath(false); return; }
      var s = selOne();
      if (s && s.type === 'text') enterTextEdit(s, 0, textLen(s));
      else if (s && (s.type === 'image' || s.type === 'frame') && s.src) { contentEdit = s.id; requestDraw(); }
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected(); return; }
    if (e.key === '?') { e.preventDefault(); showHelp(); return; }

    /* --- flèches --- */
    if (/^Arrow/.test(e.key)) {
      e.preventDefault();
      var ls = selectedLayers().filter(function (x) { return !x.locked; });
      if (!ls.length) return;
      var step = e.shiftKey ? 10 : 1;
      var dx = e.key === 'ArrowLeft' ? -step : (e.key === 'ArrowRight' ? step : 0);
      var dy = e.key === 'ArrowUp' ? -step : (e.key === 'ArrowDown' ? step : 0);
      change(function () { ls.forEach(function (x) { shiftLayer(x, dx, dy); }); });
    }
  }

  function onKeyUp(e) {
    if (e.code === 'Space' && toolBeforeSpace) {
      setCursor(null);
      toolBeforeSpace = null;
      if (drag && drag.kind === 'pan') { drag = null; }
    }
  }

  function toggleFlag(k) {
    flags[k] = !flags[k];
    var m = { grid: els.tglGrid, snap: els.tglSnap, safe: els.tglSafe };
    if (m[k]) m[k].classList.toggle('is-on', flags[k]);
    requestDraw();
  }

  function togglePreview() {
    preview = !preview;
    if (els.tglPreview) els.tglPreview.classList.toggle('is-on', preview);
    if (preview && edit) exitTextEdit();
    if (preview) contentEdit = null;
    requestDraw();
    toast(preview ? 'Aperçu — l affiche seule. Cliquez Aperçu pour revenir.' : 'Retour à l édition');
  }

  /* Reprend le texte de l'affiche pour en faire une légende prête à
     coller sous la publication. */
  function sharePublication() {
    var lignes = [];
    walk(doc.layers, function (l) {
      if (l.type === 'text' && l.visible) {
        var t = plainText(l).replace(/\s+/g, ' ').trim();
        if (t && t.length > 2) lignes.push({ t: t, size: l.ts.size, y: l.y });
      }
    });
    lignes.sort(function (a, b) { return a.y - b.y; });
    var titre = lignes.slice().sort(function (a, b) { return b.size - a.size; })[0];
    var corps = lignes.map(function (x) { return x.t; }).filter(function (x, i, arr) { return arr.indexOf(x) === i; });
    var txt = (titre ? titre.t.toUpperCase() + '\n\n' : '') +
      corps.filter(function (x) { return !titre || x !== titre.t; }).join('\n') +
      '\n\n#BaobabsBasketClub #BasketSenegal #Dakar';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt)
        .then(function () { toast('Texte de publication copié', false, true); })
        .catch(function () { showShareText(txt); });
    } else showShareText(txt);
  }
  function showShareText(txt) {
    modal('Texte de publication',
      '<textarea class="bs-in" rows="9" spellcheck="false">' + esc(txt) + '</textarea>' +
      '<div class="bs-note" style="margin:10px 0 0">La copie automatique a été refusée par le navigateur : sélectionnez le texte ci-dessus.</div>',
      '<button type="button" class="bs-btn bs-btn-ghost" data-act="closeModal">Fermer</button>');
  }

  function showHelp() {
    var g = function (title, rows) {
      return '<div><h4>' + esc(title) + '</h4><ul>' + rows.map(function (r) {
        return '<li><span>' + esc(r[0]) + '</span><kbd>' + esc(r[1]) + '</kbd></li>';
      }).join('') + '</ul></div>';
    };
    modal('Raccourcis clavier',
      '<div class="bs-kbd-grid">' +
      g('Outils', [['Sélection', 'V'], ['Points de tracé', 'A'], ['Main', 'H / Espace'], ['Zoom', 'Z'],
        ['Texte', 'T'], ['Plume', 'P'], ['Rectangle', 'R'], ['Ellipse', 'O'], ['Ligne', 'L'],
        ['Cadre photo', 'F'], ['Pipette', 'I']]) +
      g('Édition', [['Annuler', 'Ctrl Z'], ['Rétablir', 'Ctrl ⇧ Z'], ['Dupliquer', 'Ctrl D'],
        ['Copier / Coller', 'Ctrl C / V'], ['Grouper', 'Ctrl G'], ['Tout sélectionner', 'Ctrl A'],
        ['Supprimer', 'Suppr'], ['Enregistrer', 'Ctrl S']]) +
      g('Pile', [['Monter / descendre', 'Ctrl ] / ['], ['Premier / arrière-plan', 'Ctrl ⇧ ] / ['],
        ['Renommer un calque', 'F2 ou double-clic'], ['Masque d écrêtage', 'Ctrl Alt G'],
        ['Opacité 10 % … 100 %', '1 … 9 , 0']]) +
      g('Vue', [['Ajuster', 'Ctrl 0'], ['Taille réelle', 'Ctrl 1'], ['Cadrer la sélection', 'Ctrl 2'],
        ['Zoomer', 'molette, ou Ctrl + / −'], ['Déplacer', 'Espace + glisser, ou Alt + molette'],
        ['Grille', "Ctrl '"], ['Aperçu propre', '⇧ P'], ['Poser un repère', 'tirer depuis la règle']]) +
      g('Objets', [['Déplacer de 1 px', 'Flèches'], ['Déplacer de 10 px', '⇧ Flèches'],
        ['Proportions', '⇧ pendant le redimensionnement'], ['Depuis le centre', 'Alt'],
        ['Dupliquer en glissant', 'Alt + glisser'], ['Angle par 15°', '⇧ pendant la rotation']]) +
      g('Texte', [['Éditer', 'Double-clic ou Entrée'], ['Sélectionner un mot', 'Double-clic'],
        ['Toute la ligne', 'Triple-clic'], ['Étendre la sélection', '⇧ Flèches'],
        ['Colorer des lettres', 'Sélectionner puis choisir la couleur']]) +
      '</div>',
      '<button type="button" class="bs-btn bs-btn-ghost" data-act="closeModal">Fermer</button>');
  }

  /* ===================================================================
     40. ACTIONS DE SECOND NIVEAU
     (export, modale, navigation — appelées par runAction)
     =================================================================== */

  function runAction2(name, el) {
    switch (name) {
      case 'doExport': doExport(num(el.getAttribute('data-s'), 1), 'image/png'); return true;
      case 'doExportJpg': doExport(num(el.getAttribute('data-s'), 2), 'image/jpeg'); return true;
      case 'doExportJson': exportJson(); return true;
      case 'closeModal': closeModal(); return true;
      case 'delProjectOk': delProjectConfirmed(el.getAttribute('data-id')); return true;
      case 'discardGo': { var f = pendingNav; closeModal(); markDirty(false); if (f) f(); return true; }
      case 'saveThenGo': { var g = pendingNav; closeModal(); saveProject(false).then(function () { if (g) g(); }); return true; }
      case 'zoomFit': fitView(); return true;
      case 'help': showHelp(); return true;
    }
    return false;
  }

  /* ===================================================================
     41. ÉVÉNEMENTS DE LA SCÈNE
     =================================================================== */

  function onWheel(e) {
    if (!doc) return;
    e.preventDefault();
    var pt = scenePoint(e);

    /* molette pendant le recadrage : on zoome le contenu, pas la vue */
    if (contentEdit) {
      var f = findLayer(doc.layers, contentEdit);
      if (f) {
        beginChange();
        f.zoom = clamp((f.zoom || 1) * (e.deltaY < 0 ? 1.06 : 1 / 1.06), 0.2, 6);
        endChange();
        requestDraw();
        return;
      }
    }
    /* La molette zoome, sans touche à tenir. Il n'y a rien à faire
       défiler ici : une affiche tient dans un écran, et « je tourne la
       molette pour voir de plus près » est le réflexe attendu.
       Maj + molette fait défiler latéralement ; pour se déplacer, la
       main (H ou Espace) ou le bouton du milieu. */
    if (e.shiftKey) { view.px -= (e.deltaY || e.deltaX); requestDraw(); return; }
    if (e.altKey) { view.px -= e.deltaX; view.py -= e.deltaY; requestDraw(); return; }
    var step = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    if (Math.abs(e.deltaY) > 120) step = e.deltaY < 0 ? 1.22 : 1 / 1.22;
    setZoom(view.zoom * step, pt.sx, pt.sy);
  }

  function onDblClick(e) {
    if (!doc) return;
    var pt = scenePoint(e), p = s2d(pt.sx, pt.sy);

    if (pathDraft) { commitPath(false); return; }

    var l = selOne();
    /* on descend dans un groupe */
    if (l && l.type === 'group' && hitLayer(l, p.x, p.y, 0)) {
      var c = childAt(l, p.x, p.y, 3 / view.zoom);
      if (c) { select([c.id]); return; }
    }
    var hit = topLayerAt(p.x, p.y, 3 / view.zoom);
    if (!hit) { fitView(); return; }
    if (hit.type === 'group') {
      var c2 = childAt(hit, p.x, p.y, 3 / view.zoom);
      if (c2) { select([c2.id]); return; }
    }
    select([hit.id]);
    if (hit.type === 'text') {
      var loc = toLocal(hit, p.x, p.y);
      var idx = indexAtPoint(hit, loc.x, loc.y);
      var wr = wordRange(hit, idx);
      enterTextEdit(hit, wr[0], wr[1]);
    } else if (hit.type === 'image' || hit.type === 'frame') {
      if (hit.src) { contentEdit = hit.id; requestDraw(); toast('Recadrage — glissez l image, molette pour zoomer'); }
      else { openPanel('images'); toast('Choisissez une image pour ce cadre'); }
    } else if (hit.type === 'path') {
      setTool('node');
    }
  }

  function onContextMenu(e) {
    e.preventDefault();
    var pt = scenePoint(e), p = s2d(pt.sx, pt.sy);
    var hit = topLayerAt(p.x, p.y, 3 / view.zoom);
    if (hit && sel.indexOf(hit.id) < 0) select([hit.id]);
    contextMenu(e.clientX, e.clientY);
  }

  /* ---------- fichiers déposés ---------- */
  function onDragOver(e) {
    if (!e.dataTransfer || !e.dataTransfer.types) return;
    if (e.dataTransfer.types.indexOf('Files') < 0) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    els.dropHint.classList.add('is-on');
  }
  function onDragLeave(e) {
    if (e.relatedTarget && els.viewport.contains(e.relatedTarget)) return;
    els.dropHint.classList.remove('is-on');
  }
  function onDrop(e) {
    e.preventDefault();
    els.dropHint.classList.remove('is-on');
    var files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    var pt = scenePoint(e), p = s2d(pt.sx, pt.sy);
    var hit = topLayerAt(p.x, p.y, 0);
    pendingFrame = (hit && (hit.type === 'image' || hit.type === 'frame')) ? hit.id : null;
    handleFiles(files);
  }

  function handleFiles(files) {
    var list = Array.prototype.slice.call(files).filter(function (f) { return /^image\//.test(f.type); });
    if (!list.length) { toast('Seules les images sont acceptées', true); return; }
    var target = pendingFrame;
    pendingFrame = null;
    toast('Téléversement…');
    var jobs = list.map(function (f) {
      if (api && api.uploadImage) {
        return Promise.resolve(api.uploadImage(f)).then(function (u) { return u || URL.createObjectURL(f); },
          function () { return URL.createObjectURL(f); });
      }
      return Promise.resolve(URL.createObjectURL(f));
    });
    Promise.all(jobs).then(function (urls) {
      urls.forEach(function (u, i) {
        if (!u) return;
        medias.unshift({ url: u, nom: list[i].name });
        getImage(u);
      });
      medias = dedupe(medias);
      if (target) {
        var f2 = findLayer(doc.layers, target);
        if (f2) {
          change(function () { f2.src = urls[0]; f2._fromSlot = false; f2.zoom = 1; f2.ox = .5; f2.oy = .5; });
          imagesReady().then(requestDraw);
          toast('Image placée dans le cadre', false, true);
          if (panelName === 'images') renderPanel();
          return;
        }
      }
      var prevSel = sel.slice();
      sel = [];
      placeImage(urls[0]);
      for (var i = 1; i < urls.length; i++) { sel = []; placeImage(urls[i]); }
      if (panelName === 'images') renderPanel();
      toast(urls.length + ' image(s) ajoutée(s)', false, true);
    }).catch(function () { toast('Téléversement impossible', true); });
  }

  /* ---------- saisie clavier du texte ---------- */
  function wireIme() {
    var composing = false;
    els.ime.addEventListener('compositionstart', function () { composing = true; });
    els.ime.addEventListener('compositionend', function () {
      composing = false;
      flushIme();
    });
    els.ime.addEventListener('input', function () {
      if (composing) return;
      flushIme();
    });
    els.ime.addEventListener('paste', function (e) {
      if (!edit) return;
      e.preventDefault();
      var t = (e.clipboardData || window.clipboardData).getData('text');
      if (t) insertText(t.replace(/\r\n?/g, '\n'));
    });
    els.ime.addEventListener('copy', function (e) {
      if (!edit) return;
      var l = editLayer(), r = selRange();
      if (!l || r.a === r.b) return;
      e.preventDefault();
      e.clipboardData.setData('text/plain', plainText(l).slice(r.a, r.b));
    });
    els.ime.addEventListener('cut', function (e) {
      if (!edit) return;
      var l = editLayer(), r = selRange();
      if (!l || r.a === r.b) return;
      e.preventDefault();
      e.clipboardData.setData('text/plain', plainText(l).slice(r.a, r.b));
      deleteRange(0);
    });
    els.ime.addEventListener('blur', function () {
      /* une perte de focus involontaire ne doit pas sortir de l édition */
      setTimeout(function () {
        if (edit && document.activeElement !== els.ime && !els.modal.classList.contains('is-on')) {
          var ae = document.activeElement;
          if (ae && root.contains(ae) && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'BUTTON')) return;
          exitTextEdit();
        }
      }, 30);
    });
  }
  function flushIme() {
    var v = els.ime.value;
    if (!v) return;
    els.ime.value = '';
    if (!edit) return;
    insertText(v);
  }

  /* ===================================================================
     42. MONTAGE
     =================================================================== */

  function grab() {
    els = {
      app: $('.bs-app'),
      scene: $('#bs-scene'),
      canvas: $('#bs-canvas'),
      overlay: $('#bs-overlay'),
      viewport: $('#bs-viewport'),
      rulerH: $('#bs-ruler-h'),
      rulerV: $('#bs-ruler-v'),
      ime: $('#bs-ime'),
      panel: $('#bs-panel'),
      panelBody: $('#bs-panel-body'),
      props: $('#bs-props'),
      layerList: $('#bs-layer-list'),
      toast: $('#bs-toast'),
      ctx: $('#bs-ctxmenu'),
      modal: $('#bs-modal'),
      modalCard: $('#bs-modal-card'),
      file: $('#bs-file'),
      dropHint: $('#bs-drop-hint'),
      projName: $('#bs-proj-name'),
      dirtyDot: $('#bs-dirty-dot'),
      saveInfo: $('#bs-saveinfo'),
      format: $('#bs-format'),
      undo: $('#bs-undo'),
      redo: $('#bs-redo'),
      zoomVal: $('#bs-zoom-val'),
      statusDims: $('#bs-status-dims'),
      statusPos: $('#bs-status-pos'),
      tglGrid: $('#bs-tgl-grid'),
      tglSnap: $('#bs-tgl-snap'),
      tglSafe: $('#bs-tgl-safe'),
      tglPreview: $('#bs-tgl-preview'),
      float: $('#bs-float'),
      lyrGroup: $('#bs-lyr-group')
    };
  }

  function wireChrome() {
    /* rail */
    $$('.bs-rail-i', root).forEach(function (b) {
      b.addEventListener('click', function () { openPanel(b.getAttribute('data-panel')); });
    });
    /* outils */
    $$('.bs-tool', root).forEach(function (b) {
      b.addEventListener('click', function () { setTool(b.getAttribute('data-tool')); });
    });

    on('#bs-add-image', 'click', function () { pendingFrame = null; var l = selOne(); if (l && (l.type === 'image' || l.type === 'frame')) pendingFrame = l.id; els.file.click(); });
    on('#bs-add-logo', 'click', function () {
      var u = (data.club && data.club.logo) || (api && api.clubLogo);
      if (!u) { toast('Aucun logo de club connu', true); return; }
      var W = doc.w;
      var f = makeFrame(doc, { src: u, slot: 'logoClub', x: Math.round((doc.w - W * .28) / 2), y: Math.round(doc.h * .06), w: Math.round(W * .28), h: Math.round(W * .28) });
      f.fit = 'contain'; f._fromSlot = true; f.name = 'Logo du club';
      getImage(u);
      insertLayers([f]);
    });
    on('#bs-dup', 'click', duplicateSelected);
    on('#bs-del', 'click', removeSelected);
    on('#bs-undo', 'click', undo);
    on('#bs-redo', 'click', redo);
    on('#bs-save', 'click', function () { saveProject(false); });
    on('#bs-export', 'click', openExport);
    on('#bs-publish', 'click', publish);
    on('#bs-help', 'click', showHelp);
    on('#bs-close', 'click', function () { close(); });
    on('#bs-zoom-in', 'click', function () { zoomStep(1); });
    on('#bs-zoom-out', 'click', function () { zoomStep(-1); });
    on('#bs-zoom-val', 'click', function () { setZoom(1); });
    on('#bs-zoom-fit', 'click', function () { fitView(); });
    on('#bs-tgl-grid', 'click', function () { toggleFlag('grid'); });
    on('#bs-tgl-snap', 'click', function () { toggleFlag('snap'); });
    on('#bs-tgl-safe', 'click', function () { toggleFlag('safe'); });
    on('#bs-tgl-preview', 'click', togglePreview);
    on('#bs-share', 'click', sharePublication);
    on('#bs-lyr-group', 'click', groupSelected);
    on('#bs-lyr-up', 'click', function () { var l = selOne(); if (l) moveLayerOrder(l.id, 1); });
    on('#bs-lyr-down', 'click', function () { var l = selOne(); if (l) moveLayerOrder(l.id, -1); });
    on('#bs-lyr-del', 'click', removeSelected);

    els.rulerH.addEventListener('pointerdown', function (e) { startRuleDrag(e, 'y'); });
    els.rulerV.addEventListener('pointerdown', function (e) { startRuleDrag(e, 'x'); });
    els.rulerH.style.cursor = 'ns-resize';
    els.rulerV.style.cursor = 'ew-resize';

    els.format.addEventListener('change', function () { setFormat(els.format.value); });
    els.projName.addEventListener('input', function () { doc.name = els.projName.value; markDirty(true); });
    els.projName.addEventListener('keydown', function (e) { if (e.key === 'Enter') els.projName.blur(); });

    els.file.addEventListener('change', function () {
      if (els.file.files && els.file.files.length) handleFiles(els.file.files);
      els.file.value = '';
    });

    /* scène.
       Le mousedown est intercepté pendant l'édition de texte : sans
       cela, cliquer dans le texte enlève le focus au champ invisible
       qui capte le clavier, et la frappe suivante est perdue. */
    els.scene.addEventListener('mousedown', function (e) { if (edit) e.preventDefault(); });
    els.scene.addEventListener('pointerdown', onPointerDown);
    els.scene.addEventListener('pointermove', onPointerMove);
    els.scene.addEventListener('pointerup', onPointerUp);
    els.scene.addEventListener('pointercancel', onPointerUp);
    els.scene.addEventListener('dblclick', onDblClick);
    els.scene.addEventListener('contextmenu', onContextMenu);
    els.scene.addEventListener('wheel', onWheel, { passive: false });

    els.viewport.addEventListener('dragover', onDragOver);
    els.viewport.addEventListener('dragleave', onDragLeave);
    els.viewport.addEventListener('drop', onDrop);

    els.modal.addEventListener('click', function (e) { if (e.target === els.modal) closeModal(); });
    root.addEventListener('pointerdown', function (e) {
      if (els.ctx.classList.contains('is-on') && !els.ctx.contains(e.target)) closeCtx();
    }, true);

    wireIme();

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);
  }
  function on(sel, evt, fn) { var e = $(sel); if (e) e.addEventListener(evt, fn); }

  var resizeT = null;
  function onResize() {
    if (!opened) return;
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { sizeCanvases(); requestDraw(); }, 80);
  }

  /* ---------- sauvegarde automatique ---------- */
  function startAutosave() {
    stopAutosave();
    autosaveTimer = setInterval(function () {
      if (!opened || !dirty || !project.id) return;
      saveProject(false);
    }, 45000);
  }
  function stopAutosave() { if (autosaveTimer) { clearInterval(autosaveTimer); autosaveTimer = null; } }

  /* ---------- polices ---------- */
  function waitFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var jobs = [];
    FONTS.forEach(function (f) {
      f.weights.forEach(function (w) {
        try { jobs.push(document.fonts.load(w + ' 64px "' + f.id + '"')); } catch (e) {}
      });
    });
    return Promise.all(jobs).catch(function () {}).then(function () { _metCache = {}; });
  }

  /* ===================================================================
     43. API PUBLIQUE
     =================================================================== */

  function mount(rootEl, hostApi) {
    if (mounted) return;
    root = rootEl;
    api = hostApi || {};
    grab();
    if (!els.scene) { console.error('[Baobabs Studio] fragment HTML introuvable'); return; }
    mounted = true;

    doc = newDoc('affiche', 'nuit');
    applyTemplateInto(doc, 'md-duel-maquette');
    els.projName.value = doc.name;
    syncFormatSelect();
    syncHistButtons();
    wireChrome();
    setTool('select');            /* l'état JS et le DOM doivent partir d'accord */
    openPanel('modeles');
    renderProps();
    renderLayers();

    Promise.all([waitFonts(), loadData(), loadProjects()]).then(function () {
      /* les boîtes de texte ont été calculées avec les polices de repli :
         maintenant que les vraies sont là, on les recalcule */
      walk(doc.layers, function (l) { if (l.type === 'text') syncTextBox(l); });
      applyBindings(true);
      prewarmImages();
      renderPanel();
      fitView();
      if (!hasStore) {
        console.info('[Baobabs Studio] aucun stockage de projets fourni par l hôte : les projets ne survivront pas au rechargement de la page.');
      }
    });
  }

  var firstOpen = true;
  function open() {
    if (!mounted) return;
    opened = true;
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    startAutosave();
    /* La scène n'avait aucune taille tant que le Studio était masqué :
       tout calcul de vue fait avant ce moment est faux. */
    requestAnimationFrame(function () {
      sizeCanvases();
      if (firstOpen) { firstOpen = false; fitView(); }
      else requestDraw();
    });
  }

  function close() {
    if (!opened) return;
    if (pathDraft) commitPath(false);
    if (edit) exitTextEdit();
    if (dirty && project.id) saveProject(false);
    opened = false;
    stopAutosave();
    closeCtx();
    closeModal();
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function isOpen() { return opened; }

  return {
    mount: mount,
    open: open,
    close: close,
    isOpen: isOpen,
    /* points d entrée annexes, utiles à l hôte */
    loadDocument: function (d) { if (d && d.layers) { doc = clone(d); sel = []; syncFormatSelect(); prewarmImages(); fitView(); refreshAll(); } },
    exportBlob: function (scale) { return exportBlob(scale || 2, 'image/png'); },
    version: '2.0'
  };
})();
