// ── Edge Neural TTS Service (IA Haute Définition) ────────────────────────────
// Fournit des voix de synthèse vocale neuronales ultra-réalistes et naturelles
// (Microsoft Azure Neural HD) en streaming direct MP3, 100% gratuit et sans clé API.

import { invoke } from '@tauri-apps/api/core';

export interface NeuralVoice {
  id: string;
  name: string;
  gender: 'male' | 'female';
  personality: string;
  lang: string;
  isAi: true;
}

export const NEURAL_VOICES: NeuralVoice[] = [
  { id: 'fr-FR-HenriNeural', name: '🧙‍♂️ Henri (Narrateur Fantastique)', gender: 'male', personality: 'Voix grave et posée, idéale pour les donjons & le lore', lang: 'fr-FR', isAi: true },
  { id: 'fr-FR-DeniseNeural', name: '🧝‍♀️ Denise (Conteuse Épique)', gender: 'female', personality: 'Voix douce, expressive et captivante', lang: 'fr-FR', isAi: true },
  { id: 'fr-FR-EloiseNeural', name: '🔮 Éloïse (Magicienne & Mystique)', gender: 'female', personality: 'Voix jeune, dynamique et cristalline', lang: 'fr-FR', isAi: true },
  { id: 'fr-FR-RemyMultilingualNeural', name: '⚔️ Rémy (Héros & Aventurier)', gender: 'male', personality: 'Voix héroïque, claire et martiale', lang: 'fr-FR', isAi: true },
  { id: 'fr-FR-VivienneMultilingualNeural', name: '👑 Vivienne (Reine & Châtelaine)', gender: 'female', personality: 'Voix noble, souveraine et expressive', lang: 'fr-FR', isAi: true },
  { id: 'fr-CA-JeanNeural', name: '🛡️ Jean (Garde & Soldat)', gender: 'male', personality: 'Voix robuste, martiale et directe', lang: 'fr-CA', isAi: true },
  { id: 'fr-CA-AntoineNeural', name: '🍺 Antoine (Tavernier & Marchand)', gender: 'male', personality: 'Voix chaleureuse, joviale et amicale', lang: 'fr-CA', isAi: true },
  { id: 'fr-CA-ThierryNeural', name: '💀 Thierry (Guerrier Sombre & Nain)', gender: 'male', personality: 'Voix rauque, bourrue et imposante', lang: 'fr-CA', isAi: true },
  { id: 'fr-CA-SylvieNeural', name: '✨ Sylvie (Fée & Enchanteresse)', gender: 'female', personality: 'Voix féerique, aérienne et mystique', lang: 'fr-CA', isAi: true },
  { id: 'fr-BE-CharlineNeural', name: '🌿 Charline (Prêtresse & Guérisseuse)', gender: 'female', personality: 'Voix douce, bienveillante et lumineuse', lang: 'fr-BE', isAi: true },
  { id: 'fr-BE-GerardNeural', name: '📜 Gérard (Vieux Sage & Érudit)', gender: 'male', personality: 'Voix d\'ancien savant, calme et posée', lang: 'fr-BE', isAi: true },
  { id: 'fr-CH-ArianeNeural', name: '🏹 Ariane (Rôdeuse & Amazone)', gender: 'female', personality: 'Voix vive, déterminée et agile', lang: 'fr-CH', isAi: true },
  { id: 'fr-CH-FabriceNeural', name: '🎭 Fabrice (Barde & Voyageur)', gender: 'male', personality: 'Voix narrative, enjouée et théâtrale', lang: 'fr-CH', isAi: true }
];

/**
 * Synthétise un texte en voix neuronale IA ultra-réaliste via le backend Rust natif
 * et retourne une URL Blob audio MP3 haute fidélité.
 */
export async function synthesizeNeuralSpeech(
  text: string,
  voiceId = 'fr-FR-HenriNeural',
  rate = 1.0,
  pitch = 1.0
): Promise<string> {
  const cleanText = text.trim();
  if (!cleanText) throw new Error('Texte vide');

  try {
    // 1. Appel natif Tauri Rust avec en-têtes et token Sec-MS-GEC certifiés
    const bytes = await invoke<number[]>('tts_synthesize_neural', {
      text: cleanText,
      voice: voiceId,
      rate,
      pitch
    });

    if (bytes && bytes.length > 0) {
      const u8 = new Uint8Array(bytes);
      const blob = new Blob([u8], { type: 'audio/mp3' });
      return URL.createObjectURL(blob);
    }
    throw new Error('Aucun octet audio reçu');
  } catch (err: any) {
    console.error('Erreur synthèse vocale neuronale Rust:', err);
    throw err;
  }
}
