// Funciones del club que dependen de una decisión comercial o de un backend que aún no existe en
// producción. ÚNICA fuente para decidir «¿está disponible?»:
//  - Modo demo (sin VITE_API_URL): TODO disponible, exactamente como siempre.
//  - Modo API (producción): solo lo marcado `true` en EN_PRODUCCION.
// Para habilitar una función en producción basta con cambiar su valor a `true` aquí (y desplegar el
// backend que se indica). Uso: `disponible('recompensas')` desde src/core/plataforma.ts.
// Módulo puro (sin imports) para poder probarlo con node --test.

export type ModoClub = 'api' | 'demo';

export const FUNCIONES = {
  recompensas: {
    nombre: 'Recompensas',
    // Página #/recompensas, enlace en la barra lateral, «Más» y accesos de Inicio; botón «Canjear».
    backend: 'GET /recompensas · POST /recompensas/:id/canjear',
    motivo: 'Otorga días VIP con las reglas aprobadas por el propietario (api/src/services/recompensas.ts).',
  },
  cupones: {
    nombre: 'Canje de cupones',
    // Formulario «¿Tienes un cupón de acceso?» en #/suscripcion.
    backend: 'POST /cupones/canjear',
    motivo: 'Otorga días VIP con cupones creados por el admin (api/src/services/cupones.ts).',
  },
  experiencia: {
    nombre: 'Bienvenida y encuestas',
    // Rutas #/bienvenida y #/encuestas, redirección automática a la bienvenida, tarjeta de invitación
    // en Inicio, resumen en Mi perfil y accesos en «Más».
    backend: 'GET /me/experiencia · PATCH /me/entrevista|encuesta · POST /me/experiencia/iniciar|sesion · POST /me/{flujo}/posponer|completar',
    // Encendida: backend en api/src/modulos/experiencia.ts. Los días VIP solo se otorgan con una campaña
    // aprobada y habilitada en /admin/experiencia (v2_config/experiencia); sin ella no se promete premio.
    motivo: 'Su beneficio de bienvenida otorga días VIP: requiere campaña aprobada por el propietario.',
  },
  adminGestion: {
    nombre: 'Administración completa en el club nuevo',
    // Resumen, Cursos, Materiales, En vivo, Quizzes, Miembros, Cupones, Entrevistas y encuestas,
    // Comunidad, Avisos y Ajustes. «Academia» (revisión editorial) siempre está disponible.
    backend: 'GET/POST/PATCH /admin/* (excepto /admin/academia)',
    motivo: 'Sin backend en producción: se sigue usando el panel admin actual.',
  },
} as const;

export type Funcion = keyof typeof FUNCIONES;

/** Interruptores de producción. `true` = visible y activa con VITE_API_URL. */
export const EN_PRODUCCION: Record<Funcion, boolean> = {
  recompensas: true,
  cupones: true,
  experiencia: true,
  adminGestion: true,
};

/** ¿La función está disponible en este modo? En demo todo sigue disponible. */
export function disponibleEn(funcion: Funcion, modo: ModoClub, interruptores: Record<Funcion, boolean> = EN_PRODUCCION): boolean {
  return modo === 'demo' || interruptores[funcion] === true;
}

/** Ruta del club que pertenece a una función (para el guard del router). null si no está regulada. */
export function funcionDeRuta(path: string): Funcion | null {
  if (/^\/recompensas(\/|$)/.test(path)) return 'recompensas';
  if (/^\/(bienvenida|encuestas)(\/|$)/.test(path)) return 'experiencia';
  if (/^\/admin(\/|$)/.test(path) && !/^\/admin\/academia(\/|$)/.test(path)) return 'adminGestion';
  return null;
}

/**
 * URL del panel admin actual (repo teccapitalweb/admin_club_dermalysse) para todo lo que el admin nuevo
 * aún no cubre en producción. Viene de VITE_ADMIN_LEGADO_URL; solo se acepta https. null si no hay.
 */
export function urlAdminLegado(valor: unknown): string | null {
  if (typeof valor !== 'string' || !valor.trim()) return null;
  try {
    const u = new URL(valor.trim());
    return u.protocol === 'https:' && !u.username && !u.password ? u.toString() : null;
  } catch {
    return null;
  }
}
