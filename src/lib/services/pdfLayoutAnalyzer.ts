// ── Multi-Column & Boxed-Text Layout Analyzer pour PDF de JDR ─────────────────
// Reconstitue l'ordre de lecture naturel pour les livres de jeu de rôle
// à 2 ou 3 colonnes (AD&D, D&D 5e, Pathfinder, Warhammer) en évitant
// que le texte soit lu horizontalement à travers les colonnes.

export interface PdfTextItem {
  str: string;
  transform: number[]; // [scaleX, skewY, skewX, scaleY, x, y]
  width: number;
  height: number;
  dir?: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
}

/**
 * Analyse géométrique des éléments textuels PDF.js et reconstitution de l'ordre
 * de lecture logique (Haut de page -> Colonne 1 -> Colonne 2 -> Colonne 3 -> Bas de page).
 */
export function extractOrderedTextFromPdfItems(items: PdfTextItem[]): string {
  if (!items || items.length === 0) return '';

  // 1. Filtrer les éléments valides et calculer les boîtes englobantes
  const validItems = items
    .filter(it => it && typeof it.str === 'string' && it.str.length > 0)
    .map(it => {
      const x = it.transform ? it.transform[4] : 0;
      const y = it.transform ? it.transform[5] : 0; // Dans PDF.js, y grand = haut de page
      const h = it.height || (it.transform ? Math.abs(it.transform[3]) : 10);
      const w = it.width || 10;
      return {
        str: it.str,
        x,
        y,
        w,
        h,
        right: x + w,
        top: y + h
      };
    });

  if (validItems.length === 0) return '';

  // 2. Déterminer les dimensions globales de la page
  const minX = Math.min(...validItems.map(i => i.x));
  const maxX = Math.max(...validItems.map(i => i.right));
  const maxY = Math.max(...validItems.map(i => i.y));
  const minY = Math.min(...validItems.map(i => i.y));
  const pageWidth = maxX - minX || 600;
  const pageHeight = maxY - minY || 800;

  // 3. Détecter les en-têtes et titres principaux pleine largeur (ex: "Chapitre 1 : Évènements")
  // Un titre pleine largeur est situé dans les 15% supérieurs et a une largeur > 35% de la page
  const topThreshold = maxY - pageHeight * 0.15;
  const headers: typeof validItems = [];
  const bodyItems: typeof validItems = [];

  for (const item of validItems) {
    // Si l'élément est en haut de page et large ou centré
    if (item.y >= topThreshold && (item.w > pageWidth * 0.35 || item.x > minX + pageWidth * 0.25 && item.x < minX + pageWidth * 0.75)) {
      headers.push(item);
    } else {
      bodyItems.push(item);
    }
  }

  // 4. Détecter automatiquement le nombre de colonnes (1, 2 ou 3 colonnes)
  // Analyse de l'histogramme des positions horizontales X
  const xCenters = bodyItems.map(i => i.x);
  const col1Items: typeof validItems = [];
  const col2Items: typeof validItems = [];
  const col3Items: typeof validItems = [];

  // Déterminer les séparateurs de colonnes
  // Dans un format 3 colonnes (comme AD&D Dragonlance) :
  // Col 1 : 0% - 34% de la largeur
  // Col 2 : 33% - 67% de la largeur
  // Col 3 : 66% - 100% de la largeur
  const col1Boundary = minX + pageWidth * 0.34;
  const col2Boundary = minX + pageWidth * 0.67;

  // Tester s'il y a des éléments dans les 3 tiers
  const hasCol1 = bodyItems.some(i => i.x < col1Boundary);
  const hasCol2 = bodyItems.some(i => i.x >= col1Boundary && i.x < col2Boundary);
  const hasCol3 = bodyItems.some(i => i.x >= col2Boundary);

  const is3Columns = hasCol1 && hasCol2 && hasCol3;
  const is2Columns = !is3Columns && hasCol1 && (hasCol2 || hasCol3);

  for (const item of bodyItems) {
    if (is3Columns) {
      if (item.x < col1Boundary) {
        col1Items.push(item);
      } else if (item.x < col2Boundary) {
        col2Items.push(item);
      } else {
        col3Items.push(item);
      }
    } else if (is2Columns) {
      const midBoundary = minX + pageWidth * 0.5;
      if (item.x < midBoundary) {
        col1Items.push(item);
      } else {
        col2Items.push(item);
      }
    } else {
      col1Items.push(item);
    }
  }

  // 5. Fonction pour trier et assembler les éléments d'une colonne (Haut vers Bas, Gauche vers Droite)
  function sortAndAssembleColumn(columnItems: typeof validItems): string {
    if (columnItems.length === 0) return '';

    // Grouper les éléments en lignes selon leur coordonnée Y (avec tolérance de 5px)
    // Note: Dans PDF.js, Y est inversé (les grands Y sont en haut)
    const lines: { y: number; items: typeof validItems }[] = [];

    // Trier d'abord par Y décroissant (du haut vers le bas)
    const sortedByY = [...columnItems].sort((a, b) => b.y - a.y);

    for (const item of sortedByY) {
      const existingLine = lines.find(l => Math.abs(l.y - item.y) <= 6);
      if (existingLine) {
        existingLine.items.push(item);
      } else {
        lines.push({ y: item.y, items: [item] });
      }
    }

    // Pour chaque ligne, trier les mots de gauche à droite (X croissant)
    const assembledLines: string[] = [];
    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x);
      const lineStr = line.items.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
      if (lineStr) {
        assembledLines.push(lineStr);
      }
    }

    // Réparer les césures de fin de ligne (ex: "terri-" + "ble" -> "terrible")
    let columnText = '';
    for (let i = 0; i < assembledLines.length; i++) {
      const current = assembledLines[i];
      if (current.endsWith('-') || current.endsWith('—')) {
        columnText += current.slice(0, -1);
      } else {
        columnText += current + ' ';
      }
    }

    return columnText.trim();
  }

  // 6. Assembler le document complet dans le vrai ordre de lecture
  const headerText = sortAndAssembleColumn(headers);
  const col1Text = sortAndAssembleColumn(col1Items);
  const col2Text = sortAndAssembleColumn(col2Items);
  const col3Text = sortAndAssembleColumn(col3Items);

  const sections: string[] = [];
  if (headerText) sections.push(headerText);
  if (col1Text) sections.push(col1Text);
  if (col2Text) sections.push(col2Text);
  if (col3Text) sections.push(col3Text);

  return sections.join('\n\n');
}

/**
 * Extrait le texte contenu à l'intérieur d'un rectangle de sélection sélectionné à la souris par le MJ
 */
export function extractTextFromSelectionRect(
  items: PdfTextItem[],
  rect: { x: number; y: number; width: number; height: number },
  viewportScale: number,
  viewportHeight: number
): string {
  if (!items || items.length === 0) return '';

  // Conversion des coordonnées du canvas en coordonnées de l'espace PDF
  const selMinX = rect.x / viewportScale;
  const selMaxX = (rect.x + rect.width) / viewportScale;
  // Dans le canvas Y=0 est en haut, dans PDF Y=0 est en bas
  const selTopInPdf = (viewportHeight - rect.y) / viewportScale;
  const selBottomInPdf = (viewportHeight - (rect.y + rect.height)) / viewportScale;

  const selectedItems = items.filter(it => {
    const x = it.transform ? it.transform[4] : 0;
    const y = it.transform ? it.transform[5] : 0;
    return x >= selMinX - 10 && x <= selMaxX + 10 && y >= selBottomInPdf - 10 && y <= selTopInPdf + 10;
  });

  return extractOrderedTextFromPdfItems(selectedItems);
}
