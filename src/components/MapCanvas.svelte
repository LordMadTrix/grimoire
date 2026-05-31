<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as PIXI from 'pixi.js';
  import type { FowShape, Token, MapPin, SpellMarker, DrawPath, WallDef, AudioZoneDef, TerrainZone, TileType } from '$lib/stores/vtt.svelte';
  import { vttStore, addGmWall, addGmAudioZone, toggleGmDoor, removeGmAudioZone, addTerrainZone, setDungeonTile, pushDungeonUndo } from '$lib/stores/vtt.svelte';
  import ConditionWheel from './ConditionWheel.svelte';
  import TokenSettingsModal from './TokenSettingsModal.svelte';
  import { readFileBase64, emitToPlayerView } from '$lib/api';
  import { getVaultPath } from '$lib/stores/vault.svelte';

  // Svelte 5 — $props() obligatoire (pas export let)
  let {
    mapUrl = null,
    gridEnabled = true,
    gridSize = 50,
    isGM = false,
    fowShapes = [],
    tokens = [],
    pins = [] as MapPin[],
    vaultPath = '',
    vttMode = 'select' as 'select' | 'fog-reveal' | 'fog-hide' | 'fog-rect' | 'measure' | 'ping' | 'pin' | 'spell' | 'zoom-rect' | 'draw' | 'blueprint' | 'audio-zone' | 'terrain' | 'dungeon-paint',
    fitRequest = 0,
    activeTokenId = null as string | null,
    externalPing = null as { x: number; y: number; seq: number } | null,
    externalCamera = null as { scaleX: number; scaleY: number; x: number; y: number } | null,
    externalRoll = null as { text: string; seq: number } | null,
    spells = [] as SpellMarker[],
    weather = 'none' as string,
    onFowUpdate = () => {},
    onTokenMove = () => {},
    onTokenUpdate = () => {},
    onTokenDelete = () => {},
    onTokenDrop = (_imageUrl: string, _x: number, _y: number) => {},
    onPinPlace = (_x: number, _y: number) => {},
    onPinDelete = (_id: string) => {},
    onSpellPlace = (_x: number, _y: number, _angle?: number) => {},
    onSpellDelete = (_id: string) => {},
    drawPaths = [] as DrawPath[],
    drawColor = 0xe5a853,
    drawWidth = 4,
    onDrawPath = (_path: DrawPath) => {},
    onPinReveal = (_id: string) => {},
    fowEnabled = true,
    walls = [] as WallDef[],
    audioZones = [] as AudioZoneDef[],
    spotlightTokenId = null as string | null,
    terrainZones = [] as TerrainZone[],
  }: {
    mapUrl?: string | null;
    gridEnabled?: boolean;
    gridSize?: number;
    isGM?: boolean;
    fowShapes?: FowShape[];
    tokens?: Token[];
    pins?: MapPin[];
    spells?: SpellMarker[];
    weather?: string;
    vaultPath?: string;
    vttMode?: 'select' | 'fog-reveal' | 'fog-hide' | 'fog-rect' | 'measure' | 'ping' | 'pin' | 'spell' | 'zoom-rect' | 'draw' | 'blueprint' | 'audio-zone' | 'terrain' | 'dungeon-paint';
    fitRequest?: number;
    activeTokenId?: string | null;
    externalPing?: { x: number; y: number; seq: number } | null;
    externalCamera?: { scaleX: number; scaleY: number; x: number; y: number } | null;
    externalRoll?: { text: string; seq: number } | null;
    onFowUpdate?: (shape: FowShape) => void;
    onTokenMove?: (id: string, x: number, y: number) => void;
    onTokenUpdate?: (token: Token) => void;
    onTokenDelete?: (id: string) => void;
    onTokenDrop?: (imageUrl: string, x: number, y: number) => void;
    onPinPlace?: (x: number, y: number) => void;
    onPinDelete?: (id: string) => void;
    onSpellPlace?: (x: number, y: number, angle?: number) => void;
    onSpellDelete?: (id: string) => void;
    drawPaths?: DrawPath[];
    drawColor?: number;
    drawWidth?: number;
    onDrawPath?: (path: DrawPath) => void;
    onPinReveal?: (id: string) => void;
    fowEnabled?: boolean;
    walls?: WallDef[];
    audioZones?: AudioZoneDef[];
    spotlightTokenId?: string | null;
    terrainZones?: TerrainZone[];
  } = $props();

  let canvasContainer: HTMLDivElement;
  let minimapCanvas = $state<HTMLCanvasElement | null>(null);
  let minimapImg: HTMLImageElement | null = null;
  let minimapImgReady = false;
  let app: PIXI.Application;
  let appReady = $state(false);
  let showMinimap = $state(true);

  // World Container pour Pan/Zoom
  let worldContainer: PIXI.Container;
  let backgroundSprite: PIXI.Sprite | null = null;
  let gridGraphics: PIXI.Graphics;

  let fogLayer: PIXI.Container;
  let fowTexture: PIXI.RenderTexture | null = null;
  let fowSprite: PIXI.Sprite | null = null;

  // Light overlay (above tokens — darkness with holes per lightRadius)
  let lightTexture: PIXI.RenderTexture | null = null;
  let lightSprite: PIXI.Sprite | null = null;

  let tokenLayer: PIXI.Container;
  let tokenSprites: Map<string, PIXI.Container> = new Map();
  let loadingTextures = new Set<string>();

  // Ping markers temporaires
  let pingLayer: PIXI.Container;
  interface PingMarker { g: PIXI.Graphics; born: number }
  let pingMarkers: PingMarker[] = [];

  // Map pins
  let pinLayer: PIXI.Container;
  let pinContainers: Map<string, PIXI.Container> = new Map();

  // Spell layer
  let spellLayer: PIXI.Container;
  let spellContainers: Map<string, PIXI.Container> = new Map();

  // Particle Layer (Auras, Sang, Magie)
  let particleLayer: PIXI.Container;
  interface Particle { g: PIXI.Graphics; vx: number; vy: number; life: number; type: 'blood' | 'aura' }
  let particles: Particle[] = [];

  // Weather
  let weatherLayer: PIXI.Container;
  let weatherG: PIXI.Graphics;
  interface WeatherParticle { x: number; y: number; vx: number; vy: number; alpha: number; size: number; }
  const weatherParticles: WeatherParticle[] = [];

  // Dungeon tile layer
  let dungeonLayer: PIXI.Container;
  let dungeonHoverG: PIXI.Graphics;
  let lastHoverCol = -1;
  let lastHoverRow = -1;

  // Freehand draw layer
  let drawLayer: PIXI.Container;
  let wallLayer: PIXI.Container;
  let audioZoneLayer: PIXI.Container;
  let terrainLayer: PIXI.Graphics;
  let zoneAudioObjects: Map<string, HTMLAudioElement> = new Map();
  let currentFreeDrawG: PIXI.Graphics | null = null;
  let currentFreeDrawPoints: { x: number; y: number }[] = [];
  let isFreeDraw = false;

  // Floating roll text layer (screen space)
  let floatTextLayer: PIXI.Container;
  interface FloatText { t: PIXI.Text; born: number; duration: number }
  const floatTexts: FloatText[] = [];

  // Screen shake
  let shakeIntensity = 0;
  let shakeDuration = 0;
  let shakeStart = 0;

  // Damage tracking
  let prevTokenHps = new Map<string, number>();

  let errorMessage = $state<string | null>(null);

  const CONDITION_EMOJIS: Record<string, string> = {
    poisoned: '🤢', stunned: '⚡', bleeding: '🩸', burning: '🔥',
    frozen: '❄️', frightened: '😱', charmed: '💫', invisible: '👻',
    prone: '⬇️', silenced: '🔇', blinded: '🙈', dead: '💀',
  };

  const SPELL_COLORS: Record<string, number> = {
    fire: 0xff4400, ice: 0x44ccff, lightning: 0xffee00,
    poison: 0x44ff44, silence: 0xaa44ff, divine: 0xffffaa, darkness: 0x4400aa,
  };

  // Multi-select
  let selectedTokenIds = $state<Set<string>>(new Set());
  let dragOffsets = new Map<string, { dx: number; dy: number }>();

  // Chemin de déplacement
  let movePathG: PIXI.Graphics;
  let movePathStart: { x: number; y: number } | null = null;

  // État du dessin
  let isDrawing = false;
  let drawStartX = 0;
  let drawStartY = 0;
  let previewShape: PIXI.Graphics;

  // État du pan
  let isPanning = false;
  let lastPanX = 0;
  let lastPanY = 0;

  // Throttle pour emitCamera (max 1 envoi / 80ms)
  let _emitCameraTimer: ReturnType<typeof setTimeout> | null = null;
  function emitCameraThrottled() {
    if (_emitCameraTimer) return;
    _emitCameraTimer = setTimeout(() => {
      _emitCameraTimer = null;
      emitCamera();
    }, 80);
  }

  const ZOOM_MIN = 0.05;
  const ZOOM_MAX = 8;

  function emitCamera() {
    if (!isGM || !worldContainer) return;
    emitToPlayerView('sync_camera', {
      scaleX: worldContainer.scale.x,
      scaleY: worldContainer.scale.y,
      x: worldContainer.x,
      y: worldContainer.y,
    });
  }

  function spawnRollText(text: string) {
    if (!floatTextLayer || !app) return;
    const t = new PIXI.Text({
      text,
      style: {
        fontFamily: 'Georgia, serif', fontSize: 72, fontWeight: 'bold',
        fill: 0xfbbf24, stroke: { color: 0x000000, width: 8 },
        dropShadow: { color: 0x000000, blur: 12, distance: 4, angle: Math.PI / 4, alpha: 0.8 },
      },
    });
    t.anchor.set(0.5, 0.5);
    t.x = app.screen.width / 2;
    t.y = app.screen.height / 2;
    t.scale.set(0.3);
    floatTextLayer.addChild(t);
    floatTexts.push({ t, born: Date.now(), duration: 2200 });
  }

  // Réagir aux jets de dés externes
  $effect(() => {
    const r = externalRoll;
    if (!appReady || !r) return;
    spawnRollText(r.text);
  });

  // Applique la caméra reçue du MJ (côté vue joueur)
  $effect(() => {
    if (isGM || !externalCamera || !appReady || !worldContainer) return;
    worldContainer.scale.set(externalCamera.scaleX, externalCamera.scaleY);
    worldContainer.x = externalCamera.x;
    worldContainer.y = externalCamera.y;
  });

  // Reset zoom — déclenché par fitRequest depuis le toolbar
  $effect(() => {
    if (!fitRequest || !appReady || !worldContainer) return;
    fitMapToScreen();
    if (isGM) emitToPlayerView('fit_camera', {});
    emitCamera();
  });

  // Édition de token
  let editingTokenId = $state<string | null>(null);
  let condWheelTokenId = $state<string | null>(null);
  let condWheelX = $state(0);
  let condWheelY = $state(0);

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

    dungeonLayer = new PIXI.Container();
    worldContainer.addChild(dungeonLayer);

    fogLayer = new PIXI.Container();
    worldContainer.addChild(fogLayer);

    tokenLayer = new PIXI.Container();
    worldContainer.addChild(tokenLayer);

    pingLayer = new PIXI.Container();
    worldContainer.addChild(pingLayer);

    wallLayer = new PIXI.Container();
    worldContainer.addChild(wallLayer);

    audioZoneLayer = new PIXI.Container();
    worldContainer.addChild(audioZoneLayer);

    terrainLayer = new PIXI.Graphics();
    worldContainer.addChild(terrainLayer);

    pinLayer = new PIXI.Container();
    worldContainer.addChild(pinLayer);

    spellLayer = new PIXI.Container();
    worldContainer.addChild(spellLayer);

    drawLayer = new PIXI.Container();
    worldContainer.addChild(drawLayer);

    dungeonHoverG = new PIXI.Graphics();
    worldContainer.addChild(dungeonHoverG);

    particleLayer = new PIXI.Container();
    worldContainer.addChild(particleLayer);

    weatherLayer = new PIXI.Container();
    app.stage.addChild(weatherLayer);
    weatherG = new PIXI.Graphics();
    weatherLayer.addChild(weatherG);

    floatTextLayer = new PIXI.Container();
    app.stage.addChild(floatTextLayer);

    previewShape = new PIXI.Graphics();
    worldContainer.addChild(previewShape);

    movePathG = new PIXI.Graphics();
    worldContainer.addChild(movePathG);

    window.addEventListener('resize', handleResize);

    if (isGM) {
      app.stage.eventMode = 'static';
      app.stage.hitArea = new PIXI.Rectangle(0, 0, 100000, 100000);
      app.stage.on('pointerdown', onPointerDown);
      app.stage.on('pointerdown', onPointerDownForPing);
      app.stage.on('pointermove', onPointerMove);
      app.stage.on('pointerup', onPointerUp);
      app.stage.on('pointerupoutside', onPointerUp);
      app.canvas.addEventListener('wheel', onWheel);
      app.canvas.addEventListener('contextmenu', e => e.preventDefault());
      document.addEventListener('contextmenu', e => e.preventDefault());
    }

    // Ticker principal : tour de combat + sorts + météo + shake
    app.ticker.add(() => {
      const now = Date.now();

      // ── Token Animations ────────────────────────────────────
      for (const token of tokens) {
        const container = tokenSprites.get(token.id);
        if (!container) continue;

        // Idle oscillation
        if (token.animation !== 'attack' && token.animation !== 'hit') {
          const idleY = Math.sin(now / 1000 + token.x) * 4;
          container.pivot.y = idleY;
        }

        // Attack animation
        if (token.animation === 'attack') {
          const progress = (now % 600) / 600;
          const jump = Math.sin(progress * Math.PI) * 15;
          container.pivot.y = jump;
        }

        // Hit animation (shake + tint)
        if (token.animation === 'hit') {
          const shake = (Math.random() - 0.5) * 10;
          container.pivot.x = shake;
          const tint = Math.sin(now / 100) > 0 ? 0xff4444 : 0xffffff;
          // Note: tint requires colorMatrixFilter or similar on Container, 
          // but we can just clignoter l'alpha
          container.alpha = Math.sin(now / 50) > 0 ? 0.6 : 1;
        } else {
          container.pivot.x = 0;
          if (isGM) container.alpha = token.visible === false ? 0.45 : 1;
          else container.alpha = 1;
        }

        // ── Visibilité brouillard de guerre (joueur uniquement) ──
        if (!isGM) {
          const gmHidden = token.visible === false;
          // Un token est visible s'il est dans une zone révélée OU dans la vision d'un autre token joueur
          const inFow = isTokenRevealed(token.x, token.y);
          const inVision = tokens.some(t =>
            !t.isEnemy && t.visionRange && t.visionRange > 0 &&
            Math.sqrt((token.x - t.x) ** 2 + (token.y - t.y) ** 2) <= t.visionRange * gridSize
          );
          container.visible = !gmHidden && (inFow || inVision);
        }
      }

      // ── Particles (Blood, Auras) ─────────────────────────────
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= 0.02;
        p.g.x += p.vx;
        p.g.y += p.vy;
        p.g.alpha = Math.max(0, p.life);
        if (p.life <= 0) {
          particleLayer.removeChild(p.g);
          p.g.destroy();
          particles.splice(i, 1);
        }
      }

      // ── Turn ring ────────────────────────────────────────────
      const activeId = activeTokenId;
      for (const [id, c] of tokenSprites) {
        const ring = (c as any).__turnRing as PIXI.Graphics | undefined;
        if (ring && id !== activeId) {
          c.removeChild(ring); ring.destroy(); delete (c as any).__turnRing;
        }
      }
      if (activeId) {
        const container = tokenSprites.get(activeId);
        const token = tokens.find(t => t.id === activeId);
        if (container && token) {
          let ring = (container as any).__turnRing as PIXI.Graphics | undefined;
          if (!ring) { ring = new PIXI.Graphics(); container.addChildAt(ring, 0); (container as any).__turnRing = ring; }
          const r = token.size / 2;
          const pulse = 0.45 + 0.55 * Math.sin(now / 320);
          ring.clear();
          ring.setStrokeStyle({ width: 5, color: 0xfbbf24, alpha: pulse });
          ring.circle(0, 0, r + 7).stroke();
        }
      }

      // ── Spell glow ───────────────────────────────────────────
      for (const [, c] of spellContainers) {
        const g = c.children[0] as PIXI.Graphics;
        if (!g) continue;
        const radius = (c as any).__spellRadius as number;
        const color = (c as any).__spellColor as number;
        const pulse = 0.3 + 0.15 * Math.sin(now / 400);
        const outer = 0.12 + 0.08 * Math.sin(now / 600 + 1);
        g.clear();
        g.circle(0, 0, radius).fill({ color, alpha: 0.15 + pulse * 0.08 });
        g.setStrokeStyle({ width: 3, color, alpha: 0.55 + pulse * 0.45 });
        g.circle(0, 0, radius).stroke();
        g.setStrokeStyle({ width: 10, color, alpha: outer });
        g.circle(0, 0, radius).stroke();
      }

      // ── Fog drift (mouvement subtil du brouillard) ───────────
      if (fowSprite && fowSprite.visible) {
        const drift = Math.sin(now / 4000) * 3;
        const driftY = Math.cos(now / 5500) * 2;
        fowSprite.x = drift;
        fowSprite.y = driftY;
        fowSprite.alpha = isGM
          ? 0.52 + Math.sin(now / 3200) * 0.04
          : 0.88 + Math.sin(now / 3200) * 0.05;
      }

      // ── Screen shake ─────────────────────────────────────────
      if (shakeIntensity > 0) {
        const elapsed = now - shakeStart;
        if (elapsed < shakeDuration) {
          const current = shakeIntensity * (1 - elapsed / shakeDuration);
          app.stage.x = (Math.random() - 0.5) * 2 * current;
          app.stage.y = (Math.random() - 0.5) * 2 * current;
        } else {
          app.stage.x = 0; app.stage.y = 0; shakeIntensity = 0;
        }
      }


      // ── Weather particles & Lightning ─────────────────────────
      if (weather !== 'none' && weatherG) {
        const W = app.screen.width;
        const H = app.screen.height;

        if (weather === 'storm' && Math.random() < 0.004) {
          triggerLightning();
        }

        if (weather === 'rain' || weather === 'storm') {
          for (let i = 0; i < 7; i++) {
            weatherParticles.push({ x: Math.random() * W * 1.3 - W * 0.15, y: -15, vx: -2, vy: 22, alpha: 0.4 + Math.random() * 0.4, size: 0.5 });
          }
        } else if (weather === 'snow') {
          if (weatherParticles.length < 180) {
            weatherParticles.push({ x: Math.random() * W, y: -8, vx: (Math.random() - 0.5), vy: 0.8 + Math.random() * 0.8, alpha: 0.6 + Math.random() * 0.4, size: 2 + Math.random() * 3 });
          }
        } else if (weather === 'fog') {
          if (weatherParticles.length < 25) {
            weatherParticles.push({ x: -100, y: Math.random() * H * 0.8 + H * 0.1, vx: 0.4 + Math.random() * 0.4, vy: (Math.random() - 0.5) * 0.3, alpha: 0, size: 80 + Math.random() * 100 });
          }
        } else if (weather === 'embers') {
          if (Math.random() < 0.35) {
            weatherParticles.push({ x: Math.random() * W, y: H + 8, vx: (Math.random() - 0.5) * 1.5, vy: -2.5 - Math.random() * 2, alpha: 0.7 + Math.random() * 0.3, size: 2 + Math.random() * 2 });
          }
        }
        weatherG.clear();
        for (let i = weatherParticles.length - 1; i >= 0; i--) {
          const p = weatherParticles[i];
          p.x += p.vx; p.y += p.vy;
          if (weather === 'rain') {
            if (p.y > H + 15) { weatherParticles.splice(i, 1); continue; }
            weatherG.setStrokeStyle({ width: 1.5, color: 0x88aaff, alpha: p.alpha });
            weatherG.moveTo(p.x, p.y).lineTo(p.x + p.vx * 2.5, p.y + p.vy * 2.5).stroke();
          } else if (weather === 'snow') {
            if (p.y > H + 10) { weatherParticles.splice(i, 1); continue; }
            p.vx += (Math.random() - 0.5) * 0.08;
            weatherG.circle(p.x, p.y, p.size).fill({ color: 0xffffff, alpha: p.alpha });
          } else if (weather === 'fog') {
            p.alpha = Math.min(0.07, p.alpha + 0.0008);
            if (p.x - p.size > W) { weatherParticles.splice(i, 1); continue; }
            weatherG.circle(p.x, p.y, p.size).fill({ color: 0x8899cc, alpha: p.alpha });
          } else if (weather === 'embers') {
            p.alpha -= 0.004;
            p.vy += (Math.random() - 0.5) * 0.15;
            if (p.y < -10 || p.alpha <= 0) { weatherParticles.splice(i, 1); continue; }
            const flicker = 0.7 + 0.3 * Math.sin(now / 120 + p.x);
            weatherG.circle(p.x, p.y, p.size).fill({ color: 0xff5500, alpha: p.alpha * flicker });
          }
        }
        if (weatherParticles.length > 600) weatherParticles.splice(0, weatherParticles.length - 600);
      } else if (weatherG && weatherParticles.length > 0) {
        weatherG.clear();
        for (let i = weatherParticles.length - 1; i >= 0; i--) {
          const p = weatherParticles[i];
          p.alpha -= 0.04; p.x += p.vx; p.y += p.vy;
          if (p.alpha <= 0) { weatherParticles.splice(i, 1); continue; }
          weatherG.circle(p.x, p.y, p.size).fill({ color: 0xffffff, alpha: p.alpha });
        }
      } else if (weatherG) {
        weatherG.clear();
      }

      // ── Float texts (dice rolls) ─────────────────────────────
      for (let i = floatTexts.length - 1; i >= 0; i--) {
        const ft = floatTexts[i];
        const elapsed = now - ft.born;
        const progress = elapsed / ft.duration;
        if (progress >= 1) {
          floatTextLayer?.removeChild(ft.t);
          ft.t.destroy();
          floatTexts.splice(i, 1);
          continue;
        }
        // Pop in (0→0.3s) then float up and fade (0.3→1)
        if (progress < 0.15) {
          ft.t.scale.set(0.3 + progress / 0.15 * 0.7);
          ft.t.alpha = progress / 0.15;
        } else {
          ft.t.scale.set(1 - (progress - 0.15) * 0.3);
          ft.t.alpha = 1 - ((progress - 0.15) / 0.85) * 0.95;
          ft.t.y -= 0.8;
        }
      }

      // ── Minimap ──────────────────────────────────────────────
      if (isGM && showMinimap && minimapCanvas && minimapImgReady && minimapImg && backgroundSprite && worldContainer) {
        const mCtx = minimapCanvas.getContext('2d');
        if (mCtx) {
          const mW = minimapCanvas.width;
          const mH = minimapCanvas.height;
          const imgW = backgroundSprite.texture.width;
          const imgH = backgroundSprite.texture.height;

          // Fit image in minimap
          const ratio = Math.min(mW / imgW, mH / imgH);
          const dw = imgW * ratio;
          const dh = imgH * ratio;
          const ox = (mW - dw) / 2;
          const oy = (mH - dh) / 2;

          mCtx.clearRect(0, 0, mW, mH);
          mCtx.fillStyle = '#0a0c10';
          mCtx.fillRect(0, 0, mW, mH);
          mCtx.drawImage(minimapImg, ox, oy, dw, dh);

          // Viewport rectangle in minimap space
          const wScale = worldContainer.scale.x;
          const vx = ox + (-worldContainer.x / wScale) * ratio;
          const vy = oy + (-worldContainer.y / wScale) * ratio;
          const vw = (app.screen.width / wScale) * ratio;
          const vh = (app.screen.height / wScale) * ratio;

          mCtx.strokeStyle = 'rgba(229,168,83,0.9)';
          mCtx.lineWidth = 1.5;
          mCtx.strokeRect(vx, vy, vw, vh);
          mCtx.fillStyle = 'rgba(229,168,83,0.06)';
          mCtx.fillRect(vx, vy, vw, vh);
        }
      }
    });

    appReady = true;
    if (mapUrl) await loadMap(mapUrl);
  });

  onDestroy(() => {
    window.removeEventListener('resize', handleResize);
    if (_emitCameraTimer) clearTimeout(_emitCameraTimer);
    if (app && isGM) {
      app.canvas.removeEventListener('wheel', onWheel);
    }
    if (fowTexture) fowTexture.destroy(true);
    if (lightTexture) lightTexture.destroy(true);
    if (app) app.destroy(true, { children: true, texture: true });
    for (const audio of zoneAudioObjects.values()) {
      audio.pause();
      audio.src = '';
    }
    zoneAudioObjects.clear();
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

  // Activer / désactiver le brouillard de guerre
  $effect(() => {
    const enabled = fowEnabled;
    if (!appReady || !fogLayer) return;
    fogLayer.visible = enabled;
  });

  // Réagir aux changements de FOW et tokens (vision dynamique)
  $effect(() => {
    fowShapes; // track
    tokens;    // track
    if (!appReady) return;
    renderFow();
  });

  // Réagir aux changements de tokens (positions, HP, conditions, etc.)
  $effect(() => {
    tokens; // track
    selectedTokenIds; // track (pour anneaux de sélection)
    spotlightTokenId; // track (pour halo spotlight)
    if (!appReady) return;
    renderTokens();
  });

  // Ping externe (depuis vue joueur ou autre fenêtre)
  $effect(() => {
    const p = externalPing;
    if (!appReady || !p) return;
    spawnPing(p.x, p.y);
  });

  // Épingles sur la carte
  $effect(() => {
    pins; // track
    if (!appReady) return;
    renderPins();
  });

  // Sorts / AOE
  $effect(() => {
    spells; // track
    if (!appReady) return;
    renderSpells();
  });

  // Tracés libres
  $effect(() => {
    drawPaths; // track
    if (!appReady) return;
    renderDrawPaths();
  });

  // Murs (Ligne de vue)
  $effect(() => {
    walls; // track
    if (!appReady) return;
    renderWalls();
  });

  // Zones terrain
  $effect(() => {
    terrainZones; // track
    if (!appReady || !terrainLayer) return;
    renderTerrain();
  });

  // Dungeon tiles
  $effect(() => {
    vttStore.dungeonTiles; // track
    gridSize;              // track
    if (!appReady || !dungeonLayer) return;
    renderDungeonTiles().catch(() => {});
  });

  // Dungeon hover / cursor
  $effect(() => {
    if (!appReady) return;
    if (vttMode !== 'dungeon-paint') {
      clearDungeonHover();
    }
    if (app?.canvas) {
      (app.canvas as HTMLCanvasElement).style.cursor =
        vttMode === 'dungeon-paint' ? 'crosshair' : '';
    }
  });

  // Export PNG déclenché depuis le toolbar
  $effect(() => {
    const req = vttStore.exportRequest;
    if (!req || !appReady) return;
    exportMapPng();
  });

  // Zones sonores
  $effect(() => {
    audioZones; // track
    if (!appReady) return;
    renderAudioZones();
    manageZoneAudios();
  });

  // Éclairage dynamique
  $effect(() => {
    tokens;  // track
    gridSize;
    if (!appReady) return;
    renderLighting();
  });

  // Croquis mobiles
  $effect(() => {
    const handler = (e: any) => {
      const { points, color, name } = e.detail;
      spawnSketch(points, color || 0xe5a853, name);
    };
    window.addEventListener('vtt-sketch-push' as any, handler);
    return () => window.removeEventListener('vtt-sketch-push' as any, handler);
  });

  // Détection de dégâts (flash + shake)
  $effect(() => {
    tokens; // track HP changes
    if (!appReady) return;
    for (const token of tokens) {
      if (token.hp !== undefined) {
        const prev = prevTokenHps.get(token.id);
        if (prev !== undefined && token.hp < prev) {
          const dmg = prev - token.hp;
          const container = tokenSprites.get(token.id);
          if (container) flashTokenDamage(container, dmg);
          if (token.hp <= 0) spawnDeathEffect(token.x, token.y);
          triggerShake(8, 320);
        }
        prevTokenHps.set(token.id, token.hp);
      }
    }
  });

  async function loadMap(url: string) {
    try {
      errorMessage = null;
      minimapImgReady = false;
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("L'image n'a pas pu se charger."));
        img.src = url;
      });
      minimapImg = img;
      minimapImgReady = true;

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
      fowSprite.alpha = isGM ? 0.55 : 0.92;
      // Flou sur les bords pour un effet brouillard naturel
      fowSprite.filters = [new PIXI.BlurFilter({ strength: 18, quality: 3 })];
      fogLayer.addChild(fowSprite);

      // Light overlay setup (darkness mask with light-radius holes)
      if (lightTexture) lightTexture.destroy(true);
      if (lightSprite) { lightSprite.parent?.removeChild(lightSprite); lightSprite.destroy(); }
      lightTexture = PIXI.RenderTexture.create({ width: texture.width, height: texture.height });
      lightSprite = new PIXI.Sprite(lightTexture);
      lightSprite.alpha = isGM ? 0.6 : 0.92;
      lightSprite.visible = false;
      worldContainer.addChildAt(lightSprite, worldContainer.getChildIndex(tokenLayer) + 1);

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
    renderLighting();
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
    // Couleur brouillard : navy sombre avec nuance bleue/violette
    const bg = new PIXI.Graphics()
      .rect(0, 0, backgroundSprite.texture.width, backgroundSprite.texture.height)
      .fill(0x0a0e1a);
    container.addChild(bg);

    // Couche de texture brouillard (cercles semi-transparents aléatoires)
    for (let i = 0; i < 80; i++) {
      const fx = Math.random() * backgroundSprite.texture.width;
      const fy = Math.random() * backgroundSprite.texture.height;
      const fr = 40 + Math.random() * 120;
      const fg2 = new PIXI.Graphics()
        .circle(fx, fy, fr)
        .fill({ color: 0x1a2540, alpha: 0.18 + Math.random() * 0.15 });
      container.addChild(fg2);
    }

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

  function renderLighting() {
    if (!lightTexture || !lightSprite || !backgroundSprite || !app) return;

    const hasLights = tokens.some(t => t.lightRadius && t.lightRadius > 0);
    lightSprite.visible = hasLights;
    if (!hasLights) return;

    const container = new PIXI.Container();
    // Full darkness base
    const darkness = new PIXI.Graphics()
      .rect(0, 0, backgroundSprite.texture.width, backgroundSprite.texture.height)
      .fill({ color: 0x000000, alpha: 1 });
    container.addChild(darkness);

    // Render lights with shadow polygons
    tokens.forEach(token => {
      if (!token.lightRadius || token.lightRadius <= 0) return;
      const r = token.lightRadius * gridSize;
      const lx = token.x;
      const ly = token.y;

      // Un sous-container par lumière pour gérer les ombres locales
      const lightCont = new PIXI.Container();
      lightCont.blendMode = 'erase';
      
      const g = new PIXI.Graphics();
      // On commence par dessiner la lumière
      g.circle(lx, ly, r).fill({ color: 0xffffff, alpha: 1 });
      g.circle(lx, ly, r * 1.4).fill({ color: 0xffffff, alpha: 0.35 });

      // On dessine les ombres (en mode "reverse erase" ou simplement en dessinant du noir)
      // Mais ici on est dans un container qui va être "erased", donc on doit "re-remplir"
      // avec du noir ce qui doit rester sombre.
      // PIXI v8 blend modes : on va utiliser un container intermédiaire.
      
      walls.forEach(wall => {
        if (wall.type === 'door' && wall.isOpen) return;
        for (let i = 0; i < wall.points.length - 1; i++) {
          const p1 = wall.points[i];
          const p2 = wall.points[i+1];
          
          const dx1 = p1.x - lx; const dy1 = p1.y - ly;
          const dx2 = p2.x - lx; const dy2 = p2.y - ly;
          const ext = 5000;
          const p1Ext = { x: p1.x + dx1 * ext, y: p1.y + dy1 * ext };
          const p2Ext = { x: p2.x + dx2 * ext, y: p2.y + dy2 * ext };
          
          g.moveTo(p1.x, p1.y);
          g.lineTo(p2.x, p2.y);
          g.lineTo(p2Ext.x, p2Ext.y);
          g.lineTo(p1Ext.x, p1Ext.y);
          g.closePath();
          g.fill({ color: 0x000000, alpha: 1 });
        }
      });
      
      lightCont.addChild(g);
      container.addChild(lightCont);
    });

    app.renderer.render({ container, target: lightTexture, clear: true });
    container.destroy({ children: true });
  }

  function isTokenRevealed(tx: number, ty: number): boolean {
    if (!fowEnabled) return true;
    function covers(s: FowShape): boolean {
      if (s.type === 'circle') {
        const dx = tx - s.x, dy = ty - s.y;
        return Math.sqrt(dx * dx + dy * dy) <= (s.radius ?? 0);
      }
      const w = s.width ?? 0, h = s.height ?? 0;
      const x1 = w >= 0 ? s.x : s.x + w;
      const y1 = h >= 0 ? s.y : s.y + h;
      return tx >= x1 && tx <= x1 + Math.abs(w) && ty >= y1 && ty <= y1 + Math.abs(h);
    }
    // Le token est révélé s'il est dans une zone reveal ET pas dans une zone hide (hide masque un reveal)
    const inReveal = fowShapes.some(s => s.op === 'reveal' && covers(s));
    if (!inReveal) return false;
    const inHide = fowShapes.some(s => s.op === 'hide' && covers(s));
    return !inHide;
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
      // Côté joueur : masquer les tokens avec visible === false
      if (!isGM && token.visible === false) {
        const existing = tokenSprites.get(token.id);
        if (existing) existing.visible = false;
        return;
      }

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
          container.on('rightclick', (e) => {
            e.stopPropagation();
            if (e.shiftKey) {
              editingTokenId = token.id;
            } else {
              condWheelTokenId = token.id;
              condWheelX = e.global.x;
              condWheelY = e.global.y;
            }
          });
          container.on('pointerenter', () => {
            hoveredTokenId = token.id;
            if (vttMode === 'select') {
              const rh = (container as any).__resizeHandle as PIXI.Graphics | undefined;
              if (rh) rh.visible = true;
            }
          });
          container.on('pointerleave', () => {
            if (hoveredTokenId === token.id) hoveredTokenId = null;
            if (!selectedTokenIds.has(token.id)) {
              const rh = (container as any).__resizeHandle as PIXI.Graphics | undefined;
              if (rh) rh.visible = false;
            }
          });
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

      // Aura (dessinée en premier = sous le token)
      if (token.auraRadius && token.auraRadius > 0) {
        const ac = token.auraColor ?? 0x3b82f6;
        circleG.circle(0, 0, r + token.auraRadius).fill({ color: ac, alpha: 0.14 });
        circleG.setStrokeStyle({ width: 2, color: ac, alpha: 0.45 });
        circleG.circle(0, 0, r + token.auraRadius).stroke();
      }

      const color = token.isEnemy ? 0xef4444 : (token.color || 0x3b82f6);
      
      // Toujours centrer le container et ses enfants
      tokenSprite.position.set(0, 0);
      tokenSprite.anchor.set(0.5);

      if (token.imageUrl) {
        const isBuiltin = token.imageUrl.startsWith('/');
        const vPath = vaultPath || getVaultPath();
        if (!vPath && !isBuiltin) { tokenSprite.visible = false; return; }

        const cacheKey = isBuiltin ? token.imageUrl : (vPath + '/' + token.imageUrl);

        if (tokenSprite.texture?.label === cacheKey && tokenSprite.texture.width > 0) {
          // Texture déjà en cache — appliquer taille et rendre visible
          tokenSprite.visible = true;
          tokenSprite.width = token.size;
          tokenSprite.height = token.size;
        } else if (!loadingTextures.has(cacheKey)) {
          tokenSprite.visible = false;
          loadingTextures.add(cacheKey);

          if (isBuiltin) {
            // Chargement direct pour les assets built-in
            PIXI.Assets.load(token.imageUrl).then(tex => {
              if (container && tokenSprite) {
                tex.label = cacheKey;
                tokenSprite.texture = tex;
                tokenSprite.width = token.size;
                tokenSprite.height = token.size;
                tokenSprite.visible = true;
              }
              loadingTextures.delete(cacheKey);
            }).catch(() => {
              loadingTextures.delete(cacheKey);
              tokenSprite.visible = false;
            });
          } else {
            // Même stratégie que la carte : readFileBase64 → data URL → Image → Texture
            const ext = token.imageUrl.split('.').pop()?.toLowerCase() ?? 'png';
            const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : `image/${ext}`;

            readFileBase64(cacheKey).then(b64 => {
              const img = new Image();
              img.onload = () => {
                if (container && tokenSprite) {
                  const tex = PIXI.Texture.from(img);
                  tex.label = cacheKey;
                  tokenSprite.texture = tex;
                  tokenSprite.width = token.size;
                  tokenSprite.height = token.size;
                  tokenSprite.visible = true;
                }
                loadingTextures.delete(cacheKey);
              };
              img.onerror = () => {
                loadingTextures.delete(cacheKey);
                tokenSprite.visible = false;
              };
              img.src = `data:${mime};base64,${b64}`;
            }).catch(err => {
              console.error('Token image load error:', cacheKey, err);
              loadingTextures.delete(cacheKey);
              tokenSprite.visible = false;
            });
          }
        }
        // Si chargement en cours : on ne touche pas à visible
        
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

      // Barre de vie — proportionnelle au token
      hpBar.clear();
      if (token.maxHp && token.maxHp > 0) {
        const hp = token.hp ?? token.maxHp;
        const pct = Math.max(0, Math.min(1, hp / token.maxHp));
        const barW = Math.max(30, token.size * 0.85);
        const barH = Math.max(5, token.size * 0.1);
        hpBar.rect(-barW / 2, r + 4, barW, barH);
        hpBar.fill({ color: 0x000000, alpha: 0.8 });
        hpBar.rect(-barW / 2 + 1, r + 5, (barW - 2) * pct, barH - 2);
        hpBar.fill(pct > 0.5 ? 0x22c55e : pct > 0.2 ? 0xeab308 : 0xef4444);
      }

      // Indicateur visuel "caché aux joueurs" — cercle pointillé côté GM
      if (isGM) {
        container.alpha = token.visible === false ? 0.45 : 1;
      }

      // Anneau de sélection (multi-select)
      if (isGM && selectedTokenIds.has(token.id)) {
        let selRing = (container as any).__selRing as PIXI.Graphics | undefined;
        if (!selRing) {
          selRing = new PIXI.Graphics();
          container.addChild(selRing);
          (container as any).__selRing = selRing;
        }
        selRing.clear();
        selRing.setStrokeStyle({ width: 2, color: 0x6366f1, alpha: 0.9 });
        selRing.circle(0, 0, r + 5).stroke();
      } else {
        const selRing = (container as any).__selRing as PIXI.Graphics | undefined;
        if (selRing) { container.removeChild(selRing); selRing.destroy(); delete (container as any).__selRing; }
      }

      // Poignée de redimensionnement (tout token sélectionné ou survolé, mode select)
      if (isGM) {
        let rh = (container as any).__resizeHandle as PIXI.Graphics | undefined;
        if (!rh) {
          rh = new PIXI.Graphics();
          rh.eventMode = 'static';
          rh.cursor = 'nwse-resize';
          rh.on('pointerdown', (ev: PIXI.FederatedPointerEvent) => {
            ev.stopPropagation();
            isResizing = true;
            resizingTokenId = token.id;
          });
          container.addChild(rh);
          (container as any).__resizeHandle = rh;
        }
        const hp = r * 0.707 + 4;
        rh.clear();
        rh.circle(hp, hp, 6).fill(0xffffff);
        rh.setStrokeStyle({ width: 2, color: 0x6366f1, alpha: 1 });
        rh.circle(hp, hp, 6).stroke();
        // Visible si sélectionné, ou si survolé en mode select
        rh.visible = vttMode === 'select' && (selectedTokenIds.has(token.id) || hoveredTokenId === token.id);
      } else {
        const rh = (container as any).__resizeHandle as PIXI.Graphics | undefined;
        if (rh) rh.visible = false;
      }

      // Anneau de concentration
      let concRing = (container as any).__concRing as PIXI.Graphics | undefined;
      if (token.concentrating) {
        if (!concRing) {
          concRing = new PIXI.Graphics();
          container.addChild(concRing);
          (container as any).__concRing = concRing;
        }
        concRing.clear();
        concRing.setStrokeStyle({ width: 3, color: 0xa855f7, alpha: 0.9 });
        concRing.circle(0, 0, r + 9).stroke();
        concRing.setStrokeStyle({ width: 1, color: 0xa855f7, alpha: 0.4 });
        concRing.circle(0, 0, r + 14).stroke();
      } else if (concRing) {
        container.removeChild(concRing); concRing.destroy(); delete (container as any).__concRing;
      }

      // Spotlight halo (doré pulsant — visible côté joueur et GM)
      let spotRing = (container as any).__spotRing as PIXI.Graphics | undefined;
      if (spotlightTokenId === token.id) {
        if (!spotRing) {
          spotRing = new PIXI.Graphics();
          container.addChildAt(spotRing, 0); // sous tout le reste
          (container as any).__spotRing = spotRing;
        }
        spotRing.clear();
        spotRing.setStrokeStyle({ width: 6, color: 0xe5a853, alpha: 0.85 });
        spotRing.circle(0, 0, r + 16).stroke();
        spotRing.setStrokeStyle({ width: 2, color: 0xfde68a, alpha: 0.4 });
        spotRing.circle(0, 0, r + 26).stroke();
        spotRing.circle(0, 0, r + 16).fill({ color: 0xe5a853, alpha: 0.06 });
      } else if (spotRing) {
        container.removeChild(spotRing); spotRing.destroy(); delete (container as any).__spotRing;
      }

      // Conditions
      const condStr = (token.conditions ?? []).map(c => CONDITION_EMOJIS[c] ?? '').join('');
      let condText = (container as any).__condText as PIXI.Text | undefined;
      if (condStr) {
        if (!condText) {
          condText = new PIXI.Text({ text: condStr, style: { fontFamily: 'sans-serif', fontSize: 14, fill: 0xffffff, stroke: { color: 0x000000, width: 2 } } });
          condText.anchor.set(0.5, 0);
          container.addChild(condText);
          (container as any).__condText = condText;
        }
        condText.text = condStr;
        condText.y = r + 13;
      } else if (condText) {
        container.removeChild(condText); condText.destroy(); delete (container as any).__condText;
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

    // Alt + hover over token → resize token
    if (e.altKey && hoveredTokenId && isGM && vttMode === 'select') {
      const tok = tokens.find(t => t.id === hoveredTokenId);
      if (tok) {
        const step = Math.max(5, Math.round(tok.size * 0.1));
        const newSize = Math.max(10, Math.min(400, tok.size + (e.deltaY > 0 ? -step : step)));
        if (newSize !== tok.size) onTokenUpdate({ ...tok, size: newSize });
        return;
      }
    }

    const rawDelta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, worldContainer.scale.x * rawDelta));
    const zoomDelta = newScale / worldContainer.scale.x;

    const globalPos = new PIXI.Point(e.offsetX, e.offsetY);
    const localPos = worldContainer.toLocal(globalPos);

    worldContainer.scale.x = newScale;
    worldContainer.scale.y = newScale;

    worldContainer.x = globalPos.x - localPos.x * worldContainer.scale.x;
    worldContainer.y = globalPos.y - localPos.y * worldContainer.scale.y;

    emitCameraThrottled();
  }

  function onTokenPointerDown(e: any, id: string) {
    e.stopPropagation();
    if (e.button === 2) {
      if (e.shiftKey) {
        editingTokenId = id;
        return;
      }
      condWheelTokenId = id;
      condWheelX = e.global?.x ?? 400; condWheelY = e.global?.y ?? 300;
    } else if (vttMode === 'select') {
      if (e.shiftKey) {
        const newSel = new Set(selectedTokenIds);
        if (newSel.has(id)) newSel.delete(id); else newSel.add(id);
        selectedTokenIds = newSel;
      } else {
        if (!selectedTokenIds.has(id)) selectedTokenIds = new Set();
        draggedTokenId = id;
        const mainToken = tokens.find(t => t.id === id);
        if (mainToken) {
          movePathStart = { x: mainToken.x, y: mainToken.y };
          dragOffsets = new Map();
          for (const selId of selectedTokenIds) {
            if (selId === id) continue;
            const st = tokens.find(t => t.id === selId);
            if (st) dragOffsets.set(selId, { dx: st.x - mainToken.x, dy: st.y - mainToken.y });
          }
        }
      }
    }
  }

  // Track whether we're actively painting dungeon tiles
  let isDungeonPainting = false;

  // Token resize
  let hoveredTokenId: string | null = null;
  let isResizing = false;
  let resizingTokenId: string | null = null;

  function updateDungeonHover(col: number, row: number, isErase: boolean) {
    if (col === lastHoverCol && row === lastHoverRow) return;
    lastHoverCol = col;
    lastHoverRow = row;
    dungeonHoverG.clear();
    const color = isErase ? 0xef4444 : 0x3b82f6;
    dungeonHoverG
      .rect(col * gridSize, row * gridSize, gridSize, gridSize)
      .fill({ color, alpha: 0.25 });
    dungeonHoverG.setStrokeStyle({ width: 2, color, alpha: 1 });
    dungeonHoverG
      .rect(col * gridSize, row * gridSize, gridSize, gridSize)
      .stroke();
  }

  function clearDungeonHover() {
    dungeonHoverG?.clear();
    lastHoverCol = -1;
    lastHoverRow = -1;
  }

  function onPointerDown(e: PIXI.FederatedPointerEvent) {
    if (vttMode === 'dungeon-paint') {
      isDungeonPainting = true;
      pushDungeonUndo();
      const localPos = worldContainer.toLocal(e.global);
      const col = Math.floor(localPos.x / gridSize);
      const row = Math.floor(localPos.y / gridSize);
      const isErase = e.button === 2;
      updateDungeonHover(col, row, isErase);
      setDungeonTile(col, row, isErase ? 'void' : vttStore.dungeonBrush);
      return;
    }

    if (e.button === 1 || e.button === 2) {
      isPanning = true;
      lastPanX = e.global.x;
      lastPanY = e.global.y;
      return;
    }

    // Clic sur zone vide en mode select → désélectionner tout
    if (vttMode === 'select') {
      selectedTokenIds = new Set();
      return;
    }

    if (vttMode === 'ping' || vttMode === 'pin') return;

    if (vttMode === 'draw' || vttMode === 'blueprint') {
      const localPos = worldContainer.toLocal(e.global);
      isFreeDraw = true;
      currentFreeDrawPoints = [{ x: localPos.x, y: localPos.y }];
      currentFreeDrawG = new PIXI.Graphics();
      if (vttMode === 'draw') drawLayer.addChild(currentFreeDrawG);
      else wallLayer.addChild(currentFreeDrawG);
      return;
    }

    const localPos = worldContainer.toLocal(e.global);
    isDrawing = true;
    drawStartX = localPos.x;
    drawStartY = localPos.y;
  }

  function zoomToRect(x1: number, y1: number, x2: number, y2: number) {
    const rectX = Math.min(x1, x2);
    const rectY = Math.min(y1, y2);
    const rectW = Math.abs(x2 - x1);
    const rectH = Math.abs(y2 - y1);
    if (rectW < 10 || rectH < 10) return;
    const { width, height } = app.screen;
    const newScale = Math.min(width / rectW, height / rectH) * 0.95;
    worldContainer.scale.set(newScale);
    worldContainer.x = width / 2 - (rectX + rectW / 2) * newScale;
    worldContainer.y = height / 2 - (rectY + rectH / 2) * newScale;
    emitCamera();
  }

  function onPointerMove(e: PIXI.FederatedPointerEvent) {
    if (isResizing && resizingTokenId) {
      const tok = tokens.find(t => t.id === resizingTokenId);
      if (tok) {
        const localPos = worldContainer.toLocal(e.global);
        const dx = localPos.x - tok.x;
        const dy = localPos.y - tok.y;
        const newSize = Math.max(10, Math.min(400, Math.round(Math.sqrt(dx * dx + dy * dy) * 2)));
        if (newSize !== tok.size) onTokenUpdate({ ...tok, size: newSize });
      }
      return;
    }

    if (vttMode === 'dungeon-paint') {
      const localPos = worldContainer.toLocal(e.global);
      const col = Math.floor(localPos.x / gridSize);
      const row = Math.floor(localPos.y / gridSize);
      const isErase = e.buttons === 2;
      updateDungeonHover(col, row, isErase);
      if (isDungeonPainting) {
        setDungeonTile(col, row, isErase ? 'void' : vttStore.dungeonBrush);
      }
      return;
    }

    if (isPanning) {
      const dx = e.global.x - lastPanX;
      const dy = e.global.y - lastPanY;
      worldContainer.x += dx;
      worldContainer.y += dy;
      lastPanX = e.global.x;
      lastPanY = e.global.y;
      emitCameraThrottled();
      return;
    }

    if (isFreeDraw && currentFreeDrawG && (vttMode === 'draw' || vttMode === 'blueprint')) {
      const localPos = worldContainer.toLocal(e.global);
      currentFreeDrawPoints.push({ x: localPos.x, y: localPos.y });
      currentFreeDrawG.clear();
      const color = vttMode === 'blueprint' ? 0x00ffff : drawColor;
      const width = vttMode === 'blueprint' ? 3 : drawWidth;
      currentFreeDrawG.setStrokeStyle({ width, color, cap: 'round', join: 'round' });
      currentFreeDrawG.moveTo(currentFreeDrawPoints[0].x, currentFreeDrawPoints[0].y);
      for (let i = 1; i < currentFreeDrawPoints.length; i++) {
        currentFreeDrawG.lineTo(currentFreeDrawPoints[i].x, currentFreeDrawPoints[i].y);
      }
      currentFreeDrawG.stroke();
      if (vttMode === 'blueprint') {
        currentFreeDrawG.circle(currentFreeDrawPoints[0].x, currentFreeDrawPoints[0].y, 4).fill(color);
        currentFreeDrawG.circle(localPos.x, localPos.y, 4).fill(color);
      }
      return;
    }

    if (draggedTokenId && backgroundSprite) {
      const localPos = worldContainer.toLocal(e.global);
      const sprite = tokenSprites.get(draggedTokenId);
      if (sprite) {
        sprite.x = localPos.x;
        sprite.y = localPos.y;
        for (const [selId, off] of dragOffsets) {
          const sel = tokenSprites.get(selId);
          if (sel) { sel.x = localPos.x + off.dx; sel.y = localPos.y + off.dy; }
        }
        // Chemin de déplacement
        if (movePathStart && movePathG) {
          const dx = localPos.x - movePathStart.x;
          const dy = localPos.y - movePathStart.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const cases = Math.round((dist / gridSize) * 10) / 10;
          movePathG.clear();
          movePathG.setStrokeStyle({ width: 2, color: 0xfbbf24, alpha: 0.85 });
          // Ligne pointillée
          const steps = Math.ceil(dist / 12);
          for (let i = 0; i < steps; i++) {
            const t0 = i / steps;
            const t1 = Math.min(1, (i + 0.55) / steps);
            movePathG.moveTo(movePathStart.x + dx * t0, movePathStart.y + dy * t0);
            movePathG.lineTo(movePathStart.x + dx * t1, movePathStart.y + dy * t1);
          }
          movePathG.stroke();
          movePathG.circle(movePathStart.x, movePathStart.y, 4).fill({ color: 0xfbbf24, alpha: 0.9 });
          if (!movePathG.children[0]) {
            const distText = new PIXI.Text({ text: '', style: { fontFamily: 'sans-serif', fontSize: 13, fontWeight: 'bold', fill: 0xfbbf24, stroke: { color: 0x000000, width: 3 } } });
            distText.anchor.set(0.5);
            movePathG.addChild(distText);
          }
          const distLabel = movePathG.children[0] as PIXI.Text;
          distLabel.text = `${cases} case${cases !== 1 ? 's' : ''}`;
          distLabel.x = movePathStart.x + dx / 2;
          distLabel.y = movePathStart.y + dy / 2 - 14;
        }
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
      } else if (vttMode === 'fog-rect') {
        if (previewShape.children[0]) previewShape.children[0].visible = false;
        const dx = localPos.x - drawStartX;
        const dy = localPos.y - drawStartY;
        previewShape.setStrokeStyle({ width: 2, color: 0x00aaff, alpha: 0.9 });
        previewShape.rect(drawStartX, drawStartY, dx, dy);
        previewShape.fill({ color: 0x00aaff, alpha: 0.15 });
        previewShape.stroke();
      } else if (vttMode === 'zoom-rect') {
        if (previewShape.children[0]) previewShape.children[0].visible = false;
        const dx = localPos.x - drawStartX;
        const dy = localPos.y - drawStartY;
        previewShape.setStrokeStyle({ width: 2, color: 0xf59e0b, alpha: 1 });
        previewShape.rect(drawStartX, drawStartY, dx, dy);
        previewShape.fill({ color: 0xf59e0b, alpha: 0.12 });
        previewShape.stroke();
      } else if (vttMode === 'terrain') {
        if (previewShape.children[0]) previewShape.children[0].visible = false;
        const dx = localPos.x - drawStartX;
        const dy = localPos.y - drawStartY;
        const tColor = TERRAIN_COLORS[vttStore.terrainType] ?? 0x7f4f00;
        previewShape.setStrokeStyle({ width: 2, color: tColor, alpha: 0.9 });
        previewShape.rect(drawStartX, drawStartY, dx, dy);
        previewShape.fill({ color: tColor, alpha: 0.22 });
        previewShape.stroke();
      } else {
        if (previewShape.children[0]) previewShape.children[0].visible = false;
        const isReveal = vttMode === 'fog-reveal';
        const dx = localPos.x - drawStartX;
        const dy = localPos.y - drawStartY;
        const radius = Math.sqrt(dx * dx + dy * dy);

        previewShape.setStrokeStyle({ width: 2, color: isReveal ? 0x00ff00 : 0xff0000, alpha: 0.8 });
        previewShape.circle(drawStartX, drawStartY, radius);
        previewShape.fill({ color: isReveal ? 0x00ff00 : 0xff0000, alpha: 0.2 });
        previewShape.stroke();
      }
    }
  }

  function onPointerUp(e: PIXI.FederatedPointerEvent) {
    if (isResizing) {
      isResizing = false;
      resizingTokenId = null;
      return;
    }

    if (isDungeonPainting) {
      isDungeonPainting = false;
      return;
    }

    if (isPanning) {
      isPanning = false;
      emitCamera();
      return;
    }

    if (isFreeDraw && (vttMode === 'draw' || vttMode === 'blueprint')) {
      isFreeDraw = false;
      if (currentFreeDrawPoints.length >= 2) {
        if (vttMode === 'draw') {
          const path: DrawPath = {
            id: Math.random().toString(36).slice(2),
            points: [...currentFreeDrawPoints],
            color: drawColor,
            width: drawWidth,
          };
          if (currentFreeDrawG) { drawLayer.removeChild(currentFreeDrawG); currentFreeDrawG.destroy(); currentFreeDrawG = null; }
          onDrawPath(path);
        } else {
          // Blueprint Wall
          addGmWall([...currentFreeDrawPoints]);
          if (currentFreeDrawG) { wallLayer.removeChild(currentFreeDrawG); currentFreeDrawG.destroy(); currentFreeDrawG = null; }
        }
      } else {
        if (currentFreeDrawG) {
          if (vttMode === 'draw') drawLayer.removeChild(currentFreeDrawG);
          else wallLayer.removeChild(currentFreeDrawG);
          currentFreeDrawG.destroy(); currentFreeDrawG = null;
        }
      }
      currentFreeDrawPoints = [];
      return;
    }

    if (draggedTokenId && backgroundSprite) {
      let localPos = worldContainer.toLocal(e.global);
      if (gridEnabled) {
        localPos.x = Math.floor(localPos.x / gridSize) * gridSize + gridSize / 2;
        localPos.y = Math.floor(localPos.y / gridSize) * gridSize + gridSize / 2;
      }
      onTokenMove(draggedTokenId, localPos.x, localPos.y);
      // Finaliser le déplacement groupé
      for (const [selId, off] of dragOffsets) {
        let sx = localPos.x + off.dx;
        let sy = localPos.y + off.dy;
        if (gridEnabled) {
          sx = Math.floor(sx / gridSize) * gridSize + gridSize / 2;
          sy = Math.floor(sy / gridSize) * gridSize + gridSize / 2;
        }
        onTokenMove(selId, sx, sy);
      }
      dragOffsets = new Map();
      draggedTokenId = null;
      movePathStart = null;
      if (movePathG) movePathG.clear();
    } else if (isDrawing && backgroundSprite) {
      isDrawing = false;
      previewShape.clear();

      if (vttMode === 'measure') return;

      const localPos = worldContainer.toLocal(e.global);
      const dx = localPos.x - drawStartX;
      const dy = localPos.y - drawStartY;

      if (vttMode === 'zoom-rect') {
        zoomToRect(drawStartX, drawStartY, localPos.x, localPos.y);
        return;
      }
      if (vttMode === 'audio-zone') {
        const radius = Math.sqrt(dx*dx + dy*dy);
        if (radius > 10) {
          // Utiliser la musique actuelle comme source par défaut ou demander ?
          // Pour l'instant on utilise une source placeholder ou la piste 1
          addGmAudioZone(drawStartX, drawStartY, radius, vttStore.audioSrc || '');
        }
        return;
      }

      if (vttMode === 'fog-rect') {
        if (Math.abs(dx) > 5 && Math.abs(dy) > 5) {
          onFowUpdate({ type: 'rect', op: 'reveal', x: drawStartX, y: drawStartY, width: dx, height: dy });
        }
        return;
      }

      if (vttMode === 'terrain') {
        if (Math.abs(dx) > 10 && Math.abs(dy) > 10) {
          addTerrainZone({
            id: Math.random().toString(36).slice(2),
            x: dx > 0 ? drawStartX : drawStartX + dx,
            y: dy > 0 ? drawStartY : drawStartY + dy,
            w: Math.abs(dx),
            h: Math.abs(dy),
            type: vttStore.terrainType,
          });
        }
        return;
      }

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

  function onPointerDownForPing(e: PIXI.FederatedPointerEvent) {
    if (e.button !== 0) return;
    if (vttMode === 'ping') {
      const localPos = worldContainer.toLocal(e.global);
      spawnPing(localPos.x, localPos.y);
      import('@tauri-apps/api/event').then(({ emit }) => {
        emit('player_ping', { x: localPos.x, y: localPos.y });
      });
    } else if (vttMode === 'pin') {
      const localPos = worldContainer.toLocal(e.global);
      onPinPlace(localPos.x, localPos.y);
    } else if (vttMode === 'spell') {
      const localPos = worldContainer.toLocal(e.global);
      onSpellPlace(localPos.x, localPos.y);
    }
  }

  function spawnPing(x: number, y: number) {
    if (!pingLayer) return;
    const g = new PIXI.Graphics();
    pingLayer.addChild(g);
    pingMarkers.push({ g, born: Date.now() });
    animatePing(g, x, y);
  }

  function renderPins() {
    if (!pinLayer) return;

    for (const [id, c] of pinContainers) {
      if (!pins.find(p => p.id === id)) {
        pinLayer.removeChild(c);
        c.destroy({ children: true });
        pinContainers.delete(id);
      }
    }

    pins.forEach(pin => {
      // Côté joueur : masquer les pins non visibles et les pins secrètes non révélées
      if (!isGM && (pin.playerVisible === false || (pin.secret && !pin.revealed))) {
        const existing = pinContainers.get(pin.id);
        if (existing) existing.visible = false;
        return;
      }

      let c = pinContainers.get(pin.id);
      if (!c) {
        c = new PIXI.Container();
        const g = new PIXI.Graphics();
        c.addChild(g);
        const label = new PIXI.Text({
          text: pin.label,
          style: { fontFamily: 'sans-serif', fontSize: 13, fill: 0xffffff, stroke: { color: 0x000000, width: 3 }, fontWeight: 'bold' }
        });
        label.anchor.set(0.5, 1.5);
        c.addChild(label);

        if (isGM) {
          c.eventMode = 'static';
          c.cursor = 'pointer';
          c.on('rightclick', (e) => {
            e.stopPropagation();
            if (pin.secret) {
              onPinReveal?.(pin.id);
            } else {
              onPinDelete?.(pin.id);
            }
          });
        }
        pinLayer.addChild(c);
        pinContainers.set(pin.id, c);
      }

      const g = c.children[0] as PIXI.Graphics;
      const label = c.children[1] as PIXI.Text;

      let col: number;
      if (pin.secret && !pin.revealed) {
        col = 0x888888; // gris — secret non révélé
      } else if (pin.secret && pin.revealed) {
        col = 0x22c55e; // vert — révélé aux joueurs
      } else {
        col = pin.color ?? (isGM ? 0xe5a853 : 0xff6b6b);
      }

      g.clear();
      g.circle(0, -16, 10).fill({ color: col }).stroke();
      g.setStrokeStyle({ width: 2, color: col });
      g.moveTo(0, -6).lineTo(0, 0).stroke();

      // Afficher 🔒 ou 🔓 pour les pins secrètes (GM seulement)
      if (isGM && pin.secret) {
        label.text = (pin.revealed ? '🔓 ' : '🔒 ') + pin.label;
      } else {
        label.text = pin.label;
      }
      c.x = pin.x;
      c.y = pin.y;
      c.visible = true;
    });
  }

  function renderSpells() {
    if (!spellLayer) return;
    for (const [id, c] of spellContainers) {
      if (!spells.find(s => s.id === id)) {
        spellLayer.removeChild(c); c.destroy({ children: true }); spellContainers.delete(id);
      }
    }
    spells.forEach(spell => {
      let c = spellContainers.get(spell.id);
      if (!c) {
        c = new PIXI.Container();
        const g = new PIXI.Graphics();
        c.addChild(g);
        if (isGM) {
          c.eventMode = 'static';
          c.cursor = 'pointer';
          c.on('rightclick', (e) => { e.stopPropagation(); onSpellDelete(spell.id); });
        }
        if (spell.label) {
          const t = new PIXI.Text({ text: spell.label, style: { fill: 0xffffff, fontSize: 13, stroke: { color: 0x000000, width: 3 } } });
          t.anchor.set(0.5); t.y = -(spell.radius + 14);
          c.addChild(t);
        }
        spellLayer.addChild(c);
        spellContainers.set(spell.id, c);
      }

      const g = c.children[0] as PIXI.Graphics;
      g.clear();
      const col = SPELL_COLORS[spell.type] ?? 0xffffff;
      const shape = spell.shape ?? 'circle';

      if (shape === 'cone') {
        const angle = spell.angle ?? 0;
        const halfCone = (spell.coneAngle ?? Math.PI / 3) / 2;
        const r = spell.radius;
        g.moveTo(0, 0);
        g.lineTo(Math.cos(angle - halfCone) * r, Math.sin(angle - halfCone) * r);
        g.arc(0, 0, r, angle - halfCone, angle + halfCone);
        g.lineTo(0, 0);
        g.fill({ color: col, alpha: 0.35 });
        g.setStrokeStyle({ width: 2, color: col, alpha: 0.8 });
        g.moveTo(0, 0);
        g.lineTo(Math.cos(angle - halfCone) * r, Math.sin(angle - halfCone) * r);
        g.arc(0, 0, r, angle - halfCone, angle + halfCone);
        g.lineTo(0, 0);
        g.stroke();
      } else if (shape === 'line') {
        const angle = spell.angle ?? 0;
        const len = spell.length ?? 200;
        const w = spell.radius / 4;
        const cosA = Math.cos(angle); const sinA = Math.sin(angle);
        const perpX = -sinA * w; const perpY = cosA * w;
        g.moveTo(perpX, perpY);
        g.lineTo(cosA * len + perpX, sinA * len + perpY);
        g.lineTo(cosA * len - perpX, sinA * len - perpY);
        g.lineTo(-perpX, -perpY);
        g.closePath();
        g.fill({ color: col, alpha: 0.35 });
        g.setStrokeStyle({ width: 2, color: col, alpha: 0.8 });
        g.moveTo(perpX, perpY);
        g.lineTo(cosA * len + perpX, sinA * len + perpY);
        g.lineTo(cosA * len - perpX, sinA * len - perpY);
        g.lineTo(-perpX, -perpY);
        g.closePath();
        g.stroke();
      } else {
        // Cercle par défaut
        g.circle(0, 0, spell.radius).fill({ color: col, alpha: 0.25 });
        g.setStrokeStyle({ width: 2, color: col, alpha: 0.8 });
        g.circle(0, 0, spell.radius).stroke();
      }

      c.x = spell.x; c.y = spell.y;
    });
  }

  function triggerShake(intensity = 12, duration = 400) {
    shakeIntensity = intensity; shakeDuration = duration; shakeStart = Date.now();
  }

  function spawnDeathEffect(wx: number, wy: number) {
    if (!pingLayer) return;
    const skull = new PIXI.Text({ text: '💀', style: { fontSize: 34 } });
    skull.anchor.set(0.5); skull.x = wx; skull.y = wy;
    pingLayer.addChild(skull);
    spawnBloodSpatters(wx, wy, 15);
    let start = 0;
    const dur = 1400;
    function step(ts: number) {
      if (!start) start = ts;
      const t = (ts - start) / dur;
      if (t >= 1) { pingLayer?.removeChild(skull); skull.destroy(); return; }
      skull.y = wy - t * 55; skull.alpha = 1 - t; skull.scale.set(1 + t * 0.6);
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function spawnBloodSpatters(wx: number, wy: number, count = 8) {
    if (!particleLayer) return;
    for (let i = 0; i < count; i++) {
      const g = new PIXI.Graphics().circle(0, 0, 1.5 + Math.random() * 2.5).fill({ color: 0x990000, alpha: 0.9 });
      g.x = wx; g.y = wy;
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      particles.push({
        g, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.6, type: 'blood'
      });
      particleLayer.addChild(g);
    }
  }

  function triggerLightning() {
    if (!app) return;
    const flash = new PIXI.Graphics().rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0xffffff, alpha: 0.8 });
    app.stage.addChild(flash);
    triggerShake(15, 200);
    setTimeout(() => {
      flash.alpha = 0.4;
      setTimeout(() => {
        app.stage.removeChild(flash);
        flash.destroy();
      }, 50);
    }, 100);
  }

  function flashTokenDamage(container: PIXI.Container, damage: number) {
    spawnBloodSpatters(container.x, container.y, 6);
    const flashG = new PIXI.Graphics();
    container.addChild(flashG);
    const dmgText = new PIXI.Text({
      text: `-${damage}`,
      style: { fill: 0xff4444, fontSize: 18, fontWeight: 'bold', stroke: { color: 0x000000, width: 3 } }
    });
    dmgText.anchor.set(0.5); dmgText.y = -40;
    container.addChild(dmgText);
    let start = 0;
    const dur = 700;
    function step(ts: number) {
      if (!start) start = ts;
      const t = (ts - start) / dur;
      if (t >= 1) {
        if (container.children.includes(flashG)) container.removeChild(flashG);
        if (container.children.includes(dmgText)) container.removeChild(dmgText);
        flashG.destroy(); dmgText.destroy(); return;
      }
      flashG.clear();
      flashG.circle(0, 0, 28).fill({ color: 0xff2200, alpha: Math.max(0, 0.55 - t * 0.55) });
      dmgText.y = -40 - t * 28; dmgText.alpha = 1 - t;
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function onCanvasDragOver(e: DragEvent) {
    if (!isGM || !backgroundSprite) return;
    if (e.dataTransfer?.types.includes('vtt/token-image')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  function onCanvasDrop(e: DragEvent) {
    if (!isGM || !worldContainer || !backgroundSprite) return;
    const imagePath = e.dataTransfer?.getData('vtt/token-image');
    if (!imagePath) return;
    e.preventDefault();
    const rect = canvasContainer.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const local = worldContainer.toLocal(new PIXI.Point(screenX, screenY));
    let x = local.x;
    let y = local.y;
    if (gridEnabled) {
      x = Math.floor(x / gridSize) * gridSize + gridSize / 2;
      y = Math.floor(y / gridSize) * gridSize + gridSize / 2;
    }
    onTokenDrop(imagePath, x, y);
  }

  function renderDrawPaths() {
    if (!drawLayer) return;
    drawLayer.removeChildren();
    for (const path of drawPaths) {
      if (path.points.length < 2) continue;
      const g = new PIXI.Graphics();
      g.setStrokeStyle({ width: path.width, color: path.color, cap: 'round', join: 'round' });
      g.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) g.lineTo(path.points[i].x, path.points[i].y);
      g.stroke();
      drawLayer.addChild(g);
    }
  }

  function renderWalls() {
    if (!wallLayer) return;
    wallLayer.removeChildren();
    for (const wall of walls) {
      if (wall.points.length < 2) continue;
      const g = new PIXI.Graphics();
      const isDoor = wall.type === 'door';
      const color = isDoor ? (wall.isOpen ? 0x22c55e : 0xef4444) : 0x00ffff;
      
      g.setStrokeStyle({ width: 3, color: color, cap: 'round', join: 'round', alpha: isGM ? 1 : 0 });
      g.moveTo(wall.points[0].x, wall.points[0].y);
      for (let i = 1; i < wall.points.length; i++) g.lineTo(wall.points[i].x, wall.points[i].y);
      g.stroke();
      
      if (isDoor) {
        // Icone de porte
        const t = new PIXI.Text({ text: wall.isOpen ? '🔓' : '🚪', style: { fontSize: 16 } });
        t.anchor.set(0.5);
        t.position.set(wall.points[0].x, wall.points[0].y);
        g.addChild(t);
        
        if (isGM) {
          g.eventMode = 'static'; g.cursor = 'pointer';
          g.on('click', (e) => { e.stopPropagation(); toggleGmDoor(wall.id); });
        }
      } else {
        g.circle(wall.points[0].x, wall.points[0].y, 3).fill(color);
        g.circle(wall.points[wall.points.length - 1].x, wall.points[wall.points.length - 1].y, 3).fill(color);
      }
      wallLayer.addChild(g);
    }
    // Si on n'est pas MJ, on cache les murs (ils servent juste physiquement à l'ombre)
    wallLayer.visible = isGM;
  }

  const TERRAIN_COLORS: Record<string, number> = {
    difficult: 0x7f4f00, water: 0x0088cc, fire: 0xff4400, poison: 0x00aa00, safe: 0x00ff88, custom: 0x8844ff,
  };
  const TERRAIN_LABELS: Record<string, string> = {
    difficult:'Terrain Difficile', water:'Eau', fire:'Feu', poison:'Poison', safe:'Zone Sûre', custom:'Personnalisé',
  };

  // ── Dungeon Tiles ─────────────────────────────────────────────────
  function drawTileGraphics(g: PIXI.Graphics, type: TileType, x: number, y: number, size: number) {
    switch (type) {
      case 'floor_stone':
        g.rect(x, y, size, size).fill(0x9ca3af);
        g.setStrokeStyle({ width: 1, color: 0x6b7280, alpha: 0.5 });
        g.moveTo(x + size / 2, y).lineTo(x + size / 2, y + size).stroke();
        g.moveTo(x, y + size / 2).lineTo(x + size, y + size / 2).stroke();
        break;
      case 'wall_stone':
        g.rect(x, y, size, size).fill(0x374151);
        g.setStrokeStyle({ width: 2, color: 0x1f2937, alpha: 1 });
        g.rect(x + 2, y + 2, size / 2 - 3, size / 2 - 3).fill(0x4b5563).stroke();
        g.rect(x + size / 2 + 1, y + 2, size / 2 - 3, size / 2 - 3).fill(0x4b5563).stroke();
        g.rect(x + 2, y + size / 2 + 1, size / 2 - 3, size / 2 - 3).fill(0x4b5563).stroke();
        g.rect(x + size / 2 + 1, y + size / 2 + 1, size / 2 - 3, size / 2 - 3).fill(0x4b5563).stroke();
        break;
      case 'floor_wood':
        g.rect(x, y, size, size).fill(0x92400e);
        g.setStrokeStyle({ width: 1, color: 0xb45309, alpha: 0.6 });
        for (let i = 1; i < 4; i++) {
          g.moveTo(x, y + size * i / 4).lineTo(x + size, y + size * i / 4).stroke();
        }
        break;
      case 'wall_wood':
        g.rect(x, y, size, size).fill(0x713f12);
        g.setStrokeStyle({ width: 2, color: 0x92400e, alpha: 1 });
        for (let i = 1; i < 4; i++) {
          g.moveTo(x + size * i / 4, y).lineTo(x + size * i / 4, y + size).stroke();
        }
        break;
      case 'water':
        g.rect(x, y, size, size).fill(0x1d4ed8);
        g.setStrokeStyle({ width: 1, color: 0x3b82f6, alpha: 0.7 });
        g.moveTo(x, y + size * 0.3).bezierCurveTo(x + size * 0.3, y + size * 0.2, x + size * 0.7, y + size * 0.4, x + size, y + size * 0.3).stroke();
        g.moveTo(x, y + size * 0.6).bezierCurveTo(x + size * 0.3, y + size * 0.5, x + size * 0.7, y + size * 0.7, x + size, y + size * 0.6).stroke();
        break;
      case 'lava':
        g.rect(x, y, size, size).fill(0xea580c);
        g.ellipse(x + size * 0.3, y + size * 0.4, size * 0.2, size * 0.15).fill(0xc2410c);
        g.ellipse(x + size * 0.7, y + size * 0.6, size * 0.15, size * 0.12).fill(0xc2410c);
        break;
      case 'void':
        g.rect(x, y, size, size).fill(0x111827);
        break;
      case 'door_closed':
        g.rect(x, y, size, size).fill(0x9ca3af);
        g.rect(x + size * 0.2, y + size * 0.1, size * 0.6, size * 0.8).fill(0x92400e);
        g.setStrokeStyle({ width: 1, color: 0x713f12, alpha: 1 });
        g.rect(x + size * 0.2, y + size * 0.1, size * 0.6, size * 0.8).stroke();
        g.circle(x + size * 0.65, y + size * 0.5, size * 0.05).fill(0xfbbf24);
        break;
      case 'door_open':
        g.rect(x, y, size, size).fill(0x9ca3af);
        g.rect(x + size * 0.05, y + size * 0.1, size * 0.15, size * 0.8).fill(0x92400e);
        g.setStrokeStyle({ width: 1, color: 0x111827, alpha: 0.5 });
        g.rect(x + size * 0.05, y + size * 0.1, size * 0.15, size * 0.8).stroke();
        break;
      case 'stairs_down':
        g.rect(x, y, size, size).fill(0x9ca3af);
        g.setStrokeStyle({ width: 2, color: 0x4b5563, alpha: 1 });
        for (let i = 0; i < 5; i++) {
          const step = size / 5;
          g.rect(x + i * step * 0.5, y + i * step, size - i * step * 0.5, step).fill(i % 2 === 0 ? 0x9ca3af : 0x6b7280).stroke();
        }
        break;
      case 'stairs_up':
        g.rect(x, y, size, size).fill(0x9ca3af);
        g.setStrokeStyle({ width: 2, color: 0x4b5563, alpha: 1 });
        for (let i = 0; i < 5; i++) {
          const step = size / 5;
          g.rect(x, y + i * step, size - i * step * 0.5, step).fill(i % 2 === 0 ? 0x9ca3af : 0x6b7280).stroke();
        }
        break;
      case 'pillar':
        g.rect(x, y, size, size).fill(0x9ca3af);
        g.circle(x + size / 2, y + size / 2, size * 0.35).fill(0x4b5563);
        g.setStrokeStyle({ width: 2, color: 0x374151, alpha: 1 });
        g.circle(x + size / 2, y + size / 2, size * 0.35).stroke();
        break;
      case 'floor_dirt':
        g.rect(x, y, size, size).fill(0xd97706);
        g.circle(x + size * 0.2, y + size * 0.3, 2).fill(0xb45309);
        g.circle(x + size * 0.7, y + size * 0.6, 2).fill(0xb45309);
        g.circle(x + size * 0.5, y + size * 0.8, 2).fill(0xb45309);
        break;
      case 'chest':
        g.rect(x, y, size, size).fill(0x9ca3af);
        g.rect(x + size * 0.1, y + size * 0.3, size * 0.8, size * 0.5).fill(0x92400e);
        g.setStrokeStyle({ width: 1, color: 0x713f12, alpha: 1 });
        g.rect(x + size * 0.1, y + size * 0.3, size * 0.8, size * 0.25).fill(0xb45309).stroke();
        g.rect(x + size * 0.4, y + size * 0.45, size * 0.2, size * 0.15).fill(0xfbbf24);
        break;
      case 'trap':
        g.rect(x, y, size, size).fill(0x9ca3af);
        g.setStrokeStyle({ width: 3, color: 0xef4444, alpha: 0.9 });
        g.moveTo(x + size * 0.2, y + size * 0.2).lineTo(x + size * 0.8, y + size * 0.8).stroke();
        g.moveTo(x + size * 0.8, y + size * 0.2).lineTo(x + size * 0.2, y + size * 0.8).stroke();
        break;
    }
  }

  // Cache des textures Kenney pour les tiles de donjon
  const dungeonTexCache = new Map<string, PIXI.Texture>();

  async function getDungeonTex(type: string): Promise<PIXI.Texture | null> {
    if (dungeonTexCache.has(type)) return dungeonTexCache.get(type)!;
    try {
      const url = `/tiles/kenney/${type}.png`;
      const tex = await PIXI.Assets.load(url);
      // Nearest neighbor pour le pixel art
      tex.source.scaleMode = 'nearest';
      dungeonTexCache.set(type, tex);
      return tex;
    } catch { return null; }
  }

  async function renderDungeonTiles() {
    if (!dungeonLayer) return;
    dungeonLayer.removeChildren().forEach(c => c.destroy());
    if (vttStore.dungeonTiles.length === 0) return;

    // Fallback graphics pour les tiles sans texture
    const gFallback = new PIXI.Graphics();

    for (const tile of vttStore.dungeonTiles) {
      if (tile.type === 'void') continue;
      const x = tile.col * gridSize;
      const y = tile.row * gridSize;
      const tex = await getDungeonTex(tile.type);
      if (tex) {
        const sprite = new PIXI.Sprite(tex);
        sprite.x = x; sprite.y = y;
        sprite.width = gridSize; sprite.height = gridSize;
        dungeonLayer.addChild(sprite);
      } else {
        drawTileGraphics(gFallback, tile.type, x, y, gridSize);
      }
    }
    if (gFallback.geometry?.graphicsData?.length > 0) dungeonLayer.addChild(gFallback);
  }

  function renderTerrain() {
    if (!terrainLayer) return;
    terrainLayer.clear();
    for (const zone of terrainZones) {
      const color = zone.color ?? TERRAIN_COLORS[zone.type] ?? 0xffffff;
      terrainLayer.rect(zone.x, zone.y, zone.w, zone.h);
      terrainLayer.fill({ color, alpha: 0.22 });
      terrainLayer.setStrokeStyle({ width: 2, color, alpha: 0.6 });
      terrainLayer.rect(zone.x, zone.y, zone.w, zone.h).stroke();
      // Label
      if (!terrainLayer.children.find((c: any) => c.__zoneId === zone.id)) {
        const t = new PIXI.Text({
          text: zone.label || TERRAIN_LABELS[zone.type] || zone.type,
          style: { fontFamily: 'sans-serif', fontSize: 11, fill: color, stroke: { color: 0x000000, width: 2 } }
        });
        t.anchor.set(0.5);
        t.position.set(zone.x + zone.w / 2, zone.y + zone.h / 2);
        (t as any).__zoneId = zone.id;
        terrainLayer.addChild(t);
      }
    }
  }

  export function exportMapPng() {
    if (!app || !worldContainer) return;
    const texture = app.renderer.extract.texture(worldContainer);
    const canvas = app.renderer.extract.canvas(worldContainer) as HTMLCanvasElement;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = 'grimoire-map.png'; a.click();
  }

  function renderAudioZones() {
    if (!audioZoneLayer) return;
    audioZoneLayer.removeChildren();
    if (!isGM) return; // Les zones sont invisibles pour les joueurs
    for (const zone of audioZones) {
      const g = new PIXI.Graphics();
      g.setStrokeStyle({ width: 2, color: 0xaa00ff, alpha: 0.6 });
      g.circle(zone.x, zone.y, zone.radius).stroke();
      g.fill({ color: 0xaa00ff, alpha: 0.1 });
      
      const t = new PIXI.Text({ text: '🔊', style: { fontSize: 20 } });
      t.anchor.set(0.5); t.position.set(zone.x, zone.y);
      
      g.eventMode = 'static'; g.cursor = 'pointer';
      g.on('rightclick', (e) => { e.stopPropagation(); removeGmAudioZone(zone.id); });

      audioZoneLayer.addChild(g);
      audioZoneLayer.addChild(t);
    }
  }

  async function manageZoneAudios() {
    const vaultPath = getVaultPath();
    // Nettoyer les audios obsolètes
    for (const [id, audio] of zoneAudioObjects) {
      if (!audioZones.find(z => z.id === id)) {
        audio.pause(); audio.src = ''; zoneAudioObjects.delete(id);
      }
    }
    // Ajouter / Mettre à jour
    for (const zone of audioZones) {
      if (!zone.audioSrc || !vaultPath) continue;
      let audio = zoneAudioObjects.get(zone.id);
      if (!audio) {
        audio = new Audio();
        audio.loop = true;
        zoneAudioObjects.set(zone.id, audio);
      }
      const fullPath = `${vaultPath}/${zone.audioSrc}`;
      // On évite de recharger si c'est déjà la même source (en stockant le path sur l'objet audio)
      if ((audio as any)._grimoirePath !== fullPath) {
        (audio as any)._grimoirePath = fullPath;
        readFileBase64(fullPath).then(b64 => {
          const ext = zone.audioSrc.split('.').pop()?.toLowerCase();
          let mime = 'audio/mpeg';
          if (ext === 'wav') mime = 'audio/wav';
          else if (ext === 'ogg') mime = 'audio/ogg';
          audio!.src = `data:${mime};base64,${b64}`;
          audio!.play().catch(() => {});
        }).catch(() => {});
      }
    }
  }

  // Ticker pour les volumes des zones sonores
  $effect(() => {
    const interval = setInterval(() => {
      if (zoneAudioObjects.size === 0) return;
      // On prend les tokens joueurs comme référence
      const playerTokens = tokens.filter(t => !t.isEnemy);
      if (playerTokens.length === 0) {
        zoneAudioObjects.forEach(a => a.volume = 0);
        return;
      }

      for (const zone of audioZones) {
        const audio = zoneAudioObjects.get(zone.id);
        if (!audio) continue;

        // Calculer la distance minimale d'un joueur à cette zone
        let minPlayerDist = Infinity;
        playerTokens.forEach(p => {
          const dx = p.x - zone.x; const dy = p.y - zone.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          minPlayerDist = Math.min(minPlayerDist, dist);
        });

        // Volume basé sur la distance (0 à radius)
        let vol = 0;
        if (minPlayerDist < zone.radius) {
          vol = (1 - (minPlayerDist / zone.radius)) * (zone.volume || 0.8);
        }
        audio.volume = Math.max(0, Math.min(1, vol));
      }
    }, 200);
    return () => clearInterval(interval);
  });

  function animatePing(g: PIXI.Graphics, x: number, y: number) {
    let start = 0;
    const duration = 2200;
    function step(ts: number) {
      if (!start) start = ts;
      const t = Math.min((ts - start) / duration, 1);
      g.clear();
      const r = 8 + t * 34;
      const alpha = 1 - t;
      g.setStrokeStyle({ width: 3, color: 0xffcc00, alpha });
      g.circle(x, y, r).stroke();
      g.circle(x, y, 6).fill({ color: 0xffcc00, alpha: Math.max(0, 1 - t * 2) });
      if (t < 1) requestAnimationFrame(step);
      else { pingLayer?.removeChild(g); g.destroy(); }
    }
    requestAnimationFrame(step);
  }

  function spawnSketch(points: {x:number, y:number}[], color: number | string, name?: string) {
    if (!app || points.length < 2) return;
    const g = new PIXI.Graphics();
    const c = typeof color === 'string' ? parseInt(color.replace('#',''), 16) : color;
    g.setStrokeStyle({ width: 4, color: c, alpha: 1, cap: 'round', join: 'round' });
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
    g.stroke();

    const centerX = app.screen.width / 2;
    const centerY = app.screen.height / 2;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(p => {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    });
    const w = maxX - minX; const h = maxY - minY;
    
    const container = new PIXI.Container();
    container.addChild(g);
    g.x = -minX - w/2; g.y = -minY - h/2;
    
    container.x = centerX; container.y = centerY;
    app.stage.addChild(container);

    if (name) {
      const t = new PIXI.Text({ text: `Croquis de ${name}`, style: { fill: c, fontSize: 14, fontWeight: 'bold', stroke: { color: 0x000000, width: 3 } } });
      t.anchor.set(0.5); t.y = -h/2 - 20;
      container.addChild(t);
    }

    let start = 0;
    const dur = 4000;
    function step(ts: number) {
      if (!start) start = ts;
      const t = (ts - start) / dur;
      if (t >= 1) { app.stage.removeChild(container); container.destroy({ children: true }); return; }
      if (t > 0.8) container.alpha = (1 - t) / 0.2;
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
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

{#if condWheelTokenId && isGM}
  <ConditionWheel
    tokenId={condWheelTokenId}
    x={condWheelX}
    y={condWheelY}
    onclose={() => condWheelTokenId = null}
    onDelete={(id) => { onTokenDelete(id); condWheelTokenId = null; }}
  />
{/if}

<div
  class="canvas-container"
  bind:this={canvasContainer}
  ondragover={onCanvasDragOver}
  ondrop={onCanvasDrop}
>
  {#if errorMessage}
    <div class="error-overlay">{errorMessage}</div>
  {/if}
  {#if isGM && appReady && mapUrl}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="minimap-wrapper" onclick={() => showMinimap = !showMinimap} title="Minimap (clic pour masquer/afficher)">
      {#if showMinimap}
        <canvas bind:this={minimapCanvas} class="minimap-canvas" width="180" height="120"></canvas>
      {:else}
        <div class="minimap-collapsed">🗺️</div>
      {/if}
    </div>
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

  .minimap-wrapper {
    position: absolute;
    bottom: 12px;
    right: 12px;
    z-index: 100;
    cursor: pointer;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid rgba(229,168,83,0.4);
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    opacity: 0.85;
    transition: opacity 0.15s;
  }
  .minimap-wrapper:hover { opacity: 1; }

  .minimap-canvas {
    display: block;
    width: 180px;
    height: 120px;
  }

  .minimap-collapsed {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    background: rgba(10,12,16,0.85);
  }
</style>
