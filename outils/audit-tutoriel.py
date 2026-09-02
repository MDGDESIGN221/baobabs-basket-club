# -*- coding: utf-8 -*-
"""
Audit des tables du tutoriel — a relancer apres TOUTE retouche de
SECTION_HELP ou de TUT_CIBLES.

POURQUOI CE SCRIPT EXISTE
Les deux tables sont POSITIONNELLES : TUT_CIBLES[ecran][i] va avec
SECTION_HELP[ecran][i]. Ajouter un conseil sans ajouter une cible decale
tout d'un cran. Le tutoriel s'en protege -- il renonce alors aux cibles
de l'ecran entier et le dit en console.warn -- mais il PARLE SANS RIEN
MONTRER, et personne ne lit la console.

C'est arrive sur dix ecrans le 2 septembre 2026, dont un qui l'etait
depuis trois jours sans que ca se voie.

    python outils/audit-tutoriel.py

Sortie attendue : « 0 ecran decale ». Tout le reste est un defaut.

CE QUE CE SCRIPT NE FAIT PAS
Il compare des longueurs, rien de plus. Il ne dit pas si un selecteur
designe encore quelque chose -- ca, il faut ouvrir chaque ecran dans le
navigateur et le mesurer. Voir docs/REPRISE-refonte-admin.md, §4.
"""
import io
import os
import re
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FICHIER = os.path.join(RACINE, "admin-matchs.html")
BS = chr(92)          # antislash, jamais dans un litteral : il y casse tout
LF = chr(10)


def bloc(source, nom):
    """Le corps de « var NOM = { ... }; »."""
    d = source.index("var " + nom + " = {")
    f = source.index("\r\n  };", d)
    return source[d:f]


def corps_du_tableau(b, cle):
    """Le contenu entre les crochets de « cle: [ ... ] », ou None."""
    m = re.search(r"^\s{4}" + re.escape(cle) + r":\s*\[", b, re.M)
    if not m:
        return None
    i = m.end() - 1
    prof = 0
    for j in range(i, len(b)):
        if b[j] == '[':
            prof += 1
        elif b[j] == ']':
            prof -= 1
            if prof == 0:
                return b[i + 1:j]
    return None


def compte_elements(corps, guillemet):
    """Elements de premier niveau.

    On marche caractere par caractere plutot que d'ecrire une expression
    reguliere : les cibles imbriquent des listes (`['a', 'b']` comme
    repli) et les conseils contiennent des apostrophes echappees. Les
    deux mettent en defaut tout motif un peu court.
    """
    if not corps.strip():
        return 0
    n, prof = 0, 0
    dedans = False
    commentaire = False
    prec = ''
    i = 0
    while i < len(corps):
        ch = corps[i]
        # LES COMMENTAIRES SE SAUTENT, ET C'EST LE POINT DELICAT.
        #
        # Sans ce saut, deux choses arrivent. La virgule d'un commentaire
        # (« Sans lui, on designe le releve ») compte comme un separateur
        # et l'ecran est declare decale alors qu'il ne l'est pas. Pire :
        # une apostrophe francaise (« n'existe ») ouvre une chaine
        # imaginaire, tout ce qui suit passe pour du texte, et un VRAI
        # decalage peut alors passer inapercu. Le garde-fou mentait dans
        # les deux sens.
        if commentaire:
            if ch == LF:
                commentaire = False
        elif dedans:
            if ch == guillemet and prec != BS:
                dedans = False
        elif ch == '/' and corps[i + 1:i + 2] == '/':
            commentaire = True
            i += 2
            prec = '/'
            continue
        elif ch == '/' and corps[i + 1:i + 2] == '*':
            f = corps.find('*/', i)
            i = len(corps) if f < 0 else f + 2
            prec = '/'
            continue
        elif ch == guillemet:
            dedans = True
        elif ch == '[':
            prof += 1
        elif ch == ']':
            prof -= 1
        elif ch == ',' and prof == 0:
            n += 1
        prec = ch
        i += 1
    return n + 1


def main():
    source = io.open(FICHIER, "r", encoding="utf-8", newline="").read()

    # Un fichier rendu en LF fait un diff de 20 000 lignes pour trois
    # vraies. On le dit ici aussi : c'est le meme genre de degat silencieux.
    lf = source.count("\n") - source.count("\r\n")
    cr = source.count("\r") - source.count("\r\n")
    if lf or cr:
        print("ATTENTION : %d fins de ligne LF seules, %d CR seules." % (lf, cr))
        print("            Le fichier doit etre en CRLF de bout en bout.\n")

    bh = bloc(source, "SECTION_HELP")
    bc = bloc(source, "TUT_CIBLES")
    cles = sorted(set(re.findall(r"^\s{4}([a-z_0-9]+):\s*\[", bh, re.M)) |
                  set(re.findall(r"^\s{4}([a-z_0-9]+):\s*\[", bc, re.M)))

    decales = []
    avec_cibles = 0
    total_conseils = 0
    for k in cles:
        ch = corps_du_tableau(bh, k)
        cc = corps_du_tableau(bc, k)
        a = compte_elements(ch, '"') if ch is not None else 0
        c = compte_elements(cc, "'") if cc is not None else 0
        total_conseils += a
        if c:
            avec_cibles += 1
        # Une table de cibles absente est licite : l'ecran n'en a pas.
        # Une table PRESENTE mais d'une autre longueur est un defaut.
        if c and a != c:
            decales.append((k, a, c))

    if decales:
        print("%-16s %9s %8s" % ("ecran", "conseils", "cibles"))
        for k, a, c in decales:
            print("%-16s %9d %8d   <<< DECALE" % (k, a, c))
        print("")
    print("%d ecran%s decale%s sur %d qui ont des cibles  (%d conseils en tout)"
          % (len(decales), "s" if len(decales) > 1 else "",
             "s" if len(decales) > 1 else "", avec_cibles, total_conseils))

    return 1 if decales else 0


if __name__ == "__main__":
    sys.exit(main())
