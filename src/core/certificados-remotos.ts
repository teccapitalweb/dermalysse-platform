import { api } from './auth';
import { curso as getCurso } from './catalogo';
import { Perfil } from './perfil';

export interface CertificadoRemoto {
  folio: string;
  uid: string;
  nombre: string;
  cursoId: string;
  cursoTitulo: string;
  area: string;
  clases: number;
  emitido: string;
}

let cache: CertificadoRemoto[] | null = null;
let carga: Promise<CertificadoRemoto[]> | null = null;
/** Emitidos en esta sesión: se conservan aunque la lista del servidor tarde en reflejarlos. */
const recientes = new Map<string, CertificadoRemoto>();

/**
 * El club actual guarda certificates/{code} con otra forma; la API los traduce, pero aquí se
 * completan con el catálogo los campos que falten para no pintar huecos.
 */
export function normalizarCertificado(valor: any): CertificadoRemoto | null {
  const folio = String(valor?.folio ?? valor?.code ?? '').trim().toUpperCase();
  if (!folio) return null;
  const cursoId = String(valor?.cursoId ?? valor?.courseId ?? '');
  const c = cursoId ? getCurso(cursoId) : undefined;
  return {
    folio,
    uid: String(valor?.uid ?? ''),
    nombre: String(valor?.nombre ?? valor?.name ?? '') || Perfil.get().nombre,
    cursoId,
    cursoTitulo: String(valor?.cursoTitulo ?? valor?.curso ?? valor?.courseTitle ?? '') || c?.titulo || 'Curso Dermalysse',
    area: String(valor?.area ?? '') || c?.area || 'Formación Dermalysse',
    clases: Number(valor?.clases ?? valor?.lessons) || c?.clases.length || 0,
    emitido: String(valor?.emitido ?? valor?.issuedAt ?? '') || new Date().toISOString(),
  };
}

export async function cargarCertificados(forzar = false) {
  if (cache && !forzar) return cache;
  if (carga && !forzar) return carga;
  carga = api<unknown[]>('/certificados')
    .then((lista) => {
      const remotos = (Array.isArray(lista) ? lista : []).map(normalizarCertificado).filter((c): c is CertificadoRemoto => !!c);
      cache = [...[...recientes.values()].filter((r) => !remotos.some((c) => c.folio === r.folio)), ...remotos];
      return cache;
    })
    .finally(() => { carga = null; });
  return carga;
}

export function registrarCertificado(certificado: CertificadoRemoto) {
  if (!certificado?.folio) return;
  recientes.set(certificado.folio, certificado);
  // Sin lista cargada no se crea una parcial: la próxima consulta trae todos y suma los recientes.
  if (!cache) return;
  cache = [certificado, ...cache.filter((c) => c.folio !== certificado.folio)];
}

/**
 * POST /certificados {cursoId}. El servidor (webhook del club actual) solo emite si todas las
 * clases están acreditadas (409 si falta alguna) y es idempotente: devuelve el mismo folio.
 */
export async function emitirCertificado(cursoId: string): Promise<CertificadoRemoto> {
  const respuesta = await api<unknown>('/certificados', { method: 'POST', json: { cursoId } });
  const cert = normalizarCertificado({ cursoId, ...(respuesta as object) });
  if (!cert) throw new Error('El servidor no devolvió el folio del certificado. Intenta de nuevo.');
  registrarCertificado(cert);
  return cert;
}

export function limpiarCertificados() {
  cache = null;
  carga = null;
  recientes.clear();
}
