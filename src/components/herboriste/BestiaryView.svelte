<script lang="ts">
  import type { Creature, CreatureHarvestComponent, CreatureCategory, BiomeType } from '$lib/herboriste/types/herb';
  import { BIOMES_METADATA } from '$lib/herboriste/data/herbalistData';
  import { herboristeStore } from '$lib/herboriste/store.svelte';

  let {
    onSelectHerbByName,
    onSelectCreature,
  }: {
    onSelectHerbByName?: (herbName: string) => void;
    onSelectCreature?: (creature: Creature) => void;
  } = $props();

  const creatures = $derived(herboristeStore.creatures);
  const favoriteCreatureIds = $derived(herboristeStore.favoriteCreatureIds);
  const selectedCreatureId = $derived(herboristeStore.selectedCreatureId);

  let searchTerm = $state<string>('');
  let selectedBiome = $state<string>('all');
  let selectedCategory = $state<string>('all');
  let showFavoritesOnly = $state<boolean>(false);
  let selectedCreature = $state<Creature | null>(null);

  // Sync selected creature if passed from outside (e.g. global search)
  $effect(() => {
    if (selectedCreatureId) {
      const found = creatures.find((c) => c.id === selectedCreatureId);
      if (found) {
        selectedCreature = found;
      }
    }
  });

  // Harvesting simulator states
  let activeHarvestComponent = $state<CreatureHarvestComponent | null>(null);
  let harvesterBonus = $state<number>(4);
  let harvestDiceMode = $state<'virtual' | 'manual'>('virtual');
  let manualHarvestD20 = $state<number>(12);
  let harvestRollResult = $state<{
    roll: number;
    total: number;
    success: boolean;
    critSuccess: boolean;
    critFail: boolean;
  } | null>(null);

  // Modal for new creature
  let isAddModalOpen = $state<boolean>(false);
  let newCreatureName = $state<string>('');
  let newCreatureCategory = $state<CreatureCategory>('Monstruosité');
  let newCreatureCR = $state<string>('3');
  let newCreatureBiomes = $state<BiomeType[]>(['foret']);
  let newCreatureDesc = $state<string>('');
  let newCreatureLore = $state<string>('');
  let newCreatureRisks = $state<string>('');

  // Component form inputs for new creature
  let newCompName = $state<string>('');
  let newCompType = $state<CreatureHarvestComponent['type']>('Venin & Glande');
  let newCompDC = $state<number>(13);
  let newCompSkill = $state<'Survie' | 'Nature' | 'Médecine'>('Survie');
  let newCompTime = $state<string>('20 minutes');
  let newCompValue = $state<string>('50 po');
  let newCompAlchemy = $state<string>('');
  let newCompSynergy = $state<string>('');

  // Filtering
  const filteredCreatures = $derived(
    creatures.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.latinName && c.latinName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        c.components.some(
          (comp) =>
            comp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            comp.alchemicalProperties.toLowerCase().includes(searchTerm.toLowerCase())
        );

      const matchBiome = selectedBiome === 'all' || c.environment.includes(selectedBiome as BiomeType);
      const matchCategory = selectedCategory === 'all' || c.category === selectedCategory;
      const matchFav = !showFavoritesOnly || favoriteCreatureIds.includes(c.id);

      return matchSearch && matchBiome && matchCategory && matchFav;
    })
  );

  function onToggleFavoriteCreature(id: string) {
    herboristeStore.toggleFavoriteCreature(id);
  }

  // Harvest dice roll (virtual or manual)
  function handleHarvestAttempt(comp: CreatureHarvestComponent, customRoll?: number) {
    activeHarvestComponent = comp;
    const d20 =
      customRoll !== undefined
        ? Math.min(20, Math.max(1, customRoll))
        : harvestDiceMode === 'manual'
          ? Math.min(20, Math.max(1, manualHarvestD20))
          : Math.floor(Math.random() * 20) + 1;

    const total = d20 + harvesterBonus;
    const success = d20 === 20 || (d20 !== 1 && total >= comp.harvestDC);

    harvestRollResult = {
      roll: d20,
      total,
      success,
      critSuccess: d20 === 20,
      critFail: d20 === 1,
    };
  }

  // Submit new creature
  function handleCreateCreature(e: SubmitEvent) {
    e.preventDefault();
    if (!newCreatureName) return;

    const newCreature: Creature = {
      id: `custom_${Date.now()}`,
      name: newCreatureName,
      category: newCreatureCategory,
      challengeRating: newCreatureCR,
      environment: newCreatureBiomes,
      description: newCreatureDesc || 'Créature rencontrée au cours des expéditions.',
      tacticsAndLore: newCreatureLore || 'Comportement observé en milieu sauvage.',
      harvestRisks: newCreatureRisks || 'Prudence recommandée lors du dépeçage.',
      components: [
        {
          id: `comp_${Date.now()}`,
          name: newCompName || 'Organe alchimique',
          type: newCompType,
          harvestDC: newCompDC,
          harvestSkill: newCompSkill,
          harvestTime: newCompTime,
          shelfLife: '3 mois',
          marketValue: newCompValue,
          alchemicalProperties: newCompAlchemy || 'Propriétés réactives pour potions.',
          synergyWithHerbs: newCompSynergy || 'Peut être combiné avec les herbes sauvages.',
        },
      ],
      custom: true,
    };

    herboristeStore.addCustomCreature(newCreature);
    selectedCreature = newCreature;
    onSelectCreature?.(newCreature);
    isAddModalOpen = false;

    // Reset fields
    newCreatureName = '';
    newCreatureDesc = '';
    newCreatureLore = '';
    newCompName = '';
    newCompAlchemy = '';
    newCompSynergy = '';
  }

  const COMPONENT_BADGE_CLASSES: Record<CreatureHarvestComponent['type'], string> = {
    'Venin & Glande': 'badge-venin',
    'Organe & Cœur': 'badge-organe',
    'Sang & Fluide': 'badge-sang',
    'Écailles & Cuir': 'badge-ecailles',
    'Os & Crocs': 'badge-os',
    'Spores & Sève': 'badge-spores',
    'Essence Magique': 'badge-essence',
  };

  const COMPONENT_BADGES: Record<CreatureHarvestComponent['type'], string> = {
    'Venin & Glande': 'Venin & Toxine',
    'Organe & Cœur': 'Organe Vital',
    'Sang & Fluide': 'Fluide Sanguin',
    'Écailles & Cuir': 'Cuirasse & Écailles',
    'Os & Crocs': 'Os & Crocs',
    'Spores & Sève': 'Spores & Mycélium',
    'Essence Magique': 'Essence Magique',
  };

  function selectCreature(creature: Creature) {
    selectedCreature = creature;
    activeHarvestComponent = null;
    harvestRollResult = null;
    onSelectCreature?.(creature);
  }

  // silence unused prop warning when no herb navigation is wired
  void onSelectHerbByName;
</script>

<div class="bestiary">
  <!-- Title & Action Header -->
  <div class="view-header">
    <div>
      <div class="header-badges">
        <span class="module-badge">Module Anatomique & Cynégétique</span>
        <span class="count-label">{creatures.length} créatures répertoriées</span>
      </div>
      <h2 class="view-title">
        <span class="title-icon skull">💀</span>
        Bestiaire & Dépeçage Alchimique
      </h2>
      <p class="view-subtitle">
        Catalogue des créatures fantastiques, composants organiques récoltables et synergies avec les plantes de l'herboriste
      </p>
    </div>

    <button class="btn-add" onclick={() => (isAddModalOpen = true)}>
      <span class="plus-icon">➕</span>
      <span>+ Ajouter une Créature (Homebrew)</span>
    </button>
  </div>

  <!-- Search and Filters -->
  <div class="filters-bar">
    <div class="search-wrapper">
      <span class="search-icon">🔍</span>
      <input
        type="text"
        placeholder="Rechercher monstre, organe, venin, propriété alchimique..."
        bind:value={searchTerm}
        class="search-input"
      />
    </div>

    <select bind:value={selectedBiome} class="filter-select">
      <option value="all">Tous les Biotopes</option>
      {#each Object.entries(BIOMES_METADATA) as [key, meta] (key)}
        <option value={key}>{meta.label}</option>
      {/each}
    </select>

    <select bind:value={selectedCategory} class="filter-select">
      <option value="all">Toutes les Catégories</option>
      <option value="Dragon">Dragons</option>
      <option value="Monstruosité">Monstruosités</option>
      <option value="Plante Monstrueuse">Plantes Monstrueuses</option>
      <option value="Fée">Fées & Nymphes</option>
      <option value="Bête Géante">Bêtes Géantes</option>
      <option value="Mort-Vivant">Morts-Vivants</option>
      <option value="Aberration">Aberrations</option>
    </select>

    <button
      class="fav-filter"
      class:fav-filter-active={showFavoritesOnly}
      onclick={() => (showFavoritesOnly = !showFavoritesOnly)}
    >
      <span>❤️</span>
      <span>Favoris ({favoriteCreatureIds.length})</span>
    </button>
  </div>

  <!-- Main Grid: Left Creatures List, Right Creature Dossier -->
  <div class="main-grid">
    <!-- Left Column: Creatures List -->
    <div class="creature-list">
      {#if filteredCreatures.length === 0}
        <div class="empty-list">Aucune créature ne correspond à vos filtres.</div>
      {:else}
        {#each filteredCreatures as creature (creature.id)}
          {@const isSelected = selectedCreature?.id === creature.id}
          {@const isFav = favoriteCreatureIds.includes(creature.id)}
          <div
            class="creature-card"
            class:creature-card-selected={isSelected}
            role="button"
            tabindex="0"
            onclick={() => selectCreature(creature)}
            onkeydown={(e) => e.key === 'Enter' && selectCreature(creature)}
          >
            <div class="card-head">
              <div>
                <h4 class="card-name">{creature.name}</h4>
                {#if creature.latinName}
                  <p class="card-latin">{creature.latinName}</p>
                {/if}
              </div>
              <div class="card-head-actions">
                <button
                  class="fav-btn"
                  class:fav-btn-active={isFav}
                  title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  onclick={(e) => {
                    e.stopPropagation();
                    onToggleFavoriteCreature(creature.id);
                  }}
                >
                  {isFav ? '❤️' : '🤍'}
                </button>
                <span class="cr-badge">FP {creature.challengeRating}</span>
              </div>
            </div>

            <div class="card-tags">
              <span class="tag-category">{creature.category}</span>
              {#each creature.environment as env (env)}
                <span class="tag-biome">{BIOMES_METADATA[env]?.label.split(' ')[0] || env}</span>
              {/each}
            </div>

            <p class="card-desc">{creature.description}</p>

            <div class="card-footer">
              <span>{creature.components.length} composant(s) récoltable(s)</span>
              <span class="card-footer-link">Consulter la fiche →</span>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Right Column: Creature Detailed Sheet & Dissection Lab -->
    <div class="detail-column">
      {#if selectedCreature}
        <div class="detail-sheet">
          <!-- Header Dossier -->
          <div class="detail-header">
            <div class="detail-header-top">
              <div>
                <span class="module-badge">Fiche Anatomique #{selectedCreature.id}</span>
                <h3 class="detail-name">{selectedCreature.name}</h3>
                {#if selectedCreature.latinName}
                  <p class="card-latin">{selectedCreature.latinName}</p>
                {/if}
              </div>
              <div class="detail-header-side">
                <button
                  class="fav-detail-btn"
                  class:fav-detail-btn-active={favoriteCreatureIds.includes(selectedCreature.id)}
                  title={favoriteCreatureIds.includes(selectedCreature.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  onclick={() => selectedCreature && onToggleFavoriteCreature(selectedCreature.id)}
                >
                  <span>{favoriteCreatureIds.includes(selectedCreature.id) ? '❤️' : '🤍'}</span>
                  <span class="fav-detail-label">
                    {favoriteCreatureIds.includes(selectedCreature.id) ? 'Favori' : 'Ajouter aux favoris'}
                  </span>
                </button>
                <div class="detail-cr">
                  <span class="detail-cr-value">Facteur de Puissance : FP {selectedCreature.challengeRating}</span>
                  <span class="detail-cr-type">Type : {selectedCreature.category}</span>
                </div>
              </div>
            </div>

            <div class="detail-biotopes">
              {#each selectedCreature.environment as b (b)}
                <span class="biotope-chip">Biotope : {BIOMES_METADATA[b]?.label || b}</span>
              {/each}
            </div>
          </div>

          <!-- Anatomy and description -->
          <div class="detail-description">
            <h4 class="section-label">Description & Physiologie :</h4>
            <p>{selectedCreature.description}</p>
            <p class="detail-lore">{selectedCreature.tacticsAndLore}</p>
          </div>

          <!-- Harvest Risks Notice -->
          {#if selectedCreature.harvestRisks}
            <div class="risk-notice">
              <span class="risk-icon">⚠️</span>
              <div>
                <strong class="risk-title">Dangers & Risques de Dépeçage :</strong>
                <span>{selectedCreature.harvestRisks}</span>
              </div>
            </div>
          {/if}

          <!-- Harvestable Components Section -->
          <div class="components-section">
            <div class="components-header">
              <h4 class="components-title">
                <span>🔥</span>
                Composants Récoltables & Applications Alchimiques ({selectedCreature.components.length})
              </h4>

              <!-- Dice Mode Toggle -->
              <div class="dice-controls">
                <div class="dice-mode-toggle">
                  <button
                    type="button"
                    class:dice-mode-active={harvestDiceMode === 'virtual'}
                    onclick={() => (harvestDiceMode = 'virtual')}
                  >
                    Dé Virtuel
                  </button>
                  <button
                    type="button"
                    class:dice-mode-active={harvestDiceMode === 'manual'}
                    onclick={() => (harvestDiceMode = 'manual')}
                  >
                    Jet Manuel
                  </button>
                </div>

                {#if harvestDiceMode === 'manual'}
                  <div class="manual-d20">
                    <span>Mon d20 :</span>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      bind:value={manualHarvestD20}
                      class="manual-d20-input"
                    />
                  </div>
                {/if}
              </div>
            </div>

            <div class="components-list">
              {#each selectedCreature.components as comp (comp.id)}
                {@const isHarvesting = activeHarvestComponent?.id === comp.id}
                <div class="component-card" class:component-card-active={isHarvesting}>
                  <div class="component-head">
                    <div>
                      <div class="component-name-row">
                        <h5 class="component-name">{comp.name}</h5>
                        <span class="comp-badge {COMPONENT_BADGE_CLASSES[comp.type]}">{COMPONENT_BADGES[comp.type]}</span>
                      </div>
                      <div class="component-meta">
                        <span>DD de Récolte : <strong>DD {comp.harvestDC} ({comp.harvestSkill})</strong></span>
                        <span>•</span>
                        <span>Temps : {comp.harvestTime}</span>
                        <span>•</span>
                        <span class="component-value">Valeur : {comp.marketValue}</span>
                      </div>
                    </div>

                    <button
                      class="btn-harvest"
                      onclick={() => handleHarvestAttempt(comp, harvestDiceMode === 'manual' ? manualHarvestD20 : undefined)}
                    >
                      <span>🎲</span>
                      <span>
                        {harvestDiceMode === 'manual' ? `Valider Jet (${manualHarvestD20})` : 'Tenter la Récolte'}
                      </span>
                    </button>
                  </div>

                  <!-- Alchemical Properties -->
                  <div class="component-body">
                    <div>
                      <strong class="prop-label">Propriétés Alchimiques : </strong>
                      <span class="prop-text">{comp.alchemicalProperties}</span>
                    </div>

                    <div class="synergy-box">
                      <strong class="synergy-title">
                        <span>✨</span>
                        Synergie avec l'Herboristerie :
                      </strong>
                      <span class="synergy-text">{comp.synergyWithHerbs}</span>
                    </div>

                    {#if comp.hazardOnFail}
                      <div class="hazard-note">
                        <strong>Échec Critique : </strong> {comp.hazardOnFail}
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Harvesting Dice Simulation Result Banner -->
          {#if harvestRollResult && activeHarvestComponent}
            <div class="roll-result">
              <div class="roll-result-head">
                <div class="roll-result-title">
                  <span class="roll-die">{harvestRollResult.roll}</span>
                  <h5 class="roll-name">Jet de Récolte : {activeHarvestComponent.name}</h5>
                </div>
                {#if harvestRollResult.success}
                  <span class="roll-status roll-success">
                    ✓ {harvestRollResult.critSuccess ? 'Réussite Critique Magique !' : 'Prélèvement Réussi !'}
                  </span>
                {:else}
                  <span class="roll-status roll-fail">
                    ✕ {harvestRollResult.critFail ? 'Échec Critique : Incident Toxique !' : 'Composant Détruit'}
                  </span>
                {/if}
              </div>

              <p class="roll-math">
                Jet d20 (<strong>{harvestRollResult.roll}</strong>) + bonus d'herboriste (<strong>{harvesterBonus}</strong>) ={' '}
                <strong>{harvestRollResult.total}</strong> contre DD <strong>{activeHarvestComponent.harvestDC}</strong>.
              </p>

              <p class="roll-narrative">
                {#if harvestRollResult.success}
                  Vous extrayez délicatement 1 dose de {activeHarvestComponent.name}. Elle est conditionnée et prête pour l'alchimie.
                {:else if harvestRollResult.critFail && activeHarvestComponent.hazardOnFail}
                  L'incision a dérapé ! {activeHarvestComponent.hazardOnFail}
                {:else}
                  Les glandes ou tissus ont été déchirés au couteau et ont perdu tout principe actif.
                {/if}
              </p>

              <!-- Bonus Adjuster -->
              <div class="bonus-adjuster">
                <span>Modifier votre bonus de compétence ({activeHarvestComponent.harvestSkill}) :</span>
                <div class="bonus-controls">
                  <button onclick={() => (harvesterBonus = Math.max(0, harvesterBonus - 1))}>-</button>
                  <span class="bonus-value">+{harvesterBonus}</span>
                  <button onclick={() => (harvesterBonus = harvesterBonus + 1)}>+</button>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <div class="no-selection">
          Sélectionnez une créature dans la colonne de gauche pour consulter son anatomie et ses composants.
        </div>
      {/if}
    </div>
  </div>

  <!-- ================= MODAL: ADD CUSTOM CREATURE ================= -->
  {#if isAddModalOpen}
    <div class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">
            <span>💀</span>
            Ajouter une Créature au Bestiaire
          </h3>
          <button class="modal-close" onclick={() => (isAddModalOpen = false)}>✕</button>
        </div>

        <form onsubmit={handleCreateCreature} class="modal-form">
          <div class="form-grid-2">
            <div>
              <label class="form-label" for="nc-name">Nom de la Créature *</label>
              <input
                id="nc-name"
                type="text"
                required
                placeholder="Ex: Chimère des Gorgones"
                bind:value={newCreatureName}
                class="form-input"
              />
            </div>

            <div>
              <label class="form-label" for="nc-cat">Catégorie *</label>
              <select id="nc-cat" bind:value={newCreatureCategory} class="form-input">
                <option value="Monstruosité">Monstruosité</option>
                <option value="Plante Monstrueuse">Plante Monstrueuse</option>
                <option value="Dragon">Dragon</option>
                <option value="Fée">Fée</option>
                <option value="Bête Géante">Bête Géante</option>
                <option value="Mort-Vivant">Mort-Vivant</option>
                <option value="Aberration">Aberration</option>
                <option value="Fiélon">Fiélon</option>
              </select>
            </div>
          </div>

          <div class="form-grid-2">
            <div>
              <label class="form-label" for="nc-cr">Facteur de Puissance (FP)</label>
              <input
                id="nc-cr"
                type="text"
                placeholder="Ex: 4"
                bind:value={newCreatureCR}
                class="form-input"
              />
            </div>

            <div>
              <label class="form-label" for="nc-biome">Biotope Primaire</label>
              <select
                id="nc-biome"
                value={newCreatureBiomes[0]}
                onchange={(e) => (newCreatureBiomes = [e.currentTarget.value as BiomeType])}
                class="form-input"
              >
                {#each Object.entries(BIOMES_METADATA) as [key, meta] (key)}
                  <option value={key}>{meta.label}</option>
                {/each}
              </select>
            </div>
          </div>

          <div>
            <label class="form-label" for="nc-desc">Description & Mœurs</label>
            <textarea
              id="nc-desc"
              rows="2"
              placeholder="Aspect physique, taille, comportement..."
              bind:value={newCreatureDesc}
              class="form-input"
            ></textarea>
          </div>

          <div class="form-component-section">
            <h4 class="form-component-title">Premier Composant Récoltable</h4>
            <div class="form-grid-3">
              <div>
                <label class="form-label-sm" for="ncomp-name">Nom du composant</label>
                <input
                  id="ncomp-name"
                  type="text"
                  placeholder="Ex: Glande de venin caustique"
                  bind:value={newCompName}
                  class="form-input"
                />
              </div>
              <div>
                <label class="form-label-sm" for="ncomp-type">Type d'organe</label>
                <select id="ncomp-type" bind:value={newCompType} class="form-input">
                  <option value="Venin & Glande">Venin & Glande</option>
                  <option value="Organe & Cœur">Organe & Cœur</option>
                  <option value="Sang & Fluide">Sang & Fluide</option>
                  <option value="Écailles & Cuir">Écailles & Cuir</option>
                  <option value="Os & Crocs">Os & Crocs</option>
                  <option value="Spores & Sève">Spores & Sève</option>
                  <option value="Essence Magique">Essence Magique</option>
                </select>
              </div>
              <div>
                <label class="form-label-sm" for="ncomp-dc">DD de récolte</label>
                <input id="ncomp-dc" type="number" bind:value={newCompDC} class="form-input" />
              </div>
            </div>

            <div class="form-grid-2">
              <div>
                <label class="form-label-sm" for="ncomp-alch">Propriété alchimique</label>
                <input
                  id="ncomp-alch"
                  type="text"
                  placeholder="Ex: Poison de blessure violent"
                  bind:value={newCompAlchemy}
                  class="form-input"
                />
              </div>
              <div>
                <label class="form-label-sm" for="ncomp-syn">Synergie Herboristerie</label>
                <input
                  id="ncomp-syn"
                  type="text"
                  placeholder="Ex: Combiné avec Belladone..."
                  bind:value={newCompSynergy}
                  class="form-input"
                />
              </div>
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-cancel" onclick={() => (isAddModalOpen = false)}>
              Annuler
            </button>
            <button type="submit" class="btn-submit">Enregistrer la Créature</button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .bestiary {
    max-width: 80rem;
    margin: 0 auto;
    padding: 2rem 1rem;
    font-family: Georgia, 'Times New Roman', serif;
    color: var(--text-primary, #f4ecd8);
  }
  @media (min-width: 640px) {
    .bestiary { padding: 2rem 1.5rem; }
  }

  /* Header */
  .view-header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-end;
    gap: 1rem;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid #4d3a2e;
    padding-bottom: 1.25rem;
  }
  .header-badges {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }
  .module-badge {
    font-size: 10px;
    padding: 2px 0.5rem;
    border-radius: 0.25rem;
    background: #451a03;
    color: #fcd34d;
    border: 1px solid rgba(217, 119, 6, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-family: monospace;
  }
  .count-label { font-size: 0.75rem; color: var(--text-muted, #a89988); }
  .view-title {
    font-size: 1.875rem;
    font-weight: 700;
    color: var(--accent, #d4af37);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0;
  }
  .title-icon { font-size: 2rem; }
  .view-subtitle {
    font-size: 0.875rem;
    color: var(--text-secondary, #c4b5a5);
    font-style: italic;
    margin-top: 0.25rem;
  }
  .btn-add {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    border-radius: 0.5rem;
    background: #b45309;
    color: #fff;
    font-weight: 700;
    font-size: 0.75rem;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
    transition: background var(--transition-fast, 150ms);
  }
  .btn-add:hover { background: #d97706; }

  /* Filters */
  .filters-bar {
    background: var(--bg-secondary, #1f1915);
    padding: 1rem;
    border-radius: 0.75rem;
    border: 1px solid var(--border, #4a3b32);
    margin-bottom: 1.5rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
    justify-content: space-between;
  }
  .search-wrapper { position: relative; flex: 1; min-width: 240px; }
  .search-icon {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.8rem;
  }
  .search-input {
    width: 100%;
    padding: 0.5rem 0.75rem 0.5rem 2.25rem;
    background: var(--bg-primary, #120e0b);
    border: 1px solid #524136;
    border-radius: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-primary, #f4ecd8);
    box-sizing: border-box;
  }
  .search-input:focus { outline: none; border-color: var(--accent, #d4af37); }
  .filter-select {
    background: var(--bg-primary, #120e0b);
    border: 1px solid #524136;
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    color: var(--text-primary, #f4ecd8);
  }
  .filter-select:focus { outline: none; }
  .fav-filter {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.75rem;
    background: var(--bg-primary, #120e0b);
    color: var(--text-secondary, #d7c9b8);
    border: 1px solid #524136;
    cursor: pointer;
    transition: background var(--transition-fast, 150ms);
  }
  .fav-filter:hover { background: var(--bg-hover, #2c2018); }
  .fav-filter-active {
    background: var(--danger, #881337);
    color: #fecdd3;
    border-color: #e11d48;
    font-weight: 700;
  }

  /* Main grid */
  .main-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  @media (min-width: 1024px) {
    .main-grid { grid-template-columns: 5fr 7fr; }
  }
  .creature-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 800px;
    overflow-y: auto;
    padding-right: 0.25rem;
  }
  .empty-list {
    padding: 2rem;
    text-align: center;
    background: var(--bg-secondary, #1a1410);
    border-radius: 0.75rem;
    border: 1px solid var(--border-subtle, #3e2e23);
    font-size: 0.875rem;
    color: var(--text-muted, #a89988);
    font-style: italic;
  }
  .creature-card {
    padding: 1rem;
    border-radius: 0.75rem;
    border: 2px solid var(--border-subtle, #3e2e23);
    background: var(--bg-secondary, #1a1410);
    color: var(--text-secondary, #d7c9b8);
    cursor: pointer;
    transition: background var(--transition-fast, 150ms), border-color var(--transition-fast, 150ms);
  }
  .creature-card:hover { background: var(--bg-hover, #261d17); }
  .creature-card-selected {
    background: #3d2719;
    border-color: var(--accent, #d4af37);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  }
  .card-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }
  .card-name { font-weight: 700; font-size: 1rem; color: #fef08a; margin: 0; }
  .card-latin { font-size: 11px; color: var(--text-muted, #a89988); font-style: italic; margin: 0; }
  .card-head-actions { display: flex; align-items: center; gap: 0.375rem; }
  .fav-btn {
    padding: 0.375rem;
    border-radius: 9999px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 0.8rem;
    transition: transform var(--transition-fast, 150ms);
  }
  .fav-btn:hover { transform: scale(1.1); background: var(--bg-hover, #2b221b); }
  .fav-btn-active { background: rgba(76, 5, 25, 0.8); border: 1px solid rgba(190, 18, 60, 0.6); }
  .cr-badge {
    padding: 2px 0.5rem;
    border-radius: 0.25rem;
    font-size: 10px;
    font-weight: 700;
    font-family: monospace;
    background: #451a03;
    color: #fcd34d;
    border: 1px solid rgba(180, 83, 9, 0.5);
    white-space: nowrap;
  }
  .card-tags { display: flex; flex-wrap: wrap; gap: 0.375rem; margin: 0.5rem 0; }
  .tag-category {
    font-size: 10px;
    padding: 2px 0.5rem;
    border-radius: 0.25rem;
    background: #241c16;
    color: #cbd5e1;
    border: 1px solid #524136;
  }
  .tag-biome {
    font-size: 10px;
    padding: 2px 0.5rem;
    border-radius: 0.25rem;
    background: #1f2937;
    color: #93c5fd;
    border: 1px solid #374151;
  }
  .card-desc {
    font-size: 0.75rem;
    color: var(--text-muted, #a89988);
    line-height: 1.6;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin: 0;
  }
  .card-footer {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-subtle, #3e2e23);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: #eab308;
  }
  .card-footer-link { color: var(--text-muted, #a89988); }

  /* Detail sheet */
  .detail-sheet {
    background: var(--bg-secondary, #1c1612);
    border-radius: 0.75rem;
    border: 2px solid #5c4033;
    padding: 1.5rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .detail-header { border-bottom: 1px solid #4d3a2e; padding-bottom: 1rem; }
  .detail-header-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
  .detail-name { font-size: 1.5rem; font-weight: 700; color: var(--accent, #d4af37); margin: 0.25rem 0 0; }
  .detail-header-side { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
  .fav-detail-btn {
    padding: 0.5rem;
    border-radius: 0.5rem;
    border: 1px solid #524136;
    background: #241a12;
    color: var(--text-secondary, #d7c9b8);
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    cursor: pointer;
    transition: color var(--transition-fast, 150ms);
  }
  .fav-detail-btn-active { background: var(--danger, #881337); color: #fecdd3; border-color: #e11d48; }
  .fav-detail-label { font-weight: 700; }
  @media (max-width: 639px) {
    .fav-detail-label { display: none; }
  }
  .detail-cr { text-align: right; }
  .detail-cr-value { font-size: 0.75rem; font-weight: 700; color: #fde047; display: block; font-family: monospace; }
  .detail-cr-type { font-size: 11px; color: #cbd5e1; }
  .detail-biotopes { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }
  .biotope-chip {
    font-size: 0.75rem;
    padding: 0.25rem 0.625rem;
    border-radius: 0.25rem;
    background: #2a1d15;
    color: #fcd34d;
    border: 1px solid #78350f;
  }
  .detail-description { font-size: 0.75rem; line-height: 1.6; color: var(--text-secondary, #d7c9b8); }
  .section-label {
    font-weight: 700;
    color: #fde047;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 11px;
    margin: 0 0 0.5rem;
  }
  .detail-description p { margin: 0 0 0.5rem; }
  .detail-lore { font-style: italic; color: var(--text-muted, #a89988); }
  .risk-notice {
    padding: 0.75rem;
    border-radius: 0.5rem;
    background: #3b1212;
    border: 1px solid var(--danger, #dc2626);
    font-size: 0.75rem;
    color: #fca5a5;
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
  }
  .risk-icon { font-size: 1.25rem; flex-shrink: 0; }
  .risk-title { display: block; color: #fecaca; margin-bottom: 0.125rem; }

  /* Components */
  .components-section { display: flex; flex-direction: column; gap: 1rem; padding-top: 0.5rem; }
  .components-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    border-bottom: 1px solid #4d3a2e;
    padding-bottom: 0.5rem;
  }
  .components-title {
    font-weight: 700;
    color: var(--accent, #d4af37);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
  }
  .dice-controls { display: flex; align-items: center; gap: 0.5rem; }
  .dice-mode-toggle {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: var(--bg-primary, #120e0b);
    padding: 2px;
    border-radius: 0.25rem;
    border: 1px solid var(--border-subtle, #3e2e23);
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
  .dice-mode-toggle button.dice-mode-active { background: #854d0e; color: #fff; font-weight: 700; }
  .manual-d20 { display: flex; align-items: center; gap: 0.25rem; font-size: 11px; color: #cbd5e1; }
  .manual-d20-input {
    width: 3rem;
    background: var(--bg-primary, #120e0b);
    border: 1px solid var(--accent, #d4af37);
    border-radius: 0.25rem;
    padding: 2px 0.375rem;
    text-align: center;
    font-family: monospace;
    font-weight: 700;
    color: #fde047;
  }
  .components-list { display: flex; flex-direction: column; gap: 0.75rem; }
  .component-card {
    padding: 1rem;
    border-radius: 0.75rem;
    border: 1px solid var(--border-subtle, #3e2e23);
    background: var(--bg-tertiary, #181310);
    transition: border-color var(--transition-fast, 150ms);
  }
  .component-card-active {
    background: #2f1f15;
    border-color: #fde047;
    box-shadow: 0 0 0 1px #fde047;
  }
  .component-head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .component-name-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .component-name { font-weight: 700; font-size: 0.875rem; color: #fef08a; margin: 0; }
  .comp-badge {
    padding: 2px 0.5rem;
    border-radius: 0.25rem;
    font-size: 10px;
    font-weight: 700;
    border: 1px solid;
  }
  .badge-venin { background: #022c22; color: #6ee7b7; border-color: #047857; }
  .badge-organe { background: #4c0519; color: #fda4af; border-color: #be123c; }
  .badge-sang { background: #450a0a; color: #fca5a5; border-color: #b91c1c; }
  .badge-ecailles { background: #451a03; color: #fcd34d; border-color: #b45309; }
  .badge-os { background: #1c1917; color: #d6d3d1; border-color: #57534e; }
  .badge-spores { background: #3b0764; color: #d8b4fe; border-color: #7e22ce; }
  .badge-essence { background: #172554; color: #93c5fd; border-color: #2563eb; }
  .component-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 11px;
    color: var(--text-muted, #a89988);
    margin-top: 0.125rem;
    flex-wrap: wrap;
  }
  .component-value { color: #fcd34d; }
  .btn-harvest {
    padding: 0.375rem 0.75rem;
    border-radius: 0.25rem;
    background: #b45309;
    color: #fff;
    font-weight: 700;
    font-size: 0.75rem;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    transition: background var(--transition-fast, 150ms);
  }
  .btn-harvest:hover { background: #d97706; }
  .component-body {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    font-size: 0.75rem;
    margin-top: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px solid #2e2119;
  }
  .prop-label { color: #cbd5e1; }
  .prop-text { color: var(--text-secondary, #d7c9b8); }
  .synergy-box {
    background: #241a12;
    padding: 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid #524136;
  }
  .synergy-title {
    color: #fde047;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-bottom: 0.125rem;
  }
  .synergy-text { color: var(--text-secondary, #d7c9b8); font-style: italic; }
  .hazard-note { font-size: 11px; color: var(--danger, #f87171); margin-top: 0.25rem; }

  /* Roll result */
  .roll-result {
    padding: 1rem;
    border-radius: 0.75rem;
    border: 2px solid #fde047;
    background: #2d1b11;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    animation: fade-in 0.3s ease;
  }
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .roll-result-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
  .roll-result-title { display: flex; align-items: center; gap: 0.5rem; }
  .roll-die {
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 9999px;
    background: #fde047;
    color: #1c140d;
    font-family: monospace;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }
  .roll-name { font-weight: 700; font-size: 0.875rem; color: #fef08a; margin: 0; }
  .roll-status { display: flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; font-weight: 700; }
  .roll-success { color: var(--success, #4ade80); }
  .roll-fail { color: var(--danger, #f87171); }
  .roll-math { font-size: 0.75rem; color: var(--text-secondary, #d7c9b8); margin: 0; }
  .roll-narrative { font-size: 11px; font-style: italic; color: #fcd34d; margin: 0; }
  .bonus-adjuster {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 0.5rem;
    border-top: 1px solid #4d3a2e;
    font-size: 11px;
    color: var(--text-muted, #a89988);
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .bonus-controls { display: flex; align-items: center; gap: 0.25rem; }
  .bonus-controls button {
    padding: 2px 0.5rem;
    border-radius: 0.25rem;
    background: var(--bg-tertiary, #181310);
    border: 1px solid #524136;
    color: var(--text-primary, #f4ecd8);
    cursor: pointer;
  }
  .bonus-controls button:hover { background: var(--bg-hover, #2c2018); }
  .bonus-value { font-family: monospace; font-weight: 700; color: #fde047; width: 1.5rem; text-align: center; }
  .no-selection {
    padding: 3rem;
    text-align: center;
    background: var(--bg-secondary, #1c1612);
    border-radius: 0.75rem;
    border: 1px solid #4d3a2e;
    font-size: 0.875rem;
    color: var(--text-muted, #a89988);
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
  }
  .modal {
    background: #1c140d;
    border: 2px solid #854d0e;
    border-radius: 0.75rem;
    max-width: 42rem;
    width: 100%;
    padding: 1.5rem;
    color: var(--text-primary, #f4ecd8);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-height: 90vh;
    overflow-y: auto;
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #4d3a2e;
    padding-bottom: 0.75rem;
  }
  .modal-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--accent, #d4af37);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
  }
  .modal-close {
    background: none;
    border: none;
    color: #a8a29e;
    font-size: 1.125rem;
    font-weight: 700;
    cursor: pointer;
  }
  .modal-close:hover { color: #fff; }
  .modal-form { display: flex; flex-direction: column; gap: 1rem; font-size: 0.75rem; }
  .form-grid-2 { display: grid; grid-template-columns: 1fr; gap: 0.75rem; }
  .form-grid-3 { display: grid; grid-template-columns: 1fr; gap: 0.5rem; margin-bottom: 0.5rem; }
  @media (min-width: 640px) {
    .form-grid-2 { grid-template-columns: 1fr 1fr; }
    .form-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
  }
  .form-label { display: block; color: var(--text-muted, #a89988); margin-bottom: 0.25rem; font-weight: 700; }
  .form-label-sm { display: block; color: var(--text-muted, #a89988); margin-bottom: 0.25rem; }
  .form-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: var(--bg-primary, #120e0b);
    border: 1px solid #524136;
    border-radius: 0.25rem;
    color: #fef08a;
    box-sizing: border-box;
    font-family: inherit;
  }
  .form-input:focus { outline: none; border-color: var(--accent, #d4af37); }
  .form-component-section { border-top: 1px solid #4d3a2e; padding-top: 0.75rem; }
  .form-component-title {
    font-weight: 700;
    color: #fde047;
    margin: 0 0 0.5rem;
    text-transform: uppercase;
    font-size: 11px;
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid #4d3a2e;
  }
  .btn-cancel {
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    background: #2c2018;
    color: var(--text-secondary, #d7c9b8);
    border: none;
    cursor: pointer;
  }
  .btn-cancel:hover { background: #382b22; }
  .btn-submit {
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    background: #b45309;
    color: #fff;
    font-weight: 700;
    border: none;
    cursor: pointer;
  }
  .btn-submit:hover { background: #d97706; }
</style>
