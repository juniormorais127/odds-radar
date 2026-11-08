import fs from 'node:fs';
export class LiveLifecycle{
 constructor(file){this.file=file;try{this.rows=new Map(JSON.parse(fs.readFileSync(file,'utf8')).map(r=>[r.id,r]))}catch(e){if(e.code!=='ENOENT')throw e;this.rows=new Map()}}
 observe(g,now=Date.now()){
  const old=this.rows.get(g.id);if(old?.finishedAt)return;
  const finished=g.event?.scoreboard?.stage===9;
  this.rows.set(g.id,{...g,markets:[],lastSeenAt:new Date(now).toISOString(),finishedAt:finished?new Date(now).toISOString():null,deleteAt:finished?new Date(now+86400000).toISOString():null});
 }
 missing(current,now=Date.now()){const ids=new Set(current.map(g=>g.id));return [...this.rows.values()].filter(g=>!ids.has(g.id)&&(!g.deleteAt||Date.parse(g.deleteAt)>now)).map(g=>({...g,lifecycle:g.finishedAt?'finished':'unavailable',event:{...g.event,tradingStatus:0,stage:g.finishedAt?3:g.event.stage,stageName:g.finishedAt?'Encerrado':'Sem atualização'},markets:[]}))}
 expire(now=Date.now()){const expired=[...this.rows.values()].filter(g=>g.deleteAt&&Date.parse(g.deleteAt)<=now);for(const g of expired)this.rows.delete(g.id);return expired}
 save(){fs.writeFileSync(this.file+'.tmp',JSON.stringify([...this.rows.values()]));fs.renameSync(this.file+'.tmp',this.file)}
 pending(){return [...this.rows.values()].filter(g=>!g.finishedAt&&g.bookmakerId==='tobetano').map(g=>g.id)}
}
