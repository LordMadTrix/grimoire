<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as PIXI from 'pixi.js';
  import type { FowShape, Token } from '$lib/stores/vtt.svelte';
  import TokenSettingsModal from './TokenSettingsModal.svelte';
  import { convertFileSrc } from '@tauri-apps/api/core';
  import { getVaultPath } from '$lib/stores/vault.svelte';

  // Svelte 5 — $props() obligatoire (pas export let)
  let {
    mapUrl = null,
    gridEnabled = true,
    gridSize = 50,
    isGM = false,
    fowShapes = [],
    tokens = [],
    vaultPath = '',
    vttMode = 'select',
    onFowUpdate = () => {},
    onTokenMove = () => {},
    onTokenUpdate = () => {},
    onTokenDelete = () => {},
  }: {
    mapUrl: string | null;
    gridEnabled: boolean;
    gridSize: number;
    isGM: boolean;
    fowShapes: FowShape[];
    tokens: Token[];
    vttMode: 'select' | 'fog-reveal' | 'fog-hide' | 'measure';
    onFowUpdate: (shape: FowShape) => void;
    onTokenMove: (id: string, x: number, y: number) => void;
    onTokenUpdate: (token: Token) => void;
    onTokenDelete: (id: string) => void;
  } = $props();

  let canvasContainer: HTMLDivElement;
  let app: PIXI.Application;
  let appReady = $state(false);

  // World Container pour Pan/Zoom
  let worldContainer: PIXI.Container;
  let backgroundSprite: PIXI.Sprite | null = null;
  let gridGraphics: PIXI.Graphics;

  let fogLayer: PIXI.Container;
  let fowTexture: PIXI.RenderTexture | null = null;
  let fowSprite: PIXI.Sprite | null = null;

  let tokenLayer: PIXI.Container;
  let tokenSprites: Map<string, PIXI.Container> = new Map();
  let loadingTextures = new Set<string>();

  let errorMessage = $state<string | null>(null);

  // État du dessin
  let isDrawing = false;
  let drawStartX = 0;
  let drawStartY = 0;
  let previewShape: PIXI.Graphics;

  // État du pan
  let isPanning = false;
  let lastPanX = 0;
  let lastPanY = 0;

  // Édition de token
  let editingTokenId = $state<string | null>(null);

  onMount(async () => {
    app = new PIXI.Application();
    await app.init({
      resizeTo: canvasContainer,
      backgroundColor: 0x0a0c10,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    canvasContainer.appendChild(app.canvas);

    worldContainer = new PIXI.Container();
    app.stage.addChild(worldContainer);

    gridGraphics = new PIXI.Graphics();
    worldContainer.addChild(gridGraphics);

    fogLayer = new PIXI.Container();
    worldContainer.addChild(fogLayer);

    tokenLayer = new PIXI.Container();
    worldContainer.addChild(tokenLayer);

    previewShape = new PIXI.Graphics();
    worldContainer.addChild(previewShape);

    window.addEventListener('resize', handleResize);

    if (isGM) {
      app.stage.eventMode = 'static';
      app.stage.hitArea = new PIXI.Rectangle(0, 0, 100000, 100000);
      app.stage.on('pointerdown', onPointerDown);
      app.stage.on('pointermove', onPointerMove);
      app.stage.on('pointerup', onPointerUp);
      app.stage.on('pointerupoutside', onPointerUp);
      app.canvas.addEventListener('wheel', onWheel);
      app.canvas.addEventListener('contextmenu', e => e.preventDefault());
    }

    appReady = true;
    if (mapUrl) await loadMap(mapUrl);
  });

  onDestroy(() => {
    window.removeEventListener('resize', handleResize);
    if (app && isGM) {
      app.canvas.removeEventListener('wheel', onWheel);
    }
    if (fowTexture) fowTexture.destroy(true);
    if (app) app.destroy(true, { children: true, texture: true });
  });

  // Réagir aux changements de carte
  $effect(() => {
    const url = mapUrl;
    if (!appReady || url === null) return;
    loadMap(url);
  });

  // Réagir aux changements de grille
  $effect(() => {
    gridEnabled; // track
    gridSize;    // track
    if (!appReady) return;
    drawGrid();
  });

  // Réagir aux changements de FOW et tokens (vision dynamique)
  $effect(() => {
    fowShapes; // track
    tokens;    // track
    if (!appReady) return;
    renderFow();
  });

  // Réagir aux changements de tokens (positions, HP, etc.)
  $effect(() => {
    tokens; // track
    if (!appReady) return;
    renderTokens();
  });

  async function loadMap(url: string) {
    try {
      errorMessage = null;
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("L'image n'a pas pu se charger."));
        img.src = url;
      });

      const texture = PIXI.Texture.from(img);
      if (backgroundSprite) {
        worldContainer.removeChild(backgroundSprite);
        backgroundSprite.destroy();
      }

      backgroundSprite = new PIXI.Sprite(texture);
      worldContainer.addChildAt(backgroundSprite, 0);

      if (fowTexture) fowTexture.destroy(true);
      if (fowSprite) fogLayer.removeChild(fowSprite);

      fowTexture = PIXI.RenderTexture.create({ width: texture.width, height: texture.height });
      fowSprite = new PIXI.Sprite(fowTexture);
      fowSprite.alpha = isGM ? 0.6 : 1.0;
      fogLayer.addChild(fowSprite);

      fitMapToScreen();
    } catch (e: any) {
      errorMessage = 'PixiJS Error: ' + (e.message || e.toString());
    }
  }

  function fitMapToScreen() {
    if (!backgroundSprite) return;
    const { width, height } = app.screen;
    const mapRatio = backgroundSprite.texture.width / backgroundSprite.texture.height;
    const screenRatio = width / height;

    let scale = 1;
    if (screenRatio > mapRatio) scale = height / backgroundSprite.texture.height;
    else scale = width / backgroundSprite.texture.width;

    worldContainer.scale.set(scale);
    worldContainer.x = (width - backgroundSprite.texture.width * scale) / 2;
    worldContainer.y = (height - backgroundSprite.texture.height * scale) / 2;

    drawGrid();
    renderFow();
    renderTokens();
  }

  function handleResize() {
    if (app) app.resize();
  }

  function drawGrid() {
    if (!gridGraphics || !backgroundSprite) return;
    gridGraphics.clear();
    if (!gridEnabled) return;

    const w = backgroundSprite.texture.width;
    const h = backgroundSprite.texture.height;

    // API PixiJS v8 : setStrokeStyle + stroke() obligatoire
    gridGraphics.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.15 });
    for (let x = 0; x <= w; x += gridSize) {
      gridGraphics.moveTo(x, 0);
      gridGraphics.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += gridSize) {
      gridGraphics.moveTo(0, y);
      gridGraphics.lineTo(w, y);
    }
    gridGraphics.stroke(); // manquait → grille invisible sans ça
  }

  function renderFow() {
    if (!fowTexture || !backgroundSprite || !app) return;

    const container = new PIXI.Container();
    const bg = new PIXI.Graphics()
      .rect(0, 0, backgroundSprite.texture.width, backgroundSprite.texture.height)
      .fill(0x000000);
    container.addChild(bg);

    fowShapes.forEach(shape => {
      const g = new PIXI.Graphics();
      if (shape.type === 'circle') g.circle(shape.x, shape.y, shape.radius || 0);
      else if (shape.type === 'rect') g.rect(shape.x, shape.y, shape.width || 0, shape.height || 0);

      if ((shape.op || 'reveal') === 'reveal') {
        g.fill(0xffffff);
        g.blendMode = 'erase';
      } else {
        g.fill(0x000000);
        g.blendMode = 'normal';
      }
      container.addChild(g);
    });

    // Vision dynamique des pions
    tokens.forEach(token => {
      if (token.visionRange && token.visionRange > 0) {
        const radius = token.visionRange * gridSize;
        const g = new PIXI.Graphics().circle(token.x, token.y, radius).fill(0xffffff);
        g.blendMode = 'erase';
        container.addChild(g);
      }
    });

    app.renderer.render({ container, target: fowTexture, clear: true });
    container.destroy({ children: true }); // libérer la mémoire GPU

    if (fowSprite) {
      fowSprite.alpha = isGM ? 0.6 : 1.0;
    }
  }

  function renderTokens() {
    if (!tokenLayer || !backgroundSprite) return;

    // Supprimer les sprites de tokens disparus
    for (const [id, sprite] of tokenSprites) {
      if (!tokens.find(t => t.id === id)) {
        tokenLayer.removeChild(sprite);
        sprite.destroy({ children: true });
        tokenSprites.delete(id);
      }
    }

    tokens.forEach(token => {
      let container = tokenSprites.get(token.id);
      let circleG: PIXI.Graphics;
      let textT: PIXI.Text;
      let hpBar: PIXI.Graphics;

      if (!container) {
        container = new PIXI.Container();

        circleG = new PIXI.Graphics();
        container.addChild(circleG);

        // Sprite pour l'image (optionnel)
        const tokenSprite = new PIXI.Sprite();
        tokenSprite.anchor.set(0.5);
        tokenSprite.visible = false;
        container.addChild(tokenSprite);

        textT = new PIXI.Text({
          text: '',
          style: {
            fontFamily: 'sans-serif',
            fontSize: 14,
            fill: 0xffffff,
            stroke: { color: 0x000000, width: 3 },
          },
        });
        textT.anchor.set(0.5, 1);
        container.addChild(textT);

        hpBar = new PIXI.Graphics();
        container.addChild(hpBar);

        if (isGM) {
          container.eventMode = 'static';
          container.cursor = 'pointer';
          container.on('pointerdown', (e) => onTokenPointerDown(e, token.id));
          container.on('rightclick', (e) => { e.stopPropagation(); editingTokenId = token.id; });
        }
        tokenLayer.addChild(container);
        tokenSprites.set(token.id, container);
      } else {
        circleG = container.children[0] as PIXI.Graphics;
        // child 1 is tokenSprite
        textT = container.children[2] as PIXI.Text;
        hpBar = container.children[3] as PIXI.Graphics;
      }

      const r = token.size / 2;
      const tokenSprite = container.children[1] as PIXI.Sprite;

      // Cercle — API PixiJS v8
      circleG.clear();
      const color = token.isEnemy ? 0xef4444 : (token.color || 0x3b82f6);
      
      // Toujours centrer le container et ses enfants
      tokenSprite.position.set(0, 0);
      tokenSprite.anchor.set(0.5);

      if (token.imageUrl) {
        tokenSprite.visible = true;
        
        if (!vaultPath) {
           tokenSprite.visible = false;
           return;
        }

        const fullPath = vaultPath + '/' + token.imageUrl;
        // On s'assure que le chemin est propre pour Tauri
        const fullUrl = convertFileSrc(fullPath);
        
        if (!tokenSprite.texture || tokenSprite.texture.label !== fullUrl) {
          if (!loadingTextures.has(fullUrl)) {
            loadingTextures.add(fullUrl);
            
            // Fallback immédiat : texture vide pour éviter les glitchs
            tokenSprite.texture = PIXI.Texture.EMPTY;
            
            PIXI.Assets.load(fullUrl).then(tex => {
              if (container && tokenSprite) {
                tokenSprite.texture = tex;
                tokenSprite.texture.label = fullUrl;
                if (tex.width > 0) {
                  tokenSprite.width = token.size;
                  tokenSprite.height = token.size;
                }
              }
              loadingTextures.delete(fullUrl);
            }).catch(err => {
              console.error("Token Image Load Error:", fullUrl, err);
              loadingTextures.delete(fullUrl);
              tokenSprite.visible = false;
            });
          }
        } else if (tokenSprite.texture && tokenSprite.texture.width > 0) {
          // Texture déjà chargée et valide
          tokenSprite.width = token.size;
          tokenSprite.height = token.size;
        }
        
        // Masque circulaire
        if (!tokenSprite.mask) {
           const maskG = new PIXI.Graphics();
           container.addChild(maskG);
           tokenSprite.mask = maskG;
        }
        const m = tokenSprite.mask as PIXI.Graphics;
        m.clear().circle(0, 0, r).fill(0xffffff);
        m.position.set(0, 0);

        // Fond de secours (si l'image est transparente ou en cours de chargement)
        circleG.circle(0, 0, r).fill({ color: 0x222222, alpha: 0.8 });
        
        // Bordure
        circleG.setStrokeStyle({ width: 4, color: color, alpha: 1 });
        circleG.circle(0, 0, r).stroke();
      } else {
        // Mode Couleur unie
        tokenSprite.visible = false;
        circleG.setStrokeStyle({ width: 3, color: 0xffffff, alpha: 1 });
        circleG.circle(0, 0, r).fill(color).stroke();
      }

      // Texte
      textT.text = token.name || 'Inconnu';
      textT.y = -r - 10;

      // Barre de vie — API PixiJS v8
      hpBar.clear();
      if (token.maxHp && token.maxHp > 0) {
        const hp = token.hp ?? token.maxHp;
        const pct = Math.max(0, Math.min(1, hp / token.maxHp));
        const barW = 40;
        const barH = 6;
        hpBar.rect(-barW / 2, r + 4, barW, barH);
        hpBar.fill({ color: 0x000000, alpha: 0.8 });
        hpBar.rect(-barW / 2 + 1, r + 5, (barW - 2) * pct, barH - 2);
        hpBar.fill(pct > 0.5 ? 0x22c55e : pct > 0.2 ? 0xeab308 : 0xef4444);
      }

      container.x = token.x;
      container.y = token.y;
    });
  }

  // --- Logique d'interaction ---
  let draggedTokenId: string | null = null;

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    if (!worldContainer) return;

    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
    const globalPos = new PIXI.Point(e.offsetX, e.offsetY);
    const localPos = worldContainer.toLocal(globalPos);

    worldContainer.scale.x *= zoomDelta;
    worldContainer.scale.y *= zoomDelta;

    worldContainer.x = globalPos.x - localPos.x * worldContainer.scale.x;
    worldContainer.y = globalPos.y - localPos.y * worldContainer.scale.y;
  }

  function onTokenPointerDown(e: any, id: string) {
    e.stopPropagation();
    if (e.button === 2) {
      // Clic droit → ouvrir le modal d'édition
      editingTokenId = id;
    } else if (vttMode === 'select') {
      // Clic gauche → déplacer
      draggedTokenId = id;
    }
  }

  function onPointerDown(e: PIXI.FederatedPointerEvent) {
    if (e.button === 1 || e.button === 2) {
      isPanning = true;
      lastPanX = e.global.x;
      lastPanY = e.global.y;
      return;
    }

    if (vttMode === 'select') return;

    const localPos = worldContainer.toLocal(e.global);
    isDrawing = true;
    drawStartX = localPos.x;
    drawStartY = localPos.y;
  }

  function onPointerMove(e: PIXI.FederatedPointerEvent) {
    if (isPanning) {
      const dx = e.global.x - lastPanX;
      const dy = e.global.y - lastPanY;
      worldContainer.x += dx;
      worldContainer.y += dy;
      lastPanX = e.global.x;
      lastPanY = e.global.y;
      return;
    }

    if (draggedTokenId && backgroundSprite) {
      const localPos = worldContainer.toLocal(e.global);
      const sprite = tokenSprites.get(draggedTokenId);
      if (sprite) {
        sprite.x = localPos.x;
        sprite.y = localPos.y;
      }
    } else if (isDrawing && previewShape && backgroundSprite) {
      const localPos = worldContainer.toLocal(e.global);
      previewShape.clear();

      if (vttMode === 'measure') {
        const dx = localPos.x - drawStartX;
        const dy = localPos.y - drawStartY;
        const pxDistance = Math.sqrt(dx * dx + dy * dy);
        const gridDistance = Math.round((pxDistance / gridSize) * 1.5 * 10) / 10;

        // API PixiJS v8
        previewShape.setStrokeStyle({ width: 2, color: 0xffaa00, alpha: 1 });
        previewShape.moveTo(drawStartX, drawStartY);
        previewShape.lineTo(localPos.x, localPos.y);
        previewShape.stroke();

        if (!previewShape.children[0]) {
          const t = new PIXI.Text({
            text: '',
            style: {
              fill: 0xffaa00,
              fontSize: 16,
              stroke: { color: 0x000000, width: 3 },
              fontWeight: 'bold',
            },
          });
          t.anchor.set(0.5);
          previewShape.addChild(t);
        }
        const textObj = previewShape.children[0] as PIXI.Text;
        textObj.text = `${gridDistance} m`;
        textObj.x = drawStartX + dx / 2;
        textObj.y = drawStartY + dy / 2 - 15;
        textObj.visible = true;
      } else {
        if (previewShape.children[0]) previewShape.children[0].visible = false;
        const isReveal = vttMode === 'fog-reveal';
        const dx = localPos.x - drawStartX;
        const dy = localPos.y - drawStartY;
        const radius = Math.sqrt(dx * dx + dy * dy);

        // API PixiJS v8
        previewShape.setStrokeStyle({ width: 2, color: isReveal ? 0x00ff00 : 0xff0000, alpha: 0.8 });
        previewShape.circle(drawStartX, drawStartY, radius);
        previewShape.fill({ color: isReveal ? 0x00ff00 : 0xff0000, alpha: 0.2 });
        previewShape.stroke();
      }
    }
  }

  function onPointerUp(e: PIXI.FederatedPointerEvent) {
    if (isPanning) {
      isPanning = false;
      return;
    }

    if (draggedTokenId && backgroundSprite) {
      let localPos = worldContainer.toLocal(e.global);
      if (gridEnabled) {
        localPos.x = Math.floor(localPos.x / gridSize) * gridSize + gridSize / 2;
        localPos.y = Math.floor(localPos.y / gridSize) * gridSize + gridSize / 2;
      }
      onTokenMove(draggedTokenId, localPos.x, localPos.y);
      draggedTokenId = null;
    } else if (isDrawing && backgroundSprite) {
      isDrawing = false;
      previewShape.clear();

      if (vttMode === 'measure') return;

      const localPos = worldContainer.toLocal(e.global);
      const dx = localPos.x - drawStartX;
      const dy = localPos.y - drawStartY;
      const radius = Math.sqrt(dx * dx + dy * dy);

      if (radius > 5) {
        onFowUpdate({
          type: 'circle',
          op: vttMode === 'fog-reveal' ? 'reveal' : 'hide',
          x: drawStartX,
          y: drawStartY,
          radius,
        });
      }
    }
  }
</script>

{#if editingTokenId}
  <TokenSettingsModal
    token={tokens.find(t => t.id === editingTokenId) || null}
    onClose={() => (editingTokenId = null)}
    onSave={(t) => {
      onTokenUpdate(t);
      editingTokenId = null;
    }}
    onDelete={(id) => {
      onTokenDelete(id);
      editingTokenId = null;
    }}
  />
{/if}

<div class="canvas-container" bind:this={canvasContainer}>
  {#if errorMessage}
    <div class="error-overlay">{errorMessage}</div>
  {/if}
</div>

<style>
  .canvas-container {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #0a0c10;
  }

  .error-overlay {
    position: absolute;
    top: 20px;
    left: 20px;
    color: #f85149;
    background: #0d1117;
    border: 1px solid #f85149;
    border-radius: 6px;
    padding: 10px 14px;
    z-index: 1000;
    font-size: 13px;
  }

  :global(canvas) {
    display: block;
  }
</style>
