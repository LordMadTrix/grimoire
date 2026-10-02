// Types and data for Runic Jewelry & Gem Encrusting

export interface JewelryBase {
  id: string;
  name: string;
  category: 'anneau' | 'collier' | 'dague' | 'diademe' | 'bouclier';
  baseArmorOrDamage: string;
  socketCount: number;
  description: string;
  icon: string;
}

export interface JewelryMetal {
  id: string;
  name: string;
  colorHex: string;
  glowHex: string;
  priceMultiplier: number;
  durabilityBonus: number;
  affinityBonus: string;
  lore: string;
}

export const JEWELRY_BASES: JewelryBase[] = [
  {
    id: 'anneau_sobre',
    name: 'Anneau de Pouvoir Ciselé',
    category: 'anneau',
    baseArmorOrDamage: '+1 CA Magique',
    socketCount: 1,
    description: 'Bague ornée de runes spiralées conçue pour concentrer le flux de mana d\'une gemme taillée.',
    icon: '💍'
  },
  {
    id: 'amulette_torc',
    name: 'Torque de Bravoure Ancestrale',
    category: 'collier',
    baseArmorOrDamage: '+2 aux Sauvegardes de Volonté',
    socketCount: 1,
    description: 'Pendentif robuste reposant sur le sternum, protégeant l\'aura vitale du porteur.',
    icon: '📿'
  },
  {
    id: 'dague_parade',
    name: 'Dague de Cérémonie des Ombres',
    category: 'dague',
    baseArmorOrDamage: '1d4+2 Dégâts Tranchants / Magiques',
    socketCount: 1,
    description: 'Lame ouvragée avec pommeau alvéolé, prête à libérer des décharges élémentaires au contact.',
    icon: '🗡️'
  },
  {
    id: 'diademe_astral',
    name: 'Diadème des Érudits de Waldorg',
    category: 'diademe',
    baseArmorOrDamage: '+1 Emplacement de Sort mineur',
    socketCount: 2,
    description: 'Couronne ouverte enserrant le front pour décupler la vision astrale et la clairvoyance.',
    icon: '👑'
  },
  {
    id: 'rondache_naine',
    name: 'Rondache Runique de Garde-Gouffre',
    category: 'bouclier',
    baseArmorOrDamage: '+2 CA & Résistance Élémentaire',
    socketCount: 2,
    description: 'Bouclier de poing en métal lourd muni d\'orifices de sertissage fortifiés contre les chocs.',
    icon: '🛡️'
  }
];

export const JEWELRY_METALS: JewelryMetal[] = [
  {
    id: 'or_raffine',
    name: 'Or Solaire Raffiné',
    colorHex: '#eab308',
    glowHex: 'rgba(234, 179, 8, 0.4)',
    priceMultiplier: 2.5,
    durabilityBonus: 10,
    affinityBonus: 'Amplifie le Feu, la Lumière sacrée et le Charisme (+2)',
    lore: 'Métal noble extrait des mines de Fangh, poli à la cire d\'abeille mystique.'
  },
  {
    id: 'argent_lunaire',
    name: 'Argent Stellaire Purifié',
    colorHex: '#cbd5e1',
    glowHex: 'rgba(203, 213, 225, 0.45)',
    priceMultiplier: 1.8,
    durabilityBonus: 8,
    affinityBonus: 'Canalise le Froid, l\'Illusion et la protection contre lycanthropes & spectres',
    lore: 'Battu à froid durant la nuit pour ne pas altérer sa sensibilité aux courants éthérés.'
  },
  {
    id: 'mithril_ancestral',
    name: 'Mithril des Gouffres Nains',
    colorHex: '#67e8f9',
    glowHex: 'rgba(103, 232, 249, 0.5)',
    priceMultiplier: 4.0,
    durabilityBonus: 25,
    affinityBonus: 'Poids plume, incassable, harmonise les sorts arcaniques de foudre et d\'éther',
    lore: 'Léger comme une plume d\'aigle, dur comme le granit du Mont Cuirassé.'
  },
  {
    id: 'airain_barbare',
    name: 'Airain Brun des Steppes',
    colorHex: '#b45309',
    glowHex: 'rgba(180, 83, 9, 0.4)',
    priceMultiplier: 1.2,
    durabilityBonus: 15,
    affinityBonus: '+1 aux Dégâts Physiques et résistance aux secousses sismiques',
    lore: 'Alliage rustique et tenace, apprécié des guerriers orcs et barbares du Nord.'
  },
  {
    id: 'fer_meteorique',
    name: 'Fer Météorique d\'Étoile Noire',
    colorHex: '#475569',
    glowHex: 'rgba(168, 85, 247, 0.45)',
    priceMultiplier: 3.2,
    durabilityBonus: 20,
    affinityBonus: 'Neutralise 2 points de dégâts arcaniques et absorbe les malédictions mineures',
    lore: 'Forgé à partir des aérolithes tombés sur les collines venteuses de Fangh.'
  }
];
