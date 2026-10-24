// Pruebas estáticas y de integridad para firestore.rules y storage.rules de Dermalysse.
import { readFileSync, existsSync } from 'node:fs';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const COLECCIONES_CRITICAS = [
  'certificates',
  'v2_certificados',
  'v2_directorio_perfiles',
  'v2_directorio_oportunidades',
  'v2_directorio_conexiones',
  'v2_directorio_reportes',
  'v2_retos_banco',
  'v2_retos_estado',
  'v2_academia_progreso',
  'v2_academia_intentos',
  'v2_academia_revisiones',
  'v2_academia_lanzamiento',
  'v2_historia',
  'v2_experiencias',
  'v2_liga',
  'v2_quiz',
];

describe('Auditoría de Reglas de Seguridad - Dermalysse', () => {
  const rutaFirestore = new URL('../firestore.rules', import.meta.url);
  const rutaStorage = new URL('../storage.rules', import.meta.url);

  test('archivos de reglas existen y tienen sintaxis v2 válida', () => {
    assert.ok(existsSync(rutaFirestore), 'api/firestore.rules debe existir');
    assert.ok(existsSync(rutaStorage), 'api/storage.rules debe existir');

    const firestoreContenido = readFileSync(rutaFirestore, 'utf8');
    const storageContenido = readFileSync(rutaStorage, 'utf8');

    assert.ok(firestoreContenido.includes("rules_version = '2';"), 'firestore.rules debe declarar rules_version = 2');
    assert.ok(storageContenido.includes("rules_version = '2';"), 'storage.rules debe declarar rules_version = 2');
  });

  test('firestore.rules niega acceso directo de cliente a todas las colecciones críticas', () => {
    const contenido = readFileSync(rutaFirestore, 'utf8');

    for (const coleccion of COLECCIONES_CRITICAS) {
      const patron = new RegExp(`match\\s+/${coleccion}/{[^}]+}\\s+{\\s*allow\\s+read,\\s*write:\\s*if\\s+false;`);
      assert.ok(
        patron.test(contenido),
        `La colección '${coleccion}' debe estar explícitamente protegida con 'allow read, write: if false;'`
      );
    }
  });

  test('firestore.rules contiene cierre global defensivo match /{document=**}', () => {
    const contenido = readFileSync(rutaFirestore, 'utf8');
    assert.ok(
      contenido.includes('match /{document=**}') && contenido.includes('allow read, write: if false;'),
      'Debe existir un match global wildcard que deniegue todo acceso por defecto'
    );
  });

  test('storage.rules protege materiales y solo permite lectura pública de portadas y directorio', () => {
    const contenido = readFileSync(rutaStorage, 'utf8');

    // Materiales cerrados
    assert.ok(
      /match\s+\/materiales\/{archivo}\s+{\s*allow\s+read,\s*write:\s*if\s+false;/.test(contenido),
      'materiales/ debe denegar lectura y escritura directa desde cliente'
    );

    // Portadas públicas en lectura, cerradas en escritura
    assert.ok(
      /match\s+\/materiales\/portadas\/{archivo}\s+{\s*allow\s+read:\s*if\s+true;\s*allow\s+write:\s*if\s+false;/.test(contenido),
      'materiales/portadas/ debe permitir lectura pero prohibir escritura cliente'
    );

    // Directorio público en lectura, cerrado en escritura
    assert.ok(
      /match\s+\/directorio\/perfiles\/{uid}\/{archivo}\s+{\s*allow\s+read:\s*if\s+true;\s*allow\s+write:\s*if\s+false;/.test(contenido),
      'directorio/perfiles/ debe permitir lectura pero prohibir subida directa (debe usar URL firmada)'
    );

    // Wildcard fallback
    assert.ok(
      /match\s+\/{allPaths=\*\*}/.test(contenido),
      'storage.rules debe contener wildcard defensivo fallback'
    );
  });
});
