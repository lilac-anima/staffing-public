import { z } from 'zod';
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable();
export const runInput = z.object({
  id: z.string().trim().min(1).max(120).refine(s=>!s.startsWith('coverage:'),'Reserved ID'), taskId: z.string().trim().min(1).max(120),
  workerId: z.string().trim().min(1).max(120), instanceId: z.string().trim().min(1).max(160).nullable().default(null), configSnapshot: z.string().trim().min(1).max(4000), attributionScope: z.enum(['task-disjoint-run','task-disjoint-turn','unknown']), runtimeBasis: z.enum(['worker-run-elapsed','unknown']), source: z.string().trim().min(1).max(500), scope: z.string().trim().min(1).max(500),
  inputTokens: count, outputTokens: count, cachedInputTokens: count, reasoningOutputTokens: count,
  elapsedMs: count, activeMs: count, wallMs: count,
  state: z.enum(['unknown','registered','running','completed','failed','interrupted']).default('unknown'), startedAt: z.string().datetime().nullable().default(null), endedAt: z.string().datetime().nullable().default(null), heartbeatAt: z.string().datetime().nullable().default(null), observedAt: z.string().datetime().nullable().default(null), complete: z.boolean(), taskCoverageComplete: z.boolean(), notes: z.string().max(2000).default(''),
}).strict().superRefine((r,ctx) => {
  if (['registered','running'].includes(r.state) && r.complete) ctx.addIssue({code:'custom',message:'An active run cannot have complete measurements'});
  for (const [subset,total] of [['cachedInputTokens','inputTokens'],['reasoningOutputTokens','outputTokens'],['activeMs','elapsedMs']] as const) {
    if (r[subset] !== null && r[total] !== null && r[subset]! > r[total]!) ctx.addIssue({code:'custom',message:`${subset} must be a subset of ${total}`});
  }
});
export type WorkerRun = z.infer<typeof runInput>;
export function taskEffort(runs: WorkerRun[], covered = false) {
  const fields = ['inputTokens','outputTokens','cachedInputTokens','reasoningOutputTokens','elapsedMs','activeMs','wallMs'] as const;
  const values = Object.fromEntries(fields.map(k => [k, runs.length && runs.every(r=>covered && r.complete && r[k] !== null) ? runs.reduce((s,r)=>s+r[k]!,0) : null])) as Record<typeof fields[number],number|null>;
  const partial = Object.fromEntries(fields.map(k=>[k,{subtotal:runs.reduce((s,r)=>s+(r[k] ?? 0),0),known:runs.filter(r=>r[k]!==null).length,total:runs.length}])); return { ...values, partial, runs: runs.length, completeRuns: runs.filter(r=>r.complete).length, sources: runs }; 
}

export function runSnapshot(rows:{id:string;data:string}[]) { return JSON.stringify(rows.filter(r=>!r.id.startsWith('coverage:')).map(r=>[r.id,r.data]).sort((a,b)=>a[0].localeCompare(b[0]))); }
export function effortFromRows(rows:{id:string;data:string}[], configSnapshot:string|null, status='Done') { const records=rows.filter(r=>!r.id.startsWith('coverage:')); const attestation=rows.find(r=>r.id.startsWith('coverage:')); const runs=records.map(r=>JSON.parse(r.data)); let config:any=null; try {config=configSnapshot && JSON.parse(configSnapshot)} catch {} const attributed=!!config?.workerId && runs.every(r=>r.workerId===config.workerId && r.configSnapshot===configSnapshot && r.attributionScope!=='unknown' && r.runtimeBasis==='worker-run-elapsed'); return taskEffort(runs,status==='Done' && !!records.length && attributed && attestation?.data===runSnapshot(records)); }

export function calculatePairEffort(pair: any) {
  const base = {version:'1',weights:{tokens:0.5,runtime:0.5},raw:{a:pair.a?.effort ?? null,b:pair.b?.effort ?? null},ratios:null as null | {tokens:number;runtime:number},indexA:null as number|null,indexB:null as number|null};
  if (pair.quality==='fail') return {...base,status:'Not eligible',reason:'Quality gate failed'};
  const a=pair.a?.effort,b=pair.b?.effort;
  if (pair.comparable!=='yes' || pair.quality!=='pass' || pair.basis!=='same' || !pair.gateEvidence || pair.a?.status!=='Done' || pair.b?.status!=='Done' || !a || !b || a.inputTokens==null || a.outputTokens==null || a.elapsedMs==null || b.inputTokens==null || b.outputTokens==null || b.elapsedMs==null || a.inputTokens+a.outputTokens<=0 || a.elapsedMs<=0) return {...base,status:'Unknown',reason:'Missing coverage, comparable scope, quality, basis, completed outcome, or positive baseline'};
  const ratios={tokens:(b.inputTokens+b.outputTokens)/(a.inputTokens+a.outputTokens),runtime:b.elapsedMs/a.elapsedMs};
  return {...base,status:'Eligible',reason:'All recorded gates confirmed',ratios,indexA:100,indexB:100*(0.5*ratios.tokens+0.5*ratios.runtime)};
}
