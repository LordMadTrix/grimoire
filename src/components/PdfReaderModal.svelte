<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import * as pdfjsLib from 'pdfjs-dist';
  import { ttsReader } from '$lib/stores/ttsReader.svelte';
  import { readFileBase64 } from '$lib/api';

  // Configurer le worker PDF.js (localisé pour Vite)
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).toString();
  }

  const {
    fileUrl = '',
    fileName = 'Grimoire PDF',
    fileId = '',
    localPath = '',
    onclose
  } = $props<{
    fileUrl?: string;
    fileName?: string;
    fileId?: string;
    localPath?: string;
    onclose: () => void;
  }>();

  let canvasEl: HTMLCanvasElement | undefined = $state();
  let canvasEl2: HTMLCanvasElement | undefined = $state(); // Pour mode double page
  let pdfDoc: pdfjsLib.PDFDocumentProxy | null = $state(null);

  let numPages = $state(0);
  let currentPage = $state(1);
  let pageInputVal = $state(1);
  let scale = $state(1.3);
  let isDualPage = $state(false);
  let isFullscreen = $state(false);
  let showSidebar = $state(true);
  let sidebarTab = $state<'toc' | 'search' | 'speech'>('toc');

  let loading = $state(true);
  let error = $state('');
  let currentPageText = $state('');
  let customNarrationText = $state('');
  let outline = $state<any[]>([]);
  let searchQuery = $state('');
  let searchResults = $state<{ page: number; snippet: string }[]>([]);
  let isSearching = $state(false);

  let containerEl: HTMLElement | undefined = $state();

  $effect(() => {
    pageInputVal = currentPage;
  });

  onMount(async () => {
    await loadDocument();
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
    ttsReader.stop();
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'Escape') {
      if (isFullscreen) {
        toggleFullscreen();
      } else {
        onclose();
      }
    } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault();
      nextPage();
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      prevPage();
    } else if (e.key === '+' || e.key === '=') {
      zoomIn();
    } else if (e.key === '-') {
      zoomOut();
    } else if (e.key === '0') {
      scale = 1.2;
      renderCurrentPages();
    }
  }

  async function loadDocument() {
    loading = true;
    error = '';
    try {
      let source: any = null;

      if (localPath) {
        // Chargement d'un fichier local depuis le Coffre via base64
        const b64 = await readFileBase64(localPath);
        const binaryStr = atob(b64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        source = { data: bytes };
      } else {
        // Extraction du fileId s'il est présent
        let fid = fileId;
        if (!fid && fileUrl) {
          const m1 = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
          const m2 = fileUrl.match(/id=([a-zA-Z0-9_-]+)/);
          if (m1) fid = m1[1];
          else if (m2) fid = m2[1];
        }

        // Essayer de récupérer les octets binaires via Rust (sans restrictions CORS ni redirection proxy)
        if (fid) {
          try {
            const rawBytes = await invoke<number[]>('addon_fetch_pdf_bytes', { fileId: fid, url: fileUrl || undefined });
            if (rawBytes && rawBytes.length > 0) {
              source = { data: new Uint8Array(rawBytes) };
            }
          } catch (tauriErr) {
            console.warn('addon_fetch_pdf_bytes failed, trying direct stream URL...', tauriErr);
          }
        }

        if (!source) {
          const directUrl = fid
            ? `https://drive.usercontent.google.com/download?id=${fid}&export=download&authuser=0&confirm=t`
            : fileUrl;
          if (directUrl) {
            source = { url: directUrl };
          } else {
            throw new Error('Aucune source PDF disponible.');
          }
        }
      }

      const docParams: any = {
        ...source,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/standard_fonts/',
        isEvalSupported: false
      };

      const loadingTask = pdfjsLib.getDocument(docParams);
      pdfDoc = await loadingTask.promise;
      numPages = pdfDoc.numPages;
      currentPage = 1;

      // Récupérer le sommaire / signets
      try {
        const rawOutline = await pdfDoc.getOutline();
        outline = rawOutline || [];
      } catch {
        outline = [];
      }

      await renderCurrentPages();
    } catch (e: any) {
      console.error('Erreur chargement PDF:', e);
      error = e?.message || String(e);
    } finally {
      loading = false;
    }
  }

  async function renderPage(pageNum: number, targetCanvas: HTMLCanvasElement | undefined) {
    if (!pdfDoc || !targetCanvas) return;
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const ctx = targetCanvas.getContext('2d');
      if (!ctx) return;

      targetCanvas.width = viewport.width;
      targetCanvas.height = viewport.height;

      const renderContext: any = {
        canvasContext: ctx,
        viewport,
        canvas: targetCanvas
      };

      await page.render(renderContext).promise;

      // Extraire le texte de la page pour la synthèse vocale
      if (pageNum === currentPage) {
        try {
          const textContent = await page.getTextContent();
          currentPageText = textContent.items
            .map((item: any) => item.str || '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        } catch {
          currentPageText = '';
        }
      }
    } catch (err) {
      console.warn(`Erreur rendu page ${pageNum}:`, err);
    }
  }

  async function renderCurrentPages() {
    if (!pdfDoc) return;
    await renderPage(currentPage, canvasEl);
    if (isDualPage && currentPage + 1 <= numPages) {
      await renderPage(currentPage + 1, canvasEl2);
    }
  }

  function goToPage(page: number) {
    if (!pdfDoc) return;
    const target = Math.max(1, Math.min(numPages, page));
    if (target !== currentPage) {
      currentPage = target;
      // Arrêter la lecture TTS si on change de page
      if (ttsReader.isPlaying) {
        ttsReader.stop();
      }
      renderCurrentPages();
    }
  }

  function nextPage() {
    const step = isDualPage ? 2 : 1;
    goToPage(currentPage + step);
  }

  function prevPage() {
    const step = isDualPage ? 2 : 1;
    goToPage(currentPage - step);
  }

  function zoomIn() {
    scale = Math.min(3.0, Math.round((scale + 0.2) * 10) / 10);
    renderCurrentPages();
  }

  function zoomOut() {
    scale = Math.max(0.6, Math.round((scale - 0.2) * 10) / 10);
    renderCurrentPages();
  }

  function fitToWidth() {
    if (!containerEl || !canvasEl) return;
    const availW = containerEl.clientWidth - (showSidebar ? 320 : 40) - 80;
    const currentW = canvasEl.width / scale;
    scale = Math.max(0.6, Math.min(3.0, availW / (isDualPage ? currentW * 2 : currentW)));
    renderCurrentPages();
  }

  function toggleDualPage() {
    isDualPage = !isDualPage;
    renderCurrentPages();
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerEl?.requestFullscreen();
      isFullscreen = true;
    } else {
      document.exitFullscreen();
      isFullscreen = false;
    }
  }

  // ── Recherche dans le PDF ──
  async function performSearch() {
    if (!pdfDoc || !searchQuery.trim()) return;
    isSearching = true;
    searchResults = [];
    const q = searchQuery.toLowerCase();

    for (let p = 1; p <= numPages; p++) {
      try {
        const page = await pdfDoc.getPage(p);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((i: any) => i.str).join(' ');
        const matchIdx = text.toLowerCase().indexOf(q);
        if (matchIdx !== -1) {
          const start = Math.max(0, matchIdx - 40);
          const snippet = (start > 0 ? '…' : '') + text.slice(start, matchIdx + 80) + '…';
          searchResults.push({ page: p, snippet });
        }
      } catch {}
    }
    isSearching = false;
  }

  // ── Contrôles Vocaux TTS ──
  function handleTtsToggle() {
    if (ttsReader.isPlaying) {
      if (ttsReader.isPaused) ttsReader.resume();
      else ttsReader.pause();
    } else {
      ttsReader.speakText(currentPageText || 'Aucun texte détecté sur cette page.');
    }
  }
</script>

<div class="pdf-modal-backdrop" bind:this={containerEl}>
  <!-- En-tête / Barre d'outils supérieure -->
  <header class="pdf-header">
    <div class="pdf-header-left">
      <button class="btn-sidebar-toggle" class:active={showSidebar} onclick={() => showSidebar = !showSidebar} title="Basculer sommaire / outils">
        📑
      </button>
      <div class="pdf-title-info">
        <h3 class="pdf-filename" title={fileName}>📚 {fileName}</h3>
        {#if numPages > 0}
          <span class="pdf-meta">{numPages} pages</span>
        {/if}
      </div>
    </div>

    <!-- Navigation Pages -->
    <div class="pdf-nav-controls">
      <button class="nav-btn" disabled={currentPage <= 1} onclick={prevPage} title="Page précédente (←)">‹</button>
      <div class="page-input-wrap">
        <input
          type="number"
          min="1"
          max={numPages || 1}
          value={pageInputVal}
          onchange={(e) => goToPage(parseInt((e.target as HTMLInputElement).value) || 1)}
          class="page-input"
        />
        <span class="page-total">/ {numPages || 1}</span>
      </div>
      <button class="nav-btn" disabled={currentPage >= numPages} onclick={nextPage} title="Page suivante (→)">›</button>
    </div>

    <!-- Zoom & Vue -->
    <div class="pdf-zoom-controls">
      <button class="tool-btn" onclick={zoomOut} title="Zoom Arrière (-)">🔍-</button>
      <span class="zoom-text">{Math.round(scale * 100)}%</span>
      <button class="tool-btn" onclick={zoomIn} title="Zoom Avant (+)">🔍+</button>
      <button class="tool-btn" onclick={fitToWidth} title="Ajuster à la largeur">↔️</button>
      <button class="tool-btn" class:active={isDualPage} onclick={toggleDualPage} title="Mode Double Page">
        {isDualPage ? '📖 Double' : '📄 Simple'}
      </button>
    </div>

    <!-- Liseuse Vocale (TTS Bar) -->
    <div class="pdf-tts-controls">
      <button
        class="btn-tts-play"
        class:btn-tts-playing={ttsReader.isPlaying}
        onclick={handleTtsToggle}
        title={ttsReader.isPlaying ? (ttsReader.isPaused ? 'Reprendre la lecture vocale' : 'Mettre en pause la voix') : 'Lire cette page à voix haute'}
      >
        {#if ttsReader.isPlaying}
          {ttsReader.isPaused ? '▶️ Reprendre' : '⏸️ Pause'}
        {:else}
          🗣️ Lire Page {currentPage}
        {/if}
      </button>

      {#if ttsReader.isPlaying}
        <button class="btn-tts-stop" onclick={() => ttsReader.stop()} title="Arrêter la voix">
          ⏹️
        </button>
      {/if}

      <!-- Vitesse de lecture -->
      <select
        class="tts-rate-select"
        value={ttsReader.rate}
        onchange={(e) => ttsReader.setRate(parseFloat((e.target as HTMLSelectElement).value))}
        title="Vitesse de la voix"
      >
        <option value={0.8}>0.8x</option>
        <option value={1.0}>1.0x (Normal)</option>
        <option value={1.2}>1.2x</option>
        <option value={1.4}>1.4x (Rapide)</option>
      </select>

      <!-- Choix de la voix -->
      {#if ttsReader.availableVoices.length > 0}
        <select
          class="tts-voice-select"
          value={ttsReader.selectedVoiceName}
          onchange={(e) => ttsReader.setVoice((e.target as HTMLSelectElement).value)}
          title="Choix de la voix IA / Système"
        >
          <optgroup label="✨ Voix IA Neuronales HD (Ultra-Réalistes)">
            {#each ttsReader.availableVoices.filter(v => v.isAi) as v}
              <option value={v.aiId || v.name}>{v.name}</option>
            {/each}
          </optgroup>
          {#if ttsReader.availableVoices.some(v => !v.isAi)}
            <optgroup label="💻 Voix Système (Hors-ligne)">
              {#each ttsReader.availableVoices.filter(v => !v.isAi) as v}
                <option value={v.name}>{v.name}</option>
              {/each}
            </optgroup>
          {/if}
        </select>
      {/if}
    </div>

    <div class="pdf-header-right">
      <button class="tool-btn" onclick={toggleFullscreen} title="Plein écran">
        {isFullscreen ? '🗗' : '⛶'}
      </button>
      <button class="btn-close" onclick={onclose} title="Fermer la liseuse (Échap)">✕</button>
    </div>
  </header>

  <!-- Corps central -->
  <div class="pdf-body">
    <!-- Panneau latéral escamotable -->
    {#if showSidebar}
      <aside class="pdf-sidebar">
        <div class="sidebar-tabs">
          <button class="tab-btn" class:active={sidebarTab === 'toc'} onclick={() => sidebarTab = 'toc'}>📑 Sommaire</button>
          <button class="tab-btn" class:active={sidebarTab === 'speech'} onclick={() => sidebarTab = 'speech'}>🗣️ Texte & Voix</button>
          <button class="tab-btn" class:active={sidebarTab === 'search'} onclick={() => sidebarTab = 'search'}>🔍 Recherche</button>
        </div>

        <div class="sidebar-content">
          <!-- Sommaire / Signets -->
          {#if sidebarTab === 'toc'}
            {#if outline.length === 0}
              <div class="sidebar-empty">Aucun sommaire intégré dans ce document.</div>
            {:else}
              <div class="toc-tree">
                {#each outline as item}
                  <div class="toc-item">
                    <span class="toc-title">{item.title}</span>
                  </div>
                {/each}
              </div>
            {/if}

          <!-- Texte extrait & Surlignage vocal -->
          {:else if sidebarTab === 'speech'}
            <div class="speech-view">
              <div class="speech-header">
                <span class="speech-title">📜 Transcription Page {currentPage}</span>
                {#if currentPageText}
                  <button class="mini-btn" onclick={() => ttsReader.speakText(currentPageText)}>▶️ Relire</button>
                {/if}
              </div>

              {#if ttsReader.sentences.length > 0}
                <div class="sentences-list">
                  {#each ttsReader.sentences as sentence, idx}
                    <button
                      type="button"
                      class="sentence-p"
                      class:sentence-active={ttsReader.currentSentenceIndex === idx}
                      onclick={() => ttsReader.speakText(sentence)}
                      title="Cliquer pour écouter cette phrase"
                    >
                      {sentence}
                    </button>
                  {/each}
                </div>
              {:else if currentPageText}
                <p class="raw-page-text">{currentPageText}</p>
              {:else}
                <div class="sidebar-empty">
                  <span>📷 Cette page est une image/scan sans couche texte OCR intégrée.</span>
                </div>
              {/if}

              <!-- Boîte de narration libre pour le Maître du Jeu -->
              <div class="custom-narration-box">
                <div class="narration-header">
                  <span class="narration-title">🎙️ Narration libre / Texte personnalisé :</span>
                </div>
                <textarea
                  class="narration-textarea"
                  placeholder="Tapez ou collez ici un texte, description de salle, dialogue de PNJ ou encadré de lecture…"
                  bind:value={customNarrationText}
                  rows="3"
                ></textarea>
                <div class="narration-actions">
                  <button
                    class="btn-speak-custom"
                    disabled={!customNarrationText.trim()}
                    onclick={() => ttsReader.speakText(customNarrationText)}
                  >
                    🗣️ Faire lire ce texte à haute voix
                  </button>
                  {#if customNarrationText}
                    <button class="btn-clear-custom" onclick={() => customNarrationText = ''}>✕ Effacer</button>
                  {/if}
                </div>
              </div>
            </div>

          <!-- Recherche dans le PDF -->
          {:else if sidebarTab === 'search'}
            <div class="search-view">
              <div class="search-input-wrap">
                <input
                  type="text"
                  placeholder="Rechercher un mot, un sort, un PNJ…"
                  bind:value={searchQuery}
                  onkeydown={(e) => e.key === 'Enter' && performSearch()}
                  class="search-input"
                />
                <button class="btn-search-go" onclick={performSearch} disabled={isSearching}>
                  {isSearching ? '⏳' : '🔍'}
                </button>
              </div>

              <div class="search-results">
                {#if isSearching}
                  <div class="sidebar-empty">Recherche dans les {numPages} pages…</div>
                {:else if searchResults.length > 0}
                  {#each searchResults as res}
                    <button class="search-result-card" onclick={() => goToPage(res.page)}>
                      <span class="res-page-badge">Page {res.page}</span>
                      <span class="res-snippet">{res.snippet}</span>
                    </button>
                  {/each}
                {:else if searchQuery.trim()}
                  <div class="sidebar-empty">Aucun résultat trouvé pour "{searchQuery}".</div>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      </aside>
    {/if}

    <!-- Zone d'affichage des Pages PDF -->
    <main class="pdf-canvas-container">
      {#if loading}
        <div class="pdf-loading">
          <div class="spinner"></div>
          <span>Chargement du Grimoire PDF…</span>
        </div>
      {:else if error}
        <div class="pdf-error">
          <span class="error-icon">⚠️</span>
          <h3>Impossible d'ouvrir le document</h3>
          <p>{error}</p>
          <button class="btn-retry" onclick={loadDocument}>Réessayer</button>
        </div>
      {:else}
        <div class="canvases-wrapper" class:dual-mode={isDualPage}>
          <div class="page-card">
            <canvas bind:this={canvasEl} class="pdf-canvas"></canvas>
            <span class="page-number-tag">Page {currentPage}</span>
          </div>

          {#if isDualPage && currentPage + 1 <= numPages}
            <div class="page-card">
              <canvas bind:this={canvasEl2} class="pdf-canvas"></canvas>
              <span class="page-number-tag">Page {currentPage + 1}</span>
            </div>
          {/if}
        </div>
      {/if}
    </main>
  </div>
</div>

<style>
  .pdf-modal-backdrop {
    position: fixed; inset: 0;
    background: #090d16;
    z-index: 1200;
    display: flex; flex-direction: column;
    color: #e2e8f0; font-family: inherit;
    animation: fadeIn 0.15s ease-out;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.99); }
    to { opacity: 1; transform: scale(1); }
  }

  /* Header */
  .pdf-header {
    height: 48px; background: #0f172a; border-bottom: 1px solid #1e293b;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 1rem; gap: 12px; flex-shrink: 0; z-index: 10;
  }
  .pdf-header-left { display: flex; align-items: center; gap: 10px; min-width: 200px; }
  .btn-sidebar-toggle {
    background: #1e293b; border: 1px solid #334155; border-radius: 6px;
    padding: 4px 8px; font-size: 1rem; cursor: pointer; color: #cbd5e1;
  }
  .btn-sidebar-toggle.active { background: #0284c7; color: #fff; border-color: #38bdf8; }

  .pdf-title-info { display: flex; flex-direction: column; }
  .pdf-filename { margin: 0; font-size: 0.88rem; font-weight: 700; color: #38bdf8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px; }
  .pdf-meta { font-size: 0.68rem; color: #64748b; }

  /* Navigation */
  .pdf-nav-controls { display: flex; align-items: center; gap: 6px; }
  .nav-btn {
    background: #1e293b; border: 1px solid #334155; border-radius: 6px;
    width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
    color: #e2e8f0; font-size: 1.1rem; cursor: pointer;
  }
  .nav-btn:hover:not(:disabled) { background: #334155; color: #38bdf8; }
  .nav-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .page-input-wrap { display: flex; align-items: center; gap: 4px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 2px 6px; }
  .page-input { width: 44px; background: transparent; border: none; color: #38bdf8; font-weight: 700; text-align: right; font-family: monospace; font-size: 0.85rem; }
  .page-total { color: #64748b; font-size: 0.78rem; font-family: monospace; }

  /* Zoom */
  .pdf-zoom-controls { display: flex; align-items: center; gap: 6px; }
  .tool-btn {
    background: #1e293b; border: 1px solid #334155; border-radius: 6px;
    padding: 4px 8px; font-size: 0.78rem; font-weight: 600; color: #cbd5e1; cursor: pointer;
  }
  .tool-btn:hover { background: #334155; color: #fff; }
  .tool-btn.active { background: #0284c7; color: #fff; border-color: #38bdf8; }
  .zoom-text { font-size: 0.75rem; font-family: monospace; color: #94a3b8; min-width: 36px; text-align: center; }

  /* TTS Bar */
  .pdf-tts-controls {
    display: flex; align-items: center; gap: 6px;
    background: #141f32; border: 1px solid #0284c7; border-radius: 8px; padding: 3px 8px;
  }
  .btn-tts-play {
    background: #0284c7; border: 1px solid #38bdf8; border-radius: 6px;
    padding: 3px 10px; color: #fff; font-size: 0.78rem; font-weight: 700; cursor: pointer; transition: all 0.15s;
  }
  .btn-tts-play:hover { background: #0369a1; }
  .btn-tts-playing { background: #16a34a; border-color: #4ade80; animation: pulseGlow 1.5s infinite; }
  @keyframes pulseGlow {
    0% { box-shadow: 0 0 0 rgba(74,222,128,0.4); }
    50% { box-shadow: 0 0 10px rgba(74,222,128,0.8); }
    100% { box-shadow: 0 0 0 rgba(74,222,128,0.4); }
  }
  .btn-tts-stop {
    background: #7f1d1d; border: 1px solid #ef4444; border-radius: 6px;
    padding: 3px 6px; color: #fff; cursor: pointer;
  }
  .tts-rate-select, .tts-voice-select {
    background: #1e293b; border: 1px solid #334155; border-radius: 4px;
    color: #cbd5e1; font-size: 0.72rem; padding: 2px 4px;
  }
  .tts-voice-select { max-width: 230px; text-overflow: ellipsis; }

  .pdf-header-right { display: flex; align-items: center; gap: 8px; }
  .btn-close {
    background: none; border: none; color: #94a3b8; font-size: 1.2rem;
    cursor: pointer; padding: 4px 8px; border-radius: 4px;
  }
  .btn-close:hover { color: #fff; background: rgba(255,255,255,0.1); }

  /* Body */
  .pdf-body { flex: 1; display: flex; overflow: hidden; position: relative; }

  /* Sidebar */
  .pdf-sidebar {
    width: 320px; background: #0b1220; border-right: 1px solid #1e293b;
    display: flex; flex-direction: column; flex-shrink: 0;
  }
  .sidebar-tabs { display: flex; border-bottom: 1px solid #1e293b; background: #0f172a; }
  .tab-btn {
    flex: 1; background: none; border: none; padding: 8px 4px;
    font-size: 0.75rem; font-weight: 600; color: #94a3b8; cursor: pointer;
    border-bottom: 2px solid transparent;
  }
  .tab-btn.active { color: #38bdf8; border-color: #38bdf8; background: #141f32; }

  .sidebar-content { flex: 1; overflow-y: auto; padding: 10px; }
  .sidebar-empty { font-size: 0.8rem; color: #64748b; text-align: center; margin-top: 2rem; font-style: italic; }

  /* Speech view */
  .speech-view { display: flex; flex-direction: column; gap: 8px; }
  .speech-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 6px; }
  .speech-title { font-size: 0.8rem; font-weight: 700; color: #38bdf8; }
  .mini-btn { background: #1e293b; border: 1px solid #334155; border-radius: 4px; color: #cbd5e1; font-size: 0.72rem; padding: 2px 6px; cursor: pointer; }
  .sentences-list { display: flex; flex-direction: column; gap: 6px; }
  .sentence-p {
    font-size: 0.82rem; line-height: 1.45; color: #cbd5e1; padding: 6px 8px;
    border-radius: 6px; cursor: pointer; margin: 0; transition: all 0.15s;
    background: #101827; border: 1px solid transparent;
  }
  .sentence-p:hover { background: #1e293b; color: #fff; }
  .sentence-active {
    background: #0c4a6e !important; color: #38bdf8 !important; font-weight: 600;
    border-color: #38bdf8; box-shadow: 0 0 10px rgba(56,189,248,0.25);
  }
  .raw-page-text { font-size: 0.8rem; line-height: 1.5; color: #94a3b8; white-space: pre-wrap; }

  /* Custom Narration */
  .custom-narration-box {
    margin-top: 14px; background: #0f172a; border: 1px solid #334155;
    border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 8px;
  }
  .narration-header { display: flex; align-items: center; justify-content: space-between; }
  .narration-title { font-size: 0.76rem; font-weight: 700; color: #a5b4fc; }
  .narration-textarea {
    width: 100%; background: #090d16; border: 1px solid #1e293b; border-radius: 6px;
    color: #e2e8f0; font-size: 0.8rem; padding: 8px; resize: vertical; box-sizing: border-box;
    font-family: inherit; line-height: 1.4;
  }
  .narration-textarea:focus { outline: none; border-color: #6366f1; }
  .narration-actions { display: flex; gap: 6px; }
  .btn-speak-custom {
    background: linear-gradient(135deg, #4f46e5, #6366f1); color: #fff;
    border: none; border-radius: 6px; font-size: 0.76rem; font-weight: 700;
    padding: 6px 12px; cursor: pointer; flex: 1; transition: all 0.15s;
  }
  .btn-speak-custom:hover:not(:disabled) { background: linear-gradient(135deg, #4338ca, #4f46e5); box-shadow: 0 0 10px rgba(99,102,241,0.4); }
  .btn-speak-custom:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-clear-custom {
    background: #1e293b; border: 1px solid #334155; border-radius: 6px;
    color: #94a3b8; font-size: 0.72rem; padding: 4px 8px; cursor: pointer;
  }
  .btn-clear-custom:hover { color: #fff; background: #334155; }

  /* Search */
  .search-view { display: flex; flex-direction: column; gap: 8px; }
  .search-input-wrap { display: flex; gap: 6px; }
  .search-input {
    flex: 1; background: #1e293b; border: 1px solid #334155; border-radius: 6px;
    padding: 6px 8px; color: #fff; font-size: 0.8rem;
  }
  .btn-search-go {
    background: #0284c7; border: 1px solid #38bdf8; border-radius: 6px;
    padding: 6px 12px; color: #fff; cursor: pointer;
  }
  .search-results { display: flex; flex-direction: column; gap: 6px; }
  .search-result-card {
    background: #141f32; border: 1px solid #1e293b; border-radius: 6px;
    padding: 8px; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 4px;
  }
  .search-result-card:hover { border-color: #38bdf8; background: #1e293b; }
  .res-page-badge { font-size: 0.68rem; font-weight: 700; color: #38bdf8; font-family: monospace; }
  .res-snippet { font-size: 0.78rem; color: #cbd5e1; line-height: 1.35; }

  /* Canvas Container */
  .pdf-canvas-container {
    flex: 1; overflow: auto; background: #060910;
    display: flex; align-items: flex-start; justify-content: center;
    padding: 1.5rem;
  }
  .canvases-wrapper { display: flex; gap: 16px; align-items: center; justify-content: center; }
  .page-card {
    background: #fff; border-radius: 6px; box-shadow: 0 12px 36px rgba(0,0,0,0.8);
    position: relative; overflow: hidden; display: flex; flex-direction: column;
  }
  .pdf-canvas { display: block; max-width: 100%; height: auto; }
  .page-number-tag {
    position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.7);
    color: #fff; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-family: monospace;
  }

  .pdf-loading, .pdf-error {
    margin-top: 15vh; display: flex; flex-direction: column; align-items: center; gap: 12px;
  }
  .spinner {
    width: 36px; height: 36px; border: 3px solid rgba(56,189,248,0.2);
    border-top-color: #38bdf8; border-radius: 50%; animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .error-icon { font-size: 2.5rem; }
  .btn-retry {
    background: #0284c7; border: 1px solid #38bdf8; border-radius: 6px;
    padding: 6px 14px; color: #fff; font-weight: 600; cursor: pointer;
  }
</style>
