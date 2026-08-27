// ── Multi-Column & Boxed-Text Layout Analyzer pour PDF de JDR ─────────────────
// Détecte et désentrelace les colonnes multiples (1, 2 ou 3 colonnes)
// même lorsque l'OCR ou le générateur PDF a fusionné les lignes horizontalement.

export interface PdfTextItem {
  str: string;
  transform: number[]; // [scaleX, skewY, skewX, scaleY, x, y]
  width: number;
  height: number;
  dir?: string;
}

export interface SpatialTextItem {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
  right: number;
  top: number;
}

/**
 * Décompose les lignes d'un PDF en éléments spatiaux individuels
 * (gère les lignes uniques qui traversent plusieurs colonnes avec des espaces).
 */
function decomposePdfItem(it: PdfTextItem, pageWidth: number): SpatialTextItem[] {
  if (!it || typeof it.str !== 'string' || it.str.trim().length === 0) {
    return [];
  }

  const rawStr = it.str;
  const baseX = it.transform ? it.transform[4] : 0;
  const baseY = it.transform ? it.transform[5] : 0;
  const baseW = it.width || 10;
  const baseH = it.height || (it.transform ? Math.abs(it.transform[3]) : 10);

  // 1. Si la chaîne contient de multiples espaces (gap d'espacement de colonnes >= 2 espaces)
  const gapRegex = /\s{2,}|\t/g;
  if (gapRegex.test(rawStr)) {
    const parts: SpatialTextItem[] = [];
    const tokens = rawStr.split(/\s{2,}|\t/).filter(t => t.trim().length > 0);
    
    let curIndex = 0;
    for (const token of tokens) {
      const tokenPos = rawStr.indexOf(token, curIndex);
      const ratio = rawStr.length > 0 ? tokenPos / rawStr.length : 0;
      const widthRatio = rawStr.length > 0 ? token.length / rawStr.length : 1;
      
      const tokenX = baseX + ratio * baseW;
      const tokenW = Math.max(10, widthRatio * baseW);
      
      parts.push({
        str: token.trim(),
        x: tokenX,
        y: baseY,
        w: tokenW,
        h: baseH,
        right: tokenX + tokenW,
        top: baseY + baseH
      });
      curIndex = tokenPos + token.length;
    }
    if (parts.length > 0) return parts;
  }

  // 2. Si l'élément est large (> 45% de la page) et contient des mots séparés,
  // vérifier si c'est une ligne fusionnée à travers 2 ou 3 colonnes
  if (baseW > pageWidth * 0.45 && rawStr.includes(' ')) {
    const words = rawStr.split(/\s+/).filter(w => w.length > 0);
    if (words.length >= 4) {
      // Découper en 3 tiers ou 2 moitiés selon la largeur
      const isLikely3Cols = baseW > pageWidth * 0.65;
      const numSegments = isLikely3Cols ? 3 : 2;
      const wordsPerSeg = Math.ceil(words.length / numSegments);
      
      const parts: SpatialTextItem[] = [];
      for (let i = 0; i < numSegments; i++) {
        const segWords = words.slice(i * wordsPerSeg, (i + 1) * wordsPerSeg);
        if (segWords.length === 0) continue;
        const segStr = segWords.join(' ');
        const segX = baseX + (i / numSegments) * baseW;
        const segW = baseW / numSegments;
        
        parts.push({
          str: segStr,
          x: segX,
          y: baseY,
          w: segW,
          h: baseH,
          right: segX + segW,
          top: baseY + baseH
        });
      }
      return parts;
    }
  }

  return [{
    str: rawStr.trim(),
    x: baseX,
    y: baseY,
    w: baseW,
    h: baseH,
    right: baseX + baseW,
    top: baseY + baseH
  }];
}

/**
 * Analyse géométrique des éléments textuels PDF.js et reconstitution de l'ordre
 * de lecture logique (Titre -> Colonne 1 -> Colonne 2 -> Colonne 3).
 */
export function extractOrderedTextFromPdfItems(items: PdfTextItem[]): string {
  if (!items || items.length === 0) return '';

  // Estimation préalable de la largeur de page
  const xs = items.map(it => it.transform ? it.transform[4] : 0).filter(x => x > 0);
  const rights = items.map(it => (it.transform ? it.transform[4] : 0) + (it.width || 0)).filter(x => x > 0);
  const minPageX = xs.length ? Math.min(...xs) : 0;
  const maxPageX = rights.length ? Math.max(...rights) : 600;
  const approxPageWidth = maxPageX - minPageX || 600;

  // 1. Décomposer tous les éléments (désentrelacement des colonnes fusionnées)
  const validItems: SpatialTextItem[] = [];
  for (const it of items) {
    const subItems = decomposePdfItem(it, approxPageWidth);
    for (const sub of subItems) {
      if (sub.str.length > 0) {
        validItems.push(sub);
      }
    }
  }

  if (validItems.length === 0) return '';

  // 2. Déterminer les dimensions réelles de la page
  const minX = Math.min(...validItems.map(i => i.x));
  const maxX = Math.max(...validItems.map(i => i.right));
  const maxY = Math.max(...validItems.map(i => i.y));
  const minY = Math.min(...validItems.map(i => i.y));
  const pageWidth = maxX - minX || 600;
  const pageHeight = maxY - minY || 800;

  // 3. Détecter les grands titres / en-têtes pleine page (12% supérieurs)
  const topThreshold = maxY - pageHeight * 0.12;
  const headers: SpatialTextItem[] = [];
  const bodyItems: SpatialTextItem[] = [];

  for (const item of validItems) {
    if (item.y >= topThreshold && (item.w > pageWidth * 0.35 || (item.x > minX + pageWidth * 0.2 && item.x < minX + pageWidth * 0.8))) {
      headers.push(item);
    } else {
      bodyItems.push(item);
    }
  }

  // 4. Détecter le partitionnement des colonnes
  // Dans les livres de JDR (Dragonlance, AD&D, D&D 5e) :
  // Col 1 : 0% -> 34%
  // Col 2 : 33% -> 67%
  // Col 3 : 66% -> 100%
  const col1Boundary = minX + pageWidth * 0.34;
  const col2Boundary = minX + pageWidth * 0.67;

  const col1Items: SpatialTextItem[] = [];
  const col2Items: SpatialTextItem[] = [];
  const col3Items: SpatialTextItem[] = [];

  // Détecter s'il y a 3 colonnes réelles
  const countCol1 = bodyItems.filter(i => i.x < col1Boundary).length;
  const countCol2 = bodyItems.filter(i => i.x >= col1Boundary && i.x < col2Boundary).length;
  const countCol3 = bodyItems.filter(i => i.x >= col2Boundary).length;

  const is3Columns = countCol1 > 3 && countCol2 > 3 && countCol3 > 3;
  const is2Columns = !is3Columns && countCol1 > 3 && (countCol2 > 3 || countCol3 > 3);

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

  // 5. Fonction pour trier et assembler les lignes d'une colonne (Haut vers Bas)
  function sortAndAssembleColumn(columnItems: SpatialTextItem[]): string {
    if (columnItems.length === 0) return '';

    // Grouper en lignes selon Y (tolérance de 5px)
    const lines: { y: number; items: SpatialTextItem[] }[] = [];
    const sortedByY = [...columnItems].sort((a, b) => b.y - a.y);

    for (const item of sortedByY) {
      const existingLine = lines.find(l => Math.abs(l.y - item.y) <= 6);
      if (existingLine) {
        existingLine.items.push(item);
      } else {
        lines.push({ y: item.y, items: [item] });
      }
    }

    // Dans chaque ligne, ordonner de gauche à droite
    const assembledLines: string[] = [];
    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x);
      const lineStr = line.items.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
      if (lineStr) {
        assembledLines.push(lineStr);
      }
    }

    // Réparer les césures de coupure de mot ("personna-" + "ges" -> "personnages")
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

  // 6. Assemblage final séquentiel
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
 * Extrait le texte contenu dans une zone sélectionnée à la souris par le MJ
 */
export function extractTextFromSelectionRect(
  items: PdfTextItem[],
  rect: { x: number; y: number; width: number; height: number },
  viewportScale: number,
  viewportHeight: number
): string {
  if (!items || items.length === 0) return '';

  const xs = items.map(it => it.transform ? it.transform[4] : 0).filter(x => x > 0);
  const rights = items.map(it => (it.transform ? it.transform[4] : 0) + (it.width || 0)).filter(x => x > 0);
  const minPageX = xs.length ? Math.min(...xs) : 0;
  const maxPageX = rights.length ? Math.max(...rights) : 600;
  const approxPageWidth = maxPageX - minPageX || 600;

  // Décomposer les éléments
  const validItems: SpatialTextItem[] = [];
  for (const it of items) {
    const subItems = decomposePdfItem(it, approxPageWidth);
    for (const sub of subItems) {
      if (sub.str.length > 0) validItems.push(sub);
    }
  }

  const selMinX = rect.x / viewportScale;
  const selMaxX = (rect.x + rect.width) / viewportScale;
  const selTopInPdf = (viewportHeight - rect.y) / viewportScale;
  const selBottomInPdf = (viewportHeight - (rect.y + rect.height)) / viewportScale;

  const selectedItems = validItems.filter(it => {
    return it.x >= selMinX - 15 && it.x <= selMaxX + 15 && it.y >= selBottomInPdf - 15 && it.y <= selTopInPdf + 15;
  });

  if (selectedItems.length === 0) return '';

  // Grouper et ordonner les lignes sélectionnées
  const lines: { y: number; items: SpatialTextItem[] }[] = [];
  const sortedByY = [...selectedItems].sort((a, b) => b.y - a.y);

  for (const item of sortedByY) {
    const existingLine = lines.find(l => Math.abs(l.y - item.y) <= 6);
    if (existingLine) {
      existingLine.items.push(item);
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }

  const assembledLines: string[] = [];
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    const lineStr = line.items.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
    if (lineStr) assembledLines.push(lineStr);
  }

  let result = '';
  for (const l of assembledLines) {
    if (l.endsWith('-') || l.endsWith('—')) result += l.slice(0, -1);
    else result += l + ' ';
  }

  return result.trim();
}
