import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  base: './',
  build: {
    outDir: '../dist/map-editor',
    emptyOutDir: false,
    chunkSizeWarningLimit: 7000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('imported_stamps.json')) {
            return 'stamps-catalog';
          }
          if (id.includes('imported_textures.json')) {
            return 'textures-catalog';
          }
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
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
