import { Datos } from './datos';
import { Perfil } from './perfil';

export type CategoriaExperiencia = 'aprendizaje' | 'organizacion' | 'comunicacion' | 'trayectoria';

export interface ExperienciaCompartida {
  id: string;
  titulo: string;
  texto: string;
  categoria: CategoriaExperiencia;
  autor: string;
  anonima: boolean;
  fecha: string;
}

const KEY = 'dermalysse:experiencias-comunidad:v1';
const CATEGORIAS: CategoriaExperiencia[] = ['aprendizaje', 'organizacion', 'comunicacion', 'trayectoria'];

function leer(): ExperienciaCompartida[] {
  try {
    const valor = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(valor)) return [];
    return valor.filter((item): item is ExperienciaCompartida =>
      item && typeof item.id === 'string' && item.id.length <= 80
      && typeof item.titulo === 'string' && item.titulo.trim().length >= 4 && item.titulo.length <= 100
      && typeof item.texto === 'string' && item.texto.trim().length >= 20 && item.texto.length <= 900
      && CATEGORIAS.includes(item.categoria) && typeof item.autor === 'string' && item.autor.length <= 100
      && typeof item.anonima === 'boolean' && typeof item.fecha === 'string' && Number.isFinite(Date.parse(item.fecha)),
    );
  } catch { return []; }
}

export const DirectorioExperiencias = {
  local(): boolean { return Datos.modo === 'demo'; },
  listar(): ExperienciaCompartida[] {
    if (!this.local()) return [];
    return leer().sort((a, b) => b.fecha.localeCompare(a.fecha));
  },
  crear(titulo: string, texto: string, categoria: CategoriaExperiencia, anonima: boolean): ExperienciaCompartida {
    if (!this.local()) throw new Error('La publicación compartida requiere conexión con el servidor del directorio.');
    if (!CATEGORIAS.includes(categoria)) throw new Error('Selecciona una categoría válida.');
    const tituloLimpio = titulo.trim();
    const textoLimpio = texto.trim();
    if (tituloLimpio.length < 4 || tituloLimpio.length > 100) throw new Error('El título debe tener entre 4 y 100 caracteres.');
    if (textoLimpio.length < 20 || textoLimpio.length > 900) throw new Error('La experiencia debe tener entre 20 y 900 caracteres.');
    const nombre = Perfil.get().nombre.trim();
    const experiencia: ExperienciaCompartida = {
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      titulo: tituloLimpio,
      texto: textoLimpio,
      categoria,
      autor: anonima ? 'Miembro del club' : nombre || 'Miembro del club',
      anonima,
      fecha: new Date().toISOString(),
    };
    const anteriores = leer();
    try { localStorage.setItem(KEY, JSON.stringify([experiencia, ...anteriores].slice(0, 50))); }
    catch { throw new Error('No se pudo guardar la experiencia en este dispositivo.'); }
    return experiencia;
  },
};
