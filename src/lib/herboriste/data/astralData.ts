// Types and data for Astral Calendar, Moon Phases & Leylines

export interface LunarPhase {
  id: string;
  name: string;
  icon: string;
  illumination: number; // 0 to 100%
  description: string;
  botanicalImpact: string;
  geologicalImpact: string;
  favoredBiomes: string[];
}

export interface Constellation {
  id: string;
  name: string;
  symbol: string;
  season: 'Printemps' | 'Été' | 'Automne' | 'Hiver';
  lore: string;
  passiveBonus: string;
}

export const LUNAR_PHASES: LunarPhase[] = [
  {
    id: 'nouvelle_lune',
    name: 'Nouvelle Lune (Nuit Noire)',
    icon: '🌑',
    illumination: 0,
    description: 'Les cieux sont plongés dans l\'obscurité totale. Les flux nécromantiques et telluriques affleurent à la surface.',
    botanicalImpact: 'Les racines et champignons vénéneux ont un rendement doublé (+2 réactifs récoltés).',
    geologicalImpact: 'Les gemmes d\'Obsidienne et d\'Onyx se chargent d\'un surcroît d\'énergie d\'ombre (+15% puissance de sertissage).',
    favoredBiomes: ['Marais Maudits', 'Grottes Obscures']
  },
  {
    id: 'premier_croissant',
    name: 'Premier Croissant',
    icon: '🌒',
    illumination: 25,
    description: 'Une fine lamelle d\'argent réveille les jeunes pousses et les rosées fraîches de l\'aube.',
    botanicalImpact: 'La sève des fleurs vivaces monte : temps de séchage réduit de moitié.',
    geologicalImpact: 'Les géodes de quartz blanc sont plus faciles à cliver sans éclater (+2 au jet de taille).',
    favoredBiomes: ['Plaines Fertiles', 'Jardins & Serres']
  },
  {
    id: 'premier_quartier',
    name: 'Premier Quartier (Équilibre)',
    icon: '🌓',
    illumination: 50,
    description: 'Lumière et ténèbres s\'équilibrent dans le ciel de Fangh.',
    botanicalImpact: 'Stabilité optimale : aucun échec critique de cueillette (les 1 naturels deviennent des réussites simples).',
    geologicalImpact: 'Facettage équilibré : les meules abrasives s\'usent 2 fois moins vite.',
    favoredBiomes: ['Forêts Tempérées', 'Bordures de Fleuve']
  },
  {
    id: 'lune_gibbeuse',
    name: 'Lune Gibbeuse Croissante',
    icon: '🌔',
    illumination: 75,
    description: 'La lueur nocturne fait scintiller le pollen des plantes médicinales.',
    botanicalImpact: 'Les baies toniques et pétales énergisants gagnent +1 au dé de soin produit en alchimie.',
    geologicalImpact: 'Résonance accrue des gemmes d\'Aigue-Marine et de Saphir d\'eau.',
    favoredBiomes: ['Montagnes Enneigées', 'Sources Chaudes']
  },
  {
    id: 'pleine_lune',
    name: 'Pleine Lune d\'Argent',
    icon: '🌕',
    illumination: 100,
    description: 'Le disque céleste brille d\'une clarté opaline. Les loups hurlent et la magie brute imprègne chaque feuille.',
    botanicalImpact: 'Floraison de minuit : la Fleur de Lune et l\'Étoile du Berger brillent et doublent leurs vertus.',
    geologicalImpact: 'Le diamant et les gemmes de clarté gagnent l\'enchantement "Aura de Révélation Spectrale".',
    favoredBiomes: ['Clairières Druidiques', 'Sommets Venteux']
  },
  {
    id: 'lune_sanglante',
    name: 'Lune Rouge / Sanglante de Naheulbeuk',
    icon: '🩸',
    illumination: 100,
    description: 'Teinte rougeoyante due aux vapeurs chaotiques des donjons souterrains.',
    botanicalImpact: 'Toxines déchaînées : les poisons distillés cette nuit voient leur DD augmenter de +3 !',
    geologicalImpact: 'Les rubis et grenats pulsent de chaleur ; risque de surchauffe lors du facettage (+10% risque de fêlure).',
    favoredBiomes: ['Volcans & Failles de Soufre', 'Donjons Abandonnés']
  },
  {
    id: 'dernier_quartier',
    name: 'Dernier Quartier',
    icon: '🌗',
    illumination: 50,
    description: 'Le déclin céleste favorise l\'introspection, l\'affinage des macérations et le repos de la terre.',
    botanicalImpact: 'Idéal pour le compostage et l\'enrichissement des sols de la serre en terreau d\'humus.',
    geologicalImpact: 'La dureté apparente des minerais s\'adoucit de 1 point Mohs pour le concassage.',
    favoredBiomes: ['Tourbières', 'Grottes Souterraines']
  },
  {
    id: 'eclipse_ombre',
    name: 'Éclipse Obscure Totale',
    icon: '🔮',
    illumination: 0,
    description: 'Le soleil ou la lune est dévoré par l\'Ombre Ancestrale pendant quelques heures suspendues hors du temps.',
    botanicalImpact: 'Apparition spontanée des Larmes Éthérées et métamorphose des fleurs ordinaires en hybrides sauvages.',
    geologicalImpact: 'L\'Atelier de taille peut réaliser des Chefs-d\'Œuvre impossibles en temps normal (+500% valeur marchande).',
    favoredBiomes: ['Cercles de Mégalithes', 'Abîmes Telluriques']
  }
];

export const CONSTELLATIONS: Constellation[] = [
  {
    id: 'batte_dor',
    name: 'La Bâtée Céleste',
    symbol: '✨',
    season: 'Printemps',
    lore: 'Représente le tamis cosmique dans lequel les dieux nains auraient séparé les étoiles des décombres du monde.',
    passiveBonus: '+2 aux tests de Prospection alluviale et fouille de géodes'
  },
  {
    id: 'chene_millenaire',
    name: 'Le Grand Chêne Éternel',
    symbol: '🌳',
    season: 'Été',
    lore: 'Constellation tutélaire des druides et herboristes de l\'orée de Fangh.',
    passiveBonus: '+2 au DD de conservation des décoctions et temps de pourrissement x2'
  },
  {
    id: 'serpent_alchimique',
    name: 'L\'Ouroboros d\'Argent',
    symbol: '🐍',
    season: 'Automne',
    lore: 'La queue du serpent céleste mord sa tête, rappelant les cycles de transmutation.',
    passiveBonus: 'Économise 1 ingrédient lors du brassage de contre-poisons et sérums'
  },
  {
    id: 'dragon_cristallin',
    name: 'Le Dragon des Frimas',
    symbol: '🐉',
    season: 'Hiver',
    lore: 'Ses griffes d\'azur traversent les cieux polaires au-dessus des Montagnes du Destin.',
    passiveBonus: 'Protection contre la casse des gemmes fragiles (Mohs < 6)'
  }
];
