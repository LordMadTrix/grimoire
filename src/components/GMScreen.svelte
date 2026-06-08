<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getPlayerConnections, type PlayerInfo, applyDamageToPlayer } from '$lib/api';

  let visible = $state(false);
  export function toggle() {
    visible = !visible;
    if (visible) refresh();
  }

  let players = $state<PlayerInfo[]>([]);
  let interval: any;

  async function refresh() {
    try {
      players = await getPlayerConnections();
    } catch {
      players = [];
    }
  }

  onMount(() => {
    interval = setInterval(() => {
      if (visible) refresh();
    }, 2000);
  });

  onDestroy(() => {
    if (interval) clearInterval(interval);
  });
</script>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="gm-screen-backdrop" onclick={() => visible = false}>
    <div class="gm-screen-modal" onclick={e => e.stopPropagation()}>
      <div class="gm-screen-header">
        <span class="gm-title">🛡️ Écran du Maître du Jeu (Tactique)</span>
        <button class="gm-close" onclick={() => visible = false}>✕</button>
      </div>
      
      <div class="gm-screen-body">
        {#if players.length === 0}
          <div class="gm-empty">Aucun joueur connecté.</div>
        {:else}
          <div class="gm-grid">
            {#each players as p}
              <div class="gm-card" class:active-turn={p.active_turn}>
                <div class="gm-card-header">
                  <strong>{p.character?.nom || p.name}</strong>
                  <span class="gm-race-voc">{p.character?.race} - {p.character?.voc}</span>
                </div>
                <div class="gm-card-stats">
                  <div class="gm-stat">
                    <span>❤️ PV:</span>
                    <strong class:low-hp={(p.character?.hp || 0) < (p.character?.maxhp || 10) / 3}>
                      {p.character?.hp ?? '?'}/{p.character?.maxhp ?? '?'}
                    </strong>
                  </div>
                  <div class="gm-stat"><span>👁️ Init:</span> <strong>{p.character?.profil?.act?.i ?? '?'}</strong></div>
                  <div class="gm-stat"><span>🔮 Destin:</span> <strong>{p.character?.fate ?? '?'}</strong></div>
                  <div class="gm-stat"><span>🌑 Corrupt:</span> <strong>{p.character?.corruption ?? 0}</strong></div>
                  <div class="gm-stat"><span>🛡️ Endu:</span> <strong>{p.character?.profil?.act?.e ?? '?'}</strong></div>
                  <div class="gm-stat"><span>⚔️ CC:</span> <strong>{p.character?.profil?.act?.cc ?? '?'}</strong></div>
                  <div class="gm-stat"><span>🏹 CT:</span> <strong>{p.character?.profil?.act?.ct ?? '?'}</strong></div>
                  <div class="gm-stat"><span>💪 F:</span> <strong>{p.character?.profil?.act?.f ?? '?'}</strong></div>
                </div>
                {#if p.conditions && p.conditions.length > 0}
                  <div class="gm-conditions">
                    {#each p.conditions as c}
                      <span class="gm-tag">{c}</span>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        <div class="gm-reference">
          <h4>📑 Référence Rapide</h4>
          <div class="gm-ref-grid">
            <div class="gm-ref-box">
              <h5>Difficultés</h5>
              <ul>
                <li>Très Facile (+60)</li>
                <li>Facile (+40)</li>
                <li>Moyenne (+20)</li>
                <li>Standard (+0)</li>
                <li>Difficile (-20)</li>
                <li>Très Diff (-30)</li>
              </ul>
            </div>
            <div class="gm-ref-box">
              <h5>Fautes de Magie (Mineur)</h5>
              <ul>
                <li>01-20: Saignement de nez.</li>
                <li>21-40: Odeur de soufre.</li>
                <li>41-60: Froid intense.</li>
                <li>61-80: Voix démoniaques.</li>
                <li>81-100: Souffle magique (1d10).</li>
              </ul>
            </div>
            <div class="gm-ref-box">
              <h5>Actions de Combat</h5>
              <ul>
                <li>Attaque (Action)</li>
                <li>Mouvement (Action/Mvt)</li>
                <li>Recharger (Action/Multiple)</li>
                <li>Feindre (Action)</li>
                <li>Esquive (Réaction)</li>
                <li>Parade (Réaction)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .gm-screen-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.85);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }
  .gm-screen-modal {
    background: #111827;
    border: 1px solid #374151;
    border-radius: 12px;
    width: 95vw;
    height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
    animation: zoomIn 0.2s ease-out;
  }
  @keyframes zoomIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
  .gm-screen-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    background: #1f2937;
    border-bottom: 1px solid #374151;
    border-radius: 12px 12px 0 0;
  }
  .gm-title { font-size: 18px; font-weight: bold; color: #f3f4f6; }
  .gm-close { background: none; border: none; color: #9ca3af; font-size: 20px; cursor: pointer; }
  .gm-close:hover { color: #f9fafb; }
  
  .gm-screen-body {
    padding: 24px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .gm-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }
  .gm-card {
    background: #1f2937;
    border: 2px solid #4b5563;
    border-radius: 8px;
    padding: 16px;
  }
  .gm-card.active-turn { border-color: #e5a853; box-shadow: 0 0 15px rgba(229,168,83,0.3); }
  .gm-card-header { border-bottom: 1px solid #374151; padding-bottom: 8px; margin-bottom: 12px; }
  .gm-card-header strong { display: block; font-size: 16px; color: #f3f4f6; }
  .gm-race-voc { font-size: 12px; color: #9ca3af; }
  
  .gm-card-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    font-size: 13px;
  }
  .gm-stat { display: flex; justify-content: space-between; color: #d1d5db; }
  .low-hp { color: #ef4444; }

  .gm-conditions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 12px; }
  .gm-tag { background: rgba(239,68,68,0.2); color: #ef4444; padding: 2px 6px; border-radius: 4px; font-size: 11px; }

  .gm-reference {
    border-top: 1px solid #374151;
    padding-top: 24px;
  }
  .gm-reference h4 { color: #f3f4f6; margin-bottom: 16px; font-size: 16px; }
  .gm-ref-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 16px;
  }
  .gm-ref-box {
    background: #1f2937;
    padding: 12px;
    border-radius: 8px;
  }
  .gm-ref-box h5 { color: #9ca3af; margin-bottom: 8px; border-bottom: 1px solid #374151; padding-bottom: 4px; }
  .gm-ref-box ul { list-style: none; padding: 0; margin: 0; font-size: 12px; color: #d1d5db; }
  .gm-ref-box li { margin-bottom: 4px; }
</style>
