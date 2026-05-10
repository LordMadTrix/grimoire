<script lang="ts">
  import MapCanvas from './components/MapCanvas.svelte';
  
  // Dans le futur, ces valeurs seront synchronisées via des évènements Tauri
  // depuis la fenêtre principale du MJ.
  let currentMap = $state<string | null>(null);
  let showGrid = $state(true);
  let isBlackout = $state(false);
  let fowShapes = $state<any[]>([]);
  let tokens = $state<any[]>([]);

  // Écouter les événements Tauri venant de la fenêtre du MJ
  import { listen } from '@tauri-apps/api/event';
  import { onMount } from 'svelte';

  onMount(() => {
    const unlistens: (() => void)[] = [];

    listen('set_player_map', (e: any) => { currentMap = e.payload.url; }).then(fn => unlistens.push(fn));
    listen('toggle_player_grid', (e: any) => { showGrid = e.payload.show; }).then(fn => unlistens.push(fn));
    listen('toggle_player_blackout', (e: any) => { isBlackout = e.payload.active; }).then(fn => unlistens.push(fn));
    listen('update_fow', (e: any) => { fowShapes = e.payload; }).then(fn => unlistens.push(fn));
    listen('update_tokens', (e: any) => { tokens = e.payload; }).then(fn => unlistens.push(fn));

    return () => { unlistens.forEach(fn => fn()); };
  });
</script>

<main class="player-view">
  {#if isBlackout}
    <div class="blackout">
      <!-- Un petit logo discret ou rien du tout -->
      <div class="blackout-logo">Grimoire</div>
    </div>
  {:else if currentMap}
    <MapCanvas 
      mapUrl={currentMap} 
      gridEnabled={showGrid} 
      fowShapes={fowShapes}
      tokens={tokens}
      isGM={false}
    />
  {:else}
    <div class="waiting-state">
      <div class="waiting-icon">⚔️</div>
      <h2>En attente du Maître du Jeu...</h2>
    </div>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: #000;
  }

  .player-view {
    width: 100vw;
    height: 100vh;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: none; /* Cache la souris sur l'écran joueur */
  }

  .waiting-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    color: var(--text-muted, #8899b7);
    font-family: 'Inter', sans-serif;
  }

  .waiting-icon {
    font-size: 64px;
    opacity: 0.5;
    animation: pulse 4s infinite;
  }

  .waiting-state h2 {
    font-size: 24px;
    font-weight: 300;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .blackout {
    width: 100%;
    height: 100%;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .blackout-logo {
    font-family: 'Inter', sans-serif;
    color: rgba(255, 255, 255, 0.03);
    font-size: 48px;
    font-weight: 900;
    letter-spacing: 10px;
  }

  @keyframes pulse {
    0% { opacity: 0.3; }
    50% { opacity: 0.6; }
    100% { opacity: 0.3; }
  }
</style>
