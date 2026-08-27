<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { mapStore, pushHistory, undo, redo, setRasterHooks, type MapStamp, type MapPath, type MapText, type MapShape, type SelectableType } from '../lib/stores/mapStore.svelte';
  import importedStamps from '../lib/imported_stamps.json';
  import importedTextures from '../lib/imported_textures.json';
  import { generateContinent } from '../lib/terrainGenerator';
  import {
    setElementMeasurer,
    setSelection,
    toggleInSelection,
    isInSelection,
    selectAll,
    clearSelection,
    moveSelectionBy,
    duplicateSelection,
    deleteSelection,
    rotatePointsAround,
    rectangleToPolygonPoints,
    copySelection,
    cutSelection,
    pasteClipboard,
    lockSelection,
    type ElementBBox,
  } from '../lib/pao.svelte';

  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let canvasContainer = $state<HTMLDivElement | null>(null);

  // Buffers hors-écran
  let maskCanvas: HTMLCanvasElement;
  let maskCtx: CanvasRenderingContext2D;
  let landCanvas: HTMLCanvasElement;
  let landCtx: CanvasRenderingContext2D;
  let bufferCanvas: HTMLCanvasElement;
  let bufferCtx: CanvasRenderingContext2D;

  // Cache d'images traitées
  const assetCache = new Map<string, HTMLCanvasElement | HTMLImageElement>();
  const imageLoadingPromises: Promise<void>[] = [];


  // États locaux de dessin / pan / interaction
  let isPointerDown = false;
  let isPanning = false;
  let startPanX = 0;
  let startPanY = 0;
  let lastX = 0;
  let lastY = 0;

  // Pour le tracé de chemins (Path)
  let currentPathPoints: { x: number; y: number }[] = [];

  // États locaux de redimensionnement et rotation interactifs
  let activeHandle = 'none';
  let initialDragScale = 1.0;
  let initialDragRotation = 0;
  let initialDragDist = 0;
  let initialDragAngle = 0;
  let isDraggingElement = false;
  let dragOffset = { x: 0, y: 0 };
  // Transformation interactive des textes et formes
  let initialTextSize = 22;
  let initialShapePoints: { x: number; y: number }[] = [];
  let shapeDragCenter = { x: 0, y: 0 };

  // Suivi de la souris pour l'aperçu (preview)
  let cursorMapX = $state(0);
  let cursorMapY = $state(0);

  // Pour le tracé de formes géométriques (Shape)
  let drawingShapePoints = $state<{ x: number; y: number }[]>([]);

  // Pour le pinceau de dispersion (Stamp Scattering)
  let lastScatterX = 0;
  let lastScatterY = 0;

  // ── PAO : marquee, règles/guides, mesure ──
  const RULER_SIZE = 22; // épaisseur des règles en px écran
  // Décalage des règles pour ne pas passer sous les barres flottantes (TopPanel / LeftToolbar)
  let rulerOffsetX = 50;
  let rulerOffsetY = 40;
  let marqueeStart: { x: number; y: number } | null = null; // coords carte
  let marqueeEnd: { x: number; y: number } | null = null;
  let marqueeAdditive = false; // Shift enfoncé au départ du cadre
  // Glissement de guide : axis 'v' = guide vertical (x), 'h' = horizontal (y)
  let draggingGuide: { axis: 'v' | 'h'; index: number } | null = null;
  // Mesure (coords carte)
  let measureStart: { x: number; y: number } | null = null;
  let measureEnd: { x: number; y: number } | null = null;
  let isMeasuring = false;

  // Charger et traiter les images (suppression du fond blanc)
  function loadAndProcessAsset(name: string, url: string, isStamp: boolean) {
    const promise = new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (isStamp) {
          // Chroma keying : convertir le blanc en transparent
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              // Si la couleur est proche du blanc, rendre transparente
              if (r > 230 && g > 230 && b > 230) {
                data[i + 3] = 0;
              }
            }
            ctx.putImageData(imgData, 0, 0);
            assetCache.set(name, canvas);
          } else {
            assetCache.set(name, img);
          }
        } else {
          assetCache.set(name, img);
        }
        resolve();
      };
      img.onerror = () => {
        console.error(`Erreur chargement asset: ${url}`);
        resolve();
      };
      img.src = url;
    });
    imageLoadingPromises.push(promise);
  }

  // Ensemble pour suivre les tampons en cours de chargement dynamique
  const dynamicLoadingAssets = new Set<string>();

  // Récupère un tampon depuis le cache ou lance son chargement à la volée s'il est utilisé
  function getOrLoadAsset(type: string): HTMLCanvasElement | HTMLImageElement | null {
    const cacheKey = `stamp_${type}`;
    const cached = assetCache.get(cacheKey);
    if (cached) return cached;

    if (dynamicLoadingAssets.has(cacheKey)) return null;

    // Chercher le chemin de l'image dans les tampons importés
    const stampMeta = importedStamps.find((s: any) => s.id === type);
    if (stampMeta) {
      dynamicLoadingAssets.add(cacheKey);
      const img = new Image();
      img.onload = () => {
        // Supprimer le fond blanc (Chroma Keying) pour le canevas
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (r > 230 && g > 230 && b > 230) {
              data[i + 3] = 0;
            }
          }
          ctx.putImageData(imgData, 0, 0);
          assetCache.set(cacheKey, canvas);
        } else {
          assetCache.set(cacheKey, img);
        }
        dynamicLoadingAssets.delete(cacheKey);
      };
      img.onerror = () => {
        console.error(`Erreur chargement asset dynamique: ${stampMeta.file}`);
        // Enregistrer un canevas vide pour éviter de tenter de charger indéfiniment
        const canvas = document.createElement('canvas');
        canvas.width = 1; canvas.height = 1;
        assetCache.set(cacheKey, canvas);
        dynamicLoadingAssets.delete(cacheKey);
      };
      img.src = stampMeta.file;
    }
    return null;
  }

  // Ensemble pour suivre les textures en cours de chargement dynamique
  const dynamicLoadingTextures = new Set<string>();

  // Récupère une texture depuis le cache ou la charge à la volée s'il s'agit d'une texture importée
  function getOrLoadTexture(type: string): HTMLCanvasElement | HTMLImageElement | undefined {
    const cacheKey = `tex_${type}`;
    const cached = assetCache.get(cacheKey);
    if (cached) return cached;

    if (dynamicLoadingTextures.has(cacheKey)) return undefined;

    // Chercher la texture dans les textures importées
    const texMeta = (importedTextures as any[]).find((t: any) => t.id === type);
    if (texMeta) {
      dynamicLoadingTextures.add(cacheKey);
      const img = new Image();
      img.onload = () => {
        assetCache.set(cacheKey, img);
        dynamicLoadingTextures.delete(cacheKey);
      };
      img.onerror = () => {
        console.error(`Erreur chargement texture dynamique: ${texMeta.file}`);
        // Enregistrer un canevas vide pour éviter de tenter de charger indéfiniment
        const canvas = document.createElement('canvas');
        canvas.width = 1; canvas.height = 1;
        assetCache.set(cacheKey, canvas);
        dynamicLoadingTextures.delete(cacheKey);
      };
      img.src = `/assets/textures/${texMeta.file}`;
    }
    return undefined;
  }

  // Effet réactif pour charger l'image de fond importée par l'utilisateur
  $effect(() => {
    const url = mapStore.backgroundImageUrl;
    if (url) {
      const img = new Image();
      img.onload = () => {
        assetCache.set('bg_user_image', img);
      };
      img.onerror = (err) => {
        console.error('Erreur chargement image de fond:', err);
      };
      img.src = url;
    } else {
      assetCache.delete('bg_user_image');
    }
  });

  // Générer des textures répétitives en code pour la vue du dessus
  function createProceduralTextures() {
    // 1. Planchers de bois (tex_wood)
    const woodCanvas = document.createElement('canvas');
    woodCanvas.width = 128;
    woodCanvas.height = 128;
    const wCtx = woodCanvas.getContext('2d')!;
    wCtx.fillStyle = '#6f4e37'; // Marron chaud
    wCtx.fillRect(0, 0, 128, 128);
    wCtx.strokeStyle = '#4a3222';
    wCtx.lineWidth = 1.5;
    for (let y = 0; y <= 128; y += 32) {
      wCtx.beginPath();
      wCtx.moveTo(0, y);
      wCtx.lineTo(128, y);
      wCtx.stroke();
    }
    for (let y = 0; y < 128; y += 32) {
      const shift = (y / 32) % 2 === 0 ? 0 : 64;
      wCtx.beginPath();
      wCtx.moveTo(shift, y);
      wCtx.lineTo(shift, y + 32);
      wCtx.moveTo(shift + 64, y);
      wCtx.lineTo(shift + 64, y + 32);
      wCtx.stroke();
    }
    wCtx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
    wCtx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      wCtx.beginPath();
      wCtx.moveTo(0, Math.random() * 128);
      wCtx.bezierCurveTo(32, Math.random() * 128, 96, Math.random() * 128, 128, Math.random() * 128);
      wCtx.stroke();
    }
    assetCache.set('tex_wood', woodCanvas);

    // 2. Pavés de pierre (tex_paving)
    const pavingCanvas = document.createElement('canvas');
    pavingCanvas.width = 128;
    pavingCanvas.height = 128;
    const pCtx = pavingCanvas.getContext('2d')!;
    pCtx.fillStyle = '#5a6268';
    pCtx.fillRect(0, 0, 128, 128);
    pCtx.strokeStyle = '#2d3238';
    pCtx.lineWidth = 2;
    for (let x = 0; x <= 128; x += 64) {
      pCtx.beginPath();
      pCtx.moveTo(x, 0); pCtx.lineTo(x, 128);
      pCtx.moveTo(0, x); pCtx.lineTo(128, x);
      pCtx.stroke();
    }
    pCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    pCtx.lineWidth = 1;
    for (let x = 0; x < 128; x += 64) {
      for (let y = 0; y < 128; y += 64) {
        pCtx.beginPath();
        pCtx.moveTo(x + 2, y + 62);
        pCtx.lineTo(x + 2, y + 2);
        pCtx.lineTo(x + 62, y + 2);
        pCtx.stroke();
      }
    }
    assetCache.set('tex_paving', pavingCanvas);

    // 3. Terre battue (tex_dirt)
    const dirtCanvas = document.createElement('canvas');
    dirtCanvas.width = 128;
    dirtCanvas.height = 128;
    const dCtx = dirtCanvas.getContext('2d')!;
    dCtx.fillStyle = '#4e3b30';
    dCtx.fillRect(0, 0, 128, 128);
    dCtx.fillStyle = '#3f2e24';
    for (let i = 0; i < 30; i++) {
      dCtx.beginPath();
      dCtx.arc(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 3, 0, Math.PI * 2);
      dCtx.fill();
    }
    assetCache.set('tex_dirt', dirtCanvas);

    // 4. Herbe vue du dessus (tex_topdown_grass)
    const tgCanvas = document.createElement('canvas');
    tgCanvas.width = 128;
    tgCanvas.height = 128;
    const tgCtx = tgCanvas.getContext('2d')!;
    tgCtx.fillStyle = '#3e7d32';
    tgCtx.fillRect(0, 0, 128, 128);
    tgCtx.strokeStyle = '#2d6123';
    tgCtx.lineWidth = 1;
    for (let i = 0; i < 20; i++) {
      const gx = Math.random() * 128;
      const gy = Math.random() * 128;
      tgCtx.beginPath();
      tgCtx.moveTo(gx, gy);
      tgCtx.quadraticCurveTo(gx - 3, gy - 6, gx - 6, gy - 8);
      tgCtx.moveTo(gx, gy);
      tgCtx.quadraticCurveTo(gx + 3, gy - 6, gx + 6, gy - 8);
      tgCtx.stroke();
    }
    assetCache.set('tex_topdown_grass', tgCanvas);

    // 5. Eau vue du dessus (tex_topdown_water)
    const twCanvas = document.createElement('canvas');
    twCanvas.width = 128;
    twCanvas.height = 128;
    const twCtx = twCanvas.getContext('2d')!;
    twCtx.fillStyle = '#1c3d5a';
    twCtx.fillRect(0, 0, 128, 128);
    twCtx.strokeStyle = '#2b6cb0';
    twCtx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const wy = i * 32 + 16;
      twCtx.beginPath();
      twCtx.moveTo(0, wy);
      twCtx.bezierCurveTo(32, wy + 8, 96, wy - 8, 128, wy);
      twCtx.stroke();
    }
    assetCache.set('tex_topdown_water', twCanvas);

    // 6. Mur de pierre de donjon (tex_wall) — tuile seamless 128×64
    const wallTileCanvas = document.createElement('canvas');
    wallTileCanvas.width = 128;
    wallTileCanvas.height = 64;
    const wtCtx = wallTileCanvas.getContext('2d')!;

    // Mortier sombre (fond)
    wtCtx.fillStyle = '#0e0b07';
    wtCtx.fillRect(0, 0, 128, 64);

    // Dessine un bloc de pierre avec grain et biseaux intégrés
    const drawWallBlock = (bx: number, by: number, bw: number, bh: number) => {
      if (bw <= 0 || bh <= 0) return;
      // Couleur de base avec légère variation aléatoire
      const v = Math.floor(Math.random() * 14);
      wtCtx.fillStyle = `rgb(${36+v},${28+v},${18+v})`;
      wtCtx.fillRect(bx, by, bw, bh);
      // Grain (imperfections procédurales)
      const grainCount = Math.floor(bw * bh / 28);
      for (let g = 0; g < grainCount; g++) {
        const gx = bx + Math.random() * bw;
        const gy = by + Math.random() * bh;
        wtCtx.fillStyle = Math.random() > 0.55
          ? 'rgba(255,200,120,0.06)'
          : 'rgba(0,0,0,0.12)';
        wtCtx.fillRect(gx, gy, 1 + Math.random(), 1 + Math.random());
      }
      // Reflet supérieur (lumière de torche venant du haut)
      wtCtx.fillStyle = 'rgba(255,210,140,0.20)';
      wtCtx.fillRect(bx, by, bw, 2);
      // Ombre inférieure
      wtCtx.fillStyle = 'rgba(0,0,0,0.32)';
      wtCtx.fillRect(bx, by + bh - 2, bw, 2);
      // Ombre secondaire sur le tiers bas (dégradé de profondeur)
      wtCtx.fillStyle = 'rgba(0,0,0,0.12)';
      wtCtx.fillRect(bx, by + Math.floor(bh * 0.65), bw, Math.ceil(bh * 0.35) - 2);
      // Reflet gauche (ébauche de biseau)
      wtCtx.fillStyle = 'rgba(255,210,140,0.09)';
      wtCtx.fillRect(bx, by, 2, bh);
    };

    // Rangée 1 (y=3..31, h=28px) — deux blocs, joint à x=70
    drawWallBlock(3,  3,  65, 28);  // bloc large gauche
    drawWallBlock(70, 3,  55, 28);  // bloc court droit (continue sur tuile suivante)

    // Rangée 2 (y=35..63, h=28px) — décalage de ~35px, trois blocs visibles
    drawWallBlock(3,  35, 30, 28);  // début de bloc (suite depuis tuile précédente)
    drawWallBlock(35, 35, 58, 28);  // bloc large central
    drawWallBlock(95, 35, 30, 28);  // début du prochain (wrap horizontal)

    assetCache.set('tex_wall', wallTileCanvas);
  }

  // Helper drawing functions for procedural stamps
  function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
  }

  function drawFireShape(ctx: CanvasRenderingContext2D, size: number) {
    ctx.moveTo(0, size);
    ctx.quadraticCurveTo(-size, size * 0.2, -size * 0.7, -size * 0.5);
    ctx.quadraticCurveTo(-size * 0.2, -size * 0.1, 0, -size * 1.2);
    ctx.quadraticCurveTo(size * 0.2, -size * 0.1, size * 0.7, -size * 0.5);
    ctx.quadraticCurveTo(size, size * 0.2, 0, size);
    ctx.closePath();
  }

  // Dessiner programmatiquement les tampons de vue du dessus
  function drawProceduralStamp(ctx: CanvasRenderingContext2D, type: string, scale: number, selected: boolean) {
    ctx.save();
    ctx.scale(scale, scale);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const baseSize = 80;
    const r = baseSize / 2;

    switch (type) {
      case 'td_tree_pine': {
        // Tronc
        ctx.fillStyle = '#5c4033';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();

        // Layer 1 (Outer)
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#1e3f20'; // Vert forêt foncé
        ctx.beginPath();
        drawStar(ctx, 0, 0, 12, 38, 25);
        ctx.fill();
        ctx.strokeStyle = '#0e2410';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Layer 2 (Middle)
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#2d5e30';
        ctx.beginPath();
        drawStar(ctx, 0, 0, 10, 27, 18);
        ctx.fill();
        ctx.stroke();

        // Layer 3 (Inner / Top)
        ctx.shadowBlur = 2;
        ctx.fillStyle = '#418245'; // Vert clair
        ctx.beginPath();
        drawStar(ctx, 0, 0, 8, 17, 10);
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'td_tree_oak': {
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#27ae60';
        ctx.strokeStyle = '#1e8449';
        ctx.lineWidth = 2;

        const circles = [
          { cx: -15, cy: -15, cr: 18 },
          { cx: 15, cy: -15, cr: 18 },
          { cx: 20, cy: 10, cr: 16 },
          { cx: -20, cy: 10, cr: 16 },
          { cx: 0, cy: 20, cr: 18 },
          { cx: 0, cy: -20, cr: 18 },
          { cx: 0, cy: 0, cr: 22 }
        ];

        ctx.beginPath();
        circles.forEach(c => {
          ctx.arc(c.cx, c.cy, c.cr, 0, Math.PI * 2);
        });
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#2ecc71';
        ctx.beginPath();
        circles.forEach(c => {
          ctx.arc(c.cx - 3, c.cy - 3, c.cr - 4, 0, Math.PI * 2);
        });
        ctx.fill();

        ctx.strokeStyle = '#5c4033';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-8, -10);
        ctx.moveTo(0, 0);
        ctx.lineTo(8, -8);
        ctx.moveTo(0, 0);
        ctx.lineTo(2, 12);
        ctx.stroke();
        break;
      }
      case 'td_rock': {
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 5;
        
        const points = [
          { x: -30, y: -10 },
          { x: -10, y: -30 },
          { x: 20, y: -25 },
          { x: 35, y: 5 },
          { x: 15, y: 30 },
          { x: -20, y: 25 }
        ];

        ctx.fillStyle = '#7f8c8d';
        ctx.strokeStyle = '#34495e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for(let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        const center = { x: 2, y: 2 };
        
        const drawFacet = (p1: any, p2: any, fill: string) => {
          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(center.x, center.y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        };

        drawFacet(points[0], points[1], '#bdc3c7');
        drawFacet(points[1], points[2], '#95a5a6');
        drawFacet(points[2], points[3], '#7f8c8d');
        drawFacet(points[3], points[4], '#566573');
        drawFacet(points[4], points[5], '#4d5656');
        drawFacet(points[5], points[0], '#7f8c8d');
        break;
      }
      case 'td_campfire': {
        ctx.fillStyle = '#7f8c8d';
        ctx.strokeStyle = '#34495e';
        ctx.lineWidth = 1;
        const numStones = 8;
        for (let i = 0; i < numStones; i++) {
          const angle = (i * Math.PI * 2) / numStones;
          const sx = Math.cos(angle) * 26;
          const sy = Math.sin(angle) * 26;
          ctx.beginPath();
          ctx.arc(sx, sy, 6 + Math.random() * 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        ctx.strokeStyle = '#5c4033';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-18, -10); ctx.lineTo(18, 10);
        ctx.moveTo(18, -10); ctx.lineTo(-18, 10);
        ctx.moveTo(0, -18); ctx.lineTo(0, 18);
        ctx.stroke();

        ctx.save();
        ctx.shadowColor = '#e67e22';
        ctx.shadowBlur = 15;

        // Rouge
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        drawFireShape(ctx, 16);
        ctx.fill();

        // Orange
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        drawFireShape(ctx, 11);
        ctx.fill();

        // Jaune
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        drawFireShape(ctx, 6);
        ctx.fill();

        ctx.restore();
        break;
      }
      case 'td_chest': {
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 5;

        ctx.fillStyle = '#5c4033';
        ctx.strokeStyle = '#2c1e18';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.rect(-28, -18, 56, 36);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#3e2b22';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-28, -6); ctx.lineTo(28, -6);
        ctx.moveTo(-28, 6); ctx.lineTo(28, 6);
        ctx.stroke();

        ctx.fillStyle = '#d4a84b';
        ctx.strokeStyle = '#5c4033';
        ctx.lineWidth = 1;
        const drawBand = (bx: number) => {
          ctx.beginPath();
          ctx.rect(bx - 3, -18, 6, 36);
          ctx.fill();
          ctx.stroke();
        };
        drawBand(-22);
        drawBand(22);
        drawBand(0);

        ctx.fillStyle = '#d4a84b';
        ctx.strokeStyle = '#3e2b22';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'td_table': {
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 5;

        ctx.fillStyle = '#a0522d';
        ctx.strokeStyle = '#5c4033';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.rect(-35, -20, 70, 40);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-35, -10); ctx.lineTo(35, -10);
        ctx.moveTo(-35, 0); ctx.lineTo(35, 0);
        ctx.moveTo(-35, 10); ctx.lineTo(35, 10);
        ctx.stroke();
        break;
      }
      case 'td_chair': {
        ctx.fillStyle = '#8b4513';
        ctx.strokeStyle = '#5c4033';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(-12, -12, 24, 24);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#5c4033';
        ctx.beginPath();
        ctx.rect(-12, -12, 24, 5);
        ctx.fill();
        break;
      }
      case 'td_pillar': {
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 6;

        const grad = ctx.createRadialGradient(-6, -6, 4, 0, 0, 24);
        grad.addColorStop(0, '#e2e8f0');
        grad.addColorStop(0.5, '#94a3b8');
        grad.addColorStop(1, '#475569');

        ctx.fillStyle = grad;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'td_wall': {
        // Pierre réaliste avec texture et ombrage de relief 3D top-down
        ctx.fillStyle = '#475569'; // Couleur de base ardoise/pierre
        ctx.strokeStyle = '#0f172a'; // Mortier sombre
        ctx.lineWidth = 3.5;
        
        ctx.beginPath();
        ctx.rect(-40, -14, 80, 28);
        ctx.fill();
        ctx.stroke();

        // Dessiner des briques texturées individuelles
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.5;
        
        // Ligne de mortier centrale horizontale
        ctx.beginPath();
        ctx.moveTo(-40, 0); ctx.lineTo(40, 0);
        
        // Joints verticaux décalés (briques)
        ctx.moveTo(-20, -14); ctx.lineTo(-20, 0);
        ctx.moveTo(20, -14); ctx.lineTo(20, 0);
        ctx.moveTo(-40, 0); ctx.lineTo(-40, 14);
        ctx.moveTo(0, 0); ctx.lineTo(0, 14);
        ctx.moveTo(40, 0); ctx.lineTo(40, 14);
        ctx.stroke();

        // Highlights et textures de pierre réalistes (relief 3D)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Bords supérieurs éclairés pour donner du volume
        ctx.moveTo(-40, -12); ctx.lineTo(40, -12);
        ctx.moveTo(-40, 2); ctx.lineTo(40, 2);
        ctx.stroke();

        // Ombres de profondeur internes
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.moveTo(-40, -2); ctx.lineTo(40, -2);
        ctx.moveTo(-40, 12); ctx.lineTo(40, 12);
        ctx.stroke();
        break;
      }
      case 'td_door': {
        ctx.strokeStyle = '#5c4033';
        ctx.lineWidth = 3;

        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.rect(-40, -8, 8, 16);
        ctx.rect(32, -8, 8, 16);
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.translate(-32, 0);
        ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = '#8b4513';
        ctx.beginPath();
        ctx.rect(0, -3, 64, 6);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(-32, 0, 64, 0, -Math.PI / 4, true);
        ctx.stroke();
        break;
      }
      case 'td_bed': {
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 4;

        // Cadre en bois
        ctx.fillStyle = '#8b4513';
        ctx.strokeStyle = '#5c4033';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.rect(-18, -30, 36, 60);
        ctx.fill();
        ctx.stroke();

        // Couverture / Drap
        ctx.fillStyle = '#e2e8f0';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.rect(-15, -12, 30, 40);
        ctx.fill();
        ctx.stroke();

        // Oreiller
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.rect(-11, -26, 22, 10);
        ctx.fill();
        ctx.stroke();

        // Couverture pliée
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.rect(-15, -12, 30, 6);
        ctx.fill();
        break;
      }
      case 'td_tent': {
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 8;

        // Corps extérieur de la tente (toile beige)
        ctx.fillStyle = '#cca37a';
        ctx.strokeStyle = '#8c6640';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -32);
        ctx.lineTo(26, 20);
        ctx.lineTo(-26, 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Ligne de crête
        ctx.strokeStyle = '#66492e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -32);
        ctx.lineTo(0, 20);
        ctx.stroke();

        // Ouverture sombre
        ctx.fillStyle = '#1e1f29';
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.lineTo(12, 20);
        ctx.lineTo(-12, 20);
        ctx.closePath();
        ctx.fill();

        // Rabats ouverts
        ctx.fillStyle = '#b3865c';
        ctx.strokeStyle = '#66492e';
        ctx.lineWidth = 1.5;
        // Rabat gauche
        ctx.beginPath();
        ctx.moveTo(-12, 20);
        ctx.lineTo(0, 4);
        ctx.lineTo(-6, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Rabat droit
        ctx.beginPath();
        ctx.moveTo(12, 20);
        ctx.lineTo(0, 4);
        ctx.lineTo(6, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
    }

    if (selected) {
      ctx.strokeStyle = '#d4a84b';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(-r - 4, -r - 4, baseSize + 8, baseSize + 8);
    }

    ctx.restore();
  }

  // Initialisation des ressources et canevas
  onMount(async () => {
    // 0. Lire la géométrie des barres flottantes pour positionner les règles PAO
    const rootStyles = getComputedStyle(document.documentElement);
    rulerOffsetX = parseInt(rootStyles.getPropertyValue('--left-nav-width')) || 50;
    rulerOffsetY = parseInt(rootStyles.getPropertyValue('--editor-top-nav-height')) || 40;

    // 1. Charger les textures
    loadAndProcessAsset('tex_parchment', '/assets/textures/parchment.png', false);
    loadAndProcessAsset('tex_water', '/assets/textures/water.png', false);
    loadAndProcessAsset('tex_grass', '/assets/textures/grass.png', false);
    loadAndProcessAsset('tex_rock', '/assets/textures/rock.png', false);
    loadAndProcessAsset('tex_sand', '/assets/textures/sand.png', false);

    // 2. Charger les tampons (Stamps)
    loadAndProcessAsset('stamp_mountain', '/assets/stamps/mountain.png', true);
    loadAndProcessAsset('stamp_mountain_snowy', '/assets/stamps/mountain_snowy.png', true);
    loadAndProcessAsset('stamp_volcano', '/assets/stamps/volcano.png', true);
    loadAndProcessAsset('stamp_tree', '/assets/stamps/tree_variant_1.png', true);
    loadAndProcessAsset('stamp_tree_variant_1', '/assets/stamps/tree_variant_1.png', true);
    loadAndProcessAsset('stamp_tree_variant_2', '/assets/stamps/tree_variant_2.png', true);
    loadAndProcessAsset('stamp_tree_variant_3', '/assets/stamps/tree_variant_3.png', true);
    loadAndProcessAsset('stamp_tree_variant_4', '/assets/stamps/tree_variant_4.png', true);
    loadAndProcessAsset('stamp_tree_variant_5', '/assets/stamps/tree_variant_5.png', true);
    loadAndProcessAsset('stamp_tree_variant_6', '/assets/stamps/tree_variant_6.png', true);
    loadAndProcessAsset('stamp_castle', '/assets/stamps/castle.png', true);
    loadAndProcessAsset('stamp_tower', '/assets/stamps/tower.png', true);
    loadAndProcessAsset('stamp_village', '/assets/stamps/village.png', true);
    loadAndProcessAsset('stamp_ship', '/assets/stamps/ship.png', true);
    loadAndProcessAsset('stamp_sea_monster', '/assets/stamps/sea_monster.png', true);
    loadAndProcessAsset('stamp_compass', '/assets/stamps/compass.png', true);
    loadAndProcessAsset('stamp_banner', '/assets/stamps/banner.png', true);

    // Les tampons importés seront chargés dynamiquement à la volée lorsqu'ils sont utilisés

    await Promise.all(imageLoadingPromises);

    // Générer les textures procédurales (ex: bois, pavés)
    createProceduralTextures();

    // Initialiser les buffers de travail hors-écran
    const W = mapStore.canvasWidth;
    const H = mapStore.canvasHeight;

    maskCanvas = document.createElement('canvas');
    maskCanvas.width = W;
    maskCanvas.height = H;
    maskCtx = maskCanvas.getContext('2d')!;

    landCanvas = document.createElement('canvas');
    landCanvas.width = W;
    landCanvas.height = H;
    landCtx = landCanvas.getContext('2d')!;

    bufferCanvas = document.createElement('canvas');
    bufferCanvas.width = W;
    bufferCanvas.height = H;
    bufferCtx = bufferCanvas.getContext('2d')!;

    // Initialiser la brosse de peinture et de sculpe par défaut
    resetCanvasData();

    // Undo/redo des canvases raster (terre + textures peintes)
    setRasterHooks({
      capture() {
        const copy = (src: HTMLCanvasElement) => {
          const c = document.createElement('canvas');
          c.width = src.width;
          c.height = src.height;
          c.getContext('2d')!.drawImage(src, 0, 0);
          return c;
        };
        return {
          mask: copy(maskCanvas),
          land: copy(landCanvas),
          // L'arrière-plan fait partie de l'état "terrain" (le générateur de donjon le change)
          bg: {
            type: mapStore.backgroundType,
            texture: mapStore.backgroundTexture,
            scale: mapStore.backgroundTextureScale,
          },
        };
      },
      restore(snapshot: unknown) {
        const s = snapshot as {
          mask: HTMLCanvasElement;
          land: HTMLCanvasElement;
          bg: { type: typeof mapStore.backgroundType; texture: string; scale: number };
        };
        for (const [src, ctx] of [[s.mask, maskCtx], [s.land, landCtx]] as const) {
          ctx.save();
          ctx.globalCompositeOperation = 'copy';
          ctx.drawImage(src, 0, 0);
          ctx.restore();
        }
        mapStore.backgroundType = s.bg.type;
        mapStore.backgroundTexture = s.bg.texture;
        mapStore.backgroundTextureScale = s.bg.scale;
      },
    });

    (window as any).clearLandMask = () => {
      pushHistory(true);
      maskCtx.clearRect(0, 0, mapStore.canvasWidth, mapStore.canvasHeight);
    };

    (window as any).fillLandMask = () => {
      pushHistory(true);
      maskCtx.fillStyle = '#ffffff';
      maskCtx.fillRect(0, 0, mapStore.canvasWidth, mapStore.canvasHeight);
    };

    (window as any).sculptDungeonFloor = (grid: any[][], cols: number, rows: number, themeName: string) => {
      pushHistory(true);
      
      // Make everything background (black/transparent mask)
      maskCtx.clearRect(0, 0, mapStore.canvasWidth, mapStore.canvasHeight);
      
      // Set background to a solid dark stone texture
      mapStore.backgroundType = 'texture';
      mapStore.backgroundTexture = 'rock';
      mapStore.backgroundTextureScale = 1.0;
      
      // Draw the floors as white on the land mask
      maskCtx.fillStyle = '#ffffff';
      const gSize = mapStore.gridSize;
      const startX = (mapStore.canvasWidth - cols * gSize) / 2;
      const startY = (mapStore.canvasHeight - rows * gSize) / 2;
      
      const isFloorType = (cellType: string) => {
        return cellType === 'floor_stone' || cellType === 'floor_dirt' || cellType === 'door' || cellType === 'chest' || cellType === 'pillar' || cellType === 'stairs_up' || cellType === 'stairs_down';
      };

      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (isFloorType(grid[c][r])) {
            const px = startX + c * gSize;
            const py = startY + r * gSize;
            
            if (themeName === 'cave') {
              // Draw rounded organic cells for caves
              maskCtx.beginPath();
              maskCtx.arc(px + gSize/2, py + gSize/2, gSize * 0.72, 0, Math.PI * 2);
              maskCtx.fill();
            } else {
              maskCtx.fillRect(px - 1, py - 1, gSize + 2, gSize + 2);
            }
          }
        }
      }
    };

    (window as any).fillLandTexture = (texKey: string) => {
      pushHistory(true);
      const tex = assetCache.get(`tex_${texKey}`) || assetCache.get(texKey) || getOrLoadTexture(texKey);
      if (tex) {
        const pattern = landCtx.createPattern(tex, 'repeat')!;
        landCtx.fillStyle = pattern;
        landCtx.fillRect(0, 0, mapStore.canvasWidth, mapStore.canvasHeight);
      }
    };

    (window as any).generateRandomContinent = () => {
      pushHistory(true);
      
      maskCtx.clearRect(0, 0, mapStore.canvasWidth, mapStore.canvasHeight);
      
      const resolution = 15; // Taille d'une cellule en pixels
      const cols = Math.floor(mapStore.canvasWidth / resolution);
      const rows = Math.floor(mapStore.canvasHeight / resolution);
      
      const grid = generateContinent(cols, rows);
      
      maskCtx.fillStyle = '#ffffff';
      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
          if (grid[x][y]) {
            maskCtx.beginPath();
            maskCtx.arc(x * resolution + resolution/2, y * resolution + resolution/2, resolution * 0.8, 0, Math.PI * 2);
            maskCtx.fill();
          }
        }
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    requestAnimationFrame(renderLoop);
  });

  onDestroy(() => {
    window.removeEventListener('resize', handleResize);
    setRasterHooks(null);
    delete (window as any).clearLandMask;
    delete (window as any).fillLandMask;
    delete (window as any).fillLandTexture;
    delete (window as any).generateRandomContinent;
  });

  // Vider/remplir les données de départ
  function resetCanvasData() {
    // Remplir le masque de Terre (blanc) pour tout afficher au début,
    // ou en transparent (noir) pour tout eau.
    // Commençons avec un masque blanc (tout est de la terre)
    maskCtx.fillStyle = '#ffffff';
    maskCtx.fillRect(0, 0, mapStore.canvasWidth, mapStore.canvasHeight);

    // Dessiner la texture de terre par défaut selon le style de carte
    const defaultTexKey = 'tex_parchment';
    const bgTex = assetCache.get(defaultTexKey);
    if (bgTex) {
      const pattern = landCtx.createPattern(bgTex, 'repeat')!;
      landCtx.fillStyle = pattern;
      landCtx.fillRect(0, 0, mapStore.canvasWidth, mapStore.canvasHeight);
    }
  }

  function handleResize() {
    if (!canvasEl || !canvasContainer) return;
    canvasEl.width = canvasContainer.clientWidth;
    canvasEl.height = canvasContainer.clientHeight;
  }

  // Coordonnées écran -> Coordonnées carte
  function screenToMap(sx: number, sy: number) {
    return {
      x: (sx - mapStore.panX) / mapStore.zoom,
      y: (sy - mapStore.panY) / mapStore.zoom,
    };
  }

  // Aligner sur la grille si activé
  function snapCoordinate(x: number, y: number) {
    if (!mapStore.stampSnapEnabled) {
      return { x, y };
    }
    const gSize = mapStore.gridSize;
    if (mapStore.stampSnapMode === 'center') {
      return {
        x: (Math.floor(x / gSize) + 0.5) * gSize,
        y: (Math.floor(y / gSize) + 0.5) * gSize,
      };
    } else { // intersection
      return {
        x: Math.round(x / gSize) * gSize,
        y: Math.round(y / gSize) * gSize,
      };
    }
  }

  // Coordonnées carte -> Coordonnées écran (pour les surcouches PAO)
  function mapToScreen(mx: number, my: number) {
    return {
      x: mx * mapStore.zoom + mapStore.panX,
      y: my * mapStore.zoom + mapStore.panY,
    };
  }

  // Aimanter une position aux guides proches (seuil en px écran)
  function snapToGuides(x: number, y: number) {
    if (!mapStore.snapToGuides) return { x, y };
    const threshold = 8 / mapStore.zoom;
    let nx = x, ny = y;
    for (const gx of mapStore.guides.v) {
      if (Math.abs(gx - x) <= threshold) { nx = gx; break; }
    }
    for (const gy of mapStore.guides.h) {
      if (Math.abs(gy - y) <= threshold) { ny = gy; break; }
    }
    return { x: nx, y: ny };
  }

  // Boîte englobante d'un élément en coordonnées carte (pour l'alignement PAO)
  function measureElement(type: SelectableType, id: string): ElementBBox | null {
    if (type === 'stamp') {
      const s = mapStore.stamps.find((s) => s.id === id);
      if (!s) return null;
      let w = 80 * s.scale;
      let h = 80 * s.scale;
      if (!s.type.startsWith('td_')) {
        const img = assetCache.get(`stamp_${s.type}`);
        if (img) {
          w = img.width * s.scale;
          h = img.height * s.scale;
        }
      }
      return { minX: s.x - w / 2, minY: s.y - h / 2, maxX: s.x + w / 2, maxY: s.y + h / 2, cx: s.x, cy: s.y };
    }
    if (type === 'text') {
      const t = mapStore.texts.find((t) => t.id === id);
      if (!t) return null;
      let w = t.text.length * t.size * 0.55;
      if (bufferCtx) {
        bufferCtx.save();
        bufferCtx.font = `${t.size}px "${t.font}", serif`;
        w = bufferCtx.measureText(t.text).width;
        bufferCtx.restore();
      }
      const h = t.size;
      return { minX: t.x - w / 2, minY: t.y - h / 2, maxX: t.x + w / 2, maxY: t.y + h / 2, cx: t.x, cy: t.y };
    }
    const sh = mapStore.shapes.find((s) => s.id === id);
    if (!sh || sh.points.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (sh.type === 'circle' && sh.points.length > 1) {
      const r = Math.hypot(sh.points[1].x - sh.points[0].x, sh.points[1].y - sh.points[0].y);
      minX = sh.points[0].x - r; maxX = sh.points[0].x + r;
      minY = sh.points[0].y - r; maxY = sh.points[0].y + r;
    } else {
      for (const p of sh.points) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
    }
    return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  }

  setElementMeasurer(measureElement);

  // Un élément est-il sélectionné (sélection principale ou multi-sélection) ?
  function isElementSelected(type: SelectableType, id: string): boolean {
    if (mapStore.selectedElement && mapStore.selectedElement.type === type && mapStore.selectedElement.id === id) return true;
    return isInSelection(type, id);
  }

  // RENDERING LOOP
  function drawGeometricShape(ctx: CanvasRenderingContext2D, shape: MapShape) {
    if (shape.points.length === 0) return;
    
    ctx.save();
    ctx.beginPath();
    
    if (shape.type === 'rectangle') {
      const p0 = shape.points[0];
      const p1 = shape.points[1] || p0;
      const x = Math.min(p0.x, p1.x);
      const y = Math.min(p0.y, p1.y);
      const w = Math.abs(p0.x - p1.x);
      const h = Math.abs(p0.y - p1.y);
      ctx.rect(x, y, w, h);
    } else if (shape.type === 'circle') {
      const p0 = shape.points[0];
      const p1 = shape.points[1] || p0;
      const r = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      ctx.arc(p0.x, p0.y, r, 0, Math.PI * 2);
    } else if (shape.type === 'polygon') {
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(shape.points[i].x, shape.points[i].y);
      }
      if (shape.points.length > 2) {
        ctx.closePath();
      }
    }

    // Remplissage
    let filled = false;
    if (shape.fillTexture) {
      const texName = `tex_${shape.fillTexture}`;
      let texture = assetCache.get(texName) || assetCache.get(shape.fillTexture);
      if (!texture) {
        texture = getOrLoadTexture(shape.fillTexture);
      }
      if (texture) {
        ctx.save();
        ctx.globalAlpha = shape.fillOpacity;
        const pattern = ctx.createPattern(texture, 'repeat');
        if (pattern) {
          const scale = shape.fillTextureScale ?? 1.0;
          if (scale !== 1.0) {
            pattern.setTransform(new DOMMatrix().scale(scale));
          }
          ctx.fillStyle = pattern;
          ctx.fill();
          filled = true;
        }
        ctx.restore();
      }
    }
    
    if (!filled) {
      ctx.save();
      ctx.globalAlpha = shape.fillOpacity;
      ctx.fillStyle = shape.fillColor;
      ctx.fill();
      ctx.restore();
    }

    // Contour (Stroke)
    if (shape.strokeWidth > 0) {
      ctx.save();
      ctx.strokeStyle = shape.strokeColor;
      ctx.lineWidth = shape.strokeWidth;
      if (shape.strokeDash === 'dashed') {
        ctx.setLineDash([8, 4]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();
      ctx.restore();
    }
    
    ctx.restore();
  }

  function drawShapeSelectionBorder(ctx: CanvasRenderingContext2D, shape: MapShape) {
    if (shape.points.length === 0) return;
    
    // Calculer la bounding box
    let minX = shape.points[0].x;
    let maxX = shape.points[0].x;
    let minY = shape.points[0].y;
    let maxY = shape.points[0].y;
    
    for (let i = 1; i < shape.points.length; i++) {
      const p = shape.points[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    
    if (shape.type === 'circle' && shape.points.length > 1) {
      const p0 = shape.points[0];
      const p1 = shape.points[1];
      const r = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      minX = p0.x - r;
      maxX = p0.x + r;
      minY = p0.y - r;
      maxY = p0.y + r;
    }
    
    ctx.save();
    ctx.strokeStyle = '#d4a84b';
    ctx.lineWidth = 2 / mapStore.zoom;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(minX - 4, minY - 4, (maxX - minX) + 8, (maxY - minY) + 8);
    
    if (mapStore.activeTool === 'grid') {
      ctx.fillStyle = '#d4a84b';
      const handleSize = 6 / mapStore.zoom;
      shape.points.forEach(p => {
        ctx.fillRect(p.x - handleSize/2, p.y - handleSize/2, handleSize, handleSize);
      });

      // Poignées de transformation aux angles de la bbox
      ctx.setLineDash([]);
      const cornerSize = 8 / mapStore.zoom;
      for (const [cx, cy] of [[minX - 4, minY - 4], [maxX + 4, minY - 4], [minX - 4, maxY + 4], [maxX + 4, maxY + 4]]) {
        ctx.fillRect(cx - cornerSize / 2, cy - cornerSize / 2, cornerSize, cornerSize);
      }

      // Poignée de rotation (pas pour les cercles)
      if (shape.type !== 'circle') {
        const cx = (minX + maxX) / 2;
        ctx.beginPath();
        ctx.moveTo(cx, minY - 4);
        ctx.lineTo(cx, minY - 4 - 30 / mapStore.zoom);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, minY - 4 - 30 / mapStore.zoom, 6 / mapStore.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  function renderLoop() {
    if (!canvasEl) return;
    drawMap();

    requestAnimationFrame(renderLoop);
  }

  function drawMap() {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d')!;
    const sW = canvasEl.width;
    const sH = canvasEl.height;
    const mW = mapStore.canvasWidth;
    const mH = mapStore.canvasHeight;

    // 1. Effacer le canevas écran principal
    ctx.clearRect(0, 0, sW, sH);

    // 2. Préparer le buffer de rendu double-buffer
    bufferCtx.clearRect(0, 0, mW, mH);

    // Appliquer le filtre global sur le buffer
    if (mapStore.mapFilter && mapStore.mapFilter !== 'none') {
      const intensity = mapStore.mapFilterIntensity ?? 0.5;
      if (mapStore.mapFilter === 'sepia') {
        bufferCtx.filter = `sepia(${intensity * 100}%)`;
      } else if (mapStore.mapFilter === 'warm') {
        bufferCtx.filter = `sepia(${intensity * 50}%) saturate(${100 + intensity * 60}%) hue-rotate(${-intensity * 15}deg)`;
      } else if (mapStore.mapFilter === 'cold') {
        bufferCtx.filter = `saturate(${100 - intensity * 50}%) hue-rotate(${intensity * 15}deg) brightness(${100 - intensity * 10}%)`;
      }
    } else {
      bufferCtx.filter = 'none';
    }

    // A. Dessiner le FOND (Background) de carte
    if (mapStore.backgroundType === 'image' && mapStore.backgroundImageUrl) {
      const img = assetCache.get('bg_user_image');
      if (img) {
        bufferCtx.save();
        bufferCtx.globalAlpha = mapStore.backgroundImageOpacity;
        const scale = mapStore.backgroundImageScale;
        
        // Base scale pour que 100% (1.0) remplisse la carte (cover)
        const baseScale = Math.max(mW / img.width, mH / img.height);
        const finalScale = baseScale * scale;
        
        const w = img.width * finalScale;
        const h = img.height * finalScale;
        
        // Centrer l'image par défaut, avec offset utilisateur
        const x = (mW - w) / 2 + mapStore.backgroundImageX;
        const y = (mH - h) / 2 + mapStore.backgroundImageY;
        
        bufferCtx.drawImage(img, x, y, w, h);
        bufferCtx.restore();
      } else {
        bufferCtx.fillStyle = '#121824';
        bufferCtx.fillRect(0, 0, mW, mH);
      }
    } else if (mapStore.backgroundType === 'texture') {
      const texKey = mapStore.backgroundTexture;
      const cachedTex = getOrLoadTexture(texKey) || assetCache.get(`tex_${texKey}`) || assetCache.get(texKey);
      if (cachedTex) {
        const pattern = bufferCtx.createPattern(cachedTex, 'repeat')!;
        const scale = mapStore.backgroundTextureScale ?? 1.0;
        
        // Base scale pour que 100% (1.0) remplisse la carte
        const baseScale = Math.max(mW / cachedTex.width, mH / cachedTex.height);
        const finalScale = baseScale * scale;
        
        const matrix = new DOMMatrix().scale(finalScale);
        pattern.setTransform(matrix);
        
        bufferCtx.fillStyle = pattern;
        bufferCtx.fillRect(0, 0, mW, mH);
      } else {
        bufferCtx.fillStyle = '#1e3a5f';
        bufferCtx.fillRect(0, 0, mW, mH);
      }
    } else {
      // Option 'water' par défaut
      const waterKey = 'tex_water';
      const texWater = assetCache.get(waterKey);
      if (texWater) {
        const pattern = bufferCtx.createPattern(texWater, 'repeat')!;
        bufferCtx.fillStyle = pattern;
        bufferCtx.fillRect(0, 0, mW, mH);
      } else {
        bufferCtx.fillStyle = '#1e3a5f';
        bufferCtx.fillRect(0, 0, mW, mH);
      }
    }

    // B. Assembler la TERRE masquée
    // On dessine le masque, puis on applique la texture terre
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = mW;
    tempCanvas.height = mH;
    const tempCtx = tempCanvas.getContext('2d')!;

    tempCtx.drawImage(maskCanvas, 0, 0);
    tempCtx.globalCompositeOperation = 'source-in';
    tempCtx.drawImage(landCanvas, 0, 0);

    // Dessiner la terre assemblée sur le buffer principal avec son opacité et un effet d'ombrage de relief/profondeur
    bufferCtx.save();
    bufferCtx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    bufferCtx.shadowBlur = 24;
    bufferCtx.shadowOffsetX = 0;
    bufferCtx.shadowOffsetY = 6;
    bufferCtx.globalAlpha = mapStore.foregroundOpacity;
    bufferCtx.drawImage(tempCanvas, 0, 0);
    bufferCtx.restore();

    // B2. Dessiner les FORMES GÉOMÉTRIQUES (Shapes)
    mapStore.shapes.forEach((shape) => {
      drawGeometricShape(bufferCtx, shape);
      const isSelected = isElementSelected('shape', shape.id);
      if (isSelected) {
        drawShapeSelectionBorder(bufferCtx, shape);
      }
    });

    // Dessiner l'aperçu du dessin de forme active
    if (mapStore.activeTool === 'shape' && drawingShapePoints.length > 0) {
      let previewPoints = [...drawingShapePoints];
      if (mapStore.shapeType !== 'polygon' || drawingShapePoints.length === 1) {
        const snappedCursor = snapCoordinate(cursorMapX, cursorMapY);
        previewPoints.push(snappedCursor);
      }
      const tempShape: MapShape = {
        id: 'temp_preview_shape',
        type: mapStore.shapeType,
        points: previewPoints,
        fillColor: mapStore.shapeFillColor,
        fillOpacity: mapStore.shapeFillOpacity,
        fillTexture: mapStore.shapeFillTexture,
        fillTextureScale: mapStore.shapeFillTextureScale,
        strokeColor: mapStore.shapeStrokeColor,
        strokeWidth: mapStore.shapeStrokeWidth,
        strokeDash: mapStore.shapeStrokeDash,
      };
      drawGeometricShape(bufferCtx, tempShape);
    }

    // C. Dessiner les TAMPONS (Stamps) - Triés par Z-Index et Y pour l'isométrie
    const sortedStamps = [...mapStore.stamps].sort((a, b) => {
      const zA = a.zIndex ?? 0;
      const zB = b.zIndex ?? 0;
      if (zA !== zB) return zA - zB;
      return a.y - b.y;
    });

    sortedStamps.forEach((stamp) => {
      const isProcedural = stamp.type.startsWith('td_');
      const isSelected = isElementSelected('stamp', stamp.id);
      if (isProcedural) {
        bufferCtx.save();
        bufferCtx.translate(stamp.x, stamp.y);
        bufferCtx.rotate((stamp.rotation * Math.PI) / 180);
        if (stamp.flipH || stamp.flipV) bufferCtx.scale(stamp.flipH ? -1 : 1, stamp.flipV ? -1 : 1);
        bufferCtx.globalAlpha = stamp.opacity;
        
        if (stamp.shadowEnabled) {
          bufferCtx.shadowColor = stamp.shadowColor || 'rgba(0, 0, 0, 0.4)';
          bufferCtx.shadowBlur = stamp.shadowBlur ?? 10;
          bufferCtx.shadowOffsetX = stamp.shadowOffsetX ?? 5;
          bufferCtx.shadowOffsetY = stamp.shadowOffsetY ?? 5;
        }

        drawProceduralStamp(bufferCtx, stamp.type, stamp.scale, isSelected);

        bufferCtx.shadowColor = 'transparent';
        bufferCtx.shadowBlur = 0;
        bufferCtx.shadowOffsetX = 0;
        bufferCtx.shadowOffsetY = 0;

        bufferCtx.restore();
      } else {
        const img = getOrLoadAsset(stamp.type);
        if (img) {
          bufferCtx.save();
          bufferCtx.translate(stamp.x, stamp.y);
          bufferCtx.rotate((stamp.rotation * Math.PI) / 180);
          if (stamp.flipH || stamp.flipV) bufferCtx.scale(stamp.flipH ? -1 : 1, stamp.flipV ? -1 : 1);
          bufferCtx.globalAlpha = stamp.opacity;
          
          // Dessiner l'image centrée
          const w = img.width * stamp.scale;
          const h = img.height * stamp.scale;

          if (stamp.shadowEnabled) {
            bufferCtx.shadowColor = stamp.shadowColor || 'rgba(0, 0, 0, 0.4)';
            bufferCtx.shadowBlur = stamp.shadowBlur ?? 10;
            bufferCtx.shadowOffsetX = stamp.shadowOffsetX ?? 5;
            bufferCtx.shadowOffsetY = stamp.shadowOffsetY ?? 5;
          }

          bufferCtx.drawImage(img, -w / 2, -h / 2, w, h);

          // Réinitialiser les ombres
          bufferCtx.shadowColor = 'transparent';
          bufferCtx.shadowBlur = 0;
          bufferCtx.shadowOffsetX = 0;
          bufferCtx.shadowOffsetY = 0;

          // Si sélectionné, dessiner un rectangle de sélection doré et les poignées
          if (isSelected) {
            bufferCtx.strokeStyle = '#d4a84b';
            bufferCtx.lineWidth = 2 / mapStore.zoom;
            bufferCtx.strokeRect(-w / 2, -h / 2, w, h);

            if (mapStore.activeTool === 'grid') {
              const handleSize = 8 / mapStore.zoom;
              bufferCtx.fillStyle = '#d4a84b';
              
              // 4 poignées d'angle
              bufferCtx.fillRect(-w / 2 - handleSize / 2, -h / 2 - handleSize / 2, handleSize, handleSize);
              bufferCtx.fillRect(w / 2 - handleSize / 2, -h / 2 - handleSize / 2, handleSize, handleSize);
              bufferCtx.fillRect(-w / 2 - handleSize / 2, h / 2 - handleSize / 2, handleSize, handleSize);
              bufferCtx.fillRect(w / 2 - handleSize / 2, h / 2 - handleSize / 2, handleSize, handleSize);
              
              // Poignée de rotation (ligne + cercle)
              bufferCtx.beginPath();
              bufferCtx.moveTo(0, -h / 2);
              bufferCtx.lineTo(0, -h / 2 - 30 / mapStore.zoom);
              bufferCtx.stroke();
              
              bufferCtx.beginPath();
              bufferCtx.arc(0, -h / 2 - 30 / mapStore.zoom, 6 / mapStore.zoom, 0, Math.PI * 2);
              bufferCtx.fill();
              bufferCtx.stroke();
            }
          }

          bufferCtx.restore();
        }
      }
    });

    // D. Dessiner les TRACÉS (Paths)
    mapStore.paths.forEach((path) => {
      if (path.points.length < 2) return;
      bufferCtx.save();
      bufferCtx.beginPath();
      bufferCtx.moveTo(path.points[0].x, path.points[0].y);
      if (path.smooth !== false && path.points.length > 2) {
        for (let i = 1; i < path.points.length - 1; i++) {
          const xc = (path.points[i].x + path.points[i + 1].x) / 2;
          const yc = (path.points[i].y + path.points[i + 1].y) / 2;
          bufferCtx.quadraticCurveTo(path.points[i].x, path.points[i].y, xc, yc);
        }
        bufferCtx.lineTo(path.points[path.points.length - 1].x, path.points[path.points.length - 1].y);
      } else {
        for (let i = 1; i < path.points.length; i++) {
          bufferCtx.lineTo(path.points[i].x, path.points[i].y);
        }
      }
      bufferCtx.strokeStyle = path.color;
      bufferCtx.lineWidth = path.width;
      bufferCtx.lineCap = 'round';
      bufferCtx.lineJoin = 'round';

      if (path.dashStyle === 'dashed') {
        bufferCtx.setLineDash([12, 6]);
      } else if (path.dashStyle === 'dotted') {
        bufferCtx.setLineDash([2, 6]);
      }
      bufferCtx.stroke();
      bufferCtx.restore();
    });

    // Tracé en cours de création
    if (mapStore.activeTool === 'path' && currentPathPoints.length > 0) {
      bufferCtx.save();
      bufferCtx.beginPath();
      bufferCtx.moveTo(currentPathPoints[0].x, currentPathPoints[0].y);
      const allPoints = [...currentPathPoints, { x: cursorMapX, y: cursorMapY }];
      
      if (mapStore.pathSmooth !== false && allPoints.length > 2) {
        for (let i = 1; i < allPoints.length - 1; i++) {
          const xc = (allPoints[i].x + allPoints[i + 1].x) / 2;
          const yc = (allPoints[i].y + allPoints[i + 1].y) / 2;
          bufferCtx.quadraticCurveTo(allPoints[i].x, allPoints[i].y, xc, yc);
        }
        bufferCtx.lineTo(allPoints[allPoints.length - 1].x, allPoints[allPoints.length - 1].y);
      } else {
        for (let i = 1; i < allPoints.length; i++) {
          bufferCtx.lineTo(allPoints[i].x, allPoints[i].y);
        }
      }
      bufferCtx.strokeStyle = mapStore.pathColor;
      bufferCtx.lineWidth = mapStore.pathWidth;
      bufferCtx.lineCap = 'round';
      bufferCtx.lineJoin = 'round';
      if (mapStore.pathDashStyle === 'dashed') bufferCtx.setLineDash([12, 6]);
      else if (mapStore.pathDashStyle === 'dotted') bufferCtx.setLineDash([2, 6]);
      bufferCtx.stroke();
      bufferCtx.restore();
    }

    // E. Dessiner les TEXTES
    mapStore.texts.forEach((text) => {
      bufferCtx.save();
      bufferCtx.translate(text.x, text.y);
      bufferCtx.rotate((text.rotation * Math.PI) / 180);
      bufferCtx.globalAlpha = text.opacity ?? 1;
      bufferCtx.font = `${text.size}px "${text.font}", serif`;
      bufferCtx.textAlign = 'center';
      bufferCtx.textBaseline = 'middle';

      // Ombrage/Contour
      if (text.shadowBlur > 0) {
        bufferCtx.shadowColor = text.shadowColor;
        bufferCtx.shadowBlur = text.shadowBlur;
        bufferCtx.shadowOffsetX = 1;
        bufferCtx.shadowOffsetY = 1;
        
        // Répéter un stroke léger pour épaissir la lisibilité
        bufferCtx.strokeStyle = text.shadowColor;
        bufferCtx.lineWidth = 3;
        bufferCtx.strokeText(text.text, 0, 0);
      }

      bufferCtx.fillStyle = text.color;
      bufferCtx.fillText(text.text, 0, 0);

      // Si sélectionné, dessiner un cadre de texte doré
      if (isElementSelected('text', text.id)) {
        const textMetrics = bufferCtx.measureText(text.text);
        const w = textMetrics.width;
        const h = text.size;
        const bw = w / 2 + 8;
        const bh = h / 2 + 4;
        bufferCtx.strokeStyle = '#d4a84b';
        bufferCtx.lineWidth = 1.5;
        bufferCtx.strokeRect(-bw, -bh, bw * 2, bh * 2);

        // Poignées de transformation (outil Sélection)
        if (mapStore.activeTool === 'grid') {
          const handleSize = 8 / mapStore.zoom;
          bufferCtx.fillStyle = '#d4a84b';
          for (const [cx, cy] of [[-bw, -bh], [bw, -bh], [-bw, bh], [bw, bh]]) {
            bufferCtx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
          }
          // Poignée de rotation
          bufferCtx.beginPath();
          bufferCtx.moveTo(0, -bh);
          bufferCtx.lineTo(0, -bh - 30 / mapStore.zoom);
          bufferCtx.stroke();
          bufferCtx.beginPath();
          bufferCtx.arc(0, -bh - 30 / mapStore.zoom, 6 / mapStore.zoom, 0, Math.PI * 2);
          bufferCtx.fill();
          bufferCtx.stroke();
        }
      }

      bufferCtx.restore();
    });

    // F. Dessiner la GRILLE
    if (mapStore.showGrid) {
      bufferCtx.save();
      bufferCtx.strokeStyle = mapStore.gridColor;
      bufferCtx.lineWidth = 1;
      const gSize = mapStore.gridSize;

      if (mapStore.gridType === 'square') {
        for (let x = 0; x <= mW; x += gSize) {
          bufferCtx.beginPath();
          bufferCtx.moveTo(x, 0);
          bufferCtx.lineTo(x, mH);
          bufferCtx.stroke();
        }
        for (let y = 0; y <= mH; y += gSize) {
          bufferCtx.beginPath();
          bufferCtx.moveTo(0, y);
          bufferCtx.lineTo(mW, y);
          bufferCtx.stroke();
        }
      } else if (mapStore.gridType === 'hex') {
        // Dessin d'une grille hexagonale classique
        const r = gSize / Math.sqrt(3);
        const h = gSize;
        const w = 2 * r;
        const xOffset = w * 0.75;
        const yOffset = h;

        for (let x = 0; x < mW + w; x += xOffset) {
          let odd = false;
          for (let y = 0; y < mH + h; y += yOffset) {
            const cx = x;
            const cy = y + (odd ? h / 2 : 0);
            bufferCtx.beginPath();
            for (let side = 0; side < 6; side++) {
              const angle = (side * Math.PI) / 3;
              bufferCtx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
            }
            bufferCtx.closePath();
            bufferCtx.stroke();
            odd = !odd;
          }
        }
      }
      bufferCtx.restore();
    }

    // Reset filter for overlays
    bufferCtx.filter = 'none';

    // 1. Parchment paper overlay (Multiply blend mode)
    if (mapStore.paperOverlayEnabled) {
      const parchmentImg = assetCache.get('tex_parchment');
      if (parchmentImg) {
        bufferCtx.save();
        bufferCtx.globalCompositeOperation = 'multiply';
        bufferCtx.globalAlpha = mapStore.paperOverlayOpacity ?? 0.3;
        const pattern = bufferCtx.createPattern(parchmentImg, 'repeat')!;
        bufferCtx.fillStyle = pattern;
        bufferCtx.fillRect(0, 0, mW, mH);
        bufferCtx.restore();
      }
    }

    // 2. Vignette effect (Radial gradient overlay)
    if (mapStore.vignetteEnabled) {
      bufferCtx.save();
      const vOpacity = mapStore.vignetteOpacity ?? 0.4;
      const grad = bufferCtx.createRadialGradient(
        mW / 2, mH / 2, Math.min(mW, mH) * 0.4,
        mW / 2, mH / 2, Math.max(mW, mH) * 0.7
      );
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(1, `rgba(0, 0, 0, ${vOpacity})`);
      bufferCtx.fillStyle = grad;
      bufferCtx.fillRect(0, 0, mW, mH);
      bufferCtx.restore();
    }

    // 3. Dessiner le buffer à l'écran avec translation/scale
    ctx.save();
    ctx.translate(mapStore.panX, mapStore.panY);
    ctx.scale(mapStore.zoom, mapStore.zoom);

    // Dessiner la zone utile de la carte
    ctx.drawImage(bufferCanvas, 0, 0);

    // Dessiner la bordure de la carte active
    ctx.strokeStyle = 'rgba(212, 168, 75, 0.4)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, mW, mH);

    // 4. Dessiner l'aperçu du pinceau / de l'outil actif sous le pointeur
    drawToolPreview(ctx);

    ctx.restore();

    // 5. Surcouches PAO en espace écran : guides, marquee, mesure, règles
    drawPaoOverlays(ctx);
  }

  // ── SURCOUCHES PAO (espace écran) ──
  function drawPaoOverlays(ctx: CanvasRenderingContext2D) {
    if (!canvasEl) return;
    const cw = canvasEl.width;
    const ch = canvasEl.height;

    // A. Guides (cyan, sur toute la hauteur/largeur du viewport)
    ctx.save();
    ctx.strokeStyle = 'rgba(64, 200, 255, 0.75)';
    ctx.lineWidth = 1;
    for (const gx of mapStore.guides.v) {
      const sx = Math.round(mapToScreen(gx, 0).x) + 0.5;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, ch);
      ctx.stroke();
    }
    for (const gy of mapStore.guides.h) {
      const sy = Math.round(mapToScreen(0, gy).y) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(cw, sy);
      ctx.stroke();
    }
    ctx.restore();

    // B. Cadre de sélection (marquee)
    if (marqueeStart && marqueeEnd) {
      const a = mapToScreen(marqueeStart.x, marqueeStart.y);
      const b = mapToScreen(marqueeEnd.x, marqueeEnd.y);
      ctx.save();
      ctx.strokeStyle = '#d4a84b';
      ctx.fillStyle = 'rgba(212, 168, 75, 0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const w = Math.abs(b.x - a.x);
      const h = Math.abs(b.y - a.y);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }

    // C. Mesure (ligne cotée : distance en px carte et en cases)
    if (measureStart && measureEnd) {
      const a = mapToScreen(measureStart.x, measureStart.y);
      const b = mapToScreen(measureEnd.x, measureEnd.y);
      const distMap = Math.hypot(measureEnd.x - measureStart.x, measureEnd.y - measureStart.y);
      const cells = distMap / mapStore.gridSize;

      ctx.save();
      ctx.strokeStyle = '#7fe07f';
      ctx.fillStyle = '#7fe07f';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      // Extrémités (petits traits perpendiculaires, façon cote technique)
      const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
      const tick = 6;
      for (const p of [a, b]) {
        ctx.beginPath();
        ctx.moveTo(p.x - Math.cos(ang) * tick, p.y - Math.sin(ang) * tick);
        ctx.lineTo(p.x + Math.cos(ang) * tick, p.y + Math.sin(ang) * tick);
        ctx.stroke();
      }
      // Étiquette au milieu
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const label = `${Math.round(distMap)} px · ${cells.toFixed(1)} case${cells >= 2 ? 's' : ''}`;
      ctx.font = '12px system-ui, sans-serif';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(11, 14, 23, 0.9)';
      ctx.fillRect(midX - tw / 2 - 6, midY - 22, tw + 12, 18);
      ctx.strokeStyle = 'rgba(127, 224, 127, 0.5)';
      ctx.strokeRect(midX - tw / 2 - 6, midY - 22, tw + 12, 18);
      ctx.fillStyle = '#7fe07f';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, midX, midY - 13);
      ctx.restore();
    }

    // D. Règles graduées (par-dessus tout)
    if (mapStore.showRulers) {
      drawRulers(ctx, cw, ch);
    }
  }

  function drawRulers(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
    // Bords intérieurs des règles (décalées sous les barres flottantes)
    const top = rulerOffsetY;
    const left = rulerOffsetX;
    const topEdge = top + RULER_SIZE;
    const leftEdge = left + RULER_SIZE;

    ctx.save();

    // Fonds des règles
    ctx.fillStyle = 'rgba(13, 16, 24, 0.92)';
    ctx.fillRect(left, top, cw - left, RULER_SIZE); // haut
    ctx.fillRect(left, top, RULER_SIZE, ch - top); // gauche
    ctx.strokeStyle = 'rgba(212, 168, 75, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, topEdge + 0.5);
    ctx.lineTo(cw, topEdge + 0.5);
    ctx.moveTo(leftEdge + 0.5, top);
    ctx.lineTo(leftEdge + 0.5, ch);
    ctx.stroke();

    // Pas de graduation adapté au zoom (étiquettes espacées d'au moins ~55 px écran)
    const steps = [10, 25, 50, 100, 250, 500, 1000, 2500];
    let step = steps[steps.length - 1];
    for (const s of steps) {
      if (s * mapStore.zoom >= 55) { step = s; break; }
    }

    ctx.font = '9px system-ui, sans-serif';
    ctx.fillStyle = '#9aa3b2';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';

    // Règle horizontale (haut)
    const startMapX = Math.floor((leftEdge - mapStore.panX) / mapStore.zoom / step) * step;
    const endMapX = (cw - mapStore.panX) / mapStore.zoom;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (let mx = startMapX; mx <= endMapX; mx += step) {
      const sx = Math.round(mapToScreen(mx, 0).x) + 0.5;
      if (sx < leftEdge) continue;
      ctx.beginPath();
      ctx.moveTo(sx, topEdge - 7);
      ctx.lineTo(sx, topEdge);
      ctx.stroke();
      ctx.fillText(String(mx), sx + 3, top + 3);
      // Sous-graduations
      for (let k = 1; k < 5; k++) {
        const sub = Math.round(mapToScreen(mx + (step / 5) * k, 0).x) + 0.5;
        if (sub < leftEdge) continue;
        ctx.beginPath();
        ctx.moveTo(sub, topEdge - 3);
        ctx.lineTo(sub, topEdge);
        ctx.stroke();
      }
    }

    // Règle verticale (gauche)
    const startMapY = Math.floor((topEdge - mapStore.panY) / mapStore.zoom / step) * step;
    const endMapY = (ch - mapStore.panY) / mapStore.zoom;
    for (let my = startMapY; my <= endMapY; my += step) {
      const sy = Math.round(mapToScreen(0, my).y) + 0.5;
      if (sy < topEdge) continue;
      ctx.beginPath();
      ctx.moveTo(leftEdge - 7, sy);
      ctx.lineTo(leftEdge, sy);
      ctx.stroke();
      ctx.save();
      ctx.translate(left + 3, sy + 3);
      ctx.rotate(Math.PI / 2);
      ctx.fillText(String(my), 0, -10);
      ctx.restore();
      for (let k = 1; k < 5; k++) {
        const sub = Math.round(mapToScreen(0, my + (step / 5) * k).y) + 0.5;
        if (sub < topEdge) continue;
        ctx.beginPath();
        ctx.moveTo(leftEdge - 3, sub);
        ctx.lineTo(leftEdge, sub);
        ctx.stroke();
      }
    }

    // Marqueurs de position du curseur
    const cur = mapToScreen(cursorMapX, cursorMapY);
    ctx.strokeStyle = '#d4a84b';
    ctx.beginPath();
    if (cur.x >= leftEdge) {
      ctx.moveTo(cur.x + 0.5, top);
      ctx.lineTo(cur.x + 0.5, topEdge);
    }
    if (cur.y >= topEdge) {
      ctx.moveTo(left, cur.y + 0.5);
      ctx.lineTo(leftEdge, cur.y + 0.5);
    }
    ctx.stroke();

    // Coin (origine des règles)
    ctx.fillStyle = 'rgba(13, 16, 24, 1)';
    ctx.fillRect(left, top, RULER_SIZE, RULER_SIZE);
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('px', left + RULER_SIZE / 2, top + RULER_SIZE / 2);

    ctx.restore();
  }

  // APERÇU DES OUTILS (Brosse, Tampon, Texte, etc.)
  function drawToolPreview(ctx: CanvasRenderingContext2D) {
    const tool = mapStore.activeTool;
    let mx = cursorMapX;
    let my = cursorMapY;
    
    if (tool === 'sculpt' || tool === 'paint') {
      if (mapStore.brushSnap) {
        mx = Math.round(cursorMapX / mapStore.gridSize) * mapStore.gridSize;
        my = Math.round(cursorMapY / mapStore.gridSize) * mapStore.gridSize;
      }
    } else {
      const snapped = snapCoordinate(cursorMapX, cursorMapY);
      mx = snapped.x;
      my = snapped.y;
    }

    if (mx < 0 || mx > mapStore.canvasWidth || my < 0 || my > mapStore.canvasHeight) return;

    ctx.save();
    if (tool === 'sculpt') {
      ctx.beginPath();
      if (mapStore.brushShape === 'square') {
        ctx.rect(mx - mapStore.sculptBrushSize, my - mapStore.sculptBrushSize, mapStore.sculptBrushSize * 2, mapStore.sculptBrushSize * 2);
      } else if (mapStore.brushShape === 'rough') {
        drawRoughBrush(ctx, mx, my, mapStore.sculptBrushSize);
      } else {
        ctx.arc(mx, my, mapStore.sculptBrushSize, 0, Math.PI * 2);
      }
      ctx.strokeStyle = mapStore.sculptMode === 'add' ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (tool === 'paint') {
      ctx.beginPath();
      if (mapStore.brushShape === 'square') {
        ctx.rect(mx - mapStore.paintBrushSize, my - mapStore.paintBrushSize, mapStore.paintBrushSize * 2, mapStore.paintBrushSize * 2);
      } else if (mapStore.brushShape === 'rough') {
        drawRoughBrush(ctx, mx, my, mapStore.paintBrushSize);
      } else {
        ctx.arc(mx, my, mapStore.paintBrushSize, 0, Math.PI * 2);
      }
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (tool === 'stamp') {
      const isProcedural = mapStore.activeStamp.startsWith('td_');
      if (isProcedural) {
        ctx.translate(mx, my);
        ctx.rotate((mapStore.stampRotation * Math.PI) / 180);
        ctx.globalAlpha = 0.5;
        drawProceduralStamp(ctx, mapStore.activeStamp, mapStore.stampScale, false);
      } else {
        const img = getOrLoadAsset(mapStore.activeStamp);
        if (img) {
          ctx.translate(mx, my);
          ctx.rotate((mapStore.stampRotation * Math.PI) / 180);
          ctx.globalAlpha = 0.5;
          const w = img.width * mapStore.stampScale;
          const h = img.height * mapStore.stampScale;
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
        }
      }
    } else if (tool === 'text') {
      ctx.translate(mx, my);
      ctx.rotate((mapStore.textRotation * Math.PI) / 180);
      ctx.font = `${mapStore.textSize}px "${mapStore.textFont}", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = mapStore.textColor;
      ctx.fillText(mapStore.textValue, 0, 0);
    } else if (tool === 'shape') {
      ctx.beginPath();
      ctx.arc(mx, my, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(212, 168, 75, 0.8)';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  // Helper pour dessiner la brosse rugueuse
  function drawRoughBrush(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    const points = 16;
    for (let i = 0; i <= points; i++) {
      const angle = (i * Math.PI * 2) / points;
      // Variation pseudo-aléatoire basée sur l'angle pour garder une forme cohérente pendant le drag
      const jitter = 0.75 + (Math.sin(angle * 7) * 0.15) + (Math.cos(angle * 13) * 0.1);
      const px = x + Math.cos(angle) * size * jitter;
      const py = y + Math.sin(angle) * size * jitter;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }

  // LOGIQUE DES ACTIONS D'ÉDITION
  function applySculptStroke(x: number, y: number) {
    const size = mapStore.sculptBrushSize;
    maskCtx.save();
    if (mapStore.sculptMode === 'add') {
      maskCtx.fillStyle = '#ffffff';
      maskCtx.globalCompositeOperation = 'source-over';
    } else {
      maskCtx.globalCompositeOperation = 'destination-out';
    }

    if (mapStore.brushShape === 'square') {
      maskCtx.fillRect(x - size, y - size, size * 2, size * 2);
    } else if (mapStore.brushShape === 'rough') {
      maskCtx.beginPath();
      drawRoughBrush(maskCtx, x, y, size);
      maskCtx.fill();
    } else {
      // Effet rugueux / naturel (génération de petits cercles aléatoires autour du tracé)
      const roughness = mapStore.sculptRoughness;
      const rCount = roughness > 0 ? 5 : 1;
      for (let i = 0; i < rCount; i++) {
        const rSize = size * (0.8 + Math.random() * 0.4);
        const ox = (Math.random() - 0.5) * size * roughness * 2;
        const oy = (Math.random() - 0.5) * size * roughness * 2;
        maskCtx.beginPath();
        maskCtx.arc(x + ox, y + oy, rSize, 0, Math.PI * 2);
        maskCtx.fill();
      }
    }
    maskCtx.restore();
  }

  function applyPaintStroke(x: number, y: number) {
    const texName = `tex_${mapStore.paintTexture}`;
    let texture = assetCache.get(texName);
    if (!texture) {
      texture = getOrLoadTexture(mapStore.paintTexture);
      if (!texture) return;
    }

    const size = mapStore.paintBrushSize;
    const opacity = mapStore.paintBrushOpacity;

    landCtx.save();
    const pattern = landCtx.createPattern(texture, 'repeat')!;
    landCtx.fillStyle = pattern;

    // Créer un masque (circulaire ou carré) pour le tracé de peinture
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = mapStore.canvasWidth;
    maskCanvas.height = mapStore.canvasHeight;
    const mCtx = maskCanvas.getContext('2d')!;

    mCtx.fillStyle = 'white';
    if (mapStore.brushShape === 'square') {
      mCtx.fillRect(x - size, y - size, size * 2, size * 2);
    } else if (mapStore.brushShape === 'rough') {
      mCtx.beginPath();
      drawRoughBrush(mCtx, x, y, size);
      mCtx.fill();
    } else {
      mCtx.beginPath();
      mCtx.arc(x, y, size, 0, Math.PI * 2);
      mCtx.fill();
    }

    // Peindre avec motif à travers le masque
    landCtx.globalAlpha = opacity;
    
    // Pour ne dessiner que là où le pinceau passe
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = mapStore.canvasWidth;
    tempCanvas.height = mapStore.canvasHeight;
    const tempCtx = tempCanvas.getContext('2d')!;
    
    tempCtx.drawImage(maskCanvas, 0, 0);
    tempCtx.globalCompositeOperation = 'source-in';
    tempCtx.fillStyle = pattern;
    tempCtx.fillRect(0, 0, mapStore.canvasWidth, mapStore.canvasHeight);

    landCtx.drawImage(tempCanvas, 0, 0);
    landCtx.restore();
  }

  // SÉLECTION D'ÉLÉMENT PAR COLLISION
  function findElementAt(x: number, y: number) {
    // 1. Textes d'abord (car ils ont tendance à être au-dessus)
    for (let i = mapStore.texts.length - 1; i >= 0; i--) {
      const text = mapStore.texts[i];
      if (text.locked) continue;
      const dist = Math.sqrt((text.x - x) ** 2 + (text.y - y) ** 2);
      // Rayon d'impact approximatif du texte
      if (dist < 40) return { type: 'text' as const, id: text.id, x: text.x, y: text.y };
    }

    // 1.5. Formes Géométriques (Shapes)
    for (let i = mapStore.shapes.length - 1; i >= 0; i--) {
      const shape = mapStore.shapes[i];
      if (shape.locked || shape.points.length === 0) continue;
      
      let hit = false;
      if (shape.type === 'rectangle' && shape.points.length > 1) {
        const p0 = shape.points[0];
        const p1 = shape.points[1];
        const minX = Math.min(p0.x, p1.x);
        const maxX = Math.max(p0.x, p1.x);
        const minY = Math.min(p0.y, p1.y);
        const maxY = Math.max(p0.y, p1.y);
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
          hit = true;
        }
      } else if (shape.type === 'circle' && shape.points.length > 1) {
        const p0 = shape.points[0];
        const p1 = shape.points[1];
        const r = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        const dist = Math.hypot(x - p0.x, y - p0.y);
        if (dist <= r) {
          hit = true;
        }
      } else if (shape.type === 'polygon') {
        let isInside = false;
        const pts = shape.points;
        for (let idx = 0, jdx = pts.length - 1; idx < pts.length; jdx = idx++) {
          const xi = pts[idx].x, yi = pts[idx].y;
          const xj = pts[jdx].x, yj = pts[jdx].y;
          const intersect = ((yi > y) !== (yj > y))
              && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
          if (intersect) isInside = !isInside;
        }
        if (isInside) {
          hit = true;
        }
      }
      
      if (!hit) {
        for (const p of shape.points) {
          if (Math.hypot(p.x - x, p.y - y) < 20) {
            hit = true;
            break;
          }
        }
      }
      
      if (hit) {
        return { type: 'shape' as const, id: shape.id, x: shape.points[0].x, y: shape.points[0].y };
      }
    }

    // 2. Tampons (Stamps), par ordre inverse d'affichage (les plus hauts d'abord)
    const sortedStamps = [...mapStore.stamps].sort((a, b) => b.y - a.y);
    for (const stamp of sortedStamps) {
      if (stamp.locked) continue;
      let w = 80;
      let h = 80;
      if (stamp.type.startsWith('td_')) {
        w = 80 * stamp.scale;
        h = 80 * stamp.scale;
      } else {
        const img = assetCache.get(`stamp_${stamp.type}`);
        if (img) {
          w = img.width * stamp.scale;
          h = img.height * stamp.scale;
        } else {
          continue;
        }
      }
      const halfW = w / 2;
      const halfH = h / 2;
      // Collision AABB orientée (simplifiée)
      if (x >= stamp.x - halfW && x <= stamp.x + halfW && y >= stamp.y - halfH && y <= stamp.y + halfH) {
        return { type: 'stamp' as const, id: stamp.id, x: stamp.x, y: stamp.y };
      }
    }

    return null;
  }

  // GESTIONNAIRE D'ÉVÉNEMENTS SOURIS / TOUCH
  function onPointerDown(e: PointerEvent) {
    if (!canvasEl) return;
    isPointerDown = true;
    const rect = canvasEl.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    const mapPos = screenToMap(screenX, screenY);
    lastX = mapPos.x;
    lastY = mapPos.y;

    // Pan avec Clic Droit ou Clic Milieu ou Space
    if (e.button === 2 || e.button === 1) {
      isPanning = true;
      startPanX = screenX - mapStore.panX;
      startPanY = screenY - mapStore.panY;
      e.preventDefault();
      return;
    }

    // ── PAO : créer un guide en tirant depuis une règle ──
    if (mapStore.showRulers && (screenX <= rulerOffsetX + RULER_SIZE || screenY <= rulerOffsetY + RULER_SIZE)) {
      if (screenX <= rulerOffsetX + RULER_SIZE && screenY <= rulerOffsetY + RULER_SIZE) {
        isPointerDown = false;
        return; // coin : aucune action
      }
      if (screenY <= rulerOffsetY + RULER_SIZE) {
        // Tirer depuis la règle du haut -> guide horizontal
        mapStore.guides = { ...mapStore.guides, h: [...mapStore.guides.h, mapPos.y] };
        draggingGuide = { axis: 'h', index: mapStore.guides.h.length - 1 };
      } else {
        // Tirer depuis la règle de gauche -> guide vertical
        mapStore.guides = { ...mapStore.guides, v: [...mapStore.guides.v, mapPos.x] };
        draggingGuide = { axis: 'v', index: mapStore.guides.v.length - 1 };
      }
      return;
    }

    // ── PAO : attraper un guide existant (outil Sélection) ──
    if (mapStore.activeTool === 'grid') {
      const grabThreshold = 5; // px écran
      for (let i = 0; i < mapStore.guides.v.length; i++) {
        if (Math.abs(mapToScreen(mapStore.guides.v[i], 0).x - screenX) <= grabThreshold) {
          draggingGuide = { axis: 'v', index: i };
          return;
        }
      }
      for (let i = 0; i < mapStore.guides.h.length; i++) {
        if (Math.abs(mapToScreen(0, mapStore.guides.h[i]).y - screenY) <= grabThreshold) {
          draggingGuide = { axis: 'h', index: i };
          return;
        }
      }
    }

    // ── PAO : outil Mesure ──
    if (mapStore.activeTool === 'measure') {
      measureStart = { x: mapPos.x, y: mapPos.y };
      measureEnd = { x: mapPos.x, y: mapPos.y };
      isMeasuring = true;
      return;
    }

    const tool = mapStore.activeTool;
    let px = mapPos.x;
    let py = mapPos.y;
    
    if (tool === 'sculpt' || tool === 'paint') {
      if (mapStore.brushSnap) {
        px = Math.round(mapPos.x / mapStore.gridSize) * mapStore.gridSize;
        py = Math.round(mapPos.y / mapStore.gridSize) * mapStore.gridSize;
      }
    } else {
      const snapped = snapCoordinate(mapPos.x, mapPos.y);
      px = snapped.x;
      py = snapped.y;
    }

    if (tool === 'sculpt') {
      pushHistory(true);
      applySculptStroke(px, py);
    } else if (tool === 'paint') {
      pushHistory(true);
      applyPaintStroke(px, py);
    } else if (tool === 'stamp') {
      pushHistory();
      // Calculer l'échelle / rotation avec randomiseur
      let scale = mapStore.stampScale;
      let rot = mapStore.stampRotation;
      if (mapStore.randomizeStampScale) scale *= 0.8 + Math.random() * 0.4;
      if (mapStore.randomizeStampRotation) rot += (Math.random() - 0.5) * 30;

      const newStamp: MapStamp = {
        id: Math.random().toString(36).slice(2),
        type: mapStore.activeStamp,
        x: px,
        y: py,
        scale,
        rotation: rot,
        opacity: mapStore.stampOpacity,
        zIndex: 0,
        shadowEnabled: mapStore.stampShadowEnabled,
        shadowBlur: mapStore.stampShadowBlur,
        shadowColor: mapStore.stampShadowColor,
        shadowOffsetX: mapStore.stampShadowOffsetX,
        shadowOffsetY: mapStore.stampShadowOffsetY,
      };
      mapStore.stamps = [...mapStore.stamps, newStamp];
      
      if (mapStore.stampScatterEnabled) {
        lastScatterX = px;
        lastScatterY = py;
      }
    } else if (tool === 'path') {
      currentPathPoints.push({ x: px, y: py });
    } else if (tool === 'text') {
      pushHistory();
      const newText: MapText = {
        id: Math.random().toString(36).slice(2),
        text: mapStore.textValue,
        x: px,
        y: py,
        size: mapStore.textSize,
        color: mapStore.textColor,
        font: mapStore.textFont,
        rotation: mapStore.textRotation,
        shadowColor: mapStore.textShadowColor,
        shadowBlur: mapStore.textShadowBlur,
      };
      mapStore.texts = [...mapStore.texts, newText];
      setSelection([{ type: 'text', id: newText.id }]);
    } else if (tool === 'shape') {
      if (mapStore.shapeType === 'polygon') {
        if (drawingShapePoints.length >= 3 && Math.hypot(px - drawingShapePoints[0].x, py - drawingShapePoints[0].y) < 15) {
          finishShape();
        } else {
          pushHistory();
          drawingShapePoints.push({ x: px, y: py });
        }
      } else {
        pushHistory();
        drawingShapePoints = [{ x: px, y: py }];
      }
    } else if (tool === 'grid') {
      // 1. Tester d'abord les poignées de l'élément sélectionné actif s'il s'agit d'un stamp
      if (mapStore.selectedElement && mapStore.selectedElement.type === 'stamp') {
        const selectedStamp = mapStore.stamps.find(s => s.id === mapStore.selectedElement!.id);
        if (selectedStamp) {
          let w = 80;
          let h = 80;
          if (!selectedStamp.type.startsWith('td_')) {
            const img = assetCache.get(`stamp_${selectedStamp.type}`);
            if (img) {
              w = img.width * selectedStamp.scale;
              h = img.height * selectedStamp.scale;
            }
          } else {
            w = 80 * selectedStamp.scale;
            h = 80 * selectedStamp.scale;
          }
          
          const lx = mapPos.x - selectedStamp.x;
          const ly = mapPos.y - selectedStamp.y;
          const rad = (-selectedStamp.rotation * Math.PI) / 180;
          const rx = lx * Math.cos(rad) - ly * Math.sin(rad);
          const ry = lx * Math.sin(rad) + ly * Math.cos(rad);
          
          const clickRadius = 12 / mapStore.zoom;
          
          // Rotation handle: (0, -h/2 - 30 / mapStore.zoom)
          const rotX = 0;
          const rotY = -h/2 - 30 / mapStore.zoom;
          if (Math.hypot(rx - rotX, ry - rotY) <= clickRadius) {
            pushHistory();
            activeHandle = 'rotate';
            initialDragRotation = selectedStamp.rotation;
            initialDragAngle = Math.atan2(ly, lx);
            isDraggingElement = true;
            return;
          }
          
          // Resize handles: corners
          const corners = [
            { name: 'resize-tl', cx: -w/2, cy: -h/2 },
            { name: 'resize-tr', cx: w/2, cy: -h/2 },
            { name: 'resize-bl', cx: -w/2, cy: h/2 },
            { name: 'resize-br', cx: w/2, cy: h/2 }
          ];
          for (const corner of corners) {
            if (Math.hypot(rx - corner.cx, ry - corner.cy) <= clickRadius) {
              pushHistory();
              activeHandle = corner.name;
              initialDragScale = selectedStamp.scale;
              initialDragDist = Math.hypot(lx, ly);
              isDraggingElement = true;
              return;
            }
          }
        }
      }

      // 1b. Poignées du texte sélectionné (rotation + taille)
      if (mapStore.selectedElement && mapStore.selectedElement.type === 'text') {
        const t = mapStore.texts.find((tx) => tx.id === mapStore.selectedElement!.id);
        if (t) {
          let w = t.text.length * t.size * 0.55;
          if (bufferCtx) {
            bufferCtx.save();
            bufferCtx.font = `${t.size}px "${t.font}", serif`;
            w = bufferCtx.measureText(t.text).width;
            bufferCtx.restore();
          }
          const lx = mapPos.x - t.x;
          const ly = mapPos.y - t.y;
          const rad = (-t.rotation * Math.PI) / 180;
          const rx = lx * Math.cos(rad) - ly * Math.sin(rad);
          const ry = lx * Math.sin(rad) + ly * Math.cos(rad);
          const clickRadius = 12 / mapStore.zoom;
          const bw = w / 2 + 8;
          const bh = t.size / 2 + 4;

          if (Math.hypot(rx, ry - (-bh - 30 / mapStore.zoom)) <= clickRadius) {
            pushHistory();
            activeHandle = 'rotate-text';
            initialDragRotation = t.rotation;
            initialDragAngle = Math.atan2(ly, lx);
            isDraggingElement = true;
            return;
          }
          for (const [cx, cy] of [[-bw, -bh], [bw, -bh], [-bw, bh], [bw, bh]]) {
            if (Math.hypot(rx - cx, ry - cy) <= clickRadius) {
              pushHistory();
              activeHandle = 'resize-text';
              initialTextSize = t.size;
              initialDragDist = Math.hypot(lx, ly);
              isDraggingElement = true;
              return;
            }
          }
        }
      }

      // 1c. Poignées de la forme sélectionnée (rotation + redimensionnement)
      if (mapStore.selectedElement && mapStore.selectedElement.type === 'shape') {
        const sh = mapStore.shapes.find((s) => s.id === mapStore.selectedElement!.id);
        if (sh && sh.points.length > 0) {
          const box = measureElement('shape', sh.id);
          if (box) {
            const clickRadius = 12 / mapStore.zoom;

            // Rotation (pas pour les cercles : invariants par rotation)
            if (sh.type !== 'circle' && Math.hypot(mapPos.x - box.cx, mapPos.y - (box.minY - 4 - 30 / mapStore.zoom)) <= clickRadius) {
              pushHistory();
              // Un rectangle défini par 2 coins doit devenir un polygone pour pivoter
              if (sh.type === 'rectangle' && sh.points.length > 1) {
                const poly = rectangleToPolygonPoints(sh.points[0], sh.points[1]);
                mapStore.shapes = mapStore.shapes.map((s) =>
                  s.id === sh.id ? { ...s, type: 'polygon' as const, points: poly } : s
                );
                initialShapePoints = poly.map((p) => ({ ...p }));
              } else {
                initialShapePoints = sh.points.map((p) => ({ ...p }));
              }
              shapeDragCenter = { x: box.cx, y: box.cy };
              activeHandle = 'rotate-shape';
              initialDragAngle = Math.atan2(mapPos.y - box.cy, mapPos.x - box.cx);
              isDraggingElement = true;
              return;
            }

            // Redimensionnement par les angles de la bbox
            const bboxCorners = [
              [box.minX - 4, box.minY - 4],
              [box.maxX + 4, box.minY - 4],
              [box.minX - 4, box.maxY + 4],
              [box.maxX + 4, box.maxY + 4],
            ];
            for (const [cx, cy] of bboxCorners) {
              if (Math.hypot(mapPos.x - cx, mapPos.y - cy) <= clickRadius) {
                pushHistory();
                initialShapePoints = sh.points.map((p) => ({ ...p }));
                shapeDragCenter = { x: box.cx, y: box.cy };
                activeHandle = 'resize-shape';
                initialDragDist = Math.hypot(mapPos.x - box.cx, mapPos.y - box.cy);
                isDraggingElement = true;
                return;
              }
            }
          }
        }
      }

      // 2. Sélection normale de stamp/texte/shape (multi-sélection PAO)
      const hit = findElementAt(mapPos.x, mapPos.y);
      if (hit) {
        if (e.shiftKey) {
          // Shift + clic : ajouter / retirer de la multi-sélection sans déplacer
          toggleInSelection({ type: hit.type, id: hit.id });
          activeHandle = 'none';
          return;
        }
        pushHistory();
        if (isInSelection(hit.type, hit.id) && mapStore.selectedIds.length > 1) {
          // Clic sur un élément déjà dans la multi-sélection : déplacer le groupe
          mapStore.selectedElement = { type: hit.type, id: hit.id };
        } else {
          setSelection([{ type: hit.type, id: hit.id }]);
        }
        activeHandle = 'move';
        dragOffset = { x: mapPos.x - hit.x, y: mapPos.y - hit.y };
        isDraggingElement = true;
        
        // Mettre à jour les réglages de l'outil pour refléter l'élément sélectionné
        if (hit.type === 'stamp') {
          const stamp = mapStore.stamps.find(s => s.id === hit.id);
          if (stamp) {
            mapStore.stampScale = stamp.scale;
            mapStore.stampRotation = stamp.rotation;
            mapStore.stampOpacity = stamp.opacity;
            if (stamp.shadowEnabled !== undefined) {
              mapStore.stampShadowEnabled = stamp.shadowEnabled;
              mapStore.stampShadowBlur = stamp.shadowBlur ?? 10;
              mapStore.stampShadowColor = stamp.shadowColor ?? 'rgba(0, 0, 0, 0.4)';
              mapStore.stampShadowOffsetX = stamp.shadowOffsetX ?? 5;
              mapStore.stampShadowOffsetY = stamp.shadowOffsetY ?? 5;
            }
          }
        } else if (hit.type === 'shape') {
          const shape = mapStore.shapes.find(s => s.id === hit.id);
          if (shape) {
            mapStore.shapeType = shape.type;
            mapStore.shapeFillColor = shape.fillColor;
            mapStore.shapeFillOpacity = shape.fillOpacity;
            mapStore.shapeFillTexture = shape.fillTexture;
            mapStore.shapeFillTextureScale = shape.fillTextureScale;
            mapStore.shapeStrokeColor = shape.strokeColor;
            mapStore.shapeStrokeWidth = shape.strokeWidth;
            mapStore.shapeStrokeDash = shape.strokeDash;
          }
        }
      } else {
        // Clic dans le vide : démarrer un cadre de sélection (marquee)
        if (!e.shiftKey) clearSelection();
        marqueeAdditive = e.shiftKey;
        marqueeStart = { x: mapPos.x, y: mapPos.y };
        marqueeEnd = { x: mapPos.x, y: mapPos.y };
        activeHandle = 'none';
      }
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const mapPos = screenToMap(screenX, screenY);
    cursorMapX = mapPos.x;
    cursorMapY = mapPos.y;

    if (isPanning) {
      mapStore.panX = screenX - startPanX;
      mapStore.panY = screenY - startPanY;
      return;
    }

    // ── PAO : glissement d'un guide ──
    if (draggingGuide) {
      if (draggingGuide.axis === 'v') {
        const v = [...mapStore.guides.v];
        v[draggingGuide.index] = mapPos.x;
        mapStore.guides = { ...mapStore.guides, v };
      } else {
        const h = [...mapStore.guides.h];
        h[draggingGuide.index] = mapPos.y;
        mapStore.guides = { ...mapStore.guides, h };
      }
      return;
    }

    // ── PAO : mesure en cours ──
    if (isMeasuring && measureStart) {
      measureEnd = { x: mapPos.x, y: mapPos.y };
      return;
    }

    if (!isPointerDown) return;

    // ── PAO : cadre de sélection en cours ──
    if (marqueeStart && mapStore.activeTool === 'grid' && !isDraggingElement) {
      marqueeEnd = { x: mapPos.x, y: mapPos.y };
      return;
    }

    const tool = mapStore.activeTool;
    let px = mapPos.x;
    let py = mapPos.y;
    
    if (tool === 'sculpt' || tool === 'paint') {
      if (mapStore.brushSnap) {
        px = Math.round(mapPos.x / mapStore.gridSize) * mapStore.gridSize;
        py = Math.round(mapPos.y / mapStore.gridSize) * mapStore.gridSize;
      }
    } else {
      const snapped = snapCoordinate(mapPos.x, mapPos.y);
      px = snapped.x;
      py = snapped.y;
    }

    if (tool === 'sculpt') {
      applySculptStroke(px, py);
    } else if (tool === 'paint') {
      applyPaintStroke(px, py);
    } else if (tool === 'stamp' && mapStore.stampScatterEnabled) {
      const dist = Math.hypot(mapPos.x - lastScatterX, mapPos.y - lastScatterY);
      if (dist >= mapStore.stampScatterSpacing) {
        let scale = mapStore.stampScale;
        let rot = mapStore.stampRotation;
        if (mapStore.randomizeStampScale) scale *= 0.8 + Math.random() * 0.4;
        if (mapStore.randomizeStampRotation) rot += (Math.random() - 0.5) * 30;

        const newStamp: MapStamp = {
          id: Math.random().toString(36).slice(2),
          type: mapStore.activeStamp,
          x: px,
          y: py,
          scale,
          rotation: rot,
          opacity: mapStore.stampOpacity,
          zIndex: 0,
          shadowEnabled: mapStore.stampShadowEnabled,
          shadowBlur: mapStore.stampShadowBlur,
          shadowColor: mapStore.stampShadowColor,
          shadowOffsetX: mapStore.stampShadowOffsetX,
          shadowOffsetY: mapStore.stampShadowOffsetY,
        };
        mapStore.stamps = [...mapStore.stamps, newStamp];
        lastScatterX = px;
        lastScatterY = py;
      }
    } else if (tool === 'shape') {
      if (mapStore.shapeType !== 'polygon' && drawingShapePoints.length > 0) {
        drawingShapePoints[1] = { x: px, y: py };
      }
    } else if (tool === 'grid' && isDraggingElement && mapStore.selectedElement) {
      if (activeHandle === 'move' && mapStore.selectedIds.length > 1) {
        // Déplacement de groupe : delta brut depuis la dernière position
        moveSelectionBy(mapPos.x - lastX, mapPos.y - lastY);
      } else if (activeHandle === 'move') {
        let targetX = mapPos.x - dragOffset.x;
        let targetY = mapPos.y - dragOffset.y;

        if (mapStore.stampSnapEnabled) {
          const snapped = snapCoordinate(targetX, targetY);
          targetX = snapped.x;
          targetY = snapped.y;
        } else if (mapStore.brushSnap) {
          targetX = Math.round(targetX / mapStore.gridSize) * mapStore.gridSize;
          targetY = Math.round(targetY / mapStore.gridSize) * mapStore.gridSize;
        }

        // Magnétisme aux guides PAO
        const guideSnapped = snapToGuides(targetX, targetY);
        targetX = guideSnapped.x;
        targetY = guideSnapped.y;

        if (mapStore.selectedElement.type === 'stamp') {
          mapStore.stamps = mapStore.stamps.map((s) =>
            s.id === mapStore.selectedElement!.id ? { ...s, x: targetX, y: targetY } : s
          );
        } else if (mapStore.selectedElement.type === 'text') {
          mapStore.texts = mapStore.texts.map((t) =>
            t.id === mapStore.selectedElement!.id ? { ...t, x: targetX, y: targetY } : t
          );
        } else if (mapStore.selectedElement.type === 'shape') {
          const shape = mapStore.shapes.find(s => s.id === mapStore.selectedElement!.id);
          if (shape && shape.points.length > 0) {
            const dx = targetX - shape.points[0].x;
            const dy = targetY - shape.points[0].y;
            mapStore.shapes = mapStore.shapes.map((s) =>
              s.id === shape.id
                ? {
                    ...s,
                    points: s.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
                  }
                : s
            );
          }
        }
      } else if (activeHandle === 'rotate' && mapStore.selectedElement.type === 'stamp') {
        const selectedStamp = mapStore.stamps.find(s => s.id === mapStore.selectedElement!.id);
        if (selectedStamp) {
          const lx = mapPos.x - selectedStamp.x;
          const ly = mapPos.y - selectedStamp.y;
          const currentAngle = Math.atan2(ly, lx);
          const angleDiff = ((currentAngle - initialDragAngle) * 180) / Math.PI;
          let newRot = Math.round(initialDragRotation + angleDiff);
          if (e.shiftKey) newRot = Math.round(newRot / 15) * 15; // Maj : pas de 15°
          newRot = ((newRot + 180) % 360) - 180;

          mapStore.stamps = mapStore.stamps.map(s =>
            s.id === selectedStamp.id ? { ...s, rotation: newRot } : s
          );
          mapStore.stampRotation = newRot;
        }
      } else if (activeHandle.startsWith('resize-') && mapStore.selectedElement.type === 'stamp') {
        const selectedStamp = mapStore.stamps.find(s => s.id === mapStore.selectedElement!.id);
        if (selectedStamp) {
          const lx = mapPos.x - selectedStamp.x;
          const ly = mapPos.y - selectedStamp.y;
          const currentDist = Math.hypot(lx, ly);
          if (initialDragDist > 5) {
            const ratio = currentDist / initialDragDist;
            const newScale = Math.max(0.1, Math.min(5.0, Number((initialDragScale * ratio).toFixed(2))));
            
            mapStore.stamps = mapStore.stamps.map(s =>
              s.id === selectedStamp.id ? { ...s, scale: newScale } : s
            );
            mapStore.stampScale = newScale;
          }
        }
      } else if (activeHandle === 'rotate-text' && mapStore.selectedElement.type === 'text') {
        const t = mapStore.texts.find((tx) => tx.id === mapStore.selectedElement!.id);
        if (t) {
          const currentAngle = Math.atan2(mapPos.y - t.y, mapPos.x - t.x);
          let newRot = Math.round(initialDragRotation + ((currentAngle - initialDragAngle) * 180) / Math.PI);
          if (e.shiftKey) newRot = Math.round(newRot / 15) * 15;
          newRot = ((newRot + 180) % 360 + 360) % 360 - 180;
          mapStore.texts = mapStore.texts.map((tx) => (tx.id === t.id ? { ...tx, rotation: newRot } : tx));
          mapStore.textRotation = newRot;
        }
      } else if (activeHandle === 'resize-text' && mapStore.selectedElement.type === 'text') {
        const t = mapStore.texts.find((tx) => tx.id === mapStore.selectedElement!.id);
        if (t && initialDragDist > 5) {
          const currentDist = Math.hypot(mapPos.x - t.x, mapPos.y - t.y);
          const newSize = Math.max(8, Math.min(300, Math.round(initialTextSize * (currentDist / initialDragDist))));
          mapStore.texts = mapStore.texts.map((tx) => (tx.id === t.id ? { ...tx, size: newSize } : tx));
          mapStore.textSize = newSize;
        }
      } else if (activeHandle === 'rotate-shape' && mapStore.selectedElement.type === 'shape') {
        const currentAngle = Math.atan2(mapPos.y - shapeDragCenter.y, mapPos.x - shapeDragCenter.x);
        let delta = currentAngle - initialDragAngle;
        if (e.shiftKey) {
          const deg = Math.round(((delta * 180) / Math.PI) / 15) * 15;
          delta = (deg * Math.PI) / 180;
        }
        const pts = rotatePointsAround(initialShapePoints, shapeDragCenter, delta);
        mapStore.shapes = mapStore.shapes.map((s) =>
          s.id === mapStore.selectedElement!.id ? { ...s, points: pts } : s
        );
      } else if (activeHandle === 'resize-shape' && mapStore.selectedElement.type === 'shape') {
        if (initialDragDist > 5) {
          const currentDist = Math.hypot(mapPos.x - shapeDragCenter.x, mapPos.y - shapeDragCenter.y);
          const ratio = Math.max(0.05, currentDist / initialDragDist);
          const pts = initialShapePoints.map((p) => ({
            x: shapeDragCenter.x + (p.x - shapeDragCenter.x) * ratio,
            y: shapeDragCenter.y + (p.y - shapeDragCenter.y) * ratio,
          }));
          mapStore.shapes = mapStore.shapes.map((s) =>
            s.id === mapStore.selectedElement!.id ? { ...s, points: pts } : s
          );
        }
      }
    }

    lastX = mapPos.x;
    lastY = mapPos.y;
  }

  function onPointerUp(e: PointerEvent) {
    // ── PAO : lâcher un guide (le supprimer s'il est relâché sur une règle) ──
    if (draggingGuide) {
      if (canvasEl) {
        const rect = canvasEl.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        if ((draggingGuide.axis === 'v' && sx <= rulerOffsetX + RULER_SIZE) || (draggingGuide.axis === 'h' && sy <= rulerOffsetY + RULER_SIZE)) {
          if (draggingGuide.axis === 'v') {
            mapStore.guides = { ...mapStore.guides, v: mapStore.guides.v.filter((_, i) => i !== draggingGuide!.index) };
          } else {
            mapStore.guides = { ...mapStore.guides, h: mapStore.guides.h.filter((_, i) => i !== draggingGuide!.index) };
          }
        }
      }
      draggingGuide = null;
      isPointerDown = false;
      return;
    }

    // ── PAO : fin de mesure (le résultat reste affiché) ──
    if (isMeasuring) {
      isMeasuring = false;
      isPointerDown = false;
      return;
    }

    // ── PAO : fin du cadre de sélection ──
    if (marqueeStart && marqueeEnd && mapStore.activeTool === 'grid' && !isDraggingElement) {
      const minX = Math.min(marqueeStart.x, marqueeEnd.x);
      const maxX = Math.max(marqueeStart.x, marqueeEnd.x);
      const minY = Math.min(marqueeStart.y, marqueeEnd.y);
      const maxY = Math.max(marqueeStart.y, marqueeEnd.y);
      const isRealDrag = (maxX - minX) * mapStore.zoom > 4 || (maxY - minY) * mapStore.zoom > 4;

      if (isRealDrag) {
        const inRect = (type: SelectableType, id: string) => {
          const box = measureElement(type, id);
          if (!box) return false;
          return box.cx >= minX && box.cx <= maxX && box.cy >= minY && box.cy <= maxY;
        };
        const picked = [
          ...mapStore.stamps.filter((s) => !s.locked && inRect('stamp', s.id)).map((s) => ({ type: 'stamp' as const, id: s.id })),
          ...mapStore.texts.filter((t) => !t.locked && inRect('text', t.id)).map((t) => ({ type: 'text' as const, id: t.id })),
          ...mapStore.shapes.filter((s) => !s.locked && inRect('shape', s.id)).map((s) => ({ type: 'shape' as const, id: s.id })),
        ];
        if (marqueeAdditive) {
          const merged = [...mapStore.selectedIds];
          for (const p of picked) {
            if (!merged.some((m) => m.type === p.type && m.id === p.id)) merged.push(p);
          }
          setSelection(merged);
        } else {
          setSelection(picked);
        }
      }
      marqueeStart = null;
      marqueeEnd = null;
    }

    isPointerDown = false;
    isPanning = false;
    isDraggingElement = false;
    activeHandle = 'none';

    // Terminer le dessin de forme rectangle / cercle au relâchement du clic
    const tool = mapStore.activeTool;
    if (tool === 'shape' && (mapStore.shapeType === 'rectangle' || mapStore.shapeType === 'circle')) {
      if (drawingShapePoints.length > 1) {
        const rect = canvasEl!.getBoundingClientRect();
        const mapPos = screenToMap(e.clientX - rect.left, e.clientY - rect.top);
        const snapped = snapCoordinate(mapPos.x, mapPos.y);
        
        const p0 = drawingShapePoints[0];
        const p1 = snapped;
        const d = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        
        if (d > 5) {
          pushHistory();
          const newShape: MapShape = {
            id: Math.random().toString(36).slice(2),
            type: mapStore.shapeType,
            points: [p0, p1],
            fillColor: mapStore.shapeFillColor,
            fillOpacity: mapStore.shapeFillOpacity,
            fillTexture: mapStore.shapeFillTexture,
            fillTextureScale: mapStore.shapeFillTextureScale,
            strokeColor: mapStore.shapeStrokeColor,
            strokeWidth: mapStore.shapeStrokeWidth,
            strokeDash: mapStore.shapeStrokeDash,
          };
          mapStore.shapes = [...mapStore.shapes, newShape];
        }
      }
      drawingShapePoints = [];
    }
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    if (!canvasEl) return;

    const rect = canvasEl.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Zoomer centré sur le curseur
    const mapPos = screenToMap(sx, sy);
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const nextZoom = Math.min(4.0, Math.max(0.15, mapStore.zoom * scaleFactor));
    
    mapStore.zoom = nextZoom;
    mapStore.panX = sx - mapPos.x * nextZoom;
    mapStore.panY = sy - mapPos.y * nextZoom;
  }

  // Exporter la carte complète en PNG pleine résolution (sans interface,
  // règles, guides ni cadres de sélection — contrairement au canvas écran)
  export function exportMapPng() {
    // Re-rendre le buffer sans la sélection pour ne pas incruster ses cadres dorés
    const savedSelection = [...mapStore.selectedIds];
    const savedElement = mapStore.selectedElement;
    mapStore.selectedIds = [];
    mapStore.selectedElement = null;
    drawMap();
    const url = bufferCanvas.toDataURL('image/png');
    mapStore.selectedIds = savedSelection;
    mapStore.selectedElement = savedElement;

    const safeName = (mapStore.mapTitle || '').replace(/[\\/:*?"<>|]+/g, '').trim() || 'fantasy-map';
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.png`;
    a.click();
  }

  // Obtenir le rendu pur sans téléchargement (pour envoi direct vers Grimoire)
  export function getRenderedDataUrl(): string {
    const savedSelection = [...mapStore.selectedIds];
    const savedElement = mapStore.selectedElement;
    mapStore.selectedIds = [];
    mapStore.selectedElement = null;
    drawMap();
    const url = bufferCanvas.toDataURL('image/png');
    mapStore.selectedIds = savedSelection;
    mapStore.selectedElement = savedElement;
    return url;
  }

  // Réinitialiser le terrain (masque plein + texture par défaut)
  export function resetTerrain() {
    resetCanvasData();
  }

  // Sérialiser le terrain (masque de terre + textures peintes) en PNG base64,
  // pour la sauvegarde projet et l'auto-sauvegarde
  export function getTerrainData(): { mask: string; land: string } {
    return {
      mask: maskCanvas.toDataURL('image/png'),
      land: landCanvas.toDataURL('image/png'),
    };
  }

  // Restaurer le terrain depuis des PNG base64
  export async function setTerrainData(data: { mask?: string; land?: string }) {
    const loadImage = (url: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
    const targets: [string | undefined, CanvasRenderingContext2D][] = [
      [data.mask, maskCtx],
      [data.land, landCtx],
    ];
    for (const [url, ctx] of targets) {
      if (!url) continue;
      try {
        const img = await loadImage(url);
        ctx.save();
        ctx.globalCompositeOperation = 'copy';
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      } catch {
        // Image corrompue : on garde le terrain actuel
      }
    }
  }

  // Finaliser le tracé (Esc ou Entrée ou Clic droit)
  export function finishPath() {
    if (currentPathPoints.length < 2) {
      currentPathPoints = [];
      return;
    }
    pushHistory();
    const newPath: MapPath = {
      id: Math.random().toString(36).slice(2),
      points: currentPathPoints,
      color: mapStore.pathColor,
      width: mapStore.pathWidth,
      dashStyle: mapStore.pathDashStyle,
      smooth: mapStore.pathSmooth,
    };
    mapStore.paths = [...mapStore.paths, newPath];
    currentPathPoints = [];
  }

  // Finaliser la forme polygone en cours
  export function finishShape() {
    if (drawingShapePoints.length > 2) {
      pushHistory();
      const newShape: MapShape = {
        id: Math.random().toString(36).slice(2),
        type: 'polygon',
        points: [...drawingShapePoints],
        fillColor: mapStore.shapeFillColor,
        fillOpacity: mapStore.shapeFillOpacity,
        fillTexture: mapStore.shapeFillTexture,
        fillTextureScale: mapStore.shapeFillTextureScale,
        strokeColor: mapStore.shapeStrokeColor,
        strokeWidth: mapStore.shapeStrokeWidth,
        strokeDash: mapStore.shapeStrokeDash,
      };
      mapStore.shapes = [...mapStore.shapes, newShape];
    }
    drawingShapePoints = [];
  }

  // Supprimer la sélection (multi-sélection PAO ou élément simple)
  export function deleteSelected() {
    if (mapStore.selectedIds.length > 0) {
      deleteSelection();
      return;
    }
    if (!mapStore.selectedElement) return;
    pushHistory();
    if (mapStore.selectedElement.type === 'stamp') {
      mapStore.stamps = mapStore.stamps.filter((s) => s.id !== mapStore.selectedElement!.id);
    } else if (mapStore.selectedElement.type === 'text') {
      mapStore.texts = mapStore.texts.filter((t) => t.id !== mapStore.selectedElement!.id);
    } else if (mapStore.selectedElement.type === 'shape') {
      mapStore.shapes = mapStore.shapes.filter((s) => s.id !== mapStore.selectedElement!.id);
    }
    mapStore.selectedElement = null;
  }

  // Raccourcis clavier PAO (Esc, Entrée, Suppr, Ctrl+A/D/Z/Y, flèches)
  function handleKeyDown(e: KeyboardEvent) {
    const inInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';

    if (e.key === 'Escape') {
      finishPath();
      drawingShapePoints = [];
      measureStart = null;
      measureEnd = null;
      if (!inInput) clearSelection();
      return;
    }
    if (e.key === 'Enter') {
      if (mapStore.activeTool === 'path') {
        finishPath();
      } else if (mapStore.activeTool === 'shape') {
        finishShape();
      }
      return;
    }
    if (inInput) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteSelected();
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === 'a') {
        e.preventDefault();
        mapStore.activeTool = 'grid';
        selectAll();
      } else if (k === 'd') {
        e.preventDefault();
        duplicateSelection();
      } else if (k === 'c') {
        e.preventDefault();
        copySelection();
      } else if (k === 'x') {
        e.preventDefault();
        cutSelection();
      } else if (k === 'v') {
        e.preventDefault();
        mapStore.activeTool = 'grid';
        pasteClipboard({ x: cursorMapX, y: cursorMapY });
      } else if (k === 'l') {
        e.preventDefault();
        lockSelection();
      } else if (k === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (k === 'z') {
        e.preventDefault();
        undo();
      } else if (k === 'y') {
        e.preventDefault();
        redo();
      }
      return;
    }

    // Flèches : déplacement précis de la sélection (1 px, Maj = une case de grille)
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && mapStore.selectedIds.length > 0) {
      e.preventDefault();
      const step = e.shiftKey ? mapStore.gridSize : 1;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      moveSelectionBy(dx, dy, true);
      return;
    }

    // Raccourcis d'outils (une lettre, sans modificateur)
    if (!e.altKey && !e.shiftKey) {
      const toolKeys: Record<string, typeof mapStore.activeTool> = {
        v: 'grid',     // sélection
        b: 'sculpt',   // pinceau terrain
        p: 'paint',    // peinture de textures
        s: 'stamp',    // tampons
        l: 'path',     // tracés (lignes)
        f: 'shape',    // formes
        t: 'text',     // texte
        m: 'measure',  // mesure
      };
      const k = e.key.toLowerCase();
      if (k in toolKeys) {
        mapStore.activeTool = toolKeys[k];
        mapStore.showPanel = true;
        return;
      }
      if (k === 'g') {
        mapStore.showGrid = !mapStore.showGrid;
        return;
      }
      if (k === 'r') {
        mapStore.showRulers = !mapStore.showRulers;
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="canvas-wrapper" bind:this={canvasContainer}>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <canvas
    bind:this={canvasEl}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onwheel={onWheel}
    oncontextmenu={(e) => e.preventDefault()}
  ></canvas>


  <!-- Instructions contextuelles rapides en bas -->
  <div class="canvas-tips">
    {#if mapStore.activeTool === 'path'}
      <span>Clic : poser un point · **Entrée / Échap** : finir le tracé</span>
    {:else if mapStore.activeTool === 'grid'}
      <span>Clic / cadre : sélectionner · **Maj+Clic** : multi-sélection · **Ctrl+D** : dupliquer · Tirer depuis une règle : guide</span>
    {:else if mapStore.activeTool === 'measure'}
      <span>Glisser : mesurer une distance (px et cases) · **Échap** : effacer la mesure</span>
    {:else}
      <span>**Molette** : Zoomer · **Clic Droit / Milieu + Glisser** : Se déplacer</span>
    {/if}
  </div>
</div>

<style>
  .canvas-wrapper {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    background-color: #0b0c10;
    user-select: none;
    outline: none;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: default;
  }

  .canvas-tips {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(11, 14, 23, 0.85);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(212, 168, 75, 0.25);
    color: #e5c383;
    font-size: 11px;
    padding: 6px 14px;
    border-radius: 20px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    pointer-events: none;
    font-family: system-ui, -apple-system, sans-serif;
    letter-spacing: 0.02em;
  }
</style>
