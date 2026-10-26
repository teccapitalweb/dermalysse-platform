import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const catalogo = JSON.parse(await readFile(path.join(root, 'src/data/catalogo.json'), 'utf8'));
const quizzes = JSON.parse(await readFile(path.join(root, 'src/data/quizzes-demo.json'), 'utf8'));
const portadasMateriales = JSON.parse(await readFile(path.join(root, 'src/data/materiales-portadas.json'), 'utf8'));

test('el catálogo usa los 12 cursos publicados de Dermalysse', () => {
  assert.equal(catalogo.cursos.length, 12);
  assert.ok(catalogo.cursos.every((curso) => curso.publicado && curso.titulo && curso.area));
});

test('los 45 cursos/clases conservan una sola primera clase abierta', () => {
  const clases = catalogo.cursos.flatMap((curso) => curso.clases);
  assert.equal(clases.length, 45);
  for (const curso of catalogo.cursos) {
    assert.ok(curso.clases.length > 0, `${curso.id} debe incluir clases`);
    assert.equal(curso.clases.filter((clase) => clase.gratis).length, 1, `${curso.id} debe tener una clase abierta`);
    assert.equal(curso.clases[0].gratis, true, `la primera clase de ${curso.id} debe ser abierta`);
  }
});

test('cada clase tiene un quiz aprobado con preguntas válidas', () => {
  const cursos = new Map(catalogo.cursos.map((curso) => [curso.id, curso]));
  const claves = new Set();
  assert.equal(quizzes.length, 45);
  for (const quiz of quizzes) {
    const curso = cursos.get(quiz.cursoId);
    assert.ok(curso, `curso desconocido en ${quiz.id}`);
    assert.equal(quiz.estado, 'aprobado', `${quiz.id} debe estar aprobado`);
    assert.ok(curso.clases.some((clase) => clase.n === quiz.n), `clase desconocida en ${quiz.id}`);
    const clave = `${quiz.cursoId}:${quiz.n}`;
    assert.ok(!claves.has(clave), `quiz duplicado para ${clave}`);
    claves.add(clave);
    assert.ok(Array.isArray(quiz.preguntas) && quiz.preguntas.length > 0, `${quiz.id} necesita preguntas`);
    for (const pregunta of quiz.preguntas) {
      assert.ok(pregunta.q?.trim(), `${quiz.id} contiene una pregunta vacía`);
      assert.ok(Array.isArray(pregunta.opciones) && pregunta.opciones.length >= 2, `${quiz.id} necesita opciones`);
      assert.ok(Number.isInteger(pregunta.correcta) && pregunta.correcta >= 0 && pregunta.correcta < pregunta.opciones.length, `${quiz.id} tiene una respuesta fuera de rango`);
      assert.ok(pregunta.explicacion?.trim(), `${quiz.id} necesita explicación educativa`);
    }
  }
  assert.equal(claves.size, 45);
});

test('las clases demo no incluyen identificadores productivos', () => {
  assert.equal(catalogo.libraryId, '');
  assert.ok(catalogo.cursos.every((curso) => curso.bunnyCollectionId === ''));
  assert.ok(catalogo.cursos.flatMap((curso) => curso.clases).every((clase) => clase.videoId === ''));
});

test('todas las portadas locales son imágenes utilizables', async () => {
  for (const curso of catalogo.cursos) {
    assert.match(curso.portada, /^\/(?:media|cursos)\/[a-z0-9][a-z0-9._/-]*\.(?:avif|webp|png|jpe?g)$/i);
    assert.doesNotMatch(curso.portada, /\.\./);
    const info = await stat(path.join(root, 'public', curso.portada.slice(1)));
    assert.ok(info.size > 10_000, `${curso.portada} debe contener una imagen real`);
  }
});

test('los materiales heredados con portada faltante tienen una imagen editorial local', async () => {
  assert.equal(Object.keys(portadasMateriales).length, 7);
  for (const [id, portada] of Object.entries(portadasMateriales)) {
    assert.match(id, /^p-\d+$/);
    assert.match(portada, /^\/materiales\/portadas\/[a-z0-9][a-z0-9._/-]*\.(?:webp|png|jpe?g)$/i);
    assert.doesNotMatch(portada, /\.\./);
    const info = await stat(path.join(root, 'public', portada.slice(1)));
    assert.ok(info.size > 10_000, `${portada} debe contener una imagen real`);
  }
});

test('landing y club permanecen como entradas independientes', async () => {
  const landing = await readFile(path.join(root, 'index.html'), 'utf8');
  const club = await readFile(path.join(root, 'club/index.html'), 'utf8');
  assert.match(landing, /src\/site\/main\.ts/);
  assert.match(club, /src\/main\.ts/);
});
