import { readFile, writeFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const officialPath = 'C:/dev/02_CLIENTES/Dermalysse/_fuentes/Club-Dermalysse/data/dermalysse-courses.json';
const official = JSON.parse(await readFile(officialPath, 'utf8'));
const coverFor = (course) => {
  const value = `${course.name} ${course.desc}`.toLowerCase();
  if (/cicatriz|acne|acné/.test(value)) return '/media/piel-sin-cicatrices.png';
  if (/mancha|pigment/.test(value)) return '/media/manchas.png';
  if (/natural|formulaci|cosmétic|cosmetic/.test(value)) return '/media/cosmetica-natural.png';
  if (/tecnolog|hidra|microdermo|dermaplan/.test(value)) return '/media/hidrafacial.png';
  return indexCover(course.order);
};
const indexCover = (order) => Number(order || 0) % 2 ? '/media/hero-model.png' : '/media/hero-background.png';

const catalogo = {
  libraryId: '',
  generado: new Date().toISOString(),
  cursos: official.filter((course) => course.status === 'published').map((course, index) => ({
    id: course.id,
    titulo: course.name,
    area: course.cat,
    nivel: course.level,
    instructor: course.instructor || 'Equipo académico Dermalysse',
    portada: coverFor(course),
    descripcion: course.desc,
    aprenderas: [],
    orden: course.order || index + 1,
    publicado: true,
    bunnyCollectionId: '',
    clases: course.lessons.map((lesson, lessonIndex) => ({
      n: lessonIndex + 1,
      titulo: lesson.name,
      videoId: '',
      duracion: lesson.durationSeconds ? Math.max(1, Math.round(lesson.durationSeconds / 60)) : null,
      gratis: lesson.isPreview === true,
      notas: {
        resumen: lesson.desc,
        conceptos: [],
      },
    })),
  })),
};

await writeFile(path.join(root, 'src/data/catalogo.json'), `${JSON.stringify(catalogo, null, 2)}\n`);
for (const file of ['materiales.json', 'envivo.json', 'casos.json', 'quizzes-demo.json', 'miembros-demo.json']) {
  await writeFile(path.join(root, `src/data/${file}`), '[]\n');
}

const replacements = [
  [/Visión Pecuaria/g, 'Dermalysse'],
  [/VISION PECUARIA/g, 'DERMALYSSE'],
  [/Élite Pecuario/g, 'Club Dermalysse'],
  [/ELITE PECUARIO/g, 'CLUB DERMALYSSE'],
  [/elite-pecuario/g, 'dermalysse'],
  [/Equipo Visión Pecuaria/g, 'Equipo académico Dermalysse'],
  [/logo-horizontal-dark\.png/g, 'dermalysse-horizontal-light.svg'],
  [/logo-horizontal\.png/g, 'dermalysse-horizontal.svg'],
  [/isotipo\.png/g, 'dermalysse-isotipo.svg'],
  [/\/fotos\/login-campo-ilustrado-v2\.webp/g, '/media/hero-model.png'],
  [/demo@visionpecuaria\.club/g, 'demo@dermalysse.local'],
];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (/\.(ts|css|html|json|webmanifest|js)$/.test(entry.name)) {
      let text = await readFile(full, 'utf8');
      for (const [pattern, value] of replacements) text = text.replace(pattern, value);
      await writeFile(full, text);
    }
  }
}

await walk(path.join(root, 'src'));
await walk(path.join(root, 'club'));
for (const file of ['offline.html', 'sw.js', 'manifest.webmanifest']) {
  await walk(path.join(root, 'public')).catch(() => {});
  break;
}

console.log(`Migrados ${catalogo.cursos.length} cursos oficiales de Dermalysse.`);
