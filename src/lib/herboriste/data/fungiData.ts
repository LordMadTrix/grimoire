// Types and data for Subterranean Fungarium & Mycology

export interface MysticFungus {
  id: string;
  name: string;
  scientificName: string;
  habitat: string;
  colorHex: string;
  bioluminescence: boolean;
  substratePreference: 'bois_pourri' | 'fumier_chauve_souris' | 'roche_humide' | 'ossements_osseux';
  growthDays: number;
  sporeHazardDC: number;
  toxicityLevel: 'Comestible / Nectar' | 'Hallucinogène' | 'Paralysant' | 'Létal instantané';
  description: string;
  alchemyUse: string;
  sporeSymptomLore: string;
  icon: string;
}

export const MYSTIC_FUNGI_LIST: MysticFungus[] = [
  {
    id: 'agaric_luminescent',
    name: 'Agaric des Veilleurs Bleus',
    scientificName: 'Mycena Caverna Phosphorea',
    habitat: 'Cavités gobelines et parois d\'anciennes mines',
    colorHex: '#38bdf8',
    bioluminescence: true,
    substratePreference: 'bois_pourri',
    growthDays: 3,
    sporeHazardDC: 11,
    toxicityLevel: 'Hallucinogène',
    description: 'Chapeau en cloche émettant une clarté azurée froide visible à 50 pas dans l\'obscurité complète.',
    alchemyUse: 'Permet de brasser l\'Élixir de Vision Nocturne Supérieure et l\'Encre Phophore.',
    sporeSymptomLore: 'La poussière inhalée fait entendre des chuchotements d\'ancêtres nains pendant 1d4 heures.',
    icon: '🍄'
  },
  {
    id: 'bolet_berserk',
    name: 'Bolet Enragé des Cavernes',
    scientificName: 'Boletus Sanguis Furens',
    habitat: 'Repaires d\'ours troglodytes et failles de lave froide',
    colorHex: '#dc2626',
    bioluminescence: false,
    substratePreference: 'fumier_chauve_souris',
    growthDays: 4,
    sporeHazardDC: 14,
    toxicityLevel: 'Paralysant',
    description: 'Pied massif et chapeau écarlate suintant un liquide âcre qui fait frémir les muscles au moindre contact cutané.',
    alchemyUse: 'Composant principal de la Potion de Rage Titanesque (+4 Force, désavantage aux tests mentaux).',
    sporeSymptomLore: 'Accélère les battements cardiaques au point de vouloir fracasser un mur de briques à mains nues.',
    icon: '🍄'
  },
  {
    id: 'vesse_fantome',
    name: 'Vesse-de-Loup Nécromantique',
    scientificName: 'Lycoperdon Cadaveris',
    habitat: 'Cryptes inondées, ossuaires et tombes profanées',
    colorHex: '#a855f7',
    bioluminescence: true,
    substratePreference: 'ossements_osseux',
    growthDays: 5,
    sporeHazardDC: 16,
    toxicityLevel: 'Létal instantané',
    description: 'Poche sphérique grise qui explose en un épais nuage de suie pourpre si on marche à proximité sans précaution.',
    alchemyUse: 'Utilisée pour l\'Huile d\'Asphyxie Spectrale et les poisons indétectables à l\'autopsie.',
    sporeSymptomLore: 'Les poumons se glacent instantanément ; le sujet perd 3d6 PV nécrotiques et étouffe s\'il rate sa sauvegarde.',
    icon: '☠️'
  },
  {
    id: 'morille_vorace',
    name: 'Morille Vorace des Trolls',
    scientificName: 'Morchella Carnivora',
    habitat: 'Sols organiques des décharges de châteaux abandonnés',
    colorHex: '#ca8a04',
    bioluminescence: false,
    substratePreference: 'fumier_chauve_souris',
    growthDays: 2,
    sporeHazardDC: 10,
    toxicityLevel: 'Comestible / Nectar',
    description: 'Alvéoles spongieuses capables de digérer de minuscules insectes. Rôtie au beurre, elle offre une chair savoureuse.',
    alchemyUse: 'Baume régénérateur d\'estomac après une intoxication alimentaire sévère.',
    sporeSymptomLore: 'Provoque une faim dévorante qui pousse l\'infortuné à dévorer sa propre ration de survie en 30 secondes.',
    icon: '🍄'
  },
  {
    id: 'clathre_putride',
    name: 'Clathre Étoilé de Naheulbeuk',
    scientificName: 'Clathrus Foetidus Vulgaris',
    habitat: 'Fosses d\'aisance et égouts de cités populeuses',
    colorHex: '#ea580c',
    bioluminescence: false,
    substratePreference: 'bois_pourri',
    growthDays: 1,
    sporeHazardDC: 13,
    toxicityLevel: 'Hallucinogène',
    description: 'Cage octogonale gélatineuse d\'un rouge vif empestant le cadavre pourri à une lieue à la ronde.',
    alchemyUse: 'Bombe puante alchimique forçant tous les ennemis dans un rayon de 6m à vomir leurs tripes.',
    sporeSymptomLore: 'Odorat anéanti pendant 3 jours ; le PJ voit des visages grimaçants sur toutes les portes fermées.',
    icon: '🪰'
  },
  {
    id: 'pezize_incandescente',
    name: 'Pézize de Pyromancie',
    scientificName: 'Aleuria Ignis Subterranea',
    habitat: 'Failles de soufre et proximité de coulées de magma séchées',
    colorHex: '#f97316',
    bioluminescence: true,
    substratePreference: 'roche_humide',
    growthDays: 6,
    sporeHazardDC: 15,
    toxicityLevel: 'Paralysant',
    description: 'Petites coupelles orangées qui crépitent comme de la poudre à canon quand elles sèchent au soleil.',
    alchemyUse: 'Catalyseur pour feux grégeois et bombes explosives de siège.',
    sporeSymptomLore: 'Brûlure de la gorge comme si on avait avalé une braise ardente (1d8 dégâts de feu continus).',
    icon: '🔥'
  }
];
