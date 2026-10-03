// Autenticación. Modo api: Firebase Auth configurado únicamente mediante variables de entorno.
// Modo demo: sesión simulada en el navegador para poder recorrer la app y el admin sin credenciales.
import { Datos } from './datos';
import { Perfil, type PerfilRemoto } from './perfil';
import { Progreso } from './progreso';
import { usarUsuarioHistoria, type ProgresoHistoria } from './historia';

export interface Usuario { uid: string; email: string; nombre: string; foto: string; esAdmin: boolean; esVip: boolean }

interface RespuestaMe {
  uid: string;
  email: string;
  esVip: boolean;
  esAdmin: boolean;
  plan: string | null;
  vence: string | null;
  perfil: PerfilRemoto;
}

const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};
const API = import.meta.env.VITE_API_URL as string | undefined;
const DEMO_KEY = 'dermalysse:demo-sesion';

let fb: typeof import('@firebase/auth') | null = null;
let authInst: import('@firebase/auth').Auth | null = null;
let usuario: Usuario | null = null;
let listo: Promise<void> | null = null;

async function cargarFirebase() {
  if (!FIREBASE_CONFIG.apiKey || !FIREBASE_CONFIG.authDomain || !FIREBASE_CONFIG.projectId || !FIREBASE_CONFIG.appId) {
    throw new Error('Falta configurar Firebase para Dermalysse. Revisa las variables VITE_FIREBASE_* del entorno.');
  }
  const { initializeApp } = await import('@firebase/app');
  fb = await import('@firebase/auth');
  authInst = fb.getAuth(initializeApp(FIREBASE_CONFIG));
  await fb.setPersistence(authInst, fb.browserLocalPersistence);
}

export const Auth = {
  modo: Datos.modo,
  get usuario() { return usuario; },

  iniciar(): Promise<void> {
    if (listo) return listo;
    listo = (async () => {
      if (Datos.modo === 'demo') {
        usuario = localStorage.getItem(DEMO_KEY) ? { uid: 'demo', email: 'demo@dermalysse.local', nombre: 'Modo demo', foto: '', esAdmin: true, esVip: !!localStorage.getItem('dermalysse:vip-sim') } : null;
        if (usuario) { Perfil.usarUsuario(usuario.uid); Progreso.usarUsuario(usuario.uid); usarUsuarioHistoria(usuario.uid); Perfil.set({ nombre: usuario.nombre, plan: usuario.esVip ? 'anual' : 'invitado' }); }
        else { Perfil.usarUsuario(null); Progreso.usarUsuario(null); usarUsuarioHistoria(null); }
        return;
      }
      await cargarFirebase();
      await new Promise<void>((ok) => {
        fb!.onAuthStateChanged(authInst!, async (u) => {
          if (!u) { usuario = null; Perfil.usarUsuario(null); Progreso.usarUsuario(null); usarUsuarioHistoria(null); ok(); return; }
          const tok = await u.getIdTokenResult();
          const nombreGoogle = u.displayName || u.email?.split('@')[0] || '';
          let me: RespuestaMe | null = null;
          let progreso: Record<string, { vistas: number[]; ultima: number; actualizado: string; historial?: string[] }> | null = null;
          let historia: ProgresoHistoria | null = null;
          try { [me, progreso, historia] = await Promise.all([api<RespuestaMe>('/me'), api<typeof progreso>('/progreso'), api<ProgresoHistoria>('/historia')]); } catch { /* el backend dirá si no hay acceso */ }
          if (me && u.photoURL && me.perfil.foto !== u.photoURL) {
            try { me.perfil = await api<PerfilRemoto>('/me/perfil', { method: 'PATCH', json: { foto: u.photoURL } }); } catch { /* conserva la foto local si no se pudo sincronizar */ }
          }
          Perfil.usarUsuario(u.uid);
          Progreso.usarUsuario(u.uid);
          if (progreso) Progreso.hidratar(progreso);
          const p = me
            ? Perfil.hidratar(me.perfil, { plan: me.plan, vence: me.vence }, nombreGoogle, u.photoURL || '')
            : Perfil.set({ nombre: nombreGoogle });
          usuario = {
            uid: u.uid,
            email: u.email || '',
            nombre: p.nombre || nombreGoogle,
            foto: u.photoURL || '',
            esAdmin: tok.claims.admin === true || me?.esAdmin === true,
            esVip: me?.esVip === true,
          };
          const historiaUnida = usarUsuarioHistoria(u.uid, historia);
          if (historia) {
            try { await api<ProgresoHistoria>('/historia', { method: 'PATCH', json: historiaUnida }); } catch { /* se reintenta al volver a iniciar */ }
          }
          ok();
        });
      });
    })();
    return listo;
  },

  async entrarDemo() { localStorage.setItem(DEMO_KEY, '1'); listo = null; await this.iniciar(); },

  async entrarCorreo(email: string, pass: string) {
    if (!fb) await cargarFirebase();
    await fb!.signInWithEmailAndPassword(authInst!, email, pass); listo = null; await this.iniciar();
  },
  async registrar(nombre: string, email: string, pass: string) {
    if (!fb) await cargarFirebase();
    const cred = await fb!.createUserWithEmailAndPassword(authInst!, email, pass);
    await fb!.updateProfile(cred.user, { displayName: nombre }); listo = null; await this.iniciar();
  },
  async entrarGoogle() {
    if (!fb) await cargarFirebase();
    await fb!.signInWithPopup(authInst!, new fb!.GoogleAuthProvider()); listo = null; await this.iniciar();
  },
  async recuperar(email: string) {
    if (!fb) await cargarFirebase();
    await fb!.sendPasswordResetEmail(authInst!, email);
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
    return authInst.currentUser.emailVerified;
  },
  async refrescarEstado() {
    if (Datos.modo === 'demo' || !authInst?.currentUser) return null;
    const u = authInst.currentUser;
    const [me, tok] = await Promise.all([api<RespuestaMe>('/me'), u.getIdTokenResult()]);
    const nombreGoogle = u.displayName || u.email?.split('@')[0] || '';
    const p = Perfil.hidratar(me.perfil, { plan: me.plan, vence: me.vence }, nombreGoogle, u.photoURL || '');
    usuario = {
      uid: u.uid,
      email: u.email || '',
      nombre: p.nombre || nombreGoogle,
      foto: u.photoURL || '',
      esAdmin: tok.claims.admin === true || me.esAdmin === true,
      esVip: me.esVip === true,
    };
    return me;
  },
  async salir() {
    if (Datos.modo === 'demo') localStorage.removeItem(DEMO_KEY);
    else if (authInst) await fb!.signOut(authInst);
    usuario = null; listo = null;
    Perfil.usarUsuario(null);
    Progreso.usarUsuario(null);
    usarUsuarioHistoria(null);
  },
  async token() { return authInst?.currentUser ? authInst.currentUser.getIdToken() : null; },
};

// Cliente del backend (docs/contrato.md)
export async function api<T>(ruta: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  if (!API) throw new Error('Sin VITE_API_URL: la app está en modo demo');
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  const t = await Auth.token(); if (t) headers.Authorization = `Bearer ${t}`;
  if (init.json !== undefined) { headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(init.json); }
  const r = await fetch(API.replace(/\/$/, '') + ruta, { ...init, headers });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.mensaje || `Error ${r.status}`), { status: r.status, codigo: data.error });
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
  'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
} as Record<string, string>)[e?.code] || e?.message || 'Algo salió mal. Intenta de nuevo.';
