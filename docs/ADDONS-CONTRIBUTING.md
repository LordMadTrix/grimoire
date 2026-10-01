# 📦 Guide de contribution — Catalogue d'addons

Ce document explique comment proposer votre pack pour le **Grimoire Addon Store**.

## Soumettre un addon (créateurs)

1. Ouvrez une issue avec le template **« 📦 Soumettre un addon »**.
2. Renseignez tous les champs : un **lien .zip direct et stable** (GitHub Releases recommandé) est requis.
3. Un mainteneur vérifie les droits, ajoute l'entrée à `docs/addons-catalog.json` et ouvre une PR.
4. Le CI valide automatiquement : champs, identifiant unique, liens vivants, cohérence des tailles.
5. Une fois la PR fusionnée, votre pack apparaît dans le store de tous les joueurs. 🎉

### Champs du catalogue (`docs/addons-catalog.json`)

| Champ | Type | Description |
|---|---|---|
| `id` | string | Slug kebab-case unique (ex: `mon-pack-cartes`) |
| `name` | string | Nom affiché, emoji bienvenu (ex: `🗺️ Mon Pack Cartes`) |
| `version` | string | Version semver du pack |
| `category` | string | `maps`, `tokens`, `audio`, `scenarios`, `other` |
| `description` | string | Description courte (affichée dans le store) |
| `author` | string | Créateur crédité |
| `thumbnail` | string | URL d'image d'illustration (optionnel) |
| `download_url` | string | URL .zip directe et stable |
| `size_bytes` | number | Taille du .zip en octets |
| `file_count` | number | Nombre de fichiers dans le pack |
| `destination` | string | Dossier d'installation : `maps`, `tokens`, `audio`, `scenarios`, `other` |
| `tags` | array | Mots-clés de recherche (optionnel) |

### Règles

- Vous devez **détenir les droits** sur les contenus proposés.
- Les contenus soumis à licence restrictive non-redistribuable seront refusés.
- Le lien doit rester accessible dans la durée (pas de lien éphémère).

## Validation locale (mainteneurs)

```bash
node scripts/validate-addons-catalog.cjs               # complet (réseau)
node scripts/validate-addons-catalog.cjs --skip-network # hors ligne (CI Air-gapped)
```

Le workflow **Validate Addons Catalog** rejoue ces vérifications sur chaque PR touchant le catalogue.
