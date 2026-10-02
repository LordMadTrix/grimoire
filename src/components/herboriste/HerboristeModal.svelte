<script lang="ts">
  import { herboristeStore } from '$lib/herboriste/store.svelte';
  import { ALCHEMY_RECIPES } from '$lib/herboriste/data/herbalistData';
  import type { Plant, Creature } from '$lib/herboriste/types/herb';
  import GrimoireBookView from './GrimoireBookView.svelte';
  import HerbierExplorer from './HerbierExplorer.svelte';
  import AlchemicalWorkshop from './AlchemicalWorkshop.svelte';
  import PoisonsCompendiumView from './PoisonsCompendiumView.svelte';
  import GatheringSimulator from './GatheringSimulator.svelte';
  import HarvesterGuideView from './HarvesterGuideView.svelte';
  import BestiaryView from './BestiaryView.svelte';
  import MineralExplorerView from './MineralExplorerView.svelte';
  import ForgeWorkshopView from './ForgeWorkshopView.svelte';
  import LapidaireView from './LapidaireView.svelte';
  import PdfExportView from './PdfExportView.svelte';
  import PlantDetailModal from './PlantDetailModal.svelte';
  import AddCustomPlantModal from './AddCustomPlantModal.svelte';
  import GlobalSearchBar from './GlobalSearchBar.svelte';

  type ActiveTab = 'grimoire' | 'herbier' | 'alchimie' | 'poisons' | 'cueillette' | 'guide_recolteur' | 'bestiaire' | 'mineraux' | 'forge' | 'lapidaire' | 'pdf_export';

  let visible = $state(false);
  let activeTab = $state<ActiveTab>('grimoire');

  export function toggle() { visible = !visible; }
  export function open() { visible = true; }

  const recipes = ALCHEMY_RECIPES;

  const TABS: { id: ActiveTab; label: string; icon: string }[] = [
    { id: 'grimoire', label: 'Grimoire', icon: '📖' },
    { id: 'herbier', label: 'Herbier', icon: '🌿' },
    { id: 'alchimie', label: 'Alchimie', icon: '⚗️' },
    { id: 'poisons', label: 'Poisons', icon: '💀' },
    { id: 'cueillette', label: 'Cueillette', icon: '🧭' },
    { id: 'guide_recolteur', label: 'Guide', icon: '📜' },
    { id: 'bestiaire', label: 'Bestiaire', icon: '🐺' },
    { id: 'mineraux', label: 'Minéraux', icon: '⛏️' },
    { id: 'forge', label: 'Forge', icon: '🔨' },
    { id: 'lapidaire', label: 'Lapidaire', icon: '💎' },
    { id: 'pdf_export', label: 'PDF', icon: '🖨️' },
  ];

  function selectPlant(plant: Plant) {
    herboristeStore.selectedPlant = plant;
  }

  function selectCreature(creature: Creature) {
    herboristeStore.selectedCreatureId = creature.id;
    activeTab = 'bestiaire';
  }

  function selectHerbByName(herbName: string) {
    const found = herboristeStore.plants.find(p => p.name.toLowerCase().includes(herbName.toLowerCase()));
    if (found) herboristeStore.selectedPlant = found;
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="herbo-overlay" onclick={(e) => { if (e.target === e.currentTarget) visible = false; }}>
    <div class="herbo-window">
      <header class="herbo-header">
        <div class="brand" onclick={() => activeTab = 'grimoire'} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && (activeTab = 'grimoire')}>
          <span class="brand-icon">🪶</span>
          <div>
            <div class="brand-title">
              Guide de l'Herboriste
              <span class="brand-badge">JDR</span>
            </div>
            <p class="brand-sub">Flore médicinale, magique & vénéneuse · {herboristeStore.plants.length} espèces</p>
          </div>
        </div>

        <div class="search-wrap">
          <GlobalSearchBar
            plants={herboristeStore.plants}
            creatures={herboristeStore.creatures}
            onSelectPlant={selectPlant}
            onSelectCreature={selectCreature}
            onSelectGem={() => activeTab = 'lapidaire'}
            onSelectMineral={() => activeTab = 'mineraux'}
          />
        </div>

        <div class="header-actions">
          <button class="add-btn" onclick={() => herboristeStore.isAddModalOpen = true} title="Ajouter une plante homebrew">➕ Plante</button>
          <button class="close-btn" onclick={() => visible = false} title="Fermer">✕</button>
        </div>
      </header>

      <nav class="herbo-tabs">
        {#each TABS as tab (tab.id)}
          <button class:active={activeTab === tab.id} onclick={() => activeTab = tab.id}>
            <span>{tab.icon}</span> {tab.label}
          </button>
        {/each}
      </nav>

      <main class="herbo-content">
        {#if activeTab === 'grimoire'}
          <GrimoireBookView
            plants={herboristeStore.plants}
            {recipes}
            onSelectPlant={selectPlant}
            onNavigateToPdf={() => activeTab = 'pdf_export'}
            onNavigateToAlchimie={() => activeTab = 'alchimie'}
          />
        {:else if activeTab === 'herbier'}
          <HerbierExplorer />
        {:else if activeTab === 'alchimie'}
          <AlchemicalWorkshop
            {recipes}
            plants={herboristeStore.plants}
            onSelectPlant={selectPlant}
            onNavigateToPoisons={() => activeTab = 'poisons'}
          />
        {:else if activeTab === 'poisons'}
          <PoisonsCompendiumView
            onSelectPlant={selectPlant}
            onNavigateToAlchemy={() => activeTab = 'alchimie'}
          />
        {:else if activeTab === 'cueillette'}
          <GatheringSimulator
            plants={herboristeStore.plants}
            onSelectPlant={selectPlant}
            onNavigateToGuide={() => activeTab = 'guide_recolteur'}
          />
        {:else if activeTab === 'guide_recolteur'}
          <HarvesterGuideView
            plants={herboristeStore.plants}
            onSelectPlant={selectPlant}
            onNavigateToSimulator={() => activeTab = 'cueillette'}
          />
        {:else if activeTab === 'bestiaire'}
          <BestiaryView
            onSelectCreature={(c: Creature) => herboristeStore.selectedCreatureId = c.id}
            onSelectHerbByName={selectHerbByName}
          />
        {:else if activeTab === 'mineraux'}
          <MineralExplorerView onNavigateToForge={() => activeTab = 'forge'} />
        {:else if activeTab === 'forge'}
          <ForgeWorkshopView
            creatures={herboristeStore.creatures}
            onNavigateToMinerals={() => activeTab = 'mineraux'}
          />
        {:else if activeTab === 'lapidaire'}
          <LapidaireView />
        {:else if activeTab === 'pdf_export'}
          <PdfExportView
            plants={herboristeStore.plants}
            {recipes}
            creatures={herboristeStore.creatures}
            favoritePlantIds={herboristeStore.favoritePlantIds}
            favoriteCreatureIds={herboristeStore.favoriteCreatureIds}
            onToggleFavoritePlant={(id) => herboristeStore.toggleFavoritePlant(id)}
          />
        {/if}
      </main>

      <PlantDetailModal {recipes} />

      <AddCustomPlantModal />
    </div>
  </div>
{/if}

<style>
  .herbo-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    z-index: 1000;
    display: flex;
    align-items: stretch;
    justify-content: center;
    padding: 12px;
  }
  .herbo-window {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 10px;
    width: 100%;
    max-width: 1400px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  }
  .herbo-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 16px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    flex-shrink: 0;
  }
  .brand-icon { font-size: 26px; }
  .brand-title {
    font-family: serif;
    font-size: 18px;
    font-weight: bold;
    color: var(--accent);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .brand-badge {
    font-size: 9px;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--accent-bg);
    color: var(--accent);
    border: 1px solid var(--accent);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-family: monospace;
  }
  .brand-sub {
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
    margin: 0;
  }
  .search-wrap { flex: 1; min-width: 200px; }
  .header-actions { display: flex; gap: 8px; align-items: center; }
  .add-btn {
    background: var(--accent-bg);
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 6px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 13px;
    transition: var(--transition-fast);
  }
  .add-btn:hover { background: var(--accent); color: var(--bg-primary); }
  .close-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-secondary);
    border-radius: 6px;
    width: 32px;
    height: 32px;
    cursor: pointer;
    font-size: 14px;
    transition: var(--transition-fast);
  }
  .close-btn:hover { background: var(--danger); color: white; border-color: var(--danger); }
  .herbo-tabs {
    display: flex;
    gap: 4px;
    padding: 6px 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    flex-shrink: 0;
  }
  .herbo-tabs button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
    transition: var(--transition-fast);
  }
  .herbo-tabs button:hover { background: var(--bg-hover); color: var(--text-primary); }
  .herbo-tabs button.active {
    background: var(--accent-bg);
    color: var(--accent);
    border-color: var(--accent);
  }
  .herbo-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }
</style>
