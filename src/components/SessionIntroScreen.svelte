<script lang="ts">
  import { fetchBinaryAssetUrl, readFileBase64, isTauri } from '$lib/api';
  import type { PlayerIntroPayload } from '$lib/stores/sessionIntro.svelte';

  let { 
    data, 
    vaultPath = '',
    isPreview = false,
    onClose
  }: { 
    data: PlayerIntroPayload | null; 
    vaultPath?: string;
    isPreview?: boolean;
    onClose?: () => void;
  } = $props();

  let resolvedImageSrc = $state<string>('');

  function formatTime(secs: number): string {
    if (!secs || secs <= 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  $effect(() => {
    if (!data?.imageUrl) {
      resolvedImageSrc = '';
      return;
    }

    const src = data.imageUrl;
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('blob:')) {
      resolvedImageSrc = src;
      return;
    }

    const isAbsolute = /^[a-zA-Z]:[\\/]/.test(src) || src.startsWith('/');
    const fullPath = isAbsolute ? src : (vaultPath ? `${vaultPath}/${src}` : src);

    if (isTauri()) {
      fetchBinaryAssetUrl(fullPath, 'image/jpeg')
        .then(blobUrl => {
          resolvedImageSrc = blobUrl;
        })
        .catch(() => {
          readFileBase64(fullPath)
            .then(b64 => {
              const ext = fullPath.split('.').pop()?.toLowerCase();
              const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
              resolvedImageSrc = `data:${mime};base64,${b64}`;
            })
            .catch(() => {
              resolvedImageSrc = src;
            });
        });
    } else {
      resolvedImageSrc = src;
    }
  });
</script>

{#if data && data.active}
  <div 
    class="intro-screen-overlay theme-{data.theme || 'cinematic'}" 
    class:is-preview={isPreview}
    role="region"
    aria-label="Écran d'introduction de la session"
  >
    <!-- Arrière-plan : Image d'ambiance avec effet Ken Burns doux -->
    {#if resolvedImageSrc}
      <div 
        class="artwork-layer" 
        style="background-image: url('{resolvedImageSrc}');"
      ></div>
    {/if}

    <!-- Couche d'effets d'ambiance selon le thème -->
    <div class="ambient-backdrop"></div>

    <!-- Météo cinématique en surimpression -->
    {#if data.weatherEffect === 'rain' || data.weatherEffect === 'storm'}
      <div class="rain-overlay">
        <div class="rain-streak r1"></div>
        <div class="rain-streak r2"></div>
        <div class="rain-streak r3"></div>
      </div>
      {#if data.weatherEffect === 'storm'}
        <div class="lightning-flash-layer"></div>
      {/if}
    {:else if data.weatherEffect === 'snow'}
      <div class="snow-overlay">
        <div class="snowflake s1">❄</div>
        <div class="snowflake s2">❅</div>
        <div class="snowflake s3">❆</div>
        <div class="snowflake s4">❄</div>
        <div class="snowflake s5">❅</div>
      </div>
    {:else if data.weatherEffect === 'embers' || data.theme === 'cinders'}
      <div class="cinder-particles">
        <span class="cinder c1"></span>
        <span class="cinder c2"></span>
        <span class="cinder c3"></span>
        <span class="cinder c4"></span>
        <span class="cinder c5"></span>
      </div>
    {/if}

    {#if data.theme === 'starry'}
      <div class="stars-glimmer"></div>
    {/if}

    <!-- Vignettage cinéma théâtral -->
    <div class="vignette-overlay"></div>

    <!-- Compte à rebours avant lancement si actif -->
    {#if data.countdownRemaining > 0}
      <div class="countdown-badge-top">
        <span class="hourglass-icon">⏳</span>
        <span class="countdown-label">Lancement dans :</span>
        <span class="countdown-digits">{formatTime(data.countdownRemaining)}</span>
      </div>
    {/if}

    <!-- Conteneur narratif principal -->
    <div class="intro-content-container">
      
      <!-- Ornement supérieur -->
      <div class="top-ornament">
        <span class="ornament-line left"></span>
        <span class="ornament-gem">✦</span>
        <span class="ornament-line right"></span>
      </div>

      <!-- Sous-titre ou Acte -->
      {#if data.subtitle}
        <div class="intro-subtitle-badge">
          {data.subtitle}
        </div>
      {/if}

      <!-- Titre majeur de la session -->
      <h1 class="intro-main-title">
        {data.title || 'Grimoire — Nouvelle Session'}
      </h1>

      <div class="gold-divider"></div>

      <!-- Mode 1 : Défilement 3D spatial (Star Wars Crawl) -->
      {#if data.textMode === 'crawl' && data.narration}
        <div class="crawl-perspective-viewport">
          <div class="crawl-plane">
            <h2 class="crawl-header">{data.title}</h2>
            <p class="crawl-paragraph">
              {data.narration}
            </p>
          </div>
        </div>

      <!-- Mode 2 : Carte de narration classique -->
      {:else if data.narration}
        <div class="narration-card">
          <p class="narration-text">
            {data.narration}
          </p>
        </div>
      {/if}

      <!-- Casting des Héros de la table (Option 3) -->
      {#if data.showHeroes && data.heroes && data.heroes.length > 0}
        <div class="heroes-cast-section">
          <div class="cast-label-row">
            <span class="cast-line"></span>
            <span class="cast-title">DANS LES RÔLES PRINCIPAUX</span>
            <span class="cast-line"></span>
          </div>
          <div class="heroes-avatar-grid">
            {#each data.heroes as hero}
              <div class="hero-chip">
                {#if hero.imageUrl}
                  <img src={hero.imageUrl} alt={hero.name} class="hero-avatar" />
                {:else}
                  <div class="hero-avatar-fallback">🛡️</div>
                {/if}
                <div class="hero-meta">
                  <span class="hero-name">{hero.name}</span>
                  {#if hero.role}
                    <span class="hero-role">{hero.role}</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Footer discret pour la musique -->
      <div class="intro-footer-cue">
        <span class="pulse-note">🎵</span>
        <span class="cue-text">Que l'aventure commence...</span>
      </div>

      {#if isPreview && onClose}
        <button class="btn-close-preview" onclick={onClose}>
          ✕ Fermer l'aperçu
        </button>
      {/if}

    </div>

  </div>
{/if}

<style>
  .intro-screen-overlay {
    position: absolute;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background-color: #05060a;
    color: #e5a853;
    animation: introFadeIn 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }

  .intro-screen-overlay.is-preview {
    position: fixed;
    z-index: 9999;
  }

  /* ── Image d'ambiance avec zoom cinématique Ken Burns lent ── */
  .artwork-layer {
    position: absolute;
    inset: -40px;
    background-size: cover;
    background-position: center 35%;
    background-repeat: no-repeat;
    filter: brightness(0.65) contrast(1.1);
    transform: scale(1);
    animation: kenBurns 45s ease-out infinite alternate;
    will-change: transform;
  }

  @keyframes kenBurns {
    0%   { transform: scale(1) translate(0, 0); }
    100% { transform: scale(1.12) translate(-1.5%, -1%); }
  }

  /* ── Vignettage et masques d'ambiance ── */
  .vignette-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(circle at center, rgba(0,0,0,0.15) 20%, rgba(0,0,0,0.75) 70%, rgba(0,0,0,0.96) 100%);
  }

  .ambient-backdrop {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  /* ── Compte à rebours supérieur ── */
  .countdown-badge-top {
    position: absolute;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(10, 14, 22, 0.85);
    border: 1px solid rgba(229, 168, 83, 0.5);
    box-shadow: 0 4px 20px rgba(0,0,0,0.7), 0 0 15px rgba(229,168,83,0.25);
    border-radius: 20px;
    padding: 6px 18px;
    backdrop-filter: blur(8px);
  }

  .hourglass-icon {
    font-size: 15px;
    animation: flipHourglass 4s infinite ease-in-out;
  }

  @keyframes flipHourglass {
    0%, 85%  { transform: rotate(0deg); }
    100%     { transform: rotate(180deg); }
  }

  .countdown-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: rgba(229, 168, 83, 0.85);
    font-weight: 700;
  }

  .countdown-digits {
    font-size: 15px;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    color: #ffd88a;
    text-shadow: 0 0 10px rgba(229, 168, 83, 0.6);
  }

  /* ── Météo Cinématique : Pluie & Orage ── */
  .rain-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 5;
    opacity: 0.35;
  }

  .rain-streak {
    position: absolute;
    top: -100px;
    width: 2px;
    height: 120px;
    background: linear-gradient(to bottom, transparent, rgba(200, 230, 255, 0.8));
    animation: rainFall 0.8s linear infinite;
  }
  .r1 { left: 25%; animation-duration: 0.7s; }
  .r2 { left: 60%; animation-duration: 0.9s; animation-delay: 0.2s; }
  .r3 { left: 85%; animation-duration: 0.65s; animation-delay: 0.4s; }

  @keyframes rainFall {
    0%   { transform: translateY(-100px) skewX(-15deg); }
    100% { transform: translateY(110vh) skewX(-15deg); }
  }

  .lightning-flash-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: rgba(255, 255, 255, 0.45);
    opacity: 0;
    z-index: 6;
    animation: stormLightning 12s infinite;
  }

  @keyframes stormLightning {
    0%, 93%, 97%, 100% { opacity: 0; }
    94%                { opacity: 0.6; }
    95%                { opacity: 0.1; }
    96%                { opacity: 0.8; }
  }

  /* ── Météo Cinématique : Neige ── */
  .snow-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 5;
    color: rgba(255, 255, 255, 0.7);
  }

  .snowflake {
    position: absolute;
    top: -30px;
    font-size: 16px;
    animation: snowFall 8s linear infinite;
  }
  .s1 { left: 15%; animation-duration: 7s; }
  .s2 { left: 35%; animation-duration: 9s; animation-delay: 2s; font-size: 20px; }
  .s3 { left: 55%; animation-duration: 6.5s; animation-delay: 1s; }
  .s4 { left: 75%; animation-duration: 10s; animation-delay: 3s; font-size: 14px; }
  .s5 { left: 90%; animation-duration: 8.5s; animation-delay: 0.5s; }

  @keyframes snowFall {
    0%   { transform: translateY(-30px) translateX(0); opacity: 0; }
    20%  { opacity: 0.8; }
    80%  { opacity: 0.7; }
    100% { transform: translateY(110vh) translateX(40px); opacity: 0.2; }
  }

  /* ── Météo Cinématique : Braises ── */
  .cinder-particles {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 5;
  }
  .cinder {
    position: absolute;
    bottom: -10px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #ffaa44;
    box-shadow: 0 0 8px #ff4400;
    opacity: 0.8;
    animation: riseUp 6s infinite linear;
  }
  .c1 { left: 20%; animation-duration: 5s; animation-delay: 0.5s; }
  .c2 { left: 45%; animation-duration: 7s; animation-delay: 2s; width: 6px; height: 6px; }
  .c3 { left: 65%; animation-duration: 4.5s; animation-delay: 1.2s; }
  .c4 { left: 80%; animation-duration: 6.5s; animation-delay: 3s; }
  .c5 { left: 35%; animation-duration: 8s; animation-delay: 0.2s; }

  @keyframes riseUp {
    0%   { transform: translateY(0) scale(1); opacity: 0; }
    20%  { opacity: 0.9; }
    80%  { opacity: 0.6; }
    100% { transform: translateY(-100vh) scale(0.2); opacity: 0; }
  }

  /* ── Thèmes Visuels ── */
  .theme-parchment { color: #2b1d0c; }
  .theme-parchment .artwork-layer { filter: sepia(0.5) brightness(0.7) contrast(1.1); }
  .theme-parchment .ambient-backdrop { background: radial-gradient(ellipse at center, rgba(235, 214, 169, 0.25) 0%, rgba(20, 14, 8, 0.85) 100%); }
  .theme-parchment .intro-main-title { color: #ffd88a; text-shadow: 0 4px 15px rgba(0,0,0,0.95), 0 0 30px rgba(229,168,83,0.4); }
  .theme-parchment .narration-card { background: rgba(22, 16, 10, 0.82); border: 1px solid rgba(229, 168, 83, 0.35); }

  .theme-cinders .ambient-backdrop { background: radial-gradient(circle at bottom center, rgba(160, 40, 10, 0.3) 0%, rgba(10, 6, 8, 0.85) 80%); }
  .theme-cinders .intro-main-title { color: #ffb169; text-shadow: 0 0 25px rgba(255, 77, 0, 0.6), 0 4px 20px rgba(0,0,0,0.9); }

  .theme-starry .stars-glimmer {
    position: absolute;
    inset: 0;
    background-image: 
      radial-gradient(1px 1px at 25px 35px, #fff, rgba(0,0,0,0)),
      radial-gradient(1.5px 1.5px at 85px 120px, #a8c0ff, rgba(0,0,0,0)),
      radial-gradient(1px 1px at 160px 70px, #ffd88a, rgba(0,0,0,0)),
      radial-gradient(2px 2px at 240px 190px, #fff, rgba(0,0,0,0));
    background-repeat: repeat;
    background-size: 300px 300px;
    opacity: 0.55;
    animation: twinkle 8s infinite ease-in-out alternate;
  }
  @keyframes twinkle {
    0% { opacity: 0.35; transform: scale(1); }
    100% { opacity: 0.65; transform: scale(1.02); }
  }

  /* ── Contenu centré ── */
  .intro-content-container {
    position: relative;
    z-index: 10;
    max-width: 950px;
    width: 90%;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px;
  }

  .top-ornament {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-bottom: 12px;
    opacity: 0.8;
  }

  .ornament-line {
    width: 60px;
    height: 1px;
    background: linear-gradient(to right, transparent, rgba(229,168,83,0.8));
  }
  .ornament-line.right {
    background: linear-gradient(to left, transparent, rgba(229,168,83,0.8));
  }
  .ornament-gem {
    color: #e5a853;
    font-size: 14px;
    text-shadow: 0 0 10px #e5a853;
  }

  .intro-subtitle-badge {
    text-transform: uppercase;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 5px;
    color: #e5a853;
    background: rgba(0, 0, 0, 0.55);
    padding: 5px 16px;
    border-radius: 20px;
    border: 1px solid rgba(229, 168, 83, 0.3);
    margin-bottom: 16px;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
  }

  .intro-main-title {
    font-family: 'Cinzel', 'Georgia', serif;
    font-size: clamp(30px, 5vw, 60px);
    font-weight: 700;
    letter-spacing: 3px;
    color: #f7e1b5;
    margin: 0 0 14px 0;
    text-shadow: 0 4px 25px rgba(0, 0, 0, 0.95), 0 0 35px rgba(229, 168, 83, 0.4);
    line-height: 1.2;
    text-transform: uppercase;
  }

  .gold-divider {
    width: 140px;
    height: 2px;
    background: linear-gradient(90deg, transparent, #e5a853, transparent);
    margin-bottom: 20px;
    box-shadow: 0 0 10px rgba(229,168,83,0.5);
  }

  /* ── Mode Défilement 3D (Crawl) ── */
  .crawl-perspective-viewport {
    perspective: 320px;
    perspective-origin: 50% 100%;
    width: 100%;
    height: 200px;
    overflow: hidden;
    margin-bottom: 20px;
    mask-image: linear-gradient(to bottom, transparent 0%, black 25%, black 85%, transparent 100%);
    -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 25%, black 85%, transparent 100%);
  }

  .crawl-plane {
    transform-origin: 50% 100%;
    transform: rotateX(24deg);
    animation: crawlMotion 30s linear infinite;
  }

  @keyframes crawlMotion {
    0%   { transform: rotateX(24deg) translateY(180px); }
    100% { transform: rotateX(24deg) translateY(-220px); }
  }

  .crawl-header {
    font-family: 'Cinzel', serif;
    font-size: 22px;
    color: #ffd88a;
    letter-spacing: 4px;
    margin-bottom: 12px;
    text-shadow: 0 2px 10px rgba(0,0,0,0.9);
  }

  .crawl-paragraph {
    font-family: 'Georgia', serif;
    font-size: 19px;
    font-style: italic;
    line-height: 1.7;
    color: #f1f3f5;
    max-width: 700px;
    margin: 0 auto;
    text-shadow: 0 2px 8px rgba(0,0,0,0.95);
  }

  /* ── Mode Carte de narration classique ── */
  .narration-card {
    background: rgba(10, 12, 18, 0.78);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(229, 168, 83, 0.25);
    border-radius: 8px;
    padding: 18px 30px;
    max-width: 820px;
    box-shadow: 0 15px 45px rgba(0, 0, 0, 0.85);
    margin-bottom: 20px;
  }

  .narration-text {
    font-family: 'Georgia', serif;
    font-size: clamp(16px, 1.8vw, 21px);
    font-style: italic;
    line-height: 1.65;
    color: #e9ecef;
    margin: 0;
    text-shadow: 0 2px 8px rgba(0,0,0,0.9);
  }

  /* ── Casting des Héros ── */
  .heroes-cast-section {
    margin-bottom: 18px;
    width: 100%;
    max-width: 860px;
    animation: fadeIn 1s ease;
  }

  .cast-label-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .cast-line {
    width: 40px;
    height: 1px;
    background: rgba(229, 168, 83, 0.4);
  }

  .cast-title {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 2px;
    color: rgba(229, 168, 83, 0.85);
  }

  .heroes-avatar-grid {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  .hero-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(229, 168, 83, 0.3);
    border-radius: 24px;
    padding: 4px 12px 4px 5px;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 14px rgba(0,0,0,0.5);
  }

  .hero-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    border: 1.5px solid #e5a853;
  }

  .hero-avatar-fallback {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(229, 168, 83, 0.2);
    border: 1.5px solid #e5a853;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
  }

  .hero-meta {
    display: flex;
    flex-direction: column;
    text-align: left;
  }

  .hero-name {
    font-size: 12px;
    font-weight: 700;
    color: #fff;
  }

  .hero-role {
    font-size: 10px;
    color: #e5a853;
    opacity: 0.85;
  }

  /* ── Footer discret ── */
  .intro-footer-cue {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(229, 168, 83, 0.8);
    opacity: 0.9;
  }

  .pulse-note {
    display: inline-block;
    animation: gentlePulse 2s infinite ease-in-out;
  }

  @keyframes gentlePulse {
    0%, 100% { transform: scale(1); opacity: 0.7; }
    50%      { transform: scale(1.2); opacity: 1; }
  }

  .btn-close-preview {
    margin-top: 18px;
    background: rgba(255, 60, 60, 0.25);
    border: 1px solid rgba(255, 60, 60, 0.6);
    color: #ff9999;
    padding: 8px 18px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s;
  }
  .btn-close-preview:hover {
    background: rgba(255, 60, 60, 0.45);
    color: #fff;
    transform: translateY(-1px);
  }

  @keyframes introFadeIn {
    0%   { opacity: 0; transform: scale(1.03); }
    100% { opacity: 1; transform: scale(1); }
  }
</style>
