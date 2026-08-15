# 📖 Le Grand Grimoire — Guide Encyclopédique de A à Z (v0.4.1)

> **L'Outil Ultime pour Maîtres du Jeu TTRPG**  
> *Table Virtuelle PixiJS v8 · Wiki Markdown & FTS5 · Compagnon Mobile PWA · IA Locale Ollama · Audio Spatial 2.5D · Packs .grimoirepack*

---

## 📑 Sommaire Général

1. [Introduction & Philosophie de Grimoire](#1-introduction--philosophie-de-grimoire)
2. [Installation & Premier Démarrage](#2-installation--premier-démarrage)
3. [Structure Optimale d'un Coffre (Vault)](#3-structure-optimale-dun-coffre-vault)
4. [L'Éditeur Markdown & Wiki Intelligent](#4-léditeur-markdown--wiki-intelligent)
5. [Cartographie : Import, Map Editor & Donjons Procéduraux](#5-cartographie--import-map-editor--donjons-procéduraux)
6. [La Table Virtuelle (VTT) & Éclairage Dynamique PixiJS v8](#6-la-table-virtuelle-vtt--éclairage-dynamique-pixijs-v8)
7. [Murs Line of Sight (LOS), Portes & Brouillard de Guerre](#7-murs-line-of-sight-los-portes--brouillard-de-guerre)
8. [Ambiance Sonore & Audio Spatialisé 2.5D](#8-ambiance-sonore--audio-spatialisé-25d)
9. [Gestion des Tokens & ConditionWheel](#9-gestion-des-tokens--conditionwheel)
10. [Moteur de Combat & Résolution des Tests Opposés (SL Net)](#10-moteur-de-combat--résolution-des-tests-opposés-sl-net)
11. [Journal de Campagne, Quêtes & Résumés de Session](#11-journal-de-campagne-quêtes--résumés-de-session)
12. [Compagnon Mobile PWA & Contrôle Tactile](#12-compagnon-mobile-pwa--contrôle-tactile)
13. [Packs d'Aventures Partageables (.grimoirepack)](#13-packs-daventures-partageables-grimoirepack)
14. [Assistant Narratif & IA Locale Ollama](#14-assistant-narratif--ia-locale-ollama)
15. [Boîte à Outils du MJ & Générateurs Aléatoires](#15-boîte-à-outils-du-mj--générateurs-aléatoires)
16. [Tutoriel Pas à Pas : Préparer et Lancer sa Première Session](#16-tutoriel-pas-à-pas--préparer-et-lancer-sa-première-session)
17. [Index des Raccourcis Clavier & Astuces Pro](#17-index-des-raccourcis-clavier--astuces-pro)

---

## 1. Introduction & Philosophie de Grimoire

**Grimoire** a été conçu pour libérer le Maître du Jeu de la surcharge cognitive. Plutôt que de jongler entre cinq fenêtres ouvertes (un traitement de texte, une table virtuelle lourde sur navigateur, une application de musique, des PDF de règles et un chat Discord), Grimoire centralise tout votre univers dans une seule application native ultra-rapide.

### Les 4 Piliers Fondamentaux :
1. **100% Hors-Ligne & Local** : Aucune dépendance envers un abonnement ou un serveur distant. Vos données vous appartiennent sous forme de simples fichiers texte Markdown et d'images.
2. **Performances Maximales** : Moteur Rust (Tauri v2) couplé à PixiJS v8 pour un affichage graphique à 60 FPS constants.
3. **Zéro Friction pour les Joueurs** : Les joueurs n'installent aucune application. Ils scannent un QR Code local depuis leur smartphone pour accéder à leur fiche en mode PWA.
4. **Modulaire & Extensible** : Système d'extensions (Addons), formats de packs d'aventures et IA locale sans cloud.

---

## 2. Installation & Premier Démarrage

### Téléchargement
- **Windows** : Téléchargez le programme d'installation `.msi` ou l'exécutable portable depuis la page [Releases GitHub](https://github.com/LordMadTrix/grimoire/releases).
- **Linux** : Téléchargez le paquet `.AppImage` ou `.deb`. Rendez le fichier exécutable (`chmod +x Grimoire.AppImage`) et lancez-le.

### Premier Lancement
Au premier démarrage, Grimoire vous propose :
1. **Créer un nouveau Coffre (Vault)** : Choisissez un dossier vide sur votre disque dur. Grimoire créera l'arborescence recommandée.
2. **Ouvrir un Coffre existant** : Sélectionnez un dossier contenant déjà vos notes ou un ancien vault Obsidian/Grimoire.

> 💡 **Astuce** : Grimoire mémorise votre dernier dossier ouvert et le recharge instantanément lors des prochains démarrages.

---

## 3. Structure Optimale d'un Coffre (Vault)

Un coffre Grimoire est un simple dossier sur votre ordinateur. Voici l'organisation recommandée pour une campagne fluide :

```text
📁 Mon_Univers_WFRP/
├── 📄 Index.md                    ← Tableau de bord principal de votre campagne
├── 📄 game.config.md              ← Règles personnalisées, tables de races et carrières
├── 📁 .grimoire/                  ← Fichiers de configuration internes (quêtes, timeline)
├── 📁 assets/
│   ├── 📁 maps/                   ← Vos plans, cartes de villes et de donjons (JPG, PNG, WebP)
│   ├── 📁 audio/                  ← Musiques d'ambiance et effets sonores (MP3, OGG, WAV)
│   ├── 📁 handouts/               ← Lettres, parchemins et indices à montrer aux joueurs
│   └── 📁 tokens/                 ← Portraits et pions découpés (PJ, PNJ, Monstres)
├── 📁 scenarios/                  ← Vos actes de scénarios et intrigues
├── 📁 world/                      ← Encyclopédie : cités, dieux, factions, cultes
├── 📁 npcs/                       ← Fiches des PNJ importants et de leurs relations
└── 📁 journal/                    ← Compte-rendus de chaque session jouée
```

---

## 4. L'Éditeur Markdown & Wiki Intelligent

L'éditeur de Grimoire allie la simplicité du texte brut à la puissance d'un wiki interconnecté.

### Fonctionnalités Clés :
- **WikiLinks `[[NomDeLaNote]]`** : Tapez `[[` n'importe où dans votre texte pour ouvrir l'autocomplétion instantanée vers une autre note de votre coffre.
- **Rétroliens Automatiques (Backlinks)** : En bas de chaque note, Grimoire liste toutes les autres pages qui mentionnent cette note. Idéal pour retrouver qui est lié à quel PNJ !
- **Recherche Instantanée (FTS5)** : Appuyez sur `Ctrl+K` pour ouvrir la palette de commande et rechercher n'importe quel mot ou extrait parmi des milliers de notes en moins de 5 millisecondes.
- **Mise en page riche** : Titres `#`, listes à puces `-`, tableaux markdown, citations `>` et cases à cocher `- [ ]`.

---

## 5. Cartographie : Import, Map Editor & Donjons Procéduraux

Grimoire offre trois méthodes complémentaires pour créer votre champ de bataille :

### 1. Importer une Image Externe
- Placez vos fichiers images dans le dossier `assets/maps/`.
- Ouvrez le sélecteur de carte dans la barre VTT (icône 🗺️) et cliquez sur votre image.
- Ajustez la grille en appuyant sur la molette ou en renseignant la taille des cases (ex: 50px).

### 2. L'Éditeur de Cartes Vectoriel (Map Editor)
Accessible via la barre d'outils, il vous permet de peindre des cartes tactiques personnalisées :
- **Outil Scatter (Pinceau de dispersion)** : Posez des forêts d'arbres, des rochers ou des maisons en un seul glissement de souris.
- **Générateur de Continents** : Créez des îles et continents réalistes par algorithme fractal.
- **Rivières & Routes lissées** : Tracé vectoriel avec courbes de Bézier fluides.

### 3. Le Générateur de Donjons Procédural (v0.4.1)
Cliquez sur **🧙‍♂️ Outils MJ → 🏰 Donjon & Murs Procédural** :
- Choisissez un archétype : **Crypte de Morr**, **Donjon Souterrain**, **Égouts d'Altdorf** ou **Caverne Sauvage**.
- Réglez la taille de la grille et la densité des salles.
- Cliquez sur **Générer le Donjon** puis sur **Appliquer au VTT**.
- **Magie !** Les textures de sol sont peintes et **tous les murs de collision et de ligne de vue (LOS) sont automatiquement tracés**.

---

## 6. La Table Virtuelle (VTT) & Éclairage Dynamique PixiJS v8

Le moteur VTT offre une immersion cinématographique grâce à son pipeline de rendu GPU moderne.

### Contrôles de la Carte :
- **Déplacement de la vue (Pan)** : Clic droit enfoncé + glisser ou Clic molette + glisser.
- **Zoom** : Molette de la souris (centré sur le curseur).
- **Recentrage** : Bouton 🎯 dans la barre d'outils.

### Gestion de l'Ambiance Lumineuse :
Dans la barre d'outils VTT :
- **☀️ Jour** : Éclairage naturel total sans ombre globale.
- **🌅 Crépuscule** : Voile ambré avec portée de vue réduite.
- **🌙 Nuit** : Obscurité bleue profonde nécessitant des torches ou lanternes.
- **🌑 Ténèbres Absolues** : Obscurité totale ; seuls les rayons de lumière percent le noir.
- **⚡ Éclair d'Orage** : Cliquez sur l'icône d'éclair pour déclencher un flash stroboscopique blanc synchronisé avec un grondement de tonnerre et une suppression temporaire des ombres.

### Torches et Lanternes Scintillantes :
- Faites un clic droit sur un token → ouvrez ses paramètres ⚙️.
- Activez **Source de Lumière**, choisissez le rayon (ex: 150px), la couleur (ex: `#e5a853`) et cochez **Scintillement de torche**.
- La flamme vacillera de manière organique et projettera des ombres dynamiques en temps réel contre les murs !

---

## 7. Murs Line of Sight (LOS), Portes & Brouillard de Guerre

### Tracer des Murs et des Portes
1. Activez le mode **Murs (Blueprint)** dans la barre d'outils.
2. Cliquez sur la carte pour poser les segments de murs.
3. Pour créer une porte : changez le type en **Porte**. Les portes apparaissent avec une poignée commutable.
4. En cours de jeu, cliquez simplement sur une porte pour l'**Ouvrir** (la lumière passe) ou la **Fermer** (la lumière est bloquée).

### Brouillard de Guerre Multi-Formes
- Activez le mode **Brouillard (FoW)**.
- Choisissez l'outil **Rectangle** ou **Polygone Libre**.
- Masquez des zones inexplorées ou découpez des zones à révéler. Côté écran des joueurs, les zones masquées sont totalement noires et les tokens ennemis qui s'y trouvent sont masqués.

---

## 8. Ambiance Sonore & Audio Spatialisé 2.5D

### Lecteur Principal & Playlist
- Ouvrez le panneau audio dans la barre supérieure.
- Glissez-déposez des musiques ou sélectionnez des fichiers audio de votre vault.
- Contrôlez le volume général et les fondus sonores.

### Zones Audio Spatiales
1. Activez le mode **Zone Sonore (Audio Zone)**.
2. Cliquez sur la carte pour définir un point d'origine et étirez le rayon d'écoute (ex: 300px).
3. Associez-lui une piste sonore (ex: *Bruit d'un torrent d'eau*, *Chants de taverne*, *Feu de camp crépitant*).
4. Lorsque le groupe ou un token s'approche de la zone, le volume sonore augmente progressivement, et diminue lorsqu'ils s'éloignent !

---

## 9. Gestion des Tokens & ConditionWheel

### Déposer et Déplacer des Tokens
- Ouvrez la bibliothèque de tokens (panneau latéral ou raccourci).
- Glissez un token sur la grille. Il s'aligne automatiquement sur la case.
- Cliquez et glissez pour déplacer. Une ligne pointillée jaune indique la trajectoire et le nombre de cases parcourues.

### Redimensionnement Express
- Survolez un token : une poignée circulaire ⬤ apparaît dans le coin inférieur droit.
- Glissez-la pour ajuster la taille, ou utilisez `Alt + Molette` pour agrandir/rétrécir le token d'un coup de doigt.

### La ConditionWheel (Roue Radiale)
- Faites un **clic droit** sur n'importe quel token : la **ConditionWheel** apparaît.
- Cliquez sur une condition (🩸 *Hémorragie*, 💤 *Inconscient*, 🤢 *Empoisonné*, 👁️ *Aveuglé*, 🪢 *Entravé*, 🔥 *Enflammé*, 😱 *Effrayé*, 🛡️ *À terre*).
- La condition s'affiche sous forme de badge flottant au-dessus du token et se synchronise sur les écrans des joueurs.

---

## 10. Moteur de Combat & Résolution des Tests Opposés (SL Net)

### Initialisation du Combat
1. Cliquez sur le bouton **⚔️** de la barre d'outils pour démarrer le combat.
2. Cliquez sur **⚡ Init** pour tirer l'initiative de tous les combattants ou classez-les par ordre décroissant d'Agilité.
3. Utilisez les flèches **Suivant / Précédent** pour faire défiler les tours. Une bannière "AU TOUR DE..." annonce le combattant actif.

### Calculateur de Tests Opposés WFRP (Degrés de Succès Nets)
Ouvrez **🧙‍♂️ Outils MJ → 💥 Calculateur de Dégâts → Onglet 🎯 Opposition WFRP (SL)** :
1. **Attaquant** : Entrez la Capacité de Combat (ex: 55) et le jet de dé réalisé (ex: 23). Grimoire calcule instantanément les Degrés de Succès (SL: +3).
2. **Défenseur** : Entrez sa compétence d'Esquive ou de Parade (ex: 40) et son jet (ex: 62) (SL: -2).
3. **Résolution Automatique** :
   - Grimoire calcule le **SL Net (+5 pour l'attaquant)**.
   - **Localisation du coup** : Les dés de l'attaquant sont inversés (23 → 32 = Torse).
   - **Dégâts finaux** : Dégâts de l'arme + SL Net - (Endurance + Armure de la zone ciblée).

---

## 11. Journal de Campagne, Quêtes & Résumés de Session

Accessible via **🧙‍♂️ Outils MJ → 📜 Journal de Quêtes & Campagne** :

### Suivi Structuré des Quêtes
- **Catégories** : ⭐ Quête Principale, 🗡️ Quête Secondaire, 👂 Rumeur / Piste, 🔒 Secret du MJ.
- **Étapes interactives** : Listez les objectifs clés (`[x] Interroger le prêtre`, `[ ] Trouver la clé d'argent`). Cochez-les en direct lors de la session.
- **Récompenses & PNJ** : Renseignez les gains d'XP prévus, couronnes d'or et le nom du commanditaire.

### 📢 Diffusion du Résumé de Session en 1 Clic
- Cliquez sur le bouton **📢 Diffuser Résumé de Session**.
- Grimoire compile automatiquement la date impériale actuelle, les quêtes accomplies, les monstres affrontés et les notes.
- Le texte Markdown est copié dans votre presse-papier et **diffusé instantanément sous forme de parchemin sur les smartphones de tous vos joueurs** !

---

## 12. Compagnon Mobile PWA & Contrôle Tactile

Vos joueurs n'ont rien à installer : ils jouent depuis Safari, Chrome ou Firefox sur leur smartphone.

### Connexion des Joueurs
1. Cliquez sur le bouton **📱 Mobile** de la barre d'outils pour ouvrir le QR Code.
2. Chaque joueur scanne le QR Code avec son appareil photo pour ouvrir la web app.
3. Ils renseignent leur nom et mot de passe de session.

### Fonctionnalités Mobiles Exclusives (v0.4.1) :
- **👁️ Screen Wake Lock (Anti-Veille)** : Bouton dédié en haut de l'écran pour empêcher le smartphone de s'éteindre tout au long de la partie.
- **🕹️ D-Pad Déplacement VTT** : Un pad directionnel sur l'onglet Combat permet au joueur de déplacer son propre pion case par case sur la carte du MJ avec un retour tactile (vibration).
- **Fiche Joueur Interactive** : Jauge de Vitalité sous forme de fiole de sang, caractéristiques, compétences, inventaire et fortune.
- **🎨 Sketchpad Collaboratif** : Les joueurs dessinent leur plan tactique au doigt sur leur écran ; le tracé apparaît en direct sur l'écran du MJ.
- **🎹 Soundboard Joueur** : Les joueurs peuvent déclencher des sons d'ambiance (applaudissements, coups d'épée, sorts) pour animer le tour de table.

---

## 13. Packs d'Aventures Partageables (.grimoirepack)

Le format `.grimoirepack` permet d'échanger des scénarios et donjons complets prêts à jouer entre Maîtres du Jeu.

### Exporter une Aventure :
1. Cliquez sur **📋 Exporter Session** dans la barre d'outils.
2. Cliquez sur **📦 Exporter Pack .grimoirepack**.
3. Grimoire regroupe la carte active, tous les murs LOS, les éclairages, les zones audio, les tokens, les pièges et les combats dans un unique fichier `.grimoirepack`.

### Importer une Aventure :
1. Ouvrez **📋 Exporter Session**.
2. Cliquez sur **📂 Importer Pack** et sélectionnez votre fichier `.grimoirepack`.
3. Votre VTT se configure instantanément avec tous les paramètres de l'auteur !

---

## 14. Assistant Narratif & IA Locale Ollama

Grimoire intègre un écrivain fantôme alimenté par vos modèles d'IA locaux (Llama 3, Mistral, Gemma) via **Ollama**. Vos données ne quittent jamais votre machine.

### Modules de l'Assistant Narratif (v0.4.1) :
Accessible via **🧙‍♂️ Outils MJ → 🤖 Assistant IA & Narratif** :
1. **Descriptions d'Ambiance de Scène** : Sélectionnez un lieu impérial (Taverne mal famée, Forteresse naine, Forêt de Reikwald, Égouts fétides...) et un ton (Sombre & Viscéral, Mystérieux, Épique...). L'IA rédige une description sensorielle captivante.
2. **Générateur d'Accroches de Quêtes** : Choisissez la carrière de vos héros (Chasseur de rats, Répurgateur, Sorcier...) pour obtenir des intrigues sur-mesure.
3. **Dialogue de PNJ Express** : Définissez l'archétype et l'humeur du PNJ pour générer des répliques théâtrales immersives.
4. **Diffusion Handout** : Cliquez sur *Diffuser aux Joueurs* pour envoyer la description générée directement sur l'écran joueur.

---

## 15. Boîte à Outils du MJ & Générateurs Aléatoires

Tous situés dans le menu déroulant **🧙‍♂️ Outils MJ** :

- **🛡️ Écran Tactique (Dashboard)** : Vue synthétique de tous les PJ (PV, Blessures, Points de Destin, Éléments clés).
- **🩸 Blessures Critiques & Mutations** : Tables complètes WFRP avec tirage aléatoire et application automatique aux fiches.
- **🛍️ Générateur de Marchands** : Créez une échoppe (Apothicaire, Armurier, Prêteur sur gages) avec inventaire pondéré et prix négociables.
- **🎭 Système de Murmures & Rumeurs** : Générez des rumeurs vraies, fausses ou déformées à distiller aux PJ.
- **🕸️ Carte des Relations PNJ** : Visualisez les liens d'alliance, d'amour ou de rivalité entre vos personnages non-joueurs.

---

## 16. Tutoriel Pas à Pas : Préparer et Lancer sa Première Session

Voici la check-list idéale pour préparer et mener votre première partie sur Grimoire en moins de 15 minutes :

```markdown
### Étape 1 : Préparation du Scénario (Avant la partie)
- [ ] Créez une note `scenarios/session-01.md` avec vos grandes scènes et descriptions.
- [ ] Ouvrez le **Journal de Quêtes** et créez votre quête principale avec ses 3 premières étapes.
- [ ] Importez votre carte ou générez un donjon avec **🏰 Donjon & Murs Procédural**.
- [ ] Placez 2 ou 3 **Zones Audio Spatiales** sur les points chauds de la carte.

### Étape 2 : Installation de la Table (10 minutes avant l'arrivée des joueurs)
- [ ] Lancez Grimoire sur votre ordinateur.
- [ ] Cliquez sur **🖥️ Vue Joueur** et glissez cette fenêtre sur votre second écran ou téléviseur.
- [ ] Cliquez sur **📱 Mobile** et affichez le QR Code de connexion.
- [ ] Les joueurs scannent le QR Code et rejoignent la partie.

### Étape 3 : Déroulement de la Partie
- [ ] Dévoilez la carte au fur et à mesure avec le **Brouillard de Guerre**.
- [ ] Ajustez l'ambiance lumineuse (Jour → Crépuscule → Ténèbres) selon l'heure de jeu.
- [ ] Démarrez le tracker de combat avec **⚔️** lors des affrontements.
- [ ] À la fin de la séance : cliquez sur **📢 Diffuser Résumé de Session** pour récompenser vos joueurs !
```

---

## 17. Index des Raccourcis Clavier & Astuces Pro

| Raccourci | Contexte | Action |
| :--- | :--- | :--- |
| `Ctrl + K` | Partout | Palette de commande & recherche instantanée (FTS5) |
| `Ctrl + J` | Éditeur Markdown | Génération de texte IA sur la sélection |
| `Alt + Molette` | VTT (Token survolé) | Redimensionnement rapide du token |
| `Clic Droit Token` | VTT | Ouvre la ConditionWheel (8 statuts) |
| `Clic Droit Glisser` | VTT | Déplacement panoramique de la carte |
| `Molette` | VTT | Zoom avant / arrière |
| `Espace` | VTT | Recentrer la caméra sur le groupe de tokens |
| `1` à `9` | Mode Murs | Sélectionner un outil de tracé |
| `Ctrl + Z` | VTT / Map Editor | Annuler la dernière action |

---

*Le Grand Grimoire — Conçu et développé avec passion pour tous les Maîtres du Jeu par MadTrix.*
