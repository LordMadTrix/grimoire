import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'path'

/**
 * Google Drive sert TOUS les fichiers en `application/octet-stream`
 * (+ `Content-Disposition: attachment`), ce que <audio>/<video> refusent de lire
 * (« MEDIA_ELEMENT_ERROR: Format error »). Le proxy `/drive-media/<id>.<ext>`
 * relaie le fichier et rétablit le bon Content-Type d'après l'extension.
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
  resolve: {
    alias: {
      '$lib': path.resolve('./src/lib'),
    },
  },
  // Prevent vite from obscuring Rust errors
  clearScreen: false,
  // Tauri dev server config
  server: {
    port: 5173,
    strictPort: true,
    cors: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
    // Proxy des médias Drive (dev : navigateur ET webview de `tauri dev`).
    // En production Tauri, le protocole custom « grimoiremedia » prend le relais.
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
            // Drive nomme toujours le fichier : on en déduit le vrai type MIME.
            const cd = String(proxyRes.headers['content-disposition'] || '')
            const fm = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(cd)
            const ext = fm ? (fm[1].split('.').pop() || '').toLowerCase() : ''
            const type = DRIVE_MEDIA_MIME[ext]
            if (type) {
              proxyRes.headers['content-type'] = type
              proxyRes.headers['cache-control'] = 'public, max-age=86400'
            }
            delete proxyRes.headers['content-disposition']
            // Google renvoie ~4 Ko de Access-Control-Allow-Headers inutiles ici.
            delete proxyRes.headers['access-control-allow-headers']
          })
        },
      },
    },
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('pixi.js')) {
              return 'vendor-pixi';
            }
            if (id.includes('@codemirror') || id.includes('codemirror')) {
              return 'vendor-codemirror';
            }
            if (id.includes('d3')) {
              return 'vendor-d3';
            }
            if (id.includes('pdfjs-dist')) {
              return 'vendor-pdfjs';
            }
            if (id.includes('tesseract.js')) {
              return 'vendor-ocr';
            }
            if (id.includes('@tauri-apps')) {
              return 'vendor-tauri';
            }
            if (id.includes('svelte')) {
              return 'vendor-svelte';
            }
            return 'vendor';
          }
        },
      },
    },
  },
})
