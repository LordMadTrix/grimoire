<script lang="ts">
  import { notifStore } from '$lib/stores/notifications.svelte';
</script>

{#if notifStore.list.length > 0}
  <div class="notif-stack">
    {#each notifStore.list as n (n.id)}
      <div class="notif notif-{n.type}">
        <span class="notif-icon">{n.icon}</span>
        <div class="notif-body">
          <div class="notif-title">{n.title}</div>
          <div class="notif-msg">{n.msg}</div>
        </div>
        <button class="notif-close" onclick={() => notifStore.remove(n.id)}>×</button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .notif-stack {
    position: fixed;
    bottom: 24px;
    right: 20px;
    display: flex;
    flex-direction: column-reverse;
    gap: 8px;
    z-index: 2000;
    max-width: 320px;
    pointer-events: none;
  }

  .notif {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    background: var(--bg-secondary, #161b22);
    border: 1px solid var(--border, #2d3748);
    border-radius: 10px;
    padding: 11px 14px;
    box-shadow: 0 6px 24px rgba(0,0,0,.6);
    pointer-events: all;
    animation: notifIn .25s ease;
  }

  .notif-info  { border-left: 3px solid #60a5fa; }
  .notif-success { border-left: 3px solid #22c55e; }
  .notif-warn  { border-left: 3px solid #eab308; }
  .notif-danger { border-left: 3px solid #ef4444; }

  .notif-icon { font-size: 18px; flex-shrink: 0; line-height: 1; padding-top: 1px; }

  .notif-body { flex: 1; min-width: 0; }

  .notif-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .07em;
    margin-bottom: 2px;
    color: var(--text-muted, #8899b7);
  }

  .notif-info  .notif-title { color: #60a5fa; }
  .notif-success .notif-title { color: #22c55e; }
  .notif-warn  .notif-title { color: #eab308; }
  .notif-danger .notif-title { color: #ef4444; }

  .notif-msg {
    font-size: 13px;
    line-height: 1.4;
    color: var(--text-primary, #c9d1d9);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .notif-close {
    background: none;
    border: none;
    color: var(--text-muted, #8899b7);
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 0 2px;
    flex-shrink: 0;
    align-self: flex-start;
  }

  .notif-close:hover { color: var(--text-primary, #c9d1d9); }

  @keyframes notifIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>
