// Configuración web de Firebase para el proyecto `club-dermalysse` (el mismo del club actual).
//
// Decisión documentada (15 de octubre de 2026): la configuración WEB de Firebase no es un secreto.
// Identifica el proyecto y viaja en el HTML público de club.dermalyssemx.com; la seguridad la dan
// las reglas de Firestore, los dominios autorizados de Firebase Auth y la verificación del ID token
// en la API. Por eso se usan esos mismos valores como respaldo, para que un build de producción
// funcione con solo VITE_API_URL. Si se define cualquier VITE_FIREBASE_*, esa variable manda.
//
// Nunca agregar aquí cuentas de servicio, llaves privadas ni secretos del servidor.
export interface ConfigFirebaseWeb {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const CLUB_DERMALYSSE_PUBLICO: ConfigFirebaseWeb = {
  apiKey: 'AIzaSyC3EQ9hcS7wusPAgmL3LvCyB_QV_kpIP4g',
  authDomain: 'club-dermalysse.firebaseapp.com',
  projectId: 'club-dermalysse',
  storageBucket: 'club-dermalysse.firebasestorage.app',
  messagingSenderId: '1075584613391',
  appId: '1:1075584613391:web:71abdd47c4364a27daf77a',
};

const env = (valor: unknown, respaldo: string) => (typeof valor === 'string' && valor.trim() ? valor.trim() : respaldo);

export const FIREBASE_CONFIG: ConfigFirebaseWeb = {
  apiKey: env(import.meta.env.VITE_FIREBASE_API_KEY, CLUB_DERMALYSSE_PUBLICO.apiKey),
  authDomain: env(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, CLUB_DERMALYSSE_PUBLICO.authDomain),
  projectId: env(import.meta.env.VITE_FIREBASE_PROJECT_ID, CLUB_DERMALYSSE_PUBLICO.projectId),
  storageBucket: env(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, CLUB_DERMALYSSE_PUBLICO.storageBucket),
  messagingSenderId: env(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, CLUB_DERMALYSSE_PUBLICO.messagingSenderId),
  appId: env(import.meta.env.VITE_FIREBASE_APP_ID, CLUB_DERMALYSSE_PUBLICO.appId),
};
