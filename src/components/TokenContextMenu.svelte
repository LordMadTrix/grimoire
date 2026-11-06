<script lang="ts">
  import { vttStore, replaceGmToken, removeGmToken, setSpotlightToken } from '$lib/stores/vtt.svelte';
  import { emitToPlayerView } from '$lib/api';
  import { notifStore } from '$lib/stores/notifications.svelte';

  let { tokenId, x, y, onclose, onEdit, onDelete }: {
    tokenId: string;
    x: number;
    y: number;
    onclose: () => void;
    onEdit?: (token: any) => void;
    onDelete?: (id: string) => void;
  } = $props();

  const token = $derived(vttStore.tokens.find(t => t.id === tokenId));

  // Ajustement position écran
  const menuX = $derived(Math.min(Math.max(x, 10), (typeof window !== 'undefined' ? window.innerWidth : 1200) - 230));
  const menuY = $derived(Math.min(Math.max(y, 10), (typeof window !== 'undefined' ? window.innerHeight : 800) - 340));

  function changeHp(delta: number) {
    if (!token) return;
    const cur = token.hp ?? 10;
    const max = token.maxHp ?? 10;
    const nextHp = Math.max(0, Math.min(max * 2, cur + delta));
    replaceGmToken({ ...token, hp: nextHp });
    notifStore.add('❤️', token.name, `PV : ${nextHp}/${max}`, delta > 0 ? 'success' : 'warn', 1500);
  }

  function toggleVisibility() {
    if (!token) return;
    const nextVis = token.visible === false ? true : false;
    replaceGmToken({ ...token, visible: nextVis });
    notifStore.add('👁️', token.name, nextVis ? 'Révélé aux joueurs' : 'Masqué aux joueurs', 'info', 2000);
    onclose();
  }

  function toggleSpotlight() {
    if (!token) return;
    if (vttStore.spotlightTokenId === token.id) {
      setSpotlightToken(null);
    } else {
      setSpotlightToken(token.id);
      notifStore.add('🌟', token.name, 'Mis en lumière (Spotlight)', 'info', 2000);
    }
    onclose();
  }

  function toggleConcentration() {
    if (!token) return;
    replaceGmToken({ ...token, concentrating: !token.concentrating });
    onclose();
  }

  const QUICK_CONDITIONS = [
    { id: 'bleeding', emoji: '🩸', label: 'Saignement' },
    { id: 'poisoned', emoji: '🤢', label: 'Empoisonné' },
    { id: 'stunned',  emoji: '⚡', label: 'Étourdi' },
    { id: 'prone',    emoji: '⬇️', label: 'À terre' },
    { id: 'burning',  emoji: '🔥', label: 'Brûlure' },
    { id: 'blinded',  emoji: '🙈', label: 'Aveuglé' },
  ];

  function toggleCondition(cid: string) {
    if (!token) return;
    const cur = token.conditions ?? [];
    const next = cur.includes(cid) ? cur.filter(c => c !== cid) : [...cur, cid];
    replaceGmToken({ ...token, conditions: next });
  }

  function hasCond(cid: string) {
    return (token?.conditions ?? []).includes(cid);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="ctx-backdrop" onclick={onclose}>
  <div 
    class="ctx-menu" 
    style="left: {menuX}px; top: {menuY}px;" 
    onclick={(e) => e.stopPropagation()}
    role="menu"
    tabindex="-1"
  >
    {#if token}
      <!-- Header avec Nom et Avatar -->
      <div class="ctx-header">
        <div class="ctx-avatar-col">
          {#if token.imageUrl}
            <img src={token.imageUrl} alt={token.name} class="ctx-img" />
          {:else}
            <div class="ctx-avatar-fallback" style="background-color: #{((token.color || 0x3b82f6) & 0xffffff).toString(16).padStart(6, '0')}">
              {token.name.charAt(0).toUpperCase()}
            </div>
          {/if}
        </div>
        <div class="ctx-title-col">
          <span class="ctx-name" title={token.name}>{token.name}</span>
          <span class="ctx-sub">
            {token.isEnemy ? 'Adversaire' : 'Joueur / Allié'} · {token.hp ?? 10}/{token.maxHp ?? 10} PV
          </span>
        </div>
        <button class="ctx-close-btn" onclick={onclose}>✕</button>
      </div>

      <!-- Action rapide PV -->
      <div class="ctx-section">
        <div class="ctx-section-label">Ajuster Points de Vie</div>
        <div class="hp-buttons-row">
          <button class="hp-btn dmg" onclick={() => changeHp(-5)} title="-5 PV">-5</button>
          <button class="hp-btn dmg" onclick={() => changeHp(-1)} title="-1 PV">-1</button>
          <button class="hp-btn heal" onclick={() => changeHp(1)} title="+1 PV">+1</button>
          <button class="hp-btn heal" onclick={() => changeHp(5)} title="+5 PV">+5</button>
        </div>
      </div>

      <!-- Actions Principales -->
      <div class="ctx-list">
        <button class="ctx-item primary" onclick={() => { onEdit?.(token); onclose(); }}>
          <span class="item-icon">⚙️</span>
          <span>Modifier le Token (Fiche)</span>
        </button>

        <button class="ctx-item" onclick={toggleVisibility}>
          <span class="item-icon">{token.visible === false ? '👁️' : '🕶️'}</span>
          <span>{token.visible === false ? 'Révéler aux joueurs' : 'Masquer aux joueurs'}</span>
        </button>

        <button class="ctx-item" class:active-item={vttStore.spotlightTokenId === token.id} onclick={toggleSpotlight}>
          <span class="item-icon">🌟</span>
          <span>{vttStore.spotlightTokenId === token.id ? 'Désactiver le Spotlight' : 'Mettre en lumière (Spotlight)'}</span>
        </button>

        <button class="ctx-item" class:active-item={token.concentrating} onclick={toggleConcentration}>
          <span class="item-icon">🔮</span>
          <span>{token.concentrating ? 'Arrêter concentration' : 'Canaliser concentration'}</span>
        </button>
      </div>

      <!-- États & Conditions rapides -->
      <div class="ctx-section">
        <div class="ctx-section-label">Conditions Rapides</div>
        <div class="cond-grid">
          {#each QUICK_CONDITIONS as cond}
            <button 
              class="cond-chip" 
              class:selected={hasCond(cond.id)}
              onclick={() => toggleCondition(cond.id)}
              title={cond.label}
            >
              <span>{cond.emoji}</span>
              <span class="cond-text">{cond.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="ctx-divider"></div>

      <!-- Supprimer le token -->
      <button class="ctx-item danger" onclick={() => { onDelete?.(token.id); onclose(); }}>
        <span class="item-icon">🗑️</span>
        <span>Retirer ce pion de la carte</span>
      </button>
    {/if}
  </div>
</div>

<style>
  .ctx-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.25);
  }

  .ctx-menu {
    position: fixed;
    width: 230px;
    background: #0f172a;
    border: 1px solid rgba(245, 158, 11, 0.45);
    border-radius: 12px;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.75), 0 0 20px rgba(245, 158, 11, 0.15);
    padding: 10px;
    color: #f8fafc;
    font-family: inherit;
    display: flex;
    flex-direction: column;
    gap: 8px;
    user-select: none;
    animation: popIn 0.12s ease-out;
  }

  @keyframes popIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }

  .ctx-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .ctx-avatar-col {
    flex-shrink: 0;
  }

  .ctx-img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    border: 1.5px solid #fbbf24;
  }

  .ctx-avatar-fallback {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 13px;
    color: #fff;
    border: 1.5px solid rgba(255, 255, 255, 0.3);
  }

  .ctx-title-col {
    flex: 1;
    min-width: 0;
  }

  .ctx-name {
    font-size: 13px;
    font-weight: 700;
    color: #fbbf24;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  }

  .ctx-sub {
    font-size: 10px;
    color: #94a3b8;
    display: block;
  }

  .ctx-close-btn {
    background: transparent;
    border: none;
    color: #64748b;
    font-size: 13px;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
  }

  .ctx-close-btn:hover {
    color: #f1f5f9;
  }

  .ctx-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ctx-section-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    color: #64748b;
    letter-spacing: 0.4px;
  }

  .hp-buttons-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }

  .hp-btn {
    padding: 4px 0;
    font-size: 11px;
    font-weight: 700;
    border-radius: 6px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.12s;
  }

  .hp-btn.dmg {
    background: rgba(239, 68, 68, 0.18);
    border-color: rgba(239, 68, 68, 0.4);
    color: #fca5a5;
  }

  .hp-btn.dmg:hover {
    background: rgba(239, 68, 68, 0.35);
    color: #fff;
  }

  .hp-btn.heal {
    background: rgba(34, 197, 94, 0.18);
    border-color: rgba(34, 197, 94, 0.4);
    color: #86efac;
  }

  .hp-btn.heal:hover {
    background: rgba(34, 197, 94, 0.35);
    color: #fff;
  }

  .ctx-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .ctx-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: #e2e8f0;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: background 0.12s, color 0.12s;
  }

  .ctx-item:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .ctx-item.primary {
    background: rgba(245, 158, 11, 0.15);
    color: #fef08a;
    font-weight: 600;
  }

  .ctx-item.primary:hover {
    background: rgba(245, 158, 11, 0.3);
  }

  .ctx-item.active-item {
    background: rgba(59, 130, 246, 0.2);
    color: #93c5fd;
  }

  .ctx-item.danger {
    color: #f87171;
  }

  .ctx-item.danger:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  .item-icon {
    font-size: 14px;
    width: 16px;
    display: inline-flex;
    justify-content: center;
  }

  .cond-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }

  .cond-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    font-size: 10px;
    border-radius: 6px;
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.12s;
  }

  .cond-chip:hover {
    background: rgba(51, 65, 85, 0.8);
    color: #f1f5f9;
  }

  .cond-chip.selected {
    background: rgba(168, 85, 247, 0.25);
    border-color: #a855f7;
    color: #e9d5ff;
    font-weight: 700;
  }

  .cond-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ctx-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 2px 0;
  }
</style>

