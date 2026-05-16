<script lang="ts">
  import { vttStore } from '$lib/stores/vtt.svelte';

  type DEntry = { id: string; label: string; icon: string; rounds: number; maxRounds: number; owner: string };

  let entries = $state<DEntry[]>([]);
  let newLabel = $state('');
  let newRounds = $state(3);
  let newIcon = $state('🕯️');
  let newOwner = $state('');

  const PRESETS = [
    { icon:'🕯️', label:'Torche', rounds:10 },
    { icon:'✨', label:'Lumière magique', rounds:6 },
    { icon:'🔮', label:'Concentration', rounds:5 },
    { icon:'☠️', label:'Poison', rounds:4 },
    { icon:'🔥', label:'Brûlure', rounds:3 },
    { icon:'🌀', label:'Invocation', rounds:8 },
    { icon:'🛡️', label:'Bénédiction', rounds:6 },
    { icon:'🩸', label:'Saignement', rounds:4 },
  ];

  function addEntry(icon = newIcon, label = newLabel, rounds = newRounds, owner = newOwner) {
    if (!label.trim()) return;
    entries = [...entries, { id: Math.random().toString(36).slice(2), label: label.trim(), icon, rounds, maxRounds: rounds, owner }];
    newLabel = ''; newOwner = '';
  }

  function addPreset(p: typeof PRESETS[0]) {
    addEntry(p.icon, p.label, p.rounds, '');
  }

  function tick(id: string, delta: number) {
    entries = entries.map(e => e.id === id ? { ...e, rounds: Math.max(0, e.rounds + delta) } : e).filter(e => e.rounds > 0 || delta > 0);
  }

  function remove(id: string) { entries = entries.filter(e => e.id !== id); }

  // Auto-tick quand le tour avance
  $effect(() => {
    void vttStore.combatRound; // track
  });

  function tickAll() {
    entries = entries.map(e => ({ ...e, rounds: e.rounds - 1 })).filter(e => e.rounds > 0);
  }

  function pct(e: DEntry) { return e.maxRounds > 0 ? e.rounds / e.maxRounds : 0; }
  function color(e: DEntry) { const p = pct(e); return p > 0.5 ? '#22c55e' : p > 0.25 ? '#eab308' : '#ef4444'; }
</script>

<div class="dt-wrap">
  <div class="dt-header">
    <span>⏳ Durées</span>
    <button class="dt-tick-all" onclick={tickAll} title="Avancer tous d'1 round">-1 Round</button>
  </div>

  <!-- Presets rapides -->
  <div class="dt-presets">
    {#each PRESETS as p}
      <button class="dt-preset" onclick={() => addPreset(p)} title="{p.rounds} rounds">{p.icon}</button>
    {/each}
  </div>

  <!-- Formulaire ajout -->
  <div class="dt-form">
    <input class="dt-icon-input" bind:value={newIcon} maxlength="2" placeholder="🕯️" />
    <input class="dt-input" bind:value={newLabel} placeholder="Effet…" />
    <input class="dt-num" type="number" bind:value={newRounds} min="1" max="99" />
    <button class="dt-add" onclick={() => addEntry()}>+</button>
  </div>

  <!-- Liste -->
  <div class="dt-list">
    {#if entries.length === 0}
      <div class="dt-empty">Aucune durée active</div>
    {:else}
      {#each entries as e (e.id)}
        <div class="dt-entry" class:urgent={e.rounds <= 1}>
          <span class="dt-e-icon">{e.icon}</span>
          <div class="dt-e-main">
            <div class="dt-e-label">{e.label}{e.owner ? ' — ' + e.owner : ''}</div>
            <div class="dt-e-bar"><div class="dt-e-fill" style="width:{pct(e)*100}%;background:{color(e)}"></div></div>
          </div>
          <div class="dt-e-rounds-wrap">
            <button class="dt-adj" onclick={() => tick(e.id, -1)}>-</button>
            <span class="dt-e-rounds" style="color:{color(e)}">{e.rounds}</span>
            <button class="dt-adj" onclick={() => tick(e.id, +1)}>+</button>
          </div>
          <button class="dt-del" onclick={() => remove(e.id)}>✕</button>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .dt-wrap { display:flex;flex-direction:column;gap:6px;padding:10px;background:var(--bg-secondary,#161b22);border:1px solid var(--border,#2d3748);border-radius:8px;min-width:240px; }
  .dt-header { display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:700;color:var(--accent,#e5a853); }
  .dt-tick-all { background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-muted);border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer; }
  .dt-tick-all:hover { border-color:var(--accent);color:var(--accent); }
  .dt-presets { display:flex;flex-wrap:wrap;gap:3px; }
  .dt-preset { background:var(--bg-tertiary);border:1px solid var(--border);border-radius:5px;padding:3px 6px;font-size:14px;cursor:pointer; }
  .dt-preset:hover { border-color:var(--accent); }
  .dt-form { display:flex;gap:4px; }
  .dt-icon-input { width:28px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);text-align:center;padding:3px;font-size:12px; }
  .dt-input { flex:1;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);padding:4px 7px;font-size:11px; }
  .dt-num { width:36px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);text-align:center;padding:3px;font-size:11px; }
  .dt-add { background:var(--accent);color:#000;border:none;border-radius:4px;padding:4px 8px;font-size:13px;font-weight:700;cursor:pointer; }
  .dt-list { display:flex;flex-direction:column;gap:4px;max-height:200px;overflow-y:auto; }
  .dt-empty { color:var(--text-muted);font-size:11px;text-align:center;padding:10px;font-style:italic; }
  .dt-entry { display:flex;align-items:center;gap:5px;padding:4px 6px;border-radius:6px;border:1px solid var(--border);transition:border-color .2s; }
  .dt-entry.urgent { border-color:#ef4444;animation:urgentPulse 1s infinite; }
  @keyframes urgentPulse { 0%,100%{background:transparent} 50%{background:rgba(239,68,68,0.08)} }
  .dt-e-icon { font-size:15px;flex-shrink:0; }
  .dt-e-main { flex:1;min-width:0; }
  .dt-e-label { font-size:11px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
  .dt-e-bar { height:3px;background:rgba(255,255,255,0.1);border-radius:2px;margin-top:2px; }
  .dt-e-fill { height:100%;border-radius:2px;transition:width .3s; }
  .dt-e-rounds-wrap { display:flex;align-items:center;gap:2px;flex-shrink:0; }
  .dt-adj { background:none;border:1px solid var(--border);border-radius:3px;color:var(--text-muted);width:16px;height:16px;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0; }
  .dt-adj:hover { border-color:var(--accent);color:var(--accent); }
  .dt-e-rounds { font-size:13px;font-weight:700;width:20px;text-align:center;font-family:monospace; }
  .dt-del { background:none;border:none;color:#4a5568;cursor:pointer;font-size:11px;padding:0 2px; }
  .dt-del:hover { color:#ef4444; }
</style>
