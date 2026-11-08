import fs from 'node:fs/promises';
import {adapters,HOUSE_NAMES} from './house-adapters.mjs';
import {matching} from '../worker/backend.js';
import {footballApi} from './football-api.mjs';
export function createHouseManager(directory,onUpdate=()=>{}){
 const states=new Map(Object.entries(HOUSE_NAMES).map(([id,name])=>[id,{id,name,status:'waiting',pending:false,lastAttemptAt:null,lastSuccessAt:null,nextRunAt:null,error:null,partial:true,games:[],intervalSeconds:['two','sportsbet','stake','fortune'].includes(id)?1800:id==='exclusive'?300:180}]));
 let active=0,queue=[],stopped=false;
 const status=()=>[...states.values()].map(({games,documents,...s})=>({...s,gameCount:games.length,quoteCount:games.length*3,scope:s.note||'Futebol pré-jogo, resultado final. Ao vivo é separado.'}));
 async function run(id){const state=states.get(id);if(stopped||state.pending)return;state.pending=true;state.status='collecting';state.lastAttemptAt=new Date().toISOString();state.nextRunAt=null;onUpdate();
  try{const result=await adapters[id]();const at=result.at||new Date().toISOString();if(!result.games?.length)throw Error('Nenhuma odd válida retornada');
   const old=new Map(state.games.map(g=>[[g.home,g.away,new Date(g.time).toISOString()].join('|'),g]));const changes=[];
   for(const game of result.games){if(!Number.isFinite(Date.parse(game.time)))continue;const previous=old.get([game.home,game.away,new Date(game.time).toISOString()].join('|'));for(let i=0;i<3;i++){if(!Number.isFinite(game.odds[i])||game.odds[i]<=1||previous?.odds[i]===game.odds[i])continue;changes.push({bookmakerId:id,bookmakerName:state.name,home:game.home,away:game.away,startsAt:game.time,market:'ft_1x2',selection:['home','draw','away'][i],observedAt:at,before:previous?.odds[i]??null,after:game.odds[i]})}}
   const history=directory+'/history/'+id;await fs.mkdir(history,{recursive:true});if(changes.length)await fs.appendFile(history+'/'+at.slice(0,13)+'.jsonl',changes.map(r=>JSON.stringify(r)).join('\n')+'\n');
   for(const file of await fs.readdir(history)){if(/^\d{4}-\d{2}-\d{2}T\d{2}\.jsonl$/.test(file)&&Date.parse(file.slice(0,13)+':00:00Z')+3600000<Date.now()-72*3600000)await fs.unlink(history+'/'+file)}
   state.games=result.games;state.documents=result.favouriteDocuments||[];state.lastSuccessAt=at;state.status=result.offline?'historical':'success';state.partial=!!result.partial;state.note=result.note||null;state.error=null;}
  catch(e){state.error=e.message;state.status=/403|challenge|captcha/i.test(e.message)?'blocked':'failed'}
  finally{state.pending=false;state.nextRunAt=new Date(Date.now()+state.intervalSeconds*1000).toISOString();await fs.mkdir(directory,{recursive:true});await fs.writeFile(directory+'/'+id+'.json',JSON.stringify(state));onUpdate();if(!stopped)setTimeout(()=>enqueue(id),state.intervalSeconds*1000)}
 }
 function enqueue(id){if(!queue.includes(id)&&!states.get(id).pending)queue.push(id);pump()}
 function pump(){while(!stopped&&active<3&&queue.length){const id=queue.shift();active++;run(id).catch(e=>console.error('Falha ao salvar robô '+id+': '+e.message)).finally(()=>{active--;pump()})}}
 function snapshot(){
  const sources=[],games=[],buckets=new Map();
  for(const s of states.values()){
   const usable=s.status==='success'||s.status==='collecting';sources.push({key:s.id,ok:usable,at:usable?s.lastSuccessAt:s.lastAttemptAt,partial:s.partial,count:s.games.length,error:s.error,offline:s.status==='historical',note:s.note});
   for(const row of s.games){const time=Date.parse(row.time);if(!Number.isFinite(time)||time<=Date.now()||!row.odds?.every(o=>Number.isFinite(o)&&o>1)||row.odds.length!==3)continue;
    const minute=Math.floor(time/60000),possible=[-1,0,1].flatMap(offset=>buckets.get(minute+offset)||[]);let target=possible.find(g=>matching(g,row));
    if(!target){target={home:row.home,away:row.away,time:row.time,league:row.league,books:{}};games.push(target);const bucket=buckets.get(minute)||[];bucket.push(target);buckets.set(minute,bucket)}
    target.books[s.id]={odds:row.odds,url:row.url,at:s.lastSuccessAt,offline:!usable};
   }
  }
  return footballApi({at:new Date().toISOString(),games,sources});
 }
 return {status,snapshot,documents:()=>[...states.values()].flatMap(s=>s.status==='success'||s.status==='collecting'?s.documents||[]:[]),house:id=>states.get(id)||null,start(){for(const id of states.keys())enqueue(id)},stop(){stopped=true;queue=[]}};
}
