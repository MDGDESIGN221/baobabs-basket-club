# -*- coding: utf-8 -*-
"""Inventaire du dossier /media, pour la médiathèque de l'administration.

POURQUOI CE FICHIER EXISTE
--------------------------
Vercel ne sait pas lister un dossier : une page ne peut pas demander
« qu'y a-t-il dans /media ? ». L'administration ne pouvait donc montrer
que ce qu'on lui avait recopié à la main — et ce qu'on recopie à la main
se périme en silence. Sur 111 fichiers du dossier, 76 n'étaient visibles
nulle part.

On écrit donc l'inventaire dans un fichier que la page peut lire.

QUAND LE RELANCER
-----------------
Après avoir ajouté ou retiré des fichiers dans media/ :

    python outils-inventaire-media.py

Puis committer media/index.json avec les images.
"""
import json, os, io, sys, hashlib

RACINE = "media"
SORTIE = os.path.join(RACINE, "index.json")
IMAGES = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif")
VIDEOS = (".mp4", ".webm", ".mov", ".m4v")


def inventorier():
    lignes = []
    for dossier, _, fichiers in os.walk(RACINE):
        for f in sorted(fichiers):
            if f == "index.json":
                continue
            ext = os.path.splitext(f)[1].lower()
            if ext not in IMAGES + VIDEOS:
                continue
            chemin = os.path.join(dossier, f).replace(os.sep, "/")
            lignes.append({
                "chemin": "/" + chemin,
                "nom": f,
                "dossier": dossier.replace(os.sep, "/"),
                "type": "video" if ext in VIDEOS else "image",
                "octets": os.path.getsize(chemin),
            })
    return sorted(lignes, key=lambda x: (x["dossier"], x["nom"].lower()))


def main():
    if not os.path.isdir(RACINE):
        print("Dossier %s introuvable — lancez le script à la racine du dépôt." % RACINE)
        return 1
    fichiers = inventorier()
    doc = {
        "_lisez_moi": "Genere par outils-inventaire-media.py. Ne pas editer a la main.",
        "total": len(fichiers),
        "octets": sum(f["octets"] for f in fichiers),
        "fichiers": fichiers,
    }
    texte = json.dumps(doc, ensure_ascii=False, indent=1)

    # On n'écrit que si le contenu change : sinon chaque exécution
    # produirait un commit vide.
    ancien = ""
    if os.path.exists(SORTIE):
        ancien = io.open(SORTIE, encoding="utf-8").read()
    if ancien == texte:
        print("%d fichiers, %.1f Mo — inventaire déjà à jour."
              % (doc["total"], doc["octets"] / 1048576))
        return 0

    io.open(SORTIE, "w", encoding="utf-8").write(texte)
    par_dossier = {}
    for f in fichiers:
        par_dossier[f["dossier"]] = par_dossier.get(f["dossier"], 0) + 1
    print("%s écrit — %d fichiers, %.1f Mo"
          % (SORTIE, doc["total"], doc["octets"] / 1048576))
    for d in sorted(par_dossier):
        print("   %-16s %3d" % (d, par_dossier[d]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
