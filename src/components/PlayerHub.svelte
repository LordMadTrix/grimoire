<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { listen } from '@tauri-apps/api/event';
  import {
    broadcastToPlayers, getPlayerConnections, getServerStatus,
    applyDamageToPlayer, applyConditionToPlayer, removeConditionFromPlayer,
    setActiveTurn, approveXpRequest, requestRoll, assignCharacter,
    type ServerInfo, type PlayerInfo,
  } from '$lib/api';
  import { vttStore } from '$lib/stores/vtt.svelte';
  import { getVaultPath, getVaultTree, getActiveFile } from '$lib/stores/vault.svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { parseCharacterMd } from '$lib/services/characterParser';
  import { fade, fly, scale } from 'svelte/transition';

  let visible = $state(false);
  let serverInfo = $state<ServerInfo | null>(null);
  let players = $state<PlayerInfo[]>([]);
  let starting = $state(false);
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  // Multi-selection
  let selectedPlayers = $state<Set<string>>(new Set());
  
  // UI States
  let activeTab = $state<'players' | 'server' | 'config'>('players');
  let rollStat = $state('cc');
  let rollMod = $state(0);
  let amountInput = $state(1);

  const STATS = [
    { key: 'm', lbl: 'M' }, { key: 'cc', lbl: 'CC' }, { key: 'ct', lbl: 'CT' },
    { key: 'f', lbl: 'F' }, { key: 'e', lbl: 'E' }, { key: 'b', lbl: 'B' },
    { key: 'i', lbl: 'I' }, { key: 'a', lbl: 'A' }, { key: 'dex', lbl: 'Dex' },
    { key: 'cd', lbl: 'Cd' }, { key: 'int', lbl: 'Int' }, { key: 'cl', lbl: 'Cl' },
    { key: 'fm', lbl: 'FM' }, { key: 'soc', lbl: 'Soc' }
  ];

  const CONDITIONS = ['Étourdi','Assommé','À Terre','Aveuglé','Effrayé','Paralysé','Empoisonné','Saignant'];

  export function toggle() { visible = !visible; if (visible) refreshPlayers(); }

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function handleRequestRoll(targetId: string | null = null) {
    try {
      await requestRoll(targetId, rollStat, rollMod);
      const targetName = targetId ? players.find(p => p.id === targetId)?.name : 'Tous';
    } catch(e) { console.error(e); }
  }

  async function applyToSelected(action: (id: string) => Promise<void>) {
    const targets = selectedPlayers.size > 0 ? Array.from(selectedPlayers) : players.map(p => p.id);
    for (const id of targets) await action(id);
    refreshPlayers();
  }

  function togglePlayerSelection(id: string) {
    const next = new Set(selectedPlayers);
    if (next.has(id)) next.delete(id); else next.add(id);
    selectedPlayers = next;
  }

  async function handleDamage(dmg: number) {
    await applyToSelected(id => applyDamageToPlayer(id, dmg));
  }

  async function handleXP(amt: number) {
    // WFRP XP is usually handled via request, but we can have a direct "Grant XP" later
    // For now we just broadcast a chat message or something
    await broadcastToPlayers('chat', { from: 'MJ', message: `✨ Vous recevez ${amt} XP !` });
  }

  async function handleAssignCharacter(playerId: string, relPath: string) {
    const vaultPath = getVaultPath();
    if (!vaultPath) return;
    try {
      const content = await invoke('read_file', { vaultPath, relativePath: relPath }) as string;
      // Parser le markdown en objet de personnage structuré (nom/PV/CA...) et passer par
      // la commande dédiée assign_character — l'ancien broadcast('push_character', {content})
      // envoyait du markdown brut que le client mobile ne sait pas interpréter, donc
      // aucune statistique n'était réellement mise à jour côté joueur.
      const parsed = parseCharacterMd(content);
      const charObj = {
        ...parsed,
        nom: parsed.nom || relPath.split('/').pop()?.replace(/\.md$/i, '') || 'Personnage',
        profil: { act: { b: parsed.maxhp || 10 } },
        bless: parsed.hp || 10,
      };
      await assignCharacter(playerId, relPath, charObj);
    } catch(e) { console.error(e); }
  }

  // ── Server ──────────────────────────────────────────────────────────────────

  async function refreshPlayers() {
    try { players = await getPlayerConnections(); } catch {}
  }

  const _unlistenHub: (() => void)[] = [];
  onMount(() => {
    (async () => {
      serverInfo = await getServerStatus();
      if (serverInfo) pollInterval = setInterval(refreshPlayers, 3000);
      _unlistenHub.push(await listen<any>('player_joined', refreshPlayers));
      _unlistenHub.push(await listen<any>('player_left', refreshPlayers));
      _unlistenHub.push(await listen<any>('player_character_update', refreshPlayers));
    })();
    return () => {
      if (pollInterval) clearInterval(pollInterval);
      _unlistenHub.forEach(fn => fn());
    };
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function getStat(p: PlayerInfo, key: string) {
    return p.character?.profil?.act?.[key] || '—';
  }

  function getHpPct(p: PlayerInfo) {
    const hp = p.character?.bless ?? 0;
    const max = parseInt(p.character?.profil?.act?.b) || 10;
    return Math.max(0, Math.min(100, (hp / max) * 100));
  }

  function getHpColor(p: PlayerInfo) {
    const pct = getHpPct(p);
    return pct > 60 ? '#22c55e' : pct > 25 ? '#eab308' : '#ef4444';
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="hub-backdrop" onclick={() => visible = false} transition:fade={{ duration: 150 }}>
    <div class="hub-panel" onclick={e => e.stopPropagation()} transition:scale={{ duration: 200, start: 0.95, opacity: 0 }}>
      
      <!-- Header -->
      <header class="hub-header">
        <div class="hub-title">
          <span class="hub-icon">👥</span>
          <h1>Gestionnaire de Joueurs</h1>
        </div>
        <div class="hub-tabs">
          <button class:active={activeTab === 'players'} onclick={() => activeTab = 'players'}>Joueurs</button>
          <button class:active={activeTab === 'server'} onclick={() => activeTab = 'server'}>Serveur</button>
        </div>
        <button class="hub-close" onclick={() => visible = false}>✕</button>
      </header>

      <main class="hub-content">
        {#if activeTab === 'players'}
          {#if players.length === 0}
            <div class="hub-empty" in:fade>
              <div class="empty-icon">📱</div>
              <p>Aucun joueur connecté</p>
              <button class="btn-primary" onclick={() => activeTab = 'server'}>Configurer le serveur</button>
            </div>
          {:else}
            <!-- Player Grid -->
            <div class="player-grid">
              {#each players as p (p.id)}
                <div 
                  class="player-card" 
                  class:selected={selectedPlayers.has(p.id)}
                  class:active-turn={p.active_turn}
                  onclick={() => togglePlayerSelection(p.id)}
                >
                  <div class="card-header">
                    {#if p.character?.portrait}
                      <img class="player-avatar" src={p.character.portrait} alt={p.name} style="object-fit: cover; width: 40px; height: 40px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);" />
                    {:else}
                      <div class="player-avatar" style="background-color: hsl({(p.name.length * 40) % 360}, 60%, 40%)">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                    {/if}
                    <div class="player-meta">
                      <span class="player-name">{p.name}</span>
                      <span class="player-class">{p.character?.voc || p.character?.car || 'Voyageur'}</span>
                    </div>
                    {#if p.active_turn}
                      <span class="turn-badge" in:scale>TOUR</span>
                    {/if}
                  </div>

                  <!-- HP Bar -->
                  <div class="hp-section">
                    <div class="hp-values">
                      <span>Blessures</span>
                      <span style="color: {getHpColor(p)}">{p.character?.bless ?? 0} / {p.character?.profil?.act?.b || '—'}</span>
                    </div>
                    <div class="hp-bar-bg">
                      <div class="hp-bar-fill" style="width: {getHpPct(p)}%; background: {getHpColor(p)}"></div>
                    </div>
                  </div>

                  <!-- Mini Stats -->
                  <div class="stat-mini-grid">
                    {#each STATS.slice(1, 8) as stat}
                      <div class="stat-box">
                        <span class="stat-lbl">{stat.lbl}</span>
                        <span class="stat-val">{getStat(p, stat.key)}</span>
                      </div>
                    {/each}
                  </div>

                  <!-- Conditions -->
                  <div class="cond-row">
                    {#each p.conditions as cond}
                      <span class="cond-tag">{cond}</span>
                    {/each}
                    {#if p.conditions.length === 0}
                      <span class="cond-none">Aucune condition</span>
                    {/if}
                  </div>

                  <div class="card-actions" onclick={e => e.stopPropagation()}>
                    <button class="btn-icon" onclick={() => setActiveTurn(p.active_turn ? null : p.id)} title="Donner le tour">⏳</button>
                    <button class="btn-icon" onclick={() => handleRequestRoll(p.id)} title="Demander un jet">🎲</button>
                    {#if getActiveFile()}
                      <div class="mini-group">
                        <button class="btn-icon" onclick={() => handleAssignCharacter(p.id, getActiveFile()!)} title="Assigner fiche ({getActiveFile()?.split('/').pop()})">👤</button>
                        <button class="btn-icon" onclick={async () => {
                          const vp = getVaultPath();
                          const rel = getActiveFile()!;
                          const content = await invoke('read_file', { vaultPath: vp, relativePath: rel });
                          await broadcastToPlayers('handout', { title: rel.split('/').pop(), text: content });
                        }} title="Envoyer en handout">📤</button>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>

            <!-- Global / Selection Controls -->
            <footer class="hub-footer">
              <div class="selection-info">
                {#if selectedPlayers.size > 0}
                  {selectedPlayers.size} joueur{selectedPlayers.size > 1 ? 's' : ''} sélectionné{selectedPlayers.size > 1 ? 's' : ''}
                {:else}
                  Toute l'équipe
                {/if}
              </div>

              <div class="action-bar">
                <div class="action-group">
                  <input type="number" bind:value={amountInput} class="hub-input num" min="1" />
                  <button class="btn-action red" onclick={() => handleDamage(amountInput)}>💥 Dégâts</button>
                  <button class="btn-action green" onclick={() => handleDamage(-amountInput)}>💚 Soin</button>
                </div>

                <div class="divider"></div>

                <div class="action-group">
                  <select bind:value={rollStat} class="hub-input sel">
                    {#each STATS as s}<option value={s.key}>{s.lbl}</option>{/each}
                  </select>
                  <input type="number" bind:value={rollMod} class="hub-input num" placeholder="+/-" />
                  <button class="btn-action blue" onclick={() => handleRequestRoll()}>🎲 Demander Jet</button>
                </div>
              </div>
            </footer>
          {/if}

        {:else if activeTab === 'server'}
          <div class="server-config" in:fade>
            {#if !serverInfo}
              <div class="server-off">
                <p>Le serveur mobile n'est pas actif.</p>
                <button class="btn-primary" onclick={async () => { starting=true; try { serverInfo = await invoke('start_player_server'); } finally { starting=false; } }}>
                  {starting ? 'Démarrage...' : 'Démarrer le serveur'}
                </button>
              </div>
            {:else}
              <div class="server-on">
                <div class="qr-container">
                  {@html serverInfo.qr_svg}
                </div>
                <div class="server-details">
                  <div class="url-box">{serverInfo.url}</div>
                  <button class="btn-ghost" onclick={() => navigator.clipboard.writeText(serverInfo!.url)}>Copier l'URL</button>
                </div>
                <button class="btn-danger" onclick={async () => { await invoke('stop_player_server'); serverInfo = null; }}>Arrêter le serveur</button>
              </div>
            {/if}
          </div>
        {/if}
      </main>
    </div>
  </div>
{/if}

<style>
  .hub-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
    z-index: 9000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
  }

  .hub-panel {
    background: rgba(22, 27, 34, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 24px;
    width: 1000px;
    height: 700px;
    max-width: 95vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 32px 128px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
    overflow: hidden;
  }

  /* ── Header ── */
  .hub-header {
    padding: 24px 32px;
    display: flex;
    align-items: center;
    gap: 32px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .hub-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .hub-icon { font-size: 24px; }
  .hub-header h1 {
    font-size: 18px;
    font-weight: 800;
    color: var(--text-primary);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .hub-tabs {
    display: flex;
    background: rgba(0, 0, 0, 0.2);
    padding: 4px;
    border-radius: 12px;
    gap: 4px;
  }
  .hub-tabs button {
    padding: 6px 16px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .hub-tabs button.active {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .hub-close {
    margin-left: auto;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 20px;
    cursor: pointer;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s;
  }
  .hub-close:hover { background: rgba(255, 255, 255, 0.05); color: var(--text-primary); }

  /* ── Content ── */
  .hub-content {
    flex: 1;
    overflow-y: auto;
    padding: 32px;
    background: radial-gradient(circle at 50% -20%, rgba(229, 168, 83, 0.05), transparent 60%);
  }

  .hub-empty {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: var(--text-muted);
  }
  .empty-icon { font-size: 48px; opacity: 0.3; }

  /* ── Player Grid ── */
  .player-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
  }

  .player-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
  }
  .player-card:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.12);
    transform: translateY(-2px);
  }
  .player-card.selected {
    background: rgba(229, 168, 83, 0.08);
    border-color: var(--accent);
    box-shadow: 0 8px 24px rgba(229, 168, 83, 0.1);
  }
  .player-card.active-turn {
    box-shadow: 0 0 0 2px var(--accent);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .player-avatar {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    color: white;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }
  .player-meta {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .player-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .player-class { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.02em; }

  .turn-badge {
    background: var(--accent);
    color: black;
    font-size: 9px;
    font-weight: 900;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .hp-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .hp-values {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
  }
  .hp-bar-bg {
    height: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    overflow: hidden;
  }
  .hp-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .stat-mini-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }
  .stat-box {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    padding: 4px 2px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .stat-lbl { font-size: 8px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; }
  .stat-val { font-size: 12px; font-weight: 800; color: var(--text-primary); font-family: 'JetBrains Mono', monospace; }

  .cond-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    min-height: 20px;
  }
  .cond-tag {
    font-size: 9px;
    font-weight: 700;
    background: rgba(239, 68, 68, 0.1);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.2);
    padding: 2px 6px;
    border-radius: 6px;
  }
  .cond-none { font-size: 10px; color: var(--text-muted); font-style: italic; opacity: 0.5; }

  .card-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 6px;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .player-card:hover .card-actions { opacity: 1; }

  .mini-group {
    display: flex;
    gap: 4px;
    background: rgba(0, 0, 0, 0.4);
    padding: 2px;
    border-radius: 6px;
  }

  /* ── Footer ── */
  .hub-footer {
    padding: 24px 32px;
    background: rgba(0, 0, 0, 0.3);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .selection-info {
    font-size: 12px;
    font-weight: 600;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .action-bar {
    display: flex;
    align-items: center;
    gap: 24px;
  }
  .action-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .divider {
    width: 1px;
    height: 32px;
    background: rgba(255, 255, 255, 0.1);
  }

  .hub-input {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: var(--text-primary);
    padding: 8px 12px;
    font-size: 14px;
    outline: none;
    transition: all 0.2s;
  }
  .hub-input:focus { border-color: var(--accent); background: rgba(255, 255, 255, 0.08); }
  .hub-input.num { width: 60px; text-align: center; }
  .hub-input.sel { width: 120px; }

  .btn-action {
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-action.red { background: rgba(239, 68, 68, 0.2); color: #f87171; }
  .btn-action.red:hover { background: #ef4444; color: black; }
  .btn-action.green { background: rgba(34, 197, 94, 0.2); color: #4ade80; }
  .btn-action.green:hover { background: #22c55e; color: black; }
  .btn-action.blue { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
  .btn-action.blue:hover { background: #3b82f6; color: black; }

  /* ── Server Config ── */
  .server-config {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .qr-container {
    background: white;
    padding: 16px;
    border-radius: 16px;
    margin-bottom: 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }
  .qr-container :global(svg) { width: 200px; height: 200px; }

  .url-box {
    background: rgba(255, 255, 255, 0.05);
    padding: 12px 24px;
    border-radius: 12px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    color: var(--accent);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  .server-details { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; }

  .btn-primary {
    background: var(--accent);
    color: black;
    border: none;
    padding: 12px 24px;
    border-radius: 12px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(229, 168, 83, 0.3); }

  .btn-ghost {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-muted);
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 12px;
  }
  .btn-ghost:hover { background: rgba(255, 255, 255, 0.05); color: var(--text-primary); }

  .btn-danger {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #f87171;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 12px;
  }
  .btn-danger:hover { background: #ef4444; color: black; }

  .btn-icon {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }
  .btn-icon:hover { background: var(--accent); border-color: var(--accent); transform: scale(1.1); }
</style>
