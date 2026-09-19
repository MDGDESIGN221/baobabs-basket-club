/* ======================================================================
   MAYA — DEVINER CE QU'ON EST EN TRAIN DE TAPER
   ----------------------------------------------------------------------
   « Quand on tape, elle devine et propose ce qu'on veut, un peu comme
   Google. »

   POURQUOI CE N'EST PAS UN CONFORT. MAYA sait repondre sur cinquante
   ecrans, vingt et une personnes, sept sujets comptes et douze criteres
   combinables. Rien de tout cela ne se voit. Quelqu'un qui ouvre le
   panneau pour la premiere fois ne peut que deviner ce qu'il a le droit
   de demander -- et la seule facon de decouvrir ses limites est de se
   cogner dedans, une question a la fois. La liste qui s'ouvre sous le
   champ est donc le SOMMAIRE de ce qu'elle sait ; c'est ce qui rend le
   reste utilisable par quelqu'un qui n'etait pas la quand on l'a ecrit.

   ET ELLE NE PROPOSE QUE CE QU'ELLE SAIT FAIRE. Chaque proposition est
   une phrase qu'elle comprend vraiment ; proposer une question a
   laquelle elle repondrait « je ne comprends pas » serait pire que de ne
   rien proposer du tout.

   AUCUN DOM ICI. Ce fichier ne fait que classer des phrases : c'est
   dialogue.js qui les affiche. Le banc peut donc mesurer les
   propositions sans navigateur, comme pour la comprehension.
   ====================================================================== */
(function () {
  'use strict';

  var M = (window.BaobabsMaya = window.BaobabsMaya || {});

  /* La meme normalisation que comprendre.js, recopiee et non importee :
     deviner.js doit pouvoir se charger seul, et ces trois lignes ne
     divergeront pas -- si elles divergeaient, le banc le dirait. */
  function sansAccent(s) {
    s = String(s == null ? '' : s).toLowerCase();
    return s.normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s;
  }
  function plat(s) {
    return sansAccent(s).replace(/['’]/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /* « Combien de abonnes » : l'elision manquait, et cela se voyait a
     chaque frappe. Le h muet des mots du club (heure, historique) suit
     la meme regle que les voyelles. */
  function de(mot) {
    return /^[aeiouyhéèêàâîïôöûü]/i.test(String(mot || '')) ? 'd’' : 'de ';
  }

  /* ------------------------------------------------------------------
     LES QUESTIONS TOUTES FAITES
     ------------------------------------------------------------------
     Ce sont les tournures qui marchent, rangees par ce qu'elles
     apportent. Elles ne dependent d'aucune donnee : ce sont celles qu'on
     peut poser n'importe quel jour.
     ------------------------------------------------------------------ */
  var MODELES = [
    { t: 'fais-moi le point',                          q: 'Ce qui demande une décision aujourd’hui' },
    { t: 'qu’est-ce qui me concerne ici',              q: 'Sur l’écran ouvert' },
    { t: 'que sais-tu faire',                          q: 'Tout ce que je sais faire' },
    { t: 'c’est quand le prochain match',              q: 'Date, lieu, heure, convoquées' },
    { t: 'quel est le dernier résultat',               q: 'Score et adversaire' },
    { t: 'prépare la convocation',                     q: 'Pour le prochain match' },
    { t: 'combien de joueuses',                        q: 'L’effectif' },
    { t: 'qui sont les joueuses',                      q: 'La liste, avec les postes' },
    { t: 'combien de membres du staff',                q: 'L’encadrement' },
    { t: 'qui n’a pas encore de licence',              q: 'Les dossiers incomplets' },
    { t: 'qui n’a pas de certificat médical',          q: 'Les pièces qui manquent' },
    { t: 'qui est blessée',                            q: 'Les indisponibles' },
    { t: 'les joueuses sans photo',                    q: 'Ce qui manque sur le site' },
    { t: 'les joueuses sans compte',                   q: 'Qui n’a pas encore d’accès' },
    { t: 'qui n’a pas répondu',                        q: 'À la convocation en cours' },
    { t: 'les dossiers en attente',                    q: 'À vérifier ou à compléter' },
    { t: 'les joueuses actives sans licence',          q: 'Deux critères à la fois' },
    { t: 'combien d’inscriptions à l’école',           q: 'L’école de basket' },
    { t: 'combien de candidatures',                    q: 'Le recrutement' },
    { t: 'combien de commandes',                       q: 'La boutique' }
  ];

  /* ------------------------------------------------------------------
     CE QUE PESE UNE PROPOSITION FACE A CE QU'ON TAPE
     ------------------------------------------------------------------
     Trois facons d'etre pertinent, de la plus sure a la moins sure :
     la phrase COMMENCE par ce qu'on tape, un de ses MOTS commence par
     ce qu'on tape, ou elle le CONTIENT quelque part. On additionne, et
     le debut de phrase gagne toujours -- c'est ce que fait une barre de
     recherche, et c'est ce qu'on attend d'elle.

     UNE FRAPPE VIDE NE VAUT RIEN. Sans ce garde, tout remonte a
     egalite et l'ordre devient celui du hasard.
     ------------------------------------------------------------------ */
  function poids(tape, phrase) {
    var p = plat(phrase);
    if (!tape) return 0;
    if (p.indexOf(tape) === 0) return 100 + (60 - Math.min(p.length, 60));
    var mots = p.split(' ');
    for (var i = 0; i < mots.length; i++) {
      if (mots[i].indexOf(tape) === 0) return 60 - i;
    }
    if (p.indexOf(tape) > 0) return 20;
    return 0;
  }

  /* TOUS LES MOTS COMPTENT, PAS SEULEMENT LE DERNIER. « licence
     joueuse » doit retrouver « les joueuses actives sans licence » :
     on pese chaque mot tape et on additionne, en exigeant que chacun
     ait trouve quelque chose. Une frappe dont un mot ne tombe nulle
     part n'est pas cette phrase-la. */
  function poidsPhrase(tapes, phrase) {
    var total = 0;
    for (var i = 0; i < tapes.length; i++) {
      var p = poids(tapes[i], phrase);
      if (!p) return 0;
      total += p;
    }
    return total;
  }

  /* ------------------------------------------------------------------
     LES PROPOSITIONS
     ------------------------------------------------------------------
     ctx : { personnes, ecrans, sujets }
     rend : [{ texte, genre, sous, id, cle }]  au plus « max »

     TROIS FAMILLES, ET UNE PREFERENCE. Une personne nommee passe devant
     une question toute faite, qui passe devant un ecran : quand on tape
     « mar », on cherche presque toujours quelqu'un. Mais un ecran dont
     le titre commence par la frappe remonte quand meme -- « bill »
     n'est le debut d'aucun nom du club.
     ------------------------------------------------------------------ */
  function propositions(texte, ctx, max) {
    ctx = ctx || {};
    max = max || 8;
    var brut = plat(texte);
    var out = [];

    /* CHAMP VIDE : on montre par quoi commencer. C'est la premiere chose
       que voit quelqu'un qui n'a jamais ouvert ce panneau, et ce sont
       les quatre questions qui servent tous les jours. */
    if (!brut) {
      return MODELES.slice(0, 4).map(function (m) {
        return { texte: m.t, genre: 'question', sous: m.q };
      });
    }

    var tapes = brut.split(' ').filter(function (x) { return x.length >= 2; });
    if (!tapes.length) tapes = [brut];

    (ctx.personnes || []).forEach(function (p) {
      var w = poidsPhrase(tapes, p.nom);
      if (w) out.push({ texte: p.nom, genre: 'personne', id: p.id, sousGenre: p.genre,
                        sous: p.genre === 'staff' ? 'Staff' : 'Joueuse', poids: w + 30 });
    });

    MODELES.forEach(function (m, idx) {
      var w = poidsPhrase(tapes, m.t);
      /* L'ORDRE DE LA LISTE DEPARTAGE. « Licen » remontait « les joueuses
         actives sans licence » avant « qui n'a pas encore de licence »,
         parce que le mot y tombe plus tot. Or la premiere question est la
         plus simple, et c'est celle qu'on veut neuf fois sur dix. La
         liste est ecrite dans l'ordre de ce qui sert le plus ; cet ordre
         doit se voir. */
      if (w) out.push({ texte: m.t, genre: 'question', sous: m.q,
                        poids: w + 10 + (MODELES.length - idx) * 0.5 });
    });

    (ctx.ecrans || []).forEach(function (e) {
      var w = poidsPhrase(tapes, e.titre);
      if (w) out.push({ texte: 'ouvre ' + e.titre, genre: 'ecran', cle: e.cle,
                        sous: 'Écran', poids: w });
    });

    /* ET CE QU'ON PEUT COMPTER, ECRAN PAR ECRAN. C'est ce qui rend les
       cinquante ecrans interrogeables et pas seulement ouvrables :
       « combien de partenaires » n'est ecrit nulle part, il se fabrique
       a partir du nom de ce que l'ecran contient. */
    (ctx.sujets || []).forEach(function (S) {
      (S.mots || []).forEach(function (mot, i) {
        if (i !== 1) return;                     // le pluriel seulement
        var phrase = 'combien ' + de(mot) + mot;
        var w = poidsPhrase(tapes, phrase);
        if (w) out.push({ texte: phrase, genre: 'question', sous: S.nom, poids: w + 5 });
      });
    });

    /* ------------------------------------------------------------------
       CHAQUE FAMILLE A SA PART
       ------------------------------------------------------------------
       « M » remplissait les sept lignes avec sept joueuses : le club en
       compte cinq dont le nom commence par M, et elles passaient devant
       « ouvre Matchs » et « fais-moi le point » qui commencent aussi par
       M. Une liste qui ne montre qu'une famille cache les deux autres, et
       c'est justement au debut d'un mot qu'on hesite encore.

       On plafonne donc chaque famille, puis on reclasse l'ensemble : le
       meilleur reste en tete, mais il ne mange plus toute la place.
       ------------------------------------------------------------------ */
    var PART = { personne: 4, question: 4, ecran: 3 };
    var pris = {};
    var vus = {};
    /* A POIDS EGAL, L'ALPHABET. Trois joueuses commencent par « mar » :
       sans ce second critere, l'ordre est celui de la base, donc celui
       du hasard pour qui regarde la liste. Un ordre stable se retient. */
    out.sort(function (a, b) {
      return (b.poids - a.poids) || String(a.texte).localeCompare(String(b.texte), 'fr');
    });
    return out.filter(function (x) {
      var c = plat(x.texte);
      if (vus[c]) return false;
      var n = pris[x.genre] || 0;
      if (n >= (PART[x.genre] || 3)) return false;
      pris[x.genre] = n + 1;
      vus[c] = 1;
      return true;
    }).slice(0, max);
  }

  M.deviner = { propositions: propositions, MODELES: MODELES, plat: plat };
})();
