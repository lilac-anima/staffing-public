import { diffWordsWithSpace } from 'diff';
export type EvidenceTask = { id: string; title: string; assignee: string; status: string; startedAt: string | null; acceptedAt: string | null; firstDeliveredAt: string | null; necessaryQuestions: number | null; avoidableQuestions: number | null; reworkRounds: number | null; metricsHistoryReviewed: boolean; configSnapshot?: string | null; effort?: { inputTokens: number|null; outputTokens: number|null; cachedInputTokens: number|null; reasoningOutputTokens: number|null; elapsedMs: number|null; activeMs: number|null; wallMs: number|null; runs:number; completeRuns:number } };
export function summarizeEvidence(rows: EvidenceTask[]) {
  const excluded = rows.filter(r=>r.status.endsWith('/ excluded')).length;
  rows = rows.filter(r=>!r.status.endsWith('/ excluded'));
  const sum = (key: 'necessaryQuestions' | 'avoidableQuestions' | 'reworkRounds') => { const known = rows.filter(r => r.metricsHistoryReviewed && r[key] !== null); return { total: known.reduce((n, r) => n + (r[key] || 0), 0), known: known.length }; };
  // Existing task timestamps include backfills without trustworthy timing provenance.
  const durations: number[] = [];
  return { excluded, tasks: rows.length, accepted: rows.filter(r => r.status === 'Done').length, necessary: sum('necessaryQuestions'), avoidable: sum('avoidableQuestions'), rework: sum('reworkRounds'), meanAcceptanceMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null, timed: durations.length };
}
export function uncoveredTasks(rows: EvidenceTask[], name: string, coveredIds: string[]) { const covered = new Set(coveredIds); return rows.filter(r => r.assignee === name && r.status === 'Done' && !covered.has(r.id)); }
export function characterDifferences(a: Record<string, unknown>, b: Record<string, unknown>) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(key => key !== 'id' && key !== 'name').filter(key => JSON.stringify(a[key] ?? null) !== JSON.stringify(b[key] ?? null)).map(key => ({ key, a: a[key] ?? null, b: b[key] ?? null }));
}

export function changedPassages(a: unknown, b: unknown) {
  const render = (v:unknown) => v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v,null,2);
  return diffWordsWithSpace(render(a),render(b)).filter(part=>part.added || part.removed).map(part=>({kind:part.added ? 'added' as const : 'removed' as const, text:part.value}));
}
