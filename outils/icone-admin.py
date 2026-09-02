# -*- coding: utf-8 -*-
# UNE VARIANTE POUR L'ADMINISTRATION.
#
# Meme blason, meme club -- seul le fond change. A 16 px, un onglet ne
# se lit pas : il se reconnait a sa couleur. Une tuile doree et une tuile
# sombre ne se confondent jamais ; deux blasons identiques, si.
#
# On DETOURE le medaillon du fichier existant plutot que de redessiner :
# le blason reste exactement celui du club, au pixel pres.
from PIL import Image, ImageDraw

SRC = "favicon-512.png"
OR_CLUB = (198, 162, 87)     # #C6A257 -- l'or de la marque
BORD = (10, 27, 13)          # #0A1B0D -- le vert sombre du site

src = Image.open(SRC).convert("RGBA")
W = src.size[0]
CENTRE = W / 2.0
RAYON = 226.0                # mesure : medaillon de 452 px

# Masque circulaire, dessine en 4x puis reduit : sans ca, le bord du
# medaillon est crenele et se voit des 96 px.
S = 4
m = Image.new("L", (W * S, W * S), 0)
ImageDraw.Draw(m).ellipse(
    [(CENTRE - RAYON) * S, (CENTRE - RAYON) * S,
     (CENTRE + RAYON) * S, (CENTRE + RAYON) * S], fill=255)
masque = m.resize((W, W), Image.LANCZOS)

fond = Image.new("RGBA", (W, W), OR_CLUB + (255,))

# Un lisere sombre sous le medaillon : l'anneau du blason est dore lui
# aussi, et sans cette separation il se fondrait dans le fond.
lis = Image.new("L", (W * S, W * S), 0)
ImageDraw.Draw(lis).ellipse(
    [(CENTRE - RAYON - 5) * S, (CENTRE - RAYON - 5) * S,
     (CENTRE + RAYON + 5) * S, (CENTRE + RAYON + 5) * S], fill=255)
fond.paste(Image.new("RGBA", (W, W), BORD + (255,)), (0, 0), lis.resize((W, W), Image.LANCZOS))

fond.paste(src, (0, 0), masque)

TAILLES = [("admin-favicon-512.png", 512), ("admin-favicon-192.png", 192),
           ("admin-favicon-96.png", 96), ("admin-favicon-48.png", 48),
           ("admin-apple-touch-icon.png", 180)]
for nom, t in TAILLES:
    img = fond if t == W else fond.resize((t, t), Image.LANCZOS)
    img.save(nom, "PNG", optimize=True)
    print("%-28s %3d px" % (nom, t))
