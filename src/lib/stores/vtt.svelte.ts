import { emitToPlayerView, writeFile, readFile, createDirectory, readFileBase64 } from '../api';

// ── Undo stack ────────────────────────────────────────────────────
type UndoEntry =
  | { type: 'fow'; shapes: FowShape[] }
  | { type: 'draw'; paths: DrawPath[] }
  | { type: 'tokens'; tokens: Token[] }
  | { type: 'dungeon'; tiles: DungeonTile[] };

const undoStack: UndoEntry[] = [];
const MAX_UNDO = 30;

function pushUndo(entry: UndoEntry) {
  undoStack.push(entry);
  if (undoStack.length > MAX_UNDO) undoStack.shift();
}

export function canUndo() { return undoStack.length > 0; }

export function undoMapAction() {
  const entry = undoStack.pop();
  if (!entry) return;
  if (entry.type === 'fow') {
    vttStore.fowShapes = entry.shapes;
    emitToPlayerView('update_fow', vttStore.fowShapes);
  } else if (entry.type === 'draw') {
    vttStore.drawPaths = entry.paths;
    emitToPlayerView('update_draw_paths', vttStore.drawPaths);
  } else if (entry.type === 'tokens') {
    vttStore.tokens = entry.tokens;
    emitToPlayerView('update_tokens', vttStore.tokens);
  } else if (entry.type === 'dungeon') {
    vttStore.dungeonTiles = entry.tiles;
  }
}

export function pushDungeonUndo() {
  pushUndo({ type: 'dungeon', tiles: [...vttStore.dungeonTiles] });
}

export type FowShape = {
  type: 'circle' | 'rect';
  op: 'reveal' | 'hide';
  x: number;
  y: number;
  radius?: number;
  width?: number;
  height?: number;
};

export type Token = {
  id: string;
  name: string;
  x: number;
  y: number;
  size: number;
  color?: number;
  hp?: number;
  maxHp?: number;
  ac?: number;
  visionRange?: number;
  lightRadius?: number;
  lightColor?: string;
  lightFlicker?: boolean;
  darkvision?: boolean;
  isEnemy?: boolean;
  imageUrl?: string;
  visible?: boolean;
  conditions?: string[];
  conditionDurations?: Record<string, number>;
  concentrating?: boolean;
  notes?: string;
  auraRadius?: number;
  auraColor?: number;
  linkedNote?: string;
  playerId?: string;
  animation?: 'none' | 'attack' | 'hit';
};

export type LightSource = {
  id: string;
  x: number;
  y: number;
  radius: number;
  color?: string;
  intensity?: number;
  flicker?: boolean;
  type?: 'torch' | 'lantern' | 'magical' | 'candle' | 'campfire';
  label?: string;
};

export type SoundEmitter = {
  id: string;
  x: number;
  y: number;
  radius: number;
  audioSrc: string;
  volume: number;
  loop?: boolean;
  label?: string;
  isPlaying?: boolean;
};

export type MapPin = {
  id: string;
  x: number;
  y: number;
  label: string;
  color?: number;
  playerVisible?: boolean;
  secret?: boolean;       // note GM-only masquée
  secretText?: string;    // texte révélé quand on clique
  revealed?: boolean;     // true = révélée aux joueurs
};

export type SpellMarker = {
  id: string;
  x: number;
  y: number;
  type: 'fire' | 'ice' | 'lightning' | 'poison' | 'silence' | 'divine' | 'darkness';
  radius: number;
  label?: string;
  // Gabarits cône et ligne
  shape?: 'circle' | 'cone' | 'line';
  angle?: number;   // direction en radians (pour cône et ligne)
  length?: number;  // longueur de la ligne (px)
  coneAngle?: number; // ouverture du cône en radians (défaut: π/3 = 60°)
};

export type DrawPath = {
  id: string;
  points: { x: number; y: number }[];
  color: number;
  width: number;
};

export type WallDef = {
  id: string;
  points: { x: number; y: number }[];
  type: 'opaque' | 'door';
  isOpen?: boolean;
};

export type AudioZoneDef = {
  id: string;
  x: number;
  y: number;
  radius: number;
  audioSrc: string;
  volume: number;
};

export type TerrainZone = {
  id: string;
  x: number; y: number; w: number; h: number;
  type: 'difficult' | 'water' | 'fire' | 'poison' | 'safe' | 'custom';
  color?: number;
  label?: string;
};

export type TileType =
  'floor_stone' | 'floor_wood' | 'floor_dirt' |
  'wall_stone' | 'wall_wood' |
  'wall_corner_tl' | 'wall_corner_tr' | 'wall_corner_bl' | 'wall_corner_br' |
  'wall_horizontal' | 'wall_vertical' |
  'door_closed' | 'door_open' |
  'door_horizontal' | 'door_vertical' |
  'wall_horizontal_torch' | 'wall_vertical_torch' |
  'stairs_down' | 'stairs_up' |
  'pillar' | 'water' | 'lava' | 'void' | 'chest' | 'trap';

export type DungeonTile = {
  col: number;
  row: number;
  type: TileType;
};

export type SharedNote = {
  id: string;
  title: string;
  body: string;
  ts: number;
};

export type Combatant = {
  id: string;
  name: string;
  initiative: number;
  hp: number;
  maxHp: number;
  isEnemy: boolean;
  tokenId?: string;
};

export type CombatLogEntry = {
  id: number;
  round: number;
  timestamp: number;
  type: 'damage' | 'heal' | 'death' | 'turn' | 'condition' | 'info';
  actor: string;
  target?: string;
  value?: number;
  detail?: string;
};

export type MapScene = {
  id: string;
  name: string;
  relPath: string | null;
  fowShapes: FowShape[];
  tokens: Token[];
  pins: MapPin[];
  spells: SpellMarker[];
  walls: WallDef[];
  audioZones: AudioZoneDef[];
};

export const vttStore = $state({
  currentMap: null as string | null,        // data URL (runtime uniquement)
  currentMapRelPath: null as string | null, // chemin relatif persisté
  fowShapes: [] as FowShape[],
  tokens: [] as Token[],
  pins: [] as MapPin[],
  mode: 'select' as 'select' | 'fog-reveal' | 'fog-hide' | 'fog-rect' | 'measure' | 'ping' | 'pin' | 'spell' | 'zoom-rect' | 'draw' | 'blueprint' | 'audio-zone' | 'terrain' | 'dungeon-paint' | 'calibrate-grid',
  fitRequest: 0,
  showGrid: true,
  gridSize: 50,

  // Effets visuels & Éclairage
  weather: 'none' as 'none' | 'rain' | 'snow' | 'fog' | 'embers' | 'storm',
  lightningFlash: false as boolean,
  ambientLight: 'day' as 'day' | 'dusk' | 'night' | 'pitch_black',
  lights: [] as LightSource[],
  spells: [] as SpellMarker[],
  spellType: 'fire' as SpellMarker['type'],
  spellRadius: 80,
  spellShape: 'circle' as 'circle' | 'cone' | 'line',
  spellLength: 200,
  spellConeAngle: Math.PI / 3,
  spellAngle: 0,
  spellAngleDeg: 0,

  // Audio Ambiance & Spatialisé
  audioSrc: null as string | null,
  audioVolume: 0.5,
  audio2Src: null as string | null,
  audio2Volume: 0.4,
  soundEmitters: [] as SoundEmitter[],

  // Combat / Initiative
  combatants: [] as Combatant[],
  combatActive: false,
  currentTurn: 0,
  combatRound: 1,

  // Timer de session
  sessionTimerStart: null as number | null,

  // Countdown joueur (compte à rebours visible sur PlayerView)
  countdownEnd: null as number | null,

  // Écran noir vue joueur
  isBlackout: false,

  // Blueprint / Murs (Ligne de vue)
  walls: [] as WallDef[],
  wallsEnabled: true as boolean,
  currentWallPath: null as {x:number, y:number}[] | null,
  blueprintType: 'opaque' as 'opaque' | 'door',
  audioZones: [] as AudioZoneDef[],

  // Multimap — scènes
  maps: [] as MapScene[],
  activeMapId: null as string | null,

  // Dessin libre
  drawPaths: [] as DrawPath[],
  drawColor: 0xe5a853 as number,
  drawWidth: 4,

  // Titre de campagne (affiché côté joueur)
  campaignTitle: '' as string,
  fowEnabled: true,

  // Localisation de token (déclenche le centrage caméra)
  locateTokenId: null as string | null,

  // Spotlight — halo doré sur un token côté joueur
  spotlightTokenId: null as string | null,

  // Combat log
  combatLog: [] as CombatLogEntry[],

  // Terrain zones
  terrainZones: [] as TerrainZone[],
  terrainType: 'difficult' as TerrainZone['type'],

  // Notes partagées
  sharedNotes: [] as SharedNote[],

  // Export trigger (incrémenté pour déclencher l'export PNG depuis le toolbar)
  exportRequest: 0,

  // Dungeon tile editor
  dungeonTiles: [] as DungeonTile[],
  dungeonBrush: 'floor_stone' as TileType,
  showDungeonEditor: false,
  dungeonStyle: 'realistic' as 'realistic' | 'kenney' | 'solid',
  dungeonDrawMode: 'brush' as 'brush' | 'rect' | 'fill' | 'move',
  dungeonBrushSize: 1 as 1 | 2 | 3 | 5,
  dungeonSelection: null as { minCol: number, minRow: number, maxCol: number, maxRow: number } | null,
});

// ── Campaign Title ────────────────────────────────────────────────
export function setCampaignTitle(title: string) {
  vttStore.campaignTitle = title;
  emitToPlayerView('set_campaign_title', { title });
}

// ── Spotlight ─────────────────────────────────────────────────────
export function setSpotlightToken(id: string | null) {
  vttStore.spotlightTokenId = id;
  emitToPlayerView('spotlight_token', { tokenId: id });
}

// ── Combat sync vers vue joueur ───────────────────────────────────
export function syncCombatantsToPlayerView() {
  emitToPlayerView('update_combatants', {
    combatants: vttStore.combatants,
    active: vttStore.combatActive,
    currentTurn: vttStore.currentTurn,
    combatRound: vttStore.combatRound,
  });
}

let _logId = 0;
export function addCombatLogEntry(entry: Omit<CombatLogEntry, 'id' | 'round' | 'timestamp'>) {
  const full: CombatLogEntry = {
    ...entry,
    id: _logId++,
    round: vttStore.combatRound,
    timestamp: Date.now(),
  };
  vttStore.combatLog = [...vttStore.combatLog.slice(-199), full];
}

export function clearCombatLog() {
  vttStore.combatLog = [];
}

// ── Terrain zones ─────────────────────────────────────────────────
export function addTerrainZone(zone: TerrainZone) {
  vttStore.terrainZones = [...vttStore.terrainZones, zone];
  emitToPlayerView('update_terrain', vttStore.terrainZones);
}
export function removeTerrainZone(id: string) {
  vttStore.terrainZones = vttStore.terrainZones.filter(z => z.id !== id);
  emitToPlayerView('update_terrain', vttStore.terrainZones);
}
export function clearTerrainZones() {
  vttStore.terrainZones = [];
  emitToPlayerView('update_terrain', []);
}

// ── Dungeon Tiles ─────────────────────────────────────────────────
export function setDungeonTile(col: number, row: number, type: TileType) {
  const existing = vttStore.dungeonTiles.findIndex(t => t.col === col && t.row === row);
  if (type === 'void') {
    if (existing >= 0) vttStore.dungeonTiles = vttStore.dungeonTiles.filter((_, i) => i !== existing);
  } else if (existing >= 0) {
    vttStore.dungeonTiles[existing].type = type;
    vttStore.dungeonTiles = [...vttStore.dungeonTiles];
  } else {
    vttStore.dungeonTiles = [...vttStore.dungeonTiles, { col, row, type }];
  }
}

export function clearDungeonTiles() {
  vttStore.dungeonTiles = [];
}

// ── Notes partagées ───────────────────────────────────────────────
let _noteId = 0;
export function addSharedNote(title: string, body: string) {
  const note: SharedNote = { id: String(_noteId++), title, body, ts: Date.now() };
  vttStore.sharedNotes = [note, ...vttStore.sharedNotes];
  emitToPlayerView('shared_note', note);
}
export function removeSharedNote(id: string) {
  vttStore.sharedNotes = vttStore.sharedNotes.filter(n => n.id !== id);
}

// ── Ambient Text (texte d'ambiance sur la vue joueur) ─────────────
export function sendHandout(type: 'image' | 'note', content: string, title?: string) {
  emitToPlayerView('show_handout', { type, content, title });
}

export function sendAmbientText(text: string) {
  emitToPlayerView('ambient_text', { text });
}

export function startCountdown(seconds: number) {
  const endAt = Date.now() + seconds * 1000;
  vttStore.countdownEnd = endAt;
  emitToPlayerView('countdown_start', { endAt, total: seconds });
}

export function stopCountdown() {
  vttStore.countdownEnd = null;
  emitToPlayerView('countdown_stop', {});
}

// ── Weather & Spells ──────────────────────────────────────────────
export function setWeather(w: typeof vttStore.weather) {
  vttStore.weather = w;
  emitToPlayerView('set_weather', { weather: w });
}

export function addSpell(spell: SpellMarker) {
  vttStore.spells = [...vttStore.spells, spell];
  emitToPlayerView('update_spells', vttStore.spells);
}

export function removeSpell(id: string) {
  vttStore.spells = vttStore.spells.filter(s => s.id !== id);
  emitToPlayerView('update_spells', vttStore.spells);
}

export function clearSpells() {
  vttStore.spells = [];
  emitToPlayerView('update_spells', []);
}

// ── Pins ──────────────────────────────────────────────────────────
function pinsForPlayers() {
  return vttStore.pins.filter(p => !p.secret || p.revealed).map(p => ({
    ...p, secretText: p.revealed ? p.secretText : undefined,
  }));
}
export function addGmPin(pin: MapPin) {
  vttStore.pins = [...vttStore.pins, pin];
  emitToPlayerView('update_pins', pinsForPlayers());
}
export function removeGmPin(id: string) {
  vttStore.pins = vttStore.pins.filter(p => p.id !== id);
  emitToPlayerView('update_pins', pinsForPlayers());
}
export function clearGmPins() {
  vttStore.pins = [];
  emitToPlayerView('update_pins', []);
}
export function revealGmPin(id: string) {
  const pin = vttStore.pins.find(p => p.id === id);
  if (!pin) return;
  pin.revealed = !pin.revealed;
  vttStore.pins = [...vttStore.pins];
  // Envoyer aux joueurs (sans le secretText si pas révélé)
  const forPlayers = vttStore.pins.map(p =>
    p.secret && !p.revealed ? null : { ...p, secretText: p.revealed ? p.secretText : undefined }
  ).filter(Boolean);
  emitToPlayerView('update_pins', forPlayers);
}

// ── Map / Multimap ────────────────────────────────────────────────
export function setGmCurrentMap(map: string | null) { vttStore.currentMap = map; }

function snapshotActiveScene() {
  const scene = vttStore.maps.find(m => m.id === vttStore.activeMapId);
  if (!scene) return;
  scene.relPath = vttStore.currentMapRelPath;
  scene.fowShapes = [...vttStore.fowShapes];
  scene.tokens = [...vttStore.tokens];
  scene.pins = [...vttStore.pins];
  scene.spells = [...vttStore.spells];
  scene.walls = [...vttStore.walls];
  scene.audioZones = [...vttStore.audioZones];
}

function applyScene(scene: MapScene) {
  vttStore.currentMapRelPath = scene.relPath;
  vttStore.fowShapes = [...scene.fowShapes];
  vttStore.tokens = [...scene.tokens];
  vttStore.pins = [...scene.pins];
  vttStore.spells = [...scene.spells];
  vttStore.walls = scene.walls || [];
  vttStore.audioZones = scene.audioZones || [];
}

export function replaceActiveScene(name: string, relPath: string | null, dataUrl: string | null) {
  const scene = vttStore.maps.find(m => m.id === vttStore.activeMapId);
  if (scene) {
    scene.name = name;
    scene.relPath = relPath;
    scene.fowShapes = [];
    scene.tokens = [];
    scene.pins = [];
    scene.spells = [];
    scene.walls = [];
    scene.audioZones = [];
  }
  vttStore.currentMapRelPath = relPath;
  vttStore.currentMap = dataUrl;
  vttStore.fowShapes = [];
  vttStore.tokens = [];
  vttStore.pins = [];
  vttStore.spells = [];
  vttStore.walls = [];
  vttStore.audioZones = [];
  emitToPlayerView('set_player_map', { url: dataUrl });
}

export function addMapScene(name: string, relPath: string | null, dataUrl: string | null) {
  snapshotActiveScene();
  const scene: MapScene = {
    id: Math.random().toString(36).slice(2),
    name,
    relPath,
    fowShapes: [],
    tokens: [],
    pins: [],
    spells: [],
    walls: [],
    audioZones: [],
  };
  vttStore.maps = [...vttStore.maps, scene];
  vttStore.activeMapId = scene.id;
  vttStore.currentMap = dataUrl;
  applyScene(scene);
  emitToPlayerView('set_player_map', { url: dataUrl });
}

export function switchMapScene(id: string) {
  if (id === vttStore.activeMapId) return;
  snapshotActiveScene();
  const scene = vttStore.maps.find(m => m.id === id);
  if (!scene) return;
  vttStore.activeMapId = id;
  applyScene(scene);
}

export function removeMapScene(id: string) {
  if (vttStore.maps.length <= 1) return;
  const idx = vttStore.maps.findIndex(m => m.id === id);
  if (idx === -1) return;
  vttStore.maps = vttStore.maps.filter(m => m.id !== id);
  if (vttStore.activeMapId === id) {
    const next = vttStore.maps[Math.max(0, idx - 1)];
    vttStore.activeMapId = next.id;
    applyScene(next);
  }
}

export function renameMapScene(id: string, name: string) {
  const scene = vttStore.maps.find(m => m.id === id);
  if (scene) scene.name = name;
}

// ── FOW ──────────────────────────────────────────────────────────
export function addGmFowShape(shape: FowShape) {
  pushUndo({ type: 'fow', shapes: [...vttStore.fowShapes] });
  vttStore.fowShapes = [...vttStore.fowShapes, shape];
  emitToPlayerView('update_fow', vttStore.fowShapes);
}

export function undoGmFow() {
  if (vttStore.fowShapes.length === 0) return;
  vttStore.fowShapes = vttStore.fowShapes.slice(0, -1);
  emitToPlayerView('update_fow', vttStore.fowShapes);
}

export function clearGmFow() {
  pushUndo({ type: 'fow', shapes: [...vttStore.fowShapes] });
  vttStore.fowShapes = [];
  emitToPlayerView('update_fow', vttStore.fowShapes);
}

export function toggleFow() {
  const enabling = !vttStore.fowEnabled;
  vttStore.fowEnabled = enabling;
  if (enabling) {
    // Réactivation du brouillard : repartir de zéro (tout caché)
    vttStore.fowShapes = [];
    emitToPlayerView('update_fow', []);
  }
  emitToPlayerView('toggle_fow', { enabled: enabling });
}

export function revealAllGmFow() {
  pushUndo({ type: 'fow', shapes: [...vttStore.fowShapes] });
  // Un seul rect géant révèle toute la carte
  vttStore.fowShapes = [{ type: 'rect', op: 'reveal', x: -50000, y: -50000, width: 100000, height: 100000 }];
  emitToPlayerView('update_fow', vttStore.fowShapes);
}

// ── Draw paths ────────────────────────────────────────────────────
export function addDrawPath(path: DrawPath) {
  pushUndo({ type: 'draw', paths: [...vttStore.drawPaths] });
  vttStore.drawPaths = [...vttStore.drawPaths, path];
  emitToPlayerView('update_draw_paths', vttStore.drawPaths);
}

export function undoDrawPath() {
  if (vttStore.drawPaths.length === 0) return;
  vttStore.drawPaths = vttStore.drawPaths.slice(0, -1);
  emitToPlayerView('update_draw_paths', vttStore.drawPaths);
}

export function clearDrawPaths() {
  pushUndo({ type: 'draw', paths: [...vttStore.drawPaths] });
  vttStore.drawPaths = [];
  emitToPlayerView('update_draw_paths', []);
}

// ── Tokens ───────────────────────────────────────────────────────
export function updateGmToken(id: string, x: number, y: number) {
  pushUndo({ type: 'tokens', tokens: [...vttStore.tokens] });
  vttStore.tokens = vttStore.tokens.map(t => t.id === id ? { ...t, x, y } : t);
  emitToPlayerView('update_tokens', vttStore.tokens);
}

export function replaceGmToken(token: Token) {
  pushUndo({ type: 'tokens', tokens: [...vttStore.tokens] });
  vttStore.tokens = vttStore.tokens.map(t => t.id === token.id ? token : t);
  emitToPlayerView('update_tokens', vttStore.tokens);
}

export function addGmToken(token: Token) {
  pushUndo({ type: 'tokens', tokens: [...vttStore.tokens] });
  const sized: Token = { ...token, size: token.size > 0 ? token.size : vttStore.gridSize };
  vttStore.tokens = [...vttStore.tokens, sized];
  emitToPlayerView('update_tokens', vttStore.tokens);
}

export function removeGmToken(id: string) {
  pushUndo({ type: 'tokens', tokens: [...vttStore.tokens] });
  vttStore.tokens = vttStore.tokens.filter(t => t.id !== id);
  emitToPlayerView('update_tokens', vttStore.tokens);
}

export function triggerTokenAnimation(id: string, animation: Token['animation']) {
  vttStore.tokens = vttStore.tokens.map(t => t.id === id ? { ...t, animation } : t);
  emitToPlayerView('update_tokens', vttStore.tokens);
  // Reset après l'animation (ex: 500ms)
  setTimeout(() => {
    vttStore.tokens = vttStore.tokens.map(t => t.id === id ? { ...t, animation: 'none' } : t);
    emitToPlayerView('update_tokens', vttStore.tokens);
  }, 600);
}

// ── Combat / Initiative ───────────────────────────────────────────
export function startCombat() {
  // Importer les tokens actuels comme combattants avec initiative aléatoire
  vttStore.combatants = vttStore.tokens.map(t => ({
    id: Math.random().toString(36).slice(2),
    name: t.name,
    initiative: Math.floor(Math.random() * 20) + 1,
    hp: t.hp ?? 10,
    maxHp: t.maxHp ?? 10,
    isEnemy: t.isEnemy ?? false,
    tokenId: t.id,
  })).sort((a, b) => b.initiative - a.initiative);
  vttStore.currentTurn = 0;
  vttStore.combatRound = 1;
  vttStore.combatActive = true;
}

export function stopCombat() {
  vttStore.combatActive = false;
  vttStore.combatants = [];
  vttStore.currentTurn = 0;
  vttStore.combatRound = 1;
}

export function nextTurn() {
  if (vttStore.combatants.length === 0) return;

  // Décrémenter les durées de conditions du combattant actif (fin de son tour)
  const activeCombatant = vttStore.combatants[vttStore.currentTurn];
  if (activeCombatant?.tokenId) {
    const token = vttStore.tokens.find(t => t.id === activeCombatant.tokenId);
    if (token?.conditionDurations && Object.keys(token.conditionDurations).length > 0) {
      const newDurations: Record<string, number> = {};
      const toRemove: string[] = [];
      for (const [cid, rounds] of Object.entries(token.conditionDurations)) {
        if (rounds > 1) newDurations[cid] = rounds - 1;
        else toRemove.push(cid);
      }
      token.conditionDurations = newDurations;
      if (toRemove.length > 0) {
        token.conditions = (token.conditions ?? []).filter(c => !toRemove.includes(c));
      }
      vttStore.tokens = [...vttStore.tokens];
      emitToPlayerView('update_tokens', vttStore.tokens);
    }
  }

  const next = (vttStore.currentTurn + 1) % vttStore.combatants.length;
  if (next === 0) vttStore.combatRound++;
  vttStore.currentTurn = next;
  const nextC = vttStore.combatants[next];
  if (nextC) addCombatLogEntry({ type: 'turn', actor: nextC.name, detail: `Tour ${next === 0 ? 'Round ' + vttStore.combatRound : ''}` });
}

export function prevTurn() {
  if (vttStore.combatants.length === 0) return;
  // Revenir avant le premier combattant = revenir au round précédent
  if (vttStore.currentTurn === 0 && vttStore.combatRound > 1) vttStore.combatRound--;
  vttStore.currentTurn = (vttStore.currentTurn - 1 + vttStore.combatants.length) % vttStore.combatants.length;
}

export function updateCombatantHp(id: string, hp: number) {
  const combatant = vttStore.combatants.find(c => c.id === id);
  if (!combatant) return;

  const prev = combatant.hp;
  const next = Math.max(0, hp);
  const delta = next - prev;
  combatant.hp = next;

  if (delta !== 0) {
    addCombatLogEntry({
      type: delta < 0 ? (next === 0 ? 'death' : 'damage') : 'heal',
      actor: combatant.name,
      value: Math.abs(delta),
      detail: delta < 0 ? `-${Math.abs(delta)} PV` : `+${delta} PV`,
    });
  }

  // Sync HP to the linked token on the map
  if (combatant.tokenId) {
    const token = vttStore.tokens.find(t => t.id === combatant.tokenId);
    if (token) {
      token.hp = next;
      emitToPlayerView('update_tokens', vttStore.tokens);
    }
  }
}

export function addCombatant(name: string, initiative: number, hp: number, isEnemy: boolean) {
  // Mémoriser le combattant actif : le re-tri par initiative change les index
  const activeId = vttStore.combatants[vttStore.currentTurn]?.id;
  vttStore.combatants = [...vttStore.combatants, {
    id: Math.random().toString(36).slice(2),
    name,
    initiative,
    hp,
    maxHp: hp,
    isEnemy,
  }].sort((a, b) => b.initiative - a.initiative);
  const idx = vttStore.combatants.findIndex(c => c.id === activeId);
  vttStore.currentTurn = idx >= 0 ? idx : Math.min(vttStore.currentTurn, vttStore.combatants.length - 1);
}

export function removeCombatant(id: string) {
  const idx = vttStore.combatants.findIndex(c => c.id === id);
  if (idx === -1) return;
  vttStore.combatants = vttStore.combatants.filter(c => c.id !== id);
  if (vttStore.combatants.length === 0) {
    vttStore.currentTurn = 0;
    return;
  }
  // Retirer un combattant placé avant le tour actif décale les index
  if (idx < vttStore.currentTurn) {
    vttStore.currentTurn--;
  } else if (vttStore.currentTurn >= vttStore.combatants.length) {
    vttStore.currentTurn = 0;
  }
}

// ── Audio ─────────────────────────────────────────────────────────
export function updateGmAudio(src: string | null) {
  vttStore.audioSrc = src;
  emitToPlayerView('update_player_audio', { src, volume: vttStore.audioVolume, src2: vttStore.audio2Src, volume2: vttStore.audio2Volume });
}

export function setGmAudioVolume(volume: number) {
  vttStore.audioVolume = volume;
  emitToPlayerView('update_player_audio', { src: vttStore.audioSrc, volume, src2: vttStore.audio2Src, volume2: vttStore.audio2Volume });
}

export function updateGmAudio2(src: string | null) {
  vttStore.audio2Src = src;
  emitToPlayerView('update_player_audio', { src: vttStore.audioSrc, volume: vttStore.audioVolume, src2: src, volume2: vttStore.audio2Volume });
}

export function setGmAudio2Volume(volume: number) {
  vttStore.audio2Volume = volume;
  emitToPlayerView('update_player_audio', { src: vttStore.audioSrc, volume: vttStore.audioVolume, src2: vttStore.audio2Src, volume2: volume });
}

// ── Sync ──────────────────────────────────────────────────────────
export function addGmWall(points: {x:number, y:number}[]) {
  vttStore.walls.push({
    id: Math.random().toString(36).slice(2),
    points,
    type: vttStore.blueprintType,
    isOpen: false
  });
  emitToPlayerView('update_walls', vttStore.walls);
}

export function toggleGmDoor(id: string) {
  const wall = vttStore.walls.find(w => w.id === id);
  if (wall && wall.type === 'door') {
    wall.isOpen = !wall.isOpen;
  }
  emitToPlayerView('update_walls', vttStore.walls);
}

export function clearGmWalls() { vttStore.walls = []; emitToPlayerView('update_walls', vttStore.walls); }
export function removeGmWall(id: string) { vttStore.walls = vttStore.walls.filter(w => w.id !== id); emitToPlayerView('update_walls', vttStore.walls); }
export function undoGmWall() { vttStore.walls.pop(); emitToPlayerView('update_walls', vttStore.walls); }

export function addGmAudioZone(x: number, y: number, radius: number, audioSrc: string) {
  vttStore.audioZones.push({ id: Math.random().toString(36).slice(2), x, y, radius, audioSrc, volume: 0.8 });
  emitToPlayerView('update_audio_zones', vttStore.audioZones);
}
export function removeGmAudioZone(id: string) {
  vttStore.audioZones = vttStore.audioZones.filter(z => z.id !== id);
  emitToPlayerView('update_audio_zones', vttStore.audioZones);
}

export function syncStateToPlayerView() {
  if (vttStore.currentMap) {
    emitToPlayerView('set_player_map', { url: vttStore.currentMap });
  }
  emitToPlayerView('update_fow', vttStore.fowShapes);
  emitToPlayerView('update_tokens', vttStore.tokens);
  emitToPlayerView('update_pins', vttStore.pins);
  emitToPlayerView('toggle_player_grid', { show: vttStore.showGrid });
  emitToPlayerView('update_player_audio', { src: vttStore.audioSrc, volume: vttStore.audioVolume, src2: vttStore.audio2Src, volume2: vttStore.audio2Volume });
  emitToPlayerView('set_weather', { weather: vttStore.weather });
  emitToPlayerView('update_spells', vttStore.spells);
  emitToPlayerView('update_draw_paths', vttStore.drawPaths);
  emitToPlayerView('update_walls', vttStore.walls);
  emitToPlayerView('update_audio_zones', vttStore.audioZones);
}

// ── Persistence session ───────────────────────────────────────────
const SESSION_PATH = '.grimoire/session.json';

interface SessionData {
  version: number;
  mapRelPath: string | null;
  fowShapes: FowShape[];
  tokens: Token[];
  pins: MapPin[];
  spells: SpellMarker[];
  drawPaths: DrawPath[];
  walls: WallDef[];
  audioZones: AudioZoneDef[];
  showGrid: boolean;
  gridSize: number;
  isBlackout: boolean;
  weather: string;
  ambientLight?: 'day' | 'dusk' | 'night' | 'pitch_black';
  lights?: LightSource[];
  soundEmitters?: SoundEmitter[];
  audioSrc: string | null;
  audioVolume: number;
  audio2Src?: string | null;
  audio2Volume?: number;
  combatants: Combatant[];
  combatActive: boolean;
  currentTurn: number;
  campaignTitle?: string;
  maps?: MapScene[];
  activeMapId?: string | null;
  dungeonTiles?: DungeonTile[];
}

export async function saveGmSession(vaultPath: string) {
  // Snapshot current state into active scene before saving
  snapshotActiveScene();
  const data: SessionData = {
    version: 1,
    mapRelPath: vttStore.currentMapRelPath,
    fowShapes: vttStore.fowShapes,
    tokens: vttStore.tokens,
    pins: vttStore.pins,
    spells: vttStore.spells,
    drawPaths: vttStore.drawPaths,
    walls: vttStore.walls,
    audioZones: vttStore.audioZones,
    showGrid: vttStore.showGrid,
    gridSize: vttStore.gridSize,
    isBlackout: vttStore.isBlackout,
    weather: vttStore.weather,
    ambientLight: vttStore.ambientLight,
    lights: vttStore.lights,
    soundEmitters: vttStore.soundEmitters,
    audioSrc: vttStore.audioSrc,
    audioVolume: vttStore.audioVolume,
    audio2Src: vttStore.audio2Src,
    audio2Volume: vttStore.audio2Volume,
    combatants: vttStore.combatants,
    combatActive: vttStore.combatActive,
    currentTurn: vttStore.currentTurn,
    campaignTitle: vttStore.campaignTitle,
    maps: vttStore.maps,
    activeMapId: vttStore.activeMapId,
    dungeonTiles: vttStore.dungeonTiles,
  };
  try {
    await writeFile(vaultPath, SESSION_PATH, JSON.stringify(data, null, 2));
  } catch {
    // Dossier .grimoire inexistant → le créer puis réessayer
    try {
      await createDirectory(vaultPath, '.grimoire');
      await writeFile(vaultPath, SESSION_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Failed to save VTT session:', err);
    }
  }
}

export async function loadGmSession(vaultPath: string): Promise<boolean> {
  try {
    const raw = await readFile(vaultPath, SESSION_PATH);
    const data: SessionData = JSON.parse(raw);

    vttStore.fowShapes = data.fowShapes ?? [];
    vttStore.tokens = data.tokens ?? [];
    vttStore.pins = data.pins ?? [];
    vttStore.spells = data.spells ?? [];
    vttStore.showGrid = data.showGrid ?? true;
    vttStore.gridSize = data.gridSize ?? 50;
    vttStore.isBlackout = data.isBlackout ?? false;
    vttStore.weather = (data.weather ?? 'none') as typeof vttStore.weather;
    vttStore.ambientLight = data.ambientLight ?? 'day';
    vttStore.lights = data.lights ?? [];
    vttStore.soundEmitters = data.soundEmitters ?? [];
    vttStore.audioSrc = data.audioSrc ?? null;
    vttStore.audioVolume = data.audioVolume ?? 0.5;
    vttStore.audio2Src = data.audio2Src ?? null;
    vttStore.audio2Volume = data.audio2Volume ?? 0.4;
    vttStore.combatants = data.combatants ?? [];
    vttStore.combatActive = data.combatActive ?? false;
    // Clamp : un fichier de session modifié/corrompu ne doit pas pointer hors liste
    vttStore.currentTurn = Math.min(Math.max(0, data.currentTurn ?? 0), Math.max(0, vttStore.combatants.length - 1));
    vttStore.campaignTitle = data.campaignTitle ?? '';
    vttStore.maps = data.maps ?? [];
    vttStore.activeMapId = data.activeMapId ?? null;
    vttStore.drawPaths = data.drawPaths ?? [];
    vttStore.walls = data.walls ?? [];
    vttStore.audioZones = data.audioZones ?? [];
    vttStore.dungeonTiles = data.dungeonTiles ?? [];

    // Recharger la carte depuis le chemin relatif (active scene first)
    const activeScene = vttStore.maps.find(m => m.id === vttStore.activeMapId);
    const mapRelPath = activeScene?.relPath ?? data.mapRelPath;
    if (mapRelPath) {
      vttStore.currentMapRelPath = mapRelPath;
      try {
        const b64 = await readFileBase64(`${vaultPath}/${mapRelPath}`);
        const ext = mapRelPath.split('.').pop()?.toLowerCase() ?? 'png';
        const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg'
                   : ext === 'webp' ? 'image/webp' : 'image/png';
        vttStore.currentMap = `data:${mime};base64,${b64}`;
        // Apply active scene state if multimap exists
        if (activeScene) {
          vttStore.fowShapes = [...activeScene.fowShapes];
          vttStore.tokens = [...activeScene.tokens];
          vttStore.pins = [...activeScene.pins];
          vttStore.spells = [...activeScene.spells];
          vttStore.walls = [...activeScene.walls || []];
          vttStore.audioZones = [...activeScene.audioZones || []];
        }
      } catch {
        vttStore.currentMap = null;
        vttStore.currentMapRelPath = null;
      }
    }

    return true;
  } catch {
    return false; // Pas de session sauvegardée
  }
}

export function setAmbientLight(level: 'day' | 'dusk' | 'night' | 'pitch_black') {
  vttStore.ambientLight = level;
  emitToPlayerView('update_ambient_light', level);
}

export function addLightSource(light: Omit<LightSource, 'id'>) {
  const newLight: LightSource = {
    ...light,
    id: `light_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  };
  vttStore.lights.push(newLight);
  emitToPlayerView('update_lights', vttStore.lights);
  return newLight;
}

export function removeLightSource(id: string) {
  vttStore.lights = vttStore.lights.filter(l => l.id !== id);
  emitToPlayerView('update_lights', vttStore.lights);
}

export function triggerLightningFlash() {
  vttStore.lightningFlash = true;
  emitToPlayerView('trigger_lightning_flash', {});
  setTimeout(() => {
    vttStore.lightningFlash = false;
  }, 180);
}
