/** Datos de práctica local: jamás migrar el antiguo almacén compartido a una cuenta real. */
export function crearAlmacenPorCuenta<T>(
  prefijo: string,
  cuenta: () => { uid: string | null; demo: boolean },
  vacio: () => T,
  almacen: Pick<Storage, 'getItem' | 'setItem'>,
) {
  const clave = () => `${prefijo}:${cuenta().uid || 'anonimo'}`;
  return {
    leer(): T {
      try {
        const actual = cuenta();
        const raw = almacen.getItem(clave())
          ?? (actual.demo && actual.uid === 'demo' ? almacen.getItem(prefijo) : null);
        const valor: unknown = raw ? JSON.parse(raw) : null;
        return valor && typeof valor === 'object' && !Array.isArray(valor)
          ? { ...vacio(), ...valor } : vacio();
      } catch { return vacio(); }
    },
    guardar(valor: T) { almacen.setItem(clave(), JSON.stringify(valor)); },
  };
}

