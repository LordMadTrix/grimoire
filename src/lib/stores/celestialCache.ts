// ── Celestial Cache (In-Memory Singleton + IndexedDB + Auto-Sync) ─────────────
// Permet un chargement instantané (0 ms en mémoire, < 15 ms sur disque)
// et une vérification automatique des nouveautés à chaque démarrage.

export interface DriveFile {
  id: string;
  name: string;
  filename: string;
  path: string;
  category?: string;
  destination: string;
  subfolder?: string;
  url: string;
  highResUrl: string;
  thumbUrl: string;
}

export interface TreeNode {
  name: string;
  path: string;
  subfolders: Record<string, TreeNode>;
  files: DriveFile[];
  totalFiles: number;
  thumbnail?: string;
  destination: string;
}

export interface CelestialData {
  files: DriveFile[];
  tree: TreeNode;
  totalFiles: number;
  updatedAt: string;
}

// Singleton mémoire
let memoryCache: CelestialData | null = null;

// IndexedDB Helper
const DB_NAME = 'GrimoireCelestialDB';
const DB_VERSION = 2;
const STORE_NAME = 'celestial_store';
const KEY_DATA = 'catalog_v4';

// Listeners pour notifier les composants en temps réel
type CatalogListener = (data: CelestialData, newCount: number) => void;
const listeners = new Set<CatalogListener>();

export function subscribeToCelestialUpdates(listener: CatalogListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(data: CelestialData, newCount: number) {
  for (const listener of listeners) {
    try {
      listener(data, newCount);
    } catch (e) {
      console.warn('Listener error in celestialCache:', e);
    }
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB non supporté'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getFromIndexedDB(): Promise<CelestialData | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY_DATA);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function saveToIndexedDB(data: CelestialData): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(data, KEY_DATA);
  } catch (e) {
    console.warn('Erreur sauvegarde IndexedDB:', e);
  }
}

export function detectDestination(path: string): string {
  const clean = path.replace(/\\/g, '/').toLowerCase();
  if (clean.endsWith('.pdf') || clean.includes('/pdf') || clean.includes('/livres') || clean.includes('/books') || clean.includes('/scenarios') || clean.startsWith('pdf') || clean.startsWith('livres') || clean.startsWith('books')) {
    return 'books';
  }
  if (clean.includes('/textures') || clean.startsWith('textures')) return 'tiles/custom';
  if (clean.includes('/stamps') || clean.includes('/tokens') || clean.startsWith('stamps') || clean.startsWith('tokens')) return 'tokens';
  if (clean.endsWith('.mp3') || clean.endsWith('.ogg') || clean.endsWith('.wav') || clean.endsWith('.flac') || clean.endsWith('.m4a') || clean.includes('/audio') || clean.includes('/ambiance') || clean.includes('/sound') || clean.includes('/musique') || clean.startsWith('audio') || clean.startsWith('ambiance') || clean.startsWith('musique')) {
    return 'assets/audio';
  }
  return 'maps';
}

export function buildCelestialTree(files: DriveFile[]): TreeNode {
  const root: TreeNode = {
    name: 'Archives Célestes',
    path: '',
    subfolders: {},
    files: [],
    totalFiles: 0,
    destination: 'maps'
  };

  for (const f of files) {
    let p = f.path.replace(/\\/g, '/').replace(/^\/+/, '');
    // Nettoyer le préfixe racine redondant "assets/" si présent
    if (p.toLowerCase().startsWith('assets/')) {
      p = p.slice(7);
    }
    const parts = p.split('/');
    const folderParts = parts.slice(0, -1);

    let curr = root;
    curr.totalFiles++;
    let curPath = '';

    for (let i = 0; i < folderParts.length; i++) {
      const folderName = folderParts[i];
      curPath = curPath ? `${curPath}/${folderName}` : folderName;

      if (!curr.subfolders[folderName]) {
        const dest = detectDestination(curPath + (f.filename ? '/' + f.filename : ''));
        let displayName = folderName;
        const lower = folderName.toLowerCase();
        if (lower === 'pdf' || lower === 'books' || lower === 'livres') {
          displayName = '📚 Livres & Grimoires PDF';
        } else if (lower === 'maps') {
          displayName = '🗺️ Cartes de Bataille';
        } else if (lower === 'textures') {
          displayName = '🧱 Textures';
        } else if (lower === 'stamps' || lower === 'tokens') {
          displayName = '🎨 Tampons & Tokens';
        } else if (lower === 'audio' || lower === 'grimoire_audio') {
          displayName = '🎵 Grimoire Audio';
        } else if (lower === 'musiques_et_ambiances') {
          displayName = '🎼 Musiques & Ambiances';
        } else if (lower === 'bruitages_sfx') {
          displayName = '🔊 Bruitages & SFX';
        } else if (lower === 'musiques_combat') {
          displayName = '⚔️ Musiques de Combat';
        } else if (lower === 'horreur_et_donjons') {
          displayName = '🏰 Horreur & Donjons';
        } else if (lower === 'villes_et_tavernes') {
          displayName = '🍺 Villes & Tavernes';
        } else if (lower === 'nature_et_elements') {
          displayName = '🌲 Nature & Éléments';
        } else if (lower === 'scifi_et_futuriste') {
          displayName = '🚀 Sci-Fi & Futuriste';
        } else if (lower === 'musiques_exploration') {
          displayName = '🧭 Musiques d\'Exploration';
        } else if (lower === 'ambiances') {
          displayName = '🌌 Ambiances Immersives';
        } else if (lower.startsWith('bruitages_')) {
          const sfxName = folderName.replace(/^bruitages_/i, '').replace(/_/g, ' ');
          displayName = `💥 SFX ${sfxName.charAt(0).toUpperCase() + sfxName.slice(1)}`;
        }

        curr.subfolders[folderName] = {
          name: displayName,
          path: curPath,
          subfolders: {},
          files: [],
          totalFiles: 0,
          thumbnail: f.thumbUrl || f.url,
          destination: dest
        };
      }
      curr = curr.subfolders[folderName];
      curr.totalFiles++;
    }

    curr.files.push(f);
  }

  return root;
}

function parseJsonToCelestialData(json: any): CelestialData {
  const collected: DriveFile[] = [];

  if (Array.isArray(json.files)) {
    // Format compact [id, path, name]
    for (const item of json.files) {
      const id = item[0];
      const p = item[1];
      const name = item[2];
      const filename = p.split('/').pop() || name;
      let cleanP = p.replace(/\\/g, '/').replace(/^\/+/, '');
      if (cleanP.toLowerCase().startsWith('assets/')) {
        cleanP = cleanP.slice(7);
      }
      const parts = cleanP.split('/');
      const dest = detectDestination(cleanP);
      const isAudio = dest === 'assets/audio' || anyAudioExt(filename);

      // Si ID local ou format audio interne, servir directement depuis public/
      const isGoogleDriveId = id && !id.startsWith('audio_') && !id.startsWith('local_') && !id.startsWith('drive_');
      const fileUrl = isAudio
        ? (isGoogleDriveId ? `https://drive.usercontent.google.com/download?id=${id}&export=download` : `/${p}`)
        : (isGoogleDriveId ? `https://lh3.googleusercontent.com/d/${id}` : `/${p}`);

      collected.push({
        id,
        name,
        filename,
        path: cleanP,
        category: parts[1] || (dest === 'books' ? 'Livres & Scénarios' : isAudio ? 'Grimoire Audio' : 'Général'),
        destination: dest,
        subfolder: parts.slice(0, -1).join('/'),
        url: fileUrl,
        highResUrl: isAudio ? fileUrl : (isGoogleDriveId ? `https://lh3.googleusercontent.com/d/${id}=w2560` : fileUrl),
        thumbUrl: isAudio ? '' : (isGoogleDriveId ? `https://drive.google.com/thumbnail?id=${id}&sz=w400` : fileUrl)
      });
    }
  } else {
    // Rétrocompatibilité anciens formats
    if (json.maps) {
      for (const m of json.maps) {
        collected.push({
          id: m.id,
          name: m.name,
          filename: m.path ? m.path.split(/[\\/]/).pop() || m.name : m.name,
          path: m.path || `maps/${m.folder || 'Général'}/${m.name}.png`,
          destination: 'maps',
          url: m.url,
          highResUrl: m.highResUrl || m.url,
          thumbUrl: m.thumbUrl || m.url
        });
      }
    }
    if (json.textures) {
      for (const t of json.textures) {
        const fid = t.id ? t.id.replace('drive_tex_', '') : '';
        collected.push({
          id: fid,
          name: t.name,
          filename: t.path ? t.path.split(/[\\/]/).pop() || t.name : t.name,
          path: t.path || `textures/${t.category || 'Général'}/${t.name}.png`,
          destination: 'tiles/custom',
          url: t.url,
          highResUrl: t.url,
          thumbUrl: t.thumbUrl || t.url
        });
      }
    }
    if (json.stamps) {
      for (const s of json.stamps) {
        const fid = s.id ? s.id.replace('drive_stamp_', '') : '';
        collected.push({
          id: fid,
          name: s.name,
          filename: s.path ? s.path.split(/[\\/]/).pop() || s.name : s.name,
          path: s.path || `stamps/${s.category || 'Général'}/${s.name}.png`,
          destination: 'tokens',
          url: s.url,
          highResUrl: s.url,
          thumbUrl: s.thumbUrl || s.url
        });
      }
    }
  }

  const tree = buildCelestialTree(collected);
  return {
    files: collected,
    tree,
    totalFiles: collected.length,
    updatedAt: json.updated || new Date().toISOString()
  };
}

function anyAudioExt(filename: string): boolean {
  const lower = filename.toLowerCase();
  return lower.endsWith('.mp3') || lower.endsWith('.ogg') || lower.endsWith('.wav') || lower.endsWith('.flac') || lower.endsWith('.m4a');
}

/**
 * Récupère le catalogue. Si en cache, le retourne instantanément (0 ms)
 * et lance une vérification de nouveautés en arrière-plan.
 */
export async function getCelestialCatalog(forceRefresh = false): Promise<CelestialData> {
  // 1. Retour immédiat depuis la mémoire si disponible et non forcé
  if (!forceRefresh && memoryCache) {
    // Vérification en arrière-plan sans bloquer
    setTimeout(() => { checkForCatalogUpdates().catch(() => {}); }, 100);
    return memoryCache;
  }

  // 2. Lecture depuis IndexedDB (< 15 ms)
  if (!forceRefresh) {
    const idbData = await getFromIndexedDB();
    if (idbData && idbData.files && idbData.files.length > 0) {
      memoryCache = idbData;
      // Vérification en arrière-plan
      setTimeout(() => { checkForCatalogUpdates().catch(() => {}); }, 100);
      return idbData;
    }
  }

  // 3. Téléchargement forcé / premier chargement
  return await fetchFreshCatalog();
}

async function fetchFreshCatalog(): Promise<CelestialData> {
  const timestamp = Date.now();
  let json: any = null;

  try {
    const res = await fetch(`/drive-catalog.json?t=${timestamp}`);
    if (res.ok) {
      json = await res.json();
    }
  } catch (e) {
    console.warn('Fetch local drive-catalog.json failed, trying online fallback...', e);
  }

  if (!json) {
    // Fallback GitHub raw
    const remoteUrl = `https://raw.githubusercontent.com/LordMadTrix/grimoire/main/public/drive-catalog.json?t=${timestamp}`;
    const res = await fetch(remoteUrl);
    if (!res.ok) throw new Error(`Impossible de charger le catalogue (HTTP ${res.status})`);
    json = await res.json();
  }

  const result = parseJsonToCelestialData(json);

  // Mettre en cache
  memoryCache = result;
  await saveToIndexedDB(result);
  notifyListeners(result, 0);

  return result;
}

/**
 * Vérifie si de nouvelles ressources (Cartes, PDFs, Textures) sont disponibles.
 * Exécuté automatiquement à chaque démarrage de Grimoire.
 */
export async function checkForCatalogUpdates(): Promise<{ updated: boolean; newFiles: number; total: number }> {
  try {
    const current = memoryCache || (await getFromIndexedDB());
    const timestamp = Date.now();
    
    let json: any = null;
    try {
      const res = await fetch(`/drive-catalog.json?t=${timestamp}`);
      if (res.ok) json = await res.json();
    } catch {
      // Ignorer erreur réseau locale
    }

    if (!json) {
      const remoteUrl = `https://raw.githubusercontent.com/LordMadTrix/grimoire/main/public/drive-catalog.json?t=${timestamp}`;
      const res = await fetch(remoteUrl);
      if (res.ok) json = await res.json();
    }

    if (!json) {
      return { updated: false, newFiles: 0, total: current?.totalFiles || 0 };
    }

    const remoteTotal = Array.isArray(json.files) ? json.files.length : (json.totalFiles || 0);
    const remoteUpdated = json.updated || '';
    const currentTotal = current?.totalFiles || 0;
    const currentUpdated = current?.updatedAt || '';

    // Si nouveau total ou date de mise à jour différente
    if (remoteTotal !== currentTotal || remoteUpdated !== currentUpdated || currentTotal === 0) {
      console.log(`✨ Nouveautés détectées dans les Archives Célestes (${currentTotal} -> ${remoteTotal} fichiers)`);
      const newData = parseJsonToCelestialData(json);
      memoryCache = newData;
      await saveToIndexedDB(newData);

      const diff = Math.max(0, newData.totalFiles - currentTotal);
      notifyListeners(newData, diff);

      return {
        updated: true,
        newFiles: diff,
        total: newData.totalFiles
      };
    }

    return { updated: false, newFiles: 0, total: currentTotal };
  } catch (e) {
    console.warn('Vérification des nouveautés du catalogue ignorée:', e);
    return { updated: false, newFiles: 0, total: memoryCache?.totalFiles || 0 };
  }
}
