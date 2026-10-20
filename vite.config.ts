import { defineConfig } from 'vite';

// Se sirve en la RAÍZ del dominio custom (www.dermalyssemx.com) vía GitHub Pages.
// base '/' tanto en dev como en build; el CNAME vive en public/ y Vite lo copia a dist/.
export default defineConfig(() => ({
  base: '/',
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
