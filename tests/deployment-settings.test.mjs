import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync(new URL('../lib/deployment-settings.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace("from 'zod'",`from ${JSON.stringify(import.meta.resolve('zod'))}`);
const {emptyDeploymentState,decodeDeployment,deploymentView,saveWorkerLimit,applyLedgerCommand,mutateDeploymentLedger,ledgerCommandSchema,desiredOverflowChats}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const now=Date.parse('2026-11-09T20:00:00Z'),capability='x'.repeat(48);
const native=(instanceId,extra={})=>({instanceId,label:instanceId,profileId:'hacker-v2',taskIds:['task-a','task-b'],chatId:'chat',agentId:instanceId,runId:null,...extra});
const reconcile=(nativeWorkers=[],confirmedStoppedIds=[])=>({action:'reconcile',nativeWorkers,confirmedStoppedIds,completeInventory:true});
const reserve=(instanceId,kind='measured')=>({action:'reserve',...native(instanceId,{runId:kind==='measured'?'run-'+instanceId:null}),kind,capability});
const memoryStore=()=>{let row=null;return {read:async()=>row&&structuredClone(row),compareAndSwap:async(expected,next)=>{if((row?.revision??null)!==expected)return false;row=structuredClone(next);return true}}};
const view=(state,time=now)=>deploymentView({revision:'r',data:JSON.stringify(state),updatedAt:new Date(now).toISOString()},time);
test('default only absent, integer bounds, authoritative CAS and overflow mapping',async()=>{
 const store=memoryStore();assert.equal(decodeDeployment(null).limit,8);assert.equal(deploymentView(null).available,0);
 for(const bad of [0,25,1.2,NaN,'8'])await assert.rejects(saveWorkerLimit(store,bad,null,now));
 const first=await saveWorkerLimit(store,24,null,now);assert.equal(decodeDeployment(first).limit,24);assert.equal(desiredOverflowChats(24),5);assert.equal(desiredOverflowChats(8),1);assert.equal(desiredOverflowChats(1),0);
 await assert.rejects(saveWorkerLimit(store,4,null,now));assert.throws(()=>decodeDeployment({...first,data:'{}'}));
 const results=await Promise.allSettled([saveWorkerLimit(store,1,first.revision,now),saveWorkerLimit(store,7,first.revision,now)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
});
test('all actual copies count; profile is not identity; concurrent reservations cannot exceed total limit',async()=>{
 const store=memoryStore();await saveWorkerLimit(store,4,null,now);await mutateDeploymentLedger(store,reconcile([native('root-pm'),native('overflow-primary'),native('subagent')]),true,now);
 const results=await Promise.allSettled([mutateDeploymentLedger(store,reserve('cli-one'),true,now),mutateDeploymentLedger(store,reserve('cli-two'),true,now)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const state=decodeDeployment(await store.read());assert.equal(state.slots.length,4);assert.equal(view(state).available,0);assert(state.slots.every(s=>s.profileId==='hacker-v2'));assert.equal(new Set(state.slots.map(s=>s.instanceId)).size,4);
});
test('unknown inventory and stale slots fail closed, never expire into free capacity',async()=>{
 await assert.rejects(applyLedgerCommand(emptyDeploymentState(),reserve('one'),true,now));let s=await applyLedgerCommand(emptyDeploymentState(),reconcile([native('root')]),true,now);s=await applyLedgerCommand(s,reserve('one'),true,now);
 assert.equal(view(s,now+60_001).unknown,1);assert.equal(view(s,now+60_001).occupied,2);await assert.rejects(applyLedgerCommand(s,reserve('two'),true,now+60_001));await assert.rejects(applyLedgerCommand(s,{action:'activate',instanceId:'one',capability},false,now+60_001));
 s=await applyLedgerCommand(s,{action:'release',instanceId:'one',capability,confirmedStopped:true},false,now+60_001);await assert.rejects(applyLedgerCommand(s,reserve('two'),true,now+120_001));assert.equal(view(s,now+120_001).available,0);
});
test('separate authority, opaque lifecycle capability, idempotence and no exposed secrets',async()=>{
 let s=await applyLedgerCommand(emptyDeploymentState(),reconcile([native('root')]),true,now);await assert.rejects(applyLedgerCommand(s,reserve('one'),false,now));s=await applyLedgerCommand(s,reserve('one'),true,now);s=await applyLedgerCommand(s,reserve('one'),true,now);assert.equal(s.slots.length,2);
 assert(!JSON.stringify(view(s)).includes('capability'));assert(!JSON.stringify(s).includes(capability));await assert.rejects(applyLedgerCommand(s,{action:'activate',instanceId:'one',capability:'y'.repeat(48)},false,now));
 s=await applyLedgerCommand(s,{action:'activate',instanceId:'one',capability},false,now);s=await applyLedgerCommand(s,{action:'heartbeat',instanceId:'one',capability},false,now+70_000);assert.equal(view(s,now+70_000).unknown,0);
 await assert.rejects(applyLedgerCommand(s,{action:'release',instanceId:'one',capability},false,now));assert(!ledgerCommandSchema.safeParse({...reserve('two'),role:'PM'}).success);
});
test('lowering drains, does not kill/release, and blocks both reservation and pending activation',async()=>{
 const store=memoryStore();let row=await mutateDeploymentLedger(store,reconcile([native('root'),native('primary')]),true,now);row=await mutateDeploymentLedger(store,reserve('one'),true,now);row=await saveWorkerLimit(store,1,row.revision,now);const state=decodeDeployment(row);assert.equal(state.slots.length,3);assert.equal(view(state).draining,true);await assert.rejects(applyLedgerCommand(state,reserve('two'),true,now));await assert.rejects(applyLedgerCommand(state,{action:'activate',instanceId:'one',capability},false,now));
});
test('native reconciliation preserves reservations/capabilities and requires explicit stop evidence',async()=>{
 let s=await applyLedgerCommand(emptyDeploymentState(),reconcile([native('root')]),true,now);s=await applyLedgerCommand(s,reserve('child','native'),true,now);
 s=await applyLedgerCommand(s,reconcile([native('root')]),true,now+1000);assert.equal(s.slots.length,2);assert.equal(s.slots.find(x=>x.instanceId==='child').state,'reserved');
 s=await applyLedgerCommand(s,reconcile([native('root'),native('child')]),true,now+2000);assert.equal(s.slots.find(x=>x.instanceId==='child').state,'reserved');s=await applyLedgerCommand(s,{action:'activate',instanceId:'child',capability},false,now+2000);
 await assert.rejects(applyLedgerCommand(s,reconcile([native('root')]),true,now+3000));s=await applyLedgerCommand(s,reconcile([native('root')],['child']),true,now+3000);assert.equal(s.slots.length,1);
});
test('reconciliation never revives expired unactivated native reservations',async()=>{
 let s=await applyLedgerCommand(emptyDeploymentState(),reconcile([native('root')]),true,now);s=await applyLedgerCommand(s,reserve('child','native'),true,now);const expiredAt=now+300_001;
 s=await applyLedgerCommand(s,reconcile([native('root'),native('child')]),true,expiredAt);assert.equal(view(s,expiredAt).unknown,1);await assert.rejects(applyLedgerCommand(s,{action:'activate',instanceId:'child',capability},false,expiredAt));
});
test('durable capacity changes bind acknowledgments exactly and preserve retry timestamps',async()=>{
 const store=memoryStore();let row=await saveWorkerLimit(store,12,null,now);const first=decodeDeployment(row).capacityChange;assert.equal(first.requestedLimit,12);assert.equal(first.noticedAt,null);
 const ack={action:'ack-capacity-change',changeId:first.changeId,requestedLimit:12,stage:'noticed'};
 await assert.rejects(mutateDeploymentLedger(store,ack,false,now+1));row=await mutateDeploymentLedger(store,ack,true,now+2);assert.equal(decodeDeployment(row).capacityChange.appliedAt,null);
 row=await mutateDeploymentLedger(store,{...ack,stage:'applied',overflowChatIds:['overflow-one','overflow-two']},true,now+3);row=await mutateDeploymentLedger(store,{...ack,stage:'applied',overflowChatIds:['overflow-one','overflow-two']},true,now+4);assert.equal(decodeDeployment(row).capacityChange.appliedAt,new Date(now+3).toISOString());assert.equal(decodeDeployment(row).capacityChange.noticedAt,new Date(now+2).toISOString());
 row=await saveWorkerLimit(store,12,row.revision,now+5);assert.equal(decodeDeployment(row).capacityChange.changeId,first.changeId);
 row=await mutateDeploymentLedger(store,reconcile([native('pm')]),true,now+6);assert.equal(decodeDeployment(row).capacityChange.changeId,first.changeId);
 row=await saveWorkerLimit(store,8,row.revision,now+7);assert.notEqual(decodeDeployment(row).capacityChange.changeId,first.changeId);await assert.rejects(mutateDeploymentLedger(store,ack,true,now+8));assert.equal(decodeDeployment(await store.read()).capacityChange.noticedAt,null);
 const current=decodeDeployment(row).capacityChange;await assert.rejects(mutateDeploymentLedger(store,{...ack,changeId:current.changeId},true,now+9));
});
test('CAS retry never acknowledges a newer capacity change and applied requires ready chats',async()=>{
 const base=memoryStore();let row=await saveWorkerLimit(base,12,null,now);const change=decodeDeployment(row).capacityChange;const ack={action:'ack-capacity-change',changeId:change.changeId,requestedLimit:12,stage:'applied'};
 await assert.rejects(mutateDeploymentLedger(base,ack,true,now+1));await assert.rejects(mutateDeploymentLedger(base,{...ack,overflowChatIds:['same','same']},true,now+1));
 let raced=false;const store={read:base.read,compareAndSwap:async(expected,next)=>{if(!raced){raced=true;await saveWorkerLimit(base,4,expected,now+2);return false;}return base.compareAndSwap(expected,next)}};
 await assert.rejects(mutateDeploymentLedger(store,{...ack,overflowChatIds:['one','two']},true,now+3));const state=decodeDeployment(await base.read());assert.equal(state.limit,4);assert.equal(state.capacityChange.noticedAt,null);assert.equal(state.capacityChange.appliedAt,null);
});
