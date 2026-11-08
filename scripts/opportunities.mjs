export const LIMITS={maxFinal:1.6,minHalf:3,prematchMaxAgeMs:300000,liveMaxAgeMs:40000};
const fresh=(at,maxAge,now)=>Number.isFinite(Date.parse(at))&&now>=Date.parse(at)&&now-Date.parse(at)<=maxAge;
const getPrices=(markets,period)=>{
 const market=markets.find(m=>m.key.resultKind===1&&m.key.marketType===2&&m.key.period===period&&m.key.subPeriod==null&&m.key.layout==null);
 const items=market?.marketItems.filter(i=>!i.isRemoved&&!i.key.marketParameters.length)||[];if(items.length!==1)return null;
 return [0,1,3].map(type=>{const o=items[0].outcomes.find(o=>o.key.type===type&&!o.isRemoved&&!o.isFrozen);return o?.decimalOdds>1?o.decimalOdds:null});
};
export function favouriteSignal(document,mode,now=Date.now()){
 const e=document.event,at=document.observedAt;
 if(!fresh(at,mode==='live'?LIMITS.liveMaxAgeMs:LIMITS.prematchMaxAgeMs,now)||e.sport!=='F'||e.isCybersport||e.tradingStatus!==1)return null;
 if(mode==='live'){
  const seconds=e.scoreboard?.timer?.currentTimeSeconds;
  if(e.stage!==2||![0,1,2].includes(e.status)||!Number.isFinite(seconds)||seconds<0||seconds>=2700)return null;
 }else if(e.stage!==1||e.status!==0||e.startTime*1000<=now)return null;
 const ft=getPrices(document.markets,0),ht=getPrices(document.markets,1);if(!ft?.[0]||!ft?.[2])return null;
 const side=ft[0]<ft[2]?0:2;
 if(!(ft[side]<=LIMITS.maxFinal&&ht?.[side]>LIMITS.minHalf))return null;
 return {id:mode+'|favourite|'+document.id+'|'+side,mode,type:'favourite_first_half',eventId:document.id,event:e.name,selection:e.competitors?.[side===0?0:1]?.name,bookmakerId:'tobetano',finalOdds:ft[side],firstHalfOdds:ht[side],observedAt:at,startsAt:new Date(e.startTime*1000).toISOString(),scoreboard:e.scoreboard,rule:'Vitória final até 1,60 e vitória do mesmo time no 1º tempo acima de 3,00',note:mode==='live'?'Padrão de preço. No ao vivo, o tempo restante e o placar podem explicar a diferença; não confirma valor esperado positivo.':'Padrão de preço; exige comparação adicional para confirmar vantagem.'};
}
export function analyzeLive(snapshot,now=Date.now()){
 const signals=[];for(const row of snapshot.events||[]){const s=favouriteSignal({id:row.id,event:row.event,markets:row.markets,observedAt:row.observedAt},'live',now);if(s)signals.push(s)}return signals;
}
export function analyzePrematch(api,now=Date.now()){
 const events=new Map((api.events||[]).filter(e=>e.sport==='football'&&Date.parse(e.startsAt)>now&&!/\((?!(?:f|w|feminino|women|u\d{1,2})\))/i.test(e.home+' '+e.away)).map(e=>[e.id,e])),groups=new Map();
 for(const q of api.quotes||[]){if(!events.has(q.eventId)||q.marketId!=='ft_1x2'||q.method!=='automatic'||q.freshness!=='current'||!fresh(q.observedAt,LIMITS.prematchMaxAgeMs,now)||!(q.decimalOdds>1))continue;const g=groups.get(q.eventId)||[];g.push(q);groups.set(q.eventId,g)}
 const signals=[];
 for(const [id,rows] of groups){
  // Giro and Futamina may share a feed. Keep one for price-gap evidence.
  const independent=rows.filter(q=>q.bookmakerId!=='futamina'||!rows.some(p=>p.bookmakerId==='giro'&&p.selection===q.selection));
  const picks=['home','draw','away'].map(side=>rows.filter(q=>q.selection===side).sort((a,b)=>b.decimalOdds-a.decimalOdds)[0]);
  const event=events.get(id);
  if(picks.every(Boolean)&&new Set(picks.map(q=>q.bookmakerId)).size>=2){const profit=(1/picks.reduce((n,q)=>n+1/q.decimalOdds,0)-1)*100;if(profit>0.1)signals.push({id:'prematch|surebet|'+id,mode:'prematch',type:'surebet_candidate',eventId:id,event:event.home+' × '+event.away,startsAt:event.startsAt,profitPercent:profit,picks,observedAt:picks.map(q=>q.observedAt).sort()[0],note:'Retorno matemático teórico; aceitação, limites e regras de liquidação ainda precisam de conferência.'})}
  for(const selection of ['home','draw','away']){
   const values=independent.filter(q=>q.selection===selection).sort((a,b)=>b.decimalOdds-a.decimalOdds);if(values.length<2)continue;
   const best=values[0],other=values.at(-1),gapPercent=(best.decimalOdds/other.decimalOdds-1)*100;
   if(gapPercent>=20)signals.push({id:'prematch|gap|'+id+'|'+selection,mode:'prematch',type:'price_gap',eventId:id,event:event.home+' × '+event.away,startsAt:event.startsAt,selection:best.selectionName,best,other,gapPercent,observedAt:[best.observedAt,other.observedAt].sort()[0],note:'Diferença de preço, sem confirmação de chance de vitória ou valor esperado positivo.'});
  }
 }
 return signals.sort((a,b)=>(b.profitPercent??b.gapPercent??0)-(a.profitPercent??a.gapPercent??0));
}
