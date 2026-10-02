<script lang="ts">
  import type {
    Gem,
    GemCut,
    GemCuttingPattern,
    LapidaryWheel,
    LapidaryWheelId,
    GemCuttingRollResult,
  } from '$lib/herboriste/types/gem';
  import {
    GEMS_LIST,
    GEM_CATEGORIES_META,
    CUTTING_PATTERNS,
    LAPIDARY_WHEELS,
  } from '$lib/herboriste/data/gemData';
  import GemIllustration from './GemIllustration.svelte';

  let {
    onSelectGem,
  }: {
    onSelectGem?: (gem: Gem) => void;
  } = $props();

  // State
  let selectedGemId = $state<string>('rubis');
  let selectedPatternId = $state<GemCut>('brillant');
  let selectedWheelId = $state<LapidaryWheelId>('emeri');
  let artisanBonus = $state<number>(4);
  let cuttingWeight = $state<number>(1); // UG
  let diceMode = $state<'virtual' | 'manual'>('virtual');
  let manualD20 = $state<number>(15);

  // Animation & cutting state
  let isCutting = $state<boolean>(false);
  let cuttingStep = $state<'idle' | 'sawing' | 'faceting' | 'polishing'>('idle');
  let lastCutResult = $state<GemCuttingRollResult | null>(null);
  let copyFeedback = $state<string | null>(null);
  let cuttingHistory = $state<Array<{ time: string; text: string; valuePo: number; isMasterpiece: boolean }>>([]);

  const selectedGem = $derived(
    GEMS_LIST.find((g) => g.id === selectedGemId) ?? GEMS_LIST[0]
  );

  const selectedPattern = $derived(
    CUTTING_PATTERNS.find((p) => p.id === selectedPatternId) ?? CUTTING_PATTERNS[0]
  );

  const selectedWheel = $derived(
    LAPIDARY_WHEELS.find((w) => w.id === selectedWheelId) ?? LAPIDARY_WHEELS[0]
  );

  // Difficulty DC = 10 + HardnessMohs + pattern.dcMod
  const calculatedDC = $derived(
    10 + Math.floor(selectedGem.hardnessMohs) + selectedPattern.dcMod
  );

  const totalBonus = $derived(artisanBonus + selectedWheel.bonus);

  // Cut stone preview object
  const previewCutGem = $derived<Gem>({
    ...selectedGem,
    cutType: selectedPattern.id,
  });

  function handleStartCutting(customD20?: number) {
    if (isCutting) return;
    isCutting = true;
    cuttingStep = 'sawing';

    setTimeout(() => {
      cuttingStep = 'faceting';
      setTimeout(() => {
        cuttingStep = 'polishing';
        setTimeout(() => {
          executeCuttingResult(customD20);
        }, 350);
      }, 350);
    }, 350);
  }

  function executeCuttingResult(customD20?: number) {
    let d20: number;
    if (customD20 !== undefined) {
      d20 = Math.min(20, Math.max(1, customD20));
    } else if (diceMode === 'manual') {
      d20 = Math.min(20, Math.max(1, manualD20));
    } else {
      d20 = Math.floor(Math.random() * 20) + 1;
    }

    const total = d20 + totalBonus;
    const dc = calculatedDC;
    const critSuccess = d20 === 20;
    const critFail = d20 === 1;

    let outcome: 'masterpiece' | 'standard' | 'flawed' | 'shattered' = 'standard';
    let finalVal = 0;
    let finalWeight = cuttingWeight;
    let title = '';
    let desc = '';
    let enchantmentBonus: string | undefined = undefined;

    if (critFail || total <= dc - 6) {
      outcome = 'shattered';
      finalWeight = Math.max(0.5, Math.round(cuttingWeight * 0.5 * 10) / 10);
      finalVal = Math.round(selectedGem.basePriceRaw * finalWeight * 0.4);
      title = 'Clivage Catastrophique ! (Fêlure interne)';
      desc = `Une vibration incontrôlée de la meule a suivi un plan de clivage fragile. La gemme s'est fendue en deux (-50% de poids) et présente un voile laiteux.`;
    } else if (total < dc) {
      outcome = 'flawed';
      finalVal = Math.round(selectedGem.basePriceCut * cuttingWeight * 0.75);
      title = 'Taille Imparfaite / Facettes Asymétriques';
      desc = `Les arêtes manquent de régularité et deux facettes sont décentrées. La pierre est vendable mais subit une décote d'orfèvrerie (-25%).`;
    } else if (critSuccess || total >= dc + 5) {
      outcome = 'masterpiece';
      finalVal = Math.round(selectedGem.basePriceCut * cuttingWeight * selectedPattern.valueMultiplier * 1.3);
      title = 'Chef-d\'Œuvre de Haute Joaillerie !';
      desc = `Une perfection géométrique digne des plus grands maîtres lapidaires nains de Waldorg. La réfraction de la lumière est éblouissante !`;
      enchantmentBonus = `Propriété sublimée : +1 dé de bonus ou efficacité amplifiée de 25% lors du sertissage.`;
    } else {
      outcome = 'standard';
      finalVal = Math.round(selectedGem.basePriceCut * cuttingWeight * (selectedPattern.valueMultiplier / 2));
      title = 'Taille Marchande Réussie';
      desc = `Toutes les facettes sont polies avec soin. La pierre atteint sa valeur optimale de revente sur les marchés de Fangh.`;
    }

    lastCutResult = {
      d20,
      artisanBonus,
      wheelBonus: selectedWheel.bonus,
      total,
      dc,
      outcome,
      gem: selectedGem,
      chosenPattern: selectedPattern,
      weightGoltors: finalWeight,
      finalValuePo: finalVal,
      title,
      desc,
      enchantmentBonus,
    };

    const nowStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    cuttingHistory = [
      {
        time: nowStr,
        text: `${selectedGem.name} [${selectedPattern.name}] — ${finalVal} PO (${outcome === 'masterpiece' ? 'Chef-d\'œuvre !' : outcome})`,
        valuePo: finalVal,
        isMasterpiece: outcome === 'masterpiece',
      },
      ...cuttingHistory,
    ];

    isCutting = false;
    cuttingStep = 'idle';
  }

  function copyCutForVtt() {
    if (!lastCutResult) return;
    let md = `**[Atelier Lapidaire - Taille de Gemme]**\n`;
    md += `• **Pierre travaillée :** ${lastCutResult.gem.name} (Dureté Mohs ${lastCutResult.gem.hardnessMohs})\n`;
    md += `• **Patron de taille :** ${lastCutResult.chosenPattern.name} (${lastCutResult.chosenPattern.facetCount} facettes)\n`;
    md += `• **Jet d'Artisanat :** d20 (${lastCutResult.d20}) + ${totalBonus} = **${lastCutResult.total}** (DD ${lastCutResult.dc})\n`;
    md += `• **Résultat :** ${lastCutResult.title}\n`;
    md += `• **Poids final :** ${lastCutResult.weightGoltors} UG · **Valeur :** ${lastCutResult.finalValuePo} PO\n`;
    if (lastCutResult.enchantmentBonus) {
      md += `• **Bonus Magistral :** ${lastCutResult.enchantmentBonus}\n`;
    }

    navigator.clipboard?.writeText(md).then(() => {
      copyFeedback = 'Fiche d\'artisanat copiée !';
      setTimeout(() => (copyFeedback = null), 2500);
    });
  }
</script>

<div class="workshop-wrap">
  <!-- Top Header -->
  <div class="workshop-header">
    <div>
      <div class="header-tag">
        <span class="badge">Artisanat & Joaillerie Fine</span>
        <span class="tag-sub">Corporation des Lapidaires de Waldorg</span>
      </div>
      <h3 class="workshop-title">
        <span>⚙️</span>
        Atelier de Taille de Gemmes & Facettage
      </h3>
      <p class="workshop-desc">
        Choisissez une pierre brute, sélectionnez un patron de facettage et montez le disque abrasif adapté à l'échelle de Mohs pour transformer un caillou brut en un joyau d'apparat étincelant.
      </p>
    </div>
  </div>

  <div class="workshop-layout">
    <!-- Left Configuration Column -->
    <div class="config-col">
      <!-- 1. Gem Selection -->
      <div class="panel">
        <label class="panel-title" for="gem-select">
          <span class="step-num">1</span>
          Sélectionnez la Pierre à Tailler
        </label>

        <div class="gem-picker-row">
          <select id="gem-select" bind:value={selectedGemId} class="gem-select">
            {#each GEMS_LIST as g (g.id)}
              <option value={g.id}>
                {g.name} ({GEM_CATEGORIES_META[g.category]?.label ?? g.category} · Mohs {g.hardnessMohs})
              </option>
            {/each}
          </select>

          <div class="weight-ctl">
            <label for="gem-weight-input" class="lbl-inline">Poids :</label>
            <input
              id="gem-weight-input"
              type="number"
              min="0.5"
              max="10"
              step="0.5"
              bind:value={cuttingWeight}
              class="weight-input"
            />
            <span class="unit">UG</span>
          </div>
        </div>

        <!-- Selected Gem Quick Info -->
        <div class="gem-quick-strip">
          <div class="strip-item">
            <span class="strip-lbl">Dureté Mohs</span>
            <span class="strip-val">{selectedGem.hardnessMohs}/10</span>
          </div>
          <div class="strip-item">
            <span class="strip-lbl">Valeur Brute (1 UG)</span>
            <span class="strip-val">{selectedGem.basePriceRaw} PO</span>
          </div>
          <div class="strip-item">
            <span class="strip-lbl">Affinité</span>
            <span class="strip-val truncate">{selectedGem.magicalAffinity}</span>
          </div>
        </div>
      </div>

      <!-- 2. Pattern Selection -->
      <div class="panel">
        <div class="panel-title">
          <span class="step-num">2</span>
          Choisissez le Patron de Facettage
        </div>

        <div class="patterns-grid">
          {#each CUTTING_PATTERNS as pat (pat.id)}
            <button
              type="button"
              class="pat-card"
              class:selected={selectedPatternId === pat.id}
              onclick={() => (selectedPatternId = pat.id)}
            >
              <div class="pat-head">
                <span class="pat-ico">{pat.icon}</span>
                <span class="pat-name">{pat.name}</span>
                <span class="pat-dc">{pat.dcMod >= 0 ? `+${pat.dcMod}` : pat.dcMod} DD</span>
              </div>
              <p class="pat-desc">{pat.description}</p>
              <div class="pat-meta">
                <span>{pat.facetCount > 0 ? `${pat.facetCount} facettes` : 'Surface polie'}</span>
                <span class="mult-badge">x{pat.valueMultiplier} valeur</span>
              </div>
            </button>
          {/each}
        </div>
      </div>

      <!-- 3. Wheel Selection -->
      <div class="panel">
        <div class="panel-title">
          <span class="step-num">3</span>
          Disque de Lapidage & Meule Abrasive
        </div>

        <div class="wheels-grid">
          {#each LAPIDARY_WHEELS as w (w.id)}
            <button
              type="button"
              class="wheel-card"
              class:selected={selectedWheelId === w.id}
              onclick={() => (selectedWheelId = w.id)}
            >
              <div class="wheel-head">
                <span class="wheel-ico">{w.icon}</span>
                <span class="wheel-name">{w.name}</span>
                <span class="wheel-bonus">+{w.bonus} Jet</span>
              </div>
              <p class="wheel-desc">{w.description}</p>
              <div class="wheel-mohs">{w.suitableMohs}</div>
            </button>
          {/each}
        </div>
      </div>

      <!-- 4. Artisan Competence & Dice Roll -->
      <div class="panel action-panel">
        <div class="panel-title">
          <span class="step-num">4</span>
          Paramètres du Maître Artisan & Lancer
        </div>

        <div class="calc-row">
          <div class="calc-item">
            <label class="calc-lbl" for="artisan-bonus-input">Bonus d'Artisanat / Joaillerie :</label>
            <input
              id="artisan-bonus-input"
              type="number"
              min="0"
              max="15"
              bind:value={artisanBonus}
              class="bonus-input"
            />
          </div>

          <div class="calc-summary">
            <div class="sum-row">
              <span>Seuil de Difficulté :</span>
              <strong class="gold">DD {calculatedDC}</strong>
              <span class="sub-math">(10 + Mohs {selectedGem.hardnessMohs} + Taille {selectedPattern.dcMod >= 0 ? `+${selectedPattern.dcMod}` : selectedPattern.dcMod})</span>
            </div>
            <div class="sum-row">
              <span>Modificateur Total :</span>
              <strong class="gold">+{totalBonus}</strong>
              <span class="sub-math">(Artisan +{artisanBonus} / Meule +{selectedWheel.bonus})</span>
            </div>
          </div>
        </div>

        <div class="dice-mode-toggle">
          <button
            type="button"
            class="mode-btn"
            class:active={diceMode === 'virtual'}
            onclick={() => (diceMode = 'virtual')}
          >
            🎲 Dé Virtuel
          </button>
          <button
            type="button"
            class="mode-btn"
            class:active={diceMode === 'manual'}
            onclick={() => (diceMode = 'manual')}
          >
            ✍️ Dé Physique
          </button>
        </div>

        {#if diceMode === 'manual'}
          <div class="manual-row">
            <label class="manual-lbl" for="manual-cutting-d20">Votre jet physique d20 (1 à 20) :</label>
            <input
              id="manual-cutting-d20"
              type="number"
              min="1"
              max="20"
              bind:value={manualD20}
              class="manual-num"
            />
            <button
              type="button"
              class="cut-btn"
              disabled={isCutting}
              onclick={() => handleStartCutting(manualD20)}
            >
              Valider le Facettage ({manualD20} + {totalBonus} = {manualD20 + totalBonus} vs DD {calculatedDC})
            </button>
          </div>
        {:else}
          <button
            type="button"
            class="cut-btn pulse"
            disabled={isCutting}
            onclick={() => handleStartCutting()}
          >
            <span>⚙️</span>
            <span>
              {#if isCutting}
                {#if cuttingStep === 'sawing'}Ébauche et sciage de la gangue...{/if}
                {#if cuttingStep === 'faceting'}Taille des facettes à la meule...{/if}
                {#if cuttingStep === 'polishing'}Lustrage à l'oxyde de cérium...{/if}
              {:else}
                Tailler la Gemme (d20 + {totalBonus} vs DD {calculatedDC})
              {/if}
            </span>
          </button>
        {/if}
      </div>
    </div>

    <!-- Right Workbench & Results Column -->
    <div class="bench-col">
      <!-- Workbench Preview Visual -->
      <div class="bench-plate-card">
        <div class="bench-plate-header">
          <span class="bench-tag">Établi du Maître Lapidaire</span>
          <h4 class="bench-gem-name">{selectedGem.name}</h4>
          <span class="bench-sub">Taille projetée : {selectedPattern.name}</span>
        </div>

        <div class="bench-preview-wrap">
          <GemIllustration
            gem={previewCutGem}
            size="lg"
            showPlateDetails={true}
            class="bench-illustration"
          />
        </div>

        <div class="bench-specs">
          <div class="bench-spec-box">
            <span class="spec-k">Dureté</span>
            <span class="spec-v">Mohs {selectedGem.hardnessMohs}</span>
          </div>
          <div class="bench-spec-box">
            <span class="spec-k">Poids estimé</span>
            <span class="spec-v">{cuttingWeight} UG</span>
          </div>
          <div class="bench-spec-box">
            <span class="spec-k">Disque actif</span>
            <span class="spec-v">{selectedWheel.name.split(' ')[0]}</span>
          </div>
          <div class="bench-spec-box highlight">
            <span class="spec-k">Valeur potentielle</span>
            <span class="spec-v gold">~{Math.round(selectedGem.basePriceCut * cuttingWeight * (selectedPattern.valueMultiplier / 2))} PO</span>
          </div>
        </div>
      </div>

      <!-- Result Card -->
      {#if lastCutResult}
        <div class="result-banner-card {lastCutResult.outcome}">
          <div class="result-banner-top">
            <div class="result-dice">
              <span>🎲 d20: {lastCutResult.d20}</span>
              <span>+{totalBonus} = <strong>{lastCutResult.total}</strong></span>
            </div>
            <div class="result-dc">
              DD {lastCutResult.dc} ({lastCutResult.outcome.toUpperCase()})
            </div>
          </div>

          <div class="result-body">
            <h4 class="result-title">{lastCutResult.title}</h4>
            <p class="result-desc">{lastCutResult.desc}</p>

            <div class="result-final-val">
              <span class="val-lbl">Valeur Marchande Finale :</span>
              <span class="val-po">{lastCutResult.finalValuePo} Pièces d'Or</span>
              <span class="val-pa">({lastCutResult.finalValuePo * 10} PA)</span>
            </div>

            {#if lastCutResult.enchantmentBonus}
              <div class="masterpiece-alert">
                <span>🌟</span>
                <span><strong>Bonus de Maître :</strong> {lastCutResult.enchantmentBonus}</span>
              </div>
            {/if}

            <div class="result-actions">
              <button type="button" class="btn-copy" onclick={copyCutForVtt}>
                <span>📋</span>
                <span>{copyFeedback ?? 'Copier Fiche d\'Artisanat'}</span>
              </button>
              {#if onSelectGem}
                <button
                  type="button"
                  class="btn-inspect"
                  onclick={() => onSelectGem(selectedGem)}
                >
                  <span>💎</span>
                  <span>Inspecter dans le Catalogue</span>
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      <!-- Cutting Session Log -->
      <div class="history-panel">
        <div class="history-head">
          <span>📜 Registre de l'Établi de la Séance</span>
          {#if cuttingHistory.length > 0}
            <button
              type="button"
              class="btn-clear"
              onclick={() => (cuttingHistory = [])}
            >
              Vider
            </button>
          {/if}
        </div>

        {#if cuttingHistory.length === 0}
          <div class="history-empty">Aucune taille effectuée pour le moment.</div>
        {:else}
          <div class="history-list">
            {#each cuttingHistory as h, idx (idx)}
              <div class="history-item" class:master={h.isMasterpiece}>
                <span class="h-time">{h.time}</span>
                <span class="h-text">{h.text}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .workshop-wrap {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    font-family: Georgia, 'Times New Roman', serif;
    color: #e6d8c3;
  }

  .workshop-header {
    border-bottom: 1px solid #4a392d;
    padding-bottom: 1.25rem;
  }
  .header-tag {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.35rem;
  }
  .badge {
    background: #451a03;
    color: #fcd34d;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.2rem 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid rgba(217, 119, 6, 0.5);
    font-family: ui-monospace, monospace;
  }
  .tag-sub {
    font-size: 0.75rem;
    color: #a89988;
    font-style: italic;
  }

  .workshop-title {
    font-size: 1.6rem;
    font-weight: bold;
    color: #d4af37;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0.25rem 0;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
  }
  .workshop-desc {
    font-size: 0.875rem;
    color: #c4b5a5;
    line-height: 1.5;
    max-width: 48rem;
    margin: 0;
    font-style: italic;
  }

  /* Layout */
  .workshop-layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.75rem;
  }
  @media (min-width: 1024px) {
    .workshop-layout {
      grid-template-columns: 1.2fr 0.8fr;
    }
  }

  .config-col, .bench-col {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .panel {
    background: #241c16;
    border: 1px solid #4a392d;
    border-radius: 0.65rem;
    padding: 1.25rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
  }

  .panel-title {
    font-size: 0.95rem;
    font-weight: bold;
    color: #fef08a;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.875rem;
  }
  .step-num {
    background: #d4af37;
    color: #181310;
    width: 1.4rem;
    height: 1.4rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 800;
  }

  /* Gem picker */
  .gem-picker-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  .gem-select {
    flex: 1;
    min-width: 15rem;
    background: #181310;
    border: 1px solid #59473b;
    border-radius: 0.35rem;
    padding: 0.45rem 0.65rem;
    color: #f5ecd7;
    font-size: 0.8rem;
    font-family: Georgia, 'Times New Roman', serif;
  }
  .gem-select:focus { outline: none; border-color: #d4af37; }

  .weight-ctl {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    background: #181310;
    border: 1px solid #59473b;
    border-radius: 0.35rem;
    padding: 0.25rem 0.5rem;
  }
  .lbl-inline { font-size: 0.75rem; color: #a89988; }
  .weight-input {
    width: 3.5rem;
    background: transparent;
    border: none;
    color: #fde047;
    font-weight: bold;
    font-family: ui-monospace, monospace;
    text-align: center;
  }
  .weight-input:focus { outline: none; }
  .unit { font-size: 0.75rem; color: #a89988; }

  .gem-quick-strip {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    background: #181310;
    border: 1px solid #3e2e23;
    border-radius: 0.35rem;
    padding: 0.5rem 0.75rem;
  }
  .strip-item { display: flex; flex-direction: column; gap: 0.15rem; }
  .strip-lbl { font-size: 0.65rem; text-transform: uppercase; color: #854d0e; font-weight: bold; }
  .strip-val { font-size: 0.8rem; font-weight: bold; color: #fef08a; }
  .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* Patterns grid */
  .patterns-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  @media (min-width: 640px) {
    .patterns-grid { grid-template-columns: repeat(2, 1fr); }
  }

  .pat-card {
    text-align: left;
    background: #181310;
    border: 1px solid #4a392d;
    border-radius: 0.4rem;
    padding: 0.65rem;
    cursor: pointer;
    transition: all 0.15s ease;
    color: #e6d8c3;
  }
  .pat-card:hover { background: #2e231b; border-color: #854d0e; }
  .pat-card.selected {
    background: #3b271b;
    border-color: #d4af37;
    box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.3);
  }
  .pat-head {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-bottom: 0.2rem;
  }
  .pat-ico { font-size: 1.1rem; }
  .pat-name { font-size: 0.8rem; font-weight: bold; color: #fef08a; flex: 1; }
  .pat-dc {
    font-size: 0.68rem;
    font-weight: bold;
    color: #fde047;
    background: #3a2a1d;
    padding: 0.1rem 0.35rem;
    border-radius: 0.2rem;
  }
  .pat-desc { font-size: 0.7rem; color: #a89988; margin: 0 0 0.35rem 0; line-height: 1.25; }
  .pat-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.68rem;
    color: #d7c9b8;
  }
  .mult-badge { color: #86efac; font-weight: bold; }

  /* Wheels */
  .wheels-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  @media (min-width: 640px) {
    .wheels-grid { grid-template-columns: repeat(2, 1fr); }
  }

  .wheel-card {
    text-align: left;
    background: #181310;
    border: 1px solid #4a392d;
    border-radius: 0.4rem;
    padding: 0.65rem;
    cursor: pointer;
    transition: all 0.15s ease;
    color: #e6d8c3;
  }
  .wheel-card:hover { background: #2e231b; }
  .wheel-card.selected {
    background: #1a2e20;
    border-color: #22c55e;
  }
  .wheel-head {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-bottom: 0.2rem;
  }
  .wheel-ico { font-size: 1.1rem; }
  .wheel-name { font-size: 0.8rem; font-weight: bold; color: #fef08a; flex: 1; }
  .wheel-bonus {
    font-size: 0.68rem;
    font-weight: bold;
    color: #4ade80;
    background: #14532d;
    padding: 0.1rem 0.35rem;
    border-radius: 0.2rem;
  }
  .wheel-desc { font-size: 0.7rem; color: #a89988; margin: 0 0 0.25rem 0; line-height: 1.25; }
  .wheel-mohs { font-size: 0.68rem; color: #b5a494; font-style: italic; }

  /* Action panel */
  .calc-row {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 0.85rem;
  }
  @media (min-width: 640px) {
    .calc-row {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
    }
  }

  .calc-item { display: flex; flex-direction: column; gap: 0.25rem; }
  .calc-lbl { font-size: 0.75rem; font-weight: bold; color: #fef08a; }
  .bonus-input {
    width: 5rem;
    padding: 0.4rem;
    border: 1px solid #59473b;
    border-radius: 0.35rem;
    background: #181310;
    color: #fde047;
    font-size: 1rem;
    font-weight: bold;
    text-align: center;
    font-family: ui-monospace, monospace;
  }

  .calc-summary {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    background: #181310;
    padding: 0.5rem 0.75rem;
    border-radius: 0.35rem;
    border: 1px solid #3e2e23;
    font-size: 0.75rem;
  }
  .sum-row { display: flex; align-items: center; gap: 0.35rem; }
  .gold { color: #fde047; font-family: ui-monospace, monospace; }
  .sub-math { color: #854d0e; font-size: 0.7rem; margin-left: 0.25rem; }

  .dice-mode-toggle {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  .mode-btn {
    background: #181310;
    border: 1px solid #4a392d;
    border-radius: 0.35rem;
    padding: 0.35rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    color: #c4b5a5;
  }
  .mode-btn.active {
    background: #d4af37;
    color: #181310;
    font-weight: bold;
    border-color: #d4af37;
  }

  .manual-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .manual-lbl { font-size: 0.8rem; font-weight: bold; color: #fef08a; }
  .manual-num {
    width: 4rem;
    padding: 0.4rem;
    border: 2px solid #d4af37;
    border-radius: 0.35rem;
    font-size: 1rem;
    font-weight: 800;
    text-align: center;
    background: #120e0b;
    color: #fde047;
    font-family: ui-monospace, monospace;
  }

  .cut-btn {
    width: 100%;
    background: linear-gradient(135deg, #d4af37, #92400e);
    color: #181310;
    border: none;
    border-radius: 0.5rem;
    padding: 0.85rem 1.25rem;
    font-size: 1rem;
    font-weight: 900;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    cursor: pointer;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
    transition: transform 0.1s ease, filter 0.15s ease;
  }
  .cut-btn:hover:not(:disabled) {
    filter: brightness(1.15);
    transform: translateY(-1px);
  }
  .cut-btn:disabled { opacity: 0.7; cursor: not-allowed; }

  /* Bench column */
  .bench-plate-card {
    background: #f7f2e7;
    color: #2c1810;
    border: 4px solid #5c3e29;
    border-radius: 0.75rem;
    padding: 1.25rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
    text-align: center;
  }

  .bench-plate-header {
    border-bottom: 2px solid rgba(133, 77, 14, 0.3);
    padding-bottom: 0.5rem;
    margin-bottom: 1rem;
  }
  .bench-tag {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #854d0e;
    font-weight: bold;
  }
  .bench-gem-name {
    font-size: 1.4rem;
    font-weight: bold;
    color: #3a1d0f;
    margin: 0.15rem 0;
  }
  .bench-sub { font-size: 0.75rem; font-style: italic; color: #78350f; }

  .bench-preview-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 1rem;
  }
  .bench-preview-wrap :global(.bench-illustration) {
    width: 12rem;
    height: 14rem;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }

  .bench-specs {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }
  @media (min-width: 480px) {
    .bench-specs { grid-template-columns: repeat(4, 1fr); }
  }
  .bench-spec-box {
    background: #efe8d8;
    border: 1px solid #dfd0bd;
    padding: 0.4rem;
    border-radius: 0.25rem;
  }
  .bench-spec-box.highlight { background: #fef08a; border-color: #ca8a04; }
  .spec-k { display: block; font-size: 0.65rem; text-transform: uppercase; color: #78350f; font-weight: bold; }
  .spec-v { font-size: 0.85rem; font-weight: bold; color: #2c1810; }
  .spec-v.gold { color: #b45309; font-family: ui-monospace, monospace; }

  /* Result Banner */
  .result-banner-card {
    background: #f7f2e7;
    color: #2c1810;
    border: 4px solid #5c3e29;
    border-radius: 0.75rem;
    overflow: hidden;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
    animation: fade-in 0.3s ease;
  }
  .result-banner-card.masterpiece { border-color: #d4af37; }
  .result-banner-card.shattered { border-color: #991b1b; }
  .result-banner-card.flawed { border-color: #d97706; }

  .result-banner-top {
    background: #1f1612;
    color: #fff;
    padding: 0.65rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #5c3e29;
  }
  .result-dice { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; }
  .result-dice strong { color: #fde047; font-size: 1rem; }
  .result-dc {
    font-size: 0.72rem;
    font-weight: bold;
    background: rgba(255, 255, 255, 0.15);
    padding: 0.15rem 0.5rem;
    border-radius: 0.2rem;
    color: #fef08a;
  }

  .result-body { padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
  .result-title { font-size: 1.15rem; font-weight: bold; color: #3a1d0f; margin: 0; }
  .result-desc { font-size: 0.8rem; color: #4a3328; margin: 0; line-height: 1.4; }

  .result-final-val {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    background: #efe8d8;
    border: 1px solid #dfd0bd;
    padding: 0.5rem 0.75rem;
    border-radius: 0.25rem;
    font-size: 0.8rem;
  }
  .val-lbl { color: #78350f; font-weight: bold; }
  .val-po { font-weight: 900; color: #b45309; font-size: 1.05rem; font-family: ui-monospace, monospace; }
  .val-pa { color: #78350f; font-size: 0.75rem; }

  .masterpiece-alert {
    background: #fef9c3;
    border: 1px solid #fde047;
    color: #854d0e;
    padding: 0.4rem 0.65rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .result-actions { display: flex; gap: 0.5rem; margin-top: 0.25rem; }
  .btn-copy {
    flex: 1;
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: 0.35rem;
    padding: 0.5rem;
    font-size: 0.75rem;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
  }
  .btn-copy:hover { background: #f8fafc; }
  .btn-inspect {
    background: #78350f;
    color: #fff;
    border: none;
    border-radius: 0.35rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .btn-inspect:hover { background: #92400e; }

  /* History panel */
  .history-panel {
    background: #241c16;
    border: 1px solid #4a392d;
    border-radius: 0.65rem;
    padding: 1rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
  }
  .history-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
    font-weight: bold;
    color: #fef08a;
    margin-bottom: 0.5rem;
    border-bottom: 1px solid #3e2e23;
    padding-bottom: 0.35rem;
  }
  .btn-clear { background: none; border: none; color: #a89988; font-size: 0.7rem; cursor: pointer; }
  .btn-clear:hover { color: #f87171; }
  .history-empty { font-size: 0.75rem; color: #a89988; font-style: italic; padding: 0.5rem 0; }
  .history-list { display: flex; flex-direction: column; gap: 0.35rem; max-height: 12rem; overflow-y: auto; }
  .history-item {
    font-size: 0.72rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.4rem;
    border-radius: 0.2rem;
    background: #181310;
    color: #c4b5a5;
  }
  .history-item.master {
    background: #2f2317;
    color: #fde047;
    border-left: 2px solid #d4af37;
    font-weight: bold;
  }
  .h-time { font-family: ui-monospace, monospace; font-size: 0.68rem; opacity: 0.7; }
  .h-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
