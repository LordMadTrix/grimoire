// ── Générateur STL Binaire pour Socles et Équerres d'ArUco 3D ────────────────
// Produit des fichiers STL binaires conformes, étanches (watertight) et directement
// prêts pour l'impression 3D (Cura, Bambu Studio, PrusaSlicer, OrcaSlicer).

class BinaryStlWriter {
  private triangles: number[][] = []; // [nx, ny, nz, v1x, v1y, v1z, v2x, v2y, v2z, v3x, v3y, v3z]

  addTriangle(
    v1: [number, number, number],
    v2: [number, number, number],
    v3: [number, number, number],
    normal?: [number, number, number]
  ) {
    let n = normal;
    if (!n) {
      // Calcul du vecteur normal par produit vectoriel
      const ax = v2[0] - v1[0], ay = v2[1] - v1[1], az = v2[2] - v1[2];
      const bx = v3[0] - v1[0], by = v3[1] - v1[1], bz = v3[2] - v1[2];
      let nx = ay * bz - az * by;
      let ny = az * bx - ax * bz;
      let nz = ax * by - ay * bx;
      const len = Math.hypot(nx, ny, nz);
      if (len > 1e-6) {
        n = [nx / len, ny / len, nz / len];
      } else {
        n = [0, 0, 1];
      }
    }
    this.triangles.push([...n, ...v1, ...v2, ...v3]);
  }

  addQuad(
    v1: [number, number, number],
    v2: [number, number, number],
    v3: [number, number, number],
    v4: [number, number, number]
  ) {
    this.addTriangle(v1, v2, v3);
    this.addTriangle(v1, v3, v4);
  }

  buildBlob(headerText: string = 'Grimoire Tabletop 3D Collar'): Blob {
    const numTriangles = this.triangles.length;
    const bufferSize = 80 + 4 + numTriangles * 50;
    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);

    // 1. Header (80 octets ASCII)
    const encoder = new TextEncoder();
    const headerBytes = encoder.encode(headerText.padEnd(80, ' ').slice(0, 80));
    for (let i = 0; i < 80; i++) {
      view.setUint8(i, headerBytes[i]);
    }

    // 2. Nombre de triangles (uint32 little endian)
    view.setUint32(80, numTriangles, true);

    // 3. Triangles (50 octets par triangle)
    let offset = 84;
    for (const tri of this.triangles) {
      // Normale (3x float32)
      view.setFloat32(offset, tri[0], true);
      view.setFloat32(offset + 4, tri[1], true);
      view.setFloat32(offset + 8, tri[2], true);
      // Vertex 1 (3x float32)
      view.setFloat32(offset + 12, tri[3], true);
      view.setFloat32(offset + 16, tri[4], true);
      view.setFloat32(offset + 20, tri[5], true);
      // Vertex 2 (3x float32)
      view.setFloat32(offset + 24, tri[6], true);
      view.setFloat32(offset + 28, tri[7], true);
      view.setFloat32(offset + 32, tri[8], true);
      // Vertex 3 (3x float32)
      view.setFloat32(offset + 36, tri[9], true);
      view.setFloat32(offset + 40, tri[10], true);
      view.setFloat32(offset + 44, tri[11], true);
      // Attribute byte count (uint16)
      view.setUint16(offset + 48, 0, true);

      offset += 50;
    }

    return new Blob([buffer], { type: 'model/stl' });
  }
}

/**
 * Génère un anneau adaptateur de socle (Ring Collar) avec gorge pour étiquette ArUco
 * @param innerDiameterMm Diamètre interne (ex: 25.4mm pour 1 pouce, 28.5mm, 32.5mm, 50.8mm)
 * @param outerDiameterMm Diamètre externe accueillant la bague ArUco
 * @param heightMm Hauteur totale du socle (ex: 3.5mm)
 * @param recessMm Profondeur de l'empreinte pour l'étiquette (ex: 0.8mm)
 */
export function generateCollarStl(
  innerDiameterMm: number,
  outerDiameterMm: number,
  heightMm: number = 3.5,
  recessMm: number = 0.8
): Blob {
  const writer = new BinaryStlWriter();
  const segments = 48; // Précision circulaire pour imprimantes FDM/Résine

  const rIn = innerDiameterMm / 2;
  const rOut = outerDiameterMm / 2;
  const rMid = rIn + (rOut - rIn) * 0.35; // Lèvre intérieure de retenue
  const zBottom = 0;
  const zRecess = heightMm - recessMm;
  const zTop = heightMm;

  for (let i = 0; i < segments; i++) {
    const a1 = (i / segments) * Math.PI * 2;
    const a2 = ((i + 1) / segments) * Math.PI * 2;

    const cos1 = Math.cos(a1), sin1 = Math.sin(a1);
    const cos2 = Math.cos(a2), sin2 = Math.sin(a2);

    // Points au sol (z = 0)
    const bIn1: [number, number, number] = [rIn * cos1, rIn * sin1, zBottom];
    const bIn2: [number, number, number] = [rIn * cos2, rIn * sin2, zBottom];
    const bOut1: [number, number, number] = [rOut * cos1, rOut * sin1, zBottom];
    const bOut2: [number, number, number] = [rOut * cos2, rOut * sin2, zBottom];

    // 1. Fond plat (z = 0, orienté vers le bas)
    writer.addQuad(bIn2, bIn1, bOut1, bOut2);

    // 2. Paroi intérieure verticale (r = rIn, z = 0 -> zTop)
    const tIn1: [number, number, number] = [rIn * cos1, rIn * sin1, zTop];
    const tIn2: [number, number, number] = [rIn * cos2, rIn * sin2, zTop];
    writer.addQuad(bIn1, bIn2, tIn2, tIn1);

    // 3. Paroi extérieure verticale (r = rOut, z = 0 -> zRecess)
    const tOut1: [number, number, number] = [rOut * cos1, rOut * sin1, zRecess];
    const tOut2: [number, number, number] = [rOut * cos2, rOut * sin2, zRecess];
    writer.addQuad(bOut2, bOut1, tOut1, tOut2);

    // 4. Paroi verticale du gradin de recess (r = rMid, z = zRecess -> zTop)
    const rStep1: [number, number, number] = [rMid * cos1, rMid * sin1, zRecess];
    const rStep2: [number, number, number] = [rMid * cos2, rMid * sin2, zRecess];
    const tMid1: [number, number, number] = [rMid * cos1, rMid * sin1, zTop];
    const tMid2: [number, number, number] = [rMid * cos2, rMid * sin2, zTop];
    writer.addQuad(rStep2, rStep1, tMid1, tMid2);

    // 5. Gorge horizontale pour l'étiquette ArUco (z = zRecess, r = rMid -> rOut)
    writer.addQuad(rStep1, rStep2, tOut2, tOut1);

    // 6. Rebord supérieur intérieur (z = zTop, r = rIn -> rMid)
    writer.addQuad(tIn1, tIn2, tMid2, tMid1);
  }

  return writer.buildBlob(`Grimoire Ring Collar ${innerDiameterMm}mm`);
}

/**
 * Génère une équerre de calibration d'angle L-Bracket pour calibrer la table
 */
export function generateCalibrationCornerStl(): Blob {
  const writer = new BinaryStlWriter();

  // Équerre 40x40mm, épaisseur 3mm avec logement 20x20mm pour tag ArUco 0..3
  const L = 40, W = 10, H = 3.0, pocketDepth = 0.8;
  const pocketSize = 20;

  // Boîte principale L
  function box(x1: number, y1: number, x2: number, y2: number, z1: number, z2: number) {
    const p1: [number, number, number] = [x1, y1, z1];
    const p2: [number, number, number] = [x2, y1, z1];
    const p3: [number, number, number] = [x2, y2, z1];
    const p4: [number, number, number] = [x1, y2, z1];
    const p5: [number, number, number] = [x1, y1, z2];
    const p6: [number, number, number] = [x2, y1, z2];
    const p7: [number, number, number] = [x2, y2, z2];
    const p8: [number, number, number] = [x1, y2, z2];

    // Bottom
    writer.addQuad(p2, p1, p4, p3);
    // Top
    writer.addQuad(p5, p6, p7, p8);
    // Front
    writer.addQuad(p1, p2, p6, p5);
    // Back
    writer.addQuad(p3, p4, p8, p7);
    // Left
    writer.addQuad(p4, p1, p5, p8);
    // Right
    writer.addQuad(p2, p3, p7, p6);
  }

  // Bras X : de 0 à L, largeur W
  box(0, 0, L, W, 0, H);
  // Bras Y : de W à L, largeur W
  box(0, W, W, L, 0, H);

  // Plaque de fond du logement de tag à l'angle (0 à pocketSize, 0 à pocketSize)
  box(0, 0, pocketSize, pocketSize, 0, H - pocketDepth);

  return writer.buildBlob('Grimoire Calibration L-Corner');
}

/**
 * Génère un gabarit physique de Sort en Cône 60° (15ft / 30ft) avec logement ArUco
 */
export function generateConeSpellTemplateStl(lengthMm: number = 75, angleDeg: number = 60): Blob {
  const writer = new BinaryStlWriter();
  const H = 3.0; // 3mm hauteur
  const halfAngle = ((angleDeg / 2) * Math.PI) / 180;
  const spreadY = Math.tan(halfAngle) * lengthMm;

  // Triangle principal
  const pApexBottom: [number, number, number] = [0, 0, 0];
  const pRightBottom: [number, number, number] = [lengthMm, spreadY, 0];
  const pLeftBottom: [number, number, number] = [lengthMm, -spreadY, 0];

  const pApexTop: [number, number, number] = [0, 0, H];
  const pRightTop: [number, number, number] = [lengthMm, spreadY, H];
  const pLeftTop: [number, number, number] = [lengthMm, -spreadY, H];

  // Face inférieure
  writer.addTriangle(pApexBottom, pLeftBottom, pRightBottom);
  // Face supérieure
  writer.addTriangle(pApexTop, pRightTop, pLeftTop);
  // Côté gauche
  writer.addQuad(pApexBottom, pApexTop, pLeftTop, pLeftBottom);
  // Côté droit
  writer.addQuad(pApexBottom, pRightBottom, pRightTop, pApexTop);
  // Face avant
  writer.addQuad(pLeftBottom, pLeftTop, pRightTop, pRightBottom);

  return writer.buildBlob('Grimoire Cone Spell Template');
}

/**
 * Génère un gabarit physique de Sphère / Boule de Feu (20ft) avec logement ArUco
 */
export function generateCircleSpellTemplateStl(radiusMm: number = 50): Blob {
  const writer = new BinaryStlWriter();
  const segments = 48;
  const H = 3.0;
  const rimWidth = 6.0;
  const innerR = radiusMm - rimWidth;

  // Anneau extérieur fin
  for (let i = 0; i < segments; i++) {
    const theta1 = (i / segments) * Math.PI * 2;
    const theta2 = ((i + 1) / segments) * Math.PI * 2;

    const cos1 = Math.cos(theta1), sin1 = Math.sin(theta1);
    const cos2 = Math.cos(theta2), sin2 = Math.sin(theta2);

    const ro1: [number, number, number] = [radiusMm * cos1, radiusMm * sin1, 0];
    const ro2: [number, number, number] = [radiusMm * cos2, radiusMm * sin2, 0];
    const ri1: [number, number, number] = [innerR * cos1, innerR * sin1, 0];
    const ri2: [number, number, number] = [innerR * cos2, innerR * sin2, 0];

    const tro1: [number, number, number] = [radiusMm * cos1, radiusMm * sin1, H];
    const tro2: [number, number, number] = [radiusMm * cos2, radiusMm * sin2, H];
    const tri1: [number, number, number] = [innerR * cos1, innerR * sin1, H];
    const tri2: [number, number, number] = [innerR * cos2, innerR * sin2, H];

    // Dessous & Dessus
    writer.addQuad(ro1, ri1, ri2, ro2);
    writer.addQuad(tro1, tro2, tri2, tri1);
    // Paroi extérieure
    writer.addQuad(ro1, ro2, tro2, tro1);
    // Paroi intérieure
    writer.addQuad(ri1, tri1, tri2, ri2);
  }

  // Barre centrale pour le logement de tag
  const barW = 18;
  const p1: [number, number, number] = [-innerR, -barW / 2, 0];
  const p2: [number, number, number] = [innerR, -barW / 2, 0];
  const p3: [number, number, number] = [innerR, barW / 2, 0];
  const p4: [number, number, number] = [-innerR, barW / 2, 0];
  const tp1: [number, number, number] = [-innerR, -barW / 2, H];
  const tp2: [number, number, number] = [innerR, -barW / 2, H];
  const tp3: [number, number, number] = [innerR, barW / 2, H];
  const tp4: [number, number, number] = [-innerR, barW / 2, H];

  writer.addQuad(p1, p4, p3, p2);
  writer.addQuad(tp1, tp2, tp3, tp4);
  writer.addQuad(p1, p2, tp2, tp1);
  writer.addQuad(p3, p4, tp4, tp3);

  return writer.buildBlob('Grimoire Sphere Spell Template');
}

/**
 * Génère un gabarit physique de Ligne d'Éclair 30ft
 */
export function generateLineSpellTemplateStl(lengthMm: number = 150, widthMm: number = 25): Blob {
  const writer = new BinaryStlWriter();
  const H = 3.0;
  const halfW = widthMm / 2;

  const p1: [number, number, number] = [0, -halfW, 0];
  const p2: [number, number, number] = [lengthMm, -halfW, 0];
  const p3: [number, number, number] = [lengthMm, halfW, 0];
  const p4: [number, number, number] = [0, halfW, 0];

  const tp1: [number, number, number] = [0, -halfW, H];
  const tp2: [number, number, number] = [lengthMm, -halfW, H];
  const tp3: [number, number, number] = [lengthMm, halfW, H];
  const tp4: [number, number, number] = [0, halfW, H];

  writer.addQuad(p1, p4, p3, p2);
  writer.addQuad(tp1, tp2, tp3, tp4);
  writer.addQuad(p1, p2, tp2, tp1);
  writer.addQuad(p2, p3, tp3, tp2);
  writer.addQuad(p3, p4, tp4, tp3);
  writer.addQuad(p4, p1, tp1, tp4);

  return writer.buildBlob('Grimoire Line Spell Template');
}

import { save, open } from '@tauri-apps/plugin-dialog';
import { saveBinaryFileToDisk } from '$lib/api';

/**
 * Déclenche l'enregistrement du fichier STL via la boîte de dialogue native du système
 */
export async function triggerStlDownload(filename: string, blob: Blob): Promise<boolean> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Content = btoa(binary);

    const selectedPath = await save({
      title: 'Enregistrer le fichier STL pour impression 3D',
      defaultPath: filename,
      filters: [
        { name: 'Modèle 3D STL (*.stl)', extensions: ['stl'] }
      ]
    });

    if (selectedPath) {
      await saveBinaryFileToDisk(selectedPath, base64Content);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[STL] Échec du dialogue natif, tentative par lien de téléchargement standard:', err);
    // Fallback navigateur classique
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }
}

/**
 * Enregistre tous les fichiers STL dans un dossier choisi par l'utilisateur
 */
export async function downloadAllStlPack(): Promise<number> {
  try {
    const targetDir = await open({
      title: 'Choisir le dossier de destination pour tous les fichiers STL',
      directory: true,
      multiple: false
    });

    if (!targetDir || typeof targetDir !== 'string') return 0;

    let count = 0;
    for (const preset of STL_PRESETS) {
      const blob = preset.generate();
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Content = btoa(binary);

      const sep = targetDir.includes('\\') ? '\\' : '/';
      const filePath = targetDir.endsWith(sep) ? `${targetDir}${preset.filename}` : `${targetDir}${sep}${preset.filename}`;

      await saveBinaryFileToDisk(filePath, base64Content);
      count++;
    }
    return count;
  } catch (e) {
    console.error('[STL] Erreur téléchargement pack:', e);
    return 0;
  }
}

export interface StlPreset {
  id: string;
  name: string;
  desc: string;
  badge: string;
  filename: string;
  generate: () => Blob;
}

export const STL_PRESETS: StlPreset[] = [
  {
    id: 'collar_25mm',
    name: 'Bague 25 mm (1 pouce)',
    desc: 'Socle D&D standard, Pathfinder, aventuriers et infanterie moyenne.',
    badge: 'Standard PJ/PNJ',
    filename: 'grimoire_socle_25mm_aruco.stl',
    generate: () => generateCollarStl(25.4, 34.0, 3.5, 0.8)
  },
  {
    id: 'collar_28mm',
    name: 'Bague 28.5 mm (Wargame)',
    desc: 'Format héroïque 28 mm, créatures d\'élite et figurines historiques.',
    badge: 'Wargame',
    filename: 'grimoire_socle_28mm_aruco.stl',
    generate: () => generateCollarStl(28.5, 37.0, 3.5, 0.8)
  },
  {
    id: 'collar_32mm',
    name: 'Bague 32.5 mm (Large PJ)',
    desc: 'Grandes créatures moyennes, armures lourdes, Space Marines, boss de taille moyenne.',
    badge: 'Infanterie lourde',
    filename: 'grimoire_socle_32mm_aruco.stl',
    generate: () => generateCollarStl(32.5, 41.5, 3.5, 0.8)
  },
  {
    id: 'collar_50mm',
    name: 'Bague 50.8 mm (2 pouces)',
    desc: 'Grandes créatures (Large / Grand gabarit) : chevaux, ogres, trolls, jeunes dragons.',
    badge: 'Grande créature',
    filename: 'grimoire_socle_50mm_aruco.stl',
    generate: () => generateCollarStl(50.8, 61.0, 4.0, 0.8)
  },
  {
    id: 'corner_bracket',
    name: 'Équerre de calibration d\'angle',
    desc: 'À poser aux 4 coins de la table projetée pour auto-calibrer la webcam en 1 seconde.',
    badge: 'Calibration Caméra',
    filename: 'grimoire_equerre_calibration.stl',
    generate: () => generateCalibrationCornerStl()
  },
  {
    id: 'spell_cone',
    name: 'Gabarit de Sort : Cône de Souffle (15/30 ft)',
    desc: 'Cône triangulaire 60° avec logement pour tag ArUco #40. Posez-le sur la table pour projeter les flammes ou le souffle en direct !',
    badge: 'Sort Tag #40',
    filename: 'grimoire_gabarit_cone_souffle.stl',
    generate: () => generateConeSpellTemplateStl(75, 60)
  },
  {
    id: 'spell_sphere',
    name: 'Gabarit de Sort : Boule de Feu / Sphère (20 ft)',
    desc: 'Anneau de rayon 50mm avec logement central pour tag ArUco #41. Déclenche l\'animation d\'explosion sphérique en temps réel.',
    badge: 'Sort Tag #41',
    filename: 'grimoire_gabarit_boule_de_feu.stl',
    generate: () => generateCircleSpellTemplateStl(50)
  },
  {
    id: 'spell_line',
    name: 'Gabarit de Sort : Ligne d\'Éclair (30 ft)',
    desc: 'Règle tactique 150mm graduée avec logement pour tag ArUco #42. Projette la foudre linéaire dans la direction exacte du gabarit.',
    badge: 'Sort Tag #42',
    filename: 'grimoire_gabarit_ligne_eclair.stl',
    generate: () => generateLineSpellTemplateStl(150, 25)
  }
];
