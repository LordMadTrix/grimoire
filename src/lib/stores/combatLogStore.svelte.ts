// ── Store de Journal & Historique de Combat Chronologique (v0.8.19) ─────────
import { askOllama } from '$lib/api';
import { notifStore } from './notifications.svelte';

export interface CombatLogEntry {
  id: string;
  time: string;
  round: number;
  actor: string;
  action: string;
  type: 'turn' | 'damage' | 'heal' | 'defeat' | 'spell' | 'dice';
}

let entries = $state<CombatLogEntry[]>([]);
let isDrawerOpen = $state<boolean>(false);
let isGeneratingNarrative = $state<boolean>(false);
let generatedNarrative = $state<string>('');

export const combatLogStore = {
  get entries() { return entries; },
  get isDrawerOpen() { return isDrawerOpen; },
  get isGeneratingNarrative() { return isGeneratingNarrative; },
  get generatedNarrative() { return generatedNarrative; },

  toggleDrawer() { isDrawerOpen = !isDrawerOpen; },
  openDrawer() { isDrawerOpen = true; },
  closeDrawer() { isDrawerOpen = false; },

  add(actor: string, action: string, type: CombatLogEntry['type'], round: number = 1) {
    const d = new Date();
    const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
    const newEntry: CombatLogEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      time,
      round,
      actor,
      action,
      type
    };
    entries.unshift(newEntry);
    if (entries.length > 120) {
      entries.pop();
    }
  },

  clear() {
    entries = [];
    generatedNarrative = '';
  },

  async generateBattleNarrative(): Promise<string> {
    if (entries.length === 0) {
      notifStore.add('⚠️', 'Historique vide', 'Enregistrez quelques actions de combat avant de générer le récit.', 'warn', 3000);
      return '';
    }

    isGeneratingNarrative = true;
    try {
      // Préparer les 25 actions les plus marquantes dans l'ordre chronologique
      const chronos = [...entries].reverse().slice(0, 30);
      const logText = chronos.map(e => `[Round ${e.round}] ${e.actor} : ${e.action}`).join('\n');

      const prompt = `Voici les événements marquants d'un combat de jeu de rôle fantastique sur table :\n\n${logText}\n\nRédige un résumé dramatique, viscéral et héroïque en 2 courts paragraphes en français (ambiance Warhammer Dark Fantasy). Mets en valeur la bravoure, le sang versé, les coups critiques et l'issue de l'affrontement.`;

      const response = await askOllama(prompt, '', 'Tu es un chroniqueur de guerre et conteur dark fantasy héroïque.');
      generatedNarrative = response.trim();
      notifStore.add('⚔️', 'Récit de Bataille généré', 'Le compte-rendu épique est prêt !', 'success', 3500);
      return generatedNarrative;
    } catch (err: any) {
      notifStore.add('❌', 'Erreur IA', err?.message || 'Ollama est-il bien lancé ?', 'danger', 4000);
      return '';
    } finally {
      isGeneratingNarrative = false;
    }
  }
};
