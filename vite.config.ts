import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // All routes are React.lazy-split. The entry chunk is ~420 kB minified
    // (~135 kB gzipped): app shell + the lightweight dataset index only
    // (src/data/commandsIndex.ts). The full 132-entry docs module
    // (src/data/commands.ts) ships as its own async chunk (~134 kB / ~40 kB
    // gzip) loaded by the lazy routes that need it. 700 kB silences the
    // generic advisory for the shell.
    chunkSizeWarningLimit: 700,
  },
  server: {
    port: 5173,
    // Fail loudly if 5173 is taken. Falling back to another port silently
    // changes the browser Origin, which the backend's CSRF origin check
    // rejects (403) - a confusing way to break login.
    strictPort: true,
    proxy: {
      '/api': {
        // 127.0.0.1, not `localhost`: Node's DNS resolution for `localhost`
        // can prefer IPv6 (::1), where nothing is listening.
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
})