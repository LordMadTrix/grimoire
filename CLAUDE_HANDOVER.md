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
- Communication via Tauri `emit`/`listen` (événements : `set_player_map`, `update_fow`, `update_tokens`, `toggle_player_grid`, `toggle_player_blackout`)

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
- **Variables modifiées depuis PixiJS DOIVENT être `$state`** — sinon Svelte ne re-rend pas (bug `editingTokenId` : était `let` plain, le modal n'apparaissait jamais)
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

### FOW
- `addGmFowShape()` — ajoute une zone, émet au PlayerView
- `undoGmFow()` — retire la dernière zone (pop + emit)
- `clearGmFow()` — reset complet

### Tokens
- `addGmToken / replaceGmToken / removeGmToken / updateGmToken`
- Token type : `{ id, name, x, y, size, color?, hp?, maxHp?, visionRange?, isEnemy? }`
- Couleur : picker CSS→PixiJS via `parseInt(hex.slice(1), 16)`
- Vision : `visionRange` cases → rayon en px = `visionRange * gridSize`, rendu par erase blendMode dans FOW

### Initiative Tracker
- `startCombat()` : importe tokens → combattants (initiative d20 aléatoire, triés desc)
- `nextTurn / prevTurn / stopCombat`
- `updateCombatantHp(id, hp)` : sync vers le token VTT associé (`tokenId`)
- `addCombatant / removeCombatant`
- Panneau sous le canvas quand `combatActive`

---

## Éditeur Markdown — Fonctionnalités

### WikiLinks `[[...]]`
1. `[[` → autocomplétion (FTS5 si texte, liste locale si vide)
2. Hover → tooltip preview (300 chars, sans frontmatter YAML)
3. `Ctrl+Clic` → ouvre le fichier, ou `confirm()` + création si introuvable

### Rétroliens (backlinks)
- Bouton `🔗 N` dans le header → panneau collapsible en bas
- `$effect` sur `getActiveFile()` → `getBacklinks()` automatique
- Chaque entrée cliquable pour naviguer

### Auto-save + Reindex
- Auto-save : 1.5s après dernière frappe (pas de reindex)
- `Ctrl+S` / bouton 💾 : sauvegarde + `reindex()` fire & forget

---

## Sidebar

- Tri : `$derived` → dossiers d'abord, puis fichiers, alphabétique insensible à la casse
- Clic droit → menu contextuel (état partagé `<script module>` entre instances récursives, rendu à `depth === 0` uniquement)
  - `📄 Nouveau fichier` → writeFile + refresh + ouvre dans éditeur
  - `📁 Nouveau dossier` → createDirectory + refresh
  - `✏️ Renommer` → renameEntry + met à jour activeFile si besoin
  - `🗑️ Supprimer` (fichiers uniquement) → deleteFile + vide l'éditeur si actif
- Seuls les `.md` s'ouvrent dans l'éditeur (images/audio : `opacity: 0.65`, cursor: default)

---

## Raccourcis clavier globaux

| Raccourci | Action |
|---|---|
| `Ctrl+P` | Palette de recherche FTS5 |
| `Ctrl+N` | Nouveau fichier (prompt → vault root) |
| `Ctrl+S` | Sauvegarder + reindex |
| `Ctrl+J` | Génération Ollama sur sélection / ligne courante |
| `Ctrl+Clic` | Suivre un wikilink |

---

## Patterns importants

### PlayerView listeners (éviter la fuite mémoire)
```typescript
onMount(() => {
  const unlistens: (() => void)[] = [];
  listen('event_name', handler).then(fn => unlistens.push(fn));
  return () => { unlistens.forEach(fn => fn()); };
});
// NE PAS utiliser async onMount avec return — Svelte ignore la Promise
```

### Refresh de l'arbre vault après modification
```typescript
const tree = await openVault(getVaultPath());
setVaultTree(tree); // → App.svelte re-rend Sidebar automatiquement via réactivité
```

### Reindex strategy
- Au chargement du vault
- Après Ctrl+S (fire & forget)
- Bouton manuel `🔄 Réindexer` dans le footer de la sidebar
- Pas sur auto-save (trop fréquent)

---

## État du projet

Base complète et fonctionnelle. Toutes les fonctionnalités GM principales sont implémentées. Les prochains travaux sont des ajouts de fonctionnalités (images de tokens, sons d'ambiance, graphe de liens, etc.).
