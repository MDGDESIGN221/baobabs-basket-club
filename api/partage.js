/* =====================================================================
   /match/<id> et /joueuse/<id> : LA PAGE QUE LISENT WHATSAPP ET GOOGLE
   ---------------------------------------------------------------------
   Le site est une seule page. Une fiche de match y vit sous
   /#match-<id>, mais un lien qui commence par un dièse ne dit rien aux
   robots : WhatsApp, Facebook et Google lisent la page telle que le
   serveur la rend, sans exécuter le moindre script. Ils verraient donc
   toujours le titre et l'image du club, jamais ceux du match.

   Cette fonction (Vercel, Node) rend index.html en y remplaçant le
   titre, la description, l'image de partage, l'adresse canonique et les
   données structurées par celles du match ou de la joueuse, puis pose
   window.bbRouteInitiale : le site, lui, s'ouvre directement sur la
   fiche. Les rewrites de vercel.json envoient ici /match/:id et
   /joueuse/:id.

   Elle ne lit que ce que le site public lit déjà (la clé publiable, les
   vues ouvertes) : rien de plus n'est exposé.
   ===================================================================== */
'use strict';

var SB_URL = 'https://lmwbwasupqkvswukieav.supabase.co';
var SB_KEY = 'sb_publishable_68RKprorqTmVkzjHrKgdZw_h-AcMXRh';
var ORIGINE = 'https://www.baobabsbasketclub.com';
var IMAGE_DEFAUT = ORIGINE + '/og-banner.png';
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ech(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function absolue(u){
  if (!u) return '';
  u = String(u).trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (u.charAt(0) === '/') return ORIGINE + u;
  return '';
}
function datePleine(d){
  if (!d) return '';
  var dt = new Date(String(d).slice(0, 10) + 'T12:00:00Z');
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
function heure(t){ return t ? String(t).slice(0, 5).replace(':', 'h').replace(/h00$/, 'h') : ''; }

function sb(q){
  return fetch(SB_URL + '/rest/v1/' + q, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
    .then(function(r){ if (!r.ok) throw new Error('supabase ' + r.status); return r.json(); });
}

/* Ce que la page dit d'un match : titre, description, image, schema.org SportsEvent. */
function metaMatch(m){
  var joue = m.score_baobabs != null && m.score_opponent != null;
  var adv = m.opponent_name || 'Adversaire';
  var titre = (m.is_home ? 'Baobabs reçoit ' : 'Baobabs chez ') + adv;
  if (joue) titre += ' : ' + m.score_baobabs + ' - ' + m.score_opponent;
  var morceaux = [];
  if (joue) morceaux.push(m.score_baobabs > m.score_opponent ? 'Victoire des Baobabs' : (m.score_baobabs < m.score_opponent ? 'Défaite des Baobabs' : 'Match nul'));
  if (m.match_date) morceaux.push((joue ? 'le ' : 'Le ') + datePleine(m.match_date) + (m.match_time ? ' à ' + heure(m.match_time) : ''));
  if (m.venue) morceaux.push(m.venue);
  if (m.competition) morceaux.push(m.competition + (m.round_label ? ' · ' + m.round_label : ''));
  var description = morceaux.join(' · ') || 'Un match du Baobabs Basket Club, Dakar.';
  if (description.length > 200) description = description.slice(0, 197) + '…';
  var debut = m.match_date ? String(m.match_date).slice(0, 10) + 'T' + (m.match_time ? String(m.match_time).slice(0, 5) : '18:00') + ':00Z' : null;
  var image = absolue(m.photo_url) || IMAGE_DEFAUT;
  var ld = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: (m.is_home ? 'Baobabs Basket Club vs ' : adv + ' vs ') + (m.is_home ? adv : 'Baobabs Basket Club'),
    url: ORIGINE + '/match/' + m.id,
    image: image,
    sport: 'Basketball',
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    homeTeam: { '@type': 'SportsTeam', name: m.is_home ? 'Baobabs Basket Club' : adv },
    awayTeam: { '@type': 'SportsTeam', name: m.is_home ? adv : 'Baobabs Basket Club' },
    organizer: { '@type': 'SportsOrganization', name: 'Baobabs Basket Club', url: ORIGINE + '/' }
  };
  if (debut) ld.startDate = debut;
  if (m.venue) ld.location = { '@type': 'Place', name: m.venue, address: { '@type': 'PostalAddress', addressLocality: 'Dakar', addressCountry: 'SN' } };
  if (m.competition) ld.superEvent = { '@type': 'SportsEvent', name: m.competition };
  if (m.free_entry) ld.isAccessibleForFree = true;
  if (joue){
    ld.eventStatus = 'https://schema.org/EventScheduled';
    ld.description = description;
  }
  return { titre: titre, description: description, image: image, url: ORIGINE + '/match/' + m.id, ld: ld, type: 'article' };
}

/* Ce que la page dit d'une joueuse : schema.org Person, membre de l'équipe. */
function metaJoueuse(p){
  var titre = p.name + (p.jersey_number != null ? ' · #' + p.jersey_number : '');
  var morceaux = [];
  if (p.position) morceaux.push(p.position);
  if (p.height) morceaux.push(p.height);
  if (p.city) morceaux.push(p.city);
  var description = (morceaux.length ? morceaux.join(' · ') + ' · ' : '') + 'Joueuse du Baobabs Basket Club, Dakar.';
  if (p.bio){
    var bio = String(p.bio).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (bio) description = bio.length > 180 ? bio.slice(0, 177) + '…' : bio;
  }
  var image = absolue(p.photo_url) || IMAGE_DEFAUT;
  var ld = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: p.name,
    url: ORIGINE + '/joueuse/' + p.id,
    image: image,
    jobTitle: p.position ? 'Joueuse de basketball, ' + p.position : 'Joueuse de basketball',
    memberOf: { '@type': 'SportsTeam', name: 'Baobabs Basket Club', sport: 'Basketball', url: ORIGINE + '/' }
  };
  if (p.height) ld.height = p.height;
  return { titre: titre, description: description, image: image, url: ORIGINE + '/joueuse/' + p.id, ld: ld, type: 'profile' };
}

/* La page du site, telle qu'elle est déployée, puis les remplacements. */
function pageDuSite(req){
  var hote = req.headers['x-forwarded-host'] || req.headers.host || 'www.baobabsbasketclub.com';
  var proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  return fetch(proto + '://' + hote + '/index.html', { headers: { 'user-agent': 'baobabs-partage' } })
    .then(function(r){ if (!r.ok) throw new Error('index ' + r.status); return r.text(); });
}

function remplacer(html, meta, route){
  var titreSite = (/<title>([\s\S]*?)<\/title>/.exec(html) || [0, 'Baobabs Basket Club'])[1];
  var titre = ech(meta.titre + ' · Baobabs Basket Club');
  var desc = ech(meta.description);
  var image = ech(meta.image);
  var url = ech(meta.url);
  /* remplacement par fonction : un « $ » dans un nom d'adversaire ne
     doit pas devenir une référence de motif */
  var rempl = function(motif, texte){
    if (!motif.test(html)) return;
    html = html.replace(motif, function(){ return texte; });
  };
  rempl(/<title>[\s\S]*?<\/title>/, '<title>' + titre + '</title>');
  rempl(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + desc + '">');
  rempl(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + titre + '">');
  rempl(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + desc + '">');
  rempl(/<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="' + image + '">');
  rempl(/<meta property="og:type" content="[^"]*">/, '<meta property="og:type" content="' + meta.type + '">');
  rempl(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + url + '">');
  rempl(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="' + titre + '">');
  rempl(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="' + desc + '">');
  rempl(/<meta name="twitter:image" content="[^"]*">/, '<meta name="twitter:image" content="' + image + '">');
  rempl(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + url + '">');
  /* les dimensions annoncées sont celles de la bannière du club ; une
     affiche de match n'a pas ce format, on ne ment pas dessus */
  if (meta.image !== IMAGE_DEFAUT){
    rempl(/\s*<meta property="og:image:width" content="[^"]*">/, '');
    rempl(/\s*<meta property="og:image:height" content="[^"]*">/, '');
  }
  /* les données structurées de la fiche : celles du club restent (sous
     un autre id), Google lit les deux */
  rempl(/<script type="application\/ld\+json" id="bb-jsonld">/, '<script type="application/ld+json" id="bb-jsonld-fiche">' + JSON.stringify(meta.ld).replace(/</g, '\\u003c') + '</script>\n<script type="application/ld+json" id="bb-jsonld">');
  /* la route, et le titre du site pour quand on quitte la fiche */
  var amorce = '<script>window.bbRouteInitiale=' + JSON.stringify(route).replace(/</g, '\\u003c') + ';window.bbTitreSite=' + JSON.stringify(titreSite).replace(/</g, '\\u003c') + ';</script>\n</head>';
  html = html.replace(/<\/head>/, function(){ return amorce; });
  return html;
}

module.exports = function(req, res){
  var type = String(req.query.type || ''), id = String(req.query.id || '');
  if ((type !== 'match' && type !== 'joueuse') || !UUID.test(id)){
    res.statusCode = 302;
    res.setHeader('Location', '/');
    res.end();
    return;
  }
  var lecture = type === 'match'
    ? sb('matches?select=id,opponent_name,opponent_logo_url,match_date,match_time,venue,competition,round_label,is_home,score_baobabs,score_opponent,photo_url,free_entry&id=eq.' + id).then(function(rows){ return rows[0] ? metaMatch(rows[0]) : null; })
    : sb('effectif_site?select=id,name,jersey_number,position,photo_url,bio,city,height&id=eq.' + id).then(function(rows){ return rows[0] ? metaJoueuse(rows[0]) : null; });
  Promise.all([lecture, pageDuSite(req)]).then(function(r){
    var meta = r[0], html = r[1];
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (!meta){
      /* la fiche n'existe pas : la page du site, qui dira « ce match
         n'existe pas, ou plus » et ramènera aux Compétitions */
      res.statusCode = 404;
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
      res.end(remplacer(html, { titre: type === 'match' ? 'Match introuvable' : 'Fiche introuvable', description: 'Cette page n’existe pas, ou plus.', image: IMAGE_DEFAUT, url: ORIGINE + '/', ld: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Introuvable' }, type: 'website' }, type + '-' + id));
      return;
    }
    /* cinq minutes en cache sur le réseau de Vercel : un score saisi
       apparaît vite, et le serveur ne relit pas la base à chaque partage */
    res.statusCode = 200;
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
    res.end(remplacer(html, meta, type + '-' + id));
  }).catch(function(e){
    /* quoi qu'il arrive, le visiteur atteint la fiche : le site lit le
       dièse tout seul */
    res.statusCode = 302;
    res.setHeader('Location', '/#' + type + '-' + id);
    res.end();
  });
};
