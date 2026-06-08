export type ToolType = 'sculpt' | 'paint' | 'stamp' | 'path' | 'text' | 'grid' | 'background' | 'shape' | 'dungeon';

export interface MapShape {
  id: string;
  type: 'rectangle' | 'circle' | 'polygon';
  points: { x: number; y: number }[]; // rect: [start, end], circle: [center, edge], poly: [p1, p2, p3...]
  fillColor: string;
  fillOpacity: number;
  fillTexture: string | null;
  fillTextureScale: number;
  strokeColor: string;
  strokeWidth: number;
  strokeDash: 'solid' | 'dashed';
}

export interface MapStamp {
  id: string;
  type: string; // 'mountain', 'tree', 'castle', 'ship'
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  // Ombres portées optionnelles
  shadowEnabled?: boolean;
  shadowBlur?: number;
  shadowColor?: string;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
}

export interface MapPath {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  dashStyle: 'solid' | 'dashed' | 'dotted';
  smooth?: boolean;
}

export interface MapText {
  id: string;
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
  font: string;
  rotation: number;
  shadowColor: string;
  shadowBlur: number;
}

// Store global utilisant la réactivité de Svelte 5 ($state)
export const mapStore = $state({
  activeTool: 'sculpt' as ToolType,

  // Style de la carte et brosses
  // mapStyle a été supprimé pour ne garder que le mode "Monde" (isometric)
  brushShape: 'circle' as 'circle' | 'square' | 'rough',
  brushSnap: false,

  // Paramètres de la grille
  showGrid: false,
  gridType: 'square' as 'square' | 'hex',
  gridSize: 50,
  gridColor: 'rgba(255, 255, 255, 0.15)',

  // Paramètres de sculpe (Sculpt)
  sculptMode: 'add' as 'add' | 'subtract', // add = terre, subtract = eau
  sculptBrushSize: 60,
  sculptRoughness: 0.15,

  // Paramètres de peinture (Paint)
  paintTexture: 'grass' as string,
  paintBrushSize: 80,
  paintBrushOpacity: 1.0,

  // Paramètres de tampons (Stamp)
  activeStamp: 'mountain' as string,
  stampScale: 1.0,
  stampRotation: 0,
  stampOpacity: 1.0,
  randomizeStampScale: false,
  randomizeStampRotation: false,
  stampShadowEnabled: false,
  stampShadowBlur: 10,
  stampShadowColor: 'rgba(0, 0, 0, 0.4)',
  stampShadowOffsetX: 5,
  stampShadowOffsetY: 5,
  stampScatterEnabled: false,
  stampScatterSpacing: 100,

  // Paramètres de tracés (Path)
  pathColor: '#66492e', // marron foncé cartographique
  pathWidth: 3,
  pathDashStyle: 'solid' as 'solid' | 'dashed' | 'dotted',
  pathSmooth: true,

  // Paramètres de texte
  textValue: 'Nouveau Lieu',
  textSize: 22,
  textColor: '#f5deb3', // Wheat color (parchemin clair)
  textFont: 'Cinzel',
  textRotation: 0,
  textShadowColor: '#000000',
  textShadowBlur: 5,

  // Paramètres d'arrière-plan (Background)
  backgroundType: 'water' as 'water' | 'texture' | 'image',
  backgroundTexture: 'water' as string,
  backgroundTextureScale: 1.0,
  backgroundImageUrl: null as string | null,
  backgroundImageScale: 1.0,
  backgroundImageX: 0,
  backgroundImageY: 0,
  backgroundImageOpacity: 1.0,
  foregroundOpacity: 1.0,

  // Filtres globaux de carte
  mapFilter: 'none' as 'none' | 'sepia' | 'cold' | 'warm',
  mapFilterIntensity: 0.5,
  vignetteEnabled: false,
  vignetteOpacity: 0.4,
  paperOverlayEnabled: false,
  paperOverlayOpacity: 0.3,

  // Paramètres de formes géométriques (Shape)
  shapeType: 'rectangle' as 'rectangle' | 'circle' | 'polygon',
  shapeFillColor: '#5a6268',
  shapeFillOpacity: 0.5,
  shapeFillTexture: null as string | null,
  shapeFillTextureScale: 1.0,
  shapeStrokeColor: '#d4a84b',
  shapeStrokeWidth: 2,
  shapeStrokeDash: 'solid' as 'solid' | 'dashed',

  // Alignement magnétique (Snap-to-grid)
  stampSnapEnabled: false,
  stampSnapMode: 'intersection' as 'intersection' | 'center',

  // Données de la carte
  stamps: [] as MapStamp[],
  paths: [] as MapPath[],
  texts: [] as MapText[],
  shapes: [] as MapShape[],
  canvasWidth: 2000,
  canvasHeight: 1500,

  // Zoom / Pan
  zoom: 0.6,
  panX: 50,
  panY: 50,
  showPanel: true,
  showCatalog: false,
  showTextureCatalog: false,
  // Sélection active
  selectedElement: null as { type: 'stamp' | 'text' | 'shape'; id: string } | null,
  // Favoris
  favoriteStamps: (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('map_editor_fav_stamps') || '[]') : []) as string[],
  favoriteTextures: (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('map_editor_fav_textures') || '[]') : []) as string[],

  // Thèmes personnalisables du générateur de donjon
  dungeonThemes: {
    classic: {
      wall: 'imported_gjojg6sr808ix89hnqknbttvi8ik',
      wall_v: 'imported_81qupz0jv6vinphr54s4ltsrlrlm',
      wall_tl: 'imported_zy8s7mir0m6lffopt9ige9tqi4ee',
      wall_tr: 'imported_pytnqfou56nay4uaiiclhngkv81y',
      wall_bl: 'imported_v2ql1mj9ds55f3ez7d1u523wvfjw',
      wall_br: 'imported_nbw4j74q8ub9zj88tg3e5gr4ig0l',
      door: 'imported_quvw6fqdrojm83pd20svtniwcbos',
      chest: 'imported_juzy62ujdon0wmo5qiv1ygwkhue2',
      pillar: 'imported_ua0xxx0yco9uhet0n34xien2nw70',
      stairs_up: 'imported_mxum8ja0e97vjiz6avc644unbnjb',
      stairs_down: 'imported_zj9ucorcmdic7wk0wwdpqiyrrrn8',
      floorTexture: 'paving'
    },
    prison: {
      wall: 'imported_drno28tawfeedwm42jep9t6w5p58',
      wall_v: 'imported_drno28tawfeedwm42jep9t6w5p58',
      wall_tl: 'imported_drno28tawfeedwm42jep9t6w5p58',
      wall_tr: 'imported_drno28tawfeedwm42jep9t6w5p58',
      wall_bl: 'imported_drno28tawfeedwm42jep9t6w5p58',
      wall_br: 'imported_drno28tawfeedwm42jep9t6w5p58',
      door: 'imported_codly79togkk62b7t2a0de7inw18',
      chest: 'imported_c7va2xt9lw2pqy6mf2lk19v8zgm9',
      pillar: 'imported_ebdhe9whsys0k38dbwxxw0qsxxxa',
      stairs_up: 'imported_sm3birrpdc71rui7yah5ychfnq5j',
      stairs_down: 'imported_33istv8ff1hvps78ut39ifhj6x9i',
      floorTexture: 'paving'
    },
    cave: {
      wall: 'imported_wv2bfinnybnnlyf1v5ebatubdrlm',
      wall_v: 'imported_wv2bfinnybnnlyf1v5ebatubdrlm',
      wall_tl: 'imported_wv2bfinnybnnlyf1v5ebatubdrlm',
      wall_tr: 'imported_wv2bfinnybnnlyf1v5ebatubdrlm',
      wall_bl: 'imported_wv2bfinnybnnlyf1v5ebatubdrlm',
      wall_br: 'imported_wv2bfinnybnnlyf1v5ebatubdrlm',
      door: 'imported_q6o3hj6afiv45th7xxqzoxp0u8gq',
      chest: 'imported_a8jdfemk3xgyg56bkiuzrdpwvm23',
      pillar: 'imported_0syvaindutyoa0rpzzi3e4gs4yiu',
      stairs_up: 'imported_n9lmribboj4o897zfsaf75lc17ok',
      stairs_down: 'imported_yoaljoray1fx6ocragjxz7ylj4cg',
      floorTexture: 'dirt'
    }
  }
});

export function toggleFavoriteStamp(stampId: string) {
  const index = mapStore.favoriteStamps.indexOf(stampId);
  if (index === -1) {
    mapStore.favoriteStamps.push(stampId);
  } else {
    mapStore.favoriteStamps.splice(index, 1);
  }
  localStorage.setItem('map_editor_fav_stamps', JSON.stringify(mapStore.favoriteStamps));
}

export function toggleFavoriteTexture(textureId: string) {
  const index = mapStore.favoriteTextures.indexOf(textureId);
  if (index === -1) {
    mapStore.favoriteTextures.push(textureId);
  } else {
    mapStore.favoriteTextures.splice(index, 1);
  }
  localStorage.setItem('map_editor_fav_textures', JSON.stringify(mapStore.favoriteTextures));
}

// Gestion de l'historique Undo / Redo
const undoStack: string[] = [];
const redoStack: string[] = [];

export function pushHistory() {
  const snapshot = JSON.stringify({
    stamps: mapStore.stamps,
    paths: mapStore.paths,
    texts: mapStore.texts,
    shapes: mapStore.shapes,
  });
  undoStack.push(snapshot);
  if (undoStack.length > 50) {
    undoStack.shift();
  }
  redoStack.length = 0; // Vider le redo lors d'une nouvelle action
}

export function undo() {
  if (undoStack.length === 0) return;
  const current = JSON.stringify({
    stamps: mapStore.stamps,
    paths: mapStore.paths,
    texts: mapStore.texts,
    shapes: mapStore.shapes,
  });
  redoStack.push(current);
  const prev = JSON.parse(undoStack.pop()!);
  mapStore.stamps = prev.stamps;
  mapStore.paths = prev.paths;
  mapStore.texts = prev.texts;
  mapStore.shapes = prev.shapes || [];
}

export function redo() {
  if (redoStack.length === 0) return;
  const current = JSON.stringify({
    stamps: mapStore.stamps,
    paths: mapStore.paths,
    texts: mapStore.texts,
    shapes: mapStore.shapes,
  });
  undoStack.push(current);
  const next = JSON.parse(redoStack.pop()!);
  mapStore.stamps = next.stamps;
  mapStore.paths = next.paths;
  mapStore.texts = next.texts;
  mapStore.shapes = next.shapes || [];
}

export function canUndo() {
  return undoStack.length > 0;
}

export function canRedo() {
  return redoStack.length > 0;
}
