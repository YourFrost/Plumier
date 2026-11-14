# Publier une version de Plumier (avec mise à jour automatique)

Plumier vérifie au démarrage s'il existe une version plus récente et propose de l'installer
(Réglages › Mises à jour). Pour que cela fonctionne, les versions doivent être **signées** et publiées
sur GitHub Releases. À faire une seule fois :

## 1. Créer la paire de clés de signature (sur ton PC)
```bash
npx tauri signer generate -w %USERPROFILE%\.tauri\plumier.key
```
La commande affiche une **clé publique** et crée la **clé privée** (`plumier.key`). Garde la clé privée
en lieu sûr : sans elle, plus aucune mise à jour ne pourra être publiée. Ne la commite jamais.

## 2. Ajouter trois secrets au dépôt GitHub
*Settings › Secrets and variables › Actions › New repository secret*

| Nom | Valeur |
|---|---|
| `TAURI_UPDATER_PUBKEY` | la clé publique affichée à l'étape 1 |
| `TAURI_SIGNING_PRIVATE_KEY` | le contenu du fichier `plumier.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | le mot de passe saisi à l'étape 1 (vide si aucun) |

## 3. Rendre les versions téléchargeables par l'application
L'application télécharge `latest.json` et l'installeur depuis les *Releases* du dépôt, **sans identifiant**.
Un dépôt **privé** ne le permet pas : il faut soit passer le dépôt en **public**, soit publier les
versions dans un autre dépôt public (et changer l'adresse `endpoints` dans
`src-tauri/tauri.release.conf.json`).

## 4. Publier
```bash
git tag v0.2.0
git push origin v0.2.0
```
Le workflow « Release Windows » compile, signe et publie l'installeur ainsi que `latest.json`.
Les Plumier installés proposeront alors la mise à jour au prochain démarrage.

> Les compilations manuelles (workflow « Build Windows ») restent possibles et fonctionnent sans clé :
> elles n'ont simplement pas de mise à jour automatique.
