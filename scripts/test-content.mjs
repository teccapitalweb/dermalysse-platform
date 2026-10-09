import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const catalogo = JSON.parse(await readFile(path.join(root, 'src/data/catalogo.json'), 'utf8'));

test('el catálogo usa los 12 cursos publicados de Dermalysse', () => {
  assert.equal(catalogo.cursos.length, 12);
  assert.ok(catalogo.cursos.every((curso) => curso.publicado && curso.titulo && curso.area));
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

test('landing y club permanecen como entradas independientes', async () => {
  const landing = await readFile(path.join(root, 'index.html'), 'utf8');
  const club = await readFile(path.join(root, 'club/index.html'), 'utf8');
  assert.match(landing, /src\/site\/main\.ts/);
  assert.match(club, /src\/main\.ts/);
});
