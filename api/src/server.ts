// Arranque. Puerto por env (default 8787). Valida la configuración y falla rápido con un mensaje
// claro (solo nombres de variables). En modo firebase, firebase-admin se conecta en la primera petición.
import type { Express } from 'express';
import { buildApp } from './app.js';
import { ErrorConfiguracion } from './config.js';

const port = Number(process.env.PORT) || 8787;
let app: Express;
try {
  app = buildApp();
} catch (e) {
  if (e instanceof ErrorConfiguracion) {
    console.error(`[api] ${e.message}\n[api] Revisa api/.env.example y api/README.md. El servidor no arrancó.`);
    process.exit(1);
  }
  throw e;
}

app.listen(port, () => {
  console.log(`[api] dermalysse-api escuchando en el puerto ${port} (AUTH_MODE=${process.env.AUTH_MODE || 'dev'}, DATA_MODE=${process.env.DATA_MODE || 'memoria'})`);
});
