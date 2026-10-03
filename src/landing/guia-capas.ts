export type GestoGuia = 'reposo' | 'saludo' | 'espera' | 'respuesta';
export type PosturaGuia = 'saludo' | 'orientar' | 'celebrar';
export const FOTOGRAMAS_GUIA = 72;
export const FPS_GUIA = 24;
// El hueco junto al pulgar excluye el mechón de pelo situado a su derecha.
const MANO = 'M205 440H345L365 534L357 505L368 490H389V500L384 512L392 530L382 580L370 645L374 711L284 714L267 647L200 578Z';
const POSTURAS = {
  saludo: { mano: MANO, puno: 'M252 698L385 685L422 720L422 805H252Z', x: 323, y: 691, cuerpoX: 556, alinearX: 0 },
  orientar: { mano: 'M85 585H233L273 646L323 680L330 714L316 752L290 765L264 736L236 709L157 716L80 660Z', puno: 'M320 671L369 699L389 765L334 804L259 783L269 750L311 756Z', x: 307, y: 739, cuerpoX: 570, alinearX: -14 },
  celebrar: { mano: 'M348 510H382L387 566L409 576L411 649L382 685L372 719L326 724L300 712L305 649L321 594L345 566Z', puno: 'M299 687L303 716L353 729L379 699L407 685L419 741L363 785L285 765L270 724L284 682Z', x: 337, y: 704, cuerpoX: 556, alinearX: 0 },
} satisfies Record<PosturaGuia, { mano: string; puno: string; x: number; y: number; cuerpoX: number; alinearX: number }>;

/** Cabeza, cabello y coleta permanecen intactos en el cuerpo; nunca se recortan. */
export function poseGuia(segundos: number, gesto: GestoGuia = 'saludo', postura: PosturaGuia = 'saludo') {
  const t = Math.max(0, Math.min(3, segundos));
  const e = Math.sin(Math.PI * t / 3) ** 2;
  const fuerza = gesto === 'reposo' ? 0 : gesto === 'espera' ? .12 : gesto === 'respuesta' ? .45 : 1;
  if (postura === 'orientar') return { mano: -6 * e * Math.sin(Math.PI * t) * fuerza, cuerpo: -1.2 * e * (gesto === 'reposo' ? .2 : 1), desplazamiento: 0 };
  if (postura === 'celebrar') return { mano: 5 * e * Math.sin(2 * Math.PI * t) * fuerza, cuerpo: .9 * e * Math.sin(Math.PI * t) * (gesto === 'reposo' ? .2 : 1), desplazamiento: -7 * e * fuerza };
  return { mano: 11 * e * Math.sin(2 * Math.PI * t) * fuerza, cuerpo: -.6 * e * (gesto === 'reposo' ? .35 : 1), desplazamiento: 0 };
}

export function dibujoGuia(imagen: string, id: string, postura: PosturaGuia = 'saludo') {
  const p = POSTURAS[postura];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-70 -30 1226 1510" data-postura="${postura}" aria-hidden="true" focusable="false" class="guia-rig"><defs>
    <clipPath id="${id}-mano"><path d="${p.mano}"/></clipPath>
    <clipPath id="${id}-puno"><path d="${p.puno}"/></clipPath>
    <mask id="${id}-base" maskUnits="userSpaceOnUse" x="0" y="0" width="1086" height="1448"><rect width="1086" height="1448" fill="white"/><path d="${p.mano}" fill="black"/></mask>
    <image id="${id}-imagen" href="${imagen}" width="1086" height="1448"/></defs>
    <g transform="translate(${p.alinearX} 0)"><g data-cuerpo="" transform="rotate(0 ${p.cuerpoX} 1400)"><use href="#${id}-imagen" mask="url(#${id}-base)"/>
    <g data-mano="" transform="rotate(0 ${p.x} ${p.y})"><use href="#${id}-imagen" clip-path="url(#${id}-mano)"/></g>
    <use href="#${id}-imagen" clip-path="url(#${id}-puno)"/></g></g></svg>`;
}

export function aplicarPose(svg: SVGElement, pose: ReturnType<typeof poseGuia>) {
  const p = POSTURAS[(svg.getAttribute('data-postura') || 'saludo') as PosturaGuia];
  svg.querySelector('[data-cuerpo]')!.setAttribute('transform', `translate(0 ${pose.desplazamiento}) rotate(${pose.cuerpo} ${p.cuerpoX} 1400)`);
  svg.querySelector('[data-mano]')!.setAttribute('transform', `rotate(${pose.mano} ${p.x} ${p.y})`);
}
