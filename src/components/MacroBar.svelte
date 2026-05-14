<script lang="ts">
  import { vttStore, addGmToken, updateCombatantHp, triggerTokenAnimation } from '$lib/stores/vtt.svelte';

  let { onRollRequest } = $props<{ onRollRequest: (formula: string) => void }>();

  let macroInput = $state('');
  let history = $state<string[]>([]);

  const MACROS = [
    { name: '🎲 d100', cmd: '/roll 1d100' },
    { name: '❤️ Soin Groupe', cmd: '/heal group 5' },
    { name: '💀 Dégâts', cmd: '/dmg' },
    { name: '⚔️ Attaque', cmd: '/anim attack' },
  ];

  function runCommand(cmd: string) {
    if (!cmd.startsWith('/')) {
      onRollRequest(cmd);
      return;
    }

    const parts = cmd.split(' ');
    const base = parts[0].toLowerCase();

    if (base === '/roll') {
      onRollRequest(parts.slice(1).join(' '));
    } else if (base === '/heal') {
      const amount = parseInt(parts[2]) || 5;
      vttStore.tokens.forEach(t => {
        if (!t.isEnemy && t.hp !== undefined) {
          t.hp = Math.min(t.maxHp || 100, t.hp + amount);
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

    if (cmd !== history[0]) history = [cmd, ...history].slice(0, 10);
    macroInput = '';
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && macroInput) {
      runCommand(macroInput);
    }
  }
</script>

<div class="macro-bar">
  <div class="preset-macros">
    {#each MACROS as macro}
      <button onclick={() => runCommand(macro.cmd)}>{macro.name}</button>
    {/each}
  </div>
  <input 
    type="text" 
    bind:value={macroInput} 
    onkeydown={onKeydown}
    placeholder="Ex: /roll 2d10 + 5 ou commande..."
  />
</div>

<style>
  .macro-bar {
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: rgba(13, 17, 23, 0.9);
    border: 1px solid rgba(229, 168, 83, 0.3);
    border-radius: 8px;
    padding: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    width: 320px;
  }

  .preset-macros {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  button {
    background: rgba(229, 168, 83, 0.1);
    border: 1px solid rgba(229, 168, 83, 0.3);
    color: #e5a853;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
  }

  button:hover {
    background: rgba(229, 168, 83, 0.2);
    border-color: #e5a853;
  }

  input {
    background: #0d1117;
    border: 1px solid #30363d;
    color: #c9d1d9;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 13px;
    outline: none;
  }

  input:focus {
    border-color: #e5a853;
  }
</style>
