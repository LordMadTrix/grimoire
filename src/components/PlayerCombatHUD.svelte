<script lang="ts">
  import { onMount } from 'svelte';
  
  let { combatants = [], combatActive = false, currentTurn = 0, combatRound = 1 }: { combatants?: any[]; combatActive?: boolean; currentTurn?: number; combatRound?: number; } = $props();
  
  
  

  let sortedCombatants = $derived([...combatants].sort((a, b) => b.initiative - a.initiative));
  
  // To detect turn changes
  let prevTurnId = $state<string | null>(null);
  let showTurnBanner = $state(false);
  let turnBannerName = $state('');
  
  $effect(() => {
    if (combatActive && sortedCombatants.length > 0) {
      const currentId = sortedCombatants[currentTurn]?.id;
      if (currentId && currentId !== prevTurnId) {
        prevTurnId = currentId;
        
        // Trigger Turn Banner
        turnBannerName = sortedCombatants[currentTurn].name;
        showTurnBanner = false;
        setTimeout(() => showTurnBanner = true, 50);
        setTimeout(() => showTurnBanner = false, 3000);
      }
    } else {
      prevTurnId = null;
    }
  });

</script>

{#if combatActive}
  <div class="combat-hud">
    <!-- Initiative Bar -->
    <div class="initiative-bar">
      <div class="round-indicator">ROUND {combatRound}</div>
      <div class="combatants-list">
        {#each sortedCombatants as c, i (c.id)}
          <div class="combatant-portrait" class:active={i === currentTurn} class:enemy={c.isEnemy} class:dead={c.hp <= 0}>
            <div class="portrait-frame"></div>
            <div class="portrait-name">{c.name.substring(0, 10)}</div>
            {#if c.hp <= 0}
              <div class="skull-overlay">💀</div>
            {/if}
            {#if i === currentTurn}
              <div class="active-glow"></div>
            {/if}
          </div>
          {#if i < sortedCombatants.length - 1}
            <div class="separator"></div>
          {/if}
        {/each}
      </div>
    </div>
  </div>
{/if}

{#if showTurnBanner}
  <div class="turn-banner-overlay">
    <div class="turn-banner-content">
      <div class="turn-subtitle">AU TOUR DE</div>
      <div class="turn-title">{turnBannerName}</div>
    </div>
  </div>
{/if}

<style>
  .combat-hud {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    display: flex;
    justify-content: center;
    z-index: 100;
    pointer-events: none;
    padding-top: 10px;
  }

  .initiative-bar {
    display: flex;
    align-items: center;
    background: linear-gradient(to right, transparent, rgba(15, 18, 25, 0.95), transparent);
    padding: 10px 40px;
    border-bottom: 2px solid #e5a853;
    box-shadow: 0 4px 20px rgba(0,0,0,0.8);
  }

  .round-indicator {
    font-family: 'Cinzel', serif;
    font-weight: 700;
    font-size: 18px;
    color: #e5a853;
    margin-right: 30px;
    letter-spacing: 2px;
    text-shadow: 0 0 10px rgba(229, 168, 83, 0.5);
  }

  .combatants-list {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .combatant-portrait {
    position: relative;
    width: 50px;
    height: 50px;
    background: #2d3748;
    border: 2px solid #4a5568;
    border-radius: 4px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    transition: all 0.3s ease;
  }

  .combatant-portrait.enemy {
    border-color: #9b2c2c;
  }

  .combatant-portrait.active {
    transform: scale(1.2);
    border-color: #e5a853;
    z-index: 2;
  }

  .combatant-portrait.dead {
    filter: grayscale(100%) brightness(0.4);
  }

  .portrait-name {
    font-size: 9px;
    color: #fff;
    background: rgba(0,0,0,0.7);
    width: 100%;
    text-align: center;
    padding: 2px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .active-glow {
    position: absolute;
    inset: -4px;
    border: 2px solid #e5a853;
    border-radius: 6px;
    animation: pulseGlow 1.5s infinite;
    pointer-events: none;
  }

  .skull-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: #ff4444;
  }

  .separator {
    width: 20px;
    height: 2px;
    background: #4a5568;
  }

  @keyframes pulseGlow {
    0% { box-shadow: 0 0 5px rgba(229, 168, 83, 0.2); }
    50% { box-shadow: 0 0 15px rgba(229, 168, 83, 0.8); }
    100% { box-shadow: 0 0 5px rgba(229, 168, 83, 0.2); }
  }

  /* Turn Banner */
  .turn-banner-overlay {
    position: absolute;
    top: 40%;
    left: 0;
    width: 100%;
    height: 150px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    pointer-events: none;
    overflow: hidden;
  }

  .turn-banner-content {
    background: linear-gradient(to right, transparent, rgba(150, 0, 0, 0.8), transparent);
    width: 100%;
    text-align: center;
    padding: 20px 0;
    border-top: 2px solid #e5a853;
    border-bottom: 2px solid #e5a853;
    animation: slashIn 3s cubic-bezier(0.1, 0.9, 0.2, 1) forwards;
  }

  .turn-subtitle {
    font-size: 18px;
    color: #e5a853;
    letter-spacing: 6px;
    font-family: 'Cinzel', serif;
  }

  .turn-title {
    font-size: 64px;
    font-weight: 900;
    color: #fff;
    text-shadow: 0 0 20px #000, 2px 2px 0px #900;
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    letter-spacing: 4px;
  }

  @keyframes slashIn {
    0% { transform: scaleX(0); opacity: 0; filter: blur(10px); }
    10% { transform: scaleX(1); opacity: 1; filter: blur(0px); }
    80% { transform: scaleX(1) scaleY(1); opacity: 1; filter: blur(0px); }
    100% { transform: scaleX(1) scaleY(0); opacity: 0; filter: blur(20px); }
  }
</style>
