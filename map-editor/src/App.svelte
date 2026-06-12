<script lang="ts">
  import { onMount } from 'svelte';
  import LeftToolbar from './components/LeftToolbar.svelte';
  import TopPanel from './components/TopPanel.svelte';
  import MapCanvas from './components/MapCanvas.svelte';
  import RightPanel from './components/RightPanel.svelte';
  import CatalogModal from './components/CatalogModal.svelte';
  import TextureCatalogModal from './components/TextureCatalogModal.svelte';
  import { mapStore, pushHistory } from './lib/stores/mapStore.svelte';

  // Référence locale vers le canevas pour appeler des actions depuis la barre d'outils
  let canvasComponent = $state<any>(null);

  // Exporter la carte en image PNG
  function handleExport() {
    if (canvasComponent && canvasComponent.exportMapPng) {
      canvasComponent.exportMapPng();
    } else {
      const canvasEl = document.querySelector('canvas');
      if (canvasEl) {
        // Fallback : télécharger directement le contenu du canevas écran
        const url = canvasEl.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = 'fantasy-map.png';
        a.click();
      }
    }
  }

  // Vider complètement la carte de ses éléments
  function handleClear() {
    if (confirm('Voulez-vous vraiment vider toute la carte ? Cette action effacera tampons, tracés, textes, formes et terrain (annulable avec Ctrl+Z).')) {
      pushHistory(true);
      mapStore.stamps = [];
      mapStore.paths = [];
      mapStore.texts = [];
      mapStore.shapes = [];
      mapStore.selectedIds = [];
      mapStore.selectedElement = null;
      mapStore.guides = { v: [], h: [] };
      // Réinitialiser le terrain raster (masque de terre + textures peintes)
      if (canvasComponent && canvasComponent.resetTerrain) {
        canvasComponent.resetTerrain();
      }
    }
  }

  // Finaliser le tracé en cours
  function handleFinishPath() {
    if (canvasComponent && canvasComponent.finishPath) {
      canvasComponent.finishPath();
    }
  }

  // Supprimer l'élément sélectionné
  function handleDeleteSelected() {
    if (canvasComponent && canvasComponent.deleteSelected) {
      canvasComponent.deleteSelected();
    }
  }

  // Construire l'objet projet complet (terrain raster inclus si demandé)
  function buildProjectData(includeTerrain = true) {
    return {
      version: 2,
      mapTitle: mapStore.mapTitle,
      guides: mapStore.guides,
      // Terrain sculpté/peint en PNG base64 — sans lui, recharger un projet
      // perdait tout le travail au pinceau
      terrain: includeTerrain && canvasComponent?.getTerrainData ? canvasComponent.getTerrainData() : null,
      stamps: mapStore.stamps,
      paths: mapStore.paths,
      texts: mapStore.texts,
      shapes: mapStore.shapes,
      backgroundType: mapStore.backgroundType,
      backgroundTexture: mapStore.backgroundTexture,
      backgroundTextureScale: mapStore.backgroundTextureScale,
      backgroundImageUrl: mapStore.backgroundImageUrl,
      backgroundImageScale: mapStore.backgroundImageScale,
      backgroundImageX: mapStore.backgroundImageX,
      backgroundImageY: mapStore.backgroundImageY,
      backgroundImageOpacity: mapStore.backgroundImageOpacity,
      foregroundOpacity: mapStore.foregroundOpacity,
      canvasWidth: mapStore.canvasWidth,
      canvasHeight: mapStore.canvasHeight,
      showGrid: mapStore.showGrid,
      gridType: mapStore.gridType,
      gridSize: mapStore.gridSize,
      gridColor: mapStore.gridColor,
      mapFilter: mapStore.mapFilter,
      mapFilterIntensity: mapStore.mapFilterIntensity,
      vignetteEnabled: mapStore.vignetteEnabled,
      vignetteOpacity: mapStore.vignetteOpacity,
      paperOverlayEnabled: mapStore.paperOverlayEnabled,
      paperOverlayOpacity: mapStore.paperOverlayOpacity,
      stampSnapEnabled: mapStore.stampSnapEnabled,
      stampSnapMode: mapStore.stampSnapMode,
    };
  }

  // Exporter en fichier JSON de sauvegarde
  function saveProjectJson() {
    const data = buildProjectData(true);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (mapStore.mapTitle || '').replace(/[\\/:*?"<>|]+/g, '').trim() || 'cartography-project';
    a.download = `${safeName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Appliquer un objet projet au store (chargement fichier ou auto-sauvegarde)
  function applyProjectData(data: any) {
    if (data.stamps) mapStore.stamps = data.stamps;
        if (data.paths) mapStore.paths = data.paths;
        if (data.texts) mapStore.texts = data.texts;
        if (data.shapes) mapStore.shapes = data.shapes;
        if (data.mapTitle !== undefined) mapStore.mapTitle = data.mapTitle;
        if (data.guides) mapStore.guides = data.guides;
        
        // Restaurer les réglages supplémentaires de carte
        if (data.backgroundType) mapStore.backgroundType = data.backgroundType;
        if (data.backgroundTexture) mapStore.backgroundTexture = data.backgroundTexture;
        if (data.backgroundTextureScale !== undefined) mapStore.backgroundTextureScale = data.backgroundTextureScale;
        if (data.backgroundImageUrl !== undefined) mapStore.backgroundImageUrl = data.backgroundImageUrl;
        if (data.backgroundImageScale !== undefined) mapStore.backgroundImageScale = data.backgroundImageScale;
        if (data.backgroundImageX !== undefined) mapStore.backgroundImageX = data.backgroundImageX;
        if (data.backgroundImageY !== undefined) mapStore.backgroundImageY = data.backgroundImageY;
        if (data.backgroundImageOpacity !== undefined) mapStore.backgroundImageOpacity = data.backgroundImageOpacity;
        if (data.foregroundOpacity !== undefined) mapStore.foregroundOpacity = data.foregroundOpacity;
        if (data.canvasWidth) mapStore.canvasWidth = data.canvasWidth;
        if (data.canvasHeight) mapStore.canvasHeight = data.canvasHeight;
        if (data.showGrid !== undefined) mapStore.showGrid = data.showGrid;
        if (data.gridType) mapStore.gridType = data.gridType;
        if (data.gridSize) mapStore.gridSize = data.gridSize;
        if (data.gridColor) mapStore.gridColor = data.gridColor;

        if (data.mapFilter) mapStore.mapFilter = data.mapFilter;
        if (data.mapFilterIntensity !== undefined) mapStore.mapFilterIntensity = data.mapFilterIntensity;
        if (data.vignetteEnabled !== undefined) mapStore.vignetteEnabled = data.vignetteEnabled;
        if (data.vignetteOpacity !== undefined) mapStore.vignetteOpacity = data.vignetteOpacity;
        if (data.paperOverlayEnabled !== undefined) mapStore.paperOverlayEnabled = data.paperOverlayEnabled;
        if (data.paperOverlayOpacity !== undefined) mapStore.paperOverlayOpacity = data.paperOverlayOpacity;
        if (data.stampSnapEnabled !== undefined) mapStore.stampSnapEnabled = data.stampSnapEnabled;
        if (data.stampSnapMode) mapStore.stampSnapMode = data.stampSnapMode;

    // Restaurer le terrain raster (projets v2)
    if (data.terrain && canvasComponent?.setTerrainData) {
      canvasComponent.setTerrainData(data.terrain);
    }

    mapStore.selectedElement = null;
    mapStore.selectedIds = [];
  }

  // Charger depuis un fichier JSON de sauvegarde
  function loadProjectJson(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        applyProjectData(JSON.parse(event.target?.result as string));
      } catch (err) {
        alert('Fichier de sauvegarde invalide.');
      }
    };
    reader.readAsText(file);
  }

  // ── Auto-sauvegarde locale (protection contre crash / fermeture) ──
  const AUTOSAVE_KEY = 'map_editor_autosave_v1';

  function saveAutosave() {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(buildProjectData(true)));
    } catch {
      // Quota localStorage dépassé (terrain volumineux) : sauver sans terrain
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(buildProjectData(false)));
      } catch {}
    }
  }

  // Bannière non bloquante de restauration (un confirm() natif gèlerait le démarrage)
  let pendingAutosave = $state<any>(null);

  function restoreAutosave() {
    if (pendingAutosave) applyProjectData(pendingAutosave);
    pendingAutosave = null;
  }

  function dismissAutosave() {
    pendingAutosave = null;
  }

  onMount(() => {
    // Proposer la restauration d'une session précédente
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const hasContent =
          data.stamps?.length || data.texts?.length || data.shapes?.length ||
          data.paths?.length || data.terrain;
        if (hasContent) pendingAutosave = data;
      }
    } catch {}

    const autosaveTimer = setInterval(saveAutosave, 60_000);
    window.addEventListener('beforeunload', saveAutosave);
    return () => {
      clearInterval(autosaveTimer);
      window.removeEventListener('beforeunload', saveAutosave);
    };
  });
</script>

<main class="app-layout">
  <!-- Canvas en arrière-plan à 100% de l'écran -->
  <div class="canvas-viewport">
    <MapCanvas
      bind:this={canvasComponent}
    />
  </div>

  <!-- Barre supérieure de navigation rapide (TopPanel) -->
  <TopPanel 
    onExport={handleExport}
    onSave={saveProjectJson}
    onLoad={loadProjectJson}
    onClear={handleClear}
  />

  <!-- Barre latérale outils gauche (flottante) -->
  <LeftToolbar onSave={saveProjectJson} />

  <!-- Panneau flottant gauche (regroupant les réglages de l'outil actif) -->
  <RightPanel
    onFinishPath={handleFinishPath}
    onDeleteSelected={handleDeleteSelected}
  />

  <!-- Catalogue d'assets (Modal) -->
  <CatalogModal />
  <TextureCatalogModal />

  <!-- Bannière de restauration d'auto-sauvegarde -->
  {#if pendingAutosave}
    <div class="autosave-banner">
      <span>💾 Une auto-sauvegarde de votre dernière session a été trouvée.</span>
      <button class="autosave-btn restore" onclick={restoreAutosave}>Restaurer</button>
      <button class="autosave-btn" onclick={dismissAutosave}>Ignorer</button>
    </div>
  {/if}
</main>

<style>
  /* Reset global */
  :global(body) {
    margin: 0;
    padding: 0;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background-color: var(--bg-dark-tertiary);
    color: var(--color-text-primary);
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }

  .app-layout {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }

  .canvas-viewport {
    position: absolute;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 10;
  }

  .autosave-banner {
    position: fixed;
    bottom: 52px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(11, 14, 23, 0.95);
    border: 1px solid rgba(212, 168, 75, 0.4);
    color: #e5c383;
    font-size: 12px;
    padding: 10px 16px;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
    z-index: 300;
  }

  .autosave-btn {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    color: #c9d1d9;
    font-size: 12px;
    padding: 4px 12px;
    cursor: pointer;
  }
  .autosave-btn:hover { background: rgba(255, 255, 255, 0.06); }
  .autosave-btn.restore {
    background: rgba(212, 168, 75, 0.15);
    border-color: rgba(212, 168, 75, 0.5);
    color: #e5a853;
    font-weight: 600;
  }
  .autosave-btn.restore:hover { background: rgba(212, 168, 75, 0.3); }

  /* Style global pour positionner absolument LeftToolbar sous le TopPanel */
  :global(.left-nav) {
    position: absolute;
    left: 0;
    top: var(--editor-top-nav-height) !important;
    height: calc(100vh - var(--editor-top-nav-height)) !important;
    z-index: 100;
  }

  /* Style global pour positionner absolument TopPanel en haut de la page */
  :global(.top-panel) {
    position: absolute;
    top: 0;
    left: 0;
    width: 100vw;
    z-index: 130;
  }
</style>
