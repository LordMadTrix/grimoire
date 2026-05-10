import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import PlayerView from './PlayerView.svelte'

const urlParams = new URLSearchParams(window.location.search)
const isPlayerView = urlParams.get('view') === 'player'

const app = mount(isPlayerView ? PlayerView : App, {
  target: document.getElementById('app')!,
})

export default app
