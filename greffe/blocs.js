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
      "@page{ size:A4; margin:0; }",
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
      /* ---- les feuilles ---- */
      ".page{ position:relative; width:210mm; height:297mm; padding:11mm 13mm 12mm 13mm;",
      "  background:#fff; overflow:hidden; }",
      ".page .corps{ position:relative; z-index:1; height:calc(297mm - 11mm - 12mm - 8mm);",
      "  overflow:hidden; zoom:var(--gf-d, 1); }",
      "@media print{ html,body{ margin:0; padding:0; background:#fff; }",
      "  .pages{ display:block; } .page{ break-after:page; margin:0; box-shadow:none; border-radius:0; }",
      "  .page:last-child{ break-after:auto; } tr.tr-suite{ display:none; } }",
      "@media screen{ body{ background:#E9EBE8; }",
      "  .pages{ display:flex; flex-direction:column; align-items:center; gap:6mm; padding:5mm; }",
      "  .page{ box-shadow:0 10px 30px rgba(0,0,0,.35), 0 0 0 1px rgba(0,0,0,.18); border-radius:1.5pt; } }",
      ".bloc + .bloc{ margin-top:7pt; }",

      /* ---- filigrane ---- */
      ".wm{ position:absolute; left:0; right:0; top:0; bottom:0; z-index:0;",
      "  display:flex; align-items:center; justify-content:center; pointer-events:none; }",
      ".wm .wm-blason{ width:108mm; height:108mm; opacity:.022; background-size:contain;",
      "  background-repeat:no-repeat; background-position:center; }",
      /* un brouillon le dit sur chaque page, à l'écran comme sur le papier */
      ".wm-brouillon{ position:absolute; left:0; right:0; top:0; bottom:0; display:flex; align-items:center;",
      "  justify-content:center; pointer-events:none; font-family:'Gilroy',sans-serif; font-weight:800;",
      "  font-size:58pt; letter-spacing:.22em; color:rgba(180,35,31,.085); transform:rotate(-28deg); }",

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
      /* une pastille sans texte : un pointillé à l'écran pour y écrire, rien à l'impression */
      ".pill-vide{ background:transparent; color:var(--gris-clair); border:1px dashed var(--gris-clair); min-width:16mm; }",
      ".pill-vide i{ background:var(--gris-clair); }",
      "@media print{ .pill-vide{ display:none; } }",
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
      /* les champs d'identité d'une partie : renseignés, ou en pointillé
         pour être complétés à la main sur l'exemplaire imprimé */
      ".party-champs{ display:grid; grid-template-columns:1fr 1fr; gap:2.5pt 10pt; margin:3pt 0 2pt 0; }",
      ".party-champ{ display:flex; align-items:baseline; gap:4pt; font-size:7.4pt; white-space:nowrap; }",
      ".party-champ.large{ grid-column:1 / -1; }",
      ".party-champ .k{ color:var(--gris); flex:0 0 auto; }",
      ".party-champ .v{ color:var(--encre); font-weight:500; overflow:hidden; text-overflow:ellipsis; }",
      ".party-champ .pointille{ flex:1 1 auto; min-width:18mm; border-bottom:1px dotted var(--gris-clair); min-height:7pt; }",

      /* ---- phrase de liaison (« Il est convenu ce qui suit : ») ---- */
      ".lead{ font-family:'Gilroy',sans-serif; font-weight:700; font-size:8.6pt; color:var(--encre); }",

      /* ---- note en retrait, dans un article ---- */
      ".note{ margin-top:3.5pt; padding:4.5pt 8pt; background:var(--fond-tint); border-radius:5pt;",
      "  border-left:2pt solid var(--or); }",
      ".note p{ font-size:7.3pt; color:var(--gris); font-style:italic; }",

      /* ---- variations dans le texte ---- */
      "i,em{ font-style:italic; }",
      "u{ text-decoration:underline; text-underline-offset:1.6pt; text-decoration-thickness:.6pt; }",
      "mark{ background:#FFF0B3; color:inherit; padding:0 1.5pt; border-radius:1.5pt; }",
      ".s-or{ color:var(--or); } .s-vert{ color:var(--vert); } .s-rouge{ color:#B4231F; } .s-gris{ color:var(--gris); }",
      ".s-grand{ font-size:1.22em; } .s-petit{ font-size:.85em; }",
      ".s-fin{ font-weight:400; } .s-droit{ font-style:normal; }",
      ".s-maj{ text-transform:uppercase; letter-spacing:.06em; font-size:.92em; }",

      /* ---- le style d'un bloc : alignement, thème de couleur ---- */
      ".bloc.al-centre{ text-align:center; }",
      ".bloc.al-centre p, .bloc.al-centre li, .bloc.al-centre .hero-sub, .bloc.al-centre .libre p{ margin-left:auto; margin-right:auto; }",
      ".bloc.al-centre .fig{ align-items:center; } .bloc.al-centre .parties, .bloc.al-centre .facts{ text-align:left; }",
      ".bloc.al-droite{ text-align:right; }",
      ".bloc.al-droite p, .bloc.al-droite .hero-sub{ margin-left:auto; }",
      ".bloc.th-vert{ --fond-bloc:#E3EDE7; --fond-tint:#EDF3EF; --or:#0F432B; }",
      ".bloc.th-rouge{ --fond-bloc:#F8E7E6; --fond-tint:#FBF1F0; --or:#B4231F; --vert:#8E1B18; }",
      ".bloc.th-neutre{ --fond-bloc:#EEF0EF; --fond-tint:#F4F5F4; --or:#8C948F; --vert:#33403A; }",
      ".bloc.th-plein > .encadre, .bloc.th-plein > .libre, .bloc.th-plein > .hero{ background:var(--vert); color:#fff;",
      "  border-radius:8pt; padding:7pt 12pt 8pt 12pt; }",
      ".bloc.th-plein > .encadre::before{ background:var(--or); }",
      ".bloc.th-plein .label, .bloc.th-plein h1, .bloc.th-plein h2, .bloc.th-plein h3, .bloc.th-plein b, .bloc.th-plein strong,",
      ".bloc.th-plein p, .bloc.th-plein li, .bloc.th-plein .hero-sub, .bloc.th-plein .verbe{ color:#fff; }",
      ".bloc.th-plein li::before{ background:var(--or); }",
      ".bloc.th-plein .pill{ background:var(--or); color:var(--vert); } .bloc.th-plein .pill i{ background:var(--vert); }",
      /* la police d'un bloc, parmi celles du club */
      ".bloc.po-gilroy, .bloc.po-gilroy *{ font-family:'Gilroy',sans-serif !important; }",
      ".bloc.po-inter, .bloc.po-inter *{ font-family:'InterDoc',Inter,sans-serif !important; }",
      ".bloc.po-organetto, .bloc.po-organetto *{ font-family:'Organetto',Gilroy,sans-serif !important; }",
      ".bloc.po-paraphe, .bloc.po-paraphe *{ font-family:'Paraphe',cursive !important; font-size:1.35em; }",

      /* ---- les objets posés sur la page ---- */
      ".objet{ position:absolute; z-index:3; box-sizing:border-box; }",
      ".objet-cachet{ background-size:contain; background-repeat:no-repeat; background-position:center; mix-blend-mode:multiply; }",
      ".objet-signature{ mix-blend-mode:multiply; }",
      ".objet-signature .sig-ink{ transform:none; }",
      ".objet-image img{ display:block; width:100%; height:100%; object-fit:contain; }",
      ".objet-annotation{ border:1pt solid var(--or); border-radius:3pt; padding:2.5pt 5pt; font-size:7.6pt; line-height:1.35;",
      "  background:rgba(255,255,255,.85); overflow:hidden; }",
      ".objet-annotation p{ margin:0; }",
      ".objet-cadre{ border:1.2pt solid var(--or); border-radius:3pt; }",
      ".objet-fleche{ overflow:visible; }",
      ".objet-case{ display:flex; align-items:center; gap:5pt; font-size:7.8pt; line-height:1.25; }",
      ".objet-case i{ flex:0 0 auto; width:9pt; height:9pt; border:1.1pt solid var(--encre); border-radius:2pt; position:relative; }",
      ".objet-case.cochee i::after{ content:''; position:absolute; left:2pt; top:0; width:3pt; height:5.5pt; border:solid var(--encre); border-width:0 1.4pt 1.4pt 0; transform:rotate(40deg); }",
      ".objet-case span{ flex:1; }",

      /* ---- texte libre, image ---- */
      ".libre .label{ display:block; margin-bottom:3pt; }",
      ".libre-titre{ font-family:'Gilroy',sans-serif; font-weight:700; font-size:9.6pt; line-height:1.25;",
      "  color:var(--encre); letter-spacing:-.008em; margin-bottom:3pt; }",
      ".libre p{ max-width:170mm; }",
      ".fig{ display:flex; flex-direction:column; align-items:flex-start; gap:3pt; }",
      ".fig.cal-centre{ align-items:center; } .fig.cal-droite{ align-items:flex-end; }",
      ".fig img{ display:block; max-width:100%; height:auto; border-radius:3pt; }",
      ".fig-vide{ border:1px dashed var(--gris-clair); border-radius:4pt; background:var(--fond-tint); }",
      ".fig figcaption{ font-size:6.8pt; color:var(--gris); font-style:italic; }",
      ".saut{ height:0; }",


      /* ---- bandeau : une bande pleine, un grand mot ---- */
      ".bandeau{ display:flex; align-items:flex-end; justify-content:space-between; gap:12pt; padding:12pt 14pt 11pt 14pt;",
      "  border-radius:8pt; background:var(--vert); color:#fff; }",
      ".bandeau.ton-or{ background:var(--or); color:var(--encre); } .bandeau.ton-noir{ background:#15201A; }",
      ".bandeau.ton-clair{ background:var(--fond-bloc); color:var(--encre); }",
      ".bandeau .label{ color:inherit; opacity:.8; display:block; margin-bottom:4pt; }",
      ".bandeau h1{ font-family:'Gilroy',sans-serif; font-weight:800; font-size:22pt; line-height:1; letter-spacing:-.02em; text-transform:uppercase; color:inherit; }",
      ".bandeau .bandeau-sous{ font-size:8.6pt; margin-top:5pt; opacity:.9; max-width:120mm; }",
      ".bandeau .bandeau-droite{ text-align:right; font-family:'Gilroy',sans-serif; font-weight:700; font-size:9pt; line-height:1.3; white-space:nowrap; }",
      ".bandeau .bandeau-droite span{ display:block; font-family:'InterDoc',Inter,sans-serif; font-weight:400; font-size:7pt; opacity:.8; }",

      /* ---- grille : des lignes a completer, au clavier ou au stylo ---- */
      ".grille{ display:grid; grid-template-columns:1fr 1fr; gap:6pt 16pt; }",
      ".grille.col-1{ grid-template-columns:1fr; } .grille.col-3{ grid-template-columns:1fr 1fr 1fr; }",
      ".grille-champ{ display:flex; align-items:baseline; gap:5pt; border-bottom:1px dotted var(--gris-clair); padding-bottom:2.5pt; min-height:14pt; }",
      ".grille-champ.large{ grid-column:1 / -1; }",
      ".grille-champ .k{ font-size:6.4pt; font-weight:600; letter-spacing:.12em; text-transform:uppercase; color:var(--gris); white-space:nowrap; }",
      ".grille-champ .v{ flex:1; font-weight:500; color:var(--encre); min-height:1em; }",

      /* ---- cases : a cocher, sur la feuille ou au stylo ---- */
      ".cases{ display:flex; flex-direction:column; gap:4pt; }",
      ".cases.en-ligne{ flex-direction:row; flex-wrap:wrap; gap:6pt 18pt; }",
      ".case{ display:flex; align-items:flex-start; gap:6pt; }",
      ".case i{ flex:0 0 auto; width:9pt; height:9pt; border:1.1pt solid var(--encre); border-radius:2pt; margin-top:1.5pt; position:relative; }",
      ".case.cochee i::after{ content:''; position:absolute; left:2pt; top:0; width:3pt; height:5.5pt; border:solid var(--encre); border-width:0 1.4pt 1.4pt 0; transform:rotate(40deg); }",
      ".case span{ flex:1; }",

      /* ---- signature libre : un cadre vide, une mention ---- */
      ".sig-libre{ display:flex; gap:12pt; }",
      ".sig-libre-boite{ flex:1; border:1px solid var(--filet); border-radius:6pt; padding:6pt 8pt; min-height:58pt; display:flex; flex-direction:column; justify-content:space-between; }",
      ".sig-libre-boite .label{ display:block; }",
      ".sig-libre-boite .mention{ font-size:6.6pt; color:var(--gris); font-style:italic; }",

      /* ---- diplome : un cadre double, un grand titre, un nom ---- */
      ".diplome{ border:2pt solid var(--or); outline:1px solid var(--or); outline-offset:3pt; padding:26pt 30pt 24pt 30pt; text-align:center; position:relative; }",
      ".diplome .crest{ width:52pt; height:52pt; margin:0 auto 8pt auto; background-size:contain; background-repeat:no-repeat; background-position:center; }",
      ".diplome .diplome-club{ font-family:'Gilroy',sans-serif; font-weight:800; letter-spacing:.32em; text-transform:uppercase; font-size:8pt; color:var(--vert); }",
      ".diplome h1{ font-family:'Gilroy',sans-serif; font-weight:800; font-size:30pt; letter-spacing:.06em; text-transform:uppercase; color:var(--encre); margin:14pt 0 4pt 0; line-height:1; }",
      ".diplome .diplome-sous{ font-size:9pt; color:var(--gris); font-style:italic; }",
      ".diplome .diplome-prelude{ margin-top:18pt; font-size:9pt; color:var(--texte); }",
      ".diplome .diplome-nom{ font-family:'Gilroy',sans-serif; font-weight:700; font-size:22pt; color:var(--vert); margin:6pt 0 2pt 0; border-bottom:1px solid var(--or); display:inline-block; padding:0 18pt 3pt 18pt; min-width:90mm; }",
      ".diplome .diplome-motif{ margin:10pt auto 0 auto; max-width:130mm; font-size:9.4pt; line-height:1.5; }",
      ".diplome .diplome-date{ margin-top:16pt; font-size:8pt; color:var(--gris); letter-spacing:.08em; text-transform:uppercase; }",
      ".diplome .diplome-signs{ display:flex; justify-content:space-around; gap:20pt; margin-top:22pt; }",
      ".diplome .diplome-sign{ flex:1; max-width:70mm; font-size:7.4pt; }",
      ".diplome .diplome-sign .diplome-sign-nom{ border-top:1px solid var(--encre); padding-top:4pt; }",
      ".diplome .diplome-sign b{ display:block; font-size:8pt; }",
      ".diplome .diplome-sign .ink-zone{ height:16mm; position:relative; margin:0; }",
      ".diplome .diplome-sign .sig-ink{ left:50%; transform:translateX(-50%); bottom:2pt; width:40mm; }",
      ".diplome .diplome-sign .sig-name{ font-size:17pt; }",
      ".diplome .diplome-sign .sig-paraphe{ width:30mm; }",

      /* ---- cartes : plusieurs par page, format carte de membre ---- */
      ".cartes{ display:flex; flex-wrap:wrap; gap:6mm 6mm; align-content:flex-start; }",
      ".carte{ width:85.6mm; height:54mm; border:1px solid var(--filet); border-radius:3mm; padding:4mm 4.5mm; position:relative; overflow:hidden; background:#fff; break-inside:avoid; display:flex; flex-direction:column; }",
      ".carte::before{ content:''; position:absolute; left:0; top:0; right:0; height:9mm; background:var(--vert); }",
      ".carte .carte-tete{ position:relative; color:#fff; display:flex; align-items:center; gap:3mm; height:5mm; margin:-1mm 0 3mm 0; }",
      ".carte .carte-tete .crest{ width:6mm; height:6mm; background-size:contain; background-repeat:no-repeat; background-position:center; filter:brightness(0) invert(1); }",
      ".carte .carte-tete b{ font-family:'Gilroy',sans-serif; font-weight:800; font-size:7.2pt; letter-spacing:.14em; text-transform:uppercase; color:#fff; }",
      ".carte .carte-tete span{ margin-left:auto; font-size:5.8pt; letter-spacing:.14em; text-transform:uppercase; color:var(--or); }",
      ".carte .carte-corps{ display:flex; gap:4mm; flex:1; }",
      ".carte .carte-photo{ width:22mm; height:28mm; border:1px dashed var(--gris-clair); border-radius:2mm; background:var(--fond-tint); display:flex; align-items:center; justify-content:center; font-size:5.5pt; color:var(--gris); text-align:center; padding:2mm; }",
      ".carte .carte-id{ flex:1; display:flex; flex-direction:column; gap:1.6mm; }",
      ".carte .carte-nom{ font-family:'Gilroy',sans-serif; font-weight:800; font-size:11pt; line-height:1.05; color:var(--encre); min-height:11pt; }",
      ".carte .carte-nom span{ display:inline-block; min-width:12mm; }",
      ".carte .carte-ligne > span:not(.k){ display:inline-block; min-width:14mm; }",
      ".carte .carte-photo img{ width:100%; height:100%; object-fit:cover; border-radius:1.5mm; }",
      ".carte .carte-ligne{ font-size:6.6pt; color:var(--texte); } .carte .carte-ligne .k{ color:var(--gris); letter-spacing:.1em; text-transform:uppercase; font-size:5.4pt; margin-right:2pt; }",
      ".carte .carte-pied{ display:flex; justify-content:space-between; align-items:flex-end; font-size:5.6pt; color:var(--gris); margin-top:auto; }",
      ".carte .carte-pied b{ font-family:'Gilroy',sans-serif; color:var(--vert); font-size:7pt; }",

      /* ---- talon : la partie a detacher d'un recu ---- */
      ".talon{ margin-top:14pt; border-top:1px dashed var(--gris-clair); padding-top:10pt; position:relative; }",
      ".talon::before{ content:'\\2702'; position:absolute; left:-2pt; top:-7pt; background:#fff; padding:0 3pt; color:var(--gris); font-size:9pt; }",
      ".talon-grille{ display:flex; gap:12pt; align-items:flex-start; }",
      ".talon-grille .talon-col{ flex:1; }",
      ".talon .label{ display:block; margin-bottom:2pt; }",
      ".talon b{ font-family:'Gilroy',sans-serif; font-size:9pt; }",

      /* ---- ligne de temps : les points d'un ordre du jour ---- */
      ".odj{ display:flex; flex-direction:column; }",
      ".odj-point{ display:flex; gap:10pt; padding:5pt 0; border-bottom:1px solid var(--filet); align-items:baseline; }",
      ".odj-point .art-num{ flex:0 0 auto; }",
      ".odj-point .odj-txt{ flex:1; } .odj-point .odj-txt b{ display:block; font-family:'Gilroy',sans-serif; font-size:8.8pt; }",
      ".odj-point .odj-duree{ flex:0 0 auto; font-size:6.6pt; color:var(--gris); letter-spacing:.1em; text-transform:uppercase; white-space:nowrap; }",

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
      "tfoot td{ padding:6pt; font-family:'InterDoc',Inter,sans-serif; font-weight:600; font-size:8.4pt;",
      "  color:var(--vert); border-top:1.4pt solid var(--vert); }",
      "td.a-centre,th.a-centre{ text-align:center; }",
      "td.a-droite,th.a-droite{ text-align:right; }",
      "th.th-rang{ padding-left:3pt; padding-right:3pt; text-overflow:clip; }",
      "td.f-rang{ font-family:'Gilroy',sans-serif; font-weight:700; font-size:7.6pt;",
      "  color:var(--or); letter-spacing:.04em; white-space:nowrap; padding-left:3pt; padding-right:3pt; }",
      "td.f-fort{ font-weight:500; color:var(--encre); font-size:8.2pt; }",
      "td.f-code{ letter-spacing:.035em; white-space:nowrap; font-size:8pt; }",
      "td.f-nombre{ font-family:'Gilroy',sans-serif; font-weight:700; color:var(--encre); }",
      ".q{ display:inline-block; font-size:6.2pt; font-weight:600; letter-spacing:.07em;",
      "  text-transform:uppercase; padding:2.4pt 6pt; border-radius:99pt; white-space:nowrap; }",
      ".q.ton-plein{ background:var(--vert); color:#fff; }",
      ".q.ton-doux{ background:#EDF1EE; color:var(--vert); }",

      /* ---- postes (un budget : des groupes de lignes, chacun son sous-total) ---- */
      ".poste{ border-top:1px solid var(--filet); padding:4pt 0 5pt 0; }",
      ".poste:last-of-type{ border-bottom:1px solid var(--filet); }",
      ".poste-tete{ display:flex; align-items:baseline; justify-content:space-between; gap:10pt; margin-bottom:3pt; }",
      ".poste-titre{ display:flex; align-items:baseline; gap:8pt; }",
      ".poste-titre .art-num{ flex:0 0 auto; }",
      ".poste-titre b{ font-family:'Gilroy',sans-serif; font-weight:700; font-size:8.7pt; color:var(--encre); }",
      ".poste-st{ font-family:'InterDoc',Inter,sans-serif; font-weight:600; font-size:8.2pt; color:var(--vert); white-space:nowrap; }",
      ".poste-st .label{ margin-right:5pt; }",
      ".poste table{ margin-left:27pt; width:calc(100% - 27pt); }",
      ".poste tbody td{ padding:2.6pt 5pt; font-size:7.5pt; border-bottom:1px solid var(--filet); }",
      ".poste tbody tr:last-child td{ border-bottom:0; }",
      ".poste td.f-calc{ color:var(--gris); font-size:7.1pt; }",
      ".f-calcule{ color:var(--gris); font-style:italic; }",
      ".poste td.f-montant{ font-family:'InterDoc',Inter,sans-serif; font-weight:600; color:var(--encre); white-space:nowrap; }",
      ".total-box{ display:flex; align-items:center; justify-content:space-between; gap:10pt;",
      "  background:var(--vert); color:#fff; border-radius:8pt; padding:7pt 13pt; margin-top:2pt; }",
      ".total-box .label{ color:rgba(255,255,255,.72); }",
      ".total-box b{ font-family:'Gilroy',sans-serif; font-weight:800; font-size:12pt; color:#fff; white-space:nowrap; }",

      /* ---- signatures ---- */
      ".closing-grid{ display:flex; gap:12pt; align-items:stretch; }",
      ".closing-left{ flex:1; padding-top:2pt; }",
      /* trois signataires ou plus : le lieu et la date passent au-dessus,
         les cartes se partagent la largeur, l'encre se fait plus petite */
      ".closing-col{ display:block; }",
      ".closing-col .closing-left{ margin-bottom:6pt; }",
      ".signs-row{ display:flex; gap:8pt; align-items:stretch; }",
      ".signs-row .sign-card{ flex:1 1 0; padding:6pt 8pt 5pt 8pt; }",
      ".signs-row .sign-who{ flex-direction:column; gap:1pt; white-space:normal; }",
      ".signs-row .sig-ink{ width:38mm; }",
      ".signs-row .sig-name{ font-size:16pt; }",
      ".signs-row .sig-paraphe{ width:30mm; }",
      ".signs-row .sig-cachet{ width:21mm; height:21mm; right:2mm; }",
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
      ".foot{ position:absolute; left:13mm; right:13mm; bottom:12mm; z-index:2;",
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
    if (typeof v === 'function') return v(d, ctx);
    /* « @titre » : la valeur de d.titre, ET le droit de la modifier
       directement sur la feuille. Un modèle qui écrit '@objet' au lieu
       de function (d) { return d.objet; } obtient les deux d'un coup. */
    if (typeof v === 'string' && v.charAt(0) === '@') return lire(d, v.slice(1));
    return v;
  }
  B.val = val;

  /* « blocs.3.texte » : on descend dans la donnée, sans jamais buter. */
  function lire(d, chemin) {
    var o = d, p = String(chemin).split('.');
    for (var i = 0; i < p.length; i++) { if (o == null) return undefined; o = o[p[i]]; }
    return o;
  }
  B.lire = lire;

  /* L'attribut qui relie un morceau de feuille à sa donnée. Le noyau
     rend modifiable tout ce qui le porte, et réécrit la donnée au
     chemin indiqué : « titre », « articles.2.texte »,
     « tables.membres.lignes.4.nom ». */
  function edit(v) {
    return (typeof v === 'string' && v.charAt(0) === '@') ? ' data-edit="' + v.slice(1) + '"' : '';
  }
  function editChemin(chemin) { return chemin ? ' data-edit="' + chemin + '"' : ''; }
  B.edit = edit;

  /* Un texte riche (paragraphes, puces, notes) dans son enveloppe
     modifiable quand il vient d'une donnée. */
  function texte(v, d, ctx, chemin) {
    var t = val(v, d, ctx);
    var attr = chemin ? editChemin(chemin) : edit(v);
    if (!attr) return U.paragraphes(t || '');
    return '<div class="txt"' + attr + '>' + U.paragraphes(t || '') + '</div>';
  }
  /* Un texte de bloc, d'où qu'il vienne, s'écrit sur la feuille :
       '@chemin'          la donnée elle-même, au chemin dit ;
       calculé, constant  une surcharge dans d.fixes, au chemin
                          « fixes.<bloc>.<champ> » ; le texte d'origine
                          reste disponible, et revient si l'on efface.
     C'est ce qui rend TOUT modifiable, sans exception, y compris le
     mandatement d'un ordre de mission ou la certification d'une annexe. */
  function slot(obj, cle, d, ctx, defaut, prefixe) {
    var v = obj ? obj[cle] : undefined;
    var declare = v !== undefined;
    if (typeof v === 'string' && v.charAt(0) === '@') return { t: val(v, d, ctx), a: edit(v), declare: true };
    var calc = val(v, d, ctx);
    if (calc == null || calc === '') calc = (defaut == null ? '' : defaut);
    if (ctx.bi == null) return { t: calc, a: '', declare: declare };
    var chemin = ctx.bi + '.' + (prefixe ? prefixe + '.' : '') + cle;
    var fixe = lire(d, 'fixes.' + chemin);
    return { t: fixe != null ? fixe : calc, a: editChemin('fixes.' + chemin), fixe: fixe != null, declare: declare };
  }
  B.slot = slot;

  /* Le même, pour un texte riche : paragraphes, puces, notes. */
  function slotTexte(obj, cle, d, ctx, defaut, prefixe) {
    var s = slot(obj, cle, d, ctx, defaut, prefixe);
    if (!s.a) return U.paragraphes(s.t || '');
    return '<div class="txt"' + s.a + '>' + U.paragraphes(s.t || '') + '</div>';
  }
  /* Un élément d'une ligne : <tag class="x" data-edit="…">texte</tag>, ou rien
     si le texte est vide et qu'aucun chemin ne permet d'en écrire un. */
  function ligne(tag, classe, s) {
    /* un texte vide ne s'affiche que s'il est déclaré par le modèle : on
       peut alors y écrire ; un texte que le modèle ne prévoit pas n'existe pas */
    if (!s.t && !(s.a && s.declare)) return '';
    return '<' + tag + (classe ? ' class="' + classe + '"' : '') + s.a + '>' + U.enLigne(s.t || '') + '</' + tag + '>';
  }

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


  /* ==================================================================
     LES COLONNES CALCULÉES
     Une colonne peut porter une formule sur les autres colonnes de la
     ligne : « quantite * prix », « montant * 0.18 », « (a + b) / 2 ».
     Les noms sont les clés des colonnes ; les nombres se lisent comme
     on les écrit (« 12 000 », « 3,5 »). Pas d'eval : une petite
     grammaire, quatre opérations et des parenthèses.
     ================================================================== */
  function nombreDe(v) {
    var n = parseFloat(String(v == null ? '' : v).replace(/[^\d.,-]/g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }
  function calculer(formule, valeurs) {
    var src = String(formule || ''), i = 0;
    function saute() { while (i < src.length && /\s/.test(src[i])) i++; }
    function facteur() {
      saute();
      if (src[i] === '(') { i++; var v = expr(); saute(); if (src[i] === ')') i++; return v; }
      if (src[i] === '-') { i++; return -facteur(); }
      var m = /^(\d+(?:[.,]\d+)?)/.exec(src.slice(i));
      if (m) { i += m[1].length; return parseFloat(m[1].replace(',', '.')); }
      var k = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(src.slice(i));
      if (k) { i += k[1].length; return nombreDe(valeurs[k[1]]); }
      throw new Error('formule');
    }
    function terme() {
      var v = facteur();
      for (;;) { saute(); var op = src[i]; if (op !== '*' && op !== '/' && op !== '×') break; i++; var w = facteur(); v = (op === '/') ? (w ? v / w : 0) : v * w; }
      return v;
    }
    function expr() {
      var v = terme();
      for (;;) { saute(); var op = src[i]; if (op !== '+' && op !== '-') break; i++; var w = terme(); v = op === '+' ? v + w : v - w; }
      return v;
    }
    if (!src.trim()) return 0;
    var r = expr(); saute();
    if (i < src.length) throw new Error('formule');
    return Math.round(r * 100) / 100;
  }
  B.calculer = calculer;
  /* « 15 000 × 9 », « 5 000 × 12 joueuses × 20 matchs », « 3,5 x 4 » :
     ce qu'on écrit dans une colonne Calcul devient un nombre. Les mots
     (unités, commentaires) tombent, × et x multiplient, l'espace des
     milliers disparaît, la virgule est décimale. */
  function evaluerCalcul(expr) {
    var e = String(expr == null ? '' : expr)
      .replace(/(\d)[ \u00a0\u202f]+(?=\d)/g, '$1')
      .replace(/[×xX]/g, '*').replace(/[÷:]/g, '/').replace(/,/g, '.')
      .replace(/[^\d.+\-*/() ]+/g, ' ')
      .replace(/\s+/g, ' ').trim();
    if (!e || !/\d/.test(e)) return NaN;
    try { return calculer(e, {}); } catch (err) { return NaN; }
  }
  B.evaluerCalcul = evaluerCalcul;
  /* le montant d'une ligne : la colonne montant si elle est écrite,
     sinon ce que dit sa colonne Calcul */
  B.montantLigne = function (table, l, cleMontant) {
    var brut = String(l[cleMontant] == null ? '' : l[cleMontant]).trim();
    if (brut) return nombreDe(brut);
    var calc = (table.colonnes || []).filter(function (c) { return c.forme === 'calc'; })[0];
    if (!calc) return 0;
    var n = evaluerCalcul(l[calc.cle]);
    return isNaN(n) ? 0 : n;
  };
  /* la valeur d'une cellule, calculée si la colonne a une formule */
  B.valeurCellule = function (table, ligne, col) {
    if (col && col.formule) { try { return calculer(col.formule, ligne || {}); } catch (e) { return NaN; } }
    if (col && col.total && B.montantLigne) return B.montantLigne(table || {}, ligne || {}, col.cle);
    return nombreDe(ligne ? ligne[col.cle] : '');
  };
  B.formuleValide = function (table, col) {
    try { var v = {}; (table.colonnes || []).forEach(function (c) { v[c.cle] = 1; }); calculer(col.formule, v); return true; } catch (e) { return false; }
  };

  function cellule(col, ligne, cfg) {
    var v = ligne[col.cle];
    if (col.formule) {
      /* une colonne calculée ne se tape pas : elle se lit */
      if (!Object.keys(ligne).some(function (k) { return String(ligne[k] == null ? '' : ligne[k]).trim(); })) return '';
      try { var n = calculer(col.formule, ligne); return U.ech(U.nombre(n)); } catch (e) { return '<span class="q ton-alerte">formule ?</span>'; }
    }
    v = (v == null ? '' : String(v));
    if (col.forme === 'pastille' && v) {
      var ton = (cfg.tonPastille && cfg.tonPastille(v, ligne)) || 'ton-doux';
      return '<span class="q ' + ton + '">' + U.enLigne(v) + '</span>';
    }
    return U.enLigne(v);
  }

  /* Les lignes utiles d'une table, chacune avec son rang d'origine :
     c'est ce rang qui sert de chemin d'édition, pas la place à l'écran. */
  function lignesUtiles(table) {
    var out = [];
    (table.lignes || []).forEach(function (l, i) {
      if (l && Object.keys(l).some(function (k) { return String(l[k] || '').trim(); })) out.push({ l: l, i: i });
    });
    return out;
  }

  B.tableau = function (cfg, d, ctx) {
    var table = (d.tables && d.tables[cfg.source]) || { colonnes: [], lignes: [] };
    var cols = (table.colonnes || []).filter(function (c) { return c && c.cle; });
    var lignes = lignesUtiles(table);
    if (!cols.length) return '';
    var nReelles = lignes.length;
    var suivant = (table.lignes || []).length;
    /* La grille s'imprime avec au moins « vide » lignes, remplies ou non :
       un tableau tiré vide ou à moitié se complète à la main. Le nombre
       est celui de la table (réglable depuis l'écran), sinon celui du
       modèle. Au-delà, une seule ligne vide suit la dernière, à l'écran
       seulement : c'est là qu'on tape la suivante. */
    var minimum = table.vide != null ? (parseInt(table.vide, 10) || 0) : (parseInt(cfg.vide, 10) || 0);
    for (var k = nReelles; k < minimum; k++) lignes.push({ l: {}, i: suivant + (k - nReelles), vide: true });
    if (nReelles >= minimum && (minimum || nReelles)) lignes.push({ l: {}, i: suivant, vide: true, suite: true });

    var numeroter = cfg.numeroter !== false;
    var poidsTotal = cols.reduce(function (s, c) { return s + (+c.poids || B.COLONNE_DEFAUT.poids); }, 0);
    var partRang = numeroter ? 6 : 0;
    var base = 100 / (poidsTotal + partRang);

    var colgroup = (numeroter ? '<col style="width:' + (partRang * base).toFixed(3) + '%">' : '')
      + cols.map(function (c) {
        return '<col style="width:' + (((+c.poids || B.COLONNE_DEFAUT.poids)) * base).toFixed(3) + '%">';
      }).join('');

    var thead = '<tr>' + (numeroter ? '<th class="a-centre th-rang"' + editChemin('fixes.' + ctx.bi + '.libelleRang') + '>' + U.enLigne(lire(d, 'fixes.' + ctx.bi + '.libelleRang') || 'N°') + '</th>' : '')
      + cols.map(function (c, j) {
        var a = c.align === 'centre' ? ' class="a-centre"' : (c.align === 'droite' ? ' class="a-droite"' : '');
        return '<th' + a + editChemin('tables.' + cfg.source + '.colonnes.' + j + '.titre') + '>' + U.enLigne(c.titre || '') + '</th>';
      }).join('') + '</tr>';

    var chemin = 'tables.' + cfg.source + '.lignes.';
    var tbody = lignes.map(function (r, k) {
      var l = r.l;
      var cls = [];
      if (!r.vide && cfg.enAvant && cfg.enAvant(l)) cls.push('enc');
      if (r.vide) cls.push('tr-vide');
      if (r.suite) cls.push('tr-suite');
      return '<tr' + (cls.length ? ' class="' + cls.join(' ') + '"' : '') + '>'
        + (numeroter ? '<td class="f-rang a-centre">' + U.deuxChiffres(k + 1) + '</td>' : '')
        + cols.map(function (c) {
          var contenu = cellule(c, l, cfg);
          if (c.total && !r.vide && !String(l[c.cle] == null ? '' : l[c.cle]).trim()) { var nCalc = B.montantLigne(table, l, c.cle); if (nCalc) contenu = '<span class="f-calcule">' + U.ech(U.nombre(nCalc)) + '</span>'; }
          return '<td' + classeCellule(c) + (c.formule ? ' data-calc="1"' : editChemin(chemin + r.i + '.' + c.cle)) + '>' + contenu + '</td>';
        }).join('') + '</tr>';
    }).join('');

    /* Un pied de tableau : la somme des colonnes marquées « total ». */
    var tfoot = '';
    var aTotal = cols.some(function (c) { return c.total; });
    if (aTotal && nReelles) {
      tfoot = '<tfoot><tr>'
        + (numeroter ? '<td></td>' : '')
        + cols.map(function (c, i) {
          if (!c.total) return '<td' + classeCellule(c) + (i === 0 ? editChemin('fixes.' + ctx.bi + '.libelleTotal') : '') + '>' + (i === 0 ? U.enLigne(lire(d, 'fixes.' + ctx.bi + '.libelleTotal') || 'Total') : '') + '</td>';
          var s = lignes.reduce(function (acc, r) {
            if (r.vide) return acc;
            var n = B.valeurCellule(table, r.l, c);
            return acc + (isNaN(n) ? 0 : n);
          }, 0);
          return '<td' + classeCellule(c) + '>' + U.ech(U.nombre(s)) + '</td>';
        }).join('') + '</tr></tfoot>';
    }

    return ligne('div', 'tab-titre', slot(cfg, 'titre', d, ctx))
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
      /* droite : un tableau de chaînes, ou de '@chemins' ; chaque ligne est un slot */
      var lignes = droite.map(function (l, i) {
        var s = slot({ l: l }, 'l', d, ctx, '', 'droite.' + i);
        return ligne(i === 0 ? 'b' : 'span', '', s);
      });
      var drapeau = val(cfg.drapeau, d, ctx);
      return '<header class="head"><div class="head-left"><div class="crest"' + fond(ctx) + '></div><div>'
        + ligne('div', 'wordmark', slot(cfg, 'nom', d, ctx, 'BAOBABS BASKET CLUB'))
        + ligne('div', 'tagline', slot(cfg, 'devise', d, ctx, 'Grandir ici. Régner partout.'))
        + '</div></div><div class="head-right">'
        + (drapeau === false ? '' :
            '<div class="flagbox"><span class="flagwrap">' + B.DRAPEAU + '</span>'
            + '<span class="flagtxt"' + slot(cfg, 'pays', d, ctx, 'République du Sénégal').a + '>'
            + U.ech(slot(cfg, 'pays', d, ctx, 'République du Sénégal').t).replace(/^(\S+)\s/, '$1<br>') + '</span></div>')
        + '<div class="meta">' + lignes.join('<br>') + '</div>'
        + '</div></header><div class="head-rule"></div><div class="head-rule-or"></div>';
    },

    titre: function (cfg, d, ctx) {
      var etiq = slot(cfg, 'etiquette', d, ctx), pastille = slot(cfg, 'pastille', d, ctx);
      var t = slot(cfg, 'texte', d, ctx), sous = slot(cfg, 'sous', d, ctx);
      return '<section class="hero avoid">'
        + ((etiq.t || pastille.t || etiq.a || pastille.a) ? '<div class="hero-top">'
            + ligne('span', 'label', etiq)
            + ((pastille.t || pastille.a) ? '<span class="pill' + (pastille.t ? '' : ' pill-vide') + '"><i></i>'
                + ligne('span', '', pastille) + '</span>' : '')
            + '</div>' : '')
        + '<h1' + t.a + '>' + U.enLigne(t.t || '') + '</h1>'
        + ligne('p', 'hero-sub', sous)
        + '</section>';
    },

    reperes: function (cfg, d, ctx) {
      var cells = (val(cfg.cellules, d, ctx) || []).filter(function (c) {
        return c && (c.chemin || String(c.valeur || '').trim());
      });
      if (!cells.length) return '';
      return '<section class="facts avoid">' + cells.map(function (c, j) {
        /* une case libre écrit dans sa donnée ; une case calculée, dans fixes */
        var L, V, S;
        if (c.chemin) {
          var ch = c.chemin + '.';
          L = { t: c.label, a: editChemin(ch + 'label') }; V = { t: c.valeur, a: editChemin(ch + 'valeur') }; S = { t: c.sous, a: editChemin(ch + 'sous') };
        } else {
          L = slot(c, 'label', d, ctx, '', 'cellules.' + j); V = slot(c, 'valeur', d, ctx, '', 'cellules.' + j); S = slot(c, 'sous', d, ctx, '', 'cellules.' + j);
        }
        return '<div class="fact">' + ligne('span', 'label', L) + ligne('b', '', V) + ligne('em', '', S) + '</div>';
      }).join('') + '</section>';
    },

    encadre: function (cfg, d, ctx) {
      var av = slot(cfg, 'avant', d, ctx), ap = slot(cfg, 'apres', d, ctx);
      return '<section class="encadre avoid">'
        + (cfg.etiquette != null ? ligne('span', 'label', slot(cfg, 'etiquette', d, ctx)) : '')
        + ligne('h2', '', slot(cfg, 'titre', d, ctx))
        + ((av.t || cfg.avant != null) ? slotTexte(cfg, 'avant', d, ctx) : '')
        + (cfg.verbe != null ? ligne('div', 'verbe', slot(cfg, 'verbe', d, ctx)) : '')
        + ((ap.t || cfg.apres != null) ? slotTexte(cfg, 'apres', d, ctx) : '')
        + '</section>';
    },

    /* Une partie peut porter des champs d'identité (« Née le », « CNI »).
       Renseigné, le champ s'imprime ; vide, il devient une ligne en
       pointillé, à compléter au stylo sur l'exemplaire signé. */
    parties: function (cfg, d, ctx) {
      var ps = val(cfg.parties, d, ctx) || [];
      return '<section class="parties avoid">' + ps.map(function (p, j) {
        var pre = 'parties.' + j;
        var champs = (p.champs || []).map(function (c, k) {
          var preC = pre + '.champs.' + k;
          var L = slot(c, 'label', d, ctx, '', preC), V = slot(c, 'valeur', d, ctx, '', preC);
          var v = String(V.t == null ? '' : V.t).trim();
          /* vide : une ligne pointillée, à remplir au stylo ; mais elle s'écrit aussi sur la feuille */
          return '<div class="party-champ' + (c.large ? ' large' : '') + '">'
            + '<span class="k"' + L.a + '>' + U.enLigne(L.t || '') + '</span><span class="k"> :</span>'
            + '<span class="' + (v ? 'v' : 'pointille') + '"' + V.a + '>' + U.enLigne(v) + '</span>'
            + '</div>';
        }).join('');
        var tx = slot(p, 'texte', d, ctx, '', pre);
        return '<div class="party">' + ligne('span', 'label', slot(p, 'label', d, ctx, '', pre))
          + ligne('div', 'party-nom', slot(p, 'nom', d, ctx, '', pre))
          + ((tx.t || p.texte != null) ? slotTexte(p, 'texte', d, ctx, '', pre) : '')
          + (champs ? '<div class="party-champs">' + champs + '</div>' : '')
          + ligne('div', 'party-tag', slot(p, 'tag', d, ctx, '', pre))
          + '</div>';
      }).join('') + '</section>';
    },

    /* La phrase qui ouvre les articles : « Il est convenu ce qui suit : ». */
    phrase: function (cfg, d, ctx) {
      return ligne('p', 'lead', slot(cfg, 'texte', d, ctx));
    },

    /* Un budget, un devis, un bilan : les lignes d'UN tableau, groupées
       par la colonne « groupe », chaque groupe avec son sous-total et le
       tout avec son total. Les autres colonnes s'affichent telles quelles :
       en ajouter une depuis l'écran suffit, comme pour tout tableau. */
    postes: function (cfg, d, ctx) {
      var table = (d.tables && d.tables[cfg.source]) || { colonnes: [], lignes: [] };
      var cols = (table.colonnes || []).filter(function (c) { return c && c.cle; });
      var lignes = lignesUtiles(table);
      var cleG = cfg.groupe, cleT = cfg.total;
      var chemin = 'tables.' + cfg.source + '.lignes.';
      var visibles = cols.filter(function (c) { return c.cle !== cleG; });
      if (!visibles.length || !lignes.length) return '';

      function montant(l) { return B.montantLigne(table, l, cleT); }
      function montantCalcule(l) { return !String(l[cleT] == null ? '' : l[cleT]).trim() && montant(l) > 0; }
      var unite = val(cfg.unite, d, ctx) || '';
      function somme(n) { return U.nombre(n) + (unite ? ' ' + unite : ''); }

      var ordre = [], groupes = {};
      lignes.forEach(function (r) {
        var g = String(r.l[cleG] || '').trim() || (val(cfg.sansGroupe, d, ctx) || 'Divers');
        if (!groupes[g]) { groupes[g] = []; ordre.push(g); }
        groupes[g].push(r);
      });

      var poidsTotal = visibles.reduce(function (s, c) { return s + (+c.poids || B.COLONNE_DEFAUT.poids); }, 0);
      var colgroup = visibles.map(function (c) {
        return '<col style="width:' + (((+c.poids || B.COLONNE_DEFAUT.poids)) * 100 / poidsTotal).toFixed(3) + '%">';
      }).join('');

      var total = 0;
      var html = ordre.map(function (g, gi) {
        var st = groupes[g].reduce(function (s, r) { return s + montant(r.l); }, 0);
        total += st;
        var rows = groupes[g].map(function (r) {
          var l = r.l;
          return '<tr>' + visibles.map(function (c) {
            var cl = c.cle === cleT ? ' class="f-montant a-droite"' : (c.forme === 'calc' ? ' class="f-calc"' : classeCellule(c));
            var v = String(l[c.cle] == null ? '' : l[c.cle]);
            if (c.cle === cleT && v.trim() && unite && v.indexOf(unite) === -1) v = U.nombre(montant(l)) + ' ' + unite;
            /* montant vide, calcul écrit : le montant se lit, en gris, et se remplace si on l'écrit */
            if (c.cle === cleT && montantCalcule(l)) return '<td' + cl.replace('"', '" data-calcule="1" ') + editChemin(chemin + r.i + '.' + c.cle) + '><span class="f-calcule">' + U.ech(U.nombre(montant(l)) + (unite ? ' ' + unite : '')) + '</span></td>';
            return '<td' + cl + editChemin(chemin + r.i + '.' + c.cle) + '>' + U.enLigne(v) + '</td>';
          }).join('') + '</tr>';
        }).join('');
        return '<div class="poste avoid"><div class="poste-tete"><div class="poste-titre">'
          + '<span class="art-num">' + U.deuxChiffres(gi + 1) + '</span>' + ligne('b', '', slot({ t: g }, 't', d, ctx, '', 'groupes.' + gi)) + '</div>'
          + '<div class="poste-st">' + ligne('span', 'label', slot(cfg, 'libelleSousTotal', d, ctx, 'Sous-total')) + U.ech(somme(st)) + '</div></div>'
          + '<table><colgroup>' + colgroup + '</colgroup><tbody>' + rows + '</tbody></table></div>';
      }).join('');

      return '<section class="postes">' + html + '</section>'
        + '<div class="total-box avoid">' + ligne('span', 'label', slot(cfg, 'titreTotal', d, ctx, 'Total')) + '<b>'
        + U.ech(somme(total)) + '</b></div>';
    },

    lettre: function (cfg, d, ctx) {
      return '<section class="lettre">'
        + ligne('p', 'salut', slot(cfg, 'salutation', d, ctx))
        + slotTexte(cfg, 'texte', d, ctx)
        + ligne('p', 'greet', slot(cfg, 'formule', d, ctx))
        + '</section>';
    },

    articles: function (cfg, d, ctx) {
      var arts = val(cfg.articles, d, ctx) || [];
      if (!arts.length) return '';
      var fixe = cfg.fige === true;   /* des articles calculés, sans chemin d'édition */
      return '<section class="arts">' + arts.map(function (a, i) {
        var ch = fixe ? '' : 'articles.' + i + '.';
        return '<article class="art avoid"><div class="art-num">' + U.deuxChiffres(i + 1) + '</div>'
          + '<div class="art-body"><div class="art-title"' + (ch ? editChemin(ch + 'titre') : '') + '>' + U.enLigne(a.titre) + '</div>'
          + texte(a.texte, d, ctx, ch ? ch + 'texte' : '') + '</div></article>';
      }).join('') + '</section>';
    },

    chips: function (cfg, d, ctx) {
      var cs = (val(cfg.chips, d, ctx) || []).filter(function (c) { return c && (c.valeur || c.chemin); });
      if (!cs.length) return '';
      return '<div class="chips">' + cs.map(function (c, j) {
        var L, V;
        if (c.chemin) { L = { t: c.label, a: editChemin(c.chemin + '.label') }; V = { t: c.valeur, a: editChemin(c.chemin + '.valeur') }; }
        else { L = slot(c, 'label', d, ctx, '', 'chips.' + j); V = slot(c, 'valeur', d, ctx, '', 'chips.' + j); }
        return '<div class="chip">' + ligne('span', 'label', L) + ligne('b', '', V) + '</div>';
      }).join('') + '</div>';
    },

    tableau: function (cfg, d, ctx) { return B.tableau(cfg, d, ctx); },

    /* Une carte : le lieu à gauche, la carte à droite. Deux cartes : elles
       se partagent la droite. Trois et plus (visa, signature, « lu et
       approuvé ») : le lieu passe au-dessus et les cartes prennent toute
       la largeur, sinon l'encre n'aurait plus la place de s'étaler. */
    signatures: function (cfg, d, ctx) {
      var gauche = val(cfg.gauche, d, ctx);
      var cartes = (val(cfg.cartes, d, ctx) || []);
      var enColonne = cartes.length > 2;
      var html = '<section class="closing avoid"><div class="closing-grid'
        + (enColonne ? ' closing-col' : (cartes.length > 1 ? ' signs-2' : '')) + '">';
      if (gauche) {
        /* lieuDate et note sont du HTML quand un modèle les calcule (un
           <b> autour de la date) : ils s'affichent tels quels tant qu'on
           ne les a pas réécrits ; réécrits, ce sont des textes */
        var ld = slot(gauche, 'lieuDate', d, ctx, '', 'gauche'), nt = slot(gauche, 'note', d, ctx, '', 'gauche');
        var rf = slot(gauche, 'reference', d, ctx, '', 'gauche');
        var brutLd = (!ld.fixe && !edit(gauche.lieuDate)) ? (ld.t || '') : U.ech(ld.t || '');
        var brutNt = (!nt.fixe && !edit(gauche.note)) ? (nt.t || '') : U.ech(nt.t || '');
        html += '<div class="closing-left">'
          + ((brutLd || ld.a) ? '<div class="place"' + ld.a + '>' + brutLd + '</div>' : '')
          + ((brutNt || nt.a) ? '<p class="closing-note"' + nt.a + '>' + brutNt + '</p>' : '')
          + (rf.t ? '<div class="ref">' + ligne('span', 'label', slot(gauche, 'libelleReference', d, ctx, 'Référence', 'gauche')) + ' ' + ligne('span', '', rf) + '</div>' : '')
          + '</div>';
      }
      var htmlCartes = cartes.map(function (c, j) { return B.carteSignature(c, d, ctx, 'cartes.' + j); }).join('');
      html += enColonne ? '<div class="signs-row">' + htmlCartes + '</div>' : htmlCartes;
      return html + '</div></section>';
    },

    annexe: function (cfg, d, ctx) {
      var inner = (cfg.contenu || []).map(function (b, j) { return B.rendre(b, d, ctx, ctx.bi + '_' + j); }).join('');
      if (!String(inner).replace(/<[^>]*>/g, '').trim() && !/table/.test(inner)) return '';
      var meta = val(cfg.meta, d, ctx) || [];
      var tt = slot(cfg, 'titre', d, ctx), ss = slot(cfg, 'sous', d, ctx);
      return '<section class="annexe">'
        + '<div class="ann-head"><div class="ann-head-left"><div class="crest"' + fond(ctx) + '></div>'
        + '<div class="ann-title"><span class="ann-t"' + tt.a + '>' + U.enLigne(tt.t || '') + '</span>'
        + ligne('span', '', ss) + '</div></div>'
        + (meta.length ? '<div class="ann-meta">' + meta.map(function (l, i) {
            return ligne(i === 0 ? 'b' : 'span', '', slot({ l: l }, 'l', d, ctx, '', 'meta.' + i));
          }).join('<br>') + '</div>' : '')
        + '</div>' + inner + '</section>';
    },

    certification: function (cfg, d, ctx) {
      var cartes = val(cfg.cartes, d, ctx) || [];
      var rf = slot(cfg, 'reference', d, ctx);
      return '<div class="closing-grid avoid" style="margin-top:12pt"><div class="certif">'
        + ligne('span', 'label', slot(cfg, 'etiquette', d, ctx, 'Certification'))
        + slotTexte(cfg, 'texte', d, ctx)
        + (rf.t ? '<div class="ref" style="margin-top:8pt">' + ligne('span', 'label', slot(cfg, 'libelleReference', d, ctx, 'Référence')) + ' ' + ligne('span', '', rf) + '</div>' : '')
        + '</div>' + cartes.map(function (c, j) { return B.carteSignature(c, d, ctx, 'cartes.' + j); }).join('') + '</div>';
    },

    espace: function (cfg, d, ctx) {
      return '<div style="height:' + (parseFloat(val(cfg.hauteur, d, ctx)) || 6) + 'pt"></div>';
    },

    /* Un texte libre : des paragraphes, des puces, des notes, et c'est
       tout. Le corps d'une attestation, d'une décision, d'une note. */
    texte: function (cfg, d, ctx) {
      return '<section class="libre">'
        + ligne('span', 'label', slot(cfg, 'etiquette', d, ctx))
        + ligne('h3', 'libre-titre', slot(cfg, 'titre', d, ctx))
        + slotTexte(cfg, 'texte', d, ctx)
        + '</section>';
    },

    /* Une image déposée (un plan, un logo de partenaire, une photo) :
       en base64 dans l'acte, largeur en mm, calée à gauche, au centre
       ou à droite. Sans image, un cadre gris dit où elle ira. */
    image: function (cfg, d, ctx) {
      var src = val(cfg.src, d, ctx);
      var l = parseFloat(val(cfg.largeur, d, ctx)) || 60;
      var cal = val(cfg.calage, d, ctx) || 'gauche';
      var legende = val(cfg.legende, d, ctx);
      var style = 'width:' + l + 'mm;';
      return '<figure class="fig cal-' + U.ech(cal) + '">'
        + (src ? '<img src="' + src + '" style="' + style + '" alt="">'
               : '<div class="fig-vide" style="' + style + 'height:' + Math.round(l * 0.6) + 'mm"></div>')
        + ligne('figcaption', '', slot(cfg, 'legende', d, ctx))
        + '</figure>';
    },

    /* Un saut de page : la mise en pages le reconnaît et ouvre une
       feuille neuve. Rien ne s'imprime. */
    saut: function () { return '<div class="saut"></div>'; },


    /* Une bande pleine avec un grand mot : convocation, communiqué,
       feuille de présence. Ton : vert (défaut), or, noir, clair. */
    bandeau: function (cfg, d, ctx) {
      var ton = val(cfg.ton, d, ctx) || 'vert';
      var droite = val(cfg.droite, d, ctx) || [];
      return '<section class="bandeau avoid ton-' + U.ech(ton) + '"><div>'
        + ligne('span', 'label', slot(cfg, 'etiquette', d, ctx))
        + ligne('h1', '', slot(cfg, 'texte', d, ctx))
        + ligne('div', 'bandeau-sous', slot(cfg, 'sous', d, ctx))
        + '</div>' + (droite.length ? '<div class="bandeau-droite">' + droite.map(function (l, i) {
            return ligne(i === 0 ? 'div' : 'span', '', slot({ l: l }, 'l', d, ctx, '', 'droite.' + i));
          }).join('') + '</div>' : '') + '</section>';
    },

    /* Des lignes « Étiquette : valeur », à compléter sur la feuille ou au
       stylo (une ligne pointillée quand c'est vide). champs : [{label,
       chemin|valeur, large}] ; colonnes : 1, 2 (défaut) ou 3. */
    grille: function (cfg, d, ctx) {
      var champs = val(cfg.champs, d, ctx) || [];
      var colonnes = parseInt(val(cfg.colonnes, d, ctx), 10) || 2;
      return '<section class="grille avoid col-' + colonnes + '">' + champs.map(function (c, j) {
        var L, V;
        if (c.chemin) { L = { t: c.label, a: c.labelChemin ? editChemin(c.labelChemin) : '', declare: !!c.labelChemin }; V = { t: lire(d, c.chemin), a: editChemin(c.chemin), declare: true }; }
        else { L = slot(c, 'label', d, ctx, '', 'champs.' + j); V = slot(c, 'valeur', d, ctx, '', 'champs.' + j); V.declare = true; }
        if (!L.a) { var Ls = slot({ label: c.label }, 'label', d, ctx, '', 'champs.' + j); L = { t: Ls.t, a: Ls.a }; }
        return '<div class="grille-champ' + (c.large ? ' large' : '') + '"><span class="k"' + L.a + '>' + U.enLigne(L.t || '') + '</span>'
          + '<span class="v"' + V.a + '>' + U.enLigne(V.t || '') + '</span></div>';
      }).join('') + '</section>';
    },

    /* Des cases à cocher : cases : [{texte, chemin (booléen)}] ; cochée
       depuis la donnée, sinon vide, à cocher au stylo. enLigne : côte à côte. */
    cases: function (cfg, d, ctx) {
      var cs = val(cfg.cases, d, ctx) || [];
      return '<section class="cases avoid' + (val(cfg.enLigne, d, ctx) ? ' en-ligne' : '') + '">'
        + ligne('span', 'label', slot(cfg, 'etiquette', d, ctx))
        + cs.map(function (c, j) {
          /* la case se coche sur la feuille : dans sa donnée si elle en a
             une, sinon dans les surcharges du bloc (fixes) */
          var chemin = c.chemin || ('fixes.' + ctx.bi + '.cases.' + j + '.cochee');
          var fixe = c.chemin ? null : lire(d, chemin);
          var coche = c.chemin ? !!lire(d, c.chemin) : (fixe != null ? !!fixe : !!c.cochee);
          return '<div class="case' + (coche ? ' cochee' : '') + '" data-case="' + U.ech(chemin) + '"><i></i>' + ligne('span', '', slot(c, 'texte', d, ctx, '', 'cases.' + j)) + '</div>';
        }).join('') + '</section>';
    },

    /* Une ou deux boîtes de signature vides, pour un parent, un tiers :
       boites : [{label, mention}]. */
    signatureLibre: function (cfg, d, ctx) {
      var boites = val(cfg.boites, d, ctx) || [{ label: 'Signature', mention: '' }];
      return '<section class="sig-libre avoid">' + boites.map(function (b, j) {
        return '<div class="sig-libre-boite">' + ligne('span', 'label', slot(b, 'label', d, ctx, '', 'boites.' + j))
          + ligne('span', 'mention', slot(b, 'mention', d, ctx, '', 'boites.' + j)) + '</div>';
      }).join('') + '</section>';
    },

    /* Un certificat, un diplôme : cadre double, blason, grand titre, le
       nom en évidence, le motif, la date, deux signatures. */
    diplome: function (cfg, d, ctx) {
      var signs = val(cfg.signatures, d, ctx) || [];
      return '<section class="diplome"><div class="crest"' + fond(ctx) + '></div>'
        + ligne('div', 'diplome-club', slot(cfg, 'club', d, ctx, 'Baobabs Basket Club'))
        + ligne('h1', '', slot(cfg, 'titre', d, ctx, 'Certificat'))
        + ligne('div', 'diplome-sous', slot(cfg, 'sous', d, ctx))
        + ligne('div', 'diplome-prelude', slot(cfg, 'prelude', d, ctx, 'est décerné à'))
        + '<div>' + ligne('span', 'diplome-nom', slot(cfg, 'nom', d, ctx)) + '</div>'
        + ligne('div', 'diplome-motif', slot(cfg, 'motif', d, ctx))
        + ligne('div', 'diplome-date', slot(cfg, 'date', d, ctx))
        + (signs.length ? '<div class="diplome-signs">' + signs.map(function (s, j) {
            var pre = 'signatures.' + j;
            var encre = (s.signer !== false && d.avecSignature !== false && !d.signatureDetachee)
              ? '<div class="ink-zone"><div class="sig-ink"><div class="sig-name">' + U.ech(U.initialeNom(slot(s, 'nom', d, ctx, '', pre).t)) + '</div><div class="sig-paraphe">' + B.PARAPHE + '</div></div></div>' : '<div class="ink-zone"></div>';
            return '<div class="diplome-sign">' + encre + '<div class="diplome-sign-nom">' + ligne('b', '', slot(s, 'nom', d, ctx, '', pre)) + ligne('span', '', slot(s, 'qualite', d, ctx, '', pre)) + '</div></div>';
          }).join('') + '</div>' : '')
        + '</section>';
    },

    /* Des cartes au format carte de membre (85,6 × 54 mm), une par ligne
       d'un tableau : source, et les clés nom, prenom, categorie, licence,
       saison. Huit par page, à découper. */
    cartes: function (cfg, d, ctx) {
      var t = (d.tables && d.tables[cfg.source]) || { lignes: [] };
      var reelles = lignesUtiles(t);
      var min = parseInt(val(cfg.vide, d, ctx), 10) || 0;
      var suivant = (t.lignes || []).length;
      var lignes = reelles.slice();
      for (var k = reelles.length; k < min; k++) lignes.push({ l: {}, i: suivant + (k - reelles.length), vide: true });
      if (!lignes.length) return '';
      var chemin = 'tables.' + cfg.source + '.lignes.';
      var club = slot(cfg, 'club', d, ctx, 'Baobabs Basket Club'), role = slot(cfg, 'role', d, ctx, 'Carte de membre');
      var saison = slot(cfg, 'saison', d, ctx, ''), pied = slot(cfg, 'pied', d, ctx, '');
      /* chaque champ d'une carte s'écrit sur la feuille, comme une case de
         tableau ; une carte vierge est une ligne à venir du tableau */
      function champ(r, cle, classe) {
        return '<span' + (classe ? ' class="' + classe + '"' : '') + editChemin(chemin + r.i + '.' + cle) + '>' + U.enLigne(r.l[cle] || '') + '</span>';
      }
      return '<section class="cartes pg-groupe">' + lignes.map(function (r) {
        var l = r.l;
        return '<div class="carte"><div class="carte-tete"><div class="crest"' + fond(ctx) + '></div>' + ligne('b', '', club) + ligne('span', '', role) + '</div>'
          + '<div class="carte-corps"><div class="carte-photo" data-photo="' + chemin + r.i + '.photo" title="Cliquer pour déposer une photo">' + (l.photo ? '<img src="' + l.photo + '" alt="">' : '<span>Photo</span>') + '</div>'
          + '<div class="carte-id"><div class="carte-nom">' + champ(r, 'prenom') + ' ' + champ(r, 'nom') + '</div>'
          + '<div class="carte-ligne">' + ligne('span', 'k', slot(cfg, 'libCategorie', d, ctx, 'Catégorie')) + champ(r, 'categorie') + '</div>'
          + '<div class="carte-ligne">' + ligne('span', 'k', slot(cfg, 'libLicence', d, ctx, 'Licence')) + champ(r, 'licence') + '</div>'
          + '<div class="carte-ligne">' + ligne('span', 'k', slot(cfg, 'libNaissance', d, ctx, 'Née le')) + champ(r, 'naissance') + '</div>'
          + '</div></div>'
          + '<div class="carte-pied">' + ligne('span', '', pied) + ligne('b', '', saison) + '</div></div>';
      }).join('') + '</section>';
    },

    /* Le talon d'un reçu : la même information, à détacher pour le club. */
    talon: function (cfg, d, ctx) {
      var cols = val(cfg.colonnes, d, ctx) || [];
      return '<section class="talon avoid">'
        + ligne('span', 'label', slot(cfg, 'etiquette', d, ctx, 'Talon à conserver par le club'))
        + '<div class="talon-grille">' + cols.map(function (c, j) {
          return '<div class="talon-col">' + ligne('span', 'label', slot(c, 'label', d, ctx, '', 'colonnes.' + j)) + ligne('b', '', slot(c, 'valeur', d, ctx, '', 'colonnes.' + j)) + '</div>';
        }).join('') + '</div></section>';
    },

    /* Les points d'un ordre du jour, numérotés, avec leur durée. */
    ordreDuJour: function (cfg, d, ctx) {
      var pts = val(cfg.points, d, ctx) || [];
      if (!pts.length) return '';
      return '<section class="odj">' + pts.map(function (p, i) {
        var pre = 'points.' + i;
        return '<div class="odj-point avoid"><span class="art-num">' + U.deuxChiffres(i + 1) + '</span><div class="odj-txt">'
          + ligne('b', '', slot(p, 'titre', d, ctx, '', pre)) + ligne('span', '', slot(p, 'texte', d, ctx, '', pre)) + '</div>'
          + ligne('span', 'odj-duree', slot(p, 'duree', d, ctx, '', pre)) + '</div>';
      }).join('') + '</section>';
    },

    html: function (cfg, d, ctx) { return val(cfg.contenu, d, ctx) || ''; }
  };

  /* La carte de signature, partagée par « signatures » et
     « certification » : une seule définition de l'encre. */
  B.carteSignature = function (c, d, ctx, prefixe) {
    var nom = slot(c, 'nom', d, ctx, '', prefixe), qualite = slot(c, 'qualite', d, ctx, '', prefixe);
    var pour = slot(c, 'pour', d, ctx, '', prefixe), mention = slot(c, 'mention', d, ctx, 'Signature et cachet', prefixe);
    var encre = '';
    /* détachés de la carte à la souris, l'encre et le cachet vivent en objets posés */
    if (d.avecSignature !== false && c.signer !== false && !d.signatureDetachee) {
      encre += '<div class="sig-ink"><div class="sig-name">'
        + U.ech(U.initialeNom(nom.t)) + '</div>'
        + '<div class="sig-paraphe">' + B.PARAPHE + '</div></div>';
    }
    if (d.avecCachet !== false && c.cacheter !== false && ctx.res && ctx.res.cachet && !d.cachetDetache) {
      encre += '<div class="sig-cachet" style="background-image:url(' + ctx.res.cachet + ')"></div>';
    }
    return '<div class="sign-card">'
      + '<span class="label"' + pour.a + '>' + U.enLigne(pour.t || '') + '</span>'
      + '<div class="sign-who"><span class="sign-name"' + nom.a + '>' + U.enLigne(nom.t || '') + '</span>'
      + '<span class="sign-role"' + qualite.a + '>' + U.enLigne(qualite.t || '') + '</span></div>'
      + '<div class="ink-zone">' + encre + '</div>'
      + '<div class="sign-cta"' + mention.a + '>' + U.enLigne(mention.t || '') + '</div>'
      + '</div>';
  };

  /* ==================================================================
     LE MONTAGE
     ================================================================== */
  /* Chaque bloc porte son index (b3, b5_2 dans une annexe) : c'est la
     clé de ses surcharges de texte (fixes) et de son style (styles). */
  B.rendre = function (bloc, d, ctx, bi) {
    if (!bloc || !bloc.b) return '';
    if (bloc.si && !val(bloc.si, d, ctx)) return '';
    var f = B.rendus[bloc.b];
    if (!f) return '<!-- bloc inconnu : ' + U.ech(bloc.b) + ' -->';
    var avant = ctx.bi;
    ctx.bi = bi != null ? bi : ctx.bi;
    var html = f(bloc, d, ctx);
    var cle = ctx.bi;
    ctx.bi = avant;
    if (!html) return '';
    if (bloc.b === 'annexe') return html;
    var st = (d.styles && cle != null) ? d.styles[cle] : null;
    var classes = 'bloc';
    var style = '';
    if (st) {
      if (st.align && st.align !== 'gauche') classes += ' al-' + st.align;
      if (st.theme) classes += ' th-' + st.theme;
      if (st.police) classes += ' po-' + st.police;
      if (st.taille && +st.taille !== 100) style = ' style="zoom:' + (+st.taille / 100) + '"';
    }
    return '<div class="' + classes + '"' + (cle != null ? ' data-bloc="' + cle + '"' : '') + style + '>' + html + '</div>';
  };

  /* ==================================================================
     LA MISE EN PAGES
     Le navigateur sait couper un flux en pages à l'impression, mais il
     ne montre pas ces pages à l'écran et ne dit pas où il coupe. On
     coupe donc nous-mêmes : le document devient une suite de feuilles
     A4 explicites, les mêmes à l'écran et sur le papier, chacune avec
     son filigrane et son pied.

     Les unités de coupe : un bloc entier, sauf pour les articles (un
     article), les postes (un poste), les tableaux (une ligne, l'en-tête
     étant repris sur chaque page) et les annexes (qui ouvrent une
     page). Une unité qui ne tient pas part sur la page suivante ; si
     elle dépasse une page entière, elle reste et déborde : on ne coupe
     jamais dans un texte.
     ================================================================== */
  B.PAGE = { l: 210, h: 297, haut: 11, droite: 13, bas: 12, gauche: 13 };

  B.paginer = function (doc) {
    var wrap = doc.querySelector('.wrap');
    if (!wrap) return doc.querySelectorAll('.page').length || 1;
    var foot = doc.querySelector('footer.foot');
    var wm = doc.querySelector('.wm');

    var pages = doc.createElement('div');
    pages.className = 'pages';
    doc.body.appendChild(pages);
    var corps = null, courant = null, groupes = [];

    function nouvellePage() {
      var page = doc.createElement('section');
      page.className = 'page';
      if (wm) page.appendChild(wm.cloneNode(true));
      corps = doc.createElement('div');
      corps.className = 'corps';
      page.appendChild(corps);
      if (foot) page.appendChild(foot.cloneNode(true));
      pages.appendChild(page);
      courant = null;
    }
    function deborde() { return corps.scrollHeight > corps.clientHeight + 1; }
    function vide() { return corps.children.length === 0; }

    /* ---- les unités, dans l'ordre de lecture ---- */
    var unites = [];
    function pousser(el, g) { unites.push({ el: el, g: g || null }); }

    function groupe(bloc, chercher, selecteur) {
      var cont = chercher(bloc);
      var g = { bloc: bloc, chercher: chercher, n: 0, tfoot: null, derniere: null };
      groupes.push(g);
      Array.prototype.slice.call(cont.querySelectorAll(selecteur)).forEach(function (e) { pousser(e, g); });
    }
    function enveloppe(el) {
      var w = doc.createElement('div'); w.className = 'bloc'; w.appendChild(el); return w;
    }
    function eclater(bloc) {
      if (bloc.querySelector(':scope > .saut')) { unites.push({ saut: true }); return; }
      if (bloc.querySelector(':scope > .arts')) {
        return groupe(bloc, function (b) { return b.querySelector(':scope > .arts'); }, ':scope > .art');
      }
      if (bloc.querySelector(':scope > .postes')) {
        var total = bloc.querySelector(':scope > .total-box');
        groupe(bloc, function (b) { return b.querySelector(':scope > .postes'); }, ':scope > .poste');
        if (total) pousser(enveloppe(total));
        return;
      }
      if (bloc.querySelector(':scope > table')) {
        return groupe(bloc, function (b) { return b.querySelector(':scope > table > tbody'); }, ':scope > tr');
      }
      /* Un texte riche (le corps d'une lettre, d'une attestation, d'une
         note) se coupe entre deux paragraphes : ce qui ne tient plus au
         pied de la page continue sur la suivante, dans la même enveloppe,
         sans son titre. Ce qui suit le texte (une formule de politesse)
         attend le dernier morceau. */
      var txt = bloc.querySelector('.txt, .pg-groupe');
      if (txt && txt.children.length > 1) {
        txt.setAttribute('data-pg', 'txt');
        var g = { bloc: bloc, chercher: function (b) { return b.querySelector('[data-pg="txt"]'); }, n: 0, tfoot: null, derniere: null, texte: txt };
        groupes.push(g);
        Array.prototype.slice.call(txt.children).forEach(function (e) { pousser(e, g); });
        return;
      }
      pousser(bloc);
    }
    function eclaterAnnexe(section) {
      unites.push({ saut: true });
      Array.prototype.slice.call(section.children).forEach(function (c) {
        if (c.classList.contains('bloc')) eclater(c); else pousser(enveloppe(c));
      });
    }
    Array.prototype.slice.call(wrap.children).forEach(function (n) {
      if (n.classList.contains('annexe')) eclaterAnnexe(n);
      else if (n.classList.contains('bloc')) eclater(n);
      else pousser(n);
    });

    /* ---- poser chaque unité, page après page ---- */
    function cibleDe(u) {
      if (!u.g) return corps;
      var g = u.g;
      if (courant && courant.g === g) return courant.cible;
      var sq = g.bloc.cloneNode(true);
      var cont = g.chercher(sq);
      while (cont.firstChild) cont.removeChild(cont.firstChild);
      /* la suite d'un tableau ne répète ni son titre ni son total */
      if (g.n > 0) {
        var titre = sq.querySelector('.tab-titre');
        if (titre) titre.parentNode.removeChild(titre);
      }
      var tf = sq.querySelector('tfoot');
      if (tf) { if (!g.tfoot) g.tfoot = tf; tf.parentNode.removeChild(tf); }
      if (g.texte) {
        /* à chaque niveau entre le texte et le bloc : ce qui suit part
           (il reviendra au dernier morceau), et, en suite, ce qui précède aussi */
        var noeud = cont;
        while (noeud && noeud !== sq) {
          var parent = noeud.parentNode, freres = Array.prototype.slice.call(parent.children), i = freres.indexOf(noeud);
          freres.forEach(function (k, j) { if (j > i || (j < i && g.n > 0)) parent.removeChild(k); });
          noeud = parent;
        }
      }
      corps.appendChild(sq);
      courant = { g: g, cible: cont, sq: sq };
      g.n++;
      g.derniere = cont;
      return cont;
    }
    function retirer(u, cible) {
      cible.removeChild(u.el);
      if (u.g && cible.children.length === 0) {
        corps.removeChild(courant.sq);
        u.g.n--; courant = null;
      }
    }
    function placer(u) {
      var cible = cibleDe(u);
      cible.appendChild(u.el);
      if (!deborde()) return;
      retirer(u, cible);
      if (vide()) {
        /* seule sur une page vide et trop haute quand même : elle reste */
        cibleDe(u).appendChild(u.el);
        return;
      }
      nouvellePage();
      cibleDe(u).appendChild(u.el);
    }

    nouvellePage();
    unites.forEach(function (u) {
      if (u.saut) { if (!vide()) nouvellePage(); return; }
      placer(u);
    });
    groupes.forEach(function (g) {
      if (g.tfoot && g.derniere && g.derniere.parentNode) g.derniere.parentNode.appendChild(g.tfoot);
      if (g.texte && g.derniere) {
        /* ce qui suivait le texte dans le bloc d'origine rejoint le dernier morceau */
        var orig = g.texte, noeud = g.derniere;
        while (orig && orig !== g.bloc && noeud && noeud.parentNode) {
          var suivants = [], s = orig.nextElementSibling;
          while (s) { suivants.push(s); s = s.nextElementSibling; }
          var pNoeud = noeud.parentNode;
          suivants.forEach(function (x) { pNoeud.appendChild(x); });
          orig = orig.parentNode; noeud = pNoeud;
        }
      }
    });

    doc.body.removeChild(wrap);
    if (foot) doc.body.removeChild(foot);
    if (wm) doc.body.removeChild(wm);
    doc.body.classList.add('pagine');
    return pages.children.length;
  };

  B.assembler = function (modele, d, ctx) {
    var corps = (val(modele.page, d, ctx) || []).map(function (b, i) { return B.rendre(b, d, ctx, 'b' + i); }).join('\n');
    var pied = val(modele.pied, d, ctx) || [];
    /* le pied de page aussi s'écrit sur la feuille : fixes.pied.0, fixes.pied.1 */
    var p0 = lire(d, 'fixes.pied.0'), p1 = lire(d, 'fixes.pied.1');
    if (p0 == null) p0 = pied[0] || ''; if (p1 == null) p1 = pied[1] || '';
    return '<div class="wm"><div class="wm-blason"' + fond(ctx) + '></div>'
      + (ctx.brouillon ? '<div class="wm-brouillon">BROUILLON</div>' : '') + '</div>'
      + '<div class="wrap">' + corps + '</div>'
      + ((pied.length || p0 || p1)
          ? '<footer class="foot"><i></i><span data-edit="fixes.pied.0">' + U.enLigne(p0) + '</span>'
            + '<span class="right" data-edit="fixes.pied.1">' + U.enLigne(p1) + '</span></footer>'
          : '');
  };

})(window.BaobabsGreffe);
