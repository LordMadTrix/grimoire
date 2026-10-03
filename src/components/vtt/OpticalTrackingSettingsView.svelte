<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    getOpticalTrackingConfig,
    saveOpticalTrackingConfig,
    computeHomography,
    type Point2D
  } from '$lib/vtt/opticalTrackingStore.svelte';
  import { opticalEngine, type DetectedMarker } from '$lib/vtt/OpticalTrackingEngine';
  import { STL_PRESETS, triggerStlDownload, downloadAllStlPack } from '$lib/vtt/stlGenerator';
  import { getArucoDataUrl, getDefaultPrintList } from '$lib/vtt/arucoGenerator';
  import ArucoPrintModal from './ArucoPrintModal.svelte';

  let config = $state(getOpticalTrackingConfig());
  let availableCameras = $state<MediaDeviceInfo[]>([]);
  let videoPreviewEl = $state<HTMLVideoElement | null>(null);
  let isCalibrating = $state(false);
  let calibStep = $state(0); // 0=TopLeft, 1=TopRight, 2=BottomRight, 3=BottomLeft
  let calibPoints = $state<{ camera: Point2D; map: Point2D }[]>([]);
  let liveFps = $state(0);
  let detectedList = $state<DetectedMarker[]>([]);
  let showPrintModal = $state(false);
  let downloadNotification = $state('');
  let pollInterval: any = null;

  const CORNER_NAMES = [
    'Coin Haut-Gauche (Top-Left)',
    'Coin Haut-Droite (Top-Right)',
    'Coin Bas-Droite (Bottom-Right)',
    'Coin Bas-Gauche (Bottom-Left)'
  ];

  onMount(async () => {
    availableCameras = await opticalEngine.getAvailableCameras();
    if (!config.selectedDeviceId && availableCameras.length > 0) {
      config.selectedDeviceId = availableCameras[0].deviceId;
      saveOpticalTrackingConfig({ selectedDeviceId: config.selectedDeviceId });
    }

    if (config.enabled) {
      await startEngine();
    }

    pollInterval = setInterval(() => {
      liveFps = opticalEngine.lastFps;
      detectedList = opticalEngine.detectedMarkers;
    }, 400);
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
    if (!config.enabled) {
      opticalEngine.stop();
    }
  });

  async function handleToggleEnabled(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    config.enabled = checked;
    saveOpticalTrackingConfig({ enabled: checked });

    if (checked) {
      await startEngine();
    } else {
      opticalEngine.stop();
      if (videoPreviewEl) videoPreviewEl.srcObject = null;
    }
  }

  async function handleCameraChange(e: Event) {
    const deviceId = (e.target as HTMLSelectElement).value;
    config.selectedDeviceId = deviceId;
    saveOpticalTrackingConfig({ selectedDeviceId: deviceId });
    if (config.enabled) {
      await startEngine();
    }
  }

  async function startEngine() {
    const success = await opticalEngine.start();
    if (success && videoPreviewEl) {
      videoPreviewEl.srcObject = opticalEngine.getStream();
    }
  }

  async function handleDownloadStl(preset: typeof STL_PRESETS[0]) {
    downloadNotification = `Préparation de ${preset.filename}...`;
    const blob = preset.generate();
    const ok = await triggerStlDownload(preset.filename, blob);
    if (ok) {
      downloadNotification = `✓ ${preset.filename} enregistré avec succès !`;
      setTimeout(() => downloadNotification = '', 4000);
    } else {
      downloadNotification = '';
    }
  }

  async function handleDownloadAllStl() {
    downloadNotification = 'Sélectionnez le dossier de destination...';
    const count = await downloadAllStlPack();
    if (count > 0) {
      downloadNotification = `✓ Pack complet (${count} fichiers STL) enregistré avec succès !`;
      setTimeout(() => downloadNotification = '', 4500);
    } else {
      downloadNotification = '';
    }
  }

  function startCalibrationWizard() {
    isCalibrating = true;
    calibStep = 0;
    calibPoints = [];
  }

  function handlePreviewClick(e: MouseEvent) {
    if (!isCalibrating || !videoPreviewEl) return;
    const rect = videoPreviewEl.getBoundingClientRect();
    const camX = ((e.clientX - rect.left) / rect.width) * 1280;
    const camY = ((e.clientY - rect.top) / rect.height) * 720;

    // Coins théoriques par défaut sur la carte (ex: 2000x2000px)
    const mapTargets: Point2D[] = [
      { x: 100, y: 100 },
      { x: 1900, y: 100 },
      { x: 1900, y: 1900 },
      { x: 100, y: 1900 }
    ];

    calibPoints.push({
      camera: { x: camX, y: camY },
      map: mapTargets[calibStep]
    });

    calibStep++;

    if (calibStep >= 4) {
      // Calcul de la matrice
      const pairs = calibPoints.map(p => ({ from: p.camera, to: p.map }));
      const H = computeHomography(pairs);
      if (H) {
        config.homographyMatrix = H;
        saveOpticalTrackingConfig({ homographyMatrix: H });
        alert('Calibration 4-points réussie ! Les coordonnées caméra sont maintenant alignées avec la table.');
      } else {
        alert('Échec du calcul d\'homographie. Assurez-vous de cliquer les 4 coins dans l\'ordre.');
      }
      isCalibrating = false;
      calibStep = 0;
    }
  }
  let showTutorial = $state(false);
</script>

<div class="optical-tracking-container">
  <div class="header-row">
    <div>
      <h3 class="section-title">🎥 Tracking Optique Table & Figurines 3D</h3>
      <p class="section-desc">Détecte les pions physiques sur la table grâce à une webcam fixée au rétroprojecteur.</p>
    </div>
    <div style="display:flex;align-items:center;gap:10px;">
      <button type="button" class="btn-tuto" onclick={() => showTutorial = !showTutorial}>
        {showTutorial ? '📖 Masquer le guide' : '📖 Guide pas-à-pas'}
      </button>
      <label class="switch-label">
        <input type="checkbox" checked={config.enabled} onchange={handleToggleEnabled} />
        <span class="switch-slider"></span>
      </label>
    </div>
  </div>

  {#if showTutorial}
    <div class="tutorial-card">
      <div class="tuto-badge">GUIDE DE DÉMARRAGE RAPIDE</div>
      <h4>🚀 Jouer avec vos figurines physiques sur table projetée</h4>
      <div class="steps-grid">
        <div class="step-box">
          <div class="step-num">1</div>
          <div class="step-content">
            <strong>Imprimez vos socles 3D</strong>
            <p>Téléchargez les bagues STL ci-dessous selon la taille de vos figurines (ex : 25 mm pour les PJ). Impression standard PLA 0.20 mm. La figurine se clipse dans la bague sans aucun collage.</p>
          </div>
        </div>

        <div class="step-box">
          <div class="step-num">2</div>
          <div class="step-content">
            <strong>Imprimez les étiquettes ArUco</strong>
            <p>Cliquez sur "Imprimer la planche (A4)". Découpez les carrés et collez-les dans la gorge supérieure de chaque bague 3D (un point de colle ou ruban double-face fin).</p>
          </div>
        </div>

        <div class="step-box">
          <div class="step-num">3</div>
          <div class="step-content">
            <strong>Placez la webcam & Calibrez</strong>
            <p>Fixez la webcam au plafond ou sur le rétroprojecteur vers le bas. Activez l'interrupteur, cliquez sur "Calibrer 4 coins" et pointez les 4 coins de la surface projetée.</p>
          </div>
        </div>

        <div class="step-box">
          <div class="step-num">4</div>
          <div class="step-content">
            <strong>Associez vos Pions et Jouez !</strong>
            <p>Dans le Grimoire, ouvrez les paramètres d'un pion et entrez le numéro du tag (ex: ID #4). Dès que vous déplacez la figurine physique, le pion virtuel et la torche suivent en direct !</p>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if config.enabled}
    <div class="camera-config-panel">
      <div class="form-group">
        <label for="camera-select">Caméra de détection</label>
        <select id="camera-select" value={config.selectedDeviceId} onchange={handleCameraChange}>
          {#if availableCameras.length === 0}
            <option value="">— Aucune caméra détectée —</option>
          {:else}
            {#each availableCameras as cam, idx}
              <option value={cam.deviceId}>{cam.label || `Caméra ${idx + 1}`}</option>
            {/each}
          {/if}
        </select>
      </div>

      <div class="video-preview-wrapper">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="video-canvas-box" onclick={handlePreviewClick} class:cursor-crosshair={isCalibrating}>
          <!-- svelte-ignore a11y_media_has_caption -->
          <video bind:this={videoPreviewEl} autoplay playsinline muted></video>
          {#if isCalibrating}
            <div class="calibration-overlay">
              <div class="calib-banner">
                🎯 Cliquez sur : <strong>{CORNER_NAMES[calibStep]}</strong> ({calibStep + 1}/4)
              </div>
            </div>
          {/if}
          <div class="live-stats">
            <span class="badge-fps">{liveFps} FPS</span>
            <span class="badge-markers">{detectedList.length} pion(s) détecté(s)</span>
            {#if config.homographyMatrix}
              <span class="badge-calib ok">Calibré ✓</span>
            {:else}
              <span class="badge-calib warn">Non calibré</span>
            {/if}
          </div>
        </div>

        <div class="actions-row">
          <button class="btn-calib" onclick={startCalibrationWizard} disabled={isCalibrating}>
            🎯 {isCalibrating ? 'Calibration en cours...' : 'Calibrer 4 coins'}
          </button>
          {#if config.homographyMatrix}
            <button class="btn-reset-calib" onclick={() => { config.homographyMatrix = null; saveOpticalTrackingConfig({ homographyMatrix: null }); }}>
              Réinitialiser calibration
            </button>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Section Fichiers STL Directement Téléchargeables -->
  <div class="stl-section">
    {#if downloadNotification}
      <div class="stl-notification-toast">
        {downloadNotification}
      </div>
    {/if}

    <div class="stl-header">
      <div>
        <h4>📦 Fichiers 3D (STL) pour Socles de Figurines</h4>
        <p>Anneaux amovibles avec gorge intégrée pour coller les étiquettes ArUco sans abîmer les figurines peintes.</p>
      </div>
      <button class="btn-download-all" onclick={handleDownloadAllStl}>
        ⬇️ Télécharger tout le pack STL
      </button>
    </div>

    <div class="stl-grid">
      {#each STL_PRESETS as preset}
        <div class="stl-card">
          <div class="stl-card-info">
            <div class="stl-badge">{preset.badge}</div>
            <div class="stl-title">{preset.name}</div>
            <div class="stl-desc">{preset.desc}</div>
          </div>
          <button class="btn-download-stl" onclick={() => handleDownloadStl(preset)}>
            ⬇️ STL
          </button>
        </div>
      {/each}
    </div>
  </div>

  <!-- Section Planche d'Étiquettes ArUco à Imprimer -->
  <div class="print-section">
    <div class="print-header">
      <div>
        <h4>🖨️ Planche d'Étiquettes ArUco (Papier A4 / Vinyle)</h4>
        <p>Génère une planche haute résolution avec 24 marqueurs (PJ, monstres, boss et calibration) prête à découper.</p>
      </div>
      <button class="btn-print-sheet" onclick={() => showPrintModal = true}>
        🖨️ Imprimer la planche (A4)
      </button>
    </div>

    <div class="tags-preview-strip">
      {#each getDefaultPrintList().slice(0, 6) as item}
        <div class="mini-tag-card">
          <img src={getArucoDataUrl(item.id, 16)} alt="Tag #{item.id}" />
          <span>#{item.id} {item.label.split(' ')[0]}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

{#if showPrintModal}
  <ArucoPrintModal onClose={() => showPrintModal = false} />
{/if}

<style>
  .optical-tracking-container {
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 24px;
    border: 1px solid var(--border);
  }

  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .btn-tuto {
    background: rgba(229, 168, 83, 0.15);
    border: 1px solid var(--accent);
    color: var(--accent);
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
  }
  .btn-tuto:hover {
    background: var(--accent);
    color: #000;
  }

  .tutorial-card {
    margin-top: 14px;
    padding: 14px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
  }

  .tuto-badge {
    display: inline-block;
    font-size: 9px;
    font-weight: 800;
    color: var(--accent);
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .tutorial-card h4 {
    margin: 0 0 12px 0;
    font-size: 13px;
    color: #f8fafc;
  }

  .steps-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .step-box {
    display: flex;
    gap: 10px;
    background: #1e293b;
    border: 1px solid #334155;
    padding: 10px;
    border-radius: 6px;
  }

  .step-num {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--accent);
    color: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 800;
    flex-shrink: 0;
  }

  .step-content strong {
    display: block;
    font-size: 12px;
    color: #f8fafc;
    margin-bottom: 2px;
  }

  .step-content p {
    margin: 0;
    font-size: 11px;
    line-height: 1.4;
    color: #94a3b8;
  }

  .section-title {
    margin: 0 0 4px 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--accent);
  }

  .section-desc {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
  }

  /* Switch toggle */
  .switch-label {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
    cursor: pointer;
  }
  .switch-label input { opacity: 0; width: 0; height: 0; }
  .switch-slider {
    position: absolute;
    inset: 0;
    background-color: #334155;
    border-radius: 24px;
    transition: 0.2s ease;
  }
  .switch-slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    border-radius: 50%;
    transition: 0.2s ease;
  }
  input:checked + .switch-slider {
    background-color: var(--accent);
  }
  input:checked + .switch-slider:before {
    transform: translateX(20px);
  }

  .camera-config-panel {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .form-group {
    margin-bottom: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .form-group select {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
  }

  .video-preview-wrapper {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .video-canvas-box {
    position: relative;
    width: 100%;
    height: 240px;
    background: #000;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--border);
  }

  .video-canvas-box video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .cursor-crosshair {
    cursor: crosshair;
  }

  .calibration-overlay {
    position: absolute;
    top: 8px;
    left: 8px;
    right: 8px;
    display: flex;
    justify-content: center;
    pointer-events: none;
  }

  .calib-banner {
    background: rgba(229, 168, 83, 0.95);
    color: #000;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: bold;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  }

  .live-stats {
    position: absolute;
    bottom: 8px;
    left: 8px;
    display: flex;
    gap: 6px;
  }

  .badge-fps, .badge-markers, .badge-calib {
    font-size: 11px;
    font-weight: bold;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(0,0,0,0.7);
    color: #fff;
  }

  .badge-calib.ok { background: #059669; }
  .badge-calib.warn { background: #d97706; }

  .actions-row {
    display: flex;
    gap: 8px;
  }

  .btn-calib, .btn-reset-calib {
    padding: 8px 14px;
    font-size: 12px;
    font-weight: bold;
    border-radius: 6px;
    cursor: pointer;
    border: none;
  }

  .btn-calib {
    background: var(--accent);
    color: #000;
  }

  .btn-reset-calib {
    background: #334155;
    color: #fff;
  }

  /* STL Section */
  .stl-section {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .stl-header, .print-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }

  .stl-header h4, .print-header h4 {
    margin: 0 0 2px 0;
    font-size: 13px;
    color: var(--text-primary);
  }

  .stl-header p, .print-header p {
    margin: 0;
    font-size: 11px;
    color: var(--text-muted);
  }

  .btn-download-all, .btn-print-sheet {
    background: rgba(229, 168, 83, 0.15);
    border: 1px solid var(--accent);
    color: var(--accent);
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .btn-download-all:hover, .btn-print-sheet:hover {
    background: var(--accent);
    color: #000;
  }

  .stl-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .stl-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 14px;
  }

  .stl-badge {
    font-size: 10px;
    font-weight: bold;
    color: var(--accent);
    text-transform: uppercase;
    margin-bottom: 2px;
  }

  .stl-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .stl-desc {
    font-size: 11px;
    color: var(--text-muted);
  }

  .btn-download-stl {
    background: #334155;
    color: #fff;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
    cursor: pointer;
  }

  .btn-download-stl:hover {
    background: #475569;
  }

  .stl-notification-toast {
    background: rgba(16, 185, 129, 0.2);
    border: 1px solid rgba(16, 185, 129, 0.4);
    color: #34d399;
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 12px;
    text-align: center;
  }

  /* Print Section */
  .print-section {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .tags-preview-strip {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 4px 0;
  }

  .mini-tag-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    padding: 6px;
    border-radius: 4px;
    font-size: 10px;
    min-width: 60px;
  }

  .mini-tag-card img {
    width: 32px;
    height: 32px;
    margin-bottom: 4px;
  }
</style>
