export type GemCategory = 
  | 'precieuse' 
  | 'fine' 
  | 'ornementale' 
  | 'magique';

export type GemCut = 
  | 'brut' 
  | 'cabochon' 
  | 'brillant' 
  | 'coussin' 
  | 'emeraude' 
  | 'goutte' 
  | 'ovale'
  | 'marquise'
  | 'baguette'
  | 'trillant';

export interface Gem {
  id: string;
  name: string;
  category: GemCategory;
  color: string;
  accentColor: string;
  weightGoltors: number; // Poids moyen standard en unités Goltor (système Naheulbeuk)
  basePriceRaw: number; // Prix brut en Pièces d'Or (PO)
  basePriceCut: number; // Prix taillé par joaillier en Pièces d'Or (PO)
  rarity: 'Commune' | 'Peu commune' | 'Rare' | 'Très rare' | 'Légendaire';
  hardnessMohs: number; // Échelle de Mohs (1 à 10)
  originPlaces: string[]; // ex: "Mines naines de Fangh", "Volcans de Glargh"
  description: string;
  visualAspect: string;
  magicalAffinity: string; // Élément ou école de magie
  enchantmentEffect: string; // Effet de sertissage sur arme, armure ou bijou
  naheulbeukLore: string; // Humour ou anecdote typique univers Naheulbeuk/JDR
  cutType: GemCut;
}

export interface GemLootRoll {
  d20: number;
  gem: Gem;
  weight: number;
  isCut: boolean;
  purity: 'Parfaite (+50%)' | 'Standard' | 'Avec inclusions (-25%)';
  finalValuePo: number;
}

export type ProspectingSiteId =
  | 'riviere'
  | 'montagne'
  | 'caverne'
  | 'volcan'
  | 'cote'
  | 'astral';

export interface ProspectingSite {
  id: ProspectingSiteId;
  name: string;
  icon: string;
  subtitle: string;
  description: string;
  dcBase: number;
  difficultyLabel: string;
  keyMinerals: string;
  availableGemIds: string[];
}

export type ProspectingToolId =
  | 'batee'
  | 'marteau'
  | 'loupe'
  | 'lanterne';

export interface ProspectingTool {
  id: ProspectingToolId;
  name: string;
  icon: string;
  description: string;
  bonus: number;
}

export interface ProspectingRollResult {
  d20: number;
  skillBonus: number;
  toolBonus: number;
  conditionBonus: number;
  total: number;
  dc: number;
  success: boolean;
  critSuccess: boolean;
  critFail: boolean;
  foundGem: Gem | null;
  weightGoltors: number;
  state: 'brute' | 'geode' | 'alluviale' | 'gravier';
  purity: 'Parfaite (+50%)' | 'Standard' | 'Avec inclusions (-25%)';
  finalValuePo: number;
  flavorTitle: string;
  flavorDesc: string;
  hazardNote?: string;
  isGeode: boolean;
  geodeCracked?: boolean;
}

// Gem Cutting Workshop types
export interface GemCuttingPattern {
  id: GemCut;
  name: string;
  icon: string;
  facetCount: number;
  description: string;
  dcMod: number;
  valueMultiplier: number;
}

export type LapidaryWheelId = 'gres' | 'emeri' | 'diamant' | 'feutre_cerium';

export interface LapidaryWheel {
  id: LapidaryWheelId;
  name: string;
  icon: string;
  description: string;
  bonus: number;
  suitableMohs: string;
}

export interface GemCuttingRollResult {
  d20: number;
  artisanBonus: number;
  wheelBonus: number;
  total: number;
  dc: number;
  outcome: 'masterpiece' | 'standard' | 'flawed' | 'shattered';
  gem: Gem;
  chosenPattern: GemCuttingPattern;
  weightGoltors: number;
  finalValuePo: number;
  title: string;
  desc: string;
  enchantmentBonus?: string;
}
