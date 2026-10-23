import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function fixture(modo = 'demo', apiData = { reportes: [], perfiles: [] }) {
  const exports = {};
  const store = new Map();
  const mocks = {
    '../core/datos': {
      Datos: {
        modo,
        config: () => ({ precioMensual: 499, precioAnual: 4990, descuentoVIP: 20 }),
      },
    },
    '../ui/partials': {
      esc: (s) => String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])),
    },
    './shell': {
      adminHead: (t, s) => `<div class="admin-head"><h1>${t}</h1><p>${s}</p></div>`,
    },
    './contenido': {
      vacio: (t, d) => `<div class="vacio"><h3>${t}</h3><p>${d}</p></div>`,
    },
    './remoto': {
      AdminRemoto: {
        reportesDirectorio: () => apiData.reportes,
        perfilesDirectorio: () => apiData.perfiles,
      },
    },
  };

  const src = fs.readFileSync(new URL('../src/admin/directorio.ts', import.meta.url), 'utf8');
  vm.runInNewContext(
    ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText,
    {
      exports,
      require: (n) => mocks[n] || {},
      localStorage: {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => { store.set(k, String(v)); },
        removeItem: (k) => { store.delete(k); },
      },
      Date,
      JSON,
      Array,
      Map,
      String,
    }
  );
  return { exports, store };
}

test('adminDirectorio renderiza KPIs, denuncias y tabla de cosmetólogas', () => {
  const { exports } = fixture('demo');
  const html = exports.adminDirectorio();

  assert.match(html, /Directorio Clínico (&|&amp;) Red Profesional/);
  assert.match(html, /Denuncias pendientes/);
  assert.match(html, /Especialistas en el Directorio Dermalysse/);
  assert.match(html, /data-admin-reporte-descartar/);
  assert.match(html, /data-admin-reporte-ocultar/);
  assert.match(html, /data-admin-perfil-toggle/);
  assert.match(html, /Lic\. Sofía Valenzuela/);
  assert.match(html, /HIFU/);
});

test('adminDirectorio en modo API utiliza los datos de AdminRemoto', () => {
  const mockReportes = [
    {
      id: 'rep-api-1',
      reportanteUid: 'u-123',
      tipo: 'perfil',
      objetivoId: 'u-456',
      motivo: 'spam',
      detalle: 'Spam sobre productos no autorizados por COFEPRIS.',
      resumenObjetivo: 'Dra. Prueba',
      autorUid: 'u-456',
      estado: 'pendiente',
      creado: new Date().toISOString(),
      actualizado: new Date().toISOString(),
    },
  ];
  const mockPerfiles = [
    {
      uid: 'u-456',
      nombre: 'Dra. Prueba',
      titular: 'Cosmiatra Especialista en Láser',
      etapa: 'cosmiatra',
      especialidades: ['Láser Diodo'],
      aparatologia: ['Láser Diodo'],
      ciudad: 'Zapopan',
      estado: 'Jalisco',
      visible: true,
      actualizado: new Date().toISOString(),
    },
  ];

  const { exports } = fixture('api', { reportes: mockReportes, perfiles: mockPerfiles });
  const html = exports.adminDirectorio();

  assert.match(html, /Spam comercial/);
  assert.match(html, /Spam sobre productos no autorizados por COFEPRIS\./);
  assert.match(html, /Dra\. Prueba/);
  assert.match(html, /Láser Diodo/);
});
