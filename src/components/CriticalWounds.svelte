<script lang="ts">
  import { getPlayerConnections, applyConditionToPlayer } from '$lib/api';
  let visible = $state(false);
  export function toggle() { visible = !visible; }
  
  let players = $state<any[]>([]);
  let targetPlayer = $state('');
  
  async function load() { players = await getPlayerConnections(); }
  
  $effect(() => { if (visible) load(); });
  
  const crits = [
    { name: 'Commotion', desc: 'Aveuglé pour 1d10 rounds', cond: 'Aveuglé' },
    { name: 'Hémorragie', desc: 'Perd 1 PV par round', cond: 'Saignement' },
    { name: 'Bras cassé', desc: 'Lâche son arme', cond: 'Désarmé' },
    { name: 'Jambe brisée', desc: 'Mouvement divisé par 2', cond: 'Entravé' },
  ];
  
  async function applyCrit(cond: string) {
    if (targetPlayer) {
      await applyConditionToPlayer(targetPlayer, cond);
      visible = false;
    }
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="cw-backdrop" onclick={() => visible = false} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="cw-modal" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
      <h3>🩸 Blessures Critiques</h3>
      <select bind:value={targetPlayer}>
        <option value="">-- Choisir un joueur --</option>
        {#each players as p}
          <option value={p.id}>{p.character?.nom || p.name}</option>
        {/each}
      </select>
      <div class="crit-grid">
        {#each crits as c}
          <button onclick={() => applyCrit(c.cond)}>
            <strong>{c.name}</strong><br/>
            <small>{c.desc}</small>
          </button>
        {/each}
      </div>
      <button onclick={() => visible = false}>Fermer</button>
    </div>
  </div>
{/if}
<style>
.cw-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; }
.cw-modal { background: #1f2937; padding: 20px; border-radius: 8px; width: 400px; display: flex; flex-direction: column; gap: 10px; color: white; }
.crit-grid { display: flex; flex-direction: column; gap: 8px; }
button { background: #374151; color: white; border: 1px solid #4b5563; padding: 8px; border-radius: 4px; cursor: pointer; text-align: left; }
button:hover { background: #4b5563; }
</style>
