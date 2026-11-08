# Application Compagnon Mobile & Tablette Autonome (Android APK & iOS PWA)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la simple page web par une véritable application autonome pour les joueurs sur smartphone et tablette (Android APK installable + iOS PWA plein écran), avec stockage persistant garanti de la fiche sur l'appareil (IndexedDB), mode hors-ligne complet à la maison, détection/scanner QR et synchronisation automatique bidirectionnelle dès l'arrivée à la table de jeu.

**Architecture:**
1. **Stockage Offline-First (IndexedDB)** : La fiche appartient au joueur et reste gravée dans son téléphone/tablette. L'application s'ouvre hors connexion à la maison avec consultation et édition libres. Export et import de fichiers `.grimoire-hero.json` en 1 clic.
2. **Synchronisation Réseau & Scanner Caméra** : Détection du statut de connexion (⚪ Hors-ligne, 🟡 Recherche, 🟢 Connecté). Scanner de QR Code intégré par la caméra du téléphone pour se connecter sans taper d'IP. Échange et réconciliation automatique des fiches entre le téléphone et le Grimoire PC du MJ.
3. **Application PWA Standalone (iOS / iPadOS)** : Manifeste web complet (`display: standalone`), service worker pour fonctionnement hors-ligne absolu, icônes haute résolution et guide d'installation 1 clic sur l'écran d'accueil d'Apple Safari.
4. **Application Android Native (APK)** : Projet mobile Capacitor/Android générant l'APK `Grimoire-Compagnon.apk`. Téléchargement direct depuis l'écran du MJ sur le réseau local (`/download/apk`) et intégration dans le pipeline GitHub Actions Release.

**Tech Stack:** JavaScript (ES2022), IndexedDB (Dexie/idb ou API native robuste), Service Worker Cache Storage, Web Cam QR Scanner (`html5-qrcode`), Capacitor v6 (Android Native), Rust (Axum endpoint de distribution APK).

---

## Global Constraints

- **Aucune perte de données joueur** : Le stockage local sur l'appareil du joueur doit utiliser `IndexedDB` avec persistance demandée (`navigator.storage.persist()`), indépendant des nettoyages de cache Safari/Chrome.
- **Fonctionnement hors-ligne total** : L'application doit pouvoir être ouverte dans le train ou chez soi sans connexion au serveur du MJ.
- **Compatibilité universelle** :
  - Android : APK installable directement + PWA Chrome.
  - Apple (iPhone / iPad) : PWA Standalone plein écran sans barre Safari.
- **Zéro régression sur Grimoire Desktop** : Le serveur Axum Tauri v2 continue de gérer les WebSockets, la carte VTT et le combat.

---

## Tasks

### Tâche 1 : Moteur de Stockage Persistant IndexedDB & Mode Hors-Ligne Joueur
- [ ] **1.1** Concevoir le module de persistance locale `heroStorage` dans `src-tauri/src/commands/player_app.html` :
  - Création de la base IndexedDB `grimoire_player_db` (table `characters` et table `settings`).
  - Fonctions `saveHeroLocally(heroData)`, `loadHeroLocally(heroId)`, `listLocalHeroes()`, `deleteHeroLocally(heroId)`.
  - Demande automatique de persistance durable (`navigator.storage.persist()`).
- [ ] **1.2** Interface de gestion des personnages hors-ligne :
  - Sélecteur de profil / personnage sur l'appareil du joueur.
  - Bouton « 💾 Exporter ma fiche (Fichier de secours JSON) ».
  - Bouton « 📥 Importer une fiche (Depuis un fichier) ».
- [ ] **1.3** Permettre la consultation et l'édition de la fiche même sans serveur Grimoire actif (Mode Hors-Ligne).
- [ ] **1.4** Test et vérification : Émuler une coupure réseau, recharger la page, vérifier que les points de vie, caractéristiques et inventaire restent 100% intacts.

---

### Tâche 2 : Scanner QR Code par Caméra & Bandeau de Synchronisation Intelligent
- [ ] **2.1** Intégrer un scanner de QR Code fluide utilisant la caméra du smartphone (bouton « 📷 Scanner la Table » sur l'écran de connexion).
- [ ] **2.2** Bandeau d'état dynamique en tête d'application :
  - ⚪ **Mode Hors-Ligne** : Fiche active sur l'appareil, prêt à jouer.
  - 🟡 **Connexion…** : Recherche du Grimoire du MJ en cours.
  - 🟢 **Synchronisé** : Connecté à la table de `[Nom du MJ]`.
- [ ] **2.3** Protocole de synchronisation automatique bidirectionnelle à la connexion :
  - Le téléphone transmet sa fiche locale avec horodatage (`last_modified`).
  - Grimoire intègre le personnage dans la campagne du MJ.
  - Tout événement de jeu (attribution d'XP, dégâts, objet ajouté) met à jour la mémoire IndexedDB du téléphone en temps réel.
- [ ] **2.4** Test et vérification : Connexion WebSocket, test d'envoi et de sauvegarde automatique.

---

### Tâche 3 : Transformation en PWA Standalone (iOS iPhone / iPad & Android)
- [ ] **3.1** Créer le fichier `manifest.webmanifest` avec métadonnées complètes :
  - Nom : `Grimoire Compagnon`, icônes 192x192 et 512x512, couleur de thème `#0a0c10`, fond noir rôliste.
  - `display: standalone` pour supprimer toute interface de navigateur (plein écran natif).
- [ ] **3.2** Créer le `sw.js` (Service Worker) pour mettre en cache l'application et ses polices/icônes pour une ouverture instantanée même sans réseau.
- [ ] **3.3** Ajouter une bannière d'installation intuitive pour iOS Safari :
  - « Pour installer l'app sur votre iPhone/iPad : Touchez ⬆️ Partager puis "Sur l'écran d'accueil" ».
- [ ] **3.4** Servir ces fichiers statiques via le serveur Rust Axum (`/manifest.webmanifest`, `/sw.js`, `/icons/`).
- [ ] **3.5** Test et vérification : Audit Lighthouse PWA / validation du cache Service Worker.

---

### Tâche 4 : Projet Android Natif (Génération de l'APK Autonome)
- [ ] **4.1** Initialiser le sous-projet mobile autonome `player-app-mobile/` avec Capacitor Android (`@capacitor/core`, `@capacitor/android`, `@capacitor/cli`).
- [ ] **4.2** Configurer le packaging Android : `appId: net.madtrix.grimoire.companion`, autorisations caméra (pour scanner le QR Code du MJ) et vibrations haptiques.
- [ ] **4.3** Configurer le build de l'APK installable sans Play Store (`Grimoire-Compagnon.apk`).
- [ ] **4.4** Ajouter dans Grimoire Desktop (modal Mobile du MJ) un bouton « 📥 Télécharger l'APK Joueur Android » qui fournit directement le fichier `.apk` aux joueurs connectés en Wi-Fi.
- [ ] **4.5** Ajouter dans `.github/workflows/build.yml` l'étape de compilation de l'APK Android pour que chaque Release GitHub contienne automatiquement le setup Windows ET l'APK Android !
- [ ] **4.6** Test et vérification : Build de l'APK, test de téléchargement et validation du flux.

---

### Tâche 5 : Documentation, Guide Joueur & Validation Finale
- [ ] **5.1** Mettre à jour `README.md` et `TUTORIEL.md` avec le guide d'installation du Compagnon (Android APK & iOS PWA).
- [ ] **5.2** Mettre à jour le site web `docs/index.html` avec les liens de téléchargement de l'APK et les instructions iPhone/iPad.
- [ ] **5.3** Validation complète de bout en bout et publication.
