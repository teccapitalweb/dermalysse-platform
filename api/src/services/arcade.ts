/** Motor de práctica: contenido revisado, calificación y estado autoritativos.
 * XP educativo sin valor comercial. No escribe membresías, certificados o canjes.
 */
export interface Item {
  id: string; tipo: 'pregunta' | 'caso' | 'tarjeta'; estado: string; gratis?: boolean;
  revision?: { responsable: string; fecha: string };
  contenido: any;
}
export interface Store {
  banco(): Promise<Item[]>;
  get(path: string): Promise<any>;
  transaction<T>(fn: (tx: { get(path: string): Promise<any>; set(path: string, data: any): void }) => Promise<T>): Promise<T>;
}
const empty = () => ({ xp: 0, quizBest: 0, casos: {} as Record<string, boolean>, sr: {} as Record<string, {due: string; reps: number; fallos: number}>, diaria: {fecha:'',racha:0} });
const fail = (status: number, message: string): never => { throw Object.assign(new Error(message), { status }); };
const validId = (x: unknown): x is string => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(x) && !['__proto__','constructor','prototype'].includes(x);
const question = (p: any) => p && typeof (p.q ?? p.pregunta) === 'string' && Array.isArray(p.opciones) && p.opciones.length >= 2 && p.opciones.length <= 8 && p.opciones.every((o: unknown) => typeof o === 'string') && Number.isInteger(p.correcta) && p.correcta >= 0 && p.correcta < p.opciones.length;
const redact = (p: any) => ({ q: p.q ?? p.pregunta, pregunta: p.pregunta ?? p.q, opciones: p.opciones, correcta:-1, explicacion:'' });
const day = (now: Date) => now.toISOString().slice(0,10);
export function crearArcade(store: Store, now: () => Date = () => new Date()) {
  async function banco(vip: boolean) {
    return (await store.banco()).filter(x => validId(x.id) && x.estado === 'aprobado'
      && x.revision?.responsable?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(x.revision?.fecha || '')
      && (vip || x.gratis === true)
      && (x.tipo === 'pregunta' ? question(x.contenido) : x.tipo === 'caso' ? question(x.contenido?.diagnostico) && question(x.contenido?.plan) && Array.isArray(x.contenido?.hallazgos)
      : x.tipo === 'tarjeta' && typeof x.contenido?.frente === 'string' && typeof x.contenido?.reverso === 'string'))
      .sort((a,b)=>a.id.localeCompare(b.id)).slice(0,500);
  }
  const statePath = (uid: string) => `v2_retos_estado/${encodeURIComponent(uid)}`;
  async function catalogo(uid: string, vip: boolean) {
    const items = await banco(vip), preguntas = items.filter(x => x.tipo === 'pregunta');
    const fecha = day(now()); const hash = [...fecha].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7);
    return { source:'server', fecha, estado: await store.get(statePath(uid)) || empty(),
      diariaPreguntaId: preguntas.length ? preguntas[hash % preguntas.length].id : null,
      preguntas: preguntas.map(x => ({id:x.id, curso:x.contenido.curso || 'Práctica',area:x.contenido.area || 'General',...redact(x.contenido)})),
      tarjetas: items.filter(x=>x.tipo==='tarjeta').map(x=>({id:x.id,area:x.contenido.area || 'General',curso:x.contenido.curso || 'Práctica',frente:x.contenido.frente,reverso:x.contenido.reverso})),
      casos: items.filter(x=>x.tipo==='caso').map(x=>({id:x.id,area:x.contenido.area || 'General',titulo:x.contenido.titulo || 'Caso educativo',paciente:x.contenido.paciente || '',presentacion:x.contenido.presentacion || '',hallazgos:x.contenido.hallazgos,diagnostico:redact(x.contenido.diagnostico),plan:redact(x.contenido.plan)})),
    };
  }
  async function responder(uid: string, vip: boolean, input: any) {
    if (!input || !validId(input.id) || !validId(input.operacion) || !['quiz','diaria','caso','tarjeta'].includes(input.tipo)) fail(400,'Actividad inválida.');
    if (Object.keys(input).some(k=>!['id','operacion','tipo','respuesta','fase','calidad','partida'].includes(k))) fail(400,'Hay campos no permitidos.');
    if ((input.tipo !== 'caso' && Object.hasOwn(input,'fase'))
      || (input.tipo !== 'tarjeta' && Object.hasOwn(input,'calidad'))
      || (input.tipo === 'tarjeta' && Object.hasOwn(input,'respuesta'))
      || (input.tipo !== 'quiz' && Object.hasOwn(input,'partida'))) fail(400,'Hay campos de otra modalidad.');
    if (input.tipo === 'quiz' && !validId(input.partida)) fail(400,'Partida inválida.');
    const items = await banco(vip);
    const item = items.find(x => x.id === input.id);
    if (!item) fail(404,'La actividad no está disponible para tu cuenta.');
    const at = now(), fecha = day(at);
    let p: any = null;
    if (input.tipo === 'quiz' || input.tipo === 'diaria') { if (item!.tipo !== 'pregunta') fail(400,'Tipo inválido.'); p=item!.contenido; }
    if (input.tipo === 'caso') { if (item!.tipo !== 'caso' || !['diagnostico','plan'].includes(input.fase)) fail(400,'Etapa inválida.'); p=item!.contenido[input.fase]; }
    if (input.tipo === 'tarjeta' && (item!.tipo !== 'tarjeta' || !['otra','dificil','bien','facil'].includes(input.calidad))) fail(400,'Repaso inválido.');
    if (p && input.respuesta !== null && (!Number.isInteger(input.respuesta) || input.respuesta < 0 || input.respuesta >= p.opciones.length)) fail(400,'Respuesta inválida.');
    if (input.tipo === 'diaria') {
      const preguntas=items.filter(x=>x.tipo==='pregunta'); const hash=[...fecha].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7);
      if (preguntas[hash%preguntas.length]?.id !== item!.id) fail(409,'El reto diario cambió. Recarga para continuar.');
    }
    const base = `${statePath(uid)}/acciones`;
    const operation = `${base}/op_${input.operacion}`;
    const reward = `${base}/${fecha}_${input.tipo}_${input.id}_${input.fase || 'general'}`;
    const run = `${base}/partida_${input.partida || input.id}`;
    const key = JSON.stringify([input.tipo,input.id,input.respuesta??null,input.fase??null,input.calidad??null,input.partida??null]);
    return store.transaction(async tx => {
      const previous = await tx.get(operation);
      const estado = await tx.get(statePath(uid)) || empty();
      if (previous) {
        if (previous.key !== key) fail(409,'Esta operación ya se usó para otra respuesta.');
        return {...previous.result, estado, repetida:true, xpGanados:0};
      }
      const rewarded = await tx.get(reward);
      const partida = input.tipo==='quiz' ? await tx.get(run) || {respuestas:{},puntaje:0} : null;
      const casePath = `${base}/caso_${input.id}`;
      const solved = input.tipo==='caso' ? await tx.get(casePath) || {} : null;
      const acertada = p ? input.respuesta === p.correcta : false;
      let xpGanados=0;
      if (input.tipo==='quiz') {
        if (!Object.hasOwn(partida.respuestas,input.id)) {
          if (Object.keys(partida.respuestas).length >= 20) fail(409,'La partida ya terminó. Inicia otra.');
          partida.respuestas[input.id]=acertada; partida.puntaje+=acertada?100:0;
        }
        estado.quizBest=Math.max(estado.quizBest,partida.puntaje);
        if (!rewarded && acertada) xpGanados=10;
      }
      if (input.tipo==='diaria' && estado.diaria.fecha !== fecha) {
        const ayer=day(new Date(at.getTime()-86400000));
        estado.diaria={fecha,racha:(estado.diaria.fecha===ayer?estado.diaria.racha:0)+1}; xpGanados=acertada?30:10;
      }
      if (input.tipo==='caso') {
        solved[input.fase]=solved[input.fase]===true || acertada;
        if (solved.diagnostico && solved.plan && !estado.casos[input.id]) { estado.casos[input.id]=true; xpGanados=50; }
      }
      if (input.tipo==='tarjeta') {
        const prev=estado.sr[input.id] || {reps:0,fallos:0};
        const reps=input.calidad==='otra'?0:Math.min(6,prev.reps+1);
        const days=input.calidad==='otra'?0:input.calidad==='dificil'?1:input.calidad==='facil'?7:Math.min(30,3*2**Math.max(0,reps-1));
        estado.sr[input.id]={reps,due:new Date(at.getTime()+days*86400000).toISOString(),fallos:prev.fallos+(input.calidad==='otra'?1:0)};
        if (!rewarded) xpGanados=({otra:0,dificil:1,bien:3,facil:5} as Record<string,number>)[input.calidad];
      }
      estado.xp+=xpGanados;
      const result={source:'server',fecha,acertada,correcta:p?.correcta ?? -1,explicacion:typeof p?.explicacion==='string'?p.explicacion:'',xpGanados,puntaje:partida?.puntaje ?? 0,repetida:false};
      tx.set(statePath(uid),estado); tx.set(operation,{key,result,fecha}); tx.set(reward,{fecha});
      if (partida) tx.set(run,partida);
      if (solved) tx.set(casePath,solved);
      return {...result,estado};
    });
  }
  return {catalogo,responder};
}
