# AGENTS.md

Ce fichier sert de référence pour tous les assistants IA (Antigravity, Gemini, Claude Code, etc.) travaillant sur le projet **Grimoire**.

## 🐉 Présentation du Projet
**Grimoire** est une application desktop pour Maîtres du Jeu TTRPG combinant un éditeur Markdown (style Obsidian), une Table Virtuelle (VTT) haute performance (PixiJS v8), un serveur compagnon mobile PWA et une IA locale (Ollama).

- **Frontend** : Svelte 5 (Runes) + Vite + PixiJS v8
- **Backend Desktop** : Tauri v2 (Rust), SQLite FTS5, Axum (WebSockets / HTTP pour Mobile HUB)
- **Map Editor** : Svelte autonome dans `map-editor/`

---

## 🛠 Commandes Clés
- **Lancement Dev (Tauri + Svelte)** : `npm run tauri dev`
- **Lancement Dev Web (Vite seul)** : `npm run vite-dev`
- **Build complet** : `npm run build`
- **Vérification des types / lints** : `npm run check`

---

## 📦 Distribution, Releases & Alertes de Sécurité (Windows SmartScreen / Chrome)

### Contexte de développement actif
- Grimoire est en **développement continu**. Les nouveaux exécutables (`.exe`, `.msi`) publiés sur GitHub Releases ne possèdent pas encore la réputation d'historique Microsoft/Google et ne sont pas signés avec un certificat commercial payant (inutile en phase d'alpha/beta).
- Par conséquent, Chrome peut afficher *« Ce fichier n'est pas couramment téléchargé »* et Windows SmartScreen peut afficher *« Windows a protégé votre ordinateur »*.

### Workflow & Documentation en place
1. **GitHub Actions ([.github/workflows/build.yml](file:///d:/DEV/grimoire/.github/workflows/build.yml))** : Déclenché par les tags `v*`. Il intègre automatiquement un message explicatif dans le corps de la release guidant l'utilisateur (*« Informations complémentaires » > « Exécuter quand même »* et *« Conserver »* sous Chrome).
2. **[README.md](file:///d:/DEV/grimoire/README.md) & [TUTORIEL.md](file:///d:/DEV/grimoire/TUTORIEL.md)** : Contiennent des encadrés expliquant la démarche d'installation et rassurant les utilisateurs.

### Actions recommandées pour les versions majeures / stables
- **Soumission de faux positifs** : [Microsoft Defender Security Intelligence Sample Submission](https://www.microsoft.com/en-us/wdsi/filesubmission) (Option "Software developer").
- **WinGet** : Déploiement sur le catalogue officiel Microsoft `microsoft/winget-pkgs`.
- **Certificat Open Source** : Étude d'une intégration avec SignPath.io si signature requise plus tard.
