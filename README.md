# 🪶 Plumier

Logiciel d'écriture et de planification de romans, pour Windows. Local, gratuit, sans abonnement.

## Fonctionnalités (v0.1)
- **Classeur** en arbre (dossiers / scènes), glisser-déposer, renommage.
- **Éditeur** riche (gras, italique, titres, citations, listes, séparateur de scène), sauvegarde automatique, mode Focus (F11).
- **Planification** : tableau de liège (cartes + résumé + statut), plan en tableau, onglet **Fiches** (personnages, lieux, univers…).
- **Liens fiches ↔ scènes** détectés automatiquement (nom + alias) : « Apparaît dans » sur une fiche, « Présents dans la scène » sur une scène.
- **Chronologie** : date et moment de chaque scène, vue en ordre chronologique ou en ordre du livre (retours en arrière signalés).
- **Étiquettes colorées** (personnalisables) sur scènes et fiches, filtres dans le tableau et la chronologie.
- **Statistiques** : mots par jour (30 jours), série, moyenne, avancement par statut, mots par partie, projection vers la date limite.
- **Correction** : typographie française à la frappe (« », espaces insécables, …, ’) + grammaire/orthographe via [LanguageTool](https://languagetool.org) (serveur local conseillé : `java -cp languagetool-server.jar org.languagetool.server.HTTPServer --port 8081 --allow-origin "*"`), dictionnaire personnel par projet.
- **Objectifs** de mots (jour / livre / date limite), compteurs par scène et par dossier.
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
