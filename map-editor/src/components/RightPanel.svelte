<script lang="ts">
  import { mapStore } from '../lib/stores/mapStore.svelte';
  import { invoke } from '@tauri-apps/api/core';

  // Recevoir des callbacks du canevas pour certaines actions (ex: supprimer ou finir un tracé)
  let {
    onFinishPath = () => {},
    onDeleteSelected = () => {}
  }: {
    onFinishPath?: () => void;
    onDeleteSelected?: () => void;
  } = $props();

  // Liste de polices d'écriture médiévales Google Fonts
  const FONTS = [
    { id: 'Cinzel', name: 'Cinzel' },
    { id: 'MedievalSharp', name: 'MedievalSharp' },
    { id: 'Macondo', name: 'Macondo' },
    { id: 'Uncial Antiqua', name: 'Uncial Antiqua' },
    { id: 'serif', name: 'Standard Serif' },
  ];

  interface TextureItem {
    id: string;
    name: string;
    color: string;
    file?: string;
    isImported?: boolean;
  }

  // Liste des Textures pour le mode Monde (Isométrique)
  const TEXTURES_ISO: TextureItem[] = [
    { id: 'parchment', name: 'Parchemin', file: 'parchment.png', color: '#c2a679' },
    { id: 'grass', name: 'Prairie', file: 'grass.png', color: '#688e50' },
    { id: 'sand', name: 'Sable', file: 'sand.png', color: '#d2b48c' },
    { id: 'rock', name: 'Roche', file: 'rock.png', color: '#888888' },
    { id: 'water', name: 'Mer', file: 'water.png', color: '#4a6f8a' },
  ];



  import importedStamps from '../lib/imported_stamps.json';
  import importedTextures from '../lib/imported_textures.json';

  interface StampItem {
    id: string;
    name: string;
    variants: string[];
    file?: string;
    icon?: string;
  }

  // Liste des Tampons (Stamps) pour le mode Monde (Isométrique)
  const DEFAULT_STAMPS_ISO: StampItem[] = [
    { id: 'mountain', name: 'Montagne', file: '/assets/stamps/mountain.png', icon: '⛰️', variants: ['mountain'] },
    { id: 'mountain_snowy', name: 'M. Enneigée', file: '/assets/stamps/mountain_snowy.png', icon: '🏔️', variants: ['mountain_snowy'] },
    { id: 'volcano', name: 'Volcan', file: '/assets/stamps/volcano.png', icon: '🌋', variants: ['volcano'] },
    { 
      id: 'tree', 
      name: 'Sapins & Feuillus', 
      file: '/assets/stamps/tree_variant_1.png', 
      icon: '🌲', 
      variants: ['tree_variant_1', 'tree_variant_2', 'tree_variant_3', 'tree_variant_4', 'tree_variant_5', 'tree_variant_6'] 
    },
    { id: 'castle', name: 'Château', file: '/assets/stamps/castle.png', icon: '🏰', variants: ['castle'] },
    { id: 'tower', name: 'Tour Majeure', file: '/assets/stamps/tower.png', icon: '🗼', variants: ['tower'] },
    { id: 'village', name: 'Hameau', file: '/assets/stamps/village.png', icon: '🏠', variants: ['village'] },
    { id: 'ship', name: 'Galion', file: '/assets/stamps/ship.png', icon: '⛵', variants: ['ship'] },
    { id: 'sea_monster', name: 'Kraken', file: '/assets/stamps/sea_monster.png', icon: '🦑', variants: ['sea_monster'] },
    { id: 'compass', name: 'Boussole', file: '/assets/stamps/compass.png', icon: '🧭', variants: ['compass'] },
    { id: 'banner', name: 'Bannière', file: '/assets/stamps/banner.png', icon: '📜', variants: ['banner'] },
  ];

  const STAMPS_ISO: StampItem[] = [...DEFAULT_STAMPS_ISO, ...importedStamps];



  // Dérivations réactives pour Svelte 5
  let activeTextures = $derived(TEXTURES_ISO);
  let activeStamps = $derived(DEFAULT_STAMPS_ISO);

  // Tous les tampons possibles pour retrouver les infos des favoris
  let allPossibleStamps = $derived([
    ...DEFAULT_STAMPS_ISO,
    ...(importedStamps as any[]).map(s => ({
      id: s.id,
      name: s.name,
      file: s.file,
      icon: s.icon || '🎨',
      variants: s.variants || [s.id]
    }))
  ]);

  // Filtrer pour n'avoir que les favoris de l'utilisateur
  let favoriteStampsList = $derived(
    allPossibleStamps.filter(stamp => 
      mapStore.favoriteStamps.includes(stamp.id) || 
      stamp.variants?.some((v: string) => mapStore.favoriteStamps.includes(v))
    )
  );

  // Si l'utilisateur a des favoris, on affiche ses favoris, sinon les stamps par défaut
  let quickPickerStamps = $derived(
    favoriteStampsList.length > 0 
      ? favoriteStampsList 
      : activeStamps
  );

  // Toutes les textures possibles pour retrouver les infos des favoris
  let allPossibleTextures = $derived([
    ...TEXTURES_ISO,
    ...(importedTextures as any[]).map(t => ({
      id: t.id,
      name: t.name,
      file: t.file,
      color: t.color || '#888888',
      category: t.category
    }))
  ]);

  // Filtrer pour n'avoir que les textures favorites de l'utilisateur
  let favoriteTexturesList = $derived(
    allPossibleTextures.filter(t => mapStore.favoriteTextures.includes(t.id))
  );

  // Si l'utilisateur a des textures favorites, on les affiche en priorité, sinon les textures de base
  let quickPickerTextures = $derived(
    favoriteTexturesList.length > 0 
      ? favoriteTexturesList 
      : activeTextures
  );

  let currentTextureDetails = $derived.by(() => {
    const defaultTex = activeTextures.find(t => t.id === mapStore.paintTexture);
    if (defaultTex) return defaultTex;

    const importedTex = (importedTextures as any[]).find((t: any) => t.id === mapStore.paintTexture);
    if (importedTex) {
      return {
        id: importedTex.id,
        name: importedTex.name,
        color: '#888888',
        file: importedTex.file,
        isImported: true
      };
    }
    return null;
  });

  let currentBackgroundTextureDetails = $derived.by(() => {
    const defaultTex = activeTextures.find(t => t.id === mapStore.backgroundTexture);
    if (defaultTex) return defaultTex;

    const importedTex = (importedTextures as any[]).find((t: any) => t.id === mapStore.backgroundTexture);
    if (importedTex) {
      return {
        id: importedTex.id,
        name: importedTex.name,
        color: '#888888',
        file: importedTex.file,
        isImported: true
      };
    }
    return null;
  });

  // Trouver le groupe de tampons actif
  let activeStampGroup = $derived.by(() => {
    // Chercher d'abord dans les tampons par défaut (actifs ou non)
    const defaultGroup = DEFAULT_STAMPS_ISO.find(s => s.variants?.includes(mapStore.activeStamp));
    if (defaultGroup) return defaultGroup;



    // Chercher dans les importés
    const importedGroup = (importedStamps as any[]).find((s: any) => s.id === mapStore.activeStamp || s.variants?.includes(mapStore.activeStamp));
    if (importedGroup) return importedGroup;

    return DEFAULT_STAMPS_ISO[0];
  });

  // Index de la variante sélectionnée
  let selectedVariantIndex = $derived.by(() => {
    if (!activeStampGroup || !activeStampGroup.variants) return 0;
    return activeStampGroup.variants.indexOf(mapStore.activeStamp);
  });

  // Fichier ou emoji du tampon sélectionné
  let selectedStampFile = $derived.by(() => {
    if (!activeStampGroup) return '';
    if (activeStampGroup.id === 'tree') {
      return `/assets/stamps/${mapStore.activeStamp}.png`;
    }
    return activeStampGroup.file || '';
  });

  let selectedStampName = $derived.by(() => {
    if (!activeStampGroup) return 'Tampon';
    if (activeStampGroup.id === 'tree') {
      const idx = selectedVariantIndex;
      switch (idx) {
        case 0: return 'Sapin Simple';
        case 1: return 'Double Sapin';
        case 2: return 'Bosquet Sapins';
        case 3: return 'Feuillu Simple';
        case 4: return 'Double Feuillu';
        case 5: return 'Bosquet Feuillus';
        default: return 'Variante Arbre';
      }
    }
    return activeStampGroup.name;
  });

  // Tampon sélectionné s'il y a lieu
  let selectedStampObject = $derived(
    mapStore.selectedElement && mapStore.selectedElement.type === 'stamp'
      ? mapStore.stamps.find(s => s.id === mapStore.selectedElement!.id)
      : null
  );

  // Valeurs réactives s'adaptant à l'élément sélectionné ou au défaut du store
  let currentStampScale = $derived(selectedStampObject ? selectedStampObject.scale : mapStore.stampScale);
  let currentStampRotation = $derived(selectedStampObject ? selectedStampObject.rotation : mapStore.stampRotation);
  let currentStampOpacity = $derived(selectedStampObject ? selectedStampObject.opacity : mapStore.stampOpacity);
  let currentStampZIndex = $derived(selectedStampObject ? selectedStampObject.zIndex : 0);

  let currentShadowEnabled = $derived(selectedStampObject ? !!selectedStampObject.shadowEnabled : mapStore.stampShadowEnabled);
  let currentShadowBlur = $derived(selectedStampObject ? selectedStampObject.shadowBlur ?? 10 : mapStore.stampShadowBlur);
  let currentShadowColor = $derived(selectedStampObject ? selectedStampObject.shadowColor ?? 'rgba(0, 0, 0, 0.4)' : mapStore.stampShadowColor);
  let currentShadowOffsetX = $derived(selectedStampObject ? selectedStampObject.shadowOffsetX ?? 5 : mapStore.stampShadowOffsetX);
  let currentShadowOffsetY = $derived(selectedStampObject ? selectedStampObject.shadowOffsetY ?? 5 : mapStore.stampShadowOffsetY);

  function handleScaleInput(val: number) {
    if (selectedStampObject) {
      selectedStampObject.scale = val;
    } else {
      mapStore.stampScale = val;
    }
  }

  function handleRotationInput(val: number) {
    if (selectedStampObject) {
      selectedStampObject.rotation = val;
    } else {
      mapStore.stampRotation = val;
    }
  }

  function handleOpacityInput(val: number) {
    if (selectedStampObject) {
      selectedStampObject.opacity = val;
    } else {
      mapStore.stampOpacity = val;
    }
  }

  function handleZIndexInput(val: number) {
    if (selectedStampObject) {
      selectedStampObject.zIndex = val;
    }
  }

  function handleShadowEnabledInput(val: boolean) {
    if (selectedStampObject) {
      selectedStampObject.shadowEnabled = val;
    } else {
      mapStore.stampShadowEnabled = val;
    }
  }

  function handleShadowBlurInput(val: number) {
    if (selectedStampObject) {
      selectedStampObject.shadowBlur = val;
    } else {
      mapStore.stampShadowBlur = val;
    }
  }

  function handleShadowColorInput(val: string) {
    if (selectedStampObject) {
      selectedStampObject.shadowColor = val;
    } else {
      mapStore.stampShadowColor = val;
    }
  }

  function handleShadowOffsetXInput(val: number) {
    if (selectedStampObject) {
      selectedStampObject.shadowOffsetX = val;
    } else {
      mapStore.stampShadowOffsetX = val;
    }
  }

  function handleShadowOffsetYInput(val: number) {
    if (selectedStampObject) {
      selectedStampObject.shadowOffsetY = val;
    } else {
      mapStore.stampShadowOffsetY = val;
    }
  }

  // Passer au tampon suivant dans l'ensemble (Set variant)
  function nextStamp() {
    if (!activeStampGroup || !activeStampGroup.variants) return;
    const idx = selectedVariantIndex;
    if (idx === -1) return;
    const nextIdx = (idx + 1) % activeStampGroup.variants.length;
    mapStore.activeStamp = activeStampGroup.variants[nextIdx];
  }

  // Passer au tampon précédent
  function prevStamp() {
    if (!activeStampGroup || !activeStampGroup.variants) return;
    const idx = selectedVariantIndex;
    if (idx === -1) return;
    const prevIdx = (idx - 1 + activeStampGroup.variants.length) % activeStampGroup.variants.length;
    mapStore.activeStamp = activeStampGroup.variants[prevIdx];
  }



  import { generateMazeDungeon, generateCaveDungeon, generateRuinsDungeon, generateTavern, generateForestCamp, generateAiDungeon } from '../lib/dungeonGenerator';
  import { onMount } from 'svelte';
  import SculptPanel from './panels/SculptPanel.svelte';

  // Obtenir le titre de l'outil actif
  function getToolTitle(tool: string) {
    switch (tool) {
      case 'sculpt': return 'Sculpt Tool';
      case 'paint': return 'Brush Tool';
      case 'stamp': return 'Stamp Tool';
      case 'path': return 'Line Tool';
      case 'shape': return 'Shape Tool';
      case 'text': return 'Text Tool';
      case 'grid': return 'Select Tool';
      case 'background': return 'Arrière-plan';
      case 'dungeon': return 'Générateur de Donjon';
      default: return 'Tool Properties';
    }
  }

  // Couleurs rapides prédéfinies
  const PATH_COLORS = ['#5c4033', '#1e293b', '#ef4444', '#3b82f6', '#10b981', '#fbbf24'];
  
  // Variables locales de configuration pour le générateur de donjon
  let dungeonTheme = $state<'classic' | 'prison' | 'cave'>('classic');
  let dungeonSize = $state(15);
  let activeDungeonSlot = $state<'wall' | 'wall_v' | 'wall_tl' | 'wall_tr' | 'wall_bl' | 'wall_br' | 'door' | 'chest' | 'pillar' | 'stairs_up' | 'stairs_down'>('wall');

  // États pour la génération par IA (Ollama)
  let generatorMode = $state<'procedural' | 'ai'>('procedural');
  let ollamaModels = $state<string[]>([]);
  let selectedModel = $state<string>('');
  let aiPrompt = $state<string>('');
  let isGenerating = $state<boolean>(false);
  let generatorError = $state<string>('');

  async function loadOllamaModels() {
    try {
      const models = await invoke<string[]>('get_ollama_models');
      ollamaModels = models;
      if (ollamaModels.length > 0) {
        const gemma = ollamaModels.find(m => m.toLowerCase().includes('gemma'));
        const llama = ollamaModels.find(m => m.toLowerCase().includes('llama'));
        selectedModel = gemma || llama || ollamaModels[0];
      } else {
        selectedModel = '';
      }
    } catch (err: any) {
      console.error("Erreur lors de la récupération des modèles Ollama :", err);
      generatorError = "Erreur de connexion avec l'application : " + JSON.stringify(err);
    }
  }

  onMount(() => {
    loadOllamaModels();
  });

  async function generateWithAi() {
    if (!aiPrompt.trim()) {
      generatorError = "Veuillez saisir une description de carte.";
      return;
    }
    if (!selectedModel) {
      generatorError = "Aucun modèle IA sélectionné ou disponible.";
      return;
    }
    
    isGenerating = true;
    generatorError = "";
    try {
      await generateAiDungeon(dungeonTheme, aiPrompt, dungeonSize, selectedModel);
    } catch (err: any) {
      generatorError = err.message || "Une erreur est survenue pendant la génération.";
    } finally {
      isGenerating = false;
    }
  }

  let dungeonThemeStamps = $derived.by(() => {
    const theme = dungeonTheme;
    if (theme === 'classic') {
      return (importedStamps as any[]).filter(s => 
        s.category === 'Fantasy Battlemaps' && 
        (s.subcategory === 'Dungeons' || s.subcategory === 'Castle 2.0' || s.subcategory === 'Castle')
      );
    } else if (theme === 'prison') {
      return (importedStamps as any[]).filter(s => 
        s.category === 'Fantasy Battlemaps' && 
        (s.subcategory === 'Prison' || s.subcategory === 'Prison 2.0')
      );
    } else { // cave
      return (importedStamps as any[]).filter(s => 
        s.category === 'Fantasy Battlemaps' && 
        (s.subcategory === 'Cave' || s.subcategory === 'Cave 2.0' || s.subcategory === 'Mine')
      );
    }
  });

  function getStampFile(id: string) {
    const meta = (importedStamps as any[]).find(s => s.id === id);
    return meta ? meta.file : '';
  }

  function selectDungeonStamp(id: string) {
    (mapStore.dungeonThemes[dungeonTheme] as any)[activeDungeonSlot] = id;
  }
</script>

{#if mapStore.showPanel}
  <div class="left-tool-panel-wrapper">
    <div class="left-tool-panel">
      <!-- En-tête du panneau style Inkarnate -->
      <div class="panel-header">
        <span class="panel-title">{getToolTitle(mapStore.activeTool)}</span>
        <button class="panel-close-btn" onclick={() => mapStore.showPanel = false} title="Fermer">
          <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" class="close-icon">
            <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor" fill-rule="evenodd"></path>
          </svg>
        </button>
      </div>

      <!-- Contenu défilable -->
      <div class="panel-scrollable">
        <div class="panel-content">
          


          <!-- ── OUTIL SCULPT ── -->
          {#if mapStore.activeTool === 'sculpt'}
            <SculptPanel />
          {/if}

          <!-- ── OUTIL PAINT ── -->
          {#if mapStore.activeTool === 'paint'}
            <div class="panel-section">
              <span class="section-title">
                {favoriteTexturesList.length > 0 ? "Textures Favorites" : "Texture de Sol"}
              </span>
              <div class="textures-grid">
                {#each quickPickerTextures as tex}
                  <button
                    class="texture-card"
                    class:active={mapStore.paintTexture === tex.id}
                    onclick={() => mapStore.paintTexture = tex.id}
                    title={tex.name}
                  >
                    {#if tex.file}
                      <div class="texture-preview-img" style="background-image: url('/assets/textures/{tex.file}')"></div>
                    {:else}
                      <div class="texture-preview-color" style="background-color: {tex.color}"></div>
                    {/if}
                    <span class="texture-name">{tex.name}</span>
                  </button>
                {/each}

                {#if currentTextureDetails && currentTextureDetails.isImported && !quickPickerTextures.some(t => t.id === currentTextureDetails.id)}
                  <button
                    class="texture-card active"
                    title={currentTextureDetails.name.replace('Texture Importée', 'Texture')}
                  >
                    <div class="texture-preview-img" style="background-image: url('/assets/textures/{currentTextureDetails.file}')"></div>
                    <span class="texture-name">{currentTextureDetails.name.replace('Texture Importée', 'Texture')}</span>
                  </button>
                {/if}

                <button
                  class="texture-card open-catalog-card"
                  onclick={() => mapStore.showTextureCatalog = true}
                  title="Ouvrir le catalogue de textures"
                >
                  <div class="texture-preview-icon">🎨</div>
                  <span class="texture-name">Plus...</span>
                </button>
              </div>
            </div>

            <!-- Curseur : Taille du pinceau -->
            <div class="slider-field">
              <div class="slider-header">
                <span class="slider-label">Taille</span>
                <div class="slider-value-container">
                  <input type="number" min="15" max="300" bind:value={mapStore.paintBrushSize} class="slider-value-input" />
                  <span class="slider-unit">px</span>
                </div>
              </div>
              <input type="range" min="15" max="300" bind:value={mapStore.paintBrushSize} class="slider-track" />
            </div>

            <!-- Curseur : Opacité de peinture -->
            <div class="slider-field">
              <div class="slider-header">
                <span class="slider-label">Opacité</span>
                <div class="slider-value-container">
                  <input type="number" min="10" max="100" value={Math.round(mapStore.paintBrushOpacity * 100)} oninput={(e) => mapStore.paintBrushOpacity = Number(e.currentTarget.value) / 100} class="slider-value-input" />
                  <span class="slider-unit">%</span>
                </div>
              </div>
              <input type="range" min="0.1" max="1.0" step="0.05" bind:value={mapStore.paintBrushOpacity} class="slider-track" />
            </div>

            <!-- Bouton : Remplir la carte -->
            <div class="panel-section" style="margin-top: 10px;">
              <button 
                class="action-btn"
                onclick={() => (window as any).fillLandTexture(mapStore.paintTexture)}
                title="Remplir toute la terre avec la texture sélectionnée"
              >
                🪣 Remplir toute la terre
              </button>
            </div>

            <div class="panel-section">
              <span class="section-title">Paramètres de Brosse</span>
              <div class="shape-buttons-row" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;">
                <button
                  class="shape-btn"
                  class:active={mapStore.brushShape === 'circle'}
                  onclick={() => mapStore.brushShape = 'circle'}
                >
                  ◯ Rond
                </button>
                <button
                  class="shape-btn"
                  class:active={mapStore.brushShape === 'square'}
                  onclick={() => mapStore.brushShape = 'square'}
                >
                  ▢ Carré
                </button>
                <button
                  class="shape-btn"
                  class:active={mapStore.brushShape === 'rough'}
                  onclick={() => mapStore.brushShape = 'rough'}
                  style="font-size: 11px; padding: 4px 2px;"
                >
                  🏔️ Brut
                </button>
              </div>
              <label class="checkbox-label" style="margin-top: 10px;">
                <input type="checkbox" bind:checked={mapStore.brushSnap} />
                <span>Magnétisme Grille</span>
              </label>
            </div>
          {/if}

          <!-- ── OUTIL BACKGROUND ── -->
          {#if mapStore.activeTool === 'background'}
            <div class="panel-section">
              <span class="section-title">Type d'Arrière-plan</span>
              <div class="style-buttons-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 12px;">
                <button
                  class="style-btn"
                  class:active={mapStore.backgroundType === 'water'}
                  onclick={() => mapStore.backgroundType = 'water'}
                  title="Eau par défaut"
                >
                  🌊 Eau
                </button>
                <button
                  class="style-btn"
                  class:active={mapStore.backgroundType === 'texture'}
                  onclick={() => mapStore.backgroundType = 'texture'}
                  title="Texture répétée"
                >
                  🎨 Texture
                </button>
                <button
                  class="style-btn"
                  class:active={mapStore.backgroundType === 'image'}
                  onclick={() => mapStore.backgroundType = 'image'}
                  title="Image ou carte existante"
                >
                  🖼️ Image
                </button>
              </div>
            </div>

            {#if mapStore.backgroundType === 'texture'}
              <div class="panel-section">
                <span class="section-title">Texture de Fond</span>
                <div class="textures-grid">
                  {#each activeTextures as tex}
                    <button
                      class="texture-card"
                      class:active={mapStore.backgroundTexture === tex.id}
                      onclick={() => mapStore.backgroundTexture = tex.id}
                      title={tex.name}
                    >
                      {#if tex.file}
                        <div class="texture-preview-img" style="background-image: url('/assets/textures/{tex.file}')"></div>
                      {:else}
                        <div class="texture-preview-color" style="background-color: {tex.color}"></div>
                      {/if}
                      <span class="texture-name">{tex.name}</span>
                    </button>
                  {/each}

                  {#if currentBackgroundTextureDetails && currentBackgroundTextureDetails.isImported}
                    <button
                      class="texture-card active"
                      title={currentBackgroundTextureDetails.name.replace('Texture Importée', 'Texture')}
                    >
                      <div class="texture-preview-img" style="background-image: url('/assets/textures/{currentBackgroundTextureDetails.file}')"></div>
                      <span class="texture-name">{currentBackgroundTextureDetails.name.replace('Texture Importée', 'Texture')}</span>
                    </button>
                  {/if}

                  <button
                    class="texture-card open-catalog-card"
                    onclick={() => mapStore.showTextureCatalog = true}
                    title="Ouvrir le catalogue de textures"
                  >
                    <div class="texture-preview-icon">🎨</div>
                    <span class="texture-name">Plus...</span>
                  </button>
                </div>

                <!-- Curseur : Échelle de texture -->
                <div class="slider-field" style="margin-top: 12px;">
                  <div class="slider-header">
                    <span class="slider-label">Échelle de la Texture</span>
                    <div class="slider-value-container">
                      <input type="number" min="10" max="400" value={Math.round(mapStore.backgroundTextureScale * 100)} oninput={(e) => mapStore.backgroundTextureScale = Number(e.currentTarget.value) / 100} class="slider-value-input" />
                      <span class="slider-unit">%</span>
                    </div>
                  </div>
                  <input type="range" min="0.1" max="4.0" step="0.05" bind:value={mapStore.backgroundTextureScale} class="slider-track" />
                </div>
              </div>
            {/if}

            {#if mapStore.backgroundType === 'image'}
              <div class="panel-section">
                <span class="section-title">Image de fond existante</span>
                
                <!-- Zone d'import de fichier -->
                <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
                  {#if mapStore.backgroundImageUrl}
                    <div class="bg-image-preview-container" style="position: relative; width: 100%; aspect-ratio: 1.6; border: 1px dashed rgba(255,255,255,0.15); border-radius: 4px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3);">
                      <img src={mapStore.backgroundImageUrl} alt="Background preview" style="max-width: 100%; max-height: 100%; object-fit: contain; opacity: {mapStore.backgroundImageOpacity};" />
                      <button 
                        class="delete-btn" 
                        style="position: absolute; top: 6px; right: 6px; padding: 4px 8px; font-size: 10px; height: auto;" 
                        onclick={() => { mapStore.backgroundImageUrl = null; }}
                        title="Supprimer l'image"
                      >
                        Supprimer
                      </button>
                    </div>
                  {:else}
                    <label class="bg-upload-label" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; border: 1px dashed rgba(255, 255, 255, 0.15); border-radius: 6px; padding: 20px; cursor: pointer; background: rgba(255,255,255,0.01); transition: all 0.15s;">
                      <span style="font-size: 24px;">📥</span>
                      <span style="font-size: 11px; color: var(--color-text-muted);">Choisir un fichier image (.png, .jpg, etc.)</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        style="display: none;" 
                        onchange={(e) => {
                          const file = e.currentTarget.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              mapStore.backgroundImageUrl = event.target?.result as string;
                            };
                            reader.readAsDataURL(file);
                          }
                        }} 
                      />
                    </label>
                  {/if}
                </div>

                {#if mapStore.backgroundImageUrl}
                  <!-- Curseur : Échelle -->
                  <div class="slider-field">
                    <div class="slider-header">
                      <span class="slider-label">Échelle</span>
                      <div class="slider-value-container">
                        <input type="number" min="10" max="500" value={Math.round(mapStore.backgroundImageScale * 100)} oninput={(e) => mapStore.backgroundImageScale = Number(e.currentTarget.value) / 100} class="slider-value-input" />
                        <span class="slider-unit">%</span>
                      </div>
                    </div>
                    <input type="range" min="0.1" max="5.0" step="0.05" bind:value={mapStore.backgroundImageScale} class="slider-track" />
                  </div>

                  <!-- Curseur : Opacité -->
                  <div class="slider-field">
                    <div class="slider-header">
                      <span class="slider-label">Opacité</span>
                      <div class="slider-value-container">
                        <input type="number" min="10" max="100" value={Math.round(mapStore.backgroundImageOpacity * 100)} oninput={(e) => mapStore.backgroundImageOpacity = Number(e.currentTarget.value) / 100} class="slider-value-input" />
                        <span class="slider-unit">%</span>
                      </div>
                    </div>
                    <input type="range" min="0.1" max="1.0" step="0.05" bind:value={mapStore.backgroundImageOpacity} class="slider-track" />
                  </div>

                  <!-- Position décalage X/Y -->
                  <div style="display: flex; gap: 8px; margin-top: 10px;">
                    <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                      <span style="font-size: 10px; color: var(--color-text-muted);">Décalage X (px)</span>
                      <input type="number" bind:value={mapStore.backgroundImageX} class="text-input" style="width: 100%; box-sizing: border-box;" />
                    </div>
                    <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                      <span style="font-size: 10px; color: var(--color-text-muted);">Décalage Y (px)</span>
                      <input type="number" bind:value={mapStore.backgroundImageY} class="text-input" style="width: 100%; box-sizing: border-box;" />
                    </div>
                  </div>

                  <!-- Boutons d'alignement rapide -->
                  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-top: 10px;">
                    <button 
                      type="button"
                      class="action-btn"
                      style="font-size: 10px; padding: 6px;"
                      onclick={() => {
                        mapStore.backgroundImageX = 0;
                        mapStore.backgroundImageY = 0;
                        mapStore.backgroundImageScale = 1.0;
                      }}
                    >
                      Réinitialiser
                    </button>
                    <button 
                      type="button"
                      class="action-btn"
                      style="font-size: 10px; padding: 6px;"
                      onclick={() => {
                        // Centrer l'image
                        const img = new Image();
                        img.onload = () => {
                          // Ajuster l'échelle pour couvrir ou contenir le canvas
                          const canvasW = mapStore.canvasWidth;
                          const canvasH = mapStore.canvasHeight;
                          const scale = Math.min(canvasW / img.width, canvasH / img.height);
                          mapStore.backgroundImageScale = scale;
                          mapStore.backgroundImageX = (canvasW - img.width * scale) / 2;
                          mapStore.backgroundImageY = (canvasH - img.height * scale) / 2;
                        };
                        img.src = mapStore.backgroundImageUrl!;
                      }}
                    >
                      Centrer & Ajuster
                    </button>
                  </div>
                {/if}
              </div>
            {/if}

            <!-- Curseur : Opacité du Sol (Terre / Premier Plan) pour la superposition/décalquage -->
            <div class="panel-section" style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; margin-top: 12px;">
              <span class="section-title">Couche de Sol (Terre / Premier plan)</span>
              
              <div class="slider-field" style="margin-bottom: 12px;">
                <div class="slider-header">
                  <span class="slider-label">Opacité du Sol</span>
                  <div class="slider-value-container">
                    <input type="number" min="0" max="100" value={Math.round(mapStore.foregroundOpacity * 100)} oninput={(e) => mapStore.foregroundOpacity = Number(e.currentTarget.value) / 100} class="slider-value-input" />
                    <span class="slider-unit">%</span>
                  </div>
                </div>
                <input type="range" min="0.0" max="1.0" step="0.05" bind:value={mapStore.foregroundOpacity} class="slider-track" />
              </div>

              <!-- Actions rapides de masque -->
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-bottom: 8px;">
                <button
                  type="button"
                  class="action-btn"
                  style="font-size: 10px; padding: 6px;"
                  onclick={() => {
                    if ((window as any).clearLandMask) {
                      (window as any).clearLandMask();
                    }
                  }}
                  title="Rend toute la carte d'arrière-plan visible"
                >
                  💧 Effacer le Sol
                </button>
                <button
                  type="button"
                  class="action-btn"
                  style="font-size: 10px; padding: 6px;"
                  onclick={() => {
                    if ((window as any).fillLandMask) {
                      (window as any).fillLandMask();
                    }
                  }}
                  title="Remplit toute la carte avec la texture de sol"
                >
                  🟩 Remplir le Sol
                </button>
              </div>
              <p class="hint-text" style="font-style: italic; color: #94a3b8; font-size: 10px;">
                💡 Par défaut, le sol (Terre) recouvre le fond. Réduisez son opacité ou cliquez sur "Effacer le Sol" pour voir l'arrière-plan.
              </p>
            </div>

            <!-- Section : Filtres globaux & effets -->
            <div class="panel-section" style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; margin-top: 12px;">
              <span class="section-title">Filtres Globaux & Effets</span>
              
              <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;">
                <span style="font-size: 10px; color: var(--color-text-muted);">Ambiance Colorée</span>
                <select bind:value={mapStore.mapFilter} class="select-input">
                  <option value="none">Aucune</option>
                  <option value="sepia">Sépia Vintage</option>
                  <option value="warm">Ambiance Chaude</option>
                  <option value="cold">Ambiance Froide</option>
                </select>
              </div>

              {#if mapStore.mapFilter !== 'none'}
                <div class="slider-field">
                  <div class="slider-header">
                    <span class="slider-label">Intensité Filtre</span>
                    <div class="slider-value-container">
                      <input type="number" min="0" max="100" value={Math.round(mapStore.mapFilterIntensity * 100)} oninput={(e) => mapStore.mapFilterIntensity = Number(e.currentTarget.value) / 100} class="slider-value-input" />
                      <span class="slider-unit">%</span>
                    </div>
                  </div>
                  <input type="range" min="0" max="1.0" step="0.05" bind:value={mapStore.mapFilterIntensity} class="slider-track" />
                </div>
              {/if}

              <!-- Vignette -->
              <label class="checkbox-label" style="margin-top: 6px;">
                <input type="checkbox" bind:checked={mapStore.vignetteEnabled} />
                <span>Effet Vignettage (Radial)</span>
              </label>
              {#if mapStore.vignetteEnabled}
                <div class="slider-field">
                  <div class="slider-header">
                    <span class="slider-label">Sombreur Vignette</span>
                    <div class="slider-value-container">
                      <input type="number" min="0" max="100" value={Math.round(mapStore.vignetteOpacity * 100)} oninput={(e) => mapStore.vignetteOpacity = Number(e.currentTarget.value) / 100} class="slider-value-input" />
                      <span class="slider-unit">%</span>
                    </div>
                  </div>
                  <input type="range" min="0.1" max="1.0" step="0.05" bind:value={mapStore.vignetteOpacity} class="slider-track" />
                </div>
              {/if}

              <!-- Paper Overlay -->
              <label class="checkbox-label" style="margin-top: 6px;">
                <input type="checkbox" bind:checked={mapStore.paperOverlayEnabled} />
                <span>Grain Parchemin (Multiply)</span>
              </label>
              {#if mapStore.paperOverlayEnabled}
                <div class="slider-field">
                  <div class="slider-header">
                    <span class="slider-label">Opacité du Grain</span>
                    <div class="slider-value-container">
                      <input type="number" min="0" max="100" value={Math.round(mapStore.paperOverlayOpacity * 100)} oninput={(e) => mapStore.paperOverlayOpacity = Number(e.currentTarget.value) / 100} class="slider-value-input" />
                      <span class="slider-unit">%</span>
                    </div>
                  </div>
                  <input type="range" min="0.05" max="0.8" step="0.05" bind:value={mapStore.paperOverlayOpacity} class="slider-track" />
                </div>
              {/if}
            </div>
          {/if}

          <!-- ── OUTIL STAMP ── -->
          {#if mapStore.activeTool === 'stamp'}
            <!-- Catalogue Style Inkarnate avec gros aperçu & mini-picker -->
            <div class="panel-section">
              <span class="section-title">Tampon Sélectionné</span>
              <div class="selected-stamp-container">
                <div class="selected-stamp-title">{selectedStampName}</div>
                
                <!-- Grande image de prévisualisation avec flèches de navigation de set -->
                <div class="stamp-main-preview" role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && (mapStore.showCatalog = true)} onclick={() => mapStore.showCatalog = true} title="Ouvrir le catalogue (F)">
                  {#if selectedStampFile}
                    <div class="stamp-preview-img" style="background-image: url('{selectedStampFile}')"></div>
                  {:else}
                    <span class="stamp-preview-emoji">{activeStampGroup?.icon || '🛡️'}</span>
                  {/if}

                  <!-- Catalog Overlay on Hover -->
                  <div class="catalog-hover-overlay">
                    <span class="catalog-text">Catalog</span>
                    <span class="shortcut-badge">F</span>
                  </div>
                  
                  <div class="stamp-arrows-overlay" role="presentation" onclick={(e) => e.stopPropagation()}>
                    <button onclick={prevStamp} class="stamp-arrow-btn" title="Précédent">
                      <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 320 512" height="12" width="12" xmlns="http://www.w3.org/2000/svg"><path d="M34.52 239.03L228.87 44.69c9.37-9.37 24.57-9.37 33.94 0l22.67 22.67c9.36 9.36 9.37 24.52.04 33.9L131.49 256l154.02 154.75c9.34 9.38 9.32 24.54-.04 33.9l-22.67 22.67c-9.37 9.37-24.57 9.37-33.94 0L34.52 272.97c-9.37-9.37-9.37-24.57 0-33.94z"></path></svg>
                    </button>
                    <span class="stamp-counter-badge">{selectedVariantIndex + 1} / {activeStampGroup?.variants?.length || 1}</span>
                    <button onclick={nextStamp} class="stamp-arrow-btn" title="Suivant">
                      <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 320 512" height="12" width="12" xmlns="http://www.w3.org/2000/svg"><path d="M285.476 272.971L91.132 467.314c-9.373 9.373-24.569 9.373-33.941 0l-22.667-22.667c-9.357-9.357-9.375-24.522-.04-33.901L188.505 256 34.484 101.255c-9.335-9.379-9.317-24.544.04-33.901l22.667-22.667c9.373-9.373 24.569-9.373 33.941 0L285.475 239.03c9.373 9.372 9.373 24.568.001 33.941z"></path></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Grille de variantes sous l'aperçu principal -->
            {#if activeStampGroup?.variants?.length > 1}
              <div class="panel-section">
                <span class="section-title">Variantes de Tampon</span>
                <div class="stamp-picker-grid" style="grid-template-columns: repeat(3, 1fr); max-height: 80px;">
                  {#each activeStampGroup.variants as variant, vIdx}
                    <button
                      class="stamp-grid-item"
                      class:selected={mapStore.activeStamp === variant}
                      onclick={() => mapStore.activeStamp = variant}
                      title="Variante {vIdx + 1}"
                    >
                      {#if activeStampGroup.id === 'tree'}
                        <div class="stamp-thumbnail-img" style="background-image: url('/assets/stamps/{variant}.png')"></div>
                      {:else if activeStampGroup.file}
                        <div class="stamp-thumbnail-img" style="background-image: url('{activeStampGroup.file}')"></div>
                      {:else}
                        <span class="stamp-thumbnail-emoji">{activeStampGroup.icon}</span>
                      {/if}
                    </button>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Grille de tampons (picker) de catégories / favoris -->
            <div class="panel-section">
              <span class="section-title">
                {favoriteStampsList.length > 0 ? "Tampons Favoris" : "Catalogue de Tampons"}
              </span>
              <div class="stamp-picker-grid">
                {#each quickPickerStamps as stamp}
                  <button 
                    class="stamp-grid-item" 
                    class:selected={activeStampGroup?.id === stamp.id || stamp.variants?.includes(mapStore.activeStamp)} 
                    onclick={() => mapStore.activeStamp = stamp.variants[0]}
                    title={stamp.name}
                  >
                    {#if stamp.file}
                      <div class="stamp-thumbnail-img" style="background-image: url('{stamp.file}')"></div>
                    {:else}
                      <span class="stamp-thumbnail-emoji">{stamp.icon}</span>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>

            <!-- Curseur : Échelle (Taille) -->
            <div class="slider-field">
              <div class="slider-header">
                <span class="slider-label">Échelle</span>
                <div class="slider-value-container">
                  <input type="number" min="10" max="300" value={Math.round(currentStampScale * 100)} oninput={(e) => handleScaleInput(Number(e.currentTarget.value) / 100)} class="slider-value-input" />
                  <span class="slider-unit">%</span>
                </div>
              </div>
              <input type="range" min="0.1" max="3.0" step="0.05" value={currentStampScale} oninput={(e) => handleScaleInput(Number(e.currentTarget.value))} class="slider-track" />
            </div>

            <!-- Curseur : Rotation -->
            <div class="slider-field">
              <div class="slider-header">
                <span class="slider-label">Rotation</span>
                <div class="slider-value-container">
                  <input type="number" min="-180" max="180" value={currentStampRotation} oninput={(e) => handleRotationInput(Number(e.currentTarget.value))} class="slider-value-input" />
                  <span class="slider-unit">°</span>
                </div>
              </div>
              <input type="range" min="-180" max="180" step="5" value={currentStampRotation} oninput={(e) => handleRotationInput(Number(e.currentTarget.value))} class="slider-track" />
            </div>

            <!-- Curseur : Opacité -->
            <div class="slider-field">
              <div class="slider-header">
                <span class="slider-label">Opacité</span>
                <div class="slider-value-container">
                  <input type="number" min="10" max="100" value={Math.round(currentStampOpacity * 100)} oninput={(e) => handleOpacityInput(Number(e.currentTarget.value) / 100)} class="slider-value-input" />
                  <span class="slider-unit">%</span>
                </div>
              </div>
              <input type="range" min="0.1" max="1.0" step="0.05" value={currentStampOpacity} oninput={(e) => handleOpacityInput(Number(e.currentTarget.value))} class="slider-track" />
            </div>

            <!-- Curseur : Z-Index (Seulement si sélectionné) -->
            {#if selectedStampObject}
              <div class="slider-field">
                <div class="slider-header">
                  <span class="slider-label">Niveau de Calque</span>
                  <div class="slider-value-container">
                    <input type="number" min="-5" max="5" value={currentStampZIndex} oninput={(e) => handleZIndexInput(Number(e.currentTarget.value))} class="slider-value-input" />
                  </div>
                </div>
                <input type="range" min="-5" max="5" step="1" value={currentStampZIndex} oninput={(e) => handleZIndexInput(Number(e.currentTarget.value))} class="slider-track" />
              </div>
            {/if}

            <!-- Ombre Portée -->
            <div class="panel-section">
              <span class="section-title">Ombre Portée (Relief)</span>
              <div class="pose-options" style="margin-bottom: 10px;">
                <label class="checkbox-label">
                  <input type="checkbox" checked={currentShadowEnabled} onchange={(e) => handleShadowEnabledInput(e.currentTarget.checked)} />
                  <span>Activer l'ombre portée</span>
                </label>
              </div>

              {#if currentShadowEnabled}
                <div class="slider-field">
                  <div class="slider-header">
                    <span class="slider-label">Flou (Blur)</span>
                    <div class="slider-value-container">
                      <input type="number" min="0" max="50" value={currentShadowBlur} oninput={(e) => handleShadowBlurInput(Number(e.currentTarget.value))} class="slider-value-input" />
                      <span class="slider-unit">px</span>
                    </div>
                  </div>
                  <input type="range" min="0" max="50" step="1" value={currentShadowBlur} oninput={(e) => handleShadowBlurInput(Number(e.currentTarget.value))} class="slider-track" />
                </div>

                <div class="slider-field">
                  <div class="slider-header">
                    <span class="slider-label">Décalage X</span>
                    <div class="slider-value-container">
                      <input type="number" min="-50" max="50" value={currentShadowOffsetX} oninput={(e) => handleShadowOffsetXInput(Number(e.currentTarget.value))} class="slider-value-input" />
                      <span class="slider-unit">px</span>
                    </div>
                  </div>
                  <input type="range" min="-50" max="50" step="1" value={currentShadowOffsetX} oninput={(e) => handleShadowOffsetXInput(Number(e.currentTarget.value))} class="slider-track" />
                </div>

                <div class="slider-field">
                  <div class="slider-header">
                    <span class="slider-label">Décalage Y</span>
                    <div class="slider-value-container">
                      <input type="number" min="-50" max="50" value={currentShadowOffsetY} oninput={(e) => handleShadowOffsetYInput(Number(e.currentTarget.value))} class="slider-value-input" />
                      <span class="slider-unit">px</span>
                    </div>
                  </div>
                  <input type="range" min="-50" max="50" step="1" value={currentShadowOffsetY} oninput={(e) => handleShadowOffsetYInput(Number(e.currentTarget.value))} class="slider-track" />
                </div>

                <div class="slider-field">
                  <div class="slider-header" style="align-items: center; gap: 10px;">
                    <span class="slider-label">Couleur de l'ombre</span>
                    <input type="color" value={currentShadowColor.startsWith('rgba') ? '#000000' : currentShadowColor} oninput={(e) => handleShadowColorInput(e.currentTarget.value)} style="border: 1px solid rgba(255,255,255,0.1); background: transparent; width: 34px; height: 26px; cursor: pointer; border-radius: 4px;" />
                  </div>
                </div>
              {/if}
            </div>

            <!-- Section : Options de pose & Magnétisme -->
            <div class="panel-section">
              <span class="section-title">Magnétisme & Grille</span>
              <div class="pose-options">
                <label class="checkbox-label">
                  <input type="checkbox" bind:checked={mapStore.stampSnapEnabled} />
                  <span>Alignement magnétique</span>
                </label>
                {#if mapStore.stampSnapEnabled}
                  <div class="shape-buttons-row" style="margin-top: 4px;">
                    <button
                      class="shape-btn"
                      class:active={mapStore.stampSnapMode === 'intersection'}
                      onclick={() => mapStore.stampSnapMode = 'intersection'}
                      style="font-size: 10px; padding: 4px;"
                    >
                      Intersection
                    </button>
                    <button
                      class="shape-btn"
                      class:active={mapStore.stampSnapMode === 'center'}
                      onclick={() => mapStore.stampSnapMode = 'center'}
                      style="font-size: 10px; padding: 4px;"
                    >
                      Centre case
                    </button>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Section : Dispersion (Scatter) -->
            <div class="panel-section">
              <span class="section-title">Dispersion de Tampons</span>
              <div class="pose-options">
                <label class="checkbox-label">
                  <input type="checkbox" bind:checked={mapStore.stampScatterEnabled} />
                  <span>Pinceau de dispersion</span>
                </label>
              </div>
              {#if mapStore.stampScatterEnabled}
                <div class="slider-field" style="margin-top: 4px;">
                  <div class="slider-header">
                    <span class="slider-label">Espacement</span>
                    <div class="slider-value-container">
                      <input type="number" min="50" max="400" bind:value={mapStore.stampScatterSpacing} class="slider-value-input" />
                      <span class="slider-unit">px</span>
                    </div>
                  </div>
                  <input type="range" min="50" max="400" step="10" bind:value={mapStore.stampScatterSpacing} class="slider-track" />
                  <span class="hint-text">Espacement entre les tampons lors du glisser</span>
                </div>
              {/if}
            </div>

            <!-- Section : Pose Aléatoire -->
            <div class="panel-section">
              <span class="section-title">Pose Aléatoire</span>
              <div class="pose-options">
                <label class="checkbox-label">
                  <input type="checkbox" bind:checked={mapStore.randomizeStampScale} />
                  <span>Échelle aléatoire (±20%)</span>
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" bind:checked={mapStore.randomizeStampRotation} />
                  <span>Angle aléatoire (±15°)</span>
                </label>
              </div>
            </div>
          {/if}

          <!-- ── OUTIL PATH ── -->
          {#if mapStore.activeTool === 'path'}
            <div class="panel-section">
              <span class="section-title">Couleur du Tracé</span>
              <div class="colors-row">
                {#each PATH_COLORS as color}
                  <button
                    class="color-circle"
                    aria-label="Sélectionner la couleur {color}"
                    class:active={mapStore.pathColor === color}
                    style="background-color: {color}"
                    onclick={() => mapStore.pathColor = color}
                  ></button>
                {/each}
                <div class="color-picker-wrapper">
                  <input type="color" bind:value={mapStore.pathColor} class="color-picker" />
                </div>
              </div>
            </div>

            <!-- Curseur : Épaisseur -->
            <div class="slider-field">
              <div class="slider-header">
                <span class="slider-label">Épaisseur</span>
                <div class="slider-value-container">
                  <input type="number" min="1" max="20" bind:value={mapStore.pathWidth} class="slider-value-input" />
                  <span class="slider-unit">px</span>
                </div>
              </div>
              <input type="range" min="1" max="20" bind:value={mapStore.pathWidth} class="slider-track" />
            </div>

            <div class="panel-section">
              <span class="section-title">Style de ligne</span>
              <div class="modes-grid">
                <button
                  class="mode-btn"
                  class:active={mapStore.pathDashStyle === 'solid'}
                  onclick={() => mapStore.pathDashStyle = 'solid'}
                >
                  ────── Pleine
                </button>
                <button
                  class="mode-btn"
                  class:active={mapStore.pathDashStyle === 'dashed'}
                  onclick={() => mapStore.pathDashStyle = 'dashed'}
                >
                  - - - - - Tirets
                </button>
                <button
                  class="mode-btn"
                  class:active={mapStore.pathDashStyle === 'dotted'}
                  onclick={() => mapStore.pathDashStyle = 'dotted'}
                >
                  . . . . . Points
                </button>
              </div>
            </div>

            <div class="panel-section">
              <span class="section-title">Options de tracé</span>
              <label class="checkbox-label" style="margin-bottom: 8px;">
                <input type="checkbox" bind:checked={mapStore.pathSmooth} />
                <span>Lissage courbe (Bézier)</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={mapStore.brushSnap} />
                <span>Magnétisme sur la grille</span>
              </label>
            </div>

            <button class="action-btn" onclick={onFinishPath}>
              ✔️ Finaliser le tracé (Entrée)
            </button>
          {/if}

          <!-- ── OUTIL TEXT ── -->
          {#if mapStore.activeTool === 'text'}
            <div class="panel-section">
              <span class="section-title">Contenu du Texte</span>
              <input
                type="text"
                bind:value={mapStore.textValue}
                class="text-input"
                placeholder="Entrer le texte..."
              />
            </div>

            <div class="panel-section">
              <span class="section-title">Police Médiévale</span>
              <select bind:value={mapStore.textFont} class="select-input">
                {#each FONTS as font}
                  <option value={font.id}>{font.name}</option>
                {/each}
              </select>
            </div>

            <!-- Curseur : Taille du texte -->
            <div class="slider-field">
              <div class="slider-header">
                <span class="slider-label">Taille</span>
                <div class="slider-value-container">
                  <input type="number" min="10" max="80" bind:value={mapStore.textSize} class="slider-value-input" />
                  <span class="slider-unit">pt</span>
                </div>
              </div>
              <input type="range" min="10" max="80" bind:value={mapStore.textSize} class="slider-track" />
            </div>

            <div class="panel-section">
              <span class="section-title">Couleur du Texte</span>
              <input type="color" bind:value={mapStore.textColor} class="full-color-picker" />
            </div>

            <!-- Curseur : Ombre & Lisibilité -->
            <div class="slider-field">
              <div class="slider-header">
                <span class="slider-label">Diffusion d'Ombre</span>
                <div class="slider-value-container">
                  <input type="number" min="0" max="15" bind:value={mapStore.textShadowBlur} class="slider-value-input" />
                  <span class="slider-unit">px</span>
                </div>
              </div>
              <input type="range" min="0" max="15" bind:value={mapStore.textShadowBlur} class="slider-track" />
              <input type="color" bind:value={mapStore.textShadowColor} class="full-color-picker" style="margin-top: 8px;" />
            </div>

            <!-- Curseur : Rotation du texte -->
            <div class="slider-field">
              <div class="slider-header">
                <span class="slider-label">Rotation</span>
                <div class="slider-value-container">
                  <input type="number" min="-90" max="90" bind:value={mapStore.textRotation} class="slider-value-input" />
                  <span class="slider-unit">°</span>
                </div>
              </div>
              <input type="range" min="-90" max="90" bind:value={mapStore.textRotation} class="slider-track" />
            </div>

            <div class="panel-section">
              <span class="section-title">Magnétisme</span>
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={mapStore.brushSnap} />
                <span>Poser aligné sur la grille</span>
              </label>
            </div>
          {/if}

          <!-- ── OUTIL SHAPE (Formes Géométriques) ── -->
          {#if mapStore.activeTool === 'shape'}
            <!-- Type de Forme -->
            <div class="panel-section">
              <span class="section-title">Type de Forme</span>
              <div class="style-buttons-grid" style="grid-template-columns: repeat(3, 1fr); gap: 4px;">
                <button
                  class="style-btn"
                  class:active={mapStore.shapeType === 'rectangle'}
                  onclick={() => { mapStore.shapeType = 'rectangle'; }}
                  style="font-size: 10px; padding: 6px;"
                >
                  Rectangle
                </button>
                <button
                  class="style-btn"
                  class:active={mapStore.shapeType === 'circle'}
                  onclick={() => { mapStore.shapeType = 'circle'; }}
                  style="font-size: 10px; padding: 6px;"
                >
                  Cercle
                </button>
                <button
                  class="style-btn"
                  class:active={mapStore.shapeType === 'polygon'}
                  onclick={() => { mapStore.shapeType = 'polygon'; }}
                  style="font-size: 10px; padding: 6px;"
                >
                  Polygone
                </button>
              </div>
            </div>

            <!-- Remplissage (Fill) -->
            <div class="panel-section" style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; margin-top: 6px;">
              <span class="section-title">Remplissage de la Zone</span>
              <div class="shape-buttons-row" style="margin-bottom: 8px;">
                <button
                  class="shape-btn"
                  class:active={mapStore.shapeFillTexture === null}
                  onclick={() => { mapStore.shapeFillTexture = null; }}
                  style="font-size: 10px; padding: 5px;"
                >
                  Couleur Unie
                </button>
                <button
                  class="shape-btn"
                  class:active={mapStore.shapeFillTexture !== null}
                  onclick={() => { mapStore.shapeFillTexture = mapStore.paintTexture || 'paving'; }}
                  style="font-size: 10px; padding: 5px;"
                >
                  Texture
                </button>
              </div>

              {#if mapStore.shapeFillTexture !== null}
                <!-- Texture selection grid -->
                <div class="textures-grid" style="max-height: 100px; margin-bottom: 8px;">
                  {#each quickPickerTextures as tex}
                    <button
                      class="texture-card"
                      class:active={mapStore.shapeFillTexture === tex.id}
                      onclick={() => mapStore.shapeFillTexture = tex.id}
                      title={tex.name}
                    >
                      {#if tex.file}
                        <div class="texture-preview-img" style="background-image: url('/assets/textures/{tex.file}'); height: 24px;"></div>
                      {:else}
                        <div class="texture-preview-color" style="background-color: {tex.color}; height: 24px;"></div>
                      {/if}
                      <span class="texture-name" style="font-size: 8px;">{tex.name}</span>
                    </button>
                  {/each}
                  <button
                    class="texture-card open-catalog-card"
                    onclick={() => mapStore.showTextureCatalog = true}
                    title="Ouvrir le catalogue de textures"
                  >
                    <div class="texture-preview-icon" style="font-size: 14px;">🎨</div>
                    <span class="texture-name" style="font-size: 8px;">Plus...</span>
                  </button>
                </div>

                <!-- Texture scale -->
                <div class="slider-field">
                  <div class="slider-header">
                    <span class="slider-label">Échelle Texture</span>
                    <div class="slider-value-container">
                      <input type="number" min="10" max="400" value={Math.round(mapStore.shapeFillTextureScale * 100)} oninput={(e) => mapStore.shapeFillTextureScale = Number(e.currentTarget.value) / 100} class="slider-value-input" />
                      <span class="slider-unit">%</span>
                    </div>
                  </div>
                  <input type="range" min="0.1" max="4.0" step="0.05" bind:value={mapStore.shapeFillTextureScale} class="slider-track" />
                </div>
              {:else}
                <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;">
                  <span style="font-size: 10px; color: var(--color-text-muted);">Couleur de remplissage</span>
                  <input type="color" bind:value={mapStore.shapeFillColor} class="full-color-picker" />
                </div>
              {/if}

              <!-- Opacity -->
              <div class="slider-field">
                <div class="slider-header">
                  <span class="slider-label">Opacité</span>
                  <div class="slider-value-container">
                    <input type="number" min="0" max="100" value={Math.round(mapStore.shapeFillOpacity * 100)} oninput={(e) => mapStore.shapeFillOpacity = Number(e.currentTarget.value) / 100} class="slider-value-input" />
                    <span class="slider-unit">%</span>
                  </div>
                </div>
                <input type="range" min="0.0" max="1.0" step="0.05" bind:value={mapStore.shapeFillOpacity} class="slider-track" />
              </div>
            </div>

            <!-- Contour (Stroke) -->
            <div class="panel-section" style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; margin-top: 6px;">
              <span class="section-title">Contour</span>
              
              <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;">
                <span style="font-size: 10px; color: var(--color-text-muted);">Couleur du contour</span>
                <input type="color" bind:value={mapStore.shapeStrokeColor} class="full-color-picker" />
              </div>

              <!-- Stroke Width -->
              <div class="slider-field">
                <div class="slider-header">
                  <span class="slider-label">Épaisseur</span>
                  <div class="slider-value-container">
                    <input type="number" min="0" max="20" bind:value={mapStore.shapeStrokeWidth} class="slider-value-input" />
                    <span class="slider-unit">px</span>
                  </div>
                </div>
                <input type="range" min="0" max="20" bind:value={mapStore.shapeStrokeWidth} class="slider-track" />
              </div>

              <!-- Stroke Dash style -->
              <div class="shape-buttons-row" style="margin-top: 6px;">
                <button
                  class="shape-btn"
                  class:active={mapStore.shapeStrokeDash === 'solid'}
                  onclick={() => { mapStore.shapeStrokeDash = 'solid'; }}
                  style="font-size: 10px; padding: 5px;"
                >
                  Contour Plein
                </button>
                <button
                  class="shape-btn"
                  class:active={mapStore.shapeStrokeDash === 'dashed'}
                  onclick={() => { mapStore.shapeStrokeDash = 'dashed'; }}
                  style="font-size: 10px; padding: 5px;"
                >
                  Contour Tirets
                </button>
              </div>
            </div>

            <!-- Snap -->
            <div class="panel-section" style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; margin-top: 6px;">
              <span class="section-title">Magnétisme</span>
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={mapStore.stampSnapEnabled} />
                <span>Points sur la grille</span>
              </label>
            </div>

            <!-- Polygone Validation Button -->
            {#if mapStore.shapeType === 'polygon'}
              <button 
                class="action-btn" 
                onclick={() => {
                  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
                }}
                style="margin-top: 12px; font-weight: 600;"
              >
                ✔️ Valider le Polygone (Entrée)
              </button>
            {/if}
          {/if}

          <!-- ── OUTIL GRID / SELECT ── -->
          {#if mapStore.activeTool === 'grid'}
            <div class="panel-section">
              <span class="section-title">Options de Grille</span>
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={mapStore.showGrid} />
                <span>Afficher la grille</span>
              </label>
            </div>

            {#if mapStore.showGrid}
              <div class="panel-section">
                <span class="section-title">Forme des cases</span>
                <div class="shape-buttons-row">
                  <button
                    class="shape-btn"
                    class:active={mapStore.gridType === 'square'}
                    onclick={() => mapStore.gridType = 'square'}
                  >
                    ⬜ Carrée
                  </button>
                  <button
                    class="shape-btn"
                    class:active={mapStore.gridType === 'hex'}
                    onclick={() => mapStore.gridType = 'hex'}
                  >
                    ⬡ Hexa
                  </button>
                </div>
              </div>

              <!-- Curseur : Taille de grille -->
              <div class="slider-field">
                <div class="slider-header">
                  <span class="slider-label">Taille</span>
                  <div class="slider-value-container">
                    <input type="number" min="20" max="120" bind:value={mapStore.gridSize} class="slider-value-input" />
                    <span class="slider-unit">px</span>
                  </div>
                </div>
                <input type="range" min="20" max="120" bind:value={mapStore.gridSize} class="slider-track" />
              </div>

              <div class="panel-section">
                <span class="section-title">Couleur</span>
                <input type="color" bind:value={mapStore.gridColor} class="full-color-picker" />
              </div>
            {/if}

            <!-- Section : Magnétisme -->
            <div class="panel-section" style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; margin-top: 6px;">
              <span class="section-title">Alignement Magnétique</span>
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={mapStore.stampSnapEnabled} />
                <span>Magnétiser les éléments</span>
              </label>
              {#if mapStore.stampSnapEnabled}
                <div class="shape-buttons-row" style="margin-top: 4px;">
                  <button
                    class="shape-btn"
                    class:active={mapStore.stampSnapMode === 'intersection'}
                    onclick={() => mapStore.stampSnapMode = 'intersection'}
                    style="font-size: 10px; padding: 4px;"
                  >
                    Intersection
                  </button>
                  <button
                    class="shape-btn"
                    class:active={mapStore.stampSnapMode === 'center'}
                    onclick={() => mapStore.stampSnapMode = 'center'}
                    style="font-size: 10px; padding: 4px;"
                  >
                    Centre case
                  </button>
                </div>
              {/if}
            </div>

            <div class="panel-divider"></div>
            <button class="delete-btn" onclick={onDeleteSelected} title="Supprimer l'élément sélectionné sur la carte">
              🗑️ Supprimer Sélectionné
            </button>
          {/if}

          <!-- ── OUTIL DUNGEON GENERATOR ── -->
          {#if mapStore.activeTool === 'dungeon'}
            <div class="panel-section">
              <span class="section-title">Thème Visuel</span>
              <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;">
                <select bind:value={dungeonTheme} class="select-input">
                  <option value="classic">Donjon Classique (Pierre grise)</option>
                  <option value="prison">Donjon Prison (Grilles & Fer)</option>
                  <option value="cave">Caverne Organique (Roches & Terre)</option>
                </select>
              </div>
            </div>

            <div class="panel-section">
              <span class="section-title">Taille du Donjon</span>
              <div class="slider-field">
                <div class="slider-header">
                  <span class="slider-label">Taille (Grille)</span>
                  <div class="slider-value-container">
                    <input type="number" min="10" max="30" bind:value={dungeonSize} class="slider-value-input" />
                    <span class="slider-unit">cases</span>
                  </div>
                </div>
                <input type="range" min="10" max="30" step="1" bind:value={dungeonSize} class="slider-track" />
              </div>
            </div>

            <div class="panel-section" style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; margin-top: 12px;">
              <span class="section-title">🔧 Personnaliser le Thème</span>
              
              <div class="dungeon-slots-grid">
                <button type="button" class="dungeon-slot-card" class:active={activeDungeonSlot === 'wall'} onclick={() => activeDungeonSlot = 'wall'} title="Modifier le Mur Horizontal">
                  <span class="slot-label">Mur H</span>
                  <div class="slot-preview">
                    {#if getStampFile(mapStore.dungeonThemes[dungeonTheme].wall)}
                      <img src={getStampFile(mapStore.dungeonThemes[dungeonTheme].wall)} alt="mur h" />
                    {:else}
                      <span class="empty-preview">🧱</span>
                    {/if}
                  </div>
                </button>

                <button type="button" class="dungeon-slot-card" class:active={activeDungeonSlot === 'wall_v'} onclick={() => activeDungeonSlot = 'wall_v'} title="Modifier le Mur Vertical">
                  <span class="slot-label">Mur V</span>
                  <div class="slot-preview">
                    {#if getStampFile(mapStore.dungeonThemes[dungeonTheme].wall_v)}
                      <img src={getStampFile(mapStore.dungeonThemes[dungeonTheme].wall_v)} alt="mur v" />
                    {:else}
                      <span class="empty-preview">🧱</span>
                    {/if}
                  </div>
                </button>

                <button type="button" class="dungeon-slot-card" class:active={activeDungeonSlot === 'wall_tl'} onclick={() => activeDungeonSlot = 'wall_tl'} title="Modifier le Coin Haut-Gauche">
                  <span class="slot-label">Coin HG</span>
                  <div class="slot-preview">
                    {#if getStampFile(mapStore.dungeonThemes[dungeonTheme].wall_tl)}
                      <img src={getStampFile(mapStore.dungeonThemes[dungeonTheme].wall_tl)} alt="coin hg" />
                    {:else}
                      <span class="empty-preview">📐</span>
                    {/if}
                  </div>
                </button>

                <button type="button" class="dungeon-slot-card" class:active={activeDungeonSlot === 'wall_tr'} onclick={() => activeDungeonSlot = 'wall_tr'} title="Modifier le Coin Haut-Droite">
                  <span class="slot-label">Coin HD</span>
                  <div class="slot-preview">
                    {#if getStampFile(mapStore.dungeonThemes[dungeonTheme].wall_tr)}
                      <img src={getStampFile(mapStore.dungeonThemes[dungeonTheme].wall_tr)} alt="coin hd" />
                    {:else}
                      <span class="empty-preview">📐</span>
                    {/if}
                  </div>
                </button>

                <button type="button" class="dungeon-slot-card" class:active={activeDungeonSlot === 'wall_bl'} onclick={() => activeDungeonSlot = 'wall_bl'} title="Modifier le Coin Bas-Gauche">
                  <span class="slot-label">Coin BG</span>
                  <div class="slot-preview">
                    {#if getStampFile(mapStore.dungeonThemes[dungeonTheme].wall_bl)}
                      <img src={getStampFile(mapStore.dungeonThemes[dungeonTheme].wall_bl)} alt="coin bg" />
                    {:else}
                      <span class="empty-preview">📐</span>
                    {/if}
                  </div>
                </button>

                <button type="button" class="dungeon-slot-card" class:active={activeDungeonSlot === 'wall_br'} onclick={() => activeDungeonSlot = 'wall_br'} title="Modifier le Coin Bas-Droite">
                  <span class="slot-label">Coin BD</span>
                  <div class="slot-preview">
                    {#if getStampFile(mapStore.dungeonThemes[dungeonTheme].wall_br)}
                      <img src={getStampFile(mapStore.dungeonThemes[dungeonTheme].wall_br)} alt="coin bd" />
                    {:else}
                      <span class="empty-preview">📐</span>
                    {/if}
                  </div>
                </button>

                <button type="button" class="dungeon-slot-card" class:active={activeDungeonSlot === 'door'} onclick={() => activeDungeonSlot = 'door'} title="Modifier la Porte">
                  <span class="slot-label">Porte</span>
                  <div class="slot-preview">
                    {#if getStampFile(mapStore.dungeonThemes[dungeonTheme].door)}
                      <img src={getStampFile(mapStore.dungeonThemes[dungeonTheme].door)} alt="porte" />
                    {:else}
                      <span class="empty-preview">🚪</span>
                    {/if}
                  </div>
                </button>

                <button type="button" class="dungeon-slot-card" class:active={activeDungeonSlot === 'chest'} onclick={() => activeDungeonSlot = 'chest'} title="Modifier le Coffre">
                  <span class="slot-label">Coffre</span>
                  <div class="slot-preview">
                    {#if getStampFile(mapStore.dungeonThemes[dungeonTheme].chest)}
                      <img src={getStampFile(mapStore.dungeonThemes[dungeonTheme].chest)} alt="coffre" />
                    {:else}
                      <span class="empty-preview">📦</span>
                    {/if}
                  </div>
                </button>

                <button type="button" class="dungeon-slot-card" class:active={activeDungeonSlot === 'pillar'} onclick={() => activeDungeonSlot = 'pillar'} title="Modifier le Pilier">
                  <span class="slot-label">Pilier</span>
                  <div class="slot-preview">
                    {#if getStampFile(mapStore.dungeonThemes[dungeonTheme].pillar)}
                      <img src={getStampFile(mapStore.dungeonThemes[dungeonTheme].pillar)} alt="pilier" />
                    {:else}
                      <span class="empty-preview">🏛️</span>
                    {/if}
                  </div>
                </button>

                <button type="button" class="dungeon-slot-card" class:active={activeDungeonSlot === 'stairs_up'} onclick={() => activeDungeonSlot = 'stairs_up'} title="Modifier l'Entrée">
                  <span class="slot-label">Entrée</span>
                  <div class="slot-preview">
                    {#if getStampFile(mapStore.dungeonThemes[dungeonTheme].stairs_up)}
                      <img src={getStampFile(mapStore.dungeonThemes[dungeonTheme].stairs_up)} alt="entrée" />
                    {:else}
                      <span class="empty-preview">📈</span>
                    {/if}
                  </div>
                </button>

                <button type="button" class="dungeon-slot-card" class:active={activeDungeonSlot === 'stairs_down'} onclick={() => activeDungeonSlot = 'stairs_down'} title="Modifier la Sortie">
                  <span class="slot-label">Sortie</span>
                  <div class="slot-preview">
                    {#if getStampFile(mapStore.dungeonThemes[dungeonTheme].stairs_down)}
                      <img src={getStampFile(mapStore.dungeonThemes[dungeonTheme].stairs_down)} alt="sortie" />
                    {:else}
                      <span class="empty-preview">📉</span>
                    {/if}
                  </div>
                </button>
              </div>

              <span class="section-title-sub" style="margin-top: 10px; display: block; font-size: 10px; color: #94a3b8; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">Choisir le visuel :</span>
              <div class="dungeon-picker-wrapper">
                <div class="dungeon-picker-grid">
                  {#each dungeonThemeStamps as stamp}
                    <button 
                      type="button" 
                      class="dungeon-picker-item" 
                      class:selected={mapStore.dungeonThemes[dungeonTheme][activeDungeonSlot] === stamp.id}
                      onclick={() => selectDungeonStamp(stamp.id)}
                    >
                      <img src={stamp.file} alt={stamp.name} title={stamp.name} loading="lazy" />
                    </button>
                  {/each}
                </div>
              </div>
            </div>

            <div class="panel-section" style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; margin-top: 12px;">
              <span class="section-title">Méthode de Génération</span>
              <div class="style-buttons-grid">
                <button 
                  type="button" 
                  class="style-btn" 
                  class:active={generatorMode === 'procedural'} 
                  onclick={() => generatorMode = 'procedural'}
                  title="Algorithmes classiques"
                >
                  ⚙️ Procédural
                </button>
                <button 
                  type="button" 
                  class="style-btn" 
                  class:active={generatorMode === 'ai'} 
                  onclick={() => generatorMode = 'ai'}
                  title="Générer via Ollama IA"
                >
                  ✨ IA (Ollama)
                </button>
              </div>
            </div>

            {#if generatorMode === 'procedural'}
              <div class="panel-section" style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; display: flex; flex-direction: column; gap: 8px;">
                <span class="section-title">Générateurs Algorithmiques</span>
                <button 
                  type="button" 
                  class="action-btn" 
                  onclick={() => generateMazeDungeon(dungeonTheme, dungeonSize)}
                  title="Générer un Labyrinthe parfait"
                >
                  🌀 Labyrinthe
                </button>
                <button 
                  type="button" 
                  class="action-btn" 
                  onclick={() => generateCaveDungeon(dungeonTheme, dungeonSize, dungeonSize)}
                  title="Générer une Grotte organique"
                >
                  🕳️ Caverne
                </button>
                <button 
                  type="button" 
                  class="action-btn" 
                  onclick={() => generateRuinsDungeon(dungeonTheme, dungeonSize)}
                  title="Générer des ruines de salles"
                >
                  🏛️ Ruines
                </button>
                <button 
                  type="button" 
                  class="action-btn" 
                  onclick={() => generateTavern(dungeonTheme, dungeonSize)}
                  title="Générer une Taverne animée"
                >
                  🍺 Taverne
                </button>
                <button 
                  type="button" 
                  class="action-btn" 
                  onclick={() => generateForestCamp(dungeonTheme, dungeonSize)}
                  title="Générer un Camp de forêt"
                >
                  🏕️ Camp de Forêt
                </button>
              </div>
            {:else}
              <div class="panel-section" style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; display: flex; flex-direction: column; gap: 8px;">
                <span class="section-title">Générateur par IA (Ollama)</span>
                
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <span style="font-size: 10px; color: var(--color-text-muted);">Description du donjon</span>
                  <textarea 
                    bind:value={aiPrompt}
                    placeholder="Ex: Une taverne chaleureuse avec un long bar à droite, des tables rondes et une cheminée allumée au nord..."
                    rows="3"
                    class="text-input"
                    style="resize: vertical; font-family: inherit; font-size: 11px; line-height: 1.4; min-height: 60px;"
                    disabled={isGenerating}
                  ></textarea>
                </div>

                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <span style="font-size: 10px; color: var(--color-text-muted);">Modèle local</span>
                  <div style="display: flex; gap: 6px;">
                    <select bind:value={selectedModel} class="select-input" style="flex: 1;" disabled={isGenerating}>
                      {#if ollamaModels.length === 0}
                        <option value="">Aucun modèle trouvé</option>
                      {:else}
                        {#each ollamaModels as model}
                          <option value={model}>{model}</option>
                        {/each}
                      {/if}
                    </select>
                    <button 
                      type="button" 
                      class="style-btn" 
                      style="padding: 0; width: 28px; display: flex; align-items: center; justify-content: center;"
                      onclick={loadOllamaModels}
                      title="Rafraîchir les modèles"
                      disabled={isGenerating}
                    >
                      🔄
                    </button>
                  </div>
                </div>

                {#if ollamaModels.length === 0}
                  <div style="padding: 8px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 4px; font-size: 10px; color: #fca5a5; line-height: 1.4;">
                    ⚠️ Aucun modèle Ollama local détecté. Veuillez installer un modèle via l'onboarding dans les paramètres.
                  </div>
                {/if}

                {#if generatorError}
                  <div style="padding: 8px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 4px; font-size: 10px; color: #fca5a5; line-height: 1.4;">
                    ❌ {generatorError}
                  </div>
                {/if}

                <button 
                  type="button" 
                  class="action-btn"
                  onclick={generateWithAi}
                  disabled={isGenerating || ollamaModels.length === 0}
                  style="display: flex; align-items: center; justify-content: center; gap: 6px; position: relative; overflow: hidden;"
                >
                  {#if isGenerating}
                    <span class="spinner"></span>
                    Génération en cours...
                  {:else}
                    ✨ Générer avec l'IA
                  {/if}
                </button>

                {#if isGenerating}
                  <p class="hint-text" style="color: var(--accent-orange); font-style: italic; font-weight: 500; text-align: center; margin-top: 4px; animation: pulse 1.5s infinite;">
                    L'IA locale réfléchit à l'agencement de votre carte...
                  </p>
                {/if}
              </div>
            {/if}
            
            <p class="hint-text" style="font-style: italic; color: #94a3b8; font-size: 10px; margin-top: 12px;">
              ⚠️ Note: Générer un donjon effacera le contenu existant de la carte. Vous pouvez annuler avec Ctrl+Z.
            </p>
          {/if}
          
          
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Wrapper pour la position absolue flottante */
  .left-tool-panel-wrapper {
    position: absolute;
    left: 0;
    top: var(--editor-top-nav-height);
    padding-left: calc(var(--left-nav-width) + 4px);
    z-index: 120;
    pointer-events: none; /* Laisse passer les clics sur la carte en dehors du panneau */
  }

  /* Panneau style Inkarnate */
  .left-tool-panel {
    width: 254px;
    margin-top: 12px;
    background: rgba(26, 27, 35, 0.95);
    backdrop-filter: blur(8px);
    border: 1px solid var(--border-color);
    border-radius: 5px;
    box-shadow: rgba(0, 0, 0, 0.2) 0px 0px 0px 1px, rgba(0, 0, 0, 0.7) 0px 6px 16px;
    display: flex;
    flex-direction: column;
    pointer-events: auto; /* Active les clics à l'intérieur du panneau */
    max-height: calc(100vh - var(--editor-top-nav-height) - 40px);
    overflow: hidden;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* En-tête */
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 32px;
    background: rgba(255, 255, 255, 0.04);
    border-bottom: 1px solid var(--border-color);
    border-top-left-radius: 5px;
    border-top-right-radius: 5px;
    position: relative;
    padding: 0 8px;
    flex-shrink: 0;
  }

  .panel-title {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .panel-close-btn {
    position: absolute;
    right: 4px;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: white;
    opacity: 0.5;
    cursor: pointer;
    padding: 4px;
    transition: opacity 0.15s;
    outline: none;
  }

  .panel-close-btn:hover {
    opacity: 0.85;
  }

  .close-icon {
    width: 16px;
    height: 16px;
  }

  /* Conteneur défilable */
  .panel-scrollable {
    flex: 1;
    overflow-y: auto;
  }

  .panel-content {
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Sections */
  .panel-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .section-title {
    font-size: 10.5px;
    font-weight: 700;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Grille des styles de carte */
  .style-buttons-grid {
    display: flex;
    gap: 6px;
  }

  .style-btn {
    flex: 1;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    padding: 6px;
    cursor: pointer;
    transition: all 0.15s;
    text-align: center;
  }

  .style-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #f1f5f9;
  }

  .style-btn.active {
    background: rgba(255, 204, 90, 0.1);
    border-color: var(--accent-orange);
    color: var(--accent-orange);
    box-shadow: 0 0 6px rgba(255, 204, 90, 0.1);
  }

  /* Modes Sculpt / Dessin */
  .modes-grid {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .mode-btn {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    padding: 7px 10px;
    cursor: pointer;
    transition: all 0.12s;
    text-align: left;
  }

  .mode-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #f1f5f9;
  }

  .mode-btn.active {
    background: rgba(255, 204, 90, 0.08);
    border-color: var(--accent-orange);
    color: var(--accent-orange);
  }

  /* Forme de brosse */
  .shape-buttons-row {
    display: flex;
    gap: 6px;
  }

  .shape-btn {
    flex: 1;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    color: #94a3b8;
    font-size: 10.5px;
    font-weight: 600;
    padding: 6px;
    cursor: pointer;
    transition: all 0.12s;
    text-align: center;
  }

  .shape-btn:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .shape-btn.active {
    background: rgba(255, 204, 90, 0.08);
    border-color: var(--accent-orange);
    color: var(--accent-orange);
  }

  /* Grille des Textures de Sol */
  .textures-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
    max-height: 160px;
    overflow-y: auto;
    padding-right: 2px;
  }

  .texture-card {
    background: rgba(255, 255, 255, 0.01);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    padding: 4px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    transition: all 0.15s;
    overflow: hidden;
  }

  .texture-card:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .texture-card.active {
    background: rgba(255, 204, 90, 0.08);
    border-color: var(--accent-orange);
    color: var(--accent-orange);
  }

  .texture-preview-img {
    width: 100%;
    height: 32px;
    border-radius: 2px;
    background-size: cover;
    background-position: center;
    border: 1px solid rgba(0, 0, 0, 0.25);
  }

  .texture-preview-color {
    width: 100%;
    height: 32px;
    border-radius: 2px;
    border: 1px solid rgba(0, 0, 0, 0.25);
  }

  .texture-name {
    font-size: 9px;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    width: 100%;
    text-align: center;
  }

  .open-catalog-card {
    background: rgba(255, 204, 90, 0.03) !important;
    border: 1px dashed rgba(255, 204, 90, 0.25) !important;
    color: var(--accent-orange) !important;
    justify-content: center;
  }

  .open-catalog-card:hover {
    background: rgba(255, 204, 90, 0.08) !important;
    border-color: var(--accent-orange) !important;
  }

  .texture-preview-icon {
    font-size: 18px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ── NOUVEAU COMPOSANT SLIDER STYLE INKARNATE ── */
  .slider-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 2px;
  }

  .slider-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .slider-label {
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
  }

  .slider-value-container {
    display: flex;
    align-items: center;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    padding: 1px 4px;
  }

  .slider-value-input {
    background: transparent;
    border: none;
    color: var(--accent-orange);
    font-size: 11px;
    font-weight: 700;
    width: 32px;
    text-align: right;
    outline: none;
    font-family: inherit;
    appearance: textfield;
    -moz-appearance: textfield;
  }

  .slider-value-input::-webkit-outer-spin-button,
  .slider-value-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .slider-unit {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.4);
    margin-left: 2px;
  }

  .slider-track {
    appearance: none;
    -webkit-appearance: none;
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  .slider-track::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--accent-orange);
    transition: transform 0.1s;
    box-shadow: 0 0 4px rgba(255, 204, 90, 0.4);
  }

  .slider-track::-webkit-slider-thumb:hover {
    transform: scale(1.25);
  }

  /* ── APERÇU DE TAMPON STYLE INKARNATE ── */
  .selected-stamp-container {
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: rgba(0, 0, 0, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 4px;
    padding: 6px;
  }

  .selected-stamp-title {
    font-size: 11.5px;
    font-weight: 700;
    color: var(--accent-orange);
    text-align: center;
  }

  .stamp-main-preview {
    height: 116px;
    background-color: #e2d6b5;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    cursor: pointer;
  }

  .catalog-hover-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    opacity: 0;
    transition: opacity 0.15s;
    cursor: pointer;
  }

  .stamp-main-preview:hover .catalog-hover-overlay {
    opacity: 1;
  }

  .catalog-text {
    font-size: 11px;
    font-weight: 700;
    color: white;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .shortcut-badge {
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    font-size: 10px;
    font-weight: 800;
    color: #e2e8f0;
    padding: 2px 6px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  }

  .stamp-preview-img {
    position: absolute;
    width: 80%;
    height: 80%;
    background-size: contain;
    background-position: center;
    background-repeat: no-repeat;
  }

  .stamp-preview-emoji {
    font-size: 42px;
  }

  .stamp-arrows-overlay {
    position: absolute;
    bottom: 6px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    pointer-events: auto;
  }

  .stamp-arrow-btn {
    background: rgba(0, 0, 0, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: white;
    border-radius: 4px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    outline: none;
    transition: all 0.1s;
    padding: 0;
  }

  .stamp-arrow-btn:hover {
    color: var(--accent-orange);
    background: rgba(0, 0, 0, 0.8);
    border-color: var(--accent-orange);
  }

  .stamp-counter-badge {
    background: rgba(0, 0, 0, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #ccc;
    font-size: 10px;
    font-weight: bold;
    padding: 2px 8px;
    border-radius: 10px;
    user-select: none;
  }

  /* Grille des tampons (picker) */
  .stamp-picker-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    max-height: 116px;
    overflow-y: auto;
    padding-right: 2px;
  }

  .stamp-grid-item {
    aspect-ratio: 1;
    width: 100%;
    background: #e2d6b5;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3px;
    transition: all 0.15s;
    position: relative;
  }

  .stamp-grid-item:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .stamp-grid-item.selected {
    background: rgba(255, 204, 90, 0.08);
    border-color: var(--accent-orange);
    box-shadow: 0 0 6px rgba(255, 204, 90, 0.15);
  }

  .stamp-thumbnail-img {
    position: absolute;
    width: 80%;
    height: 80%;
    background-size: contain;
    background-position: center;
    background-repeat: no-repeat;
  }

  .stamp-thumbnail-emoji {
    font-size: 18px;
  }

  .pose-options {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  /* Case à cocher */
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: #94a3b8;
    cursor: pointer;
    user-select: none;
  }

  .checkbox-label input {
    cursor: pointer;
    accent-color: var(--accent-orange);
  }

  /* Couleur du tracé */
  .colors-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .color-circle {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1px solid rgba(0, 0, 0, 0.3);
    cursor: pointer;
    transition: transform 0.12s;
  }

  .color-circle:hover {
    transform: scale(1.15);
  }

  .color-circle.active {
    border: 2px solid var(--accent-orange);
    box-shadow: 0 0 6px rgba(255, 204, 90, 0.5);
  }

  .color-picker-wrapper {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .color-picker {
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    transform: scale(1.5);
  }

  /* Entrées */
  .text-input {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    padding: 6px 10px;
    color: #f1f5f9;
    font-size: 11.5px;
    outline: none;
  }

  .text-input:focus {
    border-color: var(--accent-orange);
  }

  .select-input {
    background: #0f131a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    padding: 6px 8px;
    color: #f1f5f9;
    font-size: 11.5px;
    outline: none;
    cursor: pointer;
  }

  .full-color-picker {
    width: 100%;
    height: 24px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: transparent;
    cursor: pointer;
    border-radius: 4px;
    padding: 0;
  }

  .panel-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
    margin: 4px 0;
  }

  /* Boutons d'actions */
  .action-btn {
    background: rgba(255, 204, 90, 0.08);
    border: 1px solid rgba(255, 204, 90, 0.25);
    color: var(--accent-orange);
    padding: 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
  }

  .action-btn:hover {
    background: rgba(255, 204, 90, 0.15);
    border-color: var(--accent-orange);
  }

  .delete-btn {
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: #fca5a5;
    padding: 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
  }

  .delete-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: #ef4444;
  }

  .hint-text {
    font-size: 9.5px;
    color: #64748b;
    line-height: 1.3;
    margin-top: 2px;
  }

  .bg-upload-label:hover {
    border-color: var(--accent-orange) !important;
    background: rgba(255, 204, 90, 0.04) !important;
  }

  /* Grille des slots personnalisés du donjon */
  .dungeon-slots-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin-top: 8px;
    margin-bottom: 12px;
  }

  .dungeon-slot-card {
    background: #0f131a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    padding: 4px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    transition: all 0.15s ease-in-out;
  }

  .dungeon-slot-card:hover {
    border-color: rgba(255, 204, 90, 0.4);
    background: rgba(255, 255, 255, 0.02);
  }

  .dungeon-slot-card.active {
    border-color: var(--accent-orange);
    background: rgba(255, 204, 90, 0.06);
    box-shadow: 0 0 4px rgba(255, 204, 90, 0.25);
  }

  .slot-label {
    font-size: 9px;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
  }

  .slot-preview {
    width: 46px;
    height: 46px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  .slot-preview img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .empty-preview {
    font-size: 16px;
  }

  /* Sélecteur de tampons pour le donjon */
  .dungeon-picker-wrapper {
    background: #090c10;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    margin-top: 6px;
    padding: 6px;
    max-height: 150px;
    overflow-y: auto;
  }

  .dungeon-picker-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .dungeon-picker-item {
    background: #141722;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    aspect-ratio: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 3px;
    transition: all 0.15s ease;
  }

  .dungeon-picker-item img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    transition: transform 0.2s ease;
  }

  .dungeon-picker-item:hover {
    border-color: rgba(255, 204, 90, 0.4);
    background: #1b1e2a;
  }

  .dungeon-picker-item:hover img {
    transform: scale(1.1);
  }

  .dungeon-picker-item.selected {
    border-color: var(--accent-orange);
    background: rgba(255, 204, 90, 0.08);
    box-shadow: 0 0 6px rgba(255, 204, 90, 0.3);
  }

  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    display: inline-block;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
</style>
