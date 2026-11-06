import { getVaultPath, getVaultTree } from '../stores/vault.svelte';
import { vttStore, replaceActiveScene, switchMapScene, setGmCurrentMap } from '../stores/vtt.svelte';
import { readFileBase64, emitToPlayerView, isTauri } from '../api';
import { notifStore } from '../stores/notifications.svelte';
import type { VaultEntry } from '../api';

/**
 * Parcourt récursivement l'arborescence du Vault pour lister tous les fichiers images
 */
export function getAllVaultImages(entries: VaultEntry[] = getVaultTree() || []): { path: string; name: string }[] {
  let list: { path: string; name: string }[] = [];
  for (const e of entries) {
    if (e.is_dir && e.children) {
      list = [...list, ...getAllVaultImages(e.children)];
    } else {
      const ext = e.extension?.toLowerCase() || e.name.split('.').pop()?.toLowerCase();
      if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') {
        list.push({ path: e.path, name: e.name });
      }
    }
  }
  return list;
}

/**
 * Recherche une carte dans le Vault par nom partiel, chemin ou nom exact
 */
export function findMapInVault(target: string): { path: string; name: string } | null {
  if (!target) return null;
  const cleanTarget = target.trim().replace(/^map:/i, '').trim();
  const lower = cleanTarget.toLowerCase();
  const withoutExt = lower.replace(/\.[^.]+$/, '');

  const images = getAllVaultImages();
  if (images.length === 0) return null;

  // 1. Correspondance exacte sur le chemin complet
  let match = images.find(img => img.path.toLowerCase() === lower);
  if (match) return match;

  // 2. Correspondance exacte sur le nom de fichier avec extension
  match = images.find(img => img.name.toLowerCase() === lower);
  if (match) return match;

  // 3. Correspondance exacte sur le nom sans extension
  match = images.find(img => img.name.toLowerCase().replace(/\.[^.]+$/, '') === withoutExt);
  if (match) return match;

  // 4. Le chemin se termine par le nom demandé
  match = images.find(img => img.path.toLowerCase().endsWith(lower) || img.path.toLowerCase().endsWith(withoutExt));
  if (match) return match;

  // 5. Recherche par inclusion dans le dossier des cartes
  const mapFolderImages = images.filter(img => img.path.toLowerCase().includes('map'));
  match = mapFolderImages.find(img => img.name.toLowerCase().includes(withoutExt));
  if (match) return match;

  // 6. Recherche globale par inclusion partielle
  match = images.find(img => img.name.toLowerCase().includes(withoutExt) || img.path.toLowerCase().includes(withoutExt));
  return match || null;
}

/**
 * Charge une carte depuis le Markdown (commande ```map, [[map:...]], ou frontmatter),
 * l'affiche dans la Table Virtuelle du MJ et l'envoie directement à la Vue Joueurs !
 */
export async function loadAndDisplayMap(
  target: string,
  pushToPlayers: boolean = true,
  playerOnly: boolean = false
): Promise<boolean> {
  const cleanTarget = target.trim().replace(/^map:/i, '').trim();
  if (!cleanTarget) return false;

  const vaultPath = getVaultPath();
  const targetLower = cleanTarget.toLowerCase();

  // A. Vérifier d'abord si une scène VTT porte déjà ce nom
  const existingScene = vttStore.maps.find(
    m => m.name.toLowerCase() === targetLower || m.id === cleanTarget || m.relPath?.toLowerCase() === targetLower
  );

  if (existingScene) {
    if (!playerOnly) {
      switchMapScene(existingScene.id);
    }
    if (pushToPlayers) {
      let mapUrl = vttStore.currentMap;
      if (!mapUrl && existingScene.relPath && vaultPath) {
        try {
          const b64 = await readFileBase64(`${vaultPath}/${existingScene.relPath}`);
          const ext = existingScene.relPath.split('.').pop()?.toLowerCase();
          const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : (ext === 'webp' ? 'image/webp' : 'image/png');
          mapUrl = `data:${mime};base64,${b64}`;
        } catch {}
      }
      if (mapUrl) {
        await emitToPlayerView('set_player_map', { url: mapUrl });
      }
    }
    const msg = playerOnly
      ? `Carte "${existingScene.name}" envoyée directement sur l'écran des Joueurs.`
      : `Carte "${existingScene.name}" affichée sur la table et synchronisée avec les joueurs.`;
    notifStore.add('🗺️', playerOnly ? 'Vue Joueurs' : 'Scène Active', msg, 'success', 3500);
    return true;
  }

  // B. Recherche du fichier image dans le Vault
  const found = findMapInVault(cleanTarget);
  if (!found) {
    notifStore.add(
      '⚠️',
      'Carte introuvable',
      `Impossible de trouver la carte "${cleanTarget}" dans vos dossiers. Vérifiez son nom dans le dossier maps/.`,
      'warn',
      5000
    );
    return false;
  }

  // C. Chargement de l'image en Base64
  try {
    let dataUrl = '';
    if (isTauri() && vaultPath) {
      const b64 = await readFileBase64(`${vaultPath}/${found.path}`);
      const ext = found.path.split('.').pop()?.toLowerCase();
      let mime = 'image/png';
      if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
      else if (ext === 'webp') mime = 'image/webp';
      dataUrl = `data:${mime};base64,${b64}`;
    } else {
      dataUrl = found.path;
    }

    const cleanName = found.name.replace(/\.[^.]+$/, '');
    if (!playerOnly) {
      replaceActiveScene(cleanName, found.path, dataUrl);
      setGmCurrentMap(dataUrl, found.path);
    }

    // D. Envoi garanti vers la Vue Joueurs (2ème écran / TV)
    if (pushToPlayers) {
      await emitToPlayerView('set_player_map', { url: dataUrl });
    }

    const msg = playerOnly
      ? `"${cleanName}" a été projetée sur l'écran des Joueurs sans modifier votre vue MJ !`
      : `"${cleanName}" est affichée sur votre table et synchronisée sur la Vue Joueurs !`;
    notifStore.add('🗺️', playerOnly ? 'Vue Joueurs' : 'Carte affichée', msg, 'success', 4000);
    return true;
  } catch (err) {
    console.error('Erreur chargement carte markdown:', err);
    notifStore.add('❌', 'Erreur carte', `Échec du chargement de "${found.name}" : ${err}`, 'danger', 5000);
    return false;
  }
}
