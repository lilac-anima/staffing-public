export type Entry={id:number;author:string;body:string;createdAt:string};
export type LogState={entries:Entry[];next:number|null;busy:boolean;error:string};
/** Serializes reads and append, preserving all loaded pages and ignoring responses after disposal. */
export class LiveWorkLog {
 private controller:AbortController|null=null; private disposed=false; private locked=false;
 state:LogState={entries:[],next:null,busy:false,error:''};
 constructor(private taskId:string, private publish:(s:LogState)=>void, private fetcher:typeof fetch=fetch){}
 private emit(){if(!this.disposed)this.publish({...this.state,entries:[...this.state.entries]});}
 private async read(){const after=this.state.entries.at(-1)?.id ?? 0;const r=await this.fetcher(`/api/task-log?taskId=${encodeURIComponent(this.taskId)}&after=${after}`,{signal:this.controller!.signal,cache:'no-store'});const data=await r.json() as {entries:Entry[];nextAfter:number|null;error?:string};if(!r.ok)throw Error(data.error||'Could not load the work log.');if(this.disposed)return;const ids=new Set(this.state.entries.map(x=>x.id));this.state.entries.push(...data.entries.filter(x=>!ids.has(x.id)));this.state.next=data.nextAfter;}
 async refresh(more=false){if(this.locked||this.disposed||(!more&&this.state.next!==null))return;this.locked=true;this.controller=new AbortController();this.state.busy=true;this.emit();try{await this.read();if(!this.disposed)this.state.error=''}catch(e){if(!this.disposed&&!this.controller.signal.aborted)this.state.error=(e as Error).message}finally{this.locked=false;this.controller=null;this.state.busy=false;this.emit()}}
 async append(author:string,body:string){if(this.locked||this.disposed)return false;this.locked=true;this.controller=new AbortController();this.state.busy=true;this.state.error='';this.emit();let saved=false;try{const r=await this.fetcher('/api/task-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({taskId:this.taskId,author,body}),signal:this.controller.signal});const data=await r.json() as {error?:string};if(!r.ok)throw Error(data.error||'Could not append the work log.');saved=true;if(!this.disposed&&this.state.next===null)await this.read()}catch(e){if(!this.disposed&&!this.controller.signal.aborted)this.state.error=(e as Error).message}finally{this.locked=false;this.controller=null;this.state.busy=false;this.emit()}return saved&&!this.disposed}
 dispose(){this.disposed=true;this.controller?.abort()}
}
