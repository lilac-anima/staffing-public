#!/usr/bin/env node
// Import a captured codex exec --json stream for one explicitly identified attempt.
import { readFile } from 'node:fs/promises';
import {createUsageParser} from './worker-capture-parser.mjs';
const [file, taskId, id, elapsed, workerId, configSnapshot, endpoint='http://127.0.0.1:5173'] = process.argv.slice(2);
if (!file || !taskId || !id || !workerId || !configSnapshot || !/^\d+$/.test(elapsed || '')) throw new Error('Usage: node scripts/report-worker-run.mjs JSONL TASK_ID RUN_ID ELAPSED_MS WORKER_ID CONFIG_SNAPSHOT_JSON [BASE_URL]');
const content=await readFile(file,'utf8');const parser=createUsageParser();for(const line of content.split(/\r?\n/).filter(Boolean)){try{parser.event(JSON.parse(line))}catch{parser.malformed();}}const usage=parser.result(0,content.endsWith('\n'));if(!usage.complete)throw new Error('Incomplete or invalid usage stream; no run was reported.');
const data={id,taskId,workerId,configSnapshot,attributionScope:'unknown',runtimeBasis:'worker-run-elapsed',source:'codex exec --json turn.completed usage',scope:'One captured codex exec process; measured elapsed includes tool and network wait',...usage,elapsedMs:Number(elapsed),activeMs:null,wallMs:null,taskCoverageComplete:false,notes:'Coverage of all task attempts has not been attested. Verify timing and all attempts before confirming coverage.'};
const existingResponse=await fetch(`${endpoint}/api/worker-runs?taskId=${encodeURIComponent(taskId)}`); if (!existingResponse.ok) throw new Error('Could not read current runs'); const existing=await existingResponse.json(); const prior=existing.find(r=>r.id===id); if(prior) data.expectedRevision=prior.revision;
const r=await fetch(`${endpoint}/api/worker-runs`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); const result=await r.text(); if (!r.ok) throw new Error(result); console.log(result);
