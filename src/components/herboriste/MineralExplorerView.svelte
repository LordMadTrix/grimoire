<script lang="ts">
  import type { Mineral, MineralExtractionRoll } from '$lib/herboriste/types/mineral';
  import { MINERALS_LIST, MINERAL_CATEGORIES_META } from '$lib/herboriste/data/mineralData';
  import MineralIllustration from './MineralIllustration.svelte';

  let { onNavigateToForge }: { onNavigateToForge?: () => void } = $props();

  let searchQuery = $state<string>('');
  let selectedCategory = $state<string>('all');
  let selectedMineral = $state<Mineral>(MINERALS_LIST[0]);

  // Mining Simulator state
  let minerBonus = $state<number>(3);
  let miningDiceMode = $state<'virtual' | 'manual'>('virtual');
  let manualMiningD20 = $state<number>(14);
  let miningResult = $state<MineralExtractionRoll | null>(null);

  // Metal Forge Calculator state
  let lingotCount = $state<number>(1);
  let isDwarvenForged = $state<boolean>(false);

  // Filtered minerals
  const filteredMinerals = $derived(MINERALS_LIST.filter((min) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      min.name.toLowerCase().includes(q) ||
      min.latinOrScientificName.toLowerCase().includes(q) ||
      min.forgeUsages.toLowerCase().includes(q) ||
      min.alchemicalProperties.toLowerCase().includes(q) ||
      min.originGeology.some(o => o.toLowerCase().includes(q));

    const matchesCategory = selectedCategory === 'all' || min.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }));

  // Roll extraction check (virtual or manual)
  function handleRollExtraction(customD20?: number) {
    const d20 = customD20 !== undefined
      ? Math.min(20, Math.max(1, customD20))
      : (miningDiceMode === 'manual' ? Math.min(20, Math.max(1, manualMiningD20)) : Math.floor(Math.random() * 20) + 1);

    const total = d20 + minerBonus;
    const dc = selectedMineral.dcProspect;
    const critSuccess = d20 === 20;
    const critFail = d20 === 1;
    const success = (total >= dc || critSuccess) && !critFail;

    let quantity = 0;
    let message = '';

    if (critSuccess) {
      quantity = Math.floor(Math.random() * 3) + 3; // 3 to 5 lingots
      message = `Coup de pioche magistral ! Une géode de pureté exceptionnelle mise au jour (+${quantity} lingots/blocs bruts de ${selectedMineral.name}).`;
    } else if (success) {
      quantity = Math.floor(Math.random() * 2) + 1; // 1 to 2 lingots
      message = `Filon exploité avec succès. Les parois de roche cèdent sous vos coups (+${quantity} lingot/bloc brut).`;
    } else if (critFail) {
      message = `Éboulement ou fissure toxique ! Votre pioche s'est brisée ou une poche de gaz a jailli (1d6 dégâts contondants ou poison).`;
    } else {
      message = `Roche trop dure ou veine épuisée. Vos efforts n'ont dégagé que de la caillasse stérile (DD ${dc} non atteint).`;
    }

    miningResult = {
      roll: d20,
      total,
      dc,
      success,
      critSuccess,
      critFail,
      quantityMined: quantity,
      message,
    };
  }

  // Calculate forge / trade value
  const calculatedValue = $derived((() => {
    const baseValue = selectedMineral.basePricePerLingot * lingotCount;
    return isDwarvenForged ? Math.round(baseValue * 1.5) : baseValue;
  })());
</script>

<div class="root">
  <!-- Intro Header -->
  <div class="intro">
    <div class="intro-head">
      <div>
        <div class="intro-meta">
          <span class="badge">Traité de Minéralogie & Métallurgie de Fangh</span>
          <span class="meta-note">
            {MINERALS_LIST.length} métaux, roches et minéraux alchimiques
          </span>
        </div>
        <h3 class="intro-title">
          <span>⛏️</span>
          Minéraux, Minerais & Métaux Rares
        </h3>
        <p class="intro-desc">
          De l'inestimable Mithril léger des profondeurs naines à l'Adamantium céleste, en passant par le Vif-Argent liquide et le Sel gemme protecteur : tout ce dont l'artisan, le forgeron et l'alchimiste ont besoin.
        </p>
      </div>
    </div>

    <!-- Search & Category Filter -->
    <div class="filter-row">
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Rechercher par minéral, forge, alchimie ou gisement..."
          bind:value={searchQuery}
          class="search-input"
        />
      </div>

      <div class="cat-select-wrap">
        <select bind:value={selectedCategory} class="select-input">
          <option value="all">Toutes les catégories ({MINERALS_LIST.length})</option>
          {#each Object.entries(MINERAL_CATEGORIES_META) as [key, meta] (key)}
            <option value={key}>{meta.label}</option>
          {/each}
        </select>
      </div>
    </div>
  </div>

  <!-- Main Grid: Left List, Right Detailed Sheet -->
  <div class="layout">
    <!-- Left Column: Mineral Catalog -->
    <div class="catalog">
      {#if filteredMinerals.length === 0}
        <div class="empty-state">
          Aucun minéral ne correspond à vos filtres.
        </div>
      {:else}
        {#each filteredMinerals as mineral (mineral.id)}
          {@const isSelected = selectedMineral.id === mineral.id}
          {@const catMeta = MINERAL_CATEGORIES_META[mineral.category]}
          <div
            class="min-card"
            class:selected={isSelected}
            role="button"
            tabindex="0"
            onclick={() => {
              selectedMineral = mineral;
              miningResult = null;
            }}
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                selectedMineral = mineral;
                miningResult = null;
              }
            }}
          >
            <MineralIllustration {mineral} size="sm" showPlateDetails={false} class="shrink" />

            <div class="min-info">
              <div class="min-info-top">
                <h4 class="min-name">{mineral.name}</h4>
                <span class="min-price">{mineral.basePricePerLingot} po/lingot</span>
              </div>

              <div class="min-latin">{mineral.latinOrScientificName}</div>

              <div class="min-tags">
                <span
                  class="cat-tag"
                  style="color: {catMeta?.color || '#38bdf8'}; border-color: {catMeta?.color || '#38bdf8'};"
                >
                  {catMeta?.label.split(' ')[0] || mineral.category}
                </span>
                <span class="tag-hardness">Dureté : {mineral.hardnessMohs}/10</span>
                <span class="tag-dc">DD Mine : {mineral.dcProspect}</span>
              </div>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Right Column: Detailed Mineral Dossier & Mining Simulator -->
    <div class="col-right">
      <!-- Detailed Mineral Sheet -->
      <div class="sheet">
        <div class="sheet-head">
          <MineralIllustration
            mineral={selectedMineral}
            size="md"
            class="sheet-illustration"
          />

          <div class="sheet-head-info">
            <div class="sheet-badges">
              <span
                class="cat-tag lg"
                style="color: {MINERAL_CATEGORIES_META[selectedMineral.category]?.color || '#38bdf8'}; border-color: {MINERAL_CATEGORIES_META[selectedMineral.category]?.color || '#38bdf8'};"
              >
                {MINERAL_CATEGORIES_META[selectedMineral.category]?.label}
              </span>
              <span class="rarity-tag">
                Rareté : {selectedMineral.rarity}
              </span>
            </div>

            <h3 class="sheet-name">{selectedMineral.name}</h3>
            <p class="sheet-latin">{selectedMineral.latinOrScientificName}</p>

            <!-- Quick specs grid -->
            <div class="specs">
              <div class="spec-cell">
                <span class="spec-label">Dureté de Mohs</span>
                <span class="spec-value">{selectedMineral.hardnessMohs} / 10</span>
              </div>
              <div class="spec-cell">
                <span class="spec-label">Prix au lingot/bloc</span>
                <span class="spec-value">{selectedMineral.basePricePerLingot} PO</span>
              </div>
              <div class="spec-cell span2">
                <span class="spec-label">DD Prospection / Mine</span>
                <span class="spec-value">DD {selectedMineral.dcProspect}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Geological Origin & Description -->
        <div class="sheet-section">
          <div>
            <h4 class="section-title">Description & Aspect Visuel :</h4>
            <p class="section-text">{selectedMineral.description}</p>
            <p class="section-subtext">{selectedMineral.visualAspect}</p>
          </div>

          <div>
            <h4 class="section-title">Gisements & Origine Géologique :</h4>
            <div class="geo-tags">
              {#each selectedMineral.originGeology as geo, idx (idx)}
                <span class="geo-tag">📍 {geo}</span>
              {/each}
            </div>
            <div class="geo-meta">
              Densité : <strong class="strong-light">{selectedMineral.density}</strong> · Fusion : <strong class="strong-light">{selectedMineral.meltingPoint}</strong>
            </div>
          </div>
        </div>

        <!-- Forge & Metallurgy Usages -->
        <div class="usage-box forge">
          <h4 class="usage-title forge">
            <span>🔨</span>
            Propriétés de Forge & Armurerie :
          </h4>
          <p class="usage-text forge">{selectedMineral.forgeUsages}</p>
        </div>

        <!-- Alchemical & Medicinal Properties -->
        <div class="usage-box alch">
          <h4 class="usage-title alch">
            <span>⚗️</span>
            Usages Alchimiques & Solvants :
          </h4>
          <p class="usage-text alch">{selectedMineral.alchemicalProperties}</p>
        </div>

        <!-- Synergies with Herbalism -->
        <div class="usage-box syn">
          <h4 class="usage-title syn">
            <span>✨</span>
            Synergies avec les Plantes du Grimoire :
          </h4>
          <p class="usage-text syn">{selectedMineral.synergies}</p>
        </div>

        <!-- JDR / Lore Notes -->
        <div class="jdr-note">
          <span class="jdr-icon">ℹ️</span>
          <span>{selectedMineral.jdrNotes}</span>
        </div>
      </div>

      <!-- Interactive Tools: Mining Simulator (Virtual or Manual d20) & Forge Calculator -->
      <div class="tools-grid">
        <!-- Tool 1: Mining Simulator -->
        <div class="tool-card">
          <div class="tool-header-row">
            <h4 class="tool-title">
              <span>⛏️</span>
              Simulateur d'Extraction Minière
            </h4>
            <div class="dice-mode">
              <button
                class:active={miningDiceMode === 'virtual'}
                class="mode-btn"
                onclick={() => (miningDiceMode = 'virtual')}
              >
                Dé Virtuel
              </button>
              <button
                class:active={miningDiceMode === 'manual'}
                class="mode-btn"
                onclick={() => (miningDiceMode = 'manual')}
              >
                Jet Manuel
              </button>
            </div>
          </div>

          <div class="tool-body">
            <div>
              <label class="lbl" for="miner-bonus">
                Bonus de Mineur / Athlétisme : <strong class="strong-gold">+{minerBonus}</strong>
              </label>
              <input
                id="miner-bonus"
                type="range"
                min="0"
                max="10"
                bind:value={minerBonus}
                class="range-input"
              />
            </div>

            {#if miningDiceMode === 'manual'}
              <div class="tool-body">
                <div class="manual-row">
                  <label class="lbl" for="manual-mining-d20">
                    Votre jet sur votre dé physique (d20) :
                  </label>
                  <input
                    id="manual-mining-d20"
                    type="number"
                    min="1"
                    max="20"
                    bind:value={manualMiningD20}
                    class="num-input gold"
                  />
                </div>
                <button class="action-btn" onclick={() => handleRollExtraction(manualMiningD20)}>
                  <span>✓</span>
                  <span>Valider mon jet ({manualMiningD20}) vs DD {selectedMineral.dcProspect}</span>
                </button>
              </div>
            {:else}
              <button class="action-btn" onclick={() => handleRollExtraction()}>
                <span>🎲</span>
                <span>Lancer le d20 pour extraire {selectedMineral.name}</span>
              </button>
            {/if}

            <!-- Roll Result Display -->
            {#if miningResult}
              <div
                class="roll-result"
                class:crit={miningResult.critSuccess}
                class:success={!miningResult.critSuccess && miningResult.success}
                class:critfail={miningResult.critFail}
                class:fail={!miningResult.critSuccess && !miningResult.success && !miningResult.critFail}
              >
                <div class="roll-top">
                  <span class="roll-status">
                    {#if miningResult.success}✓{:else}✗{/if}
                    {miningResult.critSuccess
                      ? 'RÉUSSITE CRITIQUE (20 NATUREL) !'
                      : miningResult.success
                      ? 'EXTRACTION RÉUSSIE !'
                      : miningResult.critFail
                      ? 'ÉCHEC CRITIQUE (1 NATUREL) !'
                      : 'ÉCHEC DE LA VEINE'}
                  </span>
                  <span>
                    d20:{miningResult.roll} + {minerBonus} = {miningResult.total} (DD {miningResult.dc})
                  </span>
                </div>
                <p class="roll-message">{miningResult.message}</p>
              </div>
            {/if}
          </div>
        </div>

        <!-- Tool 2: Forge & Metallurgy Valuator -->
        <div class="tool-card">
          <div class="tool-header-row">
            <h4 class="tool-title">
              <span>🪙</span>
              Estimateur de Valeur en Forge
            </h4>
            <span class="market-tag">Marché de Fangh</span>
          </div>

          <div class="tool-body">
            <div>
              <label class="lbl" for="lingot-count">
                Quantité de lingots ou blocs : <strong class="strong-gold">{lingotCount}</strong>
              </label>
              <input
                id="lingot-count"
                type="range"
                min="1"
                max="10"
                bind:value={lingotCount}
                class="range-input"
              />
            </div>

            <div class="checkbox-row">
              <input
                type="checkbox"
                id="dwarvenForge"
                bind:checked={isDwarvenForged}
                class="checkbox-input"
              />
              <label for="dwarvenForge" class="checkbox-lbl">
                Lingot affiné par un maître forgeron nain (+50% de valeur)
              </label>
            </div>

            <!-- Final Estimated Price -->
            <div class="result-box">
              <div>
                <span class="result-label">Valeur marchande totale</span>
                <span class="result-value">
                  {calculatedValue.toLocaleString('fr-FR')} PO
                </span>
              </div>
              <span class="icon-lg">⚖️</span>
            </div>

            {#if onNavigateToForge}
              <button class="action-btn" onclick={onNavigateToForge}>
                <span>🔨</span>
                <span>Ouvrir la Grande Forge pour travailler ce métal</span>
              </button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .root {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    font-family: Georgia, 'Times New Roman', serif;
    animation: fade-in 0.3s ease;
  }

  .intro {
    background: #1f1915;
    border-radius: 0.75rem;
    border: 1px solid #4a3b32;
    padding: 1.5rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
  }

  .intro-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid #3e2e23;
    padding-bottom: 1rem;
    margin-bottom: 1rem;
  }

  .intro-meta { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }

  .badge {
    font-size: 10px;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: #451a03;
    color: #fcd34d;
    border: 1px solid rgba(217, 119, 6, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-family: ui-monospace, 'Courier New', monospace;
  }

  .meta-note { font-size: 12px; color: #a89988; }

  .intro-title {
    font-size: 1.5rem;
    font-weight: bold;
    color: #d4af37;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    margin: 0;
  }

  .intro-desc {
    font-size: 12px;
    color: #c4b5a5;
    font-style: italic;
    margin: 0.25rem 0 0;
    max-width: 48rem;
  }

  .filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
    justify-content: space-between;
    padding-top: 0.25rem;
  }

  .search-wrap { position: relative; flex: 1; min-width: 240px; }
  .search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); }

  .search-input {
    width: 100%;
    padding: 0.5rem 0.75rem 0.5rem 2.25rem;
    background: #120e0b;
    border: 1px solid #524136;
    border-radius: 0.5rem;
    font-size: 12px;
    font-family: Georgia, 'Times New Roman', serif;
    color: #f4ecd8;
    box-sizing: border-box;
  }
  .search-input:focus { outline: none; border-color: #d4af37; }

  .select-input {
    background: #120e0b;
    border: 1px solid #524136;
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
    font-size: 12px;
    font-family: Georgia, 'Times New Roman', serif;
    color: #f4ecd8;
  }
  .select-input:focus { outline: none; }

  .layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  @media (min-width: 1024px) {
    .layout { grid-template-columns: repeat(12, 1fr); }
    .catalog { grid-column: span 5; }
    .col-right { grid-column: span 7; }
  }

  .catalog {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 850px;
    overflow-y: auto;
    padding-right: 0.25rem;
  }

  .empty-state {
    padding: 2rem;
    text-align: center;
    background: #1a1410;
    border-radius: 0.75rem;
    border: 1px solid #3e2e23;
    font-size: 14px;
    color: #a89988;
    font-style: italic;
  }

  .min-card {
    padding: 1rem;
    border-radius: 0.75rem;
    border: 2px solid #3e2e23;
    cursor: pointer;
    display: flex;
    gap: 1rem;
    align-items: center;
    background: #1a1410;
    color: #d7c9b8;
    transition: var(--transition-fast, 0.15s);
  }
  .min-card:hover { background: #261d17; }
  .min-card.selected {
    background: #3d2719;
    border-color: #d4af37;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
    color: #fef08a;
  }

  :global(.shrink) { flex-shrink: 0; }

  .min-info { flex: 1; min-width: 0; }

  .min-info-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.25rem; }

  .min-name {
    font-weight: bold;
    font-size: 14px;
    color: #fef08a;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .min-price {
    font-size: 10px;
    font-family: ui-monospace, 'Courier New', monospace;
    font-weight: bold;
    color: #fde047;
    flex-shrink: 0;
  }

  .min-latin {
    font-size: 11px;
    color: #a89988;
    font-style: italic;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .min-tags { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap; }

  .cat-tag {
    font-size: 9px;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    border: 1px solid;
    font-weight: bold;
    background-color: #181310;
  }
  .cat-tag.lg { font-size: 10px; padding: 0.125rem 0.5rem; background-color: #1f1915; }

  .tag-hardness {
    font-size: 10px;
    color: #cbd5e1;
    font-family: ui-monospace, 'Courier New', monospace;
  }
  .tag-dc {
    font-size: 10px;
    color: #fcd34d;
    font-family: ui-monospace, 'Courier New', monospace;
  }

  .col-right { display: flex; flex-direction: column; gap: 1.5rem; }

  .sheet {
    background: #1c1612;
    border-radius: 0.75rem;
    border: 2px solid #5c4033;
    padding: 1.5rem;
    color: #f4ecd8;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .sheet-head {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    align-items: flex-start;
    border-bottom: 1px solid #4d3a2e;
    padding-bottom: 1.25rem;
  }
  @media (min-width: 640px) {
    .sheet-head { flex-direction: row; }
  }

  :global(.sheet-illustration) {
    flex-shrink: 0;
    margin-left: auto;
    margin-right: auto;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
  }
  @media (min-width: 640px) {
    :global(.sheet-illustration) { margin-left: 0; margin-right: 0; }
  }

  .sheet-head-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
  }
  @media (min-width: 640px) {
    .sheet-head-info { text-align: left; }
  }

  .sheet-badges {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  @media (min-width: 640px) {
    .sheet-badges { justify-content: flex-start; }
  }

  .rarity-tag {
    font-size: 12px;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: #451a03;
    color: #fcd34d;
    border: 1px solid rgba(180, 83, 9, 0.5);
    font-family: ui-monospace, 'Courier New', monospace;
  }

  .sheet-name { font-size: 1.5rem; font-weight: bold; color: #d4af37; margin: 0; }
  @media (min-width: 640px) {
    .sheet-name { font-size: 1.875rem; }
  }

  .sheet-latin { font-size: 12px; color: #a89988; font-style: italic; margin: 0; }

  .specs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    padding-top: 0.5rem;
    font-size: 12px;
  }
  @media (min-width: 640px) {
    .specs { grid-template-columns: repeat(3, 1fr); }
  }

  .spec-cell {
    background: #140f0c;
    padding: 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid #3e2e23;
  }
  .spec-cell.span2 { grid-column: span 2; }
  @media (min-width: 640px) {
    .spec-cell.span2 { grid-column: span 1; }
  }

  .spec-label { font-size: 10px; color: #a89988; display: block; }
  .spec-value {
    font-weight: bold;
    color: #fde047;
    font-family: ui-monospace, 'Courier New', monospace;
  }

  .sheet-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    font-size: 12px;
    line-height: 1.625;
    color: #d7c9b8;
  }

  .section-title {
    font-weight: bold;
    color: #fde047;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 11px;
    margin: 0 0 0.25rem;
  }

  .section-text { margin: 0; }
  .section-subtext { margin: 0.25rem 0 0; color: #a89988; font-style: italic; }

  .geo-tags { display: flex; flex-wrap: wrap; gap: 0.375rem; }

  .geo-tag {
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: #261d17;
    border: 1px solid #3e2e23;
    color: #cbd5e1;
  }

  .geo-meta { margin-top: 0.25rem; font-size: 11px; color: #a89988; }
  .strong-light { color: #f4ecd8; }

  .usage-box {
    padding: 1rem;
    border-radius: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .usage-box.forge { background: #241a12; border: 1px solid rgba(120, 53, 15, 0.6); }
  .usage-box.alch { background: #181a24; border: 1px solid rgba(59, 130, 246, 0.4); }
  .usage-box.syn { background: #131f18; border: 1px solid rgba(16, 185, 129, 0.4); }

  .usage-title {
    font-weight: bold;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }
  .usage-title.forge { color: #fcd34d; }
  .usage-title.alch { color: #93c5fd; }
  .usage-title.syn { color: #6ee7b7; }

  .usage-text { font-size: 12px; line-height: 1.625; margin: 0; }
  .usage-text.forge { color: #fef3c7; }
  .usage-text.alch { color: #e0f2fe; }
  .usage-text.syn { color: #ecfdf5; }

  .jdr-note {
    padding: 0.75rem;
    border-radius: 0.5rem;
    background: #140f0c;
    border: 1px solid #3e2e23;
    font-size: 12px;
    color: #a89988;
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-style: italic;
  }
  .jdr-icon { flex-shrink: 0; margin-top: 0.125rem; }

  .tools-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  @media (min-width: 768px) {
    .tools-grid { grid-template-columns: 1fr 1fr; }
  }

  .tool-card {
    background: #1c1612;
    padding: 1.25rem;
    border-radius: 0.75rem;
    border: 1px solid #4a3b32;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .tool-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #3e2e23;
    padding-bottom: 0.5rem;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .tool-title {
    font-weight: bold;
    font-size: 14px;
    color: #fde047;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
  }

  .dice-mode {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: #181310;
    padding: 0.125rem;
    border-radius: 0.25rem;
    border: 1px solid #3e2e23;
  }

  .mode-btn {
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 10px;
    cursor: pointer;
    background: transparent;
    border: none;
    color: #a89988;
    font-family: Georgia, 'Times New Roman', serif;
    transition: var(--transition-fast, 0.15s);
  }
  .mode-btn.active { background: #854d0e; color: #ffffff; font-weight: bold; }

  .tool-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    font-size: 12px;
  }

  .lbl { display: block; color: #a89988; margin-bottom: 0.25rem; }
  .strong-gold { color: #fde047; }

  .range-input { width: 100%; accent-color: #d4af37; }

  .manual-row { display: flex; align-items: center; gap: 0.75rem; }

  .num-input {
    width: 4rem;
    padding: 0.25rem 0.5rem;
    background: #120e0b;
    border: 1px solid #59473b;
    border-radius: 0.25rem;
    text-align: center;
    font-size: 14px;
    font-weight: bold;
    color: #fde047;
    font-family: ui-monospace, 'Courier New', monospace;
  }
  .num-input.gold { border-color: #d4af37; }
  .num-input:focus { outline: none; }

  .action-btn {
    width: 100%;
    padding: 0.625rem;
    border-radius: 0.5rem;
    background: #b45309;
    color: #ffffff;
    font-weight: bold;
    font-size: 12px;
    font-family: Georgia, 'Times New Roman', serif;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
    transition: var(--transition-fast, 0.15s);
  }
  .action-btn:hover { background: #d97706; }

  .roll-result {
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    transition: var(--transition-fast, 0.15s);
  }
  .roll-result.crit { background: rgba(20, 83, 45, 0.4); border-color: #22c55e; color: #86efac; }
  .roll-result.success { background: rgba(30, 58, 95, 0.4); border-color: #38bdf8; color: #bae6fd; }
  .roll-result.critfail { background: rgba(69, 10, 10, 0.5); border-color: #ef4444; color: #fca5a5; }
  .roll-result.fail { background: #291b16; border-color: #78350f; color: #fde047; }

  .roll-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: ui-monospace, 'Courier New', monospace;
    font-weight: bold;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .roll-status { display: flex; align-items: center; gap: 0.375rem; }

  .roll-message { line-height: 1.625; margin: 0; }

  .market-tag {
    font-size: 10px;
    font-family: ui-monospace, 'Courier New', monospace;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: #2b1f17;
    color: #cbd5e1;
    border: 1px solid #524136;
  }

  .checkbox-row { display: flex; align-items: center; gap: 0.5rem; padding-top: 0.25rem; }
  .checkbox-input { accent-color: #d4af37; border-radius: 0.25rem; }
  .checkbox-lbl { color: #d7c9b8; cursor: pointer; }

  .result-box {
    background: #120e0b;
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid #3e2e23;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .result-label { font-size: 10px; color: #a89988; display: block; }
  .result-value {
    font-weight: bold;
    font-size: 1.125rem;
    color: #fde047;
    font-family: ui-monospace, 'Courier New', monospace;
  }
  .icon-lg { font-size: 1.5rem; }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
