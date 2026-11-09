import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../db';
import { workspaceDiscussions } from '../../../db/schema';

const query = z.string().trim().min(1).max(120);
const create = z.object({ project: z.string().trim().min(1).max(120).default('General'), author: z.string().trim().min(1).max(120), workerId: z.string().trim().max(120).optional(), runId: z.string().trim().max(120).optional(), body: z.string().trim().min(1).max(6000) }).strict();
const update = z.object({ id: z.number().int().positive(), status: z.enum(['open', 'seen', 'acknowledged']) }).strict();

export async function GET(req: Request) {
  const project = new URL(req.url).searchParams.get('project');
  if (project !== null && !query.safeParse(project).success) return Response.json({ error: 'Provide a valid project.' }, { status: 400 });
  try {
    const db = getDb();
    const rows = project ? await db.select().from(workspaceDiscussions).where(eq(workspaceDiscussions.project, project)).orderBy(asc(workspaceDiscussions.id)) : await db.select().from(workspaceDiscussions).orderBy(asc(workspaceDiscussions.id));
    return Response.json(rows, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Could not load workspace discussion.' }, { status: 500 }); }
}

export async function POST(req: Request) {
  const parsed = create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Provide a project, author, and message.' }, { status: 400 });
  try {
    const now = new Date().toISOString();
    const [saved] = await getDb().insert(workspaceDiscussions).values({ ...parsed.data, workerId: parsed.data.workerId || null, runId: parsed.data.runId || null, status: 'open', createdAt: now, updatedAt: now }).returning();
    return Response.json(saved, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Could not post to workspace discussion.' }, { status: 500 }); }
}

export async function PATCH(req: Request) {
  const parsed = update.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Provide a discussion ID and status.' }, { status: 400 });
  try {
    const [saved] = await getDb().update(workspaceDiscussions).set({ status: parsed.data.status, updatedAt: new Date().toISOString() }).where(eq(workspaceDiscussions.id, parsed.data.id)).returning();
    return saved ? Response.json(saved) : Response.json({ error: 'Discussion message not found.' }, { status: 404 });
  } catch { return Response.json({ error: 'Could not update discussion message.' }, { status: 500 }); }
}
