<script lang="ts">
  import { onMount } from 'svelte';
  import { mapStore } from '../lib/stores/mapStore.svelte';
  import { loadCelestialCatalog, type DriveFile, type CelestialCatalog } from '../lib/celestialCatalog';

  // État du catalogue
  let catalog = $state<CelestialCatalog | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Filtres
  let selectedTab = $state<'all' | 'maps' | 'tokens' | 'tiles/custom' | 'assets/audio' | 'books'>('all');
  let selectedSubfolder = $state<string>('all');
  let searchQuery = $state('');

  // Défilement progressif
  let displayLimit = $state(120);

  // Lightbox HD
  let previewFile = $state<DriveFile | null>(null);
  let previewZoom = $state(1);
  let previewPan = $state({ x: 0, y: 0 });
  let isDraggingPreview = $state(false);
  let dragStart = $state({ x: 0, y: 0 });

  // Lecteur Audio Intégré
  let playingAudioId = $state<string | null>(null);
  let isAudioPlaying = $state(false);
  let audioEl: HTMLAudioElement | null = null;
  let audioCurrentTime = $state(0);
  let audioDuration = $state(0);
  let audioVolume = $state(0.7);
  let audioLoop = $state(true);

  // Chargement du catalogue
  async function fetchCatalog(force = false) {
    loading = true;
    error = null;
    try {
      catalog = await loadCelestialCatalog(force);
    } catch (e: any) {
      error = e?.message || 'Erreur lors du chargement des Archives Célestes.';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    fetchCatalog();
  });

  // Liste réactive filtrée
  let filteredFiles = $derived.by(() => {
    if (!catalog || !catalog.files) return [];
    let list = catalog.files;

    if (selectedTab !== 'all') {
      list = list.filter(f => f.destination === selectedTab);
    }

    if (selectedSubfolder !== 'all') {
      list = list.filter(f => f.subfolder === selectedSubfolder || f.category === selectedSubfolder);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(f => 
        f.name.toLowerCase().includes(q) || 
        f.filename.toLowerCase().includes(q) ||
        (f.category && f.category.toLowerCase().includes(q)) ||
        (f.subfolder && f.subfolder.toLowerCase().includes(q))
      );
    }

    return list;
  });

  // Sous-dossiers disponibles pour l'onglet actif
  let availableSubfolders = $derived.by(() => {
    if (!catalog || !catalog.files) return [];
    const set = new Set<string>();
    const base = selectedTab === 'all' ? catalog.files : catalog.files.filter(f => f.destination === selectedTab);
    for (const f of base) {
      if (f.subfolder) {
        const top = f.subfolder.split('/')[0];
        if (top) set.add(top);
      } else if (f.category) {
        set.add(f.category);
      }
    }
    return Array.from(set).sort();
  });

  // Réinitialiser la limite de scroll quand les filtres changent
  $effect(() => {
    const _t = selectedTab;
    const _s = selectedSubfolder;
    const _q = searchQuery;
    displayLimit = 120;
  });

  function handleScroll(e: Event) {
    const el = e.currentTarget as HTMLElement;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 250) {
      if (displayLimit < filteredFiles.length) {
        displayLimit += 100;
      }
    }
  }

  // ── Actions d'application sur la Carte ──────────────────────────────────────

  function applyAsMapBackground(file: DriveFile) {
    const url = file.highResUrl || file.url;
    mapStore.backgroundImageUrl = url;
    mapStore.backgroundType = 'image';
    mapStore.backgroundImageOpacity = 1.0;
    if (file.name && file.name !== 'Sans titre') {
      mapStore.mapTitle = file.name;
    }
    closeModal();
    notifyToast(`🗺️ « ${file.name} » appliquée comme fond de carte !`);
  }

  function applyAsStamp(file: DriveFile) {
    const url = file.highResUrl || file.url;
    mapStore.activeStamp = url;
    mapStore.activeTool = 'stamp';
    mapStore.showPanel = true;
    closeModal();
    notifyToast(`🎨 Tampon céleste « ${file.name} » sélectionné !`);
  }

  function applyAsPaintTexture(file: DriveFile) {
    const url = file.highResUrl || file.url;
    mapStore.paintTexture = url;
    mapStore.activeTool = 'paint';
    mapStore.showPanel = true;
    closeModal();
    notifyToast(`🖌️ Texture céleste « ${file.name} » sélectionnée pour peindre !`);
  }

  function applyAsBackgroundTexture(file: DriveFile) {
    const url = file.highResUrl || file.url;
    mapStore.backgroundTexture = url;
    mapStore.backgroundType = 'texture';
    closeModal();
    notifyToast(`🧱 Texture « ${file.name} » appliquée en fond de carte !`);
  }

  function notifyToast(msg: string) {
    window.dispatchEvent(new CustomEvent('map-editor-toast', { detail: msg }));
  }

  function closeModal() {
    mapStore.showCelestialModal = false;
    stopAudio();
    closeLightbox();
  }

  // ── Gestion Audio ──────────────────────────────────────────────────────────

  function toggleAudio(file: DriveFile) {
    if (playingAudioId === file.id && audioEl) {
      if (isAudioPlaying) {
        audioEl.pause();
        isAudioPlaying = false;
      } else {
        audioEl.play().then(() => { isAudioPlaying = true; }).catch(() => {});
      }
      return;
    }

    if (audioEl) {
      audioEl.pause();
      audioEl.src = '';
    }

    audioEl = new Audio(file.url);
    audioEl.volume = audioVolume;
    audioEl.loop = audioLoop;
    playingAudioId = file.id;

    audioEl.onloadedmetadata = () => {
      audioDuration = audioEl?.duration || 0;
    };
    audioEl.ontimeupdate = () => {
      audioCurrentTime = audioEl?.currentTime || 0;
    };
    audioEl.onended = () => {
      if (!audioLoop) isAudioPlaying = false;
    };

    audioEl.play().then(() => {
      isAudioPlaying = true;
    }).catch(e => {
      console.warn('Lecture audio bloquée ou inaccessible:', e);
      isAudioPlaying = false;
    });
  }

  function stopAudio() {
    if (audioEl) {
      audioEl.pause();
      audioEl.src = '';
      audioEl = null;
    }
    playingAudioId = null;
    isAudioPlaying = false;
  }

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // ── Lightbox ───────────────────────────────────────────────────────────────

  function openLightbox(file: DriveFile) {
    previewFile = file;
    previewZoom = 1;
    previewPan = { x: 0, y: 0 };
  }

  function closeLightbox() {
    previewFile = null;
  }

  function handleLightboxWheel(e: WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.2 : 0.8;
    previewZoom = Math.max(0.3, Math.min(6, previewZoom * factor));
  }

  function startDragPreview(e: MouseEvent) {
    isDraggingPreview = true;
    dragStart = { x: e.clientX - previewPan.x, y: e.clientY - previewPan.y };
  }

  function onDragPreview(e: MouseEvent) {
    if (!isDraggingPreview) return;
    previewPan = { x: e.clientX - dragStart.x, y: e.clientY - dragStart.y };
  }

  function stopDragPreview() {
    isDraggingPreview = false;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && mapStore.showCelestialModal) {
      if (previewFile) {
        closeLightbox();
      } else {
        closeModal();
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} onmouseup={stopDragPreview} onmousemove={onDragPreview} />

{#if mapStore.showCelestialModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="celestial-backdrop" onclick={closeModal}>
    <div class="celestial-modal" onclick={(e) => e.stopPropagation()}>
      
      <!-- En-tête -->
      <div class="celestial-header">
        <div class="header-titles">
          <div class="header-main-title">
            <span class="celestial-icon">🌌</span>
            <h2>Bibliothèque Céleste</h2>
            <span class="badge-count">
              {catalog ? `${catalog.totalFiles.toLocaleString()} ressources` : 'Connexion...'}
            </span>
          </div>
          <p class="header-subtitle">Cartes de bataille, tampons de décor, textures et musiques pour votre éditeur de cartes</p>
        </div>

        <div class="header-actions">
          <!-- Recherche -->
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Rechercher carte, donjon, arbre, taverne..."
              bind:value={searchQuery}
            />
            {#if searchQuery}
              <button class="clear-btn" onclick={() => searchQuery = ''}>✕</button>
            {/if}
          </div>

          <!-- Rafraîchir -->
          <button class="refresh-btn" onclick={() => fetchCatalog(true)} title="Synchroniser avec le Drive & GitHub">
            🔄
          </button>

          <!-- Fermer -->
          <button class="close-btn" onclick={closeModal} title="Fermer (Échap)">
            ✕
          </button>
        </div>
      </div>

      <!-- Barre de navigation des catégories -->
      <div class="celestial-nav-bar">
        <div class="category-tabs">
          <button
            class="tab-btn"
            class:active={selectedTab === 'all'}
            onclick={() => { selectedTab = 'all'; selectedSubfolder = 'all'; }}
          >
            🌟 Tout ({catalog?.totalFiles || 0})
          </button>
          <button
            class="tab-btn"
            class:active={selectedTab === 'maps'}
            onclick={() => { selectedTab = 'maps'; selectedSubfolder = 'all'; }}
          >
            🗺️ Cartes de Bataille ({catalog?.files.filter(f => f.destination === 'maps').length || 0})
          </button>
          <button
            class="tab-btn"
            class:active={selectedTab === 'tokens'}
            onclick={() => { selectedTab = 'tokens'; selectedSubfolder = 'all'; }}
          >
            🎨 Tampons & Tokens ({catalog?.files.filter(f => f.destination === 'tokens').length || 0})
          </button>
          <button
            class="tab-btn"
            class:active={selectedTab === 'tiles/custom'}
            onclick={() => { selectedTab = 'tiles/custom'; selectedSubfolder = 'all'; }}
          >
            🧱 Textures ({catalog?.files.filter(f => f.destination === 'tiles/custom').length || 0})
          </button>
          <button
            class="tab-btn"
            class:active={selectedTab === 'assets/audio'}
            onclick={() => { selectedTab = 'assets/audio'; selectedSubfolder = 'all'; }}
          >
            🎵 Musiques & SFX ({catalog?.files.filter(f => f.destination === 'assets/audio').length || 0})
          </button>
        </div>

        {#if availableSubfolders.length > 0}
          <div class="subfolder-pills">
            <button
              class="subfolder-pill"
              class:active={selectedSubfolder === 'all'}
              onclick={() => selectedSubfolder = 'all'}
            >
              Tous
            </button>
            {#each availableSubfolders as sf}
              <button
                class="subfolder-pill"
                class:active={selectedSubfolder === sf}
                onclick={() => selectedSubfolder = sf}
              >
                {sf}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Lecteur Audio Flottant (si lecture en cours) -->
      {#if playingAudioId}
        {@const currentAudioFile = catalog?.files.find(f => f.id === playingAudioId)}
        <div class="audio-player-banner">
          <div class="audio-info">
            <span class="audio-disc rotating">🎵</span>
            <div class="audio-text">
              <span class="audio-name">{currentAudioFile?.name || 'Lecture Audio'}</span>
              <span class="audio-sub">{currentAudioFile?.category || 'Ambiance Céleste'}</span>
            </div>
          </div>

          <div class="audio-controls">
            <button class="audio-btn play" onclick={() => currentAudioFile && toggleAudio(currentAudioFile)}>
              {isAudioPlaying ? '⏸️ Pause' : '▶️ Reprendre'}
            </button>
            <span class="audio-time">{formatTime(audioCurrentTime)} / {formatTime(audioDuration)}</span>
            <input
              type="range"
              min="0"
              max={audioDuration || 100}
              value={audioCurrentTime}
              oninput={(e) => { if (audioEl) audioEl.currentTime = Number(e.currentTarget.value); }}
              class="audio-scrubber"
            />
            <div class="audio-volume-wrap">
              <span>🔊</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                bind:value={audioVolume}
                oninput={() => { if (audioEl) audioEl.volume = audioVolume; }}
                class="volume-slider"
              />
            </div>
            <button class="audio-btn stop" onclick={stopAudio}>⏹️ Arrêter</button>
          </div>
        </div>
      {/if}

      <!-- Corps / Grille des Ressources -->
      <div class="celestial-body" onscroll={handleScroll}>
        {#if loading && (!catalog || catalog.files.length === 0)}
          <div class="celestial-state">
            <div class="spinner"></div>
            <p>Chargement des Archives Célestes...</p>
            <span class="state-sub">Vérification du catalogue et mise en cache</span>
          </div>
        {:else if error && (!catalog || catalog.files.length === 0)}
          <div class="celestial-state error">
            <span class="state-icon">⚠️</span>
            <p>{error}</p>
            <button class="retry-btn" onclick={() => fetchCatalog(true)}>Réessayer</button>
          </div>
        {:else if filteredFiles.length === 0}
          <div class="celestial-state empty">
            <span class="state-icon">🔍</span>
            <p>Aucun résultat pour « {searchQuery} » dans cette catégorie.</p>
            <button class="reset-filter-btn" onclick={() => { searchQuery = ''; selectedTab = 'all'; selectedSubfolder = 'all'; }}>
              Réinitialiser les filtres
            </button>
          </div>
        {:else}
          <div class="files-grid">
            {#each filteredFiles.slice(0, displayLimit) as file (file.id)}
              <div class="file-card" class:audio-card={file.destination === 'assets/audio'}>
                <!-- Aperçu Visuel -->
                {#if file.destination === 'assets/audio'}
                  <div class="audio-card-visual" onclick={() => toggleAudio(file)}>
                    <span class="audio-big-icon" class:pulse={playingAudioId === file.id && isAudioPlaying}>
                      {playingAudioId === file.id && isAudioPlaying ? '🔊' : '🎵'}
                    </span>
                    <span class="audio-duration-badge">Audio</span>
                  </div>
                {:else}
                  <div class="thumbnail-wrapper" onclick={() => openLightbox(file)}>
                    <img
                      src={file.thumbUrl || file.url}
                      alt={file.name}
                      loading="lazy"
                      class="thumbnail-img"
                      onerror={(e) => {
                        // Fallback image si thumbnail google drive indisponible
                        const t = e.currentTarget as HTMLImageElement;
                        if (file.url && t.src !== file.url) t.src = file.url;
                      }}
                    />
                    <div class="hover-overlay">
                      <span class="zoom-indicator">🔍 Zoom</span>
                    </div>
                  </div>
                {/if}

                <!-- Métadonnées & Actions -->
                <div class="card-footer">
                  <span class="file-name" title={file.name}>{file.name}</span>
                  <div class="file-tags">
                    <span class="tag-badge">{file.category || 'Général'}</span>
                  </div>

                  <!-- Boutons d'Action selon le type -->
                  <div class="action-buttons">
                    {#if file.destination === 'maps'}
                      <button
                        class="action-btn primary"
                        onclick={() => applyAsMapBackground(file)}
                        title="Charger cette carte en arrière-plan"
                      >
                        🖼️ Fond de Carte
                      </button>
                      <button
                        class="action-btn secondary"
                        onclick={() => openLightbox(file)}
                        title="Aperçu grand format"
                      >
                        👁️
                      </button>
                    {:else if file.destination === 'tokens'}
                      <button
                        class="action-btn primary"
                        onclick={() => applyAsStamp(file)}
                        title="Sélectionner comme tampon actif pour le poser sur la carte"
                      >
                        🎨 Tamponner
                      </button>
                      <button
                        class="action-btn secondary"
                        onclick={() => openLightbox(file)}
                        title="Aperçu grand format"
                      >
                        👁️
                      </button>
                    {:else if file.destination === 'tiles/custom'}
                      <button
                        class="action-btn primary"
                        onclick={() => applyAsPaintTexture(file)}
                        title="Utiliser avec le pinceau pour peindre le sol"
                      >
                        🖌️ Peindre
                      </button>
                      <button
                        class="action-btn secondary"
                        onclick={() => applyAsBackgroundTexture(file)}
                        title="Appliquer en texture d'arrière-plan"
                      >
                        🧱 Fond
                      </button>
                    {:else if file.destination === 'assets/audio'}
                      <button
                        class="action-btn primary"
                        class:playing={playingAudioId === file.id && isAudioPlaying}
                        onclick={() => toggleAudio(file)}
                      >
                        {playingAudioId === file.id && isAudioPlaying ? '⏸️ Pause' : '▶️ Écouter'}
                      </button>
                    {:else}
                      <button
                        class="action-btn primary"
                        onclick={() => openLightbox(file)}
                      >
                        👁️ Consulter
                      </button>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>

          {#if displayLimit < filteredFiles.length}
            <div class="load-more-indicator">
              <span>Affichage de {displayLimit} sur {filteredFiles.length} éléments...</span>
            </div>
          {/if}
        {/if}
      </div>

    </div>
  </div>
{/if}

<!-- Lightbox HD plein écran -->
{#if previewFile}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="lightbox-backdrop" onclick={closeLightbox}>
    <div class="lightbox-container" onclick={(e) => e.stopPropagation()} onwheel={handleLightboxWheel}>
      
      <div class="lightbox-header">
        <div class="lightbox-title-box">
          <h3>{previewFile.name}</h3>
          <span class="lightbox-sub">{previewFile.category || previewFile.destination}</span>
        </div>
        <div class="lightbox-actions-top">
          <span class="zoom-badge">{Math.round(previewZoom * 100)} %</span>
          <button class="lb-btn" onclick={() => { previewZoom = 1; previewPan = { x: 0, y: 0 }; }} title="Réinitialiser zoom">
            100%
          </button>
          <button class="lb-btn close" onclick={closeLightbox} title="Fermer">✕</button>
        </div>
      </div>

      <div class="lightbox-viewport" onmousedown={startDragPreview}>
        <img
          src={previewFile.highResUrl || previewFile.url}
          alt={previewFile.name}
          class="lightbox-img"
          style="transform: translate({previewPan.x}px, {previewPan.y}px) scale({previewZoom});"
          draggable="false"
        />
      </div>

      <div class="lightbox-bottom-bar">
        {#if previewFile.destination === 'maps'}
          <button class="lb-action-btn primary" onclick={() => previewFile && applyAsMapBackground(previewFile)}>
            🖼️ Appliquer comme Fond de Carte
          </button>
        {:else if previewFile.destination === 'tokens'}
          <button class="lb-action-btn primary" onclick={() => previewFile && applyAsStamp(previewFile)}>
            🎨 Utiliser comme Tampon
          </button>
        {:else if previewFile.destination === 'tiles/custom'}
          <button class="lb-action-btn primary" onclick={() => previewFile && applyAsPaintTexture(previewFile)}>
            🖌️ Utiliser pour Peindre
          </button>
          <button class="lb-action-btn" onclick={() => previewFile && applyAsBackgroundTexture(previewFile)}>
            🧱 Texture de Fond
          </button>
        {/if}
        <button class="lb-action-btn" onclick={closeLightbox}>Fermer l'aperçu</button>
      </div>

    </div>
  </div>
{/if}

<style>
  .celestial-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(4, 6, 11, 0.85);
    backdrop-filter: blur(8px);
    z-index: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    box-sizing: border-box;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .celestial-modal {
    width: 100%;
    max-width: 1360px;
    height: 90vh;
    background: #0f1118;
    border: 1px solid rgba(255, 204, 90, 0.35);
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(255, 204, 90, 0.1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Header */
  .celestial-header {
    padding: 16px 20px;
    background: linear-gradient(to bottom, #161924, #10131d);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-shrink: 0;
  }

  .header-titles {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .header-main-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .celestial-icon {
    font-size: 22px;
  }

  .header-main-title h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: #f1f5f9;
    letter-spacing: 0.3px;
  }

  .badge-count {
    font-size: 11px;
    font-weight: 600;
    background: rgba(255, 204, 90, 0.15);
    color: #ffcc5a;
    border: 1px solid rgba(255, 204, 90, 0.3);
    padding: 2px 8px;
    border-radius: 12px;
  }

  .header-subtitle {
    margin: 0;
    font-size: 12px;
    color: #94a3b8;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .search-box {
    position: relative;
    display: flex;
    align-items: center;
    width: 320px;
  }

  .search-icon {
    position: absolute;
    left: 10px;
    font-size: 12px;
    opacity: 0.6;
    pointer-events: none;
  }

  .search-box input {
    width: 100%;
    background: #1a1d29;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 7px 30px 7px 30px;
    color: #f1f5f9;
    font-size: 12px;
    outline: none;
    transition: all 0.15s;
  }

  .search-box input:focus {
    border-color: #ffcc5a;
    box-shadow: 0 0 10px rgba(255, 204, 90, 0.2);
  }

  .clear-btn {
    position: absolute;
    right: 8px;
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 12px;
  }

  .refresh-btn, .close-btn {
    width: 34px;
    height: 34px;
    background: #1a1d29;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    transition: all 0.15s;
  }

  .refresh-btn:hover {
    color: #ffcc5a;
    border-color: rgba(255, 204, 90, 0.4);
  }

  .close-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
    color: #f87171;
  }

  /* Nav tabs */
  .celestial-nav-bar {
    padding: 10px 20px;
    background: #11141e;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-shrink: 0;
  }

  .category-tabs {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .tab-btn {
    background: transparent;
    border: 1px solid transparent;
    color: #94a3b8;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .tab-btn:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.04);
  }

  .tab-btn.active {
    background: rgba(255, 204, 90, 0.12);
    color: #ffcc5a;
    border-color: rgba(255, 204, 90, 0.35);
  }

  .subfolder-pills {
    display: flex;
    align-items: center;
    gap: 5px;
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .subfolder-pill {
    background: #171b26;
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: #64748b;
    font-size: 11px;
    padding: 3px 10px;
    border-radius: 12px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
  }

  .subfolder-pill:hover {
    color: #cbd5e1;
    background: #1e2332;
  }

  .subfolder-pill.active {
    background: #ffcc5a;
    color: #0b0d13;
    font-weight: 700;
    border-color: #ffcc5a;
  }

  /* Audio player banner */
  .audio-player-banner {
    padding: 10px 20px;
    background: #1a162b;
    border-bottom: 1px solid rgba(168, 85, 247, 0.3);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-shrink: 0;
  }

  .audio-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .audio-disc {
    font-size: 20px;
  }

  .audio-disc.rotating {
    animation: rotateDisc 4s linear infinite;
  }

  @keyframes rotateDisc {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .audio-text {
    display: flex;
    flex-direction: column;
  }

  .audio-name {
    font-size: 12px;
    font-weight: 600;
    color: #f1f5f9;
  }

  .audio-sub {
    font-size: 10px;
    color: #c084fc;
  }

  .audio-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .audio-btn {
    padding: 5px 12px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
  }

  .audio-btn.play {
    background: #9333ea;
    color: white;
  }

  .audio-btn.play:hover {
    background: #a855f7;
  }

  .audio-btn.stop {
    background: rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
  }

  .audio-time {
    font-size: 11px;
    font-family: monospace;
    color: #94a3b8;
  }

  .audio-scrubber {
    width: 140px;
    accent-color: #a855f7;
  }

  .audio-volume-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }

  .volume-slider {
    width: 70px;
    accent-color: #a855f7;
  }

  /* Body & Grid */
  .celestial-body {
    flex: 1;
    overflow-y: auto;
    padding: 18px 20px;
  }

  .celestial-state {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: #94a3b8;
    text-align: center;
  }

  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid rgba(255, 204, 90, 0.2);
    border-top-color: #ffcc5a;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .state-icon {
    font-size: 32px;
  }

  .state-sub {
    font-size: 11px;
    color: #64748b;
  }

  .retry-btn, .reset-filter-btn {
    padding: 8px 16px;
    background: #ffcc5a;
    color: #0b0d13;
    font-weight: 700;
    border: none;
    border-radius: 8px;
    cursor: pointer;
  }

  .files-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 14px;
  }

  .file-card {
    background: #141722;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .file-card:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 204, 90, 0.4);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
  }

  .thumbnail-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: 4/3;
    background: #090b10;
    overflow: hidden;
    cursor: pointer;
  }

  .thumbnail-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.25s ease;
  }

  .file-card:hover .thumbnail-img {
    transform: scale(1.05);
  }

  .hover-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    opacity: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.15s ease;
  }

  .thumbnail-wrapper:hover .hover-overlay {
    opacity: 1;
  }

  .zoom-indicator {
    background: rgba(15, 17, 24, 0.85);
    color: #ffcc5a;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid rgba(255, 204, 90, 0.4);
  }

  /* Audio card visual */
  .audio-card-visual {
    width: 100%;
    aspect-ratio: 4/3;
    background: linear-gradient(135deg, #18142a, #261942);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    cursor: pointer;
  }

  .audio-big-icon {
    font-size: 38px;
    transition: transform 0.15s;
  }

  .audio-card-visual:hover .audio-big-icon {
    transform: scale(1.15);
  }

  .audio-duration-badge {
    position: absolute;
    bottom: 8px;
    right: 8px;
    font-size: 10px;
    font-weight: 600;
    background: rgba(0, 0, 0, 0.6);
    color: #c084fc;
    padding: 2px 6px;
    border-radius: 4px;
  }

  /* Card footer */
  .card-footer {
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }

  .file-name {
    font-size: 12px;
    font-weight: 600;
    color: #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-tags {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .tag-badge {
    font-size: 10px;
    background: rgba(255, 255, 255, 0.05);
    color: #94a3b8;
    padding: 1px 6px;
    border-radius: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .action-buttons {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
  }

  .action-btn {
    border: none;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    padding: 5px 8px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .action-btn.primary {
    flex: 1;
    background: rgba(255, 204, 90, 0.15);
    color: #ffcc5a;
    border: 1px solid rgba(255, 204, 90, 0.35);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .action-btn.primary:hover {
    background: #ffcc5a;
    color: #0b0d13;
  }

  .action-btn.primary.playing {
    background: #9333ea;
    color: white;
    border-color: #a855f7;
  }

  .action-btn.secondary {
    background: #1a1d29;
    color: #94a3b8;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .action-btn.secondary:hover {
    color: #f1f5f9;
    border-color: rgba(255, 255, 255, 0.25);
  }

  .load-more-indicator {
    padding: 16px;
    text-align: center;
    font-size: 12px;
    color: #64748b;
  }

  /* Lightbox */
  .lightbox-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.92);
    backdrop-filter: blur(10px);
    z-index: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.15s ease-out;
  }

  .lightbox-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .lightbox-header {
    height: 50px;
    padding: 0 20px;
    background: rgba(15, 17, 24, 0.9);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .lightbox-title-box h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    color: #f1f5f9;
  }

  .lightbox-sub {
    font-size: 11px;
    color: #ffcc5a;
  }

  .lightbox-actions-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .zoom-badge {
    font-size: 11px;
    color: #94a3b8;
    margin-right: 4px;
  }

  .lb-btn {
    background: #1e2332;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    font-size: 11px;
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
  }

  .lb-btn.close {
    font-size: 14px;
    padding: 4px 12px;
  }

  .lb-btn:hover {
    background: #2a3146;
    color: white;
  }

  .lightbox-viewport {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    cursor: grab;
    user-select: none;
  }

  .lightbox-viewport:active {
    cursor: grabbing;
  }

  .lightbox-img {
    max-width: 90%;
    max-height: 85vh;
    object-fit: contain;
    transition: transform 0.05s ease-out;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.9);
    border-radius: 6px;
  }

  .lightbox-bottom-bar {
    height: 56px;
    background: rgba(15, 17, 24, 0.9);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .lb-action-btn {
    padding: 8px 18px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: #1e2332;
    color: #cbd5e1;
    transition: all 0.15s;
  }

  .lb-action-btn:hover {
    background: #2b334a;
    color: white;
  }

  .lb-action-btn.primary {
    background: #ffcc5a;
    color: #0b0d13;
    border-color: #ffcc5a;
    box-shadow: 0 4px 14px rgba(255, 204, 90, 0.3);
  }

  .lb-action-btn.primary:hover {
    background: #ffd87a;
  }
</style>
