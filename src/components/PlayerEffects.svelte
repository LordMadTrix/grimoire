<script lang="ts">
  import { onMount } from 'svelte';

  let { weather = 'none', partyHealthStatus = 'normal', isCorrupted = false }: { weather?: string; partyHealthStatus?: 'normal' | 'low' | 'critical'; isCorrupted?: boolean; } = $props();
  
  

  let particles = $state<{id: number, x: number, y: number, s: number, d: number}[]>([]);

  $effect(() => {
    // Generate particles based on weather
    if (weather === 'rain') {
      particles = Array.from({length: 100}, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        s: Math.random() * 0.5 + 0.5,
        d: Math.random() * 2
      }));
    } else if (weather === 'snow' || weather === 'ash') {
      particles = Array.from({length: 50}, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        s: Math.random() * 0.5 + 0.5,
        d: Math.random() * 5
      }));
    } else {
      particles = [];
    }
  });

</script>

<div class="effects-overlay" class:vignette-critical={partyHealthStatus === 'critical'} class:vignette-corrupt={isCorrupted}>
  {#if weather === 'fog'}
    <div class="fog-container">
      <div class="fog-img fog-img-first"></div>
      <div class="fog-img fog-img-second"></div>
    </div>
  {/if}

  {#each particles as p (p.id)}
    <div 
      class="particle {weather}" 
      style="left: {p.x}%; top: -10%; animation-duration: {weather === 'rain' ? 0.5 + p.s : 3 + p.s}s; animation-delay: {p.d}s;"
    ></div>
  {/each}
</div>

<style>
  .effects-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 50; /* Above map, below UI */
    overflow: hidden;
    transition: box-shadow 2s ease-in-out;
  }

  .vignette-critical {
    box-shadow: inset 0 0 150px 20px rgba(180, 0, 0, 0.6);
  }

  .vignette-corrupt {
    box-shadow: inset 0 0 150px 20px rgba(120, 0, 200, 0.4);
  }

  /* Particles */
  .particle {
    position: absolute;
    background: white;
    animation-name: fall;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
  }

  .particle.rain {
    width: 2px;
    height: 30px;
    background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.6));
    transform: rotate(10deg);
  }

  .particle.snow {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255,255,255,0.8);
    box-shadow: 0 0 4px white;
    animation-name: driftFall;
  }

  .particle.ash {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(255, 100, 50, 0.8);
    box-shadow: 0 0 6px rgba(255, 50, 0, 0.8);
    animation-name: driftFallUp;
  }

  @keyframes fall {
    0% { transform: translateY(-10vh) rotate(10deg); opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { transform: translateY(110vh) rotate(10deg); opacity: 0; }
  }

  @keyframes driftFall {
    0% { transform: translateY(-10vh) translateX(0); opacity: 0; }
    10% { opacity: 1; }
    50% { transform: translateY(50vh) translateX(20px); }
    90% { opacity: 1; }
    100% { transform: translateY(110vh) translateX(-20px); opacity: 0; }
  }

  @keyframes driftFallUp {
    0% { transform: translateY(110vh) translateX(0); opacity: 0; }
    10% { opacity: 1; }
    50% { transform: translateY(50vh) translateX(20px); opacity: 0.5; }
    90% { opacity: 0; }
    100% { transform: translateY(-10vh) translateX(-20px); opacity: 0; }
  }

  /* Fog */
  .fog-container {
    position: absolute;
    width: 100%;
    height: 100%;
    overflow: hidden;
    z-index: 1;
    opacity: 0.6;
    mix-blend-mode: screen;
  }
  .fog-img {
    position: absolute;
    height: 100vh;
    width: 300vw;
    background: url('https://raw.githubusercontent.com/danielstuart14/CSS_FOG_ANIMATION/master/fog1.png') repeat-x;
    background-size: contain;
    animation: fog 60s linear infinite;
  }
  .fog-img-first {
    animation-duration: 60s;
  }
  .fog-img-second {
    background: url('https://raw.githubusercontent.com/danielstuart14/CSS_FOG_ANIMATION/master/fog2.png') repeat-x;
    background-size: contain;
    animation-duration: 40s;
  }

  @keyframes fog {
    0% { transform: translate3d(0, 0, 0); }
    100% { transform: translate3d(-200vw, 0, 0); }
  }
</style>
