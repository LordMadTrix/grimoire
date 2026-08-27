// ── Dialogue & Speaker Parser pour Narration Multi-Voix ───────────────────────
// Analyse un texte de scénario ou de livre pour distinguer le narrateur des
// dialogues de PNJ et assigner automatiquement la voix IA la plus adaptée.

import { NEURAL_VOICES } from '$lib/services/edgeTts';

export interface NarrationSegment {
  text: string;
  isDialogue: boolean;
  speakerName: string;
  voiceId: string;
  voiceEmoji: string;
}

// Mappage des profils de voix IA
const VOICE_NARRATOR = 'fr-FR-HenriNeural';   // 🧙‍♂️ Henri - Narrateur principal
const VOICE_FEMALE_NPC = 'fr-FR-DeniseNeural'; // 🧝‍♀️ Denise - PNJ Féminin doux/noble
const VOICE_MAGE_NPC = 'fr-FR-EloiseNeural';   // 🔮 Éloïse - Magicienne/Fée/Jeune PNJ
const VOICE_HERO_NPC = 'fr-FR-AlainNeural';    // ⚔️ Alain - Guerrier/Aventurier
const VOICE_SAGE_NPC = 'fr-FR-MauriceNeural';  // 📜 Maurice - Ancien/Érudit/Prêtre
const VOICE_GUARD_NPC = 'fr-CA-JeanNeural';    // 🛡️ Jean - Garde/Soldat/Ranger

/**
 * Détermine la voix PNJ la plus appropriée selon le contexte sémantique entourant la réplique
 */
function inferNpcVoice(contextText: string): { voiceId: string; speaker: string; emoji: string } {
  const lower = contextText.toLowerCase();

  // Détection PNJ Féminin / Magique
  if (lower.match(/\b(elle|femme|fille|dame|magicienne|sorcière|prêtresse|reine|elfe|fée|aubergiste)\b/) || lower.match(/\b(dit-elle|s'écria-t-elle|demanda-t-elle|murmura-t-elle)\b/)) {
    if (lower.match(/\b(jeune|fée|magique|mystique|sort)\b/)) {
      return { voiceId: VOICE_MAGE_NPC, speaker: '🔮 Magicienne / PNJ', emoji: '🔮' };
    }
    return { voiceId: VOICE_FEMALE_NPC, speaker: '🧝‍♀️ PNJ Féminin', emoji: '🧝‍♀️' };
  }

  // Détection Ancien / Sage
  if (lower.match(/\b(vieux|sage|érudit|ancien|druide|maître|prêtre|moine|vieillard)\b/)) {
    return { voiceId: VOICE_SAGE_NPC, speaker: '📜 Sage / Érudit', emoji: '📜' };
  }

  // Détection Garde / Soldat / Nain / Monstre
  if (lower.match(/\b(garde|soldat|nain|orc|gobelin|tavernier|bandit|voleur|capitaine)\b/) || lower.match(/\b(grogna|hurla|aboya|ordonna)\b/)) {
    return { voiceId: VOICE_GUARD_NPC, speaker: '🛡️ Garde / Soldat', emoji: '🛡️' };
  }

  // PNJ Masculin / Aventurier par défaut
  return { voiceId: VOICE_HERO_NPC, speaker: '⚔️ PNJ / Aventurier', emoji: '⚔️' };
}

/**
 * Découpe un texte en segments alternant Narrateur et Dialogues PNJ avec assignation des voix IA
 */
export function parseMultiVoiceSegments(
  text: string,
  defaultNarratorVoice = VOICE_NARRATOR
): NarrationSegment[] {
  if (!text || !text.trim()) return [];

  const segments: NarrationSegment[] = [];

  // Regex pour capturer les dialogues entre guillemets français « ... » ou anglais " ... "
  const quoteRegex = /(«[^»]+»|"[^"]+"|[“][^”]+[”])/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = quoteRegex.exec(text)) !== null) {
    const start = match.index;
    const end = quoteRegex.lastIndex;

    // 1. Texte narratif avant la réplique
    const beforeText = text.slice(lastIndex, start).trim();
    if (beforeText.length > 0) {
      segments.push({
        text: beforeText,
        isDialogue: false,
        speakerName: 'Narrateur',
        voiceId: defaultNarratorVoice,
        voiceEmoji: '🧙‍♂️'
      });
    }

    // 2. Réplique du dialogue
    const dialogueRaw = match[0];
    const cleanDialogue = dialogueRaw
      .replace(/^[«"“]\s*/, '')
      .replace(/\s*[»"”]$/, '')
      .trim();

    if (cleanDialogue.length > 0) {
      // Regarder le contexte narratif autour de la réplique pour déduire qui parle
      const surroundingContext = text.slice(Math.max(0, start - 60), Math.min(text.length, end + 60));
      const npcInfo = inferNpcVoice(surroundingContext);

      segments.push({
        text: cleanDialogue,
        isDialogue: true,
        speakerName: npcInfo.speaker,
        voiceId: npcInfo.voiceId,
        voiceEmoji: npcInfo.emoji
      });
    }

    lastIndex = end;
  }

  // 3. Texte narratif final restant après le dernier dialogue
  const remainingText = text.slice(lastIndex).trim();
  if (remainingText.length > 0) {
    segments.push({
      text: remainingText,
      isDialogue: false,
      speakerName: 'Narrateur',
      voiceId: defaultNarratorVoice,
      voiceEmoji: '🧙‍♂️'
    });
  }

  // Si aucun dialogue n'a été détecté, renvoyer le texte entier en narration pure
  if (segments.length === 0) {
    segments.push({
      text: text.trim(),
      isDialogue: false,
      speakerName: 'Narrateur',
      voiceId: defaultNarratorVoice,
      voiceEmoji: '🧙‍♂️'
    });
  }

  return segments;
}
