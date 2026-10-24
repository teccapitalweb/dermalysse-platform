// Pruebas del limitador de tasa: unitarias (reloj inyectable, sin red) y una de integración
// que arma la app real con buildApp y la golpea por HTTP.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { NextFunction, Request, Response } from 'express';
import { crearRateLimiter, clavePorIp } from '../src/middleware/rateLimit.js';
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

test('clavePorIp: IPv4 completa, IPv4-mapeada reducida, IPv6 agrupada por /64', () => {
  assert.equal(clavePorIp(reqFalso('5.6.7.8')), '5.6.7.8');
  assert.equal(clavePorIp(reqFalso('::ffff:1.2.3.4')), '1.2.3.4');
  // Dos direcciones del mismo /64 (difieren solo en los 64 bits bajos) → misma clave.
  const a = clavePorIp(reqFalso('2001:db8:1:2:aaaa:bbbb:cccc:dddd'));
  const b = clavePorIp(reqFalso('2001:db8:1:2:1111:2222:3333:4444'));
  assert.equal(a, b);
  assert.equal(a, '2001:db8:1:2::/64');
  // Distinto /64 → clave distinta.
  assert.notEqual(clavePorIp(reqFalso('2001:db8:1:3::1')), a);
});

test('clavePorIp: formas distintas del MISMO /64 colapsan a una clave (sin parser differential)', () => {
  // "::" comprimido vs. expandido, y ceros a la izquierda: todas son el mismo /64.
  const formas = [
    '2001:db8::1',
    '2001:0db8:0:0:0:0:0:1',
    '2001:db8:0:0:abcd:ef01:2:3',
    '2001:db8::',
  ];
  const claves = formas.map((f) => clavePorIp(reqFalso(f)));
  for (const k of claves) assert.equal(k, '2001:db8:0:0::/64', `forma mal canonizada: ${k}`);
  // El zone id no cambia la clave.
  assert.equal(clavePorIp(reqFalso('2001:db8::1%eth0')), '2001:db8:0:0::/64');
  // Un /64 distinto no colisiona.
  assert.notEqual(clavePorIp(reqFalso('2001:db8:0:1::1')), '2001:db8:0:0::/64');
});

test('rotar los 64 bits bajos de IPv6 NO evade el límite', () => {
  const t = 0;
  const mw = crearRateLimiter({ ventanaMs: 60000, max: 2, ahora: () => t });
  const next: NextFunction = () => {};
  const direcciones = ['2001:db8:1:2::1', '2001:db8:1:2::2', '2001:db8:1:2::3']; // válidas, mismo /64
  const estados = direcciones.map((ip) => {
    const res = resFalso();
    mw(reqFalso(ip), res, next);
    return res._status;
  });
  // 2 permitidas y la 3ª bloqueada, aunque la IP completa sea distinta cada vez.
  assert.deepEqual(estados, [200, 200, 429]);
});

test('memoria llena: no reinicia contadores activos y reparte el desborde en varios cubos (sin lockout global)', () => {
  const t = 0;
  // maxClaves=1, max=1, clave = la IP tal cual. Una sola clave llena el mapa.
  const mw = crearRateLimiter({ ventanaMs: 60000, max: 1, maxClaves: 1, ahora: () => t, clave: (r) => (r as { ip: string }).ip });
  const next: NextFunction = () => {};
  const golpe = (ip: string) => { const res = resFalso(); mw(reqFalso(ip), res, next); return res._status; };

  assert.equal(golpe('ACTIVA'), 200); // ocupa el único hueco (1/1); el mapa queda lleno

  // Muchas claves nuevas distintas caen en desborde. Al repartirse por hash en varios cubos, casi
  // todas pasan: NO hay un único cubo global que las bloquee a todas (ese era el lockout global).
  let exitos = 0;
  for (let i = 0; i < 50; i += 1) if (golpe(`nuevo-${i}`) === 200) exitos += 1;
  assert.ok(exitos >= 40, `el desborde debe repartirse (exitos=${exitos}); un cubo global daría ~1`);

  // El contador activo se preserva: su 2º golpe sigue contando → 429 (el desborde no lo reinició).
  assert.equal(golpe('ACTIVA'), 429, 'el contador activo no debe reiniciarse');
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
