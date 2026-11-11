<script lang="ts">
  import { onMount } from 'svelte';
  import SharedLibrary from './SharedLibrary.svelte';
  import { emitToPlayerView, readFileBase64, writeFileBase64, createDirectory, reindex, isTauri, readFile, openMapEditor, openMapEditorWithMap, getPlayerViewStatus } from '$lib/api';
  import { notifStore } from '$lib/stores/notifications.svelte';
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
    clearGmTokens, removeGmDemoTokens, removeGmTokensByFilter, resetVttScene, DEMO_TOKEN_IDS,
    toggleShowFps, toggleMinimap, toggleTokenNames, toggleTokenHpBars, togglePins, toggleVignette, toggleSnapToGrid, toggleTokenAnimations,
  } from '$lib/stores/vtt.svelte';
  import type { VaultEntry } from '$lib/api';
  import SoundBoard from './SoundBoard.svelte';
  import MonsterLibrary from './MonsterLibrary.svelte';
  import SessionExport from './SessionExport.svelte';
  import GMScreen from './GMScreen.svelte';
  import CriticalWounds from './CriticalWounds.svelte';
  import ChaosMutations from './ChaosMutations.svelte';
  import MerchantGenerator from './MerchantGenerator.svelte';
  import HerboristeModal from './herboriste/HerboristeModal.svelte';
  import { narrationStudioStore } from '$lib/stores/narrationStudio.svelte';
  import RumorManager from './RumorManager.svelte';
  import { timeStore, advanceTime, formatImperialDate } from '$lib/stores/timeStore';
  import PlayerMobileManager from './PlayerMobileManager.svelte';
  import { mobileServerStore } from '$lib/stores/mobileServer.svelte';
  import { sceneRunnerStore } from '$lib/stores/sceneRunner.svelte';
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
  import SfxSoundboard from './SfxSoundboard.svelte';
  import { soundscape } from '$lib/stores/soundscape.svelte';
  import { ttsReader } from '$lib/stores/ttsReader.svelte';
  import { playlistStore, stopAllAudiosGlobally } from '$lib/stores/playlist.svelte';
  import { sessionIntroStore } from '$lib/stores/sessionIntro.svelte';
  import AddonStore from './AddonStore.svelte';
  import TokenEditorModal from './TokenEditorModal.svelte';
  import CampaignBackupModal from './CampaignBackupModal.svelte';
  import PlaylistModal from './PlaylistModal.svelte';

  let { 
    onRoll,
    onTogglePlayerHub,
    onTogglePlayerManager,
    onTogglePlayerMobileManager,
    onTogglePlayerQuickDock,
    onOpenMonitorPicker,
    activeView = 'vtt',
    onToggleView,
    onSelectView
  }: { 
    onRoll?: ((result: number, label: string) => void) | null,
    onTogglePlayerHub?: (() => void) | null,
    onTogglePlayerManager?: (() => void) | null,
    onTogglePlayerMobileManager?: (() => void) | null,
    onTogglePlayerQuickDock?: (() => void) | null,
    onOpenMonitorPicker?: (() => void) | null,
    activeView?: string,
    onToggleView?: (() => void) | null,
    onSelectView?: ((view: 'vtt' | 'editor' | 'graph' | 'timeline' | 'calendar') => void) | null
  } = $props();

  let playerViewOpen = $state(false);
  let playerViewMonitor = $state<number | null>(null);
  let showPlaylistModal = $state(false);
  let audioSearch = $state('');
  let targetAudioChannel = $state<1 | 2>(1);
  let audioFileInputRef = $state<HTMLInputElement>();

  async function handleAudioImport(e: Event, channel: 1 | 2 = 1) {
    const target = e.target as HTMLInputElement;
    if (!target.files || !target.files[0]) return;
    const file = target.files[0];
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataUrl = evt.target?.result as string;
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
          if (channel === 1) selectAudio(relPath);
          else { updateGmAudio2(relPath); showAudio2Picker = false; }
          notifStore.add('🎵', 'Musique importée', `« ${file.name} » enregistrée dans assets/audio et lancée !`, 'success', 3500);
          return;
        } catch (err) {
          console.warn("Échec d'enregistrement direct dans assets/audio, lecture en flux direct :", err);
        }
      }

      // Fallback : jouer directement via le DataURL
      if (channel === 1) selectAudio(dataUrl);
      else { updateGmAudio2(dataUrl); showAudio2Picker = false; }
      notifStore.add('🎵', 'Musique lancée', `« ${file.name} » en cours de lecture !`, 'success', 3000);
    };
    reader.readAsDataURL(file);
    target.value = '';
  }

  async function updatePlayerViewStatus() {
    try {
      const status = await getPlayerViewStatus();
      playerViewOpen = status.is_open;
      playerViewMonitor = status.current_monitor_index;
    } catch {}
  }

  onMount(() => {
    updatePlayerViewStatus();
    const interval = setInterval(updatePlayerViewStatus, 2500);
    return () => clearInterval(interval);
  });

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
  let showTokenEditor = $state(false);
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
  let herboriste: any = $state();
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
  let showSfxSoundboard = $state(false);
  let showBackupModal = $state(false);
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
        if (ext === 'mp3' || ext === 'wav' || ext === 'ogg' || ext === 'm4a' || ext === 'flac' || ext === 'aac' || ext === 'opus' || ext === 'webm') {
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

  function handleGlobalClick(e: MouseEvent) {
    if (!activeMenu) return;
    const target = e.target as HTMLElement | null;
    if (toolbarEl && toolbarEl.contains(target)) {
      return;
    }
    activeMenu = null;
  }
</script>

<svelte:window onkeydown={handleKeydown} onclick={handleGlobalClick} />

<div class="vtt-toolbar menubar-style" bind:this={toolbarEl}>
  <!-- Navigation Espaces de Travail (VTT, Notes, Graphe...) intégrée pour supprimer la double-barre -->
  {#if onSelectView}
    <div class="workspace-pill-nav">
      <button 
        type="button"
        class="ws-pill" 
        class:active={activeView === 'vtt'} 
        onclick={() => onSelectView?.('vtt')}
        title="Table Virtuelle VTT (Raccourci: F2)"
      >
        🗺️ <span class="ws-label">VTT</span>{#if vttStore.tokens.length > 0}<span class="ws-badge">{vttStore.tokens.length}</span>{/if}
      </button>
      <button 
        type="button"
        class="ws-pill" 
        class:active={activeView === 'editor'} 
        onclick={() => onSelectView?.('editor')}
        title="Éditeur de Notes Markdown"
      >
        📄 <span class="ws-label">Notes</span>
      </button>
      <button type="button" class="ws-pill" class:active={activeView === 'graph'} onclick={() => onSelectView?.('graph')} title="Graphe des relations">
        🕸️ <span class="ws-label">Graphe</span>
      </button>
      <button type="button" class="ws-pill" class:active={activeView === 'timeline'} onclick={() => onSelectView?.('timeline')} title="Chronologie">
        📜 <span class="ws-label">Chrono</span>
      </button>
      <button type="button" class="ws-pill" class:active={activeView === 'calendar'} onclick={() => onSelectView?.('calendar')} title="Calendrier">
        📅 <span class="ws-label">Calendrier</span>
      </button>
    </div>
  {/if}

  <div class="menubar-items">
    
    <!-- 1. Carte & Vue -->
    <div class="menu-dropdown" class:open={activeMenu === 'map'}>
      <button class="menu-btn" onclick={(e) => { e.stopPropagation(); activeMenu = activeMenu === 'map' ? null : 'map'; }} title="Gestion de la carte et de la vue">🗺️ Carte</button>
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
        <div class="dropdown-title">Gestion de Scène & Tokens</div>
        {#if vttStore.tokens.length > 0}
          <button class="dropdown-item text-danger" onclick={() => { if (window.confirm(`Retirer l'intégralité des ${vttStore.tokens.length} token(s) de la table ?`)) { clearGmTokens(); activeMenu = null; } }}>
            🧹 Retirer tous les tokens ({vttStore.tokens.length})
          </button>
        {/if}
        {#if vttStore.spells.length > 0}
          <button class="dropdown-item text-danger" onclick={() => { clearSpells(); activeMenu = null; }}>
            🧹 Retirer tous les sorts ({vttStore.spells.length})
          </button>
        {/if}
        <button class="dropdown-item text-danger" onclick={() => { if (window.confirm('Réinitialiser la table (vider tous les tokens, le brouillard, les sorts et les dessins) ?')) { resetVttScene(false); activeMenu = null; } }}>
          🔄 Réinitialiser la scène
        </button>
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
        <button class="dropdown-item" class:active={vttStore.showFps} onclick={() => { toggleShowFps(); activeMenu = null; }}>
          ⚡ {vttStore.showFps ? 'Masquer le Compteur FPS' : 'Afficher le Compteur FPS'}
        </button>
        <div class="dropdown-divider"></div>
        <button class="dropdown-item" onclick={() => { onOpenMonitorPicker?.(); activeMenu = null; }}>
          🖥️ Multi-Écran (Vue Joueurs / TV)…
        </button>
      </div>
    </div>

    <!-- 1bis. Menu Fonctions & Affichage (Interrupteurs Modules) -->
    <div class="menu-dropdown" class:open={activeMenu === 'modules'}>
      <button class="menu-btn" onclick={(e) => { e.stopPropagation(); activeMenu = activeMenu === 'modules' ? null : 'modules'; }} title="Activer / Désactiver les fenêtres et modules VTT">
        🎛️ Modules
      </button>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="dropdown-content" class:hidden={activeMenu !== 'modules'} onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1" style="min-width: 290px;">
        <div class="dropdown-title">Fenêtres Flottantes & HUDs</div>
        
        <div class="module-toggle-row" onclick={() => sceneRunnerStore.toggle()}>
          <div class="module-info">
            <span class="module-icon">🎬</span>
            <span class="module-name">Dérouleur de Scènes</span>
          </div>
          <span class="module-switch" class:active={sceneRunnerStore.isOpen}>
            {sceneRunnerStore.isOpen ? 'ACTIF' : 'OFF'}
          </span>
        </div>

        <div class="module-toggle-row" onclick={() => vttStore.showPlayerQuickDock = !vttStore.showPlayerQuickDock}>
          <div class="module-info">
            <span class="module-icon">👥</span>
            <span class="module-name">Volet Joueurs Express</span>
          </div>
          <span class="module-switch" class:active={vttStore.showPlayerQuickDock}>
            {vttStore.showPlayerQuickDock ? 'ACTIF' : 'OFF'}
          </span>
        </div>

        <div class="module-toggle-row" onclick={() => onTogglePlayerMobileManager?.()}>
          <div class="module-info">
            <span class="module-icon">📱</span>
            <span class="module-name">Hub Joueurs Mobiles & QR</span>
          </div>
          <span class="module-switch" class:active={mobileServerStore.isRunning}>
            {mobileServerStore.isRunning ? 'EN LIGNE' : 'OUVRIR'}
          </span>
        </div>

        <div class="module-toggle-row" onclick={() => { if (vttStore.combatActive) stopCombat(); else startCombat(); }}>
          <div class="module-info">
            <span class="module-icon">⚔️</span>
            <span class="module-name">Suivi de Combat (Initiative)</span>
          </div>
          <span class="module-switch" class:active={vttStore.combatActive}>
            {vttStore.combatActive ? 'ACTIF' : 'OFF'}
          </span>
        </div>

        <div class="module-toggle-row" onclick={() => vttStore.showGmNotes = !vttStore.showGmNotes}>
          <div class="module-info">
            <span class="module-icon">📝</span>
            <span class="module-name">Tiroir Notes MJ</span>
          </div>
          <span class="module-switch" class:active={vttStore.showGmNotes}>
            {vttStore.showGmNotes ? 'ACTIF' : 'OFF'}
          </span>
        </div>

        <div class="module-toggle-row" onclick={() => vttStore.showMacroBar = !vttStore.showMacroBar}>
          <div class="module-info">
            <span class="module-icon">🎲</span>
            <span class="module-name">Barre de Macros Dés (Bas)</span>
          </div>
          <span class="module-switch" class:active={vttStore.showMacroBar}>
            {vttStore.showMacroBar ? 'ACTIF' : 'OFF'}
          </span>
        </div>

        <div class="module-toggle-row" onclick={toggleMinimap}>
          <div class="module-info">
            <span class="module-icon">🗺️</span>
            <span class="module-name">Mini-carte VTT (Minimap)</span>
          </div>
          <span class="module-switch" class:active={vttStore.showMinimap}>
            {vttStore.showMinimap ? 'ACTIF' : 'OFF'}
          </span>
        </div>

        <div class="dropdown-divider"></div>
        <div class="dropdown-title">Pions & Tokens</div>

        <div class="module-toggle-row" onclick={toggleTokenNames}>
          <div class="module-info">
            <span class="module-icon">🏷️</span>
            <span class="module-name">Noms sous les Pions</span>
          </div>
          <span class="module-switch" class:active={vttStore.showTokenNames}>
            {vttStore.showTokenNames ? 'ACTIF' : 'OFF'}
          </span>
        </div>

        <div class="module-toggle-row" onclick={toggleTokenHpBars}>
          <div class="module-info">
            <span class="module-icon">💚</span>
            <span class="module-name">Barres de Vie (PV)</span>
          </div>
          <span class="module-switch" class:active={vttStore.showTokenHpBars}>
            {vttStore.showTokenHpBars ? 'ACTIF' : 'OFF'}
          </span>
        </div>

        <div class="module-toggle-row" onclick={toggleSnapToGrid}>
          <div class="module-info">
            <span class="module-icon">🧲</span>
            <span class="module-name">Aimantation Grille (Snap)</span>
          </div>
          <span class="module-switch" class:active={vttStore.snapToGrid}>
            {vttStore.snapToGrid ? 'ACTIF' : 'OFF'}
          </span>
        </div>

        <div class="module-toggle-row" onclick={toggleTokenAnimations}>
          <div class="module-info">
            <span class="module-icon">🏃</span>
            <span class="module-name">Animations Fluides (Lerp)</span>
          </div>
          <span class="module-switch" class:active={vttStore.tokenAnimations}>
            {vttStore.tokenAnimations ? 'ACTIF' : 'OFF'}
          </span>
        </div>

        <div class="dropdown-divider"></div>
        <div class="dropdown-title">Moteur de Carte & Ambiance</div>

        <div class="module-toggle-row" onclick={toggleGrid}>
          <div class="module-info">
            <span class="module-icon">#️⃣</span>
            <span class="module-name">Grille Magnétique</span>
          </div>
          <span class="module-switch" class:active={vttStore.showGrid}>
            {vttStore.showGrid ? 'ACTIF' : 'OFF'}
          </span>
        </div>

        <div class="module-toggle-row" onclick={toggleFow}>
          <div class="module-info">
            <span class="module-icon">🌫️</span>
            <span class="module-name">Brouillard de Guerre (FoW)</span>
          </div>
          <span class="module-switch" class:active={vttStore.fowEnabled}>
            {vttStore.fowEnabled ? 'ACTIF' : 'OFF'}
          </span>
        </div>

        <div class="module-toggle-row" onclick={() => vttStore.wallsEnabled = !vttStore.wallsEnabled}>
          <div class="module-info">
            <span class="module-icon">🧱</span>
            <span class="module-name">Murs & Vision Dynamique</span>
          </div>
          <span class="module-switch" class:active={vttStore.wallsEnabled}>
            {vttStore.wallsEnabled ? 'ACTIF' : 'OFF'}
          </span>
        </div>

        <div class="module-toggle-row" onclick={togglePins}>
          <div class="module-info">
            <span class="module-icon">📍</span>
            <span class="module-name">Épingles de Carte & Secrets</span>
          </div>
          <span class="module-switch" class:active={vttStore.showPins}>
            {vttStore.showPins ? 'ACTIF' : 'OFF'}
          </span>
        </div>

        <div class="module-toggle-row" onclick={toggleVignette}>
          <div class="module-info">
            <span class="module-icon">🎬</span>
            <span class="module-name">Vignette & Ombres Cinéma</span>
          </div>
          <span class="module-switch" class:active={vttStore.showVignette}>
            {vttStore.showVignette ? 'ACTIF' : 'OFF'}
          </span>
        </div>

        <div class="module-toggle-row" onclick={() => { vttStore.weather = vttStore.weather === 'none' ? 'rain' : 'none'; }}>
          <div class="module-info">
            <span class="module-icon">🌦️</span>
            <span class="module-name">Météo & Particules</span>
          </div>
          <span class="module-switch" class:active={vttStore.weather !== 'none'}>
            {vttStore.weather !== 'none' ? vttStore.weather.toUpperCase() : 'OFF'}
          </span>
        </div>

        <div class="module-toggle-row" onclick={toggleShowFps}>
          <div class="module-info">
            <span class="module-icon">⚡</span>
            <span class="module-name">Compteur FPS (Télémétrie)</span>
          </div>
          <span class="module-switch" class:active={vttStore.showFps}>
            {vttStore.showFps ? 'ACTIF' : 'OFF'}
          </span>
        </div>

        <div class="module-toggle-row" onclick={toggleBlackout}>
          <div class="module-info">
            <span class="module-icon">🕶️</span>
            <span class="module-name">Écran Noir Joueurs</span>
          </div>
          <span class="module-switch" class:active={vttStore.isBlackout}>
            {vttStore.isBlackout ? 'BLACKOUT' : 'NORMAL'}
          </span>
        </div>

        <div class="dropdown-divider"></div>
        <button class="dropdown-item" onclick={() => { onOpenMonitorPicker?.(); activeMenu = null; }}>
          🖥️ Multi-Écran (Vue Joueurs / TV)…
        </button>
      </div>
    </div>

    <!-- 2. Outils interactifs -->
    {#if vttStore.currentMap}
      <div class="menu-dropdown" class:open={activeMenu === 'tools'}>
        <button class="menu-btn" onclick={(e) => { e.stopPropagation(); activeMenu = activeMenu === 'tools' ? null : 'tools'; }}>🛠️ Outils</button>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div class="dropdown-content" class:hidden={activeMenu !== 'tools'} onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
          <button class="dropdown-item" class:active={vttStore.mode === 'select'} onclick={() => { vttStore.mode = 'select'; activeMenu = null; }}>👆 Sélectionner</button>
          <button class="dropdown-item" class:active={vttStore.mode === 'measure'} onclick={() => { vttStore.mode = 'measure'; activeMenu = null; }}>📏 Mesurer distance</button>
          <button class="dropdown-item" class:active={vttStore.mode === 'ping'} onclick={() => { vttStore.mode = 'ping'; activeMenu = null; }}>📍 Ping (Joueurs)</button>
          <button class="dropdown-item" class:active={vttStore.mode === 'pin'} onclick={() => { vttStore.mode = 'pin'; activeMenu = null; }}>📌 Épingle Permanente</button>
          {#if vttStore.pins.length > 0}
            <button class="dropdown-item text-danger" onclick={() => { clearGmPins(); activeMenu = null; }}>📌🗑️ Effacer épingles</button>
          {/if}
          
          <div class="dropdown-divider"></div>
          <div class="dropdown-title">Brouillard de Guerre</div>
          <button class="dropdown-item" class:active={!vttStore.fowEnabled} onclick={toggleFow}>🌫️ {vttStore.fowEnabled ? 'Désactiver' : 'Activer'} Brouillard</button>
          {#if vttStore.fowEnabled}
            <button class="dropdown-item" class:active={vttStore.mode === 'fog-reveal'} onclick={() => { vttStore.mode = 'fog-reveal'; activeMenu = null; }}>👁️ Révéler (Glisser)</button>
            <button class="dropdown-item" class:active={vttStore.mode === 'fog-hide'} onclick={() => { vttStore.mode = 'fog-hide'; activeMenu = null; }}>⬛ Cacher (Glisser)</button>
            <button class="dropdown-item" class:active={vttStore.mode === 'fog-rect'} onclick={() => { vttStore.mode = 'fog-rect'; activeMenu = null; }}>▭ Zone rectangulaire</button>
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
              <button class="mini-btn text-only" class:active={vttStore.spellShape === 'cube'} onclick={() => vttStore.spellShape = 'cube'}>🟦 Cube</button>
            </div>
            <div class="dropdown-submenu-item tools-row">
              {#if vttStore.spellShape === 'circle' || vttStore.spellShape === 'cube'}
                <input type="number" class="spell-radius-input" value={vttStore.spellRadius} min="20" max="400" step="10" title="Rayon / Côté (px)" onchange={(e) => vttStore.spellRadius = Number((e.target as HTMLInputElement).value)} />
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
          <button class="dropdown-item" style="color: #e6b450; font-weight: bold;" onclick={() => { showTokenEditor = true; activeMenu = null; }}>🪙 Éditeur de Tokens (Studio)</button>
          <button class="dropdown-item" onclick={() => { showTokenPicker = true; tokenPickerSearch = ''; activeMenu = null; }}>🖼️ Token image</button>
          <button class="dropdown-item" onclick={createTestToken}>👹 Token basique (test)</button>
        </div>
      </div>
    {/if}

    <!-- 3. Ambiance & Audio -->
    <div class="menu-dropdown align-right" class:open={activeMenu === 'audio'}>
      <button class="menu-btn" onclick={(e) => { e.stopPropagation(); activeMenu = activeMenu === 'audio' ? null : 'audio'; }}>🎭 Ambiance</button>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="dropdown-content" class:hidden={activeMenu !== 'audio'} onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
        <!-- Interrupteur Général Musique & Playlist -->
        <button 
          class="dropdown-item" 
          style="font-weight: 700; color: #f87171; background: rgba(239, 68, 68, 0.15);" 
          onclick={() => { stopAllAudiosGlobally(); activeMenu = null; }}
          title="Arrêt d'urgence : coupe net toutes les musiques, synthétiseurs de vent, pluie et sons d'ambiance"
        >
          🔇 Silence Total (Couper Tous les Sons)
        </button>
        <button 
          class="dropdown-item" 
          style="font-weight: 600; color: {playlistStore.isMusicEnabled ? '#34d399' : '#9ca3af'};" 
          onclick={() => { playlistStore.toggleMusic(); activeMenu = null; }}
        >
          {playlistStore.isMusicEnabled ? '🔊 Musique VTT : ACTIVE' : '🔈 Musique VTT : COUPÉE'}
        </button>
        <button 
          class="dropdown-item" 
          style="color: #a5b4fc; font-weight: 700;" 
          onclick={() => { showPlaylistModal = true; activeMenu = null; }}
        >
          📋 Gestionnaire de Playlists ({playlistStore.tracks.length} pistes)
        </button>
        <button 
          class="dropdown-item" 
          style="color: #fbbf24; font-weight: 700;" 
          onclick={() => { sessionIntroStore.open(); activeMenu = null; }}
        >
          🎬 Lecteur d'Intro de Soirée (MP3)
        </button>
        <button 
          class="dropdown-item" 
          style="color: #a5b4fc; font-weight: 700; background: rgba(99, 102, 241, 0.12); margin-top: 2px;" 
          onclick={() => { narrationStudioStore.open(); activeMenu = null; }}
        >
          🎙️ Studio de Narration & Voix IA
        </button>
        <div class="dropdown-divider"></div>

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
          {#each (['none','rain','snow','fog','embers','storm'] as const) as w}
            <button class="mini-btn" class:active={vttStore.weather === w} onclick={() => setWeather(w)} title={w}>{w === 'none' ? '☀️' : w === 'rain' ? '🌧️' : w === 'snow' ? '❄️' : w === 'fog' ? '🌫️' : w === 'embers' ? '🔥' : '🌩️'}</button>
          {/each}
        </div>
        <button class="dropdown-item" onclick={sendWeatherNarrative} title="Diffuse et prononce une description du climat actuel">
          🌦️ Envoyer narration météo {#if isNarratorVoiceEnabled}<span style="margin-left: auto; font-size: 11px; opacity: 0.8;">🗣️ Voix</span>{/if}
        </button>

        <div class="dropdown-divider"></div>
        <div class="dropdown-title">Effets Sonores SFX</div>
        <button class="dropdown-item" onclick={() => { showSfxSoundboard = !showSfxSoundboard; activeMenu = null; }}>
          🔊 {showSfxSoundboard ? 'Masquer le Soundboard SFX' : 'Ouvrir le Soundboard SFX (Pavé 1-8)'}
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
    <div class="menu-dropdown align-right" class:open={activeMenu === 'players'}>
      <button class="menu-btn" onclick={(e) => { e.stopPropagation(); activeMenu = activeMenu === 'players' ? null : 'players'; }}>👥 Joueurs</button>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="dropdown-content" class:hidden={activeMenu !== 'players'} onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
        <button class="dropdown-item" style="color:#fbbf24;font-weight:700" onclick={() => { onTogglePlayerQuickDock?.(); activeMenu = null; }}>➕ Nouveau Joueur…</button>
        <button class="dropdown-item" onclick={() => { onTogglePlayerQuickDock?.(); activeMenu = null; }}>🪟 Volet Joueurs Express (HUD)</button>
        <button class="dropdown-item" onclick={() => { onTogglePlayerManager?.(); activeMenu = null; }}>📝 Gestionnaire de Groupe</button>
        <button class="dropdown-item" onclick={() => { onTogglePlayerHub?.(); activeMenu = null; }}>📱 Hub des Joueurs</button>
        
        <div class="dropdown-divider"></div>
        <div class="dropdown-title">Serveur Mobile (iPad & Android)</div>
        <div class="mobile-menu-control-row">
          <div class="mobile-menu-status">
            <span class="mobile-status-dot" class:online={mobileServerStore.isRunning}></span>
            <span class="mobile-status-text">
              {mobileServerStore.starting ? 'Démarrage…' : mobileServerStore.isRunning ? `Actif (:${mobileServerStore.serverInfo?.port})` : 'Désactivé'}
            </span>
          </div>
          <button 
            class="mobile-menu-toggle-btn"
            class:active-btn={mobileServerStore.isRunning}
            onclick={async (e) => { e.stopPropagation(); await mobileServerStore.toggle(); }}
            disabled={mobileServerStore.starting}>
            {mobileServerStore.starting ? '⏳' : mobileServerStore.isRunning ? '⏹ Arrêter' : '🚀 Activer'}
          </button>
        </div>
        <button class="dropdown-item" onclick={() => { onTogglePlayerMobileManager?.(); activeMenu = null; }}>📲 QR Codes & Carnet MJ</button>
        
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

        {#if vttStore.tokens.length > 0}
          <div class="dropdown-divider"></div>
          <div class="dropdown-title">Nettoyage rapide tokens</div>
          {#if vttStore.tokens.some(t => t.isEnemy)}
            <button class="dropdown-item" style="color: #f87171;" onclick={() => { removeGmTokensByFilter(t => !!t.isEnemy); activeMenu = null; }}>
              💀 Retirer tous les ennemis ({vttStore.tokens.filter(t => t.isEnemy).length})
            </button>
          {/if}
          <button class="dropdown-item text-danger" onclick={() => { if (window.confirm(`Retirer tous les tokens (${vttStore.tokens.length}) de la table ?`)) { clearGmTokens(); activeMenu = null; } }}>
            🧹 Retirer tous les tokens de la table
          </button>
        {/if}
      </div>
    </div>

    <!-- 5. Outils du MJ -->
    <div class="menu-dropdown align-right" class:open={activeMenu === 'gm'}>
      <button class="menu-btn" onclick={(e) => { e.stopPropagation(); activeMenu = activeMenu === 'gm' ? null : 'gm'; }} title="Outils et générateurs du Maître du Jeu">🧙‍♂️ MJ</button>
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
        <button class="dropdown-item" style="color: #e6b450; font-weight: bold;" onclick={() => { showTokenEditor = true; activeMenu = null; }}>🪙 Éditeur de Tokens (Studio)</button>
        <button class="dropdown-item" onclick={() => { showAddonStore = true; activeMenu = null; }}>🌌 Bibliothèque Céleste (Cartes, Audio, PDF)</button>
        <button class="dropdown-item" onclick={() => { showSharedLibrary = true; activeMenu = null; }}>📚 Bibliothèque partagée</button>
        
        <button class="dropdown-item" onclick={() => { charCreator?.toggle(); activeMenu = null; }}>⚔️ Créateur de personnage</button>
        <button class="dropdown-item" onclick={() => { soundBoard?.toggle(); activeMenu = null; }}>🎹 SoundBoard</button>
        <button class="dropdown-item" onclick={() => { monsterLib?.toggle(); activeMenu = null; }}>🐉 Monstres</button>
        <button class="dropdown-item" onclick={() => { herboriste?.toggle(); activeMenu = null; }}>🌿 Guide de l'Herboriste</button>
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
    <button class="btn icon-btn" class:active={vttStore.mode === 'measure'}
      onclick={() => vttStore.mode = vttStore.mode === 'measure' ? 'select' : 'measure'}
      title="Règle de mesure (Raccourci: M)">
      📏
    </button>
    <button class="btn icon-btn" 
      onclick={() => {
        const weathers: ('none' | 'rain' | 'snow' | 'fog' | 'embers' | 'storm')[] = ['none', 'rain', 'snow', 'fog', 'embers', 'storm'];
        const curIdx = weathers.indexOf(vttStore.weather as any);
        const nextW = weathers[(curIdx + 1) % weathers.length];
        setWeather(nextW);
      }}
      title={`Météo : ${vttStore.weather} (Raccourci: W)`}>
      {vttStore.weather === 'none' ? '☀️' : vttStore.weather === 'rain' ? '🌧️' : vttStore.weather === 'snow' ? '❄️' : vttStore.weather === 'fog' ? '🌫️' : vttStore.weather === 'embers' ? '🔥' : '🌩️'}
    </button>
    <button class="btn icon-btn combat-btn" class:active={vttStore.combatActive}
      onclick={() => vttStore.combatActive ? stopCombat() : startCombat()}
      title={vttStore.combatActive ? 'Terminer le combat' : 'Démarrer le tracker de combat'}>
      ⚔️
    </button>
    <button class="token-quick-btn" onclick={() => showTokenEditor = true} title="Éditeur de Tokens Grimoire">
      🪙
    </button>
    <button class="soundscape-quick-btn" class:active-sound={soundscape.activeTracksCount > 0}
      onclick={() => showSoundscapeMixer = true}
      title="Mixeur d'Ambiances Sonores">
      🌧️{#if soundscape.activeTracksCount > 0}<span class="sound-badge">{soundscape.activeTracksCount}</span>{/if}
    </button>
    <button class="sfx-quick-btn" class:active-sound={showSfxSoundboard}
      onclick={() => showSfxSoundboard = !showSfxSoundboard}
      title="Soundboard SFX (Pavé 1-8)">
      🔊
    </button>
    <button class="intro-quick-btn" class:active-intro={sessionIntroStore.isOpen || sessionIntroStore.isPlaying}
      onclick={() => sessionIntroStore.toggle()}
      title="Lecteur d'Intro de Soirée (MP3 cinématique)">
      🎬{#if sessionIntroStore.isPlaying}▶️{/if}
    </button>
    <!-- Widget Musique & Playlist -->
    <div class="music-quick-cluster">
      <button 
        class="music-quick-btn" 
        class:is-playing={playlistStore.isPlaying && playlistStore.isMusicEnabled}
        class:is-disabled={!playlistStore.isMusicEnabled}
        onclick={() => showPlaylistModal = true}
        title={!playlistStore.isMusicEnabled ? "Musique désactivée (ouvrir Playlist)" : playlistStore.currentTrack ? `En cours : ${playlistStore.currentTrack.name}` : "Ouvrir la Playlist VTT"}
      >
        <span class="music-icon">{!playlistStore.isMusicEnabled ? '🔇' : playlistStore.isPlaying ? '▶️' : '🎵'}</span>
      </button>

      {#if playlistStore.isMusicEnabled && (playlistStore.isPlaying || playlistStore.currentTrack)}
        <button 
          class="music-sub-btn stop" 
          onclick={(e) => { e.stopPropagation(); playlistStore.disableMusic(); }}
          title="Couper la musique immédiatement (⏹️)"
        >
          ⏹️
        </button>
        <button 
          class="music-sub-btn next" 
          onclick={(e) => { e.stopPropagation(); playlistStore.nextTrack(); }}
          title="Morceau suivant (⏭️)"
        >
          ⏭️
        </button>
      {:else}
        <button 
          class="music-sub-btn play" 
          onclick={(e) => { e.stopPropagation(); playlistStore.enableMusic(); }}
          title="Activer et lancer la musique (▶️)"
        >
          ▶️
        </button>
      {/if}
    </div>
    <button class="backup-quick-btn" onclick={() => showBackupModal = true} title="Sauvegarder et exporter la campagne (.grimoire)">
      💾
    </button>
    <div class="mobile-quick-group">
      <button class="mobile-quick-btn" class:active-server={mobileServerStore.isRunning}
        onclick={() => onTogglePlayerMobileManager?.()}
        title="Ouvrir le Hub Mobile & Carnet MJ (iPad / Android)">
        <span class="mobile-status-dot" class:online={mobileServerStore.isRunning}></span>
        📱
        {#if mobileServerStore.playerCount > 0}
          <span class="mobile-badge">{mobileServerStore.playerCount}</span>
        {/if}
      </button>
      <button 
        class="mobile-quick-toggle"
        class:is-on={mobileServerStore.isRunning}
        onclick={async (e) => { e.stopPropagation(); await mobileServerStore.toggle(); }}
        disabled={mobileServerStore.starting}
        title={mobileServerStore.isRunning ? 'Désactiver le serveur mobile' : 'Activer le serveur mobile'}>
        {mobileServerStore.starting ? '⏳' : mobileServerStore.isRunning ? 'ON' : 'OFF'}
      </button>
    </div>
    <!-- Bouton Multi-Écran / Vue Joueurs -->
    <button 
      class="player-screen-quick-btn" 
      class:active-screen={playerViewOpen}
      onclick={() => onOpenMonitorPicker?.()}
      title="Gérer le multi-écran : projeter la vue joueurs sur votre 2ème écran (TV, vidéo-projecteur)"
    >
      <span class="screen-status-dot" class:online={playerViewOpen}></span>
      🖥️
      {#if playerViewOpen && playerViewMonitor !== null}
        <span class="screen-badge">{playerViewMonitor + 1}</span>
      {/if}
    </button>
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
  <HerboristeModal bind:this={herboriste} />
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
{#if showSfxSoundboard}
  <div class="sfx-floating-wrap">
    <SfxSoundboard onClose={() => showSfxSoundboard = false} />
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
{#if showBackupModal}<CampaignBackupModal onclose={() => showBackupModal = false} />{/if}

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

<!-- Input file masqué pour l'import de musique depuis le PC -->
<input 
  type="file" 
  accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.opus,.webm" 
  bind:this={audioFileInputRef} 
  onchange={(e) => handleAudioImport(e, targetAudioChannel)} 
  style="display:none" 
/>

<!-- Sélecteur d'audio (Piste 1) -->
{#if showAudioPicker}
  {@const allAudios = getAllAudio(getVaultTree())}
  {@const filteredAudios = audioSearch.trim() ? allAudios.filter(a => a.name.toLowerCase().includes(audioSearch.toLowerCase()) || a.path.toLowerCase().includes(audioSearch.toLowerCase())) : allAudios}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="picker-backdrop" onclick={() => { showAudioPicker = false; audioSearch = ''; }} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="picker-modal" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
      <div class="picker-header">
        <span>🎵 Ambiance Sonore (Piste 1)</span>
        <button class="picker-close" onclick={() => { showAudioPicker = false; audioSearch = ''; }}>✕</button>
      </div>

      <div class="audio-picker-actions">
        <button 
          class="audio-import-btn" 
          onclick={() => { targetAudioChannel = 1; audioFileInputRef?.click(); }}
        >
          ➕ Importer un fichier Audio (depuis votre PC)
        </button>
        {#if vttStore.audioSrc}
          <button class="audio-stop-btn" onclick={() => { stopAudio(); showAudioPicker = false; }}>
            ⏹️ Arrêter la Piste 1
          </button>
        {/if}
      </div>

      <div class="audio-search-box">
        <input 
          type="text" 
          class="audio-search-input" 
          placeholder="Rechercher une musique..." 
          bind:value={audioSearch} 
        />
        <button class="audio-celestial-link" onclick={() => { showAddonStore = true; showAudioPicker = false; }}>
          🌌 Bibliothèque Céleste (+800)
        </button>
      </div>

      <div class="picker-list">
        {#if filteredAudios.length === 0}
          <div class="picker-empty">
            {allAudios.length === 0 ? "Aucun fichier audio dans le vault. Cliquez sur 'Importer' ci-dessus pour en ajouter !" : "Aucune musique trouvée pour cette recherche."}
          </div>
        {:else}
          {#each filteredAudios as aud}
            <button class="picker-item" class:active-item={vttStore.audioSrc === aud.path} onclick={() => { selectAudio(aud.path); audioSearch = ''; }}>
              <span class="picker-icon">{vttStore.audioSrc === aud.path ? '▶️' : '🎶'}</span>
              <span class="picker-name">{aud.name}</span>
              <span class="picker-path">{aud.path}</span>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Sélecteur d'audio (Piste 2) -->
{#if showAudio2Picker}
  {@const allAudios = getAllAudio(getVaultTree())}
  {@const filteredAudios = audioSearch.trim() ? allAudios.filter(a => a.name.toLowerCase().includes(audioSearch.toLowerCase()) || a.path.toLowerCase().includes(audioSearch.toLowerCase())) : allAudios}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="picker-backdrop" onclick={() => { showAudio2Picker = false; audioSearch = ''; }}>
    <div class="picker-modal" onclick={e => e.stopPropagation()}>
      <div class="picker-header">
        <span>🎶 Ambiance Sonore — Piste 2</span>
        <button class="picker-close" onclick={() => { showAudio2Picker = false; audioSearch = ''; }}>✕</button>
      </div>

      <div class="audio-picker-actions">
        <button 
          class="audio-import-btn" 
          onclick={() => { targetAudioChannel = 2; audioFileInputRef?.click(); }}
        >
          ➕ Importer un fichier Audio (depuis votre PC)
        </button>
        {#if vttStore.audio2Src}
          <button class="audio-stop-btn" onclick={() => { stopAudio2(); showAudio2Picker = false; }}>
            ⏹️ Arrêter la Piste 2
          </button>
        {/if}
      </div>

      <div class="audio-search-box">
        <input 
          type="text" 
          class="audio-search-input" 
          placeholder="Rechercher une musique..." 
          bind:value={audioSearch} 
        />
        <button class="audio-celestial-link" onclick={() => { showAddonStore = true; showAudio2Picker = false; }}>
          🌌 Bibliothèque Céleste (+800)
        </button>
      </div>

      <div class="picker-list">
        {#if filteredAudios.length === 0}
          <div class="picker-empty">
            {allAudios.length === 0 ? "Aucun fichier audio dans le vault. Cliquez sur 'Importer' ci-dessus pour en ajouter !" : "Aucune musique trouvée pour cette recherche."}
          </div>
        {:else}
          {#each filteredAudios as aud}
            <button class="picker-item" class:active-item={vttStore.audio2Src === aud.path} onclick={() => { updateGmAudio2(aud.path); showAudio2Picker = false; audioSearch = ''; }}>
              <span class="picker-icon">{vttStore.audio2Src === aud.path ? '▶️' : '🎶'}</span>
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
<TokenEditorModal isOpen={showTokenEditor} onclose={() => showTokenEditor = false} />
<PlaylistModal isOpen={showPlaylistModal} onclose={() => showPlaylistModal = false} onOpenCelestial={() => showAddonStore = true} />

<style>
  
  /* Menubar UI */
  .menubar-style {
    position: relative;
    z-index: 1000;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border);
    padding: 0 8px;
    height: 40px;
    flex-shrink: 0;
    gap: 6px;
    overflow: visible !important;
    container: vtt-toolbar / inline-size;
  }

  /* ── Sélecteur d'Espace de Travail Unifié ── */
  .workspace-pill-nav {
    display: flex;
    align-items: center;
    background: var(--bg-primary);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 2px;
    gap: 1px;
    flex-shrink: 0;
  }
  .ws-pill {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }
  .ws-pill:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.06);
  }
  .ws-pill.active {
    background: var(--accent, #e5a853);
    color: #000;
    font-weight: 700;
  }
  .ws-badge {
    background: rgba(0, 0, 0, 0.25);
    color: inherit;
    font-size: 9px;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 10px;
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
    font-size: 12px;
    font-weight: 500;
    padding: 4px 7px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 3px;
  }
  .menu-btn:hover { background: rgba(255,255,255,0.08); color: var(--text-primary); }
  .menu-dropdown.open .menu-btn { background: rgba(255,255,255,0.12); color: var(--accent); }

  .dropdown-content {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 240px;
    max-width: min(420px, 90vw);
    max-height: calc(100vh - 48px);
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.6);
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    z-index: 2500;
    pointer-events: auto;
    animation: slideDown 0.1s ease-out;
  }
  .dropdown-content.hidden { display: none !important; }

  /* Alignement à droite pour les dropdowns de droite : ne déborde jamais de l'écran */
  .menu-dropdown.align-right .dropdown-content {
    left: auto;
    right: 0;
  }

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
    pointer-events: auto;
    position: relative;
    z-index: 1;
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

  /* ── Rangees Interrupteurs Modules ── */
  .module-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    margin: 2px 4px;
    border-radius: 6px;
    cursor: pointer;
    pointer-events: auto;
    transition: background 0.15s ease;
    user-select: none;
  }
  .module-toggle-row:hover {
    background: var(--bg-hover);
  }
  .module-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-primary);
  }
  .module-icon {
    font-size: 13px;
    width: 18px;
    text-align: center;
  }
  .module-name {
    font-weight: 500;
  }
  .module-switch {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 12px;
    background: rgba(255,255,255,0.06);
    border: 1px solid var(--border);
    color: var(--text-muted);
    transition: all 0.2s ease;
    min-width: 48px;
    text-align: center;
  }
  .module-switch.active {
    background: rgba(34, 197, 94, 0.18);
    border-color: rgba(34, 197, 94, 0.5);
    color: #4ade80;
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.2);
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
    gap: 4px;
  }

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
    font-size: 13px;
    font-weight: 600;
    padding: 2px 6px;
    height: 26px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
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
  .sfx-quick-btn {
    background: #141d2b;
    border: 1px solid #1e293b;
    color: #94a3b8;
    font-size: 13px;
    font-weight: 600;
    padding: 2px 6px;
    height: 26px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }
  .sfx-quick-btn:hover,
  .sfx-quick-btn.active-sound {
    background: rgba(229, 168, 83, 0.2);
    color: #e5a853;
    border-color: #e5a853;
    box-shadow: 0 0 8px rgba(229, 168, 83, 0.4);
  }
  .backup-quick-btn {
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.35);
    color: #6ee7b7;
    font-size: 13px;
    font-weight: 600;
    padding: 2px 6px;
    height: 26px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }
  .backup-quick-btn:hover {
    background: rgba(16, 185, 129, 0.25);
    color: #a7f3d0;
    border-color: #10b981;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.35);
  }
  .sfx-floating-wrap {
    position: fixed;
    top: 56px;
    right: 20px;
    z-index: 9500;
    width: 320px;
  }
  .mobile-quick-group {
    display: flex;
    align-items: center;
    background: rgba(229,168,83,0.08);
    border: 1px solid rgba(229,168,83,0.3);
    border-radius: 4px;
    padding: 1px 2px;
    gap: 3px;
    transition: all 0.2s;
  }
  .mobile-quick-group:hover {
    border-color: var(--accent);
    background: rgba(229,168,83,0.15);
  }
  .mobile-quick-btn {
    background: transparent;
    border: none;
    color: var(--accent);
    font-size: 11px;
    font-weight: 700;
    padding: 2px 5px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .mobile-quick-toggle {
    font-size: 9px;
    font-weight: 800;
    padding: 2px 5px;
    border-radius: 3px;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
    background: rgba(255,255,255,0.08);
    color: #94a3b8;
  }
  .mobile-quick-toggle.is-on {
    background: #22c55e;
    color: #022c22;
    box-shadow: 0 0 6px rgba(34, 197, 94, 0.4);
  }
  .mobile-quick-toggle:hover:not(:disabled) {
    transform: scale(1.05);
  }
  .mobile-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #64748b;
    display: inline-block;
    transition: all 0.3s;
  }
  .mobile-status-dot.online {
    background: #22c55e;
    box-shadow: 0 0 7px #22c55e;
  }
  .mobile-badge {
    background: var(--accent);
    color: #000;
    font-size: 9px;
    font-weight: 800;
    padding: 0 4px;
    border-radius: 8px;
  }
  .player-screen-quick-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #e5e7eb;
    font-size: 13px;
    font-weight: 700;
    padding: 2px 6px;
    height: 26px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    transition: all 0.2s;
  }
  .player-screen-quick-btn:hover {
    background: rgba(229, 168, 83, 0.15);
    border-color: rgba(229, 168, 83, 0.4);
    color: #e5a853;
  }
  .player-screen-quick-btn.active-screen {
    background: rgba(34, 197, 94, 0.12);
    border-color: rgba(34, 197, 94, 0.35);
    color: #86efac;
  }
  .screen-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #64748b;
    display: inline-block;
    transition: all 0.3s;
  }
  .screen-status-dot.online {
    background: #22c55e;
    box-shadow: 0 0 7px #22c55e;
  }
  .screen-badge {
    background: #22c55e;
    color: #022c22;
    font-size: 9px;
    font-weight: 800;
    padding: 1px 4px;
    border-radius: 4px;
  }
  .mobile-menu-control-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 8px;
    margin: 3px 6px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    gap: 8px;
  }
  .mobile-menu-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-secondary);
  }
  .mobile-menu-toggle-btn {
    padding: 3px 8px;
    font-size: 10px;
    font-weight: 700;
    border-radius: 4px;
    cursor: pointer;
    border: 1px solid rgba(34, 197, 94, 0.4);
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    transition: all 0.2s;
  }
  .mobile-menu-toggle-btn.active-btn {
    border-color: rgba(239, 68, 68, 0.4);
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }
  .mobile-menu-toggle-btn:hover:not(:disabled) {
    filter: brightness(1.15);
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
  .token-quick-btn {
    background: linear-gradient(135deg, rgba(230, 180, 80, 0.2) 0%, rgba(184, 134, 11, 0.25) 100%);
    border: 1px solid rgba(230, 180, 80, 0.5);
    color: #ffd700;
    font-size: 13px;
    font-weight: 700;
    padding: 2px 6px;
    height: 26px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    margin-left: 2px;
  }
  .token-quick-btn:hover {
    background: linear-gradient(135deg, rgba(230, 180, 80, 0.35) 0%, rgba(184, 134, 11, 0.4) 100%);
    border-color: #ffd700;
    transform: translateY(-1px);
    box-shadow: 0 0 10px rgba(230, 180, 80, 0.3);
  }



  /* ── Actions & Recherche Modal Audio ── */
  .audio-picker-actions {
    display: flex;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .audio-import-btn {
    flex: 1;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.35) 100%);
    border: 1px solid #10b981;
    color: #a7f3d0;
    font-size: 11px;
    font-weight: 700;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .audio-import-btn:hover {
    background: #10b981;
    color: #000;
  }
  .audio-stop-btn {
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid #ef4444;
    color: #fca5a5;
    font-size: 11px;
    font-weight: 600;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .audio-stop-btn:hover {
    background: #ef4444;
    color: #fff;
  }
  .audio-search-box {
    display: flex;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(0, 0, 0, 0.25);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .audio-search-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #fff;
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 11px;
  }
  .audio-celestial-link {
    background: rgba(147, 51, 234, 0.2);
    border: 1px solid #a855f7;
    color: #d8b4fe;
    font-size: 10px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.12s;
  }
  .audio-celestial-link:hover {
    background: #a855f7;
    color: #fff;
  }
  .picker-item.active-item {
    background: rgba(16, 185, 129, 0.2);
    border-color: #10b981;
  }
  .picker-item.active-item .picker-name {
    color: #34d399;
    font-weight: 700;
  }

  /* Bouton Intro de Soirée */
  .intro-quick-btn {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid #d97706;
    color: #fde68a;
    font-size: 13px;
    font-weight: 700;
    padding: 2px 6px;
    height: 26px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .intro-quick-btn:hover {
    background: rgba(245, 158, 11, 0.3);
    border-color: #f59e0b;
    box-shadow: 0 0 10px rgba(245, 158, 11, 0.35);
  }

  .intro-quick-btn.active-intro {
    background: #d97706;
    color: #ffffff;
    box-shadow: 0 0 12px rgba(245, 158, 11, 0.5);
  }

  /* Widget Musique & Playlist rapide */
  .music-quick-cluster {
    display: flex;
    align-items: center;
    background: rgba(20, 24, 38, 0.95);
    border: 1px solid #2e344a;
    border-radius: 6px;
    padding: 1px 3px;
    gap: 3px;
  }

  .music-quick-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    background: transparent;
    border: none;
    color: #cbd5e1;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 6px;
    border-radius: 4px;
    cursor: pointer;
    max-width: 140px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: all 0.15s;
  }

  .music-quick-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .music-quick-btn.is-playing {
    color: #a5b4fc;
    font-weight: 700;
  }

  .music-quick-btn.is-disabled {
    color: #f87171;
    opacity: 0.85;
  }



  .music-sub-btn {
    background: #252b3d;
    border: 1px solid #3b4259;
    color: #cbd5e1;
    border-radius: 4px;
    padding: 2px 5px;
    font-size: 10px;
    cursor: pointer;
    transition: all 0.12s;
  }

  .music-sub-btn:hover {
    background: #333a52;
    color: #ffffff;
  }

  .music-sub-btn.stop:hover {
    background: #ef4444;
    border-color: #f87171;
  }

  .music-sub-btn.play {
    background: rgba(16, 185, 129, 0.2);
    border-color: #10b981;
    color: #34d399;
  }

  .music-sub-btn.play:hover {
    background: #10b981;
    color: #ffffff;
  }

  .icon-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-primary);
    font-size: 13px;
    padding: 2px 6px;
    height: 26px;
    border-radius: 4px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }
  .icon-btn:hover {
    background: var(--bg-hover);
    border-color: var(--accent);
  }
  .icon-btn.active {
    background: rgba(229, 168, 83, 0.2);
    border-color: var(--accent);
    color: var(--accent);
  }
  .combat-btn.active {
    background: rgba(239, 68, 68, 0.2);
    border-color: #ef4444;
    color: #f87171;
  }

  /* ── Responsive basé sur la largeur réelle de la barre (et non de la fenêtre,
        qui inclut la barre latérale) ── */
  @container vtt-toolbar (max-width: 1320px) {
    .ws-label {
      display: none;
    }
    .menu-btn {
      font-size: 11px;
      padding: 4px 6px;
    }
    .menubar-items {
      gap: 2px;
    }
    .workspace-pill-nav {
      padding: 1px;
    }
    .ws-pill {
      padding: 2px 6px;
      font-size: 10px;
    }
  }

  @container vtt-toolbar (max-width: 1040px) {
    .menu-btn {
      padding: 4px 4px;
      font-size: 10px;
    }
    .toolbar-permanent {
      gap: 2px;
    }
  }

  @container vtt-toolbar (max-width: 940px) {
    .menu-btn {
      padding: 4px 2px;
    }
    .toolbar-permanent {
      gap: 1px;
    }
    .toolbar-permanent > :global(*) {
      padding-left: 2px;
      padding-right: 2px;
    }
  }

  @media (max-width: 1300px) {
    .menubar-style {
      gap: 3px;
      padding: 0 4px;
    }
  }
</style>
