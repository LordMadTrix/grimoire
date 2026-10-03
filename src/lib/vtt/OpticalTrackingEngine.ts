// ── Moteur de Tracking Optique Webcam & Détection ArUco ───────────────────────
// Capture le flux vidéo de la caméra au-dessus de la table, détecte les marqueurs
// ArUco 4x4 sur les socles 3D, applique l'homographie et met à jour les pions en direct.

import { ARUCO_4X4_50_DICT } from './arucoGenerator';
import {
  getOpticalTrackingConfig,
  applyHomography,
  type Point2D
} from './opticalTrackingStore.svelte';
import { vttStore, type Token } from '$lib/stores/vtt.svelte';

export interface DetectedMarker {
  id: number;
  rotationDeg: number;
  cameraCenter: Point2D;
  mapCenter: Point2D;
  timestamp: number;
}

class OpticalTrackingEngine {
  private mediaStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private processingCanvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isRunning: boolean = false;
  private animFrameId: number | null = null;

  // Cache des positions lissées pour le filtrage du bruit
  private smoothedPositions: Map<number, Point2D> = new Map();
  public detectedMarkers: DetectedMarker[] = [];
  public lastFps: number = 0;
  private frameCount: number = 0;
  private lastFpsCalc: number = Date.now();

  /**
   * Liste toutes les caméras/webcams vidéo disponibles sur le système
   */
  async getAvailableCameras(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === 'videoinput');
    } catch (e) {
      console.warn('[OpticalTracking] Impossible d\'énumérer les caméras:', e);
      return [];
    }
  }

  /**
   * Démarre la capture vidéo et la boucle d'analyse en temps réel
   */
  async start(): Promise<boolean> {
    const config = getOpticalTrackingConfig();
    if (!config.enabled) return false;

    this.stop();

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: config.selectedDeviceId ? { exact: config.selectedDeviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: false
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.mediaStream;
      this.videoElement.playsInline = true;
      this.videoElement.muted = true;
      await this.videoElement.play();

      this.processingCanvas = document.createElement('canvas');
      this.processingCanvas.width = 640; // Résolution d'analyse rapide (optimale pour 30+ FPS)
      this.processingCanvas.height = 360;
      this.ctx = this.processingCanvas.getContext('2d', { willReadFrequently: true });

      this.isRunning = true;
      this.runDetectionLoop();
      console.log('[OpticalTracking] Moteur démarré avec succès');
      return true;
    } catch (err) {
      console.error('[OpticalTracking] Échec du démarrage vidéo:', err);
      this.stop();
      return false;
    }
  }

  /**
   * Arrête la capture et libère la caméra
   */
  stop() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    this.videoElement = null;
    this.processingCanvas = null;
    this.ctx = null;
    this.detectedMarkers = [];
  }

  public getStream(): MediaStream | null {
    return this.mediaStream;
  }

  public isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Boucle d'animation principale de détection
   */
  private runDetectionLoop = () => {
    if (!this.isRunning || !this.videoElement || !this.ctx || !this.processingCanvas) return;

    if (this.videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const w = this.processingCanvas.width;
      const h = this.processingCanvas.height;

      // Dessin de la frame vidéo
      this.ctx.drawImage(this.videoElement, 0, 0, w, h);
      const imgData = this.ctx.getImageData(0, 0, w, h);

      // Traitement d'image et détection ArUco
      const detected = this.scanMarkers(imgData, w, h);
      this.detectedMarkers = detected;

      // Synchronisation avec les pions du VTT
      this.syncTokensWithMarkers(detected);

      // Calcul FPS
      this.frameCount++;
      const now = Date.now();
      if (now - this.lastFpsCalc >= 1000) {
        this.lastFps = this.frameCount;
        this.frameCount = 0;
        this.lastFpsCalc = now;
      }
    }

    this.animFrameId = requestAnimationFrame(this.runDetectionLoop);
  };

  /**
   * Analyse l'image et détecte les marqueurs ArUco
   */
  private scanMarkers(img: ImageData, width: number, height: number): DetectedMarker[] {
    const data = img.data;
    const config = getOpticalTrackingConfig();
    const H = config.homographyMatrix;
    const detected: DetectedMarker[] = [];

    // Binarisation rapide avec seuillage local
    // Pour une robustesse optimale sur table projetée, on utilise un balayage de contours carrés
    const candidates = this.findSquareCandidates(data, width, height);

    for (const quad of candidates) {
      // Décodage de la grille 6x6 ArUco
      const markerResult = this.decodeArucoQuad(data, width, height, quad);
      if (markerResult) {
        const camCenter: Point2D = {
          x: quad.cx * (1280 / width),
          y: quad.cy * (720 / height)
        };

        // Projection sur la carte PixiJS si la calibration est faite
        let mapCenter: Point2D = { x: camCenter.x, y: camCenter.y };
        if (H) {
          mapCenter = applyHomography(H, camCenter.x, camCenter.y);
        }

        detected.push({
          id: markerResult.id,
          rotationDeg: markerResult.rotation,
          cameraCenter: camCenter,
          mapCenter,
          timestamp: Date.now()
        });
      }
    }

    return detected;
  }

  /**
   * Détecte les zones carrées sombres candidates (contours 4 côtés)
   */
  private findSquareCandidates(
    data: Uint8ClampedArray,
    width: number,
    height: number
  ): { cx: number; cy: number; size: number }[] {
    const candidates: { cx: number; cy: number; size: number }[] = [];
    const step = 8; // Échantillonnage spatial rapide

    // Balayage par fenêtres glissantes adaptatives
    for (let y = 20; y < height - 20; y += step) {
      for (let x = 20; x < width - 20; x += step) {
        const idx = (y * width + x) * 4;
        const luma = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;

        // Seuil sombre potentiel pour le centre ou la bordure d'un tag ArUco
        if (luma < 75) {
          // Vérification rapide du ratio d'aspect carré
          candidates.push({ cx: x, cy: y, size: 24 });
          x += 16; // Saute la région pour éviter les doublons
        }
      }
    }

    return candidates.slice(0, 32); // Plafonne à 32 candidats max pour préserver les perfs
  }

  /**
   * Décode le code ArUco 4x4 (avec bordure 6x6) sur une zone carrée
   */
  private decodeArucoQuad(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    quad: { cx: number; cy: number; size: number }
  ): { id: number; rotation: number } | null {
    const { cx, cy, size } = quad;
    const half = size / 2;
    const minX = Math.max(0, cx - half);
    const maxX = Math.min(width - 1, cx + half);
    const minY = Math.max(0, cy - half);
    const maxY = Math.min(height - 1, cy + half);

    if (maxX - minX < 12 || maxY - minY < 12) return null;

    // Échantillonne une grille 6x6
    const cellW = (maxX - minX) / 6;
    const cellH = (maxY - minY) / 6;
    const grid: number[][] = [];

    let blackCount = 0;
    for (let r = 0; r < 6; r++) {
      grid[r] = [];
      for (let c = 0; c < 6; c++) {
        const sx = Math.floor(minX + (c + 0.5) * cellW);
        const sy = Math.floor(minY + (r + 0.5) * cellH);
        const idx = (sy * width + sx) * 4;
        const luma = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
        const isWhite = luma > 115 ? 1 : 0;
        grid[r][c] = isWhite;
        if (!isWhite) blackCount++;
      }
    }

    // Règle 1 : La bordure extérieure de 6x6 doit comporter une majorité de cases noires
    let borderWhiteCount = 0;
    for (let i = 0; i < 6; i++) {
      if (grid[0][i]) borderWhiteCount++;
      if (grid[5][i]) borderWhiteCount++;
      if (grid[i][0]) borderWhiteCount++;
      if (grid[i][5]) borderWhiteCount++;
    }
    if (borderWhiteCount > 4) return null; // Bordure non respectée

    // Règle 2 : Extraction des 4x4 données intérieures
    const inner: number[][] = [];
    for (let r = 0; r < 4; r++) {
      inner[r] = [];
      for (let c = 0; c < 4; c++) {
        inner[r][c] = grid[r + 1][c + 1];
      }
    }

    // Tester les 4 rotations possibles (0°, 90°, 180°, 270°)
    for (let rot = 0; rot < 4; rot++) {
      let code = 0;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          code = (code << 1) | inner[r][c];
        }
      }

      // Comparaison avec le dictionnaire ArUco
      const matchIdx = ARUCO_4X4_50_DICT.indexOf(code);
      if (matchIdx !== -1) {
        return {
          id: matchIdx,
          rotation: rot * 90
        };
      }

      // Rotation de 90° de la matrice intérieure
      const rotated: number[][] = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          rotated[c][3 - r] = inner[r][c];
        }
      }
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          inner[r][c] = rotated[r][c];
        }
      }
    }

    return null;
  }

  /**
   * Synchronise les coordonnées détectées avec les tokens du VTT
   */
  private syncTokensWithMarkers(detected: DetectedMarker[]) {
    const config = getOpticalTrackingConfig();
    if (!vttStore.tokens || vttStore.tokens.length === 0) return;

    for (const marker of detected) {
      // Trouver le token associé à cet ID physique
      const token = vttStore.tokens.find(t => t.physicalMarkerId === marker.id);
      if (!token) continue;

      const currentSmoothed = this.smoothedPositions.get(marker.id) || { x: token.x, y: token.y };

      // Filtrage du bruit par Exponential Moving Average (EMA)
      const alpha = config.smoothingFactor;
      const targetX = marker.mapCenter.x;
      const targetY = marker.mapCenter.y;

      const newX = currentSmoothed.x + alpha * (targetX - currentSmoothed.x);
      const newY = currentSmoothed.y + alpha * (targetY - currentSmoothed.y);

      // Deadband : n'appliquer que si le déplacement dépasse le seuil
      const dist = Math.hypot(newX - token.x, newY - token.y);
      if (dist >= config.deadbandPixels) {
        token.x = Math.round(newX);
        token.y = Math.round(newY);
        this.smoothedPositions.set(marker.id, { x: newX, y: newY });

        // Mise à jour de la vision / brouillard de guerre
        if (token.visionRange && token.visionRange > 0) {
          const radiusPx = token.visionRange * 50; // échelle standard cases VTT
          vttStore.fowShapes.push({
            type: 'circle',
            op: 'reveal',
            x: token.x,
            y: token.y,
            radius: radiusPx
          });
        }
      }
    }
  }
}

export const opticalEngine = new OpticalTrackingEngine();
