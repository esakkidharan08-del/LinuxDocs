import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // All routes are React.lazy-split (largest page chunk ≈ 77 kB). The entry
    // chunk legitimately stays ~545 kB minified (≈172 kB gzipped) because the
    // shell renders the sidebar with the full 132-command dataset, which every
    // route needs anyway. 700 kB silences the generic advisory for that.
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
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})