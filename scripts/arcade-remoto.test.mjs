import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { randomUUID } from 'node:crypto';
function fixture(api) {
  let user={uid:'a'};
  const exports={};
  const mocks={'./auth':{Auth:{get usuario(){return user;}},api},'../ui/partials':{esc:s=>String(s).replaceAll('<','&lt;')}};
  const src=fs.readFileSync(new URL('../src/core/arcade-remoto.ts',import.meta.url),'utf8');
  vm.runInNewContext(ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText,
    {exports,require:n=>mocks[n],crypto:{randomUUID},window:{dispatchEvent(){}},CustomEvent:class{},Map,JSON});
  return {...exports,cambiar:uid=>{user={uid};}};
}
const state=()=>({xp:0,quizBest:0,casos:{},sr:{},diaria:{fecha:'',racha:0}});
const catalog=()=>({source:'server',fecha:'2026-10-20',estado:state(),preguntas:[],casos:[],tarjetas:[],diariaPreguntaId:null});
test('respuesta vacía permanece vacía; un fallo no vuelve al avance local',async()=>{
  let falla=false;
  const f=fixture(async()=>{if(falla)throw new Error('Sin red');return catalog();});
  await f.cargarRetosRemotos();assert.equal(f.retosRemotos().preguntas.length,0);
  falla=true;await assert.rejects(f.cargarRetosRemotos(),/Sin red/);assert.equal(f.retosRemotos().estado.xp,0);
});
test('recarga de otra cuenta descarta la respuesta tardía y limpia el estado',async()=>{
  let resolve;const promise=new Promise(ok=>resolve=ok);
  const f=fixture(()=>promise);const pending=f.cargarRetosRemotos();f.cambiar('b');
  resolve({...catalog(),estado:{...state(),xp:50}});
  await assert.rejects(pending,/sesión/);assert.equal(f.retosRemotos().estado.xp,0);
});
test('reintento conserva la operación; no confirma XP hasta respuesta válida',async()=>{
  const ops=[];let fail=true;
  const f=fixture(async(path,init)=>{
    if(path==='/retos')return catalog();ops.push(init.json.operacion);
    if(fail)throw new Error('Sin red');return {source:'server',fecha:'2026-10-20',estado:{...state(),xp:10},xpGanados:10};
  });
  await f.cargarRetosRemotos();const input={tipo:'quiz',id:'p1',respuesta:1,partida:'p'};
  await assert.rejects(f.responderReto(input),/Sin red/);assert.equal(f.retosRemotos().estado.xp,0);
  fail=false;await f.responderReto(input);assert.equal(ops[0],ops[1]);assert.equal(f.retosRemotos().estado.xp,10);
});
test('tarjetas remotas se muestran como texto, no HTML ejecutable',async()=>{
  const f=fixture(async()=>({...catalog(),tarjetas:[{id:'a',frente:'Texto',reverso:'<img onerror=alert(1)>'}]}));
  await f.cargarRetosRemotos();assert.ok(f.retosRemotos().tarjetas[0].reverso.startsWith('&lt;img'));
});
