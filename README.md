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

## ✨ Fonctionnalités Exhaustives du Grimoire

### 1. 📝 Éditeur Markdown & Gestion de Notes (Style Obsidian)
- **Éditeur Markdown moderne (CodeMirror 6)** : Coloration syntaxique complète, formatage de texte, titres, listes, citations et tableaux.
- **WikiLinks interactifs (`[[Nom de Page]]`)** : Liez instantanément vos PNJ, lieux, factions et objets magiques avec autocomplétion intelligente.
- **Système de Rétroliens (Backlinks)** : Retrouvez en bas de chaque note toutes les autres pages du coffre qui la mentionnent.
- **Moteur de Recherche Instantané (SQLite FTS5)** : Palette de recherche globale (`Ctrl+K` ou `Ctrl+P`) avec recherche textuelle ultra-rapide et extraits en contexte.
- **Vue Graphique 2D Interactive (Graph View)** : Visualisation de l'univers sous forme de toile cosmique avec physique de répulsion des nœuds interconnectés.
- **Timeline & Calendrier Impérial** : Suivi des dates en jeu, avancement du temps (+1h, +1j), gestion des ères et saisons.
- **Gestionnaire de Coffre (Vault Explorer)** : Support de coffres multiples, dossiers, glisser-déposer, favoris et fichiers récents.

### 2. 🗺️ Virtual TableTop Haute Performance (PixiJS v8 VTT)
- **Moteur Graphique GPU 60+ FPS** : Rendu fluide des cartes géantes, textures et animations sans ralentissement.
- **Éclairage Dynamique & Scintillement de Torches (PixiJS v8)** : Ambiance Jour / Crépuscule / Nuit / Ténèbres avec projection d'ombres vectorielles, torches oscillantes et éclairs d'orage synchronisés.
- **Dynamic LOS (Line of Sight)** : Les murs et obstacles projettent des ombres portées en temps réel, bloquant physiquement la vision des tokens.
- **Brouillard de Guerre Intelligent (Fog of War)** : Révélation et masquage au pinceau circulaire ou rectangle de sélection, ou vision dynamique des pions.
- **Gestionnaire de Pions (Tokens)** : Import d'images, dimensionnement automatique sur la grille, PV/CA/Stats, conditions (roue radiale ConditionWheel), vision paramétrable, rotation et halos colorés.
- **Mode Blueprint & Portes Interactives** : Tracez vos murs et configurez des portes interactives que vous pouvez ouvrir/fermer d'un clic pour laisser passer la lumière.
- **Modèles de Sorts & Zones d'Effet (Spell Templates)** : Cercles, cônes orientables et lignes d'effet (Feu 🔥, Glace ❄️, Éclair ⚡, Poison 🧪, Silence 🔇, Divin ✨, Ténèbres 🌑).
- **Zones de Terrain Spéciales** : Délimitation de zones de terrain difficile 🏔️, eau 🌊, feu 🔥, poison 🧪 ou zone sûre ✅.
- **Épingles & Secrets du MJ (Map Pins)** : Épingles visibles uniquement par le MJ ou révélables aux joueurs d'un clic avec descriptions secrètes.
- **Météo Dynamique** : Pluie, Orage (avec éclairs synchronisés), Neige, Brouillard, Tempête de sable et Ciel dégagé.
- **Calibration de Grille Rapide** : Outil de tracé 3x3 cases pour adapter instantanément n'importe quelle carte.
- **Mesure de Distances** : Outil règle en temps réel (cases, pieds ou mètres).

### 3. 📖 Liseuse de Campagne PDF & Synthèse Vocale IA (Le Grimoire Vivant)
- **Liseuse PDF Vectorielle HD** : Affichage fluide avec zoom, navigation par page et sommaire interactif.
- **Analyseur Multi-Colonnes & Désentrelacement Spatial** : Reconstitution automatique de l'ordre de lecture logique sur les livres en 1, 2 ou 3 colonnes (type AD&D, Dragonlance, D&D 5e) avec réparation des césures de mots.
- **Synthèse Vocale Neuronale IA (Microsoft Azure / Edge TTS)** : Voix ultra-réalistes et expressives (Narrateur Henri, Denise, etc.) avec vitesse et tonalité ajustables.
- **Mode Multi-Voix PNJ Automatique** : Détection automatique des dialogues entre guillemets et alternance de voix (Narrateur, PNJ masculins, féminins, monstres).
- **Auto-Ducking Musical** : Baisse automatique et douce du volume sonore ambiant pendant la lecture vocale.
- **Cartes Narratives Découpées (Onglet Chapitres)** : Découpe de la page en cartes de scènes (Descriptions 🌲, Dialogues 💬, Combats ⚔️, Évènements 📜) avec temps de lecture et bouton de lecture en 1 clic.
- **Détection & Lancer de Dés direct (« Click-to-Roll »)** : Détection automatique des formules (`1d20+5`, `2d6`, `d100`) avec lancer instantané et bruitage physique.
- **Découpeur de Carte VTT (1 Clic)** : Glissez la souris sur un plan du PDF pour le projeter instantanément comme carte de bataille sur la Table Virtuelle.
- **Handouts & Révélations** : Projetez en 1 clic des illustrations, parchemins et énigmes sur les écrans et smartphones des joueurs.
- **OCR Intégré (Tesseract)** : Transcription et lecture vocale des vieux livres scannés.
- **Résumé de Scène par IA Locale (Ollama)** : Extraction en 1 clic des Objectifs 🎯, Dangers ⚠️, Secrets 💡 et Trésors 💎.

### 4. 👥 Multi-Écrans & HUB Mobile Joueur PWA
- **Vue Joueur Dédiée (Player View)** : Affichage sur 2ème écran / TV / Vidéoprojecteur sans aucune interface MJ, avec synchronisation du brouillard de guerre, de l'éclairage et mode Écran Noir (Blackout).
- **Serveur Web Mobile Intégré (Axum + WebSockets)** : Connexion instantanée des joueurs par simple scan de QR Code (zéro installation requise).
- **Mode PWA & Screen Wake Lock** : L'écran des smartphones reste allumé pendant toute la session sans mise en veille.
- **🕹️ D-Pad Tactile VTT** : Les joueurs déplacent leur propre pion sur la grille de la table virtuelle directement depuis leur mobile.
- **Fiches Joueur & Suivi des PV** : Fiole de sang liquide interactive, suivi des stats, compétences et inventaire.
- **Murmures & Messagerie Secrète** : Discussions privées chiffrées entre le MJ et un joueur spécifique.
- **Sondages & Votes en Direct** : Créez des dilemmes de groupe avec affichage graphique des votes.
- **Sketchpad & Sons Joueurs** : Dessins tactiques collaboratifs et bruitages déclenchables par les joueurs.

### 5. 🧙‍♂️ Outils du Maître du Jeu & Générateurs
- **Écran du MJ Tactique (Dashboard)** : Vue d'ensemble de tous les héros, PV, CA et modificateurs.
- **Tracker d'Initiative & Combat** : Gestion des tours, décompte des rounds et états de combat.
- **Générateur de Donjons Procéduraux** : Création automatique de plans de donjons complets avec pièces, couloirs, murs et portes.
- **Générateurs Rapides** : PNJ avec personnalités, Butins & Trésors, Rencontres aléatoires, Salles de donjon, Météo (7 jours).
- **Règles Spécifiques WFRP & Dark Fantasy** : Blessures Critiques 🩸, Mutations du Chaos 🌑, Calculateur de Combat Opposé (SL Net).
- **Marchands Procéduraux** : Échoppes avec inventaires et prix calculés selon la rareté.
- **Système de Rumeurs & Murmures de Taverne**.
- **Lanceur de Dés 3D Physique** : Avec calcul des modificateurs et sons réels.
- **Journal de Quêtes & Arbre de Campagne** : Suivi des quêtes (Principales, Secondaires, Secrets) avec diffusion du compte-rendu aux joueurs.
- **Export & Sauvegarde de Campagne (`.grimoire`)**.

### 6. 🎵 Mixeur Sonore & Ambiances (Soundscape)
- **Mixeur d'Ambiances Multi-Pistes** : Superposition continue d'environnements sonores (Pluie, Forêt, Taverne, Donjon, Tempête, Feu).
- **Double Lecteur Musical (Piste 1 & Piste 2)** : Avec contrôles de volume indépendants et fondus sonores.
- **SoundBoard d'Effets Spéciaux** : Déclenchement instantané d'effets (Cris, Épées, Magie, Monstres, Tonnerre, Portes).
- **Zones Audio Spatiales** : La musique d'ambiance s'adapte automatiquement selon l'emplacement du groupe sur la carte.

### 7. 🌌 Boutique & Archives Célestes (Addon Store)
- Téléchargement et installation en 1 clic de packs officiels et communautaires : Campagnes, Livres PDF, Bestiaires, Banques de textures et tampons HD.
- Système de cache automatique et notifications des nouveautés au lancement.

---

## 🎨 FANTASY MAP EDITOR (Éditeur de Cartes Dédié)

- **🏔️ Moteur de Terrain & Sculpture** :
  - Outil Sculpture : Pinceaux d'ajout et de retrait de terre pour sculpter îles, archipels, côtes rugueuses et mers profondes.
  - Générateur de Continents Procédural : Création instantanée de masses continentales réalistes basées sur du bruit fractal de Perlin.
  - Outil Peinture : Application fluide de textures de sol (Herbe, Roche, Sable, Neige, Marais, Donjon, Pavés, Eau profonde).
- **🏰 Bibliothèque Massive de Tampons (Stamps)** :
  - Des milliers d'assets HD : Nature (Arbres, Montagnes), Bâtiments (Châteaux, Villes, Villages), Donjons (Murs, Mobilier, Trésors), Maritime (Bateaux, Monstres marins), Cartographie (Boussoles, Bannières).
  - Manipulation PAO : Rotation libre 360°, mise à l'échelle, duplication, verrouillage, ordre des calques, teinte et transparence.
  - Scatter Tool : Posez des forêts ou massifs montagneux vivants d'un seul coup de pinceau sans répétition.
  - Magnétisme intelligent sur la grille (Grid Snap).
- **✏️ Tracé Vectoriel, Formes & Textes** :
  - Tracé de routes, sentiers, rivières et frontières avec styles et épaisseurs personnalisables.
  - Formes géométriques (Rectangles, Polygones, Cercles).
  - Textes calligraphiques avec polices de fantasy (*Cinzel, MedievalSharp*), ombres et bordures.
- **📜 Grilles & Ambiance Visuelle** :
  - Grille Carrée & Hexagonale (Pointy-topped & Flat-topped) avec taille et couleur ajustables.
  - Filtres d'ambiance : Parchemin Ancien, Sépia Épique, Nuit Mystique, Haut Contraste, Vignetage sombre et Texture de papier ancien.
- **🐉 Pont Bidirectionnel & Liaison Grimoire VTT** :
  - **`🐉 Envoyer vers Grimoire VTT`** : Projetez votre carte en haute résolution directement sur la Table Virtuelle Grimoire active en 1 clic.
  - **`💾 Campagne`** : Sauvegarde automatique du PNG et du fichier projet `.json` directement dans le dossier `assets/maps/` du Coffre actif.
  - **`✏️ Modifier dans le Map Editor`** : Réouvrez n'importe quelle scène du Grimoire dans l'éditeur pour la retoucher en direct.
  - Auto-sauvegarde anti-crash avec restauration de session.
  - Export PNG HD et projet JSON complet.

---

## ⌨️ Raccourcis Clavier Principaux

| Raccourci | Contexte | Action |
|-----------|----------|--------|
| `Ctrl+K` ou `Ctrl+P` | Global | Palette de recherche rapide (FTS5) |
| `Ctrl+J` | Éditeur | Génération / Assistant IA sur la sélection |
| `Ctrl+Z` / `Ctrl+Y` | Éditeur & Map Editor | Annuler / Rétablir |
| `Alt` + Molette | VTT | Redimensionner le pion survolé |
| Poignée ⬤ | VTT | Redimensionner un pion ou une zone de sélection |
| Clic droit sur Token | VTT | Ouvrir la roue des conditions (ConditionWheel) |
| `Espace` + Glisser | VTT & Map Editor | Déplacer la vue (Pan) |

---

## 🚀 Téléchargement & Installation

### Pour les Maîtres du Jeu & Joueurs
1. Rendez-vous sur la page des [Releases GitHub](https://github.com/LordMadTrix/grimoire/releases/latest).
2. Téléchargez l'installateur `.msi` (Windows) ou `.AppImage` (Linux).
3. **Au premier lancement sous Windows** : Si l'avertissement *SmartScreen* apparaît (*« Windows a protégé votre ordinateur »*), cliquez sur **« Informations complémentaires »** puis **« Exécuter quand même »**.

### Pour les Développeurs

```bash
# Installer les dépendances
npm install

# Lancer en mode développement (Tauri + Svelte 5 + Map Editor)
npm run tauri dev
```

---

<div align="center">
  <sub>Développé avec passion pour la communauté TTRPG. Sous licence MIT.</sub>
</div>

## 🛠️ Architecture

- **Frontend** : Svelte 5 (Runes) + PixiJS v8 pour le rendu haute performance.
- **Backend Desktop** : Rust (Tauri) pour les accès fichiers, SQLite FTS5 et WebSocket Mobile.
- **Mobile** : Serveur embarqué en Rust servant une web-app optimisée pour smartphones.
- **Mises à jour automatiques** : Détection et téléchargement en arrière-plan des nouvelles versions via `tauri-plugin-updater`, relié aux releases GitHub.

---
*Créé avec passion pour les rôlistes par LordMadTrix.*
