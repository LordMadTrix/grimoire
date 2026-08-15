<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { open } from '@tauri-apps/plugin-dialog';
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
  const COMMUNITY_DRIVE_URL = 'https://drive.google.com/drive/folders/16ZM0lg66rgFdsQ9kmFoA2pQZ2a0mciF3?usp=drive_link';

  let catalogUrl = $state(localStorage.getItem('grimoire_addon_catalog_url') ?? DEFAULT_CATALOG_URL);
  let catalog = $state<AddonManifest[]>([]);
  let installed = $state<InstalledAddon[]>([]);
  let loading = $state(false);
  let error = $state('');
  let activeCategory = $state('all');
  let searchQuery = $state('');
  let activeTab = $state<'store' | 'installed' | 'admin'>('store');
  let progress = $state<Record<string, number>>({});   // addon_id → %
  let installing = $state<Set<string>>(new Set());
  let uninstalling = $state<Set<string>>(new Set());
  let unlisten: (() => void) | null = null;

  // Local import dialog state
  let showLocalImportModal = $state(false);
  let localFilePath = $state('');
  let localPackName = $state('');
  let localDestination = $state('maps');
  let localImporting = $state(false);

  // Admin form state
  let newAddon = $state<AddonManifest>({
    id: '',
    name: '',
    version: '1.0.0',
    category: 'maps',
    description: '',
    author: 'LordMadTrix',
    thumbnail: '',
    download_url: '',
    size_bytes: 10485760,
    file_count: 5,
    destination: 'maps',
    tags: []
  });
  let newTagInput = $state('');

  function convertGoogleDriveUrl(url: string): string {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/uc?export=download&id=${match[1]}`;
    }
    return url;
  }

  function handleAddTag() {
    if (!newTagInput.trim()) return;
    if (!newAddon.tags) newAddon.tags = [];
    newAddon.tags.push(newTagInput.trim());
    newAddon.tags = [...newAddon.tags];
    newTagInput = '';
  }

  function handleRemoveTag(idx: number) {
    if (!newAddon.tags) return;
    newAddon.tags.splice(idx, 1);
    newAddon.tags = [...newAddon.tags];
  }

  function handleAddCustomAddon() {
    if (!newAddon.name.trim() || !newAddon.download_url.trim()) {
      alert('Veuillez renseigner au moins le titre et l\'URL de téléchargement.');
      return;
    }
    if (!newAddon.id.trim()) {
      newAddon.id = newAddon.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
    }
    newAddon.download_url = convertGoogleDriveUrl(newAddon.download_url);
    catalog = [newAddon, ...catalog];
    alert('✅ Pack ajouté au catalogue local avec succès !');
    activeTab = 'store';
  }

  function copyCatalogJson() {
    const exportData = {
      version: '1.1',
      community_drive_url: COMMUNITY_DRIVE_URL,
      addons: catalog
    };
    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    alert('📋 JSON du catalogue copié dans le presse-papiers ! Vous pouvez le coller sur GitHub.');
  }

  function openExternal(url: string) {
    invoke('open_url', { url }).catch(() => {
      window.open(url, '_blank');
    });
  }

  const categories = [
    { id: 'all',    label: '✨ Tous' },
    { id: 'maps',   label: '🗺️ Cartes' },
    { id: 'tokens', label: '🧙 Jetons' },
    { id: 'tiles',  label: '🧱 Tuiles' },
    { id: 'other',  label: '📦 Autre & Audio' },
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
      installed = [...installed.filter(i => i.id !== result.id), result];
    } catch (e) {
      alert(`⚠️ Erreur d'installation :\n\n${e}\n\n💡 Astuce : Téléchargez le pack directement depuis le Google Drive et importez-le avec le bouton "Importer un pack ZIP local".`);
    } finally {
      installing = new Set([...installing].filter(id => id !== addon.id));
      const { [addon.id]: _, ...rest } = progress;
      progress = rest;
    }
  }

  async function uninstall(addonId: string) {
    if (!confirm('Désinstaller cet addon et supprimer ses fichiers du dossier public ?')) return;
    uninstalling = new Set([...uninstalling, addonId]);
    try {
      await invoke('addon_uninstall', { addonId });
      installed = installed.filter(a => a.id !== addonId);
    } catch (e) {
      alert(`Erreur de désinstallation : ${e}`);
    } finally {
      uninstalling = new Set([...uninstalling].filter(id => id !== addonId));
    }
  }

  async function pickAndImportLocalZip() {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{
          name: 'Archives Packs Grimoire',
          extensions: ['zip', 'grimoirepack']
        }]
      });

      if (!selected || typeof selected !== 'string') return;

      localFilePath = selected;
      const fileName = selected.split(/[\\/]/).pop() || '';
      localPackName = fileName.replace(/\.(zip|grimoirepack)$/i, '').replace(/[-_]/g, ' ');

      // Deviner la destination d'après le nom
      const lower = fileName.toLowerCase();
      if (lower.includes('token') || lower.includes('figurine') || lower.includes('pnj') || lower.includes('monstre')) {
        localDestination = 'tokens';
      } else if (lower.includes('audio') || lower.includes('son') || lower.includes('music')) {
        localDestination = 'audio';
      } else if (lower.includes('tuile') || lower.includes('tile')) {
        localDestination = 'tiles/custom';
      } else if (lower.includes('scenario') || lower.includes('aventure') || lower.includes('module')) {
        localDestination = 'scenarios';
      } else {
        localDestination = 'maps';
      }

      showLocalImportModal = true;
    } catch (e) {
      alert(`Erreur sélection fichier : ${e}`);
    }
  }

  async function confirmLocalImport() {
    if (!localFilePath) return;
    localImporting = true;
    try {
      const result = await invoke<InstalledAddon>('addon_install_local_file', {
        filePath: localFilePath,
        destination: localDestination,
        name: localPackName.trim() || undefined
      });
      installed = [...installed.filter(i => i.id !== result.id), result];
      showLocalImportModal = false;
      alert(`✅ Pack "${result.name}" importé et installé avec succès dans public/${result.destination}/ (${result.files.length} fichiers) !`);
      activeTab = 'installed';
    } catch (e) {
      alert(`Erreur d'importation locale : ${e}`);
    } finally {
      localImporting = false;
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
      <div class="modal-title-wrap">
        <h2>📦 Boutique & Catalogue Communautaire</h2>
        <span class="catalog-status">Grimoire vWFRP</span>
      </div>
      <div class="tabs">
        <button class:active={activeTab === 'store'} onclick={() => activeTab = 'store'}>
          🛒 Catalogue ({catalog.length})
        </button>
        <button class:active={activeTab === 'installed'} onclick={() => activeTab = 'installed'}>
          💾 Installés ({installed.length})
        </button>
        <button class:active={activeTab === 'admin'} onclick={() => activeTab = 'admin'}>
          🛠️ Administration
        </button>
      </div>
      <button class="close-btn" onclick={onclose} title="Fermer">✕</button>
    </div>

    <!-- Tab 1: Store / Catalog -->
    {#if activeTab === 'store'}
      <div class="tab-content">
        <!-- Community Banner Bar -->
        <div class="drive-banner-bar">
          <div class="banner-text">
            <span>🌟 <strong>Packs & Ressources Communautaires Grimoire</strong></span>
            <small>Téléchargez en 1 clic ou déposez vos propres archives ZIP / .grimoirepack</small>
          </div>
          <div class="banner-actions">
            <button class="btn-drive-link" onclick={() => openExternal(COMMUNITY_DRIVE_URL)}>
              📂 Google Drive Partagé ↗
            </button>
            <button class="btn-import-zip" onclick={pickAndImportLocalZip}>
              📥 Importer un pack ZIP local…
            </button>
          </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="toolbar">
          <div class="search-wrap">
            <span class="search-icon">🔍</span>
            <input
              class="search"
              placeholder="Rechercher cartes, monstres, audio, tokens…"
              bind:value={searchQuery}
            />
            {#if searchQuery}
              <button class="clear-search" onclick={() => searchQuery = ''}>✕</button>
            {/if}
          </div>

          <div class="category-bar">
            {#each categories as cat}
              <button
                class:active={activeCategory === cat.id}
                onclick={() => activeCategory = cat.id}
              >{cat.label}</button>
            {/each}
          </div>

          <button class="btn-reload" onclick={loadCatalog} disabled={loading} title="Recharger le catalogue distant">
            {loading ? '⏳' : '↺'}
          </button>
        </div>

        <!-- Catalog Grid / Content -->
        <div class="grid-container">
          {#if error}
            <div class="error-box">
              <div class="error-title">⚠️ Impossible de charger le catalogue distant</div>
              <div class="error-msg">{error}</div>
              <div class="error-actions">
                <button class="btn-retry" onclick={loadCatalog}>Réessayer</button>
                <button class="btn-drive-link" onclick={() => openExternal(COMMUNITY_DRIVE_URL)}>Accéder au Google Drive</button>
                <button class="btn-import-zip" onclick={pickAndImportLocalZip}>Importer un fichier ZIP local</button>
              </div>
            </div>
          {:else if loading}
            <div class="loading-box">
              <div class="spinner"></div>
              <span>Chargement des packs communautaires…</span>
            </div>
          {:else if filtered.length === 0}
            <div class="empty-box">
              <div style="font-size: 2.5rem; margin-bottom: 0.5rem">🔍</div>
              <div>Aucun pack ne correspond à votre recherche.</div>
              <button class="btn-reset" onclick={() => { searchQuery = ''; activeCategory = 'all'; }}>
                Réinitialiser les filtres
              </button>
            </div>
          {:else}
            <div class="grid">
              {#each filtered as addon (addon.id)}
                {@const inst = isInstalled(addon.id)}
                {@const isInst = installing.has(addon.id)}
                {@const pct = progress[addon.id]}
                <div class="card" class:installed-card={!!inst}>
                  <!-- Thumbnail -->
                  <div class="card-thumb-wrap">
                    {#if addon.thumbnail}
                      <img class="thumb" src={addon.thumbnail} alt={addon.name} loading="lazy" />
                    {:else}
                      <div class="thumb-placeholder">
                        {#if addon.category === 'maps'}🗺️
                        {:else if addon.category === 'tokens'}🧙
                        {:else if addon.category === 'tiles'}🧱
                        {:else if addon.destination === 'audio'}🎵
                        {:else}📦{/if}
                      </div>
                    {/if}
                    <div class="card-badge-dest">{addon.destination}</div>
                  </div>

                  <!-- Body -->
                  <div class="card-body">
                    <div class="card-title">{addon.name}</div>
                    <div class="card-meta">
                      <span>v{addon.version}</span>
                      <span>·</span>
                      <span>{addon.author}</span>
                      {#if addon.size_bytes}
                        <span>·</span>
                        <span class="size-tag">{fmtSize(addon.size_bytes)}</span>
                      {/if}
                    </div>
                    <div class="card-desc">{addon.description}</div>
                    {#if addon.tags?.length}
                      <div class="tags">
                        {#each addon.tags as tag}<span class="tag">{tag}</span>{/each}
                      </div>
                    {/if}
                  </div>

                  <!-- Footer Actions -->
                  <div class="card-footer">
                    {#if inst}
                      <div class="inst-info">
                        <span class="badge-installed">✓ Installé</span>
                        <span class="files-count">{inst.files.length} fichiers</span>
                      </div>
                      <button
                        class="btn-uninstall"
                        disabled={uninstalling.has(addon.id)}
                        onclick={() => uninstall(addon.id)}
                        title="Désinstaller et supprimer les fichiers"
                      >
                        {uninstalling.has(addon.id) ? '…' : '🗑️ Désinstaller'}
                      </button>
                    {:else if isInst}
                      <div class="progress-wrap">
                        <div class="progress-bar">
                          <div class="progress-fill" style="width:{pct ?? 0}%"></div>
                        </div>
                        <span class="pct">{pct ?? 0}%</span>
                      </div>
                    {:else}
                      <button class="btn-install" onclick={() => install(addon)}>
                        ⬇️ Installer en 1 Clic
                        {#if addon.file_count}<small>({addon.file_count} f.)</small>{/if}
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

    <!-- Tab 2: Installed -->
    {:else if activeTab === 'installed'}
      <div class="tab-content">
        <div class="installed-header">
          <div class="inst-header-text">
            <h3>Packs installés ({installed.length})</h3>
            <p>Ces packs sont déployés et utilisables dans vos aventures Grimoire.</p>
          </div>
          <button class="btn-import-zip" onclick={pickAndImportLocalZip}>
            📥 Importer un autre pack ZIP…
          </button>
        </div>

        <div class="installed-list-wrap">
          {#if installed.length === 0}
            <div class="empty-box">
              <div style="font-size: 2.5rem; margin-bottom: 0.5rem">📦</div>
              <div>Aucun pack n'est encore installé.</div>
              <p style="font-size: 0.85rem; color: #8899b7">Explorez le catalogue pour enrichir votre Grimoire en cartes, jetons et ambiances !</p>
              <button class="btn-primary" onclick={() => activeTab = 'store'}>
                🛒 Parcourir le Catalogue
              </button>
            </div>
          {:else}
            <div class="installed-list">
              {#each installed as a (a.id)}
                <div class="installed-row">
                  <div class="inst-icon">
                    {#if a.destination === 'maps'}🗺️
                    {:else if a.destination === 'tokens'}🧙
                    {:else if a.destination === 'audio'}🎵
                    {:else}📦{/if}
                  </div>
                  <div class="inst-details">
                    <div class="inst-title-line">
                      <strong>{a.name}</strong>
                      <span class="badge-ver">v{a.version}</span>
                    </div>
                    <div class="inst-meta">
                      📁 public/{a.destination}/ · {a.files.length} fichiers installés
                    </div>
                  </div>
                  <button
                    class="btn-uninstall"
                    disabled={uninstalling.has(a.id)}
                    onclick={() => uninstall(a.id)}
                  >
                    {uninstalling.has(a.id) ? 'Suppression…' : '🗑️ Désinstaller'}
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

    <!-- Tab 3: Admin / Publisher -->
    {:else}
      <div class="tab-content">
        <div class="admin-panel">
          <div class="admin-header-box">
            <div>
              <h3 style="color:#e5a853;margin-bottom:4px">🛠️ Administration : Créer & Publier des Packs</h3>
              <p style="font-size:12px;color:#8899b7">
                Générez des fiches d'addons pour le catalogue GitHub ou convertissez directement vos liens de partage Google Drive.
              </p>
            </div>
            <button class="btn-export-json" onclick={copyCatalogJson}>
              📋 Copier JSON pour GitHub
            </button>
          </div>

          <!-- svelte-ignore a11y_label_has_associated_control -->
          <div class="admin-form-grid">
            <div class="form-group">
              <label class="form-label">Titre du Pack *</label>
              <input class="form-input" bind:value={newAddon.name} placeholder="Ex: 🗺️ Pack Donjons d'Altdorf" />
            </div>

            <div class="form-group">
              <label class="form-label">Identifiant Unique (ID)</label>
              <input class="form-input" bind:value={newAddon.id} placeholder="Généré automatiquement si vide" />
            </div>

            <div class="form-group">
              <label class="form-label">Catégorie</label>
              <select class="form-select" bind:value={newAddon.category}>
                <option value="maps">🗺️ Cartes & Plans</option>
                <option value="tokens">🧙 Figurines & Monstres</option>
                <option value="tiles">🧱 Tuiles de Donjon</option>
                <option value="other">📦 Audio / Aventures / Autre</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Dossier de Destination</label>
              <select class="form-select" bind:value={newAddon.destination}>
                <option value="maps">public/maps (Cartes VTT)</option>
                <option value="tokens">public/tokens (Tokens & PNJ)</option>
                <option value="tiles/custom">public/tiles/custom (Tuiles)</option>
                <option value="audio">public/audio (Pistes sonores)</option>
                <option value="scenarios">public/scenarios (Aventures)</option>
              </select>
            </div>

            <div class="form-group" style="grid-column: 1 / -1">
              <label class="form-label">URL de Téléchargement ZIP ou .grimoirepack *</label>
              <div style="display:flex;gap:6px">
                <input class="form-input" style="flex:1" bind:value={newAddon.download_url} placeholder="Lien direct ZIP ou lien de partage Google Drive" />
                <button class="btn-convert-gdrive" onclick={() => newAddon.download_url = convertGoogleDriveUrl(newAddon.download_url)}>
                  🔗 Convertir Google Drive
                </button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Auteur</label>
              <input class="form-input" bind:value={newAddon.author} placeholder="Ex: LordMadTrix" />
            </div>

            <div class="form-group">
              <label class="form-label">Version</label>
              <input class="form-input" bind:value={newAddon.version} placeholder="1.0.0" />
            </div>

            <div class="form-group" style="grid-column: 1 / -1">
              <label class="form-label">URL de la Miniature (Optionnel)</label>
              <input class="form-input" bind:value={newAddon.thumbnail} placeholder="https://.../preview.jpg" />
            </div>

            <div class="form-group" style="grid-column: 1 / -1">
              <label class="form-label">Description détaillée</label>
              <textarea class="form-textarea" bind:value={newAddon.description} rows="3" placeholder="Contenu du pack, crédits, compatibilité..."></textarea>
            </div>

            <div class="form-group" style="grid-column: 1 / -1">
              <label class="form-label">Tags & Mots-clés</label>
              <div style="display:flex;gap:6px">
                <input class="form-input" style="flex:1" bind:value={newTagInput} placeholder="Ajouter un tag..." onkeydown={e => e.key === 'Enter' && handleAddTag()} />
                <button class="btn-add-tag" onclick={handleAddTag}>+ Ajouter</button>
              </div>
              <div class="tags" style="margin-top:6px">
                {#each newAddon.tags ?? [] as tag, i}
                  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                  <span class="tag" style="cursor:pointer" onclick={() => handleRemoveTag(i)}>
                    {tag} ✕
                  </span>
                {/each}
              </div>
            </div>
          </div>

          <div class="admin-actions">
            <button class="btn-submit-addon" onclick={handleAddCustomAddon}>
              ➕ Ajouter ce Pack au Catalogue Local
            </button>
          </div>
        </div>
      </div>
    {/if}

  </div>
</div>

<!-- Modal Local Import Confirmation -->
{#if showLocalImportModal}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="sub-overlay" onclick={(e) => e.target === e.currentTarget && !localImporting && (showLocalImportModal = false)} role="presentation">
    <div class="sub-modal">
      <div class="sub-modal-header">
        <h3>📥 Importer une archive locale</h3>
        <button class="close-btn" disabled={localImporting} onclick={() => showLocalImportModal = false}>✕</button>
      </div>

      <div class="sub-modal-body">
        <div class="form-group">
          <label class="form-label">Fichier sélectionné</label>
          <div class="path-preview" title={localFilePath}>{localFilePath}</div>
        </div>

        <div class="form-group">
          <label class="form-label">Nom du Pack</label>
          <input class="form-input" bind:value={localPackName} placeholder="Nom du pack" />
        </div>

        <div class="form-group">
          <label class="form-label">Dossier de destination Grimoire</label>
          <select class="form-select" bind:value={localDestination}>
            <option value="maps">🗺️ public/maps (Cartes de bataille VTT)</option>
            <option value="tokens">🧙 public/tokens (Jetons de créatures / PJ)</option>
            <option value="tiles/custom">🧱 public/tiles/custom (Tuiles tactiques)</option>
            <option value="audio">🎵 public/audio (Pistes d'ambiance et bruitages)</option>
            <option value="scenarios">📜 public/scenarios (Aventures complètes)</option>
          </select>
        </div>

        <p style="font-size: 0.8rem; color: #8899b7; line-height: 1.4; margin-top: 8px">
          💡 Tous les fichiers de l'archive ZIP seront extraits automatiquement dans le sous-dossier sélectionné et indexés dans votre Grimoire.
        </p>
      </div>

      <div class="sub-modal-footer">
        <button class="btn-cancel" disabled={localImporting} onclick={() => showLocalImportModal = false}>
          Annuler
        </button>
        <button class="btn-confirm-import" disabled={localImporting} onclick={confirmLocalImport}>
          {localImporting ? '⏳ Extraction en cours…' : '🚀 Déployer le Pack'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.75);
    backdrop-filter: blur(4px);
    z-index: 1000;
    display: flex; align-items: center; justify-content: center;
    padding: 1rem;
  }
  .modal {
    background: #0f141c;
    border: 1px solid #2a3447;
    box-shadow: 0 20px 50px rgba(0,0,0,0.8), 0 0 0 1px rgba(229,168,83,0.2);
    border-radius: 14px;
    width: min(1040px, 95vw);
    height: 88vh;
    max-height: 88vh;
    display: flex; flex-direction: column;
    overflow: hidden;
    color: #e2e8f0;
  }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    padding: 0.8rem 1.2rem;
    border-bottom: 1px solid #1e293b;
    background: #141b26;
    flex-shrink: 0;
  }
  .modal-title-wrap {
    display: flex; align-items: center; gap: 0.6rem;
  }
  .modal-header h2 { margin: 0; font-size: 1.15rem; color: #e5a853; font-weight: 700; }
  .catalog-status {
    font-size: 0.7rem; font-weight: bold; background: rgba(229,168,83,0.15); color: #e5a853;
    padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(229,168,83,0.3);
  }
  .tabs { display: flex; gap: .4rem; }
  .tabs button {
    padding: .4rem .9rem; border-radius: 6px;
    border: 1px solid transparent;
    background: #1e293b; color: #94a3b8; cursor: pointer;
    font-size: .85rem; font-weight: 600; transition: all .15s;
  }
  .tabs button:hover { background: #334155; color: #fff; }
  .tabs button.active {
    background: #e5a853;
    color: #000;
    font-weight: 700;
    box-shadow: 0 2px 8px rgba(229,168,83,0.3);
  }
  .close-btn {
    background: none; border: none; color: #94a3b8;
    font-size: 1.2rem; cursor: pointer; padding: .2rem .5rem;
    border-radius: 4px;
  }
  .close-btn:hover { background: rgba(255,255,255,.1); color: #fff; }

  .tab-content {
    display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden;
  }

  /* Banner */
  .drive-banner-bar {
    display: flex; justify-content: space-between; align-items: center;
    padding: .6rem 1.2rem; background: linear-gradient(90deg, rgba(229,168,83,0.15), rgba(30,41,59,0.5));
    border-bottom: 1px solid rgba(229,168,83,0.25);
    flex-shrink: 0; gap: 1rem;
  }
  .banner-text { display: flex; flex-direction: column; gap: 2px; }
  .banner-text span { font-size: .9rem; color: #f6ad55; }
  .banner-text small { font-size: .75rem; color: #94a3b8; }
  .banner-actions { display: flex; gap: 0.6rem; }
  .btn-drive-link {
    background: #e5a853; color: #000; font-weight: 700;
    padding: .4rem .9rem; border-radius: 6px; border: none;
    font-size: .8rem; cursor: pointer; transition: all .15s;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  }
  .btn-drive-link:hover { filter: brightness(1.15); transform: translateY(-1px); }
  .btn-import-zip {
    background: #2563eb; color: #fff; font-weight: 700;
    padding: .4rem .9rem; border-radius: 6px; border: none;
    font-size: .8rem; cursor: pointer; transition: all .15s;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  }
  .btn-import-zip:hover { background: #3b82f6; transform: translateY(-1px); }

  /* Toolbar */
  .toolbar {
    display: flex; align-items: center; gap: .8rem; padding: .6rem 1.2rem;
    border-bottom: 1px solid #1e293b; background: #0f141c;
    flex-shrink: 0;
  }
  .search-wrap {
    position: relative; flex: 1; min-width: 180px; display: flex; align-items: center;
  }
  .search-icon { position: absolute; left: 10px; font-size: 0.85rem; pointer-events: none; opacity: 0.6; }
  .search {
    width: 100%; padding: .45rem .7rem .45rem 2rem;
    background: #141b26; border: 1px solid #334155;
    border-radius: 6px; color: #fff; font-size: .85rem; outline: none;
  }
  .search:focus { border-color: #e5a853; }
  .clear-search {
    position: absolute; right: 8px; background: none; border: none; color: #888;
    cursor: pointer; font-size: 0.8rem;
  }
  .category-bar {
    display: flex; gap: .3rem; flex-wrap: wrap;
  }
  .category-bar button {
    padding: .3rem .7rem; border-radius: 20px; border: 1px solid #334155;
    background: #141b26; color: #94a3b8; cursor: pointer; font-size: .78rem; font-weight: 600;
  }
  .category-bar button:hover { border-color: #64748b; color: #fff; }
  .category-bar button.active {
    background: rgba(229,168,83,0.2); border-color: #e5a853; color: #e5a853; font-weight: 700;
  }
  .btn-reload {
    padding: .4rem .7rem; border-radius: 6px;
    background: #1e293b; border: 1px solid #334155;
    color: #fff; cursor: pointer; font-size: 1rem;
  }
  .btn-reload:hover { background: #334155; }

  /* Grid Area */
  .grid-container {
    flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.1rem;
    padding: 1.2rem;
    align-content: start;
  }
  .card {
    background: #141b26;
    border: 1px solid #232f42;
    border-radius: 10px;
    overflow: hidden;
    display: flex; flex-direction: column;
    height: 100%;
    transition: transform .15s, border-color .15s, box-shadow .15s;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  }
  .card:hover { border-color: #e5a853; transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.5); }
  .installed-card { border-color: #10b981; }

  .card-thumb-wrap {
    position: relative; width: 100%; height: 130px; background: #090c10;
    overflow: hidden; display: flex; align-items: center; justify-content: center;
  }
  .thumb { width: 100%; height: 100%; object-fit: cover; }
  .thumb-placeholder { font-size: 3rem; }
  .card-badge-dest {
    position: absolute; bottom: 6px; right: 6px;
    background: rgba(0,0,0,0.75); color: #cbd5e1; font-size: 0.65rem; font-weight: 700;
    padding: 2px 6px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;
    border: 1px solid rgba(255,255,255,0.1);
  }

  .card-body {
    padding: .8rem; flex: 1; display: flex; flex-direction: column; min-height: 0;
  }
  .card-title { font-weight: 700; font-size: .95rem; margin-bottom: .3rem; color: #fff; line-height: 1.3; }
  .card-meta { font-size: .75rem; color: #94a3b8; margin-bottom: .5rem; display: flex; gap: 4px; align-items: center; }
  .size-tag { color: #e5a853; font-weight: 600; }
  .card-desc {
    font-size: .8rem; color: #cbd5e1; line-height: 1.4;
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  .tags { display: flex; flex-wrap: wrap; gap: .3rem; margin-top: auto; padding-top: 0.6rem; }
  .tag {
    font-size: .65rem; padding: .15rem .45rem;
    background: rgba(229,168,83,.12); border: 1px solid rgba(229,168,83,0.25);
    border-radius: 4px; color: #f6ad55; font-weight: 500;
  }

  .card-footer {
    padding: .65rem .8rem;
    border-top: 1px solid #1e293b;
    background: #0d121a;
    display: flex; align-items: center; justify-content: space-between; gap: .6rem;
    margin-top: auto;
  }
  .btn-install {
    flex: 1; padding: .5rem .8rem; border-radius: 6px;
    background: #e5a853; border: none; color: #000; font-weight: 700; cursor: pointer; font-size: .85rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3); transition: filter .15s;
    display: flex; align-items: center; justify-content: center; gap: 4px;
  }
  .btn-install:hover { filter: brightness(1.15); }
  .btn-uninstall {
    padding: .4rem .7rem; border-radius: 6px;
    background: rgba(239,68,68,0.15); border: 1px solid #ef4444;
    color: #f87171; cursor: pointer; font-size: .75rem; font-weight: 600;
  }
  .btn-uninstall:hover { background: rgba(239,68,68,0.3); }
  .badge-installed {
    font-size: .8rem; color: #10b981; font-weight: 700;
  }
  .inst-info { display: flex; flex-direction: column; gap: 2px; }
  .files-count { font-size: 0.7rem; color: #8899b7; }

  .progress-wrap { flex: 1; display: flex; align-items: center; gap: 8px; }
  .progress-bar {
    flex: 1; height: 8px; border-radius: 4px;
    background: #1e293b; overflow: hidden;
  }
  .progress-fill {
    height: 100%; background: #e5a853;
    transition: width .2s;
  }
  .pct { font-size: .75rem; color: #e5a853; font-weight: 700; min-width: 2.5rem; text-align: right; }

  /* States */
  .error-box {
    margin: 2rem auto; padding: 1.5rem; max-width: 500px;
    background: rgba(239,68,68,0.1); border: 1px solid #ef4444; border-radius: 8px; text-align: center;
  }
  .error-title { font-weight: 700; color: #f87171; margin-bottom: 0.5rem; }
  .error-msg { font-size: 0.85rem; color: #cbd5e1; margin-bottom: 1rem; }
  .error-actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
  .btn-retry { background: #334155; color: #fff; border: none; padding: .4rem .8rem; border-radius: 6px; cursor: pointer; }
  .btn-reset { background: #e5a853; color: #000; font-weight: 700; border: none; padding: .4rem .8rem; border-radius: 6px; margin-top: 10px; cursor: pointer; }
  .loading-box, .empty-box {
    margin: auto; padding: 3rem 1rem; text-align: center; color: #94a3b8; display: flex; flex-direction: column; align-items: center;
  }
  .spinner {
    width: 32px; height: 32px; border: 3px solid #1e293b; border-top-color: #e5a853;
    border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Installed Tab */
  .installed-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 1rem 1.2rem; border-bottom: 1px solid #1e293b; background: #141b26; flex-shrink: 0;
  }
  .inst-header-text h3 { margin: 0 0 4px; font-size: 1rem; color: #e5a853; }
  .inst-header-text p { margin: 0; font-size: 0.8rem; color: #94a3b8; }
  .installed-list-wrap { flex: 1; min-height: 0; overflow-y: auto; padding: 1.2rem; }
  .installed-list { display: flex; flex-direction: column; gap: .7rem; }
  .installed-row {
    display: flex; align-items: center; gap: 1rem;
    padding: .8rem 1rem;
    background: #141b26; border: 1px solid #232f42; border-radius: 8px;
  }
  .inst-icon { font-size: 1.5rem; }
  .inst-details { flex: 1; }
  .inst-title-line { display: flex; align-items: center; gap: 0.5rem; }
  .badge-ver {
    font-size: .7rem; padding: .1rem .4rem;
    background: rgba(229,168,83,.2); border-radius: 4px; color: #e5a853; font-weight: 700;
  }

  /* Admin tab */
  .admin-panel {
    padding: 1.2rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1rem;
  }
  .admin-header-box {
    display: flex; justify-content: space-between; align-items: center;
    background: #141b26; padding: .8rem 1rem; border-radius: 8px; border: 1px solid #232f42;
  }
  .btn-export-json {
    background: #2563eb; color: #fff; border: none; padding: .45rem .9rem;
    border-radius: 6px; font-size: .8rem; font-weight: 700; cursor: pointer;
  }
  .admin-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; }
  .form-group { display: flex; flex-direction: column; gap: 4px; }
  .form-label { font-size: .75rem; text-transform: uppercase; color: #8899b7; font-weight: 600; }
  .form-input, .form-select, .form-textarea {
    background: #090c10; border: 1px solid #2a3447; border-radius: 6px;
    padding: .45rem .65rem; color: #fff; font-size: .85rem; outline: none;
  }
  .form-input:focus, .form-select:focus, .form-textarea:focus { border-color: #e5a853; }
  .btn-convert-gdrive {
    background: rgba(229,168,83,0.15); border: 1px solid #e5a853; color: #e5a853;
    padding: .3rem .65rem; border-radius: 6px; font-size: .75rem; font-weight: bold; cursor: pointer; white-space: nowrap;
  }
  .btn-add-tag { background: #10b981; border: none; color: #000; font-weight: 700; padding: .3rem .6rem; border-radius: 6px; font-size: .75rem; cursor: pointer; }
  .admin-actions { display: flex; justify-content: flex-end; margin-top: .5rem; }
  .btn-submit-addon {
    background: #10b981; color: #000; border: none; padding: .6rem 1.2rem;
    border-radius: 6px; font-weight: bold; font-size: .9rem; cursor: pointer;
  }
  .btn-primary {
    background: #e5a853; color: #000; font-weight: 700; border: none; padding: .6rem 1.2rem; border-radius: 6px; margin-top: 1rem; cursor: pointer;
  }

  /* Sub Modal Local Import */
  .sub-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.8);
    z-index: 1100; display: flex; align-items: center; justify-content: center; padding: 1rem;
  }
  .sub-modal {
    background: #101620; border: 1px solid #2a384f; border-radius: 10px;
    width: min(500px, 90vw); display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 10px 30px rgba(0,0,0,0.9);
  }
  .sub-modal-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.8rem 1rem; background: #16202e; border-bottom: 1px solid #232f42;
  }
  .sub-modal-header h3 { margin: 0; font-size: 1rem; color: #e5a853; }
  .sub-modal-body { padding: 1rem; display: flex; flex-direction: column; gap: 0.8rem; }
  .sub-modal-footer {
    display: flex; justify-content: flex-end; gap: 0.6rem;
    padding: 0.8rem 1rem; background: #0c1117; border-top: 1px solid #1e293b;
  }
  .path-preview {
    font-size: 0.75rem; color: #94a3b8; background: #06090e; padding: 0.4rem 0.6rem;
    border-radius: 4px; border: 1px solid #1e293b; word-break: break-all;
  }
  .btn-cancel {
    background: transparent; border: 1px solid #475569; color: #94a3b8; padding: 0.4rem 0.8rem;
    border-radius: 6px; cursor: pointer; font-size: 0.85rem;
  }
  .btn-confirm-import {
    background: #10b981; border: none; color: #000; font-weight: 700; padding: 0.4rem 1rem;
    border-radius: 6px; cursor: pointer; font-size: 0.85rem;
  }
  .btn-confirm-import:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
