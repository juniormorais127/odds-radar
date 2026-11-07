export const RETENTION_MS=72*3600000;
export function updateHistory(previous,api,now=Date.now()){
 if(previous&&previous.schemaVersion!=='1.0.0')throw Error('Versão do histórico incompatível');
 const cutoff=now-RETENTION_MS,series=new Map(),events=new Map(api.events.map(e=>[e.id,e]));
 for(const row of previous?.series||[]){
  const samples=row.samples.filter(s=>Date.parse(s.at)>=cutoff&&Date.parse(s.at)<=now&&Number.isFinite(s.odds)&&s.odds>1);
  if(samples.length)series.set(row.id,{...row,samples});
 }
 for(const q of api.quotes){
  const at=Date.parse(q.observedAt);if(q.method!=='automatic'||q.freshness!=='current'||!Number.isFinite(at)||at<cutoff||at>now||!Number.isFinite(q.decimalOdds)||q.decimalOdds<=1)continue;
  const event=events.get(q.eventId);if(!event)continue;
  let row=series.get(q.id);
  if(!row){row={id:q.id,eventId:q.eventId,event,bookmakerId:q.bookmakerId,marketId:q.marketId,period:q.period,selection:q.selection,selectionName:q.selectionName,sourceUrl:q.sourceUrl,samples:[]};series.set(q.id,row);}
  row.event=event;row.sourceUrl=q.sourceUrl;
  if(!row.samples.some(s=>s.at===q.observedAt))row.samples.push({at:q.observedAt,odds:q.decimalOdds});
  row.samples.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
 }
 const alerts=[];const thresholdPercent=20;
 for(const row of series.values()){
  const first=row.samples[0];
  for(let i=1;i<row.samples.length;i++){
   const latest=row.samples[i],prior=row.samples[i-1];
   const changes=[{scope:'between_collections',from:prior},{scope:'since_first_in_window',from:first}].map(c=>({...c,percent:(latest.odds/c.from.odds-1)*100}));
   const qualifying=changes.filter(c=>Math.abs(c.percent)>=thresholdPercent-1e-9);
   if(!qualifying.length)continue;
   const change=qualifying.sort((a,b)=>Math.abs(b.percent)-Math.abs(a.percent))[0];
   alerts.push({id:row.id+'|'+latest.at,seriesId:row.id,event:row.event,bookmakerId:row.bookmakerId,marketId:row.marketId,selectionName:row.selectionName,from:change.from,to:latest,changePercent:change.percent,direction:change.percent>0?'up':'down',scope:change.scope,sourceUrl:row.sourceUrl});
  }
 }
 return {schemaVersion:'1.0.0',generatedAt:new Date(now).toISOString(),retentionHours:72,thresholdPercent,startedAt:previous?.startedAt||new Date(now).toISOString(),series:[...series.values()],alerts:alerts.sort((a,b)=>Date.parse(b.to.at)-Date.parse(a.to.at))};
}
