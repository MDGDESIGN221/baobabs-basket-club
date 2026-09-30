# -*- coding: utf-8 -*-
# Premiere passe de la refonte (piste A sombre, choisie le 30/09/2026) :
# index.html -> index-refonte.html. Couleurs selon leur role (texte, fond,
# trait), polices, angles droits, plus de flou.
#   le vert quasi noir  -> le vert foret du blason (fond, surface, tuile)
#   le citron           -> l'or pour ce qui se lit, le blanc casse pour les boutons
#   le texte sur citron -> le vert du blason, sur ces boutons clairs
import io, re, sys, collections

SRC, DST = sys.argv[1], sys.argv[2]
s = io.open(SRC, encoding='utf-8', newline='').read()

FOND, SURF, TUILE, FILET = '#0A2217', '#0E2A1D', '#133524', '#21402F'
ENCRE, ENCRE2, CORPS, GRIS, PALE = '#EDEFEA', '#D9DED8', '#BCC7BF', '#9DADA3', '#7F9186'
VERT, CLAIR, SUR_CLAIR = '#134A2E', '#EDEFEA', '#134A2E'
OR_VAR, OR_LIT, OR_L = 'var(--bb-or)', '#C9A961', '#E4C179'

G = dict(
 PAGE='#061109 #05130D #06110B #05100A #05100B #040604 #050705 #0D100D #07130D #08160D #0A120D #060C09 #050F0A #08150E',
 SURF='#0A150F #0C1A12 #0C1913 #0A1B12 #0E1A12 #0C1E13 #0B1810 #0A1A11 #0A1710 #081C13 #0A1B0D #0B1710 #081711 #0D1A12',
 ELEV='#0F1E15 #12211A #10281B #0A2318 #0B2A1B #12331F #123322 #0C2418 #10331F #0F2417',
 GREEN='#0F4030 #17452E #14402B #1E5C3A #1C7A3A #123A22 #12402F #12402C #1C4532',
 L1='#F3EFE6 #E9F0EA #E8E4DA',
 L2='#D8D6CE #DDE6DE #D6DDD7',
 BODY='#C7CFC8 #B9C2BB #A9B2AB',
 MUTED='#93A099 #7E8A82 #8A948D #8B968D #8F9A92 #8FA096 #8F9A91',
 FAINT='#5F6B63 #5C6961 #4E5A50 #3E4A43 #6F7D74 #5E6F64 #4A574E #4A5450',
 LIME='#A8D93B #B9E455 #8FBF33 #7DFF4F #7BB52E',
 LIMEL='#C8E88A #B9E39A #DCEF8B',
 GOLD='#C6A257',
)
GRP = {}
for g, v in G.items():
    for h in v.split():
        GRP[h] = g

MAPS = {
 'fg':   dict(PAGE=SUR_CLAIR, SURF=SUR_CLAIR, ELEV=SUR_CLAIR, GREEN=VERT, L1=ENCRE, L2=ENCRE2, BODY=CORPS, MUTED=GRIS, FAINT=PALE, LIME=OR_LIT, LIMEL=OR_L, GOLD=OR_VAR),
 'bg':   dict(PAGE=FOND, SURF=SURF, ELEV=TUILE, GREEN=VERT, L1=CLAIR, L2=ENCRE2, BODY=CORPS, MUTED=GRIS, FAINT=PALE, LIME=CLAIR, LIMEL='#F7F8F5', GOLD=OR_VAR),
 'line': dict(PAGE=FILET, SURF=FILET, ELEV=FILET, GREEN=VERT, L1=ENCRE, L2=ENCRE2, BODY=CORPS, MUTED=GRIS, FAINT=PALE, LIME=OR_LIT, LIMEL=OR_L, GOLD=OR_VAR),
 'free': dict(PAGE=FOND, SURF=SURF, ELEV=TUILE, GREEN=VERT, L1=ENCRE, L2=ENCRE2, BODY=CORPS, MUTED=GRIS, FAINT=PALE, LIME=OR_LIT, LIMEL=OR_L, GOLD=OR_LIT),
}
HEX = re.compile(r'#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b(?![0-9A-Fa-f])')

def norm(h):
    h = h.upper()
    if len(h) == 4:
        return h  # les #FFF / #000 ne sont pas dans la table
    return h

stats = collections.Counter()
def remap_hex(text, ctx):
    def f(m):
        h = norm(m.group(0))
        g = GRP.get(h)
        if not g:
            return m.group(0)
        stats[ctx + ':' + g] += 1
        return MAPS[ctx][g]
    return HEX.sub(f, text)

def ctx_of(prop):
    p = prop.lower()
    if p in ('color', 'fill', 'stroke', 'caret-color', '-webkit-text-fill-color', 'text-decoration-color', 'accent-color'):
        return 'fg'
    if p.startswith('background'):
        return 'bg'
    if p.startswith('border') or p.startswith('outline') or p in ('column-rule', 'column-rule-color', '-webkit-text-stroke'):
        return 'line'
    return 'free'

# 2. couleurs dans les declarations « propriete:valeur »
DECL = re.compile(r'([a-zA-Z-]+)(\s*:\s*)([^;"\'{}<>\n]*)')
s = DECL.sub(lambda m: m.group(1) + m.group(2) + remap_hex(m.group(3), ctx_of(m.group(1))), s)
# 3. le reste (SVG, canvas, JS) : inversion simple
s = remap_hex(s, 'free')

# 4. les triplets rgba et les jetons
# le trait du site : il etait citron, il devient un blanc discret
s, n = re.subn(r'--bb-fil-rgb\s*:\s*168\s*,\s*217\s*,\s*59', '--bb-fil-rgb:237,239,234', s); stats['jeton fil'] += n
TRIPLETS = [('168,217,59', '201,169,97'), ('143,203,67', '201,169,97'), ('148,217,90', '201,169,97'),
            ('198,162,87', '201,169,97')]
for a, b in TRIPLETS:
    pat = r'(?<![\d.])' + r'\s*,\s*'.join(re.escape(x) for x in a.split(',')) + r'(?![\d])'
    s, n = re.subn(pat, b, s)
    stats['triplet ' + a] += n
# les voiles quasi noirs prennent le vert du blason (seulement dans un rgba :
# un triplet aussi court se retrouve dans un trace SVG)
for v in ('6,20,13', '5,16,11', '5,14,9', '8,22,14', '6,17,11', '11,26,16', '4,12,8', '7,19,13',
          '10,21,15', '6,13,9', '4,10,7', '3,9,6', '8,15,10', '12,30,19', '10,32,20', '6,17,9',
          '10,20,9', '12,29,19', '10,27,13'):
    pat = r'(rgba?\(\s*)' + r'\s*,\s*'.join(v.split(',')) + r'(?![\d])'
    s, n = re.subn(pat, r'\g<1>10,34,23', s)
    stats['voile ' + v] += n

# 5. polices : une seule famille, Archivo ; ses titres en coupe condensee grasse
FONTS = [('Archivo Black', 'Archivo Titre'), ('Space Grotesk', 'Archivo'), ('Inter', 'Archivo'),
         ('Anton', 'Archivo Titre'), ('Bebas Neue', 'Archivo Titre'), ('Big Shoulders Display', 'Archivo Titre')]
for a, b in FONTS:
    s, n = re.subn(r"(\\?['\"])" + re.escape(a) + r"(\\?['\"])", lambda m: m.group(1) + b + m.group(2), s)
    stats['police ' + a] += n
s, n = re.subn(r'(font-family\s*:\s*)Inter\b', r"\1'Archivo'", s); stats['police Inter nu'] += n
s, n = re.subn(r'(\d+px\s+)Inter\b', r"\1Archivo", s); stats['police canvas Inter'] += n

# 6. angles droits (les ronds en % restent ronds)
def rad(m):
    v = m.group(3)
    if '%' in v or 'inherit' in v or 'var(' in v:
        return m.group(0)
    stats['rayon'] += 1
    return m.group(1) + m.group(2) + '0'
s = re.sub(r'(border(?:-(?:top|bottom)-(?:left|right))?-radius)(\s*:\s*)([^;"\'{}<>\n!]*)', rad, s)
s, n = re.subn(r"(\.borderRadius\s*=\s*)(['\"])([^'\"%]*)\2", r"\1\g<2>0\2", s); stats['rayon js'] += n

# 7. plus de verre
s, n = re.subn(r'(?:-webkit-)?backdrop-filter\s*:\s*[^;"\'{}\n]*;?', '', s); stats['flou'] += n

# 8. la feuille de Google Fonts cede la place aux polices du site
s, n = re.subn(r'<link href="https://fonts\.googleapis\.com/css2\?[^"]*" rel="stylesheet">\r?\n?', '', s); stats['lien google fonts'] += n
s, n = re.subn(r'<link rel="preconnect" href="https://fonts\.(?:googleapis|gstatic)\.com"[^>]*>\r?\n?', '', s); stats['preconnect fonts'] += n

io.open(DST, 'w', encoding='utf-8', newline='').write(s)
for k, v in sorted(stats.items()):
    print('%-32s %d' % (k, v))
