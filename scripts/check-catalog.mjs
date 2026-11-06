import fs from 'node:fs';import vm from 'node:vm';import zlib from 'node:zlib';import assert from 'node:assert/strict';
const nodes=new Map();function $(id){if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',hidden:false,disabled:false});return nodes.get(id)}
const context=vm.createContext({$,fetch:()=>{},Blob,Response,DecompressionStream,TextDecoder,AbortController,Date,Number,JSON,console,setTimeout,clearTimeout,esc:s=>String(s??'').replaceAll('<','&lt;'),fmt:n=>String(n),date:t=>new Date(t).toISOString()});
vm.runInContext(fs.readFileSync('worker/catalog.js','utf8'),context);
const json=Buffer.from(JSON.stringify({events:[],sport:'Test'}));
for(const bytes of [json,zlib.gzipSync(json),zlib.gzipSync(zlib.gzipSync(json))])assert.equal((await context.catalogJson(new Response(bytes))).sport,'Test');
await assert.rejects(()=>context.catalogJson(new Response('broken')),/inválido/);
await assert.rejects(()=>context.catalogJson(new Response('error',{status:503})),/HTTP 503/);
let resolveOld;context.fetch=url=>url.includes('old')?new Promise(resolve=>resolveOld=resolve):Promise.resolve(Response.json({sport:'New',events:[]}));
$('catalogSport').value='old';const old=context.loadCatalogSport();$('catalogSport').value='new';await context.loadCatalogSport();resolveOld(Response.json({sport:'Old',events:[]}));await old;assert.equal(vm.runInContext('catalogData.sport',context),'New');
context.fixture={sport:'Test',events:[{source:'Casa',event:'Home x Away',league:'Liga',time:'2026-11-06T10:00Z',at:'bad date',markets:{Mercado:Array.from({length:101},(_,i)=>['Seleção '+i,2,false,null])}}]};
vm.runInContext('catalogData=fixture;catalogFilterSignature="";catalogPending=false;catalogPage=0;renderCatalog()',context);assert.match($('catalogPage').textContent,/Página 1 de 2/);assert.equal($('catalogPrevious').disabled,true);assert.equal($('catalogNext').disabled,false);
vm.runInContext('catalogPage=1;renderCatalog()',context);assert.match($('catalogPage').textContent,/Página 2 de 2/);assert.equal($('catalogNext').disabled,true);assert.match($('catalogRows').innerHTML,/Horário não informado/);
$('catalogQuery').value='Seleção 100';vm.runInContext('catalogPage=0;renderCatalog()',context);assert.match($('catalogPage').textContent,/1 cotações/);
$('catalogQuery').value='nothing';context.renderCatalog();assert.match($('catalogRows').innerHTML,/Nenhuma cotação/);assert.equal($('catalogNext').disabled,true);
let sports=0,quotes=0;for(const file of fs.readdirSync('worker/catalog-data').filter(f=>f.endsWith('.gz'))){const d=JSON.parse(zlib.gunzipSync(fs.readFileSync('worker/catalog-data/'+file)));assert.ok(Array.isArray(d.events));for(const e of d.events)for(const outs of Object.values(e.markets)){assert.ok(Array.isArray(outs));for(const o of outs){assert.ok(Array.isArray(o));assert.ok(Number.isFinite(o[1]));quotes++}}sports++}
assert.equal(sports,35);assert.equal(quotes,746678);
console.log('Verified plain/gzip/double-gzip JSON, invalid responses, request race, pagination, selection search, empty states and all 35 sport archives ('+quotes+' quotes).');
