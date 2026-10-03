<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { getCurrentVersion } from '$lib/api';
  import { notifStore } from '$lib/stores/notifications.svelte';

  let { onClose = () => {} }: { onClose: () => void } = $props();

  let message = $state('');
  let version = $state('…');
  let userAgent = $state('');
  let isSubmitting = $state(false);

  onMount(async () => {
    try {
      version = await getCurrentVersion();
    } catch {
      // non-Tauri : garder placeholder
    }
    userAgent = navigator.userAgent;
  });

  function buildIssueBody(): string {
    return [
      '## 💬 Message du joueur',
      '',
      message,
      '',
      '---',
      '',
      `**Version de l'application :** ${version}`,
      `**Système :** ${userAgent}`,
      `**Date :** ${new Date().toISOString()}`,
      '',
    ].join('\n');
  }

  let copied = $state(false);

  async function handleCopy() {
    if (!message.trim()) return;
    try {
      await navigator.clipboard.writeText(buildIssueBody());
      copied = true;
      notifStore.add('📋', 'Copié !', 'Le message et les détails système ont été copiés dans le presse-papier.', 'info', 3000);
      setTimeout(() => (copied = false), 2500);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  }

  async function handleSubmit() {
    if (!message.trim()) {
      notifStore.add('⚠️', 'Formulaire invalide', 'Veuillez écrire un message.', 'warn', 3000);
      return;
    }
    isSubmitting = true;

    const title = encodeURIComponent('Feedback / Signalement — Grimoire');
    const body = encodeURIComponent(buildIssueBody());
    const url = `https://github.com/LordMadTrix/grimoire/issues/new?title=${title}&body=${body}`;

    try {
      await invoke('open_url', { url });
      notifStore.add('📝', 'Merci !', 'Votre message s\'ouvre dans GitHub. Échangeons ensemble.', 'success', 5000);
      onClose();
    } catch (e) {
      console.warn('invoke open_url failed, falling back to window.open', e);
      try {
        window.open(url, '_blank');
        notifStore.add('📝', 'Merci !', 'Votre message s\'ouvre dans GitHub. Échangeons ensemble.', 'success', 5000);
        onClose();
      } catch (err) {
        console.error('window.open also failed', err);
        notifStore.add('⚠️', 'Erreur d\'ouverture', 'Impossible d\'ouvrir le navigateur. Vous pouvez copier le message avec le bouton "Copier".', 'warn', 5000);
      }
    } finally {
      isSubmitting = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<div class="modal-backdrop" onclick={onClose} onkeydown={handleKeydown} role="presentation">
  <div class="modal-content" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1" onkeydown={e => e.stopPropagation()}>
    <h2>📝 Laisser un message aux développeurs</h2>
    <p class="feedback-subtitle">
      Signalez un <strong>bug</strong>, une <strong>amélioration</strong> ou partagez vos
      <strong> idées</strong>. Votre message est ouvert automatiquement en tant que
      problème GitHub que nous trierons ensemble.
    </p>

    <textarea
      bind:value={message}
      placeholder="Décrivez votre retour, le bug rencontré ou votre suggestion…"
      rows="6"
      class="feedback-textarea"
      maxlength="2000"
    ></textarea>

    <div class="feedback-context">
      <small><strong>Version :</strong> {version}</small>
      <small><strong>Système :</strong> {userAgent}</small>
      <small><strong>Espace restant :</strong> {2000 - message.length} caractères</small>
    </div>

    <div class="modal-actions">
      <button class="btn-cancel" onclick={onClose}>Annuler</button>
      <button class="btn-copy" onclick={handleCopy} disabled={!message.trim()} title="Copier le message et les informations système dans le presse-papier">
        {copied ? '✅ Copié !' : '📋 Copier'}
      </button>
      <button class="btn-save" onclick={handleSubmit} disabled={!message.trim() || isSubmitting}>
        {isSubmitting ? 'Ouverture…' : '📤 Envoyer sur GitHub'}
      </button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  .modal-content {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 24px;
    width: 90%;
    max-width: 540px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  }

  h2 {
    margin: 0 0 8px 0;
    color: var(--text-primary);
  }

  .feedback-subtitle {
    margin: 0 0 20px 0;
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.5;
  }

  textarea.feedback-textarea {
    width: 100%;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    padding: 12px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 14px;
    resize: vertical;
  }

  textarea.feedback-textarea:focus {
    outline: none;
    border-color: var(--accent);
  }

  .feedback-context {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 12px;
  }

  .feedback-context small {
    color: var(--text-muted);
    font-size: 12px;
    word-break: break-all;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
  }

  button {
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
  }

  .btn-cancel {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-secondary);
  }
  .btn-cancel:hover { background: var(--bg-hover); }

  .btn-copy {
    background: rgba(229, 168, 83, 0.1);
    border: 1px solid var(--accent);
    color: var(--accent);
  }
  .btn-copy:hover:not(:disabled) {
    background: rgba(229, 168, 83, 0.2);
  }
  .btn-copy:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-save {
    background: var(--accent);
    border: none;
    color: white;
  }
  .btn-save:hover:not(:disabled) { background: var(--accent-secondary); }
  .btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
