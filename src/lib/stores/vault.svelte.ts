import type { VaultEntry } from '$lib/api';

// ── Vault Store (Svelte 5 Runes) ────────────────────────────────

let vaultPath = $state<string>('');
let vaultTree = $state<VaultEntry[]>([]);
let activeFile = $state<string | null>(null);
let activeContent = $state<string>('');
let isDirty = $state<boolean>(false);
let expandedDirs = $state<Set<string>>(new Set());
let searchOpen = $state<boolean>(false);

// ── Fichiers récents (persist localStorage) ───────────────────────
function loadLS<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; }
}
let recentFiles = $state<string[]>(loadLS('grimoire_recents', []));
let starredFiles = $state<string[]>(loadLS('grimoire_starred', []));
let tagsCache = $state<Record<string, string[]>>({});

function extractTags(content: string): string[] {
  if (!content.startsWith('---\n')) return [];
  const end = content.indexOf('\n---', 4);
  if (end === -1) return [];
  const fm = content.slice(4, end);
  const tagsLine = fm.split('\n').find(l => l.startsWith('tags:'));
  if (!tagsLine) return [];
  const m = tagsLine.match(/tags:\s*\[([^\]]*)\]/);
  if (m) return m[1].split(',').map(t => t.trim().replace(/['"]/g, '')).filter(Boolean);
  return [];
}

// ── Exports ──────────────────────────────────────────────────────

export function getVaultPath() { return vaultPath; }
export function setVaultPath(path: string) { vaultPath = path; }

export function getVaultTree() { return vaultTree; }
export function setVaultTree(tree: VaultEntry[]) { vaultTree = tree; }

export function getActiveFile() { return activeFile; }
export function setActiveFile(path: string | null) {
  activeFile = path;
  if (path) {
    recentFiles = [path, ...recentFiles.filter(p => p !== path)].slice(0, 10);
    localStorage.setItem('grimoire_recents', JSON.stringify(recentFiles));
  }
}

export function getActiveContent() { return activeContent; }
export function setActiveContent(content: string) {
  activeContent = content;
  if (activeFile) {
    const tags = extractTags(content);
    tagsCache = { ...tagsCache, [activeFile]: tags };
  }
}

export function getTagsForFile(path: string): string[] { return tagsCache[path] ?? []; }
export function getAllTags(): string[] {
  const tags = new Set<string>();
  Object.values(tagsCache).forEach(fileTags => fileTags.forEach(t => tags.add(t)));
  return [...tags].sort();
}
export function getFilesByTag(tag: string): string[] {
  return Object.entries(tagsCache).filter(([, tags]) => tags.includes(tag)).map(([path]) => path);
}

export function getIsDirty() { return isDirty; }
export function setIsDirty(dirty: boolean) { isDirty = dirty; }

export function getExpandedDirs() { return expandedDirs; }
export function toggleDir(path: string) {
  const dirs = new Set(expandedDirs);
  if (dirs.has(path)) dirs.delete(path); else dirs.add(path);
  expandedDirs = dirs;
}
export function expandDir(path: string) {
  expandedDirs = new Set([...expandedDirs, path]);
}
export function collapseAllDirs() { expandedDirs = new Set(); }

export function getSearchOpen() { return searchOpen; }
export function setSearchOpen(open: boolean) { searchOpen = open; }

// ── Fichiers récents ──────────────────────────────────────────────
export function getRecentFiles() { return recentFiles; }
export function clearRecentFiles() {
  recentFiles = [];
  localStorage.removeItem('grimoire_recents');
}

// ── Favoris ───────────────────────────────────────────────────────
export function getStarredFiles() { return starredFiles; }
export function isStarred(path: string) { return starredFiles.includes(path); }
export function toggleStarred(path: string) {
  if (starredFiles.includes(path)) {
    starredFiles = starredFiles.filter(p => p !== path);
  } else {
    starredFiles = [path, ...starredFiles];
  }
  localStorage.setItem('grimoire_starred', JSON.stringify(starredFiles));
}

// ── Statistiques vault ────────────────────────────────────────────
export function getVaultStats() {
  let noteCount = 0; let assetCount = 0;
  function walk(entries: VaultEntry[]) {
    for (const e of entries) {
      if (e.is_dir && e.children) { walk(e.children); continue; }
      if (e.extension === 'md') noteCount++;
      else assetCount++;
    }
  }
  walk(vaultTree);
  return { noteCount, assetCount };
}
