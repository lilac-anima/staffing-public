import { and, eq } from 'drizzle-orm';
import { getDb } from '../../../db';
import { staff, tasks, workerMemory } from '../../../db/schema';
import { z } from 'zod';
import { reconcileReviewQueue } from '../../../lib/review-queue';

const schema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(160),
  project: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(4000).default(''),
  assignee: z.string().max(120).default(''),
  status: z.enum(['Backlog', 'Ready', 'In Progress', 'Blocked', 'Done']),
  blocker: z.string().max(2000).default(''),
  necessaryQuestions: z.number().int().min(0).max(1000000).optional(),
  avoidableQuestions: z.number().int().min(0).max(1000000).optional(),
  recordDelivery: z.boolean().optional(),
  reviewedReturn: z.boolean().optional(),
  confirmMetricsHistory: z.boolean().optional(),
  updatedAt: z.string().optional(),
});

type TaskRow = typeof tasks.$inferSelect;
function present(row: TaskRow) {
  const duration = (end: string | null) => row.startedAt && end ? Math.max(0, Date.parse(end) - Date.parse(row.startedAt)) : null;
  return { ...row, unverifiedStoredCounts: row.metricsHistoryReviewed ? null : { necessaryQuestions: row.necessaryQuestions, avoidableQuestions: row.avoidableQuestions, reworkRounds: row.reworkRounds }, necessaryQuestions: row.metricsHistoryReviewed ? row.necessaryQuestions : null, avoidableQuestions: row.metricsHistoryReviewed ? row.avoidableQuestions : null, reworkRounds: row.metricsHistoryReviewed ? row.reworkRounds : null, configSnapshot: row.configSnapshot ? JSON.parse(row.configSnapshot) : null,
    timeToFirstDeliveryMs: duration(row.firstDeliveredAt), timeToAcceptanceMs: duration(row.acceptedAt) };
}

export async function GET() {
  try {
    const rows = await getDb().select().from(tasks);
    return Response.json(rows.map(present), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Could not load tasks.' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Please provide a valid task and nonnegative whole-number question counts.' }, { status: 400 });
  const { recordDelivery, reviewedReturn, confirmMetricsHistory, updatedAt: expected, ...data } = parsed.data;
  try {
    const db = getDb();
    const [existing] = await db.select().from(tasks).where(eq(tasks.id, data.id)).limit(1);
    if (existing && expected && existing.updatedAt !== expected) return Response.json({ error: 'This task changed elsewhere. Reload the board before saving.' }, { status: 409 });
    if (reviewedReturn && (!existing || existing.status === 'Ready' || data.status !== 'Ready' || !existing.firstDeliveredAt)) {
      return Response.json({ error: 'A reviewed return requires a previously delivered task moving to Ready.' }, { status: 400 });
    }
    const now = new Date().toISOString();
    let configSnapshot = existing?.configSnapshot ?? null;
    const starting = data.status === 'In Progress' && !existing?.startedAt;
    if (starting) {
      const profiles = await db.select().from(staff);
      const matches = profiles.filter(row => { try { return JSON.parse(row.data).name === data.assignee; } catch { return false; } });
      if (matches.length === 1) {
        const profile = matches[0];
        const info = JSON.parse(profile.data);
        const [memory] = await db.select().from(workerMemory).where(eq(workerMemory.workerId, profile.id)).limit(1);
        configSnapshot = JSON.stringify({ workerId: profile.id, preferredModel: info.preferredModel ?? null, reasoningEffort: info.reasoningEffort ?? null, profileRevision: profile.updatedAt, memoryRevision: memory?.updatedAt ?? null });
      }
    }
    const values = { ...data, project: data.project ?? existing?.project ?? 'General', updatedAt: now, startedAt: existing?.startedAt ?? (starting ? now : null),
      firstDeliveredAt: existing?.firstDeliveredAt ?? (recordDelivery ? now : null),
      acceptedAt: existing && existing.status !== 'Done' && data.status === 'Done' ? now : (existing?.acceptedAt ?? (data.status === 'Done' && !existing ? now : null)),
      acceptedAtSource: existing && existing.status !== 'Done' && data.status === 'Done' ? 'recorded-transition' : (existing?.acceptedAtSource ?? 'unknown'),
      necessaryQuestions: data.necessaryQuestions ?? existing?.necessaryQuestions ?? 0,
      avoidableQuestions: data.avoidableQuestions ?? existing?.avoidableQuestions ?? 0,
      reworkRounds: (existing?.reworkRounds ?? 0) + (reviewedReturn ? 1 : 0), metricsHistoryReviewed: existing ? (existing.metricsHistoryReviewed || !!confirmMetricsHistory) : true, configSnapshot };
    let saved: TaskRow | undefined;
    if (existing) {
      [saved] = await db.update(tasks).set(values).where(and(eq(tasks.id, data.id), eq(tasks.updatedAt, existing.updatedAt))).returning();
      if (!saved) return Response.json({ error: 'This task changed elsewhere. Reload the board before saving.' }, { status: 409 });
    } else {
      [saved] = await db.insert(tasks).values(values).returning();
    }
    let reviewSyncWarning: string | undefined;
    try { await reconcileReviewQueue(db); } catch { reviewSyncWarning = 'Task saved. Automatic review queue synchronization is pending; a later save or Reviews refresh will retry.'; }
    return Response.json({ ...present(saved), ...(reviewSyncWarning ? { reviewSyncWarning } : {}) });
  } catch {
    return Response.json({ error: 'Could not save this task.' }, { status: 500 });
  }
}
