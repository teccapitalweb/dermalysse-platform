import type { FirestorePort } from '../adapters/firestore/port.js';
import type { ModuloApi } from './tipos.js';
import { crearArcade, type Item } from '../services/arcade.js';
import { CodedError } from '../services/errors.js';
import { asyncHandler } from '../routes/util.js';

export function moduloRetos(ctx: {db: FirestorePort; ahora: () => Date}): ModuloApi {
  const svc=crearArcade({
    banco: async () => (await ctx.db.query('v2_retos_banco', {limit:500})).map(d=>({...d.data(),id:d.id}) as Item),
    get: async path => (await ctx.db.get(path)).data(),
    transaction: fn => ctx.db.runTransaction(tx=>fn({get:async path=>(await tx.get(path)).data(),set:(path,data)=>tx.set(path,data)})),
  },ctx.ahora);
  const run=async <T>(fn:()=>Promise<T>)=>{try{return await fn();}catch(e){if(e instanceof Error && 'status' in e) throw new CodedError(Number(e.status),'reto_invalido',e.message);throw e;}};
  return ({app,requireUser})=>{
    app.get('/retos',requireUser,asyncHandler(async(req,res)=>{res.set('Cache-Control','no-store');res.json(await run(()=>svc.catalogo(req.usuario!.uid,req.usuario!.esVip || req.usuario!.esAdmin)));}));
    app.post('/retos/responder',requireUser,asyncHandler(async(req,res)=>{res.set('Cache-Control','no-store');res.json(await run(()=>svc.responder(req.usuario!.uid,req.usuario!.esVip || req.usuario!.esAdmin,req.body)));}));
  };
}
