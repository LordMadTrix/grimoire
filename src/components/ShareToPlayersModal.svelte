<script lang="ts">
  import { cleanNoteForPlayers, shareWithPlayers } from '$lib/playerShare';

  let {
    rawContent = '',
    defaultTitle = '',
    onclose = () => {}
  }: {
    rawContent: string;
    defaultTitle?: string;
    onclose: () => void;
  } = $props();

  let target = $state<'all' | 'playerView' | 'mobile'>('all');
  let mode = $state<'parchment' | 'ambient'>('parchment');
  let hideSecrets = $state(true);
  let sending = $state(false);

  let title = $state('');
  let text = $state('');
  let html = $state('');
  let secretsCount = $state(0);

  $effect(() => {
    const res = cleanNoteForPlayers(rawContent, { hideSecrets, defaultTitle });
    title = res.title;
    text = res.cleanText;
    html = res.cleanHtml;
    secretsCount = res.secretsCount;
  });

  function toggleHideSecrets() {
    hideSecrets = !hideSecrets;
  }

  async function handleSend() {
    if (sending) return;
    sending = true;
    try {
      const success = await shareWithPlayers({
        title: title.trim() || 'Document du MJ',
        text: text.trim(),
        html,
        target,
        mode
      });
      if (success) {
        onclose();
      }
    } finally {
      sending = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onclose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="share-backdrop" onclick={onclose} role="presentation">
  <div class="share-modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
    
    <!-- En-tête -->
    <div class="share-header">
      <div class="header-left">
        <span class="header-icon">📤</span>
        <div>
          <h2 class="header-title">Diffuser aux Joueurs</h2>
          <p class="header-subtitle">Projeter sur l'écran joueur (TV) et/ou envoyer sur les smartphones</p>
        </div>
      </div>
      <button type="button" class="close-btn" onclick={onclose} title="Fermer (Échap)">✕</button>
    </div>

    <div class="share-body">
      
      <!-- Cibles de diffusion -->
      <div class="config-section">
        <div class="section-label">1. Cible de diffusion</div>
        <div class="target-selector">
          <button
            type="button"
            class="target-btn"
            class:active={target === 'all'}
            onclick={() => target = 'all'}
          >
            <span class="target-icon">🌐</span>
            <div class="target-text">
              <strong>Tous les Joueurs</strong>
              <small>Écran TV + Smartphones</small>
            </div>
          </button>

          <button
            type="button"
            class="target-btn"
            class:active={target === 'playerView'}
            onclick={() => target = 'playerView'}
          >
            <span class="target-icon">📺</span>
            <div class="target-text">
              <strong>Vue Joueur (TV)</strong>
              <small>Second moniteur / Projecteur</small>
            </div>
          </button>

          <button
            type="button"
            class="target-btn"
            class:active={target === 'mobile'}
            onclick={() => target = 'mobile'}
          >
            <span class="target-icon">📱</span>
            <div class="target-text">
              <strong>Smartphones Joueurs</strong>
              <small>PWA mobile des joueurs</small>
            </div>
          </button>
        </div>
      </div>

      <!-- Format sur la Vue Joueur si la TV est ciblée -->
      {#if target === 'all' || target === 'playerView'}
        <div class="config-section">
          <div class="section-label">2. Style d'affichage sur la TV</div>
          <div class="mode-selector">
            <button
              type="button"
              class="mode-btn"
              class:active={mode === 'parchment'}
              onclick={() => mode = 'parchment'}
            >
              📜 <strong>Parchemin Cinématique</strong> (avec sceau de cire & police manuscrite)
            </button>
            <button
              type="button"
              class="mode-btn"
              class:active={mode === 'ambient'}
              onclick={() => mode = 'ambient'}
            >
              ✨ <strong>Texte d'Ambiance Flottant</strong> (phrase dorée au-dessus de la battlemap)
            </button>
          </div>
        </div>
      {/if}

      <!-- Protection Anti-Spoil -->
      <div class="config-section shield-section">
        <label class="shield-toggle">
          <input
            type="checkbox"
            checked={hideSecrets}
            onchange={toggleHideSecrets}
          />
          <span class="shield-text">
            <strong>🔒 Bouclier Anti-Spoil MJ</strong>
            <span>Masquer automatiquement les blocs <code>&gt; [!SECRET]</code> et <code>%% secrets %%</code></span>
          </span>
        </label>
        
        {#if secretsCount > 0}
          <div class="secrets-badge" class:warning={!hideSecrets}>
            {#if hideSecrets}
              🛡️ {secretsCount} secret{secretsCount > 1 ? 's' : ''} MJ masqué{secretsCount > 1 ? 's' : ''} en toute sécurité
            {:else}
              ⚠️ Attention : {secretsCount} secret{secretsCount > 1 ? 's' : ''} MJ sera visible aux joueurs !
            {/if}
          </div>
        {:else}
          <div class="secrets-badge safe">
            ✅ Aucun secret MJ détecté dans ce document
          </div>
        {/if}
      </div>

      <!-- Titre du document -->
      <div class="config-section">
        <label for="share-title-input" class="section-label">Titre affiché aux joueurs</label>
        <input
          id="share-title-input"
          type="text"
          class="title-input"
          bind:value={title}
          placeholder="Titre du document..."
        />
      </div>

      <!-- Aperçu de ce que verront les joueurs -->
      <div class="config-section">
        <div class="preview-header">
          <div class="section-label" style="margin: 0;">Aperçu du contenu transmis</div>
          <span class="word-count">{text.length} caractères</span>
        </div>

        {#if mode === 'parchment'}
          <div class="parchment-preview">
            <h3 class="parchment-preview-title">{title || 'Document Partagé'}</h3>
            <div class="parchment-preview-body">
              {@html html || '<p style="color:#7c5e40;font-style:italic;">(Aucun texte à afficher)</p>'}
            </div>
            <div class="preview-wax-seal"></div>
          </div>
        {:else}
          <div class="ambient-preview">
            <div class="ambient-preview-text">
              ✨ "{text || '(Texte d\'ambiance vide)'}"
            </div>
          </div>
        {/if}
      </div>

    </div>

    <!-- Actions -->
    <div class="share-footer">
      <button type="button" class="btn btn-secondary" onclick={onclose}>
        Annuler
      </button>
      <button
        type="button"
        class="btn btn-primary"
        onclick={handleSend}
        disabled={sending || (!text.trim() && !html.trim())}
      >
        {#if sending}
          ⏳ Envoi en cours...
        {:else}
          🚀 Diffuser aux Joueurs
        {/if}
      </button>
    </div>

  </div>
</div>

<style>
  .share-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    z-index: 2500;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .share-modal {
    background: #161922;
    border: 1px solid #2d3748;
    border-radius: 12px;
    width: 640px;
    max-width: 95vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(229, 168, 83, 0.2);
    overflow: hidden;
  }

  .share-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: #11131a;
    border-bottom: 1px solid #232733;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-icon {
    font-size: 26px;
  }

  .header-title {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    color: #e5a853;
  }

  .header-subtitle {
    margin: 2px 0 0;
    font-size: 12px;
    color: #94a3b8;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 18px;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 6px;
    transition: all 0.15s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .share-body {
    padding: 16px 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .config-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #cbd5e1;
  }

  .target-selector {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .target-btn {
    background: #1c212d;
    border: 1px solid #2d3748;
    border-radius: 8px;
    padding: 10px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    color: #cbd5e1;
  }

  .target-btn:hover {
    border-color: #e5a853;
    background: #232938;
  }

  .target-btn.active {
    border-color: #e5a853;
    background: rgba(229, 168, 83, 0.12);
    box-shadow: 0 0 12px rgba(229, 168, 83, 0.2);
    color: #fff;
  }

  .target-icon {
    font-size: 22px;
  }

  .target-text strong {
    display: block;
    font-size: 12px;
  }

  .target-text small {
    display: block;
    font-size: 10px;
    color: #94a3b8;
    margin-top: 2px;
  }

  .mode-selector {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .mode-btn {
    background: #1c212d;
    border: 1px solid #2d3748;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 12px;
    text-align: left;
    color: #cbd5e1;
    cursor: pointer;
    transition: all 0.15s;
  }

  .mode-btn:hover {
    border-color: #e5a853;
    background: #232938;
  }

  .mode-btn.active {
    border-color: #e5a853;
    background: rgba(229, 168, 83, 0.12);
    color: #fff;
  }

  .shield-section {
    background: #11131a;
    border: 1px solid #2d3748;
    border-radius: 8px;
    padding: 12px 14px;
  }

  .shield-toggle {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    cursor: pointer;
  }

  .shield-toggle input {
    margin-top: 3px;
    accent-color: #e5a853;
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .shield-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 13px;
    color: #f8fafc;
  }

  .shield-text span {
    font-size: 11px;
    color: #94a3b8;
  }

  .shield-text code {
    background: rgba(255, 255, 255, 0.08);
    padding: 1px 4px;
    border-radius: 3px;
    color: #e5a853;
  }

  .secrets-badge {
    margin-top: 8px;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .secrets-badge.warning {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .secrets-badge.safe {
    background: rgba(56, 189, 248, 0.1);
    color: #38bdf8;
    border-color: rgba(56, 189, 248, 0.2);
  }

  .title-input {
    background: #0f1117;
    border: 1px solid #2d3748;
    border-radius: 6px;
    padding: 8px 12px;
    color: #fff;
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
  }

  .title-input:focus {
    border-color: #e5a853;
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .word-count {
    font-size: 11px;
    color: #64748b;
  }

  /* Rendu aperçu parchemin */
  .parchment-preview {
    background: #e2cfa2;
    background-image: linear-gradient(to right, rgba(255,255,255,0.4), rgba(255,255,255,0)), url('https://www.transparenttextures.com/patterns/aged-paper.png');
    padding: 24px 20px;
    border-radius: 4px;
    color: #3b2818;
    box-shadow: inset 0 0 20px rgba(100,60,20,0.3);
    max-height: 220px;
    overflow-y: auto;
    position: relative;
    border: 1px solid #c2ab79;
  }

  .parchment-preview-title {
    font-family: 'Cinzel', serif;
    text-align: center;
    margin: 0 0 14px;
    font-size: 18px;
    border-bottom: 1px solid rgba(59, 40, 24, 0.3);
    padding-bottom: 6px;
    color: #3b2818;
  }

  .parchment-preview-body {
    font-family: 'Georgia', serif;
    font-size: 13px;
    line-height: 1.5;
  }

  .preview-wax-seal {
    position: absolute;
    bottom: 10px;
    right: 14px;
    width: 34px;
    height: 34px;
    background: radial-gradient(circle, #b91c1c 0%, #7f1d1d 80%, #450a0a 100%);
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    opacity: 0.85;
  }

  /* Rendu aperçu texte ambiance */
  .ambient-preview {
    background: #0b0c10;
    border: 1px dashed #e5a853;
    border-radius: 6px;
    padding: 24px 16px;
    text-align: center;
  }

  .ambient-preview-text {
    font-family: 'Cinzel', Georgia, serif;
    font-size: 16px;
    font-style: italic;
    color: #fef08a;
    text-shadow: 0 0 10px rgba(234, 179, 8, 0.5);
  }

  .share-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 20px;
    background: #11131a;
    border-top: 1px solid #232733;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    border: none;
  }

  .btn-secondary {
    background: #1e293b;
    color: #cbd5e1;
  }

  .btn-secondary:hover {
    background: #334155;
    color: #fff;
  }

  .btn-primary {
    background: #e5a853;
    color: #11131a;
  }

  .btn-primary:hover:not(:disabled) {
    background: #f59e0b;
    box-shadow: 0 0 14px rgba(245, 158, 11, 0.4);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
