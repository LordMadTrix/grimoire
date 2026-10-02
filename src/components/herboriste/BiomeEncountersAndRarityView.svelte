<script lang="ts">
  import type { BiomeType, Plant } from '$lib/herboriste/types/herb';
  import { BIOMES_METADATA } from '$lib/herboriste/data/herbalistData';
  import {
    BIOME_RARITY_TABLES,
    FORAGING_ENCOUNTERS_DATA,
    type ForagingEncounter,
  } from '$lib/herboriste/data/foragingEncountersData';

  let {
    plants,
    onSelectPlant,
  }: {
    plants: Plant[];
    onSelectPlant?: (plant: Plant) => void;
  } = $props();

  const BIOME_ICONS: Record<BiomeType, string> = {
    foret: '🌲',
    plaine: '☀️',
    marais: '💧',
    montagne: '⛰️',
    caverne: '🌑',
    desert: '🔥',
    aquatique: '🌊',
  };

  let activeBiome = $state<BiomeType>('foret');

  // Encounter generator state
  let diceMode = $state<'virtual' | 'manual'>('virtual');
  let manualD20 = $state<number>(10);
  let currentEncounter = $state<ForagingEncounter | null>(
    FORAGING_ENCOUNTERS_DATA['foret'][0] || null
  );
  let isRolling = $state<boolean>(false);
  let encounterHistory = $state<ForagingEncounter[]>([]);

  // Roll an encounter for current biome
  function handleRollEncounter(customD20?: number) {
    isRolling = true;

    setTimeout(() => {
      const d20 = customD20 !== undefined
        ? Math.min(20, Math.max(1, customD20))
        : (diceMode === 'manual' ? Math.min(20, Math.max(1, manualD20)) : Math.floor(Math.random() * 20) + 1);

      const encounters = FORAGING_ENCOUNTERS_DATA[activeBiome] || FORAGING_ENCOUNTERS_DATA.foret;

      // Match encounter by range
      let found = encounters.find(enc => d20 >= enc.rollMin && d20 <= enc.rollMax);
      if (!found) found = encounters[0];

      currentEncounter = found;
      encounterHistory = [found, ...encounterHistory.slice(0, 4)];
      isRolling = false;
    }, 280);
  }

  const rarityTiers = $derived(BIOME_RARITY_TABLES[activeBiome] || BIOME_RARITY_TABLES.foret);
  const biomeMeta = $derived(BIOMES_METADATA[activeBiome]);

  function matchingPlantsForTier(rarityName: string): Plant[] {
    const rarityKey = rarityName.toLowerCase().replace(' ', '_');
    return plants.filter(
      p => p.biome === activeBiome && (
        p.rarity.toLowerCase() === rarityKey ||
        (rarityName === 'Peu Commune' && p.rarity === 'peu_commune') ||
        (rarityName === 'Très Rare' && p.rarity === 'tres_rare')
      )
    );
  }
</script>

<div class="view-root">
  <!-- Header Banner -->
  <div class="banner">
    <div class="banner-row">
      <div>
        <div class="banner-badges">
          <span class="badge">
            <span>🎲</span>
            Générateur Aléatoire de Péripéties & Écologie
          </span>
        </div>
        <h3 class="banner-title">
          Rencontres de Récolte & Tables de Rareté
        </h3>
        <p class="banner-desc">
          Consultez la distribution des raretés d100 pour chaque biome et simulez les rencontres aléatoires survenant lors d'une expédition de cueillette de 4 heures.
        </p>
      </div>

      <div class="banner-biome">
        <span class="banner-biome-label">Biome actif :</span>
        <strong class="banner-biome-name">
          <span>{BIOME_ICONS[activeBiome]}</span>
          {biomeMeta.label}
        </strong>
      </div>
    </div>

    <!-- Biome selector bar -->
    <div class="biome-bar">
      {#each Object.keys(BIOMES_METADATA) as biomeKey (biomeKey)}
        {@const meta = BIOMES_METADATA[biomeKey as BiomeType]}
        <button
          class="biome-btn"
          class:selected={activeBiome === biomeKey}
          onclick={() => {
            activeBiome = biomeKey as BiomeType;
            const firstEnc = FORAGING_ENCOUNTERS_DATA[biomeKey as BiomeType]?.[0] || null;
            currentEncounter = firstEnc;
          }}
        >
          <span>{BIOME_ICONS[biomeKey as BiomeType]}</span>
          <span>{meta.label.split(' ')[0]}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Main Grid: Left Rarity Table, Right Encounter Generator -->
  <div class="main-grid">

    <!-- LEFT COLUMN: BIOME COMPONENT RARITY TABLE (d100) -->
    <div>
      <div class="panel">
        <div class="panel-header">
          <h4 class="panel-title">
            <span>🗂️</span>
            Table de Rareté des Composants · {biomeMeta.label}
          </h4>
          <p class="panel-subtitle">
            Distribution d100 des chances de trouver chaque palier botanique lors d'une fouille.
          </p>
        </div>

        <!-- Tiers List -->
        <div class="tiers">
          {#each rarityTiers as tier, idx (idx)}
            {@const matchingPlants = matchingPlantsForTier(tier.rarityName)}
            <div class="tier-card">
              <div class="tier-header">
                <div class="tier-left">
                  <span class="tier-range">d100 : {tier.range}</span>
                  <strong class="tier-name" style="color: {tier.rarityColor}">
                    {tier.rarityName}
                  </strong>
                </div>

                <div class="tier-right">
                  <span class="tier-dc">{tier.targetDc}</span>
                  <span class="tier-yield">Rendement : {tier.harvestYield}</span>
                </div>
              </div>

              <p class="tier-desc">{tier.description}</p>

              <div class="tier-components">
                <strong class="tier-components-label">Spécimens types : </strong>
                <span>{tier.typicalComponents.join(', ')}</span>
              </div>

              {#if matchingPlants.length > 0}
                <div class="tier-plants">
                  <span class="tier-plants-label">Dans votre grimoire :</span>
                  {#each matchingPlants as plant (plant.id)}
                    <button
                      type="button"
                      class="plant-chip"
                      onclick={() => onSelectPlant && onSelectPlant(plant)}
                      title="Ouvrir la fiche botanique"
                    >
                      <span>🌿 {plant.name}</span>
                      <span class="chip-link">🔗</span>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- RIGHT COLUMN: FORAGING ENCOUNTERS GENERATOR (d20) -->
    <div>
      <div class="panel">
        <div class="generator-header">
          <div>
            <h4 class="panel-title">
              <span>🎲</span>
              Péripétie de Récolte · Foyer d'Aventure
            </h4>
            <p class="panel-subtitle">
              Tirage sur la table d20 de {biomeMeta.label}
            </p>
          </div>

          <!-- Mode switch -->
          <div class="mode-switch">
            <button
              type="button"
              onclick={() => (diceMode = 'virtual')}
              class="mode-btn"
              class:mode-active={diceMode === 'virtual'}
            >
              Dé Virtuel
            </button>
            <button
              type="button"
              onclick={() => (diceMode = 'manual')}
              class="mode-btn"
              class:mode-active={diceMode === 'manual'}
            >
              Jet Manuel
            </button>
          </div>
        </div>

        <!-- Roll trigger section -->
        <div class="roll-section">
          {#if diceMode === 'manual'}
            <div class="manual-block">
              <div class="manual-row">
                <label class="manual-label" for="enc-manual-d20">Résultat sur votre dé physique (d20) :</label>
                <input
                  id="enc-manual-d20"
                  type="number"
                  min="1"
                  max="20"
                  value={manualD20}
                  onchange={(e) => (manualD20 = parseInt(e.currentTarget.value) || 1)}
                  class="input-number"
                />
              </div>
              <button
                class="btn-roll"
                onclick={() => handleRollEncounter(manualD20)}
                disabled={isRolling}
              >
                <span>✓</span>
                <span>Consulter l'événement pour le résultat {manualD20}</span>
              </button>
            </div>
          {:else}
            <button
              class="btn-roll btn-roll-big"
              onclick={() => handleRollEncounter()}
              disabled={isRolling}
            >
              <span class:spin={isRolling}>🎲</span>
              <span>{isRolling ? 'Exploration du biome...' : `Lancer une Rencontre dans ${biomeMeta.label} (d20)`}</span>
            </button>
          {/if}
        </div>

        <!-- Current Encounter Card -->
        {#if currentEncounter}
          <div class="encounter-card">
            <div class="encounter-header">
              <span class="encounter-tag">
                {currentEncounter.type.toUpperCase().replace('_', ' ')} · d20: {currentEncounter.rollMin}-{currentEncounter.rollMax}
              </span>
              <h5 class="encounter-title">{currentEncounter.title}</h5>
            </div>

            <p class="encounter-desc">{currentEncounter.description}</p>

            <!-- Skill check pill -->
            <div class="check-box">
              <div class="check-row">
                <span class="check-skill">
                  <span>❓</span>
                  Test Conseillé : {currentEncounter.checkRequired.skill}
                </span>
                <span class="check-dc">DD {currentEncounter.checkRequired.dc}</span>
              </div>
              <div class="check-action">
                Action : {currentEncounter.checkRequired.actionLabel}
              </div>
            </div>

            <!-- Outcomes -->
            <div class="outcomes">
              <div class="outcome outcome-success">
                <span class="outcome-icon success">✓</span>
                <div>
                  <strong class="outcome-label">Réussite du test :</strong>
                  <span>{currentEncounter.successReward}</span>
                </div>
              </div>

              <div class="outcome outcome-fail">
                <span class="outcome-icon fail">✗</span>
                <div>
                  <strong class="outcome-label">Échec du test :</strong>
                  <span>{currentEncounter.failureOutcome}</span>
                </div>
              </div>
            </div>

            <!-- Quote -->
            <p class="encounter-quote">{currentEncounter.flavorQuote}</p>
          </div>
        {/if}

        <!-- Encounter History -->
        {#if encounterHistory.length > 1}
          <div class="history">
            <span class="history-label">Historique des rencontres récentes :</span>
            <div class="history-list">
              {#each encounterHistory.slice(1, 4) as enc, i (i)}
                <button
                  type="button"
                  class="history-item"
                  onclick={() => (currentEncounter = enc)}
                >
                  <span class="history-title">{enc.title}</span>
                  <span class="history-range">d20:{enc.rollMin}-{enc.rollMax}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .view-root {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    font-family: var(--font-serif, 'EB Garamond', Georgia, serif);
    animation: fade-in 0.3s ease;
  }

  @keyframes fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .banner {
    background: var(--bg-secondary, #1c1410);
    border-radius: 0.75rem;
    border: 1px solid var(--border, #4a3b32);
    padding: 1.5rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
  }

  .banner-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .banner-badges { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
  .badge {
    font-size: 0.625rem;
    padding: 0.125rem 0.625rem;
    border-radius: 0.25rem;
    background: #451a03;
    color: #fcd34d;
    border: 1px solid rgba(217, 119, 6, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.2em;
    font-family: monospace;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .banner-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: #fde047;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    margin: 0;
  }

  .banner-desc {
    font-size: 0.8125rem;
    color: var(--text-secondary, #c4b5a5);
    font-style: italic;
    margin: 0.25rem 0 0;
    max-width: 48rem;
    line-height: 1.625;
  }

  .banner-biome { text-align: left; flex-shrink: 0; }
  @media (min-width: 768px) { .banner-biome { text-align: right; } }
  .banner-biome-label {
    font-size: 0.75rem;
    color: var(--text-muted, #a89988);
    display: block;
  }
  .banner-biome-name {
    font-size: 1rem;
    color: #fef08a;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .biome-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding-top: 1rem;
    margin-top: 1rem;
    border-top: 1px solid #3e2e23;
  }

  .biome-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.75rem;
    font-weight: 700;
    transition: var(--transition-fast, all 0.15s ease);
    background: #120e0b;
    color: var(--text-secondary, #c4b5a5);
    border: 1px solid #3e2e23;
    cursor: pointer;
  }
  .biome-btn:hover { background: #241a14; }
  .biome-btn.selected {
    background: #b45309;
    color: white;
    box-shadow: 0 0 0 2px #fde047;
  }

  .main-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  @media (min-width: 1024px) {
    .main-grid { grid-template-columns: 1fr 1fr; }
  }

  .panel {
    background: var(--bg-secondary, #1c1612);
    padding: 1.25rem;
    border-radius: 0.75rem;
    border: 1px solid var(--border, #4a3b32);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
  }

  .panel-header {
    border-bottom: 1px solid #3e2e23;
    padding-bottom: 0.75rem;
  }
  .panel-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #fde047;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
  }
  .panel-subtitle {
    font-size: 0.75rem;
    color: var(--text-muted, #a89988);
    font-style: italic;
    margin: 0.125rem 0 0;
  }

  .tiers { display: flex; flex-direction: column; gap: 0.75rem; }

  .tier-card {
    padding: 0.875rem;
    border-radius: 0.75rem;
    background: #140f0c;
    border: 1px solid #3e2e23;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    transition: var(--transition-fast, all 0.15s ease);
  }
  .tier-card:hover { border-color: #854d0e; }

  .tier-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid #2e2118;
    padding-bottom: 0.375rem;
  }
  .tier-left { display: flex; align-items: center; gap: 0.5rem; }
  .tier-range {
    font-family: monospace;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: #2b1f14;
    color: #fde047;
    border: 1px solid #524136;
  }
  .tier-name { font-size: 0.875rem; }

  .tier-right { text-align: right; font-family: monospace; font-size: 0.75rem; }
  .tier-dc { color: #fde047; font-weight: 700; display: block; }
  .tier-yield { font-size: 0.625rem; color: var(--text-muted, #a89988); }

  .tier-desc {
    font-size: 0.75rem;
    color: var(--text-secondary, #c4b5a5);
    line-height: 1.625;
    margin: 0;
  }

  .tier-components {
    font-size: 0.6875rem;
    color: var(--text-muted, #a89988);
    padding-top: 0.25rem;
  }
  .tier-components-label { color: #d7c9b8; }

  .tier-plants {
    padding-top: 0.5rem;
    border-top: 1px solid #2e2118;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
  }
  .tier-plants-label {
    font-size: 0.625rem;
    color: var(--text-primary, #e6d8c3);
    font-weight: 700;
  }
  .plant-chip {
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: #241a14;
    border: 1px solid #523d2e;
    font-size: 0.625rem;
    font-weight: 700;
    color: #fef08a;
    transition: var(--transition-fast, all 0.15s ease);
    display: flex;
    align-items: center;
    gap: 0.25rem;
    cursor: pointer;
  }
  .plant-chip:hover { border-color: var(--accent, #d4af37); }
  .chip-link { font-size: 0.625rem; }

  .generator-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #3e2e23;
    padding-bottom: 0.75rem;
  }

  .mode-switch {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: #120e0b;
    padding: 0.125rem;
    border-radius: 0.25rem;
    border: 1px solid #3e2e23;
  }
  .mode-btn {
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.625rem;
    transition: var(--transition-fast, all 0.15s ease);
    color: var(--text-muted, #a89988);
    background: transparent;
    border: none;
    cursor: pointer;
  }
  .mode-btn.mode-active {
    background: #854d0e;
    color: white;
    font-weight: 700;
  }

  .roll-section { display: flex; flex-direction: column; gap: 0.75rem; }

  .manual-block { display: flex; flex-direction: column; gap: 0.5rem; }
  .manual-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
  }
  .manual-label { color: var(--text-muted, #a89988); }

  .input-number {
    width: 4rem;
    padding: 0.25rem 0.5rem;
    background: #120e0b;
    border: 1px solid var(--accent, #d4af37);
    border-radius: 0.25rem;
    text-align: center;
    font-size: 0.875rem;
    font-weight: 700;
    color: #fde047;
    font-family: monospace;
    outline: none;
  }

  .btn-roll {
    width: 100%;
    padding: 0.625rem;
    background: #b45309;
    color: white;
    font-weight: 700;
    font-size: 0.75rem;
    border-radius: 0.5rem;
    border: none;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: var(--transition-fast, all 0.15s ease);
    font-family: inherit;
  }
  .btn-roll:hover { background: #d97706; }
  .btn-roll:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-roll-big { padding: 0.75rem; font-size: 0.875rem; }

  .spin {
    display: inline-block;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .encounter-card {
    background: #241a14;
    border-radius: 0.75rem;
    border: 2px solid rgba(212, 175, 55, 0.8);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
    animation: fade-in 0.3s ease;
  }

  .encounter-header {
    border-bottom: 1px solid #4d3a2e;
    padding-bottom: 0.5rem;
  }
  .encounter-tag {
    font-size: 0.625rem;
    font-family: monospace;
    font-weight: 700;
    text-transform: uppercase;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: #3b271a;
    color: #fcd34d;
    border: 1px solid #854d0e;
  }
  .encounter-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #fef08a;
    margin: 0.375rem 0 0;
  }

  .encounter-desc {
    font-size: 0.8125rem;
    color: var(--text-primary, #e6d8c3);
    line-height: 1.625;
    margin: 0;
  }

  .check-box {
    padding: 0.75rem;
    background: #18120e;
    border-radius: 0.5rem;
    border: 1px solid #3e2e23;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.75rem;
  }
  .check-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 700;
  }
  .check-skill {
    color: #fde047;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  .check-dc {
    font-family: monospace;
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: #2b1f14;
    color: #fde047;
    border: 1px solid #524136;
  }
  .check-action { font-size: 0.6875rem; color: var(--text-muted, #a89988); }

  .outcomes { display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.75rem; }

  .outcome {
    padding: 0.625rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }
  .outcome-success {
    background: rgba(20, 83, 45, 0.3);
    border: 1px solid rgba(34, 197, 94, 0.5);
    color: #86efac;
  }
  .outcome-fail {
    background: rgba(69, 10, 10, 0.4);
    border: 1px solid rgba(239, 68, 68, 0.5);
    color: #fca5a5;
  }
  .outcome-icon { flex-shrink: 0; margin-top: 0.125rem; }
  .outcome-icon.success { color: #22c55e; }
  .outcome-icon.fail { color: #ef4444; }
  .outcome-label { display: block; font-weight: 700; }

  .encounter-quote {
    font-size: 0.6875rem;
    color: var(--text-muted, #a89988);
    font-style: italic;
    padding-top: 0.25rem;
    border-top: 1px solid #3e2e23;
    margin: 0;
  }

  .history {
    padding-top: 0.5rem;
    border-top: 1px solid #3e2e23;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .history-label {
    font-size: 0.625rem;
    color: var(--text-muted, #a89988);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 700;
    display: block;
  }
  .history-list { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.75rem; }

  .history-item {
    padding: 0.5rem;
    border-radius: 0.25rem;
    background: #140f0c;
    border: 1px solid #2e2118;
    color: var(--text-secondary, #c4b5a5);
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: inherit;
    transition: var(--transition-fast, all 0.15s ease);
    text-align: left;
    width: 100%;
  }
  .history-item:hover { border-color: #854d0e; }
  .history-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .history-range {
    font-family: monospace;
    font-size: 0.625rem;
    color: #fde047;
    flex-shrink: 0;
    margin-left: 0.5rem;
  }
</style>
