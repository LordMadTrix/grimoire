<script lang="ts">
  import { vttStore, updateCombatantHp, addCombatLogEntry } from '$lib/stores/vtt.svelte';

  let { onclose }: { onclose: () => void } = $props();

  let activeTab = $state<'damage' | 'opposed'>('damage');

  // Mode 1: Dégâts directs
  let diceFormula = $state('1d6+3');
  let targetIds = $state<Set<string>>(new Set());
  let halfDamage = $state(false);
  let lastRoll = $state<number | null>(null);
  let applied = $state(false);

  // Mode 2: Test Opposé WFRP (SL net)
  let attackerSkill = $state(45);
  let attackerMod = $state(0);
  let attackerRoll = $state<number | null>(null);

  let defenderSkill = $state(40);
  let defenderMod = $state(0);
  let defenderRoll = $state<number | null>(null);

  let weaponDamage = $state(4); // Ex: BF + 4
  let defenderToughness = $state(3); // E
  let defenderArmor = $state(1); // PA

  function rnd(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  function parseDice(formula: string): number {
    let total = 0;
    const parts = formula.toLowerCase().replace(/\s/g, '').match(/([+-]?\d*d\d+|[+-]?\d+)/g) ?? [];
    for (const p of parts) {
      if (p.includes('d')) {
        const [nStr, dStr] = p.split('d');
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

  // Fonctions WFRP SL
  function calcSL(target: number, roll: number): number {
    return Math.floor(target / 10) - Math.floor(roll / 10);
  }

  function getHitLocation(roll: number): { loc: string, icon: string } {
    // Inversion des chiffres du jet de d100
    const tens = Math.floor(roll / 10);
    const units = roll % 10;
    const rev = units * 10 + (tens === 10 ? 0 : tens);

    if (rev <= 9) return { loc: 'Tête', icon: '🧠' };
    if (rev <= 24) return { loc: 'Bras gauche', icon: '💪' };
    if (rev <= 44) return { loc: 'Bras droit', icon: '🗡️' };
    if (rev <= 79) return { loc: 'Corps / Torse', icon: '🛡️' };
    if (rev <= 89) return { loc: 'Jambe gauche', icon: '🦵' };
    return { loc: 'Jambe droite', icon: '🦵' };
  }

  let opposedResult = $derived((() => {
    if (attackerRoll === null || defenderRoll === null) return null;
    const attTotal = attackerSkill + attackerMod;
    const defTotal = defenderSkill + defenderMod;
    const attSL = calcSL(attTotal, attackerRoll);
    const defSL = calcSL(defTotal, defenderRoll);
    const netSL = attSL - defSL;
    const hit = getHitLocation(attackerRoll);
    
    // Calcul des dégâts WFRP : SL net + dégâts arme - E - Armure
    const rawDamage = Math.max(1, netSL + weaponDamage - defenderToughness - defenderArmor);

    const success = netSL > 0 && attackerRoll <= attTotal;

    return {
      attSL,
      defSL,
      netSL,
      success,
      hitLoc: hit.loc,
      hitIcon: hit.icon,
      // Doit dépendre de `success` (qui vérifie aussi que l'attaquant a réussi son propre
      // test), pas seulement de netSL > 0 — sinon un attaquant qui RATE son test peut
      // quand même produire des dégâts si le défenseur a un SL encore pire.
      calculatedDamage: success ? rawDamage : 0
    };
  })());

  function rollOpposed() {
    attackerRoll = rnd(1, 100);
    defenderRoll = rnd(1, 100);
    if (opposedResult && opposedResult.calculatedDamage > 0) {
      lastRoll = opposedResult.calculatedDamage;
    }
  }

  const PRESETS = ['1d6', '2d6', '1d10', '2d10', '1d6+3', '2d6+5', '3d6', '1d20'];
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="dc-backdrop" onclick={onclose} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="dc-modal" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
    <div class="dc-header">
      <span>⚔️ Moteur Tactique & Dégâts</span>
      <button class="dc-close" onclick={onclose}>×</button>
    </div>

    <div class="dc-tabs">
      <button class="dc-tab" class:active={activeTab === 'damage'} onclick={() => activeTab = 'damage'}>💥 Dégâts Rapides</button>
      <button class="dc-tab" class:active={activeTab === 'opposed'} onclick={() => activeTab = 'opposed'}>🎯 Opposition WFRP (SL)</button>
    </div>

    {#if activeTab === 'damage'}
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

    {:else}
      <!-- Mode Opposition WFRP -->
      <div class="dc-opposed-grid">
        <div class="dc-opp-col">
          <div class="dc-col-title">⚔️ Attaquant</div>
          <div class="dc-opp-row">
            <span class="dc-mini-lbl">CC/CT:</span>
            <input type="number" class="dc-num-input" bind:value={attackerSkill} min="1" max="100" />
            <span class="dc-mini-lbl">Mod:</span>
            <input type="number" class="dc-num-input" bind:value={attackerMod} step="10" placeholder="0" />
          </div>
          <div class="dc-roll-val">Jet: <strong>{attackerRoll ?? '—'}</strong></div>
        </div>

        <div class="dc-opp-col">
          <div class="dc-col-title">🛡️ Défenseur</div>
          <div class="dc-opp-row">
            <span class="dc-mini-lbl">CC/Esq:</span>
            <input type="number" class="dc-num-input" bind:value={defenderSkill} min="1" max="100" />
            <span class="dc-mini-lbl">Mod:</span>
            <input type="number" class="dc-num-input" bind:value={defenderMod} step="10" placeholder="0" />
          </div>
          <div class="dc-roll-val">Jet: <strong>{defenderRoll ?? '—'}</strong></div>
        </div>
      </div>

      <!-- Paramètres de dégâts WFRP -->
      <div class="dc-wfrp-params">
        <div class="dc-param-item">
          <span>Arme (BF+):</span>
          <input type="number" class="dc-num-input" bind:value={weaponDamage} min="0" />
        </div>
        <div class="dc-param-item">
          <span>BE Cible:</span>
          <input type="number" class="dc-num-input" bind:value={defenderToughness} min="0" />
        </div>
        <div class="dc-param-item">
          <span>PA Cible:</span>
          <input type="number" class="dc-num-input" bind:value={defenderArmor} min="0" />
        </div>
      </div>

      <button class="dc-btn dc-roll" style="width:100%" onclick={rollOpposed}>🎲 Résoudre Passe d'Armes</button>

      {#if opposedResult}
        <div class="dc-sl-result" class:success={opposedResult.success}>
          <div class="dc-sl-header">
            <span>SL Att: <strong>{opposedResult.attSL >= 0 ? `+${opposedResult.attSL}` : opposedResult.attSL}</strong></span>
            <span>vs</span>
            <span>SL Déf: <strong>{opposedResult.defSL >= 0 ? `+${opposedResult.defSL}` : opposedResult.defSL}</strong></span>
          </div>
          <div class="dc-sl-net">
            SL Net: <strong>{opposedResult.netSL >= 0 ? `+${opposedResult.netSL}` : opposedResult.netSL}</strong>
            {#if opposedResult.success}
              <span class="dc-hit-badge">{opposedResult.hitIcon} {opposedResult.hitLoc}</span>
            {/if}
          </div>
          {#if opposedResult.success}
            <div class="dc-final-dmg">Dégâts infligés : <strong>{opposedResult.calculatedDamage} PV</strong></div>
          {:else}
            <div class="dc-parry-txt">🛡️ Attaque parée ou esquivée !</div>
          {/if}
        </div>
      {/if}
    {/if}

    <!-- Cibles -->
    <div class="dc-targets-title">Cibles :</div>
    <div class="dc-targets">
      {#if vttStore.combatants.length === 0}
        <div class="dc-empty">Aucun combattant actif</div>
      {:else}
        {#each vttStore.combatants as c (c.id)}
          {@const pct = c.maxHp > 0 ? c.hp / c.maxHp : 0}
          <button
            type="button"
            class="dc-target"
            class:selected={targetIds.has(c.id)}
            class:enemy={c.isEnemy}
            onclick={() => toggleTarget(c.id)}
          >
            <span class="dc-t-name">{c.name}</span>
            <div class="dc-t-bar"><div class="dc-t-fill" style="width:{pct*100}%;background:{pct>0.5?'#22c55e':pct>0.2?'#eab308':'#ef4444'}"></div></div>
            <span class="dc-t-hp">{c.hp}/{c.maxHp}</span>
          </button>
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
  .dc-modal { background:var(--bg-secondary,#161b22);border:1px solid var(--border,#2d3748);border-radius:12px;padding:18px;width:380px;max-width:95vw;display:flex;flex-direction:column;gap:10px;box-shadow:0 12px 40px rgba(0,0,0,.7); }
  .dc-header { display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:700;color:var(--accent,#e5a853); }
  .dc-close { background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:20px; }
  
  .dc-tabs { display:flex;gap:6px;border-bottom:1px solid var(--border);padding-bottom:8px; }
  .dc-tab { flex:1;padding:6px;border-radius:6px;border:none;background:var(--bg-tertiary);color:var(--text-muted);font-size:11px;font-weight:600;cursor:pointer; }
  .dc-tab.active { background:var(--accent);color:#000; }

  .dc-row { display:flex;gap:6px; }
  .dc-input { flex:1;background:var(--bg-tertiary,#1c2233);border:1px solid var(--border);border-radius:6px;color:var(--text-primary,#c9d1d9);padding:8px 10px;font-size:14px;font-family:monospace; }
  .dc-presets { display:flex;flex-wrap:wrap;gap:4px; }
  .dc-preset { background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;color:var(--text-muted);padding:3px 8px;font-size:11px;cursor:pointer;font-family:monospace; }
  .dc-preset:hover { border-color:#ef4444;color:#ef4444; }
  .dc-result { display:flex;align-items:center;gap:10px;justify-content:center;padding:10px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px; }
  .dc-result-val { font-size:36px;font-weight:800;color:#ef4444; }
  .dc-result-label { font-size:13px;color:var(--text-muted); }
  .dc-check { display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-muted);cursor:pointer; }
  
  .dc-opposed-grid { display:flex;gap:10px;background:rgba(0,0,0,0.25);padding:8px;border-radius:8px;border:1px solid var(--border); }
  .dc-opp-col { flex:1;display:flex;flex-direction:column;gap:4px; }
  .dc-col-title { font-size:11px;font-weight:bold;color:var(--accent); }
  .dc-opp-row { display:flex;align-items:center;gap:4px;font-size:11px; }
  .dc-mini-lbl { font-size:10px;color:var(--text-muted); }
  .dc-num-input { width:42px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;color:white;padding:3px;font-size:11px;text-align:center; }
  .dc-roll-val { font-size:11px;color:var(--text-muted);margin-top:2px; }

  .dc-wfrp-params { display:flex;justify-content:space-between;gap:6px;background:rgba(255,255,255,0.03);padding:6px;border-radius:6px;font-size:11px;color:var(--text-muted); }
  .dc-param-item { display:flex;align-items:center;gap:4px; }

  .dc-sl-result { padding:10px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);display:flex;flex-direction:column;gap:4px;text-align:center;font-size:12px; }
  .dc-sl-result.success { background:rgba(34,197,94,0.1);border-color:rgba(34,197,94,0.4); }
  .dc-sl-header { display:flex;justify-content:space-around;color:var(--text-muted); }
  .dc-sl-net { font-size:14px;color:white;display:flex;align-items:center;justify-content:center;gap:8px; }
  .dc-hit-badge { background:rgba(229,168,83,0.2);color:var(--accent);padding:2px 6px;border-radius:4px;font-size:11px; }
  .dc-final-dmg { font-size:15px;font-weight:bold;color:#ef4444;margin-top:2px; }
  .dc-parry-txt { color:#60a5fa;font-weight:bold; }

  .dc-targets-title { font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.07em;margin-top:4px; }
  .dc-targets { display:flex;flex-direction:column;gap:4px;max-height:120px;overflow-y:auto; }
  .dc-target { display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:transparent;color:inherit;width:100%;text-align:left;font-family:inherit;cursor:pointer;font-size:12px;transition:all .15s; }
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

