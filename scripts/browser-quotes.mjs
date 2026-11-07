import fs from 'node:fs';
export const browserSnapshot=JSON.parse(fs.readFileSync(new URL('../worker/browser-observed.json',import.meta.url),'utf8'));
export function browserRecords(snapshot=browserSnapshot){return Object.entries(snapshot.sources).flatMap(([house,s])=>s.rows.map(([id,odds,suffix])=>({house,...snapshot.events[id],eventKey:id,odds,url:s.prefix+suffix,at:s.at||snapshot.at,verifiedBrowser:true,market:'Resultado final · tempo regulamentar',league:'Premier League inglesa'})))}
export function mergeBrowserQuotes(data,snapshot=browserSnapshot,now=Date.now()){
 const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
 for(const r of browserRecords(snapshot)){
  if(!r.odds.every(o=>Number.isFinite(o)&&o>1)||Date.parse(r.time)<=now)continue;
  const matches=data.games.filter(g=>Math.abs(Date.parse(g.time)-Date.parse(r.time))<=60000&&r.homeAliases.some(a=>norm(a)===norm(g.home))&&r.awayAliases.some(a=>norm(a)===norm(g.away)));
  let g=matches[0];
  if(g){for(const duplicate of matches.slice(1)){for(const [key,book] of Object.entries(duplicate.books))if(!g.books[key])g.books[key]=book;data.games=data.games.filter(row=>row!==duplicate)}g.home=r.home;g.away=r.away}
  if(!g){g={home:r.home,away:r.away,time:r.time,league:r.league,books:{}};data.games.push(g)}
  g.books[r.house]={odds:r.odds,url:r.url,at:r.at,offline:true,manualSnapshot:true};
 }
 for(const [key,s] of Object.entries(snapshot.sources))data.sources.push({key,ok:true,count:s.rows.length,offline:true,manualSnapshot:true,at:s.at||snapshot.at,note:'Leitura assistida no navegador; não renovada por esta publicação.'});
 return data;
}
export function mergeAutomaticQuotes(data,collection,snapshot=browserSnapshot,now=Date.now()){
 const records=browserRecords(snapshot),norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
 for(const source of collection?.sources||[]){
  if(!source.ok||!Number.isFinite(Date.parse(source.at)))continue;
  for(const r of source.records||[]){
   const known=records.find(k=>k.house===source.key&&k.homeAliases.some(a=>norm(a)===norm(r.home))&&k.awayAliases.some(a=>norm(a)===norm(r.away))&&(source.url||'').replace(/\/popular$/,'')===k.url);
   if(!known||Date.parse(known.time)<=now||!Array.isArray(r.odds)||r.odds.length!==3||!r.odds.every(o=>Number.isFinite(o)&&o>1))continue;
   const game=data.games.find(g=>g.home===known.home&&g.away===known.away&&Math.abs(Date.parse(g.time)-Date.parse(known.time))<=60000);if(!game)continue;
   game.books[source.key]={odds:r.odds,url:source.url,at:source.at,offline:false};
   data.sources=data.sources.filter(s=>s.key!==source.key);
   data.sources.push({key:source.key,ok:true,count:1,partial:true,offline:false,at:source.at,note:'Coleta automática por navegador; apenas o evento monitorado.'});
  }
 }
 return data;
}
