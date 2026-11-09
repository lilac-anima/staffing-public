import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../db';
import { taskCommunications, tasks } from '../../../db/schema';

const taskId = z.string().trim().min(1).max(100);
const payload = z.object({ summary: z.string().trim().min(1).max(2000), evidence: z.string().max(4000).default(''), next: z.string().max(2000).default(''), question: z.string().max(2000).default(''), workerInstanceId: z.string().max(120).default(''), runId: z.string().max(120).default('') }).strict();
const create = z.object({ taskId, kind: z.enum(['update', 'help', 'review']), author: z.string().trim().min(1).max(120), status: z.enum(['open', 'seen', 'accepted', 'needs-clarification']).default('open'), workerId: z.string().max(120).optional(), runId: z.string().max(120).optional(), payload }).strict();
const update = z.object({ id: z.number().int().positive(), status: z.enum(['open', 'seen', 'accepted', 'needs-clarification']) }).strict();

function present(row: typeof taskCommunications.$inferSelect) { return { ...row, payload: JSON.parse(row.payload) }; }

export async function GET(req: Request) {
  const parsed = taskId.safeParse(new URL(req.url).searchParams.get('taskId'));
  if (!parsed.success) return Response.json({ error: 'Provide a valid task ID.' }, { status: 400 });
  try {
    const db = getDb();
    const [task] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, parsed.data)).limit(1);
    if (!task) return Response.json({ error: 'Task not found.' }, { status: 404 });
    const rows = await db.select().from(taskCommunications).where(eq(taskCommunications.taskId, parsed.data)).orderBy(asc(taskCommunications.id));
    return Response.json(rows.map(present), { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Could not load task communications.' }, { status: 500 }); }
}

export async function POST(req: Request) {
  const parsed = create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Provide an author and structured communication update.' }, { status: 400 });
  try {
    const db = getDb();
    const [task] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, parsed.data.taskId)).limit(1);
    if (!task) return Response.json({ error: 'Task not found.' }, { status: 404 });
    const now = new Date().toISOString();
    const [saved] = await db.insert(taskCommunications).values({ taskId: parsed.data.taskId, kind: parsed.data.kind, status: parsed.data.status, author: parsed.data.author, workerId: (parsed.data.workerId ?? parsed.data.payload.workerInstanceId) || null, runId: (parsed.data.runId ?? parsed.data.payload.runId) || null, payload: JSON.stringify(parsed.data.payload), createdAt: now, updatedAt: now }).returning();
    return Response.json(present(saved), { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Could not save task communication.' }, { status: 500 }); }
}

export async function PATCH(req: Request) {
  const parsed = update.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Provide a communication ID and status.' }, { status: 400 });
  try {
    const [saved] = await getDb().update(taskCommunications).set({ status: parsed.data.status, updatedAt: new Date().toISOString() }).where(eq(taskCommunications.id, parsed.data.id)).returning();
    return saved ? Response.json(present(saved)) : Response.json({ error: 'Communication not found.' }, { status: 404 });
  } catch { return Response.json({ error: 'Could not update communication.' }, { status: 500 }); }
}
