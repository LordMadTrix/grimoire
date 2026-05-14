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
  mode: 'select' as 'select'|'fog-reveal'|'fog-hide'|'fog-rect'|'measure'|'ping'|'pin'|'spell'|'zoom-rect'|'draw',
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

type DrawPath = { id: string; points: {x,y}[]; color: number; width: number };
type MapScene = { id: string; name: string; relPath: string|null; fowShapes: FowShape[]; tokens: Token[]; pins: MapPin[]; spells: SpellMarker[] };
type FowShape = { type: 'circle'|'rect'; op: 'reveal'|'hide'; x: number; y: number; radius?: number; width?: number; height?: number };
type Combatant = { id: string; name: string; initiative: number; hp: number; maxHp: number; isEnemy: boolean; tokenId?: string };

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
9. `previewShape`
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

## État du projet (2026-05-13)

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

### Bugs corrigés (sessions 2026-05-10 à 2026-05-12)
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

## État de Production (v0.1.0)
- **Cible** : Windows (x64) & Linux (Debian/Ubuntu).
- **Stabilité** : Stable pour des sessions de jeu réelles.
- **Sécurité** : 100% local, aucune donnée transmise au cloud (sauf via le serveur mobile sur votre propre réseau local).
- **Performance** : Utilisation intensive du GPU pour le rendu VTT (PixiJS v8) et du moteur Rust pour la gestion de fichiers et du réseau.

**Félicitations, Grimoire est prêt à conquérir les tables de jeu !** 🏰🎲
