// Banco de quizzes en modo DEV: lee api/fixtures/quizzes.json (con respuestas, server-side).
// Las respuestas correctas NUNCA se exponen: solo las usa el servicio para calificar.
import { readFileSync } from 'node:fs';
import type { LearningStore } from '../interfaces.js';
import type { QuizFixture } from '../../domain/types.js';

export class FixtureLearningStore implements LearningStore {
  private readonly quizzes: QuizFixture[];

  constructor() {
    const url = new URL('../../../fixtures/quizzes.json', import.meta.url);
    this.quizzes = (JSON.parse(readFileSync(url, 'utf8')) as { quizzes: QuizFixture[] }).quizzes;
  }

  async quiz(cursoId: string, n: number): Promise<QuizFixture | null> {
    return this.quizzes.find((q) => q.cursoId === cursoId && q.n === n) ?? null;
  }
}
