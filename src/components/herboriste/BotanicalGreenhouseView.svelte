<script lang="ts">
  import type { Plant } from '$lib/herboriste/types/herb';
  import { herboristeStore } from '$lib/herboriste/store.svelte';
  import BotanicalIllustration from './BotanicalIllustration.svelte';

  interface Plot {
    id: number;
    plant: Plant | null;
    stage: 0 | 1 | 2 | 3; // 0=graine, 1=pousse, 2=floraison, 3=mature
    water: number; // 0 to 100
    fertilizer: 'none' | 'humus' | 'phenix' | 'lunaire';
    sunlight: 'soleil' | 'ombre' | 'lune';
    daysPlanted: number;
  }

  let plots = $state<Plot[]>([
    { id: 1, plant: herboristeStore.plants[0] ?? null, stage: 2, water: 80, fertilizer: 'humus', sunlight: 'soleil', daysPlanted: 3 },
    { id: 2, plant: herboristeStore.plants[1] ?? null, stage: 1, water: 65, fertilizer: 'none', sunlight: 'ombre', daysPlanted: 1 },
    { id: 3, plant: null, stage: 0, water: 50, fertilizer: 'none', sunlight: 'soleil', daysPlanted: 0 },
    { id: 4, plant: null, stage: 0, water: 50, fertilizer: 'none', sunlight: 'lune', daysPlanted: 0 },
  ]);

  let selectedPlotIndex = $state<number>(0);
  let isPlantingModalOpen = $state<boolean>(false);
  let plantingSearch = $state<string>('');
  let harvestMessage = $state<string | null>(null);

  // Hybridization state
  let hybridPlant1Id = $state<string>(herboristeStore.plants[0]?.id ?? '');
  let hybridPlant2Id = $state<string>(herboristeStore.plants[1]?.id ?? '');
  let hybridResult = $state<{ name: string; effect: string; success: boolean } | null>(null);

  const selectedPlot = $derived(plots[selectedPlotIndex]);

  const filteredPlantsForSeed = $derived(
    herboristeStore.plants.filter(p =>
      p.name.toLowerCase().includes(plantingSearch.toLowerCase()) ||
      p.biome.toLowerCase().includes(plantingSearch.toLowerCase())
    )
  );

  function waterPlot(index: number, amount: number = 30) {
    plots[index].water = Math.min(100, plots[index].water + amount);
  }

  function fertilizePlot(index: number, fert: 'humus' | 'phenix' | 'lunaire') {
    plots[index].fertilizer = fert;
    waterPlot(index, 15);
  }

  function plantSeed(plant: Plant) {
    plots[selectedPlotIndex] = {
      id: plots[selectedPlotIndex].id,
      plant,
      stage: 0,
      water: 75,
      fertilizer: 'none',
      sunlight: 'soleil',
      daysPlanted: 0,
    };
    isPlantingModalOpen = false;
  }

  function clearPlot(index: number) {
    plots[index] = {
      id: plots[index].id,
      plant: null,
      stage: 0,
      water: 50,
      fertilizer: 'none',
      sunlight: 'soleil',
      daysPlanted: 0,
    };
  }

  function harvestPlot(index: number) {
    const p = plots[index].plant;
    if (!p || plots[index].stage < 3) return;
    const doses = Math.floor(Math.random() * 3) + 2; // 2 to 4 doses
    harvestMessage = `Récolte abondante de ${p.name} : +${doses} doses fraîches ajoutées à vos provisions !`;
    clearPlot(index);
    setTimeout(() => (harvestMessage = null), 4000);
  }

  function advanceOneDay() {
    plots = plots.map((plot) => {
      if (!plot.plant) return plot;

      const waterDecr = plot.sunlight === 'soleil' ? 25 : 15;
      const newWater = Math.max(0, plot.water - waterDecr);
      let newStage = plot.stage;

      // Grow if sufficiently watered
      if (newWater > 20 && plot.stage < 3) {
        const fertBoost = plot.fertilizer !== 'none' ? 0.35 : 0;
        if (Math.random() + fertBoost > 0.3) {
          newStage = (plot.stage + 1) as 0 | 1 | 2 | 3;
        }
      }

      return {
        ...plot,
        water: newWater,
        stage: newStage,
        daysPlanted: plot.daysPlanted + 1,
      };
    });
  }

  function attemptHybridization() {
    const p1 = herboristeStore.plants.find(p => p.id === hybridPlant1Id);
    const p2 = herboristeStore.plants.find(p => p.id === hybridPlant2Id);
    if (!p1 || !p2 || p1.id === p2.id) return;

    const roll = Math.floor(Math.random() * 20) + 1;
    const dc = 14;

    if (roll >= dc) {
      const nameParts = [p1.name.split(' ')[0], p2.name.split(' ')[1] || p2.name.split(' ')[0]];
      const hybridName = `${nameParts[0]}-${nameParts[1]} Mystique`;
      hybridResult = {
        name: hybridName,
        effect: `Hybridation réussie ! Fusionne les vertus de ${p1.name} et ${p2.name} : amplifie la guérison et octroie une résistance magique de 1 heure.`,
        success: true,
      };
    } else {
      hybridResult = {
        name: 'Graine stérile',
        effect: `Le pollen a flétri sans prendre racine. Les deux essences étaient incompatibles (d20 = ${roll} vs DD ${dc}).`,
        success: false,
      };
    }
  }
</script>

<div class="greenhouse-page">
  <!-- Header -->
  <div class="gh-header">
    <div>
      <div class="tag-row">
        <span class="badge">Atelier Botanique · Culture Vivrière & Arcanique</span>
        <span class="sub-note">Serre Chauffée & Bacs d'Alchimiste</span>
      </div>
      <h3 class="gh-title">
        <span>🌱</span> Serre Mystique & Jardin d'Herbes Rares
      </h3>
      <p class="gh-desc">
        Semez des graines d'espèces sauvages, régulez l'arrosage et les engrais alchimiques, et récoltez des feuilles fraîches sans quitter votre refuge entre deux aventures.
      </p>
    </div>

    <button type="button" class="btn-advance" onclick={advanceOneDay}>
      <span>⏳</span>
      <span>Passer 1 Journée (Repos Long)</span>
    </button>
  </div>

  {#if harvestMessage}
    <div class="harvest-banner">
      <span>🌾</span> {harvestMessage}
    </div>
  {/if}

  <!-- Main Grid: Plots on left, selected plot details on right -->
  <div class="gh-layout">
    <!-- Plots Grid -->
    <div class="plots-col">
      <div class="plots-grid">
        {#each plots as plot, idx (plot.id)}
          <button
            type="button"
            class="plot-card"
            class:active={selectedPlotIndex === idx}
            class:empty={!plot.plant}
            onclick={() => (selectedPlotIndex = idx)}
          >
            <div class="plot-top">
              <span class="plot-num">Bac #{plot.id}</span>
              <span class="plot-stage-badge">
                {#if !plot.plant}
                  Terreau libre
                {:else if plot.stage === 0}
                  🌱 Graine semée
                {:else if plot.stage === 1}
                  🌿 Jeune pousse
                {:else if plot.stage === 2}
                  🌸 Floraison
                {:else}
                  🌾 Prêt à récolter !
                {/if}
              </span>
            </div>

            <div class="plot-visual">
              {#if plot.plant}
                <div class="plot-stage-icon">
                  {#if plot.stage === 0}🌱{/if}
                  {#if plot.stage === 1}🌿{/if}
                  {#if plot.stage === 2}🌸{/if}
                  {#if plot.stage === 3}🌺{/if}
                </div>
                <div class="plot-plant-name">{plot.plant.name}</div>
                <div class="plot-plant-biome">{plot.plant.biome} · Jour {plot.daysPlanted}</div>
              {:else}
                <div class="plot-empty-icon">🪱</div>
                <div class="plot-empty-text">Terreau prêt pour semer</div>
              {/if}
            </div>

            <div class="plot-meters">
              <div class="meter-row">
                <span class="meter-lbl">💧 Eau</span>
                <div class="meter-bar">
                  <div class="meter-fill water" style="width: {plot.water}%;"></div>
                </div>
                <span class="meter-val">{plot.water}%</span>
              </div>
            </div>
          </button>
        {/each}
      </div>

      <!-- Hybridization Workbench -->
      <div class="hybrid-card">
        <h4 class="hybrid-title">
          <span>🧬</span> Creuset d'Hybridation de Graines
        </h4>
        <p class="hybrid-desc">
          Croisez deux plantes pour tenter de donner naissance à une nouvelle variété hybride aux vertus combinées (DD 14 Nature).
        </p>

        <div class="hybrid-inputs">
          <select bind:value={hybridPlant1Id} class="hybrid-select">
            {#each herboristeStore.plants as p (p.id)}
              <option value={p.id}>{p.name} ({p.biome})</option>
            {/each}
          </select>
          <span class="plus-icon">✚</span>
          <select bind:value={hybridPlant2Id} class="hybrid-select">
            {#each herboristeStore.plants as p (p.id)}
              <option value={p.id}>{p.name} ({p.biome})</option>
            {/each}
          </select>
          <button type="button" class="btn-hybrid" onclick={attemptHybridization}>
            <span>⚗️</span> Hybrider
          </button>
        </div>

        {#if hybridResult}
          <div class="hybrid-res" class:ok={hybridResult.success} class:fail={!hybridResult.success}>
            <strong>{hybridResult.name}</strong> : {hybridResult.effect}
          </div>
        {/if}
      </div>
    </div>

    <!-- Right Side: Care & Actions for Selected Plot -->
    <div class="detail-col">
      <div class="detail-card">
        <div class="detail-head">
          <span class="detail-tag">Gestion du Bac #{selectedPlot.id}</span>
          <h4 class="detail-name">{selectedPlot.plant ? selectedPlot.plant.name : 'Parcelle en Friche'}</h4>
        </div>

        {#if selectedPlot.plant}
          <div class="detail-thumb">
            <BotanicalIllustration plant={selectedPlot.plant} size="md" />
          </div>

          <div class="care-section">
            <span class="care-title">Soins & Arrosage</span>
            <div class="care-actions">
              <button type="button" class="btn-care" onclick={() => waterPlot(selectedPlotIndex, 35)}>
                <span>💧</span> Arroser (+35%)
              </button>
              <button type="button" class="btn-care" onclick={() => fertilizePlot(selectedPlotIndex, 'humus')}>
                <span>🍂</span> Humus (+ Croissance)
              </button>
              <button type="button" class="btn-care" onclick={() => fertilizePlot(selectedPlotIndex, 'phenix')}>
                <span>🔥</span> Cendre de Phénix
              </button>
              <button type="button" class="btn-care" onclick={() => fertilizePlot(selectedPlotIndex, 'lunaire')}>
                <span>🌙</span> Poudre Lunaire
              </button>
            </div>
          </div>

          <!-- Harvest or Clear -->
          <div class="action-footer">
            {#if selectedPlot.stage >= 3}
              <button type="button" class="btn-harvest" onclick={() => harvestPlot(selectedPlotIndex)}>
                <span>🌾</span> Récolter les Herbes Matures
              </button>
            {/if}
            <button type="button" class="btn-clear" onclick={() => clearPlot(selectedPlotIndex)}>
              <span>🗑️</span> Défricher la parcelle
            </button>
          </div>
        {:else}
          <div class="empty-plot-actions">
            <p>Cette parcelle est vide. Choisissez une graine de votre herbier pour commencer la culture.</p>
            <button type="button" class="btn-plant-seed" onclick={() => (isPlantingModalOpen = true)}>
              <span>🌱</span> Semer une Graine
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Seed Picker Modal -->
  {#if isPlantingModalOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-backdrop" onclick={() => (isPlantingModalOpen = false)}>
      <div class="modal-box" onclick={(e) => e.stopPropagation()}>
        <div class="modal-head">
          <h4>🌱 Choisir une Graine à Semer (Bac #{selectedPlot.id})</h4>
          <button type="button" class="modal-close" onclick={() => (isPlantingModalOpen = false)}>✕</button>
        </div>

        <input
          type="text"
          placeholder="Rechercher une plante ou un biome..."
          bind:value={plantingSearch}
          class="modal-search"
        />

        <div class="seed-list">
          {#each filteredPlantsForSeed as plant (plant.id)}
            <button type="button" class="seed-item" onclick={() => plantSeed(plant)}>
              <span class="s-name">{plant.name}</span>
              <span class="s-biome">{plant.biome}</span>
              <span class="s-rarity">{plant.rarity}</span>
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .greenhouse-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    font-family: Georgia, 'Times New Roman', serif;
    color: #e6d8c3;
  }

  .gh-header {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid #4a392d;
  }
  @media (min-width: 768px) {
    .gh-header {
      flex-direction: row;
      align-items: flex-start;
    }
  }

  .tag-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
  .badge {
    background: #14532d;
    color: #86efac;
    font-size: 0.7rem;
    font-weight: bold;
    padding: 0.15rem 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid #16a34a;
    font-family: ui-monospace, monospace;
    text-transform: uppercase;
  }
  .sub-note { font-size: 0.75rem; color: #a89988; font-style: italic; }

  .gh-title {
    font-size: 1.6rem;
    font-weight: bold;
    color: #d4af37;
    margin: 0.25rem 0;
  }
  .gh-desc {
    font-size: 0.85rem;
    color: #c4b5a5;
    max-width: 46rem;
    margin: 0;
    line-height: 1.45;
    font-style: italic;
  }

  .btn-advance {
    background: linear-gradient(135deg, #15803d, #166534);
    color: #f0fdf4;
    border: none;
    border-radius: 0.4rem;
    padding: 0.75rem 1.25rem;
    font-size: 0.85rem;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
    transition: transform 0.1s ease;
  }
  .btn-advance:hover { filter: brightness(1.15); transform: translateY(-1px); }

  .harvest-banner {
    background: #fefce8;
    border: 1px solid #fde047;
    color: #854d0e;
    padding: 0.75rem 1rem;
    border-radius: 0.4rem;
    font-weight: bold;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* Layout */
  .gh-layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  @media (min-width: 1024px) {
    .gh-layout { grid-template-columns: 1.2fr 0.8fr; }
  }

  .plots-col { display: flex; flex-direction: column; gap: 1.25rem; }

  .plots-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  @media (min-width: 640px) {
    .plots-grid { grid-template-columns: repeat(2, 1fr); }
  }

  .plot-card {
    background: #241c16;
    border: 2px solid #4a392d;
    border-radius: 0.5rem;
    padding: 1rem;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    color: #e6d8c3;
  }
  .plot-card:hover { background: #2f231b; border-color: #854d0e; }
  .plot-card.active {
    background: #3a2a1d;
    border-color: #d4af37;
    box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.3);
  }
  .plot-card.empty { border-style: dashed; }

  .plot-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .plot-num { font-size: 0.75rem; font-weight: bold; color: #fef08a; }
  .plot-stage-badge {
    font-size: 0.7rem;
    background: #181310;
    padding: 0.15rem 0.45rem;
    border-radius: 0.2rem;
    color: #86efac;
    font-weight: bold;
  }

  .plot-visual {
    background: #181310;
    border: 1px solid #3e2e23;
    border-radius: 0.35rem;
    padding: 0.85rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }
  .plot-stage-icon { font-size: 2rem; }
  .plot-plant-name { font-size: 0.95rem; font-weight: bold; color: #fef08a; }
  .plot-plant-biome { font-size: 0.72rem; color: #a89988; font-style: italic; }
  .plot-empty-icon { font-size: 2rem; opacity: 0.6; }
  .plot-empty-text { font-size: 0.75rem; color: #854d0e; font-style: italic; }

  .plot-meters { display: flex; flex-direction: column; gap: 0.25rem; }
  .meter-row { display: flex; align-items: center; gap: 0.4rem; font-size: 0.7rem; }
  .meter-lbl { width: 3.5rem; color: #a89988; }
  .meter-bar {
    flex: 1;
    height: 0.5rem;
    background: #181310;
    border-radius: 0.25rem;
    overflow: hidden;
    border: 1px solid #3e2e23;
  }
  .meter-fill.water { background: #38bdf8; height: 100%; }
  .meter-val { font-size: 0.68rem; font-family: ui-monospace, monospace; color: #fde047; }

  /* Hybridization card */
  .hybrid-card {
    background: #241c16;
    border: 1px solid #4a392d;
    border-radius: 0.5rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }
  .hybrid-title { font-size: 0.95rem; font-weight: bold; color: #fef08a; margin: 0; display: flex; align-items: center; gap: 0.4rem; }
  .hybrid-desc { font-size: 0.75rem; color: #a89988; margin: 0; line-height: 1.35; font-style: italic; }
  .hybrid-inputs { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
  .hybrid-select {
    flex: 1;
    min-width: 10rem;
    background: #181310;
    border: 1px solid #59473b;
    border-radius: 0.35rem;
    padding: 0.4rem 0.5rem;
    color: #f5ecd7;
    font-size: 0.75rem;
  }
  .plus-icon { font-weight: bold; color: #d4af37; }
  .btn-hybrid {
    background: #78350f;
    color: #fff;
    border: none;
    border-radius: 0.35rem;
    padding: 0.4rem 0.85rem;
    font-size: 0.75rem;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .btn-hybrid:hover { background: #92400e; }
  .hybrid-res {
    background: #181310;
    padding: 0.5rem 0.75rem;
    border-radius: 0.35rem;
    border: 1px solid #3e2e23;
    font-size: 0.75rem;
    line-height: 1.35;
  }
  .hybrid-res.ok { border-color: #16a34a; color: #86efac; }
  .hybrid-res.fail { border-color: #dc2626; color: #fca5a5; }

  /* Detail Card */
  .detail-card {
    background: #f7f2e7;
    color: #2c1810;
    border: 4px solid #5c3e29;
    border-radius: 0.75rem;
    padding: 1.25rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .detail-head { border-bottom: 2px solid rgba(133, 77, 14, 0.3); padding-bottom: 0.5rem; text-align: center; }
  .detail-tag { font-size: 0.65rem; text-transform: uppercase; color: #854d0e; font-weight: bold; }
  .detail-name { font-size: 1.3rem; font-weight: bold; color: #3a1d0f; margin: 0.15rem 0; }
  .detail-thumb { display: flex; justify-content: center; }

  .care-section { display: flex; flex-direction: column; gap: 0.5rem; }
  .care-title { font-size: 0.8rem; font-weight: bold; color: #78350f; text-transform: uppercase; }
  .care-actions {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }
  .btn-care {
    background: #efe4d0;
    border: 1px solid #cfbca2;
    border-radius: 0.35rem;
    padding: 0.5rem;
    font-size: 0.75rem;
    font-weight: bold;
    color: #451a03;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
  }
  .btn-care:hover { background: #e2d2b8; border-color: #854d0e; }

  .action-footer { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem; }
  .btn-harvest {
    background: linear-gradient(135deg, #15803d, #166534);
    color: #fff;
    border: none;
    border-radius: 0.35rem;
    padding: 0.65rem;
    font-size: 0.85rem;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
  }
  .btn-clear {
    background: transparent;
    border: 1px solid #cbd5e1;
    border-radius: 0.35rem;
    padding: 0.4rem;
    font-size: 0.7rem;
    color: #64748b;
    cursor: pointer;
  }
  .btn-clear:hover { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }

  .empty-plot-actions {
    text-align: center;
    padding: 2rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  .btn-plant-seed {
    background: #78350f;
    color: #fff;
    border: none;
    border-radius: 0.4rem;
    padding: 0.75rem 1.25rem;
    font-size: 0.85rem;
    font-weight: bold;
    cursor: pointer;
  }
  .btn-plant-seed:hover { background: #92400e; }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  .modal-box {
    background: #1e1712;
    border: 2px solid #5c3e29;
    border-radius: 0.65rem;
    width: 100%;
    max-width: 32rem;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    padding: 1.25rem;
    color: #e6d8c3;
  }
  .modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
  .modal-head h4 { font-size: 1rem; font-weight: bold; color: #fef08a; margin: 0; }
  .modal-close { background: none; border: none; color: #a89988; font-size: 1.1rem; cursor: pointer; }
  .modal-search {
    background: #120e0b;
    border: 1px solid #59473b;
    border-radius: 0.35rem;
    padding: 0.5rem 0.75rem;
    color: #f5ecd7;
    font-size: 0.8rem;
    margin-bottom: 0.75rem;
  }
  .seed-list { display: flex; flex-direction: column; gap: 0.35rem; overflow-y: auto; max-height: 20rem; }
  .seed-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #241c16;
    border: 1px solid #3e2e23;
    border-radius: 0.3rem;
    padding: 0.5rem 0.75rem;
    color: #e6d8c3;
    cursor: pointer;
    font-size: 0.8rem;
    text-align: left;
  }
  .seed-item:hover { background: #3b271b; border-color: #d4af37; }
  .s-name { font-weight: bold; color: #fef08a; flex: 1; }
  .s-biome { font-size: 0.7rem; color: #a89988; margin-right: 0.5rem; }
  .s-rarity { font-size: 0.65rem; color: #86efac; }
</style>
