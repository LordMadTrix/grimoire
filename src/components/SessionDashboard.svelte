<script lang="ts">
  import { vttStore, nextTurn, prevTurn, syncCombatantsToPlayerView } from '$lib/stores/vtt.svelte';

  const TYPE_ICON: Record<string, string> = { damage: '⚔️', heal: '💚', death: '💀', turn: '🎯', condition: '🔮', info: 'ℹ️' };
  const TYPE_COLOR: Record<string, string> = { damage: '#ef4444', heal: '#22c55e', death: '#7f1d1d', turn: '#e5a853', condition: '#a855f7', info: '#8899b7' };

  let showLog = $state(false);

  let timerDisplay = $state('00:00');
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
          timerDisplay = h > 0
            ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
            : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        }, 1000);
      }
    } else {
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
      timerDisplay = '00:00';
    }
  });

  function toggleTimer() {
    if (vttStore.sessionTimerStart !== null) {
      vttStore.sessionTimerStart = null;
    } else {
      vttStore.sessionTimerStart = Date.now();
    }
  }

  const WEATHER_ICONS: Record<string, string> = {
    none: '☀️', rain: '🌧️', snow: '❄️', fog: '🌫️', embers: '🔥',
  };

  let collapsed = $state(false);
</script>

<div class="dashboard" class:collapsed>
  <div class="dash-header">
    <span class="dash-title">⚔️ R.{vttStore.combatRound}</span>
    <div class="dash-meta">
      <span class="weather-icon" title={vttStore.weather}>{WEATHER_ICONS[vttStore.weather] ?? '☀️'}</span>
      <button class="timer-btn" class:active={vttStore.sessionTimerStart !== null} onclick={toggleTimer} title="Timer session">
        ⏱️ {timerDisplay}
      </button>
      <button class="log-btn" class:active={showLog} onclick={() => showLog = !showLog} title="Log de combat">📜</button>
    </div>
    <button class="collapse-btn" onclick={() => collapsed = !collapsed}>{collapsed ? '◀' : '▶'}</button>
  </div>

  {#if !collapsed}
    <div class="turn-controls">
      <button class="turn-btn" onclick={prevTurn}>◀</button>
      <span class="active-name">
        {vttStore.combatants[vttStore.currentTurn]?.name ?? '—'}
      </span>
      <button class="turn-btn" onclick={nextTurn}>▶</button>
    </div>

    <div class="combatant-list">
      {#each vttStore.combatants as c, i}
        {@const pct = c.maxHp > 0 ? Math.max(0, c.hp / c.maxHp) : 0}
        <div class="combatant-row" class:active={i === vttStore.currentTurn} class:enemy={c.isEnemy}>
          <span class="c-name">{c.name}</span>
          <div class="c-hp-bar">
            <div class="c-hp-fill" style="width:{pct*100}%; background:{pct > 0.5 ? '#22c55e' : pct > 0.2 ? '#eab308' : '#ef4444'}"></div>
          </div>
          <span class="c-hp-text">{c.hp}/{c.maxHp}</span>
        </div>
      {/each}
    </div>

    {#if showLog}
      <div class="mini-log">
        {#if vttStore.combatLog.length === 0}
          <div class="mini-log-empty">Aucune action</div>
        {:else}
          {#each vttStore.combatLog.slice(-6).reverse() as entry (entry.id)}
            <div class="mini-log-row">
              <span style="color:{TYPE_COLOR[entry.type]}">{TYPE_ICON[entry.type]}</span>
              <span class="mini-log-actor" style="color:{TYPE_COLOR[entry.type]}">{entry.actor}</span>
              {#if entry.detail}<span class="mini-log-detail">{entry.detail}</span>{/if}
            </div>
          {/each}
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .dashboard {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 200;
    background: rgba(10, 12, 16, 0.88);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px;
    min-width: 200px;
    max-width: 230px;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    font-size: 12px;
    color: #d4dae8;
    overflow: hidden;
  }
  .dashboard.collapsed { min-width: unset; }

  .dash-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    background: rgba(229,168,83,0.08);
  }

  .dash-title {
    font-weight: 700;
    color: #e5a853;
    font-size: 13px;
    flex-shrink: 0;
  }

  .dash-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }

  .weather-icon { font-size: 14px; }

  .timer-btn {
    background: transparent;
    border: none;
    color: #8899b7;
    font-size: 11px;
    cursor: pointer;
    padding: 1px 4px;
    border-radius: 3px;
    font-family: 'JetBrains Mono', monospace;
  }
  .timer-btn.active { color: #22c55e; }
  .timer-btn:hover { background: rgba(255,255,255,0.06); }
  .log-btn {
    background: transparent; border: none; cursor: pointer; font-size: 12px; opacity: 0.6; padding: 1px 3px;
  }
  .log-btn.active { opacity: 1; }
  .log-btn:hover { opacity: 1; }
  .mini-log {
    border-top: 1px solid rgba(255,255,255,0.06);
    padding: 5px 10px;
    max-height: 120px;
    overflow-y: auto;
  }
  .mini-log-empty { font-size: 10px; color: #4a5568; font-style: italic; }
  .mini-log-row {
    display: flex; align-items: center; gap: 5px;
    font-size: 10px; font-family: monospace; padding: 1px 0;
  }
  .mini-log-actor { font-weight: 700; }
  .mini-log-detail { color: #8899b7; }

  .collapse-btn {
    background: transparent;
    border: none;
    color: #8899b7;
    cursor: pointer;
    font-size: 10px;
    padding: 2px 4px;
    flex-shrink: 0;
  }

  .turn-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .turn-btn {
    background: rgba(255,255,255,0.07);
    border: none;
    color: #d4dae8;
    cursor: pointer;
    border-radius: 4px;
    padding: 2px 7px;
    font-size: 11px;
    flex-shrink: 0;
  }
  .turn-btn:hover { background: rgba(229,168,83,0.2); }

  .active-name {
    flex: 1;
    text-align: center;
    font-weight: 700;
    color: #e5a853;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .combatant-list {
    max-height: 280px;
    overflow-y: auto;
    padding: 4px 0;
  }

  .combatant-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-left: 2px solid transparent;
    transition: background 0.1s;
  }
  .combatant-row.active {
    background: rgba(229,168,83,0.1);
    border-left-color: #e5a853;
  }
  .combatant-row.enemy { color: #f87171; }

  .c-name {
    width: 70px;
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
  }

  .c-hp-bar {
    flex: 1;
    height: 5px;
    background: rgba(255,255,255,0.1);
    border-radius: 3px;
    overflow: hidden;
  }

  .c-hp-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s;
  }

  .c-hp-text {
    font-size: 10px;
    color: #8899b7;
    width: 36px;
    text-align: right;
    font-family: monospace;
    flex-shrink: 0;
  }
</style>
