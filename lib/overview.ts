import { effortFromRows } from './worker-effort';
export type Staff = {id:string; name:string; status:string};
export type Task = {id:string; title:string; project:string; assignee:string; status:string; acceptedAt:string|null; acceptedAtSource?:string; configSnapshot:string|null};
export type Row = {id:string;taskId:string;data:string;updatedAt:string};
export type Snapshot = {staff:Staff[]; tasks:Task[]; rows:Row[]; instances?:{instanceId:string;profileId:string|null;taskIds:string[];kind:string;state:string;fresh:boolean;leaseUntil?:string}[]; inventoryAt?:string|null; qualityDraftTaskIds?:string[]; qualityAttested?:Record<string,{verified:boolean;status:string;metrics:{quality:number|null;u:number;n:number;combined:number|null}}> ; fetchedAt:string; efforts?:Record<string,ReturnType<typeof effortFromRows>>};
export const day = (value:string|null|undefined) => { if(!value || !Number.isFinite(Date.parse(value))) return null; return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)); };
export const heartbeat = (run:any, now:number) => { if(run.state==='registered') return 'Pending start'; if(run.state!=='running') return run.state || 'unknown'; const t=Date.parse(run.heartbeatAt || ''); return Number.isFinite(t) && t<=now && now-t<=15000 ? 'Fresh' : 'Stale'; };
export function buildOverview(s:Snapshot, from:string, to:string, project:string, worker:string, now:number) {
 const parsed=s.rows.filter(r=>!r.id.startsWith('coverage:')).flatMap(row=>{try{return [{...JSON.parse(row.data),row}]}catch{return []}});
 const workerId=(t:Task)=>{try{return JSON.parse(t.configSnapshot || '{}').workerId as string|undefined}catch{return undefined}};
 const selected=(t:Task)=> (!project || t.project===project) && (!worker || workerId(t)===worker);
 const currentTasks=s.tasks.filter(t=>t.status==='In Progress' && selected(t));
 const currentRuns=parsed.filter(r=>['registered','running'].includes(r.state) && (!worker || r.workerId===worker) && (!project || s.tasks.find(t=>t.id===r.taskId)?.project===project));
 const inRange=(d:string|null)=>!!d && (!from || d>=from) && (!to || d<=to);
 const selectedTasks=s.tasks.filter(selected); const allDone=selectedTasks.filter(t=>t.status==='Done'); const statuses=Object.fromEntries(['Backlog','Ready','In Progress','Blocked','Done'].map(status=>[status,selectedTasks.filter(t=>t.status===status).length])); const accepted=selectedTasks.filter(t=>t.status==='Done'); const unverified=accepted.filter(t=>t.acceptedAtSource!=='recorded-transition'); const undated=accepted.filter(t=>t.acceptedAtSource==='recorded-transition' && !day(t.acceptedAt)); const period=accepted.filter(t=>t.acceptedAtSource==='recorded-transition' && inRange(day(t.acceptedAt)));
 const effort=(t:Task)=>s.efforts?.[t.id] ?? effortFromRows(s.rows.filter(r=>r.taskId===t.id),t.configSnapshot,t.status);
 const cohort=period.map(t=>({task:t,effort:effort(t)})).filter(x=>x.effort.inputTokens!==null && x.effort.outputTokens!==null);
 const runDay=(r:any)=>day(r.endedAt || r.observedAt); const runSelected=(r:any)=>{const t=s.tasks.find(t=>t.id===r.taskId);return !!t && (!project || t.project===project) && (!worker || r.workerId===worker)};
 const runs=parsed.filter(r=>runSelected(r) && inRange(runDay(r)));
 const unknownRunDates=parsed.filter(r=>runSelected(r) && !runDay(r)).length;
 const daily=new Map<string,{date:string;input:number;output:number;knownInput:number;knownOutput:number;runs:number;accepted:number;cohort:number;cohortTokens:number}>();
 const entry=(d:string)=>{if(!daily.has(d))daily.set(d,{date:d,input:0,output:0,knownInput:0,knownOutput:0,runs:0,accepted:0,cohort:0,cohortTokens:0});return daily.get(d)!};
 for(const r of runs){const x=entry(runDay(r)!);x.runs++;if(r.inputTokens!=null){x.input+=r.inputTokens;x.knownInput++}if(r.outputTokens!=null){x.output+=r.outputTokens;x.knownOutput++}}
 for(const t of period)entry(day(t.acceptedAt)!).accepted++;
 for(const {task,effort:e} of cohort){const x=entry(day(task.acceptedAt)!);x.cohort++;x.cohortTokens+=e.inputTokens!+e.outputTokens!}
 const workers=s.staff.filter(p=>!worker || p.id===worker).map(p=>{const tasks=period.filter(t=>workerId(t)===p.id); const eligible=cohort.filter(x=>tasks.includes(x.task)); const runtime=eligible.map(x=>x.effort).filter(e=>e.elapsedMs!==null); return {person:p,accepted:tasks.length,eligible:eligible.length,tokens:eligible.reduce((n,x)=>n+x.effort.inputTokens!+x.effort.outputTokens!,0),runtime:runtime.reduce((n,e)=>n+e.elapsedMs!,0),runtimeKnown:runtime.length};});
 return {currentTasks,currentRuns,selectedTasks,allDone,statuses,active:s.staff.filter(p=>p.status==='Active'&&(!worker||p.id===worker)),period,undated,unverified,unattributed:selectedTasks.filter(t=>!workerId(t)).length,cohort,runs,unknownRunDates,effort,daily:[...daily.values()].sort((a,b)=>a.date.localeCompare(b.date)),workers,latestMeasurement:parsed.map(r=>r.observedAt).filter((x:any)=>typeof x==='string'&&Number.isFinite(Date.parse(x))).sort().at(-1) || null,heartbeat:(r:any)=>heartbeat(r,now)};
}

export type AssignmentRow={task:Task;instanceId:string|null;profileId:string|null;bindingConflict?:boolean;slot:NonNullable<Snapshot['instances']>[number]|null;runs:any[]};
/** Only explicit task/instance bindings join reports. Never infer an instance from an assignee name. */
export function assignmentRows(s:Snapshot,project:string,worker:string):AssignmentRow[]{
 const runs=s.rows.filter(r=>!r.id.startsWith('coverage:')).flatMap(row=>{try{return [{...JSON.parse(row.data),row}]}catch{return []}});
 const output:AssignmentRow[]=[];
 for(const task of s.tasks.filter(t=>t.status==='In Progress'&&(!project||t.project===project))){
  const slots=(s.instances||[]).filter(x=>x.taskIds.includes(task.id)&&(!worker||x.profileId===worker));
  const taskRuns=runs.filter(r=>r.taskId===task.id&&(!worker||r.workerId===worker));
  const groups=new Map<string,AssignmentRow>();
  for(const slot of slots)groups.set(slot.instanceId,{task,instanceId:slot.instanceId,profileId:slot.profileId,slot,runs:[]});
  for(const r of taskRuns){const key=r.instanceId||`unbound:${r.id}`;const existing=groups.get(key);if(existing&&(!existing.profileId||!r.workerId||existing.profileId===r.workerId)){existing.runs.push(r);if(!existing.profileId&&r.workerId)existing.profileId=r.workerId;}else groups.set(existing?`conflict:${r.id}`:key,{task,instanceId:r.instanceId||null,profileId:r.workerId||null,bindingConflict:!!existing,slot:null,runs:[r]})}
  for(const row of groups.values()){
   const time=(r:any)=>{for(const key of ['startedAt','endedAt','observedAt','heartbeatAt']){const n=Date.parse(r[key]||'');if(Number.isFinite(n))return n}return Date.parse(r.row.updatedAt)||0};
   const sorted=[...row.runs].sort((a,b)=>time(b)-time(a));const live=sorted.find(r=>r.state==='running'||r.state==='registered');const terminal=sorted.find(r=>['completed','failed','interrupted'].includes(r.state));const legacy=(!live&&!terminal)?sorted[0]:null;row.runs=[...new Set([live,terminal,legacy].filter(Boolean))];
   output.push(row);
  }
  let owner:string|undefined;try{owner=JSON.parse(task.configSnapshot||'{}').workerId}catch{}
  if(!groups.size&&(!worker||worker===owner))output.push({task,instanceId:null,profileId:owner||null,slot:null,runs:[]});
 }
 return output;
}
export function inventoryObservation(slot:AssignmentRow['slot'],inventoryAt:string|null|undefined,now:number){
 if(!slot||slot.kind!=='native')return null;const observed=Date.parse(inventoryAt||''),lease=Date.parse(slot.leaseUntil||'');
 if(!Number.isFinite(observed)||observed>now||!Number.isFinite(lease))return 'Unknown';
 return now-observed<=120000&&lease>now?'Current':'Stale';
}

/** Active reports remain visible when their board task is not In Progress. */
export function orphanCurrentRuns(s:Snapshot,project:string,worker:string){
 return s.rows.filter(r=>!r.id.startsWith('coverage:')).flatMap(row=>{try{const r=JSON.parse(row.data),task=s.tasks.find(t=>t.id===r.taskId);if(!['running','registered'].includes(r.state)||task?.status==='In Progress'||(worker&&r.workerId!==worker)||(project&&task?.project!==project))return [];return [{...r,boardStatus:task?.status||'Task missing'}]}catch{return []}});
}
