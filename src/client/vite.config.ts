import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
    sourcemap: true,
    // Target modern browsers for smaller bundle
    target: 'es2020',
    // Minification settings
    minify: 'esbuild',
    rollupOptions: {
      // Multiple entry points for different views
      input: {
        index: resolve(__dirname, 'index.html'),
        profile: resolve(__dirname, 'entries/profile.html'),
        leaderboard: resolve(__dirname, 'entries/leaderboard.html'),
        awards: resolve(__dirname, 'entries/awards.html'),
        create: resolve(__dirname, 'entries/create.html'),
      },
      output: {
        manualChunks: (id) => {
          // React core in its own chunk
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          // Group feature views for lazy loading
          if (id.includes('/components/profile/')) {
            return 'profile-view';
          }
          if (id.includes('/components/leaderboard/')) {
            return 'leaderboard-view';
          }
          if (id.includes('/components/create/')) {
            return 'create-view';
          }
          if (id.includes('/components/gameplay/')) {
            return 'gameplay';
          }
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: '[name].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Report compressed size
    reportCompressedSize: true,
    // Chunk size warning limit (200KB)
    chunkSizeWarningLimit: 200,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  // Serve assets from the root assets folder
  publicDir: '../../assets',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
