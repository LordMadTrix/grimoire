import { invoke } from '@tauri-apps/api/core';

// ── Types ────────────────────────────────────────────────────────────────────

export interface StatDef {
  key: string;    // "cc"
  label: string;  // "Combat Corps-à-Corps"
  roll?: string;  // "2d6" | "1d10" | undefined = valeur fixe
}

export interface RaceDef {
  name: string;
  emoji: string;
  description: string;
  stats: Record<string, number>;
  fate: number;
  special: string[];
}

export interface CareerDef {
  name: string;
  category: string;
  stat_plan: string[];
  skills: string[];
  exits: string[];
}

export interface GameConfig {
  system: string;
  version: string;
  stats: StatDef[];
  hp_stat: string;
  exploding_dice: boolean;
  races: RaceDef[];
  careers: CareerDef[];
}

// ── Store ────────────────────────────────────────────────────────────────────

let config = $state<GameConfig | null>(null);
let loading = $state(false);
let error = $state<string | null>(null);

export function getGameConfig() { return config; }
export function isConfigLoading() { return loading; }
export function getConfigError() { return error; }

export async function loadGameConfig(vaultPath: string) {
  loading = true;
  error = null;
  try {
    config = await invoke<GameConfig>('load_game_config', { vaultPath });
    // Pousser la config vers le serveur mobile (si actif)
    try {
      await invoke('set_game_config', { config });
    } catch {
      // Serveur peut ne pas être démarré — pas bloquant
    }
  } catch (e) {
    error = String(e);
    console.error('Failed to load game config:', e);
  } finally {
    loading = false;
  }
}

export async function saveGameConfig(vaultPath: string, newConfig: GameConfig) {
  try {
    await invoke('save_game_config', { vaultPath, config: newConfig });
    config = newConfig;
  } catch (e) {
    console.error('Failed to save game config:', e);
    throw e;
  }
}

export function clearGameConfig() {
  config = null;
  error = null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Retourne les stats de départ d'une race + 0 pour les stats avec roll (à lancer) */
export function getRaceBaseStats(race: RaceDef, stats: StatDef[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const s of stats) {
    result[s.key] = race.stats[s.key] ?? 0;
  }
  return result;
}

/** Lance les dés pour une stat selon sa règle de roll */
export function rollStat(roll: string): number {
  const m2d6 = roll === '2d6';
  const m1d10 = roll === '1d10';
  if (m2d6) return Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
  if (m1d10) return Math.floor(Math.random() * 10) + 1;
  return 0;
}
