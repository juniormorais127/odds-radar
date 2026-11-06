import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {matching,valid,parseJogosPage} from '../worker/backend.js';
assert.equal(matching({home:'AC Milan',away:'Ferencvarosi TC',time:'2026-11-05T17:45:00Z'},{home:'Milan',away:'Ferencvaros',time:'2026-11-05T17:45:00Z'}),true);
assert.equal(matching({home:'Milan',away:'Roma',time:'2026-11-05T17:45:00Z'},{home:'Roma',away:'Milan',time:'2026-11-05T17:45:00Z'}),false);
assert.equal(valid([1.3,0,3]),false);
const html=fs.readFileSync('worker/page.html','utf8'),script=html.match(/<script>([\s\S]*)<\/script>/)[1].replace('render();refresh();setInterval(render,60000);','');
const elements=new Map();const node=id=>{if(!elements.has(id))elements.set(id,{value:({min:'1.01',max:'100',gap:'15',bank:'100'})[id]||'',checked:false,hidden:false,parentElement:{hidden:false},options:[{textContent:""}],textContent:'',innerHTML:'',addEventListener(){},scrollIntoView(){}});return elements.get(id)};
const context=vm.createContext({document:{getElementById:node,querySelectorAll:()=>[]},localStorage:{getItem:()=>null},Intl,Date,console,alert:()=>{},setInterval:()=>{},URL,Blob});vm.runInContext(script,context);
const fixture={at:new Date().toISOString(),games:[{home:'Home',away:'Away',time:new Date(Date.now()+3600000).toISOString(),league:'Test',books:{giro:{odds:[2.5,3,3],url:'https://girocerto.io'},esporte:{odds:[2,3.8,4.2],url:'https://esportenetsp.com.br'}}}],sources:[]};context.fixture=fixture;
vm.runInContext('state=fixture;tab="sure";render();',context);assert.match(node('summary').textContent,/1 surebets/);vm.runInContext('calculate(0)',context);assert.match(node('calc').innerHTML,/Menor retorno/);
vm.runInContext('state.at="2020-01-01T00:00:00Z";render();',context);assert.match(node('summary').textContent,/0 surebets/);
vm.runInContext('state=fixture;state.at=new Date().toISOString();tab="value";render();',context);assert.match(node('summary').textContent,/3 sele/);
console.log('Verified matching, invalid odds, synthetic surebet, calculator, stale blocking and price-gap filters.');

const sample=fs.readFileSync("scripts/fixtures/jogos-day.html","utf8");const parsed=parseJogosPage(sample,2026);assert.ok(parsed.length>10);const pal=parsed.find(g=>g.home==="Palmeiras SP");assert.ok(pal);assert.equal(pal.odds.length,3);assert.equal(new Date(pal.time).toISOString(),"2026-11-05T22:30:00.000Z");assert.ok(pal.url.startsWith("https://esportenet-bet.jogos.app/"));console.log("Verified HTML parser, odds ordering, dates and source URLs.");


vm.runInContext('state={at:new Date().toISOString(),sources:[],games:[{home:"Home",away:"Away",time:new Date(Date.now()+3600000).toISOString(),league:"Test",books:{jogos:{odds:[2.5,3.8,4.2],url:"https://esportenet-bet.jogos.app/",at:"2020-01-01T00:00:00Z",offline:true}}}]};tab="sure";render();',context);assert.match(node('summary').textContent,/0 surebets/);
vm.runInContext('tab="search";render();',context);assert.match(node('summary').textContent,/3 sele/);assert.match(node('results').innerHTML,/Coleta local/);console.log('Verified stale offline source excluded from opportunities and retained in search.');
