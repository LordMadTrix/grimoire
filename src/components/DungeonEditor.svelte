<script lang="ts">
  import { onMount } from 'svelte';
  import { vttStore, clearDungeonTiles, setDungeonTile, undoMapAction, canUndo } from '$lib/stores/vtt.svelte';
  import type { TileType } from '$lib/stores/vtt.svelte';

  // All tile types with labels
  const TILE_DEFS: { type: TileType; label: string }[] = [
    { type: 'floor_stone', label: 'Sol Pierre' },
    { type: 'floor_wood',  label: 'Sol Bois' },
    { type: 'floor_dirt',  label: 'Sol Terre' },
    { type: 'wall_stone',  label: 'Mur Pierre' },
    { type: 'wall_wood',   label: 'Mur Bois' },
    { type: 'door_closed', label: 'Porte Fermée' },
    { type: 'door_open',   label: 'Porte Ouverte' },
    { type: 'stairs_down', label: 'Escaliers ↓' },
    { type: 'stairs_up',   label: 'Escaliers ↑' },
    { type: 'pillar',      label: 'Pilier' },
    { type: 'water',       label: 'Eau' },
    { type: 'lava',        label: 'Lave' },
    { type: 'void',        label: 'Vide/Effacer' },
    { type: 'chest',       label: 'Coffre' },
    { type: 'trap',        label: 'Piège' },
  ];

  // Refs for canvas palette elements — one slot per tile type
  let canvasRefs: Partial<Record<TileType, HTMLCanvasElement>> = {};

  function drawTilePreview(canvas: HTMLCanvasElement, type: TileType) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = 48;
    ctx.clearRect(0, 0, s, s);

    switch (type) {
      case 'floor_stone':
        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = '#6b7280';
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(s / 2, 0); ctx.lineTo(s / 2, s);
        ctx.moveTo(0, s / 2); ctx.lineTo(s, s / 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;

      case 'floor_wood':
        ctx.fillStyle = '#92400e';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = '#b45309';
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 1; i < 4; i++) {
          ctx.moveTo(0, s * i / 4); ctx.lineTo(s, s * i / 4);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;

      case 'floor_dirt':
        ctx.fillStyle = '#d97706';
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = '#b45309';
        ctx.beginPath(); ctx.arc(s * 0.2, s * 0.3, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s * 0.7, s * 0.6, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s * 0.5, s * 0.8, 2, 0, Math.PI * 2); ctx.fill();
        break;

      case 'wall_stone':
        ctx.fillStyle = '#374151';
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = '#4b5563';
        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 1.5;
        [[2, 2, s/2-4, s/2-4], [s/2+1, 2, s/2-4, s/2-4],
         [2, s/2+1, s/2-4, s/2-4], [s/2+1, s/2+1, s/2-4, s/2-4]].forEach(([x, y, w, h]) => {
          ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);
        });
        break;

      case 'wall_wood':
        ctx.fillStyle = '#713f12';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 1; i < 4; i++) {
          ctx.moveTo(s * i / 4, 0); ctx.lineTo(s * i / 4, s);
        }
        ctx.stroke();
        break;

      case 'door_closed':
        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = '#92400e';
        ctx.fillRect(s*0.2, s*0.1, s*0.6, s*0.8);
        ctx.strokeStyle = '#713f12';
        ctx.lineWidth = 1;
        ctx.strokeRect(s*0.2, s*0.1, s*0.6, s*0.8);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath(); ctx.arc(s*0.65, s*0.5, s*0.05, 0, Math.PI*2); ctx.fill();
        break;

      case 'door_open':
        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = '#92400e';
        ctx.fillRect(s*0.05, s*0.1, s*0.15, s*0.8);
        ctx.strokeStyle = '#111827';
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        ctx.strokeRect(s*0.05, s*0.1, s*0.15, s*0.8);
        ctx.globalAlpha = 1;
        break;

      case 'stairs_down':
        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 5; i++) {
          const step = s / 5;
          ctx.fillStyle = i % 2 === 0 ? '#9ca3af' : '#6b7280';
          ctx.strokeStyle = '#4b5563';
          ctx.lineWidth = 1.5;
          ctx.fillRect(i*step*0.5, i*step, s - i*step*0.5, step);
          ctx.strokeRect(i*step*0.5, i*step, s - i*step*0.5, step);
        }
        break;

      case 'stairs_up':
        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 5; i++) {
          const step = s / 5;
          ctx.fillStyle = i % 2 === 0 ? '#9ca3af' : '#6b7280';
          ctx.strokeStyle = '#4b5563';
          ctx.lineWidth = 1.5;
          ctx.fillRect(0, i*step, s - i*step*0.5, step);
          ctx.strokeRect(0, i*step, s - i*step*0.5, step);
        }
        break;

      case 'pillar':
        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = '#4b5563';
        ctx.beginPath(); ctx.arc(s/2, s/2, s*0.35, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(s/2, s/2, s*0.35, 0, Math.PI*2); ctx.stroke();
        break;

      case 'water':
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = '#3b82f6';
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, s*0.3);
        ctx.bezierCurveTo(s*0.3, s*0.2, s*0.7, s*0.4, s, s*0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, s*0.6);
        ctx.bezierCurveTo(s*0.3, s*0.5, s*0.7, s*0.7, s, s*0.6);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;

      case 'lava':
        ctx.fillStyle = '#ea580c';
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = '#c2410c';
        ctx.beginPath(); ctx.ellipse(s*0.3, s*0.4, s*0.2, s*0.15, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(s*0.7, s*0.6, s*0.15, s*0.12, 0, 0, Math.PI*2); ctx.fill();
        break;

      case 'void':
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, s, s);
        break;

      case 'chest':
        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = '#92400e';
        ctx.fillRect(s*0.1, s*0.3, s*0.8, s*0.5);
        ctx.strokeStyle = '#713f12';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#b45309';
        ctx.fillRect(s*0.1, s*0.3, s*0.8, s*0.25);
        ctx.strokeRect(s*0.1, s*0.3, s*0.8, s*0.25);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(s*0.4, s*0.45, s*0.2, s*0.15);
        break;

      case 'trap':
        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(s*0.2, s*0.2); ctx.lineTo(s*0.8, s*0.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s*0.8, s*0.2); ctx.lineTo(s*0.2, s*0.8);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
    }
  }

  // Quick room presets
  function stampPreset(preset: string) {
    const brush = vttStore.dungeonBrush;
    const floorBrush: TileType = brush === 'void' ? 'floor_stone' : brush;

    if (preset === '3x3') {
      for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) setDungeonTile(c, r, floorBrush);
    } else if (preset === 'corridor_h') {
      for (let c = 0; c < 5; c++) setDungeonTile(c, 0, floorBrush);
    } else if (preset === 'corridor_v') {
      for (let r = 0; r < 5; r++) setDungeonTile(0, r, floorBrush);
    } else if (preset === 'room_5x5') {
      for (let c = 0; c < 5; c++) {
        for (let r = 0; r < 5; r++) {
          if (c === 0 || c === 4 || r === 0 || r === 4) setDungeonTile(c, r, 'wall_stone');
          else setDungeonTile(c, r, floorBrush);
        }
      }
    } else if (preset === 'room_8x8') {
      for (let c = 0; c < 8; c++) {
        for (let r = 0; r < 8; r++) {
          if (c === 0 || c === 7 || r === 0 || r === 7) setDungeonTile(c, r, 'wall_stone');
          else setDungeonTile(c, r, floorBrush);
        }
      }
    }
  }

  // Key shortcuts: 1-9 → first 9 tiles, 0 → 10th tile, E → erase
  const KEY_SHORTCUTS: Record<string, TileType> = Object.fromEntries([
    ...TILE_DEFS.slice(0, 9).map((t, i) => [String(i + 1), t.type]),
    ['0', TILE_DEFS[9]?.type ?? 'pillar'],
    ['e', 'void'],
    ['E', 'void'],
  ]);

  function handleKeydown(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, textarea, [contenteditable]')) return;
    const mapped = KEY_SHORTCUTS[e.key];
    if (mapped) {
      e.preventDefault();
      vttStore.dungeonBrush = mapped;
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      // Ctrl+Z handled globally, but also stop propagation here
    }
  }

  $effect(() => {
    for (const tileDef of TILE_DEFS) {
      const canvas = canvasRefs[tileDef.type];
      if (canvas) drawTilePreview(canvas, tileDef.type);
    }
  });

  // Re-draw active brush preview when selection changes
  $effect(() => {
    const active = vttStore.dungeonBrush;
    const canvas = canvasRefs['__active__' as TileType];
    if (canvas) drawTilePreview(canvas, active);
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="dungeon-editor">
  <div class="de-header">
    <span class="de-title">🏰 Éditeur de Donjon</span>
    <button class="de-close" onclick={() => { vttStore.showDungeonEditor = false; vttStore.mode = 'select'; }}>✕</button>
  </div>

  <!-- Pinceau actif affiché en grand -->
  <div class="de-active-brush">
    <canvas class="de-active-canvas" width="52" height="52"
      bind:this={canvasRefs['__active__' as TileType]}
    ></canvas>
    <div class="de-active-info">
      <span class="de-active-label">{TILE_DEFS.find(t => t.type === vttStore.dungeonBrush)?.label ?? ''}</span>
      <span class="de-active-hint">Clic gauche : peindre<br>Clic droit : effacer</span>
    </div>
  </div>

  <div class="de-section-label">Palette</div>
  <div class="de-palette">
    {#each TILE_DEFS as tile, i}
      {@const shortcut = i < 9 ? String(i + 1) : i === 9 ? '0' : ''}
      <button
        class="de-tile-btn"
        class:selected={vttStore.dungeonBrush === tile.type}
        onclick={() => vttStore.dungeonBrush = tile.type}
        title="{tile.label}{shortcut ? ` [${shortcut}]` : ''}"
      >
        {#if shortcut}
          <span class="de-key-hint">{shortcut}</span>
        {/if}
        <canvas width="44" height="44" bind:this={canvasRefs[tile.type]}></canvas>
        <span class="de-tile-label">{tile.label}</span>
      </button>
    {/each}
  </div>

  <div class="de-section-label">Salles rapides</div>
  <div class="de-presets">
    <button class="de-preset-btn" onclick={() => stampPreset('3x3')}>3×3</button>
    <button class="de-preset-btn" onclick={() => stampPreset('corridor_h')}>Couloir H</button>
    <button class="de-preset-btn" onclick={() => stampPreset('corridor_v')}>Couloir V</button>
    <button class="de-preset-btn" onclick={() => stampPreset('room_5x5')}>Salle 5×5</button>
    <button class="de-preset-btn" onclick={() => stampPreset('room_8x8')}>Salle 8×8</button>
  </div>

  <div class="de-keyboard-hint">
    <span>Clic droit ou <kbd>E</kbd> = effacer · <kbd>Ctrl+Z</kbd> = annuler</span>
  </div>

  <div class="de-footer">
    <span class="de-tile-count">{vttStore.dungeonTiles.length} tuile{vttStore.dungeonTiles.length !== 1 ? 's' : ''}</span>
    <div class="de-footer-actions">
      <button class="de-undo-btn" onclick={undoMapAction} disabled={!canUndo()} title="Annuler (Ctrl+Z)">↩</button>
      <button class="de-clear-btn" onclick={clearDungeonTiles}>🗑</button>
    </div>
  </div>
</div>

<style>
  .dungeon-editor {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 260px;
    background: rgba(17, 24, 39, 0.97);
    backdrop-filter: blur(4px);
    border-left: 2px solid #374151;
    display: flex;
    flex-direction: column;
    z-index: 200;
    overflow: hidden;
    box-shadow: -4px 0 16px rgba(0,0,0,0.5);
  }

  .de-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: #111827;
    border-bottom: 1px solid #374151;
    flex-shrink: 0;
  }

  .de-title {
    font-size: 14px;
    font-weight: bold;
    color: #f9fafb;
    letter-spacing: 0.03em;
  }

  .de-close {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    font-size: 14px;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .de-close:hover { background: #374151; color: #f9fafb; }

  .de-section-label {
    font-size: 11px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 8px 12px 4px;
    flex-shrink: 0;
  }

  .de-active-brush {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: #0f172a;
    border-bottom: 1px solid #1e293b;
    flex-shrink: 0;
  }
  .de-active-canvas {
    display: block;
    border-radius: 6px;
    border: 2px solid #ef4444;
    flex-shrink: 0;
    image-rendering: pixelated;
  }
  .de-active-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .de-active-label {
    font-size: 13px;
    font-weight: 600;
    color: #f1f5f9;
  }
  .de-active-hint {
    font-size: 9px;
    color: #64748b;
    line-height: 1.4;
  }

  .de-palette {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    padding: 4px 8px;
    overflow-y: auto;
    flex-shrink: 1;
    min-height: 0;
  }

  .de-tile-btn {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    background: #111827;
    border: 2px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    padding: 4px 2px;
    transition: border-color 0.12s, background 0.12s;
  }

  .de-key-hint {
    position: absolute;
    top: 3px;
    right: 5px;
    font-size: 8px;
    font-weight: 700;
    color: #4b5563;
    line-height: 1;
    pointer-events: none;
  }
  .de-tile-btn.selected .de-key-hint { color: #fca5a5; }
  .de-tile-btn:hover { border-color: #4b5563; background: #1e293b; }
  .de-tile-btn.selected { border-color: #ef4444; background: #1c1917; }

  .de-tile-btn canvas {
    display: block;
    border-radius: 4px;
    image-rendering: pixelated;
  }

  .de-tile-label {
    font-size: 9px;
    color: #94a3b8;
    text-align: center;
    line-height: 1.2;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 0 2px;
  }
  .de-tile-btn.selected .de-tile-label { color: #fca5a5; }

  .de-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px 8px;
    flex-shrink: 0;
  }

  .de-preset-btn {
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 5px;
    color: #d1d5db;
    font-size: 11px;
    padding: 4px 8px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .de-preset-btn:hover { background: #374151; color: #f9fafb; }

  .de-keyboard-hint {
    padding: 4px 10px;
    font-size: 9px;
    color: #374151;
    background: #0a0f1a;
    border-top: 1px solid #1e293b;
    flex-shrink: 0;
  }
  .de-keyboard-hint kbd {
    background: #1e293b;
    border: 1px solid #374151;
    border-radius: 3px;
    padding: 0 3px;
    font-size: 9px;
    color: #64748b;
  }

  .de-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 12px;
    border-top: 1px solid #1e293b;
    background: #0f172a;
    flex-shrink: 0;
  }

  .de-tile-count {
    font-size: 10px;
    color: #64748b;
  }

  .de-footer-actions {
    display: flex;
    gap: 4px;
  }

  .de-undo-btn {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 5px;
    color: #94a3b8;
    font-size: 13px;
    padding: 4px 8px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .de-undo-btn:hover:not(:disabled) { background: #334155; color: #e2e8f0; }
  .de-undo-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  .de-clear-btn {
    background: #7f1d1d;
    border: 1px solid #991b1b;
    border-radius: 5px;
    color: #fca5a5;
    font-size: 13px;
    padding: 4px 8px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .de-clear-btn:hover { background: #991b1b; color: #fee2e2; }
</style>
