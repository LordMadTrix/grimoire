<script lang="ts">
  import type { Plant } from '$lib/herboriste/types/herb';

  type IllustrationSize = 'sm' | 'md' | 'lg' | 'hero' | 'print';

  let {
    plant,
    size = 'md',
    showPlateDetails = true,
    class: className = '',
  }: {
    plant: Plant;
    size?: IllustrationSize;
    showPlateDetails?: boolean;
    class?: string;
  } = $props();

  const accent = $derived(plant.accentColor || '#10b981');

  const petalAngles = [0, 45, 90, 135, 180, 225, 270, 315];
  const stamenDegrees = [0, 60, 120, 180, 240, 300];
  const mysticalIds = ['fleur_de_lune', 'lotus_dor', 'athelas'];
  const gillOffsets = [-40, -30, -20, -10, 0, 10, 20, 30, 40];
  const vineLeaves = [
    { x: 62, y: 175, rot: -40 },
    { x: 92, y: 135, rot: 30 },
    { x: 80, y: 105, rot: -20 },
    { x: 130, y: 80, rot: 50 },
    { x: 105, y: 45, rot: -30 },
  ];
  const kelpBubbles = [
    { cx: 78, cy: 130, r: 5 },
    { cx: 104, cy: 95, r: 6 },
    { cx: 90, cy: 60, r: 4.5 },
    { cx: 110, cy: 150, r: 4 },
  ];
  const mossStalks = [55, 70, 85, 100, 115, 130, 145];
  const cactusNeedles = [
    { x: 74, y: 110 }, { x: 72, y: 140 }, { x: 74, y: 170 },
    { x: 100, y: 100 }, { x: 100, y: 130 }, { x: 100, y: 160 },
    { x: 126, y: 110 }, { x: 128, y: 140 }, { x: 126, y: 170 },
  ];
</script>

<div
  class="botanical-plate size-{size} {className}"
>
  <!-- Decorative antique frame corners -->
  <div class="corner corner-tl"></div>
  <div class="corner corner-tr"></div>
  <div class="corner corner-bl"></div>
  <div class="corner corner-br"></div>

  <!-- Plate Header (Ancient Botanical Treatise styling) -->
  {#if showPlateDetails && size !== 'sm'}
    <div class="plate-header">
      <span class="plate-header-title">Planche Bot.</span>
      <span class="plate-header-rarity">{plant.rarity}</span>
    </div>
  {/if}

  <!-- SVG Canvas -->
  <svg
    viewBox="0 0 200 230"
    class="plate-svg"
    xmlns="http://www.w3.org/2000/svg"
  >
    {#if plant.illustrationType === 'flower'}
      <g>
        <!-- Subtle glow background -->
        <circle cx="100" cy="85" r="45" fill={accent} opacity="0.12" filter="blur(8px)" />

        <!-- Stem -->
        <path
          d="M 100 85 Q 98 120 102 165 Q 104 185 100 205"
          stroke="#3e5339"
          stroke-width="4"
          fill="none"
          stroke-linecap="round"
        />
        <!-- Veined foliage -->
        <path
          d="M 101 135 C 75 125 60 145 55 160 C 70 162 90 152 101 143"
          fill="#4f6e4a"
          stroke="#2e422a"
          stroke-width="1.5"
        />
        <path d="M 60 155 Q 80 145 98 140" stroke="#2e422a" stroke-width="1" stroke-dasharray="1,1" />

        <path
          d="M 101 150 C 125 140 140 160 145 175 C 130 178 112 168 101 158"
          fill="#4f6e4a"
          stroke="#2e422a"
          stroke-width="1.5"
        />
        <path d="M 140 170 Q 120 160 102 155" stroke="#2e422a" stroke-width="1" stroke-dasharray="1,1" />

        <!-- Calyx -->
        <path d="M 92 88 L 100 96 L 108 88 L 100 82 Z" fill="#3e5339" stroke="#23351e" stroke-width="1" />

        <!-- Petals -->
        <g transform="translate(100, 80)">
          {#each petalAngles as angle, i (angle)}
            <g transform="rotate({angle})">
              <path
                d="M 0 0 C -12 -20 -15 -38 0 -48 C 15 -38 12 -20 0 0"
                fill={i % 2 === 0 ? '#fdf8ea' : '#f5edd4'}
                stroke="#594632"
                stroke-width="1.2"
              />
              <path
                d="M 0 -5 L 0 -42"
                stroke={accent}
                stroke-width="1.2"
                stroke-linecap="round"
                opacity="0.85"
              />
            </g>
          {/each}
          <!-- Inner Corollarium -->
          <circle cx="0" cy="0" r="14" fill="#d97706" stroke="#78350f" stroke-width="1.5" />
          <circle cx="0" cy="0" r="10" fill="#fef08a" />
          <!-- Stamen dots -->
          {#each stamenDegrees as deg (deg)}
            {@const rad = (deg * Math.PI) / 180}
            <circle
              cx={Math.cos(rad) * 6}
              cy={Math.sin(rad) * 6}
              r="1.5"
              fill="#92400e"
            />
          {/each}
          <circle cx="0" cy="0" r="2.5" fill="#451a03" />
        </g>

        <!-- Floating magical spores if mystical -->
        {#if mysticalIds.includes(plant.id)}
          <g opacity="0.8">
            <circle cx="65" cy="50" r="2" fill={accent} />
            <circle cx="138" cy="45" r="1.5" fill={accent} />
            <circle cx="150" cy="100" r="2.5" fill={accent} />
            <circle cx="48" cy="110" r="1.8" fill={accent} />
          </g>
        {/if}
      </g>

    {:else if plant.illustrationType === 'root'}
      <g>
        <!-- Ground surface line -->
        <path d="M 30 75 Q 100 70 170 75" stroke="#78350f" stroke-width="2" stroke-dasharray="3,3" />
        <text x="35" y="68" fill="#78350f" font-size="7" font-family="Crimson Pro" font-style="italic">Humus & roche</text>

        <!-- Top foliage sprout -->
        <path d="M 100 72 C 85 45 70 42 60 48 C 75 56 88 64 96 72" fill="#4f6e4a" stroke="#2c3b28" stroke-width="1.2" />
        <path d="M 100 72 C 105 35 120 30 135 34 C 125 48 112 60 104 72" fill="#3e593a" stroke="#2c3b28" stroke-width="1.2" />
        <path d="M 98 72 C 95 38 100 25 102 20 C 105 32 104 50 102 72" fill="#5f8559" stroke="#2c3b28" stroke-width="1.2" />

        {#if plant.id === 'mandragore_criarde'}
          <g>
            <!-- Mandrake grotesque body -->
            <path
              d="M 94 75 C 80 88 78 110 82 125 C 72 135 68 165 72 195 C 78 185 86 160 92 145 C 96 158 106 185 118 198 C 122 170 116 142 110 125 C 116 112 114 88 102 75 Z"
              fill="#c29b64"
              stroke="#573a1d"
              stroke-width="2"
            />
            <circle cx="92" cy="100" r="2.5" fill="#4a3118" />
            <circle cx="104" cy="100" r="2.5" fill="#4a3118" />
            <path d="M 94 114 Q 98 108 102 114" stroke="#4a3118" stroke-width="1.5" fill="none" />
            <ellipse cx="98" cy="120" rx="4" ry="6" fill="#3d220d" stroke="#573a1d" stroke-width="1" />
            <path d="M 75 140 Q 60 155 52 175" stroke="#784f27" stroke-width="1" fill="none" />
            <path d="M 115 142 Q 130 160 138 180" stroke="#784f27" stroke-width="1" fill="none" />
            <path d="M 95 160 Q 98 185 96 210" stroke="#784f27" stroke-width="1" fill="none" />
          </g>
        {:else}
          <g>
            <!-- Shadow Root knot -->
            <path
              d="M 96 75 C 84 90 76 115 80 135 C 70 148 55 170 45 195 C 60 188 75 170 86 155 C 92 172 95 198 96 215 C 104 195 112 170 114 150 C 128 170 142 190 155 205 C 145 178 132 155 120 135 C 124 112 118 90 104 75 Z"
              fill="#2b2623"
              stroke="#120f0d"
              stroke-width="2"
            />
            <circle cx="100" cy="140" r="30" fill={accent} opacity="0.15" filter="blur(6px)" />
            <path d="M 80 110 Q 55 125 40 145" stroke="#3d3733" stroke-width="1.5" fill="none" />
            <path d="M 118 115 Q 145 130 160 150" stroke="#3d3733" stroke-width="1.5" fill="none" />
          </g>
        {/if}
      </g>

    {:else if plant.illustrationType === 'mushroom'}
      <g>
        <!-- Ground base -->
        <ellipse cx="100" cy="190" rx="60" ry="12" fill="#3a3028" opacity="0.3" />
        <path d="M 70 185 Q 100 180 130 185" stroke="#4a3b2c" stroke-width="1.5" />

        <!-- Glowing aura -->
        <circle cx="100" cy="95" r="45" fill={accent} opacity="0.15" filter="blur(8px)" />

        <!-- Stipe / Foot -->
        <path
          d="M 90 110 Q 86 150 82 188 L 118 188 Q 114 150 110 110 Z"
          fill="#ebdcc7"
          stroke="#594432"
          stroke-width="1.8"
        />
        <path d="M 85 140 Q 100 145 115 140" stroke="#8a6d52" stroke-width="1" fill="none" />
        <path d="M 83 165 Q 100 170 117 165" stroke="#8a6d52" stroke-width="1" fill="none" />

        <!-- Under-cap gills -->
        <ellipse cx="100" cy="115" rx="55" ry="15" fill="#4a2e4b" stroke="#301831" stroke-width="1.5" />
        {#each gillOffsets as offset (offset)}
          <line
            x1={100 + offset}
            y1="114"
            x2={100 + offset * 1.2}
            y2="124"
            stroke="#693b6a"
            stroke-width="1"
          />
        {/each}

        <!-- Pileus / Brain-like or bell cap -->
        <path
          d="M 45 112 C 40 70 70 45 100 45 C 130 45 160 70 155 112 C 140 120 60 120 45 112 Z"
          fill="#7e4f88"
          stroke="#3c1e43"
          stroke-width="2"
        />

        <!-- Brain fold convolutions -->
        <path
          d="M 65 95 C 60 80 80 75 88 85 C 95 72 115 72 120 85 C 130 75 145 85 140 98"
          stroke="#43224b"
          stroke-width="2.5"
          fill="none"
          stroke-linecap="round"
        />
        <path
          d="M 75 75 C 80 60 100 58 105 68 C 115 58 130 62 130 74"
          stroke="#43224b"
          stroke-width="2.2"
          fill="none"
          stroke-linecap="round"
        />

        <!-- Spore cloud -->
        <g opacity="0.75">
          <circle cx="50" cy="55" r="1.5" fill={accent} />
          <circle cx="68" cy="38" r="2" fill={accent} />
          <circle cx="100" cy="28" r="2.5" fill={accent} />
          <circle cx="132" cy="35" r="1.8" fill={accent} />
          <circle cx="152" cy="58" r="2" fill={accent} />
          <circle cx="140" cy="135" r="1.5" fill={accent} />
        </g>
      </g>

    {:else if plant.illustrationType === 'shrub' || plant.illustrationType === 'tree_bark'}
      <g>
        <!-- Trunk / branches -->
        <path
          d="M 94 210 Q 96 160 90 120 C 80 100 65 85 50 75"
          stroke="#4a2e1b"
          stroke-width="6"
          fill="none"
          stroke-linecap="round"
        />
        <path
          d="M 96 150 Q 110 120 125 90 C 135 75 148 65 160 55"
          stroke="#4a2e1b"
          stroke-width="4.5"
          fill="none"
          stroke-linecap="round"
        />
        <path
          d="M 90 120 Q 96 90 100 60"
          stroke="#4a2e1b"
          stroke-width="3.5"
          fill="none"
          stroke-linecap="round"
        />

        <!-- Leaves cluster -->
        <g fill="#365338" stroke="#1f3321" stroke-width="1.2">
          <ellipse cx="48" cy="72" rx="14" ry="7" transform="rotate(-30 48 72)" />
          <ellipse cx="62" cy="80" rx="14" ry="7" transform="rotate(-15 62 80)" />
          <ellipse cx="158" cy="52" rx="14" ry="7" transform="rotate(25 158 52)" />
          <ellipse cx="140" cy="65" rx="14" ry="7" transform="rotate(35 140 65)" />
          <ellipse cx="98" cy="52" rx="14" ry="7" transform="rotate(-5 98 52)" />
        </g>

        {#if plant.id === 'belladone_noire'}
          <g>
            <circle cx="42" cy="84" r="6" fill="#1e1526" stroke="#483359" stroke-width="1.5" />
            <circle cx="40" cy="82" r="1.5" fill="#ffffff" opacity="0.6" />
            <circle cx="68" cy="94" r="6.5" fill="#1e1526" stroke="#483359" stroke-width="1.5" />
            <circle cx="66" cy="92" r="1.5" fill="#ffffff" opacity="0.6" />
            <circle cx="150" cy="74" r="6" fill="#1e1526" stroke="#483359" stroke-width="1.5" />
            <circle cx="148" cy="72" r="1.5" fill="#ffffff" opacity="0.6" />
          </g>
        {:else}
          <!-- Dragon blood sap tears -->
          <g>
            <path d="M 94 135 C 92 142 90 148 94 154 C 98 148 96 142 94 135 Z" fill="#b91c1c" stroke="#7f1d1d" stroke-width="1" />
            <circle cx="94" cy="154" r="4" fill="#dc2626" stroke="#7f1d1d" stroke-width="1" />
            <circle cx="93" cy="153" r="1.2" fill="#fca5a5" />

            <path d="M 112 110 C 110 116 109 122 112 127 C 115 122 114 116 112 110 Z" fill="#b91c1c" stroke="#7f1d1d" stroke-width="1" />
            <circle cx="112" cy="127" r="3.5" fill="#dc2626" stroke="#7f1d1d" stroke-width="1" />
          </g>
        {/if}
      </g>

    {:else if plant.illustrationType === 'vine'}
      <g>
        <!-- Twisting spiraling vine -->
        <path
          d="M 60 210 Q 90 170 70 140 T 130 90 T 110 40 T 140 20"
          stroke="#2e592f"
          stroke-width="4"
          fill="none"
          stroke-linecap="round"
        />
        <!-- Secondary intertwining stem -->
        <path
          d="M 75 210 Q 110 160 85 130 T 145 80 T 120 30"
          stroke="#1f3d20"
          stroke-width="2.5"
          fill="none"
          stroke-linecap="round"
        />

        <!-- Heart-shaped pointed leaves -->
        {#each vineLeaves as lf, i (i)}
          <g transform="translate({lf.x}, {lf.y}) rotate({lf.rot})">
            <path
              d="M 0 0 C -15 -10 -15 -25 0 -35 C 15 -25 15 -10 0 0"
              fill="#3f6e3c"
              stroke="#1c3b1a"
              stroke-width="1.2"
            />
            <line x1="0" y1="-2" x2="0" y2="-30" stroke="#1c3b1a" stroke-width="0.8" />
          </g>
        {/each}

        <!-- Sharp snake-fang thorns -->
        <polygon points="76,155 86,158 78,162" fill="#854d0e" />
        <polygon points="112,110 102,114 110,118" fill="#854d0e" />
        <polygon points="122,65 132,67 124,72" fill="#854d0e" />

        <!-- Tendril spiral curls -->
        <path d="M 130 90 Q 155 95 160 85 Q 165 75 155 75 Q 150 78 152 82" stroke="#2e592f" stroke-width="1.2" fill="none" />
      </g>

    {:else if plant.illustrationType === 'aquatic'}
      <g>
        <!-- Water currents -->
        <path d="M 25 50 Q 100 40 175 50" stroke="#0284c7" stroke-width="1" stroke-dasharray="4,4" opacity="0.4" />
        <path d="M 25 170 Q 100 160 175 170" stroke="#0284c7" stroke-width="1" stroke-dasharray="4,4" opacity="0.4" />

        <!-- Sea bottom rock -->
        <path d="M 60 210 Q 100 190 140 210 Z" fill="#334155" stroke="#1e293b" stroke-width="2" />

        <!-- Waving kelp ribbons -->
        <path
          d="M 92 195 Q 65 145 95 110 Q 125 70 85 30"
          stroke="#0f766e"
          stroke-width="12"
          fill="none"
          stroke-linecap="round"
        />
        <path
          d="M 105 195 Q 130 145 105 105 Q 80 65 115 25"
          stroke="#115e59"
          stroke-width="9"
          fill="none"
          stroke-linecap="round"
        />
        <path
          d="M 80 195 Q 60 150 75 120 Q 90 90 70 50"
          stroke="#134e4a"
          stroke-width="6"
          fill="none"
          stroke-linecap="round"
        />

        <!-- Oxygen vesicles (bladders) glowing -->
        {#each kelpBubbles as bubble, i (i)}
          <g>
            <circle cx={bubble.cx} cy={bubble.cy} r={bubble.r} fill="#7dd3fc" stroke="#0284c7" stroke-width="1.2" opacity="0.9" />
            <circle cx={bubble.cx - 1.5} cy={bubble.cy - 1.5} r={bubble.r / 3} fill="#ffffff" opacity="0.8" />
          </g>
        {/each}
      </g>

    {:else if plant.illustrationType === 'moss'}
      <g>
        <!-- Curved stone block -->
        <path d="M 40 180 C 40 120 160 120 160 180 L 160 210 L 40 210 Z" fill="#44403c" stroke="#292524" stroke-width="2" />

        <!-- Glowing carpet of lichen -->
        <path
          d="M 40 178 C 60 140 140 140 160 178 C 145 170 120 172 100 168 C 80 172 55 170 40 178 Z"
          fill="#15803d"
          stroke="#14532d"
          stroke-width="1.5"
        />

        <!-- Bioluminescent micro-glow -->
        <circle cx="100" cy="155" r="45" fill={accent} opacity="0.25" filter="blur(10px)" />

        <!-- Micro sporophyte stalks -->
        {#each mossStalks as x, i (x)}
          <g>
            <line x1={x} y1="165" x2={x + (i % 2 === 0 ? 3 : -3)} y2="135" stroke="#86efac" stroke-width="1" />
            <circle cx={x + (i % 2 === 0 ? 3 : -3)} cy="133" r="2.5" fill="#4ade80" stroke="#166534" stroke-width="0.8" />
          </g>
        {/each}

        <!-- Spores floating in cave air -->
        <g opacity="0.85">
          <circle cx="60" cy="115" r="2" fill={accent} />
          <circle cx="85" cy="95" r="1.5" fill={accent} />
          <circle cx="115" cy="105" r="2.2" fill={accent} />
          <circle cx="140" cy="120" r="1.8" fill={accent} />
        </g>
      </g>

    {:else if plant.illustrationType === 'succulent'}
      <g>
        <!-- Sand ground -->
        <path d="M 30 190 Q 100 185 170 190" stroke="#a16207" stroke-width="1.5" stroke-dasharray="3,3" />

        <!-- Ribbed Cactus body -->
        <path
          d="M 70 190 C 65 140 70 80 100 80 C 130 80 135 140 130 190 Z"
          fill="#4d7c0f"
          stroke="#365314"
          stroke-width="2"
        />
        <!-- Vertical ridges -->
        <path d="M 85 85 C 80 120 80 160 84 190" stroke="#365314" stroke-width="1.5" fill="none" />
        <path d="M 100 80 L 100 190" stroke="#365314" stroke-width="1.8" fill="none" />
        <path d="M 115 85 C 120 120 120 160 116 190" stroke="#365314" stroke-width="1.5" fill="none" />

        <!-- Sharp needle clusters -->
        {#each cactusNeedles as pt, i (i)}
          <g>
            <line x1={pt.x} y1={pt.y} x2={pt.x - 6} y2={pt.y - 3} stroke="#172554" stroke-width="1.2" />
            <line x1={pt.x} y1={pt.y} x2={pt.x + 6} y2={pt.y - 3} stroke="#172554" stroke-width="1.2" />
            <line x1={pt.x} y1={pt.y} x2={pt.x} y2={pt.y - 7} stroke="#172554" stroke-width="1.2" />
            <circle cx={pt.x} cy={pt.y} r="1.5" fill="#fef08a" />
          </g>
        {/each}

        <!-- Golden desert flower at crown -->
        <g transform="translate(100, 78)">
          <circle cx="0" cy="0" r="10" fill="#facc15" stroke="#854d0e" stroke-width="1.2" />
          <circle cx="0" cy="0" r="4" fill="#dc2626" />
        </g>
      </g>

    {:else}
      <g>
        <circle cx="100" cy="100" r="40" fill={accent} opacity="0.3" />
        <path d="M 100 60 L 100 160" stroke="#3e5339" stroke-width="3" />
        <circle cx="100" cy="60" r="15" fill="#fef3c7" stroke="#92400e" stroke-width="1.5" />
      </g>
    {/if}

    <!-- Anatomical Fig annotations -->
    {#if showPlateDetails && size !== 'sm'}
      <g fill="#78350f" font-size="8" font-family="Crimson Pro" font-style="italic" opacity="0.85">
        <text x="18" y="215">Fig. 1 Herba viva</text>
        <text x="130" y="215">Fig. 2 Radix</text>
      </g>
    {/if}
  </svg>

  <!-- Plate Footer / Latin Binomial -->
  {#if showPlateDetails && size !== 'sm'}
    <div class="plate-footer">
      <div class="plate-name">{plant.name}</div>
      <div class="plate-latin">{plant.latinName}</div>
    </div>
  {/if}
</div>

<style>
  .botanical-plate {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(196, 164, 124, 0.6);
    background-color: #fbf7ed;
    background-image: radial-gradient(#ebdcc4 1px, transparent 1px);
    background-size: 16px 16px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
    user-select: none;
  }

  .size-sm { width: 6rem; height: 6rem; }
  .size-md { width: 11rem; height: 14rem; }
  .size-lg { width: 16rem; height: 20rem; }
  .size-hero { width: 100%; max-width: 28rem; height: 24rem; }
  .size-print { width: 100%; height: 16rem; }

  .corner {
    position: absolute;
    width: 0.75rem;
    height: 0.75rem;
  }
  .corner-tl { top: 0.25rem; left: 0.25rem; border-top: 2px solid rgba(120, 53, 15, 0.6); border-left: 2px solid rgba(120, 53, 15, 0.6); }
  .corner-tr { top: 0.25rem; right: 0.25rem; border-top: 2px solid rgba(120, 53, 15, 0.6); border-right: 2px solid rgba(120, 53, 15, 0.6); }
  .corner-bl { bottom: 0.25rem; left: 0.25rem; border-bottom: 2px solid rgba(120, 53, 15, 0.6); border-left: 2px solid rgba(120, 53, 15, 0.6); }
  .corner-br { bottom: 0.25rem; right: 0.25rem; border-bottom: 2px solid rgba(120, 53, 15, 0.6); border-right: 2px solid rgba(120, 53, 15, 0.6); }

  .plate-header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 9px;
    font-family: 'Crimson Pro', Georgia, serif;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #78350f;
    border-bottom: 1px solid #e2d0b5;
    padding-bottom: 0.25rem;
    margin-bottom: 0.25rem;
  }
  .plate-header-title { font-weight: 600; }
  .plate-header-rarity { font-style: italic; }

  .plate-svg {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.1));
  }

  .plate-footer {
    width: 100%;
    text-align: center;
    border-top: 1px solid #e2d0b5;
    padding-top: 0.25rem;
    margin-top: 0.25rem;
  }
  .plate-name {
    font-size: 11px;
    font-family: 'Crimson Pro', Georgia, serif;
    font-weight: 700;
    color: #3e2723;
    letter-spacing: 0.03em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .plate-latin {
    font-size: 9px;
    font-family: 'Crimson Pro', Georgia, serif;
    font-style: italic;
    color: #78350f;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
