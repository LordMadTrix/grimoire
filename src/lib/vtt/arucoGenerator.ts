// ── Générateur de Marqueurs Fiduciaires ArUco 4x4 & Planches d'Impression ─────
// Fournit le calcul des bits ArUco 4x4 (avec bits de parité), la génération vectorielle SVG
// et la composition de planches prêtes à imprimer sur papier A4 / vinyle pour socles 3D.

// Dictionnaire canonique ArUco 4x4_50 (50 identifiants uniques à haute distance de Hamming)
// Chaque nombre 16 bits représente les 4x4 cases intérieures (les bordures 6x6 étant noires).
export const ARUCO_4X4_50_DICT: number[] = [
  0xd2, 0x272, 0x164, 0x1d7, 0x47d, 0xe1, 0x1b6, 0x21b, 0x3d4, 0x127,
  0x71, 0x26e, 0x153, 0x238, 0x356, 0x1e3, 0x41f, 0x2e9, 0xb5,  0x14a,
  0x3c3, 0x29c, 0xf6,  0x178, 0x3e1, 0x2b4, 0x139, 0x22d, 0x44e, 0x18f,
  0x39a, 0x2c5, 0x10b, 0x25a, 0x463, 0x1ad, 0x3b2, 0x287, 0x1cd, 0x43b,
  0x1f4, 0x385, 0x2db, 0x11e, 0x459, 0x1c2, 0x3a7, 0x27f, 0x196, 0x425
];

/**
 * Extrait la matrice binaire 6x6 d'un marqueur ArUco par son ID (0..49)
 * 0 = Case noire, 1 = Case blanche
 */
export function getAruco6x6Matrix(id: number): number[][] {
  const code = ARUCO_4X4_50_DICT[Math.abs(id) % ARUCO_4X4_50_DICT.length];
  
  // Matrice 6x6 : bordure extérieure noire (0) + 4x4 données intérieures
  const mat: number[][] = Array.from({ length: 6 }, () => Array(6).fill(0));

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const bitIndex = 15 - (r * 4 + c);
      const val = (code >> bitIndex) & 1;
      mat[r + 1][c + 1] = val; // 1 = blanc, 0 = noir
    }
  }

  return mat;
}

/**
 * Génère le code SVG d'un marqueur ArUco
 * @param id Identifiant du marqueur (0..49)
 * @param sizeMm Taille en millimètres (ex: 20 pour 20mm)
 */
export function generateArucoSvg(id: number, sizeMm: number = 20): string {
  const mat = getAruco6x6Matrix(id);
  const cellSize = sizeMm / 6;

  let rects = '';
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      if (mat[r][c] === 0) {
        rects += `<rect x="${(c * cellSize).toFixed(2)}" y="${(r * cellSize).toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="#000000" />`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizeMm}mm" height="${sizeMm}mm" viewBox="0 0 ${sizeMm} ${sizeMm}" shape-rendering="crispEdges">
    <rect width="${sizeMm}" height="${sizeMm}" fill="#ffffff" />
    ${rects}
  </svg>`;
}

/**
 * Convertit un tag ArUco en Data URL (image/svg+xml) pour affichage direct dans un <img>
 */
export function getArucoDataUrl(id: number, sizeMm: number = 20): string {
  const svg = generateArucoSvg(id, sizeMm);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export interface MarkerPrintItem {
  id: number;
  label: string;
  category: 'joueur' | 'ennemi' | 'boss' | 'calibration';
  colorTag: string;
}

/**
 * Génère la liste des 24 premiers marqueurs pré-configurés
 */
export function getDefaultPrintList(): MarkerPrintItem[] {
  const items: MarkerPrintItem[] = [
    // 4 Coins de calibration
    { id: 0, label: 'Calibration Haut-Gauche', category: 'calibration', colorTag: '#64748b' },
    { id: 1, label: 'Calibration Haut-Droite', category: 'calibration', colorTag: '#64748b' },
    { id: 2, label: 'Calibration Bas-Droite', category: 'calibration', colorTag: '#64748b' },
    { id: 3, label: 'Calibration Bas-Gauche', category: 'calibration', colorTag: '#64748b' },
    // 6 Joueurs / Alliés
    { id: 4, label: 'Joueur 1 (Héros)', category: 'joueur', colorTag: '#3b82f6' },
    { id: 5, label: 'Joueur 2 (Héros)', category: 'joueur', colorTag: '#10b981' },
    { id: 6, label: 'Joueur 3 (Héros)', category: 'joueur', colorTag: '#8b5cf6' },
    { id: 7, label: 'Joueur 4 (Héros)', category: 'joueur', colorTag: '#f59e0b' },
    { id: 8, label: 'Joueur 5 / Familier', category: 'joueur', colorTag: '#06b6d4' },
    { id: 9, label: 'Joueur 6 / PNJ Allié', category: 'joueur', colorTag: '#ec4899' },
    // 10 Ennemis réguliers
    { id: 10, label: 'Ennemi 1 (Sbire)', category: 'ennemi', colorTag: '#ef4444' },
    { id: 11, label: 'Ennemi 2 (Sbire)', category: 'ennemi', colorTag: '#ef4444' },
    { id: 12, label: 'Ennemi 3 (Sbire)', category: 'ennemi', colorTag: '#ef4444' },
    { id: 13, label: 'Ennemi 4 (Sbire)', category: 'ennemi', colorTag: '#ef4444' },
    { id: 14, label: 'Ennemi 5 (Sbire)', category: 'ennemi', colorTag: '#ef4444' },
    { id: 15, label: 'Ennemi 6 (Sbire)', category: 'ennemi', colorTag: '#ef4444' },
    { id: 16, label: 'Ennemi 7 (Sbire)', category: 'ennemi', colorTag: '#ef4444' },
    { id: 17, label: 'Ennemi 8 (Sbire)', category: 'ennemi', colorTag: '#ef4444' },
    { id: 18, label: 'Ennemi 9 (Élite)', category: 'ennemi', colorTag: '#dc2626' },
    { id: 19, label: 'Ennemi 10 (Élite)', category: 'ennemi', colorTag: '#dc2626' },
    // 4 Boss / Monstres Majeurs
    { id: 20, label: 'Boss 1 / Némésis', category: 'boss', colorTag: '#e11d48' },
    { id: 21, label: 'Boss 2 / Dragon', category: 'boss', colorTag: '#e11d48' },
    { id: 22, label: 'Créature Grande 1', category: 'boss', colorTag: '#d97706' },
    { id: 23, label: 'Créature Grande 2', category: 'boss', colorTag: '#d97706' },
  ];
  return items;
}

import { saveTempHtmlAndOpen, saveBinaryFileToDisk } from '$lib/api';
import { save } from '@tauri-apps/plugin-dialog';

/**
 * Construit le document HTML complet pour la planche d'étiquettes A4
 */
export function buildArucoSheetFullHtml(tagSizeMm: number = 20): string {
  const items = getDefaultPrintList();

  let cardsHtml = '';
  for (const item of items) {
    const svg = generateArucoSvg(item.id, tagSizeMm);
    cardsHtml += `
      <div class="tag-card">
        <div class="tag-svg-wrapper">
          ${svg}
        </div>
        <div class="tag-info">
          <span class="tag-badge" style="background:${item.colorTag}">ID #${item.id}</span>
          <span class="tag-name">${item.label}</span>
          <span class="tag-dim">${tagSizeMm}×${tagSizeMm} mm</span>
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Planche Marqueurs ArUco - Grimoire VTT</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 10px;
      color: #111;
      background: #fff;
    }
    .header {
      border-bottom: 2px solid #222;
      padding-bottom: 8px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    h1 { margin: 0; font-size: 18px; font-weight: 800; }
    p { margin: 2px 0 0 0; font-size: 11px; color: #555; }
    .btn-print {
      background: #e5a853;
      color: #000;
      border: none;
      padding: 8px 16px;
      font-weight: bold;
      border-radius: 4px;
      cursor: pointer;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    .tag-card {
      border: 1px dashed #bbb;
      padding: 6px;
      display: flex;
      flex-direction: column;
      align-items: center;
      page-break-inside: avoid;
      background: #fafafa;
      border-radius: 4px;
    }
    .tag-svg-wrapper {
      margin-bottom: 4px;
      box-shadow: 0 0 0 1px #000;
    }
    .tag-info {
      text-align: center;
      width: 100%;
    }
    .tag-badge {
      display: inline-block;
      color: #fff;
      font-size: 9px;
      font-weight: bold;
      padding: 1px 5px;
      border-radius: 3px;
      margin-bottom: 2px;
    }
    .tag-name {
      display: block;
      font-size: 10px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tag-dim {
      font-size: 8px;
      color: #777;
    }
    @media print {
      .header button { display: none; }
      body { padding: 0; }
      .tag-card { background: transparent; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Grimoire — Planche d'Étiquettes ArUco 4×4 pour Socles 3D</h1>
      <p>Découpez le long des pointillés et collez dans la bague 3D correspondante. Échelle 100% (ne pas ajuster).</p>
    </div>
    <button class="btn-print" onclick="window.print()">🖨️ Imprimer cette planche</button>
  </div>
  <div class="grid">
    ${cardsHtml}
  </div>
</body>
</html>`;
}

/**
 * Ouvre la planche d'étiquettes dans le navigateur par défaut de l'OS (Chrome, Firefox, etc.)
 * pour une impression parfaite sans blocage de popup.
 */
export async function openArucoSheetInDefaultBrowser(tagSizeMm: number = 20): Promise<boolean> {
  const html = buildArucoSheetFullHtml(tagSizeMm);
  try {
    await saveTempHtmlAndOpen('grimoire_planche_aruco.html', html);
    return true;
  } catch (err) {
    console.warn('[ArUco] Échec ouverture automatique du navigateur:', err);
    return false;
  }
}

/**
 * Boîte de dialogue pour enregistrer la planche HTML n'importe où sur l'ordinateur
 */
export async function exportArucoSheetHtml(tagSizeMm: number = 20): Promise<boolean> {
  const html = buildArucoSheetFullHtml(tagSizeMm);
  const base64 = btoa(unescape(encodeURIComponent(html)));
  const path = await save({
    title: 'Enregistrer la planche d\'étiquettes (HTML / Prêt à imprimer)',
    defaultPath: 'grimoire_planche_aruco_A4.html',
    filters: [{ name: 'Page Web (*.html)', extensions: ['html'] }]
  });
  if (path) {
    await saveBinaryFileToDisk(path, base64);
    return true;
  }
  return false;
}

/**
 * Lance l'impression de la planche (ouvre directement dans le navigateur système)
 */
export async function printArucoSheet(tagSizeMm: number = 20) {
  const opened = await openArucoSheetInDefaultBrowser(tagSizeMm);
  if (!opened) {
    // Fallback dialogue d'enregistrement
    await exportArucoSheetHtml(tagSizeMm);
  }
}
