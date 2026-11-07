<script lang="ts">
  import { playlistStore, type TrackItem } from '$lib/stores/playlist.svelte';
  import { getVaultTree, getVaultPath } from '$lib/stores/vault.svelte';
  import { isTauri, createDirectory, writeFileBase64, reindex } from '$lib/api';
  import { notifStore } from '$lib/stores/notifications.svelte';

  const { isOpen = false, onclose, onOpenCelestial }: {
    isOpen: boolean;
    onclose: () => void;
    onOpenCelestial?: () => void;
  } = $props();

  let fileInputRef = $state<HTMLInputElement | null>(null);
  let searchQuery = $state('');

  function getAllAudioFiles(node: any, result: { name: string; path: string }[] = []): { name: string; path: string }[] {
    if (!node) return result;
    if (node.type === 'file') {
      const ext = node.name.split('.').pop()?.toLowerCase();
      if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'opus', 'webm'].includes(ext)) {
        result.push({ name: node.name.replace(/\.[^/.]+$/, ''), path: node.path });
      }
    } else if (node.children) {
      for (const child of node.children) {
        getAllAudioFiles(child, result);
      }
    }
    return result;
  }

  const vaultAudios = $derived(() => {
    const tree = getVaultTree();
    return getAllAudioFiles(tree);
  });

  const filteredVaultAudios = $derived(() => {
    const list = vaultAudios();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(a => a.name.toLowerCase().includes(q) || a.path.toLowerCase().includes(q));
  });

  async function handleFileUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    const file = target.files[0];
    const reader = new FileReader();

    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;

      const vaultPath = getVaultPath();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const relPath = `assets/audio/${safeName}`;

      if (vaultPath && isTauri()) {
        try {
          await createDirectory(vaultPath, 'assets');
          await createDirectory(vaultPath, 'assets/audio');
          const base64Data = dataUrl.split(',')[1] || '';
          await writeFileBase64(vaultPath, relPath, base64Data);
          await reindex(vaultPath);

          playlistStore.addTrack({
            name: file.name.replace(/\.[^/.]+$/, ''),
            src: relPath,
            sourceType: 'vault',
          });
          return;
        } catch (err) {
          console.warn('Fallback import direct:', err);
        }
      }

      // Fallback DataURL immédiat
      playlistStore.addTrack({
        name: file.name.replace(/\.[^/.]+$/, ''),
        src: dataUrl,
        sourceType: 'local',
      });
    };

    reader.readAsDataURL(file);
    target.value = '';
  }

  function handleAddFromVault(item: { name: string; path: string }) {
    playlistStore.addTrack({
      name: item.name,
      src: item.path,
      sourceType: 'vault',
    });
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="playlist-overlay" onclick={onclose}>
    <div class="playlist-window" onclick={e => e.stopPropagation()}>
      
      <!-- En-tête -->
      <div class="playlist-header">
        <div class="header-left">
          <span class="header-icon">🎵</span>
          <div>
            <h2 class="header-title">Playlists & Lecteur Audio VTT</h2>
            <p class="header-subtitle">Enchaînement automatique, ambiances thématiques et mixage direct</p>
          </div>
        </div>

        <div class="header-actions">
          <!-- INTERRUPTEUR GÉNÉRAL DÉSACTIVER / RÉACTIVER LA MUSIQUE -->
          <button 
            class="btn-master-toggle" 
            class:is-disabled={!playlistStore.isMusicEnabled}
            onclick={() => playlistStore.toggleMusic()}
            title={playlistStore.isMusicEnabled ? "Couper et désactiver toute la musique pour vous et les joueurs" : "Réactiver la musique"}
          >
            {playlistStore.isMusicEnabled ? '🔊 Musique : ACTIVÉE' : '🔇 Musique : DÉSACTIVÉE'}
          </button>

          <button class="btn-close" onclick={onclose} title="Fermer la playlist">✕</button>
        </div>
      </div>

      <!-- Corps principal 2 colonnes -->
      <div class="playlist-body">
        
        <!-- Colonne Gauche : Lecteur en cours & Thèmes -->
        <div class="col-controls">
          
          <!-- Lecteur en cours -->
          <div class="now-playing-card" class:disabled-card={!playlistStore.isMusicEnabled}>
            <div class="track-info">
              <span class="music-disc" class:spinning={playlistStore.isPlaying && playlistStore.isMusicEnabled}>💿</span>
              <div class="track-details">
                <span class="track-status">
                  {#if !playlistStore.isMusicEnabled}
                    🚫 MUSIQUE DÉSACTIVÉE
                  {:else if playlistStore.isPlaying}
                    ▶️ EN COURS DE LECTURE
                  {:else}
                    ⏸️ EN PAUSE
                  {/if}
                </span>
                <span class="track-title" title={playlistStore.currentTrack?.name || 'Aucun morceau sélectionné'}>
                  {playlistStore.currentTrack?.name || 'Aucun morceau sélectionné'}
                </span>
                <span class="track-source">
                  Piste {playlistStore.currentTrackIndex >= 0 ? playlistStore.currentTrackIndex + 1 : 0} sur {playlistStore.tracks.length}
                </span>
              </div>
            </div>

            <!-- Boutons de contrôle -->
            <div class="playback-controls">
              <button 
                class="ctrl-btn" 
                onclick={() => playlistStore.prevTrack()} 
                title="Piste précédente (⏮️)"
                disabled={playlistStore.tracks.length === 0}
              >
                ⏮️
              </button>

              <button 
                class="ctrl-btn play-btn" 
                onclick={() => playlistStore.togglePlay()} 
                title={playlistStore.isPlaying ? "Mettre en pause (⏸️)" : "Lancer la lecture (▶️)"}
                disabled={playlistStore.tracks.length === 0}
              >
                {playlistStore.isPlaying && playlistStore.isMusicEnabled ? '⏸️' : '▶️'}
              </button>

              <button 
                class="ctrl-btn" 
                onclick={() => playlistStore.nextTrack()} 
                title="Piste suivante (⏭️)"
                disabled={playlistStore.tracks.length === 0}
              >
                ⏭️
              </button>

              <button 
                class="ctrl-btn stop-btn" 
                onclick={() => playlistStore.disableMusic()} 
                title="Désactiver / Couper la musique (⏹️)"
              >
                ⏹️
              </button>
            </div>

            <!-- Options Aléatoire / Boucle / Volume -->
            <div class="playback-options">
              <button 
                class="opt-btn" 
                class:active-opt={playlistStore.isShuffle}
                onclick={() => playlistStore.isShuffle = !playlistStore.isShuffle}
                title="Lecture aléatoire (Shuffle)"
              >
                🔀 Aléatoire
              </button>

              <button 
                class="opt-btn" 
                class:active-opt={playlistStore.loopMode !== 'none'}
                onclick={() => {
                  if (playlistStore.loopMode === 'all') playlistStore.loopMode = 'one';
                  else if (playlistStore.loopMode === 'one') playlistStore.loopMode = 'none';
                  else playlistStore.loopMode = 'all';
                }}
                title="Mode de répétition"
              >
                {playlistStore.loopMode === 'all' ? '🔁 Répéter Tout' : playlistStore.loopMode === 'one' ? '🔂 Répéter 1' : '➡️ Une fois'}
              </button>

              <div class="volume-slider-wrap">
                <span class="vol-icon">🔉</span>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.02" 
                  value={playlistStore.volume} 
                  oninput={(e) => playlistStore.setVolume(Number((e.target as HTMLInputElement).value))}
                  title={`Volume : ${Math.round(playlistStore.volume * 100)}%`}
                />
                <span class="vol-percent">{Math.round(playlistStore.volume * 100)}%</span>
              </div>
            </div>
          </div>

          <!-- Sélecteur d'Ambiances Prédéfinies -->
          <div class="themes-card">
            <span class="card-section-title">Playlists Thématiques Rapides</span>
            <div class="themes-grid">
              <button 
                class="theme-btn" 
                class:active-theme={playlistStore.activeTheme === 'combat'}
                onclick={() => playlistStore.loadTheme('combat', vaultAudios())}
              >
                ⚔️ Combat & Tension
              </button>
              <button 
                class="theme-btn" 
                class:active-theme={playlistStore.activeTheme === 'tavern'}
                onclick={() => playlistStore.loadTheme('tavern', vaultAudios())}
              >
                🍺 Taverne & Auberge
              </button>
              <button 
                class="theme-btn" 
                class:active-theme={playlistStore.activeTheme === 'exploration'}
                onclick={() => playlistStore.loadTheme('exploration', vaultAudios())}
              >
                🌲 Voyage & Forêt
              </button>
              <button 
                class="theme-btn" 
                class:active-theme={playlistStore.activeTheme === 'dungeon'}
                onclick={() => playlistStore.loadTheme('dungeon', vaultAudios())}
              >
                💀 Donjon & Crypte
              </button>
              <button 
                class="theme-btn" 
                class:active-theme={playlistStore.activeTheme === 'rest'}
                onclick={() => playlistStore.loadTheme('rest', vaultAudios())}
              >
                🏕️ Bivouac & Calme
              </button>
              <button 
                class="theme-btn custom" 
                class:active-theme={playlistStore.activeTheme === 'custom'}
                onclick={() => playlistStore.loadTheme('custom')}
              >
                ⭐ Ma Playlist ({playlistStore.customPlaylist.length})
              </button>
            </div>
          </div>

          <!-- Actions d'Import & Bibliothèque Céleste -->
          <div class="import-card">
            <input 
              type="file" 
              accept="audio/*" 
              bind:this={fileInputRef} 
              onchange={handleFileUpload} 
              style="display: none;" 
            />
            <button class="btn-import-pc" onclick={() => fileInputRef?.click()}>
              ➕ Importer une Musique (depuis votre PC)
            </button>
            <button class="btn-celestial-link" onclick={() => { onclose(); onOpenCelestial?.(); }}>
              🌌 Bibliothèque Céleste (+800 Musiques & Ambiances)
            </button>
          </div>
        </div>

        <!-- Colonne Droite : Liste des Pistes de la Playlist -->
        <div class="col-tracks">
          
          <div class="tracks-header">
            <span class="tracks-title">
              📋 File d'attente ({playlistStore.tracks.length} morceau{playlistStore.tracks.length > 1 ? 'x' : ''})
            </span>
            {#if playlistStore.tracks.length > 0}
              <button class="btn-clear-tracks" onclick={() => playlistStore.clearPlaylist()} title="Vider la file d'attente">
                🗑️ Vider
              </button>
            {/if}
          </div>

          <!-- Liste scrollable des pistes -->
          <div class="tracks-scroll-list">
            {#if playlistStore.tracks.length === 0}
              <div class="empty-state">
                <span class="empty-icon">🎧</span>
                <p class="empty-text">Votre playlist est vide pour le moment.</p>
                <p class="empty-sub">Importez un fichier audio depuis votre PC ou choisissez parmi vos musiques ci-dessous pour lancer l'ambiance.</p>
              </div>
            {:else}
              {#each playlistStore.tracks as track, idx (track.id || idx)}
                {@const isCurrent = playlistStore.currentTrackIndex === idx}
                <div class="track-row" class:is-playing={isCurrent && playlistStore.isPlaying}>
                  <button class="track-btn-play" onclick={() => playlistStore.playTrack(idx)} title="Lancer ce morceau">
                    <span class="track-num">{isCurrent && playlistStore.isPlaying ? '▶️' : `${idx + 1}`}</span>
                    <span class="track-name">{track.name}</span>
                  </button>
                  <button class="btn-remove-track" onclick={() => playlistStore.removeTrack(idx)} title="Retirer de la playlist">
                    ✕
                  </button>
                </div>
              {/each}
            {/if}
          </div>

          <!-- Explorateur des Musiques du Vault -->
          <div class="vault-browser">
            <div class="vault-browser-header">
              <span class="vault-browser-title">📁 Musiques de votre Coffre MJ ({vaultAudios().length})</span>
              <input 
                type="text" 
                class="vault-search-input" 
                placeholder="🔍 Filtrer les musiques du coffre..."
                bind:value={searchQuery}
              />
            </div>
            
            <div class="vault-audios-list">
              {#if filteredVaultAudios().length === 0}
                <div class="vault-empty">Aucune musique trouvée dans le coffre.</div>
              {:else}
                {#each filteredVaultAudios().slice(0, 50) as aud}
                  <div class="vault-item-row">
                    <span class="vault-item-name" title={aud.path}>{aud.name}</span>
                    <div class="vault-item-actions">
                      <button class="btn-vault-add" onclick={() => handleAddFromVault(aud)} title="Ajouter à la playlist">
                        ➕ Ajouter
                      </button>
                      <button class="btn-vault-play" onclick={() => {
                        playlistStore.addTrack({ name: aud.name, src: aud.path, sourceType: 'vault' });
                        playlistStore.playTrack(playlistStore.tracks.length - 1);
                      }} title="Jouer immédiatement">
                        ▶️ Jouer
                      </button>
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          </div>

        </div>

      </div>

    </div>
  </div>
{/if}

<style>
  .playlist-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(3, 4, 8, 0.88);
    backdrop-filter: blur(8px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
  }

  .playlist-window {
    width: 100%;
    max-width: 980px;
    max-height: 88vh;
    background: #141721;
    border: 1px solid #2e344a;
    border-radius: 14px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(99, 102, 241, 0.15);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Header */
  .playlist-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    background: #191d2c;
    border-bottom: 1px solid #2e344a;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .header-icon {
    font-size: 28px;
  }

  .header-title {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: #f3f4f6;
  }

  .header-subtitle {
    margin: 2px 0 0;
    font-size: 12px;
    color: #94a3b8;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  /* Interrupteur général de musique */
  .btn-master-toggle {
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 700;
    border-radius: 8px;
    cursor: pointer;
    border: 1px solid #10b981;
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    transition: all 0.2s ease;
  }

  .btn-master-toggle:hover {
    background: rgba(16, 185, 129, 0.25);
    box-shadow: 0 0 14px rgba(16, 185, 129, 0.35);
  }

  .btn-master-toggle.is-disabled {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .btn-master-toggle.is-disabled:hover {
    background: rgba(239, 68, 68, 0.25);
    box-shadow: 0 0 14px rgba(239, 68, 68, 0.35);
  }

  .btn-close {
    background: #252b3d;
    border: 1px solid #3b4259;
    color: #cbd5e1;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
  }

  .btn-close:hover {
    background: #333a52;
    color: #ffffff;
  }

  /* Body */
  .playlist-body {
    display: grid;
    grid-template-columns: 380px 1fr;
    gap: 20px;
    padding: 20px 24px;
    overflow-y: auto;
    max-height: calc(88vh - 75px);
  }

  /* Colonne Contrôles */
  .col-controls {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .now-playing-card {
    background: #191d2c;
    border: 1px solid #2e344a;
    border-radius: 12px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.25);
  }

  .now-playing-card.disabled-card {
    opacity: 0.6;
    border-color: #ef4444;
  }

  .track-info {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .music-disc {
    font-size: 38px;
    display: inline-block;
  }

  .music-disc.spinning {
    animation: spinDisc 4s linear infinite;
  }

  @keyframes spinDisc {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .track-details {
    display: flex;
    flex-direction: column;
    gap: 3px;
    overflow: hidden;
  }

  .track-status {
    font-size: 10px;
    font-weight: 800;
    color: #6366f1;
    letter-spacing: 0.5px;
  }

  .track-title {
    font-size: 15px;
    font-weight: 700;
    color: #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-source {
    font-size: 11px;
    color: #64748b;
  }

  /* Boutons Playback */
  .playback-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .ctrl-btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #252b3d;
    border: 1px solid #3b4259;
    color: #f1f5f9;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .ctrl-btn:hover:not(:disabled) {
    background: #333a52;
    transform: scale(1.06);
  }

  .ctrl-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .ctrl-btn.play-btn {
    width: 54px;
    height: 54px;
    background: #6366f1;
    border-color: #818cf8;
    font-size: 22px;
    box-shadow: 0 0 16px rgba(99, 102, 241, 0.4);
  }

  .ctrl-btn.play-btn:hover:not(:disabled) {
    background: #4f46e5;
  }

  .ctrl-btn.stop-btn {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.15);
  }

  /* Options */
  .playback-options {
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-top: 1px solid #282e42;
    padding-top: 12px;
  }

  .opt-btn {
    background: #202536;
    border: 1px solid #2e344a;
    color: #94a3b8;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
  }

  .opt-btn.active-opt {
    background: rgba(99, 102, 241, 0.2);
    border-color: #6366f1;
    color: #a5b4fc;
    font-weight: 600;
  }

  .volume-slider-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 4px;
  }

  .vol-icon {
    font-size: 16px;
  }

  .volume-slider-wrap input[type="range"] {
    flex: 1;
    accent-color: #6366f1;
    cursor: pointer;
  }

  .vol-percent {
    font-size: 12px;
    font-family: monospace;
    color: #94a3b8;
    width: 38px;
    text-align: right;
  }

  /* Thèmes */
  .themes-card, .import-card {
    background: #191d2c;
    border: 1px solid #2e344a;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .card-section-title {
    font-size: 12px;
    font-weight: 700;
    color: #cbd5e1;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .themes-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .theme-btn {
    background: #202536;
    border: 1px solid #2e344a;
    color: #cbd5e1;
    padding: 8px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
  }

  .theme-btn:hover {
    background: #282e42;
    border-color: #434c6b;
  }

  .theme-btn.active-theme {
    background: rgba(99, 102, 241, 0.2);
    border-color: #6366f1;
    color: #e0e7ff;
  }

  .theme-btn.custom {
    grid-column: span 2;
    border-color: #eab308;
    color: #fde047;
    background: rgba(234, 179, 8, 0.1);
  }

  /* Imports */
  .btn-import-pc {
    background: #3b82f6;
    color: #ffffff;
    border: none;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-import-pc:hover {
    background: #2563eb;
  }

  .btn-celestial-link {
    background: rgba(168, 85, 247, 0.15);
    border: 1px solid #a855f7;
    color: #d8b4fe;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-celestial-link:hover {
    background: rgba(168, 85, 247, 0.25);
  }

  /* Colonne Droite */
  .col-tracks {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .tracks-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .tracks-title {
    font-size: 14px;
    font-weight: 700;
    color: #f1f5f9;
  }

  .btn-clear-tracks {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 12px;
    cursor: pointer;
  }

  .btn-clear-tracks:hover {
    color: #ef4444;
  }

  .tracks-scroll-list {
    background: #191d2c;
    border: 1px solid #2e344a;
    border-radius: 12px;
    padding: 8px;
    height: 220px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: #64748b;
    padding: 20px;
  }

  .empty-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }

  .empty-text {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: #cbd5e1;
  }

  .empty-sub {
    margin: 4px 0 0;
    font-size: 11px;
    color: #64748b;
  }

  .track-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #202536;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 6px 10px;
    transition: all 0.15s;
  }

  .track-row:hover {
    background: #282e42;
  }

  .track-row.is-playing {
    background: rgba(99, 102, 241, 0.2);
    border-color: #6366f1;
  }

  .track-btn-play {
    display: flex;
    align-items: center;
    gap: 10px;
    background: transparent;
    border: none;
    color: #f1f5f9;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    flex: 1;
    text-align: left;
    overflow: hidden;
  }

  .track-num {
    font-size: 11px;
    color: #64748b;
    min-width: 22px;
  }

  .track-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .btn-remove-track {
    background: transparent;
    border: none;
    color: #64748b;
    font-size: 12px;
    cursor: pointer;
    padding: 4px 6px;
  }

  .btn-remove-track:hover {
    color: #ef4444;
  }

  /* Explorateur du coffre */
  .vault-browser {
    background: #191d2c;
    border: 1px solid #2e344a;
    border-radius: 12px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1;
  }

  .vault-browser-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }

  .vault-browser-title {
    font-size: 12px;
    font-weight: 700;
    color: #cbd5e1;
    white-space: nowrap;
  }

  .vault-search-input {
    flex: 1;
    background: #202536;
    border: 1px solid #2e344a;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    color: #f1f5f9;
  }

  .vault-audios-list {
    max-height: 180px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .vault-empty {
    font-size: 11px;
    color: #64748b;
    padding: 10px;
    text-align: center;
  }

  .vault-item-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #202536;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
  }

  .vault-item-name {
    color: #cbd5e1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 300px;
  }

  .vault-item-actions {
    display: flex;
    gap: 6px;
  }

  .btn-vault-add, .btn-vault-play {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    border: none;
  }

  .btn-vault-add {
    background: #2e344a;
    color: #e2e8f0;
  }

  .btn-vault-add:hover {
    background: #3b4259;
  }

  .btn-vault-play {
    background: #6366f1;
    color: #ffffff;
  }

  .btn-vault-play:hover {
    background: #4f46e5;
  }
</style>

