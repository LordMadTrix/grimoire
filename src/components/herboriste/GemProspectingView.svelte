<script lang="ts">
  import type {
    Gem,
    ProspectingSite,
    ProspectingSiteId,
    ProspectingToolId,
    ProspectingRollResult,
  } from '$lib/herboriste/types/gem';
  import {
    GEMS_LIST,
    PROSPECTING_SITES,
    PROSPECTING_TOOLS,
    PROSPECTING_CONDITIONS,
    PROSPECTING_HAZARDS,
  } from '$lib/herboriste/data/gemData';
  import GemIllustration from './GemIllustration.svelte';

  let {
    onSelectGem,
  }: {
    onSelectGem?: (gem: Gem) => void;
  } = $props();

  // State
  let selectedSiteId = $state<ProspectingSiteId>('riviere');
  let selectedTools = $state<Record<ProspectingToolId, boolean>>({
    batee: true,
    marteau: true,
    loupe: false,
    lanterne: false,
  });
  let searchDuration = $state<'1h' | '6h'>('6h');
  let selectedConditionId = $state<string>('standard');
  let prospectorSkillBonus = $state<number>(3);
  let diceMode = $state<'virtual' | 'manual'>('virtual');
  let manualD20 = $state<number>(14);

  // Result state
  let lastRoll = $state<ProspectingRollResult | null>(null);
  let isRolling = $state<boolean>(false);
  let isCrackingGeode = $state<boolean>(false);
  let copyFeedback = $state<string | null>(null);

  // Session prospecting findings log
  let findingsLog = $state<Array<{ time: string; text: string; valuePo: number; gemName?: string }>>([]);

  // Active site object
  const activeSite = $derived(
    PROSPECTING_SITES.find((s) => s.id === selectedSiteId) ?? PROSPECTING_SITES[0]
  );

  // Calculate tool bonus based on active site
  const toolBonus = $derived.by(() => {
    let b = 0;
    if (selectedTools.batee) {
      b += (selectedSiteId === 'riviere' || selectedSiteId === 'cote') ? 2 : 1;
    }
    if (selectedTools.marteau) {
      b += (selectedSiteId === 'montagne' || selectedSiteId === 'caverne' || selectedSiteId === 'volcan') ? 2 : 1;
    }
    if (selectedTools.loupe) {
      b += 1;
    }
    if (selectedTools.lanterne) {
      b += (selectedSiteId === 'caverne' || selectedSiteId === 'astral') ? 2 : 0;
    }
    return b;
  });

  const conditionBonus = $derived(
    PROSPECTING_CONDITIONS.find((c) => c.id === selectedConditionId)?.mod ?? 0
  );

  const durationBonus = $derived(searchDuration === '6h' ? 1 : -2);

  const totalModifier = $derived(prospectorSkillBonus + toolBonus + conditionBonus + durationBonus);

  // Toggle tool
  function toggleTool(id: ProspectingToolId) {
    selectedTools[id] = !selectedTools[id];
  }

  // Execute roll
  function handleProspectRoll(customD20?: number) {
    isRolling = true;

    setTimeout(() => {
      let d20: number;
      if (customD20 !== undefined) {
        d20 = Math.min(20, Math.max(1, customD20));
      } else if (diceMode === 'manual') {
        d20 = Math.min(20, Math.max(1, manualD20));
      } else {
        d20 = Math.floor(Math.random() * 20) + 1;
      }

      const total = d20 + totalModifier;
      const dc = activeSite.dcBase;
      const critSuccess = d20 === 20;
      const critFail = d20 === 1;
      const success = (total >= dc || critSuccess) && !critFail;

      let foundGem: Gem | null = null;
      let weight = 1;
      let state: 'brute' | 'geode' | 'alluviale' | 'gravier' = 'alluviale';
      let purityLabel: 'Parfaite (+50%)' | 'Standard' | 'Avec inclusions (-25%)' = 'Standard';
      let purityMult = 1.0;
      let isGeode = false;
      let flavorTitle = '';
      let flavorDesc = '';
      let hazardNote: string | undefined = undefined;

      if (critFail) {
        flavorTitle = 'Incident géologique critique ! (d20 = 1)';
        const hazard = PROSPECTING_HAZARDS[Math.floor(Math.random() * PROSPECTING_HAZARDS.length)];
        flavorDesc = `Faux mouvement, outil ébréché ou terrain instable : vous n'avez rien récolté d'utile.`;
        hazardNote = hazard;
      } else if (!success) {
        flavorTitle = 'Fouille infructueuse (DD non atteint)';
        flavorDesc = `Après de longs efforts de tamisage dans ${activeSite.name.toLowerCase()}, votre bâtée ne contient que de la vase stérile et des galets sans valeur.`;
      } else {
        // Success ! Pick a gem from active site's pool
        const poolGems = GEMS_LIST.filter((g) => activeSite.availableGemIds.includes(g.id));
        const candidateGems = poolGems.length > 0 ? poolGems : GEMS_LIST;

        // Higher rolls favor rarer gems
        if (critSuccess || total >= dc + 5) {
          const rareOnly = candidateGems.filter((g) => g.rarity === 'Rare' || g.rarity === 'Très rare' || g.rarity === 'Légendaire');
          foundGem = (rareOnly.length > 0 ? rareOnly : candidateGems)[Math.floor(Math.random() * (rareOnly.length || candidateGems.length))];
        } else {
          foundGem = candidateGems[Math.floor(Math.random() * candidateGems.length)];
        }

        // Weight
        weight = Math.floor(Math.random() * 2) + 1; // 1 or 2 UG
        if (critSuccess) weight += 1;

        // State & Geode chance
        const geodeRoll = Math.random();
        if (geodeRoll < 0.35 && (selectedSiteId === 'caverne' || selectedSiteId === 'montagne' || selectedSiteId === 'volcan')) {
          state = 'geode';
          isGeode = true;
        } else if (selectedSiteId === 'riviere' || selectedSiteId === 'cote') {
          state = 'alluviale';
        } else {
          state = 'brute';
        }

        // Purity
        const pRoll = Math.random();
        if (selectedTools.loupe ? pRoll > 0.65 : pRoll > 0.8) {
          purityLabel = 'Parfaite (+50%)';
          purityMult = 1.5;
        } else if (pRoll < 0.25) {
          purityLabel = 'Avec inclusions (-25%)';
          purityMult = 0.75;
        }

        if (critSuccess) {
          flavorTitle = 'Découverte magistrale ! (Coup de maître d20 = 20)';
          flavorDesc = `Un éclat étincelant éblouit vos yeux ! Vous extrayez une veine remarquable de ${foundGem.name}.`;
        } else {
          flavorTitle = isGeode ? 'Géode cristalline intacte mise au jour !' : 'Pépite minérale récoltée avec succès !';
          flavorDesc = `Au fond de votre tamis, vous dégagez une gangue prometteuse : un spécimen brut de ${foundGem.name}.`;
        }
      }

      const finalVal = foundGem ? Math.round(foundGem.basePriceRaw * weight * purityMult) : 0;

      lastRoll = {
        d20,
        skillBonus: prospectorSkillBonus,
        toolBonus,
        conditionBonus,
        total,
        dc,
        success,
        critSuccess,
        critFail,
        foundGem,
        weightGoltors: weight,
        state,
        purity: purityLabel,
        finalValuePo: finalVal,
        flavorTitle,
        flavorDesc,
        hazardNote,
        isGeode,
        geodeCracked: false,
      };

      // Add to session log
      const nowStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      if (foundGem) {
        findingsLog = [
          {
            time: nowStr,
            text: `${foundGem.name} (${weight} UG, ${state}) — ${finalVal} PO`,
            valuePo: finalVal,
            gemName: foundGem.name,
          },
          ...findingsLog,
        ];
      } else {
        findingsLog = [
          {
            time: nowStr,
            text: critFail ? `Incident critique dans ${activeSite.name}` : `Fouille stérile dans ${activeSite.name}`,
            valuePo: 0,
          },
          ...findingsLog,
        ];
      }

      isRolling = false;
    }, 250);
  }

  // Interactive geode crack
  function handleCrackGeode() {
    if (!lastRoll || !lastRoll.isGeode || lastRoll.geodeCracked) return;
    isCrackingGeode = true;

    setTimeout(() => {
      if (lastRoll) {
        lastRoll.geodeCracked = true;
        if (lastRoll.purity !== 'Parfaite (+50%)') {
          lastRoll.purity = 'Parfaite (+50%)';
          if (lastRoll.foundGem) {
            lastRoll.finalValuePo = Math.round(lastRoll.foundGem.basePriceRaw * lastRoll.weightGoltors * 1.5);
          }
        }
        lastRoll.flavorTitle = 'Géode fendue avec succès ! Cristaux purs révélés !';
        lastRoll.flavorDesc = 'Le coup de burin sec a divisé la gangue rocheuse en deux cupules tapissées de prismes resplendissants (+50% valeur).';
      }
      isCrackingGeode = false;
    }, 400);
  }

  // Copy result for DM/VTT
  function copyForVtt() {
    if (!lastRoll) return;
    let md = `**[Prospection Alluviale - ${activeSite.name}]**\n`;
    md += `• **Jet d20 :** ${lastRoll.d20} + ${totalModifier} = **${lastRoll.total}** (DD ${lastRoll.dc})\n`;
    if (lastRoll.foundGem) {
      md += `• **Trouvaille :** ${lastRoll.foundGem.name} (${lastRoll.foundGem.category})\n`;
      md += `• **Poids :** ${lastRoll.weightGoltors} Unités Goltors (UG) · État : ${lastRoll.state}\n`;
      md += `• **Pureté :** ${lastRoll.purity}\n`;
      md += `• **Valeur brute :** ${lastRoll.finalValuePo} PO (${lastRoll.finalValuePo * 10} PA)\n`;
      md += `• **Affinité :** ${lastRoll.foundGem.magicalAffinity}\n`;
    } else {
      md += `• **Résultat :** Aucun minéral précieux découvert.\n`;
      if (lastRoll.hazardNote) md += `• **Mésaventure :** ${lastRoll.hazardNote}\n`;
    }

    navigator.clipboard?.writeText(md).then(() => {
      copyFeedback = 'Copié dans le presse-papier !';
      setTimeout(() => (copyFeedback = null), 2500);
    });
  }

  // Total session loot gold
  const totalSessionGold = $derived(
    findingsLog.reduce((acc, cur) => acc + cur.valuePo, 0)
  );
</script>

<div class="prospect-wrap">
  <!-- Header Bar -->
  <div class="prospect-header">
    <div>
      <div class="header-tag">
        <span class="badge">Atelier de Terrain · Expéditions & Alluvions</span>
        <span class="tag-sub">Terre de Fangh & Systèmes JDR</span>
      </div>
      <h3 class="prospect-title">
        <span>⛏️</span>
        Simulateur de Prospection & Fouille Alluviale
      </h3>
      <p class="prospect-desc">
        Tamisez les graviers des cours d'eau, sondez les failles pegmatitiques et fracturez les géodes mystérieuses pour récolter des gemmes brutes selon les règles D&D / Naheulbeuk.
      </p>
    </div>

    <!-- Quick stats badge -->
    <div class="stats-badge">
      <div class="stats-label">Butin de la séance</div>
      <div class="stats-value">{totalSessionGold} PO</div>
      <div class="stats-sub">{findingsLog.filter(f => f.valuePo > 0).length} gemme(s) récoltée(s)</div>
    </div>
  </div>

  <!-- Main Grid Layout -->
  <div class="prospect-grid">
    <!-- Left Configuration Panel -->
    <div class="config-panel">
      <!-- 1. Site Selection -->
      <div class="config-section">
        <label class="section-title" for="site-picker">
          <span class="step-num">1</span>
          Choisissez le Site Géologique
        </label>
        <div id="site-picker" class="sites-grid">
          {#each PROSPECTING_SITES as site (site.id)}
            <button
              type="button"
              class="site-card"
              class:selected={selectedSiteId === site.id}
              onclick={() => (selectedSiteId = site.id)}
            >
              <div class="site-card-top">
                <span class="site-icon">{site.icon}</span>
                <span class="site-dc">{site.difficultyLabel}</span>
              </div>
              <div class="site-name">{site.name}</div>
              <div class="site-minerals">{site.keyMinerals}</div>
            </button>
          {/each}
        </div>
      </div>

      <!-- 2. Equipment & Tools -->
      <div class="config-section">
        <div class="section-title">
          <span class="step-num">2</span>
          Équipement & Outils d'Orpaillage
          <span class="bonus-badge">Bonus outils : +{toolBonus}</span>
        </div>
        <div class="tools-grid">
          {#each PROSPECTING_TOOLS as tool (tool.id)}
            {@const isEquipped = selectedTools[tool.id]}
            <button
              type="button"
              class="tool-btn"
              class:equipped={isEquipped}
              onclick={() => toggleTool(tool.id)}
            >
              <div class="tool-head">
                <span class="tool-ico">{tool.icon}</span>
                <span class="tool-name">{tool.name}</span>
                <span class="tool-check">{isEquipped ? '✓ Équipé' : '+ Équiper'}</span>
              </div>
              <p class="tool-desc">{tool.description}</p>
            </button>
          {/each}
        </div>
      </div>

      <!-- 3. Conditions & Duration -->
      <div class="config-section">
        <div class="section-title">
          <span class="step-num">3</span>
          Conditions & Compétence
        </div>

        <div class="params-row">
          <div class="param-box">
            <span class="param-lbl">Durée de fouille :</span>
            <div class="pill-group">
              <button
                type="button"
                class="pill-btn"
                class:active={searchDuration === '1h'}
                onclick={() => (searchDuration = '1h')}
              >
                1h (Rapide, -2)
              </button>
              <button
                type="button"
                class="pill-btn"
                class:active={searchDuration === '6h'}
                onclick={() => (searchDuration = '6h')}
              >
                6h (Complète, +1)
              </button>
            </div>
          </div>

          <div class="param-box">
            <label class="param-lbl" for="condition-select">Environnement :</label>
            <select id="condition-select" bind:value={selectedConditionId} class="param-select">
              {#each PROSPECTING_CONDITIONS as c (c.id)}
                <option value={c.id}>{c.icon} {c.label} ({c.mod >= 0 ? `+${c.mod}` : c.mod})</option>
              {/each}
            </select>
          </div>

          <div class="param-box small">
            <label class="param-lbl" for="skill-bonus-input">Bonus Prospecteur :</label>
            <input
              id="skill-bonus-input"
              type="number"
              min="0"
              max="15"
              bind:value={prospectorSkillBonus}
              class="skill-input"
            />
          </div>
        </div>

        <!-- Total Modifier Summary Bar -->
        <div class="total-bar">
          <span>Modificateur Total appliqué au d20 :</span>
          <span class="total-pill">{totalModifier >= 0 ? `+${totalModifier}` : totalModifier}</span>
          <span class="dc-reminder">Objectif du site : DD {activeSite.dcBase}</span>
        </div>
      </div>

      <!-- 4. Roll Action Button -->
      <div class="roll-box">
        <div class="dice-toggle">
          <button
            type="button"
            class="mode-tab"
            class:active={diceMode === 'virtual'}
            onclick={() => (diceMode = 'virtual')}
          >
            🎲 Dé Virtuel
          </button>
          <button
            type="button"
            class="mode-tab"
            class:active={diceMode === 'manual'}
            onclick={() => (diceMode = 'manual')}
          >
            ✍️ Dé Physique Réel
          </button>
        </div>

        {#if diceMode === 'manual'}
          <div class="manual-input-row">
            <label class="manual-lbl" for="manual-d20">Votre jet de dé réel (1 à 20) :</label>
            <input
              id="manual-d20"
              type="number"
              min="1"
              max="20"
              bind:value={manualD20}
              class="manual-num"
            />
            <button
              type="button"
              class="roll-btn"
              disabled={isRolling}
              onclick={() => handleProspectRoll(manualD20)}
            >
              Valider le Jet ({manualD20} {totalModifier >= 0 ? `+ ${totalModifier}` : `- ${Math.abs(totalModifier)}`} = {manualD20 + totalModifier})
            </button>
          </div>
        {:else}
          <button
            type="button"
            class="roll-btn pulse"
            disabled={isRolling}
            onclick={() => handleProspectRoll()}
          >
            <span>🎲</span>
            <span>{isRolling ? 'Tamisage et prospection en cours...' : `Lancer la Prospection (d20 + ${totalModifier})`}</span>
          </button>
        {/if}
      </div>
    </div>

    <!-- Right Result & Inspection Panel -->
    <div class="result-panel">
      {#if lastRoll}
        <div class="result-card" class:success={lastRoll.success} class:fail={!lastRoll.success}>
          <!-- Roll Score Header -->
          <div class="roll-score-banner">
            <div class="dice-badge">
              <span class="d20-icon">🎲</span>
              <span class="d20-val">d20: {lastRoll.d20}</span>
              <span class="d20-math">{totalModifier >= 0 ? `+${totalModifier}` : totalModifier} = <strong>{lastRoll.total}</strong></span>
            </div>
            <div class="dc-badge">
              DD {lastRoll.dc} ({lastRoll.success ? 'Réussi' : 'Échec'})
            </div>
          </div>

          <!-- Flavor Text -->
          <div class="flavor-banner">
            <h4 class="flavor-title">{lastRoll.flavorTitle}</h4>
            <p class="flavor-desc">{lastRoll.flavorDesc}</p>
            {#if lastRoll.hazardNote}
              <div class="hazard-alert">
                <span>⚠️</span>
                <span>{lastRoll.hazardNote}</span>
              </div>
            {/if}
          </div>

          <!-- If gem found -->
          {#if lastRoll.foundGem}
            {@const g = lastRoll.foundGem}
            <div class="gem-found-box">
              <div class="gem-found-left">
                <GemIllustration gem={g} size="md" showPlateDetails={false} />
                {#if onSelectGem}
                  <button
                    type="button"
                    class="inspect-link"
                    onclick={() => onSelectGem(g)}
                  >
                    <span>🔍</span> Fiche Complète
                  </button>
                {/if}
              </div>

              <div class="gem-found-info">
                <div class="gem-found-head">
                  <h4 class="gem-found-name">{g.name}</h4>
                  <span class="gem-rarity">{g.rarity} · Mohs {g.hardnessMohs}</span>
                </div>

                <div class="specs-grid">
                  <div class="spec-cell">
                    <span class="spec-lbl">Poids</span>
                    <span class="spec-val">{lastRoll.weightGoltors} UG</span>
                  </div>
                  <div class="spec-cell">
                    <span class="spec-lbl">État</span>
                    <span class="spec-val capitalize">{lastRoll.state}</span>
                  </div>
                  <div class="spec-cell">
                    <span class="spec-lbl">Pureté</span>
                    <span class="spec-val">{lastRoll.purity}</span>
                  </div>
                  <div class="spec-cell highlight">
                    <span class="spec-lbl">Valeur Estimée</span>
                    <span class="spec-val gold">{lastRoll.finalValuePo} PO</span>
                  </div>
                </div>

                <!-- Geode Cracking Mini-Action -->
                {#if lastRoll.isGeode && !lastRoll.geodeCracked}
                  <div class="geode-action-box">
                    <div class="geode-prompt">
                      <span>🪨</span>
                      <span>La gangue est intacte : fendez-la au burin pour révéler les cristaux intérieurs !</span>
                    </div>
                    <button
                      type="button"
                      class="crack-btn"
                      disabled={isCrackingGeode}
                      onclick={handleCrackGeode}
                    >
                      🔨 {isCrackingGeode ? 'Fracture au burin...' : 'Fendre la Géode (+ Pureté Pure)'}
                    </button>
                  </div>
                {:else if lastRoll.isGeode && lastRoll.geodeCracked}
                  <div class="geode-opened-badge">
                    <span>✨ Géode ouverte avec succès ! Les cristaux purs augmentent la valeur marchande !</span>
                  </div>
                {/if}

                <!-- Enchantment Teaser -->
                <div class="enchant-preview">
                  <span class="enchant-icon">✨</span>
                  <span class="enchant-text"><strong>Propriété :</strong> {g.enchantmentEffect}</span>
                </div>
              </div>
            </div>

            <!-- Action buttons for finding -->
            <div class="result-actions">
              <button type="button" class="action-outline" onclick={copyForVtt}>
                <span>📋</span>
                <span>{copyFeedback ?? 'Copier la Fiche (VTT / MJ)'}</span>
              </button>
              {#if onSelectGem}
                <button type="button" class="action-primary" onclick={() => onSelectGem(g)}>
                  <span>💎</span>
                  <span>Voir dans le Lapidaire</span>
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {:else}
        <!-- Initial Blank State -->
        <div class="empty-state">
          <div class="empty-icon">🥣</div>
          <h4>Prêt pour la Prospection</h4>
          <p>
            Sélectionnez votre biotope d'exploration, vos outils d'orpaillage et lancez le dé pour tamiser les alluvions.
          </p>
          <div class="tip-box">
            <span>💡 <strong>Conseil de mineur nain :</strong> Utilisez la bâtée dans les rivières pour un bonus de +2, et n'oubliez pas le marteau en montagne pour briser la gangue des géodes !</span>
          </div>
        </div>
      {/if}

      <!-- Findings Session Log -->
      <div class="findings-log">
        <div class="log-head">
          <span>📜 Journal des Trouvailles de la Séance</span>
          {#if findingsLog.length > 0}
            <button
              type="button"
              class="clear-log-btn"
              onclick={() => (findingsLog = [])}
            >
              Vider
            </button>
          {/if}
        </div>

        {#if findingsLog.length === 0}
          <div class="log-empty">Aucune prospection enregistrée pour le moment.</div>
        {:else}
          <div class="log-list">
            {#each findingsLog as entry, idx (idx)}
              <div class="log-item" class:gem={entry.valuePo > 0}>
                <span class="log-time">{entry.time}</span>
                <span class="log-text">{entry.text}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .prospect-wrap {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    color: #e6d8c3;
    font-family: Georgia, 'Times New Roman', serif;
  }

  .prospect-header {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid #4a392d;
  }
  @media (min-width: 768px) {
    .prospect-header {
      flex-direction: row;
      align-items: flex-start;
    }
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

  .prospect-title {
    font-size: 1.6rem;
    font-weight: bold;
    color: #d4af37;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0.25rem 0;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
  }
  .prospect-desc {
    font-size: 0.875rem;
    color: #c4b5a5;
    line-height: 1.5;
    max-width: 48rem;
    margin: 0;
    font-style: italic;
  }

  .stats-badge {
    background: #241c16;
    border: 1px solid #59473b;
    padding: 0.75rem 1.25rem;
    border-radius: 0.5rem;
    text-align: right;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
    min-width: 10rem;
  }
  .stats-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    color: #a89988;
    letter-spacing: 0.05em;
    font-weight: 700;
  }
  .stats-value {
    font-size: 1.5rem;
    font-weight: 900;
    color: #fde047;
    font-family: ui-monospace, monospace;
  }
  .stats-sub {
    font-size: 0.75rem;
    color: #d7c9b8;
  }

  /* Grid */
  .prospect-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.75rem;
  }
  @media (min-width: 1024px) {
    .prospect-grid {
      grid-template-columns: 1.15fr 0.85fr;
    }
  }

  .config-panel {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .config-section {
    background: #241c16;
    border: 1px solid #4a392d;
    border-radius: 0.65rem;
    padding: 1.25rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
  }

  .section-title {
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
  .bonus-badge {
    margin-left: auto;
    background: #14532d;
    color: #86efac;
    border: 1px solid #16a34a;
    padding: 0.15rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 700;
  }

  /* Sites */
  .sites-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.65rem;
  }
  @media (min-width: 640px) {
    .sites-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .site-card {
    text-align: left;
    background: #181310;
    border: 1px solid #4a392d;
    border-radius: 0.4rem;
    padding: 0.75rem;
    cursor: pointer;
    transition: all 0.15s ease;
    color: #e6d8c3;
  }
  .site-card:hover {
    background: #2e231b;
    border-color: #854d0e;
  }
  .site-card.selected {
    background: #3b271b;
    border-color: #d4af37;
    box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.3);
  }
  .site-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
  }
  .site-icon { font-size: 1.25rem; }
  .site-dc {
    font-size: 0.7rem;
    font-weight: 700;
    color: #fde047;
    background: #3a2a1d;
    border: 1px solid #6b4d32;
    padding: 0.1rem 0.35rem;
    border-radius: 0.2rem;
  }
  .site-name {
    font-size: 0.85rem;
    font-weight: bold;
    color: #fef08a;
    margin-bottom: 0.2rem;
  }
  .site-minerals {
    font-size: 0.72rem;
    color: #b5a494;
    line-height: 1.25;
  }

  /* Tools */
  .tools-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  @media (min-width: 640px) {
    .tools-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .tool-btn {
    text-align: left;
    background: #181310;
    border: 1px solid #4a392d;
    border-radius: 0.4rem;
    padding: 0.65rem;
    cursor: pointer;
    transition: all 0.15s ease;
    color: #e6d8c3;
  }
  .tool-btn:hover {
    background: #2e231b;
  }
  .tool-btn.equipped {
    background: #1a2e20;
    border-color: #22c55e;
  }
  .tool-head {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-bottom: 0.2rem;
  }
  .tool-ico { font-size: 1.1rem; }
  .tool-name {
    font-size: 0.8rem;
    font-weight: bold;
    color: #fef08a;
    flex: 1;
  }
  .tool-check {
    font-size: 0.68rem;
    font-weight: bold;
    color: #4ade80;
  }
  .tool-desc {
    font-size: 0.7rem;
    color: #a89988;
    margin: 0;
    line-height: 1.25;
  }

  /* Params row */
  .params-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }
  @media (min-width: 640px) {
    .params-row {
      grid-template-columns: 1.3fr 1.5fr 1fr;
    }
  }

  .param-box {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .param-lbl {
    font-size: 0.75rem;
    font-weight: bold;
    color: #fef08a;
  }
  .pill-group {
    display: flex;
    border: 1px solid #59473b;
    border-radius: 0.35rem;
    overflow: hidden;
  }
  .pill-btn {
    flex: 1;
    background: #181310;
    border: none;
    padding: 0.4rem 0.25rem;
    font-size: 0.72rem;
    font-weight: 600;
    color: #c4b5a5;
    cursor: pointer;
  }
  .pill-btn.active {
    background: #d4af37;
    color: #181310;
    font-weight: bold;
  }

  .param-select {
    padding: 0.4rem 0.5rem;
    border: 1px solid #59473b;
    border-radius: 0.35rem;
    font-size: 0.75rem;
    background: #181310;
    color: #f5ecd7;
  }
  .skill-input {
    width: 100%;
    padding: 0.4rem;
    border: 1px solid #59473b;
    border-radius: 0.35rem;
    font-size: 0.85rem;
    text-align: center;
    font-weight: bold;
    background: #181310;
    color: #fde047;
    font-family: ui-monospace, monospace;
    box-sizing: border-box;
  }

  .total-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #181310;
    border: 1px solid #4a392d;
    padding: 0.6rem 0.85rem;
    border-radius: 0.375rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: #d7c9b8;
  }
  .total-pill {
    background: #d4af37;
    color: #181310;
    font-weight: 900;
    padding: 0.15rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.85rem;
    font-family: ui-monospace, monospace;
  }
  .dc-reminder {
    margin-left: auto;
    font-size: 0.75rem;
    color: #a89988;
  }

  /* Roll Box */
  .roll-box {
    background: #241c16;
    border: 1px solid #59473b;
    border-radius: 0.65rem;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }
  .dice-toggle {
    display: flex;
    gap: 0.5rem;
  }
  .mode-tab {
    background: #181310;
    border: 1px solid #4a392d;
    border-radius: 0.35rem;
    padding: 0.35rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    color: #c4b5a5;
  }
  .mode-tab.active {
    background: #d4af37;
    color: #181310;
    border-color: #d4af37;
    font-weight: bold;
  }

  .manual-input-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .manual-lbl {
    font-size: 0.8rem;
    font-weight: bold;
    color: #fef08a;
  }
  .manual-num {
    width: 4.5rem;
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

  .roll-btn {
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
  .roll-btn:hover:not(:disabled) {
    filter: brightness(1.15);
    transform: translateY(-1px);
  }
  .roll-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  /* Result Panel */
  .result-panel {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .empty-state {
    background: #241c16;
    border: 2px dashed #4a392d;
    border-radius: 0.65rem;
    padding: 2.5rem 1.5rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  .empty-icon { font-size: 3rem; }
  .empty-state h4 {
    font-size: 1.15rem;
    font-weight: bold;
    color: #fef08a;
    margin: 0;
  }
  .empty-state p {
    font-size: 0.85rem;
    color: #c4b5a5;
    max-width: 24rem;
    margin: 0;
    font-style: italic;
  }
  .tip-box {
    margin-top: 1rem;
    background: #181310;
    border: 1px solid #59473b;
    border-radius: 0.35rem;
    padding: 0.65rem 0.85rem;
    font-size: 0.75rem;
    color: #fde047;
    text-align: left;
    max-width: 28rem;
    line-height: 1.4;
  }

  .result-card {
    background: #f7f2e7;
    color: #2c1810;
    border: 4px solid #5c3e29;
    border-radius: 0.75rem;
    overflow: hidden;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
  }
  .result-card.success { border-color: #d4af37; }
  .result-card.fail { border-color: #991b1b; }

  .roll-score-banner {
    background: #1f1612;
    color: #fff;
    padding: 0.75rem 1.25rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #5c3e29;
  }
  .dice-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
  }
  .d20-val {
    background: #78350f;
    padding: 0.2rem 0.45rem;
    border-radius: 0.25rem;
    font-weight: 800;
    font-family: ui-monospace, monospace;
    color: #fde047;
  }
  .d20-math strong {
    color: #fef08a;
    font-size: 1rem;
  }
  .dc-badge {
    font-size: 0.75rem;
    font-weight: bold;
    text-transform: uppercase;
    background: rgba(255,255,255,0.15);
    padding: 0.2rem 0.5rem;
    border-radius: 0.25rem;
    color: #e6d8c3;
  }

  .flavor-banner {
    padding: 1rem 1.25rem;
    background: #efe8d8;
    border-bottom: 1px solid #dfd0bd;
  }
  .flavor-title {
    font-size: 1.05rem;
    font-weight: bold;
    color: #3a1d0f;
    margin: 0 0 0.25rem 0;
  }
  .flavor-desc {
    font-size: 0.825rem;
    color: #4a3328;
    margin: 0;
    line-height: 1.45;
  }
  .hazard-alert {
    margin-top: 0.5rem;
    background: #fee2e2;
    border: 1px solid #fca5a5;
    color: #991b1b;
    padding: 0.4rem 0.65rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  /* Gem Found Box */
  .gem-found-box {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  @media (min-width: 640px) {
    .gem-found-box {
      flex-direction: row;
      align-items: flex-start;
    }
  }

  .gem-found-left {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  .inspect-link {
    background: #efe4d0;
    border: 1px solid #cfbca2;
    border-radius: 0.25rem;
    padding: 0.3rem 0.6rem;
    font-size: 0.75rem;
    font-weight: bold;
    color: #78350f;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .inspect-link:hover {
    background: #e2d2b8;
  }

  .gem-found-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }
  .gem-found-head {
    border-bottom: 2px solid rgba(133, 77, 14, 0.25);
    padding-bottom: 0.35rem;
  }
  .gem-found-name {
    font-size: 1.25rem;
    font-weight: bold;
    color: #3a1d0f;
    margin: 0;
  }
  .gem-rarity {
    font-size: 0.75rem;
    color: #78350f;
    font-style: italic;
  }

  .specs-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }
  @media (min-width: 480px) {
    .specs-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  .spec-cell {
    background: #efe8d8;
    border: 1px solid #dfd0bd;
    padding: 0.4rem 0.5rem;
    border-radius: 0.25rem;
    text-align: center;
  }
  .spec-cell.highlight {
    background: #fef08a;
    border-color: #ca8a04;
  }
  .spec-lbl {
    display: block;
    font-size: 0.65rem;
    color: #78350f;
    text-transform: uppercase;
    font-weight: bold;
  }
  .spec-val {
    font-size: 0.85rem;
    font-weight: bold;
    color: #2c1810;
  }
  .spec-val.gold {
    color: #b45309;
    font-family: ui-monospace, monospace;
    font-size: 0.95rem;
  }
  .capitalize { text-transform: capitalize; }

  /* Geode interaction */
  .geode-action-box {
    background: #f3e8ff;
    border: 1px solid #d8b4fe;
    border-radius: 0.35rem;
    padding: 0.65rem 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .geode-prompt {
    font-size: 0.75rem;
    color: #6b21a8;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-weight: 600;
  }
  .crack-btn {
    background: linear-gradient(135deg, #7e22ce, #581c87);
    color: #fff;
    border: none;
    border-radius: 0.35rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
    font-weight: bold;
    cursor: pointer;
    transition: transform 0.1s ease;
  }
  .crack-btn:hover {
    filter: brightness(1.15);
    transform: translateY(-1px);
  }
  .geode-opened-badge {
    background: #dcfce7;
    border: 1px solid #86efac;
    color: #14532d;
    padding: 0.4rem 0.65rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: bold;
  }

  .enchant-preview {
    background: #f0e7d3;
    border: 1px solid #cfbca2;
    border-radius: 0.25rem;
    padding: 0.4rem 0.65rem;
    font-size: 0.75rem;
    color: #2b1810;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .enchant-icon { color: #d97706; }

  .result-actions {
    display: flex;
    gap: 0.5rem;
    padding: 0 1.25rem 1.25rem 1.25rem;
  }
  .action-outline {
    flex: 1;
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: 0.35rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    font-weight: bold;
    color: #334155;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
  }
  .action-outline:hover {
    background: #f8fafc;
    border-color: #94a3b8;
  }
  .action-primary {
    background: #78350f;
    color: #fff;
    border: none;
    border-radius: 0.35rem;
    padding: 0.5rem 0.85rem;
    font-size: 0.75rem;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .action-primary:hover {
    background: #92400e;
  }

  /* Log */
  .findings-log {
    background: #241c16;
    border: 1px solid #4a392d;
    border-radius: 0.65rem;
    padding: 1rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
  }
  .log-head {
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
  .clear-log-btn {
    background: none;
    border: none;
    color: #a89988;
    font-size: 0.7rem;
    cursor: pointer;
  }
  .clear-log-btn:hover {
    color: #f87171;
  }
  .log-empty {
    font-size: 0.75rem;
    color: #a89988;
    font-style: italic;
    padding: 0.5rem 0;
  }
  .log-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    max-height: 12rem;
    overflow-y: auto;
  }
  .log-item {
    font-size: 0.72rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.4rem;
    border-radius: 0.2rem;
    background: #181310;
    color: #c4b5a5;
  }
  .log-item.gem {
    background: #2f2317;
    color: #fde047;
    font-weight: 600;
    border-left: 2px solid #d4af37;
  }
  .log-time {
    font-family: ui-monospace, monospace;
    font-size: 0.68rem;
    opacity: 0.7;
  }
  .log-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
