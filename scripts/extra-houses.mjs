import fs from 'node:fs/promises';
import {matching} from '../worker/backend.js';
export async function loadExtraHouses(){try{return JSON.parse(await fs.readFile('collector-output/extra-houses.json','utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}}
export function mergeExtraHouses(data,extra){
 for(const s of extra?.sources||[]){
  data.sources=data.sources.filter(r=>r.key!==s.key);data.sources.push({key:s.key,ok:s.ok,count:s.games?.length||0,at:s.at,partial:s.partial??true,offline:false,error:s.error||null,note:s.note});
  if(!s.ok)continue;
  for(const row of s.games){if(Date.parse(row.time)<=Date.now()||row.odds.length!==3||!row.odds.every(o=>Number.isFinite(o)&&o>1))continue;let g=data.games.find(g=>matching(g,row));if(!g){g={home:row.home,away:row.away,time:row.time,league:row.league,books:{}};data.games.push(g)}g.books[s.key]={odds:row.odds,url:row.url,at:s.at,offline:false}}
 }
 return data;
}
