import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const juegos = JSON.parse(readFileSync(join(root, 'src/data/rompecabezas-clase.json'), 'utf8'));
const catalogo = JSON.parse(readFileSync(join(root, 'src/data/catalogo.json'), 'utf8'));
const cursos = Array.isArray(catalogo) ? catalogo : catalogo.cursos;

test('los rompecabezas apuntan a clases reales y tienen imágenes publicables', () => {
  assert.equal(juegos.length, 3);
  assert.equal(new Set(juegos.map((juego) => juego.id)).size, juegos.length, 'cada juego necesita un id único');
  assert.equal(new Set(juegos.map((juego) => `${juego.cursoId}:${juego.claseN}`)).size, juegos.length, 'cada clase puede tener un solo juego');

  for (const juego of juegos) {
    const curso = cursos.find((item) => item.id === juego.cursoId);
    assert.ok(curso, `curso inexistente: ${juego.cursoId}`);
    assert.ok(curso.clases.some((clase) => clase.n === juego.claseN), `clase inexistente: ${juego.cursoId}:${juego.claseN}`);
    assert.match(juego.imagen, /^\/juegos\/rompecabezas\/[a-z0-9-]+\.png$/);
    const imagen = join(root, 'public', juego.imagen.slice(1));
    assert.ok(existsSync(imagen), `falta la imagen ${juego.imagen}`);
    assert.ok(statSync(imagen).size > 100_000, `la imagen ${juego.imagen} parece incompleta`);
    for (const campo of ['titulo', 'descripcion', 'alt', 'cierre']) assert.ok(juego[campo]?.trim(), `falta ${campo} en ${juego.id}`);
  }
});
