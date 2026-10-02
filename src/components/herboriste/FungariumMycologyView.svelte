<script lang="ts">
  import { MYSTIC_FUNGI_LIST, type MysticFungus } from '$lib/herboriste/data/fungiData';

  let selectedFungus = $state<MysticFungus>(MYSTIC_FUNGI_LIST[0]);

  // Spore hazard test states
  let conBonus = $state<number>(2);
  let isTestingSpore = $state<boolean>(false);
  let sporeResult = $state<{
    roll: number;
    total: number;
    success: boolean;
    narrative: string;
  } | null>(null);

  // Substrate chamber state
  let chamberSubstrate = $state<'bois_pourri' | 'fumier_chauve_souris' | 'roche_humide' | 'ossements_osseux'>('bois_pourri');
  let chamberHumidity = $state<number>(85);
  let isHarvestReady = $state<boolean>(true);
  let harvestMessage = $state<string | null>(null);

  function testSporeInhalation() {
    isTestingSpore = true;
    sporeResult = null;

    setTimeout(() => {
      const roll = Math.floor(Math.random() * 20) + 1;
      const total = roll + conBonus;
      const success = roll === 20 || total >= selectedFungus.sporeHazardDC;

      let narrative = '';
      if (roll === 20) {
        narrative = `Sauvegarde héroïque (20 naturel) ! Vous expulsez le nuage de spores d'une toux sèche sans la moindre séquelle.`;
      } else if (roll === 1) {
        narrative = `Échec critique immédiat ! Vous inhalez une bouffée massive. ${selectedFungus.sporeSymptomLore}`;
      } else if (success) {
        narrative = `Sauvegarde réussie (${total} vs DD ${selectedFungus.sporeHazardDC}). Les muqueuses piquent légèrement mais l'organisme résiste.`;
      } else {
        narrative = `Sauvegarde ratée (${total} vs DD ${selectedFungus.sporeHazardDC}). Effet indésirable : ${selectedFungus.sporeSymptomLore}`;
      }

      sporeResult = { roll, total, success, narrative };
      isTestingSpore = false;
    }, 350);
  }

  function harvestCulture() {
    harvestMessage = `Récolte effectuée : +3 chapeaux de ${selectedFungus.name} prêts pour vos décoctions !`;
    isHarvestReady = false;
    setTimeout(() => {
      isHarvestReady = true;
      harvestMessage = null;
    }, 4000);
  }
</script>

<div class="fungarium-container">
  <!-- Banner -->
  <div class="banner">
    <div class="banner-title-row">
      <span class="banner-icon">🍄</span>
      <div>
        <h2 class="banner-title">Fongarium Mystique & Mycologie des Grottes</h2>
        <p class="banner-subtitle">
          Explorez les champignons bioluminescents et vénéneux des tréfonds de Fangh, cultivez vos souches sur substrat humide et testez votre résistance aux spores.
        </p>
      </div>
    </div>
  </div>

  <div class="fungi-layout">
    <!-- Left Column: Fungi Catalog -->
    <div class="catalog-panel">
      <h3 class="panel-heading">Spécimens Fongiques Réprouvés</h3>
      <div class="fungi-list">
        {#each MYSTIC_FUNGI_LIST as f (f.id)}
          <button
            type="button"
            class="fungus-card"
            class:active={selectedFungus.id === f.id}
            onclick={() => (selectedFungus = f)}
            style:--glow-col={f.colorHex}
          >
            <div class="f-head">
              <span class="f-ico">{f.icon}</span>
              <div class="f-meta">
                <span class="f-name">{f.name}</span>
                <span class="f-latin">« {f.scientificName} »</span>
              </div>
              {#if f.bioluminescence}
                <span class="bio-badge" title="Bioluminescent">✨ Lueur</span>
              {/if}
            </div>
            <div class="f-bot">
              <span class="tox-pill">{f.toxicityLevel}</span>
              <span class="dc-tag">Spore : DD {f.sporeHazardDC}</span>
            </div>
          </button>
        {/each}
      </div>
    </div>

    <!-- Right Column: Detail, Spore Simulator & Cultivation Chamber -->
    <div class="detail-panel">
      <!-- Detail Card -->
      <div class="fungus-detail-card" style:--f-col={selectedFungus.colorHex}>
        <div class="detail-header">
          <div>
            <h3 class="detail-title">{selectedFungus.name}</h3>
            <span class="detail-sub">{selectedFungus.scientificName} · {selectedFungus.habitat}</span>
          </div>
          <div class="detail-icon" style:background={selectedFungus.colorHex + '22'}>
            <span>{selectedFungus.icon}</span>
          </div>
        </div>

        <p class="detail-desc">{selectedFungus.description}</p>

        <div class="detail-grid">
          <div class="detail-box">
            <span class="d-label">Usage Alchimique :</span>
            <p class="d-val">{selectedFungus.alchemyUse}</p>
          </div>
          <div class="detail-box">
            <span class="d-label">Symptômes d'Inhalation de Spores :</span>
            <p class="d-val warn">{selectedFungus.sporeSymptomLore}</p>
          </div>
        </div>

        <!-- Spore Hazard Test Roll -->
        <div class="spore-test-box">
          <div class="test-head">
            <div>
              <h4 class="test-title">Test d'Inhalation de Spores Souterraines</h4>
              <span class="test-dc">Sauvegarde de Constitution : DD {selectedFungus.sporeHazardDC}</span>
            </div>
            <div class="mod-box">
              <span>Bonus CON :</span>
              <input
                type="number"
                min="-2"
                max="10"
                bind:value={conBonus}
                class="con-input"
              />
            </div>
          </div>

          <button
            type="button"
            class="btn-spore"
            onclick={testSporeInhalation}
            disabled={isTestingSpore}
          >
            {#if isTestingSpore}
              <span>🌫️ Nuage de spores en suspension...</span>
            {:else}
              <span>🎲 Respirer les Spores (d20 + {conBonus})</span>
            {/if}
          </button>

          {#if sporeResult}
            <div
              class="spore-result-box"
              class:success={sporeResult.success}
              class:failure={!sporeResult.success}
            >
              <div class="res-num">
                Jet {sporeResult.roll} + {conBonus} = <strong>{sporeResult.total}</strong>
                (DD {selectedFungus.sporeHazardDC})
              </div>
              <p class="res-narr">{sporeResult.narrative}</p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Substrate Cultivation Chamber -->
      <div class="cultivation-card">
        <h4 class="cult-title">🌱 Chambre de Culture sur Substrat</h4>
        <div class="cult-body">
          <div class="cult-row">
            <label class="c-lbl">Substrat de Culture :</label>
            <select bind:value={chamberSubstrate} class="cult-select">
              <option value="bois_pourri">🪵 Bois Pourri de Chêne Ancien</option>
              <option value="fumier_chauve_souris">🦇 Guano / Fumier de Chauve-Souris des Cavernes</option>
              <option value="roche_humide">🪨 Éboulis de Roche Calcaire Humide</option>
              <option value="ossements_osseux">💀 Poussière d'Ossements Profanés</option>
            </select>
          </div>

          <div class="cult-row">
            <label class="c-lbl">Taux d'Humidité ({chamberHumidity}%) :</label>
            <input
              type="range"
              min="40"
              max="100"
              bind:value={chamberHumidity}
              class="cult-slider"
            />
          </div>

          <div class="cult-actions">
            <button
              type="button"
              class="btn-harvest"
              onclick={harvestCulture}
              disabled={!isHarvestReady}
            >
              {#if isHarvestReady}
                <span>🧺 Récolter la Pousse ({selectedFungus.name})</span>
              {:else}
                <span>⏳ Nouvelle fructification en cours...</span>
              {/if}
            </button>
          </div>

          {#if harvestMessage}
            <div class="harvest-banner">{harvestMessage}</div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .fungarium-container {
    max-width: 82rem;
    margin: 0 auto;
    padding: 1.5rem;
    color: #f7eed7;
    font-family: Georgia, 'Times New Roman', serif;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .banner {
    background: #141f17;
    border: 2px solid #16a34a;
    border-radius: 0.75rem;
    padding: 1.25rem 1.5rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  }
  .banner-title-row {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .banner-icon { font-size: 2.2rem; }
  .banner-title {
    margin: 0;
    font-size: 1.4rem;
    color: #86efac;
    font-weight: bold;
    letter-spacing: 0.03em;
  }
  .banner-subtitle {
    margin: 0.35rem 0 0 0;
    font-size: 0.85rem;
    color: #bbf7d0;
    line-height: 1.4;
  }

  .fungi-layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  @media (min-width: 900px) {
    .fungi-layout { grid-template-columns: 1fr 1.3fr; }
  }

  .catalog-panel, .detail-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .panel-heading {
    margin: 0;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #86efac;
  }

  .fungi-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .fungus-card {
    background: #1a221b;
    border: 1px solid #2f4433;
    border-radius: 0.5rem;
    padding: 0.75rem 0.9rem;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .fungus-card:hover { background: #243527; border-color: #86efac; }
  .fungus-card.active {
    background: #203825;
    border-color: #86efac;
    box-shadow: 0 0 10px rgba(134, 239, 172, 0.2);
  }
  .f-head {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .f-ico { font-size: 1.4rem; }
  .f-meta { flex: 1; }
  .f-name { font-size: 0.88rem; font-weight: bold; color: #f7eed7; display: block; }
  .f-latin { font-size: 0.72rem; color: #94a3b8; font-style: italic; display: block; }
  .bio-badge {
    font-size: 0.68rem;
    background: #0284c7;
    color: #e0f2fe;
    padding: 0.15rem 0.4rem;
    border-radius: 0.25rem;
  }
  .f-bot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.4rem;
    font-size: 0.72rem;
  }
  .tox-pill { color: #facc15; }
  .dc-tag { color: #f87171; }

  /* Right Panel */
  .fungus-detail-card, .cultivation-card {
    background: #18201a;
    border: 1px solid #334a38;
    border-radius: 0.75rem;
    padding: 1.25rem;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #2f4433;
    padding-bottom: 0.5rem;
  }
  .detail-title { margin: 0; font-size: 1.25rem; color: #86efac; }
  .detail-sub { font-size: 0.75rem; color: #94a3b8; font-style: italic; }
  .detail-icon {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.6rem;
  }

  .detail-desc {
    margin: 0;
    font-size: 0.82rem;
    color: #cbd5e1;
    line-height: 1.4;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
  }
  .detail-box {
    background: #121913;
    border: 1px solid #283a2b;
    border-radius: 0.4rem;
    padding: 0.6rem;
    font-size: 0.75rem;
  }
  .d-label { font-weight: bold; color: #86efac; text-transform: uppercase; font-size: 0.68rem; display: block; margin-bottom: 0.2rem; }
  .d-val { margin: 0; color: #cbd5e1; line-height: 1.35; }
  .d-val.warn { color: #fca5a5; font-style: italic; }

  /* Spore Test */
  .spore-test-box {
    background: #121913;
    border: 1px solid #3c2a1c;
    border-radius: 0.45rem;
    padding: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .test-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .test-title { margin: 0; font-size: 0.85rem; color: #fef08a; }
  .test-dc { font-size: 0.72rem; color: #f87171; }
  .mod-box { display: flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; color: #cbd5e1; }
  .con-input {
    width: 44px;
    background: #18201a;
    border: 1px solid #4a3628;
    color: #fef08a;
    padding: 0.15rem 0.35rem;
    border-radius: 0.25rem;
    text-align: center;
  }

  .btn-spore {
    padding: 0.65rem;
    background: linear-gradient(135deg, #16a34a, #15803d);
    color: #f0fdf4;
    border: none;
    border-radius: 0.35rem;
    font-size: 0.82rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .btn-spore:hover:not(:disabled) { filter: brightness(1.15); transform: translateY(-1px); }

  .spore-result-box {
    background: #18201a;
    border-radius: 0.35rem;
    padding: 0.65rem 0.8rem;
    border-left: 3px solid #ca8a04;
    font-size: 0.78rem;
  }
  .spore-result-box.success { border-left-color: #22c55e; background: #0f2415; }
  .spore-result-box.failure { border-left-color: #ef4444; background: #261214; }
  .res-num { margin-bottom: 0.2rem; }
  .res-narr { margin: 0; color: #cbd5e1; font-style: italic; }

  /* Cultivation */
  .cult-title { margin: 0; font-size: 0.95rem; color: #86efac; }
  .cult-body { display: flex; flex-direction: column; gap: 0.6rem; }
  .cult-row { display: flex; justify-content: space-between; align-items: center; }
  .c-lbl { font-size: 0.78rem; color: #cbd5e1; }
  .cult-select {
    background: #121913;
    border: 1px solid #334a38;
    border-radius: 0.3rem;
    color: #86efac;
    padding: 0.35rem 0.5rem;
    font-size: 0.78rem;
    font-family: inherit;
  }
  .cult-slider { width: 140px; }

  .btn-harvest {
    width: 100%;
    padding: 0.65rem;
    background: #274b31;
    color: #dcfce7;
    border: 1px solid #4ade80;
    border-radius: 0.35rem;
    font-size: 0.82rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .btn-harvest:hover:not(:disabled) { background: #356241; }
  .btn-harvest:disabled { opacity: 0.5; cursor: not-allowed; }

  .harvest-banner {
    background: #064e3b;
    border: 1px solid #34d399;
    border-radius: 0.3rem;
    padding: 0.5rem;
    font-size: 0.78rem;
    color: #a7f3d0;
    text-align: center;
  }
</style>
