<script lang="ts">
  import {
    vttStore,
    nextTurn, prevTurn, stopCombat,
    updateCombatantHp, addCombatant, removeCombatant
  } from '$lib/stores/vtt.svelte';

  let showAddForm = $state(false);
  let newName = $state('');
  let newInitiative = $state(10);
  let newHp = $state(10);
  let newIsEnemy = $state(false);

  function submitAdd() {
    if (!newName.trim()) return;
    addCombatant(newName.trim(), newInitiative, newHp, newIsEnemy);
    newName = '';
    newInitiative = 10;
    newHp = 10;
    newIsEnemy = false;
    showAddForm = false;
  }

  function hpDelta(id: string, delta: number) {
    const c = vttStore.combatants.find(c => c.id === id);
    if (c) updateCombatantHp(id, c.hp + delta);
  }

  function currentName() {
    return vttStore.combatants[vttStore.currentTurn]?.name ?? '';
  }

  function round() {
    if (vttStore.combatants.length === 0) return 1;
    // Incrémenter le round à chaque fois qu'on revient au début
    return Math.floor(vttStore.currentTurn / vttStore.combatants.length) + 1;
  }
</script>

<div class="tracker">
  <div class="tracker-header">
    <span class="tracker-title">⚔️ Combat</span>
    <div class="turn-controls">
      <button class="ctrl-btn" onclick={prevTurn} title="Tour précédent">◀</button>
      <span class="current-turn" title="Combattant actuel">{currentName()}</span>
      <button class="ctrl-btn" onclick={nextTurn} title="Tour suivant">▶</button>
    </div>
    <button class="stop-btn" onclick={stopCombat} title="Terminer le combat">✕</button>
  </div>

  <ul class="combatant-list">
    {#each vttStore.combatants as c, i}
      {@const isActive = i === vttStore.currentTurn}
      {@const pct = c.maxHp > 0 ? c.hp / c.maxHp : 1}
      <li class="combatant" class:active={isActive} class:enemy={c.isEnemy} class:dead={c.hp <= 0}>
        <div class="c-initiative">{c.initiative}</div>
        <div class="c-name">{c.name}</div>
        <div class="c-hp-bar-wrap">
          <div class="c-hp-bar" style="width: {Math.max(0, pct * 100)}%; background: {pct > 0.5 ? '#22c55e' : pct > 0.2 ? '#eab308' : '#ef4444'}"></div>
        </div>
        <div class="c-hp-controls">
          <button class="hp-btn" onclick={() => hpDelta(c.id, -1)}>−</button>
          <span class="c-hp">{c.hp}/{c.maxHp}</span>
          <button class="hp-btn" onclick={() => hpDelta(c.id, 1)}>+</button>
        </div>
        <button class="remove-btn" onclick={() => removeCombatant(c.id)} title="Retirer">✕</button>
      </li>
    {/each}
  </ul>

  {#if showAddForm}
    <div class="add-form">
      <input class="add-input" type="text" bind:value={newName} placeholder="Nom" onkeydown={e => e.key === 'Enter' && submitAdd()} />
      <input class="add-input narrow" type="number" bind:value={newInitiative} min="1" max="30" title="Initiative" />
      <input class="add-input narrow" type="number" bind:value={newHp} min="1" title="PV Max" />
      <label class="enemy-check">
        <input type="checkbox" bind:checked={newIsEnemy} />
        Ennemi
      </label>
      <button class="add-confirm" onclick={submitAdd}>✓</button>
      <button class="add-cancel"  onclick={() => showAddForm = false}>✕</button>
    </div>
  {:else}
    <button class="add-btn" onclick={() => showAddForm = true}>+ Ajouter combattant</button>
  {/if}
</div>

<style>
  .tracker {
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
    max-height: 280px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .tracker-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(239, 68, 68, 0.08);
    border-bottom: 1px solid rgba(239, 68, 68, 0.2);
    flex-shrink: 0;
  }

  .tracker-title {
    font-size: 12px;
    font-weight: 700;
    color: #ef4444;
    letter-spacing: 0.5px;
  }

  .turn-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    justify-content: center;
  }

  .ctrl-btn {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    width: 24px;
    height: 24px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  .ctrl-btn:hover { background: var(--bg-hover); }

  .current-turn {
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
    min-width: 80px;
    text-align: center;
  }

  .stop-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 14px;
    padding: 2px 4px;
    border-radius: 3px;
  }
  .stop-btn:hover { color: #ef4444; background: rgba(239, 68, 68, 0.1); }

  /* Liste des combattants */
  .combatant-list {
    list-style: none;
    margin: 0;
    padding: 4px;
    overflow-y: auto;
    flex: 1;
  }

  .combatant {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    border-radius: 5px;
    border: 1px solid transparent;
    transition: all 0.15s;
    font-size: 12px;
  }

  .combatant.active {
    background: rgba(229, 168, 83, 0.12);
    border-color: var(--accent);
  }

  .combatant.enemy .c-name { color: #ef4444; }
  .combatant.dead { opacity: 0.45; }

  .c-initiative {
    width: 24px;
    text-align: center;
    font-weight: 700;
    color: var(--accent);
    font-size: 13px;
    flex-shrink: 0;
  }

  .c-name {
    flex: 1;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .c-hp-bar-wrap {
    width: 48px;
    height: 5px;
    background: var(--bg-tertiary);
    border-radius: 3px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .c-hp-bar {
    height: 100%;
    border-radius: 3px;
    transition: width 0.2s, background 0.2s;
  }

  .c-hp-controls {
    display: flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
  }

  .hp-btn {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    width: 20px;
    height: 20px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .hp-btn:hover { background: var(--bg-hover); }

  .c-hp {
    font-size: 11px;
    color: var(--text-secondary);
    min-width: 36px;
    text-align: center;
  }

  .remove-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 11px;
    padding: 2px 4px;
    border-radius: 3px;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .combatant:hover .remove-btn { opacity: 1; }
  .remove-btn:hover { color: #ef4444; }

  /* Formulaire ajout */
  .add-form {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-top: 1px solid var(--border);
    background: var(--bg-tertiary);
    flex-shrink: 0;
  }

  .add-input {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    flex: 1;
    outline: none;
  }
  .add-input.narrow { flex: 0 0 48px; text-align: center; }
  .add-input:focus { border-color: var(--accent); }

  .enemy-check {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--text-secondary);
    cursor: pointer;
    white-space: nowrap;
  }

  .add-confirm, .add-cancel {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-secondary);
    width: 26px;
    height: 26px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .add-confirm { border-color: var(--accent); color: var(--accent); }
  .add-confirm:hover { background: rgba(229, 168, 83, 0.15); }
  .add-cancel:hover { background: var(--bg-hover); }

  .add-btn {
    display: block;
    width: 100%;
    padding: 7px;
    background: transparent;
    border: none;
    border-top: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
    text-align: center;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .add-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
</style>
