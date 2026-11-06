import assert from 'node:assert/strict';
import {footballSource} from '../worker/backend.js';
const event=(id,options={})=>({id,sport:'football',live:null,home:{name:'Home'},away:{name:'Away'},startsAt:'2026-11-10T18:00:00Z',league:{name:'Test'},markets:[{name:'Resultado final',outcomes:[{key:'home',odds:2},{key:'draw',odds:3},{key:'away',odds:4}],...options}]});
const original=globalThis.fetch;const calls=[];
globalThis.fetch=async url=>{calls.push(String(url));return Response.json({events:[event('active'),event('suspended',{suspended:true}),event('invalid',{outcomes:[{key:'home',odds:0},{key:'draw',odds:3},{key:'away',odds:4}]})],tiles:{league:null}})};
try{const data=await footballSource('https://futamina.com');assert.equal(data.games.length,1);assert.equal(data.suspended,1);assert.deepEqual(data.games[0].odds,[2,3,4]);assert.equal(data.games[0].url,'https://futamina.com/esportes?jogo=active');assert.ok(calls.every(url=>url.startsWith('https://futamina.com/')));console.log('Verified Futamina source URLs, market suspension, invalid price exclusion and duplicate event handling.')}finally{globalThis.fetch=original}
