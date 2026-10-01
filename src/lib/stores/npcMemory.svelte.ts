// ── Mémoire de campagne des PNJ ─────────────────────────────────────────────
// Chaque PNJ rencontré accumule localement un résumé de ses interactions avec
// les personnages joueurs. Quand le MJ le recroise, la mémoire est réinjectée
// dans les prompts IA (ou affichée telle quelle) pour un PNJ qui SE SOUVIENT.
// Persistance : .grimoire/npc-memory.json dans le coffre (voyage avec la campagne).

import { readFile, writeFile } from '$lib/api';
import { getVaultPath } from '$lib/stores/vault.svelte';

export interface NpcInteraction {
  /** Date ISO de l'interaction */
  date: string;
  /** Résumé court de ce qui s'est passé */
  summary: string;
}

export interface NpcMemory {
  /** Identifiant stable : nom normalisé en minuscules */
  id: string;
  /** Nom d'affichage du PNJ */
  name: string;
  /** Résumé cumulé (utilisé comme contexte IA) */
  summary: string;
  /** Historique des interactions (les plus récentes en dernier, plafonné) */
  interactions: NpcInteraction[];
  updatedAt: string;
}

const MAX_INTERACTIONS = 20;
const MAX_SUMMARY_CHARS = 1200;

let memories = $state<NpcMemory[]>([]);
let loaded = false;
let loadPromise: Promise<void> | null = null;

function memoryFilePath(): string {
  return '.grimoire/npc-memory.json';
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function ensureNpcMemoryLoaded(): Promise<void> {
  if (loaded) return;
  loadPromise ??= (async () => {
    const vp = getVaultPath();
    if (!vp) { loaded = true; return; }
    try {
      const raw = await readFile(vp, memoryFilePath());
      const data = JSON.parse(raw);
      memories = Array.isArray(data?.npcs) ? data.npcs : [];
    } catch {
      memories = [];
    }
    loaded = true;
  })();
  return loadPromise;
}

async function persist(): Promise<void> {
  const vp = getVaultPath();
  if (!vp) return;
  try {
    await writeFile(vp, memoryFilePath(), JSON.stringify({ version: 1, npcs: memories }, null, 2));
  } catch (e) {
    console.warn('Sauvegarde mémoire PNJ impossible:', e);
  }
}

export function getNpcMemories(): NpcMemory[] {
  return memories;
}

export function findNpcMemory(name: string): NpcMemory | undefined {
  const id = normalizeName(name);
  return memories.find(m => m.id === id);
}

/** Recherche floue par nom (mémoire pleine de campagnes, saisie approximative) */
export function searchNpcMemories(query: string): NpcMemory[] {
  const q = normalizeName(query);
  if (!q) return memories;
  return memories.filter(m => m.name.toLowerCase().includes(q) || m.summary.toLowerCase().includes(q));
}

/**
 * Enregistre une interaction : ajoute au journal et régénère le résumé cumulé.
 * Retourne la mémoire mise à jour.
 */
export async function saveNpcInteraction(name: string, summary: string): Promise<NpcMemory> {
  await ensureNpcMemoryLoaded();
  const id = normalizeName(name);
  if (!id) throw new Error('Nom de PNJ requis');

  const now = new Date().toISOString();
  let mem = memories.find(m => m.id === id);
  if (!mem) {
    mem = { id, name: name.trim(), summary: '', interactions: [], updatedAt: now };
    memories.push(mem);
  }
  mem.interactions.push({ date: now, summary: summary.trim() });
  if (mem.interactions.length > MAX_INTERACTIONS) {
    mem.interactions = mem.interactions.slice(-MAX_INTERACTIONS);
  }
  // Résumé cumulé : dernières interactions, borné pour rester un contexte IA compact
  const recent = mem.interactions.slice(-8).map(i => `• ${i.date.slice(0, 10)} : ${i.summary}`);
  mem.summary = recent.join('\n').slice(-MAX_SUMMARY_CHARS);
  mem.updatedAt = now;

  await persist();
  return mem;
}

/**
 * Bloc de contexte à injecter dans un prompt IA.
 * Retourne une chaîne vide si le PNJ est inconnu (aucune mémoire).
 */
export function getNpcMemoryContext(name: string): string {
  const mem = findNpcMemory(name);
  if (!mem || mem.interactions.length === 0) return '';
  return `MÉMOIRE DE CAMPAGNE — interactions passées entre ce PNJ et les personnages (à respecter pour la cohérence) :\n${mem.summary}`;
}

/** Efface la mémoire d'un PNJ (droit à l'oubli du MJ) */
export async function forgetNpc(name: string): Promise<void> {
  await ensureNpcMemoryLoaded();
  const id = normalizeName(name);
  memories = memories.filter(m => m.id !== id);
  await persist();
}

/** Compteurs pour l'interface */
export function npcMemoryCount(): number {
  return memories.length;
}
