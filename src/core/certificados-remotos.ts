import { api } from './auth';

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

export async function cargarCertificados(forzar = false) {
  if (cache && !forzar) return cache;
  if (carga && !forzar) return carga;
  carga = api<CertificadoRemoto[]>('/certificados')
    .then((lista) => {
      cache = Array.isArray(lista) ? lista : [];
      return cache;
    })
    .finally(() => { carga = null; });
  return carga;
}

export function registrarCertificado(certificado: CertificadoRemoto) {
  if (!certificado?.folio) return;
  const actuales = cache ?? [];
  cache = [certificado, ...actuales.filter((c) => c.folio !== certificado.folio)];
}

export function limpiarCertificados() {
  cache = null;
  carga = null;
}
