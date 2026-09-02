# -*- coding: utf-8 -*-
"""
Le garde-fou du garde-fou.

audit-tutoriel.py compte les elements de deux tables positionnelles. Sa
routine de comptage marche caractere par caractere, et elle a deja eu un
defaut : elle ne sautait pas les commentaires. Une virgule dans un
commentaire comptait pour un separateur — l'ecran etait declare decale
alors qu'il ne l'etait pas. Et une apostrophe francaise (« n'existe »)
ouvrait une chaine imaginaire : tout ce qui suivait passait pour du
texte, et un VRAI decalage pouvait alors passer inapercu.

Le second sens est le dangereux : un garde-fou qui se tait a tort ne sert
plus a rien. D'ou ce test.

    python outils/test-audit-tutoriel.py

Sortie attendue : tout « ok », code de sortie 0.
"""
import importlib.util
import os
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHEMIN = os.path.join(RACINE, "outils", "audit-tutoriel.py")

spec = importlib.util.spec_from_file_location("audit_tutoriel", CHEMIN)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

Q = "'"
LF = chr(10)

CAS = [
    ("trois cibles simples",
     "'#a', '#b', '#c'", 3),
    ("un repli imbrique compte pour UN element",
     "'#a', ['#b', '#c'], '#d'", 3),
    ("virgule dans un commentaire de ligne",
     "'#a'," + LF + "// Sans lui, on designe autre chose" + LF + "'#b'", 2),
    ("apostrophe francaise dans un commentaire",
     "'#a'," + LF + "// le bandeau n'existe que s'il y a un match" + LF + "'#b', '#c'", 3),
    ("commentaire de bloc bourre de virgules",
     "'#a', /* un, deux, trois */ '#b'", 2),
    ("null compte comme un element",
     "'#a', null, '#b'", 3),
]


def main():
    ok = True
    for nom, corps, attendu in CAS:
        obtenu = audit.compte_elements(corps, Q)
        if obtenu != attendu:
            ok = False
        print("  %-5s %-44s attendu %d, obtenu %d"
              % ("ok" if obtenu == attendu else "ECHEC", nom, attendu, obtenu))

    # Et surtout : il doit continuer a voir un vrai decalage.
    conseils = audit.compte_elements("'un', 'deux', 'trois'", Q)
    cibles = audit.compte_elements("'#a', '#b'", Q)
    vu = conseils != cibles
    if not vu:
        ok = False
    print()
    print("  %-5s un vrai decalage (3 conseils, 2 cibles) est toujours vu"
          % ("ok" if vu else "ECHEC"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
