// ── Character Sheet Markdown Parser ────────────────────────────────────────
// Extrait les champs structurés (nom, PV, race, classe...) d'une fiche
// personnage au format Markdown + frontmatter YAML simplifié.

export interface ParsedCharacterData {
  hp: number;
  maxhp: number;
  stats: Record<string, unknown>;
  race: string;
  voc: string;
  nom?: string;
}

export function parseCharacterMd(content: string): ParsedCharacterData {
  const data: ParsedCharacterData = { hp: 10, maxhp: 10, stats: {}, race: '', voc: '' };
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const fm = fmMatch[1];
    fm.split('\n').forEach(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) return;
      const k = line.slice(0, colonIndex).trim();
      const v = line.slice(colonIndex + 1).trim();
      if (k === 'hp' || k === 'bless') data.hp = parseInt(v);
      if (k === 'maxhp') data.maxhp = parseInt(v);
      if (k === 'race') data.race = v;
      if (k === 'class' || k === 'voc') data.voc = v;
      if (k === 'nom' || k === 'name') data.nom = v;
    });
  }
  if (!data.nom) {
    const h1Match = content.match(/^#\s+(.*)/m);
    if (h1Match) data.nom = h1Match[1].trim();
  }
  return data;
}
