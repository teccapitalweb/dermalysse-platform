import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const leer = (ruta) => readFile(new URL(ruta, root), 'utf8');

async function png(ruta) {
  const archivo = new URL(ruta, root);
  const datos = await readFile(archivo);
  assert.equal(datos.subarray(1, 4).toString('ascii'), 'PNG', `${ruta} debe ser PNG`);
  return {
    width: datos.readUInt32BE(16),
    height: datos.readUInt32BE(20),
    bytes: (await stat(archivo)).size,
  };
}

test('el manifiesto abre el Club desde el dominio raíz y usa iconos instalables', async () => {
  const manifest = JSON.parse(await leer('public/manifest.webmanifest'));

  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/#/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');

  const iconos = new Map(manifest.icons.map((icono) => [icono.src, icono]));
  assert.equal(iconos.get('/brand/dermalysse-app-icon-192.png')?.sizes, '192x192');
  assert.equal(iconos.get('/brand/dermalysse-app-icon-512.png')?.sizes, '512x512');
  assert.equal(iconos.get('/brand/dermalysse-app-icon-maskable-512.png')?.purpose, 'maskable');
});

test('los iconos Dermalysse tienen dimensiones reales para navegador, iPhone y Android', async () => {
  for (const [ruta, lado] of [
    ['public/brand/dermalysse-app-icon-64.png', 64],
    ['public/brand/dermalysse-app-icon-180.png', 180],
    ['public/brand/dermalysse-app-icon-192.png', 192],
    ['public/brand/dermalysse-app-icon-512.png', 512],
    ['public/brand/dermalysse-app-icon-maskable-512.png', 512],
  ]) {
    const imagen = await png(ruta);
    assert.deepEqual([imagen.width, imagen.height], [lado, lado], `${ruta} debe medir ${lado}x${lado}`);
    assert.ok(imagen.bytes > 1_000, `${ruta} no debe estar vacío`);
  }
});

test('el manifiesto ofrece una instalación enriquecida con capturas móviles reales', async () => {
  const manifest = JSON.parse(await leer('public/manifest.webmanifest'));

  assert.match(manifest.description, /Cursos/);
  assert.equal(manifest.screenshots.length, 3);
  for (const captura of manifest.screenshots) {
    assert.equal(captura.form_factor, 'narrow');
    assert.equal(captura.type, 'image/png');
    assert.equal(captura.sizes, '720x1280');
    assert.ok(captura.label, `${captura.src} debe explicar la vista`);
    const imagen = await png(`public${captura.src}`);
    assert.deepEqual([imagen.width, imagen.height], [720, 1280], `${captura.src} debe medir 720x1280`);
    assert.ok(imagen.bytes > 100_000, `${captura.src} debe contener una vista real de la aplicación`);
  }
});

test('el Club publica icono iOS, manifiesto y acceso visible para instalar la app', async () => {
  const [html, shell, cuenta, css, sw] = await Promise.all([
    leer('club/index.html'),
    leer('src/ui/shell.ts'),
    leer('src/pages/cuenta.ts'),
    leer('src/styles/components.css'),
    leer('public/sw.js'),
  ]);

  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon" sizes="180x180"/);
  assert.match(shell, /class="install-card" data-install/);
  assert.match(shell, /data-install-btn/);
  assert.match(cuenta, /Instalar app Dermalysse/);
  assert.match(cuenta, /data-install data-install-btn/);
  assert.match(css, /@media \(display-mode: standalone\)[\s\S]*\[data-install\]/);
  assert.match(sw, /dermalysse-app-icon-192\.png/);
  assert.match(sw, /dermalysse-app-icon-maskable-512\.png/);
});
