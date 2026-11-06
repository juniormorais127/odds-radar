import assert from 'node:assert/strict';
import app from '../worker/index.js';
const original=globalThis.fetch;
globalThis.fetch=async url=>{
  url=String(url);
  if(url.includes('esportenet-bet.jogos.app'))return new Response('',{status:403});
  if(url.includes('girocerto.io'))return Response.json({events:[],tiles:{}});
  if(url.includes('melbet.com'))return Response.json({Success:true,Value:[]});
  return Response.json([]);
};
try{
 const response=await app.fetch(new Request('https://example.test/api/odds'));
 const d=await response.json(),source=d.sources.find(s=>s.key==='jogos');
 assert.equal(source.offline,true);assert.ok(source.count>100);assert.match(source.note,/403/);
 assert.ok(d.games.every(g=>g.books.jogos.offline&&g.books.jogos.at===source.at));
 assert.notEqual(source.at,d.at);
 console.log('Verified HTTP 403 fallback retains local timestamp and offline provenance.');
}finally{globalThis.fetch=original}
