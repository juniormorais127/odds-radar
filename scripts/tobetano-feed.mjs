export const TOBETANO_ORIGIN='https://sport-iframe.aakvjlhif.com';
export const eligiblePrematch=(e,now=Date.now())=>e?.sport==='F'&&e.stage===1&&e.status===0&&e.startTime*1000>now&&!e.isCybersport;
export async function publicConfig(){
 const r=await fetch(TOBETANO_ORIGIN+'/pt/',{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Iframe HTTP '+r.status);
 const text=await r.text(),match=text.match(/window\.__PRERENDERED_CONFIGS__\.common = (.*?);<\/script>/s);
 if(!match)throw Error('Configuração pública do iframe não encontrada');
 const c=JSON.parse(match[1]);if(!c.brand||!c.widgets?.defaultVariation?.apiKeySdk)throw Error('Configuração pública incompleta');return c;
}
export async function connectFeed(config){
 const context={language:'pt',channel:'MOBILE_WEB',brand:config.brand,currency:config.defaultCurrency||'BRL',user:null};
 // This SDK identifier is published by the unauthenticated iframe; no account token is used.
 const url=new URL(TOBETANO_ORIGIN.replace('https:','wss:')+'/direct-feed/feed');url.search=new URLSearchParams({brand:config.brand,'X-Api-Key':config.widgets.defaultVariation.apiKeySdk});
 const ws=new WebSocket(url),pending=new Map();let counter=0,closed=false;
 const send=value=>ws.send(JSON.stringify(value)+'\x1e');
 const ready=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{reject(Error('Timeout na conexão pública'));ws.close()},20000);
  const fail=error=>{clearTimeout(timer);reject(error);for(const p of pending.values()){clearTimeout(p.timer);p.reject(error)}pending.clear()};
  ws.onopen=()=>send({protocol:'json',version:1});
  ws.onerror=()=>fail(Error('Falha no WebSocket público'));
  ws.onclose=()=>{closed=true;fail(Error('Conexão pública encerrada'))};
  ws.onmessage=e=>{try{for(const part of String(e.data).split('\x1e').filter(Boolean)){
   const d=JSON.parse(part);if(!d.type){clearTimeout(timer);if(d.error)fail(Error(d.error));else resolve(true);continue}
   if(d.type===7){fail(Error(d.error||'Feed encerrou a conexão'));continue}
   const p=pending.get(d.invocationId);if(!p)continue;
   if(d.type===2&&d.item?.isInitialBatch){clearTimeout(p.timer);pending.delete(d.invocationId);send({type:5,invocationId:d.invocationId});p.resolve(d.item.data||[])}
   if(d.type===3){clearTimeout(p.timer);pending.delete(d.invocationId);d.error?p.reject(Error(d.error)):p.resolve([])}
  }}catch(error){fail(error)}};
 });
 return {query(target,args=[],timeout=25000){if(!ready||closed)return Promise.reject(Error('Feed desconectado'));const invocationId=String(counter++);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(invocationId);if(!closed)send({type:5,invocationId});reject(Error('Timeout: '+target))},timeout);pending.set(invocationId,{resolve,reject,timer});send({type:4,invocationId,target,arguments:[...args,context]})})},close(){ws.close()}};
}
export function convertMarkets(rows){return rows.filter(r=>!r.isRemoved&&r.key&&r.value).map(r=>({key:r.key,...r.value,marketItems:(r.value.marketItems||[]).filter(i=>!i.isRemoved).map(i=>({...i,outcomes:(i.outcomes||[]).filter(o=>!o.isRemoved).map(o=>({...o,decimalOdds:Number.isInteger(o.odd)&&o.odd>0?o.odd/100:null}))}))}));}
export function finalOdds(markets){
 const m=markets.find(m=>m.key.resultKind===1&&m.key.marketType===2&&m.key.period===0&&m.key.subPeriod==null&&m.key.layout==null);
 const items=m?.marketItems.filter(i=>!(i.key?.marketParameters||[]).length)||[];
 if(items.length!==1)return null;
 const outcomes=items[0].outcomes;if(outcomes.length!==3||outcomes.some(o=>o.isFrozen||!(o.decimalOdds>1)))return null;
 const prices=[0,1,3].map(type=>outcomes.find(o=>o.key.type===type)?.decimalOdds);
 return prices.every(o=>Number.isFinite(o)&&o>1)?prices:null;
}
