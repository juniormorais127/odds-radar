import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {TelegramAlerts,telegramText} from './telegram-alerts.mjs';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'radar-telegram-'));let now=Date.now(),requests=[];
try{await fs.writeFile(dir+'/config.json',JSON.stringify({enabled:true,token:'123:test_token',chatId:'-123',chatTitle:'Teste',types:['surebet_candidate']}));
const bot=new TelegramAlerts(dir,{now:()=>now,fetcher:async(url,options)=>{requests.push(JSON.parse(options.body));return {ok:true,status:200,json:async()=>({ok:true})}}});await bot.init();
const s={id:'live|a',mode:'live',type:'surebet_candidate',event:'A × B',observedAt:new Date(now).toISOString(),picks:[{bookmakerId:'giro',selectionLabel:'Casa',decimalOdds:2.5,observedAt:new Date(now).toISOString()}],profitPercent:1};
await bot.poll([s]);assert.equal(requests.length,1);assert.equal(requests[0].chat_id,'-123');assert.match(requests[0].text,/teórico/);await bot.poll([s]);assert.equal(requests.length,1);
const restart=new TelegramAlerts(dir,{now:()=>now,fetcher:async()=>{throw Error('Não deve enviar duplicado')}});await restart.init();await restart.poll([s]);assert.equal(restart.error,null);
now+=41000;await bot.poll([{...s,id:'old'}]);assert.equal(requests.length,1);
assert(!telegramText(s).includes('test_token'));
await fs.writeFile(dir+'/config.json',JSON.stringify({enabled:false}));await bot.poll([{...s,id:'disabled',observedAt:new Date(now).toISOString()}]);assert.equal(requests.length,1);
console.log('Telegram: mocked delivery, group targeting, freshness, persistent deduplication and disabled state OK');
}finally{await fs.rm(dir,{recursive:true,force:true})}
