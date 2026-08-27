<script lang="ts">
  import SharedLibrary from './SharedLibrary.svelte';
  import { emitToPlayerView, readFileBase64, readFile, openMapEditor, openMapEditorWithMap } from '$lib/api';
  import { getVaultPath, getVaultTree } from '$lib/stores/vault.svelte';
  import {
    vttStore,
    addGmToken, clearGmFow, undoGmFow,
    startCombat, stopCombat,
    updateGmAudio, setGmAudioVolume,
    updateGmAudio2, setGmAudio2Volume,
    clearGmPins,
    setWeather, addSpell, clearSpells,
    startCountdown, stopCountdown,
    undoDrawPath, clearDrawPaths,
    undoGmWall, clearGmWalls,
    addGmAudioZone, removeGmAudioZone,
    undoMapAction, canUndo,
    addMapScene, replaceActiveScene, setCampaignTitle,
    setSpotlightToken, sendAmbientText,
    revealAllGmFow, toggleFow,
    clearTerrainZones,
    setAmbientLight, triggerLightningFlash,
  } from '$lib/stores/vtt.svelte';
  import type { VaultEntry } from '$lib/api';
  import SoundBoard from './SoundBoard.svelte';
  import MonsterLibrary from './MonsterLibrary.svelte';
  import SessionExport from './SessionExport.svelte';
  import GMScreen from './GMScreen.svelte';
  import CriticalWounds from './CriticalWounds.svelte';
  import ChaosMutations from './ChaosMutations.svelte';
  import MerchantGenerator from './MerchantGenerator.svelte';
  import RumorManager from './RumorManager.svelte';
  import { timeStore, advanceTime, formatImperialDate } from '$lib/stores/timeStore';
  import PlayerMobileManager from './PlayerMobileManager.svelte';
  import AdventureLibrary from './AdventureLibrary.svelte';
  import CharacterCreator from './CharacterCreator.svelte';
  import DiceRoller from './DiceRoller.svelte';
  import PlayerManager from './PlayerManager.svelte';
  import QuickNpcModal from './QuickNpcModal.svelte';
  import QuickLootModal from './QuickLootModal.svelte';
  import HandoutModal from './HandoutModal.svelte';
  import NpcRelationMap from './NpcRelationMap.svelte';
  import CombatLog from './CombatLog.svelte';
  import DamageCalculator from './DamageCalculator.svelte';
  import EncounterGenerator from './EncounterGenerator.svelte';
  import RoomGenerator from './RoomGenerator.svelte';
  import WeatherPlanner from './WeatherPlanner.svelte';
  import DurationTracker from './DurationTracker.svelte';
  import SharedNotesModal from './SharedNotesModal.svelte';
  import NarrativeAssistant from './NarrativeAssistant.svelte';
  import DungeonGenerator from './DungeonGenerator.svelte';
  import QuestJournal from './QuestJournal.svelte';
  import SoundscapeMixer from './SoundscapeMixer.svelte';
  import { soundscape } from '$lib/stores/soundscape.svelte';
  import { ttsReader } from '$lib/stores/ttsReader.svelte';
  import AddonStore from './AddonStore.svelte';

  let { 
    onRoll,
    onTogglePlayerHub,
    onTogglePlayerManager,
    onTogglePlayerMobileManager
  }: { 
    onRoll?: ((result: number, label: string) => void) | null,
    onTogglePlayerHub?: (() => void) | null,
    onTogglePlayerManager?: (() => void) | null,
    onTogglePlayerMobileManager?: (() => void) | null
  } = $props();

  function handleDiceRoll(result: number, label: string) {
    const text = `🎲 ${label} = ${result}`;
    emitToPlayerView('map_roll', { text });
    onRoll?.(result, label);
  }

  let showMapPicker = $state(false);
  let showAudioPicker = $state(false);
  let showAudio2Picker = $state(false);
  let showSoundscapeMixer = $state(false);
  let showHandoutPicker = $state(false);
  let showTokenPicker = $state(false);
  let showSharedLibrary = $state(false);
  let showAddonStore = $state(false);
  let showNarrativeAssistant = $state(false);
  let showDungeonGenerator = $state(false);
  let showQuestJournal = $state(false);
  let mapPickerSearch = $state('');
  let tokenPickerSearch = $state('');
  let ambientTextInput = $state('');
  let activeMenu: string | null = $state(null);
  let charCreator: any = $state();
  let soundBoard: any = $state();
  let monsterLib: any = $state();
  let advLib: any = $state();
  let sessionExport: any = $state();
  let gmScreen: any = $state();
  let critWounds: any = $state();
  let chaosMuts: any = $state();
  let merchantGen: any = $state();
  let rumorMan: any = $state();

  // Countdown
  let showCountdownPicker = $state(false);
  let countdownSecs = $state(30);

  function handleCountdown() {
    if (vttStore.countdownEnd !== null) { stopCountdown(); }
    else { startCountdown(countdownSecs); showCountdownPicker = false; }
  }

  // Narration météo & Voix IA
  let isNarratorVoiceEnabled = $state(true);

  const WEATHER_NARR: Record<string, string[]> = {
    none: ["Le ciel est dégagé, le temps clément.", "Un soleil discret éclaire la scène."],
    rain: ["Une pluie froide cingle vos visages.", "Les pavés luisent sous une averse persistante.", "La pluie tambourine sur vos armures."],
    snow: ["Des flocons silencieux enveloppent le paysage d'un linceul blanc.", "Le froid mord. La neige crisse sous vos bottes.", "Un rideau de neige efface les repères familiers."],
    fog: ["Un brouillard épais avale les contours du monde.", "La brume se lève, transformant chaque ombre en menace.", "Dans ce fog dense, même les sons semblent étouffés."],
    embers: ["Des braises volent dans l'air chaud, portées par un vent de cendres.", "Une chaleur oppressante fait danser l'air au-dessus des ruines."],
    storm: ["La tempête rugit. Le tonnerre fait trembler les fondations.", "Des éclairs déchirent le ciel. Il faut trouver un abri."],
  };

  function sendWeatherNarrative() {
    const w = vttStore.weather ?? 'none';
    const list = WEATHER_NARR[w] ?? WEATHER_NARR.none;
    const text = list[Math.floor(Math.random() * list.length)];
    sendAmbientText(text);
    if (isNarratorVoiceEnabled) {
      ttsReader.speakText(text);
    }
  }

  function handleCustomAmbient(text: string) {
    sendAmbientText(text);
    if (isNarratorVoiceEnabled) {
      ttsReader.speakText(text);
    }
  }

  // Modals & Panels
  let showNpcModal = $state(false);
  let showLootModal = $state(false);
  let showHandoutModal = $state(false);
  let showRelationMap = $state(false);
  let showCombatLogPanel = $state(false);
  let showDamageCalc = $state(false);
  let showEncounterGen = $state(false);
  let showRoomGen = $state(false);
  let showWeatherPlanner = $state(false);
  let showDurationTracker = $state(false);
  let showSharedNotes = $state(false);
  let showToolsOverflow = $state(false);
  let toolbarEl: HTMLElement | undefined;
  let toolbarH = $state(56);

  $effect(() => {
    if (!toolbarEl) return;
    const ro = new ResizeObserver(() => { toolbarH = toolbarEl!.offsetHeight; });
    ro.observe(toolbarEl);
    return () => ro.disconnect();
  });

  function getAllMd(entries: VaultEntry[], parent = ''): { path: string; name: string }[] {
    let files: { path: string; name: string }[] = [];
    for (const e of entries) {
      if (e.is_dir && e.children) files = [...files, ...getAllMd(e.children, parent + e.name + '/')];
      else if (e.extension === 'md') files.push({ path: parent + e.name, name: e.name.replace(/\.md$/, '') });
    }
    return files;
  }

  async function sendImageHandout(relativePath: string) {
    const vaultPath = getVaultPath();
    if (!vaultPath) return;
    try {
      const base64 = await readFileBase64(`${vaultPath}/${relativePath}`);
      const ext = relativePath.split('.').pop()?.toLowerCase() ?? 'png';
      const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
      await emitToPlayerView('show_handout', { type: 'image', content: `data:${mime};base64,${base64}`, title: relativePath.split('/').pop() });
      showHandoutPicker = false;
    } catch (err) { console.error('Handout error:', err); }
  }

  async function sendNoteHandout(relativePath: string) {
    const vaultPath = getVaultPath();
    if (!vaultPath) return;
    try {
      const content = await readFile(vaultPath, relativePath);
      const cleaned = content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
      await emitToPlayerView('show_handout', { type: 'note', content: cleaned, title: relativePath.split('/').pop()?.replace(/\.md$/, '') });
      showHandoutPicker = false;
    } catch (err) { console.error('Handout error:', err); }
  }

  // Timer de session (état partagé via vttStore.sessionTimerStart)
  let sessionDisplay = $state('00:00');
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  $effect(() => {
    const start = vttStore.sessionTimerStart;
    if (start !== null) {
      if (!timerInterval) {
        timerInterval = setInterval(() => {
          const elapsed = Math.floor((Date.now() - vttStore.sessionTimerStart!) / 1000);
          const h = Math.floor(elapsed / 3600);
          const m = Math.floor((elapsed % 3600) / 60);
          const s = elapsed % 60;
          sessionDisplay = h > 0
            ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
            : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        }, 1000);
      }
    } else {
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
      sessionDisplay = '00:00';
    }
  });

  function toggleTimer() {
    if (vttStore.sessionTimerStart !== null) {
      vttStore.sessionTimerStart = null;
    } else {
      vttStore.sessionTimerStart = Date.now();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      if (vttStore.currentMap) { e.preventDefault(); undoMapAction(); }
    }
  }

  function toggleGrid() {
    vttStore.showGrid = !vttStore.showGrid;
    emitToPlayerView('toggle_player_grid', { show: vttStore.showGrid });
  }

  function toggleBlackout() {
    vttStore.isBlackout = !vttStore.isBlackout;
    emitToPlayerView('toggle_player_blackout', { active: vttStore.isBlackout });
  }

  function setGridSize(val: number) {
    vttStore.gridSize = Math.max(10, Math.min(200, val));
    emitToPlayerView('toggle_player_grid', { show: vttStore.showGrid, size: vttStore.gridSize });
  }

  function getAllAudio(entries: VaultEntry[], parent = ''): { path: string; name: string }[] {
    let audios: { path: string; name: string }[] = [];
    for (const e of entries) {
      if (e.is_dir && e.children) {
        audios = [...audios, ...getAllAudio(e.children, parent + e.name + '/')];
      } else {
        const ext = e.extension?.toLowerCase();
        if (ext === 'mp3' || ext === 'wav' || ext === 'ogg' || ext === 'm4a') {
          audios.push({ path: parent + e.name, name: e.name });
        }
      }
    }
    return audios;
  }

  function getAllImages(entries: VaultEntry[], parent = '', dirFilter = ''): { path: string; name: string }[] {
    let images: { path: string; name: string }[] = [];
    for (const e of entries) {
      if (e.is_dir && e.children) {
        images = [...images, ...getAllImages(e.children, parent + e.name + '/', dirFilter)];
      } else {
        const ext = e.extension?.toLowerCase();
        if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') {
          const fullPath = parent + e.name;
          if (!dirFilter || fullPath.split('/').some(s => s.toLowerCase() === dirFilter.toLowerCase())) {
            images.push({ path: fullPath, name: e.name });
          }
        }
      }
    }
    return images;
  }

  async function createImageToken(relativePath: string) {
    const vaultPath = getVaultPath();
    if (!vaultPath) return;
    tokenCount++;
    try {
      const base64 = await readFileBase64(`${vaultPath}/${relativePath}`);
      const ext = relativePath.split('.').pop()?.toLowerCase();
      let mime = 'image/png';
      if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
      else if (ext === 'webp') mime = 'image/webp';
      const dataUrl = `data:${mime};base64,${base64}`;
      const name = relativePath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? `Token ${tokenCount}`;
      addGmToken({
        id: Math.random().toString(36).slice(2),
        name,
        x: 125 + (tokenCount % 8) * 65,
        y: 125 + Math.floor(tokenCount / 8) * 65,
        size: 50,
        imageUrl: dataUrl,
        hp: 10,
        maxHp: 10,
        visionRange: 0,
        isEnemy: false,
      });
      showTokenPicker = false;
      tokenPickerSearch = '';
    } catch (err) { console.error('Token image error:', err); }
  }

  function selectAudio(relativePath: string) {
    updateGmAudio(relativePath);
    showAudioPicker = false;
  }

  function stopAudio() {
    updateGmAudio(null);
  }

  function stopAudio2() {
    updateGmAudio2(null);
  }

  async function selectMap(relativePath: string, asNewScene = false) {
    const vaultPath = getVaultPath();
    if (!vaultPath) return;
    try {
      const base64 = await readFileBase64(`${vaultPath}/${relativePath}`);
      const ext = relativePath.split('.').pop()?.toLowerCase();
      let mime = 'image/png';
      if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
      else if (ext === 'webp') mime = 'image/webp';
      const dataUrl = `data:${mime};base64,${base64}`;
      const name = relativePath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? relativePath;
      if (asNewScene) {
        addMapScene(name, relativePath, dataUrl);
      } else {
        replaceActiveScene(name, relativePath, dataUrl);
      }
      showMapPicker = false;
    } catch (err) {
      console.error('Failed to load map:', err);
    }
  }

  function closeMap() {
    vttStore.currentMap = null;
    vttStore.currentMapRelPath = null;
    emitToPlayerView('set_player_map', { url: null });
  }

  let tokenCount = 0;
  function createTestToken() {
    tokenCount++;
    addGmToken({
      id: Math.random().toString(36).slice(2),
      name: `Token ${tokenCount}`,
      x: 125 + (tokenCount % 8) * 65,
      y: 125 + Math.floor(tokenCount / 8) * 65,
      size: 50,
      color: 0x3b82f6,
      hp: 10,
      maxHp: 10,
      visionRange: 0,
      isEnemy: false,
    });
  }
</script>

<svelte:window onkeydown={handleKeydown} onclick={() => activeMenu = null} />

<div class="vtt-toolbar menubar-style" bind:this={toolbarEl}>
  <div class="menubar-items">
    
    <!-- 1. Carte & Vue -->
    <div class="menu-dropdown" class:open={activeMenu === 'map'}>
      <button class="menu-btn" onclick={(e) => { e.stopPropagation(); activeMenu = activeMenu === 'map' ? null : 'map'; }}>🗺️ Carte & Vue</button>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="dropdown-content" class:hidden={activeMenu !== 'map'} onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
        {#if !vttStore.currentMap}
          <button class="dropdown-item" onclick={() => { showMapPicker = true; activeMenu = null; }}>🗺️ Charger une carte</button>
          <button class="dropdown-item highlight-item" onclick={() => { openMapEditor(); activeMenu = null; }}>🎨 Créer dans Fantasy Map Editor</button>
        {:else}
          <button class="dropdown-item" onclick={() => { showMapPicker = true; activeMenu = null; }}>🗺️ Changer de carte</button>
          <button class="dropdown-item highlight-item" onclick={() => { openMapEditorWithMap(vttStore.currentMap!, vttStore.currentMapRelPath?.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Carte Active'); activeMenu = null; }}>✏️ Modifier dans le Map Editor</button>
          <button class="dropdown-item" onclick={() => { closeMap(); activeMenu = null; }}>✖️ Fermer la carte</button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item" class:active={vttStore.mode === 'zoom-rect'} onclick={() => { vttStore.mode = 'zoom-rect'; activeMenu = null; }}>🔍 Zoomer sur une zone</button>
          <button class="dropdown-item" onclick={() => { vttStore.fitRequest++; vttStore.mode = 'select'; activeMenu = null; }}>⌂ Réinitialiser le zoom</button>
          <button class="dropdown-item" onclick={() => { undoMapAction(); activeMenu = null; }} disabled={!canUndo()}>↩️ Annuler action carte</button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item" onclick={() => vttStore.exportRequest++}>🖼️💾 Exporter carte en PNG</button>
          <button class="dropdown-item" onclick={() => { openMapEditor(); activeMenu = null; }}>🎨 Nouveau projet Map Editor</button>
        {/if}
        <div class="dropdown-divider"></div>
        <button class="dropdown-item" class:active={vttStore.showGrid} onclick={toggleGrid}>#️⃣ Afficher/masquer grille</button>
        <button class="dropdown-item" class:active={vttStore.mode === 'calibrate-grid'} onclick={() => { vttStore.mode = 'calibrate-grid'; activeMenu = null; }}>📐 Calibrer la grille (tracer 3x3 cases)</button>
        <div class="dropdown-submenu-item">
          <span class="grid-label">Taille grille:</span>
          <input type="number" class="grid-input" value={vttStore.gridSize} min="10" max="200" step="5" onchange={(e) => setGridSize(Number((e.target as HTMLInputElement).value))} />
        </div>
        <button class="dropdown-item blackout-item" class:active={vttStore.isBlackout} onclick={toggleBlackout}>
          {vttStore.isBlackout ? '👁️ Désactiver Écran Noir' : '🕶️ Activer Écran Noir'}
        </button>
      </div>
    </div>

    <!-- 2. Outils interactifs -->
    {#if vttStore.currentMap}
      <div class="menu-dropdown" class:open={activeMenu === 'tools'}>
        <button class="menu-btn" onclick={(e) => { e.stopPropagation(); activeMenu = activeMenu === 'tools' ? null : 'tools'; }}>🛠️ Outils</button>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div class="dropdown-content" class:hidden={activeMenu !== 'tools'} onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
          <button class="dropdown-item" class:active={vttStore.mode === 'select'} onclick={() => vttStore.mode = 'select'}>👆 Sélectionner</button>
          <button class="dropdown-item" class:active={vttStore.mode === 'measure'} onclick={() => vttStore.mode = 'measure'}>📏 Mesurer distance</button>
          <button class="dropdown-item" class:active={vttStore.mode === 'ping'} onclick={() => vttStore.mode = 'ping'}>📍 Ping (Joueurs)</button>
          <button class="dropdown-item" class:active={vttStore.mode === 'pin'} onclick={() => vttStore.mode = 'pin'}>📌 Épingle Permanente</button>
          {#if vttStore.pins.length > 0}
            <button class="dropdown-item text-danger" onclick={clearGmPins}>📌🗑️ Effacer épingles</button>
          {/if}
          
          <div class="dropdown-divider"></div>
          <div class="dropdown-title">Brouillard de Guerre</div>
          <button class="dropdown-item" class:active={!vttStore.fowEnabled} onclick={toggleFow}>🌫️ {vttStore.fowEnabled ? 'Désactiver' : 'Activer'} Brouillard</button>
          {#if vttStore.fowEnabled}
            <button class="dropdown-item" class:active={vttStore.mode === 'fog-reveal'} onclick={() => vttStore.mode = 'fog-reveal'}>👁️ Révéler (Glisser)</button>
            <button class="dropdown-item" class:active={vttStore.mode === 'fog-hide'} onclick={() => vttStore.mode = 'fog-hide'}>⬛ Cacher (Glisser)</button>
            <button class="dropdown-item" class:active={vttStore.mode === 'fog-rect'} onclick={() => vttStore.mode = 'fog-rect'}>▭ Zone rectangulaire</button>
            <div class="dropdown-submenu-item tools-row">
              <button class="mini-btn text-only" onclick={revealAllGmFow}>🌅 Tout révéler</button>
              <button class="mini-btn text-only" onclick={clearGmFow}>🌑 Tout cacher</button>
            </div>
            <button class="dropdown-item" onclick={undoGmFow}>↩️ Annuler FOW</button>
          {/if}

          <div class="dropdown-divider"></div>
          <div class="dropdown-title">Dessin Libre</div>
          <button class="dropdown-item" class:active={vttStore.mode === 'draw'} onclick={() => vttStore.mode = 'draw'}>✏️ Dessiner</button>
          {#if vttStore.mode === 'draw'}
            <div class="dropdown-submenu-item tools-row">
              <input type="color" class="draw-color-input" title="Couleur" value={'#' + vttStore.drawColor.toString(16).padStart(6, '0')} oninput={(e) => { vttStore.drawColor = parseInt((e.target as HTMLInputElement).value.slice(1), 16); }} />
              <input type="range" class="draw-width-input" min="2" max="20" step="1" value={vttStore.drawWidth} oninput={(e) => { vttStore.drawWidth = Number((e.target as HTMLInputElement).value); }} />
            </div>
          {/if}
          {#if vttStore.drawPaths.length > 0}
            <button class="dropdown-item" onclick={undoDrawPath}>✏️↩️ Annuler dessin</button>
            <button class="dropdown-item text-danger" onclick={clearDrawPaths}>✏️🗑️ Effacer dessins</button>
          {/if}

          <div class="dropdown-divider"></div>
          <div class="dropdown-title">Architecture (Murs/LOS)</div>
          <button class="dropdown-item" class:active={vttStore.mode === 'blueprint'} onclick={() => vttStore.mode = 'blueprint'}>🧱 Mode Blueprint</button>
          {#if vttStore.mode === 'blueprint'}
            <div class="dropdown-submenu-item tools-row">
              <button class="mini-btn text-only" class:active={vttStore.blueprintType === 'opaque'} onclick={() => vttStore.blueprintType = 'opaque'}>🧱 Mur</button>
              <button class="mini-btn text-only" class:active={vttStore.blueprintType === 'door'} onclick={() => vttStore.blueprintType = 'door'}>🚪 Porte</button>
            </div>
          {/if}
          {#if vttStore.walls.length > 0}
            <button class="dropdown-item" onclick={undoGmWall}>🧱↩️ Annuler mur</button>
            <button class="dropdown-item text-danger" onclick={clearGmWalls}>🧱🗑️ Effacer murs</button>
          {/if}

          <div class="dropdown-divider"></div>
          <div class="dropdown-title">Sorts & Magie</div>
          <button class="dropdown-item" class:active={vttStore.mode === 'spell'} onclick={() => vttStore.mode = 'spell'}>💫 Placer un sort</button>
          {#if vttStore.mode === 'spell'}
            <div class="dropdown-submenu-item tools-row">
              {#each (['fire','ice','lightning','poison','silence','divine','darkness'] as const) as st}
                <button class="mini-btn" class:active={vttStore.spellType === st} onclick={() => vttStore.spellType = st} title={st}>{st === 'fire' ? '🔥' : st === 'ice' ? '❄️' : st === 'lightning' ? '⚡' : st === 'poison' ? '🧪' : st === 'silence' ? '🔇' : st === 'divine' ? '✨' : '🌑'}</button>
              {/each}
            </div>
            <div class="dropdown-submenu-item tools-row">
              <button class="mini-btn text-only" class:active={vttStore.spellShape === 'circle'} onclick={() => vttStore.spellShape = 'circle'}>⭕ Cercle</button>
              <button class="mini-btn text-only" class:active={vttStore.spellShape === 'cone'} onclick={() => vttStore.spellShape = 'cone'}>🔺 Cône</button>
              <button class="mini-btn text-only" class:active={vttStore.spellShape === 'line'} onclick={() => vttStore.spellShape = 'line'}>➡️ Ligne</button>
            </div>
            <div class="dropdown-submenu-item tools-row">
              {#if vttStore.spellShape === 'circle'}
                <input type="number" class="spell-radius-input" value={vttStore.spellRadius} min="20" max="400" step="10" title="Rayon (px)" onchange={(e) => vttStore.spellRadius = Number((e.target as HTMLInputElement).value)} />
              {:else if vttStore.spellShape === 'cone'}
                <input type="number" class="spell-radius-input" value={vttStore.spellRadius} min="20" max="400" step="10" title="Portée (px)" onchange={(e) => vttStore.spellRadius = Number((e.target as HTMLInputElement).value)} />
                <input type="range" class="draw-width-input" min="0" max="360" step="5" value={Math.round((vttStore.spellConeAngle ?? Math.PI/3) * 180 / Math.PI)} oninput={(e) => vttStore.spellConeAngle = Number((e.target as HTMLInputElement).value) * Math.PI / 180} title="Ouverture du cône (°)" />
                <input type="range" class="draw-width-input" min="0" max="360" step="5" value={vttStore.spellAngleDeg} oninput={(e) => { const v = Number((e.target as HTMLInputElement).value); vttStore.spellAngleDeg = v; vttStore.spellAngle = v * Math.PI / 180; }} title="Direction du cône (°)" />
              {:else if vttStore.spellShape === 'line'}
                <input type="number" class="spell-radius-input" value={vttStore.spellLength} min="50" max="800" step="25" title="Longueur (px)" onchange={(e) => vttStore.spellLength = Number((e.target as HTMLInputElement).value)} />
                <input type="range" class="draw-width-input" min="0" max="360" step="5" value={vttStore.spellAngleDeg} oninput={(e) => { const v = Number((e.target as HTMLInputElement).value); vttStore.spellAngleDeg = v; vttStore.spellAngle = v * Math.PI / 180; }} title="Direction (°)" />
              {/if}
            </div>
          {/if}
          {#if vttStore.spells.length > 0}
            <button class="dropdown-item text-danger" onclick={clearSpells}>🗑️ Effacer sorts</button>
          {/if}

          <div class="dropdown-divider"></div>
          <div class="dropdown-title">Terrain</div>
          <button class="dropdown-item" class:active={vttStore.mode === 'terrain'} onclick={() => vttStore.mode = 'terrain'}>🗺️ Dessiner terrain</button>
          {#if vttStore.mode === 'terrain'}
            <div class="dropdown-submenu-item tools-row">
              {#each ([['difficult','🏔️','Difficile'],['water','🌊','Eau'],['fire','🔥','Feu'],['poison','🧪','Poison'],['safe','✅','Sûr']] as const) as [t, icon, label]}
                <button class="mini-btn" class:active={vttStore.terrainType === t} onclick={() => vttStore.terrainType = t} title={label}>{icon}</button>
              {/each}
            </div>
          {/if}
          {#if vttStore.terrainZones.length > 0}
            <button class="dropdown-item text-danger" onclick={clearTerrainZones}>🗺️🗑️ Effacer terrains</button>
          {/if}

          <div class="dropdown-divider"></div>
          <button class="dropdown-item" onclick={() => { showTokenPicker = true; tokenPickerSearch = ''; activeMenu = null; }}>🖼️ Token image</button>
          <button class="dropdown-item" onclick={createTestToken}>👹 Token basique (test)</button>
        </div>
      </div>
    {/if}

    <!-- 3. Ambiance & Audio -->
    <div class="menu-dropdown" class:open={activeMenu === 'audio'}>
      <button class="menu-btn" onclick={(e) => { e.stopPropagation(); activeMenu = activeMenu === 'audio' ? null : 'audio'; }}>🎭 Ambiance</button>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="dropdown-content" class:hidden={activeMenu !== 'audio'} onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
        <button class="dropdown-item soundscape-menu-highlight" onclick={() => { showSoundscapeMixer = true; activeMenu = null; }}>
          🌧️ Mixeur d'Ambiance Sonore {#if soundscape.activeTracksCount > 0}⚡ ({soundscape.activeTracksCount} actives){/if}
        </button>
        <div class="dropdown-divider"></div>
        <button class="dropdown-item" onclick={() => { showAudioPicker = true; activeMenu = null; }}>{vttStore.audioSrc ? '🔊 Piste 1 en cours...' : '🎵 Choisir Piste 1'}</button>
        {#if vttStore.audioSrc}
          <div class="dropdown-submenu-item">
            <input type="range" min="0" max="1" step="0.05" value={vttStore.audioVolume} oninput={(e) => setGmAudioVolume(Number((e.target as HTMLInputElement).value))} />
            <button class="btn-stop" onclick={stopAudio}>⏹️ Arrêter</button>
          </div>
        {/if}

        <button class="dropdown-item" onclick={() => { showAudio2Picker = true; activeMenu = null; }}>{vttStore.audio2Src ? '🔈 Piste 2 en cours...' : '🎶 Choisir Piste 2'}</button>
        {#if vttStore.audio2Src}
          <div class="dropdown-submenu-item">
            <input type="range" min="0" max="1" step="0.05" value={vttStore.audio2Volume} oninput={(e) => setGmAudio2Volume(Number((e.target as HTMLInputElement).value))} />
            <button class="btn-stop" onclick={stopAudio2}>⏹️ Arrêter</button>
          </div>
        {/if}

        {#if vttStore.currentMap}
          <div class="dropdown-divider"></div>
          <button class="dropdown-item" class:active={vttStore.mode === 'audio-zone'} onclick={() => { vttStore.mode = 'audio-zone'; activeMenu = null; }}>🎶 Dessiner zone sonore locale</button>
        {/if}

        <div class="dropdown-divider"></div>
        <div class="dropdown-title">Météo</div>
        <div class="dropdown-submenu-item tools-row">
          {#each (['none','rain','snow','fog','embers'] as const) as w}
            <button class="mini-btn" class:active={vttStore.weather === w} onclick={() => setWeather(w)} title={w}>{w === 'none' ? '☀️' : w === 'rain' ? '🌧️' : w === 'snow' ? '❄️' : w === 'fog' ? '🌫️' : '🔥'}</button>
          {/each}
        </div>
        <button class="dropdown-item" onclick={sendWeatherNarrative} title="Diffuse et prononce une description du climat actuel">
          🌦️ Envoyer narration météo {#if isNarratorVoiceEnabled}<span style="margin-left: auto; font-size: 11px; opacity: 0.8;">🗣️ Voix</span>{/if}
        </button>

        <div class="dropdown-divider"></div>
        <div class="dropdown-title">Éclairage Ambiant</div>
        <div class="dropdown-submenu-item tools-row">
          <button class="mini-btn text-only" class:active={vttStore.ambientLight === 'day'} onclick={() => setAmbientLight('day')} title="Plein jour">☀️ Jour</button>
          <button class="mini-btn text-only" class:active={vttStore.ambientLight === 'dusk'} onclick={() => setAmbientLight('dusk')} title="Crépuscule">🌅 Crépuscule</button>
          <button class="mini-btn text-only" class:active={vttStore.ambientLight === 'night'} onclick={() => setAmbientLight('night')} title="Nuit">🌙 Nuit</button>
          <button class="mini-btn text-only" class:active={vttStore.ambientLight === 'pitch_black'} onclick={() => setAmbientLight('pitch_black')} title="Noir total / Souterrain">🌑 Souterrain</button>
        </div>
        <button class="dropdown-item" onclick={triggerLightningFlash}>⚡ Flash d'Éclair & Foudre</button>

        <div class="dropdown-divider"></div>
        <div class="dropdown-title">Voix Narrateur IA</div>
        <div class="dropdown-submenu-item" style="justify-content: space-between;">
          <span style="font-size: 11px; color: var(--text-secondary);">Lecture vocale :</span>
          <button 
            class="mini-btn" 
            class:active={isNarratorVoiceEnabled} 
            onclick={() => isNarratorVoiceEnabled = !isNarratorVoiceEnabled}
            title={isNarratorVoiceEnabled ? 'Désactiver la voix IA' : 'Activer la voix IA'}
          >
            {isNarratorVoiceEnabled ? '🗣️ Activée' : '🔇 Désactivée'}
          </button>
        </div>
        {#if ttsReader.isPlaying}
          <div class="dropdown-submenu-item" style="background: rgba(56,189,248,0.12); border-radius: 4px; margin: 2px 6px; padding: 4px 8px; justify-content: space-between;">
            <span style="font-size: 11px; color: #38bdf8; display: flex; align-items: center; gap: 4px;">
              🎙️ {ttsReader.currentSpeakerEmoji} Parle…
            </span>
            <button class="mini-btn btn-stop" onclick={() => ttsReader.stop()} title="Arrêter la voix">⏹️ Stop</button>
          </div>
        {/if}

        <div class="dropdown-divider"></div>
        <div class="dropdown-submenu-item">
          <input 
            type="text" 
            class="ambient-input" 
            style="width: 100%" 
            placeholder="Texte d'ambiance personnalisé (Entrée pour dire/projeter)..." 
            bind:value={ambientTextInput} 
            onkeydown={(e) => { 
              if (e.key === 'Enter') { 
                const v = ambientTextInput.trim(); 
                if (v) { 
                  handleCustomAmbient(v); 
                  ambientTextInput = ''; 
                  activeMenu = null; 
                } 
              } 
            }} 
          />
        </div>
      </div>
    </div>

    <!-- 4. Joueurs & Groupe -->
    <div class="menu-dropdown" class:open={activeMenu === 'players'}>
      <button class="menu-btn" onclick={(e) => { e.stopPropagation(); activeMenu = activeMenu === 'players' ? null : 'players'; }}>👥 Joueurs</button>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="dropdown-content" class:hidden={activeMenu !== 'players'} onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
        <button class="dropdown-item" onclick={() => { onTogglePlayerManager?.(); activeMenu = null; }}>📝 Gestionnaire de Groupe</button>
        <button class="dropdown-item" onclick={() => { onTogglePlayerHub?.(); activeMenu = null; }}>📱 Hub des Joueurs</button>
        <button class="dropdown-item" onclick={() => { onTogglePlayerMobileManager?.(); activeMenu = null; }}>📲 Serveur Mobile (QR)</button>
        
        <div class="dropdown-divider"></div>
        <button class="dropdown-item" onclick={() => { showHandoutPicker = true; activeMenu = null; }}>📤 Envoyer un Handout</button>
        <button class="dropdown-item" onclick={() => { showSharedNotes = true; activeMenu = null; }}>📋 Notes Partagées</button>

        <div class="dropdown-divider"></div>
        <button class="dropdown-item" class:active={vttStore.sessionTimerStart !== null} onclick={toggleTimer}>⏱️ Session: {sessionDisplay}</button>
        
        <div class="dropdown-title">Compte à rebours</div>
        {#if vttStore.countdownEnd !== null}
          <button class="dropdown-item text-danger" onclick={stopCountdown}>⏹️ Arrêter le compte à rebours</button>
        {:else}
          <div class="dropdown-submenu-item tools-row">
            {#each [15, 30, 60] as s}
              <button class="mini-btn text-only" onclick={() => { countdownSecs = s; startCountdown(s); activeMenu = null; }}>{s}s</button>
            {/each}
            <input type="number" class="grid-input" bind:value={countdownSecs} min="5" max="600" step="5" style="width:46px"/>
            <button class="mini-btn text-only" onclick={() => { startCountdown(countdownSecs); activeMenu = null; }}>▶️</button>
          </div>
        {/if}
      </div>
    </div>

    <!-- 5. Outils du MJ -->
    <div class="menu-dropdown" class:open={activeMenu === 'gm'}>
      <button class="menu-btn" onclick={(e) => { e.stopPropagation(); activeMenu = activeMenu === 'gm' ? null : 'gm'; }}>🧙‍♂️ Outils MJ</button>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="dropdown-content" class:hidden={activeMenu !== 'gm'} onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
        <button class="dropdown-item" onclick={() => { gmScreen?.toggle(); activeMenu = null; }}>🛡️ Écran Tactique (Dashboard)</button>
        <button class="dropdown-item" onclick={() => { critWounds?.toggle(); activeMenu = null; }}>🩸 Blessures Critiques</button>
        <button class="dropdown-item" onclick={() => { chaosMuts?.toggle(); activeMenu = null; }}>🌑 Mutations du Chaos</button>
        <button class="dropdown-item" onclick={() => { merchantGen?.toggle(); activeMenu = null; }}>🛍️ Marchand Générateur</button>
        <button class="dropdown-item" onclick={() => { rumorMan?.toggle(); activeMenu = null; }}>🎭 Système de Murmures</button>
        <div class="dropdown-divider"></div>
        <button class="dropdown-item" onclick={() => { showQuestJournal = true; activeMenu = null; }}>📜 Journal de Quêtes & Campagne</button>
        <button class="dropdown-item" onclick={() => { showNarrativeAssistant = true; activeMenu = null; }}>🤖 Assistant IA & Narratif</button>
        <button class="dropdown-item" onclick={() => { showDungeonGenerator = true; activeMenu = null; }}>🏰 Donjon & Murs Procédural</button>
        <button class="dropdown-item" onclick={() => { showNpcModal = true; activeMenu = null; }}>🧟 PNJ Rapide</button>
        <button class="dropdown-item" onclick={() => { showLootModal = true; activeMenu = null; }}>💰 Butin Rapide</button>
        
        <div class="dropdown-divider"></div>
        <div class="dropdown-title">Générateurs</div>
        <button class="dropdown-item" onclick={() => { showEncounterGen = true; activeMenu = null; }}>⚡ Rencontres</button>
        <button class="dropdown-item" onclick={() => { showRoomGen = true; activeMenu = null; }}>🏚️ Salles</button>
        <button class="dropdown-item" onclick={() => { showWeatherPlanner = true; activeMenu = null; }}>🌦️ Météo</button>
        
        <div class="dropdown-divider"></div>
        <div class="dropdown-title">Bibliothèques & Éditeurs</div>
        <button class="dropdown-item" onclick={() => { showAddonStore = true; activeMenu = null; }}>🌌 Bibliothèque Céleste & Livres PDF</button>
        <button class="dropdown-item" onclick={() => { showSharedLibrary = true; activeMenu = null; }}>📚 Bibliothèque partagée</button>
        
        <button class="dropdown-item" onclick={() => { charCreator?.toggle(); activeMenu = null; }}>⚔️ Créateur de personnage</button>
        <button class="dropdown-item" onclick={() => { soundBoard?.toggle(); activeMenu = null; }}>🎹 SoundBoard</button>
        <button class="dropdown-item" onclick={() => { monsterLib?.toggle(); activeMenu = null; }}>🐉 Monstres</button>
        <button class="dropdown-item" onclick={() => { advLib?.toggle(); activeMenu = null; }}>🗺️ Aventures</button>
        <button class="dropdown-item" onclick={() => { sessionExport?.toggle(); activeMenu = null; }}>💾 Export Session</button>

        <div class="dropdown-divider"></div>
        <button class="dropdown-item" class:active={showRelationMap} onclick={() => { showRelationMap = !showRelationMap; activeMenu = null; }}>🕸️ Carte des Relations</button>
        <button class="dropdown-item" class:active={showCombatLogPanel} onclick={() => { showCombatLogPanel = !showCombatLogPanel; activeMenu = null; }}>📜 Log de Combat</button>
        <button class="dropdown-item" onclick={() => { showDamageCalc = true; activeMenu = null; }}>💥 Calculateur de Dégâts</button>
        <button class="dropdown-item" class:active={showDurationTracker} onclick={() => { showDurationTracker = !showDurationTracker; activeMenu = null; }}>⏱️ Suivi des durées</button>
      </div>
    </div>

  </div>

  <!-- Élément permanent à droite -->
  <div class="toolbar-permanent">
    <DiceRoller onRoll={handleDiceRoll} />
    <button class="btn icon-btn combat-btn ml-1" class:active={vttStore.combatActive}
      onclick={() => vttStore.combatActive ? stopCombat() : startCombat()}
      title={vttStore.combatActive ? 'Terminer le combat' : 'Démarrer le tracker de combat'}>
      ⚔️
    </button>
    <button class="soundscape-quick-btn" class:active-sound={soundscape.activeTracksCount > 0}
      onclick={() => showSoundscapeMixer = true}
      title="Mixeur d'Ambiances Sonores">
      🌧️ Ambiance {#if soundscape.activeTracksCount > 0}<span class="sound-badge">{soundscape.activeTracksCount}</span>{/if}
    </button>
    <div class="separator"></div>
    <div class="time-widget" style="display:flex; align-items:center; gap:4px; font-size:11px; background:var(--bg-secondary); padding:2px 8px; border-radius:4px; border:1px solid var(--border);">
      <span style="color:var(--text-secondary)">🕒 {$timeStore ? formatImperialDate($timeStore) : ''}</span>
      <button class="mini-btn text-only" onclick={() => advanceTime(1)} title="+1 Heure">+1h</button>
      <button class="mini-btn text-only" onclick={() => advanceTime(24)} title="+1 Jour">+1j</button>
    </div>
    <div class="separator"></div>
    <input type="text" class="campaign-title-input" placeholder="Titre de campagne…"
      value={vttStore.campaignTitle}
      oninput={(e) => setCampaignTitle((e.target as HTMLInputElement).value)}
      title="Titre affiché sur l'écran joueur" />
  </div>
</div>

<div class="hidden-toggles">
  <CharacterCreator bind:this={charCreator} />
  <SoundBoard bind:this={soundBoard} />
  <MonsterLibrary bind:this={monsterLib} />
  <AdventureLibrary bind:this={advLib} />
  <SessionExport bind:this={sessionExport} />
  <GMScreen bind:this={gmScreen} />
  <CriticalWounds bind:this={critWounds} />
  <ChaosMutations bind:this={chaosMuts} />
  <MerchantGenerator bind:this={merchantGen} />
  <RumorManager bind:this={rumorMan} />
</div>

<!-- Modals -->
{#if showSoundscapeMixer}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="picker-backdrop" onclick={() => showSoundscapeMixer = false}>
    <div class="soundscape-modal-wrap" onclick={e => e.stopPropagation()}>
      <SoundscapeMixer onclose={() => showSoundscapeMixer = false} />
    </div>
  </div>
{/if}
{#if showNpcModal}<QuickNpcModal onclose={() => showNpcModal = false} />{/if}
{#if showLootModal}<QuickLootModal onclose={() => showLootModal = false} />{/if}
{#if showHandoutModal}<HandoutModal onclose={() => showHandoutModal = false} />{/if}
{#if showDamageCalc}<DamageCalculator onclose={() => showDamageCalc = false} />{/if}
{#if showEncounterGen}<EncounterGenerator onclose={() => showEncounterGen = false} />{/if}
{#if showRoomGen}<RoomGenerator onclose={() => showRoomGen = false} />{/if}
{#if showWeatherPlanner}<WeatherPlanner onclose={() => showWeatherPlanner = false} />{/if}
{#if showSharedNotes}<SharedNotesModal onclose={() => showSharedNotes = false} />{/if}
{#if showNarrativeAssistant}<NarrativeAssistant onclose={() => showNarrativeAssistant = false} />{/if}
{#if showDungeonGenerator}<DungeonGenerator onclose={() => showDungeonGenerator = false} />{/if}
{#if showQuestJournal}<QuestJournal onclose={() => showQuestJournal = false} />{/if}

<!-- Panneau Relations PNJ -->
{#if showRelationMap}
  <div class="float-panel float-panel-wide">
    <div class="float-panel-header">
      <span>🕸️ Carte des Relations PNJ</span>
      <button onclick={() => showRelationMap = false}>✕</button>
    </div>
    <NpcRelationMap />
  </div>
{/if}

<!-- Panneau Log de combat -->
{#if showCombatLogPanel}
  <div class="float-panel">
    <div class="float-panel-header">
      <span>📜 Log de Combat</span>
      <button onclick={() => showCombatLogPanel = false}>✕</button>
    </div>
    <CombatLog />
  </div>
{/if}

<!-- Panneau Suivi des durées -->
{#if showDurationTracker}
  <div class="float-panel float-panel-narrow">
    <div class="float-panel-header">
      <span>⏱️ Durées & Effets</span>
      <button onclick={() => showDurationTracker = false}>✕</button>
    </div>
    <DurationTracker />
  </div>
{/if}

<!-- Sélecteur de carte -->
{#if showMapPicker}
  {@const allMaps = getAllImages(getVaultTree(), '', 'maps')}
  {@const q = mapPickerSearch.toLowerCase()}
  {@const images = q ? allMaps.filter(m => m.name.toLowerCase().includes(q)) : allMaps}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="picker-backdrop" onclick={() => { showMapPicker = false; mapPickerSearch = ''; }} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="picker-modal" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
      <div class="picker-header">
        <span>🗺️ Choisir une carte</span>
        <button class="picker-close" onclick={() => { showMapPicker = false; mapPickerSearch = ''; }}>✕</button>
      </div>
      <div class="picker-search-bar">
        <!-- svelte-ignore a11y_autofocus -->
        <input
          type="text"
          class="picker-search"
          placeholder="Rechercher une carte…"
          bind:value={mapPickerSearch}
          autofocus
        />
      </div>
      <div class="picker-list">
        {#if allMaps.length === 0}
          <div class="picker-empty">Aucune image dans le dossier maps/ (ni ses sous-dossiers).</div>
        {:else if images.length === 0}
          <div class="picker-empty">Aucun résultat pour "{mapPickerSearch}".</div>
        {:else}
          {#each images as img}
            <div class="picker-item-row">
              <button class="picker-item" onclick={() => selectMap(img.path)}>
                <span class="picker-icon">🗺️</span>
                <span class="picker-name">{img.name}</span>
                <span class="picker-path">{img.path}</span>
              </button>
              <button class="picker-item-new" onclick={() => selectMap(img.path, true)} title="Ouvrir dans une nouvelle scène">＋</button>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Bibliothèque commune -->
{#if showSharedLibrary}
  <SharedLibrary onClose={() => showSharedLibrary = false} />
{/if}

<!-- Sélecteur de token image -->
{#if showTokenPicker}
  {@const allTokens = getAllImages(getVaultTree(), '', 'tokens').sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))}
  {@const qt = tokenPickerSearch.toLowerCase()}
  {@const tokens = qt ? allTokens.filter(t => t.name.toLowerCase().includes(qt)) : allTokens}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="picker-backdrop" onclick={() => { showTokenPicker = false; tokenPickerSearch = ''; }} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="picker-modal" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
      <div class="picker-header">
        <span>🖼️ Choisir un token</span>
        <button class="picker-close" onclick={() => { showTokenPicker = false; tokenPickerSearch = ''; }}>✕</button>
      </div>
      <div class="picker-search-bar">
        <!-- svelte-ignore a11y_autofocus -->
        <input
          type="text"
          class="picker-search"
          placeholder="Rechercher un token…"
          bind:value={tokenPickerSearch}
          autofocus
        />
      </div>
      <div class="picker-list">
        {#if allTokens.length === 0}
          <div class="picker-empty">Aucune image dans le dossier tokens/ (ni ses sous-dossiers).</div>
        {:else if tokens.length === 0}
          <div class="picker-empty">Aucun résultat pour "{tokenPickerSearch}".</div>
        {:else}
          {#each tokens as tok}
            <button class="picker-item" onclick={() => createImageToken(tok.path)}>
              <span class="picker-icon">👹</span>
              <span class="picker-name">{tok.name.replace(/\.[^.]+$/, '')}</span>
              <span class="picker-path">{tok.path}</span>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Sélecteur d'audio -->
{#if showAudioPicker}
  {@const audios = getAllAudio(getVaultTree())}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="picker-backdrop" onclick={() => showAudioPicker = false} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="picker-modal" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
      <div class="picker-header">
        <span>🎵 Ambiance Sonore</span>
        <button class="picker-close" onclick={() => showAudioPicker = false}>✕</button>
      </div>
      <div class="picker-list">
        {#if audios.length === 0}
          <div class="picker-empty">Aucun fichier audio (MP3, WAV, OGG) dans le vault.</div>
        {:else}
          {#each audios as aud}
            <button class="picker-item" onclick={() => selectAudio(aud.path)}>
              <span class="picker-icon">🎶</span>
              <span class="picker-name">{aud.name}</span>
              <span class="picker-path">{aud.path}</span>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

{#if showAudio2Picker}
  {@const audios = getAllAudio(getVaultTree())}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="picker-backdrop" onclick={() => showAudio2Picker = false}>
    <div class="picker-modal" onclick={e => e.stopPropagation()}>
      <div class="picker-header">
        <span>🎶 Ambiance Sonore — Piste 2</span>
        <button class="picker-close" onclick={() => showAudio2Picker = false}>✕</button>
      </div>
      <div class="picker-list">
        {#if audios.length === 0}
          <div class="picker-empty">Aucun fichier audio (MP3, WAV, OGG) dans le vault.</div>
        {:else}
          {#each audios as aud}
            <button class="picker-item" onclick={() => { updateGmAudio2(aud.path); showAudio2Picker = false; }}>
              <span class="picker-icon">🎶</span>
              <span class="picker-name">{aud.name}</span>
              <span class="picker-path">{aud.path}</span>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Sélecteur de handout -->
{#if showHandoutPicker}
  {@const images = getAllImages(getVaultTree())}
  {@const notes = getAllMd(getVaultTree())}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="picker-backdrop" onclick={() => showHandoutPicker = false}>
    <div class="picker-modal handout-modal" onclick={e => e.stopPropagation()}>
      <div class="picker-header">
        <span>📤 Envoyer un Handout</span>
        <button class="picker-close" onclick={() => showHandoutPicker = false}>✕</button>
      </div>
      <div class="handout-tabs">
        <div class="handout-section">
          <div class="handout-section-title">🖼️ Images</div>
          <div class="picker-list handout-list">
            {#if images.length === 0}
              <div class="picker-empty">Aucune image dans le vault.</div>
            {:else}
              {#each images as img}
                <button class="picker-item" onclick={() => sendImageHandout(img.path)}>
                  <span class="picker-icon">🖼️</span>
                  <span class="picker-name">{img.name}</span>
                  <span class="picker-path">{img.path}</span>
                </button>
              {/each}
            {/if}
          </div>
        </div>
        <div class="handout-section">
          <div class="handout-section-title">📝 Notes</div>
          <div class="picker-list handout-list">
            {#if notes.length === 0}
              <div class="picker-empty">Aucune note dans le vault.</div>
            {:else}
              {#each notes as note}
                <button class="picker-item" onclick={() => sendNoteHandout(note.path)}>
                  <span class="picker-icon">📝</span>
                  <span class="picker-name">{note.name}</span>
                  <span class="picker-path">{note.path}</span>
                </button>
              {/each}
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
{#if showAddonStore}
  <AddonStore onclose={() => showAddonStore = false} />
{/if}

<style>
  
  /* Menubar UI */
  .menubar-style {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border);
    padding: 0 8px;
    height: 40px;
    flex-shrink: 0;
  }

  .menubar-items {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 100%;
  }

  .menu-dropdown {
    position: relative;
    height: 100%;
    display: flex;
    align-items: center;
  }

  .menu-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
    padding: 6px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .menu-btn:hover { background: rgba(255,255,255,0.08); color: var(--text-primary); }
  .menu-dropdown.open .menu-btn { background: rgba(255,255,255,0.12); color: var(--accent); }

  .dropdown-content {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 240px;
    max-height: 85vh;
    overflow-y: auto;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.6);
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    z-index: 1000;
    animation: slideDown 0.1s ease-out;
  }
  .dropdown-content.hidden { display: none !important; }

  .dropdown-item {
    display: flex;
    align-items: center;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 13px;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
  }
  .dropdown-item:hover { background: var(--bg-hover); color: var(--text-primary); }
  .dropdown-item.active { background: rgba(229,168,83,0.15); color: var(--accent); }
  .dropdown-item.text-danger:hover { background: rgba(239,68,68,0.15); color: #ef4444; }

  .dropdown-divider {
    height: 1px;
    background: var(--border);
    margin: 4px 0;
  }

  .dropdown-title {
    font-size: 10px;
    text-transform: uppercase;
    color: var(--text-muted);
    padding: 4px 8px;
    letter-spacing: 0.05em;
  }

  .dropdown-submenu-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
  }

  .tools-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .mini-btn {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
  }
  .mini-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
  .mini-btn.active { background: rgba(229,168,83,0.15); border-color: var(--accent); color: var(--accent); }
  .mini-btn.text-only { font-size: 11px; padding: 3px 8px; }

  .toolbar-permanent {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .ml-1 { margin-left: 4px; }

  .hidden-toggles > :global(button) {
    display: none !important;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .float-panel {
    position: fixed;
    bottom: 60px;
    right: 16px;
    z-index: 600;
    width: 340px;
    max-height: 70vh;
    overflow-y: auto;
    background: var(--bg-secondary, #161b22);
    border: 1px solid var(--border, #2d3748);
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,.6);
    overflow: hidden;
  }
  .float-panel-wide { width: min(900px, 95vw); }
  .float-panel-narrow { width: 280px; }
  .float-panel-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 12px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border);
    font-size: 12px; font-weight: 700; color: var(--accent);
  }
  .float-panel-header button {
    background: none; border: none; cursor: pointer;
    color: var(--text-muted); font-size: 14px;
  }

  .soundscape-quick-btn {
    background: #141d2b;
    border: 1px solid #1e293b;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: all 0.15s;
  }
  .soundscape-quick-btn:hover {
    background: #1e293b;
    color: #38bdf8;
    border-color: #38bdf8;
  }
  .soundscape-quick-btn.active-sound {
    background: #0c4a6e;
    color: #38bdf8;
    border-color: #38bdf8;
    box-shadow: 0 0 8px rgba(56,189,248,0.4);
  }
  .sound-badge {
    background: #38bdf8;
    color: #0c1320;
    font-size: 9px;
    font-weight: 800;
    padding: 0 4px;
    border-radius: 8px;
  }
  .picker-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(4px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeInModal 0.15s ease-out;
  }

  @keyframes fadeInModal {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .soundscape-modal-wrap {
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 95vw;
    max-height: 90vh;
  }
  .soundscape-menu-highlight {
    color: #38bdf8 !important;
    font-weight: 700;
  }
  .highlight-item {
    color: #fbbf24 !important;
    font-weight: 700;
  }
  .highlight-item:hover {
    background: rgba(251, 191, 36, 0.15) !important;
    color: #fef08a !important;
  }
  .float-panel-header button:hover { color: var(--text-primary); }

  </style>
