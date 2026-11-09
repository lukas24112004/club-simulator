import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built game works from GitHub Pages (/club-simulator/) and itch.io.
  base: './',
  build: {
    chunkSizeWarningLimit: 2000, // Phaser itself is large
  },
});
