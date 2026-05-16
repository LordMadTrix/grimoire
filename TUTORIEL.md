# Tutoriel Complet — Grimoire

> Application de gestion de campagne TTRPG pour Maître du Jeu  
> **Stack** : Svelte 5 + Tauri v2 · VTT PixiJS v8 · Recherche SQLite FTS5 · IA Ollama locale · Serveur mobile Axum/WebSocket

---

## Table des matières

1. [Démarrage rapide](#1-démarrage-rapide)
2. [Interface générale](#2-interface-générale)
3. [Éditeur de notes](#3-éditeur-de-notes)
4. [WikiLinks et navigation](#4-wikilinks-et-navigation)
5. [Recherche](#5-recherche)
6. [VTT — Plateau de jeu virtuel](#6-vtt--plateau-de-jeu-virtuel)
7. [Vue Joueur (second écran)](#7-vue-joueur-second-écran)
8. [Serveur Joueurs Mobiles — Côté MJ](#8-serveur-joueurs-mobiles--côté-mj)
9. [App Mobile — Côté Joueur](#9-app-mobile--côté-joueur)
10. [Créateur de personnage](#10-créateur-de-personnage)
11. [IA Ollama](#11-ia-ollama)
12. [Configuration du système de jeu](#12-configuration-du-système-de-jeu)
13. [Outils MJ Avancés (Waves 10-13)](#13-outils-mj-avancés-waves-10-13)
14. [Raccourcis clavier](#14-raccourcis-clavier)

---

## 1. Démarrage rapide

### Premier lancement

Au premier lancement, Grimoire affiche un écran d'accueil :

- **Ouvrir un vault existant** — sélectionnez un dossier qui contient déjà des fichiers `.md`
- **Créer un vault** — sélectionnez un dossier vide, Grimoire le structure

> Le dernier vault est automatiquement rouvert à chaque lancement.

### Structure de dossier recommandée

```
ma-campagne/
├── Index.md                  ← Page d'accueil (ouverte par défaut)
├── game.config.md            ← Configuration du système de jeu (races, carrières)
├── assets/
│   ├── maps/                 ← Cartes (PNG/JPG) — clic gauche = chargement direct dans le VTT
│   ├── tokens/
│   │   ├── Heroes/           ← Tokens des PJ
│   │   ├── Creatures/        ← Tokens de monstres
│   │   └── NPCs/             ← Tokens de PNJ
│   └── images/               ← Images générales (handouts, illustrations)
├── scenarios/                ← Aventures
├── world/                    ← Lieux, factions, lore
├── journal/                  ← Notes de session
└── Campaigns/                ← Arcs de campagne
```

### Indexation automatique

À l'ouverture d'un vault, Grimoire **indexe automatiquement** tous les fichiers `.md` pour la recherche plein-texte (SQLite FTS5). L'opération est quasi-instantanée pour moins de 1000 fichiers.

---

## 2. Interface générale

```
┌─────────────────────────────────────────────────────────┐
│  [🔍] [🗺️] [📱] [⚔️ Perso] [⚙️]           Barre d'outils │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│   SIDEBAR    │              ÉDITEUR                     │
│   (fichiers) │         (ou VTT actif)                   │
│              │                                          │
│  ▼ assets/   │  # Titre de la note                      │
│    ▼ maps/   │  ...contenu markdown...                  │
│      carte1  │                                          │
│  ▼ scenarios │                                          │
│    scene-01  │                                          │
│              │                                          │
└──────────────┴──────────────────────────────────────────┘
```

### Sidebar — Actions disponibles

| Geste | Résultat |
|-------|----------|
| **Clic gauche** sur `.md` | Ouvre la note dans l'éditeur |
| **Clic gauche** sur image dans `maps/` | Charge la carte dans le VTT |
| **Survol** d'une image | Prévisualisation miniature |
| **Glisser** une image | Dépose comme token sur la carte VTT |
| **Clic droit** | Menu contextuel |

### Menu contextuel (clic droit sur un fichier/dossier)

```
📄 Nouvelle note
📁 Nouveau dossier
✏️ Renommer
🗑️ Supprimer
────────────────
📋 Depuis un template ▶
   🧑 PNJ               [Normal] [✨ + IA]
   🏠 Lieu              [Normal] [✨ + IA]
   🎬 Scène             [Normal] [✨ + IA]
   ⚔️ Faction           [Normal] [✨ + IA]
   🐉 Créature          [Normal] [✨ + IA]
   📓 Session           [Normal] [✨ + IA]
```

---

## 3. Éditeur de notes

### Frontmatter YAML

Chaque note peut démarrer avec un bloc de métadonnées :

```markdown
---
title: Le Donjon des Ombres
type: scene
tags: [donjon, undead, session-3]
relations:
  - target: le-comte-von-ratten
    label: commandité par
    type: employer
---

# Le Donjon des Ombres
...
```

Les métadonnées `title`, `type` et `tags` sont utilisées par la **recherche FTS5** et le **graphe de liens**. Les champs `relations` génèrent des arcs orientés dans le graphe.

Les métadonnées s'affichent sous forme de **pills** colorées sous le header de l'éditeur.

### Syntaxe Markdown

```markdown
# H1  ## H2  ### H3

**gras**   *italique*   ~~barré~~   `code inline`

- puce non ordonnée
1. puce ordonnée

> citation / info importante

```bloc de code```

---  (séparateur)
```

### Images embarquées dans l'éditeur

```
![[assets/images/parchemin-mysterieux.png]]
```

L'image s'affiche **inline dans l'éditeur** sous la syntaxe, en temps réel. Fonctionne avec PNG, JPG, WebP, GIF.

### Rétroliens (backlinks)

Le bouton **🔗 N** dans le header de l'éditeur affiche toutes les notes qui contiennent un `[[lien]]` vers la note courante. Cliquez pour ouvrir/fermer le panneau.

### Export PDF

Bouton **🖨️** dans le header → fenêtre d'impression système → **Enregistrer en PDF**.

---

## 4. WikiLinks et navigation

### Créer un lien

Tapez `[[` dans l'éditeur → autocomplétion :

```markdown
Voir aussi [[taverne-du-griffon]]
Voir aussi [[taverne-du-griffon|La Taverne du Griffon]]  ← avec texte personnalisé
```

### Naviguer vers une note

`Ctrl+Clic` sur n'importe quel `[[lien]]` → ouvre la note.

Si la note **n'existe pas** → Grimoire propose de la créer (avec ou sans template).

### Prévisualisation au survol

Survolez un `[[lien]]` → infobulle avec les 300 premiers caractères de la note (sans le frontmatter YAML).

### Graphe de liens

Depuis la palette de recherche (`Ctrl+K`) → onglet **Graphe** :
- Chaque note = un nœud (couleur = `type` du frontmatter)
- Chaque `[[lien]]` = un arc
- Les relations nommées du frontmatter = arcs orientés avec label
- Cliquez sur un nœud pour ouvrir la note

---

## 5. Recherche

### Ouvrir la palette

`Ctrl+K` ou bouton **🔍** → palette de recherche plein-texte.

### Comment ça fonctionne

La recherche SQLite FTS5 cherche dans :
- Le **titre** (frontmatter `title` ou `name`)
- Les **tags** (frontmatter `tags`)
- Le **contenu complet** du fichier

Chaque résultat affiche un extrait contextuel avec le terme surligné en `<mark>`.

### Ré-indexer

Si vous avez modifié des fichiers en dehors de Grimoire (autre éditeur, terminal), cliquez **Ré-indexer** dans la palette pour mettre l'index à jour.

---

## 6. VTT — Plateau de jeu virtuel

### Activer le VTT

Bouton **🗺️** dans la barre d'outils → le VTT s'affiche à la place de l'éditeur.

### Charger une carte

**Via la sidebar** (recommandé) : clic gauche sur une image dans `assets/maps/` → chargement direct  
**Via le VTT** : bouton **Charger une carte** → sélecteur de fichier

### Navigation sur la carte

| Action | Résultat |
|--------|----------|
| **Molette souris** | Zoom avant/arrière |
| **Clic milieu** + glisser | Déplacer la vue |
| **Clic droit** + glisser | Déplacer la vue |

### Barre d'outils VTT — Modes

| Icône | Mode | Utilisation |
|-------|------|-------------|
| ↖ | **Sélect** | Déplacer les tokens (cliquer-glisser) |
| 👁 | **Révéler FOW** | Effacer le brouillard de guerre (pinceau circulaire) |
| 🌫 | **Cacher FOW** | Remettre le brouillard (pinceau circulaire) |
| ▭ | **Zone FOW** | Révéler/cacher un rectangle entier |
| 📏 | **Mesure** | Mesurer en mètres (basé sur la taille de grille) |
| 📍 | **Ping** | Envoyer un signal visuel côté joueur |

### Barre d'outils VTT — Contrôles

| Contrôle | Fonction |
|----------|----------|
| **🔲 Grille** | Afficher/masquer la grille |
| **⬛ Blackout** | Écran noir total sur la vue joueur |
| **🔊 Audio** | Charger et jouer un fichier audio (synchronisé côté joueur) |
| **⚔️ Initiative** | Ouvrir le tracker de combat |

### Tokens

#### Ajouter depuis la sidebar

1. Dans la sidebar, naviguez vers `assets/tokens/`
2. **Glissez** une image sur la carte
3. Le token s'aligne automatiquement sur la grille

#### Pack Mimic

Grimoire inclut un pack spécial de **Mimics** illustrés. Pour les utiliser :
1. Ouvrez la bibliothèque de monstres (icône 🐉).
2. Cherchez "Mimic" (Coffre, Porte, Baril, Table).
3. Cliquez sur le **+** pour les faire apparaître sur la carte avec leur illustration dédiée.

#### Contrôles sur un token

| Action | Résultat |
|--------|----------|
| **Clic gauche** + glisser (mode Sélect) | Déplacer le token |
| **Clic droit** sur un token | Ouvrir les paramètres |

#### Paramètres d'un token (clic droit)

| Paramètre | Description |
|-----------|-------------|
| **Nom** | Affiché au survol |
| **PV / PV max** | Barre de vie colorée sur le token |
| **Taille** | Nombre de cases (1 = 1 case, 2 = 2×2 cases…) |
| **Couleur** | Couleur du cercle de base (si pas d'image) |
| **Ennemi** | Apparaît différemment côté joueur |
| **Visible** | Décoché = masqué aux joueurs, visible MJ à 45% d'opacité |
| **Supprimer** | Retire le token de la carte |

### Brouillard de Guerre (FOW)

- Le FOW démarre entièrement opaque (zones noires)
- **Mode 👁 Révéler** → clic + glisser → cercle d'effacement
- **Mode 🌫 Cacher** → clic + glisser → re-couvre les zones
- **Mode ▭ Zone** → tracez un rectangle → choix Révéler ou Cacher
- Toutes les modifications sont synchronisées **en temps réel** sur la vue joueur

### Initiative et combat

1. Bouton **⚔️ Initiative** → tracker de combat
2. **+ Ajouter** → entrez nom et valeur d'initiative
3. **▶ Débuter le combat** → active le premier combattant
4. **⏭ Tour suivant** → passe au combattant suivant
5. **⏹ Terminer** → ferme le combat
6. **Envoyer aux mobiles** → bouton dans le panel 📱 → affiche l'ordre de combat sur les téléphones

---

## 7. Vue Joueur (second écran)

### Ouvrir

Bouton **👁 Vue Joueur** dans la barre VTT → sélectionnez le moniteur secondaire.

### Ce que voient les joueurs

- La carte **avec le FOW** (zones non révélées = noires)
- Les tokens **marqués comme visibles** uniquement
- Les **pings** du MJ (cercle animé)
- L'**ambiance sonore** (même fichier audio que le MJ)

### Synchronisation temps réel

| Action MJ | Résultat côté joueur |
|-----------|----------------------|
| Révéler une zone FOW | Zone s'éclaircit |
| Déplacer un token | Token se déplace |
| Activer le Blackout | Écran noir total |
| Afficher/masquer la grille | Grille synchronisée |
| Charger une musique | Même audio côté joueur |
| Envoyer un Ping | Cercle animé sur la carte |

> **Délai** : environ 1-2 secondes après ouverture de la vue joueur, le temps que les listeners soient initialisés.

---

## 8. Serveur Joueurs Mobiles — Côté MJ

### Démarrer le serveur

1. Bouton **📱** dans la barre d'outils
2. **🚀 Démarrer le Serveur**
3. Le QR Code apparaît avec l'URL (`http://192.168.x.x:7438`)
4. **Bouton 📋** à côté de l'URL = copier dans le presse-papier

> Tous les appareils doivent être sur le **même réseau Wi-Fi local**. Pas besoin d'internet.

### Lire les informations d'un joueur connecté

```
● Aldric Heissen               ▓▓▓▓▓▓░░   12/14  ▼
  ⚠️ Étourdi ✕   ⚠️ Saignant ✕
  💫 Aldric demande 150 XP                  [Approuver]
```

| Élément | Signification |
|---------|---------------|
| Point vert (●) | Connecté — point doré et animé si c'est son tour |
| Barre colorée | PV restants (vert > 60%, jaune > 25%, rouge ≤ 25%) |
| `12/14` | Blessures actuelles / maximum |
| `▼` | Cliquez pour déplier les contrôles |
| `⚠️ Étourdi ✕` | Condition active — cliquez pour la retirer |
| `💫 ... XP [Approuver]` | Demande d'XP en attente |

### Contrôles GM par joueur (déplier la carte)

```
┌────────────────────────────────────────────────────┐
│  [ Valeur ]  [ 💥 Dégâts ]  [ 💚 Soin ]           │
│  [ — Condition —          ]  [ + Appliquer ]       │
│  [          ⚡ C'est son tour          ]            │
└────────────────────────────────────────────────────┘
```

- **Valeur** : entrez un nombre (1–99)
- **💥 Dégâts** : soustrait ce nombre aux Blessures du joueur
- **💚 Soin** : ajoute ce nombre aux Blessures
- **Condition** : sélectionnez dans la liste (Étourdi, Assommé, À Terre, Aveuglé, Effrayé, Paralysé, Empoisonné, Saignant)
- **⚡ C'est son tour** : notifie le joueur (animation sur son téléphone)

### Actions GM globales

| Bouton | Effet |
|--------|-------|
| **⚔️ Combat** | Envoie l'état d'initiative/combat à tous les téléphones |
| **📢 Ping** | Envoie une notification d'attention à tous |
| **📋 Handout** | Ouvre le formulaire d'envoi de document |
| **⏸ Réinitialiser le tour** | Retire le statut "tour actif" de tout le monde |

### Envoyer un Handout

1. Bouton **📋 Handout** → formulaire
2. Champ **Titre** (ex: `Lettre scellée du Comte`)
3. Champ **Texte** (ex: contenu de la lettre)
4. **📤 Envoyer à tous les joueurs** → overlay plein écran sur chaque téléphone
5. Le handout est conservé dans l'onglet 📬 Reçus du joueur

### Message rapide

Champ en bas du panel → tapez → `Entrée` ou **➤**  
Apparaît dans l'onglet Chat de tous les joueurs.

### Journal d'activité

Le journal (titre cliquable pour replier) trace automatiquement :
- Connexions/déconnexions
- Jets de dés lancés par les joueurs
- Messages et chats
- Demandes d'XP
- Réactions et initiatives

---

## 9. App Mobile — Côté Joueur

### Se connecter

1. Ouvrez le navigateur de votre téléphone
2. Scannez le QR Code ou entrez l'URL manuellement
3. Entrez votre **nom de personnage** → **Rejoindre la Table**

La connexion est automatiquement restaurée en cas de déconnexion.

---

### Onglet 🧙 Perso

Remplissez votre fiche de personnage WFRP :

**Identité**
- Nom, Race (liste depuis la config du vault), Sexe, Alignement
- Vocation (auto-remplie par la carrière), Âge, Taille, Corpulence
- Cheveux, Yeux, Description physique

**Carrière**
- Sélectionnez votre carrière → compétences ajoutées automatiquement
- Cheminement professionnel, Débouchés

**Blessures**
- Blessures actuelles (grande zone éditable) / Maximum (depuis le profil)
- État de santé automatique : ✅ Légèrement blessé / 🩸 Gravement blessé / 💀 Inconscient

**Profil (14 stats WFRP 1e)**

| M | CC | CT | F | E | B | I | A | Dex | Cd | Int | Cl | FM | Soc |
|---|----|----|---|---|---|---|---|-----|----|----|----|----|-----|

Trois rangées : Initial / Plan de carrière / Actuel

**Compétences** — ajout par champ texte, suppression par ✕

**Bouton 📤 Envoyer au MJ** → transmet toute la fiche

> La fiche est sauvegardée localement et restaurée à chaque reconnexion (même téléphone, même navigateur).

---

### Onglet 📄 Fiche

Vue résumé en lecture seule générée depuis la fiche :
- Carte de personnage (nom, race, carrière, âge, sexe)
- Barre de blessures colorée + état de santé
- Grille de stats du profil actuel (avec indicateurs plan de carrière)
- Points importants (Destin, Magie, XP, Folie)
- Compétences, armes, armure, richesses, origines
- Conditions actives
- Suivi de carrière (barres de progression vers les objectifs de stats)

---

### Onglet ⚔️ Combat

**Armes de contact**

| Nom | I | CC | Dommages | Parade |
|-----|---|----|----------|--------|

**Armes de distance**

| Nom | PC | PL | PE | FE | A/T |
|-----|----|----|----|----|-----|

**Armure**

| Description | Localisation | ENC |
|-------------|--------------|-----|

**Points d'armure par zone corporelle**

```
     [ Tête      01–15 ]
[ Bras G. 36–55 ]  [ Bras D. 16–35 ]
     [ Tronc     56–80 ]
[ Jambe G. 91–00] [ Jambe D. 81–90 ]
```

**Table de combat du MJ** — affichée en bas quand le MJ envoie l'état de combat

---

### Onglet 🎒 Équip

- Points de Destin / Magie / Niveau de Pouvoir / XP / Folie
- Sortilèges (Nom, Niveau, PM, Portée, Durée, Composantes, Effets)
- Équipement et dotations
- Richesses
- Allures de déplacement (Prudente / Normale / Rapide × m/Round, m/Tour, km/h)
- Langages, Psychologie & Santé mentale
- Origines sociales (Lieu, Profession des parents, Famille, Rang, Religion)

---

### Onglet 🎲 Dés

**Dés standards :** d4 · d6 · d8 · d10 · d12 · d20 · d100

**Modificateur** : champ numérique ajouté au résultat, formula affichée.

**⚡ Fureur d'Ulric — d10 explosif**  
Lance un d10. Si 10 → relance et additionne. Continue jusqu'à ne plus faire 10.  
Exemple : 10+10+7 = 27 💥

**Test de compétence**  
Chaque caractéristique de votre profil est un bouton. Cliquer → lance un d100 vs la valeur.

| Résultat | Affichage |
|----------|-----------|
| Dé ≤ cible | ✅ Succès (x**N** degrés) |
| Dé > cible | ❌ Échec (x**N** degrés) |

Les degrés = nombre de tranches de 10 au-dessus ou en-dessous.  
Chaque test est envoyé au MJ et apparaît dans son journal.

**Table de localisation**  
Lance un d100 → indique la zone touchée :
- 01–15 : 🧢 Tête
- 16–35 : 💪 Bras Droit
- 36–55 : 💪 Bras Gauche
- 56–80 : 🛡️ Tronc
- 81–90 : 🦵 Jambe Droite
- 91–00 : 🦵 Jambe Gauche

**Jet d'initiative**  
Lance I (valeur de votre stat) + d10 → envoyé au groupe entier et au MJ.

---

### Onglet 💬 Chat

**Deux modes :**
- 🔒 **Privé MJ** — message visible uniquement par le Maître du Jeu
- 👥 **Groupe** — visible par tous les joueurs connectés (vous ne voyez pas votre propre message en double)

**Réactions rapides :** 👍 ❤️ ⚔️ 😱 🤣 🎲 — un tap = envoi instantané à tous.

---

### Onglet 👥 Groupe

**⚡ C'est votre tour !** — barre animée quand le MJ vous donne le tour.

**État du groupe** — carte de chaque joueur connecté :
- Barre de PV colorée
- Conditions actives
- Indicateur de tour

**Mes Conditions** — conditions appliquées par le MJ sur vous (retirées uniquement par le MJ).

**Demande d'XP**  
1. Entrez le montant (ex: 150)
2. **💫 Demander des XP au MJ** → notification dans le panel GM
3. Le MJ clique **Approuver** → vos XP sont ajoutés automatiquement

---

### Onglet 📬 Reçus

Historique de tous les **handouts** envoyés par le MJ pendant la session :
- Titre du handout
- Image (si envoyée)
- Texte

Tapez sur un handout → affichage en **overlay plein écran** (idéal pour les lettres ou documents importants).

---

## 10. Créateur de personnage

Le créateur permet au MJ de générer un personnage complet et de l'envoyer sur le téléphone d'un joueur.

**Prérequis** : un fichier `game.config.md` doit être chargé dans le vault (voir section 12).

### Accès

Bouton **⚔️ Perso** dans la barre d'outils.

### Étape 1 — Race

- Liste des races issues de la config du vault
- Cliquez sur une race → ses stats de base et règles spéciales s'affichent
- Les stats du profil initial sont auto-remplies avec les valeurs raciales

### Étape 2 — Carrière

- Filtrez par catégorie (Combat, Académique, Roublard…)
- Cliquez une carrière → plan de stats + compétences + débouchés affichés
- Pied de page : résumé race + carrière sélectionnés

### Étape 3 — Stats

- **Lancer toutes les stats** — lance les dés pour toutes les stats d'un coup
- **Lancer une par une** — bouton 🎲 par stat
- Résultat = base raciale + dés
- La valeur de Blessures est calculée et affichée en résumé

### Étape 4 — Infos

- **Nom** du personnage
- **Notes** libres (description, historique)
- **Envoyer à un joueur** — liste des joueurs connectés au serveur mobile
- Bouton **📤 Envoyer au joueur** → personnage créé reçu instantanément sur le téléphone
- Bouton **📋 Copier en JSON** → copie les données brutes dans le presse-papier

---

## 11. IA Ollama

### Installation (hors Grimoire)

```bash
# Téléchargez Ollama sur https://ollama.com
# Puis téléchargez un modèle
ollama pull mistral      # recommandé — français correct
ollama pull llama3       # alternatif
ollama pull gemma2       # léger
```

Ollama doit tourner en arrière-plan (`ollama serve`).

### Configurer dans Grimoire

Bouton **⚙️** → Settings :
- **Modèle** — liste des modèles disponibles (mis à jour automatiquement)
- **Prompt système** — contexte permanent envoyé à chaque requête

Exemple de prompt système :
```
Tu es un assistant pour jeu de rôle Warhammer Fantasy (WFRP 1ère édition).
Réponds toujours en français, dans un style sombre et gothique médiéval.
Sois concis et précis. Ne génère pas de statistiques de jeu sauf si demandé.
```

### Utiliser l'IA dans l'éditeur

| Situation | Action | Résultat |
|-----------|--------|----------|
| Texte sélectionné | `Ctrl+J` | L'IA développe/améliore la sélection |
| Curseur sur une ligne | `Ctrl+J` | L'IA développe cette ligne |
| Éditeur vide | `Ctrl+J` | L'IA génère un résumé du document |

La réponse est **insérée directement dans la note** après la sélection ou la ligne.

### Templates + IA

Menu contextuel → **📋 Depuis un template** → bouton **✨** :
1. Grimoire crée le fichier avec le template de base
2. Envoie le contenu à Ollama avec votre prompt système
3. La réponse est ajoutée en bas de la note sous `--- *Généré par IA :*`

---

## 12. Configuration du système de jeu

La config est un fichier dans votre vault qui définit les races, carrières et stats.

### Créer le fichier de config

Créez `game.config.md` (ou tout autre nom) :

```yaml
---
title: Configuration WFRP 1e
grimoire_type: game_config
---
```

Puis le contenu JSON :

```json
{
  "system": "WFRP 1e",
  "version": "1.0",
  "hp_stat": "b",
  "exploding_dice": true,

  "stats": [
    { "key": "m",   "label": "Mouvement" },
    { "key": "cc",  "label": "CC",  "roll": "2d6" },
    { "key": "ct",  "label": "CT",  "roll": "2d6" },
    { "key": "f",   "label": "Force" },
    { "key": "e",   "label": "Endurance" },
    { "key": "b",   "label": "Blessures" },
    { "key": "i",   "label": "Initiative", "roll": "1d10" },
    { "key": "a",   "label": "Attaques" },
    { "key": "dex", "label": "Dextérité", "roll": "2d6" },
    { "key": "cd",  "label": "Cd",  "roll": "2d6" },
    { "key": "int", "label": "Int", "roll": "2d6" },
    { "key": "cl",  "label": "Cl",  "roll": "2d6" },
    { "key": "fm",  "label": "FM" },
    { "key": "soc", "label": "Soc", "roll": "2d6" }
  ],

  "races": [
    {
      "name": "Humain",
      "emoji": "🧑",
      "description": "Les humains de l'Empire de Sigmar.",
      "stats": { "m": 4, "cc": 25, "ct": 25, "f": 3, "e": 3, "b": 8,
                 "i": 30, "a": 1, "dex": 25, "cd": 25, "int": 25,
                 "cl": 25, "fm": 0, "soc": 25 },
      "fate": 3,
      "special": ["Adaptable : +5% dans une compétence au choix"]
    },
    {
      "name": "Elfe",
      "emoji": "🧝",
      "description": "Elfes des Royaumes du Vieux Monde.",
      "stats": { "m": 5, "cc": 40, "ct": 40, "f": 3, "e": 2, "b": 6,
                 "i": 50, "a": 1, "dex": 40, "cd": 40, "int": 40,
                 "cl": 40, "fm": 0, "soc": 40 },
      "fate": 4,
      "special": ["Vision nocturne", "Sens aiguisés"]
    }
  ],

  "careers": [
    {
      "name": "Guerrier",
      "category": "Combat",
      "stat_plan": ["cc", "f", "e", "b"],
      "skills": ["Armes à une main", "Parade", "Esquive"],
      "exits": ["Mercenaire", "Garde du corps", "Champion"]
    },
    {
      "name": "Rodeur",
      "category": "Roublard",
      "stat_plan": ["ct", "i", "dex"],
      "skills": ["Armes à distance", "Discrétion", "Pistage"],
      "exits": ["Chasseur de primes", "Éclaireur", "Forestier"]
    }
  ]
}
```

### Champs importants

| Champ | Rôle |
|-------|------|
| `hp_stat` | Clé de la stat utilisée pour les Blessures (ici `"b"`) |
| `exploding_dice` | Active la Fureur d'Ulric (d10 explosif) dans l'app mobile |
| `stats[].roll` | Formule de dé pour le créateur (`"2d6"` ou `"1d10"`) — absent = valeur fixe raciale |
| `races[].fate` | Points de Destin de départ |
| `races[].special` | Règles spéciales affichées dans le créateur et l'app mobile |
| `careers[].stat_plan` | Stats à faire progresser (surlignées dans le profil) |

### Chargement automatique

Grimoire cherche les fichiers avec `grimoire_type: game_config` à chaque ouverture du vault. La config est transmise au serveur mobile dès le démarrage.

---

## 13. Outils MJ Avancés (Waves 10-13)

### ConditionWheel
**Clic droit** sur un token → roue radiale. Permet d'appliquer/retirer 8 conditions (Étourdi, Saignant, etc.) d'un clic. Le bouton central 🗑️ retire toutes les conditions.

### Calculateur de Dégâts
Bouton **💥** → Entrez une formule (ex: `2d6+4`). Vous pouvez appliquer les dégâts à un ou plusieurs tokens sélectionnés, avec option de réduction (demi-dégâts).

### Générateurs Automatiques
- **⚡ Rencontres** : Génère une liste de monstres adaptée au niveau de danger.
- **🏚️ Salles** : Description d'ambiance, mobilier et pièges pour une pièce.
- **🌦️ Météo Planner** : Prévision sur 7 jours avec effets visuels synchronisés (VTT).
- **🕸️ Relation Map** : Visualisez les liens sociaux entre vos PNJ.

### Notes Partagées & Durées
- **📋 Notes** : Tapez un texte et envoyez-le à tous les joueurs (apparaît en overlay sur leur mobile).
- **⏱️ Durées** : Suivez les effets temporaires (Torche, Sort, Poison) round par round.

---

## 14. Raccourcis clavier

### Éditeur

| Raccourci | Action |
|-----------|--------|
| `Ctrl+K` | Ouvrir la palette de recherche |
| `Ctrl+J` | Génération IA sur la sélection / ligne |
| `[[` | Autocomplétion WikiLinks |
| `Ctrl+Clic` sur `[[lien]]` | Ouvrir la note liée |

### VTT

| Raccourci | Action |
|-----------|--------|
| Molette | Zoom |
| Clic milieu + glisser | Pan (déplacer la vue) |

### App mobile (joueur)

| Geste | Action |
|-------|--------|
| Tap sur tab | Changer d'onglet |
| Tap sur réaction | Envoyer la réaction |
| Tap sur handout reçu | Plein écran |
| Tap sur condition (header groupe) | Aucun effet (retrait = côté MJ seulement) |
| `Entrée` (chat) | Envoyer message |

---

## Annexe — Types de grimoire_type reconnus

| Valeur | Rôle |
|--------|------|
| `game_config` | Configuration du système de jeu (races, carrières, stats) |
| `scenario` | Scénario importé (affiché dans l'index des scénarios) |
| `scenario_index` | Index des scénarios |
| `guide` | Guide ou tutoriel |
| `note` | Note générale (défaut) |

Ces types servent à la recherche FTS5 (filtrage par `entity_type`) et au graphe de liens (couleur des nœuds).

---

*Grimoire — v0.1.0 — Application desktop open-source pour MJ TTRPG*  
*Svelte 5 + Tauri v2 + PixiJS v8 + SQLite FTS5 + Ollama*
