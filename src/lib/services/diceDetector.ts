// ── Détecteur & Lanceur de Dés Intelligent pour PDF de JDR ─────────────────────

export interface DetectedDice {
  formula: string;
  label: string;
  count: number;
  sides: number;
  modifier: number;
  rawMatch: string;
}

/**
 * Analyse le texte d'un livre/PDF et extrait toutes les formules de dés et tests de JDR
 */
export function extractDiceFromText(text: string): DetectedDice[] {
  if (!text) return [];

  const results: DetectedDice[] = [];
  const seen = new Set<string>();

  // Pattern pour formules de dés : 1d20+5, 2d6, 3d8-2, d20, 1d100, 4d6
  const diceRegex = /\b(?:(\d{1,2})?d(4|6|8|10|12|20|100)(?:\s*([+-])\s*(\d{1,2}))?)\b/gi;
  let match: RegExpExecArray | null;

  while ((match = diceRegex.exec(text)) !== null) {
    const raw = match[0].trim();
    const cleanKey = raw.toLowerCase().replace(/\s+/g, '');
    if (seen.has(cleanKey)) continue;
    seen.add(cleanKey);

    const count = match[1] ? parseInt(match[1], 10) : 1;
    const sides = parseInt(match[2], 10);
    const sign = match[3] || '+';
    const modVal = match[4] ? parseInt(match[4], 10) : 0;
    const modifier = sign === '-' ? -modVal : modVal;

    let formula = `${count}d${sides}`;
    if (modifier > 0) formula += `+${modifier}`;
    else if (modifier < 0) formula += `${modifier}`;

    results.push({
      formula,
      label: formula,
      count,
      sides,
      modifier,
      rawMatch: raw
    });
  }

  return results.slice(0, 12); // Limite raisonnable des dés les plus pertinents
}

/**
 * Exécute un jet de dé virtuel avec calcul des totaux et dispersion
 */
export function executeDiceRoll(dice: DetectedDice): { total: number; rolls: number[]; formula: string } {
  const rolls: number[] = [];
  for (let i = 0; i < dice.count; i++) {
    rolls.push(Math.floor(Math.random() * dice.sides) + 1);
  }
  const sum = rolls.reduce((acc, v) => acc + v, 0);
  const total = sum + dice.modifier;

  return {
    total,
    rolls,
    formula: dice.formula
  };
}
