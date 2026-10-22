import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function fixture(apiFn = async () => ({})) {
  const exports = {};
  const mocks = {
    './auth': { api: apiFn },
    './datos': { Datos: { modo: 'demo' } },
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
