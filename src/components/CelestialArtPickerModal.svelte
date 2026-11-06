<script lang="ts">
  import { onMount } from 'svelte';
  import { getCelestialCatalog, ensureCelestialFolders, type DriveFile } from '$lib/stores/celestialCache';
  import { imageSourceToDataUrl } from '$lib/services/tokenService';

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

  // Catalogue complet des tokens et portraits officiels de Grimoire
  const builtinTokens = [
    // Héros
    { name: 'Guerrier', url: '/tokens/library/heroes/guerrier.png', cat: 'warrior' },
    { name: 'Magicien', url: '/tokens/library/heroes/magicien.png', cat: 'mage' },
    { name: 'Rôdeur', url: '/tokens/library/heroes/rodeur.png', cat: 'warrior' },
    { name: 'Clerc', url: '/tokens/library/heroes/clerc.png', cat: 'mage' },
    { name: 'Voleur', url: '/tokens/library/heroes/voleur.png', cat: 'warrior' },
    { name: 'Paladin', url: '/tokens/online/heroes/paladin.png', cat: 'warrior' },
    { name: 'Barbare', url: '/tokens/online/heroes/barbare.png', cat: 'warrior' },
    { name: 'Chevalier', url: '/tokens/online/heroes/chevalier.png', cat: 'warrior' },
    { name: 'Druide', url: '/tokens/online/heroes/druide.png', cat: 'mage' },
    { name: 'Sorcière', url: '/tokens/online/heroes/sorciere.png', cat: 'mage' },
    { name: 'Prêtresse', url: '/tokens/online/heroes/pretresse.png', cat: 'mage' },
    { name: 'Archer', url: '/tokens/online/heroes/archer.png', cat: 'warrior' },
    { name: 'Nain', url: '/tokens/online/heroes/nain.png', cat: 'warrior' },
    { name: 'Viking', url: '/tokens/online/heroes/viking.png', cat: 'warrior' },
    { name: 'Épéiste', url: '/tokens/online/heroes/epeeiste.png', cat: 'warrior' },

    // PNJ & Taverne
    { name: 'Tavernier', url: '/tokens/library/npcs/tavernier.png', cat: 'pnj' },
    { name: 'Garde de la Ville', url: '/tokens/library/npcs/garde.png', cat: 'pnj' },
    { name: 'Marchand', url: '/tokens/library/npcs/marchand.png', cat: 'pnj' },
    { name: 'Noble', url: '/tokens/library/npcs/noble.png', cat: 'pnj' },
    { name: 'Alchimiste', url: '/tokens/online/npcs/alchimiste.png', cat: 'pnj' },
    { name: 'Forgeron', url: '/tokens/online/npcs/forgeron.png', cat: 'pnj' },
    { name: 'Espion', url: '/tokens/online/npcs/espion.png', cat: 'pnj' },
    { name: 'Prêtre', url: '/tokens/online/npcs/pretre.png', cat: 'pnj' },

    // Monstres
    { name: 'Dragon Rouge', url: '/tokens/library/enemies/dragon.png', cat: 'monster' },
    { name: 'Gobelin', url: '/tokens/library/enemies/gobelin.png', cat: 'monster' },
    { name: 'Orque', url: '/tokens/library/enemies/orque.png', cat: 'monster' },
    { name: 'Squelette', url: '/tokens/library/enemies/squelette.png', cat: 'monster' },
    { name: 'Loup Sauvage', url: '/tokens/library/enemies/loup.png', cat: 'monster' },
    { name: 'Zombie', url: '/tokens/library/enemies/zombie.png', cat: 'monster' },
    { name: 'Sorcier Sombre', url: '/tokens/library/enemies/sorcier.png', cat: 'monster' },
    { name: 'Minotaure', url: '/tokens/online/enemies/minotaure.png', cat: 'monster' },
    { name: 'Démon', url: '/tokens/online/enemies/demon.png', cat: 'monster' },
    { name: 'Vampire', url: '/tokens/online/enemies/vampire.png', cat: 'monster' },
    { name: 'Troll', url: '/tokens/online/enemies/troll.png', cat: 'monster' },
    { name: 'Golem', url: '/tokens/online/enemies/golem.png', cat: 'monster' },
    { name: 'Fantôme', url: '/tokens/online/enemies/fantome.png', cat: 'monster' },
    { name: 'Spectre', url: '/tokens/online/enemies/spectre.png', cat: 'monster' },
    { name: 'Araignée Géante', url: '/tokens/online/enemies/araignee.png', cat: 'monster' },
    { name: 'Chauve-souris', url: '/tokens/online/enemies/chauvesouris.png', cat: 'monster' },
    { name: 'Mimic Coffre', url: '/tokens/mimics/chest.png', cat: 'monster' },
    { name: 'Mimic Porte', url: '/tokens/mimics/door.png', cat: 'monster' },
    { name: 'Mimic Tonneau', url: '/tokens/mimics/barrel.png', cat: 'monster' },
    { name: 'Mimic Table', url: '/tokens/mimics/table.png', cat: 'monster' },
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
    
    // 1. D'abord les tokens officiels intégrés (ultra rapides et 100% fiables)
    let result = [...builtinTokens];

    // 2. Ensuite les fichiers du cache Céleste / Drive
    if (files.length > 0) {
      const driveList = files.map(f => ({
        name: f.name.replace(/\.[^/.]+$/, ''),
        url: f.thumbUrl || f.url,
        cat: f.path.toLowerCase().includes('monster') ? 'monster' : f.path.toLowerCase().includes('warrior') ? 'warrior' : 'pnj',
      }));
      result = [...result, ...driveList];
    }

    if (selectedCategory !== 'all') {
      result = result.filter(item => {
        if (selectedCategory === 'pnj') return item.cat === 'pnj' || item.name.toLowerCase().includes('tavern') || item.name.toLowerCase().includes('marchand');
        if (selectedCategory === 'warrior') return item.cat === 'warrior' || item.name.toLowerCase().includes('garde') || item.name.toLowerCase().includes('soldat') || item.name.toLowerCase().includes('guerrier');
        if (selectedCategory === 'mage') return item.cat === 'mage' || item.name.toLowerCase().includes('mage') || item.name.toLowerCase().includes('sorcier') || item.name.toLowerCase().includes('clerc');
        if (selectedCategory === 'monster') return item.cat === 'monster' || item.name.toLowerCase().includes('gobelin') || item.name.toLowerCase().includes('dragon') || item.name.toLowerCase().includes('mimic');
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
            onclick={async () => {
              const safeUrl = await imageSourceToDataUrl(item.url);
              onselect(safeUrl || item.url, item.name);
            }}
          >
            <div class="art-thumb-box">
              <img 
                src={item.url} 
                alt={item.name} 
                class="art-img"
                loading="lazy"
                referrerpolicy="no-referrer"
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
