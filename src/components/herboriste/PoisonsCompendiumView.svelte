<script lang="ts">
  import type { Poison, ConditionEffect, PoisonSaveRoll } from '$lib/herboriste/types/poison';
  import type { Plant } from '$lib/herboriste/types/herb';
  import { POISONS_LIST, POISON_VECTORS_META, POISON_CONDITIONS_META } from '$lib/herboriste/data/poisonsData';
  import { herboristeStore } from '$lib/herboriste/store.svelte';

  let {
    onSelectPlant,
    onNavigateToAlchemy,
  }: {
    onSelectPlant?: (plant: Plant) => void;
    onNavigateToAlchemy?: () => void;
  } = $props();

  const plants = $derived(herboristeStore.plants);

  // Search & Filter states
  let searchQuery = $state<string>('');
  let selectedVector = $state<string>('all');
  let selectedCondition = $state<string>('all');
  let selectedOrigin = $state<string>('all');
  let selectedPoison = $state<Poison>(POISONS_LIST[0]);

  // Simulation test roll states
  let conBonus = $state<number>(3); // Constitution saving throw modifier
  let diceMode = $state<'virtual' | 'manual'>('virtual');
  let manualD20 = $state<number>(12);
  let isRolling = $state<boolean>(false);
  let saveResult = $state<PoisonSaveRoll | null>(null);

  // Active guide sub-tab
  let activeSubTab = $state<'compendium' | 'conditions_rules' | 'detection_lore'>('compendium');

  // Filtered list
  const filteredPoisons = $derived(
    POISONS_LIST.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.latinOrScientificName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.symptoms.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.antidote.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.antidote.requiredPlants.some((rp) => rp.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchVector = selectedVector === 'all' || p.vector === selectedVector;
      const matchCondition = selectedCondition === 'all' || p.conditions.includes(selectedCondition as ConditionEffect);
      const matchOrigin = selectedOrigin === 'all' || p.origin === selectedOrigin;

      return matchSearch && matchVector && matchCondition && matchOrigin;
    })
  );

  // Handle saving throw against the poison
  function handleRollSavingThrow(customRoll?: number) {
    isRolling = true;
    saveResult = null;

    setTimeout(() => {
      const d20 =
        customRoll !== undefined
          ? Math.min(20, Math.max(1, customRoll))
          : diceMode === 'manual'
            ? Math.min(20, Math.max(1, manualD20))
            : Math.floor(Math.random() * 20) + 1;

      const total = d20 + conBonus;
      const critSuccess = d20 === 20;
      const critFail = d20 === 1;
      const success = (total >= selectedPoison.saveDC || critSuccess) && !critFail;

      let dmg = selectedPoison.damageFormula;
      let cond = selectedPoison.conditions.join(', ');
      let msg = '';

      if (critSuccess) {
        dmg = 'Aucun dégât';
        cond = 'Aucune condition (Immunité)';
        msg = `20 Naturel ! Métabolisme d'acier : vos anticorps et votre sang vigoureux neutralisent la toxine avant qu'elle n'atteigne le cœur !`;
      } else if (success) {
        dmg = `Dégâts réduits de moitié (${selectedPoison.damageFormula} / 2)`;
        cond = 'Condition évitée';
        msg = `Sauvegarde réussie (${total} vs DD ${selectedPoison.saveDC}) ! Votre organisme encaisse le choc sans succomber aux effets paralysants.`;
      } else if (critFail) {
        dmg = `Dégâts maximisés critiques (${selectedPoison.damageFormula} MAX)`;
        cond = `${cond} (Durée doublée)`;
        msg = `1 Naturel ! Effondrement immédiat : la toxine foudroie votre système nerveux sans aucune résistance !`;
      } else {
        msg = `Sauvegarde échouée (${total} vs DD ${selectedPoison.saveDC}). Les toxines se répandent dans vos veines : vous subissez ${selectedPoison.damageFormula} et contractez la condition [${cond}].`;
      }

      saveResult = {
        roll: d20,
        total,
        dc: selectedPoison.saveDC,
        success,
        critSuccess,
        critFail,
        damageTaken: dmg,
        conditionApplied: cond,
        narrativeMessage: msg,
      };

      isRolling = false;
    }, 350);
  }

  function resultClass(r: PoisonSaveRoll): string {
    if (r.critSuccess) return 'result-crit-success';
    if (r.success) return 'result-success';
    if (r.critFail) return 'result-crit-fail';
    return 'result-fail';
  }
</script>

<div class="poisons">
  <!-- Header Banner -->
  <div class="banner">
    <div class="banner-glow"></div>

    <div class="banner-content">
      <div>
        <div class="banner-badges">
          <span class="banner-badge">
            <span class="pulse">💀</span>
            Traité de Toxicologie, Venins & Remèdes d'Urgence
          </span>
          <span class="banner-note">Règles D&D 5e & Législation de Fangh</span>
        </div>

        <h2 class="banner-title">
          <span class="banner-skull">💀</span>
          Compendium des Poisons & Antidotes
        </h2>

        <p class="banner-subtitle">
          Consultez les toxines végétales, venins de monstres et poisons minéraux. Découvrez leurs effets de condition (Paralysé, Empoisonné, Pétrifié), simulez vos jets de sauvegarde et préparez les remèdes botaniques associés.
        </p>
      </div>

      <!-- Sub-tab navigation -->
      <div class="subtabs">
        <button class="subtab" class:subtab-active={activeSubTab === 'compendium'} onclick={() => (activeSubTab = 'compendium')}>
          <span>💀</span>
          <span>Les {POISONS_LIST.length} Poisons</span>
        </button>

        <button class="subtab" class:subtab-active={activeSubTab === 'conditions_rules'} onclick={() => (activeSubTab = 'conditions_rules')}>
          <span>📈</span>
          <span>Règles des Conditions</span>
        </button>

        <button class="subtab" class:subtab-active={activeSubTab === 'detection_lore'} onclick={() => (activeSubTab = 'detection_lore')}>
          <span>⚠️</span>
          <span>Détection & Marché Noir</span>
        </button>
      </div>
    </div>
  </div>

  <!-- ============================================================== -->
  <!-- SUB-TAB 1: COMPENDIUM OF POISONS                               -->
  <!-- ============================================================== -->
  {#if activeSubTab === 'compendium'}
    <div class="compendium-grid">
      <!-- Left Column: Filter & Poison List -->
      <div class="list-column">
        <!-- Filter controls -->
        <div class="filters">
          <div class="search-wrapper">
            <span class="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Rechercher poison, symptôme, antidote..."
              bind:value={searchQuery}
              class="search-input"
            />
          </div>

          <!-- Vector pills -->
          <div class="pill-group">
            <span class="pill-label">Vecteur d'Inoculation :</span>
            <div class="pills">
              <button class="pill" class:pill-active={selectedVector === 'all'} onclick={() => (selectedVector = 'all')}>
                Tous
              </button>
              {#each Object.entries(POISON_VECTORS_META) as [key, meta] (key)}
                <button class="pill" class:pill-active={selectedVector === key} onclick={() => (selectedVector = key)}>
                  {meta.label.split(' ')[0]}
                </button>
              {/each}
            </div>
          </div>

          <!-- Condition pills -->
          <div class="pill-group">
            <span class="pill-label">Condition Infligée :</span>
            <div class="pills">
              <button class="pill" class:pill-active={selectedCondition === 'all'} onclick={() => (selectedCondition = 'all')}>
                Toutes
              </button>
              {#each Object.keys(POISON_CONDITIONS_META) as cond (cond)}
                <button class="pill" class:pill-active={selectedCondition === cond} onclick={() => (selectedCondition = cond)}>
                  {cond}
                </button>
              {/each}
            </div>
          </div>

          <!-- Origin pills -->
          <div class="pill-group">
            <span class="pill-label">Origine :</span>
            <div class="pills">
              <button class="pill" class:pill-active={selectedOrigin === 'all'} onclick={() => (selectedOrigin = 'all')}>
                Toutes
              </button>
              <button class="pill" class:pill-active={selectedOrigin === 'vegetale'} onclick={() => (selectedOrigin = 'vegetale')}>Végétale</button>
              <button class="pill" class:pill-active={selectedOrigin === 'minerale'} onclick={() => (selectedOrigin = 'minerale')}>Minérale</button>
              <button class="pill" class:pill-active={selectedOrigin === 'animale_monstre'} onclick={() => (selectedOrigin = 'animale_monstre')}>Animale / Monstre</button>
              <button class="pill" class:pill-active={selectedOrigin === 'alchimique'} onclick={() => (selectedOrigin = 'alchimique')}>Alchimique</button>
            </div>
          </div>
        </div>

        <!-- Poison Cards Scrollable List -->
        <div class="poison-list">
          {#each filteredPoisons as poison (poison.id)}
            {@const isSelected = selectedPoison.id === poison.id}
            {@const vectorMeta = POISON_VECTORS_META[poison.vector]}
            <div
              class="poison-card"
              class:poison-card-selected={isSelected}
              role="button"
              tabindex="0"
              onclick={() => {
                selectedPoison = poison;
                saveResult = null;
              }}
              onkeydown={(e) => {
                if (e.key === 'Enter') {
                  selectedPoison = poison;
                  saveResult = null;
                }
              }}
            >
              <div class="poison-card-main">
                <div class="poison-card-name-row">
                  <span class="poison-card-name">{poison.name}</span>
                </div>

                <div class="poison-card-meta">
                  <span style="color: {vectorMeta.color}">{vectorMeta.label}</span>
                  <span>·</span>
                  <span class="poison-dmg">{poison.damageFormula}</span>
                </div>

                <div class="poison-conds">
                  {#each poison.conditions as cond, idx (idx)}
                    <span class="cond-badge">{cond}</span>
                  {/each}
                </div>
              </div>

              <div class="poison-card-side">
                <span class="poison-dc">DD {poison.saveDC}</span>
                <span class="poison-price">{poison.blackMarketPricePo} PO</span>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Right Column: Poison Detail Dossier & Antidote Recipe -->
      <div class="detail">
        <!-- Header of selected poison -->
        <div class="detail-header">
          <div>
            <div class="detail-badges">
              <span class="detail-origin-badge">
                {POISON_VECTORS_META[selectedPoison.vector].label} · ORIGINE {selectedPoison.origin.toUpperCase()}
              </span>
              <span class="detail-legality">{selectedPoison.legality}</span>
            </div>

            <h3 class="detail-name">{selectedPoison.name}</h3>
            <span class="detail-latin">{selectedPoison.latinOrScientificName}</span>
          </div>

          <div class="detail-side">
            <span class="detail-dc">DD {selectedPoison.saveDC} {selectedPoison.saveType}</span>
            <span class="detail-price">Prix Marché Noir : {selectedPoison.blackMarketPricePo} PO</span>
          </div>
        </div>

        <!-- Damage & Clinical Symptoms -->
        <div class="detail-stats">
          <div class="stat-box">
            <span class="stat-label">Dégâts & Délai d'Incubation :</span>
            <div class="stat-dmg">{selectedPoison.damageFormula}</div>
            <div class="stat-delay">Délai : {selectedPoison.delay}</div>
          </div>

          <div class="stat-box">
            <span class="stat-label">Conditions Toxiques Infligées :</span>
            <div class="stat-conds">
              {#each selectedPoison.conditions as cond, i (i)}
                <span class="stat-cond-badge">⚠️ {cond}</span>
              {/each}
            </div>
          </div>
        </div>

        <!-- Medical Symptoms & Rules Details -->
        <div class="detail-texts">
          <div>
            <strong class="text-label gold">Symptômes Cliniques Visibles :</strong>
            <p class="text-box">{selectedPoison.symptoms}</p>
          </div>

          <div>
            <strong class="text-label red">Mécanique de Jeu (D&D 5e) :</strong>
            <p class="text-box">{selectedPoison.gameMechanics}</p>
          </div>
        </div>

        <!-- ========================================================== -->
        <!-- THE GOLDEN ANTIDOTE & REMEDY CARD                          -->
        <!-- ========================================================== -->
        <div class="antidote-card">
          <div class="antidote-header">
            <div class="antidote-title-group">
              <span class="antidote-icon">❤️</span>
              <div>
                <span class="antidote-label">Remède Thérapeutique & Antidote Officiel</span>
                <h4 class="antidote-name">{selectedPoison.antidote.name}</h4>
              </div>
            </div>

            <div class="antidote-meta">
              <span class="antidote-dc">DD Confection {selectedPoison.antidote.craftDC}</span>
              <span class="antidote-time">{selectedPoison.antidote.preparationTime}</span>
            </div>
          </div>

          <div class="antidote-body">
            <div class="antidote-plants">
              <strong class="antidote-sub">Plantes Médicinales Requises : </strong>
              {#each selectedPoison.antidote.requiredPlants as plantName, idx (idx)}
                {@const foundPlant = plants.find((p) => p.name.toLowerCase().includes(plantName.toLowerCase()))}
                <button
                  type="button"
                  class="plant-chip"
                  title={foundPlant ? 'Voir la fiche botanique complète' : undefined}
                  onclick={() => foundPlant && onSelectPlant && onSelectPlant(foundPlant)}
                >
                  <span>🌿 {plantName}</span>
                  {#if foundPlant}<span class="plant-link-icon">↗</span>{/if}
                </button>
              {/each}
            </div>

            {#if selectedPoison.antidote.requiredMinerals}
              <div class="antidote-plants">
                <strong class="antidote-sub">Minéral / Catalyseur Tellurique : </strong>
                {#each selectedPoison.antidote.requiredMinerals as minName, idx (idx)}
                  <span class="mineral-chip">⛏️ {minName}</span>
                {/each}
              </div>
            {/if}

            <p class="antidote-effect">
              <strong>Effet Curatif : </strong>{selectedPoison.antidote.effect}
            </p>
          </div>

          {#if onNavigateToAlchemy}
            <button class="btn-alchemy" onclick={onNavigateToAlchemy}>
              <span>⚗️</span>
              <span>Concocter cet Antidote dans l'Atelier d'Alchimie</span>
            </button>
          {/if}
        </div>

        <!-- Anecdote from Fangh lore -->
        <div class="lore-box">
          <strong>Chronique de la Milice : </strong>« {selectedPoison.loreAnecdote} »
        </div>

        <!-- ========================================================== -->
        <!-- CONSTITUTION SAVING THROW TEST SIMULATOR                   -->
        <!-- ========================================================== -->
        <div class="simulator">
          <div class="simulator-header">
            <h4 class="simulator-title">
              <span>🎲</span>
              Simulateur de Jet de Sauvegarde (Constitution) vs DD {selectedPoison.saveDC}
            </h4>

            <div class="dice-mode-toggle">
              <button type="button" class:dice-mode-active={diceMode === 'virtual'} onclick={() => (diceMode = 'virtual')}>
                Dé Virtuel
              </button>
              <button type="button" class:dice-mode-active={diceMode === 'manual'} onclick={() => (diceMode = 'manual')}>
                Jet Manuel
              </button>
            </div>
          </div>

          <div class="simulator-body">
            <div>
              <label class="con-label" for="con-range">
                Bonus de Sauvegarde Constitution du Personnage : <strong class="con-value">+{conBonus}</strong>
              </label>
              <input id="con-range" type="range" min="-2" max="12" bind:value={conBonus} class="con-slider" />
            </div>

            {#if diceMode === 'manual'}
              <div class="manual-roll">
                <div class="manual-roll-row">
                  <label class="manual-roll-label" for="manual-d20">Résultat sur votre dé physique d20 (1-20) :</label>
                  <input id="manual-d20" type="number" min="1" max="20" bind:value={manualD20} class="manual-d20-input" />
                </div>
                <button class="btn-roll" onclick={() => handleRollSavingThrow(manualD20)} disabled={isRolling}>
                  <span>✓</span>
                  <span>Valider mon jet ({manualD20}) vs DD {selectedPoison.saveDC}</span>
                </button>
              </div>
            {:else}
              <button class="btn-roll btn-roll-big" onclick={() => handleRollSavingThrow()} disabled={isRolling}>
                <span class:spinning={isRolling}>🎲</span>
                <span>Lancer le d20 de Constitution (+{conBonus})</span>
              </button>
            {/if}

            <!-- Outcome card -->
            {#if saveResult}
              <div class="save-result {resultClass(saveResult)}">
                <div class="save-result-head">
                  <span>d20:{saveResult.roll} + {conBonus} = {saveResult.total} (DD {saveResult.dc})</span>
                  <span>{saveResult.success ? 'RÉUSSI' : 'ÉCHEC'}</span>
                </div>
                <p class="save-result-msg">{saveResult.narrativeMessage}</p>
                <div class="save-result-footer">
                  <span>Dégâts : <strong>{saveResult.damageTaken}</strong></span>
                  <span>État : <strong>{saveResult.conditionApplied}</strong></span>
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- ============================================================== -->
  <!-- SUB-TAB 2: CONDITIONS OFFICIAL D&D RULES                       -->
  <!-- ============================================================== -->
  {#if activeSubTab === 'conditions_rules'}
    <div class="panel">
      <div class="panel-header">
        <h3 class="panel-title">
          <span>📈</span>
          Guide des Conditions Toxiques & Effets de Statut (D&D 5e)
        </h3>
        <p class="panel-subtitle">
          Règles officielles et pénalités précises infligées aux joueurs ou créatures victimes de poisons et venins.
        </p>
      </div>

      <div class="conditions-grid">
        {#each Object.entries(POISON_CONDITIONS_META) as [key, data] (key)}
          <div class="condition-card">
            <div class="condition-head">
              <h4 class="condition-name">⚠️ {data.label}</h4>
              <span class="condition-desc">{data.desc}</span>
            </div>
            <p class="condition-rule">
              <strong>Effets en combat : </strong>{data.dndRule}
            </p>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- ============================================================== -->
  <!-- SUB-TAB 3: POISON DETECTION & LORE                             -->
  <!-- ============================================================== -->
  {#if activeSubTab === 'detection_lore'}
    <div class="panel">
      <div class="panel-header">
        <h3 class="panel-title gold-title">
          <span>⚠️</span>
          Détection des Poisons, Législation & Secrets de Survie
        </h3>
        <p class="panel-subtitle">
          Comment identifier un verre empoisonné lors d'un banquet noble et ce que risque un aventurier pris avec des flacons prohibés dans sa besace.
        </p>
      </div>

      <div class="lore-grid">
        <div class="lore-card">
          <h4 class="lore-card-title">👁️ Indices de Détection Sensorielle</h4>
          <ul class="lore-list">
            <li><strong>Odeur d'Amande Amère :</strong> Révèle la présence de dérivés de ciguë ou de noyaux d'abricot sauvage.</li>
            <li><strong>Test de la Cuillère d'Argent :</strong> L'argent alchimique noircit immédiatement au contact du soufre et des sèves corrosives.</li>
            <li><strong>Gouttelette sur le Pain :</strong> Versée sur de la mie de pain, une boisson empoisonnée forme un halo verdâtre ou fait fuir les mouches.</li>
          </ul>
        </div>

        <div class="lore-card">
          <h4 class="lore-card-title">⚖️ Législation & Milice de Fangh</h4>
          <p class="lore-text">
            Posséder un poison de catégorie « Strictement Interdit » sans brevet royal d'apothicaire est puni de confiscation, d'une amende de 100 PO par fiole et d'un séjour de 3 mois dans les geôles humides de la cité.
          </p>
          <div class="lore-rule">
            <strong>Règle Rôliste :</strong> Si un aventurier tente de revendre un poison sans passer par la Guilde des Voleurs, un test de Tromperie ou Charisme DD 14 est requis pour ne pas éveiller les soupçons d'un indicateur de la Garde.
          </div>
        </div>

        <div class="lore-card">
          <h4 class="lore-card-title">❤️ Gestes de Premiers Soins</h4>
          <ul class="lore-list">
            <li><strong>Garrot Lâche :</strong> Ralentit la progression veineuse sans gangrener le membre blessé.</li>
            <li><strong>Lavement à l'Eau Pure :</strong> Dilue l'acide superficiel et stoppe les dégâts continus.</li>
            <li><strong>Prise d'Émétique :</strong> Efficace uniquement dans les 30 minutes suivant l'ingestion orale.</li>
          </ul>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .poisons {
    max-width: 80rem;
    margin: 0 auto;
    padding: 2rem 1rem;
    font-family: Georgia, 'Times New Roman', serif;
    color: var(--text-primary, #f4ecd8);
    display: flex;
    flex-direction: column;
    gap: 2rem;
    animation: fade-in 0.3s ease;
  }
  @media (min-width: 640px) {
    .poisons { padding: 2rem 1.5rem; }
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* Banner */
  .banner {
    background: #1f1515;
    border-radius: 0.75rem;
    border: 2px solid rgba(239, 68, 68, 0.6);
    padding: 1.5rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    position: relative;
    overflow: hidden;
  }
  @media (min-width: 640px) {
    .banner { padding: 1.75rem; }
  }
  .banner-glow {
    position: absolute;
    right: -3rem;
    top: -3rem;
    width: 16rem;
    height: 16rem;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 9999px;
    filter: blur(48px);
    pointer-events: none;
  }
  .banner-content {
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  @media (min-width: 1024px) {
    .banner-content { flex-direction: row; align-items: center; justify-content: space-between; }
  }
  .banner-badges { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.375rem; flex-wrap: wrap; }
  .banner-badge {
    font-size: 10px;
    padding: 2px 0.625rem;
    border-radius: 0.25rem;
    background: #450a0a;
    color: #fca5a5;
    border: 1px solid rgba(239, 68, 68, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-family: monospace;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  .pulse { animation: pulse 2s infinite; }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .banner-note { font-size: 0.75rem; color: var(--text-muted, #a89988); }
  .banner-title {
    font-size: 1.875rem;
    font-weight: 800;
    color: #fecaca;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0;
  }
  @media (min-width: 640px) {
    .banner-title { font-size: 2.25rem; }
  }
  .banner-skull { font-size: 2.25rem; }
  .banner-subtitle {
    font-size: 0.75rem;
    color: var(--text-secondary, #c4b5a5);
    font-style: italic;
    margin-top: 0.375rem;
    max-width: 48rem;
    line-height: 1.6;
  }
  @media (min-width: 640px) {
    .banner-subtitle { font-size: 0.875rem; }
  }

  /* Sub-tabs */
  .subtabs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    background: #140b0b;
    padding: 0.375rem;
    border-radius: 0.75rem;
    border: 1px solid #3e1a1a;
    flex-shrink: 0;
  }
  .subtab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    border-radius: 0.5rem;
    font-size: 0.75rem;
    font-weight: 700;
    border: none;
    background: transparent;
    color: var(--text-secondary, #d7c9b8);
    cursor: pointer;
    transition: background var(--transition-fast, 150ms);
  }
  .subtab:hover { background: #281212; }
  .subtab-active {
    background: #991b1b;
    color: #fff;
    box-shadow: 0 0 0 1px #f87171;
  }
  .subtab-active:hover { background: #991b1b; }

  /* Compendium grid */
  .compendium-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  @media (min-width: 1024px) {
    .compendium-grid { grid-template-columns: 5fr 7fr; }
  }
  .list-column { display: flex; flex-direction: column; gap: 1rem; }

  /* Filters */
  .filters {
    background: #1a1010;
    padding: 1rem;
    border-radius: 0.75rem;
    border: 1px solid #3e1e1e;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  }
  .search-wrapper { position: relative; }
  .search-icon {
    position: absolute;
    left: 0.75rem;
    top: 0.75rem;
    font-size: 0.8rem;
  }
  .search-input {
    width: 100%;
    padding: 0.5rem 0.75rem 0.5rem 2.25rem;
    background: #120808;
    border: 1px solid #4a2222;
    border-radius: 0.5rem;
    font-size: 0.75rem;
    color: #f5ecd7;
    box-sizing: border-box;
  }
  .search-input:focus { outline: none; border-color: var(--danger, #ef4444); }
  .pill-group { display: flex; flex-direction: column; gap: 0.25rem; }
  .pill-label {
    font-size: 10px;
    color: var(--text-muted, #a89988);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 700;
  }
  .pills { display: flex; flex-wrap: wrap; gap: 0.375rem; }
  .pill {
    padding: 2px 0.5rem;
    border-radius: 0.25rem;
    font-size: 10px;
    font-weight: 700;
    background: #120808;
    color: var(--text-secondary, #c4b5a5);
    border: 1px solid #381a1a;
    cursor: pointer;
    transition: background var(--transition-fast, 150ms);
  }
  .pill-active { background: #991b1b; color: #fff; border-color: #991b1b; }

  /* Poison list */
  .poison-list {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    max-height: 640px;
    overflow-y: auto;
    padding-right: 0.25rem;
  }
  .poison-card {
    padding: 0.875rem;
    border-radius: 0.75rem;
    border: 1px solid #381a1a;
    background: #190e0e;
    cursor: pointer;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    transition: border-color var(--transition-fast, 150ms);
  }
  .poison-card:hover { border-color: #7f1d1d; }
  .poison-card-selected {
    background: #3b1515;
    border-color: var(--danger, #ef4444);
    box-shadow: 0 0 0 1px var(--danger, #ef4444), 0 4px 14px rgba(0, 0, 0, 0.4);
  }
  .poison-card-main { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
  .poison-card-name-row { display: flex; align-items: center; gap: 0.5rem; }
  .poison-card-name {
    font-weight: 700;
    font-size: 0.875rem;
    color: #fecaca;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .poison-card-meta {
    font-size: 11px;
    color: var(--text-muted, #a89988);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .poison-dmg { color: #f87171; font-family: monospace; }
  .poison-conds { display: flex; flex-wrap: wrap; gap: 0.25rem; padding-top: 0.125rem; }
  .cond-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 0.375rem;
    border-radius: 0.25rem;
    background: #3b0b0b;
    color: #fca5a5;
    border: 1px solid #7f1d1d;
  }
  .poison-card-side { text-align: right; flex-shrink: 0; }
  .poison-dc { font-size: 0.75rem; font-family: monospace; font-weight: 700; color: #fde047; display: block; }
  .poison-price { font-size: 10px; color: #cbd5e1; font-family: monospace; display: block; margin-top: 0.25rem; }

  /* Detail */
  .detail {
    background: #1c1212;
    padding: 1.5rem;
    border-radius: 0.75rem;
    border: 1px solid #4a2424;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4);
  }
  @media (min-width: 640px) {
    .detail { padding: 1.75rem; }
  }
  .detail-header {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    border-bottom: 1px solid #381a1a;
    padding-bottom: 1rem;
  }
  @media (min-width: 640px) {
    .detail-header { flex-direction: row; align-items: center; justify-content: space-between; }
  }
  .detail-badges { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .detail-origin-badge {
    font-size: 10px;
    text-transform: uppercase;
    font-family: monospace;
    font-weight: 700;
    padding: 2px 0.5rem;
    border-radius: 0.25rem;
    background: #450a0a;
    color: #fca5a5;
    border: 1px solid rgba(239, 68, 68, 0.4);
  }
  .detail-legality { font-size: 10px; color: #fde047; font-family: monospace; font-weight: 700; }
  .detail-name { font-size: 1.5rem; font-weight: 700; color: #fecaca; margin: 0.375rem 0 0; }
  .detail-latin { font-size: 0.75rem; font-style: italic; color: var(--text-muted, #a89988); }
  .detail-side { text-align: left; }
  @media (min-width: 640px) {
    .detail-side { text-align: right; }
  }
  .detail-dc { font-size: 1.5rem; font-family: monospace; font-weight: 800; color: #fde047; display: block; }
  .detail-price { font-size: 11px; color: #cbd5e1; }

  .detail-stats { display: grid; grid-template-columns: 1fr; gap: 0.75rem; font-size: 0.75rem; }
  @media (min-width: 640px) {
    .detail-stats { grid-template-columns: 1fr 1fr; }
  }
  .stat-box {
    padding: 0.75rem;
    border-radius: 0.5rem;
    background: #261212;
    border: 1px solid #4a2222;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .stat-label {
    font-size: 10px;
    color: var(--text-muted, #a89988);
    font-weight: 700;
    text-transform: uppercase;
  }
  .stat-dmg { font-family: monospace; font-size: 0.875rem; font-weight: 700; color: var(--danger, #ef4444); }
  .stat-delay { font-size: 11px; color: #cbd5e1; }
  .stat-conds { display: flex; flex-wrap: wrap; gap: 0.375rem; padding-top: 0.125rem; }
  .stat-cond-badge {
    padding: 2px 0.5rem;
    border-radius: 0.25rem;
    background: #450a0a;
    color: #fca5a5;
    border: 1px solid var(--danger, #ef4444);
    font-size: 11px;
    font-weight: 700;
  }

  .detail-texts { display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.75rem; }
  .text-label { display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem; }
  .text-label.gold { color: #fde047; }
  .text-label.red { color: var(--danger, #ef4444); }
  .text-box {
    color: #e6d8c3;
    line-height: 1.6;
    background: #170c0c;
    padding: 0.625rem;
    border-radius: 0.25rem;
    border: 1px solid #381818;
    margin: 0;
  }

  /* Antidote card */
  .antidote-card {
    background: #1f1a14;
    border-radius: 0.75rem;
    border: 2px solid var(--accent, #d4af37);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  }
  @media (min-width: 640px) {
    .antidote-card { padding: 1.25rem; }
  }
  .antidote-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
    border-bottom: 1px solid #4d3a2e;
    padding-bottom: 0.5rem;
    flex-wrap: wrap;
  }
  .antidote-title-group { display: flex; align-items: center; gap: 0.5rem; }
  .antidote-icon { font-size: 1.25rem; }
  .antidote-label {
    font-size: 10px;
    color: var(--success, #4ade80);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 700;
    display: block;
  }
  .antidote-name { font-size: 1rem; font-weight: 700; color: #fde047; margin: 0; }
  .antidote-meta { text-align: right; }
  .antidote-dc { font-size: 0.75rem; font-family: monospace; font-weight: 700; color: #fde047; display: block; }
  .antidote-time { font-size: 10px; color: var(--text-muted, #a89988); }
  .antidote-body { font-size: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
  .antidote-plants { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; color: #e6d8c3; }
  .antidote-sub { color: var(--text-muted, #a89988); }
  .plant-chip {
    padding: 2px 0.5rem;
    border-radius: 0.25rem;
    background: #2b1f14;
    border: 1px solid rgba(212, 175, 55, 0.6);
    font-size: 11px;
    font-weight: 700;
    color: #fef08a;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    transition: background var(--transition-fast, 150ms);
  }
  .plant-chip:hover { background: #451a03; }
  .plant-link-icon { color: var(--accent, #d4af37); font-size: 0.75rem; }
  .mineral-chip {
    padding: 2px 0.5rem;
    border-radius: 0.25rem;
    background: #1e293b;
    border: 1px solid rgba(56, 189, 248, 0.5);
    font-size: 11px;
    font-weight: 700;
    color: #38bdf8;
  }
  .antidote-effect {
    font-size: 11px;
    color: var(--success, #4ade80);
    font-style: italic;
    padding-top: 0.25rem;
    border-top: 1px solid #3e2e23;
    margin: 0;
  }
  .btn-alchemy {
    width: 100%;
    padding: 0.5rem;
    background: #b45309;
    color: #fff;
    font-weight: 700;
    font-size: 0.75rem;
    border-radius: 0.5rem;
    border: none;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    transition: background var(--transition-fast, 150ms);
  }
  .btn-alchemy:hover { background: #d97706; }

  /* Lore box */
  .lore-box {
    padding: 0.75rem;
    background: #170e0e;
    border-radius: 0.5rem;
    border: 1px solid #3e1a1a;
    font-size: 0.75rem;
    color: var(--text-secondary, #c4b5a5);
    font-style: italic;
    line-height: 1.6;
  }

  /* Simulator */
  .simulator {
    background: #190e0e;
    padding: 1.25rem;
    border-radius: 0.75rem;
    border: 1px solid #4a2222;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .simulator-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    border-bottom: 1px solid #3e1a1a;
    padding-bottom: 0.5rem;
    flex-wrap: wrap;
  }
  .simulator-title {
    font-weight: 700;
    font-size: 0.875rem;
    color: #fecaca;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
  }
  .dice-mode-toggle {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: #120808;
    padding: 2px;
    border-radius: 0.25rem;
    border: 1px solid #3e1a1a;
  }
  .dice-mode-toggle button {
    padding: 2px 0.5rem;
    border-radius: 0.25rem;
    font-size: 10px;
    border: none;
    background: transparent;
    color: var(--text-muted, #a89988);
    cursor: pointer;
    transition: background var(--transition-fast, 150ms);
  }
  .dice-mode-toggle button.dice-mode-active { background: #991b1b; color: #fff; font-weight: 700; }
  .simulator-body { display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.75rem; }
  .con-label { display: block; color: var(--text-muted, #a89988); margin-bottom: 0.25rem; }
  .con-value { color: #fde047; }
  .con-slider { width: 100%; accent-color: var(--danger, #ef4444); }
  .manual-roll { display: flex; flex-direction: column; gap: 0.5rem; }
  .manual-roll-row { display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; gap: 0.5rem; }
  .manual-roll-label { color: var(--text-muted, #a89988); }
  .manual-d20-input {
    width: 4rem;
    padding: 0.25rem 0.5rem;
    background: #120808;
    border: 1px solid var(--danger, #ef4444);
    border-radius: 0.25rem;
    text-align: center;
    font-size: 0.875rem;
    font-weight: 700;
    color: #fecaca;
    font-family: monospace;
  }
  .manual-d20-input:focus { outline: none; }
  .btn-roll {
    width: 100%;
    padding: 0.625rem;
    background: #991b1b;
    color: #fff;
    font-weight: 700;
    font-size: 0.75rem;
    border-radius: 0.5rem;
    border: none;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: background var(--transition-fast, 150ms);
  }
  .btn-roll:hover { background: #b91c1c; }
  .btn-roll:disabled { opacity: 0.5; cursor: default; }
  .btn-roll-big { padding: 0.75rem; }
  .spinning { display: inline-block; animation: spin 1s linear infinite; }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .save-result {
    padding: 0.875rem;
    border-radius: 0.5rem;
    border: 1px solid;
    font-size: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    animation: fade-in 0.3s ease;
  }
  .result-crit-success { background: rgba(20, 83, 45, 0.4); border-color: var(--success, #22c55e); color: #86efac; }
  .result-success { background: rgba(30, 58, 95, 0.4); border-color: #38bdf8; color: #bae6fd; }
  .result-crit-fail { background: rgba(69, 10, 10, 0.5); border-color: var(--danger, #ef4444); color: #fca5a5; }
  .result-fail { background: #3b1515; border-color: var(--danger, #ef4444); color: #fecaca; }
  .save-result-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: monospace;
    font-weight: 700;
  }
  .save-result-msg { line-height: 1.6; margin: 0; }
  .save-result-footer {
    font-size: 11px;
    padding-top: 0.25rem;
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    display: flex;
    justify-content: space-between;
    font-family: monospace;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  /* Panels (sub-tabs 2 & 3) */
  .panel {
    background: #1c1212;
    padding: 1.5rem;
    border-radius: 0.75rem;
    border: 1px solid #4a2424;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4);
  }
  @media (min-width: 640px) {
    .panel { padding: 2rem; }
  }
  .panel-header { border-bottom: 1px solid #381a1a; padding-bottom: 1rem; }
  .panel-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #fecaca;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    margin: 0;
  }
  .gold-title { color: #fde047; }
  .panel-subtitle {
    font-size: 0.75rem;
    color: var(--text-secondary, #c4b5a5);
    font-style: italic;
    margin: 0.25rem 0 0;
    line-height: 1.6;
  }
  @media (min-width: 640px) {
    .panel-subtitle { font-size: 0.875rem; }
  }
  .conditions-grid { display: grid; grid-template-columns: 1fr; gap: 1rem; }
  @media (min-width: 768px) {
    .conditions-grid { grid-template-columns: 1fr 1fr; }
  }
  .condition-card {
    background: #241212;
    padding: 1rem;
    border-radius: 0.75rem;
    border: 1px solid #4a2222;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .condition-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    border-bottom: 1px solid #381a1a;
    padding-bottom: 0.375rem;
  }
  .condition-name { font-weight: 700; font-size: 1rem; color: #fde047; margin: 0; }
  .condition-desc { font-size: 10px; color: var(--text-muted, #a89988); font-style: italic; text-align: right; }
  .condition-rule { font-size: 0.75rem; color: #e6d8c3; line-height: 1.6; margin: 0; }

  .lore-grid { display: grid; grid-template-columns: 1fr; gap: 1.5rem; font-size: 0.75rem; color: #e6d8c3; }
  @media (min-width: 768px) {
    .lore-grid { grid-template-columns: 1fr 1fr 1fr; }
  }
  .lore-card {
    background: #241212;
    padding: 1rem;
    border-radius: 0.75rem;
    border: 1px solid #4a2222;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .lore-card-title {
    font-weight: 700;
    font-size: 0.875rem;
    color: #fde047;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
  }
  .lore-list {
    list-style: disc;
    padding-left: 1.25rem;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    color: #cbd5e1;
    line-height: 1.6;
  }
  .lore-text { color: #cbd5e1; line-height: 1.6; margin: 0; }
  .lore-rule {
    padding: 0.5rem;
    border-radius: 0.25rem;
    background: #170808;
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #fca5a5;
    font-size: 11px;
  }
</style>
