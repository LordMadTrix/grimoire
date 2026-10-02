<script lang="ts">
  import type { Plant, BiomeType, RarityType } from '$lib/herboriste/types/herb';
  import { BIOMES_METADATA, RARITY_METADATA } from '$lib/herboriste/data/herbalistData';
  import { herboristeStore } from '$lib/herboriste/store.svelte';

  type PreparationMethod = Plant['preparationMethod'];
  type Season = Plant['season'];
  type IllustrationType = Plant['illustrationType'];

  let name = $state('');
  let latinName = $state('');
  let biome = $state<BiomeType>('foret');
  let rarity = $state<RarityType>('peu_commune');
  let dcHarvest = $state<number>(14);
  let season = $state<Season>('Printemps');
  let partsUsed = $state('Feuilles et sève');
  let preparationMethod = $state<PreparationMethod>('Infusion');
  let preparationTime = $state('30 minutes');
  let value = $state('40 po');
  let description = $state('');
  let botanicalAppearance = $state('');
  let effectTitle = $state('Effet Curatif');
  let effectDesc = $state("Restaure 2d6 points de vie lorsqu'appliquée.");
  let effectDuration = $state('Instantané');
  let toxicityWarning = $state('');
  let druidicLore = $state('');
  let illustrationType = $state<IllustrationType>('flower');
  let accentColor = $state('#10b981');

  const biomeEntries = Object.entries(BIOMES_METADATA) as [BiomeType, (typeof BIOMES_METADATA)[BiomeType]][];
  const rarityEntries = Object.entries(RARITY_METADATA) as [RarityType, (typeof RARITY_METADATA)[RarityType]][];

  function close() {
    herboristeStore.isAddModalOpen = false;
  }

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const newPlant: Plant = {
      id: `custom_${Date.now()}`,
      name: name.trim(),
      latinName: latinName.trim() || `${name.trim()} Silvestris`,
      biome,
      rarity,
      dcHarvest: Number(dcHarvest) || 12,
      preparationMethod,
      preparationTime,
      season,
      partsUsed,
      value,
      description: description || `Plante mystérieuse originaire des ${BIOMES_METADATA[biome].label}.`,
      botanicalAppearance: botanicalAppearance || 'Spécimen végétal aux propriétés remarquables.',
      gameEffects: [
        {
          title: effectTitle || 'Effet Magique',
          description: effectDesc || "Effet alchimique en cours d'étude.",
          duration: effectDuration || undefined,
        },
      ],
      toxicityWarning: toxicityWarning.trim() || undefined,
      druidicLore: druidicLore.trim() || '« Une plante aux vertus vénérées par les gardiens de la forêt. »',
      illustrationType,
      accentColor,
      custom: true,
    };

    herboristeStore.addCustomPlant(newPlant);
    close();
  }
</script>

{#if herboristeStore.isAddModalOpen}
  <div class="modal-overlay">
    <div class="modal-panel">
      <button onclick={close} class="close-btn">✕</button>

      <div class="modal-header">
        <div class="header-title-row">
          <span class="header-icon">🪶</span>
          <h3 class="header-title">
            Créer une Nouvelle Plante pour le Grimoire
          </h3>
        </div>
        <p class="header-subtitle">
          Ajoutez votre propre spécimen botanique fantastique. Il sera immédiatement intégré à l'herbier et aux exports PDF !
        </p>
      </div>

      <form onsubmit={handleSubmit} class="form">
        <!-- Names -->
        <div class="grid-2">
          <div>
            <label class="field-label" for="custom-name">Nom commun *</label>
            <input
              id="custom-name"
              type="text"
              required
              placeholder="Ex: Épine d'Argent"
              bind:value={name}
              class="field-input"
            />
          </div>
          <div>
            <label class="field-label" for="custom-latin">Nom binominal / latin</label>
            <input
              id="custom-latin"
              type="text"
              placeholder="Ex: Spina Argentea"
              bind:value={latinName}
              class="field-input"
            />
          </div>
        </div>

        <!-- Biome, Rarity, DC -->
        <div class="grid-3">
          <div>
            <label class="field-label" for="custom-biome">Biotope</label>
            <select id="custom-biome" bind:value={biome} class="field-input">
              {#each biomeEntries as [key, data] (key)}
                <option value={key}>{data.label}</option>
              {/each}
            </select>
          </div>
          <div>
            <label class="field-label" for="custom-rarity">Rareté</label>
            <select id="custom-rarity" bind:value={rarity} class="field-input">
              {#each rarityEntries as [key, data] (key)}
                <option value={key}>{data.label}</option>
              {/each}
            </select>
          </div>
          <div>
            <label class="field-label" for="custom-dc">DD Récolte (Survie/Nature)</label>
            <input
              id="custom-dc"
              type="number"
              min="5"
              max="30"
              bind:value={dcHarvest}
              class="field-input field-dc"
            />
          </div>
        </div>

        <!-- Visual type & highlights -->
        <div class="grid-3">
          <div>
            <label class="field-label" for="custom-illust">Type Botanique</label>
            <select id="custom-illust" bind:value={illustrationType} class="field-input">
              <option value="flower">Fleur & Corolle</option>
              <option value="root">Racine & Tubercule</option>
              <option value="mushroom">Champignon & Spores</option>
              <option value="shrub">Arbrisseau & Baies</option>
              <option value="vine">Liane & Vrilles</option>
              <option value="aquatic">Algue & Récif</option>
              <option value="moss">Mousse & Lichen</option>
              <option value="succulent">Cactus & Épines</option>
            </select>
          </div>
          <div>
            <label class="field-label" for="custom-color">Teinte de la Planche</label>
            <input
              id="custom-color"
              type="color"
              bind:value={accentColor}
              class="field-color"
            />
          </div>
          <div>
            <label class="field-label" for="custom-value">Valeur estimée</label>
            <input
              id="custom-value"
              type="text"
              placeholder="Ex: 50 po"
              bind:value
              class="field-input"
            />
          </div>
        </div>

        <!-- Description & Game Effects -->
        <div>
          <label class="field-label" for="custom-desc">Description & Vertus Botaniques</label>
          <textarea
            id="custom-desc"
            rows={2}
            placeholder="Décrivez l'aspect de la plante, son parfum, son comportement..."
            bind:value={description}
            class="field-input field-textarea"
          ></textarea>
        </div>

        <!-- D&D Mechanical Effect -->
        <div class="effect-section">
          <span class="effect-section-title">
            Effet Mécanique D&D 5e / JDR
          </span>
          <div class="grid-2">
            <input
              type="text"
              placeholder="Titre de l'effet (ex: Restauration Majeure)"
              bind:value={effectTitle}
              class="field-input"
            />
            <input
              type="text"
              placeholder="Durée (ex: 1 heure, Instantané)"
              bind:value={effectDuration}
              class="field-input"
            />
          </div>
          <textarea
            rows={2}
            placeholder="Détail des règles (points de vie rendus, bonus aux jets, sauvegarde requise...)"
            bind:value={effectDesc}
            class="field-input field-textarea"
          ></textarea>
        </div>

        <!-- Toxicity warning & Lore -->
        <div class="grid-2">
          <div>
            <label class="field-label field-label-danger" for="custom-toxicity">Danger / Toxicité (Optionnel)</label>
            <input
              id="custom-toxicity"
              type="text"
              placeholder="Ex: Toxique si bouilli sans sel"
              bind:value={toxicityWarning}
              class="field-input field-danger"
            />
          </div>
          <div>
            <label class="field-label" for="custom-lore">Citation / Lore Druidique</label>
            <input
              id="custom-lore"
              type="text"
              placeholder="Ex: « Les fées dansent là où elle fleurit. »"
              bind:value={druidicLore}
              class="field-input field-italic"
            />
          </div>
        </div>

        <!-- Form Actions -->
        <div class="form-actions">
          <button type="button" onclick={close} class="btn-cancel">
            Annuler
          </button>
          <button type="submit" class="btn-submit">
            <span class="icon-gold">➕</span>
            <span>Inscrire au Grimoire</span>
          </button>
        </div>
      </form>
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
    max-width: 42rem;
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

  .close-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
    padding: 0.5rem;
    border-radius: 9999px;
    background-color: #ebdcc4;
    color: #451a03;
    border: 1px solid #c4a47c;
    cursor: pointer;
    transition: background-color 0.15s;
  }
  .close-btn:hover { background-color: #dfcdb1; }

  .modal-header {
    border-bottom: 2px solid rgba(133, 77, 14, 0.3);
    padding-bottom: 0.75rem;
    margin-bottom: 1.25rem;
    padding-right: 2.5rem;
  }
  .header-title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .header-icon { font-size: 1.5rem; }
  .header-title {
    font-size: 1.5rem;
    font-family: 'Crimson Pro', Georgia, serif;
    font-weight: 700;
    color: #3a1d0f;
    margin: 0;
  }
  .header-subtitle {
    font-size: 0.75rem;
    color: #78350f;
    font-family: 'Crimson Pro', Georgia, serif;
    font-style: italic;
    margin: 0.25rem 0 0 0;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    font-family: 'Crimson Pro', Georgia, serif;
    font-size: 0.75rem;
  }
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  .grid-3 {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  @media (min-width: 640px) {
    .grid-2 { grid-template-columns: repeat(2, 1fr); }
    .grid-3 { grid-template-columns: repeat(3, 1fr); }
  }

  .field-label {
    display: block;
    color: #78350f;
    font-weight: 700;
    margin-bottom: 0.25rem;
  }
  .field-label-danger { color: #991b1b; }
  .field-input {
    width: 100%;
    background-color: #fff;
    border: 1px solid #c4a47c;
    border-radius: 0.25rem;
    padding: 0.375rem 0.75rem;
    box-sizing: border-box;
    color: #2c1810;
  }
  .field-input:focus {
    outline: none;
    border-color: #854d0e;
  }
  .field-dc {
    font-family: monospace;
    font-weight: 700;
    color: #b45309;
  }
  .field-textarea { padding: 0.5rem; resize: vertical; }
  .field-danger { color: #991b1b; }
  .field-italic { font-style: italic; }
  .field-color {
    width: 100%;
    height: 2rem;
    cursor: pointer;
    border-radius: 0.25rem;
    border: 1px solid #c4a47c;
    background-color: #fff;
    padding: 0.25rem;
    box-sizing: border-box;
  }

  .effect-section {
    background-color: #efe8d8;
    padding: 0.75rem;
    border-radius: 0.25rem;
    border: 1px solid #c4a47c;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .effect-section-title {
    font-weight: 700;
    color: #78350f;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 10px;
    display: block;
  }

  .form-actions {
    padding-top: 0.75rem;
    border-top: 1px solid #c4a47c;
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }
  .btn-cancel {
    padding: 0.5rem 1rem;
    background-color: #ebdcc4;
    color: #451a03;
    font-family: 'Crimson Pro', Georgia, serif;
    border-radius: 0.25rem;
    border: 1px solid #c4a47c;
    cursor: pointer;
  }
  .btn-cancel:hover { background-color: #dfcdb1; }
  .btn-submit {
    padding: 0.5rem 1.5rem;
    background-color: #78350f;
    color: #fef08a;
    font-family: 'Crimson Pro', Georgia, serif;
    font-weight: 700;
    border-radius: 0.25rem;
    border: none;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    transition: background-color 0.15s;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    cursor: pointer;
  }
  .btn-submit:hover { background-color: #8e3f13; }
  .icon-gold { font-size: 0.875rem; }

  @media print {
    .modal-overlay { display: none; }
  }
</style>
