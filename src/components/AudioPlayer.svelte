<script lang="ts">
  import { convertFileSrc } from '@tauri-apps/api/core';
  import { getVaultPath } from '$lib/stores/vault.svelte';

  let { src, volume, loop = true }: {
    src: string | null;
    volume: number;
    loop?: boolean;
  } = $props();

  let audioTag: HTMLAudioElement;

  $effect(() => {
    if (audioTag) {
      audioTag.volume = volume;
    }
  });

  let fullSrc = $derived(src ? convertFileSrc(getVaultPath() + '/' + src) : null);
</script>

{#if fullSrc}
  <audio 
    bind:this={audioTag}
    src={fullSrc} 
    {loop} 
    autoplay
  ></audio>
{/if}

<style>
  audio { display: none; }
</style>
