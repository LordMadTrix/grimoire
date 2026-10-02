<script lang="ts">
  import { LUNAR_PHASES, CONSTELLATIONS, type LunarPhase, type Constellation } from '$lib/herboriste/data/astralData';

  let currentPhaseIndex = $state<number>(4); // Default to Full Moon (Pleine Lune)
  let currentDay = $state<number>(14);
  let currentMonth = $state<string>('Mois des Bourgeons (Printemps)');
  let currentYear = $state<number>(1422);

  const MONTHS = [
    'Mois des Frimas (Hiver)',
    'Mois de la Fonte (Fin d\'Hiver)',
    'Mois des Bourgeons (Printemps)',
    'Mois de la Sève (Printemps)',
    'Mois du Soleil Ardent (Été)',
    'Mois des Moissons (Été)',
    'Mois des Brumes (Automne)',
    'Mois des Feuilles Mortes (Automne)'
  ];

  let currentPhase = $derived(LUNAR_PHASES[currentPhaseIndex]);
  let activeConstellation = $derived<Constellation>(
    CONSTELLATIONS[Math.floor(currentPhaseIndex / 2) % CONSTELLATIONS.length]
  );

  let celestialEvent = $state<string | null>(null);

  function advanceDay(days: number = 1) {
    currentDay += days;
    if (currentDay > 28) {
      currentDay = 1;
      const mIdx = (MONTHS.indexOf(currentMonth) + 1) % MONTHS.length;
      currentMonth = MONTHS[mIdx];
      if (mIdx === 0) currentYear++;
    }
    // Phase shifts every ~3.5 days in a 28-day cycle
    currentPhaseIndex = Math.floor((currentDay - 1) / 3.5) % LUNAR_PHASES.length;
    celestialEvent = null;
  }

  function triggerStargaze() {
    const EVENTS = [
      '✨ Pluie d\'Étoiles Filantes : Tout gemmologue récolte un éclat stellaire bonus au prochain concassage.',
      '🌌 Aurore Boréale Nacrée : Les fleurs de glace et mousses boréales voient leur prix de revente doubler.',
      '🌑 Brume d\'Éclipse Rampante : Les morts-vivants s\'agitent ; les racines de belladone suintent un nectar d\'ombre.',
      '☄️ Aérolithe Échoué : Une météorite de fer céleste s\'est écrasée à 2 lieues de la tour d\'observation.',
      '🕊️ Alignement Bienveillant : Le prochain jet de brassage d\'antidote est garanti réussi.'
    ];
    celestialEvent = EVENTS[Math.floor(Math.random() * EVENTS.length)];
  }
</script>

<div class="calendar-container">
  <!-- Banner -->
  <div class="banner">
    <div class="banner-title-row">
      <span class="banner-icon">🌙</span>
      <div>
        <h2 class="banner-title">Almanach Astral & Marées Telluriques de Fangh</h2>
        <p class="banner-subtitle">
          Observez les phases lunaires et constellations régissant les floraisons mystiques et la résonance des filons minéraux.
        </p>
      </div>
    </div>
  </div>

  <div class="astral-grid">
    <!-- Left Column: Celestial Dial & Date Stepper -->
    <div class="dial-card">
      <div class="date-header">
        <span class="date-badge">Jour {currentDay} / 28</span>
        <h3 class="date-title">{currentMonth} · An {currentYear}</h3>
      </div>

      <!-- Lunar Visual Representation -->
      <div class="moon-stage">
        <div class="moon-halo"></div>
        <div class="moon-disc" style:--illu="{currentPhase.illumination}%">
          <div class="moon-crater c1"></div>
          <div class="moon-crater c2"></div>
          <div class="moon-crater c3"></div>
          <span class="moon-emoji">{currentPhase.icon}</span>
        </div>
      </div>

      <div class="phase-info">
        <h4 class="phase-name">{currentPhase.name}</h4>
        <div class="phase-illumination">Illumination Céleste : {currentPhase.illumination}%</div>
        <p class="phase-desc">{currentPhase.description}</p>
      </div>

      <!-- Time Stepper Buttons -->
      <div class="stepper-actions">
        <button type="button" class="btn-step" onclick={() => advanceDay(1)}>
          <span>⏳</span> +1 Jour
        </button>
        <button type="button" class="btn-step" onclick={() => advanceDay(3)}>
          <span>🌓</span> +3 Jours (Phase)
        </button>
        <button type="button" class="btn-step highlight" onclick={() => advanceDay(7)}>
          <span>🌕</span> +1 Semaine
        </button>
      </div>

      <!-- Quick Phase Selector -->
      <div class="phase-pills">
        {#each LUNAR_PHASES as p, idx (p.id)}
          <button
            type="button"
            class="phase-pill"
            class:active={currentPhaseIndex === idx}
            onclick={() => (currentPhaseIndex = idx)}
            title={p.name}
          >
            <span>{p.icon}</span>
          </button>
        {/each}
      </div>
    </div>

    <!-- Right Column: Current Influences & Active Constellation -->
    <div class="influences-card">
      <div class="card-sec-head">
        <span>Influences Telluriques en Cours</span>
        <button type="button" class="btn-stargaze" onclick={triggerStargaze}>
          🔭 Scruter le Ciel
        </button>
      </div>

      {#if celestialEvent}
        <div class="event-banner">
          {celestialEvent}
        </div>
      {/if}

      <div class="influence-boxes">
        <!-- Botanical Influence -->
        <div class="inf-box bot">
          <div class="inf-head">
            <span class="inf-ico">🌿</span>
            <span class="inf-label">Marée Botanique & Sève</span>
          </div>
          <p class="inf-text">{currentPhase.botanicalImpact}</p>
        </div>

        <!-- Geological Influence -->
        <div class="inf-box geo">
          <div class="inf-head">
            <span class="inf-ico">💎</span>
            <span class="inf-label">Résonance Cristalline & Mohs</span>
          </div>
          <p class="inf-text">{currentPhase.geologicalImpact}</p>
        </div>

        <!-- Biomes Favorisés -->
        <div class="inf-box bio">
          <div class="inf-head">
            <span class="inf-ico">🧭</span>
            <span class="inf-label">Biotopes et Terroirs Favorisés</span>
          </div>
          <div class="bio-tags">
            {#each currentPhase.favoredBiomes as bio}
              <span class="bio-pill">{bio}</span>
            {/each}
          </div>
        </div>
      </div>

      <!-- Active Constellation Section -->
      <div class="constellation-box">
        <div class="const-head">
          <div class="const-symbol">{activeConstellation.symbol}</div>
          <div>
            <div class="const-season">Constellation Saisonnière · {activeConstellation.season}</div>
            <h4 class="const-name">{activeConstellation.name}</h4>
          </div>
        </div>
        <p class="const-lore">{activeConstellation.lore}</p>
        <div class="const-bonus">
          <span>✨ Bonus Passif :</span> <strong>{activeConstellation.passiveBonus}</strong>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .calendar-container {
    max-width: 82rem;
    margin: 0 auto;
    padding: 1.5rem;
    color: #f7eed7;
    font-family: Georgia, 'Times New Roman', serif;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .banner {
    background: #141724;
    border: 2px solid #3b82f6;
    border-radius: 0.75rem;
    padding: 1.25rem 1.5rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  }
  .banner-title-row {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .banner-icon { font-size: 2.2rem; }
  .banner-title {
    margin: 0;
    font-size: 1.4rem;
    color: #93c5fd;
    font-weight: bold;
    letter-spacing: 0.03em;
  }
  .banner-subtitle {
    margin: 0.35rem 0 0 0;
    font-size: 0.85rem;
    color: #bfdbfe;
    line-height: 1.4;
  }

  .astral-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  @media (min-width: 900px) {
    .astral-grid { grid-template-columns: 1fr 1.3fr; }
  }

  .dial-card, .influences-card {
    background: #191c2b;
    border: 1px solid #313854;
    border-radius: 0.75rem;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
  }

  .date-header { text-align: center; }
  .date-badge {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #93c5fd;
    font-weight: bold;
  }
  .date-title {
    margin: 0.25rem 0 0 0;
    font-size: 1.15rem;
    color: #fef08a;
  }

  /* Moon Visual */
  .moon-stage {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    padding: 1.5rem 0;
  }
  .moon-halo {
    position: absolute;
    width: 130px;
    height: 130px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(147, 197, 253, 0.3) 0%, rgba(147, 197, 253, 0) 70%);
  }
  .moon-disc {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: #e2e8f0;
    position: relative;
    box-shadow: 0 0 25px rgba(226, 232, 240, 0.4), inset -8px -8px 16px rgba(15, 23, 42, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .moon-emoji {
    font-size: 3rem;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.8));
  }

  .phase-info {
    text-align: center;
  }
  .phase-name {
    margin: 0;
    font-size: 1.1rem;
    color: #93c5fd;
  }
  .phase-illumination {
    font-size: 0.75rem;
    color: #cbd5e1;
    margin: 0.2rem 0 0.5rem 0;
  }
  .phase-desc {
    font-size: 0.8rem;
    color: #94a3b8;
    line-height: 1.4;
    margin: 0;
  }

  .stepper-actions {
    display: flex;
    gap: 0.5rem;
  }
  .btn-step {
    flex: 1;
    padding: 0.5rem;
    background: #242b42;
    color: #e2e8f0;
    border: 1px solid #3e4a73;
    border-radius: 0.4rem;
    font-size: 0.8rem;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .btn-step:hover { background: #333d5e; border-color: #60a5fa; }
  .btn-step.highlight {
    background: #1e3a8a;
    border-color: #3b82f6;
    color: #bfdbfe;
    font-weight: bold;
  }

  .phase-pills {
    display: flex;
    justify-content: center;
    gap: 0.35rem;
  }
  .phase-pill {
    background: #141724;
    border: 1px solid #2a314d;
    border-radius: 0.35rem;
    padding: 0.35rem 0.5rem;
    font-size: 1.1rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .phase-pill:hover { background: #2b3452; }
  .phase-pill.active {
    background: #1e3a8a;
    border-color: #60a5fa;
    box-shadow: 0 0 8px rgba(96, 165, 250, 0.4);
  }

  /* Right Panel */
  .card-sec-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #93c5fd;
  }
  .btn-stargaze {
    background: #232c45;
    color: #fef08a;
    border: 1px solid #455584;
    border-radius: 0.35rem;
    padding: 0.35rem 0.65rem;
    font-size: 0.75rem;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .btn-stargaze:hover { background: #37466d; border-color: #fef08a; }

  .event-banner {
    background: #172554;
    border-left: 4px solid #60a5fa;
    border-radius: 0.35rem;
    padding: 0.65rem 0.85rem;
    font-size: 0.8rem;
    color: #e0f2fe;
    line-height: 1.4;
  }

  .influence-boxes {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .inf-box {
    background: #141724;
    border: 1px solid #28304c;
    border-radius: 0.45rem;
    padding: 0.75rem 0.9rem;
  }
  .inf-box.bot { border-left: 3px solid #22c55e; }
  .inf-box.geo { border-left: 3px solid #38bdf8; }
  .inf-box.bio { border-left: 3px solid #eab308; }

  .inf-head {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin-bottom: 0.35rem;
  }
  .inf-ico { font-size: 1rem; }
  .inf-label {
    font-size: 0.78rem;
    font-weight: bold;
    color: #e2e8f0;
  }
  .inf-text {
    margin: 0;
    font-size: 0.78rem;
    color: #cbd5e1;
    line-height: 1.35;
  }
  .bio-tags {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .bio-pill {
    font-size: 0.72rem;
    background: #232c45;
    border: 1px solid #3e4d78;
    border-radius: 0.25rem;
    padding: 0.15rem 0.5rem;
    color: #fde047;
  }

  /* Constellation Box */
  .constellation-box {
    background: #10131f;
    border: 1px solid #28304c;
    border-radius: 0.5rem;
    padding: 0.85rem;
    margin-top: 0.5rem;
  }
  .const-head {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.4rem;
  }
  .const-symbol {
    font-size: 1.8rem;
    width: 44px;
    height: 44px;
    background: #1c2237;
    border-radius: 0.4rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .const-season {
    font-size: 0.7rem;
    text-transform: uppercase;
    color: #60a5fa;
  }
  .const-name {
    margin: 0;
    font-size: 0.95rem;
    color: #fef08a;
  }
  .const-lore {
    margin: 0 0 0.5rem 0;
    font-size: 0.75rem;
    color: #94a3b8;
    line-height: 1.35;
    font-style: italic;
  }
  .const-bonus {
    font-size: 0.78rem;
    color: #67e8f9;
  }
</style>
