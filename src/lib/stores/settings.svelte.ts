// src/lib/stores/settings.svelte.ts
let aiModel = $state('gemma2:9b');
let aiSystemPrompt = $state('En tant que Maître du Jeu de rôle (style dark fantasy), développe ou décris de manière immersive ceci :');

// Initialize from LocalStorage
if (typeof window !== 'undefined') {
  const savedModel = localStorage.getItem('grimoire_aiModel');
  if (savedModel) aiModel = savedModel;

  const savedPrompt = localStorage.getItem('grimoire_aiSystemPrompt');
  if (savedPrompt) aiSystemPrompt = savedPrompt;
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

export function getAiSystemPrompt() {
  return aiSystemPrompt;
}

export function setAiSystemPrompt(prompt: string) {
  aiSystemPrompt = prompt;
  if (typeof window !== 'undefined') {
    localStorage.setItem('grimoire_aiSystemPrompt', prompt);
  }
}
