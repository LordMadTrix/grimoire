<script lang="ts">
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
<div class="fixed inset-0 bg-black/85 backdrop-blur-md z-[9990] flex items-center justify-center p-3 sm:p-5 select-none animate-fadeIn">
  
  <div class="bg-[#14151c] border border-[#e6b450]/40 rounded-2xl w-full max-w-[1240px] max-h-[94vh] flex flex-col shadow-2xl shadow-amber-950/30 overflow-hidden text-gray-200">
    
    <!-- Header -->
    <div class="px-5 py-3.5 bg-[#1a1b24] border-b border-[#2d2e3f] flex items-center justify-between shrink-0">
      <div class="flex items-center gap-3">
        <span class="text-2xl text-[#e6b450]">🪙</span>
        <div>
          <h2 class="text-lg font-bold text-[#e6b450] flex items-center gap-2">
            Éditeur de Tokens Grimoire
            <span class="text-xs px-2 py-0.5 rounded bg-[#e6b450]/15 text-[#e6b450] border border-[#e6b450]/30 font-medium">
              VTT Studio
            </span>
          </h2>
          <p class="text-xs text-gray-400">Pions haute définition, frises adaptatives et placement instantané en partie</p>
        </div>
      </div>

      <div class="flex items-center gap-2.5">
        <button 
          class="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-900/30 transition-all flex items-center gap-1.5"
          onclick={handleSaveVault}
          disabled={isSaving}
        >
          📁 Enregistrer Coffre MJ (tokens/)
        </button>

        <button 
          class="px-4 py-2 bg-gradient-to-r from-[#e6b450] to-[#b8860b] hover:from-[#fcd34d] hover:to-[#d97706] text-black font-bold text-xs rounded-xl shadow-lg shadow-amber-500/25 transition-all flex items-center gap-1.5"
          onclick={handlePlaceVtt}
          disabled={isSaving}
        >
          🗺️ Placer sur la Map VTT
        </button>

        <button 
          class="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl text-sm transition-all"
          onclick={onclose}
          title="Fermer"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Corps Layout 3 Colonnes -->
    <div class="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[250px_1fr_360px] divide-x divide-[#242533]">
      
      <!-- 1. Presets Gauche -->
      <div class="p-4 overflow-y-auto bg-[#111218] flex flex-col gap-2">
        <div class="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1 flex justify-between">
          <span>Modèles Éditables</span>
          <span class="text-[#e6b450]">Prêts au combat</span>
        </div>

        <button 
          class="p-2 rounded-xl border flex items-center gap-2.5 text-left transition-all {design.name === 'Tavernier Madtrix' ? 'bg-white/10 border-[#e6b450]' : 'border-white/5 hover:border-[#e6b450]/50 hover:bg-white/5'}"
          onclick={() => applyPreset('tavern')}
        >
          <div class="w-9 h-9 rounded-full bg-[#2b2217] border border-[#e6b450] flex items-center justify-center text-lg shrink-0">🍺</div>
          <div class="min-w-0">
            <div class="text-xs font-semibold text-gray-200 truncate">Tavernier Madtrix</div>
            <div class="text-[10px] text-gray-500">Hexagone orné d'or</div>
          </div>
        </button>

        <button 
          class="p-2 rounded-xl border flex items-center gap-2.5 text-left transition-all {design.name === 'Capitaine du Guet' ? 'bg-white/10 border-[#e6b450]' : 'border-white/5 hover:border-[#e6b450]/50 hover:bg-white/5'}"
          onclick={() => applyPreset('guard')}
        >
          <div class="w-9 h-9 rounded-full bg-[#1a2a42] border border-blue-400 flex items-center justify-center text-lg shrink-0">🛡️</div>
          <div class="min-w-0">
            <div class="text-xs font-semibold text-gray-200 truncate">Capitaine du Guet</div>
            <div class="text-[10px] text-gray-500">Bouclier d'acier & or</div>
          </div>
        </button>

        <button 
          class="p-2 rounded-xl border flex items-center gap-2.5 text-left transition-all {design.name === 'Chef Gobelin' ? 'bg-white/10 border-[#e6b450]' : 'border-white/5 hover:border-[#e6b450]/50 hover:bg-white/5'}"
          onclick={() => applyPreset('goblin')}
        >
          <div class="w-9 h-9 rounded-full bg-[#24351a] border border-amber-600 flex items-center justify-center text-lg shrink-0">🏹</div>
          <div class="min-w-0">
            <div class="text-xs font-semibold text-gray-200 truncate">Chef Gobelin</div>
            <div class="text-[10px] text-gray-500">Hexagone cuivre</div>
          </div>
        </button>

        <button 
          class="p-2 rounded-xl border flex items-center gap-2.5 text-left transition-all {design.name === 'Archimage Stellaire' ? 'bg-white/10 border-[#e6b450]' : 'border-white/5 hover:border-[#e6b450]/50 hover:bg-white/5'}"
          onclick={() => applyPreset('mage')}
        >
          <div class="w-9 h-9 rounded-full bg-[#2a1642] border border-purple-500 flex items-center justify-center text-lg shrink-0">🔮</div>
          <div class="min-w-0">
            <div class="text-xs font-semibold text-gray-200 truncate">Archimage Stellaire</div>
            <div class="text-[10px] text-gray-500">Rond runique violet</div>
          </div>
        </button>

        <button 
          class="p-2 rounded-xl border flex items-center gap-2.5 text-left transition-all {design.name === 'Dragon Rouge Ancien' ? 'bg-white/10 border-[#e6b450]' : 'border-white/5 hover:border-[#e6b450]/50 hover:bg-white/5'}"
          onclick={() => applyPreset('dragon')}
        >
          <div class="w-9 h-9 rounded-full bg-[#381212] border border-red-500 flex items-center justify-center text-lg shrink-0">🐉</div>
          <div class="min-w-0">
            <div class="text-xs font-semibold text-gray-200 truncate">Dragon Ancien</div>
            <div class="text-[10px] text-gray-500">Grand (2x2) • Pointes</div>
          </div>
        </button>
      </div>

      <!-- 2. Centre: Canvas Interactif Live -->
      <div class="p-6 bg-[#0d0e12] flex flex-col items-center justify-center relative overflow-hidden">
        
        <div class="absolute top-3 left-4 text-xs text-gray-400 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Aperçu PixiJS • <b>Glisse l'image</b> pour cadrer • <b>Molette</b> pour zoomer</span>
        </div>

        <!-- Token Stage -->
        <div 
          bind:this={stageRef}
          class="relative w-[340px] h-[350px] flex items-center justify-center transition-all duration-300"
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
              class="absolute z-25 text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border border-white shadow-lg shadow-black/80 text-white"
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
            <svg class="absolute inset-0 w-full h-full pointer-events-none z-15" viewBox="0 0 340 340">
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
          <div class="relative w-[260px] h-[260px] flex items-center justify-center">
            
            <!-- Frise SVG Adaptative -->
            {#if design.showBorder}
              <svg class="absolute inset-0 w-full h-full pointer-events-none z-20" viewBox="0 0 512 512">
                <defs>
                  {@html getMetalGradients(design.metal)}
                </defs>
                {@html getBorderSvgPath(design.shape)}
              </svg>
            {/if}

            <!-- Zone Intérieure Clippée (Glissable à la souris) -->
            <div 
              bind:this={clipInnerRef}
              class="absolute inset-[24px] overflow-hidden cursor-move flex items-center justify-center"
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
                  class="absolute pointer-events-none max-w-none select-none transition-transform"
                  style:transform={`translate(${design.imagePan.x}px, ${design.imagePan.y}px) scale(${design.imageScale})`}
                  style:width="100%"
                  style:height="100%"
                  style:object-fit="cover"
                />
              {:else}
                <span class="text-6xl">{design.emojiIcon || '🛡️'}</span>
              {/if}
            </div>
          </div>

          <!-- Cartouche de Nom Déplaçable -->
          {#if design.showName && design.name.trim()}
            <div 
              bind:this={namePodRef}
              class="absolute z-30 cursor-grab active:cursor-grabbing px-4 py-1.5 rounded-full border-2 border-[#e6b450] bg-gradient-to-b from-[#221c14] to-[#100e0a] text-[#ffe699] font-extrabold uppercase tracking-wider text-xs shadow-xl shadow-black/90 flex items-center gap-1.5 whitespace-nowrap hover:border-[#ffd700] hover:scale-105 transition-transform"
              style:left={design.namePreset === 'custom' ? `calc(50% + ${design.namePosition.x}px)` : '50%'}
              style:top={
                design.namePreset === 'top' ? '5px' :
                design.namePreset === 'center' ? '155px' :
                design.namePreset === 'inside-bottom' ? '230px' :
                design.namePreset === 'custom' ? `calc(88% + ${design.namePosition.y}px)` : 'auto'
              }
              style:bottom={design.namePreset === 'bottom' ? '5px' : 'auto'}
              style:transform="translateX(-50%)"
              onmousedown={onNameMouseDown}
              role="button"
              tabindex="0"
              title="Attrape avec la souris pour déplacer où tu veux !"
            >
              <span class="opacity-50 text-[10px]">✥</span>
              <span>{design.name}</span>
            </div>
          {/if}
        </div>

        <!-- Contrôle de Zoom Image -->
        <div class="mt-4 px-4 py-2 rounded-full bg-black/50 border border-white/10 flex items-center gap-3">
          <span class="text-xs text-gray-300">🔍 Zoom :</span>
          <input 
            type="range" 
            min="0.5" 
            max="2.5" 
            step="0.05"
            bind:value={design.imageScale}
            class="w-32 accent-[#e6b450] cursor-pointer"
          />
          <span class="text-xs font-bold text-[#e6b450] min-w-[36px]">
            {Math.round(design.imageScale * 100)}%
          </span>
          <button 
            class="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[11px] text-gray-300 transition-all"
            onclick={() => { design.imagePan = { x: 0, y: 0 }; design.imageScale = 1.2; }}
          >
            ↺ Centrer
          </button>
        </div>

        <!-- Toast Feedback -->
        {#if toastMessage}
          <div class="absolute bottom-3 bg-emerald-950/90 border border-emerald-500 text-emerald-200 px-4 py-2 rounded-xl text-xs font-semibold shadow-xl shadow-black/80 animate-bounce">
            {toastMessage}
          </div>
        {/if}
      </div>

      <!-- 3. Panneau Droit: Personnalisation & Toggles -->
      <div class="p-5 overflow-y-auto bg-[#14151e] flex flex-col gap-4 text-xs">
        
        <!-- Nom -->
        <div class="flex flex-col gap-1.5">
          <label class="font-bold text-gray-300" for="tok-name">Nom du Pion</label>
          <input 
            id="tok-name"
            type="text" 
            bind:value={design.name}
            class="w-full bg-[#1b1c26] border border-white/10 rounded-lg px-3 py-2 text-white font-semibold focus:outline-none focus:border-[#e6b450]"
            placeholder="Ex: Tavernier, Garde..."
          />
        </div>

        <!-- Position rapide du nom -->
        <div class="flex flex-col gap-1.5">
          <label class="font-bold text-gray-400">Position du Nom</label>
          <div class="grid grid-cols-4 gap-1">
            <button 
              class="py-1 rounded border text-[11px] font-semibold transition-all {design.namePreset === 'bottom' ? 'bg-[#e6b450] text-black border-[#e6b450]' : 'border-white/10 text-gray-300'}"
              onclick={() => snapName('bottom')}
            >
              En bas
            </button>
            <button 
              class="py-1 rounded border text-[11px] font-semibold transition-all {design.namePreset === 'top' ? 'bg-[#e6b450] text-black border-[#e6b450]' : 'border-white/10 text-gray-300'}"
              onclick={() => snapName('top')}
            >
              En haut
            </button>
            <button 
              class="py-1 rounded border text-[11px] font-semibold transition-all {design.namePreset === 'center' ? 'bg-[#e6b450] text-black border-[#e6b450]' : 'border-white/10 text-gray-300'}"
              onclick={() => snapName('center')}
            >
              Au centre
            </button>
            <button 
              class="py-1 rounded border text-[11px] font-semibold transition-all {design.namePreset === 'inside-bottom' ? 'bg-[#e6b450] text-black border-[#e6b450]' : 'border-white/10 text-gray-300'}"
              onclick={() => snapName('inside-bottom')}
            >
              Incrusté
            </button>
          </div>
        </div>

        <!-- Forme & Métal de la Frise -->
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="font-bold text-gray-300">Forme (Frise)</label>
            <div class="flex gap-1">
              <button 
                class="flex-1 py-1.5 rounded border text-center font-bold {design.shape === 'hex' ? 'bg-[#e6b450] text-black border-[#e6b450]' : 'border-white/10 text-gray-300'}"
                onclick={() => design.shape = 'hex'}
              >
                ⬡ Hex
              </button>
              <button 
                class="flex-1 py-1.5 rounded border text-center font-bold {design.shape === 'shield' ? 'bg-[#e6b450] text-black border-[#e6b450]' : 'border-white/10 text-gray-300'}"
                onclick={() => design.shape = 'shield'}
              >
                🛡️ Écu
              </button>
              <button 
                class="flex-1 py-1.5 rounded border text-center font-bold {design.shape === 'circle' ? 'bg-[#e6b450] text-black border-[#e6b450]' : 'border-white/10 text-gray-300'}"
                onclick={() => design.shape = 'circle'}
              >
                ⚪ Rond
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="font-bold text-gray-300">Métal / Frise</label>
            <select 
              bind:value={design.metal}
              class="w-full bg-[#1b1c26] border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-semibold focus:outline-none"
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
        <div class="p-3 bg-purple-950/20 border border-purple-500/30 rounded-xl flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="font-bold text-purple-300">Illustration / Portrait</span>
            <input 
              type="color" 
              bind:value={design.backgroundColor} 
              class="w-6 h-6 rounded border-0 cursor-pointer bg-transparent"
              title="Couleur de fond"
            />
          </div>
          <button 
            class="w-full py-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
            onclick={() => showCelestialModal = true}
          >
            🌌 Choisir dans la Bibliothèque Céleste
          </button>
        </div>

        <!-- Liste des Toggles Demandés -->
        <div class="flex flex-col gap-2 pt-1 border-t border-white/10">
          <div class="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Options & Affichages (On/Off)
          </div>

          <!-- Toggle Nom -->
          <label class="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10">
            <span class="font-semibold text-gray-300">🏷️ Afficher le Nom</span>
            <input type="checkbox" bind:checked={design.showName} class="w-4 h-4 accent-[#e6b450]" />
          </label>

          <!-- Toggle Frise -->
          <label class="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10">
            <span class="font-semibold text-gray-300">✨ Frise Ornée</span>
            <input type="checkbox" bind:checked={design.showBorder} class="w-4 h-4 accent-[#e6b450]" />
          </label>

          <!-- Toggle Jauge PV -->
          <div class="flex flex-col gap-1 p-2 rounded-lg bg-white/5 border border-white/5">
            <label class="flex items-center justify-between cursor-pointer">
              <span class="font-semibold text-gray-300">💚 Jauge de PV ({design.hpPercent}%)</span>
              <input type="checkbox" bind:checked={design.showHpBar} class="w-4 h-4 accent-[#e6b450]" />
            </label>
            {#if design.showHpBar}
              <input 
                type="range" min="0" max="100" 
                bind:value={design.hpPercent} 
                class="w-full mt-1 accent-emerald-500 cursor-pointer"
              />
            {/if}
          </div>

          <!-- Toggle Pastille Statut -->
          <div class="flex flex-col gap-1.5 p-2 rounded-lg bg-white/5 border border-white/5">
            <label class="flex items-center justify-between cursor-pointer">
              <span class="font-semibold text-gray-300">🛡️ Pastille Alignement</span>
              <input type="checkbox" bind:checked={design.showStatusBadge} class="w-4 h-4 accent-[#e6b450]" />
            </label>
            {#if design.showStatusBadge}
              <div class="grid grid-cols-4 gap-1 mt-1">
                <button 
                  class="py-1 rounded text-[10px] font-bold {design.status === 'ally' ? 'bg-emerald-600 text-white' : 'bg-white/5 text-gray-400'}"
                  onclick={() => design.status = 'ally'}
                >
                  Allié
                </button>
                <button 
                  class="py-1 rounded text-[10px] font-bold {design.status === 'neutral' ? 'bg-amber-600 text-white' : 'bg-white/5 text-gray-400'}"
                  onclick={() => design.status = 'neutral'}
                >
                  Neutre
                </button>
                <button 
                  class="py-1 rounded text-[10px] font-bold {design.status === 'hostile' ? 'bg-red-600 text-white' : 'bg-white/5 text-gray-400'}"
                  onclick={() => design.status = 'hostile'}
                >
                  Ennemi
                </button>
                <button 
                  class="py-1 rounded text-[10px] font-bold {design.status === 'boss' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400'}"
                  onclick={() => design.status = 'boss'}
                >
                  Boss ★
                </button>
              </div>
            {/if}
          </div>

          <!-- Toggle Aura -->
          <div class="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
            <span class="font-semibold text-gray-300">🔥 Aura Magique</span>
            <select bind:value={design.aura} class="bg-[#1b1c26] text-white font-semibold rounded px-2 py-1 text-xs focus:outline-none">
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
