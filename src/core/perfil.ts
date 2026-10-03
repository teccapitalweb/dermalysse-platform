// Perfil del miembro. En API se hidrata desde /me y se conserva por cuenta como caché local.
export interface AvisosPerfil { enVivo: boolean; nuevos: boolean; comunidad: boolean }
export interface Perfil {
  nombre: string;
  foto: string;
  whatsapp: string;
  especialidad: string;
  ciudad: string;
  plan: 'mensual' | 'anual' | 'cortesia' | 'cupon' | 'invitado';
  vence: string;
  avisos: AvisosPerfil;
}

export interface PerfilRemoto {
  nombre?: string;
  foto?: string;
  whatsapp?: string;
  especialidad?: string;
  ciudad?: string;
  avisos?: Partial<AvisosPerfil>;
}
type CambiosPerfil = Partial<Omit<Perfil, 'avisos'>> & { avisos?: Partial<AvisosPerfil> };

const KEY = 'dermalysse:perfil:v2';
const DEF: Perfil = {
  nombre: '', foto: '', whatsapp: '', especialidad: '', ciudad: '', plan: 'invitado', vence: '',
  avisos: { enVivo: true, nuevos: true, comunidad: false },
};

let usuarioActivo = 'anonimo';

function llave() { return `${KEY}:${usuarioActivo}`; }

function normalizar(p: CambiosPerfil = {}): Perfil {
  return {
    ...DEF,
    ...p,
    avisos: { ...DEF.avisos, ...(p.avisos ?? {}) },
  };
}

function leer(): Perfil {
  try { return normalizar(JSON.parse(localStorage.getItem(llave()) || '{}')); }
  catch { return normalizar(); }
}

function escribir(p: Perfil) {
  try { localStorage.setItem(llave(), JSON.stringify(p)); } catch {}
}

export const Perfil = {
  usarUsuario(uid: string | null, datos?: CambiosPerfil) {
    usuarioActivo = uid || 'anonimo';
    if (datos) escribir(normalizar(datos));
  },
  get(): Perfil { return leer(); },
  set(p: CambiosPerfil): Perfil {
    const actual = leer();
    const siguiente = normalizar({ ...actual, ...p, avisos: { ...actual.avisos, ...(p.avisos ?? {}) } });
    escribir(siguiente);
    return siguiente;
  },
  hidratar(p: PerfilRemoto, membresia?: { plan?: string | null; vence?: string | null }, nombreAlterno = '', fotoAlterna = ''): Perfil {
    const plan = membresia?.plan === 'mensual' || membresia?.plan === 'anual' || membresia?.plan === 'cortesia' || membresia?.plan === 'cupon' ? membresia.plan : 'invitado';
    const siguiente = normalizar({
      nombre: p.nombre?.trim() || nombreAlterno.trim(),
      foto: p.foto?.trim() || fotoAlterna.trim(),
      whatsapp: p.whatsapp?.trim() || '',
      especialidad: p.especialidad?.trim() || '',
      ciudad: p.ciudad?.trim() || '',
      avisos: { ...DEF.avisos, ...(p.avisos ?? {}) },
      plan,
      vence: membresia?.vence || '',
    });
    escribir(siguiente);
    return siguiente;
  },
  fichaCompleta() { return !!leer().whatsapp.trim(); },
  iniciales() { return leer().nombre.replace(/^(Dra?\.|Ing\.|Lic\.)\s*/i, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'VP'; },
  primerNombre() { return leer().nombre.replace(/^(Dra?\.|Ing\.|Lic\.)\s*/i, '').split(' ')[0] || ''; },
  tratamiento() { const n = leer().nombre; const m = n.match(/^(Dra?\.)/i); return m ? `${m[1]} ${n.replace(/^(Dra?\.)\s*/i, '').split(' ').pop()}` : n.split(' ')[0] || ''; },
};
