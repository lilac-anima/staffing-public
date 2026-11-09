import {sql} from 'drizzle-orm';
import { getDb } from '../../../db';
import { staff, tasks, workerRuns, workLogQuality } from '../../../db/schema';
import {deploymentSettings} from '../../../db/deployment-schema';
import {deploymentView} from '../../../lib/deployment-settings';
import { effortFromRows } from '../../../lib/worker-effort';
export async function GET() {
 try {
  const db=getDb(); const [people,work,rows,quality,settings]=await db.batch([db.select().from(staff).limit(5001),db.select().from(tasks).limit(5001),db.select().from(workerRuns).limit(5001),db.select({taskId:workLogQuality.taskId,kind:workLogQuality.kind,data:workLogQuality.data,createdAt:workLogQuality.createdAt,sequence:sql<number>`rowid`}).from(workLogQuality).orderBy(sql`rowid`).limit(5001),db.select().from(deploymentSettings).limit(1)]);
  if (work.length > 5000 || rows.length > 5000 || people.length > 5000 || quality.length > 5000) return Response.json({error:'Overview exceeds the 5,000-record safety limit for a source table; the overview cannot safely load this snapshot.'},{status:503,headers:{'Cache-Control':'no-store'}});
  const efforts=Object.fromEntries(work.map(t=>{const {sources, ...safe}=effortFromRows(rows.filter(r=>r.taskId===t.id),t.configSnapshot,t.status); return [t.id,safe]}));
  const inventory=deploymentView(settings[0]??null);const instances=inventory.slots.map(({instanceId,profileId,taskIds,kind,state,fresh,leaseUntil})=>({instanceId,profileId,taskIds,kind,state,fresh,leaseUntil}));
  const attested=quality.filter(q=>q.kind==='attest').reduce((acc,q)=>{try{const v=JSON.parse(q.data);acc[q.taskId]={status:v.status,verified:v.verified,metrics:v.metrics}}catch{}return acc},{} as Record<string,unknown>);
  const safeRows=rows.filter(r=>!r.id.startsWith('coverage:')).flatMap(r=>{try {const v=JSON.parse(r.data); const {id,taskId,workerId,state,heartbeatAt,observedAt,inputTokens,outputTokens,source,scope,complete,elapsedMs,runtimeBasis,startedAt,endedAt,instanceId}=v; return [{id:r.id,taskId:r.taskId,updatedAt:r.updatedAt,data:JSON.stringify({id,taskId,workerId,state,heartbeatAt,observedAt,inputTokens,outputTokens,source,scope,complete,elapsedMs,runtimeBasis,startedAt,endedAt,instanceId})}]}catch{return []}});
  return Response.json({staff:people.flatMap(p=>{try {const v=JSON.parse(p.data);return [{id:p.id,name:v.name,status:v.status}]}catch{return []}}),tasks:work.map(({id,title,project,assignee,status,acceptedAt,acceptedAtSource,configSnapshot})=>({id,title,project,assignee,status,acceptedAt,acceptedAtSource,configSnapshot})),rows:safeRows,instances,inventoryAt:inventory.inventoryAt,qualityDraftTaskIds:[...new Set(quality.map(q=>q.taskId))],qualityAttested:attested,efforts,fetchedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
 } catch {return Response.json({error:'Unable to load the overview.'},{status:500,headers:{'Cache-Control':'no-store'}})}
}
