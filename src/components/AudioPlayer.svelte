<script lang="ts">
  import { readFileBase64 } from '$lib/api';
  import { getVaultPath } from '$lib/stores/vault.svelte';

  let { src, volume, loop = true }: {
    src: string | null;
    volume: number;
    loop?: boolean;
  } = $props();

  let audioTag = $state<HTMLAudioElement>();
  let fullSrc = $state<string | null>(null);

  $effect(() => {
    if (audioTag) {
      audioTag.volume = volume;
    }
  });

  $effect(() => {
    const relativePath = src;
    const vaultPath = getVaultPath();
    if (!relativePath || !vaultPath) { fullSrc = null; return; }

    readFileBase64(`${vaultPath}/${relativePath}`).then(base64 => {
      if (src !== relativePath) return; // une réponse plus récente a déjà pris le relais
      const ext = relativePath.split('.').pop()?.toLowerCase();
      let mime = 'audio/mpeg';
      if (ext === 'wav') mime = 'audio/wav';
      else if (ext === 'ogg') mime = 'audio/ogg';
      else if (ext === 'm4a') mime = 'audio/mp4';
      fullSrc = `data:${mime};base64,${base64}`;
    }).catch(err => {
      if (src !== relativePath) return;
      console.error('AudioPlayer: impossible de charger', relativePath, err);
      fullSrc = null;
    });
  });
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
