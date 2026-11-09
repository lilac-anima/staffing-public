import { getDb } from '../../../db';
import { workerMemory } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export async function GET(req: Request) {
  const workerId = new URL(req.url).searchParams.get('workerId');
  if (!workerId) return Response.json({ error: 'Worker ID is required.' }, { status: 400 });
  try {
    const [record] = await getDb().select().from(workerMemory).where(eq(workerMemory.workerId, workerId)).limit(1);
    return Response.json(record ?? { workerId, content: '', updatedAt: null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Could not load worker memory.' }, { status: 500 }); }
}

export async function PUT(req: Request) {
  const parsed = z.object({ workerId: z.string().min(1).max(100), content: z.string().max(30000) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Please provide valid worker memory.' }, { status: 400 });
  const { workerId, content } = parsed.data; const updatedAt = new Date().toISOString();
  try {
    await getDb().insert(workerMemory).values({ workerId, content, updatedAt }).onConflictDoUpdate({ target: workerMemory.workerId, set: { content, updatedAt } });
    return Response.json({ workerId, content, updatedAt });
  } catch { return Response.json({ error: 'Could not save worker memory.' }, { status: 500 }); }
}
