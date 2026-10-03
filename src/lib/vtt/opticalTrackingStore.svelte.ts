// ── Store & Moteur de Calibration Homographique pour Tracking Optique ─────────
// Gère l'activation/désactivation du tracking, la sélection de la caméra,
// et le calcul de la matrice de perspective projective 4 points (Homographie).

export interface Point2D {
  x: number;
  y: number;
}

export interface CalibrationPair {
  cornerId: number; // 0=Top-Left, 1=Top-Right, 2=Bottom-Right, 3=Bottom-Left
  camera: Point2D;
  map: Point2D;
}

export interface OpticalTrackingConfig {
  enabled: boolean;
  selectedDeviceId: string;
  flipHorizontal: boolean;
  flipVertical: boolean;
  smoothingFactor: number; // 0.1 (très fluide/légère latence) à 0.8 (très réactif)
  deadbandPixels: number; // Seuil minimum de déplacement pour ignorer le bruit de capteur
  calibration: CalibrationPair[];
  homographyMatrix: number[] | null; // Matrice 3x3 aplatie (9 éléments)
}

const STORAGE_KEY = 'grimoire_optical_tracking_v1';

const DEFAULT_CONFIG: OpticalTrackingConfig = {
  enabled: false,
  selectedDeviceId: '',
  flipHorizontal: false,
  flipVertical: false,
  smoothingFactor: 0.35,
  deadbandPixels: 6.0,
  calibration: [],
  homographyMatrix: null
};

function loadSavedConfig(): OpticalTrackingConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_CONFIG };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('[OpticalTracking] Erreur chargement configuration:', e);
  }
  return { ...DEFAULT_CONFIG };
}

let trackingConfig = $state<OpticalTrackingConfig>(loadSavedConfig());

export function getOpticalTrackingConfig(): OpticalTrackingConfig {
  return trackingConfig;
}

export function saveOpticalTrackingConfig(updates: Partial<OpticalTrackingConfig>) {
  trackingConfig = { ...trackingConfig, ...updates };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trackingConfig));
    } catch (e) {
      console.error('[OpticalTracking] Erreur sauvegarde configuration:', e);
    }
  }
}

export function setOpticalTrackingEnabled(enabled: boolean) {
  saveOpticalTrackingConfig({ enabled });
}

/**
 * Calcule la matrice d'homographie 3x3 par Direct Linear Transformation (DLT)
 * à partir des 4 paires de points (caméra -> carte).
 */
export function computeHomography(pairs: { from: Point2D; to: Point2D }[]): number[] | null {
  if (pairs.length < 4) return null;

  // Résolution du système linéaire A * h = b pour 8 inconnues (h33 normalisé à 1)
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x, y } = pairs[i].from;
    const { x: X, y: Y } = pairs[i].to;

    // Ligne 1 : [-x, -y, -1, 0, 0, 0, x*X, y*X] * h = -X
    A.push([-x, -y, -1, 0, 0, 0, x * X, y * X]);
    b.push(-X);

    // Ligne 2 : [0, 0, 0, -x, -y, -1, x*Y, y*Y] * h = -Y
    A.push([0, 0, 0, -x, -y, -1, x * Y, y * Y]);
    b.push(-Y);
  }

  // Élimination de Gauss-Jordan 8x8
  const n = 8;
  for (let i = 0; i < n; i++) {
    // Pivot partiel
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
        maxRow = k;
      }
    }
    if (Math.abs(A[maxRow][i]) < 1e-9) return null; // Singulière

    [A[i], A[maxRow]] = [A[maxRow], A[i]];
    [b[i], b[maxRow]] = [b[maxRow], b[i]];

    // Normalisation
    const pivot = A[i][i];
    for (let j = i; j < n; j++) A[i][j] /= pivot;
    b[i] /= pivot;

    // Élimination
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = A[k][i];
        for (let j = i; j < n; j++) A[k][j] -= factor * A[i][j];
        b[k] -= factor * b[i];
      }
    }
  }

  // h33 = 1
  return [
    b[0], b[1], b[2],
    b[3], b[4], b[5],
    b[6], b[7], 1.0
  ];
}

/**
 * Applique la matrice d'homographie H pour projeter un point caméra (cx, cy)
 * dans le repère de la carte VTT (mx, my).
 */
export function applyHomography(H: number[], cx: number, cy: number): Point2D {
  const z = H[6] * cx + H[7] * cy + H[8];
  if (Math.abs(z) < 1e-6) return { x: cx, y: cy };
  const x = (H[0] * cx + H[1] * cy + H[2]) / z;
  const y = (H[3] * cx + H[4] * cy + H[5]) / z;
  return { x, y };
}
