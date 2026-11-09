import { and, eq } from 'drizzle-orm';
import { getDb } from '../../../db';
import { tasks, workerRuns } from '../../../db/schema';
import { runInput, runSnapshot } from '../../../lib/worker-effort';

export async function GET(req: Request) {
  try { const id = new URL(req.url).searchParams.get('taskId'); if (!id) return Response.json({error:'taskId is required.'},{status:400});
    const rows = await getDb().select().from(workerRuns).where(eq(workerRuns.taskId,id));
    return Response.json(rows.filter(r=>!r.id.startsWith('coverage:')).map(r=>({...JSON.parse(r.data),updatedAt:r.updatedAt,revision:r.data})),{headers:{'Cache-Control':'no-store'}});
  } catch { return Response.json({error:'Unable to load runs; apply the worker runs migration.'},{status:500}); }
}
export async function PUT(req: Request) {
  const input: any=await req.json().catch(()=>null); const expectedRevision=input?.expectedRevision; if(input && typeof input==='object') delete input.expectedRevision; const parsed = runInput.safeParse(input);
  if (!parsed.success) return Response.json({error:'Invalid run data.',details:parsed.error.issues.map(i=>i.message)},{status:400});
  try { const db=getDb(), run=parsed.data; const [task]=await db.select().from(tasks).where(eq(tasks.id,run.taskId));
    if (!task) return Response.json({error:'Task not found.'},{status:404});
    const [existing]=await db.select().from(workerRuns).where(eq(workerRuns.id,run.id));
    if (existing && existing.taskId!==run.taskId) return Response.json({error:'Run ID belongs to another task.'},{status:409});
    const data=JSON.stringify({...run,taskCoverageComplete:false}); if (existing && JSON.stringify({...JSON.parse(existing.data),taskCoverageComplete:false})===data) return Response.json({saved:true,unchanged:true});
    if (existing) { if (typeof expectedRevision!=='string' || expectedRevision!==existing.data) return Response.json({error:'Run changed; reload before correcting it.'},{status:409}); const changed=await db.update(workerRuns).set({data,updatedAt:new Date().toISOString()}).where(and(eq(workerRuns.id,run.id),eq(workerRuns.data,expectedRevision))).returning(); if(!changed.length) return Response.json({error:'Run changed; reload before correcting it.'},{status:409}); }
    else { const created=await db.insert(workerRuns).values({id:run.id,taskId:run.taskId,data,updatedAt:new Date().toISOString()}).onConflictDoNothing().returning(); if(!created.length) return Response.json({error:'Run ID was created concurrently; reload.'},{status:409}); }
    return Response.json({saved:true});
  } catch { return Response.json({error:'Unable to save run; apply the worker runs migration.'},{status:500}); }
}

// Attestation references exact observed row contents; later additions and corrections invalidate it.
export async function POST(req: Request) {
  const body: any=await req.json().catch(()=>null); if (!body || typeof body.taskId!=='string' || !Array.isArray(body.runs) || !body.runs.every((x:unknown)=>Array.isArray(x) && x.length===2 && x.every(v=>typeof v==='string'))) return Response.json({error:'Provide taskId and observed run revisions.'},{status:400});
  try { const db=getDb(); const [task]=await db.select().from(tasks).where(eq(tasks.id,body.taskId)); if(!task || task.status!=='Done') return Response.json({error:'Confirm coverage only after the task is Done.'},{status:400}); const rows=(await db.select().from(workerRuns).where(eq(workerRuns.taskId,body.taskId))).filter(r=>!r.id.startsWith('coverage:')); let config:any=null; try {config=task.configSnapshot && JSON.parse(task.configSnapshot)} catch {} if(!config?.workerId || rows.some(r=>{const v=JSON.parse(r.data);return !v.complete || v.workerId!==config.workerId || v.configSnapshot!==task.configSnapshot || v.attributionScope==='unknown' || v.runtimeBasis!=='worker-run-elapsed';})) return Response.json({error:'All runs must be complete and match the task configuration and measurement scope.'},{status:400}); const snapshot=runSnapshot(rows); const observed=JSON.stringify([...body.runs].sort((a,b)=>a[0].localeCompare(b[0]))); if(!rows.length || snapshot!==observed) return Response.json({error:'Runs changed; reload before confirming coverage.'},{status:409});
    const id='coverage:'+body.taskId; const now=new Date().toISOString(); await db.insert(workerRuns).values({id,taskId:body.taskId,data:snapshot,updatedAt:now}).onConflictDoUpdate({target:workerRuns.id,set:{data:snapshot,updatedAt:now}}); return Response.json({saved:true});
  } catch {return Response.json({error:'Could not confirm coverage.'},{status:500});}
}
