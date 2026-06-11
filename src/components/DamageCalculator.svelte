<script lang="ts">
  import { vttStore, updateCombatantHp, addCombatLogEntry } from '$lib/stores/vtt.svelte';

  let { onclose }: { onclose: () => void } = $props();

  let diceFormula = $state('1d6+3');
  let targetIds = $state<Set<string>>(new Set());
  let halfDamage = $state(false);
  let lastRoll = $state<number | null>(null);
  let applied = $state(false);

  function rnd(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  function parseDice(formula: string): number {
    let total = 0;
    const parts = formula.toLowerCase().replace(/\s/g, '').match(/([+-]?\d*d\d+|[+-]?\d+)/g) ?? [];
    for (const p of parts) {
      if (p.includes('d')) {
        const [nStr, dStr] = p.split('d');
        // "d6" et "+d6" = 1d6, "-d6" = -1d6 (parseInt('-') vaut NaN)
        const n = nStr === '-' ? -1 : (parseInt(nStr || '1') || 1);
        const d = parseInt(dStr) || 6;
        for (let i = 0; i < Math.abs(n); i++) total += (n < 0 ? -1 : 1) * rnd(1, d);
      } else {
        total += parseInt(p) || 0;
      }
    }
    return total;
  }

  function rollDamage() {
    lastRoll = Math.max(0, parseDice(diceFormula));
    applied = false;
  }

  function applyDamage() {
    if (lastRoll === null) return;
    const dmg = halfDamage ? Math.ceil(lastRoll / 2) : lastRoll;
    for (const id of targetIds) {
      const c = vttStore.combatants.find(c => c.id === id);
      if (c) updateCombatantHp(id, c.hp - dmg);
    }
    applied = true;
    setTimeout(() => { applied = false; }, 1500);
  }

  function applyHeal() {
    if (lastRoll === null) return;
    const heal = halfDamage ? Math.ceil(lastRoll / 2) : lastRoll;
    for (const id of targetIds) {
      const c = vttStore.combatants.find(c => c.id === id);
      // Les soins sont plafonnés aux PV max (le MJ peut toujours dépasser via édition manuelle)
      if (c) updateCombatantHp(id, Math.min(c.hp + heal, c.maxHp));
    }
    applied = true;
    setTimeout(() => { applied = false; }, 1500);
  }

  function toggleTarget(id: string) {
    const s = new Set(targetIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    targetIds = s;
  }

  const PRESETS = ['1d6', '2d6', '1d10', '2d10', '1d6+3', '2d6+5', '3d6', '1d20'];
</script>

<div class="dc-backdrop" onclick={onclose} role="none">
  <div class="dc-modal" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true">
    <div class="dc-header">
      <span>⚔️ Calculateur de Dégâts</span>
      <button class="dc-close" onclick={onclose}>×</button>
    </div>

    <!-- Formule -->
    <div class="dc-row">
      <input class="dc-input" bind:value={diceFormula} placeholder="1d6+3" />
      <button class="dc-btn dc-roll" onclick={rollDamage}>🎲 Lancer</button>
    </div>

    <!-- Presets -->
    <div class="dc-presets">
      {#each PRESETS as p}
        <button class="dc-preset" onclick={() => { diceFormula = p; rollDamage(); }}>{p}</button>
      {/each}
    </div>

    <!-- Résultat -->
    {#if lastRoll !== null}
      <div class="dc-result">
        <span class="dc-result-val">{halfDamage ? Math.ceil(lastRoll/2) : lastRoll}</span>
        <span class="dc-result-label">{halfDamage ? `(${lastRoll} ÷ 2)` : 'dégâts'}</span>
      </div>
    {/if}

    <!-- Demi-dégâts -->
    <label class="dc-check">
      <input type="checkbox" bind:checked={halfDamage} />
      Demi-dégâts (résistance / parade)
    </label>

    <!-- Cibles -->
    <div class="dc-targets-title">Cibles :</div>
    <div class="dc-targets">
      {#if vttStore.combatants.length === 0}
        <div class="dc-empty">Aucun combattant actif</div>
      {:else}
        {#each vttStore.combatants as c (c.id)}
          {@const pct = c.maxHp > 0 ? c.hp / c.maxHp : 0}
          <div class="dc-target" class:selected={targetIds.has(c.id)} class:enemy={c.isEnemy} onclick={() => toggleTarget(c.id)}>
            <span class="dc-t-name">{c.name}</span>
            <div class="dc-t-bar"><div class="dc-t-fill" style="width:{pct*100}%;background:{pct>0.5?'#22c55e':pct>0.2?'#eab308':'#ef4444'}"></div></div>
            <span class="dc-t-hp">{c.hp}/{c.maxHp}</span>
          </div>
        {/each}
      {/if}
    </div>

    {#if applied}<div class="dc-applied">✅ Appliqué !</div>{/if}

    <div class="dc-actions">
      <button class="dc-btn dc-sec" onclick={onclose}>Fermer</button>
      <button class="dc-btn dc-heal" onclick={applyHeal} disabled={lastRoll === null || targetIds.size === 0}>💚 Soigner</button>
      <button class="dc-btn dc-dmg" onclick={applyDamage} disabled={lastRoll === null || targetIds.size === 0}>💥 Appliquer</button>
    </div>
  </div>
</div>

<style>
  .dc-backdrop { position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:1500;display:flex;align-items:center;justify-content:center; }
  .dc-modal { background:var(--bg-secondary,#161b22);border:1px solid var(--border,#2d3748);border-radius:12px;padding:20px;width:360px;max-width:95vw;display:flex;flex-direction:column;gap:10px;box-shadow:0 12px 40px rgba(0,0,0,.7); }
  .dc-header { display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:700;color:#ef4444; }
  .dc-close { background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:20px; }
  .dc-row { display:flex;gap:6px; }
  .dc-input { flex:1;background:var(--bg-tertiary,#1c2233);border:1px solid var(--border);border-radius:6px;color:var(--text-primary,#c9d1d9);padding:8px 10px;font-size:14px;font-family:monospace; }
  .dc-presets { display:flex;flex-wrap:wrap;gap:4px; }
  .dc-preset { background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;color:var(--text-muted);padding:3px 8px;font-size:11px;cursor:pointer;font-family:monospace; }
  .dc-preset:hover { border-color:#ef4444;color:#ef4444; }
  .dc-result { display:flex;align-items:center;gap:10px;justify-content:center;padding:10px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px; }
  .dc-result-val { font-size:42px;font-weight:800;color:#ef4444; }
  .dc-result-label { font-size:13px;color:var(--text-muted); }
  .dc-check { display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-muted);cursor:pointer; }
  .dc-targets-title { font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.07em; }
  .dc-targets { display:flex;flex-direction:column;gap:4px;max-height:160px;overflow-y:auto; }
  .dc-target { display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:6px;border:1px solid var(--border);cursor:pointer;font-size:12px;transition:all .15s; }
  .dc-target:hover { border-color:#ef4444; }
  .dc-target.selected { background:rgba(239,68,68,0.12);border-color:#ef4444; }
  .dc-target.enemy .dc-t-name { color:#f87171; }
  .dc-t-name { width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
  .dc-t-bar { flex:1;height:5px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden; }
  .dc-t-fill { height:100%;border-radius:3px; }
  .dc-t-hp { font-size:10px;color:var(--text-muted);font-family:monospace;width:40px;text-align:right; }
  .dc-empty { color:var(--text-muted);font-style:italic;font-size:12px;text-align:center;padding:10px; }
  .dc-applied { color:#22c55e;font-size:12px;text-align:center; }
  .dc-actions { display:flex;gap:6px; }
  .dc-btn { flex:1;padding:8px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;border:none; }
  .dc-roll { background:#e5a853;color:#000; }
  .dc-dmg { background:#ef4444;color:#fff; }
  .dc-heal { background:#22c55e;color:#000; }
  .dc-sec { background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-muted); }
  .dc-btn:disabled { opacity:.4;cursor:not-allowed; }
</style>
