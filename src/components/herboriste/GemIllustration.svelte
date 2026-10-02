<script lang="ts">
  import type { Gem } from '$lib/herboriste/types/gem';

  let {
    gem,
    size = 'md',
    showPlateDetails = true,
    class: className = '',
  }: {
    gem: Gem;
    size?: 'sm' | 'md' | 'lg' | 'print';
    showPlateDetails?: boolean;
    class?: string;
  } = $props();

  const color = $derived(gem.color);
  const accent = $derived(gem.accentColor);
</script>

<div class="gem-plate {size} {className}">
  <!-- Corner brackets -->
  <div class="corner top-left"></div>
  <div class="corner top-right"></div>
  <div class="corner bottom-left"></div>
  <div class="corner bottom-right"></div>

  <!-- Header plate label -->
  {#if showPlateDetails && size !== 'sm'}
    <div class="plate-header">
      <span>Lapidaire</span>
      <span class="mono">{gem.weightGoltors} UG</span>
    </div>
  {/if}

  <!-- SVG Gem Art -->
  <svg
    viewBox="0 0 200 220"
    class="gem-svg"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <!-- Alexandrite dual tone -->
      <linearGradient id="alex-grad-{gem.id}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#047857" />
        <stop offset="45%" stop-color="#0f766e" />
        <stop offset="65%" stop-color="#991b1b" />
        <stop offset="100%" stop-color="#b91c1c" />
      </linearGradient>

      <!-- Larimar sea water gradient -->
      <linearGradient id="larimar-grad-{gem.id}" x1="20%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stop-color="#7dd3fc" />
        <stop offset="40%" stop-color="#0284c7" />
        <stop offset="80%" stop-color="#0369a1" />
        <stop offset="100%" stop-color="#e0f2fe" />
      </linearGradient>

      <!-- Fire flame gradient for Larme de Phenix -->
      <radialGradient id="fire-grad-{gem.id}" cx="50%" cy="60%" r="50%">
        <stop offset="0%" stop-color="#fef08a" />
        <stop offset="40%" stop-color="#f97316" />
        <stop offset="85%" stop-color="#dc2626" />
        <stop offset="100%" stop-color="#7f1d1d" />
      </radialGradient>
    </defs>

    <!-- Glow halo -->
    <circle
      cx="100"
      cy="110"
      r={gem.id === 'apatite' || gem.id === 'pierre_ame' ? 68 : 55}
      fill={gem.id === 'alexandrite' ? '#b91c1c' : accent}
      opacity={gem.id === 'apatite' ? '0.45' : '0.22'}
      filter="blur(8px)"
    />

    {#if gem.cutType === 'emeraude' || gem.cutType === 'baguette'}
      <g>
        <!-- Emerald / Baguette octagon cut -->
        <polygon
          points="60,40 140,40 170,70 170,150 140,180 60,180 30,150 30,70"
          fill={color}
          stroke="#1c1917"
          stroke-width="2"
        />
        <!-- Table (inner rectangle with cut corners) -->
        <polygon
          points="75,65 125,65 145,85 145,135 125,155 75,155 55,135 55,85"
          fill={accent}
          opacity="0.75"
          stroke="#1c1917"
          stroke-width="1.5"
        />
        <!-- Step facets -->
        <line x1="60" y1="40" x2="75" y2="65" stroke="#ffffff" stroke-width="1" opacity="0.6" />
        <line x1="140" y1="40" x2="125" y2="65" stroke="#ffffff" stroke-width="1" opacity="0.6" />
        <line x1="170" y1="70" x2="145" y2="85" stroke="#ffffff" stroke-width="1" opacity="0.6" />
        <line x1="170" y1="150" x2="145" y2="135" stroke="#ffffff" stroke-width="1" opacity="0.6" />
        <line x1="140" y1="180" x2="125" y2="155" stroke="#ffffff" stroke-width="1" opacity="0.6" />
        <line x1="60" y1="180" x2="75" y2="155" stroke="#ffffff" stroke-width="1" opacity="0.6" />
        <line x1="30" y1="150" x2="55" y2="135" stroke="#ffffff" stroke-width="1" opacity="0.6" />
        <line x1="30" y1="70" x2="55" y2="85" stroke="#ffffff" stroke-width="1" opacity="0.6" />
        <!-- Specular glare -->
        <polygon points="75,65 110,65 125,80 90,80" fill="#ffffff" opacity="0.45" />
      </g>
    {:else if gem.cutType === 'coussin'}
      <g>
        <!-- Cushion square with rounded sides -->
        <path
          d="M 60 40 Q 100 35 140 40 Q 165 60 165 100 Q 165 140 140 160 Q 100 165 60 160 Q 35 140 35 100 Q 35 60 60 40 Z"
          fill={gem.id === 'alexandrite' ? `url(#alex-grad-${gem.id})` : color}
          stroke="#1c1917"
          stroke-width="2"
        />
        <!-- Center table -->
        <path
          d="M 75 60 Q 100 56 125 60 Q 140 75 140 100 Q 140 125 125 140 Q 100 144 75 140 Q 60 125 60 100 Q 60 75 75 60 Z"
          fill={accent}
          opacity="0.8"
          stroke="#1c1917"
          stroke-width="1.2"
        />
        <!-- Corner diagonal facets -->
        <line x1="60" y1="40" x2="75" y2="60" stroke="#ffffff" stroke-width="1.2" opacity="0.7" />
        <line x1="140" y1="40" x2="125" y2="60" stroke="#ffffff" stroke-width="1.2" opacity="0.7" />
        <line x1="140" y1="160" x2="125" y2="140" stroke="#ffffff" stroke-width="1.2" opacity="0.7" />
        <line x1="60" y1="160" x2="75" y2="140" stroke="#ffffff" stroke-width="1.2" opacity="0.7" />
        <!-- Inner kite facets -->
        <polygon points="100,56 115,80 100,100 85,80" fill="#ffffff" opacity="0.35" />
      </g>
    {:else if gem.cutType === 'cabochon'}
      <g>
        <!-- Smooth domed cabochon -->
        <ellipse
          cx="100"
          cy="110"
          rx="65"
          ry="50"
          fill={gem.id === 'larimar' ? `url(#larimar-grad-${gem.id})` : color}
          stroke="#1c1917"
          stroke-width="2"
        />
        <!-- Color depth gradient -->
        <ellipse cx="95" cy="105" rx="52" ry="38" fill={accent} opacity="0.4" />

        <!-- Silky adularescence or chatoyancy stripe if moonstone -->
        {#if gem.id === 'pierre_de_lune'}
          <path
            d="M 65 80 Q 95 110 135 140"
            stroke="#ffffff"
            stroke-width="16"
            stroke-linecap="round"
            opacity="0.6"
            filter="blur(3px)"
          />
        {/if}

        <!-- Eye of the tiger golden slit -->
        {#if gem.id === 'oeil_de_tigre'}
          <g>
            <path
              d="M 60 70 Q 100 110 140 150"
              stroke="#fbbf24"
              stroke-width="14"
              stroke-linecap="round"
              opacity="0.75"
              filter="blur(2px)"
            />
            <path
              d="M 70 65 Q 100 110 130 155"
              stroke="#fef08a"
              stroke-width="4"
              stroke-linecap="round"
              opacity="0.9"
            />
          </g>
        {/if}

        <!-- Lapis lazuli pyrite gold flecks -->
        {#if gem.id === 'lapis_lazuli'}
          <g fill="#fde047">
            <circle cx="85" cy="95" r="2.5" />
            <circle cx="115" cy="105" r="1.8" />
            <circle cx="75" cy="120" r="2" />
            <circle cx="125" cy="85" r="1.5" />
            <circle cx="100" cy="130" r="2.2" />
          </g>
        {/if}

        <!-- Malachite concentric bands -->
        {#if gem.id === 'malachite'}
          <g fill="none" stroke="#064e3b" stroke-width="3" opacity="0.7">
            <ellipse cx="95" cy="110" rx="40" ry="28" />
            <ellipse cx="95" cy="110" rx="25" ry="16" />
            <ellipse cx="95" cy="110" rx="10" ry="6" />
          </g>
        {/if}

        <!-- Larimar sea foam marbling -->
        {#if gem.id === 'larimar'}
          <g fill="none" stroke="#f0fdf4" stroke-width="2" opacity="0.65" stroke-linecap="round">
            <path d="M 65 95 Q 85 85 110 95 Q 135 105 145 95" />
            <path d="M 60 120 Q 90 130 120 115 Q 140 125 150 115" />
            <path d="M 80 105 Q 100 115 125 105" stroke-width="3" opacity="0.8" />
          </g>
        {/if}

        <!-- Glossy specular crescent highlight -->
        <path
          d="M 65 85 C 80 70 120 70 135 85 C 120 80 80 80 65 85 Z"
          fill="#ffffff"
          opacity="0.75"
        />
      </g>
    {:else if gem.cutType === 'goutte'}
      <g>
        <!-- Pear / Tear droplet cut -->
        <path
          d="M 100 35 C 125 80 160 115 160 145 C 160 178 133 195 100 195 C 67 195 40 178 40 145 C 40 115 75 80 100 35 Z"
          fill={gem.id === 'larme_phenix' ? `url(#fire-grad-${gem.id})` : color}
          stroke="#1c1917"
          stroke-width="2"
        />
        <!-- Inner facet star -->
        <polygon
          points="100,65 125,120 100,165 75,120"
          fill={accent}
          opacity="0.65"
          stroke="#ffffff"
          stroke-width="1"
        />
        <!-- Facet lines -->
        <line x1="100" y1="35" x2="100" y2="65" stroke="#ffffff" stroke-width="1.2" opacity="0.7" />
        <line x1="160" y1="145" x2="125" y2="120" stroke="#ffffff" stroke-width="1" opacity="0.6" />
        <line x1="40" y1="145" x2="75" y2="120" stroke="#ffffff" stroke-width="1" opacity="0.6" />
        <line x1="100" y1="195" x2="100" y2="165" stroke="#ffffff" stroke-width="1" opacity="0.6" />

        <!-- Phoenix flame spark inside Larme de Phenix -->
        {#if gem.id === 'larme_phenix'}
          <g transform="translate(100, 130)">
            <path
              d="M 0 15 Q -10 5 -5 -10 Q 0 -22 0 -25 Q 5 -15 10 -5 Q 12 10 0 15 Z"
              fill="#fef08a"
              opacity="0.9"
            />
            <circle cx="0" cy="0" r="4" fill="#ffffff" />
          </g>
        {/if}

        <!-- Specular glare -->
        <circle cx="85" cy="100" r="10" fill="#ffffff" opacity="0.4" />
      </g>
    {:else if gem.cutType === 'ovale'}
      <g>
        <!-- Oval brilliant facet cut -->
        <ellipse cx="100" cy="110" rx="55" ry="70" fill={color} stroke="#1c1917" stroke-width="2" />
        <!-- Table -->
        <ellipse cx="100" cy="110" rx="34" ry="46" fill={accent} opacity="0.7" stroke="#1c1917" stroke-width="1.2" />
        <!-- Radial facets -->
        <line x1="100" y1="40" x2="100" y2="64" stroke="#ffffff" stroke-width="1" opacity="0.7" />
        <line x1="100" y1="180" x2="100" y2="156" stroke="#ffffff" stroke-width="1" opacity="0.7" />
        <line x1="45" y1="110" x2="66" y2="110" stroke="#ffffff" stroke-width="1" opacity="0.7" />
        <line x1="155" y1="110" x2="134" y2="110" stroke="#ffffff" stroke-width="1" opacity="0.7" />
        <line x1="62" y1="62" x2="78" y2="76" stroke="#ffffff" stroke-width="1" opacity="0.7" />
        <line x1="138" y1="62" x2="122" y2="76" stroke="#ffffff" stroke-width="1" opacity="0.7" />
        <line x1="62" y1="158" x2="78" y2="144" stroke="#ffffff" stroke-width="1" opacity="0.7" />
        <line x1="138" y1="158" x2="122" y2="144" stroke="#ffffff" stroke-width="1" opacity="0.7" />
        <!-- Specular flash -->
        <path d="M 80 85 L 105 85 L 90 105 Z" fill="#ffffff" opacity="0.7" />
      </g>
    {:else if gem.cutType === 'marquise'}
      <g>
        <!-- Marquise pointed boat cut -->
        <path
          d="M 100 35 C 145 75 160 110 160 110 C 160 110 145 145 100 185 C 55 145 40 110 40 110 C 40 110 55 75 100 35 Z"
          fill={color}
          stroke="#1c1917"
          stroke-width="2"
        />
        <!-- Center table navette -->
        <path
          d="M 100 65 C 128 90 135 110 135 110 C 135 110 128 130 100 155 C 72 130 65 110 65 110 C 65 110 72 90 100 65 Z"
          fill={accent}
          opacity="0.75"
          stroke="#1c1917"
          stroke-width="1.2"
        />
        <!-- Facet lines -->
        <line x1="100" y1="35" x2="100" y2="65" stroke="#ffffff" stroke-width="1.2" opacity="0.75" />
        <line x1="100" y1="155" x2="100" y2="185" stroke="#ffffff" stroke-width="1.2" opacity="0.75" />
        <line x1="40" y1="110" x2="65" y2="110" stroke="#ffffff" stroke-width="1.2" opacity="0.75" />
        <line x1="135" y1="110" x2="160" y2="110" stroke="#ffffff" stroke-width="1.2" opacity="0.75" />
        <!-- Specular flash -->
        <polygon points="90,75 110,80 105,100 85,95" fill="#ffffff" opacity="0.7" />
      </g>
    {:else if gem.cutType === 'trillant'}
      <g>
        <!-- Trillant triangular facet cut -->
        <polygon
          points="100,42 165,160 35,160"
          fill={color}
          stroke="#1c1917"
          stroke-width="2"
        />
        <!-- Inner table triangle -->
        <polygon
          points="100,80 138,145 62,145"
          fill={accent}
          opacity="0.8"
          stroke="#1c1917"
          stroke-width="1.2"
        />
        <!-- Corner facets -->
        <line x1="100" y1="42" x2="100" y2="80" stroke="#ffffff" stroke-width="1.2" opacity="0.75" />
        <line x1="165" y1="160" x2="138" y2="145" stroke="#ffffff" stroke-width="1.2" opacity="0.75" />
        <line x1="35" y1="160" x2="62" y2="145" stroke="#ffffff" stroke-width="1.2" opacity="0.75" />
        <!-- Mid-edge facets -->
        <line x1="67" y1="101" x2="81" y2="112" stroke="#ffffff" stroke-width="1" opacity="0.6" />
        <line x1="133" y1="101" x2="119" y2="112" stroke="#ffffff" stroke-width="1" opacity="0.6" />
        <line x1="100" y1="160" x2="100" y2="145" stroke="#ffffff" stroke-width="1" opacity="0.6" />
        <!-- Glare -->
        <polygon points="95,85 115,95 105,110 88,100" fill="#ffffff" opacity="0.65" />
      </g>
    {:else if gem.cutType === 'brut'}
      <g>
        {#if gem.id === 'pyrite'}
          <!-- Stack of metallic golden cubes for Pyrite -->
          <g stroke="#1c1917" stroke-width="1.5">
            <!-- Back cube -->
            <polygon points="70,75 115,65 140,85 95,95" fill="#facc15" />
            <polygon points="70,75 95,95 95,140 70,120" fill="#ca8a04" />
            <polygon points="95,95 140,85 140,130 95,140" fill="#eab308" />

            <!-- Front main cube -->
            <polygon points="85,95 130,85 155,105 110,115" fill="#fef08a" />
            <polygon points="85,95 110,115 110,165 85,145" fill="#ca8a04" />
            <polygon points="110,115 155,105 155,155 110,165" fill="#eab308" />

            <!-- Small side cube -->
            <polygon points="45,110 75,100 90,115 60,125" fill="#facc15" />
            <polygon points="45,110 60,125 60,155 45,140" fill="#a16207" />
            <polygon points="60,125 90,115 90,145 60,155" fill="#ca8a04" />
          </g>
          <!-- Specular gleams -->
          <circle cx="115" cy="100" r="4" fill="#ffffff" opacity="0.9" />
          <line x1="88" y1="98" x2="108" y2="114" stroke="#ffffff" stroke-width="1.5" opacity="0.8" />
        {:else if gem.id === 'moldavite'}
          <!-- Moldavite bumpy cratered meteorite glass -->
          <path
            d="M 65 60 C 90 45 130 50 145 70 C 160 90 155 130 140 155 C 125 180 85 185 65 165 C 45 145 40 100 50 75 C 55 65 60 62 65 60 Z"
            fill="#3f6212"
            stroke="#1c1917"
            stroke-width="2"
          />
          <!-- Organic bubbled craters -->
          <ellipse cx="85" cy="85" rx="12" ry="8" fill="#1e3a8a" opacity="0.2" stroke="#4d7c0f" stroke-width="1.5" />
          <ellipse cx="120" cy="115" rx="16" ry="11" fill="#14532d" opacity="0.4" stroke="#65a30d" stroke-width="1.5" />
          <ellipse cx="80" cy="135" rx="10" ry="7" fill="#14532d" opacity="0.3" stroke="#4d7c0f" stroke-width="1.2" />
          <ellipse cx="125" cy="80" rx="9" ry="6" fill="#14532d" opacity="0.3" stroke="#65a30d" stroke-width="1.2" />
          <!-- Specular glassy rim -->
          <path
            d="M 65 60 C 90 50 130 55 145 70"
            stroke="#bef264"
            stroke-width="2"
            fill="none"
            opacity="0.75"
          />
        {:else}
          <!-- Raw crystalline cluster -->
          <g stroke="#1c1917" stroke-width="1.5">
            <!-- Center tall crystal -->
            <polygon points="100,38 120,65 116,165 84,165 80,65" fill={color} />
            <polygon points="100,38 120,65 100,80 80,65" fill={accent} opacity="0.8" />
            <line x1="100" y1="80" x2="100" y2="165" stroke="#ffffff" stroke-width="1" opacity="0.7" />

            <!-- Left side crystal -->
            <polygon points="65,70 85,90 80,165 55,160 50,100" fill={color} opacity="0.9" />
            <polygon points="65,70 85,90 70,105 50,100" fill={accent} opacity="0.75" />

            <!-- Right side crystal -->
            <polygon points="135,75 150,105 142,165 118,165 115,95" fill={color} opacity="0.9" />
            <polygon points="135,75 150,105 130,110 115,95" fill={accent} opacity="0.75" />
          </g>
          <!-- Glistening facets highlight -->
          <line x1="82" y1="68" x2="98" y2="42" stroke="#ffffff" stroke-width="1.5" opacity="0.9" />
        {/if}
      </g>
    {:else}
      <!-- brillant (default) -->
      <g>
        <!-- Brilliant round facet cut -->
        <circle cx="100" cy="110" r="60" fill={color} stroke="#1c1917" stroke-width="2" />
        <!-- Table (central octagon) -->
        <polygon
          points="82,75 118,75 138,95 138,125 118,145 82,145 62,125 62,95"
          fill={accent}
          opacity="0.75"
          stroke="#1c1917"
          stroke-width="1.2"
        />
        <!-- Star facets (triangles from table to edge) -->
        <polygon points="100,50 82,75 118,75" fill="#ffffff" opacity="0.3" stroke="#1c1917" stroke-width="0.8" />
        <polygon points="160,110 138,95 138,125" fill="#ffffff" opacity="0.25" stroke="#1c1917" stroke-width="0.8" />
        <polygon points="100,170 118,145 82,145" fill="#ffffff" opacity="0.2" stroke="#1c1917" stroke-width="0.8" />
        <polygon points="40,110 62,125 62,95" fill="#ffffff" opacity="0.35" stroke="#1c1917" stroke-width="0.8" />
        <!-- Corner kites -->
        <polygon points="142,68 118,75 138,95" fill="#ffffff" opacity="0.45" stroke="#1c1917" stroke-width="0.8" />
        <polygon points="58,68 82,75 62,95" fill="#ffffff" opacity="0.5" stroke="#1c1917" stroke-width="0.8" />
        <!-- Specular light flash -->
        <path d="M 75 80 L 100 85 L 85 105 Z" fill="#ffffff" opacity="0.8" />
      </g>
    {/if}

    <!-- Small sparkle star -->
    <g transform="translate(135, 75)">
      <path d="M 0 -8 Q 1 -1 8 0 Q 1 1 0 8 Q -1 1 -8 0 Q -1 -1 0 -8 Z" fill="#ffffff" opacity="0.9" />
    </g>
  </svg>

  <!-- Footer plate label -->
  {#if showPlateDetails && size !== 'sm'}
    <div class="plate-footer">
      <div class="plate-name">{gem.name}</div>
      <div class="plate-sub">Taille : {gem.cutType} · Mohs {gem.hardnessMohs}</div>
    </div>
  {/if}
</div>

<style>
  .gem-plate {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(196, 164, 124, 0.6);
    background-color: #fbf7ed;
    background-image: radial-gradient(#ebdcc4 1px, transparent 1px);
    background-size: 16px 16px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    user-select: none;
  }

  .gem-plate.sm { width: 5rem; height: 5rem; }
  .gem-plate.md { width: 10rem; height: 12rem; }
  .gem-plate.lg { width: 14rem; height: 16rem; }
  .gem-plate.print { width: 9rem; height: 11rem; }

  .corner {
    position: absolute;
    width: 0.625rem;
    height: 0.625rem;
    border-color: rgba(120, 53, 15, 0.6);
    border-style: solid;
  }
  .corner.top-left { top: 0.25rem; left: 0.25rem; border-width: 1px 0 0 1px; }
  .corner.top-right { top: 0.25rem; right: 0.25rem; border-width: 1px 1px 0 0; }
  .corner.bottom-left { bottom: 0.25rem; left: 0.25rem; border-width: 0 0 1px 1px; }
  .corner.bottom-right { bottom: 0.25rem; right: 0.25rem; border-width: 0 1px 1px 0; }

  .plate-header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8px;
    font-family: Georgia, 'Times New Roman', serif;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #78350f;
    border-bottom: 1px solid #e2d0b5;
    padding-bottom: 0.125rem;
    margin-bottom: 0.25rem;
  }

  .mono { font-family: ui-monospace, 'Courier New', monospace; }

  .gem-svg {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 4px 3px rgba(0, 0, 0, 0.15));
  }

  .plate-footer {
    width: 100%;
    text-align: center;
    border-top: 1px solid #e2d0b5;
    padding-top: 0.125rem;
    margin-top: 0.125rem;
  }

  .plate-name {
    font-size: 10px;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: bold;
    color: #3e2723;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .plate-sub {
    font-size: 8px;
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
    color: #78350f;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
