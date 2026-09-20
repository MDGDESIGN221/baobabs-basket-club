/* =====================================================================
   LA FABRIQUE DE LA CARTE
   ---------------------------------------------------------------------
     node outils/fabrique-carte.js

   Elle ecrit /maya/carte.js : l'inventaire de la maison, pour que MAYA
   sache de quoi elle parle sans qu'on lui dicte une liste a la main.

   POURQUOI PAS LA BASE ELLE-MEME. Supabase refuse le document OpenAPI
   aux cles publiables : GET /rest/v1/ rend 401 « Secret API key
   required ». Le navigateur ne peut donc pas decouvrir le schema tout
   seul, et une cle secrete n'a rien a faire dans une page publique.
   On lit donc ce que le code DIT de la base -- ce qui a un avantage
   inattendu : on apprend du meme coup QUI se sert de quoi, ce qu'un
   information_schema ne dira jamais.

   TROIS SOURCES, AUCUNE ECRITE A LA MAIN :
     1. les tables    : toutes les chaines passees a sbGet, sbGetAll,
                        sbInsert, sbUpdate, sbUpsert, sbDelete, sbPatchBy
                        dans admin-matchs.html et les autres pages ;
     2. les ecrans    : SECTION_META et SECTION_MODULE du meme fichier ;
     3. les fichiers  : le premier paragraphe du commentaire d'en-tete
                        de chaque fichier du depot. Cette maison
                        s'explique dans ses en-tetes ; on ne fait que
                        les recolter.

   CE QU'ELLE NE MET PAS DEDANS : aucune valeur, aucune donnee, aucun
   secret. Des noms de tables, de colonnes citees, d'ecrans et de
   fichiers. Le depot est public : ce fichier doit pouvoir l'etre aussi.
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const RACINE = path.resolve(__dirname, '..');
const SORTIE = path.join(RACINE, 'maya', 'carte.js');

/* ------------------------------------------------------------------ */
/* Les fichiers qu'on regarde. On ne descend pas dans .git, archives,
   node_modules : archives/ est hors depot, et le reste n'est pas la
   maison. */
const IGNORE = new Set(['.git', 'node_modules', 'archives', '.claude', '.vscode']);
const EXT = new Set(['.html', '.js', '.css', '.sql', '.md', '.json']);

function parcourir(dir, out) {
  out = out || [];
  for (const nom of fs.readdirSync(dir)) {
    if (IGNORE.has(nom) || nom.startsWith('.')) continue;
    const p = path.join(dir, nom);
    const st = fs.statSync(p);
    if (st.isDirectory()) parcourir(p, out);
    else if (EXT.has(path.extname(nom))) out.push(p);
  }
  return out;
}

const fichiers = parcourir(RACINE);

/* ------------------------------------------------------------------
   1. LES TABLES
   Une requete PostgREST s'ecrit « table?select=... » : le nom de la
   table est ce qui precede le premier « ? ». On releve aussi les
   colonnes citees dans le select, parce que c'est ce que les ecrans
   lisent vraiment -- et donc ce dont MAYA peut parler.
   ------------------------------------------------------------------ */
const APPELS = /\bsb(?:Get|GetAll|Insert|Update|Upsert|Delete|PatchBy)\s*\(\s*(['"`])([a-z0-9_]+)(\?[^'"`]*)?\1/g;
const ECRIT = /\bsb(?:Insert|Update|Upsert|Delete|PatchBy)\s*\(\s*(['"`])([a-z0-9_]+)/g;

const tables = new Map();   /* nom -> { lit:Set(fichiers), ecrit:Set, colonnes:Set } */

function table(nom) {
  if (!tables.has(nom)) tables.set(nom, { lit: new Set(), ecrit: new Set(), colonnes: new Set() });
  return tables.get(nom);
}

for (const f of fichiers) {
  if (!/\.(html|js)$/.test(f)) continue;
  const src = fs.readFileSync(f, 'utf8');
  const rel = path.relative(RACINE, f).replace(/\\/g, '/');
  let m;
  APPELS.lastIndex = 0;
  while ((m = APPELS.exec(src))) {
    const t = table(m[2]);
    t.lit.add(rel);
    /* les colonnes du select : « ?select=id,name,status&... » */
    const q = m[3] || '';
    const sel = /[?&]select=([^&'"`]*)/.exec(q);
    if (sel) {
      sel[1].split(',').forEach(function (c) {
        /* « coach:staff(name) » : on garde le nom lu, pas l'alias */
        const brut = c.replace(/^[a-z0-9_]+:/i, '').replace(/\(.*$/, '').trim();
        if (/^[a-z0-9_]+$/.test(brut) && brut !== '*') t.colonnes.add(brut);
      });
    }
  }
  ECRIT.lastIndex = 0;
  while ((m = ECRIT.exec(src))) table(m[2]).ecrit.add(rel);
}

/* ------------------------------------------------------------------
   2. LES ECRANS ET LEUR MODULE DE DROITS
   ------------------------------------------------------------------ */
const admin = fs.readFileSync(path.join(RACINE, 'admin-matchs.html'), 'utf8');

function bloc(nom) {
  const i = admin.indexOf('var ' + nom + ' = {');
  if (i < 0) return '';
  let p = 0, j = admin.indexOf('{', i);
  for (let k = j; k < admin.length; k++) {
    if (admin[k] === '{') p++;
    else if (admin[k] === '}') { p--; if (!p) return admin.slice(j, k + 1); }
  }
  return '';
}

const metaBrut = bloc('SECTION_META');
const moduleBrut = bloc('SECTION_MODULE');

const ecrans = [];
{
  const re = /([a-z0-9_]+)\s*:\s*\{\s*t\s*:\s*'((?:[^'\\]|\\.)*)'/g;
  let m;
  while ((m = re.exec(metaBrut))) ecrans.push({ cle: m[1], titre: m[2].replace(/\\'/g, "'") });
}
const moduleDe = {};
{
  const re = /([a-z0-9_]+)\s*:\s*'([a-z0-9_]+)'/g;
  let m;
  while ((m = re.exec(moduleBrut))) moduleDe[m[1]] = m[2];
}
ecrans.forEach(function (e) { e.module = moduleDe[e.cle] || null; });

/* ------------------------------------------------------------------
   3. LES FICHIERS ET CE QU'ILS FONT
   Cette maison s'explique dans ses en-tetes : un commentaire de bloc
   en tete de fichier, avec un titre en majuscules et un paragraphe.
   On recolte le titre et la premiere phrase, rien de plus.
   ------------------------------------------------------------------ */
/* CHAQUE LANGAGE A SA FACON DE SE PRESENTER, et cette maison les
   emploie toutes : le bloc etoile du JS et du CSS, le commentaire
   HTML, le double tiret du SQL, le diese du Markdown. Le premier jet
   n'en lisait qu'une et rendait « 110 fichiers sans role » sur 176 :
   un inventaire qui ignore deux tiers de la maison ne sert a rien.
   Un fichier de donnees (.json) n'a pas de commentaire du tout :
   il se decrit par son chemin, et c'est honnete de le dire ainsi. */
function enTete(src, ext) {
  let txt = null;
  if (ext === '.md') {
    const l = src.split(/\r?\n/).filter(function (x) { return x.trim(); });
    return { titre: (l[0] || '').replace(/^#+\s*/, '').slice(0, 90), phrase: (l[1] || '').slice(0, 240) };
  }
  if (ext === '.json') return null;                       /* pas de commentaire possible */
  if (ext === '.sql') {
    const l = src.split(/\r?\n/);
    const tete = [];
    for (const ligne of l) {
      const s = ligne.trim();
      if (!s) { if (tete.length) break; continue; }
      if (s.indexOf('--') !== 0) break;
      tete.push(s.replace(/^--+\s?/, ''));
    }
    txt = tete.join('\n');
  } else {
    /* le JS et le CSS : leur premier commentaire de bloc */
    const m = /\/\*[\s\S]{0,2600}?\*\//.exec(src.slice(0, 3200));
    if (m) txt = m[0];
    /* le HTML : le premier commentaire un peu long, ou qu'il soit dans
       l'en-tete -- il vient apres le doctype, le title et les metas */
    if (!txt) {
      const c = /<!--([\s\S]{80,2600}?)-->/.exec(src.slice(0, 12000));
      if (c) txt = c[1];
    }
    if (!txt) {
      const c2 = src.slice(0, 2000).match(/^(?:\s*\/\/.*\n)+/);
      if (c2) txt = c2[0];
    }
  }
  if (!txt || !txt.trim()) return null;
  const lignes = txt.replace(/\/\*+|\*+\/|<!--|-->/g, '')
    .split(/\r?\n/)
    .map(function (l) { return l.replace(/^\s*[*/=-]*\s?/, '').replace(/\s+$/, ''); })
    .filter(function (l) { return l.trim() && !/^[=\-_]{4,}$/.test(l.trim()); });
  if (!lignes.length) return null;
  const titre = lignes[0].trim().slice(0, 90);
  /* la premiere phrase du corps, apres la ligne de titre */
  const corps = lignes.slice(1).join(' ').replace(/\s+/g, ' ').trim();
  const phrase = corps.split(/(?<=[.;:])\s/)[0] || corps;
  return { titre: titre, phrase: phrase.slice(0, 240) };
}

/* LES QUELQUES FICHIERS QUI NE SE PRESENTENT PAS EUX-MEMES.
   La recolte marche pour 165 fichiers sur 177. Elle echoue sur deux
   familles, et il vaut mieux l'ecrire que de laisser MAYA repondre a
   cote avec aplomb :
     - les deux plus gros fichiers de la maison n'ont pas d'en-tete de
       FICHIER ; leur premier commentaire parle d'autre chose (l'icone
       d'onglet pour l'admin, l'echappement d'une adresse pour le site).
       Recolte telle quelle, la carte aurait dit que admin-matchs.html
       sert a poser un favicon -- faux, et dit avec assurance ;
     - un .json ne peut pas porter de commentaire.
   Cette liste est ECRITE A LA MAIN, et c'est la seule du fichier. Elle
   reste courte : si elle grossit, c'est qu'un fichier manque d'en-tete,
   et c'est l'en-tete qu'il faut ecrire, pas cette liste. */
const ROLES = {
  'admin-matchs.html': ['L\'administration du club', 'Les 52 ecrans de gestion, en un seul fichier : effectif, matchs, billetterie, ecole, boutique, comptes, contenu du site. Le Studio, le Greffe et MAYA vivent dehors.'],
  'index.html': ['Le site public', 'La page que voient les visiteurs : accueil, club, competitions, billetterie, inscriptions.'],
  'media/index.json': ['L\'index des medias', 'La liste des fichiers servis depuis /media, ecrite par un outil.'],
  'vercel.json': ['Le reglage de l\'hebergeur', 'Les en-tetes et les redirections que Vercel applique au site.'],
  'tutoriel/banc.html': ['Banc d\'essai du tutoriel', 'Le tutoriel joue seul, hors de l\'administration, pour verifier sa voix et son pointage.'],
  'tutoriel/banc-cadrage.html': ['Banc d\'essai : le cadrage', 'Verifie que le projecteur du tutoriel encadre le bon element.'],
  'tutoriel/banc-projecteur.html': ['Banc d\'essai : le projecteur', 'Verifie la surcouche qui eclaire un element de l\'ecran.'],
  'tutoriel/banc-clic.html': ['Banc d\'essai : les clics', 'Verifie que chaque etape pointe une cible qui existe et repond.'],
  'tutoriel/banc-tempo.html': ['Banc d\'essai : le rythme', 'Verifie les temps d\'attente entre deux etapes.'],
  'tutoriel/banc-filet.html': ['Banc d\'essai : le filet', 'Verifie que le tutoriel n\'ecrit jamais dans la base.'],
  'tutoriel/banc-salles.html': ['Banc d\'essai : les salles', 'Verifie les noms de salles employes par le tutoriel.'],
  'tutoriel/banc-noms.html': ['Banc d\'essai : les noms', 'Verifie que le tutoriel ne recopie aucun texte d\'ecran.'],
  'docs/briefs/BAOBABS-SHOWREEL-prompt.json': ['Brief : le showreel', 'Les consignes de fabrication d\'une video de presentation.'],
  'docs/briefs/BAOBABS-MOTION-brief.json': ['Brief : le motion design', 'Les consignes de fabrication des animations du club.']
};

const inventaire = [];
let repris = 0;
for (const f of fichiers) {
  const rel = path.relative(RACINE, f).replace(/\\/g, '/');
  const src = fs.readFileSync(f, 'utf8');
  const lignes = src.split(/\r?\n/).length;
  let t = enTete(src, path.extname(f));
  if (ROLES[rel]) { t = { titre: ROLES[rel][0], phrase: ROLES[rel][1] }; repris++; }
  inventaire.push({
    f: rel,
    l: lignes,
    o: Math.round(Buffer.byteLength(src, 'utf8') / 1024),
    t: t ? t.titre : '',
    d: t ? t.phrase : ''
  });
}
inventaire.sort(function (a, b) { return b.l - a.l; });

/* ------------------------------------------------------------------
   4. CE QUI NE SE MONTRE JAMAIS
   Une colonne qui porte un telephone, une adresse, une date de
   naissance ou un numero de piece ne se LISTE pas, meme a qui a le
   droit de voir la table : MAYA refuse deja les coordonnees, et la
   voie generique ne doit pas ouvrir une porte derriere.
   ------------------------------------------------------------------ */
const PERSO = /^(phone|tel|telephone|mobile|email|mail|courriel|adresse|address|birth|birthdate|date_naissance|naissance|nin|cni|passeport|passport|numero_piece|piece|iban|rib|mot_de_passe|password|token|secret)/i;

/* ------------------------------------------------------------------
   5. QUEL MODULE GOUVERNE QUELLE TABLE
   ------------------------------------------------------------------
   CECI NE SE DEVINE PAS. Le premier jet le deduisait du nom (une table
   qui commence comme un ecran heritait de son module) : 22 tables sur
   68 rattachees, et « players », « match_center », « admin_users »
   parmi les oubliees. Une assistante qui compte une table sans savoir
   quelle casquette la gouverne, c'est une fuite de droits.

   La correspondance est donc ECRITE, et le bilan crie des qu'une table
   nouvelle n'y figure pas : une table sans module ne se comptera JAMAIS,
   sauf pour le compte proprietaire. Les onze modules sont ceux de
   SECTION_MODULE : analytics, billetterie, boutique, caisse, contenu,
   effectif, historique, inscriptions, matchs, recrutement, reglages.

   « null » n'est pas un oubli quand il est ecrit ici : il veut dire
   « aucune casquette ordinaire ne doit lire ceci ».
   ------------------------------------------------------------------ */
const TABLE_MODULE = {
  /* l'effectif et les personnes */
  players: 'effectif', effectif_admin: 'effectif', staff: 'effectif',
  players_documents: 'effectif', players_contacts: 'effectif',
  player_season_stats: 'effectif', personnes: 'effectif',
  presentation_joueuses: 'effectif', presentation_staff: 'effectif',
  collecte_campagnes: 'effectif', collecte_suivi: 'effectif',
  team_attendance: 'effectif', team_schedule: 'effectif', team_sessions: 'effectif',
  org_roles: 'effectif',

  /* les matchs */
  matches: 'matchs', match_center: 'matchs', match_convocations: 'matchs',
  match_events: 'matchs', match_live: 'matchs', match_stats: 'matchs',
  standings: 'matchs', teams: 'matchs', presentations: 'matchs', saisons: 'matchs',

  /* la billetterie */
  ticket_offers: 'billetterie', reservations: 'billetterie',

  /* la boutique */
  products: 'boutique', produits_admin: 'boutique', orders: 'boutique',
  commandes_admin: 'boutique', customers: 'boutique', clients_admin: 'boutique',
  promo_codes: 'boutique',

  /* l'ecole de basket et les inscriptions */
  academy_registrations: 'inscriptions', inscriptions_admin: 'inscriptions',
  academy_attendance: 'inscriptions', academy_documents: 'inscriptions',
  academy_events: 'inscriptions', academy_payments: 'inscriptions',
  academy_schedule: 'inscriptions', academy_sessions: 'inscriptions',

  /* le recrutement */
  recruitment_requests: 'recrutement', recruitment_documents: 'recrutement',
  recruitment_events: 'recrutement', candidatures_admin: 'recrutement',

  /* la caisse */
  caisse_mouvements: 'caisse', club_recettes_mois: 'caisse',

  /* le contenu du site */
  news: 'contenu', news_categories: 'contenu', articles_admin: 'contenu',
  announcements: 'contenu', banners: 'contenu', evenements: 'contenu',
  gallery: 'contenu', partners: 'contenu', contact_messages: 'contenu',
  newsletter_abonnes: 'contenu', newsletter_sends: 'contenu',
  newsletter_subscribers: 'contenu',

  /* la mesure d'audience */
  club_audience_mois: 'analytics',

  /* les reglages du club */
  site_settings: 'reglages', club_listes: 'reglages', studio_projets: 'reglages',

  /* CE QUE PERSONNE NE LIT PAR MAYA, ET C'EST VOULU.
     Les comptes, les roles et les permissions decident QUI peut quoi :
     les compter par une assistante donnerait un plan de la serrure.
     Les questions posees a MAYA sont sa memoire, pas une donnee du club. */
  admin_users: null, admin_roles: null, role_permissions: null,
  maya_questions: null
};

/* ------------------------------------------------------------------ */
const carte = {
  fait: new Date().toISOString().slice(0, 10),
  tables: Array.from(tables.entries())
    .sort(function (a, b) { return a[0].localeCompare(b[0]); })
    .map(function (e) {
      const nom = e[0], t = e[1];
      const cols = Array.from(t.colonnes).sort();
      /* trois etats, et ils ne veulent pas dire la meme chose :
           'effectif'  une casquette la gouverne ;
           null        ECRIT : personne ne la lit par MAYA ;
           undefined   ABSENTE de la liste : table neuve, on se tait. */
      const connu = Object.prototype.hasOwnProperty.call(TABLE_MODULE, nom);
      return {
        n: nom,
        module: connu ? TABLE_MODULE[nom] : undefined,
        rattachee: connu,
        ecrit: t.ecrit.size > 0,
        ou: Array.from(new Set([].concat(Array.from(t.lit), Array.from(t.ecrit)))).sort(),
        colonnes: cols,
        perso: cols.filter(function (c) { return PERSO.test(c); })
      };
    }),
  ecrans: ecrans,
  fichiers: inventaire
};

const entete = `/* =====================================================================
   LA CARTE DE LA MAISON
   ---------------------------------------------------------------------
   ECRIT PAR UNE MACHINE. Ne pas modifier a la main :
       node outils/fabrique-carte.js
   le refait depuis le depot, et ecrasera toute retouche.

   C'est ce que MAYA sait de la maison SANS rien lire en base : quelles
   tables existent, qui s'en sert, quelles colonnes les ecrans lisent,
   quels ecrans existent et sous quel module de droits, et quel fichier
   fait quoi. Les chiffres, eux, se demandent a la base au moment ou on
   les demande, sous les droits de la session -- jamais d'ici.

   AUCUNE DONNEE DU CLUB ICI. Des noms, des chemins, des tailles. Le
   depot est public ; ce fichier doit pouvoir l'etre.

   Releve du ${carte.fait} : ${carte.tables.length} tables,
   ${carte.ecrans.length} ecrans, ${carte.fichiers.length} fichiers.
   ===================================================================== */
(function () {
  'use strict';
  var G = window.BaobabsMaya;
  if (!G) { if (window.console) console.warn('[MAYA] carte.js sans noyau'); return; }
  G.carte = `;

const js = entete + JSON.stringify(carte, null, 1) + ';\n})();\n';
fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
fs.writeFileSync(SORTIE, js.replace(/\r?\n/g, '\r\n'), 'utf8');

console.log('');
console.log('  maya/carte.js ecrit');
console.log('    tables    ' + carte.tables.length + '  (dont ' + carte.tables.filter(function (t) { return t.ecrit; }).length + ' ecrites)');
console.log('    colonnes  ' + carte.tables.reduce(function (n, t) { return n + t.colonnes.length; }, 0) + '  citees par les ecrans');
console.log('    perso     ' + carte.tables.reduce(function (n, t) { return n + t.perso.length; }, 0) + '  colonnes qui ne se listeront jamais');
console.log('    ecrans    ' + carte.ecrans.length + '  (dont ' + carte.ecrans.filter(function (e) { return e.module; }).length + ' sous un module)');
console.log('    fichiers  ' + carte.fichiers.length + '  ' + Math.round(carte.fichiers.reduce(function (n, f) { return n + f.l; }, 0) / 1000) + ' k lignes');
console.log('    sans role ' + carte.fichiers.filter(function (f) { return !f.t; }).length + '  fichiers sans en-tete');
console.log('    repris    ' + repris + '  fichiers dont le role est ecrit a la main (voir ROLES)');
const orphelines = carte.tables.filter(function (t) { return !t.rattachee; });
const fermees = carte.tables.filter(function (t) { return t.rattachee && t.module === null; });
console.log('    modules   ' + (carte.tables.length - orphelines.length - fermees.length) + ' tables rattachees, '
  + fermees.length + ' fermees a dessein');
if (orphelines.length) {
  console.log('');
  console.log('  ATTENTION : ' + orphelines.length + ' table(s) sans module dans TABLE_MODULE.');
  console.log('  MAYA refusera de les compter. Rattachez-les, ou ecrivez null pour dire');
  console.log('  qu aucune casquette ordinaire ne doit les lire :');
  orphelines.forEach(function (t) { console.log('      ' + t.n + '   (' + t.ou.join(', ') + ')'); });
}
console.log('');
