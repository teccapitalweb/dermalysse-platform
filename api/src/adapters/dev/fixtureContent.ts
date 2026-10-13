// Adaptador de contenido en modo DEV: lee fixtures NO productivos de api/fixtures.
// No contiene URLs premium, IDs de video reales ni secretos.
import { readFileSync } from 'node:fs';
import type { ContentStore } from '../interfaces.js';
import type {
  CatalogoRemoto, ConfigPublica, DetalleRemoto, HiloRemoto, Noticia,
} from '../../domain/types.js';

function cargarFixture<T>(nombre: string): T {
  const url = new URL(`../../../fixtures/${nombre}`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')) as T;
}

export class FixtureContentStore implements ContentStore {
  async config(): Promise<ConfigPublica> {
    const c = cargarFixture<CatalogoRemoto>('catalogo.json').config;
    return {
      precios: { mensual: c.precios.mensual, anual: c.precios.anual },
      descuentoVIP: c.descuentoVIP,
      contacto: { whatsappSoporte: c.whatsappSoporte, canalWhatsApp: c.canalWhatsApp },
    };
  }

  async catalogo(): Promise<CatalogoRemoto> {
    return cargarFixture<CatalogoRemoto>('catalogo.json');
  }

  async noticias(): Promise<Noticia[]> {
    return cargarFixture<{ noticias: Noticia[] }>('noticias.json').noticias;
  }

  async foro(): Promise<HiloRemoto[]> {
    // El cliente espera el conteo de respuestas, no el arreglo.
    return cargarFixture<DetalleRemoto[]>('foro.json')
      .filter((d) => !d.hilo.oculto)
      .map((d) => ({ ...d.hilo, respuestas: d.respuestas.length }));
  }

  async hilo(id: string): Promise<DetalleRemoto | null> {
    const detalle = cargarFixture<DetalleRemoto[]>('foro.json').find((d) => d.hilo.id === id);
    if (!detalle || detalle.hilo.oculto) return null;
    return { hilo: { ...detalle.hilo, respuestas: detalle.respuestas.length }, respuestas: detalle.respuestas };
  }
}
