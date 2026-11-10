import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {TelegramAlerts,telegramText} from './telegram-alerts.mjs';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'radar-telegram-'));let now=Date.now(),requests=[];
try{await fs.writeFile(dir+'/config.json',JSON.stringify({enabled:true,token:'123:test_token',chatId:'-123',chatTitle:'Teste',types:['surebet_candidate']}));
const bot=new TelegramAlerts(dir,{now:()=>now,fetcher:async(url,options)=>{requests.push(JSON.parse(options.body));return {ok:true,status:200,json:async()=>({ok:true})}}});await bot.init();
const s={id:'live|a',mode:'live',type:'surebet_candidate',event:'A × B',observedAt:new Date(now).toISOString(),picks:[{bookmakerId:'giro',selectionLabel:'Casa',sourceUrl:'https://girocerto.io/esportes?jogo=141c6403-a0d7-407f-b142-0a1e635a8c63',decimalOdds:2.5,observedAt:new Date(now).toISOString()}],profitPercent:1};
await bot.poll([{...s,id:'generic',picks:[{...s.picks[0],sourceUrl:'https://melbet.com/pt'}]}]);assert.equal(requests.length,0);assert.equal(bot.status().skippedMissingLinks,1);
await bot.poll([s]);assert.equal(requests.length,1);assert.match(requests[0].text,/Link da partida: https:/);assert.equal(requests[0].chat_id,'-123');assert.match(requests[0].text,/teórico/);await bot.poll([s]);assert.equal(requests.length,1);
const restart=new TelegramAlerts(dir,{now:()=>now,fetcher:async()=>{throw Error('Não deve enviar duplicado')}});await restart.init();await restart.poll([s]);assert.equal(restart.error,null);
now+=41000;await bot.poll([{...s,id:'old'}]);assert.equal(requests.length,1);
assert(!telegramText(s).includes('test_token'));
const favourite={...s,type:'favourite_first_half',bookmakerId:'tobetano',selection:'A',finalOdds:1.3,firstHalfOdds:6,sourceUrl:'https://sport-iframe.aakvjlhif.com/pt/events/a-b-123'};assert.match(telegramText(favourite),/https:\/\/sport-iframe/);
const long={...s,event:'A'.repeat(8000),note:'B'.repeat(8000)};assert(telegramText(long).length<=4000);assert(telegramText(long).includes(s.picks[0].sourceUrl));
await fs.writeFile(dir+'/config.json',JSON.stringify({enabled:false}));await bot.poll([{...s,id:'disabled',observedAt:new Date(now).toISOString()}]);assert.equal(requests.length,1);
console.log('Telegram: mocked delivery, group targeting, freshness, persistent deduplication and disabled state OK');
}finally{await fs.rm(dir,{recursive:true,force:true})}
