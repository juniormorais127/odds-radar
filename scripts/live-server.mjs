import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {publicConfig,connectFeed,convertMarkets} from './tobetano-feed.mjs';
import {eligibleLive,priceMovements} from './live-core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'data/live'),intervalMs=20000;
await fs.mkdir(dir+'/history',{recursive:true});
let feed=null,configAt=0,pending=false,cycle=0,nextAt=null,lastError=null,lastAttemptAt=null,lastSuccessfulAt=null;
let snapshot={bookmakerId:'tobetano',mode:'live',observedAt:null,events:[],movements:[]};
try{snapshot=JSON.parse(await fs.readFile(dir+'/latest.json','utf8'))}catch(e){if(e.code!=='ENOENT')console.error('Snapshot local inválido; aguardando coleta nova')}
const status=()=>({service:'odds-radar-live',intervalSeconds:20,scope:'Tobetano · futebol ao vivo',running:true,pending,cycle,lastAttemptAt,lastSuccessfulAt,nextAt,lastError,observedAt:snapshot.observedAt,ageSeconds:snapshot.observedAt?(Date.now()-Date.parse(snapshot.observedAt))/1000:null,events:snapshot.events.length,quotes:snapshot.events.reduce((n,e)=>n+e.markets.reduce((total,m)=>total+m.marketItems.reduce((count,i)=>count+i.outcomes.length,0),0),0),stale:!lastSuccessfulAt||Date.now()-Date.parse(lastSuccessfulAt)>40000});
async function collect(){
 if(pending)return;pending=true;const started=Date.now();lastAttemptAt=new Date().toISOString();cycle++;
 try{
  if(!feed||Date.now()-configAt>3600000){feed?.close();feed=await connectFeed(await publicConfig());configAt=Date.now()}
  const listed=(await feed.query('GetLiveRichEventsBySport',['F'])).filter(r=>!r.isRemoved&&eligibleLive(r.value)),events=[],batches=[];
  for(let i=0;i<listed.length;i+=10)batches.push(listed.slice(i,i+10));
  let index=0;
  await Promise.all(Array.from({length:3},async()=>{while(index<batches.length){const group=batches[index++];const latest=(await feed.query('GetRichEventsByIds',[group.map(r=>r.key)])).filter(r=>!r.isRemoved&&eligibleLive(r.value));if(!latest.length)continue;const rows=await feed.query('GetMarketsByEventIds',[latest.map(r=>r.key),'true']);const at=new Date().toISOString();for(const r of latest)events.push({id:r.key,event:r.value,observedAt:at,markets:convertMarkets(rows.filter(m=>m.key?.eventId===r.key))})}}));
  const fresh={bookmakerId:'tobetano',mode:'live',observedAt:new Date().toISOString(),intervalSeconds:20,events};
  fresh.movements=priceMovements(snapshot,fresh);snapshot=fresh;lastSuccessfulAt=fresh.observedAt;lastError=null;
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
  if(req.method!=='GET'){res.writeHead(405);return res.end('Somente leitura')}
  if(url.pathname==='/health'||url.pathname==='/api/live/status'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(status()))}
  if(url.pathname==='/api/live'){res.setHeader('Content-Type','application/json');const eventId=url.searchParams.get('eventId');return res.end(JSON.stringify({...snapshot,status:status(),events:eventId?snapshot.events.filter(e=>e.id===eventId):snapshot.events}))}
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');return res.end(await fs.readFile(root+'/worker/live.html'))}
  res.writeHead(404);res.end('Não encontrado');
 }catch(e){res.writeHead(500);res.end('Erro no servidor local')}
});
server.listen(4180,'127.0.0.1',()=>{console.log('Robô local em http://127.0.0.1:4180');collect()});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{feed?.close();server.close();process.exit(0)});
