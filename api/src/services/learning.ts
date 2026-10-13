// Lógica de "integridad de aprendizaje". El SERVIDOR es la autoridad:
//  - califica quizzes sin exponer respuestas correctas;
//  - acredita progreso con topes (clase previa + 85% del tiempo real, con tope al tiempo real);
//  - emite certificados solo si todas las clases están acreditadas.
import { randomBytes } from 'node:crypto';
import type { ContentStore, CertificateStore, LearningStore, ProgressStore } from '../adapters/interfaces.js';
import type {
  CertificadoRemoto, CursoRemoto, PreguntaPublica, ProgresoCurso, ResultadoQuiz, Usuario, VerificacionPublica,
} from '../domain/types.js';
import { ConflictError, NotFoundError, ValidationError } from './errors.js';

/** Umbral de aprobado del quiz (educativo). */
export const APROBADO_MIN = 0.7;
/** Fracción del tiempo real de la clase para considerarla completada. */
export const COMPLETION_RATIO = 0.85;

export interface ResultadoVista {
  progreso: ProgresoCurso;
  acreditada: boolean;
  certificado?: CertificadoRemoto;
}

export class LearningService {
  constructor(
    private readonly content: ContentStore,
    private readonly learning: LearningStore,
    private readonly progress: ProgressStore,
    private readonly certificates: CertificateStore,
  ) {}

  private async curso(cursoId: string): Promise<CursoRemoto> {
    const curso = (await this.content.catalogo()).cursos.find((c) => c.id === cursoId);
    if (!curso) throw new NotFoundError('El curso no existe.');
    return curso;
  }

  /** Preguntas PÚBLICAS de una clase: solo { q, opciones }. Sin respuesta correcta ni explicación. */
  async preguntasPublicas(cursoId: string, n: number): Promise<PreguntaPublica[]> {
    const quiz = await this.learning.quiz(cursoId, n);
    if (!quiz) throw new NotFoundError('No hay quiz para esa clase.');
    return quiz.preguntas.map((p) => ({ q: p.q, opciones: p.opciones }));
  }

  /** Califica en el servidor contra las respuestas almacenadas. NUNCA devuelve el índice correcto. */
  async calificar(cursoId: string, n: number, respuestas: unknown): Promise<ResultadoQuiz> {
    const quiz = await this.learning.quiz(cursoId, n);
    if (!quiz) throw new NotFoundError('No hay quiz para esa clase.');
    if (!Array.isArray(respuestas)) throw new ValidationError('Se espera un arreglo de respuestas.');

    const total = quiz.preguntas.length;
    let correctas = 0;
    const detalle = quiz.preguntas.map((p, i) => {
      const elegida = Number((respuestas as unknown[])[i]);
      const acertada = elegida === p.correcta;
      if (acertada) correctas += 1;
      return { acertada, explicacion: p.explicacion }; // sin `correcta`
    });

    return { correctas, total, aprobado: total > 0 && correctas / total >= APROBADO_MIN, detalle };
  }

  /**
   * Marca avance aplicando reglas de servidor. `segundos` = tiempo de reproducción reportado.
   * El servidor lo topa al tiempo real de la clase (el cuerpo no puede exceder ni declararse "completado").
   * Acredita solo si: (a) la clase previa ya está acreditada (salvo primera o clase abierta) y
   * (b) el tiempo topado alcanza COMPLETION_RATIO del tiempo real.
   */
  async marcarVista(usuario: Usuario, cursoId: string, n: number, segundos: unknown): Promise<ResultadoVista> {
    const curso = await this.curso(cursoId);
    const clase = curso.clases.find((k) => k.n === n);
    if (!clase) throw new NotFoundError('La clase no existe en este curso.');

    const numeros = curso.clases.map((k) => k.n).sort((a, b) => a - b);
    const esPrimera = n === numeros[0];
    const previa = numeros[numeros.indexOf(n) - 1];
    const progresoActual = await this.progress.curso(usuario.uid, cursoId);

    // Orden: exige la clase anterior salvo que sea la primera o una clase abierta (preview).
    if (!esPrimera && !clase.gratis && previa !== undefined && !progresoActual.vistas.includes(previa)) {
      throw new ConflictError('Debes acreditar la clase anterior antes de esta.');
    }

    // Tope de tiempo: el servidor nunca acredita más tiempo del real de la clase.
    const duracionSeg = (clase.duracionMin ?? 0) * 60;
    const reportado = Number.isFinite(Number(segundos)) ? Math.max(0, Number(segundos)) : 0;
    const acreditadoSeg = Math.min(reportado, duracionSeg);
    const completada = duracionSeg > 0 ? acreditadoSeg >= COMPLETION_RATIO * duracionSeg : reportado > 0;

    if (!completada) {
      // Honesto: no se acredita. El cuerpo no puede forzar "completado".
      return { progreso: progresoActual, acreditada: false };
    }

    const progreso = await this.progress.acreditar(usuario.uid, cursoId, n);
    const todas = numeros.every((k) => progreso.vistas.includes(k));
    const certificado = todas ? await this.emitirSiCorresponde(usuario, cursoId) : undefined;
    return { progreso, acreditada: true, certificado };
  }

  /** Emite el folio SOLO si todas las clases del curso están acreditadas. Idempotente. */
  async emitirCertificado(usuario: Usuario, cursoId: string): Promise<CertificadoRemoto> {
    const cert = await this.emitirSiCorresponde(usuario, cursoId);
    if (!cert) throw new ConflictError('Aún no completas todas las clases del curso.');
    return cert;
  }

  private async emitirSiCorresponde(usuario: Usuario, cursoId: string): Promise<CertificadoRemoto | undefined> {
    const curso = await this.curso(cursoId);
    const progreso = await this.progress.curso(usuario.uid, cursoId);
    const completadas = curso.clases.every((k) => progreso.vistas.includes(k.n));
    if (!completadas) return undefined;
    return this.certificates.emitir({
      folio: await this.folioUnico(),
      uid: usuario.uid,
      nombre: usuario.nombre,
      cursoId: curso.id,
      cursoTitulo: curso.titulo,
      area: curso.area,
      clases: curso.clases.length,
      emitido: new Date().toISOString(),
    });
  }

  /**
   * Folio con ~80 bits de entropía (no enumerable), en hex mayúsculas para que las
   * comparaciones case-insensitive del cliente no pierdan entropía. Verifica colisión
   * contra los folios ya emitidos y reintenta antes de rendirse.
   */
  private async folioUnico(): Promise<string> {
    const anio = new Date().getFullYear();
    for (let intento = 0; intento < 6; intento++) {
      const folio = `DRM-${anio}-${randomBytes(10).toString('hex').toUpperCase()}`;
      if (!(await this.certificates.porFolio(folio))) return folio;
    }
    throw new ConflictError('No se pudo generar un folio único. Intenta de nuevo.');
  }

  async certificadosDe(uid: string): Promise<CertificadoRemoto[]> {
    return this.certificates.listar(uid);
  }

  async progresoDe(uid: string) {
    return this.progress.del(uid);
  }

  /** Verificación PÚBLICA: sin uid ni email. Folio inexistente ⇒ { valido:false }. */
  async verificar(folio: string): Promise<VerificacionPublica> {
    const cert = await this.certificates.porFolio(folio);
    if (!cert) return { valido: false, folio, nombre: '', cursoTitulo: '', emitido: '' };
    return { valido: true, folio: cert.folio, nombre: cert.nombre, cursoTitulo: cert.cursoTitulo, emitido: cert.emitido };
  }
}
