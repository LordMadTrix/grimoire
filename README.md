<div align="center">
  <img src="public/favicon.svg" alt="Grimoire Logo" width="120" />
  <h1>Grimoire TTRPG</h1>
  <p><strong>L'outil ultime pour les Maîtres du Jeu : Éditeur Markdown + VTT + IA Locale</strong></p>

  <p>
    <a href="#features">Fonctionnalités</a> •
    <a href="#installation">Installation</a> •
    <a href="#architecture">Architecture</a>
  </p>
</div>

---

## 🐉 Qu'est-ce que Grimoire ?

**Grimoire** est une application Desktop conçue par et pour les Maîtres du Jeu (TTRPG). Elle rassemble en une seule interface tout ce dont vous avez besoin pour gérer vos campagnes, de la préparation jusqu'au déroulement de la partie.

Oubliez la multiplication des onglets et des applications : Grimoire combine un gestionnaire de notes Obsidian-like, une table virtuelle (VTT) hautement performante, et l'intelligence artificielle locale pour booster votre créativité.

## ✨ Fonctionnalités Principales

### 📝 Éditeur Markdown Intelligent
- **WikiLinks (`[[Lien]]`)** : Liez vos PNJ, lieux et objets magiques avec autocomplétion intelligente.
- **Rétroliens (Backlinks)** : Ne perdez jamais le fil de vos intrigues.
- **Auto-Sauvegarde & FTS5** : Sauvegarde automatique et recherche Full-Text ultra-rapide (propulsée par SQLite).

### 🗺️ Virtual TableTop (VTT) Intégré
- **Double Fenêtre** : Une vue de contrôle pour le MJ et une vue "Joueur" en plein écran synchronisée.
- **Brouillard de Guerre Dynamique** : Cachez les zones inexplorées et gérez la vision des pions.
- **Images de Tokens** : Support des images personnalisées (PNG/JPG) avec masquage circulaire automatique.
- **Ambiance Sonore** : Diffusez des pistes audio du Vault (MP3/OGG) synchronisées entre le MJ et les joueurs avec contrôle du volume.
- **Gestion des Pions (Tokens)** : Points de vie, vision, et tracker d'initiative intégré.

### 🕸️ Visualisation & IA
- **Graphe de Liens** : Visualisez les connexions entre vos notes sous forme de graphe interactif (Obsidian-like) pour naviguer dans votre lore.
- **L'Écrivain Fantôme (IA Locale)** : Génération de texte via Ollama (Llama, Mistral...) 100% locale et privée.
- **Base d'Assets Massive** : Livré avec des centaines de tokens (Caeora, Forgotten Adventures) et de maps prêtes à l'emploi.

## 🚀 Installation & Développement

Grimoire utilise une architecture moderne et ultra-rapide : **SvelteKit (Svelte 5) + Tauri v2 + Rust + PixiJS v8**.

### Prérequis
- Node.js (v18+)
- Rust (cargo)
- Ollama (optionnel, pour l'IA)

### Lancer le projet

```bash
# Installer les dépendances
npm install

# Lancer en mode développement (Tauri + Svelte)
npm run tauri dev
```

## 🛠️ Architecture

- **Frontend** : L'interface est développée en Svelte 5 avec l'utilisation des Runes (`$state`, `$derived`) pour une réactivité chirurgicale. Le VTT est propulsé par PixiJS v8 via `MapCanvas.svelte`.
- **Backend Desktop** : Rust est utilisé via Tauri pour les opérations lourdes (Système de fichiers, Base de données SQLite FTS5, Appels à Ollama).

## 🤝 Contribution

Si vous souhaitez reprendre le développement, veuillez consulter le fichier `CLAUDE_HANDOVER.md` à la racine pour un résumé exhaustif de l'architecture technique et des règles métier.

---
*Créé avec passion pour les rôlistes.*
