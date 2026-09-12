/* =====================================================================
   MODÈLE : FICHE JOUEUSE
   ---------------------------------------------------------------------
   Le dossier d'une joueuse, sur une feuille : sa photo, son identité,
   ses parents, ce que le club sait de sa santé, ses autorisations, et
   les observations du coach. Des lignes à compléter, des cases, une
   photo à gauche. En série depuis la liste de l'équipe, une fiche par
   joueuse.

   AUCUN CADRATIN.
   ===================================================================== */
(function (G) {
  'use strict';
  var U = G.util;

  G.modeles['fiche-joueuse'] = {
    cle: 'fiche-joueuse',
    nom: "Fiche joueuse",
    famille: "Vie sportive",
    prefixe: "",
    resume: "Photo, identité, parents, santé, autorisations, observations du coach.",

    sections: [
      { titre: "La joueuse", ouvert: true, champs: [
        { cle: 'photo',     lab: "Photo", type: 'image' },
        { cle: 'nom',       lab: "Nom", type: 'texte', duo: true },
        { cle: 'prenom',    lab: "Prénom(s)", type: 'texte', duo: true },
        { cle: 'naissance', lab: "Née le", type: 'texte', duo: true },
        { cle: 'lieuNaissance', lab: "À", type: 'texte', duo: true },
        { cle: 'categorie', lab: "Catégorie", type: 'choix', duo: true, choix: ['U10', 'U12', 'U14', 'U16', 'U18', 'Senior'] },
        { cle: 'poste',     lab: "Poste", type: 'choix', duo: true, choix: ['', 'Meneuse', 'Arrière', 'Ailière', 'Ailière forte', 'Pivot'] },
        { cle: 'taille',    lab: "Taille (cm)", type: 'texte', duo: true },
        { cle: 'maillot',   lab: "N° de maillot", type: 'texte', duo: true },
        { cle: 'licence',   lab: "N° de licence", type: 'texte', duo: true },
        { cle: 'ecole',     lab: "École", type: 'texte', duo: true },
        { cle: 'adresse',   lab: "Adresse", type: 'texte' },
        { cle: 'saison',    lab: "Saison", type: 'texte', duo: true },
        { cle: 'dateActe',  lab: "Fiche établie le", type: 'date', duo: true }
      ]},
      { titre: "Les parents", ouvert: true, champs: [
        { cle: 'parent1',    lab: "Parent ou tuteur", type: 'texte', duo: true },
        { cle: 'tel1',       lab: "Téléphone", type: 'texte', duo: true },
        { cle: 'parent2',    lab: "Second parent", type: 'texte', duo: true },
        { cle: 'tel2',       lab: "Téléphone", type: 'texte', duo: true },
        { cle: 'email',      lab: "E-mail", type: 'texte', duo: true },
        { cle: 'urgence',    lab: "En cas d'urgence", type: 'texte', duo: true }
      ]},
      { titre: "La santé", ouvert: false, champs: [
        { cle: 'groupeSanguin', lab: "Groupe sanguin", type: 'texte', duo: true },
        { cle: 'medecin',       lab: "Médecin traitant", type: 'texte', duo: true },
        { cle: 'allergies',     lab: "Allergies, traitements", type: 'zone' },
        { cle: 'certificat',    lab: "Certificat médical reçu", type: 'bascule' },
        { cle: 'assurance',     lab: "Assurance à jour", type: 'bascule' },
        { cle: 'autorisation',  lab: "Autorisation parentale reçue", type: 'bascule' },
        { cle: 'cotisation',    lab: "Cotisation réglée", type: 'bascule' }
      ]},
      { titre: "Le coach", ouvert: false, champs: [
        { cle: 'coach',        lab: "Coach", type: 'texte' },
        { cle: 'observations', lab: "Observations", type: 'zone' }
      ]}
    ],

    defauts: function () {
      var an = new Date().getFullYear();
      return {
        titre: "Fiche joueuse", dateActe: U.isoDuJour(), lieu: "Dakar", saison: an + "-" + (an + 1),
        photo: "", nom: "", prenom: "", naissance: "", lieuNaissance: "", categorie: "U14", poste: "", taille: "", maillot: "", licence: "", ecole: "", adresse: "",
        parent1: "", tel1: "", parent2: "", tel2: "", email: "", urgence: "",
        groupeSanguin: "", medecin: "", allergies: "", certificat: false, assurance: false, autorisation: false, cotisation: false,
        coach: "", observations: "",
        avecSignature: false, avecCachet: false,
        styles: { b1: { theme: 'vert' } },
        tables: {}
      };
    },

    controles: function (d) {
      var c = [];
      if (!String(d.nom || '').trim() && !String(d.prenom || '').trim()) c.push({ n: 'avert', t: 'Fiche sans nom : à remplir au stylo' });
      if (!d.certificat) c.push({ n: 'avert', t: 'Certificat médical non reçu' });
      return c;
    },

    page: [
      { b: 'entete', drapeau: false, droite: function (d) { return ["Saison " + (d.saison || ''), "Fiche établie le " + U.dateLongue(d.dateActe, false)]; } },
      { b: 'bandeau', ton: 'vert', etiquette: "Fiche joueuse", texte: function (d) { return [d.prenom, d.nom].filter(Boolean).join(' ') || "Nom et prénom(s)"; },
        sous: function (d) { return [d.categorie, d.poste, d.maillot ? "N° " + d.maillot : ''].filter(Boolean).join(" · "); },
        droite: function (d) { return [d.licence ? "Licence " + d.licence : "", d.taille ? d.taille + " cm" : ""]; } },
      { b: 'image', si: function (d) { return !!d.photo; }, src: '@photo', largeur: 32, calage: 'gauche', legende: '' },
      { b: 'grille', colonnes: 2, champs: [
          { label: "Née le", chemin: 'naissance' }, { label: "À", chemin: 'lieuNaissance' },
          { label: "École", chemin: 'ecole' }, { label: "N° de licence", chemin: 'licence' },
          { label: "Adresse", chemin: 'adresse', large: true } ] },
      { b: 'texte', etiquette: "Les parents", texte: '' },
      { b: 'grille', colonnes: 2, champs: [
          { label: "Parent ou tuteur", chemin: 'parent1' }, { label: "Téléphone", chemin: 'tel1' },
          { label: "Second parent", chemin: 'parent2' }, { label: "Téléphone", chemin: 'tel2' },
          { label: "E-mail", chemin: 'email' }, { label: "En cas d'urgence", chemin: 'urgence' } ] },
      { b: 'texte', etiquette: "La santé", texte: '' },
      { b: 'grille', colonnes: 2, champs: [
          { label: "Groupe sanguin", chemin: 'groupeSanguin' }, { label: "Médecin traitant", chemin: 'medecin' },
          { label: "Allergies, traitements", chemin: 'allergies', large: true } ] },
      { b: 'cases', etiquette: "Le dossier", enLigne: true, cases: [
          { texte: "Certificat médical", chemin: 'certificat' }, { texte: "Assurance", chemin: 'assurance' },
          { texte: "Autorisation parentale", chemin: 'autorisation' }, { texte: "Cotisation", chemin: 'cotisation' } ] },
      { b: 'texte', etiquette: "Observations du coach", titre: '@coach', texte: '@observations' },
      { b: 'signatureLibre', boites: [{ label: "Signature du parent", mention: "Atteste l'exactitude des informations" }, { label: "Visa du club", mention: "" }] }
    ],

    pied: function (d) { return ["Baobabs Basket Club · Sicap Baobab, Dakar, Sénégal · document confidentiel", "Fiche joueuse · " + [d.prenom, d.nom].filter(Boolean).join(' ')]; },
    fichier: function (d) { return "Fiche joueuse - " + ([d.prenom, d.nom].filter(Boolean).join(' ') || 'sans nom') + " - BAOBABS BASKET CLUB"; }
  };
})(window.BaobabsGreffe);
