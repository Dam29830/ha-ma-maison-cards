#!/usr/bin/env python3
"""Construit dist/ma-maison-agenda.js, le fichier installé par HACS.

Il réunit :
  - src/cartes-agenda.js  : les cartes Agenda et Rappels ;
  - src/carte-colis.js    : la carte Colis (suivi des colis Amazon) ;
  - src/strategie.js      : la stratégie « Ma Maison » qui génère tout le tableau ;
  - les trois tableaux du dossier dashboard/ (ordinateur, iPhone, iPad), compressés.

À relancer après chaque modification d'un tableau ou du code :
    python3 outils/construire.py
"""
import base64
import gzip
import json
import pathlib
import re
import sys

import yaml

RACINE = pathlib.Path(__file__).resolve().parent.parent
SORTIE = RACINE / "dist" / "ma-maison-agenda.js"
TABLEAUX = {
    "ordinateur": "dashboard/ma-maison.yaml",
    "iphone": "dashboard/ma-maison-iphone.yaml",
    "ipad": "dashboard/ma-maison-ipad.yaml",
}
# Les longues chaînes (gabarits JavaScript, CSS) sont stockées une seule fois.
LONGUEUR_MIN = 40
MARQUEUR = "§"


def compacter(donnees):
    table, index = [], {}

    def interner(o):
        if isinstance(o, dict):
            return {k: interner(v) for k, v in o.items()}
        if isinstance(o, list):
            return [interner(v) for v in o]
        if isinstance(o, str) and len(o) >= LONGUEUR_MIN:
            if o not in index:
                index[o] = len(table)
                table.append(o)
            return {MARQUEUR: index[o]}
        return o

    return {"s": table, "t": interner(donnees)}


def verifier(donnees):
    for nom, tableau in donnees.items():
        if not isinstance(tableau, dict) or not tableau.get("views"):
            sys.exit(f"Tableau « {nom} » vide ou illisible")
        texte = json.dumps(tableau, ensure_ascii=False)
        if '"' + MARQUEUR + '"' in texte:
            sys.exit(f"Le tableau « {nom} » contient déjà la clé réservée {MARQUEUR!r}")


def main():
    donnees = {}
    for nom, chemin in TABLEAUX.items():
        with open(RACINE / chemin, encoding="utf-8") as fh:
            donnees[nom] = yaml.safe_load(fh)
    verifier(donnees)

    brut = json.dumps(compacter(donnees), ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    # mtime=0 : même contenu → même fichier (pas de changement inutile dans git).
    compresse = gzip.compress(brut, compresslevel=9, mtime=0)
    b64 = base64.b64encode(compresse).decode("ascii")

    agenda = (RACINE / "src" / "cartes-agenda.js").read_text(encoding="utf-8")
    colis = (RACINE / "src" / "carte-colis.js").read_text(encoding="utf-8")
    strategie = (RACINE / "src" / "strategie.js").read_text(encoding="utf-8")
    version = re.search(r'const VERSION = "([^"]+)"', agenda)
    version = version.group(1) if version else "dev"
    for repere in ("__DONNEES__", "__VERSION__"):
        if strategie.count(repere) != 1:
            sys.exit(f"Repère {repere} introuvable ou en double dans src/strategie.js")
    strategie = strategie.replace('"__DONNEES__"', json.dumps(b64)).replace('"__VERSION__"', json.dumps(version))

    entete = (
        "// Ma Maison — cartes animées et tableau de bord pour Home Assistant\n"
        "// https://github.com/Dam29830/ha-ma-maison-cards\n"
        "//\n"
        "// Fichier construit par outils/construire.py : ne pas modifier à la main.\n"
        "// Sources : src/cartes-agenda.js, src/carte-colis.js, src/strategie.js et le dossier dashboard/.\n\n"
    )
    SORTIE.parent.mkdir(exist_ok=True)
    SORTIE.write_text(
        entete + agenda.rstrip() + "\n\n" + colis.rstrip() + "\n\n" + strategie.rstrip() + "\n", encoding="utf-8"
    )
    print(
        f"{SORTIE.relative_to(RACINE)} : {SORTIE.stat().st_size // 1024} Ko "
        f"(tableaux {len(brut) // 1024} Ko → {len(compresse) // 1024} Ko compressés), version {version}"
    )


if __name__ == "__main__":
    main()
