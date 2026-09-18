/* =====================================================================
   MAYA : lui parler
   ---------------------------------------------------------------------
   Le panneau, le fil de la conversation, et ce qu'elle repond. Il ne
   contient AUCUNE regle de comprehension (elle est dans comprendre.js,
   mesurable au banc) et AUCUN acces a la base : tout ce qu'elle sait
   faire lui est donne par l'hote, dans ctx.outils.

   C'est le point 8 du cahier des charges, et ce n'est pas qu'une
   precaution d'architecture : c'est ce qui rend vrai « MAYA respecte
   exactement les permissions ». Elle ne peut pas contourner ce qu'elle
   n'atteint pas. Chaque outil est une fonction de l'administration, qui
   passe par ses controles habituels.

   TROIS REGLES QUI NE SE NEGOCIENT PAS :

   1. ELLE NE DIT QUE CE QU'ELLE A LU. Aucune phrase de ce fichier
      n'invente un chiffre ou un nom. Quand elle ne trouve pas, elle le
      dit ; quand elle hesite entre deux personnes, elle demande.

   2. TOUT CE QUI ECRIT PASSE PAR UNE CONFIRMATION. Elle prepare,
      montre exactement ce qui va etre fait, et attend. Jamais de case
      pre-cochee, jamais d'action lancee sur une phrase ambigue.

   3. ELLE PROPOSE LA SUITE, sans l'imposer. Les pistes sont des phrases
      qu'on aurait pu taper : on apprend a lui parler en la lisant.
   ===================================================================== */
(function () {
  'use strict';

  var M = window.BaobabsMaya;
  if (!M) { console.error('[MAYA] dialogue.js charge avant le noyau'); return; }

  var CTX = null;      // fourni par l'hote : visage, ecrans, outils...
  var panneau = null;
  var fil = null;
  var champ = null;
  var attente = null;  // ce qu'elle attend de vous : un choix, un oui

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function outil(nom) {
    return CTX && CTX.outils && typeof CTX.outils[nom] === 'function' ? CTX.outils[nom] : null;
  }


  /* ==================================================================
     LE PANNEAU
     ================================================================== */
  function batir() {
    if (panneau) return panneau;
    panneau = document.createElement('div');
    panneau.id = 'maya-panneau';
    panneau.setAttribute('role', 'dialog');
    panneau.setAttribute('aria-label', 'MAYA');
    panneau.innerHTML =
      '<div class="maya-tete">' +
        (CTX && CTX.visage ? CTX.visage(false) : '') +
        '<span><b>MAYA</b><s>Assistante de l’administration</s></span>' +
        '<button type="button" class="maya-x" id="maya-x" aria-label="Fermer">×</button>' +
      '</div>' +
      '<div class="maya-fil" id="maya-fil"></div>' +
      '<div class="maya-bas">' +
        '<textarea id="maya-champ" rows="1" placeholder="Dites-moi ce que vous cherchez…" ' +
        'autocomplete="off" spellcheck="false"></textarea>' +
        '<button type="button" class="maya-envoi" id="maya-envoi" aria-label="Envoyer" disabled>' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
        'stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>' +
        '</button>' +
      '</div>';
    // Enfant direct de body : un ancetre en display:none annulerait le
    // position:fixed, et le panneau s'ouvrirait a 0 x 0 sans erreur.
    document.body.appendChild(panneau);

    fil = panneau.querySelector('#maya-fil');
    champ = panneau.querySelector('#maya-champ');
    var envoi = panneau.querySelector('#maya-envoi');

    panneau.querySelector('#maya-x').addEventListener('click', fermer);
    envoi.addEventListener('click', function () { envoyer(); });
    champ.addEventListener('input', function () {
      envoi.disabled = !champ.value.trim();
      champ.style.height = 'auto';
      champ.style.height = Math.min(champ.scrollHeight, 120) + 'px';
    });
    champ.addEventListener('keydown', function (e) {
      // Entree envoie, Maj+Entree passe a la ligne : c'est le geste que
      // tout le monde a dans les doigts.
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer(); }
      if (e.key === 'Escape') fermer();
    });
    // Un clic dans le panneau ne doit pas fermer les popovers de l'hote.
    panneau.addEventListener('click', function (e) { e.stopPropagation(); });
    return panneau;
  }

  function ouvrir(question) {
    batir();
    requestAnimationFrame(function () { panneau.classList.add('ouvert'); });
    if (!fil.childElementCount) accueil();
    if (question) { champ.value = question; envoyer(); }
    else setTimeout(function () { champ.focus(); }, 120);
  }

  function fermer() {
    if (!panneau) return;
    panneau.classList.remove('ouvert');
    attente = null;
  }

  function ouvert() { return !!(panneau && panneau.classList.contains('ouvert')); }


  /* ==================================================================
     LE FIL
     ================================================================== */
  function moi(texte) {
    var d = document.createElement('div');
    d.className = 'maya-moi';
    d.textContent = texte;
    fil.appendChild(d);
    bas();
  }
  function elle(html) {
    var d = document.createElement('div');
    d.className = 'maya-elle';
    d.innerHTML = html;
    fil.appendChild(d);
    brancher(d);
    bas();
    return d;
  }
  function bas() { fil.scrollTop = fil.scrollHeight; }

  /* Tout ce qui est cliquable dans une reponse passe par des attributs
     data-, branches ici : un seul endroit ou lire ce qui peut etre
     clique, plutot qu'un gestionnaire pose a chaque rendu. */
  function brancher(hote) {
    hote.querySelectorAll('[data-piste]').forEach(function (b) {
      b.addEventListener('click', function () { champ.value = b.getAttribute('data-piste'); envoyer(); });
    });
    hote.querySelectorAll('[data-aller]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = outil('aller'); if (f) f(b.getAttribute('data-aller'));
        fermer();
      });
    });
    hote.querySelectorAll('[data-fiche]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = outil('ouvrirPersonne');
        if (f) f(b.getAttribute('data-genre'), b.getAttribute('data-fiche'));
        fermer();
      });
    });
  }

  function pistes(liste) {
    if (!liste || !liste.length) return '';
    return '<div class="maya-pistes">' + liste.map(function (p) {
      return '<button type="button" class="maya-piste" data-piste="' + esc(p) + '">' + esc(p) + '</button>';
    }).join('') + '</div>';
  }

  function listeFaits(faits, max) {
    if (!faits.length) return '';
    return '<div class="maya-faits">' + faits.slice(0, max || 6).map(function (f) {
      return '<button type="button" class="maya-fait ' + esc(f.niveau) + '"' +
        (f.section ? ' data-aller="' + esc(f.section) + '"' : '') + '>' +
        '<b>' + esc(f.titre) + '</b>' +
        (f.detail ? '<s>' + esc(f.detail) + '</s>' : '') + '</button>';
    }).join('') + '</div>';
  }

  function cartePersonne(p) {
    var ini = String(p.nom || '?').trim().split(/\s+/).map(function (m) { return m[0]; })
                .join('').slice(0, 2).toUpperCase();
    return '<button type="button" class="maya-pers" data-fiche="' + esc(p.id) + '" data-genre="' + esc(p.genre) + '">' +
      (p.photo_url ? '<img src="' + esc(p.photo_url) + '" alt="">' : '<span class="rond">' + esc(ini) + '</span>') +
      '<span><b>' + esc(p.nom) + '</b><s>' + esc(etatPersonne(p)) + '</s></span></button>';
  }

  var ETATS_FICHE = {
    recue: 'dossier reçu, pas encore ouvert', a_verifier: 'dossier à vérifier',
    a_completer: 'dossier à compléter', validee: 'validée, pas encore sur le site',
    publiee: 'sur le site', refusee: 'archivée'
  };
  function etatPersonne(p) {
    var bouts = [];
    bouts.push(p.genre === 'staff' ? (p.fonction || 'staff') : (p.fonction || 'joueuse'));
    if (p.numero) bouts.push('n° ' + p.numero);
    bouts.push(ETATS_FICHE[p.fiche_etat] || p.fiche_etat || '');
    bouts.push(p.compte_uid ? 'a un compte' : 'pas de compte');
    return bouts.filter(Boolean).join(' · ');
  }


  /* ==================================================================
     REPONDRE
     ================================================================== */
  function envoyer() {
    var t = (champ.value || '').trim();
    if (!t) return;
    champ.value = ''; champ.style.height = 'auto';
    panneau.querySelector('#maya-envoi').disabled = true;
    moi(t);
    traiter(t);
  }

  /* CE QU'ELLE ATTEND PASSE AVANT CE QU'ELLE COMPREND.
     Si elle vient de demander « laquelle ? », « Marieme » est une
     reponse a cette question, pas une nouvelle recherche. C'est tout ce
     que veut dire « tenir le contexte » : une question ouverte, et la
     phrase suivante lue a la lumiere de cette question. */
  function traiter(texte) {
    if (attente) {
      var a = attente;
      var t = M.comprendre.plat(texte);
      if (a.type === 'oui-non') {
        attente = null;
        if (/^(oui|ok|d accord|vas y|allez y|fais le|fais|go|c est bon|confirme)\b/.test(t)) return a.oui();
        if (/^(non|annule|laisse|stop|pas maintenant)\b/.test(t)) { elle('<p>Très bien, je n’ai rien fait.</p>'); return; }
        // Ni oui ni non : ce n'etait pas une reponse, c'est autre chose.
      } else if (a.type === 'choix') {
        var trouve = M.comprendre.personnes(texte, a.options);
        if (trouve.length === 1) { attente = null; return a.choisi(trouve[0]); }
        attente = null;
      }
    }
    analyser(texte);
  }

  function analyser(texte) {
    var ctx = {
      personnes: CTX && CTX.personnes ? CTX.personnes() : [],
      ecrans: CTX && CTX.ecrans ? CTX.ecrans() : []
    };
    var r = M.comprendre.analyser(texte, ctx);

    if (r.entites.personnes && r.entites.personnes.length > 1 &&
        (r.intention === 'qui' || r.intention === 'manque')) {
      return demanderLaquelle(r);
    }

    switch (r.intention) {
      case 'point':     return rPoint();
      case 'ici':       return rIci();
      case 'qui':       return rQui(r);
      case 'manque':    return rManque(r);
      case 'aller':     return rAller(r);
      case 'convoquer': return rConvoquer(r);
      case 'aide':      return rAide();
      case 'politesse': return rPolitesse(r);
      case 'combien':   return rCombien(r);
      case 'liste':     return rListe(r);
      case 'quand':     return rQuand();
      case 'resultat':  return rResultat();
      case 'sujet':     return rSujet(r);
      default:          return rIncomprise(r);
    }
  }


  /* ------------------------------------------------------------------
     Faire le point. Elle ne recalcule rien : le noyau tient deja la
     liste, filtree par les permissions et par la memoire.
     ------------------------------------------------------------------ */
  function rPoint() {
    return M.collecte().then(function (faits) {
      var etat = M.etat();
      if (!etat.complet) {
        elle('<p>Je n’ai pas pu tout lire — ' + etat.echecs.length +
             ' source' + (etat.echecs.length > 1 ? 's' : '') + ' n’a pas répondu. ' +
             'Ce que je vous montre est donc incomplet.</p>');
      }
      if (!faits.length) {
        return elle('<p>Rien ne réclame de décision aujourd’hui. Le club tourne.</p>' +
          pistes(['qu’est-ce qui me concerne ici', 'que sais-tu faire']));
      }
      var urg = faits.filter(function (f) { return f.niveau === 'urgent'; }).length;
      var imp = faits.filter(function (f) { return f.niveau === 'important'; }).length;
      var ph = '<p>' + faits.length + ' chose' + (faits.length > 1 ? 's' : '') +
               ' demande' + (faits.length > 1 ? 'nt' : '') + ' une décision';
      if (urg) ph += ', dont <b>' + urg + ' urgente' + (urg > 1 ? 's' : '') + '</b>';
      else if (imp) ph += ', dont ' + imp + ' importante' + (imp > 1 ? 's' : '');
      ph += '.</p>';
      elle(ph + listeFaits(faits) +
        (faits.length > 6 ? '<p class="doux">Et ' + (faits.length - 6) + ' autre' +
          (faits.length - 6 > 1 ? 's' : '') + ', dans la cloche.</p>' : '') +
        pistes(['qu’est-ce qui me concerne ici', 'prépare la convocation']));
    });
  }

  /* ------------------------------------------------------------------
     Ce qui concerne l'ecran ouvert. C'est la seule reponse qui depend
     d'ou l'on se trouve, et c'est ce qui la rend contextuelle.
     ------------------------------------------------------------------ */
  function rIci() {
    var cle = CTX && CTX.ecranCourant ? CTX.ecranCourant() : null;
    var titre = CTX && CTX.titreEcran ? CTX.titreEcran(cle) : cle;
    if (!cle) return elle('<p>Je ne sais pas sur quel écran vous êtes.</p>');
    return M.collecte().then(function (faits) {
      var ici = faits.filter(function (f) { return f.section === cle; });
      if (!ici.length) {
        return elle('<p>Rien ne concerne <b>' + esc(titre) + '</b> en ce moment.</p>' +
          pistes(['fais-moi le point']));
      }
      elle('<p>Sur <b>' + esc(titre) + '</b>, ' + ici.length + ' chose' +
        (ici.length > 1 ? 's' : '') + ' à regarder.</p>' + listeFaits(ici));
    });
  }

  /* ------------------------------------------------------------------
     Trouver quelqu'un. Deux personnes possibles : on demande, on ne
     choisit pas. C'est la regle, et elle vaut aussi pour les doublons.
     ------------------------------------------------------------------ */
  function demanderLaquelle(r) {
    var opts = r.entites.personnes;
    attente = { type: 'choix', options: opts, choisi: function (p) { montrerPersonne(p); } };
    elle('<p>J’ai trouvé ' + opts.length + ' personnes qui correspondent. Laquelle ?</p>' +
      '<div class="maya-faits">' + opts.map(cartePersonne).join('') + '</div>');
    var d = fil.lastElementChild;
    d.querySelectorAll('[data-fiche]').forEach(function (b) {
      b.addEventListener('click', function () { attente = null; });
    });
  }

  function rQui(r) {
    var p = r.entites.personne;
    if (!p) {
      /* NE PAS TROUVER ET NE PAS AVOIR CHERCHE SONT DEUX CHOSES.
         Si la liste des personnes est vide, ce n'est pas que le nom
         n'existe pas : c'est qu'elle n'a rien pu lire. Dire « je ne
         trouve personne » serait un mensonge, et le plus couteux de
         tous, celui qui fait chercher un doublon qui n'existe pas. */
      var n = (CTX && CTX.personnes ? CTX.personnes() : []).length;
      if (!n) {
        return elle('<p>Je n’ai pas pu lire la liste des personnes du club.</p>' +
          '<p class="doux">Ce n’est pas que ce nom n’existe pas : je n’ai rien à ' +
          'consulter. La fiche est peut-être accessible depuis l’écran Effectif.</p>' +
          pistes(['ouvre l’effectif']));
      }
      return elle('<p>Je ne trouve personne de ce nom parmi les ' + n +
        ' personnes du club.</p>' +
        '<p class="doux">Je cherche par nom ou par prénom, chez les joueuses ' +
        'comme chez le staff.</p>');
    }
    montrerPersonne(p);
  }

  function montrerPersonne(p) {
    var suite = [];
    if (!p.compte_uid) suite.push('cette personne a-t-elle un compte');
    suite.push('qu’est-ce qui manque à ' + String(p.nom).split(' ')[0]);
    elle(cartePersonne(p) +
      '<p class="doux">Cliquez pour ouvrir sa fiche.</p>' + pistes(suite));
  }

  /* ------------------------------------------------------------------
     Ce qui manque a quelqu'un. Elle ne juge pas le dossier elle-meme :
     elle lit les faits qui portent sur cette personne, et l'etat de sa
     fiche. Rien d'invente.
     ------------------------------------------------------------------ */
  function rManque(r) {
    var p = r.entites.personne;
    if (!p) {
      /* SANS PERSONNE, DEUX CAS TRES DIFFERENTS.
         « qu'est-ce qui manque ici » parle de l'ecran : on y repond.
         « qu'est-ce qui manque a Marieme » parle de quelqu'un, et
         repondre sur l'ecran courant serait une reponse a cote qui a
         l'air d'en etre une. On retombe donc sur rQui, qui sait dire la
         difference entre « ce nom n'existe pas » et « je n'ai pas pu
         lire la liste ». */
      var parleDEcran = /\b(ici|cet ecran|cette page|ce dossier)\b/.test(r.plat || '');
      return parleDEcran ? rIci() : rQui(r);
    }
    return M.collecte().then(function (faits) {
      var cible = p.genre === 'staff' ? 'staff:' + p.id : 'players:' + p.id;
      var siens = faits.filter(function (f) {
        return f.cible === cible || (f.detail && f.detail.indexOf(p.nom) >= 0);
      });
      var h = cartePersonne(p);
      if (p.fiche_etat && p.fiche_etat !== 'publiee') {
        h += '<p>Son dossier est <b>' + esc(ETATS_FICHE[p.fiche_etat] || p.fiche_etat) + '</b>.</p>';
      }
      if (!p.compte_uid) h += '<p>Elle n’a <b>pas encore de compte</b>.</p>';
      if (siens.length) h += '<p>Et ' + siens.length + ' point' + (siens.length > 1 ? 's' : '') +
        ' la concerne' + (siens.length > 1 ? 'nt' : '') + ' :</p>' + listeFaits(siens);
      else if (p.fiche_etat === 'publiee' && p.compte_uid)
        h += '<p>Je ne vois rien qui manque à son dossier.</p>';
      elle(h);
    });
  }

  /* ------------------------------------------------------------------ */
  function rAller(r) {
    var e = r.entites.ecran;
    if (!e) {
      return elle('<p>Quel écran voulez-vous ouvrir ?</p>' +
        pistes(['ouvre la billetterie', 'ouvre l’effectif', 'ouvre le match']));
    }
    elle('<p>J’ouvre <b>' + esc(e.titre) + '</b>.</p>');
    var f = outil('aller');
    if (f) setTimeout(function () { f(e.cle); fermer(); }, 320);
  }

  /* ------------------------------------------------------------------
     La seule action qui ECRIT pour l'instant. Elle prepare, elle montre
     exactement ce qui va etre fait, et elle attend. Le bouton n'est
     jamais pre-selectionne, et « oui » tape a la main marche aussi.
     ------------------------------------------------------------------ */
  function rConvoquer(r) {
    var prep = outil('preparerConvocation');
    if (!prep) return elle('<p>Je ne sais pas encore préparer une convocation depuis ici.</p>');
    elle('<p>Je regarde…</p>');
    return prep(r.entites.date || null).then(function (d) {
      if (!d || !d.match) {
        return elle('<p>Je ne trouve pas de match à venir' +
          (r.entites.date ? ' à cette date' : '') + '.</p>');
      }
      if (!d.aConvoquer || !d.aConvoquer.length) {
        return elle('<p>Pour <b>' + esc(d.match.nom) + '</b>, tout le monde est déjà convoqué : ' +
          d.dejaConvoquees + ' joueuse' + (d.dejaConvoquees > 1 ? 's' : '') + '.</p>' +
          pistes(['ouvre le match']));
      }
      var h = '<div class="maya-conf"><b>' + esc(d.match.nom) + '</b>' +
        '<p class="doux">' + esc(d.match.quand) + '</p>' +
        '<p>Je convoque ' + d.aConvoquer.length + ' joueuse' + (d.aConvoquer.length > 1 ? 's' : '') +
        (d.dejaConvoquees ? ' (en plus des ' + d.dejaConvoquees + ' déjà convoquées)' : '') + ' :</p>' +
        '<ul>' + d.aConvoquer.slice(0, 20).map(function (j) { return '<li>' + esc(j.nom) + '</li>'; }).join('') +
        (d.aConvoquer.length > 20 ? '<li>et ' + (d.aConvoquer.length - 20) + ' autres</li>' : '') + '</ul>' +
        (d.ecartees && d.ecartees.length
          ? '<p class="doux">J’écarte ' + d.ecartees.map(function (x) { return esc(x); }).join(', ') +
            ' : elles ne sont pas actives.</p>' : '') +
        '<div class="maya-conf-b">' +
          '<button type="button" class="maya-oui" id="maya-oui">Convoquer</button>' +
          '<button type="button" class="maya-non" id="maya-non">Non, laisse</button>' +
        '</div></div>';
      var d2 = elle(h);
      function faire() {
        attente = null;
        var ex = outil('convoquer');
        if (!ex) return elle('<p>Je ne peux pas écrire cette convocation d’ici.</p>');
        elle('<p>J’enregistre…</p>');
        ex(d.match.id, d.aConvoquer.map(function (j) { return j.id; })).then(function (n) {
          M.perimer();
          elle('<p>C’est fait : ' + n + ' joueuse' + (n > 1 ? 's' : '') + ' convoquée' +
            (n > 1 ? 's' : '') + ' pour <b>' + esc(d.match.nom) + '</b>.</p>' +
            '<p class="doux">Les réponses arriveront dans l’écran Le match.</p>' +
            pistes(['ouvre le match']));
        }).catch(function (e) {
          elle('<p>L’enregistrement a échoué : ' + esc((e && e.message) || 'raison inconnue') +
               '. Rien n’a été convoqué.</p>');
        });
      }
      d2.querySelector('#maya-oui').addEventListener('click', faire);
      d2.querySelector('#maya-non').addEventListener('click', function () {
        attente = null;
        elle('<p>Très bien, je n’ai rien fait.</p>');
      });
      // « oui » tape a la main vaut le bouton : on ne force personne a
      // lacher le clavier au milieu d'une conversation.
      attente = { type: 'oui-non', oui: faire };
    }).catch(function () {
      elle('<p>Je n’ai pas pu lire les convocations. Rien n’a été fait.</p>');
    });
  }

  /* ------------------------------------------------------------------ */
  function rAide() {
    elle('<p>Voilà ce que je sais faire aujourd’hui :</p>' +
      pistes(['fais-moi le point',
              'qu’est-ce qui me concerne ici',
              'trouve-moi une joueuse',
              'qu’est-ce qui manque à son dossier',
              'ouvre la billetterie',
              'prépare la convocation']) +
      '<p class="doux">J’apprends au fur et à mesure. Si je ne comprends pas, ' +
      'je le dis plutôt que de répondre à côté.</p>');
  }

  /* ELLE NE DEVINE PAS. Une tournure jamais prevue n'est pas une panne,
     c'est une limite -- et l'annoncer vaut mieux que de partir sur une
     intention voisine avec aplomb. */
  function rIncomprise(r) {
    elle('<p>Je ne comprends pas cette demande.</p>' +
      '<p class="doux">Je ne sais pas tout faire, et je préfère le dire. ' +
      'Voici ce que vous pouvez me demander :</p>' +
      pistes(r.exemples && r.exemples.length ? r.exemples.slice(0, 5)
        : ['fais-moi le point', 'que sais-tu faire']));
  }

  /* ------------------------------------------------------------------
     DIRE BONJOUR. Ce n'est pas de la decoration : la premiere phrase
     decide si l'on en tape une deuxieme.
     ------------------------------------------------------------------ */
  function rPolitesse(r) {
    var t = r.plat;
    if (/^(merci|nickel|parfait|super)/.test(t))
      return elle('<p>Avec plaisir.</p>' + pistes(['fais-moi le point']));
    if (/^(au revoir|a bientot|bonne journee|bonne soiree|bye)/.test(t))
      return elle('<p>À tout à l’heure.</p>');
    if (/^(ca va|comment)/.test(t))
      return elle('<p>Tout va bien de mon côté. Et le club ?</p>' +
        pistes(['fais-moi le point']));
    var nom = CTX && CTX.prenom ? CTX.prenom() : '';
    elle('<p>Bonjour' + (nom ? ' ' + esc(nom) : '') + '.</p>' +
      pistes(['fais-moi le point', 'combien de joueuses', 'c’est quand le prochain match']));
  }

  /* ------------------------------------------------------------------
     COMPTER. Un chiffre, puis ce qu'il cache : « 17 joueuses, dont 15
     actives et 17 sans compte » vaut dix fois « 17 joueuses ».
     ------------------------------------------------------------------ */
  function sujetHors(d, nomSujet) {
    if (!d) return '<p>Je ne sais pas encore compter ' + esc(nomSujet) + '.</p>' +
      '<p class="doux">Je préfère le dire plutôt que d’avancer un chiffre.</p>';
    if (d.interdit) return '<p>Votre casquette ne donne pas accès à ' + esc(nomSujet) + '.</p>';
    if (d.illisible) return '<p>Je n’ai pas pu lire ' + esc(nomSujet) + '.</p>' +
      '<p class="doux">Ce n’est pas zéro : c’est que je n’ai rien obtenu.</p>';
    return null;
  }

  function rCombien(r) {
    var s = r.sujet;
    if (!s) return rIncomprise(r);
    var f = outil('savoir');
    if (!f) return elle('<p>Je ne sais pas encore compter cela.</p>');
    return f(s.cle).then(function (d) {
      var hors = sujetHors(d, s.nom);
      if (hors) return elle(hors);
      var h = '<p><b>' + d.n + '</b> ' + esc(d.n > 1 ? d.pluriel : d.nom) + '.</p>';
      if (d.note) h += '<p class="doux">' + esc(d.note) + '</p>';
      var utiles = (d.detail || []).filter(function (x) { return x.n > 0; });
      if (utiles.length) {
        h += '<p>' + utiles.map(function (x) {
          return '<b>' + x.n + '</b> ' + esc(x.quoi);
        }).join(', ') + '.</p>';
      }
      // « qui sont l'ecole de basket » ne se dit pas. « la liste des
      // inscriptions » se dit toujours, quel que soit le sujet, et le
      // mot « liste » est justement ce que l'analyse reconnait.
      elle(h + pistes(['la liste des ' + d.pluriel, 'fais-moi le point']));
    });
  }

  /* ------------------------------------------------------------------
     LISTER. Vingt lignes au plus : au-dela on ne lit plus, et l'ecran
     fait ce travail mieux qu'un fil de conversation.
     ------------------------------------------------------------------ */
  function rListe(r) {
    var s = r.sujet;
    if (!s) return rIncomprise(r);
    var f = outil('savoir');
    if (!f) return elle('<p>Je ne sais pas encore lister cela.</p>');
    return f(s.cle).then(function (d) {
      var hors = sujetHors(d, s.nom);
      if (hors) return elle(hors);
      if (!d.items || !d.items.length) return elle('<p>Rien à lister dans ' + esc(s.nom) + '.</p>');
      var max = 20, montres = d.items.slice(0, max);
      var h = '<p><b>' + d.n + '</b> ' + esc(d.n > 1 ? d.pluriel : d.nom) +
              (d.items.length > max ? ', voici les ' + max + ' premières' : '') + ' :</p>' +
        '<div class="maya-faits">' + montres.map(function (it) {
          return it.id
            ? '<button type="button" class="maya-pers" data-fiche="' + esc(it.id) + '" data-genre="' + esc(it.genre || '') + '">' +
              '<span class="rond">' + esc(String(it.nom || '?').slice(0, 2).toUpperCase()) + '</span>' +
              '<span><b>' + esc(it.nom) + '</b>' + (it.sous ? '<s>' + esc(it.sous) + '</s>' : '') + '</span></button>'
            : '<div class="maya-fait"><b>' + esc(it.nom) + '</b>' +
              (it.sous ? '<s>' + esc(it.sous) + '</s>' : '') + '</div>';
        }).join('') + '</div>';
      if (d.ecran) h += pistesEcran(d.ecran);
      elle(h);
    });
  }

  function pistesEcran(cle) {
    var titre = CTX && CTX.titreEcran ? CTX.titreEcran(cle) : cle;
    return '<div class="maya-pistes"><button type="button" class="maya-piste" data-aller="' +
           esc(cle) + '">ouvrir ' + esc(titre) + '</button></div>';
  }

  /* ------------------------------------------------------------------ */
  function rQuand() {
    var f = outil('prochainMatch');
    if (!f) return elle('<p>Je ne sais pas lire le calendrier d’ici.</p>');
    return f().then(function (m) {
      if (!m) return elle('<p>Aucun match à venir n’est enregistré.</p>' + pistesEcran('matches2'));
      var quand = m.jours === 0 ? 'C’est aujourd’hui'
                : m.jours === 1 ? 'C’est demain'
                : (m.jours > 0 ? 'Dans ' + m.jours + ' jours' : '');
      elle('<p><b>' + esc(m.nom) + '</b></p>' +
        '<p>' + esc(m.quand) + (m.ou ? ' · ' + esc(m.ou) : '') + '</p>' +
        (quand ? '<p class="doux">' + quand + '.</p>' : '') +
        pistes(['prépare la convocation', 'ouvre le match']));
    });
  }

  function rResultat() {
    var f = outil('dernierResultat');
    if (!f) return elle('<p>Je ne sais pas lire les résultats d’ici.</p>');
    return f().then(function (m) {
      if (!m) return elle('<p>Aucun match terminé n’est enregistré.</p>');
      elle('<p><b>' + esc(m.nom) + '</b></p>' +
        (m.score ? '<p>' + esc(m.score) + (m.issue ? ' · ' + esc(m.issue) : '') + '</p>'
                 : '<p class="doux">Le score n’a pas encore été saisi.</p>') +
        '<p class="doux">' + esc(m.quand) + '</p>' + pistesEcran('results'));
    });
  }

  /* ------------------------------------------------------------------
     LE SUJET SANS L'INTENTION. Elle n'a pas compris la tournure, mais
     elle sait de quoi on parle. Plutot que de renvoyer la personne les
     mains vides, elle dit ce qu'elle en sait -- EN PRECISANT qu'elle
     n'est pas sure. C'est la difference entre repondre a cote et
     repondre a cote avec aplomb.
     ------------------------------------------------------------------ */
  function rSujet(r) {
    var s = r.sujet;
    var f = outil('savoir');
    if (!f) return rIncomprise(r);
    return f(s.cle).then(function (d) {
      var hors = sujetHors(d, s.nom);
      var tete = '<p>Je ne suis pas sûre d’avoir bien compris. ' +
                 'Si vous me parlez de <b>' + esc(s.nom) + '</b> :</p>';
      if (hors) return elle(tete + hors);
      var h = tete + '<p><b>' + d.n + '</b> ' + esc(d.n > 1 ? d.pluriel : d.nom) + '.</p>';
      if (d.note) h += '<p class="doux">' + esc(d.note) + '</p>';
      var utiles = (d.detail || []).filter(function (x) { return x.n > 0; });
      if (utiles.length) h += '<p>' + utiles.map(function (x) {
        return '<b>' + x.n + '</b> ' + esc(x.quoi);
      }).join(', ') + '.</p>';
      var suite = ['la liste des ' + d.pluriel];
      if (s.cle === 'matchs') suite = ['c’est quand le prochain match', 'quel est le dernier résultat'];
      elle(h + pistes(suite) + (d.ecran ? pistesEcran(d.ecran) : ''));
    });
  }

  /* ------------------------------------------------------------------
     L'ACCUEIL. Une phrase, pas un discours : on vient de l'ouvrir pour
     lui demander quelque chose, pas pour la lire.
     ------------------------------------------------------------------ */
  function accueil() {
    var nom = CTX && CTX.prenom ? CTX.prenom() : '';
    elle('<p>Bonjour' + (nom ? ' ' + esc(nom) : '') + '. Que puis-je regarder pour vous ?</p>' +
      pistes(['fais-moi le point', 'qu’est-ce qui me concerne ici', 'que sais-tu faire']));
  }


  /* ==================================================================
     LE MONTAGE
     ------------------------------------------------------------------
     L'hote donne tout : le visage, les listes, la navigation, et les
     outils. MAYA ne va rien chercher elle-meme, et c'est ce qui garantit
     qu'elle ne peut pas contourner un controle d'acces.
     ================================================================== */
  function monter(ctx) {
    CTX = ctx || {};
    return api;
  }

  var api = {
    monter: monter,
    ouvrir: ouvrir,
    fermer: fermer,
    ouvert: ouvert,
    // Pour le banc : on lui donne une phrase sans passer par le clavier.
    dire: function (texte) { batir(); moi(texte); traiter(texte); }
  };

  M.dialogue = api;
})();
