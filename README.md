# 🪶 Plumier

Logiciel d'écriture et de planification de romans, pour Windows. Local, gratuit, sans abonnement.

## Fonctionnalités (v0.1)
- **Classeur** en arbre (dossiers / scènes), glisser-déposer, renommage.
- **Éditeur** riche (gras, italique, titres, citations, listes, séparateur de scène), sauvegarde automatique, mode Focus (F11).
- **Planification** : tableau de liège (cartes + résumé + statut), plan en tableau, onglet **Fiches** (personnages, lieux, univers…).
- **Objectifs** de mots (jour / livre), compteurs par scène et par dossier.
- **Instantanés** (versions) par scène, avec restauration.
- **Recherche** dans tout le projet (Ctrl+Maj+F).
- **Export** DOCX, EPUB, ODT, HTML, Markdown (via [Pandoc](https://pandoc.org/installing.html), à installer séparément).

## Format des projets
Un projet est un dossier lisible partout :
```
MonLivre/
  plumier.json            structure, résumés, statuts, objectifs
  content/<id>.md         texte de chaque scène / fiche (Markdown)
  snapshots/<id>/*.md     versions sauvegardées
```

## Développement
```bash
npm install
npm run dev          # version navigateur (stockage localStorage, pour tester l'interface)
npm run tauri dev    # application de bureau (nécessite Rust, + WebView2 sous Windows)
npm run tauri build  # installeur Windows (.exe NSIS)
```
Sans machine de build Windows : lancer le workflow GitHub Actions « Build Windows » (`.github/workflows/build-windows.yml`).
