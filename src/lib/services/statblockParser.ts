// ── Statblock Parser (Extraction de Fiches & Création de Jetons VTT) ──────────
// Analyse les blocs de texte (D&D 5e, AD&D, Pathfinder, Warhammer, générique)
// pour en extraire le nom, les PV, la CA, la vitesse et les attaques, et générer
// un jeton de monstre / PNJ complet sur la Table Virtuelle.

import { vttStore, type Token } from '$lib/stores/vtt.svelte';

export interface ParsedMonsterStats {
  name: string;
  hp: number;
  maxHp: number;
  ac: number;
  speed: string;
  isEnemy: boolean;
  size: number;
  cr?: string; // Challenge Rating / Niveau
  actions: { name: string; desc: string }[];
  rawText: string;
}

/**
 * Analyse un texte brut pour extraire les statistiques d'un monstre ou PNJ
 */
export function parseStatblockText(text: string): ParsedMonsterStats | null {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // 1. Nom : première ligne non vide ou mot-clé
  let name = 'Créature Sans Nom';
  if (lines.length > 0) {
    name = lines[0].replace(/^[#*_\s]+|[#*_\s]+$/g, '').slice(0, 40);
  }

  // 2. Points de Vie (HP / PV)
  let hp = 20;
  const hpMatch = text.match(/(?:Points de vie|PV|Hit Points|HP)\s*[:=]?\s*(\d+)(?:\s*\(([^)]+)\))?/i);
  let hdMatch: RegExpMatchArray | null = null;
  if (hpMatch) {
    hp = parseInt(hpMatch[1], 10);
  } else {
    // Tentative OSR / AD&D (ex: "HD 3", "3d8", "DV 4")
    hdMatch = text.match(/(?:HD|DV|Dés de vie)\s*[:=]?\s*(\d+)/i);
    if (hdMatch) {
      hp = parseInt(hdMatch[1], 10) * 8; // Estimation moyenne 8 PV / HD
    }
  }

  // 3. Classe d'Armure (AC / CA)
  let ac = 12;
  const acMatch = text.match(/(?:Classe d'armure|CA|Armor Class|AC)\s*[:=]?\s*(\d+)/i);
  if (acMatch) {
    ac = parseInt(acMatch[1], 10);
  }

  // Aucun indicateur de statblock trouvé (ni PV, ni DV, ni CA) : ce n'est probablement
  // pas une fiche de monstre — signaler l'échec plutôt que de renvoyer des stats
  // par défaut trompeuses (PV 20 / CA 12) pour un simple paragraphe descriptif.
  if (!hpMatch && !hdMatch && !acMatch) {
    return null;
  }

  // 4. Vitesse
  let speed = '9 m (30 ft)';
  const speedMatch = text.match(/(?:Vitesse|Speed|Déplacement)\s*[:=]?\s*([^\n,.]+)/i);
  if (speedMatch) {
    speed = speedMatch[1].trim();
  }

  // 5. Détection Ennemi vs Allié
  const isEnemy = !text.toLowerCase().match(/\b(allié|pj|protecteur|familier|compagnon)\b/);

  // 6. Taille du jeton
  let size = 1;
  if (text.toLowerCase().match(/\b(très grande|huge|gargantuesque|gargantuan|colossale)\b/)) {
    size = 3;
  } else if (text.toLowerCase().match(/\b(grande|large|géant)\b/)) {
    size = 2;
  } else if (text.toLowerCase().match(/\b(petite|small|minuscule|tiny)\b/)) {
    size = 0.8;
  }

  // 7. Actions / Attaques
  const actions: { name: string; desc: string }[] = [];
  const actionMatches = text.matchAll(/(?:^|\n)\s*([A-ZÀ-ÖØ-ß][A-Za-zÀ-ÖØ-öø-ÿ\s'-]+)\.\s+([^\n]+)/g);
  for (const m of actionMatches) {
    if (m[1].length < 30 && !m[1].toLowerCase().includes('points de vie') && !m[1].toLowerCase().includes('classe d')) {
      actions.push({ name: m[1].trim(), desc: m[2].trim() });
    }
  }

  return {
    name,
    hp,
    maxHp: hp,
    ac,
    speed,
    isEnemy,
    size,
    actions: actions.slice(0, 5),
    rawText: text
  };
}

/**
 * Crée un jeton VTT PixiJS et l'ajoute directement sur la carte active
 */
export function createTokenFromStatblock(
  stats: ParsedMonsterStats,
  customCoords?: { x: number; y: number }
): Token {
  const id = `token_monster_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  
  // Placer au centre de la vue ou à une coordonnée spécifiée
  const x = customCoords?.x ?? 500 + Math.floor(Math.random() * 80 - 40);
  const y = customCoords?.y ?? 500 + Math.floor(Math.random() * 80 - 40);

  // Couleur du jeton : Rouge sang pour ennemi, Émeraude pour allié
  const color = stats.isEnemy ? 0xdc2626 : 0x16a34a;

  const newToken: Token = {
    id,
    name: stats.name,
    x,
    y,
    size: stats.size,
    color,
    hp: stats.hp,
    maxHp: stats.maxHp,
    ac: stats.ac,
    isEnemy: stats.isEnemy,
    visionRange: 60,
    darkvision: true,
    lightRadius: 0,
    visible: true,
    notes: `Vitesse: ${stats.speed}\nActions:\n` + stats.actions.map(a => `• ${a.name}: ${a.desc}`).join('\n')
  };

  vttStore.tokens = [...vttStore.tokens, newToken];
  return newToken;
}
