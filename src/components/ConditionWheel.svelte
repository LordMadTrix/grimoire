<script lang="ts">
  import { vttStore } from '$lib/stores/vtt.svelte';
  import { emitToPlayerView } from '$lib/api';

  let { tokenId, x, y, onclose, onDelete }: {
    tokenId: string; x: number; y: number;
    onclose: () => void;
    onDelete?: (id: string) => void;
  } = $props();

  const CONDITIONS = [
    { id: 'poisoned',   emoji: '🤢', label: 'Empoisonné', color: '#22c55e' },
    { id: 'stunned',    emoji: '⚡', label: 'Étourdi',    color: '#eab308' },
    { id: 'bleeding',   emoji: '🩸', label: 'Saignement', color: '#ef4444' },
    { id: 'burning',    emoji: '🔥', label: 'Brûlure',    color: '#f97316' },
    { id: 'frozen',     emoji: '❄️', label: 'Gelé',       color: '#38bdf8' },
    { id: 'frightened', emoji: '😱', label: 'Effrayé',    color: '#a855f7' },
    { id: 'prone',      emoji: '⬇️', label: 'À terre',    color: '#94a3b8' },
    { id: 'blinded',    emoji: '🙈', label: 'Aveuglé',    color: '#fbbf24' },
  ];

  const R = 60; // rayon roue
  const BTN = 22; // rayon bouton

  function toggle(condId: string) {
    const token = vttStore.tokens.find(t => t.id === tokenId);
    if (!token) return;
    const current = token.conditions ?? [];
    token.conditions = current.includes(condId) ? current.filter(c => c !== condId) : [...current, condId];
    vttStore.tokens = [...vttStore.tokens];
    emitToPlayerView('update_tokens', vttStore.tokens);
  }

  function hasCondition(condId: string) {
    return (vttStore.tokens.find(t => t.id === tokenId)?.conditions ?? []).includes(condId);
  }

  const N = CONDITIONS.length;
  function angle(i: number) { return (i / N) * 2 * Math.PI - Math.PI / 2; }
  function bx(i: number) { return R * Math.cos(angle(i)); }
  function by(i: number) { return R * Math.sin(angle(i)); }

  // Position écran — éviter les bords (réactif si les props changent)
  const wx = $derived(Math.min(Math.max(x, 90), window.innerWidth - 90));
  const wy = $derived(Math.min(Math.max(y, 90), window.innerHeight - 90));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="cw-backdrop"
  onclick={onclose}
  role="presentation"
  style="position:fixed;inset:0;z-index:2000"
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="cw-root"
    style="position:fixed;left:{wx}px;top:{wy}px;transform:translate(-50%,-50%)"
    onclick={e => e.stopPropagation()}
    role="menu"
    tabindex="-1"
  >
    <svg width="{(R+BTN+8)*2}" height="{(R+BTN+8)*2}" viewBox="{-(R+BTN+8)} {-(R+BTN+8)} {(R+BTN+8)*2} {(R+BTN+8)*2}">
      <!-- Centre : nom du token -->
      <circle r="28" fill="rgba(22,27,34,0.95)" stroke="#2d3748" stroke-width="1.5"/>
      <text y="-3" text-anchor="middle" font-size="9" fill="#c9d1d9" font-weight="700">
        {vttStore.tokens.find(t=>t.id===tokenId)?.name?.slice(0,8) ?? '?'}
      </text>
      <!-- Bouton supprimer (centre bas) -->
      {#if onDelete}
        <g
          transform="translate(0,14)"
          onclick={() => { onDelete!(tokenId); onclose(); }}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDelete!(tokenId); onclose(); } }}
          style="cursor:pointer"
          role="button"
          tabindex="0"
          aria-label="Supprimer le pion"
        >
          <circle r="10" fill="#ef4444" fill-opacity="0.85" stroke="#b91c1c" stroke-width="1.5"/>
          <text y="4" text-anchor="middle" font-size="11">🗑️</text>
        </g>
      {/if}

      <!-- Boutons de condition -->
      {#each CONDITIONS as cond, i}
        {@const active = hasCondition(cond.id)}
        <g
          transform="translate({bx(i)},{by(i)})"
          onclick={() => toggle(cond.id)}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(cond.id); } }}
          style="cursor:pointer"
          role="menuitem"
          tabindex="0"
          aria-label={cond.label}
        >
          <circle
            r={BTN}
            fill={active ? cond.color : 'rgba(22,27,34,0.95)'}
            fill-opacity={active ? 0.85 : 1}
            stroke={active ? cond.color : '#2d3748'}
            stroke-width={active ? 2.5 : 1.5}
          />
          <text y="5" text-anchor="middle" font-size="16">{cond.emoji}</text>
          {#if active}
            <circle r={BTN} fill="none" stroke={cond.color} stroke-width="3" opacity="0.4" stroke-dasharray="4 2"/>
          {/if}
        </g>

        <!-- Tooltip label -->
        <text
          x={bx(i) * 1.62}
          y={by(i) * 1.62 + 4}
          text-anchor="middle"
          font-size="8"
          fill={active ? cond.color : '#8899b7'}
          font-weight={active ? '700' : '400'}
        >{cond.label}</text>
      {/each}
    </svg>

    <button class="cw-close" onclick={onclose}>✕</button>
  </div>
</div>

<style>
  .cw-root { user-select:none; }
  .cw-close {
    position:absolute; top:-8px; right:-8px;
    background:#ef4444; border:none; border-radius:50%;
    width:20px; height:20px; font-size:10px; color:#fff;
    cursor:pointer; display:flex; align-items:center; justify-content:center;
    box-shadow:0 2px 8px rgba(0,0,0,.6);
  }
</style>
