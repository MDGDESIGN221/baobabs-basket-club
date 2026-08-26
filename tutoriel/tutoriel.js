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
  var tArrivee = null;      // fin du voyage de la main
  var cibleCourante = null; // l element designe, pour le recalage au scroll
  var demoEcran = null;     // l'ecran dont la demonstration est en cours
  var demoPhoto = {};       // valeurs d'origine des champs touches
  var frappe = null;        // minuteur de la frappe lettre par lettre
  var clicsSurveilles = false;
  var META_SPECIAL = {
    _connexion: 'De l’adresse du site à votre tableau de bord · ~2 min',
    _entete:    'Les commandes qui vous suivent partout · ~1 min',
    _roles:     'Qui fait quoi, et qui ne peut pas quoi · ~2 min',
    _studio:    'Composer une affiche, et l’exporter · ~3 min',
    _pratique:  'Deux exercices — rien ne s’enregistre · ~2 min'
  };
  var surcouche = null;     // '_connexion' | '_studio' | null
  var atelierOuvert = false;  // dans le Studio : accueil, ou plan de travail ?
  // LE JETON D'ETAPE. Sans lui, avancer a la main accelere la visite --
  // voir montrer(). Chaque etape prend un numero ; tout ce qui etait en
  // vol pour une etape plus ancienne se tait en le comparant.
  var jeton = 0;
  var voixOn = false;
  var voixFr = null;
  var progres = { vus: {}, dernier: null, role: null };

  var CLE_PROGRES = 'bbc_tut_progres';
  var CLE_VOIX = 'bbc_tut_voix';
  var CLE_VOIX_NOM = 'bbc_tut_voix_nom';

  // Un numero de version affiche : « je ne vois pas de difference » ne
  // doit pas rester une devinette entre un cache et un reglage systeme.
  var VERSION = '26.08-m';
  var CLE_ANIM = 'bbc_tut_anim';

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

      // LES SYMBOLES SE LISENT, ET MAL.
      // « +1 / +2 / +3 » sortait en « plus un barre oblique plus deux
      // barre oblique plus trois ». Les moteurs nomment tout ce qu'ils
      // ne savent pas prononcer.
      //
      // La barre n'est traduite que lorsqu'elle SEPARE -- entourée
      // d'espaces. Une barre collée appartient à une adresse
      // (« /channel/ », « https://… ») : la remplacer casserait le mot.
      .replace(/\s+\/\s+/g, ', ')
      .replace(/\s*\|\s*/g, ', ')
      .replace(/(\w)\s*\+\s*(\w)/g, '$1 plus $2')
      // Et le « + » qui ouvre un groupe : apres la traduction des
      // barres, « +2 » n'a plus de lettre devant lui et echappait a la
      // regle precedente -- « plus 1, +2, +3 ».
      .replace(/([\s(,])\+(\d)/g, '$1plus $2')
      .replace(/(^|[\s(])[−–]\s*(\d)/g, '$1moins $2')
      .replace(/\s*&\s*/g, ' et ')
      .replace(/\s*=\s*/g, ' égale ')
      .replace(/(\d)\s*%/g, '$1 pour cent')
      // « Baobabs » ressort en « baobab-bé-esse » : les moteurs francais
      // prononcent le S final d'un mot qu'ils ne connaissent pas. Au
      // singulier ils le disent juste -- et c'est ainsi qu'on le
      // prononce de toute facon.
      .replace(/\bBaobabs\b/g, 'Baobab')
      .replace(/\bbaobabs\b/g, 'baobab')
      // Une adresse lue caractere par caractere est insupportable, et
      // n'apprend rien : elle est affichee juste au-dessus.
      .replace(/https?:\/\/\S+/gi, ' l’adresse affichée à l’écran ')
      .replace(/…/g, '...')

      .replace(/\s+/g, ' ')
      .trim();
  }
  function mots(s) { return texteSeul(s).split(/\s+/).filter(Boolean).length; }
  function minutes(n) { return Math.max(1, Math.round(n / 150)); }

  function lireProgres() {
    try {
      var b = JSON.parse(localStorage.getItem(CLE_PROGRES) || '{}');
      progres = { vus: b.vus || {}, dernier: b.dernier || null, role: b.role || null };
    } catch (e) { progres = { vus: {}, dernier: null, role: null }; }
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

  // LE CHOIX DE LA VOIX, ET L'ERREUR QUE J'AVAIS FAITE
  //
  // Je préférais les voix `localService`, pour qu'elles parlent sans
  // réseau. C'est exactement le contraire de ce qu'il faut pour la
  // qualité : sur Windows, les voix locales sont les vieilles SAPI5 —
  // Hortense, Julie, Paul — et ce sont précisément les robotiques. Les
  // « Natural » et « Online » de Windows 11, les « Google » de Chrome,
  // les « Enhanced » d'Apple sonnent radicalement mieux. Je les
  // écartais activement.
  //
  // On classe donc par qualité, et la voix locale devient le dernier
  // recours plutôt que le premier choix.
  function noteVoix(v) {
    var n = (v.name || '').toLowerCase(), s = 0;
    if (/natural|neural/.test(n)) s += 100;         // génération naturelle
    if (/online/.test(n)) s += 60;                  // voix serveur
    if (/google/.test(n)) s += 55;
    if (/enhanced|premium|siri/.test(n)) s += 50;   // Apple
    if (/eloquence|compact/.test(n)) s -= 40;       // très anciennes
    if (/hortense|julie|paul|claude/.test(n)) s -= 20;
    if (/microsoft/.test(n) && !/natural|online/.test(n)) s -= 18;
    if (/^fr-fr/i.test(v.lang || '')) s += 10;      // français de France d'abord
    if (v.default) s += 3;
    return s;
  }

  function voixFrancaises() {
    if (!voixDispo()) return [];
    var vs = window.speechSynthesis.getVoices() || [];
    return vs.filter(function (v) { return /^fr(-|_|$)/i.test(v.lang || ''); })
             .sort(function (a, b) { return noteVoix(b) - noteVoix(a); });
  }

  function choisirVoix() {
    var fr = voixFrancaises();
    if (!fr.length) return null;
    // Un choix explicite de la personne l'emporte toujours.
    var voulu = null;
    try { voulu = localStorage.getItem(CLE_VOIX_NOM); } catch (e) {}
    if (voulu) {
      var t = fr.filter(function (v) { return v.name === voulu; })[0];
      if (t) return t;
    }
    return fr[0];
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
    var note = $('bt-voix-note'), liste = $('bt-voix-liste'), essai = $('bt-voix-essai');
    if (!note) return;

    if (!voixDispo()) {
      note.textContent = 'Ce navigateur ne sait pas lire à voix haute — le texte reste affiché.';
      if (liste) liste.classList.add('hide'); if (essai) essai.classList.add('hide');
      return;
    }
    var fr = voixFrancaises();
    if (!fr.length) {
      note.textContent = 'Aucune voix française installée sur cet appareil — le texte reste affiché.';
      if (liste) liste.classList.add('hide'); if (essai) essai.classList.add('hide');
      return;
    }

    // La qualité dépend entièrement de ce qui est installé : on laisse
    // donc choisir, et on dit laquelle sonne le mieux plutôt que de
    // décider à la place de la personne.
    if (liste) {
      liste.innerHTML = fr.map(function (v) {
        var bonne = noteVoix(v) >= 50;
        return '<option value="' + echapper(v.name) + '"' +
               (voixFr && v.name === voixFr.name ? ' selected' : '') + '>' +
               echapper(v.name.replace(/^Microsoft\s+/, '').replace(/\s*-\s*French.*$/i, '')) +
               (bonne ? ' — voix naturelle' : '') + '</option>';
      }).join('');
      liste.classList.remove('hide');
    }
    if (essai) essai.classList.remove('hide');

    note.innerHTML = (voixFr && noteVoix(voixFr) >= 50)
      ? ''
      : 'Cette voix est de l’ancienne génération, elle sonne mécanique. ' +
        'Sur Windows&nbsp;: <b>Paramètres → Heure et langue → Voix → Ajouter des voix</b>, ' +
        'installez une voix française <b>« Naturel »</b>, puis rouvrez le navigateur.';
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
    // PHRASE PAR PHRASE, PAS D'UN SEUL BLOC.
    // Une longue chaîne est débitée d'un souffle, sans respiration : le
    // moteur ne sait pas où poser les silences. En la découpant, chaque
    // fin de phrase devient une vraie pause — c'est ce qui distingue le
    // plus nettement une lecture humaine d'une lecture de machine.
    // Pas de lookbehind ici : (?<=...) est une erreur de SYNTAXE, pas
    // d'execution, sur Safari anterieur a 16.4 -- le fichier entier
    // refuserait de se charger sur un iPhone pas a jour. On decoupe
    // donc par correspondance, ce que tous les moteurs comprennent.
    var morceaux = (t.match(/[^.!?…:]+[.!?…:]*\s*/g) || [t])
      .map(function (x) { return x.trim(); })
      .filter(function (x) { return x; });
    if (!morceaux.length) morceaux = [t];

    var rendu = false;
    function unefois() { if (rendu) return; rendu = true; if (chien) { clearTimeout(chien); chien = null; } fini(); }

    try {
      morceaux.forEach(function (m, i) {
        var u = new SpeechSynthesisUtterance(m);
        u.voice = voixFr; u.lang = voixFr.lang || 'fr-FR';
        // Un peu sous la vitesse par défaut : à 1,0 les voix françaises
        // avalent les liaisons. 0,97 laisse le mot finir.
        u.rate = 0.97; u.pitch = 1.02; u.volume = 1;
        if (i === morceaux.length - 1) { u.onend = unefois; u.onerror = unefois; }
        window.speechSynthesis.speak(u);   // la file du navigateur enchaîne
      });
    } catch (e) { return false; }

    chien = setTimeout(unefois, dureeEstimee(html) + 6000);
    return true;
  }

  function dureeEstimee(html) {
    // ~150 mots/minute à voix haute, plancher confortable pour les
    // étapes d'une seule ligne, plafond pour ne pas endormir.
    var n = mots(html);
    return Math.min(16000, Math.max(3800, 900 + n * 400));
  }

  // Entendre tout de suite : comparer deux voix de memoire ne marche
  // pas, il faut les enchainer.
  function essayerVoix() {
    if (!voixDispo() || !voixFr) return;
    taire();
    var u = new SpeechSynthesisUtterance(
      'Bonjour. Je vous accompagne dans l’administration des Baobabs. Voici comment je sonne.');
    u.voice = voixFr; u.lang = voixFr.lang || 'fr-FR';
    u.rate = 0.97; u.pitch = 1.02;
    try { window.speechSynthesis.speak(u); } catch (e) {}
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

    // L'ORDRE SUIT CELUI DE LA JOURNEE, PAS CELUI DU CODE.
    //
    // Il commencait par les roles -- avant meme que la personne soit
    // entree. On lui expliquait qui peut modifier la boutique alors
    // qu'elle ne savait pas encore ou taper l'adresse. Chaque chapitre
    // suppose maintenant le precedent :
    //
    //   1. arriver et entrer          on ne sait rien
    //   2. le bandeau du haut         ou l'on est, ce qui est autour
    //   3. les roles                  ce que JE peux faire ici
    //   4. les ecrans, par groupe     le travail lui-meme
    //   5. le Studio                  un atelier a cote
    //   6. a vous                     on refait les gestes
    //
    // La pratique vient en dernier : on ne s'entraine pas a un geste
    // qu'on n'a pas encore vu.
    if (api.connexion) plan.push({ cle: '_connexion', titre: 'Arriver et se connecter', ecrans: [], special: true });
    plan.push({ cle: '_entete', titre: 'Le bandeau du haut', ecrans: [], special: true });
    plan.push({ cle: '_roles', titre: 'Les rôles et les accès', ecrans: [], special: true });

    (api.plan() || []).forEach(function (g) {
      if (!g.ecrans || !g.ecrans.length) return;
      plan.push({ cle: 'g' + plan.length, titre: g.titre, ecrans: g.ecrans });
    });

    // Le Studio est un atelier a cote : il ne se comprend qu'une fois
    // qu'on sait ce qu'est un match et une actualite.
    if (api.studio && document.getElementById('studio-open')) {
      plan.push({ cle: '_studio', titre: 'Le Studio — composer une affiche', ecrans: [], special: true });
    }
    // Et la pratique ferme la marche : on refait ce qu'on vient de voir.
    plan.push({ cle: '_pratique', titre: 'À vous — s’entraîner sans rien risquer', ecrans: [], special: true });
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

    // LES BLOCS DE L'ECRAN, UN PAR UN.
    // Sur « Page d'accueil », le tutoriel disait une phrase et passait.
    // L'ecran contient pourtant cinq blocs distincts, chacun avec son
    // titre et ses champs -- le hero, le Face-Off, le bandeau de
    // chiffres, la boutique, les medias. On les parcourt.
    //
    // Les intitules viennent du registre de l'hote : « Face-Off — Le
    // duel des leaders » est ecrit une seule fois, la ou le bloc est
    // defini. Le tutoriel ne peut pas le contredire.
    var blocs = (api.blocs && api.blocs(e.cle)) || [];
    blocs.forEach(function (b, i) {
      var n = b.champs;
      out.push({
        ecran: e.cle, nom: e.nom, halo: false,
        cible: '#qgc-card-' + b.id,
        html: '<b>' + echapper(b.label) + '</b>' +
              (b.page ? ' <span style="opacity:.7">· ' + echapper(b.page) + '</span>' : '') +
              ' — ' + n + ' champ' + (n > 1 ? 's' : '') + ' à remplir.' +
              (i === 0 ? ' L’aperçu de droite montre le rendu réel du site&nbsp;: ce que vous voyez est ce qui sera publié.' : '')
      });
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

  // LE CHAPITRE DES ROLES
  //
  // Il decrivait une table que l'ecran Comptes & roles affiche deja, en
  // la recopiant en tout petit dans le narrateur. Deux torts : il
  // n'avait pas le mouvement des autres chapitres -- ni main, ni cadre,
  // ni ecran qui arrive -- et il racontait au lieu de montrer.
  //
  // Quand la casquette ouvre l'ecran, on y VA et on designe les vraies
  // choses. Sinon seulement, on retombe sur la version racontee, avec
  // sa table embarquee : promettre un ecran qu'on ne peut pas ouvrir
  // serait pire que de raconter.
  function etapesRoles() {
    var moi = api.role, moiNom = api.roleNom || moi;
    var lien = api.lien && api.lien('comptes');
    var surEcran = !!(lien && !lien.classList.contains('hide') && api.metas && api.metas.comptes);

    if (surEcran) return etapesRolesSurEcran(moiNom);
    return etapesRolesRacontees(moi, moiNom);
  }

  // La version qui MONTRE : meme mouvement que n'importe quel ecran.
  function etapesRolesSurEcran(moiNom) {
    var out = [];
    var E = 'comptes', N = 'Les rôles et les accès';
    function pas(html, cible, halo) {
      out.push({ ecran: E, nom: N, html: html, cible: cible || null, halo: !!halo });
    }

    pas('<b>Un compte, un rôle.</b> Le rôle décide des écrans que la personne voit en se connectant. ' +
        'Elle ne trouve pas les autres — et surtout, elle ne les cherche pas. Tout se règle ici.', null, true);

    pas('Voici les comptes qui ont accès à l’administration. Vous êtes connecté en <b>' + echapper(moiNom) +
        '</b> : tout ce que ce tutoriel vous montre, vous pouvez l’ouvrir.', '#cp-list');

    pas('Les cinq casquettes, et le métier de chacune. Ce n’est pas une hiérarchie : c’est un partage du travail.', '#cp-roles');

    (api.roles || []).forEach(function (r, i) {
      pas('<b>' + echapper(r.nom) + '</b> — ' + echapper(r.resume || ''),
          '#cp-roles .cp-role:nth-child(' + (i + 1) + ')');
    });

    pas('Et le tableau complet, écran par écran. <b>✓</b> consulte et modifie, <b>○</b> consulte seulement, ' +
        '<b>·</b> n’a pas l’écran — il n’apparaît même pas dans son menu.', '#cp-matrice');

    pas('Un compte échappe à la règle : celui du <b>propriétaire du site</b>. Son rôle, son adresse et sa ' +
        'suppression sont verrouillés dans la base — même un autre super administrateur ne peut pas y toucher. ' +
        'Il porte un cadenas dans la liste.', '#cp-list');

    pas('Pour changer un rôle, c’est ce bouton. Consulter ne demande rien&nbsp;; changer demande le mot de ' +
        'passe <i>et</i> le rôle de super administrateur.', '#cp-demander');

    return out;
  }

  // La version racontee, pour les casquettes qui n'ouvrent pas l'ecran.
  function etapesRolesRacontees(moi, moiNom) {
    var out = [];
    out.push({ special: true, nom: 'Les rôles',
      html: '<b>Un compte, un rôle.</b> Le rôle décide des écrans que la personne voit en se connectant. ' +
            'Elle ne trouve pas les autres — et surtout, elle ne les cherche pas.' });
    out.push({ special: true, nom: 'Les rôles',
      html: 'Vous êtes connecté en <b>' + echapper(moiNom) + '</b>. Tout ce que ce tutoriel va vous montrer, ' +
            'vous pouvez l’ouvrir. Ce qu’il ne vous montre pas ne vous concerne pas.' });

    (api.roles || []).forEach(function (r) {
      out.push({ special: true, nom: 'Les rôles',
        html: '<div class="bt-roles"><div class="bt-role' + (r.cle === moi ? ' moi' : '') + '"><b>' +
              echapper(r.nom) + (r.cle === moi ? ' — votre casquette' : '') + '</b>' +
              echapper(r.resume || '') + '</div></div>' });
    });

    out.push({ special: true, nom: 'Les rôles', tableau: true,
      html: 'Le tableau complet, casquette par casquette et écran par écran. ' +
            '<b>✓</b> consulte et modifie, <b>○</b> consulte seulement, <b>·</b> n’a pas l’écran.' });

    out.push({ special: true, nom: 'Les rôles',
      html: 'Un compte échappe à la règle : celui du <b>propriétaire du site</b>. Son rôle, son adresse et sa ' +
            'suppression sont verrouillés dans la base — même un autre super administrateur ne peut pas y toucher.' });

    out.push({ special: true, nom: 'Les rôles',
      html: 'Pour changer un rôle, il faut passer par <b>Réglages → Comptes &amp; rôles</b> — un écran que votre ' +
            'casquette n’ouvre pas. C’est un super administrateur qui s’en charge.' });

    return out;
  }

  // LE BANDEAU DU HAUT
  // Rien ici n'appartient a un ecran : ces boutons vivent au-dessus de
  // tout, et c'est justement pour ca qu'ils echappaient au tutoriel. Pas
  // de navigation -- on reste ou l'on est, et on designe.
  var ENTETE = [
    { cible:'#role-badge',
      dit:'Votre <b>casquette</b> est écrite là, en permanence. Elle décide de ce que vous voyez : si un écran manque à votre menu, la réponse est ici.' },
    { cible:'#gs-open',
      dit:'La <b>recherche</b>, ou <code>Ctrl+K</code>. Elle cherche partout d’un coup : un match, un club, une joueuse, une référence de billet, un écran. C’est le chemin le plus court vers n’importe quoi.' },
    { cible:'#notif-bell',
      dit:'La <b>cloche</b> ne signale pas l’activité : elle signale ce qui <b>demande une décision</b>. Une candidature à trancher, une commande à préparer, un score à publier. Si elle est éteinte, rien ne vous attend.' },
    { cible:'#refresh-btn',
      dit:'<b>Recharger</b> les données de l’écran. Utile un soir de match, quand quelqu’un d’autre saisit en même temps que vous.' },
    { cible:'#studio-open',
      dit:'Le <b>Studio</b> compose les affiches du club : annonce de match, résultat, portrait de joueuse. Il s’ouvre par-dessus l’administration et se referme sans rien changer.' },
    { cible:'#help-btn',
      dit:'Et ce bouton-ci ouvre <b>ce tutoriel</b> — mais à partir de l’écran où vous vous trouvez. « Je suis ici, qu’est-ce que je peux faire ici. »' },
    { cible:'#logout-btn',
      dit:'<b>Se déconnecter.</b> À faire sur un ordinateur partagé, ou au club. En revenant, votre casquette et vos droits sont relus depuis la base : un rôle changé entre-temps s’applique à ce moment-là, pas avant.' }
  ];

  function etapesEntete() {
    var out = [{
      special: true, nom: 'Le bandeau du haut',
      html: 'Ces commandes-là ne changent jamais&nbsp;: elles vous suivent d’un écran à l’autre. On les passe en revue une fois, et on n’y revient plus.'
    }];
    ENTETE.forEach(function (e) {
      // Une commande absente ou masquee pour cette casquette n'est pas
      // annoncee : promettre un bouton qu'on n'a pas serait pire que
      // se taire.
      var el = null;
      try { el = document.querySelector(e.cible); } catch (err) {}
      if (!el || !el.getClientRects().length) return;
      out.push({ special: true, nom: 'Le bandeau du haut', html: e.dit, cible: e.cible });
    });
    return out;
  }

  // ============ SE CONNECTER ============
  // On montre le VRAI formulaire, pas une image : une image serait
  // fausse au premier changement. Il n'est jamais soumis, et le mot de
  // passe n'est jamais rempli -- meme pour de faux.
  function etapesConnexion() {
    var E = 'Arriver';
    // L'adresse vient AVANT tout : on ne peut pas se connecter a une
    // page qu'on n'a pas su atteindre. On ne peut pas designer la barre
    // du navigateur -- elle n'appartient pas a la page -- alors on la
    // dessine, avec la VRAIE adresse de l'installation.
    var adresse = '';
    try { adresse = location.origin + location.pathname; } catch (e) { adresse = '…'; }

    return [
      { special: true, nom: E,
        html: 'Tout commence par l’adresse. On la tape dans la barre du navigateur, ou on la met en favori — ' +
              'l’administration n’est liée depuis aucune page du site public, et c’est voulu.' +
              '<div class="bt-url"><span class="bt-url-ico">🔒</span><code>' + echapper(adresse) + '</code></div>' +
              '<span style="opacity:.75;font-size:12.5px">Mettez-la en favori&nbsp;: vous la taperez une fois, ' +
              'pas tous les jours.</span>' },
      { special: true, nom: 'Se connecter', connexion: true,
        html: 'Et voici ce qui vous accueille. <b>C’est le vrai écran</b>, montré ici alors que vous êtes déjà ' +
              'connecté — il ne sera pas envoyé.' },
      // Volontairement AUCUNE saisie ici. Un champ de connexion ne se met
      // pas en scene : on le designe, on l'explique, on n'y touche pas.
      { special: true, nom: 'Se connecter', connexion: true, cible: '#gate-email',
        html: 'Votre <b>adresse e-mail</b>, celle qui a été enregistrée pour vous. Ce n’est pas l’adresse ' +
              'du club&nbsp;: c’est la vôtre, personnellement.' },
      { special: true, nom: 'Se connecter', connexion: true, cible: '#pw',
        html: 'Votre <b>mot de passe</b>. Je ne le remplis pas, même pour de faux — un champ de mot de passe ' +
              'ne se met jamais en scène. Il vous a été communiqué à part.' },
      { special: true, nom: 'Se connecter', connexion: true, cible: '#unlock-btn',
        html: 'Et on entre. <b>Deux conditions, pas une</b>&nbsp;: le bon mot de passe, et un compte inscrit ' +
              'dans l’administration. Un compte client du site ne suffit pas.' },
      { special: true, nom: 'Se connecter', connexion: true, cible: '#gate-msg',
        html: 'Si ça refuse, le message s’affiche ici. « <b>Identifiants incorrects</b> » veut dire adresse ou ' +
              'mot de passe&nbsp;; « <b>ce compte n’a pas accès</b> » veut dire que le compte existe mais n’est ' +
              'pas dans l’administration — là, il faut demander au responsable du site.' }
    ];
  }

  // ============ LE STUDIO ============
  // LE STUDIO SE MONTRE, IL NE SE RACONTE PAS.
  //
  // J'avais fini par DECRIRE l'atelier faute de pouvoir l'ouvrir. C'est
  // exactement le defaut signale : « le narrateur dit des choses qu'on ne
  // voit pas illustrer ». Un chapitre qui decrit ce qu'il pourrait
  // designer est un chapitre rate.
  //
  // Le tutoriel ouvre donc un vrai plan de travail, monte en memoire a
  // partir d'un modele : project.id nul, jamais enregistre, aucune
  // donnee du club touchee. Enregistrer, Exporter et Publier sont
  // DESIGNES, jamais cliques.
  var STUDIO_ACCUEIL = [
    { c: '#bs-home-nav',  d: 'À gauche, la navigation de l’atelier&nbsp;: <b>Accueil</b>, <b>Nouveau</b> pour partir d’un format vierge, <b>Modèles</b> pour les maquettes déjà composées, et <b>Travaux récents</b> — vos affiches en cours.' },
    { c: '#bs-home-main', d: 'Au centre, par quoi commencer. D’abord les <b>formats</b> — affiche 3:4, story, post carré, bannière du site — puis les <b>modèles en vedette</b>, des maquettes de match day qu’il n’y a plus qu’à remplir.' },
    { c: '#bs-home-tip',  d: 'Et le point à retenir&nbsp;: les <b>objets dynamiques</b>. Un calque marqué d’un éclair se remplit tout seul avec les données du club — l’adversaire, la date, le score. On ne les recopie jamais à la main.' }
  ];

  // PAS D'ETAPE SUR #bs-format : @media (max-width:1080px) masque
  // .bs-inline-field, donc le selecteur de format n'est pas a l'ecran sur
  // un portable. Le narrateur aurait parle dans le vide -- le defaut meme
  // qu'on corrige ici. Les formats sont enseignes a l'accueil, ou ils
  // occupent toute la colonne centrale.
  var STUDIO_ATELIER = [
    { c: '#bs-canvas',     d: 'Voilà un <b>plan de travail</b>. C’est la surface qu’on compose, aux dimensions exactes du format choisi&nbsp;: ce qu’on voit ici est ce qui sortira. Celui-ci part du modèle <b>Duel</b>.' },
    { c: '#bs-proj-name',  d: 'En haut, le <b>nom du projet</b>. La pastille juste à côté s’allume dès qu’une modification n’est pas enregistrée — tant qu’elle est là, le travail n’existe que dans cette page.' },
    { c: '#bs-rail',       d: 'La <b>colonne d’outils</b>&nbsp;: modèles, images, photos, éléments, texte, styles, projets. Et <b>Données</b>, qui va chercher le prochain match dans l’administration pour remplir l’affiche toute seule.' },
    { c: '#bs-props',      d: 'À droite, les <b>propriétés</b>. Tant que rien n’est sélectionné, ce sont celles de l’affiche — son format, ses dimensions. Dès qu’on choisit un élément, le panneau devient le sien.' },
    { c: '#bs-layer-list', d: 'En dessous, les <b>calques</b>&nbsp;: nom de l’adversaire, logo, date, salle, titre… Chaque morceau de l’affiche est une ligne, et l’ordre de cette liste décide de ce qui passe devant.' },
    { c: '#bs-undo',       d: '<b>Annuler</b>, et sa jumelle pour refaire. Rien n’est définitif tant qu’on n’a pas enregistré&nbsp;: on peut essayer sans rien risquer.' },
    { c: '#bs-zoom-fit',   d: 'Le <b>zoom</b>, et ce bouton qui remet l’affiche entière à l’écran. Il sert plus souvent qu’on ne croit, quand on s’est perdu dans un détail.' },
    { c: '#bs-saveinfo',   d: 'Ici se lit l’état du projet. Il indique en ce moment <b>« Démonstration — jamais enregistré »</b>&nbsp;: ce plan de travail a été monté pour le tutoriel, il n’ira nulle part.' },
    { c: '#bs-save',       d: '<b>Enregistrer</b> range le projet parmi vos <b>Travaux récents</b>, ceux de l’écran d’accueil. C’est ce qui permet de le rouvrir demain.' },
    { c: '#bs-export',     d: '<b>Exporter</b> produit l’image&nbsp;: un fichier qui descend dans vos téléchargements. C’est ce fichier-là qu’on envoie sur les réseaux.' },
    { c: '#bs-publish',    d: '<b>Publier</b> va plus loin&nbsp;: l’affiche part sur le site du club, visible de tous. À manier comme une publication d’actualité — une fois en ligne, elle est en ligne.' },
    { c: '#bs-close',      d: 'Et on referme. L’administration est restée derrière, intacte&nbsp;: le Studio ne l’a pas remplacée, il s’est simplement posé par-dessus.' }
  ];

  function etapesStudio() {
    var E = 'Le Studio';
    var out = [{
      special: true, nom: E, studio: true,
      html: 'Le <b>Studio</b> compose les affiches du club — annonce de match, résultat, portrait de joueuse. ' +
            'C’est un atelier à part, qui s’ouvre par-dessus l’administration. Il <b>lit</b> les données du club ' +
            'pour remplir les affiches, mais n’en modifie aucune. On l’ouvre.'
    }];
    STUDIO_ACCUEIL.forEach(function (e) {
      out.push({ special: true, nom: E, studio: true, cible: e.c, html: e.d });
    });
    out.push({
      special: true, nom: E, studio: true, atelier: true,
      html: 'Plutôt que de vous le décrire, <b>on ouvre un plan de travail</b>. Celui-ci est monté pour la ' +
            'démonstration&nbsp;: il n’est enregistré nulle part, et rien de ce qu’on va voir ne partira sur le site. ' +
            '<span style="opacity:.75">Enregistrer, Exporter et Publier seront montrés, jamais cliqués.</span>'
    });
    STUDIO_ATELIER.forEach(function (e) {
      out.push({ special: true, nom: E, studio: true, atelier: true, cible: e.c, html: e.d });
    });
    return out;
  }

  // ===================================================================
  // LE BAC A SABLE — on manipule, rien ne s'enregistre
  //
  // « Regardez-moi faire » ne suffit pas : on n'apprend un geste qu'en
  // le faisant. Mais on n'ose pas glisser une vraie candidature dans
  // une vraie colonne pour voir ce que ca fait.
  //
  // Ces cartes et ces champs n'appartiennent qu'a l'exercice. Aucun
  // selecteur de l'admin, aucune requete, aucune ligne ecrite -- il n'y
  // a rien a casser, donc rien a craindre. C'est ce qui autorise le
  // geste.
  // ===================================================================
  var bacNo = 0, bacFait = 0;

  var COLONNES = [
    { id: 'nouvelle', t: 'Nouvelle' },
    { id: 'etudier',  t: 'À étudier' },
    { id: 'acceptee', t: 'Acceptée' }
  ];
  var CARTES_DEPART = [
    { id: 'c1', nom: 'Awa Ndiaye',    sous: 'Meneuse · 16 ans',      col: 'nouvelle' },
    { id: 'c2', nom: 'Fatou Diop',    sous: 'Ailière · 15 ans',      col: 'nouvelle' },
    { id: 'c3', nom: 'Mariama Fall',  sous: 'Pivot · 17 ans',        col: 'etudier'  }
  ];
  var bacCartes = [];

  // UN CONSTRUCTEUR NE DOIT RIEN OUVRIR.
  //
  // etapesDuChapitre() retournait [] pour la pratique en ouvrant le bac
  // au passage. Or « Tout me montrer » appelle ce constructeur pour
  // CHAQUE chapitre afin d'aplatir la liste : le bac s'ouvrait donc des
  // le clic, par-dessus la visite, et masquait l'ecran de connexion
  // qu'on etait en train d'expliquer. Constate en capture.
  //
  // Le chapitre rend maintenant une vraie etape ; c'est montrer() qui
  // ouvre le bac en y arrivant, et le referme en repartant.
  function etapesPratique() {
    return [{
      special: true, nom: 'À vous', pratique: true,
      html: 'Assez regardé. <b>Deux exercices</b>, sur des données qui n’existent que pour vous&nbsp;: ' +
            'faire glisser une candidature, puis créer une catégorie de billet. Rien de ce que vous ferez ' +
            'ne sera enregistré.'
    }];
  }

  // Ouvert DEPUIS la visite : le narrateur reste, pour pouvoir
  // continuer ou revenir en arriere apres l'exercice.
  function ouvrirBacDepuisVisite() {
    $('bt-somm').classList.add('hide');
    $('bt-ctx').classList.add('hide');
    retirerHalo();
    $('bt-bac').classList.remove('hide');
    rendreBac();
  }

  function ouvrirBac(n) {
    bacNo = n || 0;
    $('bt-somm').classList.add('hide');
    $('bt-ctx').classList.add('hide');
    $('bt-narr').classList.add('hide');
    retirerHalo();
    fermerSurcouche();
    $('bt-bac').classList.remove('hide');
    racine.classList.remove('hide');
    rendreBac();
  }

  function fermerBac() {
    $('bt-bac').classList.add('hide');
    versSommaire();
  }

  function rendreBac() {
    if (bacNo === 0) return bacGlisser();
    return bacCreer();
  }

  // ---- EXERCICE 1 : faire glisser une carte ----
  // Le geste le plus courant de l'admin, et le plus difficile a
  // expliquer par des mots.
  function bacGlisser() {
    bacCartes = CARTES_DEPART.map(function (c) { return { id:c.id, nom:c.nom, sous:c.sous, col:c.col }; });
    $('bt-bac-t').textContent = 'Faire glisser une candidature';
    $('bt-bac-s').innerHTML = 'Attrapez une carte et déposez-la dans une autre colonne — au doigt ou à la souris. ' +
      'C’est exactement le geste des écrans <b>Candidatures</b>, <b>Commandes</b> et <b>École de basket</b>.';
    peindreColonnes();
    majScore('Déplacez au moins une carte.');
  }

  function peindreColonnes() {
    $('bt-bac-corps').innerHTML =
      '<div class="bt-cols">' + COLONNES.map(function (co) {
        var dedans = bacCartes.filter(function (c) { return c.col === co.id; });
        return '<div class="bt-col" data-col="' + co.id + '">' +
          '<div class="bt-col-t"><span>' + echapper(co.t) + '</span>' +
          '<span class="bt-col-n">' + dedans.length + '</span></div>' +
          dedans.map(function (c) {
            return '<div class="bt-carte-j" data-carte="' + c.id + '">' +
              '<b>' + echapper(c.nom) + '</b><span>' + echapper(c.sous) + '</span></div>';
          }).join('') + '</div>';
      }).join('') + '</div>' +
      '<div class="bt-bac-sur"><b>Rien n’est enregistré ici.</b> Ces trois candidatures n’existent que dans cet ' +
      'exercice — vous pouvez les déplacer dans tous les sens.</div>';
    armerGlisser();
  }

  // Glisser au pointeur plutot qu'en HTML5 : le drag natif ne marche pas
  // au doigt, et la moitie du club est sur telephone.
  function armerGlisser() {
    var prise = null, colSurvol = null;

    $('bt-bac-corps').querySelectorAll('[data-carte]').forEach(function (el) {
      el.addEventListener('pointerdown', function (ev) {
        prise = el;
        el.classList.add('prise');
        try { el.setPointerCapture(ev.pointerId); } catch (e) {}
      });
      el.addEventListener('pointermove', function (ev) {
        if (prise !== el) return;
        var sous = document.elementFromPoint(ev.clientX, ev.clientY);
        var col = sous && sous.closest ? sous.closest('.bt-col') : null;
        if (col !== colSurvol) {
          if (colSurvol) colSurvol.classList.remove('survol');
          colSurvol = col;
          if (colSurvol) colSurvol.classList.add('survol');
        }
      });
      el.addEventListener('pointerup', function (ev) {
        if (prise !== el) return;
        el.classList.remove('prise');
        var sous = document.elementFromPoint(ev.clientX, ev.clientY);
        var col = sous && sous.closest ? sous.closest('.bt-col') : null;
        if (colSurvol) colSurvol.classList.remove('survol');
        colSurvol = null; prise = null;
        if (!col) return;
        var cible = col.getAttribute('data-col');
        var c = bacCartes.filter(function (x) { return x.id === el.getAttribute('data-carte'); })[0];
        if (!c || c.col === cible) return;
        c.col = cible;
        bacFait++;
        peindreColonnes();
        majScore('<b>Déplacée.</b> Dans la vraie administration, ce geste change le statut du dossier et l’inscrit ' +
                 'dans son journal. Ici, rien n’a bougé ailleurs.');
      });
    });
  }

  // ---- EXERCICE 2 : creer un billet ----
  function bacCreer() {
    $('bt-bac-t').textContent = 'Créer une catégorie de billet';
    $('bt-bac-s').innerHTML = 'Remplissez les trois champs et créez. C’est la mécanique de l’écran ' +
      '<b>Billetterie</b>&nbsp;: un tarif, un quota, et la vente s’ouvre.';
    $('bt-bac-corps').innerHTML =
      '<div class="bt-form">' +
        '<div class="bt-champ"><label for="bt-x-cat">Catégorie</label>' +
          '<input id="bt-x-cat" type="text" placeholder="Tribune officielle"></div>' +
        '<div class="bt-champ"><label for="bt-x-prix">Tarif (FCFA)</label>' +
          '<input id="bt-x-prix" type="number" placeholder="2000"></div>' +
        '<div class="bt-champ"><label for="bt-x-quota">Places</label>' +
          '<input id="bt-x-quota" type="number" placeholder="150"></div>' +
        '<div class="bt-champ"><label for="bt-x-vente">Vente</label>' +
          '<select id="bt-x-vente"><option value="fermee">Fermée</option>' +
          '<option value="ouverte">Ouverte</option></select></div>' +
        '<button type="button" class="bt-cta" id="bt-x-creer" style="justify-self:start">Créer la catégorie</button>' +
      '</div>' +
      '<div class="bt-recap hide" id="bt-x-recap"></div>' +
      '<div class="bt-bac-sur"><b>Aucune catégorie n’est créée.</b> Rien ne part vers la base, rien n’apparaît ' +
      'sur le site&nbsp;: ce formulaire ne parle à personne.</div>';

    $('bt-x-creer').addEventListener('click', function () {
      var cat = ($('bt-x-cat') || {}).value || '';
      var prix = ($('bt-x-prix') || {}).value || '';
      var quota = ($('bt-x-quota') || {}).value || '';
      var vente = ($('bt-x-vente') || {}).value || 'fermee';
      if (!cat.trim() || !prix || !quota) {
        majScore('Il manque un champ — la vraie billetterie refuserait aussi.');
        return;
      }
      var r = $('bt-x-recap');
      r.classList.remove('hide');
      r.innerHTML = 'Sur le site, cela donnerait&nbsp;: <b>' + echapper(cat) + '</b> — ' +
        echapper(String(prix).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')) + ' FCFA, ' +
        echapper(quota) + ' places, vente <b>' + (vente === 'ouverte' ? 'ouverte' : 'fermée') + '</b>.' +
        (vente === 'fermee' ? '<br>Tant qu’aucune catégorie n’est ouverte, la billetterie n’apparaît pas sur le site.' : '');
      bacFait++;
      majScore('<b>Créée — pour de faux.</b> Vous venez de faire exactement le geste de l’écran Billetterie.');
    });
    majScore('Remplissez les trois champs, puis créez.');
  }

  function majScore(html) {
    var s = $('bt-bac-score'); if (s) s.innerHTML = html;
    var b = $('bt-bac-suivant');
    if (b) b.textContent = bacNo === 0 ? 'Exercice suivant' : 'Terminer';
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

  // CE QU'UNE DEMONSTRATION FAIT VRAIMENT — trois cas, pas deux.
  // Annoncer « sans rien toucher » sur un ecran ou l'on ouvre un dossier
  // est aussi faux qu'annoncer une saisie la ou il n'y en a pas. Une
  // seule fonction, pour que le choix propose et le bandeau affiche
  // exactement la meme chose.
  function natureDemo(ecran) {
    var gestes = (api.demos && api.demos[ecran]) || [];
    var saisit = gestes.some(function (g) { return g.geste === 'saisir' || g.geste === 'choisir'; });
    var clique = gestes.some(function (g) { return g.geste === 'cliquer'; });
    if (saisit) return {
      court: 'les champs se remplissent, rien n’est enregistré',
      long: 'les champs se remplissent sous vos yeux, <b>rien n’est enregistré</b>'
    };
    if (clique) return {
      court: 'on ouvre et on montre, rien n’est modifié',
      long: 'on ouvre et on montre — <b>rien n’est modifié</b>'
    };
    return {
      court: 'on vous montre où, sans rien toucher',
      long: 'on vous montre <b>où</b>, sans rien toucher'
    };
  }

  function demoDebut(ecran) {
    if (demoEcran === ecran) return;
    demoFin();
    demoEcran = ecran;
    demoPhoto = {};
    if (api.verrou && api.verrou.armer) api.verrou.armer();
    racine.classList.add('demo');

    // LE BANDEAU DOIT DIRE CE QUI VA VRAIMENT SE PASSER.
    // Il annoncait « les champs se remplissent sous vos yeux » sur TOUS
    // les ecrans -- y compris Soir de match, dont les quatre gestes sont
    // en designation seule. On y voyait donc une promesse de saisie, et
    // rien ne se remplissait : on croit que c'est casse.
    var t = $('bt-demo-txt');
    if (t) t.innerHTML = 'Démonstration — ' + natureDemo(ecran).long;
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
    clavierMontrer(el);
    frappe = setInterval(function () {
      if (i >= txt.length) {
        clearInterval(frappe); frappe = null; feu(el);
        setTimeout(clavierCacher, 700);
        return;
      }
      var lettre = txt.charAt(i++);
      el.value += lettre;
      clavierTouche(lettre, i / txt.length);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, 62);
  }

  // LA MAIN QUI APPUIE. Elle designait ; elle agit maintenant.
  function doigtTape(el) {
    var d = $('bt-doigt'), o = $('bt-clic');
    if (d && !d.classList.contains('hide')) {
      d.classList.remove('tape'); void d.offsetWidth; d.classList.add('tape');
    }
    if (o && el) {
      var r = el.getBoundingClientRect();
      o.style.left = (r.left + Math.min(r.width * 0.42, 46)) + 'px';
      o.style.top = (r.top + Math.min(r.height * 0.55, 30)) + 'px';
      o.classList.remove('part'); void o.offsetWidth; o.classList.add('part');
    }
  }

  function jouerGeste(g, el, sansAnimation) {
    if (!el) return;
    if (g.geste === 'montrer') {
      // On ne touche a rien -- mais si la chose designee est un bouton,
      // la main fait le geste. « Coup de sifflet final, c'est ici » se
      // comprend mieux quand on voit ou l'on appuierait.
      if (!sansAnimation && el && /^(BUTTON|A)$/.test(el.tagName)) setTimeout(function(){ doigtTape(el); }, 380);
      return;
    }
    demoPhotographier(el, g.cible);
    if (g.geste === 'choisir') {
      if (!sansAnimation) doigtTape(el);
      el.value = g.valeur; feu(el); return;
    }
    if (g.geste === 'cliquer') {
      // Le clic se VOIT avant de se produire : la main appuie, l'onde
      // part du point touche, et l'effet suit. Sans ce decalage, l'ecran
      // change avant qu'on ait compris ou l'on avait clique.
      if (sansAnimation) { el.click(); return; }
      doigtTape(el);
      setTimeout(function () { try { el.click(); } catch (e) {} }, 210);
      return;
    }
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
      s: gestes.length + ' geste' + (gestes.length > 1 ? 's' : '') + ' — ' + natureDemo(cle).court
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
    // On retire l'etape d'arrivee. Deux raisons : on est deja sur
    // l'ecran, donc le halo sur l'entree de menu n'apprend rien a qui
    // vient de cliquer dessus ; et son texte est la description de
    // l'ecran, qu'on vient de lire dans le panneau. La repeter fait
    // perdre trois secondes et donne l'impression que rien ne demarre.
    if (etapes.length > 1 && etapes[0].halo && !etapes[0].cible) etapes = etapes.slice(1);
    else if (etapes.length && etapes[0].halo) etapes[0].halo = false;
    if (!etapes.length) return;
    chapCourant = 'ctx:' + cle;
    idx = 0;
    $('bt-narr').classList.remove('hide');
    enLecture = true;
    surveillerClics(true);
    majBoutonPlay();
    montrer(0);
  }

  // ===================================================================
  // LE SOMMAIRE
  // ===================================================================
  // L'ETAT, ECRIT NOIR SUR BLANC.
  // Deux choses peuvent rendre les animations invisibles, et aucune des
  // deux ne se voit : un fichier reste en cache, ou « mouvement reduit »
  // active dans le systeme. On les affiche plutot que de les faire
  // deviner.
  // L'INTERRUPTEUR DES ANIMATIONS
  // Le reglage systeme est respecte par defaut. Mais quand quelqu'un
  // clique pour dire « je veux les voir », sa demande passe avant celle
  // de sa machine. La classe est posee sur la racine du tutoriel ET sur
  // <html>, parce que l'ecran qui arrive est anime hors de #btut.
  function reglerAnim(force) {
    try { localStorage.setItem(CLE_ANIM, force ? '1' : '0'); } catch (e) {}
    racine.classList.toggle('anim', !!force);
    try { document.documentElement.classList.toggle('bt-anim', !!force); } catch (e) {}
  }
  function animForcee() {
    try { return localStorage.getItem(CLE_ANIM) === '1'; } catch (e) { return false; }
  }

  // L'ESSAI DES ANIMATIONS
  // « Je n'ai pas les memes animations » n'est pas exploitable : je ne
  // sais pas lesquelles manquent. Cet essai les joue une par une, en
  // les NOMMANT. La personne peut alors dire « la 3 et la 5 ne se
  // passent pas », et la on cherche quelque chose de precis.
  var ESSAIS = [
    { n: '1. La main traverse l’écran',   f: essaiMain },
    { n: '2. Le cadre se dessine',        f: essaiCadre },
    { n: '3. La main appuie, une onde part', f: essaiClic },
    { n: '4. Le clavier tape',            f: essaiClavier },
    { n: '5. La carte de chapitre',       f: essaiCarte }
  ];
  var essaiEnCours = false;

  function essaiMain(fini) {
    var d = $('bt-doigt');
    d.classList.remove('hide', 'efface');
    d.style.transition = 'none';
    d.style.left = Math.round(window.innerWidth * 0.18) + 'px';
    d.style.top = Math.round(window.innerHeight * 0.3) + 'px';
    void d.offsetWidth; d.style.transition = '';
    requestAnimationFrame(function () {
      d.classList.add('vole');
      d.style.left = Math.round(window.innerWidth * 0.78) + 'px';
      d.style.top = Math.round(window.innerHeight * 0.62) + 'px';
    });
    setTimeout(function () { d.classList.remove('vole'); fini(); }, 1400);
  }

  function essaiCadre(fini) {
    var cible = $('bt-tout');
    if (cible) { designer(cible, true); }
    setTimeout(fini, 1500);
  }

  function essaiClic(fini) {
    var cible = $('bt-tout');
    if (cible) doigtTape(cible);
    setTimeout(fini, 1100);
  }

  function essaiClavier(fini) {
    var faux = document.createElement('input');
    faux.style.cssText = 'position:fixed;left:12%;top:38%;width:260px;height:44px;' +
      'border-radius:10px;border:1px solid rgba(198,162,87,.4);background:#141F17;' +
      'color:#F4F1E9;padding:0 12px;font:14px sans-serif;z-index:3';
    document.body.appendChild(faux);
    taper(faux, 'on tape ici');
    setTimeout(function () { clavierCacher(); faux.remove(); fini(); }, 2200);
  }

  function essaiCarte(fini) {
    carteChapitre('Essai', 'La carte de chapitre', 'Elle passe entre deux parties', fini);
  }

  function lancerEssais() {
    if (essaiEnCours) return;
    essaiEnCours = true;
    var e = $('bt-etat');
    var i = 0;
    function suite() {
      if (i >= ESSAIS.length) {
        retirerHalo();
        essaiEnCours = false;
        rendreEtat();
        return;
      }
      var t = ESSAIS[i++];
      if (e) e.innerHTML = '<b>Essai en cours&nbsp;:</b> ' + t.n +
        '<br><span style="opacity:.7">Notez celles qui ne se produisent pas.</span>';
      try { t.f(suite); } catch (err) { suite(); }
    }
    suite();
  }

  function rendreEtat() {
    var e = $('bt-etat'); if (!e) return;
    var reduit = false;
    try { reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (err) {}

    var force = animForcee();

    // LA COMMANDE VA AVEC LES AUTRES COMMANDES.
    // Elle vivait en pied de sommaire, ou personne ne descend. Quand le
    // systeme bride les animations, elle se montre en haut, a cote de la
    // voix, avec une pastille qui bat -- pour que la personne la voie
    // sans qu'on ait a le lui dire. Sinon elle reste rangee.
    var cmd = $('bt-anim-cmd');
    if (cmd) {
      if (reduit || force) {
        cmd.textContent = force ? 'Animations forcées' : 'Activer les animations';
        cmd.title = force
          ? 'Cliquez pour revenir au réglage de votre système'
          : 'Votre système les a réduites — cliquez pour les voir quand même';
        cmd.classList.toggle('on', force);
        cmd.classList.remove('hide');
      } else {
        cmd.classList.add('hide');
      }
    }

    if (reduit && !force) {
      e.className = 'bt-etat alerte';
      e.innerHTML = '<b>Votre système demande des animations réduites</b> — c’est pour ça que rien ne semble ' +
        'bouger. Le tutoriel le respecte&nbsp;; le bouton <b>« Activer les animations »</b>, en haut, passe outre. ' +
        '<span style="opacity:.6">Version ' + VERSION + '</span>';
    } else if (force) {
      e.className = 'bt-etat';
      e.innerHTML = 'Animations <b>forcées</b>, quel que soit le réglage de votre système. ' +
        '<span style="opacity:.6">Version ' + VERSION + '</span>';
    } else {
      e.className = 'bt-etat';
      e.innerHTML = 'Animations <b>complètes</b>. Si vous ne voyez rien bouger, le navigateur garde une ' +
        'ancienne version&nbsp;: rechargez avec <code>Ctrl</code>&nbsp;+&nbsp;<code>Maj</code>&nbsp;+&nbsp;<code>R</code>. ' +
        '<span style="opacity:.6">Version ' + VERSION + '</span>';
    }

    e.innerHTML += ' <button type="button" class="bt-etat-act" id="bt-anim-essai" ' +
      'style="margin-left:8px">Tester les animations</button>';

    var t = $('bt-anim-essai');
    if (t) t.addEventListener('click', lancerEssais);
  }

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

    // Le role a change depuis la derniere visite : on ne refait pas tout,
    // on signale ce qui s'est ouvert.
    var kick = racine.querySelector('.bt-kick');
    if (kick) {
      if (progres.role && progres.role !== api.role)
        kick.innerHTML = 'Tutoriel · <span style="color:var(--bt-ok)">votre role a change</span>';
      else kick.textContent = 'Tutoriel';
    }

    // Tout est vu : le bouton ne dit plus « me montrer », il dit
    // « revoir ». Proposer de decouvrir ce qu'on connait deja donne le
    // sentiment que le tutoriel ne suit pas.
    var cta = $('bt-tout');
    if (cta) cta.lastChild.textContent = (vusE >= totalE && totalE)
      ? ' Revoir depuis le debut' : ' Tout me montrer';

    rendreEtat();

    var rep = $('bt-reprendre');
    if (progres.dernier && plan.some(function (c) { return c.cle === progres.dernier.chap; })) {
      var ch = plan.filter(function (c) { return c.cle === progres.dernier.chap; })[0];
      rep.textContent = '↩ Reprendre : ' + ch.titre;
      rep.classList.remove('hide');
    } else {
      rep.classList.add('hide');
    }

    // La carte n'est plus UN bouton : c'est un en-tete qui lance le
    // chapitre, et une liste d'ecrans qu'on peut ouvrir directement.
    // « Aller voir 5.2 Stock » ne doit pas obliger a traverser 5.1.
    $('bt-chaps').innerHTML = plan.map(function (c, i) {
      var n = c.ecrans.length;
      var vus = c.ecrans.filter(function (e) { return progres.vus[e.cle]; }).length;
      var fait = c.special ? !!progres.vus[c.cle] : (n > 0 && vus === n);
      var m = 0;
      c.ecrans.forEach(function (e) {
        m += mots((api.metas[e.cle] || {}).d || '');
        ((api.aides[e.cle]) || []).forEach(function (a) { m += mots(a); });
        // Chaque bloc ajoute une etape : la duree annoncee doit la
        // compter, sinon « 3 min » en vaut sept et personne ne se fie
        // plus au chiffre.
        ((api.blocs && api.blocs(e.cle)) || []).forEach(function () { m += 22; });
      });
      // UN RESUME PAR CHAPITRE, PAS UN POUR TOUS.
      //
      // Le test etait 'c.special ?' : les QUATRE chapitres speciaux
      // heritaient donc du resume des roles. La table des matieres
      // annoncait « Qui fait quoi, et qui ne peut pas quoi » devant
      // « Arriver et se connecter », devant « Le Studio » et devant
      // « A vous ». Un sommaire qui ment sur trois lignes sur quatre.
      var meta = META_SPECIAL[c.cle]
        || (c.special ? 'Un passage a part · ~2 min'
                      : n + ' écran' + (n > 1 ? 's' : '') + ' · ~' + minutes(m) + ' min');

      return '<div class="bt-chap' + (fait ? ' fait' : '') + '">' +
        '<button type="button" class="bt-chap-h" data-chap="' + c.cle + '">' +
          '<span class="bt-chap-n">' + (fait
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>'
            : (i + 1)) + '</span>' +
          '<span class="bt-chap-c">' +
            '<span class="bt-chap-t">' + echapper(c.titre) + '</span>' +
            '<span class="bt-chap-m">' + meta + '</span>' +
          '</span>' +
          '<svg class="bt-chap-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>' +
        '</button>' +
        (n ? '<div class="bt-chap-e">' + c.ecrans.map(function (e) {
          return '<button type="button" class="bt-puce' + (progres.vus[e.cle] ? ' vu' : '') +
            '" data-ecran="' + echapper(e.cle) + '" title="Ouvrir directement ce tutoriel">' +
            (e.num ? '<i>' + echapper(e.num) + '</i>' : '') + echapper(e.nom) + '</button>';
        }).join('') + '</div>' : '') +
        (n ? '<div class="bt-chap-j"><i style="width:' + Math.round(vus / n * 100) + '%"></i></div>' : '') +
      '</div>';
    }).join('');

    // L'acces direct : une pastille ouvre le tutoriel de CET ecran-la.
    $('bt-chaps').querySelectorAll('[data-ecran]').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var cle = b.getAttribute('data-ecran');
        $('bt-somm').classList.add('hide');
        $('bt-ctx').classList.add('hide');
        visiteEcran(cle, true);
      });
    });

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
      // Une carte avant chaque chapitre. Dix-neuf minutes d'affilee sans
      // respiration sont un seul bloc indifferencie : on ne sait ni ou
      // l'on en est, ni ce qui commence.
      plan.forEach(function (c, i) {
        var st = etapesDuChapitre(c);
        if (!st.length) return;
        var nEcr = c.ecrans.length;
        etapes.push({
          carte: {
            n: 'Chapitre ' + (i + 1) + ' sur ' + plan.length,
            titre: c.titre,
            sous: nEcr ? nEcr + ' écran' + (nEcr > 1 ? 's' : '') : 'Qui fait quoi, et qui ne peut pas quoi'
          },
          nom: c.titre
        });
        etapes = etapes.concat(st);
      });
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
    surveillerClics(true);
    majBoutonPlay();
    montrer(idx);
  }

  function etapesDuChapitre(c) {
    if (c.cle === '_entete') return etapesEntete();
    if (c.cle === '_connexion') return etapesConnexion();
    if (c.cle === '_pratique') return etapesPratique();
    if (c.cle === '_studio') return etapesStudio();
    if (c.special) return etapesRoles();
    var out = [];
    c.ecrans.forEach(function (e) { out = out.concat(etapesEcran(e)); });
    return out;
  }

  // UNE CIBLE PEUT N'EXISTER QU'UN INSTANT PLUS TARD.
  //
  // montrer() la cherchait une seule fois, dans la foulee. Or le Studio
  // se telecharge au premier clic : quand la premiere etape du chapitre
  // demandait #bs-home-nav, /studio/studio.html n'etait pas encore
  // arrive. Aucune erreur, aucun halo -- le narrateur parlait de choses
  // qu'on ne voyait pas. C'est ce qui a ete signale.
  //
  // getClientRects() reste le test : il ecarte les elements caches, donc
  // une cible qui existe dans un ecran masque ne fait pas poser la main
  // a 0,0. Le jeton garantit qu'une etape depassee n'ira jamais poser la
  // sienne. Au bout de 2,5 s on renonce, comme avant.
  function designerQuandPret(sel, g, e) {
    var fin = Date.now() + 2500;
    (function essai() {
      if (g !== jeton || etapes[idx] !== e) return;
      var el = null;
      try { el = document.querySelector(sel); } catch (err) { el = null; }
      if (el && el.getClientRects().length) { designer(el); return; }
      if (Date.now() < fin) { setTimeout(essai, 90); return; }
      retirerHalo();
    })();
  }

  function montrer(i) {
    // L'INCREMENT VIENT EN PREMIER, ET C'EST TOUT LE SUJET.
    //
    // taire() appelle speechSynthesis.cancel(), et Chrome declenche
    // onend SUR L'ELOCUTION ANNULEE. La fonction de suite de l'etape
    // PRECEDENTE s'executait donc : elle voyait que ses 2,2 secondes
    // etaient ecoulees, et avancait encore. Un clic sur « suivant »
    // faisait deux etapes, et ca s'enchainait -- la visite accelerait
    // toute seule des qu'on la pilotait a la main.
    //
    // En prenant le jeton avant d'annuler, tout ce qui etait en vol se
    // reconnait perime et se tait.
    var g = ++jeton;
    taire();
    if (minuteur) { clearTimeout(minuteur); minuteur = null; }
    var e = etapes[i]; if (!e) { terminer(); return; }
    idx = i;

    // ON RANGE LA DEMONSTRATION AVANT DE BOUGER, ET C'EST L'ORDRE QUI
    // COMPTE.
    //
    // Les champs remplis par la demonstration mettent l'administration
    // en « modifications non enregistrees ». Si l'on navigue avant de
    // les avoir remis, showSection() ouvre une vraie fenetre du
    // navigateur : « Quitter quand meme ? Elles seront perdues. » On la
    // recevait en plein milieu de la visite, pour des valeurs d'exemple
    // que le tutoriel venait lui-meme d'ecrire.
    //
    // demoFin() remet les valeurs d'origine PUIS efface le drapeau. Il
    // doit donc passer avant api.aller(), pas vingt lignes apres.
    if (demoEcran && (!e.geste || e.ecran !== demoEcran)) demoFin();

    // Les chapitres qui OUVRENT quelque chose -- l'ecran de connexion,
    // le Studio. On ouvre en entrant, on referme des qu'on en sort. Rien
    // ne doit rester ouvert derriere soi : quelqu'un qui quitte le
    // tutoriel devant un formulaire de connexion croit s'etre
    // deconnecte.
    gererSurcouche(e);

    // Le bac a sable : ouvert quand on arrive sur l'etape de pratique,
    // referme des qu'on en part.
    if (e.pratique) {
      if ($('bt-bac').classList.contains('hide')) { bacNo = 0; ouvrirBacDepuisVisite(); }
    } else if (!$('bt-bac').classList.contains('hide')) {
      $('bt-bac').classList.add('hide');
    }

    // Navigation : seulement quand on change d'écran. Rappeler
    // showSection à chaque conseil relancerait le chargement des
    // données et ferait clignoter l'écran à chaque phrase.
    if (e.ecran && api.ecranCourant() !== e.ecran) {
      api.aller(e.ecran);
      // L'ecran ARRIVE au lieu d'apparaitre. Une bascule instantanee ne
      // dit pas qu'on a change d'endroit ; ce leger recul, puis la mise
      // au point, le dit sans un mot.
      try {
        var sec = document.getElementById('section-' + e.ecran);
        if (sec) { sec.classList.remove('bt-entre'); void sec.offsetWidth; sec.classList.add('bt-entre'); }
      } catch (err) {}
      progres.vus[e.ecran] = true;
      ecrireProgres();
    }
    if (e.special) { progres.vus[chapCourant === '_entete' ? '_entete' : '_roles'] = true; ecrireProgres(); }

    progres.dernier = { chap: chapCourant, i: i };
    progres.role = api.role;
    ecrireProgres();

    // Le halo n'apparaît qu'à l'arrivée sur un écran : c'est le moment
    // où « où est-ce que je clique ? » se pose. Ensuite il gênerait.
    if (!e.carte) carteRanger();

    // Une carte de chapitre n'est pas une etape a lire : elle passe, et
    // la suivante enchaine. En pause, elle reste a l'ecran.
    if (e.carte) {
      retirerHalo();
      $('bt-ou').innerHTML = '';
      $('bt-dit').textContent = '';
      $('bt-narr-j').style.width = Math.round((i + 1) / etapes.length * 100) + '%';
      carteChapitre(e.carte.n, e.carte.titre, e.carte.sous, function () {
        if (g === jeton && enLecture && etapes[idx] === e) suivant();
      });
      return;
    }

    if (e.halo && e.ecran) {
      poserHalo(e.ecran);                       // « voila ou on clique »
    } else if (e.cible) {
      designerQuandPret(e.cible, g, e);
    } else {
      retirerHalo();
    }

    // Le geste part APRES que la main soit partie : voir la valeur
    // s'ecrire avant de savoir ou on regarde n'apprend rien.
    if (e.geste) setTimeout(function () { if (g === jeton && etapes[idx] === e) jouerDemo(idx); }, 520);

    // L'anneau : la progression se lit d'un coup d'oeil, sans compter.
    var pc = (i + 1) / etapes.length;
    var C = 2 * Math.PI * 7.4;
    var ou = $('bt-ou');
    ou.innerHTML =
      '<svg class="bt-anneau" viewBox="0 0 19 19"><circle class="fond" cx="9.5" cy="9.5" r="7.4"/>' +
      '<circle class="part" cx="9.5" cy="9.5" r="7.4" style="stroke-dasharray:' + C.toFixed(1) +
      ';stroke-dashoffset:' + (C * (1 - pc)).toFixed(1) + '"/></svg>' +
      echapper(e.nom || '') + ' <em>· étape ' + (i + 1) + ' sur ' + etapes.length + '</em>';

    // innerHTML volontaire : ces textes viennent de SECTION_HELP, écrit
    // dans le code source de l'admin, et portent des <b> et des <code>
    // qui font partie de l'explication. Aucune saisie d'utilisateur
    // n'entre jamais ici.
    ou.classList.remove('neuf'); void ou.offsetWidth; ou.classList.add('neuf');

    var dit = $('bt-dit');
    dit.innerHTML = e.html || '';
    dit.classList.remove('neuf'); void dit.offsetWidth; dit.classList.add('neuf');

    // Le balayage de la barre : un signal bref qui dit « on avance »,
    // la ou le regard est deja pose.
    var barre = $('bt-narr-j') && $('bt-narr-j').parentElement;
    if (barre) { barre.classList.remove('passe'); void barre.offsetWidth; barre.classList.add('passe'); }
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
      if (g !== jeton) return;             // une etape plus recente a pris le relai
      if (!enLecture) return;
      var reste = 2200 - (Date.now() - depuis);
      if (reste > 0) {
        minuteur = setTimeout(function () { if (g === jeton && enLecture) suivant(); }, reste);
        return;
      }
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

  // LE NARRATEUR S'ECARTE DE CE QU'ON DESIGNE.
  //
  // Il est ancre en bas. Quand la cible est en bas de l'ecran -- le
  // bouton « Envoyer le test », « Enregistrer », le dernier champ d'un
  // formulaire -- il se posait DESSUS : on entourait d'un cadre dore
  // quelque chose que le bloc de narration cachait.
  //
  // Faire defiler ne suffit pas : en bas de page il n'y a plus de marge.
  // C'est donc le narrateur qui monte. La decision se prend sur la
  // POSITION de la cible, pas sur le chevauchement constate : sinon il
  // ferait l'aller-retour a chaque pixel de defilement.
  // La surface reellement cachee, pour departager deux mauvaises
  // positions.
  function aire(a, b) {
    var l = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    var h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return (l > 0 && h > 0) ? l * h : 0;
  }

  function chevauchent(a, b, marge) {
    marge = marge || 0;
    return !(a.right < b.left - marge || a.left > b.right + marge ||
             a.bottom < b.top - marge || a.top > b.bottom + marge);
  }

  function ecarterNarrateur(r) {
    var narr = $('bt-narr');
    if (!narr || narr.classList.contains('hide')) return;

    // ON MESURE, ON NE SUPPOSE PAS.
    //
    // Premiere version : le narrateur montait des que la cible passait
    // dans la moitie basse de l'ecran. Erreur -- ca ne regarde que la
    // HAUTEUR. Une entree de menu est en bas A GAUCHE (x 30-340) ; le
    // narrateur est centre (x 430-1370). Ils ne se chevauchent jamais,
    // et pourtant il montait -- pour aller masquer le titre de l'ecran
    // qu'on venait d'ouvrir.
    //
    // On place donc le narrateur en bas, on mesure sa boite reelle, et
    // on ne le deplace QUE s'il couvre vraiment la cible. Et s'il la
    // couvre aussi en haut, il redescend : il n'y a rien a gagner a
    // bouger pour un chevauchement equivalent.
    var etatAvant = narr.classList.contains('haut');
    var trans = narr.style.transition;
    narr.style.transition = 'none';          // la mesure ne doit pas s'animer

    narr.classList.remove('haut');
    var enBas = narr.getBoundingClientRect();
    var geneEnBas = chevauchent(r, enBas, 10);

    if (geneEnBas) {
      narr.classList.add('haut');
      var enHaut = narr.getBoundingClientRect();
      // Une cible plus haute que l'ecran -- un long tableau, une colonne
      // de chiffres -- chevauche le narrateur DES DEUX COTES. On ne peut
      // plus l'eviter, alors on prend le moindre mal : le cote ou l'on
      // en cache le moins. Revenir bêtement en bas laissait la cible
      // couverte (constate a l'etape 30 du parcours complet).
      if (chevauchent(r, enHaut, 10)) {
        if (aire(r, enBas) <= aire(r, enHaut)) narr.classList.remove('haut');
      }
    }

    // On ne rend la transition qu'apres coup, et seulement si la
    // position a reellement change : sinon on animerait un sur-place.
    var etatApres = narr.classList.contains('haut');
    void narr.offsetWidth;
    narr.style.transition = trans;
    if (etatAvant === etatApres) return;
  }

  function poser(el) {
    var spot = $('bt-spot'), doigt = $('bt-doigt');
    el = boiteUtile(el);
    if (!el) { retirerHalo(); return; }
    var r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 16) { retirerHalo(); return; }

    // On decide AVANT de poser le halo : le fil et le clavier se
    // reglent ensuite sur la position reelle du narrateur.
    ecarterNarrateur(r);

    var p = 6;
    var L = r.width + p * 2, H = r.height + p * 2;
    spot.style.top = (r.top - p) + 'px';
    spot.style.left = (r.left - p) + 'px';
    spot.style.width = L + 'px';
    spot.style.height = H + 'px';
    spot.classList.remove('hide');

    // LE CADRE QUI SE DESSINE. Un rectangle qui apparait d'un coup ne
    // raconte rien ; un trait qui part d'un coin et fait le tour dit
    // « celle-ci, et pas une autre ». Le perimetre se recalcule a chaque
    // pose : un champ de recherche et un tableau n'ont pas la meme.
    var svg = $('bt-spot-svg'), rect = $('bt-spot-rect');
    if (svg && rect) {
      var w = Math.max(6, L - 4), hh = Math.max(6, H - 4);
      svg.setAttribute('viewBox', '0 0 ' + L + ' ' + H);
      rect.setAttribute('width', w); rect.setAttribute('height', hh);
      var per = 2 * (w + hh);
      rect.style.transition = 'none';
      rect.style.strokeDasharray = per + ' ' + per;
      rect.style.strokeDashoffset = per;
      void rect.getBoundingClientRect();
      rect.style.transition = '';
      rect.style.strokeDashoffset = '0';
    }
    spot.classList.remove('pose'); void spot.offsetWidth; spot.classList.add('pose');
    relierAuNarrateur(r);

    // LA MAIN DOIT VOYAGER, PAS SE TELEPORTER.
    //
    // Elle etait cachee en display:none entre deux etapes. En la
    // rallumant a sa nouvelle position dans la meme image, aucune
    // transition ne peut jouer : elle apparait deja arrivee. C'est
    // pour ca qu'on ne la voyait jamais bouger -- seul le clavier
    // semblait anime, parce que lui l'etait vraiment.
    //
    // Elle reste donc affichee pendant toute la visite, et on ne fait
    // que changer ses coordonnees : la transition CSS s'occupe du
    // trajet. Au tout premier affichage seulement, on la pose sans
    // transition a un point de depart plausible, puis on la lance a
    // l'image suivante.
    var y = (r.top + Math.min(r.height * 0.55, 30));
    var x = (r.left + Math.min(r.width * 0.42, 46));
    var premiereFois = doigt.classList.contains('hide');
    doigt.classList.remove('efface');

    if (premiereFois) {
      // Point de depart : le bord de l'ecran du cote d'ou elle vient,
      // a la hauteur du narrateur. Elle entre dans le champ au lieu de
      // se materialiser au milieu.
      var narr = $('bt-narr');
      var depart = narr && !narr.classList.contains('hide')
        ? narr.getBoundingClientRect().top - 40
        : window.innerHeight * 0.8;
      doigt.style.transition = 'none';
      doigt.style.left = Math.round(window.innerWidth * 0.5) + 'px';
      doigt.style.top = Math.round(depart) + 'px';
      doigt.classList.remove('hide');
      void doigt.offsetWidth;
      doigt.style.transition = '';
    }

    // Le voyage. requestAnimationFrame garantit que le navigateur a
    // bien enregistre la position de depart avant qu'on change.
    requestAnimationFrame(function () {
      doigt.style.top = y + 'px';
      doigt.style.left = x + 'px';
      doigt.classList.add('vole');
    });

    // L'onde d'arrivee part quand la main arrive, pas quand elle
    // decolle : sinon elle eclot dans le vide.
    if (tArrivee) clearTimeout(tArrivee);
    tArrivee = setTimeout(function () {
      tArrivee = null;
      doigt.classList.remove('vole');
      doigt.classList.remove('pose'); void doigt.offsetWidth; doigt.classList.add('pose');
    }, premiereFois ? 700 : 640);
  }

  // LE FIL. Ce qu'on dit et ce qu'on montre vivent chacun de leur cote
  // sur l'ecran ; une courbe entre les deux fait la phrase. On ne le
  // trace que si le narrateur est visible et assez loin de la cible --
  // un fil de trois pixels est du bruit.
  function relierAuNarrateur(r) {
    var fil = $('bt-fil'), path = $('bt-fil-p'), narr = $('bt-narr');
    if (!fil || !path || !narr || narr.classList.contains('hide')) { if (fil) fil.classList.add('hide'); return; }
    var n = narr.getBoundingClientRect();
    var x1 = r.left + r.width / 2, y1 = r.top + r.height / 2;
    var x2 = n.left + n.width / 2;
    // Le fil part du bord du narrateur qui regarde la cible : quand il
    // est passe en haut, c'est son bord INFERIEUR.
    var y2 = (y1 > n.bottom) ? n.bottom : n.top;
    if (Math.abs(y2 - y1) < 130) { fil.classList.add('hide'); return; }
    var cy = (y1 + y2) / 2;
    path.setAttribute('d', 'M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + cy + ' ' + x2 + ' ' + cy + ' ' + x2 + ' ' + y2);
    fil.classList.remove('hide');
  }

  // LE CLAVIER FANTOME. Une valeur qui apparait dans un champ ne dit pas
  // qu'on l'a tapee. Les touches s'allument au rythme des lettres, et la
  // barre du bas montre ou l'on en est dans le mot.
  var CLAV_R = ['azertyuiop', 'qsdfghjklm', 'wxcvbn'];
  function clavierPreparer() {
    var c = $('bt-clav'); if (!c || c.dataset.pret) return;
    c.querySelectorAll('.bt-clav-r').forEach(function (r, i) {
      r.innerHTML = CLAV_R[i].split('').map(function (l) {
        return '<span class="bt-clav-k" data-k="' + l + '">' + l + '</span>';
      }).join('');
    });
    c.dataset.pret = '1';
  }
  function clavierMontrer(el) {
    clavierPreparer();
    var c = $('bt-clav'); if (!c || !el) return;
    var r = el.getBoundingClientRect();
    var lc = 230, hc = 96;
    var g = Math.min(Math.max(8, r.left), window.innerWidth - lc - 8);

    // Le narrateur occupe le bas de l'écran, et sur téléphone il en
    // prend un bon tiers. Un clavier posé dessus cache la phrase qu'il
    // est censé illustrer. On cherche donc une place LIBRE : sous le
    // champ, sinon au-dessus, sinon au-dessus du narrateur.
    // La zone interdite, c'est le narrateur -- ou qu'il soit. Il peut
    // desormais etre en haut comme en bas : on raisonne sur sa boite,
    // pas sur une hypothese.
    var narr = $('bt-narr');
    var iH = 0, iB = 0;                                  // bande interdite
    if (narr && !narr.classList.contains('hide')) {
      var nb = narr.getBoundingClientRect();
      iH = nb.top; iB = nb.bottom;
    }
    function libre(top) {
      if (top < 8 || top + hc > window.innerHeight - 8) return false;
      if (!iB) return true;
      return (top + hc < iH - 8) || (top > iB + 8);      // au-dessus ou en dessous
    }

    var t = r.bottom + 12;                               // sous le champ
    if (!libre(t)) t = r.top - hc - 12;                  // au-dessus du champ
    if (!libre(t)) t = iB + 12;                          // sous le narrateur
    if (!libre(t)) t = iH - hc - 12;                     // au-dessus du narrateur
    if (!libre(t)) t = Math.max(8, window.innerHeight - hc - 8);

    c.style.left = g + 'px'; c.style.top = t + 'px';
    c.classList.remove('hide');
    var b = $('bt-clav-b'); if (b) b.innerHTML = '<i></i>';
  }
  function clavierTouche(lettre, avancement) {
    var c = $('bt-clav'); if (!c || c.classList.contains('hide')) return;
    var k = c.querySelector('[data-k="' + String(lettre || '').toLowerCase() + '"]');
    c.querySelectorAll('.bt-clav-k.on').forEach(function (x) { x.classList.remove('on'); });
    if (k) { k.classList.add('on'); setTimeout(function () { k.classList.remove('on'); }, 120); }
    var b = c.querySelector('#bt-clav-b i'); if (b) b.style.width = Math.round(avancement * 100) + '%';
  }
  function clavierCacher() { var c = $('bt-clav'); if (c) c.classList.add('hide'); }

  // LA CARTE DE CHAPITRE. Une respiration entre deux parties : sans
  // elle, dix-neuf minutes sont un seul bloc indifferencie.
  var carteT1 = null, carteT2 = null;
  function carteChapitre(n, titre, sous, quandFini) {
    var c = $('bt-carte'); if (!c) { quandFini(); return; }
    carteRanger();
    $('bt-carte-n').textContent = n;
    $('bt-carte-t').textContent = titre;
    $('bt-carte-s').textContent = sous || '';
    c.classList.remove('hide', 'sort');
    carteT1 = setTimeout(function () {
      carteT1 = null;
      c.classList.add('sort');
      carteT2 = setTimeout(function () {
        carteT2 = null;
        c.classList.add('hide'); c.classList.remove('sort');
        quandFini();
      }, 430);
    }, 1500);
  }
  // Appuyer sur « suivant » pendant une carte laissait la carte affichee
  // PAR-DESSUS l'etape suivante : on entendait la voix d'un ecran qu'on
  // ne voyait pas.
  function carteRanger() {
    if (carteT1) { clearTimeout(carteT1); carteT1 = null; }
    if (carteT2) { clearTimeout(carteT2); carteT2 = null; }
    var c = $('bt-carte'); if (c) { c.classList.add('hide'); c.classList.remove('sort'); }
  }

  function retirerHalo() {
    cibleCourante = null;
    // Plus de cible : le narrateur reprend sa place habituelle. Le
    // laisser en haut sans raison deroute -- on cherche ses commandes
    // la ou elles etaient.
    var nr = $('bt-narr'); if (nr) nr.classList.remove('haut');
    if (tPointe) { clearTimeout(tPointe); tPointe = null; }
    $('bt-spot').classList.add('hide');
    // La main s'efface sans quitter l'ecran : la reprendre en
    // display:none lui ferait perdre sa position, et le voyage suivant
    // redeviendrait une teleportation.
    $('bt-doigt').classList.add('efface');
    $('bt-fil').classList.add('hide');
    clavierCacher();
    if (window.innerWidth < 940 && api.fermerMenu) api.fermerMenu();
  }

  // ON NE LUTTE PAS CONTRE LA PERSONNE
  // Si elle clique dans l'administration pendant la visite, c'est
  // qu'elle explore. Continuer a defiler par-dessus son epaule --
  // changer d'ecran sous ses doigts, parler d'autre chose que ce
  // qu'elle regarde -- serait la pire des reponses. On se met en pause
  // et on le dit.
  //
  // isTrusted distingue son clic de ceux que le tutoriel declenche
  // lui-meme pendant une demonstration : sans cette garde, la
  // demonstration se mettrait en pause toute seule au premier geste.
  function clicDansAdmin(e) {
    if (!e.isTrusted) return;
    if (!enLecture) return;
    if (racine && racine.contains(e.target)) return;
    enLecture = false;
    taire();
    if (minuteur) { clearTimeout(minuteur); minuteur = null; }
    // L'ecouteur est en capture : il passe AVANT le gestionnaire de
    // l'admin. Ranger ici, c'est garantir que le clic qui suit -- une
    // navigation, le plus souvent -- ne trouvera plus de champ rempli
    // ni de drapeau leve.
    demoFin();
    majBoutonPlay();
    var n = $('bt-pause'); if (n) n.classList.remove('hide');
  }
  function surveillerClics(on) {
    if (on === clicsSurveilles) return;
    if (on) document.addEventListener('click', clicDansAdmin, true);
    else document.removeEventListener('click', clicDansAdmin, true);
    clicsSurveilles = on;
  }

  function gererSurcouche(e) {
    var veut = e.connexion ? '_connexion' : (e.studio ? '_studio' : null);

    // LE RETOUR ANTICIPE NE COUVRE QUE L'OUVERTURE, PAS LA SUITE.
    //
    // Il etait en tete de fonction : des la deuxieme etape du chapitre,
    // surcouche valait deja '_studio' et gererSurcouche ressortait
    // aussitot. Le bloc qui ouvre le plan de travail, place plus bas,
    // n'etait donc JAMAIS atteint -- le Studio restait sur son accueil
    // pendant que le narrateur decrivait la colonne d'outils. Constate
    // au banc : 13 etapes sans le moindre halo.
    if (surcouche !== veut) {
      fermerSurcouche();
      if (veut === '_connexion' && api.connexion) { api.connexion.montrer(); surcouche = '_connexion'; }
      if (veut === '_studio' && api.studio) { api.studio.ouvrir(); surcouche = '_studio'; }
    }

    // LE STUDIO A DEUX DECORS, ET LES CIBLES DE L'UN N'EXISTENT PAS
    // DANS L'AUTRE.
    //
    // L'accueil montre les projets ; l'atelier montre le plan de
    // travail. #bs-format, #bs-rail, #bs-canvas vivent dans #bs-app,
    // cache tant qu'aucun projet n'est ouvert -- les designer depuis
    // l'accueil pointait le vide. On ouvre donc vraiment un plan de
    // travail, monte en memoire et jamais enregistre.
    if (surcouche === '_studio' && api.studio) {
      if (e.atelier && !atelierOuvert) {
        if (api.studio.atelier) { api.studio.atelier(); atelierOuvert = true; }
      } else if (!e.atelier && atelierOuvert) {
        if (api.studio.accueil) api.studio.accueil();
        atelierOuvert = false;
      }
    }
  }

  function fermerSurcouche() {
    if (surcouche === '_connexion' && api.connexion) api.connexion.cacher();
    if (surcouche === '_studio' && api.studio) api.studio.fermer();
    surcouche = null;
    atelierOuvert = false;
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
    var np = $('bt-pause'); if (np && enLecture) np.classList.add('hide');
    var i = $('bt-play-i'), t = $('bt-play-t');
    if (t) t.textContent = enLecture ? 'Pause' : 'Reprendre';
    if (i) i.innerHTML = enLecture ? '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>' : '<path d="M8 5v14l11-7z"/>';
    var b = $('bt-play'); if (b) b.setAttribute('aria-label', enLecture ? 'Pause' : 'Reprendre');
  }

  function terminer() {
    enLecture = false;
    demoFin();
    fermerSurcouche();
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
    fermerSurcouche();
    surveillerClics(false);
    carteRanger();
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
    fermerSurcouche();
    $('bt-bac').classList.add('hide');
    surveillerClics(false);
    carteRanger();
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
    $('bt-bac-fermer').addEventListener('click', fermerBac);
    $('bt-bac-rejouer').addEventListener('click', rendreBac);
    $('bt-bac-suivant').addEventListener('click', function () {
      if (bacNo === 0) { bacNo = 1; rendreBac(); }
      else { progres.vus['_pratique'] = true; ecrireProgres(); fermerBac(); }
    });
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
    var liste = $('bt-voix-liste');
    if (liste) liste.addEventListener('change', function () {
      try { localStorage.setItem(CLE_VOIX_NOM, liste.value); } catch (e) {}
      voixFr = choisirVoix();
      majNoteVoix();
      essayerVoix();
    });
    var essai = $('bt-voix-essai');
    if (essai) essai.addEventListener('click', essayerVoix);

    $('bt-voix2').addEventListener('click', function () {
      reglerVoix(!voixOn);
      // On relit l'étape en cours : activer la voix sans rien entendre
      // laisse croire que ça n'a pas marché.
      if (voixOn && enLecture) montrer(idx);
    });

    var cmdAnim = $('bt-anim-cmd');
    if (cmdAnim) cmdAnim.addEventListener('click', function () {
      reglerAnim(!animForcee());
      rendreEtat();
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
    // Un rechargement en pleine demonstration ne doit pas laisser le
    // formulaire de connexion en travers de l'ecran.
    window.addEventListener('beforeunload', fermerSurcouche);

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
      reglerAnim(animForcee());
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

    // LE DIAGNOSTIC. 98 selecteurs pointent vers un fichier de 15 000
    // lignes qui bouge. Le jour ou l'un d'eux disparait, RIEN ne le
    // signale : la main ne vient pas, et personne ne sait pourquoi.
    // A lancer dans la console apres toute retouche de l'admin :
    //     BaobabsTutoriel.diagnostic()
    diagnostic: function () {
      if (!monte) { console.warn('[Tutoriel] pas encore monte'); return; }
      var reduit = false;
      try { reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
      console.log('[Tutoriel] version ' + VERSION + ' — animations ' +
                  (reduit ? 'REDUITES par le systeme' : 'completes'));
      var pb = [], n = 0;
      var cibles = api.cibles || {}, aides = api.aides || {};
      Object.keys(cibles).forEach(function (ecran) {
        var liste = cibles[ecran] || [];
        var nc = liste.length, na = (aides[ecran] || []).length;
        if (nc && na !== nc) pb.push(ecran + ' : ' + na + ' conseils pour ' + nc + ' cibles — table ignoree en entier');
        liste.forEach(function (sel, i) {
          if (!sel) return;
          n++;
          var t;
          try { t = document.querySelectorAll(sel); }
          catch (e) { pb.push(ecran + '[' + i + '] ' + sel + ' — selecteur invalide'); return; }
          if (!t.length) pb.push(ecran + '[' + i + '] ' + sel + ' — INTROUVABLE');
          else if (t.length > 1) pb.push(ecran + '[' + i + '] ' + sel + ' — ' + t.length + ' elements, seul le premier sera designe');
        });
      });
      var ecransSansTable = Object.keys(aides).filter(function (k) { return !cibles[k]; });
      console.log('%c[Tutoriel] ' + n + ' cibles verifiees sur ' + Object.keys(cibles).length + ' ecrans',
                  'font-weight:bold');
      if (ecransSansTable.length) console.log('  ecrans sans table de cibles : ' + ecransSansTable.join(', '));
      if (!pb.length) console.log('%c  tout est en place', 'color:#93CE43');
      else pb.forEach(function (l) { console.warn('  ' + l); });
      return { cibles: n, problemes: pb };
    },
    // Pour le banc d'essai et la console : savoir où on en est.
    etat: function () {
      return { chapitres: plan.length, etapes: etapes.length, idx: idx, lecture: enLecture, voix: voixOn, voixFr: voixFr && voixFr.name };
    }
  };
})();
