import http from 'node:http';
import {tobetanoEventUrl} from './event-links.mjs';
import {TelegramAlerts} from './telegram-alerts.mjs';
import {marketAnomalies} from './market-anomalies.mjs';
import {statusAlerts} from './status-alerts.mjs';
import {HOUSE_NAMES} from './house-adapters.mjs';
import {matching} from '../worker/backend.js';
import {createLiveHouses} from './live-houses.mjs';
import {purgeLiveJournals} from './purge-live-journals.mjs';
import {LiveLifecycle} from './live-lifecycle.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {publicConfig,connectFeed,convertMarkets} from './tobetano-feed.mjs';
import {eligibleLive,priceMovements} from './live-core.mjs';
import {analyzeLive,analyzePrematch,favouriteSignal,LIMITS,analyzeLiveComparisons} from './opportunities.mjs';
import {labelMarkets} from './market-labels.mjs';
import {createHouseManager} from './house-manager.mjs';
import {LiveHistory} from './live-history.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'data/live'),intervalMs=20000;
await fs.mkdir(dir+'/history',{recursive:true});
let selectedHouses=Object.keys(HOUSE_NAMES);try{const saved=JSON.parse(await fs.readFile(dir+'/selected-houses.json','utf8'));if(Array.isArray(saved)&&saved.every(id=>HOUSE_NAMES[id]))selectedHouses=saved}catch(e){if(e.code!=='ENOENT')console.error('Preferências inválidas; usando casas padrão')}
const enabled=id=>selectedHouses.includes(id);
const lifecycle=new LiveLifecycle(dir+'/lifecycle.json');
const liveHistory=new LiveHistory(dir+'/history.sqlite');
let historyImporting=true,historyImportError=null;
let feed=null,configAt=0,pending=false,cycle=0,nextAt=null,lastError=null,lastAttemptAt=null,lastSuccessfulAt=null;
let marketDictionary={};
let snapshot={bookmakerId:'tobetano',mode:'live',observedAt:null,events:[],movements:[]};
const clients=new Set();let liveSignals=[],preSignals=[],preFavourites=[],liveAnalysisMs=null,preAnalysisMs=null,preSourceAt=null,preError=null,preAnalyzedAt=null,preBusy=false,preGeneration=null;
const broadcast=()=>{for(const client of clients)client.write('data: '+JSON.stringify({at:new Date().toISOString(),cycle})+'\n\n')};
const combined=()=>{const events=[...snapshot.events,...liveHouses.events()].filter(g=>enabled(g.bookmakerId)&&!lifecycle.rows.get(g.id)?.finishedAt);return {...snapshot,events:[...events,...lifecycle.missing(events).filter(g=>enabled(g.bookmakerId))]}};
const refreshExtra=()=>{const all=combined();for(const g of all.events)if(!g.lifecycle)lifecycle.observe(g);const changes=priceMovements(extraPrevious,all);extraPrevious=all;liveHistory.attach(all);liveHistory.append(changes);lifecycle.save();broadcast()};
let extraPrevious={events:[]};
const liveHouses=createLiveHouses(()=>{try{refreshExtra()}catch(e){console.error('Coletores ao vivo: '+e.message)}},enabled);
let retentionBusy=false;
async function expireFinished(){if(retentionBusy)return;retentionBusy=true;const expired=lifecycle.expire();try{for(const g of expired)liveHistory.deleteEvent(g.id);if(expired.length)await purgeLiveJournals(dir+'/history',new Set(expired.map(g=>g.id)));lifecycle.save()}catch(e){for(const g of expired)lifecycle.rows.set(g.id,g);lifecycle.save();console.error('Limpeza de jogos encerrados: '+e.message)}finally{retentionBusy=false}}
setInterval(expireFinished,60000).unref();
let preAnalysisTimer;
const houseManager=createHouseManager(path.join(root,'data/robots'),()=>{clearTimeout(preAnalysisTimer);preAnalysisTimer=setTimeout(()=>{const start=performance.now();const api=houseManager.snapshot();preSignals=analyzePrematch(api);preFavourites=houseManager.documents().flatMap(d=>{const signal=favouriteSignal(d,'prematch');return [...(signal?[signal]:[]),...marketAnomalies(d,'prematch')]});preSourceAt=api.quotes.filter(q=>q.method==='automatic'&&q.freshness==='current').map(q=>q.observedAt).sort().at(-1)||null;preAnalyzedAt=new Date().toISOString();preAnalysisMs=performance.now()-start;preError=null;broadcast()},200)},enabled);
const checkStatusAlerts=()=>{const now=Date.now(),rows=houseManager.monitorRows().filter(p=>now-Date.parse(p.observedAt)>=0&&now-Date.parse(p.observedAt)<=90000),refs=combined().events.filter(g=>g.finishedAt||(!g.lifecycle&&now-Date.parse(g.observedAt)>=0&&now-Date.parse(g.observedAt)<=40000));return {generatedAt:new Date(now).toISOString(),alerts:statusAlerts(rows,refs,now),prematchRows:rows.length,referenceRows:refs.length,houses:HOUSE_NAMES}};
let statusMonitorBusy=false;
setInterval(async()=>{if(statusMonitorBusy)return;statusMonitorBusy=true;try{await fs.writeFile(dir+'/status-alerts.tmp',JSON.stringify(checkStatusAlerts()));await fs.rename(dir+'/status-alerts.tmp',dir+'/status-alerts.json')}catch(e){console.error('Monitor de status: '+e.message)}finally{statusMonitorBusy=false}},20000).unref();
const telegram=new TelegramAlerts(path.join(root,'data/telegram'));await telegram.init();
setInterval(()=>{telegram.poll([...opportunities().signals,...checkStatusAlerts().alerts])},3000).unref();
const opportunities=()=>({generatedAt:new Date().toISOString(),live:{sourceAt:snapshot.observedAt,analysisMs:liveAnalysisMs,stale:!lastSuccessfulAt||Date.now()-Date.parse(lastSuccessfulAt)>40000,bookmakers:['tobetano',...liveHouses.status().filter(s=>s.status==='success').map(s=>s.id)],sources:liveHouses.status(),eventsAnalyzed:combined().events.filter(e=>!e.lifecycle).length,limits:'Um feed ao vivo: identifica padrÃµes de preÃ§o, sem confirmar arbitragem entre casas.'},prematch:{sourceAt:preSourceAt,analyzedAt:preAnalyzedAt,analysisMs:preAnalysisMs,error:preError,refreshSeconds:30,limits:'RobÃ´s locais por casa, intervalo-alvo de 30 segundos, sem sobrepor coletas; duração e fila podem ampliar o intervalo. Cobertura parcial. Fontes bloqueadas ficam fora. Primeiro tempo: favoritos da Tobetano.'},signals:[...liveSignals,...analyzeLiveComparisons(combined()),...preSignals,...preFavourites].filter(s=>{const age=Date.now()-Date.parse(s.observedAt);const ids=s.picks?s.picks.map(p=>p.bookmakerId):s.best?[s.best.bookmakerId,s.other.bookmakerId]:[s.bookmakerId];return ids.every(enabled)&&age>=0&&age<=(s.mode==='live'?LIMITS.liveMaxAgeMs:LIMITS.prematchMaxAgeMs)})});
try{snapshot=JSON.parse(await fs.readFile(dir+'/latest.json','utf8'))}catch(e){if(e.code!=='ENOENT')console.error('Snapshot local invÃ¡lido; aguardando coleta nova')}
const status=()=>({service:'odds-radar-live',intervalSeconds:20,scope:'Tobetano Â· futebol ao vivo',running:true,pending,cycle,lastAttemptAt,lastSuccessfulAt,nextAt,lastError,observedAt:snapshot.observedAt,ageSeconds:snapshot.observedAt?(Date.now()-Date.parse(snapshot.observedAt))/1000:null,events:combined().events.filter(e=>!e.lifecycle).length,quotes:combined().events.reduce((n,e)=>n+e.markets.reduce((total,m)=>total+m.marketItems.reduce((count,i)=>count+i.outcomes.length,0),0),0),stale:!lastSuccessfulAt||Date.now()-Date.parse(lastSuccessfulAt)>40000});
async function collect(){
 if(!enabled('tobetano')){liveSignals=[];feed?.close();feed=null;setTimeout(collect,5000);return;}if(pending)return;pending=true;const started=Date.now();lastAttemptAt=new Date().toISOString();cycle++;
 try{
  if(!feed||Date.now()-configAt>3600000){feed?.close();const config=await publicConfig();feed=await connectFeed(config);configAt=Date.now();try{const r=await fetch('https://sport-iframe.aakvjlhif.com/apg/v0/sport/feed/localization/markets?lang=pt&prompt=true',{headers:{'X-Api-Key':config.widgets.defaultVariation.apiKeySdk},signal:AbortSignal.timeout(10000)});if(r.ok)marketDictionary=await r.json()}catch{}}
  const listed=(await feed.query('GetLiveRichEventsBySport',['F'])).filter(r=>!r.isRemoved&&eligibleLive(r.value)),events=[],batches=[];
  for(let i=0;i<listed.length;i+=10)batches.push(listed.slice(i,i+10));
  let index=0;
  await Promise.all(Array.from({length:3},async()=>{while(index<batches.length){const group=batches[index++];const latest=(await feed.query('GetRichEventsByIds',[group.map(r=>r.key)])).filter(r=>!r.isRemoved&&eligibleLive(r.value));if(!latest.length)continue;const rows=await feed.query('GetMarketsByEventIds',[latest.map(r=>r.key),'true']);const at=new Date().toISOString();for(const r of latest)events.push({id:r.key,sourceUrl:tobetanoEventUrl(r.key,r.value),bookmakerId:'tobetano',bookmakerName:'Tobetano',event:{...r.value,stageName:marketDictionary.stages?.F?.[r.value.scoreboard?.stage]},observedAt:at,markets:labelMarkets(convertMarkets(rows.filter(m=>m.key?.eventId===r.key)),r.value,marketDictionary)})}}));
  const activeIds=new Set(events.map(e=>e.id)),missing=lifecycle.pending().filter(id=>!activeIds.has(id)).slice(0,100);
  if(missing.length){try{const ended=await feed.query('GetRichEventsByIds',[missing]);for(const r of ended)if(r.value?.scoreboard?.stage===9){const previous=lifecycle.rows.get(r.key);if(previous){lifecycle.observe({...previous,event:{...r.value,stageName:'Encerrado'}});const key=e=>({home:e.competitors?.[0]?.name||'',away:e.competitors?.[1]?.name||'',time:new Date(e.startTime*1000).toISOString()});for(const tracked of lifecycle.rows.values())if(tracked.id!==r.key&&!tracked.finishedAt&&matching(key(tracked.event),key(r.value)))lifecycle.observe({...tracked,event:{...tracked.event,scoreboard:r.value.scoreboard,stageName:'Encerrado'},confirmedBy:'tobetano'})}}}catch(e){console.error('Confirmação do encerramento: '+e.message)}}
  for(const g of events)lifecycle.observe(g);
  await expireFinished();
  lifecycle.save();
  const fresh={bookmakerId:'tobetano',mode:'live',observedAt:new Date().toISOString(),intervalSeconds:20,events};
  liveHistory.attach({...fresh,events:[...fresh.events,...liveHouses.events()]});
  const analysisStart=performance.now();liveSignals=[...analyzeLive(fresh),...fresh.events.flatMap(g=>marketAnomalies(g,'live'))];liveAnalysisMs=performance.now()-analysisStart;
  fresh.movements=priceMovements(snapshot,fresh);snapshot=fresh;lastSuccessfulAt=fresh.observedAt;lastError=null;
  liveHistory.append(fresh.movements);
  liveHistory.prune();
  broadcast();
  await fs.writeFile(dir+'/latest.tmp',JSON.stringify(snapshot));await fs.rename(dir+'/latest.tmp',dir+'/latest.json');
  if(fresh.movements.length){const hour=fresh.observedAt.slice(0,13).replaceAll(':','-');await fs.appendFile(dir+'/history/'+hour+'.jsonl',fresh.movements.map(r=>JSON.stringify(r)).join('\n')+'\n')}
  const cutoff=Date.now()-72*3600000;for(const name of await fs.readdir(dir+'/history')){if(!/^\d{4}-\d{2}-\d{2}T\d{2}\.jsonl$/.test(name))continue;const hour=Date.parse(name.slice(0,13)+':00:00Z');if(hour+3600000<cutoff)await fs.unlink(path.join(dir,'history',name))}
  console.log(JSON.stringify({at:fresh.observedAt,cycle,events:events.length,changes:fresh.movements.length,durationMs:Date.now()-started}));
 }catch(e){lastError=e.message;console.error(JSON.stringify({at:new Date().toISOString(),error:lastError}));feed?.close();feed=null}
 finally{pending=false;const delay=Math.max(1000,intervalMs-(Date.now()-started));nextAt=new Date(Date.now()+delay).toISOString();setTimeout(collect,delay)}
}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:4180');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const origin=req.headers.origin;if(origin==='https://juniormorais127.github.io'||/^http:\/\/(127\.0\.0\.1|localhost):4180$/.test(origin||'')){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Private-Network','true')}
  if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');res.writeHead(204);return res.end()}
  if(url.pathname==='/api/telegram/status'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(telegram.status()))}
  if(url.pathname==='/api/status-alerts'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(checkStatusAlerts()))}
  if(url.pathname==='/status-alerts.html'){res.setHeader('Content-Type','text/html;charset=utf-8');return res.end(await fs.readFile(root+'/worker/status-alerts.html'))}
  if(url.pathname==='/api/collector-settings'){
   res.setHeader('Content-Type','application/json');
   if(req.method==='PUT'){
    if(origin&&!/^http:\/\/(127\.0\.0\.1|localhost):4180$/.test(origin)){res.writeHead(403);return res.end(JSON.stringify({error:'Origem não permitida'}))}
    if(!String(req.headers['content-type']).startsWith('application/json')){res.writeHead(415);return res.end(JSON.stringify({error:'Use JSON'}))}
    let body='';for await(const chunk of req){body+=chunk;if(body.length>4096){res.writeHead(413);return res.end(JSON.stringify({error:'Dados excessivos'}))}}
    let d;try{d=JSON.parse(body)}catch{res.writeHead(400);return res.end(JSON.stringify({error:'JSON inválido'}))}
    if(!Array.isArray(d.selected)||!d.selected.every(id=>typeof id==='string'&&HOUSE_NAMES[id])){res.writeHead(400);return res.end(JSON.stringify({error:'Seleção de casas inválida'}))}
    const next=[...new Set(d.selected)];await fs.writeFile(dir+'/selected-houses.tmp',JSON.stringify(next));await fs.rename(dir+'/selected-houses.tmp',dir+'/selected-houses.json');selectedHouses=next;broadcast();
   }else if(req.method!=='GET'){res.writeHead(405);return res.end()}
   return res.end(JSON.stringify({selected:selectedHouses,houses:Object.entries(HOUSE_NAMES).map(([id,name])=>({id,name,live:['tobetano','giro','futamina','melbet','apostacerta'].includes(id)}))}))
  }
  if(url.pathname==='/collector-settings.js'){res.setHeader('Content-Type','text/javascript;charset=utf-8');return res.end(await fs.readFile(root+'/worker/collector-settings.js'))}
  if(req.method!=='GET'){res.writeHead(405);return res.end('Somente leitura')}
  if(url.pathname==='/api/live/collectors'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({sources:liveHouses.status()}))}
  if(url.pathname==='/api/collectors'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({at:new Date().toISOString(),houses:houseManager.status()}))}
  if(url.pathname==='/api/prematch'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(houseManager.snapshot()))}
  if(url.pathname.startsWith('/api/houses/')){const id=url.pathname.split('/').at(-1),house=houseManager.house(id);res.setHeader('Content-Type','application/json');if(!house){res.writeHead(404);return res.end(JSON.stringify({error:'Casa nÃ£o encontrada'}))}return res.end(JSON.stringify(house))}
  if(url.pathname==='/collectors.js'){res.setHeader('Content-Type','text/javascript;charset=utf-8');return res.end(await fs.readFile(root+'/worker/collectors-ui.js'))}
  if(url.pathname==='/api/events'){res.setHeader('Content-Type','text/event-stream');res.setHeader('Connection','keep-alive');res.write('data: '+JSON.stringify({cycle})+'\n\n');clients.add(res);const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),15000);req.on('close',()=>{clients.delete(res);clearInterval(heartbeat)});return}
  if(url.pathname==='/api/opportunities'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(opportunities()))}
  if(url.pathname==='/opportunities.js'){res.setHeader('Content-Type','text/javascript;charset=utf-8');return res.end(await fs.readFile(root+'/worker/opportunities-ui.js'))}
  if(url.pathname==='/health'||url.pathname==='/api/live/status'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(status()))}
  if(url.pathname==='/api/live'){res.setHeader('Content-Type','application/json');const eventId=url.searchParams.get('eventId');return res.end(JSON.stringify({...combined(),status:status(),sources:liveHouses.status(),events:eventId?combined().events.filter(e=>e.id===eventId):combined().events}))}
  if(url.pathname==='/api/live/history'){res.setHeader('Content-Type','application/json');const id=url.searchParams.get('seriesId');if(!/^[a-f0-9]{64}$/.test(id||'')){res.writeHead(400);return res.end(JSON.stringify({error:'Selecione uma odd para acompanhar'}))}return res.end(JSON.stringify({...liveHistory.get(id,Number(url.searchParams.get('hours'))||72,Number(url.searchParams.get('limit'))||2000),importing:historyImporting,importError:historyImportError}))}
  if(url.pathname==='/live-history.js'){res.setHeader('Content-Type','text/javascript;charset=utf-8');return res.end(await fs.readFile(root+'/worker/live-history-ui.js'))}
  if(url.pathname==='/opportunities.html'){res.setHeader('Content-Type','text/html;charset=utf-8');return res.end(await fs.readFile(root+'/worker/opportunities.html'))}
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');return res.end(await fs.readFile(root+'/worker/live.html'))}
  res.writeHead(404);res.end('NÃ£o encontrado');
 }catch(e){res.writeHead(500);res.end('Erro no servidor local')}
});
server.listen(4180,'127.0.0.1',()=>{console.log('RobÃ´ local em http://127.0.0.1:4180');collect();houseManager.start();liveHouses.start();liveHistory.importJournal(dir+'/history').then(()=>{historyImporting=false;broadcast()}).catch(e=>{historyImporting=false;historyImportError=e.message;console.error('ImportaÃ§Ã£o de histÃ³rico: '+e.message)})});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{houseManager.stop();liveHouses.stop();feed?.close();liveHistory.close();server.close();process.exit(0)});
