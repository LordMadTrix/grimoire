import type { TokenDesignData, TokenShape, TokenMetal } from '../types/tokenEditor';

/**
 * Retourne la définition SVG des dégradés selon le métal sélectionné
 */
export function getMetalGradients(metal: TokenMetal): string {
  switch (metal) {
    case 'steel':
      return `
        <linearGradient id="metalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="30%" stop-color="#cfd8dc"/>
          <stop offset="70%" stop-color="#78909c"/>
          <stop offset="100%" stop-color="#37474f"/>
        </linearGradient>
      `;
    case 'runic':
      return `
        <linearGradient id="metalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f3e8ff"/>
          <stop offset="30%" stop-color="#c084fc"/>
          <stop offset="70%" stop-color="#7e22ce"/>
          <stop offset="100%" stop-color="#3b0764"/>
        </linearGradient>
      `;
    case 'copper':
      return `
        <linearGradient id="metalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffedd5"/>
          <stop offset="30%" stop-color="#fb923c"/>
          <stop offset="70%" stop-color="#c2410c"/>
          <stop offset="100%" stop-color="#7c2d12"/>
        </linearGradient>
      `;
    case 'dark-spikes':
      return `
        <linearGradient id="metalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fca5a5"/>
          <stop offset="30%" stop-color="#dc2626"/>
          <stop offset="70%" stop-color="#7f1d1d"/>
          <stop offset="100%" stop-color="#450a0a"/>
        </linearGradient>
      `;
    case 'gold':
    default:
      return `
        <linearGradient id="metalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fff8d6"/>
          <stop offset="25%" stop-color="#fcd34d"/>
          <stop offset="50%" stop-color="#d97706"/>
          <stop offset="75%" stop-color="#92400e"/>
          <stop offset="100%" stop-color="#fbbf24"/>
        </linearGradient>
      `;
  }
}

/**
 * Retourne le tracé SVG de la frise selon la forme
 * Système de coordonnées standard : 512x512
 */
export function getBorderSvgPath(shape: TokenShape): string {
  const grad = 'url(#metalGrad)';
  if (shape === 'hex') {
    return `
      <!-- Hexagone relief extérieur -->
      <polygon points="256,16 480,146 480,366 256,496 32,366 32,146" fill="none" stroke="${grad}" stroke-width="26" stroke-linejoin="round" />
      <polygon points="256,26 470,149 470,363 256,486 42,363 42,149" fill="none" stroke="#222" stroke-width="3" stroke-linejoin="round" />
      <!-- Perles ornementales d'or -->
      <polygon points="256,25 470,148 470,364 256,487 42,364 42,148" fill="none" stroke="#ffffff" stroke-width="6" stroke-dasharray="3 18" stroke-linecap="round" stroke-linejoin="round" />
      <!-- Biseau intérieur -->
      <polygon points="256,44 450,154 450,358 256,468 62,358 62,154" fill="none" stroke="${grad}" stroke-width="8" stroke-linejoin="round" />
      <!-- Rivets aux 6 sommets -->
      <circle cx="256" cy="16" r="8" fill="#ffeaa7" stroke="#333" stroke-width="2" />
      <circle cx="480" cy="146" r="8" fill="#ffeaa7" stroke="#333" stroke-width="2" />
      <circle cx="480" cy="366" r="8" fill="#ffeaa7" stroke="#333" stroke-width="2" />
      <circle cx="256" cy="496" r="8" fill="#ffeaa7" stroke="#333" stroke-width="2" />
      <circle cx="32" cy="366" r="8" fill="#ffeaa7" stroke="#333" stroke-width="2" />
      <circle cx="32" cy="146" r="8" fill="#ffeaa7" stroke="#333" stroke-width="2" />
    `;
  } else if (shape === 'shield') {
    const outerPath = 'M 48 36 Q 256 12 464 36 Q 464 290 256 484 Q 48 290 48 36 Z';
    const innerPath = 'M 68 56 Q 256 36 444 56 Q 444 276 256 460 Q 68 276 68 56 Z';
    return `
      <path d="${outerPath}" fill="none" stroke="${grad}" stroke-width="26" stroke-linejoin="round" />
      <path d="${outerPath}" fill="none" stroke="#222" stroke-width="3" />
      <path d="${outerPath}" fill="none" stroke="#ffffff" stroke-width="6" stroke-dasharray="3 20" stroke-linecap="round" />
      <path d="${innerPath}" fill="none" stroke="${grad}" stroke-width="8" stroke-linejoin="round" />
      <circle cx="48" cy="36" r="8" fill="#ffeaa7" stroke="#333" stroke-width="2" />
      <circle cx="464" cy="36" r="8" fill="#ffeaa7" stroke="#333" stroke-width="2" />
      <circle cx="256" cy="484" r="8" fill="#ffeaa7" stroke="#333" stroke-width="2" />
    `;
  } else {
    return `
      <!-- Cercle classique -->
      <circle cx="256" cy="256" r="236" fill="none" stroke="${grad}" stroke-width="26" />
      <circle cx="256" cy="256" r="222" fill="none" stroke="#222" stroke-width="3" />
      <circle cx="256" cy="256" r="237" fill="none" stroke="#ffffff" stroke-width="6" stroke-dasharray="3 18" stroke-linecap="round" />
      <circle cx="256" cy="256" r="206" fill="none" stroke="${grad}" stroke-width="8" />
    `;
  }
}

/**
 * Tracé de clipping path pour découper l'image sous la frise (512x512)
 */
export function getClipPathD(shape: TokenShape): { type: 'path' | 'polygon' | 'circle'; d: string } {
  if (shape === 'hex') {
    return {
      type: 'polygon',
      d: '256,44 450,154 450,358 256,468 62,358 62,154',
    };
  } else if (shape === 'shield') {
    return {
      type: 'path',
      d: 'M 68 56 Q 256 36 444 56 Q 444 276 256 460 Q 68 276 68 56 Z',
    };
  } else {
    return {
      type: 'circle',
      d: 'cx="256" cy="256" r="206"',
    };
  }
}

/**
 * Charge une image et la transforme en HTMLImageElement
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Rendu complet du pion dans un HTMLCanvasElement (haute résolution 512x512)
 */
export async function renderTokenToCanvas(
  data: TokenDesignData,
  size: number = 512
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossible d\'obtenir le contexte 2D');

  const scale = size / 512;
  ctx.scale(scale, scale);

  // 1. Aura lumineuse
  if (data.aura !== 'none') {
    ctx.save();
    let glowColor = 'rgba(212, 175, 55, 0.6)';
    if (data.aura === 'fire') glowColor = 'rgba(239, 68, 68, 0.7)';
    else if (data.aura === 'magic') glowColor = 'rgba(168, 85, 247, 0.7)';
    else if (data.aura === 'holy') glowColor = 'rgba(253, 224, 71, 0.8)';

    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 40;
    ctx.beginPath();
    ctx.arc(256, 256, 220, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.01)';
    ctx.fill();
    ctx.restore();
  }

  // 2. Découpe (Clipping) et Fond
  ctx.save();
  ctx.beginPath();
  if (data.shape === 'hex') {
    const pts = [
      [256, 44], [450, 154], [450, 358], [256, 468], [62, 358], [62, 154]
    ];
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  } else if (data.shape === 'shield') {
    const p = new Path2D('M 68 56 Q 256 36 444 56 Q 444 276 256 460 Q 68 276 68 56 Z');
    ctx.clip(p);
  } else {
    ctx.arc(256, 256, 206, 0, Math.PI * 2);
  }
  ctx.clip();

  // Fond de couleur
  ctx.fillStyle = data.backgroundColor || '#2b2217';
  ctx.fillRect(0, 0, 512, 512);

  // 3. Image ou Émoji avec Pan & Scale
  if (data.imageUrl) {
    try {
      const img = await loadImage(data.imageUrl);
      const panX = data.imagePan.x * 2; // mise à l'échelle 512
      const panY = data.imagePan.y * 2;
      const imgScale = data.imageScale || 1.0;

      const baseW = 412 * imgScale;
      const baseH = (412 / (img.width / img.height)) * imgScale;
      const x = 256 - baseW / 2 + panX;
      const y = 256 - baseH / 2 + panY;

      ctx.drawImage(img, x, y, baseW, baseH);
    } catch {
      // Fallback emoji si l'image ne charge pas
      ctx.fillStyle = '#ffeaa7';
      ctx.font = 'bold 120px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(data.emojiIcon || '🛡️', 256, 256);
    }
  } else if (data.emojiIcon) {
    ctx.fillStyle = '#ffeaa7';
    ctx.font = 'bold 160px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.emojiIcon, 256, 256);
  }
  ctx.restore();

  // 4. Frise SVG
  if (data.showBorder) {
    const svgStr = `
      <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
        <defs>
          ${getMetalGradients(data.metal)}
        </defs>
        ${getBorderSvgPath(data.shape)}
      </svg>
    `;
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
      const borderImg = await loadImage(svgUrl);
      ctx.drawImage(borderImg, 0, 0, 512, 512);
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

  // 5. Jauge de PV en arc (si activée)
  if (data.showHpBar) {
    ctx.save();
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';

    // Fond d'arc
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.arc(256, 256, 240, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    // Arc coloré
    const hpFrac = Math.max(0, Math.min(1, data.hpPercent / 100));
    let hpColor = '#10b981';
    if (data.hpPercent <= 25) hpColor = '#ef4444';
    else if (data.hpPercent <= 50) hpColor = '#f59e0b';

    ctx.strokeStyle = hpColor;
    ctx.beginPath();
    const startAngle = Math.PI * 1.15;
    const totalArc = Math.PI * 0.7;
    ctx.arc(256, 256, 240, startAngle, startAngle + totalArc * hpFrac);
    ctx.stroke();
    ctx.restore();
  }

  // 6. Pastille de statut / Alignement (si activée)
  if (data.showStatusBadge) {
    ctx.save();
    let badgeX = 420, badgeY = 90;
    if (data.statusPosition === 'top-left') { badgeX = 92; badgeY = 90; }
    else if (data.statusPosition === 'bottom-right') { badgeX = 420; badgeY = 420; }
    else if (data.statusPosition === 'bottom-left') { badgeX = 92; badgeY = 420; }

    let bg = '#10b981', label = 'AMI';
    if (data.status === 'neutral') { bg = '#f59e0b'; label = 'PNJ'; }
    else if (data.status === 'hostile') { bg = '#ef4444'; label = 'ENNEMI'; }
    else if (data.status === 'boss') { bg = '#8b5cf6'; label = 'BOSS ★'; }

    ctx.fillStyle = bg;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(badgeX - 45, badgeY - 18, 90, 36, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, badgeX, badgeY);
    ctx.restore();
  }

  // 7. Cartouche du nom (si activé)
  if (data.showName && data.name.trim()) {
    ctx.save();
    let bannerX = 256 + (data.namePosition?.x ? data.namePosition.x * 2 : 0);
    let bannerY = 475 + (data.namePosition?.y ? data.namePosition.y * 2 : 0);

    if (data.namePreset === 'top') bannerY = 45;
    else if (data.namePreset === 'center') bannerY = 256;
    else if (data.namePreset === 'inside-bottom') bannerY = 430;

    ctx.font = 'bold 22px sans-serif';
    const textMetrics = ctx.measureText(data.name.toUpperCase());
    const boxW = Math.max(160, Math.min(380, textMetrics.width + 50));
    const boxH = 42;

    // Ombre du cartouche
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 4;

    // Fond dégradé sombre
    const grad = ctx.createLinearGradient(0, bannerY - boxH / 2, 0, bannerY + boxH / 2);
    grad.addColorStop(0, '#221c14');
    grad.addColorStop(1, '#100e0a');
    ctx.fillStyle = grad;

    // Bordure or
    ctx.strokeStyle = '#e6b450';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.roundRect(bannerX - boxW / 2, bannerY - boxH / 2, boxW, boxH, 20);
    ctx.fill();
    ctx.stroke();

    // Texte
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#ffe699';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.name.toUpperCase(), bannerX, bannerY);
    ctx.restore();
  }

  return canvas;
}

/**
 * Exporte un pion en Blob PNG
 */
export async function exportTokenToBlob(data: TokenDesignData, size: number = 512): Promise<Blob> {
  const canvas = await renderTokenToCanvas(data, size);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Erreur lors de la génération du blob PNG'));
    }, 'image/png');
  });
}

/**
 * Exporte un pion en Data URL PNG
 */
export async function exportTokenToDataUrl(data: TokenDesignData, size: number = 512): Promise<string> {
  const canvas = await renderTokenToCanvas(data, size);
  return canvas.toDataURL('image/png');
}
