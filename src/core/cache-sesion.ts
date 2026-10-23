/** Cache por sesión. Una petición vieja nunca puede hidratar la cuenta nueva. */
export function crearCacheSesion(cuentaActual: () => string | null, limpiar: () => void) {
  let cuenta: string | null | undefined;
  let revision = 0;
  const listas = new Set<string>();
  const pendientes = new Map<string, Promise<void>>();
  function invalidar() {
    cuenta = cuentaActual();
    revision++;
    listas.clear();
    pendientes.clear();
    limpiar();
  }
  function revisar() { if (cuenta !== cuentaActual()) invalidar(); }
  async function cargar<T>(clave: string, obtener: () => Promise<T>, aplicar: (valor: T) => void) {
    revisar();
    const actual = revision;
    if (listas.has(clave)) return;
    const existente = pendientes.get(clave);
    if (existente) return existente;
    const tarea = Promise.resolve().then(obtener).then((valor) => {
      revisar();
      if (actual !== revision) throw new Error('La sesión cambió. Vuelve a abrir esta página.');
      aplicar(valor);
      listas.add(clave);
    }).finally(() => {
      if (pendientes.get(clave) === tarea) pendientes.delete(clave);
    });
    pendientes.set(clave, tarea);
    return tarea;
  }
  return { cargar, invalidar };
}

