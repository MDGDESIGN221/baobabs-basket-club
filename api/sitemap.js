/* =====================================================================
   /sitemap.xml : LE PLAN DU SITE, MATCHS ET JOUEUSES COMPRIS
   ---------------------------------------------------------------------
   Le plan du site était un fichier figé qui ne listait qu'une adresse,
   la page d'accueil : le site n'en avait qu'une. Depuis que chaque match
   et chaque joueuse ont la leur (/match/<id>, /joueuse/<id>), le plan se
   génère : il lit les mêmes vues publiques que le site et donne à
   Google une entrée par fiche. Le rewrite de vercel.json envoie
   /sitemap.xml ici.
   ===================================================================== */
'use strict';

var SB_URL = 'https://lmwbwasupqkvswukieav.supabase.co';
var SB_KEY = 'sb_publishable_68RKprorqTmVkzjHrKgdZw_h-AcMXRh';
var ORIGINE = 'https://www.baobabsbasketclub.com';

function sb(q){
  return fetch(SB_URL + '/rest/v1/' + q, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
    .then(function(r){ if (!r.ok) throw new Error('supabase ' + r.status); return r.json(); });
}
function ech(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]; }); }
function jour(d){ var s = d ? String(d).slice(0, 10) : ''; return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }

module.exports = function(req, res){
  var aujourdhui = new Date().toISOString().slice(0, 10);
  Promise.all([
    sb('matches?select=id,match_date&order=match_date.desc&limit=500').catch(function(){ return []; }),
    sb('effectif_site?select=id&order=sort.asc').catch(function(){ return []; })
  ]).then(function(r){
    /* QUE DES ADRESSES REELLES. Les rubriques du site vivent derriere un
       diese (« /#equipes ») : pour Google c'est la page d'accueil, et un
       plan du site qui la repete huit fois ne lui apprend rien. Seules
       l'accueil et les fiches -- qui ont, elles, leur propre adresse --
       sont listees. */
    var urls = [{ loc: ORIGINE + '/', lastmod: aujourdhui, freq: 'daily', prio: '1.0' }];
    (r[0] || []).forEach(function(m){
      /* un match a venir change encore (score, feuille) : sa date de
         derniere modification est aujourd'hui ; un match joue garde sa date */
      var d = jour(m.match_date);
      var ancien = d && (Date.parse(aujourdhui) - Date.parse(d)) > 14 * 86400000;
      urls.push({ loc: ORIGINE + '/match/' + m.id, lastmod: ancien ? d : aujourdhui, freq: ancien ? 'monthly' : 'daily', prio: '0.8' });
    });
    (r[1] || []).forEach(function(p){
      urls.push({ loc: ORIGINE + '/joueuse/' + p.id, lastmod: aujourdhui, freq: 'monthly', prio: '0.6' });
    });
    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls.map(function(u){ return '  <url><loc>' + ech(u.loc) + '</loc><lastmod>' + u.lastmod + '</lastmod><changefreq>' + u.freq + '</changefreq><priority>' + u.prio + '</priority></url>'; }).join('\n') +
      '\n</urlset>\n';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
    res.end(xml);
  }).catch(function(){
    /* la lecture a echoue : le plan minimal part quand meme, plutot
       qu'une erreur 500 dans la console de Google */
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
    res.end('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      '  <url><loc>' + ORIGINE + '/</loc><lastmod>' + aujourdhui + '</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>\n</urlset>\n');
  });
};
