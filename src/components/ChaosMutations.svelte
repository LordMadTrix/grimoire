<script lang="ts">
  import { getPlayerConnections, sendPrivateMessage } from '$lib/api';
  let visible = $state(false);
  export function toggle() { visible = !visible; }
  
  let players = $state<any[]>([]);
  let targetPlayer = $state('');
  
  async function load() { players = await getPlayerConnections(); }
  $effect(() => { if (visible) load(); });
  
  const muts = [
    "Œil supplémentaire : +10 Perception, relance les tests de vision.",
    "Bras Tentaculaire : Impossible de porter un bouclier, +1 Attaque.",
    "Sang Acide : Quiconque blesse au corps-à-corps subit 1 point de dégât.",
    "Peau Écailleuse : +1 Point d'Armure naturel.",
    "Corne Démoniaque : +1D10 dégâts en chargeant."
  ];
  
  async function applyMut() {
    if (targetPlayer) {
      const mut = muts[Math.floor(Math.random() * muts.length)];
      await sendPrivateMessage(targetPlayer, 'MUTATION DU CHAOS : ' + mut);
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
      <h3>🌑 Mutations du Chaos</h3>
      <select bind:value={targetPlayer}>
        <option value="">-- Choisir un joueur --</option>
        {#each players as p}
          <option value={p.id}>{p.character?.nom || p.name} (Corrupt: {p.character?.corruption || 0})</option>
        {/each}
      </select>
      <button onclick={applyMut} disabled={!targetPlayer}>Générer & Envoyer une Mutation</button>
      <button onclick={() => visible = false}>Fermer</button>
    </div>
  </div>
{/if}

<style>
.cw-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; }
.cw-modal { background: #1f2937; padding: 20px; border-radius: 8px; width: 400px; display: flex; flex-direction: column; gap: 10px; color: white; }
button { background: #374151; color: white; border: 1px solid #4b5563; padding: 8px; border-radius: 4px; cursor: pointer; }
button:hover { background: #4b5563; }
</style>
