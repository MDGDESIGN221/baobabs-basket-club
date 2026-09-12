/* =====================================================================
   LE GREFFE : bibliothèque de blocs
   ---------------------------------------------------------------------
   POURQUOI CE FICHIER EXISTE

   La première version écrivait le HTML de l'ordre de mission à la main,
   avec ses six colonnes cousues dans trois endroits différents : le
   colgroup, l'en-tête, et la boucle des lignes. Ajouter une colonne
   « Taille » demandait de toucher les trois, sans se tromper, et un
   deuxième type d'acte demandait de tout recopier.

   Ici, un acte n'est plus du HTML : c'est une LISTE DE BLOCS. Et un
   tableau n'a plus de colonnes écrites : il a une LISTE DE COLONNES,
   qui est une donnée. Ajouter « Taille » devient une ligne, ou un clic.

   Les largeurs se répartissent toutes seules, par poids relatifs : on
   n'a jamais à refaire l'addition des millimètres quand une colonne
   arrive ou s'en va.

   AUCUN CADRATIN nulle part, ici comme ailleurs.
   ===================================================================== */
(function (G) {
  'use strict';

  var U = G.util;
  var B = {};
  G.blocs = B;

  /* ==================================================================
     LA FEUILLE DE STYLE, COMMUNE À TOUS LES ACTES
     Un seul endroit décide de l'allure des documents du club. Un
     modèle peut y ajouter, jamais la remplacer.
     ================================================================== */
  B.css = function () {
    return [
      ":root{",
      "  --vert:#0F432B; --or:#C1A462; --encre:#15201A; --texte:#33403A;",
      "  --gris:#8C948F; --gris-clair:#A9B0AB; --filet:#DFE3E0;",
      "  --fond-bloc:#F3F5F3; --fond-tint:#F7F9F7;",
      "}",
      "@page{ size:A4; margin:11mm 13mm 12mm 13mm; }",
      "*{ box-sizing:border-box; margin:0; padding:0; }",
      "html{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }",
      "body{ font-family:'InterDoc',Inter,Arial,sans-serif; font-size:7.8pt;",
      "  line-height:1.4; color:var(--texte); background:#fff;",
      "  font-feature-settings:'kern' 1,'liga' 1; -webkit-font-smoothing:antialiased; }",
      "p{ margin:0 0 3pt 0; } p:last-child{ margin-bottom:0; }",
      "strong,b{ font-weight:600; color:var(--encre); }",
      "em{ font-style:italic; }",
      ".label{ font-size:6pt; font-weight:600; letter-spacing:.2em; text-transform:uppercase; color:var(--gris-clair); }",
      ".avoid{ break-inside:avoid; }",
      /* l'unique bouton de l'auto-ajustement : tout se resserre d'un bloc */
      ".wrap{ position:relative; z-index:1; zoom:var(--gf-d, 1); }",
      ".bloc + .bloc{ margin-top:7pt; }",

      /* ---- filigrane ---- */
      ".wm{ position:fixed; left:0; right:0; top:0; bottom:0; z-index:0;",
      "  display:flex; align-items:center; justify-content:center; pointer-events:none; }",
      ".wm div{ width:108mm; height:108mm; opacity:.022; background-size:contain;",
      "  background-repeat:no-repeat; background-position:center; }",

      /* ---- en-tête ---- */
      ".head{ display:flex; align-items:flex-start; justify-content:space-between; gap:14pt; }",
      ".head-left{ display:flex; align-items:center; gap:11pt; }",
      ".crest{ width:34pt; height:34pt; flex:0 0 34pt; background-size:contain;",
      "  background-repeat:no-repeat; background-position:center; }",
      ".wordmark{ font-family:'Organetto',Gilroy,sans-serif; font-weight:800;",
      "  font-size:11.6pt; line-height:1; color:var(--vert); white-space:nowrap; }",
      ".tagline{ margin-top:4pt; font-size:7.2pt; font-style:italic; color:var(--or); }",
      ".head-right{ text-align:right; flex:0 0 auto; padding-top:1pt; }",
      ".flagbox{ display:inline-flex; align-items:center; gap:6pt; }",
      ".flagwrap{ width:19pt; flex:0 0 19pt; line-height:0; }",
      ".flag-svg{ width:100%; display:block; }",
      ".flagtxt{ font-size:6pt; font-weight:600; letter-spacing:.17em; text-transform:uppercase;",
      "  color:var(--encre); text-align:left; line-height:1.42; }",
      ".meta{ margin-top:5.5pt; font-size:6.9pt; line-height:1.5; color:var(--gris); white-space:nowrap; }",
      ".meta b{ color:var(--encre); font-weight:600; }",
      ".head-rule{ margin-top:6pt; height:1px; background:var(--filet); }",
      ".head-rule-or{ height:1.6pt; width:34pt; background:var(--or); margin-top:-.8pt; }",

      /* ---- titre ---- */
      ".hero-top{ display:flex; align-items:center; justify-content:space-between; margin-bottom:4pt; }",
      ".pill{ display:inline-flex; align-items:center; gap:5pt; background:var(--vert); color:#fff;",
      "  border-radius:99pt; padding:4.5pt 11pt 4.5pt 9pt; font-size:6.4pt; font-weight:600;",
      "  letter-spacing:.2em; text-transform:uppercase; }",
      ".pill i{ width:3.4pt; height:3.4pt; border-radius:99pt; background:var(--or); display:block; }",
      ".hero h1{ font-family:'Gilroy',sans-serif; font-weight:800; font-size:16pt; line-height:.98;",
      "  color:var(--vert); letter-spacing:-.025em; }",
      ".hero-sub{ margin-top:3pt; font-size:8pt; line-height:1.32; color:var(--encre);",
      "  font-weight:500; max-width:150mm; }",

      /* ---- bandeau de repères ---- */
      ".facts{ display:flex; border:1px solid var(--filet); border-radius:8pt;",
      "  overflow:hidden; background:var(--fond-tint); }",
      ".fact{ flex:1; padding:4.5pt 7.5pt 5pt 7.5pt; border-left:1px solid var(--filet); }",
      ".fact:first-child{ border-left:0; }",
      ".fact .label{ display:block; margin-bottom:3.5pt; color:var(--gris); }",
      ".fact b{ display:block; font-family:'Gilroy',sans-serif; font-weight:700; font-size:8.9pt;",
      "  line-height:1.2; color:var(--vert); letter-spacing:-.01em; }",
      ".fact em{ display:block; margin-top:2pt; font-style:normal; font-size:6.3pt;",
      "  line-height:1.34; color:var(--gris); }",

      /* ---- encadré (objet, mandatement, avertissement) ---- */
      ".encadre{ background:var(--fond-bloc); border-radius:8pt;",
      "  padding:6pt 11pt 6.5pt 12pt; position:relative; overflow:hidden; }",
      ".encadre::before{ content:''; position:absolute; left:0; top:0; bottom:0; width:2.4pt; background:var(--or); }",
      ".encadre p{ font-size:7.8pt; max-width:158mm; }",
      ".encadre h2{ font-family:'Gilroy',sans-serif; font-weight:800; font-size:13pt; line-height:1.2;",
      "  color:var(--vert); letter-spacing:-.014em; margin-bottom:4pt; }",
      ".verbe{ font-family:'Gilroy',sans-serif; font-weight:800; font-size:9.8pt;",
      "  letter-spacing:.02em; text-transform:uppercase; color:var(--vert); margin:2.5pt 0 3pt 0; }",

      /* ---- parties (conventions, contrats) ---- */
      ".parties{ display:flex; }",
      ".party{ flex:1; padding-right:14pt; }",
      ".party + .party{ padding-left:14pt; padding-right:0; border-left:1px solid var(--filet); }",
      ".party .label{ display:block; margin-bottom:5pt; }",
      ".party-nom{ font-family:'Gilroy',sans-serif; font-weight:700; font-size:9.6pt;",
      "  line-height:1.26; color:var(--encre); letter-spacing:-.005em; margin-bottom:3pt; }",
      ".party-tag{ margin-top:3pt; font-size:7pt; color:var(--gris); font-style:italic; }",

      /* ---- texte libre (lettres) ---- */
      ".lettre p{ max-width:158mm; margin-bottom:4.5pt; }",
      ".lettre .salut{ margin-bottom:5pt; }",
      ".lettre .greet{ margin-top:5pt; }",

      /* ---- articles ---- */
      ".arts{ border-top:1px solid var(--filet); }",
      ".art{ display:flex; padding:3.8pt 0; border-bottom:1px solid var(--filet); }",
      ".art-num{ flex:0 0 27pt; font-family:'Gilroy',sans-serif; font-weight:700; font-size:7.4pt;",
      "  color:var(--or); letter-spacing:.06em; padding-top:1.2pt; }",
      ".art-body{ flex:1; }",
      ".art-title{ font-family:'Gilroy',sans-serif; font-weight:700; font-size:8.7pt; line-height:1.28;",
      "  color:var(--encre); letter-spacing:-.006em; margin-bottom:2.2pt; break-after:avoid; }",
      ".art-body p{ max-width:158mm; }",
      "ul{ list-style:none; margin:3pt 0 1pt 0; }",
      "li{ position:relative; padding-left:10pt; margin-bottom:1.2pt; max-width:158mm; }",
      "li::before{ content:''; position:absolute; left:1.5pt; top:4.5pt; width:3pt; height:3pt;",
      "  border-radius:99pt; background:var(--or); }",

      /* ---- pastilles de récapitulation ---- */
      ".chips{ display:flex; gap:5pt; }",
      ".chip{ border:1px solid var(--filet); border-radius:6pt; padding:5.5pt 10pt; background:var(--fond-tint); }",
      ".chip .label{ display:block; color:var(--gris); margin-bottom:2.5pt; }",
      ".chip b{ font-family:'Gilroy',sans-serif; font-weight:700; font-size:9pt; color:var(--vert); }",

      /* ---- tableaux ---- */
      ".tab-titre{ font-family:'Gilroy',sans-serif; font-weight:700; font-size:9.4pt;",
      "  color:var(--encre); letter-spacing:-.008em; margin-bottom:5pt; }",
      "table{ width:100%; table-layout:fixed; border-collapse:collapse;",
      "  font-variant-numeric:tabular-nums; }",
      "thead th{ background:var(--vert); color:#fff; font-family:'Gilroy',sans-serif; font-weight:700;",
      "  font-size:6.1pt; letter-spacing:.08em; text-transform:uppercase; text-align:left;",
      "  padding:6.5pt 6pt; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }",
      "thead th:first-child{ border-top-left-radius:6pt; }",
      "thead th:last-child{ border-top-right-radius:6pt; }",
      "tbody td{ padding:5pt 6pt; border-bottom:1px solid var(--filet); font-size:8pt;",
      "  color:var(--texte); vertical-align:middle; word-wrap:break-word; }",
      "tbody tr:last-child td{ border-bottom:1.4pt solid var(--vert); }",
      "tbody tr.enc td{ background:#F2F6F3; }",
      "tfoot td{ padding:6pt; font-family:'Gilroy',sans-serif; font-weight:700; font-size:8.4pt;",
      "  color:var(--vert); border-top:1.4pt solid var(--vert); }",
      "td.a-centre,th.a-centre{ text-align:center; }",
      "td.a-droite,th.a-droite{ text-align:right; }",
      "td.f-rang{ font-family:'Gilroy',sans-serif; font-weight:700; font-size:7.6pt;",
      "  color:var(--or); letter-spacing:.04em; }",
      "td.f-fort{ font-weight:500; color:var(--encre); font-size:8.2pt; }",
      "td.f-code{ letter-spacing:.035em; white-space:nowrap; font-size:8pt; }",
      "td.f-nombre{ font-family:'Gilroy',sans-serif; font-weight:700; color:var(--encre); }",
      ".q{ display:inline-block; font-size:6.2pt; font-weight:600; letter-spacing:.07em;",
      "  text-transform:uppercase; padding:2.4pt 6pt; border-radius:99pt; white-space:nowrap; }",
      ".q.ton-plein{ background:var(--vert); color:#fff; }",
      ".q.ton-doux{ background:#EDF1EE; color:var(--vert); }",

      /* ---- signatures ---- */
      ".closing-grid{ display:flex; gap:12pt; align-items:stretch; }",
      ".closing-left{ flex:1; padding-top:2pt; }",
      ".place{ font-size:8.6pt; color:var(--encre); }",
      ".closing-note{ margin-top:4pt; font-size:7.1pt; line-height:1.45; color:var(--gris); max-width:80mm; }",
      ".ref{ margin-top:6pt; display:inline-flex; align-items:center; gap:6pt;",
      "  border:1px solid var(--filet); border-radius:5pt; padding:4pt 8pt;",
      "  font-family:'Gilroy',sans-serif; font-weight:700; font-size:7.4pt; color:var(--encre);",
      "  letter-spacing:.06em; }",
      ".ref .label{ letter-spacing:.2em; }",
      ".sign-card{ flex:0 0 90mm; border:1px solid var(--filet); border-radius:9pt;",
      "  padding:7pt 10pt 6pt 10pt; position:relative; }",
      ".signs-2 .sign-card{ flex:1 1 0; }",
      ".sign-card .label{ display:block; color:var(--vert); margin-bottom:4pt; }",
      ".sign-who{ display:flex; align-items:baseline; gap:6pt; white-space:nowrap; }",
      ".sign-name{ font-family:'Gilroy',sans-serif; font-weight:700; font-size:8.9pt;",
      "  color:var(--encre); line-height:1.3; }",
      ".sign-role{ font-size:7pt; color:var(--gris); }",
      ".sign-cta{ margin-top:3.5pt; border-top:1px solid var(--filet); padding-top:3.5pt;",
      "  font-size:6pt; font-weight:600; letter-spacing:.16em; text-transform:uppercase; color:var(--gris-clair); }",
      ".ink-zone{ position:relative; height:24mm; margin-top:4pt; }",
      ".sig-ink{ position:absolute; left:1mm; bottom:4pt; width:48mm;",
      "  mix-blend-mode:multiply; transform:rotate(-2.4deg); transform-origin:left bottom; }",
      ".sig-name{ font-family:'Paraphe',cursive; font-size:20pt; line-height:.9;",
      "  color:#152E72; white-space:nowrap; }",
      ".sig-paraphe{ margin-top:-2.6mm; margin-left:1.5mm; width:37mm; line-height:0; }",
      ".paraphe-svg{ width:100%; display:block; }",
      ".sig-cachet{ position:absolute; right:4mm; bottom:0; width:25.5mm; height:25.5mm;",
      "  background-size:contain; background-repeat:no-repeat; background-position:center;",
      "  mix-blend-mode:multiply; transform:rotate(-9deg); opacity:.94; }",

      /* ---- annexe ---- */
      ".annexe{ break-before:page; }",
      ".ann-head{ display:flex; align-items:center; justify-content:space-between; gap:12pt; }",
      ".ann-head-left{ display:flex; align-items:center; gap:9pt; }",
      ".ann-head .crest{ width:30pt; height:30pt; flex:0 0 30pt; }",
      ".ann-title{ font-family:'Gilroy',sans-serif; font-weight:800; font-size:11pt;",
      "  color:var(--vert); letter-spacing:-.012em; line-height:1.15; }",
      ".ann-title span{ display:block; font-family:'InterDoc',sans-serif; font-weight:500; font-size:6pt;",
      "  letter-spacing:.19em; text-transform:uppercase; color:var(--gris); margin-top:3.5pt; }",
      ".ann-meta{ text-align:right; font-size:7pt; line-height:1.5; color:var(--gris); white-space:nowrap; }",
      ".ann-meta b{ color:var(--encre); font-weight:600; }",
      ".certif{ flex:1; }",
      ".certif .label{ display:block; color:var(--vert); margin-bottom:5pt; }",
      ".certif p{ font-size:7.9pt; line-height:1.5; max-width:84mm; }",

      /* ---- pied de page, répété à chaque page ---- */
      ".foot{ position:fixed; left:0; right:0; bottom:0; z-index:2; background:#fff;",
      "  padding-top:3pt; border-top:1px solid var(--filet); display:flex; align-items:center; gap:6pt;",
      "  font-size:6.1pt; color:var(--gris-clair); letter-spacing:.03em; }",
      ".foot i{ width:3.4pt; height:3.4pt; border-radius:99pt; background:var(--or); display:block; flex:0 0 3.4pt; }",
      ".foot .right{ margin-left:auto; }"
    ].join("\n");
  };

  /* ==================================================================
     VISUELS DESSINÉS : ils ne dépendent d'aucun fichier déposé
     ================================================================== */
  B.DRAPEAU =
    '<svg class="flag-svg" viewBox="0 0 90 60" xmlns="http://www.w3.org/2000/svg" ' +
    'role="img" aria-label="Drapeau du Sénégal">' +
    '<rect x="0" y="0" width="30" height="60" fill="#00853F"/>' +
    '<rect x="30" y="0" width="30" height="60" fill="#FDEF42"/>' +
    '<rect x="60" y="0" width="30" height="60" fill="#E31B23"/>' +
    '<polygon fill="#00853F" points="45.00,17.00 41.79,25.58 32.64,25.98 39.81,31.69 ' +
    '37.36,40.52 45.00,35.46 52.64,40.52 50.19,31.69 57.36,25.98 48.21,25.58"/>' +
    '<rect x="0.35" y="0.35" width="89.3" height="59.3" fill="none" ' +
    'stroke="rgba(0,0,0,.20)" stroke-width="0.7"/></svg>';

  B.PARAPHE =
    '<svg class="paraphe-svg" viewBox="0 0 320 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<g fill="none" stroke="#152E72" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M 8 46 C 46 18 104 10 160 20 C 206 28 244 44 272 32 C 286 26 289 15 279 12 ' +
    'C 270 9 263 18 270 27 C 279 38 298 40 312 30" stroke-width="2.5"/>' +
    '<path d="M 30 54 C 78 40 140 38 196 46" stroke-width="1.5" opacity=".55"/>' +
    '</g></svg>';

  /* Une valeur de configuration peut être une fonction des données :
     c'est ce qui permet à un modèle de calculer un libellé sans écrire
     de HTML. On la résout ici, une fois pour toutes. */
  function val(v, d, ctx) {
    return (typeof v === 'function') ? v(d, ctx) : v;
  }
  B.val = val;

  function fond(ctx) {
    return ctx.res && ctx.res.blason
      ? ' style="background-image:url(' + ctx.res.blason + ')"' : '';
  }

  /* ==================================================================
     LE MOTEUR DE TABLEAUX
     Les colonnes sont une donnée. Les largeurs se répartissent par
     poids relatifs : ajouter ou retirer une colonne ne demande jamais
     de refaire l'addition des millimètres.
     ================================================================== */
  B.COLONNE_DEFAUT = { titre: 'Colonne', poids: 20, align: 'gauche', forme: 'texte' };

  B.formesDisponibles = [
    { cle: 'texte',    nom: 'Texte' },
    { cle: 'fort',     nom: 'Texte accentué' },
    { cle: 'code',     nom: 'Numéro ou référence' },
    { cle: 'nombre',   nom: 'Nombre' },
    { cle: 'pastille', nom: 'Pastille' }
  ];

  function classeCellule(col) {
    var c = [];
    if (col.forme && col.forme !== 'texte' && col.forme !== 'pastille') c.push('f-' + col.forme);
    if (col.align === 'centre') c.push('a-centre');
    if (col.align === 'droite') c.push('a-droite');
    return c.length ? ' class="' + c.join(' ') + '"' : '';
  }

  function cellule(col, ligne, cfg) {
    var v = ligne[col.cle];
    v = (v == null ? '' : String(v));
    if (col.forme === 'pastille' && v) {
      var ton = (cfg.tonPastille && cfg.tonPastille(v, ligne)) || 'ton-doux';
      return '<span class="q ' + ton + '">' + U.ech(v) + '</span>';
    }
    return U.ech(v);
  }

  B.tableau = function (cfg, d, ctx) {
    var table = (d.tables && d.tables[cfg.source]) || { colonnes: [], lignes: [] };
    var cols = (table.colonnes || []).filter(function (c) { return c && c.cle; });
    var lignes = (table.lignes || []).filter(function (l) {
      return Object.keys(l).some(function (k) { return String(l[k] || '').trim(); });
    });
    if (!cols.length) return '';

    var numeroter = cfg.numeroter !== false;
    var poidsTotal = cols.reduce(function (s, c) { return s + (+c.poids || B.COLONNE_DEFAUT.poids); }, 0);
    var partRang = numeroter ? 4 : 0;
    var base = 100 / (poidsTotal + partRang);

    var colgroup = (numeroter ? '<col style="width:' + (partRang * base).toFixed(3) + '%">' : '')
      + cols.map(function (c) {
        return '<col style="width:' + (((+c.poids || B.COLONNE_DEFAUT.poids)) * base).toFixed(3) + '%">';
      }).join('');

    var thead = '<tr>' + (numeroter ? '<th class="a-centre">N°</th>' : '')
      + cols.map(function (c) {
        var a = c.align === 'centre' ? ' class="a-centre"' : (c.align === 'droite' ? ' class="a-droite"' : '');
        return '<th' + a + '>' + U.ech(c.titre || '') + '</th>';
      }).join('') + '</tr>';

    var tbody = lignes.map(function (l, i) {
      var cl = (cfg.enAvant && cfg.enAvant(l)) ? ' class="enc"' : '';
      return '<tr' + cl + '>'
        + (numeroter ? '<td class="f-rang a-centre">' + U.deuxChiffres(i + 1) + '</td>' : '')
        + cols.map(function (c) {
          return '<td' + classeCellule(c) + '>' + cellule(c, l, cfg) + '</td>';
        }).join('') + '</tr>';
    }).join('');

    /* Un pied de tableau : la somme des colonnes marquées « total ». */
    var tfoot = '';
    var aTotal = cols.some(function (c) { return c.total; });
    if (aTotal && lignes.length) {
      tfoot = '<tfoot><tr>'
        + (numeroter ? '<td></td>' : '')
        + cols.map(function (c, i) {
          if (!c.total) return '<td' + classeCellule(c) + '>' + (i === 0 ? 'Total' : '') + '</td>';
          var s = lignes.reduce(function (acc, l) {
            var n = parseFloat(String(l[c.cle] || '').replace(/[^\d.,-]/g, '').replace(',', '.'));
            return acc + (isNaN(n) ? 0 : n);
          }, 0);
          return '<td' + classeCellule(c) + '>' + U.ech(U.nombre(s)) + '</td>';
        }).join('') + '</tr></tfoot>';
    }

    var titre = val(cfg.titre, d, ctx);
    return (titre ? '<div class="tab-titre">' + U.ech(titre) + '</div>' : '')
      + '<table><colgroup>' + colgroup + '</colgroup>'
      + '<thead>' + thead + '</thead><tbody>' + tbody + '</tbody>' + tfoot + '</table>';
  };

  /* ==================================================================
     LES BLOCS
     Chacun rend un fragment ; le noyau les met bout à bout.
     ================================================================== */
  B.rendus = {

    entete: function (cfg, d, ctx) {
      var droite = val(cfg.droite, d, ctx) || [];
      return '<header class="head"><div class="head-left"><div class="crest"' + fond(ctx) + '></div><div>'
        + '<div class="wordmark">' + U.ech(val(cfg.nom, d, ctx) || 'BAOBABS BASKET CLUB') + '</div>'
        + '<div class="tagline">' + U.ech(val(cfg.devise, d, ctx) || 'Grandir ici. Régner partout.') + '</div>'
        + '</div></div><div class="head-right">'
        + (cfg.drapeau === false ? '' :
            '<div class="flagbox"><span class="flagwrap">' + B.DRAPEAU + '</span>'
            + '<span class="flagtxt">République<br>du Sénégal</span></div>')
        + '<div class="meta">' + droite.map(function (l, i) {
            return i === 0 ? '<b>' + U.ech(l) + '</b>' : U.ech(l);
          }).join('<br>') + '</div>'
        + '</div></header><div class="head-rule"></div><div class="head-rule-or"></div>';
    },

    titre: function (cfg, d, ctx) {
      var etiq = val(cfg.etiquette, d, ctx);
      var pastille = val(cfg.pastille, d, ctx);
      return '<section class="hero avoid">'
        + ((etiq || pastille) ? '<div class="hero-top">'
            + '<span class="label">' + U.ech(etiq || '') + '</span>'
            + (pastille ? '<span class="pill"><i></i>' + U.ech(pastille) + '</span>' : '')
            + '</div>' : '')
        + '<h1>' + U.ech(val(cfg.texte, d, ctx) || '') + '</h1>'
        + (val(cfg.sous, d, ctx) ? '<p class="hero-sub">' + U.ech(val(cfg.sous, d, ctx)) + '</p>' : '')
        + '</section>';
    },

    reperes: function (cfg, d, ctx) {
      var cells = (val(cfg.cellules, d, ctx) || []).filter(function (c) {
        return c && String(c.valeur || '').trim();
      });
      if (!cells.length) return '';
      return '<section class="facts avoid">' + cells.map(function (c) {
        return U.fait(c.label, c.valeur, c.sous);
      }).join('') + '</section>';
    },

    encadre: function (cfg, d, ctx) {
      var t = val(cfg.titre, d, ctx);
      var av = val(cfg.avant, d, ctx), vb = val(cfg.verbe, d, ctx), ap = val(cfg.apres, d, ctx);
      return '<section class="encadre avoid">'
        + (cfg.etiquette ? '<span class="label">' + U.ech(val(cfg.etiquette, d, ctx)) + '</span>' : '')
        + (t ? '<h2>' + U.ech(t) + '</h2>' : '')
        + (av ? U.paragraphes(av) : '')
        + (vb ? '<div class="verbe">' + U.ech(vb) + '</div>' : '')
        + (ap ? U.paragraphes(ap) : '')
        + '</section>';
    },

    parties: function (cfg, d, ctx) {
      var ps = val(cfg.parties, d, ctx) || [];
      return '<section class="parties avoid">' + ps.map(function (p) {
        return '<div class="party"><span class="label">' + U.ech(p.label || '') + '</span>'
          + '<div class="party-nom">' + U.ech(p.nom || '') + '</div>'
          + U.paragraphes(p.texte || '')
          + (p.tag ? '<div class="party-tag">' + U.ech(p.tag) + '</div>' : '')
          + '</div>';
      }).join('') + '</section>';
    },

    lettre: function (cfg, d, ctx) {
      var s = val(cfg.salutation, d, ctx);
      var g = val(cfg.formule, d, ctx);
      return '<section class="lettre">'
        + (s ? '<p class="salut">' + U.ech(s) + '</p>' : '')
        + U.paragraphes(val(cfg.texte, d, ctx) || '')
        + (g ? '<p class="greet">' + U.ech(g) + '</p>' : '')
        + '</section>';
    },

    articles: function (cfg, d, ctx) {
      var arts = val(cfg.articles, d, ctx) || [];
      if (!arts.length) return '';
      return '<section class="arts">' + arts.map(function (a, i) {
        return '<article class="art avoid"><div class="art-num">' + U.deuxChiffres(i + 1) + '</div>'
          + '<div class="art-body"><div class="art-title">' + U.ech(a.titre) + '</div>'
          + U.paragraphes(a.texte) + '</div></article>';
      }).join('') + '</section>';
    },

    chips: function (cfg, d, ctx) {
      var cs = (val(cfg.chips, d, ctx) || []).filter(function (c) { return c && c.valeur; });
      if (!cs.length) return '';
      return '<div class="chips">' + cs.map(function (c) {
        return '<div class="chip"><span class="label">' + U.ech(c.label) + '</span><b>'
          + U.ech(c.valeur) + '</b></div>';
      }).join('') + '</div>';
    },

    tableau: function (cfg, d, ctx) { return B.tableau(cfg, d, ctx); },

    signatures: function (cfg, d, ctx) {
      var gauche = val(cfg.gauche, d, ctx);
      var cartes = (val(cfg.cartes, d, ctx) || []);
      var html = '<section class="closing avoid"><div class="closing-grid' + (cartes.length > 1 ? ' signs-2' : '') + '">';
      if (gauche) {
        html += '<div class="closing-left">'
          + (gauche.lieuDate ? '<div class="place">' + gauche.lieuDate + '</div>' : '')
          + (gauche.note ? '<p class="closing-note">' + gauche.note + '</p>' : '')
          + (gauche.reference ? '<div class="ref"><span class="label">Référence</span> '
              + U.ech(gauche.reference) + '</div>' : '')
          + '</div>';
      }
      html += cartes.map(function (c) { return B.carteSignature(c, d, ctx); }).join('');
      return html + '</div></section>';
    },

    annexe: function (cfg, d, ctx) {
      var inner = (cfg.contenu || []).map(function (b) { return B.rendre(b, d, ctx); }).join('');
      if (!String(inner).replace(/<[^>]*>/g, '').trim() && !/table/.test(inner)) return '';
      var meta = val(cfg.meta, d, ctx) || [];
      return '<section class="annexe">'
        + '<div class="ann-head"><div class="ann-head-left"><div class="crest"' + fond(ctx) + '></div>'
        + '<div class="ann-title">' + U.ech(val(cfg.titre, d, ctx) || '')
        + '<span>' + U.ech(val(cfg.sous, d, ctx) || '') + '</span></div></div>'
        + (meta.length ? '<div class="ann-meta">' + meta.map(function (l, i) {
            return i === 0 ? '<b>' + U.ech(l) + '</b>' : U.ech(l);
          }).join('<br>') + '</div>' : '')
        + '</div>' + inner + '</section>';
    },

    certification: function (cfg, d, ctx) {
      var cartes = val(cfg.cartes, d, ctx) || [];
      return '<div class="closing-grid avoid" style="margin-top:12pt"><div class="certif">'
        + '<span class="label">' + U.ech(val(cfg.etiquette, d, ctx) || 'Certification') + '</span>'
        + U.paragraphes(val(cfg.texte, d, ctx) || '')
        + (val(cfg.reference, d, ctx) ? '<div class="ref" style="margin-top:8pt">'
            + '<span class="label">Référence</span> ' + U.ech(val(cfg.reference, d, ctx)) + '</div>' : '')
        + '</div>' + cartes.map(function (c) { return B.carteSignature(c, d, ctx); }).join('') + '</div>';
    },

    espace: function (cfg) {
      return '<div style="height:' + (parseFloat(cfg.hauteur) || 6) + 'pt"></div>';
    },

    html: function (cfg, d, ctx) { return val(cfg.contenu, d, ctx) || ''; }
  };

  /* La carte de signature, partagée par « signatures » et
     « certification » : une seule définition de l'encre. */
  B.carteSignature = function (c, d, ctx) {
    var encre = '';
    if (d.avecSignature !== false && c.signer !== false) {
      encre += '<div class="sig-ink"><div class="sig-name">'
        + U.ech(U.initialeNom(c.nom)) + '</div>'
        + '<div class="sig-paraphe">' + B.PARAPHE + '</div></div>';
    }
    if (d.avecCachet !== false && c.cacheter !== false && ctx.res && ctx.res.cachet) {
      encre += '<div class="sig-cachet" style="background-image:url(' + ctx.res.cachet + ')"></div>';
    }
    return '<div class="sign-card">'
      + '<span class="label">' + U.ech(c.pour || '') + '</span>'
      + '<div class="sign-who"><span class="sign-name">' + U.ech(c.nom || '') + '</span>'
      + '<span class="sign-role">' + U.ech(c.qualite || '') + '</span></div>'
      + '<div class="ink-zone">' + encre + '</div>'
      + '<div class="sign-cta">' + U.ech(c.mention || 'Signature et cachet') + '</div>'
      + '</div>';
  };

  /* ==================================================================
     LE MONTAGE
     ================================================================== */
  B.rendre = function (bloc, d, ctx) {
    if (!bloc || !bloc.b) return '';
    if (bloc.si && !val(bloc.si, d, ctx)) return '';
    var f = B.rendus[bloc.b];
    if (!f) return '<!-- bloc inconnu : ' + U.ech(bloc.b) + ' -->';
    var html = f(bloc, d, ctx);
    if (!html) return '';
    return bloc.b === 'annexe' ? html : '<div class="bloc">' + html + '</div>';
  };

  B.assembler = function (modele, d, ctx) {
    var corps = (modele.page || []).map(function (b) { return B.rendre(b, d, ctx); }).join('\n');
    var pied = val(modele.pied, d, ctx) || [];
    return '<div class="wm"><div' + fond(ctx) + '></div></div>'
      + '<div class="wrap">' + corps + '</div>'
      + (pied.length
          ? '<footer class="foot"><i></i><span>' + U.ech(pied[0] || '') + '</span>'
            + '<span class="right">' + U.ech(pied[1] || '') + '</span></footer>'
          : '');
  };

})(window.BaobabsGreffe);
