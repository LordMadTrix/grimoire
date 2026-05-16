---
name: Grimoire Project Context
description: TTRPG campaign manager desktop app — Svelte 5 + Tauri v2 + PixiJS v8 + Ollama
type: project
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
- Serveur Joueurs : Axum (HTTP + WebSocket embarqué dans Tauri)

**Architecture deux fenêtres + mobile :**
- Fenêtre GM (`App.svelte`) — éditeur + VTT + tous les contrôles
- Fenêtre Joueur (`PlayerView.svelte`) — affichage carte en lecture seule
- App Mobile Joueurs — HTML/CSS/JS embarqué dans `player_server.rs` (servi sur HTTP local)
- Communication inter-fenêtres : Tauri `emit`/`listen`
- Communication GM↔Joueurs mobiles : WebSocket (broadcast + `target_id` côté client)

---

## Fichiers stratégiques

| Fichier | Rôle |
|---|---|
| `src/App.svelte` | Shell principal — vault, VTT, navigation, scènes multimap |
| `src/PlayerView.svelte` | Vue joueur (second écran) + panneau statut groupe |
| `src/components/MapCanvas.svelte` | Moteur PixiJS v8 — pan/zoom, FOW, tokens, sorts, météo, dessin, minimap |
| `src/components/VTTToolbar.svelte` | Barre outils GM (modes, météo, sorts, handout, audio ×2, SoundBoard, MonsterLibrary) |
| `src/components/InitiativeTracker.svelte` | Tracker de combat |
| `src/components/SessionDashboard.svelte` | HUD overlay (round, timer, HP bars combattants) |
| `src/components/SoundBoard.svelte` | 5 slots audio FX |
| `src/components/MonsterLibrary.svelte` | 20 monstres + custom JSON + générateur de rencontres |
| `src/components/Calendar.svelte` | Calendrier in-game 12 mois × 30 jours |
| `src/components/Sidebar.svelte` | Arbre de fichiers (récursif) + preview + templates + drag |
| `src/components/Editor.svelte` | Wrapper éditeur + rétroliens + frontmatter + PDF + preview + wiki-nav |
| `src/components/CodeMirrorEditor.svelte` | Éditeur Markdown + IA + WikiLinks + images inline + checklists |
| `src/components/TokenSettingsModal.svelte` | Édition token — conditions + durées + concentration + aura + lumière |
| `src/components/RollTables.svelte` | Tables aléatoires flottantes (Ctrl+T) |
| `src/components/Timeline.svelte` | Timeline in-game |
| `src/components/DiceRoller.svelte` | Lanceur de dés + animation + callback `onRoll` |
| `src/components/GraphView.svelte` | Graphe relations D3 |
| `src/components/PlayerMobileManager.svelte` | Panel GM : QR, joueurs, chat, événements |
| `src/components/CharacterCreator.svelte` | Créateur de personnage WFRP step-by-step |
| `src/lib/stores/vtt.svelte.ts` | État VTT partagé + multimap + drawPaths + undo stack |
| `src/lib/stores/vault.svelte.ts` | État vault + tags cache |
| `src/lib/stores/gameConfig.svelte.ts` | Config WFRP depuis vault |
| `src/lib/api.ts` | Fonctions `invoke()` vers Rust |
| `src-tauri/src/commands/player_server.rs` | Serveur HTTP+WS joueurs + app HTML embarquée (slots de sorts inclus) |
| `src-tauri/src/commands/ai.rs` | Bridge Ollama |
| `src-tauri/src/indexer.rs` | FTS5 SQLite |

---

## Règles Svelte 5 critiques

- **Toujours `$props()`**, jamais `export let`
- **Variables modifiées depuis PixiJS DOIVENT être `$state`**
- **`$effect` avec guard `appReady`** dans MapCanvas
- **Composants récursifs** (Sidebar) : `<script module>` pour état partagé
- **`$derived.by(() => {...})`** pour les dérivations complexes (pas `$derived(() => fn)`)
- **Pas de TypeScript parameter properties dans `<script>`** : définir séparément
- **`$state<T>` générique interdit avec TS 6** → utiliser `let x: T = $state({...})`
- **Variable nommée `state` interdite** → conflit avec la rune `$state` dans les templates (Svelte traite `$state` en template comme store auto-sub)
- **`onMount(async)` retournant cleanup** → TS 6 refuse `Promise<() => void>` ; pattern obligatoire :
  ```typescript
  const _unlisten: (() => void)[] = [];
  onMount(() => {
    (async () => { _unlisten.push(await listen(...)); })();
    return () => _unlisten.forEach(fn => fn());
  });
  ```
- **Import `.svelte.ts` avec extension** → utiliser `.svelte` sans `.ts`
- **`bind:this` canvas + narrowing null** → pattern deux étapes :
  ```typescript
  if (!canvas) return cleanup;
  const ctxRaw = canvas.getContext('2d');
  if (!ctxRaw) return cleanup;
  const ctx: CanvasRenderingContext2D = ctxRaw; // TS narrow dans les closures
  ```

---

## PixiJS v8 — API de dessin

```typescript
graphics.setStrokeStyle({ width: 2, color: 0xffffff, alpha: 1 });
graphics.circle(x, y, r).fill(0x3b82f6).stroke(); // stroke() OBLIGATOIRE après fill
// Interdit : beginFill / endFill / lineStyle / drawCircle / drawRect
```

---

## VTT — État global (`vttStore`)

```typescript
vttStore = $state({
  currentMap: null as string | null,        // data URL (runtime)
  currentMapRelPath: null as string | null,
  fowShapes: [] as FowShape[],
  tokens: [] as Token[],
  pins: [] as MapPin[],
  mode: 'select' as 'select'|'fog-reveal'|'fog-hide'|'fog-rect'|'measure'|'ping'|'pin'|'spell'|'zoom-rect'|'draw'|'blueprint'|'audio-zone'|'terrain',
  fitRequest: 0,
  showGrid: true,
  gridSize: 50,
  weather: 'none' as 'none'|'rain'|'snow'|'fog'|'embers',
  spells: [] as SpellMarker[],
  spellType: 'fire' as SpellMarker['type'],
  spellRadius: 80,
  spellShape: 'circle' as 'circle'|'cone'|'line',   // ← Vague 6
  spellAngle: 0,                                      // ← Vague 6
  spellAngleDeg: 0,                                   // ← Vague 6
  spellLength: 200,                                   // ← Vague 6
  spellConeAngle: Math.PI / 3,                        // ← Vague 6
  audioSrc: null as string | null,
  audioVolume: 0.5,
  audio2Src: null as string | null,                   // ← Vague 6
  audio2Volume: 0.4,                                  // ← Vague 6
  combatants: [] as Combatant[],
  combatActive: false,
  currentTurn: 0,
  combatRound: 1,
  sessionTimerStart: null as number | null,
  isBlackout: false,
  maps: [] as MapScene[],
  activeMapId: null as string | null,
  drawPaths: [] as DrawPath[],
  drawColor: 0xe5a853 as number,
  drawWidth: 4,
  campaignTitle: '' as string,                        // ← Vague 7
  walls: [] as WallDef[],                             // ← Vague 9
  audioZones: [] as AudioZoneDef[],                   // ← Vague 9
  combatLog: [] as CombatLogEntry[],                  // ← Wave 10
  terrainZones: [] as TerrainZone[],                  // ← Wave 10
  terrainType: 'difficult' as TerrainZone['type'],    // ← Wave 10
  sharedNotes: [] as SharedNote[],                    // ← Wave 10
  exportRequest: 0,                                   // ← Wave 10 (incrémenté pour export PNG)
})
```

---

## Types principaux

```typescript
type Token = {
  id: string; name: string; x: number; y: number; size: number;
  color?: number; hp?: number; maxHp?: number;
  visionRange?: number; lightRadius?: number;
  isEnemy?: boolean; imageUrl?: string; visible?: boolean;
  conditions?: string[];
  conditionDurations?: Record<string, number>; // ← Vague 6 — rounds restants par condition
  concentrating?: boolean;                      // ← Vague 6 — anneau violet
  notes?: string; auraRadius?: number; auraColor?: number;
  linkedNote?: string; playerId?: string;
};

type MapPin = {
  id: string; x: number; y: number; label: string;
  color?: number; playerVisible?: boolean;
  secret?: boolean;      // ← Vague 6 — visible GM seulement
  secretText?: string;   // ← Vague 6 — texte révélé aux joueurs
  revealed?: boolean;    // ← Vague 6 — si true → envoyé aux joueurs
};

type SpellMarker = {
  id: string; x: number; y: number;
  type: 'fire'|'ice'|'lightning'|'poison'|'silence'|'divine'|'darkness';
  radius: number; label?: string;
  shape?: 'circle'|'cone'|'line'; // ← Vague 6
  angle?: number;                  // ← Vague 6 — radians
  length?: number;                 // ← Vague 6 — longueur ligne
  coneAngle?: number;              // ← Vague 6 — ouverture cône
};

type DrawPath = { id: string; points: {x: number; y: number}[]; color: number; width: number };
type WallDef = {
  id: string;
  points: { x: number; y: number }[];
  type: 'opaque' | 'door';
  isOpen?: boolean;
};
type AudioZoneDef = {
  id: string; x: number; y: number;
  radius: number; audioSrc: string; volume: number;
};
type MapScene = {
  id: string; name: string; relPath: string|null;
  fowShapes: FowShape[]; tokens: Token[]; pins: MapPin[]; spells: SpellMarker[];
  walls: WallDef[]; audioZones: AudioZoneDef[];
};
type FowShape = { type: 'circle'|'rect'; op: 'reveal'|'hide'; x: number; y: number; radius?: number; width?: number; height?: number };
type Combatant = { id: string; name: string; initiative: number; hp: number; maxHp: number; isEnemy: boolean; tokenId?: string };
// ← Wave 10 types:
type CombatLogEntry = { id: number; round: number; timestamp: number; type: 'damage'|'heal'|'death'|'turn'|'condition'|'info'; actor: string; value?: number; detail?: string };
type TerrainZone = { id: string; x: number; y: number; w: number; h: number; type: 'difficult'|'water'|'fire'|'poison'|'safe'|'custom'; color?: number; label?: string };
type SharedNote = { id: string; title: string; body: string; ts: number };

type UndoEntry =
  | { type: 'fow'; shapes: FowShape[] }
  | { type: 'draw'; paths: DrawPath[] }
  | { type: 'tokens'; tokens: Token[] };
```

---

## MapCanvas — Couches PixiJS (ordre)

1. `backgroundSprite` (carte)
2. `gridGraphics`
3. `fogLayer` (FOW RenderTexture)
4. `tokenLayer` + `tokenSprites` Map
5. `pingLayer`
6. `pinLayer` + `pinContainers` Map
7. `spellLayer` + `spellContainers` Map (AOE world-space — cercle/cône/ligne)
8. `drawLayer` + freehand paths
9. `wallLayer` + murs/portes blueprint (lignes PixiJS) ← Vague 9
10. `audioZoneLayer` + zones sonores (cercles semi-transparents, GM seulement) ← Vague 9
11. `terrainLayer` + zones terrain (rectangles colorés semi-transparents + labels) ← Wave 10
12. `movePathG` + chemin de déplacement (ligne jaune pointillée) ← Wave 10
13. `previewShape`
- `weatherLayer` → `app.stage` (screen-space)
- `floatTextLayer` → `app.stage` (screen-space, textes dés flottants)
- `minimapCanvas` → overlay HTML (bottom-right, GM seulement)

---

## MapCanvas — Props

```typescript
{
  mapUrl, gridEnabled, gridSize, isGM,
  fowShapes, tokens, pins, spells, weather,
  vaultPath, vttMode, fitRequest, activeTokenId,
  externalPing, externalCamera, externalRoll,
  drawPaths, drawColor, drawWidth,
  walls?: WallDef[],       // ← Vague 9
  audioZones?: AudioZoneDef[],  // ← Vague 9
  onFowUpdate, onTokenMove, onTokenUpdate, onTokenDelete, onTokenDrop,
  onPinPlace, onPinDelete,
  onPinReveal,    // ← Vague 6 — toggle pin.revealed (clic droit sur pin secret)
  onSpellPlace, onSpellDelete,
  onDrawPath,
}
```

---

## Fonctions store exportées

```typescript
// FOW
addGmFowShape(shape), clearGmFow(), undoGmFow()

// Tokens
addGmToken(token), updateGmToken(id,x,y), replaceGmToken(token),
removeGmToken(id)

// Pins
addGmPin(pin), removeGmPin(id), clearGmPins()
revealGmPin(id)        // ← Vague 6 — toggle pin.revealed + re-emit pinsForPlayers()

// Audio piste 1
updateGmAudio(src), setGmAudioVolume(vol)
// Audio piste 2 ← Vague 6
updateGmAudio2(src), setGmAudio2Volume(vol)

// Sorts
addSpell(spell), removeSpell(id), clearSpells()
setWeather(w)

// Draw
addDrawPath(path), undoDrawPath(), clearDrawPaths()

// Murs & Blueprint ← Vague 9
addGmWall(wall), removeGmWall(id), clearGmWalls(), undoGmWall()
toggleGmDoor(id)   // bascule isOpen sur un mur de type 'door'

// Zones Audio ← Vague 9
addGmAudioZone(zone), removeGmAudioZone(id)

// Undo global
pushUndo(entry), undoMapAction(), canUndo()

// Combat
startCombat(), stopCombat(), nextTurn(), prevTurn()
// nextTurn() ← Vague 6 : décrémente conditionDurations du combattant actif, retire cond. à 0
updateCombatantHp(id, hp), addCombatant(c), removeCombatant(id)

// Multimap
addMapScene(name,relPath,dataUrl), switchMapScene(id),
removeMapScene(id), renameMapScene(id,name)

// Session
saveGmSession(), loadGmSession()
syncStateToPlayerView()   // version locale dans App.svelte (inclut vault_path + isBlackout)
```

---

## Undo System

```typescript
// pushUndo() avant CHAQUE mutation de : fowShapes, tokens, drawPaths
// undoMapAction() → pop + restore + re-emit vers vue joueur
// MAX_UNDO = 30 entrées
// Ctrl+Z dans VTTToolbar → undoMapAction()
// ↩️ bouton dans toolbar ligne 2
```

---

## Pins secrètes ← Vague 6

```
GM crée une pin :
  prompt("Nom") → confirm("Secrète ?") → prompt("Texte révélé (optionnel)")
  addGmPin({ ..., secret: true, secretText: "...", playerVisible: false })

Rendu MapCanvas (GM) :
  - non révélée : cercle gris + "🔒 label"
  - révélée     : cercle vert + "🔓 label"
  - clic droit sur pin secrète → revealGmPin(id) (toggle)
  - clic droit sur pin normale → removeGmPin(id) (comportement existant)

Envoi aux joueurs :
  pinsForPlayers() → filtre secret=true && revealed=false
  pins révélées → envoyées SANS secretText (sauf si revealed=true)
```

---

## Durée des conditions ← Vague 6

```
TokenSettingsModal :
  chaque condition active affiche un <input type="number" class="cond-dur-input">
  vide = durée infinie, nombre = rounds restants

nextTurn() dans store :
  trouve le token du combattant actif (via tokenId)
  pour chaque conditionDuration : rounds-- → retire la condition si rounds <= 0
  re-émet update_tokens vers vue joueur
```

---

## Concentration ← Vague 6

```
Token.concentrating = true/false (checkbox dans TokenSettingsModal)
MapCanvas renderTokens() :
  si concentrating → double anneau violet (0xa855f7) autour du token
    - anneau 1 : r+9, width:3, alpha:0.9
    - anneau 2 : r+14, width:1, alpha:0.4
  anneau stocké comme (container as any).__concRing
```

---

## Gabarits de sorts cône/ligne ← Vague 6

```
vttStore.spellShape = 'circle' | 'cone' | 'line'
vttStore.spellAngleDeg → slider 0-360° en toolbar
vttStore.spellAngle = angleDeg * Math.PI / 180

renderSpells() dans MapCanvas :
  - 'circle' → comportement existant (cercle)
  - 'cone'   → moveTo(0,0) + arc + lineTo(0,0) + fill + stroke
  - 'line'   → rectangle orienté (largeur = radius/4) + fill + stroke

VTTToolbar :
  boutons ⭕🔺➡️ pour choisir le gabarit
  slider direction pour cône + ligne
  slider ouverture pour cône (spellConeAngle)
  input longueur pour ligne (spellLength)
```

---

## Audio — Deux pistes ← Vague 6

```
vttStore.audioSrc / audioVolume        ← piste 1 (🎵/🔊)
vttStore.audio2Src / audio2Volume      ← piste 2 (🎶/🔈)

App.svelte : deux <AudioPlayer> indépendants
VTTToolbar : deux boutons + pickers + volumes + stop séparés
emitToPlayerView 'update_player_audio' :
  { src, volume, src2, volume2 }
PlayerView.svelte : listen 'update_player_audio' → deux AudioPlayer
```

---

## Navigation wiki-links dans preview ← Vague 6

```
markdownToHtml() dans Editor.svelte :
  [[note]] ou [[note|alias]] →
  <a class="wikilink" data-href="note.md">display</a>

preview-panel onclick :
  closest('[data-href]') → setActiveFile(dir + href)
  résout le chemin relatif au fichier courant

CSS : couleur accent, border-bottom dashed, cursor pointer
```

---

## Générateur de rencontres ← Vague 6

```
MonsterLibrary.svelte :
  bouton 🎲 dans le header
  Panel : CR min, CR max, nombre, bouton "Générer"
  Filtre : allMonsters où isEnemy=true && crToNum(cr) in [minCR, maxCR]
  Résultat : affichage chips colorées + bouton "Poser sur la carte"
  spawnEncounter() → appelle spawnToken(m) pour chaque monstre
```

---

## Panneau statut groupe (vue joueur) ← Vague 6

```
PlayerView.svelte :
  panneau absolu bottom-left, visible si currentMap && !isBlackout
  tokens filtrés : !isEnemy && visible !== false && maxHp > 0
  par token : nom, barre HP colorée (vert/jaune/rouge), HP texte,
              emojis conditions, 🔮 si concentrating
  pointer-events: none (ne bloque pas la carte)
```

---

## Slots de sorts — App mobile ← Vague 6

```
Structure dans ch (localStorage grimoire_wfrp2) :
  ch.spellSlots = [{ level: 1, total: 4, used: 0 }, ...]

Fonctions JS :
  rSpellSlots()       → re-render le panneau (boutons cases à cocher)
  toggleSlot(i, box)  → clic sur case → incrémente/décrémente used
  addSlotLevel()      → ajoute { level: nextLevel, total: 4, used: 0 }
  restoreAllSlots()   → used=0 sur tous (repos long)

UI : section "Emplacements de Sorts" dans l'onglet Perso
  cases colorées (violet plein = utilisé, transparent = libre)
  input total modifiable par niveau
  bouton ✕ pour supprimer un niveau
  bouton ⟳ Repos long
```

---

## Vue joueur — Effets visuels ← Vague 7

### Starfield canvas
```
<canvas bind:this={starfieldCanvas} class="starfield" class:hidden={!!currentMap && !isBlackout}>

200 étoiles : { x, y, r, base (alpha de base), speed, phase }
  → chaque frame : alpha = base + sin(t * speed + phase) * 0.25

Nébuleuses : 2 radialGradient positionnés à (30%,40%) et (70%,60%)

Étoiles filantes (Meteor) : { x, y, vx, vy, life, maxLife }
  → spawnMeteor() si maintenant - lastMeteor > 6000 + rand*8000
  → trail via createLinearGradient transparent→blanc, lineWidth 1.5
  → fade in (life < 30%) / fade out (life > 30%)

canvas.hidden → opacity:0 (CSS transition 0.8s), toujours présent dans DOM
```

### Vignette torche
```css
.vignette {
  background: radial-gradient(ellipse at 50% 50%,
    transparent 38%, rgba(0,0,0,0.35) 65%, rgba(0,0,0,0.72) 100%);
  animation: torch 4.5s ease-in-out infinite;
}
/* 6 keyframes irréguliers — opacity 0.87-1.0, scale 0.996-1.012 */
```

### Coins ornementés
```
SVG inline stocké comme const cornerSvg dans le script
Rendu via {@html cornerSvg} dans 4 divs
.corner-tl → transform: none
.corner-tr → transform: scaleX(-1)
.corner-bl → transform: scaleY(-1)
.corner-br → transform: scale(-1)
opacity: 0.75, filter: drop-shadow(0 0 6px rgba(201,168,76,0.4))
```

### Titre de campagne
```
vttStore.campaignTitle → setCampaignTitle(title) → emitToPlayerView('set_campaign_title', { title })
PlayerView : listen('set_campaign_title', e => campaignTitle = e.payload.title)

Affichage sur carte  : .map-title — top:14px, centré, font Georgia, letter-spacing:4px,
                        couleur rgba(201,168,76,0.7), text-shadow glow
Affichage en attente : .waiting-campaign — font-size:42px, animation glow-pulse 3.5s
Input GM             : .campaign-title-input dans VTTToolbar (width:140px)
```

### Événement ajouté
```
set_campaign_title → { title: string }
```

---

## Patterns critiques

### Image loading (universel)
```typescript
// TOUJOURS readFileBase64, JAMAIS convertFileSrc (pas de permission asset://)
const b64 = await readFileBase64(`${vaultPath}/${relativePath}`);
const mime = ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
img.src = `data:${mime};base64,${b64}`;
```

### syncStateToPlayerView (App.svelte — version LOCALE)
```typescript
// NE PAS importer syncStateToPlayerView du store — version locale inclut sync_vault_path + isBlackout
// La version du store n'a pas ces deux éléments
```

### Frontmatter relations (format attendu)
```yaml
---
name: Aldric le Gris
type: npc
relations:
  - target: kira.md
    label: allié
    type: ally
---
```

### Token — rendu concentrating
```typescript
// (container as any).__concRing stocke le Graphics
// Créé/detruit à chaque renderTokens() selon token.concentrating
// Ne pas utiliser container.children[N] — index instable
```

---

## Communication Inter-Fenêtre — Événements

```
GM → Vue Joueur (Tauri emit/listen) :
  set_player_map      → { url }
  update_fow          → FowShape[]
  update_tokens       → Token[]
  update_pins         → MapPin[] (filtrés par pinsForPlayers())
  toggle_player_grid  → { show, size? }
  toggle_player_blackout → { active }
  sync_vault_path     → { path }
  update_player_audio → { src, volume, src2, volume2 }   ← Vague 6 : + src2/volume2
  player_ping         → { x, y }
  show_handout        → { type, content, title }
  set_weather         → { weather }
  update_spells       → SpellMarker[]
  sync_camera         → { scaleX, scaleY, x, y }
  map_roll            → { text }
  update_draw_paths   → DrawPath[]
  set_campaign_title  → { title }                     ← Vague 7
  dice_roll_broadcast → { die, total, formula }       ← Vague 8
  map_snapshot        → { dataUrl }                   ← Vague 8
  update_combatants   → { combatants, active, currentTurn, combatRound }  ← Wave 10
  spotlight_token     → { tokenId }                   ← Wave 10
  ambient_text        → { text }                      ← Wave 10
  shared_note         → { id, title, body }           ← Wave 10
  update_terrain      → TerrainZone[]                 ← Wave 10
  fit_camera          → {}  ← Wave 13 (signal : joueur fait son propre fitMapToScreen)
```

---

## Serveur Joueurs Mobiles

### Architecture (`src-tauri/src/commands/player_server.rs`)
- Serveur Axum (HTTP + WebSocket) lancé dans un thread Tokio séparé
- État global via `OnceLock<Arc<ServerInner>>`
- `ServerInner` : `broadcast_tx`, `players`, `game_config`, `saved_characters`, `app_handle`, `shutdown_tx`

### App Mobile HTML embarquée
- Entière dans `PLAYER_APP_HTML` (const dans `player_server.rs`)
- Onglets : 🧙 Perso | 📄 Fiche | ⚔️ Combat | 🎒 Équip | 🎲 Dés | 💬 Chat | 👥 Groupe | 📬 Reçus
- Fiche WFRP 1e complète : profil (14 stats), blessures, armure, compétences, sortilèges, équipement, origines
- **Emplacements de Sorts** (Vague 6) : section dans Perso, cases toggle, repos long, persistance localStorage
- Notification tour (`your_turn`) : vibration mobile + Web Audio API beep 3 tons ascendants
- Persistance localStorage clé `grimoire_wfrp2` + restauration serveur par nom de joueur

### Protocole WebSocket (messages GM → Joueur)
```
"damage_applied"    → { target_id, damage, bless }
"condition_added"   → { target_id, condition, conditions }
"condition_removed" → { target_id, condition, conditions }
"your_turn"         → { target_id, active }
"xp_approved"       → { target_id, amount, total_xp }
"group_state"       → { players: [...] }
"scene"             → { combatants: [...] }
"chat"              → { from, message }
"handout"           → { title, text, image_url }
"push_character"    → { playerId, character }
"game_config"       → { races, careers, stats, ... }
"restore_character" → <character_data>
"journal_push"      → { text }                        ← Vague 8 (Client → GM)
"ai_query"          → { prompt, system }              ← Vague 8 (Client → GM)
"ai_response"       → { response }                    ← Vague 8 (GM → Client)
```

---

## Éditeur Markdown — Fonctionnalités

### WikiLinks `[[...]]`
1. `[[` → autocomplétion (FTS5 si texte, liste locale si vide)
2. Hover → tooltip preview (300 chars, sans frontmatter)
3. `Ctrl+Clic` → ouvre le fichier, ou `confirm()` + création si introuvable
4. Dans preview → `<a data-href class="wikilink">` → clic → `setActiveFile()` ← Vague 6

### Checklists dans l'éditeur ← Vague 6
- `CheckboxWidget extends WidgetType` dans CodeMirrorEditor.svelte
- `checkboxMatcher` via `MatchDecorator` : regex `/^(\s*[-*]\s+)(\[[ x]\])/gim`
- `Decoration.replace()` → widget HTML `<input type="checkbox">`
- `mousedown` dans le widget → `view.dispatch()` pour toggler `[ ]` ↔ `[x]`

### `markdownToHtml(md, resolveImages)` dans Editor.svelte
Gère : tables, code blocks, headings, HR, blockquotes, checklists `- [ ]`/`- [x]`,
listes ul/ol, bold/italic/code, images `![[path]]` (base64 si resolveImages),
wiki-links `[[note]]` → `<a class="wikilink" data-href>` ← Vague 6

### Export PDF
`markdownToHtml(content, true)` avec styles complets (tables, images, blockquotes, code)

---

## FTS5 — Recherche

```rust
fn sanitize_fts_query(raw: &str) -> String {
    // Chaque mot → "mot"* (phrase + préfixe)
    // Élimine les chars spéciaux FTS5 qui causent des crashs SQLite
}
```

---

## Sidebar — Fonctionnalités

- Preview image au survol : `readFileBase64` → data URL (jamais `convertFileSrc`)
- Drag-drop token : `dataTransfer.setData('vtt/token-image', path)` → MapCanvas drop
- Templates : 6 types (PNJ, Lieu, Scène, Faction, Créature, Session) + créer avec IA

---

## VTT — Fonctionnalités par vague

### Wave 13 — Bugfixes FOW + UX (2026-05-16)

**Brouillard de guerre — tokens cachés côté joueur**
- **`isTokenRevealed(tx, ty)`** — nouvelle fonction dans `MapCanvas.svelte`. Appelée dans le **ticker PIXI** (60fps) pour chaque token côté joueur (`!isGM`). Lit `fowEnabled` et `fowShapes` directement depuis la closure sans dépendance à la réactivité Svelte.
  - `fowEnabled=false` → toujours révélé (token visible)
  - Aucune forme `reveal` → en brouillard (token caché)
  - Dans une forme `reveal` + dans une forme `hide` → en brouillard (hide masque le reveal)
  - Dans une forme `reveal` sans `hide` → révélé (token visible)
- **Ticker PIXI** — logique fog ajoutée dans la boucle d'animation : `container.visible = !gmHidden && !inFog` pour tous les tokens côté joueur.

**ConditionWheel — bouton suppression token**
- `onDelete?: (id: string) => void` ajouté à `ConditionWheel.svelte`
- Bouton 🗑️ dans le SVG (cercle rouge au centre bas de la roue), visible uniquement si `onDelete` est fourni
- Câblé dans `MapCanvas.svelte` : `onDelete={(id) => { onTokenDelete(id); condWheelTokenId = null; }}`

**Fit-to-screen PlayerView**
- Quand le MJ clique "fit to screen" (fitRequest), `MapCanvas` émet maintenant `fit_camera` (en plus de `sync_camera`)
- `PlayerView.svelte` : listener `fit_camera` → `playerFitRequest++` → passé comme `fitRequest` au `MapCanvas` joueur
- Résultat : chaque vue calcule son propre `fitMapToScreen()` avec ses propres dimensions d'écran

**toggleFow — réinitialisation des formes**
- Quand le fog est ré-activé (OFF→ON), `toggleFow()` vide maintenant `vttStore.fowShapes` et émet `update_fow: []` au joueur
- Comportement : réactivation = ardoise vierge (tout caché), le MJ redessine les zones à révéler

**Bug fix — MonsterLibrary.svelte**
- Import manquant `readFileBase64` ajouté depuis `$lib/api`

---

### Wave 10–12 (complète — 2026-05-16)

**GM Tools & Utilitaires**
- **ConditionWheel** (`ConditionWheel.svelte`) — roue radiale SVG (8 conditions) positionnée au clic droit sur un token. Clic + shift = TokenSettingsModal. Coordonnées : `e.global.x/y` PixiJS → position écran fixe, centrage via `transform:translate(-50%,-50%)`.
- **Combat Log** (`CombatLog.svelte`) — log auto-scroll, typé (damage/heal/death/turn/condition/info), export clipboard, bouton clear. Entrées auto-ajoutées par `nextTurn()` et `updateCombatantHp()` dans le store.
- **Damage Calculator** (`DamageCalculator.svelte`) — parser regex dice (`parseDice()`), sélection multi-cibles combattants, support demi-dégâts, appelle `updateCombatantHp()`.
- **NPC Relation Map** (`NpcRelationMap.svelte`) — graphe SVG drag-drop, 5 types de liens (ally/enemy/neutral/family/secret), flèches colorées avec markers SVG, export SVG.
- **Quick Loot Modal** (`QuickLootModal.svelte`) — 4 niveaux de richesse, système de rareté (commun 55%/rare 14%/légendaire 4%), copy Markdown.
- **Handout Modal** (`HandoutModal.svelte`) — mode image ou note, file picker → FileReader → base64, appelle `sendHandout()`.
- **Encounter Generator** (`EncounterGenerator.svelte`) — 12 lieux × 7 temps × 15 menaces × 10 rebondissements, copy Markdown.
- **Room Generator** (`RoomGenerator.svelte`) — forme/taille/usage/odeur/son/sorties/contenu, copy Markdown.
- **Weather Planner** (`WeatherPlanner.svelte`) — planificateur 1-7 jours, sélecteur météo par jour + narration + note, appliquer à la carte, copy Markdown.
- **Duration Tracker** (`DurationTracker.svelte`) — présets (torche/lumière/concentration/poison), +/- rounds par entrée, tick all, animation pulse urgente à ≤1 round.
- **Shared Notes** (`SharedNotesModal.svelte`) — compose titre+corps, envoie à tous via `addSharedNote()`, historique liste. Affiché côté joueur en overlay (queue FIFO, dismissable).
- **Session Dashboard mini-log** (`SessionDashboard.svelte`) — bouton 📜 toggle mini-log (6 dernières entrées combatLog, inversé).
- **MacroBar** (`MacroBar.svelte`) — réécrit : drag-drop réordonnance, édition inline clic-droit, historique 12 commandes, `/heal` logue dans combatLog.

**VTT MapCanvas**
- **Camera sync throttlée** — `emitCameraThrottled()` (80ms) pendant pan/zoom ; `emitCamera()` sur release. Zoom clamped `ZOOM_MIN=0.05` / `ZOOM_MAX=8`.
- **Terrain Zones** — mode 'terrain' : glisser pour dessiner un rectangle, `addTerrainZone()` sur release. 5 types (difficile/eau/feu/poison/sûr) avec couleurs distinctes. Rendu `terrainLayer` PixiJS avec label.
- **Export PNG** — `vttStore.exportRequest++` → `$effect` dans MapCanvas → `exportMapPng()` via `app.renderer.extract.canvas()`.
- **Token size = grid** — `addGmToken` normalise `size` à `vttStore.gridSize` si `size <= 0`.
- **Movement path** — ligne jaune pointillée + label "N cases" pendant le drag d'un token (`movePathG: PIXI.Graphics`).
- **HP bar proportionnelle** — `barW = Math.max(30, token.size * 0.85)`.

**Store (`vtt.svelte.ts`) — Nouvelles fonctions**
```typescript
addCombatLogEntry(entry), clearCombatLog()
addTerrainZone(zone), removeTerrainZone(id), clearTerrainZones()  // → emit update_terrain
addSharedNote(title, body), removeSharedNote(id)                  // → emit shared_note
sendHandout(type, content, title?)                                 // → emit show_handout
setSpotlightToken(id)                                             // → emit spotlight_token
sendAmbientText(text)                                             // → emit ambient_text
```

**PlayerView.svelte — Nouveaux listeners**
```
update_combatants → { combatants, active, currentTurn, combatRound }  (badge R.N sur initiative)
spotlight_token   → { tokenId }
ambient_text      → { text }  (overlay 6s auto-dismiss)
shared_note       → { id, title, body }  (queue FIFO, overlay dismissable)
countdown_start/stop → compte à rebours anneau SVG
```

### Vague 8 (complète — 2026-05-14)
- **Journal de Campagne Mobile** — Onglet "Journal" sur mobile; auto-save côté GM dans `Journal/Journal_DD-MM-YYYY.md`.
- **Mini-Map Mobile (Snapshots)** — Bouton "Pousser Carte" GM; capture canvas PixiJS → JPEG base64 → broadcast aux mobiles.
- **IA Portable & Mode MJ** — `ask_ollama` détecte un binaire local dans `bin/`; configuration automatique `OLLAMA_MODELS` et `HOME`. Toggle "Mode MJ" (changement de system prompt) + synthèse vocale (TTS) intégrée (Web Speech API).
- **Dés Visuels (Broadcast)** — Tous les jets mobiles sont diffusés en overlay flottant sur le VTT principal.
- **Destiny & Luck Anim** — Pulsations CSS sur les jauges de points de destin/chance lors de l'utilisation.

### Vague 7 (complète — 2026-05-13)
- **Fond étoilé animé** — `<canvas>` dans PlayerView, 200 étoiles scintillantes + nébuleuses + étoiles filantes aléatoires (requestAnimationFrame), visible seulement en état d'attente (opacity:0 sinon)
- **Vignette torche pulsante** — overlay `radial-gradient` animé (6 keyframes irréguliers), z-index 10 sur la carte
- **Scan-lines** — `repeating-linear-gradient` 4px cycle, opacity 4.5%, z-index 11
- **Coins ornementés** — SVG inline (path L-shape doré + diamant de coin + tirets décoratifs), 4 coins CSS `scaleX(-1)` / `scaleY(-1)` / `scale(-1)`, `filter: drop-shadow` doré
- **Titre de campagne** — `vttStore.campaignTitle` + `setCampaignTitle()` → event `set_campaign_title` → PlayerView; affiché en haut centré sur la carte (letter-spacing, sépia) + grand format sur l'état d'attente avec animation glow-pulse; input dans VTTToolbar
- **Audio 2 pistes** — PlayerView corrigé : listen `update_player_audio` déstructure `src2`/`volume2` + second `<AudioPlayer>`

### Vague 6 (complète — 2026-05-12)
- **Checklist markdown** — CheckboxWidget CodeMirror + rendu dans preview/PDF
- **Notes secrètes sur la carte** — MapPin.secret/secretText/revealed, 🔒/🔓 PixiJS, clic droit pour révéler
- **Durée des conditions** — conditionDurations, décrément dans nextTurn(), input dans TokenSettingsModal
- **Tracker de concentration** — Token.concentrating, double anneau violet, checkbox modal
- **Couches audio multiples** — audio2Src/audio2Volume, 2ème piste indépendante
- **Gabarits de sorts cône/ligne** — shape/angle/length/coneAngle, renderSpells() PixiJS
- **Navigation wiki-links dans preview** — wikilink → setActiveFile() au clic
- **Générateur de rencontres** — panel dans MonsterLibrary, filtre CR, spawn en masse
- **HP/conditions côté joueur** — panneau party-status absolu dans PlayerView
- **Slots de sorts mobile** — section dans l'app mobile, cases toggle, repos long

### Vague 5 (complète)
- **Notification tour (mobile)** — `your_turn` WS + vibration + Web Audio API 3 tons
- **Jet de dé sur la carte** — `DiceRoller.onRoll` → `map_roll` → `spawnRollText()` PixiJS
- **Mode dessin libre** — mode 'draw', DrawPath, drawLayer PixiJS, undo inclus
- **Undo/Redo global** — undoStack (max 30), Ctrl+Z, bouton ↩️
- **Minimap** — overlay HTML canvas bottom-right, GM seulement, clic = toggle
- **Preview markdown** — split-view, markdownToHtml(), tables, update temps réel
- **Export PDF amélioré** — images base64 inline, styles complets

### Vague 4 (complète)
- Camera sync GM→Joueur
- Zone zoom (🔍) + reset zoom (⌂)
- Toolbar 2 lignes, boutons icon-only
- Audio base64 via `readFileBase64`
- Serveur Axum + WebSocket + QR code
- App mobile WFRP complète (4+ onglets)
- PlayerMobileManager.svelte

### Vagues 1–3 (complètes)
- VTT complet : carte, FOW, tokens image/couleur, initiative, ping, blackout
- Éditeur : WikiLinks, images inline, rétroliens, templates, IA, outline
- Recherche FTS5 + graphe D3 + timeline + calendrier
- Multimap (scènes) + SoundBoard + MonsterLibrary + RollTables
- Créateur de personnage WFRP step-by-step

---

## Bugs corrigés (session 2026-05-16)

50+ erreurs TypeScript et 1 warning Rust corrigés :

- **`vtt.svelte.ts`** — propriétés dupliquées dans `saveGmSession()` (`drawPaths`, `walls`, `audioZones` apparaissaient deux fois dans le littéral objet) → suppression des lignes dupliquées
- **`vtt.svelte.ts`** — types `WallDef` et `AudioZoneDef` extraits en types exportés ; `MapScene` mis à jour pour utiliser ces types ; `SessionData` corrigé (champs sans `?` optionnel)
- **`MapCanvas.svelte`** — `renderDrawPaths()` manquante → ajoutée (PixiJS v8 `setStrokeStyle` + `stroke()`)
- **`MapCanvas.svelte`** — `'blueprint'`/`'audio-zone'` absents du type union `vttMode` → ajoutés
- **`MapCanvas.svelte`** — imports `vttStore`, `addGmWall`, `addGmAudioZone`, `toggleGmDoor`, `removeGmAudioZone` manquants → ajoutés
- **`MapCanvas.svelte`** — `minimapCanvas` typé `$state(undefined as unknown as HTMLCanvasElement)` → `$state<HTMLCanvasElement | null>(null)`
- **`MapCanvas.svelte`** — fuite mémoire : cleanup `zoneAudioObjects` dans `onDestroy` → ajouté
- **`Calendar.svelte`** — `$state<CalState>({...})` (générique interdit TS 6) + variable nommée `state` (conflit rune dans template) → renommée `cal`, type explicite `let cal: CalState = $state({...})`
- **`PlayerHub.svelte`** — import `.svelte.ts` avec extension → suppression de `.ts`
- **`PlayerHub.svelte`** — `onMount(async) → Promise<cleanup>` refusé par TS 6 → pattern IIFE + tableau `_unlistenHub`
- **`PlayerHub.svelte`** — `serverInfo.url` → `serverInfo!.url` (null possible)
- **`App.svelte`** — même correction `onMount(async)` → IIFE + `_unlistenApp[]`
- **`PlayerView.svelte`** — narrowing `ctx` null dans closures (TS 6) → pattern deux étapes `ctxRaw`/`ctx`
- **`PlayerView.svelte`** — `$state<any[]>([])` remplacé par types stricts : `FowShape[]`, `Token[]`, `MapPin[]`, `DrawPath[]`, `SpellMarker[]`, `WallDef[]`, `AudioZoneDef[]`
- **`PlayerView.svelte`** — `t.hp / t.maxHp` potentiellement undefined → `t.hp ?? t.maxHp ?? 0` et `t.maxHp ?? 1`
- **`PlayerManager.svelte`** — `createDirectory` manquant dans les imports de `$lib/api` → ajouté
- **`VTTToolbar.svelte`** — 42 lignes de CSS mort (sélecteurs `.weather-*`, `.spell-*` inutilisés) → supprimés
- **`GraphView.svelte`** — simulation D3 non stoppée avant re-render (fuite mémoire) → stop + null + `onDestroy` ajoutés
- **`tsconfig.app.json`** — `"baseUrl": "."` déprécié rejeté par TS → supprimé ; paths mis à jour avec préfixe `./`
- **`src-tauri/Cargo.toml`** — dépendance `opener = "0.7"` ajoutée pour URL cross-platform
- **`src-tauri/commands/vault.rs`** — `xdg-open` (Linux seulement) remplacé par `opener::open_browser()` (cross-platform)
- **`src-tauri/commands/config.rs`** — `let mut h = |pairs|` → `let h = |pairs|` (warning `unused_mut` Rust)

---

## Composants Wave 10–12 — Tableau de référence

| Composant | Bouton | Type | Notes |
|---|---|---|---|
| `DamageCalculator` | 💥 | Modal (backdrop propre) | `onclose` requis |
| `EncounterGenerator` | ⚡ | Modal (backdrop propre) | `onclose` requis |
| `RoomGenerator` | 🏚️ | Modal (backdrop propre) | `onclose` requis |
| `WeatherPlanner` | 🌦️ | Modal (backdrop propre) | `onclose` requis |
| `SharedNotesModal` | 📋 | Modal (backdrop propre) | `onclose` requis |
| `CombatLog` | 📜 | Float panel | Pas de `onclose`, contrôlé par toolbar |
| `NpcRelationMap` | 🕸️ | Float panel wide | Idem |
| `DurationTracker` | ⏱️ | Float panel narrow | Idem |
| `ConditionWheel` | (clic droit token) | Position fixed screen-space | Coordonnées PixiJS `e.global.x/y` |
| `HandoutModal` | 📤 | Modal | `onclose` requis |
| `QuickLootModal` | 💰 | Modal | `onclose` requis |

---

## État du projet (2026-05-16)

### Fonctionnalités complètes
- Onboarding + wizard vault
- Organisation assets tokens par catégories
- VTT complet : carte, FOW, tokens, initiative, ping, audio ×2, blackout, vue joueur
- Sorts AOE : cercle, cône, ligne (avec direction)
- Dessin libre + undo global
- Minimap GM
- Pins normales + secrètes
- Conditions + durées + concentration
- Éditeur : WikiLinks, checklists, images inline, rétroliens, templates, IA, preview, PDF
- Recherche FTS5 + graphe + timeline + calendrier
- Serveur mobile : fiche WFRP complète, dés, chat, groupe, handouts, XP, slots de sorts
- Créateur de personnage step-by-step
- Générateur de rencontres aléatoires
- Statut groupe dans vue joueur
- **Vue joueur immersive** : fond étoilé animé, vignette torche pulsante, scan-lines, coins ornementés SVG, titre de campagne synchronisé
- **Immersive Party Suite (V8)** : Journal mobile synchronisé, snapshots de carte en temps réel, IA portable avec mode MJ et voix, dés visuels broadcastés sur le VTT principal.
- **Wave 9: Grimoire Immersive Suite (2026-05-14)** :
  - **Dynamic LOS & Shadows** : Murs et portes (blueprint) projetant des ombres en temps réel via PixiJS v8.
  - **Portes Interactives** : Objets blueprint 🚪 commutables (ouvert/fermé) par le MJ pour mettre à jour la vision.
  - **Zones Sonores** : Régions 🎶 circulaires avec volume spatialisé basé sur la distance des tokens joueurs.
  - **Sketchpad Collaboratif** : Dessins tactiques éphémères envoyés depuis le smartphone des joueurs vers le VTT du MJ.
  - **Mobile Soundboard** : Les joueurs peuvent déclencher des sons d'ambiance (SFX) depuis leur interface mobile.
  - **Combat HUD Mobile** : Interface optimisée pour le suivi des PV et actions rapides en combat.
  - **Animations & Particules** : Feedback visuel viscéral (sang, tremblements d'écran lors des coups critiques).

### Bugs corrigés (sessions 2026-05-10 à 2026-05-16)
- Token images : `convertFileSrc` → `readFileBase64` pipeline
- Token names mixés : `$effect` compare par `t?.id !== editToken?.id`
- Token WebGL atlas corruption : `tokenSprite.visible = false` jusqu'au `img.onload`
- Sidebar preview : `convertFileSrc` → `readFileBase64` async
- WS messages ciblés : `target_id` + filtrage JS `if(env.data.target_id !== playerId) return`
- Group chat dédupliqué : `from_id` UUID + filtre côté client
- `addToRecus onclick` corrompu : remplacement `innerHTML` par DOM+closure
- `onCareerSelect` vocation : ajout `sv('f-voc', name)`
- `set_active_turn` fin de tour : second broadcast `{target_id: null}`
- FTS5 crash : `sanitize_fts_query()` — mots entre guillemets
- Ollama system prompt : champ `system` dédié dans `OllamaRequest`
- `$derived(() => fn)` → `$derived.by(() => fn)`
- Bouton Soin : `handleApplyHeal()` avec `Math.abs()`
- `player_chat` listener : `payload.data.message` → `payload.message`
- Listeners GM manquants : `player_reaction`, `player_initiative`, `player_xp_request`
- `CharacterCreator` profil : `profil.ini` → `profil.init`
- `CharacterCreator` compétences : `comps: skills` (tableau, pas string)
- Code Cleanup (Wave 9 Final) : Correction des types TypeScript (`any`), suppression des logs de debug, optimisation de la persistance multimap et nettoyage des assets par défaut.
- **Session 2026-05-16** : 50+ erreurs TS/Svelte corrigées — types dupliqués, `WallDef`/`AudioZoneDef` centralisés, pattern `onMount` IIFE, narrowing canvas TS 6, `renderDrawPaths` manquant, `Calendar` renommé `cal`, imports manquants, CSS mort supprimé, simulation D3 cleanée, `tsconfig` baseUrl corrigé, `opener` cross-platform pour Rust.

## État de Production (v0.1.0)
- **Cible** : Windows (x64) & Linux (Debian/Ubuntu).
- **Stabilité** : Stable pour des sessions de jeu réelles.
- **Sécurité** : 100% local, aucune donnée transmise au cloud (sauf via le serveur mobile sur votre propre réseau local).
- **Performance** : Utilisation intensive du GPU pour le rendu VTT (PixiJS v8) et du moteur Rust pour la gestion de fichiers et du réseau.

**Félicitations, Grimoire est prêt à conquérir les tables de jeu !** 🏰🎲
