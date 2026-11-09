import { and, asc, eq, gt } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../db';
import { tasks, taskWorkLog } from '../../../db/schema';

const taskId = z.string().trim().min(1).max(100);
const entry = z.object({ taskId, author: z.string().trim().min(1).max(120), body: z.string().trim().min(1).max(4000), workerId: z.string().trim().min(1).max(120).optional(), runId: z.string().trim().min(1).max(120).optional() }).strict();
const cursor = z.string().regex(/^(0|[1-9]\d{0,14})$/).transform(Number).refine(Number.isSafeInteger);

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const id = taskId.safeParse(params.get('taskId'));
  const after = cursor.safeParse(params.get('after') ?? '0');
  if (!id.success || !after.success || [...params.keys()].some(key => !['taskId', 'after'].includes(key)) || params.getAll('taskId').length !== 1 || params.getAll('after').length > 1) return Response.json({ error: 'Provide a valid task ID and log cursor.' }, { status: 400 });
  try {
    const db = getDb();
    const [task] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, id.data)).limit(1);
    if (!task) return Response.json({ error: 'Task not found.' }, { status: 404 });
    const rows = await db.select().from(taskWorkLog).where(and(eq(taskWorkLog.taskId, id.data), gt(taskWorkLog.id, after.data))).orderBy(asc(taskWorkLog.id)).limit(101);
    return Response.json({ entries: rows.slice(0, 100), nextAfter: rows.length > 100 ? rows[99].id : null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Could not load the task work log.' }, { status: 500 }); }
}

export async function POST(req: Request) {
  const parsed = entry.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Provide a task ID, author (1–120 characters), and entry (1–4,000 characters).' }, { status: 400 });
  try {
    const db = getDb();
    const [task] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, parsed.data.taskId)).limit(1);
    if (!task) return Response.json({ error: 'Task not found.' }, { status: 404 });
    const [saved] = await db.insert(taskWorkLog).values({ ...parsed.data, workerId:parsed.data.workerId ?? null, runId:parsed.data.runId ?? null, attribution:parsed.data.workerId ? 'asserted' : 'legacy-unknown', createdAt: new Date().toISOString() }).returning();
    return Response.json(saved, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Could not append the task work log entry.' }, { status: 500 }); }
}
