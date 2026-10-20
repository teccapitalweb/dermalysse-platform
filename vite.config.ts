import { defineConfig } from 'vite';

// En producción GitHub Pages usa el dominio propio del Club en la raíz.
// El valor por defecto conserva la vista previa del repositorio; el workflow establece `/`.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env.VITE_BASE_PATH || '/dermalysse-platform/') : '/',
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
