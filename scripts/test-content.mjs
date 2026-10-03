import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const content = JSON.parse(await readFile(new URL('src/data/landing.json', root), 'utf8'));
const html = await readFile(new URL('index.html', root), 'utf8');
const render = await readFile(new URL('src/landing/render.ts', root), 'utf8');

test('usa la marca oficial Dermalysse', () => {
  assert.equal(content.brand.name, 'Dermalysse');
  assert.match(html, /lang="es"/);
  assert.match(html, /Dermalysse — The Skin Edit/);
});

test('conserva los cuatro cursos destacados confirmados', () => {
  assert.equal(content.courses.length, 4);
  assert.equal(new Set(content.courses.map((course) => course.title)).size, 4);
  content.courses.forEach((course) => {
    assert.ok(course.image.startsWith('/media/'));
    assert.ok(course.alt.length > 12);
    assert.ok(course.tags.length >= 3);
  });
});

test('no publica precios ni testimonios no validados', () => {
  const serialized = JSON.stringify(content).toLowerCase();
  assert.doesNotMatch(serialized, /\$\s*\d|precio|testimonial|garantiza|cura/);
});

test('la experiencia local no enlaza cuentas o pagos reales', () => {
  assert.match(render, /data-local-cta/);
  assert.doesNotMatch(render, /stripe|firebase|create-checkout|club\.dermalyssemx\.com/);
});

test('incluye estructura accesible para navegacion y vista previa', () => {
  assert.match(html, /Saltar al contenido/);
  assert.match(render, /aria-label="Navegación principal"/);
  assert.match(render, /<dialog/);
  assert.match(render, /<track kind="captions"/);
});
