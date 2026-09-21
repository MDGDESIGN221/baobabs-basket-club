/* =====================================================================
   /api/notifier : LE CLUB FAIT SONNER LES TELEPHONES
   ---------------------------------------------------------------------
   Elle envoie une notification a tous ceux qui l'ont acceptee. Elle ne
   decide de rien : c'est l'appelant qui dit quoi ecrire, pourquoi, et ou
   mene le clic.

     POST /api/notifier
     en-tete  x-bbc-secret: <BBC_NOTIF_SECRET>
     corps    { motif, cible, titre, corps, url, image }

   QUI PEUT L'APPELER. Elle est ouverte sur le web comme toute fonction :
   sans le secret, elle repond 401 et ne lit meme pas la base. Le secret
   vit dans les variables d'environnement de Vercel, jamais dans le
   depot -- qui est public.

   UNE NOTIFICATION NE PART QU'UNE FOIS. La paire (motif, cible) est
   unique dans push_envois : un declencheur rejoue, ou un score corrige
   deux fois, ne fait pas sonner deux fois le meme telephone. C'est la
   base qui le garantit, pas ce fichier.

   LES ADRESSES MORTES SE RETIRENT. Un service de notification repond 404
   ou 410 quand l'application a ete desinstallee. Sans ce menage, la
   liste enfle de telephones qui n'existent plus, et chaque envoi coute
   de plus en plus cher pour rien.
   ===================================================================== */
'use strict';

var SB_URL = 'https://lmwbwasupqkvswukieav.supabase.co';
var VAPID_PUBLIQUE = 'BClxOiHe_eEYyEBxYGxoKhGkrcOh0tHFk2wRPvNrxoYpLRqyZPuXxUZM6lvUyivQBHvLYX6kNdBbwhvHqIHYwe0';
var CONTACT = 'mailto:baobabsbasketclub@gmail.com';

/* comme api/og.js : le require vit dans le handler. Une dependance
   absente doit rendre un message lisible, pas FUNCTION_INVOCATION_FAILED
   que rien ne rattrape. */
var webpush = null, chargement = null;
function charger(){
  if (chargement) return chargement;
  chargement = { ok: true };
  try { webpush = require('web-push'); }
  catch (e){ chargement.ok = false; chargement.erreur = String(e && e.message); }
  return chargement;
}

function service(){
  return process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}
function sb(chemin, options){
  var o = options || {};
  o.headers = Object.assign({
    apikey: service(),
    Authorization: 'Bearer ' + service(),
    'Content-Type': 'application/json'
  }, o.headers || {});
  return fetch(SB_URL + '/rest/v1/' + chemin, o);
}

function lireCorps(req){
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise(function(ok){
    var t = '';
    req.on('data', function(c){ t += c; });
    req.on('end', function(){ try { ok(JSON.parse(t || '{}')); } catch (e){ ok({}); } });
    req.on('error', function(){ ok({}); });
  });
}

function repondre(res, code, objet){
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(objet));
}

module.exports = function(req, res){
  if (req.method !== 'POST') return repondre(res, 405, { erreur: 'POST seulement' });

  var secret = process.env.BBC_NOTIF_SECRET || '';
  var donne = req.headers['x-bbc-secret'] || '';
  if (!secret || donne !== secret) return repondre(res, 401, { erreur: 'non autorise' });

  var etat = charger();
  if (!etat.ok) return repondre(res, 500, { erreur: 'web-push absent', detail: etat.erreur });
  if (!process.env.BBC_VAPID_PRIVEE) return repondre(res, 500, { erreur: 'BBC_VAPID_PRIVEE manquante' });
  if (!service()) return repondre(res, 500, { erreur: 'SUPABASE_SERVICE_KEY manquante' });

  webpush.setVapidDetails(CONTACT, VAPID_PUBLIQUE, process.env.BBC_VAPID_PRIVEE);

  lireCorps(req).then(function(d){
    var motif = String(d.motif || '').slice(0, 60);
    var cible = d.cible == null ? null : String(d.cible).slice(0, 120);
    var titre = String(d.titre || '').slice(0, 120);
    var corps = String(d.corps || '').slice(0, 300);
    if (!motif || !titre) return repondre(res, 400, { erreur: 'motif et titre sont requis' });

    var charge = JSON.stringify({
      titre: titre,
      corps: corps,
      url: String(d.url || '/').slice(0, 300),
      image: d.image ? String(d.image).slice(0, 400) : undefined,
      tag: motif + (cible ? ':' + cible : ''),
      discret: !!d.discret
    });

    /* On pose d'abord la trace : si elle existe deja, rien ne part. La
       base tranche, pas ce fichier -- deux appels simultanes ne peuvent
       pas passer tous les deux. */
    sb('push_envois', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ motif: motif, cible: cible })
    }).then(function(r){
      if (r.status === 409) { repondre(res, 200, { deja: true, envoyes: 0 }); return null; }
      if (!r.ok) return r.text().then(function(t){ throw new Error('trace ' + r.status + ' ' + t.slice(0, 120)); });
      return sb('push_abonnes?select=id,endpoint,p256dh,auth&limit=2000');
    }).then(function(r){
      if (!r) return null;
      if (!r.ok) throw new Error('abonnes ' + r.status);
      return r.json();
    }).then(function(liste){
      if (!liste) return null;
      if (!liste.length) return repondre(res, 200, { envoyes: 0, abonnes: 0 });

      var morts = [], partis = 0;
      return Promise.all(liste.map(function(a){
        return webpush.sendNotification(
          { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
          charge,
          { TTL: 3600 }
        ).then(function(){ partis++; })
         .catch(function(e){
           var code = e && e.statusCode;
           if (code === 404 || code === 410) morts.push(a.endpoint);
         });
      })).then(function(){
        /* le menage des adresses mortes, puis seulement la reponse */
        if (!morts.length) return null;
        return sb('push_abonnes?endpoint=in.(' + morts.map(function(e){ return '"' + e.replace(/"/g, '') + '"'; }).join(',') + ')', { method: 'DELETE' })
          .catch(function(){ return null; });
      }).then(function(){
        return sb('push_envois?motif=eq.' + encodeURIComponent(motif) + (cible ? '&cible=eq.' + encodeURIComponent(cible) : '&cible=is.null'), {
          method: 'PATCH', body: JSON.stringify({ touches: partis })
        }).catch(function(){ return null; });
      }).then(function(){
        repondre(res, 200, { envoyes: partis, abonnes: liste.length, retires: morts.length });
      });
    }).catch(function(e){
      repondre(res, 500, { erreur: String(e && e.message).slice(0, 200) });
    });
  });
};
