'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { mergeBoard } from '../../lib/kanban-live';
import { LiveWorkLog, type LogState } from '../../lib/work-log-live';
import { CircleDot, Plus, Save, Users, KanbanSquare, Sparkles, MessageCircle } from 'lucide-react';

type Task = { id: string; title: string; project: string; description: string; assignee: string; status: string; blocker: string; updatedAt?: string; startedAt?: string | null; firstDeliveredAt?: string | null; acceptedAt?: string | null; necessaryQuestions?: number | null; avoidableQuestions?: number | null; reworkRounds?: number | null; metricsHistoryReviewed?: boolean; unverifiedStoredCounts?: { necessaryQuestions: number; avoidableQuestions: number; reworkRounds: number } | null; configSnapshot?: { workerId: string; preferredModel: string | null; reasoningEffort: string | null; profileRevision: string; memoryRevision: string | null } | null; timeToFirstDeliveryMs?: number | null; timeToAcceptanceMs?: number | null };
type Communication = { id:number; kind:'update'|'help'|'review'; status:'open'|'seen'|'accepted'|'needs-clarification'; author:string; workerId?:string|null; runId?:string|null; createdAt:string; payload:{summary:string;evidence:string;next:string;question:string;workerInstanceId:string;runId:string} };
const columns = ['Backlog', 'Ready', 'In Progress', 'Blocked', 'Done'];

function WorkLog({ taskId, draft, setDraft }: { taskId: string; draft:{author:string;body:string}; setDraft:(value:{author:string;body:string})=>void }) {
 const [state,setState]=useState<LogState>({entries:[],next:null,busy:false,error:''});const manager=useRef<LiveWorkLog|null>(null);
 useEffect(()=>{const log=new LiveWorkLog(taskId,setState);manager.current=log;void log.refresh();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void log.refresh()},3000);const focus=()=>{if(document.visibilityState==='visible')void log.refresh()};window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);return()=>{clearInterval(timer);log.dispose();manager.current=null;window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus)}},[taskId]);
 async function append(e:React.FormEvent){e.preventDefault();if(await manager.current?.append(draft.author,draft.body))setDraft({...draft,body:''})}
 return <section className="work-log"><h3>Work log</h3>{state.error&&<p role="alert">{state.error}</p>}<div className="work-log-text" aria-label="Work log entries">{state.entries.length?state.entries.map(item=><div key={item.id}><strong>{new Date(item.createdAt).toLocaleString()} — {item.author}</strong>{'\n'}{item.body}{'\n\n'}</div>):'No entries yet.'}</div>{state.next!==null&&<button type="button" disabled={state.busy} onClick={()=>void manager.current?.refresh(true)}>Load more entries</button>}<form onSubmit={append}><fieldset disabled={state.busy} style={{border:0,padding:0,margin:0,minWidth:0}}><label>AUTHOR<input required maxLength={120} value={draft.author} onChange={e=>setDraft({...draft,author:e.target.value})}/></label><label>APPEND ENTRY<textarea required maxLength={4000} rows={3} value={draft.body} onChange={e=>setDraft({...draft,body:e.target.value})}/></label><button className="task-save">{state.busy?'Working…':'Append entry'}</button></fieldset></form></section>;
}

function CommunicationThread({ taskId }: { taskId:string }) {
 const [items,setItems]=useState<Communication[]>([]); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [form,setForm]=useState({kind:'update' as Communication['kind'],author:'',summary:'',evidence:'',next:'',question:'',workerInstanceId:'',runId:''});
 const refresh=useCallback(async()=>{try{const r=await fetch(`/api/task-communications?taskId=${encodeURIComponent(taskId)}`,{cache:'no-store'});const d=await r.json() as Communication[]|{error?:string};if(!r.ok)throw Error((d as {error?:string}).error||'Could not load communication thread.');setItems(d as Communication[]);setError('')}catch(e){setError((e as Error).message)}},[taskId]);
 useEffect(()=>{void refresh();const t=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh()},3000);return()=>clearInterval(t)},[refresh]);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const r=await fetch('/api/task-communications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({taskId,kind:form.kind,author:form.author,workerId:form.workerInstanceId||undefined,runId:form.runId||undefined,payload:{summary:form.summary,evidence:form.evidence,next:form.next,question:form.question,workerInstanceId:form.workerInstanceId,runId:form.runId}})});const d=await r.json() as {error?:string};if(!r.ok)throw Error(d.error||'Could not save communication.');setForm({...form,summary:'',evidence:'',next:'',question:''});await refresh()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function status(id:number,nextStatus:Communication['status']){const r=await fetch('/api/task-communications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status:nextStatus})});if(r.ok)await refresh();}
 return <section className="communication-thread"><div className="communication-head"><h3>Worker communication</h3><span>{items.filter(i=>i.status==='open').length} open</span></div><p className="communication-hint">Short structured handoffs keep the next worker moving without searching the whole repository.</p>{error&&<p role="alert" className="board-error">{error}</p>}<div className="communication-list">{items.length?items.map(item=><article className={`communication-item ${item.kind}`} key={item.id}><div className="communication-meta"><strong>{item.kind==='help'?'Help request':item.kind==='review'?'Review request':'Update'}</strong><span>{item.author} · {new Date(item.createdAt).toLocaleString()}</span><b>{item.status}</b></div><p>{item.payload.summary}</p>{item.payload.evidence&&<small><strong>Evidence:</strong> {item.payload.evidence}</small>}{item.payload.next&&<small><strong>Next:</strong> {item.payload.next}</small>}{item.payload.question&&<small><strong>Question:</strong> {item.payload.question}</small>} {(item.status==='open'||item.status==='needs-clarification')&&<div className="communication-actions"><button type="button" onClick={()=>void status(item.id,'seen')}>Mark seen</button><button type="button" onClick={()=>void status(item.id,item.kind==='help'?'needs-clarification':'accepted')}>{item.kind==='help'?'Needs clarification':'Accept handoff'}</button></div>}</article>):<p className="column-empty">No handoffs yet. Add the first update or request help.</p>}</div><form className="communication-form" onSubmit={submit}><div className="communication-form-row"><select aria-label="Communication type" value={form.kind} onChange={e=>setForm({...form,kind:e.target.value as Communication['kind']})}><option value="update">Update</option><option value="help">Request help</option><option value="review">Request review</option></select><input aria-label="Communication author" placeholder="Your name or worker" required maxLength={120} value={form.author} onChange={e=>setForm({...form,author:e.target.value})}/><input aria-label="Worker instance ID" placeholder="Worker instance ID (optional)" maxLength={120} value={form.workerInstanceId} onChange={e=>setForm({...form,workerInstanceId:e.target.value})}/></div><input aria-label="Summary" placeholder="Summary — what changed?" required maxLength={2000} value={form.summary} onChange={e=>setForm({...form,summary:e.target.value})}/><div className="communication-form-row"><input aria-label="Evidence" placeholder="Evidence: tests, files, run IDs" maxLength={4000} value={form.evidence} onChange={e=>setForm({...form,evidence:e.target.value})}/><input aria-label="Next step" placeholder="Next step" maxLength={2000} value={form.next} onChange={e=>setForm({...form,next:e.target.value})}/></div>{(form.kind==='help'||form.kind==='review')&&<input aria-label="Question" placeholder="Question or review focus" maxLength={2000} value={form.question} onChange={e=>setForm({...form,question:e.target.value})}/>}<button className="task-save" disabled={busy}>{busy?'Saving…':'Post to thread'}</button></form></section>;
}

export default function Kanban() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const dirty=useRef(new Set<string>()), request=useRef<AbortController|null>(null), sequence=useRef(0), savingRef=useRef(false);
  const [lastFetch,setLastFetch]=useState(''), [refreshError,setRefreshError]=useState(''), [now,setNow]=useState(Date.now());
  const [logDrafts,setLogDrafts]=useState<Record<string,{author:string;body:string}>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState({ title: '', description: '', assignee: 'Unassigned', project: 'General' });
  const [staffNames, setStaffNames] = useState<string[]>([]);
  const [staffState, setStaffState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saving, setSaving] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [projectEdits, setProjectEdits] = useState<Record<string, string>>({});
  const projects = [...new Set(tasks.map(task => task.project))].sort((a, b) => a.localeCompare(b));
  const visibleTasks = projectFilter ? tasks.filter(task => task.project === projectFilter) : tasks;

  async function save(task: Task, action: { recordDelivery?: boolean; reviewedReturn?: boolean; confirmMetricsHistory?: boolean } = {}) {
    if (savingRef.current) return false;
    if (!task.project.trim()) { setError('Project must not be blank.'); return false; }
    savingRef.current=true; sequence.current++; request.current?.abort(); request.current=null; setSaving(task.id); setError('');
    try {
      const response = await fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...task, necessaryQuestions: task.necessaryQuestions ?? undefined, avoidableQuestions: task.avoidableQuestions ?? undefined, ...action }) });
      if (!response.ok) throw new Error((await response.json() as { error?: string }).error || 'Could not save task.');
      const saved = await response.json() as Task & { reviewSyncWarning?: string };
      if (saved.reviewSyncWarning) setError(saved.reviewSyncWarning);
      dirty.current.delete(saved.id); setTasks(current => [saved, ...current.filter(item => item.id !== saved.id)]);
      setProjectEdits(current => { const next = { ...current }; delete next[saved.id]; return next; });
      setNotice('Task saved'); window.setTimeout(() => setNotice(''), 2200);
      return true;
    } catch (e) { setError((e as Error).message); return false; }
    finally { savingRef.current=false; setSaving(''); }
  }

  useEffect(() => {
    fetch('/api/staff').then(async response => {
      if (!response.ok) throw new Error('Could not load staff.');
      const profiles = await response.json() as { name: string; status: string }[];
      setStaffNames([...new Set(profiles.filter(profile => profile.status === 'Active').map(profile => profile.name))].sort());
      setStaffState('ready');
    }).catch(() => setStaffState('error'));
  }, []);

  const refresh=useCallback(async()=>{
    if(document.visibilityState!=='visible' || request.current || savingRef.current)return;
    const controller=new AbortController(); request.current=controller; const id=++sequence.current;
    try {const response=await fetch('/api/tasks',{signal:controller.signal,cache:'no-store'});if(!response.ok)throw Error('Could not refresh the shared board.');const loaded=await response.json() as Task[];if(id===sequence.current){setTasks(current=>mergeBoard(loaded,current,dirty.current));setLastFetch(new Date().toISOString());setRefreshError('');setLoading(false)}} catch(e){if(!controller.signal.aborted){setRefreshError((e as Error).message);setLoading(false)}}finally{if(request.current===controller)request.current=null}
  },[]);
  useEffect(()=>{void refresh();const timer=window.setInterval(()=>{setNow(Date.now());void refresh()},3000);const focus=()=>{if(document.visibilityState==='visible')void refresh()};window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);return()=>{clearInterval(timer);sequence.current++;request.current?.abort();request.current=null;window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus)}},[refresh]);

  function update(id: string, field: keyof Task, value: string | number) {
    dirty.current.add(id); setTasks(current => current.map(task => task.id === id ? { ...task, [field]: value } : task));
  }

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const duration = (ms?: number | null) => ms == null ? '—' : `${(ms / 3600000).toFixed(2)} h`;

  return <div className="board-shell board-layout">
    <aside className="board-sidebar">
      <a className="brand" href="/"><span className="brandmark">s</span>staffing<span className="dot">.</span></a>
      <div className="workspace"><div className="workspace-icon">AI</div><div>Team workspace<small>Shared workspace</small></div></div>
      <div className="navtitle">WORKSPACE</div><a className="nav" href="/overview"><KanbanSquare size={18}/> Overview</a>
      <a className="nav" href="/"><Users size={18}/> Staff directory</a>
      <a className="nav active" href="/kanban" aria-current="page"><KanbanSquare size={18}/> Kanban board</a><a className="nav" href="/discussion"><MessageCircle size={18}/> Agent discussion</a><a className="nav" href="/reviews"><KanbanSquare size={18}/> Reviews</a>
      <div className="sidebottom"><Sparkles size={19}/><strong>A team that grows with you.</strong><p>Plan assignments, make progress visible, and keep blockers from stalling the work.</p><div className="private"><CircleDot size={12}/> Shared workspace</div></div>
    </aside>
    <main className="board-main">
      <header className="board-header"><span>Workspace <span className="slash">/</span> <b>Kanban board</b></span><div className="avatar">AP</div></header>
      <div className="board-eyebrow">STAFFING WORKSPACE / TASKS</div>
      <p className="board-footnote">{!lastFetch ? 'Connecting…' : now-Date.parse(lastFetch)>15000 ? 'Updates stale' : 'Live updates'} · Last successful refresh: {lastFetch ? new Date(lastFetch).toLocaleString() : 'never'}{refreshError && ` · ${refreshError}`}</p><div className="board-title"><div><h1>Kanban board</h1><p>Track assignments, surface blockers, and keep work moving.</p></div><span className="board-count">{visibleTasks.length} {visibleTasks.length === 1 ? 'task' : 'tasks'}</span></div>
      <form className="task-create" onSubmit={e => { e.preventDefault(); if (!draft.title.trim()) return; void save({ ...draft, id: crypto.randomUUID(), status: 'Backlog', blocker: '' }).then(saved => { if (saved) setDraft({ title: '', description: '', assignee: 'Unassigned', project: 'General' }); }); }}>
        <fieldset disabled={!!saving} style={{border:0,padding:0,margin:0,minWidth:0}}><div className="create-label">ADD A TASK</div><input aria-label="Task title" placeholder="What needs to get done?" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} required maxLength={160}/>
        <datalist id="board-projects">{projects.map(project => <option key={project} value={project}/>)}</datalist><div className="create-row"><input aria-label="Project" list="board-projects" placeholder="Project" required maxLength={120} value={draft.project} onChange={e => setDraft({ ...draft, project: e.target.value })}/><input aria-label="Task description" placeholder="Add a short description (optional)" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} maxLength={4000}/><select aria-label="Assign to" disabled={staffState !== 'ready'} value={draft.assignee} onChange={e => setDraft({ ...draft, assignee: e.target.value })}><option>Unassigned</option>{staffNames.map(name => <option key={name}>{name}</option>)}</select><button className="board-primary" disabled={!!saving}><Plus size={16}/> Add task</button></div></fieldset>
      </form>
      {staffState === 'loading' && <p role="status">Loading available staff…</p>}
      {staffState === 'error' && <p role="alert" className="board-error">Could not load staff. Assignment controls are disabled; reload the board to retry.</p>}
      {error && <div role="alert" className="board-error">{error}</div>}
      <label className="project-filter">Project<select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}><option value="">All projects</option>{projects.map(project => <option key={project} value={project}>{project}</option>)}{projectFilter && !projects.includes(projectFilter) && <option value={projectFilter}>{projectFilter}</option>}</select></label>
      {loading ? <div className="board-loading">Loading shared tasks…</div> : <div className="kanban-columns">{columns.map(column => {
        const items = visibleTasks.filter(task => task.status === column);
        return <section className="kanban-column" key={column}><div className="column-head"><h2>{column}</h2><span>{items.length}</span></div>
          {items.map(task => <article className="task-card" key={task.id}><details open={!!expanded[task.id]} onToggle={e => { if (e.target !== e.currentTarget) return; const open = e.currentTarget.open; setExpanded(current => ({ ...current, [task.id]: open })); }}><summary className="task-summary"><span>{task.title}</span><span>{task.assignee || 'Unassigned'}</span></summary><div className="task-details"><fieldset disabled={saving===task.id} style={{border:0,padding:0,margin:0,minWidth:0}}><p>Task ID: {task.id}<br/>Last updated: {task.updatedAt ? new Date(task.updatedAt).toLocaleString() : '—'}</p><input className="task-title" aria-label="Task title" value={task.title} onChange={e => update(task.id, 'title', e.target.value)} maxLength={160}/><textarea aria-label="Task description" placeholder="Description" value={task.description} onChange={e => update(task.id, 'description', e.target.value)} rows={2}/><label>PROJECT<input list="board-projects" maxLength={120} value={projectEdits[task.id] ?? task.project} onChange={e => { const value = e.currentTarget.value; dirty.current.add(task.id); setProjectEdits(current => ({ ...current, [task.id]: value })); }}/></label><label>ASSIGNEE<select disabled={staffState !== 'ready'} value={task.assignee || 'Unassigned'} onChange={e => update(task.id, 'assignee', e.target.value)}><option>Unassigned</option>{task.assignee && task.assignee !== 'Unassigned' && !staffNames.includes(task.assignee) && <option value={task.assignee}>{task.assignee} (unavailable)</option>}{staffNames.map(name => <option key={name}>{name}</option>)}</select></label><label>STATUS<select value={task.status} onChange={e => update(task.id, 'status', e.target.value)}>{columns.map(value => <option key={value}>{value}</option>)}</select></label><label className="blocker-label">{task.status === 'In Progress' || task.status === 'Blocked' ? 'BLOCKER / NEXT STEP' : 'BLOCKER NOTES'}<textarea placeholder="No blocker? Add the next step or leave blank." value={task.blocker} onChange={e => update(task.id, 'blocker', e.target.value)} rows={2}/></label><details className="task-metrics"><summary>Performance metrics</summary>
          <div className="metric-content"><p>Started: {task.startedAt ? new Date(task.startedAt).toLocaleString() : '—'}<br/>First delivery: {task.firstDeliveredAt ? new Date(task.firstDeliveredAt).toLocaleString() : '—'}<br/>Accepted: {task.acceptedAt ? new Date(task.acceptedAt).toLocaleString() : '—'}</p>
          <p>Start to first delivery: {duration(task.timeToFirstDeliveryMs)}<br/>Start to acceptance: {duration(task.timeToAcceptanceMs)}<br/>Rework rounds: {task.metricsHistoryReviewed ? task.reworkRounds : 'Unknown'}</p>
          {!task.metricsHistoryReviewed && <><p>Question and rework history: Unknown. Unverified stored counts: {task.unverifiedStoredCounts?.necessaryQuestions ?? '—'} necessary, {task.unverifiedStoredCounts?.avoidableQuestions ?? '—'} avoidable, {task.unverifiedStoredCounts?.reworkRounds ?? '—'} rework. Confirm only if these reflect the full task history.</p><button type="button" className="task-save" disabled={!!saving} onClick={() => void save({ ...task, project: projectEdits[task.id] ?? task.project }, { confirmMetricsHistory: true })}>Confirm stored counts and save</button></>}
          {task.metricsHistoryReviewed && <><label>NECESSARY QUESTIONS<input type="number" min="0" max="1000000" step="1" value={task.necessaryQuestions ?? 0} onChange={e => update(task.id, 'necessaryQuestions', e.target.value === '' ? -1 : Number(e.target.value))}/></label>
          <label>AVOIDABLE QUESTIONS<input type="number" min="0" max="1000000" step="1" value={task.avoidableQuestions ?? 0} onChange={e => update(task.id, 'avoidableQuestions', e.target.value === '' ? -1 : Number(e.target.value))}/></label></>}
          {task.configSnapshot ? <p>Dispatch: {task.configSnapshot.workerId}<br/>{task.configSnapshot.preferredModel ?? 'Model unavailable'} / {task.configSnapshot.reasoningEffort ?? 'effort unavailable'}<br/>Profile revision: {task.configSnapshot.profileRevision}<br/>Memory revision: {task.configSnapshot.memoryRevision ?? 'unavailable'}</p> : <p>Dispatch configuration unavailable.</p>}
          {!task.firstDeliveredAt && <button type="button" className="task-save" disabled={!!saving} onClick={() => void save({ ...task, project: projectEdits[task.id] ?? task.project }, { recordDelivery: true })}>Record first delivery and save</button>}
          {task.firstDeliveredAt && task.status === 'Ready' && <label className="reviewed-return"><input type="checkbox" checked={!!reviewed[task.id]} onChange={e => setReviewed({ ...reviewed, [task.id]: e.target.checked })}/> Reviewed work returned to Ready (adds one rework round on save)</label>}
          </div></details><button className="task-save" onClick={() => { void save({ ...task, project: projectEdits[task.id] ?? task.project }, { reviewedReturn: !!reviewed[task.id] }).then(ok=>{if(ok)setReviewed(current=>({...current,[task.id]:false}))}); }} disabled={!!saving}><Save size={14}/>{saving === task.id ? 'Saving…' : 'Save task'}</button></fieldset>{expanded[task.id] && <><CommunicationThread taskId={task.id}/><WorkLog taskId={task.id} draft={logDrafts[task.id] || {author:'',body:''}} setDraft={value=>setLogDrafts(current=>({...current,[task.id]:value}))}/></>}</div></details></article>)}
          {!items.length && <div className="column-empty">{projectFilter ? 'No tasks in this project' : 'No tasks yet'}</div>}
        </section>;
      })}</div>}
      <div className="board-footnote">Keep In Progress tasks moving: record a clear next step, and move work to Blocked with the reason when it cannot proceed.</div>
    </main>
    {notice && <div className="board-notice" role="status">{notice}</div>}
  </div>;
}
