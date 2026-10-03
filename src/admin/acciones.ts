// Interacciones del panel de administración (formularios y botones).
import { Datos, slug, imagenAWebp, type Curso, type Material, type Evento, type Quiz } from '../core/datos';
import { Comunidad } from '../core/comunidad';
import { navigate, render, current } from '../core/router';
import { api, mensajeError } from '../core/auth';
import { AdminRemoto, cargarAdmin, cursoParaApi, invalidarAdmin, materialParaApi } from './remoto';
import { mostrarLoteCupones } from './cupones';
import type { LoteCupones } from './remoto';

type Toast = (msg: string, icon?: string) => void;

async function recargar(...claves: Parameters<typeof invalidarAdmin>) {
  invalidarAdmin(...claves);
  await cargarAdmin(current().path, true);
}

async function subirFirmado(ruta: string, archivo: File, tipo?: 'archivo' | 'portada') {
  const firma = await api<{ uploadUrl: string; publicUrl?: string }>(ruta, { method: 'POST', json: { ...(tipo ? { tipo } : {}), contentType: archivo.type } });
  const r = await fetch(firma.uploadUrl, { method: 'PUT', headers: { 'Content-Type': archivo.type }, body: archivo });
  if (!r.ok) throw new Error(`No se pudo subir el archivo (${r.status})`);
  return firma;
}

function cursoDesdeForm(f: HTMLFormElement): Curso {
  const d = new FormData(f);
  const id = f.dataset.id || '';
  const previo = Datos.cursos().find((c) => c.id === id);
  const clases = [];
  for (let i = 0; d.has(`clase-${i}-titulo`); i++) {
    const dur = String(d.get(`clase-${i}-duracion`) || '');
    clases.push({ ...(previo?.clases[i] || {}), n: i + 1, titulo: String(d.get(`clase-${i}-titulo`)).trim(), videoId: String(d.get(`clase-${i}-videoId`)).trim(),
                  duracion: dur ? Number(dur) : null, gratis: d.get(`clase-${i}-gratis`) === 'on' });
  }
  const titulo = String(d.get('titulo')).trim();
  return {
    ...(previo || {}),
    id: id || slug(titulo), titulo, area: String(d.get('area')).trim(), nivel: String(d.get('nivel')), instructor: String(d.get('instructor')).trim(),
    descripcion: String(d.get('descripcion')).trim(), aprenderas: String(d.get('aprenderas')).split('\n').map((x) => x.trim()).filter(Boolean),
    bunnyCollectionId: String(d.get('bunnyCollectionId')).trim(), publicado: d.get('publicado') === '1', portada: String(d.get('portada')),
    orden: previo?.orden ?? Datos.cursos().length + 1, clases,
  };
}

function quizDesdeForm(f: HTMLFormElement): Quiz {
  const d = new FormData(f);
  const preguntas = [];
  for (let i = 0; d.has(`p-${i}-q`); i++) {
    preguntas.push({ q: String(d.get(`p-${i}-q`)).trim(), opciones: [0, 1, 2, 3].map((o) => String(d.get(`p-${i}-o-${o}`) || '').trim()),
                     correcta: Number(d.get(`p-${i}-correcta`) ?? 0), explicacion: String(d.get(`p-${i}-explicacion`) || '').trim() });
  }
  const previo = Datos.quiz(f.dataset.curso!, Number(f.dataset.n));
  return { id: f.dataset.id!, cursoId: f.dataset.curso!, n: Number(f.dataset.n), estado: previo?.estado || 'borrador', preguntas, actualizado: '' };
}

export function instalarAccionesAdmin(toast: Toast) {
  document.addEventListener('submit', async (e) => {
    const f = e.target as HTMLFormElement;
    const tipo = f.dataset.form;
    if (!tipo || !current().path.startsWith('/admin')) return;
    e.preventDefault();
    const d = new FormData(f);
    try {
      if (tipo === 'generar-cupones') {
        if (Datos.modo !== 'api') { toast('Los cupones reales requieren conexión con la API.', 'circle-alert'); return; }
        const btn = f.querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])');
        btn?.setAttribute('disabled', '');
        try {
          const idempotencia = f.dataset.idempotencia || crypto.randomUUID();
          f.dataset.idempotencia = idempotencia;
          const duracion = String(d.get('duracion'));
          const lote = await api<LoteCupones>('/admin/cupones', { method: 'POST', json: {
            duracion, ...(duracion === 'personalizada' ? { dias: Number(d.get('dias')) } : {}),
            modalidad: String(d.get('modalidad')), cantidad: Number(d.get('cantidad')), idempotencia,
          } });
          delete f.dataset.idempotencia;
          mostrarLoteCupones(lote);
          await recargar('cupones');
          toast(lote.codigos.length === 1 ? 'Cupón generado' : `${lote.codigos.length} cupones generados`, 'ticket-percent');
          render(); return;
        } finally { btn?.removeAttribute('disabled'); }
      }
      if (tipo === 'curso') {
        const c = cursoDesdeForm(f);
        if (!f.dataset.id && Datos.cursos().some((x) => x.id === c.id)) { toast('Ya existe un curso con ese título', 'alert-triangle'); return; }
        if (!c.clases.length) { toast('Agrega al menos una clase', 'alert-triangle'); return; }
        if (Datos.modo === 'api') {
          const idPrevio = f.dataset.id;
          const ruta = idPrevio ? `/admin/cursos/${encodeURIComponent(idPrevio)}` : '/admin/cursos';
          await api(ruta, { method: idPrevio ? 'PATCH' : 'POST', json: cursoParaApi(c) });
          const portada = f.querySelector<HTMLInputElement>('[data-subir-imagen="portada"]')?.files?.[0];
          if (portada) {
            const firma = await subirFirmado(`/admin/cursos/${encodeURIComponent(c.id)}/portada/subida`, portada);
            if (firma.publicUrl) await api(`/admin/cursos/${encodeURIComponent(c.id)}`, { method: 'PATCH', json: { portada: firma.publicUrl } });
          }
          await recargar('cursos', 'resumen');
          toast('Curso guardado en Firebase'); navigate(`/admin/cursos/${c.id}`); if (idPrevio) render(); return;
        }
        Datos.guardarCurso(c); toast('Curso guardado'); navigate(`/admin/cursos/${c.id}`); if (f.dataset.id) render();
      }
      if (tipo === 'quiz') {
        const q = quizDesdeForm(f);
        const accion = (e as SubmitEvent).submitter?.getAttribute('value');
        if (accion === 'aprobar') {
          if (!q.preguntas.length) { toast('Agrega al menos una pregunta', 'alert-triangle'); return; }
          if (q.preguntas.some((p) => new Set(p.opciones.map((o) => o.toLowerCase())).size < 4)) { toast('Hay opciones repetidas en alguna pregunta', 'alert-triangle'); return; }
          q.estado = 'aprobado';
        } else q.estado = 'borrador';
        if (Datos.modo === 'api') {
          await api(`/admin/quizzes/${encodeURIComponent(q.id)}`, { method: 'PATCH', json: { preguntas: q.preguntas, estado: q.estado } });
          await recargar('quizzes'); toast(q.estado === 'aprobado' ? 'Quiz aprobado y publicado' : 'Borrador guardado'); render(); return;
        }
        Datos.guardarQuiz(q); toast(q.estado === 'aprobado' ? 'Quiz aprobado · ya lo ven los miembros' : 'Borrador guardado'); render();
      }
      if (tipo === 'material') {
        const previo = Datos.materiales().find((m) => m.id === f.dataset.id);
        const titulo = String(d.get('titulo')).trim();
        const m: Material = { ...(previo || {}), id: f.dataset.id || slug(titulo), titulo, tipo: String(d.get('tipo')), categoria: String(d.get('categoria')).trim(),
          area: String(d.get('area')).trim(), autor: String(d.get('autor')).trim(), paginas: Number(d.get('paginas')) || 1, portada: String(d.get('portada')),
          cursoId: String(d.get('cursoId')) || null, descripcion: String(d.get('descripcion')).trim(), estado: String(d.get('estado')), url: String(d.get('url') || '').trim() };
        if (Datos.modo === 'api') {
          const idPrevio = f.dataset.id;
          const ruta = idPrevio ? `/admin/materiales/${encodeURIComponent(idPrevio)}` : '/admin/materiales';
          await api(ruta, { method: idPrevio ? 'PATCH' : 'POST', json: materialParaApi(m) });
          const pdf = f.querySelector<HTMLInputElement>('[name="archivoPdf"]')?.files?.[0];
          if (pdf) await subirFirmado(`/admin/materiales/${encodeURIComponent(m.id)}/subida`, pdf, 'archivo');
          const portada = f.querySelector<HTMLInputElement>('[data-subir-imagen="portada"]')?.files?.[0];
          if (portada) {
            const firma = await subirFirmado(`/admin/materiales/${encodeURIComponent(m.id)}/subida`, portada, 'portada');
            if (firma.publicUrl) await api(`/admin/materiales/${encodeURIComponent(m.id)}`, { method: 'PATCH', json: { portada: firma.publicUrl } });
          }
          await recargar('materiales', 'resumen'); toast('Material guardado en Firebase'); navigate('/admin/materiales'); return;
        }
        if (m.estado === 'disponible' && !m.url) { toast('Para marcarlo disponible indica el archivo', 'alert-triangle'); return; }
        Datos.guardarMaterial(m); toast('Material guardado'); navigate('/admin/materiales');
      }
      if (tipo === 'evento') {
        const previo = Datos.eventos().find((x) => x.id === f.dataset.id);
        const titulo = String(d.get('titulo')).trim();
        const ev: Evento = { ...(previo || {}), id: f.dataset.id || `${slug(titulo)}-${Date.now().toString(36)}`, titulo, ponente: String(d.get('ponente')).trim(),
          fecha: new Date(String(d.get('fecha'))).toISOString(), duracionMin: Number(d.get('duracionMin')) || 60, enlace: String(d.get('enlace')).trim(),
          cursoId: String(d.get('cursoId')) || undefined, publicado: d.get('publicado') === '1' };
        if (Datos.modo === 'api') {
          const idPrevio = f.dataset.id;
          await api(idPrevio ? `/admin/eventos/${encodeURIComponent(idPrevio)}` : '/admin/eventos', { method: idPrevio ? 'PATCH' : 'POST', json: ev });
          await recargar('eventos', 'resumen'); toast('Clase en vivo guardada', 'radio'); navigate('/admin/en-vivo'); return;
        }
        Datos.guardarEvento(ev); toast('Clase en vivo guardada', 'radio'); navigate('/admin/en-vivo');
      }
      if (tipo === 'cortesia') {
        if (Datos.modo === 'api') {
          const uid = f.dataset.uid!;
          await api(`/admin/miembros/${encodeURIComponent(uid)}/cortesia`, { method: 'POST', json: { dias: Number(d.get('dias')), motivo: String(d.get('motivo')).trim() } });
          invalidarAdmin('miembros', 'resumen'); await cargarAdmin(current().path, true); toast('Cortesía otorgada', 'gift'); render(); return;
        }
        const m = Datos.miembros().find((x) => x.uid === f.dataset.uid)!;
        const base = m.cortesiaHasta && new Date(m.cortesiaHasta).getTime() > Date.now() ? new Date(m.cortesiaHasta).getTime() : Date.now();
        m.cortesiaHasta = new Date(base + Number(d.get('dias')) * 864e5).toISOString(); m.cortesiaMotivo = String(d.get('motivo')).trim();
        Datos.guardarMiembro(m); toast('Cortesía otorgada', 'gift'); render();
      }
      if (tipo === 'aviso') {
        if (Datos.modo === 'api') {
          await api('/admin/avisos', { method: 'POST', json: { titulo: String(d.get('titulo')).trim(), texto: String(d.get('texto')).trim(), enlace: String(d.get('enlace')).trim() || null } });
          await recargar('avisos'); toast('Aviso publicado', 'megaphone'); render(); return;
        }
        Datos.publicarAviso({ titulo: String(d.get('titulo')).trim(), texto: String(d.get('texto')).trim(), enlace: String(d.get('enlace')).trim() || undefined });
        toast('Aviso publicado', 'megaphone'); render();
      }
      if (tipo === 'config') {
        if (Datos.modo === 'api') {
          await api('/admin/config', { method: 'PATCH', json: { precios: { mensual: Number(d.get('precioMensual')), anual: Number(d.get('precioAnual')) }, descuentoVIP: Number(d.get('descuentoVIP')), whatsappSoporte: String(d.get('whatsappSoporte')).trim(), canalWhatsApp: String(d.get('canalWhatsApp')).trim() } });
          await recargar('config'); toast('Ajustes guardados en Firebase'); render(); return;
        }
        Datos.guardarConfig({ precioMensual: Number(d.get('precioMensual')), precioAnual: Number(d.get('precioAnual')), descuentoVIP: Number(d.get('descuentoVIP')),
          whatsappSoporte: String(d.get('whatsappSoporte')).trim(), canalWhatsApp: String(d.get('canalWhatsApp')).trim() });
        toast('Ajustes guardados');
      }
      if (tipo === 'buscar-miembro') {
        const p = current().query; p.set('q', String(d.get('q'))); navigate('/admin/miembros?' + p.toString());
      }
    } catch (err) { console.error(err); toast(mensajeError(err), 'circle-alert'); }
  });

  document.addEventListener('click', async (e) => {
    const el = e.target as HTMLElement;
    if (!current().path.startsWith('/admin')) return;

    if (el.closest('[data-refrescar-cupones]')) {
      try { await recargar('cupones'); render(); }
      catch (err) { toast(mensajeError(err), 'circle-alert'); }
      return;
    }

    const copiar = el.closest<HTMLElement>('[data-copiar-cupon], [data-copiar-cupones]');
    if (copiar) {
      const valor = copiar.dataset.copiarCupones || copiar.dataset.copiarCupon || '';
      try { await navigator.clipboard.writeText(valor); toast('Código copiado', 'copy'); }
      catch { toast('No se pudo copiar. Selecciona el código y cópialo manualmente.', 'circle-alert'); }
      return;
    }
    const activar = el.closest<HTMLElement>('[data-activar-cupon]');
    if (activar) {
      const codigo = activar.dataset.activarCupon!;
      const activo = activar.dataset.activo !== 'true';
      if (!activo && !confirm(`¿Desactivar ${codigo}? Los accesos ya otorgados seguirán vigentes.`)) return;
      try {
        await api(`/admin/cupones/${encodeURIComponent(codigo)}`, { method: 'PATCH', json: { activo } });
        await recargar('cupones'); toast(activo ? 'Cupón reactivado' : 'Cupón desactivado'); render();
      } catch (err) { toast(mensajeError(err), 'circle-alert'); }
      return;
    }

    const pub = el.closest<HTMLElement>('[data-toggle-publicado]');
    if (pub) {
      const c = Datos.cursos().find((x) => x.id === pub.dataset.togglePublicado)!; c.publicado = c.publicado === false;
      if (Datos.modo === 'api') { try { await api(`/admin/cursos/${encodeURIComponent(c.id)}`, { method: 'PATCH', json: { publicado: c.publicado } }); await recargar('cursos', 'resumen'); } catch (err) { toast(mensajeError(err), 'circle-alert'); return; } }
      else Datos.guardarCurso(c);
      toast(c.publicado ? 'Curso publicado' : 'Curso oculto'); render();
    }

    const mov = el.closest<HTMLElement>('[data-mover-curso]');
    if (mov) { const [id, dir] = mov.dataset.moverCurso!.split(':'); const ids = Datos.cursos().map((c) => c.id); const i = ids.indexOf(id); const j = i + Number(dir);
      if (j >= 0 && j < ids.length) {
        [ids[i], ids[j]] = [ids[j], ids[i]];
        if (Datos.modo === 'api') { try { await Promise.all(ids.map((cursoId, orden) => api(`/admin/cursos/${encodeURIComponent(cursoId)}`, { method: 'PATCH', json: { orden: orden + 1 } }))); await recargar('cursos'); } catch (err) { toast(mensajeError(err), 'circle-alert'); return; } }
        else Datos.reordenarCursos(ids);
        render();
      } }

    const ca = el.closest<HTMLElement>('[data-clase-accion]');
    if (ca) {
      const f = ca.closest('form') as HTMLFormElement; const c = cursoDesdeForm(f); const [acc, idx] = ca.dataset.claseAccion!.split(':'); const i = Number(idx);
      if (acc === 'agregar') c.clases.push({ n: c.clases.length + 1, titulo: `Clase ${c.clases.length + 1}`, videoId: '', duracion: null, gratis: c.clases.length === 0 });
      if (acc === 'quitar') { if (!confirm('¿Quitar esta clase del curso?')) return; c.clases.splice(i, 1); }
      if (acc === 'subir' && i > 0) [c.clases[i - 1], c.clases[i]] = [c.clases[i], c.clases[i - 1]];
      if (acc === 'bajar' && i < c.clases.length - 1) [c.clases[i + 1], c.clases[i]] = [c.clases[i], c.clases[i + 1]];
      c.clases.forEach((k, n) => (k.n = n + 1));
      if (!c.titulo) { toast('Escribe el título del curso primero', 'alert-triangle'); return; }
      Datos.guardarCurso(c); if (!f.dataset.id) navigate(`/admin/cursos/${c.id}`); else render();
    }

    const qa = el.closest<HTMLElement>('[data-quiz-accion]');
    if (qa) {
      const f = qa.closest('form') as HTMLFormElement; const q = quizDesdeForm(f); const [acc, idx] = qa.dataset.quizAccion!.split(':');
      if (acc === 'agregar') q.preguntas.push({ q: '', opciones: ['', '', '', ''], correcta: 0, explicacion: '' });
      if (acc === 'quitar') q.preguntas.splice(Number(idx), 1);
      q.estado = 'borrador'; Datos.guardarQuiz(q); render();
    }

    const dias = el.closest<HTMLElement>('[data-dias]');
    if (dias) { const inp = dias.closest('form')!.querySelector<HTMLInputElement>('[name="dias"]')!; inp.value = dias.dataset.dias!; }

    const rev = el.closest<HTMLElement>('[data-revocar-cortesia]');
    if (rev && confirm('¿Revocar la cortesía ahora?')) {
      const uid = rev.dataset.revocarCortesia!;
      if (Datos.modo === 'api') { try { await api(`/admin/miembros/${encodeURIComponent(uid)}/cortesia`, { method: 'DELETE' }); invalidarAdmin('miembros', 'resumen'); await cargarAdmin(current().path, true); } catch (err) { toast(mensajeError(err), 'circle-alert'); return; } }
      else { const m = Datos.miembros().find((x) => x.uid === uid)!; m.cortesiaHasta = null; m.cortesiaMotivo = ''; Datos.guardarMiembro(m); }
      toast('Cortesía revocada'); render();
    }

    const bc = el.closest<HTMLElement>('[data-borrar-curso]');
    if (bc && confirm('¿Borrar este curso? No se puede deshacer.')) { const id = bc.dataset.borrarCurso!; if (Datos.modo === 'api') { try { await api(`/admin/cursos/${encodeURIComponent(id)}`, { method: 'DELETE' }); await recargar('cursos', 'resumen'); } catch (err) { toast(mensajeError(err), 'circle-alert'); return; } } else Datos.borrarCurso(id); toast('Curso borrado', 'trash-2'); navigate('/admin/cursos'); }
    const bm = el.closest<HTMLElement>('[data-borrar-material]');
    if (bm && confirm('¿Borrar este material?')) { const id = bm.dataset.borrarMaterial!; if (Datos.modo === 'api') { try { await api(`/admin/materiales/${encodeURIComponent(id)}`, { method: 'DELETE' }); await recargar('materiales', 'resumen'); } catch (err) { toast(mensajeError(err), 'circle-alert'); return; } } else Datos.borrarMaterial(id); toast('Material borrado', 'trash-2'); navigate('/admin/materiales'); }
    const be = el.closest<HTMLElement>('[data-borrar-evento]');
    if (be && confirm('¿Borrar esta clase en vivo?')) { const id = be.dataset.borrarEvento!; if (Datos.modo === 'api') { try { await api(`/admin/eventos/${encodeURIComponent(id)}`, { method: 'DELETE' }); await recargar('eventos', 'resumen'); } catch (err) { toast(mensajeError(err), 'circle-alert'); return; } } else Datos.borrarEvento(id); toast('Clase borrada', 'trash-2'); navigate('/admin/en-vivo'); }
    const ba = el.closest<HTMLElement>('[data-borrar-aviso]');
    if (ba && confirm('¿Borrar este aviso?')) { const id = ba.dataset.borrarAviso!; if (Datos.modo === 'api') { try { await api(`/admin/avisos/${encodeURIComponent(id)}`, { method: 'DELETE' }); await recargar('avisos'); } catch (err) { toast(mensajeError(err), 'circle-alert'); return; } } else Datos.borrarAviso(id); toast('Aviso eliminado', 'trash-2'); render(); }
    const oh = el.closest<HTMLElement>('[data-ocultar-hilo]');
    if (oh) { const id = oh.dataset.ocultarHilo!; if (Datos.modo === 'api') { const hilo = AdminRemoto.foro().find((h) => h.id === id); try { await api(`/admin/foro/${encodeURIComponent(id)}`, { method: 'PATCH', json: { oculto: !hilo?.oculto } }); await recargar('foro'); } catch (err) { toast(mensajeError(err), 'circle-alert'); return; } } else Comunidad.alternarOculto(id); render(); }
    if (el.closest('[data-restablecer-demo]') && confirm('Esto borra todos los cambios hechos en el demo. ¿Continuar?')) { Datos.restablecerDemo(); toast('Demo restablecido', 'rotate-ccw'); render(); }
  });

  document.addEventListener('change', async (e) => {
    const inp = e.target as HTMLInputElement;
    if (inp.matches('[data-duracion-cupon]')) {
      const campo = inp.closest('form')?.querySelector<HTMLElement>('[data-dias-cupon]');
      const dias = campo?.querySelector<HTMLInputElement>('input');
      if (campo && dias) { campo.hidden = inp.value !== 'personalizada'; dias.disabled = campo.hidden; dias.required = !campo.hidden; }
      return;
    }
    if (!inp.matches('[data-subir-imagen]') || !inp.files?.[0]) return;
    const campo = inp.dataset.subirImagen!;
    const form = inp.closest('form')!;
    try {
      const url = Datos.modo === 'api' ? URL.createObjectURL(inp.files[0]) : await imagenAWebp(inp.files[0]);
      if (Datos.modo !== 'api') form.querySelector<HTMLInputElement>(`input[name="${campo}"]`)!.value = url;
      form.querySelector<HTMLImageElement>(`[data-preview="${campo}"]`)!.src = url;
      toast('Imagen lista · guarda para subirla', 'image');
    } catch { toast('No se pudo leer la imagen', 'alert-triangle'); }
  });
}
