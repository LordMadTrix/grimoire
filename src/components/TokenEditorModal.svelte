`<script lang="ts">
  import { onMount } from 'svelte';
  import type { TokenDesignData, TokenShape, TokenMetal, TokenStatus, TokenAura, NamePositionPreset, StatusPosition } from '$lib/types/tokenEditor';
  import { getMetalGradients, getBorderSvgPath, getClipPathD, exportTokenToBlob, exportTokenToDataUrl } from '$lib/utils/tokenRenderer';
  import { saveTokenToVault, placeTokenOnActiveMap } from '$lib/services/tokenService';
  import CelestialArtPickerModal from './CelestialArtPickerModal.svelte';

  const { isOpen = false, onclose } = $props<{
    isOpen: boolean;
    onclose: () => void;
  }>();

  // État du Token en cours d'édition
  let design = $state<TokenDesignData>({
    id: 'tok_' + Math.random().toString(36).slice(2, 9),
    name: 'Tavernier Madtrix',
    shape: 'hex',
    metal: 'gold',
    showBorder: true,
    showName: true,
    showHpBar: true,
    showStatusBadge: true,
    imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&auto=format&fit=crop&q=80',
    emojiIcon: '🍺',
    backgroundColor: '#2b2217',
    imagePan: { x: 0, y: 0 },
    imageScale: 1.2,
    namePreset: 'bottom',
    namePosition: { x: 0, y: 0 },
    hpPercent: 100,
    status: 'ally',
    statusPosition: 'top-right',
    aura: 'magic',
    scaleGrid: 1,
  });

  let showCelestialModal = $state(false);
  let isSaving = $state(false);
  let toastMessage = $state<string | null>(null);

  // References DOM pour le drag & drop
  let stageRef = $state<HTMLDivElement | null>(null);
  let namePodRef = $state<HTMLDivElement | null>(null);
  let clipInnerRef = $state<HTMLDivElement | null>(null);

  // Dragging de l'image (Pan)
  let isDraggingArt = false;
  let artStartX = 0, artStartY = 0, initialArtX = 0, initialArtY = 0;

  function onArtMouseDown(e: MouseEvent) {
    e.preventDefault();
    isDraggingArt = true;
    artStartX = e.clientX;
    artStartY = e.clientY;
    initialArtX = design.imagePan.x;
    initialArtY = design.imagePan.y;

    window.addEventListener('mousemove', onArtMouseMove);
    window.addEventListener('mouseup', onArtMouseUp);
  }

  function onArtMouseMove(e: MouseEvent) {
    if (!isDraggingArt) return;
    const dx = e.clientX - artStartX;
    const dy = e.clientY - artStartY;
    design.imagePan = { x: initialArtX + dx, y: initialArtY + dy };
  }

  function onArtMouseUp() {
    isDraggingArt = false;
    window.removeEventListener('mousemove', onArtMouseMove);
    window.removeEventListener('mouseup', onArtMouseUp);
  }

  function onArtWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    design.imageScale = Math.min(Math.max(parseFloat((design.imageScale + delta).toFixed(2)), 0.5), 3.0);
  }

  // Dragging du nom
  let isDraggingName = false;
  let nameStartX = 0, nameStartY = 0, initialNameX = 0, initialNameY = 0;

  function onNameMouseDown(e: MouseEvent) {
    e.preventDefault();
    isDraggingName = true;
    design.namePreset = 'custom';
    nameStartX = e.clientX;
    nameStartY = e.clientY;
    initialNameX = design.namePosition.x;
    initialNameY = design.namePosition.y;

    window.addEventListener('mousemove', onNameMouseMove);
    window.addEventListener('mouseup', onNameMouseUp);
  }

  function onNameMouseMove(e: MouseEvent) {
    if (!isDraggingName) return;
    const dx = e.clientX - nameStartX;
    const dy = e.clientY - nameStartY;
    design.namePosition = { x: initialNameX + dx, y: initialNameY + dy };
  }

  function onNameMouseUp() {
    isDraggingName = false;
    window.removeEventListener('mousemove', onNameMouseMove);
    window.removeEventListener('mouseup', onNameMouseUp);
  }

  function snapName(pos: NamePositionPreset) {
    design.namePreset = pos;
    design.namePosition = { x: 0, y: 0 };
  }

  function showToast(msg: string) {
    toastMessage = msg;
    setTimeout(() => { toastMessage = null; }, 4000);
  }

  async function handleSaveVault() {
    isSaving = true;
    try {
      const blob = await exportTokenToBlob(design);
      const res = await saveTokenToVault(design, blob);
      showToast(res.message);
    } catch (err: any) {
      showToast('❌ ' + (err?.message || err));
    } finally {
      isSaving = false;
    }
  }

  async function handlePlaceVtt() {
    isSaving = true;
    try {
      const dataUrl = await exportTokenToDataUrl(design);
      placeTokenOnActiveMap(design, dataUrl);
      onclose();
    } catch (err: any) {
      showToast('❌ Erreur placement VTT : ' + (err?.message || err));
    } finally {
      isSaving = false;
    }
  }

  // Presets
  function applyPreset(preset: 'tavern' | 'guard' | 'goblin' | 'mage' | 'dragon') {
    if (preset === 'tavern') {
      design.name = 'Tavernier Madtrix';
      design.shape = 'hex';
      design.metal = 'gold';
      design.status = 'ally';
      design.aura = 'magic';
      design.imageUrl = 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&auto=format&fit=crop&q=80';
      design.backgroundColor = '#2b2217';
    } else if (preset === 'guard') {
      design.name = 'Capitaine du Guet';
      design.shape = 'shield';
      design.metal = 'steel';
      design.status = 'ally';
      design.aura = 'holy';
      design.imageUrl = 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80';
      design.backgroundColor = '#1a2a42';
    } else if (preset === 'goblin') {
      design.name = 'Chef Gobelin';
      design.shape = 'hex';
      design.metal = 'copper';
      design.status = 'hostile';
      design.aura = 'none';
      design.imageUrl = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80';
      design.backgroundColor = '#24351a';
    } else if (preset === 'mage') {
      design.name = 'Archimage Stellaire';
      design.shape = 'circle';
      design.metal = 'runic';
      design.status = 'boss';
      design.aura = 'magic';
      design.imageUrl = 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&auto=format&fit=crop&q=80';
      design.backgroundColor = '#2a1642';
    } else if (preset === 'dragon') {
      design.name = 'Dragon Rouge Ancien';
      design.shape = 'circle';
      design.metal = 'dark-spikes';
      design.status = 'boss';
      design.aura = 'fire';
      design.imageUrl = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=80';
      design.backgroundColor = '#381212';
      design.scaleGrid = 2;
    }
    design.imagePan = { x: 0, y: 0 };
    design.imageScale = 1.2;
    snapName('bottom');
  }
</script>

{#if isOpen}
<div class="token-modal-overlay">
  
  <div class="token-modal-window">
    
    <!-- Header -->
    <div class="token-modal-header">
      <div class="header-branding">
        <span class="header-icon">🪙</span>
        <div>
          <h2 class="header-title">
            Éditeur de Tokens Grimoire
            <span class="header-badge">VTT Studio</span>
          </h2>
          <p class="header-sub">Pions haute définition, frises adaptatives et placement instantané en partie</p>
        </div>
      </div>

      <div class="header-actions">
        <button 
          class="btn-save-vault"
          onclick={handleSaveVault}
          disabled={isSaving}
        >
          📁 Enregistrer Coffre MJ (tokens/)
        </button>

        <button 
          class="btn-place-vtt"
          onclick={handlePlaceVtt}
          disabled={isSaving}
        >
          🗺️ Placer sur la Map VTT
        </button>

        <button 
          class="btn-close-modal"
          onclick={onclose}
          title="Fermer"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Corps Layout 3 Colonnes -->
    <div class="token-body-grid">
      
      <!-- 1. Presets Gauche -->
      <div class="presets-col">
        <div class="presets-header">
          <span>Modèles Éditables</span>
          <span class="presets-tag">Prêts au combat</span>
        </div>

        <button 
          class="preset-item {design.name === 'Tavernier Madtrix' ? 'active' : ''}"
          onclick={() => applyPreset('tavern')}
        >
          <div class="preset-avatar" style="background: #2b2217; border-color: #e6b450;">🍺</div>
          <div class="preset-info">
            <div class="preset-name">Tavernier Madtrix</div>
            <div class="preset-desc">Hexagone orné d'or</div>
          </div>
        </button>

        <button 
          class="preset-item {design.name === 'Capitaine du Guet' ? 'active' : ''}"
          onclick={() => applyPreset('guard')}
        >
          <div class="preset-avatar" style="background: #1a2a42; border-color: #60a5fa;">🛡️</div>
          <div class="preset-info">
            <div class="preset-name">Capitaine du Guet</div>
            <div class="preset-desc">Bouclier d'acier & or</div>
          </div>
        </button>

        <button 
          class="preset-item {design.name === 'Chef Gobelin' ? 'active' : ''}"
          onclick={() => applyPreset('goblin')}
        >
          <div class="preset-avatar" style="background: #24351a; border-color: #d97706;">🏹</div>
          <div class="preset-info">
            <div class="preset-name">Chef Gobelin</div>
            <div class="preset-desc">Hexagone cuivre</div>
          </div>
        </button>

        <button 
          class="preset-item {design.name === 'Archimage Stellaire' ? 'active' : ''}"
          onclick={() => applyPreset('mage')}
        >
          <div class="preset-avatar" style="background: #2a1642; border-color: #a855f7;">🔮</div>
          <div class="preset-info">
            <div class="preset-name">Archimage Stellaire</div>
            <div class="preset-desc">Rond runique violet</div>
          </div>
        </button>

        <button 
          class="preset-item {design.name === 'Dragon Rouge Ancien' ? 'active' : ''}"
          onclick={() => applyPreset('dragon')}
        >
          <div class="preset-avatar" style="background: #381212; border-color: #ef4444;">🐉</div>
          <div class="preset-info">
            <div class="preset-name">Dragon Ancien</div>
            <div class="preset-desc">Grand (2x2) • Pointes</div>
          </div>
        </button>
      </div>

      <!-- 2. Centre: Canvas Interactif Live -->
      <div class="stage-col">
        
        <div class="stage-hint">
          <span class="hint-pulse"></span>
          <span>Aperçu PixiJS • <b>Glisse l'image</b> pour cadrer • <b>Molette</b> pour zoomer</span>
        </div>

        <!-- Token Stage -->
        <div 
          bind:this={stageRef}
          class="token-stage-box"
          style:filter={
            design.aura === 'fire' ? 'drop-shadow(0 0 25px rgba(239, 68, 68, 0.8))' :
            design.aura === 'magic' ? 'drop-shadow(0 0 25px rgba(168, 85, 247, 0.8))' :
            design.aura === 'holy' ? 'drop-shadow(0 0 25px rgba(253, 224, 71, 0.8))' :
            'drop-shadow(0 15px 30px rgba(0,0,0,0.85))'
          }
        >
          <!-- Pastille de statut -->
          {#if design.showStatusBadge}
            <div 
              class="token-status-badge"
              style:background-color={
                design.status === 'neutral' ? '#f59e0b' :
                design.status === 'hostile' ? '#ef4444' :
                design.status === 'boss' ? '#8b5cf6' : '#10b981'
              }
              style:top={design.statusPosition.startsWith('top') ? '10px' : 'auto'}
              style:bottom={design.statusPosition.startsWith('bottom') ? '40px' : 'auto'}
              style:left={design.statusPosition.endsWith('left') ? '35px' : 'auto'}
              style:right={design.statusPosition.endsWith('right') ? '35px' : 'auto'}
            >
              {design.status === 'neutral' ? 'PNJ' : design.status === 'hostile' ? 'ENNEMI' : design.status === 'boss' ? 'BOSS ★' : 'AMI'}
            </div>
          {/if}

          <!-- Jauge PV en arc -->
          {#if design.showHpBar}
            <svg class="hp-arc-svg" viewBox="0 0 340 340">
              <path d="M 65 65 A 150 150 0 0 1 275 65" fill="none" stroke="rgba(0,0,0,0.6)" stroke-width="10" stroke-linecap="round" />
              <path 
                d="M 65 65 A 150 150 0 0 1 275 65" 
                fill="none" 
                stroke={design.hpPercent <= 25 ? '#ef4444' : design.hpPercent <= 50 ? '#f59e0b' : '#10b981'} 
                stroke-width="7" 
                stroke-linecap="round"
                stroke-dasharray="230"
                stroke-dashoffset={230 * (1 - design.hpPercent / 100)}
              />
            </svg>
          {/if}

          <!-- Cadre du Pion -->
          <div class="token-frame-box">
            
            <!-- Frise SVG Adaptative -->
            {#if design.showBorder}
              <svg class="border-svg" viewBox="0 0 512 512">
                <defs>
                  {@html getMetalGradients(design.metal)}
                </defs>
                {@html getBorderSvgPath(design.shape)}
              </svg>
            {/if}

            <!-- Zone Intérieure Clippée (Glissable à la souris) -->
            <div 
              bind:this={clipInnerRef}
              class="token-art-clipper"
              style:background-color={design.backgroundColor}
              style:border-radius={design.shape === 'circle' ? '50%' : '0'}
              style:clip-path={
                design.shape === 'hex' ? 'polygon(50% 3%, 97% 26%, 97% 74%, 50% 97%, 3% 74%, 3% 26%)' :
                design.shape === 'shield' ? 'path("M 10 10 Q 107 0 204 10 Q 204 135 107 204 Q 10 135 10 10 Z")' : 'none'
              }
              onmousedown={onArtMouseDown}
              onwheel={onArtWheel}
              role="region"
              aria-label="Zone de déplacement de l'image"
            >
              {#if design.imageUrl}
                <img 
                  src={design.imageUrl} 
                  alt={design.name}
                  referrerpolicy="no-referrer"
                  crossorigin="anonymous"
                  class="token-art-img"
                  style:transform={`translate(${design.imagePan.x}px, ${design.imagePan.y}px) scale(${design.imageScale})`}
                />
              {:else}
                <span class="token-art-emoji">{design.emojiIcon || '🛡️'}</span>
              {/if}
            </div>
          </div>

          <!-- Nom Flottant Déplaçable -->
          {#if design.showName}
            <div 
              bind:this={namePodRef}
              class="name-banner"
              style:left="{design.namePosition.x}px"
              style:top="{design.namePosition.y}px"
              style:transform="translateX(-50%)"
              onmousedown={onNameMouseDown}
              role="button"
              tabindex="0"
              title="Attrape avec la souris pour déplacer où tu veux !"
            >
              <span class="name-move-icon">✥</span>
              <span>{design.name}</span>
            </div>
          {/if}
        </div>

        <!-- Contrôle de Zoom Image -->
        <div class="zoom-bar">
          <span class="zoom-label">🔍 Zoom :</span>
          <input 
            type="range" 
            min="0.5" 
            max="2.5" 
            step="0.05"
            bind:value={design.imageScale}
            class="zoom-slider"
          />
          <span class="zoom-pct">
            {Math.round(design.imageScale * 100)}%
          </span>
          <button 
            class="btn-zoom-reset"
            onclick={() => { design.imagePan = { x: 0, y: 0 }; design.imageScale = 1.2; }}
          >
            ↺ Centrer
          </button>
        </div>

        <!-- Toast Feedback -->
        {#if toastMessage}
          <div class="toast-feedback">
            {toastMessage}
          </div>
        {/if}
      </div>

      <!-- 3. Panneau Droit: Personnalisation & Toggles -->
      <div class="controls-col">
        
        <!-- Nom -->
        <div class="ctrl-group">
          <label class="ctrl-label" for="tok-name">Nom du Pion</label>
          <input 
            id="tok-name"
            type="text" 
            bind:value={design.name}
            class="ctrl-input"
            placeholder="Ex: Tavernier, Garde..."
          />
        </div>

        <!-- Position rapide du nom -->
        <div class="ctrl-group">
          <label class="ctrl-label">Position Rapide du Nom</label>
          <div class="grid-presets-4">
            <button 
              class="btn-sub-preset {design.namePreset === 'bottom' ? 'selected' : ''}"
              onclick={() => snapName('bottom')}
            >
              En bas
            </button>
            <button 
              class="btn-sub-preset {design.namePreset === 'top' ? 'selected' : ''}"
              onclick={() => snapName('top')}
            >
              En haut
            </button>
            <button 
              class="btn-sub-preset {design.namePreset === 'center' ? 'selected' : ''}"
              onclick={() => snapName('center')}
            >
              Au centre
            </button>
            <button 
              class="btn-sub-preset {design.namePreset === 'inside-bottom' ? 'selected' : ''}"
              onclick={() => snapName('inside-bottom')}
            >
              Incrusté
            </button>
          </div>
        </div>

        <!-- Forme & Métal de la Frise -->
        <div class="ctrl-row-2">
          <div class="ctrl-group">
            <label class="ctrl-label">Forme (Frise)</label>
            <div class="shape-buttons">
              <button 
                class="btn-shape {design.shape === 'hex' ? 'selected' : ''}"
                onclick={() => design.shape = 'hex'}
              >
                ⬡ Hex
              </button>
              <button 
                class="btn-shape {design.shape === 'shield' ? 'selected' : ''}"
                onclick={() => design.shape = 'shield'}
              >
                🛡️ Écu
              </button>
              <button 
                class="btn-shape {design.shape === 'circle' ? 'selected' : ''}"
                onclick={() => design.shape = 'circle'}
              >
                ⚪ Rond
              </button>
            </div>
          </div>

          <div class="ctrl-group">
            <label class="ctrl-label" for="tok-metal">Métal / Frise</label>
            <select 
              id="tok-metal"
              bind:value={design.metal}
              class="ctrl-select"
            >
              <option value="gold">👑 Or Ciselé</option>
              <option value="steel">⚔️ Acier Poli</option>
              <option value="runic">🔮 Runes Violettes</option>
              <option value="copper">🏺 Cuivre Ancien</option>
              <option value="dark-spikes">🩸 Obsidienne Sombre</option>
            </select>
          </div>
        </div>

        <!-- Bouton Bibliothèque Céleste -->
        <div class="celestial-box">
          <div class="celestial-row">
            <span class="celestial-title">Illustration / Portrait</span>
            <input 
              type="color" 
              bind:value={design.backgroundColor} 
              class="color-picker-input"
              title="Couleur de fond"
            />
          </div>
          <button 
            class="btn-open-celestial"
            onclick={() => showCelestialModal = true}
          >
            🌌 Choisir dans la Bibliothèque Céleste
          </button>
        </div>

        <!-- Liste des Toggles Demandés -->
        <div class="toggles-section">
          <div class="toggles-header">
            Options & Affichages (On/Off)
          </div>

          <!-- Toggle Nom -->
          <label class="toggle-row">
            <span class="toggle-name">🏷️ Afficher l'étiquette Nom</span>
            <input type="checkbox" bind:checked={design.showName} class="toggle-checkbox" />
          </label>

          <!-- Toggle Frise -->
          <label class="toggle-row">
            <span class="toggle-name">👑 Afficher la Frise Ornée</span>
            <input type="checkbox" bind:checked={design.showBorder} class="toggle-checkbox" />
          </label>

          <!-- Toggle PV -->
          <div class="toggle-group-hp">
            <label class="toggle-row">
              <span class="toggle-name">❤️ Jauge PV en arc de cercle</span>
              <input type="checkbox" bind:checked={design.showHpBar} class="toggle-checkbox" />
            </label>
            {#if design.showHpBar}
              <div class="hp-slider-row">
                <input type="range" min="0" max="100" bind:value={design.hpPercent} class="hp-range-slider" />
                <span class="hp-val-text">{design.hpPercent}%</span>
              </div>
            {/if}
          </div>

          <!-- Toggle Statut -->
          <div class="toggle-group-status">
            <label class="toggle-row">
              <span class="toggle-name">🛡️ Pastille d'Allégeance</span>
              <input type="checkbox" bind:checked={design.showStatusBadge} class="toggle-checkbox" />
            </label>
            {#if design.showStatusBadge}
              <div class="status-buttons-row">
                <button 
                  class="btn-status {design.status === 'ally' ? 'active-ally' : ''}"
                  onclick={() => design.status = 'ally'}
                >
                  Allié
                </button>
                <button 
                  class="btn-status {design.status === 'neutral' ? 'active-neutral' : ''}"
                  onclick={() => design.status = 'neutral'}
                >
                  Neutre
                </button>
                <button 
                  class="btn-status {design.status === 'hostile' ? 'active-hostile' : ''}"
                  onclick={() => design.status = 'hostile'}
                >
                  Ennemi
                </button>
                <button 
                  class="btn-status {design.status === 'boss' ? 'active-boss' : ''}"
                  onclick={() => design.status = 'boss'}
                >
                  Boss ★
                </button>
              </div>
            {/if}
          </div>

          <!-- Toggle Aura -->
          <div class="toggle-aura-row">
            <span class="toggle-name">🔥 Aura Magique</span>
            <select bind:value={design.aura} class="aura-select">
              <option value="none">Aucune</option>
              <option value="holy">✨ Sacrée</option>
              <option value="fire">🔥 Flammes</option>
              <option value="magic">🔮 Arcanes</option>
            </select>
          </div>
        </div>

      </div>

    </div>

  </div>

</div>
{/if}

<!-- Modal Sélecteur Bibliothèque Céleste -->
{#if showCelestialModal}
  <CelestialArtPickerModal 
    onselect={(url, name, isEmoji) => {
      if (isEmoji) {
        design.emojiIcon = name;
        design.imageUrl = '';
      } else {
        design.imageUrl = url;
        if (name && (!design.name || design.name === 'Nouveau Pion')) {
          design.name = name;
        }
      }
      showCelestialModal = false;
    }}
    onclose={() => showCelestialModal = false}
  />
{/if}

<style>
  /* ── Overlay et Fenêtre Principale ───────────────────────────────────────── */
  .token-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(4, 5, 8, 0.88);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    box-sizing: border-box;
    user-select: none;
  }

  .token-modal-window {
    background: #14151c;
    border: 1px solid rgba(230, 180, 80, 0.45);
    border-radius: 16px;
    width: 100%;
    max-width: 1240px;
    height: 92vh;
    max-height: 860px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.9), 0 0 40px rgba(230, 180, 80, 0.15);
    overflow: hidden;
    color: #e2e8f0;
    font-family: inherit;
  }

  /* ── Header ─────────────────────────────────────────────────────────────── */
  .token-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    background: #1a1b24;
    border-bottom: 1px solid #2d2e3f;
    flex-shrink: 0;
  }

  .header-branding {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-icon {
    font-size: 26px;
  }

  .header-title {
    margin: 0;
    font-size: 16px;
    font-weight: 800;
    color: #e6b450;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-badge {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(230, 180, 80, 0.15);
    color: #e6b450;
    border: 1px solid rgba(230, 180, 80, 0.3);
    font-weight: 600;
  }

  .header-sub {
    margin: 2px 0 0 0;
    font-size: 11px;
    color: #94a3b8;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn-save-vault {
    padding: 8px 14px;
    background: linear-gradient(135deg, #2563eb, #4f46e5);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
    transition: all 0.15s ease;
  }
  .btn-save-vault:hover {
    background: linear-gradient(135deg, #3b82f6, #6366f1);
    transform: translateY(-1px);
  }

  .btn-place-vtt {
    padding: 8px 14px;
    background: linear-gradient(135deg, #e6b450, #b8860b);
    color: #000;
    font-size: 11px;
    font-weight: 800;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(230, 180, 80, 0.3);
    transition: all 0.15s ease;
  }
  .btn-place-vtt:hover {
    background: linear-gradient(135deg, #fcd34d, #d97706);
    transform: translateY(-1px);
  }

  .btn-close-modal {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 18px;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 8px;
    transition: all 0.15s;
  }
  .btn-close-modal:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  /* ── Grille 3 Colonnes ───────────────────────────────────────────────────── */
  .token-body-grid {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  /* ── Colonne Gauche (Presets) ────────────────────────────────────────────── */
  .presets-col {
    width: 240px;
    min-width: 240px;
    background: #111218;
    border-right: 1px solid #242533;
    overflow-y: auto;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-sizing: border-box;
  }

  .presets-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
    margin-bottom: 4px;
  }

  .presets-tag {
    color: #e6b450;
  }

  .preset-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }
  .preset-item:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(230, 180, 80, 0.4);
  }
  .preset-item.active {
    background: rgba(230, 180, 80, 0.12);
    border-color: #e6b450;
  }

  .preset-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    border: 1.5px solid #e6b450;
    flex-shrink: 0;
  }

  .preset-info {
    min-width: 0;
  }

  .preset-name {
    font-size: 11px;
    font-weight: 700;
    color: #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .preset-desc {
    font-size: 9px;
    color: #64748b;
  }

  /* ── Colonne Centrale (Stage PixiJS) ─────────────────────────────────────── */
  .stage-col {
    flex: 1;
    background: #0d0e12;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    padding: 20px;
    box-sizing: border-box;
  }

  .stage-hint {
    position: absolute;
    top: 14px;
    left: 20px;
    font-size: 11px;
    color: #94a3b8;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 10;
  }

  .hint-pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 8px #10b981;
  }

  .token-stage-box {
    position: relative;
    width: 340px;
    height: 350px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
  }

  .token-status-badge {
    position: absolute;
    z-index: 25;
    font-size: 10px;
    font-weight: 900;
    text-transform: uppercase;
    padding: 2px 10px;
    border-radius: 9999px;
    border: 1px solid #fff;
    color: #fff;
    box-shadow: 0 4px 12px rgba(0,0,0,0.85);
  }

  .hp-arc-svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 340px;
    height: 340px;
    pointer-events: none;
    z-index: 15;
  }

  .token-frame-box {
    position: relative;
    width: 260px;
    height: 260px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .border-svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 260px;
    height: 260px;
    pointer-events: none;
    z-index: 20;
  }

  .token-art-clipper {
    position: absolute;
    top: 24px;
    left: 24px;
    right: 24px;
    bottom: 24px;
    overflow: hidden;
    cursor: grab;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .token-art-clipper:active {
    cursor: grabbing;
  }

  .token-art-img {
    position: absolute;
    pointer-events: none;
    max-width: none;
    user-select: none;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .token-art-emoji {
    font-size: 64px;
  }

  .name-banner {
    position: absolute;
    z-index: 30;
    cursor: move;
    user-select: none;
    white-space: nowrap;
    font-weight: 800;
    font-size: 11px;
    color: #fff;
    background: rgba(18, 19, 26, 0.95);
    border: 1.5px solid #e6b450;
    box-shadow: 0 4px 15px rgba(0,0,0,0.8), 0 0 10px rgba(230, 180, 80, 0.4);
    border-radius: 9999px;
    padding: 3px 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .name-move-icon {
    opacity: 0.5;
    font-size: 9px;
  }

  .zoom-bar {
    margin-top: 16px;
    padding: 6px 14px;
    border-radius: 9999px;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    gap: 10px;
    z-index: 10;
  }

  .zoom-label {
    font-size: 11px;
    color: #94a3b8;
  }

  .zoom-slider {
    width: 120px;
    accent-color: #e6b450;
    cursor: pointer;
  }

  .zoom-pct {
    font-size: 11px;
    font-weight: 700;
    color: #e6b450;
    min-width: 34px;
  }

  .btn-zoom-reset {
    padding: 2px 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    font-size: 10px;
    border: none;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-zoom-reset:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  .toast-feedback {
    position: absolute;
    bottom: 14px;
    background: rgba(6, 78, 59, 0.95);
    border: 1px solid #10b981;
    color: #a7f3d0;
    padding: 6px 16px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 700;
    box-shadow: 0 10px 25px rgba(0,0,0,0.8);
    animation: bounce 1s infinite;
  }

  /* ── Colonne Droite (Contrôles & Toggles) ─────────────────────────────────── */
  .controls-col {
    width: 350px;
    min-width: 350px;
    background: #14151e;
    border-left: 1px solid #242533;
    overflow-y: auto;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-sizing: border-box;
  }

  .ctrl-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .ctrl-label {
    font-size: 11px;
    font-weight: 700;
    color: #94a3b8;
  }

  .ctrl-input {
    width: 100%;
    background: #1b1c26;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 8px 10px;
    color: #fff;
    font-weight: 600;
    font-size: 12px;
    box-sizing: border-box;
    outline: none;
  }
  .ctrl-input:focus {
    border-color: #e6b450;
  }

  .grid-presets-4 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .btn-sub-preset {
    padding: 6px 2px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: transparent;
    color: #cbd5e1;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-sub-preset.selected {
    background: #e6b450;
    color: #000;
    border-color: #e6b450;
  }

  .ctrl-row-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .shape-buttons {
    display: flex;
    gap: 4px;
  }

  .btn-shape {
    flex: 1;
    padding: 6px 2px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: transparent;
    color: #cbd5e1;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }
  .btn-shape.selected {
    background: #e6b450;
    color: #000;
    border-color: #e6b450;
  }

  .ctrl-select {
    width: 100%;
    background: #1b1c26;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 6px 8px;
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    outline: none;
    box-sizing: border-box;
  }

  .celestial-box {
    padding: 10px;
    background: rgba(88, 28, 135, 0.15);
    border: 1px solid rgba(168, 85, 247, 0.3);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .celestial-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .celestial-title {
    font-weight: 700;
    color: #c084fc;
    font-size: 11px;
  }

  .color-picker-input {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    background: transparent;
  }

  .btn-open-celestial {
    width: 100%;
    padding: 8px;
    background: linear-gradient(135deg, #7e22ce, #4338ca);
    color: #fff;
    font-weight: 700;
    font-size: 11px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(126, 34, 206, 0.3);
    transition: all 0.15s;
  }
  .btn-open-celestial:hover {
    background: linear-gradient(135deg, #9333ea, #4f46e5);
  }

  /* ── Toggles ─────────────────────────────────────────────────────────────── */
  .toggles-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .toggles-header {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    color: #64748b;
    letter-spacing: 0.05em;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.04);
    cursor: pointer;
  }

  .toggle-name {
    font-size: 11px;
    font-weight: 600;
    color: #cbd5e1;
  }

  .toggle-checkbox {
    accent-color: #e6b450;
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .toggle-group-hp, .toggle-group-status {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .hp-slider-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
  }

  .hp-range-slider {
    flex: 1;
    accent-color: #ef4444;
    cursor: pointer;
  }

  .hp-val-text {
    font-size: 10px;
    font-weight: 700;
    color: #ef4444;
    min-width: 30px;
  }

  .status-buttons-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    margin-top: 2px;
  }

  .btn-status {
    padding: 4px 2px;
    border-radius: 4px;
    border: none;
    font-size: 10px;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.05);
    color: #94a3b8;
    cursor: pointer;
  }
  .btn-status.active-ally { background: #059669; color: #fff; }
  .btn-status.active-neutral { background: #d97706; color: #fff; }
  .btn-status.active-hostile { background: #dc2626; color: #fff; }
  .btn-status.active-boss { background: #7c3aed; color: #fff; }

  .toggle-aura-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  .aura-select {
    background: #1b1c26;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 4px 6px;
    outline: none;
  }
</style>
