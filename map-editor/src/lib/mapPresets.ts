import { mapStore, pushHistory, type MapStamp, type MapPath, type MapText, type MapShape } from './stores/mapStore.svelte';

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export interface MapPreset {
  id: string;
  name: string;
  category: 'battlemap' | 'world';
  icon: string;
  description: string;
  apply: () => void;
}

/**
 * Génère une Auberge Médiévale complète
 */
export function generateTavernPreset() {
  pushHistory(true);
  mapStore.mapTitle = "L'Auberge de la Chope Sanglante";
  mapStore.canvasWidth = 2000;
  mapStore.canvasHeight = 1500;
  mapStore.showGrid = true;
  mapStore.gridType = 'square';
  mapStore.gridSize = 70;
  mapStore.gridColor = 'rgba(212, 168, 75, 0.2)';
  mapStore.backgroundType = 'texture';
  mapStore.backgroundTexture = 'parchment';
  mapStore.atmospherePreset = 'dungeon';
  mapStore.vignetteEnabled = true;
  mapStore.vignetteOpacity = 0.45;
  mapStore.paperOverlayEnabled = true;

  // Réinitialiser les éléments existants
  mapStore.stamps = [];
  mapStore.paths = [];
  mapStore.texts = [];
  mapStore.shapes = [];

  const centerX = 1000;
  const centerY = 750;

  // 1. Sol principal en parquet / dalles (Forme rectangulaire)
  const tavernFloor: MapShape = {
    id: uid('shape_floor'),
    type: 'rectangle',
    points: [
      { x: centerX - 600, y: centerY - 450 },
      { x: centerX + 600, y: centerY + 450 }
    ],
    fillColor: '#8a623a',
    fillOpacity: 0.85,
    fillTexture: 'paving',
    fillTextureScale: 0.8,
    strokeColor: '#3a2514',
    strokeWidth: 8,
    strokeDash: 'solid'
  };

  // 2. Cloison cuisine / cellier
  const kitchenFloor: MapShape = {
    id: uid('shape_kitchen'),
    type: 'rectangle',
    points: [
      { x: centerX + 200, y: centerY - 450 },
      { x: centerX + 600, y: centerY - 100 }
    ],
    fillColor: '#6e4c29',
    fillOpacity: 0.9,
    fillTexture: 'rock',
    fillTextureScale: 0.7,
    strokeColor: '#3a2514',
    strokeWidth: 6,
    strokeDash: 'solid'
  };

  mapStore.shapes = [tavernFloor, kitchenFloor];

  // 3. Meubles & Tampons
  const newStamps: MapStamp[] = [];

  // Comptoir de bar (long rectangle ou forme boisée)
  const barCounter: MapShape = {
    id: uid('shape_bar'),
    type: 'rectangle',
    points: [
      { x: centerX + 180, y: centerY - 120 },
      { x: centerX + 560, y: centerY - 60 }
    ],
    fillColor: '#4a2c11',
    fillOpacity: 1,
    fillTexture: null,
    fillTextureScale: 1,
    strokeColor: '#d4a84b',
    strokeWidth: 3,
    strokeDash: 'solid'
  };
  mapStore.shapes.push(barCounter);

  // Cheminée chaleureuse au nord
  newStamps.push({
    id: uid('stamp_fire'),
    type: 'volcano', // ou stamp chaleureux
    x: centerX - 200,
    y: centerY - 430,
    scale: 0.5,
    rotation: 0,
    opacity: 1,
    zIndex: 10,
    shadowEnabled: true,
    shadowColor: 'rgba(255, 140, 0, 0.6)',
    shadowBlur: 25
  });

  // Piliers de soutien
  const pillarOffsets = [
    { x: -350, y: -200 },
    { x: 0, y: -200 },
    { x: -350, y: 200 },
    { x: 0, y: 200 },
  ];
  for (const pos of pillarOffsets) {
    newStamps.push({
      id: uid('stamp_pillar'),
      type: 'tower',
      x: centerX + pos.x,
      y: centerY + pos.y,
      scale: 0.35,
      rotation: 0,
      opacity: 1,
      zIndex: 15,
      shadowEnabled: true,
      shadowBlur: 10
    });
  }

  // Tables dans la salle commune
  const tableOffsets = [
    { x: -450, y: -300 },
    { x: -200, y: -200 },
    { x: -450, y: 0 },
    { x: -200, y: 50 },
    { x: -450, y: 300 },
    { x: -200, y: 300 },
    { x: 100, y: 200 },
    { x: 350, y: 200 },
  ];

  for (const t of tableOffsets) {
    newStamps.push({
      id: uid('stamp_table'),
      type: 'village',
      x: centerX + t.x,
      y: centerY + t.y,
      scale: 0.45,
      rotation: (Math.random() * 20) - 10,
      opacity: 0.95,
      zIndex: 12,
      shadowEnabled: true,
      shadowBlur: 8
    });
  }

  // Tonneaux & Caisses dans la cuisine/cellier
  for (let i = 0; i < 5; i++) {
    newStamps.push({
      id: uid('stamp_barrel'),
      type: 'tree',
      x: centerX + 260 + (i % 3) * 80,
      y: centerY - 380 + Math.floor(i / 3) * 90,
      scale: 0.25,
      rotation: 0,
      opacity: 1,
      zIndex: 12
    });
  }

  mapStore.stamps = newStamps;

  // 4. Textes descriptifs
  mapStore.texts = [
    {
      id: uid('text_room'),
      text: 'SALLE COMMUNE',
      x: centerX - 250,
      y: centerY - 50,
      size: 28,
      color: '#e5c383',
      font: 'Cinzel',
      rotation: 0,
      shadowColor: '#000000',
      shadowBlur: 8,
      opacity: 0.9
    },
    {
      id: uid('text_bar'),
      text: 'LE COMPTOIR',
      x: centerX + 360,
      y: centerY - 90,
      size: 20,
      color: '#d4a84b',
      font: 'Cinzel',
      rotation: 0,
      shadowColor: '#000000',
      shadowBlur: 6,
      opacity: 0.95
    },
    {
      id: uid('text_cellar'),
      text: 'CELLIER & CUISINE',
      x: centerX + 400,
      y: centerY - 300,
      size: 18,
      color: '#c2a679',
      font: 'Cinzel',
      rotation: 0,
      shadowColor: '#000000',
      shadowBlur: 6,
      opacity: 0.85
    }
  ];

  // Centrer la vue
  mapStore.zoom = 0.75;
  mapStore.panX = 100;
  mapStore.panY = 60;
}

/**
 * Génère un Donjon de Catacombes Souterraines
 */
export function generateDungeonPreset() {
  pushHistory(true);
  mapStore.mapTitle = 'Les Catacombes Oubliées';
  mapStore.canvasWidth = 2200;
  mapStore.canvasHeight = 1600;
  mapStore.showGrid = true;
  mapStore.gridType = 'square';
  mapStore.gridSize = 70;
  mapStore.gridColor = 'rgba(255, 255, 255, 0.15)';
  mapStore.backgroundType = 'texture';
  mapStore.backgroundTexture = 'rock';
  mapStore.atmospherePreset = 'dungeon';
  mapStore.vignetteEnabled = true;
  mapStore.vignetteOpacity = 0.6;
  mapStore.paperOverlayEnabled = true;

  mapStore.stamps = [];
  mapStore.paths = [];
  mapStore.texts = [];
  mapStore.shapes = [];

  const cx = 1100;
  const cy = 800;

  // Salles taillées dans la roche
  const rooms: MapShape[] = [
    // Crypte principale au centre
    {
      id: uid('room_main'),
      type: 'rectangle',
      points: [{ x: cx - 350, y: cy - 250 }, { x: cx + 350, y: cy + 250 }],
      fillColor: '#2b2e36',
      fillOpacity: 0.95,
      fillTexture: 'paving',
      fillTextureScale: 0.8,
      strokeColor: '#15171c',
      strokeWidth: 10,
      strokeDash: 'solid'
    },
    // Salle au Nord (Autel)
    {
      id: uid('room_altar'),
      type: 'rectangle',
      points: [{ x: cx - 200, y: cy - 650 }, { x: cx + 200, y: cy - 350 }],
      fillColor: '#323640',
      fillOpacity: 0.95,
      fillTexture: 'paving',
      fillTextureScale: 0.8,
      strokeColor: '#15171c',
      strokeWidth: 10,
      strokeDash: 'solid'
    },
    // Salle au Sud (Trésor)
    {
      id: uid('room_vault'),
      type: 'rectangle',
      points: [{ x: cx - 250, y: cy + 350 }, { x: cx + 250, y: cy + 650 }],
      fillColor: '#282b33',
      fillOpacity: 0.95,
      fillTexture: 'paving',
      fillTextureScale: 0.8,
      strokeColor: '#15171c',
      strokeWidth: 10,
      strokeDash: 'solid'
    },
    // Salle Ouest (Sépultures)
    {
      id: uid('room_tombs'),
      type: 'rectangle',
      points: [{ x: cx - 750, y: cy - 180 }, { x: cx - 450, y: cy + 180 }],
      fillColor: '#22252c',
      fillOpacity: 0.95,
      fillTexture: 'paving',
      fillTextureScale: 0.8,
      strokeColor: '#15171c',
      strokeWidth: 10,
      strokeDash: 'solid'
    },
  ];

  // Couloirs
  const corridors: MapShape[] = [
    // Couloir Nord
    {
      id: uid('corr_n'),
      type: 'rectangle',
      points: [{ x: cx - 60, y: cy - 360 }, { x: cx + 60, y: cy - 240 }],
      fillColor: '#2b2e36',
      fillOpacity: 1,
      fillTexture: 'paving',
      fillTextureScale: 0.8,
      strokeColor: '#15171c',
      strokeWidth: 8,
      strokeDash: 'solid'
    },
    // Couloir Sud
    {
      id: uid('corr_s'),
      type: 'rectangle',
      points: [{ x: cx - 60, y: cy + 240 }, { x: cx + 60, y: cy + 360 }],
      fillColor: '#2b2e36',
      fillOpacity: 1,
      fillTexture: 'paving',
      fillTextureScale: 0.8,
      strokeColor: '#15171c',
      strokeWidth: 8,
      strokeDash: 'solid'
    },
    // Couloir Ouest
    {
      id: uid('corr_w'),
      type: 'rectangle',
      points: [{ x: cx - 460, y: cy - 60 }, { x: cx - 340, y: cy + 60 }],
      fillColor: '#2b2e36',
      fillOpacity: 1,
      fillTexture: 'paving',
      fillTextureScale: 0.8,
      strokeColor: '#15171c',
      strokeWidth: 8,
      strokeDash: 'solid'
    },
  ];

  mapStore.shapes = [...rooms, ...corridors];

  // Piliers de la grande crypte
  const pillars: MapStamp[] = [];
  const pCoords = [
    { x: -200, y: -120 }, { x: 200, y: -120 },
    { x: -200, y: 120 }, { x: 200, y: 120 },
    { x: 0, y: -120 }, { x: 0, y: 120 }
  ];
  for (const p of pCoords) {
    pillars.push({
      id: uid('pillar'),
      type: 'tower',
      x: cx + p.x,
      y: cy + p.y,
      scale: 0.45,
      rotation: 0,
      opacity: 1,
      zIndex: 10,
      shadowEnabled: true,
      shadowColor: 'rgba(0, 0, 0, 0.7)',
      shadowBlur: 14
    });
  }

  // Coffres dans la salle du trésor
  pillars.push({
    id: uid('chest_1'),
    type: 'castle',
    x: cx - 80,
    y: cy + 500,
    scale: 0.35,
    rotation: -10,
    opacity: 1,
    zIndex: 12,
    shadowEnabled: true,
    shadowBlur: 8
  });
  pillars.push({
    id: uid('chest_2'),
    type: 'castle',
    x: cx + 80,
    y: cy + 500,
    scale: 0.35,
    rotation: 15,
    opacity: 1,
    zIndex: 12,
    shadowEnabled: true,
    shadowBlur: 8
  });

  // Autel dans la salle Nord
  pillars.push({
    id: uid('altar'),
    type: 'banner',
    x: cx,
    y: cy - 500,
    scale: 0.5,
    rotation: 0,
    opacity: 1,
    zIndex: 12,
    shadowEnabled: true,
    shadowColor: 'rgba(180, 50, 255, 0.5)',
    shadowBlur: 20
  });

  mapStore.stamps = pillars;

  mapStore.texts = [
    {
      id: uid('text_crypte'),
      text: 'GRANDE CRYPTE',
      x: cx,
      y: cy,
      size: 26,
      color: '#e5c383',
      font: 'MedievalSharp',
      rotation: 0,
      shadowColor: '#000000',
      shadowBlur: 8,
      opacity: 0.9
    },
    {
      id: uid('text_altar'),
      text: 'AUTEL SACRIFICIEL',
      x: cx,
      y: cy - 400,
      size: 20,
      color: '#c084fc',
      font: 'MedievalSharp',
      rotation: 0,
      shadowColor: '#000000',
      shadowBlur: 6,
      opacity: 0.95
    },
    {
      id: uid('text_vault'),
      text: 'CHAMBRE FORTE',
      x: cx,
      y: cy + 420,
      size: 20,
      color: '#facc15',
      font: 'MedievalSharp',
      rotation: 0,
      shadowColor: '#000000',
      shadowBlur: 6,
      opacity: 0.95
    }
  ];

  mapStore.zoom = 0.65;
  mapStore.panX = 80;
  mapStore.panY = 50;
}

/**
 * Génère une Forêt Sauvage & Clairière Envoûtée
 */
export function generateForestPreset() {
  pushHistory(true);
  mapStore.mapTitle = 'La Clairière des Druides';
  mapStore.canvasWidth = 2400;
  mapStore.canvasHeight = 1600;
  mapStore.showGrid = true;
  mapStore.gridType = 'hex';
  mapStore.gridSize = 65;
  mapStore.gridColor = 'rgba(255, 255, 255, 0.12)';
  mapStore.backgroundType = 'texture';
  mapStore.backgroundTexture = 'grass';
  mapStore.atmospherePreset = 'fog';
  mapStore.vignetteEnabled = true;
  mapStore.vignetteOpacity = 0.35;
  mapStore.paperOverlayEnabled = true;

  mapStore.stamps = [];
  mapStore.paths = [];
  mapStore.texts = [];
  mapStore.shapes = [];

  const cx = 1200;
  const cy = 800;

  // Cercle de terre / clairière magique au centre
  const clearing: MapShape = {
    id: uid('shape_clearing'),
    type: 'circle',
    points: [{ x: cx, y: cy }, { x: cx + 320, y: cy }],
    fillColor: '#7a6a48',
    fillOpacity: 0.7,
    fillTexture: 'sand',
    fillTextureScale: 1.0,
    strokeColor: '#4d6935',
    strokeWidth: 6,
    strokeDash: 'dashed'
  };
  mapStore.shapes = [clearing];

  // Rivière sinueuse au sud
  const river: MapPath = {
    id: uid('river'),
    points: [
      { x: 0, y: cy + 450 },
      { x: cx - 400, y: cy + 400 },
      { x: cx, y: cy + 500 },
      { x: cx + 500, y: cy + 420 },
      { x: 2400, y: cy + 550 }
    ],
    color: '#3b82f6',
    width: 28,
    dashStyle: 'solid',
    smooth: true
  };

  // Sentier de terre
  const path: MapPath = {
    id: uid('trail'),
    points: [
      { x: cx - 1000, y: cy - 200 },
      { x: cx - 450, y: cy - 50 },
      { x: cx - 150, y: cy },
      { x: cx + 250, y: cy + 50 },
      { x: cx + 900, y: cy - 100 }
    ],
    color: '#854d0e',
    width: 6,
    dashStyle: 'dashed',
    smooth: true
  };

  mapStore.paths = [river, path];

  // Arbres denses encerclant la clairière
  const trees: MapStamp[] = [];
  const count = 45;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const dist = 450 + Math.random() * 400;
    const tx = cx + Math.cos(angle) * dist + (Math.random() * 80 - 40);
    const ty = cy + Math.sin(angle) * dist + (Math.random() * 80 - 40);

    trees.push({
      id: uid('tree'),
      type: 'tree',
      x: tx,
      y: ty,
      scale: 0.65 + Math.random() * 0.4,
      rotation: (Math.random() * 30) - 15,
      opacity: 0.95,
      zIndex: Math.round(ty),
      shadowEnabled: true,
      shadowBlur: 12
    });
  }

  // Menhirs / Monolithes magiques autour du cercle
  const menhirCount = 6;
  for (let i = 0; i < menhirCount; i++) {
    const angle = (i / menhirCount) * Math.PI * 2;
    const mx = cx + Math.cos(angle) * 260;
    const my = cy + Math.sin(angle) * 260;
    trees.push({
      id: uid('menhir'),
      type: 'mountain',
      x: mx,
      y: my,
      scale: 0.35,
      rotation: 0,
      opacity: 1,
      zIndex: Math.round(my),
      shadowEnabled: true,
      shadowColor: 'rgba(56, 189, 248, 0.4)',
      shadowBlur: 16
    });
  }

  // Foyer mystique au centre
  trees.push({
    id: uid('central_shrine'),
    type: 'volcano',
    x: cx,
    y: cy,
    scale: 0.4,
    rotation: 0,
    opacity: 1,
    zIndex: Math.round(cy) + 1,
    shadowEnabled: true,
    shadowColor: 'rgba(74, 222, 128, 0.6)',
    shadowBlur: 25
  });

  mapStore.stamps = trees;

  mapStore.texts = [
    {
      id: uid('text_circle'),
      text: 'CERCLE DES SEPT ANCIENS',
      x: cx,
      y: cy - 70,
      size: 24,
      color: '#86efac',
      font: 'MedievalSharp',
      rotation: 0,
      shadowColor: '#052e16',
      shadowBlur: 8,
      opacity: 0.95
    },
    {
      id: uid('text_river'),
      text: 'Rivière du Murmure',
      x: cx,
      y: cy + 470,
      size: 18,
      color: '#93c5fd',
      font: 'Cinzel',
      rotation: 4,
      shadowColor: '#1e3a8a',
      shadowBlur: 6,
      opacity: 0.9
    }
  ];

  mapStore.zoom = 0.6;
  mapStore.panX = 60;
  mapStore.panY = 40;
}

/**
 * Génère un Archipel Tropical & Îles Maritimes
 */
export function generateArchipelagoPreset() {
  pushHistory(true);
  mapStore.mapTitle = 'Archipel des Vents Célestes';
  mapStore.canvasWidth = 2400;
  mapStore.canvasHeight = 1600;
  mapStore.showGrid = false;
  mapStore.backgroundType = 'water';
  mapStore.backgroundTexture = 'water';
  mapStore.atmospherePreset = 'sunset';
  mapStore.vignetteEnabled = true;
  mapStore.vignetteOpacity = 0.3;
  mapStore.paperOverlayEnabled = true;

  mapStore.stamps = [];
  mapStore.paths = [];
  mapStore.texts = [];
  mapStore.shapes = [];

  const cx = 1200;
  const cy = 800;

  // Îles sablonneuses (cercles & polygones)
  const islands: MapShape[] = [
    // Grande île centrale
    {
      id: uid('isle_main'),
      type: 'circle',
      points: [{ x: cx - 100, y: cy }, { x: cx + 350, y: cy }],
      fillColor: '#22c55e',
      fillOpacity: 0.9,
      fillTexture: 'grass',
      fillTextureScale: 1.0,
      strokeColor: '#eab308',
      strokeWidth: 16,
      strokeDash: 'solid'
    },
    // Île pirate au Nord-Est
    {
      id: uid('isle_ne'),
      type: 'circle',
      points: [{ x: cx + 600, y: cy - 350 }, { x: cx + 850, y: cy - 350 }],
      fillColor: '#eab308',
      fillOpacity: 0.95,
      fillTexture: 'sand',
      fillTextureScale: 0.9,
      strokeColor: '#ca8a04',
      strokeWidth: 12,
      strokeDash: 'solid'
    },
    // Île volcanique au Sud-Ouest
    {
      id: uid('isle_sw'),
      type: 'circle',
      points: [{ x: cx - 650, y: cy + 300 }, { x: cx - 400, y: cy + 300 }],
      fillColor: '#475569',
      fillOpacity: 0.95,
      fillTexture: 'rock',
      fillTextureScale: 0.8,
      strokeColor: '#334155',
      strokeWidth: 14,
      strokeDash: 'solid'
    }
  ];
  mapStore.shapes = islands;

  // Tampons maritimes
  const maritimeStamps: MapStamp[] = [
    // Galion au large
    {
      id: uid('ship'),
      type: 'ship',
      x: cx + 300,
      y: cy + 450,
      scale: 0.8,
      rotation: -15,
      opacity: 1,
      zIndex: 10,
      shadowEnabled: true,
      shadowBlur: 10
    },
    // Kraken / Monstre marin
    {
      id: uid('kraken'),
      type: 'sea_monster',
      x: cx - 700,
      y: cy - 350,
      scale: 0.85,
      rotation: 10,
      opacity: 0.9,
      zIndex: 10,
      shadowEnabled: true,
      shadowBlur: 15
    },
    // Château / Bastion sur l'île principale
    {
      id: uid('fort'),
      type: 'castle',
      x: cx - 100,
      y: cy - 60,
      scale: 0.9,
      rotation: 0,
      opacity: 1,
      zIndex: 20,
      shadowEnabled: true,
      shadowBlur: 15
    },
    // Volcan fumant sur l'île rocheuse
    {
      id: uid('volcano'),
      type: 'volcano',
      x: cx - 650,
      y: cy + 280,
      scale: 0.9,
      rotation: 0,
      opacity: 1,
      zIndex: 20,
      shadowEnabled: true,
      shadowColor: 'rgba(239, 68, 68, 0.5)',
      shadowBlur: 20
    },
    // Boussole cartographique dans le coin
    {
      id: uid('compass'),
      type: 'compass',
      x: 250,
      y: 250,
      scale: 0.85,
      rotation: 0,
      opacity: 0.85,
      zIndex: 50
    },
    // Bannière de carte
    {
      id: uid('banner'),
      type: 'banner',
      x: cx,
      y: 160,
      scale: 1.1,
      rotation: 0,
      opacity: 0.95,
      zIndex: 50
    }
  ];

  mapStore.stamps = maritimeStamps;

  mapStore.texts = [
    {
      id: uid('text_title'),
      text: 'ARCHIPEL DES VENTS CÉLESTES',
      x: cx,
      y: 155,
      size: 32,
      color: '#3b200b',
      font: 'Cinzel',
      rotation: 0,
      shadowColor: '#fef08a',
      shadowBlur: 2,
      opacity: 1
    },
    {
      id: uid('text_isle1'),
      text: 'ÎLE DU BASTION ROYAL',
      x: cx - 100,
      y: cy + 120,
      size: 20,
      color: '#fef08a',
      font: 'Cinzel',
      rotation: 0,
      shadowColor: '#000000',
      shadowBlur: 6,
      opacity: 0.95
    },
    {
      id: uid('text_isle2'),
      text: "L'Île aux Écumeurs",
      x: cx + 600,
      y: cy - 250,
      size: 18,
      color: '#fde047',
      font: 'Cinzel',
      rotation: 0,
      shadowColor: '#000000',
      shadowBlur: 6,
      opacity: 0.9
    },
    {
      id: uid('text_kraken'),
      text: 'Fosse des Abysses — Danger',
      x: cx - 700,
      y: cy - 220,
      size: 16,
      color: '#f87171',
      font: 'Cinzel',
      rotation: -8,
      shadowColor: '#000000',
      shadowBlur: 6,
      opacity: 0.9
    }
  ];

  mapStore.zoom = 0.6;
  mapStore.panX = 60;
  mapStore.panY = 40;
}

/**
 * Liste de tous les presets prêts à l'emploi
 */
export const ALL_MAP_PRESETS: MapPreset[] = [
  {
    id: 'tavern',
    name: 'Auberge Médiévale',
    category: 'battlemap',
    icon: '🍺',
    description: 'Salle commune avec cheminée, comptoir de bar, tables, cellier et parquet bois.',
    apply: generateTavernPreset
  },
  {
    id: 'dungeon',
    name: 'Donjon & Catacombes',
    category: 'battlemap',
    icon: '🏰',
    description: 'Salles en pierre taillée reliées par des couloirs, colonnes, autel et coffres.',
    apply: generateDungeonPreset
  },
  {
    id: 'forest',
    name: 'Clairière des Druides',
    category: 'battlemap',
    icon: '🌲',
    description: 'Forêt dense avec clairière circulaire, menhirs de pierre, ruisseau et feu sacré.',
    apply: generateForestPreset
  },
  {
    id: 'archipelago',
    name: 'Archipel Tropical',
    category: 'world',
    icon: '🏝️',
    description: 'Îles en pleine mer avec galion, volcan, boussole d’exploration et créature abyssale.',
    apply: generateArchipelagoPreset
  }
];
