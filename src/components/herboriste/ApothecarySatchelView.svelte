<script lang="ts">
  interface SatchelSlot {
    id: number;
    name: string;
    type: 'fiole' | 'herbe' | 'gemme' | 'outil';
    icon: string;
    quantity: number;
    fragility: 'Faible' | 'Moyenne' | 'Élevée' | 'Incassable';
    description: string;
  }

  let slots = $state<SatchelSlot[]>([
    { id: 1, name: 'Potion de Soins Supérieure', type: 'fiole', icon: '🧪', quantity: 2, fragility: 'Élevée', description: 'Flacon de verre soufflé sous vide scellé à la résine.' },
    { id: 2, name: 'Antidote Universel de Fangh', type: 'fiole', icon: '⚗️', quantity: 1, fragility: 'Élevée', description: 'Solution d\'huile ambrée contre les venins d\'araignées.' },
    { id: 3, name: 'Acide Concentré de Troglodyte', type: 'fiole', icon: '🧪', quantity: 1, fragility: 'Élevée', description: 'Liquide vert rongeant le liège ordinaire.' },
    { id: 4, name: 'Feu Grégeois des Nains', type: 'fiole', icon: '🔥', quantity: 1, fragility: 'Élevée', description: 'Instable aux chocs thermiques et mécaniques.' },
    { id: 5, name: 'Pétales Séchés de Racine d\'Orphée', type: 'herbe', icon: '🌿', quantity: 5, fragility: 'Faible', description: 'Pochette de lin séchée à l\'abri des mites.' },
    { id: 6, name: 'Feuilles d\'Atropa Belladone', type: 'herbe', icon: '🍃', quantity: 3, fragility: 'Faible', description: 'Herbe hautement vénéneuse conservée au sel.' },
    { id: 7, name: 'Poudre de Champignon Luminescent', type: 'herbe', icon: '🍄', quantity: 2, fragility: 'Faible', description: 'Farine phosphorique enveloppée de cuir huilé.' },
    { id: 8, name: 'Bourse de Rubis Coussin (3 UG)', type: 'gemme', icon: '💎', quantity: 1, fragility: 'Moyenne', description: 'Pochette de velours cramoisi rembourrée de laine.' },
    { id: 9, name: 'Géode de Quartz brut non fendue', type: 'gemme', icon: '⛏️', quantity: 1, fragility: 'Faible', description: 'Roche lourde pouvant servir de projectile improvisé.' },
    { id: 10, name: 'Mortier & Pilon en Marbre Nain', type: 'outil', icon: '🥣', quantity: 1, fragility: 'Incassable', description: 'Outil de broyage massif hérité d\'un maître alchimiste.' },
    { id: 11, name: 'Trousse de Scalpels en Argent Pur', type: 'outil', icon: '🗡️', quantity: 1, fragility: 'Moyenne', description: 'Lames effilées pour inciser délicatement les bulbes.' },
    { id: 12, name: 'Bâtée Pliable en Cuivre', type: 'outil', icon: '🪨', quantity: 1, fragility: 'Incassable', description: 'Cuvette pour orpaillage et tri minéral sur le terrain.' }
  ]);

  let selectedSlot = $state<SatchelSlot>(slots[0]);

  // Fragility & Impact Simulator
  let impactType = $state<'chute' | 'coup_dos' | 'explosion'>('coup_dos');
  let agiBonus = $state<number>(2);
  let isSimulatingImpact = $state<boolean>(false);
  let impactResult = $state<{
    roll: number;
    total: number;
    success: boolean;
    brokenItem: string | null;
    narrative: string;
  } | null>(null);

  const totalWeight = $derived.by(() => {
    return slots.reduce((acc, s) => acc + (s.type === 'outil' ? 2 : s.type === 'fiole' ? 0.8 : 0.4) * s.quantity, 0).toFixed(1);
  });

  const fragilityScore = $derived.by(() => {
    const highFrag = slots.filter((s) => s.fragility === 'Élevée').length;
    return Math.min(100, highFrag * 22);
  });

  function simulateImpact() {
    isSimulatingImpact = true;
    impactResult = null;

    setTimeout(() => {
      const roll = Math.floor(Math.random() * 20) + 1;
      const total = roll + agiBonus;
      const dc = impactType === 'chute' ? 12 : impactType === 'coup_dos' ? 14 : 16;
      const success = roll === 20 || total >= dc;

      let brokenItem: string | null = null;
      let narrative = '';

      if (roll === 20) {
        narrative = 'Grâce acrobatique ! Vous amortissez l\'impact en roulant sur le côté. Pas la moindre fêlure dans le sac.';
      } else if (roll === 1) {
        const fragileVials = slots.filter((s) => s.type === 'fiole');
        const broken = fragileVials[Math.floor(Math.random() * fragileVials.length)];
        brokenItem = broken.name;
        narrative = `Catastrophe ! Votre sacoche frappe violemment le sol de pierre. La fiole [${broken.name}] vole en éclats ! Les réactifs trempent vos affaires de voyage.`;
      } else if (success) {
        narrative = `Sauvegarde d'Agilité réussie (${total} vs DD ${dc}). Les compartiments matelassés ont parfaitement joué leur rôle d'amortisseur.`;
      } else {
        const fragileVials = slots.filter((s) => s.type === 'fiole');
        const broken = fragileVials[Math.floor(Math.random() * fragileVials.length)];
        brokenItem = broken.name;
        narrative = `Impact trop violent (${total} vs DD ${dc}). Le bouchon de [${broken.name}] a sauté et 1 dose a fui au fond de la besace.`;
      }

      impactResult = { roll, total, success, brokenItem, narrative };
      isSimulatingImpact = false;
    }, 400);
  }
</script>

<div class="satchel-container">
  <!-- Banner -->
  <div class="banner">
    <div class="banner-title-row">
      <span class="banner-icon">🎒</span>
      <div>
        <h2 class="banner-title">Sacoche d'Apothicaire & Grille d'Inventaire Tactique</h2>
        <p class="banner-subtitle">
          Gérez vos flacons fragiles, sachets de poudres et trousses d'outils. Simulez la résistance de votre équipement aux coups et chutes en donjon.
        </p>
      </div>
    </div>
  </div>

  <div class="satchel-layout">
    <!-- Left Column: Tactical Grid (12 Slots) -->
    <div class="grid-card">
      <div class="grid-header">
        <h3 class="grid-title">Compartiments Matelassés (12 Logements)</h3>
        <div class="meters-row">
          <span class="meter-pill">⚖️ Poids : <strong>{totalWeight} / 25 Livres</strong></span>
          <span class="meter-pill" class:warn={fragilityScore > 60}>
            💥 Indice de Fragilité : <strong>{fragilityScore}%</strong>
          </span>
        </div>
      </div>

      <div class="satchel-grid">
        {#each slots as s (s.id)}
          <button
            type="button"
            class="slot-btn"
            class:selected={selectedSlot.id === s.id}
            onclick={() => (selectedSlot = s)}
          >
            <div class="slot-badge">{s.quantity}x</div>
            <span class="slot-icon">{s.icon}</span>
            <span class="slot-name">{s.name}</span>
            <span class="slot-type">{s.type}</span>
          </button>
        {/each}
      </div>

      <!-- Selected Item Detail Inspection -->
      <div class="selected-slot-card">
        <div class="slot-head">
          <span class="s-ico">{selectedSlot.icon}</span>
          <div>
            <h4 class="s-title">{selectedSlot.name} (x{selectedSlot.quantity})</h4>
            <span class="s-meta">Catégorie : {selectedSlot.type} · Fragilité : {selectedSlot.fragility}</span>
          </div>
        </div>
        <p class="s-desc">{selectedSlot.description}</p>
      </div>
    </div>

    <!-- Right Column: Combat Impact & Fall Simulator -->
    <div class="impact-card">
      <div class="impact-head">
        <h3 class="impact-title">🛡️ Simulation de Choc & Coup Critique</h3>
        <span class="impact-sub">Testez si vos fioles résistent aux aléas du combat</span>
      </div>

      <div class="impact-config">
        <div class="impact-row">
          <label class="i-lbl">Type de Traumatisme :</label>
          <div class="impact-chips">
            <button
              type="button"
              class="i-chip"
              class:active={impactType === 'chute'}
              onclick={() => (impactType = 'chute')}
            >
              🪜 Chute de 3 mètres (DD 12)
            </button>
            <button
              type="button"
              class="i-chip"
              class:active={impactType === 'coup_dos'}
              onclick={() => (impactType = 'coup_dos')}
            >
              🔨 Massue orc dans le dos (DD 14)
            </button>
            <button
              type="button"
              class="i-chip"
              class:active={impactType === 'explosion'}
              onclick={() => (impactType = 'explosion')}
            >
              💣 Onde de Choc Explosive (DD 16)
            </button>
          </div>
        </div>

        <div class="impact-row-inline">
          <span class="i-lbl">Bonus Agilité / Réflexes (PJ) :</span>
          <input
            type="number"
            min="-2"
            max="10"
            bind:value={agiBonus}
            class="agi-input"
          />
        </div>

        <button
          type="button"
          class="btn-impact-roll"
          onclick={simulateImpact}
          disabled={isSimulatingImpact}
        >
          {#if isSimulatingImpact}
            <span>💥 Calcul de l'impact mécanique...</span>
          {:else}
            <span>🎲 Tenter la Sauvegarde de Réflexes</span>
          {/if}
        </button>

        {#if impactResult}
          <div
            class="impact-result-box"
            class:success={impactResult.success}
            class:failure={!impactResult.success}
          >
            <div class="res-head">
              <span>Jet : {impactResult.roll} + {agiBonus} = <strong>{impactResult.total}</strong></span>
              <span class="res-state">
                {impactResult.success ? '✅ Matériel Intact' : '⚠️ Casse Constatée'}
              </span>
            </div>
            <p class="res-narr">{impactResult.narrative}</p>
          </div>
        {/if}
      </div>

      <!-- Quick Advice Box -->
      <div class="advice-box">
        <span class="adv-title">💡 Conseil de Bourrelier Nain :</span>
        <p class="adv-text">
          Pour réduire le risque de casse de 50%, enveloppez vos fioles d'acide dans une toison de bélier et rangez toujours les pierres lourdes dans le fond de la besace.
        </p>
      </div>
    </div>
  </div>
</div>

<style>
  .satchel-container {
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
    background: #1c1511;
    border: 2px solid #b45309;
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
    color: #fcd34d;
    font-weight: bold;
    letter-spacing: 0.03em;
  }
  .banner-subtitle {
    margin: 0.35rem 0 0 0;
    font-size: 0.85rem;
    color: #fef3c7;
    line-height: 1.4;
  }

  .satchel-layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  @media (min-width: 900px) {
    .satchel-layout { grid-template-columns: 1.3fr 1fr; }
  }

  .grid-card, .impact-card {
    background: #241c16;
    border: 1px solid #4d3a2e;
    border-radius: 0.75rem;
    padding: 1.25rem;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .grid-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    border-bottom: 1px solid #4a382c;
    padding-bottom: 0.5rem;
  }
  .grid-title { margin: 0; font-size: 1.05rem; color: #fef08a; }
  .meters-row { display: flex; gap: 0.5rem; }
  .meter-pill {
    font-size: 0.75rem;
    background: #181310;
    border: 1px solid #453224;
    padding: 0.2rem 0.5rem;
    border-radius: 0.3rem;
    color: #e2d0b8;
  }
  .meter-pill.warn { border-color: #ef4444; color: #fca5a5; }

  /* Grid */
  .satchel-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 0.5rem;
  }
  .slot-btn {
    background: #181310;
    border: 1.5px solid #3c2a1c;
    border-radius: 0.4rem;
    padding: 0.6rem 0.4rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    position: relative;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .slot-btn:hover { background: #322218; border-color: #d4af37; }
  .slot-btn.selected {
    background: #47321f;
    border-color: #fef08a;
    box-shadow: 0 0 10px rgba(254, 240, 138, 0.2);
  }
  .slot-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    font-size: 0.65rem;
    background: #2d1f14;
    padding: 0.1rem 0.3rem;
    border-radius: 0.2rem;
    color: #fcd34d;
    font-weight: bold;
  }
  .slot-icon { font-size: 1.5rem; margin-top: 0.2rem; }
  .slot-name {
    font-size: 0.72rem;
    color: #f7eed7;
    text-align: center;
    line-height: 1.2;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .slot-type {
    font-size: 0.65rem;
    color: #9c8470;
    text-transform: capitalize;
  }

  .selected-slot-card {
    background: #181310;
    border: 1px solid #4a3628;
    border-radius: 0.4rem;
    padding: 0.75rem 0.9rem;
  }
  .slot-head { display: flex; align-items: center; gap: 0.6rem; }
  .s-ico { font-size: 1.6rem; }
  .s-title { margin: 0; font-size: 0.9rem; color: #fef08a; }
  .s-meta { font-size: 0.72rem; color: #bda68e; }
  .s-desc { margin: 0.35rem 0 0 0; font-size: 0.78rem; color: #ded0bc; line-height: 1.35; font-style: italic; }

  /* Impact Panel */
  .impact-title { margin: 0; font-size: 1.05rem; color: #fef08a; }
  .impact-sub { font-size: 0.75rem; color: #ba9e84; }

  .impact-config {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .impact-row { display: flex; flex-direction: column; gap: 0.35rem; }
  .i-lbl { font-size: 0.78rem; color: #cfbda9; }
  .impact-chips { display: flex; flex-direction: column; gap: 0.35rem; }
  .i-chip {
    background: #181310;
    border: 1px solid #453224;
    border-radius: 0.35rem;
    padding: 0.45rem 0.65rem;
    color: #ded0bc;
    font-size: 0.75rem;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .i-chip:hover { background: #322218; }
  .i-chip.active {
    background: #4a2c17;
    border-color: #d4af37;
    color: #fef08a;
    font-weight: bold;
  }

  .impact-row-inline {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .agi-input {
    width: 48px;
    background: #181310;
    border: 1px solid #503c2c;
    border-radius: 0.3rem;
    color: #fef08a;
    padding: 0.2rem 0.4rem;
    text-align: center;
    font-family: inherit;
  }

  .btn-impact-roll {
    width: 100%;
    padding: 0.75rem;
    background: linear-gradient(135deg, #d97706, #92400e);
    color: #181310;
    border: none;
    border-radius: 0.4rem;
    font-weight: bold;
    font-family: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .btn-impact-roll:hover:not(:disabled) { filter: brightness(1.15); transform: translateY(-1px); }

  .impact-result-box {
    background: #181310;
    border-radius: 0.4rem;
    padding: 0.75rem 0.85rem;
    border-left: 4px solid #ca8a04;
    font-size: 0.8rem;
  }
  .impact-result-box.success { border-left-color: #22c55e; background: #121f15; }
  .impact-result-box.failure { border-left-color: #ef4444; background: #261414; }
  .res-head { display: flex; justify-content: space-between; margin-bottom: 0.3rem; }
  .res-narr { margin: 0; color: #ded0bc; line-height: 1.35; font-style: italic; }

  .advice-box {
    background: #181310;
    border: 1px dashed #594230;
    border-radius: 0.4rem;
    padding: 0.65rem 0.8rem;
  }
  .adv-title { font-size: 0.72rem; color: #facc15; font-weight: bold; }
  .adv-text { margin: 0.25rem 0 0 0; font-size: 0.75rem; color: #a8947f; line-height: 1.35; }
</style>
