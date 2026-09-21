/* =====================================================================
   LE SERVICE WORKER DU SITE
   ---------------------------------------------------------------------
   Il sert a une seule chose : que le site s'ouvre quand le reseau est
   mauvais ou absent. A Dakar, c'est le cas ordinaire dans une salle
   pleine un soir de match.

   IL NE SERT JAMAIS UNE PAGE PERIMEE. C'est la regle qui a decide de
   tout ce fichier. Le club a deja perdu des heures a regarder une
   ancienne version de son site sans le savoir ; un service worker mal
   ecrit rend ce piege permanent et invisible. Donc :

   - LA PAGE passe TOUJOURS par le reseau d'abord. Le cache n'est lu que
     si le reseau ne repond pas. Une page servie de force depuis le
     cache, meme fraiche de cinq minutes, est interdite.
   - LES IMAGES de /media/ passent par le cache d'abord : elles ne
     changent jamais de contenu sous un meme nom (le site les sert avec
     un cache d'un an). Ce sont elles qui pesent, et elles seules.
   - SUPABASE, /api/ ET TOUT LE RESTE ne sont jamais mis en cache. Un
     score, une commande, une affiche de partage : rien de tout cela ne
     doit sortir d'une reserve.

   Ce fichier ne se met pas a jour tout seul dans les onglets ouverts :
   skipWaiting et clients.claim font que la version neuve prend la main
   des qu'elle est installee, sans attendre la fermeture de l'onglet.
   ===================================================================== */
'use strict';

var VERSION = 'bbc-2026-09-21';
var CACHE_PAGES = VERSION + '-pages';
var CACHE_MEDIA = VERSION + '-media';
var MEDIA_MAX = 140;          /* au-dela, on retire les plus anciennes */

/* Ce qui doit etre la des la premiere visite pour que le site s'ouvre
   hors ligne : la page elle-meme. Le reste suivra a l'usage. */
self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_PAGES).then(function (c) {
      return c.add(new Request('/', { cache: 'reload' })).catch(function () {});
    })
  );
});

/* A l'activation : tous les caches d'une version precedente s'en vont.
   Sans cela, une image remplacee resterait servie indefiniment. */
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (noms) {
      return Promise.all(noms.map(function (n) {
        if (n.indexOf('bbc-') === 0 && n.indexOf(VERSION) !== 0) return caches.delete(n);
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* Le club peut forcer la main a la version neuve depuis la page. */
self.addEventListener('message', function (e) {
  if (e.data === 'bbc-sw-maintenant') self.skipWaiting();
});

function estMedia(url) {
  return url.origin === self.location.origin &&
    (/^\/media\//.test(url.pathname) || /\.(webp|png|jpe?g|svg|woff2?|ttf)$/i.test(url.pathname));
}

function bornerMedia() {
  return caches.open(CACHE_MEDIA).then(function (c) {
    return c.keys().then(function (cles) {
      if (cles.length <= MEDIA_MAX) return null;
      return Promise.all(cles.slice(0, cles.length - MEDIA_MAX).map(function (k) { return c.delete(k); }));
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (x) { return; }

  /* Rien de ce qui vit ne passe par une reserve : la base, les fonctions
     serveur, et tout ce qui n'est pas chez nous. */
  if (url.origin !== self.location.origin) return;
  if (/^\/api\//.test(url.pathname) || /^\/og\//.test(url.pathname)) return;

  /* LA PAGE : le reseau d'abord, toujours. */
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') >= 0) {
    e.respondWith(
      fetch(req).then(function (rep) {
        if (rep && rep.ok && rep.type === 'basic') {
          var copie = rep.clone();
          caches.open(CACHE_PAGES).then(function (c) { c.put('/', copie); });
        }
        return rep;
      }).catch(function () {
        /* le reseau n'a pas repondu : la derniere page connue, a defaut */
        return caches.match('/', { ignoreSearch: true }).then(function (r) {
          return r || new Response(
            '<!doctype html><meta charset="utf-8"><title>Hors ligne</title>' +
            '<body style="margin:0;display:grid;place-items:center;height:100vh;background:#061109;color:#F3EFE6;' +
            'font-family:system-ui,sans-serif;text-align:center;padding:24px">' +
            '<div><p style="font-size:18px">Pas de connexion.</p>' +
            '<p style="color:#93A099;font-size:14px">Le site s’ouvrira de nouveau dès que le réseau reviendra.</p></div>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
          );
        });
      })
    );
    return;
  }

  /* LES IMAGES ET LES POLICES : le cache d'abord, puis le reseau. */
  if (estMedia(url)) {
    e.respondWith(
      caches.match(req).then(function (enCache) {
        if (enCache) return enCache;
        return fetch(req).then(function (rep) {
          if (rep && rep.ok && rep.type === 'basic') {
            var copie = rep.clone();
            caches.open(CACHE_MEDIA).then(function (c) {
              c.put(req, copie).then(bornerMedia);
            });
          }
          return rep;
        });
      })
    );
  }
  /* tout le reste : le reseau, sans intermediaire */
});

/* =====================================================================
   LES NOTIFICATIONS
   ---------------------------------------------------------------------
   Le serveur envoie un petit objet JSON ; ce fichier le transforme en
   notification, et decide ou l'on tombe quand on la touche. Un message
   illisible n'est pas une raison de ne rien afficher : le club aura
   quand meme sonne, et le supporter saura qu'il se passe quelque chose.

   Le « tag » fait qu'un second message sur le MEME match remplace le
   premier au lieu de s'empiler : un score qui se corrige deux fois ne
   doit pas laisser trois notifications sur le telephone.
   ===================================================================== */
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; }
  catch (x) { d = { corps: e.data ? e.data.text() : '' }; }

  var titre = d.titre || 'Baobabs Basket Club';
  var options = {
    body: d.corps || '',
    icon: d.image || '/favicon-192.png',
    badge: '/favicon-96.png',
    tag: d.tag || 'bbc',
    renotify: d.renotify !== false,
    lang: 'fr',
    data: { url: d.url || '/' },
    /* une notification de match merite qu'on la sente passer ; une
       notification de service, non */
    vibrate: d.discret ? undefined : [90, 60, 90]
  };
  e.waitUntil(self.registration.showNotification(titre, options));
});

/* La toucher ouvre la bonne page -- la fiche du match, pas l'accueil --
   et reutilise l'onglet du site s'il est deja ouvert. */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var cible = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (fenetres) {
      for (var i = 0; i < fenetres.length; i++) {
        var f = fenetres[i];
        if (f.url.indexOf(self.location.origin) === 0 && 'focus' in f) {
          if ('navigate' in f) { try { f.navigate(cible); } catch (x) {} }
          return f.focus();
        }
      }
      return self.clients.openWindow(cible);
    })
  );
});

/* Un abonnement peut etre renouvele par le navigateur sans qu'on ait
   rien demande. Sans ce rattrapage, le telephone cesse de recevoir en
   silence, et personne ne le sait. */
self.addEventListener('pushsubscriptionchange', function (e) {
  e.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true }).then(function (l) {
      l.forEach(function (c) { c.postMessage('bbc-push-renouveler'); });
    })
  );
});
