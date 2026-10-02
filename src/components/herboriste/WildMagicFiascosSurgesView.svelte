<script lang="ts">
  import {
    CHAOS_FIASCOS,
    CHAOS_PRODIGES,
    type ChaosSurge
  } from '$lib/herboriste/data/chaosSurgesData';

  const ALL_SURGES = [...CHAOS_FIASCOS, ...CHAOS_PRODIGES];

  let selectedCategory = $state<'tous' | 'alchimie' | 'gemme' | 'cueillette' | 'sertissage'>('tous');
  let selectedType = $state<'tous' | 'fiasco' | 'prodige'>('tous');
  let searchQuery = $state<string>('');

  // Roller state
  let isRolling = $state<boolean>(false);
  let rolledD100 = $state<number | null>(null);
  let activeSurge = $state<ChaosSurge | null>(null);
  let copyFeedback = $state<string | null>(null);

  const filteredSurges = $derived(
    ALL_SURGES.filter((s) => {
      const matchCat = selectedCategory === 'tous' || s.category === selectedCategory;
      const matchType = selectedType === 'tous' || s.type === selectedType;
      const matchSearch =
        searchQuery === '' ||
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.effect.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.humorLore.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchType && matchSearch;
    })
  );

  function rollChaos(forcedType?: 'fiasco' | 'prodige') {
    isRolling = true;
    activeSurge = null;

    setTimeout(() => {
      let d100: number;
      if (forcedType === 'fiasco') {
        d100 = Math.floor(Math.random() * 50) + 1; // 1 to 50
      } else if (forcedType === 'prodige') {
        d100 = Math.floor(Math.random() * 50) + 51; // 51 to 100
      } else {
        d100 = Math.floor(Math.random() * 100) + 1;
      }

      rolledD100 = d100;
      const found = ALL_SURGES.find((s) => d100 >= s.d100Range[0] && d100 <= s.d100Range[1]);
      activeSurge = found ?? ALL_SURGES[0];
      isRolling = false;
    }, 450);
  }

  function copySurge(s: ChaosSurge) {
    const text = `### 🎲 ${s.type === 'fiasco' ? '💥 Fiasco' : '✨ Prodige'} : ${s.title} (d100: ${s.d100Range[0]}-${s.d100Range[1]})
- **Catégorie :** ${s.category.toUpperCase()}
- **Effet narratif :** ${s.effect}
- **Règle de jeu :** ${s.gameRule}
*${s.humorLore}*`;

    navigator.clipboard.writeText(text).then(() => {
      copyFeedback = 'Copié !';
      setTimeout(() => (copyFeedback = null), 2000);
    });
  }
</script>

<div class="surges-container">
  <!-- Banner -->
  <div class="banner">
    <div class="banner-title-row">
      <span class="banner-icon">🎲</span>
      <div>
        <h2 class="banner-title">Table des Fiascos Comiques & Prodiges Inattendus</h2>
        <p class="banner-subtitle">
          Quand la magie brute s'en mêle lors d'un échec cuisant ou d'un coup de maître : 40 péripéties rôlistes à la Naheulbeuk prêtes à jouer.
        </p>
      </div>
    </div>
  </div>

  <!-- Interactive Roller Hero -->
  <div class="roller-hero">
    <div class="hero-left">
      <h3 class="hero-title">Lancer le Dé de Chaos Alchimique (d100)</h3>
      <p class="hero-desc">
        Déclenchez une surprise lors d'un 1 ou 20 naturel sur vos tests d'Herboristerie, Alchimie ou Taille de gemme.
      </p>

      <div class="hero-buttons">
        <button
          type="button"
          class="btn-roll random"
          onclick={() => rollChaos()}
          disabled={isRolling}
        >
          <span>🎲</span> Tirage Aléatoire (1-100)
        </button>

        <button
          type="button"
          class="btn-roll fiasco"
          onclick={() => rollChaos('fiasco')}
          disabled={isRolling}
        >
          <span>💥</span> Forcer un Fiasco (1-50)
        </button>

        <button
          type="button"
          class="btn-roll prodige"
          onclick={() => rollChaos('prodige')}
          disabled={isRolling}
        >
          <span>✨</span> Forcer un Prodige (51-100)
        </button>
      </div>
    </div>

    <!-- Die Display & Active Surge -->
    <div class="hero-right">
      {#if isRolling}
        <div class="rolling-spinner">
          <span class="d-anim">🎲</span>
          <span class="d-txt">Le destin tourne...</span>
        </div>
      {:else if activeSurge && rolledD100 !== null}
        <div class="active-surge-card" class:fiasco={activeSurge.type === 'fiasco'} class:prodige={activeSurge.type === 'prodige'}>
          <div class="surge-top">
            <span class="d100-badge">d100 : {rolledD100}</span>
            <span class="type-badge">{activeSurge.type === 'fiasco' ? '💥 Fiasco Hilarant' : '✨ Prodige Divin'}</span>
            <span class="cat-badge">{activeSurge.category}</span>
          </div>

          <h4 class="surge-title">{activeSurge.title}</h4>
          <p class="surge-effect">{activeSurge.effect}</p>

          <div class="surge-rule">
            <strong>Règle en jeu :</strong> {activeSurge.gameRule}
          </div>

          <div class="surge-lore">{activeSurge.humorLore}</div>

          <button type="button" class="btn-copy-surge" onclick={() => copySurge(activeSurge!)}>
            <span>📋</span> {copyFeedback ?? 'Copier pour le MJ / Chat'}
          </button>
        </div>
      {:else}
        <div class="hero-placeholder">
          <span class="ph-ico">🎯</span>
          <p>Cliquez sur l'un des boutons pour tirer une péripétie au dé 100.</p>
        </div>
      {/if}
    </div>
  </div>

  <!-- Filter & Search Toolbar -->
  <div class="table-toolbar">
    <div class="search-input-wrap">
      <span class="srch-ico">🔍</span>
      <input
        type="text"
        placeholder="Rechercher une péripétie, un effet ou une blague..."
        bind:value={searchQuery}
        class="search-input"
      />
    </div>

    <div class="filters-row">
      <div class="pill-group">
        <button type="button" class="pill" class:active={selectedType === 'tous'} onclick={() => (selectedType = 'tous')}>Tous</button>
        <button type="button" class="pill" class:active={selectedType === 'fiasco'} onclick={() => (selectedType = 'fiasco')}>💥 Fiascos</button>
        <button type="button" class="pill" class:active={selectedType === 'prodige'} onclick={() => (selectedType = 'prodige')}>✨ Prodiges</button>
      </div>

      <div class="pill-group">
        <button type="button" class="pill" class:active={selectedCategory === 'tous'} onclick={() => (selectedCategory = 'tous')}>Toutes catégories</button>
        <button type="button" class="pill" class:active={selectedCategory === 'alchimie'} onclick={() => (selectedCategory = 'alchimie')}>⚗️ Alchimie</button>
        <button type="button" class="pill" class:active={selectedCategory === 'gemme'} onclick={() => (selectedCategory = 'gemme')}>💎 Gemmes</button>
        <button type="button" class="pill" class:active={selectedCategory === 'cueillette'} onclick={() => (selectedCategory = 'cueillette')}>🌿 Cueillette</button>
        <button type="button" class="pill" class:active={selectedCategory === 'sertissage'} onclick={() => (selectedCategory = 'sertissage')}>💍 Sertissage</button>
      </div>
    </div>
  </div>

  <!-- Browsable Table List -->
  <div class="surges-grid">
    {#each filteredSurges as s}
      <div
        class="surge-list-card"
        class:is-fiasco={s.type === 'fiasco'}
        class:is-prodige={s.type === 'prodige'}
      >
        <div class="sl-head">
          <span class="sl-range">d100 [{s.d100Range[0]}-{s.d100Range[1]}]</span>
          <span class="sl-type">{s.type === 'fiasco' ? '💥 Fiasco' : '✨ Prodige'}</span>
          <span class="sl-cat">{s.category}</span>
        </div>

        <h4 class="sl-title">{s.title}</h4>
        <p class="sl-effect">{s.effect}</p>

        <div class="sl-rule">
          <span>⚙️ <strong>Impact :</strong> {s.gameRule}</span>
        </div>

        <div class="sl-lore">{s.humorLore}</div>

        <button type="button" class="sl-copy" onclick={() => copySurge(s)}>
          <span>📋 Copier</span>
        </button>
      </div>
    {/each}
  </div>
</div>

<style>
  .surges-container {
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
    background: #1c1424;
    border: 2px solid #a855f7;
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
    color: #e9d5ff;
    font-weight: bold;
    letter-spacing: 0.03em;
  }
  .banner-subtitle {
    margin: 0.35rem 0 0 0;
    font-size: 0.85rem;
    color: #f3e8ff;
    line-height: 1.4;
  }

  /* Hero Roller */
  .roller-hero {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.25rem;
    background: #23192e;
    border: 1px solid #4a3461;
    border-radius: 0.75rem;
    padding: 1.25rem;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
  }
  @media (min-width: 900px) {
    .roller-hero { grid-template-columns: 1fr 1.3fr; }
  }

  .hero-title { margin: 0; font-size: 1.15rem; color: #fef08a; }
  .hero-desc { font-size: 0.82rem; color: #cbd5e1; line-height: 1.4; margin: 0.4rem 0 1rem 0; }

  .hero-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .btn-roll {
    padding: 0.65rem 1rem;
    border-radius: 0.4rem;
    border: none;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.15s ease;
  }
  .btn-roll.random { background: linear-gradient(135deg, #a855f7, #6b21a8); color: #fff; }
  .btn-roll.fiasco { background: linear-gradient(135deg, #ef4444, #991b1b); color: #fff; }
  .btn-roll.prodige { background: linear-gradient(135deg, #22c55e, #15803d); color: #fff; }
  .btn-roll:hover:not(:disabled) { filter: brightness(1.15); transform: translateY(-1px); }

  .hero-right {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .hero-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: #94a3b8;
    font-size: 0.82rem;
    text-align: center;
    gap: 0.4rem;
  }
  .ph-ico { font-size: 2.2rem; }

  .rolling-spinner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: #e9d5ff;
  }
  .d-anim { font-size: 2.8rem; animation: spin 0.6s linear infinite; }
  @keyframes spin { 100% { transform: rotate(360deg); } }

  .active-surge-card {
    width: 100%;
    background: #181220;
    border-radius: 0.6rem;
    padding: 1rem 1.2rem;
    border: 2px solid #a855f7;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .active-surge-card.fiasco { border-color: #ef4444; background: #221215; }
  .active-surge-card.prodige { border-color: #22c55e; background: #112217; }

  .surge-top {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .d100-badge {
    background: #4a2874;
    color: #fef08a;
    font-weight: bold;
    font-size: 0.72rem;
    padding: 0.15rem 0.45rem;
    border-radius: 0.25rem;
  }
  .type-badge { font-size: 0.72rem; font-weight: bold; color: #f7eed7; }
  .cat-badge { font-size: 0.68rem; color: #a78bfa; text-transform: uppercase; margin-left: auto; }

  .surge-title { margin: 0; font-size: 1.1rem; color: #fef08a; }
  .surge-effect { margin: 0; font-size: 0.82rem; color: #f1f5f9; line-height: 1.35; }
  .surge-rule {
    background: rgba(0, 0, 0, 0.35);
    border-radius: 0.3rem;
    padding: 0.5rem 0.7rem;
    font-size: 0.78rem;
    color: #cbd5e1;
  }
  .surge-lore { font-size: 0.75rem; color: #e2e8f0; font-style: italic; opacity: 0.85; }

  .btn-copy-surge {
    align-self: flex-start;
    background: #3b2854;
    color: #fef08a;
    border: 1px solid #6b4699;
    border-radius: 0.3rem;
    padding: 0.35rem 0.7rem;
    font-size: 0.75rem;
    cursor: pointer;
  }

  /* Toolbar */
  .table-toolbar {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .search-input-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #181220;
    border: 1px solid #4a3461;
    border-radius: 0.4rem;
    padding: 0.4rem 0.75rem;
  }
  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    color: #f7eed7;
    font-family: inherit;
    font-size: 0.85rem;
    outline: none;
  }

  .filters-row {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .pill-group { display: flex; gap: 0.3rem; flex-wrap: wrap; }
  .pill {
    background: #1c1424;
    border: 1px solid #453259;
    color: #d8b4fe;
    font-size: 0.72rem;
    font-family: inherit;
    padding: 0.25rem 0.55rem;
    border-radius: 0.3rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .pill:hover { background: #322144; }
  .pill.active {
    background: #6b21a8;
    border-color: #c084fc;
    color: #fef08a;
    font-weight: bold;
  }

  /* Grid */
  .surges-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.85rem;
  }
  .surge-list-card {
    background: #1e1528;
    border: 1px solid #47325c;
    border-radius: 0.5rem;
    padding: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    transition: all 0.15s ease;
  }
  .surge-list-card:hover { transform: translateY(-2px); border-color: #c084fc; }
  .surge-list-card.is-fiasco { border-left: 3px solid #ef4444; }
  .surge-list-card.is-prodige { border-left: 3px solid #22c55e; }

  .sl-head {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.68rem;
  }
  .sl-range { font-weight: bold; color: #fef08a; }
  .sl-type { color: #d8b4fe; }
  .sl-cat { color: #94a3b8; text-transform: uppercase; margin-left: auto; }
  .sl-title { margin: 0; font-size: 0.92rem; color: #f3e8ff; }
  .sl-effect { margin: 0; font-size: 0.78rem; color: #cbd5e1; line-height: 1.35; }
  .sl-rule { font-size: 0.72rem; color: #93c5fd; }
  .sl-lore { font-size: 0.72rem; color: #a89bb8; font-style: italic; }
  .sl-copy {
    align-self: flex-end;
    background: transparent;
    border: 1px solid #4a3461;
    color: #e9d5ff;
    border-radius: 0.25rem;
    font-size: 0.68rem;
    padding: 0.2rem 0.5rem;
    cursor: pointer;
    margin-top: auto;
  }
  .sl-copy:hover { background: #3b2854; border-color: #a855f7; }
</style>
