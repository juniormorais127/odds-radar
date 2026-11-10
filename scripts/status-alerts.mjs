import {matching} from '../worker/backend.js';
const sameTeams=(a,b)=>matching({...a,time:'2026-01-01T00:00:00Z'},{...b,time:'2026-01-01T00:00:00Z'});
const feed=id=>['giro','futamina'].includes(id)?'shared-giro':id;
export function statusAlerts(prematch,references,now=Date.now()){
 const alerts=[];
 for(const p of prematch){const age=now-Date.parse(p.observedAt);if(age<0||age>90000||!p.odds?.every(o=>Number.isFinite(o)&&o>1))continue;
  const candidates=references.filter(g=>{
   if(feed(p.bookmakerId)===feed(g.bookmakerId)||g.lifecycle==='unavailable')return false;
   const ended=!!g.finishedAt,age=now-Date.parse(g.observedAt);
   if(ended?now-Date.parse(g.finishedAt)>86400000:age<0||age>40000||g.event.stage!==2)return false;
   const e={home:g.event.competitors?.[0]?.name||'',away:g.event.competitors?.[1]?.name||''};
   return sameTeams(p,e)&&Math.abs(Date.parse(p.time)-g.event.startTime*1000)<=7200000;
  });
  if(!candidates.length)continue;
  // Multiple kickoffs for the same teams are ambiguous; never pick one arbitrarily.
  if(candidates.some(g=>Math.abs(g.event.startTime-candidates[0].event.startTime)>60))continue;
  const ended=candidates.filter(g=>g.finishedAt);if(ended.length&&candidates.some(g=>!g.finishedAt))continue;
  const r=(ended.length?ended:candidates).sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt))[0];
  alerts.push({id:p.bookmakerId+'|'+r.id+'|'+(ended.length?'finished':'started'),type:ended.length?'finished_as_prematch':'started_as_prematch',event:p.home+' × '+p.away,bookmakerId:p.bookmakerId,bookmakerName:p.bookmakerName,listedStartsAt:p.time,listedStatus:'Pré-jogo na coleta',observedAt:p.observedAt,odds:p.odds,sourceUrl:p.url,reference:{bookmakerId:r.bookmakerId,bookmakerName:r.bookmakerName,status:ended.length?'Encerrado confirmado':'Ao vivo na fonte',startsAt:new Date(r.event.startTime*1000).toISOString(),observedAt:r.observedAt,confirmedAt:r.finishedAt||null,score:r.event.scoreboard?.scores?.find(s=>s.periodScoreType===1&&s.period===1&&s.subPeriod==null&&!s.isRemoved)?.score||null,clock:r.event.stageName||null,seconds:r.event.scoreboard?.timer?.currentTimeSeconds??null},scheduleDifferenceMinutes:Math.round((Date.parse(p.time)-r.event.startTime*1000)/60000),note:'Divergência entre fontes coletadas, sem validação independente por provedor de resultados. Pode haver atraso, remarcação ou erro de identidade. Aceitação de apostas não confirmada.'});
 }return alerts;
}
