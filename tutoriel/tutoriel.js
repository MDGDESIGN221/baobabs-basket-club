/* =====================================================================
   TUTORIEL DE L'ADMINISTRATION
   Un seul global : window.BaobabsTutoriel — mount(el, api) puis open().

   L'IDÉE, ET POURQUOI ELLE TIENT
   Ce fichier ne contient AUCUN texte de tutoriel. Pas une phrase sur
   l'effectif, pas une sur la billetterie. Tout est lu chez l'hôte :

     · le plan des chapitres        <- la barre latérale, telle qu'elle
                                       est affichée, donc déjà filtrée
                                       par le rôle de la personne ;
     · le titre de chaque écran     <- SECTION_META ;
     · ce qu'on en dit              <- SECTION_HELP, les 131 conseils
                                       déjà écrits dans les bulles
                                       « Comment ça marche ? ».

   Conséquence directe : un écran ajouté demain entre dans le tutoriel
   sans qu'on touche à ce fichier, une bulle corrigée corrige le
   tutoriel, et un rôle qui n'a pas la boutique n'entend jamais parler
   de la boutique. Une vidéo ne sait faire aucune des trois.
   ===================================================================== */
(function () {
  'use strict';

  var api = null, racine = null, monte = false;

  var plan = [];            // [{cle, titre, ecrans:[{cle, nom}]}]
  var etapes = [];          // la visite en cours, à plat
  var idx = 0;
  var chapCourant = null;   // clé du chapitre en cours, 'tout' si enchaînement
  var enLecture = false;
  var minuteur = null;
  var chien = null;         // chien de garde de la voix (voir dire())
  var tPointe = null;       // attente de fin de defilement avant de pointer
  var cibleCourante = null; // l element designe, pour le recalage au scroll
  var demoEcran = null;     // l'ecran dont la demonstration est en cours
  var demoPhoto = {};       // valeurs d'origine des champs touches
  var frappe = null;        // minuteur de la frappe lettre par lettre
  var voixOn = false;
  var voixFr = null;
  var progres = { vus: {}, dernier: null };

  var CLE_PROGRES = 'bbc_tut_progres';
  var CLE_VOIX = 'bbc_tut_voix';

  // ===================================================================
  // Petits outils
  // ===================================================================
  function $(id) { return racine.querySelector('#' + id); }
  // textContent colle les blocs entre eux : « <b>Administration</b>Tout,
  // sans exception » ressort en « AdministrationTout, sans exception ».
  // À l'œil ça ne se voit pas — le <b> est en display:block — mais la
  // voix, elle, le lit d'un seul souffle. On rend leur point aux fins
  // de bloc avant de dépouiller les balises.
  function texteSeul(html) {
    var s = String(html == null ? '' : html)
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(b|strong|div|p|li|tr|h[1-6])>/gi, '. ');
    var d = document.createElement('div');
    d.innerHTML = s;
    return (d.textContent || '')
      .replace(/\s+/g, ' ')
      .replace(/\s+\./g, '.')
      .replace(/\.(\s*\.)+/g, '.')
      .trim();
  }

  // Ce qui se lit à l'œil ne se prononce pas. « → » est un silence chez
  // un moteur et « flèche vers la droite » chez le suivant ; les
  // symboles du tableau ne veulent rien dire une fois dits.
  function pourLaVoix(html) {
    return texteSeul(html)
      .replace(/→/g, ' puis ')
      .replace(/✓/g, ' peut consulter et modifier ')
      .replace(/○/g, ' peut consulter seulement ')
      .replace(/·/g, ' ')
      .replace(/…/g, '...')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function mots(s) { return texteSeul(s).split(/\s+/).filter(Boolean).length; }
  function minutes(n) { return Math.max(1, Math.round(n / 150)); }

  function lireProgres() {
    try {
      var b = JSON.parse(localStorage.getItem(CLE_PROGRES) || '{}');
      progres = { vus: b.vus || {}, dernier: b.dernier || null };
    } catch (e) { progres = { vus: {}, dernier: null }; }
  }
  function ecrireProgres() {
    try { localStorage.setItem(CLE_PROGRES, JSON.stringify(progres)); } catch (e) {}
  }

  // ===================================================================
  // LA VOIX
  // Trois pièges, et ils se manifestent tous en silence :
  //   1. getVoices() est vide au premier appel sur Chrome — la liste
  //      arrive par l'événement voiceschanged, parfois une seconde plus
  //      tard ;
  //   2. speak() lancé sans geste de l'utilisateur est ignoré sans
  //      erreur — d'où le déclenchement uniquement après un clic ;
  //   3. Chrome coupe une élocution qui dépasse ~15 s sans prévenir et
  //      n'appelle jamais onend. Un chien de garde reprend la main,
  //      sinon la visite se fige sur une étape, pour toujours.
  // ===================================================================
  function voixDispo() { return typeof window.speechSynthesis !== 'undefined'; }

  function choisirVoix() {
    if (!voixDispo()) return null;
    var vs = window.speechSynthesis.getVoices() || [];
    var fr = vs.filter(function (v) { return /^fr(-|_|$)/i.test(v.lang || ''); });
    if (!fr.length) return null;
    // Une voix locale ne dépend pas du réseau : sur un stade sans 4G,
    // c'est la seule qui parlera.
    return fr.filter(function (v) { return v.localService; })[0] || fr[0];
  }

  function preparerVoix() {
    if (!voixDispo()) return;
    voixFr = choisirVoix();
    if (!voixFr) {
      window.speechSynthesis.addEventListener('voiceschanged', function once() {
        window.speechSynthesis.removeEventListener('voiceschanged', once);
        voixFr = choisirVoix();
        majNoteVoix();
      });
    }
    majNoteVoix();
  }

  function majNoteVoix() {
    var note = $('bt-voix-note'); if (!note) return;
    if (!voixDispo()) { note.textContent = 'Ce navigateur ne sait pas lire à voix haute — le texte reste affiché.'; return; }
    if (!voixFr) { note.textContent = 'Aucune voix française installée sur cet appareil — le texte reste affiché.'; return; }
    note.textContent = '';
  }

  function taire() {
    if (voixDispo()) { try { window.speechSynthesis.cancel(); } catch (e) {} }
    if (chien) { clearTimeout(chien); chien = null; }
  }

  // Rend true si la voix a pris le relai, false s'il faut un minuteur.
  function dire(html, fini) {
    if (!voixOn || !voixDispo() || !voixFr) return false;
    taire();
    var t = pourLaVoix(html);
    if (!t) return false;
    var u = new SpeechSynthesisUtterance(t);
    u.voice = voixFr; u.lang = voixFr.lang || 'fr-FR';
    u.rate = 1.02; u.pitch = 1; u.volume = 1;
    var rendu = false;
    function unefois() { if (rendu) return; rendu = true; if (chien) { clearTimeout(chien); chien = null; } fini(); }
    u.onend = unefois;
    u.onerror = unefois;
    // Piège 3 : la sécurité qui empêche la visite de se figer.
    chien = setTimeout(unefois, dureeEstimee(html) + 6000);
    try { window.speechSynthesis.speak(u); } catch (e) { return false; }
    return true;
  }

  function dureeEstimee(html) {
    // ~150 mots/minute à voix haute, plancher confortable pour les
    // étapes d'une seule ligne, plafond pour ne pas endormir.
    var n = mots(html);
    return Math.min(16000, Math.max(3800, 900 + n * 400));
  }

  function reglerVoix(on) {
    voixOn = !!on;
    try { localStorage.setItem(CLE_VOIX, voixOn ? '1' : '0'); } catch (e) {}
    var l = $('bt-voix'), c = $('bt-voix-case'), t = $('bt-voix-txt'), b2 = $('bt-voix2');
    if (l) l.classList.toggle('on', voixOn);
    if (c) c.checked = voixOn;
    if (t) t.textContent = voixOn ? 'Voix activée' : 'Lire à voix haute';
    if (b2) b2.classList.toggle('on', voixOn);
    if (!voixOn) taire();
  }

  // ===================================================================
  // LE PLAN
  // ===================================================================
  function construirePlan() {
    plan = [];

    // Chapitre 0 : les rôles. Il n'a pas d'écran à visiter — il se
    // raconte dans le narrateur. C'est la question exacte que pose le
    // président, elle mérite d'ouvrir le tutoriel et pas d'être
    // reléguée en fin de parcours.
    plan.push({ cle: '_roles', titre: 'Les rôles et les accès', ecrans: [], special: true });

    (api.plan() || []).forEach(function (g) {
      if (!g.ecrans || !g.ecrans.length) return;
      plan.push({ cle: 'g' + plan.length, titre: g.titre, ecrans: g.ecrans });
    });
  }

  // Les étapes d'un écran : son intention, puis ses conseils.
  function etapesEcran(e) {
    var out = [];
    var meta = (api.metas && api.metas[e.cle]) || null;
    out.push({
      ecran: e.cle, nom: e.nom, halo: true,
      html: meta && meta.d ? meta.d : ('L’écran ' + e.nom + '.')
    });
    // Chaque conseil peut porter une cible : le selecteur de la chose
    // dont il parle. La table vit chez l'hote (TUT_CIBLES), a cote des
    // conseils eux-memes -- separer les deux garantirait qu'ils
    // divergent a la premiere retouche.
    var aides = (api.aides && api.aides[e.cle]) || [];
    var vise = (api.cibles && api.cibles[e.cle]) || [];

    // LE GARDE-FOU. Le jour où l'on ajoutera un conseil sans toucher aux
    // cibles, les deux tables se décalent d'un cran : la main irait
    // désigner le champ dont parlait la phrase PRÉCÉDENTE. Rien ne
    // planterait, rien ne s'afficherait — le tutoriel se contenterait
    // de mentir tranquillement. On préfère renoncer aux cibles de cet
    // écran entier, et le dire en console.
    if (vise.length && vise.length !== aides.length) {
      try {
        console.warn('[Tutoriel] « ' + e.cle +' » : ' + aides.length + ' conseils pour ' +
          vise.length + ' cibles. Table TUT_CIBLES ignorée pour cet écran — réalignez-la.');
      } catch (err) {}
      vise = [];
    }

    aides.forEach(function (a, i) {
      out.push({ ecran: e.cle, nom: e.nom, halo: false, html: a, cible: vise[i] || null });
    });

    // Puis la demonstration, s'il y en a une pour cet ecran. Un geste =
    // une etape : c'est ce qui permet de mettre en pause dessus, de
    // revenir dessus, et de repartir.
    var gestes = (api.demos && api.demos[e.cle]) || [];
    gestes.forEach(function (g) {
      out.push({ ecran: e.cle, nom: e.nom, halo: false, html: g.dit, cible: g.cible, geste: g });
    });
    return out;
  }

  function etapesRoles() {
    var out = [];
    var moi = api.role, moiNom = api.roleNom || moi;

    out.push({
      special: true, nom: 'Les rôles',
      html: '<b>Un compte, un rôle.</b> Le rôle décide des écrans que la personne voit en se connectant. ' +
            'Elle ne trouve pas les autres — et surtout, elle ne les cherche pas.'
    });
    out.push({
      special: true, nom: 'Les rôles',
      html: 'Vous êtes connecté en <b>' + echapper(moiNom) + '</b>. Tout ce que ce tutoriel va vous montrer, ' +
            'vous pouvez l’ouvrir. Ce qu’il ne vous montre pas ne vous concerne pas.'
    });

    (api.roles || []).forEach(function (r) {
      out.push({
        special: true, nom: 'Les rôles',
        html: '<div class="bt-roles"><div class="bt-role' + (r.cle === moi ? ' moi' : '') + '"><b>' +
              echapper(r.nom) + (r.cle === moi ? ' — votre casquette' : '') + '</b>' +
              echapper(r.resume || '') + '</div></div>'
      });
    });

    out.push({ special: true, nom: 'Les rôles', tableau: true, html: 'Le tableau complet, casquette par casquette et écran par écran. ' +
      '<b>✓</b> consulte et modifie, <b>○</b> consulte seulement, <b>·</b> n’a pas l’écran.' });

    out.push({
      special: true, nom: 'Les rôles',
      html: 'Un seul compte échappe à la règle : celui du <b>propriétaire du site</b>. Son rôle, son adresse et ' +
            'sa suppression sont verrouillés dans la base — même un autre super administrateur ne peut pas y toucher. ' +
            'Il porte un cadenas dans l’écran <b>Comptes &amp; rôles</b>.'
    });
    // LE BUG SIGNALE. Ces etapes n'avaient pas d'ecran attache : elles
    // parlaient des roles pendant qu'on regardait les joueuses. Le
    // dernier pas mene desormais VRAIMENT a l'ecran dont il parle --
    // quand le role y a droit, sinon il ne promet pas une porte fermee.
    var vaAuxComptes = !!(api.metas && api.metas.comptes && api.lien('comptes') &&
                          !api.lien('comptes').classList.contains('hide'));
    out.push({
      special: true, nom: 'Les rôles',
      ecran: vaAuxComptes ? 'comptes' : null,
      halo: vaAuxComptes,
      html: vaAuxComptes
        ? 'Et voici l’écran lui-même : <b>Réglages → Comptes &amp; rôles</b>. Consulter ne demande rien ; ' +
          'changer un rôle demande le mot de passe <i>et</i> le rôle de super administrateur.'
        : 'Pour changer un rôle, il faut passer par <b>Réglages → Comptes &amp; rôles</b> — un écran que votre ' +
          'casquette n’ouvre pas. C’est un super administrateur qui s’en charge.'
    });
    return out;
  }

  function echapper(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ===================================================================
  // LA DÉMONSTRATION
  //
  // Elle remplit de vrais champs sur de vrais écrans. Trois choses la
  // rendent acceptable, et il faut les trois :
  //
  //   1. LE VERROU. L'hôte remplace ses fonctions d'écriture par un
  //      refus, et bloque tout fetch non-GET vers Supabase. La
  //      démonstration ne PEUT PAS enregistrer.
  //   2. L'INSTANTANÉ. Chaque champ touché est photographié avant, et
  //      remis exactement comme il était après — y compris si on ferme
  //      brutalement ou qu'on revient en arrière au milieu.
  //   3. LE DRAPEAU. On efface la trace « modifications non
  //      enregistrées » de l'admin, sinon quitter l'écran déclencherait
  //      une demande de confirmation pour des valeurs qui n'étaient pas
  //      les siennes.
  // ===================================================================
  function trouver(sel) {
    if (!sel) return null;
    try { var el = document.querySelector(sel); return (el && el.getClientRects().length) ? el : null; }
    catch (e) { return null; }
  }

  function feu(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function demoDebut(ecran) {
    if (demoEcran === ecran) return;
    demoFin();
    demoEcran = ecran;
    demoPhoto = {};
    if (api.verrou && api.verrou.armer) api.verrou.armer();
    racine.classList.add('demo');
  }

  function demoPhotographier(el, sel) {
    if (Object.prototype.hasOwnProperty.call(demoPhoto, sel)) return;
    demoPhoto[sel] = ('value' in el) ? el.value : null;
  }

  function demoRemettre() {
    Object.keys(demoPhoto).forEach(function (sel) {
      var el = null;
      try { el = document.querySelector(sel); } catch (e) {}
      if (el && demoPhoto[sel] !== null && 'value' in el) { el.value = demoPhoto[sel]; feu(el); }
    });
  }

  function demoFin() {
    if (frappe) { clearInterval(frappe); frappe = null; }
    if (!demoEcran) return;
    demoRemettre();
    demoPhoto = {};
    demoEcran = null;
    if (api.verrou && api.verrou.desarmer) api.verrou.desarmer();
    if (api.oublierModifs) api.oublierModifs();
    racine.classList.remove('demo');
  }

  // La frappe se voit : une valeur qui apparaît d'un bloc ne montre rien,
  // on n'a pas vu qu'elle avait été tapée.
  function taper(el, txt) {
    if (frappe) { clearInterval(frappe); frappe = null; }
    el.focus({ preventScroll: true });
    el.value = '';
    var i = 0;
    frappe = setInterval(function () {
      if (i >= txt.length) { clearInterval(frappe); frappe = null; feu(el); return; }
      el.value += txt.charAt(i++);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, 55);
  }

  function jouerGeste(g, el, sansAnimation) {
    if (!el) return;
    if (g.geste === 'montrer') return;         // la main désigne, on ne touche à rien
    demoPhotographier(el, g.cible);
    if (g.geste === 'choisir') { el.value = g.valeur; feu(el); return; }
    if (g.geste === 'cliquer') { el.click(); return; }
    if (g.geste === 'saisir') {
      if (sansAnimation) { el.value = g.valeur; feu(el); return; }
      taper(el, g.valeur);
    }
  }

  // Rejouer, plutôt que défaire. Revenir du geste 3 au geste 1 ne peut
  // pas se faire en « annulant » : on remet l'état d'origine, on
  // réapplique 0…n-1 d'un coup, puis on joue n pour de vrai. Marche
  // dans les deux sens de lecture sans code séparé pour chacun.
  function jouerDemo(i) {
    var e = etapes[i];
    // La frappe de l'étape précédente peut ne pas être terminée. Si on
    // la laisse courir, elle continue d'ajouter ses lettres PAR-DESSUS
    // ce que la nouvelle étape vient de poser : « samedi 20h » devenait
    // « samedi 20hh ». Une seule frappe à la fois, toujours.
    if (frappe) { clearInterval(frappe); frappe = null; }
    demoDebut(e.ecran);
    demoRemettre();
    // On passe e.geste, pas e : l'étape PORTE le geste, elle n'en est
    // pas un. Confondre les deux faisait lire e.geste.geste — un objet
    // au lieu de « saisir » — donc aucun cas ne correspondait, et la
    // démonstration se déroulait en ne faisant strictement rien. Sans
    // la moindre erreur : le bandeau s'affichait, le verrou s'armait,
    // les champs restaient vides.
    for (var k = 0; k < i; k++) {
      var p = etapes[k];
      if (p && p.geste && p.ecran === e.ecran) jouerGeste(p.geste, trouver(p.cible), true);
    }
    jouerGeste(e.geste, trouver(e.cible), false);
  }

  // ===================================================================
  // L'AIDE DU CONTEXTE
  //
  // Le manque que tout le reste ne comblait pas. Quelqu'un sur l'écran
  // Joueuses qui veut savoir qui a accès aux joueuses n'a pas à ouvrir
  // un sommaire de dix chapitres, ni à se déplacer jusqu'à Comptes &
  // rôles, ni à écouter une narration pendant qu'il regarde autre
  // chose. Il demande, on répond, là où il est.
  //
  // Les deux premières réponses ne coûtent AUCUN texte à écrire :
  //   « Comprendre cet écran »  = les conseils de cet écran, déjà écrits
  //   « Qui a accès ici »       = SECTION_MODULE + role_permissions,
  //                               déjà en base
  // Le reste (les tâches) s'écrit, et c'est là qu'est le vrai coût.
  // ===================================================================
  var ctxEcran = null;

  function ouvrirContexte(cle) {
    ctxEcran = cle;
    var meta = (api.metas && api.metas[cle]) || {};
    var nom = meta.t || cle;

    $('bt-ctx-t').textContent = nom;
    $('bt-ctx-s').textContent = meta.d || '';
    $('bt-ctx-ou').textContent = 'Vous êtes ici';
    $('bt-ctx-rep').classList.add('hide');
    $('bt-ctx-rep').innerHTML = '';

    var choix = [];
    var aides = (api.aides && api.aides[cle]) || [];
    var gestes = (api.demos && api.demos[cle]) || [];

    if (aides.length) choix.push({
      k: 'comprendre', ico: 'M12 17h.01M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4',
      t: 'Comprendre cet écran',
      s: aides.length + ' point' + (aides.length > 1 ? 's' : '') + ' — sur place, sans quitter l’écran'
    });

    if (gestes.length) choix.push({
      k: 'montrer', ico: 'M8 5v14l11-7z',
      t: 'Me montrer comment faire',
      s: gestes.length + ' geste' + (gestes.length > 1 ? 's' : '') + ' — rien ne sera enregistré'
    });

    if (api.moduleDe && api.moduleDe(cle)) choix.push({
      k: 'acces', ico: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
      t: 'Qui a accès à cet écran ?',
      s: 'Les cinq casquettes, et ce que chacune peut y faire'
    });

    choix.push({
      k: 'roles', ico: 'M3 3v18h18M7 14l3-4 3 3 5-7',
      t: 'Voir tous les rôles et les accès',
      s: 'Le tableau complet, écran par écran'
    });

    choix.push({
      k: 'complet', ico: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
      t: 'La visite complète',
      s: 'Tous vos écrans, du début à la fin'
    });

    $('bt-ctx-choix').innerHTML = choix.map(function (c) {
      return '<button type="button" class="bt-c" data-ctx="' + c.k + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + c.ico + '"/></svg>' +
        '<span class="bt-c-t"><b>' + echapper(c.t) + '</b><span>' + echapper(c.s) + '</span></span>' +
      '</button>';
    }).join('');

    $('bt-ctx-choix').querySelectorAll('[data-ctx]').forEach(function (b) {
      b.addEventListener('click', function () { repondre(b.getAttribute('data-ctx'), b); });
    });

    $('bt-somm').classList.add('hide');
    $('bt-narr').classList.add('hide');
    $('bt-ctx').classList.remove('hide');
    racine.classList.remove('hide');
  }

  function repondre(quoi, bouton) {
    $('bt-ctx-choix').querySelectorAll('.bt-c').forEach(function (x) { x.classList.remove('on'); });

    if (quoi === 'complet') { $('bt-ctx').classList.add('hide'); construirePlan(); rendreSommaire(); $('bt-somm').classList.remove('hide'); return; }
    if (quoi === 'comprendre') { $('bt-ctx').classList.add('hide'); visiteEcran(ctxEcran, false); return; }
    if (quoi === 'montrer')    { $('bt-ctx').classList.add('hide'); visiteEcran(ctxEcran, true);  return; }
    if (quoi === 'roles')      { $('bt-ctx').classList.add('hide'); construirePlan(); demarrer('_roles'); return; }

    if (quoi === 'acces') {
      if (bouton) bouton.classList.add('on');
      montrerAcces(ctxEcran);
    }
  }

  // « Qui a accès à CET écran » — la réponse s'affiche sous la question,
  // sans navigation, sans narration. C'est la demande exacte qui a
  // motivé cette refonte.
  function montrerAcces(cle) {
    var mod = api.moduleDe(cle);
    var rep = $('bt-ctx-rep');
    rep.classList.remove('hide');
    rep.innerHTML = '<h3>Qui a accès à « ' + echapper((api.metas[cle] || {}).t || cle) + ' »</h3>' +
      '<p>Cet écran dépend de <code>' + echapper(mod.nom) + '</code>. Voici ce que chaque casquette peut y faire.</p>' +
      '<div class="bt-perm"><p style="margin:0">Lecture des droits…</p></div>';

    api.matrice().then(function (rows) {
      var idxp = {};
      (rows || []).forEach(function (p) {
        var c = p.role + '|' + p.module;
        (idxp[c] = idxp[c] || {})[p.action] = true;
      });
      var ecrire = ['creer', 'modifier', 'supprimer', 'publier', 'approuver'];
      rep.querySelector('.bt-perm').innerHTML = (api.roles || []).map(function (r) {
        var p = idxp[r.cle + '|' + mod.cle] || {};
        var s, k, q;
        if (r.cle === 'super_admin' || ecrire.some(function (a) { return p[a]; })) { s = '✓'; k = 'bt-w'; q = 'consulte et modifie'; }
        else if (p.voir) { s = '○'; k = 'bt-r'; q = 'consulte seulement'; }
        else { s = '·'; k = 'bt-n'; q = 'n’a pas cet écran'; }
        return '<div class="bt-perm-l' + (r.cle === api.role ? ' moi' : '') + '">' +
          '<span class="bt-perm-s ' + k + '">' + s + '</span>' +
          '<span class="bt-perm-n">' + echapper(r.nom) + (r.cle === api.role ? ' — vous' : '') + '</span>' +
          '<span class="bt-perm-q">' + q + '</span></div>';
      }).join('');
    }).catch(function () {
      rep.querySelector('.bt-perm').innerHTML = '<p style="margin:0">Droits indisponibles.</p>';
    });
  }

  // Une visite d'UN seul écran : celui où l'on est déjà. Pas de
  // chapitre, pas de sommaire, pas de détour.
  function visiteEcran(cle, avecGestes) {
    var nom = (api.metas[cle] || {}).t || cle;
    etapes = etapesEcran({ cle: cle, nom: nom });
    if (!avecGestes) etapes = etapes.filter(function (e) { return !e.geste; });
    // On est déjà sur l'écran : le halo d'arrivée sur l'entrée de menu
    // n'apprend rien à quelqu'un qui vient de cliquer dessus.
    if (etapes.length && etapes[0].halo) etapes[0].halo = false;
    if (!etapes.length) return;
    chapCourant = 'ctx:' + cle;
    idx = 0;
    $('bt-narr').classList.remove('hide');
    enLecture = true;
    majBoutonPlay();
    montrer(0);
  }

  // ===================================================================
  // LE SOMMAIRE
  // ===================================================================
  function rendreSommaire() {
    var totalE = 0, vusE = 0;
    plan.forEach(function (c) {
      c.ecrans.forEach(function (e) { totalE++; if (progres.vus[e.cle]) vusE++; });
    });

    var nbEcrans = totalE;
    var nbMots = 0;
    plan.forEach(function (c) {
      c.ecrans.forEach(function (e) {
        nbMots += mots((api.metas[e.cle] || {}).d || '');
        ((api.aides[e.cle]) || []).forEach(function (a) { nbMots += mots(a); });
      });
    });

    $('bt-sub').innerHTML =
      'Vous êtes connecté en <b>' + echapper(api.roleNom || api.role || '—') + '</b>. ' +
      'Ce tutoriel ne montre que les <b>' + nbEcrans + ' écrans</b> que votre rôle peut ouvrir, ' +
      'sur les vrais écrans du site — rien n’est enregistré, rien n’est modifié. ' +
      'Comptez <b>' + minutes(nbMots) + ' minutes</b> en tout, et vous pouvez vous arrêter à tout moment : ' +
      'la reprise se fait là où vous en êtes.';

    var pc = totalE ? Math.round(vusE / totalE * 100) : 0;
    $('bt-jauge').style.width = pc + '%';
    $('bt-jauge-txt').textContent = vusE === 0
      ? 'Jamais commencé.'
      : (vusE >= totalE ? 'Tutoriel terminé — vous pouvez le revoir quand vous voulez.'
                        : vusE + ' écran' + (vusE > 1 ? 's' : '') + ' sur ' + totalE + ' déjà vus.');

    var rep = $('bt-reprendre');
    if (progres.dernier && plan.some(function (c) { return c.cle === progres.dernier.chap; })) {
      var ch = plan.filter(function (c) { return c.cle === progres.dernier.chap; })[0];
      rep.textContent = '↩ Reprendre : ' + ch.titre;
      rep.classList.remove('hide');
    } else {
      rep.classList.add('hide');
    }

    $('bt-chaps').innerHTML = plan.map(function (c, i) {
      var n = c.ecrans.length;
      var vus = c.ecrans.filter(function (e) { return progres.vus[e.cle]; }).length;
      var fait = c.special ? !!progres.vus['_roles'] : (n > 0 && vus === n);
      var m = 0;
      c.ecrans.forEach(function (e) {
        m += mots((api.metas[e.cle] || {}).d || '');
        ((api.aides[e.cle]) || []).forEach(function (a) { m += mots(a); });
      });
      var meta = c.special
        ? 'Qui fait quoi, et qui ne peut pas quoi · ~2 min'
        : n + ' écran' + (n > 1 ? 's' : '') + ' · ~' + minutes(m) + ' min';

      return '<button type="button" class="bt-chap' + (fait ? ' fait' : '') + '" data-chap="' + c.cle + '">' +
        '<span class="bt-chap-n">' + (fait
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>'
          : (i + 1)) + '</span>' +
        '<span class="bt-chap-c">' +
          '<span class="bt-chap-t">' + echapper(c.titre) + '</span>' +
          '<span class="bt-chap-m">' + meta + '</span>' +
          (n ? '<span class="bt-chap-e">' + c.ecrans.map(function (e) {
            return '<span class="bt-puce' + (progres.vus[e.cle] ? ' vu' : '') + '">' + echapper(e.nom) + '</span>';
          }).join('') + '</span>' : '') +
          (n ? '<span class="bt-chap-j"><i style="width:' + (n ? Math.round(vus / n * 100) : 0) + '%"></i></span>' : '') +
        '</span>' +
      '</button>';
    }).join('');

    $('bt-chaps').querySelectorAll('[data-chap]').forEach(function (b) {
      b.addEventListener('click', function () { demarrer(b.getAttribute('data-chap')); });
    });
  }

  // ===================================================================
  // LA VISITE
  // ===================================================================
  function demarrer(chapCle, depart) {
    chapCourant = chapCle;
    etapes = [];

    if (chapCle === 'tout') {
      plan.forEach(function (c) { etapes = etapes.concat(etapesDuChapitre(c)); });
    } else {
      var c = plan.filter(function (x) { return x.cle === chapCle; })[0];
      if (!c) return;
      etapes = etapesDuChapitre(c);
    }
    if (!etapes.length) return;

    idx = Math.min(Math.max(0, depart || 0), etapes.length - 1);
    $('bt-somm').classList.add('hide');
    $('bt-narr').classList.remove('hide');
    enLecture = true;
    majBoutonPlay();
    montrer(idx);
  }

  function etapesDuChapitre(c) {
    if (c.special) return etapesRoles();
    var out = [];
    c.ecrans.forEach(function (e) { out = out.concat(etapesEcran(e)); });
    return out;
  }

  function montrer(i) {
    taire();
    if (minuteur) { clearTimeout(minuteur); minuteur = null; }
    var e = etapes[i]; if (!e) { terminer(); return; }
    idx = i;

    // Navigation : seulement quand on change d'écran. Rappeler
    // showSection à chaque conseil relancerait le chargement des
    // données et ferait clignoter l'écran à chaque phrase.
    if (e.ecran && api.ecranCourant() !== e.ecran) {
      api.aller(e.ecran);
      progres.vus[e.ecran] = true;
      ecrireProgres();
    }
    if (e.special) { progres.vus['_roles'] = true; ecrireProgres(); }

    progres.dernier = { chap: chapCourant, i: i };
    ecrireProgres();

    // Le halo n'apparaît qu'à l'arrivée sur un écran : c'est le moment
    // où « où est-ce que je clique ? » se pose. Ensuite il gênerait.
    // On quitte la demonstration des qu'on quitte son ecran : les champs
    // doivent retrouver leurs valeurs avant qu'on regarde ailleurs.
    if (demoEcran && (!e.geste || e.ecran !== demoEcran)) demoFin();

    if (e.halo && e.ecran) {
      poserHalo(e.ecran);                       // « voila ou on clique »
    } else if (e.cible) {
      // On cherche la cible DANS l'ecran courant : deux ecrans peuvent
      // porter le meme identifiant de champ, et pointer celui d'un
      // ecran masque poserait la main a 0,0.
      var el = null;
      try { el = document.querySelector(e.cible); } catch (err) { el = null; }
      if (el && el.getClientRects().length) designer(el); else retirerHalo();
    } else {
      retirerHalo();
    }

    // Le geste part APRES que la main soit partie : voir la valeur
    // s'ecrire avant de savoir ou on regarde n'apprend rien.
    if (e.geste) setTimeout(function () { if (etapes[idx] === e) jouerDemo(idx); }, 520);

    var ou = $('bt-ou');
    ou.innerHTML = echapper(e.nom || '') + ' <em>· étape ' + (i + 1) + ' sur ' + etapes.length + '</em>';

    // innerHTML volontaire : ces textes viennent de SECTION_HELP, écrit
    // dans le code source de l'admin, et portent des <b> et des <code>
    // qui font partie de l'explication. Aucune saisie d'utilisateur
    // n'entre jamais ici.
    var dit = $('bt-dit');
    dit.innerHTML = e.html || '';
    if (e.tableau) rendreTableauRoles(dit);

    $('bt-narr-j').style.width = Math.round((i + 1) / etapes.length * 100) + '%';
    $('bt-prec').disabled = (i === 0);

    if (!enLecture) return;

    // LE FILET. Sans lui, une seule chose suffit à ruiner la visite :
    // une voix qui échoue à la première syllabe. speak() est accepté,
    // puis onerror arrive dans la milliseconde, la visite passe à
    // l'étape suivante, qui échoue pareil — et les 42 étapes défilent
    // en une seconde jusqu'au sommaire, sans que personne n'ait rien
    // lu ni compris ce qui vient de se passer. Ça s'est produit sur le
    // banc d'essai. Aucune étape ne dure donc moins de 2,2 secondes,
    // quoi que dise la synthèse vocale.
    var depuis = Date.now();
    var suite = function () {
      if (!enLecture) return;
      var reste = 2200 - (Date.now() - depuis);
      if (reste > 0) { minuteur = setTimeout(function () { if (enLecture) suivant(); }, reste); return; }
      suivant();
    };

    if (!dire(e.html, suite)) {
      minuteur = setTimeout(suite, dureeEstimee(e.html));
    }
  }

  function rendreTableauRoles(hote) {
    var boite = document.createElement('div');
    boite.className = 'bt-wrap';
    boite.innerHTML = '<table class="bt-tab"><tbody><tr><td>Chargement du tableau…</td></tr></tbody></table>';
    hote.appendChild(boite);

    api.matrice().then(function (rows) {
      var idxp = {};
      (rows || []).forEach(function (p) {
        var c = p.role + '|' + p.module;
        (idxp[c] = idxp[c] || {})[p.action] = true;
      });
      var ecrire = ['creer', 'modifier', 'supprimer', 'publier', 'approuver'];
      var roles = api.roles || [];
      var mods = api.modules || [];
      boite.innerHTML = '<table class="bt-tab"><tbody>' +
        '<tr><th>L’écran</th>' + roles.map(function (r) { return '<th>' + echapper(r.nom) + '</th>'; }).join('') + '</tr>' +
        mods.map(function (m) {
          return '<tr><td>' + echapper(m.nom) + '</td>' + roles.map(function (r) {
            var p = idxp[r.cle + '|' + m.cle] || {};
            var s = '·', col = 'var(--bt-line2)';
            if (r.cle === 'super_admin' || ecrire.some(function (a) { return p[a]; })) { s = '✓'; col = 'var(--bt-ok)'; }
            else if (p.voir) { s = '○'; col = 'var(--bt-gold)'; }
            return '<td class="c" style="color:' + col + '">' + s + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table>';
    }).catch(function () {
      boite.innerHTML = '<p style="color:var(--bt-faint);font-size:13px;margin:0">Tableau des droits indisponible.</p>';
    });
  }

  function poserHalo(cle) {
    var lien = api.lien(cle);
    if (!lien) { retirerHalo(); return; }

    // Sur téléphone la barre latérale est repliée : on l'ouvre le temps
    // de montrer où se trouve l'entrée, puis on la referme à l'étape
    // suivante. Montrer un bouton invisible n'apprend rien.
    if (window.innerWidth < 940 && api.ouvrirMenu) api.ouvrirMenu();
    designer(lien, true);
  }

  // ---- LA MAIN ----
  // designer() est le seul chemin : entrée de menu ou champ au milieu
  // d'un écran, c'est le même geste — on amène la chose à l'écran, la
  // main y va, le halo l'entoure.
  //
  // Règle absolue : PAS de cible, PAS de main. Désigner approximativement
  // pendant qu'on dit autre chose est pire que ne rien désigner — la
  // personne cherche le rapport, ne le trouve pas, et cesse de faire
  // confiance à tout le reste.
  function designer(el, sansDefilement) {
    if (!el) { retirerHalo(); return; }
    cibleCourante = el;
    if (tPointe) { clearTimeout(tPointe); tPointe = null; }

    // L'élément peut être sous la ligne de flottaison : personne ne
    // verra la main s'y poser si on ne l'amène pas d'abord.
    var doux = !window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!sansDefilement) {
      try { el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: doux ? 'smooth' : 'auto' }); }
      catch (e) { try { el.scrollIntoView(); } catch (_) {} }
    }

    // On attend la fin du défilement avant de mesurer : mesurer pendant
    // donne des coordonnées périmées, et la main se pose à côté.
    tPointe = setTimeout(function () {
      tPointe = null;
      poser(el);
    }, sansDefilement ? 40 : 420);
  }

  // Une liste vide mesure 0 × 0. Elle EXISTE — donc rien ne signale un
  // problème — mais le halo s'y réduit à un point et la main désigne le
  // vide. Ça n'a rien d'un cas tordu : un club sans joueuse enregistrée,
  // une école sans inscription en juillet, et la moitié des écrans sont
  // dans cet état. On remonte alors à l'ancêtre qui a une vraie surface,
  // en général la carte qui contient la liste : « c'est ici que ça
  // s'affiche » reste vrai, et reste visible.
  function boiteUtile(el) {
    var n = el, garde = 0;
    while (n && garde++ < 6) {
      var r = n.getBoundingClientRect();
      if (r.width >= 24 && r.height >= 16) return n;
      if (n.tagName === 'SECTION' || n.tagName === 'BODY') return null;
      n = n.parentElement;
    }
    return null;
  }

  function poser(el) {
    var spot = $('bt-spot'), doigt = $('bt-doigt');
    el = boiteUtile(el);
    if (!el) { retirerHalo(); return; }
    var r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 16) { retirerHalo(); return; }

    var p = 6;
    spot.style.top = (r.top - p) + 'px';
    spot.style.left = (r.left - p) + 'px';
    spot.style.width = (r.width + p * 2) + 'px';
    spot.style.height = (r.height + p * 2) + 'px';
    spot.classList.remove('hide');

    // La main se pose vers le haut-gauche de la chose, pas en son
    // centre : au centre elle masque précisément ce qu'elle désigne.
    doigt.style.top = (r.top + Math.min(r.height * 0.55, 30)) + 'px';
    doigt.style.left = (r.left + Math.min(r.width * 0.42, 46)) + 'px';
    doigt.classList.remove('hide');
    doigt.classList.remove('pose');
    void doigt.offsetWidth;                  // redémarre l'onde d'arrivée
    doigt.classList.add('pose');
  }

  function retirerHalo() {
    cibleCourante = null;
    if (tPointe) { clearTimeout(tPointe); tPointe = null; }
    $('bt-spot').classList.add('hide');
    $('bt-doigt').classList.add('hide');
    if (window.innerWidth < 940 && api.fermerMenu) api.fermerMenu();
  }

  function suivant() {
    if (idx >= etapes.length - 1) { terminer(); return; }
    montrer(idx + 1);
  }
  function precedent() { if (idx > 0) montrer(idx - 1); }

  function basculerLecture() {
    enLecture = !enLecture;
    majBoutonPlay();
    if (enLecture) { montrer(idx); }
    else { taire(); if (minuteur) { clearTimeout(minuteur); minuteur = null; } }
  }
  function majBoutonPlay() {
    var i = $('bt-play-i'), t = $('bt-play-t');
    if (t) t.textContent = enLecture ? 'Pause' : 'Reprendre';
    if (i) i.innerHTML = enLecture ? '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>' : '<path d="M8 5v14l11-7z"/>';
    var b = $('bt-play'); if (b) b.setAttribute('aria-label', enLecture ? 'Pause' : 'Reprendre');
  }

  function terminer() {
    enLecture = false;
    demoFin();
    taire();
    if (minuteur) { clearTimeout(minuteur); minuteur = null; }
    retirerHalo();
    progres.dernier = null;
    ecrireProgres();
    versSommaire();
  }

  function versSommaire() {
    enLecture = false;
    demoFin();
    $('bt-ctx').classList.add('hide');
    taire();
    if (minuteur) { clearTimeout(minuteur); minuteur = null; }
    retirerHalo();
    $('bt-narr').classList.add('hide');
    rendreSommaire();
    $('bt-somm').classList.remove('hide');
  }

  function fermer() {
    enLecture = false;
    demoFin();
    $('bt-ctx').classList.add('hide');
    taire();
    if (minuteur) { clearTimeout(minuteur); minuteur = null; }
    retirerHalo();
    racine.classList.add('hide');
    try { localStorage.setItem('bbc_tut_vu', '1'); } catch (e) {}
  }

  // ===================================================================
  // Montage
  // ===================================================================
  function brancher() {
    $('bt-fermer').addEventListener('click', fermer);
    $('bt-ctx-fermer').addEventListener('click', fermer);
    $('bt-quitter').addEventListener('click', fermer);
    $('bt-somm-retour').addEventListener('click', versSommaire);
    $('bt-tout').addEventListener('click', function () { demarrer('tout'); });
    $('bt-reprendre').addEventListener('click', function () {
      if (progres.dernier) demarrer(progres.dernier.chap, progres.dernier.i);
    });
    $('bt-prec').addEventListener('click', function () { precedent(); });
    $('bt-suiv').addEventListener('click', function () { suivant(); });
    $('bt-play').addEventListener('click', basculerLecture);

    $('bt-voix').addEventListener('click', function (ev) {
      ev.preventDefault();
      reglerVoix(!voixOn);
    });
    $('bt-voix2').addEventListener('click', function () {
      reglerVoix(!voixOn);
      // On relit l'étape en cours : activer la voix sans rien entendre
      // laisse croire que ça n'a pas marché.
      if (voixOn && enLecture) montrer(idx);
    });

    $('bt-oublier').addEventListener('click', function () {
      progres = { vus: {}, dernier: null };
      ecrireProgres();
      rendreSommaire();
    });

    document.addEventListener('keydown', function (e) {
      if (racine.classList.contains('hide')) return;
      if (e.key === 'Escape') { fermer(); return; }
      if ($('bt-narr').classList.contains('hide')) return;
      if (e.key === 'ArrowRight') { suivant(); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { precedent(); e.preventDefault(); }
      if (e.key === ' ') { basculerLecture(); e.preventDefault(); }
    });

    // Le halo est posé en coordonnées d'écran : il glisse dès que la
    // page bouge sous lui.
    // Le halo et la main sont poses en coordonnees d'ecran : ils
    // glissent des que la page bouge sous eux.
    var recaler = function () {
      if (cibleCourante && cibleCourante.getClientRects().length) poser(cibleCourante);
    };
    window.addEventListener('resize', recaler);
    window.addEventListener('scroll', recaler, true);
  }

  window.BaobabsTutoriel = {
    mount: function (el, hoteApi) {
      if (monte) return;
      racine = el; api = hoteApi; monte = true;
      lireProgres();
      try { voixOn = localStorage.getItem(CLE_VOIX) === '1'; } catch (e) { voixOn = false; }
      preparerVoix();
      reglerVoix(voixOn);
      brancher();
    },
    // Deux entrees, deux intentions. Avec un ecran : « je suis ici,
    // qu'est-ce que je peux faire ici ». Sans : la formation complete.
    open: function (chap, ecranContexte) {
      if (!monte) return;
      construirePlan();
      if (ecranContexte && api.metas && api.metas[ecranContexte]) {
        ouvrirContexte(ecranContexte);
        return;
      }
      rendreSommaire();
      $('bt-ctx').classList.add('hide');
      $('bt-narr').classList.add('hide');
      $('bt-somm').classList.remove('hide');
      racine.classList.remove('hide');
      if (chap) demarrer(chap);
    },
    aide: function (ecran) { if (monte) { construirePlan(); ouvrirContexte(ecran); } },
    close: fermer,
    // Pour le banc d'essai et la console : savoir où on en est.
    etat: function () {
      return { chapitres: plan.length, etapes: etapes.length, idx: idx, lecture: enLecture, voix: voixOn, voixFr: voixFr && voixFr.name };
    }
  };
})();
