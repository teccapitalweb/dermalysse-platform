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
