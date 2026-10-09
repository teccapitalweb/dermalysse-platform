import { defineConfig } from 'vite';

// En dev y preview local vive en la raíz. En GitHub Pages vive bajo /dermalysse-platform/.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/dermalysse-platform/' : '/',
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
}));
