<script lang="ts">
  import { addGmToken, replaceActiveScene, addMapScene } from '$lib/stores/vtt.svelte';

  let { onClose } = $props<{ onClose: () => void }>();

  const CATALOG_URL = 'https://raw.githubusercontent.com/LordMadTrix/grimoire/main/public/library-catalog.json';

  type Tab = 'tokens' | 'maps' | 'tables';
  let activeTab = $state<Tab>('tokens');
  let search = $state('');
  let tokenCategory = $state<'all' | 'heroes' | 'enemies' | 'npcs'>('all');
  let onlineStatus = $state<'idle' | 'loading' | 'ok' | 'error'>('idle');
  let onlineTokens = $state<any[]>([]);
  let onlineMaps = $state<any[]>([]);
  let onlineTables = $state<any[]>([]);
  let showOnline = $state(false);

  async function fetchOnlineCatalog() {
    onlineStatus = 'loading';
    try {
      const res = await fetch(CATALOG_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      onlineTokens = data.tokens ?? [];
      onlineMaps = data.maps ?? [];
      onlineTables = data.tables ?? [];
      onlineStatus = 'ok';
      showOnline = true;
    } catch (e) {
      onlineStatus = 'error';
    }
  }

  // ── Catalogue tokens ─────────────────────────────────────────────
  const TOKEN_CATALOG = [
    // Héros
    { name: 'Guerrier',   path: '/tokens/library/heroes/guerrier.png',   cat: 'heroes',  isEnemy: false, hp: 20, size: 50 },
    { name: 'Magicien',   path: '/tokens/library/heroes/magicien.png',   cat: 'heroes',  isEnemy: false, hp: 12, size: 50 },
    { name: 'Rôdeur',     path: '/tokens/library/heroes/rodeur.png',     cat: 'heroes',  isEnemy: false, hp: 16, size: 50 },
    { name: 'Clerc',      path: '/tokens/library/heroes/clerc.png',      cat: 'heroes',  isEnemy: false, hp: 14, size: 50 },
    { name: 'Voleur',     path: '/tokens/library/heroes/voleur.png',     cat: 'heroes',  isEnemy: false, hp: 12, size: 50 },
    // Ennemis
    { name: 'Gobelin',    path: '/tokens/library/enemies/gobelin.png',   cat: 'enemies', isEnemy: true,  hp: 7,  size: 40 },
    { name: 'Orque',      path: '/tokens/library/enemies/orque.png',     cat: 'enemies', isEnemy: true,  hp: 15, size: 55 },
    { name: 'Squelette',  path: '/tokens/library/enemies/squelette.png', cat: 'enemies', isEnemy: true,  hp: 13, size: 45 },
    { name: 'Dragon',     path: '/tokens/library/enemies/dragon.png',    cat: 'enemies', isEnemy: true,  hp: 80, size: 90 },
    { name: 'Loup',       path: '/tokens/library/enemies/loup.png',      cat: 'enemies', isEnemy: true,  hp: 11, size: 45 },
    { name: 'Zombie',     path: '/tokens/library/enemies/zombie.png',    cat: 'enemies', isEnemy: true,  hp: 22, size: 50 },
    { name: 'Sorcier',    path: '/tokens/library/enemies/sorcier.png',   cat: 'enemies', isEnemy: true,  hp: 18, size: 50 },
    // Mimics (existants)
    { name: 'Coffre Mimic', path: '/tokens/mimics/chest.png',            cat: 'enemies', isEnemy: true,  hp: 30, size: 55 },
    { name: 'Porte Mimic',  path: '/tokens/mimics/door.png',             cat: 'enemies', isEnemy: true,  hp: 30, size: 55 },
    { name: 'Tonneau Mimic',path: '/tokens/mimics/barrel.png',           cat: 'enemies', isEnemy: true,  hp: 25, size: 50 },
    { name: 'Table Mimic',  path: '/tokens/mimics/table.png',            cat: 'enemies', isEnemy: true,  hp: 25, size: 55 },
    // PNJs
    { name: 'Marchand',   path: '/tokens/library/npcs/marchand.png',    cat: 'npcs',    isEnemy: false, hp: 8,  size: 45 },
    { name: 'Garde',      path: '/tokens/library/npcs/garde.png',       cat: 'npcs',    isEnemy: false, hp: 12, size: 50 },
    { name: 'Tavernier',  path: '/tokens/library/npcs/tavernier.png',   cat: 'npcs',    isEnemy: false, hp: 8,  size: 45 },
    { name: 'Noble',      path: '/tokens/library/npcs/noble.png',       cat: 'npcs',    isEnemy: false, hp: 10, size: 45 },
  ];

  // ── Catalogue maps ────────────────────────────────────────────────
  const MAP_CATALOG = [
    { name: 'Taverne du Griffon',  path: '/maps/library/taverne.png',   desc: 'Intérieur de taverne avec cuisine et chambres' },
    { name: 'Donjon des Ombres',   path: '/maps/library/donjon.png',    desc: 'Donjon avec salle du trône, cellules et trésorerie' },
    { name: 'Forêt des Murmures',  path: '/maps/library/foret.png',     desc: 'Zone forestière avec clairière et caverne' },
    { name: 'Château Drachenfels', path: '/maps/library/drachenfels.png', desc: 'Plan du donjon du Château Drachenfels' },
  ];

  // ── Tables génériques ─────────────────────────────────────────────
  const TABLES = [
    {
      name: 'Rencontres aléatoires — Donjon',
      rolls: [
        { range: '1-2',   result: 'Patrouille de 1d4 gardes' },
        { range: '3-4',   result: '1d6 gobelins fouilleurs' },
        { range: '5-6',   result: 'Piège dissimulé (DEX ou 1d6 dégâts)' },
        { range: '7-8',   result: 'Coffre verrouillé (Crochetage DD 15)' },
        { range: '9-10',  result: 'Passage secret (Perception DD 12)' },
        { range: '11-12', result: 'Embuscade — 2 orques et 1 shaman' },
        { range: '13-14', result: 'Salle piégée — dards empoisonnés' },
        { range: '15-16', result: 'Fantôme des anciens occupants' },
        { range: '17-18', result: 'Trésor mineur (1d20 po + objet commun)' },
        { range: '19-20', result: 'Boss de zone — mini-donjon boss' },
      ]
    },
    {
      name: 'Rencontres aléatoires — Forêt',
      rolls: [
        { range: '1-2',   result: '1d6 loups affamés' },
        { range: '3-4',   result: 'Bandit de grand chemin (x1d4)' },
        { range: '5-6',   result: 'Marchand perdu, cherche escorte' },
        { range: '7-8',   result: 'Clairière enchantée (+1 sort préparé)' },
        { range: '9-10',  result: 'Piège de chasseur (DEX DD 13)' },
        { range: '11-12', result: 'Nid de guêpes géantes (1d4)' },
        { range: '13-14', result: 'Ermite avec information utile' },
        { range: '15-16', result: 'Ruines elfiques avec gardien' },
        { range: '17-18', result: 'Feu de camp abandonné récemment' },
        { range: '19-20', result: 'Dragon endormi — passage dangereux' },
      ]
    },
    {
      name: 'Trésors aléatoires',
      rolls: [
        { range: '1-3',   result: '1d6 × 10 pièces de cuivre' },
        { range: '4-6',   result: '1d4 × 5 pièces d\'argent' },
        { range: '7-9',   result: '2d6 pièces d\'or' },
        { range: '10-12', result: 'Gemme semi-précieuse (10d4 po)' },
        { range: '13-14', result: 'Potion de soin (1d8+2 PV)' },
        { range: '15-16', result: 'Parchemin de sort (niveau 1d3)' },
        { range: '17-18', result: 'Arme ou armure +1' },
        { range: '19',    result: 'Objet magique rare' },
        { range: '20',    result: 'Artefact légendaire' },
      ]
    },
    {
      name: 'Noms de PNJ aléatoires',
      rolls: [
        { range: '1',  result: 'Aldric le Bancal' },
        { range: '2',  result: 'Marta aux Trois Doigts' },
        { range: '3',  result: 'Sigebert le Noir' },
        { range: '4',  result: 'Elsa de la Rivière' },
        { range: '5',  result: 'Borek le Sourd' },
        { range: '6',  result: 'Hildegard la Borgne' },
        { range: '7',  result: 'Gunnar Gueule-de-Fer' },
        { range: '8',  result: 'Ingrid de Middenheim' },
        { range: '9',  result: 'Manfred le Peureux' },
        { range: '10', result: 'Roswitha la Sage' },
      ]
    },
    {
      name: 'Événements de taverne',
      rolls: [
        { range: '1-2',   result: 'Bagarre qui éclate entre deux clients' },
        { range: '3-4',   result: 'Barde entame une chanson grivoise' },
        { range: '5-6',   result: 'Un inconnu propose un contrat louche' },
        { range: '7-8',   result: 'Pickpocket tente de dérober une bourse' },
        { range: '9-10',  result: 'Rumeur : un trésor dans les collines' },
        { range: '11-12', result: 'Officier de la loi cherche des fugitifs' },
        { range: '13-14', result: 'Concours de boisson (CON DD 12)' },
        { range: '15-16', result: 'Noble incognito en voyage secret' },
        { range: '17-18', result: 'Messager arrive avec lettre urgente' },
        { range: '19-20', result: 'Attaque surprise — bandits masqués' },
      ]
    },
  ];

  let tokenCount = 0;

  function addToken(t: { name: string; path?: string; url?: string; size: number; hp: number; isEnemy: boolean }) {
    tokenCount++;
    const imageUrl = t.url ?? t.path ?? '';
    addGmToken({
      id: Math.random().toString(36).slice(2),
      name: t.name,
      x: 125 + (tokenCount % 8) * 65,
      y: 125 + Math.floor(tokenCount / 8) * 65,
      size: t.size,
      imageUrl,
      hp: t.hp,
      maxHp: t.hp,
      visionRange: 0,
      isEnemy: t.isEnemy,
    });
  }

  function loadMap(m: { name: string; path?: string; url?: string; desc?: string }, asNew = false) {
    const src = m.url ?? m.path ?? '';
    if (asNew) addMapScene(m.name, src, src);
    else replaceActiveScene(m.name, src, src);
    onClose();
  }

  let diceResult = $state<string | null>(null);
  function rollTable(table: typeof TABLES[0]) {
    const roll = Math.floor(Math.random() * 20) + 1;
    const entry = table.rolls.find(r => {
      const [lo, hi] = r.range.split('-').map(Number);
      return roll >= lo && roll <= (hi ?? lo);
    });
    diceResult = `🎲 ${roll} → ${entry?.result ?? '?'}`;
  }

  $derived: {
    const q = search.toLowerCase();
    filteredTokens = TOKEN_CATALOG.filter(t =>
      (tokenCategory === 'all' || t.cat === tokenCategory) &&
      (!q || t.name.toLowerCase().includes(q))
    );
    filteredMaps = MAP_CATALOG.filter(m => !q || m.name.toLowerCase().includes(q));
    filteredTables = TABLES.filter(t => !q || t.name.toLowerCase().includes(q));
  }

  let filteredTokens = $state(TOKEN_CATALOG);
  let filteredMaps = $state(MAP_CATALOG);
  let filteredTables = $state(TABLES);

  $effect(() => {
    const q = search.toLowerCase();
    filteredTokens = TOKEN_CATALOG.filter(t =>
      (tokenCategory === 'all' || t.cat === tokenCategory) &&
      (!q || t.name.toLowerCase().includes(q))
    );
    filteredMaps = MAP_CATALOG.filter(m => !q || m.name.toLowerCase().includes(q));
    filteredTables = TABLES.filter(t => !q || t.name.toLowerCase().includes(q));
  });
</script>

<div class="lib-backdrop" onclick={onClose}>
  <div class="lib-modal" onclick={e => e.stopPropagation()}>
    <div class="lib-header">
      <span class="lib-title">📚 Bibliothèque Commune</span>
      <button class="lib-close" onclick={onClose}>✕</button>
    </div>

    <div class="lib-search-bar">
      <input class="lib-search" type="text" placeholder="Rechercher…" bind:value={search} />
    </div>

    <div class="lib-tabs">
      <button class="lib-tab" class:active={activeTab === 'tokens'} onclick={() => activeTab = 'tokens'}>🪙 Tokens</button>
      <button class="lib-tab" class:active={activeTab === 'maps'}   onclick={() => activeTab = 'maps'}>🗺️ Maps</button>
      <button class="lib-tab" class:active={activeTab === 'tables'} onclick={() => activeTab = 'tables'}>🎲 Tables</button>
      <div class="lib-tab-spacer"></div>
      {#if onlineStatus === 'idle'}
        <button class="lib-tab online-btn" onclick={fetchOnlineCatalog}>🌐 En ligne</button>
      {:else if onlineStatus === 'loading'}
        <span class="lib-tab online-loading">⏳ Chargement…</span>
      {:else if onlineStatus === 'error'}
        <button class="lib-tab online-btn error" onclick={fetchOnlineCatalog}>⚠️ Réessayer</button>
      {:else}
        <button class="lib-tab online-btn active" onclick={() => showOnline = !showOnline}>🌐 En ligne ✓</button>
      {/if}
    </div>

    <div class="lib-body">

      <!-- TOKENS -->
      {#if activeTab === 'tokens'}
        <div class="lib-cat-bar">
          {#each [['all','Tous'],['heroes','Héros'],['enemies','Ennemis'],['npcs','PNJs']] as [val, label]}
            <button class="cat-btn" class:active={tokenCategory === val} onclick={() => tokenCategory = val}>{label}</button>
          {/each}
        </div>
        <div class="section-label">Intégrés</div>
        <div class="token-grid">
          {#each filteredTokens as t}
            <button class="token-card" onclick={() => addToken(t)} title="Ajouter sur la map">
              <img src={t.path} alt={t.name} class="token-img" />
              <span class="token-name">{t.name}</span>
              <span class="token-hp">❤️ {t.hp}</span>
            </button>
          {/each}
          {#if filteredTokens.length === 0}
            <p class="lib-empty">Aucun token trouvé.</p>
          {/if}
        </div>

        {#if showOnline && onlineTokens.length > 0}
          <div class="section-label online">🌐 En ligne — Open Game Content (CC BY 3.0)</div>
          <div class="token-grid">
            {#each onlineTokens.filter(t => (tokenCategory === 'all' || t.cat === tokenCategory) && (!search || t.name.toLowerCase().includes(search.toLowerCase()))) as t}
              <button class="token-card online" onclick={() => addToken(t)} title="Ajouter sur la map">
                <img src={t.url} alt={t.name} class="token-img svg-token" />
                <span class="token-name">{t.name}</span>
                <span class="token-hp">❤️ {t.hp}</span>
              </button>
            {/each}
          </div>
        {/if}

      <!-- MAPS -->
      {:else if activeTab === 'maps'}
        <div class="section-label">Intégrées</div>
        <div class="map-grid">
          {#each filteredMaps as m}
            <div class="map-card">
              <img src={m.path} alt={m.name} class="map-thumb" />
              <div class="map-info">
                <span class="map-name">{m.name}</span>
                <span class="map-desc">{m.desc}</span>
                <div class="map-actions">
                  <button class="map-btn" onclick={() => loadMap(m)}>Charger</button>
                  <button class="map-btn secondary" onclick={() => loadMap(m, true)}>+ Scène</button>
                </div>
              </div>
            </div>
          {/each}
          {#if filteredMaps.length === 0}
            <p class="lib-empty">Aucune map trouvée.</p>
          {/if}
        </div>

        {#if showOnline && onlineMaps.length > 0}
          <div class="section-label online">🌐 En ligne</div>
          <div class="map-grid">
            {#each onlineMaps.filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase())) as m}
              <div class="map-card">
                <img src={m.url} alt={m.name} class="map-thumb" />
                <div class="map-info">
                  <span class="map-name">{m.name}</span>
                  <span class="map-desc">{m.desc}</span>
                  <span class="map-license">{m.license}</span>
                  <div class="map-actions">
                    <button class="map-btn" onclick={() => loadMap(m)}>Charger</button>
                    <button class="map-btn secondary" onclick={() => loadMap(m, true)}>+ Scène</button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}

      <!-- TABLES -->
      {:else}
        {#if diceResult}
          <div class="dice-result">{diceResult}</div>
        {/if}
        <div class="section-label">Intégrées</div>
        <div class="tables-list">
          {#each filteredTables as table}
            <div class="table-card">
              <div class="table-header">
                <span class="table-name">{table.name}</span>
                <button class="roll-btn" onclick={() => rollTable(table)}>🎲 Lancer d20</button>
              </div>
              <table class="roll-table">
                <thead><tr><th>Résultat</th><th>Événement</th></tr></thead>
                <tbody>
                  {#each table.rolls as row}
                    <tr><td class="roll-range">{row.range}</td><td>{row.result}</td></tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/each}
          {#if filteredTables.length === 0}
            <p class="lib-empty">Aucune table trouvée.</p>
          {/if}
        </div>

        {#if showOnline && onlineTables.length > 0}
          <div class="section-label online">🌐 En ligne</div>
          <div class="tables-list">
            {#each onlineTables.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase())) as table}
              <div class="table-card">
                <div class="table-header">
                  <span class="table-name">{table.name}</span>
                  <button class="roll-btn" onclick={() => rollTable(table)}>🎲 Lancer d20</button>
                </div>
                <table class="roll-table">
                  <thead><tr><th>Résultat</th><th>Événement</th></tr></thead>
                  <tbody>
                    {#each table.rolls as row}
                      <tr><td class="roll-range">{row.range}</td><td>{row.result}</td></tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
.lib-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:1000; display:flex; align-items:center; justify-content:center; }
.lib-modal { background:#1a1614; border:1px solid #3a3028; border-radius:10px; width:820px; max-height:85vh; display:flex; flex-direction:column; overflow:hidden; }
.lib-header { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-bottom:1px solid #2a2420; }
.lib-title { font-size:1.1rem; font-weight:700; color:#d4a84b; }
.lib-close { background:none; border:none; color:#888; font-size:1.2rem; cursor:pointer; }
.lib-close:hover { color:#fff; }
.lib-search-bar { padding:10px 18px; border-bottom:1px solid #2a2420; }
.lib-search { width:100%; background:#111; border:1px solid #3a3028; border-radius:6px; padding:7px 12px; color:#ddd; font-size:.9rem; outline:none; }
.lib-tabs { display:flex; gap:4px; padding:10px 18px 0; border-bottom:1px solid #2a2420; }
.lib-tab { background:none; border:none; border-bottom:2px solid transparent; color:#888; padding:6px 16px; cursor:pointer; font-size:.9rem; }
.lib-tab.active { color:#d4a84b; border-bottom-color:#d4a84b; }
.lib-body { flex:1; overflow-y:auto; padding:14px 18px; }
.lib-empty { color:#666; text-align:center; padding:30px; }

/* Tokens */
.lib-cat-bar { display:flex; gap:6px; margin-bottom:12px; }
.cat-btn { background:#222; border:1px solid #333; border-radius:5px; color:#aaa; padding:4px 12px; cursor:pointer; font-size:.82rem; }
.cat-btn.active { background:#3a2a10; border-color:#d4a84b; color:#d4a84b; }
.token-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(90px,1fr)); gap:10px; }
.token-card { background:#111; border:1px solid #2a2420; border-radius:8px; padding:10px 6px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:4px; transition:.15s; }
.token-card:hover { border-color:#d4a84b; background:#1f1a10; }
.token-img { width:56px; height:56px; border-radius:50%; object-fit:cover; }
.token-name { font-size:.75rem; color:#ccc; text-align:center; }
.token-hp { font-size:.7rem; color:#888; }

/* Maps */
.map-grid { display:flex; flex-direction:column; gap:12px; }
.map-card { display:flex; gap:14px; background:#111; border:1px solid #2a2420; border-radius:8px; overflow:hidden; }
.map-thumb { width:160px; height:100px; object-fit:cover; flex-shrink:0; }
.map-info { display:flex; flex-direction:column; justify-content:center; gap:6px; padding:10px; }
.map-name { font-weight:600; color:#d4a84b; font-size:.95rem; }
.map-desc { font-size:.8rem; color:#888; }
.map-actions { display:flex; gap:8px; }
.map-btn { background:#3a2a10; border:1px solid #d4a84b; color:#d4a84b; border-radius:5px; padding:4px 14px; cursor:pointer; font-size:.82rem; }
.map-btn:hover { background:#4a3820; }
.map-btn.secondary { background:#222; border-color:#555; color:#aaa; }
.map-btn.secondary:hover { background:#333; }

/* Tables */
.dice-result { background:#3a2a10; border:1px solid #d4a84b; border-radius:6px; padding:10px 14px; color:#e8c46a; font-weight:600; margin-bottom:12px; }
.tables-list { display:flex; flex-direction:column; gap:16px; }
.table-card { background:#111; border:1px solid #2a2420; border-radius:8px; overflow:hidden; }
.table-header { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:#1a1614; border-bottom:1px solid #2a2420; }
.table-name { font-weight:600; color:#d4a84b; font-size:.9rem; }
.roll-btn { background:#3a2a10; border:1px solid #d4a84b; color:#d4a84b; border-radius:5px; padding:4px 12px; cursor:pointer; font-size:.82rem; }
.roll-btn:hover { background:#4a3820; }
.roll-table { width:100%; border-collapse:collapse; font-size:.82rem; }
.roll-table th { padding:6px 12px; background:#151210; color:#888; text-align:left; border-bottom:1px solid #2a2420; }
.roll-table td { padding:5px 12px; color:#ccc; border-bottom:1px solid #1a1614; }
.roll-table tr:last-child td { border-bottom:none; }
.roll-table tr:hover td { background:#1a1614; }
.roll-range { color:#d4a84b; font-weight:600; width:60px; }

.lib-tab-spacer { flex:1; }
.online-btn { color:#4a9eff; border-bottom-color:transparent; }
.online-btn.active { color:#4a9eff; border-bottom-color:#4a9eff; }
.online-btn.error { color:#ef4444; }
.online-loading { color:#888; padding:6px 16px; font-size:.9rem; }

.section-label { font-size:.75rem; font-weight:600; color:#666; text-transform:uppercase; letter-spacing:.06em; margin:12px 0 8px; padding-bottom:4px; border-bottom:1px solid #2a2420; }
.section-label.online { color:#4a9eff; border-bottom-color:#1a3a5a; }

.token-card.online { border-color:#1a3a5a; }
.token-card.online:hover { border-color:#4a9eff; background:#0d1f30; }
.svg-token { filter: invert(1) sepia(1) saturate(2) hue-rotate(190deg); background:#1a3060; border-radius:50%; padding:6px; }
.map-license { font-size:.72rem; color:#4a9eff; }
</style>
