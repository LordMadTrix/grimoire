import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'path'

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
    watch: {
      ignored: ['**/src-tauri/**'],
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
