import { mapStore, pushHistory } from './stores/mapStore.svelte';
import importedStamps from './imported_stamps.json';
import { invoke } from '@tauri-apps/api/core';

// Taille native maximale (px) de chaque stamp thématique — sert à calibrer l'échelle
const STAMP_NATIVE_MAX: Record<string, number> = {
  'imported_gjojg6sr808ix89hnqknbttvi8ik': 244, 'imported_81qupz0jv6vinphr54s4ltsrlrlm': 160,
  'imported_zy8s7mir0m6lffopt9ige9tqi4ee': 232, 'imported_pytnqfou56nay4uaiiclhngkv81y': 234,
  'imported_v2ql1mj9ds55f3ez7d1u523wvfjw': 193, 'imported_nbw4j74q8ub9zj88tg3e5gr4ig0l': 191,
  'imported_quvw6fqdrojm83pd20svtniwcbos': 188, 'imported_juzy62ujdon0wmo5qiv1ygwkhue2': 160,
  'imported_ua0xxx0yco9uhet0n34xien2nw70': 160, 'imported_mxum8ja0e97vjiz6avc644unbnjb': 160,
  'imported_zj9ucorcmdic7wk0wwdpqiyrrrn8': 160, 'imported_wv2bfinnybnnlyf1v5ebatubdrlm': 160,
  'imported_q6o3hj6afiv45th7xxqzoxp0u8gq': 160, 'imported_a8jdfemk3xgyg56bkiuzrdpwvm23': 160,
  'imported_0syvaindutyoa0rpzzi3e4gs4yiu': 160, 'imported_n9lmribboj4o897zfsaf75lc17ok': 160,
  'imported_yoaljoray1fx6ocragjxz7ylj4cg': 160, 'imported_drno28tawfeedwm42jep9t6w5p58': 244,
  'imported_codly79togkk62b7t2a0de7inw18': 244, 'imported_c7va2xt9lw2pqy6mf2lk19v8zgm9': 160,
  'imported_ebdhe9whsys0k38dbwxxw0qsxxxa': 160, 'imported_sm3birrpdc71rui7yah5ychfnq5j': 160,
  'imported_33istv8ff1hvps78ut39ifhj6x9i': 244
};
const sNative = (id: string) => {
  if (!id) return 80;
  if (id.startsWith('td_')) return 80;
  return STAMP_NATIVE_MAX[id] ?? 160;
};


// Types de tuiles pour la génération
export type CellType = 'void' | 'floor_stone' | 'floor_dirt' | 'wall' | 'door' | 'chest' | 'pillar' | 'stairs_up' | 'stairs_down' | 'water' | 'table' | 'chair' | 'bar' | 'campfire' | 'tree' | 'rock' | 'bed' | 'altar' | 'sarcophagus' | 'bookshelf' | 'brazier' | 'statue' | 'trap';

export type DungeonThemeName = 'classic' | 'prison' | 'cave';

export function clearMapElements() {
  mapStore.stamps = [];
  mapStore.paths = [];
  mapStore.texts = [];
  mapStore.shapes = [];
}

function applyThemeFloor(themeName: DungeonThemeName) {
  const theme = mapStore.dungeonThemes[themeName];
  mapStore.paintTexture = theme.floorTexture;
  mapStore.foregroundOpacity = 1.0;
}

export function generateMazeDungeon(themeName: DungeonThemeName = 'classic', size: number = 15) {
  pushHistory();
  clearMapElements();
  applyThemeFloor(themeName);

  const theme = mapStore.dungeonThemes[themeName];
  const grid: CellType[][] = Array(size).fill(null).map(() => Array(size).fill('wall'));
  const visited: boolean[][] = Array(size).fill(null).map(() => Array(size).fill(false));

  function carve(c: number, r: number) {
    visited[c][r] = true;
    grid[c][r] = 'floor_stone';
    
    const dirs = [[0, -2], [2, 0], [0, 2], [-2, 0]];
    dirs.sort(() => Math.random() - 0.5);

    for (const [dc, dr] of dirs) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc > 0 && nc < size - 1 && nr > 0 && nr < size - 1 && !visited[nc][nr]) {
        grid[c + dc / 2][r + dr / 2] = 'floor_stone';
        carve(nc, nr);
      }
    }
  }

  carve(1, 1);
  grid[1][1] = 'stairs_up';
  grid[size - 2][size - 2] = 'stairs_down';

  const deadends: [number, number][] = [];
  for (let c = 1; c < size - 1; c++) {
    for (let r = 1; r < size - 1; r++) {
      if (grid[c][r] === 'floor_stone' && !(c === 1 && r === 1) && !(c === size - 2 && r === size - 2)) {
        let wallCount = 0;
        if (grid[c + 1][r] === 'wall') wallCount++;
        if (grid[c - 1][r] === 'wall') wallCount++;
        if (grid[c][r + 1] === 'wall') wallCount++;
        if (grid[c][r - 1] === 'wall') wallCount++;
        if (wallCount === 3) {
          deadends.push([c, r]);
        }
      }
    }
  }

  deadends.sort(() => Math.random() - 0.5);
  const chestsCount = Math.min(3, deadends.length);
  for (let i = 0; i < chestsCount; i++) {
    const [c, r] = deadends[i];
    grid[c][r] = 'chest';
  }

  instantiateGridStamps(grid, size, size, theme);
}

export function generateCaveDungeon(themeName: DungeonThemeName = 'cave', w: number = 20, h: number = 20) {
  pushHistory();
  clearMapElements();
  applyThemeFloor(themeName);

  const theme = mapStore.dungeonThemes[themeName];
  let map = Array(w).fill(null).map(() => Array(h).fill(true));
  for (let c = 0; c < w; c++) {
    for (let r = 0; r < h; r++) {
      if (c === 0 || c === w - 1 || r === 0 || r === h - 1) {
        map[c][r] = true;
      } else {
        map[c][r] = Math.random() < 0.45;
      }
    }
  }

  for (let step = 0; step < 4; step++) {
    const nextMap = Array(w).fill(null).map(() => Array(h).fill(true));
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

  const grid: CellType[][] = Array(w).fill(null).map(() => Array(h).fill('void'));
  const emptySpots: [number, number][] = [];

  for (let c = 0; c < w; c++) {
    for (let r = 0; r < h; r++) {
      if (map[c][r]) {
        grid[c][r] = 'wall';
      } else {
        grid[c][r] = 'floor_stone';
        emptySpots.push([c, r]);
      }
    }
  }

  if (emptySpots.length > 3) {
    emptySpots.sort(() => Math.random() - 0.5);
    grid[emptySpots[0][0]][emptySpots[0][1]] = 'stairs_up';
    grid[emptySpots[1][0]][emptySpots[1][1]] = 'stairs_down';
    grid[emptySpots[2][0]][emptySpots[2][1]] = 'chest';
    grid[emptySpots[3][0]][emptySpots[3][1]] = 'pillar';
  }

  instantiateGridStamps(grid, w, h, theme);
}

export function generateRuinsDungeon(themeName: DungeonThemeName = 'classic', size: number = 20) {
  pushHistory();
  clearMapElements();
  applyThemeFloor(themeName);

  const theme = mapStore.dungeonThemes[themeName];
  const grid: CellType[][] = Array(size).fill(null).map(() => Array(size).fill('wall'));

  interface Room { x: number; y: number; w: number; h: number; }
  const rooms: Room[] = [];

  for (let i = 0; i < 15; i++) {
    const rw = Math.floor(Math.random() * 4) + 4;
    const rh = Math.floor(Math.random() * 4) + 4;
    const rx = Math.floor(Math.random() * (size - rw - 2)) + 1;
    const ry = Math.floor(Math.random() * (size - rh - 2)) + 1;
    
    let overlap = false;
    for (const r of rooms) {
      if (rx < r.x + r.w && rx + rw > r.x && ry < r.y + r.h && ry + rh > r.y) {
        overlap = true;
        break;
      }
    }
    
    if (!overlap) {
      rooms.push({ x: rx, y: ry, w: rw, h: rh });
    }
    if (rooms.length >= 5) break;
  }

  for (const room of rooms) {
    for (let c = room.x; c < room.x + room.w; c++) {
      for (let r = room.y; r < room.y + room.h; r++) {
        grid[c][r] = 'floor_stone';
      }
    }
    
    if (room.w >= 5 && room.h >= 5) {
      grid[room.x + 1][room.y + 1] = 'pillar';
      grid[room.x + room.w - 2][room.y + 1] = 'pillar';
      grid[room.x + 1][room.y + room.h - 2] = 'pillar';
      grid[room.x + room.w - 2][room.y + room.h - 2] = 'pillar';
    }

    if (Math.random() < 0.6) {
      grid[room.x + Math.floor(room.w / 2)][room.y + Math.floor(room.h / 2)] = 'chest';
    }
  }

  for (let i = 0; i < rooms.length - 1; i++) {
    const r1 = rooms[i];
    const r2 = rooms[i + 1];
    let sc = r1.x + Math.floor(r1.w / 2);
    let sr = r1.y + Math.floor(r1.h / 2);
    let ec = r2.x + Math.floor(r2.w / 2);
    let er = r2.y + Math.floor(r2.h / 2);

    for (let c = Math.min(sc, ec); c <= Math.max(sc, ec); c++) {
      if (grid[c][sr] === 'wall') grid[c][sr] = 'floor_stone';
    }
    for (let r = Math.min(sr, er); r <= Math.max(sr, er); r++) {
      if (grid[ec][r] === 'wall') grid[ec][r] = 'floor_stone';
    }
  }

  if (rooms.length >= 2) {
    grid[rooms[0].x + 1][rooms[0].y + 1] = 'stairs_up';
    grid[rooms[rooms.length - 1].x + 1][rooms[rooms.length - 1].y + 1] = 'stairs_down';
  }

  instantiateGridStamps(grid, size, size, theme);
}

// ── 1. Donjon BSP (Binary Space Partitioning : Salles, Couloirs et Pièce de Boss) ──
export function generateBspDungeon(themeName: DungeonThemeName = 'classic', size: number = 24) {
  pushHistory();
  clearMapElements();
  applyThemeFloor(themeName);

  const theme = mapStore.dungeonThemes[themeName];
  const grid: CellType[][] = Array(size).fill(null).map(() => Array(size).fill('wall'));

  interface BspNode {
    x: number;
    y: number;
    w: number;
    h: number;
    left?: BspNode;
    right?: BspNode;
    room?: { x: number; y: number; w: number; h: number };
  }

  function splitNode(node: BspNode, depth: number): void {
    if (depth <= 0 || (node.w <= 9 && node.h <= 9)) return;

    let splitH = Math.random() > 0.5;
    if (node.w > node.h && node.w / node.h >= 1.25) splitH = false;
    else if (node.h > node.w && node.h / node.w >= 1.25) splitH = true;

    const max = (splitH ? node.h : node.w) - 5;
    if (max <= 5) return;

    const split = Math.floor(Math.random() * (max - 5)) + 5;

    if (splitH) {
      node.left = { x: node.x, y: node.y, w: node.w, h: split };
      node.right = { x: node.x, y: node.y + split, w: node.w, h: node.h - split };
    } else {
      node.left = { x: node.x, y: node.y, w: split, h: node.h };
      node.right = { x: node.x + split, y: node.y, w: node.w - split, h: node.h };
    }

    splitNode(node.left, depth - 1);
    splitNode(node.right, depth - 1);
  }

  const root: BspNode = { x: 1, y: 1, w: size - 2, h: size - 2 };
  splitNode(root, 4);

  const leaves: BspNode[] = [];
  function getLeaves(node: BspNode) {
    if (!node.left && !node.right) {
      leaves.push(node);
    } else {
      if (node.left) getLeaves(node.left);
      if (node.right) getLeaves(node.right);
    }
  }
  getLeaves(root);

  // Créer une pièce dans chaque feuille
  for (const leaf of leaves) {
    const minW = Math.max(3, leaf.w - 3);
    const minH = Math.max(3, leaf.h - 3);
    const rw = Math.floor(Math.random() * (leaf.w - minW + 1)) + minW;
    const rh = Math.floor(Math.random() * (leaf.h - minH + 1)) + minH;
    const rx = leaf.x + Math.floor((leaf.w - rw) / 2);
    const ry = leaf.y + Math.floor((leaf.h - rh) / 2);

    leaf.room = { x: rx, y: ry, w: rw, h: rh };
    for (let c = rx; c < rx + rw; c++) {
      for (let r = ry; r < ry + rh; r++) {
        grid[c][r] = 'floor_stone';
      }
    }
  }

  // Relier les feuilles sœurs par des couloirs
  function connectLeaves(node: BspNode) {
    if (!node.left || !node.right) return;
    connectLeaves(node.left);
    connectLeaves(node.right);

    const getCenter = (n: BspNode): [number, number] => {
      if (n.room) return [n.room.x + Math.floor(n.room.w / 2), n.room.y + Math.floor(n.room.h / 2)];
      if (n.left) return getCenter(n.left);
      return [n.x + Math.floor(n.w / 2), n.y + Math.floor(n.h / 2)];
    };

    const [x1, y1] = getCenter(node.left);
    const [x2, y2] = getCenter(node.right);

    let cx = x1;
    let cy = y1;
    while (cx !== x2) {
      grid[cx][cy] = 'floor_stone';
      cx += cx < x2 ? 1 : -1;
    }
    while (cy !== y2) {
      grid[cx][cy] = 'floor_stone';
      cy += cy < y2 ? 1 : -1;
    }
    grid[x2][y2] = 'floor_stone';
  }
  connectLeaves(root);

  if (leaves.length > 0) {
    // Entrée : première pièce
    const startRoom = leaves[0].room!;
    grid[startRoom.x + 1][startRoom.y + 1] = 'stairs_up';

    // Salle de boss / Pièce la plus éloignée
    let bossLeaf = leaves[leaves.length - 1];
    let maxDist = 0;
    for (const leaf of leaves) {
      const r = leaf.room!;
      const d = Math.hypot(r.x - startRoom.x, r.y - startRoom.y);
      if (d > maxDist) {
        maxDist = d;
        bossLeaf = leaf;
      }
    }
    const endRoom = bossLeaf.room!;
    grid[endRoom.x + endRoom.w - 2][endRoom.y + endRoom.h - 2] = 'stairs_down';

    // Décoration de la salle de Boss si activée
    if (mapStore.dungeonBossRoom) {
      const bx = endRoom.x + Math.floor(endRoom.w / 2);
      const by = endRoom.y + 1;
      grid[bx][by] = 'altar';
      if (bx > endRoom.x + 1) grid[bx - 1][by] = 'brazier';
      if (bx < endRoom.x + endRoom.w - 2) grid[bx + 1][by] = 'brazier';
      if (endRoom.h >= 5) {
        grid[bx][endRoom.y + Math.floor(endRoom.h / 2)] = 'sarcophagus';
      }
      grid[endRoom.x + 1][endRoom.y + 1] = 'chest';
      grid[endRoom.x + endRoom.w - 2][endRoom.y + 1] = 'chest';
      if (bx > endRoom.x + 2) grid[endRoom.x + 1][endRoom.y + endRoom.h - 2] = 'statue';
      if (bx < endRoom.x + endRoom.w - 3) grid[endRoom.x + endRoom.w - 2][endRoom.y + endRoom.h - 2] = 'statue';
    }

    // Meubler les pièces selon la densité choisie
    const density = mapStore.dungeonFurnishingDensity;
    const fillChance = density === 'dense' ? 0.75 : density === 'normal' ? 0.45 : 0.2;

    for (let i = 1; i < leaves.length; i++) {
      const leaf = leaves[i];
      if (leaf === bossLeaf) continue;
      const room = leaf.room!;
      if (Math.random() > fillChance) continue;

      const roomType = Math.floor(Math.random() * 4);
      if (roomType === 0) {
        // Bibliothèque occulte
        for (let c = room.x + 1; c < room.x + room.w - 1; c++) {
          if (c % 2 === 0) grid[c][room.y] = 'bookshelf';
        }
        if (room.w >= 5 && room.h >= 5) {
          const midX = room.x + Math.floor(room.w / 2);
          const midY = room.y + Math.floor(room.h / 2);
          grid[midX][midY] = 'table';
          grid[midX - 1][midY] = 'chair';
          grid[midX + 1][midY] = 'chair';
        }
      } else if (roomType === 1) {
        // Crypte
        const midX = room.x + Math.floor(room.w / 2);
        const midY = room.y + Math.floor(room.h / 2);
        grid[midX][midY] = 'sarcophagus';
        if (midX > room.x + 1) grid[midX - 1][midY] = 'brazier';
        if (midX < room.x + room.w - 2) grid[midX + 1][midY] = 'brazier';
      } else if (roomType === 2) {
        // Armurerie / Trésor
        const midX = room.x + Math.floor(room.w / 2);
        grid[midX][room.y + 1] = 'chest';
        if (room.w >= 5) {
          grid[room.x + 1][room.y + 1] = 'pillar';
          grid[room.x + room.w - 2][room.y + 1] = 'pillar';
        }
        if (mapStore.dungeonTraps) {
          grid[midX][room.y + 2] = 'trap';
        }
      } else {
        // Dortoir de garde
        if (room.w >= 5 && room.h >= 5) {
          grid[room.x + 1][room.y + 1] = 'bed';
          grid[room.x + room.w - 2][room.y + 1] = 'chest';
        }
      }
    }

    // Pièges dans les couloirs
    if (mapStore.dungeonTraps) {
      let trapsLeft = Math.floor(size / 5);
      for (let c = 2; c < size - 2 && trapsLeft > 0; c++) {
        for (let r = 2; r < size - 2 && trapsLeft > 0; r++) {
          if (grid[c][r] === 'floor_stone') {
            const isCorridorH = grid[c][r - 1] === 'wall' && grid[c][r + 1] === 'wall';
            const isCorridorV = grid[c - 1][r] === 'wall' && grid[c + 1][r] === 'wall';
            if ((isCorridorH || isCorridorV) && Math.random() < 0.25) {
              grid[c][r] = 'trap';
              trapsLeft--;
            }
          }
        }
      }
    }

    // Placer des portes aux seuils des pièces
    for (const leaf of leaves) {
      const r = leaf.room!;
      for (let c = r.x; c < r.x + r.w; c++) {
        if (r.y > 0 && grid[c][r.y - 1] === 'floor_stone' && grid[c - 1]?.[r.y] === 'wall' && grid[c + 1]?.[r.y] === 'wall') {
          grid[c][r.y] = 'door';
        }
        if (r.y + r.h < size && grid[c][r.y + r.h] === 'floor_stone' && grid[c - 1]?.[r.y + r.h - 1] === 'wall' && grid[c + 1]?.[r.y + r.h - 1] === 'wall') {
          grid[c][r.y + r.h - 1] = 'door';
        }
      }
    }
  }

  instantiateGridStamps(grid, size, size, theme);
}

// ── 2. Catacombes & Cryptes Oubliées ──
export function generateCatacombs(themeName: DungeonThemeName = 'classic', size: number = 22) {
  pushHistory();
  clearMapElements();
  applyThemeFloor(themeName);

  const theme = mapStore.dungeonThemes[themeName];
  const grid: CellType[][] = Array(size).fill(null).map(() => Array(size).fill('wall'));

  const midX = Math.floor(size / 2);
  const midY = Math.floor(size / 2);

  // Allées principales
  for (let r = 2; r < size - 2; r++) {
    grid[midX][r] = 'floor_stone';
    grid[midX - 1][r] = 'floor_stone';
  }
  for (let c = 2; c < size - 2; c++) {
    grid[c][midY] = 'floor_stone';
    grid[c][midY - 1] = 'floor_stone';
  }

  grid[midX - 1][midY] = 'brazier';
  grid[midX][midY] = 'brazier';

  // Alcôves mortuaires
  const alcoves = [
    { x: 3, y: 3 }, { x: size - 7, y: 3 },
    { x: 3, y: size - 7 }, { x: size - 7, y: size - 7 },
    { x: 3, y: midY - 2 }, { x: size - 7, y: midY - 2 },
    { x: midX - 2, y: 3 }, { x: midX - 2, y: size - 7 }
  ];

  for (const alc of alcoves) {
    for (let c = alc.x; c < alc.x + 4; c++) {
      for (let r = alc.y; r < alc.y + 4; r++) {
        grid[c][r] = 'floor_stone';
      }
    }
    grid[alc.x + 1][alc.y + 1] = 'sarcophagus';
    grid[alc.x + 2][alc.y + 1] = 'sarcophagus';
    grid[alc.x + 1][alc.y + 2] = 'brazier';
    if (mapStore.dungeonTraps && Math.random() < 0.5) {
      grid[alc.x + 2][alc.y + 2] = 'trap';
    }
  }

  // Tombeau du Roi au nord
  const bossY = 3;
  grid[midX - 1][bossY] = 'altar';
  grid[midX][bossY] = 'sarcophagus';
  grid[midX - 2][bossY] = 'statue';
  grid[midX + 1][bossY] = 'statue';
  grid[midX - 2][bossY + 1] = 'chest';
  grid[midX + 1][bossY + 1] = 'chest';

  // Escaliers d'accès au sud
  grid[midX][size - 3] = 'stairs_up';
  grid[midX - 1][size - 3] = 'stairs_down';

  instantiateGridStamps(grid, size, size, theme);
}

// ── 3. Temple Sacré / Sanctuaire Antique ──
export function generateTemple(themeName: DungeonThemeName = 'classic', size: number = 22) {
  pushHistory();
  clearMapElements();
  applyThemeFloor(themeName);

  const theme = mapStore.dungeonThemes[themeName];
  const grid: CellType[][] = Array(size).fill(null).map(() => Array(size).fill('wall'));

  const midX = Math.floor(size / 2);

  // Nef centrale majestueuse
  for (let c = midX - 3; c <= midX + 3; c++) {
    for (let r = 4; r <= size - 3; r++) {
      grid[c][r] = 'floor_stone';
    }
  }

  // Colonnade bordant la nef avec piliers et braséros
  for (let r = 7; r <= size - 5; r += 3) {
    grid[midX - 2][r] = 'pillar';
    grid[midX + 2][r] = 'pillar';
    grid[midX - 2][r + 1] = 'brazier';
    grid[midX + 2][r + 1] = 'brazier';
  }

  // Sanctuaire Nord (Saint des Saints)
  for (let c = midX - 4; c <= midX + 4; c++) {
    for (let r = 2; r <= 5; r++) {
      grid[c][r] = 'floor_stone';
    }
  }
  grid[midX][2] = 'altar';
  grid[midX - 2][2] = 'statue';
  grid[midX + 2][2] = 'statue';
  grid[midX - 3][3] = 'brazier';
  grid[midX + 3][3] = 'brazier';

  // Reliquaire secret derrière l'autel
  for (let c = midX - 2; c <= midX + 2; c++) {
    grid[c][1] = 'floor_stone';
  }
  grid[midX - 2][1] = 'chest';
  grid[midX + 2][1] = 'chest';
  grid[midX][1] = mapStore.dungeonTraps ? 'trap' : 'chest';
  grid[midX - 3][2] = 'door';

  // Ailes latérales (Bibliothèque et nécropole monastique)
  for (let c = 2; c <= midX - 4; c++) {
    for (let r = 8; r <= 14; r++) {
      grid[c][r] = 'floor_stone';
    }
  }
  for (let c = midX + 4; c <= size - 3; c++) {
    for (let r = 8; r <= 14; r++) {
      grid[c][r] = 'floor_stone';
    }
  }

  // Bibliothèque aile ouest
  grid[2][8] = 'bookshelf';
  grid[3][8] = 'bookshelf';
  grid[4][8] = 'bookshelf';
  grid[3][11] = 'table';
  grid[2][11] = 'chair';
  grid[4][11] = 'chair';

  // Tombeaux aile est
  grid[size - 3][8] = 'sarcophagus';
  grid[size - 4][8] = 'sarcophagus';
  grid[size - 3][12] = 'sarcophagus';
  grid[size - 4][12] = 'brazier';

  // Portes des ailes
  grid[midX - 4][11] = 'door';
  grid[midX + 4][11] = 'door';

  // Grand perron au sud
  grid[midX][size - 2] = 'stairs_up';
  grid[midX - 1][size - 2] = 'stairs_up';
  grid[midX + 1][size - 2] = 'stairs_up';

  instantiateGridStamps(grid, size, size, theme);
}

// ── 4. Égouts & Canaux Souterrains Inondés ──
export function generateSewers(themeName: DungeonThemeName = 'prison', size: number = 22) {
  pushHistory();
  clearMapElements();
  applyThemeFloor(themeName);

  const theme = mapStore.dungeonThemes[themeName];
  const grid: CellType[][] = Array(size).fill(null).map(() => Array(size).fill('wall'));

  const mid = Math.floor(size / 2);

  // Grand canal central inondé (eau)
  for (let r = 1; r < size - 1; r++) {
    grid[mid - 1][r] = 'water';
    grid[mid][r] = 'water';
    grid[mid + 1][r] = 'water';
  }

  // Quais en pierre de part et d'autre
  for (let r = 1; r < size - 1; r++) {
    grid[mid - 3][r] = 'floor_stone';
    grid[mid - 2][r] = 'floor_stone';
    grid[mid + 2][r] = 'floor_stone';
    grid[mid + 3][r] = 'floor_stone';
  }

  // Ponts en pierre traversant le canal
  const bridgeRows = [Math.floor(size * 0.25), Math.floor(size * 0.5), Math.floor(size * 0.75)];
  for (const br of bridgeRows) {
    grid[mid - 1][br] = 'floor_stone';
    grid[mid][br] = 'floor_stone';
    grid[mid + 1][br] = 'floor_stone';
    grid[mid - 2][br] = 'brazier';
    grid[mid + 2][br] = 'brazier';
  }

  // Grilles d'évacuation
  for (let r = 3; r < size - 3; r += 4) {
    grid[mid - 3][r] = 'trap';
    grid[mid + 3][r] = 'trap';
  }

  // Repaires de contrebandiers latéraux
  const hideoutLeft = { x: 2, y: mid - 3, w: 4, h: 6 };
  for (let c = hideoutLeft.x; c < hideoutLeft.x + hideoutLeft.w; c++) {
    for (let r = hideoutLeft.y; r < hideoutLeft.y + hideoutLeft.h; r++) {
      grid[c][r] = 'floor_stone';
    }
  }
  grid[hideoutLeft.x + 1][hideoutLeft.y + 1] = 'campfire';
  grid[hideoutLeft.x + 2][hideoutLeft.y + 1] = 'chair';
  grid[hideoutLeft.x + 1][hideoutLeft.y + 4] = 'bed';
  grid[hideoutLeft.x + 2][hideoutLeft.y + 4] = 'chest';
  grid[mid - 3][mid] = 'door';

  const hideoutRight = { x: size - 6, y: mid - 3, w: 4, h: 6 };
  for (let c = hideoutRight.x; c < hideoutRight.x + hideoutRight.w; c++) {
    for (let r = hideoutRight.y; r < hideoutRight.y + hideoutRight.h; r++) {
      grid[c][r] = 'floor_stone';
    }
  }
  grid[hideoutRight.x + 2][hideoutRight.y + 2] = 'chest';
  grid[hideoutRight.x + 2][hideoutRight.y + 3] = 'chest';
  grid[hideoutRight.x + 1][hideoutRight.y + 2] = 'brazier';
  grid[mid + 3][mid] = 'door';

  // Escaliers d'accès
  grid[mid - 2][2] = 'stairs_up';
  grid[mid + 2][size - 3] = 'stairs_down';

  instantiateGridStamps(grid, size, size, theme);
}

export function generateTavern(themeName: DungeonThemeName = 'classic', size: number = 20) {
  pushHistory();
  clearMapElements();
  
  const theme = mapStore.dungeonThemes[themeName];
  mapStore.paintTexture = theme.floorTexture === 'dirt' ? 'dirt' : 'wood';
  mapStore.foregroundOpacity = 1.0;
  
  const grid: CellType[][] = Array(size).fill(null).map(() => Array(size).fill('void'));
  
  const startCol = 2;
  const endCol = size - 3;
  const startRow = 2;
  const endRow = size - 3;
  
  // Remplir l'espace intérieur avec le sol
  for (let c = startCol; c <= endCol; c++) {
    for (let r = startRow; r <= endRow; r++) {
      grid[c][r] = 'floor_stone';
    }
  }
  
  // Poser les murs extérieurs
  for (let c = startCol - 1; c <= endCol + 1; c++) {
    grid[c][startRow - 1] = 'wall';
    grid[c][endRow + 1] = 'wall';
  }
  for (let r = startRow - 1; r <= endRow + 1; r++) {
    grid[startCol - 1][r] = 'wall';
    grid[endCol + 1][r] = 'wall';
  }
  
  // Porte d'entrée principale à gauche
  const mainEntranceRow = startRow + Math.floor((endRow - startRow) / 2);
  grid[startCol - 1][mainEntranceRow] = 'door';
  
  // Séparer les arrière-boutiques sur le côté droit
  const dividerCol = endCol - 5;
  for (let r = startRow; r <= endRow; r++) {
    grid[dividerCol][r] = 'wall';
  }
  
  // Diviser en Cuisine (haut) et Chambre (bas)
  const dividerRow = startRow + Math.floor((endRow - startRow) / 2);
  for (let c = dividerCol + 1; c <= endCol; c++) {
    grid[c][dividerRow] = 'wall';
  }
  
  // Portes d'accès aux arrière-boutiques depuis la pièce principale
  grid[dividerCol][startRow + 2] = 'door';
  grid[dividerCol][endRow - 2] = 'door';
  
  // Cheminée sur le mur du haut
  const fireplaceCol = startCol + Math.floor((dividerCol - startCol) / 2);
  grid[fireplaceCol][startRow - 1] = 'stairs_up'; // utilisé comme cheminée
  
  // Placer des tables et des chaises dans la grande salle
  for (let c = startCol + 1; c < dividerCol - 1; c += 4) {
    for (let r = startRow + 1; r < endRow - 2; r += 4) {
      if (Math.abs(c - fireplaceCol) <= 1 && r === startRow + 1) continue; // laisser l'espace devant le feu
      
      grid[c][r] = 'table';
      if (c > startCol) grid[c - 1][r] = 'chair';
      if (c < dividerCol - 1) grid[c + 1][r] = 'chair';
    }
  }
  
  // Comptoir de bar en bas de la salle principale
  const barRow = endRow - 2;
  for (let c = startCol + 2; c < dividerCol - 2; c++) {
    grid[c][barRow] = 'bar';
    grid[c][barRow - 1] = 'chair'; // Tabouret devant
    grid[c][barRow + 1] = 'chest'; // Tonneaux/coffres derrière
  }
  
  // Piliers de soutien
  grid[startCol + 2][startRow + 2] = 'pillar';
  grid[dividerCol - 3][startRow + 2] = 'pillar';
  
  // Cuisine
  grid[endCol][startRow + 1] = 'chest';
  grid[dividerCol + 2][startRow + 1] = 'pillar';
  
  // Chambre
  grid[endCol][endRow - 1] = 'bed';
  grid[dividerCol + 2][endRow - 1] = 'chest';
  
  instantiateGridStamps(grid, size, size, theme);
}

export function generateForestCamp(themeName: DungeonThemeName = 'classic', size: number = 20) {
  pushHistory();
  clearMapElements();
  
  const theme = mapStore.dungeonThemes[themeName];
  mapStore.backgroundType = 'texture';
  mapStore.backgroundTexture = 'topdown_grass';
  mapStore.backgroundTextureScale = 1.0;
  mapStore.foregroundOpacity = 0.0; // cacher la terre pour voir l'herbe
  
  const grid: CellType[][] = Array(size).fill(null).map(() => Array(size).fill('void'));
  
  const mid = Math.floor(size / 2);
  
  // Feu de camp central
  grid[mid][mid] = 'campfire';
  
  // Sièges / Bûches autour du feu
  grid[mid - 1][mid] = 'chair';
  grid[mid + 1][mid] = 'chair';
  grid[mid][mid - 1] = 'chair';
  grid[mid][mid + 1] = 'chair';
  
  // Tents / Lits de camp disposés autour
  grid[mid - 3][mid - 2] = 'bed'; // Tente gauche
  grid[mid + 3][mid + 2] = 'bed'; // Tente droite
  grid[mid - 2][mid + 3] = 'bed'; // Tente bas
  grid[mid + 2][mid - 3] = 'bed'; // Tente haut
  
  // Caisses et provisions
  grid[mid - 4][mid - 1] = 'chest';
  grid[mid + 4][mid + 1] = 'chest';
  
  // Bordures sauvages (lisière de forêt d'arbres et rochers)
  for (let c = 0; c < size; c++) {
    for (let r = 0; r < size; r++) {
      const dist = Math.sqrt(Math.pow(c - mid, 2) + Math.pow(r - mid, 2));
      
      if (c === 0 || c === size - 1 || r === 0 || r === size - 1) {
        grid[c][r] = Math.random() < 0.85 ? 'tree' : 'rock';
      } else if (c === 1 || c === size - 2 || r === 1 || r === size - 2) {
        if (Math.random() < 0.75) {
          grid[c][r] = Math.random() < 0.85 ? 'tree' : 'rock';
        }
      } else if (dist > 4.5 && grid[c][r] === 'void') {
        // Arbres et rochers clairsemés à l'intérieur
        if (Math.random() < 0.16) {
          grid[c][r] = 'tree';
        } else if (Math.random() < 0.05) {
          grid[c][r] = 'rock';
        }
      }
    }
  }
  
  instantiateGridStamps(grid, size, size, theme);
}

function wallTheme(theme: any): { fillColor: string; fillTexture: string; strokeColor: string } {
  const isDirt = theme.floorTexture === 'dirt';
  const isPrison = theme.wall?.includes('drno') || theme.wall?.includes('codly');
  if (isDirt) return { fillColor: '#1e1a0e', fillTexture: 'dirt',  strokeColor: '#0e0c06' };
  if (isPrison) return { fillColor: '#1c1a22', fillTexture: 'stone', strokeColor: '#0c0a12' };
  return { fillColor: '#2a2018', fillTexture: 'stone', strokeColor: '#140e08' };
}

export function computeVttWallsAndLights(
  grid: CellType[][],
  cols: number,
  rows: number,
  startX: number,
  startY: number,
  gSize: number
) {
  const walls: any[] = [];
  const lights: any[] = [];

  const isFloor = (c: number, r: number) => {
    if (c < 0 || c >= cols || r < 0 || r >= rows) return false;
    const cell = grid[c][r];
    return cell !== 'void' && cell !== 'wall';
  };

  // 1. Murs horizontaux (sur les frontières entre r et r+1, et r=0 / r=rows)
  for (let r = 0; r <= rows; r++) {
    let segStart: number | null = null;
    for (let c = 0; c < cols; c++) {
      const topFloor = isFloor(c, r - 1);
      const bottomFloor = isFloor(c, r);
      const isBoundary = topFloor !== bottomFloor;

      if (isBoundary) {
        if (segStart === null) segStart = c;
      } else {
        if (segStart !== null) {
          walls.push({
            id: `wall_h_${segStart}_${c}_${r}`,
            points: [
              { x: Math.round(startX + segStart * gSize), y: Math.round(startY + r * gSize) },
              { x: Math.round(startX + c * gSize), y: Math.round(startY + r * gSize) }
            ],
            type: 'opaque'
          });
          segStart = null;
        }
      }
    }
    if (segStart !== null) {
      walls.push({
        id: `wall_h_${segStart}_${cols}_${r}`,
        points: [
          { x: Math.round(startX + segStart * gSize), y: Math.round(startY + r * gSize) },
          { x: Math.round(startX + cols * gSize), y: Math.round(startY + r * gSize) }
        ],
        type: 'opaque'
      });
    }
  }

  // 2. Murs verticaux (sur les frontières entre c et c+1, et c=0 / c=cols)
  for (let c = 0; c <= cols; c++) {
    let segStart: number | null = null;
    for (let r = 0; r < rows; r++) {
      const leftFloor = isFloor(c - 1, r);
      const rightFloor = isFloor(c, r);
      const isBoundary = leftFloor !== rightFloor;

      if (isBoundary) {
        if (segStart === null) segStart = r;
      } else {
        if (segStart !== null) {
          walls.push({
            id: `wall_v_${c}_${segStart}_${r}`,
            points: [
              { x: Math.round(startX + c * gSize), y: Math.round(startY + segStart * gSize) },
              { x: Math.round(startX + c * gSize), y: Math.round(startY + r * gSize) }
            ],
            type: 'opaque'
          });
          segStart = null;
        }
      }
    }
    if (segStart !== null) {
      walls.push({
        id: `wall_v_${c}_${segStart}_${rows}`,
        points: [
          { x: Math.round(startX + c * gSize), y: Math.round(startY + segStart * gSize) },
          { x: Math.round(startX + c * gSize), y: Math.round(startY + rows * gSize) }
        ],
        type: 'opaque'
      });
    }
  }

  // 3. Portes & Sources de lumière dynamiques
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const cell = grid[c][r];
      const cx = Math.round(startX + (c + 0.5) * gSize);
      const cy = Math.round(startY + (r + 0.5) * gSize);

      if (cell === 'door') {
        const hasLeftWall = c > 0 && grid[c - 1][r] === 'wall';
        const hasRightWall = c < cols - 1 && grid[c + 1][r] === 'wall';
        if (hasLeftWall || hasRightWall) {
          walls.push({
            id: `door_${c}_${r}`,
            points: [
              { x: Math.round(startX + c * gSize), y: cy },
              { x: Math.round(startX + (c + 1) * gSize), y: cy }
            ],
            type: 'door',
            isOpen: false
          });
        } else {
          walls.push({
            id: `door_${c}_${r}`,
            points: [
              { x: cx, y: Math.round(startY + r * gSize) },
              { x: cx, y: Math.round(startY + (r + 1) * gSize) }
            ],
            type: 'door',
            isOpen: false
          });
        }
      } else if (cell === 'brazier') {
        lights.push({
          id: `light_brazier_${c}_${r}`,
          x: cx,
          y: cy,
          radius: 190,
          color: '#f59e0b',
          intensity: 0.85,
          flicker: true,
          type: 'torch',
          label: 'Braséro'
        });
      } else if (cell === 'campfire') {
        lights.push({
          id: `light_campfire_${c}_${r}`,
          x: cx,
          y: cy,
          radius: 220,
          color: '#ea580c',
          intensity: 0.9,
          flicker: true,
          type: 'campfire',
          label: 'Feu de camp'
        });
      } else if (cell === 'altar') {
        lights.push({
          id: `light_altar_${c}_${r}`,
          x: cx,
          y: cy,
          radius: 130,
          color: '#fef08a',
          intensity: 0.65,
          flicker: true,
          type: 'candle',
          label: 'Bougies d\'autel'
        });
      }
    }
  }

  mapStore.vttWalls = walls;
  mapStore.vttLights = lights;
}

function instantiateGridStamps(grid: CellType[][], cols: number, rows: number, theme: any) {
  if (typeof window !== 'undefined' && (window as any).sculptDungeonFloor) {
    (window as any).sculptDungeonFloor(grid, cols, rows, theme.floorTexture === 'dirt' ? 'cave' : 'classic');
    // Peindre la texture de sol sur toute la surface (sinon le masque est sculpt§ mais le sol reste vide)
    if ((window as any).fillLandTexture) {
      (window as any).fillLandTexture(theme.floorTexture || 'paving');
    }
  } else {
    if (typeof window !== 'undefined' && (window as any).fillLandMask) {
      (window as any).fillLandMask();
      if ((window as any).fillLandTexture) {
        (window as any).fillLandTexture(theme.floorTexture || 'paving');
      }
    }
  }

  const gSize = mapStore.gridSize;
  const stampsList = [];
  const shapesList: any[] = [];
  const wTheme = wallTheme(theme);

  const startX = (mapStore.canvasWidth - cols * gSize) / 2;
  const startY = (mapStore.canvasHeight - rows * gSize) / 2;

  const isFloor = (cellType: CellType) => {
    return cellType === 'floor_stone' || cellType === 'floor_dirt' || cellType === 'water' || cellType === 'door' || 
           cellType === 'chest' || cellType === 'pillar' || cellType === 'stairs_up' || 
           cellType === 'stairs_down' || cellType === 'table' || cellType === 'chair' || 
           cellType === 'bar' || cellType === 'campfire' || cellType === 'bed' ||
           cellType === 'altar' || cellType === 'sarcophagus' || cellType === 'bookshelf' ||
           cellType === 'brazier' || cellType === 'statue' || cellType === 'trap';
  };

  const hasBarOrTable = grid.some(row => row.some(cell => cell === 'bar' || cell === 'table'));
  const hasCampfire = grid.some(row => row.some(cell => cell === 'campfire'));
  const hasTrees = grid.some(row => row.some(cell => cell === 'tree'));

  // Parcourir la grille pour instancier les éléments de manière cohérente et structurée
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const cell = grid[c][r];

      if (cell === 'void' || cell === 'floor_stone' || cell === 'floor_dirt') continue;

      if (cell === 'water') {
        const x0 = startX + c * gSize;
        const y0 = startY + r * gSize;
        shapesList.push({
          id: Math.random().toString(36).slice(2),
          type: 'rectangle',
          points: [{ x: x0, y: y0 }, { x: x0 + gSize, y: y0 + gSize }],
          fillColor: '#0369a1',
          fillOpacity: 0.85,
          fillTexture: 'water',
          fillTextureScale: 1.0,
          strokeColor: '#0284c7',
          strokeWidth: 0,
          strokeDash: 'solid'
        });
        continue;
      }

      let type = '';
      let scale = 1.0;
      let rotation = 0;
      let zIndex = 1;
      let shadowEnabled = true;
      let shadowBlur = 6;
      let shadowColor = 'rgba(0, 0, 0, 0.45)';
      let shadowOffsetX = 2;
      let shadowOffsetY = 4;

      if (cell === 'wall') {
        const x0 = startX + c * gSize;
        const y0 = startY + r * gSize;

        // Bloc de remplissage de mur
        shapesList.push({
          id: Math.random().toString(36).slice(2),
          type: 'rectangle',
          points: [{ x: x0, y: y0 }, { x: x0 + gSize, y: y0 + gSize }],
          fillColor: wTheme.fillColor,
          fillOpacity: 1.0,
          fillTexture: 'wall',
          fillTextureScale: 1.0,
          strokeColor: 'transparent',
          strokeWidth: 0,
          strokeDash: 'solid'
        });

        // Détecter si le mur est sur le pourtour d'une pièce pour placer la bordure de mur orientée
        const hasTopFloor = r > 0 && isFloor(grid[c][r - 1]);
        const hasBottomFloor = r < rows - 1 && isFloor(grid[c][r + 1]);
        const hasLeftFloor = c > 0 && isFloor(grid[c - 1][r]);
        const hasRightFloor = c < cols - 1 && isFloor(grid[c + 1][r]);
        const isPerimeter = hasTopFloor || hasBottomFloor || hasLeftFloor || hasRightFloor;

        const wallAsset = theme.wall || 'td_wall';
        if (isPerimeter && wallAsset) {
          let wRot = 0;
          let wType = wallAsset;

          // Autotiling intelligent : coins et orientation
          if (hasTopFloor && hasLeftFloor && theme.wall_tl) {
            wType = theme.wall_tl;
          } else if (hasTopFloor && hasRightFloor && theme.wall_tr) {
            wType = theme.wall_tr;
          } else if (hasBottomFloor && hasLeftFloor && theme.wall_bl) {
            wType = theme.wall_bl;
          } else if (hasBottomFloor && hasRightFloor && theme.wall_br) {
            wType = theme.wall_br;
          } else if (hasLeftFloor || hasRightFloor) {
            wType = theme.wall_v || wallAsset;
            wRot = 90;
          } else {
            wType = wallAsset;
            wRot = 0;
          }

          const wScale = (gSize * 1.0) / sNative(wType);
          stampsList.push({
            id: Math.random().toString(36).slice(2),
            type: wType,
            x: x0 + gSize / 2,
            y: y0 + gSize / 2,
            scale: wScale,
            rotation: wRot,
            opacity: 1.0,
            zIndex: 1,
            shadowEnabled: true,
            shadowBlur: 6,
            shadowColor: 'rgba(0, 0, 0, 0.45)',
            shadowOffsetX: 2,
            shadowOffsetY: 4
          });
        }
        continue;
      } else if (cell === 'door') {
        type = theme.door || 'td_door';
        scale = (gSize * 0.95) / sNative(type);

        // Orienter la porte selon l'axe du mur adjacent
        const hasLeftWall = c > 0 && grid[c - 1][r] === 'wall';
        const hasRightWall = c < cols - 1 && grid[c + 1][r] === 'wall';
        rotation = (hasLeftWall || hasRightWall) ? 0 : 90;
      } else if (cell === 'chest') {
        type = theme.chest || 'td_chest';
        scale = (gSize * 0.75) / sNative(type);

        // Orienter le coffre contre le mur le plus proche
        if (r > 0 && grid[c][r - 1] === 'wall') rotation = 0;
        else if (r < rows - 1 && grid[c][r + 1] === 'wall') rotation = 180;
        else if (c > 0 && grid[c - 1][r] === 'wall') rotation = -90;
        else if (c < cols - 1 && grid[c + 1][r] === 'wall') rotation = 90;
      } else if (cell === 'pillar') {
        type = theme.pillar || 'td_pillar';
        scale = (gSize * 0.85) / sNative(type);
      } else if (cell === 'stairs_up') {
        if (hasBarOrTable) {
          type = 'td_campfire'; // Cheminée chaleureuse dans une taverne
          scale = (gSize * 0.85) / 80;
          rotation = 180;
        } else {
          type = theme.stairs_up || 'td_stairs_up';
          scale = (gSize * 0.9) / sNative(type);
        }
      } else if (cell === 'stairs_down') {
        type = theme.stairs_down || 'td_stairs_down';
        scale = (gSize * 0.9) / sNative(type);
      } else if (cell === 'table') {
        type = 'td_table';
        scale = (gSize * 0.85) / 80;
        shadowBlur = 5;
      } else if (cell === 'chair') {
        type = 'td_chair';
        scale = (gSize * 0.55) / 80;
        shadowBlur = 3;
        shadowOffsetX = 1;
        shadowOffsetY = 2;

        // Orienter la chaise vers la table ou le bar adjacent
        if (c > 0 && (grid[c - 1][r] === 'table' || grid[c - 1][r] === 'bar')) rotation = 180;
        else if (c < cols - 1 && (grid[c + 1][r] === 'table' || grid[c + 1][r] === 'bar')) rotation = 0;
        else if (r > 0 && (grid[c][r - 1] === 'table' || grid[c][r - 1] === 'bar')) rotation = 90;
        else if (r < rows - 1 && (grid[c][r + 1] === 'table' || grid[c][r + 1] === 'bar')) rotation = -90;
      } else if (cell === 'bar') {
        type = 'td_bar';
        scale = (gSize * 0.95) / 80;
        rotation = 0;
        shadowBlur = 6;
        shadowOffsetX = 2;
        shadowOffsetY = 4;
      } else if (cell === 'campfire') {
        type = 'td_campfire';
        scale = (gSize * 0.85) / 80;
        rotation = Math.random() * 360;
        shadowBlur = 12;
        shadowColor = 'rgba(230, 126, 34, 0.35)';
      } else if (cell === 'tree') {
        // Uniquement de vrais arbres harmonieux (sapin ou chêne)
        type = Math.random() < 0.6 ? 'td_tree_pine' : 'td_tree_oak';
        scale = (gSize * (1.1 + Math.random() * 0.3)) / 80;
        rotation = Math.floor(Math.random() * 360);
        zIndex = 3;
        shadowBlur = 10;
        shadowOffsetX = 4;
        shadowOffsetY = 6;
      } else if (cell === 'rock') {
        type = 'td_rock';
        scale = (gSize * (0.8 + Math.random() * 0.35)) / 80;
        rotation = Math.floor(Math.random() * 360);
        shadowBlur = 6;
        shadowOffsetX = 2;
        shadowOffsetY = 4;
      } else if (cell === 'bed') {
        const isCampLayout = grid.some(row => row.some(cell => cell === 'campfire')) || grid.some(row => row.some(cell => cell === 'tree'));
        if (isCampLayout) {
          type = 'td_tent';
          scale = (gSize * 1.05) / 80;
          zIndex = 2;
          shadowBlur = 10;
          shadowOffsetX = 3;
          shadowOffsetY = 5;

          const midC = Math.floor(cols / 2);
          const midR = Math.floor(rows / 2);
          rotation = Math.atan2(midR - r, midC - c) * (180 / Math.PI) - 90;
        } else {
          type = 'td_bed';
          scale = (gSize * 0.85) / 80;
          zIndex = 2;
          shadowBlur = 5;
          shadowOffsetX = 3;
          shadowOffsetY = 5;

          if (c === cols - 3) rotation = -90;
          else if (c === 2) rotation = 90;
        }
      } else if (cell === 'altar') {
        type = 'td_altar';
        scale = (gSize * 0.95) / 80;
        shadowBlur = 8;
      } else if (cell === 'sarcophagus') {
        type = 'td_sarcophagus';
        scale = (gSize * 0.95) / 80;
        shadowBlur = 8;
        if (r > 0 && grid[c][r - 1] === 'wall') rotation = 0;
        else if (r < rows - 1 && grid[c][r + 1] === 'wall') rotation = 180;
        else if (c > 0 && grid[c - 1][r] === 'wall') rotation = 90;
        else if (c < cols - 1 && grid[c + 1][r] === 'wall') rotation = -90;
      } else if (cell === 'bookshelf') {
        type = 'td_bookshelf';
        scale = (gSize * 0.95) / 80;
        shadowBlur = 6;
        if (r > 0 && grid[c][r - 1] === 'wall') rotation = 0;
        else if (r < rows - 1 && grid[c][r + 1] === 'wall') rotation = 180;
        else if (c > 0 && grid[c - 1][r] === 'wall') rotation = 90;
        else if (c < cols - 1 && grid[c + 1][r] === 'wall') rotation = -90;
      } else if (cell === 'brazier') {
        type = 'td_brazier';
        scale = (gSize * 0.85) / 80;
        shadowBlur = 12;
        shadowColor = 'rgba(245, 158, 11, 0.4)';
      } else if (cell === 'statue') {
        type = 'td_statue';
        scale = (gSize * 0.9) / 80;
        shadowBlur = 8;
      } else if (cell === 'trap') {
        type = 'td_trap';
        scale = (gSize * 0.85) / 80;
        shadowBlur = 4;
      }

      if (!type) continue;

      let px = startX + (c + 0.5) * gSize;
      let py = startY + (r + 0.5) * gSize;

      stampsList.push({
        id: Math.random().toString(36).slice(2),
        type,
        x: px,
        y: py,
        scale,
        rotation,
        opacity: 1.0,
        zIndex,
        shadowEnabled,
        shadowBlur,
        shadowColor,
        shadowOffsetX,
        shadowOffsetY
      });
    }
  }

  mapStore.stamps = stampsList;
  mapStore.shapes = shapesList;

  // Calculer automatiquement les murs d'occlusion et les lumières pour la table virtuelle
  computeVttWallsAndLights(grid, cols, rows, startX, startY, gSize);

  // Ambiance automatique de donjon si activée
  if (mapStore.dungeonAutoAtmosphere) {
    mapStore.atmospherePreset = 'dungeon';
    mapStore.vignetteEnabled = true;
    mapStore.vignetteOpacity = 0.55;
  }

  mapStore.zoom = 0.8;
  mapStore.panX = (mapStore.canvasWidth / 2) * -0.8 + 400;
  mapStore.panY = (mapStore.canvasHeight / 2) * -0.8 + 300;
}

function preprocessLine(line: string, size: number): string {
  const trimmed = line.trim();
  if (!trimmed) return "";
  
  let spaces = 0;
  for (const c of trimmed) {
    if (c === ' ') spaces++;
  }
  
  // Si la grille est séparée par des espaces (longueur grande et proportion d'espaces élevée)
  if (trimmed.length >= size * 1.4 || (trimmed.length > size && (spaces / trimmed.length) > 0.3)) {
    const parts = trimmed.split(' ');
    let reconstructed = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === '') {
        reconstructed += ' ';
      } else {
        reconstructed += part;
      }
    }
    return reconstructed;
  }
  
  return trimmed;
}

function parseAiGrid(text: string, size: number): CellType[][] | null {
  // Supprimer les \r et séparer par lignes
  const lines = text.replace(/\r/g, '').split('\n');
  
  const allowedChars = new Set(['#', '.', ',', ' ', 'D', 'C', 'P', 'U', 'd', 'W', 'T', 'c', 'B', 'F', 't', 'r', 'b', 'A', 'S', 'k', 'Z', 'X', '^']);
  const structuralChars = new Set(['#', '.', ',', 'D', 'C', 'P', 'U', 'd', 'W', 'T', 'c', 'B', 'F', 't', 'r', 'b', 'A', 'S', 'k', 'Z', 'X', '^']);
  
  let gridLines: string[] = [];
  for (const rawLine of lines) {
    const cleanLine = preprocessLine(rawLine, size);
    if (!cleanLine) continue;
    
    let validCount = 0;
    let hasStructure = false;
    for (const char of cleanLine) {
      if (allowedChars.has(char)) {
        validCount++;
      }
      if (structuralChars.has(char)) {
        hasStructure = true;
      }
    }
    
    if (hasStructure && (validCount / cleanLine.length) > 0.8) {
      const formattedLine = cleanLine.slice(0, size).padEnd(size, '#');
      gridLines.push(formattedLine);
    }
  }

  if (gridLines.length === 0) {
    return null;
  }

  if (gridLines.length < size) {
    while (gridLines.length < size) {
      gridLines.push('#'.repeat(size));
    }
  } else if (gridLines.length > size) {
    gridLines = gridLines.slice(0, size);
  }

  const charToCellType: Record<string, CellType> = {
    '#': 'wall',
    '.': 'floor_stone',
    ',': 'floor_dirt',
    ' ': 'void',
    'D': 'door',
    'C': 'chest',
    'P': 'pillar',
    'U': 'stairs_up',
    'd': 'stairs_down',
    'W': 'water',
    'T': 'table',
    'c': 'chair',
    'B': 'bar',
    'F': 'campfire',
    't': 'tree',
    'r': 'rock',
    'b': 'bed',
    'A': 'altar',
    'S': 'sarcophagus',
    'k': 'bookshelf',
    'Z': 'brazier',
    'X': 'statue',
    '^': 'trap'
  };

  const grid: CellType[][] = Array(size).fill(null).map(() => Array(size).fill('wall'));

  for (let c = 0; c < size; c++) {
    for (let r = 0; r < size; r++) {
      const char = gridLines[r]?.[c] || '#';
      grid[c][r] = charToCellType[char] || 'wall';
    }
  }

  return grid;
}

export async function generateAiDungeon(
  themeName: DungeonThemeName,
  promptText: string,
  size: number,
  modelName: string
) {
  pushHistory();
  clearMapElements();
  applyThemeFloor(themeName);

  const theme = mapStore.dungeonThemes[themeName];

  const systemPrompt = `Tu es un cartographe expert pour jeux de rôle (JDR) fantastiques. 
Ton rôle est de concevoir des plans de cartes équilibrés, intéressants et esthétiques sous forme de grille de caractères bidimensionnelle.
Tu dois générer exactement une grille de ${size} lignes par ${size} colonnes.

Utilise EXCLUSIVEMENT les caractères suivants :
# : Mur (pour délimiter les pièces et les obstacles)
. : Sol en pierre (pour les pièces, couloirs)
, : Sol en terre (pour les zones naturelles, grottes, chemins)
  : Vide (espace de vide ou gouffre)
D : Porte (à placer sur un mur menant à une pièce)
C : Coffre au trésor (contenant des récompenses)
P : Pilier (soutien de structure)
U : Escalier montant / Entrée de la carte
d : Escalier descendant / Sortie de la carte
W : Eau (rivière, lac, fosse)
T : Table (pour meubler les pièces)
c : Chaise (autour d'une table ou d'un bar)
B : Comptoir de bar
F : Feu de camp
t : Arbre (pour l'extérieur)
r : Rocher
b : Lit (dans les dortoirs ou chambres)
A : Autel sacré (dans sanctuaire ou salle de boss)
S : Sarcophage (dans les cryptes ou tombes)
k : Bibliothèque (dans les salles d'étude)
Z : Braséro de feu
X : Statue monumentale
^ : Dalle piégée

Règles de structure importantes :
1. La grille doit faire EXACTEMENT ${size} lignes et ${size} colonnes. Pas une de plus, pas une de moins.
2. Chaque ligne doit contenir EXACTEMENT ${size} caractères. Les caractères doivent se suivre DIRECTEMENT sans aucun espace de séparation (ex: '#####', et NON '# # # # #').
3. Assure-toi que la carte est jouable : l'entrée (U) et la sortie (d) doivent être présentes et connectées par des chemins de sol (. ou ,).
4. Place judicieusement les portes (D) pour séparer les pièces.
5. Ajoute des meubles et décors (A, S, k, Z, X, ^, T, c, b, C, P) pour donner de la vie et de la narration aux pièces.
6. Renvoie uniquement la grille brute de caractères. Ne mets aucun texte avant ou après. N'utilise pas de bloc de code markdown.
7. IMPORTANT : N'ajoute aucun espace de séparation entre les caractères. Les caractères doivent se suivre directement sans aucun espace (ex: '#####', et NON '# # # # #').`;

  const responseText = await invoke<string>('ask_ollama', {
    prompt: promptText,
    model: modelName,
    systemPrompt: systemPrompt
  });

  if (!responseText || typeof responseText !== 'string') {
    throw new Error("Réponse de l'IA vide ou invalide.");
  }

  const grid = parseAiGrid(responseText, size);
  if (!grid) {
    throw new Error("Impossible de décoder la carte générée par l'IA. Vérifiez que le modèle est opérationnel.");
  }

  // Détection d'un agencement extérieur / nature (Campement ou Forêt)
  const promptLower = promptText.toLowerCase();
  const isOutdoor = 
    promptLower.includes('camp') || 
    promptLower.includes('forêt') || 
    promptLower.includes('forest') || 
    promptLower.includes('arbre') || 
    promptLower.includes('pin') || 
    promptLower.includes('rocher') || 
    promptLower.includes('nature') || 
    promptLower.includes('herbe') || 
    promptLower.includes('clairière') || 
    promptLower.includes('dehors') || 
    promptLower.includes('outdoor') ||
    grid.some(row => row.some(cell => cell === 'campfire' || cell === 'tree' || cell === 'rock'));

  if (isOutdoor) {
    // Trouver les portes pour préserver les murs structurels de bâtiments (ex: cabanes, ruines)
    const doorPositions: [number, number][] = [];
    for (let c = 0; c < size; c++) {
      for (let r = 0; r < size; r++) {
        if (grid[c][r] === 'door') {
          doorPositions.push([c, r]);
        }
      }
    }

    // Convertir les murs de bordure/clôture en arbres/rochers, et les sols en pierre en terre
    for (let c = 0; c < size; c++) {
      for (let r = 0; r < size; r++) {
        if (grid[c][r] === 'wall') {
          let nearDoor = false;
          for (const [dc, dr] of doorPositions) {
            const dist = Math.max(Math.abs(c - dc), Math.abs(r - dr));
            if (dist <= 3) {
              nearDoor = true;
              break;
            }
          }
          if (!nearDoor) {
            grid[c][r] = Math.random() < 0.75 ? 'tree' : 'rock';
          }
        }
        if (grid[c][r] === 'floor_stone') {
          grid[c][r] = 'floor_dirt';
        }
      }
    }
  }

  instantiateGridStamps(grid, size, size, theme);

  // Appliquer les configurations de texture et d'arrière-plan post-instanciation
  if (isOutdoor) {
    const hasBarOrTable = grid.some(row => row.some(cell => cell === 'bar' || cell === 'table'));
    mapStore.backgroundType = 'texture';
    mapStore.backgroundTexture = 'topdown_grass';
    mapStore.backgroundTextureScale = 1.0;
    mapStore.paintTexture = hasBarOrTable ? 'wood' : 'dirt';
    mapStore.foregroundOpacity = 1.0;
  } else {
    const hasBarOrTable = grid.some(row => row.some(cell => cell === 'bar' || cell === 'table'));
    if (hasBarOrTable) {
      mapStore.paintTexture = themeName === 'cave' ? 'dirt' : 'wood';
      mapStore.foregroundOpacity = 1.0;
    }
  }
}

