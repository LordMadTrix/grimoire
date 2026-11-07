<script lang="ts">
  import { readFileBase64, fetchBinaryAssetUrl, isTauri } from '$lib/api';
  import { getVaultPath } from '$lib/stores/vault.svelte';
  import { playlistStore } from '$lib/stores/playlist.svelte';

  let { src, volume, loop = true }: {
    src: string | null;
    volume: number;
    loop?: boolean;
  } = $props();

  let audioTag = $state<HTMLAudioElement>();
  let fullSrc = $state<string | null>(null);

  function getAudioMime(pathOrExt: string): string {
    const ext = pathOrExt.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'wav': return 'audio/wav';
      case 'ogg': return 'audio/ogg';
      case 'm4a':
      case 'mp4':
      case 'aac': return 'audio/mp4';
      case 'flac': return 'audio/flac';
      case 'webm': return 'audio/webm';
      case 'opus': return 'audio/opus';
      default: return 'audio/mpeg';
    }
  }

  $effect(() => {
    if (audioTag) {
      audioTag.volume = Math.max(0, Math.min(1, volume));
    }
  });

  $effect(() => {
    const targetSrc = src;
    if (!targetSrc) {
      fullSrc = null;
      return;
    }

    // 1. URLs directes Web, Data URLs, Blob URLs ou Tauri asset protocol
    if (
      targetSrc.startsWith('http://') ||
      targetSrc.startsWith('https://') ||
      targetSrc.startsWith('data:') ||
      targetSrc.startsWith('blob:') ||
      targetSrc.startsWith('asset://')
    ) {
      fullSrc = targetSrc;
      return;
    }

    // 2. Fichiers locaux : chemin absolu ou relatif au vault
    const vaultPath = getVaultPath();
    const isAbsolute = /^[a-zA-Z]:[\\/]/.test(targetSrc) || targetSrc.startsWith('/');
    const fullPath = isAbsolute ? targetSrc : (vaultPath ? `${vaultPath}/${targetSrc}` : targetSrc);

    // Tentative de streaming natif via l'URL d'asset Tauri si disponible
    if (isTauri()) {
      fetchBinaryAssetUrl(fullPath)
        .then(assetUrl => {
          if (src !== targetSrc) return;
          if (assetUrl) {
            fullSrc = assetUrl;
          } else {
            fallbackBase64(fullPath, targetSrc);
          }
        })
        .catch(() => fallbackBase64(fullPath, targetSrc));
    } else {
      fallbackBase64(fullPath, targetSrc);
    }
  });

  function fallbackBase64(fullPath: string, targetSrc: string) {
    readFileBase64(fullPath)
      .then(base64 => {
        if (src !== targetSrc) return;
        const mime = getAudioMime(fullPath);
        fullSrc = `data:${mime};base64,${base64}`;
      })
      .catch(err => {
        if (src !== targetSrc) return;
        console.error('AudioPlayer: impossible de charger', fullPath, err);
        fullSrc = null;
      });
  }

  function handleCanPlay() {
    if (audioTag && audioTag.paused) {
      audioTag.play().catch(e => {
        console.warn('Autoplay audio bloqué ou reporté:', e);
      });
    }
  }
  function handleEnded() {
    playlistStore.onTrackEnded();
  }
</script>

{#if fullSrc && playlistStore.isMusicEnabled}
  <audio
    bind:this={audioTag}
    src={fullSrc}
    loop={playlistStore.tracks.length > 1 ? false : loop}
    autoplay
    oncanplay={handleCanPlay}
    onended={handleEnded}
  ></audio>
{/if}

<style>
  audio { display: none; }
</style>
