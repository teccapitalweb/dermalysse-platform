// Valida los módulos de la Academia Dermalysse contra docs/ACADEMIA-FORMATO.md.
// Uso: node scripts/academia/validar.mjs [programa] [--estricto]
//   sin argumentos valida todo; con un id de programa valida solo ese.
//   --estricto convierte las advertencias de volumen en errores.
// Las carpetas que empiezan con "_" (muestras locales) se ignoran.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const raiz = new URL('../../', import.meta.url);
// ACADEMIA_DIR permite validar otra carpeta (pruebas locales).
const base = process.env.ACADEMIA_DIR ? pathToFileURL(`${process.env.ACADEMIA_DIR.replace(/[\/]+$/, '')}/`) : new URL('api/content/academia/', raiz);
if (!existsSync(new URL('catalogo.json', base))) {
  console.error('No existe api/content/academia/catalogo.json.');
  process.exit(1);
}
const catalogo = JSON.parse(readFileSync(new URL('catalogo.json', base), 'utf8'));
const args = process.argv.slice(2);
const estricto = args.includes('--estricto');
const filtro = args.find((a) => !a.startsWith('--'));
const ANIO_MAX = new Date().getFullYear();

const PROPORCIONES = new Set(['16:9', '4:3', '3:4', '1:1', '9:16']);
const VARIANTES = new Set(['atencion', 'sabias', 'profundizar', 'ejemplo', 'mexico']);
const ACTIVIDADES = new Set(['ordenar', 'relacionar', 'vf', 'caso', 'calculadora']);
const MINIJUEGOS = new Set(['sopa', 'crucigrama', 'memorama']);
const BLOQUES = new Set(['subtitulo', 'texto', 'lista', 'pasos', 'tabla', 'recuadro', 'figura', 'diagrama', 'cita', 'actividad']);
// Tipo de minijuego fijo según el número de módulo (1 sopa, 2 crucigrama, 3 memorama, 4 sopa…).
const juegoEsperado = (n) => ['memorama', 'sopa', 'crucigrama'][n % 3];

let errores = 0, advertencias = 0, modulosOk = 0;
const resumen = [];
const err = (donde, msg) => { errores++; console.log(`  ✖ ${donde}: ${msg}`); };
const adv = (donde, msg) => { if (estricto) return err(donde, msg); advertencias++; console.log(`  ⚠ ${donde}: ${msg}`); };
const palabras = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const esTexto = (v) => typeof v === 'string' && v.trim().length > 0;
const lista = (v) => (Array.isArray(v) ? v : []);

function pregunta(p, donde) {
  if (!p || typeof p !== 'object') return err(donde, 'pregunta inválida');
  if (!esTexto(p.id)) err(donde, 'pregunta sin id');
  if (!esTexto(p.q)) err(donde, `${p.id}: pregunta sin enunciado`);
  if (!Array.isArray(p.opciones) || p.opciones.length !== 4 || !p.opciones.every(esTexto)) err(donde, `${p.id}: deben ser 4 opciones de texto`);
  else if (new Set(p.opciones.map((o) => o.trim().toLowerCase())).size !== 4) err(donde, `${p.id}: opciones repetidas`);
  if (!Number.isInteger(p.correcta) || p.correcta < 0 || p.correcta > 3) err(donde, `${p.id}: correcta fuera de rango (0 a 3)`);
  if (!esTexto(p.explicacion)) err(donde, `${p.id}: falta explicación`);
  if (lista(p.opciones).some((o) => /todas las anteriores|ninguna de las anteriores/i.test(o))) err(donde, `${p.id}: evita «todas/ninguna de las anteriores»`);
}

function fuente(f, donde) {
  if (!f || !['oficial', 'academica', 'propia'].includes(f.tipo)) return err(donde, `fuente con tipo inválido «${f?.tipo}»`);
  if (!esTexto(f.titulo) || !esTexto(f.autor)) err(donde, 'fuente sin título o autor');
  if (f.anio !== undefined && (!Number.isInteger(f.anio) || f.anio < 1900 || f.anio > ANIO_MAX)) err(donde, `fuente con año inválido ${f.anio}`);
  if (f.url !== undefined && !/^https:\/\/[^\s]+$/.test(f.url)) err(donde, `url inválida ${f.url}`);
}

function imagen(img, donde, ids, prefijo) {
  if (!esTexto(img.id) || !img.id.startsWith(prefijo)) err(donde, `id de imagen «${img.id}» debe empezar con ${prefijo}`);
  if (ids.has(img.id)) err(donde, `id repetido ${img.id}`);
  ids.add(img.id);
  if (!PROPORCIONES.has(img.proporcion)) err(donde, `${img.id}: proporción inválida ${img.proporcion}`);
  if (!esTexto(img.alt)) err(donde, `${img.id}: falta alt`);
  const n = palabras(img.prompt);
  if (n < 45) err(donde, `${img.id}: prompt muy corto (${n} palabras)`);
  else if (n < 60 || n > 140) adv(donde, `${img.id}: el prompt debe tener de 60 a 140 palabras (tiene ${n})`);
  if (!/Evitar:/i.test(img.prompt || '')) err(donde, `${img.id}: el prompt debe terminar con «Evitar: …»`);
}

function actividad(a, donde) {
  if (!ACTIVIDADES.has(a.actividad)) return err(donde, `actividad desconocida «${a.actividad}»`);
  if (!esTexto(a.titulo)) err(donde, 'actividad sin título');
  if (a.actividad === 'ordenar') {
    if (!Array.isArray(a.elementos) || a.elementos.length < 4 || a.elementos.length > 7 || !a.elementos.every(esTexto)) err(donde, 'ordenar: 4 a 7 elementos de texto');
    else if (new Set(a.elementos).size !== a.elementos.length) err(donde, 'ordenar: elementos repetidos');
  }
  if (a.actividad === 'relacionar' && (!Array.isArray(a.pares) || a.pares.length < 4 || a.pares.length > 6 || !a.pares.every((p) => esTexto(p?.a) && esTexto(p?.b)))) err(donde, 'relacionar: 4 a 6 pares a/b');
  if (a.actividad === 'vf' && (!Array.isArray(a.afirmaciones) || a.afirmaciones.length < 4 || a.afirmaciones.length > 6 || !a.afirmaciones.every((x) => esTexto(x?.texto) && typeof x.verdadero === 'boolean' && esTexto(x.explicacion)))) err(donde, 'vf: 4 a 6 afirmaciones con verdadero y explicación');
  if (a.actividad === 'caso') {
    if (!esTexto(a.situacion)) err(donde, 'caso sin situación');
    if (!Array.isArray(a.opciones) || a.opciones.length < 3 || a.opciones.length > 4) err(donde, 'caso: 3 o 4 opciones');
    else if (a.opciones.filter((o) => o?.correcta === true).length !== 1) err(donde, 'caso: exactamente una opción correcta');
    else if (!a.opciones.every((o) => esTexto(o.texto) && esTexto(o.retro))) err(donde, 'caso: cada opción con texto y retro');
  }
  if (a.actividad === 'calculadora') {
    const ids = new Set(lista(a.variables).map((v) => v?.id));
    if (!ids.size || !lista(a.variables).every((v) => /^[a-z][a-zA-Z0-9]*$/.test(v?.id) && esTexto(v.etiqueta) && typeof v.valor === 'number')) err(donde, 'calculadora: variables con id (camelCase), etiqueta y valor numérico');
    if (!esTexto(a.formula)) err(donde, 'calculadora sin fórmula legible');
    const expr = a.resultado?.expresion || '';
    const limpia = expr.replace(/[a-zA-Z][a-zA-Z0-9]*/g, (m) => (ids.has(m) ? '1' : '§'));
    if (!expr || limpia.includes('§') || !/^[\d\s+\-*/().]+$/.test(limpia)) err(donde, `calculadora: expresión inválida «${expr}»`);
    else { try { const v = Function(`return (${limpia})`)(); if (!Number.isFinite(v)) err(donde, 'calculadora: la expresión no da un número'); } catch { err(donde, 'calculadora: expresión mal formada'); } }
    if (!esTexto(a.resultado?.etiqueta)) err(donde, 'calculadora: resultado sin etiqueta');
  }
}

function minijuego(m, n, donde) {
  if (!m || !MINIJUEGOS.has(m.tipo)) return err(donde, 'minijuego ausente o de tipo inválido');
  if (m.tipo !== juegoEsperado(n)) err(donde, `el módulo ${n} lleva minijuego «${juegoEsperado(n)}», no «${m.tipo}»`);
  if (!esTexto(m.titulo)) err(donde, 'minijuego sin título');
  if (m.tipo === 'sopa') {
    const ok = Array.isArray(m.palabras) && m.palabras.length >= 8 && m.palabras.length <= 12 && m.palabras.every((p) => /^[A-ZÑ]{4,12}$/.test(p));
    if (!ok) err(donde, 'sopa: 8 a 12 palabras en MAYÚSCULAS sin acentos ni espacios, de 4 a 12 letras');
    else if (new Set(m.palabras).size !== m.palabras.length) err(donde, 'sopa: palabras repetidas');
  }
  if (m.tipo === 'crucigrama' && (!Array.isArray(m.pistas) || m.pistas.length < 6 || m.pistas.length > 10 || !m.pistas.every((p) => /^[A-ZÑ]{3,14}$/.test(p?.palabra) && esTexto(p.pista)))) err(donde, 'crucigrama: 6 a 10 pistas con palabra en MAYÚSCULAS sin acentos (3 a 14 letras)');
  if (m.tipo === 'memorama' && (!Array.isArray(m.pares) || m.pares.length < 6 || m.pares.length > 8 || !m.pares.every((p) => esTexto(p?.a) && esTexto(p?.b)))) err(donde, 'memorama: 6 a 8 pares a/b');
}

function validarModulo(prog, meta, archivo) {
  const donde = `${prog.id}/${archivo}`;
  let m;
  try { m = JSON.parse(readFileSync(new URL(`${prog.id}/${archivo}`, base), 'utf8')); } catch (e) { return err(donde, `JSON inválido: ${e.message}`); }
  const nn = String(meta.n).padStart(2, '0');
  const prefijo = `${prog.id}/m${nn}/`;
  if (m.programa !== prog.id) err(donde, `programa «${m.programa}» no coincide`);
  if (m.modulo !== meta.n) err(donde, `modulo ${m.modulo} no coincide con ${meta.n}`);
  if (m.titulo !== meta.titulo) err(donde, `título «${m.titulo}» distinto al del catálogo «${meta.titulo}»`);
  if (!['borrador', 'revision', 'aprobado'].includes(m.estado)) err(donde, 'estado inválido (borrador | revision | aprobado)');
  const pr = palabras(m.resumen);
  if (pr < 40) err(donde, `resumen demasiado corto (${pr} palabras)`);
  else if (pr < 60 || pr > 120) adv(donde, `resumen de ${pr} palabras (60 a 120)`);
  if (!Array.isArray(m.objetivos) || m.objetivos.length < 4 || m.objetivos.length > 6 || !m.objetivos.every(esTexto)) err(donde, 'objetivos: 4 a 6');
  if (!Number.isInteger(m.duracionMin) || m.duracionMin < 10) err(donde, 'duracionMin debe ser un entero en minutos');
  const ids = new Set();
  if (!m.portada || m.portada.id !== `${prefijo}portada` || m.portada.proporcion !== '16:9') err(donde, `portada debe tener id ${prefijo}portada y 16:9`);
  else imagen(m.portada, donde, ids, prefijo);
  if (!Array.isArray(m.temas) || m.temas.length < 4 || m.temas.length > 6) err(donde, `temas: 4 a 6 (hay ${m.temas?.length ?? 0})`);
  let palabrasModulo = 0, figurasModulo = 0, profundizar = 0;
  lista(m.temas).forEach((t, i) => {
    const dt = `${donde} tema ${t?.n}`;
    if (t?.n !== `${meta.n}.${i + 1}`) err(dt, `numeración esperada ${meta.n}.${i + 1}`);
    if (!esTexto(t?.titulo)) err(dt, 'sin título');
    if (!Number.isInteger(t?.minutos) || t.minutos < 1) err(dt, 'minutos inválidos');
    if (!esTexto(t?.enPocasPalabras)) err(dt, 'falta enPocasPalabras');
    let pal = 0, fig = 0, dia = 0, act = 0;
    const rec = new Set();
    for (const b of lista(t?.bloques)) {
      if (!b || !BLOQUES.has(b.tipo)) { err(dt, `bloque desconocido «${b?.tipo}»`); continue; }
      if (b.tipo === 'subtitulo' && !esTexto(b.texto)) err(dt, 'subtítulo vacío');
      if (b.tipo === 'texto') { if (!esTexto(b.md)) err(dt, 'texto vacío'); if (/<[a-z]/i.test(b.md || '')) err(dt, 'texto con HTML'); pal += palabras(b.md); }
      if (b.tipo === 'lista') { if (!Array.isArray(b.items) || b.items.length < 2) err(dt, 'lista con menos de 2 elementos'); pal += palabras(lista(b.items).join(' ')); }
      if (b.tipo === 'pasos') { if (!Array.isArray(b.pasos) || b.pasos.length < 2) err(dt, 'pasos con menos de 2'); pal += palabras(lista(b.pasos).map((p) => `${p?.titulo ?? ''} ${p?.md ?? ''}`).join(' ')); }
      if (b.tipo === 'tabla') { if (!Array.isArray(b.columnas) || !Array.isArray(b.filas) || !b.filas.every((f) => Array.isArray(f) && f.length === b.columnas.length)) err(dt, `tabla «${b.titulo}» con filas que no cuadran`); pal += palabras(lista(b.filas).flat().join(' ')); }
      if (b.tipo === 'recuadro') { if (!VARIANTES.has(b.variante)) err(dt, `variante de recuadro inválida «${b.variante}»`); if (!esTexto(b.titulo) || !esTexto(b.md)) err(dt, 'recuadro sin título o texto'); rec.add(b.variante); if (b.variante === 'profundizar') profundizar++; pal += palabras(b.md); }
      if (b.tipo === 'figura') { fig++; imagen(b, dt, ids, prefijo); if (!esTexto(b.pie)) err(dt, `${b.id}: falta pie`); }
      if (b.tipo === 'diagrama') {
        dia++;
        if (!esTexto(b.id) || !b.id.startsWith(prefijo)) err(dt, `diagrama con id inválido ${b.id}`);
        else if (ids.has(b.id)) err(dt, `id repetido ${b.id}`);
        else ids.add(b.id);
        if (!esTexto(b.descripcion) || !Array.isArray(b.elementos) || b.elementos.length < 3) err(dt, `${b.id}: el diagrama necesita descripción y 3 o más elementos`);
        if (!esTexto(b.pie)) err(dt, `${b.id}: falta pie`);
      }
      if (b.tipo === 'cita' && (!esTexto(b.texto) || !esTexto(b.autor))) err(dt, 'cita sin texto o autor');
      if (b.tipo === 'actividad') { act++; actividad(b, dt); }
    }
    palabrasModulo += pal; figurasModulo += fig;
    if (pal < 900) adv(dt, `solo ${pal} palabras (mínimo 900)`);
    if (fig < 3) adv(dt, `solo ${fig} figuras (mínimo 3)`);
    if (dia < 1) adv(dt, 'sin diagrama');
    if (rec.size < 2) adv(dt, 'menos de 2 variantes de recuadro');
    if (act < 1) err(dt, 'sin actividad');
    if (!Array.isArray(t?.glosario) || t.glosario.length < 3 || t.glosario.length > 8 || !t.glosario.every((g) => esTexto(g?.termino) && esTexto(g?.definicion))) err(dt, 'glosario: 3 a 8 términos con definición');
    if (!Array.isArray(t?.verificacion) || t.verificacion.length !== 3) err(dt, 'verificación debe tener 3 preguntas');
    lista(t?.verificacion).forEach((p, k) => { pregunta(p, dt); if (p?.id !== `t${t.n}-${k + 1}`) err(dt, `id de verificación esperado t${t.n}-${k + 1}`); });
    if (!Array.isArray(t?.fuentes) || !t.fuentes.length) err(dt, 'sin fuentes');
    lista(t?.fuentes).forEach((f) => fuente(f, dt));
  });
  if (!profundizar) adv(donde, 'el módulo no tiene ningún recuadro «profundizar»');
  minijuego(m.minijuego, meta.n, donde);
  const pe = lista(m.examen?.preguntas);
  if (m.examen?.aprobar !== 70 || m.examen?.mostrar !== 10) err(donde, 'examen: aprobar 70 y mostrar 10');
  if (pe.length < 15 || pe.length > 20) err(donde, `examen: 15 a 20 preguntas (hay ${pe.length})`);
  pe.forEach((p) => pregunta(p, `${donde} examen`));
  if (new Set(pe.map((p) => p?.id)).size !== pe.length) err(donde, 'examen con ids repetidos');
  if (pe.length >= 15) {
    const cuenta = [0, 0, 0, 0];
    pe.forEach((p) => { if (Number.isInteger(p?.correcta) && p.correcta >= 0 && p.correcta < 4) cuenta[p.correcta]++; });
    const max = Math.max(...cuenta);
    if (max / pe.length > 0.35) err(donde, `examen: la respuesta correcta se concentra en una letra (${cuenta.join('/')}); usa balancear-respuestas.mjs`);
  }
  lista(m.fuentes).forEach((f) => fuente(f, donde));
  resumen.push({ modulo: `${prog.id}/${nn}`, palabras: palabrasModulo, figuras: figurasModulo + 1, temas: lista(m.temas).length });
  modulosOk++;
}

const programas = catalogo.programas.filter((p) => !String(p.id).startsWith('_') && (!filtro || p.id === filtro));
if (filtro && !programas.length) { console.error(`No existe el programa ${filtro}`); process.exit(1); }
// Calendario de lanzamiento opcional: { inicio: "YYYY-MM-DD", cadaDias: 1–60 }.
// El módulo n se abre en inicio + (n − 1) × cadaDias días, a las 00:00 de la Ciudad de México.
function fechaReal(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  return y >= 2000 && y <= 2100 && f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}
function lanzamiento(prog) {
  if (prog.lanzamiento === undefined) return;
  const l = prog.lanzamiento;
  const donde = `catalogo.json ${prog.id}`;
  if (!l || typeof l !== 'object' || Array.isArray(l)) return err(donde, 'lanzamiento debe ser un objeto { inicio, cadaDias }');
  if (!fechaReal(l.inicio)) err(donde, `lanzamiento.inicio «${l.inicio}» debe ser una fecha real YYYY-MM-DD`);
  if (!Number.isInteger(l.cadaDias) || l.cadaDias < 1 || l.cadaDias > 60) err(donde, `lanzamiento.cadaDias «${l.cadaDias}» debe ser un entero de 1 a 60`);
  const extra = Object.keys(l).filter((k) => k !== 'inicio' && k !== 'cadaDias');
  if (extra.length) err(donde, `lanzamiento con campos desconocidos: ${extra.join(', ')}`);
}

const pendientes = [];
for (const prog of programas) {
  lanzamiento(prog);
  const dir = new URL(`${prog.id}/`, base);
  const archivos = existsSync(dir) ? readdirSync(dir).filter((f) => /^modulo-\d\d\.json$/.test(f)) : [];
  for (const meta of prog.modulos) {
    const archivo = `modulo-${String(meta.n).padStart(2, '0')}.json`;
    if (archivos.includes(archivo)) validarModulo(prog, meta, archivo); else pendientes.push(`${prog.id}/${archivo}`);
  }
  for (const a of archivos) if (!prog.modulos.some((m) => `modulo-${String(m.n).padStart(2, '0')}.json` === a)) err(`${prog.id}/${a}`, 'archivo sin módulo en el catálogo');
}
for (const r of resumen) console.log(`  ✔ ${r.modulo}: ${r.temas} temas · ${r.palabras.toLocaleString('es-MX')} palabras · ${r.figuras} imágenes`);
const totPal = resumen.reduce((a, r) => a + r.palabras, 0);
const totFig = resumen.reduce((a, r) => a + r.figuras, 0);
console.log(`\nMódulos escritos: ${modulosOk} · pendientes: ${pendientes.length} · palabras: ${totPal.toLocaleString('es-MX')} · imágenes: ${totFig}`);
console.log(`Errores: ${errores} · advertencias: ${advertencias}${estricto ? ' (modo estricto)' : ''}`);
process.exit(errores ? 1 : 0);
