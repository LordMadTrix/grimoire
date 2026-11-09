// ── Dialogue & Speaker Parser pour Narration Multi-Voix ───────────────────────
// Analyse un texte de scénario ou de livre pour distinguer le narrateur des
// dialogues de PNJ et assigner automatiquement la voix IA la plus adaptée.

import { NEURAL_VOICES } from '$lib/services/edgeTts';

export interface NarrationSegment {
  id?: string;
  text: string;
  isDialogue: boolean;
  speakerName: string;
  voiceId: string;
  voiceEmoji: string;
}

// Mappage des profils de voix IA neuronales HD
export const VOICE_PROFILES = {
  narrator: { id: 'fr-FR-HenriNeural', name: '🧙‍♂️ Henri (Narrateur Fantastique)', emoji: '🧙‍♂️' },
  epic_female: { id: 'fr-FR-DeniseNeural', name: '🧝‍♀️ Denise (Conteuse & Reine)', emoji: '🧝‍♀️' },
  mage_female: { id: 'fr-FR-EloiseNeural', name: '🔮 Éloïse (Magicienne & Vive)', emoji: '🔮' },
  hero_male: { id: 'fr-FR-AlainNeural', name: '⚔️ Alain (Héros & Guerrier)', emoji: '⚔️' },
  sage_male: { id: 'fr-FR-MauriceNeural', name: '📜 Maurice (Vieux Sage & Érudit)', emoji: '📜' },
  guard_male: { id: 'fr-CA-JeanNeural', name: '🛡️ Jean (Garde & Ranger)', emoji: '🛡️' },
  noble_male: { id: 'fr-FR-ClaudeNeural', name: '👑 Claude (Noble & Solennel)', emoji: '👑' },
  bard_male: { id: 'fr-FR-JeromeNeural', name: '🎭 Jérôme (Barde & Voyageur)', emoji: '🎭' },
  druid_female: { id: 'fr-FR-CoralieNeural', name: '🌿 Coralie (Prêtresse & Nature)', emoji: '🌿' },
  fairy_female: { id: 'fr-CA-SylvieNeural', name: '✨ Sylvie (Fée & Enchanteresse)', emoji: '✨' }
};

/**
 * Détermine la voix PNJ la plus appropriée selon le contexte sémantique ou le nom de l'orateur
 */
export function inferSpeakerVoice(speakerName: string, contextText = ''): { voiceId: string; speaker: string; emoji: string } {
  const combined = `${speakerName} ${contextText}`.toLowerCase();

  // Fée / Enchanteresse / Elfe céleste
  if (combined.match(/\b(fée|pixie|sylphide|esprit|enchanteresse|nymphe)\b/)) {
    return { voiceId: VOICE_PROFILES.fairy_female.id, speaker: speakerName || '✨ Fée / Enchanteresse', emoji: '✨' };
  }

  // Prêtresse / Druidesse / Nature
  if (combined.match(/\b(druide|druidesse|prêtresse|soigneuse|guérisseuse|nature|plante|arbre)\b/)) {
    return { voiceId: VOICE_PROFILES.druid_female.id, speaker: speakerName || '🌿 Prêtresse / Druidesse', emoji: '🌿' };
  }

  // Magicienne / Sorcière / Jeune PNJ
  if (combined.match(/\b(magicienne|sorcière|mage|illusion|sort|jeune fille|apprentie|faucon)\b/)) {
    return { voiceId: VOICE_PROFILES.mage_female.id, speaker: speakerName || '🔮 Magicienne / Sorcière', emoji: '🔮' };
  }

  // Femme / Dame / Reine / PNJ Féminin noble
  if (combined.match(/\b(elle|femme|dame|reine|duchesse|aubergiste|servante|tavernier|châtelaine)\b/) || combined.match(/\b(dit-elle|s'écria-t-elle|demanda-t-elle|murmura-t-elle)\b/)) {
    return { voiceId: VOICE_PROFILES.epic_female.id, speaker: speakerName || '🧝‍♀️ PNJ Féminin', emoji: '🧝‍♀️' };
  }

  // Vieux Sage / Érudit / Moine / Ancien
  if (combined.match(/\b(vieux|sage|érudit|ancien|maître|prêtre|moine|vieillard|savant|archiviste)\b/)) {
    return { voiceId: VOICE_PROFILES.sage_male.id, speaker: speakerName || '📜 Vieux Sage', emoji: '📜' };
  }

  // Noble / Roi / Seigneur / Juge / Démon solennel
  if (combined.match(/\b(roi|prince|seigneur|duc|noble|juge|baron|empereur|commandant)\b/)) {
    return { voiceId: VOICE_PROFILES.noble_male.id, speaker: speakerName || '👑 Seigneur / Noble', emoji: '👑' };
  }

  // Barde / Voleur / Filou / Marchand
  if (combined.match(/\b(barde|ménestrel|voleur|filou|marchand|jongleur|voyageur|musicien)\b/)) {
    return { voiceId: VOICE_PROFILES.bard_male.id, speaker: speakerName || '🎭 Barde / Voyageur', emoji: '🎭' };
  }

  // Garde / Soldat / Nain / Orc / Tavernier bourru
  if (combined.match(/\b(garde|soldat|nain|orc|gobelin|tavernier|bandit|milicien|capitaine|patron)\b/) || combined.match(/\b(grogna|hurla|aboya|ordonna)\b/)) {
    return { voiceId: VOICE_PROFILES.guard_male.id, speaker: speakerName || '🛡️ Garde / Soldat', emoji: '🛡️' };
  }

  // PNJ Masculin / Aventurier / Guerrier par défaut
  return { voiceId: VOICE_PROFILES.hero_male.id, speaker: speakerName || '⚔️ Aventurier / Combattant', emoji: '⚔️' };
}

/**
 * Découpe un texte en segments alternant Narrateur et Dialogues PNJ avec assignation des voix IA
 */
export function parseMultiVoiceSegments(
  text: string,
  defaultNarratorVoice = VOICE_PROFILES.narrator.id
): NarrationSegment[] {
  if (!text || !text.trim()) return [];

  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const segments: NarrationSegment[] = [];

  for (const line of rawLines) {
    // Cas 1 : Préfixe de dialogue explicite "Nom : Réplique" ou "Nom: « Réplique »"
    const speakerPrefixMatch = line.match(/^([A-ZÀ-Ýa-zà-ÿ0-9_\s'’\u00C0-\u017F-]{2,25})\s*:\s*(.+)$/);
    if (speakerPrefixMatch) {
      const rawName = speakerPrefixMatch[1].trim();
      let dialogueBody = speakerPrefixMatch[2].trim();
      dialogueBody = dialogueBody.replace(/^[«"“—\-]\s*/, '').replace(/\s*[»"”]$/, '').trim();

      const isNarrator = rawName.toLowerCase().includes('narrateur') || rawName.toLowerCase().includes('description');
      if (isNarrator) {
        segments.push({
          id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: dialogueBody,
          isDialogue: false,
          speakerName: 'Narrateur',
          voiceId: defaultNarratorVoice,
          voiceEmoji: '🧙‍♂️'
        });
      } else {
        const voiceInfo = inferSpeakerVoice(rawName, dialogueBody);
        segments.push({
          id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: dialogueBody,
          isDialogue: true,
          speakerName: rawName,
          voiceId: voiceInfo.voiceId,
          voiceEmoji: voiceInfo.emoji
        });
      }
      continue;
    }

    // Cas 2 : Ligne commençant par un tiret cadratin ou tiret de dialogue (— ou -)
    if (line.match(/^[—–\-]\s*(.+)$/)) {
      const dialogueBody = line.replace(/^[—–\-]\s*/, '').trim();
      const voiceInfo = inferSpeakerVoice('', dialogueBody);
      segments.push({
        id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text: dialogueBody,
        isDialogue: true,
        speakerName: voiceInfo.speaker,
        voiceId: voiceInfo.voiceId,
        voiceEmoji: voiceInfo.emoji
      });
      continue;
    }

    // Cas 3 : Ligne contenant des guillemets (mélange de narration et de dialogues inline)
    const quoteRegex = /(«[^»]+»|"[^"]+"|[“][^”]+[”])/g;
    if (quoteRegex.test(line)) {
      quoteRegex.lastIndex = 0;
      let lastIdx = 0;
      let match: RegExpExecArray | null;

      while ((match = quoteRegex.exec(line)) !== null) {
        const start = match.index;
        const end = quoteRegex.lastIndex;

        // Narration avant
        const beforeText = line.slice(lastIdx, start).trim();
        if (beforeText.length > 0) {
          segments.push({
            id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            text: beforeText,
            isDialogue: false,
            speakerName: 'Narrateur',
            voiceId: defaultNarratorVoice,
            voiceEmoji: '🧙‍♂️'
          });
        }

        // Réplique
        const rawQuote = match[0];
        const cleanQuote = rawQuote.replace(/^[«"“]\s*/, '').replace(/\s*[»"”]$/, '').trim();
        if (cleanQuote.length > 0) {
          const surroundingContext = line.slice(Math.max(0, start - 50), Math.min(line.length, end + 50));
          const voiceInfo = inferSpeakerVoice('', surroundingContext);
          segments.push({
            id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            text: cleanQuote,
            isDialogue: true,
            speakerName: voiceInfo.speaker,
            voiceId: voiceInfo.voiceId,
            voiceEmoji: voiceInfo.emoji
          });
        }

        lastIdx = end;
      }

      // Reste après
      const afterText = line.slice(lastIdx).trim();
      if (afterText.length > 0) {
        segments.push({
          id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: afterText,
          isDialogue: false,
          speakerName: 'Narrateur',
          voiceId: defaultNarratorVoice,
          voiceEmoji: '🧙‍♂️'
        });
      }
      continue;
    }

    // Cas 4 : Ligne de narration classique
    segments.push({
      id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: line,
      isDialogue: false,
      speakerName: 'Narrateur',
      voiceId: defaultNarratorVoice,
      voiceEmoji: '🧙‍♂️'
    });
  }

  // Si aucun segment n'a été produit, fallback sur le texte brut
  if (segments.length === 0) {
    segments.push({
      id: `seg_${Date.now()}_root`,
      text: text.trim(),
      isDialogue: false,
      speakerName: 'Narrateur',
      voiceId: defaultNarratorVoice,
      voiceEmoji: '🧙‍♂️'
    });
  }

  return segments;
}
