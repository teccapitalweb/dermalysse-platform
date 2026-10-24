// Pruebas del limitador de tasa: unitarias (reloj inyectable, sin red) y una de integración
// que arma la app real con buildApp y la golpea por HTTP.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { NextFunction, Request, Response } from 'express';
import { crearRateLimiter } from '../src/middleware/rateLimit.js';
import { buildApp } from '../src/app.js';

// ── utilidades de prueba ──
function reqFalso(ip: string): Request {
  return { ip } as unknown as Request;
}
function resFalso(): Response & { _status: number; _body: unknown; _headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  const r = {
    _status: 200,
    _body: undefined as unknown,
    _headers: headers,
    setHeader(k: string, v: string) { headers[k] = String(v); },
    status(c: number) { r._status = c; return r; },
    json(b: unknown) { r._body = b; return r; },
  };
  return r as unknown as Response & { _status: number; _body: unknown; _headers: Record<string, string> };
}

test('permite hasta el máximo y bloquea la siguiente con 429', () => {
  let t = 1000;
  const mw = crearRateLimiter({ ventanaMs: 60000, max: 3, ahora: () => t });
  let pasadas = 0;
  const next: NextFunction = () => { pasadas += 1; };

  for (let i = 0; i < 3; i += 1) {
    const res = resFalso();
    mw(reqFalso('1.1.1.1'), res, next);
    assert.equal(res._status, 200, `petición ${i + 1} debería pasar`);
  }
  assert.equal(pasadas, 3);

  const res = resFalso();
  mw(reqFalso('1.1.1.1'), res, next);
  assert.equal(res._status, 429);
  assert.equal((res._body as { error: string }).error, 'demasiadas-solicitudes');
  assert.ok(res._headers['Retry-After'], 'debe enviar Retry-After');
  assert.equal(res._headers['RateLimit-Remaining'], '0');
  assert.equal(pasadas, 3, 'la petición bloqueada no llama a next');
});

test('la ventana se reinicia al avanzar el reloj', () => {
  let t = 0;
  const mw = crearRateLimiter({ ventanaMs: 10000, max: 1, ahora: () => t });
  const next: NextFunction = () => {};

  let res = resFalso();
  mw(reqFalso('2.2.2.2'), res, next);
  assert.equal(res._status, 200);

  res = resFalso();
  mw(reqFalso('2.2.2.2'), res, next);
  assert.equal(res._status, 429, 'segunda dentro de la ventana se bloquea');

  t += 10000; // la ventana vence
  res = resFalso();
  mw(reqFalso('2.2.2.2'), res, next);
  assert.equal(res._status, 200, 'tras vencer la ventana vuelve a permitir');
});

test('cada clave (IP) tiene su propio presupuesto', () => {
  const t = 0;
  const mw = crearRateLimiter({ ventanaMs: 60000, max: 1, ahora: () => t });
  const next: NextFunction = () => {};

  const resA = resFalso();
  mw(reqFalso('10.0.0.1'), resA, next);
  assert.equal(resA._status, 200);

  const resB = resFalso();
  mw(reqFalso('10.0.0.2'), resB, next);
  assert.equal(resB._status, 200, 'otra IP no comparte el contador');

  const resA2 = resFalso();
  mw(reqFalso('10.0.0.1'), resA2, next);
  assert.equal(resA2._status, 429);
});

// ── integración: la app real limita por HTTP ──
let server: Server;
let base = '';
before(async () => {
  const env = { RATE_LIMIT_MAX: '3', RATE_LIMIT_WINDOW_MS: '60000', RATE_LIMIT_SENSITIVE_MAX: '2', TRUST_PROXY: 'false' } as unknown as NodeJS.ProcessEnv;
  const app = buildApp(env);
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});
after(() => { server?.close(); });

test('límite global: la 4ª petición a / devuelve 429 honesto', async () => {
  for (let i = 0; i < 3; i += 1) {
    const r = await fetch(`${base}/`);
    assert.equal(r.status, 200, `petición ${i + 1}`);
  }
  const r = await fetch(`${base}/`);
  assert.equal(r.status, 429);
  assert.ok(r.headers.get('retry-after'), 'Retry-After presente');
  const body = await r.json() as { error: string };
  assert.equal(body.error, 'demasiadas-solicitudes');
});
