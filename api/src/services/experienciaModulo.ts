// Proyección del estado interno al DTO que consume el cliente. La respuesta
// derivada de las áreas del catálogo evita exponer datos ajenos: solo cursos
// publicados, metadatos neutros (sin URLs premium) y hasta cuatro sugerencias.
import type { ContentStore } from '../adapters/interfaces.js';
import type {
  ExperienciaDTO, ExperienciaUsuario, RecomendacionExperiencia,
} from '../domain/types.js';

export async function proyectarExperienciaDTO(u: ExperienciaUsuario, content: ContentStore): Promise<ExperienciaDTO> {
  const catalogo = await content.catalogo();
  const publicados = catalogo.cursos.filter((c) => c.publicado !== false);
  const areas = [...new Set(publicados.map((c) => c.area))];
  const elegidas = Array.isArray(u.entrevista.respuestas['areas'])
    ? (u.entrevista.respuestas['areas'] as unknown[]).filter((a): a is string => typeof a === 'string')
    : [];
  const recomendaciones: RecomendacionExperiencia[] = publicados
    .filter((c) => elegidas.length === 0 || elegidas.includes(c.area))
    .slice(0, 4)
    .map((c) => ({ id: c.id, titulo: c.titulo, area: c.area, nivel: c.nivel, portada: c.portada }));
  return {
    version: 1,
    fuente: 'api',
    cohorte: u.cohorte,
    primerAccesoEn: u.primerAccesoEn,
    areas,
    recomendaciones,
    entrevista: u.entrevista,
    encuesta: u.encuesta,
    beneficios: u.beneficios,
  };
}
