<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { listen } from '@tauri-apps/api/event';
  import {
    startPlayerServer, stopPlayerServer, broadcastToPlayers,
    getPlayerConnections, getServerStatus,
    applyDamageToPlayer, applyConditionToPlayer, removeConditionFromPlayer,
    setActiveTurn, approveXpRequest,
    sendPrivateMessage, startPoll, endPoll,
    type ServerInfo, type PlayerInfo,
  } from '$lib/api';
  import { vttStore } from '$lib/stores/vtt.svelte';
  import { getGameConfig } from '$lib/stores/gameConfig.svelte';
  import { invoke } from '@tauri-apps/api/core';

  let visible     = $state(false);
  let serverInfo  = $state<ServerInfo | null>(null);
  let players     = $state<PlayerInfo[]>([]);
  let starting    = $state(false);
  let chatLog     = $state<{ from: string; msg: string; time: string }[]>([]);
  let gmMessage   = $state('');
  let showLog     = $state(true);
  let unlistens: (() => void)[] = [];
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  // Per-player GM controls
  let dmgInputs     = $state<Record<string, number>>({});
  let condInputs    = $state<Record<string, string>>({});
  let expandedCards = $state<Set<string>>(new Set());

  // Handout
  let showHandoutForm = $state(false);
  let handoutTitle    = $state('');
  let handoutText     = $state('');

  // Sondage rapide
  let showPollForm    = $state(false);
  let pollQuestion    = $state('');
  let pollOptions     = $state(['', '']);
  let pollActive      = $state(false);
  let pollResults     = $state<Record<string, { count: number; voters: string[] }>>({});

  // Message privé
  let privateInputs   = $state<Record<string, string>>({});

  const CONDITIONS = ['Étourdi','Assommé','À Terre','Aveuglé','Effrayé','Paralysé','Empoisonné','Saignant'];

  // ── Player control handlers ──────────────────────────────────────────────────

  async function handleApplyDamage(playerId: string) {
    const dmg = Math.abs(dmgInputs[playerId] ?? 1);
    try { await applyDamageToPlayer(playerId, dmg); refreshPlayers(); addLog('GM', `💥 ${dmg} dégâts → ${pName(playerId)}`); }
    catch(e) { addLog('Erreur', String(e)); }
  }

  async function handleApplyHeal(playerId: string) {
    const heal = Math.abs(dmgInputs[playerId] ?? 1);
    try { await applyDamageToPlayer(playerId, -heal); refreshPlayers(); addLog('GM', `💚 Soin ${heal} → ${pName(playerId)}`); }
    catch(e) { addLog('Erreur', String(e)); }
  }

  async function handleApplyCondition(playerId: string) {
    const cond = condInputs[playerId];
    if (!cond) return;
    try { await applyConditionToPlayer(playerId, cond); refreshPlayers(); addLog('GM', `⚠️ ${cond} → ${pName(playerId)}`); }
    catch(e) { addLog('Erreur', String(e)); }
  }

  async function handleRemoveCondition(playerId: string, cond: string) {
    try { await removeConditionFromPlayer(playerId, cond); refreshPlayers(); }
    catch(e) { addLog('Erreur', String(e)); }
  }

  async function handleSetTurn(playerId: string | null) {
    try { await setActiveTurn(playerId); refreshPlayers(); }
    catch(e) { addLog('Erreur', String(e)); }
  }

  async function handleApproveXP(playerId: string) {
    const p = players.find(pl => pl.id === playerId);
    if (!p?.pending_xp) return;
    try {
      await approveXpRequest(playerId, p.pending_xp);
      addLog('GM', `💫 ${p.pending_xp} XP approuvés → ${p.name}`);
      refreshPlayers();
    } catch(e) { addLog('Erreur', String(e)); }
  }

  // ── GM broadcast actions ─────────────────────────────────────────────────────

  async function sendGmMessage() {
    if (!gmMessage.trim()) return;
    await broadcastToPlayers('chat', { from: 'MJ', message: gmMessage.trim() });
    addLog('MJ', gmMessage.trim());
    gmMessage = '';
  }

  async function broadcastCombat() {
    await broadcastToPlayers('scene', {
      mapName: vttStore.currentMapRelPath,
      combatants: vttStore.combatants,
      currentTurn: vttStore.currentTurn,
      combatActive: vttStore.combatActive,
      round: vttStore.combatRound,
    });
    addLog('Système', '⚔️ État de combat envoyé');
  }

  async function pingAll() {
    await broadcastToPlayers('ping', { message: '⚡ Attention — le MJ demande votre attention !' });
    addLog('Système', '📢 Ping envoyé à tous');
  }

  async function sendHandout() {
    if (!handoutTitle && !handoutText) return;
    await broadcastToPlayers('handout', { title: handoutTitle, text: handoutText });
    addLog('MJ', `📋 Handout : ${handoutTitle || handoutText.slice(0,30)}`);
    handoutTitle = '';
    handoutText = '';
    showHandoutForm = false;
  }

  function copyUrl() {
    if (serverInfo) navigator.clipboard.writeText(serverInfo.url);
  }

  async function handleSendPrivate(playerId: string) {
    const msg = privateInputs[playerId]?.trim();
    if (!msg) return;
    try {
      await sendPrivateMessage(playerId, msg);
      addLog('MJ → ' + pName(playerId), `🔒 ${msg}`);
      privateInputs = { ...privateInputs, [playerId]: '' };
    } catch (e) { addLog('Erreur', String(e)); }
  }

  async function handleStartPoll() {
    const opts = pollOptions.filter(o => o.trim());
    if (!pollQuestion.trim() || opts.length < 2) return;
    pollResults = {};
    opts.forEach(o => { pollResults[o] = { count: 0, voters: [] }; });
    await startPoll(pollQuestion.trim(), opts);
    pollActive = true;
    showPollForm = false;
    addLog('Système', `📊 Sondage lancé : "${pollQuestion}"`);
  }

  async function handleEndPoll() {
    await endPoll();
    pollActive = false;
    addLog('Système', '📊 Sondage terminé');
  }

  // ── Card expand/collapse ─────────────────────────────────────────────────────

  function toggleCard(playerId: string) {
    const next = new Set(expandedCards);
    if (next.has(playerId)) next.delete(playerId); else next.add(playerId);
    expandedCards = next;
  }

  // ── Server lifecycle ─────────────────────────────────────────────────────────

  export function toggle() { visible = !visible; }

  async function handleStart() {
    starting = true;
    try {
      serverInfo = await startPlayerServer();
      const cfg = getGameConfig();
      if (cfg) try { await invoke('set_game_config', { config: cfg }); } catch {}
      startPolling();
      addLog('Système', `🚀 Serveur démarré — ${serverInfo.ip}:${serverInfo.port}`);
    } catch (e) {
      addLog('Erreur', String(e));
    } finally {
      starting = false;
    }
  }

  async function handleStop() {
    await stopPlayerServer();
    serverInfo = null;
    players = [];
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    addLog('Système', '⏹ Serveur arrêté');
  }

  function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(refreshPlayers, 5000);
  }

  async function refreshPlayers() {
    try { players = await getPlayerConnections(); } catch {}
  }

  function addLog(from: string, msg: string) {
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    chatLog = [{ from, msg, time: now }, ...chatLog].slice(0, 60);
  }

  function pName(id: string) { return players.find(p => p.id === id)?.name ?? id; }

  function hpPct(p: PlayerInfo) {
    const hp = p.character?.hp ?? 0;
    const max = p.character?.maxhp ?? 0;
    return max > 0 ? Math.max(0, Math.min(100, (hp / max) * 100)) : 0;
  }

  function hpColor(p: PlayerInfo) {
    const pct = hpPct(p);
    return pct > 60 ? '#22c55e' : pct > 25 ? '#eab308' : '#ef4444';
  }

  onMount(async () => {
    try {
      serverInfo = await getServerStatus();
      if (serverInfo) startPolling();
    } catch {}

    unlistens.push(await listen<any>('player_joined', ({ payload }) => {
      addLog(payload.name, '🟢 a rejoint la table');
      refreshPlayers();
    }));
    unlistens.push(await listen<any>('player_left', ({ payload }) => {
      addLog(payload.name, '🔴 a quitté la table');
      refreshPlayers();
    }));
    unlistens.push(await listen<any>('player_roll', ({ payload }) => {
      const d = payload.data;
      addLog(payload.name, `🎲 ${d.formula} → ${d.total}`);
    }));
    unlistens.push(await listen<any>('player_chat', ({ payload }) => {
      const prefix = payload.private ? '🔒 ' : payload.group ? '👥 ' : '';
      addLog(payload.name, prefix + payload.message);
    }));
    unlistens.push(await listen<any>('player_character_update', ({ payload }) => {
      players = players.map(p => p.id === payload.id ? { ...p, character: payload.character } : p);
    }));
    unlistens.push(await listen<any>('player_reaction', ({ payload }) => {
      addLog(payload.name, payload.emoji);
    }));
    unlistens.push(await listen<any>('player_initiative', ({ payload }) => {
      const d = payload.data;
      addLog(payload.name, `⚡ Initiative ${d.result} (I${d.i_val}+d10:${d.d10})`);
    }));
    unlistens.push(await listen<any>('player_xp_request', ({ payload }) => {
      addLog(payload.name, `💫 demande ${payload.amount} XP`);
      refreshPlayers();
    }));
    unlistens.push(await listen<any>('player_sketch_push', ({ payload }) => {
      addLog(payload.name, `🎨 a envoyé un croquis`);
      // Émettre un événement global pour que MapCanvas l'affiche
      window.dispatchEvent(new CustomEvent('vtt-sketch-push', { detail: payload }));
    }));
    unlistens.push(await listen<any>('player_play_sound', ({ payload }) => {
      addLog(payload.name, `🔊 a joué un son (${payload.sound_id})`);
    }));
    unlistens.push(await listen<any>('player_poll_vote', ({ payload }) => {
      const opt = payload.option as string;
      if (!pollResults[opt]) pollResults[opt] = { count: 0, voters: [] };
      if (!pollResults[opt].voters.includes(payload.name)) {
        pollResults[opt].count++;
        pollResults[opt].voters.push(payload.name);
        pollResults = { ...pollResults };
      }
      addLog(payload.name, `📊 a voté : "${opt}"`);
    }));
  });

  onDestroy(() => {
    unlistens.forEach(fn => fn());
    if (pollInterval) clearInterval(pollInterval);
  });
</script>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="pm-backdrop" onclick={() => visible = false}>
    <div class="pm-panel" onclick={e => e.stopPropagation()}>

      <!-- ── Header ── -->
      <div class="pm-header">
        <div class="pm-header-left">
          <span>📱 Joueurs Mobiles</span>
          {#if serverInfo}
            <span class="pm-status-badge">
              <span class="pm-status-dot"></span>
              {players.length} connecté{players.length !== 1 ? 's' : ''}
            </span>
          {:else}
            <span class="pm-status-badge pm-status-off">hors ligne</span>
          {/if}
        </div>
        <button class="pm-close" onclick={() => visible = false}>✕</button>
      </div>

      <!-- ── Serveur ── -->
      <div class="pm-section">
        {#if !serverInfo}
          <p class="pm-hint">Démarrez le serveur pour que les joueurs se connectent depuis leur téléphone ou tablette.</p>
          <button class="pm-btn-start" onclick={handleStart} disabled={starting}>
            {starting ? '⏳ Démarrage…' : '🚀 Démarrer le Serveur'}
          </button>
        {:else}
          <div class="pm-url-row">
            <div class="pm-url">{serverInfo.url}</div>
            <button class="pm-copy-btn" onclick={copyUrl} title="Copier l'URL">📋</button>
          </div>
          <div class="pm-qr" title="QR Code">
            {@html serverInfo.qr_svg}
          </div>
          <p class="pm-hint" style="text-align:center">Scannez le QR ou entrez l'URL dans le navigateur.</p>
          <button class="pm-btn-stop" onclick={handleStop}>⏹ Arrêter le Serveur</button>
        {/if}
      </div>

      <!-- ── Joueurs connectés ── -->
      {#if players.length > 0}
        <div class="pm-section">
          <div class="pm-section-title">👥 Joueurs ({players.length})</div>
          <div class="pm-players">
            {#each players as p (p.id)}
              {@const expanded = expandedCards.has(p.id)}
              <div class="pm-player-card" class:turn-active={p.active_turn}>

                <!-- Card header — toujours visible, clic pour ouvrir les contrôles -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div class="pm-player-header" onclick={() => toggleCard(p.id)}>
                  <div class="pm-player-dot" class:active-dot={p.active_turn}></div>
                  {#if p.character?.portrait}
                    <img src={p.character.portrait} alt={p.name} style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border); margin-right: 4px; flex-shrink: 0;" />
                  {/if}
                  <div class="pm-player-info">
                    <span class="pm-player-name">{p.name}</span>
                    {#if p.character?.class}
                      <span class="pm-player-class">{p.character.class}</span>
                    {/if}
                  </div>
                  {#if p.character?.maxhp}
                    <div class="pm-hp-block">
                      <div class="pm-hp-bar">
                        <div class="pm-hp-fill" style="width:{hpPct(p)}%;background:{hpColor(p)}"></div>
                      </div>
                      <span class="pm-player-hp" style="color:{hpColor(p)}">{p.character.hp}/{p.character.maxhp}</span>
                    </div>
                  {:else if p.character?.hp !== undefined}
                    <span class="pm-player-hp">B {p.character.hp}</span>
                  {/if}
                  <span class="pm-chevron">{expanded ? '▲' : '▼'}</span>
                </div>

                <!-- Conditions — toujours visibles -->
                {#if p.conditions?.length}
                  <div class="pm-conditions">
                    {#each p.conditions as cond}
                      <!-- svelte-ignore a11y_click_events_have_key_events -->
                      <span class="pm-cond-tag" onclick={() => handleRemoveCondition(p.id, cond)} title="Cliquer pour retirer">
                        {cond} ✕
                      </span>
                    {/each}
                  </div>
                {/if}

                <!-- XP en attente — toujours visible -->
                {#if p.pending_xp}
                  <div class="pm-xp-pending">
                    💫 {p.name} demande {p.pending_xp} XP
                    <button class="pm-btn-approve" onclick={() => handleApproveXP(p.id)}>Approuver</button>
                  </div>
                {/if}

                <!-- Contrôles — dépliables -->
                {#if expanded}
                  <div class="pm-controls">
                    <div class="pm-ctrl-row">
                      <input
                        class="pm-ctrl-inp pm-ctrl-num"
                        type="number" min="1" max="99" placeholder="Valeur"
                        bind:value={dmgInputs[p.id]}
                      />
                      <button class="pm-ctrl-btn pm-ctrl-red" onclick={() => handleApplyDamage(p.id)}>💥 Dégâts</button>
                      <button class="pm-ctrl-btn pm-ctrl-green" onclick={() => handleApplyHeal(p.id)}>💚 Soin</button>
                    </div>
                    <div class="pm-ctrl-row">
                      <select class="pm-ctrl-inp pm-ctrl-sel" bind:value={condInputs[p.id]}>
                        <option value="">— Condition —</option>
                        {#each CONDITIONS as c}<option>{c}</option>{/each}
                      </select>
                      <button class="pm-ctrl-btn" onclick={() => handleApplyCondition(p.id)}>+ Appliquer</button>
                    </div>
                    <button
                      class="pm-ctrl-btn pm-ctrl-turn"
                      class:pm-ctrl-turn-active={p.active_turn}
                      onclick={() => handleSetTurn(p.active_turn ? null : p.id)}
                    >
                      {p.active_turn ? '⏹ Fin du tour' : '⚡ C\'est son tour'}
                    </button>
                    <!-- Message privé -->
                    <div class="pm-ctrl-row">
                      <input
                        class="pm-ctrl-inp"
                        placeholder="Message privé…"
                        bind:value={privateInputs[p.id]}
                        onkeydown={(e) => e.key === 'Enter' && handleSendPrivate(p.id)}
                        style="flex:1"
                      />
                      <button class="pm-ctrl-btn" onclick={() => handleSendPrivate(p.id)}>🔒 Envoyer</button>
                    </div>
                  </div>
                {/if}

              </div>
            {/each}
          </div>
          <button class="pm-btn-ghost" onclick={() => handleSetTurn(null)}>⏸ Réinitialiser le tour</button>
        </div>
      {:else if serverInfo}
        <div class="pm-section">
          <div class="pm-hint" style="text-align:center;padding:8px 0">En attente de joueurs…</div>
        </div>
      {/if}

      <!-- ── Actions GM ── -->
      {#if serverInfo}
        <div class="pm-section">
          <div class="pm-section-title">Actions GM</div>

          <div class="pm-actions-grid">
            <button class="pm-btn-action" onclick={broadcastCombat}>⚔️ Combat</button>
            <button class="pm-btn-action" onclick={pingAll}>📢 Ping</button>
            <button class="pm-btn-action" class:pm-btn-action-active={showHandoutForm} onclick={() => showHandoutForm = !showHandoutForm}>📋 Handout</button>
            <button class="pm-btn-action" class:pm-btn-action-active={showPollForm || pollActive} onclick={() => { if (pollActive) handleEndPoll(); else showPollForm = !showPollForm; }}>
              {pollActive ? '📊 Terminer sondage' : '📊 Sondage'}
            </button>
          </div>

          {#if showHandoutForm}
            <div class="pm-handout-form">
              <input
                class="pm-ctrl-inp"
                placeholder="Titre du handout…"
                bind:value={handoutTitle}
                style="width:100%"
              />
              <textarea
                class="pm-ctrl-inp"
                placeholder="Texte (description, indice, note…)"
                bind:value={handoutText}
                rows="3"
                style="width:100%;resize:vertical"
              ></textarea>
              <button class="pm-btn-start" onclick={sendHandout} style="font-size:12px;padding:7px">
                📤 Envoyer à tous les joueurs
              </button>
            </div>
          {/if}

          <!-- Formulaire de sondage -->
          {#if showPollForm && !pollActive}
            <div class="pm-handout-form">
              <input class="pm-ctrl-inp" placeholder="Question du sondage…" bind:value={pollQuestion} style="width:100%" />
              {#each pollOptions as _, i}
                <div class="pm-ctrl-row">
                  <input class="pm-ctrl-inp" placeholder="Option {i+1}…" bind:value={pollOptions[i]} style="flex:1" />
                  {#if pollOptions.length > 2}
                    <button class="pm-ctrl-btn pm-ctrl-red" onclick={() => pollOptions = pollOptions.filter((_, j) => j !== i)}>✕</button>
                  {/if}
                </div>
              {/each}
              {#if pollOptions.length < 4}
                <button class="pm-btn-ghost" onclick={() => pollOptions = [...pollOptions, '']}>+ Option</button>
              {/if}
              <button class="pm-btn-start" onclick={handleStartPoll} style="font-size:12px;padding:7px">📊 Lancer le sondage</button>
            </div>
          {/if}

          <!-- Résultats du sondage en cours -->
          {#if pollActive}
            <div class="pm-poll-results">
              <div class="pm-section-title">📊 {pollQuestion}</div>
              {#each Object.entries(pollResults) as [opt, res]}
                {@const total = Object.values(pollResults).reduce((s, r) => s + r.count, 0)}
                <div class="pm-poll-row">
                  <span class="pm-poll-opt">{opt}</span>
                  <div class="pm-poll-bar-wrap">
                    <div class="pm-poll-bar" style="width:{total > 0 ? (res.count/total*100).toFixed(0) : 0}%"></div>
                  </div>
                  <span class="pm-poll-count">{res.count}</span>
                </div>
              {/each}
            </div>
          {/if}

          <div class="pm-chat-row">
            <input
              class="pm-chat-input"
              bind:value={gmMessage}
              placeholder="Message à tous les joueurs…"
              onkeydown={(e) => e.key === 'Enter' && sendGmMessage()}
            />
            <button class="pm-chat-send" onclick={sendGmMessage}>➤</button>
          </div>
        </div>
      {/if}

      <!-- ── Journal ── -->
      {#if chatLog.length > 0}
        <div class="pm-section pm-log-section">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div class="pm-section-title pm-log-toggle" onclick={() => showLog = !showLog}>
            <span>Journal ({chatLog.length})</span>
            <span class="pm-chevron-sm">{showLog ? '▲' : '▼'}</span>
          </div>
          {#if showLog}
            <div class="pm-log">
              {#each chatLog as entry}
                <div class="pm-log-item">
                  <span class="pm-log-time">{entry.time}</span>
                  <span class="pm-log-from">{entry.from}</span>
                  <span class="pm-log-msg">{entry.msg}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

    </div>
  </div>
{/if}

<style>
  /* ── Backdrop & Panel ── */
  .pm-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.5);
    z-index: 9100;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pm-panel {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    width: 460px;
    max-width: calc(100vw - 24px);
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,.6);
    animation: slideDown .15s ease-out;
  }
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Header ── */
  .pm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    position: sticky;
    top: 0;
    background: var(--bg-secondary);
    z-index: 1;
  }
  .pm-header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .pm-status-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    font-weight: 600;
    color: #22c55e;
    background: rgba(34,197,94,.1);
    border: 1px solid rgba(34,197,94,.25);
    border-radius: 20px;
    padding: 2px 8px;
  }
  .pm-status-badge.pm-status-off { color: var(--text-muted); background: transparent; border-color: var(--border); }

  .pm-status-dot {
    width: 6px; height: 6px;
    background: #22c55e;
    border-radius: 50%;
    animation: pulse-dot .9s infinite;
  }
  @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.3} }

  .pm-close {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 15px;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .pm-close:hover { background: var(--bg-hover); color: var(--text-primary); }

  /* ── Sections ── */
  .pm-section {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .pm-section-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .07em;
    color: var(--text-muted);
    text-transform: uppercase;
  }
  .pm-hint {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.5;
  }

  /* ── Server ── */
  .pm-url-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .pm-url {
    flex: 1;
    font-family: monospace;
    font-size: 13px;
    color: var(--accent);
    font-weight: 600;
    background: var(--bg-tertiary);
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid var(--border);
    text-align: center;
    user-select: all;
  }
  .pm-copy-btn {
    padding: 6px 10px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    flex-shrink: 0;
    transition: background .1s;
  }
  .pm-copy-btn:hover { background: var(--bg-hover); }

  .pm-qr {
    width: 160px;
    height: 160px;
    background: white;
    border-radius: 8px;
    padding: 8px;
    align-self: center;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .pm-qr :global(svg) { width: 100%; height: 100%; }

  .pm-btn-start {
    padding: 10px;
    background: var(--accent);
    border: none;
    border-radius: 8px;
    color: #000;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    transition: opacity .1s;
  }
  .pm-btn-start:disabled { opacity: .5; cursor: wait; }
  .pm-btn-start:not(:disabled):hover { opacity: .88; }

  .pm-btn-stop {
    padding: 7px 12px;
    background: transparent;
    border: 1px solid #ef4444;
    border-radius: 6px;
    color: #ef4444;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    align-self: flex-start;
    transition: background .1s;
  }
  .pm-btn-stop:hover { background: rgba(239,68,68,.1); }

  /* ── Player cards ── */
  .pm-players { display: flex; flex-direction: column; gap: 8px; }

  .pm-player-card {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: border-color .15s;
  }
  .pm-player-card.turn-active {
    border-color: var(--accent);
    background: rgba(229,168,83,.05);
  }

  .pm-player-header {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
    border-radius: 6px;
    margin: -4px;
    padding: 4px;
    transition: background .1s;
  }
  .pm-player-header:hover { background: rgba(255,255,255,.04); }

  .pm-player-dot {
    width: 8px; height: 8px;
    background: #22c55e;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .pm-player-dot.active-dot {
    background: var(--accent);
    box-shadow: 0 0 5px var(--accent);
    animation: pulse-dot .9s infinite;
  }

  .pm-player-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .pm-player-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pm-player-class { font-size: 10px; color: var(--text-muted); }

  .pm-hp-block {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 3px;
    flex-shrink: 0;
  }
  .pm-hp-bar {
    width: 64px;
    height: 5px;
    background: rgba(255,255,255,.08);
    border-radius: 3px;
    overflow: hidden;
  }
  .pm-hp-fill {
    height: 100%;
    border-radius: 3px;
    transition: width .4s, background .4s;
  }
  .pm-player-hp {
    font-size: 10px;
    font-family: monospace;
    flex-shrink: 0;
  }

  .pm-chevron {
    font-size: 9px;
    color: var(--text-muted);
    flex-shrink: 0;
    margin-left: 2px;
  }

  .pm-conditions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .pm-cond-tag {
    padding: 2px 8px;
    background: rgba(239,68,68,.12);
    border: 1px solid rgba(239,68,68,.28);
    border-radius: 10px;
    font-size: 10px;
    font-weight: 600;
    color: #f87171;
    cursor: pointer;
    user-select: none;
    transition: background .1s;
  }
  .pm-cond-tag:hover { background: rgba(239,68,68,.22); }

  .pm-xp-pending {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--accent);
    background: rgba(229,168,83,.08);
    border: 1px solid rgba(229,168,83,.22);
    border-radius: 6px;
    padding: 5px 8px;
  }
  .pm-btn-approve {
    padding: 3px 8px;
    background: var(--accent);
    border: none;
    border-radius: 4px;
    color: #000;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    margin-left: auto;
    flex-shrink: 0;
  }

  /* ── Controls (dépliables) ── */
  .pm-controls {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 4px;
    border-top: 1px solid var(--border);
  }
  .pm-ctrl-row { display: flex; gap: 5px; align-items: center; }

  .pm-ctrl-inp {
    flex: 1;
    padding: 5px 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--text-primary);
    font-size: 11px;
    outline: none;
    min-width: 0;
  }
  .pm-ctrl-inp:focus { border-color: var(--accent); }
  .pm-ctrl-num { flex: 0 0 72px; text-align: center; }
  .pm-ctrl-sel { flex: 2; }

  .pm-ctrl-btn {
    padding: 5px 9px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--text-primary);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background .1s;
  }
  .pm-ctrl-btn:hover { background: var(--bg-hover); }
  .pm-ctrl-red  { border-color: rgba(239,68,68,.4); color: #f87171; }
  .pm-ctrl-red:hover  { background: rgba(239,68,68,.12); }
  .pm-ctrl-green { border-color: rgba(34,197,94,.4); color: #4ade80; }
  .pm-ctrl-green:hover { background: rgba(34,197,94,.12); }
  .pm-ctrl-turn {
    width: 100%;
    text-align: center;
    padding: 7px;
    font-size: 12px;
  }
  .pm-ctrl-turn-active {
    background: rgba(229,168,83,.15);
    border-color: var(--accent);
    color: var(--accent);
  }

  .pm-btn-ghost {
    padding: 6px 10px;
    background: transparent;
    border: 1px dashed var(--border);
    border-radius: 6px;
    color: var(--text-muted);
    font-size: 11px;
    cursor: pointer;
    text-align: center;
    transition: border-color .1s, color .1s;
  }
  .pm-btn-ghost:hover { border-color: var(--text-muted); color: var(--text-primary); }

  /* ── GM Actions ── */
  .pm-actions-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .pm-btn-action {
    padding: 8px 6px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 12px;
    cursor: pointer;
    text-align: center;
    transition: background .1s;
  }
  .pm-btn-action:hover { background: var(--bg-hover); }
  .pm-btn-action-active {
    background: rgba(229,168,83,.12);
    border-color: rgba(229,168,83,.35);
    color: var(--accent);
  }

  .pm-handout-form {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .pm-chat-row { display: flex; gap: 6px; }
  .pm-chat-input {
    flex: 1;
    padding: 8px 10px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 12px;
    outline: none;
  }
  .pm-chat-input:focus { border-color: var(--accent); }
  .pm-chat-send {
    padding: 8px 14px;
    background: var(--accent);
    border: none;
    border-radius: 6px;
    color: #000;
    font-weight: 700;
    cursor: pointer;
    transition: opacity .1s;
  }
  .pm-chat-send:hover { opacity: .88; }

  /* ── Journal ── */
  .pm-log-section { gap: 8px; }
  .pm-log-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    user-select: none;
  }
  .pm-chevron-sm { font-size: 9px; }

  .pm-log {
    display: flex;
    flex-direction: column;
    gap: 3px;
    overflow-y: auto;
    max-height: 150px;
  }
  .pm-log-item {
    display: grid;
    grid-template-columns: 38px 80px 1fr;
    gap: 4px;
    font-size: 11px;
    align-items: baseline;
  }
  .pm-log-time { color: var(--text-muted); }
  .pm-log-from { color: var(--accent); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pm-log-msg  { color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* ── Poll ──────────────────────────────────────────────────────── */
  .pm-poll-results {
    background: var(--bg-primary);
    border-radius: 6px;
    padding: 8px;
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .pm-poll-row { display: flex; align-items: center; gap: 6px; }
  .pm-poll-opt { font-size: 11px; color: var(--text-primary); width: 80px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pm-poll-bar-wrap { flex: 1; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; }
  .pm-poll-bar { height: 100%; background: var(--accent); border-radius: 4px; transition: width 0.4s; }
  .pm-poll-count { font-size: 11px; color: var(--accent); width: 18px; text-align: right; flex-shrink: 0; }
</style>
