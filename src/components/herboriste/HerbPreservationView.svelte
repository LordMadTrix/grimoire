<script lang="ts">
  import type { Plant } from '$lib/herboriste/types/herb';
  import { herboristeStore } from '$lib/herboriste/store.svelte';

  type PreservationMethodId = 'sechoir' | 'teinture' | 'salaison' | 'miel';

  interface PreservationMethod {
    id: PreservationMethodId;
    name: string;
    icon: string;
    shelfLife: string;
    bonusEffect: string;
    suitableParts: string;
    description: string;
  }

  const METHODS: PreservationMethod[] = [
    {
      id: 'sechoir',
      name: 'Séchoir Suspendu sous les Toits',
      icon: '🌿',
      shelfLife: '12 mois',
      bonusEffect: 'Poids réduit de moitié (facile à transporter dans la besace).',
      suitableParts: 'Feuilles, fleurs et tiges fines',
      description: 'Méthode ancestrale consistant à lier les plantes en bouquets suspendus à l\'abri de l\'humidité et du soleil direct.',
    },
    {
      id: 'teinture',
      name: 'Macération en Teinture-Mère Alcoolique',
      icon: '🍶',
      shelfLife: '5 ans',
      bonusEffect: '+2 au DD de confection des potions dérivées de cet extrait.',
      suitableParts: 'Toutes parties de la plante broyée',
      description: 'Immersion prolongée dans un alcool de grain pur à 70°. Extrait la quintessence des principes actifs de la sève.',
    },
    {
      id: 'salaison',
      name: 'Salaison au Sel Gemme de Fangh',
      icon: '🧂',
      shelfLife: '2 ans',
      bonusEffect: 'Immunise totalement contre la moisissure et la pourriture miasmatique.',
      suitableParts: 'Racines bulbeuses, rhizomes et écorces ligneuses',
      description: 'Enfouissement dans des cristaux de sel gemme broyés. Bloque le développement des bactéries et conserve la sève interne.',
    },
    {
      id: 'miel',
      name: 'Confit au Miel d\'Abeilles Géantes',
      icon: '🍯',
      shelfLife: '3 ans',
      bonusEffect: 'L\'ingrédient confit soigne 1d4 PV directement lorsqu\'il est consommé.',
      suitableParts: 'Baies sucrées, pétales délicats et bourgeons',
      description: 'Conservation dans un pot de miel pur épais. Crée des pastilles et confiseries médicinales très réconfortantes.',
    },
  ];

  let selectedPlantId = $state<string>(herboristeStore.plants[0]?.id ?? '');
  let selectedMethodId = $state<PreservationMethodId>('sechoir');
  let batchQuantity = $state<number>(3);
  let preservedList = $state<Array<{ id: string; plantName: string; methodName: string; shelfLife: string; bonus: string; qty: number }>>([
    { id: '1', plantName: 'Athelas Royal', methodName: 'Séchoir Suspendu', shelfLife: '12 mois', bonus: 'Poids réduit de moitié', qty: 4 },
    { id: '2', plantName: 'Lotus Doré', methodName: 'Teinture-Mère Alcoolique', shelfLife: '5 ans', bonus: '+2 aux DD alchimiques', qty: 2 },
  ]);
  let successBanner = $state<string | null>(null);

  const selectedPlant = $derived(
    herboristeStore.plants.find(p => p.id === selectedPlantId) ?? herboristeStore.plants[0]
  );

  const selectedMethod = $derived(
    METHODS.find(m => m.id === selectedMethodId) ?? METHODS[0]
  );

  function preserveBatch() {
    if (!selectedPlant) return;
    const newEntry = {
      id: Math.random().toString(36).substring(7),
      plantName: selectedPlant.name,
      methodName: selectedMethod.name,
      shelfLife: selectedMethod.shelfLife,
      bonus: selectedMethod.bonusEffect,
      qty: batchQuantity,
    };
    preservedList = [newEntry, ...preservedList];
    successBanner = `Lot de ${batchQuantity}x ${selectedPlant.name} conditionné avec succès via ${selectedMethod.name} !`;
    setTimeout(() => (successBanner = null), 3500);
  }

  function removePreserved(id: string) {
    preservedList = preservedList.filter(item => item.id !== id);
  }
</script>

<div class="preserv-page">
  <div class="preserv-header">
    <div>
      <div class="tag-row">
        <span class="badge">Atelier de Conservation · Apothicairerie</span>
        <span class="sub-note">Gestion des récoltes, séchage & macérations</span>
      </div>
      <h3 class="preserv-title">
        <span>🧺</span> Atelier de Séchage & Conservation des Plantes
      </h3>
      <p class="preserv-desc">
        Les herbes fraîches se flétrissent après quelques jours en besace. Conditionnez vos récoltes par séchage, teinture-mère, salaison ou confisage au miel pour préserver leur puissance médicinale durablement.
      </p>
    </div>
  </div>

  {#if successBanner}
    <div class="success-banner">
      <span>✨</span> {successBanner}
    </div>
  {/if}

  <div class="preserv-layout">
    <!-- Config Column -->
    <div class="config-col">
      <!-- 1. Plant to preserve -->
      <div class="card">
        <label class="card-title" for="plant-select">
          <span class="step-num">1</span> Choisissez la Plante à Préparer
        </label>
        <select id="plant-select" bind:value={selectedPlantId} class="plant-select">
          {#each herboristeStore.plants as p (p.id)}
            <option value={p.id}>{p.name} ({p.biome} · {p.rarity})</option>
          {/each}
        </select>

        <div class="qty-row">
          <label class="qty-lbl" for="batch-qty-input">Nombre de doses fraîches à traiter :</label>
          <input
            id="batch-qty-input"
            type="number"
            min="1"
            max="20"
            bind:value={batchQuantity}
            class="qty-input"
          />
        </div>
      </div>

      <!-- 2. Method Selection -->
      <div class="card">
        <div class="card-title">
          <span class="step-num">2</span> Choisissez la Méthode de Conservation
        </div>

        <div class="methods-grid">
          {#each METHODS as m (m.id)}
            <button
              type="button"
              class="method-btn"
              class:selected={selectedMethodId === m.id}
              onclick={() => (selectedMethodId = m.id)}
            >
              <div class="m-head">
                <span class="m-ico">{m.icon}</span>
                <span class="m-name">{m.name}</span>
                <span class="m-shelf">⏳ {m.shelfLife}</span>
              </div>
              <p class="m-desc">{m.description}</p>
              <div class="m-bonus">
                <span>⚡ <strong>Bonus :</strong> {m.bonusEffect}</span>
              </div>
            </button>
          {/each}
        </div>

        <button type="button" class="btn-prepare" onclick={preserveBatch}>
          <span>🧺</span> Conditionner le lot ({batchQuantity} doses de {selectedPlant?.name})
        </button>
      </div>
    </div>

    <!-- Inventory of Preserved Herbs -->
    <div class="stock-col">
      <div class="stock-card">
        <div class="stock-head">
          <h4>🗄️ Réserve des Herbes Préparées en Bocal & Séchoir</h4>
          <span class="stock-count">{preservedList.length} lot(s) en réserve</span>
        </div>

        {#if preservedList.length === 0}
          <div class="stock-empty">Aucune herbe préparée en stock.</div>
        {:else}
          <div class="stock-list">
            {#each preservedList as item (item.id)}
              <div class="stock-item">
                <div class="st-top">
                  <span class="st-name">{item.qty}x {item.plantName}</span>
                  <span class="st-method">{item.methodName}</span>
                  <button type="button" class="btn-del" onclick={() => removePreserved(item.id)}>✕</button>
                </div>
                <div class="st-details">
                  <span>Conservation : <strong>{item.shelfLife}</strong></span>
                  <span>· {item.bonus}</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .preserv-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    font-family: Georgia, 'Times New Roman', serif;
    color: #e6d8c3;
  }

  .preserv-header {
    border-bottom: 1px solid #4a392d;
    padding-bottom: 1.25rem;
  }
  .tag-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
  .badge {
    background: #451a03;
    color: #fcd34d;
    font-size: 0.7rem;
    font-weight: bold;
    padding: 0.15rem 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid rgba(217, 119, 6, 0.5);
    font-family: ui-monospace, monospace;
    text-transform: uppercase;
  }
  .sub-note { font-size: 0.75rem; color: #a89988; font-style: italic; }

  .preserv-title {
    font-size: 1.6rem;
    font-weight: bold;
    color: #d4af37;
    margin: 0.25rem 0;
  }
  .preserv-desc {
    font-size: 0.85rem;
    color: #c4b5a5;
    max-width: 48rem;
    margin: 0;
    line-height: 1.45;
    font-style: italic;
  }

  .success-banner {
    background: #f0fdf4;
    border: 1px solid #86efac;
    color: #14532d;
    padding: 0.75rem 1rem;
    border-radius: 0.4rem;
    font-weight: bold;
    font-size: 0.85rem;
  }

  .preserv-layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  @media (min-width: 1024px) {
    .preserv-layout { grid-template-columns: 1.2fr 0.8fr; }
  }

  .config-col, .stock-col {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .card {
    background: #241c16;
    border: 1px solid #4a392d;
    border-radius: 0.65rem;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .card-title {
    font-size: 0.95rem;
    font-weight: bold;
    color: #fef08a;
    display: flex;
    align-items: center;
    gap: 0.5rem;
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

  .plant-select {
    width: 100%;
    background: #181310;
    border: 1px solid #59473b;
    border-radius: 0.35rem;
    padding: 0.45rem 0.65rem;
    color: #f5ecd7;
    font-size: 0.8rem;
    font-family: Georgia, 'Times New Roman', serif;
  }

  .qty-row { display: flex; align-items: center; gap: 0.5rem; }
  .qty-lbl { font-size: 0.75rem; color: #a89988; }
  .qty-input {
    width: 4rem;
    background: #181310;
    border: 1px solid #59473b;
    border-radius: 0.35rem;
    padding: 0.3rem;
    color: #fde047;
    font-weight: bold;
    text-align: center;
    font-family: ui-monospace, monospace;
  }

  .methods-grid { display: flex; flex-direction: column; gap: 0.5rem; }
  .method-btn {
    text-align: left;
    background: #181310;
    border: 1px solid #4a392d;
    border-radius: 0.4rem;
    padding: 0.75rem;
    cursor: pointer;
    transition: all 0.15s ease;
    color: #e6d8c3;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .method-btn:hover { background: #2e231b; }
  .method-btn.selected {
    background: #3b271b;
    border-color: #d4af37;
    box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.3);
  }

  .m-head { display: flex; align-items: center; gap: 0.35rem; }
  .m-ico { font-size: 1.1rem; }
  .m-name { font-size: 0.85rem; font-weight: bold; color: #fef08a; flex: 1; }
  .m-shelf {
    font-size: 0.7rem;
    background: #3a2a1d;
    color: #fde047;
    padding: 0.1rem 0.35rem;
    border-radius: 0.2rem;
    font-weight: bold;
  }
  .m-desc { font-size: 0.72rem; color: #a89988; margin: 0; line-height: 1.3; }
  .m-bonus { font-size: 0.7rem; color: #86efac; }

  .btn-prepare {
    background: linear-gradient(135deg, #d4af37, #92400e);
    color: #181310;
    border: none;
    border-radius: 0.4rem;
    padding: 0.85rem;
    font-size: 0.9rem;
    font-weight: 900;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  .btn-prepare:hover { filter: brightness(1.15); }

  /* Stock Card */
  .stock-card {
    background: #241c16;
    border: 1px solid #4a392d;
    border-radius: 0.65rem;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }
  .stock-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #3e2e23;
    padding-bottom: 0.5rem;
  }
  .stock-head h4 { font-size: 0.95rem; font-weight: bold; color: #fef08a; margin: 0; }
  .stock-count { font-size: 0.75rem; color: #a89988; }
  .stock-empty { font-size: 0.8rem; color: #a89988; font-style: italic; padding: 1rem 0; text-align: center; }

  .stock-list { display: flex; flex-direction: column; gap: 0.5rem; max-height: 28rem; overflow-y: auto; }
  .stock-item {
    background: #181310;
    border: 1px solid #3e2e23;
    border-radius: 0.35rem;
    padding: 0.65rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .st-top { display: flex; align-items: center; gap: 0.5rem; }
  .st-name { font-weight: bold; color: #fef08a; font-size: 0.85rem; flex: 1; }
  .st-method { font-size: 0.7rem; color: #a89988; }
  .btn-del { background: none; border: none; color: #a89988; font-size: 0.8rem; cursor: pointer; }
  .btn-del:hover { color: #f87171; }
  .st-details { font-size: 0.72rem; color: #86efac; }
</style>
