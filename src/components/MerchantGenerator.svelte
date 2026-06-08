<script lang="ts">
  import { broadcastToPlayers } from '$lib/api';
  let visible = $state(false);
  export function toggle() { visible = !visible; }
  
  let townSize = $state('village');
  let items = $state<{name:string, price:string}[]>([]);
  
  function generate() {
    const base = [
      { name: 'Corde (10m)', price: '1 CO' },
      { name: 'Rations (1 jour)', price: '5 Sous' },
      { name: 'Torche', price: '2 Sous' }
    ];
    if (townSize === 'town' || townSize === 'city') {
      base.push({ name: 'Épée longue', price: '15 CO' });
      base.push({ name: 'Armure de cuir', price: '20 CO' });
    }
    if (townSize === 'city') {
      base.push({ name: 'Potion de soins', price: '50 CO' });
      base.push({ name: 'Livre de sorts', price: '100 CO' });
    }
    items = base;
  }
  
  function share() {
    broadcastToPlayers('open_shop', { items });
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="cw-backdrop" onclick={() => visible = false}>
    <div class="cw-modal" onclick={e => e.stopPropagation()}>
      <h3>🛍️ Marchand Générateur</h3>
      <select bind:value={townSize}>
        <option value="village">Village (Basique)</option>
        <option value="town">Bourgade (Standard)</option>
        <option value="city">Cité (Avancé)</option>
      </select>
      <button onclick={generate}>Générer Inventaire</button>
      {#if items.length > 0}
        <ul style="margin:0; padding-left: 20px;">
          {#each items as item}
            <li>{item.name} - {item.price}</li>
          {/each}
        </ul>
        <button style="background: rgba(229,168,83,0.15); color: #e5a853;" onclick={share}>Partager aux Joueurs</button>
      {/if}
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
