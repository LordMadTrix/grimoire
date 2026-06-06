import { mapStore, pushHistory } from './stores/mapStore.svelte';
import importedStamps from './imported_stamps.json';
import { invoke } from '@tauri-apps/api/core';


// Types de tuiles pour la génération
export type CellType = 'void' | 'floor_stone' | 'floor_dirt' | 'wall' | 'door' | 'chest' | 'pillar' | 'stairs_up' | 'stairs_down' | 'water' | 'table' | 'chair' | 'bar' | 'campfire' | 'tree' | 'rock' | 'bed';

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

function instantiateGridStamps(grid: CellType[][], cols: number, rows: number, theme: any) {
  if (typeof window !== 'undefined' && (window as any).sculptDungeonFloor) {
    (window as any).sculptDungeonFloor(grid, cols, rows, theme.floorTexture === 'dirt' ? 'cave' : 'classic');
  } else {
    if (typeof window !== 'undefined' && (window as any).fillLandMask) {
      (window as any).fillLandMask();
    }
  }

  const gSize = mapStore.gridSize;
  const stampsList = [];

  const startX = (mapStore.canvasWidth - cols * gSize) / 2;
  const startY = (mapStore.canvasHeight - rows * gSize) / 2;

  const isFloor = (cellType: CellType) => {
    return cellType === 'floor_stone' || cellType === 'floor_dirt' || cellType === 'door' || cellType === 'chest' || cellType === 'pillar' || cellType === 'stairs_up' || cellType === 'stairs_down' || cellType === 'table' || cellType === 'chair' || cellType === 'bar' || cellType === 'campfire' || cellType === 'bed';
  };

  // Extraire les tampons décoratifs du sous-thème (décombres, toiles d'araignées, caisses, dalles brisées, taverne, campement)
  const isDirt = theme.floorTexture === 'dirt';
  let subcategory = isDirt ? 'Cave' : (theme.floorTexture === 'wood' || theme.wall.includes('drno') ? 'Prison' : 'Dungeons');
  
  const hasBarOrTable = grid.some(row => row.some(cell => cell === 'bar' || cell === 'table'));
  const hasCampfire = grid.some(row => row.some(cell => cell === 'campfire'));
  const hasTrees = grid.some(row => row.some(cell => cell === 'tree'));
  if (hasBarOrTable) {
    subcategory = 'Tavern';
  } else if (hasCampfire || hasTrees) {
    subcategory = 'Camp';
  }
  const themeStamps = (importedStamps as any[]).filter(s => 
    s.category === 'Fantasy Battlemaps' && s.subcategory === subcategory
  );
  const decorativeStamps = themeStamps.filter(s => 
    s.id !== theme.wall && s.id !== theme.wall_v && s.id !== theme.wall_tl && 
    s.id !== theme.wall_tr && s.id !== theme.wall_bl && s.id !== theme.wall_br &&
    s.id !== theme.door && s.id !== theme.chest && s.id !== theme.pillar && 
    s.id !== theme.stairs_up && s.id !== theme.stairs_down
  );

  // Analyser l'entourage pour faire de beaux murs droits et coins
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const cell = grid[c][r];

      // Placer aléatoirement des éléments de décors au sol (8% de chance par case de sol libre)
      if ((cell === 'floor_stone' || cell === 'floor_dirt') && decorativeStamps.length > 0) {
        if (Math.random() < 0.08) {
          const decoration = decorativeStamps[Math.floor(Math.random() * decorativeStamps.length)];
          const dx = startX + (c + 0.5) * gSize + (Math.random() - 0.5) * (gSize * 0.4);
          const dy = startY + (r + 0.5) * gSize + (Math.random() - 0.5) * (gSize * 0.4);
          const dScale = ((gSize * 0.75) / 80) * (0.6 + Math.random() * 0.45);
          const dRotation = Math.floor(Math.random() * 360);
          
          stampsList.push({
            id: Math.random().toString(36).slice(2),
            type: decoration.id,
            x: dx,
            y: dy,
            scale: dScale,
            rotation: dRotation,
            opacity: 0.65 + Math.random() * 0.35,
            zIndex: 0,
            shadowEnabled: false
          });
        }
      }

      if (cell === 'void' || cell === 'floor_stone' || cell === 'floor_dirt' || cell === 'water') continue;

      let type = '';
      let scale = 1.0;
      let rotation = 0;
      let zIndex = cell === 'wall' ? 1 : 0;
      let shadowEnabled = true;
      let shadowBlur = cell === 'wall' ? 8 : 6;
      let shadowColor = 'rgba(0, 0, 0, 0.45)';
      let shadowOffsetX = cell === 'wall' ? 3 : 2;
      let shadowOffsetY = cell === 'wall' ? 5 : 3;

      if (cell === 'wall') {
        const hasLeftFloor = c > 0 && isFloor(grid[c - 1][r]);
        const hasRightFloor = c < cols - 1 && isFloor(grid[c + 1][r]);
        const hasTopFloor = r > 0 && isFloor(grid[c][r - 1]);
        const hasBottomFloor = r < rows - 1 && isFloor(grid[c][r + 1]);

        const isEdge = hasLeftFloor || hasRightFloor || hasTopFloor || hasBottomFloor;
        if (!isEdge) continue; // Ne pas dessiner les murs intérieurs pleins

        // On augmente légèrement l'échelle pour que les images se recouvrent joliment
        scale = (gSize * 1.25) / 80;
        rotation = 0;
        zIndex = 1;
        shadowBlur = 8;
        shadowOffsetX = 3;
        shadowOffsetY = 5;

        if (hasBottomFloor && hasRightFloor) {
          type = theme.wall_tl || theme.wall;
        } else if (hasBottomFloor && hasLeftFloor) {
          type = theme.wall_tr || theme.wall;
        } else if (hasTopFloor && hasLeftFloor) {
          type = theme.wall_br || theme.wall;
        } else if (hasTopFloor && hasRightFloor) {
          type = theme.wall_bl || theme.wall;
        } else if (hasTopFloor || hasBottomFloor) {
          type = theme.wall; // Mur horizontal
        } else {
          type = theme.wall_v || theme.wall; // Mur vertical
        }
      } else if (cell === 'door') {
        type = theme.door;
        scale = (gSize * 1.1) / 80;
        
        // Orienter la porte vers le mur adjacent
        const hasLeftWall = c > 0 && grid[c - 1][r] === 'wall';
        const hasRightWall = c < cols - 1 && grid[c + 1][r] === 'wall';
        if (hasLeftWall || hasRightWall) {
          rotation = 0;
        } else {
          rotation = 90;
        }
      } else if (cell === 'chest') {
        type = theme.chest;
        scale = (gSize * 0.9) / 80;
      } else if (cell === 'pillar') {
        type = theme.pillar;
        scale = (gSize * 1.0) / 80;
      } else if (cell === 'stairs_up') {
        if (hasBarOrTable) {
          type = 'imported_ey1zn6h365n34btb9ivdyh221wmo'; // Cheminée
          scale = (gSize * 1.1) / 80;
          rotation = 180; // Fait face vers le bas
        } else {
          type = theme.stairs_up;
          scale = (gSize * 1.1) / 80;
        }
      } else if (cell === 'stairs_down') {
        type = theme.stairs_down;
        scale = (gSize * 1.1) / 80;
      } else if (cell === 'table') {
        type = Math.random() < 0.5 ? 'imported_K1xpMf9WmpSBVM7zckV3h1' : 'imported_RFdpd7CV3ZGpVcmn8bpcdV';
        scale = (gSize * 0.8) / 80;
        shadowBlur = 5;
      } else if (cell === 'chair') {
        type = Math.random() < 0.5 ? 'imported_A9qxwJhu4D8q15Lg1c9e3Y' : 'imported_lg4l4o5t6igjrzsgkuw2ybn1r7i1';
        scale = (gSize * 0.5) / 160;
        shadowBlur = 3;
        shadowOffsetX = 1;
        shadowOffsetY = 2;
        
        // Orienter la chaise vers la table ou le bar adjacent
        if (c > 0 && grid[c - 1][r] === 'table') rotation = 180;
        else if (c < cols - 1 && grid[c + 1][r] === 'table') rotation = 0;
        else if (r > 0 && grid[c][r - 1] === 'table') rotation = 90;
        else if (r < rows - 1 && grid[c][r + 1] === 'table') rotation = -90;
        else if (c > 0 && grid[c - 1][r] === 'bar') rotation = 180;
      } else if (cell === 'bar') {
        type = 'imported_C6AjRDX3seHHG2zBbVe3YW'; // Bar Counter rectangular table
        scale = (gSize * 0.8) / 80;
        rotation = 0;
        shadowBlur = 6;
        shadowOffsetX = 2;
        shadowOffsetY = 4;
      } else if (cell === 'campfire') {
        type = 'imported_MqWqQziNJ3cHAnsf9qo93J';
        scale = (gSize * 0.75) / 80;
        rotation = Math.random() * 360;
        shadowBlur = 12;
        shadowColor = 'rgba(230, 126, 34, 0.25)';
        shadowOffsetX = 0;
        shadowOffsetY = 0;
      } else if (cell === 'tree') {
        const forestStamps = (importedStamps as any[]).filter(s => s.category === 'Fantasy Battlemaps' && s.subcategory === 'Forest');
        if (forestStamps.length > 0) {
          type = forestStamps[Math.floor(Math.random() * forestStamps.length)].id;
        } else {
          type = Math.random() < 0.5 ? 'td_tree_pine' : 'td_tree_oak';
        }
        scale = (gSize * (1.1 + Math.random() * 0.4)) / 80;
        rotation = Math.random() * 360;
        zIndex = 3;
        shadowBlur = 10;
        shadowOffsetX = 4;
        shadowOffsetY = 6;
      } else if (cell === 'rock') {
        const rockStamps = (importedStamps as any[]).filter(s => s.category === 'Fantasy Battlemaps' && (s.subcategory === 'Cave' || s.subcategory === 'Terrain' || s.subcategory === 'Terrain 2.0'));
        if (rockStamps.length > 0) {
          type = rockStamps[Math.floor(Math.random() * rockStamps.length)].id;
        } else {
          type = 'td_rock';
        }
        scale = (gSize * (0.8 + Math.random() * 0.4)) / 80;
        rotation = Math.random() * 360;
        shadowBlur = 6;
        shadowOffsetX = 2;
        shadowOffsetY = 4;
      } else if (cell === 'bed') {
        const isCampLayout = grid.some(row => row.some(cell => cell === 'campfire')) || grid.some(row => row.some(cell => cell === 'tree')) || subcategory === 'Camp';
        if (isCampLayout) {
          const tents = [
            'imported_GAi9aFHkKy81EEtt7SmaJZ', // beige/blue
            'imported_3c3Sa1gPLHf33CS93Wgmif', // purple
            'imported_XCRZzEFuaowYKg9Wrm7RFX', // grey
            'imported_WHKfq5SVq8T24iNd3qGH75'  // blue
          ];
          type = tents[Math.floor(Math.random() * tents.length)];
          scale = (gSize * 1.15) / 80;
          zIndex = 2;
          shadowBlur = 10;
          shadowOffsetX = 3;
          shadowOffsetY = 5;

          const midC = Math.floor(cols / 2);
          const midR = Math.floor(rows / 2);
          rotation = Math.atan2(midR - r, midC - c) * (180 / Math.PI) - 90;
        } else {
          type = 'imported_v2b9xzh1pl2gw1rujvmydgq2lt3v'; // single wooden bed
          scale = (gSize * 0.9) / 80;
          zIndex = 2;
          shadowBlur = 5;
          shadowOffsetX = 3;
          shadowOffsetY = 5;

          // Lits orientés selon la disposition
          const startCol = 2;
          const endCol = cols - 3;
          if (c === endCol) rotation = -90;
          else if (c === startCol) rotation = 90;
        }
      }

      if (!type) continue;

      let px = startX + (c + 0.5) * gSize;
      let py = startY + (r + 0.5) * gSize;

      if (cell === 'wall' && theme.floorTexture === 'dirt') {
        // Grottes organiques : ajouter du jitter physique, de la rotation et échelle aléatoires
        const jitter = gSize * 0.16;
        px += (Math.random() - 0.5) * jitter;
        py += (Math.random() - 0.5) * jitter;
        scale = scale * (0.9 + Math.random() * 0.3);
        rotation = rotation + (Math.random() - 0.5) * 35;
      }

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
  
  const allowedChars = new Set(['#', '.', ',', ' ', 'D', 'C', 'P', 'U', 'd', 'W', 'T', 'c', 'B', 'F', 't', 'r', 'b']);
  const structuralChars = new Set(['#', '.', ',', 'D', 'C', 'P', 'U', 'd', 'W', 'T', 'c', 'B', 'F', 't', 'r', 'b']);
  
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
    'b': 'bed'
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

Règles de structure importantes :
1. La grille doit faire EXACTEMENT ${size} lignes et ${size} colonnes. Pas une de plus, pas une de moins.
2. Chaque ligne doit contenir EXACTEMENT ${size} caractères. Les caractères doivent se suivre DIRECTEMENT sans aucun espace de séparation (ex: '#####', et NON '# # # # #').
3. Assure-toi que la carte est jouable : l'entrée (U) et la sortie (d) doivent être présentes et connectées par des chemins de sol (. ou ,).
4. Place judicieusement les portes (D) pour séparer les pièces.
5. Ajoute des meubles comme des tables (T), des chaises (c), des lits (b), des coffres (C) et des piliers (P) pour donner de la vie et du détail aux pièces.
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

