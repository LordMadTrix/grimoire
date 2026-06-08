import { mount } from 'svelte'
import './theme.css'
import App from './App.svelte'
import PlayerView from './PlayerView.svelte'
import { getCurrentWindow } from '@tauri-apps/api/window'

const urlParams = new URLSearchParams(window.location.search)
let isPlayerView = urlParams.get('view') === 'player'

try {
  if (getCurrentWindow().label === 'player-view') {
    isPlayerView = true;
  }
} catch (e) {
  // Ignore si on n'est pas dans Tauri
}

const app = mount(isPlayerView ? PlayerView : App, {
  target: document.getElementById('app')!,
})

export default app
