import { getVaultPath } from '../stores/vault.svelte';
import { vttStore, addGmToken, type Token } from '../stores/vtt.svelte';
import { isTauri, writeFile, writeFileBase64, createDirectory, listDirectory, downloadImageBase64, readFileBinary } from '../api';
import type { TokenDesignData, SavedTokenDescriptor } from '../types/tokenEditor';

/**
 * Nettoie un nom de token pour créer un nom de fichier propre
 */
export function slugifyTokenName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'token';
}

/**
 * Convertit un Blob en Data URL (base64)
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Convertit n'importe quelle source d'image (URL relative, URL web, etc.) en Data URL (base64)
 */
export async function imageSourceToDataUrl(src: string): Promise<string> {
  if (!src) return '';
  if (src.startsWith('data:')) return src;

  // 1. Les blob: locaux sont 100% same-origin et convertibles directement via FileReader
  if (src.startsWith('blob:')) {
    try {
      const res = await fetch(src);
      if (res.ok) {
        const blob = await res.blob();
        return await blobToDataUrl(blob);
      }
    } catch {}
  }

  // 2. Fichiers locaux / asset:// sous Tauri : lecture directe en binaire pour éviter le tainted canvas
  if (isTauri() && !src.startsWith('http://') && !src.startsWith('https://')) {
    try {
      const cleanPath = src.replace(/^asset:\/\/localhost\//, '').replace(/^asset:\/\//, '');
      const bytes = await readFileBinary(decodeURIComponent(cleanPath));
      if (bytes && bytes.byteLength > 0) {
        const ext = cleanPath.toLowerCase();
        const mime = ext.endsWith('.webp') ? 'image/webp' : ext.endsWith('.jpg') || ext.endsWith('.jpeg') ? 'image/jpeg' : ext.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
        const blob = new Blob([bytes], { type: mime });
        return await blobToDataUrl(blob);
      }
    } catch {}
  }

  // 3. Téléchargement distant sécurisé via Tauri Rust (contournement total CORS)
  if (isTauri()) {
    try {
      const b64 = await downloadImageBase64(src);
      if (b64 && b64.startsWith('data:')) return b64;
    } catch {
      // Poursuivre
    }
  }

  // 4. Tenter un fetch standard
  try {
    const res = await fetch(src);
    if (res.ok) {
      const blob = await res.blob();
      return await blobToDataUrl(blob);
    }
  } catch {}

  // 5. Tentative canvas temporaire avec gestion d'erreur stricte
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || 512;
        c.height = img.naturalHeight || 512;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(c.toDataURL('image/png'));
          return;
        }
      } catch {
        // Canvas tainted — renvoyer l'URL source
      }
      resolve(src);
    };
    img.onerror = () => {
      resolve(src);
    };
    img.src = src;
  });
}

/**
 * Enregistre le token dans le coffre de campagne du MJ (dossier tokens/)
 */
export async function saveTokenToVault(
  design: TokenDesignData,
  pngBlob: Blob
): Promise<{ success: boolean; pngPath: string; jsonPath: string; message: string }> {
  const vaultPath = getVaultPath();
  const slug = slugifyTokenName(design.name);

  // Cas Web / Pas de coffre ouvert : téléchargement classique du navigateur
  if (!isTauri() || !vaultPath) {
    const dataUrl = await blobToDataUrl(pngBlob);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${slug}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    return {
      success: true,
      pngPath: `${slug}.png`,
      jsonPath: `${slug}.json`,
      message: 'Téléchargé sur votre ordinateur (aucun coffre Grimoire actif).',
    };
  }

  try {
    // 1. Création du dossier tokens/
    await createDirectory(vaultPath, 'tokens').catch(() => {});

    // 2. Sauvegarde du fichier PNG en base64
    const dataUrl = await blobToDataUrl(pngBlob);
    const base64Content = dataUrl.split(',')[1] || '';
    const relPngPath = `tokens/${slug}.png`;
    await writeFileBase64(vaultPath, relPngPath, base64Content);

    // 3. Sauvegarde du fichier JSON de configuration
    const relJsonPath = `tokens/${slug}.json`;
    const descriptor: SavedTokenDescriptor = {
      id: design.id,
      name: design.name,
      createdAt: Date.now(),
      imageFile: relPngPath,
      design,
    };
    await writeFile(vaultPath, relJsonPath, JSON.stringify(descriptor, null, 2));

    return {
      success: true,
      pngPath: relPngPath,
      jsonPath: relJsonPath,
      message: `Enregistré avec succès dans ${vaultPath}/${relPngPath}`,
    };
  } catch (err: any) {
    console.error('Erreur saveTokenToVault:', err);
    throw new Error(`Échec de l'enregistrement dans le coffre : ${err?.message || err}`);
  }
}

/**
 * Dépose immédiatement le pion sur la scène VTT active
 */
export function placeTokenOnActiveMap(
  design: TokenDesignData,
  pngDataUrl: string,
  preferredCoords?: { x: number; y: number }
): Token {
  const gridSize = vttStore.gridSize || 50;
  const tokenSize = gridSize * (design.scaleGrid || 1);

  // Centrage dans la vue courante si pas de coordonnées explicites
  const targetX = preferredCoords?.x ?? Math.max(gridSize, Math.round(500 / gridSize) * gridSize);
  const targetY = preferredCoords?.y ?? Math.max(gridSize, Math.round(400 / gridSize) * gridSize);

  const token: Token & { isShaped?: boolean } = {
    id: 'tok_' + Math.random().toString(36).slice(2, 10),
    name: design.name || 'Pion',
    x: targetX,
    y: targetY,
    size: tokenSize,
    imageUrl: pngDataUrl,
    hp: design.showHpBar ? design.hpPercent : undefined,
    maxHp: design.showHpBar ? 100 : undefined,
    isEnemy: design.status === 'hostile' || design.status === 'boss',
    visible: false, // Caché par défaut aux joueurs : le MJ décide de le révéler ou selon la portée visuelle des PJ
    isShaped: true,
    notes: `Pion créé via l'Éditeur de Tokens (${design.shape}, ${design.metal})`,
  };

  addGmToken(token);
  return token;
}

/**
 * Liste les tokens enregistrés dans le coffre du MJ
 */
export async function listVaultTokens(): Promise<SavedTokenDescriptor[]> {
  const vaultPath = getVaultPath();
  if (!isTauri() || !vaultPath) return [];

  try {
    const entries = await listDirectory(vaultPath, 'tokens');
    const descriptors: SavedTokenDescriptor[] = [];

    for (const entry of entries) {
      if (entry.name && entry.name.endsWith('.json')) {
        // Optionnel : lecture
      }
    }
    return descriptors;
  } catch {
    return [];
  }
}
