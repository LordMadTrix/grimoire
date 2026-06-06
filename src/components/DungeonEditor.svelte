<script lang="ts">
  import { vttStore, clearDungeonTiles, setDungeonTile, undoMapAction, canUndo, addGmToken, pushDungeonUndo } from '$lib/stores/vtt.svelte';
  import type { TileType, DungeonTile } from '$lib/stores/vtt.svelte';
  import { open } from '@tauri-apps/plugin-dialog';
  import { readFileBase64 } from '$lib/api';

  const TILE_DEFS: { type: TileType; label: string; cat: string }[] = [
    { type: 'floor_stone', label: 'Sol Pierre',    cat: 'sol' },
    { type: 'floor_wood',  label: 'Sol Bois',      cat: 'sol' },
    { type: 'floor_dirt',  label: 'Sol Terre',     cat: 'sol' },
    { type: 'wall_stone',  label: 'Mur Pierre',    cat: 'mur' },
    { type: 'wall_wood',   label: 'Mur Bois',      cat: 'mur' },
    { type: 'wall_horizontal',  label: 'Mur ═',    cat: 'mur' },
    { type: 'wall_vertical',    label: 'Mur ║',    cat: 'mur' },
    { type: 'wall_corner_tl',   label: 'Coin ╔',   cat: 'mur' },
    { type: 'wall_corner_tr',   label: 'Coin ╗',   cat: 'mur' },
    { type: 'wall_corner_bl',   label: 'Coin ╚',   cat: 'mur' },
    { type: 'wall_corner_br',   label: 'Coin ╝',   cat: 'mur' },
    { type: 'wall_horizontal_torch', label: 'Mur ═ + Torche', cat: 'mur' },
    { type: 'wall_vertical_torch',   label: 'Mur ║ + Torche', cat: 'mur' },
    { type: 'door_closed', label: 'Porte Fermée',  cat: 'objet' },
    { type: 'door_open',   label: 'Porte Ouverte', cat: 'objet' },
    { type: 'door_horizontal',  label: 'Porte ═',  cat: 'objet' },
    { type: 'door_vertical',    label: 'Porte ║',  cat: 'objet' },
    { type: 'stairs_down', label: 'Escaliers ↓',   cat: 'objet' },
    { type: 'stairs_up',   label: 'Escaliers ↑',   cat: 'objet' },
    { type: 'pillar',      label: 'Pilier',         cat: 'objet' },
    { type: 'chest',       label: 'Coffre',         cat: 'objet' },
    { type: 'trap',        label: 'Piège',          cat: 'objet' },
    { type: 'water',       label: 'Eau',            cat: 'env' },
    { type: 'lava',        label: 'Lave',           cat: 'env' },
    { type: 'void',        label: 'Effacer',        cat: 'util' },
  ];

  // ── Modes ─────────────────────────────────────────────────────────
  let activeCategory = $state<'all' | 'sol' | 'mur' | 'objet' | 'env'>('all');

  const SOLID_COLORS: Record<string, string> = {
    floor_stone: '#6b7280', floor_wood: '#78350f', floor_dirt: '#451a03',
    wall_stone: '#374151', wall_wood: '#451a03', door_closed: '#8b5a2b',
    door_open: '#cda47b', stairs_down: '#1f2937', stairs_up: '#9ca3af',
    pillar: '#4b5563', chest: '#f59e0b', trap: '#ef4444',
    water: '#3b82f6', lava: '#ea580c', void: '#000000',
    wall_horizontal: '#374151', wall_vertical: '#374151',
    wall_corner_tl: '#374151', wall_corner_tr: '#374151',
    wall_corner_bl: '#374151', wall_corner_br: '#374151',
    wall_horizontal_torch: '#374151', wall_vertical_torch: '#374151',
    door_horizontal: '#8b5a2b', door_vertical: '#8b5a2b'
  };

  async function importCustomProp() {
    const file = await open({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    });
    if (file && typeof file === 'string') {
      const b64 = await readFileBase64(file);
      const mime = file.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      addGmToken({
        id: Math.random().toString(36).slice(2),
        name: 'Prop personnalisé',
        x: 0, y: 0, size: 50,
        imageUrl: `data:${mime};base64,${b64}`,
        isEnemy: false
      });
      vttStore.showDungeonEditor = false;
    }
  }

  // ── Présets ───────────────────────────────────────────────────────
  const PRESETS = [
    { label: '3×3',       fn: () => stamp(3, 3, false) },
    { label: '5×5',       fn: () => stamp(5, 5, true) },
    { label: '8×8',       fn: () => stamp(8, 8, true) },
    { label: '10×6',      fn: () => stampRect(10, 6, true) },
    { label: 'Couloir H', fn: () => corridor(8, 1) },
    { label: 'Couloir V', fn: () => corridor(1, 8) },
    { label: 'Taverne',   fn: () => stampTaverne() },
    { label: 'Temple',    fn: () => stampTemple() },
    { label: 'Prison',    fn: () => stampPrison() },
    { label: 'Tour',      fn: () => stampTour() },
    { label: 'Crypte',    fn: () => stampCrypte() },
  ];

  function getFloor(): TileType {
    const b = vttStore.dungeonBrush;
    if (b === 'void' || b.startsWith('wall') || b.startsWith('door') || b === 'pillar' || b === 'chest' || b === 'trap') {
      return 'floor_stone';
    }
    return b;
  }

  function stamp(w: number, h: number, walls: boolean) {
    const floor = getFloor();
    for (let c = 0; c < w; c++) for (let r = 0; r < h; r++) {
      const isWall = walls && (c === 0 || c === w-1 || r === 0 || r === h-1);
      setDungeonTile(c, r, isWall ? 'wall_stone' : floor);
    }
  }

  function stampRect(w: number, h: number, walls: boolean) { stamp(w, h, walls); }

  function corridor(w: number, h: number) {
    const floor = getFloor();
    for (let c = 0; c < w; c++) for (let r = 0; r < h; r++) setDungeonTile(c, r, floor);
  }

  function stampTaverne() {
    const floor: TileType = 'floor_wood';
    // Grande salle
    for (let c = 0; c < 12; c++) for (let r = 0; r < 8; r++) {
      const isWall = c === 0 || c === 11 || r === 0 || r === 7;
      setDungeonTile(c, r, isWall ? 'wall_wood' : floor);
    }
    // Cuisine
    for (let c = 8; c < 12; c++) for (let r = -5; r < 0; r++) {
      const isWall = c === 8 || c === 11 || r === -5 || r === -1;
      setDungeonTile(c, r + 8, isWall ? 'wall_wood' : floor);
    }
    // Entrée
    setDungeonTile(5, 7, 'door_open');
    // Mobilier
    setDungeonTile(2, 3, 'chest');
    setDungeonTile(9, 3, 'chest');
  }

  function stampTemple() {
    const floor: TileType = 'floor_stone';
    // Nef principale
    for (let c = 0; c < 7; c++) for (let r = 0; r < 14; r++) {
      const isWall = c === 0 || c === 6 || r === 0 || r === 13;
      setDungeonTile(c, r, isWall ? 'wall_stone' : floor);
    }
    // Abside
    for (let c = 1; c < 6; c++) for (let r = 14; r < 18; r++) {
      const isWall = c === 1 || c === 5 || r === 17;
      setDungeonTile(c, r, isWall ? 'wall_stone' : floor);
    }
    // Colonnes
    setDungeonTile(1, 3, 'pillar'); setDungeonTile(5, 3, 'pillar');
    setDungeonTile(1, 7, 'pillar'); setDungeonTile(5, 7, 'pillar');
    setDungeonTile(1, 11, 'pillar'); setDungeonTile(5, 11, 'pillar');
    // Autel / escaliers
    setDungeonTile(3, 15, 'stairs_up');
    setDungeonTile(3, 13, 'door_closed');
  }

  function stampPrison() {
    const floor: TileType = 'floor_stone';
    // Couloir central
    for (let c = 0; c < 14; c++) for (let r = 3; r < 6; r++) setDungeonTile(c, r, floor);
    // Cellules nord (3 cellules)
    for (let i = 0; i < 3; i++) {
      const baseC = i * 5;
      for (let c = baseC; c < baseC + 4; c++) for (let r = 0; r < 3; r++) {
        const isWall = c === baseC || c === baseC+3 || r === 0;
        setDungeonTile(c, r, isWall ? 'wall_stone' : floor);
      }
      setDungeonTile(baseC + 1, 3, 'door_closed');
    }
    // Cellules sud (3 cellules)
    for (let i = 0; i < 3; i++) {
      const baseC = i * 5;
      for (let c = baseC; c < baseC + 4; c++) for (let r = 6; r < 9; r++) {
        const isWall = c === baseC || c === baseC+3 || r === 8;
        setDungeonTile(c, r, isWall ? 'wall_stone' : floor);
      }
      setDungeonTile(baseC + 1, 6, 'door_closed');
    }
    // Escaliers sortie
    setDungeonTile(13, 4, 'stairs_up');
  }

  function stampTour() {
    const floor: TileType = 'floor_stone';
    // Tour circulaire simulée en carrés
    for (let c = 0; c < 7; c++) for (let r = 0; r < 7; r++) {
      const dc = c - 3; const dr = r - 3;
      const dist = Math.sqrt(dc*dc + dr*dr);
      if (dist > 3.2) continue;
      const isWall = dist > 2.5;
      setDungeonTile(c, r, isWall ? 'wall_stone' : floor);
    }
    setDungeonTile(3, 6, 'door_closed');
    setDungeonTile(3, 3, 'stairs_down');
  }

  function stampCrypte() {
    const floor: TileType = 'floor_stone';
    // Chambre principale
    for (let c = 0; c < 10; c++) for (let r = 0; r < 8; r++) {
      const isWall = c === 0 || c === 9 || r === 0 || r === 7;
      setDungeonTile(c, r, isWall ? 'wall_stone' : floor);
    }
    // Alcôves latérales
    for (let r = 1; r < 4; r++) {
      setDungeonTile(-2, r, 'wall_stone'); setDungeonTile(-1, r, floor);
      setDungeonTile(10, r, floor); setDungeonTile(11, r, 'wall_stone');
    }
    setDungeonTile(-2, 0, 'wall_stone'); setDungeonTile(-2, 4, 'wall_stone');
    setDungeonTile(11, 0, 'wall_stone'); setDungeonTile(11, 4, 'wall_stone');
    // Objets
    setDungeonTile(2, 3, 'chest'); setDungeonTile(7, 3, 'chest');
    setDungeonTile(4, 6, 'stairs_down');
    setDungeonTile(4, 7, 'door_closed');
    // Eau au centre
    setDungeonTile(4, 3, 'water'); setDungeonTile(5, 3, 'water');
  }

  // ── Raccourcis clavier ────────────────────────────────────────────
  const KEY_SHORTCUTS: Record<string, TileType> = Object.fromEntries([
    ...TILE_DEFS.slice(0, 9).map((t, i) => [String(i + 1), t.type]),
    ['0', TILE_DEFS[9]?.type ?? 'pillar'],
    ['e', 'void'], ['E', 'void'],
  ]);

  function handleKeydown(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, textarea, [contenteditable]')) return;
    const mapped = KEY_SHORTCUTS[e.key];
    if (mapped) { e.preventDefault(); vttStore.dungeonBrush = mapped; }
    if (e.key === 'b') { e.preventDefault(); vttStore.dungeonDrawMode = 'brush'; }
    if (e.key === 'r') { e.preventDefault(); vttStore.dungeonDrawMode = 'rect'; }
    if (e.key === 'f') { e.preventDefault(); vttStore.dungeonDrawMode = 'fill'; }
    if (e.key === 'm') { e.preventDefault(); vttStore.dungeonDrawMode = 'move'; }
  }

  function getSvgFallback(type: TileType): string {
    const wallColor = '%23374151'; // #374151
    const doorColor = '%238b5a2b'; // #8b5a2b
    const goldColor = '%23fbbf24'; // #fbbf24
    const floorColor = '%239ca3af'; // #9ca3af
    const strokeColor = '%231f2937'; // #1f2937
    
    let path = '';
    if (type === 'wall_horizontal') {
      path = `<rect x="0" y="12" width="40" height="16" fill="${wallColor}" stroke="${strokeColor}" stroke-width="2"/>`;
    } else if (type === 'wall_vertical') {
      path = `<rect x="12" y="0" width="16" height="40" fill="${wallColor}" stroke="${strokeColor}" stroke-width="2"/>`;
    } else if (type === 'wall_corner_tl') {
      path = `<path d="M 12 40 L 12 12 L 40 12 L 40 28 L 28 28 L 28 40 Z" fill="${wallColor}" stroke="${strokeColor}" stroke-width="2" stroke-linejoin="round"/>`;
    } else if (type === 'wall_corner_tr') {
      path = `<path d="M 0 12 L 28 12 L 28 40 L 12 40 L 12 28 L 0 28 Z" fill="${wallColor}" stroke="${strokeColor}" stroke-width="2" stroke-linejoin="round"/>`;
    } else if (type === 'wall_corner_bl') {
      path = `<path d="M 12 0 L 12 28 L 40 28 L 40 12 L 28 12 L 28 0 Z" fill="${wallColor}" stroke="${strokeColor}" stroke-width="2" stroke-linejoin="round"/>`;
    } else if (type === 'wall_corner_br') {
      path = `<path d="M 0 28 L 28 28 L 28 0 L 12 0 L 12 12 L 0 12 Z" fill="${wallColor}" stroke="${strokeColor}" stroke-width="2" stroke-linejoin="round"/>`;
    } else if (type === 'door_horizontal') {
      path = `<rect x="0" y="12" width="6" height="16" fill="${wallColor}" stroke="${strokeColor}" stroke-width="1"/>
              <rect x="34" y="12" width="6" height="16" fill="${wallColor}" stroke="${strokeColor}" stroke-width="1"/>
              <rect x="6" y="14" width="28" height="12" fill="${doorColor}" stroke="${strokeColor}" stroke-width="1"/>
              <circle cx="20" cy="20" r="2.5" fill="${goldColor}"/>`;
    } else if (type === 'door_vertical') {
      path = `<rect x="12" y="0" width="16" height="6" fill="${wallColor}" stroke="${strokeColor}" stroke-width="1"/>
              <rect x="12" y="34" width="16" height="6" fill="${wallColor}" stroke="${strokeColor}" stroke-width="1"/>
              <rect x="14" y="6" width="12" height="28" fill="${doorColor}" stroke="${strokeColor}" stroke-width="1"/>
              <circle cx="20" cy="20" r="2.5" fill="${goldColor}"/>`;
    } else if (type === 'wall_horizontal_torch') {
      path = `<rect x="0" y="12" width="40" height="16" fill="${wallColor}" stroke="${strokeColor}" stroke-width="2"/>
              <circle cx="20" cy="6" r="6" fill="%23f59e0b" opacity="0.4"/>
              <rect x="18" y="8" width="4" height="6" fill="%2378350f"/>
              <path d="M 18 8 L 20 2 L 22 8 Z" fill="%23ea580c"/>`;
    } else if (type === 'wall_vertical_torch') {
      path = `<rect x="12" y="0" width="16" height="40" fill="${wallColor}" stroke="${strokeColor}" stroke-width="2"/>
              <circle cx="6" cy="20" r="6" fill="%23f59e0b" opacity="0.4"/>
              <rect x="8" y="18" width="6" height="4" fill="%2378350f"/>
              <path d="M 8 18 L 2 20 L 8 22 Z" fill="%23ea580c"/>`;
    } else {
      path = `<rect width="40" height="40" fill="${floorColor}"/>`;
    }
    
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="${floorColor}"/>${path}</svg>`;
  }

  function getShortcut(type: TileType): string {
    const idx = TILE_DEFS.findIndex(t => t.type === type);
    if (idx >= 0 && idx < 9) return String(idx + 1);
    if (idx === 9) return '0';
    return '';
  }

  // ── Transformations ───────────────────────────────────────────────
  function shiftDungeon(dc: number, dr: number) {
    if (vttStore.dungeonTiles.length === 0) return;
    pushDungeonUndo();
    vttStore.dungeonTiles = vttStore.dungeonTiles.map(t => ({
      ...t,
      col: t.col + dc,
      row: t.row + dr
    }));
  }

  function mirrorDungeon(axis: 'h' | 'v') {
    if (vttStore.dungeonTiles.length === 0) return;
    pushDungeonUndo();
    let cols = vttStore.dungeonTiles.map(t => t.col);
    let rows = vttStore.dungeonTiles.map(t => t.row);
    let minC = Math.min(...cols), maxC = Math.max(...cols);
    let minR = Math.min(...rows), maxR = Math.max(...rows);
    vttStore.dungeonTiles = vttStore.dungeonTiles.map(t => {
      let col = t.col;
      let row = t.row;
      let type = t.type;
      if (axis === 'h') {
        col = maxC - (col - minC);
        if (type === 'wall_corner_tl') type = 'wall_corner_tr';
        else if (type === 'wall_corner_tr') type = 'wall_corner_tl';
        else if (type === 'wall_corner_bl') type = 'wall_corner_br';
        else if (type === 'wall_corner_br') type = 'wall_corner_bl';
      } else {
        row = maxR - (row - minR);
        if (type === 'wall_corner_tl') type = 'wall_corner_bl';
        else if (type === 'wall_corner_tr') type = 'wall_corner_br';
        else if (type === 'wall_corner_bl') type = 'wall_corner_tl';
        else if (type === 'wall_corner_br') type = 'wall_corner_tr';
      }
      return { col, row, type };
    });
  }

  function rotateDungeon() {
    if (vttStore.dungeonTiles.length === 0) return;
    pushDungeonUndo();
    let cols = vttStore.dungeonTiles.map(t => t.col);
    let rows = vttStore.dungeonTiles.map(t => t.row);
    let minC = Math.min(...cols), maxC = Math.max(...cols);
    let minR = Math.min(...rows), maxR = Math.max(...rows);
    let centerC = Math.round((minC + maxC) / 2);
    let centerR = Math.round((minR + maxR) / 2);
    vttStore.dungeonTiles = vttStore.dungeonTiles.map(t => {
      let dc = t.col - centerC;
      let dr = t.row - centerR;
      let newCol = centerC - dr;
      let newRow = centerR + dc;
      let type = t.type;
      if (type === 'wall_horizontal') type = 'wall_vertical';
      else if (type === 'wall_vertical') type = 'wall_horizontal';
      else if (type === 'wall_horizontal_torch') type = 'wall_vertical_torch';
      else if (type === 'wall_vertical_torch') type = 'wall_horizontal_torch';
      else if (type === 'door_horizontal') type = 'door_vertical';
      else if (type === 'door_vertical') type = 'door_horizontal';
      else if (type === 'wall_corner_tl') type = 'wall_corner_tr';
      else if (type === 'wall_corner_tr') type = 'wall_corner_br';
      else if (type === 'wall_corner_br') type = 'wall_corner_bl';
      else if (type === 'wall_corner_bl') type = 'wall_corner_tl';
      return { col: newCol, row: newRow, type };
    });
  }

  // ── Générateurs Aléatoires ────────────────────────────────────────
  function generateMaze() {
    pushDungeonUndo();
    clearDungeonTiles();
    const size = 15;
    for (let c = 0; c < size; c++) {
      for (let r = 0; r < size; r++) {
        setDungeonTile(c, r, 'wall_stone');
      }
    }
    const grid: boolean[][] = Array(size).fill(null).map(() => Array(size).fill(false));
    function carve(c: number, r: number) {
      grid[c][r] = true;
      setDungeonTile(c, r, 'floor_stone');
      const dirs = [[0,-2],[2,0],[0,2],[-2,0]];
      dirs.sort(() => Math.random() - 0.5);
      for (const [dc, dr] of dirs) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc > 0 && nc < size - 1 && nr > 0 && nr < size - 1 && !grid[nc][nr]) {
          setDungeonTile(c + dc/2, r + dr/2, 'floor_stone');
          carve(nc, nr);
        }
      }
    }
    carve(1, 1);
    setDungeonTile(1, 1, 'stairs_up');
    setDungeonTile(size - 2, size - 2, 'stairs_down');
    
    // deadends for chests
    let deadends: [number, number][] = [];
    for (let c = 1; c < size - 1; c++) {
      for (let r = 1; r < size - 1; r++) {
        if (grid[c][r] && !(c === 1 && r === 1) && !(c === size-2 && r === size-2)) {
          let wallCount = 0;
          if (vttStore.dungeonTiles.find(t => t.col === c+1 && t.row === r)?.type === 'wall_stone') wallCount++;
          if (vttStore.dungeonTiles.find(t => t.col === c-1 && t.row === r)?.type === 'wall_stone') wallCount++;
          if (vttStore.dungeonTiles.find(t => t.col === c && t.row === r+1)?.type === 'wall_stone') wallCount++;
          if (vttStore.dungeonTiles.find(t => t.col === c && t.row === r-1)?.type === 'wall_stone') wallCount++;
          if (wallCount === 3) deadends.push([c, r]);
        }
      }
    }
    deadends.sort(() => Math.random() - 0.5);
    const chests = Math.min(3, deadends.length);
    for (let i = 0; i < chests; i++) {
      setDungeonTile(deadends[i][0], deadends[i][1], 'chest');
    }
  }

  function generateCave() {
    pushDungeonUndo();
    clearDungeonTiles();
    const w = 20, h = 20;
    let map = Array(w).fill(null).map(() => Array(h).fill(true));
    for (let c = 0; c < w; c++) {
      for (let r = 0; r < h; r++) {
        if (c === 0 || c === w - 1 || r === 0 || r === h - 1) map[c][r] = true;
        else map[c][r] = Math.random() < 0.45;
      }
    }
    for (let step = 0; step < 4; step++) {
      let nextMap = Array(w).fill(null).map(() => Array(h).fill(true));
      for (let c = 1; c < w - 1; c++) {
        for (let r = 1; r < h - 1; r++) {
          let neighbors = 0;
          for (let dc = -1; dc <= 1; dc++) {
            for (let dr = -1; dr <= 1; dr++) {
              if (map[c + dc][r + dr]) neighbors++;
            }
          }
          nextMap[c][r] = neighbors > 4;
        }
      }
      map = nextMap;
    }
    for (let c = 0; c < w; c++) {
      for (let r = 0; r < h; r++) {
        if (map[c][r]) setDungeonTile(c, r, 'wall_stone');
        else {
          if (Math.random() < 0.12 && (c > 3 && c < w - 4 && r > 3 && r < h - 4)) setDungeonTile(c, r, 'water');
          else setDungeonTile(c, r, 'floor_dirt');
        }
      }
    }
    let emptySpots: [number, number][] = [];
    for (let c = 1; c < w - 1; c++) {
      for (let r = 1; r < h - 1; r++) {
        if (!map[c][r] && vttStore.dungeonTiles.find(t => t.col === c && t.row === r)?.type === 'floor_dirt') emptySpots.push([c, r]);
      }
    }
    if (emptySpots.length > 2) {
      emptySpots.sort(() => Math.random() - 0.5);
      setDungeonTile(emptySpots[0][0], emptySpots[0][1], 'stairs_up');
      setDungeonTile(emptySpots[1][0], emptySpots[1][1], 'stairs_down');
      setDungeonTile(emptySpots[2][0], emptySpots[2][1], 'chest');
    }
  }

  function generateRuins() {
    pushDungeonUndo();
    clearDungeonTiles();
    const size = 20;
    for (let c = 0; c < size; c++) {
      for (let r = 0; r < size; r++) {
        setDungeonTile(c, r, 'wall_stone');
      }
    }
    interface Room { x: number; y: number; w: number; h: number; }
    const rooms: Room[] = [];
    for (let i = 0; i < 15; i++) {
      const rw = Math.floor(Math.random() * 4) + 4;
      const rh = Math.floor(Math.random() * 4) + 4;
      const rx = Math.floor(Math.random() * (size - rw - 2)) + 1;
      const ry = Math.floor(Math.random() * (size - rh - 2)) + 1;
      let overlap = false;
      for (const r of rooms) {
        if (rx < r.x + r.w && rx + rw > r.x && ry < r.y + r.h && ry + rh > r.y) { overlap = true; break; }
      }
      if (!overlap) rooms.push({ x: rx, y: ry, w: rw, h: rh });
      if (rooms.length >= 5) break;
    }
    for (const room of rooms) {
      for (let c = room.x; c < room.x + room.w; c++) {
        for (let r = room.y; r < room.y + room.h; r++) {
          setDungeonTile(c, r, 'floor_stone');
        }
      }
      if (room.w >= 5 && room.h >= 5) {
        setDungeonTile(room.x + 1, room.y + 1, 'pillar');
        setDungeonTile(room.x + room.w - 2, room.y + 1, 'pillar');
        setDungeonTile(room.x + 1, room.y + room.h - 2, 'pillar');
        setDungeonTile(room.x + room.w - 2, room.y + room.h - 2, 'pillar');
      }
      if (Math.random() < 0.6) setDungeonTile(room.x + Math.floor(room.w/2), room.y + Math.floor(room.h/2), 'chest');
    }
    for (let i = 0; i < rooms.length - 1; i++) {
      const r1 = rooms[i], r2 = rooms[i + 1];
      let sc = r1.x + Math.floor(r1.w/2), sr = r1.y + Math.floor(r1.h/2);
      let ec = r2.x + Math.floor(r2.w/2), er = r2.y + Math.floor(r2.h/2);
      for (let c = Math.min(sc, ec); c <= Math.max(sc, ec); c++) setDungeonTile(c, sr, 'floor_stone');
      for (let r = Math.min(sr, er); r <= Math.max(sr, er); r++) setDungeonTile(ec, r, 'floor_stone');
    }
    if (rooms.length >= 2) {
      setDungeonTile(rooms[0].x + 1, rooms[0].y + 1, 'stairs_up');
      setDungeonTile(rooms[rooms.length - 1].x + 1, rooms[rooms.length - 1].y + 1, 'stairs_down');
    }
  }

  function clearTilesWithUndo() {
    pushDungeonUndo();
    clearDungeonTiles();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="dungeon-editor">
  <div class="de-header">
    <span class="de-title">🏰 Éditeur de Donjon</span>
    <button class="de-close" onclick={() => { vttStore.showDungeonEditor = false; vttStore.mode = 'select'; }}>✕</button>
  </div>

  <div class="de-body">
    <!-- Style Visuel -->
    <div class="de-section-label" style="display:flex; justify-content:space-between; align-items:center;">
      <span>Style Visuel</span>
      <button class="de-prop-btn" onclick={importCustomProp} title="Placer une image personnalisée sur la carte">
        + Prop
      </button>
    </div>
    <div class="de-modes">
      <button class="de-mode-btn" class:active={vttStore.dungeonStyle === 'realistic'} onclick={() => vttStore.dungeonStyle='realistic'}>Réaliste</button>
      <button class="de-mode-btn" class:active={vttStore.dungeonStyle === 'kenney'} onclick={() => vttStore.dungeonStyle='kenney'}>Pixel</button>
      <button class="de-mode-btn" class:active={vttStore.dungeonStyle === 'solid'} onclick={() => vttStore.dungeonStyle='solid'}>Couleurs</button>
    </div>

    <!-- Pinceau actif -->
    <div class="de-active-brush">
      {#if vttStore.dungeonStyle === 'solid'}
        <div class="de-active-img" style="background:{SOLID_COLORS[vttStore.dungeonBrush]}; border-radius:3px;"></div>
      {:else}
        <img src="/tiles/{vttStore.dungeonStyle}/{vttStore.dungeonBrush}.png" alt={vttStore.dungeonBrush}
          onerror={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            img.src = getSvgFallback(vttStore.dungeonBrush);
            img.style.imageRendering = 'auto';
          }}
          class="de-active-img" style={vttStore.dungeonStyle === 'realistic' ? 'border-radius:3px; box-shadow:0 4px 8px rgba(0,0,0,0.5);' : 'border-radius:3px; image-rendering:pixelated;'} />
      {/if}
      <div class="de-active-info">
        <span class="de-active-label">{TILE_DEFS.find(t => t.type === vttStore.dungeonBrush)?.label ?? ''}</span>
        <span class="de-active-hint">G : peindre · D : effacer · <kbd>E</kbd> = effacer</span>
      </div>
    </div>

    <!-- Modes de dessin -->
    <div class="de-section-label">Mode de dessin</div>
    <div class="de-modes">
      <button class="de-mode-btn de-draw-mode" class:active={vttStore.dungeonDrawMode==='brush'} onclick={() => vttStore.dungeonDrawMode='brush'} title="Pinceau [B]">
        ✏️ Pinceau
      </button>
      <button class="de-mode-btn de-draw-mode" class:active={vttStore.dungeonDrawMode==='rect'} onclick={() => vttStore.dungeonDrawMode='rect'} title="Rectangle [R]">
        ⬛ Rect
      </button>
      <button class="de-mode-btn de-draw-mode" class:active={vttStore.dungeonDrawMode==='fill'} onclick={() => vttStore.dungeonDrawMode='fill'} title="Remplissage [F]">
        🪣 Remplir
      </button>
      <button class="de-mode-btn de-draw-mode" class:active={vttStore.dungeonDrawMode==='move'} onclick={() => vttStore.dungeonDrawMode='move'} title="Sélection & Déplacement [M]">
        🖐️ Déplacer
      </button>
    </div>

    <!-- Taille du pinceau -->
    {#if vttStore.dungeonDrawMode === 'brush'}
      <div class="de-section-label">Taille du pinceau</div>
      <div class="de-brush-sizes">
        {#each [1,2,3,5] as size}
          <button class="de-size-btn" class:active={vttStore.dungeonBrushSize === size}
            onclick={() => vttStore.dungeonBrushSize = size as 1|2|3|5}>
            {size}×{size}
          </button>
        {/each}
      </div>
    {/if}

    <!-- Zone de Sélection active en mode Déplacer -->
    {#if vttStore.dungeonDrawMode === 'move' && vttStore.dungeonSelection}
      <div class="de-selection-panel">
        <span class="de-sel-title">Zone Sélectionnée</span>
        <button class="de-sel-clear-btn" onclick={() => vttStore.dungeonSelection = null}>
          Désélectionner
        </button>
      </div>
    {/if}

    <!-- Section Palette (Collapsible) -->
    <details class="de-details" open>
      <summary class="de-summary">
        <span>Palette de tuiles</span>
      </summary>
      <div class="de-details-content">
        <div class="de-categories">
          <button class="de-cat-tab" class:active={activeCategory === 'all'} onclick={() => activeCategory = 'all'}>Tous</button>
          <button class="de-cat-tab" class:active={activeCategory === 'sol'} onclick={() => activeCategory = 'sol'}>Sols</button>
          <button class="de-cat-tab" class:active={activeCategory === 'mur'} onclick={() => activeCategory = 'mur'}>Murs</button>
          <button class="de-cat-tab" class:active={activeCategory === 'objet'} onclick={() => activeCategory = 'objet'}>Objets</button>
          <button class="de-cat-tab" class:active={activeCategory === 'env'} onclick={() => activeCategory = 'env'}>Env.</button>
        </div>

        <div class="de-palette">
          {#each TILE_DEFS.filter(t => activeCategory === 'all' || t.cat === activeCategory || t.cat === 'util') as tile}
            {@const shortcut = getShortcut(tile.type)}
            <button class="de-tile-btn" class:selected={vttStore.dungeonBrush === tile.type}
              onclick={() => vttStore.dungeonBrush = tile.type}
              title="{tile.label}{shortcut ? ` [${shortcut}]` : ''}">
              {#if shortcut}<span class="de-key-hint">{shortcut}</span>{/if}
              {#if vttStore.dungeonStyle === 'solid'}
                <div style="width:54px; height:54px; display:block; border-radius:3px; background:{SOLID_COLORS[tile.type]}"></div>
              {:else}
                <img src="/tiles/{vttStore.dungeonStyle}/{tile.type}.png" alt={tile.label}
                  onerror={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    img.src = getSvgFallback(tile.type);
                    img.style.imageRendering = 'auto';
                  }}
                  width="54" height="54" style="display:block; object-fit:cover; {vttStore.dungeonStyle === 'realistic' ? 'border-radius:3px; box-shadow:0 4px 6px rgba(0,0,0,0.6);' : 'border-radius:3px; image-rendering:pixelated;'}" />
              {/if}
              <span class="de-tile-label">{tile.label}</span>
            </button>
          {/each}
        </div>
      </div>
    </details>

    <!-- Section Outils de Transformations (Collapsible) -->
    <details class="de-details" open>
      <summary class="de-summary">
        <span>Outils & Transformations</span>
      </summary>
      <div class="de-details-content">
        <div class="de-transform-row">
          <button class="de-trans-btn" onclick={() => shiftDungeon(-1, 0)} title="Déplacer à gauche">⬅️</button>
          <button class="de-trans-btn" onclick={() => shiftDungeon(0, -1)} title="Déplacer vers le haut">⬆️</button>
          <button class="de-trans-btn" onclick={() => shiftDungeon(0, 1)} title="Déplacer vers le bas">⬇️</button>
          <button class="de-trans-btn" onclick={() => shiftDungeon(1, 0)} title="Déplacer à droite">➡️</button>
          <button class="de-trans-btn" onclick={() => mirrorDungeon('h')} title="Miroir Horizontal">↔️</button>
          <button class="de-trans-btn" onclick={() => mirrorDungeon('v')} title="Miroir Vertical">↕️</button>
          <button class="de-trans-btn" onclick={() => rotateDungeon()} title="Tourner de 90°">🔄</button>
        </div>
      </div>
    </details>

    <!-- Section Générateurs & Présets (Collapsible) -->
    <details class="de-details">
      <summary class="de-summary">
        <span>Générateurs & Présets</span>
      </summary>
      <div class="de-details-content" style="padding-bottom: 12px;">
        <div class="de-section-label" style="padding-top: 6px;">Générateurs Aléatoires</div>
        <div class="de-generator-row">
          <button class="de-preset-btn" onclick={generateMaze} title="Générer un Labyrinthe parfait (15×15)">Labyrinthe 🌀</button>
          <button class="de-preset-btn" onclick={generateCave} title="Générer une Grotte organique (20×20)">Caverne 🕳️</button>
          <button class="de-preset-btn" onclick={generateRuins} title="Générer des Ruines de salles (20×20)">Ruines 🏛️</button>
        </div>

        <div class="de-section-label" style="padding-top: 8px;">Présets de Salles</div>
        <div class="de-presets">
          {#each PRESETS as preset}
            <button class="de-preset-btn" onclick={preset.fn}>{preset.label}</button>
          {/each}
        </div>
      </div>
    </details>
  </div>

  <div class="de-keyboard-hint">
    <span>Clic droit ou <kbd>E</kbd> = effacer · <kbd>Ctrl+Z</kbd> = annuler</span>
  </div>

  <div class="de-footer">
    <span class="de-tile-count">{vttStore.dungeonTiles.length} tuile{vttStore.dungeonTiles.length !== 1 ? 's' : ''}</span>
    <div class="de-footer-actions">
      <button class="de-undo-btn" onclick={undoMapAction} disabled={!canUndo()} title="Annuler (Ctrl+Z)">↩</button>
      <button class="de-clear-btn" onclick={clearTilesWithUndo} title="Vider la carte (🗑)">🗑</button>
    </div>
  </div>
</div>

<style>
  .dungeon-editor {
    position: absolute; right: 0; top: 0; bottom: 0; width: 340px;
    background: rgba(10, 15, 28, 0.95); backdrop-filter: blur(16px);
    border-left: 1px solid rgba(255, 255, 255, 0.08); display: flex; flex-direction: column;
    z-index: 200; overflow: hidden; box-shadow: -8px 0 32px rgba(0, 0, 0, 0.7);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .de-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 14px; background: rgba(0, 0, 0, 0.25); border-bottom: 1px solid rgba(255, 255, 255, 0.06); flex-shrink: 0;
  }
  .de-title { font-size: 14px; font-weight: 700; color: #f8fafc; letter-spacing: 0.03em; text-transform: uppercase; }
  .de-close { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 16px; padding: 4px 8px; border-radius: 4px; transition: all 0.2s; }
  .de-close:hover { background: rgba(255, 255, 255, 0.08); color: #f8fafc; }

  /* Body container - scrollable */
  .de-body {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .de-body::-webkit-scrollbar {
    width: 5px;
  }
  .de-body::-webkit-scrollbar-track {
    background: transparent;
  }
  .de-body::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2.5px;
  }
  .de-body::-webkit-scrollbar-thumb:hover {
    background: rgba(212, 168, 75, 0.4);
  }

  /* Collapsible sections styling */
  .de-details {
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .de-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 11px 14px;
    font-size: 11.5px;
    font-weight: 700;
    color: #8a9fc2;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    cursor: pointer;
    list-style: none;
    user-select: none;
    transition: background 0.2s, color 0.2s;
  }
  .de-summary::-webkit-details-marker {
    display: none;
  }
  .de-summary:hover {
    background: rgba(255, 255, 255, 0.02);
    color: #f1f5f9;
  }
  .de-summary::after {
    content: '▼';
    font-size: 9px;
    color: #64748b;
    transition: transform 0.2s;
  }
  .de-details[open] .de-summary::after {
    transform: rotate(-180deg);
    color: #d4a84b;
    text-shadow: 0 0 6px rgba(212, 168, 75, 0.3);
  }
  .de-details-content {
    display: flex;
    flex-direction: column;
  }

  .de-section-label {
    font-size: 10.5px; font-weight: 700; color: #475569; text-transform: uppercase;
    letter-spacing: 0.1em; padding: 16px 14px 8px; flex-shrink: 0; display: flex; gap: 6px; align-items: center;
  }
  .de-license { color: #334155; font-size: 9.5px; text-transform: none; font-weight: 400; letter-spacing: 0; }

  .de-active-brush {
    display: flex; align-items: center; gap: 12px; padding: 12px 14px;
    background: rgba(0, 0, 0, 0.2); border-bottom: 1px solid rgba(255, 255, 255, 0.06); flex-shrink: 0;
  }
  .de-active-img {
    display: block; width: 60px; height: 60px;
    border: 1px solid #d4a84b; border-radius: 3px; flex-shrink: 0; object-fit: cover;
    box-shadow: 0 0 10px rgba(212, 168, 75, 0.25);
  }
  .de-active-info { display: flex; flex-direction: column; gap: 4px; }
  .de-active-label { font-size: 14px; font-weight: 600; color: #f1f5f9; }
  .de-active-hint { font-size: 10.5px; color: #64748b; line-height: 1.4; }
  .de-active-hint kbd {
    background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 2px;
    padding: 0 3px; font-size: 9px; color: #94a3b8;
  }

  /* Modes & Styles selection */
  .de-modes { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 4px 14px 8px; flex-shrink: 0; }
  .de-mode-btn {
    flex: 1; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 4px;
    color: #94a3b8; font-size: 12.5px; font-weight: 600; padding: 9px 6px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex; align-items: center; justify-content: center; gap: 4px;
  }
  .de-mode-btn:hover { background: rgba(255, 255, 255, 0.06); color: #f1f5f9; border-color: rgba(255, 255, 255, 0.15); }
  .de-mode-btn:active { transform: scale(0.95); }
  
  /* Visual style buttons active (accent color gold) */
  .de-mode-btn.active {
    background: rgba(212, 168, 75, 0.1); border-color: #d4a84b; color: #d4a84b;
    box-shadow: 0 0 8px rgba(212, 168, 75, 0.2);
  }

  /* Draw mode buttons active (accent color green) */
  .de-mode-btn.de-draw-mode.active {
    background: rgba(16, 185, 129, 0.1); border-color: #10b981; color: #10b981;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.25);
  }
  
  .de-prop-btn {
    background: rgba(212, 168, 75, 0.1); border: 1px solid rgba(212, 168, 75, 0.3); color: #d4a84b; border-radius: 4px; 
    padding: 4px 10px; font-size: 10.5px; font-weight: 600; cursor: pointer; transition: all 0.2s;
    text-transform: uppercase; letter-spacing: 0.05em;
  }
  .de-prop-btn:hover { background: rgba(212, 168, 75, 0.2); border-color: #d4a84b; box-shadow: 0 0 8px rgba(212, 168, 75, 0.3); }
  .de-prop-btn:active { transform: scale(0.95); }

  /* Taille pinceau */
  .de-brush-sizes { display: flex; gap: 6px; padding: 4px 14px 8px; flex-shrink: 0; }
  .de-size-btn {
    flex: 1; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 4px;
    color: #94a3b8; font-size: 12px; font-weight: 600; padding: 8px 4px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .de-size-btn:hover { background: rgba(255, 255, 255, 0.06); color: #f1f5f9; border-color: rgba(255, 255, 255, 0.15); }
  .de-size-btn:active { transform: scale(0.95); }
  .de-size-btn.active {
    background: rgba(59, 130, 246, 0.1); border-color: #3b82f6; color: #3b82f6;
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.2);
  }

  /* Category tabs */
  .de-categories {
    display: flex; gap: 2px; padding: 6px 14px 4px; background: rgba(0, 0, 0, 0.15);
    border-bottom: 1px solid rgba(255, 255, 255, 0.04); flex-shrink: 0;
  }
  .de-cat-tab {
    flex: 1; background: transparent; border: none; color: #64748b;
    font-size: 11px; font-weight: 700; padding: 8px 4px; cursor: pointer; border-radius: 3px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); text-align: center;
    text-transform: uppercase; letter-spacing: 0.02em;
  }
  .de-cat-tab:hover { background: rgba(255, 255, 255, 0.04); color: #94a3b8; }
  .de-cat-tab.active {
    background: rgba(212, 168, 75, 0.12); border: 1px solid rgba(212, 168, 75, 0.25); color: #d4a84b;
    text-shadow: 0 0 6px rgba(212, 168, 75, 0.3);
  }

  /* Palette */
  .de-palette {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
    padding: 8px 14px 12px; overflow-y: visible; flex-shrink: 0;
  }
  .de-tile-btn {
    position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px;
    background: rgba(255, 255, 255, 0.01); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 3px;
    cursor: pointer; padding: 8px 4px; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .de-key-hint {
    position: absolute; top: 3px; right: 5px; font-size: 8px; font-weight: 700;
    color: rgba(255, 255, 255, 0.2); pointer-events: none;
  }
  .de-tile-btn:hover { border-color: rgba(255, 255, 255, 0.15); background: rgba(255, 255, 255, 0.04); transform: translateY(-1px); }
  .de-tile-btn:active { transform: translateY(0) scale(0.96); }
  
  .de-tile-btn.selected {
    border-color: #d4a84b; background: rgba(212, 168, 75, 0.06);
    box-shadow: 0 0 10px rgba(212, 168, 75, 0.2), inset 0 0 3px rgba(212, 168, 75, 0.15);
  }
  .de-tile-btn.selected .de-key-hint { color: #d4a84b; }
  .de-tile-label {
    font-size: 11px; color: #64748b; text-align: center; width: 100%;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 2px;
    transition: color 0.2s;
  }
  .de-tile-btn:hover .de-tile-label { color: #94a3b8; }
  .de-tile-btn.selected .de-tile-label { color: #d4a84b; font-weight: 600; }

  /* Présets & Générateurs */
  .de-presets { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 4px 14px 8px; flex-shrink: 0; }
  .de-preset-btn {
    background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 4px;
    color: #94a3b8; font-size: 12px; padding: 8px 6px; cursor: pointer; transition: all 0.2s;
    text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .de-preset-btn:hover { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.15); color: #f1f5f9; }
  .de-preset-btn:active { transform: scale(0.95); }

  /* Footer */
  .de-keyboard-hint {
    padding: 8px 12px; font-size: 10px; color: #475569;
    background: rgba(0, 0, 0, 0.25); border-top: 1px solid rgba(255, 255, 255, 0.04); flex-shrink: 0; line-height: 1.6;
    text-align: center;
  }
  .de-keyboard-hint kbd {
    background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 2px;
    padding: 0 3px; font-size: 9.5px; color: #94a3b8;
  }
  .de-footer {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 14px; border-top: 1px solid rgba(255, 255, 255, 0.06); background: rgba(0, 0, 0, 0.3); flex-shrink: 0;
  }
  .de-tile-count { font-size: 11px; color: #64748b; font-weight: 500; }
  .de-footer-actions { display: flex; gap: 6px; }
  
  .de-undo-btn {
    background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 4px;
    color: #94a3b8; font-size: 14px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;
  }
  .de-undo-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.15); color: #f1f5f9; }
  .de-undo-btn:disabled { opacity: 0.2; cursor: not-allowed; }
  .de-undo-btn:active:not(:disabled) { transform: scale(0.9); }
  
  .de-clear-btn {
    background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 4px;
    color: #fca5a5; font-size: 14px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;
  }
  .de-clear-btn:hover { background: rgba(239, 68, 68, 0.2); border-color: #ef4444; box-shadow: 0 0 8px rgba(239, 68, 68, 0.3); }
  .de-clear-btn:active { transform: scale(0.9); }

  /* Transformations */
  .de-transform-row {
    display: flex; gap: 6px; padding: 6px 14px 10px; flex-shrink: 0;
  }
  .de-trans-btn {
    flex: 1; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 4px;
    color: #94a3b8; font-size: 15px; padding: 9px 0; cursor: pointer; transition: all 0.2s;
    display: flex; align-items: center; justify-content: center;
  }
  .de-trans-btn:hover { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.15); color: #f1f5f9; }
  .de-trans-btn:active { transform: scale(0.9); }

  /* Générateurs */
  .de-generator-row {
    display: flex; gap: 6px; padding: 4px 14px 8px; flex-shrink: 0;
  }

  /* Sélection */
  .de-selection-panel {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 14px; background: rgba(212, 168, 75, 0.08);
    border-bottom: 1px solid rgba(212, 168, 75, 0.15); flex-shrink: 0;
  }
  .de-sel-title {
    font-size: 11.5px; color: #d4a84b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  }
  .de-sel-clear-btn {
    background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 4px;
    color: #94a3b8; font-size: 11px; padding: 5px 10px; cursor: pointer; transition: all 0.2s;
  }
  .de-sel-clear-btn:hover {
    background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.2); color: #f1f5f9;
  }
</style>
