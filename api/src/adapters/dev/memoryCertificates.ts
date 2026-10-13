// Certificados emitidos en MEMORIA (modo dev). Idempotente por uid+cursoId.
import type { CertificateStore } from '../interfaces.js';
import type { CertificadoRemoto } from '../../domain/types.js';

export class MemoryCertificateStore implements CertificateStore {
  private readonly porFolioMap = new Map<string, CertificadoRemoto>();

  async listar(uid: string): Promise<CertificadoRemoto[]> {
    return [...this.porFolioMap.values()]
      .filter((c) => c.uid === uid)
      .sort((a, b) => b.emitido.localeCompare(a.emitido));
  }

  async porFolio(folio: string): Promise<CertificadoRemoto | null> {
    return this.porFolioMap.get(folio.toUpperCase()) ?? null;
  }

  async emitir(cert: CertificadoRemoto): Promise<CertificadoRemoto> {
    // Idempotente: si ya hay uno para este uid+curso, devuélvelo (no dupliques folios).
    const existente = [...this.porFolioMap.values()].find((c) => c.uid === cert.uid && c.cursoId === cert.cursoId);
    if (existente) return existente;
    this.porFolioMap.set(cert.folio.toUpperCase(), cert);
    return cert;
  }
}
