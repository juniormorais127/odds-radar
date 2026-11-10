import {tobetanoEventUrl} from './event-links.mjs';
import {houseCollectors} from '../worker/backend.js';
import {publicConfig,connectFeed,eligiblePrematch,convertMarkets,finalOdds} from './tobetano-feed.mjs';
export const HOUSE_NAMES={giro:'Giro Certo',esporte:'Esportenet SP',melbet:'Melbet',jogos:'Esportenet Jogos',futamina:'Futamina',tobetano:'Tobetano',grana:'Granawin',exclusive:'ExclusiveBet',two:'2UP',sportsbet:'Sportsbet.io',stake:'Stake',fortune:'FortuneJack'};
export const GRANA_URL='https://platform.granawin-go.com/api/event/list?lang=pt&relations=odds&relations=league&relations=competitors&relations=result&oddsExists_eq=1&main=1&period=0&sportId_eq=1&limit=50&status_in=0&oddsBooster=0&isFavorite=0&isLive=false';
const json=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json()};
export function parseGrana(data,now=Date.now()){
 const rel=data.relations,competitors=new Map(rel.competitors.map(c=>[c.id,c])),leagues=new Map(rel.league.map(l=>[l.id,l])),games=[];
 for(const e of data.items){
  if(e.sportId!==1||e.status!==0||e.isHomeAwayReversed)continue;
  const time=e.time.replace(' ','T')+'Z';if(!Number.isFinite(Date.parse(time))||Date.parse(time)<=now)continue;
  const home=competitors.get(e.competitor1Id)?.name,away=competitors.get(e.competitor2Id)?.name;if(!home||!away)continue;
  const markets=(rel.odds[e.id]||[]).filter(m=>m.id===621&&m.status===1&&!m.specifiers&&m.outcomes.length===3&&[1,2,3].every(id=>m.outcomes.some(o=>o.id===id&&o.active===1&&Number.isFinite(o.odds)&&o.odds>1)));
  if(markets.length!==1)continue;
  const league=leagues.get(e.leagueId);games.push({home,away,time,league:league?.name||'',odds:[1,2,3].map(id=>markets[0].outcomes.find(o=>o.id===id).odds),url:'https://granawin-go.com/br/prematch/football/'+e.leagueId+'-'+(league?.translationSlug||'league')+'/'+e.id+'-'+e.translationSlug});
 }
 return games;
}
export async function grana(){
 const first=await json(GRANA_URL);if(first.status!=='ok'||!first.data?.items)throw Error('Resposta Granawin inválida');
 const pages=[first.data],failures=[];let next=2;
 await Promise.all(Array.from({length:3},async()=>{while(next<=first.data.lastPage){const page=next++;try{const d=await json(GRANA_URL+'&page='+page);if(d.data?.page!==page)throw Error('Paginação não confirmada');pages.push(d.data)}catch(e){failures.push({page,error:e.message})}}}));
 const games=[...new Map(pages.flatMap(p=>parseGrana(p)).map(g=>[g.url,g])).values()];if(!games.length)throw Error('Nenhuma odd 1X2 válida retornada');
 return {games,partial:failures.length>0,failures,note:'Futebol pré-jogo, resultado final. Paginação da API pública; odds suspensas e orientação invertida excluídas.'};
}
export async function tobetano(){
 const feed=await connectFeed(await publicConfig());try{
  const events=(await feed.query('GetRichEventsBySportAndTimeRange',['F',{fromInHours:0,toInHours:24}])).filter(r=>!r.isRemoved&&eligiblePrematch(r.value)&&r.value.tradingStatus===1),games=[],favourites=[],favouriteDocuments=[];let index=0;const groups=[];for(let i=0;i<events.length;i+=25)groups.push(events.slice(i,i+25));
  await Promise.all(Array.from({length:3},async()=>{while(index<groups.length){const group=groups[index++];const rows=await feed.query('GetMainMarketsByProfileAndEventIds',['main_tw',group.map(r=>r.key),1,3]);for(const e of group){const prices=finalOdds(convertMarkets(rows.filter(r=>r.key.eventId===e.key)));if(!prices)continue;if(Math.min(prices[0],prices[2])<=1.6)favourites.push(e);games.push({home:e.value.competitors[0].name,away:e.value.competitors[1].name,time:new Date(e.value.startTime*1000).toISOString(),league:e.value.tournamentName,odds:prices,url:'https://sport-iframe.aakvjlhif.com/pt/events/'+e.value.slug+'-'+e.key})}}}));
  const batches=[];for(let i=0;i<favourites.length;i+=10)batches.push(favourites.slice(i,i+10));index=0;
  await Promise.all(Array.from({length:3},async()=>{while(index<batches.length){const batch=batches[index++];try{const rows=await feed.query('GetMarketsByEventIds',[batch.map(e=>e.key),'true']);for(const e of batch)favouriteDocuments.push({id:e.key,sourceUrl:tobetanoEventUrl(e.key,e.value),event:e.value,observedAt:new Date().toISOString(),markets:convertMarkets(rows.filter(r=>r.key.eventId===e.key&&r.key.resultKind===1&&r.key.marketType===2&&[0,1].includes(r.key.period)&&r.key.subPeriod==null))})}catch{}}}));
  if(!games.length)throw Error('Nenhum 1X2 pré-jogo retornado pelo perfil público');return {games,favouriteDocuments,partial:true,note:'Resultado final nas próximas 24 horas; primeiro tempo conferido para favoritos até 1,60. O catálogo completo continua separado.'};
 }finally{feed.close()}
}
export function exclusiveDate(day,hour,now=Date.now()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));const get=t=>parts.find(p=>p.type===t).value;const today=get('year')+'-'+get('month')+'-'+get('day');
 if(/^hoje$/i.test(day))return today+'T'+hour+':00-03:00';
 if(/^amanh[ãa]$/i.test(day)){const date=new Date(Date.parse(today+'T12:00:00-03:00')+86400000);return date.toISOString().slice(0,10)+'T'+hour+':00-03:00'}
 const m=day.match(/^(\d{2})\/(\d{2})$/);if(!m)return null;let year=Number(get('year'));let at=year+'-'+m[2]+'-'+m[1]+'T'+hour+':00-03:00';if(Date.parse(at)<now-180*86400000)at=(year+1)+at.slice(4);return at;
}
export async function exclusive(){
 // Standard browser owned by this collector; no login, challenge solving or stealth.
 const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true});const games=[],failures=[];
 try{const context=await browser.newContext({locale:'pt-BR',timezoneId:'America/Fortaleza'}),page=await context.newPage();const home=await page.goto('https://sports2.exclusivebeteu.com/pt',{waitUntil:'domcontentloaded',timeout:25000});if(home.status()>=400)throw Error('HTTP '+home.status());
  const urls=await page.locator('a[href*="/futebol/1/"]').evaluateAll(nodes=>[...new Set(nodes.map(a=>a.href))].slice(0,12));if(!urls.length)throw Error('Ligas públicas não encontradas');
  for(const url of urls){try{const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});if(r.status()>=400)throw Error('HTTP '+r.status());await page.locator('.EventItem').first().waitFor({state:'visible',timeout:15000});
   const rows=await page.locator('.EventItem').evaluateAll(nodes=>nodes.map(node=>{const detail=node.querySelector('.EventItem__MatchDetails'),lines=detail?.innerText.split('\n').map(s=>s.trim()).filter(Boolean)||[];const price=label=>{const b=[...node.querySelectorAll('button')].find(b=>b.innerText.trim().startsWith(label+'\n'));return Number(b?.innerText.trim().split('\n').at(-1)?.replace(',','.'))};return {lines,odds:['Casa','Empate','Fora'].map(price),url:detail?.querySelector('a[href]')?.href}}));
   for(const row of rows){const day=row.lines.find(s=>/^hoje$|^amanh[ãa]$|^\d{2}\/\d{2}$/i.test(s)),hour=row.lines.find(s=>/^\d{2}:\d{2}$/.test(s)),time=day&&hour?exclusiveDate(day,hour):null;if(!time||Date.parse(time)<=Date.now()||!row.url||!row.odds.every(o=>Number.isFinite(o)&&o>1))continue;games.push({home:row.lines[0],away:row.lines[1],time,league:'ExclusiveBet · liga de futebol',odds:row.odds,url:row.url})}
  }catch(e){failures.push({url,error:e.message})}}
 }finally{await browser.close()}
 if(!games.length)throw Error('Nenhuma odd válida nas ligas públicas consultadas');return {games:[...new Map(games.map(g=>[g.url,g])).values()],partial:true,failures,note:'Ligas de futebol disponíveis no menu público; resultado final pré-jogo. Novos eventos descobertos a cada coleta.'};
}
const blocked={two:'https://2up.io/pt-br/sports/soccer',sportsbet:'https://sportsbet.io/pt/sports/soccer',stake:'https://stake.com/pt/sports/soccer',fortune:'https://fortunejack.com/pt/crypto-sportsbook'};
export const adapters={...houseCollectors,grana,exclusive,tobetano,...Object.fromEntries(Object.entries(blocked).map(([id,url])=>[id,async()=>{const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status+'; não foi contornado o bloqueio');throw Error('Página respondeu, mas não há parser validado para novas odds nesta fonte')}]))};
