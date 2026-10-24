import { createIcons, icons } from 'lucide';
import {
  Directorio,
  prepararFotoDirectorio,
  prepararBannerDirectorio,
  type ImagenDirectorioPreparada,
} from '../core/directorio';
import { Auth, mensajeError } from '../core/auth';
import { Datos } from '../core/datos';
import { mostrarPaywall } from '../core/acceso';

let fotoDirectorioPendiente: ImagenDirectorioPreparada | null = null;
let quitarFotoDirectorio = false;
let bannerDirectorioPendiente: ImagenDirectorioPreparada | null = null;
let quitarBannerDirectorio = false;

function limpiarFotoDirectorioPendiente() {
  if (fotoDirectorioPendiente) URL.revokeObjectURL(fotoDirectorioPendiente.preview);
  fotoDirectorioPendiente = null;
  quitarFotoDirectorio = false;
  if (bannerDirectorioPendiente) URL.revokeObjectURL(bannerDirectorioPendiente.preview);
  bannerDirectorioPendiente = null;
  quitarBannerDirectorio = false;
}

export function instalarInteraccionesDirectorio(
  toast: (msg: string, icon?: string) => void,
  render: () => Promise<void> | void,
  navigate: (p: string) => void
) {
  // Al salir del módulo de perfil sin guardar, descartar la foto/portada seleccionadas.
  window.addEventListener('hashchange', () => {
    if (!location.hash.startsWith('#/directorio/perfil')) limpiarFotoDirectorioPendiente();
  });

  document.addEventListener('click', async (e) => {
    const el = e.target as HTMLElement;

    const verPerfil = el.closest<HTMLElement>('[data-network-view]');
    if (verPerfil) {
      const dialog = [...document.querySelectorAll<HTMLDialogElement>('[data-network-view-dialog]')].find(
        (d) => d.dataset.networkViewDialog === verPerfil.dataset.uid
      );
      if (dialog) {
        dialog.scrollTop = 0;
        dialog.showModal();
        createIcons({ icons });
      }
      return;
    }

    if (el.closest('[data-network-job]')) {
      if (!Auth.usuario?.esVip && Datos.modo === 'api') {
        mostrarPaywall('Publicar espacios y aparatología es un beneficio VIP. Puedes explorar perfiles y conectar gratis.');
        return;
      }
      const dialog = document.querySelector<HTMLDialogElement>('[data-network-job-dialog]');
      if (dialog) {
        dialog.showModal();
        createIcons({ icons });
      }
      return;
    }

    if (el.closest('[data-network-close]')) {
      el.closest<HTMLDialogElement>('dialog')?.close();
      return;
    }

    const nudgeSkip = el.closest<HTMLButtonElement>('[data-network-nudge-skip]');
    if (nudgeSkip) {
      try { sessionStorage.setItem('dermalysse:directorio:nudge', 'omitido'); } catch { /* storage bloqueado */ }
      nudgeSkip.disabled = true;
      try {
        await Directorio.asegurarPerfil();
        toast('Te creamos un perfil básico; puedes completarlo cuando quieras.', 'user-round-check');
      } catch (err) {
        toast(mensajeError(err), 'circle-alert');
      }
      await render();
      return;
    }

    if (el.closest('[data-network-photo-remove]')) {
      if (fotoDirectorioPendiente) URL.revokeObjectURL(fotoDirectorioPendiente.preview);
      fotoDirectorioPendiente = null;
      quitarFotoDirectorio = true;
      const dialog = el.closest<HTMLDialogElement>('dialog');
      const preview = dialog?.querySelector<HTMLImageElement>('[data-network-photo-preview]');
      if (preview) {
        preview.hidden = true;
        preview.removeAttribute('src');
      }
      const boton = dialog?.querySelector<HTMLElement>('[data-network-photo-remove]');
      if (boton) boton.hidden = true;
      toast('La foto se quitará al guardar el perfil', 'image-minus');
      return;
    }

    if (el.closest('[data-network-banner-remove]')) {
      if (bannerDirectorioPendiente) URL.revokeObjectURL(bannerDirectorioPendiente.preview);
      bannerDirectorioPendiente = null;
      quitarBannerDirectorio = true;
      const dialog = el.closest<HTMLDialogElement>('dialog');
      const preview = dialog?.querySelector<HTMLImageElement>('[data-network-banner-preview]');
      if (preview) {
        preview.hidden = true;
        preview.removeAttribute('src');
      }
      dialog?.querySelector('[data-network-banner-frame]')?.classList.remove('has-banner');
      const boton = dialog?.querySelector<HTMLElement>('[data-network-banner-remove]');
      if (boton) boton.hidden = true;
      toast('La portada se quitará al guardar el perfil', 'image-minus');
      return;
    }

    const agregarFila = el.closest<HTMLButtonElement>('[data-network-add-row]');
    if (agregarFila) {
      const form = agregarFila.closest<HTMLFormElement>('[data-network-profile-form]');
      const tipo = agregarFila.dataset.networkAddRow || '';
      const lista = form?.querySelector<HTMLElement>(`[data-network-repeat-list="${tipo}"]`);
      const plantilla = form?.querySelector<HTMLTemplateElement>(`template[data-network-template="${tipo}"]`);
      const maximos: Record<string, number> = { experiencia: 8, formacion: 8, credenciales: 12 };
      if (!lista || !plantilla) return;
      if (lista.querySelectorAll('[data-network-repeat-row]').length >= (maximos[tipo] || 8)) {
        toast('Llegaste al máximo de registros de esta sección.', 'circle-alert');
        return;
      }
      lista.append(plantilla.content.cloneNode(true));
      createIcons({ icons });
      const rows = lista.querySelectorAll('[data-network-repeat-row]');
      rows[rows.length - 1]?.querySelector<HTMLInputElement>('input')?.focus();
      return;
    }

    const quitarFila = el.closest<HTMLButtonElement>('[data-network-remove-row]');
    if (quitarFila) {
      quitarFila.closest('[data-network-repeat-row]')?.remove();
      return;
    }

    const connect = el.closest<HTMLElement>('[data-network-connect]');
    if (connect) {
      el.closest<HTMLDialogElement>('dialog')?.close();
      const dialog = document.querySelector<HTMLDialogElement>('[data-network-connect-dialog]');
      if (!dialog) return;
      const form = dialog.querySelector<HTMLFormElement>('[data-network-connect-form]')!;
      form.querySelector<HTMLInputElement>('input[name="paraUid"]')!.value = connect.dataset.uid || '';
      form.querySelector<HTMLInputElement>('input[name="oportunidadId"]')!.value = connect.dataset.opportunity || '';
      const name = dialog.querySelector<HTMLElement>('[data-network-name]');
      if (name) name.textContent = connect.dataset.name || 'Colega';
      dialog.showModal();
      createIcons({ icons });
      return;
    }

    const answer = el.closest<HTMLElement>('[data-network-answer]');
    if (answer) {
      try {
        await Directorio.responder(answer.dataset.id!, answer.dataset.networkAnswer as 'aceptada' | 'rechazada');
        toast(
          answer.dataset.networkAnswer === 'aceptada' ? 'Conexión aceptada · contacto revelado' : 'Solicitud declinada',
          answer.dataset.networkAnswer === 'aceptada' ? 'handshake' : 'x'
        );
        await render();
      } catch (err) {
        toast(mensajeError(err), 'circle-alert');
      }
      return;
    }

    const cargarMas = el.closest<HTMLButtonElement>('[data-network-load-more]');
    if (cargarMas) {
      cargarMas.disabled = true;
      try {
        await Directorio.cargar(cargarMas.dataset.networkLoadMore as 'perfiles' | 'oportunidades');
        await render();
      } catch (err) {
        toast(mensajeError(err), 'circle-alert');
        cargarMas.disabled = false;
      }
      return;
    }

    const cerrarOportunidad = el.closest<HTMLButtonElement>('[data-network-close-job]');
    if (cerrarOportunidad) {
      const id = cerrarOportunidad.dataset.networkCloseJob!;
      if (!confirm('¿Cerrar esta publicación? Dejará de aceptar nuevas solicitudes de contacto.')) return;
      cerrarOportunidad.disabled = true;
      try {
        await Directorio.cerrarOportunidad(id);
        toast('Publicación cerrada', 'archive');
        await render();
      } catch (err) {
        toast(mensajeError(err), 'circle-alert');
        cerrarOportunidad.disabled = false;
      }
      return;
    }

    const eliminarPerfil = el.closest<HTMLButtonElement>('[data-network-delete-profile]');
    if (eliminarPerfil) {
      if (
        !confirm(
          '¿Eliminar tu perfil del directorio? Se cerrarán tus publicaciones y solicitudes pendientes. Tus cursos y cuenta no se alterarán.'
        )
      )
        return;
      eliminarPerfil.disabled = true;
      try {
        await Directorio.eliminarPerfil();
        limpiarFotoDirectorioPendiente();
        toast('Perfil retirado del directorio', 'user-round-x');
        navigate('/directorio');
      } catch (err) {
        toast(mensajeError(err), 'circle-alert');
        eliminarPerfil.disabled = false;
      }
      return;
    }

    const reportar = el.closest<HTMLElement>('[data-network-report]');
    if (reportar) {
      el.closest<HTMLDialogElement>('dialog')?.close();
      const dialog = document.querySelector<HTMLDialogElement>('[data-network-report-dialog]');
      if (!dialog) return;
      const form = dialog.querySelector<HTMLFormElement>('[data-network-report-form]')!;
      form.reset();
      form.querySelector<HTMLInputElement>('input[name="tipo"]')!.value = reportar.dataset.type || '';
      form.querySelector<HTMLInputElement>('input[name="objetivoId"]')!.value = reportar.dataset.id || '';
      const nombre = dialog.querySelector<HTMLElement>('[data-network-report-name]');
      if (nombre) nombre.textContent = reportar.dataset.name || 'contenido';
      dialog.showModal();
      createIcons({ icons });
      return;
    }
  });

  document.addEventListener('change', async (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;

    if (input.matches('[data-network-profile-form] select[name="contactoCanal"]')) {
      const fila = input.closest('form')?.querySelector<HTMLElement>('[data-network-whatsapp]');
      if (fila) fila.hidden = input.value !== 'whatsapp';
      return;
    }

    if (input.matches('[data-network-photo-input]') && input instanceof HTMLInputElement) {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const preparada = await prepararFotoDirectorio(file);
        if (fotoDirectorioPendiente) URL.revokeObjectURL(fotoDirectorioPendiente.preview);
        fotoDirectorioPendiente = preparada;
        quitarFotoDirectorio = false;
        const cont = input.closest<HTMLElement>('[data-network-profile-form]');
        const preview = cont?.querySelector<HTMLImageElement>('[data-network-photo-preview]');
        if (preview) {
          preview.src = preparada.preview;
          preview.hidden = false;
        }
        const boton = cont?.querySelector<HTMLElement>('[data-network-photo-remove]');
        if (boton) boton.hidden = false;
        toast('Foto lista para guardar', 'image');
      } catch (err) {
        toast(mensajeError(err), 'circle-alert');
      } finally {
        input.value = '';
      }
      return;
    }

    if (input.matches('[data-network-banner-input]') && input instanceof HTMLInputElement) {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const preparada = await prepararBannerDirectorio(file);
        if (bannerDirectorioPendiente) URL.revokeObjectURL(bannerDirectorioPendiente.preview);
        bannerDirectorioPendiente = preparada;
        quitarBannerDirectorio = false;
        const cont = input.closest<HTMLElement>('[data-network-profile-form]');
        const preview = cont?.querySelector<HTMLImageElement>('[data-network-banner-preview]');
        if (preview) {
          preview.src = preparada.preview;
          preview.hidden = false;
        }
        cont?.querySelector('[data-network-banner-frame]')?.classList.add('has-banner');
        const boton = cont?.querySelector<HTMLElement>('[data-network-banner-remove]');
        if (boton) boton.hidden = false;
        toast('Portada lista para guardar', 'image');
      } catch (err) {
        toast(mensajeError(err), 'circle-alert');
      } finally {
        input.value = '';
      }
      return;
    }
  });

  document.addEventListener('submit', async (e) => {
    const f = e.target;
    if (!(f instanceof HTMLFormElement)) return;

    if (f.matches('[data-network-search]')) {
      e.preventDefault();
      const q = String(new FormData(f).get('q') || '').trim();
      const vista = String(new FormData(f).get('vista') || 'personas');
      const params = new URLSearchParams();
      if (vista) params.set('vista', vista);
      if (q) params.set('q', q);
      navigate(`/directorio?${params}`);
      return;
    }

    if (f.matches('[data-network-profile-form]')) {
      e.preventDefault();
      const d = new FormData(f);
      const csv = (n: string) =>
        String(d.get(n) || '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
      const todos = (n: string) => d.getAll(n).map((x) => String(x).trim());
      const experienciaPuestos = todos('experienciaPuesto');
      const experienciaOrganizaciones = todos('experienciaOrganizacion');
      const experienciaPeriodos = todos('experienciaPeriodo');
      const experienciaDescripciones = todos('experienciaDescripcion');
      const experiencia = experienciaPuestos.map((puesto, i) => ({
        puesto,
        organizacion: experienciaOrganizaciones[i] || '',
        periodo: experienciaPeriodos[i] || '',
        descripcion: experienciaDescripciones[i] || '',
      }));

      const formacionProgramas = todos('formacionPrograma');
      const formacionInstituciones = todos('formacionInstitucion');
      const formacionPeriodos = todos('formacionPeriodo');
      const formacion = formacionProgramas.map((programa, i) => ({
        programa,
        institucion: formacionInstituciones[i] || '',
        periodo: formacionPeriodos[i] || '',
      }));

      const credencialNombres = todos('credencialNombre');
      const credencialEmisores = todos('credencialEmisor');
      const credencialAnios = todos('credencialAnio');
      const credenciales = credencialNombres.map((nombre, i) => ({
        nombre,
        emisor: credencialEmisores[i] || '',
        anio: credencialAnios[i] || '',
      }));

      const anosExperiencia = String(d.get('anosExperiencia') || '').trim();
      const boton = f.querySelector<HTMLButtonElement>('footer button[type="submit"], footer button:not([type])');
      if (boton) boton.disabled = true;
      try {
        await Directorio.guardarPerfil(
          {
            titular: String(d.get('titular') || '').trim(),
            etapa: String(d.get('etapa')),
            especialidades: csv('especialidades'),
            ciudad: String(d.get('ciudad') || '').trim(),
            estado: String(d.get('estado') || '').trim(),
            modalidades: [String(d.get('modalidad'))],
            disponibilidad: d.getAll('disponibilidad').map(String),
            habilidades: csv('habilidades'),
            idiomas: csv('idiomas'),
            anosExperiencia: anosExperiencia ? Number(anosExperiencia) : null,
            experiencia,
            formacion,
            credenciales,
            bio: String(d.get('bio') || '').trim(),
            visible: d.get('visible') === '1',
            contacto: {
              canal: String(d.get('contactoCanal')),
              valor: String(d.get('contactoValor') || '').trim(),
            },
          },
          fotoDirectorioPendiente,
          quitarFotoDirectorio,
          bannerDirectorioPendiente,
          quitarBannerDirectorio
        );
        limpiarFotoDirectorioPendiente();
        toast('Perfil cosmetológico actualizado', 'badge-check');
        navigate('/directorio');
      } catch (err) {
        toast(mensajeError(err), 'circle-alert');
        if (boton) boton.disabled = false;
      }
      return;
    }

    if (f.matches('[data-network-job-form]')) {
      e.preventDefault();
      const d = new FormData(f);
      const especialidades = String(d.get('especialidades') || '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      try {
        await Directorio.publicar({
          titulo: String(d.get('titulo')),
          tipo: String(d.get('tipo')),
          organizacion: String(d.get('organizacion')),
          modalidad: String(d.get('modalidad')),
          ciudad: String(d.get('ciudad') || ''),
          entidad: String(d.get('entidad') || ''),
          especialidades,
          resumen: String(d.get('resumen')),
          requisitos: String(d.get('requisitos') || ''),
          compensacion: String(d.get('compensacion') || ''),
        });
        f.closest<HTMLDialogElement>('dialog')?.close();
        toast('Publicación activa por 45 días', 'briefcase-business');
        if (location.hash === '#/directorio?vista=oportunidades') await render();
        else navigate('/directorio?vista=oportunidades');
      } catch (err) {
        toast(mensajeError(err), 'circle-alert');
      }
      return;
    }

    if (f.matches('[data-network-connect-form]')) {
      e.preventDefault();
      const d = new FormData(f);
      try {
        await Directorio.conectar(
          String(d.get('paraUid')),
          String(d.get('oportunidadId') || '') || null,
          String(d.get('mensaje') || '').trim()
        );
        f.closest<HTMLDialogElement>('dialog')?.close();
        toast('Solicitud enviada de forma privada', 'send');
        navigate('/directorio?vista=conexiones');
      } catch (err) {
        toast(mensajeError(err), 'circle-alert');
      }
      return;
    }

    if (f.matches('[data-network-report-form]')) {
      e.preventDefault();
      const d = new FormData(f);
      try {
        await Directorio.reportar(
          String(d.get('tipo')) as 'perfil' | 'oportunidad',
          String(d.get('objetivoId')),
          String(d.get('motivo')),
          String(d.get('detalle') || '')
        );
        f.closest<HTMLDialogElement>('dialog')?.close();
        toast('Reporte enviado a moderación de forma confidencial', 'shield-check');
      } catch (err) {
        toast(mensajeError(err), 'circle-alert');
      }
      return;
    }
  });
}
