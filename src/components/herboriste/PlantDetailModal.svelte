<script lang="ts">
  import type { AlchemicalRecipe } from '$lib/herboriste/types/herb';
  import { BIOMES_METADATA, RARITY_METADATA } from '$lib/herboriste/data/herbalistData';
  import BotanicalIllustration from './BotanicalIllustration.svelte';
  import { herboristeStore } from '$lib/herboriste/store.svelte';

  let {
    recipes,
    onSelectRecipe,
  }: {
    recipes: AlchemicalRecipe[];
    onSelectRecipe?: (recipe: AlchemicalRecipe) => void;
  } = $props();

  const plant = $derived(herboristeStore.selectedPlant);

  const isFavorite = $derived(
    plant ? herboristeStore.favoritePlantIds.includes(plant.id) : false
  );

  const associatedRecipes = $derived(
    plant
      ? recipes.filter((r) =>
          r.ingredients.some((ing) => ing.plantId === plant.id || ing.plantName === plant.name)
        )
      : []
  );

  function close() {
    herboristeStore.selectedPlant = null;
  }
</script>

{#if plant}
  {@const biomeInfo = BIOMES_METADATA[plant.biome]}
  {@const rarityInfo = RARITY_METADATA[plant.rarity]}
  <div class="modal-overlay">
    <div class="modal-panel">
      <!-- Top Action Buttons (Favorite + Handout + Close) -->
      <div class="top-actions">
        <button
          type="button"
          onclick={() => herboristeStore.openShareModal('plant', plant)}
          title="Projeter sur Vue Joueur / Diffuser aux Mobiles"
          class="icon-btn share-pill-btn"
        >
          📡 Projeter / Partager
        </button>

        <button
          type="button"
          onclick={() => (herboristeStore.handoutItem = { type: 'plant', item: plant })}
          title="Générer une planche parcheminée / Handout Joueur"
          class="icon-btn handout-pill-btn"
        >
          📜 Handout
        </button>

        <button
          onclick={() => herboristeStore.toggleFavoritePlant(plant.id)}
          title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          class="icon-btn"
          class:icon-btn-fav={isFavorite}
        >
          {isFavorite ? '❤️' : '🤍'}
        </button>

        <button onclick={close} class="icon-btn">✕</button>
      </div>

      <!-- Header -->
      <div class="modal-header">
        <div class="header-badges">
          <span
            class="rarity-badge"
            style:color={rarityInfo.color}
            style:border-color={rarityInfo.border}
            style:background-color={rarityInfo.bg}
          >
            {rarityInfo.label}
          </span>
          <span class="biome-label">· {biomeInfo.label}</span>
        </div>

        <h2 class="plant-name">{plant.name}</h2>
        <div class="plant-latin">
          {plant.latinName}
          {#if plant.otherNames && plant.otherNames.length > 0}
            <span class="other-names">
              (Noms vernaculaires : {plant.otherNames.join(', ')})
            </span>
          {/if}
        </div>
      </div>

      <!-- Content Body -->
      <div class="content-grid">
        <!-- Left Column: Botanical Illustration & Specimen details -->
        <div class="left-col">
          <BotanicalIllustration
            {plant}
            size="lg"
            showPlateDetails={true}
            class="detail-illustration"
          />

          <div class="tech-sheet">
            <div class="tech-sheet-title">Fiche Technique de Récolte</div>
            <div class="tech-row">
              <span class="tech-label">Seuil de difficulté :</span>
              <span class="tech-dc">DD {plant.dcHarvest} (Survie/Nature)</span>
            </div>
            <div class="tech-row">
              <span class="tech-label">Saison propice :</span>
              <span>{plant.season}</span>
            </div>
            <div class="tech-row">
              <span class="tech-label">Partie utilisée :</span>
              <span class="tech-value-right">{plant.partsUsed}</span>
            </div>
            <div class="tech-row">
              <span class="tech-label">Préparation :</span>
              <span>{plant.preparationMethod} ({plant.preparationTime})</span>
            </div>
            <div class="tech-row tech-row-last">
              <span class="tech-label">Valeur marchande :</span>
              <span class="tech-value-bold">{plant.value}</span>
            </div>
          </div>
        </div>

        <!-- Right Column: Descriptions & Game Rules -->
        <div class="right-col">
          <!-- Morphological Description -->
          <div>
            <h4 class="section-title">
              <span>🪶</span>
              Description Morphologique
            </h4>
            <p class="desc-text">{plant.description}</p>
            <p class="desc-appearance">
              <strong>Aspect en nature :</strong> {plant.botanicalAppearance}
            </p>
          </div>

          <!-- In-Game Effects -->
          <div>
            <h4 class="section-title">
              <span>✨</span>
              Vertus & Effets en Jeu (D&D 5e)
            </h4>
            <div class="effects-list">
              {#each plant.gameEffects as eff, i (i)}
                <div class="effect-card">
                  <div class="effect-card-title">
                    {eff.title}
                    {#if eff.saveDc}
                      <span class="save-dc">JdS DD {eff.saveDc}</span>
                    {/if}
                  </div>
                  <p class="effect-card-desc">{eff.description}</p>
                  {#if eff.duration}
                    <span class="effect-duration">
                      Durée d'action : {eff.duration}
                    </span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>

          <!-- Toxicity alert if any -->
          {#if plant.toxicityWarning}
            <div class="toxicity-box">
              <span class="toxicity-icon">⚠️</span>
              <div>
                <strong class="toxicity-title">Toxicité & Dangerosité :</strong>
                <span>{plant.toxicityWarning}</span>
              </div>
            </div>
          {/if}

          <!-- Druidic Lore -->
          <div class="lore-box">
            {plant.druidicLore}
          </div>
        </div>
      </div>

      <!-- Associated Alchemical Recipes Section -->
      {#if associatedRecipes.length > 0}
        <div class="recipes-section">
          <h4 class="section-title">
            <span>⚗️</span>
            Concoctions Alchimiques associées ({associatedRecipes.length})
          </h4>
          <div class="recipes-grid">
            {#each associatedRecipes as rec (rec.id)}
              <div
                class="recipe-card"
                role={onSelectRecipe ? 'button' : undefined}
                tabindex={onSelectRecipe ? 0 : undefined}
                onclick={() => onSelectRecipe?.(rec)}
                onkeydown={(e) => e.key === 'Enter' && onSelectRecipe?.(rec)}
              >
                <div class="recipe-header">
                  <span class="recipe-name">{rec.name}</span>
                  <span class="recipe-price">{rec.marketPrice}</span>
                </div>
                <p class="recipe-effect">{rec.effect}</p>
                <div class="recipe-meta">
                  Brassage : {rec.brewingTime} · DD {rec.difficultyDC}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Footer actions -->
      <div class="modal-footer">
        <button onclick={() => window.print()} class="btn-print">
          <span>🖨️</span>
          <span>Imprimer cette Fiche</span>
        </button>

        <button onclick={close} class="btn-close">
          Fermer la Fiche
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background-color: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    overflow-y: auto;
  }
  .modal-panel {
    position: relative;
    width: 100%;
    max-width: 48rem;
    background-color: #f7f2e7;
    color: #2c1810;
    border-radius: 0.75rem;
    border: 4px solid #5c3e29;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
    padding: 1.5rem;
    margin: 2rem 0;
    max-height: 90vh;
    overflow-y: auto;
  }
  @media (min-width: 640px) {
    .modal-panel { padding: 2rem; }
  }

  .top-actions {
    position: absolute;
    top: 1rem;
    right: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .icon-btn {
    padding: 0.5rem;
    border-radius: 9999px;
    background-color: #ebdcc4;
    color: #451a03;
    border: 1px solid #c4a47c;
    cursor: pointer;
    transition: background-color 0.15s;
    font-size: 1rem;
    line-height: 1;
  }
  .icon-btn:hover { background-color: #dfcdb1; }
  .icon-btn-fav {
    background-color: #ffe4e6;
    border-color: #fb7185;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
  .handout-pill-btn {
    width: auto;
    padding: 0.2rem 0.6rem;
    font-size: 0.75rem;
    font-weight: bold;
    font-family: 'Crimson Pro', Georgia, serif;
    background: #e8dbc3;
    color: #4a2c11;
  }
  .share-pill-btn {
    width: auto;
    padding: 0.2rem 0.65rem;
    font-size: 0.75rem;
    font-weight: bold;
    font-family: 'Crimson Pro', Georgia, serif;
    background: linear-gradient(135deg, #2b1f14, #4a2c11);
    color: #fef08a;
    border-color: #d97706;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
  .share-pill-btn:hover {
    background: linear-gradient(135deg, #3d2719, #5c3e29);
    border-color: #f59e0b;
    color: #ffffff;
  }

  .modal-header {
    border-bottom: 2px solid rgba(133, 77, 14, 0.4);
    padding-bottom: 1rem;
    margin-bottom: 1.5rem;
    padding-right: 2.5rem;
  }
  .header-badges {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }
  .rarity-badge {
    font-size: 10px;
    font-family: 'Crimson Pro', Georgia, serif;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid;
  }
  .biome-label {
    font-size: 0.75rem;
    font-family: 'Crimson Pro', Georgia, serif;
    color: #78350f;
  }
  .plant-name {
    font-size: 1.875rem;
    font-family: 'Crimson Pro', Georgia, serif;
    font-weight: 700;
    color: #3a1d0f;
    margin: 0;
  }
  .plant-latin {
    font-size: 0.875rem;
    font-family: 'Crimson Pro', Georgia, serif;
    font-style: italic;
    color: #78350f;
    margin-top: 0.125rem;
  }
  .other-names {
    color: #59473b;
    font-style: normal;
    margin-left: 0.5rem;
  }

  .content-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }
  @media (min-width: 768px) {
    .content-grid { grid-template-columns: repeat(2, 1fr); }
  }

  .left-col {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .left-col :global(.detail-illustration) {
    width: 100%;
    max-width: 260px;
    height: 18rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
    margin-bottom: 1rem;
  }

  .tech-sheet {
    width: 100%;
    background-color: #efe7d5;
    border-radius: 0.5rem;
    border: 1px solid #c4a47c;
    padding: 0.75rem;
    font-size: 0.75rem;
    font-family: 'Crimson Pro', Georgia, serif;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .tech-sheet-title {
    font-weight: 700;
    color: #78350f;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 10px;
    border-bottom: 1px solid #dfd0bd;
    padding-bottom: 0.25rem;
  }
  .tech-row {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .tech-row-last {
    border-top: 1px solid #dfd0bd;
    padding-top: 0.25rem;
  }
  .tech-label { color: #78350f; }
  .tech-dc { font-family: monospace; font-weight: 700; color: #b45309; }
  .tech-value-right { text-align: right; font-weight: 500; }
  .tech-value-bold { font-weight: 700; color: #854d0e; }

  .right-col {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    font-family: 'Crimson Pro', Georgia, serif;
    font-size: 0.75rem;
    line-height: 1.6;
    color: #331c12;
  }
  .section-title {
    font-weight: 700;
    font-size: 0.875rem;
    color: #78350f;
    margin: 0 0 0.375rem 0;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  .desc-text { color: #3b271d; margin: 0 0 0.5rem 0; }
  .desc-appearance {
    color: #59473b;
    font-style: italic;
    background-color: #faf6ee;
    padding: 0.625rem;
    border-radius: 0.25rem;
    border: 1px solid #dfd0bc;
    margin: 0;
  }

  .effects-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .effect-card {
    background-color: #f0e7d3;
    padding: 0.625rem;
    border-radius: 0.25rem;
    border: 1px solid #cfbca2;
  }
  .effect-card-title {
    font-weight: 700;
    color: #451a03;
    font-size: 0.75rem;
  }
  .save-dc {
    margin-left: 0.5rem;
    font-family: monospace;
    font-size: 10px;
    background-color: rgba(217, 119, 6, 0.2);
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    color: #78350f;
  }
  .effect-card-desc { margin: 0.25rem 0 0 0; color: #2b1810; }
  .effect-duration {
    display: block;
    font-size: 10px;
    color: #78350f;
    font-style: italic;
    margin-top: 0.25rem;
  }

  .toxicity-box {
    background-color: rgba(254, 226, 226, 0.7);
    border: 1px solid #fca5a5;
    padding: 0.625rem;
    border-radius: 0.25rem;
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    color: #991b1b;
  }
  .toxicity-icon { flex-shrink: 0; margin-top: 0.125rem; }
  .toxicity-title { display: block; }

  .lore-box {
    background-color: #faf6ee;
    padding: 0.75rem;
    border-radius: 0.25rem;
    border-left: 4px solid #854d0e;
    font-style: italic;
    color: #5c3e29;
  }

  .recipes-section {
    border-top: 2px solid rgba(133, 77, 14, 0.3);
    padding-top: 1rem;
    margin-top: 1.5rem;
  }
  .recipes-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  @media (min-width: 640px) {
    .recipes-grid { grid-template-columns: repeat(2, 1fr); }
  }
  .recipe-card {
    background-color: #faf6ee;
    padding: 0.75rem;
    border-radius: 0.25rem;
    border: 1px solid #c4a47c;
    font-size: 0.75rem;
    font-family: 'Crimson Pro', Georgia, serif;
  }
  .recipe-card[role='button'] { cursor: pointer; }
  .recipe-card[role='button']:hover { border-color: #854d0e; }
  .recipe-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.25rem;
    gap: 0.5rem;
  }
  .recipe-name { font-weight: 700; color: #451a03; }
  .recipe-price { font-family: monospace; color: #b45309; font-weight: 700; }
  .recipe-effect { font-size: 11px; color: #59473b; margin: 0 0 0.25rem 0; }
  .recipe-meta { font-size: 10px; color: #78350f; font-style: italic; }

  .modal-footer {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid #c4a47c;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
  }
  .btn-print {
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    background-color: #3d2719;
    color: #fef08a;
    border: 1px solid #854d0e;
    font-family: 'Crimson Pro', Georgia, serif;
    font-weight: 700;
    font-size: 0.75rem;
    cursor: pointer;
    transition: background-color 0.15s;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  .btn-print:hover { background-color: #523724; }
  .btn-close {
    padding: 0.5rem 1.25rem;
    border-radius: 0.25rem;
    background-color: #78350f;
    color: #fef08a;
    font-family: 'Crimson Pro', Georgia, serif;
    font-weight: 700;
    font-size: 0.75rem;
    border: none;
    cursor: pointer;
    transition: background-color 0.15s;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }
  .btn-close:hover { background-color: #8e3f13; }

  @media print {
    .modal-overlay { display: none; }
  }
</style>
