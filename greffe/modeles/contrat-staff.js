/* =====================================================================
   MODÈLE : CONTRAT D'ENTRAÎNEUR OU DE STAFF
   ---------------------------------------------------------------------
   Le club d'un côté, un entraîneur, un préparateur, un kiné ou un
   intendant de l'autre. Un coach n'avait aucun papier : ses missions,
   sa durée, ce qu'il reçoit et ce qu'il doit tenaient dans une
   conversation. Le régime décide de l'article financier : bénévole,
   défrayé (frais remboursés sur justificatifs) ou rémunéré (indemnité
   mensuelle). Neuf articles pré-écrits, modifiables, deux signatures.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  function v(x, repli) { return String(x || '').trim() || repli; }
  function fem(d) { return /^Madame/i.test(String(d.genre || '')); }
  function lEncadrant(d) { return fem(d) ? "l'Encadrante" : "l'Encadrant"; }
  function LEncadrant(d) { return fem(d) ? "L'Encadrante" : "L'Encadrant"; }
  function elle(d) { return fem(d) ? "elle" : "il"; }
  function ee(d) { return fem(d) ? "e" : ""; }
  function regime(d) { return String(d.regime || 'Bénévole'); }

  function articlesParDefaut(d) {
    var E = lEncadrant(d), Em = LEncadrant(d), il = elle(d), e = ee(d);
    var duAu = U.duAu(d.du, d.au);
    var fin;
    if (regime(d) === 'Rémunéré') {
      fin = Em + " perçoit une indemnité de **" + v(d.montant, "à convenir") + "** par mois, versée "
          + v(d.periodePaie, "le 5 de chaque mois") + ", pour la période " + v(d.periodeActivite, "de la saison sportive") + "."
          + (v(d.primes, "") ? "\n\n**Primes :** " + d.primes.trim() + "." : "")
          + (v(d.prisesEnCharge, "") ? "\n\n**Prises en charge :** " + d.prisesEnCharge.trim() + "." : "")
          + "\n\nAucune autre somme n'est due en dehors de ce qui est écrit ici.";
    } else if (regime(d) === 'Défrayé') {
      fin = Em + " n'est pas rémunéré" + e + ". Le Club lui rembourse les frais engagés pour ses missions "
          + "(transport, repas en déplacement, petit matériel) sur présentation d'une note de frais avec "
          + "justificatifs, dans la limite de **" + v(d.montant, "à convenir") + "** par mois."
          + (v(d.prisesEnCharge, "") ? "\n\n**Prises en charge :** " + d.prisesEnCharge.trim() + "." : "");
    } else {
      fin = Em + " intervient à titre bénévole. Aucune rémunération n'est due. Le Club peut rembourser, "
          + "sur justificatifs et par note de frais, les frais engagés à sa demande."
          + (v(d.prisesEnCharge, "") ? "\n\n**Prises en charge :** " + d.prisesEnCharge.trim() + "." : "");
    }
    return [
      { titre: "Objet",
        texte: "Baobabs Basket Club confie à " + E + " la fonction de **" + v(d.fonction, "Entraîneur") + "**"
             + (v(d.equipe, "") ? " auprès de **" + d.equipe.trim() + "**" : "") + ".\n\n"
             + "Le présent contrat fixe les missions, la durée, le régime et les obligations de chacun." },
      { titre: "Missions",
        texte: v(d.missions, "- Préparer et diriger les entraînements\n- Encadrer l'équipe en match et en tournoi\n- Suivre la progression de chaque joueuse\n- Rendre compte au bureau") },
      { titre: "Durée et période d'essai",
        texte: "Le contrat est conclu pour **" + v(d.duree, "une saison sportive") + "**" + (duAu ? ", " + duAu : "") + ".\n\n"
             + "Les " + v(d.essai, "trente (30) premiers jours") + " constituent une période d'essai, pendant laquelle chacune des "
             + "parties peut y mettre fin par écrit, sans indemnité.\n\n"
             + "Le contrat ne se renouvelle pas tacitement : sa poursuite fait l'objet d'un nouvel écrit." },
      { titre: "Régime et conditions financières", texte: fin },
      { titre: "Présence et disponibilité",
        texte: Em + " assure " + v(d.presence, "les séances prévues au planning de la semaine, les matchs et les tournois de l'équipe") + ".\n\n"
             + "Toute absence est annoncée au plus tôt au bureau, et remplacée quand c'est possible. Les absences "
             + "répétées et non justifiées constituent un manquement." },
      { titre: "Obligations de " + E,
        texte: Em + " s'engage à :\n"
             + "- veiller à la sécurité et à l'intégrité physique et morale des joueuses, mineures comprises ;\n"
             + "- respecter les règlements du Club, de la Fédération Sénégalaise de Basketball et de la FIBA ;\n"
             + "- garder confidentiel ce qui touche à la vie du Club, des joueuses et de leurs familles ;\n"
             + "- ne pas engager le Club, financièrement ou par écrit, sans mandat du bureau ;\n"
             + "- informer le Club de toute sollicitation d'un autre club." },
      { titre: "Engagements du Club",
        texte: "Le Club met à disposition les installations, le matériel et les licences nécessaires, prend "
             + "en charge l'assurance liée à l'activité, et associe " + E + " aux décisions sportives qui "
             + "le concernent. Il lui remet un exemplaire des règlements en vigueur." },
      { titre: "Image et méthodes",
        texte: "Les images prises dans le cadre du Club peuvent être utilisées par le Club pour sa communication. "
             + "Les documents de travail produits pour le Club (plans de séance, fiches, statistiques) lui "
             + "restent acquis à la fin du contrat." },
      { titre: "Rupture",
        texte: "Le contrat prend fin à son terme, d'un commun accord écrit, ou en cas de manquement grave "
             + "de l'une des parties, après un avertissement écrit resté sans effet pendant huit (8) jours.\n\n"
             + "Hors période d'essai, la partie qui souhaite y mettre fin respecte un préavis de "
             + v(d.preavis, "un (1) mois") + "." },
      { titre: "Dispositions finales",
        texte: "Le présent contrat s'exécute conformément au droit applicable au Sénégal. Toute modification "
             + "est convenue par écrit. Fait en " + v(d.exemplaires, "deux") + " exemplaires originaux, "
             + "un pour chaque partie." }
    ];
  }

  G.modeles['contrat-staff'] = {
    cle: 'contrat-staff',
    nom: "Contrat d'entraîneur ou de staff",
    famille: "Conventions et contrats",
    prefixe: "CS",
    resume: "Un coach, un kiné, un intendant : missions, durée, régime (bénévole, défrayé, rémunéré), obligations.",

    sections: [
      { titre: "Le contrat", ouvert: true, champs: [
        { cle: 'numero',      lab: "Numéro", type: 'texte', duo: true },
        { cle: 'dateActe',    lab: "Fait le", type: 'date', duo: true },
        { cle: 'lieu',        lab: "Fait à", type: 'texte', duo: true },
        { cle: 'exemplaires', lab: "Exemplaires originaux", type: 'choix', duo: true, choix: ['deux', 'trois'] },
        { cle: 'duree',       lab: "Durée", type: 'texte', duo: true },
        { cle: 'essai',       lab: "Période d'essai", type: 'texte', duo: true },
        { cle: 'du',          lab: "Du", type: 'date', duo: true },
        { cle: 'au',          lab: "Au", type: 'date', duo: true },
        { cle: 'preavis',     lab: "Préavis", type: 'texte', duo: true }
      ]},
      { titre: "La personne", ouvert: true, champs: [
        { cle: 'genre',     lab: "Civilité", type: 'choix', duo: true, choix: ['Monsieur', 'Madame'] },
        { cle: 'fonction',  lab: "Fonction", type: 'choix', duo: true, choix: ['Entraîneur principal', 'Entraîneur adjoint', 'Préparateur physique', 'Kinésithérapeute', 'Intendant', 'Responsable matériel', 'Autre'] },
        { cle: 'nom',       lab: "Nom et prénom(s)", type: 'texte', aide: "Chaque champ laissé vide devient une ligne en pointillé, à remplir au stylo." },
        { cle: 'equipe',    lab: "Équipe ou groupe", type: 'texte', duo: true, aide: "« Équipe Senior », « École de basket »" },
        { cle: 'naissance', lab: "Date de naissance", type: 'date', duo: true },
        { cle: 'piece',     lab: "Passeport / CNI", type: 'texte', duo: true },
        { cle: 'telephone', lab: "Téléphone", type: 'texte', duo: true },
        { cle: 'diplome',   lab: "Diplôme ou qualification", type: 'texte' }
      ]},
      { titre: "Le régime", ouvert: true, champs: [
        { cle: 'regime',        lab: "Régime", type: 'choix', choix: ['Bénévole', 'Défrayé', 'Rémunéré'] },
        { cle: 'montant',       lab: "Montant par mois (FCFA)", type: 'texte', duo: true, aide: "Indemnité si rémunéré, plafond de remboursement si défrayé." },
        { cle: 'periodePaie',   lab: "Versée", type: 'texte', duo: true, aide: "« le 5 de chaque mois »" },
        { cle: 'periodeActivite', lab: "Pour la période", type: 'texte', aide: "« de septembre à juin »" },
        { cle: 'primes',        lab: "Primes", type: 'texte', aide: "« 50 000 FCFA en cas de montée »" },
        { cle: 'prisesEnCharge', lab: "Prises en charge", type: 'texte', aide: "Transport, tenue, licence, formation…" },
        { cle: 'missions',      lab: "Missions", type: 'zone', aide: "Une par ligne, précédée d'un tiret." },
        { cle: 'presence',      lab: "Présence attendue", type: 'texte' }
      ]},
      { titre: "Les articles", ouvert: false, special: 'articles' },
      { titre: "Les signataires", ouvert: false, champs: [
        { cle: 'signNom',       lab: "Pour le club", type: 'texte', duo: true },
        { cle: 'signQualite',   lab: "Qualité", type: 'texte', duo: true },
        { cle: 'avecSignature', lab: "Apposer la signature du président", type: 'bascule' },
        { cle: 'avecCachet',    lab: "Apposer le cachet", type: 'bascule' }
      ]}
    ],

    defauts: function () {
      return {
        titre: "Contrat d'entraîneur", numero: "", dateActe: U.isoDuJour(), lieu: "Dakar",
        exemplaires: "deux", duree: "une saison sportive", essai: "trente (30) premiers jours", du: "", au: "", preavis: "un (1) mois",
        genre: "Monsieur", fonction: "Entraîneur principal", nom: "", equipe: "Équipe Senior", naissance: "", piece: "", telephone: "", diplome: "",
        regime: "Bénévole", montant: "", periodePaie: "le 5 de chaque mois", periodeActivite: "de septembre à juin", primes: "", prisesEnCharge: "",
        missions: "- Préparer et diriger les entraînements\n- Encadrer l'équipe en match et en tournoi\n- Suivre la progression de chaque joueuse\n- Rendre compte au bureau",
        presence: "les séances prévues au planning de la semaine, les matchs et les tournois de l'équipe",
        signNom: "Antoine Jean Pierre Ndong", signQualite: "Président",
        avecSignature: true, avecCachet: true, articles: null, tables: {}
      };
    },
    articlesParDefaut: articlesParDefaut,

    controles: function (d) {
      var c = [];
      if (!String(d.nom || '').trim()) c.push({ n: 'avert', t: 'Identité vide : à compléter au stylo, en pointillé' });
      if (regime(d) !== 'Bénévole' && !String(d.montant || '').trim()) c.push({ n: 'erreur', t: 'Régime ' + regime(d).toLowerCase() + ' sans montant' });
      if (!U.dateDe(d.du) || !U.dateDe(d.au)) c.push({ n: 'avert', t: 'Dates du contrat non renseignées (article 3)' });
      return c;
    },

    page: [
      { b: 'entete', drapeau: false, devise: function (d) { return "Section Basketball · " + v(d.fonction, "Staff") + " · Dakar"; },
        droite: function (d) { return [d.numero ? "Contrat n° " + d.numero : "Contrat", v(d.regime, "Bénévole") + " · " + v(d.duree, "à convenir")]; } },
      { b: 'parties', parties: function (d) {
          var champs = v(d.nom, "") ? [] : [{ label: fem(d) ? "Madame" : "Monsieur", valeur: "", large: true }];
          champs.push({ label: fem(d) ? "Née le" : "Né le", valeur: U.dateLongue(d.naissance, false) }, { label: "Passeport / CNI", valeur: d.piece },
                      { label: "Téléphone", valeur: d.telephone }, { label: "Qualification", valeur: d.diplome, large: true });
          return [{ label: "Le Club", nom: "Baobabs Basket Club", texte: "Représenté par son Président, Monsieur " + v(d.signNom, "Antoine Jean Pierre Ndong") + ".", tag: "Ci-après dénommé « le Club »" },
                  { label: LEncadrant(d), nom: '@nom', champs: champs, tag: "Ci-après dénommé" + ee(d) + " « " + lEncadrant(d) + " »" }];
        } },
      { b: 'titre', etiquette: function (d) { return "Baobabs Basket Club · " + v(d.fonction, "Staff"); }, pastille: function (d) { return d.numero ? "N° " + d.numero : ""; },
        texte: '@titre', sous: "Le présent contrat fixe les missions, la durée, le régime et les obligations du Club et de la personne engagée." },
      { b: 'phrase', texte: "Il est convenu ce qui suit :" },
      { b: 'articles', articles: function (d) { return (d.articles && d.articles.length) ? d.articles : articlesParDefaut(d); } },
      { b: 'signatures',
        gauche: function (d) { return { lieuDate: "Fait à " + U.ech(d.lieu) + ", le <b>" + U.dateLongue(d.dateActe, true) + "</b>", note: "En " + U.ech(v(d.exemplaires, "deux")) + " exemplaires originaux. Chaque page est paraphée par les deux parties.", reference: d.numero ? 'BBC / CS / ' + String(d.numero).replace('/', ' / ') : '' }; },
        cartes: function (d) {
          return [{ pour: "Pour Baobabs Basket Club", nom: '@signNom', qualite: '@signQualite', mention: "Signature et cachet du Président" },
                  { pour: LEncadrant(d), nom: v(d.nom, "Nom et prénom(s) :"), qualite: v(d.fonction, ""), mention: "Lu et approuvé · Signature", signer: false, cacheter: false }];
        } }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · Récépissé n° 8280", "Contrat" + (d.numero ? " n° " + d.numero : '') + (d.nom ? " · " + d.nom : '')]; },
    fichier: function (d) { return "Contrat staff" + (d.numero ? " N" + String(d.numero).replace(/\//g, '-') : '') + (d.nom ? " - " + d.nom : '') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
