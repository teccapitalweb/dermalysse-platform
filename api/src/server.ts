// Arranque local. Puerto por env (default 8787). No conecta a servicios externos.
import { buildApp } from './app.js';

const port = Number(process.env.PORT) || 8787;
const app = buildApp();

app.listen(port, () => {
  console.log(`[api] dermalysse-api escuchando en http://localhost:${port} (AUTH_MODE=${process.env.AUTH_MODE || 'dev'})`);
});
