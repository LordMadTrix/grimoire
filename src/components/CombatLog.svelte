<script lang="ts">
  import { vttStore, clearCombatLog } from '$lib/stores/vtt.svelte';

  const TYPE_ICON: Record<string, string> = {
    damage: '⚔️', heal: '💚', death: '💀', turn: '🎯', condition: '🔮', info: 'ℹ️',
  };
  const TYPE_COLOR: Record<string, string> = {
    damage: '#ef4444', heal: '#22c55e', death: '#7f1d1d', turn: '#e5a853', condition: '#a855f7', info: '#8899b7',
  };

  function fmt(ts: number) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  }

  let logEl: HTMLDivElement;
  let autoScroll = $state(true);

  $effect(() => {
    void vttStore.combatLog.length;
    if (autoScroll && logEl) {
      logEl.scrollTop = logEl.scrollHeight;
    }
  });

  function onScroll() {
    if (!logEl) return;
    autoScroll = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 40;
  }

  function exportLog() {
    const lines = vttStore.combatLog.map(e =>
      `[R${e.round}][${fmt(e.timestamp)}] ${TYPE_ICON[e.type]} ${e.actor}${e.target ? ' → ' + e.target : ''}${e.detail ? ' : ' + e.detail : ''}`
    ).join('\n');
    navigator.clipboard.writeText(lines);
  }
</script>

<div class="cl-wrap">
  <div class="cl-header">
    <span>📜 Log de combat</span>
    <div class="cl-header-actions">
      <button onclick={exportLog} title="Copier en Markdown">📋</button>
      <button onclick={clearCombatLog} title="Effacer">🗑️</button>
    </div>
  </div>

  <div class="cl-body" bind:this={logEl} onscroll={onScroll} role="log">
    {#if vttStore.combatLog.length === 0}
      <div class="cl-empty">Aucune action enregistrée</div>
    {:else}
      {#each vttStore.combatLog as entry (entry.id)}
        <div class="cl-entry">
          <span class="cl-time">{fmt(entry.timestamp)}</span>
          <span class="cl-round">R{entry.round}</span>
          <span class="cl-icon">{TYPE_ICON[entry.type]}</span>
          <span class="cl-actor" style="color:{TYPE_COLOR[entry.type]}">{entry.actor}</span>
          {#if entry.target}<span class="cl-arrow">→</span><span class="cl-target">{entry.target}</span>{/if}
          {#if entry.detail}<span class="cl-detail">{entry.detail}</span>{/if}
        </div>
      {/each}
    {/if}
  </div>

  {#if !autoScroll}
    <button class="cl-scroll-btn" onclick={() => { autoScroll = true; logEl?.scrollTo({ top: logEl.scrollHeight, behavior: 'smooth' }); }}>
      ↓ Dernier
    </button>
  {/if}
</div>

<style>
  .cl-wrap {
    display: flex; flex-direction: column;
    background: var(--bg-secondary, #161b22);
    border: 1px solid var(--border, #2d3748);
    border-radius: 8px;
    overflow: hidden;
    height: 260px;
  }
  .cl-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 10px;
    background: var(--bg-tertiary, #1c2233);
    font-size: 12px; font-weight: 700; color: var(--accent, #e5a853);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .cl-header-actions { display: flex; gap: 4px; }
  .cl-header-actions button {
    background: none; border: none; cursor: pointer; font-size: 14px; opacity: 0.7;
    padding: 2px;
  }
  .cl-header-actions button:hover { opacity: 1; }
  .cl-body {
    flex: 1; overflow-y: auto; padding: 4px 6px;
    font-size: 11px; font-family: monospace;
  }
  .cl-empty { color: var(--text-muted); text-align: center; padding: 20px; font-style: italic; }
  .cl-entry {
    display: flex; align-items: center; gap: 4px;
    padding: 2px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .cl-time { color: #4a5568; min-width: 54px; }
  .cl-round {
    background: #1c2233; border-radius: 3px; padding: 0 4px;
    color: #e5a853; font-size: 10px; min-width: 24px; text-align: center;
  }
  .cl-icon { min-width: 16px; }
  .cl-actor { font-weight: 700; }
  .cl-arrow { color: #4a5568; }
  .cl-target { color: var(--text-muted); }
  .cl-detail { color: #94a3b8; margin-left: 2px; }
  .cl-scroll-btn {
    position: absolute; bottom: 4px; right: 8px;
    background: var(--accent); color: #000;
    border: none; border-radius: 4px; padding: 3px 8px;
    font-size: 11px; cursor: pointer;
  }
</style>
