<script lang="ts">
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

  // Exporter en fichier JSON de sauvegarde
  function saveProjectJson() {
    const data = {
      version: 1,
      mapTitle: mapStore.mapTitle,
      guides: mapStore.guides,
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
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (mapStore.mapTitle || '').replace(/[\\/:*?"<>|]+/g, '').trim() || 'cartography-project';
    a.download = `${safeName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Charger depuis un fichier JSON de sauvegarde
  function loadProjectJson(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
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

        mapStore.selectedElement = null;
      } catch (err) {
        alert('Fichier de sauvegarde invalide.');
      }
    };
    reader.readAsText(file);
  }
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
