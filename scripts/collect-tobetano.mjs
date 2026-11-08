import fs from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {publicConfig,connectFeed,convertMarkets,finalOdds,eligiblePrematch,TOBETANO_ORIGIN} from './tobetano-feed.mjs';
import {labelMarkets} from './market-labels.mjs';
const root='collector-output/tobetano';await fs.mkdir(root+'/events',{recursive:true});
const startedAt=new Date().toISOString(),failures=[],events=new Map(),records=[];let feed;
const report={bookmakerId:'tobetano',name:'Tobetano',sport:'football',startedAt,ok:false,partial:true,events:[],failures};
async function pool(items,fn){let index=0;await Promise.all(Array.from({length:4},async()=>{while(index<items.length){const item=items[index++];try{await fn(item)}catch(e){failures.push({item:Array.isArray(item)?item.map(r=>r.id):item.key,error:e.message})}}}))}
try{
 const config=await publicConfig();feed=await connectFeed(config);let dictionary={};
 try{const r=await fetch(TOBETANO_ORIGIN+'/apg/v0/sport/feed/localization/markets?lang=pt&prompt=true',{headers:{'X-Api-Key':config.widgets.defaultVariation.apiKeySdk},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);dictionary=await r.json();await fs.writeFile(root+'/translations.json',JSON.stringify(dictionary))}catch(e){report.translationError=e.message}
 const sports=await feed.query('GetSports');report.advertisedFootball=sports.find(s=>s.key==='F')?.value||null;
 const tournaments=await feed.query('GetTournamentsBySport',['F',1]);report.tournamentsRequested=tournaments.length;
 await pool(tournaments,async t=>{const rows=await feed.query('GetRichEventsByTournamentIdAndStage',[t.key,1]);for(const r of rows)if(!r.isRemoved&&r.value?.sport==='F'&&r.value.stage===1&&r.value.status===0&&r.value.startTime*1000>Date.now()&&!r.value.isCybersport)events.set(r.key,{id:r.key,...r.value})});
 console.log(JSON.stringify({phase:'events',count:events.size,failures:failures.length}));
 const list=[...events.values()];const batches=[];for(let i=0;i<list.length;i+=10)batches.push(list.slice(i,i+10));
 await pool(batches,async batch=>{
  const latest=await feed.query('GetRichEventsByIds',[batch.map(e=>e.id)]);
  batch=latest.filter(r=>!r.isRemoved&&eligiblePrematch(r.value)).map(r=>({id:r.key,...r.value}));
  if(!batch.length)return;
  const rows=await feed.query('GetMarketsByEventIds',[batch.map(e=>e.id),'true'],45000),grouped=new Map(batch.map(e=>[e.id,[]]));
  for(const row of rows)grouped.get(row.key?.eventId)?.push(row);
  const observedAt=new Date().toISOString();
  for(const event of batch){
   if(!eligiblePrematch(event))continue;
   const markets=labelMarkets(convertMarkets(grouped.get(event.id)),event,dictionary),outcomes=markets.flatMap(m=>m.marketItems.flatMap(i=>i.outcomes));
   const sourceUrl=TOBETANO_ORIGIN+'/pt/events/'+event.slug+'-'+event.id;
   const document={bookmakerId:'tobetano',sport:'football',observedAt,event,sourceUrl,markets};
   await fs.writeFile(root+'/events/'+event.id+'.json',JSON.stringify(document));
   report.events.push({id:event.id,name:event.name,home:event.competitors?.[0]?.name,away:event.competitors?.[1]?.name,startsAt:new Date(event.startTime*1000).toISOString(),stage:event.stage,status:event.status,tradingStatus:event.tradingStatus,league:event.tournamentName,observedAt,marketCount:markets.length,quoteCount:outcomes.length,activeQuoteCount:outcomes.filter(o=>!o.isFrozen&&o.decimalOdds>1).length,file:'events/'+event.id+'.json',sourceUrl});
   const odds=finalOdds(markets);
   if(odds&&event.stage===1&&event.status===0&&event.tradingStatus===1&&event.startTime*1000>Date.now()&&event.competitors?.length===2&&!event.isCybersport)records.push({home:event.competitors[0].name,away:event.competitors[1].name,time:new Date(event.startTime*1000).toISOString(),league:event.tournamentName,odds,url:sourceUrl,at:observedAt});
  }
 });
 if(!report.events.length)throw Error('Nenhuma partida de futebol retornada');
 report.ok=true;report.partial=failures.length>0;report.scope='Todos os campeonatos de futebol pré-jogo retornados pelo feed público; início futuro, sem ao vivo ou cybersport. Todos os mercados retornados por evento. Não comprova cobertura de mercados que o provedor não retornou.';
 try{const r=await fetch(TOBETANO_ORIGIN+'/apg/v0/sport/feed/localization/markets?lang=pt&prompt=true',{headers:{'X-Api-Key':config.widgets.defaultVariation.apiKeySdk},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);await fs.writeFile(root+'/translations.json',JSON.stringify(await r.json()))}catch(e){report.translationError=e.message}
}catch(e){report.error=e.message}finally{feed?.close()}
report.at=new Date().toISOString();report.eventCount=report.events.length;report.quoteCount=report.events.reduce((n,e)=>n+e.quoteCount,0);report.records=records;
await fs.writeFile(root+'/index.json',JSON.stringify(report));
await fs.writeFile(root+'/index.json.gz',gzipSync(JSON.stringify(report)));
console.log(JSON.stringify({ok:report.ok,partial:report.partial,events:report.eventCount,quotes:report.quoteCount,comparisonGames:records.length,failures:failures.length,error:report.error}));
