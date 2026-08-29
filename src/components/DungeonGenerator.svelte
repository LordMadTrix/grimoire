<script lang="ts">
  import { vttStore, pushDungeonUndo, type DungeonTile, type TileType, type WallDef } from '$lib/stores/vtt.svelte';
  import { notifStore } from '$lib/stores/notifications.svelte';

  let { onclose }: { onclose: () => void } = $props();

  let dungeonType = $state<'crypt' | 'cave' | 'sewer' | 'rooms'>('crypt');
  let gridCols = $state(25);
  let gridRows = $state(20);
  let roomCount = $state(6);
  let addDecor = $state(true);
  let autoGenerateWalls = $state(true);

  let previewTiles = $state<DungeonTile[]>([]);
  let generatedStats = $state<{ rooms: number; doors: number; chests: number } | null>(null);

  function rnd(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function generateDungeon() {
    const tiles: DungeonTile[] = [];
    const map = Array.from({ length: gridRows }, () => Array(gridCols).fill('void' as TileType));

    let actualRooms = 0;
    let actualDoors = 0;
    let actualChests = 0;

    if (dungeonType === 'cave') {
      // Algorithme Automate Cellulaire pour Cavernes
      for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
          map[r][c] = (Math.random() > 0.46 || r === 0 || r === gridRows - 1 || c === 0 || c === gridCols - 1) ? 'wall_stone' : 'floor_dirt';
        }
      }
      // 3 itérations de lissage
      for (let step = 0; step < 3; step++) {
        const next = Array.from({ length: gridRows }, () => Array(gridCols).fill('void' as TileType));
        for (let r = 1; r < gridRows - 1; r++) {
          for (let c = 1; c < gridCols - 1; c++) {
            let wallNeighbors = 0;
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                if (map[r + dr][c + dc] === 'wall_stone') wallNeighbors++;
              }
            }
            next[r][c] = wallNeighbors >= 5 ? 'wall_stone' : 'floor_dirt';
          }
        }
        for (let r = 1; r < gridRows - 1; r++) {
          for (let c = 1; c < gridCols - 1; c++) {
            map[r][c] = next[r][c];
          }
        }
      }
      actualRooms = 1;
    } else {
      // Salles & Couloirs classiques (Cryptes, Donjons, Égouts)
      const floorType: TileType = dungeonType === 'sewer' ? 'floor_stone' : dungeonType === 'crypt' ? 'floor_wood' : 'floor_stone';
      const wallType: TileType = dungeonType === 'crypt' ? 'wall_wood' : 'wall_stone';

      // 1. Remplir de murs
      for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
          map[r][c] = wallType;
        }
      }

      // 2. Placer des salles
      const rooms: { x: number; y: number; w: number; h: number }[] = [];
      for (let i = 0; i < roomCount; i++) {
        const w = rnd(4, 7);
        const h = rnd(4, 6);
        const x = rnd(1, gridCols - w - 1);
        const y = rnd(1, gridRows - h - 1);

        // Vérifier chevauchement
        const overlap = rooms.some(r => !(x + w + 1 < r.x || x > r.x + r.w + 1 || y + h + 1 < r.y || y > r.y + r.h + 1));
        if (!overlap) {
          rooms.push({ x, y, w, h });
          for (let r = y; r < y + h; r++) {
            for (let c = x; c < x + w; c++) {
              map[r][c] = floorType;
            }
          }
          actualRooms++;
        }
      }

      // 3. Relier les salles par des couloirs
      for (let i = 0; i < rooms.length - 1; i++) {
        const r1 = rooms[i];
        const r2 = rooms[i + 1];
        const cx1 = Math.floor(r1.x + r1.w / 2);
        const cy1 = Math.floor(r1.y + r1.h / 2);
        const cx2 = Math.floor(r2.x + r2.w / 2);
        const cy2 = Math.floor(r2.y + r2.h / 2);

        // Couloir horizontal puis vertical
        let x = cx1;
        while (x !== cx2) {
          map[cy1][x] = floorType;
          x += x < cx2 ? 1 : -1;
        }
        let y = cy1;
        while (y !== cy2) {
          map[y][cx2] = floorType;
          y += y < cy2 ? 1 : -1;
        }
      }

      // 4. Portes et décorations
      if (addDecor) {
        for (const room of rooms) {
          // Coffre dans un coin
          if (Math.random() > 0.4) {
            map[room.y + 1][room.x + 1] = 'chest';
            actualChests++;
          }
          // Torche ou porte : sur le mur périphérique nord (room.y - 1), pas sur la
          // rangée de sol intérieure (room.y fait partie du remplissage r=y..y+h-1)
          if (Math.random() > 0.3) {
            map[room.y - 1][Math.floor(room.x + room.w / 2)] = 'door_closed';
            actualDoors++;
          }
        }
      }
    }

    // Convertir la matrice en DungeonTiles
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        tiles.push({ row: r, col: c, type: map[r][c] });
      }
    }

    previewTiles = tiles;
    generatedStats = { rooms: actualRooms, doors: actualDoors, chests: actualChests };
  }

  function applyDungeonToCanvas() {
    if (previewTiles.length === 0) return;
    pushDungeonUndo();
    vttStore.dungeonTiles = [...previewTiles];

    // Génération automatique des murs LOS si demandé
    if (autoGenerateWalls) {
      const gs = vttStore.gridSize || 50;
      const walls: WallDef[] = [];

      for (const t of previewTiles) {
        if (t.type.startsWith('wall') || t.type === 'door_closed') {
          const x = t.col * gs;
          const y = t.row * gs;
          walls.push({
            id: `los_wall_${t.col}_${t.row}`,
            points: [
              { x, y },
              { x: x + gs, y },
              { x: x + gs, y: y + gs },
              { x, y: y + gs },
              { x, y }
            ],
            type: t.type === 'door_closed' ? 'door' : 'opaque',
            isOpen: false
          });
        }
      }
      vttStore.walls = walls;
      vttStore.wallsEnabled = true;
    }

    notifStore.add('success', 'Donjon déployé !', `${previewTiles.length} cases et murs LOS générés sur la table.`);
    onclose();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="dg-backdrop" onclick={onclose} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="dg-modal" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
    <div class="dg-header">
      <span>🏰 Générateur Procédural de Donjon & Murs</span>
      <button class="dg-close" onclick={onclose}>×</button>
    </div>

    <div class="dg-controls">
      <div class="dg-row">
        <label class="dg-label">Type de lieu
          <select bind:value={dungeonType} class="dg-select">
            <option value="crypt">⚰️ Crypte / Catacombes</option>
            <option value="rooms">🏰 Donjon Médiéval</option>
            <option value="sewer">🐀 Égouts & Canaux</option>
            <option value="cave">⛰️ Caverne Naturelle</option>
          </select>
        </label>
        <label class="dg-label">Salles
          <input type="number" class="dg-input" bind:value={roomCount} min="3" max="15" />
        </label>
      </div>

      <div class="dg-row">
        <label class="dg-label">Colonnes
          <input type="number" class="dg-input" bind:value={gridCols} min="10" max="60" />
        </label>
        <label class="dg-label">Lignes
          <input type="number" class="dg-input" bind:value={gridRows} min="10" max="60" />
        </label>
      </div>

      <div class="dg-check-row">
        <label class="dg-check">
          <input type="checkbox" bind:checked={addDecor} />
          📦 Meubler (Portes, Coffres, Torches)
        </label>
        <label class="dg-check">
          <input type="checkbox" bind:checked={autoGenerateWalls} />
          🧱 Tracer Murs LOS automatiquement
        </label>
      </div>

      <button class="dg-btn dg-btn-roll" onclick={generateDungeon}>🎲 Générer Plan Procédural</button>
    </div>

    {#if generatedStats}
      <div class="dg-stats-box">
        <span>🏛️ Salles : <strong>{generatedStats.rooms}</strong></span>
        <span>🚪 Portes : <strong>{generatedStats.doors}</strong></span>
        <span>💰 Coffres : <strong>{generatedStats.chests}</strong></span>
      </div>
    {/if}

    <!-- Aperçu Mini-Map -->
    {#if previewTiles.length > 0}
      <div class="dg-preview-wrap">
        <div class="dg-preview-title">Aperçu du Plan :</div>
        <div
          class="dg-mini-grid"
          style="grid-template-columns: repeat({gridCols}, 1fr);"
        >
          {#each previewTiles as tile}
            <div
              class="dg-mini-cell"
              class:wall={tile.type.startsWith('wall')}
              class:floor={tile.type.startsWith('floor')}
              class:chest={tile.type === 'chest'}
              class:door={tile.type.startsWith('door')}
              title="{tile.type} ({tile.col},{tile.row})"
            ></div>
          {/each}
        </div>
      </div>
    {/if}

    <div class="dg-actions">
      <button class="dg-btn dg-sec" onclick={onclose}>Annuler</button>
      <button class="dg-btn dg-pri" onclick={applyDungeonToCanvas} disabled={previewTiles.length === 0}>
        🗺️ Déployer sur le VTT
      </button>
    </div>
  </div>
</div>

<style>
  .dg-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 2500; }
  .dg-modal { background: var(--bg-secondary, #161b22); border: 1px solid var(--border, #30363d); border-radius: 12px; width: 520px; max-width: 95vw; max-height: 90vh; display: flex; flex-direction: column; gap: 12px; padding: 18px; box-shadow: 0 16px 48px rgba(0,0,0,0.8); overflow-y: auto; }
  .dg-header { display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 700; color: var(--accent, #e5a853); border-bottom: 1px solid var(--border); padding-bottom: 8px; }
  .dg-close { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 18px; }

  .dg-controls { display: flex; flex-direction: column; gap: 10px; }
  .dg-row { display: flex; gap: 10px; }
  .dg-label { flex: 1; display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--text-muted); text-transform: uppercase; }
  .dg-select, .dg-input { background: var(--bg-tertiary, #0d1117); border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; color: white; font-size: 13px; }
  .dg-check-row { display: flex; flex-direction: column; gap: 6px; }
  .dg-check { font-size: 12px; color: var(--text-primary); cursor: pointer; display: flex; align-items: center; gap: 6px; }

  .dg-btn { padding: 9px 14px; border-radius: 8px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; }
  .dg-btn-roll { background: var(--accent, #e5a853); color: black; width: 100%; margin-top: 4px; }
  .dg-btn-roll:hover { background: #d49542; }

  .dg-stats-box { display: flex; justify-content: space-around; background: var(--bg-tertiary); padding: 8px; border-radius: 6px; border: 1px solid var(--border); font-size: 12px; color: var(--text-muted); }
  .dg-stats-box strong { color: white; }

  .dg-preview-wrap { display: flex; flex-direction: column; gap: 6px; }
  .dg-preview-title { font-size: 11px; color: var(--text-muted); text-transform: uppercase; }
  .dg-mini-grid { display: grid; background: #010409; border: 1px solid var(--border); border-radius: 6px; padding: 4px; gap: 1px; max-height: 180px; overflow: auto; }
  .dg-mini-cell { aspect-ratio: 1; border-radius: 1px; background: #090d16; }
  .dg-mini-cell.wall { background: #2d3748; }
  .dg-mini-cell.floor { background: #718096; }
  .dg-mini-cell.chest { background: #e5a853; }
  .dg-mini-cell.door { background: #60a5fa; }

  .dg-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px; }
  .dg-sec { background: var(--bg-tertiary); border: 1px solid var(--border); color: var(--text-muted); }
  .dg-pri { background: #238636; color: white; }
  .dg-pri:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
