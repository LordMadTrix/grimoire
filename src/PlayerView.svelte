<script lang="ts">
  import MapCanvas from './components/MapCanvas.svelte';
  import AudioPlayer from './components/AudioPlayer.svelte';
  import { listen } from '@tauri-apps/api/event';
  import { onMount } from 'svelte';

  let currentMap     = $state<string | null>(null);
  let showGrid       = $state(true);
  let isBlackout     = $state(false);
  let fowShapes      = $state<any[]>([]);
  let tokens         = $state<any[]>([]);
  let pins           = $state<any[]>([]);
  let vaultPath      = $state<string>('');
  let audioSrc       = $state<string | null>(null);
  let audioVolume    = $state(0.5);
  let audio2Src      = $state<string | null>(null);
  let audio2Volume   = $state(0.4);
  let externalPing   = $state<{ x: number; y: number; seq: number } | null>(null);
  let pingSeq        = 0;
  let externalCamera = $state<{ scaleX: number; scaleY: number; x: number; y: number } | null>(null);
  let externalRoll   = $state<{ text: string; seq: number } | null>(null);
  let rollSeq        = 0;
  let drawPaths      = $state<any[]>([]);
  let handout        = $state<{ type: 'image' | 'note'; content: string; title?: string } | null>(null);
  let weather        = $state('none');
  let spells         = $state<any[]>([]);
  let campaignTitle  = $state('');
  let fowEnabled     = $state(true);
  let partyState     = $state<any[]>([]);
  let walls          = $state<any[]>([]);
  let audioZones     = $state<any[]>([]);

  // ── Canvas étoilé ────────────────────────────────────────────────
  let starfieldCanvas: HTMLCanvasElement;

  interface Star   { x: number; y: number; r: number; base: number; speed: number; phase: number }
  interface Meteor { x: number; y: number; vx: number; vy: number; life: number; maxLife: number }

  onMount(() => {
    const unlistens: (() => void)[] = [];

    listen('set_player_map',         (e: any) => { currentMap    = e.payload.url;           }).then(fn => unlistens.push(fn));
    listen('sync_vault_path',        (e: any) => { vaultPath     = e.payload.path;           }).then(fn => unlistens.push(fn));
    listen('toggle_player_grid',     (e: any) => { showGrid      = e.payload.show;           }).then(fn => unlistens.push(fn));
    listen('toggle_player_blackout', (e: any) => { isBlackout    = e.payload.active;         }).then(fn => unlistens.push(fn));
    listen('update_fow',             (e: any) => { fowShapes     = e.payload;                }).then(fn => unlistens.push(fn));
    listen('update_tokens',          (e: any) => { tokens        = e.payload;                }).then(fn => unlistens.push(fn));
    listen('update_pins',            (e: any) => { pins          = e.payload;                }).then(fn => unlistens.push(fn));
    listen('update_player_audio',    (e: any) => {
      audioSrc  = e.payload.src;    audioVolume  = e.payload.volume ?? 0.5;
      audio2Src = e.payload.src2;   audio2Volume = e.payload.volume2 ?? 0.4;
    }).then(fn => unlistens.push(fn));
    listen('player_ping',            (e: any) => { externalPing  = { x: e.payload.x, y: e.payload.y, seq: ++pingSeq }; }).then(fn => unlistens.push(fn));
    listen('show_handout',           (e: any) => { handout       = e.payload;                }).then(fn => unlistens.push(fn));
    listen('set_weather',            (e: any) => { weather       = e.payload.weather ?? 'none'; }).then(fn => unlistens.push(fn));
    listen('update_spells',          (e: any) => { spells        = e.payload ?? [];          }).then(fn => unlistens.push(fn));
    listen('sync_camera',            (e: any) => { externalCamera = e.payload;               }).then(fn => unlistens.push(fn));
    listen('map_roll',               (e: any) => { externalRoll  = { text: e.payload.text, seq: ++rollSeq }; }).then(fn => unlistens.push(fn));
    listen('update_draw_paths',      (e: any) => { drawPaths     = e.payload ?? [];          }).then(fn => unlistens.push(fn));
    listen('set_campaign_title',     (e: any) => { campaignTitle = e.payload.title ?? '';    }).then(fn => unlistens.push(fn));
    listen('toggle_fow',             (e: any) => { fowEnabled    = e.payload.enabled ?? true; }).then(fn => unlistens.push(fn));
    listen('sync_party_state',       (e: any) => { partyState    = e.payload.players ?? [];   }).then(fn => unlistens.push(fn));
    listen('update_walls',           (e: any) => { walls         = e.payload ?? [];           }).then(fn => unlistens.push(fn));
    listen('update_audio_zones',     (e: any) => { audioZones    = e.payload ?? [];           }).then(fn => unlistens.push(fn));

    // ── Starfield ────────────────────────────────────────────────
    const ctx = starfieldCanvas?.getContext('2d');
    if (!ctx) return () => { unlistens.forEach(fn => fn()); };

    const W = starfieldCanvas.width  = window.innerWidth;
    const H = starfieldCanvas.height = window.innerHeight;

    const stars: Star[] = Array.from({ length: 200 }, () => ({
      x:     Math.random() * W,
      y:     Math.random() * H,
      r:     Math.random() * 1.4 + 0.3,
      base:  Math.random() * 0.7 + 0.15,
      speed: Math.random() * 0.8 + 0.2,
      phase: Math.random() * Math.PI * 2,
    }));

    const meteors: Meteor[] = [];
    let lastMeteor = 0;
    let raf: number;

    function spawnMeteor(now: number) {
      if (now - lastMeteor < 6000 + Math.random() * 8000) return;
      lastMeteor = now;
      const angle = (Math.random() * 30 + 15) * Math.PI / 180;
      meteors.push({
        x: Math.random() * W * 0.8,
        y: Math.random() * H * 0.3,
        vx: Math.cos(angle) * 9,
        vy: Math.sin(angle) * 9,
        life: 0,
        maxLife: 55 + Math.random() * 30,
      });
    }

    function draw(ts: number) {
      ctx.clearRect(0, 0, W, H);

      // Fond dégradé
      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
      bg.addColorStop(0, '#0d1020');
      bg.addColorStop(1, '#020408');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Nébuleuse subtile
      const neb = ctx.createRadialGradient(W * 0.3, H * 0.4, 0, W * 0.3, H * 0.4, W * 0.35);
      neb.addColorStop(0, 'rgba(80,40,120,0.08)');
      neb.addColorStop(1, 'transparent');
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, W, H);

      const neb2 = ctx.createRadialGradient(W * 0.7, H * 0.6, 0, W * 0.7, H * 0.6, W * 0.3);
      neb2.addColorStop(0, 'rgba(20,60,100,0.07)');
      neb2.addColorStop(1, 'transparent');
      ctx.fillStyle = neb2;
      ctx.fillRect(0, 0, W, H);

      // Étoiles
      const t = ts / 1000;
      for (const s of stars) {
        const alpha = s.base + Math.sin(t * s.speed + s.phase) * 0.25;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,210,255,${Math.max(0, Math.min(1, alpha))})`;
        ctx.fill();
      }

      // Étoiles filantes
      spawnMeteor(ts);
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        const pct = m.life / m.maxLife;
        const alpha = pct < 0.3 ? pct / 0.3 : 1 - (pct - 0.3) / 0.7;
        const len = 80 + m.life * 2;
        const grd = ctx.createLinearGradient(m.x - m.vx * (len / 9), m.y - m.vy * (len / 9), m.x, m.y);
        grd.addColorStop(0, 'transparent');
        grd.addColorStop(1, `rgba(255,245,200,${alpha * 0.9})`);
        ctx.beginPath();
        ctx.moveTo(m.x - m.vx * (len / 9), m.y - m.vy * (len / 9));
        ctx.lineTo(m.x, m.y);
        ctx.strokeStyle = grd;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        m.x += m.vx;
        m.y += m.vy;
        m.life++;
        if (m.life >= m.maxLife || m.x > W || m.y > H) meteors.splice(i, 1);
      }

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      unlistens.forEach(fn => fn());
    };
  });

  // Coin SVG (référence top-left, transformé CSS pour les autres)
  const cornerSvg = `<svg width="90" height="90" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 88 L2 10 Q2 2 10 2 L88 2" stroke="#c9a84c" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M14 88 L14 22 Q14 14 22 14 L88 14" stroke="#c9a84c" stroke-width="1" stroke-linecap="round" opacity="0.35"/>
    <path d="M8 2 L14 8 L8 14 L2 8 Z" fill="#e5a853" opacity="0.85"/>
    <circle cx="14" cy="14" r="2.5" fill="#c9a84c" opacity="0.55"/>
    <line x1="32" y1="2" x2="32" y2="7" stroke="#c9a84c" stroke-width="1.5" opacity="0.6"/>
    <line x1="52" y1="2" x2="52" y2="5" stroke="#c9a84c" stroke-width="1" opacity="0.4"/>
    <line x1="70" y1="2" x2="70" y2="5" stroke="#c9a84c" stroke-width="1" opacity="0.25"/>
    <line x1="2" y1="32" x2="7" y2="32" stroke="#c9a84c" stroke-width="1.5" opacity="0.6"/>
    <line x1="2" y1="52" x2="5" y2="52" stroke="#c9a84c" stroke-width="1" opacity="0.4"/>
    <line x1="2" y1="70" x2="5" y2="70" stroke="#c9a84c" stroke-width="1" opacity="0.25"/>
  </svg>`;
</script>

<AudioPlayer src={audioSrc}  volume={audioVolume}  />
<AudioPlayer src={audio2Src} volume={audio2Volume} />

{#if handout}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="handout-overlay" onclick={() => handout = null}>
    <div class="handout-card" onclick={e => e.stopPropagation()}>
      {#if handout.title}
        <div class="handout-title">{handout.title}</div>
      {/if}
      {#if handout.type === 'image'}
        <img src={handout.content} alt={handout.title ?? 'Handout'} class="handout-img" />
      {:else}
        <div class="handout-text">{handout.content}</div>
      {/if}
      <button class="handout-close" onclick={() => handout = null}>✕ Fermer</button>
    </div>
  </div>
{/if}

<main class="player-view">

  <!-- ── Fond étoilé (toujours présent, visible seulement si pas de carte) ── -->
  <canvas bind:this={starfieldCanvas} class="starfield" class:hidden={!!currentMap && !isBlackout}></canvas>

  {#if isBlackout}
    <div class="blackout">
      <div class="blackout-logo">
        {#if campaignTitle}<span class="blackout-title">{campaignTitle}</span>{:else}Grimoire{/if}
      </div>
    </div>

  {:else if currentMap}
    <div class="map-wrapper">
      <MapCanvas
        mapUrl={currentMap}
        gridEnabled={showGrid}
        fowShapes={fowShapes}
        fowEnabled={fowEnabled}
        tokens={tokens}
        pins={pins}
        spells={spells}
        weather={weather}
        vaultPath={vaultPath}
        isGM={false}
        externalPing={externalPing}
        externalCamera={externalCamera}
        externalRoll={externalRoll}
        drawPaths={drawPaths}
        walls={walls}
        audioZones={audioZones}
      />

      <!-- Vignette torche pulsante -->
      <div class="vignette"></div>

      <!-- Scan-lines -->
      <div class="scanlines"></div>

      <!-- Coins ornementés -->
      <div class="corner corner-tl">{@html cornerSvg}</div>
      <div class="corner corner-tr">{@html cornerSvg}</div>
      <div class="corner corner-bl">{@html cornerSvg}</div>
      <div class="corner corner-br">{@html cornerSvg}</div>

      <!-- Titre de campagne (petit, en haut) -->
      {#if campaignTitle}
        <div class="map-title">{campaignTitle}</div>
      {/if}
    </div>

  {:else}
    <!-- État d'attente sur fond étoilé -->
    <div class="waiting-state">
      {#if campaignTitle}
        <div class="waiting-campaign">{campaignTitle}</div>
      {/if}
      <div class="waiting-emblem">⚔️</div>
      <p class="waiting-text">En attente du Maître du Jeu…</p>
    </div>
  {/if}

  <!-- Panneau statut groupe (tokens non-ennemis avec HP/conditions) -->
  {#if currentMap && !isBlackout}
    {@const partyTokens = tokens.filter((t: any) => !t.isEnemy && t.visible !== false && t.maxHp && t.maxHp > 0)}
    {#if partyTokens.length > 0}
      <div class="party-status">
        {#each partyTokens as t (t.id)}
          {@const hp = t.hp ?? t.maxHp}
          {@const pct = Math.max(0, Math.min(1, hp / t.maxHp))}
          <div class="party-member">
            <span class="party-name">{t.name}</span>
            <div class="party-hpbar-wrap">
              <div class="party-hpbar" style="width:{(pct*100).toFixed(1)}%;background:{pct>0.5?'#22c55e':pct>0.2?'#eab308':'#ef4444'}"></div>
            </div>
            <span class="party-hp">{hp}/{t.maxHp}</span>
            {#if t.conditions?.length}
              <span class="party-conds">{(t.conditions as string[]).map((c: string) =>
                ({poisoned:'🤢',stunned:'⚡',bleeding:'🩸',burning:'🔥',frozen:'❄️',
                  frightened:'😱',charmed:'💫',invisible:'👻',prone:'⬇️',
                  silenced:'🔇',blinded:'🙈',dead:'💀'} as Record<string,string>)[c]??''
              ).join('')}</span>
            {/if}
            {#if t.concentrating}
              <span class="party-conc" title="Concentration">🔮</span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  <!-- Liste légère des joueurs (Mobile Sync) -->
  {#if partyState.length > 0 && !isBlackout}
    <div class="remote-party">
      {#each partyState as p (p.id)}
        <div class="remote-member" class:active-turn={p.active_turn}>
          <div class="remote-info">
            <span class="remote-name">{p.name}</span>
            <div class="remote-hp-bar">
              <div class="remote-hp-fill" style="width: {Math.min(100, (p.hp / (p.maxhp || 1)) * 100)}%; background: {p.hp/p.maxhp > 0.5 ? '#22c55e' : p.hp/p.maxhp > 0.25 ? '#eab308' : '#ef4444'}"></div>
            </div>
          </div>
          {#if p.conditions?.length > 0}
            <div class="remote-conds">
              {#each p.conditions as c}
                <span class="remote-cond" title={c}>
                  {({sanglant:'🩸',etourdi:'💫',fatigue:'😴',prone:'⬇️',effraye:'😱'} as Record<string,string>)[c.toLowerCase()] || '❓'}
                </span>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

</main>

<style>
  :global(body) { margin: 0; padding: 0; background: #000; overflow: hidden; }

  .player-view {
    width: 100vw;
    height: 100vh;
    background: #000;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: none;
    overflow: hidden;
  }

  /* ── Fond étoilé ─────────────────────────────────────────────── */
  .starfield {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    transition: opacity 0.8s ease;
  }
  .starfield.hidden { opacity: 0; pointer-events: none; }

  /* ── Wrapper carte ────────────────────────────────────────────── */
  .map-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    z-index: 2;
  }

  /* ── Vignette torche pulsante ─────────────────────────────────── */
  .vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 50% 50%,
      transparent 38%,
      rgba(0,0,0,0.35) 65%,
      rgba(0,0,0,0.72) 100%
    );
    pointer-events: none;
    z-index: 10;
    animation: torch 4.5s ease-in-out infinite;
  }

  @keyframes torch {
    0%   { opacity: 1.0; transform: scale(1.000); }
    20%  { opacity: 0.91; transform: scale(1.008); }
    45%  { opacity: 0.96; transform: scale(0.996); }
    65%  { opacity: 0.87; transform: scale(1.012); }
    80%  { opacity: 0.94; transform: scale(0.998); }
    100% { opacity: 1.0; transform: scale(1.000); }
  }

  /* ── Scan-lines ───────────────────────────────────────────────── */
  .scanlines {
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 3px,
      rgba(0,0,0,0.045) 3px,
      rgba(0,0,0,0.045) 4px
    );
    pointer-events: none;
    z-index: 11;
  }

  /* ── Coins ornementés ─────────────────────────────────────────── */
  .corner {
    position: absolute;
    width: 90px;
    height: 90px;
    pointer-events: none;
    z-index: 12;
    opacity: 0.75;
    filter: drop-shadow(0 0 6px rgba(201,168,76,0.4));
    transition: opacity 0.3s;
  }
  .map-wrapper:hover .corner { opacity: 0.9; }

  .corner-tl { top: 0;    left: 0;    transform: none; }
  .corner-tr { top: 0;    right: 0;   transform: scaleX(-1); }
  .corner-bl { bottom: 0; left: 0;    transform: scaleY(-1); }
  .corner-br { bottom: 0; right: 0;   transform: scale(-1); }

  /* ── Titre campagne (sur carte) ───────────────────────────────── */
  .map-title {
    position: absolute;
    top: 14px;
    left: 50%;
    transform: translateX(-50%);
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 15px;
    font-weight: 400;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: rgba(201, 168, 76, 0.7);
    pointer-events: none;
    z-index: 13;
    text-shadow: 0 0 12px rgba(201,168,76,0.5), 0 2px 4px rgba(0,0,0,0.8);
    white-space: nowrap;
  }

  /* ── État d'attente ───────────────────────────────────────────── */
  .waiting-state {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 28px;
    text-align: center;
  }

  .waiting-campaign {
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 42px;
    font-weight: 400;
    letter-spacing: 8px;
    text-transform: uppercase;
    color: #c9a84c;
    text-shadow:
      0 0 30px rgba(201,168,76,0.6),
      0 0 60px rgba(201,168,76,0.25),
      0 2px 8px rgba(0,0,0,0.9);
    animation: glow-pulse 3.5s ease-in-out infinite;
  }

  @keyframes glow-pulse {
    0%, 100% { text-shadow: 0 0 30px rgba(201,168,76,0.6), 0 0 60px rgba(201,168,76,0.25), 0 2px 8px rgba(0,0,0,0.9); }
    50%       { text-shadow: 0 0 50px rgba(201,168,76,0.9), 0 0 90px rgba(201,168,76,0.4), 0 2px 8px rgba(0,0,0,0.9); }
  }

  .waiting-emblem {
    font-size: 56px;
    opacity: 0.55;
    animation: float 5s ease-in-out infinite;
    filter: drop-shadow(0 0 20px rgba(201,168,76,0.3));
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px); opacity: 0.55; }
    50%       { transform: translateY(-8px); opacity: 0.75; }
  }

  .waiting-text {
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 16px;
    font-weight: 300;
    letter-spacing: 5px;
    text-transform: uppercase;
    color: rgba(180, 160, 120, 0.5);
    margin: 0;
    animation: fade-in-out 4s ease-in-out infinite;
  }

  @keyframes fade-in-out {
    0%, 100% { opacity: 0.4; }
    50%       { opacity: 0.7; }
  }

  /* ── Blackout ─────────────────────────────────────────────────── */
  .blackout {
    position: absolute;
    inset: 0;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20;
  }

  .blackout-logo {
    font-family: 'Inter', sans-serif;
    color: rgba(255,255,255,0.03);
    font-size: 48px;
    font-weight: 900;
    letter-spacing: 10px;
  }

  .blackout-title {
    font-family: 'Georgia', serif;
    font-size: 52px;
    letter-spacing: 10px;
    color: rgba(201,168,76,0.06);
    text-transform: uppercase;
  }

  /* ── Panneau statut groupe ────────────────────────────────────── */
  .party-status {
    position: absolute;
    bottom: 14px;
    left: 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    pointer-events: none;
    z-index: 500;
  }
  .party-member {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(0,0,0,0.65);
    border: 1px solid rgba(201,168,76,0.2);
    border-radius: 6px;
    padding: 4px 8px;
    backdrop-filter: blur(4px);
  }
  .party-name {
    font-size: 12px;
    font-weight: 600;
    color: #e2e8f0;
    min-width: 70px;
    font-family: 'Georgia', serif;
  }
  .party-hpbar-wrap {
    width: 60px;
    height: 5px;
    background: rgba(255,255,255,0.12);
    border-radius: 3px;
    overflow: hidden;
  }
  .party-hpbar { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
  .party-hp    { font-size: 11px; color: #94a3b8; min-width: 36px; }
  .party-conds, .party-conc { font-size: 12px; }

  /* ── Handout overlay ──────────────────────────────────────────── */
  .handout-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.8);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .handout-card {
    background: #1a1c24;
    border: 1px solid rgba(201,168,76,0.25);
    border-radius: 12px;
    padding: 28px;
    max-width: 700px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.8), 0 0 60px rgba(201,168,76,0.05);
    animation: slideUp 0.25s ease;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .handout-title {
    font-size: 22px;
    font-weight: 700;
    color: #e5a853;
    text-align: center;
    font-family: 'Georgia', serif;
    letter-spacing: 1px;
  }

  .handout-img {
    max-width: 100%;
    max-height: 55vh;
    border-radius: 8px;
    object-fit: contain;
  }

  .handout-text {
    font-family: 'Georgia', serif;
    font-size: 15px;
    line-height: 1.8;
    color: #d4c9b0;
    white-space: pre-wrap;
    max-height: 50vh;
    overflow-y: auto;
    padding: 0 8px;
  }

  .handout-close {
    align-self: center;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 20px;
    color: rgba(255,255,255,0.5);
    padding: 6px 20px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.15s;
  }
  .handout-close:hover {
    background: rgba(255,255,255,0.08);
    color: #fff;
  }

  /* ── Liste légère des joueurs ── */
  .remote-party {
    position: absolute;
    top: 60px;
    right: 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 600;
    pointer-events: none;
  }

  .remote-member {
    background: rgba(13, 17, 23, 0.6);
    border: 1px solid rgba(229, 168, 83, 0.2);
    border-radius: 12px;
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 160px;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    animation: slideLeft 0.5s ease-out;
  }

  @keyframes slideLeft {
    from { opacity: 0; transform: translateX(20px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  .remote-member.active-turn {
    border-color: #e5a853;
    background: rgba(229, 168, 83, 0.15);
    transform: scale(1.05);
    box-shadow: 0 0 20px rgba(229, 168, 83, 0.2);
  }

  .remote-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .remote-name {
    font-size: 13px;
    font-weight: 800;
    color: white;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    font-family: 'Georgia', serif;
  }

  .remote-hp-bar {
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }

  .remote-hp-fill {
    height: 100%;
    transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .remote-conds {
    display: flex;
    gap: 4px;
    margin-top: 2px;
  }

  .remote-cond {
    font-size: 14px;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
  }
</style>
