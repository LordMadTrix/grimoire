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
  { id: 'fr-FR-EloiseNeural', name: '🔮 Éloïse (Mystique & Vive)', gender: 'female', personality: 'Voix jeune, dynamique et cristalline', lang: 'fr-FR', isAi: true },
  { id: 'fr-FR-AlainNeural', name: '⚔️ Alain (Héros & Guerrier)', gender: 'male', personality: 'Voix héroïque, claire et martiale', lang: 'fr-FR', isAi: true },
  { id: 'fr-FR-MauriceNeural', name: '📜 Maurice (Vieux Sage & Érudit)', gender: 'male', personality: 'Voix d\'ancien érudit, calme et posée', lang: 'fr-FR', isAi: true },
  { id: 'fr-FR-ClaudeNeural', name: '👑 Claude (Noble & Solennel)', gender: 'male', personality: 'Voix impériale, solennelle et profonde', lang: 'fr-FR', isAi: true },
  { id: 'fr-FR-JeromeNeural', name: '🎭 Jérôme (Barde & Voyageur)', gender: 'male', personality: 'Voix narrative, enjouée et vivante', lang: 'fr-FR', isAi: true },
  { id: 'fr-FR-CoralieNeural', name: '🌿 Coralie (Prêtresse & Nature)', gender: 'female', personality: 'Voix sereine, harmonieuse et douce', lang: 'fr-FR', isAi: true },
  { id: 'fr-CA-JeanNeural', name: '🛡️ Jean (Garde & Ranger)', gender: 'male', personality: 'Voix robuste et chaleureuse', lang: 'fr-CA', isAi: true },
  { id: 'fr-CA-SylvieNeural', name: '✨ Sylvie (Fée & Enchanteresse)', gender: 'female', personality: 'Voix féerique et aérienne', lang: 'fr-CA', isAi: true }
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
