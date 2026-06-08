<script lang="ts">
  import { getPlayerConnections, sendPrivateMessage } from '$lib/api';
  let visible = $state(false);
  export function toggle() { visible = !visible; }
  
  let players = $state<any[]>([]);
  let targetPlayer = $state('');
  let rumorText = $state('');
  
  async function load() { players = await getPlayerConnections(); }
  $effect(() => { if (visible) load(); });
  
  async function sendRumor() {
    if (targetPlayer && rumorText) {
      await sendPrivateMessage(targetPlayer, '🤫 RUMEUR : ' + rumorText);
      rumorText = '';
      visible = false;
    }
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="cw-backdrop" onclick={() => visible = false}>
    <div class="cw-modal" onclick={e => e.stopPropagation()}>
      <h3>🎭 Système de Murmures (Rumeurs)</h3>
      <select bind:value={targetPlayer}>
        <option value="">-- Choisir un joueur --</option>
        {#each players as p}
          <option value={p.id}>{p.character?.nom || p.name}</option>
        {/each}
      </select>
      <textarea bind:value={rumorText} placeholder="Écrivez une rumeur ou un secret..."></textarea>
      <button onclick={sendRumor} disabled={!targetPlayer || !rumorText}>Chuchoter au joueur</button>
      <button onclick={() => visible = false}>Fermer</button>
    </div>
  </div>
{/if}

<style>
.cw-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; }
.cw-modal { background: #1f2937; padding: 20px; border-radius: 8px; width: 400px; display: flex; flex-direction: column; gap: 10px; color: white; }
textarea { background: #111827; color: white; border: 1px solid #374151; padding: 8px; min-height: 80px; }
button { background: #374151; color: white; border: 1px solid #4b5563; padding: 8px; border-radius: 4px; cursor: pointer; }
button:hover { background: #4b5563; }
</style>
