import { emitToPlayerView, writeFile, readFile, createDirectory, readFileBase64 } from '../api';

// ── Undo stack ────────────────────────────────────────────────────
type UndoEntry =
  | { type: 'fow'; shapes: FowShape[] }
  | { type: 'draw'; paths: DrawPath[] }
  | { type: 'tokens'; tokens: Token[] };

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
  }
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
  visionRange?: number;
  lightRadius?: number;
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

export type Combatant = {
  id: string;
  name: string;
  initiative: number;
  hp: number;
  maxHp: number;
  isEnemy: boolean;
  tokenId?: string;
};

export type MapScene = {
  id: string;
  name: string;
  relPath: string | null;
  fowShapes: FowShape[];
  tokens: Token[];
  pins: MapPin[];
  spells: SpellMarker[];
  walls: { id: string, points: {x:number, y:number}[], type: 'opaque' | 'door', isOpen?: boolean }[];
  audioZones: { id: string, x: number, y: number, radius: number, audioSrc: string, volume: number }[];
};

export const vttStore = $state({
  currentMap: null as string | null,        // data URL (runtime uniquement)
  currentMapRelPath: null as string | null, // chemin relatif persisté
  fowShapes: [] as FowShape[],
  tokens: [] as Token[],
  pins: [] as MapPin[],
  mode: 'select' as 'select' | 'fog-reveal' | 'fog-hide' | 'fog-rect' | 'measure' | 'ping' | 'pin' | 'spell' | 'zoom-rect' | 'draw' | 'blueprint' | 'audio-zone',
  fitRequest: 0,
  showGrid: true,
  gridSize: 50,

  // Effets visuels
  weather: 'none' as 'none' | 'rain' | 'snow' | 'fog' | 'embers' | 'storm',
  spells: [] as SpellMarker[],
  spellType: 'fire' as SpellMarker['type'],
  spellRadius: 80,
  spellShape: 'circle' as 'circle' | 'cone' | 'line',
  spellLength: 200,
  spellConeAngle: Math.PI / 3,
  spellAngle: 0,
  spellAngleDeg: 0,

  // Audio Ambiance
  audioSrc: null as string | null,
  audioVolume: 0.5,
  audio2Src: null as string | null,
  audio2Volume: 0.4,

  // Combat / Initiative
  combatants: [] as Combatant[],
  combatActive: false,
  currentTurn: 0,
  combatRound: 1,

  // Timer de session
  sessionTimerStart: null as number | null,

  // Écran noir vue joueur
  isBlackout: false,

  // Blueprint / Murs (Ligne de vue)
  walls: [] as { id: string, points: {x:number, y:number}[], type: 'opaque' | 'door', isOpen?: boolean }[],
  currentWallPath: null as {x:number, y:number}[] | null,
  blueprintType: 'opaque' as 'opaque' | 'door',
  audioZones: [] as { id: string, x: number, y: number, radius: number, audioSrc: string, volume: number }[],

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
});

// ── Campaign Title ────────────────────────────────────────────────
export function setCampaignTitle(title: string) {
  vttStore.campaignTitle = title;
  emitToPlayerView('set_campaign_title', { title });
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
  vttStore.fowEnabled = !vttStore.fowEnabled;
  emitToPlayerView('toggle_fow', { enabled: vttStore.fowEnabled });
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
  vttStore.tokens = [...vttStore.tokens, token];
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
}

export function prevTurn() {
  if (vttStore.combatants.length === 0) return;
  vttStore.currentTurn = (vttStore.currentTurn - 1 + vttStore.combatants.length) % vttStore.combatants.length;
}

export function updateCombatantHp(id: string, hp: number) {
  const c = vttStore.combatants.find(c => c.id === id);
  if (c) c.hp = Math.max(0, hp);
  // Sync HP vers le token VTT associé
  const combatant = vttStore.combatants.find(c => c.id === id);
  if (combatant?.tokenId) {
    const token = vttStore.tokens.find(t => t.id === combatant.tokenId);
    if (token) {
      token.hp = Math.max(0, hp);
      emitToPlayerView('update_tokens', vttStore.tokens);
    }
  }
}

export function addCombatant(name: string, initiative: number, hp: number, isEnemy: boolean) {
  vttStore.combatants = [...vttStore.combatants, {
    id: Math.random().toString(36).slice(2),
    name,
    initiative,
    hp,
    maxHp: hp,
    isEnemy,
  }].sort((a, b) => b.initiative - a.initiative);
  // Réajuster le currentTurn si nécessaire
  vttStore.currentTurn = Math.min(vttStore.currentTurn, vttStore.combatants.length - 1);
}

export function removeCombatant(id: string) {
  vttStore.combatants = vttStore.combatants.filter(c => c.id !== id);
  if (vttStore.currentTurn >= vttStore.combatants.length && vttStore.combatants.length > 0) {
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
}

export function toggleGmDoor(id: string) {
  const wall = vttStore.walls.find(w => w.id === id);
  if (wall && wall.type === 'door') {
    wall.isOpen = !wall.isOpen;
  }
}

export function clearGmWalls() { vttStore.walls = []; }
export function removeGmWall(id: string) { vttStore.walls = vttStore.walls.filter(w => w.id !== id); }
export function undoGmWall() { vttStore.walls.pop(); }

export function addGmAudioZone(x: number, y: number, radius: number, audioSrc: string) {
  vttStore.audioZones.push({ id: Math.random().toString(36).slice(2), x, y, radius, audioSrc, volume: 0.8 });
}
export function removeGmAudioZone(id: string) {
  vttStore.audioZones = vttStore.audioZones.filter(z => z.id !== id);
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
  showGrid: boolean;
  gridSize: number;
  isBlackout: boolean;
  weather: string;
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
  drawPaths?: DrawPath[];
  walls?: { id: string, points: {x:number, y:number}[], type: 'opaque' | 'door', isOpen?: boolean }[];
  audioZones?: { id: string, x: number, y: number, radius: number, audioSrc: string, volume: number }[];
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
    drawPaths: vttStore.drawPaths,
    walls: vttStore.walls,
    audioZones: vttStore.audioZones,
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
    vttStore.audioSrc = data.audioSrc ?? null;
    vttStore.audioVolume = data.audioVolume ?? 0.5;
    vttStore.audio2Src = data.audio2Src ?? null;
    vttStore.audio2Volume = data.audio2Volume ?? 0.4;
    vttStore.combatants = data.combatants ?? [];
    vttStore.combatActive = data.combatActive ?? false;
    vttStore.currentTurn = data.currentTurn ?? 0;
    vttStore.campaignTitle = data.campaignTitle ?? '';
    vttStore.maps = data.maps ?? [];
    vttStore.activeMapId = data.activeMapId ?? null;
    vttStore.drawPaths = data.drawPaths ?? [];
    vttStore.walls = data.walls ?? [];
    vttStore.audioZones = data.audioZones ?? [];

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
