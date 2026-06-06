<script lang="ts">
  type RollEntry = { sides: number; count: number; result: number; rolls: number[]; ts: Date };

  let visible = $state(false);
  let history = $state<RollEntry[]>([]);
  let lastEntry = $state<RollEntry | null>(null);
  let isRolling = $state(false);
  let displayValue = $state<number | null>(null);
  let customSides = $state(6);
  let customCount = $state(1);
  let modifier = $state(0);

  const DICE = [4, 6, 8, 10, 12, 20, 100];

  let { onRoll = null }: { onRoll?: ((result: number, label: string) => void) | null } = $props();

  function rollDice(sides: number, count = 1, mod = 0) {
    if (isRolling) return;
    isRolling = true;
    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
    const total = rolls.reduce((s, r) => s + r, 0) + mod;
    const maxVal = sides * count + Math.max(0, mod);
    const duration = 550;
    const interval = 38;
    const steps = Math.floor(duration / interval);
    let step = 0;
    const timer = setInterval(() => {
      step++;
      if (step >= steps) {
        clearInterval(timer);
        displayValue = total;
        const entry: RollEntry = { sides, count, result: total, rolls, ts: new Date() };
        lastEntry = entry;
        history = [entry, ...history].slice(0, 30);
        isRolling = false;
        const lbl = count > 1 ? `${count}d${sides}` : `d${sides}`;
        onRoll?.(total, lbl);
      } else {
        displayValue = Math.floor(Math.random() * maxVal) + 1;
      }
    }, interval);
  }

  function rollLabel(e: RollEntry) {
    let label = `${e.count}d${e.sides}`;
    if (e.count > 1) label += ` [${e.rolls.join('+')}]`;
    return label;
  }

  function resultColor(entry: RollEntry) {
    const max = entry.sides * entry.count;
    const pct = entry.result / max;
    if (pct >= 0.9) return '#22c55e';
    if (pct <= 0.1) return '#ef4444';
    return 'var(--text-primary)';
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      visible = !visible;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<button class="dice-toggle" onclick={() => visible = !visible} title="Dés (Ctrl+D)">
  🎲
</button>

{#if visible}
  <div class="dice-panel">
    <div class="dice-header">
      <span class="dice-title">🎲 Dés</span>
      <button class="dice-close" onclick={() => visible = false}>✕</button>
    </div>

    <!-- Résultat en grand -->
    <div class="dice-result">
      {#if displayValue !== null || lastEntry}
        <div
          class="result-value"
          class:slot-spin={isRolling}
          style="color: {lastEntry && !isRolling ? resultColor(lastEntry) : 'var(--accent)'}"
        >{displayValue ?? lastEntry?.result ?? '—'}</div>
        <div class="result-label">{lastEntry ? rollLabel(lastEntry) : '...'}</div>
      {:else}
        <div class="result-value" style="opacity:0.2">—</div>
        <div class="result-label" style="opacity:0.3">Lancez un dé</div>
      {/if}
    </div>

    <!-- Dés rapides -->
    <div class="dice-quick">
      {#each DICE as d}
        <button class="die-btn" onclick={() => rollDice(d)} class:rolling={isRolling}>
          d{d}
        </button>
      {/each}
    </div>

    <!-- Dé personnalisé -->
    <div class="dice-custom">
      <input type="number" bind:value={customCount} min="1" max="20" class="custom-input" title="Nombre de dés" />
      <span class="custom-sep">d</span>
      <input type="number" bind:value={customSides} min="2" max="1000" class="custom-input" title="Faces" />
      <span class="custom-sep">+</span>
      <input type="number" bind:value={modifier} min="-99" max="99" class="custom-input" title="Modificateur" />
      <button class="die-btn custom-roll" onclick={() => rollDice(customSides, customCount, modifier)}>↩</button>
    </div>

    <!-- Historique -->
    {#if history.length > 0}
      <div class="dice-history">
        {#each history.slice(0, 8) as entry, i}
          <div class="history-row" class:latest={i === 0}>
            <span class="h-label">{rollLabel(entry)}</span>
            <span class="h-result" style="color:{resultColor(entry)}">{entry.result}</span>
            <span class="h-time">{entry.ts.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .dice-toggle {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .dice-toggle:hover { background: var(--bg-hover); }

  .dice-panel {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 8000;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    width: 260px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.5);
    overflow: hidden;
    animation: slideUp 0.15s ease-out;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .dice-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border);
  }

  .dice-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }

  .dice-close {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 14px;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .dice-close:hover { background: var(--bg-hover); }

  .dice-result {
    padding: 16px;
    text-align: center;
    border-bottom: 1px solid var(--border);
  }

  .result-value {
    font-size: 42px;
    font-weight: 800;
    font-family: 'JetBrains Mono', monospace;
    line-height: 1;
    transition: color 0.2s;
  }

  .slot-spin {
    animation: slotFlicker 0.06s steps(1) infinite;
  }

  @keyframes slotFlicker {
    0%   { transform: translateY(-3px) scale(1.04); }
    50%  { transform: translateY(3px) scale(0.96); }
    100% { transform: translateY(-1px) scale(1.02); }
  }

  .result-label {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 4px;
    font-family: monospace;
  }

  .dice-quick {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
  }

  .die-btn {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    padding: 5px 8px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s;
    font-family: monospace;
  }
  .die-btn:hover { background: var(--accent-bg); border-color: var(--accent); color: var(--accent); }
  .die-btn.rolling { opacity: 0.4; pointer-events: none; }
  .die-btn.custom-roll { padding: 5px 10px; }

  .dice-custom {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
  }

  .custom-input {
    width: 38px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 11px;
    text-align: center;
    padding: 4px;
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .custom-input::-webkit-inner-spin-button,
  .custom-input::-webkit-outer-spin-button { -webkit-appearance: none; appearance: none; }
  .custom-input:focus { outline: none; border-color: var(--accent); }

  .custom-sep { font-size: 12px; color: var(--text-muted); font-weight: 600; }

  .dice-history { padding: 4px; }

  .history-row {
    display: flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 5px;
    font-size: 11px;
    gap: 6px;
  }
  .history-row.latest { background: var(--bg-tertiary); }

  .h-label { color: var(--text-muted); font-family: monospace; flex: 1; }
  .h-result { font-weight: 700; font-family: monospace; font-size: 13px; width: 32px; text-align: right; }
  .h-time { color: var(--text-muted); font-size: 10px; width: 40px; text-align: right; }
</style>
