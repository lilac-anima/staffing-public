import { calculatePairEffort } from './worker-effort';
import { type EvidenceTask } from './review-metrics';
type Sheet = Record<string, unknown> & { id: string; name: string };
export type LiveTask = EvidenceTask & { configSnapshot?: string | null };
function config(task: LiveTask): Record<string, unknown> | null { try { return task.configSnapshot ? JSON.parse(task.configSnapshot) : null; } catch { return null; } }
export function ownedBy(task: LiveTask, sheet: Sheet, people: Sheet[]) {
  const matches = people.filter(p => p.name === task.assignee);
  const snapshot = config(task);
  return snapshot?.workerId ? snapshot.workerId === sheet.id && matches.length === 1 && matches[0].id === sheet.id : matches.length === 1 && matches[0].id === sheet.id;
}
export function executionMatch(task: LiveTask, sheet: Sheet, createdAt: string, people: Sheet[]) {
  const snapshot = config(task);
  if (!ownedBy(task,sheet,people)) return false;
  if (!task.startedAt || !Number.isFinite(Date.parse(task.startedAt)) || Date.parse(task.startedAt) < Date.parse(createdAt)) return false;
  if (!snapshot || snapshot.workerId !== sheet.id) return false;
  return ['preferredModel','reasoningEffort','profileRevision','memoryRevision'].every(key => snapshot[key] !== undefined && (snapshot[key] ?? null) === (sheet[key] ?? null));
}
export function currentEvidence(frozen: LiveTask, sheet: Sheet, work: LiveTask[], people: Sheet[]) {
  const current = work.find(t => t.id === frozen.id);
  if (current && ownedBy(current,sheet,people)) return current;
  return { ...frozen, status: current ? 'Reassigned / excluded' : 'Missing / excluded', necessaryQuestions:null,avoidableQuestions:null,reworkRounds:null,metricsHistoryReviewed:false,startedAt:null,acceptedAt:null,firstDeliveredAt:null, effort:undefined };
}
export function projectTest(data: Record<string, any>, work: LiveTask[], people: Sheet[]) {
  const a = data.a as Sheet, b = data.b as Sheet;
  return { ...data, pairs: (data.pairs || []).map((p: {a:LiveTask;b:LiveTask}) => { const matching=(t:LiveTask,s:Sheet)=>{ const live=currentEvidence(t,s,work,people); const c=config(live); return c && c.workerId===s.id && ['preferredModel','reasoningEffort','profileRevision','memoryRevision'].every(key=>c[key]!==undefined && (c[key]??null)===(s[key]??null)) ? live : {...live,effort:undefined}; }; const pair={...p,a:matching(p.a,a),b:matching(p.b,b)}; return {...pair,effortResult:calculatePairEffort(pair)}; }), execution: {a:work.filter(t=>executionMatch(t,a,data.createdAt,people)),b:work.filter(t=>executionMatch(t,b,data.createdAt,people))}, projectedAt:new Date().toISOString() };
}
export function projectReview(data: Record<string, any>, work: LiveTask[], people: Sheet[]) {
  if (!data.snapshot) return data;
  const evidence = (data.taskEvidence || []).map((t:LiveTask)=>currentEvidence(t,data.snapshot,work,people));
  return {...data,currentEvidence:evidence,eligibilityWarnings:evidence.filter((t:LiveTask)=>t.status!=='Done').map((t:LiveTask)=>`${t.title}: ${t.status}`)};
}
