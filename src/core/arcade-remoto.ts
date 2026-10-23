import { Auth, api } from './auth';
import type { Pregunta, Caso, Flashcard } from './juegos';
import { esc } from '../ui/partials';

interface Estado { xp: number; quizBest: number; casos: Record<string,boolean>; sr: Record<string,{due:string;reps:number;fallos:number}>; diaria:{fecha:string;racha:number} }
interface Catalogo { source:'server'; fecha:string; estado:Estado; preguntas:Pregunta[]; casos:Caso[]; tarjetas:Flashcard[]; diariaPreguntaId:string|null }
const empty=():Catalogo=>({source:'server',fecha:'',estado:{xp:0,quizBest:0,casos:{},sr:{},diaria:{fecha:'',racha:0}},preguntas:[],casos:[],tarjetas:[],diariaPreguntaId:null});
let cuenta: string|null=null, data=empty(), revision=0;
let identidad: unknown = null;
export function retosRemotos() {
  const uid=Auth.usuario?.uid??null;
  if(Auth.usuario!==identidad){identidad=Auth.usuario;cuenta=uid;revision++;data=empty();}
  return data;
}
export async function cargarRetosRemotos() {
  retosRemotos(); const uid=cuenta, account=identidad, version=++revision; data=empty();
  if(!uid) throw new Error('Inicia sesión para abrir tus retos.');
  const r=await api<Catalogo>('/retos');
  if(Auth.usuario!==account || Auth.usuario?.uid!==uid || revision!==version) throw new Error('La sesión cambió.');
  if(r.source!=='server' || !Array.isArray(r.preguntas) || !Array.isArray(r.tarjetas) || !Array.isArray(r.casos) || !r.estado) throw new Error('No se pudieron validar los retos.');
  data={...r,tarjetas:r.tarjetas.map(t=>({...t,reverso:esc(t.reverso)}))};
  return data;
}
export interface ResultadoReto {source:'server';fecha:string;estado:Estado;acertada:boolean;correcta:number;explicacion:string;xpGanados:number;puntaje:number;repetida:boolean}
const operaciones=new Map<string,string>();
let pendiente=false;
export async function responderReto(input: {tipo:'quiz'|'diaria'|'caso'|'tarjeta';id:string;respuesta?:number|null;fase?:string;calidad?:string;partida?:string}) {
  retosRemotos(); const uid=cuenta, account=identidad, version=revision;
  if(!uid) throw new Error('Inicia sesión para guardar tus retos.');
  if(pendiente) throw new Error('Espera a que termine de guardarse tu respuesta.');
  const key=JSON.stringify([uid,version,input]);
  const operacion=operaciones.get(key)||crypto.randomUUID(); operaciones.set(key,operacion);
  pendiente=true;
  try {
    const r=await api<ResultadoReto>('/retos/responder',{method:'POST',json:{...input,operacion}});
    if(Auth.usuario!==account || Auth.usuario?.uid!==uid || revision!==version) throw new Error('La sesión cambió.');
    if(r.source!=='server'||!r.estado||!Number.isFinite(r.xpGanados)) throw new Error('El servidor no confirmó el resultado.');
    data={...data,estado:r.estado,fecha:r.fecha};
    window.dispatchEvent(new CustomEvent('retos:cambio'));
    return r;
  }finally{pendiente=false;if(operaciones.size>200) operaciones.clear();}
}
