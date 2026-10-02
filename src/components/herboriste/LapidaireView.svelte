<script lang="ts">
  import type { Gem, GemCategory, GemLootRoll } from '$lib/herboriste/types/gem';
  import { GEMS_LIST, GEM_CATEGORIES_META, GOLTOR_RULES } from '$lib/herboriste/data/gemData';
  import GemIllustration from './GemIllustration.svelte';
  import GemProspectingView from './GemProspectingView.svelte';
  import GemCuttingWorkshopView from './GemCuttingWorkshopView.svelte';

  import { herboristeStore } from '$lib/herboriste/store.svelte';

  type LapidaireSection = 'catalogue' | 'taille' | 'prospection';

  let activeSection = $state<LapidaireSection>('catalogue');
  let searchQuery = $state('');
  let selectedCategory = $state<string>('all');
  let selectedGem = $state<Gem>(GEMS_LIST[0]);

  $effect(() => {
    if (herboristeStore.selectedGemId) {
      const g = GEMS_LIST.find((x) => x.id === herboristeStore.selectedGemId);
      if (g) {
        selectedGem = g;
        activeSection = 'catalogue';
      }
    }
  });

  // Jewelry Calculator state
  let calcWeight = $state<number>(1);
  let calcIsCut = $state<boolean>(true);
  let calcPurity = $state<number>(1.0); // multiplier

  // Loot Simulator state
  let lastLoot = $state<GemLootRoll | null>(null);
  let lootDiceMode = $state<'virtual' | 'manual'>('virtual');
  let manualLootD20 = $state<number>(12);

  const categoryOptions: string[] = ['all', 'precieuse', 'fine', 'ornementale', 'magique'];

  // Filter gems
  const filteredGems = $derived(GEMS_LIST.filter((gem) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      gem.name.toLowerCase().includes(q) ||
      gem.description.toLowerCase().includes(q) ||
      gem.magicalAffinity.toLowerCase().includes(q) ||
      gem.enchantmentEffect.toLowerCase().includes(q);

    const matchesCat = selectedCategory === 'all' || gem.category === selectedCategory;
    return matchesSearch && matchesCat;
  }));

  // Calculate estimated price
  const calculatedPricePo = $derived(Math.round(
    (calcIsCut ? selectedGem.basePriceCut : selectedGem.basePriceRaw) * calcWeight * calcPurity
  ));

  // Generate random gem loot roll (virtual or manual)
  function handleRollLoot(customRoll?: number) {
    const roll = customRoll !== undefined
      ? Math.max(1, customRoll)
      : (lootDiceMode === 'manual' ? Math.max(1, manualLootD20) : Math.floor(Math.random() * GEMS_LIST.length) + 1);

    const randomGem = GEMS_LIST[(roll - 1) % GEMS_LIST.length];
    const weightRoll = Math.floor(Math.random() * 3) + 1; // 1 to 3 UG
    const isCutRoll = Math.random() > 0.45; // 55% chance cut
    const purityRoll = Math.random();

    let purityLabel: 'Parfaite (+50%)' | 'Standard' | 'Avec inclusions (-25%)' = 'Standard';
    let purityMult = 1.0;

    if (purityRoll > 0.8) {
      purityLabel = 'Parfaite (+50%)';
      purityMult = 1.5;
    } else if (purityRoll < 0.25) {
      purityLabel = 'Avec inclusions (-25%)';
      purityMult = 0.75;
    }

    const baseVal = isCutRoll ? randomGem.basePriceCut : randomGem.basePriceRaw;
    const finalVal = Math.round(baseVal * weightRoll * purityMult);

    lastLoot = {
      d20: roll,
      gem: randomGem,
      weight: weightRoll,
      isCut: isCutRoll,
      purity: purityLabel,
      finalValuePo: finalVal,
    };
  }

  function handleSelectFromSubView(gem: Gem) {
    selectedGem = gem;
    activeSection = 'catalogue';
  }
</script>

<div class="page">
  <!-- Title Header -->
  <div class="title-block">
    <div class="title-meta">
      <span class="badge">Supplément Officieux Naheulbeuk & JDR</span>
      <span class="meta-note">· {GEMS_LIST.length} pierres répertoriées</span>
    </div>
    <h2 class="main-title">
      <span class="icon">✨</span>
      Le Lapidaire : Guide des Gemmes & Pierres Précieuses
    </h2>
    <p class="subtitle">
      Traité minéralogique, évaluation en Unités Goltor, atelier de taille & facettage, et prospection alluviale
    </p>
  </div>

  <!-- Sub-navigation Tabs -->
  <div class="lapidaire-nav">
    <button
      type="button"
      class="lap-tab"
      class:active={activeSection === 'catalogue'}
      onclick={() => (activeSection = 'catalogue')}
    >
      <span>💎</span>
      <span>Traité & Catalogue ({GEMS_LIST.length} gemmes)</span>
    </button>
    <button
      type="button"
      class="lap-tab"
      class:active={activeSection === 'taille'}
      onclick={() => (activeSection = 'taille')}
    >
      <span>⚙️</span>
      <span>Atelier de Taille & Facettage</span>
      <span class="pill-craft">ARTISANAT</span>
    </button>
    <button
      type="button"
      class="lap-tab"
      class:active={activeSection === 'prospection'}
      onclick={() => (activeSection = 'prospection')}
    >
      <span>⛏️</span>
      <span>Prospection Alluviale & Géodes</span>
      <span class="new-pill">EXPÉDITION</span>
    </button>
  </div>

  {#if activeSection === 'catalogue'}
    <!-- Quick Goltor Lore Box -->
    <div class="lore-box">
      <div class="lore-inner">
        <span class="icon-lg">⚖️</span>
        <div class="lore-text">
          <h4 class="lore-title">{GOLTOR_RULES.title}</h4>
          <p class="lore-desc">
            {GOLTOR_RULES.intro} {GOLTOR_RULES.definition} {GOLTOR_RULES.cutBonus}
          </p>
        </div>
      </div>
    </div>

    <!-- Main Layout: 2 Columns -->
    <div class="layout">
      <!-- Left Column: Catalogue of Gems -->
      <div class="col-left">
        <!-- Search & Category Filter -->
        <div class="filter-box">
          <div class="search-wrap">
            <input
              type="text"
              placeholder="Rechercher une pierre, un effet, une couleur..."
              bind:value={searchQuery}
              class="search-input"
            />
            <span class="search-icon">🔍</span>
          </div>

          <div class="cat-pills">
            {#each categoryOptions as cat}
              <button
                class:active={selectedCategory === cat}
                class="cat-pill"
                onclick={() => (selectedCategory = cat)}
              >
                {cat === 'all' ? `Toutes (${GEMS_LIST.length})` : GEM_CATEGORIES_META[cat as GemCategory]?.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Gem list cards -->
        <div class="gem-list">
          {#each filteredGems as gem (gem.id)}
            {@const isSelected = selectedGem.id === gem.id}
            {@const catMeta = GEM_CATEGORIES_META[gem.category]}
            <div
              class="gem-card"
              class:selected={isSelected}
              role="button"
              tabindex="0"
              onclick={() => (selectedGem = gem)}
              onkeydown={(e) => e.key === 'Enter' && (selectedGem = gem)}
            >
              <div class="gem-thumb">
                <GemIllustration
                  {gem}
                  size="sm"
                  showPlateDetails={false}
                  class="thumb-fill"
                />
              </div>

              <div class="gem-info">
                <div class="gem-info-top">
                  <div>
                    <h4 class="gem-name">{gem.name}</h4>
                    <div class="gem-meta">
                      {catMeta?.label ?? gem.category} · Dureté Mohs {gem.hardnessMohs}/10 · Taille {gem.cutType}
                    </div>
                  </div>
                  <div class="gem-price">
                    <span class="price-main">{gem.basePriceCut} PO (taillée)</span>
                    <div class="price-sub">{gem.basePriceRaw} PO brut / UG</div>
                  </div>
                </div>

                <p class="gem-desc">{gem.description}</p>

                <div class="gem-enchant">
                  <span>✨</span>
                  <span class="truncate"><strong>Sertissage :</strong> {gem.enchantmentEffect}</span>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Right Column: Gem Details & Tools -->
      <div class="col-right">
        <!-- Selected Gem Inspection Card -->
        <div class="plate-card">
          <div class="plate-card-header">
            <span class="plate-card-label">Planche Gemmologique</span>
            <h3 class="plate-card-name">{selectedGem.name}</h3>
            <span class="plate-card-sub">
              {GEM_CATEGORIES_META[selectedGem.category]?.label ?? selectedGem.category} · Échelle de Mohs {selectedGem.hardnessMohs}/10
            </span>
          </div>

          <div class="plate-illustration">
            <GemIllustration
              gem={selectedGem}
              size="md"
              showPlateDetails={true}
              class="plate-illustration-inner"
            />
          </div>

          <div class="plate-body">
            <p class="plate-desc">{selectedGem.description}</p>

            <!-- In-Game Enchantment Effects -->
            <div class="enchant-box">
              <div class="enchant-title">
                <span>✨</span>
                Propriétés d'Enchantement & Sertissage
              </div>
              <p class="enchant-text">{selectedGem.enchantmentEffect}</p>
              <div class="enchant-affinity">
                Affinité arcanique : {selectedGem.magicalAffinity}
              </div>
            </div>

            <!-- Naheulbeuk Humor & Lore -->
            <div class="naheul-lore">{selectedGem.naheulbeukLore}</div>
          </div>

          <!-- Price Table for this stone -->
          <div class="price-grid">
            <div class="price-cell">
              <span class="price-cell-label">Pierre Brute (1 UG)</span>
              <span class="price-cell-value raw">{selectedGem.basePriceRaw} PO</span>
            </div>
            <div class="price-cell">
              <span class="price-cell-label">Pierre Taillée (1 UG)</span>
              <span class="price-cell-value cut">{selectedGem.basePriceCut} PO</span>
            </div>
          </div>

          <!-- Actions: Cut in workshop or Generate Handout -->
          <div class="plate-action-row">
            <button
              type="button"
              class="cut-action-btn"
              onclick={() => (activeSection = 'taille')}
            >
              <span>⚙️</span>
              <span>Tailler à l'Atelier</span>
            </button>

            <button
              type="button"
              class="handout-action-btn"
              onclick={() => (herboristeStore.handoutItem = { type: 'gem', item: selectedGem })}
              title="Générer un Handout / Indice Joueur parcheminé"
            >
              <span>📜</span>
              <span>Handout Joueur</span>
            </button>
          </div>
        </div>

        <!-- Jewelry Value Calculator -->
        <div class="tool-card">
          <h4 class="tool-title">
            <span>🧮</span>
            Calculateur d'Évaluation Naine (Goltors)
          </h4>

          <div class="tool-body">
            <div class="tool-row">
              <span>Poids en Unités Goltors (UG) :</span>
              <div class="tool-row-ctl">
                <input
                  type="number"
                  min="0.5"
                  max="20"
                  step="0.5"
                  bind:value={calcWeight}
                  class="num-input"
                />
                <span>UG</span>
              </div>
            </div>

            <div class="tool-row">
              <span>État de la gemme :</span>
              <div class="tool-row-ctl">
                <button
                  class:active={!calcIsCut}
                  class="state-btn"
                  onclick={() => (calcIsCut = false)}
                >
                  Brute
                </button>
                <button
                  class:active={calcIsCut}
                  class="state-btn"
                  onclick={() => (calcIsCut = true)}
                >
                  Taillée (+150%)
                </button>
              </div>
            </div>

            <div class="tool-row">
              <span>Pureté de la pierre :</span>
              <select bind:value={calcPurity} class="select-input">
                <option value={1.5}>Parfaite (+50%)</option>
                <option value={1.0}>Standard (x1.0)</option>
                <option value={0.75}>Avec inclusions (-25%)</option>
              </select>
            </div>

            <div class="result-box">
              <div>
                <span class="result-label">Valeur Marchande Estimée</span>
                <span class="result-value">{calculatedPricePo} Pièces d'Or</span>
              </div>
              <div class="result-side">
                soit {calculatedPricePo * 10} PA
              </div>
            </div>
          </div>
        </div>

        <!-- Random Loot Generator -->
        <div class="tool-card">
          <div class="tool-header-row">
            <h4 class="tool-title">
              <span>🎲</span>
              Tirage Aléatoire de Coffre (1 à {GEMS_LIST.length})
            </h4>
            <div class="dice-mode">
              <button
                type="button"
                class:active={lootDiceMode === 'virtual'}
                class="mode-btn"
                onclick={() => (lootDiceMode = 'virtual')}
              >
                Dé Virtuel
              </button>
              <button
                type="button"
                class:active={lootDiceMode === 'manual'}
                class="mode-btn"
                onclick={() => (lootDiceMode = 'manual')}
              >
                Jet Manuel
              </button>
            </div>
          </div>

          {#if lootDiceMode === 'manual'}
            <div class="tool-body">
              <div class="tool-row">
                <label class="lbl" for="manual-loot-d20">Votre dé physique (1 à {GEMS_LIST.length}) :</label>
                <input
                  id="manual-loot-d20"
                  type="number"
                  min="1"
                  max={GEMS_LIST.length}
                  bind:value={manualLootD20}
                  class="num-input gold"
                />
              </div>
              <button class="action-btn" onclick={() => handleRollLoot(manualLootD20)}>
                <span>Valider mon jet ({manualLootD20})</span>
              </button>
            </div>
          {:else}
            <button class="action-btn" onclick={() => handleRollLoot()}>
              <span>🎲</span>
              <span>Tirer une gemme aléatoire dans le trésor</span>
            </button>
          {/if}

          {#if lastLoot}
            <div class="loot-result">
              <div class="loot-top">
                <span class="loot-name">Tirage ({lastLoot.d20}) : {lastLoot.gem.name}</span>
                <span class="loot-value">{lastLoot.finalValuePo} PO</span>
              </div>
              <div class="loot-details">
                Poids : <strong>{lastLoot.weight} UG</strong> · État : <strong>{lastLoot.isCut ? 'Taillée' : 'Brute'}</strong> · {lastLoot.purity}
              </div>
              <p class="loot-enchant">
                Sertissage : {lastLoot.gem.enchantmentEffect}
              </p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {:else if activeSection === 'taille'}
    <!-- Gem Cutting Workshop View -->
    <GemCuttingWorkshopView onSelectGem={handleSelectFromSubView} />
  {:else}
    <!-- Prospecting Simulator View -->
    <GemProspectingView onSelectGem={handleSelectFromSubView} />
  {/if}
</div>

<style>
  .page {
    max-width: 80rem;
    margin: 0 auto;
    padding: 2rem 1rem;
    font-family: Georgia, 'Times New Roman', serif;
  }
  @media (min-width: 640px) {
    .page { padding: 2rem 1.5rem; }
  }

  .title-block { margin-bottom: 1.5rem; }

  .title-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

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

  .main-title {
    font-size: 1.875rem;
    font-weight: bold;
    color: #d4af37;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
  }

  .icon { font-size: 2rem; }
  .icon-lg { font-size: 1.5rem; flex-shrink: 0; margin-top: 0.125rem; }

  .subtitle {
    font-size: 14px;
    color: #c4b5a5;
    font-style: italic;
    margin: 0.25rem 0 0;
  }

  /* Sub-navigation */
  .lapidaire-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid #4a392d;
    padding-bottom: 0.75rem;
  }

  .lap-tab {
    background: #181310;
    border: 1px solid #4a392d;
    color: #c4b5a5;
    padding: 0.5rem 1rem;
    border-radius: 0.4rem;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 0.85rem;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.15s ease;
  }
  .lap-tab:hover {
    background: #2a1f18;
    color: #fef08a;
  }
  .lap-tab.active {
    background: #d4af37;
    color: #181310;
    border-color: #d4af37;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  }

  .pill-craft {
    background: #7c2d12;
    color: #ffedd5;
    font-size: 0.65rem;
    font-weight: 800;
    padding: 0.1rem 0.35rem;
    border-radius: 0.2rem;
    letter-spacing: 0.05em;
  }

  .new-pill {
    background: #15803d;
    color: #f0fdf4;
    font-size: 0.65rem;
    font-weight: 800;
    padding: 0.1rem 0.35rem;
    border-radius: 0.2rem;
    letter-spacing: 0.05em;
  }

  .lore-box {
    background: #241c16;
    border-radius: 0.75rem;
    border: 1px solid #4d3a2e;
    padding: 1rem;
    margin-bottom: 2rem;
    font-size: 12px;
    color: #d7c9b8;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
  }
  @media (min-width: 640px) {
    .lore-box { padding: 1.25rem; }
  }

  .lore-inner { display: flex; align-items: flex-start; gap: 0.75rem; }
  .lore-text { display: flex; flex-direction: column; gap: 0.25rem; }
  .lore-title { font-weight: bold; font-size: 14px; color: #fef08a; margin: 0; }
  .lore-desc { color: #c4b5a5; line-height: 1.625; margin: 0; }

  .layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  @media (min-width: 1024px) {
    .layout { grid-template-columns: repeat(12, 1fr); }
    .col-left { grid-column: span 7; }
    .col-right { grid-column: span 5; }
  }

  .col-left { display: flex; flex-direction: column; gap: 1rem; }
  .col-right { display: flex; flex-direction: column; gap: 1.5rem; }

  .filter-box {
    background: #241c16;
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid #4a392d;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .search-wrap { position: relative; }

  .search-input {
    width: 100%;
    background: #181310;
    border: 1px solid #59473b;
    border-radius: 0.375rem;
    padding: 0.375rem 0.75rem 0.375rem 2.25rem;
    font-size: 12px;
    color: #f5ecd7;
    box-sizing: border-box;
  }
  .search-input::placeholder { color: #7a6b5c; }
  .search-input:focus { outline: none; border-color: #d4af37; }

  .search-icon {
    position: absolute;
    left: 0.75rem;
    top: 0.5rem;
    font-size: 0.9rem;
  }

  .cat-pills { display: flex; gap: 0.375rem; flex-wrap: wrap; }

  .cat-pill {
    padding: 0.25rem 0.625rem;
    border-radius: 0.25rem;
    font-size: 11px;
    font-family: Georgia, 'Times New Roman', serif;
    text-transform: capitalize;
    cursor: pointer;
    background: #181310;
    color: #d7c9b8;
    border: 1px solid #524136;
    transition: var(--transition-fast, 0.15s);
  }
  .cat-pill:hover { background: #382b22; }
  .cat-pill.active {
    background: #d4af37;
    color: #1c140d;
    font-weight: bold;
    border-color: #d4af37;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .gem-list { display: flex; flex-direction: column; gap: 0.75rem; }

  .gem-card {
    padding: 0.875rem;
    border-radius: 0.75rem;
    border: 2px solid #4a3a2e;
    cursor: pointer;
    display: flex;
    gap: 1rem;
    align-items: center;
    background: #241c16;
    color: #e6d8c3;
    transition: var(--transition-fast, 0.15s);
  }
  .gem-card:hover { border-color: #854d0e; }
  .gem-card.selected {
    background: #3b271b;
    border-color: #d4af37;
    color: #ffffff;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
  }

  .gem-thumb { width: 4rem; height: 5rem; flex-shrink: 0; }
  .gem-thumb :global(.thumb-fill) { width: 100%; height: 100%; }

  .gem-info {
    flex: 1;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  .gem-info-top { display: flex; justify-content: space-between; align-items: flex-start; }

  .gem-name { font-weight: bold; font-size: 14px; color: #fef08a; margin: 0; }
  .gem-meta { font-size: 10px; color: #a89988; }

  .gem-price { text-align: right; }
  .price-main {
    font-family: ui-monospace, 'Courier New', monospace;
    font-weight: bold;
    font-size: 12px;
    color: #fde047;
  }
  .price-sub { font-size: 10px; color: #a89988; }

  .gem-desc {
    font-size: 11px;
    color: #d7c9b8;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gem-enchant {
    font-size: 10px;
    color: #38bdf8;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .plate-card {
    background: #f7f2e7;
    color: #2c1810;
    border-radius: 0.75rem;
    border: 4px solid #5c3e29;
    padding: 1.25rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  }

  .plate-card-header {
    text-align: center;
    border-bottom: 2px solid rgba(133, 77, 14, 0.3);
    padding-bottom: 0.75rem;
    margin-bottom: 1rem;
  }

  .plate-card-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #854d0e;
    font-weight: bold;
  }

  .plate-card-name {
    font-size: 1.5rem;
    font-weight: bold;
    color: #3a1d0f;
    margin: 0.25rem 0;
  }

  .plate-card-sub { font-size: 12px; font-style: italic; color: #78350f; }

  .plate-illustration { display: flex; justify-content: center; margin-bottom: 1rem; }
  .plate-illustration :global(.plate-illustration-inner) {
    width: 11rem;
    height: 13rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
  }

  .plate-body { display: flex; flex-direction: column; gap: 0.75rem; font-size: 12px; }

  .plate-desc { color: #3b271d; line-height: 1.625; margin: 0; }

  .enchant-box {
    background: #f0e7d3;
    padding: 0.625rem;
    border-radius: 0.25rem;
    border: 1px solid #cfbca2;
  }

  .enchant-title {
    font-weight: bold;
    color: #451a03;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-bottom: 0.25rem;
  }

  .enchant-text { color: #2b1810; font-size: 11px; margin: 0; }

  .enchant-affinity {
    font-size: 10px;
    color: #78350f;
    font-style: italic;
    margin-top: 0.25rem;
  }

  .naheul-lore {
    background: #faf6ee;
    padding: 0.625rem;
    border-radius: 0.25rem;
    border-left: 4px solid #854d0e;
    font-size: 11px;
    font-style: italic;
    color: #5c3e29;
  }

  .price-grid {
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid #c4a47c;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    text-align: center;
    font-size: 12px;
  }

  .price-cell {
    background: #efe8d8;
    padding: 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid #dfd0bd;
  }

  .price-cell-label {
    font-size: 10px;
    color: #78350f;
    text-transform: uppercase;
    display: block;
  }

  .price-cell-value {
    font-family: ui-monospace, 'Courier New', monospace;
    font-weight: bold;
    font-size: 14px;
  }
  .price-cell-value.raw { color: #854d0e; }
  .price-cell-value.cut { color: #b45309; }

  .plate-action-row {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .cut-action-btn {
    flex: 1;
    margin-top: 0;
    padding: 0.6rem;
    background: linear-gradient(135deg, #d4af37, #92400e);
    color: #181310;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: bold;
    font-size: 11px;
    border: none;
    border-radius: 0.35rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: transform 0.1s ease, filter 0.15s ease;
  }
  .cut-action-btn:hover {
    filter: brightness(1.15);
    transform: translateY(-1px);
  }

  .handout-action-btn {
    flex: 1;
    padding: 0.6rem;
    background: #3a2b20;
    color: #f7eed7;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: bold;
    font-size: 11px;
    border: 1px solid #73533b;
    border-radius: 0.35rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .handout-action-btn:hover {
    background: #4d392a;
    border-color: #d4af37;
  }

  .tool-card {
    background: #241c16;
    border-radius: 0.75rem;
    border: 1px solid #4d3a2e;
    padding: 1.25rem;
    font-size: 12px;
    color: #e6d8c3;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .tool-title {
    font-weight: bold;
    font-size: 14px;
    color: #fef08a;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .tool-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #3e2e23;
    padding-bottom: 0.5rem;
  }

  .tool-body { display: flex; flex-direction: column; gap: 0.75rem; }

  .tool-row { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
  .tool-row-ctl { display: flex; align-items: center; gap: 0.5rem; }

  .num-input {
    width: 4rem;
    background: #181310;
    border: 1px solid #59473b;
    border-radius: 0.25rem;
    padding: 0.25rem 0.5rem;
    text-align: center;
    font-family: ui-monospace, 'Courier New', monospace;
    font-weight: bold;
    color: #fde047;
  }
  .num-input.gold { border-color: #d4af37; background: #120e0b; }
  .num-input:focus { outline: none; }

  .state-btn {
    padding: 0.25rem 0.625rem;
    border-radius: 0.25rem;
    border: 1px solid #3e2e23;
    font-size: 11px;
    cursor: pointer;
    background: #181310;
    color: #e6d8c3;
    font-family: Georgia, 'Times New Roman', serif;
    transition: var(--transition-fast, 0.15s);
  }
  .state-btn.active {
    background: #854d0e;
    color: #ffffff;
    font-weight: bold;
    border-color: #854d0e;
  }

  .select-input {
    background: #181310;
    border: 1px solid #59473b;
    border-radius: 0.25rem;
    padding: 0.25rem 0.5rem;
    color: #fde047;
    font-size: 11px;
    font-family: Georgia, 'Times New Roman', serif;
  }
  .select-input:focus { outline: none; }

  .result-box {
    margin-top: 0.75rem;
    background: #181310;
    border-radius: 0.5rem;
    padding: 0.75rem;
    border: 1px solid #3e2e23;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .result-label { font-size: 10px; color: #a89988; text-transform: uppercase; display: block; }
  .result-value {
    font-family: ui-monospace, 'Courier New', monospace;
    font-weight: bold;
    font-size: 1.125rem;
    color: #fde047;
  }
  .result-side { font-size: 10px; color: #a89988; }

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

  .lbl { font-size: 11px; color: #a89988; }

  .action-btn {
    width: 100%;
    padding: 0.5rem;
    background: #b45309;
    color: #ffffff;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: bold;
    font-size: 12px;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: var(--transition-fast, 0.15s);
  }
  .action-btn:hover { background: #d97706; }

  .loot-result {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: #181310;
    border-radius: 0.5rem;
    border: 1px solid rgba(212, 175, 55, 0.6);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    animation: fade-in 0.3s ease;
  }

  .loot-top { display: flex; justify-content: space-between; align-items: center; }
  .loot-name { font-weight: bold; color: #fef08a; }
  .loot-value {
    font-family: ui-monospace, 'Courier New', monospace;
    color: #fde047;
    font-weight: bold;
  }

  .loot-details { font-size: 11px; color: #a89988; }

  .loot-enchant { font-size: 10px; color: #38bdf8; padding-top: 0.25rem; margin: 0; }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
