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
  /** Total annoncé par le manifeste — peut dépasser files.length si des dossiers sont différés. */
  manifestTotal?: number;
  /** Dossiers du manifeste pas encore téléchargés (ex. stamps/*). */
  pendingFolders?: string[];
}

// Singleton mémoire
let memoryCache: CelestialData | null = null;

// IndexedDB Helper
const DB_NAME = 'GrimoireCelestialDB';
const DB_VERSION = 2;
const STORE_NAME = 'celestial_store';
const KEY_DATA = 'catalog_v9'; // v9 : URLs média absolues (proxy Vite en dev, protocole Tauri en prod)

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
  // Le dossier Drive s'appelle « Token » (singulier) : couvrir les deux graphies, sinon ces
  // fichiers retombent sur 'maps' et apparaissent comme des cartes de bataille.
  if (clean.includes('/stamps') || clean.includes('/tokens') || clean.startsWith('stamps') || clean.startsWith('tokens') || clean.startsWith('token/') || clean.includes('/token/')) return 'tokens';
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
        } else if (lower === 'token') {
          displayName = '🧙 Tokens & Bestiaire';
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
      const isVideo = anyVideoExt(filename);

      // Si ID local ou format audio/vidéo interne, servir directement depuis public/
      const isGoogleDriveId = id && !id.startsWith('audio_') && !id.startsWith('local_') && !id.startsWith('drive_');
      // lh3.googleusercontent.com ne sert que des images : audio/vidéo passent par l'endpoint de téléchargement Drive
      const fileUrl = (isAudio || isVideo)
        ? (isGoogleDriveId ? driveMediaUrl(id, filename) : `/${p}`)
        : (isGoogleDriveId ? `https://lh3.googleusercontent.com/d/${id}` : `/${p}`);

      collected.push({
        id,
        name,
        filename,
        path: cleanP,
        category: parts[1] || (dest === 'books' ? 'Livres & Scénarios' : isAudio ? 'Grimoire Audio' : isVideo ? 'Vidéos' : 'Général'),
        destination: dest,
        subfolder: parts.slice(0, -1).join('/'),
        url: fileUrl,
        highResUrl: (isAudio || isVideo) ? fileUrl : (isGoogleDriveId ? `https://lh3.googleusercontent.com/d/${id}=w2560` : fileUrl),
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

function anyVideoExt(filename: string): boolean {
  const lower = filename.toLowerCase();
  return lower.endsWith('.mp4') || lower.endsWith('.webm');
}

const MEDIA_PROXY_PATH = '/drive-media';

/**
 * URL de lecture d'un média Drive (audio/vidéo).
 * Drive sert les fichiers en `application/octet-stream` + `Content-Disposition: attachment`,
 * ce que <audio>/<video> refusent de lire. On passe donc par un relais qui rétablit
 * le bon Content-Type :
 *   • en dev (navigateur ou webview de `tauri dev`) : le proxy Vite `/drive-media` ;
 *   • en production Tauri : le protocole custom `grimoiremedia` (côté Rust).
 */
function driveMediaUrl(id: string, filename: string): string {
  const ext = (filename.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const mediaPath = `${MEDIA_PROXY_PATH}/${id}.${ext}`;
  const w = typeof window !== 'undefined'
    ? (window as unknown as { __TAURI_INTERNALS__?: unknown; navigator?: Navigator; location?: Location })
    : undefined;
  if (!w) return mediaPath;
  // Dans l'app Tauri, la fenêtre principale ET la « Vue Joueurs » partagent le
  // même webview : le protocole custom est donc accessible depuis les deux.
  if ('__TAURI_INTERNALS__' in w) {
    const ua = w.navigator?.userAgent || '';
    return /Windows|Android/i.test(ua)
      ? `http://grimoiremedia.localhost${mediaPath}`
      : `grimoiremedia://localhost${mediaPath}`;
  }
  // Navigateur (dev) : proxy Vite, en absolu pour rester valable hors de la racine du site.
  const origin = w.location?.origin || '';
  return /^https?:\/\//.test(origin) ? `${origin}${mediaPath}` : mediaPath;
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

// ── Catalogue Drive à la demande (manifeste + fragments) ────────────────────
// drive-catalog-light.json (≈400 o) : total + compteur par dossier
// drive-fragments/<dossier>.json : lignes compactes [[id, path, name], …]
// Le catalogue complet (4,4 Mo) reste servi pour les anciennes versions.

interface DriveCatalogManifest {
  version: number;
  updated: string;
  totalFiles: number;
  folders: Record<string, number>;
}

let manifestPromise: Promise<DriveCatalogManifest | null> | null = null;

async function fetchDriveManifest(): Promise<DriveCatalogManifest | null> {
  try {
    const res = await fetch('/drive-catalog-light.json');
    if (res.ok) return await res.json();
  } catch {
    // Repli en ligne
  }
  try {
    const res = await fetch('https://raw.githubusercontent.com/LordMadTrix/grimoire/main/public/drive-catalog-light.json');
    if (res.ok) return await res.json();
  } catch {
    // Hors ligne : manifeste inaccessible
  }
  return null;
}

function getDriveManifest(): Promise<DriveCatalogManifest | null> {
  manifestPromise ??= fetchDriveManifest();
  return manifestPromise;
}

async function fetchDriveFragment(folder: string): Promise<any[] | null> {
  const file = `${folder.replaceAll('/', '__')}.json`;
  try {
    const res = await fetch(`/drive-fragments/${encodeURIComponent(file)}`);
    if (res.ok) return await res.json();
  } catch {
    // Repli en ligne
  }
  try {
    const res = await fetch(`https://raw.githubusercontent.com/LordMadTrix/grimoire/main/public/drive-fragments/${encodeURIComponent(file)}`);
    if (res.ok) return await res.json();
  } catch {
    // Fragment inaccessible
  }
  return null;
}

// Les dossiers stamps pèsent ~83 % des octets du catalogue : on ne les télécharge
// qu'à la première visite d'un dossier tampon ou à la première recherche.
const DEFERRED_PREFIX = 'stamps';
const isDeferredFolder = (folder: string) =>
  folder === DEFERRED_PREFIX || folder.startsWith(`${DEFERRED_PREFIX}/`);

/**
 * Complète l'arbre avec des nœuds factices pour les dossiers non encore téléchargés,
 * à partir des compteurs du manifeste : l'interface affiche les vrais totaux (badges,
 * raccourcis, arborescence) sans avoir payé les mégaoctets correspondants.
 */
function applyManifestPlaceholders(data: CelestialData, manifest: DriveCatalogManifest): void {
  const root = data.tree;
  const pending = data.pendingFolders ?? [];
  data.manifestTotal = manifest.totalFiles;
  root.totalFiles = manifest.totalFiles;
  if (!pending.length) return;

  // Cumul des compteurs à chaque niveau : « stamps » reçoit la somme de ses enfants.
  const perPrefix = new Map<string, number>();
  for (const folder of pending) {
    const count = manifest.folders[folder] ?? 0;
    const parts = folder.split('/');
    for (let i = 1; i <= parts.length; i++) {
      const key = parts.slice(0, i).join('/');
      perPrefix.set(key, (perPrefix.get(key) ?? 0) + count);
    }
  }

  // Parents avant enfants pour ne jamais incrémenter un nœud pas encore créé.
  // On n'incrémente que la FEUILLE : perPrefix porte déjà un total agrégé pour chaque niveau.
  const keys = [...perPrefix.keys()].sort((a, b) => a.split('/').length - b.split('/').length);
  for (const key of keys) {
    const count = perPrefix.get(key) ?? 0;
    const parts = key.split('/');
    let curr = root;
    let acc = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      acc = acc ? `${acc}/${part}` : part;
      if (!curr.subfolders[part]) {
        curr.subfolders[part] = {
          name: part === 'stamps' || part === 'tokens' ? '🎨 Tampons & Tokens' : part,
          path: acc,
          subfolders: {},
          files: [],
          totalFiles: 0,
          destination: 'tokens'
        };
      }
      curr = curr.subfolders[part];
      if (i === parts.length - 1) curr.totalFiles += count;
    }
  }
}

/**
 * Reconstitue le catalogue : fragments « essentiels » d'abord (≈710 ko au lieu de
 * 4,36 Mo), puis les dossiers différés si `includeDeferred`.
 * Met en cache mémoire + IndexedDB et notifie les listeners.
 */
async function getFullCatalog(includeDeferred = false): Promise<CelestialData> {
  const manifest = await getDriveManifest();
  if (!manifest) throw new Error('Impossible de charger le manifeste du catalogue Drive');

  const folders = Object.keys(manifest.folders);
  const deferred = folders.filter(isDeferredFolder);
  const eager = includeDeferred ? folders : folders.filter((f) => !isDeferredFolder(f));

  const results = await Promise.all(eager.map(async folder => ({ folder, rows: await fetchDriveFragment(folder) })));
  const failed = results.filter(r => !r.rows);
  if (failed.length) {
    throw new Error(`Fragments de catalogue inaccessibles : ${failed.map(f => f.folder).join(', ')}`);
  }

  const rows = results.flatMap(r => r.rows!);
  const result = parseJsonToCelestialData({ files: rows, updated: manifest.updated });
  result.pendingFolders = includeDeferred ? [] : deferred;
  applyManifestPlaceholders(result, manifest);

  memoryCache = result;
  await saveToIndexedDB(result);
  notifyListeners(result, 0);

  return result;
}

let deferredLoad: Promise<void> | null = null;

/**
 * Télécharge les dossiers différés (stamps/*) si nécessaire. Appelé à la première
 * visite d'un dossier tampon ou à la première recherche. Sans effet si tout est déjà
 * chargé ; les appels simultanés partagent la même requête.
 */
export function ensureCelestialFolders(prefixes: string[] = [DEFERRED_PREFIX]): Promise<void> {
  const current = memoryCache;
  const pending = current?.pendingFolders ?? [];
  const wanted = pending.filter((f) => prefixes.some((p) => f === p || f.startsWith(`${p}/`)));
  if (!wanted.length) return Promise.resolve();
  if (deferredLoad) return deferredLoad;

  deferredLoad = (async () => {
    try {
      const manifest = await getDriveManifest();
      const base = memoryCache;
      if (!manifest || !base) return;

      const results = await Promise.all(wanted.map(async folder => ({ folder, rows: await fetchDriveFragment(folder) })));
      const loaded = results.filter(r => r.rows);
      if (!loaded.length) return; // on garde le dossier en attente pour un prochain essai

      const parsed = parseJsonToCelestialData({
        files: loaded.flatMap(r => r.rows!),
        updated: base.updatedAt
      });
      const files = [...base.files, ...parsed.files];
      const merged: CelestialData = {
        files,
        tree: buildCelestialTree(files),
        totalFiles: files.length,
        updatedAt: base.updatedAt,
        manifestTotal: base.manifestTotal,
        pendingFolders: (base.pendingFolders ?? []).filter(f => !wanted.includes(f))
      };
      applyManifestPlaceholders(merged, manifest);

      memoryCache = merged;
      await saveToIndexedDB(merged);
      notifyListeners(merged, 0);
    } finally {
      deferredLoad = null;
    }
  })();

  return deferredLoad;
}

async function fetchFreshCatalog(): Promise<CelestialData> {
  // 1re tentative : fragments à la demande (léger au démarrage)
  try {
    return await getFullCatalog();
  } catch (e) {
    console.warn('Fragments indisponibles, repli sur le catalogue complet...', e);
  }

  // 2e tentative : catalogue complet local (compatibilité / mode dégradé)
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

    // Premier démarrage (aucun cache) : le catalogue sera téléchargé à la première
    // ouverture de la bibliothèque. Pas de raison de payer les fragments ici.
    if (!current || !current.totalFiles) {
      return { updated: false, newFiles: 0, total: 0 };
    }

    // Manifeste léger (≈400 o) : total + date au lieu des 4,4 Mo du catalogue
    const manifest = await getDriveManifest();
    if (!manifest) {
      return { updated: false, newFiles: 0, total: current.totalFiles };
    }
    const remoteTotal = manifest.totalFiles;
    const remoteUpdated = manifest.updated;
    const currentTotal = current.totalFiles;
    // Un cache partiel (stamps différés) contient moins de fichiers que le manifeste :
    // c'est manifestTotal, pas totalFiles, qu'il faut comparer pour ne pas re-télécharger à chaque démarrage.
    const currentManifestTotal = current.manifestTotal ?? currentTotal;
    const currentUpdated = current.updatedAt || '';

    // Si nouveau total ou date de mise à jour différente
    if (remoteTotal !== currentManifestTotal || remoteUpdated !== currentUpdated) {
      console.log(`✨ Nouveautés détectées dans les Archives Célestes (${currentManifestTotal} -> ${remoteTotal} fichiers)`);
      // Une mise à jour est annoncée : on télécharge tout, y compris les dossiers différés.
      const newData = await getFullCatalog(true);

      const diff = Math.max(0, (newData.manifestTotal ?? newData.totalFiles) - currentManifestTotal);
      notifyListeners(newData, diff);

      return {
        updated: true,
        newFiles: diff,
        total: newData.manifestTotal ?? newData.totalFiles
      };
    }

    return { updated: false, newFiles: 0, total: currentManifestTotal };
  } catch (e) {
    console.warn('Vérification des nouveautés du catalogue ignorée:', e);
    return { updated: false, newFiles: 0, total: memoryCache?.totalFiles || 0 };
  }
}
