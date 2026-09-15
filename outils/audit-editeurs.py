# -*- coding: utf-8 -*-
"""Un editeur est-il complet ?

    python outils/audit-editeurs.py

Question posee : pour chaque table que l'administration laisse modifier,
quelles colonnes existent en base sans etre editables nulle part ?

On ne devine pas le schema : il est reconstruit depuis les migrations du
depot (`create table` et `alter table ... add column`), qui sont ce qui a
ete joue sur la base. Cote administration, on releve les CINQ facons de
nommer une colonne, parce que l'admin les emploie toutes les cinq :

  1. l'editeur generique     {name:'colonne', type:'text', ...}
  2. les charges utiles      { colonne: valeur } passe a sbInsert/sbUpdate
  3. les lectures            select=a,b,c et order=colonne.asc
  4. les chaines             'colonne' citee telle quelle
  5. l'acces par propriete   r.colonne

Il a fallu les cinq. Avec les trois premieres seulement, l'outil
signalait onze colonnes d'Inscriptions « jamais nommees » alors que
l'ecran les lit toutes -- elles ne sont simplement jamais ecrites entre
guillemets. Avec l'ancre en debut de ligne sur la deuxieme, il ratait
`sort_order` et `ouverte_le`, ecrites au milieu d'une charge utile sur
une seule ligne. Un outil qui crie au loup ne sert a rien : chaque faux
positif a ete corrige a la source, pas masque.

Toutes les colonnes signalees ne sont pas des oublis : `id`,
`created_at` et consorts n'ont rien a faire dans un formulaire. La liste
IGNOREES les met de cote, avec la raison quand elle n'est pas evidente.

Le compte n'est pas une note : c'est une liste a regarder.

Etat au 15 septembre 2026 : 19 tables, 0 colonne a regarder.
"""
from __future__ import print_function

import io
import os
import re
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ADMIN = os.path.join(RACINE, 'admin-matchs.html')
MIGRATIONS = os.path.join(RACINE, 'sql', 'migrations')

# Ce qui n'a rien a faire dans un formulaire : la base s'en occupe.
IGNOREES = set("""
id created_at updated_at modifie_le cree_le author auteur
stock_applique sort_key search_vector
remaining
""".split())
# `remaining` (ticket_offers) merite son mot : elle a ete ajoutee par deux
# migrations, n'a JAMAIS ete lue ni ecrite par personne, et le reste de
# places se calcule pour de vrai dans la vue match_center
# (`greatest(quota - sold, 0)`). Lui inventer un champ serait creer une
# seconde verite ; la retirer de la base est un risque sans gain. On la
# laisse dormir, en sachant pourquoi.
IGNORE_MOTIFS = [
    re.compile(r'_x$'), re.compile(r'_y$'), re.compile(r'_zoom$'),   # le cadrage, pose par l'atelier
]

# Les tables qu'une personne modifie depuis l'administration. Les tables
# de jointure, de journal et de mesure n'ont pas d'editeur et n'en
# veulent pas.
TABLES = """
teams players matches news news_categories products standings staff
partners org_roles gallery banners announcements evenements promo_codes
ticket_offers saisons academy_registrations academy_sessions
""".split()


def colonnes_des_migrations():
    """Reconstruit table -> colonnes depuis les migrations."""
    tables = {}
    if not os.path.isdir(MIGRATIONS):
        return tables
    for nom in sorted(os.listdir(MIGRATIONS)):
        if not nom.endswith('.sql'):
            continue
        sql = io.open(os.path.join(MIGRATIONS, nom), encoding='utf-8', errors='replace').read()
        sql = re.sub(r'--[^\n]*', '', sql)          # les commentaires mentionnent des colonnes

        # create table [if not exists] [public.]nom ( ... )
        for m in re.finditer(r'create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)\s*\(', sql, re.I):
            t = m.group(1)
            i = m.end() - 1
            prof = 0
            j = i
            while j < len(sql):
                if sql[j] == '(':
                    prof += 1
                elif sql[j] == ')':
                    prof -= 1
                    if prof == 0:
                        break
                j += 1
            corps = sql[i + 1:j]
            for ligne in corps.split(','):
                ligne = ligne.strip()
                mm = re.match(r'^(\w+)\s+(text|uuid|integer|int|boolean|bool|timestamptz|date|numeric|jsonb|bigint|serial|smallint|real|time)\b',
                              ligne, re.I)
                if mm:
                    tables.setdefault(t, set()).add(mm.group(1))

        # alter table [public.]nom add column [if not exists] col type
        for m in re.finditer(r'alter\s+table\s+(?:public\.)?(\w+)(.*?);', sql, re.I | re.S):
            t, reste = m.group(1), m.group(2)
            for mm in re.finditer(r'add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)', reste, re.I):
                tables.setdefault(t, set()).add(mm.group(1))
    return tables


def champs_de_l_admin():
    """Tout ce que l'administration nomme : champs declares, charges utiles, identifiants."""
    s = io.open(ADMIN, encoding='utf-8', errors='replace').read()
    noms = set()
    # 1) l'editeur generique : {name:'colonne', ...}
    noms.update(re.findall(r"\{\s*name\s*:\s*'([A-Za-z_][\w]*)'", s))
    # 2) les charges utiles : `colonne:` N'IMPORTE OU, pas seulement en
    #    debut de ligne. Les charges utiles de l'admin tiennent souvent
    #    sur une seule ligne -- `{match_id:..., category:..., quota:...}`
    #    -- et l'ancre ^ ne voyait alors que la premiere colonne. C'est
    #    ce qui faisait signaler `sort_order` et `ouverte_le` comme
    #    jamais nommees alors que les deux sont bel et bien ecrites.
    noms.update(re.findall(r"[{,\s]([a-z_][a-z_0-9]*)\s*:\s*", s))
    # 3) les selects et les tris : select=a,b,c et order=colonne.asc
    for m in re.finditer(r"select=([a-z_0-9,\.\*\(\)]+)", s):
        for c in m.group(1).split(','):
            c = c.strip()
            if re.match(r'^[a-z_][a-z_0-9]*$', c):
                noms.add(c)
    noms.update(re.findall(r"\b([a-z_][a-z_0-9]*)\.(?:asc|desc)\b", s))
    # 4) les colonnes citees telles quelles dans une chaine
    noms.update(re.findall(r"['\"]([a-z_][a-z_0-9]{2,})['\"]", s))
    # 5) l'acces par propriete : r.birth_date, m.free_entry, cur.notes...
    #    Sans ce releve, l'audit signalait onze colonnes d'inscriptions
    #    « jamais nommees » alors que l'ecran les lit toutes : elles ne
    #    sont simplement jamais ecrites entre guillemets.
    noms.update(re.findall(r"\.([a-z_][a-z_0-9]{2,})\b", s))
    return noms


def ignorer(col):
    if col in IGNOREES:
        return True
    return any(p.search(col) for p in IGNORE_MOTIFS)


def main():
    schema = colonnes_des_migrations()
    connus = champs_de_l_admin()
    if not schema:
        print('Aucune migration lue : rien a comparer.')
        return 1

    total_absentes = 0
    print('AUDIT DES EDITEURS')
    print('Colonnes presentes en base et jamais nommees par l administration.')
    print('')
    for t in TABLES:
        cols = schema.get(t)
        if not cols:
            continue
        absentes = sorted(c for c in cols if not ignorer(c) and c not in connus)
        etat = 'complet' if not absentes else ('%d colonne%s jamais nommee%s' %
               (len(absentes), 's' if len(absentes) > 1 else '', 's' if len(absentes) > 1 else ''))
        print('  %-24s %2d colonnes  %s' % (t, len(cols), etat))
        if absentes:
            print('        ' + ', '.join(absentes))
        total_absentes += len(absentes)

    print('')
    print('%d colonne(s) a regarder.' % total_absentes)
    print('Une colonne signalee n est pas forcement un oubli : elle peut etre')
    print('remplie par un declencheur ou par le site. Elle demande un coup d oeil.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
