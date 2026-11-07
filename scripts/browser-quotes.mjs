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
