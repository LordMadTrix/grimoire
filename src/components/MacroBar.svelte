<script lang="ts">
  import { vttStore, addCombatLogEntry, triggerTokenAnimation } from '$lib/stores/vtt.svelte';

  let { onRollRequest } = $props<{ onRollRequest: (formula: string) => void }>();

  type Macro = { id: string; name: string; icon: string; cmd: string };

  const DEFAULT_MACROS: Macro[] = [
    { id: '1', name: 'd100', icon: '🎲', cmd: '/roll 1d100' },
    { id: '2', name: 'd20', icon: '🎯', cmd: '/roll 1d20' },
    { id: '3', name: 'Soin', icon: '💚', cmd: '/heal group 5' },
    { id: '4', name: 'Attaque', icon: '⚔️', cmd: '/anim attack' },
    { id: '5', name: 'Hit', icon: '💥', cmd: '/anim hit' },
    { id: '6', name: 'Lumière', icon: '🕯️', cmd: '/fx light' },
  ];

  let macros = $state<Macro[]>([...DEFAULT_MACROS]);
  let macroInput = $state('');
  let history = $state<string[]>([]);
  let editingId = $state<string | null>(null);
  let editName = $state('');
  let editIcon = $state('');
  let editCmd = $state('');
  let historyOpen = $state(false);

  // Drag-and-drop reorder
  let dragSrcId: string | null = null;

  function onDragStart(e: DragEvent, id: string) {
    dragSrcId = id;
    e.dataTransfer!.effectAllowed = 'move';
  }
  function onDragOver(e: DragEvent, id: string) {
    e.preventDefault();
    if (!dragSrcId || dragSrcId === id) return;
    const src = macros.findIndex(m => m.id === dragSrcId);
    const dst = macros.findIndex(m => m.id === id);
    if (src < 0 || dst < 0) return;
    const next = [...macros];
    const [moved] = next.splice(src, 1);
    next.splice(dst, 0, moved);
    macros = next;
  }
  function onDragEnd() { dragSrcId = null; }

  function runCommand(cmd: string) {
    if (!cmd.trim()) return;
    if (!cmd.startsWith('/')) { onRollRequest(cmd); return; }

    const parts = cmd.trim().split(' ');
    const base = parts[0].toLowerCase();

    if (base === '/roll') {
      onRollRequest(parts.slice(1).join(' '));
    } else if (base === '/heal') {
      // Accepte à la fois "/heal 20" (montant en 2e mot) et "/heal group 20"
      // (montant en 3e mot, format historique) au lieu de supposer aveuglément ce dernier.
      const amount = parseInt(parts.length >= 3 ? parts[2] : parts[1]) || 5;
      vttStore.tokens.forEach(t => {
        if (!t.isEnemy && t.hp !== undefined && t.maxHp) {
          const prev = t.hp;
          t.hp = Math.min(t.maxHp, t.hp + amount);
          addCombatLogEntry({ type: 'heal', actor: t.name, value: t.hp - prev, detail: `+${t.hp - prev} PV` });
        }
      });
    } else if (base === '/anim') {
      const anim = parts[1] as any;
      vttStore.tokens.forEach(t => {
        if (vttStore.locateTokenId === t.id || !vttStore.locateTokenId) {
          triggerTokenAnimation(t.id, anim);
        }
      });
    }

    if (cmd !== history[0]) history = [cmd, ...history].slice(0, 12);
    macroInput = '';
  }

  function startEdit(m: Macro) {
    editingId = m.id; editName = m.name; editIcon = m.icon; editCmd = m.cmd;
  }

  function saveEdit() {
    macros = macros.map(m => m.id === editingId ? { ...m, name: editName, icon: editIcon, cmd: editCmd } : m);
    editingId = null;
  }

  function deleteMacro(id: string) { macros = macros.filter(m => m.id !== id); }

  function addNewMacro() {
    macros = [...macros, { id: Math.random().toString(36).slice(2), name: 'Macro', icon: '⚡', cmd: '/roll 1d6' }];
  }
</script>

<div class="mb-wrap">
  <div class="mb-presets">
    {#each macros as macro (macro.id)}
      <button
        class="mb-btn"
        draggable="true"
        ondragstart={(e) => onDragStart(e, macro.id)}
        ondragover={(e) => onDragOver(e, macro.id)}
        ondragend={onDragEnd}
        onclick={() => runCommand(macro.cmd)}
        oncontextmenu={(e) => { e.preventDefault(); startEdit(macro); }}
        title="{macro.cmd}\n(clic droit pour éditer)"
      >
        <span class="mb-btn-icon">{macro.icon}</span>
        <span class="mb-btn-label">{macro.name}</span>
      </button>
    {/each}
    <button class="mb-btn mb-add" onclick={addNewMacro} title="Ajouter une macro">+</button>
  </div>

  <div class="mb-input-row">
    <input
      type="text"
      class="mb-input"
      bind:value={macroInput}
      onkeydown={(e) => e.key === 'Enter' && runCommand(macroInput)}
      placeholder="/roll 2d10 ou commande…"
    />
    <button class="mb-run" onclick={() => runCommand(macroInput)}>▶</button>
    <button class="mb-hist-btn" onclick={() => historyOpen = !historyOpen} title="Historique">🕐</button>
  </div>

  {#if historyOpen && history.length > 0}
    <div class="mb-history">
      {#each history as h}
        <button class="mb-hist-item" onclick={() => { macroInput = h; historyOpen = false; }}>{h}</button>
      {/each}
    </div>
  {/if}

  {#if editingId}
    <div class="mb-edit-panel">
      <div class="mb-edit-row">
        <input class="mb-edit-input mb-icon-input" bind:value={editIcon} placeholder="🎲" maxlength="2" />
        <input class="mb-edit-input" bind:value={editName} placeholder="Nom" style="flex:1" />
      </div>
      <input class="mb-edit-input" bind:value={editCmd} placeholder="/roll 1d6" />
      <div class="mb-edit-actions">
        <button class="mb-edit-del" onclick={() => { deleteMacro(editingId!); editingId = null; }}>🗑️</button>
        <button class="mb-edit-cancel" onclick={() => editingId = null}>Annuler</button>
        <button class="mb-edit-save" onclick={saveEdit}>Sauver</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .mb-wrap {
    display: flex; flex-direction: column; gap: 6px;
    background: rgba(13,17,23,0.92);
    border: 1px solid rgba(229,168,83,0.3);
    border-radius: 8px; padding: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,.5);
    backdrop-filter: blur(8px);
    width: 340px;
  }
  .mb-presets { display: flex; flex-wrap: wrap; gap: 4px; }
  .mb-btn {
    display: flex; flex-direction: column; align-items: center; gap: 1px;
    background: rgba(229,168,83,0.08);
    border: 1px solid rgba(229,168,83,0.25);
    border-radius: 6px; padding: 5px 8px; cursor: pointer;
    color: #e5a853; min-width: 46px; transition: all 0.15s;
    user-select: none;
  }
  .mb-btn:hover { background: rgba(229,168,83,0.18); border-color: #e5a853; }
  .mb-btn-icon { font-size: 15px; }
  .mb-btn-label { font-size: 9px; color: #8899b7; white-space: nowrap; }
  .mb-add { color: #4a5568; border-style: dashed; }
  .mb-add:hover { color: #e5a853; }

  .mb-input-row { display: flex; gap: 4px; }
  .mb-input {
    flex: 1; background: #0d1117; border: 1px solid #30363d;
    color: #c9d1d9; padding: 5px 9px; border-radius: 4px; font-size: 12px; outline: none;
  }
  .mb-input:focus { border-color: #e5a853; }
  .mb-run, .mb-hist-btn {
    background: rgba(229,168,83,0.12); border: 1px solid rgba(229,168,83,0.3);
    color: #e5a853; padding: 5px 9px; border-radius: 4px; font-size: 12px; cursor: pointer;
  }
  .mb-run:hover, .mb-hist-btn:hover { background: rgba(229,168,83,0.25); }

  .mb-history {
    display: flex; flex-direction: column; gap: 2px;
    background: #0d1117; border: 1px solid #30363d; border-radius: 5px; padding: 4px;
    max-height: 120px; overflow-y: auto;
  }
  .mb-hist-item {
    text-align: left; background: none; border: none; color: #8899b7;
    font-size: 11px; font-family: monospace; cursor: pointer; padding: 2px 5px; border-radius: 3px;
  }
  .mb-hist-item:hover { background: rgba(255,255,255,0.05); color: #c9d1d9; }

  .mb-edit-panel {
    display: flex; flex-direction: column; gap: 5px;
    background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 8px;
  }
  .mb-edit-row { display: flex; gap: 5px; }
  .mb-edit-input {
    background: #161b22; border: 1px solid #30363d; color: #c9d1d9;
    padding: 5px 8px; border-radius: 4px; font-size: 12px;
  }
  .mb-icon-input { width: 36px; text-align: center; }
  .mb-edit-actions { display: flex; gap: 5px; justify-content: flex-end; }
  .mb-edit-del { background: none; border: none; cursor: pointer; font-size: 14px; }
  .mb-edit-cancel {
    background: none; border: 1px solid #30363d; color: #8899b7;
    padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer;
  }
  .mb-edit-save {
    background: #e5a853; color: #000;
    border: none; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer;
  }
</style>
