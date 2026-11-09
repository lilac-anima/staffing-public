import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../db';
import { staff, tasks, workerMemory, workerReviews, workerRuns } from '../../../db/schema';
import { uncoveredTasks, summarizeEvidence } from '../../../lib/review-metrics';
import { reconcileReviewQueue } from '../../../lib/review-queue';
import { effortFromRows } from '../../../lib/worker-effort';
import { projectTest, projectReview, ownedBy } from '../../../lib/review-live';
const text = z.string().trim().min(1).max(12000);
const input = z.discriminatedUnion('action', [
  z.object({ action: z.literal('queue'), workerId: text }),
  z.object({ action: z.literal('importBaseline') }),
  z.object({ action: z.literal('review'), id: text, updatedAt: text, status: z.enum(['In review', 'Completed']), summary: text }),
  z.object({ action: z.literal('test'), workerId: text, challengerId: text, workerKind: text, hypothesis: text }),
  z.object({ action: z.literal('evidence'), id: text, updatedAt: text, taskA: text, taskB: text, rationale: text, comparable: z.enum(['yes','no','unknown']).default('unknown'), quality: z.enum(['pass','fail','unknown']).default('unknown'), basis: z.enum(['same','different','unknown']).default('unknown'), gateEvidence: z.string().max(12000).default('') }),
  z.object({ action: z.literal('finishTest'), id: text, updatedAt: text, conclusion: text }),
]);
export async function GET() {
  try {
    const db = getDb();
    let syncWarning: string | undefined;
    try { await reconcileReviewQueue(db); } catch { syncWarning = 'Automatic review queue synchronization is pending. Refresh to retry.'; }
    const [records, people, rawWork, runs] = await Promise.all([db.select().from(workerReviews), db.select().from(staff), db.select().from(tasks), db.select().from(workerRuns)]);
    const work = rawWork.map(t=>({...t,effort:effortFromRows(runs.filter(r=>r.taskId===t.id),t.configSnapshot,t.status)}));
    const workers = people.map(p => JSON.parse(p.data));
    const parsed = records.map(r => { const data = JSON.parse(r.data); return { ...r, data: r.status === 'Completed' ? data : r.kind === 'test' ? projectTest(data, work, workers) : projectReview(data, work, workers) }; });
    const queue = workers.filter(p => p.status !== 'Retired').map(p => { const covered = parsed.filter(r => r.kind === 'review' && r.workerId === p.id && r.status === 'Completed').flatMap(r => r.data.coveredTaskIds || []); const pending = uncoveredTasks(work, p.name, covered).filter(t=>ownedBy(t,p,workers)); return { workerId: p.id, workerName: p.name, accepted: pending.length, taskIds: pending.map(t => t.id), queued: parsed.some(r => r.kind === 'review' && r.workerId === p.id && r.status !== 'Completed') }; });
    return Response.json({ records: parsed, workers, tasks: work, queue, refreshedAt: new Date().toISOString(), syncWarning }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Could not load reviews. Ensure the reviews database migration has been applied.' }, { status: 500 }); }
}
export async function POST(req: Request) {
  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Complete all required fields.' }, { status: 400 });
  const body = parsed.data; const db = getDb(); const now = new Date().toISOString();
  try {
    const people = await db.select().from(staff); const rawWork = await db.select().from(tasks); const runs = await db.select().from(workerRuns); const work = rawWork.map(t=>({...t,effort:effortFromRows(runs.filter(r=>r.taskId===t.id),t.configSnapshot,t.status)}));
    async function snapshot(id: string) { const row = people.find(p => p.id === id); if (!row) throw new Error('Worker does not exist.'); const [memory] = await db.select().from(workerMemory).where(eq(workerMemory.workerId, id)); return { ...JSON.parse(row.data), memory: memory?.content ?? '', profileRevision: row.updatedAt, memoryRevision: memory?.updatedAt ?? null }; }
    if (body.action === 'importBaseline') {
      await db.insert(workerReviews).values({ id: 'hacker-initial-review-20261107', kind: 'review', workerId: '6544bb67-c104-4311-9dce-6a27ca650f86', status: 'Completed', data: JSON.stringify({ workerName: 'Hacker', workerKind: 'Hacker', coveredTaskIds: ['966be57f-6401-412f-a244-44c9093257ed'], summary: 'Initial PM review: navigation task accepted, n=1. Duration unknown; no clone comparison.', source: 'Hacker worker memory: performance review dated 2026-11-07', completedAt: '2026-11-07', snapshot: null }), updatedAt: now }).onConflictDoNothing();
    } else if (body.action === 'queue') {
      const snap = await snapshot(body.workerId); const records = await db.select().from(workerReviews).where(eq(workerReviews.workerId, body.workerId));
      if (records.some(r => r.kind === 'review' && r.status !== 'Completed')) return Response.json({ error: 'This worker already has an open review.' }, { status: 409 });
      const covered = records.filter(r => r.kind === 'review' && r.status === 'Completed').flatMap(r => JSON.parse(r.data).coveredTaskIds || []); const pending = uncoveredTasks(work, snap.name, covered).filter(t=>ownedBy(t,snap,people.map(p=>JSON.parse(p.data))));
      if (pending.length < 5) return Response.json({ error: 'Five accepted tasks since the prior review are required.' }, { status: 400 });
      await db.insert(workerReviews).values({ id: crypto.randomUUID(), kind: 'review', workerId: body.workerId, status: 'Queued', data: JSON.stringify({ workerName: snap.name, workerKind: snap.name, snapshot: snap, coveredTaskIds: pending.map(t => t.id), taskEvidence: pending, stats: summarizeEvidence(pending), summary: '', createdAt: now }), updatedAt: now });
    } else if (body.action === 'test') {
      if (body.workerId === body.challengerId) return Response.json({ error: 'Select two different worker records.' }, { status: 400 });
      const a = await snapshot(body.workerId), b = await snapshot(body.challengerId);
      if (a.status !== 'Active' || b.status !== 'Active') return Response.json({ error: 'Both worker records must be active.' }, { status: 400 });
      const records = await db.select().from(workerReviews);
      if (records.some(r => r.kind === 'test' && r.status === 'Active' && JSON.parse(r.data).workerKind.toLowerCase().trim() === body.workerKind.toLowerCase().trim())) return Response.json({ error: 'This worker kind already has an active test.' }, { status: 409 });
      await db.insert(workerReviews).values({ id: crypto.randomUUID(), kind: 'test', workerId: body.workerId, status: 'Active', data: JSON.stringify({ workerKind: body.workerKind, hypothesis: body.hypothesis, a, b, pairs: [], createdAt: now }), updatedAt: now });
    } else {
      const [record] = await db.select().from(workerReviews).where(eq(workerReviews.id, body.id));
      if (!record) return Response.json({ error: 'Record not found.' }, { status: 404 });
      if (record.updatedAt !== body.updatedAt) return Response.json({ error: 'This record changed. Reload before saving.' }, { status: 409 });
      const data = JSON.parse(record.data); let status = record.status;
      if (body.action === 'review') {
        if (record.kind !== 'review' || status === 'Completed' || (status === 'In review' && body.status === 'In review') || (status === 'Queued' && body.status === 'Completed')) return Response.json({ error: 'This review transition is unavailable.' }, { status: 400 });
        status = body.status; data.summary = body.summary; if (status === 'Completed') {
          const current = projectReview(data, work, people.map(p=>JSON.parse(p.data)));
          data.originalCoveredTaskIds = data.coveredTaskIds;
          data.coveredTaskIds = (current.currentEvidence || data.taskEvidence || []).filter((t: {status:string})=>t.status==='Done').map((t:{id:string})=>t.id);
          data.completionEvidence = current.currentEvidence; data.eligibilityWarnings = current.eligibilityWarnings; data.completedAt = now;
        }
      } else {
        if (record.kind !== 'test' || status !== 'Active') return Response.json({ error: 'Only active tests can be updated.' }, { status: 400 });
        if (body.action === 'finishTest') { status = 'Completed'; Object.assign(data, projectTest(data, work, people.map(p=>JSON.parse(p.data)))); data.conclusion = body.conclusion; data.completedAt = now; }
        else {
          if (body.taskA === body.taskB) return Response.json({ error: 'Matched cases must be separate task records.' }, { status: 400 });
          const a = work.find(t => t.id === body.taskA), b = work.find(t => t.id === body.taskB);
          if (!a || !b || a.assignee !== data.a.name || b.assignee !== data.b.name) return Response.json({ error: 'Each task must belong to its selected worker version.' }, { status: 400 });
          if (data.pairs.some((p: { a: { id: string }; b: { id: string } }) => [p.a.id, p.b.id].some(id => [a.id, b.id].includes(id)))) return Response.json({ error: 'A task is already included in this test.' }, { status: 400 });
          data.pairs.push({ a, b, rationale: body.rationale, comparable:body.comparable, quality:body.quality, basis:body.basis, gateEvidence:body.gateEvidence, recordedAt: now });
        }
      }
      const result = await db.update(workerReviews).set({ status, data: JSON.stringify(data), updatedAt: now }).where(and(eq(workerReviews.id, record.id), eq(workerReviews.updatedAt, body.updatedAt))).returning();
      if (!result.length) return Response.json({ error: 'This record changed. Reload before saving.' }, { status: 409 });
    }
    let syncWarning: string | undefined;
    try { await reconcileReviewQueue(db); } catch { syncWarning = 'Record saved. Automatic review queue synchronization is pending; refresh to retry.'; }
    return Response.json({ saved: true, syncWarning });
  } catch (e) { const message = (e as Error).message; return Response.json({ error: message.includes('UNIQUE') ? 'An open review or test already exists. Reload the page.' : 'Could not save this review or test. Check that both workers exist and the database is available.' }, { status: 409 }); }
}
