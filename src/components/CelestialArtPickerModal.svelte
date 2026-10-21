<script lang="ts">
  import { onMount } from 'svelte';
  import { getCelestialCatalog, ensureCelestialFolders, type DriveFile } from '$lib/stores/celestialCache';

  const { onselect, onclose } = $props<{
    onselect: (url: string, name?: string, isEmoji?: boolean) => void;
    onclose: () => void;
  }>();

  let searchQuery = $state('');
  let selectedCategory = $state<'all' | 'pnj' | 'warrior' | 'mage' | 'monster'>('all');
  let isLoading = $state(true);
  let files = $state<DriveFile[]>([]);
  let fileInputRef: HTMLInputElement | null = null;

  // Émojis rapides prêts à l'emploi
  const fantasyEmojis = [
    '🍺', '⚔️', '🛡️', '🏹', '🔮', '👑', '🐺', '🐉', '💀', '🧙',
    '🧝', '🧛', '🧟', '🦁', '🦅', '🐴', '🗡️', '🪵', '🔥', '💧'
  ];

  // Exemples d'illustrations fantasy locales / haute résolution
  const sampleArts = [
    { name: 'Tavernier Barbu', url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&auto=format&fit=crop&q=80', cat: 'pnj' },
    { name: 'Aubergiste du Relais', url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=400&auto=format&fit=crop&q=80', cat: 'pnj' },
    { name: 'Capitaine en Armure', url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80', cat: 'warrior' },
    { name: 'Rôdeuse Elfe', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80', cat: 'warrior' },
    { name: 'Sorcier Arcaniste', url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&auto=format&fit=crop&q=80', cat: 'mage' },
    { name: 'Dragon Éveillé', url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=80', cat: 'monster' },
  ];

  onMount(async () => {
    isLoading = true;
    try {
      await ensureCelestialFolders(['stamps']).catch(() => {});
      const catalog = await getCelestialCatalog();
      if (catalog && catalog.files) {
        // Filtrer les fichiers images pertinents
        files = catalog.files.filter((f: DriveFile) => {
          const p = (f.path || '').toLowerCase();
          return p.includes('stamp') || p.includes('token') || p.endsWith('.png') || p.endsWith('.webp') || p.endsWith('.jpg');
        });
      }
    } catch (err) {
      console.warn('Erreur chargement catalogue Céleste:', err);
    } finally {
      isLoading = false;
    }
  });

  // Filtrage combiné recherche + catégories
  const filteredList = $derived(() => {
    const q = searchQuery.trim().toLowerCase();
    
    // Si on a des fichiers du cache Céleste
    let result = files.map(f => ({
      name: f.name.replace(/\.[^/.]+$/, ''),
      url: f.thumbUrl || f.url,
      cat: f.path.toLowerCase().includes('monster') ? 'monster' : 'pnj',
    }));

    // Fusion avec les exemples
    result = [...sampleArts, ...result];

    if (selectedCategory !== 'all') {
      result = result.filter(item => {
        if (selectedCategory === 'pnj') return item.cat === 'pnj' || item.name.toLowerCase().includes('tavern') || item.name.toLowerCase().includes('marchand');
        if (selectedCategory === 'warrior') return item.cat === 'warrior' || item.name.toLowerCase().includes('garde') || item.name.toLowerCase().includes('soldat');
        if (selectedCategory === 'mage') return item.cat === 'mage' || item.name.toLowerCase().includes('mage') || item.name.toLowerCase().includes('sorcier');
        if (selectedCategory === 'monster') return item.cat === 'monster' || item.name.toLowerCase().includes('gobelin') || item.name.toLowerCase().includes('dragon');
        return true;
      });
    }

    if (q) {
      result = result.filter(item => item.name.toLowerCase().includes(q));
    }

    return result.slice(0, 100);
  });

  function handleFileUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      const file = target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onselect(event.target.result as string, file.name.replace(/\.[^/.]+$/, ''));
        }
      };
      reader.readAsDataURL(file);
    }
  }
</script>

<!-- Backdrop Modal -->
<div class="celestial-overlay">
  <div class="celestial-dialog">
    
    <!-- Header -->
    <div class="dialog-header">
      <div class="header-left">
        <span class="header-icon">🌌</span>
        <div>
          <h3 class="header-title">
            Bibliothèque Céleste — Galerie de Portraits & Tampons
          </h3>
          <p class="header-sub">Choisis une illustration pour l'insérer dans ton pion personnalisé</p>
        </div>
      </div>
      <button class="btn-close" onclick={onclose}>
        ✕ Fermer
      </button>
    </div>

    <!-- Barre d'actions & Recherche -->
    <div class="dialog-toolbar">
      <div class="search-wrap">
        <input 
          type="text" 
          bind:value={searchQuery}
          placeholder="🔍 Rechercher : Tavernier, Garde, Gobelin, Mage..."
          class="search-input"
        />
      </div>

      <!-- Import local -->
      <div class="upload-wrap">
        <input 
          type="file" 
          accept="image/*" 
          class="file-hidden" 
          bind:this={fileInputRef} 
          onchange={handleFileUpload} 
        />
        <button class="btn-upload" onclick={() => fileInputRef?.click()}>
          📂 Mon Image (PC)
        </button>
      </div>
    </div>

    <!-- Filtres de Catégories & Barre d'émojis -->
    <div class="dialog-filter-bar">
      <div class="categories-row">
        <button 
          class="cat-chip"
          class:active={selectedCategory === 'all'}
          onclick={() => selectedCategory = 'all'}
        >
          Tous
        </button>
        <button 
          class="cat-chip"
          class:active={selectedCategory === 'pnj'}
          onclick={() => selectedCategory = 'pnj'}
        >
          🍺 PNJ & Taverne
        </button>
        <button 
          class="cat-chip"
          class:active={selectedCategory === 'warrior'}
          onclick={() => selectedCategory = 'warrior'}
        >
          ⚔️ Gardes & Guerriers
        </button>
        <button 
          class="cat-chip"
          class:active={selectedCategory === 'mage'}
          onclick={() => selectedCategory = 'mage'}
        >
          🔮 Magie & Arcanes
        </button>
        <button 
          class="cat-chip"
          class:active={selectedCategory === 'monster'}
          onclick={() => selectedCategory = 'monster'}
        >
          🐉 Monstres
        </button>
      </div>

      <!-- Émojis rapides -->
      <div class="emojis-row">
        <span class="emojis-label">Émojis :</span>
        {#each fantasyEmojis.slice(0, 8) as emoji}
          <button 
            class="emoji-btn"
            onclick={() => onselect('', emoji, true)}
          >
            {emoji}
          </button>
        {/each}
      </div>
    </div>

    <!-- Grille de cartes -->
    <div class="art-grid">
      {#if isLoading}
        <div class="status-center">
          <div class="spinner"></div>
          <span>Chargement de la Bibliothèque Céleste...</span>
        </div>
      {:else if filteredList().length === 0}
        <div class="status-center empty">
          Aucun portrait ou tampon trouvé pour « {searchQuery} ».
        </div>
      {:else}
        {#each filteredList() as item}
          <button 
            class="art-card"
            onclick={() => onselect(item.url, item.name)}
          >
            <div class="art-thumb-box">
              <img 
                src={item.url} 
                alt={item.name} 
                class="art-img"
                loading="lazy"
              />
            </div>
            <span class="art-name">
              {item.name}
            </span>
          </button>
        {/each}
      {/if}
    </div>

  </div>
</div>

<style>
  .celestial-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.82);
    backdrop-filter: blur(8px);
    z-index: 1000000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    box-sizing: border-box;
  }

  .celestial-dialog {
    background: #14151b;
    border: 1px solid rgba(124, 58, 237, 0.5);
    border-radius: 16px;
    width: 100%;
    max-width: 900px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 50px -12px rgba(46, 16, 101, 0.5);
    overflow: hidden;
    color: #e5e7eb;
    box-sizing: border-box;
  }

  .dialog-header {
    padding: 16px 20px;
    background: #1a1b24;
    border-bottom: 1px solid #2d2e3f;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-icon {
    font-size: 24px;
  }

  .header-title {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
  }

  .header-sub {
    margin: 2px 0 0 0;
    font-size: 12px;
    color: #9ca3af;
  }

  .btn-close {
    padding: 6px 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #d1d5db;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-close:hover {
    background: rgba(255, 255, 255, 0.16);
    color: #fff;
  }

  .dialog-toolbar {
    padding: 12px 16px;
    background: #101116;
    border-bottom: 1px solid #242533;
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }

  .search-wrap {
    flex: 1;
    min-width: 200px;
  }

  .search-input {
    width: 100%;
    box-sizing: border-box;
    background: #1e202c;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 13px;
    color: #fff;
    outline: none;
    transition: border-color 0.15s;
  }

  .search-input:focus {
    border-color: #a78bfa;
  }

  .file-hidden {
    display: none;
  }

  .btn-upload {
    padding: 8px 14px;
    background: #252838;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    color: #e5e7eb;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
  }

  .btn-upload:hover {
    background: #32364c;
  }

  .dialog-filter-bar {
    padding: 8px 16px;
    background: #161720;
    border-bottom: 1px solid #242533;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    overflow-x: auto;
  }

  .categories-row {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }

  .cat-chip {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.05);
    color: #d1d5db;
    transition: all 0.15s;
  }

  .cat-chip:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .cat-chip.active {
    background: #7c3aed;
    color: #ffffff;
  }

  .emojis-row {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    padding-left: 10px;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
  }

  .emojis-label {
    font-size: 11px;
    color: #6b7280;
    margin-right: 4px;
  }

  .emoji-btn {
    width: 26px;
    height: 26px;
    background: none;
    border: none;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: transform 0.15s;
  }

  .emoji-btn:hover {
    transform: scale(1.25);
  }

  .art-grid {
    padding: 16px;
    overflow-y: auto;
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 14px;
  }

  .status-center {
    grid-column: 1 / -1;
    padding: 60px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: #9ca3af;
    font-size: 14px;
  }

  .status-center.empty {
    color: #6b7280;
  }

  .spinner {
    width: 30px;
    height: 30px;
    border: 3px solid #7c3aed;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .art-card {
    background: #1c1e2a;
    border: 1px solid #2e3146;
    border-radius: 12px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
  }

  .art-card:hover {
    background: #25283a;
    border-color: #a78bfa;
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(124, 58, 237, 0.25);
  }

  .art-thumb-box {
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: 8px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.4);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .art-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.2s;
  }

  .art-card:hover .art-img {
    transform: scale(1.06);
  }

  .art-name {
    font-size: 12px;
    font-weight: 600;
    color: #e5e7eb;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
  }

  .art-card:hover .art-name {
    color: #c4b5fd;
  }
</style>
