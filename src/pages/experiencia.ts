import { paginaExperienciaHTML } from '../ui/experiencia';

/** Estado recuperado por el guard autenticado; nunca introduce datos demo en API. */
export function paginaBienvenida() { return paginaExperienciaHTML('entrevista'); }
export function paginaEncuestas() { return paginaExperienciaHTML('encuesta'); }
