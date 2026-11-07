<script lang="ts">
  import { sessionIntroStore, INTRO_AUDIO_PRESETS, type IntroVisualTheme, type IntroTextMode, type IntroWeatherEffect } from '$lib/stores/sessionIntro.svelte';
  import { getVaultTree, getVaultPath } from '$lib/stores/vault.svelte';
  import { isTauri, createDirectory, writeFileBase64, reindex } from '$lib/api';
  import SessionIntroScreen from './SessionIntroScreen.svelte';

  let fileInputRef = $state<HTMLInputElement | null>(null);
  let imageInputRef = $state<HTMLInputElement | null>(null);
  let showVaultPicker = $state(false);
  let showVaultImagePicker = $state(false);
  let showVisualSettings = $state(false);
  let showAudioPresets = $state(false);

  function formatTime(secs: number): string {
    if (!secs || isNaN(secs) || secs <= 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function getAllAudioFiles(node: any, result: { name: string; path: string }[] = []): { name: string; path: string }[] {
    if (!node) return result;
    if (node.type === 'file') {
      const ext = node.name.split('.').pop()?.toLowerCase();
      if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) {
        result.push({ name: node.name.replace(/\.[^/.]+$/, ''), path: node.path });
      }
    } else if (node.children) {
      for (const child of node.children) {
        getAllAudioFiles(child, result);
      }
    }
    return result;
  }

  function getAllImageFiles(node: any, result: { name: string; path: string }[] = []): { name: string; path: string }[] {
    if (!node) return result;
    if (node.type === 'file') {
      const ext = node.name.split('.').pop()?.toLowerCase();
      if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'].includes(ext)) {
        result.push({ name: node.name.replace(/\.[^/.]+$/, ''), path: node.path });
      }
    } else if (node.children) {
      for (const child of node.children) {
        getAllImageFiles(child, result);
      }
    }
    return result;
  }

  const vaultAudios = $derived(() => {
    return getAllAudioFiles(getVaultTree());
  });

  const vaultImages = $derived(() => {
    return getAllImageFiles(getVaultTree());
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

          sessionIntroStore.setAudio(relPath, file.name.replace(/\.[^/.]+$/, ''));
          return;
        } catch (err) {
          console.warn('Fallback lecture directe audio:', err);
        }
      }

      sessionIntroStore.setAudio(dataUrl, file.name.replace(/\.[^/.]+$/, ''));
    };

    reader.readAsDataURL(file);
    target.value = '';
  }

  async function handleImageUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    const file = target.files[0];
    const reader = new FileReader();

    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;

      const vaultPath = getVaultPath();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const relPath = `assets/images/${safeName}`;

      if (vaultPath && isTauri()) {
        try {
          await createDirectory(vaultPath, 'assets');
          await createDirectory(vaultPath, 'assets/images');
          const base64Data = dataUrl.split(',')[1] || '';
          await writeFileBase64(vaultPath, relPath, base64Data);
          await reindex(vaultPath);

          sessionIntroStore.setImage(relPath);
          return;
        } catch (err) {
          console.warn('Fallback image dataUrl:', err);
        }
      }

      sessionIntroStore.setImage(dataUrl);
    };

    reader.readAsDataURL(file);
    target.value = '';
  }

  function handleSeek(e: Event) {
    const target = e.target as HTMLInputElement;
    sessionIntroStore.seek(Number(target.value));
  }
</script>

{#if sessionIntroStore.isOpen}
  <div class="intro-player-wrapper" class:minimized={sessionIntroStore.isMinimized}>
    
    <!-- Mode Réduit (Pastille ultra compacte) -->
    {#if sessionIntroStore.isMinimized}
      <div class="intro-mini-bar">
        <span class="mini-icon" class:pulse={sessionIntroStore.isPlaying}>🎬</span>
        <button 
          class="mini-title-btn" 
          onclick={() => sessionIntroStore.isMinimized = false}
          title="Agrandir le lecteur d'intro"
        >
          <span class="mini-title">{sessionIntroStore.sessionTitle || 'Intro de Soirée'}</span>
          <span class="mini-time">
            {#if sessionIntroStore.countdownRemaining > 0}
              ⏳ {formatTime(sessionIntroStore.countdownRemaining)}
            {:else}
              {formatTime(sessionIntroStore.currentTime)} / {formatTime(sessionIntroStore.duration)}
            {/if}
          </span>
        </button>

        {#if sessionIntroStore.isPlaying}
          <button class="mini-ctrl-btn" onclick={() => sessionIntroStore.pause()} title="Pause (⏸️)">⏸️</button>
          <button class="mini-ctrl-btn fade" onclick={() => sessionIntroStore.fadeOut(3000)} title="Fondu de sortie (📉)">📉</button>
          <button class="mini-ctrl-btn stop" onclick={() => sessionIntroStore.stop()} title="Arrêter (⏹️)">⏹️</button>
        {:else}
          <button class="mini-ctrl-btn play" onclick={() => sessionIntroStore.play()} title="Lancer l'Intro (▶️)">▶️</button>
        {/if}

        <button class="mini-toggle-btn" onclick={() => sessionIntroStore.isMinimized = false} title="Agrandir">▲</button>
        <button class="mini-close-btn" onclick={() => sessionIntroStore.close()} title="Fermer">✕</button>
      </div>

    <!-- Mode Développé (Lecteur Cinématique Complet) -->
    {:else}
      <div class="intro-full-dock">
        
        <!-- Header -->
        <div class="dock-header">
          <div class="dock-title-box">
            <span class="dock-icon" class:pulse={sessionIntroStore.isPlaying}>🎬</span>
            <div class="dock-titles">
              <span class="dock-badge">GÉNÉRIQUE & INTRO DE SESSION</span>
              <input 
                type="text" 
                class="session-title-input" 
                placeholder="Titre de la session (ex: Épisode 12 — Le Réveil de l'Ancien)"
                bind:value={sessionIntroStore.sessionTitle}
                oninput={() => {
                  sessionIntroStore.saveState();
                  sessionIntroStore.syncPlayerIntroScreen();
                }}
              />
            </div>
          </div>

          <div class="dock-top-actions">
            <button 
              class="dock-btn-tool visual-toggle" 
              class:active={showVisualSettings}
              onclick={() => showVisualSettings = !showVisualSettings}
              title="Personnaliser l'écran Joueur (Affiche, Défilement 3D, Météo, Casting, IA)"
            >
              🎭 Studio Cinéma {showVisualSettings ? '▲' : '▼'}
            </button>
            <button class="dock-btn-tool" onclick={() => sessionIntroStore.isMinimized = true} title="Réduire en barre compacte">_</button>
            <button class="dock-btn-tool close" onclick={() => sessionIntroStore.close()} title="Fermer le lecteur d'intro">✕</button>
          </div>
        </div>

        <!-- Section extensible : Studio Cinéma Complet (Les 7 Options) -->
        {#if showVisualSettings}
          <div class="visual-settings-panel">
            <div class="visual-grid">
              
              <!-- Colonne gauche : Narration, IA & Voix-Off -->
              <div class="visual-col">
                <label class="field-label" for="intro-subtitle-input">Sous-titre / Acte</label>
                <input 
                  id="intro-subtitle-input"
                  type="text" 
                  class="field-input" 
                  placeholder="ex: Acte I — L'Embuscade du Col"
                  bind:value={sessionIntroStore.sessionSubtitle}
                  oninput={() => {
                    sessionIntroStore.saveState();
                    sessionIntroStore.syncPlayerIntroScreen();
                  }}
                />

                <div class="field-label-row" style="margin-top: 10px;">
                  <label class="field-label" for="intro-narration-input" style="margin-bottom: 0;">Accroche / Prologue narratif</label>
                  <div class="ai-speech-actions">
                    <button 
                      class="btn-magic-ai" 
                      onclick={() => sessionIntroStore.generateAiNarration()}
                      disabled={sessionIntroStore.isGeneratingAi}
                      title="Rédiger automatiquement une accroche théâtrale via Ollama"
                    >
                      {sessionIntroStore.isGeneratingAi ? '✨ Rédaction…' : '✨ Accroche IA'}
                    </button>
                    <button 
                      class="btn-voice-over" 
                      class:active={sessionIntroStore.isVoiceOverActive}
                      onclick={() => sessionIntroStore.toggleVoiceOver()}
                      title="Lire le texte à voix haute avec atténuation musicale automatique"
                    >
                      {sessionIntroStore.isVoiceOverActive ? '⏹️ Voix-Off' : '🗣️ Voix-Off IA'}
                    </button>
                  </div>
                </div>

                <textarea 
                  id="intro-narration-input"
                  class="field-textarea" 
                  rows="3"
                  placeholder="Texte de contextualisation ou résumé de la séance précédente..."
                  bind:value={sessionIntroStore.sessionNarration}
                  oninput={() => {
                    sessionIntroStore.saveState();
                    sessionIntroStore.syncPlayerIntroScreen();
                  }}
                ></textarea>

                <!-- Options Défilement 3D et Casting Héros -->
                <div class="cinema-toggles-row">
                  <div class="mode-chips">
                    <span class="mini-opt-lbl">Texte :</span>
                    <button 
                      class="theme-chip" 
                      class:active={sessionIntroStore.textDisplayMode === 'card'}
                      onclick={() => sessionIntroStore.setTextDisplayMode('card')}
                      title="Affichage classique en parchemin/carte"
                    >
                      📜 Carte
                    </button>
                    <button 
                      class="theme-chip" 
                      class:active={sessionIntroStore.textDisplayMode === 'crawl'}
                      onclick={() => sessionIntroStore.setTextDisplayMode('crawl')}
                      title="Défilement spatial vers le haut en perspective 3D (façon Star Wars)"
                    >
                      🚀 Défilement 3D
                    </button>
                  </div>

                  <label class="inline-checkbox" title="Affiche le générique des personnages de la table avec leurs avatars">
                    <input 
                      type="checkbox" 
                      checked={sessionIntroStore.showHeroesCasting} 
                      onchange={(e) => sessionIntroStore.setShowHeroesCasting((e.target as HTMLInputElement).checked)}
                    />
                    <span>🎭 Casting des Héros</span>
                  </label>
                </div>

              </div>

              <!-- Colonne droite : Affiche, Météo, Compte à rebours & Thème -->
              <div class="visual-col">
                <span class="field-label">Affiche / Image d'ambiance</span>
                <div class="image-picker-row">
                  <input 
                    type="file" 
                    accept="image/*" 
                    bind:this={imageInputRef} 
                    onchange={handleImageUpload} 
                    style="display: none;" 
                  />
                  <button class="btn-sub" onclick={() => imageInputRef?.click()} title="Choisir une image sur votre ordinateur">
                    📂 Image (PC)
                  </button>
                  <button class="btn-sub" onclick={() => showVaultImagePicker = !showVaultImagePicker} title="Choisir une image du coffre">
                    📁 Coffre ({vaultImages().length})
                  </button>
                  {#if sessionIntroStore.sessionImageUrl}
                    <button class="btn-sub clear" onclick={() => sessionIntroStore.setImage('')} title="Retirer l'image">
                      ✕ Retirer
                    </button>
                  {/if}
                </div>

                {#if sessionIntroStore.sessionImageUrl}
                  <div class="image-preview-badge">
                    <span>🖼️ {sessionIntroStore.sessionImageUrl.split('/').pop()?.split('\\').pop()}</span>
                  </div>
                {/if}

                <!-- Météo cinématique en surimpression -->
                <div class="sub-config-row" style="margin-top: 10px;">
                  <span class="mini-opt-lbl">Météo :</span>
                  <div class="theme-chips">
                    {#each [
                      { id: 'none', label: '☀️' },
                      { id: 'rain', label: '🌧️ Pluie' },
                      { id: 'snow', label: '❄️ Neige' },
                      { id: 'embers', label: '🔥 Braises' },
                      { id: 'storm', label: '⚡ Orage' }
                    ] as fx}
                      <button 
                        class="theme-chip" 
                        class:active={sessionIntroStore.weatherEffect === fx.id}
                        onclick={() => sessionIntroStore.setWeatherEffect(fx.id as IntroWeatherEffect)}
                      >
                        {fx.label}
                      </button>
                    {/each}
                  </div>
                </div>

                <!-- Compte à rebours avant lancement -->
                <div class="sub-config-row" style="margin-top: 8px;">
                  <span class="mini-opt-lbl">Compteur :</span>
                  <div class="theme-chips">
                    {#each [
                      { sec: 0, label: 'Sans' },
                      { sec: 60, label: '1 min' },
                      { sec: 120, label: '2 min' },
                      { sec: 180, label: '3 min' },
                      { sec: 300, label: '5 min' }
                    ] as cd}
                      <button 
                        class="theme-chip" 
                        class:active={sessionIntroStore.countdownDuration === cd.sec}
                        onclick={() => sessionIntroStore.countdownDuration = cd.sec}
                      >
                        {cd.label}
                      </button>
                    {/each}
                  </div>
                </div>

                <!-- Thèmes Visuels & Aperçu -->
                <div class="sub-config-row" style="margin-top: 8px;">
                  <span class="mini-opt-lbl">Ambiance :</span>
                  <div class="theme-chips">
                    {#each [
                      { id: 'cinematic', label: '🌌 Épique' },
                      { id: 'parchment', label: '📜 Parchemin' },
                      { id: 'cinders', label: '⚔️ Dark' },
                      { id: 'starry', label: '✨ Étoiles' }
                    ] as th}
                      <button 
                        class="theme-chip" 
                        class:active={sessionIntroStore.visualTheme === th.id}
                        onclick={() => sessionIntroStore.setTheme(th.id as IntroVisualTheme)}
                      >
                        {th.label}
                      </button>
                    {/each}
                    
                    <button 
                      class="theme-chip preview-btn" 
                      onclick={() => sessionIntroStore.showScreenPreview = true}
                      title="Voir un aperçu plein écran du rendu Joueur"
                    >
                      👁️ Aperçu
                    </button>
                  </div>
                </div>

              </div>

            </div>

            <!-- Liste images coffre déroulante -->
            {#if showVaultImagePicker}
              <div class="vault-dropdown-list images">
                {#if vaultImages().length === 0}
                  <div class="vault-empty">Aucune image trouvée dans le coffre de campagne.</div>
                {:else}
                  {#each vaultImages().slice(0, 15) as img}
                    <button 
                      class="vault-item-btn" 
                      class:active={sessionIntroStore.sessionImageUrl === img.path}
                      onclick={() => {
                        sessionIntroStore.setImage(img.path);
                        showVaultImagePicker = false;
                      }}
                    >
                      🖼️ {img.name}
                    </button>
                  {/each}
                {/if}
              </div>
            {/if}

          </div>
        {/if}

        <!-- Corps Audio -->
        <div class="dock-body">
          
          <!-- Piste en cours et Sélecteur -->
          <div class="track-selection-row">
            <div class="active-track-pill">
              <span class="track-disc" class:spinning={sessionIntroStore.isPlaying}>💿</span>
              <span class="track-name" title={sessionIntroStore.trackName}>
                {sessionIntroStore.trackName || 'Aucun thème sélectionné'}
              </span>
            </div>

            <!-- Boutons de sélection -->
            <div class="track-btns">
              <button 
                class="btn-vault-picker" 
                class:active={showAudioPresets}
                onclick={() => showAudioPresets = !showAudioPresets} 
                title="Choisir parmi les thèmes d'ambiance intégrés sans fichier requis"
              >
                🎼 Thèmes Préréglés
              </button>

              <input 
                type="file" 
                accept="audio/mp3,audio/*" 
                bind:this={fileInputRef} 
                onchange={handleFileUpload} 
                style="display: none;" 
              />
              <button class="btn-import-mp3" onclick={() => fileInputRef?.click()} title="Choisir un fichier MP3 sur votre ordinateur">
                📂 Mon MP3 (PC)
              </button>

              <button class="btn-vault-picker" onclick={() => showVaultPicker = !showVaultPicker} title="Choisir parmi les musiques du coffre MJ">
                📁 Coffre ({vaultAudios().length})
              </button>
            </div>
          </div>

          <!-- Menu des Presets Audio Intégrés (Option 7) -->
          {#if showAudioPresets}
            <div class="audio-presets-shelf">
              <span class="presets-shelf-title">⚡ Thèmes d'Introduction Intégrés (Web Audio) :</span>
              <div class="presets-grid-row">
                {#each INTRO_AUDIO_PRESETS as preset}
                  <button 
                    class="preset-card-btn" 
                    class:active={sessionIntroStore.selectedPresetId === preset.id}
                    onclick={() => {
                      sessionIntroStore.applyAudioPreset(preset);
                      showAudioPresets = false;
                    }}
                    title={preset.desc}
                  >
                    <span class="preset-card-icon">{preset.icon}</span>
                    <span class="preset-card-name">{preset.name}</span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Menu déroulant du coffre si ouvert -->
          {#if showVaultPicker}
            <div class="vault-dropdown-list">
              {#if vaultAudios().length === 0}
                <div class="vault-empty">Aucun fichier audio dans le coffre de campagne.</div>
              {:else}
                {#each vaultAudios().slice(0, 15) as aud}
                  <button 
                    class="vault-item-btn" 
                    class:active={sessionIntroStore.audioSrc === aud.path}
                    onclick={() => {
                      sessionIntroStore.setAudio(aud.path, aud.name);
                      showVaultPicker = false;
                    }}
                  >
                    🎵 {aud.name}
                  </button>
                {/each}
              {/if}
            </div>
          {/if}

          <!-- Timeline Scrubber -->
          <div class="timeline-row">
            <span class="time-label">{formatTime(sessionIntroStore.currentTime)}</span>
            <input 
              type="range" 
              class="timeline-slider"
              min="0" 
              max={sessionIntroStore.duration || 100} 
              step="0.5"
              value={sessionIntroStore.currentTime}
              oninput={handleSeek}
            />
            <span class="time-label total">{formatTime(sessionIntroStore.duration)}</span>
          </div>

          <!-- Barre de Contrôles & Options -->
          <div class="controls-action-bar">
            
            <div class="playback-buttons">
              {#if sessionIntroStore.isPlaying}
                <button class="btn-ctrl pause" onclick={() => sessionIntroStore.pause()} title="Mettre en pause">
                  ⏸️ Pause
                </button>
              {:else}
                <button class="btn-ctrl play" onclick={() => sessionIntroStore.play()} title="Lancer l'Intro">
                  ▶️ Lancer l'Intro
                </button>
              {/if}

              <button 
                class="btn-ctrl fadeout" 
                onclick={() => sessionIntroStore.fadeOut(3500)}
                disabled={!sessionIntroStore.isPlaying}
                title="Baisse progressive du volume pour enchaîner sur la voix du MJ (Fade-Out 3.5s)"
              >
                📉 Fondu Voix MJ
              </button>

              <button class="btn-ctrl stop" onclick={() => sessionIntroStore.stop()} title="Arrêter immédiatement">
                ⏹️ Stop
              </button>
            </div>

            <!-- Options Cinéma, Normalisation & Volume -->
            <div class="secondary-options">
              <label class="cinema-label" title="Normalisation dynamique du volume (compresseur Web Audio) : égalise les montées et descentes de volume pour un niveau sonore stable et constant">
                <input 
                  type="checkbox" 
                  checked={sessionIntroStore.normalizeAudio} 
                  onchange={(e) => sessionIntroStore.setNormalizeAudio((e.target as HTMLInputElement).checked)}
                />
                🎚️ Normaliser
              </label>

              <label class="cinema-label" title="Fondu d'entrée doux (Fade-In 2.5s). Décochez pour un démarrage direct à volume stable sans montée progressive.">
                <input 
                  type="checkbox" 
                  checked={sessionIntroStore.autoFadeIn} 
                  onchange={(e) => sessionIntroStore.setAutoFadeIn((e.target as HTMLInputElement).checked)}
                />
                📈 Fondu d'entrée
              </label>

              <label class="cinema-label" title="Assombrit l'écran des joueurs et affiche l'affiche cinématique de session pendant la musique d'intro">
                <input 
                  type="checkbox" 
                  bind:checked={sessionIntroStore.cinemaBlackout} 
                  onchange={() => sessionIntroStore.syncPlayerIntroScreen()}
                />
                🎬 Écran Cinéma Joueurs
              </label>

              <div class="volume-box">
                <span class="vol-icon">🔉</span>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05"
                  value={sessionIntroStore.volume}
                  oninput={(e) => sessionIntroStore.setVolume(Number((e.target as HTMLInputElement).value))}
                  title={`Volume : ${Math.round(sessionIntroStore.volume * 100)}%`}
                />
                <span class="vol-val">{Math.round(sessionIntroStore.volume * 100)}%</span>
              </div>
            </div>

          </div>

        </div>

      </div>
    {/if}

  </div>
{/if}

<!-- Modal d'Aperçu Écran Joueur pour le MJ -->
{#if sessionIntroStore.showScreenPreview}
  <SessionIntroScreen 
    data={{
      active: true,
      title: sessionIntroStore.sessionTitle,
      subtitle: sessionIntroStore.sessionSubtitle,
      narration: sessionIntroStore.sessionNarration,
      imageUrl: sessionIntroStore.sessionImageUrl,
      theme: sessionIntroStore.visualTheme,
      textMode: sessionIntroStore.textDisplayMode,
      weatherEffect: sessionIntroStore.weatherEffect,
      countdownRemaining: sessionIntroStore.countdownDuration,
      showHeroes: sessionIntroStore.showHeroesCasting,
      heroes: sessionIntroStore.getHeroCastList()
    }}
    vaultPath={getVaultPath()}
    isPreview={true}
    onClose={() => sessionIntroStore.showScreenPreview = false}
  />
{/if}

<style>
  .intro-player-wrapper {
    position: fixed;
    top: 52px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 950;
    width: min(880px, 95vw);
    animation: slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }

  .intro-player-wrapper.minimized {
    top: 52px;
    width: auto;
  }

  /* ── Mode Réduit ── */
  .intro-mini-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(18, 20, 29, 0.96);
    border: 1px solid rgba(229, 168, 83, 0.45);
    border-radius: 24px;
    padding: 4px 10px 4px 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(10px);
  }

  .mini-icon { font-size: 15px; }
  .mini-icon.pulse { animation: pulseIcon 1.5s infinite; }

  .mini-title-btn {
    background: none;
    border: none;
    color: #e5a853;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 2px 6px;
    text-align: left;
  }

  .mini-title {
    font-size: 13px;
    font-weight: 600;
    max-width: 220px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mini-time {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.55);
    font-variant-numeric: tabular-nums;
  }

  .mini-ctrl-btn {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    color: #fff;
    cursor: pointer;
    font-size: 12px;
    padding: 3px 6px;
    transition: all 0.15s;
  }
  .mini-ctrl-btn:hover { background: rgba(229, 168, 83, 0.25); border-color: #e5a853; }
  .mini-ctrl-btn.fade { background: rgba(229, 168, 83, 0.15); color: #e5a853; }

  .mini-toggle-btn, .mini-close-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    font-size: 11px;
    padding: 2px 4px;
  }
  .mini-toggle-btn:hover, .mini-close-btn:hover { color: #fff; }

  /* ── Mode Développé (Dock) ── */
  .intro-full-dock {
    background: rgba(14, 16, 24, 0.97);
    border: 1px solid rgba(229, 168, 83, 0.4);
    border-radius: 12px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.75), 0 0 20px rgba(229, 168, 83, 0.12);
    backdrop-filter: blur(14px);
    overflow: hidden;
  }

  .dock-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: rgba(229, 168, 83, 0.08);
    border-bottom: 1px solid rgba(229, 168, 83, 0.2);
  }

  .dock-title-box {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
  }

  .dock-icon { font-size: 18px; }
  .dock-icon.pulse { animation: pulseIcon 1.5s infinite; }

  .dock-titles {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    margin-right: 12px;
  }

  .dock-badge {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1.5px;
    color: #e5a853;
    text-transform: uppercase;
  }

  .session-title-input {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(229, 168, 83, 0.3);
    border-radius: 4px;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    padding: 4px 8px;
    width: 100%;
    outline: none;
    transition: border-color 0.2s;
  }
  .session-title-input:focus { border-color: #e5a853; }

  .dock-top-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .dock-btn-tool {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    font-size: 12px;
    padding: 4px 8px;
    transition: all 0.15s;
  }
  .dock-btn-tool:hover { background: rgba(255, 255, 255, 0.15); color: #fff; }

  .dock-btn-tool.visual-toggle {
    font-size: 11px;
    font-weight: 600;
    color: #e5a853;
    border-color: rgba(229, 168, 83, 0.35);
  }
  .dock-btn-tool.visual-toggle.active {
    background: rgba(229, 168, 83, 0.2);
    border-color: #e5a853;
  }
  .dock-btn-tool.close:hover { background: rgba(220, 53, 69, 0.35); color: #ff8585; }

  /* ── Studio Cinéma ── */
  .visual-settings-panel {
    background: rgba(8, 10, 16, 0.95);
    border-bottom: 1px solid rgba(229, 168, 83, 0.25);
    padding: 12px 14px;
    animation: fadeIn 0.2s ease;
  }

  .visual-grid {
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    gap: 16px;
  }

  .visual-col {
    display: flex;
    flex-direction: column;
  }

  .field-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .field-label {
    display: block;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: rgba(229, 168, 83, 0.85);
    margin-bottom: 4px;
  }

  .ai-speech-actions {
    display: flex;
    gap: 6px;
  }

  .btn-magic-ai {
    background: rgba(168, 85, 247, 0.2);
    border: 1px solid rgba(168, 85, 247, 0.5);
    color: #d8b4fe;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-magic-ai:hover:not(:disabled) {
    background: rgba(168, 85, 247, 0.35);
    color: #fff;
  }

  .btn-voice-over {
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.5);
    color: #93c5fd;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-voice-over.active {
    background: rgba(239, 68, 68, 0.3);
    border-color: #ef4444;
    color: #fca5a5;
  }

  .field-input, .field-textarea {
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 4px;
    color: #fff;
    font-size: 12px;
    padding: 5px 8px;
    outline: none;
    font-family: inherit;
    resize: none;
  }
  .field-input:focus, .field-textarea:focus { border-color: #e5a853; }

  .cinema-toggles-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .mode-chips {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .inline-checkbox {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: #e5a853;
    cursor: pointer;
    font-weight: 600;
  }

  .sub-config-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .mini-opt-lbl {
    font-size: 10px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.6);
    width: 60px;
    text-transform: uppercase;
  }

  .image-picker-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .btn-sub {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 4px;
    color: #fff;
    cursor: pointer;
    font-size: 11px;
    padding: 4px 8px;
    transition: all 0.15s;
  }
  .btn-sub:hover { background: rgba(229, 168, 83, 0.2); border-color: #e5a853; }
  .btn-sub.clear { background: rgba(220, 53, 69, 0.2); border-color: rgba(220, 53, 69, 0.4); color: #ff8585; }

  .image-preview-badge {
    margin-top: 5px;
    font-size: 11px;
    color: #a8d5ff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .theme-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }

  .theme-chip {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    transition: all 0.15s;
  }
  .theme-chip:hover { background: rgba(255, 255, 255, 0.15); color: #fff; }
  .theme-chip.active { background: rgba(229, 168, 83, 0.25); border-color: #e5a853; color: #e5a853; }
  .theme-chip.preview-btn {
    background: rgba(0, 180, 216, 0.15);
    border-color: rgba(0, 180, 216, 0.4);
    color: #72efdd;
    margin-left: auto;
  }

  .vault-dropdown-list.images {
    margin-top: 10px;
    border-top: 1px solid rgba(229, 168, 83, 0.2);
    padding-top: 8px;
  }

  /* ── Presets Audio Étagère ── */
  .audio-presets-shelf {
    background: rgba(10, 12, 18, 0.95);
    border: 1px solid rgba(229, 168, 83, 0.3);
    border-radius: 6px;
    padding: 8px 10px;
  }
  .presets-shelf-title {
    font-size: 10px;
    font-weight: 700;
    color: #e5a853;
    text-transform: uppercase;
    display: block;
    margin-bottom: 6px;
  }
  .presets-grid-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .preset-card-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    color: #ddd;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    padding: 5px 8px;
    transition: all 0.15s;
  }
  .preset-card-btn:hover { background: rgba(229, 168, 83, 0.2); border-color: #e5a853; color: #fff; }
  .preset-card-btn.active { background: rgba(229, 168, 83, 0.3); border-color: #e5a853; color: #e5a853; }

  /* ── Corps Audio ── */
  .dock-body {
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .track-selection-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .active-track-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 5px 10px;
    flex: 1;
    overflow: hidden;
  }

  .track-disc { font-size: 14px; }
  .track-disc.spinning { animation: spin 3s linear infinite; }

  .track-name {
    font-size: 12px;
    color: #ddd;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-btns {
    display: flex;
    gap: 6px;
  }

  .btn-import-mp3, .btn-vault-picker {
    background: rgba(229, 168, 83, 0.15);
    border: 1px solid rgba(229, 168, 83, 0.35);
    border-radius: 6px;
    color: #e5a853;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    padding: 5px 9px;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .btn-import-mp3:hover, .btn-vault-picker:hover {
    background: rgba(229, 168, 83, 0.3);
    border-color: #e5a853;
  }
  .btn-vault-picker.active {
    background: rgba(229, 168, 83, 0.35);
    border-color: #e5a853;
    color: #fff;
  }

  /* Dropdown Coffre */
  .vault-dropdown-list {
    background: rgba(10, 12, 18, 0.98);
    border: 1px solid rgba(229, 168, 83, 0.3);
    border-radius: 6px;
    max-height: 140px;
    overflow-y: auto;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .vault-empty {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    padding: 8px;
    text-align: center;
  }

  .vault-item-btn {
    background: none;
    border: none;
    border-radius: 4px;
    color: #bbb;
    cursor: pointer;
    font-size: 11px;
    padding: 5px 8px;
    text-align: left;
    transition: all 0.1s;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .vault-item-btn:hover { background: rgba(229, 168, 83, 0.15); color: #fff; }
  .vault-item-btn.active { background: rgba(229, 168, 83, 0.25); color: #e5a853; font-weight: 600; }

  /* Timeline */
  .timeline-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .time-label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
    font-variant-numeric: tabular-nums;
    width: 36px;
  }
  .time-label.total { text-align: right; }

  .timeline-slider {
    flex: 1;
    height: 4px;
    accent-color: #e5a853;
    cursor: pointer;
  }

  /* Actions & Contrôles */
  .controls-action-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .playback-buttons {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn-ctrl {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    color: #fff;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 12px;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .btn-ctrl:hover:not(:disabled) { background: rgba(255, 255, 255, 0.18); }
  .btn-ctrl:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-ctrl.play {
    background: rgba(40, 167, 69, 0.25);
    border-color: rgba(40, 167, 69, 0.6);
    color: #75b798;
  }
  .btn-ctrl.play:hover { background: rgba(40, 167, 69, 0.4); color: #fff; }

  .btn-ctrl.pause {
    background: rgba(255, 193, 7, 0.25);
    border-color: rgba(255, 193, 7, 0.6);
    color: #ffda6a;
  }

  .btn-ctrl.fadeout {
    background: rgba(229, 168, 83, 0.2);
    border-color: rgba(229, 168, 83, 0.5);
    color: #e5a853;
  }
  .btn-ctrl.fadeout:hover:not(:disabled) { background: rgba(229, 168, 83, 0.35); }

  .btn-ctrl.stop {
    background: rgba(220, 53, 69, 0.2);
    border-color: rgba(220, 53, 69, 0.4);
    color: #ea868f;
  }
  .btn-ctrl.stop:hover { background: rgba(220, 53, 69, 0.35); }

  .secondary-options {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .cinema-label {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: #e5a853;
    cursor: pointer;
    user-select: none;
    font-weight: 600;
  }

  .volume-box {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .vol-icon { font-size: 12px; }
  .volume-box input[type="range"] {
    width: 60px;
    height: 3px;
    accent-color: #e5a853;
    cursor: pointer;
  }
  .vol-val {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.6);
    width: 24px;
    font-variant-numeric: tabular-nums;
  }

  @keyframes slideDown {
    0%   { opacity: 0; transform: translate(-50%, -15px); }
    100% { opacity: 1; transform: translate(-50%, 0); }
  }

  @keyframes pulseIcon {
    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 2px #e5a853); }
    50%      { transform: scale(1.15); filter: drop-shadow(0 0 8px #e5a853); }
  }

  @keyframes spin {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>
