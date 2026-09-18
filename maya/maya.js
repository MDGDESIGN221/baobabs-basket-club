/* =====================================================================
   MAYA : le noyau
   ---------------------------------------------------------------------
   MAYA n'est pas un systeme de plus. C'est le nom, la voix et la memoire
   de ce qui existait deja, et qui s'ignorait : la carte de suite logique,
   le centre d'attention, la cloche, le parcours du match, la veille de
   l'effectif. Cinq mecaniques, cinq vocabulaires, aucune source commune.

   CE FICHIER NE CONTIENT AUCUNE REGLE METIER, ET C'EST VOLONTAIRE.
   Il ne sait pas qu'un match a besoin d'une salle ni qu'une inscription
   attend une reponse. Il sait seulement ce qu'est un FAIT, comment on
   en collecte plusieurs, qui a le droit de le voir, et ce que la
   personne en a deja fait. Les regles restent la ou elles sont, dans
   l'administration, et s'enregistrent ici comme sources.

   C'est ce qui rend la bascule sure : le jour ou ce fichier est pose,
   rien ne change a l'ecran. Il repond exactement ce que repondaient les
   regles, dans le meme ordre.

   POURQUOI DEHORS. admin-matchs.html fait 35 000 lignes dans une seule
   fonction anonyme, ou deux fonctions de meme nom s'ecrasent en silence,
   sans erreur. Le Studio et le Greffe vivent dehors pour cette raison
   precise. MAYA aussi, et pour la meme : elle va grandir.

   UN SEUL GLOBAL : window.BaobabsMaya.
   ===================================================================== */
(function () {
  'use strict';

  /* ==================================================================
     CE QU'EST UN FAIT
     ------------------------------------------------------------------
     Un objet, un seul, pour les quatre vocabulaires d'aujourd'hui :

       quoi     l'identifiant du TYPE de fait. Stable dans le temps :
                c'est lui qui permet de se souvenir qu'on a deja ecarte
                cette suggestion-la. Voir cleDe() plus bas.
       cible    sur QUOI il porte : 'players:<id>'. Vide quand le fait
                ne porte sur rien de precis (« aucune saison ouverte »).
       niveau   urgent, important, attention, info.
       module   celui des onze modules de droits. MAYA se tait si la
                personne ne le voit pas.
       titre    ce qui s'est passe, en une ligne.
       detail   pourquoi ca compte, et ce que ca change.
       section  l'ecran ou l'on regle cela.
       portee   'club', 'fiche' ou 'match'. Dit qui doit l'afficher.

     Tout le reste est optionnel et traverse sans etre touche : une
     source peut poser ce qu'elle veut, MAYA le rendra tel quel.
     ================================================================== */

  var NIVEAUX = { urgent: 0, important: 1, attention: 2, info: 3 };
  var NIVEAU_DEFAUT = 'attention';

  /* L'IDENTIFIANT D'UN FAIT NE PEUT PAS ETRE SON TITRE.
     « 3 inscriptions sans reponse » devient « 4 inscriptions sans
     reponse » des le lendemain : la memoire ne reconnaitrait plus le
     fait qu'elle vient d'ecarter, et la suggestion reviendrait chaque
     jour avec un chiffre different.

     Une source peut donc poser son propre « quoi ». Quand elle ne le
     fait pas -- et aucune des vingt-cinq regles d'aujourd'hui ne le
     fait -- on le derive : module, ecran, et le titre debarrasse de ses
     chiffres. « 3 inscriptions » et « 4 inscriptions » donnent alors la
     meme cle, ce qui est exactement ce qu'on veut.

     C'est une derivation, pas une devinette : elle est reproductible, et
     poser un « quoi » explicite dans une regle la remplace sans rien
     casser ailleurs. */
  function cleDe(f) {
    if (f.quoi) return String(f.quoi);
    return (f.module || '-') + ':' + (f.section || '-') + ':' +
      String(f.titre || '')
        .toLowerCase()
        .replace(/\d+/g, '#')
        .replace(/\s+/g, ' ')
        .trim();
  }

  function normaliser(f, nomSource) {
    if (!f || typeof f !== 'object') return null;
    var n = {};
    for (var k in f) if (Object.prototype.hasOwnProperty.call(f, k)) n[k] = f[k];
    n.niveau = NIVEAUX[n.niveau] == null ? NIVEAU_DEFAUT : n.niveau;
    n.cible = n.cible == null ? '' : String(n.cible);
    n.portee = n.portee || 'club';
    n.source = n.source || nomSource || '?';
    n.quoi = cleDe(f);
    n.titre = String(n.titre == null ? '' : n.titre);
    n.detail = String(n.detail == null ? '' : n.detail);
    return n;
  }


  /* ==================================================================
     LES SOURCES
     ------------------------------------------------------------------
     Une source est une fonction qui rend des faits, ou une promesse de
     faits. Elle ne sait rien de MAYA : elle fait son travail et rend une
     liste. C'est ce qui permet d'enregistrer telles quelles les regles
     ecrites bien avant ce fichier.

     UNE SOURCE QUI TOMBE NE FAIT PAS TOMBER LES AUTRES. Une vue absente,
     une session expiree, un reseau qui pend : la source rend une liste
     vide et on continue. Mais on le NOTE -- rien n'est pire qu'un ecran
     vide sous un titre qui promet quelque chose, et c'est deja arrive
     ici. etat() dit combien de sources ont echoue a la derniere
     collecte, pour que l'affichage puisse le dire au lieu de se taire.
     ================================================================== */

  var SOURCES = {};
  var DERNIERE = { faits: null, quand: 0, echecs: [], sources: 0 };
  var enCours = null;
  var CTX = null;

  function source(nom, fn) {
    if (!nom || typeof fn !== 'function') return;
    SOURCES[nom] = fn;
  }

  function oublierSource(nom) { delete SOURCES[nom]; }


  /* ==================================================================
     LES PERMISSIONS
     ------------------------------------------------------------------
     MAYA n'a aucun privilege propre. Elle lit avec la session de la
     personne connectee, donc le RLS de la base filtre avant elle, et la
     vue personnes est declaree security_invoker pour cette raison.

     Ce filtre-ci est le second etage, et il sert a autre chose : ne pas
     PARLER d'un module qu'on ne voit pas. Sans lui, MAYA dirait a un
     coach « aucune inscription en retard » -- ce qui est une fuite par
     la negative : il apprend qu'il existe des inscriptions, et
     combien.
     ================================================================== */
  function autorise(f) {
    if (!f.module) return true;
    if (!CTX || typeof CTX.can !== 'function') return true;
    try { return CTX.can(f.module, 'voir') === true; }
    catch (e) { return false; }
  }


  /* ==================================================================
     LA MEMOIRE : maya_suivi
     ------------------------------------------------------------------
     TROIS ETATS, ET UN SEUL MASQUE.

       vu       la personne l'a lu. Le fait reste affiche : lire n'est
                pas faire, et c'est tout le sujet.
       traite   elle dit avoir fait le necessaire. LE FAIT RESTE AUSSI.
                S'il a vraiment ete regle, la donnee a change et il ne
                reviendra pas de lui-meme a la collecte suivante. S'il
                revient, c'est que ce n'etait pas fait -- et c'est une
                information, pas un bug. Masquer sur un clic ferait
                disparaitre un vrai probleme au premier « oui oui ».
       ecarte   mis en sommeil jusqu'a une date. Le seul qui masque, et
                seulement le temps dit.

     Autrement dit : UNE SUGGESTION DISPARAIT PARCE QUE LA DONNEE A
     CHANGE, JAMAIS PARCE QU'ON A CLIQUE QUELQUE PART. C'est la meme
     regle que la carte de suite logique s'imposait deja pour ses etapes,
     etendue a tout le reste.

     LA MEMOIRE NE STOCKE PAS LE TEXTE. Le titre, le detail, le nombre se
     recalculent a chaque collecte. Une memoire qui garderait la phrase
     finirait par repeter quelque chose qui n'est plus vrai.
     ================================================================== */

  var MEM = { lignes: null, quand: 0 };
  var MEM_FRAIS = 60000;

  function memLire(force) {
    if (!CTX || !CTX.sb) return Promise.resolve({});
    if (!force && MEM.lignes && (Date.now() - MEM.quand) < MEM_FRAIS)
      return Promise.resolve(MEM.lignes);
    return CTX.sb.get('maya_suivi?select=fait,cible,etat,jusqu_au,maj')
      .then(function (rows) {
        var m = {};
        (rows || []).forEach(function (r) { m[r.fait + ' ' + (r.cible || '')] = r; });
        MEM.lignes = m; MEM.quand = Date.now();
        return m;
      })
      .catch(function () {
        // Une memoire illisible ne doit pas faire taire MAYA : sans
        // elle, on montre tout. Trop, plutot que rien.
        MEM.lignes = {}; MEM.quand = Date.now();
        return {};
      });
  }

  function memSort(mem, f) {
    return mem[f.quoi + ' ' + f.cible] || null;
  }

  /* Endormi = ecarte, et pas encore reveille. Une ligne « ecarte » sans
     date ne dort pas : on ne peut pas eteindre un fait pour toujours. */
  function endormi(l) {
    if (!l || l.etat !== 'ecarte') return false;
    if (!l.jusqu_au) return false;
    return new Date(l.jusqu_au).getTime() > Date.now();
  }

  /* Ecrire : un upsert, parce que la meme personne reecrit souvent la
     meme ligne. La cle primaire (fait, cible, qui) fait le reste. */
  function marquer(f, etat, jours) {
    if (!CTX || !CTX.sb || typeof CTX.moi !== 'function') return Promise.resolve(false);
    var moi = CTX.moi();
    if (!moi) return Promise.resolve(false);
    if (['vu', 'traite', 'ecarte'].indexOf(etat) < 0) return Promise.resolve(false);

    var ligne = {
      fait: f && f.quoi ? f.quoi : cleDe(f || {}),
      cible: (f && f.cible) || '',
      qui: moi,
      etat: etat,
      jusqu_au: null,
      maj: new Date().toISOString()
    };
    if (etat === 'ecarte') {
      var j = Number(jours);
      if (!isFinite(j) || j <= 0) j = 7;
      ligne.jusqu_au = new Date(Date.now() + j * 86400000).toISOString();
    }
    return CTX.sb.upsert('maya_suivi', ligne)
      .then(function () {
        // On tient la memoire locale a jour sans relire : la carte se
        // referme dans la seconde, et une relecture reseau ferait
        // reapparaitre ce qu'on vient d'ecarter.
        if (!MEM.lignes) MEM.lignes = {};
        MEM.lignes[ligne.fait + ' ' + ligne.cible] = ligne;
        DERNIERE.quand = 0;   // la prochaine collecte refiltre
        return true;
      })
      .catch(function () { return false; });
  }


  /* ==================================================================
     QUAND ELLE PARLE, ET QUAND ELLE SE TAIT
     ------------------------------------------------------------------
     Ce qui tue une assistante, ce n'est pas d'en savoir trop peu : c'est
     de parler trop. Une carte de trop et l'on ferme la suivante sans la
     lire ; trois de trop et l'on n'ouvre plus l'ecran.

     TROIS NIVEAUX, ET LE MILIEU PAR DEFAUT.
       discrete    elle ne vient jamais d'elle-meme. La cloche suffit.
       mesuree     l'urgent et l'important, au plus une fois par quart
                   d'heure.
       attentive   tout sauf l'information, une fois par cinq minutes.

     « info » NE DECLENCHE RIEN, A AUCUN NIVEAU. « Aucune actualite
     depuis trois semaines » est vrai, utile dans une liste, et ne
     justifie pas d'interrompre quelqu'un.

     RIEN PENDANT QU'ON ECRIT. L'hote sait si un formulaire est en cours
     (l'administration a son propre indicateur) et le dit par occupe().
     Une carte qui s'ouvre pendant une saisie fait perdre le fil, et
     parfois le travail.

     LE NIVEAU VIT SUR L'APPAREIL, pas en base : ce qui convient un jour
     de match ne convient pas un mardi soir, et c'est un reglage
     personnel, pas une decision du club.
     ================================================================== */
  var NIVEAUX_PAROLE = {
    discrete:  { montre: [],                        minutes: 0 },
    mesuree:   { montre: ['urgent','important'],    minutes: 15 },
    attentive: { montre: ['urgent','important','attention'], minutes: 5 }
  };
  var CLE_NIVEAU = 'bbc_maya_niveau';
  var PAROLE = { dernier: 0 };

  function niveau(v) {
    if (v !== undefined) {
      if (!NIVEAUX_PAROLE[v]) return niveau();
      try { localStorage.setItem(CLE_NIVEAU, v); } catch (e) {}
      return v;
    }
    var lu = null;
    try { lu = localStorage.getItem(CLE_NIVEAU); } catch (e) {}
    return NIVEAUX_PAROLE[lu] ? lu : 'mesuree';
  }

  function peutParler(f) {
    var r = NIVEAUX_PAROLE[niveau()];
    if (!r.minutes) return false;
    if (f && r.montre.indexOf(f.niveau) < 0) return false;
    if (Date.now() - PAROLE.dernier < r.minutes * 60000) return false;
    if (CTX && typeof CTX.occupe === 'function') {
      try { if (CTX.occupe()) return false; } catch (e) {}
    }
    return true;
  }


  /* ==================================================================
     CE QUI VIENT D'ARRIVER
     ------------------------------------------------------------------
     La collecte tournait deja toutes les cinq minutes, et ne servait
     qu'a changer un chiffre en silence. Comparer deux collectes suffit a
     savoir ce qui est APPARU -- et c'est precisement pour cela que les
     cles sont stables : sans elles, « 4 inscriptions » serait un fait
     neuf tous les matins.

     LA PREMIERE COLLECTE N'ANNONCE RIEN. Elle est la reference. Sans
     cette regle, ouvrir l'administration ferait defiler huit cartes
     d'affilee -- soit exactement ce qu'on cherche a eviter.

     RIEN NE SE PERD, RIEN NE S'ENTASSE. Un fait neuf arrive pendant une
     periode de silence attend son tour dans FILE ; il sort des que le
     budget le permet, un seul a la fois. Et s'il cesse d'etre vrai
     entre-temps, il sort de la file sans avoir ete dit : c'est le
     comportement voulu, on ne previent pas d'un probleme deja regle.
     ================================================================== */
  var FILE = [];
  var ABONNES = [];

  function surNouveaux(fn) {
    if (typeof fn === 'function') ABONNES.push(fn);
  }

  function annoncer() {
    if (!FILE.length) return;
    if (!peutParler(FILE[0])) return;
    var f = FILE.shift();
    PAROLE.dernier = Date.now();
    ABONNES.forEach(function (fn) { try { fn(f, FILE.length); } catch (e) {} });
  }

  /* Appelable de l'exterieur : apres avoir ferme une carte, l'hote peut
     redemander la parole sans attendre la collecte suivante. */
  function relancer() { annoncer(); }


  /* ==================================================================
     LA COLLECTE
     ------------------------------------------------------------------
     Toutes les sources, en parallele, puis le filtre des permissions,
     puis la memoire, puis le tri. Deux minutes de fraicheur : passer
     d'un ecran a l'autre ne doit pas relancer neuf requetes -- c'est ce
     que faisait deja le centre d'attention, et on ne le change pas.

     UN SEUL APPEL A LA FOIS. Ouvrir la cloche pendant que le tableau de
     bord charge lancait deux collectes ; la seconde ecrasait la
     premiere, et les deux affichages pouvaient differer d'un fait.
     ================================================================== */

  var FRAIS = 120000;

  function collecte(opt) {
    opt = opt || {};
    if (!opt.force && DERNIERE.faits && (Date.now() - DERNIERE.quand) < FRAIS)
      return Promise.resolve(DERNIERE.faits);
    if (enCours) return enCours;

    var noms = Object.keys(SOURCES);
    var echecs = [];

    enCours = Promise.all(noms.map(function (nom) {
      var v;
      try { v = SOURCES[nom](); }
      catch (e) { echecs.push(nom); return []; }
      return Promise.resolve(v).catch(function () { echecs.push(nom); return []; });
    })).then(function (listes) {
      return memLire(opt.force).then(function (mem) {
        var faits = [];
        listes.forEach(function (liste, i) {
          (liste || []).forEach(function (brut) {
            var f = normaliser(brut, noms[i]);
            if (!f) return;
            if (!autorise(f)) return;
            var l = memSort(mem, f);
            if (endormi(l)) return;
            f.etat = l ? l.etat : null;
            f.etatDepuis = l ? l.maj : null;
            faits.push(f);
          });
        });
        faits.sort(function (a, b) { return NIVEAUX[a.niveau] - NIVEAUX[b.niveau]; });

        // CE QUI EST APPARU DEPUIS LA DERNIERE FOIS.
        // « premiere » est vrai au tout premier passage : elle sert de
        // reference et n'annonce rien. Rouvrir l'administration ne doit
        // pas derouler huit cartes.
        var premiere = DERNIERE.faits == null;
        var avant = {};
        (DERNIERE.faits || []).forEach(function (x) { avant[x.quoi + ' ' + x.cible] = 1; });
        faits.forEach(function (f) {
          f.neuf = !premiere && !avant[f.quoi + ' ' + f.cible];
          // Jamais vu : absent de la memoire. Survit au rechargement, la
          // ou « neuf » ne vit que le temps de la session. C'est ce qui
          // permettra de dire, a l'arrivee, ce qui est arrive en votre
          // absence.
          f.jamaisVu = !memSort(mem, f);
        });

        // La file ne garde que ce qui est encore vrai : un fait regle
        // entre-temps en sort sans avoir ete annonce, et c'est voulu.
        var vivants = {};
        faits.forEach(function (f) { vivants[f.quoi + ' ' + f.cible] = f; });
        FILE = FILE.filter(function (f) { return !!vivants[f.quoi + ' ' + f.cible]; })
                   .map(function (f) { return vivants[f.quoi + ' ' + f.cible]; });
        var enFile = {};
        FILE.forEach(function (f) { enFile[f.quoi + ' ' + f.cible] = 1; });
        faits.forEach(function (f) {
          if (f.neuf && !enFile[f.quoi + ' ' + f.cible]) FILE.push(f);
        });
        FILE.sort(function (a, b) { return NIVEAUX[a.niveau] - NIVEAUX[b.niveau]; });

        DERNIERE = { faits: faits, quand: Date.now(), echecs: echecs, sources: noms.length };
        enCours = null;
        annoncer();
        return faits;
      });
    }).catch(function () {
      enCours = null;
      // On ne cache pas l'echec derriere une liste vide : DERNIERE garde
      // ce qu'il avait, et etat() dira que la collecte n'a pas abouti.
      DERNIERE.echecs = noms.slice();
      return DERNIERE.faits || [];
    });

    return enCours;
  }

  /* Ce que la derniere collecte a vraiment donne. L'affichage s'en sert
     pour ne pas ecrire « rien a signaler » quand la verite est « je n'ai
     pas pu lire ». */
  function etat() {
    return {
      faits: DERNIERE.faits ? DERNIERE.faits.length : 0,
      quand: DERNIERE.quand,
      sources: DERNIERE.sources,
      echecs: DERNIERE.echecs.slice(),
      complet: DERNIERE.faits != null && DERNIERE.echecs.length === 0
    };
  }

  /* Vider le cache sans relancer : apres une ecriture, ce qui etait vrai
     il y a dix secondes ne l'est peut-etre plus. */
  function perimer() { DERNIERE.quand = 0; }


  /* ==================================================================
     LIRE LES PERSONNES
     ------------------------------------------------------------------
     La vue personnes reunit joueuses et staff. Elle est posee ici, et
     non dans une source, parce que plusieurs regles en auront besoin et
     qu'elles ne doivent pas la relire chacune de leur cote.

     Elle n'est PAS appelee par le noyau lui-meme : c'est un service
     offert aux sources. Le noyau ne lit rien tout seul, sauf sa memoire.
     ================================================================== */
  var PERS = { rows: null, quand: 0 };

  function personnes(force) {
    if (!CTX || !CTX.sb) return Promise.resolve([]);
    if (!force && PERS.rows && (Date.now() - PERS.quand) < FRAIS)
      return Promise.resolve(PERS.rows);
    return CTX.sb.get('personnes?select=*&order=genre.asc,nom.asc')
      .then(function (rows) {
        PERS.rows = rows || []; PERS.quand = Date.now();
        return PERS.rows;
      })
      .catch(function () { return PERS.rows || []; });
  }


  /* ==================================================================
     LE MONTAGE
     ------------------------------------------------------------------
     MAYA ne va pas chercher ses acces : on les lui donne. Meme patron
     que le Greffe, et pour les memes deux raisons. D'abord elle ne
     connait ni l'adresse du projet ni la facon dont l'hote signe ses
     requetes -- c'est a lui de le savoir. Ensuite c'est ce qui rend le
     banc d'essai possible : on lui passe une base en memoire, et elle ne
     voit pas la difference.

       sb.get(chemin)                 -> Promise<lignes>
       sb.upsert(table, ligne)        -> Promise
       can(module, action)            -> booleen
       moi()                          -> l'uuid du compte connecte
     ================================================================== */
  function mount(ctx) {
    CTX = ctx || null;
    MEM = { lignes: null, quand: 0 };
    PERS = { rows: null, quand: 0 };
    DERNIERE = { faits: null, quand: 0, echecs: [], sources: 0 };
    FILE = [];
    PAROLE.dernier = 0;
    return api;
  }

  var api = {
    mount: mount,
    source: source,
    oublierSource: oublierSource,
    collecte: collecte,
    etat: etat,
    perimer: perimer,
    marquer: marquer,
    personnes: personnes,
    surNouveaux: surNouveaux,
    relancer: relancer,
    peutParler: peutParler,
    niveau: niveau,
    enAttente: function () { return FILE.slice(); },
    // Exposes pour le banc d'essai, et pour les regles qui veulent poser
    // un « quoi » coherent avec celui que MAYA deriverait.
    cleDe: cleDe,
    normaliser: normaliser,
    NIVEAUX: NIVEAUX
  };

  window.BaobabsMaya = api;
})();
