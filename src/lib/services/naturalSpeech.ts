// ── NLP Pipeline de Narration Vocale Naturelle pour JDR & Livres ─────────────
// Nettoie les artefacts de PDF/OCR, développe intelligemment les acronymes de JDR
// (MJ, PJ, PV, CA, dés, pièces d'or) et regroupe les phrases en paragraphes
// mélodiques pour une élocution humaine, fluide et vivante.

/**
 * Nettoie et formate un texte brut (PDF / OCR / Notes) pour une élocution naturelle et vivante
 */
export function formatTextForNaturalSpeech(rawText: string): string {
  if (!rawText) return '';

  let text = rawText;

  // 1. Réparer les césures de mots des PDF et sauts de ligne de colonnes
  text = text
    .replace(/(\w)[-—–]\s*\n\s*(\w)/g, '$1$2') // ex: "terri-\nble" -> "terrible"
    .replace(/(\w)[-—–]\s+(\w)/g, '$1$2') // ex: "terri- ble" -> "terrible" (artefact OCR)
    .replace(/\r\n/g, '\n')
    .replace(/\n\n+/g, ' §PARAGRAPH§ ') // Sauvegarder les vrais paragraphes
    .replace(/\n/g, ' ') // Aplatir les lignes de colonnes en phrases continues
    .replace(/\s+/g, ' ');

  // 2. Nettoyer les symboles parasites et artefacts d'OCR
  text = text
    .replace(/[|~_©®™►•◆★☆]/g, ' ')
    .replace(/\s*([,;:?.!])\s*/g, '$1 ') // Espaces propres autour de la ponctuation
    .replace(/\s+/g, ' ');

  // 3. Développer les acronymes et abréviations de Jeux de Rôle (JDR) en langage parlé naturel
  text = text
    .replace(/\bM\.?J\.?\b/gi, 'Maître du Jeu')
    .replace(/\bP\.?J\.?\b/gi, 'Personnage Joueur')
    .replace(/\bP\.?N\.?J\.?\b/gi, 'Personnage Non Joueur')
    .replace(/\bP\.?V\.?\b/g, 'points de vie')
    .replace(/\bC\.?A\.?\b/g, 'classe d\'armure')
    .replace(/\bX\.?P\.?\b/g, 'points d\'expérience')
    .replace(/\bP\.?O\.?\b/g, 'pièces d\'or')
    .replace(/\bP\.?A\.?\b/g, 'pièces d\'argent')
    .replace(/\bP\.?C\.?\b/g, 'pièces de cuivre')
    .replace(/\bP\.?P\.?\b/g, 'pièces de platine')
    .replace(/\bAD&D\b/gi, 'A D et D')
    .replace(/\bD&D\b/gi, 'D et D')
    .replace(/\b(1ère|1re)\s*éd(\.|ition)?/gi, 'Première Édition')
    .replace(/\b(2ème|2e)\s*éd(\.|ition)?/gi, 'Deuxième Édition')
    .replace(/\b(3ème|3e)\s*éd(\.|ition)?/gi, 'Troisième Édition')
    .replace(/\b(4ème|4e)\s*éd(\.|ition)?/gi, 'Quatrième Édition')
    .replace(/\b(5ème|5e)\s*éd(\.|ition)?/gi, 'Cinquième Édition')
    .replace(/\bchap\.\s*(\d+)/gi, 'chapitre $1')
    .replace(/\bvol\.\s*(\d+)/gi, 'volume $1')
    .replace(/\bp\.\s*(\d+)/gi, 'page $1')
    .replace(/\bpp\.\s*(\d+)/gi, 'pages $1')
    .replace(/\bex\.\s*/gi, 'par exemple, ')
    .replace(/\betc\.\s*/gi, 'et cætera. ')
    .replace(/\bvs\.\s*/gi, 'contre ')
    .replace(/\bn[°o]\.?\s*(\d+)/gi, 'numéro $1');

  // 4. Développer la notation des dés de JDR (ex: 1d20 -> 1 dé 20, 3d6 -> 3 dés 6)
  text = text
    .replace(/(\d+)\s*d\s*(\d+)/gi, (match, count, sides) => {
      const c = parseInt(count);
      return `${c} ${c > 1 ? 'dés' : 'dé'} ${sides}`;
    })
    .replace(/\bd(20|12|10|8|6|4|100)\b/gi, 'dé $1');

  // 5. Rétablir les pauses naturelles de paragraphes
  text = text.replace(/§PARAGRAPH§/g, '\n\n').trim();

  return text;
}

/**
 * Découpe intelligemment le texte en blocs de narration cohérents et mélodiques
 * (évite les micro-coupures de 1 ou 2 mots qui rendent la voix robotique).
 */
export function clusterTextIntoNaturalSentences(text: string): string[] {
  const formatted = formatTextForNaturalSpeech(text);
  if (!formatted) return [];

  // Séparer d'abord par paragraphe
  const paragraphs = formatted.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0);
  const result: string[] = [];

  for (const para of paragraphs) {
    // Découper sur la ponctuation forte (. ? ! ;) suivie d'une majuscule ou guillemet
    const rawClauses = para.split(/(?<=[.?!;])\s+(?=[A-ZÀ-ÖØ-ß«"0-9])/);
    
    let currentChunk = '';

    for (const clause of rawClauses) {
      const trimmed = clause.trim();
      if (!trimmed) continue;

      if (!currentChunk) {
        currentChunk = trimmed;
      } else {
        // Si le morceau actuel est très court (< 45 caractères), le fusionner pour garder une intonation fluide
        if (currentChunk.length < 45 || trimmed.length < 25) {
          currentChunk += ' ' + trimmed;
        } else {
          result.push(currentChunk);
          currentChunk = trimmed;
        }
      }
    }

    if (currentChunk) {
      result.push(currentChunk);
    }
  }

  return result;
}
