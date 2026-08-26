<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { open } from '@tauri-apps/plugin-dialog';
  import { onMount, onDestroy } from 'svelte';
  import { openVault } from '$lib/api';
  import { getVaultPath, setVaultTree } from '$lib/stores/vault.svelte';
  import { addMapScene, replaceActiveScene } from '$lib/stores/vtt.svelte';
  import { getCelestialCatalog, type DriveFile, type TreeNode } from '$lib/stores/celestialCache';
  import PdfReaderModal from './PdfReaderModal.svelte';

  const { onclose } = $props<{ onclose: () => void }>();

  // ── Types ──────────────────────────────────────────────────────────────────

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

  // ── Constants & State ──────────────────────────────────────────────────────

  const COMMUNITY_DRIVE_URL = 'https://drive.google.com/drive/folders/16ZM0lg66rgFdsQ9kmFoA2pQZ2a0mciF3?usp=drive_link';

  let rawFiles = $state<DriveFile[]>([]);
  let rootTree = $state<TreeNode>({
    name: 'Archives Célestes',
    path: '',
    subfolders: {},
    files: [],
    totalFiles: 0,
    destination: 'maps'
  });

  let currentPath = $state<string>('maps'); // Default to maps root
  let searchQuery = $state('');
  let activeTab = $state<'explorer' | 'installed' | 'import'>('explorer');

  let installed = $state<InstalledAddon[]>([]);
  let localFilesOnDisk = $state<Set<string>>(new Set());
  let loading = $state(true);
  let error = $state('');

  // Downloading state
  let installingPacks = $state<Set<string>>(new Set());
  let downloadingFiles = $state<Set<string>>(new Set());
  let progress = $state<Record<string, { done: number; total: number; pct: number; currentFile: string }>>({});
  let unlisten: (() => void) | null = null;

  // Lightbox Preview State (Zoom & Pan HD)
  let previewFile = $state<DriveFile | null>(null);
  let previewZoom = $state(1);
  let previewPan = $state({ x: 0, y: 0 });
  let isDraggingPreview = $state(false);
  let dragStart = $state({ x: 0, y: 0 });

  // PDF Reader Modal State
  let activePdfModal = $state<{ url: string; name: string; localPath?: string } | null>(null);

  let booksCount = $derived(
    rawFiles.filter(f => f.destination === 'books' || f.path.toLowerCase().endsWith('.pdf') || f.name.toLowerCase().endsWith('.pdf')).length
  );

  function openPdfReader(file: DriveFile) {
    activePdfModal = {
      url: file.url || file.highResUrl,
      name: file.name
    };
  }

  function openPreview(file: DriveFile) {
    if (file.destination === 'books' || file.filename.toLowerCase().endsWith('.pdf')) {
      openPdfReader(file);
      return;
    }
    previewFile = file;
    previewZoom = 1;
    previewPan = { x: 0, y: 0 };
  }

  function closePreview() {
    previewFile = null;
    isDraggingPreview = false;
  }

  function previewNext() {
    if (!previewFile) return;
    const currentList = searchQuery.trim() ? searchResults : currentFiles;
    const idx = currentList.findIndex(f => f.id === previewFile?.id);
    if (idx !== -1 && idx < currentList.length - 1) {
      openPreview(currentList[idx + 1]);
    } else if (currentList.length > 0) {
      openPreview(currentList[0]);
    }
  }

  function previewPrev() {
    if (!previewFile) return;
    const currentList = searchQuery.trim() ? searchResults : currentFiles;
    const idx = currentList.findIndex(f => f.id === previewFile?.id);
    if (idx > 0) {
      openPreview(currentList[idx - 1]);
    } else if (currentList.length > 0) {
      openPreview(currentList[currentList.length - 1]);
    }
  }

  function handlePreviewWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    previewZoom = Math.min(Math.max(0.2, previewZoom + delta), 4);
  }

  function handlePreviewMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    isDraggingPreview = true;
    dragStart = { x: e.clientX - previewPan.x, y: e.clientY - previewPan.y };
  }

  function handlePreviewMouseMove(e: MouseEvent) {
    if (!isDraggingPreview) return;
    previewPan = { x: e.clientX - dragStart.x, y: e.clientY - dragStart.y };
  }

  function handlePreviewMouseUp() {
    isDraggingPreview = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!previewFile) return;
    if (e.key === 'Escape') closePreview();
    else if (e.key === 'ArrowRight') previewNext();
    else if (e.key === 'ArrowLeft') previewPrev();
    else if (e.key === '+' || e.key === '=') previewZoom = Math.min(previewZoom + 0.25, 4);
    else if (e.key === '-') previewZoom = Math.max(previewZoom - 0.25, 0.2);
    else if (e.key === '0') { previewZoom = 1; previewPan = { x: 0, y: 0 }; }
  }

  // Local import dialog state
  let showLocalImportModal = $state(false);
  let localFilePath = $state('');
  let localPackName = $state('');
  let localDestination = $state('maps');
  let localImporting = $state(false);

  // Toast / notification
  let toastMsg = $state('');
  let toastTimer: any = null;

  function showToast(msg: string) {
    toastMsg = msg;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastMsg = ''; }, 3500);
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function getNodeAtPath(node: TreeNode, path: string): TreeNode {
    if (!path) return node;
    const parts = path.split('/').filter(Boolean);
    let curr = node;
    for (const part of parts) {
      if (curr.subfolders[part]) {
        curr = curr.subfolders[part];
      } else {
        break;
      }
    }
    return curr;
  }

  function getAllFilesInNode(node: TreeNode): DriveFile[] {
    const list: DriveFile[] = [...node.files];
    for (const sub of Object.values(node.subfolders)) {
      list.push(...getAllFilesInNode(sub));
    }
    return list;
  }

  // Current node in the tree
  const currentNode = $derived(getNodeAtPath(rootTree, currentPath));

  // Breadcrumbs: [ { label: '🏠 Drive', path: '' }, { label: 'maps', path: 'maps' }, ... ]
  const breadcrumbs = $derived.by(() => {
    const list = [{ label: '🏠 Drive', path: '' }];
    if (!currentPath) return list;
    const parts = currentPath.split('/').filter(Boolean);
    let acc = '';
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      let label = part;
      if (part === 'maps') label = '🗺️ Cartes';
      else if (part === 'textures') label = '🧱 Textures';
      else if (part === 'stamps') label = '🎨 Tampons';
      list.push({ label, path: acc });
    }
    return list;
  });

  // Subfolders in current node (sorted alphabetically)
  const currentSubfolders = $derived(
    Object.values(currentNode.subfolders).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  );

  // Files in current node
  const currentFiles = $derived(currentNode.files);

  // Search results across whole tree if searchQuery is active
  const searchResults = $derived.by(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return rawFiles.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.filename.toLowerCase().includes(q) ||
      f.path.toLowerCase().includes(q)
    ).slice(0, 150); // Limit to top 150 for smooth UI rendering
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  function isFileOnDisk(file: DriveFile): boolean {
    const cleanPath = file.path.replace(/\\/g, '/').replace(/^\/+/, '');
    const cleanNoRoot = cleanPath.split('/').slice(1).join('/');
    return localFilesOnDisk.has(cleanPath) ||
      localFilesOnDisk.has(cleanNoRoot) ||
      localFilesOnDisk.has(file.filename);
  }

  function isNodeDownloaded(node: TreeNode): boolean {
    const all = getAllFilesInNode(node);
    if (all.length === 0) return false;
    return all.every(f => isFileOnDisk(f));
  }

  function countDownloadedInNode(node: TreeNode): number {
    const all = getAllFilesInNode(node);
    return all.filter(f => isFileOnDisk(f)).length;
  }

  function openExternal(url: string) {
    invoke('open_url', { url }).catch(() => {
      window.open(url, '_blank');
    });
  }

  async function openFolder(dest: string) {
    try {
      await invoke('addon_open_folder', { destination: dest });
    } catch (e) {
      alert(`Erreur ouverture dossier : ${e}`);
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function loadDriveCatalog(forceRefresh = false) {
    loading = true;
    error = '';
    try {
      const data = await getCelestialCatalog(forceRefresh);
      rawFiles = data.files;
      rootTree = data.tree;
    } catch (e) {
      console.error('Erreur chargement catalogue Archives Célestes:', e);
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

    try {
      const [mapsFiles, tokenFiles, tileFiles] = await Promise.all([
        invoke<string[]>('addon_check_installed_files', { destination: 'maps' }).catch(() => []),
        invoke<string[]>('addon_check_installed_files', { destination: 'tokens' }).catch(() => []),
        invoke<string[]>('addon_check_installed_files', { destination: 'tiles/custom' }).catch(() => []),
      ]);

      const diskSet = new Set<string>();
      for (const f of mapsFiles) {
        diskSet.add(`maps/${f}`);
        diskSet.add(f);
      }
      for (const f of tokenFiles) {
        diskSet.add(`tokens/${f}`);
        diskSet.add(`stamps/${f}`);
        diskSet.add(f);
      }
      for (const f of tileFiles) {
        diskSet.add(`textures/${f}`);
        diskSet.add(`tiles/custom/${f}`);
        diskSet.add(f);
      }
      localFilesOnDisk = diskSet;
    } catch (e) {
      console.warn('Erreur vérification fichiers locaux:', e);
    }
  }

  async function downloadFolder(node: TreeNode) {
    const allFiles = getAllFilesInNode(node);
    if (allFiles.length === 0) {
      alert('Ce dossier ne contient aucun fichier.');
      return;
    }

    const packId = `folder-${node.path.replace(/[^a-zA-Z0-9_-]/g, '-') || 'root'}`;
    installingPacks = new Set([...installingPacks, packId]);
    progress[packId] = { done: 0, total: allFiles.length, pct: 0, currentFile: 'Démarrage…' };
    progress = { ...progress };

    try {
      const vp = getVaultPath();
      const result = await invoke<InstalledAddon>('addon_download_pack', {
        packId,
        packName: node.name || 'Dossier Drive',
        destination: node.destination,
        subfolder: node.path,
        vaultPath: vp || undefined,
        files: allFiles.map(f => ({
          id: f.id,
          name: f.name,
          filename: f.filename,
          path: f.path,
          category: f.category,
          destination: f.destination,
          subfolder: f.subfolder,
          url: f.highResUrl || f.url,
          high_res_url: f.highResUrl,
          thumb_url: f.thumbUrl
        }))
      });

      installed = [...installed.filter(i => i.id !== result.id), result];
      await loadInstalled();
      if (vp) {
        try {
          const tree = await openVault(vp);
          setVaultTree(tree);
        } catch (treeErr) {
          console.warn('Erreur rafraîchissement coffre:', treeErr);
        }
      }
      showToast(`✅ Dossier "${node.name}" téléchargé avec succès (${result.files.length} fichiers) !`);
    } catch (e) {
      alert(`Erreur lors du téléchargement du dossier "${node.name}" : ${e}`);
    } finally {
      installingPacks = new Set([...installingPacks].filter(id => id !== packId));
      const { [packId]: _, ...rest } = progress;
      progress = rest;
    }
  }

  async function downloadSingleFile(file: DriveFile) {
    downloadingFiles = new Set([...downloadingFiles, file.id]);
    showToast(`⏳ Téléchargement de "${file.name}" en cours…`);
    try {
      const vp = getVaultPath();
      const relPath = await invoke<string>('addon_download_file', {
        fileId: file.id,
        filename: file.filename,
        destination: file.destination,
        subfolder: file.subfolder,
        url: file.highResUrl || file.url,
        relPath: file.path,
        vaultPath: vp || undefined
      });
      await loadInstalled();
      if (vp) {
        try {
          const tree = await openVault(vp);
          setVaultTree(tree);
        } catch (treeErr) {
          console.warn('Erreur rafraîchissement coffre:', treeErr);
        }
      }
      showToast(`✅ "${file.name}" enregistré dans votre coffre (${file.destination}) !`);
    } catch (e) {
      console.error('Erreur téléchargement fichier:', e);
      showToast(`⚠️ Échec du téléchargement : ${e}`);
    } finally {
      downloadingFiles = new Set([...downloadingFiles].filter(id => id !== file.id));
    }
  }

  async function loadIntoVTT(file: DriveFile, asNew = false) {
    showToast(`⏳ Préparation de la carte "${file.name}"…`);
    try {
      let src = file.highResUrl || file.url;
      // Si le fichier n'est pas encore sur le PC, le télécharger localement pour garantir 0 erreur PixiJS et 0 latence
      if (!isFileOnDisk(file)) {
        try {
          const vp = getVaultPath();
          const relPath = await invoke<string>('addon_download_file', {
            fileId: file.id,
            filename: file.filename,
            destination: file.destination,
            subfolder: file.subfolder,
            url: file.highResUrl || file.url,
            relPath: file.path,
            vaultPath: vp || undefined
          });
          await loadInstalled();
          if (vp) {
            try {
              const tree = await openVault(vp);
              setVaultTree(tree);
            } catch {}
          }
          src = `/${file.destination}/${relPath}`;
        } catch (dlErr) {
          console.warn('Téléchargement local échoué, fallback streaming:', dlErr);
          src = file.highResUrl || file.url;
        }
      } else {
        const cleanPath = file.path.replace(/\\/g, '/').replace(/^\/+/, '');
        src = `/${cleanPath}`;
      }

      if (asNew) {
        addMapScene(file.name, src, src);
        showToast(`🗺️ Nouvelle scène "${file.name}" créée dans la VTT !`);
      } else {
        replaceActiveScene(file.name, src, src);
        showToast(`🗺️ Carte "${file.name}" chargée sur la scène active !`);
      }
    } catch (e) {
      console.error('Erreur chargement VTT:', e);
      const fallbackSrc = file.highResUrl || file.url;
      if (asNew) addMapScene(file.name, fallbackSrc, fallbackSrc);
      else replaceActiveScene(file.name, fallbackSrc, fallbackSrc);
    }
  }

  async function uninstall(addonId: string) {
    if (!confirm('Désinstaller ce dossier et supprimer ses fichiers du disque local ?')) return;
    try {
      await invoke('addon_uninstall', { addonId });
      installed = installed.filter(a => a.id !== addonId);
      await loadInstalled();
      showToast('🗑️ Dossier désinstallé et fichiers supprimés.');
    } catch (e) {
      alert(`Erreur de désinstallation : ${e}`);
    }
  }

  function navigateUp() {
    if (!currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    currentPath = parts.join('/');
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

      const lower = fileName.toLowerCase();
      if (lower.includes('token') || lower.includes('figurine') || lower.includes('monstre')) {
        localDestination = 'tokens';
      } else if (lower.includes('audio') || lower.includes('son') || lower.includes('music')) {
        localDestination = 'audio';
      } else if (lower.includes('tuile') || lower.includes('tile') || lower.includes('texture')) {
        localDestination = 'tiles/custom';
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
      await loadInstalled();
      showLocalImportModal = false;
      showToast(`✅ Pack "${result.name}" importé avec succès (${result.files.length} fichiers) !`);
      activeTab = 'installed';
    } catch (e) {
      alert(`Erreur d'importation locale : ${e}`);
    } finally {
      localImporting = false;
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  onMount(async () => {
    await Promise.all([loadDriveCatalog(), loadInstalled()]);

    unlisten = await listen<ProgressEvent>('addon://progress', ({ payload }) => {
      const pct = Math.round((payload.done / payload.total) * 100);
      progress[payload.addon_id] = {
        done: payload.done,
        total: payload.total,
        pct,
        currentFile: payload.file
      };
      progress = { ...progress };
    });
  });

  onDestroy(() => {
    unlisten?.();
    if (toastTimer) clearTimeout(toastTimer);
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- ─────────────────────────────────────────────────────────────────────── -->
<!-- Modal Principal : Explorateur Arborescent                               -->
<!-- ─────────────────────────────────────────────────────────────────────── -->

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="overlay" onclick={(e) => e.target === e.currentTarget && onclose()} role="presentation">
  <div class="modal" role="dialog" aria-modal="true" tabindex="-1">

    <!-- Header -->
    <div class="modal-header">
      <div class="modal-title-wrap">
        <div class="header-icon">🌌</div>
        <div>
          <h2>Bibliothèque Céleste & Packs Grimoire</h2>
          <span class="catalog-sub">Arborescence des archives • {rawFiles.length.toLocaleString()} ressources en ligne</span>
        </div>
      </div>
      <div class="tabs">
        <button class:active={activeTab === 'explorer'} onclick={() => { activeTab = 'explorer'; searchQuery = ''; }}>
          🌌 Archives Célestes
        </button>
        <button class:active={activeTab === 'installed'} onclick={() => activeTab = 'installed'}>
          💾 Installés ({installed.length})
        </button>
        <button class:active={activeTab === 'import'} onclick={() => activeTab = 'import'}>
          📥 Importer ZIP
        </button>
      </div>
      <button class="close-btn" onclick={onclose} title="Fermer">✕</button>
    </div>

    <!-- Toast Notification -->
    {#if toastMsg}
      <div class="toast-bar">
        <span>{toastMsg}</span>
      </div>
    {/if}

    <!-- Tab 1: Hierarchical Drive Explorer -->
    {#if activeTab === 'explorer'}
      <div class="tab-content">

        <!-- Top Shortcuts & Drive link bar -->
        <div class="drive-banner-bar">
          <div class="quick-nav-pills">
            <span class="quick-nav-label">Accès direct :</span>
            <button class="nav-pill" class:active-pill={currentPath === 'maps'} onclick={() => { currentPath = 'maps'; searchQuery = ''; }}>
              🗺️ Cartes ({rootTree.subfolders['maps']?.totalFiles ?? 0})
            </button>
            <button class="nav-pill" class:active-pill={currentPath === 'textures'} onclick={() => { currentPath = 'textures'; searchQuery = ''; }}>
              🧱 Textures ({rootTree.subfolders['textures']?.totalFiles ?? 0})
            </button>
            <button class="nav-pill" class:active-pill={currentPath === 'stamps'} onclick={() => { currentPath = 'stamps'; searchQuery = ''; }}>
              🎨 Tampons ({rootTree.subfolders['stamps']?.totalFiles ?? 0})
            </button>
            <button class="nav-pill" class:active-pill={currentPath === 'books' || currentPath === 'livres' || currentPath === 'pdf' || searchQuery === '.pdf'} onclick={() => {
              if (rootTree.subfolders['books']) { currentPath = 'books'; searchQuery = ''; }
              else if (rootTree.subfolders['livres']) { currentPath = 'livres'; searchQuery = ''; }
              else if (rootTree.subfolders['pdf']) { currentPath = 'pdf'; searchQuery = ''; }
              else { currentPath = ''; searchQuery = '.pdf'; }
            }}>
              📚 Livres & PDF ({booksCount})
            </button>
            <button class="nav-pill" class:active-pill={currentPath === '' && !searchQuery} onclick={() => { currentPath = ''; searchQuery = ''; }}>
              🌌 Toutes les Archives
            </button>
          </div>

          <div class="banner-actions">
            <button class="btn-drive-link" onclick={() => openExternal(COMMUNITY_DRIVE_URL)} title="Ouvrir la réserve en ligne dans votre navigateur">
              🌐 Réserve en Ligne ↗
            </button>
            <div class="folder-quick-links">
              <button class="btn-open-folder" onclick={() => openFolder('maps')} title="Ouvrir public/maps dans l'explorateur Windows">
                📁 Cartes
              </button>
              <button class="btn-open-folder" onclick={() => openFolder('tokens')} title="Ouvrir public/tokens dans l'explorateur Windows">
                📁 Tokens
              </button>
              <button class="btn-open-folder" onclick={() => openFolder('tiles/custom')} title="Ouvrir public/tiles dans l'explorateur Windows">
                📁 Tuiles
              </button>
              <button class="btn-open-folder" onclick={() => openFolder('books')} title="Ouvrir le dossier des livres dans l'explorateur Windows">
                📁 Livres
              </button>
            </div>
          </div>
        </div>

        <!-- Breadcrumbs & Search Toolbar -->
        <div class="toolbar">
          <!-- Breadcrumbs bar -->
          <div class="breadcrumbs-container">
            {#if currentPath}
              <button class="btn-back" onclick={navigateUp} title="Remonter au dossier parent">
                ⬅ Retour
              </button>
            {/if}
            <div class="breadcrumbs-list">
              {#each breadcrumbs as crumb, i}
                {#if i > 0}<span class="crumb-separator">/</span>{/if}
                <button
                  class="crumb-btn"
                  class:crumb-active={i === breadcrumbs.length - 1 && !searchQuery}
                  onclick={() => { currentPath = crumb.path; searchQuery = ''; }}
                >
                  {crumb.label}
                </button>
              {/each}
            </div>
          </div>

          <!-- Search input -->
          <div class="search-wrap">
            <span class="search-icon">🔍</span>
            <input
              class="search"
              placeholder="Rechercher dans toutes les archives…"
              bind:value={searchQuery}
            />
            {#if searchQuery}
              <button class="clear-search" onclick={() => searchQuery = ''}>✕</button>
            {/if}
          </div>

          <button class="btn-reload" onclick={() => loadDriveCatalog(true)} disabled={loading} title="Forcer le rafraîchissement des archives">
            {loading ? '⏳' : '↺'}
          </button>
        </div>

        <!-- Download Current Directory Action Banner -->
        {#if !searchQuery && currentNode.totalFiles > 0}
          {@const curPackId = `folder-${currentNode.path.replace(/[^a-zA-Z0-9_-]/g, '-') || 'root'}`}
          {@const isDownCur = installingPacks.has(curPackId)}
          {@const curProg = progress[curPackId]}
          {@const curDownloadedCount = countDownloadedInNode(currentNode)}
          <div class="current-dir-banner">
            <div class="current-dir-info">
              <div class="dir-title-row">
                <span class="dir-icon">📂</span>
                <strong>{currentNode.name}</strong>
                <span class="dir-badge-count">{currentNode.totalFiles} fichiers au total</span>
                {#if curDownloadedCount > 0}
                  <span class="dir-badge-dl">{curDownloadedCount} / {currentNode.totalFiles} sur votre PC</span>
                {/if}
              </div>
              <small class="dir-sub-path">public/{currentNode.destination}/{currentNode.path}</small>
            </div>

            <div class="current-dir-actions">
              {#if isDownCur && curProg}
                <div class="header-progress-wrap">
                  <div class="pack-progress-bar">
                    <div class="pack-progress-fill" style="width: {curProg.pct}%"></div>
                  </div>
                  <div class="pack-progress-text">
                    <span>{curProg.done} / {curProg.total} ({curProg.pct}%)</span>
                    <span class="file-name-cut">{curProg.currentFile}</span>
                  </div>
                </div>
              {:else}
                <button class="btn-download-folder" onclick={() => downloadFolder(currentNode)}>
                  📥 Télécharger TOUT ce répertoire ({currentNode.totalFiles} fichiers)
                </button>
                <button class="btn-open-folder" onclick={() => openFolder(currentNode.destination)}>
                  📁 Ouvrir dossier Windows
                </button>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Main Explorer Content Grid -->
        <div class="explorer-body">
          {#if error}
            <div class="error-box">
              <div class="error-title">⚠️ Erreur de chargement des archives</div>
              <div class="error-msg">{error}</div>
              <div class="error-actions">
                <button class="btn-retry" onclick={() => loadDriveCatalog(true)}>Réessayer</button>
                <button class="btn-drive-link" onclick={() => openExternal(COMMUNITY_DRIVE_URL)}>Accéder aux Archives en ligne ↗</button>
              </div>
            </div>

          {:else if loading}
            <div class="loading-box">
              <div class="spinner">⏳</div>
              <span>Chargement des Archives Célestes…</span>
            </div>

          <!-- Search Mode Results -->
          {:else if searchQuery.trim()}
            <div class="section-title">
              🔍 Résultats de recherche pour « {searchQuery} » ({searchResults.length} résultats)
            </div>

            {#if searchResults.length === 0}
              <div class="empty-box">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem">🔍</div>
                <div>Aucun fichier ne correspond à votre recherche.</div>
                <button class="btn-reset" onclick={() => searchQuery = ''}>Effacer la recherche</button>
              </div>
            {:else}
              <div class="files-grid">
                {#each searchResults as file (file.id)}
                  {@const onDisk = isFileOnDisk(file)}
                  {@const isDl = downloadingFiles.has(file.id)}
                  <div class="file-card" class:file-on-disk={onDisk}>
                    <div class="file-thumb-wrap" role="button" tabindex="0" onclick={() => openPreview(file)} onkeydown={(e) => e.key === 'Enter' && openPreview(file)}>
                      <img src={file.thumbUrl || file.url} alt={file.name} class="file-thumb" loading="lazy" referrerpolicy="no-referrer" />
                      {#if onDisk}
                        <div class="badge-on-disk">✓ Sur PC</div>
                      {/if}
                      <button class="btn-inspect-hd" onclick={(e) => { e.stopPropagation(); openPreview(file); }} title="Inspecter en plein écran">
                        🔍 HD
                      </button>
                      <button class="btn-jump-folder" onclick={(e) => {
                        e.stopPropagation();
                        const parentPath = file.path.split('/').slice(0, -1).join('/');
                        currentPath = parentPath;
                        searchQuery = '';
                      }} title="Aller dans ce dossier">
                        📂 Ouvrir dossier
                      </button>
                    </div>
                    <div class="file-info">
                      <div class="file-name" title={file.filename}>{file.name}</div>
                      <div class="file-path-sub" title={file.path}>📂 {file.path}</div>
                    </div>
                    <div class="file-actions">
                      <button
                        class="btn-file-dl"
                        class:btn-file-done={onDisk}
                        disabled={isDl}
                        onclick={() => downloadSingleFile(file)}
                        title="Télécharger ce fichier sur votre PC"
                      >
                        {#if isDl}⏳ En cours…
                        {:else if onDisk}💾 Re-télécharger
                        {:else}⬇️ Télécharger{/if}
                      </button>
                      {#if file.destination === 'maps'}
                        <button class="btn-file-vtt" onclick={() => loadIntoVTT(file, false)} title="Charger sur la VTT">
                          🎮 VTT
                        </button>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}

          <!-- Normal Tree Explorer Mode -->
          {:else}
            <!-- 1. Subfolders Section (if any) -->
            {#if currentSubfolders.length > 0}
              <div class="section-title">
                📁 Sous-Dossiers ({currentSubfolders.length})
              </div>
              <div class="folders-grid">
                {#each currentSubfolders as subNode (subNode.path)}
                  {@const subPackId = `folder-${subNode.path.replace(/[^a-zA-Z0-9_-]/g, '-') || 'sub'}`}
                  {@const isDownSub = installingPacks.has(subPackId)}
                  {@const subProg = progress[subPackId]}
                  {@const isSubFull = isNodeDownloaded(subNode)}
                  {@const dlCount = countDownloadedInNode(subNode)}
                  <div class="folder-card" class:folder-installed={isSubFull}>
                    <button type="button" class="folder-header-click" onclick={() => currentPath = subNode.path}>
                      <div class="folder-thumb-wrap">
                        {#if subNode.thumbnail}
                          <img class="folder-thumb" src={subNode.thumbnail} alt="" loading="lazy" referrerpolicy="no-referrer" />
                        {:else}
                          <div class="folder-icon-placeholder">📁</div>
                        {/if}
                        <div class="folder-badge-dest">
                          {#if subNode.destination === 'maps'}🗺️ Cartes
                          {:else if subNode.destination === 'tiles/custom'}🧱 Textures
                          {:else}🎨 Tampons{/if}
                        </div>
                        <div class="folder-count-tag">{subNode.totalFiles} fichiers</div>
                      </div>
                      <div class="folder-info">
                        <div class="folder-name-row">
                          <span class="folder-emoji">📁</span>
                          <span class="folder-name" title={subNode.name}>{subNode.name}</span>
                        </div>
                        <div class="folder-meta-row">
                          {#if Object.keys(subNode.subfolders).length > 0}
                            <span>📂 {Object.keys(subNode.subfolders).length} sous-dossiers</span>
                            <span>•</span>
                          {/if}
                          <span>{subNode.totalFiles} fichiers</span>
                          {#if dlCount > 0}
                            <span class="sub-dl-count">({dlCount} sur PC)</span>
                          {/if}
                        </div>
                      </div>
                    </button>

                    <div class="folder-footer-actions">
                      {#if isDownSub && subProg}
                        <div class="pack-progress-wrap">
                          <div class="pack-progress-bar">
                            <div class="pack-progress-fill" style="width: {subProg.pct}%"></div>
                          </div>
                          <div class="pack-progress-text">
                            <span>{subProg.done} / {subProg.total} ({subProg.pct}%)</span>
                            <span class="file-name-cut">{subProg.currentFile}</span>
                          </div>
                        </div>
                      {:else}
                        <button class="btn-enter-folder" onclick={() => currentPath = subNode.path}>
                          👁️ Explorer
                        </button>
                        <button
                          class="btn-dl-subfolder"
                          class:btn-sub-installed={isSubFull}
                          onclick={() => downloadFolder(subNode)}
                          title="Télécharger tous les fichiers de ce dossier"
                        >
                          {#if isSubFull}✓ Installé ({subNode.totalFiles}){:else}📥 Télécharger ({subNode.totalFiles}){/if}
                        </button>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}

            <!-- 2. Files Section in current folder (if any) -->
            {#if currentFiles.length > 0}
              <div class="section-title" style="margin-top: {currentSubfolders.length > 0 ? '1.5rem' : '0'}">
                📄 Fichiers dans ce dossier ({currentFiles.length})
              </div>
              <div class="files-grid">
                {#each currentFiles as file (file.id)}
                  {@const onDisk = isFileOnDisk(file)}
                  {@const isDl = downloadingFiles.has(file.id)}
                  {@const isPdf = file.destination === 'books' || file.filename.toLowerCase().endsWith('.pdf')}
                  <div class="file-card" class:file-on-disk={onDisk} class:file-is-pdf={isPdf}>
                    <div class="file-thumb-wrap" role="button" tabindex="0" onclick={() => openPreview(file)} onkeydown={(e) => e.key === 'Enter' && openPreview(file)}>
                      {#if isPdf}
                        <div class="pdf-card-cover">
                          <span class="pdf-icon-big">📚</span>
                          <span class="pdf-tag-cover">GRIMOIRE PDF</span>
                        </div>
                      {:else}
                        <img src={file.thumbUrl || file.url} alt={file.name} class="file-thumb" loading="lazy" referrerpolicy="no-referrer" />
                      {/if}
                      {#if onDisk}
                        <div class="badge-on-disk">✓ Sur PC</div>
                      {/if}
                      <button class="btn-inspect-hd" onclick={(e) => { e.stopPropagation(); openPreview(file); }} title={isPdf ? 'Ouvrir dans la Liseuse PDF & Voix' : 'Inspecter en plein écran (Zoom & Pan)'}>
                        {isPdf ? '📖 Liseuse' : '🔍 HD'}
                      </button>
                    </div>
                    <div class="file-info">
                      <div class="file-name" title={file.filename}>{file.name}</div>
                      <div class="file-orig-name">{file.filename}</div>
                    </div>
                    <div class="file-actions">
                      <button
                        class="btn-file-dl"
                        class:btn-file-done={onDisk}
                        disabled={isDl}
                        onclick={() => downloadSingleFile(file)}
                        title="Télécharger ce fichier sur votre PC"
                      >
                        {#if isDl}⏳ En cours…
                        {:else if onDisk}💾 Re-télécharger
                        {:else}⬇️ Télécharger{/if}
                      </button>
                      {#if isPdf}
                        <button class="btn-file-pdf" onclick={() => openPdfReader(file)} title="Ouvrir dans la Liseuse Vocale intégrée">
                          🗣️ Liseuse
                        </button>
                      {:else if file.destination === 'maps'}
                        <button class="btn-file-vtt" onclick={() => loadIntoVTT(file, false)} title="Charger cette carte directement sur la VTT">
                          🎮 VTT
                        </button>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}

            {#if currentSubfolders.length === 0 && currentFiles.length === 0}
              <div class="empty-box">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem">📂</div>
                <div>Ce dossier est vide.</div>
                <button class="btn-reset" onclick={navigateUp}>Retour au dossier parent</button>
              </div>
            {/if}
          {/if}
        </div>
      </div>

    <!-- Tab 2: Installed on local disk -->
    {:else if activeTab === 'installed'}
      <div class="tab-content">
        <div class="installed-header">
          <div class="inst-header-text">
            <h3>Dossiers & Fichiers installés localement ({installed.length})</h3>
            <p>Ces ressources sont sauvegardées sur votre ordinateur dans les dossiers de Grimoire.</p>
          </div>
          <div class="installed-header-actions">
            <button class="btn-open-folder" onclick={() => openFolder('maps')}>📁 public/maps</button>
            <button class="btn-open-folder" onclick={() => openFolder('tokens')}>📁 public/tokens</button>
            <button class="btn-open-folder" onclick={() => openFolder('tiles/custom')}>📁 public/tiles</button>
            <button class="btn-import-zip" onclick={pickAndImportLocalZip}>📥 Importer un ZIP…</button>
          </div>
        </div>

        <div class="installed-list-wrap">
          {#if installed.length === 0}
            <div class="empty-box">
              <div style="font-size: 2.5rem; margin-bottom: 0.5rem">📦</div>
              <div>Aucun pack ou dossier n'est encore installé localement.</div>
              <p style="font-size: 0.85rem; color: #8899b7">Explorez les Archives Célestes pour télécharger vos cartes de bataille, textures et décors !</p>
              <button class="btn-primary" onclick={() => activeTab = 'explorer'}>
                🌌 Parcourir les Archives Célestes
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
                    {:else}🧱{/if}
                  </div>
                  <div class="inst-details">
                    <div class="inst-title-line">
                      <strong>{a.name}</strong>
                      <span class="badge-dest">{a.destination}</span>
                    </div>
                    <div class="inst-meta">
                      📁 public/{a.destination}/ · {a.files.length} fichiers installés
                    </div>
                  </div>
                  <div class="inst-row-actions">
                    <button class="btn-open-folder" onclick={() => openFolder(a.destination)} title="Ouvrir dans Windows">
                      📁 Ouvrir
                    </button>
                    <button class="btn-uninstall" onclick={() => uninstall(a.id)} title="Supprimer du PC">
                      🗑️ Supprimer
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

    <!-- Tab 3: Local ZIP import -->
    {:else}
      <div class="tab-content">
        <div class="import-panel">
          <div class="import-card">
            <div style="font-size: 3rem; margin-bottom: 1rem">📥</div>
            <h3>Importer vos propres Packs ou Archives ZIP</h3>
            <p>Déployez instantanément vos fichiers (cartes, tokens, tuiles, bruitages) directement dans les dossiers locaux de Grimoire.</p>
            <button class="btn-big-import" onclick={pickAndImportLocalZip}>
              📂 Sélectionner un fichier .ZIP ou .grimoirepack
            </button>
          </div>
        </div>
      </div>
    {/if}

  </div>
</div>

<!-- ─────────────────────────────────────────────────────────────────────── -->
<!-- Sub-Modal (Local Import)                                                -->
<!-- ─────────────────────────────────────────────────────────────────────── -->

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
          <label class="form-label" for="zip-path-preview">Fichier sélectionné</label>
          <div id="zip-path-preview" class="path-preview" title={localFilePath}>{localFilePath}</div>
        </div>

        <div class="form-group">
          <label class="form-label" for="zip-pack-name">Nom du Pack</label>
          <input id="zip-pack-name" class="form-input" bind:value={localPackName} placeholder="Nom du pack" />
        </div>

        <div class="form-group">
          <label class="form-label" for="zip-dest-select">Dossier de destination Grimoire</label>
          <select id="zip-dest-select" class="form-select" bind:value={localDestination}>
            <option value="maps">🗺️ public/maps (Cartes de bataille VTT)</option>
            <option value="tokens">🧙 public/tokens (Jetons de créatures / PJ)</option>
            <option value="tiles/custom">🧱 public/tiles/custom (Tuiles tactiques)</option>
            <option value="audio">🎵 public/audio (Pistes d'ambiance et bruitages)</option>
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

<!-- ─────────────────────────────────────────────────────────────────────── -->
<!-- Modal Plein Écran : Visionneuse Haute Résolution (Zoom & Pan HD)         -->
<!-- ─────────────────────────────────────────────────────────────────────── -->
{#if previewFile}
  {@const isDl = downloadingFiles.has(previewFile.id)}
  {@const onDisk = isFileOnDisk(previewFile)}
  <div class="lightbox-overlay" role="dialog" aria-modal="true" tabindex="-1">
    <!-- Top Header -->
    <div class="lightbox-header">
      <div class="lightbox-title-wrap">
        <span class="lightbox-badge">
          {#if previewFile.destination === 'maps'}🗺️ CARTE
          {:else if previewFile.destination === 'tiles/custom'}🧱 TEXTURE
          {:else}🎨 TAMPON{/if}
        </span>
        <strong class="lightbox-filename" title={previewFile.path}>{previewFile.name}</strong>
        <span class="lightbox-subpath">{previewFile.filename}</span>
      </div>

      <!-- Zoom & Action controls in header -->
      <div class="lightbox-controls">
        <button class="btn-ctrl" onclick={() => previewZoom = Math.max(previewZoom - 0.25, 0.2)} title="Zoom arrière (-)">🔍-</button>
        <span class="zoom-level">{Math.round(previewZoom * 100)}%</span>
        <button class="btn-ctrl" onclick={() => previewZoom = Math.min(previewZoom + 0.25, 4)} title="Zoom avant (+)">🔍+</button>
        <button class="btn-ctrl" onclick={() => { previewZoom = 1; previewPan = { x: 0, y: 0 }; }} title="Réinitialiser zoom (0)">↺ 100%</button>
        <div class="ctrl-divider"></div>
        <button class="btn-lightbox-close" onclick={closePreview} title="Fermer (Échap)">✕</button>
      </div>
    </div>

    <!-- Central Viewport with Zoom / Pan -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="lightbox-viewport"
      onwheel={handlePreviewWheel}
      onmousedown={handlePreviewMouseDown}
      onmousemove={handlePreviewMouseMove}
      onmouseup={handlePreviewMouseUp}
      onmouseleave={handlePreviewMouseUp}
    >
      <div
        class="lightbox-canvas"
        style="transform: translate({previewPan.x}px, {previewPan.y}px) scale({previewZoom}); cursor: {isDraggingPreview ? 'grabbing' : 'grab'}"
      >
        <img
          src={previewFile.highResUrl || previewFile.url}
          alt={previewFile.name}
          class="lightbox-img"
          referrerpolicy="no-referrer"
          draggable="false"
        />
      </div>

      <!-- Navigation Arrows -->
      <button class="lightbox-arrow left-arrow" onclick={(e) => { e.stopPropagation(); previewPrev(); }} title="Carte précédente (←)">
        ‹
      </button>
      <button class="lightbox-arrow right-arrow" onclick={(e) => { e.stopPropagation(); previewNext(); }} title="Carte suivante (→)">
        ›
      </button>
    </div>

    <!-- Bottom Actions Bar -->
    <div class="lightbox-footer">
      <div class="lightbox-footer-left">
        {#if onDisk}
          <span class="badge-disk-hd">✓ Enregistré sur votre PC (public/{previewFile.destination}/...)</span>
        {:else}
          <span class="badge-cloud-hd">☁️ Ressource en ligne (Haute Résolution)</span>
        {/if}
      </div>

      <div class="lightbox-footer-actions">
        <button
          class="btn-hd-download"
          class:btn-hd-done={onDisk}
          disabled={isDl}
          onclick={() => previewFile && downloadSingleFile(previewFile)}
        >
          {#if isDl}⏳ Téléchargement en cours…
          {:else if onDisk}💾 Re-télécharger
          {:else}⬇️ Télécharger sur PC{/if}
        </button>

        {#if previewFile.destination === 'maps'}
          <button class="btn-hd-vtt" onclick={() => previewFile && loadIntoVTT(previewFile, false)}>
            🎮 Projeter sur la Table Virtuelle
          </button>
          <button class="btn-hd-vtt-new" onclick={() => previewFile && loadIntoVTT(previewFile, true)} title="Créer une nouvelle scène">
            ➕ Nouvelle Scène VTT
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

{#if activePdfModal}
  <PdfReaderModal
    fileUrl={activePdfModal.url}
    fileName={activePdfModal.name}
    localPath={activePdfModal.localPath}
    onclose={() => activePdfModal = null}
  />
{/if}

<style>
  .overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.82);
    backdrop-filter: blur(6px);
    z-index: 1000;
    display: flex; align-items: center; justify-content: center;
    padding: 1rem;
  }
  .modal {
    background: #0c121c;
    border: 1px solid #1e293b;
    box-shadow: 0 24px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(56,189,248,0.25);
    border-radius: 14px;
    width: min(1240px, 96vw);
    height: 92vh;
    max-height: 92vh;
    display: flex; flex-direction: column;
    overflow: hidden;
    color: #e2e8f0;
  }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    padding: 0.9rem 1.4rem;
    border-bottom: 1px solid #1e293b;
    background: #111827;
    flex-shrink: 0;
  }
  .modal-title-wrap {
    display: flex; align-items: center; gap: 0.8rem;
  }
  .header-icon {
    font-size: 1.6rem;
    background: rgba(56,189,248,0.12);
    border: 1px solid rgba(56,189,248,0.3);
    padding: 6px 10px;
    border-radius: 8px;
  }
  .modal-header h2 { margin: 0; font-size: 1.15rem; color: #38bdf8; font-weight: 700; }
  .catalog-sub {
    font-size: 0.75rem; color: #94a3b8;
  }
  .tabs { display: flex; gap: .4rem; }
  .tabs button {
    padding: .45rem 1rem; border-radius: 6px;
    border: 1px solid transparent;
    background: #1e293b; color: #94a3b8; cursor: pointer;
    font-size: .85rem; font-weight: 600; transition: all .15s;
  }
  .tabs button:hover { background: #334155; color: #fff; }
  .tabs button.active {
    background: #0284c7;
    color: #fff;
    font-weight: 700;
    box-shadow: 0 2px 10px rgba(2,132,199,0.4);
  }
  .close-btn {
    background: none; border: none; color: #94a3b8;
    font-size: 1.2rem; cursor: pointer; padding: .2rem .5rem;
    border-radius: 4px;
  }
  .close-btn:hover { color: #fff; background: rgba(255,255,255,0.1); }

  /* Toast */
  .toast-bar {
    background: #0284c7; color: #fff; font-size: 0.85rem; font-weight: 600;
    padding: 6px 16px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    animation: slideDown 0.2s ease;
  }
  @keyframes slideDown {
    from { transform: translateY(-100%); }
    to { transform: translateY(0); }
  }

  .tab-content {
    flex: 1; display: flex; flex-direction: column; overflow: hidden;
  }

  /* Quick Nav Pills Bar */
  .drive-banner-bar {
    display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;
    padding: 0.6rem 1.4rem; background: #0b1320; border-bottom: 1px solid #1e293b; flex-shrink: 0;
  }
  .quick-nav-pills { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .quick-nav-label { font-size: 0.78rem; color: #64748b; font-weight: 600; }
  .nav-pill {
    background: #141d2b; border: 1px solid #1e293b; color: #cbd5e1; border-radius: 6px;
    padding: 4px 10px; font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: all 0.15s;
  }
  .nav-pill:hover { background: #1e293b; color: #fff; }
  .active-pill { background: #0369a1; border-color: #38bdf8; color: #fff; }

  .banner-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .folder-quick-links { display: flex; gap: 4px; }
  .btn-drive-link {
    background: #0284c7; color: #fff; border: 1px solid #38bdf8;
    border-radius: 6px; padding: 4px 10px; font-size: 0.78rem; font-weight: 600; cursor: pointer;
  }
  .btn-drive-link:hover { background: #0369a1; }
  .btn-open-folder {
    background: #131b26; color: #94a3b8; border: 1px solid #1e293b;
    border-radius: 6px; padding: 4px 8px; font-size: 0.75rem; cursor: pointer;
  }
  .btn-open-folder:hover { background: #1e293b; color: #e2e8f0; }

  /* Toolbar & Breadcrumbs */
  .toolbar {
    display: flex; align-items: center; gap: 12px; padding: 0.6rem 1.4rem;
    border-bottom: 1px solid #1e293b; background: #0e1522; flex-wrap: wrap; flex-shrink: 0;
  }
  .breadcrumbs-container {
    display: flex; align-items: center; gap: 8px; flex: 1; min-width: 280px; overflow-x: auto;
  }
  .btn-back {
    background: #1e293b; color: #38bdf8; border: 1px solid #334155; border-radius: 6px;
    padding: 4px 10px; font-size: 0.8rem; font-weight: 700; cursor: pointer; flex-shrink: 0;
  }
  .btn-back:hover { background: #334155; color: #fff; }
  .breadcrumbs-list { display: flex; align-items: center; gap: 4px; flex-wrap: nowrap; }
  .crumb-separator { color: #475569; font-size: 0.8rem; }
  .crumb-btn {
    background: none; border: none; color: #94a3b8; font-size: 0.82rem; font-weight: 600;
    cursor: pointer; padding: 2px 6px; border-radius: 4px; white-space: nowrap;
  }
  .crumb-btn:hover { background: #1e293b; color: #fff; }
  .crumb-active { color: #38bdf8; font-weight: 700; background: rgba(56,189,248,0.1); }

  .search-wrap {
    display: flex; align-items: center; position: relative; width: 280px;
  }
  .search-icon { position: absolute; left: 10px; font-size: 0.85rem; color: #64748b; }
  .search {
    width: 100%; padding: 5px 28px 5px 30px; border-radius: 6px;
    background: #141d2b; border: 1px solid #1e293b; color: #e2e8f0; font-size: 0.82rem; outline: none;
  }
  .search:focus { border-color: #38bdf8; }
  .clear-search { position: absolute; right: 8px; background: none; border: none; color: #64748b; cursor: pointer; }
  .btn-reload {
    background: #141d2b; border: 1px solid #1e293b; border-radius: 6px;
    color: #94a3b8; padding: 4px 10px; font-size: 0.85rem; cursor: pointer;
  }
  .btn-reload:hover { background: #1e293b; color: #fff; }

  /* Current Directory Banner */
  .current-dir-banner {
    display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;
    padding: 0.7rem 1.4rem; background: #111a28; border-bottom: 1px solid #1e293b; flex-shrink: 0;
  }
  .current-dir-info { display: flex; flex-direction: column; gap: 2px; }
  .dir-title-row { display: flex; align-items: center; gap: 8px; font-size: 0.95rem; color: #f8fafc; }
  .dir-icon { font-size: 1.1rem; }
  .dir-badge-count {
    font-size: 0.72rem; background: #1e293b; color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-weight: 700;
  }
  .dir-badge-dl {
    font-size: 0.72rem; background: #065f46; color: #6ee7b7; padding: 2px 6px; border-radius: 4px; font-weight: 700;
  }
  .dir-sub-path { font-size: 0.75rem; color: #64748b; }
  .current-dir-actions { display: flex; align-items: center; gap: 8px; }
  
  .btn-download-folder {
    background: #0284c7; color: #fff; border: 1px solid #38bdf8; border-radius: 6px;
    padding: 6px 14px; font-size: 0.82rem; font-weight: 700; cursor: pointer; transition: all 0.15s;
  }
  .btn-download-folder:hover { background: #0369a1; }

  .header-progress-wrap { min-width: 220px; display: flex; flex-direction: column; gap: 3px; }

  /* Main Explorer Scroll Body */
  .explorer-body {
    flex: 1; overflow-y: auto; padding: 1.2rem 1.4rem;
  }
  .section-title {
    font-size: 0.82rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;
    margin-bottom: 0.8rem;
  }

  /* Subfolders Grid */
  .folders-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 14px;
  }

  .folder-card {
    background: #111827; border: 1px solid #1e293b; border-radius: 10px; overflow: hidden;
    display: flex; flex-direction: column; transition: all 0.15s;
  }
  .folder-card:hover { border-color: #0284c7; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
  .folder-installed { border-color: #059669; }

  .folder-header-click {
    cursor: pointer; display: flex; flex-direction: column; flex: 1;
    background: none; border: none; padding: 0; text-align: left; color: inherit; width: 100%; font: inherit;
  }
  .folder-thumb-wrap {
    position: relative; width: 100%; height: 110px; background: #060b13; overflow: hidden;
    display: flex; align-items: center; justify-content: center;
  }
  .folder-thumb { width: 100%; height: 100%; object-fit: cover; }
  .folder-icon-placeholder { font-size: 3rem; color: #334155; }
  .folder-badge-dest {
    position: absolute; top: 6px; left: 6px; background: rgba(0,0,0,0.8);
    color: #38bdf8; font-size: 0.68rem; font-weight: 700; padding: 1px 6px; border-radius: 4px;
  }
  .folder-count-tag {
    position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.85);
    color: #fff; font-size: 0.7rem; font-weight: 600; padding: 1px 6px; border-radius: 4px;
  }

  .folder-info { padding: 0.7rem 0.9rem; flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .folder-name-row { display: flex; align-items: center; gap: 6px; }
  .folder-emoji { font-size: 0.95rem; }
  .folder-name {
    font-size: 0.88rem; font-weight: 700; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .folder-meta-row { display: flex; align-items: center; gap: 6px; font-size: 0.72rem; color: #64748b; }
  .sub-dl-count { color: #34d399; font-weight: 600; }

  .folder-footer-actions {
    padding: 0.5rem 0.9rem 0.7rem; border-top: 1px solid #1e293b; background: #0d1420;
    display: flex; gap: 6px;
  }
  .btn-enter-folder {
    flex: 1; background: #1e293b; color: #38bdf8; border: 1px solid #334155; border-radius: 6px;
    padding: 5px 8px; font-size: 0.78rem; font-weight: 600; cursor: pointer;
  }
  .btn-enter-folder:hover { background: #334155; color: #fff; }
  .btn-dl-subfolder {
    flex: 1.3; background: #0284c7; color: #fff; border: 1px solid #38bdf8; border-radius: 6px;
    padding: 5px 8px; font-size: 0.78rem; font-weight: 700; cursor: pointer;
  }
  .btn-dl-subfolder:hover { background: #0369a1; }
  .btn-sub-installed { background: #065f46; border-color: #10b981; color: #6ee7b7; }

  /* Files Grid */
  .files-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px;
  }
  .file-card {
    background: #111827; border: 1px solid #1e293b; border-radius: 8px; overflow: hidden;
    display: flex; flex-direction: column; transition: all 0.15s;
  }
  .file-card:hover { border-color: #38bdf8; transform: translateY(-2px); }
  .file-on-disk { border-color: #059669; }

  .file-thumb-wrap {
    position: relative; width: 100%; height: 120px; background: #060b13; overflow: hidden;
  }
  .file-thumb { width: 100%; height: 100%; object-fit: cover; }
  .badge-on-disk {
    position: absolute; bottom: 4px; right: 4px; background: #059669; color: #fff;
    font-size: 0.65rem; font-weight: 700; padding: 1px 6px; border-radius: 4px;
  }
  .btn-jump-folder {
    position: absolute; top: 4px; left: 4px; background: rgba(0,0,0,0.8); color: #38bdf8;
    border: 1px solid rgba(56,189,248,0.3); border-radius: 4px; font-size: 0.65rem; font-weight: 600;
    padding: 2px 6px; cursor: pointer;
  }
  .btn-jump-folder:hover { background: #0284c7; color: #fff; }

  .file-info { padding: 0.6rem 0.8rem; flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .file-name { font-size: 0.82rem; font-weight: 600; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .file-orig-name, .file-path-sub { font-size: 0.7rem; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .file-actions {
    display: flex; gap: 6px; padding: 0.5rem 0.8rem 0.7rem; border-top: 1px solid #1e293b; background: #0d1420;
  }
  .btn-file-dl {
    flex: 1; background: #1e293b; color: #38bdf8; border: 1px solid #334155;
    border-radius: 4px; padding: 4px 8px; font-size: 0.75rem; font-weight: 600; cursor: pointer;
  }
  .btn-file-dl:hover { background: #0284c7; color: #fff; }
  .btn-file-done { color: #34d399; }
  
  .btn-file-vtt {
    background: #312e81; color: #a5b4fc; border: 1px solid #4f46e5;
    border-radius: 4px; padding: 4px 8px; font-size: 0.75rem; font-weight: 700; cursor: pointer;
  }
  .btn-file-vtt:hover { background: #4338ca; color: #fff; }

  /* Progress bars */
  .pack-progress-wrap { width: 100%; display: flex; flex-direction: column; gap: 4px; }
  .pack-progress-bar { width: 100%; height: 7px; background: #1e293b; border-radius: 4px; overflow: hidden; }
  .pack-progress-fill { height: 100%; background: #38bdf8; transition: width 0.15s ease; }
  .pack-progress-text { display: flex; justify-content: space-between; font-size: 0.7rem; color: #94a3b8; }
  .file-name-cut { max-width: 130px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* Loading & Empty States */
  .loading-box, .empty-box, .error-box {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 60px 20px; text-align: center; color: #94a3b8; gap: 12px;
  }
  .spinner { font-size: 2rem; }
  .btn-reset, .btn-retry {
    background: #0284c7; color: #fff; border: none; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600;
  }

  /* Installed Tab */
  .installed-header {
    display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.4rem; border-bottom: 1px solid #1e293b; background: #0b1320; flex-wrap: wrap; gap: 10px;
  }
  .installed-header h3 { margin: 0 0 4px; font-size: 1rem; color: #e2e8f0; }
  .installed-header p { margin: 0; font-size: 0.8rem; color: #64748b; }
  .installed-header-actions { display: flex; gap: 8px; }
  .installed-list-wrap { flex: 1; overflow-y: auto; padding: 1.2rem 1.4rem; }
  .installed-list { display: flex; flex-direction: column; gap: 10px; }
  .installed-row {
    display: flex; align-items: center; gap: 14px; padding: 10px 14px; background: #111827; border: 1px solid #1e293b; border-radius: 8px;
  }
  .inst-icon { font-size: 1.5rem; }
  .inst-details { flex: 1; }
  .inst-title-line { display: flex; align-items: center; gap: 8px; font-size: 0.92rem; color: #f1f5f9; }
  .badge-dest { font-size: 0.7rem; background: #1e293b; color: #38bdf8; padding: 1px 6px; border-radius: 4px; }
  .inst-meta { font-size: 0.75rem; color: #64748b; margin-top: 2px; }
  .inst-row-actions { display: flex; gap: 8px; }
  .btn-uninstall {
    background: #7f1d1d; color: #fca5a5; border: 1px solid #ef4444; border-radius: 6px; padding: 4px 10px; font-size: 0.78rem; cursor: pointer;
  }
  .btn-uninstall:hover { background: #991b1b; color: #fff; }

  /* Import Tab */
  .import-panel { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2rem; }
  .import-card {
    background: #111827; border: 2px dashed #334155; border-radius: 12px; padding: 3rem; text-align: center; max-width: 500px;
  }
  .import-card h3 { margin: 0 0 8px; color: #e2e8f0; }
  .import-card p { font-size: 0.85rem; color: #94a3b8; margin-bottom: 1.5rem; }
  .btn-big-import {
    background: #0284c7; color: #fff; border: 1px solid #38bdf8; padding: 10px 20px; font-size: 0.95rem; font-weight: 700; border-radius: 8px; cursor: pointer;
  }
  .btn-big-import:hover { background: #0369a1; }

  /* Sub-Modal (Local Import) */
  .sub-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(4px);
    z-index: 1200; display: flex; align-items: center; justify-content: center; padding: 1rem;
  }
  .sub-modal {
    background: #0f141c; border: 1px solid #2a3447; border-radius: 12px;
    width: min(520px, 92vw); display: flex; flex-direction: column; overflow: hidden;
  }
  .sub-modal-header {
    display: flex; align-items: center; justify-content: space-between; padding: 0.9rem 1.2rem;
    border-bottom: 1px solid #1e293b; background: #141b26;
  }
  .sub-modal-header h3 { margin: 0; font-size: 1rem; color: #38bdf8; font-weight: 700; }
  .sub-modal-body { padding: 1.2rem; display: flex; flex-direction: column; gap: 12px; }
  .form-group { display: flex; flex-direction: column; gap: 4px; }
  .form-label { font-size: 0.78rem; font-weight: 600; color: #94a3b8; }
  .path-preview {
    background: #0a0f16; border: 1px solid #1e293b; border-radius: 6px; padding: 6px 10px;
    font-size: 0.75rem; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .form-input, .form-select {
    background: #0a0f16; border: 1px solid #1e293b; border-radius: 6px; padding: 7px 10px;
    color: #e2e8f0; font-size: 0.85rem; outline: none;
  }
  .form-input:focus, .form-select:focus { border-color: #38bdf8; }
  .sub-modal-footer {
    padding: 0.8rem 1.2rem; border-top: 1px solid #1e293b; background: #141b26;
    display: flex; justify-content: flex-end; gap: 8px;
  }
  .btn-confirm-import {
    background: #0284c7; color: #fff; border: 1px solid #38bdf8; padding: 6px 16px;
    border-radius: 6px; font-size: 0.85rem; font-weight: 700; cursor: pointer;
  }
  .btn-confirm-import:hover { background: #0369a1; }
  .btn-cancel {
    background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 0.85rem;
  }
  .btn-cancel:hover { background: #334155; color: #fff; }

  /* ── Lightbox HD Preview ─────────────────────────────────────────────────── */
  .btn-inspect-hd {
    position: absolute; top: 6px; right: 6px;
    background: rgba(15, 23, 42, 0.85); color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 4px;
    padding: 2px 7px; font-size: 0.72rem; font-weight: 700;
    cursor: pointer; opacity: 0.9; transition: all 0.15s;
    backdrop-filter: blur(4px);
  }
  .btn-inspect-hd:hover {
    background: #0284c7; color: #fff; border-color: #38bdf8;
    transform: scale(1.05); box-shadow: 0 0 10px rgba(56,189,248,0.5);
  }

  .file-thumb-wrap {
    cursor: pointer;
  }
  .file-thumb-wrap:hover .btn-inspect-hd {
    opacity: 1;
  }

  .lightbox-overlay {
    position: fixed; inset: 0;
    background: rgba(2, 6, 12, 0.94);
    backdrop-filter: blur(10px);
    z-index: 2000;
    display: flex; flex-direction: column;
    color: #f1f5f9; overflow: hidden;
    animation: fadeIn 0.15s ease-out;
  }

  .lightbox-header {
    height: 54px; padding: 0 1.2rem;
    background: #0b1320; border-bottom: 1px solid #1e293b;
    display: flex; align-items: center; justify-content: space-between;
    gap: 1rem; flex-shrink: 0; z-index: 10;
  }
  .lightbox-title-wrap {
    display: flex; align-items: center; gap: 10px; overflow: hidden;
  }
  .lightbox-badge {
    background: #0284c7; color: #fff; font-size: 0.68rem; font-weight: 800;
    padding: 2px 7px; border-radius: 4px; letter-spacing: 0.5px;
  }
  .lightbox-filename {
    font-size: 0.95rem; color: #f8fafc; font-weight: 700;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .lightbox-subpath {
    font-size: 0.75rem; color: #64748b; font-family: monospace;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .lightbox-controls {
    display: flex; align-items: center; gap: 6px;
  }
  .btn-ctrl {
    background: #1e293b; color: #cbd5e1; border: 1px solid #334155;
    border-radius: 6px; padding: 4px 10px; font-size: 0.8rem; font-weight: 600;
    cursor: pointer; transition: all 0.12s;
  }
  .btn-ctrl:hover { background: #334155; color: #fff; }
  .zoom-level { font-size: 0.8rem; font-family: monospace; color: #38bdf8; min-width: 44px; text-align: center; }
  .ctrl-divider { width: 1px; height: 20px; background: #334155; margin: 0 4px; }
  .btn-lightbox-close {
    background: #ef4444; color: #fff; border: none;
    border-radius: 6px; width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1rem; font-weight: 700; cursor: pointer;
  }
  .btn-lightbox-close:hover { background: #dc2626; }

  .lightbox-viewport {
    flex: 1; position: relative; overflow: hidden;
    display: flex; align-items: center; justify-content: center;
    user-select: none;
  }
  .lightbox-canvas {
    transition: transform 0.05s ease-out;
    display: flex; align-items: center; justify-content: center;
    transform-origin: center center;
  }
  .lightbox-img {
    max-width: 88vw; max-height: 80vh;
    object-fit: contain;
    border-radius: 4px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.8);
    pointer-events: none;
  }

  .lightbox-arrow {
    position: absolute; top: 50%; transform: translateY(-50%);
    background: rgba(15, 23, 42, 0.7); color: #fff;
    border: 1px solid rgba(255,255,255,0.15); border-radius: 50%;
    width: 48px; height: 48px; font-size: 2rem; line-height: 1;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all 0.15s; backdrop-filter: blur(6px);
    z-index: 20;
  }
  .lightbox-arrow:hover {
    background: #0284c7; border-color: #38bdf8; transform: translateY(-50%) scale(1.1);
  }
  .left-arrow { left: 20px; }
  .right-arrow { right: 20px; }

  .lightbox-footer {
    height: 56px; padding: 0 1.5rem;
    background: #0b1320; border-top: 1px solid #1e293b;
    display: flex; align-items: center; justify-content: space-between;
    gap: 1rem; flex-shrink: 0; z-index: 10;
  }
  .badge-disk-hd { font-size: 0.8rem; color: #34d399; font-weight: 600; }
  .badge-cloud-hd { font-size: 0.8rem; color: #38bdf8; font-weight: 600; }

  .lightbox-footer-actions {
    display: flex; align-items: center; gap: 8px;
  }
  .btn-hd-download {
    background: #0284c7; color: #fff; border: 1px solid #38bdf8;
    border-radius: 6px; padding: 6px 14px; font-size: 0.82rem; font-weight: 700;
    cursor: pointer; transition: all 0.15s;
  }
  .btn-hd-download:hover { background: #0369a1; }
  .btn-hd-done { background: #065f46; border-color: #10b981; color: #a7f3d0; }
  .btn-hd-vtt {
    background: linear-gradient(135deg, #7c3aed, #6366f1);
    color: #fff; border: 1px solid #a78bfa;
    border-radius: 6px; padding: 6px 14px; font-size: 0.82rem; font-weight: 700;
    cursor: pointer; transition: all 0.15s;
  }
  .btn-hd-vtt:hover { background: linear-gradient(135deg, #6d28d9, #4f46e5); box-shadow: 0 0 14px rgba(124,58,237,0.4); }
  .btn-hd-vtt-new {
    background: #1e293b; color: #c4b5fd; border: 1px solid #6d28d9;
    border-radius: 6px; padding: 6px 12px; font-size: 0.8rem; font-weight: 600; cursor: pointer;
  }
  .btn-hd-vtt-new:hover { background: #2e1065; color: #fff; }

  /* PDF Card styles */
  .pdf-card-cover {
    width: 100%; height: 100%;
    background: linear-gradient(145deg, #1e1b4b, #0f172a);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 6px; border-radius: 6px; border: 1px solid #4338ca;
  }
  .pdf-icon-big { font-size: 2.4rem; }
  .pdf-tag-cover {
    font-size: 0.65rem; font-weight: 800; color: #a5b4fc;
    letter-spacing: 0.5px; background: rgba(0,0,0,0.5); padding: 2px 6px; border-radius: 4px;
  }
  .btn-file-pdf {
    background: #4338ca; border: 1px solid #6366f1; border-radius: 6px;
    color: #e0e7ff; font-size: 0.72rem; font-weight: 700; padding: 4px 8px; cursor: pointer;
    transition: all 0.15s;
  }
  .btn-file-pdf:hover { background: #4f46e5; color: #fff; box-shadow: 0 0 10px rgba(99,102,241,0.4); }
</style>
