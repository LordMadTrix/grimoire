---
name: Grimoire Project Context
description: TTRPG campaign manager desktop app — Svelte 5 + Tauri v2 + PixiJS v8 + Ollama
type: project
originSessionId: d835a769-d836-4882-b112-49d9039f8028
---
## Vue d'ensemble

Application desktop pour Maîtres du Jeu TTRPG. Chemin : `/home/madtrix/Documents/DEV/grimoire/`

**Stack :**
- Frontend : Svelte 5 (Runes) + SvelteKit
- Desktop : Tauri v2 (Rust)
- VTT : PixiJS v8
- Éditeur : CodeMirror 6
- IA : Ollama (local, Rust `reqwest`)
- Recherche : SQLite FTS5

**Architecture deux fenêtres :**
- Fenêtre GM (`App.svelte`) — éditeur + VTT + tous les contrôles
- Fenêtre Joueur (`PlayerView.svelte`) — affichage carte en lecture seule
- Communication via Tauri `emit`/`listen` (événements : `set_player_map`, `update_fow`, `update_tokens`, `toggle_player_grid`, `toggle_player_blackout`, `sync_vault_path`)

---

## Fichiers stratégiques

| Fichier | Rôle |
|---|---|
| `src/App.svelte` | Shell principal — vault, VTT, navigation |
| `src/PlayerView.svelte` | Vue joueur (second écran) |
| `src/components/MapCanvas.svelte` | Moteur PixiJS v8 — pan/zoom, FOW, tokens |
| `src/components/VTTToolbar.svelte` | Barre outils GM |
| `src/components/InitiativeTracker.svelte` | Tracker de combat |
| `src/components/Sidebar.svelte` | Arbre de fichiers (récursif) |
| `src/components/Editor.svelte` | Wrapper éditeur + rétroliens |
| `src/components/CodeMirrorEditor.svelte` | Éditeur Markdown + IA + WikiLinks |
| `src/components/TokenSettingsModal.svelte` | Édition de token (modal) |
| `src/components/SearchPalette.svelte` | Palette de recherche FTS5 |
| `src/components/SettingsModal.svelte` | Paramètres IA (modèle, prompt système) |
| `src/lib/stores/vtt.svelte.ts` | État VTT partagé |
| `src/lib/stores/vault.svelte.ts` | État vault (fichier actif, arbre, recherche) |
| `src/lib/stores/settings.svelte.ts` | Paramètres IA (persist localStorage) |
| `src/lib/api.ts` | Fonctions `invoke()` vers Rust |
| `src-tauri/src/commands/` | Bridges Rust : vault, search, ai, player_view |

---

## Règles Svelte 5 critiques

- **Toujours `$props()`**, jamais `export let`
- **Variables modifiées depuis PixiJS DOIVENT être `$state`** — sinon Svelte ne re-rend pas
- **`$effect` avec guard `appReady`** dans MapCanvas — évite que les effets tournent avant que PixiJS soit initialisé
- **Composants récursifs** (Sidebar) : utiliser `<script module>` pour un état partagé entre toutes les instances

---

## PixiJS v8 — API de dessin (breaking vs v7)

```typescript
// CORRECT v8
graphics.setStrokeStyle({ width: 2, color: 0xffffff, alpha: 1 });
graphics.circle(x, y, r);
graphics.fill(0x3b82f6);
graphics.stroke(); // OBLIGATOIRE — sans ça, le tracé est invisible

// INTERDIT (v7 seulement)
// beginFill / endFill / lineStyle / drawCircle / drawRect
```

---

## VTT — Fonctionnalités

### MapCanvas
- Pan : clic milieu ou clic droit glissé
- Zoom : molette
- Token gauche : déplacer (mode Sélect)
- Token droit : ouvre `TokenSettingsModal`
- FOW : cercles reveal/hide dessinés sur `RenderTexture` avec `blendMode = 'erase'`
- Mesure : règle avec calcul en mètres (basé sur `gridSize`)
- Snap-to-grid au drop du token
- **Tokens Robustes** : utilisent `PIXI.Assets.load` et un `loadingTextures` Set pour éviter les glitchs au chargement.

### vttStore (`src/lib/stores/vtt.svelte.ts`)
```typescript
vttStore = $state({
  currentMap: null,      // data URL base64
  fowShapes: [],         // historique des zones FOW
  tokens: [],
  mode: 'select',        // 'select' | 'fog-reveal' | 'fog-hide' | 'measure'
  showGrid: true,
  gridSize: 50,          // px par case, contrôle dans VTTToolbar
  combatants: [],        // Initiative tracker
  combatActive: false,
  currentTurn: 0,
})
```

### Communication Inter-Fenêtre
- Nécessite un délai de ~1.5s après l'ouverture de la Vue Joueur pour que les listeners soient prêts.
- `syncStateToPlayerView()` centralise l'envoi de la carte, des tokens, du FOW et du chemin du Vault.

---

## Éditeur Markdown — Fonctionnalités

### WikiLinks `[[...]]`
1. `[[` → autocomplétion (FTS5 si texte, liste locale si vide)
2. Hover → tooltip preview (300 chars, sans frontmatter YAML)
3. `Ctrl+Clic` → ouvre le fichier, ou `confirm()` + création si introuvable

### Rétroliens (backlinks)
- Bouton `🔗 N` dans le header → panneau collapsible en bas
- `$effect` sur `getActiveFile()` → `getBacklinks()` automatique

---

## État du projet

- **Système Onboarding** : Mémorisation du dernier vault, écran d'accueil avec wizard.
- **Organisation Assets** : Tokens classés par catégories (`Heroes`, `Creatures`, `NPCs`).
- **Warhammer Addon** : Intégration de "Château Drachenfels" terminée.
- **Bugs Fixés** : Synchronisation du chemin absolu des assets vers la vue joueur, installation de D3.js.
