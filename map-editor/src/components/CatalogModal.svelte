<script lang="ts">
  import { mapStore, toggleFavoriteStamp } from '../lib/stores/mapStore.svelte';
  import importedStamps from '../lib/imported_stamps.json';

  // Liste globale des assets du catalogue
  const DEFAULT_STAMP_GROUPS = [
    { 
      id: 'mountain', 
      name: 'Montagne Isométrique', 
      category: 'isometric', 
      type: 'terrain',
      variants: [
        { id: 'mountain', name: 'Montagne Classique', file: '/assets/stamps/mountain.png' },
        { id: 'mountain_snowy', name: 'Montagne Enneigée', file: '/assets/stamps/mountain_snowy.png' },
        { id: 'volcano', name: 'Volcan Actif', file: '/assets/stamps/volcano.png' }
      ]
    },
    { 
      id: 'tree', 
      name: 'Sapins et Feuillus', 
      category: 'isometric', 
      type: 'flora',
      variants: [
        { id: 'tree_variant_1', name: 'Sapin Simple', file: '/assets/stamps/tree_variant_1.png' },
        { id: 'tree_variant_2', name: 'Double Sapin', file: '/assets/stamps/tree_variant_2.png' },
        { id: 'tree_variant_3', name: 'Bosquet Sapins', file: '/assets/stamps/tree_variant_3.png' },
        { id: 'tree_variant_4', name: 'Feuillu Simple', file: '/assets/stamps/tree_variant_4.png' },
        { id: 'tree_variant_5', name: 'Double Feuillu', file: '/assets/stamps/tree_variant_5.png' },
        { id: 'tree_variant_6', name: 'Bosquet Feuillus', file: '/assets/stamps/tree_variant_6.png' }
      ]
    },
    { 
      id: 'structures', 
      name: 'Bâtiments et Ruines', 
      category: 'isometric', 
      type: 'structures',
      variants: [
        { id: 'castle', name: 'Château Fort', file: '/assets/stamps/castle.png' },
        { id: 'tower', name: 'Tour de Magicien', file: '/assets/stamps/tower.png' },
        { id: 'village', name: 'Village / Hameau', file: '/assets/stamps/village.png' }
      ]
    },
    { 
      id: 'decorations', 
      name: 'Accessoires & Mer', 
      category: 'isometric', 
      type: 'decorations',
      variants: [
        { id: 'ship', name: 'Galion / Navire', file: '/assets/stamps/ship.png' },
        { id: 'sea_monster', name: 'Monstre Marin (Kraken)', file: '/assets/stamps/sea_monster.png' },
        { id: 'compass', name: 'Rose des Vents', file: '/assets/stamps/compass.png' },
        { id: 'banner', name: 'Bannière Parchemin', file: '/assets/stamps/banner.png' }
      ]
    },
    {
      id: 'topdown_flora',
      name: 'Flore et Arbres Combat (Vue de dessus)',
      category: 'topdown',
      type: 'flora',
      variants: [
        { id: 'td_tree_pine', name: 'Sapin Top-down', icon: '🌲' },
        { id: 'td_tree_oak', name: 'Chêne Top-down', icon: '🌳' }
      ]
    },
    {
      id: 'topdown_structures',
      name: 'Mobilier & Donjons Combat (Vue de dessus)',
      category: 'topdown',
      type: 'structures',
      variants: [
        { id: 'td_rock', name: 'Rocher Grès', icon: '🪨' },
        { id: 'td_campfire', name: 'Feu de Camp RPG', icon: '🔥' },
        { id: 'td_chest', name: 'Coffre Trésor', icon: '📦' },
        { id: 'td_table', name: 'Table Taverne', icon: '🟫' },
        { id: 'td_chair', name: 'Chaise Taverne', icon: '🪑' },
        { id: 'td_pillar', name: 'Pilier Temple', icon: '🏛️' },
        { id: 'td_wall', name: 'Mur de Briques', icon: '🧱' },
        { id: 'td_door', name: 'Porte Ouverte', icon: '🚪' },
        { id: 'td_bed', name: 'Lit Simple', icon: '🛏️' },
        { id: 'td_tent', name: 'Tente de Camp', icon: '⛺' }
      ]
    }
  ];

  // Grouper les tampons importés par catégorie principale une seule fois au chargement
  const rawImportedGroups: any[] = (() => {
    const groupsMap = new Map<string, {
      id: string;
      name: string;
      category: string;
      isImported: boolean;
      type: string;
      variants: any[];
      subcatMap: Map<string, any[]>;
    }>();

    importedStamps.forEach((stamp: any) => {
      const cat = stamp.category || 'Bibliothèque de Décors';
      const subcat = stamp.subcategory || 'Général';
      if (!groupsMap.has(cat)) {
        groupsMap.set(cat, {
          id: `imported_cat_${cat.replace(/\s+/g, '_')}`,
          name: cat,
          category: 'isometric',
          isImported: true,
          type: 'imported',
          variants: [],
          subcatMap: new Map<string, any[]>()
        });
      }
      
      const group = groupsMap.get(cat)!;
      const variant = {
        id: stamp.id,
        name: stamp.name,
        file: stamp.file,
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
        type: group.type,
        variants: group.variants,
        preRenderedList: preRenderedList,
        subcatMap: group.subcatMap,
        subcategories: Array.from(group.subcatMap.keys()) as string[]
      };
    });
  })();

  const allStampGroups = [
    ...DEFAULT_STAMP_GROUPS,
    ...rawImportedGroups
  ];

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

  // Gérer le chargement progressif des tampons lors du scroll
  function handleScroll(e: Event) {
    const target = e.currentTarget as HTMLElement;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 150) {
      if (displayLimit < filteredStamps.length) {
        displayLimit += 200;
      }
    }
  }

  // Filtrer les tampons réactivement
  let filteredStamps = $derived.by(() => {
    let list: any[] = [];
    const isSearchActive = searchQuery.trim() !== '';
    const query = isSearchActive ? searchQuery.toLowerCase() : '';

    if (selectedCategory === 'favorites') {
      allStampGroups.forEach(group => {
        let variants = group.variants.filter((v: any) => mapStore.favoriteStamps.includes(v.id));
        if (isSearchActive) {
          variants = variants.filter((v: any) => 
            v.name.toLowerCase().includes(query) || 
            group.name.toLowerCase().includes(query) ||
            (v.subcategory && v.subcategory.toLowerCase().includes(query))
          );
        }
        variants.forEach((variant: any) => {
          list.push({
            groupName: group.name,
            ...variant
          });
        });
      });
      return list;
    }

    allStampGroups.forEach(group => {
      // Filtrer par catégorie d'éditeur / Importés
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'isometric' || selectedCategory === 'topdown') {
          if (group.isImported || group.category !== selectedCategory) return;
        } else if (selectedCategory === 'flora' || selectedCategory === 'structures') {
          if (group.isImported || group.type !== selectedCategory) return;
        } else {
          // Catégorie importée
          if (group.id !== selectedCategory) return;
        }
      }

      if (group.isImported) {
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
            // Afficher l'en-tête de sous-catégorie uniquement s'il n'y a pas de sous-catégorie sélectionnée
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
      } else {
        // Groupe par défaut
        let variants = group.variants;
        if (isSearchActive) {
          variants = variants.filter((v: any) => 
            v.name.toLowerCase().includes(query) || 
            group.name.toLowerCase().includes(query)
          );
        }
        variants.forEach((variant: any) => {
          list.push({
            groupName: group.name,
            ...variant
          });
        });
      }
    });

    return list;
  });

  // Sélectionner un tampon
  function selectStamp(variantId: string, groupCategory: string) {
    mapStore.activeStamp = variantId;
    mapStore.activeTool = 'stamp';
    


    mapStore.showCatalog = false;
  }

  // Écouter la touche F et Échap pour ouvrir/fermer le catalogue
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && mapStore.showCatalog) {
      mapStore.showCatalog = false;
    } else if ((e.key === 'f' || e.key === 'F') && 
               document.activeElement?.tagName !== 'INPUT' && 
               document.activeElement?.tagName !== 'TEXTAREA') {
      e.preventDefault();
      mapStore.showCatalog = !mapStore.showCatalog;
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if mapStore.showCatalog}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="catalog-backdrop" onclick={() => mapStore.showCatalog = false}>
    <div class="catalog-window" onclick={(e) => e.stopPropagation()}>
      
      <!-- En-tête -->
      <div class="catalog-header">
        <div class="header-left">
          <span class="catalog-title">Catalogue d'Assets [F]</span>
          <span class="items-count">({filteredStamps.length} tampons trouvés)</span>
        </div>
        
        <div class="header-right">
          <!-- Champ de recherche de stamps -->
          <div class="search-wrapper">
            <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <!-- svelte-ignore a11y_autofocus -->
            <input 
              type="text" 
              placeholder="Rechercher un tampon..." 
              bind:value={searchQuery} 
              class="search-input"
              autofocus
            />
            {#if searchQuery}
              <button onclick={() => searchQuery = ''} class="clear-search-btn">✕</button>
            {/if}
          </div>
          
          <button class="close-modal-btn" onclick={() => mapStore.showCatalog = false} title="Fermer (Échap)">
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
              📂 Tous les Assets
            </button>
            <button 
              class="tree-node tree-leaf" 
              class:active={selectedCategory === 'favorites'} 
              onclick={() => { selectedCategory = 'favorites'; selectedSubcategory = ''; }}
            >
              ⭐ Favoris ({mapStore.favoriteStamps.length})
            </button>

            <!-- Dossier de base -->
            <div class="tree-folder-group">
              <button class="tree-node tree-folder-header" onclick={() => toggleFolder('default')}>
                <span class="folder-arrow">{expandedFolders['default'] ? '▼' : '▶'}</span>
                📁 Assets de Base
              </button>
              {#if expandedFolders['default']}
                <div class="tree-folder-children">
                  <button 
                    class="tree-node tree-leaf" 
                    class:active={selectedCategory === 'isometric' && selectedSubcategory === ''} 
                    onclick={() => { selectedCategory = 'isometric'; selectedSubcategory = ''; }}
                  >
                    🗺️ Monde (Isométrique)
                  </button>
                  <button 
                    class="tree-node tree-leaf" 
                    class:active={selectedCategory === 'topdown' && selectedSubcategory === ''} 
                    onclick={() => { selectedCategory = 'topdown'; selectedSubcategory = ''; }}
                  >
                    ⚔️ Combat (Top-down)
                  </button>
                  <button 
                    class="tree-node tree-leaf" 
                    class:active={selectedCategory === 'flora' && selectedSubcategory === ''} 
                    onclick={() => { selectedCategory = 'flora'; selectedSubcategory = ''; }}
                  >
                    🌲 Flore et Forêts
                  </button>
                  <button 
                    class="tree-node tree-leaf" 
                    class:active={selectedCategory === 'structures' && selectedSubcategory === ''} 
                    onclick={() => { selectedCategory = 'structures'; selectedSubcategory = ''; }}
                  >
                    🏰 Bâtiments & Murs
                  </button>
                </div>
              {/if}
            </div>

            <!-- Dossier importé -->
            {#if rawImportedGroups.length > 0}
              <div class="tree-folder-group">
                <button class="tree-node tree-folder-header" onclick={() => toggleFolder('imported')}>
                  <span class="folder-arrow">{expandedFolders['imported'] ? '▼' : '▶'}</span>
                  📁 Packs de Décors
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

        <!-- Zone d'affichage des tampons -->
        <div class="catalog-grid-container" onscroll={handleScroll}>
          {#if filteredStamps.length === 0}
            <div class="empty-state">
              <span class="empty-icon">🔍</span>
              <span class="empty-text">Aucun tampon ne correspond à votre recherche.</span>
            </div>
          {:else}
            <div class="catalog-grid">
              {#each filteredStamps.slice(0, displayLimit) as stamp}
                {#if stamp.isHeader}
                  <div class="grid-header">
                    📁 {stamp.name}
                  </div>
                {:else}
                  <!-- Déterminer la catégorie du tampon pour adapter le style de carte à sa pose -->
                  {@const cat = allStampGroups.find(g => g.variants.some((v: any) => v.id === stamp.id))?.category || 'isometric'}
                  {@const isFav = mapStore.favoriteStamps.includes(stamp.id)}
                  
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                  <div 
                    class="stamp-card" 
                    class:active={mapStore.activeStamp === stamp.id}
                    onclick={() => selectStamp(stamp.id, cat)}
                    title="{stamp.name.replace('Tampon Importé', 'Tampon')} ({stamp.groupName})"
                  >
                    <button 
                      class="favorite-star-btn" 
                      class:is-fav={isFav} 
                      onclick={(e) => { e.stopPropagation(); toggleFavoriteStamp(stamp.id); }}
                      title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
                    >
                      ★
                    </button>

                    <div class="stamp-card-preview-box">
                      {#if stamp.file}
                        <div class="stamp-card-image" style="background-image: url('{stamp.file}')"></div>
                      {:else}
                        <span class="stamp-card-emoji">{stamp.icon}</span>
                      {/if}
                    </div>
                    <div class="stamp-card-info">
                      <span class="stamp-card-name">{stamp.name.replace('Tampon Importé', 'Tampon')}</span>
                      <span class="stamp-card-group">{stamp.groupName}</span>
                    </div>
                  </div>
                {/if}
              {/each}
            </div>
            {#if displayLimit < filteredStamps.length}
              <div class="load-more-indicator">
                Défilez vers le bas pour charger plus d'assets... ({displayLimit} / {filteredStamps.length} affichés)
              </div>
            {/if}
          {/if}
        </div>

      </div>

    </div>
  </div>
{/if}

<style>
  /* Voile de fond modal */
  .catalog-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(8, 9, 13, 0.85);
    backdrop-filter: blur(5px);
    z-index: 250;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: system-ui, -apple-system, sans-serif;
  }

  /* Fenêtre principale */
  .catalog-window {
    background: #111217;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    width: 860px;
    height: 600px;
    max-width: 92vw;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7);
    overflow: hidden;
  }

  /* En-tête */
  .catalog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.01);
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .catalog-title {
    font-size: 14px;
    font-weight: 700;
    color: #f1f5f9;
  }

  .items-count {
    font-size: 11px;
    color: var(--color-text-muted);
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

  /* Carte de tampon */
  .stamp-card {
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
  }

  .stamp-card:hover {
    background: #1b1c23;
    border-color: rgba(255, 204, 90, 0.6);
    transform: scale(1.35);
    z-index: 50;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.6);
  }

  .stamp-card.active {
    background: rgba(255, 204, 90, 0.08);
    border-color: var(--accent-orange);
    box-shadow: 0 0 8px rgba(255, 204, 90, 0.15);
  }

  .stamp-card-preview-box {
    width: 100%;
    aspect-ratio: 1.15;
    background: #e2d6b5;
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
  }

  .stamp-card-image {
    position: absolute;
    width: 80%;
    height: 80%;
    background-size: contain;
    background-position: center;
    background-repeat: no-repeat;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .stamp-card:hover .stamp-card-image {
    transform: scale(1.15);
  }

  .stamp-card-emoji {
    font-size: 32px;
  }

  .stamp-card-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    gap: 2px;
  }

  .stamp-card-name {
    font-size: 10.5px;
    font-weight: 700;
    color: #e2e8f0;
    text-align: center;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    width: 100%;
  }

  .stamp-card-group {
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
