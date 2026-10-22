import { invalidarClub } from './remoto';
// Autenticación.
// Modo api: Firebase Auth sobre el proyecto `club-dermalysse` (las mismas cuentas del club actual).
//   El rol de administrador y la membresía vienen SOLO de GET /me (esAdmin = existe admins/{uid});
//   el club actual no usa custom claims, así que el token nunca decide permisos en el cliente.
// Modo demo: sesión simulada en el navegador para poder recorrer la app y el admin sin credenciales.
import type { Auth as AuthFirebase, User } from '@firebase/auth';
import { Datos } from './datos';
import { FIREBASE_CONFIG } from './firebase-config';
import { Perfil, type PerfilRemoto } from './perfil';
import { Progreso } from './progreso';
import { usarUsuarioHistoria, type ProgresoHistoria } from './historia';

export interface Usuario { uid: string; email: string; nombre: string; foto: string; esAdmin: boolean; esVip: boolean; cursoGratis: string | null }

interface RespuestaMe {
  uid: string;
  email: string;
  nombre?: string;
  esVip: boolean;
  esAdmin: boolean;
  plan: string | null;
  vence: string | null;
  motivoAcceso?: string;
  cursoGratis?: string | null;
  perfil: PerfilRemoto;
}

const API = import.meta.env.VITE_API_URL as string | undefined;
const DEMO_KEY = 'dermalysse:demo-sesion';

let fb: typeof import('@firebase/auth') | null = null;
let authInst: AuthFirebase | null = null;
let usuario: Usuario | null = null;
let listo: Promise<void> | null = null;
let suscrito = false;
/** Mientras se revisa un alta (registro o Google), el observador no sincroniza con /me. */
let altaEnRevision = false;
/** Sincronización en curso o terminada para un uid; evita llamar /me dos veces por el mismo inicio. */
let sync: { uid: string | null; p: Promise<void> } | null = null;
/** Último error al confirmar la cuenta con el servidor (se muestra una vez al miembro). */
let errorEstado: string | null = null;

const errorAuth = (code: string, message: string) => Object.assign(new Error(message), { code });

async function cargarFirebase() {
  if (authInst && fb) return;
  const { initializeApp, getApps } = await import('@firebase/app');
  fb = await import('@firebase/auth');
  const app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
  authInst = fb.getAuth(app);
  // Los correos de Firebase (verificación y contraseña) salen en español.
  authInst.languageCode = 'es';
  await fb.setPersistence(authInst, fb.browserLocalPersistence);
}

function limpiarSesionLocal() {
  usuario = null;
  Perfil.usarUsuario(null);
  Progreso.usarUsuario(null);
  usarUsuarioHistoria(null);
}

/** Carga perfil, membresía y progreso reales de la cuenta de Firebase. */
async function cargarSesion(u: User | null) {
  invalidarClub();
  if (!u) { limpiarSesionLocal(); return; }
  const nombreCuenta = u.displayName || u.email?.split('@')[0] || '';
  let me: RespuestaMe | null = null;
  let progreso: Record<string, { vistas: number[]; ultima: number; actualizado: string; historial?: string[] }> | null = null;
  let historia: ProgresoHistoria | null = null;
  errorEstado = null;
  // /me es obligatorio para conocer la membresía; progreso e historia pueden faltar sin bloquear el acceso.
  const [rMe, rProgreso, rHistoria] = await Promise.allSettled([api<RespuestaMe>('/me'), api<typeof progreso>('/progreso'), api<ProgresoHistoria>('/historia')]);
  if (authInst?.currentUser !== u) return;
  if (rMe.status === 'fulfilled') me = rMe.value;
  else errorEstado = `No pudimos confirmar tu membresía con el servidor (${mensajeError(rMe.reason)}). Mientras tanto verás el contenido gratuito; vuelve a intentar en un momento.`;
  if (rProgreso.status === 'fulfilled') progreso = rProgreso.value;
  if (rHistoria.status === 'fulfilled') historia = rHistoria.value;
  if (me && u.photoURL && me.perfil?.foto !== u.photoURL) {
    try { me.perfil = await api<PerfilRemoto>('/me/perfil', { method: 'PATCH', json: { foto: u.photoURL } }); } catch { /* conserva la foto local si no se pudo sincronizar */ }
  }
  if (authInst?.currentUser !== u) return;
  Perfil.usarUsuario(u.uid);
  Progreso.usarUsuario(u.uid);
  if (progreso) Progreso.hidratar(progreso);
  const p = me
    ? Perfil.hidratar(me.perfil || {}, { plan: me.plan, vence: me.vence }, me.nombre || nombreCuenta, u.photoURL || '')
    : Perfil.set({ nombre: nombreCuenta });
  usuario = {
    uid: u.uid,
    email: u.email || me?.email || '',
    nombre: p.nombre || nombreCuenta,
    foto: u.photoURL || '',
    esAdmin: me?.esAdmin === true,
    esVip: me?.esVip === true,
    cursoGratis: (me?.esVip ? null : me?.cursoGratis) ?? null,
  };
  const historiaUnida = usarUsuarioHistoria(u.uid, historia);
  if (historia) {
    try { await api<ProgresoHistoria>('/historia', { method: 'PATCH', json: historiaUnida }); } catch { /* se reintenta al volver a iniciar */ }
  }
}

function sincronizar(u: User | null, forzar = false): Promise<void> {
  const uid = u?.uid ?? null;
  if (!forzar && sync && sync.uid === uid) return sync.p;
  const p = cargarSesion(u);
  sync = { uid, p };
  return p;
}

export const Auth = {
  modo: Datos.modo,
  get usuario() { return usuario; },
  /** Devuelve (y olvida) el último error al confirmar la cuenta con /me. */
  tomarErrorEstado() { const e = errorEstado; errorEstado = null; return e; },

  iniciar(): Promise<void> {
    if (listo) return listo;
    listo = (async () => {
      if (Datos.modo === 'demo') {
        usuario = localStorage.getItem(DEMO_KEY) ? { uid: 'demo', email: 'demo@dermalysse.local', nombre: 'Modo demo', foto: '', esAdmin: true, esVip: !!localStorage.getItem('dermalysse:vip-sim'), cursoGratis: localStorage.getItem('dermalysse:curso-gratis') || null } : null;
        if (usuario) { Perfil.usarUsuario(usuario.uid); Progreso.usarUsuario(usuario.uid); usarUsuarioHistoria(usuario.uid); Perfil.set({ nombre: usuario.nombre, plan: usuario.esVip ? 'anual' : 'invitado' }); }
        else { Perfil.usarUsuario(null); Progreso.usarUsuario(null); usarUsuarioHistoria(null); }
        return;
      }
      await cargarFirebase();
      if (suscrito) { if (sync) await sync.p; return; }
      suscrito = true;
      // Un solo observador para toda la vida de la página: inicio, cierre de sesión y cambios de cuenta.
      await new Promise<void>((ok) => {
        fb!.onAuthStateChanged(authInst!, (u) => {
          if (altaEnRevision) { ok(); return; }
          sincronizar(u).catch(() => { /* cargarSesion ya registra el error visible */ }).finally(ok);
        });
      });
      if (sync) await sync.p;
    })();
    return listo;
  },

  async entrarDemo() { localStorage.setItem(DEMO_KEY, '1'); listo = null; await this.iniciar(); },

  async entrarCorreo(email: string, pass: string) {
    await cargarFirebase();
    const cred = await fb!.signInWithEmailAndPassword(authInst!, email.trim(), pass);
    await this.iniciar();
    await sincronizar(cred.user);
  },

  /**
   * Alta con correo y contraseña. `registroAbierto` viene de GET /config; el servidor lo vuelve a validar.
   * La verificación del correo se envía pero no bloquea la entrada.
   */
  async registrar(nombre: string, email: string, pass: string, registroAbierto = true) {
    if (!registroAbierto) throw errorAuth('dermalysse/registro-cerrado', MENSAJE_REGISTRO_CERRADO);
    await cargarFirebase();
    altaEnRevision = true;
    try {
      const cred = await fb!.createUserWithEmailAndPassword(authInst!, email.trim(), pass);
      await fb!.updateProfile(cred.user, { displayName: nombre });
      // Token nuevo con el nombre para que /me cree users/{uid} y members/{uid} con el nombre correcto.
      await cred.user.getIdToken(true).catch(() => '');
      fb!.sendEmailVerification(cred.user).catch(() => { /* se puede reenviar desde Inicio */ });
      altaEnRevision = false;
      await this.iniciar();
      await sincronizar(cred.user, true);
    } finally { altaEnRevision = false; }
  },

  /**
   * Google en ventana emergente. Si el registro está cerrado y la cuenta es nueva, se cierra la
   * sesión antes de llamar a /me (que crearía users/{uid}); igual que el club actual.
   */
  async entrarGoogle(registroAbierto = true) {
    await cargarFirebase();
    altaEnRevision = !registroAbierto;
    try {
      const cred = await fb!.signInWithPopup(authInst!, new fb!.GoogleAuthProvider());
      if (!registroAbierto && fb!.getAdditionalUserInfo(cred)?.isNewUser) {
        await fb!.signOut(authInst!);
        altaEnRevision = false;
        await sincronizar(null, true);
        throw errorAuth('dermalysse/registro-cerrado', MENSAJE_REGISTRO_CERRADO);
      }
      altaEnRevision = false;
      await this.iniciar();
      await sincronizar(cred.user, !registroAbierto);
    } finally { altaEnRevision = false; }
  },

  async recuperar(email: string) {
    await cargarFirebase();
    await fb!.sendPasswordResetEmail(authInst!, email.trim());
  },
  /** Envía el enlace de verificación de Firebase al correo de la cuenta. */
  async enviarVerificacion() {
    if (Datos.modo === 'demo' || !authInst?.currentUser) return false;
    await fb!.sendEmailVerification(authInst.currentUser);
    return true;
  },
  /** Vuelve a consultar la cuenta: el enlace se abre en otra pestaña o dispositivo. */
  async correoVerificado() {
    if (Datos.modo === 'demo' || !authInst?.currentUser) return false;
    await authInst.currentUser.reload();
    // La API lee email_verified del ID token: renovarlo para que vea la verificación sin esperar una hora.
    if (authInst.currentUser.emailVerified) await authInst.currentUser.getIdToken(true).catch(() => '');
    return authInst.currentUser.emailVerified;
  },
  async refrescarEstado() {
    if (Datos.modo === 'demo' || !authInst?.currentUser) return null;
    const u = authInst.currentUser;
    const me = await api<RespuestaMe>('/me');
    const nombreCuenta = u.displayName || u.email?.split('@')[0] || '';
    const p = Perfil.hidratar(me.perfil || {}, { plan: me.plan, vence: me.vence }, me.nombre || nombreCuenta, u.photoURL || '');
    usuario = {
      uid: u.uid,
      email: u.email || me.email || '',
      nombre: p.nombre || nombreCuenta,
      foto: u.photoURL || '',
      esAdmin: me.esAdmin === true,
      esVip: me.esVip === true,
      cursoGratis: (me.esVip ? null : me.cursoGratis) ?? null,
    };
    invalidarClub();
    return me;
  },
  async salir() {
    invalidarClub();
    if (Datos.modo === 'demo') { localStorage.removeItem(DEMO_KEY); listo = null; }
    else if (authInst) { await fb!.signOut(authInst); await sincronizar(null, true); }
    limpiarSesionLocal();
  },
  async token() { return authInst?.currentUser ? authInst.currentUser.getIdToken() : null; },
};

export const MENSAJE_REGISTRO_CERRADO = 'El registro de cuentas nuevas está cerrado por ahora. Si ya eres miembro, entra con tu cuenta de siempre.';

// Cliente del backend (docs/INTEGRACION-PRODUCCION.md, sección 3)
export async function api<T>(ruta: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  if (!API) throw new Error('Sin VITE_API_URL: la app está en modo demo');
  const cuenta = authInst?.currentUser ?? null;
  const vigente = () => { if (cuenta !== (authInst?.currentUser ?? null)) throw new Error('La sesión cambió. Vuelve a intentarlo.'); };
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  const t = await cuenta?.getIdToken(); vigente(); if (t) headers.Authorization = `Bearer ${t}`;
  if (init.json !== undefined) { headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(init.json); }
  const r = await fetch(API.replace(/\/$/, '') + ruta, { ...init, headers });
  const data = await r.json().catch(() => ({}));
  vigente();
  // `datos`: el cuerpo del error (campos públicos extra, p. ej. motivo/desbloqueo en 403 de video).
  if (!r.ok) throw Object.assign(new Error(data.mensaje || (typeof data.error === 'string' && data.error.includes(' ') ? data.error : '') || `Error ${r.status}`), { status: r.status, codigo: data.error, datos: data });
  return data as T;
}

export const mensajeError = (e: any) => ({
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'No encontramos una cuenta con ese correo.',
  'auth/email-already-in-use': 'Ese correo ya tiene cuenta. Inicia sesión.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar.',
  'auth/cancelled-popup-request': 'Se cerró la ventana de Google antes de terminar.',
  'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Permite ventanas emergentes e intenta de nuevo.',
  'auth/unauthorized-domain': 'Este dominio todavía no está autorizado para iniciar sesión. Avísale a Dermalysse.',
  'auth/network-request-failed': 'Sin conexión con el servicio de acceso. Revisa tu internet.',
  'auth/user-disabled': 'Esta cuenta está desactivada. Contacta a Dermalysse.',
  'auth/account-exists-with-different-credential': 'Ese correo ya tiene cuenta con otro método. Entra con tu correo y contraseña.',
  'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
} as Record<string, string>)[e?.code] || e?.message || 'Algo salió mal. Intenta de nuevo.';
