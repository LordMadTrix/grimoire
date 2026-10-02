<script lang="ts">
  import type { ForgeRecipe, ForgeCraftResult, Mineral } from '$lib/herboriste/types/mineral';
  import { FORGE_RECIPES, FORGE_RULES_LORE } from '$lib/herboriste/data/forgeRecipesData';
  import { MINERALS_LIST } from '$lib/herboriste/data/mineralData';
  import { GEMS_LIST } from '$lib/herboriste/data/gemData';
  import type { Creature } from '$lib/herboriste/types/herb';

  type ForgeTier = 'Forge de Campagne' | 'Forge de Maître' | 'Enclume Naine Ancestrale' | 'Fourneau Volcanique';

  let {
    creatures = [],
    onSelectMineral,
    onNavigateToMinerals,
  }: {
    creatures?: Creature[];
    onSelectMineral?: (mineral: Mineral) => void;
    onNavigateToMinerals?: () => void;
  } = $props();

  // Props optionnelles conservées pour compatibilité API
  void creatures;
  void onSelectMineral;
  void onNavigateToMinerals;

  // Navigation sub-tab
  let activeTab = $state<'recipes' | 'anvil' | 'lore'>('recipes');

  // Recipe catalog filtering
  let searchQuery = $state<string>('');
  let selectedCategory = $state<string>('all');
  let selectedRecipe = $state<ForgeRecipe>(FORGE_RECIPES[0]);

  // Interactive Anvil state
  let customTier = $state<ForgeTier>('Forge de Maître');
  let blacksmithBonus = $state<number>(5); // Force + Outils de forgeron
  let quenchingMethod = $state<string>("Trempe à l'Huile Alchimique (Flexibilité & Résistance)");
  let selectedGemInlay = $state<string>('none');
  let selectedCreatureComponent = $state<string>('none');

  // Dice simulation state
  let forgeDiceMode = $state<'virtual' | 'manual'>('virtual');
  let manualD20 = $state<number>(15);
  let craftResult = $state<ForgeCraftResult | null>(null);
  let isHammering = $state<boolean>(false);

  const categoryPills = [
    { id: 'all', label: 'Tout' },
    { id: 'arme', label: '⚔️ Armes' },
    { id: 'armure', label: '🛡️ Armures' },
    { id: 'bouclier', label: '🛡️ Boucliers' },
    { id: 'outil', label: '✂️ Outils' },
    { id: 'relique', label: '✨ Reliques' },
  ];

  const forgeTiers: { tier: ForgeTier; desc: string; mod: number }[] = [
    { tier: 'Forge de Campagne', desc: '800°C - 1100°C (+2 au DD)', mod: +2 },
    { tier: 'Forge de Maître', desc: '1200°C - 1800°C (DD normal)', mod: 0 },
    { tier: 'Enclume Naine Ancestrale', desc: '1900°C - 2400°C (-2 au DD)', mod: -2 },
    { tier: 'Fourneau Volcanique', desc: '2500°C - 3200°C (-3 au DD)', mod: -3 },
  ];

  // Filter recipes
  const filteredRecipes = $derived(FORGE_RECIPES.filter((rec) => {
    const q = searchQuery.toLowerCase();
    const matchesCategory = selectedCategory === 'all' || rec.category === selectedCategory;
    const matchesSearch =
      rec.name.toLowerCase().includes(q) ||
      rec.description.toLowerCase().includes(q) ||
      rec.specialProperties.some(p => p.toLowerCase().includes(q)) ||
      rec.damageOrAC.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  }));

  // Calculate adjusted craft DC
  const tierModifiers: Record<string, number> = {
    'Forge de Campagne': +2, // harder to maintain heat
    'Forge de Maître': 0,
    'Enclume Naine Ancestrale': -2,
    'Fourneau Volcanique': -3,
  };

  const currentTierMod = $derived(tierModifiers[customTier] || 0);
  const effectiveForgeDC = $derived(Math.max(8, selectedRecipe.difficultyDC + currentTierMod));

  // Trigger forge hammer strike
  function handleStrikeAnvil(customRoll?: number) {
    isHammering = true;
    craftResult = null;

    setTimeout(() => {
      const d20 = customRoll !== undefined
        ? Math.min(20, Math.max(1, customRoll))
        : (forgeDiceMode === 'manual' ? Math.min(20, Math.max(1, manualD20)) : Math.floor(Math.random() * 20) + 1);

      const total = d20 + blacksmithBonus;
      const critSuccess = d20 === 20;
      const critFail = d20 === 1;
      const success = (total >= effectiveForgeDC || critSuccess) && !critFail;

      let quality: ForgeCraftResult['finalQuality'] = 'Standard';
      let valuePo = selectedRecipe.marketValuePo;
      let effectiveProps = [...selectedRecipe.specialProperties];
      let msg = '';

      if (critSuccess || total >= effectiveForgeDC + 5) {
        quality = "Chef-d'œuvre Ancestral (+1)";
        valuePo = Math.round(selectedRecipe.marketValuePo * 1.5);
        effectiveProps.unshift("⭐️ Chef-d'œuvre : +1 supplémentaire aux jets d'attaque, de dégâts ou à la CA");
        msg = `Frappe magistrale ! Le marteau a résonné d'une harmonie parfaite. L'acier a absorbé la chaleur sans la moindre micro-fissure. Vous réalisez un Chef-d'œuvre (+50% de valeur) !`;
      } else if (success) {
        quality = 'Qualité Supérieure';
        msg = `Forge réussie (${total} vs DD ${effectiveForgeDC}) ! La pièce refroidit dans son bain d'huile avec un tranchant impeccable et un équilibrage d'armurier.`;
      } else if (critFail) {
        quality = 'Échec Total (Lingots perdus)';
        valuePo = 0;
        effectiveProps = ['Ébréché et irrécupérable'];
        msg = `1 Naturel ! Catastrophe sur l'enclume : la pièce s'est brisée lors du trempage thermique. Le métal est brûlé et les lingots sont perdus.`;
      } else {
        quality = 'Trempe Fragilisée';
        valuePo = Math.round(selectedRecipe.marketValuePo * 0.4);
        effectiveProps = ["Défaut structurel : malus de -1 à l'efficacité"];
        msg = `Échec de forgeage (${total} vs DD ${effectiveForgeDC}). La température n'était pas uniforme. La pièce présente des porosités et doit être refondue à perte.`;
      }

      // Add gem inlay effect if any
      if (selectedGemInlay !== 'none') {
        const foundGem = GEMS_LIST.find(g => g.id === selectedGemInlay);
        if (foundGem) {
          effectiveProps.push(`💎 Sertissage (${foundGem.name}) : ${foundGem.enchantmentEffect}`);
          valuePo += foundGem.basePriceCut;
        }
      }

      // Add creature component effect if any
      if (selectedCreatureComponent !== 'none') {
        effectiveProps.push(`🐉 Adjonction de Monstre (${selectedCreatureComponent}) : Propriété élémentaire infusée`);
        valuePo += 150;
      }

      craftResult = {
        roll: d20,
        total,
        dc: effectiveForgeDC,
        success,
        critSuccess,
        critFail,
        itemCreatedName: selectedRecipe.name,
        finalQuality: quality,
        effectiveValuePo: valuePo,
        effectiveProperties: effectiveProps,
        message: msg,
      };

      isHammering = false;
    }, 450);
  }
</script>

<div class="page">
  <!-- Forge Header Plaque -->
  <div class="forge-header">
    <!-- Decorative background glow -->
    <div class="bg-glow"></div>

    <div class="forge-header-inner">
      <div>
        <div class="forge-meta">
          <span class="badge">
            <span class="flame">🔥</span>
            Atelier de Ferronnerie Tellurique & Armurerie Naine
          </span>
          <span class="meta-note">Terre de Fangh & D&D 5e</span>
        </div>

        <h2 class="forge-title">
          <span class="hammer-title">🔨</span>
          La Grande Forge Légendaire
        </h2>

        <p class="forge-desc">
          Façonnez des armes en Mithril, harnois en Adamantium, épées d'Argent Alchimique et boucliers en écailles de dragon. Sertissez des gemmes arcaniques sur votre enclume et simulez vos frappes au dé.
        </p>
      </div>

      <!-- Quick tab switcher -->
      <div class="tab-switcher">
        <button
          class:active={activeTab === 'recipes'}
          class="tab-btn"
          onclick={() => (activeTab = 'recipes')}
        >
          <span>⚔️</span>
          <span>Armurerie ({FORGE_RECIPES.length})</span>
        </button>

        <button
          class:active={activeTab === 'anvil'}
          class="tab-btn"
          onclick={() => (activeTab = 'anvil')}
        >
          <span>🔨</span>
          <span>L'Enclume Active</span>
        </button>

        <button
          class:active={activeTab === 'lore'}
          class="tab-btn"
          onclick={() => (activeTab = 'lore')}
        >
          <span>🔥</span>
          <span>Traité Métallurgique</span>
        </button>
      </div>
    </div>
  </div>

  <!-- ============================================================== -->
  <!-- SECTION 1: ARMORY & RECIPE CATALOG                             -->
  <!-- ============================================================== -->
  {#if activeTab === 'recipes'}
    <div class="layout">
      <!-- Left Column: Filter & List -->
      <div class="col-left">
        <!-- Search and Filters -->
        <div class="filter-box">
          <div class="search-wrap">
            <span class="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Rechercher une arme, armure, propriété..."
              bind:value={searchQuery}
              class="search-input"
            />
          </div>

          <!-- Category pills -->
          <div class="cat-pills">
            {#each categoryPills as cat (cat.id)}
              <button
                class:active={selectedCategory === cat.id}
                class="cat-pill"
                onclick={() => (selectedCategory = cat.id)}
              >
                {cat.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Recipe Cards List -->
        <div class="recipe-list">
          {#each filteredRecipes as recipe (recipe.id)}
            {@const isSelected = selectedRecipe.id === recipe.id}
            {@const primaryMineral = MINERALS_LIST.find(m => m.id === recipe.primaryMineralId)}
            <div
              class="recipe-card"
              class:selected={isSelected}
              role="button"
              tabindex="0"
              onclick={() => (selectedRecipe = recipe)}
              onkeydown={(e) => e.key === 'Enter' && (selectedRecipe = recipe)}
            >
              <div class="recipe-info">
                <div class="recipe-name-row">
                  <span class="recipe-name">{recipe.name}</span>
                </div>

                <div class="recipe-sub">
                  <span>Métal : <strong class="metal-name">{primaryMineral?.name || recipe.primaryMineralId}</strong></span>
                  <span>·</span>
                  <span>{recipe.ingotsCount} lingot(s)</span>
                </div>

                <div class="recipe-dmg">{recipe.damageOrAC}</div>
              </div>

              <div class="recipe-right">
                <span class="recipe-price">{recipe.marketValuePo} PO</span>
                <span class="recipe-dc">DD {recipe.difficultyDC}</span>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Right Column: Detailed Recipe Sheet & Instant Forge Button -->
      <div class="recipe-sheet">
        <!-- Header of selected recipe -->
        <div class="sheet-header">
          <div>
            <span class="sheet-cat">
              {selectedRecipe.category.toUpperCase()} · PALIER {selectedRecipe.requiredForgeTier}
            </span>
            <h3 class="sheet-name">{selectedRecipe.name}</h3>
          </div>

          <div class="sheet-price-block">
            <span class="sheet-price">{selectedRecipe.marketValuePo} Pièces d'Or</span>
            <span class="sheet-weight">
              Poids : {selectedRecipe.weightKg} kg · Fabrication : {selectedRecipe.forgeTime}
            </span>
          </div>
        </div>

        <!-- Required Materials Card -->
        <div class="materials-box">
          <h4 class="materials-title">
            <span>🧱</span>
            Composants & Matériaux de Forge Requis
          </h4>

          <div class="materials-grid">
            <div class="mat-cell">
              <div>
                <span class="mat-label">Métal Primaire :</span>
                <strong class="mat-value metal">
                  {MINERALS_LIST.find(m => m.id === selectedRecipe.primaryMineralId)?.name || selectedRecipe.primaryMineralId}
                </strong>
              </div>
              <span class="mat-count">{selectedRecipe.ingotsCount} lingot(s)</span>
            </div>

            {#if selectedRecipe.creatureComponent}
              <div class="mat-cell">
                <div>
                  <span class="mat-label">Élément de Monstre :</span>
                  <strong class="mat-value creature">{selectedRecipe.creatureComponent}</strong>
                </div>
                <span class="mat-source bestiary">Bestiaire</span>
              </div>
            {/if}

            {#if selectedRecipe.gemId}
              <div class="mat-cell">
                <div>
                  <span class="mat-label">Sertissage Recommandé :</span>
                  <strong class="mat-value gem">
                    {GEMS_LIST.find(g => g.id === selectedRecipe.gemId)?.name || 'Gemme Arcanique'}
                  </strong>
                </div>
                <span class="mat-source lapidaire">Lapidaire</span>
              </div>
            {/if}

            <div class="mat-cell">
              <div>
                <span class="mat-label">Seuil de Difficulté :</span>
                <strong class="mat-value dc">DD {selectedRecipe.difficultyDC}</strong>
              </div>
              <span class="mat-note">Force + Forgeron</span>
            </div>
          </div>
        </div>

        <!-- Special Properties & Game Effects -->
        <div class="props-section">
          <h4 class="props-title">
            <span>✨</span>
            Propriétés Armurières & Effets en Jeu (D&D 5e)
          </h4>

          <div class="dmg-box">
            Efficacité : {selectedRecipe.damageOrAC}
          </div>

          <div class="props-list">
            {#each selectedRecipe.specialProperties as prop, idx (idx)}
              <div class="prop-row">
                <span class="prop-check">✓</span>
                <span>{prop}</span>
              </div>
            {/each}
          </div>
        </div>

        <!-- Description & Lore -->
        <div class="desc-section">
          <p class="desc-text">« {selectedRecipe.description} »</p>
          <div class="lore-note">
            <strong>Chronique Naine : </strong>{selectedRecipe.historicalLore}
          </div>
        </div>

        <!-- Direct Action Button: Load on Anvil -->
        <button class="forge-action" onclick={() => (activeTab = 'anvil')}>
          <span>🔨</span>
          <span>Chauffer le Métal & Forger cette Pièce sur l'Enclume</span>
        </button>
      </div>
    </div>
  {/if}

  <!-- ============================================================== -->
  <!-- SECTION 2: THE INTERACTIVE ANVIL (FORGE SIMULATOR)             -->
  <!-- ============================================================== -->
  {#if activeTab === 'anvil'}
    <div class="layout">
      <!-- Controls: Workshop Setup -->
      <div class="anvil-controls">
        <div class="anvil-head">
          <h3 class="anvil-title">
            <span>🔥</span>
            Foyer, Enclume & Paramètres de Forgeage
          </h3>
          <p class="anvil-sub">
            Pièce sélectionnée : <strong class="strong-gold">{selectedRecipe.name}</strong>
          </p>
        </div>

        <!-- 1. Furnace / Forge Tier -->
        <div class="field">
          <span class="field-label">1. Qualité du Foyer & Température</span>
          <div class="tier-grid">
            {#each forgeTiers as item (item.tier)}
              <button
                type="button"
                class:active={customTier === item.tier}
                class="tier-btn"
                onclick={() => (customTier = item.tier)}
              >
                <div class="tier-name">{item.tier}</div>
                <div class="tier-desc">{item.desc}</div>
              </button>
            {/each}
          </div>
        </div>

        <!-- 2. Quenching Method -->
        <div class="field">
          <label class="field-label" for="quenching-method">2. Méthode de Trempe Thermique</label>
          <select id="quenching-method" bind:value={quenchingMethod} class="select-input full">
            <option value="Trempe à l'Huile Alchimique (Flexibilité & Résistance)">
              🧴 Trempe à l'Huile Alchimique (Équilibre & Flexibilité)
            </option>
            <option value="Trempe à l'Eau Froide de Source (Dureté de fil maximale)">
              💧 Trempe à l'Eau de Source (Tranchant maximal / risque d'éclat)
            </option>
            <option value="Trempe au Sang de Monstre (Infusion mystique)">
              🩸 Trempe au Sang de Monstre (Infusion élémentaire mystique)
            </option>
          </select>
        </div>

        <!-- 3. Gem Inlay Option -->
        <div class="field">
          <label class="field-label" for="gem-inlay">3. Sertissage de Gemme Arcanique (Optionnel)</label>
          <select id="gem-inlay" bind:value={selectedGemInlay} class="select-input full">
            <option value="none">Aucun sertissage (Métal pur)</option>
            {#each GEMS_LIST as gem (gem.id)}
              <option value={gem.id}>
                💎 {gem.name} (+{gem.basePriceCut} PO) : {gem.enchantmentEffect}
              </option>
            {/each}
          </select>
        </div>

        <!-- 4. Monster Component Infusion -->
        <div class="field">
          <label class="field-label" for="creature-component">4. Composant de Monstre d'Adjonction (Optionnel)</label>
          <select id="creature-component" bind:value={selectedCreatureComponent} class="select-input full">
            <option value="none">Aucun composant animal</option>
            <option value="Écailles Dorsales de Dragon Vert">Écailles Dorsales de Dragon Vert (Résistance Poison/Acide)</option>
            <option value="Crinière de Loup-Garou">Crinière de Loup-Garou (Affinité Sang & Lune)</option>
            <option value="Griffe de Griffon Géant">Griffe de Griffon Géant (Perforation de cuirasses)</option>
            <option value="Venin de Basilic Cristallisé">Venin de Basilic Cristallisé (Enduit toxique persistant)</option>
          </select>
        </div>

        <!-- 5. Blacksmith Skill Bonus -->
        <div>
          <label class="bonus-label" for="blacksmith-bonus">
            Bonus d'Artisan (Force + Maîtrise Outils de Forgeron) : <strong class="strong-gold">+{blacksmithBonus}</strong>
          </label>
          <div class="bonus-row">
            <input
              id="blacksmith-bonus"
              type="range"
              min="0"
              max="15"
              bind:value={blacksmithBonus}
              class="range-input"
            />
            <span class="bonus-value">+{blacksmithBonus}</span>
          </div>
        </div>
      </div>

      <!-- Right Column: The Anvil Strike & Results -->
      <div class="col-anvil-right">
        <!-- The Big DC Plaque -->
        <div class="dc-plaque">
          <span class="dc-label">Seuil de Forge Requis sur l'Enclume</span>

          <div class="dc-circle">
            <span class="dc-value">DD {effectiveForgeDC}</span>
          </div>

          <div class="dc-details">
            <div>Base Recette : <strong>DD {selectedRecipe.difficultyDC}</strong></div>
            <div>Modificateur Foyer ({customTier.split(' ')[0]}) : <strong>{currentTierMod >= 0 ? `+${currentTierMod}` : currentTierMod}</strong></div>
          </div>
        </div>

        <!-- Hammer Strike Controls -->
        <div class="strike-card">
          <div class="strike-header">
            <h4 class="tool-title">
              <span>🔨</span>
              Martelage & Trempe
            </h4>

            <div class="dice-mode">
              <button
                type="button"
                class:active={forgeDiceMode === 'virtual'}
                class="mode-btn"
                onclick={() => (forgeDiceMode = 'virtual')}
              >
                Dé Virtuel
              </button>
              <button
                type="button"
                class:active={forgeDiceMode === 'manual'}
                class="mode-btn"
                onclick={() => (forgeDiceMode = 'manual')}
              >
                Jet Manuel
              </button>
            </div>
          </div>

          {#if forgeDiceMode === 'manual'}
            <div class="tool-body">
              <div class="manual-row">
                <label class="lbl" for="manual-d20">Résultat dé réel (1-20) :</label>
                <input
                  id="manual-d20"
                  type="number"
                  min="1"
                  max="20"
                  bind:value={manualD20}
                  class="num-input gold"
                />
              </div>

              <button
                class="forge-action"
                onclick={() => handleStrikeAnvil(manualD20)}
                disabled={isHammering}
              >
                <span class:hammer-anim-bounce={isHammering}>🔨</span>
                <span>Valider ma Frappe ({manualD20}) vs DD {effectiveForgeDC}</span>
              </button>
            </div>
          {:else}
            <button
              class="forge-action big"
              onclick={() => handleStrikeAnvil()}
              disabled={isHammering}
            >
              <span class:hammer-anim-spin={isHammering}>🔨</span>
              <span>{isHammering ? "Martelage de l'enclume..." : `Battre le Métal (d20 + ${blacksmithBonus})`}</span>
            </button>
          {/if}

          <!-- Crafting Outcome Card -->
          {#if craftResult}
            <div
              class="craft-result"
              class:crit={craftResult.critSuccess}
              class:success={!craftResult.critSuccess && craftResult.success}
              class:critfail={craftResult.critFail}
              class:fail={!craftResult.critSuccess && !craftResult.success && !craftResult.critFail}
            >
              <div class="craft-top">
                <span>d20:{craftResult.roll} + {blacksmithBonus} = {craftResult.total} (DD {craftResult.dc})</span>
                <span>{craftResult.finalQuality}</span>
              </div>

              <p class="craft-message">{craftResult.message}</p>

              {#if craftResult.success}
                <div class="craft-success-block">
                  <div class="craft-value-row">
                    <span>Valeur Marchande Finale :</span>
                    <span class="craft-value">{craftResult.effectiveValuePo} PO</span>
                  </div>
                  <div class="craft-props">
                    <strong class="craft-props-title">Propriétés Actives :</strong>
                    {#each craftResult.effectiveProperties as p, i (i)}
                      <div class="craft-prop">{p}</div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- ============================================================== -->
  <!-- SECTION 3: DWARVEN METALLURGY LORE                             -->
  <!-- ============================================================== -->
  {#if activeTab === 'lore'}
    <div class="lore-page">
      <div class="lore-head">
        <h3 class="lore-title">
          <span>🔥</span>
          {FORGE_RULES_LORE.title}
        </h3>
        <p class="lore-overview">{FORGE_RULES_LORE.overview}</p>
      </div>

      <!-- Tier table -->
      <div class="lore-section">
        <h4 class="lore-section-title">
          Les 4 Paliers de Foyers de Forge & Combustibles Nains
        </h4>
        <div class="tier-cards">
          {#each FORGE_RULES_LORE.tierDescriptions as tier, idx (idx)}
            <div class="tier-card">
              <div class="tier-card-head">
                <strong class="tier-card-name">{tier.tier}</strong>
                <span class="tier-card-temp">{tier.temp}</span>
              </div>
              <div class="tier-card-body">
                <div><span class="tier-lbl">Outillage : </span>{tier.tools}</div>
                <div><span class="tier-lbl">Métaux usinables : </span><strong class="metal-name">{tier.items}</strong></div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Quenching lore -->
      <div class="lore-section separated">
        <h4 class="lore-section-title">Secrets de Trempe Thermique</h4>
        <div class="quench-cards">
          {#each FORGE_RULES_LORE.quenchingMethods as q, idx (idx)}
            <div class="quench-card">
              <strong class="quench-name">{q.method}</strong>
              <p class="quench-effect">{q.effect}</p>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 80rem;
    margin: 0 auto;
    padding: 2rem 1rem;
    font-family: Georgia, 'Times New Roman', serif;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    animation: fade-in 0.3s ease;
  }
  @media (min-width: 640px) {
    .page { padding: 2rem 1.5rem; }
  }

  .forge-header {
    background: #1f1612;
    border-radius: 0.75rem;
    border: 2px solid rgba(212, 175, 55, 0.8);
    padding: 1.5rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    position: relative;
    overflow: hidden;
  }
  @media (min-width: 640px) {
    .forge-header { padding: 1.75rem; }
  }

  .bg-glow {
    position: absolute;
    right: -3rem;
    top: -3rem;
    width: 16rem;
    height: 16rem;
    background: rgba(249, 115, 22, 0.1);
    border-radius: 9999px;
    filter: blur(3rem);
    pointer-events: none;
  }

  .forge-header-inner {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    position: relative;
    z-index: 1;
  }
  @media (min-width: 1024px) {
    .forge-header-inner {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
  }

  .forge-meta { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.375rem; }

  .badge {
    font-size: 10px;
    padding: 0.125rem 0.625rem;
    border-radius: 0.25rem;
    background: #451a03;
    color: #fcd34d;
    border: 1px solid rgba(217, 119, 6, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-family: ui-monospace, 'Courier New', monospace;
    font-weight: bold;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  .flame { animation: pulse 2s infinite; }

  .meta-note { font-size: 12px; color: #a89988; }

  .forge-title {
    font-size: 1.875rem;
    font-weight: 800;
    color: #fef08a;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0;
  }
  @media (min-width: 640px) {
    .forge-title { font-size: 2.25rem; }
  }
  .hammer-title { font-size: 2.25rem; }

  .forge-desc {
    font-size: 12px;
    color: #c4b5a5;
    font-style: italic;
    margin: 0.375rem 0 0;
    max-width: 48rem;
    line-height: 1.625;
  }
  @media (min-width: 640px) {
    .forge-desc { font-size: 14px; }
  }

  .tab-switcher {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    background: #120e0b;
    padding: 0.375rem;
    border-radius: 0.75rem;
    border: 1px solid #3e2e23;
    flex-shrink: 0;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    border-radius: 0.5rem;
    font-size: 12px;
    font-weight: bold;
    font-family: Georgia, 'Times New Roman', serif;
    cursor: pointer;
    background: transparent;
    border: none;
    color: #d7c9b8;
    transition: var(--transition-fast, 0.15s);
  }
  .tab-btn:hover { background: #241a14; }
  .tab-btn.active {
    background: #b45309;
    color: #ffffff;
    box-shadow: 0 0 0 1px #fde047, 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  @media (min-width: 1024px) {
    .layout { grid-template-columns: repeat(12, 1fr); }
    .col-left { grid-column: span 5; }
    .recipe-sheet { grid-column: span 7; }
    .anvil-controls { grid-column: span 7; }
    .col-anvil-right { grid-column: span 5; }
  }

  .col-left { display: flex; flex-direction: column; gap: 1rem; }

  .filter-box {
    background: #1c1511;
    padding: 1rem;
    border-radius: 0.75rem;
    border: 1px solid #3e2e23;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
  }

  .search-wrap { position: relative; }
  .search-icon { position: absolute; left: 0.75rem; top: 0.75rem; }

  .search-input {
    width: 100%;
    padding: 0.5rem 0.75rem 0.5rem 2.25rem;
    background: #120e0b;
    border: 1px solid #4a392d;
    border-radius: 0.5rem;
    font-size: 12px;
    color: #f5ecd7;
    font-family: Georgia, 'Times New Roman', serif;
    box-sizing: border-box;
  }
  .search-input:focus { outline: none; border-color: #d4af37; }

  .cat-pills { display: flex; flex-wrap: wrap; gap: 0.375rem; }

  .cat-pill {
    padding: 0.25rem 0.625rem;
    border-radius: 0.25rem;
    font-size: 11px;
    font-weight: bold;
    font-family: Georgia, 'Times New Roman', serif;
    cursor: pointer;
    background: #120e0b;
    color: #c4b5a5;
    border: 1px solid #3e2e23;
    transition: var(--transition-fast, 0.15s);
  }
  .cat-pill:hover { background: #241a14; }
  .cat-pill.active {
    background: #854d0e;
    color: #ffffff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .recipe-list {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    max-height: 620px;
    overflow-y: auto;
    padding-right: 0.25rem;
  }

  .recipe-card {
    padding: 0.875rem;
    border-radius: 0.75rem;
    border: 1px solid #3e2e23;
    cursor: pointer;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    background: #181310;
    transition: var(--transition-fast, 0.15s);
  }
  .recipe-card:hover { border-color: #854d0e; }
  .recipe-card.selected {
    background: #3b271a;
    border-color: #d4af37;
    box-shadow: 0 0 0 1px #d4af37, 0 10px 15px -3px rgba(0, 0, 0, 0.3);
  }

  .recipe-info { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }

  .recipe-name-row { display: flex; align-items: center; gap: 0.5rem; }

  .recipe-name {
    font-weight: bold;
    font-size: 14px;
    color: #fef08a;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .recipe-sub {
    font-size: 11px;
    color: #a89988;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .metal-name { color: #38bdf8; }

  .recipe-dmg {
    font-size: 10px;
    color: #4ade80;
    font-family: ui-monospace, 'Courier New', monospace;
  }

  .recipe-right { text-align: right; flex-shrink: 0; }

  .recipe-price {
    font-size: 12px;
    font-family: ui-monospace, 'Courier New', monospace;
    font-weight: bold;
    color: #fde047;
    display: block;
  }

  .recipe-dc {
    font-size: 10px;
    font-family: ui-monospace, 'Courier New', monospace;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    background: #120e0b;
    color: #cbd5e1;
    border: 1px solid #3e2e23;
    display: inline-block;
    margin-top: 0.25rem;
  }

  .recipe-sheet {
    background: #1c1612;
    padding: 1.5rem;
    border-radius: 0.75rem;
    border: 1px solid #4a3b32;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
  }
  @media (min-width: 640px) {
    .recipe-sheet { padding: 1.75rem; }
  }

  .sheet-header {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    border-bottom: 1px solid #3e2e23;
    padding-bottom: 1rem;
  }
  @media (min-width: 640px) {
    .sheet-header { flex-direction: row; align-items: center; justify-content: space-between; }
  }

  .sheet-cat {
    font-size: 10px;
    text-transform: uppercase;
    font-family: ui-monospace, 'Courier New', monospace;
    font-weight: bold;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: #451a03;
    color: #fcd34d;
    border: 1px solid rgba(217, 119, 6, 0.5);
  }

  .sheet-name { font-size: 1.5rem; font-weight: bold; color: #fef08a; margin: 0.375rem 0 0; }

  .sheet-price-block { text-align: left; }
  @media (min-width: 640px) {
    .sheet-price-block { text-align: right; }
  }

  .sheet-price {
    font-size: 1.25rem;
    font-family: ui-monospace, 'Courier New', monospace;
    font-weight: 800;
    color: #fde047;
    display: block;
  }

  .sheet-weight { font-size: 11px; color: #a89988; }

  .materials-box {
    background: #140f0c;
    padding: 1rem;
    border-radius: 0.75rem;
    border: 1px solid #3e2e23;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .materials-title {
    font-size: 12px;
    font-weight: bold;
    color: #fde047;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
  }

  .materials-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
    font-size: 12px;
  }
  @media (min-width: 640px) {
    .materials-grid { grid-template-columns: 1fr 1fr; }
  }

  .mat-cell {
    padding: 0.625rem;
    border-radius: 0.5rem;
    background: #1f1612;
    border: 1px solid #3e2e23;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .mat-label { color: #a89988; display: block; font-size: 10px; }

  .mat-value.metal { color: #38bdf8; font-size: 14px; }
  .mat-value.creature { color: #f87171; font-size: 12px; }
  .mat-value.gem { color: #fde047; font-size: 12px; }
  .mat-value.dc {
    color: #fde047;
    font-size: 14px;
    font-family: ui-monospace, 'Courier New', monospace;
  }

  .mat-count {
    font-size: 12px;
    font-family: ui-monospace, 'Courier New', monospace;
    font-weight: bold;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    background: #2b1f17;
    color: #fde047;
    border: 1px solid #524136;
    flex-shrink: 0;
  }

  .mat-source {
    font-size: 10px;
    font-family: ui-monospace, 'Courier New', monospace;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    flex-shrink: 0;
  }
  .mat-source.bestiary { background: #450a0a; color: #fca5a5; }
  .mat-source.lapidaire { background: #3b271a; color: #fde047; }

  .mat-note { font-size: 10px; color: #c4b5a5; flex-shrink: 0; }

  .props-section { display: flex; flex-direction: column; gap: 0.75rem; }

  .props-title {
    font-size: 12px;
    font-weight: bold;
    color: #fde047;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
  }

  .dmg-box {
    background: #241a14;
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid #523d2e;
    font-family: ui-monospace, 'Courier New', monospace;
    font-size: 14px;
    font-weight: bold;
    color: #4ade80;
  }

  .props-list { display: flex; flex-direction: column; gap: 0.5rem; }

  .prop-row {
    padding: 0.625rem;
    border-radius: 0.5rem;
    background: #181310;
    border: 1px solid #3e2e23;
    font-size: 12px;
    color: #e6d8c3;
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
  }

  .prop-check { color: #d4af37; flex-shrink: 0; margin-top: 0.125rem; font-weight: bold; }

  .desc-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-size: 12px;
    color: #c4b5a5;
    line-height: 1.625;
    padding-top: 0.5rem;
    border-top: 1px solid #3e2e23;
  }

  .desc-text { font-style: italic; color: #e6d8c3; margin: 0; }

  .lore-note {
    background: #140f0c;
    padding: 0.75rem;
    border-radius: 0.25rem;
    border: 1px solid #2e2118;
    font-size: 11px;
    color: #a89988;
  }

  .forge-action {
    width: 100%;
    padding: 0.75rem;
    background: #b45309;
    color: #ffffff;
    font-weight: bold;
    font-size: 14px;
    font-family: Georgia, 'Times New Roman', serif;
    border: none;
    border-radius: 0.75rem;
    cursor: pointer;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: var(--transition-fast, 0.15s);
  }
  .forge-action.big { padding: 0.875rem; }
  .forge-action:hover { background: #d97706; }
  .forge-action:disabled { opacity: 0.5; cursor: default; }

  .anvil-controls {
    background: #1c1612;
    padding: 1.5rem;
    border-radius: 0.75rem;
    border: 1px solid #4a3b32;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
  }
  @media (min-width: 640px) {
    .anvil-controls { padding: 1.75rem; }
  }

  .anvil-head { border-bottom: 1px solid #3e2e23; padding-bottom: 0.75rem; }

  .anvil-title {
    font-size: 1.25rem;
    font-weight: bold;
    color: #fde047;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
  }

  .anvil-sub {
    font-size: 12px;
    color: #a89988;
    font-style: italic;
    margin: 0.125rem 0 0;
  }
  .strong-gold { color: #fef08a; }

  .field { display: flex; flex-direction: column; gap: 0.5rem; }

  .field-label {
    display: block;
    font-size: 12px;
    font-weight: bold;
    color: #fef08a;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .tier-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .tier-btn {
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid #3e2e23;
    text-align: left;
    cursor: pointer;
    background: #140f0c;
    color: #c4b5a5;
    font-family: Georgia, 'Times New Roman', serif;
    transition: var(--transition-fast, 0.15s);
  }
  .tier-btn:hover { background: #261d17; }
  .tier-btn.active {
    background: #3b271a;
    border-color: #d4af37;
    box-shadow: 0 0 0 1px #d4af37;
    color: #fef08a;
  }

  .tier-name { font-weight: bold; font-size: 12px; }
  .tier-desc { font-size: 10px; color: #a89988; margin-top: 0.125rem; }

  .select-input {
    background: #120e0b;
    border: 1px solid #524136;
    border-radius: 0.5rem;
    padding: 0.625rem;
    font-size: 12px;
    color: #f5ecd7;
    font-family: Georgia, 'Times New Roman', serif;
  }
  .select-input.full { width: 100%; }
  .select-input:focus { outline: none; border-color: #d4af37; }

  .bonus-label {
    display: block;
    font-size: 12px;
    font-weight: bold;
    color: #a89988;
    margin-bottom: 0.25rem;
  }

  .bonus-row { display: flex; align-items: center; gap: 0.75rem; }

  .range-input { flex: 1; accent-color: #d4af37; }

  .bonus-value {
    font-family: ui-monospace, 'Courier New', monospace;
    font-weight: bold;
    color: #fde047;
    width: 2rem;
    text-align: right;
  }

  .col-anvil-right { display: flex; flex-direction: column; gap: 1.5rem; }

  .dc-plaque {
    background: #241a12;
    border-radius: 0.75rem;
    border: 2px solid #d4af37;
    padding: 1.5rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
  }

  .dc-label {
    font-size: 10px;
    text-transform: uppercase;
    font-weight: bold;
    letter-spacing: 0.1em;
    color: #fcd34d;
    display: block;
  }

  .dc-circle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 7rem;
    height: 7rem;
    border-radius: 9999px;
    background: #181310;
    border: 4px solid #fde047;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
  }

  .dc-value {
    font-size: 2.25rem;
    font-family: ui-monospace, 'Courier New', monospace;
    font-weight: 800;
    color: #fde047;
  }

  .dc-details {
    font-size: 12px;
    color: #a89988;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-family: ui-monospace, 'Courier New', monospace;
  }

  .strike-card {
    background: #1c1612;
    padding: 1.5rem;
    border-radius: 0.75rem;
    border: 1px solid #4a3b32;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
  }

  .strike-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #3e2e23;
    padding-bottom: 0.5rem;
    flex-wrap: wrap;
    gap: 0.5rem;
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
    background: #140f0c;
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

  .tool-body { display: flex; flex-direction: column; gap: 0.75rem; font-size: 12px; }

  .manual-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    gap: 0.5rem;
  }

  .lbl { color: #a89988; }

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

  .hammer-anim-bounce { display: inline-block; animation: bounce 1s infinite; }
  .hammer-anim-spin { display: inline-block; animation: spin 1s linear infinite; }

  .craft-result {
    padding: 1rem;
    border-radius: 0.75rem;
    border: 1px solid;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    transition: var(--transition-fast, 0.15s);
    animation: fade-in 0.3s ease;
  }
  .craft-result.crit { background: rgba(20, 83, 45, 0.4); border-color: #22c55e; color: #86efac; }
  .craft-result.success { background: rgba(30, 58, 95, 0.4); border-color: #38bdf8; color: #bae6fd; }
  .craft-result.critfail { background: rgba(69, 10, 10, 0.5); border-color: #ef4444; color: #fca5a5; }
  .craft-result.fail { background: rgba(59, 39, 26, 0.5); border-color: #f59e0b; color: #fde047; }

  .craft-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: ui-monospace, 'Courier New', monospace;
    font-weight: bold;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    padding-bottom: 0.375rem;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .craft-message { line-height: 1.625; font-size: 12px; margin: 0; }

  .craft-success-block {
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .craft-value-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: bold;
  }

  .craft-value {
    font-family: ui-monospace, 'Courier New', monospace;
    color: #fde047;
    font-size: 14px;
  }

  .craft-props { display: flex; flex-direction: column; gap: 0.25rem; }
  .craft-props-title { display: block; font-size: 11px; }

  .craft-prop {
    font-size: 11px;
    padding-left: 0.5rem;
    border-left: 1px solid rgba(255, 255, 255, 0.4);
  }

  .lore-page {
    background: #1c1612;
    padding: 1.5rem;
    border-radius: 0.75rem;
    border: 1px solid #4a3b32;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
  }
  @media (min-width: 640px) {
    .lore-page { padding: 2rem; }
  }

  .lore-head { border-bottom: 1px solid #3e2e23; padding-bottom: 1rem; }

  .lore-title {
    font-size: 1.5rem;
    font-weight: bold;
    color: #fde047;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    margin: 0;
  }

  .lore-overview {
    font-size: 12px;
    color: #c4b5a5;
    font-style: italic;
    margin: 0.25rem 0 0;
    line-height: 1.625;
  }
  @media (min-width: 640px) {
    .lore-overview { font-size: 14px; }
  }

  .lore-section { display: flex; flex-direction: column; gap: 0.75rem; }
  .lore-section.separated { padding-top: 0.5rem; border-top: 1px solid #3e2e23; }

  .lore-section-title {
    font-weight: bold;
    font-size: 14px;
    color: #fef08a;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }

  .tier-cards {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  @media (min-width: 768px) {
    .tier-cards { grid-template-columns: 1fr 1fr; }
  }

  .tier-card {
    background: #241c16;
    padding: 1rem;
    border-radius: 0.75rem;
    border: 1px solid #4d3a2e;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .tier-card-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #3e2e23;
    padding-bottom: 0.375rem;
  }

  .tier-card-name { font-size: 14px; color: #fde047; }

  .tier-card-temp {
    font-family: ui-monospace, 'Courier New', monospace;
    font-size: 12px;
    font-weight: bold;
    color: #f97316;
  }

  .tier-card-body {
    font-size: 12px;
    color: #d7c9b8;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .tier-lbl { color: #a89988; }

  .quench-cards {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  @media (min-width: 768px) {
    .quench-cards { grid-template-columns: repeat(3, 1fr); }
  }

  .quench-card {
    padding: 1rem;
    border-radius: 0.75rem;
    background: #140f0c;
    border: 1px solid #3e2e23;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 12px;
  }

  .quench-name { color: #fde047; display: block; font-size: 12px; }
  .quench-effect { color: #c4b5a5; margin: 0; }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-25%); }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
