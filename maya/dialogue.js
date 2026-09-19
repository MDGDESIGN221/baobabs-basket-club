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
  /* LA DERNIERE DEMANDE COMPLETE, pas seulement la question ouverte.
     C'est ce qui permet a « continue » de reprendre la ou on en etait,
     et ce sur quoi s'appuiera la correction (« non, les U20 »). */
  var dernier = null;
  /* ET LA DERNIERE PERSONNE MONTREE, a part. « Elle », « son », « sa »
     ne renvoient pas a la derniere DEMANDE mais a la derniere PERSONNE,
     et les deux divergent des qu'on intercale « fais-moi le point ». */
  var dernierePersonne = null;

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
    finPenser();
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

  /* ==================================================================
     ELLE MONTRE QU'ELLE CHERCHE
     ------------------------------------------------------------------
     Une lecture reelle prend une a trois secondes. Pendant ce temps, le
     fil ne bougeait pas : on croyait qu'elle n'avait rien compris, ou
     qu'elle etait cassee. C'est exactement ce qui fait dire d'une
     assistante qu'elle est bete -- pas ce qu'elle repond, mais le
     silence avant.

     La bulle se pose des qu'une reponse part chercher quelque chose, et
     disparait a la premiere phrase rendue. Si la reponse est immediate,
     personne ne la voit passer.
     ================================================================== */
  function penser() {
    if (document.getElementById('maya-pense')) return;
    var d = document.createElement('div');
    d.className = 'maya-elle maya-pense';
    d.id = 'maya-pense';
    d.innerHTML = '<span class="maya-pts"><i></i><i></i><i></i></span>';
    fil.appendChild(d);
    bas();
  }
  function finPenser() {
    var d = document.getElementById('maya-pense');
    if (d) d.remove();
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

  /* LES INITIALES SE PRENNENT SUR LES MOTS, pas sur les deux premieres
     lettres. « Mame Diarra Ndong », « Maimouna Djanko » et « Mariama
     Diallo » donnaient trois pastilles « MA » identiques, cote a cote,
     dans la meme liste : vu en production. */
  function initiales(nom) {
    return String(nom || '?').trim().split(/\s+/).map(function (m) { return m[0]; })
             .join('').slice(0, 2).toUpperCase();
  }

  function cartePersonne(p) {
    var ini = initiales(p.nom);
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
    penser();
    var ctx = {
      personnes: CTX && CTX.personnes ? CTX.personnes() : [],
      ecrans: CTX && CTX.ecrans ? CTX.ecrans() : [],
      // Les ecrans de l administration deviennent autant de sujets : ce
      // qui est ajoute demain est compris demain.
      sujets: CTX && CTX.sujets ? CTX.sujets() : [],
      // Tout le vocabulaire du club : adversaires, salles, postes,
      // categories. C'est lui qui permet de rattraper une faute sur
      // « Saltigue » ou « ailiere », pas seulement sur « joueuse ».
      vocabulaire: CTX && CTX.vocabulaire ? CTX.vocabulaire() : []
    };
    var r = M.comprendre.analyser(texte, ctx);

    /* ELLE DIT CE QU'ELLE A LU AUTREMENT.
       Corriger une faute en silence, c'est laisser quelqu'un croire
       qu'elle a compris ce qu'il a ecrit, alors qu'elle a repondu a
       autre chose. Une ligne discrete suffit, et elle permet de dire
       « non, je voulais bien ecrire ca ». */
    if (r.corrections && r.corrections.length) {
      finPenser();
      var d = document.createElement('div');
      d.className = 'maya-elle maya-lu';
      d.innerHTML = '<p class="doux">J’ai lu ' + r.corrections.map(function (c) {
        return '<b>' + esc(c[1]) + '</b>';
      }).join(', ') + '.</p>';
      fil.appendChild(d);
      bas();
      penser();
    }

    if (r.entites.personnes && r.entites.personnes.length > 1 &&
        (r.intention === 'qui' || r.intention === 'manque')) {
      return demanderLaquelle(r);
    }

    /* ==================================================================
       CE DONT ON PARLAIT COMBLE CE QUI MANQUE
       ------------------------------------------------------------------
       « Qu'est-ce qui manque a Marieme ? » puis « et son numero ? » : la
       seconde phrase ne nomme personne, et pourtant il n'y a aucun doute.
       On reprend donc l'entite de la demande precedente quand l'intention
       en a besoin et que la phrase n'en fournit pas.

       DEUX GARDE-FOUS. On n'herite QUE ce dont l'intention a besoin : une
       personne n'a rien a faire dans « fais-moi le point ». Et ON LE DIT,
       parce qu'une assistante qui complete toute seule sans prevenir
       finit par repondre a propos de quelqu'un d'autre sans qu'on
       comprenne pourquoi.
       ================================================================== */
    /* « qui » N'HERITE PAS, et le banc l'a montre : « trouve-moi Fatou »
       quand Fatou n'existe pas reprenait la personne d'avant et
       repondait sur elle, avec assurance. Chercher quelqu'un suppose
       qu'on le nomme ; si le nom ne donne rien, c'est le nom qui est en
       cause, pas le contexte. « manque » peut au contraire ne nommer
       personne (« qu'est-ce qui manque a son dossier »). */
    /* ------------------------------------------------------------------
       « ELLE », « SON », « SA » : LA PERSONNE DONT ON VIENT DE PARLER
       ------------------------------------------------------------------
       Teste en production, juste apres avoir montre une fiche :

         « elle a quel numero »  -> « On parlait de Inscriptions ... »
         « et son poste »        -> « Je ne comprends pas. »
         « ouvre sa fiche »      -> « Quel ecran voulez-vous ouvrir ? »

       Trois phrases d'affilee, toutes a propos de la meme joueuse, et
       aucune comprise. C'est ainsi qu'on parle : on nomme quelqu'un une
       fois, puis on dit « elle ».

       ET LA FICHE REPOND DEJA A TOUT. Numero, poste, taille, licence,
       compte, convocations : on n'a donc pas a comprendre la question,
       seulement a savoir DE QUI elle parle. C'est la meme doctrine que
       pour le match -- une fiche vaut cinquante motifs.

       LE PRONOM NE REMONTE PAS LOIN : seulement la derniere personne
       montree. Deviner au-dela ferait repondre sur quelqu'un d'autre,
       ce qui est pire que de ne pas repondre.
       ------------------------------------------------------------------ */
    /* ET SEULEMENT SI LA PHRASE NE PARLE DE RIEN D'AUTRE. Des qu'un
       sujet du club ou un ecran est reconnu, c'est de LUI qu'on parle :
       un pronom ne doit pas prendre le pas sur un sujet nomme. */
    if (r.pronomPersonne && dernierePersonne && !r.sujet && !r.entites.ecran) {
      r.entites.personne = dernierePersonne;
      // « ouvre sa fiche » reste une ouverture, et c'est sa fiche a elle
      // qu'on ouvre ; tout le reste devient une question sur elle, et la
      // fiche y repond deja.
      if (!r.intention || r.intention === 'sujet') r.intention = 'qui';
      r.herite = 'personne';
    }

    var BESOIN = { manque: 'personne', convoquer: 'date', quand: 'date' };
    var besoin = BESOIN[r.intention];
    if (besoin && !r.entites[besoin] && dernier && dernier.entites && dernier.entites[besoin]) {
      r.entites[besoin] = dernier.entites[besoin];
      r.herite = besoin;
    }

    // Le fil : on retient la derniere demande comprise, hors politesse.
    if (r.intention && r.intention !== 'politesse') dernier = r;

    if (r.herite === 'personne' && r.entites.personne) {
      finPenser();
      var dh = document.createElement('div');
      dh.className = 'maya-elle maya-lu';
      dh.innerHTML = '<p class="doux">Toujours à propos de <b>' +
                     esc(r.entites.personne.nom) + '</b>.</p>';
      fil.appendChild(dh); bas(); penser();
    }

    switch (r.intention) {
      case 'point':     return rPoint();
      case 'ici':       return rIci();
      case 'qui':       return rQui(r);
      case 'manque':    return rManque(r);
      case 'aller':     return rAller(r);
      case 'convoquer': return rConvoquer(r);
      case 'aide':      return rAide();
      case 'politesse': return rSocial(r);
      case 'combien':   return rCombien(r);
      case 'liste':     return rListe(r);
      case 'quand':     return rQuand();
      case 'resultat':  return rResultat();
      case 'filtrer':   return rFiltrer(r);
      case 'sujet':     return rSujet(r);
      default:          return rIncomprise(r);
    }
  }

  /* UN FILET : si une reponse asynchrone tombe sans rien rendre, la
     bulle tournerait pour toujours. Huit secondes, puis on le dit. */
  setInterval(function () {
    var d = document.getElementById('maya-pense');
    if (!d) return;
    if (!d.dataset.ne) { d.dataset.ne = Date.now(); return; }
    if (Date.now() - Number(d.dataset.ne) < 8000) return;
    finPenser();
    elle('<p>Je n’ai pas obtenu de réponse. Essayez encore, ou dites-le-moi autrement.</p>');
  }, 1000);


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
    var mod = CTX && CTX.moduleEcran ? CTX.moduleEcran(cle) : null;
    return M.collecte().then(function (faits) {
      var ici = faits.filter(function (f) { return f.section === cle; });
      if (ici.length) {
        return elle('<p>Sur <b>' + esc(titre) + '</b>, ' + ici.length + ' chose' +
          (ici.length > 1 ? 's' : '') + ' à regarder.</p>' + listeFaits(ici));
      }
      /* PAS SUR CET ECRAN, MAIS DANS CE DOMAINE. Vu en production : sur
         Matchs, avec un score de match non saisi, elle repondait « rien
         ne concerne Matchs » -- le fait vivait sur l'ecran Resultats.
         Techniquement exact, et c'est exactement ce qui la fait passer
         pour bete : le score d'un match est une affaire de matchs. */
      var pres = mod ? faits.filter(function (f) { return f.module === mod; }) : [];
      if (pres.length) {
        return elle('<p>Rien sur <b>' + esc(titre) + '</b> même, mais ' + pres.length +
          ' chose' + (pres.length > 1 ? 's' : '') + ' juste à côté.</p>' + listeFaits(pres));
      }
      elle('<p>Rien ne concerne <b>' + esc(titre) + '</b> en ce moment.</p>' +
        pistes(['fais-moi le point']));
    });
  }

  /* ------------------------------------------------------------------
     Trouver quelqu'un. Deux personnes possibles : on demande, on ne
     choisit pas. C'est la regle, et elle vaut aussi pour les doublons.
     ------------------------------------------------------------------ */
  function demanderLaquelle(r) {
    var opts = r.entites.personnes;
    attente = { type: 'choix', options: opts, choisi: function (p) { montrerPersonne(p); } };
    /* On reprend l'element que elle() vient de rendre, et non le dernier
       enfant du fil : c'est le meme dans un navigateur, mais l'un est
       garanti et l'autre suppose. Le banc des reponses a trouve la
       difference des sa premiere execution. */
    var d = elle('<p>J’ai trouvé ' + opts.length + ' personnes qui correspondent. Laquelle ?</p>' +
      '<div class="maya-faits">' + opts.map(cartePersonne).join('') + '</div>');
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

  /* LA FICHE D'UNE PERSONNE, comme celle d'un match : tout ce qu'on sait
     d'elle, d'un coup. « Et son numero ? », « elle joue a quel poste ? »,
     « elle est licenciee ? », « elle a un compte ? », « elle est
     convoquee ? » sont cinq questions pour une seule reponse.

     CE QUI N'Y EST JAMAIS : telephone, adresse, coordonnees du
     responsable, contenu d'une piece. Ces colonnes ne sont meme pas
     demandees a la base -- ce qui n'est pas lu ne peut pas fuir. */
  function montrerPersonne(p) {
    // C'est ici, et nulle part ailleurs, qu'on retient de qui on parle :
    // une fiche montree est ce qui rend « elle » sans ambiguite.
    dernierePersonne = p;
    var f = outil('fichePersonne');
    if (!f) {
      var suite = [];
      if (!p.compte_uid) suite.push('cette personne a-t-elle un compte');
      suite.push('qu’est-ce qui manque à ' + String(p.nom).split(' ')[0]);
      return elle(cartePersonne(p) +
        '<p class="doux">Cliquez pour ouvrir sa fiche.</p>' + pistes(suite));
    }
    penser();
    return f(p.id, p.genre).then(function (fi) {
      if (!fi) return elle(cartePersonne(p) + '<p class="doux">Cliquez pour ouvrir sa fiche.</p>');
      if (fi.interdit) return elle('<p>Votre casquette ne donne pas accès aux fiches.</p>');
      if (fi.illisible) return elle(cartePersonne(p) +
        '<p class="doux">Je n’ai pas pu lire le détail de sa fiche.</p>');

      var h = cartePersonne(p);
      if (fi.lignes && fi.lignes.length) {
        h += '<div class="maya-faits">' + fi.lignes.map(function (l) {
          return '<div class="maya-fait ' + (l.cls || '') + '"><b>' + esc(l.quoi) + '</b>' +
                 (l.sous || l.lab ? '<s>' + esc(l.sous || l.lab) + '</s>' : '') + '</div>';
        }).join('') + '</div>';
      }
      elle(h + (fi.ecran ? pistesEcran(fi.ecran) : ''));
    }).catch(function () {
      elle(cartePersonne(p) + '<p class="doux">Cliquez pour ouvrir sa fiche.</p>');
    });
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
    /* « Qu'est-ce qui manque a X » et « qui est X » rendent la MEME
       fiche : elle porte deja ce qui manque, ligne par ligne, avec sa
       barre d'alerte. Deux reponses differentes pour la meme personne
       obligeraient a poser les deux questions pour tout savoir. */
    if (outil('fichePersonne')) return montrerPersonne(p);

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
      /* LES PIECES SE LISENT LIGNE PAR LIGNE, pas dans les faits.
         Le centre d attention dit « 34 pieces jamais enregistrees » et
         cite quatre noms sur dix-sept : chercher la reponse dans un fait
         agrege ne pouvait pas marcher pour les treize autres. */
      var pieces = outil('piecesDe');
      var suite = pieces && p.genre === 'joueuse' ? pieces(p.id) : Promise.resolve(null);
      return suite.then(function (pc) {
        if (pc) {
          if (pc.manquantes.length) h += '<p>Il manque <b>' + pc.manquantes.join('</b> et <b>') + '</b>.</p>';
          if (pc.expirees.length) h += '<p><b>' + pc.expirees.join('</b> et <b>') + '</b> : expiré' +
            (pc.expirees.length > 1 ? 's' : '') + '.</p>';
          if (pc.bientot.length) h += '<p class="doux">Expire bientôt : ' + esc(pc.bientot.join(', ')) + '.</p>';
        }
        var rienAdire = !siens.length && p.fiche_etat === 'publiee' && p.compte_uid &&
                        pc && !pc.manquantes.length && !pc.expirees.length;
        if (rienAdire) h += '<p>Je ne vois rien qui manque à son dossier.</p>';
        elle(h);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  function rAller(r) {
    var e = r.entites.ecran;
    /* « OUVRE SA FICHE » N'EST PAS UN ECRAN. Aucun nom d'ecran dans la
       phrase, mais une personne dont on vient de parler : c'est sa fiche
       a elle qu'on demande, et l'administration sait l'ouvrir. */
    if (!e && r.entites.personne) {
      var p = r.entites.personne;
      elle('<p>J’ouvre la fiche de <b>' + esc(p.nom) + '</b>.</p>');
      var fo = outil('ouvrirPersonne');
      if (fo) setTimeout(function () { fo(p.genre, p.id); fermer(); }, 320);
      return;
    }
    if (!e) {
      return elle('<p>Quel écran voulez-vous ouvrir ?</p>' +
        pistes(['ouvre la billetterie', 'ouvre l’effectif', 'ouvre le match']));
    }
    elle('<p>J’ouvre <b>' + esc(e.titre) + '</b>.</p>');
    var f = outil('aller');
    if (f) setTimeout(function () { f(e.cle); fermer(); }, 320);
  }

  /* ------------------------------------------------------------------
     LA CONVOCATION, A N'IMPORTE QUELLE ETAPE
     ------------------------------------------------------------------
     Elle repondait « tout le monde est deja convoque : 17 joueuses »
     et s'arretait la. Vrai, et inutile : a ce moment-la, ce qu'on veut
     savoir c'est qui a repondu, qui manque, et ce qu'on peut faire.

     AUCUNE REPONSE NE DOIT ETRE UN CUL-DE-SAC. C'est la regle que ce
     bloc applique, et qu'il faudra tenir partout : apres un constat,
     toujours ce qu'on peut faire ensuite, et de preference en un clic.
     ------------------------------------------------------------------ */
  function nomsCourts(liste, max) {
    var m = max || 6;
    var vus = liste.slice(0, m).map(esc).join(', ');
    return liste.length > m ? vus + ' et ' + (liste.length - m) + ' autres' : vus;
  }

  function rConvoquer(r) {
    var prep = outil('preparerConvocation');
    if (!prep) return elle('<p>Je ne sais pas encore préparer une convocation depuis ici.</p>');
    penser();
    return prep(r.entites.date || null).then(function (d) {
      if (!d || !d.match) {
        return elle('<p>Je ne trouve pas de match à venir' +
          (r.entites.date ? ' à cette date' : '') + '.</p>' + pistesEcran('matches2'));
      }

      /* ETAPE 1 : il reste des joueuses a convoquer. On prepare, on
         montre, on attend -- inchange, c'est la partie qui marchait. */
      if (d.aConvoquer && d.aConvoquer.length) return confirmerConvocation(d);

      /* ETAPE 2 : tout le monde est convoque. C'est ICI que la reponse
         etait un cul-de-sac. */
      var h = '<p>Pour <b>' + esc(d.match.nom) + '</b>, ' + d.convoquees +
              ' joueuse' + (d.convoquees > 1 ? 's' : '') + ' convoquée' +
              (d.convoquees > 1 ? 's' : '') + '.</p>';
      h += '<p class="doux">' + esc(d.match.quand) +
           (d.match.jours === 0 ? ' · c’est aujourd’hui'
            : d.match.jours === 1 ? ' · c’est demain'
            : d.match.jours > 0 ? ' · dans ' + d.match.jours + ' jours' : '') + '</p>';

      var lignes = [];
      if (d.confirmees.length)
        lignes.push({ n: d.confirmees.length, quoi: 'ont confirmé', qui: d.confirmees, cls: '' });
      if (d.sansReponse.length)
        lignes.push({ n: d.sansReponse.length, quoi: 'n’ont pas encore répondu', qui: d.sansReponse, cls: 'important' });
      if (d.absentes.length)
        lignes.push({ n: d.absentes.length, quoi: 'seront absentes', qui: d.absentes, cls: 'urgent' });
      if (d.blessees.length)
        lignes.push({ n: d.blessees.length, quoi: 'sont blessées', qui: d.blessees, cls: 'urgent' });

      if (lignes.length) {
        h += '<div class="maya-faits">' + lignes.map(function (l) {
          return '<div class="maya-fait ' + l.cls + '"><b>' + l.n + ' ' + l.quoi + '</b>' +
                 '<s>' + nomsCourts(l.qui) + '</s></div>';
        }).join('') + '</div>';
      }

      /* ET CE QU'ON PEUT FAIRE. Le document officiel existe deja dans le
         Greffe, rempli avec le match et la liste : on le propose la ou
         la question se pose, pas dans un autre ecran. */
      var doc = outil('documentConvocation');
      var boutons = '';
      if (doc) {
        boutons = '<div class="maya-pistes">' +
          '<button type="button" class="maya-piste" id="maya-doc-conv">' +
          'écrire la convocation officielle</button></div>';
      }
      var d2 = elle(h + boutons + pistes(['ouvre le match']));
      var b = d2.querySelector('#maya-doc-conv');
      if (b) b.addEventListener('click', function () {
        var res = doc(d);
        if (res === 'casquette') return elle('<p>Le Greffe n’est pas ouvert à votre casquette.</p>');
        if (!res) return elle('<p>Je n’ai pas pu ouvrir l’acte.</p>');
        fermer();
      });
    }).catch(function () {
      elle('<p>Je n’ai pas pu lire les convocations. Rien n’a été fait.</p>');
    });
  }

  /* La confirmation avant d'ecrire, inchangee : elle prepare, elle
     montre exactement qui, elle attend, et « oui » tape a la main vaut
     le bouton. */
  function confirmerConvocation(d) {
    var h = '<div class="maya-conf"><b>' + esc(d.match.nom) + '</b>' +
      '<p class="doux">' + esc(d.match.quand) + '</p>' +
      '<p>Je convoque ' + d.aConvoquer.length + ' joueuse' + (d.aConvoquer.length > 1 ? 's' : '') +
      (d.convoquees ? ' (en plus des ' + d.convoquees + ' déjà convoquées)' : '') + ' :</p>' +
      '<ul>' + d.aConvoquer.slice(0, 20).map(function (j) { return '<li>' + esc(j.nom) + '</li>'; }).join('') +
      (d.aConvoquer.length > 20 ? '<li>et ' + (d.aConvoquer.length - 20) + ' autres</li>' : '') + '</ul>' +
      (d.ecartees && d.ecartees.length
        ? '<p class="doux">J’écarte ' + nomsCourts(d.ecartees) + ' : elles ne sont pas actives.</p>' : '') +
      '<div class="maya-conf-b">' +
        '<button type="button" class="maya-oui" id="maya-oui">Convoquer</button>' +
        '<button type="button" class="maya-non" id="maya-non">Non, laisse</button>' +
      '</div></div>';
    var d2 = elle(h);

    function faire() {
      attente = null;
      var ex = outil('convoquer');
      if (!ex) return elle('<p>Je ne peux pas écrire cette convocation d’ici.</p>');
      penser();
      ex(d.match.id, d.aConvoquer.map(function (j) { return j.id; })).then(function (n) {
        M.perimer();
        elle('<p>C’est fait : ' + n + ' joueuse' + (n > 1 ? 's' : '') + ' convoquée' +
          (n > 1 ? 's' : '') + ' pour <b>' + esc(d.match.nom) + '</b>.</p>' +
          '<p class="doux">Elles vont répondre une à une. Redemandez-moi où en est la ' +
          'convocation quand vous voulez.</p>' +
          pistes(['prépare la convocation', 'ouvre le match']));
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
    attente = { type: 'oui-non', oui: faire };
  }

  /* ------------------------------------------------------------------
     CE QU'ELLE SAIT D'ELLE-MEME.
     Pas une liste ecrite a la main : elle regarde ce qui est reellement
     branche, et filtre par ce que CETTE personne a le droit de voir. Une
     liste figee se perimerait au premier outil ajoute, et mentirait des
     la premiere casquette restreinte.
     ------------------------------------------------------------------ */
  function rAide() {
    var f = outil('capacites');
    if (!f) {
      return elle('<p>Voilà ce que je sais faire :</p>' +
        pistes(['fais-moi le point', 'trouve-moi une joueuse', 'prépare la convocation']));
    }
    var c = f();
    var h = '<p>Je suis <b>MAYA</b>, l’assistante de cette administration. ' +
            'Je lis les données du club et je vous dis ce que j’y vois.</p>';

    if (c.sujets.length) {
      h += '<p>Je peux compter et lister <b>' + c.sujets.length + ' choses</b> : ' +
           c.sujets.map(function (s) { return esc(s.nom); }).join(', ') + '.</p>';
    }
    if (c.ecrans) {
      h += '<p class="doux">Et je connais les ' + c.ecrans +
           ' écrans de l’administration : dites-moi un nom, même mal ' +
           'écrit, je vous y emmène.</p>';
    }
    if (c.actions.length) {
      h += '<p>Ce que je peux faire :</p><div class="maya-faits">' +
        c.actions.map(function (a) {
          return '<div class="maya-fait"><b>' + esc(a.quoi) + '</b><s>' + esc(a.comment) + '</s></div>';
        }).join('') + '</div>';
    }
    if (c.limites.length) {
      h += '<p class="doux">Ce que je ne sais pas faire, et autant le dire tout de suite : ' +
           c.limites.map(esc).join(' ; ') + '.</p>';
    }
    elle(h + pistes(['fais-moi le point', 'combien de joueuses',
                     'c’est quand le prochain match']));
  }

  /* ELLE NE DEVINE PAS, MAIS ELLE SE SOUVIENT DE QUOI ON PARLAIT.
     Quand une phrase courte n'est comprise ni par l'intention ni par le
     sujet, et qu'on parlait de quelque chose il y a un instant, il y a
     de bonnes chances qu'on en parle encore. On ne REPOND pas dessus
     pour autant : on DEMANDE. Repondre sur l'ancien sujet ferait dire
     n'importe quoi a « raconte-moi une blague » glisse apres une
     question sur l'effectif.

     C'est la nuance entre se souvenir et supposer. */
  /* « de » + « les matchs » ne donne pas « de les matchs ». Trois cas,
     et c'est tout ce dont on a besoin ici. */
  function deLe(nom) {
    var n = String(nom || '');
    if (n.indexOf('les ') === 0) return 'des ' + n.slice(4);
    if (n.indexOf('le ') === 0)  return 'du ' + n.slice(3);
    return 'de ' + n;
  }

  function rIncomprise(r) {
    /* On ne suppose une suite de conversation que si TOUS les mots de la
       phrase appartiennent au club. « raconte-moi une blague » en compte
       deux qu'elle n'a jamais vus : c'est une vraie demande inconnue, et
       repondre « on parlait des convocations » serait absurde. */
    if (dernier && dernier.sujet && !r.inconnus && (r.mots || []).length <= 4) {
      var s = dernier.sujet;
      return elle('<p>Je ne suis pas sûre de comprendre.</p>' +
        '<p class="doux">On parlait ' + esc(deLe(s.nom)) + ' : c’est toujours ça ?</p>' +
        pistes(['combien', 'la liste', 'fais-moi le point']));
    }
    return rIncomprisePure(r);
  }

  function rIncomprisePure(r) {
    elle('<p>Je ne comprends pas cette demande.</p>' +
      '<p class="doux">Je ne sais pas tout faire, et je préfère le dire. ' +
      'Voici ce que vous pouvez me demander :</p>' +
      pistes(r.exemples && r.exemples.length ? r.exemples.slice(0, 5)
        : ['fais-moi le point', 'que sais-tu faire']));
  }

  /* ==================================================================
     LES REPONSES QUI NE SE REPETENT PAS
     ------------------------------------------------------------------
     Deux bonjours de suite recevaient deux fois la meme phrase, au mot
     pres. Rien ne trahit plus surement une machine, et rien ne coupe
     plus vite l'envie de continuer a lui parler.

     On tire donc au sort, mais JAMAIS la meme deux fois d'affilee :
     l'aleatoire pur redonne la meme phrase une fois sur trois, ce qui
     est pire que pas d'aleatoire du tout -- on croit alors qu'elle s'est
     bloquee.
     ================================================================== */
  var DERNIERS = {};
  function varie(cle, choix) {
    if (choix.length === 1) return choix[0];
    var dispo = choix.filter(function (c) { return c !== DERNIERS[cle]; });
    var pris = dispo[Math.floor(Math.random() * dispo.length)];
    DERNIERS[cle] = pris;
    return pris;
  }

  /* L'HEURE DU JOUR. « Bonjour » a neuf heures du soir est la premiere
     chose qui sonne faux, et c'est gratuit a corriger. */
  function moment() {
    var h = new Date().getHours();
    if (h < 5) return 'nuit';
    if (h < 18) return 'jour';
    return 'soir';
  }
  function salutation() {
    var m = moment();
    return m === 'nuit' ? 'Bonsoir' : (m === 'soir' ? 'Bonsoir' : 'Bonjour');
  }

  /* Elle se souvient qu'on s'est deja parle dans ce fil : redire
     « Bonjour » au troisieme message serait le signe qu'elle n'a rien
     retenu de la conversation en cours. */
  var dejaSalue = false;

  function rSocial(r) {
    var nom = CTX && CTX.prenom ? CTX.prenom() : '';
    var quoi = r.social;

    if (quoi === 'salut') {
      if (dejaSalue) {
        return elle('<p>' + varie('resalut', [
          'Oui ?', 'Je vous écoute.', 'Toujours là.'
        ]) + '</p>');
      }
      dejaSalue = true;
      var s = salutation() + (nom ? ' ' + esc(nom) : '');
      return elle('<p>' + varie('salut', [
        s + '.',
        s + '. Que puis-je regarder pour vous ?',
        s + '. Je vous écoute.'
      ]) + '</p>' + pistes(['fais-moi le point', 'combien de joueuses',
                            'c’est quand le prochain match']));
    }

    if (quoi === 'forme') {
      dejaSalue = true;
      /* Elle ne pretend pas ressentir quelque chose, et elle ne fait pas
         non plus la lecon : elle renvoie vers ce qu'elle sait, qui est
         l'etat du club. C'est la reponse d'une collegue, pas d'un
         chatbot qui joue a etre humain. */
      return elle('<p>' + varie('forme', [
        'Très bien, merci. Et le club ?',
        'Je tourne. C’est du club que je peux vous parler.',
        'Tout va bien de mon côté. Et ici ?'
      ]) + '</p>' + pistes(['fais-moi le point']));
    }

    if (quoi === 'merci') {
      return elle('<p>' + varie('merci', [
        'Avec plaisir.', 'De rien.', 'Quand vous voulez.', 'À votre service.'
      ]) + '</p>');
    }

    if (quoi === 'adieu') {
      dejaSalue = false;
      var fin = moment() === 'jour' ? 'Bonne journée' : 'Bonne soirée';
      return elle('<p>' + varie('adieu', [
        fin + '.', 'À bientôt.', fin + ', ' + (nom ? esc(nom) : 'et à bientôt') + '.'
      ]) + '</p>');
    }

    if (quoi === 'accord') {
      return elle('<p>' + varie('accord', [
        'Parfait.', 'Très bien.', 'Entendu.'
      ]) + '</p>' + (attente ? '' : pistes(['fais-moi le point'])));
    }

    if (quoi === 'refus') {
      /* « Non », « laisse tomber », « attends » : si elle attendait
         quelque chose, c'est cela qu'on annule. Sinon c'est un simple
         non, et insister serait penible. */
      if (attente) { attente = null; return elle('<p>Très bien, j’annule. Rien n’a été fait.</p>'); }
      return elle('<p>' + varie('refus', [
        'D’accord.', 'Comme vous voulez.', 'Très bien.'
      ]) + '</p>');
    }

    if (quoi === 'relance') {
      /* « Continue » n'a de sens que s'il y a quelque chose a
         continuer. Le dire franchement vaut mieux que d'improviser une
         suite qui n'existe pas. */
      if (dernier && dernier.intention) return analyser(dernier.texte);
      return elle('<p>Continuer quoi ? Dites-moi ce que vous cherchez.</p>' +
        pistes(['fais-moi le point', 'que sais-tu faire']));
    }

    if (quoi === 'reproche') {
      /* ON NE SE JUSTIFIE PAS, ON EST UTILE. Quand quelqu'un dit qu'elle
         ne comprend rien, il a souvent raison : la bonne reponse est de
         montrer ce qu'elle sait faire, pas de s'excuser en trois lignes.
         Et de dire que c'est noté : une plainte qui tombe dans le vide
         ne se répète pas, elle fait arrêter d'essayer. */
      return elle('<p>Vous avez peut-être raison, et c’est utile à savoir. ' +
        'Dites-moi ce que vous vouliez faire, avec vos mots : ce que je ne comprends pas ' +
        'aujourd’hui, je peux apprendre à le comprendre.</p>' +
        pistes(['que sais-tu faire', 'fais-moi le point']));
    }

    if (quoi === 'excuse') {
      return elle('<p>' + varie('excuse', [
        'Il n’y a pas de quoi.', 'Aucun souci.', 'Ce n’est rien.'
      ]) + '</p>');
    }

    return rIncomprise(r);
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
    // Meme raison : compter des places n'a de sens que pour un match.
    if (s.cle === 'billetterie') return rFicheMatch('prochain');
    var f = outil('savoir');
    if (!f) return elle('<p>Je ne sais pas encore compter cela.</p>');
    return f(s.cle).then(function (d) {
      var hors = sujetHors(d, s.nom);
      if (hors) return elle(hors);

      /* UN ZERO NE DIT PAS S'IL EST VRAI. « 0 membre du staff » peut
         vouloir dire qu'il n'y en a pas, ou qu'elle n'a rien obtenu :
         une vue absente, une table vide parce qu'une migration n'est pas
         passee, un droit refuse sans erreur. Les trois donnent le meme
         chiffre et n'appellent pas la meme reaction. On le dit donc
         autrement, et on renvoie a l'ecran, qui saura. */
      if (!d.n) {
        return elle('<p>Je ne vois <b>aucune ligne</b> pour ' + esc(s.nom) + '.</p>' +
          '<p class="doux">Soit il n’y en a pas, soit je n’ai rien obtenu à la lecture : ' +
          'de mon côté les deux se ressemblent. L’écran vous le dira mieux que moi.</p>' +
          (d.ecran ? pistesEcran(d.ecran) : ''));
      }

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
      //
      // MAIS ON NE PROPOSE PAS CE QU'ON REFUSERA. « 6 abonnes » suivi de
      // « la liste des abonnes » menait a « je ne les fais pas defiler
      // ici » : une piste qui se referme sur un refus vaut moins que pas
      // de piste du tout.
      var suites = d.sansListe ? [] : ['la liste des ' + d.pluriel];
      elle(h + (d.sansListe && d.ecran ? pistesEcran(d.ecran) : '') +
           pistes(suites.concat(['fais-moi le point'])));
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
      /* TROIS VIDES QUI NE SE DISENT PAS PAREIL, et qui se disaient tous
         « Rien a lister ». Vu en production : « combien de partenaires »
         rendait 2, « la liste des partenaires » rendait « rien a lister
         dans Partenaires ». Deux reponses qui se contredisent dans la
         meme minute valent moins que pas de reponse du tout. */
      if (d.sansListe) {
        return elle('<p><b>' + d.n + '</b> ' + esc(d.n > 1 ? d.pluriel : d.nom) + '.</p>' +
          '<p class="doux">Je ne les fais pas défiler ici : ce sont des gens. ' +
          'L’écran les montre, avec ses propres protections.</p>' +
          (d.ecran ? pistesEcran(d.ecran) : ''));
      }
      if (!d.items || !d.items.length) {
        if (d.n) {
          return elle('<p>J’en compte <b>' + d.n + '</b>, mais je ne sais pas les nommer d’ici.</p>' +
            '<p class="doux">Le chiffre est bon ; c’est la liste qui m’échappe.</p>' +
            (d.ecran ? pistesEcran(d.ecran) : ''));
        }
        return elle('<p><b>Pas encore</b> de ' + esc(d.nom) + '.</p>' +
          '<p class="doux">Soit il n’y en a pas, soit je n’ai rien obtenu à la lecture : ' +
          'de mon côté les deux se ressemblent.</p>' +
          (d.ecran ? pistesEcran(d.ecran) : ''));
      }
      var max = 20, montres = d.items.slice(0, max);
      var h = '<p><b>' + d.n + '</b> ' + esc(d.n > 1 ? d.pluriel : d.nom) +
              (d.items.length > max ? ', voici les ' + max + ' premières' : '') + ' :</p>' +
        '<div class="maya-faits">' + montres.map(function (it) {
          return it.id
            ? '<button type="button" class="maya-pers" data-fiche="' + esc(it.id) + '" data-genre="' + esc(it.genre || '') + '">' +
              '<span class="rond">' + esc(initiales(it.nom)) + '</span>' +
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

  /* ------------------------------------------------------------------
     LE RESULTAT D'UN FILTRE
     ------------------------------------------------------------------
     Elle dit ce qu'elle a cherche, combien elle a trouve SUR COMBIEN, et
     les nomme. Le « sur combien » compte autant que le nombre : « 14 sans
     licence » ne veut rien dire sans « sur 17 ».

     ET ZERO EST UNE BONNE NOUVELLE, ici. « Aucune joueuse sans licence »
     se dit autrement que « aucune joueuse » : c'est le seul endroit de
     MAYA ou un zero est ce qu'on esperait.
     ------------------------------------------------------------------ */
  function rFiltrer(r) {
    var f = outil('filtrer');
    if (!f) return rIncomprisePure(r);
    penser();
    return f(r.criteres || []).then(function (d) {
      if (!d) return elle('<p>Je n’ai pas pu chercher.</p>');
      if (d.interdit) return elle('<p>Votre casquette ne donne pas accès à l’effectif.</p>');
      if (d.illisible) return elle('<p>Je n’ai pas pu lire ' + esc(d.illisible) + '.</p>' +
        '<p class="doux">Sans cela je ne peux pas répondre, et je préfère le dire.</p>');
      if (d.sansCritere) return rIncomprisePure(r);
      /* « Qui n'a pas repondu » sans match a venir rendait « aucune
         joueuse » : exact, et trompeur. Personne n'est convoque, donc
         personne ne doit de reponse. Repondre zero laisse croire que
         tout le monde a repondu. */
      if (d.sansMatch) {
        return elle('<p>Aucun match à venir n’est enregistré.</p>' +
          '<p class="doux">Personne n’est convoqué, donc personne ne doit de réponse. ' +
          'Ce n’est pas « tout le monde a répondu ».</p>' + pistesEcran('matches2'));
      }

      var quoi = d.criteres.join(' et ');

      if (!d.n) {
        return elle('<p><b>Aucune</b> joueuse ' + esc(quoi) + '.</p>' +
          '<p class="doux">Sur les ' + d.total + ' de l’effectif.</p>');
      }

      /* QUAND LE FILTRE PREND TOUT LE MONDE, « 17 sur 17 » se lit comme
         une coincidence. C'en est une information : il n'y a pas
         d'exception, et c'est cela qu'il faut dire. */
      var h = '<p><b>' + d.n + '</b> joueuse' + (d.n > 1 ? 's' : '') + ' ' + esc(quoi) +
              (d.n === d.total ? ', soit tout l’effectif.' : ', sur ' + d.total + '.') + '</p>';
      h += '<div class="maya-faits">' + d.items.slice(0, 20).map(function (it) {
        return '<button type="button" class="maya-pers" data-fiche="' + esc(it.id) +
          '" data-genre="joueuse"><span class="rond">' +
          esc(initiales(it.nom)) + '</span>' +
          '<span><b>' + esc(it.nom) + '</b>' + (it.sous ? '<s>' + esc(it.sous) + '</s>' : '') +
          '</span></button>';
      }).join('') + '</div>';
      if (d.items.length > 20) h += '<p class="doux">et ' + (d.items.length - 20) + ' autres.</p>';

      /* UN CRITERE QU'ELLE A RECONNU MAIS NE SAIT PAS APPLIQUER se dit :
         le taire ferait croire que le filtre a tout pris en compte. */
      if (d.inconnus && d.inconnus.length) {
        h += '<p class="doux">Je n’ai pas su tenir compte de : ' +
             esc(d.inconnus.join(', ')) + '.</p>';
      }

      elle(h + (d.ecran ? pistesEcran(d.ecran) : ''));
    }).catch(function () {
      elle('<p>Je n’ai pas pu chercher.</p>');
    });
  }

  /* ------------------------------------------------------------------
     LA FICHE D'UN MATCH
     ------------------------------------------------------------------
     Une seule reponse pour toutes les questions qu'on peut poser sur un
     match : l'heure, le lieu, l'entree, les places, la convocation, le
     cinq, le score. On ne cherche plus a deviner LAQUELLE est posee, on
     rend tout ce qu'on sait, et la personne y trouve la sienne.

     C'est ce que fait quelqu'un qui connait la maison et qui n'a pas
     bien entendu la question. Et c'est ce qui evite d'ajouter un motif
     par question jusqu'a la fin des temps.

     CE QU'ELLE NE SAIT PAS, ELLE LE DIT AUSSI. Une entree « inconnue »
     n'est pas une entree libre : un match sans tarif declare et sans
     billetterie ouverte n'est pas gratuit, il est non renseigne. Laisser
     croire le contraire ferait annoncer la gratuite sur le site.
     ------------------------------------------------------------------ */
  function ligneFiche(titre, valeur, cls) {
    return '<div class="maya-fait ' + (cls || '') + '"><b>' + esc(titre) + '</b>' +
           (valeur ? '<s>' + esc(valeur) + '</s>' : '') + '</div>';
  }

  function rFicheMatch(quand) {
    var f = outil('ficheMatch');
    if (!f) return rQuandSimple();
    penser();
    return f(quand).then(function (m) {
      if (!m) {
        return elle('<p>' + (quand === 'dernier'
          ? 'Aucun match terminé n’est enregistré.'
          : 'Aucun match à venir n’est enregistré.') + '</p>' + pistesEcran('matches2'));
      }

      var h = '';
      /* On a du remonter au dernier match : on le DIT avant de le
         montrer, sinon on croit parler du prochain. */
      if (m.passe) h += '<p>Aucun match à venir n’est enregistré. Le dernier :</p>';
      h += '<p><b>' + esc(m.nom) + '</b></p>';
      var quandTxt = m.date + (m.heure ? ' à ' + m.heure : '') + (m.lieu ? ' · ' + m.lieu : '');
      h += '<p>' + esc(quandTxt) + '</p>';
      if (m.jours === 0) h += '<p class="doux">C’est aujourd’hui.</p>';
      else if (m.jours === 1) h += '<p class="doux">C’est demain.</p>';
      else if (m.jours > 0) h += '<p class="doux">Dans ' + m.jours + ' jours.</p>';

      var lignes = [];

      if (m.score) lignes.push(ligneFiche(m.score + (m.issue ? ' · ' + m.issue : ''), 'Score final'));
      /* LE SCORE MANQUANT EST LA CHOSE A FAIRE. Tant qu'il n'est pas
         saisi, le site annonce ce match comme a venir et le classement
         ne bouge pas. */
      else if (m.aSaisir) lignes.push(ligneFiche('Le score n’est pas saisi',
        'Le site affiche encore ce match comme à venir', 'urgent'));

      if (m.competition) lignes.push(ligneFiche(m.competition, 'Compétition'));

      /* L'ENTREE, et c'est la question qui a declenche tout ceci. */
      if (m.entree === 'libre') {
        lignes.push(ligneFiche('Entrée libre', 'Personne ne paie'));
      } else if (m.entree === 'payante') {
        var d = m.venteOuverte
          ? (m.places != null ? m.places + ' place' + (m.places > 1 ? 's' : '') + ' encore disponible' + (m.places > 1 ? 's' : '') : 'vente ouverte')
          : 'mais la vente n’est pas ouverte';
        lignes.push(ligneFiche('Entrée payante', d, m.venteOuverte ? '' : 'important'));
      } else {
        lignes.push(ligneFiche('Entrée non renseignée',
          'Ni entrée libre, ni catégorie de billets : le site ne peut rien annoncer',
          'important'));
      }

      if (m.rdv) lignes.push(ligneFiche(m.rdv, 'Rendez-vous de l’équipe'));

      if (m.convoquees != null) {
        lignes.push(ligneFiche(
          m.convoquees ? m.convoquees + ' convoquée' + (m.convoquees > 1 ? 's' : '') +
                         (m.confirmees ? ', ' + m.confirmees + ' ont confirmé' : ', aucune réponse encore')
                       : 'Personne n’est convoqué',
          'Convocation', m.convoquees ? '' : 'important'));
      }

      if (m.cinq != null && m.statut !== 'termine') {
        lignes.push(ligneFiche(
          m.cinq >= 5 ? 'Le cinq est posé' : (m.cinq ? m.cinq + ' titulaire' + (m.cinq > 1 ? 's' : '') + ' sur 5' : 'Le cinq n’est pas posé'),
          'Composition', m.cinq >= 5 ? '' : 'important'));
      }

      if (m.consignes) lignes.push(ligneFiche(m.consignes, 'Consignes'));

      h += '<div class="maya-faits">' + lignes.join('') + '</div>';

      var suite = [];
      if (m.aSaisir) suite.push('ouvre les résultats');
      else if (m.statut !== 'termine') suite.push('prépare la convocation');
      suite.push('ouvre le match');
      elle(h + pistes(suite));
    }).catch(function () {
      elle('<p>Je n’ai pas pu lire ce match.</p>' + pistesEcran('matches2'));
    });
  }

  /* Le repli quand la fiche n'est pas branchee : l'ancienne reponse,
     courte, qui ne dit que la date. */
  function rQuandSimple() {
    var f = outil('prochainMatch');
    if (!f) return elle('<p>Je ne sais pas lire le calendrier d’ici.</p>');
    return f().then(function (m) {
      if (!m) return elle('<p>Aucun match à venir n’est enregistré.</p>' + pistesEcran('matches2'));
      elle('<p><b>' + esc(m.nom) + '</b></p><p>' + esc(m.quand) +
        (m.ou ? ' · ' + esc(m.ou) : '') + '</p>' + pistes(['ouvre le match']));
    });
  }

  function rQuand()   { return rFicheMatch('prochain'); }
  function rResultat(){ return rFicheMatch('dernier'); }

  /* ------------------------------------------------------------------
     LE SUJET SANS L'INTENTION. Elle n'a pas compris la tournure, mais
     elle sait de quoi on parle. Plutot que de renvoyer la personne les
     mains vides, elle dit ce qu'elle en sait -- EN PRECISANT qu'elle
     n'est pas sure. C'est la difference entre repondre a cote et
     repondre a cote avec aplomb.
     ------------------------------------------------------------------ */
  function rSujet(r) {
    var s = r.sujet;
    /* UN SUJET QUI DESIGNE UN OBJET PRECIS MERITE SA FICHE, PAS UN
       COMPTAGE. « L'entree de ce match est-elle payante ? » recevait
       « 3 matchs, 1 a venir » : le sujet etait juste, la reponse
       inutile. Quand on parle des matchs sans autre precision, c'est du
       prochain qu'on parle neuf fois sur dix. */
    if (s && s.cle === 'matchs') return rFicheMatch('prochain');
    /* LA BILLETTERIE N'EXISTE QUE PAR MATCH. « Il reste des places ? »,
       « c'est payant ? » ne se repondent pas par un comptage de
       categories de billets : c'est la fiche du match qui les porte. */
    if (s && s.cle === 'billetterie') return rFicheMatch('prochain');
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
