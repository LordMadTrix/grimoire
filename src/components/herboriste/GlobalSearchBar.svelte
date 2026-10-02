<script lang="ts">
  import type { Plant, Creature } from '$lib/herboriste/types/herb';
  import type { Gem } from '$lib/herboriste/types/gem';
  import type { Mineral } from '$lib/herboriste/types/mineral';
  import { GEMS_LIST, GEM_CATEGORIES_META } from '$lib/herboriste/data/gemData';
  import { MINERALS_LIST, MINERAL_CATEGORIES_META } from '$lib/herboriste/data/mineralData';
  import { RARITY_METADATA, BIOMES_METADATA } from '$lib/herboriste/data/herbalistData';

  let {
    plants,
    creatures,
    onSelectPlant,
    onSelectCreature,
    onSelectGem,
    onSelectMineral,
  }: {
    plants: Plant[];
    creatures: Creature[];
    onSelectPlant: (plant: Plant) => void;
    onSelectCreature: (creature: Creature) => void;
    onSelectGem: (gem: Gem) => void;
    onSelectMineral?: (mineral: Mineral) => void;
  } = $props();

  let query = $state<string>('');
  let isOpen = $state<boolean>(false);
  let containerEl = $state<HTMLDivElement | null>(null);
  let inputEl = $state<HTMLInputElement | null>(null);

  // Normalize string for accent-insensitive search
  function normalize(str: string): string {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  const cleanQuery = $derived(normalize(query.trim()));

  const results = $derived.by(() => {
    if (!cleanQuery || cleanQuery.length < 1) {
      return { plants: [] as Plant[], gems: [] as Gem[], minerals: [] as Mineral[], creatures: [] as Creature[], totalCount: 0 };
    }

    const matchedPlants = plants.filter((p) => {
      const name = normalize(p.name);
      const latin = normalize(p.latinName || '');
      const otherNames = (p.otherNames || []).some((o) => normalize(o).includes(cleanQuery));
      const biome = normalize(BIOMES_METADATA[p.biome]?.label || '');
      return name.includes(cleanQuery) || latin.includes(cleanQuery) || otherNames || biome.includes(cleanQuery);
    });

    const matchedGems = GEMS_LIST.filter((g) => {
      const name = normalize(g.name);
      const category = normalize(g.category);
      const affinity = normalize(g.magicalAffinity || '');
      return name.includes(cleanQuery) || category.includes(cleanQuery) || affinity.includes(cleanQuery);
    });

    const matchedMinerals = MINERALS_LIST.filter((m) => {
      const name = normalize(m.name);
      const latin = normalize(m.latinOrScientificName || '');
      const category = normalize(m.category);
      const forge = normalize(m.forgeUsages || '');
      return name.includes(cleanQuery) || latin.includes(cleanQuery) || category.includes(cleanQuery) || forge.includes(cleanQuery);
    });

    const matchedCreatures = creatures.filter((c) => {
      const name = normalize(c.name);
      const latin = normalize(c.latinName || '');
      const category = normalize(c.category);
      const components = c.components.some((comp) => normalize(comp.name).includes(cleanQuery));
      return name.includes(cleanQuery) || latin.includes(cleanQuery) || category.includes(cleanQuery) || components;
    });

    return {
      plants: matchedPlants,
      gems: matchedGems,
      minerals: matchedMinerals,
      creatures: matchedCreatures,
      totalCount: matchedPlants.length + matchedGems.length + matchedMinerals.length + matchedCreatures.length,
    };
  });

  function handleWindowMousedown(e: MouseEvent) {
    if (containerEl && !containerEl.contains(e.target as Node)) {
      isOpen = false;
    }
  }

  function handleWindowKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      inputEl?.focus();
      isOpen = true;
    } else if (e.key === 'Escape') {
      isOpen = false;
    }
  }

  function handleSelectPlantItem(plant: Plant) {
    onSelectPlant(plant);
    isOpen = false;
    query = '';
  }

  function handleSelectGemItem(gem: Gem) {
    onSelectGem(gem);
    isOpen = false;
    query = '';
  }

  function handleSelectMineralItem(mineral: Mineral) {
    onSelectMineral?.(mineral);
    isOpen = false;
    query = '';
  }

  function handleSelectCreatureItem(creature: Creature) {
    onSelectCreature(creature);
    isOpen = false;
    query = '';
  }
</script>

<svelte:window onmousedown={handleWindowMousedown} onkeydown={handleWindowKeydown} />

<div bind:this={containerEl} class="search-container">
  <!-- Search Input Box -->
  <div class="input-wrap">
    <span class="search-icon">🔍</span>
    <input
      bind:this={inputEl}
      type="text"
      bind:value={query}
      onfocus={() => (isOpen = true)}
      oninput={() => (isOpen = true)}
      placeholder="Rechercher plante, gemme, créature..."
      class="search-input"
    />

    <!-- Clear or Shortcut badge -->
    <div class="input-right">
      {#if query}
        <button
          onclick={() => {
            query = '';
            inputEl?.focus();
          }}
          class="clear-btn"
        >
          ✕
        </button>
      {:else}
        <span class="shortcut-badge">⌘K</span>
      {/if}
    </div>
  </div>

  <!-- Floating Results Dropdown -->
  {#if isOpen && query.trim().length > 0}
    <div class="dropdown">
      <!-- Header count -->
      <div class="dropdown-header">
        <span class="dropdown-count">
          {#if results.totalCount > 0}
            <strong class="count-highlight">{results.totalCount}</strong> résultat(s) pour « {query} »
          {:else}
            Aucun résultat pour « {query} »
          {/if}
        </span>
        <span class="dropdown-hint">Entrée ou clic pour ouvrir</span>
      </div>

      <div class="dropdown-body">
        <!-- Section 1: Plantes -->
        {#if results.plants.length > 0}
          <div class="section">
            <div class="section-title section-title-plants">
              <span>🌿</span>
              <span>Plantes & Herbes ({results.plants.length})</span>
            </div>
            {#each results.plants.slice(0, 5) as plant (plant.id)}
              {@const rarityInfo = RARITY_METADATA[plant.rarity]}
              <div
                role="button"
                tabindex="0"
                onclick={() => handleSelectPlantItem(plant)}
                onkeydown={(e) => e.key === 'Enter' && handleSelectPlantItem(plant)}
                class="result-item group"
              >
                <div class="result-text">
                  <div class="result-name result-name-plant">{plant.name}</div>
                  <div class="result-sub">
                    {plant.latinName} · {BIOMES_METADATA[plant.biome]?.label.split(' ')[0]}
                  </div>
                </div>
                <span
                  class="result-badge"
                  style:color={rarityInfo?.color || '#d4af37'}
                  style:border-color={rarityInfo?.border || '#78350f'}
                  style:background-color={rarityInfo?.bg || 'transparent'}
                >
                  {rarityInfo?.label || plant.rarity}
                </span>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Section 2: Gemmes -->
        {#if results.gems.length > 0}
          <div class="section">
            <div class="section-title section-title-gems">
              <span>✨</span>
              <span>Gemmes de Fangh ({results.gems.length})</span>
            </div>
            {#each results.gems.slice(0, 4) as gem (gem.id)}
              {@const catMeta = GEM_CATEGORIES_META[gem.category]}
              <div
                role="button"
                tabindex="0"
                onclick={() => handleSelectGemItem(gem)}
                onkeydown={(e) => e.key === 'Enter' && handleSelectGemItem(gem)}
                class="result-item"
              >
                <div class="result-text">
                  <div class="result-name result-name-gem">{gem.name}</div>
                  <div class="result-sub">
                    {catMeta?.label || gem.category} · {gem.weightGoltors} Goltor(s)
                  </div>
                </div>
                <span class="result-price">{gem.basePriceRaw} po</span>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Section 3: Minéraux & Métaux Rares -->
        {#if results.minerals.length > 0}
          <div class="section">
            <div class="section-title section-title-minerals">
              <span>⛏️</span>
              <span>Minéraux & Métaux Rares ({results.minerals.length})</span>
            </div>
            {#each results.minerals.slice(0, 4) as mineral (mineral.id)}
              {@const catMeta = MINERAL_CATEGORIES_META[mineral.category]}
              <div
                role="button"
                tabindex="0"
                onclick={() => handleSelectMineralItem(mineral)}
                onkeydown={(e) => e.key === 'Enter' && handleSelectMineralItem(mineral)}
                class="result-item"
              >
                <div class="result-text">
                  <div class="result-name result-name-plant">{mineral.name}</div>
                  <div class="result-sub">
                    {catMeta?.label.split(' ')[0] || mineral.category} · DD Mine {mineral.dcProspect}
                  </div>
                </div>
                <span class="result-price">{mineral.basePricePerLingot} po</span>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Section 4: Créatures -->
        {#if results.creatures.length > 0}
          <div class="section">
            <div class="section-title section-title-creatures">
              <span>💀</span>
              <span>Bestiaire & Monstres ({results.creatures.length})</span>
            </div>
            {#each results.creatures.slice(0, 4) as creature (creature.id)}
              <div
                role="button"
                tabindex="0"
                onclick={() => handleSelectCreatureItem(creature)}
                onkeydown={(e) => e.key === 'Enter' && handleSelectCreatureItem(creature)}
                class="result-item"
              >
                <div class="result-text">
                  <div class="result-name result-name-creature">{creature.name}</div>
                  <div class="result-sub">
                    {creature.category} · {creature.components.length} composant(s)
                  </div>
                </div>
                <span class="result-cr">FP {creature.challengeRating}</span>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Empty State -->
        {#if results.totalCount === 0}
          <div class="empty-state">
            <p>Aucune plante, gemme ou créature ne correspond à votre recherche.</p>
            <p class="empty-hint">
              Vérifiez l'orthographe ou essayez un nom commun (ex: « lotus », « rubis », « dragon »).
            </p>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .search-container {
    position: relative;
    flex: 1;
    max-width: 20rem;
  }
  @media (min-width: 640px) {
    .search-container { max-width: 24rem; }
  }
  @media (min-width: 768px) {
    .search-container { max-width: 28rem; }
  }

  .input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }
  .search-icon {
    position: absolute;
    left: 0.75rem;
    font-size: 0.75rem;
    pointer-events: none;
  }
  .search-input {
    width: 100%;
    padding: 0.375rem 3.5rem 0.375rem 2.25rem;
    background-color: #120e0b;
    border: 1px solid #524136;
    border-radius: 0.5rem;
    font-size: 0.75rem;
    font-family: 'Crimson Pro', Georgia, serif;
    color: #f4ecd8;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
    transition: border-color 0.15s, box-shadow 0.15s;
    box-sizing: border-box;
  }
  .search-input::placeholder { color: #8c7866; }
  .search-input:focus {
    outline: none;
    border-color: #d4af37;
    box-shadow: 0 0 0 1px #d4af37;
  }

  .input-right {
    position: absolute;
    right: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .clear-btn {
    padding: 0.25rem;
    color: #a89988;
    background: none;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
  }
  .clear-btn:hover { color: #f4ecd8; }
  .shortcut-badge {
    display: none;
    font-size: 10px;
    font-family: monospace;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    background-color: #241c16;
    color: #a89988;
    border: 1px solid #3e2e23;
    pointer-events: none;
  }
  @media (min-width: 640px) {
    .shortcut-badge { display: inline-block; }
  }

  .dropdown {
    position: absolute;
    left: 0;
    right: 0;
    top: 100%;
    margin-top: 0.375rem;
    background-color: #1a1410;
    border: 2px solid #854d0e;
    border-radius: 0.75rem;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
    z-index: 50;
    overflow: hidden;
    font-family: 'Crimson Pro', Georgia, serif;
    max-height: 480px;
    display: flex;
    flex-direction: column;
  }
  .dropdown-header {
    padding: 0.5rem 0.75rem;
    background-color: #261d17;
    border-bottom: 1px solid #3e2e23;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.75rem;
    gap: 0.5rem;
  }
  .dropdown-count { color: #a89988; }
  .count-highlight { color: #fde047; }
  .dropdown-hint {
    font-size: 10px;
    color: #786554;
    font-style: italic;
    white-space: nowrap;
  }

  .dropdown-body {
    overflow-y: auto;
    font-size: 0.75rem;
  }
  .section {
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    border-bottom: 1px solid #2d2119;
  }
  .section:last-child { border-bottom: none; }
  .section-title {
    padding: 0.25rem 0.5rem;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  .section-title-plants { color: #4ade80; }
  .section-title-gems { color: #38bdf8; }
  .section-title-minerals { color: #f59e0b; }
  .section-title-creatures { color: #f87171; }

  .result-item {
    padding: 0.375rem 0.625rem;
    border-radius: 0.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    transition: background-color 0.15s;
  }
  .result-item:hover { background-color: #2e2118; }
  .result-text {
    min-width: 0;
  }
  .result-name {
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .result-name-plant { color: #fef08a; }
  .result-item:hover .result-name-plant { color: #fde047; }
  .result-name-gem { color: #bae6fd; }
  .result-item:hover .result-name-gem { color: #7dd3fc; }
  .result-name-creature { color: #fecaca; }
  .result-item:hover .result-name-creature { color: #f87171; }
  .result-sub {
    font-size: 10px;
    color: #a89988;
    font-style: italic;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .result-badge {
    font-size: 9px;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    border: 1px solid;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .result-price {
    font-size: 10px;
    font-family: monospace;
    color: #fde047;
    flex-shrink: 0;
    font-weight: 700;
  }
  .result-cr {
    font-size: 10px;
    font-family: monospace;
    font-weight: 700;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    background-color: #451a03;
    color: #fcd34d;
    border: 1px solid rgba(180, 83, 9, 0.5);
    flex-shrink: 0;
  }

  .empty-state {
    padding: 1.5rem;
    text-align: center;
    font-size: 0.75rem;
    color: #a89988;
    font-style: italic;
  }
  .empty-state p { margin: 0 0 0.25rem 0; }
  .empty-hint { font-size: 11px; color: #786554; }
</style>
