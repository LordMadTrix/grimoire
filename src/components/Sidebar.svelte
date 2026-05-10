<script module lang="ts">
  import type { VaultEntry } from '$lib/api';
  // État partagé entre toutes les instances récursives du composant
  let ctxMenu = $state<{ entry: VaultEntry; x: number; y: number } | null>(null);
</script>

<script lang="ts">
  import Sidebar from './Sidebar.svelte';
  import type { VaultEntry } from '$lib/api';
  import { readFile, writeFile, createDirectory, deleteFile, renameEntry, openVault } from '$lib/api';
  import {
    getVaultPath, getActiveFile, setActiveFile,
    setActiveContent, setIsDirty,
    getExpandedDirs, toggleDir, setVaultTree
  } from '$lib/stores/vault.svelte';

  let { entries = [], depth = 0 }: { entries: VaultEntry[]; depth?: number } = $props();

  // Dossiers en premier, puis fichiers — chacun trié alphabétiquement
  let sorted = $derived(
    [...entries].sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    })
  );

  async function handleFileClick(entry: VaultEntry) {
    if (entry.is_dir) {
      toggleDir(entry.path);
      return;
    }
    if (entry.extension !== 'md') return;

    const vaultPath = getVaultPath();
    if (!vaultPath) return;

    try {
      const content = await readFile(vaultPath, entry.path);
      setActiveFile(entry.path);
      setActiveContent(content);
      setIsDirty(false);
    } catch (err) {
      console.error('Failed to read file:', err);
    }
  }

  function getIcon(entry: VaultEntry): string {
    if (entry.is_dir) {
      return getExpandedDirs().has(entry.path) ? '📂' : '📁';
    }
    const ext = entry.extension?.toLowerCase();
    switch (ext) {
      case 'md': return '📝';
      case 'json': return '⚙️';
      case 'png': case 'jpg': case 'jpeg': case 'webp': case 'avif': return '🖼️';
      case 'mp3': case 'ogg': case 'wav': return '🔊';
      default: return '📄';
    }
  }

  function handleContextMenu(e: MouseEvent, entry: VaultEntry) {
    e.preventDefault();
    e.stopPropagation();
    ctxMenu = { entry, x: e.clientX, y: e.clientY };
  }

  function getParentDir(path: string): string {
    const parts = path.split('/');
    return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
  }

  async function refreshTree() {
    const vp = getVaultPath();
    if (!vp) return;
    const tree = await openVault(vp);
    setVaultTree(tree);
  }

  async function ctxNewFile() {
    if (!ctxMenu) return;
    const dir = ctxMenu.entry.is_dir ? ctxMenu.entry.path : getParentDir(ctxMenu.entry.path);
    const name = window.prompt('Nom du fichier (sans extension) :');
    ctxMenu = null;
    if (!name?.trim()) return;
    const relPath = dir ? `${dir}/${name.trim()}.md` : `${name.trim()}.md`;
    const vp = getVaultPath();
    if (!vp) return;
    const initialContent = `# ${name.trim()}\n\n`;
    try {
      await writeFile(vp, relPath, initialContent);
      await refreshTree();
      setActiveFile(relPath);
      setActiveContent(initialContent);
      setIsDirty(false);
    } catch (err) {
      console.error('Failed to create file:', err);
    }
  }

  async function ctxNewFolder() {
    if (!ctxMenu) return;
    const dir = ctxMenu.entry.is_dir ? ctxMenu.entry.path : getParentDir(ctxMenu.entry.path);
    const name = window.prompt('Nom du dossier :');
    ctxMenu = null;
    if (!name?.trim()) return;
    const relPath = dir ? `${dir}/${name.trim()}` : name.trim();
    const vp = getVaultPath();
    if (!vp) return;
    try {
      await createDirectory(vp, relPath);
      await refreshTree();
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  }

  async function ctxRename() {
    if (!ctxMenu) return;
    const entry = ctxMenu.entry;
    const parts = entry.path.split('/');
    const oldName = parts[parts.length - 1];
    const newName = window.prompt('Nouveau nom :', oldName);
    ctxMenu = null;
    if (!newName?.trim() || newName.trim() === oldName) return;
    const dir = getParentDir(entry.path);
    const newPath = dir ? `${dir}/${newName.trim()}` : newName.trim();
    const vp = getVaultPath();
    if (!vp) return;
    try {
      await renameEntry(vp, entry.path, newPath);
      if (getActiveFile() === entry.path) setActiveFile(newPath);
      await refreshTree();
    } catch (err) {
      console.error('Failed to rename:', err);
    }
  }

  async function ctxDelete() {
    if (!ctxMenu) return;
    const entry = ctxMenu.entry;
    ctxMenu = null;
    if (!window.confirm(`Supprimer "${entry.name}" ? Cette action est irréversible.`)) return;
    const vp = getVaultPath();
    if (!vp) return;
    try {
      await deleteFile(vp, entry.path);
      if (getActiveFile() === entry.path) {
        setActiveFile(null);
        setActiveContent('');
        setIsDirty(false);
      }
      await refreshTree();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }
</script>

<ul class="vault-tree" style="--depth: {depth}">
  {#each sorted as entry}
    {@const isActive = getActiveFile() === entry.path}
    {@const isExpanded = entry.is_dir && getExpandedDirs().has(entry.path)}
    <li>
      <button
        class="tree-item"
        class:active={isActive}
        class:directory={entry.is_dir}
        class:non-editable={!entry.is_dir && entry.extension !== 'md'}
        onclick={() => handleFileClick(entry)}
        oncontextmenu={(e) => handleContextMenu(e, entry)}
        title={entry.path}
      >
        <span class="icon">{getIcon(entry)}</span>
        <span class="name">{entry.name}</span>
        {#if entry.is_dir && entry.children}
          <span class="badge">{entry.children.length}</span>
        {/if}
      </button>

      {#if isExpanded && entry.children}
        <Sidebar entries={entry.children} depth={depth + 1} />
      {/if}
    </li>
  {/each}
</ul>

<!-- Le menu contextuel est rendu une seule fois, à la racine (depth === 0) -->
{#if depth === 0 && ctxMenu}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="ctx-overlay" onclick={() => ctxMenu = null}></div>
  <div
    class="ctx-menu"
    style="left: {Math.min(ctxMenu.x, (typeof window !== 'undefined' ? window.innerWidth : 600) - 190)}px;
           top: {Math.min(ctxMenu.y, (typeof window !== 'undefined' ? window.innerHeight : 400) - 160)}px;"
  >
    <button class="ctx-item" onclick={ctxNewFile}>📄 Nouveau fichier</button>
    <button class="ctx-item" onclick={ctxNewFolder}>📁 Nouveau dossier</button>
    <div class="ctx-sep"></div>
    <button class="ctx-item" onclick={ctxRename}>✏️ Renommer</button>
    {#if !ctxMenu.entry.is_dir}
      <div class="ctx-sep"></div>
      <button class="ctx-item danger" onclick={ctxDelete}>🗑️ Supprimer</button>
    {/if}
  </div>
{/if}

<style>
  .vault-tree {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  li { margin: 0; }

  .tree-item {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 4px 8px 4px calc(var(--depth) * 16px + 8px);
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s ease;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
  }

  .tree-item:hover { background: var(--bg-hover); color: var(--text-primary); }

  .tree-item.active {
    background: var(--accent-bg);
    color: var(--accent);
    font-weight: 600;
  }

  .tree-item.directory { color: var(--text-primary); font-weight: 500; }

  .tree-item.non-editable { opacity: 0.65; cursor: default; }

  .icon { flex-shrink: 0; font-size: 14px; }

  .name { overflow: hidden; text-overflow: ellipsis; }

  .badge {
    margin-left: auto;
    font-size: 10px;
    color: var(--text-muted);
    background: var(--bg-tertiary);
    padding: 0 5px;
    border-radius: 8px;
  }

  /* ── Context menu ──────────────────────────────────────────── */

  .ctx-overlay {
    position: fixed;
    inset: 0;
    z-index: 9000;
  }

  .ctx-menu {
    position: fixed;
    z-index: 9001;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 4px;
    min-width: 180px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    animation: fadeIn 0.1s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to   { opacity: 1; transform: scale(1); }
  }

  .ctx-item {
    display: block;
    width: 100%;
    padding: 7px 12px;
    background: transparent;
    border: none;
    border-radius: 5px;
    color: var(--text-primary);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s;
  }

  .ctx-item:hover { background: var(--bg-hover); }

  .ctx-item.danger { color: var(--error, #f85149); }
  .ctx-item.danger:hover { background: rgba(248, 81, 73, 0.1); }

  .ctx-sep {
    height: 1px;
    background: var(--border);
    margin: 4px 0;
  }
</style>
