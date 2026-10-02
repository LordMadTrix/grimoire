<script lang="ts">
  import type { AlchemicalRecipe, Plant } from '$lib/herboriste/types/herb';
  import RandomPotionTableGenerator from './RandomPotionTableGenerator.svelte';
  import AdvancedAlchemicalLab from './AdvancedAlchemicalLab.svelte';

  interface AlchemicalWorkshopProps {
    recipes: AlchemicalRecipe[];
    plants: Plant[];
    onSelectPlant: (plant: Plant) => void;
    onNavigateToPoisons?: () => void;
  }

  let { recipes, plants, onSelectPlant, onNavigateToPoisons }: AlchemicalWorkshopProps = $props();

  type SubTab = 'recettes' | 'atelier_avance' | 'table_aleatoire';

  let subTab = $state<SubTab>('atelier_avance');
  let selectedCategory = $state<string>('all');
  let activeRecipe = $state<AlchemicalRecipe>(recipes[0]);
  let alchemistBonus = $state<number>(5);
  let brewResult = $state<{
    roll: number;
    total: number;
    success: boolean;
    critSuccess?: boolean;
    critFail?: boolean;
  } | null>(null);

  const filteredRecipes = $derived(
    selectedCategory === 'all' ? recipes : recipes.filter(r => r.category === selectedCategory)
  );

  function handleBrewAttempt() {
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + alchemistBonus;
    const success = d20 === 20 || (d20 !== 1 && total >= activeRecipe.difficultyDC);

    brewResult = {
      roll: d20,
      total,
      success,
      critSuccess: d20 === 20,
      critFail: d20 === 1,
    };
  }
</script>

<div class="workshop">
  <!-- Page Title -->
  <div class="page-head">
    <div>
      <h2 class="page-title">⚗️ Atelier d'Alchimie & de Concoction</h2>
      <p class="page-sub">
        Transformez vos herbes sauvages en potions miraculeuses, baumes protecteurs et poisons subtils
      </p>
    </div>

    <!-- Sub-tab switcher -->
    <div class="subtabs">
      <button
        onclick={() => subTab = 'atelier_avance'}
        class="subtab"
        class:active-advanced={subTab === 'atelier_avance'}
      >
        <span class="pulse">✨</span>
        <span>Atelier d'Alchimie Avancé (Plantes & Minéraux)</span>
      </button>

      <button
        onclick={() => subTab = 'recettes'}
        class="subtab"
        class:active={subTab === 'recettes'}
      >
        <span>📖</span>
        <span>Recettes Officielles ({recipes.length})</span>
      </button>

      <button
        onclick={() => subTab = 'table_aleatoire'}
        class="subtab"
        class:active={subTab === 'table_aleatoire'}
      >
        <span>🪄</span>
        <span>Table d'Effets Aléatoires</span>
      </button>

      {#if onNavigateToPoisons}
        <button onclick={onNavigateToPoisons} class="subtab poisons-link">
          <span>💀</span>
          <span>Compendium des Poisons</span>
        </button>
      {/if}
    </div>
  </div>

  {#if subTab === 'atelier_avance'}
    <AdvancedAlchemicalLab {plants} {onSelectPlant} />
  {:else if subTab === 'table_aleatoire'}
    <RandomPotionTableGenerator {plants} />
  {:else}
    <!-- Main Grid: Left Recipes list, Right Brewing Station -->
    <div class="main-grid">
      <!-- Left Column: Recipes Catalogue -->
      <div class="recipes-col">
        <!-- Categories Tab -->
        <div class="categories">
          {#each ['all', 'potion', 'onguent', 'poison', 'teinture'] as cat (cat)}
            <button
              onclick={() => selectedCategory = cat}
              class="category-btn"
              class:active={selectedCategory === cat}
            >
              {cat === 'all' ? 'Toutes les Concoctions' : cat + 's'}
            </button>
          {/each}
        </div>

        <!-- Recipe Cards List -->
        <div class="recipe-list">
          {#each filteredRecipes as rec (rec.id)}
            {@const isSelected = activeRecipe.id === rec.id}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div
              onclick={() => { activeRecipe = rec; brewResult = null; }}
              class="recipe-card"
              class:selected={isSelected}
            >
              <div class="recipe-card-head">
                <div>
                  <div class="recipe-title-row">
                    <h4 class="recipe-name">{rec.name}</h4>
                    <span class="recipe-cat">{rec.category}</span>
                  </div>
                  <div class="recipe-meta">
                    DD Alchimie : <strong>DD {rec.difficultyDC}</strong> · Durée : {rec.brewingTime}
                  </div>
                </div>
                <span class="recipe-price">{rec.marketPrice}</span>
              </div>

              <p class="recipe-effect">{rec.effect}</p>

              <div class="recipe-ings">
                <span class="ings-label">Ingrédients :</span>
                {#each rec.ingredients as ing, idx (idx)}
                  <span class="ing-chip">{ing.quantity}x {ing.plantName}</span>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Right Column: Interactive Brewing Crucible / Alambic -->
      <div class="crucible-col">
        <div class="crucible">
          <div class="crucible-head">
            <span class="crucible-tag">Creuset & Alambic d'Herboriste</span>
            <h3 class="crucible-name">{activeRecipe.name}</h3>
          </div>

          <!-- Ingredients Check list -->
          <div class="crucible-box">
            <span class="crucible-box-title">Formule & Matières Premières</span>
            <ul>
              {#each activeRecipe.ingredients as ing, i (i)}
                {@const targetPlant = plants.find(p => p.id === ing.plantId)}
                <li class="crucible-ing">
                  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                  <span
                    class="crucible-ing-name"
                    onclick={() => targetPlant && onSelectPlant(targetPlant)}
                  >
                    • {ing.quantity}x {ing.plantName} ({ing.part})
                  </span>
                  <span class="crucible-ing-req">Requis</span>
                </li>
              {/each}
              {#each activeRecipe.additionalComponents as comp, i (i)}
                <li class="crucible-compo">+ {comp}</li>
              {/each}
            </ul>
          </div>

          <!-- Effect in detail -->
          <div class="crucible-effect">
            <span class="crucible-effect-title">Propriétés de la Concoction :</span>
            <p>{activeRecipe.effect}</p>
            <div class="crucible-effect-foot">
              <span>Conservation : {activeRecipe.shelfLife}</span>
              <span>Prix estimé : {activeRecipe.marketPrice}</span>
            </div>
          </div>

          <!-- Simulation controls -->
          <div class="crucible-controls">
            <div class="bonus-row">
              <label for="workshop-bonus">Bonus d'Alchimiste / Outils (Int + Maîtrise) :</label>
              <input
                id="workshop-bonus"
                type="number"
                min="0"
                max="15"
                bind:value={alchemistBonus}
                class="bonus-input"
              />
            </div>

            <button onclick={handleBrewAttempt} class="brew-btn">
              🎲 <span>Tenter la Concoction (DD {activeRecipe.difficultyDC})</span>
            </button>
          </div>

          <!-- Result card if rolled -->
          {#if brewResult}
            <div class="brew-result" class:success={brewResult.success} class:fail={!brewResult.success}>
              <div class="brew-result-head">
                {#if brewResult.success}
                  <span>✓ {brewResult.critSuccess ? 'Réussite Critique Légendaire !' : 'Concoction Réussie !'}</span>
                {:else}
                  <span>✕ {brewResult.critFail ? 'Échec Critique : Le chaudron explose !' : 'Échec de la Concoction'}</span>
                {/if}
              </div>
              <p>
                Jet : <strong>1d20 ({brewResult.roll})</strong> + bonus ({alchemistBonus}) ={' '}
                <strong>{brewResult.total}</strong> contre DD {activeRecipe.difficultyDC}.
              </p>
              <p class="brew-result-flavor">
                {brewResult.success
                  ? `Vous obtenez 1 fiole de ${activeRecipe.name} d'une pureté parfaite.`
                  : 'Les réactifs se sont troublés et ont perdu leurs propriétés curatives.'}
              </p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .workshop {
    max-width: 1280px;
    margin: 0 auto;
    padding: 24px 16px;
  }

  /* Page head */
  .page-head {
    margin-bottom: 24px;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
  }
  .page-title {
    font-size: 28px;
    font-family: serif;
    font-weight: bold;
    color: var(--accent);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .page-sub {
    font-size: 13px;
    color: var(--text-muted);
    font-style: italic;
    font-family: serif;
    margin: 4px 0 0;
  }

  /* Sub-tabs */
  .subtabs {
    display: flex;
    background: var(--bg-secondary);
    padding: 4px;
    border-radius: 12px;
    border: 1px solid var(--border);
    box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.3);
    gap: 4px;
    flex-wrap: wrap;
  }
  .subtab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-family: serif;
    color: var(--text-secondary);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: var(--transition-fast);
  }
  .subtab:hover { color: var(--text-primary); background: var(--bg-hover); }
  .subtab.active {
    background: #b45309;
    color: white;
    font-weight: bold;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  }
  .subtab.active-advanced {
    background: #854d0e;
    color: white;
    font-weight: bold;
    box-shadow: 0 0 0 1px var(--accent), 0 2px 6px rgba(0, 0, 0, 0.3);
  }
  .subtab.poisons-link {
    color: #fca5a5;
    border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent);
  }
  .subtab.poisons-link:hover { background: #381414; color: #fca5a5; }
  .pulse { display: inline-block; animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

  /* Main grid */
  .main-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 32px;
  }
  @media (min-width: 1024px) {
    .main-grid { grid-template-columns: 7fr 5fr; }
  }
  .recipes-col { display: flex; flex-direction: column; gap: 16px; }

  /* Categories */
  .categories { display: flex; gap: 8px; flex-wrap: wrap; }
  .category-btn {
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-family: serif;
    text-transform: capitalize;
    cursor: pointer;
    transition: var(--transition-fast);
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    border: 1px solid var(--border);
  }
  .category-btn:hover { background: var(--bg-hover); }
  .category-btn.active {
    background: var(--accent);
    color: var(--bg-primary);
    font-weight: bold;
    border-color: var(--accent);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  }

  /* Recipe cards */
  .recipe-list { display: flex; flex-direction: column; gap: 12px; }
  .recipe-card {
    padding: 16px;
    border-radius: 12px;
    border: 2px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: pointer;
    transition: var(--transition-fast);
  }
  .recipe-card:hover { border-color: #854d0e; }
  .recipe-card.selected {
    background: #3b271b;
    border-color: var(--accent);
    color: var(--text-primary);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
  }
  .recipe-card-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 8px;
  }
  .recipe-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .recipe-name {
    font-family: serif;
    font-weight: bold;
    font-size: 16px;
    color: var(--accent);
    margin: 0;
  }
  .recipe-cat {
    font-size: 10px;
    text-transform: uppercase;
    font-family: monospace;
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-secondary);
    border: 1px solid var(--border);
  }
  .recipe-meta {
    font-size: 12px;
    color: var(--text-muted);
    font-family: serif;
    margin-top: 2px;
  }
  .recipe-meta strong { color: var(--accent); }
  .recipe-price {
    font-family: monospace;
    font-size: 12px;
    font-weight: bold;
    color: var(--accent);
    background: var(--bg-primary);
    padding: 4px 10px;
    border-radius: 4px;
    border: 1px solid var(--border);
    flex-shrink: 0;
  }
  .recipe-effect {
    font-size: 12px;
    font-family: serif;
    color: var(--text-secondary);
    margin: 0 0 8px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .recipe-ings {
    font-size: 11px;
    font-family: serif;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    color: var(--text-muted);
  }
  .ings-label { color: var(--text-muted); }
  .ing-chip {
    background: var(--bg-primary);
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid var(--border-subtle);
    color: var(--accent);
  }

  /* Crucible (parchment panel) */
  .crucible-col { position: relative; }
  .crucible {
    background: #f7f2e7;
    color: #2c1810;
    border-radius: 12px;
    border: 4px solid #5c3e29;
    padding: 24px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
    position: sticky;
    top: 24px;
    font-family: serif;
  }
  .crucible-head {
    text-align: center;
    border-bottom: 2px solid rgba(133, 77, 14, 0.3);
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  .crucible-tag {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #854d0e;
    font-weight: bold;
  }
  .crucible-name {
    font-size: 24px;
    font-weight: bold;
    color: #3a1d0f;
    margin: 4px 0 0;
  }
  .crucible-box {
    background: #efe8d8;
    border-radius: 8px;
    border: 1px solid #c4a47c;
    padding: 12px;
    font-size: 12px;
    margin-bottom: 16px;
  }
  .crucible-box-title {
    font-weight: bold;
    color: #78350f;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-size: 10px;
    display: block;
    margin-bottom: 4px;
  }
  .crucible-box ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .crucible-ing {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .crucible-ing-name {
    color: #451a03;
    font-weight: 600;
    cursor: pointer;
  }
  .crucible-ing-name:hover { text-decoration: underline; }
  .crucible-ing-req { font-size: 10px; color: #78350f; font-style: italic; }
  .crucible-compo { color: #6b4c35; font-style: italic; }
  .crucible-effect {
    background: #f4ecd8;
    padding: 12px;
    border-radius: 6px;
    border: 1px solid #dfd0bd;
    font-size: 12px;
    margin-bottom: 16px;
  }
  .crucible-effect-title {
    font-weight: bold;
    color: #78350f;
    display: block;
    margin-bottom: 2px;
  }
  .crucible-effect p { margin: 0; color: #3b271d; }
  .crucible-effect-foot {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #dfd0bd;
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #78350f;
  }
  .crucible-controls {
    border-top: 1px solid #c4a47c;
    padding-top: 16px;
    margin-bottom: 16px;
  }
  .bonus-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    margin-bottom: 12px;
  }
  .bonus-row label { color: #78350f; font-weight: 600; }
  .bonus-input {
    width: 56px;
    background: white;
    border: 1px solid #c4a47c;
    border-radius: 6px;
    padding: 4px 8px;
    text-align: center;
    font-family: monospace;
    font-weight: bold;
    color: #451a03;
    outline: none;
  }
  .brew-btn {
    width: 100%;
    padding: 10px;
    background: #78350f;
    color: #fef08a;
    font-family: serif;
    font-weight: bold;
    font-size: 14px;
    border: none;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: var(--transition-fast);
  }
  .brew-btn:hover { background: #8e3f13; }
  .brew-result {
    padding: 12px;
    border-radius: 8px;
    border: 1px solid;
    font-size: 12px;
    animation: fadeIn 0.3s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .brew-result.success {
    background: #dcfce7;
    border-color: #86efac;
    color: #14532d;
  }
  .brew-result.fail {
    background: #fee2e2;
    border-color: #fca5a5;
    color: #7f1d1d;
  }
  .brew-result-head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: bold;
    margin-bottom: 4px;
  }
  .brew-result p { margin: 0; }
  .brew-result-flavor {
    margin-top: 4px !important;
    font-size: 11px;
    font-style: italic;
  }
</style>
