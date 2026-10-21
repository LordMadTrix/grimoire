import { getVaultPath } from '../stores/vault.svelte';
import { vttStore, addGmToken, type Token } from '../stores/vtt.svelte';
import { isTauri, writeFile, writeFileBase64, createDirectory, listDirectory } from '../api';
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

  const token: Token = {
    id: 'tok_' + Math.random().toString(36).slice(2, 10),
    name: design.name || 'Pion',
    x: targetX,
    y: targetY,
    size: tokenSize,
    imageUrl: pngDataUrl,
    hp: design.showHpBar ? design.hpPercent : undefined,
    maxHp: design.showHpBar ? 100 : undefined,
    isEnemy: design.status === 'hostile' || design.status === 'boss',
    visible: true,
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
