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
        manualChunks: {
          // Ensure React is in its own chunk and loads first
          'react-vendor': ['react', 'react-dom'],
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
  // Ensure proper module resolution for React
  optimizeDeps: {
    include: ['react', 'react-dom'],
    force: true,
  },
  // Ensure React is available globally
  define: {
    global: 'globalThis',
  },
});
