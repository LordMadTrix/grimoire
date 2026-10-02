<script lang="ts">
  import {
    TRADE_CITIES,
    MERCHANTS_NPC,
    type TradeCity,
    type MerchantNPC
  } from '$lib/herboriste/data/marketData';

  let selectedCity = $state<TradeCity>(TRADE_CITIES[0]);
  let selectedMerchant = $state<MerchantNPC>(MERCHANTS_NPC[0]);

  // Haggling simulator states
  type HagglingTactic = 'flatterie' | 'intimidation' | 'expertise' | 'pot_de_vin';
  let chosenTactic = $state<HagglingTactic>('expertise');
  let charBonus = $state<number>(2);
  let basePrice = $state<number>(100);
  let currentPatience = $state<number>(selectedMerchant.patience);
  let isRolling = $state<boolean>(false);
  let haggleResult = $state<{
    roll: number;
    total: number;
    success: boolean;
    discountPct: number;
    finalPrice: number;
    narrative: string;
  } | null>(null);

  function resetMerchant(m: MerchantNPC) {
    selectedMerchant = m;
    currentPatience = m.patience;
    haggleResult = null;
  }

  function performHaggle() {
    if (currentPatience <= 0) return;
    isRolling = true;
    haggleResult = null;

    setTimeout(() => {
      const roll = Math.floor(Math.random() * 20) + 1;
      let tacticBonus = 0;
      if (chosenTactic === selectedMerchant.preferredTactic) tacticBonus = 4;
      else if (chosenTactic === 'intimidation' && selectedMerchant.race.includes('Nain')) tacticBonus = -4; // Dwarves hate intimidation

      const total = roll + charBonus + tacticBonus;
      const targetDC = selectedMerchant.greedLevel === 'Avare' ? 15 : selectedMerchant.greedLevel === 'Voleur de grand chemin' ? 16 : 13;
      const success = roll === 20 || total >= targetDC;

      let discountPct = 0;
      let narrative = '';

      if (roll === 20) {
        discountPct = 35;
        narrative = `Succès critique magistral ! ${selectedMerchant.name} éclate de rire et vous serre la pince : « Par les dieux, vous êtes un vrai requin ! Affaire conclue à -35% ! »`;
      } else if (roll === 1) {
        discountPct = -15; // Penalty!
        currentPatience = Math.max(0, currentPatience - 2);
        narrative = `Fiasco total ! ${selectedMerchant.name} devient écarlate : « Vous osez m'insulter avec une telle offre ?! Les prix augmentent de +15% ou prenez la porte ! »`;
      } else if (success) {
        discountPct = Math.min(25, 10 + Math.floor((total - targetDC) * 2.5));
        narrative = `${selectedMerchant.name} soupire et recompte ses sous : « Bon, vous savez causer. Je vous accorde -${discountPct}%, mais n'en parlez pas à la guilde. »`;
      } else {
        currentPatience = Math.max(0, currentPatience - 1);
        narrative = `${selectedMerchant.name} secoue fermement la tête : « Hors de question à ce prix-là. Ma patience a des limites (${currentPatience} essai(s) restant(s)). »`;
      }

      const finalPrice = Math.max(1, Math.round(basePrice * (1 - discountPct / 100)));
      haggleResult = { roll, total, success, discountPct, finalPrice, narrative };
      isRolling = false;
    }, 400);
  }
</script>

<div class="market-container">
  <!-- Banner -->
  <div class="banner">
    <div class="banner-title-row">
      <span class="banner-icon">⚖️</span>
      <div>
        <h2 class="banner-title">Bourse Régionale & Comptoir de Marchandage</h2>
        <p class="banner-subtitle">
          Comparez les cours des 5 grands comptoirs de Fangh et affrontez les marchands locaux dans un duel de négociation au dé 20.
        </p>
      </div>
    </div>
  </div>

  <!-- City Hub Selector -->
  <div class="cities-tabs">
    {#each TRADE_CITIES as c (c.id)}
      <button
        type="button"
        class="city-tab"
        class:active={selectedCity.id === c.id}
        onclick={() => (selectedCity = c)}
      >
        <span class="c-ico">{c.icon}</span>
        <div class="c-info">
          <span class="c-name">{c.name}</span>
          <span class="c-reg">{c.region}</span>
        </div>
      </button>
    {/each}
  </div>

  <div class="market-grid">
    <!-- Left Column: Regional Price Multipliers & Rumors -->
    <div class="city-profile-card">
      <div class="city-head">
        <h3 class="city-title">{selectedCity.name}</h3>
        <span class="city-ruler">Gouvernance : {selectedCity.ruler}</span>
      </div>

      <p class="city-profile">{selectedCity.economyProfile}</p>

      <!-- Price Index Grid -->
      <div class="price-index">
        <h4 class="index-title">Indices des Cours Locaux</h4>
        <div class="index-grid">
          <div class="index-cell">
            <span class="idx-label">🌿 Plantes Médicinales</span>
            <span class="idx-val" class:high={selectedCity.priceModifiers.medicinalHerbs > 1} class:low={selectedCity.priceModifiers.medicinalHerbs < 1}>
              x{selectedCity.priceModifiers.medicinalHerbs.toFixed(2)}
            </span>
          </div>
          <div class="index-cell">
            <span class="idx-label">💀 Poisons & Toxines</span>
            <span class="idx-val" class:high={selectedCity.priceModifiers.poisons > 1} class:low={selectedCity.priceModifiers.poisons < 1}>
              x{selectedCity.priceModifiers.poisons.toFixed(2)}
            </span>
          </div>
          <div class="index-cell">
            <span class="idx-label">⛏️ Gemmes Brutes</span>
            <span class="idx-val" class:high={selectedCity.priceModifiers.rawGems > 1} class:low={selectedCity.priceModifiers.rawGems < 1}>
              x{selectedCity.priceModifiers.rawGems.toFixed(2)}
            </span>
          </div>
          <div class="index-cell">
            <span class="idx-label">💎 Gemmes Taillées</span>
            <span class="idx-val" class:high={selectedCity.priceModifiers.cutGems > 1} class:low={selectedCity.priceModifiers.cutGems < 1}>
              x{selectedCity.priceModifiers.cutGems.toFixed(2)}
            </span>
          </div>
          <div class="index-cell">
            <span class="idx-label">❤️ Antidotes & Sérums</span>
            <span class="idx-val" class:high={selectedCity.priceModifiers.antidotes > 1} class:low={selectedCity.priceModifiers.antidotes < 1}>
              x{selectedCity.priceModifiers.antidotes.toFixed(2)}
            </span>
          </div>
          <div class="index-cell">
            <span class="idx-label">⚗️ Potions Magiques</span>
            <span class="idx-val" class:high={selectedCity.priceModifiers.magicPotions > 1} class:low={selectedCity.priceModifiers.magicPotions < 1}>
              x{selectedCity.priceModifiers.magicPotions.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <!-- Local Market Rumors -->
      <div class="market-rumors">
        <span class="rumor-tag">📢 Rumeur de Caravane :</span>
        <p class="rumor-text">{selectedCity.rumors}</p>
      </div>
    </div>

    <!-- Right Column: Haggling Mini-Game -->
    <div class="haggle-card">
      <div class="haggle-header">
        <h3 class="haggle-title">🤝 Mini-Jeu : Négocier au Comptoir</h3>
        <span class="haggle-sub">Faites baisser le prix d'achat ou grimper votre revente</span>
      </div>

      <!-- Merchant Picker -->
      <div class="merchant-picker">
        {#each MERCHANTS_NPC as m (m.id)}
          <button
            type="button"
            class="merchant-btn"
            class:active={selectedMerchant.id === m.id}
            onclick={() => resetMerchant(m)}
          >
            <span class="m-avatar">{m.avatarIcon}</span>
            <div class="m-desc">
              <span class="m-name">{m.name}</span>
              <span class="m-meta">{m.race} · {m.greedLevel}</span>
            </div>
          </button>
        {/each}
      </div>

      <!-- Merchant Details & Patience -->
      <div class="npc-status-box">
        <div class="npc-personality">
          <strong>Personnalité :</strong> {selectedMerchant.personalityLore}
        </div>
        <div class="npc-patience">
          <span>Patience du marchand :</span>
          <div class="patience-dots">
            {#each Array(selectedMerchant.patience) as _, i}
              <span class="dot" class:filled={i < currentPatience}>🪙</span>
            {/each}
          </div>
        </div>
      </div>

      <!-- Configuration: Item Price & Tactics -->
      <div class="haggle-config">
        <div class="cfg-row">
          <label class="cfg-lbl">Prix Initial du Lot (PO) :</label>
          <input
            type="number"
            min="10"
            max="5000"
            step="10"
            bind:value={basePrice}
            class="cfg-input"
          />
        </div>

        <div class="cfg-row">
          <label class="cfg-lbl">Bonus Charisme / Bagout (PJ) :</label>
          <input
            type="number"
            min="-2"
            max="10"
            bind:value={charBonus}
            class="cfg-input"
          />
        </div>

        <div class="tactics-selector">
          <label class="cfg-lbl">Stratégie de Négociation :</label>
          <div class="tactics-chips">
            <button
              type="button"
              class="tactic-btn"
              class:active={chosenTactic === 'flatterie'}
              onclick={() => (chosenTactic = 'flatterie')}
            >
              🗣️ Éloquence & Flatterie
            </button>
            <button
              type="button"
              class="tactic-btn"
              class:active={chosenTactic === 'expertise'}
              onclick={() => (chosenTactic = 'expertise')}
            >
              🔍 Expertise Gemmo/Botanique
            </button>
            <button
              type="button"
              class="tactic-btn"
              class:active={chosenTactic === 'intimidation'}
              onclick={() => (chosenTactic = 'intimidation')}
            >
              💪 Intimidation & Gros Yeux
            </button>
            <button
              type="button"
              class="tactic-btn"
              class:active={chosenTactic === 'pot_de_vin'}
              onclick={() => (chosenTactic = 'pot_de_vin')}
            >
              🍺 Chope de Gnôle / Pot-de-Vin
            </button>
          </div>
        </div>
      </div>

      <!-- Roll Button -->
      <button
        type="button"
        class="btn-roll-haggle"
        onclick={performHaggle}
        disabled={isRolling || currentPatience <= 0}
      >
        {#if currentPatience <= 0}
          <span>⛔ Le marchand refuse de vous parler !</span>
        {:else if isRolling}
          <span>⏳ Discussion animée au comptoir...</span>
        {:else}
          <span>🎲 Lancer la Négociation (d20 + modificateurs)</span>
        {/if}
      </button>

      {#if haggleResult}
        <div
          class="haggle-result-box"
          class:success={haggleResult.success}
          class:failure={!haggleResult.success}
        >
          <div class="res-head">
            <span>Jet de Dé : {haggleResult.roll} (Total: {haggleResult.total})</span>
            <span class="res-price">
              Nouveau Prix : <strong>{haggleResult.finalPrice} PO</strong>
              ({haggleResult.discountPct > 0 ? `-${haggleResult.discountPct}%` : `+${Math.abs(haggleResult.discountPct)}%`})
            </span>
          </div>
          <p class="res-narrative">{haggleResult.narrative}</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .market-container {
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
    background: #1e1913;
    border: 2px solid #ca8a04;
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
    color: #fef08a;
    font-weight: bold;
    letter-spacing: 0.03em;
  }
  .banner-subtitle {
    margin: 0.35rem 0 0 0;
    font-size: 0.85rem;
    color: #fde047;
    line-height: 1.4;
  }

  /* Cities Bar */
  .cities-tabs {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.6rem;
  }
  .city-tab {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    background: #241c16;
    border: 1px solid #4a382c;
    border-radius: 0.5rem;
    padding: 0.6rem 0.8rem;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }
  .city-tab:hover { background: #35261d; border-color: #ca8a04; }
  .city-tab.active {
    background: #47321f;
    border-color: #fef08a;
    box-shadow: 0 2px 8px rgba(254, 240, 138, 0.2);
  }
  .c-ico { font-size: 1.4rem; }
  .c-info { display: flex; flex-direction: column; }
  .c-name { font-size: 0.85rem; font-weight: bold; color: #fef08a; }
  .c-reg { font-size: 0.7rem; color: #bda68e; }

  .market-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  @media (min-width: 900px) {
    .market-grid { grid-template-columns: 1fr 1.25fr; }
  }

  .city-profile-card, .haggle-card {
    background: #241c16;
    border: 1px solid #4d3a2e;
    border-radius: 0.75rem;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
  }

  .city-head {
    border-bottom: 1px solid #4d3a2e;
    padding-bottom: 0.5rem;
  }
  .city-title {
    margin: 0;
    font-size: 1.2rem;
    color: #fef08a;
  }
  .city-ruler {
    font-size: 0.75rem;
    color: #bfa892;
    font-style: italic;
  }
  .city-profile {
    margin: 0;
    font-size: 0.82rem;
    color: #ded0bc;
    line-height: 1.4;
  }

  /* Price Index */
  .index-title {
    margin: 0 0 0.5rem 0;
    font-size: 0.85rem;
    text-transform: uppercase;
    color: #d4af37;
    letter-spacing: 0.05em;
  }
  .index-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
  .index-cell {
    background: #181310;
    border: 1px solid #3c2a1c;
    border-radius: 0.4rem;
    padding: 0.5rem 0.65rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.78rem;
  }
  .idx-label { color: #d1bfa8; }
  .idx-val { font-weight: bold; }
  .idx-val.high { color: #22c55e; }
  .idx-val.low { color: #ef4444; }

  .market-rumors {
    background: #181310;
    border-left: 3px solid #eab308;
    border-radius: 0.35rem;
    padding: 0.65rem 0.85rem;
  }
  .rumor-tag {
    font-size: 0.72rem;
    font-weight: bold;
    color: #fde047;
    text-transform: uppercase;
  }
  .rumor-text {
    margin: 0.25rem 0 0 0;
    font-size: 0.78rem;
    color: #c9b49e;
    font-style: italic;
    line-height: 1.35;
  }

  /* Haggle Card */
  .haggle-title {
    margin: 0;
    font-size: 1.1rem;
    color: #fef08a;
  }
  .haggle-sub { font-size: 0.75rem; color: #ba9e84; }

  .merchant-picker {
    display: flex;
    gap: 0.5rem;
  }
  .merchant-btn {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: #181310;
    border: 1px solid #4a3628;
    border-radius: 0.4rem;
    padding: 0.45rem 0.6rem;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }
  .merchant-btn:hover { background: #322319; border-color: #d4af37; }
  .merchant-btn.active {
    background: #47321f;
    border-color: #fef08a;
  }
  .m-avatar { font-size: 1.2rem; }
  .m-name { font-size: 0.78rem; font-weight: bold; color: #f7eed7; display: block; }
  .m-meta { font-size: 0.68rem; color: #ba9e84; display: block; }

  .npc-status-box {
    background: #181310;
    border: 1px solid #3c2a1c;
    border-radius: 0.4rem;
    padding: 0.65rem 0.85rem;
    font-size: 0.78rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .npc-personality { color: #cfbda9; font-style: italic; }
  .npc-patience { display: flex; align-items: center; justify-content: space-between; color: #d4af37; }
  .patience-dots { display: flex; gap: 0.2rem; }
  .dot { opacity: 0.25; font-size: 0.9rem; }
  .dot.filled { opacity: 1; filter: drop-shadow(0 0 2px #facc15); }

  .haggle-config {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }
  .cfg-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .cfg-lbl { font-size: 0.78rem; color: #cfbda9; }
  .cfg-input {
    width: 80px;
    background: #181310;
    border: 1px solid #5a4230;
    border-radius: 0.35rem;
    color: #fef08a;
    padding: 0.25rem 0.5rem;
    text-align: right;
    font-family: inherit;
    font-size: 0.85rem;
  }

  .tactics-chips {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem;
    margin-top: 0.3rem;
  }
  .tactic-btn {
    background: #181310;
    border: 1px solid #4a3628;
    border-radius: 0.35rem;
    color: #d1bfa8;
    padding: 0.45rem 0.55rem;
    font-size: 0.72rem;
    font-family: inherit;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }
  .tactic-btn:hover { background: #2f2117; }
  .tactic-btn.active {
    background: #503719;
    border-color: #d4af37;
    color: #fef08a;
    font-weight: bold;
  }

  .btn-roll-haggle {
    width: 100%;
    padding: 0.75rem;
    background: linear-gradient(135deg, #d4af37, #92400e);
    color: #181310;
    border: none;
    border-radius: 0.4rem;
    font-weight: bold;
    font-family: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: all 0.15s ease;
  }
  .btn-roll-haggle:hover:not(:disabled) {
    filter: brightness(1.15);
    transform: translateY(-1px);
  }
  .btn-roll-haggle:disabled {
    background: #382c22;
    color: #7a6b5c;
    cursor: not-allowed;
  }

  .haggle-result-box {
    background: #181310;
    border-radius: 0.4rem;
    padding: 0.75rem 0.9rem;
    border-left: 4px solid #ca8a04;
    font-size: 0.8rem;
  }
  .haggle-result-box.success { border-left-color: #22c55e; background: #121f15; }
  .haggle-result-box.failure { border-left-color: #ef4444; background: #241414; }
  .res-head {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.3rem;
  }
  .res-price strong { color: #fef08a; }
  .res-narrative {
    margin: 0;
    color: #ded0bc;
    font-style: italic;
    line-height: 1.35;
  }
</style>
