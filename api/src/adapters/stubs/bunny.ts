// Seam de video protegido REAL (Bunny Stream). NO implementado en este slice.
// La firma de embeds de corta duración solo debe hacerse en el servidor con las claves
// de Bunny provistas por entorno. isPreview abre clase; el resto exige membresía vigente.
import { NotImplementedError } from '../interfaces.js';

export interface VideoGateway {
  embedToken(cursoId: string, n: number): Promise<{ embedUrl: string }>;
}

export class BunnyGatewayStub implements VideoGateway {
  async embedToken(_cursoId: string, _n: number): Promise<{ embedUrl: string }> {
    throw new NotImplementedError('firma de embed de Bunny Stream. Requiere BUNNY_STREAM_* por entorno.');
  }
}
