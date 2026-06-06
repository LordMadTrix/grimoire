import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: '../dist/map-editor',
    emptyOutDir: true,
  },
  server: {
    watch: {
      ignored: [
        '**/public/assets/stamps/**',
        '**/inkarnate_urls*.json',
        '**/extracted_*.txt'
      ]
    }
  }
})
