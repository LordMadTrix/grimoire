<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { onMount, onDestroy } from 'svelte';

  const { onclose } = $props<{ onclose: () => void }>();

  // ── Types ──────────────────────────────────────────────────────────────────

  interface AddonManifest {
    id: string;
    name: string;
    version: string;
    category: string;
    description: string;
    author: string;
    thumbnail?: string;
    download_url: string;
    size_bytes?: number;
    file_count?: number;
    destination: string;
    tags?: string[];
  }

  interface InstalledAddon {
    id: string;
    name: string;
    version: string;
    installed_at: string;
    destination: string;
    files: string[];
  }

  interface ProgressEvent {
    addon_id: string;
    done: number;
    total: number;
    file: string;
  }

  // ── State ──────────────────────────────────────────────────────────────────

  const DEFAULT_CATALOG_URL = 'https://raw.githubusercontent.com/LordMadTrix/grimoire/main/public/addons-catalog.json';

  let catalogUrl = $state(localStorage.getItem('grimoire_addon_catalog_url') ?? DEFAULT_CATALOG_URL);
  let catalog = $state<AddonManifest[]>([]);
  let installed = $state<InstalledAddon[]>([]);
  let loading = $state(false);
  let error = $state('');
  let activeCategory = $state('all');
  let searchQuery = $state('');
  let activeTab = $state<'store' | 'installed'>('store');
  let progress = $state<Record<string, number>>({});   // addon_id → %
  let installing = $state<Set<string>>(new Set());
  let uninstalling = $state<Set<string>>(new Set());
  let unlisten: (() => void) | null = null;

  const categories = [
    { id: 'all',    label: 'Tous' },
    { id: 'maps',   label: '🗺 Cartes' },
    { id: 'tokens', label: '🧙 Jetons' },
    { id: 'tiles',  label: '🧱 Tuiles' },
    { id: 'other',  label: '📦 Autre' },
  ];

  // ── Helpers ────────────────────────────────────────────────────────────────

  function fmtSize(bytes?: number): string {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  function isInstalled(id: string): InstalledAddon | undefined {
    return installed.find(a => a.id === id);
  }

  const filtered = $derived(catalog.filter(a => {
    if (activeCategory !== 'all' && a.category !== activeCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return a.name.toLowerCase().includes(q)
        || a.description.toLowerCase().includes(q)
        || (a.tags ?? []).some(t => t.toLowerCase().includes(q));
    }
    return true;
  }));

  // ── Actions ────────────────────────────────────────────────────────────────

  async function loadCatalog() {
    loading = true;
    error = '';
    try {
      catalog = await invoke<AddonManifest[]>('addon_fetch_catalog', { catalogUrl });
      localStorage.setItem('grimoire_addon_catalog_url', catalogUrl);
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  }

  async function loadInstalled() {
    try {
      installed = await invoke<InstalledAddon[]>('addon_list_installed');
    } catch {
      installed = [];
    }
  }

  async function install(addon: AddonManifest) {
    installing = new Set([...installing, addon.id]);
    progress = { ...progress, [addon.id]: 0 };
    try {
      const result = await invoke<InstalledAddon>('addon_install', { addon });
      installed = [...installed, result];
    } catch (e) {
      alert(`Erreur installation : ${e}`);
    } finally {
      installing = new Set([...installing].filter(id => id !== addon.id));
      const { [addon.id]: _, ...rest } = progress;
      progress = rest;
    }
  }

  async function uninstall(addonId: string) {
    if (!confirm('Désinstaller cet addon et supprimer ses fichiers ?')) return;
    uninstalling = new Set([...uninstalling, addonId]);
    try {
      await invoke('addon_uninstall', { addonId });
      installed = installed.filter(a => a.id !== addonId);
    } catch (e) {
      alert(`Erreur désinstallation : ${e}`);
    } finally {
      uninstalling = new Set([...uninstalling].filter(id => id !== addonId));
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  onMount(async () => {
    await Promise.all([loadCatalog(), loadInstalled()]);

    unlisten = await listen<ProgressEvent>('addon://progress', ({ payload }) => {
      const pct = Math.round((payload.done / payload.total) * 100);
      progress = { ...progress, [payload.addon_id]: pct };
    });
  });

  onDestroy(() => unlisten?.());
</script>

<!-- ─────────────────────────────────────────────────────────────────────── -->
<!-- Modal overlay                                                           -->
<!-- ─────────────────────────────────────────────────────────────────────── -->

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="overlay" onclick={(e) => e.target === e.currentTarget && onclose()} role="presentation">
  <div class="modal" role="dialog" aria-modal="true" tabindex="-1">

    <!-- Header -->
    <div class="modal-header">
      <h2>📦 Boutique d'Addons</h2>
      <div class="tabs">
        <button class:active={activeTab === 'store'} onclick={() => activeTab = 'store'}>
          Catalogue
        </button>
        <button class:active={activeTab === 'installed'} onclick={() => activeTab = 'installed'}>
          Installés ({installed.length})
        </button>
      </div>
      <button class="close-btn" onclick={onclose}>✕</button>
    </div>

    <!-- Catalog tab -->
    {#if activeTab === 'store'}
      <div class="toolbar">
        <input
          class="search"
          placeholder="Rechercher un addon…"
          bind:value={searchQuery}
        />
        <input
          class="url-input"
          placeholder="URL du catalogue"
          bind:value={catalogUrl}
          onkeydown={(e) => e.key === 'Enter' && loadCatalog()}
        />
        <button class="btn-reload" onclick={loadCatalog} disabled={loading}>
          {loading ? '⏳' : '↺'}
        </button>
      </div>

      <div class="category-bar">
        {#each categories as cat}
          <button
            class:active={activeCategory === cat.id}
            onclick={() => activeCategory = cat.id}
          >{cat.label}</button>
        {/each}
      </div>

      {#if error}
        <div class="error">
          ⚠️ {error}
          <br /><small>Vérifiez l'URL du catalogue et votre connexion Internet.</small>
        </div>
      {:else if loading}
        <div class="loading">Chargement du catalogue…</div>
      {:else if filtered.length === 0}
        <div class="empty">Aucun addon trouvé.{searchQuery ? ' Essayez un autre terme.' : ''}</div>
      {:else}
        <div class="grid">
          {#each filtered as addon (addon.id)}
            {@const inst = isInstalled(addon.id)}
            {@const isInst = installing.has(addon.id)}
            {@const pct = progress[addon.id]}
            <div class="card" class:installed-card={!!inst}>
              {#if addon.thumbnail}
                <img class="thumb" src={addon.thumbnail} alt={addon.name} loading="lazy" />
              {:else}
                <div class="thumb-placeholder">📦</div>
              {/if}

              <div class="card-body">
                <div class="card-title">{addon.name}</div>
                <div class="card-meta">
                  v{addon.version} · {addon.author}
                  {#if addon.size_bytes}<span class="size"> · {fmtSize(addon.size_bytes)}</span>{/if}
                </div>
                <div class="card-desc">{addon.description}</div>
                {#if addon.tags?.length}
                  <div class="tags">
                    {#each addon.tags as tag}<span class="tag">{tag}</span>{/each}
                  </div>
                {/if}
              </div>

              <div class="card-footer">
                {#if inst}
                  <span class="badge-installed">✓ Installé</span>
                  <button
                    class="btn-uninstall"
                    disabled={uninstalling.has(addon.id)}
                    onclick={() => uninstall(addon.id)}
                  >
                    {uninstalling.has(addon.id) ? '…' : 'Désinstaller'}
                  </button>
                {:else if isInst}
                  <div class="progress-bar">
                    <div class="progress-fill" style="width:{pct ?? 0}%"></div>
                  </div>
                  <span class="pct">{pct ?? 0}%</span>
                {:else}
                  <button class="btn-install" onclick={() => install(addon)}>
                    ⬇ Installer
                    {#if addon.file_count}<small>({addon.file_count} fichiers)</small>{/if}
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}

    <!-- Installed tab -->
    {:else}
      {#if installed.length === 0}
        <div class="empty">Aucun addon installé. Explorez le catalogue !</div>
      {:else}
        <div class="installed-list">
          {#each installed as a (a.id)}
            <div class="installed-row">
              <div>
                <strong>{a.name}</strong>
                <span class="badge-ver">v{a.version}</span>
              </div>
              <div class="inst-meta">
                📁 public/{a.destination}/ · {a.files.length} fichiers
              </div>
              <button
                class="btn-uninstall"
                disabled={uninstalling.has(a.id)}
                onclick={() => uninstall(a.id)}
              >
                {uninstalling.has(a.id) ? '…' : '🗑 Désinstaller'}
              </button>
            </div>
          {/each}
        </div>
      {/if}
    {/if}

  </div>
</div>

<style>
  .overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.65);
    z-index: 1000;
    display: flex; align-items: center; justify-content: center;
  }
  .modal {
    background: var(--color-bg, #1a1a2e);
    border: 1px solid var(--color-border, #444);
    border-radius: 12px;
    width: min(920px, 95vw);
    max-height: 88vh;
    display: flex; flex-direction: column;
    overflow: hidden;
    color: var(--color-text, #e0e0e0);
  }
  .modal-header {
    display: flex; align-items: center; gap: .8rem;
    padding: .8rem 1rem;
    border-bottom: 1px solid var(--color-border, #333);
    background: var(--color-surface, #16213e);
  }
  .modal-header h2 { margin: 0; font-size: 1.1rem; flex: none; }
  .tabs { display: flex; gap: .4rem; flex: 1; }
  .tabs button {
    padding: .3rem .8rem; border-radius: 6px;
    border: 1px solid transparent;
    background: transparent; color: inherit; cursor: pointer;
    font-size: .85rem;
  }
  .tabs button.active {
    background: var(--color-accent, #6c63ff);
    color: #fff;
  }
  .close-btn {
    background: none; border: none; color: inherit;
    font-size: 1.1rem; cursor: pointer; padding: .2rem .4rem;
    border-radius: 4px;
  }
  .close-btn:hover { background: rgba(255,255,255,.1); }

  .toolbar {
    display: flex; gap: .5rem; padding: .8rem 1rem;
    border-bottom: 1px solid var(--color-border, #333);
  }
  .search {
    flex: 1; min-width: 120px;
    padding: .4rem .7rem;
    background: var(--color-surface, #222);
    border: 1px solid var(--color-border, #555);
    border-radius: 6px; color: inherit; font-size: .9rem;
  }
  .url-input {
    flex: 2; min-width: 200px;
    padding: .4rem .7rem;
    background: var(--color-surface, #222);
    border: 1px solid var(--color-border, #555);
    border-radius: 6px; color: inherit; font-size: .8rem;
  }
  .btn-reload {
    padding: .4rem .8rem; border-radius: 6px;
    background: var(--color-surface, #333); border: 1px solid #555;
    color: inherit; cursor: pointer; font-size: 1.1rem;
  }

  .category-bar {
    display: flex; gap: .4rem; padding: .5rem 1rem;
    border-bottom: 1px solid var(--color-border, #333);
    flex-wrap: wrap;
  }
  .category-bar button {
    padding: .25rem .7rem; border-radius: 20px; border: 1px solid #555;
    background: transparent; color: inherit; cursor: pointer; font-size: .8rem;
  }
  .category-bar button.active {
    background: var(--color-accent, #6c63ff); border-color: transparent; color: #fff;
  }

  .loading, .empty, .error {
    padding: 2rem; text-align: center; color: #888;
  }
  .error { color: #e06c75; }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1rem;
    padding: 1rem;
    overflow-y: auto;
    flex: 1;
  }
  .card {
    background: var(--color-surface, #16213e);
    border: 1px solid var(--color-border, #333);
    border-radius: 10px;
    overflow: hidden;
    display: flex; flex-direction: column;
    transition: border-color .15s;
  }
  .card:hover { border-color: var(--color-accent, #6c63ff); }
  .installed-card { border-color: #4caf50; }

  .thumb { width: 100%; height: 130px; object-fit: cover; }
  .thumb-placeholder {
    width: 100%; height: 130px;
    display: flex; align-items: center; justify-content: center;
    font-size: 3rem;
    background: var(--color-bg, #0f0f1a);
  }

  .card-body { padding: .6rem; flex: 1; }
  .card-title { font-weight: 600; font-size: .95rem; margin-bottom: .2rem; }
  .card-meta { font-size: .75rem; color: #888; margin-bottom: .4rem; }
  .card-desc { font-size: .8rem; color: #aaa; line-height: 1.4; }

  .tags { display: flex; flex-wrap: wrap; gap: .3rem; margin-top: .4rem; }
  .tag {
    font-size: .7rem; padding: .1rem .4rem;
    background: rgba(108,99,255,.2); border-radius: 4px;
    color: #a89fff;
  }

  .card-footer {
    padding: .6rem;
    border-top: 1px solid var(--color-border, #333);
    display: flex; align-items: center; gap: .5rem; flex-wrap: wrap;
  }
  .btn-install {
    flex: 1; padding: .4rem; border-radius: 6px;
    background: var(--color-accent, #6c63ff);
    border: none; color: #fff; cursor: pointer; font-size: .85rem;
  }
  .btn-install:hover { filter: brightness(1.15); }
  .btn-uninstall {
    flex: 1; padding: .4rem; border-radius: 6px;
    background: transparent; border: 1px solid #e06c75;
    color: #e06c75; cursor: pointer; font-size: .8rem;
  }
  .btn-uninstall:hover { background: rgba(224,108,117,.15); }
  .badge-installed {
    font-size: .75rem; color: #4caf50; font-weight: 600;
  }

  .progress-bar {
    flex: 1; height: 8px; border-radius: 4px;
    background: #333; overflow: hidden;
  }
  .progress-fill {
    height: 100%; background: var(--color-accent, #6c63ff);
    transition: width .2s;
  }
  .pct { font-size: .75rem; color: #aaa; min-width: 2.5rem; text-align: right; }

  /* Installed list */
  .installed-list {
    padding: 1rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: .6rem;
  }
  .installed-row {
    display: flex; align-items: center; gap: 1rem;
    padding: .7rem 1rem;
    background: var(--color-surface, #16213e);
    border: 1px solid var(--color-border, #333);
    border-radius: 8px;
  }
  .installed-row > div:first-child { flex: 1; }
  .inst-meta { font-size: .8rem; color: #888; }
  .badge-ver {
    font-size: .75rem; padding: .1rem .4rem;
    background: rgba(108,99,255,.2); border-radius: 4px; color: #a89fff;
    margin-left: .4rem;
  }
</style>
