# -*- coding: utf-8 -*-
"""Sauvegarde de la base et des fichiers du club, sur ce disque.

POURQUOI CE FICHIER EXISTE
--------------------------
L'audit de sécurité du 17 septembre 2026 a relevé deux choses.

La première : rien dans le dépôt ne parlait de sauvegarde. Supabase en
fait une par jour selon le forfait, et la restauration à un instant
donné (PITR) est une option payante. Une sauvegarde qu'on n'a jamais
restaurée n'est pas une sauvegarde prouvée.

La seconde, et c'est celle qu'on oublie : **les sauvegardes de base de
données ne couvrent pas le stockage**. Les photos de site-media et les
documents de dossiers-prives n'en font pas partie. Une suppression
accidentelle de bucket est définitive.

Ce script règle la seconde et double la première.

CE QU'IL FAIT, ET CE QU'IL NE FAIT PAS
--------------------------------------
Il fait :
  - une copie de chaque table, en JSON, une ligne par enregistrement ;
  - une copie de chaque fichier des trois buckets ;
  - un relevé (releve.json) qui dit combien de lignes et combien de
    fichiers, pour qu'on voie tout de suite si une sauvegarde est
    anormalement maigre.

Il ne fait pas de `pg_dump` : cela demanderait les outils clients
PostgreSQL installés sur la machine et le mot de passe de la base. Le
SCHÉMA (les tables, les vues, les politiques) vit déjà dans sql/ et dans
git ; ce script sauvegarde les DONNÉES, qui n'y sont pas. Les deux
ensemble font une restauration complète.

LA CLÉ DE SERVICE NE VIT PAS DANS CE FICHIER
--------------------------------------------
Elle passe par une variable d'environnement, et elle n'est jamais
écrite sur le disque. Qui la lit prend le contrôle du projet entier :
elle ne doit figurer ni ici, ni dans le dépôt, ni dans un raccourci.

Sous PowerShell, à taper à chaque session (le « $env: » ne survit pas à
la fermeture de la fenêtre, et c'est très bien ainsi) :

    $env:BBC_SERVICE_KEY = "<la cle service_role du projet>"
    python outils/sauvegarde.py

La clé se lit dans Supabase : Project Settings › API › service_role.

OÙ ÇA ATTERRIT
--------------
Par défaut, dans un dossier « sauvegardes-baobabs » À CÔTÉ du dépôt,
jamais dedans : une sauvegarde qui part sur GitHub est une fuite, et
le dépôt est public. Pour choisir un autre endroit, par exemple un
disque externe :

    python outils/sauvegarde.py H:/sauvegardes-baobabs

CE QU'IL RESTE À FAIRE À LA MAIN, UNE FOIS
------------------------------------------
Restaurer une sauvegarde sur un projet Supabase d'essai. C'est le seul
moyen de savoir qu'elle marche. Tant que ce n'est pas fait, on a des
fichiers, pas une restauration.
"""
import json, os, sys, io, time, urllib.request, urllib.error, urllib.parse

URL = "https://lmwbwasupqkvswukieav.supabase.co"

# LES TABLES, NOMMÉES UNE PAR UNE.
#
# Pas de découverte automatique : PostgREST ne sait pas lister les
# tables, et une liste devinée se périme en silence. Celle-ci est relevée
# dans sql/ le 17 septembre 2026. Quand une table nouvelle apparaît,
# elle s'ajoute ici — et le relevé dira « 0 ligne » pour celle qui aurait
# disparu, ce qui est le signal qu'on veut.
TABLES = [
    # le sportif
    "matches", "match_results", "match_stats", "match_events", "match_live",
    "standings", "saisons", "adversaires", "lineups",
    # l'effectif et l'encadrement
    "players", "staff", "org_roles",
    # l'ecole de basket : ce qu'il y a de plus sensible
    "academy_registrations", "academy_payments", "academy_documents",
    "academy_events", "academy_seances",
    # le recrutement
    "recruitment_requests", "recruitment_events", "recruitment_documents",
    "collecte_campagnes",
    # la boutique et la billetterie
    "products", "product_stock", "orders", "promo_codes",
    "ticket_offers", "reservations", "caisse_mouvements",
    # les comptes
    "customers", "admin_users", "admin_roles", "role_permissions",
    # le site public
    "news", "news_categories", "announcements", "banners", "partners",
    "gallery", "timeline_events", "evenements", "publications",
    "site_settings", "club_listes", "favorites",
    # les messages
    "contact_messages", "newsletter_subscribers", "newsletter_sends",
    # le greffe et le studio
    "greffe_actes", "greffe_dossiers", "greffe_prereglages", "studio_projets",
    # le journal
    "admin_audit_log",
]

BUCKETS = ["site-media", "recruitment-photos", "dossiers-prives"]

PAGE = 1000          # PostgREST plafonne les reponses : on pagine
PAUSE = 0.05         # une respiration entre deux appels


def cle():
    k = os.environ.get("BBC_SERVICE_KEY", "").strip()
    if not k:
        sys.exit(
            "BBC_SERVICE_KEY n'est pas dans l'environnement.\n\n"
            "Sous PowerShell :\n"
            '  $env:BBC_SERVICE_KEY = "<la cle service_role>"\n'
            "  python outils/sauvegarde.py\n\n"
            "Elle se lit dans Supabase : Project Settings > API > service_role.\n"
            "Ne l'ecrivez dans aucun fichier : le depot est public."
        )
    return k


def appel(chemin, k, brut=False):
    req = urllib.request.Request(
        URL + chemin,
        headers={"apikey": k, "Authorization": "Bearer " + k},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    return data if brut else json.loads(data.decode("utf-8"))


def table(nom, k, dossier):
    """Une table, paginee, en JSON. Rend le nombre de lignes."""
    lignes, depart = [], 0
    while True:
        try:
            lot = appel(
                "/rest/v1/%s?select=*&order=1&limit=%d&offset=%d"
                % (urllib.parse.quote(nom), PAGE, depart), k)
        except urllib.error.HTTPError as e:
            if e.code in (404, 400):
                return None            # table absente : on le dira dans le releve
            raise
        if not isinstance(lot, list):
            return None
        lignes.extend(lot)
        if len(lot) < PAGE:
            break
        depart += PAGE
        time.sleep(PAUSE)

    with io.open(os.path.join(dossier, nom + ".json"), "w", encoding="utf-8") as f:
        json.dump(lignes, f, ensure_ascii=False, indent=1)
    return len(lignes)


def bucket(nom, k, dossier):
    """Tous les fichiers d'un bucket, y compris ceux des sous-dossiers."""
    racine = os.path.join(dossier, nom)
    n, octets = 0, 0
    a_voir = [""]

    while a_voir:
        prefixe = a_voir.pop()
        corps = json.dumps({
            "prefix": prefixe, "limit": 1000, "offset": 0,
            "sortBy": {"column": "name", "order": "asc"},
        }).encode("utf-8")
        req = urllib.request.Request(
            URL + "/storage/v1/object/list/" + urllib.parse.quote(nom),
            data=corps,
            headers={"apikey": k, "Authorization": "Bearer " + k,
                     "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                entrees = json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            print("    bucket %s : refuse (%s)" % (nom, e.code))
            return None, 0

        for e in entrees:
            chemin = (prefixe + "/" + e["name"]).lstrip("/")
            # Un dossier n'a pas de metadonnees : c'est comme ca que
            # l'API Storage les distingue d'un fichier.
            if e.get("id") is None and not e.get("metadata"):
                a_voir.append(chemin)
                continue
            cible = os.path.join(racine, *chemin.split("/"))
            if not os.path.isdir(os.path.dirname(cible)):
                os.makedirs(os.path.dirname(cible))
            if os.path.exists(cible):
                n += 1
                octets += os.path.getsize(cible)
                continue                      # deja la : on ne retelecharge pas
            try:
                data = appel("/storage/v1/object/%s/%s"
                             % (urllib.parse.quote(nom),
                                urllib.parse.quote(chemin)), k, brut=True)
            except urllib.error.HTTPError as err:
                print("    %s : %s" % (chemin, err.code))
                continue
            with open(cible, "wb") as f:
                f.write(data)
            n += 1
            octets += len(data)
            time.sleep(PAUSE)

    return n, octets


def poids(o):
    for u in ("o", "Ko", "Mo", "Go"):
        if o < 1024:
            return "%.0f %s" % (o, u)
        o /= 1024.0
    return "%.1f To" % o


def main():
    k = cle()

    # HORS DU DEPOT, TOUJOURS. Une sauvegarde qui part sur GitHub est une
    # fuite, et ce depot est public.
    if len(sys.argv) > 1:
        base = sys.argv[1]
    else:
        base = os.path.join(os.path.dirname(os.path.abspath(
            os.path.join(os.path.dirname(__file__), ".."))), "sauvegardes-baobabs")

    jour = time.strftime("%Y-%m-%d-%Hh%M")
    dossier = os.path.join(base, jour)
    tables_d = os.path.join(dossier, "base")
    for d in (dossier, tables_d):
        if not os.path.isdir(d):
            os.makedirs(d)

    print("Sauvegarde dans %s\n" % dossier)

    releve = {"le": jour, "tables": {}, "buckets": {}, "absentes": []}

    print("  LA BASE")
    for t in TABLES:
        n = table(t, k, tables_d)
        if n is None:
            releve["absentes"].append(t)
            print("    %-26s absente" % t)
        else:
            releve["tables"][t] = n
            print("    %-26s %6d lignes" % (t, n))
        time.sleep(PAUSE)

    print("\n  LES FICHIERS")
    for b in BUCKETS:
        n, o = bucket(b, k, dossier)
        if n is None:
            continue
        releve["buckets"][b] = {"fichiers": n, "octets": o}
        print("    %-22s %5d fichiers  %s" % (b, n, poids(o)))

    with io.open(os.path.join(dossier, "releve.json"), "w", encoding="utf-8") as f:
        json.dump(releve, f, ensure_ascii=False, indent=1)

    total_l = sum(releve["tables"].values())
    total_f = sum(v["fichiers"] for v in releve["buckets"].values())
    print("\n%d lignes, %d fichiers." % (total_l, total_f))
    if releve["absentes"]:
        print("Tables absentes (a retirer de TABLES, ou renommees) : %s"
              % ", ".join(releve["absentes"]))
    print("\nComparez releve.json avec celui de la sauvegarde precedente.")
    print("Une table qui perd des lignes d'une fois sur l'autre est le")
    print("signal qui compte -- plus que la reussite du script lui-meme.")


if __name__ == "__main__":
    main()
