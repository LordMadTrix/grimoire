// src/lib/stores/settings.svelte.ts

export interface AiTonePreset {
  id: string;
  name: string;
  icon: string;
  desc: string;
  systemPrompt: string;
}

export const AI_TONE_PRESETS: AiTonePreset[] = [
  {
    id: 'heroic_fantasy',
    name: 'Fantasy Héroïque',
    icon: '🧙‍♂️',
    desc: 'Univers merveilleux, magie vivante, bravoure et aventures captivantes (style D&D, Pathfinder).',
    systemPrompt: "En tant qu'assistant de jeu de rôle (style fantasy héroïque et merveilleuse), assiste le Maître du Jeu avec créativité, panache et clarté, sans obscurantisme excessif."
  },
  {
    id: 'dark_fantasy',
    name: 'Dark Fantasy',
    icon: '🌑',
    desc: 'Atmosphère sombre, magie corruptrice, créatures menaçantes et mystères occultes (style Warhammer, Dark Souls).',
    systemPrompt: "En tant qu'assistant de jeu de rôle (style dark fantasy), développe de manière immersive, mystérieuse et viscérale, avec tension et danger palpable."
  },
  {
    id: 'medieval_realistic',
    name: 'Médiéval Réaliste',
    icon: '⚔️',
    desc: 'Historique, âpre, matériel et politique, sans magie omniprésente ni clichés.',
    systemPrompt: "En tant qu'assistant de jeu de rôle (style médiéval réaliste et historique), décris avec précision matérielle, rigueur d'époque et authenticité, sans surnaturel non sollicité."
  },
  {
    id: 'investigation',
    name: 'Enquête & Mystère',
    icon: '🕵️',
    desc: 'Indices subtils, fausses pistes, ambiance feutrée et suspense captivant (style Cthulhu, Polar).',
    systemPrompt: "En tant qu'assistant de jeu de rôle (style enquête, polar et mystère), distille des indices évocateurs, des ambiances pleines de secrets et des détails intrigants."
  },
  {
    id: 'scifi',
    name: 'Sci-Fi & Cyberpunk',
    icon: '🚀',
    desc: 'Technologies futuristes, dystopie, néons, implants et mégacorporations (style Cyberpunk, Starfinder).',
    systemPrompt: "En tant qu'assistant de jeu de rôle (style science-fiction et cyberpunk), intègre terminologie technologique, ambiance urbaine futuriste et contrastes sociaux."
  },
  {
    id: 'neutral',
    name: 'Neutre & Factuel',
    icon: '🛡️',
    desc: 'Précis, soigné, sans teinte d\'univers imposée (idéal pour les règles, fiches et corrections).',
    systemPrompt: "Tu es un assistant de rédaction neutre et méthodique pour jeu de rôle. Réponds précisément à la demande avec clarté, concision et rigueur, sans ajouter de thème imaginaire non demandé."
  }
];

let aiModel = $state('llama3.2:1b');
let aiToneId = $state('heroic_fantasy');
let aiSystemPrompt = $state(AI_TONE_PRESETS[0].systemPrompt);

// Initialize from LocalStorage
if (typeof window !== 'undefined') {
  const savedModel = localStorage.getItem('grimoire_aiModel');
  if (savedModel) aiModel = savedModel;

  const savedTone = localStorage.getItem('grimoire_aiToneId');
  if (savedTone && AI_TONE_PRESETS.some(t => t.id === savedTone)) {
    aiToneId = savedTone;
  }

  const savedPrompt = localStorage.getItem('grimoire_aiSystemPrompt');
  if (savedPrompt) {
    // Si l'ancien prompt enregistré contenait l'ancienne phrase forcée "dark fantasy", on bascule sur le preset actuel
    if (savedPrompt.includes('style dark fantasy') && (!savedTone || savedTone !== 'dark_fantasy')) {
      const currentPreset = AI_TONE_PRESETS.find(t => t.id === aiToneId) || AI_TONE_PRESETS[0];
      aiSystemPrompt = currentPreset.systemPrompt;
      localStorage.setItem('grimoire_aiSystemPrompt', currentPreset.systemPrompt);
    } else {
      aiSystemPrompt = savedPrompt;
    }
  } else {
    const currentPreset = AI_TONE_PRESETS.find(t => t.id === aiToneId) || AI_TONE_PRESETS[0];
    aiSystemPrompt = currentPreset.systemPrompt;
  }
}

export function getAiModel() {
  return aiModel;
}

export function setAiModel(model: string) {
  aiModel = model;
  if (typeof window !== 'undefined') {
    localStorage.setItem('grimoire_aiModel', model);
  }
}

export function getAiToneId() {
  return aiToneId;
}

export function setAiToneId(toneId: string) {
  aiToneId = toneId;
  const preset = AI_TONE_PRESETS.find(t => t.id === toneId);
  if (preset) {
    aiSystemPrompt = preset.systemPrompt;
    if (typeof window !== 'undefined') {
      localStorage.setItem('grimoire_aiSystemPrompt', preset.systemPrompt);
    }
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem('grimoire_aiToneId', toneId);
  }
}

export function getAiSystemPrompt() {
  return aiSystemPrompt;
}

export function setAiSystemPrompt(prompt: string) {
  aiSystemPrompt = prompt;
  if (typeof window !== 'undefined') {
    localStorage.setItem('grimoire_aiSystemPrompt', prompt);
  }
}
