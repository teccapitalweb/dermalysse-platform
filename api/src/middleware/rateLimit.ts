// Limitador de tasa por ventana fija, en memoria, sin dependencias externas.
// Mismo espíritu que el resto del repo (CORS, auth y políticas escritas a mano):
// pequeño, puro y con reloj inyectable para probarlo de forma determinista.
//
// Cuenta peticiones por clave (por defecto la IP normalizada) dentro de una ventana.
// Al pasar el máximo responde 429 con el mismo código que ya usa la API
// ('demasiadas-solicitudes'), Retry-After y las cabeceras RateLimit-* (borrador IETF).
//
// Defensa contra DoS del propio limitador:
//  - Cota DURA de claves en memoria (maxClaves): al llenarse purga vencidas y, si no basta,
//    expulsa las más antiguas (LRU aproximado por orden de inserción). El mapa nunca crece sin límite.
//  - El barrido de vencidas se amortiza (a lo sumo una vez por ventana), no es un escaneo por petición.
//  - La IPv6 se agrupa por /64 y las formas IPv4-mapeadas (::ffff:a.b.c.d) se reducen a IPv4, para que
//    rotar direcciones (un atacante suele controlar un /64 entero) no evada el límite ni infle el mapa.
//
// No sustituye a un WAF ni a un almacén compartido entre instancias; es una primera barrera por
// instancia. Para rutas con sesión (p. ej. /cupones/canjear) un límite adicional por uid sería más
// fino, pero exige correr tras la autenticación; aquí el limitador va antes de auth, a propósito,
// para ser barato y frenar también a clientes sin sesión.
import type { NextFunction, Request, RequestHandler, Response } from 'express';

export interface OpcionesRateLimit {
  /** Tamaño de la ventana en milisegundos. */
  ventanaMs: number;
  /** Peticiones permitidas por ventana y por clave. */
  max: number;
  /** Reloj inyectable (ms). Por defecto Date.now. */
  ahora?: () => number;
  /** Identidad del solicitante. Por defecto la IP normalizada (IPv6 por /64). */
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

/**
 * Clave por defecto a partir de la IP:
 *  - IPv4 (incluida la forma IPv4-mapeada ::ffff:a.b.c.d): la dirección completa.
 *  - IPv6: el prefijo /64 (primeros 4 grupos), para que rotar los 64 bits bajos no evada el límite.
 */
export function clavePorIp(req: Request): string {
  const ip = (req.ip ?? '').trim();
  if (!ip) return 'desconocida';
  const sinPrefijo = ip.replace(/^::ffff:/i, ''); // IPv4 mapeada en IPv6
  if (!sinPrefijo.includes(':')) return sinPrefijo; // IPv4
  const grupos = sinPrefijo.split(':');
  return `${grupos.slice(0, 4).join(':')}::/64`;
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
    const id = clave(req);

    // Barrido de vencidas a lo sumo una vez por ventana: amortizado O(1) por petición, sin timers.
    if (t - ultimaLimpieza >= ventanaMs) {
      purgarVencidas(t);
      ultimaLimpieza = t;
    }

    let entrada = almacen.get(id);
    if (!entrada || t >= entrada.reinicioEn) {
      // Clave nueva y mapa en la cota: hacer sitio (vencidas y, si no basta, las más antiguas).
      if (!entrada && almacen.size >= maxClaves) {
        purgarVencidas(t);
        while (almacen.size >= maxClaves) {
          const masAntigua = almacen.keys().next().value;
          if (masAntigua === undefined) break;
          almacen.delete(masAntigua);
        }
      }
      entrada = { conteo: 0, reinicioEn: t + ventanaMs };
      almacen.delete(id); // reinsertar al final: el orden de inserción marca la antigüedad (LRU aprox.)
      almacen.set(id, entrada);
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
