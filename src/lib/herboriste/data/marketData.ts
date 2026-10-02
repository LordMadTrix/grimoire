// Types and data for Regional Market Economy & Haggling Mini-Game

export interface TradeCity {
  id: string;
  name: string;
  region: string;
  ruler: string;
  icon: string;
  economyProfile: string;
  priceModifiers: {
    medicinalHerbs: number; // multiplier, e.g. 1.2
    poisons: number;
    rawGems: number;
    cutGems: number;
    antidotes: number;
    magicPotions: number;
  };
  rumors: string;
}

export interface MerchantNPC {
  id: string;
  name: string;
  title: string;
  race: string;
  cityId: string;
  avatarIcon: string;
  greedLevel: 'Faible' | 'Modéré' | 'Avare' | 'Voleur de grand chemin';
  patience: number; // 1 to 5
  personalityLore: string;
  preferredTactic: 'flatterie' | 'intimidation' | 'expertise' | 'pot_de_vin';
  weaknessLore: string;
}

export const TRADE_CITIES: TradeCity[] = [
  {
    id: 'glargh',
    name: 'Glargh la Marchande',
    region: 'Plaines Centrales de Fangh',
    ruler: 'Le Conseil des Guildes Francs',
    icon: '🏰',
    economyProfile: 'Carrefour opulent où tout s\'achète et se vend. Très forte demande en poisons rares et gemmes taillées de luxe.',
    priceModifiers: {
      medicinalHerbs: 1.0,
      poisons: 1.45,
      rawGems: 1.1,
      cutGems: 1.35,
      antidotes: 1.15,
      magicPotions: 1.25
    },
    rumors: 'Les nobles s\'empoisonnent entre eux pour des questions d\'héritage. Les fioles sombres se négocient à prix d\'or dans les ruelles.'
  },
  {
    id: 'waldorg',
    name: 'Waldorg des Érudits',
    region: 'Haute-Vallée Mystique',
    ruler: 'Archimage Melchior de la Tour Indigo',
    icon: '🔮',
    economyProfile: 'Cité universitaire et arcanique. Pénurie permanente de gemmes pures pour les focalisateurs de sorts et réactifs botaniques rares.',
    priceModifiers: {
      medicinalHerbs: 1.3,
      poisons: 0.8,
      rawGems: 1.25,
      cutGems: 1.5,
      antidotes: 0.9,
      magicPotions: 0.85
    },
    rumors: 'Les apprentis sorciers cassent des dizaines de baguettes chaque semaine. Les lapidaires y font fortune s\'ils connaissent les runes.'
  },
  {
    id: 'boulgourville',
    name: 'Boulgourville-les-Bains',
    region: 'Bocages et Vergers Tranquilles',
    ruler: 'Bourgmestre Grosbillon (Éleveur de porcs)',
    icon: '🌾',
    economyProfile: 'Bourgade paysanne et pacifique. Surplus d\'herbes ordinaires, mais méfiance totale envers les pierres précieuses et poisons.',
    priceModifiers: {
      medicinalHerbs: 0.65,
      poisons: 0.4,
      rawGems: 0.75,
      cutGems: 0.8,
      antidotes: 1.4,
      magicPotions: 1.1
    },
    rumors: 'Le bétail a attrapé la chiasse du marais. Le baume de consoude et les tisanes s\'arrachent, le reste n\'intéresse personne.'
  },
  {
    id: 'mir_mir',
    name: 'Mir-Mir des Profondeurs',
    region: 'Cavernes Sous-Montagneuses',
    ruler: 'Seigneur Nain Goltor Barbe-d\'Enclume',
    icon: '⛏️',
    economyProfile: 'Forteresse naine réputée pour ses forges. Les gemmes brutes ne valent rien ici car elles abondent, mais le bois sec et les herbes fraîches valent cher.',
    priceModifiers: {
      medicinalHerbs: 1.6,
      poisons: 0.9,
      rawGems: 0.5,
      cutGems: 0.7,
      antidotes: 1.2,
      magicPotions: 1.3
    },
    rumors: 'Les nains ont creusé trop profond et mangent des lichens sans goût. Si vous leur apportez du thym sauvage et du houblon, ils vous donneront une cassette de topazes.'
  },
  {
    id: 'chaillet',
    name: 'Chaillet la Garnison',
    region: 'Marches Frontalières des Barbares',
    ruler: 'Capitaine Vorstov aux Cent Cicatrices',
    icon: '⚔️',
    economyProfile: 'Poste fortifié en guerre perpétuelle contre les maraudeurs orcs. Demande vitale en baumes de vie, sang-dragon et bandages stériles.',
    priceModifiers: {
      medicinalHerbs: 1.2,
      poisons: 1.1,
      rawGems: 0.85,
      cutGems: 0.9,
      antidotes: 1.8,
      magicPotions: 1.75
    },
    rumors: 'Trois régiments de lanciers viennent d\'affronter des trolls des cavernes. L\'infirmerie paiera le prix fort pour toute fiole de soin ou garrot hémostatique.'
  }
];

export const MERCHANTS_NPC: MerchantNPC[] = [
  {
    id: 'borin_lingot',
    name: 'Borin Cuillère-d\'Or',
    title: 'Apothicaire & Banquier Nain',
    race: 'Nain de Fangh',
    cityId: 'glargh',
    avatarIcon: '🧔‍♂️',
    greedLevel: 'Avare',
    patience: 3,
    personalityLore: 'Scrute chaque pièce sous toutes les coutures avec un trébuchet et mord dedans. Déteste les compliments mielleux.',
    preferredTactic: 'expertise',
    weaknessLore: 'Ne peut résister à une démonstration technique rigoureuse sur la pureté d\'une coupe ou l\'acidité d\'un extrait.'
  },
  {
    id: 'elyndra_feuille',
    name: 'Dame Élyndra Chant-d\'Ombre',
    title: 'Négociante d\'Arômes Rares',
    race: 'Haut-Elfe',
    cityId: 'waldorg',
    avatarIcon: '🧝‍♀️',
    greedLevel: 'Modéré',
    patience: 4,
    personalityLore: 'Hautaine, méprise les aventuriers boueux mais raffole de l\'art courtois et des formules poétiques.',
    preferredTactic: 'flatterie',
    weaknessLore: 'S\'adoucit instantanément dès qu\'on loue sa connaissance infaillible des botaniques impériales.'
  },
  {
    id: 'snatch_l_ecorce',
    name: 'Snatch "Oreille-Coupée"',
    title: 'Contrebandier & Receleur du Dépôt',
    race: 'Gobelin',
    cityId: 'chaillet',
    avatarIcon: '👺',
    greedLevel: 'Voleur de grand chemin',
    patience: 2,
    personalityLore: 'Sursaute au moindre bruit de botte et garde une dague dissimulée dans sa manche. Très impressionnable si on hausse la voix.',
    preferredTactic: 'intimidation',
    weaknessLore: 'Cède immédiatement face aux menaces physiques directes ou à la promesse d\'une chope de gnôle artisanale.'
  }
];
