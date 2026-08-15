<script lang="ts">
  let { onclose }: { onclose: () => void } = $props();

  type LootItem = { name: string; qty: number; value: string; rarity: 'common' | 'uncommon' | 'rare' | 'legendary' };

  const COMMON_ITEMS = [
    'Torche','Corde (10m)','Ration de voyage','Sac de farine','Bouteille de vin','Lampe à huile',
    'Pierre à aiguiser','Couverture','Clou rouillé','Clé cassée','Vieux parchemin','Pièce étrangère',
    'Fiole vide','Herbe médicinale','Champignon séché','Fourrure de rat','Plume de corbeau',
  ];
  const UNCOMMON_ITEMS = [
    'Potion de soin mineur','Huile d\'arme +1','Parchemin de sort (niv.1)','Amulette brisée',
    'Clé ornementée','Carte au trésor fragmentée','Dague de jet','Fiole de poison faible',
    'Pierre runique gravée','Anneau de cuivre','Symbole religieux','Livre chiffré',
  ];
  const RARE_ITEMS = [
    'Potion de soin majeure','Parchemin de sort (niv.3)','Gemme semi-précieuse','Armure légère enchantée',
    'Épée à rune mineure','Cape d\'illusion courte','Bague de protection +1','Flûte elfique ancienne',
  ];
  const LEGENDARY_ITEMS = [
    'Artefact mystérieux','Parchemin de téléportation','Anneau de feu','Amulette de lich',
    'Fragment de dieu oublié','Œil de dragon','Lame maudite','Clé du Néant',
  ];

  const CURRENCY_TABLES = [
    { label: 'Pauvre', cu: [5,20], ar: [0,3], or: [0,0] },
    { label: 'Commun', cu: [10,50], ar: [2,10], or: [0,2] },
    { label: 'Riche', cu: [20,80], ar: [5,25], or: [1,8] },
    { label: 'Noble', cu: [50,150], ar: [15,60], or: [5,30] },
  ];

  function rnd(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

  let wealth = $state(1); // index dans CURRENCY_TABLES
  let itemCount = $state(3);
  let loot = $state<LootItem[]>([]);
  let coins = $state({ cu: 0, ar: 0, or: 0 });

  function generate() {
    const table = CURRENCY_TABLES[wealth];
    coins = {
      cu: rnd(table.cu[0], table.cu[1]),
      ar: rnd(table.ar[0], table.ar[1]),
      or: rnd(table.or[0], table.or[1]),
    };
    const items: LootItem[] = [];
    for (let i = 0; i < itemCount; i++) {
      const roll = Math.random();
      let name: string;
      let rarity: LootItem['rarity'];
      if (roll < 0.55) { name = pick(COMMON_ITEMS); rarity = 'common'; }
      else if (roll < 0.82) { name = pick(UNCOMMON_ITEMS); rarity = 'uncommon'; }
      else if (roll < 0.96) { name = pick(RARE_ITEMS); rarity = 'rare'; }
      else { name = pick(LEGENDARY_ITEMS); rarity = 'legendary'; }
      const existing = items.find(it => it.name === name);
      if (existing) { existing.qty++; }
      else { items.push({ name, qty: 1, value: '', rarity }); }
    }
    loot = items;
  }

  const RARITY_COLOR: Record<string, string> = {
    common: '#94a3b8', uncommon: '#22c55e', rare: '#3b82f6', legendary: '#f59e0b',
  };

  function copyToClipboard() {
    const lines = [
      `**Butin** (${CURRENCY_TABLES[wealth].label})`,
      `Monnaie: ${coins.cu} cu, ${coins.ar} ar, ${coins.or} or`,
      ...loot.map(i => `- ${i.name}${i.qty > 1 ? ' ×' + i.qty : ''} _(${i.rarity})_`),
    ].join('\n');
    navigator.clipboard.writeText(lines);
  }

  generate();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="loot-backdrop" onclick={onclose} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="loot-modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
    <div class="loot-header">
      <span>💰 Butin Rapide</span>
      <button class="loot-close" onclick={onclose}>×</button>
    </div>

    <div class="loot-controls">
      <label class="loot-label">
        Richesse
        <select class="loot-select" bind:value={wealth}>
          {#each CURRENCY_TABLES as t, i}
            <option value={i}>{t.label}</option>
          {/each}
        </select>
      </label>
      <label class="loot-label">
        Objets
        <input class="loot-input" type="number" min="0" max="10" bind:value={itemCount} />
      </label>
    </div>

    <div class="loot-coins">
      <span class="loot-coin cu">🟤 {coins.cu} cu</span>
      <span class="loot-coin ar">⚪ {coins.ar} ar</span>
      <span class="loot-coin or">🟡 {coins.or} or</span>
    </div>

    <div class="loot-items">
      {#each loot as item (item.name)}
        <div class="loot-item">
          <span class="loot-dot" style="background:{RARITY_COLOR[item.rarity]}"></span>
          <span class="loot-item-name">{item.name}</span>
          {#if item.qty > 1}<span class="loot-qty">×{item.qty}</span>{/if}
          <span class="loot-rarity" style="color:{RARITY_COLOR[item.rarity]}">{item.rarity}</span>
        </div>
      {:else}
        <div class="loot-empty">Aucun objet</div>
      {/each}
    </div>

    <div class="loot-actions">
      <button class="loot-btn loot-sec" onclick={generate}>🎲 Relancer</button>
      <button class="loot-btn loot-sec" onclick={copyToClipboard}>📋 Copier</button>
      <button class="loot-btn loot-pri" onclick={onclose}>✔ Fermer</button>
    </div>
  </div>
</div>

<style>
  .loot-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 1500;
    display: flex; align-items: center; justify-content: center;
  }
  .loot-modal {
    background: var(--bg-secondary, #161b22);
    border: 1px solid var(--border, #2d3748);
    border-radius: 12px; padding: 20px; width: 320px; max-width: 95vw;
    display: flex; flex-direction: column; gap: 12px;
    box-shadow: 0 12px 40px rgba(0,0,0,.7);
  }
  .loot-header {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 14px; font-weight: 700; color: #e5a853;
  }
  .loot-close { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 20px; }
  .loot-controls { display: flex; gap: 10px; }
  .loot-label { display: flex; flex-direction: column; gap: 3px; font-size: 11px; color: var(--text-muted); flex: 1; }
  .loot-select, .loot-input {
    background: var(--bg-tertiary, #1c2233); border: 1px solid var(--border);
    border-radius: 5px; color: var(--text-primary); padding: 5px 7px; font-size: 12px;
  }
  .loot-coins { display: flex; gap: 10px; }
  .loot-coin { font-size: 13px; font-weight: 700; }
  .loot-items { display: flex; flex-direction: column; gap: 4px; max-height: 200px; overflow-y: auto; }
  .loot-item { display: flex; align-items: center; gap: 6px; font-size: 12px; }
  .loot-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .loot-item-name { flex: 1; color: var(--text-primary, #c9d1d9); }
  .loot-qty { color: var(--text-muted); font-size: 11px; }
  .loot-rarity { font-size: 10px; text-transform: capitalize; }
  .loot-empty { color: var(--text-muted); font-style: italic; font-size: 12px; }
  .loot-actions { display: flex; gap: 6px; }
  .loot-btn { flex: 1; padding: 8px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; border: none; }
  .loot-pri { background: #e5a853; color: #000; }
  .loot-sec { background: var(--bg-tertiary); border: 1px solid var(--border); color: var(--text-muted); }
  .loot-sec:hover { border-color: var(--accent); color: var(--accent); }
</style>
