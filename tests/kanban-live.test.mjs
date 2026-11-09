import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync(new URL('../lib/kanban-live.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {mergeBoard}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('refresh updates untouched tasks while retaining edit and original revision',()=>{const local=[{id:'a',title:'draft',updatedAt:'old'},{id:'b',title:'old',updatedAt:'old'}];const incoming=[{id:'a',title:'remote',updatedAt:'new'},{id:'b',title:'new',updatedAt:'new'}];assert.deepEqual(mergeBoard(incoming,local,new Set(['a'])),[local[0],incoming[1]]);});
test('a locally edited card remains visible if missing remotely',()=>{assert.equal(mergeBoard([],[{id:'a'}],new Set(['a'])).length,1)});
