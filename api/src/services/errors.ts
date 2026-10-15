// Errores de dominio → el manejador de errores de Express los mapea a estados HTTP honestos.
export class ValidationError extends Error {
  readonly code = 'VALIDATION'; // ⇒ 400
  constructor(message: string) { super(message); this.name = 'ValidationError'; }
}

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND'; // ⇒ 404
  constructor(message: string) { super(message); this.name = 'NotFoundError'; }
}

export class ConflictError extends Error {
  readonly code = 'CONFLICT'; // ⇒ 409
  constructor(message: string) { super(message); this.name = 'ConflictError'; }
}

export class ForbiddenError extends Error {
  readonly code = 'FORBIDDEN'; // ⇒ 403
  constructor(message: string) { super(message); this.name = 'ForbiddenError'; }
}

/**
 * Error con estado y código propios (p. ej. 402 requiere_vip, 429 espera_examen).
 * Se responde como { error: codigo, mensaje }; el cliente decide la pantalla por `codigo`.
 */
export class CodedError extends Error {
  constructor(readonly status: number, readonly codigo: string, message: string) {
    super(message);
    this.name = 'CodedError';
  }
}
