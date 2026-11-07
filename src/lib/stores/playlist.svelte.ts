import { vttStore, updateGmAudio, updateGmAudio2 } from './vtt.svelte';
import { notifStore } from './notifications.svelte';
import { emitToPlayerView, broadcastToPlayers } from '../api';
import { soundscape } from './soundscape.svelte';
import { sessionIntroStore } from './sessionIntro.svelte';
import { soundscapeEngine } from '$lib/herboriste/audio/soundscapes';

export interface TrackItem {
  id: string;
  name: string;
  src: string;
  category?: 'combat' | 'tavern' | 'exploration' | 'dungeon' | 'rest' | 'custom';
  duration?: string;
  sourceType?: 'local' | 'vault' | 'celestial' | 'web';
}

const STORAGE_KEY = 'grimoire_custom_playlist_v1';

class PlaylistStore {
  // Interrupteur général : musique activée ou désactivée
  isMusicEnabled = $state(true);
  isPlaying = $state(false);
  volume = $state(0.6);
  currentTrackIndex = $state<number>(-1);
  isShuffle = $state(false);
  loopMode = $state<'all' | 'one' | 'none'>('all');
  activeTheme = $state<string>('custom');

  // File de lecture courante
  tracks = $state<TrackItem[]>([]);

  // Playlist personnalisée sauvegardée
  customPlaylist = $state<TrackItem[]>([]);

  constructor() {
    this.loadCustomPlaylist();
    // Par défaut, la file courante correspond à la customPlaylist si elle existe
    if (this.customPlaylist.length > 0) {
      this.tracks = [...this.customPlaylist];
    }
  }

  get currentTrack(): TrackItem | null {
    if (this.currentTrackIndex >= 0 && this.currentTrackIndex < this.tracks.length) {
      return this.tracks[this.currentTrackIndex];
    }
    return null;
  }

  private loadCustomPlaylist() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.customPlaylist = JSON.parse(saved);
      }
    } catch {}
  }

  private saveCustomPlaylist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.customPlaylist));
    } catch {}
  }

  /**
   * Bascule l'activation de la musique (Désactiver / Réactiver en 1 clic)
   */
  toggleMusic() {
    if (this.isMusicEnabled && (this.isPlaying || vttStore.audioSrc)) {
      this.disableMusic();
    } else {
      this.enableMusic();
    }
  }

  /**
   * Désactive complètement la musique et coupe tout synthétiseur (vent, pluie)
   */
  disableMusic() {
    this.isMusicEnabled = false;
    this.isPlaying = false;
    updateGmAudio(null);
    updateGmAudio2(null);
    soundscape.killAll();
    soundscapeEngine.stop();
    sessionIntroStore.stop();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vtt-kill-all-audio'));
    }
    notifStore.add('🔇', 'Silence Total', 'Toutes les musiques, vents et ambiances sont coupés', 'info', 2000);
  }

  /**
   * Réactive la musique
   */
  enableMusic() {
    this.isMusicEnabled = true;
    if (this.tracks.length > 0) {
      const idx = this.currentTrackIndex >= 0 ? this.currentTrackIndex : 0;
      this.playTrack(idx);
    }
    notifStore.add('🔊', 'Musique Activée', 'La musique est réactivée', 'info', 2000);
  }

  /**
   * Lance un morceau à l'index donné
   */
  playTrack(index: number) {
    if (index < 0 || index >= this.tracks.length) return;
    this.currentTrackIndex = index;
    const track = this.tracks[index];
    this.isMusicEnabled = true;
    this.isPlaying = true;

    // Déclencher dans le VTT Store
    updateGmAudio(track.src);

    // Synchroniser avec les joueurs
    emitToPlayerView('update_player_audio', {
      src: track.src,
      volume: this.volume,
      src2: vttStore.audio2Src,
      volume2: vttStore.audio2Volume,
    });
    broadcastToPlayers('audio_sync', {
      src: track.src,
      playing: true,
      volume: this.volume,
      title: track.name,
    }).catch(() => {});

    notifStore.add('🎵', track.name, 'En cours de lecture...', 'success', 2000);
  }

  /**
   * Bascule Lecture / Pause
   */
  togglePlay() {
    if (!this.isMusicEnabled) {
      this.enableMusic();
      return;
    }

    if (this.isPlaying) {
      this.isPlaying = false;
      updateGmAudio(null);
      notifStore.add('⏸️', 'Musique en pause', '', 'info', 1500);
    } else {
      if (this.tracks.length > 0) {
        const idx = this.currentTrackIndex >= 0 ? this.currentTrackIndex : 0;
        this.playTrack(idx);
      }
    }
  }

  /**
   * Passe au morceau suivant
   */
  nextTrack() {
    if (this.tracks.length === 0) return;

    if (this.isShuffle && this.tracks.length > 1) {
      let nextIdx = this.currentTrackIndex;
      while (nextIdx === this.currentTrackIndex) {
        nextIdx = Math.floor(Math.random() * this.tracks.length);
      }
      this.playTrack(nextIdx);
      return;
    }

    const nextIndex = this.currentTrackIndex + 1;
    if (nextIndex >= this.tracks.length) {
      if (this.loopMode === 'all') {
        this.playTrack(0);
      } else {
        this.isPlaying = false;
        updateGmAudio(null);
      }
    } else {
      this.playTrack(nextIndex);
    }
  }

  /**
   * Revient au morceau précédent
   */
  prevTrack() {
    if (this.tracks.length === 0) return;
    const prevIndex = this.currentTrackIndex - 1;
    if (prevIndex < 0) {
      this.playTrack(Math.max(0, this.tracks.length - 1));
    } else {
      this.playTrack(prevIndex);
    }
  }

  /**
   * Événement fin de morceau (onended du lecteur audio HTML5)
   */
  onTrackEnded() {
    if (!this.isMusicEnabled || !this.isPlaying) return;

    if (this.loopMode === 'one' && this.currentTrackIndex >= 0) {
      this.playTrack(this.currentTrackIndex);
      return;
    }

    this.nextTrack();
  }

  /**
   * Règle le volume
   */
  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    vttStore.audioVolume = this.volume;
    emitToPlayerView('update_player_audio', {
      src: vttStore.audioSrc,
      volume: this.volume,
      src2: vttStore.audio2Src,
      volume2: vttStore.audio2Volume,
    });
  }

  /**
   * Ajoute une piste à la playlist active et la sauvegarde
   */
  addTrack(track: Omit<TrackItem, 'id'>) {
    const item: TrackItem = {
      ...track,
      id: 'trk_' + Math.random().toString(36).slice(2, 9),
    };
    this.tracks = [...this.tracks, item];
    this.customPlaylist = [...this.customPlaylist, item];
    this.saveCustomPlaylist();
    notifStore.add('➕', item.name, 'Ajouté à la playlist', 'info', 1800);
  }

  /**
   * Supprime une piste de la playlist active
   */
  removeTrack(index: number) {
    if (index < 0 || index >= this.tracks.length) return;
    const removed = this.tracks[index];
    this.tracks = this.tracks.filter((_, i) => i !== index);
    this.customPlaylist = this.customPlaylist.filter(t => t.id !== removed.id);
    this.saveCustomPlaylist();

    if (this.currentTrackIndex === index) {
      if (this.tracks.length > 0) {
        this.playTrack(Math.min(index, this.tracks.length - 1));
      } else {
        this.currentTrackIndex = -1;
        this.isPlaying = false;
        updateGmAudio(null);
      }
    } else if (this.currentTrackIndex > index) {
      this.currentTrackIndex--;
    }
  }

  /**
   * Vide la playlist
   */
  clearPlaylist() {
    this.tracks = [];
    this.customPlaylist = [];
    this.currentTrackIndex = -1;
    this.isPlaying = false;
    updateGmAudio(null);
    this.saveCustomPlaylist();
  }

  /**
   * Charge une ambiance prédéfinie ou la playlist custom
   */
  loadTheme(theme: string, vaultTracks: { name: string; path: string }[] = []) {
    this.activeTheme = theme;

    if (theme === 'custom') {
      this.tracks = [...this.customPlaylist];
      return;
    }

    // Filtrer les morceaux du vault correspondant à ce thème
    const keywords: Record<string, string[]> = {
      combat: ['combat', 'battle', 'war', 'fight', 'action', 'boss', 'tension'],
      tavern: ['tavern', 'auberge', 'inn', 'boire', 'fete', 'lute', 'dance', 'folk'],
      exploration: ['explore', 'journey', 'voyage', 'route', 'forest', 'foret', 'nature', 'vent'],
      dungeon: ['dungeon', 'donjon', 'cave', 'crypt', 'crypte', 'dark', 'sombre', 'mystere'],
      rest: ['rest', 'camp', 'feu', 'calme', 'peace', 'nuit', 'sleep', 'safe'],
    };

    const searchWords = keywords[theme] || [];
    const matched = vaultTracks.filter(t => {
      const lower = (t.name + ' ' + t.path).toLowerCase();
      return searchWords.some(w => lower.includes(w));
    });

    if (matched.length > 0) {
      this.tracks = matched.map(m => ({
        id: 'thm_' + Math.random().toString(36).slice(2, 9),
        name: m.name,
        src: m.path,
        category: theme as any,
        sourceType: 'vault',
      }));
      if (this.tracks.length > 0) {
        this.playTrack(0);
      }
      notifStore.add('🎭', `Ambiance ${theme.toUpperCase()}`, `${matched.length} musiques chargées`, 'success', 2000);
    } else {
      notifStore.add('ℹ️', `Ambiance ${theme}`, 'Aucun morceau correspondant trouvé dans le coffre', 'info', 2500);
    }
  }
}

export const playlistStore = new PlaylistStore();

/**
 * Fonction universelle d'arrêt d'urgence : coupe net toutes les musiques,
 * ambiances procédurales (vent, pluie, orage), intro MP3 et zones audio.
 */
export function stopAllAudiosGlobally() {
  playlistStore.disableMusic();
}
