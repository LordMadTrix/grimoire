<script lang="ts">
  import { exportCampaignPackage, importCampaignPackage, type ExportResult, type ImportResult } from '$lib/services/campaignService';
  import { getVaultPath, setVaultTree } from '$lib/stores/vault.svelte';
  import { openVault } from '$lib/api';

  const { onclose } = $props<{ onclose: () => void }>();

  const currentPath = getVaultPath();
  let campaignTitle = $state(currentPath ? currentPath.split(/[\\/]/).pop() || 'Ma Campagne' : 'Ma Campagne');
  let isProcessing = $state(false);
  let statusMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleExport() {
    const vp = getVaultPath();
    if (!vp) {
      statusMessage = { type: 'error', text: 'Aucun coffre ouvert à exporter.' };
      return;
    }

    isProcessing = true;
    statusMessage = null;
    try {
      const res = await exportCampaignPackage(vp, campaignTitle);
      if (res) {
        const sizeMb = (res.total_bytes / (1024 * 1024)).toFixed(2);
        statusMessage = {
          type: 'success',
          text: `Campagne exportée avec succès ! (${res.total_files} fichiers, ${sizeMb} Mo)`
        };
      }
    } catch (e: any) {
      statusMessage = { type: 'error', text: `Erreur d'exportation : ${e?.message || e}` };
    } finally {
      isProcessing = false;
    }
  }

  async function handleImport() {
    const vp = getVaultPath();
    if (!vp) {
      statusMessage = { type: 'error', text: 'Veuillez ouvrir un coffre cible avant d\'importer.' };
      return;
    }

    isProcessing = true;
    statusMessage = null;
    try {
      const res = await importCampaignPackage(vp);
      if (res) {
        statusMessage = {
          type: 'success',
          text: `Campagne importée avec succès ! ${res.extracted_files} fichiers extraits.`
        };
        // Recharger le dossier
        const tree = await openVault(vp);
        setVaultTree(tree);
      }
    } catch (e: any) {
      statusMessage = { type: 'error', text: `Erreur d'importation : ${e?.message || e}` };
    } finally {
      isProcessing = false;
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-backdrop" onclick={onclose}>
  <div class="modal-card" onclick={(e) => e.stopPropagation()}>
    <!-- En-tête -->
    <header class="modal-header">
      <div class="modal-title-wrap">
        <span class="modal-icon">📦</span>
        <div>
          <h2 class="modal-title">Sauvegarde & Partage de Campagne</h2>
          <p class="modal-subtitle">Exportez ou importez l'intégralité de vos notes, cartes HD, jetons et configurations (.grimoire)</p>
        </div>
      </div>
      <button class="btn-close" onclick={onclose}>✕</button>
    </header>

    <!-- Message de statut -->
    {#if statusMessage}
      <div class="status-banner" class:status-success={statusMessage.type === 'success'} class:status-error={statusMessage.type === 'error'}>
        <span>{statusMessage.type === 'success' ? '✅' : '⚠️'}</span>
        <span>{statusMessage.text}</span>
      </div>
    {/if}

    <!-- Contenu -->
    <div class="modal-body">
      <!-- Section Exportation -->
      <div class="action-card">
        <div class="card-header">
          <span class="card-icon">📤</span>
          <div>
            <h3 class="card-title">Exporter la Campagne Actuelle</h3>
            <p class="card-desc">Génère une archive tout-en-un compressée prête à être partagée ou sauvegardée.</p>
          </div>
        </div>

        <div class="input-group">
          <label for="campaign-title">Nom de la Campagne :</label>
          <input
            id="campaign-title"
            type="text"
            bind:value={campaignTitle}
            placeholder="Ex: La Malédiction de Strahd"
            class="text-input"
          />
        </div>

        <button
          class="btn-action btn-export"
          onclick={handleExport}
          disabled={isProcessing || !currentPath}
        >
          {isProcessing ? '⏳ Exportation en cours…' : '💾 Exporter en .grimoire'}
        </button>
      </div>

      <!-- Section Importation -->
      <div class="action-card">
        <div class="card-header">
          <span class="card-icon">📥</span>
          <div>
            <h3 class="card-title">Importer un Paquet de Campagne</h3>
            <p class="card-desc">Restaure les notes, cartes et pions d'un fichier .grimoire ou .zip dans votre coffre.</p>
          </div>
        </div>

        <button
          class="btn-action btn-import"
          onclick={handleImport}
          disabled={isProcessing || !currentPath}
        >
          {isProcessing ? '⏳ Importation en cours…' : '📂 Sélectionner un paquet (.grimoire)'}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75);
    display: flex; align-items: center; justify-content: center;
    z-index: 9999; backdrop-filter: blur(4px);
  }
  .modal-card {
    background: #0f172a; border: 1px solid #334155; border-radius: 12px;
    width: 90%; max-width: 580px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    overflow: hidden; display: flex; flex-direction: column;
  }
  .modal-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 16px 20px; border-bottom: 1px solid #1e293b; background: #0b1220;
  }
  .modal-title-wrap { display: flex; align-items: center; gap: 12px; }
  .modal-icon { font-size: 1.8rem; }
  .modal-title { margin: 0; font-size: 1.15rem; color: #f8fafc; font-weight: 700; }
  .modal-subtitle { margin: 2px 0 0 0; font-size: 0.75rem; color: #94a3b8; }
  .btn-close {
    background: none; border: none; color: #94a3b8; font-size: 1.2rem;
    cursor: pointer; padding: 4px 8px; border-radius: 4px;
  }
  .btn-close:hover { color: #fff; background: rgba(255,255,255,0.1); }

  .status-banner {
    margin: 14px 20px 0 20px; padding: 10px 14px; border-radius: 8px;
    font-size: 0.8rem; display: flex; align-items: center; gap: 8px;
  }
  .status-success { background: #064e3b; border: 1px solid #10b981; color: #a7f3d0; }
  .status-error { background: #7f1d1d; border: 1px solid #ef4444; color: #fecaca; }

  .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
  .action-card {
    background: #1e293b; border: 1px solid #334155; border-radius: 8px;
    padding: 16px; display: flex; flex-direction: column; gap: 12px;
  }
  .card-header { display: flex; align-items: center; gap: 10px; }
  .card-icon { font-size: 1.4rem; }
  .card-title { margin: 0; font-size: 0.92rem; color: #e2e8f0; font-weight: 700; }
  .card-desc { margin: 2px 0 0 0; font-size: 0.74rem; color: #94a3b8; line-height: 1.35; }

  .input-group { display: flex; flex-direction: column; gap: 4px; }
  .input-group label { font-size: 0.74rem; color: #cbd5e1; font-weight: 600; }
  .text-input {
    background: #090d16; border: 1px solid #334155; border-radius: 6px;
    color: #f8fafc; font-size: 0.82rem; padding: 8px 10px;
  }
  .text-input:focus { outline: none; border-color: #38bdf8; }

  .btn-action {
    border: none; border-radius: 6px; font-size: 0.82rem; font-weight: 700;
    padding: 9px 16px; cursor: pointer; transition: all 0.15s;
  }
  .btn-export {
    background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff;
  }
  .btn-export:hover:not(:disabled) { background: linear-gradient(135deg, #0369a1, #075985); box-shadow: 0 0 12px rgba(2,132,199,0.4); }
  .btn-import {
    background: linear-gradient(135deg, #059669, #047857); color: #fff;
  }
  .btn-import:hover:not(:disabled) { background: linear-gradient(135deg, #047857, #065f46); box-shadow: 0 0 12px rgba(5,150,105,0.4); }
  .btn-action:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
