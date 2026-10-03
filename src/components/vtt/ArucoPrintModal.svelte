<script lang="ts">
  import {
    getDefaultPrintList,
    generateArucoSvg,
    openArucoSheetInDefaultBrowser,
    exportArucoSheetHtml
  } from '$lib/vtt/arucoGenerator';

  let { onClose = () => {} }: { onClose: () => void } = $props();

  let tagSizeMm = $state(20);
  let statusMessage = $state('');
  let isOpening = $state(false);

  const items = getDefaultPrintList();

  async function handleOpenBrowser() {
    isOpening = true;
    statusMessage = 'Ouverture de votre navigateur par défaut...';
    try {
      const ok = await openArucoSheetInDefaultBrowser(tagSizeMm);
      if (ok) {
        statusMessage = '✓ Planche ouverte dans votre navigateur ! Utilisez Ctrl+P pour imprimer.';
      } else {
        statusMessage = 'Échec de l\'ouverture automatique. Utilisez le bouton Enregistrer HTML.';
      }
    } catch (e: any) {
      statusMessage = `Erreur : ${e?.message || e}`;
    } finally {
      isOpening = false;
    }
  }

  async function handleSaveHtml() {
    statusMessage = 'Enregistrement en cours...';
    try {
      const ok = await exportArucoSheetHtml(tagSizeMm);
      if (ok) {
        statusMessage = '✓ Fichier HTML de la planche enregistré avec succès !';
      } else {
        statusMessage = '';
      }
    } catch (e: any) {
      statusMessage = `Erreur : ${e?.message || e}`;
    }
  }

  function handleDirectPrint() {
    window.print();
  }
</script>

<div class="print-modal-backdrop" onclick={onClose} role="presentation" onkeydown={(e) => e.key === 'Escape' && onClose()}>
  <div class="print-modal-dialog" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1" onkeydown={(e) => e.stopPropagation()}>
    <div class="modal-top-bar">
      <div class="top-title">
        <h3>🖨️ Impression des Marqueurs ArUco (Format A4)</h3>
        <span class="subtitle">24 marqueurs prêts pour vos socles 3D (PJ, Ennemis, Boss, Calibration)</span>
      </div>

      <div class="controls-row">
        <label class="size-label">
          <span>Taille :</span>
          <select bind:value={tagSizeMm}>
            <option value={15}>15 mm (Petites figurines)</option>
            <option value={20}>20 mm (Standard 25-32 mm)</option>
            <option value={25}>25 mm (Grandes créatures 50 mm)</option>
          </select>
        </label>

        <button class="btn-browser" onclick={handleOpenBrowser} disabled={isOpening}>
          🌐 Ouvrir dans le navigateur
        </button>

        <button class="btn-save-html" onclick={handleSaveHtml}>
          💾 Enregistrer HTML
        </button>

        <button class="btn-direct-print" onclick={handleDirectPrint}>
          🖨️ Imprimer
        </button>

        <button class="btn-close" onclick={onClose}>✕</button>
      </div>
    </div>

    {#if statusMessage}
      <div class="status-banner">{statusMessage}</div>
    {/if}

    <div class="preview-scroll-area">
      <div class="a4-sheet">
        <div class="sheet-header">
          <div>
            <h2>Grimoire VTT — Planche d'Étiquettes ArUco 4×4</h2>
            <p>Découpez le long des pointillés et collez dans la bague 3D correspondante. Échelle 100%.</p>
          </div>
          <span class="dimension-badge">{tagSizeMm} × {tagSizeMm} mm</span>
        </div>

        <div class="tags-sheet-grid">
          {#each items as item}
            <div class="sheet-tag-card">
              <div class="svg-box">
                {@html generateArucoSvg(item.id, tagSizeMm)}
              </div>
              <div class="tag-meta">
                <span class="id-pill" style="background:{item.colorTag}">ID #{item.id}</span>
                <span class="label-text">{item.label}</span>
                <span class="dim-text">{tagSizeMm} mm</span>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .print-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 11000;
  }

  .print-modal-dialog {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 12px;
    width: 95%;
    max-width: 960px;
    height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 64px rgba(0,0,0,0.8);
    overflow: hidden;
  }

  .modal-top-bar {
    padding: 14px 20px;
    background: #0f172a;
    border-bottom: 1px solid #334155;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .top-title h3 {
    margin: 0;
    font-size: 15px;
    color: #f8fafc;
  }

  .subtitle {
    font-size: 11px;
    color: #94a3b8;
  }

  .controls-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .size-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #cbd5e1;
  }

  .size-label select {
    background: #1e293b;
    color: #f8fafc;
    border: 1px solid #475569;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
  }

  .btn-browser {
    background: var(--accent);
    color: #000;
    border: none;
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .btn-save-html, .btn-direct-print {
    background: #334155;
    color: #f8fafc;
    border: 1px solid #475569;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-close {
    background: transparent;
    color: #94a3b8;
    border: none;
    font-size: 16px;
    cursor: pointer;
    padding: 4px 8px;
  }

  .status-banner {
    padding: 8px 16px;
    background: rgba(16, 185, 129, 0.15);
    border-bottom: 1px solid rgba(16, 185, 129, 0.3);
    color: #34d399;
    font-size: 12px;
    font-weight: 600;
    text-align: center;
  }

  .preview-scroll-area {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    background: #0b0f19;
    display: flex;
    justify-content: center;
  }

  /* Feuille A4 blanche réaliste */
  .a4-sheet {
    background: #ffffff;
    color: #111827;
    width: 210mm;
    min-height: 297mm;
    padding: 12mm;
    border-radius: 2px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
  }

  .sheet-header {
    border-bottom: 2px solid #111;
    padding-bottom: 10px;
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }

  .sheet-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
  }

  .sheet-header p {
    margin: 2px 0 0 0;
    font-size: 11px;
    color: #4b5563;
  }

  .dimension-badge {
    background: #e2e8f0;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: bold;
    color: #334155;
  }

  .tags-sheet-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .sheet-tag-card {
    border: 1px dashed #9ca3af;
    padding: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: #f9fafb;
    border-radius: 4px;
  }

  .svg-box {
    margin-bottom: 6px;
    box-shadow: 0 0 0 1px #000;
  }

  .tag-meta {
    text-align: center;
    width: 100%;
  }

  .id-pill {
    display: inline-block;
    color: #fff;
    font-size: 9px;
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 3px;
    margin-bottom: 2px;
  }

  .label-text {
    display: block;
    font-size: 10px;
    font-weight: 700;
    color: #1f2937;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dim-text {
    font-size: 8px;
    color: #6b7280;
  }
</style>
