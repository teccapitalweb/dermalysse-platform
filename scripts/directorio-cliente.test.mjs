import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function fixture(apiFn = async () => ({}), modo = 'demo') {
  const exports = {};
  const mocks = {
    './auth': { api: apiFn },
    './datos': { Datos: { modo } },
  };
  const store = new Map();
  const src = fs.readFileSync(new URL('../src/core/directorio.ts', import.meta.url), 'utf8');
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
      URL: {
        createObjectURL: () => 'blob:mock',
        revokeObjectURL: () => {},
      },
      URLSearchParams,
      structuredClone: (x) => JSON.parse(JSON.stringify(x)),
      Date,
      Map,
      JSON,
      Promise,
      Array,
    }
  );
  return exports;
}

test('directorio en modo API inicia vacío y nunca cae en perfiles demo', async () => {
  const remotoVacio = {
    perfiles: [], oportunidades: [], conexiones: [], miPerfil: null,
    paginacion: {
      perfiles: { hayMas: false, siguiente: null },
      oportunidades: { hayMas: false, siguiente: null },
      conexiones: { truncadas: false },
    },
  };
  const { Directorio } = fixture(async () => remotoVacio, 'api');

  assert.equal(Directorio.get().perfiles.length, 0);
  assert.equal(Directorio.get().oportunidades.length, 0);
  await Directorio.cargar();
  assert.equal(Directorio.get().perfiles.length, 0);
  assert.equal(Directorio.get().errorCarga, null);
});

test('fallo de API deja un error honesto sin datos de demostración', async () => {
  const { Directorio } = fixture(async () => { throw new Error('red caída'); }, 'api');

  await assert.rejects(() => Directorio.cargar(), /red caída/);
  assert.equal(Directorio.get().perfiles.length, 0);
  assert.equal(Directorio.get().oportunidades.length, 0);
  assert.match(Directorio.get().errorCarga, /directorio real/i);
});

test('directorio cosmetológico cliente maneja perfiles, aparatología y conexiones', async () => {
  const { Directorio } = fixture();

  const estado = Directorio.get();
  assert.ok(estado.perfiles.length >= 3, 'Debe incluir perfiles cosmetológicos demo');
  assert.ok(estado.oportunidades.length >= 2, 'Debe incluir oportunidades de cabinas/aparatología demo');

  // Conectar con perfil
  const nuevoEstado = await Directorio.conectar('demo-sofia', null, 'Hola, me gustaría solicitar una interconsulta para un paciente con melasma');
  assert.equal(nuevoEstado.conexiones.length, 1);
  assert.equal(nuevoEstado.conexiones[0].estado, 'pendiente');
  assert.equal(nuevoEstado.conexiones[0].paraUid, 'demo-sofia');

  // Responder conexión
  const conexionId = nuevoEstado.conexiones[0].id;
  await Directorio.responder(conexionId, 'aceptada');
  assert.equal(Directorio.get().conexiones[0].estado, 'aceptada');

  // Publicar oportunidad en demo
  await Directorio.publicar({
    titulo: 'Renta de Cabina para Cosmetóloga en Providencia',
    tipo: 'renta_cabina',
    organizacion: 'Estética Providencia',
    modalidad: 'presencial',
    ciudad: 'Guadalajara',
    entidad: 'Jalisco',
    especialidades: ['Renta de Cabinas', 'Faciales'],
    resumen: 'Cabina climatizada con luz regulable y camilla reclinable eléctrica.',
    requisitos: 'Cédula o diploma en cosmetología',
    compensacion: '$500 MXN / Turno',
  });
  assert.ok(Directorio.get().oportunidades.length >= 3);
  assert.equal(Directorio.get().oportunidades[0].titulo, 'Renta de Cabina para Cosmetóloga en Providencia');

  // Cerrar oportunidad
  const opId = Directorio.get().oportunidades[0].id;
  await Directorio.cerrarOportunidad(opId);
  assert.equal(Directorio.get().oportunidades.find((o) => o.id === opId)?.estado, 'cerrada');
});

test('directorio conserva ancho util en telefono y apila el hero', () => {
  const css = fs.readFileSync(new URL('../src/styles/directorio.css', import.meta.url), 'utf8');
  const responsive = css.slice(css.indexOf('@media (max-width: 940px)'));

  assert.notEqual(responsive.length, css.length, 'Debe existir el breakpoint del directorio');
  assert.match(
    responsive,
    /\.network-hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
    'El hero debe apilar texto y acciones antes de que la columna de acciones colapse el texto'
  );
  assert.match(
    responsive,
    /@media \(max-width:\s*720px\)[\s\S]*?\.network-grid[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    'Las tarjetas deben usar una sola columna fluida en telefono'
  );
});
