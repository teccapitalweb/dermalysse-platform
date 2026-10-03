# Decision inicial de arquitectura

Fecha: 3 de octubre de 2026.

## Contexto observado

Las fuentes actuales funcionan, pero estan fragmentadas:

- la landing es HTML, CSS y JavaScript estatico;
- el club concentra aproximadamente 9,600 lineas y numerosos modulos en un solo `index.html`;
- el panel administrativo concentra aproximadamente 3,100 lineas en otro `index.html`;
- el backend Express tiene aproximadamente 2,700 lineas en un solo `index.js` y combina club, pagos, video y funciones de congreso;
- hay catalogos repetidos entre club, backend y panel.

La reconstruccion no copiara esos monolitos. Migrara comportamiento y contenido confirmado a modulos con contratos explicitos.

## Direccion tecnica

Se adopta como base local:

- Vite y TypeScript para la interfaz;
- componentes DOM reutilizables sin imponer un framework de UI en la primera etapa;
- Express para la API, organizado por rutas, servicios y adaptadores;
- contenido y configuracion de marca separados de la presentacion;
- una sola fuente de verdad para catalogo, acceso y progreso;
- modos local/demo y API claramente separados.

Esta direccion conserva el bajo peso del sitio actual y toma de Elite Pecuario solamente sus patrones neutrales: separacion modular, adaptadores de datos, accesibilidad, responsive y estados completos.

## Estructura objetivo

```text
dermalysse-platform/
  api/
    src/
      routes/
      services/
      adapters/
      middleware/
      domain/
    test/
  public/
  src/
    admin/
    core/
    data/
    landing/
    pages/
    styles/
    ui/
  docs/
  scripts/
```

La landing, el club y el panel compartiran tokens, componentes y contratos, pero conservaran entradas y permisos distintos. La forma final de dominios y hosting se decidira antes de publicar, no durante el desarrollo local.

## Limites de datos y seguridad

- Firebase Auth podra identificar al usuario, pero el navegador no sera autoridad sobre membresia, progreso, certificados ni privilegios administrativos.
- Stripe y Bunny solo se llamaran desde el servidor; sus secretos nunca llegaran al cliente.
- Las operaciones administrativas de valor pasaran por API autenticada. No se conservara como arquitectura final la escritura directa del panel a Firestore.
- En modo API, error, respuesta invalida o lista vacia producen un estado honesto; nunca activan semillas de demostracion.
- Los datos demo se identificaran visualmente y viviran en archivos separados.
- El contenido medico o clinico requiere fuente y revision profesional antes de publicarse.

## Ambitos funcionales confirmados

1. Landing editorial y acceso al club.
2. Registro, inicio de sesion y perfil.
3. Catalogo de cursos y clases abiertas.
4. Membresia, acceso protegido y estado de suscripcion.
5. Video protegido, progreso secuencial y certificados.
6. Webinars, materiales, noticias y comunidad.
7. Panel administrativo para catalogo y operacion.

Las herramientas de compatibilidad de activos, generador de protocolos, atlas y ficha de paciente se trataran como contenido educativo. No deberan diagnosticar ni sustituir atencion profesional.

Las funciones de congreso encontradas en el backend y el panel quedan fuera del primer nucleo hasta confirmar si forman parte permanente de Dermalysse o deben mantenerse como producto separado.

## Etapas propuestas

1. Fundacion tecnica, tokens de marca y shell responsive sin servicios reales.
2. Landing y navegacion publica con contenido confirmado.
3. Club en modo local con catalogo migrado y estados completos.
4. Contrato API y adaptadores, primero con pruebas y datos no productivos.
5. Autenticacion, pagos, video y administracion, cada integracion con autorizacion especifica.
6. Regresion visual en escritorio y telefono antes de cualquier publicacion.
