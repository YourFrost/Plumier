# 🪶 Plumier

Logiciel d'écriture et de planification de romans, pour Windows. Local, gratuit, sans abonnement, **sans IA**.

## Écrire
- Éditeur riche (gras, italique, titres, citations, listes, séparateur de scène), sauvegarde automatique, mode Focus (F11) et **mode machine à écrire**.
- **Onglets** et **vue scindée** : deux scènes (ou une scène et une fiche) côte à côte.
- **Notes de bas de page** et **commentaires** de relecture (jamais exportés).
- **@** dans le texte : propose les fiches (personnages, lieux…) et insère leur nom.
- **Typographie française** à la frappe (« », espaces insécables, …, ’).
- **Correction** grammaire/orthographe via [LanguageTool](https://languagetool.org) (serveur local conseillé), dictionnaire personnel.
- **Vérification des répétitions** : mots répétés à courte distance (surlignés dans le texte), débuts de phrases identiques, mots les plus employés, adverbes en -ment.
- Instantanés (versions) par scène, avec restauration.

## Planifier
- Classeur en arbre (dossiers / scènes) avec glisser-déposer ; onglet **Fiches** (personnages, lieux, univers…).
- **Tableau de liège**, **Plan** en tableau, **Chronologie** (ordre chronologique ou ordre du livre, retours en arrière signalés).
- **Modèles de structure** : schéma narratif, trois actes, voyage du héros, Save the Cat, sept points, roman policier.
- **Étiquettes** colorées, **point de vue** et **objectif de mots** par scène.
- **Fiches à champs** (Âge, Origine…) avec modèles par catégorie, et **relations** entre fiches.
- **Présence** : tableau personnages × scènes, calculé automatiquement depuis le texte (nom + alias).
- **Relations** : graphe des liens entre personnages (alliés, ennemis, famille…).
- **Statistiques** : mots par jour, série, session, projection vers la date limite, mots par point de vue, **santé du manuscrit** (scènes vides, fiches jamais citées, scènes sans résumé…).

## Importer / exporter
- **Import** de `.docx` (titres → scènes, notes de bas de page conservées) et `.md`/`.txt`, sans Pandoc.
- **Export PDF** mis en page comme un livre (formats poche/A5/A4…, page de titre, numéros de page, chapitres sur nouvelle page, césure, notes en fin de chapitre), aperçu puis « Enregistrer au format PDF ».
- Export DOCX, EPUB, ODT, HTML, Markdown via [Pandoc](https://pandoc.org/installing.html) (à installer séparément ; notes de bas de page converties en vraies notes).

## Sécurité des données
- Projet = dossier de fichiers Markdown lisibles partout.
- **Sauvegarde automatique programmable** : archive .zip datée dans le dossier de ton choix (fréquence, nombre d'archives conservées), uniquement si le projet a changé.
- **Mises à jour automatiques** (versions signées publiées sur GitHub Releases, voir [docs/RELEASING.md](docs/RELEASING.md)).

## Confort
- **Palette de commandes** (Ctrl+K) et ouverture rapide (Ctrl+P). Tous les **raccourcis sont personnalisables** (Réglages › Raccourcis).
- Six thèmes (Parchemin, Pétale, Marine, Forêt, Dark academia, Nuit), police, taille, interligne et largeur de page réglables.
- Barre d'état : mots de la scène et objectif, session (mots et durée), série de jours.

### Raccourcis par défaut
| Action | Raccourci | Action | Raccourci |
|---|---|---|---|
| Palette de commandes | Ctrl+K | Ouvrir une scène/fiche | Ctrl+P |
| Rechercher | Ctrl+Maj+F | Nouvelle scène | Ctrl+N |
| Enregistrer | Ctrl+S | Instantané | Ctrl+Maj+S |
| Scène suivante / précédente | Alt+↓ / Alt+↑ | Vues | Ctrl+1 … Ctrl+7 |
| Scinder les volets | Ctrl+Alt+D | Changer de volet | Ctrl+Alt+→ |
| Correction / Répétitions / Notes | F7 / F8 / F9 | Note de bas de page | Ctrl+Alt+F |
| Commentaire | Ctrl+Alt+M | Machine à écrire | Ctrl+Alt+T |
| Mode focus | F11 | Exporter / Importer | Ctrl+E / Ctrl+Maj+O |
| Réglages | Ctrl+, | Sauvegarde immédiate | Ctrl+Alt+S |

## Format des projets
```
MonLivre/
  plumier.json            structure, résumés, statuts, étiquettes, relations, objectifs
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
Sans machine de build Windows : workflow GitHub Actions « Build Windows » (manuel) ou « Release Windows » (étiquette `v*`, avec mises à jour automatiques).

Les icônes proviennent de `branding/icon.svg` (`npx tauri icon branding/icon-1024.png`).
