import { z } from 'zod';
export const DEFAULT_WORKER_LIMIT = 8;
export const INVENTORY_MAX_AGE_MS = 120_000;
export const SLOT_LEASE_MS = 60_000;
export const NATIVE_LEASE_MS = 300_000;
const id = z.string().trim().min(1).max(160);
const timestamp = z.string().datetime();
const binding = {instanceId:id, label:id, profileId:id.nullable(), taskIds:z.array(id).max(100), chatId:id.nullable(), agentId:id.nullable(), runId:id.nullable()};
const slotSchema = z.object({...binding, kind:z.enum(['native','measured']), state:z.enum(['reserved','active']), leaseUntil:timestamp, capabilityHash:z.string().min(1).nullable()}).strict();
const capacityChangeSchema=z.object({changeId:z.string().uuid(),changedAt:timestamp,requestedLimit:z.number().int().min(1).max(24),noticedAt:timestamp.nullable(),appliedAt:timestamp.nullable(),overflowChatIds:z.array(id).max(5).optional()}).strict();
export const deploymentStateSchema = z.object({limit:z.number().int().min(1).max(24),inventoryAt:timestamp.nullable(),slots:z.array(slotSchema).max(96),capacityChange:capacityChangeSchema.optional()}).strict().superRefine((v,c)=>{if(new Set(v.slots.map(s=>s.instanceId)).size!==v.slots.length)c.addIssue({code:'custom',message:'Duplicate reservation identity'});});
export type DeploymentState = z.infer<typeof deploymentStateSchema>;
export type DeploymentRecord = {revision:string;data:string;updatedAt:string};
export type DeploymentStore = {read:()=>Promise<DeploymentRecord|null>;compareAndSwap:(revision:string|null,next:DeploymentRecord)=>Promise<boolean>};
export class CapacityError extends Error {constructor(message:string,public status=409){super(message)}}
export const emptyDeploymentState=():DeploymentState=>({limit:DEFAULT_WORKER_LIMIT,inventoryAt:null,slots:[]});
export const desiredOverflowChats=(limit:number)=>Math.max(0,Math.ceil(limit/4)-1);
export function decodeDeployment(record:DeploymentRecord|null):DeploymentState {return record ? deploymentStateSchema.parse(JSON.parse(record.data)) : emptyDeploymentState();}
export function deploymentView(record:DeploymentRecord|null,now=Date.now()) {
 const state=decodeDeployment(record), inventoryFresh=!!state.inventoryAt && Date.parse(state.inventoryAt)<=now && now-Date.parse(state.inventoryAt)<=INVENTORY_MAX_AGE_MS;
 const slots=state.slots.map(({capabilityHash,...slot})=>({...slot,fresh:Date.parse(slot.leaseUntil)>now}));
 const unknown=slots.filter(s=>!s.fresh).length;
 return {capacityChange:state.capacityChange??null,limit:state.limit,revision:record?.revision??null,updatedAt:record?.updatedAt??null,desiredOverflowChats:desiredOverflowChats(state.limit),occupied:slots.length,available:inventoryFresh&&unknown===0?Math.max(0,state.limit-slots.length):0,unknown,inventoryAt:state.inventoryAt,inventoryFresh,draining:slots.length>state.limit,slots,enforcement:'Shared admission ledger; native Codex tools require PM participation. This is not a host-enforced tool limit.'};
}
export async function saveWorkerLimit(store:DeploymentStore,limit:number,expectedRevision:string|null,now=Date.now()) {
 if(!Number.isInteger(limit)||limit<1||limit>24)throw new CapacityError('Worker limit must be a whole number from 1 to 24.',400);
 const current=await store.read();if((current?.revision??null)!==expectedRevision)throw new CapacityError('The setting changed elsewhere. Refresh and review the saved limit.');
 const state=decodeDeployment(current),changedAt=new Date(now).toISOString();
 const capacityChange=state.limit===limit&&state.capacityChange?state.capacityChange:{changeId:crypto.randomUUID(),changedAt,requestedLimit:limit,noticedAt:null,appliedAt:null};
 const next={revision:crypto.randomUUID(),data:JSON.stringify({...state,limit,capacityChange}),updatedAt:changedAt};
 if(!await store.compareAndSwap(expectedRevision,next))throw new CapacityError('The setting changed elsewhere. Refresh and review the saved limit.');return next;
}
const worker = z.object(binding).strict();
export const ledgerCommandSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('ack-capacity-change'),changeId:z.string().uuid(),requestedLimit:z.number().int().min(1).max(24),stage:z.enum(['noticed','applied']),overflowChatIds:z.array(id).max(5).optional()}).strict(),
 z.object({action:z.literal('reconcile'),nativeWorkers:z.array(worker).max(96),confirmedStoppedIds:z.array(id).max(96),completeInventory:z.literal(true)}).strict(),
 z.object({action:z.literal('reserve'),...binding,kind:z.enum(['native','measured']),capability:z.string().min(32).max(128)}).strict(),
 z.object({action:z.enum(['activate','heartbeat','release']),instanceId:id,capability:z.string().min(32).max(128).optional(),confirmedStopped:z.boolean().optional()}).strict(),
]);
export type LedgerCommand=z.infer<typeof ledgerCommandSchema>;
export async function hashCapability(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
export async function applyLedgerCommand(state:DeploymentState,command:LedgerCommand,dispatcher:boolean,now=Date.now()):Promise<DeploymentState> {
 const next=structuredClone(state),iso=new Date(now).toISOString(),lease=new Date(now+SLOT_LEASE_MS).toISOString();
 if(command.action==='ack-capacity-change') {
  if(!dispatcher)throw new CapacityError('Dispatcher authorization required.',403);
  const change=next.capacityChange;
  if(!change||change.changeId!==command.changeId||change.requestedLimit!==command.requestedLimit||next.limit!==command.requestedLimit)throw new CapacityError('Capacity request changed. Read and acknowledge the current request.');
  if(command.stage==='applied'&&!change.appliedAt){
   const chats=command.overflowChatIds??[];
   if(new Set(chats).size!==chats.length||chats.length!==desiredOverflowChats(next.limit))throw new CapacityError('Confirm the distinct ready overflow chat IDs for this requested limit.',400);
   change.overflowChatIds=chats;change.appliedAt=iso;
  }
  change.noticedAt??=iso;
 } else if(command.action==='reconcile') {
  if(!dispatcher)throw new CapacityError('Dispatcher authorization required.',403);
  const supplied=new Set(command.nativeWorkers.map(w=>w.instanceId)),stopped=new Set(command.confirmedStoppedIds);
  if(supplied.size!==command.nativeWorkers.length||command.nativeWorkers.some(w=>stopped.has(w.instanceId)))throw new CapacityError('Worker identities must be unique and cannot also be stopped.',400);
  if(next.slots.some(s=>s.kind==='native'&&s.state==='active'&&!supplied.has(s.instanceId)&&!stopped.has(s.instanceId)))throw new CapacityError('Account for every existing native slot; omissions do not prove a worker stopped.');
  if(next.slots.some(s=>s.kind==='measured'&&(supplied.has(s.instanceId)||stopped.has(s.instanceId))))throw new CapacityError('Reconcile only native workers; release measured slots separately after confirmed exit.');
  const previous=new Map(next.slots.map(s=>[s.instanceId,s]));
  next.slots=next.slots.filter(s=>s.kind==='measured'||(s.state==='reserved'&&!supplied.has(s.instanceId)&&!stopped.has(s.instanceId)));
  next.slots.push(...command.nativeWorkers.map(w=>({...w,kind:'native' as const,state:previous.get(w.instanceId)?.state??'active' as const,leaseUntil:previous.get(w.instanceId)?.state==='reserved'?previous.get(w.instanceId)!.leaseUntil:new Date(now+NATIVE_LEASE_MS).toISOString(),capabilityHash:previous.get(w.instanceId)?.capabilityHash??null})));
  next.inventoryAt=iso;
 } else if(command.action==='reserve') {
  if(!dispatcher)throw new CapacityError('Dispatcher authorization required.',403);
  const hash=await hashCapability(command.capability),old=next.slots.find(s=>s.instanceId===command.instanceId);
  if(old){if(old.capabilityHash!==hash||JSON.stringify(Object.fromEntries(Object.keys(binding).map(k=>[k,(old as Record<string,unknown>)[k]])))!==JSON.stringify(Object.fromEntries(Object.keys(binding).map(k=>[k,(command as Record<string,unknown>)[k]])))||old.kind!==command.kind)throw new CapacityError('Reservation identity is already in use.');if(Date.parse(old.leaseUntil)<=now)throw new CapacityError('Reservation is stale; reconcile its execution before reuse.');return next;}
  const view=deploymentView({revision:'check',data:JSON.stringify(next),updatedAt:iso},now);
  if(!view.inventoryFresh||view.unknown)throw new CapacityError('Execution inventory is stale or unknown. Reconcile all workers before dispatch.');
  if(view.occupied>=next.limit)throw new CapacityError('Worker limit reached. Drain existing work before dispatch.');
  next.slots.push({...worker.parse(Object.fromEntries(Object.keys(binding).map(k=>[k,(command as Record<string,unknown>)[k]]))),kind:command.kind,state:'reserved',leaseUntil:command.kind==='native'?new Date(now+NATIVE_LEASE_MS).toISOString():lease,capabilityHash:hash});
 } else {
  const slot=next.slots.find(s=>s.instanceId===command.instanceId);if(!slot)throw new CapacityError('Reservation not found.',404);
  const authorized=dispatcher || (!!command.capability&&slot.capabilityHash===await hashCapability(command.capability));
  if(!authorized)throw new CapacityError('Reservation capability required.',403);
  if(command.action==='release') {if(command.confirmedStopped!==true)throw new CapacityError('Confirm process exit or cancelled dispatch before releasing capacity.',400);next.slots=next.slots.filter(s=>s.instanceId!==slot.instanceId);}
  else {if(command.action==='activate'&&next.slots.length>next.limit)throw new CapacityError('Limit was lowered; cancel this pending dispatch and drain existing work.');if(command.action==='activate'&&Date.parse(slot.leaseUntil)<=now)throw new CapacityError('Reservation is stale; confirm execution before reconciling.');if(command.action==='heartbeat'&&slot.state!=='active')throw new CapacityError('Activate the reservation before heartbeat.');slot.state='active';slot.leaseUntil=slot.kind==='native'?new Date(now+NATIVE_LEASE_MS).toISOString():lease;}
 }
 return deploymentStateSchema.parse(next);
}
export async function mutateDeploymentLedger(store:DeploymentStore,command:LedgerCommand,dispatcher:boolean,now=Date.now()) {
 for(let i=0;i<8;i++){const current=await store.read(),state=await applyLedgerCommand(decodeDeployment(current),command,dispatcher,now);const next={revision:crypto.randomUUID(),data:JSON.stringify(state),updatedAt:new Date(now).toISOString()};if(await store.compareAndSwap(current?.revision??null,next))return next;}
 throw new CapacityError('Deployment ledger changed concurrently. Retry with the same reservation identity.');
}
