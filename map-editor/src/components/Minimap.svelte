<script lang="ts">
  import { onMount } from 'svelte';
  import { mapStore } from '../lib/stores/mapStore.svelte';

  let miniCanvas = $state<HTMLCanvasElement | null>(null);
  let isDragging = $state(false);
  let isCollapsed = $state(false);

  const MINI_WIDTH = 180;
  const MINI_HEIGHT = 135;

  function updateMinimap() {
    if (!miniCanvas || isCollapsed) return;
    const ctx = miniCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, MINI_WIDTH, MINI_HEIGHT);

    const scaleX = MINI_WIDTH / mapStore.canvasWidth;
    const scaleY = MINI_HEIGHT / mapStore.canvasHeight;
    const s = Math.min(scaleX, scaleY);

    const offX = (MINI_WIDTH - mapStore.canvasWidth * s) / 2;
    const offY = (MINI_HEIGHT - mapStore.canvasHeight * s) / 2;

    ctx.save();
    ctx.translate(offX, offY);
    ctx.scale(s, s);

    // Fond
    if (mapStore.backgroundType === 'water') {
      ctx.fillStyle = '#1e3a8a';
    } else if (mapStore.backgroundType === 'texture' && mapStore.backgroundTexture === 'rock') {
      ctx.fillStyle = '#262626';
    } else if (mapStore.backgroundType === 'texture' && mapStore.backgroundTexture === 'grass') {
      ctx.fillStyle = '#166534';
    } else {
      ctx.fillStyle = '#78350f';
    }
    ctx.fillRect(0, 0, mapStore.canvasWidth, mapStore.canvasHeight);

    // Formes
    if (mapStore.layerVisibility.shapes) {
      for (const shape of mapStore.shapes) {
        ctx.fillStyle = shape.fillColor || '#4b5563';
        ctx.strokeStyle = shape.strokeColor || '#d4a84b';
        ctx.lineWidth = Math.max(2, shape.strokeWidth);

        if (shape.type === 'rectangle' && shape.points.length >= 2) {
          const [p1, p2] = shape.points;
          const x = Math.min(p1.x, p2.x);
          const y = Math.min(p1.y, p2.y);
          const w = Math.abs(p2.x - p1.x);
          const h = Math.abs(p2.y - p1.y);
          ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);
        } else if (shape.type === 'circle' && shape.points.length >= 2) {
          const [c, e] = shape.points;
          const r = Math.hypot(e.x - c.x, e.y - c.y);
          ctx.beginPath();
          ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    // Tracés
    if (mapStore.layerVisibility.paths) {
      for (const path of mapStore.paths) {
        if (path.points.length < 2) continue;
        ctx.strokeStyle = path.color;
        ctx.lineWidth = Math.max(3, path.width);
        ctx.beginPath();
        ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) {
          ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        ctx.stroke();
      }
    }

    // Tampons (points denses)
    if (mapStore.layerVisibility.stamps) {
      for (const stamp of mapStore.stamps) {
        ctx.fillStyle = stamp.type.includes('tree') ? '#22c55e' : stamp.type.includes('mountain') ? '#94a3b8' : '#eab308';
        ctx.beginPath();
        ctx.arc(stamp.x, stamp.y, Math.max(4, 8 * stamp.scale), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // ── Rectangle de champ de vision (Viewport) ──
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // Coordonnées de l'écran converties dans la carte
    const viewLeft = -mapStore.panX / mapStore.zoom;
    const viewTop = -mapStore.panY / mapStore.zoom;
    const viewRight = (screenW - mapStore.panX) / mapStore.zoom;
    const viewBottom = (screenH - mapStore.panY) / mapStore.zoom;

    const rLeft = offX + viewLeft * s;
    const rTop = offY + viewTop * s;
    const rWidth = (viewRight - viewLeft) * s;
    const rHeight = (viewBottom - viewTop) * s;

    ctx.strokeStyle = '#e5a853';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(229, 168, 83, 0.15)';
    ctx.fillRect(rLeft, rTop, rWidth, rHeight);
    ctx.strokeRect(rLeft, rTop, rWidth, rHeight);
  }

  function handleMinimapInteract(e: MouseEvent) {
    if (!miniCanvas) return;
    const rect = miniCanvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const scaleX = MINI_WIDTH / mapStore.canvasWidth;
    const scaleY = MINI_HEIGHT / mapStore.canvasHeight;
    const s = Math.min(scaleX, scaleY);

    const offX = (MINI_WIDTH - mapStore.canvasWidth * s) / 2;
    const offY = (MINI_HEIGHT - mapStore.canvasHeight * s) / 2;

    const targetMapX = (clickX - offX) / s;
    const targetMapY = (clickY - offY) / s;

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    mapStore.panX = screenW / 2 - targetMapX * mapStore.zoom;
    mapStore.panY = screenH / 2 - targetMapY * mapStore.zoom;

    updateMinimap();
  }

  function onMouseDown(e: MouseEvent) {
    isDragging = true;
    handleMinimapInteract(e);
  }

  function onMouseMove(e: MouseEvent) {
    if (isDragging) {
      handleMinimapInteract(e);
    }
  }

  function onMouseUp() {
    isDragging = false;
  }

  onMount(() => {
    const interval = setInterval(updateMinimap, 250);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      clearInterval(interval);
      window.removeEventListener('mouseup', onMouseUp);
    };
  });
</script>

{#if mapStore.showMinimap && !mapStore.zenMode}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="minimap-container" class:collapsed={isCollapsed}>
    <div class="minimap-header">
      <div class="minimap-title">
        <span>🧭</span>
        <span>RADAR</span>
      </div>
      <button class="minimap-toggle" onclick={() => isCollapsed = !isCollapsed} title={isCollapsed ? 'Déplier' : 'Réduire'}>
        {isCollapsed ? '▲' : '▼'}
      </button>
    </div>

    {#if !isCollapsed}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <canvas
        bind:this={miniCanvas}
        width={MINI_WIDTH}
        height={MINI_HEIGHT}
        class="minimap-canvas"
        onmousedown={onMouseDown}
        onmousemove={onMouseMove}
      ></canvas>
    {/if}
  </div>
{/if}

<style>
  .minimap-container {
    position: fixed;
    bottom: 56px;
    right: 18px;
    background: rgba(15, 20, 31, 0.92);
    border: 1px solid rgba(212, 168, 75, 0.4);
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(12px);
    z-index: 120;
    overflow: hidden;
    user-select: none;
    transition: all 0.2s ease;
  }

  .minimap-container.collapsed {
    border-color: rgba(255, 255, 255, 0.1);
  }

  .minimap-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.04);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #e5a853;
  }

  .minimap-title {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .minimap-toggle {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    font-size: 9px;
    padding: 2px 4px;
    border-radius: 4px;
  }
  .minimap-toggle:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
  }

  .minimap-canvas {
    display: block;
    cursor: crosshair;
    background: #090c12;
  }
</style>
