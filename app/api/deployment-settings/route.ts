import { and, eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { getDb } from '../../../db';
import { deploymentSettings } from '../../../db/deployment-schema';
import { CapacityError, deploymentView, hashCapability, ledgerCommandSchema, mutateDeploymentLedger, saveWorkerLimit, type DeploymentStore } from '../../../lib/deployment-settings';
const ID='global';
function store():DeploymentStore {
 const db=getDb();
 return {read:async()=>(await db.select().from(deploymentSettings).where(eq(deploymentSettings.id,ID)).limit(1))[0]??null,
 compareAndSwap:async(revision,next)=>{
  if(revision===null)return (await db.insert(deploymentSettings).values({id:ID,...next}).onConflictDoNothing().returning()).length===1;
  return (await db.update(deploymentSettings).set(next).where(and(eq(deploymentSettings.id,ID),eq(deploymentSettings.revision,revision))).returning()).length===1;
 }};
}
const respond=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
function failure(e:unknown){return e instanceof CapacityError?respond({error:e.message},e.status):respond({error:'Worker capacity is unavailable. Dispatch is blocked until settings and inventory can be read.'},503);}
export async function GET(){try{return respond(deploymentView(await store().read()));}catch(e){return failure(e);}}
export async function PUT(req:Request){
 const parsed=z.object({limit:z.number().int().min(1).max(24),expectedRevision:z.string().uuid().nullable()}).strict().safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return respond({error:'Provide a whole-number limit from 1 to 24 and its saved revision.'},400);
 try{return respond(deploymentView(await saveWorkerLimit(store(),parsed.data.limit,parsed.data.expectedRevision)));}catch(e){return failure(e);}
}
// A shared Site session is not proof of a PM role. Ledger authority uses a separate
// server provisioned dispatcher secret, or a per-reservation opaque capability.
export async function POST(req:Request){
 const parsed=ledgerCommandSchema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return respond({error:'Invalid deployment ledger command.'},400);
 try {
  const configured=(env as unknown as Record<string,unknown>).STAFFING_DISPATCH_SECRET;
  const supplied=req.headers.get('X-Staffing-Dispatcher-Key');
  const dispatcher=typeof configured==='string'&&configured.length>=32&&!!supplied&&await hashCapability(configured)===await hashCapability(supplied);
  if(!dispatcher&&['reserve','reconcile','ack-capacity-change'].includes(parsed.data.action))return respond({error:'A configured dispatcher credential is required. Site access or a claimed role is insufficient.'},403);
  return respond(deploymentView(await mutateDeploymentLedger(store(),parsed.data,dispatcher)));
 }catch(e){return failure(e);}
}
