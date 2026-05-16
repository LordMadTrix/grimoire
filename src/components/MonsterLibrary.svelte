<script lang="ts">
  import { addGmToken } from '$lib/stores/vtt.svelte';
  import { vttStore } from '$lib/stores/vtt.svelte';
  import { readFile, writeFile, readFileBase64 } from '$lib/api';
  import { getVaultPath } from '$lib/stores/vault.svelte';

  let visible = $state(false);
  let search = $state('');
  let filterCR = $state('');

  export function toggle() { visible = !visible; }

  interface Monster {
    name: string;
    type: string;
    cr: string;
    hp: number;
    ac: number;
    size: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';
    isEnemy: boolean;
    color: number;
    imageUrl?: string;
  }

  const SIZE_PX: Record<string, number> = {
    Tiny: 25, Small: 35, Medium: 50, Large: 75, Huge: 100, Gargantuan: 150
  };

  const BUILTIN: Monster[] = [
    { name: 'Gobelin', type: 'Humanoïde', cr: '1/4', hp: 7,  ac: 15, size: 'Small',  isEnemy: true,  color: 0x4ade80 },
    { name: 'Orc',     type: 'Humanoïde', cr: '1/2', hp: 15, ac: 13, size: 'Medium', isEnemy: true,  color: 0x86efac },
    { name: 'Hobgoblin', type: 'Humanoïde', cr: '1/2', hp: 11, ac: 18, size: 'Medium', isEnemy: true, color: 0xfbbf24 },
    { name: 'Squelette', type: 'Mort-vivant', cr: '1/4', hp: 13, ac: 13, size: 'Medium', isEnemy: true, color: 0xe5e7eb },
    { name: 'Zombie',   type: 'Mort-vivant', cr: '1/4', hp: 22, ac: 8,  size: 'Medium', isEnemy: true,  color: 0x6b7280 },
    { name: 'Loup',     type: 'Bête',       cr: '1/4', hp: 11, ac: 13, size: 'Medium', isEnemy: true,  color: 0x9ca3af },
    { name: 'Araignée géante', type: 'Bête', cr: '1', hp: 26, ac: 14, size: 'Large', isEnemy: true, color: 0x1c1917 },
    { name: 'Ogre',     type: 'Géant',      cr: '2',  hp: 59, ac: 11, size: 'Large',  isEnemy: true,  color: 0x92400e },
    { name: 'Troll',    type: 'Géant',      cr: '5',  hp: 84, ac: 15, size: 'Large',  isEnemy: true,  color: 0x166534 },
    { name: 'Gnoll',    type: 'Humanoïde',  cr: '1/2', hp: 22, ac: 15, size: 'Medium', isEnemy: true, color: 0xa16207 },
    { name: 'Vampire',  type: 'Mort-vivant', cr: '13', hp: 144, ac: 16, size: 'Medium', isEnemy: true, color: 0x7f1d1d },
    { name: 'Bandit',   type: 'Humanoïde',  cr: '1/8', hp: 11, ac: 12, size: 'Medium', isEnemy: false, color: 0x6b7280 },
    { name: 'Garde',    type: 'Humanoïde',  cr: '1/8', hp: 11, ac: 16, size: 'Medium', isEnemy: false, color: 0x1e40af },
    { name: 'Chevalier', type: 'Humanoïde', cr: '3',  hp: 52, ac: 18, size: 'Medium', isEnemy: false, color: 0xf59e0b },
    { name: 'Wyrmling de dragon rouge', type: 'Dragon', cr: '4', hp: 75, ac: 17, size: 'Medium', isEnemy: true, color: 0xdc2626 },
    { name: 'Wyverne',  type: 'Dragon',     cr: '6',  hp: 110, ac: 13, size: 'Large', isEnemy: true,  color: 0x065f46 },
    { name: 'Minotaure', type: 'Monstruosité', cr: '3', hp: 114, ac: 14, size: 'Large', isEnemy: true, color: 0x7c3aed },
    { name: 'Méduse',   type: 'Monstruosité', cr: '6', hp: 127, ac: 15, size: 'Medium', isEnemy: true, color: 0x0891b2 },
    { name: 'Manticore', type: 'Monstruosité', cr: '3', hp: 68, ac: 14, size: 'Large', isEnemy: true, color: 0xb45309 },
    { name: 'Liche',    type: 'Mort-vivant', cr: '21', hp: 135, ac: 17, size: 'Medium', isEnemy: true, color: 0x4c1d95 },
    // Pack Mimic
    { name: 'Mimic Coffre', type: 'Monstruosité', cr: '2', hp: 58, ac: 12, size: 'Medium', isEnemy: true, color: 0x92400e, imageUrl: '/tokens/mimics/chest.png' },
    { name: 'Mimic Porte',  type: 'Monstruosité', cr: '3', hp: 75, ac: 14, size: 'Large',  isEnemy: true, color: 0x6b7280, imageUrl: '/tokens/mimics/door.png' },
    { name: 'Mimic Baril',  type: 'Monstruosité', cr: '2', hp: 45, ac: 12, size: 'Medium', isEnemy: true, color: 0x78350f, imageUrl: '/tokens/mimics/barrel.png' },
    { name: 'Mimic Table',  type: 'Monstruosité', cr: '2', hp: 52, ac: 12, size: 'Medium', isEnemy: true, color: 0xa16207, imageUrl: '/tokens/mimics/table.png' },
  ];

  let customMonsters = $state<Monster[]>([]);

  $effect(() => {
    const vp = getVaultPath();
    if (!vp) return;
    readFile(vp, '.grimoire/monsters.json').then(raw => {
      try { customMonsters = JSON.parse(raw) ?? []; } catch {}
    }).catch(() => {});
  });
  
  let monsterImages = $state<Record<string, string>>({});
  async function getMonsterImage(path: string) {
    if (monsterImages[path]) return monsterImages[path];
    if (path.startsWith('/')) {
      monsterImages[path] = path; // Browser can handle root-relative paths for public assets
      return path;
    }
    const vp = getVaultPath();
    if (!vp) return '';
    try {
      const b64 = await readFileBase64(`${vp}/${path}`);
      const ext = path.split('.').pop()?.toLowerCase() ?? 'png';
      const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : `image/${ext}`;
      const url = `data:${mime};base64,${b64}`;
      monsterImages[path] = url;
      return url;
    } catch { return ''; }
  }

  let allMonsters = $derived([...BUILTIN, ...customMonsters]);
  function crToNum(s: string): number {
    if (s.includes('/')) {
      const [n, d] = s.split('/').map(Number);
      return d ? n / d : 0;
    }
    return Number(s);
  }

  let CRS = $derived([...new Set(allMonsters.map(m => m.cr))].sort((a, b) => crToNum(a) - crToNum(b)));

  let filtered = $derived(allMonsters.filter(m => {
    const q = search.toLowerCase();
    return (q === '' || m.name.toLowerCase().includes(q) || m.type.toLowerCase().includes(q))
      && (filterCR === '' || m.cr === filterCR);
  }));

  let tokenCounter = 0;
  function spawnToken(m: Monster) {
    tokenCounter++;
    const gs = vttStore.gridSize;
    addGmToken({
      id: Math.random().toString(36).slice(2),
      name: m.name,
      x: 100 + (tokenCounter % 8) * (gs + 10),
      y: 100 + Math.floor(tokenCounter / 8) * (gs + 10),
      size: SIZE_PX[m.size] ?? 50,
      color: m.color,
      hp: m.hp,
      maxHp: m.hp,
      isEnemy: m.isEnemy,
      visible: true,
      imageUrl: m.imageUrl,
    });
  }

  // Générateur de rencontres
  let showEncounterGen = $state(false);
  let encMinCR = $state('0');
  let encMaxCR = $state('5');
  let encCount = $state(4);
  let generatedEncounter = $state<Monster[]>([]);

  function generateEncounter() {
    const minCR = crToNum(encMinCR) || 0;
    const maxCR = crToNum(encMaxCR) || 999;
    const pool = allMonsters.filter(m => {
      const cr = crToNum(m.cr);
      return cr >= minCR && cr <= maxCR && m.isEnemy;
    });
    if (pool.length === 0) { generatedEncounter = []; return; }
    const result: Monster[] = [];
    for (let i = 0; i < encCount; i++) {
      result.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    generatedEncounter = result;
  }

  function spawnEncounter() {
    for (const m of generatedEncounter) spawnToken(m);
    generatedEncounter = [];
    showEncounterGen = false;
  }

  let showImport = $state(false);
  let importJson = $state('');

  async function importCustom() {
    try {
      const arr: Monster[] = JSON.parse(importJson);
      customMonsters = [...customMonsters, ...arr];
      const vp = getVaultPath();
      if (vp) await writeFile(vp, '.grimoire/monsters.json', JSON.stringify(customMonsters, null, 2));
      showImport = false;
      importJson = '';
    } catch { alert('JSON invalide'); }
  }
</script>

<button class="ml-toggle" onclick={() => visible = !visible} title="Bibliothèque de monstres">🐉</button>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="ml-backdrop" onclick={() => visible = false}>
    <div class="ml-panel" onclick={e => e.stopPropagation()}>
      <div class="ml-header">
        <span>🐉 Bibliothèque</span>
        <button class="ml-import-btn" onclick={() => { showEncounterGen = !showEncounterGen; showImport = false; }} title="Générateur de rencontre">🎲</button>
        <button class="ml-import-btn" onclick={() => { showImport = !showImport; showEncounterGen = false; }} title="Importer JSON">📥</button>
        <button class="ml-close" onclick={() => visible = false}>✕</button>
      </div>

      <div class="ml-filters">
        <input type="text" class="ml-search" bind:value={search} placeholder="Chercher…" />
        <select class="ml-cr" bind:value={filterCR}>
          <option value="">CR…</option>
          {#each CRS as cr}
            <option value={cr}>CR {cr}</option>
          {/each}
        </select>
      </div>

      {#if showEncounterGen}
        <div class="ml-encounter-gen">
          <div class="enc-row">
            <label>CR min
              <select bind:value={encMinCR}>
                {#each CRS as cr}<option value={cr}>CR {cr}</option>{/each}
              </select>
            </label>
            <label>CR max
              <select bind:value={encMaxCR}>
                {#each CRS as cr}<option value={cr}>CR {cr}</option>{/each}
              </select>
            </label>
            <label>Nombre
              <input type="number" min="1" max="20" bind:value={encCount} class="enc-count" />
            </label>
            <button class="ml-import-ok" onclick={generateEncounter}>🎲 Générer</button>
          </div>
          {#if generatedEncounter.length > 0}
            <div class="enc-result">
              {#each generatedEncounter as m, i}
                <span class="enc-chip" style="border-color: #{m.color.toString(16).padStart(6,'0')}">
                  {m.name} (CR {m.cr})
                </span>
              {/each}
            </div>
            <button class="ml-import-ok enc-spawn" onclick={spawnEncounter}>Poser sur la carte</button>
          {/if}
        </div>
      {/if}

      {#if showImport}
        <div class="ml-import">
          <textarea bind:value={importJson} rows="4" placeholder='[{{"name":"Dragon","type":"Dragon","cr":"5","hp":100,"ac":14,"size":"Large","isEnemy":true,"color":16711680}}]'></textarea>
          <button onclick={importCustom} class="ml-import-ok">Importer</button>
        </div>
      {/if}

      <div class="ml-list">
        {#each filtered as m}
          <div class="ml-row">
            {#if m.imageUrl}
              {#await getMonsterImage(m.imageUrl)}
                <div class="ml-color" style="background: #{m.color.toString(16).padStart(6,'0')}"></div>
              {:then url}
                {#if url}
                  <img src={url} class="ml-img" alt={m.name} />
                {:else}
                  <div class="ml-color" style="background: #{m.color.toString(16).padStart(6,'0')}"></div>
                {/if}
              {/await}
            {:else}
              <div class="ml-color" style="background: #{m.color.toString(16).padStart(6,'0')}"></div>
            {/if}
            <div class="ml-info">
              <span class="ml-name">{m.name}</span>
              <span class="ml-meta">CR {m.cr} · {m.type} · {m.size}</span>
            </div>
            <div class="ml-stats">
              <span>PV {m.hp}</span>
              <span>CA {m.ac}</span>
            </div>
            <button class="ml-spawn" onclick={() => spawnToken(m)} title="Poser sur la carte">+</button>
          </div>
        {/each}
        {#if filtered.length === 0}
          <div class="ml-empty">Aucun monstre trouvé</div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .ml-toggle {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .ml-toggle:hover { background: var(--bg-hover); }

  .ml-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 9000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ml-panel {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    width: 500px;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 48px rgba(0,0,0,0.5);
    overflow: hidden;
    animation: slideDown 0.15s ease-out;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .ml-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .ml-import-btn, .ml-close {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 14px;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .ml-import-btn { margin-left: auto; }
  .ml-import-btn:hover, .ml-close:hover { background: var(--bg-hover); }

  .ml-filters {
    display: flex;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
  }

  .ml-search {
    flex: 1;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    outline: none;
  }
  .ml-search:focus { border-color: var(--accent); }

  .ml-cr {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    outline: none;
    width: 80px;
  }

  .ml-import {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
  }

  .ml-import textarea {
    width: 100%;
    box-sizing: border-box;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    padding: 6px;
    border-radius: 6px;
    font-size: 11px;
    font-family: monospace;
    resize: vertical;
  }

  .ml-import-ok {
    margin-top: 6px;
    background: var(--accent);
    border: none;
    color: #000;
    padding: 4px 14px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
  }

  .ml-encounter-gen {
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-tertiary);
  }
  .enc-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .enc-row label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-secondary);
  }
  .enc-row select, .enc-count {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 12px;
  }
  .enc-count { width: 50px; }
  .enc-result {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 8px;
  }
  .enc-chip {
    padding: 2px 8px;
    border-radius: 12px;
    border: 1px solid;
    font-size: 11px;
    color: var(--text-primary);
    background: var(--bg-secondary);
  }
  .enc-spawn { margin-top: 8px; display: block; }

  .ml-list {
    overflow-y: auto;
    flex: 1;
    padding: 6px;
  }

  .ml-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 6px;
    transition: background 0.1s;
  }
  .ml-row:hover { background: var(--bg-hover); }

  .ml-color {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    flex-shrink: 0;
    border: 1px solid rgba(255,255,255,0.2);
  }

  .ml-img {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    border: 1px solid var(--accent);
  }

  .ml-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .ml-name {
    font-size: 13px;
    color: var(--text-primary);
    font-weight: 500;
  }

  .ml-meta {
    font-size: 10px;
    color: var(--text-muted);
  }

  .ml-stats {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1px;
    font-size: 10px;
    color: var(--text-secondary);
    font-family: monospace;
    width: 50px;
  }

  .ml-spawn {
    background: var(--accent);
    border: none;
    color: #000;
    font-weight: 700;
    font-size: 16px;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    cursor: pointer;
    flex-shrink: 0;
    transition: transform 0.1s;
  }
  .ml-spawn:hover { transform: scale(1.1); }

  .ml-empty {
    padding: 32px;
    text-align: center;
    font-size: 13px;
    color: var(--text-muted);
  }
</style>
