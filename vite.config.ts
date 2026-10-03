import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      input: {
        landing: 'index.html',
        club: 'club/index.html',
      },
    },
  },
});
