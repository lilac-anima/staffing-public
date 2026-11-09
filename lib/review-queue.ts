import { sql } from 'drizzle-orm';
import { getDb } from '../db';
import { staff, tasks, workerMemory, workerReviews } from '../db/schema';
import { uncoveredTasks, summarizeEvidence } from './review-metrics';
import { ownedBy } from './review-live';
/** Idempotent completion-driven repair, safe to retry after task persistence. */
export async function reconcileReviewQueue(db = getDb()) {
  for (let attempt=0;attempt<3;attempt++) {
    const [records,people,work,memories] = await Promise.all([db.select().from(workerReviews),db.select().from(staff),db.select().from(tasks),db.select().from(workerMemory)]);
    let attempted=false;
    const profiles=people.map(p=>({...JSON.parse(p.data),profileRevision:p.updatedAt}));
    for (const profile of profiles) {
      if (profile.status==='Retired' || records.some(r=>r.kind==='review' && r.workerId===profile.id && r.status!=='Completed')) continue;
      const completed=records.filter(r=>r.kind==='review'&&r.workerId===profile.id&&r.status==='Completed');
      const covered=completed.flatMap(r=>JSON.parse(r.data).coveredTaskIds||[]);
      const pending=uncoveredTasks(work,profile.name,covered).filter(t=>ownedBy(t,profile,profiles));
      if(pending.length<5) continue;
      const memory=memories.find(m=>m.workerId===profile.id),now=new Date().toISOString();
      const data=JSON.stringify({workerName:profile.name,workerKind:profile.name,snapshot:{...profile,memory:memory?.content??'',memoryRevision:memory?.updatedAt??null},coveredTaskIds:pending.map(t=>t.id),taskEvidence:pending,stats:summarizeEvidence(pending),summary:'',createdAt:now,automaticallyQueued:true});
      // Generation guard: a concurrent completed review invalidates this stale batch.
      // The partial unique index serializes simultaneous eligible completions.
      attempted=true;
      await db.run(sql`INSERT OR IGNORE INTO worker_reviews(id,kind,worker_id,status,data,updated_at)
        SELECT ${crypto.randomUUID()},'review',${profile.id},'Queued',${data},${now}
        WHERE (SELECT count(*) FROM worker_reviews WHERE kind='review' AND worker_id=${profile.id} AND status='Completed')=${completed.length}
        AND NOT EXISTS(SELECT 1 FROM worker_reviews WHERE kind='review' AND worker_id=${profile.id} AND status IN ('Queued','In review'))`);
    }
    if(!attempted)break;
  }
}
