import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { moduloRetos } from '../src/modulos/retos.js';
import { MemoryFirestore } from '../src/adapters/firestore/memoria.js';


test('catálogo autenticado: sólo aprobados accesibles, sin respuestas y sin respaldo local', async () => {
  const {call,close}=await entorno();
  try {
    assert.equal((await call('/retos',null)).status,401);
    const r=await call('/retos','free'); assert.equal(r.status,200);
    assert.equal(r.body.preguntas.length,1); assert.equal(r.body.preguntas[0].correcta,-1);
    assert.equal(r.body.preguntas[0].explicacion,''); assert.equal(r.body.casos.length,1);
    const vip=await call('/retos','vip'); assert.equal(vip.body.preguntas.length,2);
    const bad=await call('/retos/responder','free',{tipo:'quiz',id:'premium',operacion:'o1',partida:'r1',respuesta:1});
    assert.equal(bad.status,404);
  } finally {await close();}
});
test('califica y persiste por UID; replay y campos de autoridad no conceden XP', async()=>{
  const {call,close}=await entorno();
  try {
    const body={tipo:'quiz',id:'p1',operacion:'o1',partida:'r1',respuesta:1};
    const result=await call('/retos/responder','free',body); assert.equal(result.status,200);
    assert.equal(result.body.acertada,true); assert.equal(result.body.estado.xp,10); assert.equal(result.body.puntaje,100);
    const replay=await call('/retos/responder','free',body); assert.equal(replay.body.estado.xp,10); assert.equal(replay.body.xpGanados,0);
    assert.equal((await call('/retos','free')).body.estado.xp,10);
    assert.equal((await call('/retos','other')).body.estado.xp,0);
    assert.equal((await call('/retos/responder','free',{...body,operacion:'o2',uid:'other',xp:999999})).status,400);
    assert.equal((await call('/retos/responder','free',{...body,respuesta:0})).status,409);
    for (const extra of [{fase:'premio2'},{fase:'../../otro'},{calidad:'facil'},{id:'__proto__'}]) assert.equal((await call('/retos/responder','free',{...body,operacion:'o3',...extra})).status,400);
    assert.equal((await call('/retos','free')).body.estado.xp,10);
    const timeout=await call('/retos/responder','other',{...body,respuesta:null}); assert.equal(timeout.body.acertada,false);assert.equal(timeout.body.estado.xp,0);
  }finally{await close();}
});
test('racha, caso y repetición espaciada usan el reloj del servidor y no duplican premios',async()=>{
  const {call,close}=await entorno();
  try {
    const daily=await call('/retos/responder','free',{tipo:'diaria',id:'p1',operacion:'daily1',respuesta:1});
    assert.equal(daily.status,200);assert.equal(daily.body.estado.diaria.racha,1);assert.equal(daily.body.estado.xp,30);
    const again=await call('/retos/responder','free',{tipo:'diaria',id:'p1',operacion:'daily2',respuesta:1});assert.equal(again.body.xpGanados,0);
    for (const fase of ['diagnostico','plan']) assert.equal((await call('/retos/responder','free',{tipo:'caso',id:'caso1',operacion:fase,fase,respuesta:1})).status,200);
    assert.equal((await call('/retos','free')).body.estado.casos.caso1,true);
    const card=await call('/retos/responder','free',{tipo:'tarjeta',id:'card1',operacion:'card1',calidad:'bien'});
    assert.equal(card.status,200);assert.equal(card.body.estado.xp,83);assert.equal(card.body.estado.sr.card1.reps,1);
    assert.equal(card.body.estado.sr.card1.due,'2026-10-23T12:00:00.000Z');
  }finally{await close();}
});

const pregunta={q:'Pregunta técnica de prueba',opciones:['A','B'],correcta:1,explicacion:'Explicación de prueba'};
const base={estado:'aprobado',gratis:true,revision:{responsable:'Revisor de pruebas',fecha:'2026-10-20'}};
const seed={
 p1:{...base,tipo:'pregunta',contenido:pregunta},
 premium:{...base,gratis:false,tipo:'pregunta',contenido:pregunta},
 borrador:{...base,estado:'borrador',tipo:'pregunta',contenido:pregunta},
 caso1:{...base,tipo:'caso',contenido:{titulo:'Caso técnico',hallazgos:[],diagnostico:pregunta,plan:pregunta}},
 card1:{...base,tipo:'tarjeta',contenido:{frente:'Frente de prueba',reverso:'Reverso de prueba'}},
};
async function entorno() {
 const db=new MemoryFirestore(); for(const [id,item] of Object.entries(seed)) db.sembrar(`v2_retos_banco/${id}`,item);
 const app=express();app.use(express.json());
 const auth:express.RequestHandler=(req,res,next)=>{const token=req.headers.authorization?.split(' ')[1];if(!['free','other','vip'].includes(token||'')){res.status(401).end();return;}req.usuario={uid:token!,esVip:token==='vip',esAdmin:false,nombre:'Prueba',email:''};next();};
 moduloRetos({db,ahora:()=>new Date('2026-10-20T12:00:00Z')})({app,requireUser:auth,requireAdmin:auth});
 const errors:express.ErrorRequestHandler=(e,_req,res,_next)=>{res.status(e.status||500).json({message:e.message});};app.use(errors);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(ok=>server.once('listening',ok));
 const port=(server.address() as AddressInfo).port;
 return {close:()=>new Promise<void>((ok,fail)=>{server.close(e=>e?fail(e):ok());server.closeAllConnections();}),
 call:async(path:string,token:string|null,body?:unknown)=>{const r=await fetch(`http://127.0.0.1:${port}${path}`,{method:body?'POST':'GET',headers:{...(token?{Authorization:`Bearer ${token}`} : {}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json().catch(()=>({})) as any};}};
}


