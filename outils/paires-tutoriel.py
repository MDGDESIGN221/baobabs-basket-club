# -*- coding: utf-8 -*-
"""
Met en regard chaque conseil du tutoriel et la cible qu'il designe.

    python outils/paires-tutoriel.py

POURQUOI CET OUTIL EXISTE
audit-tutoriel.py compare des LONGUEURS : il attrape un conseil ajoute
sans cible, pas un conseil qui montre la mauvaise chose. Les deux tables
peuvent avoir exactement le meme nombre d'elements et se contredire.

C'est arrive trois fois, trouve le 2 septembre 2026 en lisant les 162
paires cote a cote :

    dashboard  le conseil parlait des DEUX COLONNES et le cadre se posait
               sur la liste ; le conseil suivant parlait de la LISTE et
               le cadre montrait les deux colonnes. Intervertis.
    standings  « Le podium en haut… » designait le tableau du dessous.
    audit      « Chaque ligne est une phrase… » designait la carte du
               verrou, pas le journal.

CE QUE CET OUTIL NE FAIT PAS
Il ne juge pas. Aucun score automatique ne marche ici : une cible qui
CONTIENT une autre herite de tous ses mots et l'emporte toujours. Essaye,
mesure, abandonne. Cet outil met simplement les deux colonnes cote a cote
pour qu'un humain lise — c'est la seule methode qui ait trouve quelque
chose.

A relancer apres toute retouche de SECTION_HELP ou de TUT_CIBLES, et a
lire en entier au moins une fois par saison.
"""
import io
import os
import re
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FICHIER = os.path.join(RACINE, "admin-matchs.html")
BS = chr(92)
LF = chr(10)


def litteral(source, apres):
    """Le corps de « var NOM = { … } », par equilibrage d'accolades.

    Les commentaires se sautent : une apostrophe francaise (« n'existe »)
    ouvrirait sinon une chaine imaginaire et tout partirait de travers.
    """
    i = source.find(apres)
    if i < 0:
        sys.exit("introuvable : " + apres)
    j = source.find("{", i)
    prof, k, enq = 0, j, None
    while k < len(source):
        c = source[k]
        if enq:
            if c == BS:
                k += 2
                continue
            if c == enq:
                enq = None
        elif c == "/" and source[k + 1:k + 2] == "/":
            k = source.find(LF, k)
            if k < 0:
                break
            continue
        elif c == "/" and source[k + 1:k + 2] == "*":
            k = source.find("*/", k) + 2
            continue
        elif c in "\"'":
            enq = c
        elif c == "{":
            prof += 1
        elif c == "}":
            prof -= 1
            if prof == 0:
                break
        k += 1
    return source[j:k + 1]


def elements(corps, guillemet):
    """Decoupe en elements de premier niveau, comme le fait le tutoriel."""
    out, cour, prof, dedans, prec = [], "", 0, False, ""
    i = 0
    while i < len(corps):
        ch = corps[i]
        if dedans:
            if ch == guillemet and prec != BS:
                dedans = False
            cour += ch
        elif ch == "/" and corps[i + 1:i + 2] == "/":
            f = corps.find(LF, i)
            i = len(corps) if f < 0 else f
            prec = ""
            continue
        elif ch == guillemet:
            dedans = True
            cour += ch
        elif ch == "[":
            prof += 1
            cour += ch
        elif ch == "]":
            prof -= 1
            cour += ch
        elif ch == "," and prof == 0:
            out.append(cour.strip())
            cour = ""
        else:
            cour += ch
        prec = ch
        i += 1
    if cour.strip():
        out.append(cour.strip())
    return out


def tableau(bloc, cle):
    m = re.search(r"^    " + re.escape(cle) + r":\s*\[", bloc, re.M)
    if not m:
        return None
    i = m.end() - 1
    prof = 0
    for j in range(i, len(bloc)):
        if bloc[j] == "[":
            prof += 1
        elif bloc[j] == "]":
            prof -= 1
            if prof == 0:
                return bloc[i + 1:j]
    return None


def lisible(t):
    t = re.sub(r"<[^>]+>", "", t).strip().strip('"')
    t = t.replace(BS + "'", "'").replace(BS + '"', '"')
    t = t.replace("&nbsp;", " ").replace(chr(0x00a0), " ")
    return re.sub(r"\s+", " ", t).strip()


def main():
    source = io.open(FICHIER, "r", encoding="utf-8", newline="").read()
    aides = litteral(source, "var SECTION_HELP = {")
    cibles = litteral(source, "var TUT_CIBLES = {")
    cles = [m.group(1) for m in re.finditer(r"^    ([a-z_0-9]+):\s*\[", aides, re.M)]

    lignes, n = [], 0
    for k in cles:
        ta, tc = tableau(aides, k), tableau(cibles, k)
        if ta is None:
            continue
        la = elements(ta, '"')
        lc = elements(tc, "'") if tc is not None else []
        lignes += ["", "=" * 78,
                   "%s   (%d conseils, %d cibles)" % (k.upper(), len(la), len(lc)),
                   "=" * 78]
        for i, a in enumerate(la):
            c = re.sub(r"\s+", " ", lc[i].strip()) if i < len(lc) else "(pas de cible)"
            n += 1
            lignes += ["",
                       "  [%d] CIBLE : %s" % (i, c),
                       "      DIT   : %s" % lisible(a)[:400]]

    # ON ECRIT UN FICHIER, ON N'IMPRIME PAS.
    # La console Windows est en cp1252 : la premiere fleche « → » d'un
    # conseil faisait planter l'outil sur un UnicodeEncodeError, et la
    # redirection « > paires.txt » n'y change rien — c'est stdout qui
    # est en cause, pas le fichier.
    p = os.path.join(RACINE, "paires-tutoriel.txt")
    io.open(p, "w", encoding="utf-8", newline=LF).write(LF.join(lignes) + LF)
    print("%d paires ecrites dans %s" % (n, p))
    print("Lisez-les : ce que je DIS doit etre ce que je MONTRE.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
