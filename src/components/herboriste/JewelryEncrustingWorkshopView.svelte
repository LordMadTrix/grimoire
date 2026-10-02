<script lang="ts">
  import { GEMS_LIST } from '$lib/herboriste/data/gemData';
  import { JEWELRY_BASES, JEWELRY_METALS, type JewelryBase, type JewelryMetal } from '$lib/herboriste/data/jewelryData';
  import type { Gem } from '$lib/herboriste/types/gem';
  import GemIllustration from './GemIllustration.svelte';

  let selectedBase = $state<JewelryBase>(JEWELRY_BASES[0]);
  let selectedMetal = $state<JewelryMetal>(JEWELRY_METALS[0]);
  let selectedGem = $state<Gem>(GEMS_LIST[0]);

  // Socketing roll simulator states
  let craftDC = $derived(10 + Math.floor(selectedGem.hardnessMohs * 0.8));
  let toolBonus = $state<number>(3);
  let isCrafting = $state<boolean>(false);
  let craftResult = $state<{
    roll: number;
    total: number;
    success: boolean;
    isCritical: boolean;
    narrative: string;
  } | null>(null);

  let copyFeedback = $state<string | null>(null);

  // Dynamic Item Title
  const artifactName = $derived.by(() => {
    const metalName = selectedMetal.name.split(' ')[0];
    return `${selectedBase.name} en ${metalName} serti de ${selectedGem.name}`;
  });

  // Estimated Total Price
  const estimatedPrice = $derived.by(() => {
    const baseP = 50;
    const metalP = baseP * selectedMetal.priceMultiplier;
    return Math.round(metalP + selectedGem.basePriceCut * 1.5);
  });

  function performEncrusting() {
    isCrafting = true;
    craftResult = null;

    setTimeout(() => {
      const roll = Math.floor(Math.random() * 20) + 1;
      const total = roll + toolBonus;
      const success = roll === 20 || total >= craftDC;
      const isCritical = roll === 20 || roll === 1;

      let narrative = '';
      if (roll === 20) {
        narrative = 'Chef-d\'œuvre absolu ! Les griffes du chaton fusionnent avec la gemme dans un éclat runique aveuglant.';
      } else if (roll === 1) {
        narrative = 'Aïe ! Le burin a glissé, rayant la table de la gemme et faussant l\'alvéole du bijou.';
      } else if (success) {
        narrative = 'Sertissage impeccable. Le flux d\'enchantement pulse régulièrement à travers le métal noble.';
      } else {
        narrative = 'Échec du sertissage. La gemme a du jeu dans son logis et doit être resserrée avec précaution.';
      }

      craftResult = { roll, total, success, isCritical, narrative };
      isCrafting = false;
    }, 450);
  }

  function copyStatBlock() {
    const text = `### 💍 ${artifactName}
*Objet Merveilleux · Forgé en ${selectedMetal.name}*
- **Base :** ${selectedBase.name} (${selectedBase.baseArmorOrDamage})
- **Gemme enchâssée :** ${selectedGem.name} (Taille ${selectedGem.cutType}, Mohs ${selectedGem.hardnessMohs}/10)
- **Affinité Métallique :** ${selectedMetal.affinityBonus}
- **Pouvoir de Sertissage :** ${selectedGem.enchantmentEffect}
- **Valeur marchande estimée :** ${estimatedPrice} Pièces d'Or
*« ${selectedBase.description} ${selectedGem.naheulbeukLore} »*`;

    navigator.clipboard.writeText(text).then(() => {
      copyFeedback = 'Copié dans le presse-papier !';
      setTimeout(() => (copyFeedback = null), 2500);
    });
  }
</script>

<div class="workshop-container">
  <!-- Banner -->
  <div class="banner">
    <div class="banner-title-row">
      <span class="banner-icon">💍</span>
      <div>
        <h2 class="banner-title">Établi de Joaillerie Runique & Enchâssement</h2>
        <p class="banner-subtitle">
          Fusionnez les métaux nobles de Fangh avec vos gemmes taillées. Créez des bijoux uniques dotés d'enchantements telluriques et exportez leurs fiches pour vos parties de JDR.
        </p>
      </div>
    </div>
  </div>

  <div class="workshop-grid">
    <!-- Left Column: Controls (Support, Métal, Gemme) -->
    <div class="config-panel">
      <!-- 1. Support Type -->
      <div class="section-box">
        <label class="section-label">1. Choisir le Support Forgé</label>
        <div class="chips-grid">
          {#each JEWELRY_BASES as b (b.id)}
            <button
              type="button"
              class="chip-btn"
              class:active={selectedBase.id === b.id}
              onclick={() => (selectedBase = b)}
            >
              <span class="c-ico">{b.icon}</span>
              <span class="c-txt">{b.name}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- 2. Métal d'alliage -->
      <div class="section-box">
        <label class="section-label">2. Choisir le Métal Noble</label>
        <div class="metal-list">
          {#each JEWELRY_METALS as m (m.id)}
            <button
              type="button"
              class="metal-card"
              class:active={selectedMetal.id === m.id}
              onclick={() => (selectedMetal = m)}
              style:--metal-col={m.colorHex}
            >
              <div class="metal-head">
                <span class="color-swatch" style:background={m.colorHex}></span>
                <span class="m-name">{m.name}</span>
                <span class="m-mult">x{m.priceMultiplier} PO</span>
              </div>
              <p class="m-bonus">{m.affinityBonus}</p>
            </button>
          {/each}
        </div>
      </div>

      <!-- 3. Gemme taillée à sertir -->
      <div class="section-box">
        <label class="section-label">3. Choisir la Gemme à Sertir ({GEMS_LIST.length} disponibles)</label>
        <select
          class="gem-select"
          bind:value={selectedGem}
        >
          {#each GEMS_LIST as g (g.id)}
            <option value={g}>
              💎 {g.name} ({g.cutType}) · Mohs {g.hardnessMohs}/10 · {g.basePriceCut} PO
            </option>
          {/each}
        </select>
        <div class="selected-gem-preview">
          <div class="gem-thumb-box">
            <GemIllustration gem={selectedGem} size="sm" showPlateDetails={false} />
          </div>
          <div class="gem-preview-text">
            <strong>Effet arcanique :</strong> {selectedGem.enchantmentEffect}
            <div class="gem-lore-sub">« {selectedGem.naheulbeukLore} »</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Column: Visual Preview, Stat Block & Craft Simulator -->
    <div class="result-panel">
      <!-- Visual Interactive SVG Canvas of the Socketed Artifact -->
      <div class="artifact-canvas" style:--glow-col={selectedMetal.glowHex}>
        <div class="canvas-header">
          <span class="c-badge">Création d'Atelier</span>
          <span class="c-cost">Valeur : ~{estimatedPrice} PO</span>
        </div>

        <div class="svg-stage">
          <svg viewBox="0 0 240 240" class="jewelry-svg">
            <defs>
              <radialGradient id="halo-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color={selectedMetal.colorHex} stop-opacity="0.6" />
                <stop offset="60%" stop-color={selectedMetal.colorHex} stop-opacity="0.15" />
                <stop offset="100%" stop-color="#000000" stop-opacity="0" />
              </radialGradient>
              <linearGradient id="metal-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ffffff" stop-opacity="0.8" />
                <stop offset="25%" stop-color={selectedMetal.colorHex} />
                <stop offset="70%" stop-color="#181310" stop-opacity="0.9" />
                <stop offset="100%" stop-color={selectedMetal.colorHex} />
              </linearGradient>
            </defs>

            <!-- Ambient Glow Aura -->
            <circle cx="120" cy="120" r="100" fill="url(#halo-glow)" />

            <!-- Support Silhouette Depending on Category -->
            {#if selectedBase.category === 'anneau'}
              <!-- Ring Loop -->
              <ellipse cx="120" cy="130" rx="65" ry="55" fill="none" stroke="url(#metal-grad)" stroke-width="22" />
              <ellipse cx="120" cy="130" rx="65" ry="55" fill="none" stroke="#120e0b" stroke-width="4" stroke-opacity="0.4" />
              <!-- Claws & Chatons -->
              <path d="M 100 78 L 120 62 L 140 78 Z" fill="url(#metal-grad)" />
              <circle cx="120" cy="74" r="28" fill="#181310" stroke="url(#metal-grad)" stroke-width="4" />
            {:else if selectedBase.category === 'collier'}
              <!-- Torc Arc -->
              <path d="M 40 80 C 40 180, 200 180, 200 80" fill="none" stroke="url(#metal-grad)" stroke-width="18" stroke-linecap="round" />
              <circle cx="40" cy="80" r="12" fill="url(#metal-grad)" />
              <circle cx="200" cy="80" r="12" fill="url(#metal-grad)" />
              <!-- Center Medallion -->
              <circle cx="120" cy="155" r="32" fill="#181310" stroke="url(#metal-grad)" stroke-width="6" />
            {:else if selectedBase.category === 'dague'}
              <!-- Blade & Guard -->
              <path d="M 120 20 L 132 105 L 120 120 L 108 105 Z" fill="#94a3b8" stroke="#475569" stroke-width="2" />
              <rect x="75" y="115" width="90" height="14" rx="4" fill="url(#metal-grad)" />
              <rect x="112" y="128" width="16" height="60" rx="2" fill="#3e2723" />
              <circle cx="120" cy="198" r="16" fill="url(#metal-grad)" />
            {:else if selectedBase.category === 'diademe'}
              <!-- Diadem Crown Crown Peak -->
              <path d="M 30 140 Q 120 170 210 140 Q 180 80 120 60 Q 60 80 30 140 Z" fill="none" stroke="url(#metal-grad)" stroke-width="14" />
              <circle cx="120" cy="115" r="30" fill="#181310" stroke="url(#metal-grad)" stroke-width="4" />
            {:else}
              <!-- Round Shield -->
              <circle cx="120" cy="120" r="75" fill="#2d1f14" stroke="url(#metal-grad)" stroke-width="14" />
              <circle cx="120" cy="120" r="40" fill="#181310" stroke="url(#metal-grad)" stroke-width="5" />
            {/if}

            <!-- Center Socketed Gem Placeholder -->
            <foreignObject
              x={selectedBase.category === 'collier' ? "95" : selectedBase.category === 'anneau' ? "95" : selectedBase.category === 'dague' ? "95" : "95"}
              y={selectedBase.category === 'collier' ? "130" : selectedBase.category === 'anneau' ? "49" : selectedBase.category === 'dague' ? "173" : selectedBase.category === 'diademe' ? "90" : "95"}
              width="50"
              height="50"
            >
              <div class="mini-gem-embed">
                <GemIllustration gem={selectedGem} size="sm" showPlateDetails={false} />
              </div>
            </foreignObject>
          </svg>
        </div>

        <div class="artifact-info">
          <h3 class="artifact-title">{artifactName}</h3>
          <div class="artifact-tags">
            <span class="tag">{selectedBase.baseArmorOrDamage}</span>
            <span class="tag metal">{selectedMetal.name}</span>
            <span class="tag gem">Taille {selectedGem.cutType}</span>
          </div>
          <p class="artifact-desc">{selectedBase.description}</p>
        </div>
      </div>

      <!-- Stat & Crafting Actions -->
      <div class="craft-action-card">
        <div class="craft-header">
          <div>
            <h4 class="c-title">Test de Sertissage Runique</h4>
            <span class="c-sub">Difficulté de fixation : DD {craftDC} (Mohs {selectedGem.hardnessMohs}/10)</span>
          </div>

          <div class="tool-bonus-picker">
            <span>Bonus d'Outils :</span>
            <input
              type="number"
              min="0"
              max="10"
              bind:value={toolBonus}
              class="bonus-input"
            />
          </div>
        </div>

        <div class="action-buttons-row">
          <button
            type="button"
            class="btn-forge"
            onclick={performEncrusting}
            disabled={isCrafting}
          >
            {#if isCrafting}
              <span>⏳ Sertissage en cours...</span>
            {:else}
              <span>🔨 Tenter le Sertissage (d20 + {toolBonus})</span>
            {/if}
          </button>

          <button
            type="button"
            class="btn-copy"
            onclick={copyStatBlock}
            title="Copier le profil d'objet magique pour VTT / MJ"
          >
            <span>📋</span>
            <span>{copyFeedback ?? 'Copier la Fiche'}</span>
          </button>
        </div>

        {#if craftResult}
          <div
            class="craft-feedback"
            class:success={craftResult.success}
            class:failure={!craftResult.success}
          >
            <div class="feedback-roll">
              Résultat : Jet {craftResult.roll} + {toolBonus} = <strong>{craftResult.total}</strong>
              (DD {craftDC})
              {#if craftResult.isCritical}
                <span class="crit-badge">{craftResult.roll === 20 ? 'CRITIQUE !' : 'FIASCO !'}</span>
              {/if}
            </div>
            <p class="feedback-narrative">{craftResult.narrative}</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .workshop-container {
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
    background: #1e1610;
    border: 2px solid #854d0e;
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
    color: #d1bfa8;
    line-height: 1.4;
  }

  .workshop-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  @media (min-width: 900px) {
    .workshop-grid { grid-template-columns: 1fr 1.2fr; }
  }

  .config-panel {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .section-box {
    background: #241c16;
    border: 1px solid #4a3628;
    border-radius: 0.6rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .section-label {
    font-size: 0.8rem;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #d4af37;
  }

  .chips-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 0.5rem;
  }
  .chip-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.6rem;
    background: #181310;
    border: 1px solid #453224;
    border-radius: 0.4rem;
    color: #e2d2bc;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }
  .chip-btn:hover { background: #322319; border-color: #854d0e; }
  .chip-btn.active {
    background: #503719;
    border-color: #d4af37;
    color: #fef08a;
    font-weight: bold;
  }
  .c-ico { font-size: 1.1rem; }

  .metal-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .metal-card {
    background: #181310;
    border: 1px solid #3c2a1c;
    border-radius: 0.4rem;
    padding: 0.6rem 0.8rem;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .metal-card:hover { border-color: var(--metal-col, #d4af37); background: #261b14; }
  .metal-card.active {
    background: #2a1f18;
    border: 1.5px solid var(--metal-col, #d4af37);
    box-shadow: 0 0 10px rgba(212, 175, 55, 0.2);
  }
  .metal-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .color-swatch {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }
  .m-name {
    font-size: 0.85rem;
    font-weight: bold;
    color: #f3e5ce;
    flex: 1;
  }
  .m-mult {
    font-size: 0.75rem;
    color: #d4af37;
  }
  .m-bonus {
    margin: 0.25rem 0 0 1.25rem;
    font-size: 0.72rem;
    color: #bfa892;
    line-height: 1.3;
  }

  .gem-select {
    width: 100%;
    background: #181310;
    border: 1px solid #5a4230;
    border-radius: 0.4rem;
    color: #fef08a;
    padding: 0.6rem;
    font-size: 0.85rem;
    font-family: inherit;
  }
  .selected-gem-preview {
    display: flex;
    gap: 0.8rem;
    align-items: center;
    background: #181310;
    padding: 0.6rem;
    border-radius: 0.4rem;
    border: 1px dashed #594230;
  }
  .gem-thumb-box {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .gem-preview-text {
    font-size: 0.75rem;
    color: #d5c3aa;
    line-height: 1.3;
  }
  .gem-lore-sub {
    font-style: italic;
    color: #9c8470;
    margin-top: 0.2rem;
  }

  /* Right Panel */
  .result-panel {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .artifact-canvas {
    background: radial-gradient(circle at 50% 40%, #2f2219 0%, #15100c 80%);
    border: 2px solid #634630;
    border-radius: 0.75rem;
    padding: 1.25rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    overflow: hidden;
  }
  .canvas-header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
  }
  .c-badge {
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #d4af37;
    font-weight: bold;
  }
  .c-cost {
    color: #facc15;
    font-weight: bold;
  }

  .svg-stage {
    width: 100%;
    max-width: 260px;
    height: 230px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0.5rem 0;
  }
  .jewelry-svg {
    width: 100%;
    height: 100%;
    filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.6));
  }
  .mini-gem-embed {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 0 8px #ffffff);
  }

  .artifact-info {
    text-align: center;
    margin-top: 0.5rem;
  }
  .artifact-title {
    margin: 0;
    font-size: 1.15rem;
    color: #fef08a;
    font-weight: bold;
  }
  .artifact-tags {
    display: flex;
    gap: 0.4rem;
    justify-content: center;
    flex-wrap: wrap;
    margin: 0.5rem 0;
  }
  .tag {
    font-size: 0.68rem;
    background: #181310;
    border: 1px solid #4a382c;
    border-radius: 0.25rem;
    padding: 0.2rem 0.5rem;
    color: #e2d0b8;
  }
  .tag.metal { border-color: #d4af37; color: #fef08a; }
  .tag.gem { border-color: #38bdf8; color: #bae6fd; }
  .artifact-desc {
    font-size: 0.78rem;
    color: #b5a089;
    max-width: 480px;
    margin: 0 auto;
    line-height: 1.4;
  }

  /* Craft Action Card */
  .craft-action-card {
    background: #241c16;
    border: 1px solid #503928;
    border-radius: 0.6rem;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .craft-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .c-title {
    margin: 0;
    font-size: 0.95rem;
    color: #fef08a;
  }
  .c-sub {
    font-size: 0.75rem;
    color: #ba9e84;
  }
  .tool-bonus-picker {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: #cfbda9;
  }
  .bonus-input {
    width: 46px;
    background: #181310;
    border: 1px solid #594230;
    border-radius: 0.3rem;
    color: #fef08a;
    padding: 0.2rem 0.4rem;
    font-size: 0.85rem;
    text-align: center;
  }

  .action-buttons-row {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .btn-forge {
    flex: 1;
    min-width: 180px;
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
  .btn-forge:hover:not(:disabled) {
    filter: brightness(1.15);
    transform: translateY(-1px);
  }
  .btn-copy {
    padding: 0.75rem 1rem;
    background: #38281d;
    color: #faeed7;
    border: 1px solid #6b4d36;
    border-radius: 0.4rem;
    font-size: 0.82rem;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    transition: all 0.15s ease;
  }
  .btn-copy:hover {
    background: #4d3627;
    border-color: #d4af37;
  }

  .craft-feedback {
    background: #181310;
    border-radius: 0.4rem;
    padding: 0.8rem 1rem;
    border-left: 4px solid #854d0e;
    font-size: 0.8rem;
    line-height: 1.4;
  }
  .craft-feedback.success {
    border-left-color: #22c55e;
    background: #121f15;
  }
  .craft-feedback.failure {
    border-left-color: #ef4444;
    background: #241414;
  }
  .feedback-roll {
    font-size: 0.85rem;
    margin-bottom: 0.25rem;
  }
  .crit-badge {
    margin-left: 0.5rem;
    font-weight: bold;
    padding: 0.1rem 0.4rem;
    border-radius: 0.2rem;
    font-size: 0.7rem;
    background: #d4af37;
    color: #181310;
  }
  .feedback-narrative {
    margin: 0;
    color: #d1bfa8;
    font-style: italic;
  }
</style>
