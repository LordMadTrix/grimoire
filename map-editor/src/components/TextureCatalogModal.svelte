<script lang="ts">
  import { mapStore, toggleFavoriteTexture } from '../lib/stores/mapStore.svelte';
  import importedTextures from '../lib/imported_textures.json';

  // Liste globale des textures du catalogue par défaut
  const DEFAULT_TEXTURES = [
    { id: 'parchment', name: 'Parchemin', file: 'parchment.png', color: '#c2a679', category: 'isometric' },
    { id: 'grass', name: 'Prairie', file: 'grass.png', color: '#688e50', category: 'isometric' },
    { id: 'sand', name: 'Sable', file: 'sand.png', color: '#d2b48c', category: 'isometric' },
    { id: 'rock', name: 'Roche', file: 'rock.png', color: '#888888', category: 'isometric' },
    { id: 'water', name: 'Mer', file: 'water.png', color: '#4a6f8a', category: 'isometric' },
    { id: 'paving', name: 'Dallage Pierre', color: '#5a6268', category: 'topdown' },
    { id: 'wood', name: 'Plancher Bois', color: '#6f4e37', category: 'topdown' },
    { id: 'dirt', name: 'Terre Battue', color: '#4e3b30', category: 'topdown' },
    { id: 'topdown_grass', name: 'Herbe Verte', color: '#3e7d32', category: 'topdown' },
    { id: 'topdown_water', name: 'Eau Sombre', color: '#1c3d5a', category: 'topdown' }
  ];

  // Grouper les textures importées par catégorie principale une seule fois au chargement
  const rawImportedGroups: any[] = (() => {
    const groupsMap = new Map<string, {
      id: string;
      name: string;
      category: string;
      isImported: boolean;
      variants: any[];
      subcatMap: Map<string, any[]>;
    }>();

    importedTextures.forEach((tex: any) => {
      const cat = tex.category || 'Bibliothèque de Textures';
      const subcat = tex.subcategory || 'Général';
      if (!groupsMap.has(cat)) {
        groupsMap.set(cat, {
          id: `imported_cat_${cat.replace(/\s+/g, '_')}`,
          name: cat,
          category: 'isometric', // Par défaut
          isImported: true,
          variants: [],
          subcatMap: new Map<string, any[]>()
        });
      }
      
      const group = groupsMap.get(cat)!;
      const variant = {
        id: tex.id,
        name: tex.name,
        file: tex.file,
        color: tex.color || '#888888',
        subcategory: subcat
      };
      group.variants.push(variant);
      
      if (!group.subcatMap.has(subcat)) {
        group.subcatMap.set(subcat, []);
      }
      group.subcatMap.get(subcat)!.push(variant);
    });

    // Pré-calculer la liste d'affichage plate (en-têtes + variantes) par défaut (sans recherche)
    return Array.from(groupsMap.values()).map(group => {
      const preRenderedList: any[] = [];
      group.subcatMap.forEach((variants, subcatName) => {
        preRenderedList.push({
          groupName: group.name,
          id: `header_${group.name}_${subcatName}`,
          name: `${group.name} / ${subcatName}`,
          isHeader: true
        });
        variants.forEach(v => {
          preRenderedList.push({
            groupName: group.name,
            ...v
          });
        });
      });

      return {
        id: group.id,
        name: group.name,
        category: group.category,
        isImported: group.isImported,
        variants: group.variants,
        preRenderedList: preRenderedList,
        subcatMap: group.subcatMap,
        subcategories: Array.from(group.subcatMap.keys()) as string[]
      };
    });
  })();

  // États locaux de recherche et filtrage
  let selectedCategory = $state('all');
  let selectedSubcategory = $state('');
  let searchQuery = $state('');

  // États de l'arborescence
  let expandedFolders = $state<Record<string, boolean>>({
    'default': true,
    'imported': true
  });

  function toggleFolder(folderId: string) {
    expandedFolders[folderId] = !expandedFolders[folderId];
  }

  // États pour le défilement infini
  let displayLimit = $state(200);

  // Réinitialiser la limite quand la recherche, la catégorie ou la sous-catégorie change
  $effect(() => {
    const _c = selectedCategory;
    const _s = selectedSubcategory;
    const _q = searchQuery;
    displayLimit = 200;
  });

  // Gérer le chargement progressif des textures lors du scroll
  function handleScroll(e: Event) {
    const target = e.currentTarget as HTMLElement;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 150) {
      if (displayLimit < filteredTextures.length) {
        displayLimit += 200;
      }
    }
  }

  // Filtrer les textures réactivement
  let filteredTextures = $derived.by(() => {
    let list: any[] = [];
    const isSearchActive = searchQuery.trim() !== '';
    const query = isSearchActive ? searchQuery.toLowerCase() : '';

    if (selectedCategory === 'favorites') {
      // 1. Ajouter les textures par défaut s'il y a lieu
      let defaults = DEFAULT_TEXTURES.filter(t => mapStore.favoriteTextures.includes(t.id));
      if (isSearchActive) {
        defaults = defaults.filter(t => t.name.toLowerCase().includes(query));
      }
      defaults.forEach(t => {
        list.push({
          groupName: t.category === 'topdown' ? 'Défaut Combat' : 'Défaut Monde',
          ...t
        });
      });

      // 2. Traiter les groupes importés
      rawImportedGroups.forEach(group => {
        let variants = group.variants.filter((v: any) => mapStore.favoriteTextures.includes(v.id));
        if (isSearchActive) {
          variants = variants.filter((v: any) => 
            v.name.toLowerCase().includes(query) || 
            group.name.toLowerCase().includes(query) ||
            (v.subcategory && v.subcategory.toLowerCase().includes(query))
          );
        }
        variants.forEach((v: any) => {
          list.push({
            groupName: group.name,
            ...v
          });
        });
      });
      return list;
    }

    // 1. Ajouter les textures par défaut s'il y a lieu
    if (selectedCategory === 'all' || selectedCategory === 'default_iso' || selectedCategory === 'default_td') {
      let defaults = DEFAULT_TEXTURES;
      if (selectedCategory === 'default_iso') {
        defaults = DEFAULT_TEXTURES.filter(t => t.category === 'isometric');
      } else if (selectedCategory === 'default_td') {
        defaults = DEFAULT_TEXTURES.filter(t => t.category === 'topdown');
      }

      if (isSearchActive) {
        defaults = defaults.filter(t => t.name.toLowerCase().includes(query));
      }

      defaults.forEach(t => {
        list.push({
          groupName: t.category === 'topdown' ? 'Défaut Combat' : 'Défaut Monde',
          ...t
        });
      });
    }

    // 2. Traiter les groupes importés
    rawImportedGroups.forEach(group => {
      // Filtrer par catégorie d'éditeur / Importés
      if (selectedCategory.startsWith('imported_cat_')) {
        if (group.id !== selectedCategory) return;
      } else if (selectedCategory === 'default_iso' || selectedCategory === 'default_td') {
        return; // Exclure les importations
      }

      let variants = group.variants;

      // Filtrer par sous-catégorie si spécifié
      if (selectedSubcategory !== '') {
        variants = variants.filter((v: any) => v.subcategory === selectedSubcategory);
      }

      if (isSearchActive) {
        variants = variants.filter((v: any) => 
          v.name.toLowerCase().includes(query) || 
          group.name.toLowerCase().includes(query) ||
          (v.subcategory && v.subcategory.toLowerCase().includes(query))
        );
      }

      if (variants.length > 0) {
        // Regrouper par sous-catégories
        const tempSubcatMap = new Map<string, any[]>();
        variants.forEach((v: any) => {
          const sub = v.subcategory || 'Général';
          if (!tempSubcatMap.has(sub)) tempSubcatMap.set(sub, []);
          tempSubcatMap.get(sub)!.push(v);
        });

        tempSubcatMap.forEach((subcatVariants, subcatName) => {
          // Afficher l'en-tête uniquement si selectedSubcategory est vide
          if (selectedSubcategory === '') {
            list.push({
              groupName: group.name,
              id: `header_${group.name}_${subcatName}`,
              name: `${group.name} / ${subcatName}`,
              isHeader: true
            });
          }
          subcatVariants.forEach((v: any) => {
            list.push({
              groupName: group.name,
              ...v
            });
          });
        });
      }
    });

    return list;
  });

  // Sélectionner une texture
  function selectTexture(texId: string, groupName: string) {
    if (mapStore.activeTool === 'background') {
      mapStore.backgroundTexture = texId;
      mapStore.backgroundType = 'texture';
    } else {
      mapStore.paintTexture = texId;
      mapStore.activeTool = 'paint';
    }
    


    mapStore.showTextureCatalog = false;
  }

  // Écouter la touche Échap pour fermer le catalogue
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && mapStore.showTextureCatalog) {
      mapStore.showTextureCatalog = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if mapStore.showTextureCatalog}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="catalog-backdrop" onclick={() => mapStore.showTextureCatalog = false}>
    <div class="catalog-window" onclick={(e) => e.stopPropagation()}>
      
      <!-- En-tête -->
      <div class="catalog-header">
        <div class="header-left">
          <span class="catalog-title">Catalogue de Textures</span>
          <span class="items-count">({filteredTextures.length} textures trouvées)</span>
        </div>
        
        <div class="header-right">
          <!-- Champ de recherche de textures -->
          <div class="search-wrapper">
            <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <!-- svelte-ignore a11y_autofocus -->
            <input 
              type="text" 
              placeholder="Rechercher une texture..." 
              bind:value={searchQuery} 
              class="search-input"
              autofocus
            />
            {#if searchQuery}
              <button onclick={() => searchQuery = ''} class="clear-search-btn">✕</button>
            {/if}
          </div>
          
          <button class="close-modal-btn" onclick={() => mapStore.showTextureCatalog = false} title="Fermer (Échap)">
            ✕
          </button>
        </div>
      </div>

      <!-- Corps principal -->
      <div class="catalog-body">
        
        <!-- Barre latérale de filtres -->
        <div class="catalog-sidebar">
          <div class="tree-root">
            <button 
              class="tree-node tree-leaf" 
              class:active={selectedCategory === 'all'} 
              onclick={() => { selectedCategory = 'all'; selectedSubcategory = ''; }}
            >
              📂 Toutes les Textures
            </button>
            <button 
              class="tree-node tree-leaf" 
              class:active={selectedCategory === 'favorites'} 
              onclick={() => { selectedCategory = 'favorites'; selectedSubcategory = ''; }}
            >
              ⭐ Favoris ({mapStore.favoriteTextures.length})
            </button>

            <!-- Dossier de base -->
            <div class="tree-folder-group">
              <button class="tree-node tree-folder-header" onclick={() => toggleFolder('default')}>
                <span class="folder-arrow">{expandedFolders['default'] ? '▼' : '▶'}</span>
                📁 Textures de Base
              </button>
              {#if expandedFolders['default']}
                <div class="tree-folder-children">
                  <button 
                    class="tree-node tree-leaf" 
                    class:active={selectedCategory === 'default_iso' && selectedSubcategory === ''} 
                    onclick={() => { selectedCategory = 'default_iso'; selectedSubcategory = ''; }}
                  >
                    🗺️ Monde (Isométrique)
                  </button>
                  <button 
                    class="tree-node tree-leaf" 
                    class:active={selectedCategory === 'default_td' && selectedSubcategory === ''} 
                    onclick={() => { selectedCategory = 'default_td'; selectedSubcategory = ''; }}
                  >
                    ⚔️ Combat (Top-Down)
                  </button>
                </div>
              {/if}
            </div>

            <!-- Dossier importé -->
            {#if rawImportedGroups.length > 0}
              <div class="tree-folder-group">
                <button class="tree-node tree-folder-header" onclick={() => toggleFolder('imported')}>
                  <span class="folder-arrow">{expandedFolders['imported'] ? '▼' : '▶'}</span>
                  📁 Collections de Textures
                </button>
                {#if expandedFolders['imported']}
                  <div class="tree-folder-children">
                    {#each rawImportedGroups as group}
                      {@const folderId = `imported_cat_${group.name}`}
                      <div class="tree-folder-group">
                        <button 
                          class="tree-node tree-folder-header category-level" 
                          class:active={selectedCategory === group.id && selectedSubcategory === ''}
                          onclick={() => {
                            toggleFolder(folderId);
                            selectedCategory = group.id;
                            selectedSubcategory = '';
                          }}
                          title={group.name}
                        >
                          <span class="folder-arrow">{expandedFolders[folderId] ? '▼' : '▶'}</span>
                          🎨 {group.name}
                        </button>
                        
                        {#if expandedFolders[folderId]}
                          <div class="tree-folder-children subcategory-level-container">
                            {#each group.subcategories as subcat}
                              <button 
                                class="tree-node tree-leaf subcategory-level" 
                                class:active={selectedCategory === group.id && selectedSubcategory === subcat} 
                                onclick={() => { selectedCategory = group.id; selectedSubcategory = subcat; }}
                                title={subcat}
                              >
                                📄 {subcat}
                              </button>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <!-- Grille d'assets -->
        <div class="catalog-grid-container" onscroll={handleScroll}>
          {#if filteredTextures.length === 0}
            <div class="empty-state">
              <span class="empty-icon">🔍</span>
              <span class="empty-text">Aucune texture ne correspond à vos critères.</span>
            </div>
          {:else}
            <div class="catalog-grid">
              {#each filteredTextures.slice(0, displayLimit) as tex (tex.id)}
                {#if tex.isHeader}
                  <div class="grid-header">
                    📁 {tex.name}
                  </div>
                {:else}
                  {@const isFav = mapStore.favoriteTextures.includes(tex.id)}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                  <div 
                    class="texture-card" 
                    class:active={mapStore.paintTexture === tex.id}
                    onclick={() => selectTexture(tex.id, tex.groupName)}
                  >
                    <button 
                      class="favorite-star-btn" 
                      class:is-fav={isFav} 
                      onclick={(e) => { e.stopPropagation(); toggleFavoriteTexture(tex.id); }}
                      title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
                    >
                      ★
                    </button>

                    <div class="texture-card-preview-box">
                      {#if tex.file}
                        <!-- Si texture importée ou avec fichier local -->
                        <div 
                          class="texture-card-image" 
                          style="background-image: url('{tex.id.startsWith('imported_') ? `/assets/textures/${tex.file}` : `/assets/textures/${tex.file}`}')"
                        ></div>
                      {:else}
                        <!-- Texture de couleur pure (procedural) -->
                        <div class="texture-card-color" style="background-color: {tex.color}"></div>
                      {/if}
                    </div>
                    <div class="texture-card-info">
                      <span class="texture-card-name" title={tex.name.replace('Texture Importée', 'Texture')}>{tex.name.replace('Texture Importée', 'Texture')}</span>
                      <span class="texture-card-group">{tex.groupName}</span>
                    </div>
                  </div>
                {/if}
              {/each}

              {#if displayLimit < filteredTextures.length}
                <div class="load-more-indicator">
                  Défilez vers le bas pour charger plus de textures... (Affichage {Math.min(displayLimit, filteredTextures.length)} sur {filteredTextures.length})
                </div>
              {/if}
            </div>
          {/if}
        </div>

      </div>
    </div>
  </div>
{/if}

<style>
  /* Variables et design system */
  :root {
    --accent-orange: #ffcc5a;
    --color-bg-dark: #0b0e17;
    --color-bg-panel: #121824;
    --color-text-muted: #64748b;
  }

  .catalog-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: system-ui, -apple-system, sans-serif;
  }

  .catalog-window {
    width: 85vw;
    height: 80vh;
    max-width: 1000px;
    background: var(--color-bg-panel);
    border: 1px solid rgba(255, 204, 90, 0.25);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  }

  /* En-tête */
  .catalog-header {
    height: 48px;
    background: var(--color-bg-dark);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .catalog-title {
    color: white;
    font-size: 13.5px;
    font-weight: 800;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .items-count {
    color: var(--color-text-muted);
    font-size: 11px;
    font-weight: 500;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  /* Barre de recherche */
  .search-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    padding: 4px 8px;
    width: 220px;
    transition: all 0.15s;
  }

  .search-wrapper:focus-within {
    border-color: var(--accent-orange);
    box-shadow: 0 0 6px rgba(255, 204, 90, 0.15);
  }

  .search-icon {
    width: 13px;
    height: 13px;
    color: rgba(255, 255, 255, 0.4);
    margin-right: 6px;
    flex-shrink: 0;
  }

  .search-input {
    background: transparent;
    border: none;
    color: white;
    font-size: 11.5px;
    outline: none;
    width: 100%;
  }

  .clear-search-btn {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    font-size: 10px;
    padding: 2px;
  }

  .clear-search-btn:hover {
    color: white;
  }

  .close-modal-btn {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    font-size: 16px;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.1s;
    outline: none;
  }

  .close-modal-btn:hover {
    color: white;
  }

  /* Corps principal */
  .catalog-body {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  /* Barre latérale gauche */
  .catalog-sidebar {
    width: 220px;
    background: rgba(0, 0, 0, 0.15);
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    padding: 12px 8px;
    gap: 4px;
    flex-shrink: 0;
    overflow-y: auto;
  }

  /* Tree hierarchy navigation */
  .tree-root {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
  }

  .tree-node {
    background: transparent;
    border: none;
    width: 100%;
    text-align: left;
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    color: #94a3b8;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.15s;
    outline: none;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }

  .tree-node:hover {
    background: rgba(255, 255, 255, 0.04);
    color: #f1f5f9;
  }

  .tree-node.active {
    background: rgba(255, 204, 90, 0.08);
    color: var(--accent-orange, #ffcc5a);
    font-weight: 700;
  }

  .tree-folder-header {
    font-weight: 700;
    color: #cbd5e1;
  }

  .folder-arrow {
    font-size: 8px;
    width: 10px;
    display: inline-block;
    color: rgba(255, 255, 255, 0.3);
  }

  .tree-folder-children {
    padding-left: 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-left: 1px dashed rgba(255, 255, 255, 0.06);
    margin-left: 12px;
    margin-top: 2px;
    margin-bottom: 4px;
  }

  .category-level {
    padding-left: 4px;
  }

  .subcategory-level-container {
    margin-left: 8px;
  }

  .subcategory-level {
    padding-left: 14px;
  }

  /* Grille d'assets scrollable */
  .catalog-grid-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 20px;
    position: relative;
  }

  .catalog-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
    gap: 10px;
  }

  /* Carte de texture */
  .texture-card {
    background: rgba(255, 255, 255, 0.015);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    padding: 5px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s, border-color 0.2s, box-shadow 0.25s;
    position: relative;
    z-index: 1;
    overflow: hidden;
  }

  .texture-card:hover {
    background: #1b1c23;
    border-color: rgba(255, 204, 90, 0.6);
    transform: scale(1.35);
    z-index: 50;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.6);
  }

  .texture-card.active {
    background: rgba(255, 204, 90, 0.08);
    border-color: var(--accent-orange);
    box-shadow: 0 0 8px rgba(255, 204, 90, 0.15);
  }

  .texture-card-preview-box {
    width: 100%;
    aspect-ratio: 1.15;
    background: rgba(255, 255, 255, 0.015);
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .texture-card-image {
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
    background-repeat: repeat;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .texture-card:hover .texture-card-image {
    transform: scale(1.15);
  }

  .texture-card-color {
    width: 100%;
    height: 100%;
    border-radius: 2px;
  }

  .texture-card-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    gap: 2px;
  }

  .texture-card-name {
    font-size: 10.5px;
    font-weight: 700;
    color: #e2e8f0;
    text-align: center;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    width: 100%;
  }

  .texture-card-group {
    font-size: 8.5px;
    color: var(--color-text-muted);
    text-align: center;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    width: 100%;
  }

  /* État vide */
  .empty-state {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--color-text-muted);
    padding: 40px;
  }

  .empty-icon {
    font-size: 40px;
  }

  .empty-text {
    font-size: 12.5px;
    font-weight: 600;
    text-align: center;
  }

  /* Style des en-têtes de sous-catégories (packs) dans la grille */
  .grid-header {
    grid-column: 1 / -1;
    font-size: 11px;
    font-weight: 800;
    color: var(--accent-orange, #ffcc5a);
    background: rgba(255, 255, 255, 0.02);
    border-left: 3px solid var(--accent-orange, #ffcc5a);
    padding: 10px 14px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.05);
  }

  /* Indicateur de chargement progressif */
  .load-more-indicator {
    grid-column: 1 / -1;
    text-align: center;
    padding: 24px;
    font-size: 11px;
    color: var(--color-text-muted, #64748b);
    border-top: 1px dashed rgba(255, 255, 255, 0.05);
    margin-top: 20px;
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .favorite-star-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.4);
    border-radius: 4px;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 10px;
    z-index: 10;
    transition: all 0.15s;
    padding: 0;
    outline: none;
  }

  .favorite-star-btn:hover {
    color: #ffb800;
    background: rgba(0, 0, 0, 0.85);
    border-color: #ffb800;
    transform: scale(1.15);
  }

  .favorite-star-btn.is-fav {
    color: #ffb800;
    background: rgba(0, 0, 0, 0.6);
    border-color: rgba(255, 184, 0, 0.3);
    text-shadow: 0 0 4px rgba(255, 184, 0, 0.4);
  }
</style>
