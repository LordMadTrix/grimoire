import { emitToPlayerView } from '../api';

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
  isEnemy?: boolean;
  imageUrl?: string;
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

export const vttStore = $state({
  currentMap: null as string | null,
  fowShapes: [] as FowShape[],
  tokens: [] as Token[],
  mode: 'select' as 'select' | 'fog-reveal' | 'fog-hide' | 'measure',
  showGrid: true,
  gridSize: 50,

  // Audio Ambiance
  audioSrc: null as string | null,
  audioVolume: 0.5,

  // Combat / Initiative
  combatants: [] as Combatant[],
  combatActive: false,
  currentTurn: 0,
});

// ── Map ──────────────────────────────────────────────────────────
export function setGmCurrentMap(map: string | null) { vttStore.currentMap = map; }

// ── FOW ──────────────────────────────────────────────────────────
export function addGmFowShape(shape: FowShape) {
  vttStore.fowShapes = [...vttStore.fowShapes, shape];
  emitToPlayerView('update_fow', vttStore.fowShapes);
}

export function undoGmFow() {
  if (vttStore.fowShapes.length === 0) return;
  vttStore.fowShapes = vttStore.fowShapes.slice(0, -1);
  emitToPlayerView('update_fow', vttStore.fowShapes);
}

export function clearGmFow() {
  vttStore.fowShapes = [];
  emitToPlayerView('update_fow', vttStore.fowShapes);
}

// ── Tokens ───────────────────────────────────────────────────────
export function updateGmToken(id: string, x: number, y: number) {
  vttStore.tokens = vttStore.tokens.map(t => t.id === id ? { ...t, x, y } : t);
  emitToPlayerView('update_tokens', vttStore.tokens);
}

export function replaceGmToken(token: Token) {
  vttStore.tokens = vttStore.tokens.map(t => t.id === token.id ? token : t);
  emitToPlayerView('update_tokens', vttStore.tokens);
}

export function addGmToken(token: Token) {
  vttStore.tokens = [...vttStore.tokens, token];
  emitToPlayerView('update_tokens', vttStore.tokens);
}

export function removeGmToken(id: string) {
  vttStore.tokens = vttStore.tokens.filter(t => t.id !== id);
  emitToPlayerView('update_tokens', vttStore.tokens);
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
  vttStore.combatActive = true;
}

export function stopCombat() {
  vttStore.combatActive = false;
  vttStore.combatants = [];
  vttStore.currentTurn = 0;
}

export function nextTurn() {
  if (vttStore.combatants.length === 0) return;
  vttStore.currentTurn = (vttStore.currentTurn + 1) % vttStore.combatants.length;
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
  emitToPlayerView('update_player_audio', { src, volume: vttStore.audioVolume });
}

export function setGmAudioVolume(volume: number) {
  vttStore.audioVolume = volume;
  emitToPlayerView('update_player_audio', { src: vttStore.audioSrc, volume });
}

// ── Sync ──────────────────────────────────────────────────────────
export function syncStateToPlayerView() {
  if (vttStore.currentMap) {
    emitToPlayerView('set_player_map', { url: vttStore.currentMap });
  }
  emitToPlayerView('update_fow', vttStore.fowShapes);
  emitToPlayerView('update_tokens', vttStore.tokens);
  emitToPlayerView('toggle_player_grid', { show: vttStore.showGrid });
  emitToPlayerView('update_player_audio', { src: vttStore.audioSrc, volume: vttStore.audioVolume });
}
