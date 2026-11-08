import {createHash} from 'node:crypto';
export const houses={giro:'Giro Certo',esporte:'Esportenet SP',melbet:'Melbet',jogos:'Esportenet Jogos',futamina:'Futamina',two:'2UP',grana:'Granawin',sportsbet:'Sportsbet.io',exclusive:'ExclusiveBet',stake:'Stake',fortune:'FortuneJack',tobetano:'Tobetano'};
const id=value=>createHash('sha256').update(value).digest('hex').slice(0,24);
const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function footballApi(data,collection,now=Date.now()){
 const generatedAt=new Date(now).toISOString(),events=[],quotes=[];
 const bookmakers=Object.entries(houses).map(([key,name])=>{
  const attempt=collection?.sources?.find(s=>s.key===key),source=data.sources?.filter(s=>s.key===key).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];
  return {id:key,name,lastAttemptAt:attempt?.at||source?.at||null,collectionStatus:attempt?(attempt.ok?'success':'failed'):source?(source.manualSnapshot?'manual_snapshot':source.offline?'fallback':source.ok?'success':'failed'):'not_collected',error:attempt?.error||source?.error||null,partial:attempt?true:source?.partial??true,scope:attempt?'monitored_events':'collector_subset',quoteCount:0,currentQuoteCount:0};
 });
 for(const game of data.games||[]){
  const start=Date.parse(game.time);if(!Number.isFinite(start)||start<=now||!game.home||!game.away)continue;
  const startsAt=new Date(start).toISOString(),eventId=id([norm(game.home),norm(game.away),startsAt].join('|')),rows=[];
  for(const [house,book] of Object.entries(game.books||{})){
   if(!houses[house]||!Array.isArray(book.odds)||book.odds.length!==3||!book.odds.every(n=>Number.isFinite(n)&&n>1))continue;
   const time=Date.parse(book.at),age=now-time,current=Number.isFinite(time)&&age>=0&&age<=300000&&!book.offline&&!book.manualSnapshot;
   for(const [i,selection] of ['home','draw','away'].entries())rows.push({id:id(eventId+'|'+house+'|ft_1x2|'+selection),eventId,bookmakerId:house,bookmakerName:houses[house],marketId:'ft_1x2',period:'full_time',selection,selectionLabel:i===0?'Casa ('+game.home+')':i===1?'Empate':'Fora ('+game.away+')',selectionName:i===0?game.home:i===1?'Empate':game.away,decimalOdds:book.odds[i],observedAt:Number.isFinite(time)?new Date(time).toISOString():null,freshness:current?'current':'historical',method:book.manualSnapshot?'browser_manual':book.offline?'fallback':'automatic',sourceUrl:book.url||null});
  }
  if(!rows.length)continue;
  if(!events.some(e=>e.id===eventId))events.push({id:eventId,sport:'football',home:game.home,away:game.away,startsAt,league:game.league||null});
  for(const row of rows)if(!quotes.some(q=>q.id===row.id))quotes.push(row);
 }
 for(const b of bookmakers){b.quoteCount=quotes.filter(q=>q.bookmakerId===b.id).length;b.currentQuoteCount=quotes.filter(q=>q.bookmakerId===b.id&&q.freshness==='current').length;}
 return {schemaVersion:'1.0.0',generatedAt,oddsFormat:'decimal',freshnessWindowSeconds:300,coverage:{sport:'football',markets:['ft_1x2'],complete:false,note:'Subconjunto coletado. Não cobre todos os jogos ou mercados. Primeiro tempo ainda não integrado à coleta recorrente.'},bookmakers,events,quotes};
}
export async function writeFootballApi(fs,output,data,collection){
 const api=footballApi(data,collection),base=output+'/api/v1';await fs.mkdir(base+'/bookmakers',{recursive:true});
 const meta={schemaVersion:api.schemaVersion,generatedAt:api.generatedAt,coverage:api.coverage};
 const files={'index.json':{...meta,oddsFormat:api.oddsFormat,freshnessWindowSeconds:api.freshnessWindowSeconds,counts:{events:api.events.length,quotes:api.quotes.length},endpoints:{events:'events.json',quotes:'quotes.json',bookmakers:'bookmakers.json',football:'football.json',history:'history.json',movementAlerts:'movement-alerts.json',tobetano:'tobetano/index.json'}},'football.json':api,'events.json':{...meta,events:api.events},'quotes.json':{...meta,quotes:api.quotes},'bookmakers.json':{...meta,bookmakers:api.bookmakers}};
 for(const [name,body] of Object.entries(files))await fs.writeFile(base+'/'+name,JSON.stringify(body));
 for(const bookmaker of api.bookmakers)await fs.writeFile(base+'/bookmakers/'+bookmaker.id+'.json',JSON.stringify({...meta,bookmaker,quotes:api.quotes.filter(q=>q.bookmakerId===bookmaker.id)}));
 return api;
}
