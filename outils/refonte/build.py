# -*- coding: utf-8 -*-
"""
LA REFONTE, REJOUABLE (piste A sombre, choisie le 30/09/2026)
-------------------------------------------------------------
Fabrique index-refonte.html a partir d'index.html, sans jamais toucher a
index.html. Tant que la refonte n'a pas bascule, le site en ligne reste
l'ancien ; un correctif pose entre-temps dans index.html passe dans la
refonte en relancant simplement :

    python outils/refonte/build.py

Trois temps :
  1. remap.py  : la conversion automatique (couleurs selon leur role,
                 polices, angles droits, plus de flou) ;
  2. le socle  : les feuilles *.css de ce dossier, reunies dans un seul
                 <style id="pa-socle"> pose a la fin du <head>, donc apres
                 toutes les anciennes feuilles ;
  3. les retouches : chaque bloc remplace est borne par deux marqueurs
                 EXACTS, qui doivent etre uniques. Une borne introuvable ou
                 en double arrete tout : c'est le signe qu'index.html a
                 change a cet endroit, et qu'il faut relire avant de
                 recoller (voir la memoire « jamais remplacer une tranche
                 de CSS » : 1 644 lignes y sont passees un 10 septembre).
"""
import io, os, subprocess, sys

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(os.path.dirname(ICI))
SRC = os.path.join(RACINE, 'index.html')
DST = os.path.join(RACINE, 'index-refonte.html')

def lire(p):
    return io.open(p, encoding='utf-8', newline='').read()

def fichier(nom):
    return lire(os.path.join(ICI, nom)).replace('\r\n', '\n')

# ---------------------------------------------------------------- 1
subprocess.check_call([sys.executable, os.path.join(ICI, 'remap.py'), SRC, DST])
s = lire(DST)
E = '\r\n'
assert E in s

def crlf(t):
    return t.replace('\r\n', '\n').replace('\n', E)

journal = []
def bloc(nom, debut, fin, neuf, maxi):
    """Remplace de DEBUT (inclus) a FIN (exclu)."""
    global s
    debut, fin = crlf(debut), crlf(fin)
    assert s.count(debut) == 1, '%s : debut trouve %d fois' % (nom, s.count(debut))
    assert s.count(fin) == 1, '%s : fin trouvee %d fois' % (nom, s.count(fin))
    i, j = s.index(debut), s.index(fin)
    assert i < j, '%s : fin avant debut' % nom
    n = s[i:j].count('\n')
    assert n <= maxi, '%s : %d lignes, plus que les %d attendues' % (nom, n, maxi)
    neuf = crlf(neuf)
    s = s[:i] + neuf + s[j:]
    journal.append('%-24s %4d lignes -> %4d' % (nom, n, neuf.count('\n')))

def retire(nom, texte):
    """Retire un texte exact, qui doit etre unique."""
    global s
    texte = crlf(texte)
    assert s.count(texte) == 1, '%s : trouve %d fois' % (nom, s.count(texte))
    s = s.replace(texte, '')
    journal.append('%-24s retire (%d lignes)' % (nom, texte.count('\n')))

def remplace(nom, a, b):
    global s
    a, b = crlf(a), crlf(b)
    assert s.count(a) == 1, '%s : trouve %d fois' % (nom, s.count(a))
    s = s.replace(a, b)
    journal.append('%-24s remplace' % nom)

# ---------------------------------------------------------------- 2
SOCLE = ['socle.css', 'tete.css']
tete = ('<link rel="preload" href="/media/fonts/archivo-var-latin.woff2" as="font" type="font/woff2" crossorigin>\n'
        '<style id="pa-socle">\n' + '\n'.join(fichier(n) for n in SOCLE) + '</style>\n')
i = s.index('</head>')
s = s[:i] + crlf(tete) + s[i:]
journal.append('%-24s %s' % ('socle', ' + '.join(SOCLE)))

# ---------------------------------------------------------------- 3
# L'en-tete : barre utilitaire, bandeau, tiroir du telephone. Memes
# identifiants, memes attributs data-* ; plus aucun style en ligne.
bloc('en-tete', '  <div id="bb-utility"', '  <!-- ===== ACCUEIL ===== -->', fichier('tete.html'), 90)
# ses anciennes regles, qui forcaient avec !important ce que la feuille
# neuve dit maintenant
retire('nav : paliers', """  #bb-desktop-nav .bb-nav-link{white-space:nowrap}
  @media(max-width:1320px){#bb-desktop-nav{gap:16px!important;font-size:12px!important}}
  @media(max-width:1180px){
    #bb-desktop-nav{gap:10px!important;font-size:11.5px!important;letter-spacing:.03em!important}
    #bb-account-label{display:none}
    #bb-account-btn{padding:8px 10px!important}
  }
  @media(max-width:1100px){#bb-desktop-nav{gap:8px!important;font-size:11px!important}}
""")
retire('tete : telephone', """    #bb-live-btn-label{display:none}
    /* !important : ces deux boutons portent padding et border-radius en style
       inline, qui l'emporte sur une règle de feuille de style. Sans ça, la
       pastille mobile restait un rectangle doré avec un point au milieu. */
    #bb-live-btn{padding:0!important;width:40px;height:40px;justify-content:center;border-radius:50%!important}
    #bb-account-label{display:none}
    #bb-account-btn{padding:0!important;width:40px;height:40px;justify-content:center;border-radius:50%!important}
""")

# Le hero : le discours sur le vert du blason, la photo a droite, la carte
# du match et « A la une » en bande de pied.
bloc('hero : feuille', """  /* ================================================================
     LE HERO D'ACCUEIL
""", """  /* ================================================================
     LES ACTUALITES""", fichier('hero.css'), 460)

io.open(DST, 'w', encoding='utf-8', newline='').write(s)
d = s.encode('utf-8')
assert d.count(b'\x00') == 0 and (d.count(b'\r') == d.count(b'\r\n')) and (d.count(b'\n') == d.count(b'\r\n')), 'fins de ligne'
print('\n'.join(journal))
print('index-refonte.html : %d lignes' % s.count('\n'))
