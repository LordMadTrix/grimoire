<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  
  let { rollData = null }: { rollData?: { seq: number, text: string, type?: string, total?: number } | null; } = $props();
  
  let show = $state(false);
  let rollResult = $state<{total: number, text: string}>({total: 0, text: ''});
  let isCritSuccess = $state(false);
  let isCritFail = $state(false);
  
  let animationTimeout: any;

  $effect(() => {
    if (rollData && rollData.seq > 0) {
      triggerRoll(rollData);
    }
  });

  function triggerRoll(data: any) {
    if (animationTimeout) clearTimeout(animationTimeout);
    
    // Parse the data if not directly provided
    const text = data.text || '';
    const totalMatch = text.match(/=\s*(\d+)/) || text.match(/^(\d+)$/);
    const total = data.total ?? (totalMatch ? parseInt(totalMatch[1]) : 0);
    
    // Warhammer crits: 01-05 is success, 96-100 is fail (simplified)
    // Or we can just do basic detection for now
    isCritSuccess = total >= 1 && total <= 5;
    isCritFail = total >= 96 && total <= 100;

    rollResult = { total, text };
    show = true;

    // Wait for animation to finish
    animationTimeout = setTimeout(() => {
      show = false;
    }, 4500);
  }
</script>

{#if show}
  <div class="dice-overlay" class:crit-success={isCritSuccess} class:crit-fail={isCritFail}>
    <!-- The rotating 3D Scene -->
    <div class="scene">
      <div class="dice">
        <div class="face front"><span>{rollResult.total}</span></div>
        <div class="face back"><span></span></div>
        <div class="face right"><span></span></div>
        <div class="face left"><span></span></div>
        <div class="face top"><span></span></div>
        <div class="face bottom"><span></span></div>
      </div>
    </div>
    
    <!-- The final flash text -->
    <div class="result-banner">
      <div class="result-number">{rollResult.total}</div>
      <div class="result-text">{rollResult.text.replace(/=\s*\d+/, '')}</div>
    </div>
  </div>
{/if}

<style>
  .dice-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  /* Screen shake for crit fail */
  .dice-overlay.crit-fail {
    animation: screenShake 0.4s ease-in-out;
  }

  /* Glow for crit success */
  .dice-overlay.crit-success .result-number {
    color: #4ade80;
    text-shadow: 0 0 40px #4ade80, 0 0 80px #4ade80;
  }
  .dice-overlay.crit-fail .result-number {
    color: #f87171;
    text-shadow: 0 0 40px #f87171, 0 0 80px #f87171;
  }

  .scene {
    width: 100px;
    height: 100px;
    perspective: 600px;
    margin-bottom: 2rem;
    animation: dropIn 0.5s ease-out forwards;
  }

  .dice {
    width: 100%;
    height: 100%;
    position: relative;
    transform-style: preserve-3d;
    animation: roll 1.5s cubic-bezier(0.1, 0.9, 0.2, 1) forwards;
  }

  .face {
    position: absolute;
    width: 100px;
    height: 100px;
    background: linear-gradient(135deg, #1a1c29, #2d3748);
    border: 2px solid #e5a853;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40px;
    font-weight: bold;
    color: #e5a853;
    box-shadow: inset 0 0 20px rgba(0,0,0,0.8);
    border-radius: 8px;
  }

  .front  { transform: rotateY(  0deg) translateZ(50px); }
  .right  { transform: rotateY( 90deg) translateZ(50px); }
  .back   { transform: rotateY(180deg) translateZ(50px); }
  .left   { transform: rotateY(-90deg) translateZ(50px); }
  .top    { transform: rotateX( 90deg) translateZ(50px); }
  .bottom { transform: rotateX(-90deg) translateZ(50px); }

  @keyframes roll {
    0% { transform: translateZ(-200px) rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
    30% { transform: translateZ(50px) rotateX(360deg) rotateY(180deg) rotateZ(90deg); }
    60% { transform: translateZ(0px) rotateX(720deg) rotateY(360deg) rotateZ(180deg); }
    100% { transform: translateZ(0px) rotateX(1080deg) rotateY(720deg) rotateZ(360deg); }
  }

  @keyframes dropIn {
    0% { opacity: 0; transform: scale(0) translateY(-200px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }

  .result-banner {
    opacity: 0;
    transform: scale(0.5);
    animation: blastIn 0.5s 1.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    text-align: center;
  }

  .result-number {
    font-size: 120px;
    font-weight: 900;
    font-family: 'Cinzel', serif;
    color: #fff;
    text-shadow: 0 0 20px rgba(229, 168, 83, 0.8);
    line-height: 1;
  }

  .result-text {
    font-size: 24px;
    color: #a0aec0;
    margin-top: 10px;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  @keyframes blastIn {
    0% { opacity: 0; transform: scale(0.1); }
    80% { transform: scale(1.1); }
    100% { opacity: 1; transform: scale(1); }
  }

  @keyframes screenShake {
    0%, 100% { transform: translate(0, 0) rotate(0deg); }
    10% { transform: translate(-10px, -10px) rotate(-1deg); }
    20% { transform: translate(10px, -10px) rotate(1deg); }
    30% { transform: translate(-10px, 10px) rotate(0deg); }
    40% { transform: translate(10px, 10px) rotate(1deg); }
    50% { transform: translate(-10px, -10px) rotate(-1deg); }
    60% { transform: translate(10px, -10px) rotate(0deg); }
    70% { transform: translate(-10px, 10px) rotate(-1deg); }
    80% { transform: translate(10px, 10px) rotate(1deg); }
    90% { transform: translate(-10px, -10px) rotate(0deg); }
  }
</style>
