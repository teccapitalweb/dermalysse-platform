// Limitador de tasa por ventana fija, en memoria, sin dependencias externas.
// Mismo espíritu que el resto del repo (CORS, auth y políticas escritas a mano):
// pequeño, puro y con reloj inyectable para probarlo de forma determinista.
//
// Cuenta peticiones por clave (por defecto la IP normalizada) dentro de una ventana.
// Al pasar el máximo responde 429 con el mismo código que ya usa la API
// ('demasiadas-solicitudes'), Retry-After y las cabeceras RateLimit-* (borrador IETF).
//
// Defensas del propio limitador (revisión de seguridad):
//  - Clave de IP CANÓNICA: la IPv6 se valida y se EXPANDE a 8 hextets antes de tomar el /64, para
//    que dos escrituras del mismo prefijo (p. ej. "2001:db8::1" y "2001:db8:0:0:0:0:0:1") no caigan
//    en claves distintas (parser differential). Las formas IPv4-mapeadas (::ffff:a.b.c.d) se reducen
//    a IPv4. Se quita el zone id (fe80::1%eth0).
//  - Memoria ACOTADA sin reset explotable: hay una cota dura de claves (maxClaves). Cuando el mapa se
//    llena NO se expulsan contadores activos (expulsar al más antiguo permitiría a un atacante, con un
//    flood de claves nuevas, reiniciar el contador de una víctima). En su lugar las claves nuevas caen
//    en un ÚNICO cubo de desborde compartido (fail-closed): comparten presupuesto, y los contadores ya
//    existentes se preservan. El barrido de vencidas se amortiza (a lo sumo una vez por ventana), nunca
//    es un escaneo por petición.
//
// No sustituye a un WAF ni a un almacén compartido entre instancias; es una primera barrera por
// instancia. Para rutas con sesión (p. ej. /cupones/canjear) un límite adicional por uid sería más
// fino, pero exige correr tras la autenticación; aquí el limitador va antes de auth, a propósito,
// para ser barato y frenar también a clientes sin sesión.
import { isIP } from 'node:net';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

export interface OpcionesRateLimit {
  /** Tamaño de la ventana en milisegundos. */
  ventanaMs: number;
  /** Peticiones permitidas por ventana y por clave. */
  max: number;
  /** Reloj inyectable (ms). Por defecto Date.now. */
  ahora?: () => number;
  /** Identidad del solicitante. Por defecto la IP canónica (IPv6 por /64). */
  clave?: (req: Request) => string;
  /** Cota dura de claves distintas en memoria (default 20000). Evita DoS por memoria. */
  maxClaves?: number;
  /** Código de error en el cuerpo del 429. */
  codigo?: string;
  /** Mensaje del 429. */
  mensaje?: string;
}

interface Entrada {
  conteo: number;
  reinicioEn: number;
}

/** Clave del cubo de desborde (fail-closed) cuando el mapa está lleno de contadores activos. */
const DESBORDE = '__desborde__';

/**
 * Expande una IPv6 (ya validada por net.isIP) a sus 8 hextets normalizados (hex en minúsculas, sin
 * ceros a la izquierda). Maneja la compresión "::" y una posible IPv4 embebida al final. null si no cuadra.
 */
function expandirIPv6(ip: string): string[] | null {
  let s = ip;
  // IPv4 embebida (incl. ::ffff:a.b.c.d): convertir el sufijo IPv4 a dos hextets.
  const emb = s.match(/^(.*:)((?:\d{1,3}\.){3}\d{1,3})$/);
  if (emb) {
    const oct = emb[2].split('.').map((o) => Number(o));
    if (oct.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return null;
    const h1 = ((oct[0] << 8) | oct[1]).toString(16);
    const h2 = ((oct[2] << 8) | oct[3]).toString(16);
    s = `${emb[1]}${h1}:${h2}`;
  }
  const partes = s.split('::');
  if (partes.length > 2) return null;
  const izq = partes[0] ? partes[0].split(':') : [];
  const der = partes.length === 2 ? (partes[1] ? partes[1].split(':') : []) : [];
  let todos: string[];
  if (partes.length === 1) {
    todos = izq;
  } else {
    const faltan = 8 - (izq.length + der.length);
    if (faltan < 0) return null;
    todos = [...izq, ...Array(faltan).fill('0'), ...der];
  }
  if (todos.length !== 8) return null;
  const norm: string[] = [];
  for (const h of todos) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(h)) return null;
    norm.push(parseInt(h, 16).toString(16));
  }
  return norm;
}

/**
 * Clave por defecto a partir de la IP:
 *  - IPv4 (incluida la forma IPv4-mapeada ::ffff:a.b.c.d): la dirección completa.
 *  - IPv6: el prefijo /64 (primeros 4 hextets expandidos), para que rotar los 64 bits bajos —o
 *    reescribir la dirección de otra forma— no evada el límite.
 *  - Si no es una IP reconocible, se usa el valor crudo como clave (no se agrupa).
 */
export function clavePorIp(req: Request): string {
  const bruto = (req.ip ?? '').trim();
  if (!bruto) return 'desconocida';
  const ip = bruto.replace(/%.*$/, ''); // quitar zone id (p. ej. fe80::1%eth0)
  const version = isIP(ip);
  if (version === 4) return ip;
  if (version !== 6) return bruto;
  // IPv4-mapeada explícita → tratar como IPv4 (una sola clave por IPv4, no un /64 de ceros).
  const mapped = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (mapped && isIP(mapped[1]) === 4) return mapped[1];
  const hextets = expandirIPv6(ip);
  if (!hextets) return ip;
  // IPv4-mapeada en forma hex (::ffff:0102:0304) → reducir también a IPv4.
  if (hextets.slice(0, 5).every((h) => h === '0') && hextets[5] === 'ffff') {
    const a = parseInt(hextets[6], 16);
    const b = parseInt(hextets[7], 16);
    return `${a >> 8}.${a & 0xff}.${b >> 8}.${b & 0xff}`;
  }
  return `${hextets.slice(0, 4).join(':')}::/64`;
}

/** Crea un middleware de Express que limita la tasa por clave con ventana fija y memoria acotada. */
export function crearRateLimiter(opciones: OpcionesRateLimit): RequestHandler {
  const ventanaMs = Math.max(1, Math.floor(opciones.ventanaMs));
  const max = Math.max(1, Math.floor(opciones.max));
  const maxClaves = Math.max(1, Math.floor(opciones.maxClaves ?? 20_000));
  const ahora = opciones.ahora ?? (() => Date.now());
  const clave = opciones.clave ?? clavePorIp;
  const codigo = opciones.codigo ?? 'demasiadas-solicitudes';
  const mensaje = opciones.mensaje ?? 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.';
  const almacen = new Map<string, Entrada>();
  let ultimaLimpieza = Number.NEGATIVE_INFINITY;

  function purgarVencidas(t: number): void {
    for (const [k, v] of almacen) if (t >= v.reinicioEn) almacen.delete(k);
  }

  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const t = ahora();

    // Barrido de vencidas a lo sumo una vez por ventana: amortizado O(1) por petición, sin timers.
    if (t - ultimaLimpieza >= ventanaMs) {
      purgarVencidas(t);
      ultimaLimpieza = t;
    }

    let id = clave(req);
    let entrada = almacen.get(id);

    if (!entrada || t >= entrada.reinicioEn) {
      // Hace falta una entrada nueva (clave nueva o ventana vencida).
      if (!entrada && almacen.size >= maxClaves) {
        // Mapa lleno. No expulsar contadores activos (sería un reset explotable): la clave nueva
        // comparte el cubo de desborde (fail-closed). El barrido perezoso ya recupera vencidas; aquí
        // no se escanea, así que el camino de desborde es O(1).
        id = DESBORDE;
        entrada = almacen.get(id);
      }
      if (!entrada || t >= entrada.reinicioEn) {
        entrada = { conteo: 0, reinicioEn: t + ventanaMs };
        almacen.set(id, entrada);
      }
    }
    entrada.conteo += 1;

    const restantes = Math.max(0, max - entrada.conteo);
    const resetSeg = Math.max(0, Math.ceil((entrada.reinicioEn - t) / 1000));
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(restantes));
    res.setHeader('RateLimit-Reset', String(resetSeg));

    if (entrada.conteo > max) {
      res.setHeader('Retry-After', String(resetSeg));
      res.status(429).json({ error: codigo, mensaje, reintentarEn: resetSeg });
      return;
    }
    next();
  };
}
