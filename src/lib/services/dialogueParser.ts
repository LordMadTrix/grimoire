// ── Dialogue & Speaker Parser pour Narration Multi-Voix ───────────────────────
// Analyse un texte de scénario ou de livre pour distinguer le narrateur des
// dialogues de PNJ et assigner automatiquement la voix IA la plus adaptée.

import { NEURAL_VOICES } from '$lib/services/edgeTts';
import { voiceProfilesStore } from '$lib/stores/voiceProfiles.svelte';

export interface NarrationSegment {
  id?: string;
  text: string;
  isDialogue: boolean;
  speakerName: string;
  voiceId: string;
  voiceEmoji: string;
  rate?: number;
  pitch?: number;
  acoustics?: 'normal' | 'cave' | 'cathedral' | 'telepathy' | 'spectral';
  tokenId?: string;
}

// Mappage des profils de voix IA neuronales HD
export const VOICE_PROFILES = {
  narrator: { id: 'fr-FR-HenriNeural', name: '🧙‍♂️ Henri (Narrateur Fantastique)', emoji: '🧙‍♂️' },
  epic_female: { id: 'fr-FR-DeniseNeural', name: '🧝‍♀️ Denise (Conteuse & Reine)', emoji: '🧝‍♀️' },
  mage_female: { id: 'fr-FR-EloiseNeural', name: '🔮 Éloïse (Magicienne & Vive)', emoji: '🔮' },
  hero_male: { id: 'fr-FR-RemyMultilingualNeural', name: '⚔️ Rémy (Héros & Aventurier)', emoji: '⚔️' },
  sage_male: { id: 'fr-BE-GerardNeural', name: '📜 Gérard (Vieux Sage & Érudit)', emoji: '📜' },
  guard_male: { id: 'fr-CA-JeanNeural', name: '🛡️ Jean (Garde & Soldat)', emoji: '🛡️' },
  innkeeper_male: { id: 'fr-CA-AntoineNeural', name: '🍺 Antoine (Tavernier & Marchand)', emoji: '🍺' },
  dark_warrior_male: { id: 'fr-CA-ThierryNeural', name: '💀 Thierry (Guerrier Sombre & Nain)', emoji: '💀' },
  noble_female: { id: 'fr-FR-VivienneMultilingualNeural', name: '👑 Vivienne (Reine & Noble)', emoji: '👑' },
  ranger_female: { id: 'fr-CH-ArianeNeural', name: '🏹 Ariane (Rôdeuse & Amazone)', emoji: '🏹' },
  bard_male: { id: 'fr-CH-FabriceNeural', name: '🎭 Fabrice (Barde & Voyageur)', emoji: '🎭' },
  druid_female: { id: 'fr-BE-CharlineNeural', name: '🌿 Charline (Prêtresse & Nature)', emoji: '🌿' },
  fairy_female: { id: 'fr-CA-SylvieNeural', name: '✨ Sylvie (Fée & Enchanteresse)', emoji: '✨' }
};

/**
 * Détermine la voix PNJ la plus appropriée selon le contexte sémantique ou le nom de l'orateur
 */
export function inferSpeakerVoice(speakerName: string, contextText = ''): { voiceId: string; speaker: string; emoji: string; rate?: number; pitch?: number } {
  const profile = voiceProfilesStore.inferVoiceFor(speakerName, contextText);
  return {
    voiceId: profile.baseVoiceId,
    speaker: speakerName || profile.name,
    emoji: profile.emoji,
    rate: profile.rate,
    pitch: profile.pitch
  };
}

/**
 * Assure qu'une réplique ou narration se termine par une ponctuation propre (. ! ? ...)
 * pour garantir une intonation naturelle et une pause de respiration dans le moteur vocal IA.
 */
export function ensureTerminalPunctuation(str: string): string {
  const trimmed = str.trim();
  if (!trimmed) return trimmed;
  if (/[.!?…:;]$/.test(trimmed)) return trimmed;
  return `${trimmed}.`;
}

/**
 * Nettoie et harmonise la ponctuation et les guillemets d'un texte Markdown :
 * - Ferme les guillemets orphelins (ex: "Bonjour -> "Bonjour.")
 * - Normalise les tirets de dialogue en tiret cadratin (« — »)
 * - Ajoute un point ou des points de suspension manquants en fin de réplique
 * - Remplace les espaces multiples et espaces avant les points
 */
export function normalizeMarkdownDialogueAndPunctuation(rawText: string): string {
  if (!rawText) return rawText;

  const lines = rawText.split('\n');
  const processedLines = lines.map(line => {
    let l = line.trimEnd();
    if (!l.trim()) return l;

    // Remplacement des espaces multiples
    l = l.replace(/[ \t]{2,}/g, ' ');

    // Espaces incorrects avant point ou virgule
    l = l.replace(/\s+([.,;:!?])/g, '$1');

    // Dialogue par tiret : "- Salut" ou "-- Salut" -> "— Salut."
    if (/^(\s*)[-–—]{1,2}\s+(.*)/.test(l)) {
      const indent = l.match(/^(\s*)/)?.[1] || '';
      let body = l.replace(/^(\s*)[-–—]{1,2}\s+/, '').trim();
      body = ensureTerminalPunctuation(body);
      return `${indent}— ${body}`;
    }

    // Dialogue par "Nom : Réplique" ou "**Nom** : Réplique"
    const speakerMatch = l.match(/^(\s*(?:>\s*)?(?:\*{1,2})?)([A-ZÀ-Ýa-zà-ÿ0-9_\s'’\u00C0-\u017F-]{2,30})((?:\*{1,2})?\s*:\s*)(.+)$/);
    if (speakerMatch) {
      const prefix = speakerMatch[1];
      const speaker = speakerMatch[2].trim();
      const middle = speakerMatch[3];
      let speech = speakerMatch[4].trim();

      // Guillemets existants ou ouverts
      let hasQuotes = false;
      if (/^[«"“]/.test(speech)) {
        hasQuotes = true;
        speech = speech.replace(/^[«"“]\s*/, '').replace(/\s*[»"”]$/, '').trim();
      }

      speech = ensureTerminalPunctuation(speech);
      if (hasQuotes || !speech.startsWith('"')) {
        return `${prefix}${speaker}${middle}"${speech}"`;
      }
      return `${prefix}${speaker}${middle}${speech}`;
    }

    // Ligne avec un nombre impair de guillemets doubles (guillemet orphelin)
    const quoteCount = (l.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      l = ensureTerminalPunctuation(l) + '"';
    }

    return l;
  });

  return processedLines.join('\n');
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

  let currentCalloutSpeaker: { name: string; voiceId: string; emoji: string } | null = null;

  for (const line of rawLines) {
    // Cas 0.1 : Balise Markdown Callout Narration (> [!NARRATION] ou > [!NARRATEUR])
    const narrationCalloutMatch = line.match(/^>\s*\[!(?:NARRATION|NARRATEUR|READALOUD)\]\s*(.*)$/i);
    if (narrationCalloutMatch) {
      currentCalloutSpeaker = { name: 'Narrateur', voiceId: defaultNarratorVoice, emoji: '🧙‍♂️' };
      const rest = narrationCalloutMatch[1].trim();
      if (rest) {
        segments.push({
          id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: ensureTerminalPunctuation(rest),
          isDialogue: false,
          speakerName: 'Narrateur',
          voiceId: defaultNarratorVoice,
          voiceEmoji: '🧙‍♂️'
        });
      }
      continue;
    }

    // Cas 0.2 : Balise Markdown Callout Dialogue (> [!DIALOGUE:Nom] ou > [!VOIX:Nom] ou > [!PNJ:Nom])
    const dialogueCalloutMatch = line.match(/^>\s*\[!(?:DIALOGUE|VOIX|PNJ):([^\]]+)\]\s*(.*)$/i);
    if (dialogueCalloutMatch) {
      const rawName = dialogueCalloutMatch[1].trim();
      const voiceInfo = inferSpeakerVoice(rawName, line);
      currentCalloutSpeaker = { name: rawName, voiceId: voiceInfo.voiceId, emoji: voiceInfo.emoji };
      const rest = dialogueCalloutMatch[2].trim();
      if (rest) {
        let clean = rest.replace(/^[«"“—\-]\s*/, '').replace(/\s*[»"”]$/, '').trim();
        segments.push({
          id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: ensureTerminalPunctuation(clean),
          isDialogue: true,
          speakerName: rawName,
          voiceId: voiceInfo.voiceId,
          voiceEmoji: voiceInfo.emoji
        });
      }
      continue;
    }

    // Cas 0.3 : Fin ou continuation de callout markdown (> texte)
    if (line.startsWith('>')) {
      const content = line.replace(/^>\s*/, '').trim();
      if (currentCalloutSpeaker && content.length > 0) {
        let clean = content.replace(/^[«"“—\-]\s*/, '').replace(/\s*[»"”]$/, '').trim();
        segments.push({
          id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: ensureTerminalPunctuation(clean),
          isDialogue: currentCalloutSpeaker.name !== 'Narrateur',
          speakerName: currentCalloutSpeaker.name,
          voiceId: currentCalloutSpeaker.voiceId,
          voiceEmoji: currentCalloutSpeaker.emoji
        });
        continue;
      }
    } else {
      currentCalloutSpeaker = null;
    }

    // Cas 1 : Préfixe de dialogue explicite "Nom : Réplique", "**Nom** : Réplique" ou "> Nom : Réplique"
    const speakerPrefixMatch = line.match(/^(\*{1,2})?([A-ZÀ-Ýa-zà-ÿ0-9_\s'’\u00C0-\u017F-]{2,30})(\*{1,2})?\s*:\s*(.+)$/);
    if (speakerPrefixMatch) {
      const rawName = speakerPrefixMatch[2].trim();
      let dialogueBody = speakerPrefixMatch[4].trim();
      dialogueBody = dialogueBody.replace(/^[«"“—\-]\s*/, '').replace(/\s*[»"”]$/, '').trim();

      const isNarrator = rawName.toLowerCase().includes('narrateur') || rawName.toLowerCase().includes('description');
      if (isNarrator) {
        segments.push({
          id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: ensureTerminalPunctuation(dialogueBody),
          isDialogue: false,
          speakerName: 'Narrateur',
          voiceId: defaultNarratorVoice,
          voiceEmoji: '🧙‍♂️'
        });
      } else {
        const voiceInfo = inferSpeakerVoice(rawName, dialogueBody);
        segments.push({
          id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: ensureTerminalPunctuation(dialogueBody),
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
        text: ensureTerminalPunctuation(dialogueBody),
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
            text: ensureTerminalPunctuation(beforeText),
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
            text: ensureTerminalPunctuation(cleanQuote),
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
          text: ensureTerminalPunctuation(afterText),
          isDialogue: false,
          speakerName: 'Narrateur',
          voiceId: defaultNarratorVoice,
          voiceEmoji: '🧙‍♂️'
        });
      }
      continue;
    }

    // Cas 3.5 : Guillemet orphelin au début ou au milieu (ligne non fermée)
    if (line.includes('"') || line.includes('«') || line.includes('“')) {
      const cleanLine = line.replace(/^[«"“]\s*/, '').replace(/\s*[»"”]$/, '').trim();
      const voiceInfo = inferSpeakerVoice('', cleanLine);
      segments.push({
        id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text: ensureTerminalPunctuation(cleanLine),
        isDialogue: true,
        speakerName: voiceInfo.speaker,
        voiceId: voiceInfo.voiceId,
        voiceEmoji: voiceInfo.emoji
      });
      continue;
    }

    // Cas 4 : Ligne de narration classique
    segments.push({
      id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: ensureTerminalPunctuation(line),
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
      text: ensureTerminalPunctuation(text.trim()),
      isDialogue: false,
      speakerName: 'Narrateur',
      voiceId: defaultNarratorVoice,
      voiceEmoji: '🧙‍♂️'
    });
  }

  return segments;
}
