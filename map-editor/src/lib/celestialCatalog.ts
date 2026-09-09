// ── Catalogue Céleste pour Map Editor ──────────────────────────────────────────
// Chargement optimisé avec cache IndexedDB, fallback réseau et indexation rapide.

export interface DriveFile {
  id: string;
  name: string;
  filename: string;
  path: string;
  category: string;
  destination: 'maps' | 'tiles/custom' | 'tokens' | 'assets/audio' | 'books' | string;
  subfolder: string;
  url: string;
  highResUrl: string;
  thumbUrl: string;
}

export interface CelestialCatalog {
  files: DriveFile[];
  totalFiles: number;
  updatedAt: string;
}

const DB_NAME = 'GrimoireCelestialMapDB';
const DB_VERSION = 1;
const STORE_NAME = 'catalog_store';
const KEY_DATA = 'catalog_v1';

let memoryCatalog: CelestialCatalog | null = null;

function anyAudioExt(filename: string): boolean {
  const l = filename.toLowerCase();
  return l.endsWith('.mp3') || l.endsWith('.ogg') || l.endsWith('.wav') || l.endsWith('.flac') || l.endsWith('.m4a');
}

export function detectDestination(path: string): string {
  const clean = path.replace(/\\/g, '/').toLowerCase();
  if (clean.endsWith('.pdf') || clean.includes('/pdf') || clean.includes('/livres') || clean.includes('/books') || clean.includes('/scenarios')) {
    return 'books';
  }
  if (clean.includes('/textures') || clean.startsWith('textures')) return 'tiles/custom';
  if (clean.includes('/stamps') || clean.includes('/tokens') || clean.startsWith('stamps') || clean.startsWith('tokens')) return 'tokens';
  if (anyAudioExt(clean) || clean.includes('/audio') || clean.includes('/ambiance') || clean.includes('/sound') || clean.includes('/musique')) {
    return 'assets/audio';
  }
  return 'maps';
}

function parseCatalogJson(json: any): CelestialCatalog {
  const collected: DriveFile[] = [];

  if (Array.isArray(json.files)) {
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

      const isGoogleDriveId = id && !id.startsWith('audio_') && !id.startsWith('local_') && !id.startsWith('drive_');
      const fileUrl = isAudio
        ? (isGoogleDriveId ? `https://drive.usercontent.google.com/download?id=${id}&export=download` : `/${cleanP}`)
        : (isGoogleDriveId ? `https://lh3.googleusercontent.com/d/${id}` : `/${cleanP}`);

      const highRes = isAudio ? fileUrl : (isGoogleDriveId ? `https://lh3.googleusercontent.com/d/${id}=w2560` : fileUrl);
      const thumb = isAudio ? '' : (isGoogleDriveId ? `https://drive.google.com/thumbnail?id=${id}&sz=w400` : fileUrl);

      collected.push({
        id,
        name,
        filename,
        path: cleanP,
        category: parts[1] || (dest === 'books' ? 'Livres & Scénarios' : isAudio ? 'Grimoire Audio' : dest === 'tiles/custom' ? 'Textures' : dest === 'tokens' ? 'Tampons' : 'Cartes'),
        destination: dest,
        subfolder: parts.slice(0, -1).join('/'),
        url: fileUrl,
        highResUrl: highRes,
        thumbUrl: thumb
      });
    }
  } else {
    // Anciens formats
    if (json.maps) {
      for (const m of json.maps) {
        collected.push({
          id: m.id,
          name: m.name,
          filename: m.name,
          path: m.path || `maps/${m.folder || 'Général'}/${m.name}.png`,
          category: m.folder || 'Cartes',
          destination: 'maps',
          subfolder: m.folder || 'Cartes',
          url: m.url,
          highResUrl: m.highResUrl || m.url,
          thumbUrl: m.thumbUrl || m.url
        });
      }
    }
    if (json.textures) {
      for (const t of json.textures) {
        collected.push({
          id: t.id,
          name: t.name,
          filename: t.name,
          path: t.path || `textures/${t.category || 'Général'}/${t.name}.png`,
          category: t.category || 'Textures',
          destination: 'tiles/custom',
          subfolder: t.category || 'Textures',
          url: t.url,
          highResUrl: t.url,
          thumbUrl: t.thumbUrl || t.url
        });
      }
    }
    if (json.stamps) {
      for (const s of json.stamps) {
        collected.push({
          id: s.id,
          name: s.name,
          filename: s.name,
          path: s.path || `stamps/${s.category || 'Général'}/${s.name}.png`,
          category: s.category || 'Tampons',
          destination: 'tokens',
          subfolder: s.category || 'Tampons',
          url: s.url,
          highResUrl: s.url,
          thumbUrl: s.thumbUrl || s.url
        });
      }
    }
  }

  return {
    files: collected,
    totalFiles: collected.length,
    updatedAt: json.updated || new Date().toISOString()
  };
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

async function getFromIndexedDB(): Promise<CelestialCatalog | null> {
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

async function saveToIndexedDB(data: CelestialCatalog): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(data, KEY_DATA);
  } catch (e) {
    console.warn('Erreur sauvegarde IndexedDB catalogue:', e);
  }
}

async function fetchFromUrls(): Promise<CelestialCatalog> {
  const ts = Date.now();
  const candidates = [
    `/drive-catalog.json?t=${ts}`,
    `./drive-catalog.json?t=${ts}`,
    `../drive-catalog.json?t=${ts}`,
    `https://raw.githubusercontent.com/LordMadTrix/grimoire/main/public/drive-catalog.json?t=${ts}`
  ];

  let lastError: any = null;
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const catalog = parseCatalogJson(json);
        memoryCatalog = catalog;
        saveToIndexedDB(catalog).catch(() => {});
        return catalog;
      }
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error('Impossible de charger le catalogue céleste.');
}

export async function loadCelestialCatalog(forceRefresh = false): Promise<CelestialCatalog> {
  if (!forceRefresh && memoryCatalog && memoryCatalog.files.length > 0) {
    return memoryCatalog;
  }

  if (!forceRefresh) {
    const cached = await getFromIndexedDB();
    if (cached && cached.files && cached.files.length > 0) {
      memoryCatalog = cached;
      // Rafraîchir en tâche de fond discrètement
      setTimeout(() => { fetchFromUrls().catch(() => {}); }, 200);
      return cached;
    }
  }

  return await fetchFromUrls();
}
