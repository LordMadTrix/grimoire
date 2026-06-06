<script lang="ts">
  import SharedLibrary from './SharedLibrary.svelte';
  import { emitToPlayerView, readFileBase64, readFile } from '$lib/api';
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
  } from '$lib/stores/vtt.svelte';
  import type { VaultEntry } from '$lib/api';
  import SoundBoard from './SoundBoard.svelte';
  import MonsterLibrary from './MonsterLibrary.svelte';
  import SessionExport from './SessionExport.svelte';
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
  let showHandoutPicker = $state(false);
  let showTokenPicker = $state(false);
  let showSharedLibrary = $state(false);
  let mapPickerSearch = $state('');
  let tokenPickerSearch = $state('');
  let ambientTextInput = $state('');

  // Countdown
  let showCountdownPicker = $state(false);
  let countdownSecs = $state(30);

  $effect(() => {
    if (vttStore.countdownEnd === null && showCountdownPicker) { /* keep open */ }
  });

  function handleCountdown() {
    if (vttStore.countdownEnd !== null) { stopCountdown(); }
    else { startCountdown(countdownSecs); showCountdownPicker = false; }
  }

  // Narration météo
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
    sendAmbientText(list[Math.floor(Math.random() * list.length)]);
  }

  // NPC
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

<svelte:window onkeydown={handleKeydown} />

<div class="vtt-toolbar" bind:this={toolbarEl}>
  <!-- Ligne 1 : outils VTT (uniquement si carte chargée) -->
  {#if vttStore.currentMap}
    <div class="toolbar-row">
    <div class="tools-group">
      <button class="btn icon-btn" class:active={vttStore.mode === 'select'}    onclick={() => vttStore.mode = 'select'}    title="Sélectionner">👆</button>
      <button class="btn icon-btn" class:active={vttStore.mode === 'fog-reveal'} onclick={() => vttStore.mode = 'fog-reveal'} title="Révéler zone (glisser)">👁️</button>
      <button class="btn icon-btn" class:active={vttStore.mode === 'fog-hide'}   onclick={() => vttStore.mode = 'fog-hide'}   title="Cacher zone (glisser)">⬛</button>
      <button class="btn icon-btn" class:active={vttStore.mode === 'fog-rect'}   onclick={() => vttStore.mode = 'fog-rect'}   title="Zone rectangulaire">▭</button>
      <button class="btn icon-btn" class:active={!vttStore.fowEnabled} onclick={toggleFow} title={vttStore.fowEnabled ? 'Désactiver le brouillard de guerre' : 'Activer le brouillard de guerre'}>🌫️</button>
      <button class="btn icon-btn" onclick={revealAllGmFow} title="Tout révéler">🌅</button>
      <button class="btn icon-btn" onclick={clearGmFow}    title="Tout cacher">🌑</button>
      <button class="btn icon-btn" class:active={vttStore.mode === 'measure'}    onclick={() => vttStore.mode = 'measure'}    title="Mesurer une distance">📏</button>
      <button class="btn icon-btn" class:active={vttStore.mode === 'ping'}       onclick={() => vttStore.mode = 'ping'}       title="Ping (marqueur temporaire joueurs)">📍</button>
      <button class="btn icon-btn" class:active={vttStore.mode === 'pin'}        onclick={() => vttStore.mode = 'pin'}        title="Épingle permanente">📌</button>
      <button class="btn icon-btn" class:active={vttStore.mode === 'spell'}      onclick={() => vttStore.mode = 'spell'}      title="Zone de sort">💫</button>
      <button class="btn icon-btn" class:active={vttStore.mode === 'draw'}       onclick={() => vttStore.mode = 'draw'}       title="Dessin libre">✏️</button>
      {#if vttStore.mode === 'draw'}
        <input type="color" class="draw-color-input" title="Couleur du tracé"
          value={'#' + vttStore.drawColor.toString(16).padStart(6, '0')}
          oninput={(e) => { vttStore.drawColor = parseInt((e.target as HTMLInputElement).value.slice(1), 16); }} />
        <input type="range" class="draw-width-input" min="2" max="20" step="1" value={vttStore.drawWidth} title="Épaisseur"
          oninput={(e) => { vttStore.drawWidth = Number((e.target as HTMLInputElement).value); }} />
      {/if}
      {#if vttStore.drawPaths.length > 0}
        <button class="btn icon-btn" onclick={undoDrawPath} title="Annuler dernier tracé">✏️↩️</button>
        <button class="btn icon-btn" onclick={clearDrawPaths} title="Effacer tous les tracés">✏️🗑️</button>
      {/if}
      <div class="separator"></div>
      <button class="btn icon-btn" class:active={vttStore.mode === 'blueprint'} onclick={() => vttStore.mode = 'blueprint'} title="Mode Blueprint (Murs / LOS)">🧱</button>
      {#if vttStore.mode === 'blueprint'}
        <button class="btn icon-btn" class:active={vttStore.blueprintType === 'opaque'} onclick={() => vttStore.blueprintType = 'opaque'} title="Mur Opaque">🧱</button>
        <button class="btn icon-btn" class:active={vttStore.blueprintType === 'door'} onclick={() => vttStore.blueprintType = 'door'} title="Porte">🚪</button>
      {/if}
      {#if vttStore.mode === 'blueprint' || vttStore.walls.length > 0}
        <button class="btn icon-btn" onclick={undoGmWall} title="Annuler dernier mur">🧱↩️</button>
        <button class="btn icon-btn" onclick={clearGmWalls} title="Effacer tous les murs">🧱🗑️</button>
      {/if}
      <button class="btn icon-btn" class:active={vttStore.mode === 'audio-zone'} onclick={() => vttStore.mode = 'audio-zone'} title="Zone Sonore (Ambiance locale)">🎶</button>
      <div class="separator"></div>
      <!-- Météo -->
      {#each (['none','rain','snow','fog','embers'] as const) as w}
        <button class="btn icon-btn" class:active={vttStore.weather === w} onclick={() => setWeather(w)}
          title={w === 'none' ? 'Pas de météo' : w === 'rain' ? 'Pluie' : w === 'snow' ? 'Neige' : w === 'fog' ? 'Brouillard' : 'Braises'}
        >{w === 'none' ? '☀️' : w === 'rain' ? '🌧️' : w === 'snow' ? '❄️' : w === 'fog' ? '🌫️' : '🔥'}</button>
      {/each}
      <button class="btn icon-btn" onclick={sendWeatherNarrative} title="Narration météo → texte d'ambiance joueur">🌦️</button>
      {#if vttStore.mode === 'spell'}
        <div class="separator"></div>
        {#each (['fire','ice','lightning','poison','silence','divine','darkness'] as const) as st}
          <button class="btn icon-btn" class:active={vttStore.spellType === st} onclick={() => vttStore.spellType = st} title={st}
          >{st === 'fire' ? '🔥' : st === 'ice' ? '❄️' : st === 'lightning' ? '⚡' : st === 'poison' ? '🧪' : st === 'silence' ? '🔇' : st === 'divine' ? '✨' : '🌑'}</button>
        {/each}
        <div class="separator"></div>
        <button class="btn icon-btn" class:active={vttStore.spellShape === 'circle'} onclick={() => vttStore.spellShape = 'circle'} title="Cercle">⭕</button>
        <button class="btn icon-btn" class:active={vttStore.spellShape === 'cone'}   onclick={() => vttStore.spellShape = 'cone'}   title="Cône">🔺</button>
        <button class="btn icon-btn" class:active={vttStore.spellShape === 'line'}   onclick={() => vttStore.spellShape = 'line'}   title="Ligne">➡️</button>
        {#if vttStore.spellShape === 'circle'}
          <input type="number" class="spell-radius-input" value={vttStore.spellRadius} min="20" max="400" step="10" title="Rayon (px)"
            onchange={(e) => vttStore.spellRadius = Number((e.target as HTMLInputElement).value)} />
        {:else if vttStore.spellShape === 'cone'}
          <input type="number" class="spell-radius-input" value={vttStore.spellRadius} min="20" max="400" step="10" title="Portée (px)"
            onchange={(e) => vttStore.spellRadius = Number((e.target as HTMLInputElement).value)} />
          <input type="range" class="draw-width-input" min="0" max="360" step="5"
            value={Math.round((vttStore.spellConeAngle ?? Math.PI/3) * 180 / Math.PI)}
            oninput={(e) => vttStore.spellConeAngle = Number((e.target as HTMLInputElement).value) * Math.PI / 180}
            title="Ouverture du cône (°)" />
          <input type="range" class="draw-width-input" min="0" max="360" step="5"
            value={vttStore.spellAngleDeg}
            oninput={(e) => { const v = Number((e.target as HTMLInputElement).value); vttStore.spellAngleDeg = v; vttStore.spellAngle = v * Math.PI / 180; }}
            title="Direction du cône (°)" />
        {:else if vttStore.spellShape === 'line'}
          <input type="number" class="spell-radius-input" value={vttStore.spellLength} min="50" max="800" step="25" title="Longueur (px)"
            onchange={(e) => vttStore.spellLength = Number((e.target as HTMLInputElement).value)} />
          <input type="range" class="draw-width-input" min="0" max="360" step="5"
            value={vttStore.spellAngleDeg}
            oninput={(e) => { const v = Number((e.target as HTMLInputElement).value); vttStore.spellAngleDeg = v; vttStore.spellAngle = v * Math.PI / 180; }}
            title="Direction (°)" />
        {/if}
        {#if vttStore.spells.length > 0}
          <button class="btn icon-btn" onclick={clearSpells} title="Effacer tous les sorts">🗑️</button>
        {/if}
      {/if}
      <div class="separator"></div>
      <button class="btn icon-btn" onclick={createTestToken}                                      title="Créer un token coloré">👹</button>
      <button class="btn icon-btn" onclick={() => showSharedLibrary = true}                       title="Bibliothèque commune (tokens, maps, tables)">📚</button>
      <button class="btn icon-btn" onclick={() => { showTokenPicker = true; tokenPickerSearch = ''; }} title="Token depuis image (assets/tokens/)">🖼️</button>
      <button class="btn icon-btn" onclick={undoGmFow}                                            title="Annuler dernière zone de brouillard">↩️</button>
      <button class="btn icon-btn" onclick={clearGmFow}                                           title="Effacer tout le brouillard">🧹</button>
      {#if vttStore.pins.length > 0}
        <button class="btn icon-btn" onclick={clearGmPins} title="Supprimer toutes les épingles">📌🗑️</button>
      {/if}
      <div class="separator"></div>
      <button class="btn icon-btn combat-btn" class:active={vttStore.combatActive}
        onclick={() => vttStore.combatActive ? stopCombat() : startCombat()}
        title={vttStore.combatActive ? 'Terminer le combat' : 'Démarrer le tracker de combat'}
      >⚔️</button>
      <div class="separator"></div>
      <!-- Terrain -->
      <button class="btn icon-btn" class:active={vttStore.mode === 'terrain'} onclick={() => vttStore.mode = 'terrain'} title="Zones de terrain (glisser pour dessiner)">🗺️</button>
      {#if vttStore.mode === 'terrain'}
        {#each ([['difficult','🏔️','Difficile'],['water','🌊','Eau'],['fire','🔥','Feu'],['poison','🧪','Poison'],['safe','✅','Sûr']] as const) as [t, icon, label]}
          <button class="btn icon-btn" class:active={vttStore.terrainType === t} onclick={() => vttStore.terrainType = t} title={label}>{icon}</button>
        {/each}
        {#if vttStore.terrainZones.length > 0}
          <button class="btn icon-btn" onclick={clearTerrainZones} title="Effacer toutes les zones terrain">🗺️🗑️</button>
        {/if}
      {/if}
      <!-- Dungeon Editor -->
      <button class="btn icon-btn" class:active={vttStore.showDungeonEditor}
        onclick={() => {
          vttStore.showDungeonEditor = !vttStore.showDungeonEditor;
          vttStore.mode = vttStore.showDungeonEditor ? 'dungeon-paint' : 'select';
        }}
        title="Éditeur de Donjon">🏰</button>
      <!-- Export PNG -->
      <button class="btn icon-btn" onclick={() => vttStore.exportRequest++} title="Exporter carte en PNG">🖼️💾</button>
    </div>
    </div>
  {/if}

  <!-- Ligne 2 : actions principales -->
  <div class="toolbar-row">
  <div class="toolbar-actions">
    {#if !vttStore.currentMap}
      <button class="btn icon-btn" onclick={() => showMapPicker = true} title="Charger une carte">🗺️</button>
    {:else}
      <button class="btn icon-btn" onclick={() => showMapPicker = true} title="Changer de carte">🗺️</button>
      <button class="btn icon-btn" onclick={closeMap} title="Fermer la carte">✖️</button>
      <div class="separator"></div>
      <button class="btn icon-btn" class:active={vttStore.mode === 'zoom-rect'} onclick={() => vttStore.mode = 'zoom-rect'} title="Zoomer sur une zone">🔍</button>
      <button class="btn icon-btn" onclick={() => { vttStore.fitRequest++; vttStore.mode = 'select'; }} title="Réinitialiser le zoom">⌂</button>
      <button class="btn icon-btn" onclick={undoMapAction} disabled={!canUndo()} title="Annuler (Ctrl+Z)">↩️</button>
    {/if}

    <div class="separator"></div>

    <button class="btn icon-btn" class:active={!!vttStore.audioSrc} onclick={() => showAudioPicker = true} title={vttStore.audioSrc ? 'Piste 1 en cours' : 'Ambiance — Piste 1'}>
      {vttStore.audioSrc ? '🔊' : '🎵'}
    </button>
    {#if vttStore.audioSrc}
      <div class="volume-control">
        <input type="range" min="0" max="1" step="0.05"
          value={vttStore.audioVolume}
          oninput={(e) => setGmAudioVolume(Number((e.target as HTMLInputElement).value))}
        />
        <button class="btn-stop" onclick={stopAudio} title="Arrêter piste 1">⏹️</button>
      </div>
    {/if}
    <button class="btn icon-btn" class:active={!!vttStore.audio2Src} onclick={() => showAudio2Picker = true} title={vttStore.audio2Src ? 'Piste 2 en cours' : 'Ambiance — Piste 2'}>
      {vttStore.audio2Src ? '🔈' : '🎶'}
    </button>
    {#if vttStore.audio2Src}
      <div class="volume-control">
        <input type="range" min="0" max="1" step="0.05"
          value={vttStore.audio2Volume}
          oninput={(e) => setGmAudio2Volume(Number((e.target as HTMLInputElement).value))}
        />
        <button class="btn-stop" onclick={stopAudio2} title="Arrêter piste 2">⏹️</button>
      </div>
    {/if}

    <div class="separator"></div>

    <button class="btn icon-btn" class:active={vttStore.showGrid} onclick={toggleGrid} title="Afficher/masquer la grille">#️⃣</button>
    <button class="btn icon-btn blackout-btn" class:active={vttStore.isBlackout} onclick={toggleBlackout} title="Écran noir vue joueur">
      {vttStore.isBlackout ? '👁️' : '🕶️'}
    </button>

    <div class="grid-control" title="Taille de la grille (px)">
      <span class="grid-label">#</span>
      <input type="number" class="grid-input" value={vttStore.gridSize} min="10" max="200" step="5"
        onchange={(e) => setGridSize(Number((e.target as HTMLInputElement).value))} />
    </div>

    <div class="separator"></div>

    <button class="btn icon-btn timer-btn" class:active={vttStore.sessionTimerStart !== null} onclick={toggleTimer} title="Timer de session">
      ⏱️ {sessionDisplay}
    </button>

    <!-- Countdown joueur -->
    <button class="btn icon-btn" class:active={vttStore.countdownEnd !== null}
      onclick={() => { if (vttStore.countdownEnd !== null) stopCountdown(); else showCountdownPicker = !showCountdownPicker; }}
      title="Compte à rebours visible joueurs">⏳</button>
    {#if showCountdownPicker && vttStore.countdownEnd === null}
      <div class="cd-picker">
        {#each [15, 30, 60, 120] as s}
          <button class="btn cd-preset" onclick={() => { countdownSecs = s; startCountdown(s); showCountdownPicker = false; }}>{s}s</button>
        {/each}
        <input type="number" class="grid-input" bind:value={countdownSecs} min="5" max="600" step="5" style="width:46px" title="Secondes"/>
        <button class="btn icon-btn" onclick={() => { startCountdown(countdownSecs); showCountdownPicker = false; }}>▶️</button>
      </div>
    {/if}

    <div class="separator"></div>

    <DiceRoller onRoll={handleDiceRoll} />
    <div class="separator"></div>
    <button class="btn icon-btn" onclick={() => onTogglePlayerManager?.()} title="Gestionnaire de Groupe (Party Manager)">👥</button>
    <button class="btn icon-btn" onclick={() => onTogglePlayerHub?.()} title="Tableau de bord des joueurs (Hub)">📱</button>
    <button class="btn icon-btn" onclick={() => onTogglePlayerMobileManager?.()} title="Joueurs Mobiles (Serveur)">📲</button>
    <div class="separator"></div>
    <button class="btn icon-btn overflow-toggle" class:active={showToolsOverflow}
      onclick={(e) => { e.stopPropagation(); showToolsOverflow = !showToolsOverflow; }}
      title="Plus d'outils">🔧</button>
  </div>
  </div>
</div>

<!-- Backdrop overflow -->
{#if showToolsOverflow}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overflow-backdrop" onclick={() => showToolsOverflow = false}></div>
{/if}

<!-- Panneau d'outils avancés (toujours monté) -->
<div class="tools-overflow-panel" class:overflow-visible={showToolsOverflow} style="top:{toolbarH}px">
  <div class="overflow-grid">
    <CharacterCreator />
    <SoundBoard />
    <MonsterLibrary />
    <AdventureLibrary />
    <SessionExport />
    <button class="btn overflow-tool-btn" onclick={() => showNpcModal = true} title="Générateur de PNJ rapide">🧟<br><small>NPC</small></button>
    <button class="btn overflow-tool-btn" onclick={() => showLootModal = true} title="Générateur de butin">💰<br><small>Butin</small></button>
    <button class="btn overflow-tool-btn" onclick={() => showHandoutModal = true} title="Envoyer handout joueur">📤<br><small>Handout</small></button>
    <button class="btn overflow-tool-btn" class:active={showRelationMap} onclick={() => showRelationMap = !showRelationMap} title="Carte des relations PNJ">🕸️<br><small>Relations</small></button>
    <button class="btn overflow-tool-btn" class:active={showCombatLogPanel} onclick={() => showCombatLogPanel = !showCombatLogPanel} title="Log de combat">📜<br><small>Combat</small></button>
    <button class="btn overflow-tool-btn" onclick={() => showDamageCalc = true} title="Calculateur de dégâts">💥<br><small>Dégâts</small></button>
    <button class="btn overflow-tool-btn" onclick={() => showEncounterGen = true} title="Générateur de rencontre">⚡<br><small>Rencontre</small></button>
    <button class="btn overflow-tool-btn" onclick={() => showRoomGen = true} title="Générateur de salle">🏚️<br><small>Salle</small></button>
    <button class="btn overflow-tool-btn" onclick={() => showWeatherPlanner = true} title="Planificateur météo">🌦️<br><small>Météo</small></button>
    <button class="btn overflow-tool-btn" class:active={showDurationTracker} onclick={() => showDurationTracker = !showDurationTracker} title="Suivi des durées">⏱️<br><small>Durées</small></button>
    <button class="btn overflow-tool-btn" onclick={() => showSharedNotes = true} title="Notes partagées avec les joueurs">📋<br><small>Notes</small></button>
    <button class="btn overflow-tool-btn" class:active={vttStore.spotlightTokenId !== null}
      onclick={() => vttStore.spotlightTokenId !== null ? setSpotlightToken(null) : null}
      title={vttStore.spotlightTokenId ? 'Retirer le spotlight' : 'Spotlight (clic droit token)'}>🔦<br><small>Spotlight</small></button>
    <button class="btn overflow-tool-btn handout-btn" onclick={() => showHandoutPicker = true} title="Envoyer un handout">📤<br><small>Envoyer</small></button>
  </div>
  <div class="overflow-inputs">
    <input type="text" class="campaign-title-input" placeholder="Titre de campagne…"
      value={vttStore.campaignTitle}
      oninput={(e) => setCampaignTitle((e.target as HTMLInputElement).value)}
      title="Titre affiché sur l'écran joueur"
    />
    <form class="ambient-form" onsubmit={(e) => { e.preventDefault(); const v = ambientTextInput.trim(); if (v) { sendAmbientText(v); ambientTextInput = ''; } }}>
      <input type="text" class="ambient-input" placeholder="Texte d'ambiance…"
        bind:value={ambientTextInput}
        title="Envoyer un texte d'ambiance sur l'écran joueur"
      />
      <button type="submit" class="btn icon-btn" title="Envoyer le texte">🎭</button>
    </form>
  </div>
</div>

<!-- Modals -->
{#if showNpcModal}<QuickNpcModal onclose={() => showNpcModal = false} />{/if}
{#if showLootModal}<QuickLootModal onclose={() => showLootModal = false} />{/if}
{#if showHandoutModal}<HandoutModal onclose={() => showHandoutModal = false} />{/if}
{#if showDamageCalc}<DamageCalculator onclose={() => showDamageCalc = false} />{/if}
{#if showEncounterGen}<EncounterGenerator onclose={() => showEncounterGen = false} />{/if}
{#if showRoomGen}<RoomGenerator onclose={() => showRoomGen = false} />{/if}
{#if showWeatherPlanner}<WeatherPlanner onclose={() => showWeatherPlanner = false} />{/if}
{#if showSharedNotes}<SharedNotesModal onclose={() => showSharedNotes = false} />{/if}

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
  <div class="picker-backdrop" onclick={() => { showMapPicker = false; mapPickerSearch = ''; }}>
    <div class="picker-modal" onclick={e => e.stopPropagation()}>
      <div class="picker-header">
        <span>🗺️ Choisir une carte</span>
        <button class="picker-close" onclick={() => { showMapPicker = false; mapPickerSearch = ''; }}>✕</button>
      </div>
      <div class="picker-search-bar">
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
  <div class="picker-backdrop" onclick={() => { showTokenPicker = false; tokenPickerSearch = ''; }}>
    <div class="picker-modal" onclick={e => e.stopPropagation()}>
      <div class="picker-header">
        <span>🖼️ Choisir un token</span>
        <button class="picker-close" onclick={() => { showTokenPicker = false; tokenPickerSearch = ''; }}>✕</button>
      </div>
      <div class="picker-search-bar">
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
  <div class="picker-backdrop" onclick={() => showAudioPicker = false}>
    <div class="picker-modal" onclick={e => e.stopPropagation()}>
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

<style>
  .vtt-toolbar {
    display: flex;
    flex-direction: column;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .toolbar-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  .toolbar-row::-webkit-scrollbar { height: 3px; }
  .toolbar-row::-webkit-scrollbar-track { background: transparent; }
  .toolbar-row::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
  .toolbar-row:not(:last-child) {
    border-bottom: 1px solid var(--border);
  }

  .tools-group {
    display: flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .separator {
    width: 1px;
    height: 14px;
    background: var(--border);
    margin: 0 1px;
    flex-shrink: 0;
  }

  .btn {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .btn:hover { background: var(--bg-hover); color: var(--text-primary); }
  .btn.active {
    background: rgba(229, 168, 83, 0.15);
    border-color: var(--accent);
    color: var(--accent);
  }

  .icon-btn {
    padding: 2px 5px;
    font-size: 14px;
    min-width: 26px;
    text-align: center;
  }

  .combat-btn.active {
    background: rgba(239, 68, 68, 0.15);
    border-color: #ef4444;
    color: #ef4444;
  }

  .blackout-btn.active {
    background: rgba(200, 50, 50, 0.15);
    border-color: #c83232;
    color: #ff6b6b;
  }

  .timer-btn {
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 0.05em;
    min-width: 70px;
  }
  .timer-btn.active {
    background: rgba(34, 197, 94, 0.12);
    border-color: #22c55e;
    color: #22c55e;
  }

  .cd-picker {
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 3px 6px;
  }
  .cd-preset {
    padding: 3px 7px;
    font-size: 11px;
    background: var(--bg-tertiary, #1c2233);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
  }
  .cd-preset:hover { border-color: var(--accent); color: var(--accent); }

  .volume-control {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-secondary);
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid var(--border);
  }

  .volume-control input[type="range"] {
    width: 60px;
    height: 4px;
    accent-color: var(--accent);
    cursor: pointer;
  }

  .btn-stop {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 10px;
    padding: 0;
  }

  /* Contrôle taille de grille */
  .grid-control {
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 2px 6px;
  }

  .grid-label {
    font-size: 11px;
    color: var(--text-muted);
  }

  .grid-input {
    width: 44px;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 12px;
    text-align: center;
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .grid-input::-webkit-inner-spin-button,
  .grid-input::-webkit-outer-spin-button { -webkit-appearance: none; appearance: none; }

  .ambient-form {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .ambient-input {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 11px;
    padding: 3px 6px;
    width: 130px;
  }
  .ambient-input:focus { outline: none; border-color: #a855f7; }

  .campaign-title-input {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 12px;
    padding: 3px 8px;
    width: 140px;
    outline: none;
  }
  .campaign-title-input:focus { border-color: var(--accent); }
  .campaign-title-input::placeholder { color: var(--text-muted); font-style: italic; }

  /* Sélecteur de carte */
  .picker-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .picker-modal {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    width: 480px;
    max-height: 60vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    animation: slideDown 0.15s ease-out;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .picker-close {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 16px;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .picker-close:hover { background: var(--bg-hover); }

  .picker-search-bar {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.08));
  }

  .picker-search {
    width: 100%;
    padding: 7px 10px;
    background: var(--bg-primary, #0d0f14);
    border: 1px solid var(--border-color, rgba(255,255,255,0.12));
    border-radius: 6px;
    color: var(--text-primary, #e2e8f0);
    font-size: 13px;
    outline: none;
    box-sizing: border-box;
  }
  .picker-search:focus { border-color: var(--accent, #e5a853); }

  .picker-list { overflow-y: auto; padding: 6px; }

  .picker-item-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .picker-item {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
  }
  .picker-item:hover { background: var(--bg-hover); }

  .picker-item-new {
    flex-shrink: 0;
    padding: 6px 10px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--accent);
    font-size: 16px;
    cursor: pointer;
    transition: background 0.1s;
    line-height: 1;
  }
  .picker-item-new:hover { background: rgba(229,168,83,0.12); }

  .picker-icon { font-size: 18px; flex-shrink: 0; }
  .picker-name { font-size: 14px; color: var(--text-primary); font-weight: 500; }
  .picker-path {
    font-size: 11px;
    color: var(--text-muted);
    margin-left: auto;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  .picker-empty {
    padding: 32px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
  }

  .handout-btn {
    border-color: var(--accent-secondary, #7c6af5);
    color: var(--accent-secondary, #7c6af5);
  }
  .handout-btn:hover { background: rgba(124, 106, 245, 0.1); }

  .handout-modal { width: 680px; max-height: 70vh; }

  .handout-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    overflow: hidden;
    flex: 1;
    min-height: 0;
  }

  .handout-section {
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--border);
    min-height: 0;
  }
  .handout-section:last-child { border-right: none; }

  .handout-section-title {
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.07em;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .handout-list { max-height: 300px; }

  .spell-radius-input {
    width: 42px;
    background: transparent;
    border: none;
    border-left: 1px solid var(--border);
    outline: none;
    color: var(--text-primary);
    font-size: 11px;
    text-align: center;
    padding: 2px 4px;
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .spell-radius-input::-webkit-inner-spin-button,
  .spell-radius-input::-webkit-outer-spin-button { -webkit-appearance: none; appearance: none; }

  .draw-color-input {
    width: 28px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    background: none;
  }
  .draw-width-input {
    width: 60px;
    accent-color: var(--accent);
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
  .float-panel-header button:hover { color: var(--text-primary); }

  /* ── Overflow panel ──────────────────────────────────────────── */

  .overflow-toggle {
    border-color: #7c6af5;
    color: #7c6af5;
  }
  .overflow-toggle:hover { background: rgba(124,106,245,0.1); }
  .overflow-toggle.active {
    background: rgba(124,106,245,0.15);
    border-color: #7c6af5;
    color: #c4b5fd;
  }

  .overflow-backdrop {
    position: fixed;
    inset: 0;
    z-index: 299;
  }

  .tools-overflow-panel {
    display: none;
    position: fixed;
    right: 8px;
    z-index: 300;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,.6);
    padding: 10px;
    width: min(560px, 96vw);
    flex-direction: column;
    gap: 8px;
    animation: slideDown 0.15s ease-out;
  }
  .tools-overflow-panel.overflow-visible { display: flex; }

  .overflow-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: flex-start;
  }

  .overflow-tool-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    padding: 6px 8px;
    font-size: 18px;
    min-width: 52px;
    text-align: center;
    line-height: 1.2;
  }
  .overflow-tool-btn small {
    font-size: 9px;
    color: var(--text-muted);
    font-family: sans-serif;
  }
  .overflow-tool-btn.active small { color: var(--accent); }

  .overflow-inputs {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
    border-top: 1px solid var(--border);
    padding-top: 8px;
  }
</style>
