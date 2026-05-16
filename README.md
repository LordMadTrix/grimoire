<div align="center">
  <img src="public/favicon.svg" alt="Grimoire Logo" width="120" />
  <h1>Grimoire TTRPG</h1>
  <p><strong>L'outil ultime pour les Maîtres du Jeu : Éditeur Markdown + VTT + IA Locale + HUB Mobile</strong></p>

  <img src="public/grimoire_hero.png" alt="Grimoire Immersive Suite" width="100%" style="border-radius: 12px; margin: 20px 0;" />

  <p>
    <a href="#features">Fonctionnalités</a> •
    <a href="#installation">Installation</a> •
    <a href="#mobile">Mobile HUB</a> •
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
- **Auto-Sauvegarde & FTS5** : Sauvegarde automatique et recherche Full-Text ultra-rapide.

### 🗺️ Virtual TableTop (VTT) "Immersive Suite" (Wave 13!)
- **Dynamic LOS (Line of Sight)** : Les murs et portes projettent des ombres portées en temps réel, bloquant la lumière des tokens.
- **Mode Blueprint** : Tracez vos murs et configurez des portes interactives que vous pouvez ouvrir/fermer d'un clic.
- **Zones Sonores Spatialisées** : Créez des régions où la musique d'ambiance s'adapte à la position des joueurs.
- **Animations & Particules** : Tokens animés (idle, attack, hit) et particules de sang pour un feedback viscéral.
- **Brouillard de Guerre Dynamique** : Cachez les zones inexplorées — les tokens sont automatiquement masqués côté joueur selon les zones révélées/cachées en temps réel.
- **Zones de Terrain** : Superposez des zones colorées sur la carte (terrain difficile, eau, feu, poison…) avec le mode 🗺️ glisser-déposer.
- **Log de Combat** : Historique typé (dégâts/soins/morts/tours) avec export presse-papiers.
- **Export PNG** : Exportez la carte actuelle en image haute résolution d'un clic (🖼️💾).
- **Chemin de Déplacement** : Ligne pointillée jaune + compteur de cases pendant le déplacement d'un token.

### 📱 HUB Mobile Joueur (Wave 9)
- **Compagnon Mobile** : Vos joueurs se connectent via un QR Code à un serveur local ultra-fluide.
- **Combat HUD** : Suivi des PV et boutons d'actions rapides (WFRP2) directement sur smartphone.
- **Sketchpad Collaboratif** : Les joueurs peuvent dessiner sur leur écran pour pointer un lieu ou expliquer un plan ; le dessin apparaît sur l'écran du MJ.
- **Soundboard Joueur** : Permettez à vos joueurs de déclencher des sons d'ambiance pour ponctuer leurs actions.

### 🎲 Outils MJ — Wave 10 + 13
- **ConditionWheel** : Clic droit sur un token → roue radiale SVG pour toggler 8 conditions + bouton 🗑️ suppression directe.
- **Calculateur de Dégâts** : Parseur de formules de dés (`2d6+4`), multi-cibles, demi-dégâts.
- **Notes Partagées** : Envoyez des notes GM aux joueurs en temps réel ; elles s'affichent comme un overlay dismissable sur l'écran joueur.
- **Générateurs** : Rencontre, Salle, Météo (planificateur 7 jours), Carte des Relations PNJ.
- **Suivi des Durées** : Présets d'effets (torche, concentration, poison), countdown par round avec alerte visuelle.
- **Butin Rapide** : Générez du butin aléatoire par niveau de richesse avec rareté pondérée.
- **Pack Mimic** : Une collection de jetons (tokens) illustrés pour Mimics (Coffre, Porte, Baril, Table) intégrée à la bibliothèque.
- **Bibliothèque d'Aventures** : Importez et gérez vos modules d'aventures PDF/Markdown avec indexation automatique.

### 🕸️ Visualisation & IA
- **Graphe de Liens** : Visualisez les connexions entre vos notes sous forme de graphe interactif.
- **L'Écrivain Fantôme (IA Locale)** : Génération de texte via Ollama (Llama, Mistral...) 100% locale et privée.

## 🚀 Installation & Développement

Grimoire utilise une architecture moderne et ultra-rapide : **SvelteKit (Svelte 5) + Tauri v2 + Rust + PixiJS v8**.

### Lancer le projet

```bash
# Installer les dépendances
npm install

# Lancer en mode développement (Tauri + Svelte)
npm run tauri dev
```

## 🛠️ Architecture

- **Frontend** : Svelte 5 (Runes) + PixiJS v8 pour le rendu haute performance.
- **Backend Desktop** : Rust (Tauri) pour les accès fichiers, SQLite FTS5 et WebSocket Mobile.
- **Mobile** : Serveur embarqué en Rust servant une web-app optimisée pour smartphones.

---
*Créé avec passion pour les rôlistes par LordMadTrix.*
