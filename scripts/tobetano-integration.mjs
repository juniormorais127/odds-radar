import fs from 'node:fs/promises';
import {matching} from '../worker/backend.js';
export async function readTobetano(){try{return JSON.parse(await fs.readFile('collector-output/tobetano/index.json','utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}}
export function mergeTobetano(data,source){
 data.sources=data.sources.filter(s=>s.key!=='tobetano');
 data.sources.push({key:'tobetano',ok:!!source?.ok,at:source?.at||null,partial:source?.partial??true,count:source?.records?.length||0,error:source?.error||(!source?'Coleta ainda não executada':null),offline:false,note:'Somente futebol pré-jogo. Todos os mercados retornados no catálogo Tobetano.'});
 if(!source?.ok)return data;
 for(const row of source.records||[]){
  if(Date.parse(row.time)<=Date.now()||row.odds.length!==3||!row.odds.every(o=>Number.isFinite(o)&&o>1))continue;
  let game=data.games.find(g=>matching(g,row));if(!game){game={home:row.home,away:row.away,time:row.time,league:row.league,books:{}};data.games.push(game)}
  game.books.tobetano={odds:row.odds,url:row.url,at:row.at,offline:false};
 }
 return data;
}
export async function publishTobetano(output){
 const source=await readTobetano();const dir=output+'/api/v1/tobetano';await fs.mkdir(dir,{recursive:true});
 if(source){
  await fs.mkdir(dir+'/events',{recursive:true});
  await fs.copyFile('collector-output/tobetano/index.json',dir+'/index.json');
  for(const e of source.events){if(!/^\d+$/.test(e.id)||e.stage!==1)throw Error('Evento fora do escopo pré-jogo');await fs.copyFile('collector-output/tobetano/events/'+e.id+'.json',dir+'/events/'+e.id+'.json')}
  try{await fs.copyFile('collector-output/tobetano/translations.json',dir+'/translations.json')}catch(e){if(e.code!=='ENOENT')throw e}
 }
 else await fs.writeFile(dir+'/index.json',JSON.stringify({bookmakerId:'tobetano',ok:false,error:'Coleta ainda não executada',events:[]}));
 return source;
}
