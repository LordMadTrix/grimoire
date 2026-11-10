<script lang="ts">
  import { onMount } from 'svelte';
  import {
    vttStore,
    nextTurn, prevTurn, stopCombat,
    updateCombatantHp, addCombatant, removeCombatant,
    rollAllInitiatives
  } from '$lib/stores/vtt.svelte';
  import { ttsReader } from '$lib/stores/ttsReader.svelte';
  import { synthesizeNeuralSpeech } from '$lib/services/edgeTts';
  import { combatLogStore } from '$lib/stores/combatLogStore.svelte';
  import { notifStore } from '$lib/stores/notifications.svelte';

  let showAddForm = $state(false);
  let newName = $state('');
  let newInitiative = $state(10);
  let newHp = $state(10);
  let newIsEnemy = $state(false);

  // Position flottante & drag
  let posX = $state(window.innerWidth ? Math.max(20, window.innerWidth - 380) : 600);
  let posY = $state(80);
  let isDragging = $state(false);
  let dragOffset = { x: 0, y: 0 };
  let isMinimized = $state(false);

  onMount(() => {
    try {
      const saved = localStorage.getItem('grimoire_initiative_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          posX = Math.max(10, Math.min(window.innerWidth - 320, parsed.x));
          posY = Math.max(10, Math.min(window.innerHeight - 80, parsed.y));
        }
      }
    } catch {}
  });

  function startDrag(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('button, input, select, a, textarea')) return;
    isDragging = true;
    dragOffset = { x: e.clientX - posX, y: e.clientY - posY };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    posX = Math.max(10, Math.min(window.innerWidth - 280, e.clientX - dragOffset.x));
    posY = Math.max(10, Math.min(window.innerHeight - 60, e.clientY - dragOffset.y));
  }

  function onMouseUp() {
    if (isDragging) {
      isDragging = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      try {
        localStorage.setItem('grimoire_initiative_pos', JSON.stringify({ x: posX, y: posY }));
      } catch {}
    }
  }

  function submitAdd() {
    if (!newName.trim()) return;
    addCombatant(newName.trim(), newInitiative, newHp, newIsEnemy);
    newName = '';
    newInitiative = 10;
    newHp = 10;
    newIsEnemy = false;
    showAddForm = false;
  }

  async function announceEpic(text: string) {
    if (!vttStore.combatAnnouncerEnabled) return;
    try {
      const voice = ttsReader.selectedVoiceName || 'fr-FR-HenriNeural';
      const audioUrl = await synthesizeNeuralSpeech(text, voice, 1.08, 1.0);
      const audio = new Audio(audioUrl);
      audio.volume = 1.0;
      audio.play().catch(() => {});
    } catch {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const ut = new SpeechSynthesisUtterance(text);
        ut.lang = 'fr-FR';
        ut.rate = 1.1;
        window.speechSynthesis.speak(ut);
      }
    }
  }

  function hpDelta(id: string, delta: number) {
    const c = vttStore.combatants.find(c => c.id === id);
    if (c) {
      const prevHp = c.hp;
      const nextHp = c.hp + delta;
      updateCombatantHp(id, nextHp);
      
      // Enregistrement chronologique
      if (delta < 0) {
        combatLogStore.add(c.name, `subit ${-delta} dégâts (${nextHp}/${c.maxHp} PV)`, 'damage', round());
      } else if (delta > 0) {
        combatLogStore.add(c.name, `récupère ${delta} PV (${nextHp}/${c.maxHp} PV)`, 'heal', round());
      }

      if (prevHp > 0 && nextHp <= 0) {
        combatLogStore.add(c.name, `s'effondre au combat !`, 'defeat', round());
        announceEpic(`${c.name} s'effondre au combat !`);
      }
    }
  }

  function handleNextTurn() {
    nextTurn();
    const cur = currentName();
    if (cur) {
      combatLogStore.add(cur, `prend son tour d'action`, 'turn', round());
    }
    if (vttStore.combatAnnouncerEnabled) {
      setTimeout(() => {
        if (cur) announceEpic(`C'est au tour de ${cur} !`);
      }, 200);
    }
  }

  function currentName() {
    return vttStore.combatants[vttStore.currentTurn]?.name ?? '';
  }

  function round() {
    if (vttStore.combatants.length === 0) return 1;
    return Math.floor(vttStore.currentTurn / vttStore.combatants.length) + 1;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="tracker" 
  class:minimized={isMinimized}
  class:is-dragging={isDragging}
  style="top: {posY}px; left: {posX}px;"
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="tracker-header" onmousedown={startDrag}>
    <div style="display:flex; align-items:center; gap:6px;">
      <span class="tracker-drag-handle" title="Glisser pour déplacer le panneau de combat">✥</span>
      <span class="tracker-title">⚔️ Combat R.{round()}</span>
      <button 
        type="button" 
        class="roll-btn announcer-toggle-btn"
        class:active={vttStore.combatAnnouncerEnabled}
        onclick={() => vttStore.combatAnnouncerEnabled = !vttStore.combatAnnouncerEnabled}
        title={vttStore.combatAnnouncerEnabled ? "🎙️ Annonceur de combat vocal ACTIF (cliquer pour couper)" : "🔇 Annonceur de combat vocal COUPÉ"}
      >
        {vttStore.combatAnnouncerEnabled ? '🎙️ Vocal ON' : '🔇 Vocal OFF'}
      </button>
      <button type="button" class="roll-btn" onclick={() => rollAllInitiatives('d20')} title="Lancer toutes les initiatives (d20)">🎲 d20</button>
      <button type="button" class="roll-btn wfrp" onclick={() => rollAllInitiatives('wfrp')} title="Lancer toutes les initiatives (WFRP 1d10+3)">🎲 WFRP</button>
    </div>
    
    <div class="turn-controls">
      <button class="ctrl-btn" onclick={prevTurn} title="Tour précédent">◀</button>
      <span class="current-turn" title="Combattant actuel">{currentName()}</span>
      <button class="ctrl-btn" onclick={handleNextTurn} title="Tour suivant">▶</button>
    </div>

    <div class="header-actions">
      <button class="icon-btn" onclick={() => isMinimized = !isMinimized} title={isMinimized ? "Agrandir" : "Réduire"}>
        {isMinimized ? '🗖' : '🗕'}
      </button>
      <button class="stop-btn" onclick={stopCombat} title="Terminer le combat">✕</button>
    </div>
  </div>

  {#if !isMinimized}
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
    <div class="combat-footer-row">
      <button class="add-btn" onclick={() => showAddForm = true}>+ Ajouter</button>
      <button 
        type="button" 
        class="log-toggle-btn"
        class:active={combatLogStore.isDrawerOpen}
        onclick={() => combatLogStore.toggleDrawer()}
        title="Ouvrir l'historique chronologique des actions et le résumé IA"
      >
        📜 Log ({combatLogStore.entries.length})
      </button>
    </div>
  {/if}

  {#if combatLogStore.isDrawerOpen}
    <div class="combat-log-drawer">
      <div class="cld-header">
        <span class="cld-title">📜 Chronique de la Bataille</span>
        <div class="cld-actions">
          <button
            type="button"
            class="cld-btn-ai"
            onclick={() => combatLogStore.generateBattleNarrative()}
            disabled={combatLogStore.isGeneratingNarrative}
            title="Générer un compte-rendu héroïque par Ollama"
          >
            {combatLogStore.isGeneratingNarrative ? '⏳ Rédaction…' : '🪄 Résumé IA'}
          </button>
          <button type="button" class="cld-btn-clear" onclick={() => combatLogStore.clear()} title="Effacer l'historique">🗑️</button>
        </div>
      </div>

      {#if combatLogStore.generatedNarrative}
        <div class="cld-narrative-box">
          <div class="cld-narrative-title">✨ Récit Épique (Ollama) :</div>
          <p class="cld-narrative-text">{combatLogStore.generatedNarrative}</p>
          <button
            type="button"
            class="cld-btn-copy"
            onclick={() => {
              navigator.clipboard.writeText(combatLogStore.generatedNarrative);
              notifStore.add('📋', 'Copié !', 'Résumé copié dans le presse-papier', 'success', 2000);
            }}
          >
            📋 Copier le Récit
          </button>
        </div>
      {/if}

      <div class="cld-list">
        {#if combatLogStore.entries.length === 0}
          <div class="cld-empty">Aucune action enregistrée pour le moment.</div>
        {:else}
          {#each combatLogStore.entries as entry (entry.id)}
            <div class="cld-item cld-type-{entry.type}">
              <span class="cld-time">{entry.time} · R.{entry.round}</span>
              <span class="cld-actor">{entry.actor}</span>
              <span class="cld-action">{entry.action}</span>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
  {/if}
</div>

<style>
  .tracker {
    position: fixed;
    z-index: 9050;
    width: 340px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    user-select: none;
    pointer-events: auto;
    transition: width 0.2s;
  }

  .tracker.is-dragging {
    opacity: 0.95;
    cursor: grabbing !important;
  }

  .tracker.minimized {
    width: 320px;
  }

  .tracker-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(239, 68, 68, 0.12);
    border-bottom: 1px solid rgba(239, 68, 68, 0.25);
    flex-shrink: 0;
    cursor: grab;
  }
  .tracker-header:active {
    cursor: grabbing;
  }

  .tracker-drag-handle {
    color: #ef4444;
    font-size: 13px;
    cursor: grab;
    opacity: 0.8;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
  }

  .icon-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 12px;
    padding: 2px 4px;
    border-radius: 3px;
    transition: all 0.15s;
  }
  .icon-btn:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  .tracker-title {
    font-size: 12px;
    font-weight: 700;
    color: #ef4444;
    letter-spacing: 0.5px;
  }

  .roll-btn {
    background: rgba(229, 168, 83, 0.15);
    border: 1px solid rgba(229, 168, 83, 0.4);
    color: #e5a853;
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
    padding: 2px 7px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .announcer-toggle-btn.active {
    background: rgba(56, 189, 248, 0.25);
    border-color: #38bdf8;
    color: #38bdf8;
    box-shadow: 0 0 8px rgba(56, 189, 248, 0.35);
  }

  .roll-btn:hover {
    background: rgba(229, 168, 83, 0.3);
    border-color: #e5a853;
  }

  .roll-btn.wfrp {
    background: rgba(56, 189, 248, 0.15);
    border-color: rgba(56, 189, 248, 0.4);
    color: #38bdf8;
  }

  .roll-btn.wfrp:hover {
    background: rgba(56, 189, 248, 0.3);
    border-color: #38bdf8;
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

  .combat-footer-row {
    display: flex;
    align-items: center;
    border-top: 1px solid var(--border);
    background: rgba(0, 0, 0, 0.2);
  }

  .add-btn {
    flex: 1;
    padding: 7px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 11.5px;
    cursor: pointer;
    text-align: center;
    transition: all 0.15s;
  }
  .add-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

  .log-toggle-btn {
    background: none;
    border: none;
    border-left: 1px solid var(--border);
    padding: 7px 12px;
    color: #94a3b8;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .log-toggle-btn:hover, .log-toggle-btn.active {
    background: rgba(229, 168, 83, 0.15);
    color: #fbbf24;
  }

  /* Drawer Log de combat */
  .combat-log-drawer {
    border-top: 1.5px solid rgba(229, 168, 83, 0.35);
    background: #090d16;
    max-height: 220px;
    display: flex;
    flex-direction: column;
    padding: 8px 10px;
    gap: 6px;
    animation: fadeIn 0.2s ease;
  }

  .cld-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .cld-title {
    font-size: 11px;
    font-weight: 800;
    color: #e5a853;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .cld-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .cld-btn-ai {
    background: rgba(229, 168, 83, 0.15);
    border: 1px solid rgba(229, 168, 83, 0.4);
    color: #fbbf24;
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 10.5px;
    font-weight: 700;
    cursor: pointer;
  }
  .cld-btn-ai:hover:not(:disabled) {
    background: #e5a853;
    color: #000;
  }
  .cld-btn-clear {
    background: none;
    border: none;
    font-size: 11px;
    cursor: pointer;
    opacity: 0.6;
  }
  .cld-btn-clear:hover { opacity: 1; }

  .cld-narrative-box {
    background: rgba(229, 168, 83, 0.08);
    border: 1px solid rgba(229, 168, 83, 0.3);
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 11px;
  }
  .cld-narrative-title {
    color: #fbbf24;
    font-weight: 700;
    margin-bottom: 3px;
  }
  .cld-narrative-text {
    color: #f1f5f9;
    line-height: 1.4;
    margin: 0 0 6px 0;
    font-style: italic;
  }
  .cld-btn-copy {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #fff;
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 10px;
    cursor: pointer;
  }

  .cld-list {
    overflow-y: auto;
    max-height: 130px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    scrollbar-width: thin;
  }
  .cld-empty {
    font-size: 11px;
    color: #64748b;
    text-align: center;
    padding: 8px 0;
  }
  .cld-item {
    font-size: 11px;
    display: flex;
    align-items: baseline;
    gap: 5px;
    line-height: 1.3;
    padding: 2px 4px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.02);
  }
  .cld-time {
    color: #64748b;
    font-size: 9.5px;
    font-family: monospace;
    flex-shrink: 0;
  }
  .cld-actor {
    font-weight: 700;
    color: #e2e8f0;
    flex-shrink: 0;
  }
  .cld-action {
    color: #cbd5e1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cld-type-damage .cld-action { color: #f87171; }
  .cld-type-heal .cld-action { color: #4ade80; }
  .cld-type-defeat { background: rgba(239, 68, 68, 0.15); }
  .cld-type-defeat .cld-action { color: #fca5a5; font-weight: 700; }
</style>
