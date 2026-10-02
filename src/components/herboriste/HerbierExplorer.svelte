<script lang="ts">
  import type { Plant, BiomeType, RarityType } from '$lib/herboriste/types/herb';
  import { BIOMES_METADATA, RARITY_METADATA } from '$lib/herboriste/data/herbalistData';
  import BotanicalIllustration from './BotanicalIllustration.svelte';
  import { herboristeStore } from '$lib/herboriste/store.svelte';

  type SortKey = 'name' | 'dc' | 'rarity';

  let searchQuery = $state('');
  let selectedBiome = $state<string>('all');
  let selectedRarity = $state<string>('all');
  let sortBy = $state<SortKey>('name');
  let showFavoritesOnly = $state<boolean>(false);

  const biomeEntries = Object.entries(BIOMES_METADATA) as [BiomeType, (typeof BIOMES_METADATA)[BiomeType]][];
  const rarityEntries = Object.entries(RARITY_METADATA) as [RarityType, (typeof RARITY_METADATA)[RarityType]][];

  const filteredPlants = $derived(
    herboristeStore.plants.filter((plant) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        plant.name.toLowerCase().includes(q) ||
        plant.latinName.toLowerCase().includes(q) ||
        plant.description.toLowerCase().includes(q) ||
        plant.gameEffects.some((e) => e.description.toLowerCase().includes(q));

      const matchesBiome = selectedBiome === 'all' || plant.biome === selectedBiome;
      const matchesRarity = selectedRarity === 'all' || plant.rarity === selectedRarity;
      const matchesFav = !showFavoritesOnly || herboristeStore.favoritePlantIds.includes(plant.id);

      return matchesSearch && matchesBiome && matchesRarity && matchesFav;
    })
  );

  const sortedPlants = $derived(
    [...filteredPlants].sort((a, b) => {
      if (sortBy === 'dc') return a.dcHarvest - b.dcHarvest;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'rarity') {
        const order: Record<RarityType, number> = {
          commune: 1,
          peu_commune: 2,
          rare: 3,
          tres_rare: 4,
          legendaire: 5,
        };
        return (order[b.rarity] || 0) - (order[a.rarity] || 0);
      }
      return 0;
    })
  );

  const hasActiveFilters = $derived(
    selectedBiome !== 'all' || selectedRarity !== 'all' || searchQuery !== '' || showFavoritesOnly
  );

  function resetFilters() {
    selectedBiome = 'all';
    selectedRarity = 'all';
    searchQuery = '';
    showFavoritesOnly = false;
  }

  function selectPlant(plant: Plant) {
    herboristeStore.selectedPlant = plant;
  }
</script>

<div class="explorer">
  <!-- Title & Description -->
  <div class="header">
    <div>
      <h2 class="title">Herbier Général des Terres Sauvages</h2>
      <p class="subtitle">
        Répertoire illustré des herbes et fongus magiques, classés selon leur biotope et rareté
      </p>
    </div>
    <button class="btn-add" onclick={() => (herboristeStore.isAddModalOpen = true)}>
      <span class="icon-gold">➕</span>
      <span>Créer une Plante Personnalisée</span>
    </button>
  </div>

  <!-- Filter and Search Bar -->
  <div class="filters">
    <div class="filters-grid">
      <!-- Search text input -->
      <div class="filter-field">
        <label class="filter-label" for="herbier-search">Rechercher une plante</label>
        <div class="search-wrap">
          <input
            id="herbier-search"
            type="text"
            placeholder="Ex: Athelas, poison, vision..."
            bind:value={searchQuery}
            class="input search-input"
          />
          <span class="search-icon">🔍</span>
        </div>
      </div>

      <!-- Biome filter -->
      <div class="filter-field">
        <label class="filter-label" for="herbier-biome">Biotope / Milieu Naturel</label>
        <select id="herbier-biome" bind:value={selectedBiome} class="input">
          <option value="all">Tous les biotopes</option>
          {#each biomeEntries as [key, data] (key)}
            <option value={key}>{data.label}</option>
          {/each}
        </select>
      </div>

      <!-- Rarity filter -->
      <div class="filter-field">
        <label class="filter-label" for="herbier-rarity">Degré de Rareté</label>
        <select id="herbier-rarity" bind:value={selectedRarity} class="input">
          <option value="all">Toutes les raretés</option>
          {#each rarityEntries as [key, data] (key)}
            <option value={key}>{data.label}</option>
          {/each}
        </select>
      </div>

      <!-- Sort order -->
      <div class="filter-field">
        <label class="filter-label" for="herbier-sort">Trier par</label>
        <select id="herbier-sort" bind:value={sortBy} class="input">
          <option value="name">Nom alphabétique (A-Z)</option>
          <option value="dc">Difficulté de récolte (DD)</option>
          <option value="rarity">Rareté décroissante</option>
        </select>
      </div>
    </div>

    <!-- Counter of active filters -->
    <div class="filters-footer">
      <div class="filters-footer-left">
        <span>
          Affichage de <strong class="count-highlight">{sortedPlants.length}</strong> plante(s) trouvée(s)
        </span>
        <button
          class="fav-toggle"
          class:fav-toggle-active={showFavoritesOnly}
          onclick={() => (showFavoritesOnly = !showFavoritesOnly)}
        >
          <span class="fav-heart">❤️</span>
          <span>Favoris ({herboristeStore.favoritePlantIds.length})</span>
        </button>
      </div>

      {#if hasActiveFilters}
        <button class="reset-filters" onclick={resetFilters}>
          Réinitialiser les filtres
        </button>
      {/if}
    </div>
  </div>

  <!-- Plants Grid -->
  <div class="grid">
    {#each sortedPlants as plant (plant.id)}
      {@const biomeInfo = BIOMES_METADATA[plant.biome]}
      {@const rarityInfo = RARITY_METADATA[plant.rarity]}
      {@const isFav = herboristeStore.favoritePlantIds.includes(plant.id)}
      <div
        class="card"
        role="button"
        tabindex="0"
        onclick={() => selectPlant(plant)}
        onkeydown={(e) => e.key === 'Enter' && selectPlant(plant)}
      >
        <div>
          <!-- Header -->
          <div class="card-header">
            <div>
              <h3 class="card-title">{plant.name}</h3>
              <div class="card-latin">{plant.latinName}</div>
            </div>
            <div class="card-header-right">
              <!-- Favorite Heart Button -->
              <button
                onclick={(e) => {
                  e.stopPropagation();
                  herboristeStore.toggleFavoritePlant(plant.id);
                }}
                title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                class="fav-btn"
                class:fav-btn-active={isFav}
              >
                {isFav ? '❤️' : '🤍'}
              </button>

              <span
                class="rarity-badge"
                style:color={rarityInfo.color}
                style:border-color={rarityInfo.border}
                style:background-color={rarityInfo.bg}
              >
                {rarityInfo.label}
              </span>
            </div>
          </div>

          <!-- Botanical Plate & Quick Metadata -->
          <div class="card-body">
            <div class="card-illustration">
              <BotanicalIllustration
                {plant}
                size="sm"
                showPlateDetails={false}
                class="card-illustration-inner"
              />
            </div>
            <div class="card-meta">
              <div class="meta-row meta-row-bordered">
                <span class="meta-label">Habitat :</span>
                <span class="meta-value">{biomeInfo.label}</span>
              </div>
              <div class="meta-row meta-row-bordered">
                <span class="meta-label">DD Récolte :</span>
                <span class="meta-dc">DD {plant.dcHarvest}</span>
              </div>
              <div class="meta-row meta-row-bordered">
                <span class="meta-label">Saison :</span>
                <span class="meta-value">{plant.season}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Valeur :</span>
                <span class="meta-value-bold">{plant.value}</span>
              </div>
            </div>
          </div>

          <!-- Short Excerpt -->
          <p class="card-excerpt">{plant.description}</p>

          <!-- Primary Game Effect Highlight -->
          <div class="effect-box">
            <div class="effect-title">
              <span>✨</span>
              {plant.gameEffects[0]?.title}
            </div>
            <p class="effect-desc">{plant.gameEffects[0]?.description}</p>
          </div>

          {#if plant.toxicityWarning}
            <div class="toxic-warning">
              <span>⚠️</span>
              <span class="toxic-text">Toxique / Avertissement</span>
            </div>
          {/if}
        </div>

        <!-- Action Button -->
        <div class="card-footer">
          <span class="card-footer-hint">Cliquer pour examiner</span>
          <span class="card-footer-action">
            <span>👁️</span>
            Voir la fiche
          </span>
        </div>
      </div>
    {/each}
  </div>

  {#if sortedPlants.length === 0}
    <div class="empty-state">
      <p class="empty-title">Aucune herbe trouvée</p>
      <p class="empty-text">
        Aucun spécimen ne correspond aux critères de recherche actuels. Essayez de réinitialiser vos filtres.
      </p>
      <button class="empty-btn" onclick={resetFilters}>
        Réinitialiser les filtres
      </button>
    </div>
  {/if}
</div>

<style>
  .explorer {
    max-width: 80rem;
    margin: 0 auto;
    padding: 2rem 1rem;
  }
  @media (min-width: 640px) {
    .explorer { padding: 2rem 1.5rem; }
  }

  .header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 2rem;
  }
  @media (min-width: 640px) {
    .header {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
  }
  .title {
    font-size: 1.875rem;
    font-family: 'Crimson Pro', Georgia, serif;
    font-weight: 700;
    color: #d4af37;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    margin: 0;
  }
  .subtitle {
    font-size: 0.875rem;
    color: #c4b5a5;
    font-style: italic;
    font-family: 'Crimson Pro', Georgia, serif;
    margin: 0;
  }
  .btn-add {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background-color: #78350f;
    color: #fef08a;
    border: 1px solid rgba(217, 119, 6, 0.4);
    font-family: 'Crimson Pro', Georgia, serif;
    font-weight: 700;
    font-size: 0.75rem;
    border-radius: 0.25rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    transition: background-color 0.15s;
    cursor: pointer;
    align-self: flex-start;
  }
  @media (min-width: 640px) {
    .btn-add { align-self: auto; }
  }
  .btn-add:hover { background-color: #8e3f13; }
  .icon-gold { font-size: 0.875rem; }

  .filters {
    background-color: #241c16;
    border: 1px solid #4d3a2e;
    border-radius: 0.75rem;
    padding: 1rem;
    margin-bottom: 2rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    font-size: 0.875rem;
    color: #e6d8c3;
  }
  @media (min-width: 640px) {
    .filters { padding: 1.25rem; }
  }
  .filters-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  @media (min-width: 640px) {
    .filters-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (min-width: 1024px) {
    .filters-grid { grid-template-columns: repeat(4, 1fr); }
  }
  .filter-field { position: relative; }
  .filter-label {
    display: block;
    font-size: 0.75rem;
    font-family: 'Crimson Pro', Georgia, serif;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #a89988;
    margin-bottom: 0.25rem;
  }
  .search-wrap { position: relative; }
  .input {
    width: 100%;
    background-color: #181310;
    border: 1px solid #59473b;
    border-radius: 0.375rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    color: #f5ecd7;
    box-sizing: border-box;
  }
  .input:focus {
    outline: none;
    border-color: #d4af37;
  }
  .search-input { padding-left: 2.25rem; }
  .search-input::placeholder { color: #7a6b5c; }
  .search-icon {
    position: absolute;
    left: 0.75rem;
    top: 0.625rem;
    font-size: 0.75rem;
  }

  .filters-footer {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid #3d2f25;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: #a89988;
  }
  .filters-footer-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .count-highlight { color: #fde047; }
  .fav-toggle {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-family: 'Crimson Pro', Georgia, serif;
    border: 1px solid #524136;
    background-color: #181310;
    color: #d7c9b8;
    cursor: pointer;
    transition: background-color 0.15s;
  }
  .fav-toggle:hover { background-color: #2c2018; }
  .fav-toggle-active {
    background-color: #4c0519;
    color: #fda4af;
    border-color: #e11d48;
    font-weight: 700;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }
  .fav-heart { font-size: 0.75rem; }
  .reset-filters {
    background: none;
    border: none;
    color: #d4af37;
    cursor: pointer;
    font-size: 0.75rem;
    padding: 0;
  }
  .reset-filters:hover { text-decoration: underline; }

  .grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  @media (min-width: 768px) {
    .grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (min-width: 1024px) {
    .grid { grid-template-columns: repeat(3, 1fr); }
  }

  .card {
    background-color: #faf6ee;
    border-radius: 0.75rem;
    border: 2px solid #c4a47c;
    padding: 1rem;
    color: #2c1810;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    cursor: pointer;
    transition: box-shadow 0.15s, border-color 0.15s;
  }
  .card:hover {
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
    border-color: #854d0e;
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
    border-bottom: 1px solid #e2d5c3;
    padding-bottom: 0.5rem;
    margin-bottom: 0.75rem;
  }
  .card-title {
    font-size: 1.125rem;
    font-family: 'Crimson Pro', Georgia, serif;
    font-weight: 700;
    color: #3a1b0e;
    margin: 0;
    transition: color 0.15s;
  }
  .card:hover .card-title { color: #854d0e; }
  .card-latin {
    font-size: 0.75rem;
    font-family: 'Crimson Pro', Georgia, serif;
    font-style: italic;
    color: #78350f;
  }
  .card-header-right {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  .fav-btn {
    padding: 0.375rem;
    border-radius: 9999px;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 0.875rem;
    transition: transform 0.15s;
  }
  .fav-btn:hover { transform: scale(1.1); }
  .rarity-badge {
    font-size: 10px;
    font-family: 'Crimson Pro', Georgia, serif;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid;
  }

  .card-body {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }
  .card-illustration {
    width: 7rem;
    flex-shrink: 0;
  }
  .card-illustration :global(.card-illustration-inner) {
    width: 100%;
    height: 7rem;
  }
  .card-meta {
    font-size: 0.75rem;
    font-family: 'Crimson Pro', Georgia, serif;
    width: 100%;
    color: #3a261c;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .meta-row {
    display: flex;
    justify-content: space-between;
    padding-top: 0.125rem;
  }
  .meta-row-bordered {
    border-bottom: 1px solid #ecd9c2;
    padding-bottom: 0.125rem;
  }
  .meta-label { color: #78350f; font-weight: 600; }
  .meta-value {
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100px;
  }
  .meta-dc {
    font-family: monospace;
    font-weight: 700;
    color: #b45309;
  }
  .meta-value-bold { font-weight: 700; color: #854d0e; }

  .card-excerpt {
    font-size: 0.75rem;
    font-family: 'Crimson Pro', Georgia, serif;
    color: #4a362b;
    margin: 0 0 0.75rem 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .effect-box {
    background-color: #f0e7d3;
    padding: 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid #dfd0bc;
    margin-bottom: 0.5rem;
  }
  .effect-title {
    font-size: 11px;
    font-family: 'Crimson Pro', Georgia, serif;
    font-weight: 700;
    color: #78350f;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .effect-desc {
    font-size: 11px;
    font-family: 'Crimson Pro', Georgia, serif;
    color: #331c12;
    margin: 0.125rem 0 0 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .toxic-warning {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 10px;
    color: #991b1b;
    font-family: 'Crimson Pro', Georgia, serif;
    font-weight: 700;
  }
  .toxic-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-footer {
    margin-top: 1rem;
    padding-top: 0.5rem;
    border-top: 1px solid #e2d5c3;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
    font-family: 'Crimson Pro', Georgia, serif;
  }
  .card-footer-hint { color: #78350f; font-style: italic; }
  .card-footer-action {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-weight: 700;
    color: #854d0e;
    transition: transform 0.15s;
  }
  .card:hover .card-footer-action { transform: translateX(0.25rem); }

  .empty-state {
    background-color: #2b211a;
    border: 1px solid #524136;
    border-radius: 0.75rem;
    padding: 3rem;
    text-align: center;
    color: #c4b5a5;
    max-width: 32rem;
    margin: 0 auto;
  }
  .empty-title {
    font-family: 'Crimson Pro', Georgia, serif;
    font-size: 1.125rem;
    color: #fef08a;
    margin: 0 0 0.5rem 0;
  }
  .empty-text {
    font-size: 0.75rem;
    font-family: 'Crimson Pro', Georgia, serif;
    margin: 0 0 1rem 0;
  }
  .empty-btn {
    padding: 0.5rem 1rem;
    background-color: #78350f;
    color: #fff;
    font-family: 'Crimson Pro', Georgia, serif;
    border: none;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    cursor: pointer;
  }
  .empty-btn:hover { background-color: #8e3f13; }
</style>
