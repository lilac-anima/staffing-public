import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const code = ts.transpileModule(fs.readFileSync(new URL('../lib/review-metrics.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const resolved=code.replace("from 'diff'", `from ${JSON.stringify(pathToFileURL(require.resolve('diff')).href)}`);
const { summarizeEvidence, uncoveredTasks, characterDifferences, changedPassages } = await import('data:text/javascript;base64,' + Buffer.from(resolved).toString('base64')); 
const base = { id:'one',title:'One',assignee:'Hacker',status:'Done',startedAt:'2026-11-08T00:00:00Z',acceptedAt:'2026-11-08T00:01:00Z',firstDeliveredAt:null,necessaryQuestions:0,avoidableQuestions:0,reworkRounds:0,metricsHistoryReviewed:false };
test('unverified historical defaults remain unknown; backfill timing is not averaged',()=>{const s=summarizeEvidence([base]); assert.equal(s.necessary.known,0);assert.equal(s.meanAcceptanceMs,null);assert.equal(s.timed,0);});
test('known zero and partially missing evidence remain distinguishable',()=>{const s=summarizeEvidence([base,{...base,id:'two',metricsHistoryReviewed:true,avoidableQuestions:2}]);assert.deepEqual(s.necessary,{total:0,known:1});assert.deepEqual(s.avoidable,{total:2,known:1});assert.equal(s.accepted,2);});
test('eligibility excludes covered tasks, other workers and unaccepted deliveries',()=>{const rows=[base,{...base,id:'two'},{...base,id:'three',status:'In Progress'},{...base,id:'four',assignee:'Writer'}];assert.deepEqual(uncoveredTasks(rows,'Hacker',['one']).map(t=>t.id),['two']);});
test('character comparison includes memory, model, absent fields and nested content, excluding identity labels',()=>{const d=characterDifferences({id:'a',name:'A',memory:'old',preferredModel:'M1',tools:['a']},{id:'b',name:'B',memory:'new',preferredModel:'M2',tools:['a'],objectives:'clear'});assert.deepEqual(d.map(x=>x.key),['memory','preferredModel','objectives']);});

test('changed passages omit shared charter and preserve separated additions and deletions',()=>{ const a='Shared introduction. First old phrase. Middle remains. Second old phrase. Shared ending.'; const b='Shared introduction. First new phrase. Middle remains. Second new phrase. Shared ending. Added clause.'; const d=changedPassages(a,b); assert(d.some(x=>x.kind==='removed'&&x.text.includes('old'))); assert(d.some(x=>x.kind==='added'&&x.text.includes('new'))); assert(d.some(x=>x.kind==='added'&&x.text.includes('Added clause'))); assert(!d.some(x=>x.text.includes('Shared introduction')||x.text.includes('Middle remains'))); assert.deepEqual(changedPassages('Common charter.','Common charter.\n\nApproved appended clause.').map(x=>x.kind),['added']); });
