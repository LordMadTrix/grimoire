// ── Narrative Segmenter pour Scénarios de JDR ─────────────────────────────────

export interface NarrativeCard {
  id: string;
  title: string;
  category: 'description' | 'dialogue' | 'combat' | 'event' | 'gm_note';
  text: string;
  wordCount: number;
  readingTimeSec: number;
}

/**
 * Découpe intelligemment le texte d'une page de scénario en cartes narratives prêtes pour le MJ
 */
export function segmentPageIntoNarrativeCards(pageText: string): NarrativeCard[] {
  if (!pageText || pageText.trim().length === 0) return [];

  const rawBlocks = pageText
    .split(/\n\s*\n/)
    .map(b => b.trim())
    .filter(b => b.length > 20);

  if (rawBlocks.length === 0) return [];

  const cards: NarrativeCard[] = [];

  for (let i = 0; i < rawBlocks.length; i++) {
    const block = rawBlocks[i];
    const words = block.split(/\s+/).length;
    const readingTimeSec = Math.max(2, Math.round((words / 140) * 60)); // ~140 mots/min

    // Déterminer la catégorie
    let category: NarrativeCard['category'] = 'gm_note';
    let title = `Section ${i + 1}`;

    const lower = block.toLowerCase();

    // Détection d'événements ou chapitres
    if (/^(év[eè]nement|chapitre|rencontre|partie|scène|acte)\s*\d+/i.test(block)) {
      category = 'event';
      const firstLine = block.split('\n')[0];
      title = firstLine.length < 50 ? firstLine : `Évènement ${i + 1}`;
    }
    // Détection de dialogues
    else if (block.includes('«') || block.includes('»') || block.includes('"') || /dit|s['’]écrie|répond|murmure/i.test(lower)) {
      category = 'dialogue';
      title = `Dialogue & Paroles`;
    }
    // Détection de combat / monstres
    else if (/\b(pv|ca|dv|points de vie|classe d['’]armure|dégâts|attaque|hobgobelin|dragon|orque|goule)\b/i.test(lower)) {
      category = 'combat';
      title = `Rencontre / Combat`;
    }
    // Détection de descriptions sensorielles / ambiance
    else if (/vous voyez|vous entendez|l['’]odeur|la pièce|devant vous|le couloir|l['’]obscurité|soudain|une douce musique/i.test(lower)) {
      category = 'description';
      title = `Description d'Ambiance`;
    }

    cards.push({
      id: `card-${i}-${Date.now()}`,
      title,
      category,
      text: block,
      wordCount: words,
      readingTimeSec
    });
  }

  return cards;
}
