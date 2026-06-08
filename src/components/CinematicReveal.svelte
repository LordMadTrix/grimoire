<script lang="ts">
  let { handout = null, onClose }: { handout?: { type: 'image' | 'note' | 'shop'; content: string; title?: string } | null; onClose: () => void; } = $props();
  

  let showModal = $state(false);

  $effect(() => {
    if (handout) {
      // Delay slightly for dramatic effect
      setTimeout(() => showModal = true, 50);
    } else {
      showModal = false;
    }
  });

  function close() {
    showModal = false;
    setTimeout(onClose, 500); // Wait for out-animation
  }
</script>

{#if handout && showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="reveal-backdrop" onclick={close}>
    <div class="reveal-container" class:note={handout.type === 'note'} class:image={handout.type === 'image'}>
      {#if handout.type === 'image'}
        <img src={handout.content} alt={handout.title ?? 'Image Partagée'} class="handout-image" onclick={e => e.stopPropagation()} />
        {#if handout.title}
          <div class="handout-title">{handout.title}</div>
        {/if}
      {:else}
        <!-- Paper/Parchment style -->
        <div class="parchment" onclick={e => e.stopPropagation()}>
          {#if handout.title}
            <h2 class="parchment-title">{handout.title}</h2>
          {/if}
          <div class="parchment-body">
            {@html handout.content}
          </div>
          <div class="wax-seal"></div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .reveal-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    z-index: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.5s ease;
  }

  .reveal-container {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;
    animation: unroll 1.2s cubic-bezier(0.19, 1, 0.22, 1) forwards;
    transform-origin: center;
  }

  .handout-image {
    max-width: 100%;
    max-height: 80vh;
    border: 4px solid #1a1c29;
    box-shadow: 0 0 40px rgba(0,0,0,1), 0 0 20px #e5a853;
    border-radius: 4px;
    object-fit: contain;
  }

  .handout-title {
    text-align: center;
    color: #e5a853;
    font-family: 'Cinzel', serif;
    font-size: 24px;
    margin-top: 20px;
    text-shadow: 0 2px 4px rgba(0,0,0,1);
  }

  .parchment {
    background: #e2cfa2;
    background-image: linear-gradient(to right, rgba(255,255,255,0.4), rgba(255,255,255,0)), url('https://www.transparenttextures.com/patterns/aged-paper.png');
    padding: 60px 40px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.8), inset 0 0 30px rgba(100,60,20,0.4);
    border-radius: 2px 5px 3px 4px;
    color: #3b2818;
    max-width: 600px;
    min-width: 300px;
    min-height: 400px;
    position: relative;
  }

  .parchment::before, .parchment::after {
    content: '';
    position: absolute;
    width: 100%;
    height: 15px;
    background: #c2ab79;
    left: 0;
  }
  .parchment::before { top: 0; border-bottom: 1px solid #8c7343; }
  .parchment::after { bottom: 0; border-top: 1px solid #8c7343; }

  .parchment-title {
    font-family: 'Cinzel', serif;
    text-align: center;
    margin-top: 0;
    margin-bottom: 30px;
    border-bottom: 2px solid rgba(59, 40, 24, 0.3);
    padding-bottom: 10px;
    font-size: 32px;
  }

  .parchment-body {
    font-family: 'Georgia', serif;
    font-size: 18px;
    line-height: 1.6;
  }

  .wax-seal {
    position: absolute;
    bottom: 20px;
    right: 30px;
    width: 60px;
    height: 60px;
    background: #900;
    border-radius: 50%;
    box-shadow: inset 0 0 10px #400, 2px 2px 5px rgba(0,0,0,0.5);
    opacity: 0;
    animation: stampSeal 0.4s 1.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes unroll {
    0% { transform: scaleY(0.01) scaleX(0.8); opacity: 0; filter: brightness(2) blur(10px); }
    50% { transform: scaleY(1.05) scaleX(0.9); opacity: 1; filter: brightness(1.2) blur(0px); }
    100% { transform: scaleY(1) scaleX(1); opacity: 1; filter: brightness(1); }
  }

  @keyframes stampSeal {
    0% { transform: scale(3); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
</style>
