// ── Celestial Cache (In-Memory Singleton + IndexedDB) ──────────────────────
// Permet un chargement instantané (0 ms en mémoire, < 15 ms sur disque)

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
const DB_VERSION = 1;
const STORE_NAME = 'celestial_store';
const KEY_DATA = 'catalog_v3';

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
    const p = f.path.replace(/\\/g, '/').replace(/^\/+/, '');
    const parts = p.split('/');
    const folderParts = parts.slice(0, -1);

    let curr = root;
    curr.totalFiles++;
    let curPath = '';

    for (let i = 0; i < folderParts.length; i++) {
      const folderName = folderParts[i];
      curPath = curPath ? `${curPath}/${folderName}` : folderName;

      if (!curr.subfolders[folderName]) {
        const rootType = folderParts[0].toLowerCase();
        const dest = rootType === 'textures' ? 'tiles/custom' : (rootType === 'stamps' || rootType === 'tokens' ? 'tokens' : 'maps');
        curr.subfolders[folderName] = {
          name: folderName,
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

export async function getCelestialCatalog(forceRefresh = false): Promise<CelestialData> {
  // 1. Retour immédiat depuis la mémoire (0 ms)
  if (!forceRefresh && memoryCache) {
    return memoryCache;
  }

  // 2. Lecture depuis IndexedDB (< 15 ms)
  if (!forceRefresh) {
    const idbData = await getFromIndexedDB();
    if (idbData && idbData.files && idbData.files.length > 0) {
      memoryCache = idbData;
      return idbData;
    }
  }

  // 3. Téléchargement et parsing du catalogue compact (~3.6 Mo)
  const res = await fetch('/drive-catalog.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  const collected: DriveFile[] = [];

  if (Array.isArray(json.files)) {
    // Format ultra-compact [id, path, name]
    for (const item of json.files) {
      const id = item[0];
      const p = item[1];
      const name = item[2];
      const filename = p.split('/').pop() || name;
      const parts = p.split('/');
      const rootType = parts[0].toLowerCase();
      const dest = rootType === 'textures' ? 'tiles/custom' : (rootType === 'stamps' || rootType === 'tokens' ? 'tokens' : 'maps');

      collected.push({
        id,
        name,
        filename,
        path: p,
        category: parts[1] || 'Général',
        destination: dest,
        subfolder: parts.slice(0, -1).join('/'),
        url: `https://lh3.googleusercontent.com/d/${id}`,
        highResUrl: `https://lh3.googleusercontent.com/d/${id}=w2560`,
        thumbUrl: `https://drive.google.com/thumbnail?id=${id}&sz=w400`
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
  const result: CelestialData = {
    files: collected,
    tree,
    totalFiles: collected.length,
    updatedAt: new Date().toISOString()
  };

  // Stocker en mémoire et dans IndexedDB
  memoryCache = result;
  saveToIndexedDB(result);

  return result;
}
