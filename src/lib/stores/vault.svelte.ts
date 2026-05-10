import type { VaultEntry } from '$lib/api';

// ── Vault Store (Svelte 5 Runes) ────────────────────────────────

/** Chemin absolu du vault ouvert */
let vaultPath = $state<string>('');

/** Arbre de fichiers du vault */
let vaultTree = $state<VaultEntry[]>([]);

/** Fichier actuellement ouvert dans l'éditeur */
let activeFile = $state<string | null>(null);

/** Contenu du fichier actif */
let activeContent = $state<string>('');

/** Fichier modifié (non sauvegardé) */
let isDirty = $state<boolean>(false);

/** Dossiers ouverts/fermés dans la sidebar */
let expandedDirs = $state<Set<string>>(new Set());

/** Panneau de recherche ouvert */
let searchOpen = $state<boolean>(false);

// ── Exports ──────────────────────────────────────────────────────

export function getVaultPath() { return vaultPath; }
export function setVaultPath(path: string) { vaultPath = path; }

export function getVaultTree() { return vaultTree; }
export function setVaultTree(tree: VaultEntry[]) { vaultTree = tree; }

export function getActiveFile() { return activeFile; }
export function setActiveFile(path: string | null) { activeFile = path; }

export function getActiveContent() { return activeContent; }
export function setActiveContent(content: string) { activeContent = content; }

export function getIsDirty() { return isDirty; }
export function setIsDirty(dirty: boolean) { isDirty = dirty; }

export function getExpandedDirs() { return expandedDirs; }
export function toggleDir(path: string) {
  const dirs = new Set(expandedDirs);
  if (dirs.has(path)) {
    dirs.delete(path);
  } else {
    dirs.add(path);
  }
  expandedDirs = dirs;
}

export function getSearchOpen() { return searchOpen; }
export function setSearchOpen(open: boolean) { searchOpen = open; }
