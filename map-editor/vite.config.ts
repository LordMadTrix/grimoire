import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

/**
 * Google Drive sert TOUS les fichiers en `application/octet-stream`
 * (+ `Content-Disposition: attachment`), illisible par <audio>/<video>.
 * Ce proxy rétablit le bon Content-Type d'après le nom de fichier Drive.
 */
const DRIVE_MEDIA_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  opus: 'audio/ogg',
  weba: 'audio/webm',
  mp4: 'video/mp4',
  webm: 'video/webm',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  ogv: 'video/ogg',
  pdf: 'application/pdf',
}

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
    },
    // Relais des médias Drive (dev) ; en production c'est le protocole
    // custom Tauri « grimoiremedia » qui prend le relais.
    proxy: {
      '/drive-media': {
        target: 'https://drive.usercontent.google.com',
        changeOrigin: true,
        rewrite: (url: string) => {
          const m = /^\/drive-media\/([A-Za-z0-9_-]+)(?:\.[A-Za-z0-9]+)?$/.exec(url)
          return `/download?id=${m ? m[1] : ''}&export=download`
        },
        configure: (proxy: any) => {
          proxy.on('proxyRes', (proxyRes: any) => {
            const cd = String(proxyRes.headers['content-disposition'] || '')
            const fm = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(cd)
            const ext = fm ? (fm[1].split('.').pop() || '').toLowerCase() : ''
            const type = DRIVE_MEDIA_MIME[ext]
            if (type) {
              proxyRes.headers['content-type'] = type
              proxyRes.headers['cache-control'] = 'public, max-age=86400'
            }
            delete proxyRes.headers['content-disposition']
            delete proxyRes.headers['access-control-allow-headers']
          })
        },
      },
    },
  }
})
