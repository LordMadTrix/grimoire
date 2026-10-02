<script lang="ts">
  import type { Mineral } from '$lib/herboriste/types/mineral';

  let {
    mineral,
    size = 'md',
    showPlateDetails = true,
    class: className = '',
  }: {
    mineral: Mineral;
    size?: 'sm' | 'md' | 'lg' | 'print';
    showPlateDetails?: boolean;
    class?: string;
  } = $props();

  const color = $derived(mineral.color);
  const accent = $derived(mineral.accentColor);
</script>

<div class="mineral-plate {size} {className}">
  <div class="inner-frame"></div>

  {#if showPlateDetails && size !== 'sm'}
    <div class="plate-header">
      Planche Minérale · {mineral.category.replace('_', ' ')}
    </div>
  {/if}

  <div class="svg-wrap">
    <svg
      viewBox="0 0 200 200"
      class="mineral-svg"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="100"
        cy="110"
        r="65"
        fill={accent}
        opacity="0.15"
        filter="blur(10px)"
      />

      {#if mineral.category === 'metal_magique'}
        <g>
          <polygon
            points="45,95 155,95 175,145 25,145"
            fill={color}
            stroke="#1c1917"
            stroke-width="2"
          />
          <polygon
            points="60,65 140,65 155,95 45,95"
            fill={accent}
            opacity="0.85"
            stroke="#1c1917"
            stroke-width="1.5"
          />
          <polygon
            points="60,65 45,95 25,145 35,115"
            fill="#000000"
            opacity="0.25"
          />
          <polygon
            points="140,65 155,95 175,145 160,115"
            fill="#ffffff"
            opacity="0.3"
          />
          <circle cx="100" cy="115" r="16" fill="none" stroke="#1c1917" stroke-width="1.5" opacity="0.6" />
          <path d="M100,103 L100,127 M92,111 L108,119 M92,119 L108,111" stroke="#1c1917" stroke-width="1.5" opacity="0.7" />
          <line x1="65" y1="70" x2="135" y2="70" stroke="#ffffff" stroke-width="2" opacity="0.7" />
          <line x1="50" y1="100" x2="150" y2="100" stroke="#ffffff" stroke-width="1.5" opacity="0.5" />
        </g>
      {:else if mineral.category === 'mineral_alchimique'}
        <g>
          <path
            d="M100,45 C75,85 55,120 55,145 C55,175 75,185 100,185 C125,185 145,175 145,145 C145,120 125,85 100,45 Z"
            fill={color}
            stroke="#1c1917"
            stroke-width="2"
          />
          <path
            d="M100,55 C82,90 68,125 68,145 C68,168 82,176 100,176 C118,176 132,168 132,145 C132,125 118,90 100,55 Z"
            fill={accent}
            opacity="0.7"
          />
          <path d="M85,38 Q100,25 90,15 Q105,10 95,5" fill="none" stroke={accent} stroke-width="1.5" opacity="0.6" />
          <path d="M115,38 Q100,25 110,15" fill="none" stroke={accent} stroke-width="1.5" opacity="0.6" />
          <ellipse cx="90" cy="135" rx="10" ry="18" fill="#ffffff" opacity="0.5" transform="rotate(-20 90 135)" />
          <circle cx="120" cy="155" r="5" fill="#ffffff" opacity="0.6" />
        </g>
      {:else if mineral.category === 'roche_tellurique'}
        <g>
          <polygon
            points="100,30 145,75 165,140 120,185 50,170 35,105 65,55"
            fill={color}
            stroke="#1c1917"
            stroke-width="2"
          />
          <polygon
            points="100,30 145,75 105,115 65,55"
            fill={accent}
            opacity="0.65"
            stroke="#1c1917"
            stroke-width="1.2"
          />
          <polygon
            points="145,75 165,140 120,135 105,115"
            fill="#000000"
            opacity="0.4"
            stroke="#1c1917"
            stroke-width="1"
          />
          <polygon
            points="105,115 120,185 50,170 80,135"
            fill={color}
            stroke="#1c1917"
            stroke-width="1.2"
          />
          <line x1="100" y1="30" x2="105" y2="115" stroke="#ffffff" stroke-width="2" opacity="0.7" />
          <line x1="105" y1="115" x2="50" y2="170" stroke="#ffffff" stroke-width="1.5" opacity="0.6" />
        </g>
      {:else if mineral.category === 'sel_reactif'}
        <g>
          <polygon
            points="60,80 110,50 160,80 110,110"
            fill={color}
            stroke="#1c1917"
            stroke-width="1.8"
          />
          <polygon
            points="60,80 110,110 110,165 60,135"
            fill={accent}
            opacity="0.85"
            stroke="#1c1917"
            stroke-width="1.8"
          />
          <polygon
            points="110,110 160,80 160,135 110,165"
            fill="#000000"
            opacity="0.2"
            stroke="#1c1917"
            stroke-width="1.8"
          />
          <polygon
            points="135,115 165,95 185,115 155,135"
            fill={color}
            opacity="0.9"
            stroke="#1c1917"
            stroke-width="1.5"
          />
          <polygon
            points="135,115 155,135 155,165 135,145"
            fill={accent}
            stroke="#1c1917"
            stroke-width="1.5"
          />
          <line x1="60" y1="80" x2="110" y2="50" stroke="#ffffff" stroke-width="2" opacity="0.8" />
          <line x1="110" y1="50" x2="160" y2="80" stroke="#ffffff" stroke-width="2" opacity="0.8" />
        </g>
      {:else}
        <!-- cristal_brut (default) -->
        <g>
          <polygon
            points="100,25 125,80 120,165 80,165 75,80"
            fill={color}
            stroke="#1c1917"
            stroke-width="2"
          />
          <polygon
            points="100,25 125,80 100,165 100,80"
            fill={accent}
            opacity="0.75"
            stroke="#1c1917"
            stroke-width="1.2"
          />
          <polygon
            points="55,75 80,115 75,175 45,165 40,115"
            fill={color}
            opacity="0.85"
            stroke="#1c1917"
            stroke-width="1.5"
          />
          <polygon
            points="145,65 165,105 155,170 125,165 125,105"
            fill={accent}
            opacity="0.75"
            stroke="#1c1917"
            stroke-width="1.5"
          />
          <line x1="100" y1="20" x2="100" y2="10" stroke={accent} stroke-width="2" opacity="0.6" />
          <line x1="90" y1="25" x2="80" y2="18" stroke={accent} stroke-width="1.5" opacity="0.6" />
          <line x1="110" y1="25" x2="120" y2="18" stroke={accent} stroke-width="1.5" opacity="0.6" />
        </g>
      {/if}
    </svg>
  </div>

  {#if showPlateDetails && size !== 'sm'}
    <div class="plate-footer">
      <div class="plate-name">{mineral.name}</div>
      <div class="plate-sub">{mineral.latinOrScientificName}</div>
    </div>
  {/if}
</div>

<style>
  .mineral-plate {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    border-radius: 0.5rem;
    background-color: #f7f2e7;
    border: 2px solid #b89f82;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    user-select: none;
  }

  .mineral-plate.sm { width: 5rem; height: 5rem; }
  .mineral-plate.md { width: 10rem; height: 12rem; }
  .mineral-plate.lg { width: 14rem; height: 16rem; }
  .mineral-plate.print { width: 9rem; height: 11rem; }

  .inner-frame {
    position: absolute;
    inset: 0.25rem;
    border: 1px solid #c9b49b;
    pointer-events: none;
    border-radius: 0.25rem;
    opacity: 0.6;
  }

  .plate-header {
    width: 100%;
    text-align: center;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid #d8c5b0;
    font-size: 9px;
    font-family: Georgia, 'Times New Roman', serif;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #78543d;
    font-weight: bold;
  }

  .svg-wrap {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  .mineral-svg {
    width: 100%;
    height: 100%;
    max-height: 10rem;
    filter: drop-shadow(0 4px 3px rgba(0, 0, 0, 0.15));
  }

  .plate-footer {
    width: 100%;
    text-align: center;
    padding-top: 0.25rem;
    border-top: 1px solid #d8c5b0;
  }

  .plate-name {
    font-size: 10px;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: bold;
    color: #3d2415;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .plate-sub {
    font-size: 8px;
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
    color: #78543d;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
